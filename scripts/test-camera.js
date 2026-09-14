const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const watchdog = setTimeout(() => { console.error('Camera test timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800, useContentSize: true, webPreferences: { backgroundThrottling: false } });
  await win.loadFile(path.join(__dirname, 'fixtures', 'maplibre-6-harness.html'));
  await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.maplibreHarnessReady) { clearInterval(timer); resolve(); }
      else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error('MapLibre 6 harness timeout')); }
    }, 20);
  })`);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  if (process.argv.includes('--mobile')) {
    await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  }
  for (const file of ['src/vendor/maplibre-contour.js', 'src/location-camera.js']) {
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
  }
  await win.webContents.executeJavaScript(`window.onlineTerrainTest = ${process.argv.includes('--online')};`);
  const result = await win.webContents.executeJavaScript(`(async () => {
    document.head.innerHTML = '<meta name="viewport" content="width=device-width,initial-scale=1">';
    document.body.style.margin = '0';
    document.body.innerHTML = '<div id="map" style="width:100vw;height:100vh"></div>';
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    // Deterministic high-altitude DEM, no network or user data dependencies.
    ctx.fillStyle = 'rgb(143,160,0)'; ctx.fillRect(0,0,256,256); // 4000 m Terrarium
    const png = await new Promise(r => canvas.toBlob(async b => r(await b.arrayBuffer())));
    const bytes = new Uint8Array(png); let binary=''; for(let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    const fixtureUrl = 'data:image/png;base64,' + btoa(binary);
    const demSource = new mlcontour.DemSource({
      url: onlineTerrainTest ? 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp' : fixtureUrl,
      encoding: 'terrarium', maxzoom: 12, worker: true,
      cacheSize: 128, timeoutMs: 16000
    });
    demSource.setupMaplibre(maplibregl);
    const tiles = [demSource.sharedDemProtocolUrl];
    const m = new maplibregl.Map({container:'map',center:[118.35,35.10],zoom:8,pitch:50,maxPitch:85,attributionControl:false,style:{version:8,sources:{'terrain-dem':{type:'raster-dem',tiles,tileSize:256,encoding:'terrarium',maxzoom:12}},layers:[{id:'bg',type:'background',paint:{'background-color':'#a8d8f0'}}]}});
    await new Promise(r => m.once('load',r)); m.setTerrain({source:'terrain-dem',exaggeration:1.5});
    await sleep(450);
    const preparedTerrainTiles = new Map();
    const prepareTerrain = async (coordinates, options = {}) => {
      const z=Math.max(0,Math.min(12,Math.floor(Number(options.zoom)||12))),n=2**z;
      const lng=Number(coordinates[0]),lat=Math.max(-85.0511,Math.min(85.0511,Number(coordinates[1]))),rad=lat*Math.PI/180;
      const cx=Math.floor((lng+180)/360*n),cy=Math.floor((1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*n);
      const controller=new AbortController();
      options.signal?.addEventListener?.('abort',()=>controller.abort(),{once:true});
      const requests=[];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const x=(cx+dx+n)%n,y=Math.max(0,Math.min(n-1,cy+dy)),key=z+'/'+x+'/'+y;
        requests.push(demSource.getDemTile(z,x,y,controller).then(tile=>{preparedTerrainTiles.set(key,tile);return tile}));
      }
      await Promise.allSettled(requests);
    };
    const resolveTerrainElevation = (coordinates, requestedZoom) => {
      const lng=Number(coordinates.lng ?? coordinates[0]),lat=Math.max(-85.0511,Math.min(85.0511,Number(coordinates.lat ?? coordinates[1])));
      for(let z=Math.max(0,Math.min(12,Math.floor(Number(requestedZoom)||12)));z>=0;z--){
        const n=2**z,worldX=((((lng+180)/360*n)%n)+n)%n,rad=lat*Math.PI/180;
        const worldY=Math.max(0,Math.min(n-Number.EPSILON,(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*n));
        const tileX=Math.floor(worldX),tileY=Math.floor(worldY),tile=preparedTerrainTiles.get(z+'/'+tileX+'/'+tileY);if(!tile)continue;
        const w=tile.width,h=tile.height,px=(worldX-tileX)*w-.5,py=(worldY-tileY)*h-.5;
        const x0=Math.max(0,Math.min(w-1,Math.floor(px))),y0=Math.max(0,Math.min(h-1,Math.floor(py))),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1);
        const tx=Math.max(0,Math.min(1,px-Math.floor(px))),ty=Math.max(0,Math.min(1,py-Math.floor(py))),read=(x,y)=>Number(tile.data[y*w+x]);
        const a=read(x0,y0),b=read(x1,y0),c=read(x0,y1),d=read(x1,y1);if(![a,b,c,d].every(Number.isFinite))continue;
        return (a+(b-a)*tx+(c+(d-c)*tx-(a+(b-a)*tx))*ty)*(Number(m.getTerrain()?.exaggeration)||1);
      }
      return null;
    };
    const fly = (coordinates, options = {}) => OutmapLocationCamera.fly(m, coordinates, {
      ...options
    });
    const waitForCameraSettle = async baseDelay => {
      await sleep(baseDelay);
      for (let i = 0; i < 60 && m.isMoving(); i++) await sleep(50);
    };
    const rows=[];
    let correctiveJumps=0;
    const nativeJump=m.jumpTo.bind(m);
    m.jumpTo=(opts,...args)=>{if(opts.duration === undefined && opts.elevation !== undefined)correctiveJumps++;return nativeJump(opts,...args)};
    function sample(name, c, centered=false, expectedZoom=null, expectedPitch=null) { const p=m.project(c),a=OutmapLocationCamera.anchor(m,centered); rows.push({name,error:Math.hypot(p.x-a.x,p.y-a.y),pitch:m.getPitch(),zoom:m.getZoom(),expectedZoom,expectedPitch,elevation:m.queryTerrainElevation(c),centerElevation:m.getCenterElevation(),center:m.getCenter(),padding:m.getPadding()}); }
    const settleBase = 2200;
    for(const [name,c,z,pitch,centered,elevation] of [ ['nearby',[118.36,35.11],14.8,50,false,71], ['Lhasa app',[91.117,29.646],13,50,false,3652], ['Lhasa close',[91.117,29.646],14.8,50,false,3652], ['2D',[117.12,36.65],12,0,false,144], ['overview',[104.5,36],4.45,50,true,2084], ['steep',[91.12,29.65],13,70,false,3652] ]) {
      fly(c,{zoom:z,pitch,centered,duration:180,elevation:onlineTerrainTest ? elevation : 4000}); await waitForCameraSettle(settleBase); sample(name,c,centered,z,pitch);
    }
    let oldArrival=0,newArrival=0;
    fly([118.36,35.1],{duration:500,onArrival:()=>oldArrival++}); await sleep(30);
    const rapidPitch=m.getPitch();
    fly([91.117,29.646],{zoom:14.8,pitch:rapidPitch,duration:200,onArrival:()=>newArrival++}); await waitForCameraSettle(settleBase); sample('rapid',[91.117,29.646],false,14.8,rapidPitch);
    let interruptedArrival=0;
    fly([117,36],{duration:500,onArrival:()=>interruptedArrival++}); await sleep(40);
    m.getCanvas().dispatchEvent(new Event('wheel')); m.jumpTo({center:[110,30],zoom:10}); await sleep(650);
    const userCenter=m.getCenter();
    fly([91,29],{duration:500}); await sleep(30);
    m.jumpTo({center:[111,31],zoom:9}); await sleep(250);
    const replacementCenter=m.getCenter();
    let instantArrival=0;
    fly([118,35],{zoom:12,pitch:0,duration:0,onArrival:()=>instantArrival++}); await sleep(onlineTerrainTest ? 3000 : 250); sample('instant',[118,35],false,12,0);
    // Simulate a late, higher resolution DEM response after arrival.
    fly([87,43],{zoom:15,pitch:50,duration:100,elevation:onlineTerrainTest ? 3821 : 4000}); await waitForCameraSettle(settleBase); sample('late DEM',[87,43],false,15,50);
    // MapLibre markers and route-point overlays are children of the canvas
    // container, not of the canvas itself. A wheel gesture beginning over one
    // of them must cancel the completed flight guard before its first camera
    // update, otherwise the guard restores the old zoom and creates a bounce.
    fly([101.3451,30.06],{zoom:11.8,pitch:50,duration:100}); await waitForCameraSettle(settleBase);
    const wheelOverlay=document.createElement('div');
    wheelOverlay.style.cssText='position:absolute;left:200px;top:200px;width:40px;height:40px';
    m.getCanvasContainer().appendChild(wheelOverlay);
    let overlayWheelZoom=null;
    wheelOverlay.addEventListener('wheel',event=>{
      m.jumpTo({zoom:12.25});
      overlayWheelZoom=m.getZoom();
      event.stopPropagation();
    });
    wheelOverlay.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-120}));
    wheelOverlay.remove();
    fly([102.1,31.2],{zoom:10.6,pitch:50,duration:100}); await waitForCameraSettle(settleBase);
    m.zoomTo(11.15,{duration:0});
    await sleep(30);
    const externalControlZoom=m.getZoom();
    if (innerWidth <= 768) {
      const panel = document.createElement('div'); panel.id='route-panel'; panel.style.cssText='position:fixed;left:0;right:0;bottom:0;height:300px;background:white'; document.body.appendChild(panel);
      fly([118,35],{zoom:14,pitch:50,duration:120}); await waitForCameraSettle(settleBase); sample('mobile drawer',[118,35],false,14,50);
      const drawerPoint = m.project([118,35]);
      const drawerTop = panel.getBoundingClientRect().top;
      rows[rows.length - 1].drawerTop = drawerTop;
      rows[rows.length - 1].viewport = [innerWidth, innerHeight];
      panel.style.display='none';
      fly([118,35],{zoom:14,pitch:0,duration:0}); await waitForCameraSettle(800); sample('hidden drawer',[118,35],false,14,0);
    }
    m.remove();
    return {rows,oldArrival,newArrival,interruptedArrival,instantArrival,userCenter,replacementCenter,correctiveJumps,overlayWheelZoom,externalControlZoom};
  })()`);
  console.log(JSON.stringify(result, null, 2));
  for (const row of result.rows) {
    assert(row.error < 3, `${row.name}: ${row.error}px`);
    assert(Object.values(row.padding).every(x => x === 0));
    if (row.expectedZoom != null) {
      if (process.argv.includes('--online')) {
        assert(row.zoom <= row.expectedZoom + 0.02 && row.zoom >= row.expectedZoom - 1.7,
          `${row.name}: native collision-safe zoom ${row.zoom}`);
      } else {
        assert(Math.abs(row.zoom - row.expectedZoom) < 0.02, `${row.name}: zoom ${row.zoom}`);
      }
    }
    if (row.expectedPitch != null) {
      if (process.argv.includes('--online')) {
        assert(row.pitch <= row.expectedPitch + 0.1 && row.pitch >= 0,
          `${row.name}: native collision-safe pitch ${row.pitch}`);
      } else {
        assert(Math.abs(row.pitch - row.expectedPitch) < 0.1, `${row.name}: pitch ${row.pitch}`);
      }
    }
  }
  assert.strictEqual(result.rows.find(r => r.name === '2D').pitch, 0);
  assert.strictEqual(result.oldArrival, 0);
  assert.strictEqual(result.newArrival, 1);
  assert.strictEqual(result.interruptedArrival, 0);
  assert.strictEqual(result.instantArrival, 1);
  assert(Math.abs(result.userCenter.lng - 110) < 1e-6);
  assert(Math.abs(result.replacementCenter.lng - 111) < 1e-6, 'External camera changes must not be hijacked');
  assert.strictEqual(result.correctiveJumps,0,'Terrain settling must not teleport the camera');
  assert(Math.abs(result.overlayWheelZoom - 12.25) < 0.02,
    `Wheel input over a map overlay was pulled back to zoom ${result.overlayWheelZoom}`);
  assert(Math.abs(result.externalControlZoom - 11.15) < 0.02,
    `A native zoom control was pulled back to zoom ${result.externalControlZoom}`);
  clearTimeout(watchdog);
  console.log('Camera projection and cancellation passed.'); app.quit();
}).catch(e => { console.error(e); app.exit(1); });

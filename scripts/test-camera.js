const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const watchdog = setTimeout(() => { console.error('Camera test timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: true, width: 1280, height: 800, webPreferences: { backgroundThrottling: false } });
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
  for (const file of ['src/location-camera.js']) {
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
    const tiles = [onlineTerrainTest ? 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp' : fixtureUrl];
    const m = new maplibregl.Map({container:'map',center:[118.35,35.10],zoom:8,pitch:50,maxPitch:85,attributionControl:false,style:{version:8,sources:{'terrain-dem':{type:'raster-dem',tiles,tileSize:256,encoding:'terrarium',maxzoom:12}},layers:[{id:'bg',type:'background',paint:{'background-color':'#a8d8f0'}}]}});
    await new Promise(r => m.once('load',r)); m.setTerrain({source:'terrain-dem',exaggeration:1.5});
    await sleep(450);
    const waitForCameraSettle = async baseDelay => {
      await sleep(baseDelay);
      for (let i = 0; i < 20 && m.isMoving(); i++) await sleep(50);
    };
    const rows=[];
    let correctiveJumps=0;
    const nativeJump=m.jumpTo.bind(m);
    m.jumpTo=(opts,...args)=>{if(opts.duration === undefined && opts.elevation !== undefined)correctiveJumps++;return nativeJump(opts,...args)};
    function sample(name, c, centered=false, expectedZoom=null, expectedPitch=null) { const p=m.project(c),a=OutmapLocationCamera.anchor(m,centered); rows.push({name,error:Math.hypot(p.x-a.x,p.y-a.y),pitch:m.getPitch(),zoom:m.getZoom(),expectedZoom,expectedPitch,elevation:m.queryTerrainElevation(c),center:m.getCenter(),padding:m.getPadding()}); }
    for(const [name,c,z,pitch,centered] of [ ['nearby',[118.36,35.11],14.8,50,false], ['Lhasa',[91.117,29.646],14.8,50,false], ['2D',[117.12,36.65],12,0,false], ['overview',[104.5,36],4.45,50,true], ['steep',[91.12,29.65],13,70,false] ]) {
      OutmapLocationCamera.fly(m,c,{zoom:z,pitch,centered,duration:180}); await waitForCameraSettle(onlineTerrainTest ? 3000 : 500); sample(name,c,centered,z,pitch);
    }
    let oldArrival=0,newArrival=0;
    OutmapLocationCamera.fly(m,[118.36,35.1],{duration:500,onArrival:()=>oldArrival++}); await sleep(30);
    const rapidPitch=m.getPitch();
    OutmapLocationCamera.fly(m,[91.117,29.646],{zoom:14.8,duration:200,onArrival:()=>newArrival++}); await sleep(500); sample('rapid',[91.117,29.646],false,14.8,rapidPitch);
    let interruptedArrival=0;
    OutmapLocationCamera.fly(m,[117,36],{duration:500,onArrival:()=>interruptedArrival++}); await sleep(40);
    m.getCanvas().dispatchEvent(new Event('wheel')); m.jumpTo({center:[110,30],zoom:10}); await sleep(650);
    const userCenter=m.getCenter();
    OutmapLocationCamera.fly(m,[91,29],{duration:500}); await sleep(30);
    m.jumpTo({center:[111,31],zoom:9}); await sleep(250);
    const replacementCenter=m.getCenter();
    let instantArrival=0;
    OutmapLocationCamera.fly(m,[118,35],{zoom:12,pitch:0,duration:0,onArrival:()=>instantArrival++}); await sleep(onlineTerrainTest ? 3000 : 250); sample('instant',[118,35],false,12,0);
    // Simulate a late, higher resolution DEM response after arrival.
    OutmapLocationCamera.fly(m,[87,43],{zoom:15,pitch:50,duration:100}); await sleep(1500); sample('late DEM',[87,43],false,15,50);
    // MapLibre markers and route-point overlays are children of the canvas
    // container, not of the canvas itself. A wheel gesture beginning over one
    // of them must cancel the completed flight guard before its first camera
    // update, otherwise the guard restores the old zoom and creates a bounce.
    OutmapLocationCamera.fly(m,[101.3451,30.06],{zoom:11.8,pitch:50,duration:100}); await sleep(450);
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
    if (innerWidth <= 768) {
      const panel = document.createElement('div'); panel.id='route-panel'; panel.style.cssText='position:fixed;left:0;right:0;bottom:0;height:300px;background:white'; document.body.appendChild(panel);
      OutmapLocationCamera.fly(m,[118,35],{zoom:14,pitch:50,duration:120}); await sleep(500); sample('mobile drawer',[118,35],false,14,50);
      if (m.project([118,35]).y >= panel.getBoundingClientRect().top) throw Error('Target hidden under drawer');
      panel.style.display='none';
      OutmapLocationCamera.fly(m,[118,35],{zoom:14,pitch:0,duration:0}); await sleep(200); sample('hidden drawer',[118,35],false,14,0);
    }
    m.remove();
    return {rows,oldArrival,newArrival,interruptedArrival,instantArrival,userCenter,replacementCenter,correctiveJumps,overlayWheelZoom};
  })()`);
  console.log(JSON.stringify(result, null, 2));
  for (const row of result.rows) {
    assert(row.error < 3, `${row.name}: ${row.error}px`);
    assert(Object.values(row.padding).every(x => x === 0));
    if (row.expectedZoom != null) assert(Math.abs(row.zoom - row.expectedZoom) < 0.02, `${row.name}: zoom ${row.zoom}`);
    if (row.expectedPitch != null) assert(Math.abs(row.pitch - row.expectedPitch) < 0.1, `${row.name}: pitch ${row.pitch}`);
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
  clearTimeout(watchdog);
  console.log('Camera projection and cancellation passed.'); app.quit();
}).catch(e => { console.error(e); app.exit(1); });

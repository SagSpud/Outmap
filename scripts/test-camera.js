const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const watchdog = setTimeout(() => { console.error('Camera test timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: true, width: 1280, height: 800, webPreferences: { backgroundThrottling: false } });
  await win.loadURL('about:blank');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  if (process.argv.includes('--mobile')) {
    await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  }
  for (const file of ['src/vendor/maplibre-gl.js', 'src/location-camera.js']) {
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
    let tileDelay = 0;
    maplibregl.addProtocol('fixture', async () => { await sleep(tileDelay); return {data: png.slice(0)}; });
    const tiles = [onlineTerrainTest ? 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp' : 'fixture://dem/{z}/{x}/{y}'];
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
    function sample(name, c, centered=false) { const p=m.project(c),a=OutmapLocationCamera.anchor(m,centered); rows.push({name,error:Math.hypot(p.x-a.x,p.y-a.y),pitch:m.getPitch(),zoom:m.getZoom(),elevation:m.queryTerrainElevation(c),center:m.getCenter(),padding:m.getPadding()}); }
    for(const [name,c,z,pitch,centered] of [ ['nearby',[118.36,35.11],14.8,50,false], ['Lhasa',[91.117,29.646],14.8,50,false], ['2D',[117.12,36.65],12,0,false], ['overview',[104.5,36],4.45,50,true], ['steep',[91.12,29.65],13,70,false] ]) {
      OutmapLocationCamera.fly(m,c,{zoom:z,pitch,centered,duration:180}); await waitForCameraSettle(onlineTerrainTest ? 3000 : 500); sample(name,c,centered);
    }
    let oldArrival=0,newArrival=0;
    OutmapLocationCamera.fly(m,[118.36,35.1],{duration:500,onArrival:()=>oldArrival++}); await sleep(30);
    OutmapLocationCamera.fly(m,[91.117,29.646],{zoom:14.8,duration:200,onArrival:()=>newArrival++}); await sleep(500); sample('rapid',[91.117,29.646]);
    let interruptedArrival=0;
    OutmapLocationCamera.fly(m,[117,36],{duration:500,onArrival:()=>interruptedArrival++}); await sleep(40);
    m.getCanvas().dispatchEvent(new Event('wheel')); m.jumpTo({center:[110,30],zoom:10}); await sleep(650);
    const userCenter=m.getCenter();
    OutmapLocationCamera.fly(m,[91,29],{duration:500}); await sleep(30);
    m.jumpTo({center:[111,31],zoom:9}); await sleep(250);
    const replacementCenter=m.getCenter();
    let instantArrival=0;
    OutmapLocationCamera.fly(m,[118,35],{zoom:12,pitch:0,duration:0,onArrival:()=>instantArrival++}); await sleep(onlineTerrainTest ? 3000 : 250); sample('instant',[118,35]);
    // Simulate a late, higher resolution DEM response after arrival.
    tileDelay=800;
    OutmapLocationCamera.fly(m,[87,43],{zoom:15,pitch:50,duration:100}); await sleep(1500); sample('late DEM',[87,43]);
    if (innerWidth <= 768) {
      const panel = document.createElement('div'); panel.id='route-panel'; panel.style.cssText='position:fixed;left:0;right:0;bottom:0;height:300px;background:white'; document.body.appendChild(panel);
      OutmapLocationCamera.fly(m,[118,35],{zoom:14,pitch:50,duration:120}); await sleep(500); sample('mobile drawer',[118,35]);
      if (m.project([118,35]).y >= panel.getBoundingClientRect().top) throw Error('Target hidden under drawer');
      panel.style.display='none';
      OutmapLocationCamera.fly(m,[118,35],{zoom:14,pitch:0,duration:0}); await sleep(200); sample('hidden drawer',[118,35]);
    }
    m.remove();
    return {rows,oldArrival,newArrival,interruptedArrival,instantArrival,userCenter,replacementCenter,correctiveJumps};
  })()`);
  console.log(JSON.stringify(result, null, 2));
  for (const row of result.rows) { assert(row.error < 3, `${row.name}: ${row.error}px`); assert(Object.values(row.padding).every(x => x === 0)); }
  assert.strictEqual(result.rows.find(r => r.name === '2D').pitch, 0);
  assert.strictEqual(result.oldArrival, 0);
  assert.strictEqual(result.newArrival, 1);
  assert.strictEqual(result.interruptedArrival, 0);
  assert.strictEqual(result.instantArrival, 1);
  assert(Math.abs(result.userCenter.lng - 110) < 1e-6);
  assert(Math.abs(result.replacementCenter.lng - 111) < 1e-6, 'External camera changes must not be hijacked');
  assert.strictEqual(result.correctiveJumps,0,'Terrain settling must not teleport the camera');
  clearTimeout(watchdog);
  console.log('Camera projection and cancellation passed.'); app.quit();
}).catch(e => { console.error(e); app.exit(1); });

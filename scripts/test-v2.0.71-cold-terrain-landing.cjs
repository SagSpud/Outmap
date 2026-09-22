const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const cameraSource = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');
assert(cameraSource.includes('map.setCenterElevation?.(centerElevation)'),
  'cold landings must reconcile only center elevation through the public MapLibre API');
assert(cameraSource.includes('map.queryTerrainElevation?.(map.getCenter?.())'),
  'all navigation modes need the terrain-visibility guard');
assert(!cameraSource.includes('map._camera') && !cameraSource.includes('map.transform'),
  'production camera safety must not depend on MapLibre private camera fields');

const watchdog = setTimeout(() => {
  console.error('Cold terrain landing test timed out');
  app.exit(1);
}, 120000);

function makeTerrainPng(elevation) {
  const png = new PNG({ width: 256, height: 256 });
  const encoded = elevation + 32768;
  const red = Math.floor(encoded / 256);
  const green = Math.floor(encoded % 256);
  const blue = Math.round((encoded - Math.floor(encoded)) * 256);
  for (let index = 0; index < png.width * png.height; index++) {
    const offset = index * 4;
    png.data[offset] = red;
    png.data[offset + 1] = green;
    png.data[offset + 2] = blue;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png);
}

app.whenReady().then(async () => {
  const terrainPng = makeTerrainPng(3650);
  const server = http.createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'image/png',
        'Content-Length': terrainPng.length,
        'Cache-Control': 'no-store'
      });
      response.end(terrainPng);
    }, 1600);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const win = new BrowserWindow({
    show: true,
    width: 1280,
    height: 800,
    webPreferences: { backgroundThrottling: false }
  });

  try {
    await win.loadFile(path.join(root, 'scripts', 'fixtures', 'maplibre-6-harness.html'));
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.maplibreHarnessReady) { clearInterval(timer); resolve(); }
        else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error('MapLibre harness timeout')); }
      }, 20);
    })`);
    await win.webContents.executeJavaScript(`window.reliefFixtureUrl = 'http://127.0.0.1:${port}/{z}/{x}/{y}.png'; true;`);
    for (const file of ['src/vendor/maplibre-contour.js', 'src/location-camera.js']) {
      await win.webContents.executeJavaScript(`${fs.readFileSync(path.join(root, file), 'utf8')}\n;true;`);
    }
    await win.webContents.executeJavaScript(`window.__coldTerrainResult = null; (async () => {
      try {
      document.body.style.margin = '0';
      document.body.innerHTML = '<div id="map" style="width:100vw;height:100vh"></div>';
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const target = [101.6203, 30.0834];
      const dem = new mlcontour.DemSource({
        url: window.reliefFixtureUrl, encoding: 'terrarium', maxzoom: 12,
        worker: true, cacheSize: 64, timeoutMs: 5000
      });
      dem.setupMaplibre(maplibregl);
      const map = new maplibregl.Map({
        container: 'map', center: [15, 48], zoom: 4.5, pitch: 50,
        minZoom: 2, maxZoom: 15, maxPitch: 72,
        centerClampedToGround: false, scrollZoom: true,
        attributionControl: false,
        style: { version: 8, sources: {}, layers: [{
          id: 'background', type: 'background', paint: { 'background-color': '#dfe9df' }
        }] }
      });
      await new Promise(resolve => map.once('load', resolve));
      map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: [dem.sharedDemProtocolUrl],
        encoding: 'terrarium', tileSize: 256, maxzoom: 12
      });
      map.setTerrain({ source: 'terrain-dem', exaggeration: 2 });
      map.addLayer({
        id: 'hillshade', type: 'hillshade', source: 'terrain-dem',
        paint: { 'hillshade-exaggeration': 0.7 }
      });

      let preparedElevation = null;
      const prepareTerrain = async () => {
        const z = 12;
        const n = 2 ** z;
        const x = Math.floor(((target[0] + 180) / 360) * n);
        const latRad = target[1] * Math.PI / 180;
        const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
        await dem.getDemTile(z, x, y, new AbortController());
        preparedElevation = 3650 * 2;
        map.triggerRepaint();
      };
      window.OutmapLocationCamera.fly(map, target, {
        zoom: 12.8, pitch: 50, duration: 180,
        prepareTerrain,
        resolveTerrainElevation: () => preparedElevation
      });
      await sleep(3600);
      const center = map.getCenter();
      const terrainElevation = map.queryTerrainElevation(center);
      window.__coldTerrainResult = JSON.stringify({
        center: [center.lng, center.lat],
        zoom: map.getZoom(), pitch: map.getPitch(),
        centerElevation: map.getCenterElevation(),
        preparedElevation,
        terrainElevation,
        cameraAltitude: map._camera?.transform?.getCameraAltitude?.(),
        terrainAttached: Boolean(map.getTerrain()),
        sourceLoaded: map.isSourceLoaded('terrain-dem')
      });
      } catch (error) {
        window.__coldTerrainResult = JSON.stringify({ error: String(error), stack: String(error?.stack || '') });
      }
    })(); true;`);
    await new Promise(resolve => setTimeout(resolve, 4000));
    const resultText = await win.webContents.executeJavaScript('window.__coldTerrainResult || ""');
    const result = JSON.parse(resultText);

    if (result.error) throw new Error(result.stack || result.error);
    console.log(JSON.stringify(result, null, 2));

    assert(result.terrainAttached, 'terrain must remain attached');
    assert(Number.isFinite(result.preparedElevation) && result.preparedElevation > 6000,
      'delayed high terrain must finish after the visual flight');
    assert(Math.abs(result.centerElevation - result.terrainElevation) < 250,
      `camera center elevation stayed stale after cold DEM arrival: ${JSON.stringify(result)}`);
    assert(result.cameraAltitude > result.preparedElevation,
      `camera remained inside delayed terrain: ${JSON.stringify(result)}`);
  } finally {
    clearTimeout(watchdog);
    win.destroy();
    server.close();
    app.quit();
  }
}).catch(error => {
  clearTimeout(watchdog);
  console.error(error);
  app.exit(1);
});

const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { VectorTile } = require('@mapbox/vector-tile');
const { PbfReader } = require('pbf');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

assert(/type="module" src="map-bootstrap\.js\?v=1\.9\.51"/.test(html),
  'production page must boot MapLibre 6 through the module bootstrap');
assert(!html.includes('vendor/maplibre-gl.js'), 'production page still loads the retired MapLibre 5 UMD bundle');
assert(/setWorkerUrl\(new URL\('\.\/vendor\/maplibre-gl-worker\.mjs'/.test(bootstrap),
  'file:// module worker URL must be configured explicitly');
assert(!/\.setPixelRatio\s*\(/.test(appSource), 'desktop rendering must retain native display pixel ratio');
assert(/lineMetrics:\s*true/.test(appSource), 'route source must enable native line-progress animation');

function firstFile(dir, extension) {
  if (!fs.existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(filePath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension) && fs.statSync(filePath).size > 0) return filePath;
    }
  }
  return null;
}

const offlineRoot = path.join(root, 'dist', 'offline-tiles');
const vectorPath = firstFile(path.join(offlineRoot, 'vector'), '.pbf');
const demPath = firstFile(path.join(offlineRoot, 'dem'), '.webp');
assert(vectorPath, 'no existing offline OSM PBF was available for compatibility testing');
assert(demPath, 'no existing offline Terrarium DEM was available for compatibility testing');

const vectorBuffer = fs.readFileSync(vectorPath);
const demBuffer = fs.readFileSync(demPath);
const parsedVector = new VectorTile(new PbfReader(vectorBuffer));
const vectorLayerNames = Object.keys(parsedVector.layers);
assert(vectorLayerNames.includes('transportation'), 'existing OSM PBF is not a compatible Outmap vector tile');

const watchdog = setTimeout(() => {
  console.error('MapLibre 6 offline compatibility test timed out');
  app.exit(1);
}, 45000);

app.whenReady().then(async () => {
  let win;
  const fixtureServer = http.createServer((req, res) => {
    if (req.url.startsWith('/vector/')) {
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/vnd.mapbox-vector-tile', 'Content-Length': vectorBuffer.length });
      res.end(vectorBuffer);
      return;
    }
    if (req.url.startsWith('/dem/')) {
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/webp', 'Content-Length': demBuffer.length });
      res.end(demBuffer);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    await new Promise(resolve => fixtureServer.listen(0, '127.0.0.1', resolve));
    const port = fixtureServer.address().port;
    win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'scripts', 'fixtures', 'maplibre-6-harness.html'));
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.maplibreHarnessReady) { clearInterval(timer); resolve(); }
        else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error('MapLibre harness timeout')); }
      }, 20);
    })`);
    for (const file of ['src/map-native-icons.js', 'src/terrain-contours.js']) {
      await win.webContents.executeJavaScript(fs.readFileSync(path.join(root, file), 'utf8'));
    }

    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

      let generated = 0;
      let cacheGets = 0;
      let cachePuts = 0;
      let storedCache = null;
      const nativeFetch = window.fetch;
      window.fetch = async (_url, options = {}) => {
        if (options.method === 'PUT') {
          cachePuts++;
          storedCache = options.body instanceof ArrayBuffer ? options.body.slice(0) : await new Response(options.body).arrayBuffer();
          return new Response(null, { status: 204 });
        }
        cacheGets++;
        return storedCache
          ? new Response(storedCache.slice(0), { status: 200 })
          : new Response(null, { status: 404 });
      };
      const cacheDem = {
        contourProtocol: async () => {
          generated++;
          return { data: new Uint8Array([26, 0]).buffer };
        }
      };
      OutmapTerrainContours.installPersistentCache(cacheDem, { port: 28795, webMode: false });
      await cacheDem.contourProtocol({ url: 'contour-test://10/770/422' }, new AbortController());
      await sleep(40);
      await cacheDem.contourProtocol({ url: 'contour-test://10/770/422' }, new AbortController());
      window.fetch = nativeFetch;

      document.body.style.margin = '0';
      document.body.innerHTML = '<div id="map" style="width:100vw;height:100vh"></div>';
      let contextLost = false;
      const errors = [];
      const map = new maplibregl.Map({
        container: 'map', center: [104.5, 31], zoom: 10.2, pitch: 70,
        cancelPendingTileRequestsWhileZooming: false,
        attributionControl: false,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f2f1ec' } }] }
      });
      map.on('error', event => errors.push(String(event?.error?.message || event?.error || event)));
      map.getCanvas().addEventListener('webglcontextlost', () => { contextLost = true; });
      await new Promise(resolve => map.once('load', resolve));
      OutmapNativeIcons.register(map);
      map.addSource('legacy-vector', { type: 'vector', tiles: ['http://127.0.0.1:${port}/vector/{z}/{x}/{y}.pbf'], maxzoom: 14 });
      map.addLayer({ id: 'legacy-roads', type: 'line', source: 'legacy-vector', 'source-layer': 'transportation', paint: { 'line-color': '#475569' } });
      map.addSource('legacy-dem', { type: 'raster-dem', tiles: ['http://127.0.0.1:${port}/dem/{z}/{x}/{y}.webp'], tileSize: 256, maxzoom: 12, encoding: 'terrarium' });
      map.setTerrain({ source: 'legacy-dem', exaggeration: 1.5 });
      map.addLayer({ id: 'legacy-hillshade', type: 'hillshade', source: 'legacy-dem' });
      map.addSource('icon-test', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [104.5, 31] }, properties: {} } });
      map.addLayer({ id: 'icon-test-layer', type: 'symbol', source: 'icon-test', layout: { 'icon-image': 'outmap-road-shield', 'icon-size': 1 } });
      await Promise.race([new Promise(resolve => map.once('idle', resolve)), sleep(8000)]);
      await sleep(100);
      const output = {
        version: maplibregl.getVersion(),
        workerUrl: maplibregl.getWorkerUrl(),
        vectorLoaded: map.isSourceLoaded('legacy-vector'),
        demLoaded: map.isSourceLoaded('legacy-dem'),
        tilesLoaded: map.areTilesLoaded(),
        terrainAttached: !!map.getTerrain(),
        iconCount: ['outmap-poi-default', 'outmap-poi-scenic', 'outmap-mountain', 'outmap-road-shield'].filter(id => map.hasImage(id)).length,
        contextLost,
        errors,
        generated,
        cacheGets,
        cachePuts
      };
      map.remove();
      return output;
    })()`);

    console.log('MapLibre 6 legacy offline compatibility result:', {
      ...result,
      vectorSample: path.relative(root, vectorPath),
      demSample: path.relative(root, demPath),
      vectorLayerNames
    });
    assert.strictEqual(result.version, '6.9.0');
    assert(/maplibre-gl-worker\.mjs(?:$|[?#])/.test(result.workerUrl));
    assert(result.vectorLoaded && result.demLoaded && result.tilesLoaded && result.terrainAttached,
      'MapLibre 6 did not settle with existing OSM/DEM files');
    assert.strictEqual(result.iconCount, 4, 'native 2x icon registration failed');
    assert.strictEqual(result.contextLost, false, 'legacy offline data caused WebGL context loss');
    assert.strictEqual(result.errors.length, 0, `MapLibre errors: ${result.errors.join(' | ')}`);
    assert.strictEqual(result.generated, 1, 'contour cache did not avoid the second generation');
    assert.strictEqual(result.cachePuts, 1, 'new contour tile was not persisted once');
    assert.strictEqual(result.cacheGets, 2, 'contour cache lookup count mismatch');

    clearTimeout(watchdog);
    win.destroy();
    fixtureServer.close();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    fixtureServer.close();
    app.exit(1);
  }
});

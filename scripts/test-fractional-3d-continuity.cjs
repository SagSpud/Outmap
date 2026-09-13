const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new vm.Script(appSource, { filename: 'src/app.js' });

assert(/cancelPendingTileRequestsWhileZooming:\s*false/.test(appSource),
  'fractional zooms must retain pending parent/child tiles');
assert(!/cancelPendingTileRequestsWhileZooming:\s*true/.test(appSource),
  'the discontinuous zoom cancellation policy must not return');

const watchdog = setTimeout(() => {
  console.error('Fractional 3D continuity test timed out');
  app.exit(1);
}, 45000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });
  try {
    await win.loadURL('about:blank');
    for (const file of ['src/vendor/maplibre-gl.js', 'src/vendor/maplibre-contour.js']) {
      await win.webContents.executeJavaScript(fs.readFileSync(path.join(root, file), 'utf8'));
    }
    const result = await win.webContents.executeJavaScript(`(async () => {
      document.body.style.margin = '0';
      document.body.innerHTML = '<div id="map" style="width:100vw;height:100vh"></div>';
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(256, 256);
      // Deterministic, high-relief Terrarium fixture: enough variation to make
      // terrain mesh, hillshade and contour workers all participate.
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const elevation = 2600 + 1300 * Math.sin(x / 13) * Math.cos(y / 17);
          const encoded = elevation + 32768;
          const i = (y * 256 + x) * 4;
          image.data[i] = Math.floor(encoded / 256);
          image.data[i + 1] = Math.floor(encoded % 256);
          image.data[i + 2] = Math.round((encoded - Math.floor(encoded)) * 256);
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      const png = await new Promise(resolve => canvas.toBlob(async blob => resolve(await blob.arrayBuffer()), 'image/png'));
      let contextLost = false;
      let protocolAborts = 0;
      maplibregl.addProtocol('relief-fixture', async (_request, controller) => {
        controller?.signal?.addEventListener('abort', () => { protocolAborts++; }, { once: true });
        await sleep(90);
        return { data: png.slice(0) };
      });
      const dem = new mlcontour.DemSource({
        url: 'relief-fixture://dem/{z}/{x}/{y}.png', encoding: 'terrarium',
        maxzoom: 12, worker: true, cacheSize: 64, timeoutMs: 5000
      });
      dem.setupMaplibre(maplibregl);
      const map = new maplibregl.Map({
        container: 'map', center: [101.3451, 30.06], zoom: 11.55,
        pitch: 50, maxPitch: 85, fadeDuration: 180,
        cancelPendingTileRequestsWhileZooming: false,
        attributionControl: false,
        style: { version: 8, sources: {}, layers: [{
          id: 'background', type: 'background', paint: { 'background-color': '#f2f1ec' }
        }] }
      });
      map.getCanvas().addEventListener('webglcontextlost', () => { contextLost = true; });
      await new Promise(resolve => map.once('load', resolve));
      map.addSource('terrain-dem', {
        type: 'raster-dem', tiles: [dem.sharedDemProtocolUrl],
        encoding: 'terrarium', tileSize: 256, maxzoom: 12
      });
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
      map.addLayer({ id: 'hillshade-layer', type: 'hillshade', source: 'terrain-dem' });
      map.addSource('contour-source', {
        type: 'vector', maxzoom: 15,
        tiles: [dem.contourProtocolUrl({ multiplier: 1,
          thresholds: { 10: [200, 1000], 11: [100, 500], 12: [100, 500], 13: [50, 250] },
          elevationKey: 'ele', levelKey: 'level' })]
      });
      map.addLayer({ id: 'contour-lines', type: 'line', source: 'contour-source',
        'source-layer': 'contours', paint: { 'line-color': '#8fa66f' } });

      const zooms = [11.55, 11.8, 12.05, 11.75, 11.58, 11.92];
      for (const pitch of [50, 70]) {
        map.jumpTo({ pitch });
        for (const zoom of zooms) {
          map.easeTo({ zoom, duration: 140 });
          await sleep(55);
          if (!map.getSource('terrain-dem') || !map.getSource('contour-source')) throw new Error('3D source disappeared');
          if (!map.getLayer('hillshade-layer') || !map.getLayer('contour-lines')) throw new Error('3D layer disappeared');
          if (!map.getTerrain()) throw new Error('terrain detached during fractional zoom');
          await sleep(110);
        }
      }
      await Promise.race([new Promise(resolve => map.once('idle', resolve)), sleep(8000)]);
      const result = {
        cancellationEnabled: map.cancelPendingTileRequestsWhileZooming,
        terrainLoaded: map.isSourceLoaded('terrain-dem'),
        contourLoaded: map.isSourceLoaded('contour-source'),
        tilesLoaded: map.areTilesLoaded(),
        contextLost,
        protocolAborts
      };
      map.remove();
      return result;
    })()`);

    console.log('Fractional 3D tile continuity result:', result);
    assert.strictEqual(result.cancellationEnabled, false, 'runtime tile cancellation policy mismatch');
    assert.strictEqual(result.contextLost, false, 'fractional 3D zoom must not lose WebGL context');
    assert(result.terrainLoaded && result.contourLoaded && result.tilesLoaded,
      'terrain, contours and tiles must settle after repeated 50/70-degree zoom hand-offs');
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(1);
  }
});

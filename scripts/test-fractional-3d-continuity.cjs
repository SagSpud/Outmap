const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { PNG } = require('pngjs');

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
}, 90000);

app.whenReady().then(async () => {
  const fixturePng = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const elevation = 2600 + 1300 * Math.sin(x / 13) * Math.cos(y / 17);
      const encoded = elevation + 32768;
      const i = (y * 256 + x) * 4;
      fixturePng.data[i] = Math.floor(encoded / 256);
      fixturePng.data[i + 1] = Math.floor(encoded % 256);
      fixturePng.data[i + 2] = Math.round((encoded - Math.floor(encoded)) * 256);
      fixturePng.data[i + 3] = 255;
    }
  }
  const fixtureBuffer = PNG.sync.write(fixturePng);
  let fixtureRequests = 0;
  const fixtureServer = http.createServer((_req, res) => {
    fixtureRequests++;
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/png', 'Content-Length': fixtureBuffer.length, 'Cache-Control': 'public,max-age=3600' });
    res.end(fixtureBuffer);
  });
  await new Promise(resolve => fixtureServer.listen(0, '127.0.0.1', resolve));
  const fixturePort = fixtureServer.address().port;
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
        else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error('MapLibre 6 harness timeout')); }
      }, 20);
    })`);
    await win.webContents.executeJavaScript(`window.reliefFixtureUrl = 'http://127.0.0.1:${fixturePort}/{z}/{x}/{y}.png'`);
    for (const file of ['src/vendor/maplibre-contour.js', 'src/location-camera.js']) {
      await win.webContents.executeJavaScript(fs.readFileSync(path.join(root, file), 'utf8'));
    }
    const result = await win.webContents.executeJavaScript(`(async () => {
      document.body.style.margin = '0';
      document.body.innerHTML = '<div id="map" style="width:100vw;height:100vh"></div>';
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      let contextLost = false;
      const fixtureUrl = window.reliefFixtureUrl;
      maplibregl.setWorkerCount(4);
      const dem = new mlcontour.DemSource({
        url: fixtureUrl, encoding: 'terrarium',
        maxzoom: 12, worker: true, cacheSize: 64, timeoutMs: 5000
      });
      let contourProtocolCalls = 0;
      const contourProtocol = dem.contourProtocol;
      dem.contourProtocol = (...args) => { contourProtocolCalls++; return contourProtocol(...args); };
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
      OutmapLocationCamera.install(map);
      const errors = [];
      map.on('error', event => errors.push(String(event?.error?.stack || event?.error || event)));
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
          thresholds: {
            4: [1000, 2500], 6: [1000, 2500], 8: [500, 2000],
            10: [200, 1000], 11: [100, 500], 12: [100, 500],
            13: [50, 250], 14: [20, 100], 15: [10, 50]
          },
          elevationKey: 'ele', levelKey: 'level' })]
      });
      map.addLayer({ id: 'contour-lines', type: 'line', source: 'contour-source',
        'source-layer': 'contours', paint: { 'line-color': '#8fa66f' } });

      // Exercise the whole production range, with extra samples around the
      // DEM L11/L12 and vector/contour overzoom hand-offs that previously
      // exposed flashing in steep terrain.
      const ascending = [3.9, 4.45, 5.5, 6.15, 7.4, 8.25, 9.6, 10.4, 11.55, 11.8, 12.05, 12.65, 13.4, 14.2, 15.1, 16.0, 16.8];
      const zooms = [...ascending, ...ascending.slice().reverse()];
      const fractionalMatrix = [];
      for (const pitch of [50, 70]) {
        map.jumpTo({ pitch });
        for (const zoom of zooms) {
          const beforeZoom = map.getZoom();
          const motionZooms = [beforeZoom];
          const recordMotionZoom = () => motionZooms.push(map.getZoom());
          map.on('zoom', recordMotionZoom);
          map.easeTo({ zoom, duration: 140 });
          await sleep(55);
          if (!map.getSource('terrain-dem') || !map.getSource('contour-source')) throw new Error('3D source disappeared');
          if (!map.getLayer('hillshade-layer') || !map.getLayer('contour-lines')) throw new Error('3D layer disappeared');
          if (!map.getTerrain()) throw new Error('terrain detached during fractional zoom');
          await sleep(110);
          map.off('zoom', recordMotionZoom);
          const actualZoom = map.getZoom();
          const zoomingIn = zoom > beforeZoom + 0.01;
          const zoomingOut = zoom < beforeZoom - 0.01;
          const rollback = zoomingIn
            ? Math.max(...motionZooms, actualZoom) - actualZoom
            : zoomingOut ? actualZoom - Math.min(...motionZooms, actualZoom) : 0;
          fractionalMatrix.push({ pitch, requestedZoom: zoom, beforeZoom, actualZoom, rollback });
        }
      }

      const wheelMatrix = [];
      const wheelOnce = async (pitch, startZoom, deltaY, yRatio = 0.68) => {
        map.stop();
        map.jumpTo({ center: [101.3451, 30.06], pitch, zoom: startZoom });
        await sleep(90);
        const actualStartZoom = map.getZoom();
        const samples = [actualStartZoom];
        const onZoom = () => samples.push(map.getZoom());
        map.on('zoom', onZoom);
        let centerAtZoomEnd = null;
        let zoomAtZoomEnd = null;
        const ended = new Promise(resolve => map.once('zoomend', () => {
          const center = map.getCenter();
          centerAtZoomEnd = [center.lng, center.lat];
          zoomAtZoomEnd = map.getZoom();
          resolve();
        }));
        const canvas = map.getCanvas();
        const dispatchWheel = () => canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, deltaMode: 0, deltaY,
          clientX: canvas.clientWidth * 0.5, clientY: canvas.clientHeight * yRatio
        }));
        dispatchWheel();
        await Promise.race([ended, sleep(1500)]);
        // Electron can drop the very first synthetic wheel immediately after a
        // busy GPU harness starts. Retry only when no native zoom lifecycle was
        // observed; real movement is never duplicated.
        if (!centerAtZoomEnd) {
          dispatchWheel();
          await Promise.race([ended, sleep(1500)]);
        }
        await sleep(35);
        map.off('zoom', onZoom);
        const endZoom = map.getZoom();
        const endCenter = map.getCenter();
        const centerDrift = centerAtZoomEnd
          ? Math.hypot(endCenter.lng - centerAtZoomEnd[0], endCenter.lat - centerAtZoomEnd[1])
          : Infinity;
        const postEndZoomDrift = Number.isFinite(zoomAtZoomEnd)
          ? Math.abs(endZoom - zoomAtZoomEnd)
          : Infinity;
        const peak = Math.max(...samples, endZoom);
        const trough = Math.min(...samples, endZoom);
        const directionOk = deltaY < 0 ? endZoom >= actualStartZoom - 0.005 : endZoom <= actualStartZoom + 0.005;
        const rollback = deltaY < 0 ? peak - endZoom : endZoom - trough;
        if (!directionOk || rollback > 0.04) {
          throw new Error('wheel zoom unstable at ' + pitch + '° / L' + startZoom
            + ': end=' + endZoom + ', rollback=' + rollback + ', deltaY=' + deltaY);
        }
        if (centerDrift > 1e-8 || postEndZoomDrift > 0.002) {
          throw new Error('wheel zoom moved after zoomend at ' + pitch + '° / L' + startZoom
            + ': centerDrift=' + centerDrift + ', zoomDrift=' + postEndZoomDrift);
        }
        wheelMatrix.push({ pitch, startZoom, actualStartZoom, deltaY, yRatio,
          endZoom, rollback, centerDrift, postEndZoomDrift, frames: samples.length });
      };
      const wheelLevels = [3.9, 4.45, 5.5, 6.15, 7.4, 8.25, 9.6, 10.4, 11.55, 11.8, 12.05, 12.65, 13.4, 14.2, 15.1, 16.0, 16.8];
      for (const pitch of [0, 50, 70]) {
        for (const startZoom of wheelLevels) {
          await wheelOnce(pitch, startZoom, -120);
          await wheelOnce(pitch, startZoom, 120);
        }
      }
      // Above-horizon and foreground terrain use different native around-point
      // paths. Exercise both at the DEM hand-off and close-range levels.
      for (const pitch of [50, 70]) {
        for (const startZoom of [11.8, 14.2, 16.0]) {
          await wheelOnce(pitch, startZoom, -120, 0.15);
          await wheelOnce(pitch, startZoom, -120, 0.85);
        }
      }
      await Promise.race([new Promise(resolve => map.once('idle', resolve)), sleep(5000)]);
      const result = {
        version: maplibregl.getVersion(),
        workerUrl: maplibregl.getWorkerUrl(),
        cancellationEnabled: map.cancelPendingTileRequestsWhileZooming,
        terrainLoaded: map.isSourceLoaded('terrain-dem'),
        contourLoaded: map.isSourceLoaded('contour-source'),
        tilesLoaded: map.areTilesLoaded(),
        contextLost,
        errors,
        contourProtocolCalls,
        wheelMatrix,
        fractionalMatrix
      };
      map.remove();
      return result;
    })()`);

    console.log('Fractional 3D tile continuity result:', {
      ...result,
      wheelMatrix: {
        cases: result.wheelMatrix.length,
        maxRollback: Math.max(...result.wheelMatrix.map(item => item.rollback)),
        pitches: [...new Set(result.wheelMatrix.map(item => item.pitch))],
        minZoom: Math.min(...result.wheelMatrix.map(item => item.startZoom)),
        maxZoom: Math.max(...result.wheelMatrix.map(item => item.startZoom))
      },
      fractionalMatrix: {
        cases: result.fractionalMatrix.length,
        maxNativeTerrainCorrection: Math.max(...result.fractionalMatrix.map(item => item.rollback))
      }
    });
    assert.strictEqual(result.version, '6.9.0', 'MapLibre runtime version mismatch');
    assert(/maplibre-gl-worker\.mjs(?:$|[?#])/.test(result.workerUrl), 'MapLibre 6 module worker URL is not configured');
    assert.strictEqual(result.cancellationEnabled, false, 'runtime tile cancellation policy mismatch');
    assert.strictEqual(result.contextLost, false, 'fractional 3D zoom must not lose WebGL context');
    assert(result.contourProtocolCalls > 0 && fixtureRequests > 0,
      'contour worker must request Terrarium DEM data');
    assert(!result.errors.some(error => /worker|webgl|terrain|contour/i.test(error)),
      `MapLibre 6 emitted a terrain/worker error: ${result.errors.join(' | ')}`);
    assert(result.terrainLoaded && result.contourLoaded && result.tilesLoaded,
      'terrain, contours and tiles must settle after repeated 50/70-degree zoom hand-offs');
    clearTimeout(watchdog);
    win.destroy();
    fixtureServer.close();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(watchdog);
    win.destroy();
    fixtureServer.close();
    app.exit(1);
  }
});

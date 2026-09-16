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
}, 180000);

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
        scrollZoom: { around: 'center' },
        cancelPendingTileRequestsWhileZooming: false,
        attributionControl: false,
        style: { version: 8, sources: {}, layers: [{
          id: 'background', type: 'background', paint: { 'background-color': '#f2f1ec' }
        }] }
      });
      map.scrollZoom.setWheelZoomRate(1 / 600);
      map.scrollZoom.setZoomRate(1 / 120);
      window.OutmapLocationCamera.install(map);
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

      // Do not weaken this matrix when changing flight behavior: user zoom is
      // native and must remain settled after zoomend at every supported level,
      // pitch and both foreground/sky cursor anchors.
      const wheelMatrix = [];
      const wheelOnce = async (pitch, startZoom, deltaY, yRatio = 0.68, xRatio = 0.5) => {
        map.stop();
        map.jumpTo({ center: [101.3451, 30.06], pitch, zoom: startZoom });
        await Promise.race([new Promise(resolve => map.once('idle', resolve)), sleep(350)]);
        await sleep(40);
        const actualStartZoom = map.getZoom();
        const zoomSamples = [actualStartZoom];
        const recordZoom = () => zoomSamples.push(map.getZoom());
        map.on('zoom', recordZoom);
        let centerAtMoveEnd = null;
        let zoomAtMoveEnd = null;
        const ended = new Promise(resolve => map.once('moveend', () => {
          const center = map.getCenter();
          centerAtMoveEnd = [center.lng, center.lat];
          zoomAtMoveEnd = map.getZoom();
          resolve();
        }));
        const canvas = map.getCanvas();
        const dispatchWheel = () => canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaMode: 0,
          deltaY,
          clientX: canvas.clientWidth * xRatio,
          clientY: canvas.clientHeight * yRatio
        }));
        dispatchWheel();
        await Promise.race([ended, sleep(1500)]);
        if (!centerAtMoveEnd) {
          dispatchWheel();
          await Promise.race([ended, sleep(1500)]);
        }
        await sleep(80);
        map.off('zoom', recordZoom);
        const endZoom = map.getZoom();
        const endCenter = map.getCenter();
        const centerDrift = centerAtMoveEnd
          ? Math.hypot(endCenter.lng - centerAtMoveEnd[0], endCenter.lat - centerAtMoveEnd[1])
          : Infinity;
        const postEndZoomDrift = Number.isFinite(zoomAtMoveEnd)
          ? Math.abs(endZoom - zoomAtMoveEnd)
          : Infinity;
        const directionOk = deltaY < 0
          ? endZoom >= actualStartZoom - 0.005
          : endZoom <= actualStartZoom + 0.005;
        const maxFrameDelta = zoomSamples.reduce((maximum, value, index) => index
          ? Math.max(maximum, Math.abs(value - zoomSamples[index - 1]))
          : maximum, 0);
        if (!directionOk) {
          throw new Error('wheel direction reversed at ' + pitch + '° / L' + startZoom + ': ' + actualStartZoom + ' -> ' + endZoom);
        }
        if (Math.abs(endZoom - actualStartZoom) > 0.65) {
          throw new Error('one wheel step changed too much at ' + pitch + '° / L' + startZoom + ': ' + actualStartZoom + ' -> ' + endZoom);
        }
        if (maxFrameDelta > 0.12) {
          throw new Error('terrain collision caused a visible zoom jump at ' + pitch + '° / L' + startZoom + ': frameDelta=' + maxFrameDelta);
        }
        if (centerDrift > 1e-8 || postEndZoomDrift > 0.002) {
          throw new Error('wheel moved after moveend at ' + pitch + '° / L' + startZoom + ': center=' + centerDrift + ', zoom=' + postEndZoomDrift);
        }
        wheelMatrix.push({ pitch, startZoom, deltaY, yRatio, endZoom,
          xRatio, maxFrameDelta, centerDrift, postEndZoomDrift });
        return { endZoom, center: [endCenter.lng, endCenter.lat] };
      };
      const wheelLevels = [3.9, 4.45, 5.5, 6.15, 7.4, 8.25, 9.6, 10.4, 11.55, 11.8, 12.05, 12.65, 13.4, 14.2, 15.1, 16.0, 16.8];
      for (const pitch of [0, 50, 70]) {
        for (const startZoom of wheelLevels) {
          await wheelOnce(pitch, startZoom, -120);
          await wheelOnce(pitch, startZoom, 120);
        }
      }
      for (const pitch of [50, 70]) {
        for (const startZoom of [11.8, 14.2, 16.0]) {
          await wheelOnce(pitch, startZoom, -120, 0.15);
          await wheelOnce(pitch, startZoom, -120, 0.85);
        }
      }
      for (const pitch of [50, 70]) {
        const left = await wheelOnce(pitch, 11.8, -120, 0.68, 0.12);
        const right = await wheelOnce(pitch, 11.8, -120, 0.68, 0.88);
        const pointerCenterDifference = Math.hypot(
          left.center[0] - right.center[0], left.center[1] - right.center[1]
        );
        if (pointerCenterDifference > 1e-8 || Math.abs(left.endZoom - right.endZoom) > 0.002) {
          throw new Error('wheel result still depends on pointer position at ' + pitch + '°');
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
        wheelMatrix
      };
      map.remove();
      return result;
    })()`);

    console.log('Fractional 3D tile continuity result:', result);
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
    assert.strictEqual(result.wheelMatrix.length, 118,
      'all 2D/50°/70° wheel levels and foreground/sky anchors must be exercised');
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

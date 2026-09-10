const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

assert(!mainSource.includes("appendSwitch('ignore-gpu-blocklist')"), 'GPU compatibility blocklist must remain active');
assert(!mainSource.includes("appendSwitch('disable-features', 'Win32kLockdown')"), 'desktop must not weaken Chromium sandboxing');
assert(!mainSource.includes("appendSwitch('js-flags'"), 'desktop must use adaptive V8 memory limits');
assert(mainSource.includes('mapInteractionActive && workerIndex >= interactiveConcurrency'),
  'downloads must yield CPU/disk lanes while the map is moving');
assert(mainSource.includes('!finalInventoryRefreshed &&'), 'download completion must not start a duplicate full inventory scan');
assert(!/startFpsSampling\(\);\s*document\.addEventListener\(['"]visibilitychange/.test(appSource),
  'FPS sampling must not run permanently while the map is idle');
assert(!appSource.includes("map.once('idle', () => {\n      try {\n        if (typeof map.triggerRepaint"),
  'initialization must not force an extra idle repaint');

const watchdog = setTimeout(() => app.exit(1), 45000);
for (const [channel, value] of [
  ['get-tile-server-info', { port: 28795, totalTiles: 0, totalBytes: 0 }],
  ['get-offline-manifest', { inventoryVersion: 3, stats: {}, provinces: {} }],
  ['get-cloud-sync-config', { autoSync: false }],
  ['save-cloud-sync-config', { success: true }],
  ['rescan-offline-tiles', { totalTiles: 0, totalBytes: 0 }],
  ['pull-cloud-sync-data', { success: true, data: null }],
  ['upload-cloud-sync-data', { success: true }],
  ['save-offline-manifest', { success: true }],
  ['search-location', { type: 'FeatureCollection', features: [] }]
]) ipcMain.handle(channel, () => value);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(root, 'src', 'index.html'));
  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    while (!window.mapInstance) await sleep(25);
    const map = window.mapInstance;
    await Promise.race([new Promise(r => map.once('idle', r)), sleep(9000)]);

    const originalFetch = window.fetch;
    window.fetch = async input => String(input).includes('/route/v1/')
      ? new Response(JSON.stringify({ code: 'Ok', routes: [{
          geometry: { type: 'LineString', coordinates: [[106.55, 29.56], [106.55, 29.56]] },
          distance: 0, duration: 0
        }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : originalFetch(input);

    const c = [106.5516, 29.5630];
    window.setRouteStartPoint(map, c, '重叠起点', 14.8, { schedule: false });
    window.setRouteEndPoint(map, c, '重叠终点', 14.8, false, { schedule: false });
    window.addViaPoint(map, c, '重叠途径点一');
    window.addViaPoint(map, c, '重叠途径点二');
    window.syncRouteMarkersVisualState(map);
    await sleep(150);

    const readRouteData = () => map.getSource('outmap-route-points')?._data || null;
    const minimumPixelGap = data => {
      const points = (data?.features || []).map(f => map.project(f.geometry.coordinates));
      let min = Infinity;
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        min = Math.min(min, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
      }
      return min;
    };
    const initialData = readRouteData();
    const initialGap = minimumPixelGap(initialData);
    const topologyState = window.getRouteState();
    const routeStateCoordinatesPreserved = [
      topologyState.routeStartCoord,
      ...topologyState.routeViaPoints.map(p => p.coords),
      topologyState.routeEndCoord
    ].every(coords => coords[0] === c[0] && coords[1] === c[1]);
    const actualCoordinatesPreserved = (initialData?.features || []).every(f =>
      Math.abs(f.geometry.coordinates[0] - c[0]) > 0.000001 || Math.abs(f.geometry.coordinates[1] - c[1]) > 0.000001);

    const moved = new Promise(r => map.once('moveend', r));
    map.easeTo({ pitch: 70, duration: 120 });
    await Promise.race([moved, sleep(1200)]);
    await sleep(80);
    const pitch70Gap = minimumPixelGap(readRouteData());

    for (let i = 0; i < 48; i++) window.addViaPoint(map, c, '密集途径点 ' + (i + 3));
    window.syncRouteMarkersVisualState(map);
    await sleep(120);
    const manyPointData = readRouteData();
    const manyPointGap = minimumPixelGap(manyPointData);

    let idleRenders = 0;
    const countRender = () => idleRenders++;
    map.on('render', countRender);
    await sleep(1600);
    map.off('render', countRender);

    const routePanel = document.getElementById('route-panel');
    const modalCard = document.querySelector('#pyramid-modal .modal-card');
    const layerPanel = document.getElementById('layers-popover');
    const blurOf = el => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || '';
    return {
      featureCount: initialData?.features?.length || 0,
      roles: (initialData?.features || []).map(f => f.properties.role),
      overlapSizes: (initialData?.features || []).map(f => f.properties.overlapGroupSize),
      initialGap,
      pitch70Gap,
      manyPointCount: manyPointData?.features?.length || 0,
      manyPointGap,
      actualCoordinatesPreserved,
      routeStateCoordinatesPreserved,
      idleRenders,
      fpsText: document.getElementById('status-fps')?.innerText,
      routeBlur: blurOf(routePanel),
      modalBlur: blurOf(modalCard),
      layerBlur: blurOf(layerPanel),
      persistentDomMarkers: document.querySelectorAll('.route-start-marker-pin,.route-via-marker-pin,.route-end-marker-pin').length
    };
  })()`);

  console.log('Production polish result:', result);
  assert.strictEqual(result.featureCount, 4, 'all route stops must remain independently editable');
  assert.deepStrictEqual(result.roles, ['start', 'via', 'via', 'end'], 'route topology must remain unchanged');
  assert(result.overlapSizes.every(n => n === 4), 'all overlapping route points must be grouped');
  assert(result.initialGap >= 28, `overlapping markers need a readable gap; got ${result.initialGap}px`);
  assert(result.pitch70Gap >= 28, `70-degree 3D markers need a readable gap; got ${result.pitch70Gap}px`);
  assert.strictEqual(result.manyPointCount, 52, 'dense route stress test must preserve fifty waypoints plus endpoints');
  assert(result.manyPointGap >= 25, `dense multi-ring markers need a readable gap; got ${result.manyPointGap}px`);
  assert(result.actualCoordinatesPreserved, 'display coordinates must separate without deleting route stops');
  assert(result.routeStateCoordinatesPreserved, 'visual spreading must never mutate route planning coordinates');
  assert(result.idleRenders <= 3, `idle map rendered ${result.idleRenders} frames in 1.6s`);
  assert.strictEqual(result.fpsText, '— FPS', 'idle FPS status must not keep a timer alive');
  assert(result.routeBlur.includes('20px') && result.modalBlur.includes('20px') && result.layerBlur.includes('20px'),
    'desktop panels must share one 20px acrylic recipe');
  assert.strictEqual(result.persistentDomMarkers, 0, 'native route layers must remain DOM-free outside active dragging');
  clearTimeout(watchdog);
  console.log('Route overlap, 3D, idle GPU, download and visual consistency checks passed.');
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});

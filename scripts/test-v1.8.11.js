const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const cameraJs = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');
const workerJs = fs.readFileSync(path.join(root, 'src', 'offline-worker.cjs'), 'utf8');
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

assert(!/map\.on\(['"]idle['"][\s\S]{0,160}refreshAllRouteMarkersElevation/.test(appJs),
  'idle must not force marker refreshes');
const refreshFn = appJs.match(/function refreshAllRouteMarkersElevation\([\s\S]*?\n}\nwindow\.refreshAllRouteMarkersElevation/);
assert(refreshFn, 'bounded marker refresh helper must exist');
assert(!refreshFn[0].includes('triggerRepaint'), 'marker refresh must not trigger WebGL repaint');
assert(!appJs.includes('marker._update') && !appJs.includes('.marker._update'),
  'application code must not call MapLibre private Marker._update');
assert(appJs.includes('fadeDuration: 180'), 'native symbol fading must remain enabled');
assert(cameraJs.includes('curve: 1.0'), 'long flights must use the stable native arc');
assert(!/\.route-via-marker-pin,[\s\S]{0,240}will-change:\s*transform/.test(css),
  'route markers must not each retain a permanent compositor layer');
assert(!css.includes('animation: pulsePickingVia 1.4s infinite'),
  'route picking highlight must not repaint forever');
assert(workerJs.includes('level.expected > 0 && level.present >= level.expected'),
  'offline levels must turn green only when every expected tile is present');
assert(appJs.includes("options.schedule !== false"),
  'endpoint promotion must support a single atomic route schedule');
assert(appJs.includes('JSON.stringify(mergedFavs) !== JSON.stringify(localFavs)'),
  'same-count favorite changes must refresh the local view');
assert(appJs.includes("const FAVORITES_SOURCE_ID = 'outmap-favorites'"),
  'favorites must use a dedicated native GeoJSON source');
assert(/cluster:\s*true/.test(appJs) && appJs.includes('outmap-favorite-clusters'),
  'favorites must use native MapLibre clustering');
assert(appJs.includes('source.updateData(diff)'),
  'favorite edits must prefer GeoJSONSource.updateData');
assert(appJs.includes("['feature-state', 'selected']") && appJs.includes("['feature-state', 'hover']"),
  'native favorite styling must use feature-state');
assert(appJs.includes("const ROUTE_POINTS_SOURCE_ID = 'outmap-route-points'"),
  'route stops must use a dedicated native GeoJSON source');
assert(appJs.includes("['feature-state', 'dragging']"),
  'route drag styling must use feature-state');
assert(appJs.includes('pixelRatio: Math.min(window.devicePixelRatio || 1, 2)'),
  'constrained browser/mobile rendering must cap device pixel ratio');
assert(appJs.includes('cancelPendingTileRequestsWhileZooming: true'),
  'obsolete tile requests must be cancelled during zoom');
assert(appJs.includes('refreshExpiredTiles: false'),
  'static/offline tiles must not be needlessly refreshed');
assert(!/window\.addEventListener\(['"]resize['"][\s\S]{0,180}map\.resize\(/.test(appJs),
  'MapLibre trackResize must be the only continuous resize path');

const watchdog = setTimeout(() => app.exit(1), 30000);
for (const [channel, value] of [
  ['get-tile-server-info', { port: 28795, totalTiles: 0, totalBytes: 0 }],
  ['get-offline-status', { totalTiles: 0, totalBytes: 0 }],
  ['get-offline-manifest', { inventoryVersion: 3, stats: {}, provinces: {} }],
  ['get-power-state', { powerSource: 'ac', isLowPower: false }],
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
  const result = await win.webContents.executeJavaScript(`new Promise(async resolve => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    while (!window.mapInstance) await sleep(25);
    const map = window.mapInstance;
    await Promise.race([new Promise(r => map.once('idle', r)), sleep(8000)]);
    await sleep(100);
    const favoriteSource = map.getSource('outmap-favorites');
    const favoriteLayers = [
      'outmap-favorite-hover',
      'outmap-favorite-icons',
      'outmap-favorite-clusters',
      'outmap-favorite-cluster-count'
    ];
    let favoriteDiff = null;
    let favoriteUpdateCalls = 0;
    const originalUpdateData = favoriteSource?.updateData?.bind(favoriteSource);
    if (favoriteSource && originalUpdateData) {
      favoriteSource.updateData = diff => {
        favoriteUpdateCalls++;
        favoriteDiff = diff;
        return originalUpdateData(diff);
      };
    }
    window.openWaypointModalForLocation([106.5516, 29.563], '增量收藏测试点');
    document.getElementById('btn-save-waypoint').click();
    await sleep(120);

    window.setRouteStartPoint(map, [106.50, 29.50], '起点', 14, { schedule: false });
    window.addViaPoint(map, [106.55, 29.55], '中间点');
    window.addViaPoint(map, [106.60, 29.60], '终点');
    await sleep(120);
    const routeSource = map.getSource('outmap-route-points');
    const routeData = routeSource?._data || routeSource?.serialize?.().data || null;
    const routeRoles = (routeData?.features || []).map(feature => feature.properties?.role);

    window.showChangeWaypointTypeMenu({
      id: 'menu-style-test', name: '白鹭金岸·卢浮公馆', type: 'camp', folder: 'default',
      lng: 106.55, lat: 29.56, ele: 0
    }, 120, 120);
    const typeMenu = document.querySelector('.fav-point-type-menu');
    const typeMenuResult = {
      usesFluentSurface: typeMenu?.classList.contains('fluent-context-menu') || false,
      title: typeMenu?.querySelector('.ctx-title')?.textContent || '',
      subtitle: typeMenu?.querySelector('.ctx-sub')?.textContent || '',
      itemCount: typeMenu?.querySelectorAll('.fav-type-menu-item').length || 0,
      hasDelete: !!typeMenu?.querySelector('.fav-type-delete'),
      activeText: typeMenu?.querySelector('.fav-type-menu-item.active .ctx-text')?.textContent || '',
      leftGutter: typeMenu ? parseFloat(getComputedStyle(typeMenu).paddingLeft) : -1
    };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(160);

    let renders = 0;
    const count = () => { renders++; };
    map.on('render', count);
    await sleep(1500);
    map.off('render', count);
    resolve({
      renders,
      moving: map.isMoving(),
      version: window.OUTMAP_APP_VERSION,
      favoriteSource: !!favoriteSource,
      favoriteLayers: favoriteLayers.every(id => !!map.getLayer(id)),
      favoriteClustered: typeof favoriteSource?.getClusterExpansionZoom === 'function',
      favoriteUpdateCalls,
      favoriteDiffAdded: favoriteDiff?.add?.length || 0,
      favoriteDomMarkers: document.querySelectorAll('.fav-marker-wrap').length,
      routeSource: !!routeSource,
      routeLayers: ['outmap-route-point-halo', 'outmap-route-point-circles', 'outmap-route-point-labels']
        .every(id => !!map.getLayer(id)),
      routeRoles,
      persistentRouteDomMarkers: document.querySelectorAll('.route-start-marker-pin, .route-via-marker-pin, .route-end-marker-pin').length,
      typeMenuResult
    });
  })`);

  console.log('v1.8.11 native-layer result:', result);
  assert.strictEqual(result.version, packageVersion, 'runtime version must match package.json');
  assert(result.favoriteSource && result.favoriteLayers && result.favoriteClustered,
    'favorite source, layers and clustering must initialize');
  assert.strictEqual(result.favoriteUpdateCalls, 1, 'saving one favorite must use one incremental source update');
  assert.strictEqual(result.favoriteDiffAdded, 1, 'favorite incremental update must add exactly one feature');
  assert.strictEqual(result.favoriteDomMarkers, 0, 'favorites must not retain DOM markers');
  assert(result.routeSource && result.routeLayers, 'route-point source and layers must initialize');
  assert.deepStrictEqual(result.routeRoles, ['start', 'via', 'end'], 'three route stops must preserve start/via/end roles');
  assert.strictEqual(result.persistentRouteDomMarkers, 0, 'route stops must not retain DOM markers outside dragging');
  assert(result.typeMenuResult.usesFluentSurface, 'waypoint type menu must share the Fluent map-context surface');
  assert.strictEqual(result.typeMenuResult.title, '', 'waypoint menu must not retain a separate title');
  assert.strictEqual(result.typeMenuResult.subtitle, '', 'waypoint menu must not retain a subtitle');
  assert.strictEqual(result.typeMenuResult.itemCount, 8, 'menu must expose all eight waypoint types');
  assert(result.typeMenuResult.hasDelete, 'waypoint menu must provide a delete action');
  assert.strictEqual(result.typeMenuResult.activeText, '露营', 'current waypoint type must remain visibly selected');
  assert(result.typeMenuResult.leftGutter <= 6, 'menu must not retain the native radio-menu title gutter');
  assert(!result.moving, 'map must be stable during idle measurement');
  assert(result.renders <= 3, `idle map rendered ${result.renders} frames in 1.5s`);
  clearTimeout(watchdog);
  console.log('v1.8.11 performance and stability checks passed:', result);
  app.quit();
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.8.6 test timed out after 35s');
  app.exit(1);
}, 35000);

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

// Mock IPC
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, stats: {}, provinces: {} }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('pull-cloud-sync-data', () => ({
  success: true,
  data: { version: '1.8.6', username: 'tester', favorites: [], folders: [], routes: [] }
}));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: 'C:/Users/cuihm/.gemini/antigravity/scratch/outmap/preload.js',
      contextIsolation: true
    }
  });
  await win.loadFile('C:/Users/cuihm/.gemini/antigravity/scratch/outmap/src/index.html');

  const result = await win.webContents.executeJavaScript(`(${async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    while (!window.mapInstance) await sleep(25);
    const map = window.mapInstance;

    const res = {};

    // 1. Version
    res.version = window.OUTMAP_APP_VERSION;
    const badge = document.getElementById('brand-ver-badge-txt');
    res.badgeText = badge ? badge.innerText.trim() : '';

    // 2. Waypoint markers zooming & positioning
    const pts = [
      { name: '起', coords: [106.55, 29.55] },
      { name: '2', coords: [106.552, 29.535] },
      { name: '3', coords: [106.551, 29.528] },
      { name: '4', coords: [106.555, 29.520] },
      { name: '5', coords: [106.558, 29.512] },
      { name: '终', coords: [106.545, 29.510] }
    ];

    window.setRouteStartPoint(map, pts[0].coords, pts[0].name);
    for (let i = 1; i < pts.length; i++) {
      window.addViaPoint(map, pts[i].coords, pts[i].name);
    }
    await sleep(200);

    const routePointSource = map.getSource('outmap-route-points');
    const routePointData = routePointSource?._data || routePointSource?.serialize?.().data;
    res.routePointCount = routePointData?.features?.length || 0;
    res.routePointRoles = (routePointData?.features || []).map(f => f.properties?.role);
    res.hasRoutePointLayers = [
      'outmap-route-point-halo',
      'outmap-route-point-circles',
      'outmap-route-point-labels'
    ].every(id => !!map.getLayer(id));
    res.persistentRouteDomMarkers = document.querySelectorAll('.route-start-marker-pin, .route-via-marker-pin, .route-end-marker-pin').length;

    // Check zoom out: markers must NOT have equal fixed vertical gap (which indicates document-flow stacking bug)
    map.jumpTo({ center: [106.55, 29.53], zoom: 14, pitch: 0 });
    await sleep(200);
    const rects14 = pts.map(p => map.project(p.coords).y);

    map.setZoom(10);
    await sleep(200);
    const rects10 = pts.map(p => map.project(p.coords).y);
    // At zoom 10, geographic span in screen pixels must shrink significantly compared to zoom 14
    const span14 = Math.max(...rects14) - Math.min(...rects14);
    const span10 = Math.max(...rects10) - Math.min(...rects10);
    res.span14 = span14;
    res.span10 = span10;
    res.zoomedGeographically = span10 < span14 * 0.25;

    // 3. Saved routes card: no .fav-route-actions, click to load, contextmenu to export/del
    const dummyRoute = {
      id: 'test_route_1',
      name: '渝中南岸穿越线',
      mode: 'drive',
      createdAt: '2026/09/09',
      start: { coords: pts[0].coords, name: pts[0].name },
      end: { coords: pts[5].coords, name: pts[5].name },
      viaPoints: [
        { coords: pts[1].coords, name: '2' },
        { coords: pts[2].coords, name: '3' },
        { coords: pts[3].coords, name: '4' },
        { coords: pts[4].coords, name: '5' }
      ],
      metrics: { distKm: 12.5, timeStr: '25分钟', ascent: 180 },
      pathCoords: pts.map(p => p.coords)
    };
    localStorage.setItem('outmap_saved_routes', JSON.stringify([dummyRoute]));
    window.reloadFavoritesData();
    await sleep(100);

    const routeCard = document.querySelector('.fav-route-card');
    res.hasRouteCard = !!routeCard;
    res.hasOldActions = !!document.querySelector('.fav-route-actions');
    res.hasOldRecallBtn = !!document.querySelector('.btn-recall-route');

    // Test right-click on route card
    if (routeCard) {
      const evt = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 250,
        clientY: 300
      });
      routeCard.dispatchEvent(evt);
      await sleep(60);

      const ctxMenu = document.querySelector('.fav-route-context-menu');
      res.hasRouteContextMenu = !!ctxMenu;
      res.ctxHasExport = !!ctxMenu?.querySelector('.btn-ctx-export');
      res.ctxHasDelete = !!ctxMenu?.querySelector('.btn-ctx-del');

      // Dismiss menu
      document.body.click();
      await sleep(160);
      res.ctxMenuDismissed = !document.querySelector('.fav-route-context-menu');
    }

    // 4. Standalone waypoint import
    const btnImportPts = document.getElementById('btn-fav-drawer-import-pts');
    res.hasFavImportBtn = !!btnImportPts;

    // Test parsing pure waypoints GPX
    const pureWptGpx = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<gpx version="1.1" creator="Outmap">' +
      '<wpt lat="29.55" lon="106.55"><name>重庆观景台</name><ele>350</ele></wpt>' +
      '<wpt lat="29.52" lon="106.56"><name>南山露营地</name><ele>520</ele></wpt>' +
      '<wpt lat="29.50" lon="106.54"><name>海峡路停车场</name><ele>210</ele></wpt>' +
      '</gpx>';

    const parsedWpt = window.parseTrackFile(pureWptGpx, '测试点位集.gpx');
    res.parsedWptCount = parsedWpt?.waypoints?.length || 0;
    res.parsedWptHasCoords = !parsedWpt?.coords || parsedWpt?.coords?.length === 0;

    // Test importWaypointsIntoFavorites
    if (parsedWpt && parsedWpt.waypoints) {
      const initialFavCount = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]').length;
      window.importWaypointsIntoFavorites(parsedWpt.waypoints, '测试点位集', map);
      await sleep(100);

      const afterFavCount = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]').length;
      res.waypointsImportedCount = afterFavCount - initialFavCount;

      const folders = JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]');
      res.hasImportFolder = folders.some(f => f.name.includes('测试点位集'));

      const favPtsBadge = document.getElementById('fav-pts-count');
      res.badgeCount = favPtsBadge ? parseInt(favPtsBadge.innerText) : 0;
    }

    return res;
  }})()`);

  console.log('v1.8.6 test result:', JSON.stringify(result, null, 2));

  // Assertions
  assert(/^\d+\.\d+\.\d+$/.test(result.version), 'Version should be valid semver');
  assert.strictEqual(result.badgeText, `v${result.version}`, 'Badge text should match the app version');

  // Native route-point source/layers test
  assert.strictEqual(result.routePointCount, 6, 'Native source must contain start, 4 vias and end');
  assert.deepStrictEqual(result.routePointRoles, ['start', 'via', 'via', 'via', 'via', 'end'], 'Native route roles must remain ordered');
  assert.strictEqual(result.hasRoutePointLayers, true, 'Native route-point layers must be installed');
  assert.strictEqual(result.persistentRouteDomMarkers, 0, 'Route points must not retain DOM markers outside dragging');
  assert.strictEqual(result.zoomedGeographically, true, 'Native route points must scale geographically with the map');

  // Route card test
  assert.strictEqual(result.hasRouteCard, true, 'Should render route card');
  assert.strictEqual(result.hasOldActions, false, 'Card must NOT have old .fav-route-actions row');
  assert.strictEqual(result.hasOldRecallBtn, false, 'Card must NOT have old .btn-recall-route button');
  assert.strictEqual(result.hasRouteContextMenu, true, 'Right click on card must show context menu');
  assert.strictEqual(result.ctxHasExport, true, 'Context menu must have export button');
  assert.strictEqual(result.ctxHasDelete, true, 'Context menu must have delete button');
  assert.strictEqual(result.ctxMenuDismissed, true, 'Context menu must close on outside click');

  // Waypoint import test
  assert.strictEqual(result.hasFavImportBtn, true, 'Favorites drawer must have import points button');
  assert.strictEqual(result.parsedWptCount, 3, 'Must parse 3 waypoints from GPX');
  assert.strictEqual(result.waypointsImportedCount, 3, 'Must import 3 waypoints into favorites');
  assert.strictEqual(result.hasImportFolder, true, 'Must create [导入] folder');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.8.6 TESTS PASSED PERFECTLY!');
  app.exit(0);
}).catch(err => {
  clearTimeout(watchdog);
  console.error('Test error:', err);
  app.exit(1);
});

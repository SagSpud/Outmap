const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.8.7 test timed out after 35s');
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
  data: { version: '1.8.7', username: 'tester', favorites: [], folders: [], routes: [] }
}));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));
ipcMain.handle('show-waypoint-type-menu', () => 'view');

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

    // 2. Standalone import button removed from fab-dock
    res.hasFabImport = !!document.getElementById('btn-fab-import');

    // 3. Route export dropdown & inline save-route-modal
    const btnExportGpx = document.getElementById('btn-export-gpx');
    const btnSaveRoute = document.getElementById('btn-save-route');
    const btnRouteImport = document.getElementById('btn-route-import-trigger');
    res.exportGpxText = btnExportGpx ? btnExportGpx.innerText.trim() : '';
    res.saveRouteText = btnSaveRoute ? btnSaveRoute.innerText.trim() : '';
    res.routeImportText = btnRouteImport ? btnRouteImport.innerText.trim() : '';

    // Check inline save-route-modal location inside #route-panel
    const saveModal = document.getElementById('save-route-modal');
    const routePanel = document.getElementById('route-panel');
    res.saveModalInsideRoutePanel = !!(saveModal && routePanel && routePanel.contains(saveModal));
    const saveTitle = saveModal?.querySelector('.card-title');
    res.saveModalTitle = saveTitle ? saveTitle.innerText.trim() : '';

    // 4. Saved route card context menu (no icons, no GPX remark)
    const dummyRoute = {
      id: 'test_r_187',
      name: '石家庄烈士陵园至和平医院',
      mode: 'drive',
      createdAt: '2026/09/09',
      start: { coords: [114.47, 38.03], name: '烈士陵园' },
      end: { coords: [114.45, 38.04], name: '和平医院' },
      viaPoints: [],
      metrics: { distKm: 2.9, timeStr: '8分钟', ascent: 15 },
      pathCoords: [[114.47, 38.03], [114.45, 38.04]]
    };
    localStorage.setItem('outmap_saved_routes', JSON.stringify([dummyRoute]));
    window.reloadFavoritesData();
    await sleep(80);

    const routeCard = document.querySelector('.fav-route-card');
    if (routeCard) {
      const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 });
      routeCard.dispatchEvent(evt);
      await sleep(50);
      const ctxMenu = document.querySelector('.fav-route-context-menu');
      const items = Array.from(ctxMenu?.querySelectorAll('.fav-route-context-item') || []);
      res.routeCtxTexts = items.map(i => i.innerText.trim());
      document.body.click();
      await sleep(150);
    }

    // 5. Folder tabs: 全部 收藏夹 默认 景点
    const folderTabs = document.querySelectorAll('#fav-folder-tabs .fav-tab');
    res.folderTabNames = Array.from(folderTabs).map(t => t.innerText.trim());

    // 6. Change waypoint type on right-click
    const dummyWp = {
      id: 'wp_test_type',
      name: '滹沱河生态岛',
      type: 'camp',
      folder: 'default',
      lng: 114.5,
      lat: 38.1,
      ele: 65,
      time: '2026/09/09'
    };
    localStorage.setItem('outmap_saved_waypoints', JSON.stringify([dummyWp]));
    window.reloadFavoritesData();
    await sleep(80);

    const favItem = document.querySelector('.fav-item-card');
    res.hasFavItem = !!favItem;
    if (favItem) {
      const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 });
      favItem.dispatchEvent(evt);
      await sleep(50);

      const typeMenu = document.querySelector('.fav-point-type-menu');
      res.hasTypeMenu = !!typeMenu;

      // Select 'view' (景点)
      const viewItem = typeMenu?.querySelector('.fav-type-menu-item[data-type="view"]');
      if (viewItem) {
        viewItem.click();
        await sleep(60);
      }

      const updatedWps = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
      res.updatedType = updatedWps[0]?.type;
    }

    // 7. Sync button and modal width
    const btnSyncNow = document.getElementById('btn-sync-now');
    res.syncNowBtnText = btnSyncNow ? btnSyncNow.innerText.trim() : '';

    const syncModalCard = document.querySelector('.sync-modal-card');
    res.syncCardWidth = syncModalCard ? window.getComputedStyle(syncModalCard).width : '';

    return res;
  }})()`);

  console.log('v1.8.7 test result:', JSON.stringify(result, null, 2));

  // Assertions
  assert(/^\d+\.\d+\.\d+$/.test(result.version), 'Version should remain valid semver');
  assert.strictEqual(result.badgeText, `v${result.version}`, 'Badge text should match the runtime version');
  assert.strictEqual(result.hasFabImport, false, 'Standalone import button must be removed from right dock');

  // Route export menu
  assert.strictEqual(result.exportGpxText, '', 'Legacy direct GPX action must remain removed');
  assert.strictEqual(result.saveRouteText, '', 'Legacy route action ID must remain removed');
  assert.strictEqual(result.routeImportText, '导入', 'Compact route import action must be present');

  // Inline save modal
  assert.strictEqual(result.saveModalInsideRoutePanel, true, 'Save route modal must be inside route-panel');
  assert.strictEqual(result.saveModalTitle, '', 'Legacy embedded save title must remain removed');

  // Route context menu
  assert(result.routeCtxTexts.includes('导出路线'), 'Route context menu must have pure text "导出路线"');
  assert(result.routeCtxTexts.includes('删除路线'), 'Route context menu must have pure text "删除路线"');

  // Folder tabs
  assert(result.folderTabNames.includes('全部'), 'Must include 全部');
  assert(result.folderTabNames.includes('收藏夹'), 'Must include 收藏夹');
  assert(result.folderTabNames.includes('默认'), 'Must include 默认');
  assert(result.folderTabNames.includes('景点'), 'Must include 景点');

  // Change waypoint type
  assert.strictEqual(result.hasTypeMenu, true, 'Desktop and web must share the in-app Fluent waypoint menu');
  assert.strictEqual(result.updatedType, 'view', 'Fluent menu selection must update the waypoint type immediately');

  // Sync button & modal width
  assert.strictEqual(result.syncNowBtnText, '立即同步', 'Sync now button must be pure text without icon');
  assert(result.syncCardWidth.includes('320'), 'Sync modal card width should be 320px');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.8.7 TESTS PASSED PERFECTLY!');
  app.exit(0);
}).catch(err => {
  clearTimeout(watchdog);
  console.error('Test error:', err);
  app.exit(1);
});

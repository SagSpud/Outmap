const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.8.5 test timed out after 35s');
  app.exit(1);
}, 35000);

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

// Mock IPC
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({
  inventoryVersion: 3,
  stats: { totalTiles: 50000, totalBytes: 100000000 },
  provinces: {}
}));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
ipcMain.handle('pull-cloud-sync-data', () => ({
  success: true,
  data: { version: '1.8.5', username: 'tester', favorites: [], folders: [], routes: [] }
}));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  const result = await win.webContents.executeJavaScript(`(${async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance) await sleep(25);
    const map = window.mapInstance;

    const res = {};

    // 1. Version and maxZoom
    res.version = window.OUTMAP_APP_VERSION;
    const badge = document.getElementById('brand-ver-badge-txt');
    res.badgeText = badge ? badge.innerText.trim() : '';
    res.maxZoom = map.getMaxZoom();

    // 2. Waypoint modal 8 options & default view
    const pills = document.querySelectorAll('#wp-type-group .type-pill');
    res.pillCount = pills.length;
    res.pillTypes = Array.from(pills).map(p => p.getAttribute('data-type'));
    const activePill = document.querySelector('#wp-type-group .type-pill.active');
    res.defaultActiveType = activePill ? activePill.getAttribute('data-type') : '';

    // 3. Favorites drawer sync button
    const btnSync = document.getElementById('btn-fav-drawer-sync');
    res.syncBtnText = btnSync ? btnSync.innerText.trim() : '';
    res.syncBtnWidth = btnSync ? btnSync.style.width || window.getComputedStyle(btnSync).width : '';
    res.syncBtnHasIcon = !!document.getElementById('fav-sync-icon');

    // Test clicking sync button state transition
    if (typeof window.handleManualCloudSync === 'function') {
      const syncPromise = window.handleManualCloudSync(btnSync);
      await sleep(10);
      res.syncingBtnText = btnSync ? btnSync.innerText.trim() : '';
      await syncPromise;
      res.afterSyncBtnText = btnSync ? btnSync.innerText.trim() : '';
    }

    // 4. Test Route planning & Apple Maps green colors
    window.addViaPoint(map, [116.4, 39.9], '北京');
    await sleep(60);
    window.addViaPoint(map, [121.4, 31.2], '上海');
    await sleep(100);

    const casingLayer = map.getLayer('outdoor-route-casing');
    const lineLayer = map.getLayer('outdoor-route-line');
    res.casingColor = casingLayer ? map.getPaintProperty('outdoor-route-casing', 'line-color') : '';
    res.lineColor = lineLayer ? map.getPaintProperty('outdoor-route-line', 'line-color') : '';

    // Check layer ordering (outdoor-route-line must be below road shields/names)
    const layers = map.getStyle().layers;
    const routeLineIndex = layers.findIndex(l => l.id === 'outdoor-route-line');
    const shieldIndex = layers.findIndex(l => l.id === 'osm-road-shields');
    const nameIndex = layers.findIndex(l => l.id === 'osm-road-names');
    res.routeLineIndex = routeLineIndex;
    res.shieldIndex = shieldIndex;
    res.nameIndex = nameIndex;
    res.routeBelowLabels = (shieldIndex === -1 || routeLineIndex < shieldIndex) &&
                           (nameIndex === -1 || routeLineIndex < nameIndex);

    // 5. Test importing a track and verifying it clears completely when clicking clear
    const dummyGpx = '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"><wpt lat="38.0" lon="114.0"><name>起点站</name></wpt><wpt lat="35.0" lon="118.0"><name>终点站</name></wpt><trk><trkseg><trkpt lat="38.0" lon="114.0"></trkpt><trkpt lat="37.0" lon="116.0"></trkpt><trkpt lat="35.0" lon="118.0"></trkpt></trkseg></trk></gpx>';
    const trackData = window.parseTrackFile(dummyGpx, 'test.gpx');
    window.displayImportedTrack(map, trackData);
    await sleep(80);

    const srcBeforeClear = map.getSource('outdoor-route-source');
    res.hasCoordsBeforeClear = srcBeforeClear && srcBeforeClear._data && srcBeforeClear._data.geometry?.coordinates?.length > 0;

    // Click clear button
    const btnClear = document.getElementById('btn-clear-route');
    if (btnClear) btnClear.click();
    await sleep(80);

    const srcAfterClear = map.getSource('outdoor-route-source');
    const importedSrcAfterClear = map.getSource('imported-track-source');
    res.outdoorCleared = !srcAfterClear || !srcAfterClear._data || !srcAfterClear._data.geometry || srcAfterClear._data.geometry.coordinates?.length === 0;
    res.importedCleared = !importedSrcAfterClear || !importedSrcAfterClear._data || !importedSrcAfterClear._data.geometry || importedSrcAfterClear._data.geometry.coordinates?.length === 0;

    // 6. Context menu close and animation classes
    const ctxMenu = document.getElementById('map-context-menu');
    res.hasCtxMenu = !!ctxMenu;
    if (typeof window.showContextMenuForLocation === 'function') {
      window.showContextMenuForLocation({ lng: 116.4, lat: 39.9 }, { x: 200, y: 200 }, '测试点');
      await sleep(50);
      res.ctxVisibleAfterOpen = ctxMenu && ctxMenu.style.display !== 'none';
      if (typeof window.closeConflictingBottomPanels === 'function') {
        window.closeConflictingBottomPanels();
      }
      await sleep(200);
      res.ctxClosedAfterConflict = ctxMenu && ctxMenu.style.display === 'none';
    }

    return res;
  }})()`);

  console.log('v1.8.5 test result:', JSON.stringify(result, null, 2));

  // Assertions
  assert(result.version.startsWith('1.8.'), 'App version should be 1.8.x');
  assert(result.badgeText.startsWith('v1.8.'), 'Badge text should be v1.8.x');
  assert.strictEqual(result.maxZoom, 17, 'maxZoom must be locked to 17');

  // Waypoint modal pills: 8 options, default view
  assert.strictEqual(result.pillCount, 8, 'Waypoint modal should have 8 type options');
  assert.strictEqual(result.defaultActiveType, 'view', 'Default waypoint option must be 观景 (view)');
  assert(result.pillTypes.includes('parking'), 'Must include parking');
  assert(result.pillTypes.includes('hotel'), 'Must include hotel');
  assert(result.pillTypes.includes('photo'), 'Must include photo');
  assert(result.pillTypes.includes('hiking'), 'Must include hiking');

  // Sync button: no icons, fixed width, text transitions
  assert.strictEqual(result.syncBtnText, '同步', 'Sync button text should be 同步');
  assert.strictEqual(result.syncBtnHasIcon, false, 'Sync button should have no icon element');
  assert(result.syncBtnWidth.includes('58'), 'Sync button should have fixed 58px width');
  assert.strictEqual(result.syncingBtnText, '同步中', 'Syncing text should be 同步中');
  assert.strictEqual(result.afterSyncBtnText, '同步', 'Reverted text should be 同步');

  // Route colors: Apple Maps solid green
  assert.strictEqual(result.casingColor, '#0f7135', 'Casing must be solid dark green (#0f7135)');
  assert.strictEqual(result.lineColor, '#32d15f', 'Line ribbon must be Apple Maps emerald green (#32d15f)');
  assert.strictEqual(result.routeBelowLabels, true, 'Route line must be placed below road labels and shields');

  // Clear button completely removes track
  assert.strictEqual(result.outdoorCleared, true, 'Outdoor route must be cleared on clear button click');
  assert.strictEqual(result.importedCleared, true, 'Imported track must be cleared on clear button click');

  // Context menu closes on conflict
  assert.strictEqual(result.ctxClosedAfterConflict, true, 'Context menu must smoothly close when conflict occurs');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.8.5 TESTS PASSED PERFECTLY!');
  app.exit(0);
}).catch(err => {
  clearTimeout(watchdog);
  console.error('Test error:', err);
  app.exit(1);
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');
const watchdog = setTimeout(() => {
  console.error('Watchdog timeout in test-v178.js');
  app.exit(1);
}, 30000);

let mockUploads = [];
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, stats: {}, provinces: {} }));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
ipcMain.handle('pull-cloud-sync-data', () => ({ success: true, data: null }));
ipcMain.handle('upload-cloud-sync-data', (event, payload) => {
  mockUploads.push(payload);
  return { success: true };
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(rootDir, 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(rootDir, 'src', 'index.html'));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    while (!window.mapInstance) await sleep(50);
    const map = window.mapInstance;

    // 1. Test mergeWaypoints deduplication and tombstone filtering
    const testLocal = [
      { id: 'wp_local_1', name: '黄山玉屏峰', lng: 118.175, lat: 30.132, ele: 1680 },
      { id: 'wp_local_2', name: '泰山南天门', lng: 117.105, lat: 36.205, ele: 1460 }
    ];
    // Cloud has same place with different device ID
    const testCloud = [
      { id: 'wp_cloud_dup', name: '黄山玉屏峰', lng: 118.175001, lat: 30.132001, ele: 1680 },
      { id: 'wp_cloud_new', name: '华山苍龙岭', lng: 110.085, lat: 34.485, ele: 1600 },
      { id: 'wp_cloud_del', name: '已被删除的点', lng: 115.000, lat: 35.000, ele: 100 }
    ];
    const testDeleted = [
      { id: 'wp_cloud_del', name: '已被删除的点', lng: '115.00000', lat: '35.00000' }
    ];

    const merged = window.mergeWaypoints ? window.mergeWaypoints(testLocal, testCloud, testDeleted) : [];

    // 2. Test promotion of missing endpoints
    // Clear route inputs
    document.getElementById('btn-route-clear')?.click();

    // Add first via point -> should become START
    if (typeof window.addViaPoint === 'function') {
      window.addViaPoint(map, [116.397, 39.908], '北京天安门');
    }
    await sleep(220);
    const s1 = window.getRouteState();
    const afterFirstAdd = {
      startCoord: s1.routeStartCoord,
      startName: s1.routeStartName,
      endCoord: s1.routeEndCoord,
      viaCount: s1.routeViaPoints.length,
      startInputVal: document.getElementById('route-start-input')?.value || '',
      endInputVal: document.getElementById('route-end-input')?.value || ''
    };

    // Add second via point -> should become END
    window.addViaPoint(map, [121.473, 31.230], '上海人民广场');
    await sleep(220);
    const s2 = window.getRouteState();
    const afterSecondAdd = {
      startCoord: s2.routeStartCoord,
      startName: s2.routeStartName,
      endCoord: s2.routeEndCoord,
      endName: s2.routeEndName,
      viaCount: s2.routeViaPoints.length,
      startInputVal: document.getElementById('route-start-input')?.value || '',
      endInputVal: document.getElementById('route-end-input')?.value || ''
    };

    // Add third via point -> should remain VIA 1
    window.addViaPoint(map, [118.796, 32.058], '南京玄武湖');
    await sleep(220);
    const s3 = window.getRouteState();
    const afterThirdAdd = {
      startCoord: s3.routeStartCoord,
      endCoord: s3.routeEndCoord,
      viaCount: s3.routeViaPoints.length,
      via1Name: s3.routeViaPoints[0]?.name || '',
      startInputVal: document.getElementById('route-start-input')?.value || '',
      endInputVal: document.getElementById('route-end-input')?.value || ''
    };

    // Check unified upload function existence
    const hasUploadPayload = typeof window.uploadCloudSyncPayload === 'function';

    return {
      mergedCount: merged.length,
      mergedNames: merged.map(m => m.name),
      hasDeletedInMerged: merged.some(m => m.name === '已被删除的点'),
      hasDupInMerged: merged.filter(m => m.name === '黄山玉屏峰').length,
      afterFirstAdd,
      afterSecondAdd,
      afterThirdAdd,
      hasUploadPayload,
      appVersion: window.OUTMAP_APP_VERSION
    };
  })()`);

  console.log('Test v1.7.8 result:', JSON.stringify(result, null, 2));

  // Assertions
  assert(result.appVersion >= '1.7.8', 'Version must be at least 1.7.8');
  assert.strictEqual(result.hasUploadPayload, true, 'uploadCloudSyncPayload must exist');

  // Merging assertions:
  assert.strictEqual(result.hasDeletedInMerged, false, 'Deleted waypoint must be excluded by tombstone');
  assert.strictEqual(result.hasDupInMerged, 1, 'Duplicate same-location waypoint must be merged into 1');
  assert.strictEqual(result.mergedCount, 3, 'Merged count must be exactly 3');

  // Promotion assertions:
  // After 1st via add:
  assert(result.afterFirstAdd.startCoord, '1st via must be promoted to routeStartCoord');
  assert.strictEqual(result.afterFirstAdd.startName, '北京天安门', 'Start name must be 北京天安门');
  assert.strictEqual(result.afterFirstAdd.startInputVal, '北京天安门', 'Start input box must show 北京天安门');
  assert.strictEqual(result.afterFirstAdd.endCoord, null, 'End coord must still be null after 1st via');
  assert.strictEqual(result.afterFirstAdd.viaCount, 0, 'Via points count must be 0 after promotion to start');

  // After 2nd via add:
  assert(result.afterSecondAdd.endCoord, '2nd via must be promoted to routeEndCoord');
  assert.strictEqual(result.afterSecondAdd.endName, '上海人民广场', 'End name must be 上海人民广场');
  assert.strictEqual(result.afterSecondAdd.endInputVal, '上海人民广场', 'End input box must show 上海人民广场');
  assert.strictEqual(result.afterSecondAdd.viaCount, 0, 'Via points count must be 0 after promotion to end');

  // After 3rd via add:
  assert.strictEqual(result.afterThirdAdd.viaCount, 1, '3rd via must remain as true via point');
  assert.strictEqual(result.afterThirdAdd.via1Name, '南京玄武湖', 'Via 1 name must be 南京玄武湖');

  console.log('✅ ALL v1.7.8 VERIFICATIONS PASSED SUCCESSFULLY!');
  clearTimeout(watchdog);
  app.quit();
});

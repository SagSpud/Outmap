const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.8.2 test timed out after 35s');
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

let mockCloudFavorites = [
  { id: 'wp_desktop_1', name: '桌面地标1', lng: 116.4, lat: 39.9, type: 'camp', folder: 'default' },
  { id: 'wp_web_incoming', name: '网页新增露营地', lng: 120.1, lat: 30.2, type: 'camp', folder: 'default' }
];

ipcMain.handle('pull-cloud-sync-data', () => ({
  success: true,
  data: {
    version: '1.8.2',
    username: 'tester',
    favorites: mockCloudFavorites,
    folders: [],
    routes: []
  }
}));

ipcMain.handle('upload-cloud-sync-data', (e, payload) => {
  if (payload && payload.data && payload.data.favorites) {
    mockCloudFavorites = payload.data.favorites;
  }
  return { success: true };
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  const result = await win.webContents.executeJavaScript('(' + (async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance) await sleep(25);
    const map = window.mapInstance;

    const out = {};

    // 1. Check version and badges
    out.appVersion = window.OUTMAP_APP_VERSION;
    const badge = document.getElementById('brand-ver-badge-txt');
    out.badgeText = badge ? badge.innerText.trim() : '';

    // 2. Test Amap / Apple Maps forward progression route planning logic
    // Clear route first
    const btnClear = document.getElementById('btn-clear-route');
    if (btnClear) btnClear.click();
    await sleep(60);

    // Step 1: Add Point 1 (成都)
    window.addViaPoint(map, [104.066, 30.572], '成都市');
    await sleep(60);
    const s1 = window.getRouteState();
    out.step1 = {
      startName: s1.routeStartName,
      endName: s1.routeEndName,
      viaCount: s1.routeViaPoints.length,
      startInput: document.getElementById('route-start-input')?.value || '',
      endInput: document.getElementById('route-end-input')?.value || ''
    };

    // Step 2: Add Point 2 (都江堰)
    window.addViaPoint(map, [103.621, 31.002], '都江堰');
    await sleep(60);
    const s2 = window.getRouteState();
    out.step2 = {
      startName: s2.routeStartName,
      endName: s2.routeEndName,
      viaCount: s2.routeViaPoints.length,
      startInput: document.getElementById('route-start-input')?.value || '',
      endInput: document.getElementById('route-end-input')?.value || ''
    };

    // Step 3: Add Point 3 (卧龙巴朗山) -> 都江堰 shifts to Via 1, 卧龙 becomes End
    window.addViaPoint(map, [103.125, 31.026], '卧龙巴朗山');
    await sleep(60);
    const s3 = window.getRouteState();
    out.step3 = {
      startName: s3.routeStartName,
      endName: s3.routeEndName,
      viaCount: s3.routeViaPoints.length,
      via1Name: s3.routeViaPoints[0]?.name || '',
      startInput: document.getElementById('route-start-input')?.value || '',
      endInput: document.getElementById('route-end-input')?.value || ''
    };

    // Step 4: Add Point 4 (四姑娘山) -> 卧龙 shifts to Via 2, 四姑娘山 becomes End
    window.addViaPoint(map, [102.836, 30.998], '四姑娘山');
    await sleep(60);
    const s4 = window.getRouteState();
    out.step4 = {
      startName: s4.routeStartName,
      endName: s4.routeEndName,
      viaCount: s4.routeViaPoints.length,
      via1Name: s4.routeViaPoints[0]?.name || '',
      via2Name: s4.routeViaPoints[1]?.name || '',
      endInput: document.getElementById('route-end-input')?.value || ''
    };

    // Step 5: Add Point 5 (丹巴美人谷) -> 四姑娘山 shifts to Via 3, 丹巴 becomes End
    window.addViaPoint(map, [101.889, 30.877], '丹巴美人谷');
    await sleep(60);
    const s5 = window.getRouteState();
    out.step5 = {
      startName: s5.routeStartName,
      endName: s5.routeEndName,
      viaCount: s5.routeViaPoints.length,
      via1Name: s5.routeViaPoints[0]?.name || '',
      via2Name: s5.routeViaPoints[1]?.name || '',
      via3Name: s5.routeViaPoints[2]?.name || '',
      endInput: document.getElementById('route-end-input')?.value || ''
    };

    // Step 6: Explicitly set endpoint to 稻城亚丁 -> 丹巴美人谷 shifts to Via 4, 稻城 becomes End
    window.setRouteEndPoint(map, [100.298, 29.043], '稻城亚丁');
    await sleep(60);
    const s6 = window.getRouteState();
    out.step6 = {
      startName: s6.routeStartName,
      endName: s6.routeEndName,
      viaCount: s6.routeViaPoints.length,
      via4Name: s6.routeViaPoints[3]?.name || '',
      endInput: document.getElementById('route-end-input')?.value || ''
    };

    // 3. Test Cloud Sync UI and Bidirectional Merging
    const btnSyncNow = document.getElementById('btn-sync-now');
    out.hasBtnSyncNow = !!btnSyncNow;
    out.hasOnWindowFocus = typeof window.electronAPI?.onWindowFocus === 'function';
    out.hasExecuteFullSync = typeof window.executeFullSync === 'function';

    // Seed local storage with desktop waypoint
    localStorage.setItem('outmap_saved_waypoints', JSON.stringify([
      { id: 'wp_desktop_1', name: '桌面地标1', lng: 116.4, lat: 39.9, type: 'camp', folder: 'default' }
    ]));

    // Execute full sync (silent mode)
    await window.executeFullSync({ username: 'tester', syncKey: 'user_tester' }, false);
    await sleep(100);

    const mergedLocal = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
    out.mergedCount = mergedLocal.length;
    out.mergedNames = mergedLocal.map(w => w.name);
    out.hasWebWaypoint = mergedLocal.some(w => w.name === '网页新增露营地');

    return out;
  }).toString() + ')()');

  console.log('Test v1.8.2 results:', JSON.stringify(result, null, 2));

  // Assertions:
  assert.ok(/^\d+\.\d+\.\d+$/.test(result.appVersion), 'App version should be valid semver');
  assert.strictEqual(result.badgeText, `v${result.appVersion}`, 'Badge text should match the app version');

  // Step 1:
  assert.strictEqual(result.step1.startName, '成都市');
  assert.strictEqual(result.step1.endName, '');
  assert.strictEqual(result.step1.viaCount, 0);

  // Step 2:
  assert.strictEqual(result.step2.startName, '成都市');
  assert.strictEqual(result.step2.endName, '都江堰');
  assert.strictEqual(result.step2.viaCount, 0);

  // Step 3:
  assert.strictEqual(result.step3.startName, '成都市');
  assert.strictEqual(result.step3.via1Name, '都江堰', '都江堰 must shift to via 1');
  assert.strictEqual(result.step3.endName, '卧龙巴朗山', '卧龙巴朗山 must become end');
  assert.strictEqual(result.step3.viaCount, 1);

  // Step 4:
  assert.strictEqual(result.step4.via1Name, '都江堰');
  assert.strictEqual(result.step4.via2Name, '卧龙巴朗山', '卧龙巴朗山 must shift to via 2');
  assert.strictEqual(result.step4.endName, '四姑娘山', '四姑娘山 must become end');
  assert.strictEqual(result.step4.viaCount, 2);

  // Step 5:
  assert.strictEqual(result.step5.via1Name, '都江堰');
  assert.strictEqual(result.step5.via2Name, '卧龙巴朗山');
  assert.strictEqual(result.step5.via3Name, '四姑娘山', '四姑娘山 must shift to via 3');
  assert.strictEqual(result.step5.endName, '丹巴美人谷', '丹巴美人谷 must become end');
  assert.strictEqual(result.step5.viaCount, 3);

  // Step 6:
  assert.strictEqual(result.step6.via4Name, '丹巴美人谷', '丹巴美人谷 must shift to via 4');
  assert.strictEqual(result.step6.endName, '稻城亚丁', '稻城亚丁 must become explicit end');
  assert.strictEqual(result.step6.viaCount, 4);

  // Cloud sync assertions:
  assert.strictEqual(result.hasBtnSyncNow, true, 'btn-sync-now button must exist');
  assert.strictEqual(result.hasExecuteFullSync, true, 'executeFullSync must exist');
  assert.strictEqual(result.hasWebWaypoint, true, 'Web waypoint must be merged into desktop storage');
  assert.strictEqual(result.mergedCount, 2, 'Merged waypoints count must be 2');

  console.log('✅ ALL v1.8.2 TESTS PASSED SUCCESSFULLY!');
  clearTimeout(watchdog);
  app.quit();
}).catch(err => {
  console.error('Test error:', err);
  clearTimeout(watchdog);
  app.exit(1);
});

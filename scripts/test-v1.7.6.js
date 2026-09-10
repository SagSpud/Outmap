const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const handlerStart = mainSource.indexOf("ipcMain.handle('start-pyramid-download'");
const handlerTry = mainSource.indexOf('try {', handlerStart);
assert(handlerStart >= 0 && mainSource.indexOf('let newlySavedCount = 0;', handlerStart) < handlerTry,
  'Download completion counters must remain visible to the handler finally block');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');
const watchdog = setTimeout(() => app.exit(1), 30000);
let cloudPulls = 0;

ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({
  inventoryVersion: 4,
  stats: {},
  provinces: {
    shandong: {
      maxZ: 0,
      partialZ: 14,
      layers: {
        dem: { levels: { 14: { expected: 10, present: 0, complete: false } } },
        vector: { levels: { 14: { expected: 10, present: 4, complete: false } } }
      }
    }
  }
}));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
ipcMain.handle('pull-cloud-sync-data', () => {
  cloudPulls++;
  return { success: true, data: null };
});
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 760,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await win.webContents.executeJavaScript(`
    localStorage.setItem('outmap_saved_waypoints', JSON.stringify([{
      id: 'first-flight', name: '高程收藏点', type: 'view', folder: 'default',
      lng: 91.117, lat: 29.65, ele: 300, time: 'test'
    }]));
    localStorage.setItem('outmap_offline_provinces', JSON.stringify({ shandong: { maxZ: 14, vec: true, dem: true } }));
    localStorage.setItem('outmap_user_account', JSON.stringify({
      username: 'production-test', password: 'test', syncKey: 'user_production-test', loggedIn: true
    }));
    location.reload();
  `);
  await new Promise(resolve => setTimeout(resolve, 2100));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance || !window.OutmapLocationCamera) await sleep(25);
    const calls = [];
    const originalFly = window.OutmapLocationCamera.fly;
    window.OutmapLocationCamera.fly = (map, coords, options) => calls.push({ coords, options });
    document.getElementById('btn-fab-fav').click();
    await sleep(30);
    document.querySelector('#fav-items-list .fav-item-info').click();
    await sleep(30);
    document.getElementById('btn-open-pyramid-dl').click();
    await sleep(80);
    document.querySelector('.zoom-pill[data-value="14"]')?.click();
    await sleep(30);
    const shandong = document.querySelector('.prov-chip-item[data-key="shandong"]');
    const cursor = getComputedStyle(document.documentElement);
    const answer = {
      flightCount: calls.length,
      elevation: calls[0]?.options?.elevation,
      centered: calls[0]?.options?.centered,
      shandongClass: shandong?.className || '',
      shandongBadge: shandong?.querySelector('.prov-chip-badge')?.innerText || '',
      grab: cursor.getPropertyValue('--cursor-grab').trim(),
      grabbing: cursor.getPropertyValue('--cursor-grabbing').trim()
    };
    window.OutmapLocationCamera.fly = originalFly;
    return answer;
  })()`);

  console.log('v1.7.6 production regression:', result, { cloudPulls });
  assert.strictEqual(result.flightCount, 1, 'One favorite click must start exactly one flight');
  assert.strictEqual(result.centered, false, 'Favorite must land at the lower-center anchor');
  assert(result.elevation >= 300, 'First flight must use the saved terrain elevation');
  assert(!result.shandongClass.includes('ready-full'), 'Stale local state must not override the disk inventory');
  assert(result.shandongClass.includes('ready-partial'), 'A partial vector or DEM layer must use the blue partial state');
  assert.strictEqual(result.shandongBadge, 'L14', 'A partial L14 inventory should keep its level label without turning green');
  assert.strictEqual(result.grab, 'grab', 'Map must use the operating system grab cursor');
  assert.strictEqual(result.grabbing, 'grabbing', 'Map must use the operating system grabbing cursor');
  assert.strictEqual(cloudPulls, 1, 'Startup cloud sync must run once after map initialization');
  clearTimeout(watchdog);
  console.log('Favorite first-flight, offline authority, native cursor and startup sync passed.');
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});

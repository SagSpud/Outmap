const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.8.0 test timed out after 30s');
  app.exit(1);
}, 30000);

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
ipcMain.handle('pull-cloud-sync-data', () => ({ success: true, data: null }));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 760,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance) await sleep(25);

    const out = {};

    // 1. Verify brand version badge is v1.8.0
    const badge = document.getElementById('brand-ver-badge-txt');
    out.badgeText = badge ? badge.innerText.trim() : null;

    // 2. Verify search landing marker display and close on right click
    if (typeof window.showLandingMarker === 'function') {
      window.showLandingMarker([116.4074, 39.9042], '万象城', '测试商场');
      await sleep(50);
      out.hasLandingMarkerBefore = document.querySelectorAll('.landing-pulse-marker').length > 0;

      // Simulate right-click / contextmenu on map
      if (typeof window.showContextMenuForLocation === 'function') {
        window.showContextMenuForLocation({ lng: 116.41, lat: 39.91 }, { x: 200, y: 200 }, '海关大厦');
      }
      await sleep(50);
      out.hasLandingMarkerAfter = document.querySelectorAll('.landing-pulse-marker').length > 0;
      out.hasContextMenu = document.getElementById('map-context-menu')?.style.display !== 'none';
    }

    // 3. Verify uploadCloudSyncPayload exists and functions
    out.hasUploadSync = typeof window.uploadCloudSyncPayload === 'function';

    return out;
  })()`);

  console.log('Test v1.8.0 results:', result);

  assert.ok(result.badgeText >= 'v1.8.0', 'Brand version badge should be >= v1.8.0');
  assert.strictEqual(result.hasLandingMarkerBefore, true, 'Landing marker should be displayed before right click');
  assert.strictEqual(result.hasLandingMarkerAfter, false, 'Landing marker must be cleared on right click');
  assert.strictEqual(result.hasContextMenu, true, 'Context menu should open on right click');
  assert.strictEqual(result.hasUploadSync, true, 'uploadCloudSyncPayload must be available');

  console.log('✅ v1.8.0 tests passed successfully!');
  clearTimeout(watchdog);
  app.exit(0);
}).catch(err => {
  console.error('Test error:', err);
  clearTimeout(watchdog);
  app.exit(1);
});

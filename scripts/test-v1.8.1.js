const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.8.1 test timed out after 30s');
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

    // 1. Verify brand version badge is v1.8.1
    const badge = document.getElementById('brand-ver-badge-txt');
    out.badgeText = badge ? badge.innerText.trim() : null;

    // 2. Check status pitch lock text
    const lockSpan = document.getElementById('status-pitch-lock');
    out.lockSpanTextInitial = lockSpan ? lockSpan.innerText.trim() : '';

    // Toggle pitch lock off and on again
    const lockBtn = document.getElementById('btn-lock-pitch-toggle');
    if (lockBtn) {
      lockBtn.click();
      await sleep(50);
      out.lockSpanTextAfterToggle1 = lockSpan ? lockSpan.innerText.trim() : '';
      lockBtn.click();
      await sleep(50);
      out.lockSpanTextAfterToggle2 = lockSpan ? lockSpan.innerText.trim() : '';
    }

    // 3. Status pitch display still displays normal pitch
    const pitchSpan = document.getElementById('status-pitch');
    out.pitchSpanText = pitchSpan ? pitchSpan.innerText.trim() : '';

    return out;
  })()`);

  console.log('Test v1.8.1 results:', result);

  assert.ok(result.badgeText >= 'v1.8.1', 'Brand version badge should be >= v1.8.1');
  assert.strictEqual(result.lockSpanTextInitial, '', 'Initial lock indicator text should be empty');
  assert.strictEqual(result.lockSpanTextAfterToggle1, '', 'Lock indicator text after toggle off should be empty');
  assert.strictEqual(result.lockSpanTextAfterToggle2, '', 'Lock indicator text after toggle on should be empty');
  assert.ok(result.pitchSpanText.includes('俯仰:'), 'Normal pitch span should still display pitch');

  console.log('✅ v1.8.1 tests passed successfully!');
  clearTimeout(watchdog);
  app.exit(0);
}).catch(err => {
  console.error('Test error:', err);
  clearTimeout(watchdog);
  app.exit(1);
});

const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.9.9 update-state test timed out');
  app.exit(1);
}, 30000);

let checkCount = 0;
let downloadCount = 0;
let installCount = 0;
let testWindow;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, stats: {}, provinces: {} }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
  ipcMain.handle('get-app-version', () => '1.9.10');
ipcMain.handle('check-for-updates', async () => {
  checkCount += 1;
  return {
    hasUpdate: true,
    currentVersion: '1.9.10',
    version: '2.0.0',
    downloadUrl: 'https://example.invalid/outmap/app.asar',
    backupUrl: 'https://example.invalid/outmap/app-backup.asar',
    sha256: 'test-sha256'
  };
});
ipcMain.handle('start-app-update', async () => {
  downloadCount += 1;
  testWindow.webContents.send('update-download-progress', {
    percent: 40,
    speed: '100 KB/s',
    receivedBytes: 40,
    totalBytes: 100,
    stage: 'downloading'
  });
  await delay(180);
  testWindow.webContents.send('update-download-progress', {
    percent: 100,
    speed: '已就绪',
    receivedBytes: 100,
    totalBytes: 100,
    stage: 'downloaded'
  });
  return { success: true, downloaded: true };
});
ipcMain.handle('install-app-update', () => {
  installCount += 1;
  return { success: true };
});

app.whenReady().then(async () => {
  testWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: 'C:/Users/cuihm/.gemini/antigravity/scratch/outmap/preload.js',
      contextIsolation: true
    }
  });
  await testWindow.loadFile('C:/Users/cuihm/.gemini/antigravity/scratch/outmap/src/index.html');

  const result = await testWindow.webContents.executeJavaScript(`(${async () => {
    while (!window.mapInstance) await new Promise(r => setTimeout(r, 25));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const brand = document.querySelector('.brand-flip-front');
    const other = document.getElementById('btn-fab-layers');
    const card = document.getElementById('brand-flip-card');
    const clickBrand = () => brand?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    clickBrand();
    await sleep(120);
    const afterCheck = {
      flipped: card?.classList.contains('flipped') || false,
      state: card?.dataset.updateState || ''
    };

    clickBrand();
    await sleep(45);
    const duringDownload = {
      flipped: card?.classList.contains('flipped') || false,
      state: card?.dataset.updateState || ''
    };

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(20);
    const afterOtherUiDuringDownload = {
      flipped: card?.classList.contains('flipped') || false,
      state: card?.dataset.updateState || ''
    };

    await sleep(220);
    const afterDownload = {
      flipped: card?.classList.contains('flipped') || false,
      state: card?.dataset.updateState || ''
    };

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(30);
    const afterOtherUiReady = {
      flipped: card?.classList.contains('flipped') || false,
      state: card?.dataset.updateState || ''
    };

    clickBrand();
    await sleep(60);
    return { afterCheck, duringDownload, afterOtherUiDuringDownload, afterDownload, afterOtherUiReady };
  }})()`);

  console.log('v1.9.9 update-state result:', JSON.stringify({ result, checkCount, downloadCount, installCount }, null, 2));
  assert.strictEqual(checkCount, 1, 'update check must run once for one update session');
  assert.strictEqual(downloadCount, 1, 'update download must run once for one update session');
  assert.strictEqual(installCount, 1, 'ready package must install after returning to the brand control');
  assert.strictEqual(result.afterCheck.state, 'available');
  assert.strictEqual(result.duringDownload.state, 'downloading');
  assert.strictEqual(result.afterOtherUiDuringDownload.state, 'downloading');
  assert.strictEqual(result.afterOtherUiDuringDownload.flipped, true, 'active download must not be dismissed by another UI click');
  assert.strictEqual(result.afterDownload.state, 'ready');
  assert.strictEqual(result.afterOtherUiReady.state, 'ready', 'ready package state must survive card dismissal');
  assert.strictEqual(result.afterOtherUiReady.flipped, false, 'ready card may dismiss without losing the package');

  clearTimeout(watchdog);
  console.log('✅ v1.9.9 update-state checks passed');
  app.exit(0);
}).catch(err => {
  clearTimeout(watchdog);
  console.error('v1.9.9 update-state test error:', err);
  app.exit(1);
});

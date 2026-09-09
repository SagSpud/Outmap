const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const os = require('os');

console.log('=== Outmap v1.5.9 Integration & Native Bridge Test ===');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// 隔离测试进程缓存目录，彻底杜绝缓存文件冲突
app.setPath('userData', path.join(os.tmpdir(), 'outmap-test-v159-' + process.pid));

// 注册基础 IPC 模拟处理器，确保测试窗口加载时不产生未处理异常
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, provinces: {} }));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false, syncKey: 'default' }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));
ipcMain.handle('pull-cloud-sync-data', () => ({ success: true, data: null }));
ipcMain.handle('check-tile-updates', () => ({ updatesAvailable: false }));
ipcMain.handle('search-location', () => []);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const pageErrors = [];
  win.webContents.on('console', (event, level, message) => {
    if (level === 'error') pageErrors.push(message);
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(r => setTimeout(r, 600));

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const pyramidModal = document.getElementById('pyramid-modal');
      const syncModal = document.getElementById('sync-modal');
      const updateModal = document.getElementById('update-modal');
      const mapWrap = document.getElementById('map-wrap');

      // 1. DOM Hierarchy check: modals must NOT be inside #map-wrap
      const pyramidInsideMap = mapWrap.contains(pyramidModal);
      const syncInsideMap = mapWrap.contains(syncModal);
      const updateInsideMap = mapWrap.contains(updateModal);

      // 2. Modals must be direct children of body or outside app-container
      const pyramidParentIsBody = pyramidModal.parentElement === document.body;

      // 3. Check CSS computed style of .modal-overlay
      pyramidModal.style.display = 'flex';
      const modalStyle = window.getComputedStyle(pyramidModal);
      const position = modalStyle.position;
      const top = modalStyle.top;
      const left = modalStyle.left;
      const zIndex = parseInt(modalStyle.zIndex, 10);
      const backdropFilter = modalStyle.backdropFilter || modalStyle.webkitBackdropFilter;
      pyramidModal.style.display = 'none';

      // 4. Check electronAPI exposure
      const api = window.electronAPI;
      const hasShowMapContextMenu = typeof api?.showMapContextMenu === 'function';
      const hasSaveFileDialog = typeof api?.saveFileDialog === 'function';
      const hasOpenFileDialog = typeof api?.openFileDialog === 'function';
      const hasWriteClipboardText = typeof api?.writeClipboardText === 'function';

      // 5. Check global copyTextToClipboard helper
      const hasCopyHelper = typeof window.copyTextToClipboard === 'function';

      return {
        pyramidInsideMap,
        syncInsideMap,
        updateInsideMap,
        pyramidParentIsBody,
        position,
        top,
        left,
        zIndex,
        backdropFilter,
        hasShowMapContextMenu,
        hasSaveFileDialog,
        hasOpenFileDialog,
        hasWriteClipboardText,
        hasCopyHelper,
        version: window.OUTMAP_APP_VERSION
      };
    })()
  `);

  console.log('Validation results:', results);

  assert.strictEqual(results.pyramidInsideMap, false, '#pyramid-modal must NOT be inside #map-wrap');
  assert.strictEqual(results.syncInsideMap, false, '#sync-modal must NOT be inside #map-wrap');
  assert.strictEqual(results.updateInsideMap, false, '#update-modal must NOT be inside #map-wrap');
  assert.strictEqual(results.pyramidParentIsBody, true, '#pyramid-modal must be a direct child of document.body');
  assert.strictEqual(results.position, 'fixed', '.modal-overlay position must be fixed for full viewport coverage');
  assert.strictEqual(results.top, '0px', '.modal-overlay top must be 0px (no gap)');
  assert.strictEqual(results.left, '0px', '.modal-overlay left must be 0px');
  assert(results.backdropFilter === 'none' || (results.backdropFilter && results.backdropFilter.includes('blur')), '.modal-overlay backdrop filter check');

  assert.strictEqual(results.hasShowMapContextMenu, true, 'electronAPI.showMapContextMenu must be exposed');
  assert.strictEqual(results.hasSaveFileDialog, true, 'electronAPI.saveFileDialog must be exposed');
  assert.strictEqual(results.hasOpenFileDialog, true, 'electronAPI.openFileDialog must be exposed');
  assert.strictEqual(results.hasWriteClipboardText, true, 'electronAPI.writeClipboardText must be exposed');
  assert.strictEqual(results.hasCopyHelper, true, 'window.copyTextToClipboard must be available');
  assert.strictEqual(results.version, pkg.version, 'OUTMAP_APP_VERSION must match package.json');

  if (pageErrors.length > 0) {
    console.error('Page errors encountered during test:', pageErrors);
    process.exit(1);
  }

  console.log('✅ ALL v1.5.9 MODAL BACKDROP & NATIVE BRIDGE CHECKS PASSED!');
  app.exit(0);
});

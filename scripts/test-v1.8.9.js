const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

console.log('Running Outmap v1.8.9 Test Suite...');

// 1. Static file verification
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.strictEqual(pkg.version, '1.8.9', 'package.json version must be 1.8.9');

const html = fs.readFileSync('src/index.html', 'utf8');
assert(html.includes('style.css?v=1.8.9'), 'index.html must reference style.css?v=1.8.9');
assert(html.includes('app.js?v=1.8.9'), 'index.html must reference app.js?v=1.8.9');
assert(html.includes('location-camera.js?v=1.8.9'), 'index.html must reference location-camera.js?v=1.8.9');
assert(html.includes('id="brand-ver-badge-txt">v1.8.9</span>'), 'index.html brand badge must show v1.8.9');

// Verify route actions row buttons in index.html
assert(html.includes('id="btn-calc-route"'), 'route-actions-row must have #btn-calc-route (规划)');
assert(html.includes('id="btn-route-import-trigger">导入</button>'), 'route-actions-row must have standalone #btn-route-import-trigger (导入)');
assert(html.includes('id="btn-export-gpx">导出</button>'), 'route-actions-row must have standalone #btn-export-gpx (导出)');
assert(html.includes('id="btn-save-route-trigger">收藏</button>'), 'route-actions-row must have standalone #btn-save-route-trigger (收藏)');
assert(html.includes('id="btn-route-details-toggle">详情 ▾</button>'), 'route-actions-row must have #btn-route-details-toggle (详情 ▾)');
assert(html.includes('id="btn-clear-route">清空</button>'), 'route-actions-row must have #btn-clear-route (清空)');
assert(!html.includes('class="route-export-dropdown-wrap"'), 'route-actions-row must not have .route-export-dropdown-wrap dropdown');

// Verify preload.js exposes showWaypointTypeMenu
const preloadJs = fs.readFileSync('preload.js', 'utf8');
assert(preloadJs.includes('showWaypointTypeMenu:'), 'preload.js must expose showWaypointTypeMenu');

// Verify main.js handles show-waypoint-type-menu
const mainJs = fs.readFileSync('main.js', 'utf8');
assert(mainJs.includes("ipcMain.handle('show-waypoint-type-menu'"), 'main.js must register show-waypoint-type-menu handler');

// Verify app.js optimizations
const appJs = fs.readFileSync('src/app.js', 'utf8');
assert(appJs.includes("const APP_VERSION = '1.8.9';"), "app.js must declare APP_VERSION = '1.8.9'");
assert(appJs.includes('fadeDuration: 0'), 'app.js must set fadeDuration: 0 to eliminate zoom flickering');
assert(appJs.includes('prefetch: 2'), 'app.js must set prefetch: 2 in desktop mode');
assert(appJs.includes('electronAPI.showWaypointTypeMenu'), 'app.js must call native showWaypointTypeMenu');
assert(!appJs.includes('showToast(`已将“${wp.name}”类型修改为'), 'app.js must not show toast when changing waypoint type');

// Verify location-camera.js
const camJs = fs.readFileSync('src/location-camera.js', 'utf8');
assert(camJs.includes('curve: 1.42'), 'location-camera.js must use curve: 1.42 for smooth flight');
assert(!camJs.includes("listen('sourcedata'"), 'location-camera.js must not listen to sourcedata for refine');

console.log('Static assertions passed. Starting Electron runtime tests...');

// 2. Electron runtime tests
const watchdog = setTimeout(() => {
  console.error('v1.8.9 test timed out after 30s');
  app.exit(1);
}, 30000);

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
  data: { version: '1.8.9', username: 'tester', favorites: [], folders: [], routes: [] }
}));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  const result = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      // Check DOM elements
      const btnCalc = document.getElementById('btn-calc-route');
      const btnImport = document.getElementById('btn-route-import-trigger');
      const btnExport = document.getElementById('btn-export-gpx');
      const btnSave = document.getElementById('btn-save-route-trigger');
      const btnDetails = document.getElementById('btn-route-details-toggle');
      const btnClear = document.getElementById('btn-clear-route');
      const routeInput = document.getElementById('route-panel-import-input');

      const checks = {
        hasBtnCalc: !!btnCalc && btnCalc.innerText.trim() === '规划',
        hasBtnImport: !!btnImport && btnImport.innerText.trim() === '导入',
        hasBtnExport: !!btnExport && btnExport.innerText.trim() === '导出',
        hasBtnSave: !!btnSave && btnSave.innerText.trim() === '收藏',
        hasBtnDetails: !!btnDetails && btnDetails.innerText.includes('详情'),
        hasBtnClear: !!btnClear && btnClear.innerText.trim() === '清空',
        hasHiddenFileInput: !!routeInput,
        hasNoOldDropdown: !document.querySelector('.route-export-dropdown-wrap'),
        hasNativeWaypointMenuAPI: typeof window.electronAPI?.showWaypointTypeMenu === 'function',

        // Save route modal button styling checks
        btnCancelSaveRouteClass: document.getElementById('btn-cancel-save-route')?.className,
        btnConfirmSaveRouteClass: document.getElementById('btn-confirm-save-route')?.className,
        btnConfirmSaveRouteText: document.getElementById('btn-confirm-save-route')?.innerText.trim(),
        btnSaveWaypointText: document.getElementById('btn-save-waypoint')?.innerText.trim(),
        saveRouteCancelBg: getComputedStyle(document.getElementById('btn-cancel-save-route')).backgroundColor,
        saveRouteConfirmBg: getComputedStyle(document.getElementById('btn-confirm-save-route')).backgroundColor
      };

      resolve(checks);
    });
  `);

  console.log('Runtime test results:', JSON.stringify(result, null, 2));

  assert(result.hasBtnCalc, 'btn-calc-route must exist with text 规划');
  assert(result.hasBtnImport, 'btn-route-import-trigger must exist with text 导入');
  assert(result.hasBtnExport, 'btn-export-gpx must exist with text 导出');
  assert(result.hasBtnSave, 'btn-save-route-trigger must exist with text 收藏');
  assert(result.hasBtnDetails, 'btn-route-details-toggle must exist with text 详情 ▾');
  assert(result.hasBtnClear, 'btn-clear-route must exist with text 清空');
  assert(result.hasHiddenFileInput, 'route-panel-import-input must exist');
  assert(result.hasNoOldDropdown, 'route-export-dropdown-wrap must not exist in DOM');
  assert(result.hasNativeWaypointMenuAPI, 'electronAPI.showWaypointTypeMenu must be exposed in window');

  // Verify unified button classes & styles
  assert(result.btnCancelSaveRouteClass.includes('modal-btn secondary'), 'btn-cancel-save-route must use modal-btn secondary');
  assert(result.btnConfirmSaveRouteClass.includes('modal-btn primary'), 'btn-confirm-save-route must use modal-btn primary');
  assert.strictEqual(result.btnConfirmSaveRouteText, '保存路线', 'btn-confirm-save-route text must be 保存路线');
  assert.strictEqual(result.btnSaveWaypointText, '保存到收藏', 'btn-save-waypoint must not have emoji');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.8.9 RUNTIME & STATIC TESTS PASSED PERFECTLY!');
  app.quit();
  process.exit(0);
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

console.log('Running Outmap v1.8.10 Test Suite...');

// 1. Static file verification
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.strictEqual(pkg.version, '1.8.10', 'package.json version must be 1.8.10');

const html = fs.readFileSync('src/index.html', 'utf8');
assert(html.includes('style.css?v=1.8.10'), 'index.html must reference style.css?v=1.8.10');
assert(html.includes('app.js?v=1.8.10'), 'index.html must reference app.js?v=1.8.10');
assert(html.includes('location-camera.js?v=1.8.10'), 'index.html must reference location-camera.js?v=1.8.10');
assert(html.includes('id="brand-ver-badge-txt">v1.8.10</span>'), 'index.html brand badge must show v1.8.10');

// Verify route panel header actions (import, sync, close)
assert(html.includes('id="btn-route-import-trigger"'), 'route panel header must have #btn-route-import-trigger (导入)');
assert(html.includes('id="btn-route-sync"'), 'route panel header must have #btn-route-sync (同步)');
assert(html.includes('id="btn-close-route-panel"'), 'route panel header must have #btn-close-route-panel (✕)');

// Verify favorites drawer header actions (import, sync, close)
assert(html.includes('id="btn-fav-drawer-import-pts"'), 'favorites drawer header must have #btn-fav-drawer-import-pts (导入)');
assert(html.includes('id="btn-fav-drawer-sync"'), 'favorites drawer header must have #btn-fav-drawer-sync (同步)');
assert(html.includes('id="btn-close-favorites-drawer"'), 'favorites drawer header must have #btn-close-favorites-drawer (✕)');

// Verify route-actions-row has strictly 4 buttons: 规划, 详情 ▾, 收藏, 清空
assert(html.includes('id="btn-calc-route"'), 'route-actions-row must have #btn-calc-route (规划)');
assert(html.includes('id="btn-route-details-toggle">详情 ▾</button>'), 'route-actions-row must have #btn-route-details-toggle (详情 ▾)');
assert(html.includes('id="btn-save-route-trigger">收藏</button>'), 'route-actions-row must have #btn-save-route-trigger (收藏)');
assert(html.includes('id="btn-clear-route">清空</button>'), 'route-actions-row must have #btn-clear-route (清空)');
assert(!html.includes('id="btn-export-gpx"'), 'route-actions-row must NOT have #btn-export-gpx (routes exported from favorites right click)');

// Verify style.css rules
const styleCss = fs.readFileSync('src/style.css', 'utf8');
assert(styleCss.includes('.panel-header-actions'), 'style.css must define .panel-header-actions');
assert(styleCss.includes('.card-action-btn.btn-import'), 'style.css must style .card-action-btn.btn-import');
assert(styleCss.includes('.card-action-btn.btn-sync'), 'style.css must style .card-action-btn.btn-sync');
assert(styleCss.includes('grid-template-columns: repeat(4, 1fr) !important;'), 'style.css mobile media query must have 4 columns for route-actions-row');

// Verify preload.js exposes showWaypointTypeMenu
const preloadJs = fs.readFileSync('preload.js', 'utf8');
assert(preloadJs.includes('showWaypointTypeMenu:'), 'preload.js must expose showWaypointTypeMenu');

// Verify main.js handles show-waypoint-type-menu
const mainJs = fs.readFileSync('main.js', 'utf8');
assert(mainJs.includes("ipcMain.handle('show-waypoint-type-menu'"), 'main.js must register show-waypoint-type-menu handler');

// Verify app.js optimizations and iOS deep green color
const appJs = fs.readFileSync('src/app.js', 'utf8');
assert(appJs.includes("const APP_VERSION = '1.8.10';"), "app.js must declare APP_VERSION = '1.8.10'");
assert(appJs.includes("'line-color': '#248a3d'"), "app.js outdoor-route-line must use iOS deeper green #248a3d for OLED screen comfort");
assert(appJs.includes("'line-color': '#0e4a23'"), "app.js outdoor-route-casing must use casing #0e4a23");
assert(appJs.includes("btnRouteSync?.addEventListener('click'"), 'app.js must wire btnRouteSync click listener');
assert(appJs.includes("btnEl.id === 'btn-fav-drawer-sync' || btnEl.id === 'btn-route-sync'"), 'app.js handleManualSync must handle btn-route-sync');
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
  console.error('v1.8.10 test timed out after 30s');
  app.exit(1);
}, 30000);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  app.exit(1);
  process.exit(1);
});

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
  data: { version: '1.8.10', username: 'tester', favorites: [], folders: [], routes: [] }
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
      // 1. Check Route Panel Header Actions
      const routePanelHeader = document.querySelector('#route-panel .panel-header');
      const btnRouteImport = document.getElementById('btn-route-import-trigger');
      const btnRouteSync = document.getElementById('btn-route-sync');
      const btnCloseRoute = document.getElementById('btn-close-route-panel');
      const routePanelActions = routePanelHeader?.querySelector('.panel-header-actions');

      // 2. Check Favorites Drawer Header Actions
      const favDrawerHeader = document.querySelector('#favorites-drawer .panel-header');
      const btnFavImport = document.getElementById('btn-fav-drawer-import-pts');
      const btnFavSync = document.getElementById('btn-fav-drawer-sync');
      const btnCloseFav = document.getElementById('btn-close-favorites-drawer');
      const favDrawerActions = favDrawerHeader?.querySelector('.panel-header-actions');

      // 3. Check Route Actions Row (strictly 4 buttons)
      const actionsRow = document.querySelector('.route-actions-row');
      const actionButtons = actionsRow ? Array.from(actionsRow.querySelectorAll('button')) : [];
      const btnCalc = document.getElementById('btn-calc-route');
      const btnDetails = document.getElementById('btn-route-details-toggle');
      const btnSave = document.getElementById('btn-save-route-trigger');
      const btnClear = document.getElementById('btn-clear-route');
      const btnExport = document.getElementById('btn-export-gpx');

      // 4. Check Save Route Modal Button styles
      const btnCancelSave = document.getElementById('btn-cancel-save-route');
      const btnConfirmSave = document.getElementById('btn-confirm-save-route');

      resolve({
        routeHeaderHasImport: routePanelActions?.contains(btnRouteImport),
        routeHeaderHasSync: routePanelActions?.contains(btnRouteSync),
        routeHeaderHasClose: routePanelActions?.contains(btnCloseRoute),
        favHeaderHasImport: favDrawerActions?.contains(btnFavImport),
        favHeaderHasSync: favDrawerActions?.contains(btnFavSync),
        favHeaderHasClose: favDrawerActions?.contains(btnCloseFav),
        actionButtonsCount: actionButtons.length,
        actionButtonsIds: actionButtons.map(b => b.id),
        hasBtnCalc: !!btnCalc && btnCalc.innerText.trim() === '规划',
        hasBtnDetails: !!btnDetails && btnDetails.innerText.includes('详情'),
        hasBtnSave: !!btnSave && btnSave.innerText.trim() === '收藏',
        hasBtnClear: !!btnClear && btnClear.innerText.trim() === '清空',
        hasNoExportBtn: !btnExport,
        btnCancelSaveClass: btnCancelSave?.className,
        btnConfirmSaveClass: btnConfirmSave?.className,
        btnConfirmSaveText: btnConfirmSave?.innerText.trim(),
        hasNativeWaypointMenuAPI: typeof window.electronAPI?.showWaypointTypeMenu === 'function'
      });
    });
  `);

  console.log('Runtime test results:', JSON.stringify(result, null, 2));

  assert(result.routeHeaderHasImport, 'Route panel header must contain #btn-route-import-trigger');
  assert(result.routeHeaderHasSync, 'Route panel header must contain #btn-route-sync');
  assert(result.routeHeaderHasClose, 'Route panel header must contain #btn-close-route-panel');

  assert(result.favHeaderHasImport, 'Favorites drawer header must contain #btn-fav-drawer-import-pts');
  assert(result.favHeaderHasSync, 'Favorites drawer header must contain #btn-fav-drawer-sync');
  assert(result.favHeaderHasClose, 'Favorites drawer header must contain #btn-close-favorites-drawer');

  assert.strictEqual(result.actionButtonsCount, 4, 'route-actions-row must contain exactly 4 buttons');
  assert(result.hasBtnCalc, 'btn-calc-route must exist with text 规划');
  assert(result.hasBtnDetails, 'btn-route-details-toggle must exist with text 详情 ▾');
  assert(result.hasBtnSave, 'btn-save-route-trigger must exist with text 收藏');
  assert(result.hasBtnClear, 'btn-clear-route must exist with text 清空');
  assert(result.hasNoExportBtn, 'route-actions-row must NOT have an export button');

  assert(result.btnCancelSaveClass.includes('modal-btn secondary'), 'btn-cancel-save-route must use modal-btn secondary');
  assert(result.btnConfirmSaveClass.includes('modal-btn primary'), 'btn-confirm-save-route must use modal-btn primary');
  assert.strictEqual(result.btnConfirmSaveText, '保存路线', 'btn-confirm-save-route text must be 保存路线');
  assert(result.hasNativeWaypointMenuAPI, 'electronAPI.showWaypointTypeMenu must be exposed in window');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.8.10 RUNTIME & STATIC TESTS PASSED PERFECTLY!');
  app.quit();
  process.exit(0);
});

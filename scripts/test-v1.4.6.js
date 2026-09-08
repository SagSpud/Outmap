const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('Test execution timed out after 30s!');
  process.exit(1);
}, 30000).unref();

// 1. 静态代码与配置审查
console.log('--- 1. Static Configuration & Code Assertions (v1.4.6) ---');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainSrc = fs.readFileSync('main.js', 'utf8');
const preloadSrc = fs.readFileSync('preload.js', 'utf8');
const appSrc = fs.readFileSync('src/app.js', 'utf8');
const locCamSrc = fs.readFileSync('src/location-camera.js', 'utf8');
const styleSrc = fs.readFileSync('src/style.css', 'utf8');
const htmlSrc = fs.readFileSync('src/index.html', 'utf8');
const workerSrc = fs.readFileSync('src/offline-worker.cjs', 'utf8');

// 版本号检查
assert.strictEqual(pkg.version, '1.4.6', 'package.json version must be 1.4.6');
assert(htmlSrc.includes('app.js?v=1.4.6'), 'index.html must reference app.js?v=1.4.6');
assert(htmlSrc.includes('location-camera.js?v=1.4.6'), 'index.html must reference location-camera.js?v=1.4.6');
assert(htmlSrc.includes('style.css?v=1.4.6'), 'index.html must reference style.css?v=1.4.6');
assert(htmlSrc.includes('v1.4.6'), 'index.html must show v1.4.6 badge');
assert(appSrc.includes("const APP_VERSION = '1.4.6'"), 'app.js must declare APP_VERSION 1.4.6');

// 离线统计与卫星图层检查 (针对 88万 / 9G vs 20+G Bug 的修复断言)
assert(workerSrc.includes("dirName: 'sat'"), 'offline-worker.cjs must scan sat layer');
assert(workerSrc.includes("dirName: 'satellite'"), 'offline-worker.cjs must scan satellite layer');
assert(workerSrc.includes('inventoryVersion: 3'), 'offline-worker.cjs must yield inventoryVersion: 3');
assert(workerSrc.includes('stats.satCount'), 'offline-worker.cjs must accumulate satCount');
assert(workerSrc.includes('stats.satBytes'), 'offline-worker.cjs must accumulate satBytes');
assert(mainSrc.includes('satCount: stats.satCount || 0'), 'main.js get-tile-server-info must propagate actual satCount');
assert(mainSrc.includes('inventoryVersion !== 3'), 'main.js getQuickTileCount must check inventoryVersion !== 3');
assert(appSrc.includes('onOfflineInventoryUpdated'), 'app.js must listen to onOfflineInventoryUpdated event');

// 控件与视角优化断言
assert(locCamSrc.includes('0.62'), 'location-camera.js must anchor landing point at 0.62');
const terrainIdx = htmlSrc.indexOf('3D 立体地貌起伏');
const routesIdx = htmlSrc.indexOf('规划与导入路线轨迹');
assert(terrainIdx !== -1 && routesIdx !== -1 && terrainIdx < routesIdx, '3D 立体地貌起伏 must be placed above 规划与导入路线轨迹');

// 原生感 UI 检查
assert(styleSrc.includes('::-webkit-scrollbar'), 'style.css must define native overlay scrollbar');
assert(styleSrc.includes('scrollbar-width: thin'), 'style.css must define standard thin scrollbar');
assert(styleSrc.includes('-webkit-user-drag: none'), 'style.css must suppress native image drag');

// 语法验证
new Function(appSrc);
new Function(mainSrc);
new Function(preloadSrc);
new Function(locCamSrc);
console.log('✓ All static assertions & syntax checks passed!\n');

// 2. 动态实机测试 (Electron)
console.log('--- 2. Dynamic Electron Runtime Verification ---');

ipcMain.handle('get-tile-server-info', () => ({ port: 28795, demCount: 500, satCount: 300, vectorCount: 400, fontCount: 10, totalTiles: 1210, totalBytes: 25000000 }));
ipcMain.handle('get-offline-status', () => ({ demCount: 500, satCount: 300, vectorCount: 400, totalTiles: 1210, totalBytes: 25000000 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, stats: { totalTiles: 1210, totalBytes: 25000000, satCount: 300 }, provinces: {} }));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 1210, totalBytes: 25000000, satCount: 300 }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const pageErrors = [];
  win.webContents.on('crashed', (e) => pageErrors.push(`Renderer crashed: ${e}`));
  win.webContents.on('plugin-crashed', (e) => pageErrors.push(`Plugin crashed: ${e}`));
  win.webContents.on('render-process-gone', (e, details) => {
    if (details.reason !== 'clean-exit') pageErrors.push(`Renderer gone: ${details.reason}`);
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  const domCheck = await win.webContents.executeJavaScript(`
    (() => {
      const brand = document.getElementById('brand-ver-badge-txt');
      const routePanel = document.getElementById('route-panel');
      const viaList = document.getElementById('route-via-list');
      const canvas = document.getElementById('elevation-chart-canvas');
      const btnExportGpx = document.getElementById('btn-export-gpx');
      const layersPopover = document.getElementById('layers-popover');
      const btnFabLayers = document.getElementById('btn-fab-layers');
      const btnFabImport = document.getElementById('btn-fab-import');
      const trackInput = document.getElementById('track-file-import-input');
      const cacheStat = document.getElementById('titlebar-cache-stat');
      return {
        brandText: brand ? brand.innerText : null,
        hasRoutePanel: !!routePanel,
        hasViaList: !!viaList,
        hasCanvas: !!canvas,
        hasBtnExportGpx: !!btnExportGpx,
        hasLayersPopover: !!layersPopover,
        hasBtnFabLayers: !!btnFabLayers,
        hasBtnFabImport: !!btnFabImport,
        hasTrackInput: !!trackInput,
        cacheStatText: cacheStat ? cacheStat.innerText : null
      };
    })()
  `);

  console.log('DOM Check result:', domCheck);
  assert.strictEqual(domCheck.brandText, 'v1.4.6', 'Brand badge in DOM must display v1.4.6');
  assert(domCheck.hasRoutePanel, 'routePanel must exist');
  assert(domCheck.hasViaList, 'route-via-list must exist');
  assert(domCheck.hasCanvas, 'elevation-chart-canvas must exist');
  assert(domCheck.hasBtnExportGpx, 'btn-export-gpx must exist');
  assert(domCheck.hasLayersPopover, 'layers-popover must exist');
  assert(domCheck.hasBtnFabLayers, 'btn-fab-layers must exist');
  assert(domCheck.hasBtnFabImport, 'btn-fab-import must exist');
  assert(domCheck.hasTrackInput, 'track-file-import-input must exist');

  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
    process.exit(1);
  }

  console.log('\n🎉 ALL v1.4.6 VERIFICATIONS PASSED SUCCESSFULLY!');
  app.exit(0);
});

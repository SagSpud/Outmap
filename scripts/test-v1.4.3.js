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
console.log('--- 1. Static Configuration & Code Assertions (v1.4.3) ---');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainSrc = fs.readFileSync('main.js', 'utf8');
const preloadSrc = fs.readFileSync('preload.js', 'utf8');
const appSrc = fs.readFileSync('src/app.js', 'utf8');
const locCamSrc = fs.readFileSync('src/location-camera.js', 'utf8');
const styleSrc = fs.readFileSync('src/style.css', 'utf8');
const htmlSrc = fs.readFileSync('src/index.html', 'utf8');

// 版本号检查
assert.strictEqual(pkg.version, '1.4.3', 'package.json version must be 1.4.3');
assert(htmlSrc.includes('app.js?v=1.4.3'), 'index.html must reference app.js?v=1.4.3');
assert(htmlSrc.includes('location-camera.js?v=1.4.3'), 'index.html must reference location-camera.js?v=1.4.3');
assert(htmlSrc.includes('style.css?v=1.4.3'), 'index.html must reference style.css?v=1.4.3');
assert(htmlSrc.includes('v1.4.3'), 'index.html must show v1.4.3 badge');

// location-camera.js 检查: 保持无闪烁 3D 地形自适应对齐与相机事务安全
assert(locCamSrc.includes('OutmapLocationCamera'), 'location-camera.js must expose OutmapLocationCamera');
assert(locCamSrc.includes('terrain-dem'), 'location-camera.js must listen to terrain-dem sourcedata for 3D terrain settling');

// app.js 检查: 途径点自动滚动 + GPX 自动缺省终点 + 骑行徒步耗时独立公式 + Retina 剖面图
assert(appSrc.includes('viaListContainer.scrollTo'), 'app.js must auto-scroll to latest via point');
assert(appSrc.includes('effectiveEndCoord'), 'app.js must auto-use last via point when end point is missing');
assert(appSrc.includes("activeRouteMode === 'cycle'"), 'app.js must have dedicated cycling travel time formula');
assert(appSrc.includes("activeRouteMode === 'hike'"), 'app.js must have dedicated hiking travel time formula');
assert(appSrc.includes('window.devicePixelRatio'), 'app.js must render elevation chart with HiDPI Retina DPR scaling');

// main.js 检查: scanDirStats 采用采样优化防止 Windows (未响应)
assert(mainSrc.includes('sampleCount < 150'), 'main.js scanDirStats must use sampling to prevent blocking event loop');

// style.css 检查: iOS 动画
assert(styleSrc.includes('iosViaSlideIn'), 'style.css must have iosViaSlideIn animation');
assert(styleSrc.includes('backdrop-filter: blur(2.5px)'), 'style.css modal-overlay must have refined 2.5px blur');

// 语法验证
new Function(appSrc);
new Function(mainSrc);
new Function(preloadSrc);
new Function(locCamSrc);
console.log('✓ All static assertions & syntax checks passed!\n');

// 2. 动态实机测试 (Electron)
console.log('--- 2. Dynamic Electron Runtime Verification ---');

ipcMain.handle('get-tile-server-info', () => ({ port: 28795, demCount: 100, satCount: 0, vectorCount: 100, fontCount: 10, totalTiles: 210, totalBytes: 1024000 }));
ipcMain.handle('get-offline-status', () => ({ demCount: 100, vectorCount: 100, totalTiles: 210, totalBytes: 1024000 }));
ipcMain.handle('get-offline-manifest', () => ({ version: 1, stats: { totalTiles: 210, totalBytes: 1024000 }, provinces: {} }));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 210, totalBytes: 1024000 }));
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
      return {
        brandText: brand ? brand.innerText : null,
        hasRoutePanel: !!routePanel,
        hasViaList: !!viaList,
        hasCanvas: !!canvas,
        hasBtnExportGpx: !!btnExportGpx
      };
    })()
  `);

  console.log('DOM Check result:', domCheck);
  assert.strictEqual(domCheck.brandText, 'v1.4.3', 'Brand badge in DOM must display v1.4.3');
  assert(domCheck.hasRoutePanel, 'routePanel must exist');
  assert(domCheck.hasViaList, 'route-via-list must exist');
  assert(domCheck.hasCanvas, 'elevation-chart-canvas must exist');
  assert(domCheck.hasBtnExportGpx, 'btn-export-gpx must exist');

  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
    process.exit(1);
  }

  console.log('\n🎉 ALL v1.4.3 VERIFICATIONS PASSED SUCCESSFULLY!');
  app.exit(0);
});

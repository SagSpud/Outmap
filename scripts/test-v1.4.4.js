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
console.log('--- 1. Static Configuration & Code Assertions (v1.4.4) ---');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainSrc = fs.readFileSync('main.js', 'utf8');
const preloadSrc = fs.readFileSync('preload.js', 'utf8');
const appSrc = fs.readFileSync('src/app.js', 'utf8');
const locCamSrc = fs.readFileSync('src/location-camera.js', 'utf8');
const styleSrc = fs.readFileSync('src/style.css', 'utf8');
const htmlSrc = fs.readFileSync('src/index.html', 'utf8');

// 版本号检查
assert.strictEqual(pkg.version, '1.4.4', 'package.json version must be 1.4.4');
assert(htmlSrc.includes('app.js?v=1.4.4'), 'index.html must reference app.js?v=1.4.4');
assert(htmlSrc.includes('location-camera.js?v=1.4.4'), 'index.html must reference location-camera.js?v=1.4.4');
assert(htmlSrc.includes('style.css?v=1.4.4'), 'index.html must reference style.css?v=1.4.4');
assert(htmlSrc.includes('v1.4.4'), 'index.html must show v1.4.4 badge');

// 光标与样式检查
assert(styleSrc.includes('--cursor-grab: grab'), 'style.css must restore native grab cursor');
assert(styleSrc.includes('--cursor-crosshair: crosshair'), 'style.css must restore native crosshair cursor');
assert(styleSrc.includes('.zoom-pill-dot.partial'), 'style.css must define blue dot for partial downloads');
assert(styleSrc.includes('route-via-item.is-dragging'), 'style.css must define dragging state for via items');
assert(styleSrc.includes('.layers-popover-panel'), 'style.css must define layers popover styles');

// HTML DOM 结构检查
assert(htmlSrc.includes('id="btn-fab-layers"'), 'index.html must have btn-fab-layers');
assert(htmlSrc.includes('id="btn-fab-import"'), 'index.html must have btn-fab-import');
assert(htmlSrc.includes('id="layers-popover"'), 'index.html must have layers-popover');
assert(htmlSrc.includes('id="track-file-import-input"'), 'index.html must have track-file-import-input');

// app.js 检查
assert(appSrc.includes('maxZoom: 20'), 'app.js must restrict maxZoom to 20');
assert(appSrc.includes('parseTrackFile'), 'app.js must implement parseTrackFile');
assert(appSrc.includes('displayImportedTrack'), 'app.js must implement displayImportedTrack');
assert(appSrc.includes('setupLayersPopover'), 'app.js must implement setupLayersPopover');
assert(appSrc.includes('symbol-z-elevate'), 'app.js must configure symbol-z-elevate for terrain labels');
assert(appSrc.includes('isRouteEmpty'), 'app.js must auto-close empty route panel on map click');
assert(appSrc.includes('layersPopover'), 'app.js must handle layers-popover on ESC key');

// main.js 检查: 离线三态阈值与防卡死
assert(mainSrc.includes('Math.floor(expected * 0.96)'), 'main.js must require >= 96% for full green level');
assert(mainSrc.includes('partialZ = Math.max(partialZ, z)'), 'main.js must record partial levels');
assert(mainSrc.includes('hasProvRecord'), 'main.js getQuickTileCount must avoid full disk scan when manifest is present');

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
      const layersPopover = document.getElementById('layers-popover');
      const btnFabLayers = document.getElementById('btn-fab-layers');
      const btnFabImport = document.getElementById('btn-fab-import');
      const trackInput = document.getElementById('track-file-import-input');
      return {
        brandText: brand ? brand.innerText : null,
        hasRoutePanel: !!routePanel,
        hasViaList: !!viaList,
        hasCanvas: !!canvas,
        hasBtnExportGpx: !!btnExportGpx,
        hasLayersPopover: !!layersPopover,
        hasBtnFabLayers: !!btnFabLayers,
        hasBtnFabImport: !!btnFabImport,
        hasTrackInput: !!trackInput
      };
    })()
  `);

  console.log('DOM Check result:', domCheck);
  assert.strictEqual(domCheck.brandText, 'v1.4.4', 'Brand badge in DOM must display v1.4.4');
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

  console.log('\n🎉 ALL v1.4.4 VERIFICATIONS PASSED SUCCESSFULLY!');
  app.exit(0);
});

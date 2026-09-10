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
console.log('--- 1. Static Configuration & Code Assertions (v1.5.9) ---');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainSrc = fs.readFileSync('main.js', 'utf8');
const preloadSrc = fs.readFileSync('preload.js', 'utf8');
const appSrc = fs.readFileSync('src/app.js', 'utf8');
const locCamSrc = fs.readFileSync('src/location-camera.js', 'utf8');
const styleSrc = fs.readFileSync('src/style.css', 'utf8');
const htmlSrc = fs.readFileSync('src/index.html', 'utf8');
const workerSrc = fs.readFileSync('src/offline-worker.cjs', 'utf8');

// 版本号检查
assert(/^\d+\.\d+\.\d+$/.test(pkg.version), 'package.json version must be valid');
assert(htmlSrc.includes(`app.js?v=${pkg.version}`), 'index.html must reference current app.js');
assert(htmlSrc.includes(`location-camera.js?v=${pkg.version}`), 'index.html must reference current location-camera.js');
assert(htmlSrc.includes(`style.css?v=${pkg.version}`), 'index.html must reference current style.css');
assert(htmlSrc.includes(`v${pkg.version}`), 'index.html must show current version badge');
assert(appSrc.includes(`const APP_VERSION = '${pkg.version}'`), 'app.js must declare package version');

// Route planning: dedicated profiles, collision-free cache and concise context action.
assert(mainSrc.includes("profile === 'bike' ? 'routed-bike'"), 'Desktop proxy must use the dedicated cycling router');
assert(mainSrc.includes("profile === 'foot' ? 'routed-foot'"), 'Desktop proxy must use the dedicated walking router');
assert(mainSrc.includes("createHash('sha256').update(`${profile}:${coordStr}`)"), 'Many-waypoint cache keys must hash the full route');
assert(htmlSrc.includes('<span class="ctx-text">收藏</span>'), 'Context menu action must use the concise name 收藏');
assert(htmlSrc.includes('<span class="ctx-text">设为途径点</span>'), 'Context menu action must be named 设为途径点');
assert(htmlSrc.includes('<span class="ctx-text">设为路线起点</span>'), 'Context menu action must be named 设为路线起点');
assert(htmlSrc.includes('<span class="ctx-text">设为路线终点</span>'), 'Context menu action must be named 设为路线终点');

// 离线统计与卫星图层检查 (针对 88万 / 9G vs 20+G Bug 的修复断言)
assert(workerSrc.includes("dirName: 'sat'"), 'offline-worker.cjs must scan sat layer');
assert(workerSrc.includes("dirName: 'satellite'"), 'offline-worker.cjs must scan satellite layer');
assert(workerSrc.includes('OFFLINE_INVENTORY_VERSION = 4'), 'offline-worker.cjs must yield the current inventory schema');
assert(workerSrc.includes('stats.satCount'), 'offline-worker.cjs must accumulate satCount');
assert(workerSrc.includes('stats.satBytes'), 'offline-worker.cjs must accumulate satBytes');
assert(mainSrc.includes('satCount: stats.satCount || 0'), 'main.js get-tile-server-info must propagate actual satCount');
assert(mainSrc.includes('manifest.inventoryVersion !== OFFLINE_INVENTORY_VERSION'), 'main.js getQuickTileCount must check the current inventory schema');
assert(appSrc.includes('onOfflineInventoryUpdated'), 'app.js must listen to onOfflineInventoryUpdated event');

// 控件与视角优化断言
assert(locCamSrc.includes('0.62'), 'location-camera.js must anchor landing point at 0.62');
const terrainIdx = htmlSrc.indexOf('3D地貌效果');
const favsIdx = htmlSrc.indexOf('收藏地点');
const routesIdx = htmlSrc.indexOf('收藏与规划路线');
assert(terrainIdx !== -1 && favsIdx !== -1 && routesIdx !== -1, 'Layers must contain 3D地貌效果, 收藏地点, and 收藏与规划路线');
assert(terrainIdx < favsIdx, '3D地貌效果 must be placed above 收藏地点');
assert(favsIdx < routesIdx, '收藏地点 must be placed above 收藏与规划路线');

// 高清矢量光标断言 (无锯齿、高分屏优化)
assert(styleSrc.includes('--cursor-grab: grab'), 'style.css must use the OS-native open hand cursor');
assert(styleSrc.includes('--cursor-grabbing: grabbing'), 'style.css must use the OS-native closed hand cursor');
assert(styleSrc.includes('--cursor-crosshair: crosshair'), 'style.css must use the OS-native crosshair cursor');

// 离线状态单一圆点与语义状态断言 (彻底解决双重绿点 Bug)
assert(styleSrc.includes('.prov-status-dot'), 'style.css must define .prov-status-dot');
assert(styleSrc.includes('.prov-status-line.pending'), 'style.css must define pending state for prov-status-line');
assert(appSrc.includes('prov-status-dot pending'), 'app.js must use prov-status-dot pending');
assert(appSrc.includes('prov-status-dot ready'), 'app.js must use prov-status-dot ready');
assert(!appSrc.includes('<span class="downloaded-dot">●</span> 待下载'), 'app.js must NOT place bullet inside downloaded-dot for pending download');

// 相机与手势优化断言
assert(locCamSrc.includes('0.62'), 'location-camera.js must anchor landing point at 0.62');
assert(locCamSrc.includes('endpoint(zoom, pitch, bearing)'), 'location-camera.js must commit endpoint on final frame');

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
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false, key: 'default' }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));
ipcMain.handle('pull-cloud-sync-data', () => ({ success: true, data: null }));

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
  await new Promise(r => setTimeout(r, 600));

  const domCheck = await win.webContents.executeJavaScript(`
    (() => {
      const brand = document.getElementById('brand-ver-badge-txt');
      const routePanel = document.getElementById('route-panel');
      const viaList = document.getElementById('route-via-list');
      const canvas = document.getElementById('elevation-chart-canvas');
      const btnExportGpx = document.getElementById('btn-export-gpx');
      const layersPopover = document.getElementById('layers-popover');
      const btnFabLayers = document.getElementById('btn-fab-layers');
      const btnFabImport = document.getElementById('btn-fab-import') || document.getElementById('btn-route-import-trigger');
      const trackInput = document.getElementById('track-file-import-input') || document.getElementById('route-panel-import-input');
      const cacheStat = document.getElementById('titlebar-cache-stat');

      // 光标测试
      const rootStyle = getComputedStyle(document.documentElement);
      const grabCursor = rootStyle.getPropertyValue('--cursor-grab');
      const grabbingCursor = rootStyle.getPropertyValue('--cursor-grabbing');

      // 右键菜单地名智能解算测试 (合肥、蒙阴)
      const locHefei = window.resolveLocationInfo ? window.resolveLocationInfo(window.mapInstance, { lng: 117.28, lat: 31.86 }, { x: 400, y: 300 }, true) : '';
      const locMengyin = window.resolveLocationInfo ? window.resolveLocationInfo(window.mapInstance, { lng: 117.95, lat: 35.71 }, { x: 400, y: 300 }, true) : '';

      // 图层顺序测试
      const layerRows = document.querySelectorAll('.layer-toggle-row');
      const layerNames = Array.from(layerRows).map(r => r.innerText.trim());

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
        cacheStatText: cacheStat ? cacheStat.innerText : null,
        hasNativeGrab: grabCursor.trim() === 'grab',
        hasNativeGrabbing: grabbingCursor.trim() === 'grabbing',
        locHefei,
        locMengyin,
        layerNames
      };
    })()
  `);

  console.log('DOM & Runtime Check result:', domCheck);
  assert.strictEqual(domCheck.brandText, 'v' + pkg.version, 'Brand badge in DOM must display v' + pkg.version);
  assert(domCheck.hasRoutePanel, 'routePanel must exist');
  assert(domCheck.hasViaList, 'route-via-list must exist');
  assert(domCheck.hasCanvas, 'elevation-chart-canvas must exist');
  assert(!domCheck.hasBtnExportGpx, 'GPX export must remain in the saved-route context menu, not the planning action row');
  assert(domCheck.hasLayersPopover, 'layers-popover must exist');
  assert(domCheck.hasBtnFabLayers, 'btn-fab-layers must exist');
  assert(domCheck.hasBtnFabImport, 'btn-fab-import must exist');
  assert(domCheck.hasTrackInput, 'track-file-import-input must exist');
  assert(domCheck.hasNativeGrab, 'Must use the operating system grab cursor');
  assert(domCheck.hasNativeGrabbing, 'Must use the operating system grabbing cursor');
  assert(!domCheck.locHefei.includes('安徽省') || domCheck.locHefei.includes('合肥'), 'Context menu must not be only province');
  assert(domCheck.layerNames[0].includes('3D地貌效果'), 'Top layer must be 3D地貌效果');

  console.log('--- 3. Mobile Emulation & Safe Area Audit (390x844) ---');
  await win.setSize(390, 844);
  await new Promise(r => setTimeout(r, 300));
  const mobileCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const isNarrow = window.innerWidth <= 768;
      const anchor = window.OutmapLocationCamera ? window.OutmapLocationCamera.anchor(window.mapInstance, false) : null;
      const routePanel = document.getElementById('route-panel');
      const favorites = document.getElementById('favorites-drawer');
      document.getElementById('btn-fab-route').click();
      await new Promise(r => setTimeout(r, 30));
      const routeOpened = getComputedStyle(routePanel).display !== 'none';
      document.getElementById('btn-fab-fav').click();
      await new Promise(r => setTimeout(r, 30));
      const panelsAreExclusive = getComputedStyle(routePanel).display === 'none' && getComputedStyle(favorites).display !== 'none';
      document.getElementById('btn-close-favorites-drawer').click();
      await new Promise(r => setTimeout(r, 220));
      const favoritesClosed = getComputedStyle(favorites).display === 'none';
      return {
        isNarrow,
        anchorY: anchor ? anchor.y : 0,
        viewportH: window.innerHeight,
        routeOpened,
        panelsAreExclusive,
        favoritesClosed
      };
    })()
  `);
  console.log('Mobile Check result:', mobileCheck);
  assert(mobileCheck.isNarrow, 'Must detect narrow/mobile viewport');
  assert(mobileCheck.anchorY > mobileCheck.viewportH * 0.5, 'Mobile anchor must be biased downwards to avoid bottom sheets');
  assert(mobileCheck.routeOpened, 'Mobile route sheet must open');
  assert(mobileCheck.panelsAreExclusive, 'Mobile sheets must never stack');
  assert(mobileCheck.favoritesClosed, 'Mobile sheet close button must actually hide it');

  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
    process.exit(1);
  }

  console.log('\n🎉 ALL v1.5.9 DESKTOP & MOBILE VERIFICATIONS PASSED SUCCESSFULLY!');
  app.exit(0);
});

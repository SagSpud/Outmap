const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('Test execution timed out after 30s!');
  process.exit(1);
}, 30000).unref();

// 1. 静态代码与配置审查
console.log('--- 1. Static Configuration & Code Assertions (v1.3.9) ---');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainSrc = fs.readFileSync('main.js', 'utf8');
const preloadSrc = fs.readFileSync('preload.js', 'utf8');
const appSrc = fs.readFileSync('src/app.js', 'utf8');
const htmlSrc = fs.readFileSync('src/index.html', 'utf8');

// 版本号检查
assert.strictEqual(pkg.version, '1.3.9', 'package.json version must be 1.3.9');
assert(htmlSrc.includes('app.js?v=1.3.9'), 'index.html must reference app.js?v=1.3.9');
assert(htmlSrc.includes('style.css?v=1.3.9'), 'index.html must reference style.css?v=1.3.9');

// main.js: 极速工作站性能模式 (8GB 磁盘缓存 + 8GB V8 堆内存 + 2GB 内存高速切片热缓存)
assert(mainSrc.includes('--max-old-space-size=8192'), 'main.js must unlock 8GB V8 old space size');
assert(mainSrc.includes('8589934592'), 'main.js must set 8GB disk cache');
assert(mainSrc.includes('MAX_MEMORY_TILES = 50000'), 'main.js must cache up to 50,000 tiles in memory');
assert(mainSrc.includes('ignore-gpu-blocklist'), 'main.js must enable hardware GPU acceleration');
assert(mainSrc.includes('enable-gpu-rasterization'), 'main.js must enable GPU rasterization');
assert(mainSrc.includes('backgroundThrottling: true'), 'main.js must enable backgroundThrottling for energy saving');

// preload.js: 电源状态变更通知与地理编码直通
assert(preloadSrc.includes('onPowerStateChange'), 'preload.js must expose onPowerStateChange');
assert(preloadSrc.includes('searchLocation'), 'preload.js must expose searchLocation');

// app.js: 6000 片 DEM 高程网格缓存 + 6000 片矢量缓存 + 8 个解码线程 + 2 级超前预取
assert(appSrc.includes('demCache: 6000'), 'app.js must allocate 6000 DEM tile cache in desktop mode');
assert(appSrc.includes('tileCache: 6000'), 'app.js must allocate 6000 vector tile cache in desktop mode');
assert(appSrc.includes('prefetch: 2'), 'app.js must enable prefetch 2 in desktop mode');
assert(appSrc.includes('onPowerStateChange'), 'app.js must handle onPowerStateChange');

// 语法检查
new Function(appSrc);
new Function(mainSrc);
new Function(preloadSrc);
console.log('✓ All static checks passed!\n');

// 2. 动态实机测试 (Electron)
console.log('--- 2. Dynamic Electron Runtime Verification ---');
const { ipcMain } = require('electron');

// 注册必须的 IPC 处理器 (模拟 main.js 中已实现的完整服务)
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, demCount: 100, satCount: 0, vectorCount: 100, fontCount: 10, totalTiles: 210, totalBytes: 1024000 }));
ipcMain.handle('get-offline-manifest', () => ({}));
ipcMain.handle('get-cloud-sync-config', () => ({}));
ipcMain.handle('search-location', async (event, query) => {
  const q = (query || '').trim();
  if (!q) return { type: 'FeatureCollection', features: [] };
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=73.5,18.0,135.1,53.6&limit=10`;
    const resp = await fetch(photonUrl, {
      signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'Outmap/1.3.9' }
    });
    if (resp.ok) return await resp.json();
  } catch (e) {}
  return { type: 'FeatureCollection', features: [] };
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });


  await win.loadFile(path.join(__dirname, '../src/index.html'));
  await new Promise(r => setTimeout(r, 2600));

  const result = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const logs = {};
      const m = window.mapInstance;

      // Test A: 检查高分屏光标 CSS 变量
      const rootStyle = getComputedStyle(document.documentElement);
      logs.cursorGrab = rootStyle.getPropertyValue('--cursor-grab').includes('svg');
      logs.cursorGrabbing = rootStyle.getPropertyValue('--cursor-grabbing').includes('svg');
      logs.cursorCrosshair = rootStyle.getPropertyValue('--cursor-crosshair').includes('svg');

      // Test B: 离线下载界面
      const btnDl = document.getElementById('btn-open-pyramid-dl');
      if (btnDl) btnDl.click();
      await new Promise(r => setTimeout(r, 600));

      const modalOverlay = document.getElementById('pyramid-modal');
      const isModalVisible = modalOverlay && modalOverlay.style.display !== 'none';
      const overlayZIndex = modalOverlay ? getComputedStyle(modalOverlay).zIndex : null;

      const checkedProvBoxes = Array.from(document.querySelectorAll('.prov-grid-box input[type="checkbox"]:checked'));
      logs.modalZIndex = overlayZIndex;
      logs.checkedProvCount = checkedProvBoxes.length;

      const btnCloseDl = document.getElementById('btn-close-pyramid-modal');
      if (btnCloseDl) btnCloseDl.click();
      await new Promise(r => setTimeout(r, 300));

      // Test C: 路线规划 - 无终点时以最后一个途径点为终点
      const btnFabRoute = document.getElementById('btn-fab-route');
      if (btnFabRoute) btnFabRoute.click();
      await new Promise(r => setTimeout(r, 400));

      const btnClearRoute = document.getElementById('btn-clear-route');
      if (btnClearRoute) btnClearRoute.click();
      await new Promise(r => setTimeout(r, 200));

      if (typeof window.setRouteStartPoint === 'function') {
        window.setRouteStartPoint(m, [104.0668, 30.5728], '成都市', 14.8);
      }
      if (typeof window.addViaPoint === 'function') {
        window.addViaPoint(m, [106.2309, 38.4872], '银川市 (途径点当作终点)', 14.8);
      }
      await new Promise(r => setTimeout(r, 400));

      const btnCalc = document.getElementById('btn-calc-route');
      if (btnCalc) btnCalc.click();
      await new Promise(r => setTimeout(r, 1800));

      const btnDetails = document.getElementById('btn-route-details-toggle');
      if (btnDetails) btnDetails.click();
      await new Promise(r => setTimeout(r, 300));

      const distEl = document.getElementById('stat-route-dist');
      logs.routePlannedWithoutEnd = Boolean(distEl && distEl.innerText && !distEl.innerText.includes('--'));
      logs.distanceText = distEl ? distEl.innerText : '';

      // Test D: 标记可见性
      const markers = Array.from(document.querySelectorAll('.maplibregl-marker')).map(el => {
        return {
          text: el.innerText.trim(),
          display: getComputedStyle(el).display,
          opacity: getComputedStyle(el).opacity,
          transform: el.style.transform
        };
      });
      logs.markers = markers;
      logs.hasStartMarker = markers.some(mk => mk.text.includes('起'));
      logs.hasViaOrEndMarker = markers.some(mk => mk.text.includes('1') || mk.text.includes('终'));

      // Test E: 途径点点击跳转层级
      const viaBadges = Array.from(document.querySelectorAll('#route-via-list .pt-tag'));
      if (viaBadges.length > 0) {
        viaBadges[0].click();
        await new Promise(r => setTimeout(r, 1200));
        logs.viaJumpZoom = m.getZoom();
      }


      // Test F: 搜索功能
      const searchRes1 = await window.queryLocationCandidates('银川');
      const searchRes2 = await window.queryLocationCandidates('万象城');
      logs.searchYinchuanCount = searchRes1 ? searchRes1.length : 0;
      logs.searchWanxiangchengCount = searchRes2 ? searchRes2.length : 0;
      logs.firstYinchuanName = searchRes1 && searchRes1[0] ? searchRes1[0].name : '';
      logs.firstWanxiangName = searchRes2 && searchRes2[0] ? searchRes2[0].name : '';

      resolve(logs);
    });
  `);

  console.log('RUNTIME TEST RESULTS:\n' + JSON.stringify(result, null, 2));

  assert.strictEqual(result.cursorGrab, true, 'CSS --cursor-grab must contain valid SVG');
  assert.strictEqual(result.cursorGrabbing, true, 'CSS --cursor-grabbing must contain valid SVG');
  assert.strictEqual(result.cursorCrosshair, true, 'CSS --cursor-crosshair must contain valid SVG');
  assert.strictEqual(result.modalZIndex, '30000', 'Modal overlay z-index must be 30000');
  assert(result.checkedProvCount <= 1, `Checked provinces in offline modal must be <= 1 (current province), got ${result.checkedProvCount}`);
  assert.strictEqual(result.routePlannedWithoutEnd, true, 'Route must successfully plan without explicit end point');
  assert(result.distanceText.length > 0 && !result.distanceText.includes('0.0'), `Distance must be calculated, got: ${result.distanceText}`);
  assert.strictEqual(result.hasStartMarker, true, 'Start marker must exist and be visible');
  assert.strictEqual(result.hasViaOrEndMarker, true, 'Via/End marker for Yinchuan must exist and be visible');
  assert(Math.abs(result.viaJumpZoom - 14.8) < 0.35 || Math.abs(result.viaJumpZoom - 15.0) < 0.35, `Via point jump target zoom must be ~14.8, got ${result.viaJumpZoom}`);
  assert(result.searchYinchuanCount > 0, 'Search for 银川 must return results');
  assert(result.searchWanxiangchengCount > 0, 'Search for 万象城 must return results');

  console.log('\n🎉 ALL v1.3.9 PERFORMANCE ASSERTIONS PASSED SUCCESSFULLY!');
  app.quit();
});

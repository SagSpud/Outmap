const { app, BrowserWindow } = require('electron');
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
console.log('--- 1. Static Configuration & Code Assertions ---');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainSrc = fs.readFileSync('main.js', 'utf8');
const preloadSrc = fs.readFileSync('preload.js', 'utf8');
const appSrc = fs.readFileSync('src/app.js', 'utf8');
const htmlSrc = fs.readFileSync('src/index.html', 'utf8');
const cssSrc = fs.readFileSync('src/style.css', 'utf8');

// 版本号检查
assert.strictEqual(pkg.version, '1.3.8', 'package.json version must be 1.3.8');
assert(htmlSrc.includes('app.js?v=1.3.8'), 'index.html must reference app.js?v=1.3.8');
assert(htmlSrc.includes('style.css?v=1.3.8'), 'index.html must reference style.css?v=1.3.8');

// main.js: 禁用 --max-reduce-memory (杜绝 V8 频繁同步垃圾回收卡顿)
assert(!mainSrc.includes('--max-reduce-memory'), 'main.js must NOT have --max-reduce-memory switch');

// main.js: scanProvincesFromDisk 必须检查瓦片数量与层级阈值 (杜绝 1 片浏览瓦片把 33 省全标为 maxZ=10)
assert(mainSrc.includes('count >= minThreshold') && mainSrc.includes('minThreshold = z <= 9 ? 30 : 60'), 'scanProvincesFromDisk must verify minThreshold');

// style.css: 高分屏光标与图层层级
assert(cssSrc.includes('--cursor-grab: url('), 'style.css must define --cursor-grab SVG');
assert(cssSrc.includes('--cursor-grabbing: url('), 'style.css must define --cursor-grabbing SVG');
assert(cssSrc.includes('--cursor-crosshair: url('), 'style.css must define --cursor-crosshair SVG');
assert(cssSrc.includes('z-index: 30000 !important;'), 'style.css must set .modal-overlay z-index to 30000 !important');
assert(cssSrc.includes('z-index: 1000;'), 'style.css must set .landing-card z-index to 1000');
assert(cssSrc.includes('.via-drag-handle') && cssSrc.includes('var(--cursor-grab)'), 'via-drag-handle must use --cursor-grab');

// app.js: 地形与标记点高程吸附、原生 padding、无终点支持
assert(appSrc.includes('refreshAllRouteMarkersElevation'), 'app.js must provide refreshAllRouteMarkersElevation');
assert(appSrc.includes('lastVia.name'), 'app.js must support last via as end point in autoPlanMultiPointRoute');
assert(appSrc.includes('center: [lng, lat]') && appSrc.includes('padding: cameraPadding'), 'flyToLocationPrecisely must use native center + padding');
assert(!appSrc.includes('map.resize();\n    map.flyTo('), 'flyToLocationPrecisely must not force map.resize() before flyTo');

// 语法检查
new Function(appSrc);
new Function(mainSrc);
new Function(preloadSrc);
console.log('✓ All static checks passed!\n');

// 2. 动态实机测试 (Electron)
console.log('--- 2. Dynamic Electron Runtime Verification ---');
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

      // Test B: 离线下载界面 (验证默认单选当前省份，而非 33 省全选)
      const btnDl = document.getElementById('btn-open-pyramid-dl');
      if (btnDl) btnDl.click();
      await new Promise(r => setTimeout(r, 600));

      const modalOverlay = document.getElementById('pyramid-modal');
      const isModalVisible = modalOverlay && modalOverlay.style.display !== 'none';
      const overlayZIndex = modalOverlay ? getComputedStyle(modalOverlay).zIndex : null;

      // 统计已勾选的省份复选框数量
      const checkedProvBoxes = Array.from(document.querySelectorAll('.prov-grid-box input[type="checkbox"]:checked'));
      logs.modalZIndex = overlayZIndex;
      logs.checkedProvCount = checkedProvBoxes.length;

      // 关闭离线下载面板
      const btnCloseDl = document.getElementById('btn-close-pyramid-modal');
      if (btnCloseDl) btnCloseDl.click();
      await new Promise(r => setTimeout(r, 300));

      // Test C: 路线规划 - 无终点时以最后一个途径点为终点
      const btnFabRoute = document.getElementById('btn-fab-route');
      if (btnFabRoute) btnFabRoute.click();
      await new Promise(r => setTimeout(r, 400));

      // 清空路线
      const btnClearRoute = document.getElementById('btn-clear-route');
      if (btnClearRoute) btnClearRoute.click();
      await new Promise(r => setTimeout(r, 200));

      // 设置起点: 成都市
      if (typeof window.setRouteStartPoint === 'function') {
        window.setRouteStartPoint(m, [104.0668, 30.5728], '成都市', 15.0);
      }
      // 设置途径点: 银川市 (海拔 1110m, 无终点!)
      if (typeof window.addViaPoint === 'function') {
        window.addViaPoint(m, [106.2309, 38.4872], '银川市 (途径点当作终点)', 15.0);
      }
      await new Promise(r => setTimeout(r, 400));

      // 点击规划按钮
      const btnCalc = document.getElementById('btn-calc-route');
      if (btnCalc) btnCalc.click();
      await new Promise(r => setTimeout(r, 1800));

      const btnDetails = document.getElementById('btn-route-details-toggle');
      if (btnDetails) btnDetails.click();
      await new Promise(r => setTimeout(r, 300));

      const distEl = document.getElementById('stat-route-dist');
      const statsBox = document.getElementById('route-stats-box');
      logs.routePlannedWithoutEnd = Boolean(distEl && distEl.innerText && !distEl.innerText.includes('--'));
      logs.distanceText = distEl ? distEl.innerText : '';

      // Test D: 银川途径点标记可见性与高程更新
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
      const viaBadges = Array.from(document.querySelectorAll('.pt-tag.via'));
      if (viaBadges.length > 0) {
        viaBadges[0].click();
        await new Promise(r => setTimeout(r, 1000));
        logs.viaJumpZoom = m.getZoom();
      }

      resolve(logs);
    });
  `);

  console.log('RUNTIME TEST RESULTS:\n' + JSON.stringify(result, null, 2));

  // 断言验证
  assert.strictEqual(result.cursorGrab, true, 'CSS --cursor-grab must contain valid SVG');
  assert.strictEqual(result.cursorGrabbing, true, 'CSS --cursor-grabbing must contain valid SVG');
  assert.strictEqual(result.cursorCrosshair, true, 'CSS --cursor-crosshair must contain valid SVG');

  assert.strictEqual(result.modalZIndex, '30000', 'Modal overlay z-index must be 30000');
  assert(result.checkedProvCount <= 1, `Checked provinces in offline modal must be <= 1 (current province), got ${result.checkedProvCount}`);

  assert.strictEqual(result.routePlannedWithoutEnd, true, 'Route must successfully plan without explicit end point');
  assert(result.distanceText.length > 0 && !result.distanceText.includes('0.0'), `Distance must be calculated, got: ${result.distanceText}`);
  assert.strictEqual(result.hasStartMarker, true, 'Start marker must exist and be visible');
  assert.strictEqual(result.hasViaOrEndMarker, true, 'Via/End marker for Yinchuan must exist and be visible');
  assert(Math.abs(result.viaJumpZoom - 15.0) < 0.25, `Via point jump target zoom must be ~15.0, got ${result.viaJumpZoom}`);

  console.log('\n🎉 ALL v1.3.8 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  app.quit();
});

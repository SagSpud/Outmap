const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appJsText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const perfJsText = fs.readFileSync(path.join(root, 'src/map-performance.js'), 'utf8');

// 1. 静态语法编译验证
new vm.Script(appJsText, { filename: 'src/app.js' });
new vm.Script(perfJsText, { filename: 'src/map-performance.js' });

// 30秒看门狗防卡死保护
const watchdog = setTimeout(() => {
  console.error('Test timed out (watchdog fired)');
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 720,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });

    await win.loadFile(path.join(root, 'src/index.html'));

    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const check = (ok, msg) => { if (!ok) throw new Error(msg); };

      // 等待地图基础引擎加载就绪
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'Map style did not initialize');

      // 1. 验证版本号
      check(window.OUTMAP_APP_VERSION === '1.9.42', 'Version mismatch: ' + window.OUTMAP_APP_VERSION);

      // 2. 验证拖动缩放运动期间，devicePixelRatio 绝不动态降级 (杜绝画布 resize 引起的图层消失闪烁)
      const initialDpr = typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : 1;
      map.fire('movestart');
      for (let i = 0; i < 10; i++) {
        map.fire('render');
        await sleep(15);
      }
      const movingDpr = typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : 1;
      check(movingDpr === initialDpr, 'DPR must remain 100% native during movement, got: ' + movingDpr + ' vs ' + initialDpr);

      map.fire('moveend');
      await sleep(220);
      const settledDpr = typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : 1;
      check(settledDpr === initialDpr, 'DPR must remain unchanged after moveend');

      // 3. 验证关键图标图层在运动中保持可见状态 (绝不被设置为 visibility: none 或透明度 0)
      const testLayers = ['osm-all-pois', 'osm-all-pois-dots', 'outmap-favorite-icons'];
      for (const lyrId of testLayers) {
        if (map.getLayer(lyrId)) {
          const vis = map.getLayoutProperty(lyrId, 'visibility');
          check(vis !== 'none', 'Layer ' + lyrId + ' must never be hidden during motion');
        }
      }

      // 4. 验证 controller.setLongFlight 不会隐藏任何 POI/图标
      if (window.OutmapMapPerformance?.create) {
        const ctrl = window.OutmapMapPerformance.create(map);
        ctrl.setLongFlight(true);
        for (const lyrId of testLayers) {
          if (map.getLayer(lyrId)) {
            const vis = map.getLayoutProperty(lyrId, 'visibility');
            check(vis !== 'none', 'Layer ' + lyrId + ' must remain visible during long flight');
          }
        }
        ctrl.setLongFlight(false);
      }

      return {
        versionChecked: true,
        dprNeverDegraded: true,
        iconLayersAlwaysVisible: true,
        longFlightNoHiding: true
      };
    })()`);

    console.log('v1.9.42 motion icon layer stability regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (err) {
    console.error('v1.9.42 test failed:', err);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

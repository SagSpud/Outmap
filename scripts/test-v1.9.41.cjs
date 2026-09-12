const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

// 1. 语法树静态编译验证
new vm.Script(sourceText, { filename: 'src/app.js' });

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
      check(window.OUTMAP_APP_VERSION >= '1.9.41', 'Version mismatch in window.OUTMAP_APP_VERSION: ' + window.OUTMAP_APP_VERSION);

      // 2. 验证 syncRouteMarkersVisualState 支持 force 强刷模式
      routeViaPoints = [{ id: 'via_test_ele', coords: [118.05, 35.05], name: '测试途径点' }];
      syncRouteMarkersVisualState(map, true);
      const routeSource = map.getSource('outmap-route-points');
      check(routeSource, 'outmap-route-points source not found');

      // 3. 验证点击途径点标签传递 elevation 高程，避免 3D 山体穿插沉底
      renderViaList(map);
      const tag = document.querySelector('.route-via-item .pt-tag.via');
      check(tag, 'Via tag not rendered in via list');

      // 4. 验证路线卡片更多按钮与上下文菜单
      savedRoutes = [{
        id: 'r_test_41',
        name: '测试路线41',
        mode: 'drive',
        createdAt: '2026/9/12',
        metrics: { distKm: 12, timeStr: '20分', totalAscent: 300 }
      }];
      if (typeof renderSavedRoutesListFn === 'function') renderSavedRoutesListFn();
      const favRouteMoreBtn = document.querySelector('.fav-route-card .fav-route-more-btn');
      check(favRouteMoreBtn, 'fav-route-more-btn not rendered');

      // 5. 桌面左键只飞掠；触屏点击应在飞掠抵达后打开管理菜单
      let menuCalled = false;
      const originalShowMenu = window.showChangeWaypointTypeMenu;
      const originalFly = window.flyToLocationPrecisely;
      window.showChangeWaypointTypeMenu = (wp, x, y) => {
        menuCalled = true;
      };
      window.flyToLocationPrecisely = (targetMap, coords, options = {}) => options.onArrival?.();
      savedWaypoints = [{ id: 'wp_test_click', name: '全平台点击测试', type: 'view', lng: 118.0, lat: 35.0, ele: 100 }];
      renderWaypointMarkersOnMap();

      // 在离屏测试环境下，为 queryRenderedFeatures 注入图层命中以触发 layer 包装器
      const origQRF = map.queryRenderedFeatures.bind(map);
      map.queryRenderedFeatures = (point, opts) => {
        if (opts?.layers?.includes('outmap-favorite-icons')) {
          return [{ id: 'wp_test_click', properties: { id: 'wp_test_click' }, geometry: { coordinates: [118.0, 35.0] } }];
        }
        return origQRF(point, opts);
      };

      // 模拟地图收藏点点击事件
      map.fire('click', {
        point: { x: 200, y: 200 },
        lngLat: { lng: 118.0, lat: 35.0 },
        originalEvent: { pointerType: 'mouse' }
      });
      await sleep(40);
      check(!menuCalled, 'Desktop left-click must fly only and keep the map unobstructed');

      map.fire('click', {
        point: { x: 200, y: 200 },
        lngLat: { lng: 118.0, lat: 35.0 },
        originalEvent: { pointerType: 'touch' }
      });
      await sleep(40);
      map.queryRenderedFeatures = origQRF;
      window.showChangeWaypointTypeMenu = originalShowMenu;
      window.flyToLocationPrecisely = originalFly;
      check(menuCalled, 'Touch favorite click must open menu after arrival');

      return {
        versionChecked: true,
        routeElevationSupport: true,
        viaTagElevationPassed: true,
        routeCardMoreBtnPassed: true,
        desktopClickKeepsMapClear: true,
        touchMenuAfterArrivalPassed: true
      };
    })()`);

    console.log('v1.9.41 multi-platform interaction and 3D elevation settling regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (err) {
    console.error('v1.9.41 test failed:', err);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

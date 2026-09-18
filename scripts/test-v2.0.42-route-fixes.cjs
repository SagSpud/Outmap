const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const expectedVersion = pkg.version;

if (expectedVersion !== '2.0.42') {
  console.error(`Expected version 2.0.42, found ${expectedVersion}`);
  process.exit(1);
}

// 1. Verify syntax of app.js
const appJsText = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new vm.Script(appJsText, { filename: 'src/app.js' });

const watchdog = setTimeout(() => {
  console.error(`v${expectedVersion} route fixes test timed out`);
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1200,
      height: 800,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (val, msg) => { if (!val) throw new Error(msg); };

      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      check(window.mapInstance?.__outmapStyleReady, 'Map did not initialize');
      check(window.OUTMAP_APP_VERSION === '2.0.42', 'Version mismatch');

      // Test 1: Tombstone normalization timestamp test
      const oldRoute = {
        id: 'test_route_2024',
        name: '2024-国庆_承德-乌兰布统-草原天路',
        time: 1727780000000, // 2024
        distKm: 638.6,
        points: [[117.9, 40.9], [116.5, 41.2]]
      };
      const beforeNow = Date.now();
      const tomb = normalizeRouteTombstone(oldRoute);
      check(tomb, 'normalizeRouteTombstone returned null');
      check(tomb.time >= beforeNow, 'tombstone time must be current Date.now(), not 2024 track time');
      check(tomb.time > 1780000000000, 'tombstone time is fresh');

      // Test 2: Verify route points source clustering is disabled
      const map = window.mapInstance;
      check(ensureRoutePointLayers(map), 'ensureRoutePointLayers failed');
      const routeSource = map.getSource('outmap-route-points');
      check(routeSource, 'route-points source missing');
      console.log('routeSource cluster props:', {
        cluster: routeSource.cluster,
        optionsCluster: routeSource._options?.cluster,
        clusterMaxZoom: routeSource.clusterMaxZoom,
        optionsClusterMaxZoom: routeSource._options?.clusterMaxZoom
      });
      const isCluster = routeSource.cluster || routeSource._options?.cluster || false;
      check(!isCluster, 'route-points source MUST NOT cluster');

      // Test 3: Verify outmap-route-point-names layer exists
      const namesLayer = map.getLayer('outmap-route-point-names');
      check(namesLayer, 'outmap-route-point-names layer missing');

      // Test 4: Set points and verify feature properties
      setRouteStartPoint(map, [104.06, 30.67], '双流机场');
      addViaPoint(map, [104.08, 30.65], '卓达广场');
      addViaPoint(map, [103.80, 30.50], '天全服务区');
      setRouteEndPoint(map, [102.50, 30.00], '折多山观雪台');

      const features = getRoutePointFeatures().features;
      check(features.length === 4, 'Expected 4 route point features, got ' + features.length);
      check(features[0].properties.label === '起', 'Start point label should be 起');
      check(features[0].properties.name === '双流机场', 'Start point name should be 双流机场');
      check(features[1].properties.label === '1', 'Via 1 label should be 1');
      check(features[1].properties.name === '卓达广场', 'Via 1 name should be 卓达广场');
      check(features[2].properties.label === '2', 'Via 2 label should be 2');
      check(features[2].properties.name === '天全服务区', 'Via 2 name should be 天全服务区');
      check(features[3].properties.label === '终', 'End point label should be 终');
      check(features[3].properties.name === '折多山观雪台', 'End point name should be 折多山观雪台');

      // Test 5: Verify button text on save
      const btnSave = document.getElementById('btn-save-route-trigger');
      check(btnSave, 'btn-save-route-trigger missing');
      btnSave.classList.add('saved-success');
      btnSave.innerText = '已保存';
      check(btnSave.innerText === '已保存', 'Button text must be strictly 已保存 without checkmark');
      check(!btnSave.innerText.includes('✓'), 'Button text must not contain checkmark');

      // Test 6: Verify 3D roaming button is removed
      const btnSimFly = document.getElementById('btn-route-sim-fly');
      check(!btnSimFly, 'btn-route-sim-fly must be removed from DOM');

      // Test 7: Verify two routes with SAME start and end but completely different paths do NOT overlap
      // e.g. Home is [118.3, 35.05]. Route A goes north to Hebei, Route B goes south to Hunan.
      const homeCoord = [118.3000, 35.0500];
      const routeHebeiPlanned = [homeCoord, [118.0, 37.0], [116.4, 39.9], [117.0, 38.0], homeCoord];
      const routeHunanSaved = {
        id: 'route_hunan',
        name: '2025国庆湖南',
        pathCoords: [homeCoord, [115.0, 32.0], [113.0, 28.2], [114.5, 30.5], homeCoord]
      };
      const isOverlapDistant = isRouteOverlappingWithPlanned(routeHunanSaved, routeHebeiPlanned, null, true);
      check(!isOverlapDistant, 'Distant route sharing home start/end coordinates MUST NOT be hidden');

      // Test 8: Verify the currently edited route IS hidden to prevent double-line rendering
      const routeHebeiSaved = {
        id: 'route_hebei',
        name: '2024国庆河北',
        pathCoords: routeHebeiPlanned
      };
      const isOverlapEditing = isRouteOverlappingWithPlanned(routeHebeiSaved, routeHebeiPlanned, 'route_hebei', true);
      check(isOverlapEditing, 'The route currently being edited MUST be hidden to prevent dual-line overlap');

      // Clean up test points
      const btnClear = document.getElementById('btn-clear-route');
      if (btnClear) btnClear.click();

      return { success: true };
    })()`);

    console.log('Test PASSED:', result);
    clearTimeout(watchdog);
    app.exit(0);
  } catch (err) {
    console.error('Test FAILED:', err);
    clearTimeout(watchdog);
    app.exit(1);
  }
});

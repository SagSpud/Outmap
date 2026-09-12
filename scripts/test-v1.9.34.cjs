const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });
assert(sourceText.includes('getVisibleRoutePointCoordinateKeys'), 'cross-source route/favorite dedupe missing');
assert(sourceText.includes("'#14b8a6', 10, '#0d9488', 30, '#0f766e'"), 'favorite clusters need a distinct semantic palette');

const watchdog = setTimeout(() => app.exit(1), 40000);
app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({ show: false, width: 1000, height: 720,
      webPreferences: { offscreen: true, backgroundThrottling: false } });
    await win.loadFile(path.join(root, 'src/index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'map did not initialize');

      routeStartCoord = [118, 35]; routeStartName = '起点';
      routeViaPoints = [
        { id: 'dedupe-via-1', coords: [118.01, 35.01], name: '途径1', marker: null },
        { id: 'dedupe-via-2', coords: [118.02, 35.02], name: '途径2', marker: null }
      ];
      routeEndCoord = [118.03, 35.03]; routeEndName = '终点';
      savedWaypoints = [
        { id: 'fav-start-copy', lng: 118, lat: 35, name: '起点副本', type: 'view' },
        { id: 'fav-via-copy', lng: 118.01, lat: 35.01, name: '途径副本', type: 'view' },
        { id: 'fav-nearby-real', lng: 118.01003, lat: 35.01003, name: '相邻真实地点', type: 'view' },
        { id: 'fav-unrelated', lng: 119, lat: 36, name: '普通收藏', type: 'view' }
      ];

      routePointLayersVisible = true;
      syncRouteMarkersVisualState(map);
      await sleep(250);
      const source = map.getSource(FAVORITES_SOURCE_ID);
      const visibleWithRoute = (await source.getData()).features.map(feature => feature.properties.id).sort();
      check(!visibleWithRoute.includes('fav-start-copy') && !visibleWithRoute.includes('fav-via-copy'), 'route duplicates remained in favorite source');
      check(visibleWithRoute.includes('fav-nearby-real') && visibleWithRoute.includes('fav-unrelated'), 'nonduplicate favorites were hidden');

      routePointLayersVisible = false;
      syncRouteMarkersVisualState(map);
      await sleep(250);
      const visibleWithoutRoute = (await source.getData()).features.map(feature => feature.properties.id).sort();
      check(visibleWithoutRoute.length === savedWaypoints.length, 'favorites did not restore when route layer was hidden');
      clearTimeout(routePlanTimer);
      return { visibleWithRoute, restoredCount: visibleWithoutRoute.length, savedCount: savedWaypoints.length };
    })()`);
    assert.strictEqual(result.restoredCount, result.savedCount);
    console.log('1.9.34 cross-source clustering regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(watchdog);
    win?.destroy();
    app.exit(1);
  }
});

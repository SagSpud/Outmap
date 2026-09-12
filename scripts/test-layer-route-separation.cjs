const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const watchdog = setTimeout(() => app.exit(1), 45000);

for (const [channel, value] of [
  ['get-tile-server-info', { port: 28795, totalTiles: 0, totalBytes: 0 }],
  ['get-offline-manifest', { inventoryVersion: 4, stats: {}, provinces: {} }],
  ['get-cloud-sync-config', { autoSync: false }],
  ['save-cloud-sync-config', { success: true }],
  ['rescan-offline-tiles', { totalTiles: 0, totalBytes: 0 }],
  ['pull-cloud-sync-data', { success: true, data: null }],
  ['upload-cloud-sync-data', { success: true }],
  ['save-offline-manifest', { success: true }],
  ['search-location', { type: 'FeatureCollection', features: [] }]
]) ipcMain.handle(channel, () => value);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1200,
      height: 800,
      webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true }
    });
    await win.loadFile(path.join(root, 'src', 'index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      if (!map?.__outmapStyleReady) throw new Error('map style did not initialize');
      const savedToggle = document.getElementById('layer-toggle-saved-routes');
      const plannedToggle = document.getElementById('layer-toggle-planned-route');

      savedRoutes = [{ id: 'saved-one', name: '蓝色收藏路线', pathCoords: [[118, 35], [118.1, 35.1]] }];
      window.renderSavedRoutesOnMap(map);
      for (let i = 0; i < 100 && !map.getLayer('outmap-saved-route-line'); i++) await sleep(20);
      if (!map.getLayer('outmap-saved-route-line')) throw new Error('saved route layer was not created');
      window.displayImportedTrack(map, {
        name: '绿色规划路线', coords: [[118, 35], [118.1, 35.1]],
        start: { name: '起点', coords: [118, 35] }, end: { name: '终点', coords: [118.1, 35.1] }, viaPoints: []
      });
      await sleep(100);
      const initial = {
        savedChecked: savedToggle.checked,
        plannedChecked: plannedToggle.checked,
        savedVisibility: map.getLayoutProperty('outmap-saved-route-line', 'visibility'),
        plannedVisibility: map.getLayoutProperty('outdoor-route-line', 'visibility')
      };

      plannedToggle.checked = false;
      plannedToggle.dispatchEvent(new Event('change'));
      const plannedHidden = map.getLayoutProperty('outdoor-route-line', 'visibility') === 'none'
        && map.getLayoutProperty('outmap-route-point-circles', 'visibility') === 'none';
      const savedStillHidden = map.getLayoutProperty('outmap-saved-route-line', 'visibility') === 'none';

      savedToggle.checked = true;
      savedToggle.dispatchEvent(new Event('change'));
      const savedVisible = map.getLayoutProperty('outmap-saved-route-line', 'visibility') === 'visible';
      const plannedStillHidden = map.getLayoutProperty('outdoor-route-line', 'visibility') === 'none';

      return {
        initial, plannedHidden, savedStillHidden, savedVisible, plannedStillHidden,
        terrainToggleAbsent: !document.getElementById('layer-toggle-terrain'),
        view3dPresent: !!document.getElementById('btn-3d-toggle'),
        labels: [...document.querySelectorAll('#layers-popover .layer-toggle-label span:last-child')].map(el => el.textContent.trim()),
        favoritesRouteTab: document.querySelector('.fav-main-tab[data-tab="routes"]')?.textContent.replace(/\\s+/g, ' ').trim()
      };
    })()`);

    assert.strictEqual(result.initial.savedChecked, false, 'saved routes must default off');
    assert.strictEqual(result.initial.plannedChecked, true, 'current planned route must default on');
    assert.strictEqual(result.initial.savedVisibility, 'none');
    assert.notStrictEqual(result.initial.plannedVisibility, 'none');
    assert(result.plannedHidden && result.savedStillHidden, 'planned toggle must control only the current route');
    assert(result.savedVisible && result.plannedStillHidden, 'saved toggle must control only saved routes');
    assert(result.terrainToggleAbsent && result.view3dPresent, 'duplicate terrain toggle must be removed while 2D/3D remains');
    assert.deepStrictEqual(result.labels, ['收藏地点', '收藏路线', '规划路线']);
    assert(result.favoritesRouteTab.startsWith('收藏路线'));
    console.log('Layer route separation and 3D control regression passed:', result);
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

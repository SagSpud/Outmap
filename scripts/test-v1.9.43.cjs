const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const htmlText = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });

const staticChecks = [
  [!htmlText.includes('map-performance.js'), 'retired map-performance script must not be loaded'],
  [!sourceText.includes('OutmapMapPerformance'), 'retired performance controller must not remain in app.js'],
  [/const pointLayers = \['outmap-route-point-circles'\]/.test(sourceText), 'route point events must bind only to circle hit layer'],
  [/if \(!moved\) \{[\s\S]*?beginVisualDrag\(\)/.test(sourceText), 'DOM drag marker must be lazy-created after movement'],
  [/cloudSyncDebounceTimer = null;[\s\S]*?const runSync = async \(\) => \{\s*cloudSyncDebounceTimer = null;/.test(sourceText),
    'cloud sync timer must be cleared before and when running'],
  [/folderTabOrderUpdatedAt: syncedUi\.folderTabOrderUpdatedAt/.test(sourceText), 'folder-order timestamp must be synced'],
  [/builtinTabNamesUpdatedAt: syncedUi\.builtinTabNamesUpdatedAt/.test(sourceText), 'built-in tab names timestamp must be synced']
];
for (const [ok, message] of staticChecks) if (!ok) throw new Error(message);

const watchdog = setTimeout(() => {
  console.error('Test timed out (watchdog fired)');
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({ show: false, width: 1100, height: 760,
      webPreferences: { offscreen: true, backgroundThrottling: false } });
    await win.loadFile(path.join(root, 'src/index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'Map style did not initialize');
      check(Number(window.OUTMAP_APP_VERSION.split('.')[2]) >= 43, 'Version mismatch: ' + window.OUTMAP_APP_VERSION);

      const localPoint = { id: 'near_a', name: '东门', lng: 118, lat: 35, updatedAt: 10 };
      const cloudPoint = { id: 'near_b', name: '停车点', lng: 118.00001, lat: 35.00001, updatedAt: 20 };
      check(mergeWaypoints([localPoint], [cloudPoint], []).length === 2,
        'nearby independent favorites were incorrectly merged');
      const renamed = mergeWaypoints([localPoint], [{ ...localPoint, name: '新名称', updatedAt: 30 }], []);
      check(renamed.length === 1 && renamed[0].name === '新名称', 'same-id LWW merge failed');

      localStorage.setItem('outmap_folder_tab_order', JSON.stringify(['old']));
      localStorage.setItem('outmap_folder_tab_order_updated_at', '10');
      localStorage.setItem('outmap_builtin_tab_names', JSON.stringify({ default: '旧名称' }));
      localStorage.setItem('outmap_builtin_tab_names_updated_at', '10');
      const syncedUi = mergeSyncedUiMetadata({
        folderTabOrder: ['new'], folderTabOrderUpdatedAt: 50,
        builtinTabNames: { default: '云端名称' }, builtinTabNamesUpdatedAt: 60
      });
      check(syncedUi.changed && syncedUi.folderTabOrder[0] === 'new', 'newer cloud folder order was not applied');
      check(syncedUi.builtinTabNames.default === '云端名称', 'newer cloud built-in name was not applied');
      check(localStorage.getItem('outmap_folder_tab_order_updated_at') === '50', 'folder timestamp drifted while pulling');
      localStorage.setItem('outmap_folder_tab_order', JSON.stringify(['legacy-local']));
      localStorage.removeItem('outmap_folder_tab_order_updated_at');
      const legacyUi = mergeSyncedUiMetadata({ folderTabOrder: ['legacy-cloud'] });
      check(legacyUi.folderTabOrder[0] === 'legacy-cloud', 'legacy cloud metadata did not converge on first upgraded sync');

      routeViaPoints = [{ id: 'terrain_refresh', coords: [118, 35], name: '途经点' }];
      const originalSyncMarkers = window.syncRouteMarkersVisualState;
      let refreshCount = 0;
      let favoritesTouched = false;
      window.syncRouteMarkersVisualState = (targetMap, force, syncFavorites) => {
        refreshCount += 1;
        favoritesTouched ||= syncFavorites !== false;
      };
      scheduleRouteMarkerElevationRefresh(map, 8);
      scheduleRouteMarkerElevationRefresh(map, 8);
      scheduleRouteMarkerElevationRefresh(map, 8);
      await sleep(80);
      window.syncRouteMarkersVisualState = originalSyncMarkers;
      check(refreshCount === 1, 'terrain refresh signals were not coalesced: ' + refreshCount);
      check(!favoritesTouched, 'terrain-only refresh serialized the favorites source');

      savedRoutes = [{ id: 'long_press_route', name: '长按路线', mode: 'drive', pathCoords: [[118, 35], [118.1, 35.1]], metrics: {} }];
      let routeLoadCount = 0;
      const originalLoadRoute = window.loadSavedRoute;
      window.loadSavedRoute = () => { routeLoadCount += 1; };
      renderSavedRoutesListFn();
      const routeCard = document.querySelector('.fav-route-card');
      check(routeCard, 'saved route card was not rendered');
      const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(touchStart, 'touches', { value: [{ clientX: 120, clientY: 120 }] });
      routeCard.dispatchEvent(touchStart);
      await sleep(480);
      routeCard.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(20);
      window.loadSavedRoute = originalLoadRoute;
      check(routeLoadCount === 0, 'long-press compatibility click unexpectedly loaded the route');
      document.querySelectorAll('.fav-route-context-menu').forEach(node => node.remove());

      return { nearbyFavoritesPreserved: true, metadataLwwPassed: true,
        terrainRefreshCoalesced: true, routeLongPressClickSuppressed: true };
    })()`);
    console.log('v1.9.43 performance and interaction regressions passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('v1.9.43 test failed:', error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

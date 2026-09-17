const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const expectedVersion = require(path.join(root, 'package.json')).version;
const sourceText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });

const favoriteClickBlock = sourceText.match(
  /map\.on\('click', 'outmap-favorite-icons',[\s\S]*?map\.on\('contextmenu', 'outmap-favorite-icons'/
);
assert(favoriteClickBlock, 'favorite click handler is missing');
assert(!favoriteClickBlock[0].includes('onArrival'),
  'favorite tap must not attach a menu action to camera arrival');
assert(!favoriteClickBlock[0].includes('showChangeWaypointTypeMenu'),
  'favorite tap must not open its management menu');
assert(!/onArrival\s*:\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,700}?show(?:ChangeWaypointTypeMenu|ContextMenuForLocation)/.test(sourceText),
  'camera arrival must not synthesize any context menu');

const roadShieldBlock = sourceText.match(
  /id: 'osm-road-shields',[\s\S]*?\n\s*\}\);/
);
assert(roadShieldBlock, 'road shield layer is missing');
for (const property of [
  "'icon-rotation-alignment': 'viewport'",
  "'icon-pitch-alignment': 'viewport'",
  "'text-rotation-alignment': 'viewport'",
  "'text-pitch-alignment': 'viewport'"
]) {
  assert(roadShieldBlock[0].includes(property), `road shield must use ${property}`);
}

const watchdog = setTimeout(() => {
  console.error('v2.0.2 interaction test timed out');
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1100,
      height: 760,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'src/index.html'));

    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'Map style did not initialize');
      check(window.OUTMAP_APP_VERSION === ${JSON.stringify(expectedVersion)}, 'Version mismatch');

      const alignments = {
        iconRotation: map.getLayoutProperty('osm-road-shields', 'icon-rotation-alignment'),
        iconPitch: map.getLayoutProperty('osm-road-shields', 'icon-pitch-alignment'),
        textRotation: map.getLayoutProperty('osm-road-shields', 'text-rotation-alignment'),
        textPitch: map.getLayoutProperty('osm-road-shields', 'text-pitch-alignment')
      };
      check(Object.values(alignments).every(value => value === 'viewport'),
        'Road shield icon and text alignment diverged: ' + JSON.stringify(alignments));

      savedWaypoints = [{
        id: 'touch_intent_favorite', name: '触屏意图测试', type: 'view',
        lng: 118, lat: 35, ele: 100
      }];
      renderWaypointMarkersOnMap(null, true);
      await sleep(60);

      const originalQuery = map.queryRenderedFeatures.bind(map);
      map.queryRenderedFeatures = (point, options) => {
        if (options?.layers?.includes('outmap-favorite-icons')) {
          return [{
            id: 'touch_intent_favorite',
            properties: { id: 'touch_intent_favorite' },
            geometry: { type: 'Point', coordinates: [118, 35] }
          }];
        }
        return originalQuery(point, options);
      };

      const originalFly = window.flyToLocationPrecisely;
      const originalFavoriteMenu = window.showChangeWaypointTypeMenu;
      const originalLocationMenu = window.showContextMenuForLocation;
      let flightCount = 0;
      let favoriteMenuCount = 0;
      let locationMenuCount = 0;
      window.flyToLocationPrecisely = () => { flightCount += 1; };
      window.showChangeWaypointTypeMenu = () => { favoriteMenuCount += 1; };
      window.showContextMenuForLocation = () => { locationMenuCount += 1; };

      const fireFavoriteClick = pointerType => map.fire('click', {
        point: { x: 210, y: 210 },
        lngLat: { lng: 118, lat: 35 },
        originalEvent: { pointerType }
      });

      fireFavoriteClick('mouse');
      await sleep(20);
      check(flightCount === 1 && favoriteMenuCount === 0,
        'Desktop favorite click must only fly once');

      fireFavoriteClick('touch');
      await sleep(20);
      check(flightCount === 2 && favoriteMenuCount === 0 && locationMenuCount === 0,
        'Mobile favorite tap must only fly once and keep menus closed');

      // Verify that the real flyToLocationPrecisely executes cleanly without reference errors
      originalFly(map, [118, 35], { zoom: 12, duration: 0 });
      originalFly(map, { lng: 118, lat: 35 }, { zoom: 12, duration: 0 });

      map.fire('contextmenu', {
        point: { x: 210, y: 210 },
        lngLat: { lng: 118, lat: 35 },
        originalEvent: { clientX: 210, clientY: 210, pointerType: 'mouse' }
      });
      await sleep(20);
      check(favoriteMenuCount === 1, 'Desktop favorite right-click must open one management menu');

      map.fire('touchstart', {
        point: { x: 210, y: 210 },
        points: [{ x: 210, y: 210 }],
        lngLat: { lng: 118, lat: 35 },
        lngLats: [{ lng: 118, lat: 35 }],
        originalEvent: { touches: [{ clientX: 210, clientY: 210 }] }
      });
      await sleep(650);
      map.fire('touchend', {
        point: { x: 210, y: 210 },
        points: [], lngLat: { lng: 118, lat: 35 }, lngLats: [],
        originalEvent: { touches: [] }
      });
      fireFavoriteClick('touch');
      await sleep(20);
      check(favoriteMenuCount === 2, 'Mobile favorite long-press must open exactly one management menu');
      check(flightCount === 2, 'Compatibility click after long-press must not start a flight');

      window.showLandingMarker([118.02, 35.02], '搜索落点测试', '测试区域');
      await sleep(30);
      document.querySelector('.landing-pulse-marker .pulse-pin-wrap')?.click();
      await sleep(20);
      check(flightCount === 3 && favoriteMenuCount === 2 && locationMenuCount === 0,
        'Search landing marker tap must fly without opening a context menu');

      routeViaPoints = [{ id: 'touch_route_point', name: '途径点', coords: [118.04, 35.04] }];
      syncRouteMarkersVisualState(map, true);
      map.queryRenderedFeatures = (point, options) => {
        if (options?.layers?.includes('outmap-route-point-circles')) {
          return [{
            id: 'touch_route_point', properties: { id: 'touch_route_point', role: 'via', index: 0 },
            geometry: { type: 'Point', coordinates: [118.04, 35.04] }
          }];
        }
        if (options?.layers?.includes('outmap-favorite-icons')) return [];
        return originalQuery(point, options);
      };
      map.fire('click', {
        point: { x: 240, y: 240 }, lngLat: { lng: 118.04, lat: 35.04 },
        originalEvent: { pointerType: 'touch' }
      });
      await sleep(20);
      check(flightCount === 4 && favoriteMenuCount === 2 && locationMenuCount === 0,
        'Route point tap must fly without opening a context menu');

      savedRoutes = [{
        id: 'touch_route_card', name: '收藏路线测试', mode: 'drive',
        pathCoords: [[118, 35], [118.1, 35.1]], metrics: {}
      }];
      renderSavedRoutesListFn();
      const routeCard = document.querySelector('.fav-route-card');
      check(routeCard, 'Saved route card did not render');
      const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(touchStart, 'touches', { value: [{ clientX: 120, clientY: 120 }] });
      routeCard.dispatchEvent(touchStart);
      const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
      Object.defineProperty(touchEnd, 'touches', { value: [] });
      routeCard.dispatchEvent(touchEnd);
      routeCard.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(30);
      check(!document.querySelector('.fav-route-context-menu'),
        'Saved route card tap must load directly without opening its context menu');

      map.queryRenderedFeatures = originalQuery;
      window.flyToLocationPrecisely = originalFly;
      window.showChangeWaypointTypeMenu = originalFavoriteMenu;
      window.showContextMenuForLocation = originalLocationMenu;
      window.clearLandingMarker?.();

      return {
        alignments,
        desktopFavoriteClick: true,
        mobileFavoriteTap: true,
        mobileFavoriteLongPress: true,
        desktopFavoriteContextMenu: true,
        searchMarkerTap: true,
        routePointTap: true,
        savedRouteCardTap: true
      };
    })()`);

    console.log('v2.0.2 touch-intent and road-shield regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('v2.0.2 interaction test failed:', error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJsSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const styleCssSource = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

// Ensure syntax of app.js
new Function(appJsSource);

const watchdog = setTimeout(() => {
  console.error('v2.0.55 architecture governance test timed out');
  process.exit(1);
}, 45000);

const check = (value, message) => {
  if (!value) throw new Error(message);
};

async function run() {
  console.log('[v2.0.55 Test] Starting Architecture Governance test...');

  // Static checks
  check(styleCssSource.includes('content-visibility: auto'), 'style.css missing content-visibility: auto');
  check(styleCssSource.includes('contain-intrinsic-size: 42px') || styleCssSource.includes('contain-intrinsic-size: 52px'), 'style.css missing contain-intrinsic-size for fav-item-card');
  check(styleCssSource.includes('contain-intrinsic-size: 74px'), 'style.css missing contain-intrinsic-size for fav-route-card');
  check(appJsSource.includes('safelyUpdatePrivateTileCache'), 'app.js missing safelyUpdatePrivateTileCache');
  check(appJsSource.includes('savedRouteGeometryCache'), 'app.js missing savedRouteGeometryCache');
  check(appJsSource.includes('routeOverlapDegreeCache'), 'app.js missing routeOverlapDegreeCache');
  check(appJsSource.includes('submitGeoJSONChanges'), 'app.js missing submitGeoJSONChanges');
  check(appJsSource.includes('computeRoutePointsSignature'), 'app.js missing computeRoutePointsSignature');
  check(appJsSource.includes('computeFavoriteRouteFilterSignature'), 'app.js missing computeFavoriteRouteFilterSignature');
  check(appJsSource.includes('shouldSyncFavoritesForRoutePoints'), 'app.js missing shouldSyncFavoritesForRoutePoints');

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });

  await win.loadFile(path.join(root, 'src', 'index.html'));

  await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (window.mapInstance?.__outmapStyleReady && window.submitGeoJSONChanges) return resolve(true);
      if (performance.now() - started > 15000) return reject(new Error('map initialization timeout'));
      setTimeout(poll, 50);
    };
    poll();
  })`);

  // Test 1: GeoJSON deduplication
  const geoJsonTestResult = await win.webContents.executeJavaScript(`(() => {
    let callCount = 0;
    const mockSource = {
      setData(d) {
        callCount++;
      }
    };
    const dataA = { type: 'FeatureCollection', features: [] };
    const dataB = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null }] };

    // 1. Initial submit
    window.submitGeoJSONChanges(mockSource, dataA, false, 'sig-v1');
    const firstCall = callCount;

    // 2. Duplicate submit with same signature
    window.submitGeoJSONChanges(mockSource, dataA, false, 'sig-v1');
    const secondCall = callCount;

    // 3. Submit with new signature
    window.submitGeoJSONChanges(mockSource, dataB, false, 'sig-v2');
    const thirdCall = callCount;

    // 4. Forced submit with same signature
    window.submitGeoJSONChanges(mockSource, dataB, true, 'sig-v2');
    const fourthCall = callCount;

    return { firstCall, secondCall, thirdCall, fourthCall };
  })()`);

  check(geoJsonTestResult.firstCall === 1, 'GeoJSON first call did not trigger setData');
  check(geoJsonTestResult.secondCall === 1, 'GeoJSON duplicate submit was not deduplicated!');
  check(geoJsonTestResult.thirdCall === 2, 'GeoJSON signature change did not trigger setData');
  check(geoJsonTestResult.fourthCall === 3, 'GeoJSON forced submit was skipped');
  console.log('✓ Test 1 Passed: GeoJSON signature deduplication verified.');

  // Test 2: Saved Route Geometry & Overlap Cache
  const routeCacheTestResult = await win.webContents.executeJavaScript(`(() => {
    const testRoute = {
      id: 'cache_test_route_' + Date.now(),
      name: '测试缓存路线',
      pathCoords: [
        [104.0, 30.0],
        [104.1, 30.1],
        [104.2, 30.2],
        [104.3, 30.3],
        [104.4, 30.4]
      ],
      updatedAt: 123456789
    };

    window.setSavedRoutes([testRoute]);
    window.renderSavedRoutesOnMap(window.mapInstance);

    const hasGeomCache = window.savedRouteGeometryCache.has(String(testRoute.id));
    const cachedGeom = window.savedRouteGeometryCache.get(String(testRoute.id));

    return {
      hasGeomCache,
      hasBBox: Boolean(cachedGeom?.bbox),
      hasSamplesA: Boolean(cachedGeom?.samplesA?.length),
      hasSamplesB: Boolean(cachedGeom?.samplesB?.length)
    };
  })()`);

  check(routeCacheTestResult.hasGeomCache, 'savedRouteGeometryCache did not cache test route');
  check(routeCacheTestResult.hasBBox && routeCacheTestResult.hasSamplesA && routeCacheTestResult.hasSamplesB, 'cached geometry entry missing bbox or samples');
  console.log('✓ Test 2 Passed: Saved route geometry and overlap cache verified.');

  // Test 3: Favorites List Event Delegation and Keyed DOM
  const domTestResult = await win.webContents.executeJavaScript(`(() => {
    // Open favorites drawer so lists are rendered
    document.getElementById('btn-fab-fav')?.click();

    const favItemsList = document.getElementById('fav-items-list');
    const favRoutesList = document.getElementById('fav-routes-list');

    const itemsBound = favItemsList?.dataset.eventsBound === '1';
    const routesBound = favRoutesList?.dataset.eventsBound === '1';

    // Verify cards have data-id and data-rendered-hash
    const routeCard = favRoutesList?.querySelector('.fav-route-card');
    const hasDataId = Boolean(routeCard?.dataset.id);
    const hasHash = Boolean(routeCard?.dataset.renderedHash);

    return {
      itemsBound,
      routesBound,
      hasDataId,
      hasHash
    };
  })()`);

  check(domTestResult.itemsBound, '#fav-items-list container event delegation not bound');
  check(domTestResult.routesBound, '#fav-routes-list container event delegation not bound');
  check(domTestResult.hasDataId, 'Route card missing data-id');
  check(domTestResult.hasHash, 'Route card missing data-rendered-hash');
  console.log('✓ Test 3 Passed: Container event delegation & Keyed DOM verified.');

  // Test 4: Safely Update Private Tile Cache Guard
  const tileCacheTestResult = await win.webContents.executeJavaScript(`(() => {
    let cleanExecution = true;
    try {
      // 1. With actual map
      window.safelyUpdatePrivateTileCache(window.mapInstance, 256);
      // 2. With empty object
      window.safelyUpdatePrivateTileCache({}, 256);
      // 3. With null / undefined / zero / negative
      window.safelyUpdatePrivateTileCache(null, 256);
      window.safelyUpdatePrivateTileCache(window.mapInstance, -1);
      window.safelyUpdatePrivateTileCache(window.mapInstance, 0);
      // 4. With mock sourceCache
      const mockMap = {
        _maxTileCacheSize: 100,
        style: {
          _sourceCaches: {
            testSrc: {
              _maxTileCacheSize: 100,
              _updateCacheSize: () => {}
            }
          }
        }
      };
      window.safelyUpdatePrivateTileCache(mockMap, 300);
      if (mockMap._maxTileCacheSize !== 300 || mockMap.style._sourceCaches.testSrc._maxTileCacheSize !== 300) {
        cleanExecution = false;
      }
    } catch (e) {
      cleanExecution = false;
    }
    return { cleanExecution };
  })()`);

  check(tileCacheTestResult.cleanExecution, 'safelyUpdatePrivateTileCache failed safety guard tests');
  console.log('✓ Test 4 Passed: safelyUpdatePrivateTileCache defensive guard verified.');

  clearTimeout(watchdog);
  console.log('\n========================================');
  console.log('ALL v2.0.55 ARCHITECTURE GOVERNANCE TESTS PASSED!');
  console.log('========================================\n');
  win.destroy();
  app.quit();
}

app.whenReady().then(run).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

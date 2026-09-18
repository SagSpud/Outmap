const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

console.log('🚀 Starting Outmap v2.0.41 Saved Routes Thicker & Anti-Overlap Test Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');

// [Test 1] Version Alignment
console.log('[Test 1] Version Alignment Audit (v2.0.41)...');
assert.strictEqual(pkg.version, '2.0.41', 'package.json version must be 2.0.41');
assert(appJs.includes("const APP_VERSION = '2.0.41';"), 'app.js APP_VERSION must be 2.0.41');
assert(indexHtml.includes('v2.0.41'), 'index.html must reference v2.0.41');
assert(bootstrapJs.includes('app.js?v=2.0.41'), 'map-bootstrap.js must reference v2.0.41');
console.log('  ✅ Test 1 passed: All files synchronized to v2.0.41.');

// [Test 2] Static Config Audit (Default Visible & Thicker Line Widths)
console.log('\n[Test 2] Static Config Audit (Default Visible & Thicker Line Widths)...');
assert(appJs.includes('let savedRouteLayersVisible = true;'), 'savedRouteLayersVisible must default to true');
assert(indexHtml.includes('id="layer-toggle-saved-routes" checked'), 'layer-toggle-saved-routes must be checked by default in HTML');

// Check line-width is substantially thicker than v2.0.40 (line width 4.2+ at z6, 6.8+ at z10, casing 6.6+ at z6)
assert(appJs.includes("['interpolate', ['linear'], ['zoom'], 6, 4.2, 10, 6.8, 14, 9.6, 17, 12.0]"), 'saved route line must use thicker interpolation');
assert(appJs.includes("['interpolate', ['linear'], ['zoom'], 6, 6.6, 10, 9.8, 14, 13.2, 17, 16.0]"), 'saved route casing must use thicker interpolation');
console.log('  ✅ Test 2 passed: Saved routes default visibility and bold line-width verified.');

// [Test 3] Runtime Headless Electron Verification (Layer Rendering & Overlap Filtering)
console.log('\n[Test 3] Runtime Headless Electron Verification...');

const watchdog = setTimeout(() => {
  console.error('❌ Test timed out after 40s');
  app.exit(1);
}, 40000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 668,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const res = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;

      const casingVis = map.getLayoutProperty('outmap-saved-route-casing', 'visibility');
      const lineVis = map.getLayoutProperty('outmap-saved-route-line', 'visibility');
      const casingWidth = map.getPaintProperty('outmap-saved-route-casing', 'line-width');
      const lineWidth = map.getPaintProperty('outmap-saved-route-line', 'line-width');

      // Create two mock saved routes
      const routeA = [];
      for (let i = 0; i < 60; i++) {
        routeA.push([119.260 + i * 0.001, 26.090 + Math.sin(i * 0.1) * 0.001]);
      }
      const routeB = [];
      for (let i = 0; i < 60; i++) {
        routeB.push([120.100 + i * 0.001, 30.200 + i * 0.001]);
      }

      // Inject savedRoutes via setSavedRoutes
      window.setSavedRoutes([
        { id: 'route_a', name: '路线A', pathCoords: routeA },
        { id: 'route_b', name: '路线B', pathCoords: routeB }
      ]);
      await sleep(150);

      const sourceBefore = map.getSource('outmap-saved-routes');
      const dataBefore = await sourceBefore.getData();
      const countBefore = dataBefore?.features?.length || 0;

      // Now simulate planning a route that overlaps route A
      window.renderRouteGeometry(map, routeA);
      await sleep(150);

      const dataWhileOverlapping = await map.getSource('outmap-saved-routes').getData();
      const featuresWhileOverlapping = dataWhileOverlapping?.features || [];
      const hasRouteAWhileOverlapping = featuresWhileOverlapping.some(f => f.id === 'route_a');
      const hasRouteBWhileOverlapping = featuresWhileOverlapping.some(f => f.id === 'route_b');

      // Now clear the planned route
      const btnClear = document.getElementById('btn-clear-route');
      if (btnClear) btnClear.click();
      await sleep(150);

      const dataAfterClear = await map.getSource('outmap-saved-routes').getData();
      const featuresAfterClear = dataAfterClear?.features || [];
      const hasRouteAAfterClear = featuresAfterClear.some(f => f.id === 'route_a');
      const hasRouteBAfterClear = featuresAfterClear.some(f => f.id === 'route_b');

      return {
        casingVis,
        lineVis,
        casingWidth,
        lineWidth,
        countBefore,
        hasRouteAWhileOverlapping,
        hasRouteBWhileOverlapping,
        hasRouteAAfterClear,
        hasRouteBAfterClear
      };
    })()`);

    console.log('    - Casing layer visibility:', res.casingVis);
    assert.strictEqual(res.casingVis, 'visible', 'outmap-saved-route-casing must be visible by default');
    console.log('    - Line layer visibility:', res.lineVis);
    assert.strictEqual(res.lineVis, 'visible', 'outmap-saved-route-line must be visible by default');

    console.log('    - Casing line-width interpolation:', JSON.stringify(res.casingWidth));
    assert(Array.isArray(res.casingWidth) && res.casingWidth.includes(6.6), 'Casing width must be upgraded to 6.6+');

    console.log('    - Line line-width interpolation:', JSON.stringify(res.lineWidth));
    assert(Array.isArray(res.lineWidth) && res.lineWidth.includes(4.2), 'Line width must be upgraded to 4.2+');

    console.log('    - Initial saved routes feature count:', res.countBefore);
    assert.strictEqual(res.countBefore, 2, 'Both saved routes must be visible initially');

    console.log('    - While route A is planned (overlapping):');
    console.log('      - Has route A (should be false):', res.hasRouteAWhileOverlapping);
    console.log('      - Has route B (should be true):', res.hasRouteBWhileOverlapping);
    assert.strictEqual(res.hasRouteAWhileOverlapping, false, 'Overlapping saved route A must be hidden');
    assert.strictEqual(res.hasRouteBWhileOverlapping, true, 'Non-overlapping saved route B must remain visible');

    console.log('    - After planned route is cleared:');
    console.log('      - Has route A (should be true):', res.hasRouteAAfterClear);
    console.log('      - Has route B (should be true):', res.hasRouteBAfterClear);
    assert.strictEqual(res.hasRouteAAfterClear, true, 'Saved route A must be restored after clear');
    assert.strictEqual(res.hasRouteBAfterClear, true, 'Saved route B must remain visible');

    console.log('  ✅ Test 3 passed: Runtime layer thickness, default visibility, and overlap hiding/restoring verified.');

    console.log('\n=============================================================');
    console.log('🎉 ALL v2.0.41 TESTS PASSED 100% (THICKER & ANTI-OVERLAP)');
    console.log('=============================================================\n');

    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

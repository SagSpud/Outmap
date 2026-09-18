const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

console.log('🚀 Starting Outmap v2.0.44 Route Point Deletion Labels & Tombstone Test Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// [Test 1] Version Alignment
console.log(`[Test 1] Version Alignment Audit (Current: v${pkg.version})...`);
assert(pkg.version, 'package.json must have valid version');
assert(appJs.includes(`const APP_VERSION = '${pkg.version}';`), `app.js APP_VERSION must match package.json (${pkg.version})`);
assert(indexHtml.includes(`v${pkg.version}`), `index.html must reference v${pkg.version}`);
assert(bootstrapJs.includes(`app.js?v=${pkg.version}`), `map-bootstrap.js must reference v${pkg.version}`);
console.log(`  ✅ Test 1 passed: All files synchronized to v${pkg.version}.`);

// [Test 2] Static Code Audit
console.log('\n[Test 2] Static Code Audit for Tombstone & GeoJSON Submission...');
assert(appJs.includes('function submitGeoJSONChanges(source, data, force = false) {\n  if (!source) return;\n  source.setData(data);'), 'submitGeoJSONChanges must directly use source.setData to guarantee complete symbol layout updates');
assert(appJs.includes('Math.max(Number(existing.time || 0), Number(normalized.time || 0))'), 'mergeRouteTombstones must resolve conflicts with Math.max');
console.log('  ✅ Test 2 passed: Static patterns for point label reactivity and tombstone LWW verified.');

// [Test 3] Runtime Headless Electron Verification
console.log('\n[Test 3] Runtime Headless Electron Verification...');

const watchdog = setTimeout(() => {
  console.error('❌ Test timed out after 35s');
  app.exit(1);
}, 35000);

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
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const check = (val, msg) => { if (!val) throw new Error(msg); };

      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map, 'Map not initialized');

      // Test A: Add 20 points, delete point 16, verify subsequent points re-index correctly
      setRouteStartPoint(map, [100.2, 27.1], '起点');
      for (let i = 1; i <= 20; i++) {
        addViaPoint(map, [100.2 + i * 0.05, 27.1 + i * 0.05], '途经点 ' + i);
      }
      setRouteEndPoint(map, [101.5, 28.5], '终点');
      await sleep(200);

      // Pre-check: 22 features (start + 20 vias + end)
      const preFeatures = getRoutePointFeatures().features;
      check(preFeatures.length === 22, 'Expected 22 features before deletion, got ' + preFeatures.length);

      // Delete via point at index 15 (the 16th via point)
      removeViaPoint(map, 15);
      await sleep(300);

      // Post-check in DOM: 19 via rows with tags 1..19
      const listContainer = document.getElementById('route-via-list');
      const domRows = Array.from(listContainer.querySelectorAll('.route-via-item'));
      check(domRows.length === 19, 'Expected 19 DOM via rows, got ' + domRows.length);
      domRows.forEach((row, idx) => {
        const tag = row.querySelector('.pt-tag')?.textContent;
        check(tag === String(idx + 1), 'DOM tag mismatch at ' + idx + ': expected ' + (idx + 1) + ', got ' + tag);
      });

      // Post-check in MapLibre GeoJSON Source
      const rawFeatures = map.querySourceFeatures('outmap-route-points');
      const seenIds = new Set();
      const srcFeatures = rawFeatures.filter(f => {
        if (seenIds.has(f.id)) return false;
        seenIds.add(f.id);
        return true;
      });
      check(srcFeatures.length === 21, 'Expected 21 MapLibre features after deletion, got ' + srcFeatures.length);
      for (const sf of srcFeatures) {
        check(sf.properties.label !== undefined, 'Feature label MUST NOT be undefined: id ' + sf.id);
        check(sf.id !== undefined, 'Feature id MUST NOT be undefined');
      }

      // Check specifically around the deletion point (index 15, which now has label 16)
      const via15 = srcFeatures.find(f => f.properties.label === '15');
      const via16 = srcFeatures.find(f => f.properties.label === '16');
      const via17 = srcFeatures.find(f => f.properties.label === '17');
      check(via15, 'Via 15 missing in MapLibre features');
      check(via16, 'Via 16 missing in MapLibre features (was broken before fix)');
      check(via17, 'Via 17 missing in MapLibre features (was broken before fix)');
      check(via16.properties.name === '途经点 17', 'Via 16 should be the former point 17');

      // Test B: Route tombstone LWW conflict resolution
      const testRoute = {
        id: 'route_trip_test_revival',
        name: '测试复活防线',
        updatedAt: 1789570000000,
        distKm: 500.0
      };
      addDeletedRouteTombstone(testRoute);
      const tombs = getDeletedRoutes();
      const myTomb = tombs.find(t => t.id === 'route_trip_test_revival');
      check(myTomb, 'Tombstone was not saved');
      check(myTomb.time > 1789720000000, 'Tombstone time must be fresh Date.now()');

      // Attempt merging with a cloud route that has old timestamp
      const cloudRoute = { ...testRoute, updatedAt: 1789570000000 };
      const mergedRoutes = mergeRoutes([], [cloudRoute], tombs);
      check(mergedRoutes.length === 0, 'Deleted route must NOT revive when cloud timestamp is older than tombstone');

      return { success: true };
    })()`);

    assert(result.success, 'Runtime checks failed');
    console.log('  ✅ Test 3 passed: Route point re-indexing and tombstone anti-revival verified in headless Electron.');

    console.log('\n=============================================================');
    console.log('🎉 ALL v2.0.44 TESTS PASSED 100%');
    console.log('=============================================================');

    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

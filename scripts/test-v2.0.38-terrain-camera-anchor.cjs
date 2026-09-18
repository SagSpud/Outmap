const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

console.log('🚀 Starting Outmap v2.0.38 Terrain Camera Anchor & Rotation Stability Test Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');

// [Test 1] Version Alignment
console.log('[Test 1] Version Alignment Audit (v2.0.38)...');
assert.strictEqual(pkg.version, '2.0.38', 'package.json version must be 2.0.38');
assert(appJs.includes("const APP_VERSION = '2.0.38';"), 'app.js APP_VERSION must be 2.0.38');
assert(indexHtml.includes('v2.0.38'), 'index.html must reference v2.0.38');
assert(bootstrapJs.includes('app.js?v=2.0.38'), 'map-bootstrap.js must reference v2.0.38');
console.log('  ✅ Test 1 passed: All files synchronized to v2.0.38.');

// [Test 2] Static Configuration Audit
console.log('\n[Test 2] Static Camera & Layer Configuration Audit...');
assert(appJs.includes('centerClampedToGround: true'), 'app.js must have centerClampedToGround: true');
assert(appJs.includes('maxPitch: 72'), 'app.js must have maxPitch: 72');
assert(!appJs.includes('maxPitch: 85'), 'app.js must not retain maxPitch: 85');
assert(appJs.includes('recalculateZoomAndCenter'), 'app.js must intercept recalculateZoomAndCenter');

// Layer order check: osm-buildings-3d must appear before osm-all-pois
const bldIdx = appJs.indexOf("'osm-buildings-3d'");
const poiIdx = appJs.indexOf("'osm-all-pois'");
assert(bldIdx > 0 && poiIdx > 0, 'Both osm-buildings-3d and osm-all-pois must exist');
assert(bldIdx < poiIdx, 'osm-buildings-3d must be registered before osm-all-pois for proper layering');

// Icon anchor checks
assert(appJs.includes("'icon-anchor': 'bottom'"), 'POI layers must use icon-anchor: bottom');
console.log('  ✅ Test 2 passed: Camera constraints and layer hierarchies statically verified.');

// [Test 3] Runtime Headless Electron Verification
console.log('\n[Test 3] Runtime Terrain Anchor, Rotation & Smooth Zoom Verification...');

const watchdog = setTimeout(() => {
  console.error('❌ Test timed out after 35s');
  app.exit(1);
}, 35000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 668,
      webPreferences: { offscreen: true }
    });
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const res = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;

      const centerClamped = map.getCenterClampedToGround();
      const maxPitch = map.getMaxPitch();

      // Meifeng Park test coordinate (elevated terrain)
      const target = [119.2663, 26.0940];
      map.jumpTo({ center: target, zoom: 14.5, pitch: 65, bearing: 0 });
      await sleep(2000);

      const centerElev = map.getCenterElevation();

      // Test 360 degree rotation around terrain point
      const rotationDeltas = [];
      const initialProject = map.project(target);
      for (let b = 0; b <= 360; b += 45) {
        map.setBearing(b);
        await sleep(30);
        const p = map.project(target);
        rotationDeltas.push({
          bearing: b,
          dx: Math.abs(p.x - initialProject.x),
          dy: Math.abs(p.y - initialProject.y),
          elev: map.getCenterElevation()
        });
      }

      // Test wheel zoom gesture smoothness (check no bounce at 400ms+)
      const zoomBefore = map.getZoom();
      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const wheelEv = new WheelEvent('wheel', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        deltaY: -100,
        bubbles: true,
        cancelable: true
      });
      canvas.dispatchEvent(wheelEv);

      const zoomSamples = [];
      for (let i = 0; i < 15; i++) {
        await sleep(50);
        zoomSamples.push({ t: (i + 1) * 50, z: map.getZoom() });
      }

      // Check POI layer properties
      const poiAnchor = map.getLayoutProperty('osm-all-pois', 'icon-anchor');
      const favAnchor = map.getLayoutProperty('outmap-favorite-icons', 'icon-anchor');

      return {
        centerClamped,
        maxPitch,
        centerElev,
        rotationDeltas,
        zoomBefore,
        zoomSamples,
        poiAnchor,
        favAnchor
      };
    })()`);

    console.log('    - centerClampedToGround:', res.centerClamped);
    assert.strictEqual(res.centerClamped, true, 'centerClampedToGround must be true in runtime');

    console.log('    - maxPitch:', res.maxPitch);
    assert(res.maxPitch <= 72, 'maxPitch must be <= 72');

    console.log('    - centerElevation on hill:', res.centerElev.toFixed(2), 'm');
    assert(res.centerElev > 50, 'centerElevation must accurately reflect mountain terrain altitude');

    console.log('    - POI icon anchor:', res.poiAnchor);
    assert.strictEqual(res.poiAnchor, 'bottom', 'osm-all-pois icon-anchor must be bottom');

    console.log('    - Favorite icon anchor:', res.favAnchor);
    assert.strictEqual(res.favAnchor, 'bottom', 'outmap-favorite-icons icon-anchor must be bottom');

    // Verify rotation stability: max delta from initial project must be <= 2px
    const maxRotDelta = Math.max(...res.rotationDeltas.map(d => Math.max(d.dx, d.dy)));
    console.log('    - Max pixel drift during 360° rotation:', maxRotDelta, 'px');
    assert(maxRotDelta <= 2, `Rotation drift must be <= 2px, got ${maxRotDelta}px`);

    // Verify wheel zoom smoothness: zoom at 300ms vs 700ms must not bounce back
    const zoomAtEnd = res.zoomSamples[res.zoomSamples.length - 1].z;
    const zoomAtMid = res.zoomSamples[4].z; // 250ms
    console.log('    - Zoom before:', res.zoomBefore.toFixed(4), '| mid-gesture:', zoomAtMid.toFixed(4), '| settled:', zoomAtEnd.toFixed(4));
    assert(zoomAtEnd >= res.zoomBefore, 'Wheel zoom in must increase zoom level');
    // Ensure the difference between mid (post-wheel event) and settled is minimal (< 0.05)
    assert(Math.abs(zoomAtEnd - zoomAtMid) < 0.05, 'Zoom must settle cleanly without bouncing');

    console.log('  ✅ Test 3 passed: Runtime terrain anchor, rotation stability, and smooth zoom verified.');

    console.log('\n=============================================================');
    console.log('🎉 ALL v2.0.38 TERRAIN CAMERA & ROTATION TESTS PASSED 100%!');
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

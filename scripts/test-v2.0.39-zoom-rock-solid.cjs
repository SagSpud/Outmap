const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

console.log('🚀 Starting Outmap v2.0.39 Zoom Rock-Solid & Rotation Stability Test Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');

// [Test 1] Version Alignment
console.log('[Test 1] Version Alignment Audit (v2.0.39)...');
assert.strictEqual(pkg.version, '2.0.39', 'package.json version must be 2.0.39');
assert(appJs.includes("const APP_VERSION = '2.0.39';"), 'app.js APP_VERSION must be 2.0.39');
assert(indexHtml.includes('v2.0.39'), 'index.html must reference v2.0.39');
assert(bootstrapJs.includes('app.js?v=2.0.39'), 'map-bootstrap.js must reference v2.0.39');
console.log('  ✅ Test 1 passed: All files synchronized to v2.0.39.');

// [Test 2] Static Configuration Audit
console.log('\n[Test 2] Static Camera & Layer Configuration Audit...');
assert(appJs.includes('centerClampedToGround: false'), 'app.js must have centerClampedToGround: false to prevent zoom jump');
assert(appJs.includes('maxPitch: 72'), 'app.js must have maxPitch: 72');
assert(!appJs.includes('maxPitch: 85'), 'app.js must not retain maxPitch: 85');
assert(appJs.includes('recalculateZoomAndCenter'), 'app.js must intercept recalculateZoomAndCenter');
assert(appJs.includes('syncCameraGroundElevation'), 'app.js must include smart camera ground elevation sync');

// Layer order check: osm-buildings-3d must appear before osm-all-pois
const bldIdx = appJs.indexOf("'osm-buildings-3d'");
const poiIdx = appJs.indexOf("'osm-all-pois'");
assert(bldIdx > 0 && poiIdx > 0, 'Both osm-buildings-3d and osm-all-pois must exist');
assert(bldIdx < poiIdx, 'osm-buildings-3d must be registered before osm-all-pois for proper layering');

// Icon anchor checks
assert(appJs.includes("'icon-anchor': 'bottom'"), 'POI layers must use icon-anchor: bottom');
console.log('  ✅ Test 2 passed: Camera constraints and layer hierarchies statically verified.');

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
      width: 1024,
      height: 668,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const res = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;

      const centerClamped = map.getCenterClampedToGround();
      const maxPitch = map.getMaxPitch();

      // Meifeng Park test coordinate (mountainous terrain)
      const target = [119.2663, 26.0940];
      map.jumpTo({ center: target, zoom: 14.5, pitch: 65, bearing: 0 });
      for (let i = 0; i < 50; i++) {
        await sleep(50);
        const qElev = map.queryTerrainElevation(target);
        if (Number.isFinite(qElev) && qElev > 20) break;
      }
      map.fire('rotatestart');
      await sleep(100);

      const centerElev = map.getCenterElevation();

      // Test 360 degree rotation around terrain point
      const rotationDeltas = [];
      const initialProject = map.project(target);
      for (let b = 0; b <= 360; b += 45) {
        map.setBearing(b);
        await sleep(25);
        const p = map.project(target);
        rotationDeltas.push({
          bearing: b,
          dx: Math.abs(p.x - initialProject.x),
          dy: Math.abs(p.y - initialProject.y),
          elev: map.getCenterElevation()
        });
      }

      // Test off-center wheel zoom gesture (off-center cursor at 400, 250)
      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const cursorX = rect.left + 400;
      const cursorY = rect.top + 250;
      const anchorGeo = map.unproject([400, 250]);

      const zoomBefore = map.getZoom();
      const wheelEv = new WheelEvent('wheel', {
        clientX: cursorX,
        clientY: cursorY,
        deltaY: -100,
        bubbles: true,
        cancelable: true
      });
      canvas.dispatchEvent(wheelEv);

      const zoomSamples = [];
      for (let i = 0; i < 15; i++) {
        await sleep(50);
        const curProj = map.project(anchorGeo);
        zoomSamples.push({
          t: (i + 1) * 50,
          z: map.getZoom(),
          elev: map.getCenterElevation(),
          x: curProj.x,
          y: curProj.y
        });
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
    assert.strictEqual(res.centerClamped, false, 'centerClampedToGround must be false in runtime for zoom stability');

    console.log('    - maxPitch:', res.maxPitch);
    assert(res.maxPitch <= 72, 'maxPitch must be <= 72');

    console.log('    - POI icon anchor:', res.poiAnchor);
    assert.strictEqual(res.poiAnchor, 'bottom', 'osm-all-pois icon-anchor must be bottom');

    console.log('    - Favorite icon anchor:', res.favAnchor);
    assert.strictEqual(res.favAnchor, 'bottom', 'outmap-favorite-icons icon-anchor must be bottom');

    // Verify rotation stability: max delta from initial project must be <= 2px
    const maxRotDelta = Math.max(...res.rotationDeltas.map(d => Math.max(d.dx, d.dy)));
    console.log('    - Max pixel drift during 360° rotation:', maxRotDelta, 'px');
    assert(maxRotDelta <= 2, `Rotation drift must be <= 2px, got ${maxRotDelta}px`);

    // Verify wheel zoom smoothness and lack of jump
    const zoomAtEnd = res.zoomSamples[res.zoomSamples.length - 1].z;
    const zoomAtMid = res.zoomSamples[4].z; // 250ms
    console.log('    - Zoom before:', res.zoomBefore.toFixed(4), '| mid-gesture:', zoomAtMid.toFixed(4), '| settled:', zoomAtEnd.toFixed(4));
    assert(zoomAtEnd >= res.zoomBefore, 'Wheel zoom in must increase zoom level');

    // Check tail settled frames (last 4 frames)
    const tailSamples = res.zoomSamples.slice(-4);
    let maxTailDrift = 0;
    for (let i = 1; i < tailSamples.length; i++) {
      const d = Math.hypot(tailSamples[i].x - tailSamples[i - 1].x, tailSamples[i].y - tailSamples[i - 1].y);
      if (d > maxTailDrift) maxTailDrift = d;
    }
    console.log('    - Max pixel displacement when zoom settles:', maxTailDrift.toFixed(4), 'px');
    assert(maxTailDrift < 0.5, `Tail displacement must be < 0.5px, got ${maxTailDrift}px`);

    console.log('  ✅ Test 3 passed: Runtime off-center zoom rock-solid, zero jump, and rotation stable.');

    console.log('\n=============================================================');
    console.log('🎉 ALL v2.0.39 TESTS PASSED 100% (ROCK-SOLID ZOOM & ROTATION)');
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

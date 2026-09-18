const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

console.log('🚀 Starting Outmap v2.0.40 Concentric Icons & Zoom Stability Test Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');

// [Test 1] Version Alignment
console.log('[Test 1] Version Alignment Audit (v2.0.40)...');
assert.strictEqual(pkg.version, '2.0.40', 'package.json version must be 2.0.40');
assert(appJs.includes("const APP_VERSION = '2.0.40';"), 'app.js APP_VERSION must be 2.0.40');
assert(indexHtml.includes('v2.0.40'), 'index.html must reference v2.0.40');
assert(bootstrapJs.includes('app.js?v=2.0.40'), 'map-bootstrap.js must reference v2.0.40');
console.log('  ✅ Test 1 passed: All files synchronized to v2.0.40.');

// [Test 2] Static Icon Anchor & Layout Audit
console.log('\n[Test 2] Static Icon Anchor & Layout Audit...');
assert(appJs.includes('centerClampedToGround: false'), 'app.js must have centerClampedToGround: false');
assert(appJs.includes('maxPitch: 72'), 'app.js must have maxPitch: 72');

// Check outmap-favorite-icons anchor is 'center' (concentric with hover halo circle)
const favIconMatch = appJs.match(/id:\s*'outmap-favorite-icons'[\s\S]*?'icon-anchor':\s*'([^']+)'/);
assert(favIconMatch, 'outmap-favorite-icons must define icon-anchor');
assert.strictEqual(favIconMatch[1], 'center', 'outmap-favorite-icons must use icon-anchor: center to align with halo');

// Check osm-outdoor-scenic-pois text-anchor is 'top' to avoid overlapping icon
const scenicMatch = appJs.match(/id:\s*'osm-outdoor-scenic-pois'[\s\S]*?'text-anchor':\s*'([^']+)'/);
assert(scenicMatch, 'osm-outdoor-scenic-pois must define text-anchor');
assert.strictEqual(scenicMatch[1], 'top', 'osm-outdoor-scenic-pois must use text-anchor: top to avoid icon overlap');

console.log('  ✅ Test 2 passed: Icon anchors and text placement statically verified.');

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

      const favAnchor = map.getLayoutProperty('outmap-favorite-icons', 'icon-anchor');
      const scenicTextAnchor = map.getLayoutProperty('osm-outdoor-scenic-pois', 'text-anchor');
      const scenicTextOffset = map.getLayoutProperty('osm-outdoor-scenic-pois', 'text-offset');
      const poiAnchor = map.getLayoutProperty('osm-all-pois', 'icon-anchor');

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
          dy: Math.abs(p.y - initialProject.y)
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
          x: curProj.x,
          y: curProj.y
        });
      }

      return {
        favAnchor,
        scenicTextAnchor,
        scenicTextOffset,
        poiAnchor,
        rotationDeltas,
        zoomBefore,
        zoomSamples
      };
    })()`);

    console.log('    - Favorite icon anchor:', res.favAnchor);
    assert.strictEqual(res.favAnchor, 'center', 'outmap-favorite-icons icon-anchor must be center');

    console.log('    - Scenic text anchor:', res.scenicTextAnchor);
    assert.strictEqual(res.scenicTextAnchor, 'top', 'osm-outdoor-scenic-pois text-anchor must be top');

    console.log('    - POI icon anchor:', res.poiAnchor);
    assert.strictEqual(res.poiAnchor, 'bottom', 'osm-all-pois icon-anchor must be bottom');

    // Verify rotation stability: max delta from initial project must be <= 2px
    const maxRotDelta = Math.max(...res.rotationDeltas.map(d => Math.max(d.dx, d.dy)));
    console.log('    - Max pixel drift during 360° rotation:', maxRotDelta, 'px');
    assert(maxRotDelta <= 2, `Rotation drift must be <= 2px, got ${maxRotDelta}px`);

    // Verify wheel zoom smoothness and lack of jump
    const zoomAtEnd = res.zoomSamples[res.zoomSamples.length - 1].z;
    const zoomAtMid = res.zoomSamples[4].z; // 250ms
    console.log('    - Zoom before:', res.zoomBefore.toFixed(4), '| mid-gesture:', zoomAtMid.toFixed(4), '| settled:', zoomAtEnd.toFixed(4));
    assert(zoomAtEnd >= res.zoomBefore, 'Wheel zoom in must increase zoom level');

    const tailSamples = res.zoomSamples.slice(-4);
    let maxTailDrift = 0;
    for (let i = 1; i < tailSamples.length; i++) {
      const d = Math.hypot(tailSamples[i].x - tailSamples[i - 1].x, tailSamples[i].y - tailSamples[i - 1].y);
      if (d > maxTailDrift) maxTailDrift = d;
    }
    console.log('    - Max pixel displacement when zoom settles:', maxTailDrift.toFixed(4), 'px');
    assert(maxTailDrift < 0.5, `Tail displacement must be < 0.5px, got ${maxTailDrift}px`);

    console.log('  ✅ Test 3 passed: Concentric favorite icons, non-overlapping scenic labels, and zero zoom jump verified.');

    console.log('\n=============================================================');
    console.log('🎉 ALL v2.0.40 TESTS PASSED 100% (CONCENTRIC ICONS & STABILITY)');
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

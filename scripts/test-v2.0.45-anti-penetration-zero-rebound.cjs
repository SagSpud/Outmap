const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

console.log('🚀 Starting Outmap v2.0.45 Anti-Penetration & Zero-Rebound Camera Test Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');
const vendorMjs = fs.readFileSync(path.join(root, 'src', 'vendor', 'maplibre-gl.mjs'), 'utf8');

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
assert.strictEqual(pkg.version, '2.0.45', 'package.json must be 2.0.45');
assert(appJs.includes(`const APP_VERSION = '${pkg.version}';`), `app.js APP_VERSION must match package.json (${pkg.version})`);
assert(indexHtml.includes(`v${pkg.version}`), `index.html must reference v${pkg.version}`);
assert(bootstrapJs.includes(`app.js?v=${pkg.version}`), `map-bootstrap.js must reference v${pkg.version}`);
console.log(`  ✅ Test 1 passed: All files synchronized to v${pkg.version}.`);

// [Test 2] Static Camera & Engine Ground Avoidance Audit
console.log('\n[Test 2] Static Camera & Engine Ground Avoidance Audit...');
assert(vendorMjs.includes('_elevateCameraIfInsideTerrain(e){'), 'vendor maplibre-gl.mjs must contain _elevateCameraIfInsideTerrain');
assert(vendorMjs.includes('s=(n-e.elevation)/o'), 'vendor maplibre-gl.mjs must contain camera ground avoidance');
assert(appJs.includes('safeElevateCamera'), 'app.js must contain defensive safeElevateCamera collision guard');
console.log('  ✅ Test 2 passed: Safe camera terrain collision avoidance statically verified in vendor and app layers.');

// [Test 3] Runtime Headless Electron Verification Across Major Chinese Terrains
console.log('\n[Test 3] Runtime Headless Electron Verification Across Major Chinese Terrains...');

const watchdog = setTimeout(() => {
  console.error('❌ Test timed out after 70s');
  app.exit(1);
}, 70000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    win.webContents.on('console-message', (e, level, msg) => console.log(msg));
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const report = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      // 2.0x exaggeration as in user video
      map.setTerrain({ source: 'terrain-dem', exaggeration: 2.0 });

      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();

      const testLocations = [
        { name: 'Mount Gongga (User Video)', center: [101.88331, 29.58041], pitch: 60, zoom: 12.0 },
        { name: 'Taishan (Mount Tai)', center: [117.10, 36.25], pitch: 65, zoom: 13.5 },
        { name: 'Huashan (Mount Hua)', center: [110.08, 34.48], pitch: 72, zoom: 13.8 },
        { name: 'Huangshan (Yellow Mountain)', center: [118.17, 30.13], pitch: 60, zoom: 13.2 },
        { name: 'Siguniangshan', center: [102.90, 31.10], pitch: 68, zoom: 13.0 },
        { name: 'Yulong Snow Mountain', center: [100.20, 27.10], pitch: 70, zoom: 13.0 },
        { name: 'Qomolangma (Everest)', center: [86.92, 27.98], pitch: 72, zoom: 12.5 },
        { name: 'Chongli Ski Area', center: [115.28, 40.97], pitch: 60, zoom: 13.0 },
        { name: 'Linyi (Home city, plain)', center: [118.35, 35.05], pitch: 50, zoom: 13.0 }
      ];

      const results = [];

      for (const loc of testLocations) {
        map.jumpTo({ center: loc.center, zoom: loc.zoom, pitch: loc.pitch, bearing: 45 });
        const LngLat = window.maplibregl.LngLat;
        for (let i = 0; i < 60; i++) {
          await sleep(40);
          const tileZ = Math.min(12, Math.round(loc.zoom));
          const elev = map.terrain?.getElevationForLngLatZoom(LngLat.convert(loc.center), tileZ);
          if (Number.isFinite(elev) && elev > 0) {
            const tr = map._camera?.transform || map.transform;
            if (tr) tr.setElevation(elev);
            map.jumpTo({ center: loc.center, zoom: loc.zoom, pitch: loc.pitch, bearing: 45 });
            if (tr) tr.setElevation(elev);
            break;
          }
        }
        await sleep(100);

        // Test A: 12 rapid zoom-in wheel ticks towards center
        let zoomLogA = [];
        let minDropA = 0;
        let penetrated = false;
        for (let t = 0; t < 12; t++) {
          canvas.dispatchEvent(new WheelEvent('wheel', {
            clientX: rect.left + 512, clientY: rect.top + 384,
            deltaY: -100, bubbles: true, cancelable: true
          }));
          await sleep(25);
          const tr = map._camera?.transform || map.transform;
          const z = map.getZoom();
          const eyeAlt = tr ? tr.getCameraAltitude() : 0;
          const eyeLngLat = tr ? tr.getCameraLngLat() : map.getCenter();
          const terr = map.terrain ? map.terrain.getElevationForLngLatZoom(eyeLngLat, z) : 0;
          if (terr > 0 && eyeAlt < terr) {
            penetrated = true;
            console.log('[' + loc.name + '] Penetration at tick ' + t + ': eyeAlt=' + eyeAlt.toFixed(1) + ', terr=' + terr.toFixed(1) + ', diff=' + (eyeAlt - terr).toFixed(1) + ', zoom=' + z.toFixed(2) + ', pitch=' + map.getPitch().toFixed(1) + ', elev=' + tr.elevation);
          }
          zoomLogA.push(z);
        }
        for (let i = 0; i < 30; i++) {
          await sleep(10);
          zoomLogA.push(map.getZoom());
        }
        let maxSeenA = -Infinity;
        for (const z of zoomLogA) {
          if (z > maxSeenA) maxSeenA = z;
          const drop = maxSeenA - z;
          if (drop > minDropA) minDropA = drop;
        }

        // Test B: 12 rapid zoom-out wheel ticks
        let zoomLogB = [];
        let minRiseB = 0;
        for (let t = 0; t < 12; t++) {
          canvas.dispatchEvent(new WheelEvent('wheel', {
            clientX: rect.left + 512, clientY: rect.top + 384,
            deltaY: 100, bubbles: true, cancelable: true
          }));
          await sleep(25);
          zoomLogB.push(map.getZoom());
        }
        for (let i = 0; i < 30; i++) {
          await sleep(10);
          zoomLogB.push(map.getZoom());
        }
        let minSeenB = Infinity;
        for (const z of zoomLogB) {
          if (z < minSeenB) minSeenB = z;
          const rise = z - minSeenB;
          if (rise > minRiseB) minRiseB = rise;
        }

        // Test C: 360 degree rotation around ground point
        map.jumpTo({ center: loc.center, zoom: loc.zoom, pitch: loc.pitch, bearing: 0 });
        for (let i = 0; i < 60; i++) {
          await sleep(40);
          const tileZ = Math.min(12, Math.round(loc.zoom));
          const elev = map.terrain?.getElevationForLngLatZoom(LngLat.convert(loc.center), tileZ);
          if (Number.isFinite(elev) && elev > 0) {
            const tr = map._camera?.transform || map.transform;
            if (tr) tr.setElevation(elev);
            map.jumpTo({ center: loc.center, zoom: loc.zoom, pitch: loc.pitch, bearing: 0 });
            if (tr) tr.setElevation(elev);
            break;
          }
        }
        await sleep(100);
        map.fire('rotatestart');
        await sleep(50);
        const initialProject = map.project(loc.center);
        let maxRotDrift = 0;
        for (let b = 0; b <= 360; b += 45) {
          map.setBearing(b);
          await sleep(15);
          const p = map.project(loc.center);
          const drift = Math.hypot(p.x - initialProject.x, p.y - initialProject.y);
          if (drift > maxRotDrift) maxRotDrift = drift;
        }
        map.fire('rotateend');

        results.push({
          name: loc.name,
          penetrated,
          zoomInRebound: minDropA,
          zoomOutRebound: minRiseB,
          maxRotDrift: maxRotDrift
        });
      }

      return results;
    })()`);

    let allPass = true;
    for (const r of report) {
      const ok = !r.penetrated && r.zoomInRebound < 0.005 && r.zoomOutRebound < 0.005 && r.maxRotDrift < 2.0;
      if (!ok) allPass = false;
      const badge = ok ? '✅ PASSED' : '❌ FAILED';
      console.log(`  ${badge} [${r.name}]`);
      console.log(`     - Terrain Penetrated: ${r.penetrated ? 'YES (FAIL)' : 'NO (SAFE)'}`);
      console.log(`     - Zoom In Rebound: ${r.zoomInRebound.toFixed(6)}`);
      console.log(`     - Zoom Out Rebound: ${r.zoomOutRebound.toFixed(6)}`);
      console.log(`     - 360° Rotation Drift: ${r.maxRotDrift.toFixed(6)}px`);
    }

    assert(allPass, 'All terrain locations must achieve zero penetration, zero zoom rebound and <= 2px rotation stability');
    console.log('\n  ✅ Test 3 passed: 100% zero penetration, zero rebound and rotation stability verified across all 9 high-relief terrains under 2.0x exaggeration.');

    console.log('\n=============================================================');
    console.log('🎉 ALL v2.0.45 ANTI-PENETRATION & ZERO-REBOUND TESTS PASSED 100%');
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

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

console.log('🚀 Starting Outmap v2.0.43 Zero-Rebound Zoom & Camera Dynamics Test Suite...\n');

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
assert(pkg.version, 'package.json must have valid version');
assert(appJs.includes(`const APP_VERSION = '${pkg.version}';`), `app.js APP_VERSION must match package.json (${pkg.version})`);
assert(indexHtml.includes(`v${pkg.version}`), `index.html must reference v${pkg.version}`);
assert(bootstrapJs.includes(`app.js?v=${pkg.version}`), `map-bootstrap.js must reference v${pkg.version}`);
console.log(`  ✅ Test 1 passed: All files synchronized to v${pkg.version}.`);

// [Test 2] Static Camera & Engine Configuration Audit
console.log('\n[Test 2] Static Camera & Engine Configuration Audit...');
assert(vendorMjs.includes('_elevateCameraIfInsideTerrain(e){return{}}'), 'vendor maplibre-gl.mjs must have neutralized _elevateCameraIfInsideTerrain');
assert(appJs.includes('_elevateCameraIfInsideTerrain'), 'app.js must have defensive neutralization of _elevateCameraIfInsideTerrain');
assert(!appJs.includes('syncCameraGroundElevation(map);\n        scheduleRouteElevationProfileRefresh(map, 420);'), 'app.js must not call syncCameraGroundElevation inside sourcedata');
console.log('  ✅ Test 2 passed: Engine level camera collision neutralization statically verified.');

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
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const report = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;

      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();

      const testLocations = [
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
        for (let i = 0; i < 50; i++) {
          await sleep(40);
          if (Number.isFinite(map.queryTerrainElevation(loc.center))) break;
        }

        // Test A: 10 rapid zoom-in wheel ticks
        let zoomLogA = [];
        let minDropA = 0;
        for (let t = 0; t < 10; t++) {
          canvas.dispatchEvent(new WheelEvent('wheel', {
            clientX: rect.left + 512, clientY: rect.top + 384,
            deltaY: -100, bubbles: true, cancelable: true
          }));
          await sleep(25);
          zoomLogA.push(map.getZoom());
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

        // Test B: 10 rapid zoom-out wheel ticks
        let zoomLogB = [];
        let minRiseB = 0;
        for (let t = 0; t < 10; t++) {
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
          zoomInRebound: minDropA,
          zoomOutRebound: minRiseB,
          maxRotDrift: maxRotDrift
        });
      }

      return results;
    })()`);

    let allPass = true;
    for (const r of report) {
      const ok = r.zoomInRebound < 0.005 && r.zoomOutRebound < 0.005 && r.maxRotDrift < 2.0;
      if (!ok) allPass = false;
      const badge = ok ? '✅ PASSED' : '❌ FAILED';
      console.log(`  ${badge} [${r.name}]`);
      console.log(`     - Zoom In Rebound: ${r.zoomInRebound.toFixed(6)}`);
      console.log(`     - Zoom Out Rebound: ${r.zoomOutRebound.toFixed(6)}`);
      console.log(`     - 360° Rotation Drift: ${r.maxRotDrift.toFixed(6)}px`);
    }

    assert(allPass, 'All terrain locations must achieve zero zoom rebound and <= 2px rotation stability');
    console.log('\n  ✅ Test 3 passed: 100% zero zoom rebound and rotation stability verified across all 8 China terrain locations.');

    console.log('\n=============================================================');
    console.log('🎉 ALL v2.0.43 ZERO-REBOUND TESTS PASSED 100%');
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

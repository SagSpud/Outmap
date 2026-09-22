const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const text = file => read(file).toString('utf8');
const hash = file => crypto.createHash('sha256').update(read(file)).digest('hex');

console.log('Testing v2.0.75 power lifecycle, compatibility, and release gate...');

const pkg = JSON.parse(text('package.json'));
const lock = JSON.parse(text('package-lock.json'));
const app = text('src/app.js');
const html = text('src/index.html');
const bootstrap = text('src/map-bootstrap.js');
const main = text('main.js');
const preload = text('preload.js');

assert.strictEqual(pkg.version, '2.0.75');
assert.strictEqual(lock.version, '2.0.75');
assert(app.includes("const APP_VERSION = '2.0.75';"));
assert(html.includes('v2.0.75'));
assert(bootstrap.includes('app.js?v=2.0.75'));

// Process-wide power listeners must be idempotent and every inactive state
// must participate in the delayed cache trim without reducing foreground quality.
assert(main.includes('powerMonitorEventsBound'));
assert(main.includes('if (powerMonitorEventsBound || !powerMonitor) return;'));
assert(main.includes('systemPowerSuspended = true;'));
assert(main.includes('screenLocked = true;'));
assert(main.includes('runningOnBattery = true;'));
assert(main.includes('!windowMinimized && !systemPowerSuspended && !screenLocked'));
assert(main.includes('BATTERY_INACTIVE_MEMORY_TILE_BYTES'));

// Background transitions may throttle naturally but must never strand an
// in-flight native camera animation halfway to its destination.
assert(!app.includes('mapInstance.stop()'));
assert(app.includes('mapInstance.resize();'));
assert(app.includes('mapInstance.triggerRepaint();'));
assert(preload.includes("removeListener('power-state-change', listener)"));

// Keep the full production regression gate instead of replacing it with a
// handful of string checks.
const releaseChecks = pkg.scripts['pretest:release'].split('&&').map(item => item.trim());
assert(releaseChecks.length >= 36, `release gate is too small: ${releaseChecks.length}`);
for (const required of [
  'test-route-point-inspect.cjs',
  'test-fractional-3d-continuity.cjs',
  'test-v2.0.65-download-flow-and-locating-transition.cjs',
  'test-v2.0.24-favorite-ux-and-camera.cjs',
  'test:desktop-performance'
]) {
  assert(pkg.scripts['pretest:release'].includes(required), `release gate missing ${required}`);
}

assert(!main.includes("appendSwitch('ignore-gpu-blocklist')"));
assert(main.includes("appendSwitch('max-active-webgl-contexts', '32')"));
assert(main.includes("appendSwitch('enable-gpu-rasterization')"));
assert(main.includes("appendSwitch('enable-zero-copy')"));

for (const file of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs']) {
  assert.strictEqual(
    hash(`src/vendor/${file}`),
    hash(`.vendor-maplibre-6.9.0/package/dist/${file}`),
    `${file} must remain the official unmodified MapLibre 6.9.0 bundle`
  );
}

assert(/maxZoom:\s*15\s*,/.test(app));
assert(/scrollZoom:\s*true\s*,/.test(app));
assert(/aroundCenter:\s*false\s*,/.test(app));
assert(/centerClampedToGround:\s*false\s*,/.test(app));
assert(!/setWheelZoomRate|setZoomRate/.test(app));
assert(app.includes('tolerance: 0.1,'));

const locCam = text('src/location-camera.js');
assert(locCam.includes('reconcileColdTerrainLanding'));
assert(locCam.includes('verifyTerrainVisibility'));

const css = text('src/style.css');
for (const retiredToken of [
  '.route-sim-bar', '.update-modal-card', '.fav-marker-wrap',
  '.city-label-marker', '.route-search-item'
]) {
  assert(!css.includes(retiredToken), `retired CSS returned: ${retiredToken}`);
}
assert(!app.includes('function saveOfflineProvState('));
assert(app.includes('routeScreenProjectionCache'));
assert(app.includes('routeCumulativeDistanceCache'));
assert(main.includes('legacyFiles'));
assert(text('src/tile-archive.cjs').includes('legacyFlat'));

for (const file of [
  'main.js', 'preload.js', 'src/app.js', 'src/location-camera.js',
  'src/favorite-interactions.js', 'src/storage-maintenance.js',
  'src/terrain-contours.js'
]) {
  new vm.Script(require('module').wrap(text(file)), { filename: file });
}

console.log('v2.0.75 power lifecycle, compatibility, and release-gate checks passed.');

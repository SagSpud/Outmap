const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const text = file => read(file).toString('utf8');
const hash = file => crypto.createHash('sha256').update(read(file)).digest('hex');

console.log('🧪 Testing v2.0.72 architecture, GPU blocklist policy, and native camera...');

// 1. Version consistency check
const pkg = JSON.parse(text('package.json'));
const lock = JSON.parse(text('package-lock.json'));
const app = text('src/app.js');
const html = text('src/index.html');
const bootstrap = text('src/map-bootstrap.js');
const main = text('main.js');

assert.strictEqual(pkg.version, '2.0.72', 'package.json version must be 2.0.72');
assert.strictEqual(lock.version, '2.0.72', 'package-lock.json version must be 2.0.72');
assert(app.includes("const APP_VERSION = '2.0.72';"), 'src/app.js APP_VERSION must be 2.0.72');
assert(html.includes('v2.0.72'), 'src/index.html must reference v2.0.72');
assert(bootstrap.includes('app.js?v=2.0.72'), 'src/map-bootstrap.js must reference ?v=2.0.72');
console.log('  ✅ Version consistency verified (2.0.72)');

// 2. GPU Blocklist policy verification
assert(!main.includes("appendSwitch('ignore-gpu-blocklist')"),
  'main.js must respect GPU compatibility blocklist to prevent driver crashes');
assert(main.includes("appendSwitch('max-active-webgl-contexts', '32')"),
  'main.js must allocate sufficient WebGL contexts');
assert(main.includes("appendSwitch('enable-gpu-rasterization')"),
  'main.js must enable standard GPU rasterization');
assert(main.includes("appendSwitch('enable-zero-copy')"),
  'main.js must enable zero-copy GPU memory transfer');
console.log('  ✅ GPU blocklist policy and WebGL stability switches verified');

// 3. Official vendor bundle integrity
for (const file of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs']) {
  assert.strictEqual(
    hash(`src/vendor/${file}`),
    hash(`.vendor-maplibre-6.9.0/package/dist/${file}`),
    `${file} must remain the official unmodified MapLibre 6.9.0 bundle`
  );
}
console.log('  ✅ Official MapLibre 6.9.0 bundle SHA256 integrity verified');

// 4. Native camera & zoom boundaries
assert(/maxZoom:\s*15\s*,/.test(app), 'map must stop natively at L15 to match tile limits');
assert(/scrollZoom:\s*true\s*,/.test(app), 'wheel zoom must retain native cursor anchoring');
assert(/aroundCenter:\s*false\s*,/.test(app), 'right-drag rotation direction must remain consistent');
assert(/centerClampedToGround:\s*false\s*,/.test(app), 'terrain must not resettle the camera after a gesture');
assert(!/setWheelZoomRate|setZoomRate/.test(app), 'native MapLibre wheel rates must not be overridden');
assert(app.includes('tolerance: 0.1,'), 'route geometry precision improvement must be retained');
console.log('  ✅ Native camera options and route tolerance verified');

// 5. Cold terrain landing guard
const locCam = text('src/location-camera.js');
assert(locCam.includes('reconcileColdTerrainLanding'), 'location-camera must include cold terrain landing reconciler');
assert(locCam.includes('verifyTerrainVisibility'), 'location-camera must include terrain visibility guard');
console.log('  ✅ Cold terrain landing guards in location-camera verified');

// 6. Syntax validation
for (const file of [
  'main.js',
  'preload.js',
  'src/app.js',
  'src/location-camera.js',
  'src/favorite-interactions.js',
  'src/storage-maintenance.js',
  'src/terrain-contours.js'
]) {
  const code = text(file);
  new vm.Script(require('module').wrap(code), { filename: file });
}
console.log('  ✅ Production JavaScript files parsed cleanly without syntax errors');

console.log('🎉 All v2.0.72 architecture, GPU blocklist, and camera checks passed successfully!');

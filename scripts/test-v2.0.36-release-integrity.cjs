const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🚀 Starting Outmap v2.0.36 Release Integrity & Brand Flip Verification Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const htmlSource = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const bootSource = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');
const maintSource = fs.readFileSync(path.join(root, 'src', 'storage-maintenance.js'), 'utf8');
const cameraSource = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

// [Test 1] Version Consistency
console.log('[Test 1] Version 2.0.36 Consistency Audit...');
assert.strictEqual(pkg.version, '2.0.36', 'package.json version must be 2.0.36');
assert(appSource.includes("const APP_VERSION = '2.0.36';"), 'app.js must declare APP_VERSION 2.0.36');
assert(htmlSource.includes('style.css?v=2.0.36'), 'index.html must link style.css?v=2.0.36');
assert(htmlSource.includes('>v2.0.36</span>'), 'index.html brand badge must display v2.0.36');
assert(htmlSource.includes('map-bootstrap.js?v=2.0.36'), 'index.html must import map-bootstrap.js?v=2.0.36');

const expectedScripts = [
  'terrain-contours.js?v=2.0.36',
  'map-native-icons.js?v=2.0.36',
  'location-camera.js?v=2.0.36',
  'favorite-interactions.js?v=2.0.36',
  'geo-constants.js?v=2.0.36',
  'route-simulator.js?v=2.0.36',
  'storage-maintenance.js?v=2.0.36',
  'app.js?v=2.0.36'
];
for (const s of expectedScripts) {
  assert(bootSource.includes(s), `map-bootstrap.js must include ${s}`);
}
console.log('  ✅ Test 1 passed: All core files strictly aligned to v2.0.36.');

// [Test 2] Brand Flip 3D Hierarchy & Anti-Bleed
console.log('\n[Test 2] Brand Flip 3D Face Stacking & Backface Invisibility Audit...');
assert(htmlSource.includes('class="brand-flip-face brand-flip-front"'), 'index.html front face must have brand-flip-face');
assert(htmlSource.includes('class="brand-flip-face brand-flip-back"'), 'index.html back face must have brand-flip-face');
assert(styleSource.includes('.brand-flip-face,\n.brand-flip-front,\n.brand-flip-back'), 'style.css must robustly select both front and back faces');
assert(styleSource.includes('position: absolute !important;'), 'brand flip faces must be forced absolute to avoid side-by-side push');
assert(styleSource.includes('backface-visibility: hidden !important;'), 'brand flip faces must hide backface to avoid upside down bleed');
console.log('  ✅ Test 2 passed: Brand flip 3D card layout strictly enforced.');

// [Test 3] Modal Anti-Bleed & Visual Contrast
console.log('\n[Test 3] Modal Anti-Bleed & Visual Contrast Audit...');
assert(maintSource.includes('background: #ffffff !important'), 'Modal card must have 100% solid white background');
assert(maintSource.includes('color: #334155'), 'Content text must use high-contrast dark slate font');
assert(styleSource.includes('#storage-maintenance-overlay'), 'style.css must have dedicated #storage-maintenance-overlay styles');
assert(styleSource.includes('rgba(15, 23, 42, 0.52) !important'), 'Backdrop overlay must have deep dimming');
console.log('  ✅ Test 3 passed: Modal solid white card and deep backdrop contrast verified.');

// [Test 4] Escape Key Hierarchy & Capture Dispatch
console.log('\n[Test 4] Escape Key Hierarchy & Capture Dispatch Audit...');
assert(maintSource.includes("window.addEventListener('keydown', handleKeyDown, true)"), 'Modal must capture Escape in capture phase');
assert(maintSource.includes("e.preventDefault()"), 'Escape handler must prevent default');
assert(maintSource.includes("e.stopPropagation()"), 'Escape handler must stop propagation');
assert(maintSource.includes("e.stopImmediatePropagation()"), 'Escape handler must stop immediate propagation');
assert(appSource.includes('activeUpperModal'), 'app.js backdrop click must check for activeUpperModal');
assert(appSource.includes('storageMaintenanceOverlay'), 'app.js global dispatcher must intercept storageMaintenanceOverlay first on Escape');
console.log('  ✅ Test 4 passed: Escape capture & modal hierarchy isolation verified.');

// [Test 5] Silky Camera Flight Dynamics
console.log('\n[Test 5] Silky Camera Flight Dynamics Model...');
assert(cameraSource.includes('computeAdaptiveFlight'), 'location-camera.js must export computeAdaptiveFlight');
assert(cameraSource.includes('curve: 1.42'), 'location-camera.js must use golden van Wijk curve 1.42');
assert(cameraSource.includes('clamped * (clamped * 6 - 15) + 10'), 'location-camera.js must use C2 smootherstep');

const mockWindow = { matchMedia: () => ({ matches: false }) };
const Point = class { constructor(x, y) { this.x = x; this.y = y; } sub(o) { return new Point(this.x - o.x, this.y - o.y); } };
const fn = new Function('window', 'maplibregl', 'document', 'performance', cameraSource);
fn(mockWindow, { Point }, { getElementById: () => null }, { now: () => Date.now() });

const compute = mockWindow.OutmapLocationCamera.computeAdaptiveFlight;
const mapMock = (lng, lat, zoom) => ({
  getCenter: () => ({ lng, lat }),
  getZoom: () => zoom,
  getContainer: () => ({ clientWidth: 1200, clientHeight: 800 }),
  project: (c) => new Point(c[0] * 10, c[1] * 10)
});

const fLocal = compute(mapMock(104.06, 30.57, 12), [104.07, 30.57], 12);
const fCity = compute(mapMock(104.06, 30.57, 12), [104.30, 30.60], 12);
const fProv = compute(mapMock(104.06, 30.57, 7.2), [106.55, 29.56], 7.2);
const fCountry = compute(mapMock(104.5, 36.0, 4), [121.47, 31.23], 12);

assert(fLocal.duration >= 450 && fLocal.duration <= 650, 'Local flights must be between 450ms and 650ms');
assert(fCity.duration > fLocal.duration && fCity.duration <= 950, 'City flights must be between 650ms and 950ms');
assert(fProv.duration > fCity.duration && fProv.duration <= 1100, 'Province flights must be between 950ms and 1100ms');
assert(fCountry.duration > fProv.duration && fCountry.duration <= 1200, 'Country flights must be between 1100ms and 1200ms');
console.log('  ✅ Test 5 passed: Camera flight mathematical model verified.');

console.log('\n======================================================');
console.log('🎉 ALL v2.0.36 RELEASE INTEGRITY CHECKS PASSED 100%!');
console.log('======================================================\n');

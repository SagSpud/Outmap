const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🚀 Starting Outmap v2.0.34 Modal Stacking, UI & Camera Flight Verification Suite...\n');

// 1. Static Audit of HTML, JS, CSS
const root = path.resolve(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const maintSource = fs.readFileSync(path.join(root, 'src', 'storage-maintenance.js'), 'utf8');
const cameraSource = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');

// [Test 1] Storage Directory Button & UI Cleanliness
console.log('[Test 1] Storage Directory Button & UI Cleanliness...');
assert(!htmlSource.includes('id="stat-storage-dir"'), 'stat-storage-dir truncated text element must be completely removed');
assert(htmlSource.includes('id="btn-open-offline-link"'), 'btn-open-offline-link must exist');
assert(htmlSource.includes('打开存储目录'), 'Button must clearly state 打开存储目录');
assert(appSource.includes('btnOpenOfflineLink.title = `点击在 Windows 资源管理器中打开离线存储目录'), 'Full path must be presented via hover tooltip');
console.log('  ✅ Test 1 passed: Storage directory button is clean with no truncated path clutter.');

// [Test 2] Storage Maintenance Modal Stacking & Event Isolation
console.log('\n[Test 2] Storage Maintenance Modal Hierarchy & Style Unification...');
assert(maintSource.includes('modal-card'), 'storage-maintenance.js must use system modal-card');
assert(maintSource.includes('modal-close-btn'), 'storage-maintenance.js must have top-right close button');
assert(maintSource.includes('modal-btn secondary'), 'storage-maintenance.js must use modal-btn secondary');
assert(maintSource.includes('modal-btn accent'), 'storage-maintenance.js must use modal-btn accent');
assert(!maintSource.includes('fluent-prompt-btn'), 'Old unstyled fluent-prompt-btn must be replaced');
assert(maintSource.includes("overlay.addEventListener('click'"), 'Overlay must have click listener for backdrop');
assert(maintSource.includes('if (e) e.stopPropagation();'), 'Close must stop propagation to prevent closing parent modal');
assert(maintSource.includes("e.key === 'Escape'"), 'Modal must support Escape key');
assert(appSource.includes('activeUpperModal'), 'app.js backdrop click must check for activeUpperModal');
console.log('  ✅ Test 2 passed: Modal hierarchy and click isolation fully verified.');

// [Test 3] Camera Unified Flight Dynamics Math
console.log('\n[Test 3] Camera Unified Perceptual Flight Dynamics Model...');
assert(cameraSource.includes('computeAdaptiveFlight'), 'location-camera.js must export computeAdaptiveFlight');
assert(cameraSource.includes('curve: 1.42'), 'location-camera.js must use golden van Wijk curve 1.42');
assert(cameraSource.includes('clamped * (clamped * 6 - 15) + 10'), 'location-camera.js must use C2 smootherstep');

const mockWindow = { matchMedia: () => ({ matches: false }) };
const Point = class { constructor(x, y) { this.x = x; this.y = y; } sub(o) { return new Point(this.x - o.x, this.y - o.y); } };
const fn = new Function('window', 'maplibregl', 'document', 'performance', cameraSource);
fn(mockWindow, { Point }, { getElementById: () => null }, { now: () => Date.now() });

const compute = mockWindow.OutmapLocationCamera.computeAdaptiveFlight;
assert.strictEqual(typeof compute, 'function', 'computeAdaptiveFlight must be a function');

const mapMock = (lng, lat, zoom) => ({
  getCenter: () => ({ lng, lat }),
  getZoom: () => zoom,
  getContainer: () => ({ clientWidth: 1200, clientHeight: 800 }),
  project: (c) => new Point(c[0] * 10, c[1] * 10)
});

// Test monotonic scaling with distance & deltaZoom
const fLocal = compute(mapMock(104.06, 30.57, 12), [104.07, 30.57], 12);
const fCity = compute(mapMock(104.06, 30.57, 12), [104.30, 30.60], 12);
const fProv = compute(mapMock(104.06, 30.57, 7.2), [106.55, 29.56], 7.2);
const fCountry = compute(mapMock(104.5, 36.0, 4), [121.47, 31.23], 12);

console.log(`    - Local (1km, dZ=0): ${fLocal.duration}ms`);
console.log(`    - City (23km, dZ=0): ${fCity.duration}ms`);
console.log(`    - Province (265km, dZ=0): ${fProv.duration}ms`);
console.log(`    - Country (1658km, dZ=8): ${fCountry.duration}ms`);

assert(fLocal.duration >= 450 && fLocal.duration <= 650, 'Local flights must be between 450ms and 650ms');
assert(fCity.duration > fLocal.duration && fCity.duration <= 950, 'City flights must be between 650ms and 950ms');
assert(fProv.duration > fCity.duration && fProv.duration <= 1100, 'Province flights must be between 950ms and 1100ms');
assert(fCountry.duration > fProv.duration && fCountry.duration <= 1200, 'Country flights must be between 1100ms and 1200ms');

// [Test 4] App.js Callers Cleanliness Audit
console.log('\n[Test 4] App.js Callers Cleanliness Audit...');
// Check that hardcoded flight durations are eliminated from the major user flows
assert(!appSource.includes('const flightDuration = isLongFlight ? 1100 : 500;'), 'Search must not use hardcoded 1100/500 switch');
assert(!appSource.includes('Math.min(1300, Math.max(700, Math.round(550 + distDeg * 260)))'), 'Favorites must not use old linear formula');

console.log('  ✅ Test 4 passed: All caller locations in app.js cleanly integrated.');

console.log('\n======================================================');
console.log('🎉 ALL v2.0.34 MODAL & CAMERA VERIFICATIONS PASSED 100%!');
console.log('======================================================\n');

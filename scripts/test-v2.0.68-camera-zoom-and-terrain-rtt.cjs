const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('🧪 Testing v2.0.68 camera zoom, rotation direction, and terrain RTT quality...');

const rootDir = path.resolve(__dirname, '..');

// 1. Version consistency check
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(rootDir, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'src', 'index.html'), 'utf8');
const bootstrapJs = fs.readFileSync(path.join(rootDir, 'src', 'map-bootstrap.js'), 'utf8');

assert.strictEqual(pkg.version, '2.0.68', 'package.json version should be 2.0.68');
assert.strictEqual(lock.version, '2.0.68', 'package-lock.json version should be 2.0.68');
assert(appJs.includes("const APP_VERSION = '2.0.68';"), 'app.js APP_VERSION should be 2.0.68');
assert(indexHtml.includes('v2.0.68'), 'index.html should have v2.0.68');
assert(bootstrapJs.includes('app.js?v=2.0.68'), 'map-bootstrap.js should have ?v=2.0.68');
console.log('  ✅ Version consistency verified (2.0.68)');

// 2. Vendor MapLibre enhancements
const maplibreMjs = fs.readFileSync(path.join(rootDir, 'src', 'vendor', 'maplibre-gl.mjs'), 'utf8');
assert(maplibreMjs.includes('aroundCenter:n=!1'), 'MapLibre DragRotateHandler should default aroundCenter to false');
assert(
  maplibreMjs.includes('this._terrainSkirtLength=r,this.qualityFactor=typeof n.qualityFactor=="number"?n.qualityFactor:4,this.meshSize=128'),
  'MapLibre Terrain constructor should support dynamic qualityFactor defaulting to 4'
);

const sharedMjs = fs.readFileSync(path.join(rootDir, 'src', 'vendor', 'maplibre-gl-shared.mjs'), 'utf8');
assert(sharedMjs.includes('qualityFactor:{type:`number`,minimum:1,default:4}'), 'Terrain style spec schema should validate qualityFactor');
console.log('  ✅ Vendor MapLibre patches verified (aroundCenter: false, qualityFactor: 4)');

// 3. Camera zoom & rotation settings in app.js
assert(appJs.includes('maxZoom: 18,'), 'app.js should allow maxZoom up to 18');
assert(appJs.includes('scrollZoom: true,'), 'app.js should enable natural cursor-anchored scrollZoom');
assert(appJs.includes('aroundCenter: false,'), 'app.js should pass aroundCenter: false for map rotation');
assert(appJs.includes('map.scrollZoom?.setWheelZoomRate?.(1 / 450);'), 'app.js should use natural wheel zoom rate');
assert(appJs.includes('map.scrollZoom?.setZoomRate?.(1 / 100);'), 'app.js should use natural zoom rate');
console.log('  ✅ Camera zoom and rotation config in app.js verified');

// 4. Terrain qualityFactor and Route line tolerance
const terrainCalls = [...appJs.matchAll(/map\.setTerrain\(\{[^}]+\}\)/g)];
assert(terrainCalls.length >= 2, 'app.js should have setTerrain invocations');
for (const match of terrainCalls) {
  assert(match[0].includes('qualityFactor: 4'), `setTerrain call must include qualityFactor: 4: ${match[0]}`);
}
assert(appJs.includes('tolerance: 0.1,'), 'Route layers should have Douglas-Peucker tolerance tightened to 0.1');
assert(!appJs.includes('tolerance: 0.8,'), 'tolerance 0.8 should be removed');
assert(!appJs.includes('tolerance: 0.5,'), 'tolerance 0.5 should be removed');
console.log('  ✅ Terrain RTT qualityFactor=4 and Route tolerance=0.1 verified');

// 5. Syntax validation
new vm.Script(require('module').wrap(appJs), { filename: 'src/app.js' });
console.log('  ✅ src/app.js parses cleanly without syntax errors');

console.log('🎉 All v2.0.68 camera zoom, rotation, and terrain RTT tests passed successfully!');
process.exit(0);

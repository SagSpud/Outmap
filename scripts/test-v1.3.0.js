const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');

assert.strictEqual(pkg.version, '1.3.0');
assert(html.includes('app.js?v=1.3.0'));
assert(html.includes('style.css?v=1.3.0'));

assert(app.includes('function flyToLocationPrecisely('));
assert(app.includes("map.once('moveend', settle)"));
assert(app.includes('const base = map.project(coords)'));
assert(app.includes('const determinant = a * d - b * c'));
assert(app.includes('map.transform.setElevation(targetElevation)'));
assert(app.includes('map.transform.setLocationAtPoint('));
assert(!app.includes('function calculateOffsetCameraCenter('));
assert(app.includes('searchRequestSequence'));
assert(app.includes('requestSequence !== searchRequestSequence'));

assert(app.includes('demCache: 256, tileCache: 256, prefetch: 0'));
assert(app.includes("'line-color': '#34c759'"));
assert(app.includes("data.source !== 'local-engine'"));

assert(main.includes('MAX_MEMORY_TILE_BYTES'));
assert(main.includes('failedCount === 0'));
assert(main.includes("actualSha256 === expectedSha256"));
assert(!main.includes("disable-background-timer-throttling"));
assert(!main.includes('session.clearCache()'));

assert(css.includes('@media (prefers-reduced-motion: reduce)'));
assert(css.includes('blur(13px) saturate(145%)'));

new Function(app);
new Function(main);
console.log('Outmap v1.3.0 verification passed.');

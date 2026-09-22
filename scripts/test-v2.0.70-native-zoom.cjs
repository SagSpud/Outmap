const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const text = file => read(file).toString('utf8');
const hash = file => crypto.createHash('sha256').update(read(file)).digest('hex');

const pkg = JSON.parse(text('package.json'));
const lock = JSON.parse(text('package-lock.json'));
const app = text('src/app.js');
const html = text('src/index.html');
const bootstrap = text('src/map-bootstrap.js');

assert(/^2\.0\.(?:[7-9]\d|\d{3,})$/.test(pkg.version));
assert.strictEqual(lock.version, pkg.version);
assert(app.includes(`const APP_VERSION = '${pkg.version}';`));
assert(html.includes(`v${pkg.version}`));
assert(bootstrap.includes(`app.js?v=${pkg.version}`));

for (const file of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs']) {
  assert.strictEqual(
    hash(`src/vendor/${file}`),
    hash(`.vendor-maplibre-6.9.0/package/dist/${file}`),
    `${file} must remain the official unmodified MapLibre 6.9.0 bundle`
  );
}

assert(/maxZoom:\s*15\s*,/.test(app), 'map must stop natively at L15');
assert(/scrollZoom:\s*true\s*,/.test(app), 'wheel zoom must retain native cursor anchoring');
assert(/aroundCenter:\s*false\s*,/.test(app), 'right-drag rotation direction must remain consistent');
assert(/centerClampedToGround:\s*false\s*,/.test(app), 'terrain must not resettle the camera after a gesture');
assert(!/setWheelZoomRate|setZoomRate/.test(app), 'native MapLibre wheel rates must not be overridden');
assert(!/qualityFactor\s*:/.test(app), 'non-standard terrain RTT expansion must not return');
assert(app.includes('tolerance: 0.1,'), 'route geometry precision improvement must be retained');
assert(!/map\.on\(['"](?:zoomend|moveend)['"][\s\S]{0,240}(?:jumpTo|easeTo|flyTo)/.test(app),
  'gesture end handlers must not apply a second camera move');

new vm.Script(require('module').wrap(app), { filename: 'src/app.js' });
console.log('v2.0.70 native pointer zoom and L15 boundary checks passed');

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const htmlText = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

assert(!htmlText.includes('map-performance.js'), 'retired map-performance script must not be loaded');
assert(!fs.existsSync(path.join(root, 'src/map-performance.js')), 'retired map-performance script must be removed');
assert(!/\.setPixelRatio\s*\(/.test(appText), 'map rendering must keep MapLibre/native display DPR');
assert(!/setLayoutProperty\([^\n]*['"]visibility['"]\s*,\s*['"]none['"][^\n]*(poi|icon)/i.test(appText),
  'motion optimization must not hide POI or icon layers');
assert(!appText.includes('OutmapMapPerformance'), 'retired no-op performance controller must have no runtime calls');

console.log('Desktop native DPR, persistent layers and retired-controller cleanup passed.');

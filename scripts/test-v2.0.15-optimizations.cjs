const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Running Outmap v2.0.15 Optimization Verification Suite...');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const mapBootstrapJs = fs.readFileSync(path.join(root, 'src/map-bootstrap.js'), 'utf8');

// 1. Version consistency check
const curVer = pkg.version;
assert(['2.0.15', '2.0.16', '2.0.17', '2.0.18', '2.0.19', '2.0.20'].includes(curVer), `package.json version must be 2.0.15 through 2.0.20, found: ${curVer}`);
assert(indexHtml.includes(`style.css?v=${curVer}`), `index.html must reference style.css?v=${curVer}`);
assert(indexHtml.includes(`id="brand-ver-badge-txt">v${curVer}</span>`), `index.html brand badge must show v${curVer}`);
assert(indexHtml.includes(`map-bootstrap.js?v=${curVer}`), `index.html must reference map-bootstrap.js?v=${curVer}`);
assert(mapBootstrapJs.includes(`app.js?v=${curVer}`), `map-bootstrap.js must load app.js?v=${curVer}`);
assert(appJs.includes(`const APP_VERSION = '${curVer}';`), `app.js must declare APP_VERSION = ${curVer}`);
console.log(`  [PASS] 1. Version ${curVer} unified across package.json, index.html, map-bootstrap.js, and app.js`);

// 2. Search In-Flight Abort & 0ms LRU Memory Cache
assert(appJs.includes('const searchMemoryCache = new Map();'), 'app.js must define searchMemoryCache');
assert(appJs.includes('function getCachedSearchResults'), 'app.js must implement getCachedSearchResults');
assert(appJs.includes('function setCachedSearchResults'), 'app.js must implement setCachedSearchResults');
assert(appJs.includes('function cancelActiveSearch'), 'app.js must implement cancelActiveSearch');
assert(appJs.includes('window.cancelActiveSearch = cancelActiveSearch'), 'app.js must expose cancelActiveSearch on window');
assert(preloadJs.includes('cancelSearchLocation: () => ipcRenderer.invoke(\'cancel-search-location\')'), 'preload.js must expose cancelSearchLocation');
assert(mainJs.includes('cancel-search-location'), 'main.js must handle cancel-search-location IPC');
assert(mainJs.includes('activeIpcSearchController'), 'main.js must track activeIpcSearchController');
assert(mainJs.includes('upstreamSearchController'), 'main.js must handle upstreamSearchController for HTTP /search');
console.log('  [PASS] 2. Search instant LRU cache and multi-layer AbortController cancellation verified');

// 3. Route Elevation Profile Fingerprinting
assert(appJs.includes('computeRouteElevationFingerprint'), 'app.js must implement computeRouteElevationFingerprint');
assert(appJs.includes('lastElevationProfileFingerprint'), 'app.js must track lastElevationProfileFingerprint');
assert(appJs.includes('lastElevationProfileAllKnown'), 'app.js must track lastElevationProfileAllKnown');
assert(appJs.includes('sampleRouteElevationData.lastSampleAllKnown'), 'app.js must record lastSampleAllKnown in sampleRouteElevationData');
console.log('  [PASS] 3. Route elevation profile coordinate fingerprinting and redundant refresh elimination verified');

// 4. Local Tile Server ETag & 304 Not Modified Caching
assert(mainJs.includes('function generateTileEtag'), 'main.js must implement generateTileEtag');
assert(mainJs.includes('function respondWithBuffer'), 'main.js must implement respondWithBuffer');
assert(mainJs.includes("if (clientEtag && clientEtag === etag)"), 'main.js respondWithBuffer must check client If-None-Match');
assert(mainJs.includes("res.writeHead(304,"), 'main.js respondWithBuffer must write 304 Not Modified');

assert(mainJs.includes("crypto.createHash('sha1').update(data)"),
  'tile ETags must fingerprint content, not only path and byte length');
assert(!mainJs.includes("cacheKey.replace(/[^a-zA-Z0-9_\\-]/g, '_')_${length.toString(16)}"),
  'same-length tile replacements must not reuse the previous ETag');
console.log('  [PASS] 4. Local HTTP tile server ETag & 304 Not Modified conditional caching verified');

// 5. Light Acrylic Backdrop-Filter (8px blur & 125% saturation)
assert(styleCss.includes('--glass-blur: 8px;'), 'style.css root must set --glass-blur: 8px');
assert(styleCss.includes('--glass-saturation: 125%;'), 'style.css root must set --glass-saturation: 125%');
assert(styleCss.includes('--glass-surface: rgba(255, 255, 255, 0.93);'), 'style.css root must set --glass-surface to 0.93');
assert(styleCss.includes('.search-popover-box {') && styleCss.includes('rgba(255, 255, 255, 0.89) !important'),
  'search-popover-box must preserve 0.89 frosted acrylic for test-v1.6.8 compatibility');
assert(styleCss.includes('backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation)) !important;'),
  'style.css must use CSS variable for backdrop-filter');
console.log('  [PASS] 5. Light acrylic backdrop-filter (8px blur, 125% saturation) verified');

console.log('\nAll Outmap v2.0.15 optimizations passed successfully!');

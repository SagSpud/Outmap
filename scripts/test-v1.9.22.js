const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const camera = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');

// 1. Version consistency
assert(/^1\.9\.(22|23|24|25|26|27|28|29)$/.test(pkg.version), 'package.json version must be 1.9.22 or higher');
assert(/^1\.9\.(22|23|24|25|26|27|28|29)$/.test(lock.version), 'package-lock.json version must be 1.9.22 or higher');
assert(/^1\.9\.(22|23|24|25|26|27|28|29)$/.test(lock.packages[''].version), 'package-lock.json root package version must be 1.9.22 or higher');
assert(/const APP_VERSION = '1\.9\.(22|23|24|25|26|27|28|29)';/.test(app), 'app.js must declare current APP_VERSION');
assert(/style\.css\?v=1\.9\.(22|23|24|25|26|27|28|29)/.test(html), 'index.html must reference current style.css');
assert(/app\.js\?v=1\.9\.(22|23|24|25|26|27|28|29)/.test(html), 'index.html must reference current app.js');
assert(/location-camera\.js\?v=1\.9\.(22|23|24|25|26|27|28|29)/.test(html), 'index.html must reference current location-camera.js');
assert(/id="brand-ver-badge-txt">v1\.9\.(22|23|24|25|26|27|28|29)<\/span>/.test(html), 'index.html must display version badge');

// 2. Status bar FPS complete removal
assert(!html.includes('id="status-fps"'), 'status bar HTML must not contain #status-fps');
assert(!app.includes('updateFps'), 'app.js must not contain updateFps');
assert(!app.includes('fpsTimer'), 'app.js must not contain fpsTimer');
assert(!app.includes('renderedFrames'), 'app.js must not contain renderedFrames');

// 3. Location Camera anchoring and zoom cap 13.0
assert(camera.includes('Number.isFinite(options.zoom) ? options.zoom : 13.0'), 'default flight zoom must be 13.0');
assert(camera.includes('(centered ? 0.5 : 0.68)'), 'visual anchor for uncentered points must be 0.68');
assert(camera.includes('route-panel') && camera.includes('favorites-drawer'), 'camera anchor must discount right side panels');
assert(camera.includes('options.elevation > 0'), 'camera endpoint must not let ele:0 override real 3D terrain elevation');
assert(!camera.includes('suppressedLayers'), 'location camera must not hide route lines during flight to prevent blinking');

// 4. Zoom levels capped at 13.0 across all interaction points
assert(!app.includes('zoom: 14.8'), 'app.js must not contain zoom 14.8');
assert(!app.includes('routeStartZoom = 14.5;'), 'app.js routeStartZoom must not be 14.5');
assert(!app.includes('routeEndZoom = 14.5;'), 'app.js routeEndZoom must not be 14.5');
assert(app.includes('let routeStartZoom = 13.0;'), 'routeStartZoom must default to 13.0');
assert(app.includes('let routeEndZoom = 13.0;'), 'routeEndZoom must default to 13.0');

// 5. Large zoom level layer optimizations
assert(app.includes("id: 'osm-places-cities'") && app.includes('maxzoom: 14'), 'osm-places-cities must have maxzoom 14');
assert(app.includes("id: 'osm-places-towns'") && app.includes('maxzoom: 15.5'), 'osm-places-towns must have maxzoom 15.5');
assert(app.includes("'circle-pitch-alignment': 'viewport'"), 'favorite hover and route halo must use circle-pitch-alignment: viewport');

console.log('✅ ALL v1.9.22 TESTS AND REGRESSION ASSERTIONS PASSED!');
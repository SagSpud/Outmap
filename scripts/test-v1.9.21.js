const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

// 1. Version consistency
assert(/^1\.9\.(21|22|23|24|25|26|27|28)$/.test(pkg.version), 'package.json version must be 1.9.21+');
assert(/^1\.9\.(21|22|23|24|25|26|27|28)$/.test(lock.version), 'package-lock.json version must be 1.9.21+');
assert(/^1\.9\.(21|22|23|24|25|26|27|28)$/.test(lock.packages[''].version), 'package-lock.json root package version must be 1.9.21+');
assert(/const APP_VERSION = '1\.9\.(21|22|23|24|25|26|27|28)';/.test(app), 'app.js must declare current APP_VERSION');
assert(/style\.css\?v=1\.9\.(21|22|23|24|25|26|27|28)/.test(html), 'index.html must reference current style.css');
assert(/app\.js\?v=1\.9\.(21|22|23|24|25|26|27|28)/.test(html), 'index.html must reference current app.js');
assert(/location-camera\.js\?v=1\.9\.(21|22|23|24|25|26|27|28)/.test(html), 'index.html must reference current location-camera.js');
assert(/id="brand-ver-badge-txt">v1\.9\.(21|22|23|24|25|26|27|28)<\/span>/.test(html), 'index.html must display version badge');

// 2. Waypoint context menu: rename button must be placed at the very bottom (after delete)
const wpDeleteIdx = app.indexOf('fav-type-delete');
const wpRenameIdx = app.indexOf('fav-type-rename');
assert(wpDeleteIdx !== -1, 'fav-type-delete must exist');
assert(wpRenameIdx !== -1, 'fav-type-rename must exist');
assert(wpDeleteIdx < wpRenameIdx, 'In waypoint menu, delete must precede rename so rename is at the very bottom');

// 3. Route context menu: rename button must be placed at the very bottom (after export and delete)
const routeExportIdx = app.indexOf('btn-ctx-export');
const routeDelIdx = app.indexOf('btn-ctx-del');
const routeRenameIdx = app.indexOf('btn-ctx-rename');
assert(routeExportIdx !== -1, 'btn-ctx-export must exist');
assert(routeDelIdx !== -1, 'btn-ctx-del must exist');
assert(routeRenameIdx !== -1, 'btn-ctx-rename must exist');
assert(routeExportIdx < routeDelIdx, 'In route menu, export must come before delete');
assert(routeDelIdx < routeRenameIdx, 'In route menu, delete must come before rename so rename is at the very bottom');

console.log('✅ v1.9.21 MENU ORDERING AND REGRESSION ASSERTIONS PASSED!');

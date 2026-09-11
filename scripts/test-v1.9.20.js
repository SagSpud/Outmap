const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const camera = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');

// 1. Version consistency
assert.strictEqual(pkg.version, '1.9.20', 'package.json version must be 1.9.20');
assert.strictEqual(lock.version, '1.9.20', 'package-lock.json version must be 1.9.20');
assert.strictEqual(lock.packages[''].version, '1.9.20', 'package-lock.json root package version must be 1.9.20');
assert(app.includes("const APP_VERSION = '1.9.20';"), 'app.js must declare current APP_VERSION');
assert(html.includes('style.css?v=1.9.20'), 'index.html must reference current style.css');
assert(html.includes('app.js?v=1.9.20'), 'index.html must reference current app.js');
assert(html.includes('location-camera.js?v=1.9.20'), 'index.html must reference current location-camera.js');
assert(html.includes('id="brand-ver-badge-txt">v1.9.20</span>'), 'index.html must display v1.9.20');

// 2. Folder tabs drag-and-drop & renaming
assert(css.includes('.fav-tab[draggable="true"]'), 'style.css must have draggable fav-tab styles');
assert(css.includes('.fav-tab.is-dragging'), 'style.css must style active dragging tab');
assert(css.includes('.fav-tab.drag-over-left'), 'style.css must style drag-over indicator');
assert(css.includes('.fav-folder-context-menu'), 'style.css must style folder context menu');
assert(app.includes('renameCustomFolder'), 'app.js must implement renameCustomFolder');
assert(app.includes('deleteCustomFolder'), 'app.js must implement deleteCustomFolder');
assert(app.includes('showFolderTabContextMenu'), 'app.js must implement showFolderTabContextMenu');
assert(app.includes('btn.draggable = true'), 'app.js must make custom folder tabs draggable');
assert(app.includes("localStorage.setItem('outmap_custom_folders'"), 'app.js must persist reordered custom folders');

// 3. Waypoint and route renaming
assert(css.includes('.fav-point-type-menu .fav-type-rename'), 'style.css must style waypoint rename button');
assert(app.includes('class="ctx-item fav-type-rename"'), 'app.js must include rename button in waypoint context menu');
assert(app.includes('class="ctx-item fav-route-context-item btn-ctx-rename"'), 'app.js must include rename button in route context menu');
assert(app.includes('showFluentPrompt'), 'app.js must implement showFluentPrompt');
assert(css.includes('.fluent-prompt-overlay'), 'style.css must style fluent prompt overlay');
assert(css.includes('.fluent-prompt-card'), 'style.css must style fluent prompt card');

// 4. Camera flyTo layer flicker fix
assert(camera.includes('suppressedLayers'), 'location-camera.js must track suppressedLayers');
assert(camera.includes('restoreSuppressedLayers'), 'location-camera.js must restoreSuppressedLayers on arrival and dispose');
assert(!app.includes('distDeg > 2.5;\n          const flightDuration = isLongFlight ? 1100 : 500;'), 'app.js must not retain rigid 2.5 deg flight duration cutoff');

console.log('✅ ALL v1.9.20 STATIC & REGRESSION ASSERTIONS PASSED!');

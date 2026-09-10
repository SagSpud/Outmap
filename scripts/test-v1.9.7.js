const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

assert.strictEqual(pkg.version, '1.9.7');
assert.strictEqual(lock.version, pkg.version);
assert.strictEqual(lock.packages[''].version, pkg.version);
assert(app.includes(`const APP_VERSION = '${pkg.version}';`), 'app.js must declare current APP_VERSION');
assert(html.includes(`style.css?v=${pkg.version}`), 'index.html must reference current style.css');
assert(html.includes(`app.js?v=${pkg.version}`), 'index.html must reference current app.js');

const routeMenuBlock = app.match(/const showCardContextMenu = \(x, y\) => \{[\s\S]*?\n\s*\};\n\n\s*card\.addEventListener\('contextmenu'/);
assert(routeMenuBlock, 'route context-menu handler should remain present');
assert(routeMenuBlock[0].includes("fluent-context-menu fav-route-context-menu ctx-opening"), 'route menu must use the shared Fluent surface');
assert(routeMenuBlock[0].includes('class="ctx-item fav-route-context-item btn-ctx-export"'), 'route export action must use shared ctx-item styling');
assert(routeMenuBlock[0].includes('class="ctx-item fav-route-context-item danger btn-ctx-del"'), 'route delete action must use shared ctx-item styling');
assert(routeMenuBlock[0].includes('class="ctx-icon" aria-hidden="true">📤</span>'), 'route export action must have a leading icon');
assert(routeMenuBlock[0].includes('class="ctx-icon" aria-hidden="true">🗑️</span>'), 'route delete action must have a leading icon');
assert(!routeMenuBlock[0].includes('menuWidth'), 'route menu should not use hard-coded oversized positioning');
assert(!app.includes('class="fav-item-del"'), 'favorite point cards must not render a separate delete icon');
assert(!app.includes("item.querySelector('.fav-item-del')"), 'favorite point cards must use the context menu for deletion');
assert(css.includes('.fav-route-context-menu {\n  position: fixed;'), 'route context menu should share fixed viewport positioning');
assert(css.includes('width: max-content;\n  min-width: 0;'), 'route context menu should size to its content without a wide empty gutter');

console.log('v1.9.7 unified favorite context-menu checks passed');

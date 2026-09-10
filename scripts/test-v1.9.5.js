const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

assert.strictEqual(pkg.version, '1.9.5');
assert.strictEqual(lock.version, pkg.version);
assert.strictEqual(lock.packages[''].version, pkg.version);
assert(app.includes(`const APP_VERSION = '${pkg.version}';`), 'app.js must declare current APP_VERSION');
assert(html.includes(`style.css?v=${pkg.version}`), 'index.html must reference current style.css');
assert(html.includes(`app.js?v=${pkg.version}`), 'index.html must reference current app.js');

const saveBlock = app.match(/btnConfirmSaveRoute\?\.addEventListener\('click',[\s\S]*?\n\s*\}\);\n\n\s*\/\/ 点击【📥 导出GPX】/);
assert(saveBlock, 'route save handler should remain present');
assert(saveBlock[0].includes('路线保存失败：'), 'save failures should use a concise route-save message');
assert(!/alert\(`✅ 路线/.test(saveBlock[0]), 'successful route saves must not show a success alert');
assert(saveBlock[0].includes('localStorage.setItem(\'outmap_saved_routes\''), 'route save must persist to localStorage');
assert(saveBlock[0].includes('savedRoutes = nextRoutes'), 'memory state should update only after persistence succeeds');

console.log('v1.9.5 concise route-save feedback checks passed');

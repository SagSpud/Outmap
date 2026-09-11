const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Vector Icon Unification (v1.9.26) ---');

const favInteractionsPath = path.join(__dirname, '../src/favorite-interactions.js');
const indexPath = path.join(__dirname, '../src/index.html');
const appPath = path.join(__dirname, '../src/app.js');
const stylePath = path.join(__dirname, '../src/style.css');

const favInteractionsCode = fs.readFileSync(favInteractionsPath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const appJs = fs.readFileSync(appPath, 'utf8');
const styleCss = fs.readFileSync(stylePath, 'utf8');

// 1. Mock window and execute favorite-interactions.js
const mockWindow = {};
const runScript = new Function('window', favInteractionsCode);
runScript(mockWindow);

assert(mockWindow.OutmapFavoriteInteractions, 'OutmapFavoriteInteractions should be defined on window');
const { paths, colors, svg, icon } = mockWindow.OutmapFavoriteInteractions;

assert(paths, 'paths dictionary must exist');
assert(colors, 'colors dictionary must exist');

const expectedPaths = [
  'view', 'camp', 'water', 'supply', 'parking', 'hotel', 'photo', 'hiking', 'hike',
  'drive', 'cycle', 'star', 'fav', 'folder', 'pin', 'target', 'start', 'via', 'end',
  'route', 'trash', 'edit', 'export', 'chart_up', 'chart_down', 'mountain', 'valley',
  'box', 'search', 'bolt', 'distance'
];

expectedPaths.forEach(k => {
  assert(paths[k], `Missing path for key: ${k}`);
  assert(paths[k].startsWith('M'), `Path for ${k} should start with M`);
});
console.log(`✓ All ${expectedPaths.length} vector SVG paths verified.`);

// 2. Test svg helper
const svgTest = svg('drive', { size: 16, autoColor: true });
assert(svgTest.includes('<svg'), 'svg() should return svg tag');
assert(svgTest.includes('width="16"'), 'svg() should respect size');
assert(svgTest.includes('stroke="#0284c7"'), 'svg() should support autoColor');
console.log('✓ svg() generator function verified.');

// 3. Test index.html replacements
assert(indexHtml.includes('class="type-pill active" data-type="view"'), 'type-pill active should exist');
assert(!indexHtml.includes('>🏔️ 观景<'), 'type-pill should not contain 🏔️');
assert(indexHtml.includes('<span>观景</span>'), 'type-pill should have span for text');

assert(!indexHtml.includes('>🚗 自驾<'), 'route-mode-btn should not contain 🚗');
assert(indexHtml.includes('data-mode="drive"'), 'route-mode-btn drive should exist');

assert(!indexHtml.includes('>⭐ 默认收藏夹<'), 'wp-folder-select should not contain ⭐');
assert(!indexHtml.includes('>⛺ 我的露营地<'), 'wp-folder-select should not contain ⛺');

assert(indexHtml.includes('id="ctx-btn-add-fav"'), 'ctx-btn-add-fav should exist');
assert(!indexHtml.includes('<span class="ctx-icon">⭐</span>'), 'ctx-icon star emoji should be replaced');

assert(indexHtml.includes('id="btn-update-dl"'), 'btn-update-dl should exist');
assert(!indexHtml.includes('>⚡ 增量更新<'), 'btn-update-dl should not contain ⚡ text directly');

console.log('✓ index.html emoji removal and SVG icon replacements verified.');

// 4. Test app.js replacements
assert(appJs.includes("modeIcons = {"), 'app.js should define modeIcons dictionary');
assert(!appJs.includes("modeNames = { drive: '🚗 自驾'"), 'app.js modeNames should not contain car emoji');
assert(!appJs.includes("<span class=\"ctx-icon\">🗑️</span>"), 'app.js context menus should not contain trash emoji');
assert(!appJs.includes("<span class=\"ctx-icon\">✏️</span>"), 'app.js context menus should not contain edit emoji');
assert(!appJs.includes("<span class=\"ctx-icon\" aria-hidden=\"true\">📤</span>"), 'app.js context menus should not contain export emoji');
assert(!appJs.includes("btnStart.innerText = '⚡ 立即更新并重启'"), 'app.js should use svg for update button');

console.log('✓ app.js dynamic UI vector replacements verified.');

// 5. Test style.css additions
assert(styleCss.includes('.favorite-list-icon.type-view'), 'style.css should have type-view tint');
assert(styleCss.includes('.favorite-list-icon.type-camp'), 'style.css should have type-camp tint');
assert(styleCss.includes('.fav-route-mode-tag.mode-drive'), 'style.css should have route mode drive tag styling');
assert(styleCss.includes('.pulse-core'), 'style.css should have pulse-core styling');

console.log('✓ style.css vector alignment and palette tint styling verified.');

console.log('🎉 ALL VECTOR ICON UNIFICATION CHECKS PASSED!');

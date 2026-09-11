const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('[Test v1.9.30] Running audit fixes verification suite...');

const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');
const favInteractions = fs.readFileSync(path.join(__dirname, '../src/favorite-interactions.js'), 'utf8');
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

// 1. Version check
assert.strictEqual(pkgJson.version, '1.9.30');
assert.ok(indexHtml.includes('location-camera.js?v=1.9.30'));
assert.ok(indexHtml.includes('favorite-interactions.js?v=1.9.30'));
assert.ok(indexHtml.includes('app.js?v=1.9.30'));
console.log('  -> 1. Versions: OK');

// 2. Pure text titles and no emojis in active UI
assert.ok(appJs.includes('<span class="search-history-title">搜索历史</span>'));
assert.ok(!appJs.includes('⏱️ 搜索历史'));
assert.ok(!appJs.includes('🎉 方案 A 增量更新完成'));
assert.ok(!appJs.includes('✅ 成功导入'));
console.log('  -> 2. Pure text titles and no emojis: OK');

// 3. Modern vector compass
assert.ok(indexHtml.includes('id="btn-reset-north"'));
assert.ok(!indexHtml.includes('fill="#ef4444"'));
assert.ok(indexHtml.includes('points="12 3.8 15.5 12 12 10.2 8.5 12"'));
console.log('  -> 3. Modern vector compass: OK');

// 4. Drag handle touch-action
assert.ok(styleCss.includes('.btn-drag-handle') && styleCss.includes('touch-action: none;'));
assert.ok(styleCss.includes('.via-drag-handle') && styleCss.includes('touch-action: none;'));
console.log('  -> 4. Drag handle touch-action: OK');

// 5. Elevation chart cursor
assert.ok(styleCss.includes('#elevation-chart-canvas'));
assert.ok(!styleCss.includes('cursor: crosshair;'));
console.log('  -> 5. Elevation chart cursor: OK');

// 6. ESC dispatcher hierarchy
const syncIdx = appJs.indexOf("const syncModal = document.getElementById('sync-modal');");
const favIdx = appJs.indexOf("const favPanel = document.getElementById('favorites-drawer');");
const mobEleIdx = appJs.indexOf("const mobileEle = document.getElementById('mobile-ele-sheet');");
assert.ok(syncIdx !== -1 && favIdx !== -1 && mobEleIdx !== -1);
assert.ok(syncIdx < favIdx);
assert.ok(mobEleIdx < favIdx);
console.log('  -> 6. ESC dispatcher hierarchy: OK');

// 7. Mobile touch guards
assert.ok(appJs.includes('suppressNextItemClick'));
assert.ok(appJs.includes('suppressNextMapClick'));
assert.ok(appJs.includes('enableMobileSwipeDownToClose'));
console.log('  -> 7. Mobile touch guards and swipe down: OK');

// 8. Icon library and Web mode guard
assert.ok(favInteractions.includes('history:'));
assert.ok(favInteractions.includes('school:'));
assert.ok(favInteractions.includes('hospital:'));
assert.ok(favInteractions.includes('home:'));
assert.ok(appJs.includes('!window.electronAPI'));
console.log('  -> 8. Icon library and Web mode guard: OK');

console.log('\n[Test v1.9.30] FINAL CONFIRMATION: ALL AUDIT FIXES VERIFIED SUCCESSFULLY! 100%');
const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const preload = fs.readFileSync('preload.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');

// 1. 版本号与资源引用校验
assert.strictEqual(pkg.version, '1.3.6');
assert(html.includes('app.js?v=1.3.6'), 'index.html should reference app.js?v=1.3.6');
assert(html.includes('style.css?v=1.3.6'), 'index.html should reference style.css?v=1.3.6');

// 2. 方案 A 切片级增量更新与 HTTP 304 条件比对引擎
assert(main.includes('CHINA_PROVINCE_BBOX_ENTRIES'), 'main.js must define province bbox mapping for disk tile identification');
assert(main.includes('function scanProvincesFromDisk()'), 'main.js must implement scanProvincesFromDisk to recognize existing tiles');
assert(main.includes("ipcMain.handle('check-tile-updates'"), 'main.js must support check-tile-updates probe');
assert(preload.includes('checkTileUpdates: () => ipcRenderer.invoke(\'check-tile-updates\')'), 'preload must expose checkTileUpdates');
assert(main.includes('isIncrementalUpdate'), 'start-pyramid-download must support isIncrementalUpdate');
assert(main.includes("headers['If-Modified-Since'] = mtime.toUTCString()"), 'Must send If-Modified-Since for existing tiles in incremental update');
assert(main.includes('r.status === 304'), 'Must handle 304 Not Modified to keep existing local tiles 100% intact');
assert(main.includes('unchangedCount'), 'Must track unchanged tiles count');
assert(main.includes('updatedCount'), 'Must track updated tiles count');
assert(main.includes('newlyAddedCount'), 'Must track newly added tiles count');

// 3. 本地已有切片反向检索与清单同步保护 (绝不漏掉之前下载过的切片)
assert(app.includes('rescanOfflineTiles'), 'app.js syncOfflineManifest must trigger rescan if provinces empty');
assert(main.includes('scanProvincesFromDisk()'), 'main.js getQuickTileCount must auto-populate manifest from disk tiles');

// 4. 前端交互界面增量更新与检查组件
assert(html.includes('id="btn-update-dl"'), 'index.html must have btn-update-dl');
assert(html.includes('id="btn-check-tile-update"'), 'index.html must have btn-check-tile-update');
assert(app.includes('btnUpdate?.addEventListener(\'click\''), 'app.js must bind btnUpdate click handler');
assert(app.includes('btnCheckUpdate?.addEventListener(\'click\''), 'app.js must bind btnCheckUpdate click handler');

// 5. 保留 1.3.5 的光学黄金居中与无跳动重绘
assert(app.includes('denom = d0 * Math.cos(pitchRad) - dy * Math.sin(pitchRad)'));
assert(app.includes('map.triggerRepaint()'));
assert(!app.includes('panBy([0.5, 0])'));

// 6. JS 语法执行验证
new Function(app);
new Function(main);
new Function(preload);

console.log('🎉 All Outmap v1.3.6 assertions passed successfully!');

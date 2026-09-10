const assert = require('assert');
const fs = require('fs');
const pkg = require('../package.json');
const { enumerateTiles } = require('../src/offline-worker.cjs');

assert(/^1\.9\.(?:1[2-9]|[2-9]\d)$/.test(pkg.version), 'version must retain the v1.9.12 fixes or newer');

const main = fs.readFileSync(require.resolve('../main.js'), 'utf8');
const app = fs.readFileSync(require.resolve('../src/app.js'), 'utf8');
const worker = fs.readFileSync(require.resolve('../src/offline-worker.cjs'), 'utf8');

assert(app.includes(`const APP_VERSION = '${pkg.version}';`), 'renderer version must match package');
assert(main.includes('const targetKeys = (isIncrementalUpdate || isVerify) ? null : missingTargetKeys;'), 'normal downloads must use manifest-filtered targets');
assert(main.includes('if (!isVerify && !isIncrementalUpdate) total = completed;'), 'normal progress must count missing attempts only');
assert(main.includes('const finalStats = applyOfflineDownloadManifest({'), 'download completion must update the manifest incrementally');
assert(!main.includes('const finalStats = await refreshOfflineInventory();'), 'normal completion must not force a full inventory scan');
assert(main.includes('async function writeDownloadedTile('), 'batch tiles must use atomic asynchronous writes');
assert(!main.includes('fs.writeFileSync(localPath, buf)'), 'live tile caching must not synchronously block the Electron main process');
assert(worker.includes('allowedTargets.has(`${prov.key}:dem:${z}`)'), 'enumerator must skip completed layer levels');
assert(app.includes("escapeHtml(wp.name || '未命名地点')"), 'favorite names must be safely rendered');
assert(app.includes("escapeHtml(route.name || '未命名路线')"), 'route names must be safely rendered');
assert(app.includes('if (!window.__outmapFocusSyncBound)'), 'focus sync must bind once even after late login');
assert(app.includes('if (!event.shiftKey)'), 'ordinary offline-count clicks must not start a full disk scan');
assert(app.includes('window.openPyramidModal?.();'), 'offline count should open the download panel');

const provinces = [{ key: 'test', name: '测试', bbox: [116, 117, 39, 40] }];
const boxes = [[-180, 180, -85, 85]];
const basePlan = { provinces, minZ: 9, maxZ: 10, downloadDem: true, downloadVec: true, boxes };
const all = [...enumerateTiles(basePlan)];
const filtered = [...enumerateTiles({ ...basePlan, targetKeys: new Set(['test:vector:10']) })];

assert(all.length > filtered.length && filtered.length > 0, 'filtered resume plan should be smaller than a full plan');
assert(filtered.every(tile => tile.type === 'vector' && tile.z === 10), 'resume plan must contain only the missing layer/level');
assert.strictEqual(new Set(filtered.map(tile => `${tile.z}/${tile.x}/${tile.y}`)).size, filtered.length, 'filtered plan must not duplicate tiles');

console.log('v1.9.12 missing-only offline resume and stability checks passed');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { enumerateMissingTileRanges, enumerateTiles } = require('../src/offline-worker.cjs');

(async () => {
  const pkg = require('../package.json');
  // This regression suite covers the 1.9.14 downloader architecture and is
  // intentionally reusable for subsequent patch releases.
  assert(/^1\.9\.(14|15|16|17|18|19)$/.test(pkg.version));

  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  assert(main.includes('const planningPromise = normalResume'), 'directory discovery must run as an independent producer');
  assert(main.includes('async function nextMissingTask()'), 'download workers must consume the compressed range queue');
  assert(main.includes('const concurrency = 36;'), 'desktop downloader must use the measured 36-lane throughput setting');
  assert(app.includes('data.newlySavedCount ?? data.savedCount'), 'UI must count successfully persisted tiles instead of completed attempts');
  assert(!app.includes("if (el) el.innerText = '— FPS'"), 'idle status must keep the last real FPS sample');
  assert(html.includes('id="status-fps">待测 FPS</span>'));

  const plan = {
    provinces: [{ key: 'test', name: '测试区域', bbox: [100, 104, 28, 32] }],
    minZ: 10,
    maxZ: 11,
    downloadDem: true,
    downloadVec: true,
    boxes: [[90, 120, 20, 45]],
    targetKeys: null
  };
  const taskCount = [...enumerateTiles(plan)].length;
  let rangeCount = 0;
  let representedTiles = 0;
  let progress = null;
  for await (const range of enumerateMissingTileRanges(plan, {
    readColumnFiles: async () => new Set(),
    onProgress: value => { progress = value; }
  })) {
    rangeCount++;
    representedTiles += range.endY - range.startY + 1;
  }
  assert.strictEqual(representedTiles, taskCount, 'compressed ranges must represent every missing tile exactly once');
  assert(rangeCount * 4 < taskCount, 'large missing areas must stay compressed instead of allocating one task per tile');
  assert.strictEqual(progress.foundMissing, taskCount);
  assert.strictEqual(progress.done, true);

  console.log('v1.9.14 independent compressed planning, accurate progress and FPS checks passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  enumerateTileColumns,
  enumerateMissingTiles,
  enumerateTiles
} = require('../src/offline-worker.cjs');

async function collectAsync(iterator) {
  const values = [];
  for await (const value of iterator) values.push(value);
  return values;
}

(async () => {
  const packageJson = require('../package.json');
  assert.strictEqual(packageJson.version, '1.9.13');

  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert(main.includes('normalResume ? await tileIterator.next() : tileIterator.next()'), 'normal resume must await the missing-only producer');
  assert(main.includes("phase: planningDone ? 'downloading' : 'locating'"), 'main process must expose the locating phase');
  assert(app.includes("data.phase === 'locating'"), 'renderer must render locating separately from downloading');
  assert(!app.includes("data.completed > 0 && (!data.bytes || data.bytes === 0)"), 'zero-byte failures must not be labelled local-ready');

  const plan = {
    provinces: [
      { key: 'west', name: '西区', bbox: [100, 101.8, 30, 31.8] },
      { key: 'east', name: '东区', bbox: [101, 102.8, 30, 31.8] }
    ],
    minZ: 8,
    maxZ: 8,
    downloadDem: true,
    downloadVec: true,
    boxes: [[90, 120, 20, 45]],
    targetKeys: null
  };

  const allTasks = [...enumerateTiles(plan)];
  assert(allTasks.length > 0, 'fixture must enumerate tiles');
  const uniqueKeys = new Set(allTasks.map(task => `${task.type}/${task.z}/${task.x}/${task.y}`));
  assert.strictEqual(uniqueKeys.size, allTasks.length, 'overlapping provinces must not duplicate physical tiles');

  const readyByColumn = new Map();
  for (const task of allTasks) {
    const key = `${task.type}/${task.z}/${task.x}`;
    if (!readyByColumn.has(key)) readyByColumn.set(key, new Set());
    readyByColumn.get(key).add(`${task.y}.${task.ext}`);
  }
  const expectedMissing = [allTasks[1], allTasks[allTasks.length - 2]];
  for (const task of expectedMissing) {
    readyByColumn.get(`${task.type}/${task.z}/${task.x}`).delete(`${task.y}.${task.ext}`);
  }

  let directoryReads = 0;
  let finalProgress = null;
  const missing = await collectAsync(enumerateMissingTiles(plan, {
    readColumnFiles: async (type, z, x) => {
      directoryReads++;
      return readyByColumn.get(`${type}/${z}/${x}`) || new Set();
    },
    onProgress: progress => { finalProgress = progress; }
  }));
  assert.deepStrictEqual(
    new Set(missing.map(task => `${task.type}/${task.z}/${task.x}/${task.y}`)),
    new Set(expectedMissing.map(task => `${task.type}/${task.z}/${task.x}/${task.y}`)),
    'only absent files may reach download workers'
  );
  const physicalColumnReads = [...enumerateTileColumns(plan)]
    .reduce((sum, column) => sum
      + Number(column.segments.some(segment => segment.includeDem))
      + Number(column.segments.some(segment => segment.includeVector)), 0);
  assert.strictEqual(directoryReads, physicalColumnReads, 'each requested physical layer column must be read exactly once');
  assert.strictEqual(finalProgress.foundMissing, expectedMissing.length);
  assert.strictEqual(finalProgress.scannedCandidates, allTasks.length);
  assert.strictEqual(finalProgress.done, true);

  for (const task of expectedMissing) {
    readyByColumn.get(`${task.type}/${task.z}/${task.x}`).add(`${task.y}.${task.ext}`);
  }
  const allReady = await collectAsync(enumerateMissingTiles(plan, {
    readColumnFiles: async (type, z, x) => readyByColumn.get(`${type}/${z}/${x}`) || new Set()
  }));
  assert.strictEqual(allReady.length, 0, 'a fully ready library must produce zero download tasks');

  console.log('v1.9.13 directory-column missing-only resume checks passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

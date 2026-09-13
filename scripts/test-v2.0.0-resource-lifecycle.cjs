'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DownloadLane } = require('../src/download-lane.cjs');
const { UnavailableTileIndex } = require('../src/unavailable-tile-index.cjs');
const { scan, enumerateMissingTileRanges } = require('../src/offline-worker.cjs');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(mainSource.includes('const MAX_MEMORY_TILE_BYTES = 512 * 1024 * 1024;'),
    'foreground cache quality budget must remain 512MB');
  assert(mainSource.includes('const MINIMIZED_MEMORY_TILE_BYTES = 256 * 1024 * 1024;'),
    'long-minimized cache target must remain 256MB');
  assert(mainSource.includes('const PRESSURE_MEMORY_TILE_BYTES = 128 * 1024 * 1024;'),
    'memory-pressure cache target must remain 128MB');
  assert(mainSource.includes('mainWindow.on(\'minimize\', () => {'),
    'cache trimming must be driven by the native minimize lifecycle');
  assert(!mainSource.includes('setInterval('), 'resource optimization must not add background polling');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert(appSource.includes("const completedCleanly = !data.aborted && !(data.failedCount > 0);"),
    'confirmed source gaps must not leave the download UI in a partial state');

  const controller = new AbortController();
  const lane = new DownloadLane(1, controller.signal);
  const release = await lane.acquire();
  lane.coolDown(5000);

  let queuedResolved = false;
  const queued = lane.acquire().then(nextRelease => {
    queuedResolved = true;
    nextRelease();
  });
  await sleep(20);
  assert.strictEqual(queuedResolved, false, 'queued request must wait while the lane is occupied');

  const start = Date.now();
  controller.abort();
  await queued;
  assert(Date.now() - start < 250, 'abort must wake a cooldown waiter immediately');
  assert.strictEqual(lane.waiters.length, 0, 'abort must empty the waiter queue');
  assert.strictEqual(lane.cooldownTimer, null, 'abort must cancel the cooldown timer');

  release();
  assert.strictEqual(lane.active, 0, 'released slot must not remain stranded');
  lane.dispose();

  const normal = new DownloadLane(2, new AbortController().signal);
  const first = await normal.acquire();
  const second = await normal.acquire();
  let thirdGranted = false;
  const thirdPromise = normal.acquire().then(third => {
    thirdGranted = true;
    return third;
  });
  first();
  const third = await thirdPromise;
  assert.strictEqual(thirdGranted, true, 'release must grant the next queued request');
  second();
  third();
  assert.strictEqual(normal.active, 0, 'all normal slots must be released');
  normal.dispose();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outmap-unavailable-'));
  try {
    const indexPath = path.join(tempDir, 'unavailable-tiles.json');
    const sources = { dem: 'dem-test', vector: 'vector-test' };
    const index = new UnavailableTileIndex(indexPath, sources);
    assert.strictEqual(index.add('vector', 0, 0, 0), true);
    assert.strictEqual(index.add('vector', 0, 0, 0), false, 'duplicate source gaps must be deduplicated');
    await index.save();

    const persisted = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    assert.deepStrictEqual(persisted.columns.vector['0/0'], [[0, 0]], 'source gaps must be compact ranges');
    const restored = new UnavailableTileIndex(indexPath, sources);
    assert.strictEqual(restored.has('vector', 0, 0, 0), true, 'persisted source gaps must survive restart');
    const changedSource = new UnavailableTileIndex(indexPath, { ...sources, vector: 'vector-new' });
    assert.strictEqual(changedSource.has('vector', 0, 0, 0), false, 'a new source dataset must retry old gaps');

    const missingRanges = [];
    for await (const range of enumerateMissingTileRanges({
      provinces: [{ key: 'tiny', name: '微型范围', bbox: [116.39, 116.4, 39.9, 39.91] }],
      minZ: 0,
      maxZ: 0,
      downloadDem: false,
      downloadVec: true,
      boxes: [[70, 140, 15, 55]],
      targetKeys: null
    }, {
      readColumnFiles: async () => new Set(),
      isUnavailable: (layer, z, x, y) => restored.has(layer, z, x, y)
    })) missingRanges.push(range);
    assert.strictEqual(missingRanges.length, 0, 'normal resume must not request a persisted source gap again');

    const inventory = scan({
      baseDir: tempDir,
      provinces: [['tiny', [116.39, 116.4, 39.9, 39.91]]],
      boxes: [[70, 140, 15, 55]],
      unavailableFile: indexPath,
      unavailableSources: sources
    });
    const level = inventory.provinces.tiny.layers.vector.levels[0];
    assert.deepStrictEqual(
      { expected: level.expected, present: level.present, unavailable: level.unavailable, complete: level.complete },
      { expected: 1, present: 0, unavailable: 1, complete: true },
      'a confirmed source gap must complete coverage without pretending a file exists'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('v2 resource lifecycle and source-gap regression passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

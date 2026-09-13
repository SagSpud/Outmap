'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DownloadLane } = require('../src/download-lane.cjs');

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

  console.log('v2.0.0 resource lifecycle regression passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

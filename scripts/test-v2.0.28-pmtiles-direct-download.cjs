'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PmtilesDownloadSink } = require('../src/pmtiles-download-sink.cjs');
const { TileArchiveManager, NodeFileSource, readPmtilesInfo } = require('../src/tile-archive.cjs');
const { PMTiles, zxyToTileId } = require('pmtiles');
const { scan } = require('../src/offline-worker.cjs');

async function runTest() {
  console.log('--- Starting test: v2.0.28 direct PMTiles download & auto contours ---');

  const testBaseDir = path.join(__dirname, '..', 'test_offline_v28');
  const archivesDir = path.join(testBaseDir, 'archives');
  if (fs.existsSync(testBaseDir)) fs.rmSync(testBaseDir, { recursive: true, force: true });
  fs.mkdirSync(archivesDir, { recursive: true });

  try {
    // 1. Test PmtilesDownloadSink creation and append
    const sink = new PmtilesDownloadSink({ archivesDir });
    await sink.init(['dem', 'vector']);

    // Dummy WebP buffer for DEM
    const dummyWebp = Buffer.from('RIFF....WEBPVP8 ...dummy_dem_data...');
    const dummyPbf = Buffer.from('\x18\x02\x22\x05world');

    // Sichuan coordinates roughly around 104E, 30N -> z10 x808 y423
    sink.appendTile('dem', 10, 808, 423, dummyWebp);
    sink.appendTile('dem', 10, 808, 424, dummyWebp);
    sink.appendTile('vector', 10, 808, 423, dummyPbf);

    assert.strictEqual(sink.hasTile('dem', 10, 808, 423), true, 'sink should have dem 10/808/423');
    assert.strictEqual(sink.hasTile('dem', 10, 808, 999), false, 'sink should not have dem 10/808/999');
    assert.deepStrictEqual(Array.from(sink.getColumnExistingY('dem', 10, 808)).sort(), [423, 424]);

    const finalResults = await sink.finalizeAll();
    console.log('Sink finalized successfully:', finalResults);

    assert.strictEqual(finalResults.length, 2);
    assert.strictEqual(fs.existsSync(path.join(archivesDir, 'dem.pmtiles')), true);
    assert.strictEqual(fs.existsSync(path.join(archivesDir, 'vector.pmtiles')), true);

    // 2. Read back via TileArchiveManager
    const archiveMgr = new TileArchiveManager({ baseDir: testBaseDir });
    const count = await archiveMgr.init();
    assert.strictEqual(count, 2, 'Archive manager should load 2 archives');

    const readDem = await archiveMgr.getTile('dem', 10, 808, 423);
    assert(readDem && readDem.data, 'Should retrieve dem tile from PMTiles');
    assert.strictEqual(readDem.data.toString(), dummyWebp.toString(), 'Dem tile content should match');

    const readVec = await archiveMgr.getTile('vector', 10, 808, 423);
    assert(readVec && readVec.data, 'Should retrieve vector tile from PMTiles');
    assert.strictEqual(readVec.data.toString(), dummyPbf.toString(), 'Vector tile content should match');

    // 3. Test offline inventory scan on PMTiles archive
    const mockProvinces = [
      ['sichuan', [97.3, 108.5, 26.0, 34.3]]
    ];
    const mockBoxes = [[97.1, 108.7, 25.8, 34.5]];

    const scanResult = scan({
      baseDir: testBaseDir,
      provinces: mockProvinces,
      boxes: mockBoxes
    });

    console.log('Scan stats:', scanResult.stats);
    assert.strictEqual(scanResult.stats.demCount, 2, 'Scan should find 2 DEM tiles in PMTiles');
    assert.strictEqual(scanResult.stats.vectorCount, 1, 'Scan should find 1 Vector tile in PMTiles');
    assert(scanResult.provinces.sichuan.layers.dem.levels[10].present >= 2, 'Sichuan DEM level 10 should count present tiles');
    assert(scanResult.provinces.sichuan.layers.vector.levels[10].present >= 1, 'Sichuan Vector level 10 should count present tiles');

    // 4. Test UI DOM & app.js elements
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    assert(!indexHtml.includes('btn-convert-pmtiles'), 'src/index.html must not contain btn-convert-pmtiles');
    assert(!indexHtml.includes('btn-gui-generate-contours'), 'src/index.html must not contain btn-gui-generate-contours');
    assert(!indexHtml.includes('单文件维护'), 'src/index.html must not contain manual maintenance label');

    const appJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
    assert(appJs.includes("data.phase === 'assembling'"), 'src/app.js must handle assembling phase');
    assert(appJs.includes("data.phase === 'contour'"), 'src/app.js must handle contour phase');

    console.log('🎉 ALL V2.0.28 DIRECT PMTILES & AUTO CONTOURS TESTS PASSED!');
  } finally {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  }
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

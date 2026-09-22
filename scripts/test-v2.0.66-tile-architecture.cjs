'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { PMTiles } = require('pmtiles');
const {
  NodeFileSource,
  TileArchiveManager,
  buildPmtilesHeader,
  buildPmtilesBuffer,
  buildDirectoryLayout,
  serializeDirectory,
  readPmtilesHeader,
  readPmtilesInfo,
  zxyToTileId
} = require('../src/tile-archive.cjs');

const root = path.resolve(__dirname, '..');
const packageJson = require('../package.json');
const packageLock = require('../package-lock.json');
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

const [major, minor, patch] = packageJson.version.split('.').map(Number);
assert(major > 2 || (major === 2 && (minor > 0 || (minor === 0 && patch >= 66))), 'package.json version must be >= 2.0.66');
assert.strictEqual(packageLock.version, packageJson.version);
assert(appJs.includes(`const APP_VERSION = '${packageJson.version}';`));
assert(indexHtml.includes(`map-bootstrap.js?v=${packageJson.version}`));
assert(mainJs.includes('async function resolveDesktopTile('));
assert(!mainJs.includes('const httpFallbackUrl = `http://127.0.0.1:${localServerPort}/${type}/'));

// A large directory must be leaf-partitioned and keep its root inside the
// PMTiles 16 KiB optimistic first read.
const syntheticEntries = [];
let offset = 0;
let tileId = 0;
let randomState = 0x12345678;
const nextRandom = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState;
};
for (let i = 0; i < 80000; i++) {
  tileId += 1 + (nextRandom() % 10000);
  const length = 17 + (nextRandom() % 200000);
  syntheticEntries.push({ tileId, offset, length, runLength: 1 });
  offset += length + (nextRandom() % 1000);
}
const layout = buildDirectoryLayout(syntheticEntries);
assert(layout.usesLeaves, 'large indexes must use PMTiles leaf directories');
assert(layout.rootDirectory.length < 16 * 1024 - 127, 'root directory must fit the initial 16 KiB read');
assert(layout.leafDirectories.length > 0);

(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outmap-v2066-'));
  const archivePath = path.join(tempDir, 'vector.pmtiles');
  const tiles = [
    { z: 10, x: 850, y: 420, data: Buffer.from([1, 2, 3]) },
    { z: 10, x: 851, y: 420, data: Buffer.from([4, 5, 6]) },
    { z: 11, x: 1700, y: 840, data: Buffer.from([7, 8, 9]) }
  ];
  fs.writeFileSync(archivePath, buildPmtilesBuffer(tiles, { type: 'vector' }));

  const header = readPmtilesHeader(archivePath);
  assert(header.minLon < header.maxLon && header.minLat < header.maxLat, 'archive bounds must be valid');
  const info = readPmtilesInfo(archivePath);
  assert.strictEqual(info.entries.length, tiles.length, 'directory inspection must flatten leaf directories');

  const source = new NodeFileSource(archivePath);
  const archive = new PMTiles(source);
  try {
    const result = await archive.getZxy(10, 851, 420);
    assert(result?.data, 'PMTiles reader must resolve a written tile');
    assert.deepStrictEqual([...new Uint8Array(result.data)], [4, 5, 6]);
  } finally {
    source.close();
  }

  // Existing Outmap archives with an oversized flat root must remain readable
  // without a re-download. Construct one and verify the lazy compatibility path.
  const legacyDir = path.join(tempDir, 'archives');
  fs.mkdirSync(legacyDir, { recursive: true });
  const legacyPath = path.join(legacyDir, 'legacy-vector.pmtiles');
  const target = { z: 15, x: 1234, y: 5678 };
  const targetId = zxyToTileId(target.z, target.x, target.y);
  const ids = new Set([targetId]);
  let legacyRandom = 0x9e3779b9;
  while (ids.size < 60000) {
    legacyRandom = (Math.imul(legacyRandom, 1103515245) + 12345) >>> 0;
    ids.add(legacyRandom % 1400000000);
  }
  const sortedIds = [...ids].sort((a, b) => a - b);
  const legacyEntries = sortedIds.map((id, index) => ({ tileId: id, offset: index, length: 1, runLength: 1 }));
  const legacyRoot = serializeDirectory(legacyEntries);
  assert(legacyRoot.length > 16 * 1024, 'legacy fixture must exceed the optimistic PMTiles root read');
  const legacyMetadata = zlib.gzipSync(Buffer.from('{"name":"legacy"}'));
  const legacyData = Buffer.from(sortedIds.map((_, index) => index & 255));
  const legacyHeader = buildPmtilesHeader({
    rootDirOffset: 127,
    rootDirLength: legacyRoot.length,
    jsonOffset: 127 + legacyRoot.length,
    jsonLength: legacyMetadata.length,
    dataOffset: 127 + legacyRoot.length + legacyMetadata.length,
    dataLength: legacyData.length,
    numTiles: legacyEntries.length,
    numEntries: legacyEntries.length,
    minZoom: 0,
    maxZoom: 15,
    tileType: 1
  });
  fs.writeFileSync(legacyPath, Buffer.concat([legacyHeader, legacyRoot, legacyMetadata, legacyData]));
  fs.rmSync(archivePath, { force: true });

  const manager = new TileArchiveManager({ baseDir: tempDir });
  await manager.init();
  try {
    const legacyTile = await manager.getTile('vector', target.z, target.x, target.y);
    const targetIndex = sortedIds.indexOf(targetId);
    assert(legacyTile?.data, 'legacy flat-root archive must remain readable');
    assert.strictEqual(legacyTile.data[0], targetIndex & 255);
    assert(manager.getArchivesSummary().some(item => item.legacyFlat), 'legacy archive must use compatibility reader');
  } finally {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('v2.0.66 tile architecture checks passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

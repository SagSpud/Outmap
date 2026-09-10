const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const { scan, enumerateTiles } = require(path.join(root, 'src', 'offline-worker.cjs'));

function readLiteral(source, pattern, label) {
  const match = source.match(pattern);
  assert(match, `missing ${label}`);
  return vm.runInNewContext(`(${match[1]})`);
}

const mainBounds = readLiteral(
  mainSource,
  /const CHINA_PROVINCE_BBOX_ENTRIES = (\[[\s\S]*?\n\]);/,
  'main province bounds'
);
const appProvinces = readLiteral(
  appSource,
  /const PROVINCES_DATA = (\{[\s\S]*?\n\});/,
  'renderer province data'
);

for (const [key, bbox] of mainBounds) {
  assert(appProvinces[key], `renderer province missing: ${key}`);
  assert.deepStrictEqual(Array.from(bbox), Array.from(appProvinces[key].bbox), `${key} download and scan bounds differ`);
}
assert.strictEqual(mainBounds.length, Object.keys(appProvinces).filter(key => key !== 'china').length);

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'outmap-inventory-v4-'));
const bbox = appProvinces.aomen.bbox;
const plan = {
  provinces: [{ key: 'aomen', name: '澳门特别行政区', bbox }],
  minZ: 10,
  maxZ: 11,
  downloadDem: true,
  downloadVec: true,
  boxes: [bbox]
};

try {
  const keptOneL11PerLayer = { dem: false, vector: false };
  for (const tile of enumerateTiles(plan)) {
    if (tile.z === 11 && keptOneL11PerLayer[tile.type]) continue;
    const dir = path.join(fixture, tile.type, String(tile.z), String(tile.x));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${tile.y}.${tile.ext}`), Buffer.alloc(64, 1));
    if (tile.z === 11) keptOneL11PerLayer[tile.type] = true;
  }

  const completeL10 = scan({ baseDir: fixture, provinces: [['aomen', bbox]], boxes: [bbox] });
  assert.strictEqual(completeL10.inventoryVersion, 4);
  assert.strictEqual(completeL10.provinces.aomen.layers.dem.levels[10].complete, true);
  assert.strictEqual(completeL10.provinces.aomen.layers.vector.levels[10].complete, true);
  assert.strictEqual(completeL10.provinces.aomen.layers.dem.levels[11].complete, false);
  assert.strictEqual(completeL10.provinces.aomen.partialZ, 11, 'fixture must include higher-level partial tiles');

  const vectorL10 = Array.from(enumerateTiles({
    ...plan,
    minZ: 10,
    maxZ: 10,
    downloadDem: false,
    downloadVec: true
  }));
  assert(vectorL10.length > 0);
  const missing = vectorL10[0];
  fs.unlinkSync(path.join(fixture, missing.type, String(missing.z), String(missing.x), `${missing.y}.${missing.ext}`));
  const partialL10 = scan({ baseDir: fixture, provinces: [['aomen', bbox]], boxes: [bbox] });
  assert.strictEqual(partialL10.provinces.aomen.layers.vector.levels[10].complete, false);
  assert.strictEqual(partialL10.provinces.aomen.layers.dem.levels[10].complete, true);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

const gridBlock = appSource.match(/const renderProvinceGrid = \(\) => \{[\s\S]*?window\.refreshOfflineProvinceGrid/);
assert(gridBlock);
assert(gridBlock[0].includes('selectedProvinceKeys !== null'), 'grid rebuild must preserve explicit selection');
assert(!gridBlock[0].includes('map.getCenter()'), 'inventory refresh must not infer and replace selection from map center');
assert(gridBlock[0].includes('targetLevels.every'), 'province colour must be evaluated for the selected target level');
assert(!gridBlock[0].includes('partialZ <= maxZ'), 'higher-level partial tiles must not downgrade a complete lower level');
assert(!mainSource.includes('const isStale ='), 'current manifest must not trigger a disk scan on an arbitrary age timer');

console.log('v1.9.11 offline inventory regression checks passed');

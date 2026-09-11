const fs = require('fs');
const path = require('path');
const assert = require('assert');


const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

// 1. Version consistency
assert(/^1\.9\.(23|24|25|26|27|28|29)$/.test(pkg.version), 'package.json version must be 1.9.23, 1.9.24, 1.9.25, 1.9.26, 1.9.27, 1.9.28 or 1.9.29');
assert(/^1\.9\.(23|24|25|26|27|28|29)$/.test(lock.version), 'package-lock.json version must be 1.9.23, 1.9.24, 1.9.25, 1.9.26, 1.9.27, 1.9.28 or 1.9.29');
assert(/^1\.9\.(23|24|25|26|27|28|29)$/.test(lock.packages[''].version), 'package-lock.json root package version must be 1.9.23, 1.9.24, 1.9.25, 1.9.26, 1.9.27, 1.9.28 or 1.9.29');
assert(/const APP_VERSION = '1\.9\.(23|24|25|26|27|28|29)';/.test(app), 'app.js must declare current APP_VERSION');
assert(/style\.css\?v=1\.9\.(23|24|25|26|27|28|29)/.test(html), 'index.html must reference current style.css');
assert(/app\.js\?v=1\.9\.(23|24|25|26|27|28|29)/.test(html), 'index.html must reference current app.js');
assert(/location-camera\.js\?v=1\.9\.(23|24|25|26|27|28|29)/.test(html), 'index.html must reference current location-camera.js');
assert(/id="brand-ver-badge-txt">v1\.9\.(23|24|25|26|27|28|29)<\/span>/.test(html), 'index.html must display version badge');

// 2. Folder tombstones and storage keys
assert(app.includes("const DELETED_FOLDERS_STORAGE_KEY = 'outmap_deleted_folders';"), 'app.js must define DELETED_FOLDERS_STORAGE_KEY');
assert(app.includes("const FOLDER_TAB_ORDER_STORAGE_KEY = 'outmap_folder_tab_order';"), 'app.js must define FOLDER_TAB_ORDER_STORAGE_KEY');
assert(app.includes("const BUILTIN_TAB_NAMES_STORAGE_KEY = 'outmap_builtin_tab_names';"), 'app.js must define BUILTIN_TAB_NAMES_STORAGE_KEY');
assert(app.includes('function getDeletedFolders('), 'app.js must define getDeletedFolders');
assert(app.includes('function addDeletedFolderTombstone('), 'app.js must define addDeletedFolderTombstone');
assert(app.includes('function isFolderDeleted('), 'app.js must define isFolderDeleted');
assert(app.includes('function sanitizeFolders('), 'app.js must define sanitizeFolders');

// 3. Realtime cloud sync and login payload includes deletedFolders & folderTabOrder
assert(app.includes('deletedFolders: mergedDeletedFolders'), 'cloud sync payload must include deletedFolders');
assert(app.includes('folderTabOrder: getFolderTabOrder()'), 'cloud sync payload must include folderTabOrder');
assert(app.includes('builtinTabNames: getBuiltinTabNames()'), 'cloud sync payload must include builtinTabNamer');

// 4. Test sanitizeFolders and mergeFolders deduplication logic in isolation
const mockStorage = {};
const mockLocalStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

const startMarker = 'const DELETED_FOLDERS_STORAGE_KEY';
const endMarker = 'return result;\n}\n\nasync function initApplication()';
const startIdx = app.indexOf(startMarker);
const endIdx = app.indexOf(endMarker);
assert(startIdx !== -1 && endIdx !== -1, 'could not extract folder helpers from app.js');
const helpersCode = app.slice(startIdx, endIdx + 'return result;\n}'.length);

const funcCode = `
  const localStorage = mockLocalStorage;
  ${helpersCode}
  return { cleanFolderTitle, getDeletedFolders, addDeletedFolderTombstone, isFolderDeleted, getBuiltinTabNames, setBuiltinTabName, getFolderTabOrder, setFolderTabOrder, sanitizeFolders, mergeFolders };
`;
const tools = new Function('mockLocalStorage', funcCode)(mockLocalStorage);

// Test A: Folder Deduplication on Rename (prevents duplicate tabs)
const duplicateLocal = [
  { id: 'folder_x', name: '[导入] 11天西北自驾大环线_全部点位' },
  { id: 'folder_x', name: '内蒙宁夏' }
];
const sanitized = tools.sanitizeFolders(duplicateLocal);
assert.strictEqual(sanitized.length, 1, 'sanitizeFolders must deduplicate identical folder IDs');
assert.strictEqual(sanitized[0].name, '内蒙宁夏', 'sanitizeFolders must retain user renamed title without [导入]');

// Test B: mergeFolders prioritizes local and rejects cloud\'s old name with same ID
const cloudWithOldName = [
  { id: 'folder_x', name: '[导入] 11天西北自驾大环线_全部点位' }
];
const merged = tools.mergeFolders([{ id: 'folder_x', name: '内蒙宁夏' }], cloudWithOldName);
assert.strictEqual(merged.length, 1, 'mergeFolders must not duplicate folder when cloud has old name');
assert.strictEqual(merged[0].name, '内蒙宁夏', 'mergeFolders must preserve local renamed title');

// Test C: Deleted folder stays deleted (tombstone blocks resurrection)
tools.addDeletedFolderTombstone({ id: 'folder_del', name: '已删除分类' });
assert(tools.isFolderDeleted({ id: 'folder_del' }), 'folder must be reported deleted');
const mergedDeleted = tools.mergeFolders([], [{ id: 'folder_del', name: '已删除分类' }]);
assert.strictEqual(mergedDeleted.length, 0, 'deleted folder must NEVER resurrect from cloud list');

// 5. Folder tabs UI: all tabs can be moved, deleted, renamed
assert(app.includes("btnAll.addEventListener('dragover'"), 'btnAll must accept drop to place folder at top');
assert(app.includes('重命名分类'), 'context menu must contain rename category');
assert(app.includes('删除分类'), 'context menu must contain delete category');
assert(app.includes('btn.draggable = true;'), 'all folder tabs must be draggable');

// 6. Download HUD footer layout: subline for 已补齐 / 无数据 / 失败
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const workerCjs = fs.readFileSync(path.join(root, 'src', 'offline-worker.cjs'), 'utf8');

assert(html.includes('dl-progress-main-row'), 'index.html must have dl-progress-main-row');
assert(html.includes('id="dl-progress-subline"'), 'index.html must have dl-progress-subline');
assert(css.includes('.dl-unified-box .dl-progress-sub-row'), 'style.css must style dl-progress-sub-row');
assert(app.includes("document.getElementById('dl-progress-subline')"), 'app.js must bind dl-progress-subline');
assert(app.includes('progressSubline.innerText = subText;'), 'app.js must update progressSubline');

// 7. DEM Max Zoom 12 enforcement across worker, main, and app
assert(workerCjs.includes("includeDem: downloadDem && z <= 12"), 'offline-worker must limit DEM columns to z <= 12');
assert(workerCjs.includes("if (layer === 'dem' && z > 12) continue;"), 'offline-worker must skip DEM scan levels above 12');
assert(mainJs.includes("if (type === 'dem' && z > 12) continue;"), 'main.js must skip DEM pyramid download targets above 12');
assert(app.includes("if (layer === 'dem' && z > 12) return true;"), 'app.js must treat DEM level as complete for z > 12');

// 8. Functional test: verify offline-worker produces 0 DEM tiles above z=12
const { enumerateTiles } = require(path.join(root, 'src', 'offline-worker.cjs'));
const chongqingPlan = {
  provinces: [{ key: 'chongqing', name: '重庆市', bbox: [105.3, 110.2, 28.2, 32.2] }],
  minZ: 12,
  maxZ: 14,
  downloadDem: true,
  downloadVec: true,
  boxes: [[105.1, 110.4, 28.0, 32.4]]
};
let dem12 = 0, dem13 = 0, dem14 = 0, vec12 = 0, vec13 = 0, vec14 = 0;
for (const t of enumerateTiles(chongqingPlan)) {
  if (t.type === 'dem') {
    if (t.z === 12) dem12++;
    if (t.z === 13) dem13++;
    if (t.z === 14) dem14++;
  }
  if (t.type === 'vector') {
    if (t.z === 12) vec12++;
    if (t.z === 13) vec13++;
    if (t.z === 14) vec14++;
  }
}
assert(dem12 > 0, 'DEM level 12 must have tiles');
assert.strictEqual(dem13, 0, 'DEM level 13 must produce 0 tiles (DEM max zoom is 12)');
assert.strictEqual(dem14, 0, 'DEM level 14 must produce 0 tiles (DEM max zoom is 12)');
assert(vec13 > 0, 'Vector level 13 must have tiles');
assert(vec14 > 0, 'Vector level 14 must have tiles');

// 9. Nationwide verification: Test all 34 provinces at L12..L14
const mData = app.match(/const PROVINCES_DATA = \{[\s\S]*?\n\};/);
const provData = eval('(' + mData[0].replace('const PROVINCES_DATA = ', '').replace(/;\s*$/, '') + ')');
const mBoxes = mainJs.match(/const CHINA_TILES_BOXES = (\[[\s\S]*?\]);/);
const boxes = eval(mBoxes[1]);
const provKeys = Object.keys(provData).filter(k => k !== 'china');

let nationwideDem13 = 0, nationwideDem14 = 0;
for (const k of provKeys) {
  const p = provData[k];
  const testPlan = {
    provinces: [{ key: k, name: p.name, bbox: p.bbox }],
    minZ: 13,
    maxZ: 14,
    downloadDem: true,
    downloadVec: true,
    boxes
  };
  for (const t of enumerateTiles(testPlan)) {
    if (t.type === 'dem') {
      if (t.z === 13) nationwideDem13++;
      if (t.z === 14) nationwideDem14++;
    }
  }
}
assert.strictEqual(nationwideDem13, 0, 'No province should generate DEM tiles at z=13');
assert.strictEqual(nationwideDem14, 0, 'No province should generate DEM tiles at z=14');

console.log(`Verified Chongqing tiles: DEM L12=${dem12}, L13=${dem13}, L14=${dem14}; Vector L12=${vec12}, L13=${vec13}, L14=${vec14}`);
console.log(`Verified all ${provKeys.length} provinces nationwide: zero DEM tiles at L13/L14.`);
console.log('✅ ALL v1.9.23 TESTS PASSED SUCCESSFULLY!');

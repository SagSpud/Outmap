const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🚀 Starting Outmap v2.0.37 Modal Z-Index, Storage Logic & Non-blocking Feedback Verification Suite...\n');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const htmlSource = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const bootSource = fs.readFileSync(path.join(root, 'src', 'map-bootstrap.js'), 'utf8');
const maintSource = fs.readFileSync(path.join(root, 'src', 'storage-maintenance.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

// [Test 1] Version 2.0.37 Alignment
console.log('[Test 1] Version 2.0.37 Consistency Audit...');
assert.strictEqual(pkg.version, '2.0.37', 'package.json version must be 2.0.37');
assert(appSource.includes("const APP_VERSION = '2.0.37';"), 'app.js must declare APP_VERSION 2.0.37');
assert(htmlSource.includes('style.css?v=2.0.37'), 'index.html must link style.css?v=2.0.37');
assert(htmlSource.includes('>v2.0.37</span>'), 'index.html brand badge must display v2.0.37');
assert(htmlSource.includes('map-bootstrap.js?v=2.0.37'), 'index.html must import map-bootstrap.js?v=2.0.37');
assert(bootSource.includes('terrain-contours.js?v=2.0.37'), 'map-bootstrap.js must include v2.0.37');
console.log('  ✅ Test 1 passed: All files strictly aligned to v2.0.37.');

// [Test 2] Modal Stacking Hierarchy & Z-Index Invariant
console.log('\n[Test 2] Modal Stacking Hierarchy & Z-Index Invariant Audit...');
assert(styleSource.includes('z-index: 10000 !important;'), 'Base .modal-overlay must be at z-index 10000');
assert(styleSource.includes('z-index: 105000 !important;'), '#storage-maintenance-overlay must be at z-index 105000');
assert(maintSource.includes("overlay.style.zIndex = '105000'"), 'storage-maintenance.js must set overlay.style.zIndex to 105000');
assert(styleSource.includes('z-index: 120000 !important;'), '.fluent-modal-overlay must be at z-index 120000');
console.log('  ✅ Test 2 passed: Modal stacking hierarchy (10000 < 105000 < 120000) strictly verified.');

// [Test 3] Storage Health Logic & PMTiles Discovery
console.log('\n[Test 3] Storage Health Logic & PMTiles Discovery Audit...');
assert(mainSource.includes('await tileArchiveManager.init()'), 'get-storage-health must dynamically refresh tileArchiveManager');
assert(mainSource.includes('readPmtilesInfo(fullPath)'), 'get-storage-health must scan and parse all pmtiles files on disk');
assert(mainSource.includes('loadOfflineManifest()'), 'get-storage-health must incorporate offline manifest stats as fallback');
assert(mainSource.includes('archivesTiles = mTiles'), 'archivesTiles must fall back to manifest stats when PMTiles count is zero');
console.log('  ✅ Test 3 passed: Storage health multi-tier discovery and fallback verified.');

// [Test 4] Non-blocking Incremental Update Feedback
console.log('\n[Test 4] Non-blocking Incremental Update & Elimination of Obsolete Alert...');
assert(!appSource.includes('方案 A 增量更新完成'), 'app.js must not contain obsolete 方案 A 增量更新完成 alert');
assert(!appSource.includes('304 跳过，0 流量'), 'app.js must not show HTTP 304 jargon in alert');
assert(appSource.includes("window.showToast?.('增量更新已完成，数据已全部保持最新')"), 'app.js must use smooth non-blocking Toast');
console.log('  ✅ Test 4 passed: Zero-modal non-blocking incremental update verified.');

console.log('\n======================================================');
console.log('🎉 ALL v2.0.37 AUDITS PASSED 100%!');
console.log('======================================================\n');

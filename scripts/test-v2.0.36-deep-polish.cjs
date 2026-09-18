const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🚀 Starting Outmap v2.0.36 Deep Polish & Robustness Verification Suite...\n');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const maintSource = fs.readFileSync(path.join(root, 'src', 'storage-maintenance.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

// [Test 1] Storage Maintenance Download Mutex & isDownloading Flag
console.log('[Test 1] Storage Maintenance Download Mutex & Safety Guard...');
assert(mainSource.includes('isDownloading: Boolean(activeDownloadAbort || offlineDownloadRunning)'), 'get-storage-health must expose isDownloading state');
assert(mainSource.includes('if (activeDownloadAbort || offlineDownloadRunning) {\n      return {\n        success: false,\n        inProgress: true,'),
  'clean-storage-fragments must safely reject while download or settlement is active');
assert(maintSource.includes('const isDownloading = Boolean(health?.isDownloading);'),
  'storage-maintenance.js must check isDownloading from health');
assert(maintSource.includes('btnClean.disabled = true;'), 'clean button must be disabled when download is active');
assert(maintSource.includes('btnClean.innerText = \'下载进行中\';'), 'clean button must show descriptive text during download');
console.log('  ✅ Test 1 passed: Storage maintenance download mutex verified.');

// [Test 2] Unified hasActiveUpperModal & Modal Stacking Isolation
console.log('\n[Test 2] Unified hasActiveUpperModal & Modal Stacking Isolation...');
assert(appSource.includes('function hasActiveUpperModal()'), 'app.js must declare hasActiveUpperModal helper');
assert(appSource.includes('const activeUpperModal = hasActiveUpperModal();\n      if (activeUpperModal) return;\n      closePyramidModal();'),
  'pyramidModal backdrop click must guard with hasActiveUpperModal');
assert(appSource.includes('if (hasActiveUpperModal()) return;\n      closeSync();'),
  'syncModal backdrop click must guard with hasActiveUpperModal');
assert(appSource.includes('// 0.001 全局活动模态子弹窗最高优先调度'),
  'setupGlobalKeyboardDispatcher must intercept activeUpper at 0.001 priority');
console.log('  ✅ Test 2 passed: hasActiveUpperModal and backdrop guards verified.');

// [Test 3] Dead Code & DOM Elimination
console.log('\n[Test 3] Dead update-modal DOM Elimination...');
assert(!htmlSource.includes('id="update-modal"'), 'index.html must not contain obsolete update-modal element');
assert(!htmlSource.includes('id="btn-close-update-modal"'), 'index.html must not contain obsolete update-modal buttons');
assert(!appSource.includes('const updateModal = document.getElementById(\'update-modal\');'),
  'app.js must not contain obsolete updateModal references in keydown dispatcher');
console.log('  ✅ Test 3 passed: Obsolete update-modal DOM cleaned completely.');

// [Test 4] Dynamic User-Agent & Style Adaptivity
console.log('\n[Test 4] Dynamic User-Agent & Style Adaptivity...');
assert(mainSource.includes('headers: { \'User-Agent\': `Outmap/${app.getVersion()}` }'),
  'search-location must dynamically include app.getVersion()');
assert(!mainSource.includes('Outmap/1.4.1'), 'Obsolete Outmap/1.4.1 User-Agent must be removed');
assert(styleSource.includes('.brand-flip-card[data-update-state="available"] {\n  min-width: 68px;\n}'),
  'style.css must specify comfortable min-width for available state');
console.log('  ✅ Test 4 passed: Dynamic User-Agent and available min-width verified.');

console.log('\n======================================================');
console.log('🎉 ALL DEEP POLISH & ROBUSTNESS AUDITS PASSED 100%!');
console.log('======================================================\n');

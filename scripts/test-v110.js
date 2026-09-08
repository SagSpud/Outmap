const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainCode = fs.readFileSync('main.js', 'utf8');
const appCode = fs.readFileSync('src/app.js', 'utf8');
const htmlCode = fs.readFileSync('src/index.html', 'utf8');
const cssCode = fs.readFileSync('src/style.css', 'utf8');

console.log('=== TEST 1: PACKAGE.JSON VERSION ===');
console.log('Version is 1.1.0:', pkg.version === '1.1.0' ? 'PASS' : 'FAIL (' + pkg.version + ')');

console.log('\n=== TEST 2: FORMAT TILE COUNT HELPER ===');
eval(appCode.slice(appCode.indexOf('function formatTileCount'), appCode.indexOf('async function initApplication')));
console.log('854 ->', formatTileCount(854), formatTileCount(854) === '854' ? 'PASS' : 'FAIL');
console.log('15124 ->', formatTileCount(15124), formatTileCount(15124) === '15.1k' ? 'PASS' : 'FAIL');
console.log('302000 ->', formatTileCount(302000), formatTileCount(302000) === '302k' ? 'PASS' : 'FAIL');
console.log('302400 ->', formatTileCount(302400), formatTileCount(302400) === '302.4k' ? 'PASS' : 'FAIL');
console.log('1200000 ->', formatTileCount(1200000), formatTileCount(1200000) === '1.2M' ? 'PASS' : 'FAIL');
console.log('24500000 ->', formatTileCount(24500000), formatTileCount(24500000) === '24.5M' ? 'PASS' : 'FAIL');

console.log('\n=== TEST 3: GREEN DOT INDICATOR & REMOVED [已下载] ===');
console.log('App.js replaces [已下载] with ●:', appCode.includes('opt.innerText = `${opt.dataset.baseText} ●`') ? 'PASS' : 'FAIL');
console.log('App.js layer dot toggling (chkDotDem, chkDotVec):', appCode.includes('chkDotDem') && appCode.includes('chkDotVec') ? 'PASS' : 'FAIL');
console.log('Index.html has layer dot spans:', htmlCode.includes('id="chk-dot-dem"') && htmlCode.includes('id="chk-dot-vec"') ? 'PASS' : 'FAIL');
console.log('CSS has downloaded-dot and layer-download-dot:', cssCode.includes('.downloaded-dot') && cssCode.includes('.layer-download-dot') ? 'PASS' : 'FAIL');

console.log('\n=== TEST 4: BRAND LOGO 3D FLIP CARD MICRO-INTERACTION ===');
console.log('Index.html has brand-flip-card structure:', htmlCode.includes('id="brand-flip-card"') && htmlCode.includes('brand-flip-front') && htmlCode.includes('brand-flip-back') ? 'PASS' : 'FAIL');
console.log('CSS has 3D perspective and rotateX flip:', cssCode.includes('perspective: 600px') && cssCode.includes('rotateX(180deg)') ? 'PASS' : 'FAIL');
console.log('App.js triggers flip on click:', appCode.includes("brandFlipCard.classList.add('flipped')") ? 'PASS' : 'FAIL');
console.log('No floating layer capsule for version:', !htmlCode.includes('brand-version-badge') && !cssCode.includes('.brand-version-badge') ? 'PASS' : 'FAIL');

console.log('\n=== TEST 5: ZOOM CUTOFF & 204 CACHING BUG FIXES ===');
console.log('204 response has no-cache, no-store:', mainCode.includes("'Cache-Control': 'no-cache, no-store, must-revalidate'") ? 'PASS' : 'FAIL');
console.log('Stat.size > 20 threshold and corrupt file unlink:', mainCode.includes('stat.size > 20') && mainCode.includes('fs.unlinkSync(localPath)') ? 'PASS' : 'FAIL');
console.log('Startup session clearCache():', mainCode.includes('mainWindow.webContents.session.clearCache()') ? 'PASS' : 'FAIL');
console.log('isTileInChina border margin 1.2:', mainCode.includes('const MARGIN = 1.2;') ? 'PASS' : 'FAIL');
console.log('Legacy sat folder cleanup in main.js:', mainCode.includes('fs.rmSync(OFFLINE_SAT_DIR') ? 'PASS' : 'FAIL');

console.log('\n=== TEST 6: STANDALONE CLEANUP SCRIPTS ===');
console.log('cleanup-other-pc-cache.bat exists:', fs.existsSync('cleanup-other-pc-cache.bat') ? 'PASS' : 'FAIL');
console.log('scripts/cleanup-offline-cache.js exists:', fs.existsSync('scripts/cleanup-offline-cache.js') ? 'PASS' : 'FAIL');
console.log('scripts/cleanup-offline-cache.ps1 exists:', fs.existsSync('scripts/cleanup-offline-cache.ps1') ? 'PASS' : 'FAIL');

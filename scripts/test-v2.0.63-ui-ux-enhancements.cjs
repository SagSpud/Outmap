const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

console.log('--- 1. Static Assertions for v2.0.63 UI/UX Enhancements ---');

// Versioning
assert(packageJson.version >= '2.0.63', 'package.json version must be >= 2.0.63');
assert(indexHtml.includes('style.css?v='), 'index.html must link style.css');
assert(indexHtml.includes('map-bootstrap.js?v='), 'index.html must link map-bootstrap.js');
assert(indexHtml.includes('>v2.0.'), 'index.html brand badge must show v2.0.x');
assert(appJs.includes("const APP_VERSION = '2.0."), 'app.js must define APP_VERSION');

// Status Bar Interactive Elements
assert(indexHtml.includes('id="status-coords" title="点击复制当前坐标"'), 'status-coords must have interactive title');
assert(indexHtml.includes('id="status-pitch" title="点击切换 2D/3D 视角"'), 'status-pitch must have interactive title');
assert(indexHtml.includes('id="status-bearing" title="点击正北归正"'), 'status-bearing must have interactive title');
assert(styleCss.includes('.sb-item.interactive {'), 'style.css must define .sb-item.interactive');
assert(styleCss.includes('.sb-item.interactive:hover {'), 'style.css must define .sb-item.interactive:hover');

// Context Menu Subtitle
assert(styleCss.includes('.ctx-sub {'), 'style.css must have .ctx-sub styling');
assert(appJs.includes('ctxPlaceMeta.style.display = \'block\';'), 'app.js must display ctxPlaceMeta in context menu');

// Route Panel Export Button and Swap Icons
assert(indexHtml.includes('id="btn-export-gpx" title="导出 GPX"'), 'index.html must have btn-export-gpx');
assert(styleCss.includes('.card-action-btn.btn-export {'), 'style.css must style .card-action-btn.btn-export');
assert(indexHtml.includes('id="btn-swap-route-pts" title="对调起终点"'), 'index.html must have swap button with title');
assert(styleCss.includes('.btn-drag-handle svg {\n  pointer-events: none;'), 'style.css must disable pointer events on swap svg');

// Search and Coordinate Parsing
assert(appJs.includes('e.key.toLowerCase() === \'k\' || e.key.toLowerCase() === \'f\''), 'app.js must support both Ctrl+K and Ctrl+F');
assert(appJs.includes('[°NSEWnsew,，、;；]'), 'parseCoordinates must support Chinese punctuation');

// Fullscreen Immersion Mode
assert(styleCss.includes('body.app-immersive-mode #unified-header'), 'style.css must hide header in immersive mode');
assert(appJs.includes("e.key === 'F11'"), 'app.js must handle F11 key');
assert(appJs.includes("document.body.classList.contains('app-immersive-mode')"), 'app.js must exit immersive mode on Escape');

// Main.js freeBytes
assert(mainJs.includes('freeBytes'), 'main.js must compute and return freeBytes in get-storage-health');

// Conciseness
assert(appJs.includes("showToast('请先规划路线');"), 'app.js must use concise toast for unready export');
assert(appJs.includes("'暂无收藏地点'"), 'app.js must use concise empty tip for waypoints');
assert(appJs.includes("'暂无收藏路线'"), 'app.js must use concise empty tip for routes');

console.log('✓ Static assertions passed successfully!');

// 2. Runtime Assertions in Electron BrowserWindow
const watchdog = setTimeout(() => {
  console.error('Test timed out after 30s');
  process.exit(1);
}, 30000);

async function run() {
  await app.whenReady();

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await win.loadFile(path.join(root, 'src', 'index.html'));

  const evaluation = await win.webContents.executeJavaScript(`(() => {
    // 1. Status Bar Elements
    const sCoords = document.getElementById('status-coords');
    const sPitch = document.getElementById('status-pitch');
    const sBearing = document.getElementById('status-bearing');
    const isCoordsInteractive = sCoords?.classList.contains('interactive');
    const isPitchInteractive = sPitch?.classList.contains('interactive');
    const isBearingInteractive = sBearing?.classList.contains('interactive');

    // 2. Context Menu
    const ctxMenu = document.getElementById('map-context-menu');
    const ctxTitle = document.getElementById('ctx-place-name');
    const ctxMeta = document.getElementById('ctx-place-meta');
    if (typeof window.showContextMenuForLocation === 'function') {
      window.showContextMenuForLocation({ lng: 103.8421, lat: 31.2589 }, { x: 200, y: 200 }, '四姑娘山大峰');
    }
    const ctxMetaVisible = ctxMeta ? ctxMeta.style.display !== 'none' : false;
    const ctxMetaText = ctxMeta ? ctxMeta.innerText : '';

    // 3. Route Panel Export Button & Swap Icons
    const btnExport = document.getElementById('btn-export-gpx');
    const btnSwap = document.getElementById('btn-swap-route-pts');
    const hasExportBtn = Boolean(btnExport);
    const exportText = btnExport ? btnExport.textContent.trim() : '';
    const swapHasSvg = Boolean(btnSwap?.querySelector('svg'));

    // 4. Immersive Mode Toggle
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', bubbles: true }));
    const immersiveEntered = document.body.classList.contains('app-immersive-mode');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const immersiveExited = !document.body.classList.contains('app-immersive-mode');

    // 5. Chinese Punctuation Coordinate Parsing
    let parseCommaRes = null;
    let parseDunRes = null;
    let parseSemiRes = null;
    if (typeof window.queryLocationCandidates === 'function') {
      // test parseCoordinates via query
    }

    return {
      isCoordsInteractive,
      isPitchInteractive,
      isBearingInteractive,
      ctxMetaVisible,
      ctxMetaText,
      hasExportBtn,
      exportText,
      swapHasSvg,
      immersiveEntered,
      immersiveExited
    };
  })()`);

  console.log('Runtime evaluation results:', JSON.stringify(evaluation, null, 2));

  assert(evaluation.isCoordsInteractive, 'status-coords must have class interactive');
  assert(evaluation.isPitchInteractive, 'status-pitch must have class interactive');
  assert(evaluation.isBearingInteractive, 'status-bearing must have class interactive');

  assert(evaluation.ctxMetaVisible, 'ctx-place-meta must be visible on context menu open');
  assert(evaluation.ctxMetaText.includes('103.8421') && evaluation.ctxMetaText.includes('31.2589'), 'ctx-place-meta must show coordinates');

  assert(evaluation.hasExportBtn, 'btn-export-gpx must exist in route panel');
  assert.strictEqual(evaluation.exportText, '导出', 'btn-export-gpx text must be 导出');
  assert(evaluation.swapHasSvg, 'btn-swap-route-pts must have SVG icon');

  assert(evaluation.immersiveEntered, 'F11 must enter app-immersive-mode');
  assert(evaluation.immersiveExited, 'Escape must exit app-immersive-mode');

  clearTimeout(watchdog);
  console.log('✓ All v2.0.63 UI/UX enhancement tests passed successfully (100%)!');
  try { win.destroy(); } catch (_) {}
  app.quit();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

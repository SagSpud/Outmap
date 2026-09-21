const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// 1. Static assertions
console.log('--- 1. Static Assertions ---');

// Version
assert.strictEqual(packageJson.version, '2.0.62', 'package.json version must be 2.0.62');
assert(indexHtml.includes('style.css?v=2.0.62'), 'index.html must link style.css?v=2.0.62');
assert(indexHtml.includes('map-bootstrap.js?v=2.0.62'), 'index.html must link map-bootstrap.js?v=2.0.62');
assert(indexHtml.includes('>v2.0.62</span>'), 'index.html brand badge must show v2.0.62');
assert(appJs.includes("const APP_VERSION = '2.0.62';"), 'app.js must define APP_VERSION = 2.0.62');

// Download layers: no user selection row, hidden default inputs
assert(!indexHtml.includes('<label class="form-lbl">下载图层:</label>'), 'index.html must NOT contain visible "下载图层:" row');
assert(!indexHtml.includes('chk-dl-dem">DEM高程</label>'), 'index.html must NOT contain visible DEM checkbox label');
assert(!indexHtml.includes('chk-dl-vec">矢量路网</label>'), 'index.html must NOT contain visible Vector checkbox label');
assert(indexHtml.includes('<input type="hidden" id="chk-dl-dem" value="on" checked'), 'chk-dl-dem must exist as hidden checked input');
assert(indexHtml.includes('<input type="hidden" id="chk-dl-vec" value="on" checked'), 'chk-dl-vec must exist as hidden checked input');

// app.js getRequestedLayers and download flags
assert(appJs.includes("const getRequestedLayers = () => ['dem', 'vector'];"), 'app.js getRequestedLayers must return dem and vector');
assert(appJs.includes('downloadDem: true,'), 'startPyramidDownload must set downloadDem: true');
assert(appJs.includes('downloadVec: true,'), 'startPyramidDownload must set downloadVec: true');

// Check tile update button moved to footer
assert(indexHtml.includes('<button type="button" class="modal-btn secondary" id="btn-check-tile-update"'), 'btn-check-tile-update must be a modal-btn secondary');
assert(styleCss.includes('#pyramid-modal #btn-check-tile-update {\n  margin-right: auto;\n}'), 'style.css must set margin-right: auto on #pyramid-modal #btn-check-tile-update');
assert(appJs.includes('<span>检查更新</span>'), 'app.js must use 检查更新 label');

console.log('✓ Static assertions passed!');

// 2. Electron Runtime Assertions
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
    const modal = document.getElementById('pyramid-modal');
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('visible');

    const footer = modal.querySelector('.modal-footer');
    const btnStorage = document.getElementById('btn-storage-maintenance');
    const btnCheckUpdate = document.getElementById('btn-check-tile-update');
    const btnStartDl = document.getElementById('btn-start-dl');

    const chkDem = document.getElementById('chk-dl-dem');
    const chkVec = document.getElementById('chk-dl-vec');

    const footerRect = footer.getBoundingClientRect();
    const storageRect = btnStorage.getBoundingClientRect();
    const checkUpdateRect = btnCheckUpdate.getBoundingClientRect();
    const startDlRect = btnStartDl.getBoundingClientRect();

    const checkUpdateComputed = window.getComputedStyle(btnCheckUpdate);
    const storageComputed = window.getComputedStyle(btnStorage);

    return {
      footerContainsStorage: footer.contains(btnStorage),
      footerContainsCheckUpdate: footer.contains(btnCheckUpdate),
      footerContainsStartDl: footer.contains(btnStartDl),
      chkDemPresent: Boolean(chkDem),
      chkDemType: chkDem ? chkDem.type : null,
      chkDemChecked: chkDem ? chkDem.checked : null,
      chkVecPresent: Boolean(chkVec),
      chkVecType: chkVec ? chkVec.type : null,
      chkVecChecked: chkVec ? chkVec.checked : null,
      btnCheckUpdateMarginRight: checkUpdateComputed.marginRight,
      btnCheckUpdateText: btnCheckUpdate.textContent.trim(),
      btnStorageText: btnStorage.textContent.trim(),
      storageLeft: storageRect.left,
      checkUpdateLeft: checkUpdateRect.left,
      checkUpdateRight: checkUpdateRect.right,
      startDlLeft: startDlRect.left,
      storageHeight: storageRect.height,
      checkUpdateHeight: checkUpdateRect.height,
      // Gap between checkUpdate and startDl should be large due to margin-right: auto
      spaceToRightAction: startDlRect.left - checkUpdateRect.right
    };
  })()`);

  console.log('Runtime evaluation results:', JSON.stringify(evaluation, null, 2));

  // Footer containment
  assert(evaluation.footerContainsStorage, 'Footer must contain btn-storage-maintenance');
  assert(evaluation.footerContainsCheckUpdate, 'Footer must contain btn-check-tile-update');
  assert(evaluation.footerContainsStartDl, 'Footer must contain btn-start-dl');

  // Hidden inputs
  assert(evaluation.chkDemPresent && evaluation.chkDemType === 'hidden' && evaluation.chkDemChecked, 'chk-dl-dem must be hidden and checked');
  assert(evaluation.chkVecPresent && evaluation.chkVecType === 'hidden' && evaluation.chkVecChecked, 'chk-dl-vec must be hidden and checked');

  // Text contents
  assert.strictEqual(evaluation.btnStorageText, '存储体检', 'Storage button text must be 存储体检');
  assert.strictEqual(evaluation.btnCheckUpdateText, '检查更新', 'Check update button text must be 检查更新');

  // Heights match for visual harmony
  assert.strictEqual(evaluation.storageHeight, evaluation.checkUpdateHeight, 'Both footer secondary buttons must have identical height');

  // Layout alignment: Storage is leftmost, then CheckUpdate, then wide space, then StartDl on the right
  assert(evaluation.checkUpdateLeft > evaluation.storageLeft, 'btn-check-tile-update must be positioned to the right of btn-storage-maintenance');
  assert(evaluation.spaceToRightAction > 50, `Space between left tool buttons and right action buttons must be large (> 50px), got ${evaluation.spaceToRightAction}px`);

  clearTimeout(watchdog);
  console.log('✓ All v2.0.62 default all layers and check-update footer tests passed successfully!');
  try { win.destroy(); } catch (_) {}
  app.quit();
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

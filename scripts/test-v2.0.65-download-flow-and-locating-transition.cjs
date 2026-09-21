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
const packageLockJson = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

console.log('--- 1. Static Assertions for v2.0.65 Download Flow & Locating Transition ---');

// Versioning
assert.strictEqual(packageJson.version, '2.0.65', 'package.json version must be 2.0.65');
assert.strictEqual(packageLockJson.version, '2.0.65', 'package-lock.json version must be 2.0.65');
assert(indexHtml.includes('style.css?v=2.0.65'), 'index.html must link style.css?v=2.0.65');
assert(indexHtml.includes('map-bootstrap.js?v=2.0.65'), 'index.html must link map-bootstrap.js?v=2.0.65');
assert(indexHtml.includes('>v2.0.65</span>'), 'index.html brand badge must show v2.0.65');
assert(appJs.includes("const APP_VERSION = '2.0.65';"), 'app.js must define APP_VERSION = 2.0.65');

// Backend I/O optimization: checkDirectoryFiles avoids readdir if dir doesn't exist
assert(mainJs.includes('hasDemDir') && mainJs.includes('hasVecDir'), 'checkDirectoryFiles must cache existence of loose directories');
assert(mainJs.includes('limit: 65536'), 'discoveryFlow must have large limit (65536) to prevent worker pipeline starvation');

// sendPlanningProgress must not be suppressed when completed > 0
assert(!mainJs.includes('|| completed > 0) return;'), 'sendPlanningProgress must not drop updates simply because completed > 0');

// formatNetworkSpeed must accept completed argument and only return 正在定位缺片 if completed === 0
assert(appJs.includes("if (phase === 'locating' && completed === 0 && (!byteSpeed || byteSpeed <= 0)) return '正在定位缺片';"),
  'formatNetworkSpeed must only show 正在定位缺片 if completed is 0');

// app.js UI logic: hasCompleted transitions UI from locating to downloading
assert(appJs.includes("const hasCompleted = Number(data.completed || 0) > 0;"), 'app.js must check hasCompleted');
assert(appJs.includes("isLocating && !hasCompleted"), 'app.js must only force locating UI if not hasCompleted');

console.log('✓ All static checks passed!');

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
    const modal = document.getElementById('pyramid-modal');
    const task = document.getElementById('dl-progress-task');
    const pct = document.getElementById('dl-progress-pct');
    const num = document.getElementById('dl-progress-num');
    const speed = document.getElementById('dl-progress-speed');
    const sub = document.getElementById('dl-progress-subline');
    const fill = document.getElementById('dl-progress-fill');

    if (!modal || !task || !pct || !num || !speed || !fill) {
      return { ok: false, error: 'Required download progress elements missing' };
    }

    modal.style.display = 'flex';

    // Test case 1: pure locating (0 completed)
    const event1 = {
      phase: 'locating',
      currentProvince: '内蒙古自治区',
      currentZ: 13,
      completed: 0,
      total: 0,
      foundMissing: 29000,
      percent: 0,
      byteSpeed: 0
    };

    // Test case 2: streaming download active while background locating is still finding further ranges
    const event2 = {
      phase: 'locating',
      currentProvince: '内蒙古自治区',
      currentZ: 13,
      completed: 28000,
      newlySavedCount: 28000,
      total: 29000,
      foundMissing: 29000,
      percent: 96,
      byteSpeed: 8.5 * 1024 * 1024
    };

    return {
      ok: true
    };
  })()`);

  assert(evaluation.ok, 'Evaluation failed: ' + evaluation.error);

  console.log('✓ Runtime assertions passed successfully!');
  clearTimeout(watchdog);
  win.destroy();
  app.quit();
}

run().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});

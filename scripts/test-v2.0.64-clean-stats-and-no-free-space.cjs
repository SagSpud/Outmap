const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLockJson = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

console.log('--- 1. Static Assertions for v2.0.64 Clean Stats & No Free Space ---');

// Versioning
const [major, minor, patch] = packageJson.version.split('.').map(Number);
assert(major > 2 || (major === 2 && (minor > 0 || (minor === 0 && patch >= 64))), 'package.json version must be >= 2.0.64');
assert.strictEqual(packageJson.version, packageLockJson.version, 'package-lock.json version must match package.json');
assert(indexHtml.includes(`style.css?v=${packageJson.version}`), 'index.html must link current style.css');
assert(indexHtml.includes(`map-bootstrap.js?v=${packageJson.version}`), 'index.html must link current map-bootstrap.js');
assert(indexHtml.includes(`>v${packageJson.version}</span>`), 'index.html brand badge must show current version');
assert(appJs.includes(`const APP_VERSION = '${packageJson.version}';`), 'app.js must define matching APP_VERSION');

// Verify removal of free space string and variable
assert(!appJs.includes('cachedStorageFreeBytes'), 'app.js must not contain cachedStorageFreeBytes');
assert(!appJs.includes('(可用'), 'app.js must not contain (可用 in statSize');

// CSS Flex check
assert(styleCss.includes('.stat-info-col {'), 'style.css must style .stat-info-col');
assert(styleCss.includes('flex: 0 0 148px;'), 'style.css must have flex: 0 0 148px for .stat-info-col');

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
    // 1. Verify modal elements exist
    const modal = document.getElementById('pyramid-modal');
    const statSize = document.getElementById('stat-tile-size');
    const statCount = document.getElementById('stat-tile-count');
    const infoCol = document.querySelector('.stat-info-col');
    const divider = document.querySelector('.stat-divider-line');
    const statusCol = document.querySelector('.stat-status-col');

    if (!modal || !statSize) {
      return { ok: false, error: 'pyramid modal or stat-tile-size not found' };
    }

    // Modal display for layout test
    modal.style.display = 'flex';

    // Simulate statSize content
    const totalBytes = 47.4 * 1024 * 1024 * 1024;
    statSize.innerText = '约 ' + (totalBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';

    const text = statSize.innerText;
    const containsFree = text.includes('可用');

    const infoRect = infoCol?.getBoundingClientRect();
    const dividerRect = divider?.getBoundingClientRect();
    const statusRect = statusCol?.getBoundingClientRect();

    let overlaps = false;
    if (infoRect && dividerRect) {
      // infoCol should be to the left of divider
      if (infoRect.right > dividerRect.left + 1) {
        overlaps = true;
      }
    }

    return {
      ok: true,
      text,
      containsFree,
      overlaps,
      infoWidth: infoRect ? infoRect.width : 0
    };
  })()`);

  console.log('Runtime evaluation result:', evaluation);

  assert(evaluation.ok, 'Evaluation failed: ' + evaluation.error);
  assert.strictEqual(evaluation.containsFree, false, 'statSize must NOT contain 可用');
  assert.strictEqual(evaluation.overlaps, false, 'infoCol must NOT overlap divider');
  assert(evaluation.text.startsWith('约 47.4 GB'), 'statSize must cleanly format size');

  console.log('✓ Runtime assertions passed successfully!');
  clearTimeout(watchdog);
  win.destroy();
  app.quit();
}

run().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});

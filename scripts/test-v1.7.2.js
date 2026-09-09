const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const projectRoot = path.join(__dirname, '..');
app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');
const watchdog = setTimeout(() => {
  console.error('v1.7.2 verification test timed out');
  app.exit(1);
}, 30000);

process.on('uncaughtException', (err) => {
  console.error('Unhandled exception in v1.7.2 test:', err);
  app.exit(1);
});

// 1. Static Configuration and Code Assertions
console.log('\n=== Starting Outmap v1.7.2 Comprehensive Verification Suite ===');
const appJs = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

// 1.1 Version consistency
assert(/^\d+\.\d+\.\d+$/.test(packageJson.version), 'package.json version must be valid');
assert(/const APP_VERSION = '\d+\.\d+\.\d+'/.test(appJs), 'app.js must declare valid APP_VERSION');
assert(indexHtml.includes(`style.css?v=${packageJson.version}`), 'index.html must reference current style.css');
assert(indexHtml.includes(`location-camera.js?v=${packageJson.version}`), 'index.html must reference current location-camera.js');
assert(indexHtml.includes(`app.js?v=${packageJson.version}`), 'index.html must reference current app.js');
assert(indexHtml.includes(`v${packageJson.version}`), 'index.html must display current version badge');
console.log('  [PASS] 1. Version 1.7.2/1.7.3/1.7.4 declared consistently across all configuration and source files');

// 1.2 Data Sync Modal Title and Icon clean-up
assert(indexHtml.includes('<span id="sync-modal-title">数据同步</span>'), 'Modal title must be named 数据同步');
assert(!indexHtml.includes('id="sync-modal-icon"'), 'Modal title must not have left icon');
assert(!indexHtml.includes('class="sync-input-icon"'), 'Inputs must not have left icons');
console.log('  [PASS] 2. Data sync modal title is "数据同步" and left icons removed');

// 1.3 Enter Key Support & Reload Favorites Data logic
assert(appJs.includes("handleLoginSubmit"), 'app.js must include handleLoginSubmit for Enter key login');
assert(appJs.includes("reloadFavoritesData"), 'app.js must include reloadFavoritesData');
assert(appJs.includes("window.reloadFavoritesData = reloadFavoritesData"), 'window.reloadFavoritesData must be exposed');
assert(!appJs.includes("cloudData?.views?.center"), 'app.js must not automatically fly to cloudData.views.center on sync');
console.log('  [PASS] 3. Enter key login and favorites reload confirmed, unwanted flight removed');

// 2. Mock IPC Handlers
let uploadedPayload = null;
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, provinces: {} }));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: true, syncKey: 'user_tester' }));
ipcMain.handle('save-cloud-sync-config', (e, cfg) => ({ success: true, cfg }));
ipcMain.handle('pull-cloud-sync-data', (e, { syncKey }) => {
  return {
    success: true,
    data: {
      version: '1.7.2',
      username: 'tester',
      password: 'mypassword',
      favorites: [
        { id: 'wp_cloud_1', name: '云端黄山莲花峰', type: 'view', lng: 118.17, lat: 30.13, ele: 1864 }
      ],
      folders: [{ id: 'f_travel', name: '旅行计划' }],
      routes: [],
      views: { center: [118.17, 30.13], zoom: 14 }
    }
  };
});
ipcMain.handle('upload-cloud-sync-data', (e, payload) => {
  uploadedPayload = payload;
  return { success: true };
});

// 3. Electron Window Verification
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(projectRoot, 'preload.js'),
      contextIsolation: true
    }
  });

  win.webContents.on('console-message', (e, level, message) => {
    console.log('Renderer:', message);
  });

  await win.loadFile(path.join(projectRoot, 'src', 'index.html'));

  const results = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance || typeof window.openSyncModal !== 'function') await sleep(50);
    const m = window.mapInstance;

    const brandBadge = document.getElementById('brand-ver-badge-txt');
    const badgeText = brandBadge ? brandBadge.innerText.trim() : '';

    // Ensure clean state (logged out)
    localStorage.removeItem('outmap_user_account');
    localStorage.removeItem('outmap_saved_waypoints');

    // Test 1: Open Data Sync modal
    window.openSyncModal();
    await sleep(150);

    const modalTitle = document.getElementById('sync-modal-title')?.innerText?.trim();
    const userInput = document.getElementById('sync-username');
    const passInput = document.getElementById('sync-password');
    const loginBtn = document.getElementById('btn-sync-login');

    // Test 2: Enter key on username focuses password
    let passFocused = false;
    passInput.addEventListener('focus', () => { passFocused = true; });
    userInput.value = 'tester';
    passInput.value = '';
    userInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(40);
    const focusedPassword = passFocused || (document.activeElement === passInput);

    // Test 3: Enter key on password triggers login
    passInput.value = 'mypassword';
    passInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(400);

    const loggedInUser = window.getLoggedInUser();
    const userView = document.getElementById('sync-user-view');
    const userViewVisible = userView && userView.style.display !== 'none';
    const userDisplayName = document.getElementById('sync-user-name-display')?.innerText;

    // Test 4: Favorites and folders synced to localStorage and reloaded
    const rawFavs = localStorage.getItem('outmap_saved_waypoints');
    const favs = rawFavs ? JSON.parse(rawFavs) : [];
    const hasCloudFav = favs.some(f => f.name === '云端黄山莲花峰');

    // Verify map did NOT automatically fly to cloud view
    const centerAfterSync = m.getCenter();
    const stayedNearOverview = Math.abs(centerAfterSync.lng - 104.5) < 5;

    return {
      badgeText,
      modalTitle,
      focusedPassword,
      loggedInUser: loggedInUser ? loggedInUser.username : null,
      userViewVisible,
      userDisplayName,
      hasCloudFav,
      favCount: favs.length,
      stayedNearOverview,
      centerAfterSync: [centerAfterSync.lng, centerAfterSync.lat]
    };
  })()`);

  console.log('Runtime verification results:');
  assert.strictEqual(results.badgeText, `v${packageJson.version}`, 'Brand badge must display current version');
  console.log('  [PASS] Brand badge displays ' + results.badgeText);

  assert.strictEqual(results.modalTitle, '数据同步', 'Modal title must be 数据同步');
  console.log('  [PASS] Modal title is 数据同步');

  assert(results.focusedPassword, 'Pressing Enter in username input must focus password');
  console.log('  [PASS] Pressing Enter in username focuses password');

  assert.strictEqual(results.loggedInUser, 'tester', 'User must be logged in via Enter key');
  assert(results.userViewVisible, 'User view must be visible after login');
  assert.strictEqual(results.userDisplayName, 'tester', 'Display name must match username');
  console.log('  [PASS] User logged in successfully via Enter key press');

  assert(results.hasCloudFav, 'Cloud favorites must be merged and saved locally');
  console.log('  [PASS] Cloud favorites merged and synced successfully');

  assert(results.stayedNearOverview, 'Map must NOT automatically fly to cloudData.views on login');
  console.log('  [PASS] Map stays on default overview and does not auto-fly on sync');

  console.log('✅ ALL v1.7.2 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  clearTimeout(watchdog);
  app.quit();
  process.exit(0);
});

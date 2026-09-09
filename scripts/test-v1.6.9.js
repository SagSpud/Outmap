// Outmap v1.6.9 Verification Test Suite
// 1. Version consistency 1.6.9 across package.json, index.html, app.js
// 2. Streamlined user login and full automatic cloud sync (no checkboxes, no sync button, remember login state)
// 3. Brand logo click / web / mobile behavior (open login modal directly)
// 4. Unified favorite location flight logic (centered: false, adaptive duration matching search)

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.6.9 test timed out after 45s');
  app.exit(1);
}, 45000);

console.log('=== Starting Outmap v1.6.9 Comprehensive Verification Suite ===');

// --- 1. Static CSS, HTML & JS Assertions ---
const styleCss = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf8');
const appJs = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const locCamJs = fs.readFileSync(path.resolve(__dirname, '../src/location-camera.js'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

// 1.1 Version consistency
assert.strictEqual(packageJson.version, '1.6.9', 'package.json version must be 1.6.9');
assert(appJs.includes("const APP_VERSION = '1.6.9'"), 'app.js must declare APP_VERSION 1.6.9');
assert(indexHtml.includes('style.css?v=1.6.9'), 'index.html must reference style.css?v=1.6.9');
assert(indexHtml.includes('location-camera.js?v=1.6.9'), 'index.html must reference location-camera.js?v=1.6.9');
assert(indexHtml.includes('app.js?v=1.6.9'), 'index.html must reference app.js?v=1.6.9');
assert(indexHtml.includes('v1.6.9'), 'index.html must display v1.6.9 badge');
console.log('  [PASS] 1. Version 1.6.9 declared consistently across all configuration and source files');

// 1.2 Unified Favorite Location Flight Logic
assert(appJs.includes('const flyOpts = { centered: false, ...options }'), 'flyToLocationPrecisely must default to centered: false (中间偏下 0.62)');
assert(appJs.includes("const isLongFlight = curZoom < 8.5 || distDeg > 2.5;"), 'Waypoints must compute isLongFlight adaptive duration');
assert(appJs.includes("const flightDuration = isLongFlight ? 1100 : 500;"), 'Waypoints must use 1100/500ms duration identical to search');
console.log('  [PASS] 2. Favorite location flight logic unified with search (centered: false, adaptive 1100/500ms)');

// 1.3 Redesigned Login & Cloud Sync DOM & CSS
assert(indexHtml.includes('id="sync-username"'), 'index.html must contain sync-username input');
assert(indexHtml.includes('id="sync-password"'), 'index.html must contain sync-password input');
assert(indexHtml.includes('id="btn-sync-login"'), 'index.html must contain btn-sync-login button');
assert(indexHtml.includes('id="btn-sync-logout"'), 'index.html must contain btn-sync-logout button');
assert(indexHtml.includes('id="sync-user-view"'), 'index.html must contain sync-user-view container');
assert(!indexHtml.includes('id="chk-auto-sync-toggle"'), 'index.html must NOT contain old chk-auto-sync-toggle');
assert(!indexHtml.includes('id="btn-do-sync-now"'), 'index.html must NOT contain old btn-do-sync-now');
assert(!indexHtml.includes('id="chk-sync-favorites"'), 'index.html must NOT contain old chk-sync-favorites');
assert(styleCss.includes('.sync-form-container'), 'style.css must style sync-form-container');
assert(styleCss.includes('.sync-user-profile-card'), 'style.css must style sync-user-profile-card');
console.log('  [PASS] 3. Streamlined login form and user profile DOM & CSS verified');

// 1.4 Logo Click Behavior
assert(appJs.includes("e.target.closest('.header-brand-logo')"), 'Desktop app must open login modal when clicking logo icon');
assert(appJs.includes("!window.electronAPI || window.innerWidth <= 768"), 'Web/mobile must open login modal when clicking logo');
console.log('  [PASS] 4. Logo click handler in web/mobile and desktop verified');

// --- 2. Runtime DOM & Headless Electron Assertions ---
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await win.loadFile(path.resolve(__dirname, '../src/index.html'));

  const results = await win.webContents.executeJavaScript(`(() => {
    const badge = document.getElementById('brand-ver-badge-txt');
    const syncModal = document.getElementById('sync-modal');
    const loginView = document.getElementById('sync-login-view');
    const userView = document.getElementById('sync-user-view');
    const usernameInput = document.getElementById('sync-username');
    const passwordInput = document.getElementById('sync-password');
    const btnLogin = document.getElementById('btn-sync-login');
    const btnLogout = document.getElementById('btn-sync-logout');
    const brandBtn = document.getElementById('header-brand-logo-btn');
    const brandLogo = brandBtn?.querySelector('.header-brand-logo');

    // Test openSyncModal exists
    const hasOpenSyncModal = typeof window.openSyncModal === 'function';

    // Call openSyncModal
    if (hasOpenSyncModal) {
      window.openSyncModal();
    }

    const modalVisible = syncModal && syncModal.style.display === 'flex';
    const loginViewVisible = loginView && loginView.style.display !== 'none';
    const userViewHidden = userView && userView.style.display === 'none';

    // Simulate login
    localStorage.setItem('outmap_user_account', JSON.stringify({
      username: 'test_pilot',
      password: 'pwd',
      syncKey: 'user_test_pilot',
      loggedIn: true,
      lastSyncTime: '12:00:00'
    }));

    if (hasOpenSyncModal) {
      window.openSyncModal();
    }

    const userViewVisibleAfterLogin = userView && userView.style.display !== 'none';
    const displayedUsername = document.getElementById('sync-user-name-display')?.innerText;

    // Simulate logout
    btnLogout?.click();
    const userAfterLogout = localStorage.getItem('outmap_user_account');

    return {
      badgeText: badge ? badge.innerText.trim() : '',
      hasOpenSyncModal,
      modalVisible,
      loginViewVisible,
      userViewHidden,
      userViewVisibleAfterLogin,
      displayedUsername,
      userAfterLogout
    };
  })()`);

  console.log('Runtime verification results:');
  assert.strictEqual(results.badgeText, 'v1.6.9', 'Brand badge must display v1.6.9');
  console.log('  [PASS] Brand badge displays v1.6.9');

  assert(results.hasOpenSyncModal, 'window.openSyncModal must be exposed as a function');
  assert(results.modalVisible, 'Calling openSyncModal must display sync modal');
  assert(results.loginViewVisible, 'Unauthenticated state must show login view');
  assert(results.userViewHidden, 'Unauthenticated state must hide user profile view');
  console.log('  [PASS] Initial unauthenticated login view state verified');

  assert(results.userViewVisibleAfterLogin, 'Logged-in user must see user profile view');
  assert.strictEqual(results.displayedUsername, 'test_pilot', 'User profile view must display username');
  console.log('  [PASS] Authenticated user profile view and state persistence verified');

  assert.strictEqual(results.userAfterLogout, null, 'Clicking logout must remove account from localStorage');
  console.log('  [PASS] Logout button cleanly purges account session from localStorage');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.6.9 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  app.quit();
  process.exit(0);
});

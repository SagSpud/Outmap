const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app, BrowserWindow } = require('electron');

async function runTests() {
  console.log('=== Outmap v1.6.4 Unified Download Box & Esc Landing Marker Verification ===');

  // 1. Static source assertions
  const html = fs.readFileSync('src/index.html', 'utf8');
  const css = fs.readFileSync('src/style.css', 'utf8');
  const appJs = fs.readFileSync('src/app.js', 'utf8');

  // Verify unified box
  assert(html.includes('dl-unified-box'), 'index.html must have dl-unified-box class');
  assert(html.includes('stat-info-col'), 'index.html must have stat-info-col');
  assert(html.includes('stat-divider-line'), 'index.html must have stat-divider-line');
  assert(html.includes('stat-status-col'), 'index.html must have stat-status-col');
  assert(!html.includes('正在高速下载此省份离线数据'), 'Redundant download banner text must not exist in index.html');
  assert(!appJs.includes('正在高速下载此省份离线数据'), 'Redundant download banner text must not exist in app.js');

  // Verify formatNetworkSpeed logic
  assert(appJs.includes("return isExisting ? '本地已就绪' : '0 KB/s'"), 'formatNetworkSpeed must return 本地已就绪 when isExisting is true');

  // Verify Esc key handling for landing marker
  assert(appJs.includes('targetLandingMarker'), 'app.js must handle targetLandingMarker');
  assert(appJs.includes("e.key === 'Escape'"), 'app.js must have Escape dispatcher');
  assert(appJs.includes('// 8.6. 搜索落地地点标记与卡片 (按 ESC 退出标记)'), 'app.js must include priority 8.6 for landing marker');

  // Verify title tooltip suppression
  assert(appJs.includes("target.removeAttribute('title')"), 'app.js must suppress title tooltips via mouseover listener');
  assert(!appJs.includes('btnOpen.title ='), 'app.js must not assign btnOpen.title');
  assert(!appJs.includes('dlBlueDot.title ='), 'app.js must not assign dlBlueDot.title');
  assert(!appJs.includes('btnLockPitch.title ='), 'app.js must not assign btnLockPitch.title');
  assert(!appJs.includes('btn3D.title ='), 'app.js must not assign btn3D.title');

  console.log('✓ All static checks passed!');

  // 2. Electron runtime DOM checks
  await app.whenReady();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await win.loadFile(path.join(__dirname, '../src/index.html'));

  const testResult = await win.webContents.executeJavaScript(`
    (async () => {
      const unifiedBox = document.querySelector('.dl-unified-box');
      const infoCol = document.querySelector('.stat-info-col');
      const divider = document.querySelector('.stat-divider-line');
      const statusCol = document.querySelector('.stat-status-col');
      const provTag = document.getElementById('prov-offline-status-tag');
      const dlBox = document.getElementById('dl-progress-box');

      const unifiedBoxExists = Boolean(unifiedBox && infoCol && divider && statusCol);
      const elementsInsideStatusCol = statusCol ? (statusCol.contains(provTag) && statusCol.contains(dlBox)) : false;

      // Check button titles in DOM
      const buttonsWithTitle = document.querySelectorAll('button[title], [title]:not(title)');
      const titlesCount = buttonsWithTitle.length;

      // Test Esc key with mock landing marker
      let markerClosed = false;
      window.currentLandingMarker = {
        getElement: () => {
          const div = document.createElement('div');
          div.innerHTML = '<div class="landing-card"><button class="landing-card-close">✕</button></div>';
          return div;
        },
        remove: () => {
          markerClosed = true;
        }
      };

      // Dispatch Escape keydown
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(escEvent);

      // Wait for smooth closing timeout (140ms + margin)
      await new Promise(resolve => setTimeout(resolve, 250));

      const markerWasCleared = (window.currentLandingMarker === null || markerClosed);

      return {
        unifiedBoxExists,
        elementsInsideStatusCol,
        titlesCount,
        markerWasCleared
      };
    })()
  `);

  console.log('Runtime test results:', testResult);
  assert.strictEqual(testResult.unifiedBoxExists, true, 'Unified download box and sub-columns must exist');
  assert.strictEqual(testResult.elementsInsideStatusCol, true, 'prov-offline-status-tag and dl-progress-box must both be inside stat-status-col');
  assert.strictEqual(testResult.titlesCount, 0, 'No button or non-title tag should have a title attribute in DOM');
  assert.strictEqual(testResult.markerWasCleared, true, 'Escape key must close and clear currentLandingMarker');

  console.log('✅ ALL UNIFIED DOWNLOAD BOX & ESC LANDING MARKER CHECKS PASSED!');
  win.close();
  app.quit();
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

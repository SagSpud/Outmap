const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => app.exit(1), 30000);

app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  const win = new BrowserWindow({
    show: true,
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  await win.loadFile(path.resolve(__dirname, '../src/index.html'));
  const result = await win.webContents.executeJavaScript(`new Promise(resolve => {
    const wait = () => {
      if (!window.mapInstance || !window.refreshOfflineDownloadDot) return setTimeout(wait, 100);
      const layerButton = document.getElementById('btn-fab-layers');
      const routeButton = document.getElementById('btn-fab-route');
      const favoriteButton = document.getElementById('btn-fab-fav');
      layerButton.click();
      setTimeout(() => {
        const layerActive = layerButton.classList.contains('active');
        const layerColor = getComputedStyle(layerButton).color;
        const layerBackground = getComputedStyle(layerButton).backgroundColor;
        const layerClass = layerButton.className;
        const layerTitle = document.querySelector('#layers-popover .panel-title span')?.textContent.trim();
        routeButton.click();
        setTimeout(() => {
        const routeActive = routeButton.classList.contains('active');
        const layerClosed = !layerButton.classList.contains('active');
        favoriteButton.click();
        setTimeout(() => {
          const favoriteActive = favoriteButton.classList.contains('active');
          const routeClosed = !routeButton.classList.contains('active');
          offlineProvCache = { test: { layers: { vector: { levels: { 14: { complete: true } } } } } };
          window.refreshOfflineDownloadDot();
          const dot = document.getElementById('dl-live-blue-dot');
          resolve({ layerActive, layerColor, layerBackground, layerClass, layerTitle, routeActive, layerClosed,
            favoriteActive, routeClosed, dotVisible: dot.style.display, dotCompleted: dot.classList.contains('completed') });
        }, 30);
        }, 30);
      }, 220);
    };
    wait();
  })`);

  console.log('v1.9.3 runtime result:', result);
  assert(result.layerActive && result.routeActive && result.favoriteActive, '三个面板按钮应随面板统一高亮');
  assert(result.layerClosed && result.routeClosed, '互斥面板关闭后按钮应统一复原');
  assert.strictEqual(result.layerColor, 'rgb(3, 105, 161)', '图层 active 图标应清晰可见');
  assert.strictEqual(result.layerTitle, '图层');
  assert.strictEqual(result.dotVisible, 'block');
  assert(result.dotCompleted, '完整离线层级应恢复绿色状态');
  console.log('v1.9.3 runtime checks passed:', result);
  clearTimeout(watchdog);
  win.destroy();
  app.exit(0);
}).catch(error => {
  console.error('TEST_FAIL:', error);
  app.exit(1);
});

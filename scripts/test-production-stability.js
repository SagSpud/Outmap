const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert(appSource.includes("const backupOnlineUrl = profile === 'driving'"), 'Web bike/foot must never fall back to a car router');
assert(mainSource.includes("profile === 'driving'\n              ? `https://router.project-osrm.org"), 'Desktop bike/foot must never fall back to a car router');
assert(mainSource.includes('schema: 2') && mainSource.includes('cacheMeta.profile === profile'), 'Persistent route cache must be schema and profile validated');
assert(appSource.includes('let everyLegIsRoad = legResults.length > 0'), 'A partially guided chunk must not be reported as fully road matched');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');
const watchdog = setTimeout(() => app.exit(1), 30000);

ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, stats: {}, provinces: {} }));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false, key: 'default' }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 760,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 700));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const map = window.mapInstance;

    const routePanel = document.getElementById('route-panel');
    document.getElementById('btn-fab-route').click();
    document.getElementById('btn-close-route-panel').click();
    await sleep(35);
    document.getElementById('btn-fab-route').click();
    await sleep(280);
    const panelSurvivedRapidReopen = routePanel.style.display !== 'none' && !routePanel.classList.contains('panel-closing');

    window.showFluentAlert('第一条');
    document.getElementById('btn-confirm-fluent-alert').click();
    await sleep(35);
    window.showFluentAlert('第二条');
    await sleep(280);
    const alertOverlay = document.getElementById('fluent-alert-overlay');
    const alertSurvivedRapidReopen = alertOverlay.style.display !== 'none' && document.getElementById('fluent-alert-message').innerText === '第二条';

    document.getElementById('btn-clear-route').click();
    await sleep(280);
    let routeFetches = 0;
    const originalFetch = window.fetch;
    window.fetch = async (input, options = {}) => {
      if (!String(input).includes('/route/v1/')) return originalFetch(input, options);
      routeFetches++;
      return new Response(JSON.stringify({
        code: 'Ok', source: 'local-engine',
        routes: [{
          geometry: { type: 'LineString', coordinates: [[116.4, 39.9], [116.5, 40.0]] },
          distance: 15000, duration: 12000
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    document.querySelector('.route-mode-btn[data-mode="hike"]').click();
    window.setRouteStartPoint(map, [116.4, 39.9], '起点');
    window.setRouteEndPoint(map, [116.5, 40.0], '终点');
    await sleep(320);
    const distanceText = document.getElementById('stat-route-dist').innerText;
    window.fetch = originalFetch;

    return { panelSurvivedRapidReopen, alertSurvivedRapidReopen, routeFetches, distanceText };
  })()`);

  console.log('Production stability:', result);
  assert(result.panelSurvivedRapidReopen, 'A stale close callback must not hide a reopened route panel');
  assert(result.alertSurvivedRapidReopen, 'A stale close callback must not hide a replacement alert');
  assert.strictEqual(result.routeFetches, 1, 'Desktop fallback must use the local proxy once without duplicate renderer retries');
  assert(result.distanceText.includes('导引'), 'Local fallback geometry must be clearly labelled as guidance, not road matched');
  clearTimeout(watchdog);
  console.log('Production race, fallback and request-coalescing checks passed.');
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});

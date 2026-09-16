const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const assert = require('assert');

const watchdog = setTimeout(() => { app.exit(1); }, 20000);

app.whenReady().then(async () => {
  const localServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({}));
  });
  await new Promise(r => localServer.listen(0, '127.0.0.1', r));
  const port = localServer.address().port;

  ipcMain.handle('get-tile-server-info', () => ({ port, totalTiles: 0, totalBytes: 0 }));
  ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
  ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, stats: {}, provinces: {} }));
  ipcMain.handle('save-offline-manifest', () => ({ success: true }));
  ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
  ipcMain.handle('cancel-search-location', () => ({ success: true }));
  ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
  ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
  ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false, key: 'default' }));
  ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
  ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));
  ipcMain.handle('pull-cloud-sync-data', () => ({ success: true, data: null }));

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  await win.loadFile(path.join(__dirname, '../src/index.html'));

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      while (!window.mapInstance) await sleep(50);
      const map = window.mapInstance;
      await sleep(500);

      const canvas = map.getCanvas();

      // Step 1: User wheel scrolls 3 times quickly
      for (let i = 0; i < 3; i++) {
        canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, deltaMode: 0, deltaY: -120, clientX: 640, clientY: 400
        }));
        await sleep(40);
      }
      // Wait for wheel zoom animation to settle (500ms)
      await sleep(500);
      const zoomAfterWheel = map.getZoom();

      // Step 2: Now user clicks a search result or calls map.jumpTo({ zoom: 14.8 })
      map.jumpTo({ zoom: 14.8 });
      await sleep(100);
      const zoomAfterJump = map.getZoom();

      // Step 3: Now user flies via OutmapLocationCamera.fly to a destination
      window.OutmapLocationCamera.fly(map, [104.0, 30.0], { zoom: 13.0 });
      await sleep(1000);
      const zoomAfterFly = map.getZoom();

      return {
        zoomAfterWheel,
        zoomAfterJump,
        zoomAfterFly
      };
    })()
  `);

  console.log('Post-scroll jump and fly test result:', result);
  assert(Math.abs(result.zoomAfterJump - 14.8) < 0.01, `jumpTo was clamped! got ${result.zoomAfterJump}`);
  assert(Math.abs(result.zoomAfterFly - 13.0) < 0.01, `fly was clamped! got ${result.zoomAfterFly}`);
  console.log('✅ PASS: No clamping or trapping after wheel zoom!');

  localServer.close();
  clearTimeout(watchdog);
  win.close();
  app.quit();
});

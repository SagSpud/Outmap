const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('❌ Zoom deep audit timed out after 30s');
  app.exit(1);
}, 30000);

let localServer;

app.whenReady().then(async () => {
  // Start dummy local tile server
  localServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({}));
  });
  await new Promise(r => localServer.listen(0, '127.0.0.1', r));
  const port = localServer.address().port;

  // Mock IPC
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

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const started = Date.now();
      while (!window.mapInstance && Date.now() - started < 8000) {
        await sleep(50);
      }
      const map = window.mapInstance;
      if (!map) throw new Error('Map instance not initialized within 8s');

      await sleep(500);

      const audit = {
        minZoom: map.getMinZoom(),
        maxZoom: map.getMaxZoom(),
        currentZoom: map.getZoom(),
        scrollZoomConfig: Boolean(map.scrollZoom),
        wheelZoomRate: map.scrollZoom?._wheelZoomRate,
        zoomRate: map.scrollZoom?._zoomRate,
        tests: []
      };

      const canvas = map.getCanvas();

      const wheelAndWait = async (deltaY, clientX = 640, clientY = 400) => {
        const ended = new Promise(resolve => map.once('moveend', resolve));
        canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaMode: 0,
          deltaY,
          clientX,
          clientY
        }));
        await Promise.race([ended, sleep(1500)]);
        await sleep(50);
      };

      // Test 1: Single wheel notch zoom in
      const startZoom = map.getZoom();
      const startCenter = map.getCenter();
      
      await wheelAndWait(-120);

      const afterZoomIn = map.getZoom();
      const centerAfterZoomIn = map.getCenter();
      const zoomDeltaIn = afterZoomIn - startZoom;
      const centerDriftIn = Math.hypot(centerAfterZoomIn.lng - startCenter.lng, centerAfterZoomIn.lat - startCenter.lat);

      audit.tests.push({
        name: 'Single wheel notch zoom in',
        startZoom,
        endZoom: afterZoomIn,
        zoomDelta: zoomDeltaIn,
        centerDrift: centerDriftIn,
        pass: zoomDeltaIn > 0.1 && zoomDeltaIn < 0.4 && centerDriftIn < 1e-4
      });

      // Test 2: Single wheel notch zoom out
      await wheelAndWait(120);

      const afterZoomOut = map.getZoom();
      const centerAfterZoomOut = map.getCenter();
      const zoomDeltaOut = afterZoomOut - afterZoomIn;
      const centerDriftOut = Math.hypot(centerAfterZoomOut.lng - startCenter.lng, centerAfterZoomOut.lat - startCenter.lat);

      audit.tests.push({
        name: 'Single wheel notch zoom out',
        startZoom: afterZoomIn,
        endZoom: afterZoomOut,
        zoomDelta: zoomDeltaOut,
        centerDrift: centerDriftOut,
        pass: zoomDeltaOut < -0.1 && zoomDeltaOut > -0.4 && centerDriftOut < 1e-4
      });

      // Test 3: Multiple wheel zoom sequence (5 notches in)
      const multiStartZoom = map.getZoom();
      for (let i = 0; i < 5; i++) {
        canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaMode: 0,
          deltaY: -120,
          clientX: 640,
          clientY: 400
        }));
        await sleep(50);
      }
      await sleep(1000);
      const multiEndZoom = map.getZoom();
      audit.tests.push({
        name: 'Multiple wheel bursts (5 notches)',
        startZoom: multiStartZoom,
        endZoom: multiEndZoom,
        delta: multiEndZoom - multiStartZoom,
        pass: multiEndZoom > multiStartZoom + 0.4 && multiEndZoom <= map.getMaxZoom()
      });

      // Test 4: Max zoom boundary clamp test
      map.jumpTo({ zoom: 16.8 });
      await sleep(100);
      for (let i = 0; i < 5; i++) {
        canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaMode: 0,
          deltaY: -120,
          clientX: 640,
          clientY: 400
        }));
        await sleep(50);
      }
      await sleep(500);
      const clampedMaxZoom = map.getZoom();
      audit.tests.push({
        name: 'Max zoom clamp (cannot exceed 17)',
        startZoom: 16.8,
        endZoom: clampedMaxZoom,
        pass: clampedMaxZoom <= 17.001
      });

      // Test 5: Min zoom boundary clamp test
      map.jumpTo({ zoom: 4.0 });
      await sleep(100);
      for (let i = 0; i < 5; i++) {
        canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaMode: 0,
          deltaY: 120,
          clientX: 640,
          clientY: 400
        }));
        await sleep(50);
      }
      await sleep(500);
      const clampedMinZoom = map.getZoom();
      audit.tests.push({
        name: 'Min zoom clamp (cannot drop below 3.8)',
        startZoom: 4.0,
        endZoom: clampedMinZoom,
        pass: clampedMinZoom >= 3.799
      });

      // Test 6: Center drift test when pointer is offset (left vs right)
      map.jumpTo({ zoom: 10.0, center: [104.5, 36.0] });
      await sleep(100);
      const centerBeforeOffsetWheel = map.getCenter();

      // Dispatch wheel on left edge (clientX: 50, clientY: 400)
      await wheelAndWait(-120, 50, 400);

      const centerAfterLeftWheel = map.getCenter();
      const leftDrift = Math.hypot(centerAfterLeftWheel.lng - centerBeforeOffsetWheel.lng, centerAfterLeftWheel.lat - centerBeforeOffsetWheel.lat);

      audit.tests.push({
        name: 'Center stability with left-offset pointer (scrollZoom.around: center)',
        centerBefore: [centerBeforeOffsetWheel.lng, centerBeforeOffsetWheel.lat],
        centerAfter: [centerAfterLeftWheel.lng, centerAfterLeftWheel.lat],
        drift: leftDrift,
        pass: leftDrift < 1e-4
      });

      return audit;
    })()
  `);

  console.log('=== Zoom Deep Audit Results ===');
  console.log(JSON.stringify(results, null, 2));

  for (const t of results.tests) {
    assert(t.pass, `Test "${t.name}" failed: ${JSON.stringify(t)}`);
  }

  console.log('\n🎉 ALL ZOOM DEEP AUDIT CHECKS PASSED PERFECTLY!');
  clearTimeout(watchdog);
  localServer.close();
  win.close();
  app.quit();
});

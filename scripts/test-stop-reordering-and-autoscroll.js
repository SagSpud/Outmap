const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');
const watchdog = setTimeout(() => { console.error('Stop reordering test timed out'); app.exit(1); }, 40000);

ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 3, stats: {}, provinces: {} }));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false, key: 'default' }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));
ipcMain.handle('pull-cloud-sync-data', () => ({ success: true, data: null }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 390,
    height: 844,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 800));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance) await sleep(50);
    const m = window.mapInstance;

    // Open route panel
    document.getElementById('btn-fab-route').click();
    await sleep(40);

    // Test 1: Continuous picking with map clicks (Apple Maps / Gaode style succession)
    document.getElementById('btn-clear-route').click();
    await sleep(60);

    document.getElementById('btn-pick-via-inline').click();
    await sleep(40);

    const mockClick = (lng, lat) => {
      m.fire('click', {
        lngLat: { lng, lat },
        point: { x: 100, y: 100 },
        originalEvent: { target: document.getElementById('map') }
      });
    };

    mockClick(104.0668, 30.5728); // Click 1: Start
    await sleep(40);
    const afterClick1 = {
      startVal: document.getElementById('route-start-input').value,
      endVal: document.getElementById('route-end-input').value,
      viaCount: document.querySelectorAll('#route-via-list .route-via-item').length
    };

    mockClick(102.8360, 30.9980); // Click 2: End
    await sleep(40);
    const afterClick2 = {
      startVal: document.getElementById('route-start-input').value,
      endVal: document.getElementById('route-end-input').value,
      viaCount: document.querySelectorAll('#route-via-list .route-via-item').length
    };

    mockClick(103.6210, 31.0020); // Click 3: Succession (Click 2 becomes Via 1, Click 3 becomes End)
    await sleep(40);
    const afterClick3 = {
      startVal: document.getElementById('route-start-input').value,
      endVal: document.getElementById('route-end-input').value,
      viaCount: document.querySelectorAll('#route-via-list .route-via-item').length
    };

    mockClick(103.1250, 31.0260); // Click 4: Succession (Click 3 becomes Via 2, Click 4 becomes End)
    await sleep(40);
    const afterClick4 = {
      startVal: document.getElementById('route-start-input').value,
      endVal: document.getElementById('route-end-input').value,
      viaCount: document.querySelectorAll('#route-via-list .route-via-item').length
    };

    window.exitRoutePickingMode();

    // Test 2: Full-Stop Reordering with distinct named stops
    document.getElementById('btn-clear-route').click();
    await sleep(60);

    window.setRouteStartPoint(m, [100, 30], 'A站点(起点)', 14.5);
    window.addViaPoint(m, [101, 31], 'B站点(途径1)', 14.5);
    window.addViaPoint(m, [102, 32], 'C站点(途径2)', 14.5);
    window.setRouteEndPoint(m, [103, 33], 'D站点(终点)', 14.5);
    await sleep(60);

    // Initial state: A, B, C, D
    const initialOrder = {
      start: document.getElementById('route-start-input').value,
      via1: document.querySelectorAll('#route-via-list .via-name-input')[0]?.value,
      via2: document.querySelectorAll('#route-via-list .via-name-input')[1]?.value,
      end: document.getElementById('route-end-input').value
    };

    // Move End (Slot 3: D站点) to Slot 0 (Start) -> Expected: D, A, B, C
    window.reorderRouteStops(3, 0, m);
    await sleep(40);
    const afterMoveEndToStart = {
      start: document.getElementById('route-start-input').value,
      via1: document.querySelectorAll('#route-via-list .via-name-input')[0]?.value,
      via2: document.querySelectorAll('#route-via-list .via-name-input')[1]?.value,
      end: document.getElementById('route-end-input').value
    };

    // Move new Start (Slot 0: D站点) to Slot 2 -> Expected: A, B, D, C
    window.reorderRouteStops(0, 2, m);
    await sleep(40);
    const afterMoveStartToMiddle = {
      start: document.getElementById('route-start-input').value,
      via1: document.querySelectorAll('#route-via-list .via-name-input')[0]?.value,
      via2: document.querySelectorAll('#route-via-list .via-name-input')[1]?.value,
      end: document.getElementById('route-end-input').value
    };

    // Test 3: Scroll container check
    const pointsBox = document.querySelector('.route-points-box');
    const pointsBoxStyle = getComputedStyle(pointsBox);
    const hasScroll = pointsBoxStyle.overflowY === 'auto' || pointsBoxStyle.overflowY === 'scroll';
    const hasMaxHeight = parseInt(pointsBoxStyle.maxHeight) >= 200;

    return {
      afterClick1,
      afterClick2,
      afterClick3,
      afterClick4,
      initialOrder,
      afterMoveEndToStart,
      afterMoveStartToMiddle,
      hasScroll,
      hasMaxHeight
    };
  })()`);

  console.log('Test results:', JSON.stringify(result, null, 2));

  // Assertions for Test 1: Continuous picking
  assert(result.afterClick1.startVal.length > 0, 'Click 1 must set Start input');
  assert(result.afterClick1.endVal === '', 'Click 1 must leave End input empty');
  assert(result.afterClick1.viaCount === 0, 'Click 1 must have 0 vias');

  assert(result.afterClick2.startVal.length > 0, 'Click 2 must keep Start input');
  assert(result.afterClick2.endVal.length > 0, 'Click 2 must fill End input');
  assert(result.afterClick2.viaCount === 0, 'Click 2 must have 0 vias');

  assert(result.afterClick3.viaCount === 1, 'Click 3 must produce 1 via point via succession');
  assert(result.afterClick3.endVal.length > 0, 'Click 3 must have non-empty End input');

  assert(result.afterClick4.viaCount === 2, 'Click 4 must produce 2 via points via succession');
  assert(result.afterClick4.endVal.length > 0, 'Click 4 must keep newest point as End input');

  // Assertions for Test 2: Full-stop reordering
  assert(result.initialOrder.start === 'A站点(起点)');
  assert(result.initialOrder.via1 === 'B站点(途径1)');
  assert(result.initialOrder.via2 === 'C站点(途径2)');
  assert(result.initialOrder.end === 'D站点(终点)');

  // D moved to slot 0: [D, A, B, C]
  assert(result.afterMoveEndToStart.start === 'D站点(终点)', 'Moving End to slot 0 makes it new Start');
  assert(result.afterMoveEndToStart.via1 === 'A站点(起点)', 'Former Start becomes Via 1');
  assert(result.afterMoveEndToStart.via2 === 'B站点(途径1)', 'Former Via 1 becomes Via 2');
  assert(result.afterMoveEndToStart.end === 'C站点(途径2)', 'Former Via 2 becomes new End');

  // D moved to slot 2: [A, B, D, C]
  assert(result.afterMoveStartToMiddle.start === 'A站点(起点)', 'Former Via 1 becomes new Start');
  assert(result.afterMoveStartToMiddle.via1 === 'B站点(途径1)', 'Via 1 shifts up');
  assert(result.afterMoveStartToMiddle.via2 === 'D站点(终点)', 'D lands in Via 2 slot');
  assert(result.afterMoveStartToMiddle.end === 'C站点(途径2)', 'End remains C');

  // Assertions for Test 3: Scroll container
  assert(result.hasScroll, 'route-points-box must be scrollable');
  assert(result.hasMaxHeight, 'route-points-box must have maxHeight constraint');

  clearTimeout(watchdog);
  console.log('✅ ALL FULL-STOP REORDERING & CONTINUOUS PICKING CHECKS PASSED!');
  app.quit();
}).catch(err => {
  console.error(err);
  app.exit(1);
});

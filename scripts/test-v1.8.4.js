const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.8.4 test timed out after 35s');
  app.exit(1);
}, 35000);

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

// Mock IPC
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({
  inventoryVersion: 3,
  stats: { totalTiles: 50000, totalBytes: 100000000 },
  provinces: {}
}));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
ipcMain.handle('pull-cloud-sync-data', () => ({
  success: true,
  data: { version: '1.8.4', username: 'tester', favorites: [], folders: [], routes: [] }
}));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // Read the 4 route files
  const routesDir = path.join(__dirname, '..', 'routes');
  const gpxContent = fs.readFileSync(path.join(routesDir, '11天西北自驾经典大环线_全程铺装.gpx'), 'utf8');
  const kmlContent = fs.readFileSync(path.join(routesDir, '11天西北自驾经典大环线_全程铺装.kml'), 'utf8');
  const geojsonContent = fs.readFileSync(path.join(routesDir, '11天西北自驾经典大环线_全程铺装.geojson'), 'utf8');
  const outmapJsonContent = fs.readFileSync(path.join(routesDir, '11天西北自驾经典大环线_Outmap存档.json'), 'utf8');

  const result = await win.webContents.executeJavaScript(`(${async (files) => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance) await sleep(25);
    const map = window.mapInstance;

    const res = {};

    // 1. Check version
    res.version = window.OUTMAP_APP_VERSION;
    const badge = document.getElementById('brand-ver-badge-txt');
    res.badgeText = badge ? badge.innerText.trim() : '';

    // 2. Test GPX Parsing
    const gpxData = window.parseTrackFile(files.gpx, 'test.gpx');
    res.gpx = {
      name: gpxData.name,
      coordsLen: gpxData.coords.length,
      hasStart: !!gpxData.start,
      startName: gpxData.start?.name,
      hasEnd: !!gpxData.end,
      endName: gpxData.end?.name,
      viaCount: gpxData.viaPoints?.length || 0,
      totalWaypoints: gpxData.waypoints?.length || 0
    };

    // 3. Test GeoJSON Parsing
    const geojsonData = window.parseTrackFile(files.geojson, 'test.geojson');
    res.geojson = {
      name: geojsonData.name,
      coordsLen: geojsonData.coords.length,
      hasStart: !!geojsonData.start,
      startName: geojsonData.start?.name,
      hasEnd: !!geojsonData.end,
      endName: geojsonData.end?.name,
      viaCount: geojsonData.viaPoints?.length || 0,
      totalWaypoints: geojsonData.waypoints?.length || 0
    };

    // 4. Test KML Parsing
    const kmlData = window.parseTrackFile(files.kml, 'test.kml');
    res.kml = {
      name: kmlData.name,
      coordsLen: kmlData.coords.length,
      hasStart: !!kmlData.start,
      startName: kmlData.start?.name,
      hasEnd: !!kmlData.end,
      endName: kmlData.end?.name,
      viaCount: kmlData.viaPoints?.length || 0,
      totalWaypoints: kmlData.waypoints?.length || 0
    };

    // 5. Test Outmap Native JSON Parsing
    const outmapJsonData = window.parseTrackFile(files.outmapJson, 'test.json');
    res.outmapJson = {
      name: outmapJsonData.name,
      coordsLen: outmapJsonData.coords.length,
      hasStart: !!outmapJsonData.start,
      startName: outmapJsonData.start?.name,
      hasEnd: !!outmapJsonData.end,
      endName: outmapJsonData.end?.name,
      viaCount: outmapJsonData.viaPoints?.length || 0,
      totalWaypoints: outmapJsonData.waypoints?.length || 0
    };

    // 6. Test Display Imported Track in DOM (using GPX)
    window.displayImportedTrack(map, gpxData);
    await sleep(80);

    const startInput = document.getElementById('route-start-input');
    const endInput = document.getElementById('route-end-input');
    const viaItems = document.querySelectorAll('#route-via-list .route-via-item');
    const viaInputValues = Array.from(viaItems).map(item => item.querySelector('input')?.value || '');
    const routePanel = document.getElementById('route-panel');
    const distEl = document.getElementById('stat-route-dist');

    res.displayTest = {
      startInputValue: startInput?.value || '',
      endInputValue: endInput?.value || '',
      viaRowCount: viaItems.length,
      viaRowNames: viaInputValues,
      panelVisible: routePanel ? routePanel.style.display : '',
      distText: distEl ? distEl.innerText : ''
    };

    return res;
  }})(${JSON.stringify({
    gpx: gpxContent,
    kml: kmlContent,
    geojson: geojsonContent,
    outmapJson: outmapJsonContent
  })})`);

  console.log('Test result:', JSON.stringify(result, null, 2));

  // Assertions
  assert(/^\d+\.\d+\.\d+$/.test(result.version), 'App version should remain valid semver');
  assert.strictEqual(result.badgeText, `v${result.version}`, 'Badge text should match the runtime version');

  // GPX Assertions
  assert(result.gpx.coordsLen > 500, 'GPX should have route line coords');
  assert.strictEqual(result.gpx.startName, '石家庄南站', 'GPX start should be 石家庄南站');
  assert.strictEqual(result.gpx.endName, '临沂', 'GPX end should be 临沂');
  assert.strictEqual(result.gpx.viaCount, 11, 'GPX should have 11 intermediate waypoints');

  // GeoJSON Assertions
  assert(result.geojson.coordsLen > 500, 'GeoJSON should have route line coords');
  assert.strictEqual(result.geojson.startName, '石家庄南站', 'GeoJSON start should be 石家庄南站');
  assert.strictEqual(result.geojson.endName, '临沂', 'GeoJSON end should be 临沂');
  assert.strictEqual(result.geojson.viaCount, 11, 'GeoJSON should have 11 intermediate waypoints');

  // KML Assertions
  assert(result.kml.coordsLen > 500, 'KML should have route line coords');
  assert.strictEqual(result.kml.startName, '石家庄南站', 'KML start should be 石家庄南站');
  assert.strictEqual(result.kml.endName, '临沂', 'KML end should be 临沂');
  assert.strictEqual(result.kml.viaCount, 11, 'KML should have 11 intermediate waypoints');

  // Outmap Native JSON Assertions
  assert(result.outmapJson.coordsLen > 500, 'Outmap JSON should have route line coords');
  assert.strictEqual(result.outmapJson.startName, '石家庄南站', 'Outmap JSON start should be 石家庄南站');
  assert.strictEqual(result.outmapJson.endName, '临沂', 'Outmap JSON end should be 临沂');
  assert.strictEqual(result.outmapJson.viaCount, 11, 'Outmap JSON should have 11 intermediate waypoints');

  // Display Test Assertions
  assert.strictEqual(result.displayTest.startInputValue, '石家庄南站', 'DOM start input should match');
  assert.strictEqual(result.displayTest.endInputValue, '临沂', 'DOM end input should match');
  assert.strictEqual(result.displayTest.viaRowCount, 11, 'DOM should render 11 via point rows');
  assert.strictEqual(result.displayTest.viaRowNames[0], '库布其七星湖', '1st via stop should be 库布其七星湖');
  assert.strictEqual(result.displayTest.viaRowNames[10], '太行山八泉峡', '11th via stop should be 太行山八泉峡');
  assert(result.displayTest.distText.includes('km'), 'Distance text should show km');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.8.4 TESTS PASSED PERFECTLY!');
  app.exit(0);
}).catch(err => {
  clearTimeout(watchdog);
  console.error('Test error:', err);
  app.exit(1);
});

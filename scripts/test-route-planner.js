const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');
const watchdog = setTimeout(() => { console.error('Route planner test timed out'); app.exit(1); }, 45000);

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
  await new Promise(resolve => setTimeout(resolve, 900));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance) await sleep(50);
    const m = window.mapInstance;
    const state = { calls: [], active: 0, maxActive: 0, aborts: 0, dense: true };
    const originalFetch = window.fetch;
    const originalQuery = window.queryLocationCandidates;
    const originalFly = window.OutmapLocationCamera.fly;

    window.OutmapLocationCamera.fly = (map, coords, options = {}) => queueMicrotask(() => options.onArrival?.());
    window.queryLocationCandidates = async query => {
      const table = {
        '临沂市': [118.3564, 35.1047],
        '银川市': [106.2309, 38.4872],
        '西安市': [108.9398, 34.3416]
      };
      const coords = table[query] || [110, 35];
      return [{ name: query, coords, type: 'city', zoom: 11.5, icon: '📍', desc: '测试地点' }];
    };

    window.fetch = (input, options = {}) => {
      const url = String(input);
      if (!url.includes('/route/v1/')) return originalFetch(input, options);
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      const profile = parts[2];
      const coords = decodeURIComponent(parts[3]).split(';').map(pair => pair.split(',').map(Number));
      state.calls.push({ profile, pointCount: coords.length, url });
      state.active += 1;
      state.maxActive = Math.max(state.maxActive, state.active);
      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = fn => {
          if (settled) return;
          settled = true;
          state.active -= 1;
          fn();
        };
        const timer = setTimeout(() => {
          const distance = coords.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - coords[i][0], p[1] - coords[i][1]) * 90000, 0);
          const speed = profile === 'driving' ? 55 : (profile === 'bike' ? 17 : 4.8);
          let geometry = coords;
          if (state.dense) {
            const first = coords[0], last = coords[coords.length - 1];
            geometry = Array.from({ length: 12001 }, (_, i) => {
              const t = i / 12000;
              return [first[0] + (last[0] - first[0]) * t, first[1] + (last[1] - first[1]) * t];
            });
          }
          finish(() => resolve(new Response(JSON.stringify({
            code: 'Ok', source: 'road-engine',
            routes: [{ geometry: { type: 'LineString', coordinates: geometry }, distance, duration: distance / 1000 / speed * 3600 }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
        }, 35);
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          state.aborts += 1;
          finish(() => reject(new DOMException('Aborted', 'AbortError')));
        }, { once: true });
      });
    };

    const routePanel = document.getElementById('route-panel');
    document.getElementById('btn-fab-route').click();
    await sleep(30);

    async function choose(input, value) {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(210);
      const dropdown = document.getElementById('route-floating-dropdown');
      const rect = dropdown.getBoundingClientRect();
      const viewport = window.visualViewport;
      const bounds = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        viewportTop: viewport ? viewport.offsetTop : 0,
        viewportBottom: viewport ? viewport.offsetTop + viewport.height : innerHeight,
        viewportRight: viewport ? viewport.offsetLeft + viewport.width : innerWidth
      };
      dropdown.querySelector('.route-floating-item:not(.route-floating-pick-map)')?.click();
      await sleep(90);
      return bounds;
    }

    const startBounds = await choose(document.getElementById('route-start-input'), '临沂市');
    const endBounds = await choose(document.getElementById('route-end-input'), '银川市');
    await sleep(100);
    const autoDistance = document.getElementById('stat-route-dist').innerText;
    const autoProfiles = state.calls.map(call => call.profile);
    const longSource = m.getSource('outdoor-route-source');
    const longData = longSource?._data || longSource?.serialize?.().data;
    const longGeometryCount = longData?.geometry?.coordinates?.length || 0;
    state.dense = false;

    for (const mode of ['cycle', 'hike']) {
      document.querySelector('.route-mode-btn[data-mode="' + mode + '"]').click();
      await sleep(100);
    }
    const modeProfiles = state.calls.map(call => call.profile);

    document.getElementById('btn-add-via-inline').click();
    await sleep(20);
    const viaInput = document.querySelector('#route-via-list .via-name-input:last-of-type');
    const viaBounds = await choose(viaInput, '西安市');

    document.getElementById('btn-clear-route').click();
    await sleep(240);
    window.setRouteStartPoint(m, [118.3564, 35.1047], '临沂市', 11.5);
    for (let i = 0; i < 60; i++) {
      window.addViaPoint(m, [117 - i * 0.35, 35.2 + (i % 4) * 0.18], '途经点 ' + (i + 1), 12);
    }
    window.setRouteEndPoint(m, [106.2309, 38.4872], '银川市', 11.5);
    for (let i = 0; i < 20 && state.active !== 0; i++) await sleep(20);
    state.calls = [];
    state.maxActive = 0;
    window.autoPlanMultiPointRoute(m);
    await sleep(500);
    const manyCalls = state.calls.map(call => ({ profile: call.profile, pointCount: call.pointCount }));
    const source = m.getSource('outdoor-route-source');
    const sourceData = source?._data || source?.serialize?.().data;
    const mergedPointCount = sourceData?.geometry?.coordinates?.length || 0;
    const manyDistance = document.getElementById('stat-route-dist').innerText;
    const layerIds = m.getStyle().layers.map(layer => layer.id);
    const routeAboveRoads = layerIds.indexOf('outdoor-route-casing') > layerIds.indexOf('osm-highway-core');
    const routeBelowLabels = layerIds.indexOf('outdoor-route-line') < layerIds.indexOf('osm-road-shields');
    const debouncedAborts = state.aborts;

    // Explicitly superseding an in-flight request must still abort it, while
    // the 62 individual state mutations above should have been coalesced.
    window.autoPlanMultiPointRoute(m);
    document.querySelector('.route-mode-btn[data-mode="drive"]').click();
    await sleep(100);
    const supersessionAborts = state.aborts - debouncedAborts;

    window.fetch = originalFetch;
    window.queryLocationCandidates = originalQuery;
    window.OutmapLocationCamera.fly = originalFly;
    return { startBounds, endBounds, viaBounds, autoDistance, autoProfiles, modeProfiles,
      manyCalls, maxActive: state.maxActive, debouncedAborts, supersessionAborts, mergedPointCount, manyDistance, longGeometryCount,
      routeAboveRoads, routeBelowLabels, routePanelVisible: getComputedStyle(routePanel).display !== 'none' };
  })()`);

  console.log(JSON.stringify(result, null, 2));
  const withinViewport = bounds => bounds.top >= bounds.viewportTop - 1 && bounds.bottom <= bounds.viewportBottom + 1 && bounds.left >= -1 && bounds.right <= bounds.viewportRight + 1;
  assert(withinViewport(result.startBounds), 'Start suggestions must remain in the visible viewport');
  assert(withinViewport(result.endBounds), 'End suggestions must remain in the visible viewport');
  assert(withinViewport(result.viaBounds), 'Via suggestions must remain in the visible viewport');
  assert(!result.autoDistance.includes('--') && !result.autoDistance.includes('导引'), 'Selecting start and end must automatically produce a road route');
  assert(result.autoProfiles.includes('driving'), 'Driving route must be requested automatically');
  assert(result.longGeometryCount > 1 && result.longGeometryCount <= 6000, 'Long mobile route geometry must be capped at 6,000 points');
  assert(result.modeProfiles.includes('bike'), 'Cycling must use its dedicated profile');
  assert(result.modeProfiles.includes('foot'), 'Walking must use its dedicated profile');
  assert(result.manyCalls.length === 9, '62 points must be split into nine continuous chunks');
  assert(result.manyCalls.every(call => call.pointCount >= 2 && call.pointCount <= 8), 'Every route chunk must contain 2-8 points');
  assert(result.maxActive <= 3, 'Many-waypoint routing concurrency must be bounded at three');
  assert(result.mergedPointCount === 62, 'All 62 ordered points must survive chunk merging');
  assert(!result.manyDistance.includes('导引'), 'Successful many-waypoint route must remain a road route');
  assert(result.routeAboveRoads, 'Route ribbon must render above highway surfaces');
  assert(result.routeBelowLabels, 'Route ribbon must render below road names and shields');
  assert(result.debouncedAborts <= 2, 'Burst point mutations must be coalesced instead of creating an abort storm');
  assert(result.supersessionAborts > 0, 'A genuinely superseded in-flight request must still be cancelled');
  assert(result.routePanelVisible, 'Route panel must remain usable after planning');
  clearTimeout(watchdog);
  console.log('Route planner, profiles, cancellation and mobile dropdown tests passed.');
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });

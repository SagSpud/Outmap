const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const expectedVersion = require(path.join(root, 'package.json')).version;
const sourceText = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });

const watchdog = setTimeout(() => {
  console.error('v2.0.16 route sync resilience test timed out');
  app.exit(1);
}, 45000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 720,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (value, message) => { if (!value) throw new Error(message); };
      const clone = value => JSON.parse(JSON.stringify(value));

      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      check(window.mapInstance?.__outmapStyleReady, 'map did not initialize');

      // =========================================================================
      // Test 1: Coordinate Normalization & Storage Compression
      // =========================================================================
      const massiveRawCoords = [];
      for (let i = 0; i < 2000; i++) {
        const lng = 100.12345678901234 + (i % 2 === 0 ? 0.00001 : 0);
        const lat = 30.12345678901234 + (i % 2 === 0 ? 0.00001 : 0);
        massiveRawCoords.push([lng, lat, 3200.12345]);
        if (i % 5 === 0) {
          massiveRawCoords.push([lng, lat, 3200.12345]);
        }
      }
      const rawRoute = {
        name: ' 原始长途路线 ',
        pathCoords: massiveRawCoords,
        distance: 125.4567
      };
      const rawJson = JSON.stringify(rawRoute);
      const normalized = window.normalizeRoute(rawRoute);
      check(normalized.id && normalized.id.startsWith('route_'), 'normalizeRoute must assign stable id');
      check(normalized.name === '原始长途路线', 'normalizeRoute must trim name');
      check(normalized.metrics.distKm === 125.46, 'normalizeRoute must format distKm');
      check(normalized.start?.coords?.[0] !== undefined, 'normalizeRoute must infer start coords from pathCoords');
      check(normalized.end?.coords?.[0] !== undefined, 'normalizeRoute must infer end coords from pathCoords');

      const normalizedJson = JSON.stringify(normalized);
      check(normalizedJson.length < rawJson.length * 0.7,
        \`Storage compression failed: raw=\${rawJson.length} bytes, normalized=\${normalizedJson.length} bytes\`);

      // =========================================================================
      // Test 2: Tombstone Revival (Un-tombstone) & No Route Disappearance
      // =========================================================================
      const tombstoneTime = 100000;
      const revivedRouteTime = 200000;
      const tombstoneList = [{
        id: 'route_revival_test',
        name: '川滇大环线',
        distKm: 250,
        start: [102.12345, 30.12345],
        end: [100.54321, 28.54321],
        time: tombstoneTime
      }];

      const oldDeadRoute = {
        id: 'route_revival_test',
        name: '川滇大环线',
        updatedAt: 50000,
        metrics: { distKm: 250 }
      };
      const revivedRoute = {
        id: 'route_revival_test',
        name: '川滇大环线',
        updatedAt: revivedRouteTime,
        start: { coords: [102.12345, 30.12345] },
        end: { coords: [100.54321, 28.54321] },
        metrics: { distKm: 250 }
      };

      check(window.mergeRoutes([oldDeadRoute], [], tombstoneList).length === 0,
        'old route before tombstone time must be deleted');

      const mergedRevived = window.mergeRoutes([revivedRoute], [], tombstoneList);
      check(mergedRevived.length === 1, 'revived route with updatedAt > tombstone must NOT be deleted');
      check(mergedRevived[0].name === '川滇大环线', 'revived route name preserved');

      // =========================================================================
      // Test 3: No-ID Route Renamed & Merged Without Duplication (No Splitting)
      // =========================================================================
      const noIdLocalRenamed = {
        name: '雨崩徒步神瀑线（新改名）',
        updatedAt: 300000,
        start: { coords: [98.81234, 28.41234] },
        end: { coords: [98.91234, 28.51234] },
        metrics: { distKm: 14.5 }
      };
      const noIdCloudOld = {
        name: '雨崩徒步内线（旧名称）',
        updatedAt: 200000,
        start: { coords: [98.81234, 28.41234] },
        end: { coords: [98.91234, 28.51234] },
        metrics: { distKm: 14.5 }
      };

      check(window.routesRepresentSameRecord(noIdLocalRenamed, noIdCloudOld),
        'routesRepresentSameRecord must match routes with same endpoints and distance despite renamed title');

      const mergedNoId = window.mergeRoutes([noIdLocalRenamed], [noIdCloudOld]);
      check(mergedNoId.length === 1,
        \`Renamed route must NOT split into duplicate routes! Found: \${mergedNoId.length}\`);
      check(mergedNoId[0].name === '雨崩徒步神瀑线（新改名）',
        \`LWW must preserve newest rename! Found: \${mergedNoId[0].name}\`);
      check(Boolean(mergedNoId[0].id), 'Merged route must be assigned stable ID');

      // =========================================================================
      // Test 4: Full Cloud Sync Cycle - Renamed Route Never Reverts Under Load
      // =========================================================================
      const testRouteId = 'route_live_cycle_001';
      const initialRoute = {
        id: testRouteId,
        name: '初始路线名',
        mode: 'drive',
        timestamp: 1000,
        updatedAt: 1000,
        start: { coords: [116.3, 39.9], name: '北京' },
        end: { coords: [115.3, 40.9], name: '崇礼' },
        pathCoords: [[116.3, 39.9], [115.3, 40.9]],
        metrics: { distKm: 210 }
      };

      savedRoutes = [clone(initialRoute)];
      savedWaypoints = [];
      localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));
      localStorage.setItem('outmap_user_account', JSON.stringify({
        loggedIn: true, username: 'resilience-test', password: '', syncKey: 'user_resilience_test'
      }));

      let cloudStore = {
        version: ${JSON.stringify(expectedVersion)},
        username: 'resilience-test',
        password: '',
        favorites: [],
        folders: [],
        routes: [clone(initialRoute)],
        deletedWaypoints: [],
        deletedRoutes: [],
        deletedFolders: []
      };

      Object.defineProperty(window, 'electronAPI', {
        configurable: true,
        value: {
          pullCloudSyncData: async ({ allowCdnFallback }) => {
            return { success: true, data: clone(cloudStore) };
          },
          uploadCloudSyncData: async ({ data }) => {
            cloudStore = clone(data);
            return { success: true, statusCode: 200 };
          }
        }
      });

      renderSavedRoutesListFn();
      check(document.querySelector('.fav-route-card'), 'saved route card missing');

      const card = document.querySelector('.fav-route-card');
      card.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: 200, clientY: 220
      }));
      document.querySelector('.fav-route-context-menu .btn-ctx-rename')?.click();
      const input = document.querySelector('.fluent-prompt-input');
      check(input, 'rename prompt input missing');
      input.value = '北京崇礼滑雪自驾黄金线';
      input.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'Enter', code: 'Enter'
      }));

      await sleep(150);

      const localAfterRename = JSON.parse(localStorage.getItem('outmap_saved_routes'));
      check(localAfterRename[0].name === '北京崇礼滑雪自驾黄金线', 'local storage rename not persisted');
      check(savedRoutes[0].name === '北京崇礼滑雪自驾黄金线', 'memory savedRoutes rename not updated');

      // 连续并发触发多轮实时漫游同步
      await Promise.all([
        window.triggerRealtimeCloudSync('pagehide', true),
        window.triggerRealtimeCloudSync('visibility_hidden', true),
        window.triggerRealtimeCloudSync('focus_regained', true),
        window.triggerRealtimeCloudSync('periodic', true)
      ]);

      await sleep(200);

      // 验证经过多轮高并发同步冲刷后，本地和云端绝对没有回退为旧名称！
      const localAfterSyncs = JSON.parse(localStorage.getItem('outmap_saved_routes'));
      check(localAfterSyncs.length === 1, \`Route count must be 1, found: \${localAfterSyncs.length}\`);
      check(localAfterSyncs[0].name === '北京崇礼滑雪自驾黄金线',
        \`Route name REVERTED in localStorage! Found: \${localAfterSyncs[0].name}\`);
      check(savedRoutes[0].name === '北京崇礼滑雪自驾黄金线',
        \`Route name REVERTED in runtime! Found: \${savedRoutes[0].name}\`);
      check(cloudStore.routes[0].name === '北京崇礼滑雪自驾黄金线',
        \`Route name REVERTED in cloudStore! Found: \${cloudStore.routes[0].name}\`);

      // 验证 UI 列表卡片依然显示最新名称
      check(document.querySelector('.fav-route-name')?.textContent === '北京崇礼滑雪自驾黄金线',
        'UI route list card does not show updated name');

      localStorage.removeItem('outmap_user_account');
      delete window.electronAPI;

      return {
        compressionPassed: true,
        tombstoneRevivalPassed: true,
        renameDeduplicationPassed: true,
        concurrentSyncImmunityPassed: true,
        finalName: cloudStore.routes[0].name
      };
    })()`);

    console.log('v2.0.16 route sync resilience regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('v2.0.16 route sync resilience test failed:', error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

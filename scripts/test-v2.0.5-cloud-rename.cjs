const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceText = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });

const watchdog = setTimeout(() => {
  console.error('v2.0.5 cloud rename test timed out');
  app.exit(1);
}, 40000);

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
      const waitFor = async (predicate, message) => {
        for (let i = 0; i < 250; i++) {
          if (predicate()) return;
          await sleep(10);
        }
        throw new Error(message);
      };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      check(window.mapInstance?.__outmapStyleReady, 'map did not initialize');
      check(window.OUTMAP_APP_VERSION === '2.0.5', 'version mismatch');

      const oldRoute = {
        id: 'route_cloud_205', name: '服务器旧名称', mode: 'drive',
        timestamp: 1000, updatedAt: 1000,
        start: { coords: [118, 35], name: '起点' },
        end: { coords: [118.1, 35.1], name: '终点' },
        pathCoords: [[118, 35], [118.1, 35.1]], metrics: { distKm: 12 }
      };
      savedRoutes = [clone(oldRoute)];
      savedWaypoints = [{
        id: 'wp_cloud_205', name: '触发首轮上传', type: 'view', folder: 'default',
        lng: 118, lat: 35, coords: [118, 35], updatedAt: 2000
      }];
      localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
      localStorage.setItem('outmap_user_account', JSON.stringify({
        loggedIn: true, username: 'cloud-rename-test', password: '', syncKey: 'user_cloud_rename_test'
      }));

      let remoteData = {
        version: '2.0.4', username: 'cloud-rename-test', password: '',
        favorites: [], folders: [], routes: [clone(oldRoute)],
        deletedWaypoints: [], deletedRoutes: [], deletedFolders: [],
        folderTabOrder: [], folderTabOrderUpdatedAt: 0,
        builtinTabNames: {}, builtinTabNamesUpdatedAt: 0
      };
      let releaseFirstUpload;
      const firstUploadGate = new Promise(resolve => { releaseFirstUpload = resolve; });
      let uploadCount = 0;
      let pullCount = 0;
      Object.defineProperty(window, 'electronAPI', {
        configurable: true,
        value: {
          pullCloudSyncData: async () => {
            pullCount += 1;
            return { success: true, data: clone(remoteData) };
          },
          uploadCloudSyncData: async ({ data }) => {
            uploadCount += 1;
            if (uploadCount === 1) await firstUploadGate;
            remoteData = clone(data);
            return { success: true, statusCode: 200 };
          }
        }
      });

      // 先占用同步通道，复现用户操作正好撞上另一轮同步的场景。
      const firstSync = window.triggerRealtimeCloudSync('test_busy_sync', true);
      await waitFor(() => uploadCount === 1, 'first R2 upload did not start');

      renderSavedRoutesListFn();
      const card = document.querySelector('.fav-route-card');
      card.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: 200, clientY: 220
      }));
      document.querySelector('.fav-route-context-menu .btn-ctx-rename')?.click();
      const input = document.querySelector('.fluent-prompt-input');
      check(input, 'rename input missing');
      input.value = '服务器新名称';
      input.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'Enter', code: 'Enter'
      }));
      await sleep(80);

      check(JSON.parse(localStorage.getItem('outmap_saved_routes'))[0].name === '服务器新名称',
        'local rename was not persisted before cloud sync');
      check(remoteData.routes[0].name === '服务器旧名称',
        'server changed before the blocked upload was released');
      check(!String(document.getElementById('outmap-global-toast')?.textContent || '').includes('已重命名路线为'),
        'success was shown before R2 confirmation');

      releaseFirstUpload();
      await firstSync;
      await waitFor(() => uploadCount >= 2 && remoteData.routes[0]?.name === '服务器新名称',
        'queued rename never reached R2');
      await waitFor(() => String(document.getElementById('outmap-global-toast')?.textContent || '').includes('服务器新名称'),
        'success was not shown after R2 verification');

      check(remoteData.version === '2.0.5', 'R2 payload version mismatch');
      check(Number(remoteData.routes[0].updatedAt) > 1000, 'R2 route timestamp did not advance');
      check(pullCount >= 3, 'rename did not perform post-upload R2 verification');

      localStorage.removeItem('outmap_user_account');
      delete window.electronAPI;
      return {
        uploadCount,
        pullCount,
        remoteName: remoteData.routes[0].name,
        queuedSyncWaited: true,
        successAfterVerification: true
      };
    })()`);

    console.log('v2.0.5 cloud-confirmed route rename regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('v2.0.5 cloud rename test failed:', error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

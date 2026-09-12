const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

// 1. 语法树验证
new vm.Script(sourceText, { filename: 'src/app.js' });

const watchdog = setTimeout(() => {
  console.error('Test timed out');
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 720,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });

    await win.loadFile(path.join(root, 'src/index.html'));

    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const check = (ok, msg) => { if (!ok) throw new Error(msg); };

      // 等待基础初始化
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);

      // 1. 验证 mergeWaypoints LWW 仲裁
      const localWp = [{ id: 'wp_test', name: '旧名字', type: 'camp', folder: 'default', lng: 110.1, lat: 35.1, updatedAt: 1000 }];
      const cloudWp = [{ id: 'wp_test', name: '手机端新名字', type: 'view', folder: 'default', lng: 110.1, lat: 35.1, updatedAt: 2000 }];
      const merged1 = mergeWaypoints(localWp, cloudWp, []);
      check(merged1.length === 1, 'mergeWaypoints length mismatch');
      check(merged1[0].name === '手机端新名字', 'Cloud newer rename must win in mergeWaypoints: ' + merged1[0].name);
      check(merged1[0].type === 'view', 'Cloud newer type must win: ' + merged1[0].type);

      // 本地更新时，本地必须胜出
      const localNewerWp = [{ id: 'wp_test', name: '电脑端最新名字', type: 'photo', folder: 'default', lng: 110.1, lat: 35.1, updatedAt: 3000 }];
      const merged2 = mergeWaypoints(localNewerWp, cloudWp, []);
      check(merged2[0].name === '电脑端最新名字', 'Local newer rename must win in mergeWaypoints');

      // 2. 验证 mergeRoutes LWW 仲裁
      const localRoute = [{ id: 'r_test', name: '旧路线名', metrics: { distKm: 15 }, updatedAt: 1000 }];
      const cloudRoute = [{ id: 'r_test', name: '手机端新路线名', metrics: { distKm: 15 }, updatedAt: 2000 }];
      const mergedRoutes = mergeRoutes(localRoute, cloudRoute, []);
      check(mergedRoutes.length === 1, 'mergeRoutes length mismatch');
      check(mergedRoutes[0].name === '手机端新路线名', 'Cloud newer route rename must win: ' + mergedRoutes[0].name);

      // 3. 验证 mergeFolders LWW 仲裁
      const localFolder = [{ id: 'f_test', name: '旧分类名', updatedAt: 1000 }];
      const cloudFolder = [{ id: 'f_test', name: '新分类名', updatedAt: 2000 }];
      const mergedFolders = mergeFolders(localFolder, cloudFolder, []);
      check(mergedFolders.some(f => f.name === '新分类名'), 'Cloud newer folder rename must win');

      // 4. 验证 showFluentPrompt DOM 结构与多重提交机制
      let promptConfirmedVal = null;
      showFluentPrompt({
        title: '测试输入',
        initialValue: '初始文本',
        placeholder: '提示',
        onConfirm: (val) => { promptConfirmedVal = val; }
      });

      const overlay = document.querySelector('.fluent-prompt-overlay');
      check(overlay, 'Prompt overlay not found');
      const form = overlay.querySelector('.fluent-prompt-form');
      check(form, 'Prompt form not found');
      const input = overlay.querySelector('.fluent-prompt-input');
      check(input, 'Prompt input not found');
      check(input.getAttribute('enterkeyhint') === 'done', 'Input missing enterkeyhint=done');

      // 模拟 pointerdown 触控提交（防失焦吞点击）
      input.value = '通过触屏提交';
      const confirmBtn = overlay.querySelector('.btn-prompt-confirm');
      confirmBtn.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true }));
      await sleep(100);
      check(promptConfirmedVal === '通过触屏提交', 'pointerdown touch submit failed: ' + promptConfirmedVal);

      // 5. 验证渲染列表中的 ••• 更多操作按钮
      savedWaypoints = [{ id: 'wp_btn_test', name: '测试地点', type: 'view', lng: 116.4, lat: 39.9, ele: 50 }];
      savedRoutes = [{ id: 'r_btn_test', name: '测试路线', mode: 'drive', metrics: { distKm: 10, timeStr: '15分' } }];

      const ptsTab = document.querySelector('.fav-main-tab[data-tab="points"]');
      if (ptsTab) ptsTab.click();
      await sleep(100);

      const favItemMoreBtn = document.querySelector('.fav-item-card .fav-item-more-btn');
      check(favItemMoreBtn, 'fav-item-more-btn not rendered in fav-item-card');

      const routesTab = document.querySelector('.fav-main-tab[data-tab="routes"]');
      if (routesTab) routesTab.click();
      await sleep(100);

      const favRouteMoreBtn = document.querySelector('.fav-route-card .fav-route-more-btn');
      check(favRouteMoreBtn, 'fav-route-more-btn not rendered in fav-route-card');

      return {
        waypointsLwwPassed: true,
        routesLwwPassed: true,
        foldersLwwPassed: true,
        promptFormAndTouchPassed: true,
        moreButtonsPresent: true
      };
    })()`);

    console.log('v1.9.39 mobile interaction and cloud sync LWW regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (err) {
    console.error('v1.9.39 test failed:', err);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

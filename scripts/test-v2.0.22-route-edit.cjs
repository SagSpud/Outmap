const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve('C:\\Users\\cuihm\\.gemini\\antigravity\\scratch\\outmap');
const sourceText = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });

const watchdog = setTimeout(() => {
  console.error('v2.0.22 route edit test timed out');
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

      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      check(window.mapInstance?.__outmapStyleReady, 'map did not initialize');

      localStorage.removeItem('outmap_user_account');
      savedRoutes = [{
        id: 'route_edit_test_101',
        name: '测试自驾环线',
        mode: 'drive',
        timestamp: 1000,
        updatedAt: 1000,
        start: { coords: [118.0, 35.0], name: '测试起点' },
        end: { coords: [118.2, 35.2], name: '测试终点' },
        viaPoints: [
          { id: 'via_1', coords: [118.1, 35.1], name: '途径点A' }
        ],
        pathCoords: [[118.0, 35.0], [118.1, 35.1], [118.2, 35.2]],
        metrics: { totalDistKm: 25, distKm: 25, timeStr: '30分钟', totalAscent: 120 }
      }];
      localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));

      renderSavedRoutesListFn();

      // 1. 测试从三点按钮【•••】打开菜单，同样包含【编辑路线】
      const card = document.querySelector('.fav-route-card');
      check(card, 'saved route card missing');
      const moreBtn = card.querySelector('.fav-route-more-btn');
      check(moreBtn, 'more button missing');
      moreBtn.click();

      let menu = document.querySelector('.fav-route-context-menu');
      check(menu, 'route context menu missing from more button');
      let editBtn = menu.querySelector('.btn-ctx-edit');
      check(editBtn && editBtn.textContent.includes('编辑路线'), 'edit button missing from more menu');

      // 关闭菜单
      document.body.click();
      await sleep(100);

      // 2. 测试右键菜单中包含【编辑路线】，且位于【导出路线】上方
      card.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: 200, clientY: 220
      }));

      menu = document.querySelector('.fav-route-context-menu');
      check(menu, 'route context menu missing');

      const renameBtn = menu.querySelector('.btn-ctx-rename');
      editBtn = menu.querySelector('.btn-ctx-edit');
      const exportBtn = menu.querySelector('.btn-ctx-export');
      const delBtn = menu.querySelector('.btn-ctx-del');

      check(renameBtn, 'rename button missing');
      check(editBtn, 'edit button missing');
      check(exportBtn, 'export button missing');
      check(delBtn, 'delete button missing');
      check(editBtn.textContent.includes('编辑路线'), 'edit button text mismatch: ' + editBtn.textContent);

      // 检查顺序：editBtn 紧跟在 renameBtn 之后，且在 exportBtn 之前
      check(renameBtn.nextElementSibling === editBtn, 'edit button must be immediately after rename button');
      check(editBtn.nextElementSibling === exportBtn, 'edit button must be immediately before export button');

      // 3. 点击【编辑路线】调入路线规划器
      editBtn.click();
      await sleep(100);

      check(window.getCurrentEditingSavedRouteId() === 'route_edit_test_101', 'currentEditingSavedRouteId not set');
      const routePanel = document.getElementById('route-panel');
      check(routePanel && routePanel.style.display !== 'none', 'route panel not displayed');

      const startInput = document.getElementById('route-start-input');
      const endInput = document.getElementById('route-end-input');
      check(startInput && startInput.value === '测试起点', 'start input mismatch: ' + startInput?.value);
      check(endInput && endInput.value === '测试终点', 'end input mismatch: ' + endInput?.value);
      check(routeViaPoints.length === 1, 'via points count mismatch: ' + routeViaPoints.length);
      check(routeViaPoints[0].name === '途径点A', 'via point name mismatch: ' + routeViaPoints[0]?.name);

      // 4. 在路线规划面板中插入一个中间途径点
      routeViaPoints.push({
        id: 'via_new_2',
        coords: [118.15, 35.15],
        name: '新增途径点B',
        marker: null
      });
      renderViaList(window.mapInstance);
      check(routeViaPoints.length === 2, 'via points after add mismatch: ' + routeViaPoints.length);

      // 5. 点击【收藏/保存】按钮，验证弹窗与原地更新
      const btnSaveRoute = document.getElementById('btn-save-route') || document.getElementById('btn-save-route-trigger');
      btnSaveRoute.click();
      await sleep(50);

      const saveModal = document.getElementById('save-route-modal');
      check(saveModal && saveModal.style.display !== 'none', 'save route modal not open');

      const modalTitle = saveModal.querySelector('.save-route-title');
      check(modalTitle && modalTitle.innerText.includes('编辑保存路线'), 'modal title mismatch: ' + modalTitle?.innerText);

      const btnConfirm = document.getElementById('btn-confirm-save-route');
      check(btnConfirm && btnConfirm.innerText.includes('保存修改'), 'confirm button text mismatch: ' + btnConfirm?.innerText);

      const saveNameInput = document.getElementById('save-route-name-input');
      check(saveNameInput && saveNameInput.value === '测试自驾环线', 'route name input mismatch: ' + saveNameInput?.value);

      // 更改路线名称并确认保存
      saveNameInput.value = '测试自驾环线_已修改';
      btnConfirm.click();
      await sleep(100);

      // 验证保存结果：原地更新，记录数仍为 1，不产生重复路线
      check(savedRoutes.length === 1, 'savedRoutes length should still be 1, but got: ' + savedRoutes.length);
      const updatedRoute = savedRoutes[0];
      check(updatedRoute.id === 'route_edit_test_101', 'route id changed unexpectedly: ' + updatedRoute.id);
      check(updatedRoute.name === '测试自驾环线_已修改', 'updated name mismatch: ' + updatedRoute.name);
      check(updatedRoute.viaPoints.length === 2, 'updated viaPoints count mismatch: ' + updatedRoute.viaPoints.length);
      check(updatedRoute.viaPoints[1].name === '新增途径点B', 'updated via point name mismatch: ' + updatedRoute.viaPoints[1].name);
      check(updatedRoute.end.name === '测试终点', 'end name mismatch: ' + updatedRoute.end.name);

      const stored = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
      check(stored.length === 1 && stored[0].name === '测试自驾环线_已修改', 'localStorage not updated properly');

      // 6. 点击清空按钮，验证编辑状态已重置为 null
      const btnClearRoute = document.getElementById('btn-clear-route');
      btnClearRoute.click();
      await sleep(50);
      check(window.getCurrentEditingSavedRouteId() === null, 'currentEditingSavedRouteId should be reset to null on clear');

      return { success: true };
    })()`);

    clearTimeout(watchdog);
    console.log('[v2.0.22 route edit test passed]', JSON.stringify(result));
    app.exit(0);
  } catch (err) {
    clearTimeout(watchdog);
    console.error('[v2.0.22 route edit test failed]', err);
    app.exit(1);
  }
});

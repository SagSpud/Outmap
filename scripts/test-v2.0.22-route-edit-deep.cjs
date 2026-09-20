const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve('C:\\Users\\cuihm\\.gemini\\antigravity\\scratch\\outmap');
const sourceText = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });

const watchdog = setTimeout(() => {
  console.error('v2.0.22 deep route edit test timed out');
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

      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      check(window.mapInstance?.__outmapStyleReady, 'map did not initialize');

      localStorage.removeItem('outmap_user_account');
      savedRoutes = [{
        id: 'route_deep_test_001',
        name: '川西四姑娘山穿越线',
        mode: 'drive',
        timestamp: 1000,
        updatedAt: 1000,
        start: { coords: [102.8, 31.0], name: '成都起点' },
        end: { coords: [102.9, 31.1], name: '四姑娘山终点' },
        viaPoints: [
          { id: 'via_1', coords: [102.85, 31.05], name: '巴朗山哑口' }
        ],
        pathCoords: [[102.8, 31.0], [102.85, 31.05], [102.9, 31.1]],
        metrics: { totalDistKm: 180, distKm: 180, timeStr: '3小时30分', totalAscent: 2800 }
      }];
      localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));
      renderSavedRoutesListFn();

      // 阶段 1: 验证载入路线后，进入编辑态
      window.loadSavedRoute('route_deep_test_001', window.mapInstance, 'editing');
      await sleep(100);

      check(window.getCurrentEditingSavedRouteId() === 'route_deep_test_001', 'currentEditingSavedRouteId mismatch');

      const editBanner = document.getElementById('route-editing-banner');
      check(editBanner && editBanner.style.display !== 'none', 'route-editing-banner should be displayed');
      const editNameTxt = document.getElementById('route-editing-name-txt');
      check(editNameTxt && editNameTxt.innerText.includes('川西四姑娘山穿越线'), 'route-editing-name-txt mismatch: ' + editNameTxt?.innerText);

      const btnSaveTrigger = document.getElementById('btn-save-route-trigger');
      check(btnSaveTrigger && btnSaveTrigger.classList.contains('is-editing'), 'btnSaveRouteTrigger should have is-editing class');
      check(btnSaveTrigger.innerText === '保存修改', 'btnSaveRouteTrigger text should be "保存修改", got: ' + btnSaveTrigger.innerText);

      const card = document.querySelector('.fav-route-card');
      check(card && card.classList.contains('is-editing-route'), 'saved route card should have is-editing-route class');
      const editingIndicator = card.querySelector('.fav-route-editing-indicator');
      check(editingIndicator && editingIndicator.innerText.includes('编辑中'), 'card should display [编辑中] badge');

      // 阶段 2: 修改途径点并保存，验证覆盖更新与成功视觉反馈
      routeViaPoints.push({
        id: 'via_2',
        coords: [102.88, 31.08],
        name: '猫鼻梁观景台',
        marker: null
      });
      renderViaList(window.mapInstance);

      btnSaveTrigger.click();
      await sleep(50);

      const saveModal = document.getElementById('save-route-modal');
      check(saveModal && saveModal.style.display !== 'none', 'save modal should open');
      const btnConfirmSave = document.getElementById('btn-confirm-save-route');
      check(btnConfirmSave && btnConfirmSave.innerText.includes('保存修改'), 'confirm button text should be "保存修改"');

      const btnSaveAsNew = document.getElementById('btn-save-as-new-route');
      check(btnSaveAsNew && btnSaveAsNew.style.display !== 'none', 'btnSaveAsNewRoute should be visible during editing');

      const nameInput = document.getElementById('save-route-name-input');
      nameInput.value = '川西四姑娘山穿越线(已加猫鼻梁)';
      btnConfirmSave.click();
      await sleep(100);

      // 验证保存修改后的持久化与状态
      check(savedRoutes.length === 1, 'savedRoutes count should still be 1 after in-place update');
      check(savedRoutes[0].name === '川西四姑娘山穿越线(已加猫鼻梁)', 'saved route name not updated');
      check(savedRoutes[0].viaPoints.length === 2, 'via points not updated in route object');
      check(savedRoutes[0].viaPoints[1].name === '猫鼻梁观景台', 'new via point name mismatch');

      const localData1 = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
      check(localData1.length === 1 && localData1[0].name === '川西四姑娘山穿越线(已加猫鼻梁)', 'localStorage not updated with new name');

      // 验证成功反馈样式 (短暂变绿并显示 ✓ 已保存修改)
      check(btnSaveTrigger.classList.contains('saved-success'), 'btnSaveTrigger should have saved-success class');
      check(btnSaveTrigger.innerText.includes('已保存'), 'btnSaveTrigger should indicate saved success');

      // 验证 Banner 上的名称也同步更新
      check(editNameTxt.innerText.includes('已加猫鼻梁'), 'banner name should reflect updated name');

      // 阶段 3: 测试【另存为新路线】
      btnSaveTrigger.click();
      await sleep(50);
      nameInput.value = '川西四姑娘山经典徒步二期';
      btnSaveAsNew.click();
      await sleep(100);

      // 验证另存为结果：两条独立路线，且当前编辑态切换到新路线
      check(savedRoutes.length === 2, 'savedRoutes count should be 2 after save-as-new, got: ' + savedRoutes.length);
      const newRoute = savedRoutes[0];
      const oldRoute = savedRoutes[1];
      check(newRoute.name === '川西四姑娘山经典徒步二期', 'new route name mismatch: ' + newRoute.name);
      check(oldRoute.name === '川西四姑娘山穿越线(已加猫鼻梁)', 'original route should be preserved intact');
      check(newRoute.id !== oldRoute.id, 'new route must have a new distinct ID');

      const localData2 = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
      check(localData2.length === 2, 'localStorage should contain 2 routes');

      // 验证另存为反馈
      check(btnSaveTrigger.innerText.includes('已保存'), 'button text should indicate save success');
      check(window.getCurrentEditingSavedRouteId() === newRoute.id, 'editing route ID should switch to new route');
      check(editNameTxt.innerText.includes('二期'), 'banner name should update to new route name');

      // 阶段 4: 测试【退出编辑】
      const btnExitEdit = document.getElementById('btn-exit-route-edit');
      check(btnExitEdit, 'btn-exit-route-edit missing');
      btnExitEdit.click();
      await sleep(50);

      check(window.getCurrentEditingSavedRouteId() === null, 'editing route ID should be null after exit');
      check(editBanner.style.display === 'none', 'edit banner should be hidden after exit');
      check(btnSaveTrigger.innerText === '收藏', 'button text should revert to "收藏"');
      check(!btnSaveTrigger.classList.contains('is-editing'), 'button should not have is-editing class');

      // 验证收藏列表中不再有高亮编辑状态
      const editingCards = document.querySelectorAll('.fav-route-card.is-editing-route');
      check(editingCards.length === 0, 'no cards should have is-editing-route after exit');

      // 阶段 5: 测试【清空】重置
      window.loadSavedRoute(oldRoute.id, window.mapInstance, 'editing');
      await sleep(50);
      check(window.getCurrentEditingSavedRouteId() === oldRoute.id, 'route should be editing again');
      const btnClear = document.getElementById('btn-clear-route');
      btnClear.click();
      await sleep(50);
      check(window.getCurrentEditingSavedRouteId() === null, 'route edit state should be cleared on btnClear');
      check(editBanner.style.display === 'none', 'banner should be hidden after clear');

      return {
        success: true,
        tests: [
          'loadSavedRoute UI state (banner, button, card badge)',
          'in-place route update & persistent storage verification',
          'save success green visual badge & toast feedback',
          'save as new route with distinct ID & dual records',
          'exit route edit button state reset',
          'clear route reset'
        ]
      };
    })()`);

    clearTimeout(watchdog);
    console.log('[v2.0.22 deep route edit test PASSED]');
    console.log(JSON.stringify(result, null, 2));
    app.exit(0);
  } catch (err) {
    clearTimeout(watchdog);
    console.error('[v2.0.22 deep route edit test FAILED]', err);
    app.exit(1);
  }
});

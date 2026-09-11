const { app, BrowserWindow } = require('electron');
const path = require('path');
const assert = require('assert');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await win.loadFile(path.join(__dirname, '../src/index.html'));

  // Wait for initial scripts to load
  await new Promise(r => setTimeout(r, 1000));

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      // 1. Setup mock custom folders and waypoints
      const testFolders = [
        { id: 'folder_1', name: '[导入] 西北自驾第一段' },
        { id: 'folder_2', name: '陕北峡谷探秘' },
        { id: 'folder_3', name: '太行山大环线' }
      ];
      localStorage.setItem('outmap_custom_folders', JSON.stringify(testFolders));

      const testWaypoints = [
        { id: 'wp_test_1', name: '贺兰山岩画风景区', lng: 106.014, lat: 38.748, type: 'view', folder: 'folder_1' },
        { id: 'wp_test_2', name: '延安甘泉大峡谷', lng: 106.233, lat: 36.505, type: 'view', folder: 'folder_2' }
      ];
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(testWaypoints));

      const testRoutes = [
        { id: 'route_test_1', name: '11天西北自驾大环线', mode: 'drive', metrics: { distKm: 3450, timeStr: '38小时', ascent: 8500 }, createdAt: '2026-09-11' }
      ];
      localStorage.setItem('outmap_saved_routes', JSON.stringify(testRoutes));

      // Reload favorites in app
      if (typeof window.reloadFavoritesData === 'function') {
        window.reloadFavoritesData();
      }

      // 2. Verify Folder Tabs DOM and Draggability
      const favTabs = document.getElementById('fav-folder-tabs');
      const tabs = Array.from(favTabs.querySelectorAll('.fav-tab'));
      const customTabs = tabs.filter(t => t.draggable && t.getAttribute('data-tab-id')?.startsWith('folder_'));

      const hasCustomTabs = customTabs.length === 3;
      const customTitles = customTabs.map(t => t.innerText);

      // 3. Test Fluent Prompt dialog
      let promptOpened = false;
      let promptConfirmedValue = null;
      window.showFluentPrompt({
        title: '测试重命名',
        initialValue: '原名称',
        onConfirm: (val) => {
          promptConfirmedValue = val;
        }
      });

      const overlay = document.querySelector('.fluent-prompt-overlay');
      promptOpened = Boolean(overlay && overlay.classList.contains('prompt-active'));
      const promptInput = overlay ? overlay.querySelector('.fluent-prompt-input') : null;
      if (promptInput) {
        promptInput.value = '新名称成功';
        const confirmBtn = overlay.querySelector('.btn-prompt-confirm');
        confirmBtn?.click();
      }

      await new Promise(r => setTimeout(r, 200));

      // 4. Test Waypoint Context Menu has Rename button
      window.showChangeWaypointTypeMenu(testWaypoints[0], 200, 200);
      const wpMenu = document.querySelector('.fav-point-type-menu');
      const hasWpRename = Boolean(wpMenu && wpMenu.querySelector('.fav-type-rename'));
      const hasWpDelete = Boolean(wpMenu && wpMenu.querySelector('.fav-type-delete'));

      // Close wp menu
      wpMenu?.remove();

      // 5. Test Route Context Menu has Rename button
      const favRoutesList = document.getElementById('fav-routes-list');
      const routeCards = favRoutesList.querySelectorAll('.fav-route-card');
      const hasRouteCard = routeCards.length > 0;

      // Dispatch contextmenu on route card
      if (hasRouteCard) {
        const evt = new MouseEvent('contextmenu', { clientX: 250, clientY: 250, bubbles: true });
        routeCards[0].dispatchEvent(evt);
      }
      const routeMenu = document.querySelector('.fav-route-context-menu');
      const hasRouteRename = Boolean(routeMenu && routeMenu.querySelector('.btn-ctx-rename'));
      const hasRouteExport = Boolean(routeMenu && routeMenu.querySelector('.btn-ctx-export'));
      const hasRouteDelete = Boolean(routeMenu && routeMenu.querySelector('.btn-ctx-del'));
      routeMenu?.remove();

      return {
        hasCustomTabs,
        customTitles,
        promptOpened,
        promptConfirmedValue,
        hasWpRename,
        hasWpDelete,
        hasRouteCard,
        hasRouteRename,
        hasRouteExport,
        hasRouteDelete
      };
    })()
  `);

  console.log('Runtime test results:', result);
  assert.strictEqual(result.hasCustomTabs, true, 'All 3 custom folder tabs must be draggable');
  assert.strictEqual(result.promptOpened, true, 'Fluent prompt dialog must open with active animation');
  assert.strictEqual(result.promptConfirmedValue, '新名称成功', 'Fluent prompt must deliver confirmed value');
  assert.strictEqual(result.hasWpRename, true, 'Waypoint context menu must include rename action');
  assert.strictEqual(result.hasWpDelete, true, 'Waypoint context menu must include delete action');
  assert.strictEqual(result.hasRouteRename, true, 'Route context menu must include rename action');
  assert.strictEqual(result.hasRouteExport, true, 'Route context menu must include export action');
  assert.strictEqual(result.hasRouteDelete, true, 'Route context menu must include delete action');

  console.log('🎉 ALL v1.9.20 RUNTIME INTERACTION CHECKS PASSED!');
  win.close();
  app.quit();
});

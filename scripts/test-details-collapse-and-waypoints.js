const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

const projectRoot = path.join(__dirname, '..');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');
const watchdog = setTimeout(() => { console.error('Details collapse test timed out'); app.exit(1); }, 40000);

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
    webPreferences: { preload: path.join(projectRoot, 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(projectRoot, 'src', 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 800));

  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance) await sleep(50);
    const m = window.mapInstance;

    // 1. 打开路线规划面板
    const btnFabRoute = document.getElementById('btn-fab-route');
    if (btnFabRoute) btnFabRoute.click();
    await sleep(60);

    const routePanel = document.getElementById('route-panel');
    const startInput = document.getElementById('route-start-input');
    const endInput = document.getElementById('route-end-input');
    const btnCalcRoute = document.getElementById('btn-calc-route');
    const btnDetailsToggle = document.getElementById('btn-route-details-toggle');
    const statsBox = document.getElementById('route-stats-box');
    const chartSection = document.getElementById('route-chart-section');
    const btnCloseChartSection = document.getElementById('btn-close-chart-section');
    const pointsBox = document.querySelector('.route-points-box');

    // 2. 清空并使用地图选点连续录入起点、终点和多个途径点
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

    mockClick(116.8388, 38.3045); // 点 1: 起点 (沧州)
    await sleep(60);
    mockClick(117.1522, 37.9122); // 点 2: 终点 (孟寺镇)
    await sleep(60);
    mockClick(116.90, 38.20);    // 点 3: 途径点 1
    await sleep(60);
    mockClick(116.95, 38.10);    // 点 4: 途径点 2
    await sleep(60);
    mockClick(117.05, 38.00);    // 点 5: 途径点 3
    await sleep(60);

    // 3. 规划路线
    btnCalcRoute.click();
    await sleep(1500);

    const initialDetailsText = btnDetailsToggle ? btnDetailsToggle.innerText.trim() : '';
    const initialStatsDisplay = statsBox ? getComputedStyle(statsBox).display : '';
    const initialChartDisplay = chartSection ? getComputedStyle(chartSection).display : '';
    const pointsBoxFlexShrink = pointsBox ? getComputedStyle(pointsBox).flexShrink : '';
    const pointsBoxHeight = pointsBox ? pointsBox.getBoundingClientRect().height : 0;
    const viaItemCount = document.querySelectorAll('#route-via-list .route-via-item').length;

    // 4. 点击“详情 ▾”按钮展开指标
    btnDetailsToggle.click();
    await sleep(100);

    const afterDetailsClickText = btnDetailsToggle.innerText.trim();
    const afterDetailsStatsDisplay = getComputedStyle(statsBox).display;
    const afterDetailsChartDisplay = getComputedStyle(chartSection).display;

    // 5. 点击累计爬升卡片展开高程剖面图
    const statAscent = document.getElementById('stat-card-ascent');
    if (statAscent) statAscent.click();
    await sleep(250);

    const afterChartOpenText = btnDetailsToggle.innerText.trim();
    const afterChartOpenDisplay = getComputedStyle(chartSection).display;
    const hasCloseBtn = Boolean(btnCloseChartSection);
    const pointsBoxHeightWhileChartOpen = pointsBox ? pointsBox.getBoundingClientRect().height : 0;

    // 6. 核心根因检验：“还收不回去”彻底修复
    // 用户此时点击详情按钮（文案为“收起”），必须将 statsBox 和 chartSection 一并收起！
    btnDetailsToggle.click();
    await sleep(120);

    const afterCollapseBtnText = btnDetailsToggle.innerText.trim();
    const afterCollapseStatsDisplay = getComputedStyle(statsBox).display;
    const afterCollapseChartDisplay = getComputedStyle(chartSection).display;

    // 7. 测试剖面图右上角专属 ✕ 关闭按钮
    btnDetailsToggle.click();
    await sleep(80);
    statAscent.click();
    await sleep(150);

    // 点击 ✕ 关闭剖面图
    btnCloseChartSection.click();
    await sleep(100);

    const afterXClickChartDisplay = getComputedStyle(chartSection).display;
    const afterXClickStatsDisplay = getComputedStyle(statsBox).display;
    const afterXClickBtnText = btnDetailsToggle.innerText.trim();

    // 再次点击“收起”关闭 statsBox
    btnDetailsToggle.click();
    await sleep(80);
    const finalStatsDisplay = getComputedStyle(statsBox).display;
    const finalBtnText = btnDetailsToggle.innerText.trim();

    return {
      initialDetailsText,
      initialStatsDisplay,
      initialChartDisplay,
      pointsBoxFlexShrink,
      pointsBoxHeight,
      viaItemCount,
      afterDetailsClickText,
      afterDetailsStatsDisplay,
      afterDetailsChartDisplay,
      afterChartOpenText,
      afterChartOpenDisplay,
      hasCloseBtn,
      pointsBoxHeightWhileChartOpen,
      afterCollapseBtnText,
      afterCollapseStatsDisplay,
      afterCollapseChartDisplay,
      afterXClickChartDisplay,
      afterXClickStatsDisplay,
      afterXClickBtnText,
      finalStatsDisplay,
      finalBtnText
    };
  })()`);

  console.log('DETAILS COLLAPSE & WAYPOINTS TEST RESULTS:\n' + JSON.stringify(result, null, 2));

  try {
    // 验证初始状态
    assert.strictEqual(result.initialDetailsText, '详情 ▾', 'Initial button text should be 详情 ▾');
    assert.strictEqual(result.initialStatsDisplay, 'none', 'Stats box should be initially hidden');
    assert.strictEqual(result.initialChartDisplay, 'none', 'Chart section should be initially hidden');
    assert.strictEqual(result.pointsBoxFlexShrink, '0', 'pointsBox must have flex-shrink: 0');
    assert.ok(result.pointsBoxHeight >= 76, 'pointsBox height must be >= 76px');
    assert.ok(result.viaItemCount >= 2, 'Should have multiple via points recorded');

    // 验证展开详情
    assert.strictEqual(result.afterDetailsClickText, '收起', 'Button should say 收起 after clicking');
    assert.strictEqual(result.afterDetailsStatsDisplay, 'grid', 'Stats box should be displayed as grid');

    // 验证展开图表
    assert.strictEqual(result.afterChartOpenText, '收起', 'Button should remain 收起 when chart is open');
    assert.strictEqual(result.afterChartOpenDisplay, 'flex', 'Chart should be displayed as flex');
    assert.strictEqual(result.hasCloseBtn, true, 'Chart close button must exist');
    assert.ok(result.pointsBoxHeightWhileChartOpen >= 76, 'pointsBox must not be crushed below 76px while chart is open');

    // 验证核心问题“还收不回去”彻底修复：点击“收起”后两者都必须变为 none，按钮变回“详情 ▾”
    assert.strictEqual(result.afterCollapseBtnText, '详情 ▾', 'Button text must revert to 详情 ▾ on collapse');
    assert.strictEqual(result.afterCollapseStatsDisplay, 'none', 'Stats box must be none after collapse');
    assert.strictEqual(result.afterCollapseChartDisplay, 'none', 'Elevation chart section must be none after collapse');

    // 验证专属 ✕ 按钮独立关闭图表
    assert.strictEqual(result.afterXClickChartDisplay, 'none', 'Elevation chart must be hidden after clicking close ✕ button');
    assert.strictEqual(result.afterXClickStatsDisplay, 'grid', 'Stats box should remain open if only chart was closed by ✕');
    assert.strictEqual(result.afterXClickBtnText, '收起', 'Button text should stay 收起 while stats is still open');

    // 验证关闭剩下的 statsBox
    assert.strictEqual(result.finalStatsDisplay, 'none', 'Stats box should be hidden after final toggle');
    assert.strictEqual(result.finalBtnText, '详情 ▾', 'Button text should be 详情 ▾ at the end');

    console.log('✅ ALL DETAILS COLLAPSE & WAYPOINT PROTECTION CHECKS PASSED!');
    clearTimeout(watchdog);
    win.destroy();
    app.quit();
  } catch (err) {
    console.error('❌ ASSERTION FAILURE:', err);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(1);
  }
});

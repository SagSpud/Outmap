const { app, BrowserWindow } = require('electron');
const path = require('path');
const assert = require('assert');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('Test execution timed out after 30s!');
  process.exit(1);
}, 30000).unref();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 390,
    height: 844,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadFile(path.join(__dirname, '../src/index.html'));
  await new Promise(r => setTimeout(r, 2600));

  const result = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const m = window.mapInstance;
      const logs = [];

      // 1. 打开路线规划面板
      const btnFabRoute = document.getElementById('btn-fab-route');
      btnFabRoute.click();

      const routePanel = document.getElementById('route-panel');
      const startInput = document.getElementById('route-start-input');
      const endInput = document.getElementById('route-end-input');

      await new Promise(r => setTimeout(r, 400));

      // 2. 测试起点输入 "银川市" (城市，预期 zoom 12.0)
      startInput.focus();
      startInput.value = '银川市';
      startInput.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(r => setTimeout(r, 700));
      const floatingDropdown = document.querySelector('.route-floating-dropdown');
      const dropRect = floatingDropdown ? floatingDropdown.getBoundingClientRect() : null;

      // 验证浮动下拉框不超出屏幕左右边界
      const dropdownWithinScreen = dropRect && dropRect.left >= 0 && dropRect.right <= window.innerWidth;

      const firstItem = floatingDropdown ? floatingDropdown.querySelector('.route-floating-item') : null;
      if (firstItem) firstItem.click();

      await new Promise(r => setTimeout(r, 1200));

      const panelRect2 = routePanel.getBoundingClientRect();
      const allMarkers = Array.from(document.querySelectorAll('.maplibregl-marker')).map(el => {
        const b = el.getBoundingClientRect();
        return {
          text: el.innerText.trim(),
          top: b.top,
          bottom: b.bottom,
          left: b.left,
          right: b.right
        };
      });

      const startMarker = allMarkers.find(mk => mk.text === '起');
      const isStartBehindPanel = startMarker ? (startMarker.bottom >= panelRect2.top) : null;

      logs.push({
        step: 'select_city_yinchuan',
        zoom: m.getZoom(),
        pitch: m.getPitch(),
        panelTop: panelRect2.top,
        panelHeight: panelRect2.height,
        startMarker,
        isStartBehindPanel,
        dropdownWithinScreen
      });

      // 3. 测试终点输入 "成都市" (地级市，预期 zoom 12.0 ~ 12.5)
      endInput.focus();
      endInput.value = '成都市';
      endInput.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(r => setTimeout(r, 400));
      const floatingDropdown2 = document.querySelector('.route-floating-dropdown');
      const cityItem = floatingDropdown2 ? floatingDropdown2.querySelector('.route-floating-item') : null;
      if (cityItem) cityItem.click();

      await new Promise(r => setTimeout(r, 1200));

      const panelRect3 = routePanel.getBoundingClientRect();
      const allMarkers2 = Array.from(document.querySelectorAll('.maplibregl-marker')).map(el => {
        const b = el.getBoundingClientRect();
        return {
          text: el.innerText.trim(),
          top: b.top,
          bottom: b.bottom
        };
      });

      const endMarker = allMarkers2.find(mk => mk.text === '终');
      const isEndBehindPanel = endMarker ? (endMarker.bottom >= panelRect3.top) : null;

      logs.push({
        step: 'select_city_chengdu',
        zoom: m.getZoom(),
        panelTop: panelRect3.top,
        endMarker,
        isEndBehindPanel
      });

      // 4. 测试规划与全览 (两点规划后点击规划)
      const btnCalc = document.getElementById('btn-calc-route');
      if (btnCalc) btnCalc.click();

      await new Promise(r => setTimeout(r, 1600));

      // 5. 测试展开详情与海拔剖面
      const btnDetails = document.getElementById('btn-route-details-toggle');
      if (btnDetails) btnDetails.click();

      const statAscent = document.getElementById('stat-card-ascent');
      if (statAscent) statAscent.click();

      await new Promise(r => setTimeout(r, 500));

      const panelRectExpanded = routePanel.getBoundingClientRect();
      const panelHeader = routePanel.querySelector('.panel-header');
      const panelBody = routePanel.querySelector('.panel-body');
      const headerRect = panelHeader ? panelHeader.getBoundingClientRect() : null;

      // 验证头部被固定在顶部，未被滚走
      const isHeaderPinned = headerRect && Math.abs(headerRect.top - panelRectExpanded.top) < 2;
      const isBodyScrollable = panelBody && (panelBody.scrollHeight >= panelBody.clientHeight);

      logs.push({
        step: 'expanded_details_and_chart',
        panelHeight: panelRectExpanded.height,
        isHeaderPinned,
        isBodyScrollable,
        bodyScrollHeight: panelBody ? panelBody.scrollHeight : 0,
        bodyClientHeight: panelBody ? panelBody.clientHeight : 0
      });

      resolve(logs);
    });
  `);

  console.log('MOBILE ROUTE TEST 3 RESULTS:\n' + JSON.stringify(result, null, 2));

  // 断言验证
  const step1 = result.find(r => r.step === 'select_city_yinchuan');
  assert(step1, 'Step 1 must exist');
  assert(Math.abs(step1.zoom - 12.0) < 0.5, `Yinchuan city zoom should be ~12.0, got ${step1.zoom}`);
  assert.strictEqual(step1.isStartBehindPanel, false, `Start marker must NOT be behind route panel! Marker bottom: ${step1.startMarker.bottom}, Panel top: ${step1.panelTop}`);
  assert.strictEqual(step1.dropdownWithinScreen, true, 'Dropdown must be within screen width');

  const step2 = result.find(r => r.step === 'select_city_chengdu');
  assert(step2, 'Step 2 must exist');
  assert(step2.zoom <= 12.6 && step2.zoom >= 11.8, `Chengdu city zoom should be ~12.0-12.5, got ${step2.zoom}`);
  assert.strictEqual(step2.isEndBehindPanel, false, `End marker must NOT be behind route panel! Marker bottom: ${step2.endMarker.bottom}, Panel top: ${step2.panelTop}`);

  const step3 = result.find(r => r.step === 'expanded_details_and_chart');
  assert(step3, 'Step 3 must exist');
  assert.strictEqual(step3.isHeaderPinned, true, 'Panel header must stay pinned at top of sheet');

  console.log('🎉 ALL MOBILE ROUTE ASSERTIONS PASSED SUCCESSFULLY!');
  app.quit();
});

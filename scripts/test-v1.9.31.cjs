const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
// Compile whole scripts, not merely check for expected strings (1.9.30 regression).
for (const file of ['main.js', 'preload.js', 'src/app.js', 'src/favorite-interactions.js', 'src/location-camera.js']) {
  new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}
const query = source.slice(source.indexOf('const locationSearchControllers ='), source.indexOf("if (typeof window !== 'undefined') {\n  window.queryLocationCandidates"));
const gesture = source.slice(source.indexOf('function enableMobileSwipeDownToClose'), source.indexOf('// Fluent / Apple'));
const watchdog = setTimeout(() => app.exit(1), 30000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 390, height: 844,
    webPreferences: { offscreen: true, backgroundThrottling: false } });
  try {
    await win.loadURL('about:blank');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
    });
    await win.webContents.executeJavaScript(query + '\n' + gesture);
    const result = await win.webContents.executeJavaScript(`(async () => {
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      window.parseCoordinates = () => null;
      window.cleanFolderTitle = s => s;
      window.savedWaypoints = [{ name: '本地收藏', lng: 118, lat: 35 }];
      window.PROVINCES_DATA = {};
      window.MAJOR_CITIES = [];
      let requests = [];
      window.fetch = (url, options) => new Promise((resolve, reject) => {
        requests.push({ url, signal: options.signal, resolve });
        options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
      });
      const local = await queryLocationCandidates('本地收藏');
      check(local.length === 1 && requests.length === 0, 'exact local match must not wait for network');
      const start = {}, end = {};
      const a = queryLocationCandidates('起点甲', start);
      const b = queryLocationCandidates('终点乙', end);
      check(!requests[0].signal.aborted && !requests[1].signal.aborted, 'independent inputs cancel each other');
      const c = queryLocationCandidates('起点丙', start);
      check(requests[0].signal.aborted && !requests[1].signal.aborted, 'same input must cancel stale request only');
      const feature = { properties: { name: '有效地点' }, geometry: { type: 'Point', coordinates: [118, 35] } };
      requests[1].resolve({ ok: true, json: async () => ({ features: [null, {}, { geometry: null }, feature] }) });
      requests[2].resolve({ ok: true, json: async () => ({ features: [feature] }) });
      check((await a).length === 0 && (await b).length === 1 && (await c).length === 1, 'malformed feature or cancelled search broke valid results');
      // Once headers arrive, response-body reading must remain bounded by timeout.
      const nativeTimer = window.setTimeout;
      window.setTimeout = (fn, ms) => nativeTimer(fn, ms === 6500 ? 20 : ms);
      window.fetch = async (url, { signal }) => ({ ok: true, json: () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')));
      }) });
      check((await queryLocationCandidates('慢响应体', {})).length === 0, 'body timeout did not recover');
      window.setTimeout = nativeTimer;

      document.body.innerHTML = '<section id="panel" style="transform:translateX(-50%)"><header>标题<button>关闭</button></header></section>';
      const panel = document.getElementById('panel'), header = panel.querySelector('header');
      let closed = 0;
      enableMobileSwipeDownToClose(panel, header, () => closed++);
      enableMobileSwipeDownToClose(panel, header, () => closed++);
      const touch = (type, y, target = header, count = 1) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: Array.from({ length: count }, (_, id) => ({ identifier: id, clientX: 50, clientY: y })) });
        target.dispatchEvent(event);
        return event;
      };
      touch('touchstart', 10); const move = touch('touchmove', 90);
      check(move.defaultPrevented && panel.style.translate === '0px 80px', 'gesture must track and prevent scroll');
      check(panel.style.transform === 'translateX(-50%)', 'gesture overwrote base transform');
      touch('touchcancel', 90);
      check(closed === 0 && panel.style.translate === '', 'cancel must restore without closing');
      check(panel.getAnimations().length > 0, 'cancel must animate rebound');
      touch('touchstart', 10); touch('touchmove', 90); touch('touchend', 90);
      check(closed === 1, 'dismiss should fire once, including after duplicate binding');
      touch('touchstart', 10, header.querySelector('button')); touch('touchmove', 100); touch('touchend', 100);
      check(closed === 1, 'button touch incorrectly began a drag');
      touch('touchstart', 10); touch('touchmove', 100); touch('touchstart', 100, header, 2); touch('touchend', 100);
      check(closed === 1, 'multitouch must cancel rather than dismiss');
      return { exactLocal: true, isolatedSearch: true, staleCancellation: true, malformedData: true,
        responseBodyTimeout: true, swipeCancel: true, rebound: true, duplicateBinding: true, multitouch: true };
    })()`);
    assert(Object.values(result).every(Boolean));
    console.log('1.9.31 runtime regressions passed:', result);
    await win.loadFile(path.join(root, 'src/index.html'));
    for (const metrics of [
      { width: 960, height: 540, deviceScaleFactor: 2, mobile: false },
      { width: 390, height: 400, deviceScaleFactor: 3, mobile: true }
    ]) {
      await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', metrics);
      const menuResult = await win.webContents.executeJavaScript(`(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        for (let n = 0; n < 100 && !window.showChangeWaypointTypeMenu; n++) await sleep(50);
        await sleep(500); // Allow map.resize/movestart to finish before opening a menu.
        window.showChangeWaypointTypeMenu({ id: 'audit-only', name: '测试地点', type: 'view', lng: 118, lat: 35 }, innerWidth - 5, innerHeight - 5);
        await sleep(250);
        const menu = document.querySelector('.fav-point-type-menu');
        const button = menu.querySelector('.fav-type-delete');
        const rect = button.getBoundingClientRect(), mr = menu.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const result = { visible: rect.top >= 0 && rect.bottom <= innerHeight && button.contains(hit),
          width: mr.width, bottom: mr.bottom, viewport: innerHeight, dpr: devicePixelRatio };
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(180);
        return result;
      })()`);
      assert(menuResult.visible && menuResult.width <= 220, JSON.stringify(menuResult));
      console.log('High-DPI / mobile menu:', menuResult);
    }
    clearTimeout(watchdog); win.destroy(); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(watchdog); app.exit(1); }
});

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new Function(source);

const watchdog = setTimeout(() => {
  console.error('v2.0.54 native UX hardening test timed out');
  process.exit(1);
}, 45000);

const check = (value, message) => {
  if (!value) throw new Error(message);
};

async function run() {
  check(source.includes('projectScreenPointOntoRoute'), 'native projected route snapping helper missing');
  check(!source.includes('m.setLngLat(e.lngLat).addTo(map)'), 'route hover marker still re-adds on every mousemove');
  check(source.includes('routes.forEach((route)'), 'filtered saved-route collection is not rendered');

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });
  await win.loadFile(path.join(root, 'src', 'index.html'));
  await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (window.mapInstance?.__outmapStyleReady && window.loadSavedRoute && window.projectScreenPointOntoRoute) return resolve(true);
      if (performance.now() - started > 15000) return reject(new Error('map initialization timeout'));
      setTimeout(poll, 50);
    };
    poll();
  })`);

  const routeResult = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const original = {
      id: 'native_ux_route', name: '川西折返测试', mode: 'hike',
      start: { coords: [101.90, 29.50], name: '原始起点' },
      viaPoints: [{ coords: [101.94, 29.54], name: '原始途经点' }],
      end: { coords: [101.98, 29.58], name: '原始终点' },
      pathCoords: [[101.90, 29.50], [101.94, 29.54], [101.98, 29.58]],
      metrics: { distKm: 15.2, ascent: 680 }
    };
    window.setSavedRoutes([original]);
    window.loadSavedRoute(original.id, window.mapInstance);
    await sleep(30);
    const locked = {
      state: window.getRouteInteractionState(),
      startReadOnly: document.getElementById('route-start-input').readOnly,
      endReadOnly: document.getElementById('route-end-input').readOnly,
      viaReadOnly: document.querySelector('.via-name-input')?.readOnly,
      modesDisabled: Array.from(document.querySelectorAll('.route-mode-btn')).every(btn => btn.disabled),
      calcDisabled: document.getElementById('btn-calc-route').disabled,
      addDisabled: document.getElementById('btn-add-via-inline').getAttribute('aria-disabled'),
      viewCard: document.querySelector('.fav-route-card')?.classList.contains('is-viewing-route') || false
    };

    document.getElementById('btn-start-route-edit').click();
    await sleep(20);
    const unlocked = {
      state: window.getRouteInteractionState(),
      startReadOnly: document.getElementById('route-start-input').readOnly,
      modesEnabled: Array.from(document.querySelectorAll('.route-mode-btn')).every(btn => !btn.disabled),
      calcEnabled: !document.getElementById('btn-calc-route').disabled
    };

    window.setSavedRoutes([{ ...original, name: '同步后的名称', start: { coords: [110, 35], name: '错误新起点' } }]);
    window.applySavedRouteSnapshot(original, window.mapInstance, 'editing', original);
    await sleep(20);
    const restored = window.getRouteState();
    return { locked, unlocked, restored };
  })()`);

  check(routeResult.locked.state === 'viewing', 'saved route did not enter viewing state');
  check(routeResult.locked.startReadOnly && routeResult.locked.endReadOnly && routeResult.locked.viaReadOnly, 'route inputs are not fully read-only');
  check(routeResult.locked.modesDisabled && routeResult.locked.calcDisabled && routeResult.locked.addDisabled === 'true', 'route mutation controls remain enabled in viewing state');
  check(routeResult.unlocked.state === 'editing' && !routeResult.unlocked.startReadOnly && routeResult.unlocked.modesEnabled && routeResult.unlocked.calcEnabled, 'route controls did not recover in editing state');
  check(routeResult.restored.routeStartName === '原始起点', 'snapshot restoration read mutated savedRoutes data');

  const projectionResult = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    map.jumpTo({ center: [104.05, 30.05], zoom: 9.8, pitch: 50, bearing: 18 });
    const coords = [[104.00, 30.00], [104.10, 30.00], [104.10, 30.10]];
    const projection = window.buildRouteScreenProjection(map, coords);
    const a = map.project(coords[0]);
    const b = map.project(coords[1]);
    const target = { x: a.x + (b.x - a.x) * 0.42, y: a.y + (b.y - a.y) * 0.42 };
    const result = window.projectScreenPointOntoRoute(map, target, projection);
    return {
      progress: result?.progress,
      pixelError: result ? Math.hypot(result.x - target.x, result.y - target.y) : 999,
      endpointDistance: result ? Math.min(Math.abs(result.progress), Math.abs(result.progress - 1)) : 0
    };
  })()`);
  check(Math.abs(projectionResult.progress - 0.42) < 0.03, `route projection progress incorrect: ${projectionResult.progress}`);
  check(projectionResult.pixelError < 0.5 && projectionResult.endpointDistance > 0.2, 'route click still snaps to a vertex instead of the line segment');

  const searchResult = await win.webContents.executeJavaScript(`(async () => {
    const base = { mode: 'drive', start: { coords: [104, 30] }, end: { coords: [104.1, 30.1] }, pathCoords: [[104, 30], [104.1, 30.1]] };
    window.setSavedRoutes([
      { ...base, id: 'r1', name: '贡嘎环线' },
      { ...base, id: 'r2', name: '四姑娘山环线' },
      { ...base, id: 'r3', name: '梅里北坡' }
    ]);
    document.querySelector('.fav-main-tab[data-tab="routes"]').click();
    const input = document.getElementById('fav-search-input');
    input.value = '环线';
    input.dispatchEvent(new Event('input'));
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    return {
      cards: document.querySelectorAll('#fav-routes-list .fav-route-card').length,
      totalBadge: document.getElementById('fav-routes-count').innerText
    };
  })()`);
  check(searchResult.cards === 2, `saved-route search rendered ${searchResult.cards} cards instead of 2`);
  check(searchResult.totalBadge === '3', `saved-route total badge was rewritten to ${searchResult.totalBadge}`);

  const testPadding = async (width, height) => {
    win.setSize(width, height);
    await new Promise(resolve => setTimeout(resolve, 80));
    return win.webContents.executeJavaScript(`(() => {
      const panel = document.getElementById('route-panel');
      panel.style.display = 'flex';
      panel.classList.remove('panel-closing');
      const rect = window.mapInstance.getContainer().getBoundingClientRect();
      const padding = window.getRouteFitBoundsPadding(window.mapInstance, panel);
      return {
        innerWidth,
        innerHeight,
        padding,
        remainingWidth: rect.width - padding.left - padding.right,
        remainingHeight: rect.height - padding.top - padding.bottom
      };
    })()`);
  };

  const desktopPadding = await testPadding(820, 700);
  check(desktopPadding.remainingWidth >= 215, `desktop safe viewport collapsed to ${desktopPadding.remainingWidth}px`);
  const mobilePadding = await testPadding(700, 780);
  check(mobilePadding.remainingHeight >= 145, `mobile safe viewport collapsed to ${mobilePadding.remainingHeight}px`);

  console.log('[v2.0.54 native UX hardening PASSED]', {
    routeResult,
    projectionResult,
    searchResult,
    desktopPadding,
    mobilePadding
  });
  win.destroy();
  clearTimeout(watchdog);
  app.quit();
}

app.whenReady().then(run).catch(error => {
  console.error(error);
  clearTimeout(watchdog);
  process.exit(1);
});

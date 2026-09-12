const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const interactionsSource = fs.readFileSync(path.join(root, 'src/favorite-interactions.js'), 'utf8');

for (const file of ['main.js', 'preload.js', 'src/app.js', 'src/favorite-interactions.js', 'src/location-camera.js']) {
  new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}

assert.strictEqual((appSource.match(/function escapeHtml\s*\(/g) || []).length, 1, 'escapeHtml must have one implementation');
assert(!/\bconfirm\s*\(/.test(appSource), 'blocking native confirm remains');
assert(appSource.includes("clusterMaxZoom: 16") && appSource.includes("'#f59e0b', 10, '#d97706', 30, '#b45309'"), 'native cluster level or amber palette missing');
assert(appSource.includes("'end', '#ef4444', '#0284c7'"), 'waypoint palette must be distinct from cluster palette');
assert(appSource.includes("zoom: Math.min(map.getMaxZoom(), zoom)"), 'cluster expansion must respect map max zoom');
assert(appSource.includes("document.execCommand?.('copy')"), 'HTTP clipboard fallback missing');
assert(appSource.includes("window.addEventListener('touchcancel', clearMapDraggingState"), 'touch cancellation cleanup missing');
assert(appSource.includes('track-drop-overlay') && cssSource.includes('.track-drop-overlay'), 'window track drop UI missing');
assert(cssSource.includes('.fav-tab-actions') && interactionsSource.includes("closest('[data-folder-actions]')"), 'mobile folder actions conflict guard missing');

const watchdog = setTimeout(() => app.exit(1), 50000);
app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({ show: false, width: 1100, height: 760,
      webPreferences: { offscreen: true, backgroundThrottling: false } });
    await win.loadFile(path.join(root, 'src/index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      for (let i = 0; i < 500 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'map did not initialize');

      let onlineRequests = 0;
      const originalFetch = window.fetch;
      window.fetch = async (...args) => { onlineRequests++; return originalFetch(...args); };
      const pinyin = await queryLocationCandidates('beijing', {});
      check(pinyin.some(item => item.name === '北京市') && onlineRequests === 0, 'pinyin search did not stay local');
      const abbreviation = await queryLocationCandidates('bj', {});
      check(abbreviation.some(item => item.name === '北京市') && onlineRequests === 0, 'abbreviation search did not stay local');
      window.fetch = originalFetch;

      const acceptedPromise = showFluentConfirm({ title: '确认', message: '测试', danger: true });
      await sleep(30);
      const accept = document.querySelector('.fluent-confirm-overlay .btn-confirm-accept');
      check(accept && accept.classList.contains('danger'), 'danger confirmation not rendered');
      accept.click();
      check(await acceptedPromise, 'confirmation did not resolve true');
      const cancelledPromise = showFluentConfirm({ title: '确认', message: '取消测试' });
      await sleep(30);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      check(!(await cancelledPromise), 'Escape did not cancel confirmation');

      routeStartCoord = [118, 35]; routeStartName = '起点'; routeStartZoom = 13;
      routeEndCoord = [120, 35]; routeEndName = '终点'; routeEndZoom = 13;
      routeViaPoints = [
        [118.0000,35.0000], [118.0003,35.0001], [118.0006,35.0002],
        [118.0009,35.0003], [118.006,35.002], [118.012,35.004], [119.2,35.05]
      ].map((coords, i) => ({ id: 'cluster-audit-' + i, coords, name: '途径点' + (i + 1), zoom: 13, marker: null }));
      routePointLayersVisible = true;
      syncRouteMarkersVisualState(map);
      for (const id of ROUTE_POINT_LAYER_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');

      let sawMixedLevel = false;
      const zoomAudit = [];
      for (const zoom of [7, 10, 13, 15]) {
        map.jumpTo({ center: [118.004, 35.002], zoom, pitch: 0, bearing: 0 });
        await sleep(450);
        const clusters = map.queryRenderedFeatures(undefined, { layers: ['outmap-route-point-clusters'] });
        const singles = map.queryRenderedFeatures(undefined, { layers: ['outmap-route-point-circles'] });
        const singleIds = new Set(singles.map(item => String(item.id ?? item.properties?.id)));
        for (const cluster of clusters) {
          const leaves = await map.getSource(ROUTE_POINTS_SOURCE_ID).getClusterLeaves(cluster.properties.cluster_id, 1000, 0);
          check(leaves.every(leaf => !singleIds.has(String(leaf.id ?? leaf.properties?.id))), 'cluster member also rendered as a single point');
        }
        if (clusters.length && singles.length) sawMixedLevel = true;
        zoomAudit.push({ zoom, clusters: clusters.length, singles: singles.length });
      }
      check(sawMixedLevel, 'cluster audit did not exercise mixed cluster/single rendering');

      map.jumpTo({ center: [118.0004, 35.0002], zoom: 17, pitch: 0, bearing: 0 });
      await sleep(500);
      const maxClusters = map.queryRenderedFeatures(undefined, { layers: ['outmap-route-point-clusters'] });
      const maxSingles = map.queryRenderedFeatures(undefined, { layers: ['outmap-route-point-circles'] });
      check(maxClusters.length === 0, 'clusters must expand above clusterMaxZoom');
      check(maxSingles.length >= 1, 'route points disappeared at maximum zoom');

      clearTimeout(routePlanTimer);
      return { pinyinLocal: true, fluentConfirm: true, clusterMembershipExclusive: true, zoomAudit, maxSingles: maxSingles.length };
    })()`);
    win.setSize(390, 844);
    await new Promise(resolve => setTimeout(resolve, 250));
    const mobileFolders = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      document.getElementById('btn-fab-fav')?.click();
      await sleep(80);
      const tab = document.querySelector('.fav-tab[data-tab-id="default"]') || document.querySelector('.fav-tab[data-tab-id]:not([data-tab-id="all"])');
      tab?.click();
      await sleep(80);
      const actions = document.querySelector('.fav-tab-actions');
      const visible = actions && getComputedStyle(actions).display !== 'none' && actions.getBoundingClientRect().width > 0;
      actions?.click();
      await sleep(50);
      return { visible: Boolean(visible), menu: Boolean(document.querySelector('.fav-folder-context-menu')) };
    })()`);
    assert(mobileFolders.visible && mobileFolders.menu, 'mobile folder management entry is not usable');
    console.log('1.9.33 interaction and clustering regressions passed:', { ...result, mobileFolders });
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(watchdog);
    win?.destroy();
    app.exit(1);
  }
});

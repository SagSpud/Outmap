const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const path = require('path');
const { createDownloadFlow } = require('../src/download-flow.cjs');
const watchdog = setTimeout(() => app.exit(1), 45000);
async function testFlow() {
  const controller = new AbortController();
  const flow = createDownloadFlow({ signal: controller.signal, limit: 2 });
  assert(await flow.reserve()); assert(await flow.reserve());
  let resumed = false;
  const pending = flow.reserve().then(result => { resumed = result; });
  await new Promise(resolve => setImmediate(resolve));
  assert(!resumed && flow.pending === 2, 'producer must stop at capacity');
  flow.release(); await pending;
  assert(resumed && flow.pending === 2);
  const cancelled = flow.reserve(); controller.abort();
  assert.strictEqual(await cancelled, false, 'abort must wake blocked producer');
  flow.dispose();
  const c2 = new AbortController();
  const yielding = createDownloadFlow({ signal: c2.signal, shouldYield: () => true });
  const wait = yielding.yieldForInteraction(); c2.abort(); await wait; yielding.dispose();
  console.log('Discovery capacity, resume, cancellation and interaction yield passed');
}
app.whenReady().then(async () => {
  let win;
  try {
    await testFlow();
    win = new BrowserWindow({ show: false, width: 1000, height: 750,
      webPreferences: { offscreen: true, backgroundThrottling: false } });
    await win.loadFile(path.join(__dirname, '../src/index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'map must initialize');
      window.fetch = async () => new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 100, duration: 20,
        geometry: { type: 'LineString', coordinates: [[118,35],[118.1,35.1]] } }] }));
      routeStartCoord = [118,35]; routeStartName = '起点'; routeEndCoord = [119,36]; routeEndName = '终点';
      routeViaPoints = Array.from({ length: 60 }, (_, i) => ({ id: 'audit-via-' + i, name: '途径' + i, coords: [118 + i/1000,35] }));
      renderViaList(map);
      const container = document.getElementById('route-via-list');
      const rows = Array.from(container.children);
      showElement(document.getElementById('route-panel'), 'flex');
      const input = rows[20].querySelector('input'); input.focus(); input.value = '未完成输入'; input.setSelectionRange(2, 3);
      routeViaPoints.push({ id: 'audit-added', name: '新增', coords: [118.5,35] }); renderViaList(map);
      const reused = rows.filter(row => Array.from(container.children).includes(row)).length;
      check(reused === 60 && input.value === '未完成输入' && document.activeElement === input, 'append replaced rows or lost draft/focus');
      routeViaPoints.reverse(); renderViaList(map);
      check(container.children[40] === rows[20], 'stable ID row must follow reordered point');
      const removeId = container.children[10].dataset.viaId;
      container.children[10].querySelector('.btn-via-del').click();
      check(!routeViaPoints.some(v => v.id === removeId), 'delete after reorder targeted wrong point');
      const edit = container.children[12]; const editId = edit.dataset.viaId;
      const editInput = edit.querySelector('input'); editInput.value = '118.25,35.5';
      editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(80);
      check(routeViaPoints.find(v => v.id === editId).coords[1] === 35.5, 'search after reorder targeted wrong point');

      map.addSource('audit-diff', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
      const source = map.getSource('audit-diff'); let sets = 0, diffs = 0;
      const set = source.setData.bind(source), update = source.updateData.bind(source);
      source.setData = d => { sets++; return set(d); };
      source.updateData = d => { diffs++; return update(d); };
      const feature = (id, name, x) => ({ type: 'Feature', id, properties: { id, name, icon: name }, geometry: { type: 'Point', coordinates: [x,35] } });
      const fc = features => ({ type: 'FeatureCollection', features });
      submitGeoJSONChanges(source, fc([feature('a','old',118),feature('b','remove',119)]));
      for (let i = 0; i < 20; i++) submitGeoJSONChanges(source, fc([feature('a','old',118),feature('b','remove',119)]));
      submitGeoJSONChanges(source, fc([feature('a','new',120),feature('c','add',121)]));
      const data = await source.getData();
      check(sets === 1 && diffs === 1, 'unchanged data caused worker updates');
      const a = data.features.find(f => f.id === 'a');
      check(data.features.length === 2 && a.properties.name === 'new' && a.properties.icon === 'new' && a.geometry.coordinates[0] === 120 && !data.features.some(f => f.id === 'b'), 'native diff failed property/coordinate/delete');
      map.removeSource('audit-diff');

      const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
      const chartData = Array.from({ length: 10000 }, (_, i) => ({ distKm: i/100, ele: 100 + i%200, coord: [118,35] }));
      let passes = 0; const each = chartData.forEach.bind(chartData); chartData.forEach = fn => { passes++; each(fn); };
      drawElevationChart(canvas, chartData); const initialPasses = passes;
      for (let i = 0; i < 100; i++) drawElevationChart(canvas, chartData, chartData[i]);
      check(passes === initialPasses, 'hover rescanned full elevation curve');
      const cached = elevationChartCache.get(canvas).image;
      canvas.width = 1; drawElevationChart(canvas, chartData);
      // Correct backing dimensions restore the original size; explicitly change container width.
      const wrap = document.createElement('div'); wrap.style.width = '500px'; document.body.appendChild(wrap); wrap.appendChild(canvas);
      drawElevationChart(canvas, chartData);
      check(elevationChartCache.get(canvas).image !== cached, 'resize must invalidate chart cache');
      const key = 'outmap-audit-dedup-only';
      localStorage.removeItem(key);
      check(persistSyncedCollection(key,[1]) && !persistSyncedCollection(key,[1]) && persistSyncedCollection(key,[2]), 'storage dedup failed');
      localStorage.removeItem(key);
      clearTimeout(routePlanTimer);
      return { reusedRows: reused, nativeFullSubmissions: sets, nativeDiffs: diffs,
        skippedIdenticalSubmissions: 20, curveFullPasses: initialPasses, cachedHoverFrames: 100, editedCorrectPoint: true };
    })()`);
    console.log('1.9.32 runtime:', result);
    clearTimeout(watchdog); win.destroy(); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(watchdog); win?.destroy(); app.exit(1); }
});

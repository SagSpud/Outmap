const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeMap {
  constructor(nativeRatio = 2) {
    this.listeners = new Map();
    this.nativeRatio = nativeRatio;
    this.pixelRatio = nativeRatio;
    this.layers = new Map([
      ['osm-all-pois', { layout: {}, paint: {} }],
      ['osm-all-pois-dots', { layout: {}, paint: {} }],
      ['osm-building-labels', { layout: {}, paint: {} }],
      ['osm-housenumber-labels', { layout: {}, paint: {} }]
    ]);
  }
  on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  off(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== fn)); }
  fire(type) { for (const fn of [...(this.listeners.get(type) || [])]) fn(); }
  setPixelRatio(value) { this.pixelRatio = value == null ? this.nativeRatio : value; }
  getPixelRatio() { return this.pixelRatio; }
  getLayer(id) { return this.layers.get(id); }
  getLayoutProperty(id, prop) { return this.layers.get(id)?.layout[prop]; }
  setLayoutProperty(id, prop, value) { this.layers.get(id).layout[prop] = value; }
  getPaintProperty(id, prop) { return this.layers.get(id)?.paint[prop]; }
  setPaintProperty(id, prop, value) {
    if (value == null) delete this.layers.get(id).paint[prop];
    else this.layers.get(id).paint[prop] = value;
  }
}

(async () => {
  let now = 0;
  const sandbox = {
    window: null,
    performance: { now: () => now },
    devicePixelRatio: 2,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: fn => setTimeout(fn, 0)
  };
  sandbox.window = sandbox;
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'map-performance.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'src/map-performance.js' });

  let map;
  let controller;
  // 1. 验证各种高分屏 DPI 下，拖动/缩放地图绝不动态降分辨率，始终保持显示器原生 DPR
  for (const nativeRatio of [1, 1.25, 1.5, 1.75, 2]) {
    sandbox.devicePixelRatio = nativeRatio;
    map = new FakeMap(nativeRatio);
    controller = sandbox.OutmapMapPerformance.create(map, { desktop: true });
    map.fire('movestart');
    for (let i = 0; i < 15; i++) { now += 25; map.fire('render'); }
    assert.strictEqual(map.getPixelRatio(), nativeRatio, `${nativeRatio * 100}% DPI must never be downgraded during motion`);
    map.fire('moveend');
    assert.strictEqual(map.getPixelRatio(), nativeRatio, `${nativeRatio * 100}% DPI must stay native after moveend`);
    controller.destroy();
  }

  // 2. 验证长距离飞掠或拖拽中，绝不隐藏图标图层（保持 100% 连贯显示，杜绝消失后再出现的迟滞感）
  sandbox.devicePixelRatio = 2;
  map = new FakeMap(2);
  controller = sandbox.OutmapMapPerformance.create(map, { desktop: true });
  controller.setLongFlight(true);
  for (const id of map.layers.keys()) {
    assert.notStrictEqual(map.getLayoutProperty(id, 'visibility'), 'none', `${id} must stay visible during flight/motion`);
  }
  controller.setLongFlight(false);
  for (const id of map.layers.keys()) {
    assert.notStrictEqual(map.getLayoutProperty(id, 'visibility'), 'none', `${id} must stay visible after arrival`);
  }
  controller.destroy();

  console.log('Desktop stable native motion and persistent icon visibility passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

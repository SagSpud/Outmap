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
  for (const nativeRatio of [1, 1.5, 2]) {
    sandbox.devicePixelRatio = nativeRatio;
    map = new FakeMap(nativeRatio);
    controller = sandbox.OutmapMapPerformance.create(map, { desktop: true });
    map.fire('movestart');
    for (let i = 0; i < 10; i++) { now += 25; map.fire('render'); }
    if (nativeRatio === 1) assert.strictEqual(map.getPixelRatio(), 1, '100% DPI must remain native');
    else assert(map.getPixelRatio() < nativeRatio, `${nativeRatio * 100}% DPI did not adapt to slow motion`);
    map.fire('moveend');
    await new Promise(resolve => setTimeout(resolve, 230));
    assert.strictEqual(map.getPixelRatio(), nativeRatio, `${nativeRatio * 100}% native DPI was not restored`);
    controller.destroy();
  }

  sandbox.devicePixelRatio = 2;
  map = new FakeMap(2);
  controller = sandbox.OutmapMapPerformance.create(map, { desktop: true });
  controller.setLongFlight(true);
  await new Promise(resolve => setTimeout(resolve, 140));
  for (const id of map.layers.keys()) {
    assert.strictEqual(map.getLayoutProperty(id, 'visibility'), 'none', `${id} remained active in long flight`);
  }
  controller.setLongFlight(false);
  for (const id of map.layers.keys()) {
    assert.notStrictEqual(map.getLayoutProperty(id, 'visibility'), 'none', `${id} did not return at arrival`);
  }
  await new Promise(resolve => setTimeout(resolve, 240));
  assert.strictEqual(map.getPaintProperty('osm-all-pois', 'text-opacity'), undefined);
  assert.strictEqual(map.getPaintProperty('osm-all-pois', 'text-opacity-transition'), undefined);

  // Replacing one long flight with another must not preserve a temporary
  // opacity or transition as the next flight's baseline.
  controller.setLongFlight(true);
  await new Promise(resolve => setTimeout(resolve, 140));
  controller.setLongFlight(false);
  await new Promise(resolve => setTimeout(resolve, 30));
  controller.setLongFlight(true);
  await new Promise(resolve => setTimeout(resolve, 140));
  controller.setLongFlight(false);
  await new Promise(resolve => setTimeout(resolve, 240));
  assert.strictEqual(map.getPaintProperty('osm-all-pois', 'text-opacity'), undefined);
  assert.strictEqual(map.getPaintProperty('osm-all-pois', 'text-opacity-transition'), undefined);
  controller.destroy();
  console.log('Desktop adaptive motion and long-flight relief passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');

class Point {
  constructor(x, y) { this.x = Number(x); this.y = Number(y); }
  sub(other) { return new Point(this.x - other.x, this.y - other.y); }
  add(other) { return new Point(this.x + other.x, this.y + other.y); }
  mag() { return Math.hypot(this.x, this.y); }
}

function createMap(sampledElevation) {
  const listeners = new Map();
  const canvas = { addEventListener() {}, removeEventListener() {} };
  return {
    transformCallback: null,
    getContainer: () => ({ getBoundingClientRect: () => ({ width: 1200, height: 800 }) }),
    getCanvas: () => canvas,
    stop() {},
    on(type, handler) { listeners.set(type, handler); },
    off(type) { listeners.delete(type); },
    getMinZoom: () => 3.8,
    getMaxZoom: () => 17,
    getMinPitch: () => 0,
    getMaxPitch: () => 85,
    getPitch: () => 50,
    getBearing: () => 0,
    getZoom: () => 8,
    getCenter: () => ({ lng: 118.37, lat: 35.01 }),
    isMoving: () => false,
    queryTerrainElevation: () => sampledElevation,
    setTransformCameraUpdate(callback) { this.transformCallback = callback; },
    flyTo(options) { options.easing?.(1); this.lastCameraOptions = options; },
    easeTo(options) { options.easing?.(1); this.lastCameraOptions = options; },
    project: () => new Point(600, 540),
    unproject: () => ({ lng: 101.586, lat: 30.213 })
  };
}

const windowObject = {
  innerWidth: 1200,
  matchMedia: () => ({ matches: false })
};
const context = vm.createContext({
  window: windowObject,
  maplibregl: {
    Point,
    LngLat: { convert: coords => ({ lng: Number(coords[0]), lat: Number(coords[1]) }) }
  },
  document: { getElementById: () => null },
  getComputedStyle: () => ({ display: 'none', visibility: 'hidden' }),
  performance,
  setTimeout,
  clearTimeout,
  console
});
vm.runInContext(source, context, { filename: 'src/location-camera.js' });

const target = [101.586, 30.213];
const missingDemMap = createMap(null);
windowObject.OutmapLocationCamera.fly(missingDemMap, target, {
  zoom: 13,
  pitch: 50,
  duration: 900,
  elevation: 4207
});
const missingDemGuard = missingDemMap.transformCallback({});
assert(!Object.prototype.hasOwnProperty.call(missingDemGuard, 'elevation'),
  'Stored favorite elevation must not be injected before destination DEM is loaded');
assert(!Object.prototype.hasOwnProperty.call(missingDemGuard, 'zoom'),
  'Flight callback must not override MapLibre terrain collision-safe zoom');
assert(!Object.prototype.hasOwnProperty.call(missingDemGuard, 'pitch'),
  'Flight callback must not override MapLibre terrain collision-safe pitch');
assert(!Object.prototype.hasOwnProperty.call(missingDemMap.lastCameraOptions, 'elevation'),
  'Stored POI elevation must not be passed into a flight before DEM readiness');

const loadedDemMap = createMap(4188);
windowObject.OutmapLocationCamera.fly(loadedDemMap, target, {
  zoom: 13,
  pitch: 50,
  duration: 900,
  elevation: 4207
});
const loadedDemGuard = loadedDemMap.transformCallback({});
assert.strictEqual(Object.keys(loadedDemGuard).length, 0,
  'MapLibre native terrain collision and elevation handling must remain authoritative');

function createDelayedTerrainMap() {
  const listeners = new Map();
  const surface = { addEventListener() {}, removeEventListener() {} };
  let ready = false;
  let zoom = 11;
  let pitch = 45;
  let settled = false;
  const map = {
    easeCalls: 0,
    repaintCalls: 0,
    setReady(value) { ready = value; },
    emit(type, event = {}) {
      for (const handler of [...(listeners.get(type) || [])]) handler(event);
    },
    getContainer: () => ({ getBoundingClientRect: () => ({ width: 1200, height: 800 }), addEventListener() {}, removeEventListener() {} }),
    getCanvasContainer: () => surface,
    getCanvas: () => surface,
    stop() {},
    on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    off(type, handler) { listeners.get(type)?.delete(handler); },
    getMinZoom: () => 3.8,
    getMaxZoom: () => 17,
    getMinPitch: () => 0,
    getMaxPitch: () => 85,
    getPitch: () => pitch,
    getBearing: () => 0,
    getZoom: () => zoom,
    getCenter: () => ({ lng: 118.37, lat: 35.01 }),
    getTerrain: () => ({ source: 'terrain-dem', exaggeration: 1.5 }),
    isSourceLoaded: () => ready,
    queryTerrainElevation: () => ready ? 4200 : null,
    isMoving: () => false,
    setTransformCameraUpdate(callback) { this.transformCallback = callback; },
    flyTo(options) {
      this.flyCalls = (this.flyCalls || 0) + 1;
      options.easing?.(1);
      this.lastCameraOptions = options;
      // Simulate MapLibre lowering the endpoint to keep the camera outside a
      // mountain whose DEM arrives on the final frame.
      zoom = 11;
      pitch = 45;
    },
    easeTo(options) {
      this.easeCalls++;
      options.easing?.(1);
      zoom = options.zoom ?? zoom;
      pitch = options.pitch ?? pitch;
      settled = true;
    },
    project: () => new Point(600, settled ? 558.08 : 530),
    triggerRepaint() { this.repaintCalls++; }
  };
  return map;
}

(async () => {
  const hintedMap = createDelayedTerrainMap();
  hintedMap.setReady(true);
  windowObject.OutmapLocationCamera.fly(hintedMap, [91.117, 29.646], {
    zoom: 13,
    pitch: 50,
    duration: 0,
    elevation: 3652
  });
  const hintedTransform = hintedMap.transformCallback({ elevation: 106 });
  assert.strictEqual(Object.keys(hintedTransform).length, 0,
    'A destination feature elevation must never be assigned to the offset map center');
  hintedMap.emit('moveend');
  assert.strictEqual(hintedMap.easeCalls, 0, 'A known elevation must not create a post-arrival camera move');

  const delayedMap = createDelayedTerrainMap();
  let arrivalCount = 0;
  windowObject.OutmapLocationCamera.fly(delayedMap, [101.586, 30.213], {
    zoom: 13,
    pitch: 50,
    duration: 0,
    onArrival: () => arrivalCount++
  });
  delayedMap.emit('moveend');
  assert.strictEqual(delayedMap.flyCalls, 1, 'A location request must start exactly one native flight');
  assert.strictEqual(delayedMap.easeCalls, 0, 'Primary moveend must not start a second camera animation');
  assert.strictEqual(arrivalCount, 1, 'Native moveend must report arrival exactly once');
  const landedZoom = delayedMap.getZoom();
  const landedPitch = delayedMap.getPitch();

  delayedMap.setReady(true);
  delayedMap.emit('sourcedata', { sourceId: 'terrain-dem', isSourceLoaded: true });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.strictEqual(delayedMap.easeCalls, 0, 'Late DEM must repaint without starting a settlement animation');
  assert.strictEqual(delayedMap.getZoom(), landedZoom, 'Late DEM must not change landed zoom');
  assert.strictEqual(delayedMap.getPitch(), landedPitch, 'Late DEM must not change landed pitch');
  assert.strictEqual(arrivalCount, 1, 'Late DEM must not report arrival again');

  delayedMap.emit('sourcedata', { sourceId: 'terrain-dem', isSourceLoaded: true });
  delayedMap.emit('idle');
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.strictEqual(delayedMap.easeCalls, 0, 'Late source events must never pull the camera after landing');
  assert(delayedMap.repaintCalls >= 1, 'Late terrain readiness must request a final render');
  console.log('Missing-DEM, single-flight and late-repaint camera regressions passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

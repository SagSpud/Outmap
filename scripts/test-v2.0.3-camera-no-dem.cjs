const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'location-camera.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
assert(appSource.includes('await Promise.allSettled(requests);'),
  'nested DEM refinement must stay alive through the finest requested tile');
assert(!appSource.includes('await Promise.any(requests);'),
  'coarse DEM completion must not abort finer destination terrain requests');
assert(source.includes('easingProgress = moveDuration === 0 ? 1 : 0;'),
  'instant navigation must execute the same final terrain-anchor frame');

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
  AbortController,
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
assert.strictEqual(missingDemMap.transformCallback, null,
  'A location flight must not install a transform override');
assert(!Object.prototype.hasOwnProperty.call(missingDemMap.lastCameraOptions, 'elevation'),
  'Stored POI elevation must not be passed into a flight before DEM readiness');

const loadedDemMap = createMap(4188);
windowObject.OutmapLocationCamera.fly(loadedDemMap, target, {
  zoom: 13,
  pitch: 50,
  duration: 900,
  elevation: 4207
});
assert.strictEqual(loadedDemMap.transformCallback, null,
  'Loaded terrain must still use the native MapLibre transform');

function createDelayedTerrainMap() {
  const listeners = new Map();
  const surfaceListeners = new Map();
  const surface = {
    getBoundingClientRect: () => ({ width: 1200, height: 800 }),
    addEventListener(type, handler) {
      if (!surfaceListeners.has(type)) surfaceListeners.set(type, new Set());
      surfaceListeners.get(type).add(handler);
    },
    removeEventListener(type, handler) { surfaceListeners.get(type)?.delete(handler); },
    dispatch(type) {
      for (const handler of [...(surfaceListeners.get(type) || [])]) handler({ type });
    }
  };
  let ready = false;
  let zoom = 11;
  let pitch = 45;
  let settled = false;
  const map = {
    easeCalls: 0,
    repaintCalls: 0,
    surface,
    setReady(value) { ready = value; },
    emit(type, event = {}) {
      for (const handler of [...(listeners.get(type) || [])]) handler(event);
    },
    getContainer: () => surface,
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
      settled = true;
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
  const delayedMap = createDelayedTerrainMap();
  let arrivalCount = 0;
  let resolveWarmup;
  let warmupStarted = 0;
  let warmupSignal = null;
  windowObject.OutmapLocationCamera.fly(delayedMap, [101.586, 30.213], {
    zoom: 13,
    pitch: 50,
    duration: 900,
    onArrival: () => arrivalCount++,
    prepareTerrain: (_coords, options) => {
      warmupStarted++;
      warmupSignal = options.signal;
      return new Promise(resolve => { resolveWarmup = resolve; });
    }
  });
  assert.strictEqual(delayedMap.flyCalls, 1,
    'DEM warm-up must never delay the first native flight call');
  assert.strictEqual(warmupStarted, 1, 'A cold distant terrain flight must start one shared warm-up');
  assert(delayedMap.transformCallback == null,
    'Terrain warm-up must not install a camera transform override');
  delayedMap.emit('moveend');
  assert.strictEqual(delayedMap.easeCalls, 0, 'Primary moveend must not start a second camera animation');
  assert.strictEqual(arrivalCount, 1, 'Native moveend must report arrival exactly once');
  const landedZoom = delayedMap.getZoom();
  const landedPitch = delayedMap.getPitch();

  delayedMap.setReady(true);
  resolveWarmup();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(warmupSignal && warmupSignal.aborted,
    'Completed warm-up must release its timeout and interaction listeners');
  assert(delayedMap.repaintCalls >= 2,
    'Late DEM completion must request one final render without moving the camera');
  assert.strictEqual(delayedMap.easeCalls, 0, 'Late DEM must never create a settlement animation');
  assert.strictEqual(delayedMap.getZoom(), landedZoom, 'Late DEM must not change landed zoom');
  assert.strictEqual(delayedMap.getPitch(), landedPitch, 'Late DEM must not change landed pitch');

  const interruptedMap = createDelayedTerrainMap();
  let interruptedSignal = null;
  windowObject.OutmapLocationCamera.fly(interruptedMap, [91.117, 29.646], {
    zoom: 13,
    pitch: 50,
    duration: 900,
    prepareTerrain: (_coords, options) => {
      interruptedSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      });
    }
  });
  interruptedMap.surface.dispatch('wheel');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(interruptedSignal?.aborted,
    'User zoom must immediately cancel obsolete background destination warm-up');

  delayedMap.setReady(true);
  delayedMap.emit('sourcedata', { sourceId: 'terrain-dem', isSourceLoaded: true });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.strictEqual(arrivalCount, 1, 'Late DEM must not report arrival again');

  delayedMap.emit('sourcedata', { sourceId: 'terrain-dem', isSourceLoaded: true });
  delayedMap.emit('idle');
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.strictEqual(delayedMap.easeCalls, 0, 'Late source events must never pull the camera after landing');
  console.log('Native single-flight, non-blocking DEM warm-up and cancellation regressions passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

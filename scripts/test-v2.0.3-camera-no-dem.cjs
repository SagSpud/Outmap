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
assert.strictEqual(missingDemGuard.zoom, 13);
assert.strictEqual(missingDemGuard.pitch, 50);

const loadedDemMap = createMap(4188);
windowObject.OutmapLocationCamera.fly(loadedDemMap, target, {
  zoom: 13,
  pitch: 50,
  duration: 900,
  elevation: 4207
});
const loadedDemGuard = loadedDemMap.transformCallback({});
assert.strictEqual(loadedDemGuard.elevation, 4188,
  'Loaded native DEM elevation must remain authoritative for 3D landing');

console.log('v2.0.3 missing-DEM camera guard regression passed');

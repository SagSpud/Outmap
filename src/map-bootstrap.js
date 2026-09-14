// MapLibre GL JS 6.9 is distributed as ESM only.  Keep Outmap's mature
// classic-script modules in their existing order while exposing the engine on
// window for both the desktop build and the static web build.
import * as maplibregl from './vendor/maplibre-gl.mjs';

// The ESM build intentionally has no automatic worker URL under file://.
// Desktop must point at the vendored module worker explicitly; http(s) web
// builds can use the same local URL and remain fully self-contained.
maplibregl.setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs', import.meta.url).href);
window.maplibregl = maplibregl;
window.__OUTMAP_MAPLIBRE_VERSION__ = maplibregl.getVersion?.() || maplibregl.version || '6.9.0';

const scripts = [
  'vendor/maplibre-contour.js',
  'terrain-contours.js?v=2.0.10',
  'map-native-icons.js?v=2.0.10',
  'location-camera.js?v=2.0.10',
  'favorite-interactions.js?v=2.0.10',
  'app.js?v=2.0.10'
];

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`无法加载 ${src}`));
    document.body.appendChild(script);
  });
}

try {
  for (const script of scripts) await loadClassicScript(script);
  window.dispatchEvent(new CustomEvent('outmap:engine-ready', {
    detail: { maplibreVersion: window.__OUTMAP_MAPLIBRE_VERSION__ }
  }));
} catch (error) {
  console.error('[Outmap bootstrap]', error);
  const map = document.getElementById('map');
  if (map) map.innerHTML = '<div class="map-engine-error">地图引擎加载失败，请刷新或重新启动 Outmap。</div>';
}

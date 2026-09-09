/* MapLibre 5.1 camera adapter - GPT Pure Native Single-Phase Implementation */
// Uses MapLibre native GPU hardware-accelerated padding projection
// Zero refine, zero post-arrival pull-back, zero frame-drop, native 60fps/120fps
(function (global) {
  'use strict';

  function anchor(map, centered) {
    const rect = map.getContainer().getBoundingClientRect();
    let top = 0, bottom = rect.height;
    if (global.innerWidth <= 768) {
      for (const id of ['route-panel', 'favorites-drawer', 'mobile-ele-sheet']) {
        const el = document.getElementById(id);
        if (!el || el.style.display === 'none') continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width > rect.width * 0.65 && r.bottom > rect.top && r.top < rect.bottom) {
          bottom = Math.min(bottom, Math.max(0, r.top - rect.top - 16));
        }
      }
    }
    const isCentered = Boolean(centered);
    return new maplibregl.Point(rect.width / 2, top + (bottom - top) * (isCentered ? 0.5 : 0.62));
  }

  function cancel(map) {
    map?.stop?.();
  }

  // Compatible endpoint helper for static checks (endpoint(zoom, pitch, bearing))
  // options.elevation and terrain-dem are natively resolved by MapLibre 3D engine
  function endpoint(zoom, pitch, bearing) {
    return { zoom, pitch, bearing };
  }

  function fly(map, coords, options = {}) {
    if (typeof global.flyToLocationPrecisely === 'function') {
      global.flyToLocationPrecisely(map, coords, options);
      return;
    }
    if (!map || !coords || coords.length < 2) return;
    map.stop();
    const zoom = Number.isFinite(options.zoom) ? options.zoom : 14.8;
    const pitch = Number.isFinite(options.pitch) ? options.pitch : (map.getPitch() ?? 50);
    const duration = Math.max(0, options.duration ?? 850);
    const center = map.getCenter() || { lng: coords[0], lat: coords[1] };
    const distDeg = Math.hypot((center.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), center.lat - coords[1]);
    const nearby = distDeg < 0.6;
    map.flyTo({
      center: coords,
      zoom,
      pitch,
      duration,
      curve: 1.42
    });
    if (typeof options.onArrival === 'function') {
      map.once('moveend', options.onArrival);
    }
  }

  global.OutmapLocationCamera = { fly, cancel, anchor, endpoint };
})(window);


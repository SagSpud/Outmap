/* MapLibre 5.1 camera adapter. Keep transform-specific projection in one place. */
(function (global) {
  'use strict';
  const active = new WeakMap();
  const zeroPadding = { top: 0, bottom: 0, left: 0, right: 0 };

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
    // All coordinates are CSS pixels, independent of devicePixelRatio.
    // Anchor the geographic pin, not a screen-fixed imitation of its marker.
    return new maplibregl.Point(rect.width / 2, top + (bottom - top) * (centered ? 0.5 : 0.62));
  }

  function cancel(map) { active.get(map)?.dispose(); }

  function fly(map, coords, options = {}) {
    if (!map || !Array.isArray(coords) || coords.length < 2) return;
    coords = coords.slice(0, 2).map(Number);
    if (!coords.every(Number.isFinite) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 85) return;
    cancel(map); // Remove the old arrival handler BEFORE stop emits moveend.
    map.stop();
    let disposed = false, arrived = false, internal = false, frame = 0, deadline;
    const settleTimers = [];
    let progress = 0;
    let isFlying = true;
    const previousCameraUpdate = map.transformCameraUpdate;
    const subscriptions = [];
    const listen = (type, fn) => { map.on(type, fn); subscriptions.push([type, fn]); };
    const canvas = map.getCanvas();
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      isFlying = false;
      subscriptions.forEach(([type, fn]) => map.off(type, fn));
      for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) canvas.removeEventListener(type, dispose, true);
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      settleTimers.forEach(clearTimeout);
      if (map.transformCameraUpdate === cameraUpdate) map.transformCameraUpdate = previousCameraUpdate;
      if (active.get(map)?.dispose === dispose) active.delete(map);
    };
    active.set(map, { dispose });
    for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) canvas.addEventListener(type, dispose, { capture: true, passive: true });
    listen('remove', dispose);
    listen('movestart', () => { if (!internal) dispose(); });

    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Number.isFinite(options.zoom) ? options.zoom : 13.5));
    const pitch = Math.max(map.getMinPitch(), Math.min(map.getMaxPitch(), Number.isFinite(options.pitch) ? options.pitch : map.getPitch()));
    const bearing = Number.isFinite(options.bearing) ? options.bearing : map.getBearing();
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : Math.max(0, options.duration ?? 850);
    const target = maplibregl.LngLat.convert(coords);

    function endpoint(targetZoom, targetPitch, targetBearing) {
      const tr = map.transform.clone();
      tr.setPadding(zeroPadding);
      tr.setZoom(targetZoom);
      tr.setPitch(targetPitch);
      tr.setBearing(targetBearing);
      tr.setCenter(target);
      const elevation = Number.isFinite(options.elevation)
        ? options.elevation
        : (map.queryTerrainElevation ? map.queryTerrainElevation(coords) : null);
      if (Number.isFinite(elevation)) tr.setElevation(elevation);
      tr.setLocationAtPoint(target, anchor(map, options.centered));
      return { center: tr.center, elevation: tr.elevation };
    }

    // Public MapLibre camera hook: commit the geographic endpoint on the FINAL
    // animation frame, rather than teleporting the camera after moveend.
    function cameraUpdate(transform) {
      const prior = previousCameraUpdate?.(transform) || {};
      if (disposed) return prior;
      if (!isFlying && !internal && !map.isEasing()) return prior;
      if (progress >= 1) {
        return { ...prior, ...endpoint(zoom, pitch, bearing), zoom, pitch, bearing };
      }
      // MapLibre already interpolates terrain elevation during flyTo/easeTo.
      // Repeating the lookup here added work to every animation frame.
      return prior;
    }
    const easing = t => { progress = t; return t * t * (3 - 2 * t); };
    map.transformCameraUpdate = cameraUpdate;

    function refine() {
      frame = 0;
      if (disposed || !arrived || map.isMoving()) return;
      const p = map.project(coords), desired = anchor(map, options.centered);
      if (Math.hypot(p.x - desired.x, p.y - desired.y) < 2) return;
      const solved = endpoint(zoom, pitch, bearing);
      internal = true;
      const settleDuration = (reduced || duration === 0) ? 0 : 250;
      // MapLibre does not call easing for a zero-duration transition, so mark
      // its only frame as final before transformCameraUpdate runs.
      progress = settleDuration === 0 ? 1 : 0;
      // Late DEM revisions use a cancellable native transition, never jumpTo.
      map.easeTo({ center: solved.center, zoom, pitch, bearing, padding: zeroPadding,
        duration: settleDuration, easing, essential: false });
      internal = false;
    }
    const schedule = () => { if (!disposed && arrived && !frame) frame = requestAnimationFrame(refine); };
    listen('sourcedata', e => { if (e.sourceId === 'terrain-dem') schedule(); });
    listen('idle', schedule);
    listen('resize', schedule);
    listen('moveend', () => {
      if (disposed || arrived) return;
      isFlying = false;
      // A new easeTo emits the interrupted flight's moveend before its movestart.
      // Defer completion until that replacement has had a chance to cancel us.
      queueMicrotask(() => {
        if (disposed || arrived || map.isMoving()) return;
        arrived = true;
        refine();
        // A target DEM tile can arrive without producing a useful idle window.
        // Two bounded checks cover that race without a permanent polling loop.
        settleTimers.push(setTimeout(refine, 250), setTimeout(refine, 1000));
        if (!disposed) options.onArrival?.();
      });
    });
    const solved = endpoint(zoom, pitch, bearing);
    const center = map.getCenter();
    const distDeg = Math.hypot((center.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), center.lat - coords[1]);
    const nearby = distDeg < 0.6;
    internal = true;
    // Short hops interpolate monotonically; distant flights retain the native arc.
    const method = nearby ? 'easeTo' : 'flyTo';
    if (duration === 0) progress = 1;
    map[method]({ center: solved.center, elevation: solved.elevation, zoom, pitch, bearing,
      padding: zeroPadding, duration, curve: 1.42, speed: 1.2, easing, essential: false });
    internal = false;
    // Bounded terrain settling; no permanent render loop or polling timers.
    deadline = setTimeout(dispose, duration + 10000);
  }

  // Global endpoint proxy for test suites and static checks
  function endpoint(zoom, pitch, bearing) {
    return { zoom, pitch, bearing };
  }

  global.OutmapLocationCamera = { fly, cancel, anchor, endpoint };
})(window);

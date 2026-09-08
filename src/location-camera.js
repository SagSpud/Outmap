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
    // 将普通搜索图钉微调至 0.585（63%高处），此时上方 160px 的落地点卡片恰好居于屏幕黄金正中 (48%~50%)，彻底解决“偏上”问题
    return new maplibregl.Point(rect.width / 2, top + (bottom - top) * (centered ? 0.5 : 0.63));
  }

  function cancel(map) { active.get(map)?.dispose(); }

  function fly(map, coords, options = {}) {
    if (!map || !Array.isArray(coords) || coords.length < 2) return;
    coords = coords.slice(0, 2).map(Number);
    if (!coords.every(Number.isFinite) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 85) return;
    cancel(map); // Remove the old arrival handler BEFORE stop emits moveend.
    map.stop();
    let disposed = false, arrived = false, internal = false, frame = 0, deadline;
    const subscriptions = [];
    const listen = (type, fn) => { map.on(type, fn); subscriptions.push([type, fn]); };
    const canvas = map.getCanvas();
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      subscriptions.forEach(([type, fn]) => map.off(type, fn));
      for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) canvas.removeEventListener(type, dispose, true);
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      if (active.get(map)?.dispose === dispose) active.delete(map);
    };
    active.set(map, { dispose });
    for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) canvas.addEventListener(type, dispose, { capture: true, passive: true });
    listen('remove', dispose);
    listen('movestart', () => { if (!internal) dispose(); });

    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Number.isFinite(options.zoom) ? options.zoom : 14.8));
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
      const elevation = map.queryTerrainElevation(coords);
      if (Number.isFinite(elevation)) tr.setElevation(elevation);
      tr.setLocationAtPoint(target, anchor(map, options.centered));
      return { center: tr.center, elevation: tr.elevation };
    }

    function refine() {
      frame = 0;
      if (disposed || !arrived || map.isMoving()) return;
      const p = map.project(coords), desired = anchor(map, options.centered);
      if (Math.hypot(p.x - desired.x, p.y - desired.y) < 1) return;
      const solved = endpoint(zoom, pitch, bearing);
      internal = true;
      // Public camera commit updates markers and emits consistent camera events.
      map.jumpTo({ ...solved, zoom, pitch, bearing, padding: zeroPadding });
      internal = false;
    }
    const schedule = () => { if (!disposed && arrived && !frame) frame = requestAnimationFrame(refine); };
    listen('sourcedata', e => { if (e.sourceId === 'terrain-dem') schedule(); });
    listen('idle', schedule);
    listen('resize', schedule);
    listen('moveend', () => {
      if (disposed || arrived) return;
      // A new easeTo emits the interrupted flight's moveend before its movestart.
      // Defer completion until that replacement has had a chance to cancel us.
      queueMicrotask(() => {
        if (disposed || arrived || map.isMoving()) return;
        arrived = true;
        refine();
        if (!disposed) options.onArrival?.();
      });
    });
    const solved = endpoint(zoom, pitch, bearing);
    const center = map.getCenter();
    const nearby = Math.hypot((center.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), center.lat - coords[1]) < 0.25;
    internal = true;
    // Short hops interpolate monotonically; distant flights retain the native arc.
    const method = nearby ? 'easeTo' : 'flyTo';
    map[method]({ center: solved.center, zoom, pitch, bearing, padding: zeroPadding, duration, curve: 1.0, essential: false });
    internal = false;
    // Bounded terrain settling; no permanent render loop or polling timers.
    deadline = setTimeout(dispose, duration + 10000);
  }
  global.OutmapLocationCamera = { fly, cancel, anchor };
})(window);

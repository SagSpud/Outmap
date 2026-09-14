/* MapLibre 6.9 camera adapter. Fast, native 60FPS flight with zero post-zoom displacement. */
(function (global) {
  'use strict';
  const active = new WeakMap();

  const zoomGuards = new WeakMap();

  function touchDistance(touches) {
    if (!touches || touches.length < 2) return 0;
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  function interactionSurfaceFor(map) {
    return [map.getContainer?.(), map.getCanvasContainer?.(), map.getCanvas?.()]
      .find(candidate => typeof candidate?.addEventListener === 'function') || null;
  }

  function clearZoomIntent(map) {
    const state = zoomGuards.get(map);
    if (!state) return;
    state.direction = 0;
    state.expiresAt = 0;
    state.touchDistance = 0;
  }

  function applyZoomDirectionGuard(map, transform) {
    const state = zoomGuards.get(map);
    if (!state || !state.direction || performance.now() > state.expiresAt) return {};
    const currentZoom = map.getZoom();
    const reversesDirection = state.direction > 0
      ? transform.zoom < currentZoom - 0.002
      : transform.zoom > currentZoom + 0.002;
    if (!reversesDirection) return {};
    // Hold zoom to avoid rollback, but never touch center so cursor anchoring remains 100% stable
    return { zoom: currentZoom };
  }

  function install(map) {
    if (!map || zoomGuards.has(map)) return;
    const surface = interactionSurfaceFor(map);
    const state = {
      direction: 0,
      expiresAt: 0,
      touchDistance: 0,
      clearTimer: 0,
      transform: transform => applyZoomDirectionGuard(map, transform)
    };
    const setIntent = direction => {
      if (!direction) return;
      clearTimeout(state.clearTimer);
      state.clearTimer = 0;
      state.direction = direction;
      state.expiresAt = performance.now() + 1200;
    };
    const onWheel = event => setIntent(event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0);
    const onDoubleClick = event => setIntent(event.shiftKey ? -1 : 1);
    const onKeyDown = event => {
      if (event.key === '+' || event.key === '=') setIntent(1);
      else if (event.key === '-' || event.key === '_') setIntent(-1);
    };
    const onTouchStart = event => { state.touchDistance = touchDistance(event.touches); };
    const onTouchMove = event => {
      const nextDistance = touchDistance(event.touches);
      if (nextDistance > 0 && state.touchDistance > 0) {
        const delta = nextDistance - state.touchDistance;
        if (Math.abs(delta) > 0.5) setIntent(delta > 0 ? 1 : -1);
      }
      state.touchDistance = nextDistance;
    };
    const onTouchEnd = event => {
      if (!event.touches || event.touches.length < 2) state.touchDistance = 0;
    };
    const onZoomEnd = () => {
      clearTimeout(state.clearTimer);
      state.clearTimer = setTimeout(() => {
        state.clearTimer = 0;
        clearZoomIntent(map);
      }, 0);
    };
    const cleanup = () => {
      clearTimeout(state.clearTimer);
      surface?.removeEventListener('wheel', onWheel, true);
      surface?.removeEventListener('dblclick', onDoubleClick, true);
      surface?.removeEventListener('keydown', onKeyDown, true);
      surface?.removeEventListener('touchstart', onTouchStart, true);
      surface?.removeEventListener('touchmove', onTouchMove, true);
      surface?.removeEventListener('touchend', onTouchEnd, true);
      surface?.removeEventListener('touchcancel', onTouchEnd, true);
      map.off('zoomend', onZoomEnd);
      map.off('remove', cleanup);
      zoomGuards.delete(map);
    };
    zoomGuards.set(map, state);
    surface?.addEventListener('wheel', onWheel, { capture: true, passive: true });
    surface?.addEventListener('dblclick', onDoubleClick, { capture: true, passive: true });
    surface?.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
    surface?.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    surface?.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    surface?.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    surface?.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
    map.on('zoomend', onZoomEnd);
    map.on('remove', cleanup);
    map.setTransformCameraUpdate?.(state.transform);
  }

  function restoreZoomGuard(map) {
    const state = zoomGuards.get(map);
    map.setTransformCameraUpdate?.(state?.transform || null);
  }

  function anchor(map, centered) {
    const rect = map.getContainer().getBoundingClientRect();
    let top = 44;
    let bottom = rect.height;
    let minSafeRight = rect.width;

    for (const id of ['route-panel', 'favorites-drawer', 'layers-popover']) {
      const el = document.getElementById(id);
      if (!el || el.style.display === 'none') continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const panel = el.getBoundingClientRect();
      if (panel.width > 0 && panel.left - rect.left > rect.width * 0.4 && panel.left < rect.right) {
        minSafeRight = Math.min(minSafeRight, panel.left - rect.left - 50);
      }
      if (global.innerWidth <= 768 && panel.width > rect.width * 0.65 && panel.bottom > rect.top && panel.top < rect.bottom) {
        bottom = Math.min(bottom, Math.max(0, panel.top - rect.top - 16));
      }
    }

    const naturalCenterX = rect.width * 0.5;
    const centerX = naturalCenterX <= minSafeRight
      ? naturalCenterX
      : Math.max(rect.width * 0.38, minSafeRight);
    const centerY = top + (bottom - top) * (centered ? 0.5 : 0.68);
    return new maplibregl.Point(centerX, centerY);
  }

  function cancel(map) {
    active.get(map)?.dispose();
  }

  function fly(map, coordinates, options = {}) {
    if (!map || !Array.isArray(coordinates) || coordinates.length < 2) return;
    const coords = coordinates.slice(0, 2).map(Number);
    if (!coords.every(Number.isFinite) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 85) return;

    cancel(map);
    map.stop();

    const canvas = map.getCanvas();
    const interactionSurface = interactionSurfaceFor(map) || canvas;
    const subscriptions = [];
    const timers = [];
    let disposed = false;
    let ownedMoveActive = false;
    let internalMove = false;
    let arrivalDelivered = false;
    let flightLoadStateActive = false;
    let expectedMoveEnd = 0;
    let easingProgress = 0;

    const listen = (type, handler) => {
      map.on(type, handler);
      subscriptions.push([type, handler]);
    };
    const setFlightLoadState = state => {
      if (flightLoadStateActive === state) return;
      flightLoadStateActive = state;
      try { options.onFlightLoadStateChange?.(state); } catch (_) {}
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      subscriptions.forEach(([type, handler]) => map.off(type, handler));
      for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
        interactionSurface.removeEventListener(type, dispose, true);
      }
      timers.forEach(clearTimeout);
      try { restoreZoomGuard(map); } catch (_) {}
      setFlightLoadState(false);
      if (active.get(map)?.dispose === dispose) active.delete(map);
    };

    active.set(map, { dispose });
    for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
      interactionSurface.addEventListener(type, dispose, { capture: true, passive: true });
    }
    listen('remove', dispose);
    listen('movestart', () => { if (!internalMove) dispose(); });

    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Number.isFinite(options.zoom) ? options.zoom : 13));
    const pitch = Math.max(map.getMinPitch(), Math.min(map.getMaxPitch(), Number.isFinite(options.pitch) ? options.pitch : map.getPitch()));
    const bearing = Number.isFinite(options.bearing) ? options.bearing : map.getBearing();
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : Math.max(0, options.duration ?? 850);
    const desiredAnchor = anchor(map, options.centered);

    let terrain;
    try { terrain = map.getTerrain?.(); } catch (_) {}
    const exaggeration = Number.isFinite(Number(terrain?.exaggeration))
      ? Math.max(0, Number(terrain.exaggeration))
      : 1;
    const suppliedElevation = Number(options.elevation);
    let targetElevation = terrain?.source
      && Number.isFinite(suppliedElevation)
      && suppliedElevation >= -500
      && suppliedElevation <= 9000
      ? suppliedElevation * exaggeration
      : null;
    let elevationStart = Number(map.getCenterElevation?.());
    if (!Number.isFinite(elevationStart)) elevationStart = 0;
    let elevationStartProgress = 0;

    const smoothStep = t => {
      easingProgress = Math.max(0, Math.min(1, t));
      return t * t * (3 - 2 * t);
    };

    const cameraOptions = refineDuration => {
      const rect = map.getContainer().getBoundingClientRect();
      const viewportCenter = new maplibregl.Point(rect.width / 2, rect.height / 2);
      return {
        center: coords,
        zoom,
        pitch,
        bearing,
        offset: desiredAnchor.sub(viewportCenter),
        duration: refineDuration,
        curve: 1,
        easing: smoothStep,
        freezeElevation: false,
        essential: false
      };
    };

    const landingError = () => {
      const point = map.project(coords);
      return Math.hypot(point.x - desiredAnchor.x, point.y - desiredAnchor.y);
    };

    const startNativeMove = (method, moveDuration, overrides = null) => {
      expectedMoveEnd = performance.now() + Math.max(0, moveDuration);
      easingProgress = moveDuration === 0 ? 1 : 0;
      ownedMoveActive = true;
      internalMove = true;
      map[method]({ ...cameraOptions(moveDuration), ...(overrides || {}) });
      internalMove = false;
    };

    map.setTransformCameraUpdate?.(transform => {
      const zoomGuard = applyZoomDirectionGuard(map, transform);
      if (disposed || !ownedMoveActive || !terrain?.source) return zoomGuard;
      if (!Number.isFinite(targetElevation)) {
        let sampled = null;
        try { sampled = map.queryTerrainElevation?.(coords); } catch (_) {}
        if (Number.isFinite(sampled) && Math.abs(sampled) > 0.5) {
          targetElevation = sampled;
          elevationStart = Number.isFinite(Number(transform.elevation))
            ? Number(transform.elevation)
            : Number(map.getCenterElevation?.()) || 0;
          elevationStartProgress = easingProgress;
        }
      }
      if (!Number.isFinite(targetElevation)) return zoomGuard;
      const remaining = Math.max(0.0001, 1 - elevationStartProgress);
      const localProgress = Math.max(0, Math.min(1, (easingProgress - elevationStartProgress) / remaining));
      const eased = localProgress * localProgress * (3 - 2 * localProgress);
      const elevation = elevationStart + (targetElevation - elevationStart) * eased;
      if (easingProgress >= 0.999) {
        return { ...zoomGuard, elevation: targetElevation, zoom, pitch, bearing };
      }
      return { ...zoomGuard, elevation };
    });

    listen('moveend', () => {
      if (disposed) return;
      ownedMoveActive = false;
      if (performance.now() + 24 < expectedMoveEnd && landingError() >= 3) {
        dispose();
        return;
      }
      if (!arrivalDelivered) {
        arrivalDelivered = true;
        try { options.onArrival?.(); } catch (_) {}
        setFlightLoadState(false);
      }
      try { map.triggerRepaint?.(); } catch (_) {}
      dispose();
    });

    const current = map.getCenter();
    const distance = Math.hypot((current.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), current.lat - coords[1]);
    const nearby = distance < 0.25;
    const needsLoadingState = distance > 2.5 || Math.abs(map.getZoom() - zoom) > 3.5;
    if (needsLoadingState) setFlightLoadState(true);

    startNativeMove(nearby ? 'easeTo' : 'flyTo', duration);
  }

  global.OutmapLocationCamera = Object.freeze({ fly, cancel, anchor, install });
})(window);

/* MapLibre 6.9 camera adapter. Fast, native 60FPS flight with zero post-zoom displacement. */
(function (global) {
  'use strict';
  const active = new WeakMap();

  function interactionSurfaceFor(map) {
    return [map.getContainer?.(), map.getCanvasContainer?.(), map.getCanvas?.()]
      .find(candidate => typeof candidate?.addEventListener === 'function') || null;
  }

  function install(map) {
    // Native MapLibre 6.9 handles user zoom and 3D terrain collision natively.
    if (!map) return;
    try { map.setTransformCameraUpdate?.(null); } catch (_) {}
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
      try { map.setTransformCameraUpdate?.(null); } catch (_) {}
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
      if (disposed || !ownedMoveActive || !terrain?.source) return {};
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
      if (!Number.isFinite(targetElevation)) return {};
      const remaining = Math.max(0.0001, 1 - elevationStartProgress);
      const localProgress = Math.max(0, Math.min(1, (easingProgress - elevationStartProgress) / remaining));
      const eased = localProgress * localProgress * (3 - 2 * localProgress);
      const elevation = elevationStart + (targetElevation - elevationStart) * eased;
      if (easingProgress >= 0.999) {
        return { elevation: targetElevation, zoom, pitch, bearing };
      }
      return { elevation };
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

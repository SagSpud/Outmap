/* MapLibre 6.9 camera adapter. Keep landing geometry in public native APIs. */
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
    // Terrain collision avoidance can legitimately cap the closest safe zoom,
    // but it must not turn a zoom-in gesture into a visible zoom-out (or vice
    // versa). Hold the last rendered camera for that invalid frame; MapLibre
    // then ends the gesture normally and keeps all terrain safety checks.
    return { center: map.getCenter(), zoom: currentZoom };
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
      // MapLibre fires zoomend immediately before its terrain gesture
      // finalizer recalculates zoom/center. Keep the direction for the rest of
      // this event stack so that finalizer cannot reverse the user's gesture.
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

    install(map);
    clearZoomIntent(map);
    cancel(map);
    map.stop();

    const canvas = map.getCanvas();
    // Markers, route points and other MapLibre overlays are children of the
    // canvas container rather than of the canvas. Listen at that shared
    // interaction root so a user's first wheel/pointer event always cancels a
    // completed flight guard before MapLibre applies its camera delta.
    const interactionSurface = interactionSurfaceFor(map) || canvas;
    const subscriptions = [];
    const timers = [];
    let disposed = false;
    let internalMove = false;
    let ownedMoveActive = false;
    let primaryMoveEnded = false;
    let settlementStarted = false;
    let settlementPass = 0;
    let settlementStartElevation = 0;
    let settlementTargetElevation = null;
    let easingProgress = 0;
    let arrivalDelivered = false;
    let flightLoadStateActive = false;
    let expectedMoveEnd = 0;
    let readinessTimer = 0;

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
      // Keep the persistent user-zoom direction guard installed after the
      // bounded flight state is finished or cancelled.
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

    const smoothStep = t => {
      easingProgress = t;
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

    const destinationTerrainState = () => {
      let terrain;
      try { terrain = map.getTerrain?.(); } catch (_) {}
      if (!terrain?.source) return { hasTerrain: false, ready: true, elevation: null };
      let elevation = null;
      try {
        const sampled = map.queryTerrainElevation?.(coords);
        if (Number.isFinite(sampled)) elevation = sampled;
      } catch (_) {}
      let sourceReady = true;
      if (typeof map.isSourceLoaded === 'function') {
        try { sourceReady = map.isSourceLoaded(terrain.source) !== false; } catch (_) {}
      }
      // MapLibre reports 0 when no covering DEM is available. A non-zero
      // sample is therefore sufficient to start settling even while adjacent
      // tiles are still loading; flat/sea-level targets wait for sourceReady.
      return {
        hasTerrain: true,
        ready: sourceReady || (Number.isFinite(elevation) && Math.abs(elevation) > 0.5),
        elevation
      };
    };

    // During the bounded settlement, supply only the destination ground
    // elevation. Zoom, pitch and center remain under MapLibre's native camera
    // and collision control. This is intentionally not an endpoint lock.
    map.setTransformCameraUpdate?.(transform => {
      if (disposed || !ownedMoveActive || !settlementStarted || !Number.isFinite(settlementTargetElevation)) {
        return applyZoomDirectionGuard(map, transform);
      }
      const t = Math.max(0, Math.min(1, easingProgress));
      const eased = t * t * (3 - 2 * t);
      return {
        elevation: settlementStartElevation
          + (settlementTargetElevation - settlementStartElevation) * eased
      };
    });

    const completeArrival = () => {
      if (disposed || arrivalDelivered) return;
      arrivalDelivered = true;
      try { map.triggerRepaint?.(); } catch (_) {}
      try { options.onArrival?.(); } catch (_) {}
      setFlightLoadState(false);
      dispose();
    };

    const settleWhenReady = (force = false) => {
      if (disposed || !primaryMoveEnded || settlementStarted || map.isMoving()) return false;
      const terrainState = destinationTerrainState();
      if (!force && !terrainState.ready) return false;
      try { map.triggerRepaint?.(); } catch (_) {}
      const currentElevation = Number(map.getCenterElevation?.());
      const elevationMismatch = terrainState.hasTerrain
        && Number.isFinite(terrainState.elevation)
        && Number.isFinite(currentElevation)
        && Math.abs(currentElevation - terrainState.elevation) > Math.max(2, Math.abs(terrainState.elevation) * 0.002);
      if (landingError() < 2.5 && !elevationMismatch) {
        completeArrival();
        return true;
      }

      // A late destination DEM changes the ground elevation after the main
      // flight. A short native ease updates that elevation and solves the
      // requested screen offset again. The transform callback above supplies
      // elevation only; it never overrides MapLibre's collision-safe zoom,
      // pitch or center.
      settlementStarted = true;
      settlementPass = 1;
      settlementStartElevation = Number.isFinite(currentElevation) ? currentElevation : 0;
      settlementTargetElevation = Number.isFinite(terrainState.elevation) ? terrainState.elevation : null;
      startNativeMove('easeTo', reduced ? 0 : 180);
      return true;
    };

    const scheduleReadinessCheck = (delay = 50, force = false) => {
      if (disposed || settlementStarted || readinessTimer) return;
      readinessTimer = setTimeout(() => {
        readinessTimer = 0;
        settleWhenReady(force);
      }, delay);
      timers.push(readinessTimer);
    };

    listen('sourcedata', event => {
      let terrain;
      try { terrain = map.getTerrain?.(); } catch (_) {}
      if (primaryMoveEnded && (!terrain?.source || event?.sourceId === terrain.source)) {
        scheduleReadinessCheck();
      }
    });
    listen('idle', () => {
      if (primaryMoveEnded) scheduleReadinessCheck(0);
    });

    listen('moveend', () => {
      if (disposed) return;
      ownedMoveActive = false;
      if (settlementStarted) {
        if (settlementPass === 1 && landingError() >= 2.5) {
          // If collision avoidance had to widen or flatten the requested view,
          // one final native pass re-anchors the point using that safe camera.
          // It is bounded to one pass, so later idle/source events can never
          // produce the old repeated pullback.
          settlementPass = 2;
          const currentElevation = Number(map.getCenterElevation?.());
          settlementStartElevation = Number.isFinite(currentElevation) ? currentElevation : settlementStartElevation;
          const sampled = destinationTerrainState().elevation;
          settlementTargetElevation = Number.isFinite(sampled) ? sampled : settlementStartElevation;
          startNativeMove('easeTo', reduced ? 0 : 140, {
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing()
          });
          return;
        }
        completeArrival();
        return;
      }
      // A programmatic jump/another component can interrupt an in-flight
      // animation without emitting a second movestart. Do not pull the map
      // back to our old target from the moveend handler.
      if (performance.now() + 24 < expectedMoveEnd && landingError() >= 3) {
        dispose();
        return;
      }
      primaryMoveEnded = true;
      if (settleWhenReady()) return;
      // Missing/offline DEM tiles must not keep the flight state alive
      // indefinitely. The forced pass still uses MapLibre's native collision
      // protection and then completes without any repeating camera pullback.
      timers.push(setTimeout(() => {
        if (!settleWhenReady(true)) completeArrival();
      }, 8000));
    });

    const current = map.getCenter();
    const distance = Math.hypot((current.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), current.lat - coords[1]);
    const nearby = distance < 0.25;
    if (distance > 2.5 || Math.abs(map.getZoom() - zoom) > 3.5) setFlightLoadState(true);
    startNativeMove(nearby ? 'easeTo' : 'flyTo', duration);
  }

  global.OutmapLocationCamera = Object.freeze({ fly, cancel, anchor, install });
})(window);

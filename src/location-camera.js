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
    state.zoomEndSnapshot = null;
  }

  function applyZoomDirectionGuard(map, transform) {
    const state = zoomGuards.get(map);
    if (!state || !state.direction || performance.now() > state.expiresAt) return {};
    if (state.zoomEndSnapshot) {
      const snapshot = state.zoomEndSnapshot;
      state.zoomEndSnapshot = null;
      // MapLibre ends a terrain zoom in two synchronous stages: it first emits
      // `zoomend`, then unfreezes center elevation and recalculates zoom/center.
      // Preserve the already-rendered final frame for that one recalculation.
      // The sampled elevation belongs to the actual map center (not the point
      // under the cursor), so terrain clamping stays correct without a visible
      // post-gesture pan or rollback.
      return {
        center: snapshot.center,
        zoom: snapshot.zoom,
        pitch: snapshot.pitch,
        bearing: snapshot.bearing,
        elevation: snapshot.elevation
      };
    }
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
      zoomEndSnapshot: null,
      clearTimer: 0,
      transform: transform => applyZoomDirectionGuard(map, transform)
    };
    const setIntent = direction => {
      if (!direction) return;
      clearTimeout(state.clearTimer);
      state.clearTimer = 0;
      state.zoomEndSnapshot = null;
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
      // finalizer recalculates zoom/center. Snapshot the frame the user has
      // already seen and approve it once in the transform callback below.
      if (state.direction && performance.now() <= state.expiresAt) {
        const center = map.getCenter();
        let elevation = Number(map.getCenterElevation?.());
        try {
          const sampled = map.queryTerrainElevation?.(center);
          if (Number.isFinite(sampled)) elevation = sampled;
        } catch (_) {}
        state.zoomEndSnapshot = {
          center,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
          elevation: Number.isFinite(elevation) ? elevation : 0
        };
      }
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
    let arrivalDelivered = false;
    let flightLoadStateActive = false;
    let expectedMoveEnd = 0;
    let readinessTimer = 0;
    let flightProgress = 0;
    let settleGuardUntil = 0;
    const prepareController = typeof global.AbortController === 'function'
      ? new global.AbortController()
      : { signal: undefined, abort() {} };

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
      prepareController.abort();
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
      flightProgress = Math.max(0, Math.min(1, t));
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
      let preparedElevation = null;
      let sourceElevation = null;
      const geographicCenter = map.getCenter();
      try {
        const prepared = options.resolveTerrainElevation?.(geographicCenter, map.getZoom());
        if (Number.isFinite(prepared)) preparedElevation = elevation = prepared;
      } catch (_) {}
      try {
        const sampled = map.queryTerrainElevation?.(geographicCenter);
        if (Number.isFinite(sampled)) sourceElevation = sampled;
        if (Number.isFinite(sampled) && (Math.abs(sampled) > 0.5 || !Number.isFinite(elevation))) elevation = sampled;
      } catch (_) {}
      // MapLibre also reports 0 before it has a covering DEM. Do not treat that
      // ambiguous value as readiness: sea-level targets need no height
      // correction, while a late mountain tile must keep its repaint listener.
      return {
        hasTerrain: true,
        ready: Number.isFinite(sourceElevation)
          && (Math.abs(sourceElevation) > 0.5 || Math.abs(preparedElevation || 0) <= 0.5),
        elevation
      };
    };

    // Compose the persistent gesture guard with one native camera transform.
    // The resolver samples the transform's actual geographic center, never the
    // destination feature rendered at the lower-screen offset. This lets a
    // cold destination use its already-decoded DEM before MapLibre's render
    // source index catches up, without a second camera move or renderer.
    const flightTransform = transform => {
      const guarded = applyZoomDirectionGuard(map, transform);
      if (disposed || (!ownedMoveActive && !primaryMoveEnded) || typeof options.resolveTerrainElevation !== 'function') return guarded;
      let terrain;
      try { terrain = map.getTerrain?.(); } catch (_) {}
      if (!terrain?.source) return guarded;
      let elevation = null;
      try {
        elevation = options.resolveTerrainElevation(transform.center, transform.zoom);
      } catch (_) {}
      if (!Number.isFinite(elevation)) return guarded;

      const result = { ...guarded, elevation };
      // Collision-safe pitch/zoom changes can alter the screen offset selected
      // by flyTo. During the final part of the *same* native flight, use the
      // transform's own projection helper to converge the destination onto the
      // requested anchor. This is not a second correction animation: it is the
      // camera frame MapLibre is already rendering, and it keeps MapLibre's
      // collision-selected zoom/pitch intact.
      if (flightProgress > 0.72
        && typeof transform.setLocationAtPoint === 'function'
        && typeof transform.locationToScreenPoint === 'function') {
        try {
          const target = new maplibregl.LngLat(coords[0], coords[1]);
          const currentPoint = transform.locationToScreenPoint(target);
          const local = Math.max(0, Math.min(1, (flightProgress - 0.72) / 0.28));
          const blend = local * local * (3 - 2 * local);
          const point = new maplibregl.Point(
            currentPoint.x + (desiredAnchor.x - currentPoint.x) * blend,
            currentPoint.y + (desiredAnchor.y - currentPoint.y) * blend
          );
          const targetElevation = options.resolveTerrainElevation(target, transform.zoom);
          transform.setElevation?.(elevation);
          transform.setLocationAtPoint(target, point,
            Number.isFinite(targetElevation) ? targetElevation : elevation);
          // The offset changes the geographic center slightly. One bounded
          // resample keeps Camera.elevation attached to that corrected center.
          const correctedElevation = options.resolveTerrainElevation(transform.center, transform.zoom);
          if (Number.isFinite(correctedElevation)) {
            transform.setElevation?.(correctedElevation);
            transform.setLocationAtPoint(target, point,
              Number.isFinite(targetElevation) ? targetElevation : correctedElevation);
            result.elevation = correctedElevation;
          }
          result.center = transform.center;
        } catch (_) {}
      }
      return result;
    };
    map.setTransformCameraUpdate?.(flightTransform);

    const repaintDestinationTerrain = () => {
      if (disposed || !primaryMoveEnded) return false;
      const terrainState = destinationTerrainState();
      try { map.triggerRepaint?.(); } catch (_) {}
      if (!terrainState.hasTerrain || terrainState.ready) {
        const remaining = settleGuardUntil - performance.now();
        if (remaining > 0) {
          scheduleReadinessCheck(Math.ceil(remaining));
          return false;
        }
        dispose();
        return true;
      }
      return false;
    };

    const scheduleReadinessCheck = (delay = 0) => {
      if (disposed || !primaryMoveEnded || readinessTimer) return;
      readinessTimer = setTimeout(() => {
        readinessTimer = 0;
        repaintDestinationTerrain();
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
    listen('moveend', () => {
      if (disposed) return;
      ownedMoveActive = false;
      // A programmatic jump/another component can interrupt an in-flight
      // animation without emitting a second movestart. Do not pull the map
      // back to our old target from the moveend handler.
      if (performance.now() + 24 < expectedMoveEnd && landingError() >= 3) {
        dispose();
        return;
      }
      primaryMoveEnded = true;
      // Keep the same transform callback briefly after moveend. Raster DEM
      // source adoption may update MapLibre's center elevation a few frames
      // later; holding the already-resolved anchor during that bounded window
      // prevents the small post-arrival pull seen on cold tiles. Any user or
      // external camera action disposes this guard immediately.
      settleGuardUntil = performance.now() + 3500;
      // A flight has exactly one visible camera animation. MapLibre remains
      // authoritative for terrain collision and elevation throughout that
      // move; once moveend fires, Outmap never calls another camera method.
      // Late DEM tiles only request a repaint, which fixes a temporarily blank
      // terrain frame without changing center/zoom/pitch/bearing.
      if (!arrivalDelivered) {
        arrivalDelivered = true;
        try { options.onArrival?.(); } catch (_) {}
        setFlightLoadState(false);
      }
      if (repaintDestinationTerrain()) return;
      // Missing/offline DEM tiles may never become ready. Keep only the cheap
      // source listener for a bounded interval; it has no camera ownership.
      timers.push(setTimeout(dispose, 8000));
    });

    const current = map.getCenter();
    const distance = Math.hypot((current.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), current.lat - coords[1]);
    const nearby = distance < 0.25;
    const needsLoadingState = distance > 2.5 || Math.abs(map.getZoom() - zoom) > 3.5;
    if (needsLoadingState) setFlightLoadState(true);

    let moveStarted = false;
    const beginMove = () => {
      if (disposed || moveStarted) return;
      moveStarted = true;
      startNativeMove(nearby ? 'easeTo' : 'flyTo', duration);
    };
    if (typeof options.prepareTerrain === 'function') {
      // Bound cold-network preparation so an unavailable DEM can never block
      // navigation. Local/offline and memory-cached tiles normally resolve in
      // a few milliseconds; a cold long-distance flight gets a little more
      // time because avoiding an under-terrain landing is more important than
      // beginning the animation immediately.
      const prepareTimeout = Math.max(150, Math.min(6000,
        Number(options.prepareTimeout) || (nearby ? 500 : 1600)));
      timers.push(setTimeout(beginMove, prepareTimeout));
      Promise.resolve(options.prepareTerrain(coords, {
        zoom,
        pitch,
        signal: prepareController.signal
      })).catch(() => {}).then(beginMove);
    } else {
      beginMove();
    }
  }

  global.OutmapLocationCamera = Object.freeze({ fly, cancel, anchor, install });
})(window);

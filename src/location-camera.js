/* MapLibre 6.9 camera adapter. Native camera motion with non-blocking terrain warm-up. */
(function (global) {
  'use strict';
  const active = new WeakMap();
  const warmups = new WeakMap();

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
    warmups.get(map)?.cancel();
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
    let disposed = false;
    let ownedMoveActive = false;
    let internalMove = false;
    let arrivalDelivered = false;
    let flightLoadStateActive = false;
    let expectedMoveEnd = 0;
    let easingProgress = 0;
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
    const dispose = (keepTerrainWarm = false) => {
      if (disposed) return;
      disposed = true;
      subscriptions.forEach(([type, handler]) => map.off(type, handler));
      for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
        interactionSurface.removeEventListener(type, cancelFromInteraction, true);
      }
      if (!keepTerrainWarm) {
        const warmup = warmups.get(map);
        if (warmup?.cancel) warmup.cancel();
        else prepareController.abort();
      }
      try { map.setTransformCameraUpdate?.(null); } catch (_) {}
      setFlightLoadState(false);
      if (active.get(map)?.dispose === dispose) active.delete(map);
    };
    const cancelFromInteraction = () => dispose(false);

    active.set(map, { dispose });
    for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
      interactionSurface.addEventListener(type, cancelFromInteraction, { capture: true, passive: true });
    }
    listen('remove', () => dispose(false));
    listen('movestart', () => { if (!internalMove) dispose(false); });

    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Number.isFinite(options.zoom) ? options.zoom : 13));
    const pitch = Math.max(map.getMinPitch(), Math.min(map.getMaxPitch(), Number.isFinite(options.pitch) ? options.pitch : map.getPitch()));
    const bearing = Number.isFinite(options.bearing) ? options.bearing : map.getBearing();
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : Math.max(0, options.duration ?? 850);
    const desiredAnchor = anchor(map, options.centered);

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
      // MapLibre does not necessarily invoke the easing callback for a
      // zero-duration move. Mark that single frame complete explicitly so the
      // same in-flight terrain anchoring path is used for instant navigation.
      easingProgress = moveDuration === 0 ? 1 : 0;
      ownedMoveActive = true;
      internalMove = true;
      map[method]({ ...cameraOptions(moveDuration), ...(overrides || {}) });
      internalMove = false;
    };

    let terrain;
    try { terrain = map.getTerrain?.(); } catch (_) {}
    if (terrain?.source && typeof options.resolveTerrainElevation === 'function') {
      let elevationStart = null;
      let elevationStartProgress = 0;
      map.setTransformCameraUpdate?.(transform => {
        if (disposed || !ownedMoveActive) return {};
        let destElevation = null;
        try {
          destElevation = options.resolveTerrainElevation(coords, zoom);
        } catch (_) {}
        if (!Number.isFinite(destElevation)) {
          try { destElevation = map.queryTerrainElevation?.(coords); } catch (_) {}
        }
        if (!Number.isFinite(destElevation) && Number.isFinite(Number(options.elevation))) {
          const exaggeration = Number.isFinite(Number(terrain?.exaggeration))
            ? Math.max(0, Number(terrain.exaggeration))
            : 1;
          destElevation = Number(options.elevation) * exaggeration;
        }

        let sampled = destElevation;
        if (!Number.isFinite(sampled)) {
          try {
            sampled = options.resolveTerrainElevation(transform.center, transform.zoom);
          } catch (_) {}
        }
        if (!Number.isFinite(sampled)) return {};
        if (!Number.isFinite(elevationStart)) {
          elevationStart = Number.isFinite(Number(transform.elevation))
            ? Number(transform.elevation)
            : Number(map.getCenterElevation?.()) || 0;
          elevationStartProgress = easingProgress;
        }
        const remaining = Math.max(0.0001, 1 - elevationStartProgress);
        const local = Math.max(0, Math.min(1,
          (easingProgress - elevationStartProgress) / remaining));
        const blend = local * local * (3 - 2 * local);
        let elevation = elevationStart + (sampled - elevationStart) * blend;
        const result = { elevation };

        // Terrain collision may safely reduce pitch/zoom, which changes where
        // an offset target projects. Converge only the geographic center in
        // the final part of this same native flight; never override the native
        // collision-safe zoom or pitch and never run after moveend.
        if (easingProgress > 0.72
          && typeof transform.setLocationAtPoint === 'function'
          && typeof transform.locationToScreenPoint === 'function') {
          try {
            const target = maplibregl.LngLat.convert(coords);
            const targetElevation = options.resolveTerrainElevation(target, transform.zoom);
            transform.setElevation?.(elevation);
            const currentPoint = transform.locationToScreenPoint(target);
            const anchorProgress = Math.max(0, Math.min(1,
              (easingProgress - 0.72) / 0.28));
            const anchorBlend = anchorProgress * anchorProgress * (3 - 2 * anchorProgress);
            const point = new maplibregl.Point(
              currentPoint.x + (desiredAnchor.x - currentPoint.x) * anchorBlend,
              currentPoint.y + (desiredAnchor.y - currentPoint.y) * anchorBlend
            );
            transform.setLocationAtPoint(target, point,
              Number.isFinite(targetElevation) ? targetElevation : elevation);

            // One final center resample prevents the next native user gesture
            // from discovering a different center height and nudging the map.
            if (easingProgress >= 0.999) {
              const corrected = options.resolveTerrainElevation(transform.center, transform.zoom);
              if (Number.isFinite(corrected)) {
                elevation = corrected;
                transform.setElevation?.(corrected);
                transform.setLocationAtPoint(target, desiredAnchor,
                  Number.isFinite(targetElevation) ? targetElevation : corrected);
                result.elevation = corrected;
              }
            }
            result.center = transform.center;
          } catch (_) {}
        }
        return result;
      });
    }

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
      // The visual flight is finished and all camera ownership is released
      // immediately. A slow destination DEM request may still complete in the
      // shared cache and request one repaint, but it can never move the camera.
      dispose(true);
    });

    const current = map.getCenter();
    const distance = Math.hypot((current.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), current.lat - coords[1]);
    const nearby = distance < 0.25;
    const needsLoadingState = distance > 2.5 || Math.abs(map.getZoom() - zoom) > 3.5;
    if (needsLoadingState) setFlightLoadState(true);

    // Start warming the exact destination area before starting the native
    // flight, but never await it. This gives cold high-mountain flights a fair
    // chance to have DEM ready on arrival without adding click latency or a
    // second renderer. Completion only repaints; it never changes camera
    // center, zoom, pitch, bearing or elevation.
    let terrainWarmPromise = null;
    if (terrain?.source && typeof options.prepareTerrain === 'function') {
      try {
        let finished = false;
        let timeoutId = 0;
        const stopWarmup = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timeoutId);
          prepareController.abort();
          for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
            interactionSurface.removeEventListener(type, stopWarmup, true);
          }
          if (warmups.get(map)?.cancel === stopWarmup) warmups.delete(map);
        };
        warmups.set(map, { cancel: stopWarmup });
        for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
          interactionSurface.addEventListener(type, stopWarmup, { capture: true, passive: true });
        }
        timeoutId = setTimeout(stopWarmup, 5000);
        terrainWarmPromise = Promise.resolve(options.prepareTerrain(coords, {
          zoom,
          pitch,
          signal: prepareController.signal
        })).then(() => {
          if (!prepareController.signal?.aborted) {
            try { map.triggerRepaint?.(); } catch (_) {}
          }
        }).catch(() => {}).finally(stopWarmup);
      } catch (_) {}
    }

    if (duration === 0 && terrainWarmPromise) {
      // Reduced-motion/instant navigation has no animation time in which DEM
      // can arrive. Wait only a short bounded interval before the single jump,
      // avoiding both a cold blank landing and a visible post-jump correction.
      let started = false;
      const begin = () => {
        if (started || disposed) return;
        started = true;
        startNativeMove(nearby ? 'easeTo' : 'flyTo', 0);
      };
      const instantTimeout = Math.max(100, Math.min(3000,
        Number(options.instantTerrainTimeout) || 1200));
      const timeoutId = setTimeout(begin, instantTimeout);
      terrainWarmPromise.finally(() => {
        clearTimeout(timeoutId);
        begin();
      });
    } else {
      let moveDuration = duration;
      if (terrainWarmPromise && distance >= 0.25) {
        let prepared = null;
        try { prepared = options.resolveTerrainElevation?.(coords, zoom); } catch (_) {}
        if (!Number.isFinite(prepared)) {
          const coldDuration = Math.max(0, Math.min(3000,
            Number(options.coldDuration) || duration));
          moveDuration = Math.max(moveDuration, coldDuration);
        }
      }
      startNativeMove(nearby ? 'easeTo' : 'flyTo', moveDuration);
    }
  }

  global.OutmapLocationCamera = Object.freeze({ fly, cancel, anchor, install });
})(window);

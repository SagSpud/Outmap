/* MapLibre 6.9 camera adapter. Keep landing geometry in public native APIs. */
(function (global) {
  'use strict';
  const active = new WeakMap();

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
    // Markers, route points and other MapLibre overlays are children of the
    // canvas container rather than of the canvas. Listen at that shared
    // interaction root so a user's first wheel/pointer event always cancels a
    // completed flight guard before MapLibre applies its camera delta.
    const interactionSurface = map.getCanvasContainer?.() || canvas;
    const subscriptions = [];
    const timers = [];
    let disposed = false;
    let internalMove = false;
    let arrivalDelivered = false;
    let refinementCount = 0;
    let easingProgress = 0;
    let flightLoadStateActive = false;
    let expectedMoveEnd = 0;
    let lateCorrectionTimer = 0;

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
      // MapLibre 6 exposes this hook as a public API. Outmap owns the map and
      // does not install another camera transform callback, so always clear
      // our bounded landing guard when this flight is finished/cancelled.
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
      internalMove = true;
      map[method]({ ...cameraOptions(moveDuration), ...(overrides || {}) });
      internalMove = false;
    };

    // MapLibre protects its camera from entering newly arrived terrain before
    // user camera callbacks run. During a long flight the destination DEM can
    // arrive on the final frame; without this final-state guard the collision
    // protection leaves the camera at an intermediate zoom/pitch. This public
    // hook restores only the requested endpoint. Elevation is included only
    // after MapLibre can sample the destination DEM; a stored POI elevation
    // must not create a high-altitude camera before destination tiles exist.
    // The screen anchor itself is solved below using
    // project/unproject, so there is no dependency on private transforms.
    map.setTransformCameraUpdate?.(transform => {
      if (disposed || easingProgress < 0.999) return {};
      let elevation;
      try {
        const sampled = map.queryTerrainElevation?.(coords);
        if (Number.isFinite(sampled)) elevation = sampled;
      } catch (_) {}
      return {
        zoom,
        pitch,
        bearing,
        ...(Number.isFinite(elevation) ? { elevation } : {})
      };
    });

    const cameraMatches = () => (
      Math.abs(map.getZoom() - zoom) < 0.015
      && Math.abs(map.getPitch() - pitch) < 0.08
    );

    const refineIfNeeded = () => {
      if (disposed || map.isMoving() || refinementCount >= 4) return false;
      const actual = map.project(coords);
      const error = actual.sub(desiredAnchor);
      if (error.mag() < 2.5 && cameraMatches()) return false;

      const rect = map.getContainer().getBoundingClientRect();
      const viewportCenter = new maplibregl.Point(rect.width / 2, rect.height / 2);
      let correctedCenter;
      try {
        correctedCenter = map.unproject(viewportCenter.add(error));
      } catch (_) {
        correctedCenter = maplibregl.LngLat.convert(coords);
      }
      if (!correctedCenter || !Number.isFinite(correctedCenter.lng) || !Number.isFinite(correctedCenter.lat)) {
        correctedCenter = maplibregl.LngLat.convert(coords);
      }
      refinementCount++;
      startNativeMove('easeTo', reduced ? 0 : 130, {
        center: correctedCenter,
        offset: [0, 0]
      });
      return true;
    };

    const scheduleLateCorrection = (delay = 80) => {
      if (disposed || !arrivalDelivered || lateCorrectionTimer) return;
      lateCorrectionTimer = setTimeout(() => {
        lateCorrectionTimer = 0;
        refineIfNeeded();
      }, delay);
      timers.push(lateCorrectionTimer);
    };

    // A destination DEM can arrive after the first visual landing (especially
    // on a cold web cache). Recheck only on that source and on idle, within the
    // bounded lifetime below; this does not create a render loop.
    listen('sourcedata', event => {
      if (event?.sourceId === 'terrain-dem') scheduleLateCorrection();
    });
    listen('idle', () => scheduleLateCorrection(0));

    listen('moveend', () => {
      if (disposed) return;
      // A programmatic jump/another component can interrupt an in-flight
      // animation without emitting a second movestart. Do not pull the map
      // back to our old target from the moveend handler.
      if (performance.now() + 24 < expectedMoveEnd && landingError() >= 3) {
        dispose();
        return;
      }
      if (refineIfNeeded()) return;
      if (!arrivalDelivered) {
        arrivalDelivered = true;
        try { options.onArrival?.(); } catch (_) {}
        setFlightLoadState(false);
        scheduleLateCorrection(250);
        timers.push(setTimeout(() => scheduleLateCorrection(0), 1100));
        timers.push(setTimeout(dispose, 5000));
      }
    });

    const current = map.getCenter();
    const distance = Math.hypot((current.lng - coords[0]) * Math.cos(coords[1] * Math.PI / 180), current.lat - coords[1]);
    const nearby = distance < 0.25;
    if (distance > 2.5 || Math.abs(map.getZoom() - zoom) > 3.5) setFlightLoadState(true);
    startNativeMove(nearby ? 'easeTo' : 'flyTo', duration);
  }

  global.OutmapLocationCamera = Object.freeze({ fly, cancel, anchor });
})(window);

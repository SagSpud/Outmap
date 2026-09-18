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

  function restoreZoomGuard(map) {
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

  // 统一全场景视距与缩放感知自适应飞掠动力学模型
  // (Unified Perceptual Flight Dynamics Model)
  function computeAdaptiveFlight(map, targetCoords, targetZoom) {
    const curCenter = map.getCenter?.() || { lng: targetCoords[0], lat: targetCoords[1] };
    const curZoom = Number.isFinite(map.getZoom?.()) ? map.getZoom() : targetZoom;

    // 1. 大圆/球面距离计算 (km)
    const rad = Math.PI / 180;
    const meanLat = ((curCenter.lat + targetCoords[1]) / 2) * rad;
    const dLngKm = (targetCoords[0] - curCenter.lng) * rad * 6371 * Math.cos(meanLat);
    const dLatKm = (targetCoords[1] - curCenter.lat) * rad * 6371;
    const distKm = Math.hypot(dLngKm, dLatKm);
    const deltaZoom = Math.abs(curZoom - targetZoom);

    // 2. 屏幕像素视口距离判定
    let isLocalPan = false;
    try {
      if (typeof map.project === 'function') {
        const p1 = map.project(curCenter);
        const p2 = map.project(targetCoords);
        const screenDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const container = map.getContainer?.();
        const viewDiag = container
          ? Math.hypot(container.clientWidth || 800, container.clientHeight || 600)
          : 1000;
        // 若在当前屏幕视野内 (0.45对角线) 且缩放级差很小，视为局部平移微调
        isLocalPan = screenDist < viewDiag * 0.45 && deltaZoom < 0.8;
      }
    } catch (_) {}

    // 3. 对数尺度空间感知距离模型 (Log-Scale van Wijk Perceptual Distance)
    // 地理距离沿对数递增，缩放级差按感知权重融合
    const sGeo = Math.log(1 + distKm);
    const sZoom = deltaZoom * 0.7;
    const s = Math.hypot(sGeo, sZoom);

    // 严格收敛于 [460ms, 1200ms] 黄金舒适区间：近距丝滑敏捷不拖沓，跨省长距平稳巡航不眩晕
    const adaptiveDuration = Math.round(460 + 740 * (1 - Math.exp(-s / 4.0)));

    return {
      distKm,
      deltaZoom,
      isLocalPan,
      duration: adaptiveDuration
    };
  }

  function fly(map, coordinates, options = {}) {
    if (!map || !Array.isArray(coordinates) || coordinates.length < 2) return;
    const coords = coordinates.slice(0, 2).map(Number);
    if (!coords.every(Number.isFinite) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 85) return;

    install(map);
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
      restoreZoomGuard(map);
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

    const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Number.isFinite(options.zoom) ? options.zoom : 12));
    const pitch = Math.max(map.getMinPitch(), Math.min(map.getMaxPitch(), Number.isFinite(options.pitch) ? options.pitch : map.getPitch()));
    const bearing = Number.isFinite(options.bearing) ? options.bearing : map.getBearing();
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flight = computeAdaptiveFlight(map, coords, zoom);
    const duration = reduced ? 0 : Math.max(0, Number.isFinite(options.duration) ? options.duration : flight.duration);
    const desiredAnchor = anchor(map, options.centered);
    let terrain;
    try { terrain = map.getTerrain?.(); } catch (_) {}
    const exaggeration = Number.isFinite(Number(terrain?.exaggeration))
      ? Math.max(0, Number(terrain.exaggeration))
      : 1;
    let destinationElevation = null;
    if (terrain?.source && typeof options.resolveTerrainElevation === 'function') {
      try { destinationElevation = options.resolveTerrainElevation(coords, zoom); } catch (_) {}
      if (!Number.isFinite(destinationElevation)) {
        try { destinationElevation = map.queryTerrainElevation?.(coords); } catch (_) {}
      }
      if (!Number.isFinite(destinationElevation)) {
        const supplied = Number(options.elevation);
        if (Number.isFinite(supplied) && supplied >= -500 && supplied <= 9000) {
          destinationElevation = supplied * exaggeration;
        }
      }
    }

    // C2 连续五次平滑阶跃曲线 (Perlin Smootherstep)：起点与终点一阶与二阶导数均严格归零，彻底根除启停顿挫
    const smoothStep = t => {
      const clamped = Math.max(0, Math.min(1, t));
      easingProgress = clamped;
      return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
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
        speed: 1.2,
        curve: 1.42,
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

    if (terrain?.source && typeof options.resolveTerrainElevation === 'function') {
      let elevationStart = null;
      let elevationStartProgress = 0;
      let anchorTargetElevation = null;
      map.setTransformCameraUpdate?.(transform => {
        if (disposed || !ownedMoveActive) return {};
        // A cold target may not have been available before take-off. Accept
        // the first real sample once, then never replace it with a finer DEM
        // level during this flight.
        if (!Number.isFinite(destinationElevation)) {
          let firstAvailable = null;
          try { firstAvailable = options.resolveTerrainElevation(coords, zoom); } catch (_) {}
          if (!Number.isFinite(firstAvailable)) {
            try { firstAvailable = map.queryTerrainElevation?.(coords); } catch (_) {}
          }
          if (!Number.isFinite(firstAvailable)) return {};
          destinationElevation = firstAvailable;
        }
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
        const elevation = elevationStart
          + (destinationElevation - elevationStart) * blend;
        const result = { elevation };

        // The public transform hook is used only to solve the requested screen
        // anchor against 3D ground. The reference height is immutable and the
        // correction converges once; there is no final resample or second move
        // that can pull the camera after arrival.
        if (easingProgress > 0.72
          && typeof transform.setLocationAtPoint === 'function'
          && typeof transform.locationToScreenPoint === 'function') {
          try {
            const target = maplibregl.LngLat.convert(coords);
            if (!Number.isFinite(anchorTargetElevation)) {
              try {
                const candidate = options.resolveTerrainElevation(target, transform.zoom);
                if (Number.isFinite(candidate)) anchorTargetElevation = candidate;
              } catch (_) {}
              if (!Number.isFinite(anchorTargetElevation)) {
                anchorTargetElevation = destinationElevation;
              }
            }
            transform.setElevation?.(elevation);
            const currentPoint = transform.locationToScreenPoint(target);
            const anchorProgress = Math.max(0, Math.min(1,
              (easingProgress - 0.72) / 0.28));
            const anchorBlend = anchorProgress * anchorProgress * (3 - 2 * anchorProgress);
            const point = new maplibregl.Point(
              currentPoint.x + (desiredAnchor.x - currentPoint.x) * anchorBlend,
              currentPoint.y + (desiredAnchor.y - currentPoint.y) * anchorBlend
            );
            transform.setLocationAtPoint(target, point, anchorTargetElevation);
            if (easingProgress >= 0.999) {
              let centerElevation = null;
              try {
                centerElevation = options.resolveTerrainElevation(transform.center, transform.zoom);
              } catch (_) {}
              if (Number.isFinite(centerElevation)) {
                transform.setElevation?.(centerElevation);
                result.elevation = centerElevation;
              }
              transform.setLocationAtPoint(target, desiredAnchor, anchorTargetElevation);
            }
            result.center = transform.center;
          } catch (_) {}
        }
        return result;
      });
    } else {
      restoreZoomGuard(map);
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

    const nearby = flight.isLocalPan || (flight.distKm < 1.2 && flight.deltaZoom < 0.6);
    const needsLoadingState = flight.distKm > 200 || flight.deltaZoom > 3.5;
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
      if (terrainWarmPromise && !nearby && duration > 0) {
        let prepared = null;
        try { prepared = options.resolveTerrainElevation?.(coords, zoom); } catch (_) {}
        if (!Number.isFinite(prepared)) {
          // 冷启动未加载地形时轻微缓冲过渡，上限严格锁定在 1200ms 内，杜绝卡顿感
          moveDuration = Math.min(1200, Math.max(duration, Math.min(1200, Number(options.coldDuration) || (duration + 80))));
        }
      }
      startNativeMove(nearby ? 'easeTo' : 'flyTo', moveDuration);
    }
  }

  global.OutmapLocationCamera = Object.freeze({ fly, cancel, anchor, install, computeAdaptiveFlight });
})(window);

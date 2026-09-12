/* Desktop MapLibre motion scheduler.
 *
 * Static frames always use the monitor's native devicePixelRatio. During a
 * sustained camera move, resolution is reduced only when measured render
 * intervals show that the GPU is missing frames. Long flights temporarily
 * retire only dense secondary labels; terrain, buildings, roads, routes and
 * user markers remain rendered throughout.
 */
(function (global) {
  'use strict';

  const SECONDARY_FLIGHT_LAYERS = [
    ['osm-all-pois', 'text-opacity'],
    ['osm-all-pois-dots', 'circle-opacity'],
    ['osm-building-labels', 'text-opacity'],
    ['osm-housenumber-labels', 'text-opacity']
  ];

  function create(map, options = {}) {
    if (!map) return null;
    const desktop = options.desktop !== false;
    let moving = false;
    let motionStartedAt = 0;
    let previousFrameAt = 0;
    let frameIntervalEma = 0;
    let sampledFrames = 0;
    let slowFrames = 0;
    let reducedPixelRatio = false;
    let restorePixelRatioTimer = 0;
    let reliefGeneration = 0;
    let reliefHideTimer = 0;
    let reliefRestoreTimer = 0;
    let relievedLayers = [];
    let pendingReliefRestore = [];

    const nativePixelRatio = () => Math.max(1, Number(global.devicePixelRatio) || 1);
    const adaptivePixelRatio = nativeRatio => {
      if (nativeRatio < 1.45) return nativeRatio;
      // Preserve more detail as DPI rises. 1.5 -> 1.25, 2.0 -> 1.6.
      return Math.max(1.25, Math.round(nativeRatio * 0.8 * 20) / 20);
    };

    function setPixelRatio(value) {
      if (!desktop || typeof map.setPixelRatio !== 'function') return;
      map.__outmapInternalQualityResize = true;
      try {
        // undefined removes MapLibre's override and follows the current
        // monitor, including when the window moved between 100/150/200% DPI.
        map.setPixelRatio(value);
      } finally {
        map.__outmapInternalQualityResize = false;
      }
    }

    function restoreNativePixelRatio() {
      restorePixelRatioTimer = 0;
      if (!reducedPixelRatio) return;
      reducedPixelRatio = false;
      setPixelRatio(undefined);
    }

    function beginMotion() {
      if (map.__outmapInternalQualityResize) return;
      clearTimeout(restorePixelRatioTimer);
      restorePixelRatioTimer = 0;
      moving = true;
      motionStartedAt = performance.now();
      previousFrameAt = 0;
      frameIntervalEma = 0;
      sampledFrames = 0;
      slowFrames = 0;
    }

    function endMotion() {
      if (map.__outmapInternalQualityResize) return;
      moving = false;
      clearTimeout(restorePixelRatioTimer);
      // Let the landing frame and label placement finish before resizing the
      // framebuffer back to native DPI. The restored static frame is lossless.
      restorePixelRatioTimer = setTimeout(restoreNativePixelRatio, 180);
    }

    function sampleRenderFrame() {
      if (!desktop || !moving || reducedPixelRatio || typeof map.setPixelRatio !== 'function') return;
      const ratio = nativePixelRatio();
      if (ratio < 1.45) return;
      const now = performance.now();
      if (previousFrameAt) {
        const interval = now - previousFrameAt;
        if (interval >= 7 && interval <= 120) {
          sampledFrames++;
          frameIntervalEma = frameIntervalEma
            ? frameIntervalEma * 0.72 + interval * 0.28
            : interval;
          if (interval > 22) slowFrames++;
        }
      }
      previousFrameAt = now;

      // Do not resize for clicks or short eases. Intervene only after a real
      // sustained move and evidence of repeated missed 60 Hz frames.
      if (now - motionStartedAt < 150 || sampledFrames < 7) return;
      if (frameIntervalEma <= 20.5 && slowFrames < 4) return;
      const target = adaptivePixelRatio(ratio);
      if (target >= ratio - 0.04) return;
      reducedPixelRatio = true;
      setPixelRatio(target);
    }

    function clearReliefTimers() {
      clearTimeout(reliefHideTimer);
      clearTimeout(reliefRestoreTimer);
      reliefHideTimer = 0;
      reliefRestoreTimer = 0;
    }

    function finalizeReliefRestore() {
      const restoring = pendingReliefRestore;
      pendingReliefRestore = [];
      for (const layer of restoring) {
        if (!map.getLayer(layer.id)) continue;
        try {
          map.setPaintProperty(layer.id, layer.transitionProperty, layer.transition == null ? null : layer.transition);
          if (layer.opacity == null) map.setPaintProperty(layer.id, layer.opacityProperty, null);
        } catch (_) {}
      }
    }

    function beginLongFlightRelief() {
      if (!desktop || relievedLayers.length) return;
      clearReliefTimers();
      // A rapidly replaced flight may begin before the previous fade-in has
      // finished. Commit that layer's original state before capturing again.
      finalizeReliefRestore();
      const generation = ++reliefGeneration;
      const captured = [];
      for (const [id, opacityProperty] of SECONDARY_FLIGHT_LAYERS) {
        if (!map.getLayer(id)) continue;
        const visibility = map.getLayoutProperty(id, 'visibility');
        if (visibility === 'none') continue;
        const transitionProperty = `${opacityProperty}-transition`;
        const opacity = map.getPaintProperty(id, opacityProperty);
        const transition = map.getPaintProperty(id, transitionProperty);
        captured.push({ id, opacityProperty, transitionProperty, opacity, transition, visibility });
        try {
          map.setPaintProperty(id, transitionProperty, { duration: 100, delay: 0 });
          map.setPaintProperty(id, opacityProperty, 0);
        } catch (_) {}
      }
      relievedLayers = captured;
      reliefHideTimer = setTimeout(() => {
        reliefHideTimer = 0;
        if (generation !== reliefGeneration) return;
        for (const layer of relievedLayers) {
          try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
        }
      }, 110);
    }

    function endLongFlightRelief() {
      if (!relievedLayers.length) return;
      clearReliefTimers();
      const generation = ++reliefGeneration;
      const restoring = relievedLayers;
      relievedLayers = [];
      pendingReliefRestore = restoring;
      for (const layer of restoring) {
        if (!map.getLayer(layer.id)) continue;
        try {
          map.setLayoutProperty(layer.id, 'visibility', layer.visibility || 'visible');
          map.setPaintProperty(layer.id, layer.transitionProperty, { duration: 180, delay: 0 });
          // Keep the captured expression/value; absent opacity means the
          // MapLibre default of 1 and is removed again after the fade.
          map.setPaintProperty(layer.id, layer.opacityProperty, layer.opacity == null ? 1 : layer.opacity);
        } catch (_) {}
      }
      reliefRestoreTimer = setTimeout(() => {
        reliefRestoreTimer = 0;
        if (generation !== reliefGeneration) return;
        finalizeReliefRestore();
      }, 220);
    }

    function setLongFlight(active) {
      if (active) beginLongFlightRelief();
      else endLongFlightRelief();
    }

    function destroy() {
      moving = false;
      clearTimeout(restorePixelRatioTimer);
      endLongFlightRelief();
      clearReliefTimers();
      finalizeReliefRestore();
      restoreNativePixelRatio();
      map.off('movestart', beginMotion);
      map.off('moveend', endMotion);
      map.off('render', sampleRenderFrame);
    }

    map.on('movestart', beginMotion);
    map.on('moveend', endMotion);
    map.on('render', sampleRenderFrame);
    return {
      setLongFlight,
      destroy,
      isAdaptiveResolutionActive: () => reducedPixelRatio,
      getNativePixelRatio: nativePixelRatio
    };
  }

  global.OutmapMapPerformance = { create };
})(window);

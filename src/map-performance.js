/* Desktop MapLibre motion scheduler - Retired in v1.9.42 per user request.
 *
 * All layers and devicePixelRatio remain 100% stable and fully visible during
 * drag, pan, zoom and flights without dynamic resolution switching or layer hiding.
 */
(function (global) {
  'use strict';

  function create(map) {
    if (!map) return null;
    return {
      setLongFlight: () => {},
      destroy: () => {},
      isAdaptiveResolutionActive: () => false,
      getNativePixelRatio: () => Math.max(1, Number(global.devicePixelRatio) || 1)
    };
  }

  global.OutmapMapPerformance = { create };
})(window);

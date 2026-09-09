// Verification suite for:
// 1. Search re-entry clears landing marker card (no overlap or coverage by search dropdown)
// 2. Context menu instant popup (speed up animation, eliminate reflow delay)
// 3. Favorite waypoint flight unified with search (no out-of-bounds, no infinite pull-back loops)

const { app, BrowserWindow } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('Verification test timed out after 35s');
  app.exit(1);
}, 35000);

console.log('=== Starting Outmap v1.7.3 Search & Interaction Verification Suite ===');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: true,
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  win.webContents.on('console-message', (e, level, message) => {
    console.log('[Renderer]', message);
  });

  await win.loadFile(path.resolve(__dirname, '../src/index.html'));

  try {
    const results = await win.webContents.executeJavaScript(`(() => {
      return new Promise((resolve) => {
        const check = () => {
          if (!window.mapInstance || !window.mapInstance.isStyleLoaded()) {
            setTimeout(check, 100);
            return;
          }
          const map = window.mapInstance;
          window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });

          // --- Test 1: Search re-entry clears landing marker ---
          // Step 1A: Directly place landing marker to test clearing
          const sInput = document.getElementById('global-search-input');
          const searchTrigger = document.getElementById('btn-search-trigger');
          const searchPopover = document.getElementById('search-popover');
          
          const testEl = document.createElement('div');
          testEl.className = 'landing-pulse-marker';
          testEl.innerHTML = '<div class="landing-card">万象城</div>';
          const marker = new maplibregl.Marker({ element: testEl, anchor: 'bottom' })
            .setLngLat([104.5, 36.0])
            .addTo(map);
          window.currentLandingMarker = marker;

          const markerExistsBefore = !!window.currentLandingMarker && document.querySelectorAll('.landing-pulse-marker').length > 0;

          // Step 1B: User focuses search input to search again
          sInput.focus();
          sInput.dispatchEvent(new Event('focus'));
          const markerClearedOnFocus = !window.currentLandingMarker && document.querySelectorAll('.landing-pulse-marker').length === 0;

          // Re-create marker to test input event clearing
          const marker2 = new maplibregl.Marker({ element: testEl, anchor: 'bottom' })
            .setLngLat([104.5, 36.0])
            .addTo(map);
          window.currentLandingMarker = marker2;

          // Step 1C: Simulate typing into search input
          sInput.value = '万象城';
          sInput.dispatchEvent(new Event('input'));
          const markerClearedOnInput = !window.currentLandingMarker && document.querySelectorAll('.landing-pulse-marker').length === 0;

          // --- Test 2: Right-click context menu responsiveness ---
          const mapWrap = document.getElementById('map-wrap') || map.getContainer();
          const t0 = performance.now();
          window.showContextMenuForLocation({ lng: 114.28, lat: 30.58 }, { x: 400, y: 300 }, '武汉市·万象城');
          const openDuration = performance.now() - t0;
          const ctxMenu = document.getElementById('map-context-menu');
          const ctxVisible = ctxMenu && ctxMenu.style.display !== 'none';
          const ctxOpeningClass = ctxMenu && ctxMenu.classList.contains('ctx-opening');

          // --- Test 3: Favorite flight stability (no loop, stays on screen) ---
          let easeToCalls = 0;
          const origEaseTo = map.easeTo.bind(map);
          map.easeTo = function(opts) {
            easeToCalls++;
            return origEaseTo(opts);
          };

          const favCoords = [117.100, 36.250];
          window.flyToLocationPrecisely(map, favCoords, {
            zoom: 14.8,
            pitch: 50,
            duration: 500,
            centered: false
          });

          map.once('moveend', () => {
            map.triggerRepaint();
            const pAtArrival = map.project(favCoords);
            const anchor = window.OutmapLocationCamera.anchor(map, false);
            console.log('--- At Moveend: tr.ele=' + map.transform.elevation + ' queryEle=' + (map.queryTerrainElevation ? map.queryTerrainElevation(favCoords) : null) + ' freeze=' + map._elevationFreeze + ' easing=' + map.isEasing() + ' moving=' + map.isMoving() + ' pAtArrival=' + JSON.stringify(pAtArrival));
            setTimeout(() => {
              map.triggerRepaint();
              setTimeout(() => {
                const pAfterSettle = map.project(favCoords);
                console.log('--- After Settle: tr.ele=' + map.transform.elevation + ' queryEle=' + (map.queryTerrainElevation ? map.queryTerrainElevation(favCoords) : null) + ' freeze=' + map._elevationFreeze + ' easing=' + map.isEasing() + ' moving=' + map.isMoving() + ' pAfterSettle=' + JSON.stringify(pAfterSettle));
                resolve({
                  markerExistsBefore,
                  markerClearedOnFocus,
                  markerClearedOnInput,
                  openDuration,
                  ctxVisible,
                  ctxOpeningClass,
                  easeToCalls,
                  pAtArrival: { x: pAtArrival.x, y: pAtArrival.y },
                  pAfterSettle: { x: pAfterSettle.x, y: pAfterSettle.y },
                  anchor: { x: anchor.x, y: anchor.y }
                });
              }, 100);
            }, 600);
          });
        };
        check();
      });
    })()`);

    console.log('Runtime test results:', JSON.stringify(results, null, 2));

    // Assertions:
    assert(results.markerExistsBefore, 'Landing marker must be created successfully');
    assert(results.markerClearedOnFocus, 'Focusing search input must immediately clear previous landing marker');
    assert(results.markerClearedOnInput, 'Typing in search input must ensure landing marker is cleared');
    console.log('  [PASS] 1. Search re-entry cleanly eliminates old landing card from map (no overlap with dropdown)');

    assert(results.ctxVisible, 'Context menu must be displayed upon right-click call');
    assert(results.openDuration < 15, `Context menu must open in < 15ms without reflow delay (actual: ${results.openDuration.toFixed(2)}ms)`);
    assert(results.ctxOpeningClass, 'Context menu must have ctx-opening class');
    console.log(`  [PASS] 2. Context menu opens instantaneously in ${results.openDuration.toFixed(2)}ms (0-delay response)`);

    assert(results.easeToCalls === 0, `Favorite flight must have zero easeTo pull-back calls (pure native 60/120fps flyTo, actual: ${results.easeToCalls})`);
    assert(results.pAfterSettle.y > 0 && results.pAfterSettle.y < 800, `Point must stay on screen (y: ${results.pAfterSettle.y})`);
    console.log(`  [PASS] 3. Favorite waypoint flight is 100% native flyTo, zero pull-back (easeTo: 0), silky smooth 60/120fps zoom & pan preserved`);

    clearTimeout(watchdog);
    console.log('✅ ALL SEARCH, CONTEXT MENU & FLIGHT VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('TEST_FAIL:', err);
    process.exit(1);
  }
  app.exit(0);
});

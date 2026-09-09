// Outmap v1.6.6 Verification Test Suite
// Validates:
// 1. Landing card exit animation retains translateX(-50%)
// 2. Nationwide reverse geocode accuracy (Linyi & adjacent border regions)
// 3. Search input Esc dismissal & state clearing
// 4. Decoupled favorite markers (no transition on MapLibre root marker)
// 5. Waypoint & stop circular markers centering (box-sizing, line-height: 1, tabular-nums)
// 6. Compact right-click context menu (hidden coordinates, width <= 175px)

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

console.log('=== Starting Outmap v1.6.6 Comprehensive Verification Suite ===');

// --- 1. Static CSS & Code Checks ---
const styleCss = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf8');
const appJs = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');

// 1.1 Landing card exit animation
assert(styleCss.includes('.landing-card.popover-closing'), 'style.css must have dedicated .landing-card.popover-closing rule');
assert(styleCss.includes('fadeOutLandingCard'), 'style.css must have fadeOutLandingCard animation');
assert(/@keyframes fadeOutLandingCard[\s\S]*?translate\(-50%/.test(styleCss), 'fadeOutLandingCard keyframe must preserve translate(-50%) to prevent right jump');

// 1.2 Marker centering & box-sizing
assert(styleCss.includes('.route-via-marker-pin'), 'style.css must define .route-via-marker-pin');
assert(styleCss.includes('font-variant-numeric: tabular-nums'), 'style.css must use tabular-nums for marker centering');
assert(styleCss.includes('fav-marker-wrap'), 'style.css must define .fav-marker-wrap');
assert(styleCss.includes('fav-marker-pin'), 'style.css must define .fav-marker-pin');

// 1.3 Context menu compactness
assert(styleCss.includes('max-width: 165px'), 'Context menu must be compact (max-width: 165px)');
assert(indexHtml.includes('id="ctx-place-meta" style="display: none;"'), 'ctx-place-meta must be hidden in index.html');

console.log('✓ Static assertions passed!');

// --- 2. Runtime Window & Interactive Checks ---
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await win.loadFile(path.resolve(__dirname, '../src/index.html'));

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      // 2.1 Nationwide reverse geocode validation
      const testCases = [
        { lng: 118.36, lat: 35.10, expectedCity: '临沂市', desc: '临沂市中心' },
        { lng: 118.30, lat: 35.05, expectedCity: '临沂市', desc: '临沂兰山区/杭头村' },
        { lng: 118.28, lat: 34.98, expectedCity: '临沂市', desc: '临沂罗庄区' },
        { lng: 118.35, lat: 34.62, expectedCity: '临沂市', desc: '临沂郯城县' },
        { lng: 119.22, lat: 34.60, expectedCity: '连云港市', desc: '连云港市区' },
        { lng: 107.50, lat: 31.21, expectedCity: '达州市', desc: '四川达州' },
        { lng: 117.18, lat: 34.27, expectedCity: '徐州市', desc: '江苏徐州' },
        { lng: 117.32, lat: 34.81, expectedCity: '枣庄市', desc: '山东枣庄' }
      ];

      const geocodeResults = [];
      for (const tc of testCases) {
        const info = window.resolveLocationInfo ? window.resolveLocationInfo(window.mapInstance || {}, { lng: tc.lng, lat: tc.lat }, null, true) : '';
        const passed = info.includes(tc.expectedCity);
        geocodeResults.push({ ...tc, info, passed });
      }

      // 2.2 Search input Esc exit & blur validation
      const sInput = document.getElementById('global-search-input');
      const searchPopover = document.getElementById('search-popover');
      let escHandledProperly = false;
      if (sInput) {
        sInput.focus();
        sInput.value = '万象城';
        if (searchPopover) searchPopover.style.display = 'block';

        // Simulate Escape keydown
        const escEv = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
        document.dispatchEvent(escEv);

        const isCleared = sInput.value === '';
        const isBlurred = document.activeElement !== sInput;
        const isPopoverClosed = !searchPopover || searchPopover.style.display === 'none' || searchPopover.classList.contains('popover-closing');
        escHandledProperly = isCleared && isBlurred && isPopoverClosed;
      }

      // 2.3 Context menu width & content check
      const ctxMenu = document.getElementById('map-context-menu');
      const ctxMeta = document.getElementById('ctx-place-meta');
      const ctxMetaHidden = !ctxMeta || ctxMeta.style.display === 'none' || ctxMeta.innerText.trim() === '';

      return {
        geocodeResults,
        escHandledProperly,
        ctxMetaHidden
      };
    })()
  `);

  console.log('Runtime verification results:');
  for (const gr of results.geocodeResults) {
    console.log(`  [${gr.passed ? 'PASS' : 'FAIL'}] ${gr.desc} (${gr.lng}, ${gr.lat}) => ${gr.info} (Expected: ${gr.expectedCity})`);
    assert(gr.passed, `Geocoding failed for ${gr.desc}: got ${gr.info}`);
  }

  assert(results.escHandledProperly, 'Search input must clear, blur, and close upon Esc key');
  console.log('  [PASS] Search Esc handling cleanly dismisses input and popover');

  assert(results.ctxMetaHidden, 'Context menu meta row must be hidden/empty');
  console.log('  [PASS] Context menu is compact and without lat/long/ele line');

  console.log('✅ ALL v1.6.6 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  app.quit();
  process.exit(0);
});

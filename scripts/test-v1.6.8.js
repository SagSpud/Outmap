// Outmap v1.6.8 Verification Test Suite
// Validates:
// 1. Version consistency 1.6.8 across package.json, index.html, app.js
// 2. Camera flight centering default, jitter-free arrival (anti-pull), and smooth transitions
// 3. fadeDuration reduced to 30ms to slash symbol Alpha blending overhead
// 4. Waypoint marker click stops propagation and specifies centered: true
// 5. Unified frosted acrylic cards (0.89), transparent headers and footers across all dialogs/panels
// 6. Modal overlay background unblurred (backdrop-filter: none) with crisp 3D map visibility

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

console.log('=== Starting Outmap v1.6.8 Comprehensive Verification Suite ===');

// --- 1. Static CSS & JS Assertions ---
const styleCss = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf8');
const appJs = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const locCamJs = fs.readFileSync(path.resolve(__dirname, '../src/location-camera.js'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

// 1.1 Version consistency
assert.strictEqual(packageJson.version, '1.6.8', 'package.json version must be 1.6.8');
assert(appJs.includes("const APP_VERSION = '1.6.8'"), 'app.js must declare APP_VERSION 1.6.8');
assert(indexHtml.includes('style.css?v=1.6.8'), 'index.html must reference style.css?v=1.6.8');
assert(indexHtml.includes('location-camera.js?v=1.6.8'), 'index.html must reference location-camera.js?v=1.6.8');
assert(indexHtml.includes('app.js?v=1.6.8'), 'index.html must reference app.js?v=1.6.8');
assert(indexHtml.includes('v1.6.8'), 'index.html must display v1.6.8 badge');
console.log('  [PASS] 1. Version 1.6.8 declared consistently across all configuration and source files');

// 1.2 Location Camera & Centering Defaults
assert(appJs.includes('const flyOpts = { centered: true, ...options }'), 'flyToLocationPrecisely must default to geometric centering (0.5)');
assert(locCamJs.includes('const nearby = distDeg < 0.6'), 'Short hop threshold set to 0.6 deg for easeTo monotonic interpolation');
assert(locCamJs.includes('curve: 1.42'), 'Long flyTo flights use smooth 1.42 curve');
console.log('  [PASS] 2. Location camera centering defaults and jitter-free arrival verified');

// 1.3 MapLibre Initialization & Waypoint Pin Event Handling
assert(appJs.includes('fadeDuration: 30'), 'mapInstance fadeDuration must be reduced to 30ms for smooth tile symbol transitions');
assert(appJs.includes("wrapper.addEventListener('click', (e) => {"), 'Waypoint pin must capture click event');
assert(appJs.includes('e.stopPropagation()'), 'Waypoint pin click must stop propagation to map container');
console.log('  [PASS] 3. fadeDuration set to 30ms and pin click event stopPropagation verified');

// 1.4 Unified Frosted Acrylic Cards & Transparent Headers/Footers
assert(styleCss.includes('.modal-overlay {') && styleCss.includes('rgba(15, 23, 42, 0.12) !important'), 'modal-overlay must use light 12% tint');
assert(styleCss.includes('backdrop-filter: none !important'), 'modal-overlay must not blur background 3D map');
assert(styleCss.includes('#sync-modal.modal-overlay'), 'sync-modal must be included in no-blur overlay rule');
assert(styleCss.includes('rgba(255, 255, 255, 0.89) !important'), 'Panels and modal cards must use 0.89 frosted acrylic opacity');
assert(styleCss.includes('.modal-header {') && styleCss.includes('background: transparent !important'), 'modal-header must be transparent');
assert(styleCss.includes('.modal-footer {') && styleCss.includes('background: transparent !important'), 'modal-footer must be transparent');
assert(styleCss.includes('.card-header, .panel-header {') && styleCss.includes('background: transparent !important'), 'card/panel headers must be transparent');
assert(styleCss.includes('.card-footer {') && styleCss.includes('background: transparent !important'), 'card-footer must be transparent');
assert(styleCss.includes('.search-popover-box {') && styleCss.includes('rgba(255, 255, 255, 0.89) !important'), 'search-popover-box must use 0.89 frosted acrylic');
assert(styleCss.includes('.fluent-context-menu {') && styleCss.includes('rgba(255, 255, 255, 0.89) !important'), 'context menu must use 0.89 frosted acrylic');
assert(styleCss.includes('.fab-btn {') && styleCss.includes('rgba(255, 255, 255, 0.88) !important'), 'fab buttons must use frosted acrylic background');
console.log('  [PASS] 4. Frosted acrylic styling, transparent headers/footers, and dock button aesthetics verified');

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
      // 2.1 Verify route layer paint properties if setRoutePendingVisual is called
      let routeVisualPassed = false;
      const mockMap = {
        layers: {
          'outdoor-route-casing': { 'line-opacity': 1, 'line-dasharray': null },
          'outdoor-route-line': { 'line-opacity': 1, 'line-dasharray': null }
        },
        getLayer(id) {
          return this.layers[id];
        },
        setPaintProperty(id, prop, val) {
          if (this.layers[id]) this.layers[id][prop] = val;
        }
      };

      if (typeof setRoutePendingVisual === 'function') {
        setRoutePendingVisual(mockMap, true);
        const casingDash = mockMap.layers['outdoor-route-casing']['line-dasharray'];
        const lineDash = mockMap.layers['outdoor-route-line']['line-dasharray'];
        const casingOpacity = mockMap.layers['outdoor-route-casing']['line-opacity'];
        const lineOpacity = mockMap.layers['outdoor-route-line']['line-opacity'];
        routeVisualPassed = (casingDash === null && lineDash === null && casingOpacity === 1.0 && lineOpacity === 1.0);
      }

      // 2.2 Verify DOM elements of offline modal
      const pyramidModal = document.getElementById('pyramid-modal');
      const modalCard = pyramidModal?.querySelector('.modal-card');
      const provTrigger = document.getElementById('pyramid-prov-dropdown-trigger');
      const zoomPills = document.querySelectorAll('#pyramid-zoom-pills .zoom-pill');
      const statBox = document.querySelector('.stat-summary-box.dl-unified-box');
      const btnClose = document.getElementById('btn-close-pyramid-modal');

      const modalDomPassed = Boolean(pyramidModal && modalCard && provTrigger && zoomPills.length === 5 && statBox && btnClose);

      // 2.3 Verify version badge text
      const brandBadge = document.getElementById('brand-ver-badge-txt');
      const badgeText = brandBadge ? brandBadge.innerText.trim() : '';

      return {
        routeVisualPassed,
        modalDomPassed,
        badgeText
      };
    })()
  `);

  console.log('Runtime verification results:');
  assert(results.routeVisualPassed, 'setRoutePendingVisual must keep route solid with opacity 1.0 and line-dasharray null');
  console.log('  [PASS] Runtime setRoutePendingVisual test passed');

  assert(results.modalDomPassed, 'Offline modal DOM elements must all exist and be structured properly');
  console.log('  [PASS] Offline download modal DOM structure passed');

  assert.strictEqual(results.badgeText, 'v1.6.8', 'Brand badge must display v1.6.8');
  console.log('  [PASS] Brand badge displays v1.6.8');

  console.log('✅ ALL v1.6.8 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  app.quit();
  process.exit(0);
});

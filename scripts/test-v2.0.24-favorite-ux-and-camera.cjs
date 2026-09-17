const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false
    }
  });

  try {
    console.log('--- Starting v2.0.24 Camera, MaxZoom & Favorite UX Test ---');

    // 1. Static file audits for Camera & Zoom
    const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    const locCamJs = fs.readFileSync(path.join(__dirname, '../src/location-camera.js'), 'utf8');
    const styleCss = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

    // MaxZoom audit
    assert(appJs.includes('maxZoom: 16'), 'app.js must configure maxZoom: 16');
    assert(!appJs.includes('maxZoom: 17'), 'app.js must not configure maxZoom: 17');
    assert(appJs.includes('clusterMaxZoom: 15'), 'app.js must configure clusterMaxZoom: 15');

    // Location camera default fallback zoom audit
    assert(locCamJs.includes('Number.isFinite(options.zoom) ? options.zoom : 12'),
      'location-camera.js default zoom fallback must be 12');
    assert(appJs.includes('zoom: flyOpts.zoom || 12.0'),
      'flyToLocationPrecisely default zoom must be 12.0');
    assert(appJs.includes('let routeStartZoom = 12.0;'),
      'routeStartZoom must default to 12.0');
    assert(appJs.includes('let routeEndZoom = 12.0;'),
      'routeEndZoom must default to 12.0');

    // Right-click flash fix audit
    assert(appJs.includes("if (map.getLayer('outmap-favorite-icons') &&") &&
           appJs.includes("map.queryRenderedFeatures(e.point, { layers: ['outmap-favorite-icons'] }).length) return;"),
      'map.on contextmenu must intercept outmap-favorite-icons to prevent general menu flashing');

    // CSS audit
    assert(styleCss.includes('.fav-hover-tooltip'), 'style.css must define .fav-hover-tooltip');
    assert(styleCss.includes('pointer-events: none !important;'), '.fav-hover-tooltip must have pointer-events: none');

    console.log('✅ Static file & architectural assertions passed');

    // 2. Headless App Runtime E2E verification
    await win.loadFile(path.join(__dirname, '../src/index.html'));
    await win.webContents.executeJavaScript(`
      new Promise(resolve => {
        const check = () => {
          if (typeof mapInstance !== 'undefined' && mapInstance && mapInstance.__outmapStyleReady) {
            resolve(true);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      })
    `);

    const runtimeResults = await win.webContents.executeJavaScript(`
      (async () => {
        const map = mapInstance;
        const results = {};

        // (1) Check map maxZoom runtime
        results.mapMaxZoom = map.getMaxZoom();

        // (2) Add a test favorite point
        const testFav = {
          id: 'test-fav-1001',
          name: '四姑娘山大峰营地',
          type: 'camp',
          lng: 102.85,
          lat: 31.05,
          ele: 4350,
          folder: 'default'
        };
        savedWaypoints.push(testFav);
        if (typeof renderFavoritesList === 'function') renderFavoritesList();
        if (map.getSource('outmap-favorites')) {
          map.getSource('outmap-favorites').setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              id: testFav.id,
              geometry: { type: 'Point', coordinates: [testFav.lng, testFav.lat] },
              properties: { id: testFav.id, name: testFav.name, type: testFav.type, ele: testFav.ele }
            }]
          });
        }

        // (3.1) Test Tooltip DOM generation and visibility
        const testPoint = { x: 400, y: 300 };
        const testFeature = {
          id: testFav.id,
          geometry: { type: 'Point', coordinates: [testFav.lng, testFav.lat] },
          properties: { id: testFav.id, name: testFav.name, type: testFav.type, ele: testFav.ele }
        };

        // Test showFavoriteTooltip directly and via state
        window.showFavoriteTooltip(testFeature, testPoint);

        await new Promise(r => setTimeout(r, 60));
        const tooltipEl = document.getElementById('fav-hover-tooltip');
        results.tooltipExists = !!tooltipEl;
        results.tooltipVisible = tooltipEl ? tooltipEl.classList.contains('visible') : false;
        results.tooltipText = tooltipEl ? tooltipEl.textContent : '';
        results.tooltipHasEle = tooltipEl ? tooltipEl.textContent.includes('4350m') : false;
        results.tooltipHasName = tooltipEl ? tooltipEl.textContent.includes('四姑娘山大峰营地') : false;

        // (3.2) Test Anti-Flicker DOM reuse (same feature should NOT destroy/recreate DOM child nodes)
        const firstChildBefore = tooltipEl.firstElementChild;
        window.showFavoriteTooltip(testFeature, { x: 405, y: 302 });
        const firstChildAfter = tooltipEl.firstElementChild;
        results.domReusedForSameFeature = (firstChildBefore === firstChildAfter);

        // (3.3) Test Right Click Dismissal & Menu Mutex
        // Show menu and verify tooltip is dismissed and blocked
        window.showChangeWaypointTypeMenu(testFav, 400, 300);
        await new Promise(r => setTimeout(r, 50));
        results.tooltipClosedOnMenuOpen = tooltipEl.style.display === 'none' || !tooltipEl.classList.contains('visible');

        // While menu is open, showFavoriteTooltip should refuse to show
        window.showFavoriteTooltip(testFeature, testPoint);
        await new Promise(r => setTimeout(r, 50));
        results.tooltipRefusedWhileMenuOpen = tooltipEl.style.display === 'none';

        // Close menu
        document.querySelectorAll('.fav-point-type-menu').forEach(m => m.remove());

        // Test hideFavoriteTooltip
        window.hideFavoriteTooltip();
        await new Promise(r => setTimeout(r, 40));
        results.tooltipHiddenAfterLeave = tooltipEl ? (tooltipEl.style.display === 'none' || !tooltipEl.classList.contains('visible')) : false;

        // (4) Test Right Click contextmenu interception
        const origQuery = map.queryRenderedFeatures;
        map.queryRenderedFeatures = (p, opt) => {
          if (opt && opt.layers && opt.layers.includes('outmap-favorite-icons')) {
            return [testFeature];
          }
          return origQuery.call(map, p, opt);
        };

        // Fire map contextmenu on the favorite icon point
        map.fire('contextmenu', {
          point: testPoint,
          lngLat: { lng: 102.85, lat: 31.05 },
          originalEvent: { clientX: 400, clientY: 300, preventDefault: () => {} }
        });

        await new Promise(r => setTimeout(r, 60));
        const ctxMenu = document.getElementById('map-context-menu');
        const isGeneralMenuOpen = ctxMenu && ctxMenu.style.display !== 'none' && ctxMenu.classList.contains('ctx-opening');

        results.generalMenuBlocked = !isGeneralMenuOpen;

        // Restore query
        map.queryRenderedFeatures = origQuery;

        return results;
      })()
    `);

    console.log('Runtime test results:', runtimeResults);

    assert.strictEqual(runtimeResults.mapMaxZoom, 16, 'Runtime map maxZoom must be 16');
    assert.strictEqual(runtimeResults.tooltipExists, true, 'Hover tooltip element must exist in DOM');
    assert.strictEqual(runtimeResults.tooltipHasName, true, 'Tooltip must display favorite point name');
    assert.strictEqual(runtimeResults.tooltipHasEle, true, 'Tooltip must display elevation text');
    assert.strictEqual(runtimeResults.domReusedForSameFeature, true, 'DOM nodes must be reused on mousemove to avoid flickering');
    assert.strictEqual(runtimeResults.tooltipClosedOnMenuOpen, true, 'Tooltip must be closed when right-click menu opens');
    assert.strictEqual(runtimeResults.tooltipRefusedWhileMenuOpen, true, 'Tooltip must not show while right-click menu is open');
    assert.strictEqual(runtimeResults.tooltipHiddenAfterLeave, true, 'Tooltip must hide on mouseleave');
    assert.strictEqual(runtimeResults.generalMenuBlocked, true, 'General context menu must be blocked on favorite points');

    console.log('✅ ALL v2.0.24 Camera, MaxZoom & Favorite UX TESTS PASSED!');
    app.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    app.exit(1);
  }
});

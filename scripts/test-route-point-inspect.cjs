const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJsSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const styleCssSource = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

// Ensure syntax validity
new Function(appJsSource);

const watchdog = setTimeout(() => {
  console.error('Route point inspect test timed out');
  process.exit(1);
}, 45000);

const check = (value, message) => {
  if (!value) throw new Error(message);
};

async function run() {
  console.log('[Route Point Inspect Test] Starting test suite...');

  // 1. Static CSS checks
  check(styleCssSource.includes('.route-point-inspect-card'), 'style.css missing .route-point-inspect-card');
  check(styleCssSource.includes('.inspect-role-badge'), 'style.css missing .inspect-role-badge');
  check(styleCssSource.includes('.inspect-metrics-grid'), 'style.css missing .inspect-metrics-grid');
  check(styleCssSource.includes('.inspect-btn'), 'style.css missing .inspect-btn');
  check(styleCssSource.includes('body.dark-mode .route-point-inspect-card'), 'style.css missing dark mode for inspect card');

  // 2. Static JS checks
  check(appJsSource.includes('showRoutePointInspectCard'), 'app.js missing showRoutePointInspectCard');
  check(appJsSource.includes('hideRoutePointInspectCard'), 'app.js missing hideRoutePointInspectCard');
  check(appJsSource.includes('computeRouteCumulativeDistance'), 'app.js missing computeRouteCumulativeDistance');
  check(appJsSource.includes('savePointToFavorites'), 'app.js missing savePointToFavorites');
  check(appJsSource.includes('_outmapHandled'), 'app.js missing _outmapHandled event isolation');

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });

  await win.loadFile(path.join(root, 'src', 'index.html'));

  await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (window.mapInstance?.__outmapStyleReady && window.showRoutePointInspectCard) return resolve(true);
      if (performance.now() - started > 15000) return reject(new Error('map initialization timeout'));
      setTimeout(poll, 50);
    };
    poll();
  })`);

  // Test 1: computeRouteCumulativeDistance
  const distanceTest = await win.webContents.executeJavaScript(`(() => {
    const testCoords = [
      [120.0, 30.0],
      [120.0, 30.1],
      [120.0, 30.2],
      [120.0, 30.3]
    ];
    const d0 = window.computeRouteCumulativeDistance(testCoords, 0);
    const d1 = window.computeRouteCumulativeDistance(testCoords, 1);
    const d3 = window.computeRouteCumulativeDistance(testCoords, 3);
    const dCoord = window.computeRouteCumulativeDistance(testCoords, [120.0, 30.2]);

    return {
      d0Correct: d0 === 0,
      d1Positive: d1 > 10 && d1 < 12, // 0.1 degree lat is ~11.1km
      d3Increasing: d3 > d1 * 2.8 && d3 < d1 * 3.2,
      dCoordMatches: Math.abs(dCoord - (d1 * 2)) < 0.5
    };
  })()`);
  check(distanceTest.d0Correct, 'd0 should be 0');
  check(distanceTest.d1Positive, 'd1 should be ~11km');
  check(distanceTest.d3Increasing, 'd3 should be ~33km');
  check(distanceTest.dCoordMatches, 'coord query should match distance');
  console.log('✓ computeRouteCumulativeDistance validated');

  // Test 2: Show inspection card for start point without opening edit panel
  const startCardTest = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    const routePanel = document.getElementById('route-panel');
    const wasOpen = routePanel && routePanel.style.display !== 'none';

    window.showRoutePointInspectCard(map, {
      role: 'start',
      coords: [120.155, 30.274],
      name: '杭州西湖'
    });

    const card = document.querySelector('.route-point-inspect-card');
    const badge = card?.querySelector('.inspect-role-badge');
    const nameEl = card?.querySelector('.inspect-card-name');
    const isOpenNow = routePanel && routePanel.style.display !== 'none';

    return {
      cardExists: Boolean(card),
      badgeText: badge?.innerText?.trim(),
      nameText: nameEl?.innerText?.trim(),
      panelStayedClosed: wasOpen === isOpenNow
    };
  })()`);
  check(startCardTest.cardExists, 'inspect card element must exist in DOM');
  check(startCardTest.badgeText === '起点', `badge text should be 起点, got ${startCardTest.badgeText}`);
  check(startCardTest.nameText === '杭州西湖', `name should be 杭州西湖, got ${startCardTest.nameText}`);
  check(startCardTest.panelStayedClosed, 'route panel must not unexpectedly change open/closed state on point inspection');
  console.log('✓ Start point inspection card validated (no edit panel jump)');

  // Test 3: Show inspection card for track point with 'Set as Via Point' button
  const trackCardTest = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    window.showRoutePointInspectCard(map, {
      role: 'track',
      coords: [120.200, 30.300],
      progress: 1.5,
      name: '路线上的点'
    });

    const card = document.querySelector('.route-point-inspect-card');
    const badge = card?.querySelector('.inspect-role-badge');
    const addViaBtn = card?.querySelector('.btn-inspect-add-via');
    const favBtn = card?.querySelector('.btn-inspect-fav');

    return {
      badgeText: badge?.innerText?.trim(),
      hasAddViaBtn: Boolean(addViaBtn),
      hasFavBtn: Boolean(favBtn)
    };
  })()`);
  check(trackCardTest.badgeText === '路线点', `badge text should be 路线点, got ${trackCardTest.badgeText}`);
  check(trackCardTest.hasAddViaBtn, 'track inspection card must have 设为途径点 button');
  check(trackCardTest.hasFavBtn, 'track inspection card must have 收藏 button');
  console.log('✓ Track point inspection card validated');

  // Test 4: hideRoutePointInspectCard and map background click
  const hideCardTest = await win.webContents.executeJavaScript(`(() => {
    window.hideRoutePointInspectCard();
    const card = document.querySelector('.route-point-inspect-card');
    return {
      isNotVisible: !card || !card.classList.contains('visible')
    };
  })()`);
  check(hideCardTest.isNotVisible, 'card must not have visible class after hideRoutePointInspectCard');
  console.log('✓ hideRoutePointInspectCard validated');

  // Test 5: savePointToFavorites
  const favSaveTest = await win.webContents.executeJavaScript(`(() => {
    const prevCount = (window.getSavedWaypoints ? window.getSavedWaypoints() : []).length;
    const newWp = window.savePointToFavorites({
      lng: 120.123,
      lat: 30.456,
      ele: 350,
      name: '测试观景台'
    });
    const nextCount = (window.getSavedWaypoints ? window.getSavedWaypoints() : []).length;
    return {
      countIncreased: nextCount === prevCount + 1,
      nameMatches: newWp?.name === '测试观景台',
      eleMatches: newWp?.ele === 350
    };
  })()`);
  check(favSaveTest.countIncreased, 'savedWaypoints count must increase by 1');
  check(favSaveTest.nameMatches, 'saved waypoint name must match');
  check(favSaveTest.eleMatches, 'saved waypoint elevation must match');
  console.log('✓ savePointToFavorites validated');

  // Test 6: Viewing mode zero-toast and flight auto-dismiss
  const viewingModeTest = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    let toastCount = 0;
    const origToast = window.showToast;
    window.showToast = (msg) => {
      if (msg && msg.includes('浏览模式')) toastCount++;
      if (origToast) origToast(msg);
    };

    // Show card first
    window.showRoutePointInspectCard(map, {
      role: 'via',
      coords: [120.18, 30.28],
      name: '途径测试'
    });
    const cardBeforeFlight = document.querySelector('.route-point-inspect-card');
    const wasVisible = cardBeforeFlight && cardBeforeFlight.style.display !== 'none';

    // Trigger flight
    window.flyToLocationPrecisely(map, [120.18, 30.28]);
    const isDismissedOnFlight = !cardBeforeFlight || cardBeforeFlight.style.display === 'none';

    window.showToast = origToast;
    return {
      wasVisible,
      isDismissedOnFlight,
      toastCount
    };
  })()`);
  check(viewingModeTest.wasVisible, 'inspect card should be visible before flight');
  check(viewingModeTest.isDismissedOnFlight, 'inspect card must be auto-dismissed when flight begins');
  check(viewingModeTest.toastCount === 0, 'no 浏览模式 toasts should be fired');
  console.log('✓ Viewing mode zero-toast and flight auto-dismiss validated');

  clearTimeout(watchdog);
  console.log('[Route Point Inspect Test] All tests passed 100%!');
  win.close();
  app.quit();
}

app.whenReady().then(run).catch(err => {
  console.error('[Route Point Inspect Test] Failed:', err);
  process.exit(1);
});

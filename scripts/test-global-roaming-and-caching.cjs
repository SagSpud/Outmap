const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJsSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const mainJsSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

// Ensure syntax validity
new Function(appJsSource);

const watchdog = setTimeout(() => {
  console.error('Global roaming and caching test timed out');
  process.exit(1);
}, 45000);

const check = (value, message) => {
  if (!value) throw new Error(message);
};

async function run() {
  console.log('[Global Roaming & Caching Test] Starting test suite...');

  // 1. Static checks
  check(!appJsSource.includes('maxBounds: [['), 'app.js should not restrict map with maxBounds');
  check(appJsSource.includes('minZoom: 2.0'), 'app.js should allow minZoom: 2.0');
  check(appJsSource.includes('renderWorldCopies: true'), 'app.js should enable renderWorldCopies: true');
  check(appJsSource.includes('center: [104.5000, 36.0000]'), 'app.js should keep default center at [104.5, 36.0]');
  check(appJsSource.includes('zoom: 4.45'), 'app.js should keep default zoom at 4.45');
  check(!mainJsSource.includes('non-china-highzoom-blocked'), 'main.js should not block non-China highzoom tiles');
  check(!mainJsSource.includes('bbox=73.5,18.0,135.1,53.6'), 'main.js search should not be restricted to China bbox');
  console.log('✓ Static code assertions verified');

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
      if (window.mapInstance?.__outmapStyleReady && window.resolveLocationInfo) return resolve(true);
      if (performance.now() - started > 15000) return reject(new Error('map initialization timeout'));
      setTimeout(poll, 50);
    };
    poll();
  })`);

  // Test 2: Initial view verification
  const initialViewTest = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const maxBounds = map.getMaxBounds();
    const minZoom = map.getMinZoom();

    return {
      centerLng: center.lng,
      centerLat: center.lat,
      centerOk: Math.abs(center.lng - 104.5) < 0.1 && Math.abs(center.lat - 36.0) < 0.1,
      zoomOk: Math.abs(zoom - 4.45) < 0.1,
      noMaxBounds: !maxBounds,
      minZoomOk: minZoom <= 2.0
    };
  })()`);
  check(initialViewTest.centerOk, `initial center should be ~[104.5, 36.0], got [${initialViewTest.centerLng}, ${initialViewTest.centerLat}]`);
  check(initialViewTest.zoomOk, `initial zoom should be ~4.45, got ${initialViewTest.zoom}`);
  check(initialViewTest.noMaxBounds, 'map should not have maxBounds restriction');
  check(initialViewTest.minZoomOk, 'minZoom should be <= 2.0');
  console.log('✓ Initial view and unlocked camera bounds validated');

  // Test 3: Pan to outside China (Tokyo & Alps) without bounce-back
  const panTest = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    // Pan to Tokyo [139.6917, 35.6895]
    map.jumpTo({ center: [139.6917, 35.6895], zoom: 12.0 });
    const tokyoCenter = map.getCenter();

    // Pan to Alps [7.75, 45.97]
    map.jumpTo({ center: [7.75, 45.97], zoom: 11.0 });
    const alpsCenter = map.getCenter();

    // Reset back to default
    map.jumpTo({ center: [104.5, 36.0], zoom: 4.45 });

    return {
      tokyoReached: Math.abs(tokyoCenter.lng - 139.6917) < 0.05 && Math.abs(tokyoCenter.lat - 35.6895) < 0.05,
      alpsReached: Math.abs(alpsCenter.lng - 7.75) < 0.05 && Math.abs(alpsCenter.lat - 45.97) < 0.05
    };
  })()`);
  check(panTest.tokyoReached, 'map should be able to pan to Tokyo without bounce-back');
  check(panTest.alpsReached, 'map should be able to pan to Alps without bounce-back');
  console.log('✓ Unrestricted global panning validated');

  // Test 4: resolveLocationInfo handles global locations without false Chinese cities
  const locationResolveTest = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    // Test location far away in Tokyo
    const tokyoName = window.resolveLocationInfo(map, { lng: 139.6917, lat: 35.6895 }, { x: 400, y: 300 }, true);
    // Test location in Paris
    const parisName = window.resolveLocationInfo(map, { lng: 2.3522, lat: 48.8566 }, { x: 400, y: 300 }, true);
    // Test location in Chengdu (China)
    const chengduName = window.resolveLocationInfo(map, { lng: 104.0665, lat: 30.5723 }, { x: 400, y: 300 }, true);

    return {
      tokyoNotChinaCity: !tokyoName.includes('哈密') && !tokyoName.includes('延边'),
      parisNotChinaCity: !parisName.includes('喀什') && !parisName.includes('阿勒泰'),
      chengduOk: chengduName.includes('成都市') || chengduName.includes('成都')
    };
  })()`);
  check(locationResolveTest.tokyoNotChinaCity, 'Tokyo should not be assigned an arbitrary Chinese city name');
  check(locationResolveTest.parisNotChinaCity, 'Paris should not be assigned an arbitrary Chinese city name');
  check(locationResolveTest.chengduOk, 'Chengdu should still correctly resolve to Chengdu');
  console.log('✓ Location info resolution for global & domestic validated');

  clearTimeout(watchdog);
  console.log('[Global Roaming & Caching Test] All tests passed 100%!');
  try { win.destroy(); } catch (_) {}
  setTimeout(() => {
    process.exit(0);
  }, 100);
}

app.whenReady().then(run).catch(err => {
  console.error('[Global Roaming & Caching Test] Failed:', err);
  process.exit(1);
});

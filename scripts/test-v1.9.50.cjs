const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });
if (!/opacityWhenCovered:\s*['"]1['"]/.test(sourceText)) {
  throw new Error('Search landing marker must remain fully visible when covered by 3D terrain');
}
if (!/subpixelPositioning:\s*true/.test(sourceText)) {
  throw new Error('Search landing marker must use subpixel positioning on high-DPI displays');
}

const watchdog = setTimeout(() => app.exit(1), 30000);
app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({ show: false, width: 1200, height: 800,
      webPreferences: { offscreen: true, backgroundThrottling: false } });
    await win.loadFile(path.join(root, 'src/index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'Map style did not initialize');
      check(window.OUTMAP_APP_VERSION === '1.9.50', 'Version mismatch: ' + window.OUTMAP_APP_VERSION);
      window.showLandingMarker([101.3451, 30.06], 'G318熊猫大道', '四川省');
      await sleep(100);
      const marker = window.currentLandingMarker;
      check(marker, 'Search landing marker was not created');
      check(String(marker._opacityWhenCovered) === '1', '3D terrain still fades the search card');
      check(marker.getElement()?.classList.contains('landing-pulse-marker'), 'Landing marker UI is missing');
      const anchor = window.OutmapLocationCamera.anchor(map, false);
      const rect = map.getContainer().getBoundingClientRect();
      const expectedY = 44 + (rect.height - 44) * 0.68;
      check(Math.abs(anchor.y - expectedY) < 1, 'Search target is not at the intended lower-center anchor');
      window.clearLandingMarker();
      return { terrainOpacity: marker._opacityWhenCovered, subpixel: marker._subpixelPositioning,
        anchorRatio: Number((anchor.y / rect.height).toFixed(3)) };
    })()`);
    console.log('v1.9.50 3D search landing-card regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('v1.9.50 test failed:', error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

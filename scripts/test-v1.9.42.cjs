const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appJsText = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const htmlText = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
new vm.Script(appJsText, { filename: 'src/app.js' });
if (htmlText.includes('map-performance.js')) throw new Error('Retired map-performance script is still loaded');
if (/\.setPixelRatio\s*\(/.test(appJsText)) throw new Error('Runtime must not reduce native DPR');

const watchdog = setTimeout(() => {
  console.error('Test timed out (watchdog fired)');
  app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 720,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'src/index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const check = (ok, msg) => { if (!ok) throw new Error(msg); };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      const map = window.mapInstance;
      check(map?.__outmapStyleReady, 'Map style did not initialize');
      check(window.OUTMAP_APP_VERSION >= '1.9.42', 'Version mismatch: ' + window.OUTMAP_APP_VERSION);
      const initialDpr = typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : 1;
      map.fire('movestart');
      for (let i = 0; i < 10; i++) { map.fire('render'); await sleep(15); }
      check((typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : 1) === initialDpr,
        'DPR must remain native during movement');
      for (const id of ['osm-all-pois', 'osm-all-pois-dots', 'outmap-favorite-icons']) {
        if (map.getLayer(id)) check(map.getLayoutProperty(id, 'visibility') !== 'none', id + ' must stay visible');
      }
      map.fire('moveend');
      await sleep(220);
      check((typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : 1) === initialDpr,
        'DPR must remain native after moveend');
      return { dprNeverDegraded: true, iconLayersAlwaysVisible: true, retiredControllerRemoved: !window.OutmapMapPerformance };
    })()`);
    if (!result.retiredControllerRemoved) throw new Error('Retired controller leaked into runtime');
    console.log('v1.9.42 native motion and icon stability regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('v1.9.42 test failed:', error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

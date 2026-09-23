const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const watchdog = setTimeout(() => {
  console.error('v2.0.76 input recovery test timed out');
  process.exit(1);
}, 45000);

async function run() {
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
      if (window.mapInstance?.__outmapStyleReady && window.recoverTransientInputState) return resolve(true);
      if (performance.now() - started > 15000) return reject(new Error('map initialization timeout'));
      setTimeout(poll, 50);
    };
    poll();
  })`);

  const result = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;
    const favoriteTabs = document.getElementById('fav-folder-tabs');
    let favoriteSortCancelled = false;
    favoriteTabs._cancelSort = () => { favoriteSortCancelled = true; };
    document.body.classList.add('map-is-dragging', 'route-point-is-dragging', 'map-is-moving', 'sorting-folders');

    const rows = document.createElement('div');
    rows.className = 'is-route-reordering';
    const row = document.createElement('div');
    row.className = 'is-dragging is-settling';
    row.style.transform = 'translate3d(0, 80px, 0)';
    rows.appendChild(row);
    document.body.appendChild(rows);

    const ghost = document.createElement('div');
    ghost.className = 'folder-drag-preview';
    document.body.appendChild(ghost);
    const drop = document.createElement('div');
    drop.className = 'track-drop-overlay active';
    document.body.appendChild(drop);
    const stalePrompt = document.createElement('div');
    stalePrompt.className = 'fluent-prompt-overlay prompt-closing';
    document.body.appendChild(stalePrompt);

    let disableCalls = 0;
    let enableCalls = 0;
    const handler = map.dragPan;
    const originalDisable = handler.disable.bind(handler);
    const originalEnable = handler.enable.bind(handler);
    handler.disable = (...args) => { disableCalls++; return originalDisable(...args); };
    handler.enable = (...args) => { enableCalls++; return originalEnable(...args); };

    window.recoverTransientInputState(map, { resetHandlers: true });
    handler.disable = originalDisable;
    handler.enable = originalEnable;

    const outcome = {
      bodyClean: !['map-is-dragging', 'route-point-is-dragging', 'map-is-moving', 'sorting-folders']
        .some(name => document.body.classList.contains(name)),
      routeRowsClean: !rows.classList.contains('is-route-reordering')
        && !row.classList.contains('is-dragging')
        && !row.classList.contains('is-settling')
        && row.style.transform === '',
      ghostRemoved: !ghost.isConnected,
      dropClosed: !drop.classList.contains('active'),
      stalePromptRemoved: !stalePrompt.isConnected,
      handlerReset: disableCalls > 0 && enableCalls > 0 && map.dragPan.isEnabled(),
      favoriteSortCancelled
    };
    rows.remove();
    drop.remove();
    return outcome;
  })()`);

  for (const [name, passed] of Object.entries(result)) {
    if (!passed) throw new Error(`input recovery assertion failed: ${name}`);
  }
  console.log('v2.0.76 long-running/background input recovery passed:', result);
  win.destroy();
}

app.whenReady().then(run).then(() => {
  clearTimeout(watchdog);
  app.quit();
}).catch(error => {
  clearTimeout(watchdog);
  console.error(error);
  app.exit(1);
});

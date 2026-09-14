const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceText = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
new vm.Script(sourceText, { filename: 'src/app.js' });

const watchdog = setTimeout(() => {
  console.error('v2.0.4 route rename test timed out');
  app.exit(1);
}, 40000);

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 720,
      webPreferences: { offscreen: true, backgroundThrottling: false }
    });
    await win.loadFile(path.join(root, 'src', 'index.html'));

    const result = await win.webContents.executeJavaScript(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (value, message) => { if (!value) throw new Error(message); };
      const versionAtLeast = (actual, minimum) => {
        const current = String(actual).split('.').map(Number);
        const required = String(minimum).split('.').map(Number);
        for (let i = 0; i < Math.max(current.length, required.length); i++) {
          const left = current[i] || 0;
          const right = required[i] || 0;
          if (left !== right) return left > right;
        }
        return true;
      };
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      check(window.mapInstance?.__outmapStyleReady, 'map did not initialize');
      check(versionAtLeast(window.OUTMAP_APP_VERSION, '2.0.4'), 'version mismatch');

      localStorage.removeItem('outmap_user_account');
      savedRoutes = [{
        id: 'route_rename_204',
        name: '旧路线名称',
        mode: 'drive',
        timestamp: 1000,
        updatedAt: 1000,
        start: { coords: [118, 35], name: '起点' },
        end: { coords: [118.1, 35.1], name: '终点' },
        pathCoords: [[118, 35], [118.1, 35.1]],
        metrics: { distKm: 12 }
      }];
      localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));

      renderSavedRoutesListFn();

      const card = document.querySelector('.fav-route-card');
      check(card, 'saved route card missing');
      card.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: 200, clientY: 220
      }));
      const renameButton = document.querySelector('.fav-route-context-menu .btn-ctx-rename');
      check(renameButton, 'rename menu item missing');
      check(renameButton.textContent.trim() === '重命名', 'rename menu label must be concise');
      renameButton.click();

      const prompt = document.querySelector('.fluent-prompt-overlay');
      const input = prompt?.querySelector('.fluent-prompt-input');
      check(input, 'rename prompt missing');
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      input.value = '川西秋季环线';
      input.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', isComposing: true
      }));
      await sleep(30);
      check(document.querySelector('.fluent-prompt-overlay') === prompt,
        'IME candidate Enter must not submit or close the prompt');
      check(JSON.parse(localStorage.getItem('outmap_saved_routes'))[0].name === '旧路线名称',
        'IME candidate Enter changed route prematurely');

      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '川西秋季环线' }));
      input.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'Enter', code: 'Enter'
      }));
      await sleep(220);

      const persisted = JSON.parse(localStorage.getItem('outmap_saved_routes'));
      check(savedRoutes[0].name === '川西秋季环线', 'runtime route name did not update');
      check(persisted[0].name === '川西秋季环线', 'persisted route name did not update');
      check(Number(persisted[0].updatedAt) > 1000, 'rename timestamp did not advance');
      check(document.querySelector('.fav-route-name')?.textContent === '川西秋季环线',
        'route list did not rerender with new name');
      return {
        menuLabel: renameButton.textContent.trim(),
        renamed: persisted[0].name,
        imeCandidateEnterIgnored: true,
        persistedBeforeRender: true
      };
    })()`);

    console.log('v2.0.4 route rename regression passed:', result);
    clearTimeout(watchdog);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error('v2.0.4 route rename test failed:', error);
    clearTimeout(watchdog);
    if (win) win.destroy();
    app.exit(1);
  }
});

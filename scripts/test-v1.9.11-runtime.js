const assert = require('assert');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const watchdog = setTimeout(() => app.exit(1), 30000);
const complete = (expected, present = expected) => ({ expected, present, complete: present >= expected });
const inventory = {
  inventoryVersion: 4,
  stats: { totalTiles: 42, totalBytes: 1024, lastScannedAt: Date.now() },
  provinces: {
    anhui: {
      maxZ: 10,
      partialZ: 11,
      dem: true,
      vec: true,
      layers: {
        dem: { levels: { 10: complete(10), 11: complete(20, 2) } },
        vector: { levels: { 10: complete(10), 11: complete(20, 3) } }
      }
    }
  }
};

ipcMain.handle('get-tile-server-info', () => ({ port: 28795, ...inventory.stats }));
ipcMain.handle('get-offline-manifest', () => inventory);
ipcMain.handle('rescan-offline-tiles', () => inventory.stats);
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('pull-cloud-sync-data', () => ({ success: true, data: null }));
ipcMain.handle('upload-cloud-sync-data', () => ({ success: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 760,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.mapInstance || !window.openPyramidModal || !window.refreshOfflineProvinceGrid) await sleep(25);
    await window.openPyramidModal();
    await sleep(40);

    const checked = () => Array.from(document.querySelectorAll('#pyramid-prov-multi-grid input:checked')).map(el => el.value);
    const province = key => document.querySelector('.prov-chip-item[data-key="' + key + '"]');
    const initialChecked = checked();
    const anhuiAtL10 = province('anhui');
    const l10Class = anhuiAtL10?.className || '';
    const l10Badge = anhuiAtL10?.querySelector('.prov-chip-badge')?.innerText || '';

    const anhuiInput = anhuiAtL10?.querySelector('input');
    anhuiInput.checked = true;
    anhuiInput.dispatchEvent(new Event('change', { bubbles: true }));
    window.refreshOfflineProvinceGrid();
    const afterRefresh = checked();

    document.querySelector('.zoom-pill[data-value="11"]')?.click();
    const l11Class = province('anhui')?.className || '';
    const l11DotClass = document.getElementById('zoom-dot-11')?.className || '';

    document.getElementById('btn-prov-select-none')?.click();
    window.refreshOfflineProvinceGrid();
    const afterClearRefresh = checked();
    return { initialChecked, l10Class, l10Badge, afterRefresh, l11Class, l11DotClass, afterClearRefresh };
  })()`);

  console.log('v1.9.11 runtime result:', result);
  assert.deepStrictEqual(result.initialChecked, [], 'nationwide view must not auto-select Gansu or another province');
  assert(result.l10Class.includes('ready-full'), 'complete L10 must be green even when L11 contains partial tiles');
  assert.strictEqual(result.l10Badge, 'L10');
  assert.deepStrictEqual(result.afterRefresh, ['anhui'], 'inventory refresh must preserve the explicit province selection');
  assert(result.l11Class.includes('ready-partial'), 'the same province must be blue at its partial L11 target');
  assert(result.l11DotClass.includes('partial'), 'selected L11 level indicator must be blue while incomplete');
  assert.deepStrictEqual(result.afterClearRefresh, [], 'an explicit clear must remain empty after refresh');
  clearTimeout(watchdog);
  win.destroy();
  app.exit(0);
}).catch(error => {
  clearTimeout(watchdog);
  console.error(error);
  app.exit(1);
});

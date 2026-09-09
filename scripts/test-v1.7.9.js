const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('v1.7.9 test timed out after 30s');
  app.exit(1);
}, 30000);

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

// Mock IPC
ipcMain.handle('get-tile-server-info', () => ({ port: 28795, totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-status', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('get-offline-manifest', () => ({
  inventoryVersion: 3,
  stats: { totalTiles: 50000, totalBytes: 100000000 },
  provinces: {
    beijing: {
      maxZ: 14,
      partialZ: 14,
      dem: true,
      vec: true,
      layers: {
        dem: {
          levels: {
            10: { expected: 72, present: 72, complete: true },
            11: { expected: 255, present: 255, complete: true },
            12: { expected: 960, present: 960, complete: true },
            13: { expected: 3654, present: 3654, complete: true },
            14: { expected: 14490, present: 14490, complete: true }
          }
        },
        vector: {
          levels: {
            10: { expected: 72, present: 72, complete: true },
            11: { expected: 255, present: 255, complete: true },
            12: { expected: 960, present: 960, complete: true },
            13: { expected: 3654, present: 3654, complete: true },
            14: { expected: 14490, present: 14490, complete: true }
          }
        }
      }
    },
    shanghai: {
      maxZ: 12,
      partialZ: 12,
      dem: true,
      vec: true,
      layers: {
        dem: {
          levels: {
            10: { expected: 20, present: 20, complete: true },
            11: { expected: 50, present: 50, complete: true },
            12: { expected: 120, present: 120, complete: true }
          }
        },
        vector: {
          levels: {
            10: { expected: 20, present: 20, complete: true },
            11: { expected: 50, present: 50, complete: true },
            12: { expected: 120, present: 120, complete: true }
          }
        }
      }
    },
    shandong: {
      maxZ: 0,
      partialZ: 14,
      dem: false,
      vec: true,
      layers: {
        dem: { levels: { 14: { expected: 10, present: 0, complete: false } } },
        vector: { levels: { 14: { expected: 10, present: 4, complete: false } } }
      }
    }
  }
}));
ipcMain.handle('save-offline-manifest', () => ({ success: true }));
ipcMain.handle('rescan-offline-tiles', () => ({ totalTiles: 0, totalBytes: 0 }));
ipcMain.handle('search-location', () => ({ type: 'FeatureCollection', features: [] }));
ipcMain.handle('get-power-state', () => ({ powerSource: 'ac', isLowPower: false }));
ipcMain.handle('get-cloud-sync-config', () => ({ autoSync: false }));
ipcMain.handle('save-cloud-sync-config', () => ({ success: true }));
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
    while (!window.mapInstance) await sleep(25);

    // Open pyramid download modal
    document.getElementById('btn-open-pyramid-dl').click();
    await sleep(100);

    const beijing = document.querySelector('.prov-chip-item[data-key="beijing"]');
    const shanghai = document.querySelector('.prov-chip-item[data-key="shanghai"]');
    const shandong = document.querySelector('.prov-chip-item[data-key="shandong"]');
    const xizang = document.querySelector('.prov-chip-item[data-key="xizang"]');

    const beijingBadge = beijing?.querySelector('.prov-chip-badge');
    const shanghaiBadge = shanghai?.querySelector('.prov-chip-badge');
    const shandongBadge = shandong?.querySelector('.prov-chip-badge');
    const xizangBadge = xizang?.querySelector('.prov-chip-badge');

    // Select Beijing alone and check zoom dots
    document.getElementById('btn-prov-select-none').click();
    await sleep(30);
    beijing.querySelector('input[type="checkbox"]').click();
    await sleep(50);

    const beijingDot10Class = document.getElementById('zoom-dot-10')?.className || '';
    const beijingDot14Class = document.getElementById('zoom-dot-14')?.className || '';
    const beijingStatusTagText = document.getElementById('prov-offline-status-tag')?.innerText || '';
    const beijingStatTileCount = document.getElementById('stat-tile-count')?.innerText || '';

    // Now select Shandong (partial) and check zoom dot 14
    document.getElementById('btn-prov-select-none').click();
    await sleep(30);
    shandong.querySelector('input[type="checkbox"]').click();
    await sleep(50);

    const shandongDot14Class = document.getElementById('zoom-dot-14')?.className || '';
    return {
      beijingClass: beijing?.className || '',
      beijingBadgeClass: beijingBadge?.className || '',
      beijingBadgeText: beijingBadge?.innerText || '',

      shanghaiClass: shanghai?.className || '',
      shanghaiBadgeClass: shanghaiBadge?.className || '',
      shanghaiBadgeText: shanghaiBadge?.innerText || '',

      shandongClass: shandong?.className || '',
      shandongBadgeClass: shandongBadge?.className || '',
      shandongBadgeText: shandongBadge?.innerText || '',

      xizangBadgeClass: xizangBadge?.className || '',
      xizangBadgeText: xizangBadge?.innerText || '',

      beijingDot10Class,
      beijingDot14Class,
      beijingStatusTagText,
      beijingStatTileCount,

      shandongDot14Class
    };
  })()`);

  console.log('v1.7.9 readiness verification result:', result);

  // 1. Beijing (complete L14) must be ready-full (green) with badge L14 full
  assert(result.beijingClass.includes('ready-full'), 'Completed L14 province must have ready-full class (green)');
  assert(result.beijingBadgeClass.includes('full'), 'Completed L14 badge must be full (green)');
  assert.strictEqual(result.beijingBadgeText, 'L14', 'Completed L14 badge text must be L14');

  // 2. Shanghai (complete L12) must be ready-full (green) with badge L12 full
  assert(result.shanghaiClass.includes('ready-full'), 'Completed L12 province must have ready-full class (green)');
  assert(result.shanghaiBadgeClass.includes('full'), 'Completed L12 badge must be full (green)');
  assert.strictEqual(result.shanghaiBadgeText, 'L12', 'Completed L12 badge text must be L12');

  // 3. Shandong (partial 4/10 tiles) must remain ready-partial (blue) with badge L14 partial
  assert(!result.shandongClass.includes('ready-full'), 'Partial province must not be ready-full');
  assert(result.shandongClass.includes('ready-partial'), 'Partial province must have ready-partial class (blue)');
  assert(result.shandongBadgeClass.includes('partial'), 'Partial province badge must be partial (blue)');
  assert.strictEqual(result.shandongBadgeText, 'L14', 'Partial province badge text must be L14');

  // 4. Xizang (empty) must be empty (gray)
  assert(result.xizangBadgeClass.includes('empty'), 'Undownloaded province must be empty');
  assert.strictEqual(result.xizangBadgeText, '未下载', 'Undownloaded province text must be 未下载');

  // 5. Zoom dots for completed Beijing must be ready (green)
  assert(result.beijingDot10Class.includes('ready'), 'L10 dot for complete province must be ready (green)');
  assert(result.beijingDot14Class.includes('ready'), 'L14 dot for complete province must be ready (green)');
  assert(!result.beijingDot14Class.includes('partial'), 'L14 dot for complete province must not be partial (blue)');

  // 6. Zoom dot for partial Shandong must be partial (blue)
  assert(result.shandongDot14Class.includes('partial'), 'L14 dot for partial province must be partial (blue)');
  assert(!result.shandongDot14Class.includes('ready'), 'L14 dot for partial province must not be ready (green)');

  clearTimeout(watchdog);
  console.log('✅ ALL v1.7.9 READINESS & INDICATOR CHECKS PASSED SUCCESSFULLY!');
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});

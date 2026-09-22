'use strict';

const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

assert.strictEqual(pkg.version, '2.0.67');
assert(html.includes('id="btn-storage-maintenance"'), 'storage action must exist');
assert(html.includes('<span>存储</span>'), 'storage label must be compact');
assert(html.includes('<span>更新</span>'), 'update label must be compact');
assert(html.includes('id="btn-cancel-dl" style="display: none;">停止</button>'), 'stop label must be compact');
assert(html.includes('id="btn-retry-dl" style="display: none;">校验</button>'), 'verify label must be compact');
assert(html.includes('id="btn-start-dl">下载</button>'), 'download label must be compact');
assert(!/id="btn-(?:storage-maintenance|check-tile-update)"[^>]*\btitle=/.test(html), 'footer actions must not add hover descriptions');
assert(js.includes("btnStart.innerText = '下载所选';"), 'switch-download label must be compact');
assert(js.includes("btnCancel.innerText = '停止';"), 'runtime stop label must stay compact');
assert(js.includes('<span>已最新</span>') && js.includes('<span>有更新</span>'), 'update result labels must stay compact');
assert(css.includes('white-space: nowrap;'), 'button labels must never wrap at high DPI');

const watchdog = setTimeout(() => process.exit(1), 30000);

(async () => {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, width: 1000, height: 760 });
  await win.loadFile(path.join(root, 'src', 'index.html'));
  win.webContents.setZoomFactor(2);
  await new Promise(resolve => setTimeout(resolve, 200));
  const result = await win.webContents.executeJavaScript(`(() => {
    const modal = document.getElementById('pyramid-modal');
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('visible');
    const ids = ['btn-storage-maintenance', 'btn-check-tile-update', 'btn-start-dl'];
    return ids.map(id => {
      const el = document.getElementById(id);
      const style = getComputedStyle(el);
      return { id, text: el.textContent.trim(), whiteSpace: style.whiteSpace, height: el.getBoundingClientRect().height };
    });
  })()`);
  for (const item of result) {
    assert.strictEqual(item.whiteSpace, 'nowrap', `${item.id} must not wrap at 200% zoom`);
    assert(item.height < 40, `${item.id} unexpectedly grew to ${item.height}px at 200% zoom`);
  }
  win.destroy();
  clearTimeout(watchdog);
  console.log('v2.0.67 compact download action checks passed.');
  app.quit();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
});

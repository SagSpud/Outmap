const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const styleCss = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

// 1. Static assertions
assert(styleCss.includes('flex: 0 0 148px'), 'style.css must set stat-info-col to 148px');
assert(styleCss.includes('.dl-unified-box .dl-progress-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 8px;'), 'dl-progress-header must have gap: 8px');
assert(styleCss.includes('.dl-unified-box .dl-progress-task {\n  display: block;\n  flex: 1 1 auto;\n  min-width: 0;\n  color: #1e293b;\n  font-size: 11px;\n  font-weight: 600;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}'), 'dl-progress-task must be display: block with ellipsis and min-width: 0');
assert(appJs.includes('定位缺片: ${provName}${zStr}'), 'app.js must use concise 定位缺片 text');
assert(!appJs.includes('正在定位未下载部分: ${provName}${zStr}'), 'app.js must not use overly long text');
console.log('✓ Static CSS & JS assertions verified');

const watchdog = setTimeout(() => {
  console.error('Download overlap test timed out');
  process.exit(1);
}, 30000);

async function run() {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { offscreen: true }
  });

  await win.loadFile(path.join(root, 'src', 'index.html'));

  const result = await win.webContents.executeJavaScript(`(() => {
    document.documentElement.classList.remove('web-mode');
    document.body.classList.remove('web-mode');

    const modal = document.getElementById('pyramid-modal');
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('visible');

    const progressBox = document.getElementById('dl-progress-box');
    progressBox.style.setProperty('display', 'flex', 'important');

    const task = document.getElementById('dl-progress-task');
    const pct = document.getElementById('dl-progress-pct');
    const num = document.getElementById('dl-progress-num');
    const speed = document.getElementById('dl-progress-speed');
    const sub = document.getElementById('dl-progress-subline');

    const testCases = [
      { taskText: '定位缺片: 湖北省 · L14', pctText: '定位中' },
      { taskText: '定位缺片: 新疆维吾尔自治区 · L14', pctText: '定位中' },
      { taskText: '正在下载: 内蒙古自治区 · L13', pctText: '88.5%' },
      { taskText: '增量更新: 四川省 · L14', pctText: '100%' }
    ];

    const outcomes = [];
    for (const tc of testCases) {
      task.innerText = tc.taskText;
      pct.innerText = tc.pctText;

      const rTask = task.getBoundingClientRect();
      const rPct = pct.getBoundingClientRect();
      const gap = rPct.left - rTask.right;
      const isOverlap = rTask.right > rPct.left;

      outcomes.push({
        taskText: tc.taskText,
        pctText: tc.pctText,
        taskWidth: rTask.width,
        pctWidth: rPct.width,
        gap,
        isOverlap
      });
    }

    const taskComputed = window.getComputedStyle(task);

    return {
      taskDisplay: taskComputed.display,
      taskOverflow: taskComputed.overflow,
      taskTextOverflow: taskComputed.textOverflow,
      outcomes
    };
  })()`);

  console.log('Runtime test outcomes:', JSON.stringify(result, null, 2));

  assert.strictEqual(result.taskDisplay, 'block', 'task element must be display: block');
  assert.strictEqual(result.taskTextOverflow, 'ellipsis', 'task element must have text-overflow: ellipsis');

  for (const outcome of result.outcomes) {
    assert(!outcome.isOverlap, `Text overlap detected for: ${outcome.taskText}`);
    assert(outcome.gap >= 7.5, `Gap between task and pct must be >= 7.5px, got ${outcome.gap}px`);
    assert(outcome.pctWidth > 0, `Percentage width must be > 0`);
  }

  clearTimeout(watchdog);
  console.log('✓ All download progress overlap and layout tests passed 100%!');
  try { win.destroy(); } catch (_) {}
  process.exit(0);
}

app.whenReady().then(run).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

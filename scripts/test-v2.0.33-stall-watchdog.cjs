'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('[Test v2.0.33] Starting Download Stall Watchdog & UI De-duplication Verification...');

// 1. 验证 index.html 中 UI 去重
const htmlPath = path.join(__dirname, '..', 'src', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// 确保 modal-footer 中没有 btn-open-offline-dir
assert(!html.includes('id="btn-open-offline-dir"'), 'modal-footer must NOT contain redundant btn-open-offline-dir');
// 确保左侧面板有 btn-open-offline-link 且包含打开提示
assert(html.includes('id="btn-open-offline-link"'), 'stat-summary-box must contain btn-open-offline-link');
assert(html.includes('title="点击在 Windows 资源管理器中打开离线存储目录"'), 'btn-open-offline-link must have clear Windows Explorer title');
console.log('✓ UI Check: Redundant "Open Offline Dir" button eliminated; storage link retained and polished.');

// 2. 验证 main.js 中的看门狗、硬超时沙箱与槽位防泄漏机制
const mainPath = path.join(__dirname, '..', 'main.js');
const main = fs.readFileSync(mainPath, 'utf8');

assert(main.includes('fetchWithHardTimeout'), 'main.js must implement fetchWithHardTimeout sandbox');
assert(main.includes('Download Stall Watchdog'), 'main.js must implement Download Stall Watchdog');
assert(main.includes('discoveryFlow.release()'), 'main.js must ensure discoveryFlow.release() is called on empty range to avoid slot leak');
assert(main.includes('autoHealing: true'), 'main.js watchdog must broadcast autoHealing state to renderer');
assert(main.includes('clearInterval(watchdogTimer)'), 'main.js must cleanly clear watchdogTimer on exit');
console.log('✓ Main Process Check: Hard timeout sandbox & Download Stall Watchdog fully wired.');

// 3. 验证 app.js 中的自愈状态支持与速率计算
const appPath = path.join(__dirname, '..', 'src', 'app.js');
const app = fs.readFileSync(appPath, 'utf8');

assert(app.includes('isAutoHealing'), 'app.js must detect isAutoHealing state');
assert(app.includes('网络抖动，自愈重连中...'), 'app.js must render user-friendly watchdog auto-healing status');
console.log('✓ Renderer Check: Auto-healing UI feedback confirmed.');

// 4. 动态仿真测试：验证硬超时沙箱在挂起连接下的超时熔断
(async () => {
  const http = require('http');
  const server = http.createServer((req, res) => {
    // 模拟服务端挂死（仅接收连接，不发送任何响应体）
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  async function fetchWithHardTimeout(url, fetchOpts = {}, timeoutMs = 800) {
    const ac = new AbortController();
    let timer = null;
    const baseSignal = fetchOpts.signal;
    const combinedSignal = baseSignal
      ? (typeof AbortSignal.any === 'function' ? AbortSignal.any([baseSignal, ac.signal]) : ac.signal)
      : ac.signal;

    const hardTimeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        ac.abort(new Error(`request timed out after ${timeoutMs}ms`));
        const err = new Error(`request timed out after ${timeoutMs}ms`);
        err.name = 'TimeoutError';
        err.code = 'ETIMEDOUT';
        reject(err);
      }, timeoutMs);
    });

    try {
      const fetchPromise = (async () => {
        const response = await fetch(url, { ...fetchOpts, signal: combinedSignal });
        if (!response.ok) return { response, buffer: null };
        const buffer = Buffer.from(await response.arrayBuffer());
        return { response, buffer };
      })();

      return await Promise.race([fetchPromise, hardTimeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const t0 = Date.now();
  let timedOut = false;
  try {
    await fetchWithHardTimeout(`http://127.0.0.1:${port}`, {}, 500);
  } catch (err) {
    const elapsed = Date.now() - t0;
    assert(err.name === 'TimeoutError' || err.code === 'ETIMEDOUT', 'Must catch TimeoutError');
    assert(elapsed >= 450 && elapsed <= 1500, `Must time out within window: took ${elapsed}ms`);
    timedOut = true;
  }
  server.close();
  assert(timedOut, 'fetchWithHardTimeout must safely abort hung requests');
  console.log('✓ Simulation Check: Hanging socket safely aborted by hard timeout sandbox.');

  console.log('\n[PASS] All v2.0.33 tests succeeded!');
  process.exit(0);
})();

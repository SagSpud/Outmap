const { app, BrowserWindow } = require('electron');
const path = require('path');
const assert = require('assert');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadFile(path.join(__dirname, '../src/index.html'));
  await new Promise(r => setTimeout(r, 2000));

  const results = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const logs = {};

      // 1. 搜名山 "泰山" (测试 0ms 纯本地直出，不走海外网络)
      const t0 = performance.now();
      const taishan = await window.queryLocationCandidates('泰山');
      logs.taishanDuration = performance.now() - t0;
      logs.taishanCount = taishan.length;
      logs.taishanFirst = taishan[0];

      // 2. 搜城市 "成都市"
      const t1 = performance.now();
      const chengdu = await window.queryLocationCandidates('成都市');
      logs.chengduDuration = performance.now() - t1;
      logs.chengduCount = chengdu.length;
      logs.chengduFirst = chengdu[0];

      // 3. 搜省份 "四川省"
      const t2 = performance.now();
      const sichuan = await window.queryLocationCandidates('四川省');
      logs.sichuanDuration = performance.now() - t2;
      logs.sichuanFirst = sichuan[0];

      // 4. 验证不存在 window.pinyinToChineseWords
      logs.hasPinyinFunction = typeof window.pinyinToChineseWords === 'function';

      // 5. 验证所有结果坐标都在中国境内 (lng 73-136, lat 18-54)
      const allResults = [...taishan, ...chengdu, ...sichuan];
      logs.allInChina = allResults.every(item => {
        const lng = item.coords[0];
        const lat = item.coords[1];
        return lng >= 73.0 && lng <= 136.0 && lat >= 18.0 && lat <= 54.0;
      });

      resolve(logs);
    });
  `);

  console.log('CHINA SEARCH TEST RESULTS:\n' + JSON.stringify(results, null, 2));

  assert(results.taishanDuration < 50, `Taishan search should be instantaneous (<50ms), took ${results.taishanDuration}ms`);
  assert(results.chengduDuration < 50, `Chengdu search should be instantaneous (<50ms), took ${results.chengduDuration}ms`);
  assert.strictEqual(results.taishanFirst.name, '泰山 · 玉皇顶');
  assert.strictEqual(results.chengduFirst.name, '成都市');
  assert.strictEqual(results.sichuanFirst.name, '四川省');
  assert.strictEqual(results.hasPinyinFunction, false, 'pinyinToChineseWords must be removed');
  assert.strictEqual(results.allInChina, true, 'All search candidates must be strictly within China');

  console.log('🎉 ALL CHINA-ONLY PURE CHINESE SEARCH TESTS PASSED!');
  app.quit();
});

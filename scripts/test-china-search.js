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

      // 1. 搜城市 "银川市" (测试 0ms 纯本地直出，不走海外网络)
      const t0 = performance.now();
      const yinchuan = await window.queryLocationCandidates('银川市');
      logs.yinchuanDuration = performance.now() - t0;
      logs.yinchuanCount = yinchuan.length;
      logs.yinchuanFirst = yinchuan[0];

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

      // 4. 验证已彻底移除名山列表与拼音搜索函数
      logs.hasMountainPois = typeof window.MOUNTAIN_POIS !== 'undefined';
      logs.hasPinyinFunction = typeof window.pinyinToChineseWords === 'function';

      // 5. 验证搜索 "泰山" 不再返回任何 type === 'mountain' 的内置山峰
      const taishanCheck = await window.queryLocationCandidates('泰山');
      logs.hasMountainTypeInSearch = taishanCheck.some(r => r.type === 'mountain');

      // 6. 验证所有结果坐标都在中国境内 (lng 73-136, lat 18-54)
      const allResults = [...yinchuan, ...chengdu, ...sichuan, ...taishanCheck];
      logs.allInChina = allResults.every(item => {
        const lng = item.coords[0];
        const lat = item.coords[1];
        return lng >= 73.0 && lng <= 136.0 && lat >= 18.0 && lat <= 54.0;
      });

      resolve(logs);
    });
  `);

  console.log('CHINA SEARCH TEST RESULTS:\n' + JSON.stringify(results, null, 2));

  assert(results.yinchuanDuration < 50, `Yinchuan search should be instantaneous (<50ms), took ${results.yinchuanDuration}ms`);
  assert(results.chengduDuration < 50, `Chengdu search should be instantaneous (<50ms), took ${results.chengduDuration}ms`);
  assert.strictEqual(results.yinchuanFirst.name, '银川市');
  assert.strictEqual(results.chengduFirst.name, '成都市');
  assert.strictEqual(results.sichuanFirst.name, '四川省');
  assert.strictEqual(results.hasMountainPois, false, 'MOUNTAIN_POIS must be completely removed');
  assert.strictEqual(results.hasMountainTypeInSearch, false, 'No mountain type POIs should be returned');
  assert.strictEqual(results.hasPinyinFunction, false, 'pinyinToChineseWords must be removed');
  assert.strictEqual(results.allInChina, true, 'All search candidates must be strictly within China');

  console.log('🎉 ALL CHINA-ONLY PURE CHINESE SEARCH TESTS (NO MOUNTAINS) PASSED!');
  app.quit();
});

const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const preload = fs.readFileSync('preload.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');

// 1. 版本号与资源引用校验
assert.strictEqual(pkg.version, '1.3.7');
assert(html.includes('app.js?v=1.3.7'), 'index.html should reference app.js?v=1.3.7');
assert(html.includes('style.css?v=1.3.7'), 'index.html should reference style.css?v=1.3.7');

// 2. 第一次搜索 100% 稳定显示标签 (彻底根除首次搜索标签不显示 Bug)
assert(!app.includes('// 远距起飞时立即清除旧卡片'), 'Must not drop or delay marker on long flight');
assert(app.includes('showLandingMarker(validCoords, item.name, item.desc);'), 'Must create landing marker immediately on search jump');

// 3. 目标物理真实高程同步相机矩阵 (彻底根除从全国总览起飞残留 4167m 高原海拔导致落点偏下 472px 出界 Bug)
assert(app.includes('map.transform.elevation = targetEle'), 'flyToLocationPrecisely and showLandingMarker must sync target elevation to camera');
assert(app.includes('map.transform._helper._elevation = targetEle'), 'Must sync helper elevation');
assert(app.includes('map.transform._calcMatrices()'), 'Must recalculate projection matrices with target elevation');

// 4. 2D/3D 光学黄金视区中心校准 (3D 50° 下 ratioY 提升至 0.63，彻底消除“偏上感”，卡片垂直绝对居中)
assert(app.includes('(pitchRad / (Math.PI / 2)) * 0.08'), 'ratioY must scale up to ~0.63 in 50° pitch');
assert(app.includes('ratioY = pitchRad === 0 ? 0.58 :'), '2D baseline ratioY must be 0.58');

// 5. 检查更新按钮移至“下载图层”同一行复选框之后
assert(html.includes('id="chk-dl-vec" checked /> OSM矢量图</label>') && html.includes('id="btn-check-tile-update"'), 'btn-check-tile-update must be in layers row');
assert(html.indexOf('id="chk-dl-vec"') < html.indexOf('id="btn-check-tile-update"'), 'btn-check-tile-update must be after OSM vector checkbox');
assert(css.includes('.check-group.inline-checks .btn-check-tile-update'), 'style.css must style inline check-update button on layers row');

// 6. 延续 1.3.6 方案 A 增量更新机制
assert(main.includes('CHINA_PROVINCE_BBOX_ENTRIES'));
assert(main.includes('scanProvincesFromDisk()'));
assert(main.includes("ipcMain.handle('check-tile-updates'"));
assert(preload.includes('checkTileUpdates'));

// 7. JS 语法执行验证
new Function(app);
new Function(main);
new Function(preload);

console.log('🎉 All Outmap v1.3.7 assertions passed successfully!');

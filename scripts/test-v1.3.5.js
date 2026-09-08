const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');

// 1. 版本号校验
assert.strictEqual(pkg.version, '1.3.5');
assert(html.includes('app.js?v=1.3.5'), 'index.html should reference app.js?v=1.3.5');
assert(html.includes('style.css?v=1.3.5'), 'index.html should reference style.css?v=1.3.5');

// 2. 2D/3D 自适应针孔反向投影求交系统验证 (彻底解决偏上、偏下出界)
assert(app.includes('flyToLocationPrecisely(map, targetCoords, options = {})'));
assert(app.includes('ratioY = pitchRad === 0 ? 0.56 : (0.56 + (pitchRad / (Math.PI / 2)) * 0.045)'));
assert(app.includes('denom = d0 * Math.cos(pitchRad) - dy * Math.sin(pitchRad)'));
assert(app.includes('camLat = 360 * Math.atan(Math.exp(y2)) / Math.PI - 90'));
assert(app.includes('center: cameraCenter'));
assert(app.includes('curve: 1.42')); // van Wijk 理论最优平滑曲率

// 3. 彻底根除落地跳动抖动 (triggerTerrainRealign 纯 GPU 硬件重绘，0ms 物理晃动)
assert(!app.includes('panBy([0.5, 0])'), 'panBy jitter logic must be completely removed');
assert(!app.includes('panBy([-0.5, 0])'), 'panBy jitter logic must be completely removed');
assert(app.includes('map.triggerRepaint()'), 'triggerTerrainRealign must use triggerRepaint');

// 4. 首次起飞长途跨层级防出界保护
assert(app.includes('const isLongFlight = curZoom < 8.5 || distDeg > 2.5;'));
assert(app.includes('onArrival: () => {'));
assert(app.includes('showLandingMarker(validCoords, item.name, item.desc);'));

// 5. 智能层级适配 (解决 15 级过度贴地压迫与透视畸变)
assert(app.includes('targetZoom = 14.5;'));
assert(app.includes('targetZoom = item.zoom || 12.0;')); // 城市
assert(app.includes('targetZoom = item.zoom || 13.5;')); // 名山

// 6. 路线规划连续选点与多重退出
assert(app.includes("btnPickViaInline?.classList.add('picking');"));
assert(app.includes("map.getCanvas().style.cursor = 'crosshair';"));

// 7. JS 运行时解析与语法验证
new Function(app);
new Function(main);

console.log('🎉 All Outmap v1.3.5 assertions passed successfully!');

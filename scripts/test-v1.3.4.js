const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');

// 1. 版本号校验
assert.strictEqual(pkg.version, '1.3.4');
assert(html.includes('app.js?v=1.3.4'));
assert(html.includes('style.css?v=1.3.4'));

// 2. 彻底移除人为计算的 cameraCenter 偏下/偏上错位算法，回归地图图层原生自洽缩放居中与坐标直达
assert(!app.includes('const ratioY = compact ? 0.56'));
assert(!app.includes('const denom = d0 * Math.cos(pitchRad) - dy * Math.sin(pitchRad)'));
assert(app.includes('function flyToLocationPrecisely(map, targetCoords, options = {})'));
assert(app.includes('center: [lng, lat]'));

// 3. 路线规划“连续选点模式”验证：支持连续打点、不退出十字星、按钮动态计数
assert(app.includes('const exitRoutePickingMode = () => {'));
assert(app.includes('window.exitRoutePickingMode = exitRoutePickingMode;'));
assert(app.includes('addViaPoint(map, [lng, lat], cleanLocation || `途径点 ${routeViaPoints.length + 1}`);'));
assert(app.includes("map.getCanvas().style.cursor = 'crosshair';"));
assert(app.includes("btnPickViaInline?.classList.add('picking');"));

// 4. 多重优雅退出机制验证：ESC键、右键 contextmenu、再次点击按钮
assert(app.includes("if (typeof window.exitRoutePickingMode === 'function')"));
assert(app.includes('map.on(\'contextmenu\', e => {'));

// 5. 语法执行与解析有效性
new Function(app);
new Function(main);
console.log('All Outmap v1.3.4 assertions passed successfully!');

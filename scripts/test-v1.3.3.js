const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');

// 1. 版本号校验
assert.strictEqual(pkg.version, '1.3.3');
assert(html.includes('app.js?v=1.3.3'));
assert(html.includes('style.css?v=1.3.3'));

// 2. 标题规范：去除 CN、🇨🇳 与子提示
assert(!html.includes('🇨🇳 全国行政区划'));
assert(!html.includes('按拼音首字母检索'));
assert(html.includes('<span class="prov-menu-title">全国行政区划</span>'));
assert(!app.includes('🇨🇳 全国总览'));
assert(app.includes('<span class="p-name">全国总览</span>'));

// 3. 浏览器端落地“图层被盖住需拖动才清晰”根除机制：triggerTerrainRealign 自动触发与多段自校准
assert(app.includes('function triggerTerrainRealign(map)'));
assert(app.includes('window.triggerTerrainRealign = triggerTerrainRealign;'));
assert(app.includes('map.panBy([0.5, 0], { duration: 0 });'));
assert(app.includes('map.panBy([-0.5, 0], { duration: 0 });'));
assert(app.includes('triggerTerrainRealign(map);'));

// 4. 3D 建筑高质感实心挤出与地表透视根除
assert(app.includes("'fill-extrusion-color': '#e2ded6'"));
assert(app.includes("'fill-extrusion-opacity': 0.92"));

// 5. 路网外框对比度强化
assert(app.includes("'line-color': '#c6c3bb'"));
assert(app.includes("'line-color': '#bebab0'"));

// 6. 着陆卡片与标记硬件加速置顶层
assert(css.includes('.landing-pulse-marker'));
assert(css.includes('z-index: 9999;'));
assert(css.includes('transform: translateZ(0);'));
assert(css.includes('@keyframes fadeInLandingCard'));

// 7. 语法执行与解析有效性
new Function(app);
new Function(main);
console.log('All Outmap v1.3.3 assertions passed successfully!');

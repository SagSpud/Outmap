const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');

assert.strictEqual(pkg.version, '1.3.2');
assert(html.includes('app.js?v=1.3.2'));
assert(html.includes('style.css?v=1.3.2'));

// 2. 第一次飞跃未能定位到正确位置：移除 maxBounds 限制，加入自适应 map.resize()
assert(!app.includes('maxBounds: [[65.0, 14.0], [145.0, 56.0]]'));
assert(app.includes('minZoom: 3.8'));
assert(app.includes("if (typeof map.resize === 'function') {"));

// 3. 全国总览：移除 45° 视角写死标签，俯仰角跟随全局/锁定设置
assert(!app.includes('<span class="p-tag">45° 3D 视角</span>'));
assert(app.includes("const targetPitch = isPitchLocked ? map.getPitch() : (key === 'china' ? (map.getPitch() || 50) : prov.pitch);"));
assert(!app.includes('updatePitchLockFn(true, 50);'));

// 4. Apple Maps 风格原生实心翠绿路线 (零内嵌白条、零半透明外晕)
assert(app.includes("id: 'outdoor-route-casing'"));
assert(app.includes("'line-color': '#166534'"));
assert(app.includes("id: 'outdoor-route-line'"));
assert(app.includes("'line-color': '#34c759'"));
assert(!app.includes("'#f4fff6'"));
assert(!app.includes("'line-blur': 1.4"));

// 5. 路线规划添加途径点双模交互与地图选点面板不收起
assert(html.includes('id="btn-add-via-inline"'));
assert(html.includes('id="btn-pick-via-inline"'));
assert(html.includes('class="route-add-via-bar"'));
assert(css.includes('.route-add-via-bar'));
assert(css.includes('.route-pick-via-inline-btn'));
assert(css.includes('.route-pick-via-inline-btn.picking'));
assert(app.includes("document.getElementById('btn-pick-via-inline')"));
assert(app.includes("btnAddViaInline?.addEventListener('contextmenu'"));
assert(app.includes("btnPickViaInline?.addEventListener('click'"));

// 6. 地图点击时路线规划面板绝对不收起 (已从 toClose 中剔除)
const mapClickBlock = app.slice(app.indexOf("map.on('click', () => {"), app.indexOf("document.getElementById('btn-prov-dropdown-trigger');"));
assert(!mapClickBlock.includes("document.getElementById('route-panel')"));

// 7. ESC 键与退出调度
assert(app.includes('if (pickingRoutePt) {'));
assert(app.includes('pickingRoutePt = null;'));

// 8. 语法解析与执行有效性
new Function(app);
new Function(main);
console.log('All Outmap v1.3.2 assertions passed successfully!');

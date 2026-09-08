const assert = require('assert');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const main = fs.readFileSync('main.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');

assert.strictEqual(pkg.version, '1.3.1');
assert(html.includes('app.js?v=1.3.1'));
assert(html.includes('style.css?v=1.3.1'));

// 2. 地点跳转与三维透视投影 (彻底根除两阶段二次位移、落地拉回与缩放漂移)
assert(app.includes('function flyToLocationPrecisely('));
assert(!app.includes("map.once('moveend', settle)"));
assert(!app.includes('refineAfterTerrain'));
assert(app.includes('cameraCenter = [camLng, camLat];'));

// 3. 路线规划高层级共享浮动联想下拉框 (彻底避免被滚动容器剪切遮挡)
assert(html.includes('id="route-floating-dropdown"'));
assert(css.includes('.route-floating-dropdown'));
assert(css.includes('z-index: 99999'));
assert(css.includes('position: fixed'));
assert(app.includes('function getRouteFloatingDropdown()'));
assert(app.includes('function positionRouteFloatingDropdown('));
assert(app.includes('function hideRouteFloatingDropdown()'));
assert(app.includes('activeFloatingTarget'));

// 4. 高德地图风格内联加号添加途径点与移除连续拾点
assert(html.includes('id="btn-add-via-inline"'));
assert(!html.includes('id="btn-continuous-pick"'));
assert(!html.includes('class="route-tools-row"'));
assert(css.includes('.route-add-via-inline'));
assert(app.includes("document.getElementById('btn-add-via-inline')"));
assert(!app.includes('if (isContinuousPicking) {'));

// 5. 优雅退出动画与毛玻璃质感 (告别生硬瞬时消失)
assert(css.includes('.panel-closing'));
assert(css.includes('panelSlideOut'));
assert(css.includes('.modal-overlay-closing'));
assert(css.includes('modalOverlayFadeOut'));
assert(css.includes('.popover-closing'));

assert(app.includes('function smoothClosePanel('));
assert(app.includes('function smoothCloseModal('));
assert(app.includes('function smoothClosePopover('));

// 6. 语法解析与执行有效性
new Function(app);
new Function(main);
console.log('All Outmap v1.3.1 assertions passed successfully!');

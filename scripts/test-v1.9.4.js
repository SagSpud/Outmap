const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

assert(app.includes("const SAVED_ROUTES_SOURCE_ID = 'outmap-saved-routes'"));
assert(app.includes("id: 'outmap-saved-route-line', type: 'line'"), '收藏路线应使用 MapLibre line 图层');
assert(app.includes('renderSavedRoutesOnMap(map);'), '收藏路线应在初始化和更新时刷新');
assert(app.includes("map.setLayoutProperty(id, 'visibility', visibility)"), '路线开关应直接控制 MapLibre visibility');
assert(html.includes('⭐ 收藏地点'));
assert(html.includes('🛣️ 收藏与规划路线'));
assert(!/fav-point-type-menu[\s\S]*?<div class="ctx-header">/.test(app), '收藏点菜单不应显示标题区');
assert(app.includes('class="ctx-item danger fav-type-delete"'), '收藏点菜单应有删除按钮');
assert(css.includes('.fav-point-type-menu .fav-type-delete'));
assert((app.match(/'text-size': 12/g) || []).length >= 2, '收藏点和途径点聚合数字应统一为适中尺寸');
assert(app.includes('coords.length <= 5000'), '多条收藏路线默认显示应限制渲染顶点量');

console.log('v1.9.4 native saved-route and context-menu checks passed');

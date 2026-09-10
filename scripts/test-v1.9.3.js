const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

assert(html.includes('<span>图层</span>'), '图层标题应精简为“图层”');
assert(!html.includes('<span>图层与要素显示</span>'), '旧图层标题不应残留');
assert(/\.fab-btn\.active\s*\{[^}]*color:\s*#0369a1/s.test(css), '工具按钮 active 图标应保持深蓝可见');
assert(app.includes("['btn-fab-layers', 'layers-popover']"));
assert(app.includes("['btn-fab-route', 'route-panel']"));
assert(app.includes("['btn-fab-fav', 'favorites-drawer']"));
assert(app.includes('hasPersistedCompleteProvince'));
assert(app.includes("level?.complete === true"), '绿点必须来自完整层级清单');
assert(!/btnDone\?\.addEventListener\('click',[\s\S]{0,100}setDownloadDotState\('idle'\)/.test(app), '关闭下载面板不得清除持久绿点');
assert(app.includes('enqueueCloudSync'), '同步必须串行执行');
assert(app.includes('暂时无法确认云端最新数据'), '无法拉取最新版时必须阻止覆盖上传');
assert(app.includes('window.addEventListener(\'focus\', syncWhenActiveAgain)'), '重新激活窗口后应补拉云端');
assert(main.indexOf('直读 R2 源站') < main.indexOf('源站临时不可用时再走公网 CDN'), '桌面应优先读取无缓存源站');
assert(app.includes("const combined = [...normalizedLocal, ...normalizedCloud]"), '收藏必须对本地和云端取并集');

console.log('v1.9.3 regression checks passed');

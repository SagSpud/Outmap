/**
 * Outmap 3D GIS - 核心引擎
 * 默认风格：Outmap 自然绿白地势 + 亚米级高清卫星影像 + 全量微观路网/建筑/山峰/POI
 * 整合 Office 365 紧凑一体化顶栏、视角倾角锁定与金字塔多级离线下载系统
 */

const APP_VERSION = '1.9.0';
window.OUTMAP_APP_VERSION = APP_VERSION;

// 全局轻量级毛玻璃浮动气泡提示 (Toast)
function showToast(msg, duration = 2500) {
  if (!msg) return;
  let toastContainer = document.getElementById('outmap-global-toast');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'outmap-global-toast';
    toastContainer.style.cssText = 'position: fixed; bottom: 68px; left: 50%; transform: translateX(-50%) translateY(20px); background: rgba(15, 23, 42, 0.88); color: #ffffff; padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 500; z-index: 100001; pointer-events: none; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); backdrop-filter: blur(12px) saturate(180%); -webkit-backdrop-filter: blur(12px) saturate(180%); opacity: 0; transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255, 255, 255, 0.15); text-align: center; max-width: 80vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    document.body.appendChild(toastContainer);
  }
  toastContainer.innerText = msg;
  toastContainer.style.opacity = '1';
  toastContainer.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastContainer._hideTimer);
  toastContainer._hideTimer = setTimeout(() => {
    toastContainer.style.opacity = '0';
    toastContainer.style.transform = 'translateX(-50%) translateY(15px)';
  }, duration);
}
window.showToast = showToast;

// 1. 全国 34 省级行政区中心、地理外包围盒 (用于精确金字塔切片计算) 与三维视点
// 1. 全国 34 省级行政区中心、地理外包围盒 (按首字母拼音 A-Z 严格排序，含港澳台)
const PROVINCES_DATA = {
  china: { name: '全国总览', en: 'ALL CHINA 3D', pinyin: 'Quanguo', py: 'qg', pinyinGroup: 'Top', center: [104.5, 36.0], zoom: 4.45, pitch: 50, bbox: [73.5, 135.1, 18.0, 53.6] },
  anhui: { name: '安徽省', en: 'Anhui', pinyin: 'Anhui', py: 'ah', pinyinGroup: 'A', center: [117.2, 31.8], zoom: 7.2, pitch: 60, bbox: [114.8, 119.6, 29.7, 34.6] },
  aomen: { name: '澳门特别行政区', en: 'Macao', pinyin: 'Aomen', py: 'am', pinyinGroup: 'A', center: [113.5439, 22.1987], zoom: 11.5, pitch: 55, bbox: [113.52, 113.60, 22.10, 22.22] },
  beijing: { name: '北京市', en: 'Beijing', pinyin: 'Beijing', py: 'bj', pinyinGroup: 'B', center: [116.4, 39.9], zoom: 9.2, pitch: 62, bbox: [115.4, 117.5, 39.4, 41.1] },
  chongqing: { name: '重庆市', en: 'Chongqing', pinyin: 'Chongqing', py: 'cq', pinyinGroup: 'C', center: [106.5, 29.5], zoom: 8.0, pitch: 62, bbox: [105.3, 110.2, 28.2, 32.2] },
  fujian: { name: '福建省', en: 'Fujian', pinyin: 'Fujian', py: 'fj', pinyinGroup: 'F', center: [118.0, 26.0], zoom: 7.2, pitch: 60, bbox: [115.8, 120.7, 23.5, 28.3] },
  gansu: { name: '甘肃省', en: 'Gansu', pinyin: 'Gansu', py: 'gs', pinyinGroup: 'G', center: [100.0, 38.0], zoom: 6.2, pitch: 60, bbox: [92.2, 108.7, 32.5, 42.8] },
  guangdong: { name: '广东省', en: 'Guangdong', pinyin: 'Guangdong', py: 'gd', pinyinGroup: 'G', center: [113.3, 23.1], zoom: 7.2, pitch: 55, bbox: [109.6, 117.3, 20.2, 25.5] },
  guangxi: { name: '广西壮族自治区', en: 'Guangxi', pinyin: 'Guangxi', py: 'gx', pinyinGroup: 'G', center: [108.5, 23.8], zoom: 7.0, pitch: 60, bbox: [104.4, 112.1, 20.9, 26.4] },
  guizhou: { name: '贵州省', en: 'Guizhou', pinyin: 'Guizhou', py: 'gz', pinyinGroup: 'G', center: [106.7, 26.8], zoom: 7.2, pitch: 62, bbox: [103.6, 109.6, 24.6, 29.2] },
  hainan: { name: '海南省', en: 'Hainan', pinyin: 'Hainan', py: 'hn', pinyinGroup: 'H', center: [109.8, 19.2], zoom: 8.0, pitch: 58, bbox: [108.6, 111.1, 18.1, 20.2] },
  hebei: { name: '河北省', en: 'Hebei', pinyin: 'Hebei', py: 'hb', pinyinGroup: 'H', center: [115.0, 38.0], zoom: 7.0, pitch: 58, bbox: [113.4, 119.8, 36.0, 42.6] },
  heilongjiang: { name: '黑龙江省', en: 'Heilongjiang', pinyin: 'Heilongjiang', py: 'hlj', pinyinGroup: 'H', center: [127.0, 47.0], zoom: 6.0, pitch: 55, bbox: [121.2, 135.1, 43.4, 53.6] },
  henan: { name: '河南省', en: 'Henan', pinyin: 'Henan', py: 'hn', pinyinGroup: 'H', center: [113.6, 34.0], zoom: 7.2, pitch: 58, bbox: [110.3, 116.6, 31.4, 36.4] },
  hubei: { name: '湖北省', en: 'Hubei', pinyin: 'Hubei', py: 'hb', pinyinGroup: 'H', center: [112.5, 31.0], zoom: 7.2, pitch: 60, bbox: [108.3, 116.1, 29.0, 33.3] },
  hunan: { name: '湖南省', en: 'Hunan', pinyin: 'Hunan', py: 'hn', pinyinGroup: 'H', center: [112.0, 27.5], zoom: 7.2, pitch: 60, bbox: [108.8, 114.2, 24.6, 30.1] },
  jilin: { name: '吉林省', en: 'Jilin', pinyin: 'Jilin', py: 'jl', pinyinGroup: 'J', center: [126.0, 43.5], zoom: 6.8, pitch: 58, bbox: [121.6, 131.3, 40.8, 46.3] },
  jiangsu: { name: '江苏省', en: 'Jiangsu', pinyin: 'Jiangsu', py: 'js', pinyinGroup: 'J', center: [119.8, 33.0], zoom: 7.2, pitch: 50, bbox: [116.3, 121.9, 30.7, 35.1] },
  jiangxi: { name: '江西省', en: 'Jiangxi', pinyin: 'Jiangxi', py: 'jx', pinyinGroup: 'J', center: [115.8, 27.8], zoom: 7.2, pitch: 60, bbox: [113.5, 118.5, 24.5, 30.1] },
  liaoning: { name: '辽宁省', en: 'Liaoning', pinyin: 'Liaoning', py: 'ln', pinyinGroup: 'L', center: [123.0, 41.5], zoom: 7.2, pitch: 58, bbox: [118.8, 125.8, 38.7, 43.5] },
  neimenggu: { name: '内蒙古自治区', en: 'Inner Mongolia', pinyin: 'Neimenggu', py: 'nmg', pinyinGroup: 'N', center: [112.0, 44.0], zoom: 5.5, pitch: 55, bbox: [97.2, 126.1, 37.4, 53.4] },
  ningxia: { name: '宁夏回族自治区', en: 'Ningxia', pinyin: 'Ningxia', py: 'nx', pinyinGroup: 'N', center: [106.2, 37.2], zoom: 7.5, pitch: 60, bbox: [104.3, 107.7, 35.2, 39.4] },
  qinghai: { name: '青海省', en: 'Qinghai', pinyin: 'Qinghai', py: 'qh', pinyinGroup: 'Q', center: [96.0, 35.5], zoom: 6.2, pitch: 58, bbox: [89.4, 103.1, 31.6, 39.3] },
  shandong: { name: '山东省', en: 'Shandong', pinyin: 'Shandong', py: 'sd', pinyinGroup: 'S', center: [117.5, 36.4], zoom: 7.6, pitch: 60, bbox: [114.8, 122.7, 34.3, 38.4] },
  shanxi: { name: '山西省', en: 'Shanxi', pinyin: 'Shanxi', py: 'sx', pinyinGroup: 'S', center: [112.5, 37.8], zoom: 7.0, pitch: 60, bbox: [110.2, 114.5, 34.6, 40.7] },
  shaanxi: { name: '陕西省', en: 'Shaanxi', pinyin: 'Shaanxi', py: 'sx', pinyinGroup: 'S', center: [108.9, 34.3], zoom: 7.2, pitch: 60, bbox: [105.5, 111.2, 31.7, 39.6] },
  shanghai: { name: '上海市', en: 'Shanghai', pinyin: 'Shanghai', py: 'sh', pinyinGroup: 'S', center: [121.5, 31.2], zoom: 10.0, pitch: 50, bbox: [120.8, 122.2, 30.7, 31.9] },
  sichuan: { name: '四川省', en: 'Sichuan', pinyin: 'Sichuan', py: 'sc', pinyinGroup: 'S', center: [102.8, 30.5], zoom: 7.2, pitch: 62, bbox: [97.3, 108.5, 26.0, 34.3] },
  taiwan: { name: '台湾省', en: 'Taiwan', pinyin: 'Taiwan', py: 'tw', pinyinGroup: 'T', center: [121.0, 23.8], zoom: 8.0, pitch: 65, bbox: [119.9, 122.1, 21.8, 25.4] },
  tianjin: { name: '天津市', en: 'Tianjin', pinyin: 'Tianjin', py: 'tj', pinyinGroup: 'T', center: [117.2, 39.1], zoom: 9.5, pitch: 50, bbox: [116.7, 118.1, 38.5, 40.3] },
  xizang: { name: '西藏自治区', en: 'Tibet', pinyin: 'Xizang', py: 'xz', pinyinGroup: 'X', center: [88.5, 31.0], zoom: 6.0, pitch: 60, bbox: [78.4, 99.1, 26.8, 36.5] },
  xianggang: { name: '香港特别行政区', en: 'Hong Kong', pinyin: 'Xianggang', py: 'xg', pinyinGroup: 'X', center: [114.1654, 22.2753], zoom: 11.0, pitch: 55, bbox: [113.83, 114.44, 22.15, 22.56] },
  xinjiang: { name: '新疆维吾尔自治区', en: 'Xinjiang', pinyin: 'Xinjiang', py: 'xj', pinyinGroup: 'X', center: [85.0, 41.5], zoom: 5.8, pitch: 58, bbox: [73.5, 96.4, 34.3, 49.2] },
  yunnan: { name: '云南省', en: 'Yunnan', pinyin: 'Yunnan', py: 'yn', pinyinGroup: 'Y', center: [101.5, 25.0], zoom: 7.0, pitch: 62, bbox: [97.5, 106.2, 21.1, 29.2] },
  zhejiang: { name: '浙江省', en: 'Zhejiang', pinyin: 'Zhejiang', py: 'zj', pinyinGroup: 'Z', center: [120.2, 29.2], zoom: 7.5, pitch: 60, bbox: [118.0, 123.0, 27.0, 31.3] }
};

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// 原生与 Web 剪贴板安全写入
function copyTextToClipboard(text) {
  if (typeof text !== 'string') return;
  if (window.electronAPI?.writeClipboardText) {
    window.electronAPI.writeClipboardText(text);
    return;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}
window.copyTextToClipboard = copyTextToClipboard;

// 现代流体平滑退出动效工具函数：杜绝瞬间切断的生硬视觉体验
const pendingElementCloses = new WeakMap();

function cancelPendingElementClose(el) {
  if (!el) return;
  const pending = pendingElementCloses.get(el);
  if (pending) {
    clearTimeout(pending.timer);
    el.removeEventListener('animationend', pending.onAnimationEnd);
    pendingElementCloses.delete(el);
  }
  el.classList.remove('panel-closing', 'modal-overlay-closing', 'popover-closing', 'ctx-closing');
}

function showElement(el, display = 'block') {
  if (!el) return;
  // Cancel ownership of any delayed close before reopening. Otherwise a
  // close->open within 160 ms can be hidden by the stale close callback.
  cancelPendingElementClose(el);
  el.style.display = display;
}

function smoothCloseElement(el, closingClass, durationMs, onClosed) {
  if (!el || el.style.display === 'none') {
    if (typeof onClosed === 'function') onClosed();
    return;
  }
  if (pendingElementCloses.has(el)) return;

  const finish = () => {
    const pending = pendingElementCloses.get(el);
    if (!pending || pending.finish !== finish) return;
    clearTimeout(pending.timer);
    el.removeEventListener('animationend', pending.onAnimationEnd);
    pendingElementCloses.delete(el);
    el.style.display = 'none';
    el.classList.remove(closingClass);
    if (typeof onClosed === 'function') onClosed();
  };
  const onAnimationEnd = event => {
    if (event.target === el) finish();
  };
  el.classList.add(closingClass);
  el.addEventListener('animationend', onAnimationEnd);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timer = setTimeout(finish, reduceMotion ? 0 : durationMs + 80);
  pendingElementCloses.set(el, { timer, finish, onAnimationEnd });
}

function smoothClosePanel(el, onClosed) {
  smoothCloseElement(el, 'panel-closing', 180, onClosed);
}

function smoothCloseModal(overlayEl, onClosed) {
  smoothCloseElement(overlayEl, 'modal-overlay-closing', 180, onClosed);
}

function smoothClosePopover(el, onClosed) {
  smoothCloseElement(el, 'popover-closing', 160, onClosed);
}

function smoothCloseContextMenu(onClosed) {
  const ctxMenu = document.getElementById('map-context-menu');
  if (!ctxMenu || ctxMenu.style.display === 'none') {
    if (typeof onClosed === 'function') onClosed();
    return;
  }
  if (pendingElementCloses.has(ctxMenu)) return;
  ctxMenu.classList.remove('ctx-opening');
  smoothCloseElement(ctxMenu, 'ctx-closing', 150, onClosed);
}

// Fluent / Apple 风格全局高质感模态弹窗系统 (全局拦截原生 Win32/浏览器 alert，体验精致统一)
function showFluentAlert(message, title = 'Outmap 提示') {
  const overlay = document.getElementById('fluent-alert-overlay');
  const msgEl = document.getElementById('fluent-alert-message');
  const titleEl = document.getElementById('fluent-alert-title');
  const btnConfirm = document.getElementById('btn-confirm-fluent-alert');
  const btnClose = document.getElementById('btn-close-fluent-alert');

  if (!overlay || !msgEl) {
    if (window._nativeAlert) window._nativeAlert(message);
    else console.warn(message);
    return;
  }

  if (titleEl) titleEl.innerText = title;
  msgEl.innerText = message;
  showElement(overlay, 'flex');

  const closeAlert = () => {
    smoothCloseModal(overlay);
  };

  if (btnConfirm) btnConfirm.onclick = closeAlert;
  if (btnClose) btnClose.onclick = closeAlert;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeAlert();
  };
}

if (!window._nativeAlert && typeof window.alert === 'function') {
  window._nativeAlert = window.alert.bind(window);
}
window.alert = (msg) => {
  showFluentAlert(msg);
};
window.showFluentAlert = showFluentAlert;

// 2. 重点地标城市与著名乡镇
const MAJOR_CITIES = [
  { name: "北京市", pinyin: "beijing", py: "bj", coords: [116.4074, 39.9042], province: "北京市" },
  { name: "上海市", pinyin: "shanghai", py: "sh", coords: [121.4737, 31.2304], province: "上海市" },
  { name: "天津市", pinyin: "tianjin", py: "tj", coords: [117.2008, 39.0842], province: "天津市" },
  { name: "重庆市", pinyin: "chongqing", py: "cq", coords: [106.5516, 29.563], province: "重庆市" },
  { name: "济南市", pinyin: "jinan", py: "jn", coords: [117.0009, 36.6758], province: "山东省" },
  { name: "青岛市", pinyin: "qingdao", py: "qd", coords: [120.3826, 36.0671], province: "山东省" },
  { name: "淄博市", pinyin: "zibo", py: "zb", coords: [118.0476, 36.8149], province: "山东省" },
  { name: "枣庄市", pinyin: "zaozhuang", py: "zz", coords: [117.5579, 34.8564], province: "山东省" },
  { name: "东营市", pinyin: "dongying", py: "dy", coords: [118.6647, 37.4346], province: "山东省" },
  { name: "烟台市", pinyin: "yantai", py: "yt", coords: [121.3914, 37.5388], province: "山东省" },
  { name: "潍坊市", pinyin: "weifang", py: "wf", coords: [119.1071, 36.7093], province: "山东省" },
  { name: "济宁市", pinyin: "jining", py: "jn", coords: [116.5872, 35.4154], province: "山东省" },
  { name: "泰安市", pinyin: "taian", py: "ta", coords: [117.129, 36.1949], province: "山东省" },
  { name: "威海市", pinyin: "weihai", py: "wh", coords: [122.1164, 37.5097], province: "山东省" },
  { name: "日照市", pinyin: "rizhao", py: "rz", coords: [119.4612, 35.4286], province: "山东省" },
  { name: "临沂市", pinyin: "linyi", py: "ly", coords: [118.3564, 35.1047], province: "山东省" },
  { name: "德州市", pinyin: "dezhou", py: "dz", coords: [116.3075, 37.454], province: "山东省" },
  { name: "聊城市", pinyin: "liaocheng", py: "lc", coords: [115.9804, 36.456], province: "山东省" },
  { name: "滨州市", pinyin: "binzhou", py: "bz", coords: [118.017, 37.3835], province: "山东省" },
  { name: "菏泽市", pinyin: "heze", py: "hz", coords: [115.4694, 35.2465], province: "山东省" },
  { name: "曲阜市", pinyin: "qufu", py: "qf", coords: [116.9865, 35.5807], province: "山东省" },
  { name: "石家庄市", pinyin: "shijiazhuang", py: "sjz", coords: [114.5149, 38.0423], province: "河北省" },
  { name: "唐山市", pinyin: "tangshan", py: "ts", coords: [118.1754, 39.6352], province: "河北省" },
  { name: "秦皇岛市", pinyin: "qinhuangdao", py: "qhd", coords: [119.5866, 39.9425], province: "河北省" },
  { name: "邯郸市", pinyin: "handan", py: "hd", coords: [114.4907, 36.6123], province: "河北省" },
  { name: "邢台市", pinyin: "xingtai", py: "xt", coords: [114.5089, 37.0682], province: "河北省" },
  { name: "保定市", pinyin: "baoding", py: "bd", coords: [115.4824, 38.8677], province: "河北省" },
  { name: "张家口市", pinyin: "zhangjiakou", py: "zjk", coords: [114.8841, 40.8119], province: "河北省" },
  { name: "承德市", pinyin: "chengde", py: "cd", coords: [117.9392, 40.9762], province: "河北省" },
  { name: "沧州市", pinyin: "cangzhou", py: "cz", coords: [116.8575, 38.3106], province: "河北省" },
  { name: "廊坊市", pinyin: "langfang", py: "lf", coords: [116.7044, 39.5239], province: "河北省" },
  { name: "衡水市", pinyin: "hengshui", py: "hs", coords: [115.6659, 37.7351], province: "河北省" },
  { name: "雄安新区", pinyin: "xiongan", py: "xa", coords: [115.9856, 38.9944], province: "河北省" },
  { name: "太原市", pinyin: "taiyuan", py: "ty", coords: [112.5492, 37.857], province: "山西省" },
  { name: "大同市", pinyin: "datong", py: "dt", coords: [113.2953, 40.0903], province: "山西省" },
  { name: "阳泉市", pinyin: "yangquan", py: "yq", coords: [113.5833, 37.8611], province: "山西省" },
  { name: "长治市", pinyin: "changzhi", py: "cz", coords: [113.1136, 36.1911], province: "山西省" },
  { name: "晋城市", pinyin: "jincheng", py: "jc", coords: [112.8513, 35.4976], province: "山西省" },
  { name: "朔州市", pinyin: "shuozhou", py: "sz", coords: [112.4334, 39.3313], province: "山西省" },
  { name: "晋中市", pinyin: "jinzhong", py: "jz", coords: [112.7365, 37.6965], province: "山西省" },
  { name: "运城市", pinyin: "yuncheng", py: "yc", coords: [111.004, 35.0264], province: "山西省" },
  { name: "忻州市", pinyin: "xinzhou", py: "xz", coords: [112.7335, 38.4177], province: "山西省" },
  { name: "临汾市", pinyin: "linfen", py: "lf", coords: [111.5179, 36.0841], province: "山西省" },
  { name: "吕梁市", pinyin: "lvliang", py: "ll", coords: [111.1343, 37.5244], province: "山西省" },
  { name: "平遥古城", pinyin: "pingyao", py: "py", coords: [112.1887, 37.2023], province: "山西省" },
  { name: "南京市", pinyin: "nanjing", py: "nj", coords: [118.7969, 32.0603], province: "江苏省" },
  { name: "无锡市", pinyin: "wuxi", py: "wx", coords: [120.3017, 31.5747], province: "江苏省" },
  { name: "徐州市", pinyin: "xuzhou", py: "xz", coords: [117.1848, 34.2618], province: "江苏省" },
  { name: "常州市", pinyin: "changzhou", py: "cz", coords: [119.9469, 31.7728], province: "江苏省" },
  { name: "苏州市", pinyin: "suzhou", py: "sz", coords: [120.6195, 31.2994], province: "江苏省" },
  { name: "南通市", pinyin: "nantong", py: "nt", coords: [120.8943, 31.9802], province: "江苏省" },
  { name: "连云港市", pinyin: "lianyungang", py: "lyg", coords: [119.1788, 34.6], province: "江苏省" },
  { name: "淮安市", pinyin: "huaian", py: "ha", coords: [119.0213, 33.5975], province: "江苏省" },
  { name: "盐城市", pinyin: "yancheng", py: "yc", coords: [120.1399, 33.3776], province: "江苏省" },
  { name: "扬州市", pinyin: "yangzhou", py: "yz", coords: [119.421, 32.3932], province: "江苏省" },
  { name: "镇江市", pinyin: "zhenjiang", py: "zj", coords: [119.4528, 32.2044], province: "江苏省" },
  { name: "泰州市", pinyin: "taizhou", py: "tz", coords: [119.9152, 32.4849], province: "江苏省" },
  { name: "宿迁市", pinyin: "suqian", py: "sq", coords: [118.2752, 33.963], province: "江苏省" },
  { name: "杭州市", pinyin: "hangzhou", py: "hz", coords: [120.1536, 30.2875], province: "浙江省" },
  { name: "宁波市", pinyin: "ningbo", py: "nb", coords: [121.5498, 29.8684], province: "浙江省" },
  { name: "温州市", pinyin: "wenzhou", py: "wz", coords: [120.6721, 28.0006], province: "浙江省" },
  { name: "嘉兴市", pinyin: "jiaxing", py: "jx", coords: [120.7509, 30.7627], province: "浙江省" },
  { name: "湖州市", pinyin: "huzhou", py: "hz", coords: [120.1024, 30.8672], province: "浙江省" },
  { name: "绍兴市", pinyin: "shaoxing", py: "sx", coords: [120.5821, 30.0024], province: "浙江省" },
  { name: "金华市", pinyin: "jinhua", py: "jh", coords: [119.6495, 29.0895], province: "浙江省" },
  { name: "衢州市", pinyin: "quzhou", py: "qz", coords: [118.8726, 28.9417], province: "浙江省" },
  { name: "舟山市", pinyin: "zhoushan", py: "zs", coords: [122.1069, 29.9978], province: "浙江省" },
  { name: "台州市", pinyin: "taizhou", py: "tz", coords: [121.4286, 28.6614], province: "浙江省" },
  { name: "丽水市", pinyin: "lishui", py: "ls", coords: [119.9218, 28.452], province: "浙江省" },
  { name: "义乌市", pinyin: "yiwu", py: "yw", coords: [120.0745, 29.3056], province: "浙江省" },
  { name: "合肥市", pinyin: "hefei", py: "hf", coords: [117.283, 31.8612], province: "安徽省" },
  { name: "芜湖市", pinyin: "wuhu", py: "wh", coords: [118.3765, 31.3263], province: "安徽省" },
  { name: "蚌埠市", pinyin: "bengbu", py: "bb", coords: [117.3632, 32.9397], province: "安徽省" },
  { name: "淮南市", pinyin: "huainan", py: "hn", coords: [116.9999, 32.6255], province: "安徽省" },
  { name: "马鞍山市", pinyin: "maanshan", py: "mas", coords: [118.5079, 31.6894], province: "安徽省" },
  { name: "淮北市", pinyin: "huaibei", py: "hb", coords: [116.7946, 33.9717], province: "安徽省" },
  { name: "铜陵市", pinyin: "tongling", py: "tl", coords: [117.8166, 30.9299], province: "安徽省" },
  { name: "安庆市", pinyin: "anqing", py: "aq", coords: [117.0536, 30.5288], province: "安徽省" },
  { name: "黄山市", pinyin: "huangshan", py: "hs", coords: [118.3173, 29.7092], province: "安徽省" },
  { name: "滁州市", pinyin: "chuzhou", py: "cz", coords: [118.3162, 32.3036], province: "安徽省" },
  { name: "阜阳市", pinyin: "fuyang", py: "fy", coords: [115.8197, 32.897], province: "安徽省" },
  { name: "宿州市", pinyin: "suzhou", py: "sz", coords: [116.9841, 33.6339], province: "安徽省" },
  { name: "六安市", pinyin: "liuan", py: "la", coords: [116.5077, 31.7529], province: "安徽省" },
  { name: "亳州市", pinyin: "bozhou", py: "bz", coords: [115.7829, 33.8693], province: "安徽省" },
  { name: "池州市", pinyin: "chizhou", py: "cz", coords: [117.4892, 30.656], province: "安徽省" },
  { name: "宣城市", pinyin: "xuancheng", py: "xc", coords: [118.7579, 30.9457], province: "安徽省" },
  { name: "福州市", pinyin: "fuzhou", py: "fz", coords: [119.3062, 26.0753], province: "福建省" },
  { name: "厦门市", pinyin: "xiamen", py: "xm", coords: [118.1102, 24.4905], province: "福建省" },
  { name: "莆田市", pinyin: "putian", py: "pt", coords: [119.0076, 25.431], province: "福建省" },
  { name: "三明市", pinyin: "sanming", py: "sm", coords: [117.635, 26.2654], province: "福建省" },
  { name: "泉州市", pinyin: "quanzhou", py: "qz", coords: [118.5894, 24.9089], province: "福建省" },
  { name: "漳州市", pinyin: "zhangzhou", py: "zz", coords: [117.6618, 24.5109], province: "福建省" },
  { name: "南平市", pinyin: "nanping", py: "np", coords: [118.1785, 26.642], province: "福建省" },
  { name: "龙岩市", pinyin: "longyan", py: "ly", coords: [117.0298, 25.0916], province: "福建省" },
  { name: "宁德市", pinyin: "ningde", py: "nd", coords: [119.5271, 26.6592], province: "福建省" },
  { name: "武夷山市", pinyin: "wuyishan", py: "wys", coords: [118.0315, 27.7554], province: "福建省" },
  { name: "南昌市", pinyin: "nanchang", py: "nc", coords: [115.8921, 28.6765], province: "江西省" },
  { name: "景德镇市", pinyin: "jingdezhen", py: "jdz", coords: [117.2147, 29.2926], province: "江西省" },
  { name: "萍乡市", pinyin: "pingxiang", py: "px", coords: [113.8546, 27.6229], province: "江西省" },
  { name: "九江市", pinyin: "jiujiang", py: "jj", coords: [115.9928, 29.712], province: "江西省" },
  { name: "新余市", pinyin: "xinyu", py: "xy", coords: [114.9308, 27.8108], province: "江西省" },
  { name: "鹰潭市", pinyin: "yingtan", py: "yt", coords: [117.0338, 28.2386], province: "江西省" },
  { name: "赣州市", pinyin: "ganzhou", py: "gz", coords: [114.9403, 25.851], province: "江西省" },
  { name: "吉安市", pinyin: "jian", py: "ja", coords: [114.9864, 27.1117], province: "江西省" },
  { name: "宜春市", pinyin: "yichun", py: "yc", coords: [114.3911, 27.8043], province: "江西省" },
  { name: "抚州市", pinyin: "fuzhou", py: "fz", coords: [116.3584, 27.9839], province: "江西省" },
  { name: "上饶市", pinyin: "shangrao", py: "sr", coords: [117.9712, 28.4444], province: "江西省" },
  { name: "婺源县", pinyin: "wuyuan", py: "wy", coords: [117.8611, 29.2483], province: "江西省" },
  { name: "郑州市", pinyin: "zhengzhou", py: "zz", coords: [113.6654, 34.758], province: "河南省" },
  { name: "开封市", pinyin: "kaifeng", py: "kf", coords: [114.3414, 34.797], province: "河南省" },
  { name: "洛阳市", pinyin: "luoyang", py: "ly", coords: [112.4345, 34.663], province: "河南省" },
  { name: "平顶山市", pinyin: "pingdingshan", py: "pds", coords: [113.3077, 33.7352], province: "河南省" },
  { name: "安阳市", pinyin: "anyang", py: "ay", coords: [114.3525, 36.1034], province: "河南省" },
  { name: "鹤壁市", pinyin: "hebi", py: "hb", coords: [114.2954, 35.7482], province: "河南省" },
  { name: "新乡市", pinyin: "xinxiang", py: "xx", coords: [113.8839, 35.3026], province: "河南省" },
  { name: "焦作市", pinyin: "jiaozuo", py: "jz", coords: [113.2383, 35.239], province: "河南省" },
  { name: "濮阳市", pinyin: "puyang", py: "py", coords: [115.0413, 35.7682], province: "河南省" },
  { name: "许昌市", pinyin: "xuchang", py: "xc", coords: [113.8261, 34.023], province: "河南省" },
  { name: "漯河市", pinyin: "luohe", py: "lh", coords: [114.0264, 33.5759], province: "河南省" },
  { name: "三门峡市", pinyin: "sanmenxia", py: "smx", coords: [111.1944, 34.7773], province: "河南省" },
  { name: "南阳市", pinyin: "nanyang", py: "ny", coords: [112.5409, 32.9908], province: "河南省" },
  { name: "商丘市", pinyin: "shangqiu", py: "sq", coords: [115.6554, 34.4192], province: "河南省" },
  { name: "信阳市", pinyin: "xinyang", py: "xy", coords: [114.075, 32.1233], province: "河南省" },
  { name: "周口市", pinyin: "zhoukou", py: "zk", coords: [114.6497, 33.6204], province: "河南省" },
  { name: "驻马店市", pinyin: "zhumadian", py: "zmd", coords: [114.0247, 32.9802], province: "河南省" },
  { name: "武汉市", pinyin: "wuhan", py: "wh", coords: [114.3055, 30.5928], province: "湖北省" },
  { name: "黄石市", pinyin: "huangshi", py: "hs", coords: [115.077, 30.2201], province: "湖北省" },
  { name: "十堰市", pinyin: "shiyan", py: "sy", coords: [110.7879, 32.6469], province: "湖北省" },
  { name: "宜昌市", pinyin: "yichang", py: "yc", coords: [111.2908, 30.7026], province: "湖北省" },
  { name: "襄阳市", pinyin: "xiangyang", py: "xy", coords: [112.1441, 32.0424], province: "湖北省" },
  { name: "鄂州市", pinyin: "ezhou", py: "ez", coords: [114.8906, 30.3965], province: "湖北省" },
  { name: "荆门市", pinyin: "jingmen", py: "jm", coords: [112.2043, 31.0354], province: "湖北省" },
  { name: "孝感市", pinyin: "xiaogan", py: "xg", coords: [113.9267, 30.9264], province: "湖北省" },
  { name: "荆州市", pinyin: "jingzhou", py: "jz", coords: [112.2381, 30.3268], province: "湖北省" },
  { name: "黄冈市", pinyin: "huanggang", py: "hg", coords: [114.8794, 30.4477], province: "湖北省" },
  { name: "咸宁市", pinyin: "xianning", py: "xn", coords: [114.3288, 29.8328], province: "湖北省" },
  { name: "随州市", pinyin: "suizhou", py: "sz", coords: [113.3738, 31.7179], province: "湖北省" },
  { name: "恩施土家族苗族自治州", pinyin: "enshi", py: "es", coords: [109.4869, 30.2831], province: "湖北省" },
  { name: "神农架林区", pinyin: "shennongjia", py: "snj", coords: [110.6715, 31.7444], province: "湖北省" },
  { name: "长沙市", pinyin: "changsha", py: "cs", coords: [112.9388, 28.2282], province: "湖南省" },
  { name: "株洲市", pinyin: "zhuzhou", py: "zz", coords: [113.1517, 27.8358], province: "湖南省" },
  { name: "湘潭市", pinyin: "xiangtan", py: "xt", coords: [112.9441, 27.8297], province: "湖南省" },
  { name: "衡阳市", pinyin: "hengyang", py: "hy", coords: [112.6077, 26.9004], province: "湖南省" },
  { name: "邵阳市", pinyin: "shaoyang", py: "sy", coords: [111.4692, 27.2378], province: "湖南省" },
  { name: "岳阳市", pinyin: "yueyang", py: "yy", coords: [113.1329, 29.3703], province: "湖南省" },
  { name: "常德市", pinyin: "changde", py: "cd", coords: [111.6913, 29.0402], province: "湖南省" },
  { name: "张家界市", pinyin: "zhangjiajie", py: "zjj", coords: [110.4799, 29.1274], province: "湖南省" },
  { name: "益阳市", pinyin: "yiyang", py: "yy", coords: [112.355, 28.5701], province: "湖南省" },
  { name: "郴州市", pinyin: "chenzhou", py: "cz", coords: [113.032, 25.7936], province: "湖南省" },
  { name: "永州市", pinyin: "yongzhou", py: "yz", coords: [111.608, 26.4345], province: "湖南省" },
  { name: "怀化市", pinyin: "huaihua", py: "hh", coords: [109.9782, 27.5501], province: "湖南省" },
  { name: "娄底市", pinyin: "loudi", py: "ld", coords: [111.994, 27.7281], province: "湖南省" },
  { name: "湘西土家族苗族自治州", pinyin: "xiangxi", py: "xx", coords: [109.7397, 28.312], province: "湖南省" },
  { name: "凤凰古城", pinyin: "fenghuang", py: "fh", coords: [109.6015, 27.9542], province: "湖南省" },
  { name: "广州市", pinyin: "guangzhou", py: "gz", coords: [113.2644, 23.1291], province: "广东省" },
  { name: "深圳市", pinyin: "shenzhen", py: "sz", coords: [114.0579, 22.5431], province: "广东省" },
  { name: "珠海市", pinyin: "zhuhai", py: "zh", coords: [113.5767, 22.2707], province: "广东省" },
  { name: "汕头市", pinyin: "shantou", py: "st", coords: [116.6819, 23.3541], province: "广东省" },
  { name: "佛山市", pinyin: "foshan", py: "fs", coords: [113.122, 23.0288], province: "广东省" },
  { name: "江门市", pinyin: "jiangmen", py: "jm", coords: [113.0815, 22.5787], province: "广东省" },
  { name: "湛江市", pinyin: "zhanjiang", py: "zj", coords: [110.3649, 21.2749], province: "广东省" },
  { name: "茂名市", pinyin: "maoming", py: "mm", coords: [110.9192, 21.6598], province: "广东省" },
  { name: "肇庆市", pinyin: "zhaoqing", py: "zq", coords: [112.4725, 23.0515], province: "广东省" },
  { name: "惠州市", pinyin: "huizhou", py: "hz", coords: [114.4172, 23.097], province: "广东省" },
  { name: "梅州市", pinyin: "meizhou", py: "mz", coords: [116.1176, 24.2991], province: "广东省" },
  { name: "汕尾市", pinyin: "shanwei", py: "sw", coords: [115.3642, 22.7745], province: "广东省" },
  { name: "河源市", pinyin: "heyuan", py: "hy", coords: [114.6978, 23.7463], province: "广东省" },
  { name: "阳江市", pinyin: "yangjiang", py: "yj", coords: [111.9751, 21.8566], province: "广东省" },
  { name: "清远市", pinyin: "qingyuan", py: "qy", coords: [113.0512, 23.685], province: "广东省" },
  { name: "东莞市", pinyin: "dongguan", py: "dg", coords: [113.7518, 23.0207], province: "广东省" },
  { name: "中山市", pinyin: "zhongshan", py: "zs", coords: [113.3824, 22.5211], province: "广东省" },
  { name: "潮州市", pinyin: "chaozhou", py: "cz", coords: [116.6323, 23.6617], province: "广东省" },
  { name: "揭阳市", pinyin: "jieyang", py: "jy", coords: [116.3557, 23.5438], province: "广东省" },
  { name: "云浮市", pinyin: "yunfu", py: "yf", coords: [112.0444, 22.9298], province: "广东省" },
  { name: "成都市", pinyin: "chengdu", py: "cd", coords: [104.0668, 30.5728], province: "四川省" },
  { name: "绵阳市", pinyin: "mianyang", py: "my", coords: [104.7417, 31.464], province: "四川省" },
  { name: "自贡市", pinyin: "zigong", py: "zg", coords: [104.7734, 29.3528], province: "四川省" },
  { name: "攀枝花市", pinyin: "panzhihua", py: "pzh", coords: [101.716, 26.5804], province: "四川省" },
  { name: "泸州市", pinyin: "luzhou", py: "lz", coords: [105.4433, 28.8891], province: "四川省" },
  { name: "德阳市", pinyin: "deyang", py: "dy", coords: [104.3986, 31.127], province: "四川省" },
  { name: "广元市", pinyin: "guangyuan", py: "gy", coords: [105.8297, 32.4337], province: "四川省" },
  { name: "遂宁市", pinyin: "suining", py: "sn", coords: [105.5713, 30.5133], province: "四川省" },
  { name: "内江市", pinyin: "neijiang", py: "nj", coords: [105.0661, 29.5871], province: "四川省" },
  { name: "乐山市", pinyin: "leshan", py: "ls", coords: [103.7613, 29.582], province: "四川省" },
  { name: "南充市", pinyin: "nanchong", py: "nc", coords: [106.0829, 30.7953], province: "四川省" },
  { name: "眉山市", pinyin: "meishan", py: "ms", coords: [103.8318, 30.0483], province: "四川省" },
  { name: "宜宾市", pinyin: "yibin", py: "yb", coords: [104.6308, 28.7602], province: "四川省" },
  { name: "广安市", pinyin: "guangan", py: "ga", coords: [106.6334, 30.4564], province: "四川省" },
  { name: "达州市", pinyin: "dazhou", py: "dz", coords: [107.5023, 31.2095], province: "四川省" },
  { name: "雅安市", pinyin: "yaan", py: "ya", coords: [103.001, 29.9877], province: "四川省" },
  { name: "巴中市", pinyin: "bazhong", py: "bz", coords: [106.7537, 31.8588], province: "四川省" },
  { name: "资阳市", pinyin: "ziyang", py: "zy", coords: [104.6419, 30.1222], province: "四川省" },
  { name: "阿坝藏族羌族自治州", pinyin: "aba", py: "ab", coords: [102.2214, 31.9056], province: "四川省" },
  { name: "甘孜藏族自治州", pinyin: "ganzi", py: "gz", coords: [101.9638, 30.0507], province: "四川省" },
  { name: "凉山彝族自治州", pinyin: "liangshan", py: "ls", coords: [102.2587, 27.8868], province: "四川省" },
  { name: "康定市", pinyin: "kangding", py: "kd", coords: [101.9647, 30.0489], province: "四川省" },
  { name: "四姑娘山镇", pinyin: "siguniangshan", py: "sgns", coords: [102.836, 30.998], province: "四川省" },
  { name: "都江堰市", pinyin: "dujiangyan", py: "djy", coords: [103.6194, 30.9982], province: "四川省" },
  { name: "西昌市", pinyin: "xichang", py: "xc", coords: [102.2641, 27.8953], province: "四川省" },
  { name: "稻城县", pinyin: "daocheng", py: "dc", coords: [100.2981, 29.0378], province: "四川省" },
  { name: "九寨沟县", pinyin: "jiuzhaigou", py: "jzg", coords: [104.2366, 33.2632], province: "四川省" },
  { name: "西安市", pinyin: "xian", py: "xa", coords: [108.9402, 34.3416], province: "陕西省" },
  { name: "铜川市", pinyin: "tongchuan", py: "tc", coords: [108.9631, 35.0833], province: "陕西省" },
  { name: "宝鸡市", pinyin: "baoji", py: "bj", coords: [107.1449, 34.3693], province: "陕西省" },
  { name: "咸阳市", pinyin: "xianyang", py: "xy", coords: [108.7051, 34.3299], province: "陕西省" },
  { name: "渭南市", pinyin: "weinan", py: "wn", coords: [109.5028, 34.4994], province: "陕西省" },
  { name: "延安市", pinyin: "yanan", py: "ya", coords: [109.4908, 36.5965], province: "陕西省" },
  { name: "汉中市", pinyin: "hanzhong", py: "hz", coords: [107.0286, 33.0777], province: "陕西省" },
  { name: "榆林市", pinyin: "yulin", py: "yl", coords: [109.7412, 38.2901], province: "陕西省" },
  { name: "安康市", pinyin: "ankang", py: "ak", coords: [109.0293, 32.6903], province: "陕西省" },
  { name: "商洛市", pinyin: "shangluo", py: "sl", coords: [109.9397, 33.8683], province: "陕西省" },
  { name: "昆明市", pinyin: "kunming", py: "km", coords: [102.8329, 24.8801], province: "云南省" },
  { name: "曲靖市", pinyin: "qujing", py: "qj", coords: [103.7978, 25.5015], province: "云南省" },
  { name: "玉溪市", pinyin: "yuxi", py: "yx", coords: [102.5439, 24.3504], province: "云南省" },
  { name: "保山市", pinyin: "baoshan", py: "bs", coords: [99.1671, 25.1205], province: "云南省" },
  { name: "昭通市", pinyin: "zhaotong", py: "zt", coords: [103.7172, 27.3369], province: "云南省" },
  { name: "丽江市", pinyin: "lijiang", py: "lj", coords: [100.233, 26.8721], province: "云南省" },
  { name: "普洱市", pinyin: "puer", py: "pe", coords: [100.9723, 22.7773], province: "云南省" },
  { name: "临沧市", pinyin: "lincang", py: "lc", coords: [100.0869, 23.8866], province: "云南省" },
  { name: "楚雄彝族自治州", pinyin: "chuxiong", py: "cx", coords: [101.546, 25.0419], province: "云南省" },
  { name: "红河哈尼族彝族自治州", pinyin: "honghe", py: "hh", coords: [103.3842, 23.3668], province: "云南省" },
  { name: "文山壮族苗族自治州", pinyin: "wenshan", py: "ws", coords: [104.2441, 23.3695], province: "云南省" },
  { name: "西双版纳傣族自治州", pinyin: "xishuangbanna", py: "xsbn", coords: [100.7979, 22.0017], province: "云南省" },
  { name: "大理白族自治州", pinyin: "dali", py: "dl", coords: [100.2256, 25.5894], province: "云南省" },
  { name: "德宏傣族景颇族自治州", pinyin: "dehong", py: "dh", coords: [98.5784, 24.4367], province: "云南省" },
  { name: "怒江傈僳族自治州", pinyin: "nujiang", py: "nj", coords: [98.8543, 25.8509], province: "云南省" },
  { name: "迪庆藏族自治州", pinyin: "diqing", py: "dq", coords: [99.7065, 27.8268], province: "云南省" },
  { name: "香格里拉市", pinyin: "xianggelila", py: "xgll", coords: [99.7073, 27.8251], province: "云南省" },
  { name: "腾冲市", pinyin: "tengchong", py: "tc", coords: [98.4941, 25.0254], province: "云南省" },
  { name: "贵阳市", pinyin: "guiyang", py: "gy", coords: [106.7135, 26.5783], province: "贵州省" },
  { name: "六盘水市", pinyin: "liupanshui", py: "lps", coords: [104.8467, 26.5846], province: "贵州省" },
  { name: "遵义市", pinyin: "zunyi", py: "zy", coords: [106.9373, 27.7066], province: "贵州省" },
  { name: "安顺市", pinyin: "anshun", py: "as", coords: [105.9321, 26.2455], province: "贵州省" },
  { name: "毕节市", pinyin: "bijie", py: "bj", coords: [105.285, 27.3017], province: "贵州省" },
  { name: "铜仁市", pinyin: "tongren", py: "tr", coords: [109.1915, 27.7183], province: "贵州省" },
  { name: "黔西南布依族苗族自治州", pinyin: "qianxinan", py: "qxn", coords: [104.8979, 25.0881], province: "贵州省" },
  { name: "黔东南苗族侗族自治州", pinyin: "qiandongnan", py: "qdn", coords: [107.9775, 26.5834], province: "贵州省" },
  { name: "黔南布依族苗族自治州", pinyin: "qiannan", py: "qn", coords: [107.5172, 26.2582], province: "贵州省" },
  { name: "拉萨市", pinyin: "lasa", py: "ls", coords: [91.1172, 29.6469], province: "西藏自治区" },
  { name: "日喀则市", pinyin: "rikaze", py: "rkz", coords: [88.8851, 29.2675], province: "西藏自治区" },
  { name: "昌都市", pinyin: "changdu", py: "cd", coords: [97.1785, 31.1369], province: "西藏自治区" },
  { name: "林芝市", pinyin: "linzhi", py: "lz", coords: [94.3623, 29.6547], province: "西藏自治区" },
  { name: "山南市", pinyin: "shannan", py: "sn", coords: [91.7665, 29.2361], province: "西藏自治区" },
  { name: "那曲市", pinyin: "naqu", py: "nq", coords: [92.0602, 31.476], province: "西藏自治区" },
  { name: "阿里地区", pinyin: "ali", py: "al", coords: [80.1055, 32.5037], province: "西藏自治区" },
  { name: "兰州市", pinyin: "lanzhou", py: "lz", coords: [103.8343, 36.0611], province: "甘肃省" },
  { name: "嘉峪关市", pinyin: "jiayuguan", py: "jyg", coords: [98.2773, 39.7865], province: "甘肃省" },
  { name: "金昌市", pinyin: "jinchang", py: "jc", coords: [102.1879, 38.5142], province: "甘肃省" },
  { name: "白银市", pinyin: "baiyin", py: "by", coords: [104.1736, 36.5456], province: "甘肃省" },
  { name: "天水市", pinyin: "tianshui", py: "ts", coords: [105.7249, 34.5785], province: "甘肃省" },
  { name: "武威市", pinyin: "wuwei", py: "ww", coords: [102.6347, 37.9299], province: "甘肃省" },
  { name: "张掖市", pinyin: "zhangye", py: "zy", coords: [100.4555, 38.9328], province: "甘肃省" },
  { name: "平凉市", pinyin: "pingliang", py: "pl", coords: [106.6847, 35.5427], province: "甘肃省" },
  { name: "酒泉市", pinyin: "jiuquan", py: "jq", coords: [98.5108, 39.744], province: "甘肃省" },
  { name: "庆阳市", pinyin: "qingyang", py: "qy", coords: [107.6384, 35.7342], province: "甘肃省" },
  { name: "定西市", pinyin: "dingxi", py: "dx", coords: [104.6263, 35.5796], province: "甘肃省" },
  { name: "陇南市", pinyin: "longnan", py: "ln", coords: [104.9294, 33.3886], province: "甘肃省" },
  { name: "临夏回族自治州", pinyin: "linxia", py: "lx", coords: [103.212, 35.5994], province: "甘肃省" },
  { name: "甘南藏族自治州", pinyin: "gannan", py: "gn", coords: [102.911, 34.9864], province: "甘肃省" },
  { name: "敦煌市", pinyin: "dunhuang", py: "dh", coords: [94.662, 40.1421], province: "甘肃省" },
  { name: "西宁市", pinyin: "xining", py: "xn", coords: [101.7789, 36.6231], province: "青海省" },
  { name: "海东市", pinyin: "haidong", py: "hd", coords: [102.1033, 36.5029], province: "青海省" },
  { name: "海北藏族自治州", pinyin: "haibei", py: "hb", coords: [100.9011, 36.9594], province: "青海省" },
  { name: "黄南藏族自治州", pinyin: "huangnan", py: "hn", coords: [102.0152, 35.5177], province: "青海省" },
  { name: "海南藏族自治州", pinyin: "hainan", py: "hn", coords: [100.6195, 36.2804], province: "青海省" },
  { name: "果洛藏族自治州", pinyin: "guoluo", py: "gl", coords: [100.2421, 34.4736], province: "青海省" },
  { name: "玉树藏族自治州", pinyin: "yushu", py: "ys", coords: [97.0085, 33.0062], province: "青海省" },
  { name: "海西蒙古族藏族自治州", pinyin: "haixi", py: "hx", coords: [97.3708, 37.3746], province: "青海省" },
  { name: "格尔木市", pinyin: "geermu", py: "gem", coords: [94.9033, 36.4024], province: "青海省" },
  { name: "银川市", pinyin: "yinchuan", py: "yc", coords: [106.2781, 38.4664], province: "宁夏回族自治区" },
  { name: "石嘴山市", pinyin: "shizuishan", py: "szs", coords: [106.3762, 39.0133], province: "宁夏回族自治区" },
  { name: "吴忠市", pinyin: "wuzhong", py: "wz", coords: [106.1994, 37.9862], province: "宁夏回族自治区" },
  { name: "固原市", pinyin: "guyuan", py: "gy", coords: [106.2852, 36.0046], province: "宁夏回族自治区" },
  { name: "中卫市", pinyin: "zhongwei", py: "zw", coords: [105.1896, 37.5149], province: "宁夏回族自治区" },
  { name: "乌鲁木齐市", pinyin: "wulumuqi", py: "wlmq", coords: [87.6177, 43.7928], province: "新疆维吾尔自治区" },
  { name: "克拉玛依市", pinyin: "kelamayi", py: "klmy", coords: [84.8739, 45.5959], province: "新疆维吾尔自治区" },
  { name: "吐鲁番市", pinyin: "tulufan", py: "tlf", coords: [89.1841, 42.9476], province: "新疆维吾尔自治区" },
  { name: "哈密市", pinyin: "hami", py: "hm", coords: [93.5132, 42.8332], province: "新疆维吾尔自治区" },
  { name: "昌吉回族自治州", pinyin: "changji", py: "cj", coords: [87.304, 44.0146], province: "新疆维吾尔自治区" },
  { name: "博尔塔拉蒙古自治州", pinyin: "boertala", py: "betl", coords: [82.0748, 44.9033], province: "新疆维吾尔自治区" },
  { name: "巴音郭楞蒙古自治州", pinyin: "bayinguoleng", py: "bygl", coords: [86.15, 41.7641], province: "新疆维吾尔自治区" },
  { name: "阿克苏地区", pinyin: "akesu", py: "aks", coords: [80.2651, 41.1707], province: "新疆维吾尔自治区" },
  { name: "克孜勒苏柯尔克孜自治州", pinyin: "kezilesu", py: "kzls", coords: [76.1728, 39.7134], province: "新疆维吾尔自治区" },
  { name: "喀什地区", pinyin: "kashi", py: "ks", coords: [75.9891, 39.4677], province: "新疆维吾尔自治区" },
  { name: "和田地区", pinyin: "hetian", py: "ht", coords: [79.9253, 37.1107], province: "新疆维吾尔自治区" },
  { name: "伊犁哈萨克自治州", pinyin: "yili", py: "yl", coords: [81.3179, 43.9219], province: "新疆维吾尔自治区" },
  { name: "塔城地区", pinyin: "tacheng", py: "tc", coords: [82.9857, 46.7463], province: "新疆维吾尔自治区" },
  { name: "阿勒泰地区", pinyin: "aletai", py: "alt", coords: [88.1396, 47.8484], province: "新疆维吾尔自治区" },
  { name: "呼和浩特市", pinyin: "huhehaote", py: "hhht", coords: [111.6708, 40.8183], province: "内蒙古自治区" },
  { name: "包头市", pinyin: "baotou", py: "bt", coords: [109.8404, 40.6582], province: "内蒙古自治区" },
  { name: "乌海市", pinyin: "wuhai", py: "wh", coords: [106.8247, 39.6737], province: "内蒙古自治区" },
  { name: "赤峰市", pinyin: "chifeng", py: "cf", coords: [118.9568, 42.2753], province: "内蒙古自治区" },
  { name: "通辽市", pinyin: "tongliao", py: "tl", coords: [122.2631, 43.6174], province: "内蒙古自治区" },
  { name: "鄂尔多斯市", pinyin: "eerduosi", py: "eeds", coords: [109.9903, 39.8172], province: "内蒙古自治区" },
  { name: "呼伦贝尔市", pinyin: "hulunbeier", py: "hlbe", coords: [119.7582, 49.2153], province: "内蒙古自治区" },
  { name: "巴彦淖尔市", pinyin: "bayannaoer", py: "byne", coords: [107.4169, 40.7574], province: "内蒙古自治区" },
  { name: "乌兰察布市", pinyin: "wulanchabu", py: "wlcb", coords: [113.1145, 41.0341], province: "内蒙古自治区" },
  { name: "兴安盟", pinyin: "xinganmeng", py: "xam", coords: [122.0703, 46.0763], province: "内蒙古自治区" },
  { name: "锡林郭勒盟", pinyin: "xilinguolemeng", py: "xlglm", coords: [116.0909, 43.944], province: "内蒙古自治区" },
  { name: "阿拉善盟", pinyin: "alashanmeng", py: "alsm", coords: [105.7064, 38.8448], province: "内蒙古自治区" },
  { name: "沈阳市", pinyin: "shenyang", py: "sy", coords: [123.429, 41.7967], province: "辽宁省" },
  { name: "大连市", pinyin: "dalian", py: "dl", coords: [121.6186, 38.9146], province: "辽宁省" },
  { name: "鞍山市", pinyin: "anshan", py: "as", coords: [122.9956, 41.1106], province: "辽宁省" },
  { name: "抚顺市", pinyin: "fushun", py: "fs", coords: [123.9211, 41.8759], province: "辽宁省" },
  { name: "本溪市", pinyin: "benxi", py: "bx", coords: [123.738, 41.2941], province: "辽宁省" },
  { name: "丹东市", pinyin: "dandong", py: "dd", coords: [124.3838, 40.129], province: "辽宁省" },
  { name: "锦州市", pinyin: "jinzhou", py: "jz", coords: [121.127, 41.0951], province: "辽宁省" },
  { name: "营口市", pinyin: "yingkou", py: "yk", coords: [122.2352, 40.667], province: "辽宁省" },
  { name: "阜新市", pinyin: "fuxin", py: "fx", coords: [121.6489, 42.0118], province: "辽宁省" },
  { name: "辽阳市", pinyin: "liaoyang", py: "ly", coords: [123.1732, 41.2694], province: "辽宁省" },
  { name: "盘锦市", pinyin: "panjin", py: "pj", coords: [122.0696, 41.1245], province: "辽宁省" },
  { name: "铁岭市", pinyin: "tieling", py: "tl", coords: [123.8443, 42.2905], province: "辽宁省" },
  { name: "朝阳市", pinyin: "chaoyang", py: "cy", coords: [120.4511, 41.5768], province: "辽宁省" },
  { name: "葫芦岛市", pinyin: "huludao", py: "hld", coords: [120.8564, 40.7556], province: "辽宁省" },
  { name: "长春市", pinyin: "changchun", py: "cc", coords: [125.3245, 43.8868], province: "吉林省" },
  { name: "吉林市", pinyin: "jilin", py: "jl", coords: [126.553, 43.8436], province: "吉林省" },
  { name: "四平市", pinyin: "siping", py: "sp", coords: [124.3708, 43.1703], province: "吉林省" },
  { name: "辽源市", pinyin: "liaoyuan", py: "ly", coords: [125.1453, 42.9027], province: "吉林省" },
  { name: "通化市", pinyin: "tonghua", py: "th", coords: [125.9365, 41.7212], province: "吉林省" },
  { name: "白山市", pinyin: "baishan", py: "bs", coords: [126.4278, 41.9423], province: "吉林省" },
  { name: "松原市", pinyin: "songyuan", py: "sy", coords: [124.8236, 45.1183], province: "吉林省" },
  { name: "白城市", pinyin: "baicheng", py: "bc", coords: [122.8411, 45.619], province: "吉林省" },
  { name: "延边朝鲜族自治州", pinyin: "yanbian", py: "yb", coords: [129.5132, 42.9048], province: "吉林省" },
  { name: "哈尔滨市", pinyin: "haerbin", py: "hrb", coords: [126.6424, 45.7569], province: "黑龙江省" },
  { name: "齐齐哈尔市", pinyin: "qiqihaer", py: "qqhe", coords: [123.9579, 47.3421], province: "黑龙江省" },
  { name: "鸡西市", pinyin: "jixi", py: "jx", coords: [130.9759, 45.3], province: "黑龙江省" },
  { name: "鹤岗市", pinyin: "hegang", py: "hg", coords: [130.2775, 47.3321], province: "黑龙江省" },
  { name: "双鸭山市", pinyin: "shuangyashan", py: "sys", coords: [131.1573, 46.6434], province: "黑龙江省" },
  { name: "大庆市", pinyin: "daqing", py: "dq", coords: [125.1127, 46.5879], province: "黑龙江省" },
  { name: "伊春市", pinyin: "yichun", py: "yc", coords: [128.8994, 47.7248], province: "黑龙江省" },
  { name: "佳木斯市", pinyin: "jiamusi", py: "jms", coords: [130.3616, 46.8096], province: "黑龙江省" },
  { name: "七台河市", pinyin: "qitaihe", py: "qth", coords: [131.0155, 45.7713], province: "黑龙江省" },
  { name: "牡丹江市", pinyin: "mudanjiang", py: "mdj", coords: [129.6186, 44.583], province: "黑龙江省" },
  { name: "黑河市", pinyin: "heihe", py: "hh", coords: [127.499, 50.2496], province: "黑龙江省" },
  { name: "绥化市", pinyin: "suihua", py: "sh", coords: [126.9929, 46.6374], province: "黑龙江省" },
  { name: "大兴安岭地区", pinyin: "daxinganling", py: "dxal", coords: [124.7115, 52.3353], province: "黑龙江省" },
  { name: "南宁市", pinyin: "nanning", py: "nn", coords: [108.32, 22.824], province: "广西壮族自治区" },
  { name: "柳州市", pinyin: "liuzhou", py: "lz", coords: [109.4117, 24.3146], province: "广西壮族自治区" },
  { name: "桂林市", pinyin: "guilin", py: "gl", coords: [110.2991, 25.2742], province: "广西壮族自治区" },
  { name: "梧州市", pinyin: "wuzhou", py: "wz", coords: [111.2976, 23.4748], province: "广西壮族自治区" },
  { name: "北海市", pinyin: "beihai", py: "bh", coords: [109.1193, 21.4733], province: "广西壮族自治区" },
  { name: "防城港市", pinyin: "fangchenggang", py: "fcg", coords: [108.3455, 21.6146], province: "广西壮族自治区" },
  { name: "钦州市", pinyin: "qinzhou", py: "qz", coords: [108.6242, 21.9671], province: "广西壮族自治区" },
  { name: "贵港市", pinyin: "guigang", py: "gg", coords: [109.6021, 23.0936], province: "广西壮族自治区" },
  { name: "玉林市", pinyin: "yulin", py: "yl", coords: [110.1544, 22.6314], province: "广西壮族自治区" },
  { name: "百色市", pinyin: "baise", py: "bs", coords: [106.6163, 23.8977], province: "广西壮族自治区" },
  { name: "贺州市", pinyin: "hezhou", py: "hz", coords: [111.5521, 24.4141], province: "广西壮族自治区" },
  { name: "河池市", pinyin: "hechi", py: "hc", coords: [108.0621, 24.6959], province: "广西壮族自治区" },
  { name: "来宾市", pinyin: "laibin", py: "lb", coords: [109.2298, 23.7338], province: "广西壮族自治区" },
  { name: "崇左市", pinyin: "chongzuo", py: "cz", coords: [107.3539, 22.4041], province: "广西壮族自治区" },
  { name: "阳朔县", pinyin: "yangshuo", py: "ys", coords: [110.4947, 24.7766], province: "广西壮族自治区" },
  { name: "海口市", pinyin: "haikou", py: "hk", coords: [110.3312, 20.0319], province: "海南省" },
  { name: "三亚市", pinyin: "sanya", py: "sy", coords: [109.5083, 18.2479], province: "海南省" },
  { name: "三沙市", pinyin: "sansha", py: "ss", coords: [112.3488, 16.8387], province: "海南省" },
  { name: "儋州市", pinyin: "danzhou", py: "dz", coords: [109.5768, 19.5175], province: "海南省" },
  { name: "香港特别行政区", pinyin: "xianggang", py: "xg", coords: [114.1654, 22.2753], province: "香港" },
  { name: "澳门特别行政区", pinyin: "aomen", py: "am", coords: [113.5491, 22.1987], province: "澳门" },
  { name: "台北市", pinyin: "taibei", py: "tb", coords: [121.5654, 25.033], province: "台湾省" },
  { name: "高雄市", pinyin: "gaoxiong", py: "gx", coords: [120.3014, 22.6273], province: "台湾省" },
  { name: "台中市", pinyin: "taizhong", py: "tz", coords: [120.6736, 24.1477], province: "台湾省" }
];

let mapInstance = null;
let currentExaggeration = 2.0;
let currentStyle = 'outmap';
let is3DView = true;
let isPitchLocked = true;
let updatePitchLockFn = null;

let provinceMarkers = [];
let cityMarkers = [];
let currentLandingMarker = null;
let localServerPort = 28795;
let totalOfflineCount = 0;
let totalOfflineBytes = 0;

// 离线瓦片计数格式化 (支持中文“万/亿”与体积清晰表达，彻底消除 200k 与 200KB 的误解)
function formatTileCount(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const num = Number(n);
  if (num < 1000) return num.toString();
  if (num < 10000) {
    const k = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}k`;
  }
  if (num < 100000000) {
    const wan = (num / 10000).toFixed(1).replace(/\.0$/, '');
    return `${wan}万`;
  }
  const yi = (num / 100000000).toFixed(1).replace(/\.0$/, '');
  return `${yi}亿`;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  if (bytes >= 1073741824) {
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }
  if (bytes >= 1048576) {
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  return (bytes / 1024).toFixed(0) + ' KB';
}

function formatTileDisplay(count, bytes) {
  const countStr = formatTileCount(count);
  if (bytes && bytes > 0) {
    return `${countStr} (${formatBytes(bytes)})`;
  }
  if (count >= 10000) {
    const estBytes = count * 38000;
    return `${countStr} (${formatBytes(estBytes)})`;
  }
  return countStr;
}

// 智能双向合并算法与跨端删除墓碑机制 (彻底解决设备随机ID冲突、死而复生与坐标小数位漂移)
function getDeletedWaypoints() {
  try {
    return JSON.parse(localStorage.getItem('outmap_deleted_waypoints') || '[]');
  } catch (e) {
    return [];
  }
}

function addDeletedWaypointTombstone(wp) {
  if (!wp) return;
  try {
    const list = getDeletedWaypoints();
    const id = wp.id;
    const lng = Number(wp.lng ?? wp.coords?.[0]);
    const lat = Number(wp.lat ?? wp.coords?.[1]);
    const name = (wp.name || '').trim();
    list.push({
      id,
      name,
      lng: Number.isFinite(lng) ? lng.toFixed(5) : null,
      lat: Number.isFinite(lat) ? lat.toFixed(5) : null,
      time: Date.now()
    });
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const trimmed = list.filter(item => item.time > cutoff).slice(-500);
    localStorage.setItem('outmap_deleted_waypoints', JSON.stringify(trimmed));
  } catch (e) {}
}

function normalizeWaypoint(wp) {
  if (!wp || typeof wp !== 'object') return null;
  const lng = Number(wp.lng ?? wp.coords?.[0]);
  const lat = Number(wp.lat ?? wp.coords?.[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    ...wp,
    id: wp.id || `wp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: (wp.name || '地标').trim(),
    type: wp.type || 'camp',
    folder: wp.folder || 'default',
    lng,
    lat,
    coords: [lng, lat],
    ele: (wp.ele !== undefined && wp.ele !== null) ? wp.ele : 0,
    time: wp.time || new Date().toLocaleDateString()
  };
}

function areWaypointsEqual(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  const dLng = Math.abs(a.lng - b.lng);
  const dLat = Math.abs(a.lat - b.lat);
  const sameCoords = dLng < 0.00005 && dLat < 0.00005; // 约 5 米以内
  const sameName = a.name && b.name && a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
  if (sameCoords) return true;
  if (sameName && dLng < 0.001 && dLat < 0.001) return true; // 同名且在 100 米内
  return false;
}

function isWaypointDeleted(wp, deletedList = []) {
  if (!wp || !deletedList.length) return false;
  for (const d of deletedList) {
    if (wp.id && d.id && wp.id === d.id) return true;
    if (d.name && wp.name && d.name.trim() === wp.name.trim()) {
      if (d.lng && d.lat && wp.lng !== undefined && wp.lat !== undefined) {
        const dLng = Math.abs(Number(d.lng) - wp.lng);
        const dLat = Math.abs(Number(d.lat) - wp.lat);
        if (dLng < 0.001 && dLat < 0.001) return true;
      }
    }
  }
  return false;
}

function mergeWaypoints(localList = [], cloudList = [], deletedList = []) {
  const allDeleted = deletedList.length ? deletedList : getDeletedWaypoints();
  const result = [];
  const normalizedLocal = (localList || []).map(normalizeWaypoint).filter(Boolean);
  const normalizedCloud = (cloudList || []).map(normalizeWaypoint).filter(Boolean);

  const combined = [...normalizedLocal, ...normalizedCloud];
  for (const item of combined) {
    if (isWaypointDeleted(item, allDeleted)) continue;
    const existingIdx = result.findIndex(r => areWaypointsEqual(r, item));
    if (existingIdx < 0) {
      result.push(item);
    } else {
      const existing = result[existingIdx];
      result[existingIdx] = {
        ...item,
        ...existing,
        name: existing.name || item.name,
        ele: (existing.ele !== undefined && existing.ele !== 0) ? existing.ele : item.ele,
        folder: (existing.folder && existing.folder !== 'default') ? existing.folder : (item.folder || 'default')
      };
    }
  }
  return result;
}

function mergeRoutes(localList = [], cloudList = []) {
  const result = [];
  const combined = [...(localList || []), ...(cloudList || [])];
  for (const item of combined) {
    if (!item) continue;
    const dist = item.metrics?.distKm ?? item.distance ?? 0;
    const name = (item.name || '').trim();
    const existingIdx = result.findIndex(r => {
      if (r.id && item.id && r.id === item.id) return true;
      const rDist = r.metrics?.distKm ?? r.distance ?? 0;
      const rName = (r.name || '').trim();
      return rName === name && Math.abs(rDist - dist) < 0.1;
    });
    if (existingIdx < 0) {
      result.push(item);
    }
  }
  return result;
}

function mergeFolders(localList = [], cloudList = []) {
  const result = [];
  const set = new Set();
  [...(localList || []), ...(cloudList || [])].forEach(f => {
    if (!f) return;
    const id = typeof f === 'string' ? f : (f.id || f.name);
    const name = typeof f === 'string' ? f : f.name;
    const key = (name || id || '').trim();
    if (key && !set.has(key)) {
      set.add(key);
      result.push(typeof f === 'string' ? { id: key, name: key } : f);
    }
  });
  return result;
}

async function initApplication() {
  let port = 28795;
  totalOfflineCount = 0;
  totalOfflineBytes = 0;


  if (window.electronAPI) {
    try {
      const info = await window.electronAPI.getTileServerInfo();
      if (info) {
        port = info.port;
        localServerPort = info.port;
        totalOfflineCount = info.totalTiles || ((info.demCount || 0) + (info.vectorCount || 0) + (info.satCount || 0));
        totalOfflineBytes = info.totalBytes || 0;
      }
    } catch (e) {}

    // 地图首屏不等待全国离线清单扫描。磁盘清单在后台成为权威快照，
    // 云同步则由 setupCloudSync 在地图与收藏系统就绪后仅执行一次。
    syncOfflineManifest().catch(() => {});
  }

  const isWebMode = !window.electronAPI;
  if (isWebMode) {
    document.body.classList.add('web-mode');
    document.documentElement.classList.add('web-mode');
    const dlBtn = document.getElementById('btn-open-pyramid-dl');
    if (dlBtn) dlBtn.style.display = 'none';
  }

  const titleStat = document.getElementById('titlebar-cache-stat');
  if (titleStat) {
    if (isWebMode) {
      titleStat.style.display = 'none';
    } else {
      titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;

      if (window.electronAPI && window.electronAPI.onOfflineScanProgress) {
        window.electronAPI.onOfflineScanProgress(data => {
          if (data && data.count) {
            titleStat.innerText = `离线: 扫描中 (${formatTileCount(data.count)})`;
          }
        });
      }

      if (window.electronAPI && window.electronAPI.onOfflineInventoryUpdated) {
        window.electronAPI.onOfflineInventoryUpdated(data => {
          if (data && data.stats) {
            totalOfflineCount = data.stats.totalTiles || 0;
            totalOfflineBytes = data.stats.totalBytes || 0;
            titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
          }
          if (data && data.provinces) {
            offlineProvCache = data.provinces;
            try { localStorage.setItem('outmap_offline_provinces', JSON.stringify(data.provinces)); } catch (e) {}
            window.refreshOfflineProvinceGrid?.();
          }
        });
      }

      titleStat.addEventListener('click', async () => {
        titleStat.innerText = '离线: 扫描中...';
        try {
          if (window.electronAPI && window.electronAPI.rescanOfflineTiles) {
            const stats = await window.electronAPI.rescanOfflineTiles();
            if (stats) {
              totalOfflineCount = stats.totalTiles || 0;
              totalOfflineBytes = stats.totalBytes || 0;
              titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
            }
          }
        } catch (e) {
          titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
        }
      });
    }
  }

  // 瓦片 API 体系：在 Electron 下默认使用本地离线服务；在 Web 纯网页端直连在线瓦片 CDN
  // 瓦片 API 体系：在 Electron 下默认使用本地离线服务；在 Web 纯网页端直连在线瓦片 CDN
  let demUrl = `http://127.0.0.1:${port}/dem/{z}/{x}/{y}.webp`;
  let vecUrl = `http://127.0.0.1:${port}/vector/{z}/{x}/{y}.pbf`;
  let glyphsUrl = `http://127.0.0.1:${port}/fonts/{fontstack}/{range}.pbf`;
  let chinaBoundaryUrl = `http://127.0.0.1:${port}/china-boundary.json`;

  if (isWebMode) {
    chinaBoundaryUrl = './china-boundary.json?v=' + APP_VERSION;

    // 默认高可用全球免 Key 在线 CDN (OpenFreeMap + Mapterhorn Terrarium DEM)
    // 零服务器依赖，全球 300+ 边缘节点毫秒级直连，任何设备浏览器开箱即用
    const onlineDem = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
    const onlineVec = 'https://tiles.openfreemap.org/planet/20260830_080001_pt/{z}/{x}/{y}.pbf';
    const onlineGlyphs = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

    demUrl = onlineDem;
    vecUrl = onlineVec;
    glyphsUrl = onlineGlyphs;

    // 清除旧版本误存的前端域名自定义瓦片源配置
    const legacyTileApi = (localStorage.getItem('outmap_custom_tile_api') || '').replace(/\/+$/, '').toLowerCase();
    if (legacyTileApi === 'https://map.053999.xyz' || legacyTileApi === 'http://map.053999.xyz') {
      localStorage.removeItem('outmap_custom_tile_api');
    }

    // 若用户显式配置了独立的自建瓦片服务后端，且该后端不等于当前前端页面域名
    const userCustomTileApi = localStorage.getItem('outmap_custom_tile_api');
    if (userCustomTileApi && !userCustomTileApi.includes(window.location.hostname)) {
      try {
        const cleanApi = userCustomTileApi.replace(/\/+$/, '');
        const probe = await fetch(`${cleanApi}/vector/0/0/0.pbf`, { method: 'HEAD', signal: AbortSignal.timeout(1500) }).catch(() => null);
        const probeType = probe?.headers?.get('content-type') || '';
        if (probe && probe.ok && /(protobuf|vector-tile|octet-stream)/i.test(probeType)) {
          vecUrl = `${cleanApi}/vector/{z}/{x}/{y}.pbf`;
          demUrl = `${cleanApi}/dem/{z}/{x}/{y}.webp`;
          glyphsUrl = `${cleanApi}/fonts/{fontstack}/{range}.pbf`;
          console.log(`[Online Mode] 已成功连接自定义自建瓦片后端: ${cleanApi}`);
        }
      } catch (e) {
        console.warn(`[Online Mode] 自建瓦片后端暂不可达，保持使用高可用全球 CDN`);
      }
    }
  }

  // 桌面保留高容量缓存；网页尤其是手机按设备内存降级，避免纹理抖动、换页和 Safari 重载。
  const deviceMemory = navigator.deviceMemory || 4;
  const compactDevice = window.matchMedia?.('(max-width: 768px), (pointer: coarse)').matches;
  const constrainedWeb = isWebMode && (compactDevice || deviceMemory <= 4);
  const mapPerformance = constrainedWeb
    ? { workers: 2, demCache: 96, tileCache: 256, prefetch: 0 }
    : isWebMode
      ? { workers: Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1)), demCache: 192, tileCache: 512, prefetch: 1 }
      : { workers: Math.min(6, Math.max(4, (navigator.hardwareConcurrency || 4))), demCache: 384, tileCache: 1024, prefetch: 1 };
  maplibregl.workerCount = mapPerformance.workers;

  // DEM 解码缓存按设备分级。无上限扩大会在长时间飞掠后造成内存/显存压力与回收卡顿。
  const demSource = new mlcontour.DemSource({
    url: demUrl,
    encoding: 'terrarium',
    maxzoom: 12,
    worker: true,
    cacheSize: mapPerformance.demCache,
    timeoutMs: 16000
  });
  demSource.setupMaplibre(maplibregl);

  // 2. 初始化 MapLibre 地图实例。桌面保留充足缓存，但避免全国飞掠后长期持有数千纹理。
  mapInstance = new maplibregl.Map({
    container: 'map',
    center: [104.5000, 36.0000],
    zoom: 4.45,
    pitch: 50,
    bearing: 0,
    minZoom: 3.8, // 缩放锁定在中国大陆框架视野，防止无意义过度缩放至极小球体
    maxZoom: 17, // 限制最大缩放层级为 17 级（已达建筑物与门牌商铺细节，杜绝深层切片拉伸与显存浪费，大幅提升流畅度）
    maxPitch: 85,
    maxBounds: [[68.0, 10.0], [140.0, 56.0]], // 中国地理框架软约束，原生阻尼回弹防飘出
    fadeDuration: 180, // 使用 MapLibre 原生短淡入淡出，避免跨层级时标签硬切和闪现
    ...(constrainedWeb ? { pixelRatio: Math.min(window.devicePixelRatio || 1, 2) } : {}),
    cancelPendingTileRequestsWhileZooming: true,
    refreshExpiredTiles: false,
    localIdeographFontFamily: 'Microsoft YaHei, "PingFang SC", "Noto Sans CJK SC", sans-serif', // 本地系统字体瞬时光栅化，零延迟零丢字零闪烁
    attributionControl: false,
    renderWorldCopies: false, // 禁用经度环绕复制，削减 50% 无效 Draw Call
    maxTileCacheSize: mapPerformance.tileCache,
    style: {
      version: 8,
      glyphs: glyphsUrl,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#f2f1ec'
          }
        }
      ]
    }
  });

  const map = mapInstance;
  window.mapInstance = map;
  if (typeof map.setPrefetchZoomDelta === 'function') {
    map.setPrefetchZoomDelta(mapPerformance.prefetch);
  }


  // 鼠标按压拖拽地图时实时切换为紧握拳头手型，松手恢复平展打开手掌 (0 毫秒延迟，无缝跟随)
  map.on('dragstart', () => { document.body.classList.add('map-is-dragging'); });
  map.on('dragend', () => { document.body.classList.remove('map-is-dragging'); });
  map.on('movestart', () => { document.body.classList.add('map-is-moving'); });
  map.on('moveend', () => { document.body.classList.remove('map-is-moving'); });

  map.on('load', () => {
    // `isStyleLoaded()` can temporarily turn false again while this handler adds
    // terrain/vector sources.  Keep a monotonic readiness flag for Outmap's own
    // runtime layers so they cannot miss the one-time load event.
    map.__outmapStyleReady = true;
    // 3D 地形高度网格
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: [demSource.sharedDemProtocolUrl],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 12
    });

    map.setTerrain({
      source: 'terrain-dem',
      exaggeration: currentExaggeration
    });

    let terrainRealignDebounce = null;
    map.on('sourcedata', (e) => {
      if (e.sourceId === 'terrain-dem' && e.isSourceLoaded) {
        if (map.isMoving() || map.isZooming() || map.isRotating()) return;
        if (!terrainRealignDebounce) {
          terrainRealignDebounce = setTimeout(() => {
            terrainRealignDebounce = null;
            if (map.isMoving() || map.isZooming() || map.isRotating()) return;
            if (typeof refreshRouteElevationProfile === 'function') {
              refreshRouteElevationProfile(map);
            }
          }, 350);
        }
      }
    });
    // DEM高程图立体光照阴影渲染 (Apple Maps / Topo 柔和自然阴影，杜绝 OLED 强光刺眼)
    map.addLayer({
      id: 'hillshade-layer',
      type: 'hillshade',
      source: 'terrain-dem',
      paint: {
        'hillshade-exaggeration': 0.65,
        'hillshade-highlight-color': '#ffffff',
        'hillshade-shadow-color': '#667064',
        'hillshade-accent-color': '#e7ebe2'
      }
    });

    // 全量矢量地理要素源
    map.addSource('osm-vector-source', {
      type: 'vector',
      tiles: [vecUrl],
      maxzoom: 14
    });

    // 居住区/小区/住宅区功能用地轮廓 (Apple Maps 雅致暖灰)
    map.addLayer({
      id: 'osm-landuse-residential',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['residential', 'suburb'], true, false],
      paint: {
        'fill-color': '#e9e7e1',
        'fill-opacity': 0.45
      }
    });

    map.addLayer({
      id: 'osm-landuse-commercial',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['commercial', 'industrial', 'school', 'hospital'], true, false],
      paint: {
        'fill-color': '#efece6',
        'fill-opacity': 0.35
      }
    });

    // 森林与自然植被 (Apple Maps 经典鼠尾草柔绿，护眼舒适)
    map.addLayer({
      id: 'osm-forest-layer',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['wood', 'forest', 'scrub', 'grass'], true, false],
      paint: {
        'fill-color': '#ddefcf',
        'fill-opacity': 0.55
      }
    });

    // 湖泊水库 (Apple Maps 柔和恬静石板天蓝，彻底替换刺眼高亮青蓝)
    map.addLayer({
      id: 'osm-water-layer',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'water',
      paint: {
        'fill-color': '#a8d8f0',
        'fill-opacity': 0.9
      }
    });

    // 河流水系 (Apple Maps 柔和水系主线)
    map.addLayer({
      id: 'osm-waterway-layer',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#75b9df',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 2.0, 14, 3.2],
        'line-opacity': 0.85
      }
    });

    // 湖泊、水库大水系名称注记 (Apple Maps 雅致水系文字)
    map.addLayer({
      id: 'osm-water-names',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'water_name',
      minzoom: 5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9.5, 9, 11, 13, 13],
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#397aa6',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // 沿河流走向的江河溪流水系注记
    map.addLayer({
      id: 'osm-waterway-names',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'waterway',
      filter: ['has', 'name'],
      minzoom: 6,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9.0, 10, 11, 14, 12.5],
        'symbol-spacing': 240,
        'text-max-angle': 45,
        'text-keep-upright': true
      },
      paint: {
        'text-color': '#397aa6',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // =========================================================
    // 中国国家法定标准国界与十段线系统 (标准 WGS-84 坐标，严防缩放偏差与错位)
    // 兼备：微观米级贴合 (切片 boundary 图层) 与 宏观标准法定版图 (十段线与标准陆界)
    // =========================================================
    map.addSource('china-boundary-source', {
      type: 'geojson',
      data: chinaBoundaryUrl
    });

    // 1. 省级行政区界线 (底图原生矢量切片，Zoom 4+ 优雅显现)
    map.addLayer({
      id: 'osm-boundary-province',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 4],
      minzoom: 4,
      paint: {
        'line-color': '#b5b2ac',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 8, 1.4, 12, 1.8],
        'line-dasharray': [4, 2],
        'line-opacity': 0.75
      }
    });

    // 2. 底图切片陆地国界主线 (过滤海上领海边界，微观视口下沿江沿脊贴合，苹果地图极简暖灰风格)
    map.addLayer({
      id: 'osm-boundary-country',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'boundary',
      filter: [
        'all',
        ['==', ['get', 'admin_level'], 2],
        ['!=', ['get', 'maritime'], 1],
        ['!=', ['get', 'maritime'], '1']
      ],
      minzoom: 3,
      paint: {
        'line-color': '#78716c',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.0, 6, 1.4, 10, 2.0],
        'line-dasharray': [5, 3],
        'line-opacity': 0.55
      }
    });

    // 3. 中国法定陆地国界主线 (苹果地图沉稳暖灰，自然写意融入山水，无突兀红线)
    map.addLayer({
      id: 'china-boundary-national-line',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'boundary'],
      paint: {
        'line-color': '#78716c',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 5, 1.8, 9, 2.6],
        'line-opacity': 0.65
      }
    });

    // 4. 中国南海诸岛十段线 (苹果地图沉稳暖灰规范断续线)
    map.addLayer({
      id: 'china-boundary-ten-dash-line',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'ten_dash_line'],
      paint: {
        'line-color': '#78716c',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 5, 2.0, 9, 3.0],
        'line-opacity': 0.7
      }
    });

    // 地形等高线 (全缩放层级无缝覆盖，Zoom 6 起清晰显现山地宏观走势，近景至 L15+ 细腻呈现)
    map.addSource('contour-source', {
      type: 'vector',
      tiles: [
        demSource.contourProtocolUrl({
          multiplier: 1,
          thresholds: {
            6: [1000, 2500],
            8: [500, 2000],
            10: [200, 1000],
            11: [100, 500],
            12: [100, 500],
            13: [50, 250],
            14: [20, 100],
            15: [10, 50]
          },
          elevationKey: 'ele',
          levelKey: 'level'
        })
      ],
      maxzoom: 15
    });

    map.addLayer({
      id: 'contour-lines',
      type: 'line',
      source: 'contour-source',
      'source-layer': 'contours',
      minzoom: 6,
      paint: {
        'line-color': '#8fa66f',
        'line-width': ['match', ['get', 'level'], 1, 1.2, 0.6],
        'line-opacity': 0.55
      }
    });

    map.addLayer({
      id: 'contour-labels',
      type: 'symbol',
      source: 'contour-source',
      'source-layer': 'contours',
      minzoom: 8,
      filter: ['==', ['get', 'level'], 1],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 9,
        'symbol-spacing': 550
      },
      paint: {
        'text-color': '#667a4f',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    });

    // 微观路网体系 (Apple Maps 风格：柔和石板灰细边 + 纯净暖白路心，强化立体对比度)
    map.addLayer({
      id: 'osm-minor-roads-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor', 'service', 'residential', 'unclassified'], true, false],
      paint: {
        'line-color': '#c6c3bb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 11, 2.2, 14, 4.0],
        'line-opacity': 0.88
      }
    });

    map.addLayer({
      id: 'osm-minor-roads-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor', 'service', 'residential', 'unclassified'], true, false],
      paint: {
        'line-color': '#fcfbf8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 11, 1.5, 14, 3.0],
        'line-opacity': 0.95
      }
    });

    // 城市主要干道、国道与省道 (Apple Maps 风格：纯净暖白路心，清晰立体轮廓)
    map.addLayer({
      id: 'osm-primary-roads-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['trunk', 'primary'], true, false],
      paint: {
        'line-color': '#bebab0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.8, 10, 3.6, 14, 6.0],
        'line-opacity': 0.92
      }
    });

    map.addLayer({
      id: 'osm-primary-roads-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['trunk', 'primary'], true, false],
      paint: {
        'line-color': '#fffdf8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 2.4, 14, 4.5],
        'line-opacity': 1.0
      }
    });

    // 高速公路与城市快速高架路 (Apple Maps 经典柔和暖杏桃琥珀色，OLED 屏幕温和舒适，绝不刺眼)
    map.addLayer({
      id: 'osm-highway-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway'], true, false],
      paint: {
        'line-color': '#e2a36d',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.0, 10, 4.0, 14, 7.0],
        'line-opacity': 0.85
      }
    });

    map.addLayer({
      id: 'osm-highway-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway'], true, false],
      paint: {
        'line-color': '#f8cf8d',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 10, 2.6, 14, 5.0],
        'line-opacity': 1.0
      }
    });

    // 户外山野小径与步道 (Apple Maps 柔和暖陶土色虚线)
    map.addLayer({
      id: 'osm-trails-layer',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['path', 'track', 'footway', 'pedestrian', 'steps'], true, false],
      paint: {
        'line-color': '#c98a58',
        'line-width': 2.0,
        'line-dasharray': [2, 1.5],
        'line-opacity': 0.85
      }
    });

    // 国道/省道/高速公路路名与标牌 (提前在 Zoom 5.5+ 显现，G318, G214 等清晰醒目)
    map.addLayer({
      id: 'osm-road-shields',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'transportation_name',
      filter: ['has', 'ref'],
      minzoom: 5.5,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'ref'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5.5, 9.5, 9, 10.5, 12, 11.5],
        'symbol-spacing': 180,
        'text-max-angle': 60,
        'text-keep-upright': true
      },
      paint: {
        'text-color': '#b91c1c',
        'text-halo-color': '#ffffff',
        'text-halo-width': 3.5
      }
    });

    // 城市主干道路名称注记 (Zoom 9 起清晰显现)
    map.addLayer({
      id: 'osm-road-names',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'transportation_name',
      filter: ['all', ['has', 'name'], ['!has', 'ref']],
      minzoom: 9,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 9, 12, 10.5, 14, 11.5],
        'symbol-spacing': 250,
        'text-max-angle': 50,
        'text-keep-upright': true
      },
      paint: {
        'text-color': '#334155',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // 全国所有地级市与省会城市原生矢量注记 (覆盖全国，Zoom 4~12)
    // 全国所有地级市与省会城市原生矢量注记 (覆盖全国，Zoom 4~16)
    map.addLayer({
      id: 'osm-places-cities',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city'], true, false],
      minzoom: 4,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 7, 12, 10, 14, 14, 16],
        'text-anchor': 'center',
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 1]
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 乡镇、街道办事处 (覆盖全国所有乡镇及城市大型街道办，平滑延续至微观视口)
    map.addLayer({
      id: 'osm-places-towns',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['town', 'suburb'], true, false],
      minzoom: 5.5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9.5, 8, 11, 10, 12, 13, 13.5, 16, 15],
        'text-anchor': 'center',
        'text-padding': 3,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 5]
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 村庄、自然村、庄、屯、居住社区与住宅小区 (无 emoji 纯正中文字符，100% 渲染全量村级地名与住宅小区)
    map.addLayer({
      id: 'osm-places-villages',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['village', 'hamlet', 'isolated_dwelling', 'neighbourhood', 'quarter', 'residential'], true, false],
      minzoom: 7.0,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8.5, 8, 9.5, 10, 10.5, 12, 12, 14, 13.5, 16, 14.5],
        'text-anchor': 'center',
        'text-padding': 3,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 10]
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5
      }
    });

    // 著名山峰与高峰 (标准自然地形注记，微观层级自然显现)
    map.addLayer({
      id: 'osm-mountain-peaks',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'mountain_peak',
      filter: ['has', 'name'],
      minzoom: 6.5,
      layout: {
        'text-field': [
          'case',
          ['has', 'ele'],
          ['concat', '▲ ', ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']], ', ', ['get', 'ele'], 'm'],
          ['concat', '▲ ', ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']]]
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6.5, 9.0, 9, 10.0, 12, 11.5, 15, 13.5],
        'text-anchor': 'bottom',
        'text-offset': [0, -0.2],
        'text-padding': 2
      },
      paint: {
        'text-color': '#15803d',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.4
      }
    });

    // 户外重点景点、观景台、露营地与历史名胜 (独立层级优先显示)
    map.addLayer({
      id: 'osm-outdoor-scenic-pois',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'poi',
      filter: ['match', ['get', 'class'], ['attraction', 'viewpoint', 'theme_park', 'monument', 'campsite', 'picnic_site', 'alpine_hut', 'shelter', 'castle'], true, false],
      minzoom: 8,
      layout: {
        'text-field': ['concat', '★ ', ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']]],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9.5, 11, 11, 14, 13],
        'text-anchor': 'bottom',
        'text-offset': [0, -0.3],
        'text-padding': 2,
        'symbol-sort-key': 8
      },
      paint: {
        'text-color': '#b45309',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 全量 POI 实体物理位置小微圆点 (分类赋色，不遮挡地图，严格排除景点与无用道闸)
    map.addLayer({
      id: 'osm-all-pois-dots',
      type: 'circle',
      source: 'osm-vector-source',
      'source-layer': 'poi',
      filter: [
        'all',
        ['any', ['has', 'name'], ['has', 'name:zh'], ['has', 'name_zh']],
        ['!', ['match', ['get', 'class'], ['attraction', 'viewpoint', 'theme_park', 'monument', 'campsite', 'picnic_site', 'alpine_hut', 'shelter', 'castle', 'gate', 'lift_gate', 'bollard', 'waste_basket'], true, false]]
      ],
      minzoom: 11,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.0, 13, 2.8, 15, 3.5],
        'circle-color': [
          'match',
          ['get', 'class'],
          ['school', 'university', 'college', 'kindergarten', 'library'], '#7c3aed',
          ['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'], '#0284c7',
          ['shop', 'grocery', 'supermarket', 'mall', 'bank', 'atm', 'marketplace', 'clothing_store', 'bakery', 'alcohol_shop'], '#059669',
          ['bus', 'bus_stop', 'railway', 'railway_station', 'parking', 'fuel', 'ferry_terminal'], '#2563eb',
          ['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream', 'lodging', 'hotel'], '#d97706',
          ['town_hall', 'office', 'police', 'post', 'fire_station'], '#475569',
          ['park', 'garden', 'pitch', 'stadium', 'theatre', 'museum', 'cinema', 'art_gallery', 'place_of_worship'], '#0f766e',
          '#64748b'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      }
    });

    // 全量 POI 唯一单一注记层 (彻底杜绝多层重叠与双重文字，多类别精准着色，严格排除景点以防与scenic层重复)
    map.addLayer({
      id: 'osm-all-pois',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'poi',
      filter: [
        'all',
        ['any', ['has', 'name'], ['has', 'name:zh'], ['has', 'name_zh']],
        ['!', ['match', ['get', 'class'], ['attraction', 'viewpoint', 'theme_park', 'monument', 'campsite', 'picnic_site', 'alpine_hut', 'shelter', 'castle', 'gate', 'lift_gate', 'bollard', 'waste_basket'], true, false]]
      ],
      minzoom: 11,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 13, 11, 15, 12.5],
        'text-anchor': 'top',
        'text-offset': [0, 0.6],
        'text-padding': 2,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 20]
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'class'],
          ['school', 'university', 'college', 'kindergarten', 'library'], '#6d28d9',
          ['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'], '#0284c7',
          ['shop', 'grocery', 'supermarket', 'mall', 'bank', 'atm', 'marketplace', 'clothing_store', 'bakery', 'alcohol_shop'], '#059669',
          ['bus', 'bus_stop', 'railway', 'railway_station', 'parking', 'fuel', 'ferry_terminal'], '#2563eb',
          ['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream', 'lodging', 'hotel'], '#d97706',
          ['town_hall', 'office', 'police', 'post', 'fire_station'], '#334155',
          ['park', 'garden', 'pitch', 'stadium', 'theatre', 'museum', 'cinema', 'art_gallery', 'place_of_worship'], '#0f766e',
          '#334155'
        ],
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.2
      }
    });

    // 14. 自然保护区、城市公园绿地注记
    map.addLayer({
      id: 'osm-park-labels',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'park',
      filter: ['has', 'name'],
      minzoom: 8,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 15, 14],
        'text-anchor': 'center',
        'text-padding': 2
      },
      paint: {
        'text-color': '#15803d',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.0
      }
    });

    // 15. 湖泊水库与水系地名
    map.addLayer({
      id: 'osm-water-names-poi',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'water_name',
      filter: ['has', 'name'],
      minzoom: 8,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 15, 13],
        'text-anchor': 'center',
        'text-padding': 2
      },
      paint: {
        'text-color': '#0284c7',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.0
      }
    });

    // 16. 小区楼栋号与街道门牌号注记 (如 1号楼, 5号楼, 18号)
    map.addLayer({
      id: 'osm-housenumber-labels',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'housenumber',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'housenumber'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 9.5,
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#64748b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.6
      }
    });

    // 17. 3D 建筑白模立体高度 (高质感暖灰实心挤出，杜绝地表穿透与模糊掩盖)
    map.addLayer({
      id: 'osm-buildings-3d',
      type: 'fill-extrusion',
      source: 'osm-vector-source',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': '#e2ded6',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.92
      }
    });

    // 18. 建筑名称标签 (如综合楼、A座等)
    map.addLayer({
      id: 'osm-building-labels',
      type: 'symbol',
      source: 'osm-vector-source',
      'source-layer': 'building',
      filter: ['has', 'name'],
      minzoom: 13.5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh'], ['get', 'name_zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-anchor': 'center',
        'text-padding': 2
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.0
      }
    });

    renderAllMapLabels(map);

    // 点状地点、POI 与行政注记随地形抬升。沿道路排布的文字由 MapLibre
    // 原生线标注管线处理，避免飞行动画中为大量道路文字重复计算地形高度。
    try {
      const styleLayers = map.getStyle()?.layers;
      if (styleLayers) {
        styleLayers.forEach(lyr => {
          if (lyr.type === 'symbol' && lyr.layout?.['symbol-placement'] !== 'line') {
            try { map.setLayoutProperty(lyr.id, 'symbol-z-elevate', true); } catch (e) {}
          }
        });
      }
    } catch (e) {}

    // MapLibre 默认 trackResize 会原生处理窗口尺寸变化，避免再注册一套重复 WebGL 重排。
    map.resize();

    // 首次空闲后补一帧，确保异步地形资源及时呈现。
    map.once('idle', () => {
      try {
        if (typeof map.triggerRepaint === 'function') {
          map.triggerRepaint();
        }
      } catch (e) {}
    });
  });

  setupOfficeHeaderInteractions(map);
  setupWaypointAndFavoritesSystem(map);
  setupOutdoorRouteSystem(map);
  setupLayersPopover(map);
  setupTrackImport(map);
  setupMapContextMenu(map);
}

function renderAllMapLabels(map) {
  // 遵循自然标准地图渲染规范：所有省份行政区划与城镇注记均由底层矢量切片按缩放层级原生展现
  // 彻底移除覆盖在最上层的自定义人工 DOM 浮动遮挡物，还原纯净地图界面
  [provinceMarkers, cityMarkers].forEach(arr => {
    arr.forEach(m => m.remove());
    arr.length = 0;
  });
}

// =========================================================
// 智能地理编码与地点候选中枢 (中国境内坐标/城市/小区/地标全域检索)
// =========================================================
let activeSearchAbort = null;

// 坐标解析器 (支持 "117.12, 36.45" / "36.45, 117.12" / "117.12 36.45")
function parseCoordinates(str) {
  const clean = str.replace(/[°NSEWnsew,]/g, ' ').trim();
  const parts = clean.split(/\s+/).map(Number).filter(n => !isNaN(n));
  if (parts.length >= 2) {
    let [a, b] = parts;
    let lng, lat;
    if (a >= 73 && a <= 136 && b >= 3 && b <= 54) {
      lng = a; lat = b;
    } else if (b >= 73 && b <= 136 && a >= 3 && a <= 54) {
      lng = b; lat = a;
    } else if (a >= -180 && a <= 180 && b >= -90 && b <= 90) {
      lng = a; lat = b;
    } else {
      return null;
    }
    return { coords: [lng, lat], title: `坐标 (${lng.toFixed(4)}°, ${lat.toFixed(4)}°)` };
  }
  return null;
}

/// 综合检索引擎 (中国专属极速匹配)：彻底废除拼音网络转换，本地字典 0ms 秒出，仅检索中国境内地点
async function queryLocationCandidates(keyword) {
  const raw = (keyword || '').trim();
  if (!raw) {
    return [];
  }

  // 1. GPS 经纬度绝对坐标解析 (如 116.39, 39.90)
  const coordMatch = parseCoordinates(raw);
  if (coordMatch) {
    return [{
      name: coordMatch.title,
      desc: 'GPS 经纬度绝对坐标',
      coords: [Number(coordMatch.coords[0]), Number(coordMatch.coords[1])],
      icon: '🎯',
      zoom: 14.8
    }];
  }

  const localMatches = [];

  // 2. 省份匹配 (中国 34 省级行政区，中文汉字精准/包含匹配)
  if (typeof PROVINCES_DATA !== 'undefined') {
    Object.keys(PROVINCES_DATA).forEach(k => {
      const p = PROVINCES_DATA[k];
      if (p.name.includes(raw) || raw.includes(p.name)) {
        let score = 3;
        if (p.name === raw) score = 1;
        else if (p.name.startsWith(raw)) score = 2;
        localMatches.push({
          name: p.name,
          desc: `省级行政区 · ${p.name}`,
          coords: [Number(p.center[0]), Number(p.center[1])],
          icon: '🚩',
          type: 'province',
          zoom: p.zoom,
          _score: score
        });
      }
    });
  }

  // 3. 全国地级市与重点城镇匹配 (中国 360+ 城市，中文汉字匹配)
  if (typeof MAJOR_CITIES !== 'undefined') {
    MAJOR_CITIES.forEach(c => {
      if (c.name.includes(raw) || raw.includes(c.name)) {
        let score = 4;
        if (c.name === raw) score = 1;
        else if (c.name.startsWith(raw)) score = 2;

        localMatches.push({
          name: c.name,
          desc: `${c.province || '重点城市'} · 城市中心`,
          coords: [Number(c.coords[0]), Number(c.coords[1])],
          icon: '🏙️',
          type: 'city',
          zoom: 12.0,
          _score: score
        });
      }
    });
  }

  // 5. 用户本地收藏夹匹配
  if (typeof savedWaypoints !== 'undefined' && Array.isArray(savedWaypoints)) {
    savedWaypoints.forEach(wp => {
      if (wp && wp.name && (wp.name.includes(raw) || raw.includes(wp.name))) {
        localMatches.push({
          name: wp.name,
          desc: `我的收藏点 · ${wp.ele || 0}m`,
          coords: [Number(wp.lng), Number(wp.lat)],
          icon: '⭐',
          type: 'waypoint',
          zoom: 14.8,
          _score: 1
        });
      }
    });
  }

  // 按相关度评分排序
  localMatches.sort((a, b) => (a._score || 9) - (b._score || 9));

  // 6. 【极速 0ms 直出】：若本地中国城市/省份/收藏已有精确匹配，直接秒级返回，绝不等待海外网络！
  if (localMatches.length > 0 && localMatches[0]._score <= 2) {
    return localMatches.slice(0, 16);
  }

  // 7. 仅在本地无精确匹配时，按需请求在线高精地理编码，且【严格限定仅搜索中国境内】
  try {
    let geojson = null;

    // 优先使用 Electron 原生 IPC 直通检索 (免除渲染进程跨域限制与端口依赖，自带 8GB 堆内存切片缓存)
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.searchLocation === 'function') {
      try {
        geojson = await window.electronAPI.searchLocation(raw);
      } catch (ipcErr) {}
    }

    if (!geojson) {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 6500);

      const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI);
      const onlineUrl = isDesktop
        ? `http://127.0.0.1:${localServerPort}/search?q=${encodeURIComponent(raw)}`
        : `https://photon.komoot.io/api/?q=${encodeURIComponent(raw)}&bbox=73.5,18.0,135.1,53.6&limit=10`;

      let resp;
      try {
        resp = await fetch(onlineUrl, { signal: ctrl.signal });
      } catch (netErr) {
        if (isDesktop && !ctrl.signal.aborted) {
          // 本地代理不可达时平滑回退直接连接
          resp = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(raw)}&bbox=73.5,18.0,135.1,53.6&limit=10`, { signal: ctrl.signal });
        } else {
          throw netErr;
        }
      }

      if (resp && resp.ok) {
        geojson = await resp.json();
      }
    }

    if (geojson && geojson.features) {

        geojson.features.forEach(f => {
          const p = f.properties;
          const coords = f.geometry.coordinates;
          if (!coords || coords.length < 2) return;

          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (isNaN(lng) || isNaN(lat)) return;

          // 严格边界与国家校验：仅限中国本土
          const inChinaBbox = lng >= 73.0 && lng <= 136.0 && lat >= 18.0 && lat <= 54.0;
          const isCountryCn = !p.countrycode || p.countrycode.toUpperCase() === 'CN' || p.country === 'China' || p.country === '中国';
          if (!inChinaBbox || !isCountryCn) return;

          const name = p.name || p.street || p.city || raw;
          const parts = [p.state, p.city, p.district, p.locality]
            .filter(Boolean)
            .filter(s => s !== 'China' && s !== '中国');
          const cleanDesc = parts.join(' · ') || (p.type ? `OSM ${p.type}` : '中国地点');
          const desc = cleanDesc.replace(/^中国\s*[·,\-–]\s*/, '').replace(/China\s*[·,\-–]\s*/i, '');

          let icon = '📍';
          let type = 'poi';
          const osmValue = (p.osm_value || '').toLowerCase();
          // 过滤名山与山峰 POI (遵循用户偏好，不展示名山高峰)
          if (osmValue.includes('mountain') || osmValue.includes('peak')) {
            return;
          }

          if (osmValue.includes('residential') || osmValue.includes('housing') || osmValue.includes('suburb') || osmValue.includes('quarter') || name.includes('小区') || name.includes('家园') || name.includes('花园') || name.includes('苑') || name.includes('公馆')) {
            icon = '🏘️';
            type = 'community';
          } else if (osmValue.includes('school') || osmValue.includes('university') || osmValue.includes('college')) {
            icon = '🏫';
          } else if (osmValue.includes('hospital') || osmValue.includes('clinic')) {
            icon = '🏥';
          } else if (osmValue.includes('city') || osmValue.includes('town')) {
            icon = '🏙️';
          }

          const isDuplicate = localMatches.some(m => {
            const dist = Math.hypot(m.coords[0] - lng, m.coords[1] - lat);
            return (m.name === name && dist < 0.005) || dist < 0.0008;
          });

          if (!isDuplicate) {
            localMatches.push({
              name,
              desc,
              coords: [lng, lat],
              icon,
              type,
              zoom: 14.8
            });
          }
        });
      }
    } catch (e) {
      // 离线或超时平滑回退本地结果
    }



  return localMatches.slice(0, 16);
}

if (typeof window !== 'undefined') {
  window.queryLocationCandidates = queryLocationCandidates;
}

// 自动触发地形高程重对齐与渲染微刷新 (纯 WebGL 硬件重绘，0ms 物理抖动，彻底杜绝屏幕跳动与微震)
function triggerTerrainRealign(map) {
  if (!map) return;
  if (typeof map.triggerRepaint === 'function') {
    map.triggerRepaint();
  }
}
window.triggerTerrainRealign = triggerTerrainRealign;

// MapLibre 会在地图渲染与 DEM 到达时原生重投影 DOM Marker。
// 这里只同步角色样式；禁止在 idle 中 setLngLat/_update/triggerRepaint，
// 否则会形成 idle -> repaint -> idle 的永久 WebGL 重绘循环。
function refreshAllRouteMarkersElevation(map) {
  try {
    const m = map || (typeof mapInstance !== 'undefined' ? mapInstance : null);
    if (!m) return;
    if (typeof syncRouteMarkersVisualState === 'function') {
      syncRouteMarkersVisualState(m);
    }
  } catch (err) {}
}
window.refreshAllRouteMarkersElevation = refreshAllRouteMarkersElevation;

function refreshRouteElevationProfile(map) {
  try {
    const m = map || (typeof mapInstance !== 'undefined' ? mapInstance : null);
    if (!m || typeof currentPlannedRouteCoords === 'undefined' || !currentPlannedRouteCoords || currentPlannedRouteCoords.length < 2 || !currentRouteMetrics) return;
    const chartSection = document.getElementById('route-chart-section');
    if (!chartSection || chartSection.style.display === 'none') return;
    if (typeof updateProfileAndMetrics === 'function') {
      updateProfileAndMetrics(m, currentPlannedRouteCoords, currentRouteMetrics.totalDistKm, currentRouteMetrics.durationSec, currentRouteMetrics.isRealRoad, false);
    }
  } catch (e) {}
}
window.refreshRouteElevationProfile = refreshRouteElevationProfile;

// 高精三维针孔透视摄像机单阶段极速飞跃定位系统 (Single-Phase Precision Camera Projection)
// 完美支持 2D/3D 模式：自适应消除卡片偏上、根除跨层级缩放飞行出界，落地零跳动
function flyToLocationPrecisely(map, targetCoords, options = {}) {
  const flyOpts = { centered: false, ...options };
  if (!map || !targetCoords || targetCoords.length < 2) return;
  const lng = Number(targetCoords[0]);
  const lat = Number(targetCoords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

  if (window.OutmapLocationCamera?.fly) {
    window.OutmapLocationCamera.fly(map, [lng, lat], {
      ...flyOpts,
      onArrival: () => {
        if (typeof refreshAllRouteMarkersElevation === 'function') {
          refreshAllRouteMarkersElevation(map);
        }
        if (typeof refreshRouteElevationProfile === 'function') {
          refreshRouteElevationProfile(map);
        }
        flyOpts.onArrival?.();
      }
    });
    return;
  }

  // 基础兜底飞行
  const cameraPadding = { top: 0, bottom: 0, left: 0, right: 0 };
  map.flyTo({
    center: [lng, lat],
    zoom: flyOpts.zoom || 14.8,
    pitch: flyOpts.pitch !== undefined ? flyOpts.pitch : (map.getPitch() ?? 50),
    bearing: flyOpts.bearing !== undefined ? flyOpts.bearing : (map.getBearing() ?? 0),
    padding: cameraPadding,
    duration: flyOpts.duration || 850
  });
}
window.flyToLocationPrecisely = flyToLocationPrecisely;

function setupOfficeHeaderInteractions(map) {
  // 1. 视角倾角高度锁定 (放置于 3D、正北 按钮旁边，右键仅能水平360度旋转)
  const btnLockPitch = document.getElementById('btn-lock-pitch-toggle');
  const statusPitchLock = document.getElementById('status-pitch-lock');

  const updatePitchLockState = (locked, targetPitch = null) => {
    isPitchLocked = locked;
    try {
      localStorage.setItem('outmap_pitch_locked', locked ? '1' : '0');
    } catch (e) {}

    if (btnLockPitch) {
      btnLockPitch.classList.toggle('active', locked);
      btnLockPitch.innerHTML = locked
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" opacity="0.25"></rect>
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
             <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
             <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
           </svg>`;
    }

    if (locked) {
      const currentPitch = targetPitch !== null ? targetPitch : Math.round(map.getPitch() ?? 50);
      try {
        localStorage.setItem('outmap_locked_pitch_val', String(currentPitch));
      } catch (e) {}
      map.setMinPitch(currentPitch);
      map.setMaxPitch(currentPitch);
      if (map.touchPitch) {
        try { map.touchPitch.disable(); } catch (e) {}
      }
      if (statusPitchLock) statusPitchLock.innerText = '';
    } else {
      map.setMinPitch(0);
      map.setMaxPitch(85);
      if (map.touchPitch) {
        try { map.touchPitch.enable(); } catch (e) {}
      }
      if (statusPitchLock) statusPitchLock.innerText = '';
    }
  };
  updatePitchLockFn = updatePitchLockState;

  // 默认启动全国总览 50° 3D 锁定视角 (出厂即默认锁定为 50°)
  const selectProv = document.getElementById('select-offline-province');
  if (selectProv) {
    selectProv.value = 'china';
  }

  map.setPitch(50);
  updatePitchLockState(true, 50);

  if (btnLockPitch) {
    btnLockPitch.addEventListener('click', () => {
      updatePitchLockState(!isPitchLocked);
    });
  }

  // 2. 3D / 2D 切换 (切到 3D 时：视角 50 度锁定)
  const btn3D = document.getElementById('btn-3d-toggle');
  let pitchLockTimer = null;
  if (btn3D) {
    btn3D.classList.add('active');
    btn3D.addEventListener('click', () => {
      clearTimeout(pitchLockTimer);
      window.OutmapLocationCamera.cancel(map);
      is3DView = !is3DView;
      btn3D.classList.toggle('active', is3DView);
      btn3D.innerHTML = is3DView
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z"></path>
             <path d="M12 12l9-4.5"></path>
             <path d="M12 12v9"></path>
             <path d="M12 12L3 7.5"></path>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
             <line x1="8" y1="2" x2="8" y2="18"></line>
             <line x1="16" y1="6" x2="16" y2="22"></line>
           </svg>`;
      if (is3DView) {
        // 2D 切到 3D 视图：恢复 50 度视角并重新挂载 DEM 地形网格与山体立体阴影
        map.setMinPitch(0);
        map.setMaxPitch(85);
        try {
          map.setTerrain({ source: 'terrain-dem', exaggeration: currentExaggeration || 1.5 });
          if (map.getLayer('hillshade-layer')) map.setLayoutProperty('hillshade-layer', 'visibility', 'visible');
        } catch (e) {}
        map.easeTo({ pitch: 50, duration: 800 });
        pitchLockTimer = setTimeout(() => {
          if (is3DView) updatePitchLockState(true, map.getPitch());
        }, 820);
      } else {
        // 切到 2D 视图：解除锁定并平俯至 0 度，正北回正，智能卸载 3D DEM 顶点计算节省 30% 显存功耗
        if (isPitchLocked) {
          updatePitchLockState(false);
        }
        // 保持 Terrain 实例挂载，避免再次进入 3D 时在动画首帧重建 DEM
        // 网格与着色器。2D 只隐藏山影并归零俯仰，交给 MapLibre 原生相机过渡。
        try {
          if (map.getLayer('hillshade-layer')) map.setLayoutProperty('hillshade-layer', 'visibility', 'none');
        } catch (e) {}
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      }
    });
  }

  // 校准正北与动态罗盘针指示 (罗盘红针始终实时指向地磁正北，点击丝滑回正)
  const btnNorth = document.getElementById('btn-reset-north');
  if (btnNorth) {
    const northSvg = btnNorth.querySelector('svg');
    map.on('rotate', () => {
      const b = map.getBearing();
      if (northSvg) {
        northSvg.style.transform = `rotate(${-b}deg)`;
      }
    });

    btnNorth.addEventListener('click', () => {
      if (isPitchLocked) {
        map.easeTo({ bearing: 0, duration: 600 });
      } else {
        map.resetNorth({ duration: 600 });
      }
    });
  }

  // 高程夸大滑块与移动端大尺寸底部滑块抽屉联动
  const exSlider = document.getElementById('exaggeration-slider');
  const exVal = document.getElementById('exaggeration-val');
  const headerSliderGroup = document.getElementById('header-slider-group');
  const mobileEleSheet = document.getElementById('mobile-ele-sheet');
  const btnCloseMobileEle = document.getElementById('btn-close-mobile-ele');
  const mobileEleRange = document.getElementById('mobile-ele-range');
  const mobileEleValText = document.getElementById('mobile-ele-val-text');
  const mobilePresetBtns = document.querySelectorAll('.mobile-ele-preset-btn');

  const setExaggerationValue = (v) => {
    currentExaggeration = v;
    if (exVal) exVal.innerText = `${v.toFixed(1)}x`;
    if (exSlider) exSlider.value = v;
    if (mobileEleRange) mobileEleRange.value = v;
    if (mobileEleValText) mobileEleValText.innerText = `${v.toFixed(1)}x`;
    map.setTerrain({ source: 'terrain-dem', exaggeration: v });
    mobilePresetBtns.forEach(btn => {
      btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.val) - v) < 0.05);
    });
  };

  if (exSlider) {
    exSlider.addEventListener('input', e => {
      setExaggerationValue(parseFloat(e.target.value));
    });
  }

  // 手机端点击高程胶囊唤起大滑块抽屉 (支持 click 与 touchend，防止移动端手势被吞)
  const closeMobileElevationSheet = () => {
    const sheet = document.getElementById('mobile-ele-sheet');
    if (sheet && sheet.style.display !== 'none') {
      smoothClosePanel(sheet, () => {
        sheet.classList.remove('active');
      });
    }
  };

  const toggleMobileElevationSheet = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const sheet = document.getElementById('mobile-ele-sheet');
    if (!sheet) return;
    const isHidden = sheet.style.display === 'none' || !sheet.classList.contains('active');
    if (isHidden) {
      showElement(sheet, 'flex');
      sheet.classList.add('active');
      setExaggerationValue(currentExaggeration);
    } else {
      closeMobileElevationSheet();
    }
  };

  const sliderGroupEl = document.getElementById('header-slider-group') || document.querySelector('.office-slider-group');
  if (sliderGroupEl) {
    sliderGroupEl.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        toggleMobileElevationSheet(e);
      }
    });
  }

  mobileEleSheet?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  mobileEleRange?.addEventListener('input', e => {
    setExaggerationValue(parseFloat(e.target.value));
  });

  mobilePresetBtns.forEach(btn => {
    const handlePreset = (e) => {
      e.stopPropagation();
      e.preventDefault();
      setExaggerationValue(parseFloat(btn.dataset.val));
    };
    btn.addEventListener('click', handlePreset);
  });

  const handleCloseMobileEle = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    closeMobileElevationSheet();
  };
  btnCloseMobileEle?.addEventListener('click', handleCloseMobileEle);

  // 点击地图或空白区域自动收起已展开的底部抽屉与弹窗 (全量流体平滑动效退出)
  map.on('click', () => {
    if (pickingRoutePt) return;

    // 1. 右键菜单平滑收起
    smoothCloseContextMenu();

    // 2. 底部浮动面板平滑退出
    ['favorites-drawer', 'mobile-ele-sheet', 'waypoint-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        smoothClosePanel(el, () => el.classList.remove('active'));
      }
    });

    const routePanel = document.getElementById('route-panel');
    const isRouteEmpty = !routeStartCoord && !routeEndCoord && (!routeViaPoints || routeViaPoints.length === 0);
    if (isRouteEmpty && routePanel && routePanel.style.display !== 'none') {
      smoothClosePanel(routePanel, () => routePanel.classList.remove('active'));
    }

    // 3. 模态窗口平滑退出
    const saveRouteModal = document.getElementById('save-route-modal');
    if (saveRouteModal && saveRouteModal.style.display !== 'none') {
      smoothCloseModal(saveRouteModal);
    }

    // 4. 浮动气泡菜单平滑收起
    ['prov-popover-menu', 'search-popover', 'layers-popover'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        smoothClosePopover(el, () => {
          if (id === 'prov-popover-menu') document.getElementById('btn-prov-dropdown-trigger')?.classList.remove('active');
          if (id === 'layers-popover') document.getElementById('btn-fab-layers')?.classList.remove('active');
        });
      }
    });
  });

  // 3. 点击展开的全局搜索交互系统 (中国境内严格过滤、搜索历史持久化、支持经纬度/小区/城市/地标全量POI检索与回车直达)
  const searchTrigger = document.getElementById('btn-search-trigger');
  const searchPopover = document.getElementById('search-popover');
  const searchClose = document.getElementById('btn-close-search');
  const sInput = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('search-results-list');

  let currentSearchResults = [];
  let currentSearchQuery = '';
  let searchRequestSequence = 0;
  let searchDebounceTimer = null;
  currentLandingMarker = null;

  const clearLandingMarker = () => {
    const marker = currentLandingMarker || window.currentLandingMarker;
    if (marker) {
      try { marker.remove(); } catch (e) {}
      currentLandingMarker = null;
      window.currentLandingMarker = null;
    }
    document.querySelectorAll('.landing-pulse-marker').forEach(el => {
      try { el.remove(); } catch (e) {}
    });
  };
  window.clearLandingMarker = clearLandingMarker;

  function getSearchHistory() {
    try {
      return JSON.parse(localStorage.getItem('outmap_search_history') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveSearchHistoryItem(item) {
    if (!item || !item.name) return;
    let history = getSearchHistory().filter(h => h.name !== item.name);
    history.unshift({
      name: item.name,
      desc: item.desc || '',
      coords: item.coords,
      icon: item.icon || '📍',
      type: item.type || 'poi',
      zoom: item.zoom || 14
    });
    if (history.length > 10) history = history.slice(0, 10);
    try {
      localStorage.setItem('outmap_search_history', JSON.stringify(history));
    } catch (e) {}
  }

  function clearSearchHistory() {
    try {
      localStorage.removeItem('outmap_search_history');
    } catch (e) {}
    renderSearchHistory();
  }

  function stripChinaPrefix(str) {
    if (!str) return '';
    return String(str)
      .replace(/^中国\s*[·,\-–\s]\s*/, '')
      .replace(/China\s*[·,\-–\s]\s*/i, '')
      .replace(/\b中国\s*[·,\-–\s]\s*/g, '')
      .trim();
  }

  function renderSearchHistory() {
    clearLandingMarker();
    const history = getSearchHistory();
    if (!resultsContainer) return;

    if (!history || history.length === 0) {
      resultsContainer.innerHTML = '<div class="search-empty-tip">暂无历史记录，输入城市、小区或地名后回车即可直达</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    resultsContainer.innerHTML = `
      <div class="search-history-header">
        <span class="search-history-title">⏱️ 搜索历史</span>
        <button class="btn-clear-history" id="btn-clear-history-action">清空历史</button>
      </div>
    `;

    const clearBtn = resultsContainer.querySelector('#btn-clear-history-action');
    clearBtn?.addEventListener('click', e => {
      e.stopPropagation();
      clearSearchHistory();
    });

    history.forEach(item => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      const cleanDesc = stripChinaPrefix(item.desc || '历史搜索地点');
      row.innerHTML = `
        <div class="search-result-icon">${escapeHtml(item.icon || '⏱️')}</div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(item.name)}</div>
          <div class="search-result-desc">${escapeHtml(cleanDesc)}</div>
        </div>
      `;
      row.addEventListener('click', () => {
        executeJumpToResult(item);
      });
      resultsContainer.appendChild(row);
    });

    resultsContainer.style.display = 'block';
  }

  function showLandingMarker(coords, title, desc = '') {
    if (!coords || coords.length < 2) return;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (isNaN(lng) || isNaN(lat)) return;
    const validCoords = [lng, lat];

    if (currentLandingMarker) {
      try { currentLandingMarker.remove(); } catch (e) {}
      currentLandingMarker = null;
    }

    const ele = Math.round(getRealElevation(map, { lng: validCoords[0], lat: validCoords[1] }) || 0);
    const cleanDesc = stripChinaPrefix(desc || '');
    const metaText = cleanDesc || `${validCoords[0].toFixed(4)}°E, ${validCoords[1].toFixed(4)}°N · ${ele}m`;

    const el = document.createElement('div');
    el.className = 'landing-pulse-marker';
    el.innerHTML = `
      <div class="landing-card">
        <div class="landing-card-header">
          <div class="landing-card-title">${escapeHtml(title)}</div>
          <button class="landing-card-close">✕</button>
        </div>
        <div class="landing-card-desc">${escapeHtml(metaText)}</div>
        <div class="landing-card-actions">
          <button class="landing-act-btn primary act-fav">⭐ 收藏</button>
          <button class="landing-act-btn act-start">🚩 起点</button>
          <button class="landing-act-btn act-via">➕ 途径</button>
          <button class="landing-act-btn act-end">🏁 终点</button>
        </div>
      </div>
      <div class="pulse-pin-wrap">
        <div class="pulse-ring"></div>
        <div class="pulse-core">📍</div>
      </div>
    `;

    // 关闭标记 (平滑淡出退出)
    const btnClose = el.querySelector('.landing-card-close');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = el.querySelector('.landing-card');
        if (card) {
          card.classList.add('popover-closing');
          setTimeout(() => {
            if (currentLandingMarker) {
              currentLandingMarker.remove();
              currentLandingMarker = null;
            }
          }, 140);
        } else if (currentLandingMarker) {
          currentLandingMarker.remove();
          currentLandingMarker = null;
        }
      });
    }

    // 快捷按钮：收藏
    const btnFav = el.querySelector('.act-fav');
    if (btnFav) {
      btnFav.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.openWaypointModalForLocation === 'function') {
          window.openWaypointModalForLocation(validCoords, title);
        }
      });
    }

    // 快捷按钮：起点
    const btnStart = el.querySelector('.act-start');
    if (btnStart) {
      btnStart.addEventListener('click', (e) => {
        e.stopPropagation();
        clearLandingMarker();
        setRouteStartPoint(map, validCoords, title);
      });
    }

    // 快捷按钮：途径点
    const btnVia = el.querySelector('.act-via');
    if (btnVia) {
      btnVia.addEventListener('click', (e) => {
        e.stopPropagation();
        clearLandingMarker();
        addViaPoint(map, validCoords, title);
      });
    }

    // 快捷按钮：终点
    const btnEnd = el.querySelector('.act-end');
    if (btnEnd) {
      btnEnd.addEventListener('click', (e) => {
        e.stopPropagation();
        clearLandingMarker();
        setRouteEndPoint(map, validCoords, title);
      });
    }

    // 点击图钉重新飞到此处自适应居中 (zoom 14.8)
    const pinWrap = el.querySelector('.pulse-pin-wrap');
    if (pinWrap) {
      pinWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        const curPitch = map.getPitch() ?? 50;
        flyToLocationPrecisely(map, validCoords, { zoom: 14.8, pitch: curPitch, duration: 600 });
      });
    }

    // 右键支持：在标记/卡片上右键唤起上下文菜单，地名严格采用搜索出的精准名称
    const triggerContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.showContextMenuForLocation === 'function') {
        const wrap = document.getElementById('map-wrap') || map.getContainer();
        const wrapRect = wrap.getBoundingClientRect();
        const point = {
          x: e.clientX - wrapRect.left,
          y: e.clientY - wrapRect.top
        };
        window.showContextMenuForLocation({ lng: validCoords[0], lat: validCoords[1] }, point, title);
      }
    };

    el.addEventListener('contextmenu', triggerContextMenu);

    // 阻止拖拽地图穿透
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

    currentLandingMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(validCoords)
      .addTo(map);
    window.currentLandingMarker = currentLandingMarker;
  }
  window.showLandingMarker = showLandingMarker;

  function renderSearchResults(items) {
    clearLandingMarker();
    currentSearchResults = items;
    if (!resultsContainer) return;

    if (!items || items.length === 0) {
      resultsContainer.innerHTML = '<div class="search-empty-tip">未找到匹配地点，支持直接输入经纬度或更具体的小区/地标名</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    resultsContainer.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      const cleanDesc = stripChinaPrefix(item.desc || '');
      row.innerHTML = `
        <div class="search-result-icon">${escapeHtml(item.icon || '📍')}</div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(item.name)}</div>
          <div class="search-result-desc">${escapeHtml(cleanDesc)}</div>
        </div>
      `;

      row.addEventListener('click', () => {
        executeJumpToResult(item);
      });

      resultsContainer.appendChild(row);
    });

    resultsContainer.style.display = 'block';
  }

  function closeSearchPopover(clearText = false) {
    ++searchRequestSequence;
    clearTimeout(searchDebounceTimer);
    if (sInput) {
      if (clearText) sInput.value = '';
      sInput.blur();
    }
    if (searchPopover && searchPopover.style.display !== 'none') {
      smoothClosePopover(searchPopover, () => {
        if (sInput) {
          if (clearText) sInput.value = '';
          sInput.blur();
        }
        if (resultsContainer) resultsContainer.style.display = 'none';
      });
    }
  }

  function executeJumpToResult(item) {
    if (!item || !item.coords || item.coords.length < 2) return;
    ++searchRequestSequence;
    clearTimeout(searchDebounceTimer);
    const lng = Number(item.coords[0]);
    const lat = Number(item.coords[1]);
    if (isNaN(lng) || isNaN(lat)) return;
    const validCoords = [lng, lat];

    closeSearchPopover();
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (sInput) sInput.value = item.name;

    saveSearchHistoryItem(item);

    // 若搜索结果是省份，同步顶栏省份标签
    Object.keys(PROVINCES_DATA).forEach(k => {
      if (PROVINCES_DATA[k].name === item.name) {
        updateProvDropdownLabel(k);
      }
    });

    const isProv = item.type === 'province';
    // 智能层级适配：省份 7.2，地级市 11.5，地标/建筑/小区/选点 13.5 (黄金适中视野，地貌路网通透清晰)
    let targetZoom = 13.5;
    if (isProv) {
      targetZoom = item.zoom || 7.2;
    } else if (item.type === 'city') {
      targetZoom = item.zoom || 11.5;
    } else if (item.type === 'waypoint') {
      targetZoom = item.zoom || 13.5;
    } else if (typeof item.zoom === 'number') {
      targetZoom = Math.min(18, item.zoom);
    }

    const targetPitch = isPitchLocked ? map.getPitch() : Math.min(map.getPitch() ?? 50, 52);

    // 智能跨度感知：远距离平滑巡航，同城近距极速平滑直达
    const curZoom = map.getZoom();
    const curCenter = map.getCenter();
    const distDeg = Math.hypot((curCenter.lng || 104.5) - lng, (curCenter.lat || 36.0) - lat);
    const isLongFlight = curZoom < 8.5 || distDeg > 2.5;
    const flightDuration = isLongFlight ? 1100 : 500;

    let landingMarkerShown = false;
    const ensureLandingMarker = () => {
      if (landingMarkerShown) return;
      landingMarkerShown = true;
      showLandingMarker(validCoords, item.name, item.desc);
    };

    // 先行启动硬件加速平滑巡航，长距离飞行在着陆瞬间挂载落地 Marker DOM，杜绝巡航期间 DOM 频繁矩阵重算导致掉帧
    flyToLocationPrecisely(map, validCoords, {
      zoom: targetZoom,
      pitch: targetPitch,
      centered: isProv,
      duration: flightDuration,
      onArrival: () => {
        ensureLandingMarker();
        if (currentLandingMarker) {
          const ele = Math.round(getRealElevation(map, { lng: validCoords[0], lat: validCoords[1] }) || 0);
          const descEl = currentLandingMarker.getElement()?.querySelector('.landing-card-desc');
          if (descEl) {
            const cleanDesc = stripChinaPrefix(item.desc || '');
            descEl.innerText = cleanDesc || `${validCoords[0].toFixed(4)}°E, ${validCoords[1].toFixed(4)}°N · ${ele}m`;
          }
        }
      }
    });

    if (!isLongFlight) {
      requestAnimationFrame(() => {
        ensureLandingMarker();
      });
    }
  }

  // 搜索输入交互 (输入文字实时防抖检索；清空或聚焦时展示搜索历史；再次搜索自动清除上一次地点标签)
  if (sInput) {
    sInput.addEventListener('input', () => {
      clearLandingMarker();
      const val = sInput.value.trim();
      clearTimeout(searchDebounceTimer);
      currentSearchResults = [];
      currentSearchQuery = val;
      const requestSequence = ++searchRequestSequence;
      if (!val) {
        renderSearchHistory();
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        const results = await queryLocationCandidates(val);
        if (requestSequence !== searchRequestSequence || sInput.value.trim() !== val) return;
        renderSearchResults(results);
      }, 240);
    });

    sInput.addEventListener('focus', () => {
      clearLandingMarker();
      if (!sInput.value.trim()) {
        renderSearchHistory();
      }
    });

    sInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchPopover(true);
        if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
      }
    });
  }

  // 执行回车直达定位
  const doSearch = async () => {
    const text = (sInput.value || '').trim();
    if (!text) {
      sInput?.focus();
      return;
    }

    // 1. 若当前列表已有匹配项，直接飞往第一项
    if (currentSearchQuery === text && currentSearchResults && currentSearchResults.length > 0) {
      executeJumpToResult(currentSearchResults[0]);
      return;
    }

    // 2. 实时现场检索匹配并直达
    clearTimeout(searchDebounceTimer);
    const seq = ++searchRequestSequence;
    const results = await queryLocationCandidates(text);
    if (seq !== searchRequestSequence || sInput.value.trim() !== text) return;
    if (results && results.length > 0) {
      executeJumpToResult(results[0]);
    } else {
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="search-empty-tip">未检索到“${escapeHtml(text)}”，请检查地名拼写或直接输入经纬度坐标</div>`;
        resultsContainer.style.display = 'block';
      }
    }
  };

  if (searchTrigger && searchPopover) {
    searchTrigger.addEventListener('click', e => {
      e.stopPropagation();
      const isHidden = searchPopover.style.display === 'none';
      if (isHidden) {
        if (typeof window.closeProvincePopover === 'function') {
          window.closeProvincePopover();
        } else {
          const provPopover = document.getElementById('prov-popover-menu');
          if (provPopover) smoothClosePopover(provPopover);
          document.getElementById('btn-prov-dropdown-trigger')?.classList.remove('active');
        }
        clearLandingMarker();
        showElement(searchPopover, 'block');
        if (sInput) {
          sInput.focus();
          sInput.select();
          if (sInput.value.trim()) {
            const query = sInput.value.trim();
            const seq = ++searchRequestSequence;
            currentSearchQuery = query;
            currentSearchResults = [];
            queryLocationCandidates(query).then(items => {
              if (seq === searchRequestSequence && sInput.value.trim() === query) renderSearchResults(items);
            });
          } else {
            renderSearchHistory();
          }
        }
      } else {
        closeSearchPopover();
      }
    });
  }

  const handleCloseSearch = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    clearLandingMarker();
    closeSearchPopover(true);
  };
  searchClose?.addEventListener('click', handleCloseSearch);
  searchClose?.addEventListener('touchend', handleCloseSearch);

  document.addEventListener('click', e => {
    if (!searchPopover.contains(e.target) && e.target !== searchTrigger && !searchTrigger.contains(e.target)) {
      closeSearchPopover();
    }
  });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearchPopover(true);
    });

    // 点击/拖拽地图主界面时，立即关闭搜索框
    map.on('mousedown', closeSearchPopover);
    map.on('click', closeSearchPopover);
    map.on('dragstart', closeSearchPopover);
    map.on('touchstart', closeSearchPopover);

    const mapWrapEl = document.getElementById('map-wrap') || document.getElementById('map');
    if (mapWrapEl) {
      ['mousedown', 'pointerdown', 'touchstart', 'click'].forEach(evtName => {
        mapWrapEl.addEventListener(evtName, (e) => {
          if (!searchPopover.contains(e.target) && !searchTrigger.contains(e.target)) {
            closeSearchPopover();
          }
        }, { capture: true, passive: true });
      });
    }

  // 快捷键 Ctrl+K / Cmd+K 快速呼出搜索
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchPopover) {
        showElement(searchPopover, 'block');
        if (sInput) {
          sInput.focus();
          sInput.select();
          if (!sInput.value.trim()) {
            renderSearchHistory();
          }
        }
      }
    }
  });

  // 4. 全国总览与 A-Z 拼音分组省份展开导航面板系统
  setupProvinceDropdown(map);

  // 5. 瓦片金字塔多级离线下载器模态框交互
  setupPyramidModal(map);

  // 6. 版本更新检测与一键热升级交互 (静默检查，新版弹窗)
  setupAppUpdate();

  // 7. 多设备云端漫游同步系统 (基于 Cloudflare R2，右键 Logo 呼出)
  setupCloudSync(map);

  setupStatusBar(map);
}

// 本地已下载离线省份包持久化记录 (双重持久化：优先同步磁盘 manifest.json，兼容 localStorage)
let offlineProvCache = null;

async function syncOfflineManifest() {
  let diskManifest = null;
  let diskProvinces = {};
  if (window.electronAPI && window.electronAPI.getOfflineManifest) {
    try {
      diskManifest = await window.electronAPI.getOfflineManifest();
      if (diskManifest && typeof diskManifest.provinces === 'object') {
        diskProvinces = diskManifest.provinces || {};
      }
    } catch (e) {}
  }

  let localProvinces = {};
  try {
    localProvinces = JSON.parse(localStorage.getItem('outmap_offline_provinces') || '{}');
  } catch (e) {}

  // inventoryVersion 3 来自 worker 对真实文件的扫描，必须覆盖旧的浏览器快照；
  // 否则已删除/未完成的瓦片会被 localStorage 再次“复活”为绿色完成状态。
  const hasAuthoritativeInventory = diskManifest?.inventoryVersion === 3;
  const merged = hasAuthoritativeInventory ? diskProvinces : { ...localProvinces, ...diskProvinces };

  offlineProvCache = merged;
  try {
    localStorage.setItem('outmap_offline_provinces', JSON.stringify(merged));
  } catch (e) {}

  return offlineProvCache;
}

function getOfflineProvState() {
  if (offlineProvCache) return offlineProvCache;
  try {
    offlineProvCache = JSON.parse(localStorage.getItem('outmap_offline_provinces') || '{}');
    return offlineProvCache;
  } catch (e) {
    return {};
  }
}

function saveOfflineProvState(key, maxZ, details = {}) {
  const state = getOfflineProvState();
  const prev = state[key] || {};
  const mergedLayers = {
    ...(prev.layers || {}),
    ...(details.layers || {})
  };
  if (details.dem !== undefined) {
    mergedLayers.dem = { ...(mergedLayers.dem || {}), maxZ: Math.max(mergedLayers.dem?.maxZ || 0, maxZ) };
  }
  if (details.vec !== undefined) {
    mergedLayers.vector = { ...(mergedLayers.vector || {}), maxZ: Math.max(mergedLayers.vector?.maxZ || 0, maxZ) };
  }
  state[key] = {
    ...prev,
    ...details,
    layers: Object.keys(mergedLayers).length > 0 ? mergedLayers : (prev.layers || undefined),
    maxZ: Math.max(prev.maxZ || 0, maxZ),
    updatedAt: Date.now()
  };
  offlineProvCache = state;
  try {
    localStorage.setItem('outmap_offline_provinces', JSON.stringify(state));
  } catch (e) {}

  if (window.electronAPI && window.electronAPI.saveOfflineManifest) {
    window.electronAPI.saveOfflineManifest({ provinces: state }).catch(() => {});
  }
}

let currentSelectedProvKey = 'china';

function updateProvDropdownLabel(key) {
  currentSelectedProvKey = key;
  const prov = PROVINCES_DATA[key];
  const provLabel = document.getElementById('current-prov-label');
  if (prov && provLabel) {
    provLabel.innerText = prov.name;
  }
  // 更新悬浮面板中高亮选中状态
  document.querySelectorAll('.prov-item-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.key === key);
  });
}

// 初始化 Fluent 全国总览与 A-Z 拼音分组省份导航面板
function setupProvinceDropdown(map) {
  const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
  const provPopover = document.getElementById('prov-popover-menu');
  const provQuickIdx = document.getElementById('prov-quick-index');
  const provMenuList = document.getElementById('prov-menu-list');

  if (!provTriggerBtn || !provPopover || !provMenuList) return;

  // 提取有效首字母分组并按字母升序排序
  const groups = {};
  Object.keys(PROVINCES_DATA).forEach(k => {
    if (k === 'china') return;
    const p = PROVINCES_DATA[k];
    const g = p.pinyinGroup || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key: k, ...p });
  });

  const sortedLetters = Object.keys(groups).sort();

  // 渲染 A-Z 快捷定位索引胶囊
  if (provQuickIdx) {
    provQuickIdx.innerHTML = '';
    sortedLetters.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'prov-quick-idx-btn';
      btn.innerText = letter;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetSec = provMenuList.querySelector(`#prov-sec-${letter}`);
        if (targetSec) {
          targetSec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      provQuickIdx.appendChild(btn);
    });
  }

  // 渲染全国总览置顶项与拼音分组
  const renderListContent = () => {
    provMenuList.innerHTML = '';

    // 1. 置顶“全国总览”大胶囊 (不再显示特定角度，视角与全局设置保持一致)
    const allChinaBtn = document.createElement('div');
    allChinaBtn.className = 'prov-all-china-btn';
    allChinaBtn.innerHTML = `
      <span class="p-name">全国总览</span>
    `;
    allChinaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateProvDropdownLabel('china');
      closeProvincePopover();
      flyToProvince(map, 'china');
    });
    provMenuList.appendChild(allChinaBtn);

    // 2. 字母分组与省份网格
    const offlineState = getOfflineProvState();

    sortedLetters.forEach(letter => {
      const sec = document.createElement('div');
      sec.className = 'prov-group-section';
      sec.id = `prov-sec-${letter}`;

      const header = document.createElement('div');
      header.className = 'prov-group-header';
      header.innerText = `[${letter}]`;
      sec.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'prov-group-grid';

      groups[letter].forEach(p => {
        const pBtn = document.createElement('button');
        pBtn.className = 'prov-item-btn';
        pBtn.dataset.key = p.key;
        if (p.key === currentSelectedProvKey) pBtn.classList.add('selected');

        const isOffline = offlineState[p.key] && offlineState[p.key].maxZ >= 10;

        pBtn.innerHTML = `
          <span class="prov-name-txt">${p.name}</span>
          ${isOffline ? '<span class="prov-offline-dot"></span>' : ''}
        `;

        pBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          updateProvDropdownLabel(p.key);
          closeProvincePopover();
          flyToProvince(map, p.key);
        });

        grid.appendChild(pBtn);
      });

      sec.appendChild(grid);
      provMenuList.appendChild(sec);
    });
  };

  const closeProvincePopover = () => {
    if (provPopover && provPopover.style.display !== 'none') {
      smoothClosePopover(provPopover, () => {
        provTriggerBtn?.classList.remove('active');
      });
    }
  };
  window.closeProvincePopover = closeProvincePopover;

  renderListContent();

  // 点击触发按钮展开/收起
  provTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = provPopover.style.display === 'none';
    if (isHidden) {
      const searchPopover = document.getElementById('search-popover');
      if (searchPopover && searchPopover.style.display !== 'none') {
        smoothClosePopover(searchPopover);
      }
      renderListContent(); // 重新检查是否有新下载完成的省份并刷新勾选
      showElement(provPopover, 'flex');
      provTriggerBtn.classList.add('active');
    } else {
      closeProvincePopover();
    }
  });

  // 关闭按钮点击收起
  const btnCloseProv = document.getElementById('btn-close-prov-menu');
  const handleCloseProv = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    closeProvincePopover();
  };
  btnCloseProv?.addEventListener('click', handleCloseProv);
  btnCloseProv?.addEventListener('touchend', handleCloseProv);

  // 点击空白处收起
  document.addEventListener('click', (e) => {
    if (provPopover.style.display !== 'none' && !provPopover.contains(e.target) && !provTriggerBtn.contains(e.target)) {
      closeProvincePopover();
    }
  });

  map.on('mousedown', () => closeProvincePopover());
  map.on('click', () => closeProvincePopover());
  map.on('dragstart', () => closeProvincePopover());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProvincePopover();
    }
  });
}

// 瓦片金字塔多级下载器系统 (支持多省批量勾选、层级卡片、双行紧凑统计与落盘校对)
function setupPyramidModal(map) {
  const modal = document.getElementById('pyramid-modal');
  const btnOpen = document.getElementById('btn-open-pyramid-dl');
  const btnClose = document.getElementById('btn-close-pyramid-modal');
  const multiGrid = document.getElementById('pyramid-prov-multi-grid');
  const btnSelectAll = document.getElementById('btn-prov-select-all');
  const btnSelectInvert = document.getElementById('btn-prov-select-invert');
  const btnSelectNone = document.getElementById('btn-prov-select-none');
  const counterBadge = document.getElementById('prov-selected-counter');
  const dropdownTrigger = document.getElementById('pyramid-prov-dropdown-trigger');
  const dropdownPanel = document.getElementById('pyramid-prov-dropdown-panel');
  const dropdownSummary = document.getElementById('prov-selected-names-summary');
  const zoomPills = document.querySelectorAll('#pyramid-zoom-pills .zoom-pill');
  const zoomInput = document.getElementById('pyramid-zoom-select');
  const chkDem = document.getElementById('chk-dl-dem');
  const chkVec = document.getElementById('chk-dl-vec');
  const statCount = document.getElementById('stat-tile-count');
  const statSize = document.getElementById('stat-tile-size');
  const provStatusTag = document.getElementById('prov-offline-status-tag');
  const btnStart = document.getElementById('btn-start-dl');
  const btnCancel = document.getElementById('btn-cancel-dl');
  const btnRetry = document.getElementById('btn-retry-dl');
  const btnUpdate = document.getElementById('btn-update-dl');
  const btnCheckUpdate = document.getElementById('btn-check-tile-update');
  const btnDone = document.getElementById('btn-done-dl');
  const progressBox = document.getElementById('dl-progress-box');
  const progressFill = document.getElementById('dl-progress-fill');
  const progressTask = document.getElementById('dl-progress-task');
  const progressNum = document.getElementById('dl-progress-num');
  const progressSpeed = document.getElementById('dl-progress-speed');
  const progressPct = document.getElementById('dl-progress-pct');

  if (!modal || !btnOpen) return;

  const dlBlueDot = document.getElementById('dl-live-blue-dot');
  let downloadDotState = 'idle'; // 'idle' (无标注) | 'downloading' (正在下载，蓝点) | 'completed' (下载完成，绿点)
  let activeDownloadSession = null; // { keys: string[], provNames: string[], maxZ: number }
  let lastProgressBytes = 0;
  let lastProgressTime = 0;
  let lastTitleStatUpdate = 0;

  const formatNetworkSpeed = (byteSpeed, isVerify = false, isExisting = false) => {
    if (isVerify) return '本地校验中';
    if (!byteSpeed || byteSpeed <= 0) {
      return isExisting ? '本地已就绪' : '0 KB/s';
    }
    if (byteSpeed >= 1024 * 1024 * 1024) {
      return `${(byteSpeed / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
    }
    if (byteSpeed >= 1024 * 1024) {
      return `${(byteSpeed / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    if (byteSpeed >= 1024) {
      return `${(byteSpeed / 1024).toFixed(0)} KB/s`;
    }
    return `${Math.round(byteSpeed)} B/s`;
  };

  const updateBtnTooltip = () => {};

  const setDownloadDotState = (state) => {
    downloadDotState = state;
    if (!dlBlueDot) return;
    if (state === 'downloading') {
      dlBlueDot.style.display = 'block';
      dlBlueDot.classList.remove('completed');
    } else if (state === 'completed') {
      dlBlueDot.style.display = 'block';
      dlBlueDot.classList.add('completed');
    } else {
      dlBlueDot.style.display = 'none';
      dlBlueDot.classList.remove('completed');
    }
    updateBtnTooltip();
  };

  const toggleDropdown = (show) => {
    if (!dropdownPanel) return;
    const isCurrentlyOpen = dropdownPanel.style.display === 'block';
    const nextState = (typeof show === 'boolean') ? show : !isCurrentlyOpen;
    dropdownPanel.style.display = nextState ? 'block' : 'none';
    dropdownTrigger?.classList.toggle('active', nextState);
  };

  dropdownTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  dropdownPanel?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const closePyramidModal = () => {
    toggleDropdown(false);
    smoothCloseModal(modal, () => {
      btnOpen.classList.remove('expanded');
      updateBtnTooltip();
    });
  };

  const openPyramidModal = async () => {
    if (typeof window.closeProvincePopover === 'function') {
      window.closeProvincePopover();
    } else {
      const provPopover = document.getElementById('prov-popover-menu');
      if (provPopover && provPopover.style.display !== 'none') smoothClosePopover(provPopover);
      document.getElementById('btn-prov-dropdown-trigger')?.classList.remove('active');
    }

    const searchPopover = document.getElementById('search-popover');
    if (searchPopover && searchPopover.style.display !== 'none') {
      smoothClosePopover(searchPopover);
    }

    if (typeof window.clearLandingMarker === 'function') {
      window.clearLandingMarker();
    }
    if (typeof hideRouteFloatingDropdown === 'function') {
      hideRouteFloatingDropdown();
    }

    toggleDropdown(false);

    btnOpen.classList.add('expanded');
    updateBtnTooltip();

    try {
      await syncOfflineManifest();
    } catch (e) {
      console.warn('[Offline Modal] syncOfflineManifest error:', e);
    }

    try {
      renderProvinceGrid();
    } catch (e) {
      console.warn('[Offline Modal] renderProvinceGrid error:', e);
    }

    // 若后台正在下载，同步激活对应的层级卡片高亮
    if (activeDownloadSession?.maxZ) {
      const activeZ = String(activeDownloadSession.maxZ);
      if (zoomInput) zoomInput.value = activeZ;
      zoomPills.forEach(p => {
        p.classList.toggle('active', p.dataset.value === activeZ);
      });
    }

    try {
      updateEstimation();
    } catch (e) {
      console.warn('[Offline Modal] updateEstimation error:', e);
    }

    showElement(modal, 'flex');
  };


  const togglePyramidModal = () => {
    if (modal.style.display !== 'none') {
      closePyramidModal();
    } else {
      openPyramidModal();
    }
  };

  window.closePyramidModal = closePyramidModal;
  window.openPyramidModal = openPyramidModal;
  window.togglePyramidModal = togglePyramidModal;

  // 弹窗内部点击与外部空白处点击收起调度
  modal.addEventListener('click', (e) => {
    // 1. 如果省份下拉面板展开中，点击卡片内部空白处收起下拉面板
    if (dropdownPanel && dropdownPanel.style.display === 'block') {
      if (!dropdownTrigger?.contains(e.target) && !dropdownPanel?.contains(e.target)) {
        toggleDropdown(false);
      }
    }
    // 2. 如果点击的是遮罩空白背景处，收起整个弹窗并缩放回图标
    if (e.target === modal) {
      closePyramidModal();
    }
  });

  // 全局点击监听：弹窗开启时，点击外部任何空白处平滑收起并缩放回图标
  document.addEventListener('click', (e) => {
    if (modal.style.display !== 'none') {
      const modalCard = modal.querySelector('.modal-card');
      if (!modalCard?.contains(e.target) && !btnOpen.contains(e.target)) {
        closePyramidModal();
      }
    }
  });

  const getSelectedKeys = () => {
    if (!multiGrid) return [];
    const chks = multiGrid.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(chks).map(c => c.value);
  };

  const updateCounter = () => {
    const keys = getSelectedKeys();
    const totalCount = Object.keys(PROVINCES_DATA).filter(k => k !== 'china').length;
    const offlineState = getOfflineProvState();
    if (counterBadge) {
      if (keys.length === totalCount) {
        counterBadge.innerText = `全选 (${keys.length} 省)`;
      } else {
        counterBadge.innerText = `已选 ${keys.length} 省`;
      }
    }
    if (dropdownSummary) {
      const isDownloading = downloadDotState === 'downloading' || Boolean(activeDownloadSession);
      const activeKeys = activeDownloadSession?.keys || [];
      const isViewingActiveTask = isDownloading && activeKeys.length > 0 && keys.length === activeKeys.length && keys.every(k => activeKeys.includes(k));

      if (keys.length === 0) {
        dropdownSummary.innerText = '请点击展开选择目标省份...';
        dropdownSummary.style.color = '#94a3b8';
      } else if (keys.length === totalCount) {
        dropdownSummary.innerText = '全国 34 个省/直辖市/自治区 (已全选)';
        dropdownSummary.style.color = '#1e293b';
      } else if (keys.length === 1) {
        const k = keys[0];
        const name = PROVINCES_DATA[k]?.name || k;
        const s = offlineState[k];
        const maxZ = s ? (s.maxZ || 0) : 0;
        let statusText = maxZ >= 14 ? ' · 已全量就绪 (L14)' : (maxZ >= 10 ? ` · 已就绪 (L${maxZ})` : ' · 未下载');
        if (isViewingActiveTask) {
          statusText = ' · 下载进行中';
        }
        dropdownSummary.innerText = `${name}${statusText}`;
        dropdownSummary.style.color = '#1e293b';
      } else {
        const names = keys.map(k => PROVINCES_DATA[k]?.name || k).filter(Boolean);
        let summaryText = names.length <= 4 ? names.join('、') : `${names.slice(0, 3).join('、')} 等 ${names.length} 个省份`;
        if (isViewingActiveTask) {
          summaryText += ' (下载进行中)';
        }
        dropdownSummary.innerText = summaryText;
        dropdownSummary.style.color = '#1e293b';
      }
    }
  };

  // 渲染全国省份网格 (使用显式 L14/L12/未下载 徽章替代模糊单点；下载进行中精准锁定当前任务省份，平常保持已勾选状态)
  const renderProvinceGrid = () => {
    if (!multiGrid) return;
    multiGrid.innerHTML = '';
    const offlineState = getOfflineProvState();

    // 确定选区：
    // 1. 若后台正在下载，严禁选区偏移，精准选中当前正在下载的任务省份；
    // 2. 若无下载但已有用户选区，完整保留用户的当前选区；
    // 3. 仅在初始未选时，按地图视口定位单个省份。
    let defaultKey = (currentSelectedProvKey && currentSelectedProvKey !== 'china') ? currentSelectedProvKey : null;
    if (!defaultKey && map) {
      const c = map.getCenter();
      if (c) {
        for (const [k, p] of Object.entries(PROVINCES_DATA)) {
          if (k === 'china' || !p.bbox) continue;
          if (c.lng >= p.bbox[0] && c.lng <= p.bbox[1] && c.lat >= p.bbox[2] && c.lat <= p.bbox[3]) {
            defaultKey = k;
            break;
          }
        }
      }
    }
    if (!defaultKey) defaultKey = 'shandong';

    let selectedKeySet = new Set();
    if (activeDownloadSession && Array.isArray(activeDownloadSession.keys) && activeDownloadSession.keys.length > 0) {
      selectedKeySet = new Set(activeDownloadSession.keys);
    } else {
      const existing = getSelectedKeys();
      if (existing.length > 0) {
        selectedKeySet = new Set(existing);
      } else if (defaultKey) {
        selectedKeySet = new Set([defaultKey]);
      }
    }

    // 按拼音排序省份 (排除 china)
    const sortedKeys = Object.keys(PROVINCES_DATA)
      .filter(k => k !== 'china')
      .sort((a, b) => {
        const pa = PROVINCES_DATA[a];
        const pb = PROVINCES_DATA[b];
        return (pa.pinyin || pa.name).localeCompare(pb.pinyin || pb.name, 'zh-Hans-CN');
      });

    const isLayerLevelComplete = (s, layer, z) => Boolean(s?.layers?.[layer]?.levels?.[z]?.complete);
    const isLevelComplete = (s, z) => {
      if (!s) return false;
      const hasDem = Boolean(s.dem || (s.layers?.dem && Object.values(s.layers.dem.levels || {}).some(l => (l.present || 0) > 0)));
      const hasVec = Boolean(s.vec || (s.layers?.vector && Object.values(s.layers.vector.levels || {}).some(l => (l.present || 0) > 0)));
      if (hasDem && hasVec) {
        return isLayerLevelComplete(s, 'dem', z) && isLayerLevelComplete(s, 'vector', z);
      }
      if (hasVec) return isLayerLevelComplete(s, 'vector', z);
      if (hasDem) return isLayerLevelComplete(s, 'dem', z);
      return false;
    };
    const isLevelPartial = (s, z) => {
      if (!s) return false;
      const layerStates = ['dem', 'vector'].map(layer => s.layers?.[layer]?.levels?.[z]).filter(Boolean);
      if (layerStates.length > 0) return layerStates.some(level => (level.present || 0) > 0);
      return (s.partialZ || s.maxZ || 0) >= z;
    };

    sortedKeys.forEach(k => {
      const p = PROVINCES_DATA[k];
      const saved = offlineState[k];
      const maxZ = saved ? (saved.maxZ || 0) : 0;
      const partialZ = saved ? (saved.partialZ || 0) : 0;

      // 科学判定全量就绪 (绿点/绿徽章)：
      // 1. 已达到 L10~L14 任一已就绪层级 (maxZ >= 10)，且自 L10 至 maxZ 连续完整，且无未完成的高层级半途切片 (partialZ <= maxZ)；
      // 2. 或者全部 10~14 层级已全量完整。
      const hasContiguousComplete = maxZ >= 10 && [10, 11, 12, 13, 14].filter(z => z <= maxZ).every(z => isLevelComplete(saved, z));
      const isFull = hasContiguousComplete && (partialZ <= maxZ || [10, 11, 12, 13, 14].every(z => isLevelComplete(saved, z)));

      // 判断部分下载 (蓝点/蓝徽章)：
      // 存在切片但尚未达到完整连续就绪状态 (如 4/10 切片，或 partialZ > maxZ)
      const isPartial = !isFull && ((partialZ >= 10) || (maxZ >= 10) || [10, 11, 12, 13, 14].some(z => isLevelPartial(saved, z)));
      const isChecked = selectedKeySet.has(k);

      const label = document.createElement('label');
      const readyClass = isFull ? ' ready-full' : (isPartial ? ' ready-partial' : '');
      label.className = `prov-chip-item${readyClass}${isChecked ? ' checked' : ''}`;
      label.dataset.key = k;

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = k;
      chk.checked = isChecked;

      chk.addEventListener('change', () => {
        label.classList.toggle('checked', chk.checked);
        updateCounter();
        updateEstimation();
      });

      label.appendChild(chk);

      const spanName = document.createElement('span');
      spanName.className = 'prov-chip-name';
      spanName.innerText = p.name;
      label.appendChild(spanName);

      const badge = document.createElement('span');
      if (isFull) {
        badge.className = 'prov-chip-badge full';
        badge.innerText = `L${maxZ || 14}`;
      } else if (isPartial) {
        badge.className = 'prov-chip-badge partial';
        const displayZ = Math.max(maxZ, partialZ || 0);
        badge.innerText = displayZ >= 10 ? `L${displayZ}` : '部分';
      } else {
        badge.className = 'prov-chip-badge empty';
        badge.innerText = '未下载';
      }
      label.appendChild(badge);

      multiGrid.appendChild(label);
    });

    updateCounter();
  };
  window.refreshOfflineProvinceGrid = () => {
    renderProvinceGrid();
    updateEstimation();
  };

  // 快捷按钮：全选、反选、清空
  btnSelectAll?.addEventListener('click', () => {
    if (!multiGrid) return;
    multiGrid.querySelectorAll('.prov-chip-item').forEach(item => {
      const chk = item.querySelector('input[type="checkbox"]');
      if (chk) chk.checked = true;
      item.classList.add('checked');
    });
    updateCounter();
    updateEstimation();
  });

  btnSelectInvert?.addEventListener('click', () => {
    if (!multiGrid) return;
    multiGrid.querySelectorAll('.prov-chip-item').forEach(item => {
      const chk = item.querySelector('input[type="checkbox"]');
      if (chk) chk.checked = !chk.checked;
      item.classList.toggle('checked', chk ? chk.checked : false);
    });
    updateCounter();
    updateEstimation();
  });

  btnSelectNone?.addEventListener('click', () => {
    if (!multiGrid) return;
    multiGrid.querySelectorAll('.prov-chip-item').forEach(item => {
      const chk = item.querySelector('input[type="checkbox"]');
      if (chk) chk.checked = false;
      item.classList.remove('checked');
    });
    updateCounter();
    updateEstimation();
  });

  // 层级卡片 (Zoom Pills) 交互
  zoomPills.forEach(pill => {
    pill.addEventListener('click', () => {
      zoomPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const val = pill.dataset.value || '10';
      if (zoomInput) zoomInput.value = val;
      updateEstimation();
    });
  });

  // 实时估算金字塔切片总数与体积，并刷新已就绪层级圆点和状态文案
  const updateEstimation = () => {
    const selectedKeys = getSelectedKeys();
    const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;
    const offlineState = getOfflineProvState();
    const requestedLayers = [];
    if (chkDem?.checked) requestedLayers.push('dem');
    if (chkVec?.checked) requestedLayers.push('vector');

    const isLevelComplete = (s, z) => {
      if (!s) return false;
      if (requestedLayers.length === 0) return false;
      return requestedLayers.every(layer => Boolean(s.layers?.[layer]?.levels?.[z]?.complete));
    };
    const isLevelPartial = (s, z) => {
      if (!s) return false;
      const layerStates = requestedLayers.map(layer => s.layers?.[layer]?.levels?.[z]).filter(Boolean);
      if (layerStates.length > 0) return layerStates.some(level => (level.present || 0) > 0);
      return (s.partialZ || s.maxZ || 0) >= z;
    };

    // 1. 刷新各个层级卡片中的微光圆点 ● (绿色100%全量 / 蓝色部分下载 / 灰色未下载)
    [10, 11, 12, 13, 14].forEach(z => {
      const dot = document.getElementById(`zoom-dot-${z}`);
      if (dot) {
        let isReadyForZ = false;
        let isPartialForZ = false;

        if (selectedKeys.length > 0) {
          isReadyForZ = selectedKeys.every(k => isLevelComplete(offlineState[k], z));
          if (!isReadyForZ) {
            isPartialForZ = selectedKeys.some(k => isLevelPartial(offlineState[k], z));
          }
        }

        dot.classList.toggle('ready', isReadyForZ);
        dot.classList.toggle('partial', isPartialForZ && !isReadyForZ);
      }
    });

    if (selectedKeys.length === 0) {
      statCount.innerText = '未选择省份';
      statSize.innerText = '0 MB';
      if (provStatusTag) provStatusTag.style.display = 'none';
      if (progressBox) progressBox.style.display = 'none';
      btnStart.style.display = 'inline-block';
      btnStart.disabled = true;
      btnStart.innerText = '请选择目标省份';
      if (btnRetry) btnRetry.style.display = 'none';
      if (btnDone) btnDone.style.display = 'none';
      return;
    }

    let totalIncrementalTiles = 0;
    let allReady = true;
    let minSavedZ = Infinity;
    let hasAnySaved = false;

    const downloadDem = requestedLayers.includes('dem');
    const downloadVec = requestedLayers.includes('vector');

    selectedKeys.forEach(k => {
      const prov = PROVINCES_DATA[k];
      if (!prov || !prov.bbox) return;
      const saved = offlineState[k];
      let contiguousReadyZ = 9;
      for (let z = 10; z <= maxZ; z++) {
        if (!isLevelComplete(saved, z)) break;
        contiguousReadyZ = z;
      }
      if (contiguousReadyZ < maxZ) allReady = false;
      minSavedZ = Math.min(minSavedZ, contiguousReadyZ);
      if ([10, 11, 12, 13, 14].some(z => z <= maxZ && isLevelPartial(saved, z))) hasAnySaved = true;

      // Count holes from the worker's authoritative per-layer inventory. A
      // partially present high level is never treated as a complete pyramid.
      const [minLon, maxLon, minLat, maxLat] = prov.bbox;
      for (let z = 0; z <= maxZ; z++) {
        const n = 1 << z;
        const x1 = Math.max(0, Math.floor((minLon + 180) / 360 * n));
        const x2 = Math.min(n - 1, Math.floor((maxLon + 180) / 360 * n));
        const latRad1 = Math.min(85.0511, maxLat) * Math.PI / 180;
        const latRad2 = Math.max(-85.0511, minLat) * Math.PI / 180;
        const y1 = Math.max(0, Math.floor((1 - Math.log(Math.tan(latRad1) + 1 / Math.cos(latRad1)) / Math.PI) / 2 * n));
        const y2 = Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2 * n));
        const geometricExpected = (x2 - x1 + 1) * (y2 - y1 + 1);
        for (const layer of requestedLayers) {
          const level = saved?.layers?.[layer]?.levels?.[z];
          if (level?.complete) continue;
          const expected = Number.isFinite(Number(level?.expected)) ? Number(level.expected) : geometricExpected;
          const present = Number.isFinite(Number(level?.present)) ? Number(level.present) : 0;
          totalIncrementalTiles += Math.max(0, expected - present);
        }
      }
    });

    const totalTiles = totalIncrementalTiles;

    const isDownloading = downloadDotState === 'downloading' || Boolean(activeDownloadSession);
    const activeKeys = activeDownloadSession?.keys || [];
    const isViewingActiveTask = isDownloading && activeKeys.length > 0 && selectedKeys.length === activeKeys.length && selectedKeys.every(k => activeKeys.includes(k));

    if (isDownloading) {
      btnCancel.style.display = 'inline-block';
      btnCancel.innerText = '中止下载';
      if (btnDone) btnDone.style.display = 'none';

      if (isViewingActiveTask) {
        btnStart.style.display = 'none';
        if (btnUpdate) btnUpdate.style.display = 'none';
        if (btnRetry) btnRetry.style.display = 'none';
        if (provStatusTag) {
          provStatusTag.style.display = 'none';
        }
        if (progressBox) {
          progressBox.style.display = 'flex';
        }
      } else {
        const activeNames = activeDownloadSession?.provNames?.join('、') || '其他省份';
        btnStart.style.display = 'inline-block';
        btnStart.disabled = false;
        btnStart.innerText = '中止当前并下载所选省份';
        if (btnUpdate) btnUpdate.style.display = 'none';
        if (btnRetry) btnRetry.style.display = 'none';
        if (progressBox) {
          progressBox.style.display = 'none';
        }
        if (provStatusTag) {
          provStatusTag.className = 'prov-status-line busy';
          provStatusTag.style.display = 'inline-flex';
          provStatusTag.innerHTML = `<span class="prov-status-dot busy"></span> 后台正在下载【${activeNames}】· 可点击右侧切换`;
        }
      }
    } else {
      btnCancel.style.display = 'none';
      if (progressBox) {
        progressBox.style.display = 'none';
      }
      if (allReady) {
        statCount.innerText = '已全部就绪';
        statSize.innerText = '0 MB';
        if (provStatusTag) {
          provStatusTag.className = 'prov-status-line ready';
          provStatusTag.style.display = 'inline-flex';
          provStatusTag.innerHTML = `<span class="prov-status-dot ready"></span> 所选省份在 L${maxZ} 已全部就绪`;
        }
        btnStart.style.display = 'none';
        if (btnUpdate) {
          btnUpdate.style.display = 'inline-block';
          btnUpdate.disabled = false;
          btnUpdate.innerHTML = '⚡ 增量更新';
        }
        if (btnRetry) btnRetry.style.display = 'inline-block';
        if (btnDone) btnDone.style.display = 'inline-block';
      } else {
        statCount.innerText = `${formatTileCount(totalTiles)} 块`;
        const avgBytes = 42 * 1024;
        const totalBytes = totalTiles * avgBytes;
        if (totalBytes > 1024 * 1024 * 1024) {
          statSize.innerText = `约 ${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        } else {
          statSize.innerText = `约 ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
        }

        if (provStatusTag) {
          provStatusTag.style.display = 'inline-flex';
          if (hasAnySaved && minSavedZ >= 10) {
            provStatusTag.className = 'prov-status-line partial';
            provStatusTag.innerHTML = `<span class="prov-status-dot partial"></span> 已就绪至 L${minSavedZ} · 待扩充至 L${maxZ}`;
          } else {
            provStatusTag.className = 'prov-status-line pending';
            provStatusTag.innerHTML = `<span class="prov-status-dot pending"></span> 待下载至 L${maxZ}`;
          }
        }

        btnStart.style.display = 'inline-block';
        btnStart.disabled = false;
        btnStart.innerText = (hasAnySaved && minSavedZ >= 10) ? `扩充下载 (至 L${maxZ})` : `开始下载 (至 L${maxZ})`;
        if (btnUpdate) btnUpdate.style.display = 'none';
        if (btnRetry) btnRetry.style.display = 'none';
        if (btnDone) btnDone.style.display = 'none';
      }
    }
  };

  btnOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePyramidModal();
  });

  btnClose.addEventListener('click', () => {
    closePyramidModal();
  });

  btnDone?.addEventListener('click', () => {
    setDownloadDotState('idle');
    closePyramidModal();
  });

  chkDem.addEventListener('change', updateEstimation);
  chkVec.addEventListener('change', updateEstimation);

  // 触发多省批量下载任务 (isVerify 为 true 时极速本地校验，isIncrementalUpdate 为 true 时执行方案 A 增量更新)
  const triggerDownload = async (isVerify = false, isIncrementalUpdate = false) => {
    const selectedKeys = getSelectedKeys();
    if (selectedKeys.length === 0) return;

    if (downloadDotState === 'downloading') {
      if (window.electronAPI && window.electronAPI.cancelPyramidDownload) {
        await window.electronAPI.cancelPyramidDownload();
        await new Promise(r => setTimeout(r, 200));
      }
    }

    const provinces = selectedKeys.map(k => {
      const p = PROVINCES_DATA[k];
      return { key: k, name: p.name, bbox: p.bbox };
    });

    const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;

    activeDownloadSession = {
      keys: [...selectedKeys],
      provNames: provinces.map(p => p.name),
      maxZ
    };

    setDownloadDotState('downloading');
    document.body.classList.add('is-downloading');
    btnStart.style.display = 'none';
    btnCancel.style.display = 'inline-block';
    btnCancel.innerText = '中止下载';
    if (btnRetry) btnRetry.style.display = 'none';
    if (btnUpdate) btnUpdate.style.display = 'none';
    if (btnDone) btnDone.style.display = 'none';
    progressBox.style.display = 'flex';
    progressFill.style.setProperty('--progress', '0');
    if (isIncrementalUpdate) {
      progressNum.innerText = '方案 A：正在通过 If-Modified-Since 启动切片级增量更新...';
    } else if (isVerify) {
      progressNum.innerText = '正在高速校验本地已缓存切片...';
    } else {
      progressNum.innerText = '正在准备批量免重下载通道...';
    }

    if (window.electronAPI && window.electronAPI.startPyramidDownload) {
      try {
        await window.electronAPI.startPyramidDownload({
          provinces,
          minZ: 0,
          maxZ,
          downloadDem: chkDem.checked,
          downloadVec: chkVec.checked,
          isVerify,
          isIncrementalUpdate
        });
      } catch (err) {
        document.body.classList.remove('is-downloading');
        activeDownloadSession = null;
        setDownloadDotState('idle');
        progressNum.innerText = `下载遇到异常: ${err.message}`;
        updateEstimation();
      }
    }
  };

  btnStart.addEventListener('click', () => triggerDownload(false, false));
  btnRetry?.addEventListener('click', () => triggerDownload(true, false));
  btnUpdate?.addEventListener('click', () => triggerDownload(false, true));

  btnCheckUpdate?.addEventListener('click', async () => {
    btnCheckUpdate.disabled = true;
    btnCheckUpdate.innerText = '🔍 检查中...';
    try {
      if (window.electronAPI && window.electronAPI.checkTileUpdates) {
        const info = await window.electronAPI.checkTileUpdates();
        if (info && info.success) {
          if (info.hasUpdates) {
            btnCheckUpdate.innerText = '⚡ 云端有新路网';
            btnCheckUpdate.style.background = '#fef3c7';
            btnCheckUpdate.style.borderColor = '#fde047';
            btnCheckUpdate.style.color = '#b45309';
          } else {
            btnCheckUpdate.innerText = '✅ 图层已最新';
            btnCheckUpdate.style.background = '#ecfdf5';
            btnCheckUpdate.style.borderColor = '#a7f3d0';
            btnCheckUpdate.style.color = '#047857';
          }
        } else {
          btnCheckUpdate.innerText = '🔍 检查图层更新';
        }
      }
    } catch (e) {
      btnCheckUpdate.innerText = '🔍 检查图层更新';
    } finally {
      setTimeout(() => {
        btnCheckUpdate.disabled = false;
      }, 2500);
    }
  });

  // 中止下载
  btnCancel.addEventListener('click', async () => {
    document.body.classList.remove('is-downloading');
    activeDownloadSession = null;
    setDownloadDotState('idle');
    if (window.electronAPI && window.electronAPI.cancelPyramidDownload) {
      await window.electronAPI.cancelPyramidDownload();
    }
    btnStart.style.display = 'inline-block';
    btnStart.disabled = false;
    btnStart.innerText = '开始下载';
    btnCancel.style.display = 'none';
    if (btnRetry) btnRetry.style.display = 'none';
    if (btnUpdate) btnUpdate.style.display = 'none';
    if (progressTask) progressTask.innerText = '已中止下载';
    progressNum.innerText = '下载已停止';
    progressSpeed.innerText = '';
    updateEstimation();
  });

  // 监听后台批量下载进度广播与完成落盘
  if (window.electronAPI && window.electronAPI.onDownloadProgress) {
    window.electronAPI.onDownloadProgress(data => {
      progressFill.style.setProperty('--progress', String(Math.max(0, Math.min(1, Number(data.percent || 0) / 100))));
      const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;
      const provName = data.currentProvince || '目标省份';
      const zStr = data.currentZ ? ` · L${data.currentZ}` : ` · L${maxZ}`;

      if (!data.done) {
        if (!activeDownloadSession && data.currentProvince) {
          let matchedKey = null;
          for (const [k, p] of Object.entries(PROVINCES_DATA)) {
            if (p.name === data.currentProvince) {
              matchedKey = k;
              break;
            }
          }
          activeDownloadSession = {
            keys: matchedKey ? [matchedKey] : [],
            provNames: [data.currentProvince],
            maxZ: data.currentZ || maxZ
          };
        }
      } else {
        activeDownloadSession = null;
      }

      if (progressTask) {
        const curKeys = getSelectedKeys();
        const isMatched = curKeys.length === 1 && PROVINCES_DATA[curKeys[0]]?.name === provName;
        const taskPrefix = isMatched ? '📥 正在下载' : '📥 后台正在下载';
        if (data.isIncrementalUpdate) {
          progressTask.innerText = `⚡ 增量更新: ${provName}${zStr}`;
        } else if (data.isVerify) {
          progressTask.innerText = `🔍 正在校验: ${provName}${zStr}`;
        } else {
          progressTask.innerText = `${taskPrefix}: ${provName}${zStr}`;
        }
      }

      const countPart = `${formatTileCount(data.completed)} / ${formatTileCount(data.total)} 瓦片`;
      let detail = countPart;
      const readyCount = data.existingCount || data.skippedCount || 0;
      if (data.isIncrementalUpdate) {
        const unchanged = data.unchangedCount || 0;
        detail = (readyCount > 0 || unchanged > 0) ? `${countPart} (已就绪 ${formatTileCount(unchanged || readyCount)})` : countPart;
      } else if (readyCount > 0) {
        detail = `${countPart} (已就绪 ${formatTileCount(readyCount)})`;
      }

      progressNum.innerText = detail;

      // 实时网络速率计算与格式化
      let curByteSpeed = data.byteSpeed;
      const now = Date.now();
      if (curByteSpeed === undefined && data.bytes !== undefined) {
        if (lastProgressTime > 0) {
          const dt = (now - lastProgressTime) / 1000;
          if (dt > 0.2) {
            curByteSpeed = Math.max(0, Math.round((data.bytes - lastProgressBytes) / dt));
          }
        }
      }
      if (data.bytes !== undefined) {
        lastProgressBytes = data.bytes;
        lastProgressTime = now;
      }

      const isExisting = (!curByteSpeed || curByteSpeed <= 0) && (readyCount > 0 || (data.unchangedCount || 0) > 0 || (data.completed > 0 && (!data.bytes || data.bytes === 0)));
      progressSpeed.innerText = data.done ? '' : formatNetworkSpeed(curByteSpeed, data.isVerify, isExisting);
      progressPct.innerText = `${data.percent}%`;

      if (!data.done) {
        if (downloadDotState !== 'downloading') setDownloadDotState('downloading');
        if (!document.body.classList.contains('is-downloading')) document.body.classList.add('is-downloading');
      }

      // 关键：下载过程中节流联动刷新顶栏切片数与磁盘体积（每 2 秒最多一次，完成时立即更新），杜绝高频重排与顶栏毛玻璃重绘开销
      const titleStat = document.getElementById('titlebar-cache-stat');
      if (titleStat && data.totalTiles) {
        if (data.done || (now - lastTitleStatUpdate > 2000)) {
          lastTitleStatUpdate = now;
          titleStat.innerText = `离线: ${formatTileDisplay(data.totalTiles, data.totalBytes)}`;
        }
      }

      if (data.done) {
        document.body.classList.remove('is-downloading');
        const completedCleanly = !data.aborted && !(data.failedCount > 0);
        setDownloadDotState(completedCleanly ? 'completed' : 'idle');
        if (progressTask) {
          progressTask.innerText = data.aborted
            ? '下载已中止，已完成的切片继续保留'
            : (data.failedCount > 0
              ? `下载结束，${formatTileCount(data.failedCount)} 块失败，可继续补齐`
              : (data.isIncrementalUpdate ? '🎉 增量更新已完成' : '🎉 全部切片已下载就绪'));
        }
        progressSpeed.innerText = '';

        btnStart.style.display = completedCleanly ? 'none' : 'inline-block';
        btnStart.disabled = false;
        btnStart.innerText = completedCleanly ? '开始下载' : '继续补齐';
        btnCancel.style.display = 'none';
        if (btnDone) btnDone.style.display = completedCleanly ? 'inline-block' : 'none';
        if (btnRetry) btnRetry.style.display = completedCleanly ? 'inline-block' : 'none';
        if (btnUpdate) btnUpdate.style.display = completedCleanly ? 'inline-block' : 'none';

        if (provStatusTag) {
          provStatusTag.className = completedCleanly ? 'prov-status-line ready' : 'prov-status-line partial';
          provStatusTag.style.display = 'inline-flex';
          if (!completedCleanly) {
            provStatusTag.innerHTML = '<span class="prov-status-dot partial"></span> 部分切片已保留，尚未全部就绪';
          } else if (data.isIncrementalUpdate) {
            provStatusTag.innerHTML = '<span class="prov-status-dot ready"></span> 增量更新已完成 · 旧切片完好保留';
          } else {
            provStatusTag.innerHTML = `<span class="prov-status-dot ready"></span> 所选省份在 L${maxZ} 已全部就绪`;
          }
        }

        // 后台已经完成真实文件扫描；重新读取权威清单再刷新绿/蓝状态。
        syncOfflineManifest().then(() => {
          renderProvinceGrid();
          updateEstimation();
        }).catch(() => {
          renderProvinceGrid();
          updateEstimation();
        });

        if (data.isIncrementalUpdate) {
          if (typeof showFluentAlert === 'function') {
            showFluentAlert(`🎉 方案 A 增量更新完成！\n\n共扫描检查 ${data.total.toLocaleString()} 块瓦片：\n• 保持最新: ${(data.unchangedCount || 0).toLocaleString()} 块 (304 跳过，0 流量)\n• 增量更新: ${(data.updatedCount || 0).toLocaleString()} 块 (云端最新路网)\n• 查漏补缺: ${(data.newlyAddedCount || 0).toLocaleString()} 块\n\n您之前下载的数据全部完好保留在本地，未漏掉任何切片！`);
          }
        }

        // 刷新顶栏切片真实总数与体积
        if (titleStat) {
          const totalVal = data.totalTiles || data.savedCount || data.completed;
          titleStat.innerText = `离线: ${formatTileDisplay(totalVal, data.totalBytes)}`;
        }
      }
    });
  }
}

// 软件版本在线微更新系统 (点击最左侧 Logo 原地 3D 翻转，底色为进度条，完成提示覆盖安装，0弹窗)
function setupAppUpdate() {
  const brandBtn = document.getElementById('header-brand-logo-btn');
  const brandFlipCard = document.getElementById('brand-flip-card');
  const brandFlipBackFace = document.getElementById('brand-flip-back-face');
  const brandProgressBar = document.getElementById('brand-update-progress-bar');
  const brandVerBadge = document.getElementById('brand-ver-badge-txt');
  const brandLogo = brandBtn ? brandBtn.querySelector('.header-brand-logo') : null;

  if (!brandBtn || !brandFlipCard || !brandVerBadge) return;

  let isUpdating = false;
  let isReadyToInstall = false;
  let isChecking = false;
  let pendingUpdate = null;
  let autoFlipTimer = null;

  const flipToFront = () => {
    if (isUpdating && !isReadyToInstall) return;
    clearTimeout(autoFlipTimer);
    brandFlipCard.classList.remove('flipped');
    isUpdating = false;
    isReadyToInstall = false;
  };

  // 左键点击 Logo 区域：浏览器/手机端点击直接登录，桌面端点击图标登录，点击文本翻转更新
  brandBtn.addEventListener('click', async (e) => {
    // 浏览器端或移动触控设备：点击 Logo 直接呼出登录与云端漫游弹窗
    if (!window.electronAPI || window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024)) {
      e.stopPropagation();
      if (typeof window.openSyncModal === 'function') {
        window.openSyncModal();
      }
      return;
    }

    // 桌面客户端点击左侧 Logo 图标直接打开登录弹窗，点击右侧文本执行翻转检查更新
    if (e.target.closest('.header-brand-logo')) {
      e.stopPropagation();
      if (typeof window.openSyncModal === 'function') {
        window.openSyncModal();
      }
      return;
    }

    // 1. 若已下载完毕，提示“覆盖安装”，再点击一下此标签即执行覆盖安装
    if (isReadyToInstall) {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.installAppUpdate) {
        window.electronAPI.installAppUpdate();
      }
      return;
    }

    if (isUpdating) return;

    // 2. 图标微旋转反馈
    if (brandLogo) {
      brandLogo.classList.remove('checking-spin');
      void brandLogo.offsetWidth;
      brandLogo.classList.add('checking-spin');
    }

    // 3. 若当前已处于翻转状态
    if (brandFlipCard.classList.contains('flipped')) {
      // 若有待安装的新版本，点击红标签直接启动原地更新
      if (pendingUpdate && pendingUpdate.hasUpdate) {
        startInPlaceUpdate();
        return;
      }
      // 再次点击直接翻转复原
      flipToFront();
      return;
    }

    // 4. 执行 3D 翻转
    clearTimeout(autoFlipTimer);
    brandFlipCard.classList.add('flipped');
    brandFlipBackFace?.classList.remove('latest', 'has-update');
    brandFlipBackFace?.removeAttribute('title');
    brandBtn?.removeAttribute('title');
    if (brandProgressBar) brandProgressBar.style.width = '0%';

    let currentVer = APP_VERSION;
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      try {
        currentVer = await window.electronAPI.getAppVersion();
      } catch (err) {}
    }
    const verClean = String(currentVer).replace(/^v/, '');
    brandVerBadge.innerText = `v${verClean}`;

    if (isChecking) return;
    isChecking = true;

    try {
      if (window.electronAPI && window.electronAPI.checkForUpdates) {
        const updateInfo = await window.electronAPI.checkForUpdates();
        isChecking = false;

        if (updateInfo && updateInfo.hasUpdate) {
          pendingUpdate = updateInfo;
          const newVer = String(updateInfo.version).replace(/^v/, '');
          brandFlipBackFace?.classList.remove('latest');
          brandFlipBackFace?.classList.add('has-update');
          brandVerBadge.innerText = `v${newVer}`;
          brandFlipBackFace?.removeAttribute('title');
          return;
        } else {
          // 无新版本：显示绿色当前版本号
          brandFlipBackFace?.classList.remove('has-update');
          brandFlipBackFace?.classList.add('latest');
          brandVerBadge.innerText = `v${verClean}`;
          brandFlipBackFace?.removeAttribute('title');
        }
      } else {
        isChecking = false;
        brandFlipBackFace?.classList.add('latest');
        brandVerBadge.innerText = `v${verClean}`;
        brandFlipBackFace?.removeAttribute('title');
      }
    } catch (err) {
      isChecking = false;
      brandFlipBackFace?.classList.add('latest');
      brandVerBadge.innerText = `v${verClean}`;
      brandFlipBackFace?.removeAttribute('title');
    }

    // 无新版或网络正常时，3.5秒后自动平滑翻转复原
    autoFlipTimer = setTimeout(() => {
      flipToFront();
    }, 3500);
  });

  // 原地静默启动更新下载，以标签底色为进度条
  const startInPlaceUpdate = async () => {
    if (!pendingUpdate || isUpdating) return;
    if (!window.electronAPI || !window.electronAPI.startAppUpdate) return;

    isUpdating = true;
    isReadyToInstall = false;
    clearTimeout(autoFlipTimer);
    brandVerBadge.innerText = '0%';
    if (brandProgressBar) brandProgressBar.style.width = '0%';

    // 监听实时下载进度
    window.electronAPI.onUpdateProgress(data => {
      const pct = Math.min(100, Math.max(0, data.percent || 0));
      if (brandProgressBar) brandProgressBar.style.width = `${pct}%`;
      if (pct < 100) {
        brandVerBadge.innerText = `${pct}%`;
      } else {
        brandProgressBar.style.width = '100%';
        brandVerBadge.innerText = '覆盖安装';
        brandFlipBackFace?.classList.remove('has-update');
        brandFlipBackFace?.classList.add('latest');
        brandFlipBackFace?.removeAttribute('title');
        isReadyToInstall = true;
      }
    });

    try {
      const res = await window.electronAPI.startAppUpdate({
        downloadUrl: pendingUpdate.downloadUrl,
        backupUrl: pendingUpdate.backupUrl,
        sha256: pendingUpdate.sha256
      });
      if (!res.success) {
        isUpdating = false;
        isReadyToInstall = false;
        brandVerBadge.innerText = '更新失败';
        setTimeout(flipToFront, 2500);
      }
    } catch (err) {
      isUpdating = false;
      isReadyToInstall = false;
      brandVerBadge.innerText = '更新异常';
      setTimeout(flipToFront, 2500);
    }
  };

  // 点击外部任意区域或按下 ESC 时翻转复原
  document.addEventListener('click', (e) => {
    if (!brandBtn.contains(e.target) && (!isUpdating || isReadyToInstall)) {
      flipToFront();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (!isUpdating || isReadyToInstall) && brandFlipCard.classList.contains('flipped')) {
      flipToFront();
    }
  });
}

/// 全局实时云端漫游同步引擎 (用户登录后，标记增删改、路线、视角与偏好变动全自动持久化到 R2)
let cloudSyncDebounceTimer = null;
let cloudSyncUploading = false;
let cloudSyncPending = false;
const USER_ACCOUNT_STORAGE_KEY = 'outmap_user_account';

// Standalone Web & Desktop Cloudflare R2 Cloud Sync Engine
const WEB_R2_SYNC = {
  accountId: 'f0423794f245054a81f1fbc59ea859c5',
  bucket: 'sagspud',
  accessKeyId: 'bd4944821b855719862c66cdc7700569',
  secretAccessKey: 'aec00662af922369c4e84b81e6a7966f68349d5be90dbd1f5923db447d958d49'
};
const bytesToHex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
async function webCryptoSha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return crypto.subtle.digest('SHA-256', bytes);
}
async function webCryptoHmac(key, value) {
  const rawKey = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}
async function uploadWebCloudSyncData({ syncKey, data }) {
  const key = (syncKey || 'default').trim();
  const host = `${WEB_R2_SYNC.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${WEB_R2_SYNC.bucket}/Outmap/sync/${encodeURIComponent(key)}.json`;
  const body = JSON.stringify(data, null, 2);
  const payloadHash = bytesToHex(await webCryptoSha256(body));
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, bytesToHex(await webCryptoSha256(canonicalRequest))].join('\n');
  const kDate = await webCryptoHmac(`AWS4${WEB_R2_SYNC.secretAccessKey}`, dateStamp);
  const kRegion = await webCryptoHmac(kDate, 'auto');
  const kService = await webCryptoHmac(kRegion, 's3');
  const kSigning = await webCryptoHmac(kService, 'aws4_request');
  const signature = bytesToHex(await webCryptoHmac(kSigning, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${WEB_R2_SYNC.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  let response;
  try {
    response = await fetch(`https://${host}${canonicalUri}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        Authorization: authorization
      },
      body
    });
  } catch (netErr) {
    throw new Error(`网络连接异常，未能连接到云端存储 (${netErr.message || '请检查网络或跨域'})`);
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`网页同步上传失败 (HTTP ${response.status}${errBody ? ': ' + errBody.slice(0, 80) : ''})`);
  }
  return { success: true };
}
async function uploadCloudSyncPayload(payload) {
  if (window.electronAPI?.uploadCloudSyncData) return window.electronAPI.uploadCloudSyncData(payload);
  return uploadWebCloudSyncData(payload);
}
window.uploadCloudSyncPayload = uploadCloudSyncPayload;


function getLoggedInUser() {
  try {
    const raw = localStorage.getItem(USER_ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return (obj && obj.loggedIn && obj.username) ? obj : null;
  } catch (e) {
    return null;
  }
}
window.getLoggedInUser = getLoggedInUser;

async function triggerRealtimeCloudSync(reason = 'change') {
  const user = getLoggedInUser();
  if (!user) return; // 只要登录即全量实时漫游，未登录则不上传

  clearTimeout(cloudSyncDebounceTimer);
  cloudSyncDebounceTimer = setTimeout(async () => {
    if (cloudSyncUploading) {
      cloudSyncPending = true;
      return;
    }
    cloudSyncUploading = true;
    try {
      const syncKey = user.syncKey || ('user_' + encodeURIComponent(user.username.toLowerCase()));

      // 1. 若是数据增删改操作，上传前优先拉取云端最新存档执行双向智能合并，防止覆盖手机/网页端新增地标
      let cloudData = null;
      if (reason !== 'view_changed' && reason !== 'pitch_lock_changed') {
        if (window.electronAPI?.pullCloudSyncData) {
          try {
            const pullRes = await window.electronAPI.pullCloudSyncData({ syncKey });
            if (pullRes?.success && pullRes.data) cloudData = pullRes.data;
          } catch (_) {}
        }
        if (!cloudData) {
          try {
            const r = await fetch(`https://r2.053999.xyz/Outmap/sync/${encodeURIComponent(syncKey)}.json?t=${Date.now()}`);
            if (r.ok) cloudData = await r.json();
          } catch (_) {}
        }
      }

      // 读取本地数据
      const localFavs = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
      const localRoutes = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
      const localFolders = JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]');

      // 双向智能合并与墓碑过滤
      const cloudDeleted = cloudData?.deletedWaypoints || [];
      const localDeleted = getDeletedWaypoints();
      const mergedDeleted = [...localDeleted, ...cloudDeleted].filter((item, idx, arr) =>
        arr.findIndex(x => (x.id && x.id === item.id) || (x.name === item.name && x.lng === item.lng && x.lat === item.lat)) === idx
      ).slice(-500);
      try { localStorage.setItem('outmap_deleted_waypoints', JSON.stringify(mergedDeleted)); } catch (e) {}

      const mergedFavs = mergeWaypoints(localFavs, cloudData?.favorites || [], mergedDeleted);
      const mergedRoutes = cloudData?.routes ? mergeRoutes(localRoutes, cloudData.routes) : localRoutes;
      const mergedFolders = cloudData?.folders ? mergeFolders(localFolders, cloudData.folders) : localFolders;

      // 若发现云端有新增地标或路线，立即同步写入本地并全量刷新地图与收藏夹列表！
      const hasNewIncoming = JSON.stringify(mergedFavs) !== JSON.stringify(localFavs)
        || JSON.stringify(mergedRoutes) !== JSON.stringify(localRoutes)
        || JSON.stringify(mergedFolders) !== JSON.stringify(localFolders);
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(mergedFavs));
      localStorage.setItem('outmap_saved_routes', JSON.stringify(mergedRoutes));
      localStorage.setItem('outmap_custom_folders', JSON.stringify(mergedFolders));

      if (hasNewIncoming && typeof window.reloadFavoritesData === 'function') {
        window.reloadFavoritesData();
      }

      const payload = {
        syncKey,
        data: {
          version: APP_VERSION,
          username: user.username,
          password: user.password || '',
          syncedAt: new Date().toISOString(),
          favorites: mergedFavs,
          folders: mergedFolders,
          routes: mergedRoutes,
          deletedWaypoints: mergedDeleted,
          views: window.mapInstance ? {
            center: window.mapInstance.getCenter(),
            zoom: window.mapInstance.getZoom(),
            pitch: window.mapInstance.getPitch(),
            bearing: window.mapInstance.getBearing()
          } : null,
          settings: {
            pitchLocked: localStorage.getItem('outmap_pitch_locked') === '1',
            lockedPitchVal: localStorage.getItem('outmap_locked_pitch_val') || '50'
          }
        }
      };

      {
        const res = await uploadCloudSyncPayload(payload);
        const userBadge = document.getElementById('sync-user-status-badge');
        if (res && res.success) {
          console.log(`[CloudSync] 实时自动漫游同步成功 (${reason})`);
          const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
          user.lastSyncTime = nowStr;
          try { localStorage.setItem(USER_ACCOUNT_STORAGE_KEY, JSON.stringify(user)); } catch (e) {}
          const statusText = document.getElementById('sync-status-text');
          if (statusText) {
            statusText.innerText = `上次同步: ${nowStr}`;
          }
          if (userBadge) {
            userBadge.innerText = '🟢 实时同步中';
            userBadge.className = 'sync-user-sync-badge';
          }
        } else {
          if (userBadge) {
            userBadge.innerText = '🔴 同步失败';
            userBadge.className = 'sync-user-sync-badge err';
          }
        }
      }
    } catch (e) {
      console.warn('[CloudSync] 实时自动同步后台提示:', e.message);
    } finally {
      cloudSyncUploading = false;
      if (cloudSyncPending) {
        cloudSyncPending = false;
        triggerRealtimeCloudSync('queued_change');
      }
    }
  }, 1200);
}
window.triggerRealtimeCloudSync = triggerRealtimeCloudSync;

// 用户极简登录与全量云端漫游同步系统
function setupCloudSync(map) {
  const brandBtn = document.getElementById('header-brand-logo-btn');
  const syncModal = document.getElementById('sync-modal');
  const loginView = document.getElementById('sync-login-view');
  const userView = document.getElementById('sync-user-view');
  const usernameInput = document.getElementById('sync-username');
  const passwordInput = document.getElementById('sync-password');
  const btnLogin = document.getElementById('btn-sync-login');
  const btnLogout = document.getElementById('btn-sync-logout');
  const userNameDisplay = document.getElementById('sync-user-name-display');
  const statusIndicator = document.getElementById('sync-status-indicator');
  const statusText = document.getElementById('sync-status-text');
  const btnClose = document.getElementById('btn-close-sync-modal');
  const btnCloseBtn = document.getElementById('btn-close-sync-btn');

  if (!syncModal) return;

  const showStatus = (msg, isErr = false) => {
    if (!statusText) return;
    statusText.innerText = msg;
    const dot = statusIndicator?.querySelector('.sync-dot-live');
    if (dot) {
      dot.style.color = isErr ? '#ef4444' : '#16a34a';
      dot.style.textShadow = isErr ? '0 0 6px rgba(239, 68, 68, 0.8)' : '0 0 6px rgba(22, 163, 74, 0.8)';
    }
    if (statusIndicator) {
      statusIndicator.style.background = isErr ? '#fef2f2' : '#f0fdf4';
      statusIndicator.style.borderColor = isErr ? '#fecaca' : '#bbf7d0';
      statusIndicator.style.color = isErr ? '#991b1b' : '#166534';
    }
  };

  const updateSyncModalView = () => {
    const user = getLoggedInUser();
    const userBadge = document.getElementById('sync-user-status-badge');
    if (user) {
      if (loginView) loginView.style.display = 'none';
      if (userView) userView.style.display = 'flex';
      if (userNameDisplay) userNameDisplay.innerText = user.username;
      if (userBadge) {
        userBadge.innerText = '🟢 实时同步中';
        userBadge.className = 'sync-user-sync-badge';
      }
      showStatus(user.lastSyncTime ? `上次同步: ${user.lastSyncTime}` : '实时同步中');
    } else {
      if (loginView) loginView.style.display = 'flex';
      if (userView) userView.style.display = 'none';
      showStatus('未登录 (当前使用本地浏览器存储)');
    }
  };

  const openSyncModal = () => {
    updateSyncModalView();
    showElement(syncModal, 'flex');
    if (!getLoggedInUser()) {
      setTimeout(() => usernameInput?.focus(), 80);
    }
  };
  window.openSyncModal = openSyncModal;

  // 执行全量双向智能合并与云端同步
  const executeFullSync = async (user, isUserInitiated = true) => {
    const syncKey = user.syncKey || ('user_' + encodeURIComponent(user.username.toLowerCase()));
    if (isUserInitiated) showStatus('正在同步云端数据...');

    try {
      // 1. 从云端拉取存档
      let cloudData = null;
      if (window.electronAPI && window.electronAPI.pullCloudSyncData) {
        const pullRes = await window.electronAPI.pullCloudSyncData({ syncKey });
        if (pullRes && pullRes.success && pullRes.data) {
          cloudData = pullRes.data;
        }
      }
      if (!cloudData) {
        try {
          const r = await fetch(`https://r2.053999.xyz/Outmap/sync/${encodeURIComponent(syncKey)}.json?t=${Date.now()}`);
          if (r.ok) cloudData = await r.json();
        } catch (e) {}
      }

      // 密码核验 (若云端已有且设置了密码)
      if (cloudData && cloudData.password && user.password && cloudData.password !== user.password) {
        throw new Error('密码不正确，请重新输入');
      }

      // 2. 读取本地数据
      const localFavs = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
      const localRoutes = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
      const localFolders = JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]');

      // 3. 墓碑与全量智能双向合并 (过滤已删除地标，避免跨端死而复生)
      const cloudDeleted = cloudData?.deletedWaypoints || [];
      const localDeleted = getDeletedWaypoints();
      const mergedDeleted = [...localDeleted, ...cloudDeleted].filter((item, idx, arr) =>
        arr.findIndex(x => (x.id && x.id === item.id) || (x.name === item.name && x.lng === item.lng && x.lat === item.lat)) === idx
      ).slice(-500);
      try { localStorage.setItem('outmap_deleted_waypoints', JSON.stringify(mergedDeleted)); } catch (e) {}

      const mergedFavs = mergeWaypoints(localFavs, cloudData?.favorites || [], mergedDeleted);
      const mergedRoutes = cloudData?.routes ? mergeRoutes(localRoutes, cloudData.routes) : localRoutes;
      const mergedFolders = cloudData?.folders ? mergeFolders(localFolders, cloudData.folders) : localFolders;

      // 4. 写回本地并全量刷新界面标记与列表
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(mergedFavs));
      localStorage.setItem('outmap_saved_routes', JSON.stringify(mergedRoutes));
      localStorage.setItem('outmap_custom_folders', JSON.stringify(mergedFolders));

      if (typeof window.reloadFavoritesData === 'function') {
        window.reloadFavoritesData();
      }

      // 5. 上传合并后的全量数据至云端
      const nowTime = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const payload = {
        syncKey,
        data: {
          version: APP_VERSION,
          username: user.username,
          password: user.password || '',
          syncedAt: new Date().toISOString(),
          favorites: mergedFavs,
          folders: mergedFolders,
          routes: mergedRoutes,
          deletedWaypoints: mergedDeleted,
          views: {
            center: map.getCenter(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing()
          },
          settings: {
            pitchLocked: localStorage.getItem('outmap_pitch_locked') === '1',
            lockedPitchVal: localStorage.getItem('outmap_locked_pitch_val') || '50'
          }
        }
      };

      {
        const upRes = await uploadCloudSyncPayload(payload);
        if (!upRes || !upRes.success) {
          throw new Error(upRes?.message || '上传云端失败');
        }
      }

      user.lastSyncTime = nowTime;
      localStorage.setItem(USER_ACCOUNT_STORAGE_KEY, JSON.stringify(user));

      if (window.electronAPI && window.electronAPI.saveCloudSyncConfig) {
        await window.electronAPI.saveCloudSyncConfig({
          syncKey,
          username: user.username,
          autoSync: true,
          lastSyncTime: nowTime
        });
      }

      showStatus(`同步完成 (${nowTime})`);
      const userBadge = document.getElementById('sync-user-status-badge');
      if (userBadge) {
        userBadge.innerText = '🟢 实时同步中';
        userBadge.className = 'sync-user-sync-badge';
      }
      return true;
    } catch (err) {
      if (isUserInitiated) {
        showStatus(`同步提示: ${err.message}`, true);
        const userBadge = document.getElementById('sync-user-status-badge');
        if (userBadge) {
          userBadge.innerText = '🔴 同步失败';
          userBadge.className = 'sync-user-sync-badge err';
        }
      }
      return false;
    }
  };
  window.executeFullSync = executeFullSync;

  // 登录表单回车键快捷登录支持
  const handleLoginSubmit = () => {
    if (btnLogin && !btnLogin.disabled) {
      btnLogin.click();
    }
  };

  usernameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      if (!passwordInput?.value) {
        passwordInput?.focus();
      } else {
        handleLoginSubmit();
      }
    }
  });

  passwordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      handleLoginSubmit();
    }
  });

  // 登录 / 注册按钮点击
  btnLogin?.addEventListener('click', async () => {
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!username) {
      showStatus('请输入用户名', true);
      usernameInput?.focus();
      return;
    }
    if (!password) {
      showStatus('请输入密码', true);
      passwordInput?.focus();
      return;
    }

    const syncKey = 'user_' + encodeURIComponent(username.toLowerCase());
    const userObj = {
      username,
      password,
      syncKey,
      loggedIn: true,
      lastSyncTime: ''
    };

    btnLogin.disabled = true;
    try {
      const ok = await executeFullSync(userObj);
      if (ok) {
        localStorage.setItem(USER_ACCOUNT_STORAGE_KEY, JSON.stringify(userObj));
        if (passwordInput) passwordInput.value = '';
        updateSyncModalView();
      }
    } finally {
      btnLogin.disabled = false;
    }
  });

  // 退出登录按钮点击
  btnLogout?.addEventListener('click', async () => {
    localStorage.removeItem(USER_ACCOUNT_STORAGE_KEY);
    if (window.electronAPI && window.electronAPI.saveCloudSyncConfig) {
      await window.electronAPI.saveCloudSyncConfig({ autoSync: false, loggedIn: false });
    }
    updateSyncModalView();
    showStatus('已退出登录');
  });

  // 右键 Logo 呼出登录与云端同步面板
  if (brandBtn) {
    brandBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSyncModal();
    });
  }

  const closeSync = () => {
    smoothCloseModal(syncModal);
  };

  btnClose?.addEventListener('click', closeSync);
  btnCloseBtn?.addEventListener('click', closeSync);

  syncModal.addEventListener('click', (e) => {
    if (e.target === syncModal) {
      closeSync();
    }
  });

  // 手动同步触发逻辑 (支持同步弹窗中的 "🔄 立即同步" 与收藏夹抽屉中的 "🔄 同步" 按钮)
  const handleManualSync = async (btnEl = null) => {
    const user = getLoggedInUser();
    if (!user) {
      openSyncModal();
      showStatus('请先登录以同步云端数据', true);
      return;
    }
    const originalHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      if (btnEl.id === 'btn-fav-drawer-sync' || btnEl.id === 'btn-route-sync') {
        btnEl.innerText = '同步中';
      } else {
        btnEl.innerText = '同步中...';
      }
    }
    try {
      await executeFullSync(user, true);
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalHtml;
      }
    }
  };
  window.handleManualCloudSync = handleManualSync;

  const btnSyncNow = document.getElementById('btn-sync-now');
  btnSyncNow?.addEventListener('click', () => handleManualSync(btnSyncNow));

  const btnFavDrawerSync = document.getElementById('btn-fav-drawer-sync');
  btnFavDrawerSync?.addEventListener('click', () => handleManualSync(btnFavDrawerSync));

  const btnRouteSync = document.getElementById('btn-route-sync');
  btnRouteSync?.addEventListener('click', () => handleManualSync(btnRouteSync));

  // 页面启动时：如果已记住登录状态，自动执行一次初始全量漫游同步
  const currentUser = getLoggedInUser();
  if (currentUser) {
    setTimeout(() => {
      executeFullSync(currentUser, false);
    }, 1200);
  }
}

function flyToProvince(map, key) {
  const prov = PROVINCES_DATA[key];
  if (!prov) return;
  // 全国总览与各省视角严格遵从全局锁定状态：锁定了50就是50，锁定了60就是60，绝不强制重置锁定
  const targetPitch = isPitchLocked ? map.getPitch() : (key === 'china' ? (map.getPitch() ?? 50) : prov.pitch);
  flyToLocationPrecisely(map, prov.center, {
    centered: true,
    zoom: prov.zoom,
    pitch: targetPitch,
    bearing: 0,
    duration: 1200
  });
  const regionEl = document.getElementById('status-region');
  if (regionEl) {
    if (key === 'china') {
      regionEl.innerText = '区域: 全国';
    } else {
      regionEl.innerText = `区域: ${prov.name}`;
    }
  }
}



// 全国 340+ 地级行政区 (地级市、地区、自治州、盟与直辖市) 高精质心索引表
const CHINA_CITIES = [
  ['北京市', '北京市', 116.40, 39.90], ['天津市', '天津市', 117.20, 39.12], ['上海市', '上海市', 121.47, 31.23], ['重庆市', '重庆市', 106.55, 29.56],
  ['石家庄市', '河北省', 114.51, 38.04], ['唐山市', '河北省', 118.18, 39.63], ['秦皇岛市', '河北省', 119.60, 39.93], ['邯郸市', '河北省', 114.49, 36.61],
  ['邢台市', '河北省', 114.50, 37.07], ['保定市', '河北省', 115.46, 38.87], ['张家口市', '河北省', 114.88, 40.77], ['承德市', '河北省', 117.96, 40.95],
  ['沧州市', '河北省', 116.83, 38.30], ['廊坊市', '河北省', 116.68, 39.53], ['衡水市', '河北省', 115.66, 37.73],
  ['太原市', '山西省', 112.55, 37.87], ['大同市', '山西省', 113.30, 40.08], ['阳泉市', '山西省', 113.58, 37.86], ['长治市', '山西省', 113.12, 36.20],
  ['晋城市', '山西省', 112.85, 35.50], ['朔州市', '山西省', 112.43, 39.33], ['晋中市', '山西省', 112.75, 37.69], ['运城市', '山西省', 111.01, 35.03],
  ['忻州市', '山西省', 112.73, 38.42], ['临汾市', '山西省', 111.52, 36.09], ['吕梁市', '山西省', 111.14, 37.52],
  ['呼和浩特市', '内蒙古自治区', 111.75, 40.84], ['包头市', '内蒙古自治区', 109.84, 40.66], ['乌海市', '内蒙古自治区', 106.82, 39.67], ['赤峰市', '内蒙古自治区', 118.96, 42.28],
  ['通辽市', '内蒙古自治区', 122.26, 43.62], ['鄂尔多斯市', '内蒙古自治区', 109.99, 39.82], ['呼伦贝尔市', '内蒙古自治区', 119.77, 49.21], ['巴彦淖尔市', '内蒙古自治区', 107.42, 40.76],
  ['乌兰察布市', '内蒙古自治区', 113.13, 41.03], ['兴安盟', '内蒙古自治区', 122.07, 46.08], ['锡林郭勒盟', '内蒙古自治区', 116.09, 43.93], ['阿拉善盟', '内蒙古自治区', 105.73, 38.85],
  ['沈阳市', '辽宁省', 123.43, 41.81], ['大连市', '辽宁省', 121.61, 38.91], ['鞍山市', '辽宁省', 122.99, 41.11], ['抚顺市', '辽宁省', 123.96, 41.88],
  ['本溪市', '辽宁省', 123.77, 41.30], ['丹东市', '辽宁省', 124.38, 40.13], ['锦州市', '辽宁省', 121.13, 41.10], ['营口市', '辽宁省', 122.23, 40.67],
  ['阜新市', '辽宁省', 121.67, 42.02], ['辽阳市', '辽宁省', 123.17, 41.27], ['盘锦市', '辽宁省', 122.07, 41.12], ['铁岭市', '辽宁省', 123.84, 42.29],
  ['朝阳市', '辽宁省', 120.45, 41.57], ['葫芦岛市', '辽宁省', 120.84, 40.71],
  ['长春市', '吉林省', 125.32, 43.90], ['吉林市', '吉林省', 126.55, 43.84], ['四平市', '吉林省', 124.37, 43.17], ['辽源市', '吉林省', 125.14, 42.90],
  ['通化市', '吉林省', 125.94, 41.73], ['白山市', '吉林省', 126.42, 41.94], ['松原市', '吉林省', 124.82, 45.14], ['白城市', '吉林省', 122.84, 45.62],
  ['延边朝鲜族自治州', '吉林省', 129.51, 42.90],
  ['哈尔滨市', '黑龙江省', 126.53, 45.80], ['齐齐哈尔市', '黑龙江省', 123.95, 47.35], ['鸡西市', '黑龙江省', 130.97, 45.30], ['鹤岗市', '黑龙江省', 130.28, 47.35],
  ['双鸭山市', '黑龙江省', 131.16, 46.65], ['大庆市', '黑龙江省', 125.10, 46.59], ['伊春市', '黑龙江省', 128.90, 47.73], ['佳木斯市', '黑龙江省', 130.36, 46.81],
  ['七台河市', '黑龙江省', 130.85, 45.77], ['牡丹江市', '黑龙江省', 129.63, 44.58], ['黑河市', '黑龙江省', 127.53, 50.24], ['绥化市', '黑龙江省', 126.99, 46.64],
  ['大兴安岭地区', '黑龙江省', 124.71, 52.34],
  ['南京市', '江苏省', 118.80, 32.06], ['无锡市', '江苏省', 120.31, 31.49], ['徐州市', '江苏省', 117.18, 34.27], ['常州市', '江苏省', 119.97, 31.81],
  ['苏州市', '江苏省', 120.58, 31.30], ['南通市', '江苏省', 120.89, 31.98], ['连云港市', '江苏省', 119.22, 34.60], ['淮安市', '江苏省', 119.02, 33.60],
  ['盐城市', '江苏省', 120.16, 33.35], ['扬州市', '江苏省', 119.41, 32.40], ['镇江市', '江苏省', 119.45, 32.20], ['泰州市', '江苏省', 119.92, 32.46],
  ['宿迁市', '江苏省', 118.28, 33.96],
  ['杭州市', '浙江省', 120.15, 30.28], ['宁波市', '浙江省', 121.55, 29.87], ['温州市', '浙江省', 120.70, 28.00], ['嘉兴市', '浙江省', 120.76, 30.75],
  ['湖州市', '浙江省', 120.09, 30.89], ['绍兴市', '浙江省', 120.58, 30.03], ['金华市', '浙江省', 119.65, 29.08], ['衢州市', '浙江省', 118.87, 28.94],
  ['舟山市', '浙江省', 122.21, 29.99], ['台州市', '浙江省', 121.42, 28.66], ['丽水市', '浙江省', 119.92, 28.47],
  ['合肥市', '安徽省', 117.23, 31.82], ['芜湖市', '安徽省', 118.38, 31.33], ['蚌埠市', '安徽省', 117.39, 32.92], ['淮南市', '安徽省', 117.00, 32.63],
  ['马鞍山市', '安徽省', 118.51, 31.69], ['淮北市', '安徽省', 116.80, 33.96], ['铜陵市', '安徽省', 117.82, 30.93], ['安庆市', '安徽省', 117.06, 30.53],
  ['黄山市', '安徽省', 118.34, 29.71], ['滁州市', '安徽省', 118.32, 32.30], ['阜阳市', '安徽省', 115.82, 32.89], ['宿州市', '安徽省', 116.98, 33.63],
  ['六安市', '安徽省', 116.51, 31.75], ['亳州市', '安徽省', 115.78, 33.85], ['池州市', '安徽省', 117.49, 30.66], ['宣城市', '安徽省', 118.76, 30.95],
  ['福州市', '福建省', 119.30, 26.08], ['厦门市', '福建省', 118.09, 24.48], ['莆田市', '福建省', 119.01, 25.45], ['三明市', '福建省', 117.64, 26.26],
  ['泉州市', '福建省', 118.68, 24.87], ['漳州市', '福建省', 117.65, 24.51], ['南平市', '福建省', 118.18, 26.64], ['龙岩市', '福建省', 117.03, 25.08],
  ['宁德市', '福建省', 119.55, 26.67],
  ['南昌市', '江西省', 115.86, 28.68], ['景德镇市', '江西省', 117.18, 29.27], ['萍乡市', '江西省', 113.85, 27.62], ['九江市', '江西省', 116.00, 29.70],
  ['新余市', '江西省', 114.93, 27.82], ['鹰潭市', '江西省', 117.07, 28.27], ['赣州市', '江西省', 114.93, 25.83], ['吉安市', '江西省', 114.99, 27.11],
  ['宜春市', '江西省', 114.42, 27.81], ['抚州市', '江西省', 116.36, 27.95], ['上饶市', '江西省', 117.94, 28.45],
  ['济南市', '山东省', 117.00, 36.67], ['青岛市', '山东省', 120.38, 36.07], ['淄博市', '山东省', 118.05, 36.81], ['枣庄市', '山东省', 117.32, 34.81],
  ['东营市', '山东省', 118.67, 37.43], ['烟台市', '山东省', 121.45, 37.46], ['潍坊市', '山东省', 119.16, 36.71], ['济宁市', '山东省', 116.59, 35.42],
  ['泰安市', '山东省', 117.09, 36.20], ['威海市', '山东省', 122.12, 37.51], ['日照市', '山东省', 119.53, 35.42], ['临沂市', '山东省', 118.36, 35.10],
  ['德州市', '山东省', 116.36, 37.43], ['聊城市', '山东省', 115.98, 36.46], ['滨州市', '山东省', 117.97, 37.38], ['菏泽市', '山东省', 115.48, 35.23],
  ['郑州市', '河南省', 113.63, 34.75], ['开封市', '河南省', 114.31, 34.80], ['洛阳市', '河南省', 112.45, 34.62], ['平顶山市', '河南省', 113.19, 33.77],
  ['安阳市', '河南省', 114.39, 36.10], ['鹤壁市', '河南省', 114.30, 35.75], ['新乡市', '河南省', 113.93, 35.30], ['焦作市', '河南省', 113.24, 35.22],
  ['濮阳市', '河南省', 115.04, 35.76], ['许昌市', '河南省', 113.85, 34.04], ['漯河市', '河南省', 114.02, 33.58], ['三门峡市', '河南省', 111.20, 34.77],
  ['南阳市', '河南省', 112.53, 32.99], ['商丘市', '河南省', 115.66, 34.41], ['信阳市', '河南省', 114.09, 32.15], ['周口市', '河南省', 114.70, 33.63],
  ['驻马店市', '河南省', 114.02, 32.98], ['济源市', '河南省', 112.60, 35.07],
  ['武汉市', '湖北省', 114.31, 30.59], ['黄石市', '湖北省', 115.04, 30.20], ['十堰市', '湖北省', 110.80, 32.65], ['宜昌市', '湖北省', 111.29, 30.69],
  ['襄阳市', '湖北省', 112.14, 32.04], ['鄂州市', '湖北省', 114.89, 30.39], ['荆门市', '湖北省', 112.20, 31.04], ['孝感市', '湖北省', 113.92, 30.93],
  ['荆州市', '湖北省', 112.24, 30.33], ['黄冈市', '湖北省', 114.87, 30.45], ['咸宁市', '湖北省', 114.33, 29.84], ['随州市', '湖北省', 113.38, 31.69],
  ['恩施土家族苗族自治州', '湖北省', 109.48, 30.27], ['仙桃市', '湖北省', 113.45, 30.36], ['潜江市', '湖北省', 112.90, 30.42], ['天门市', '湖北省', 113.17, 30.66],
  ['神农架林区', '湖北省', 110.68, 31.75],
  ['长沙市', '湖南省', 112.94, 28.23], ['株洲市', '湖南省', 113.13, 27.83], ['湘潭市', '湖南省', 112.94, 27.83], ['衡阳市', '湖南省', 112.57, 26.90],
  ['邵阳市', '湖南省', 111.47, 27.24], ['岳阳市', '湖南省', 113.13, 29.36], ['常德市', '湖南省', 111.69, 29.03], ['张家界市', '湖南省', 110.48, 29.12],
  ['益阳市', '湖南省', 112.36, 28.55], ['郴州市', '湖南省', 113.01, 25.77], ['永州市', '湖南省', 111.61, 26.42], ['怀化市', '湖南省', 110.00, 27.57],
  ['娄底市', '湖南省', 112.00, 27.70], ['湘西土家族苗族自治州', '湖南省', 109.74, 28.31],
  ['广州市', '广东省', 113.26, 23.13], ['深圳市', '广东省', 114.06, 22.54], ['珠海市', '广东省', 113.58, 22.27], ['汕头市', '广东省', 116.68, 23.35],
  ['佛山市', '广东省', 113.12, 23.02], ['韶关市', '广东省', 113.60, 24.81], ['湛江市', '广东省', 110.36, 21.27], ['肇庆市', '广东省', 112.47, 23.05],
  ['江门市', '广东省', 113.08, 22.58], ['茂名市', '广东省', 110.93, 21.66], ['惠州市', '广东省', 114.42, 23.11], ['梅州市', '广东省', 116.12, 24.29],
  ['汕尾市', '广东省', 115.36, 22.79], ['河源市', '广东省', 114.70, 23.74], ['阳江市', '广东省', 111.98, 21.86], ['清远市', '广东省', 113.06, 23.68],
  ['东莞市', '广东省', 113.75, 23.02], ['中山市', '广东省', 113.39, 22.52], ['潮州市', '广东省', 116.62, 23.66], ['揭阳市', '广东省', 116.37, 23.55],
  ['云浮市', '广东省', 112.04, 22.92],
  ['南宁市', '广西壮族自治区', 108.37, 22.82], ['柳州市', '广西壮族自治区', 109.43, 24.33], ['桂林市', '广西壮族自治区', 110.29, 25.27], ['梧州市', '广西壮族自治区', 111.32, 23.48],
  ['北海市', '广西壮族自治区', 109.12, 21.48], ['防城港市', '广西壮族自治区', 108.35, 21.69], ['钦州市', '广西壮族自治区', 108.65, 21.98], ['贵港市', '广西壮族自治区', 109.60, 23.10],
  ['玉林市', '广西壮族自治区', 110.18, 22.64], ['百色市', '广西壮族自治区', 106.62, 23.90], ['贺州市', '广西壮族自治区', 111.57, 24.40], ['河池市', '广西壮族自治区', 108.06, 24.70],
  ['来宾市', '广西壮族自治区', 109.23, 23.73], ['崇左市', '广西壮族自治区', 107.36, 22.38],
  ['海口市', '海南省', 110.33, 20.04], ['三亚市', '海南省', 109.51, 18.25], ['三沙市', '海南省', 112.35, 16.84], ['儋州市', '海南省', 109.58, 19.52],
  ['成都市', '四川省', 104.07, 30.66], ['自贡市', '四川省', 104.78, 29.34], ['攀枝花市', '四川省', 101.72, 26.58], ['泸州市', '四川省', 105.44, 28.87],
  ['德阳市', '四川省', 104.40, 31.13], ['绵阳市', '四川省', 104.74, 31.47], ['广元市', '四川省', 105.84, 32.44], ['遂宁市', '四川省', 105.59, 30.53],
  ['内江市', '四川省', 105.06, 29.58], ['乐山市', '四川省', 103.77, 29.56], ['南充市', '四川省', 106.08, 30.79], ['眉山市', '四川省', 103.85, 30.08],
  ['宜宾市', '四川省', 104.64, 28.75], ['广安市', '四川省', 106.63, 30.46], ['达州市', '四川省', 107.47, 31.21], ['雅安市', '四川省', 103.04, 29.98],
  ['巴中市', '四川省', 106.75, 31.87], ['资阳市', '四川省', 106.63, 30.13], ['阿坝藏族羌族自治州', '四川省', 102.22, 31.90], ['甘孜藏族自治州', '四川省', 101.96, 30.05],
  ['凉山彝族自治州', '四川省', 102.27, 27.88],
  ['贵阳市', '贵州省', 106.63, 26.65], ['六盘水市', '贵州省', 104.83, 26.58], ['遵义市', '贵州省', 106.93, 27.73], ['安顺市', '贵州省', 105.95, 26.25],
  ['毕节市', '贵州省', 105.29, 27.30], ['铜仁市', '贵州省', 109.19, 27.72], ['黔西南布依族苗族自治州', '贵州省', 104.90, 25.09], ['黔东南苗族侗族自治州', '贵州省', 107.98, 26.58],
  ['黔南布依族苗族自治州', '贵州省', 107.52, 26.26],
  ['昆明市', '云南省', 102.83, 24.88], ['曲靖市', '云南省', 103.80, 25.49], ['玉溪市', '云南省', 102.55, 24.35], ['保山市', '云南省', 99.17, 25.12],
  ['昭通市', '云南省', 103.72, 27.34], ['丽江市', '云南省', 100.23, 26.86], ['普洱市', '云南省', 100.98, 22.79], ['临沧市', '云南省', 100.09, 23.89],
  ['楚雄彝族自治州', '云南省', 101.53, 25.03], ['红河哈尼族彝族自治州', '云南省', 103.38, 23.36], ['文山壮族苗族自治州', '云南省', 104.24, 23.37],
  ['西双版纳傣族自治州', '云南省', 100.80, 22.00], ['大理白族自治州', '云南省', 100.23, 25.60], ['德宏傣族景颇族自治州', '云南省', 98.58, 24.43],
  ['怒江傈僳族自治州', '云南省', 98.85, 25.85], ['迪庆藏族自治州', '云南省', 99.71, 27.83],
  ['拉萨市', '西藏自治区', 91.13, 29.65], ['日喀则市', '西藏自治区', 88.88, 29.27], ['昌都市', '西藏自治区', 97.18, 31.14], ['林芝市', '西藏自治区', 94.36, 29.65],
  ['山南市', '西藏自治区', 91.77, 29.24], ['那曲市', '西藏自治区', 92.06, 31.48], ['阿里地区', '西藏自治区', 80.11, 32.50],
  ['西安市', '陕西省', 108.94, 34.34], ['铜川市', '陕西省', 108.95, 34.90], ['宝鸡市', '陕西省', 107.14, 34.37], ['咸阳市', '陕西省', 108.71, 34.33],
  ['渭南市', '陕西省', 109.50, 34.50], ['延安市', '陕西省', 109.49, 36.59], ['汉中市', '陕西省', 107.03, 33.07], ['榆林市', '陕西省', 109.74, 38.29],
  ['安康市', '陕西省', 109.03, 32.69], ['商洛市', '陕西省', 109.94, 33.87],
  ['兰州市', '甘肃省', 103.83, 36.06], ['嘉峪关市', '甘肃省', 98.28, 39.77], ['金昌市', '甘肃省', 102.19, 38.51], ['白银市', '甘肃省', 104.14, 36.55],
  ['天水市', '甘肃省', 105.72, 34.58], ['武威市', '甘肃省', 102.64, 37.93], ['张掖市', '甘肃省', 100.46, 38.93], ['平凉市', '甘肃省', 106.67, 35.54],
  ['酒泉市', '甘肃省', 98.51, 39.74], ['庆阳市', '甘肃省', 107.64, 35.73], ['定西市', '甘肃省', 104.63, 35.58], ['陇南市', '甘肃省', 104.93, 33.39],
  ['临夏回族自治州', '甘肃省', 103.21, 35.60], ['甘南藏族自治州', '甘肃省', 102.91, 34.98],
  ['西宁市', '青海省', 101.78, 36.62], ['海东市', '青海省', 102.10, 36.50], ['海北藏族自治州', '青海省', 100.90, 36.96], ['黄南藏族自治州', '青海省', 102.02, 35.52],
  ['海南藏族自治州', '青海省', 100.62, 36.28], ['果洛藏族自治州', '青海省', 100.24, 34.47], ['玉树藏族自治州', '青海省', 97.01, 33.00], ['海西蒙古族藏族自治州', '青海省', 97.37, 37.37],
  ['银川市', '宁夏回族自治区', 106.23, 38.49], ['石嘴山市', '宁夏回族自治区', 106.38, 39.01], ['吴忠市', '宁夏回族自治区', 106.20, 37.99], ['固原市', '宁夏回族自治区', 106.24, 36.00],
  ['中卫市', '宁夏回族自治区', 105.19, 37.51],
  ['乌鲁木齐市', '新疆维吾尔自治区', 87.62, 43.83], ['克拉玛依市', '新疆维吾尔自治区', 84.87, 45.60], ['吐鲁番市', '新疆维吾尔自治区', 89.19, 42.95], ['哈密市', '新疆维吾尔自治区', 93.52, 42.83],
  ['昌吉回族自治州', '新疆维吾尔自治区', 87.30, 44.01], ['博尔塔拉蒙古自治州', '新疆维吾尔自治区', 82.07, 44.90], ['巴音郭楞蒙古自治州', '新疆维吾尔自治区', 86.15, 41.76],
  ['阿克苏地区', '新疆维吾尔自治区', 80.26, 41.17], ['克孜勒苏柯尔克孜自治州', '新疆维吾尔自治区', 76.17, 39.71], ['喀什地区', '新疆维吾尔自治区', 75.99, 39.47],
  ['和田地区', '新疆维吾尔自治区', 79.92, 37.11], ['伊犁哈萨克自治州', '新疆维吾尔自治区', 81.32, 43.92], ['塔城地区', '新疆维吾尔自治区', 82.98, 46.75],
  ['阿勒泰地区', '新疆维吾尔自治区', 88.14, 47.85], ['石河子市', '新疆维吾尔自治区', 86.04, 44.31],
  ['台北市', '台湾省', 121.57, 25.04], ['新北市', '台湾省', 121.47, 25.01], ['高雄市', '台湾省', 120.31, 22.62], ['台中市', '台湾省', 120.68, 24.15],
  ['台南市', '台湾省', 120.20, 23.00], ['香港特别行政区', '香港特别行政区', 114.17, 22.28], ['澳门特别行政区', '澳门特别行政区', 113.54, 22.20]
];
const CHINA_DIVISIONS = CHINA_CITIES;

// 智能解算当前坐标所属的“市 · 县/区/镇”或完整行政区划
// 专为右键菜单定制：绝不显示“省”（状态栏已显示过），显示“市、县”；空间不够只显示“县”
function resolveLocationInfo(map, lngLat, point, onlyCityCounty = false) {
  if (!map || !lngLat) return onlyCityCounty ? '地点' : '区域: 全国';
  const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 8;
  if (zoom < 4.0) {
    return onlyCityCounty ? '地点' : '区域: 全国';
  }

  const { lng, lat } = lngLat;
  let foundProv = '';
  let foundCity = '';

  // 1. 在全国 350+ 地级行政区中匹配距离最近的中心质心 (严格经纬度几何计算，彻底废除交叠 Bbox 误判)
  let minCityDist = Infinity;
  for (let i = 0; i < CHINA_CITIES.length; i++) {
    const [cName, pName, cLng, cLat] = CHINA_CITIES[i];
    const d = Math.hypot((lng - cLng) * Math.cos(lat * Math.PI / 180), lat - cLat);
    if (d < minCityDist) {
      minCityDist = d;
      foundCity = cName;
      foundProv = pName;
    }
  }

  // 3. 从渲染切片探查微观县/区/旗/镇/地标 (仅右键菜单需要精准县级，状态栏漫游跳过耗时查询)
  let foundCounty = '';
  if (onlyCityCounty && point) {
    try {
      const bbox = [[point.x - 120, point.y - 120], [point.x + 120, point.y + 120]];
      const feats = map.queryRenderedFeatures(bbox, {
        layers: ['osm-places-towns', 'osm-places-villages', 'osm-places-cities', 'osm-outdoor-scenic-pois', 'osm-all-pois']
      });
      if (feats && feats.length > 0) {
        let bestDist = Infinity;
        for (let i = 0; i < feats.length; i++) {
          const f = feats[i];
          const name = f.properties['name:zh'] || f.properties.name_zh || f.properties.name;
          if (!name || name === foundCity || name === foundProv) continue;
          let dist = 100;
          if (f.geometry && f.geometry.type === 'Point') {
            const p = map.project(f.geometry.coordinates);
            dist = Math.hypot(p.x - point.x, p.y - point.y);
          }
          // 优先匹配县、区、旗、市、镇
          const isCounty = /[县市区旗镇乡街道]$/.test(name);
          const weight = isCounty ? dist : dist * 1.8;
          if (weight < bestDist) {
            bestDist = weight;
            foundCounty = name;
          }
        }
      }
    } catch (e) {}
  }

  // 右键快捷菜单与途径点专用模式：绝不显示“省”，精准显示“市、县/区”两级
  if (onlyCityCounty) {
    if (foundCity && foundCounty) {
      if (foundCity.includes(foundCounty) || foundCounty.includes(foundCity)) {
        return foundCounty;
      }
      return `${foundCity} · ${foundCounty}`;
    } else if (foundCounty) {
      return foundCounty;
    } else if (foundCity) {
      return foundCity;
    } else {
      return '地点';
    }
  }

  // 底部状态栏完整模式：区域: 省 · 市 · 县
  if (foundProv) {
    if (foundCity && foundCounty) {
      return `区域: ${foundProv} · ${foundCity} · ${foundCounty}`;
    } else if (foundCity) {
      return `区域: ${foundProv} · ${foundCity}`;
    } else if (foundCounty) {
      return `区域: ${foundProv} · ${foundCounty}`;
    }
    return `区域: ${foundProv}`;
  }

  return '区域: 全国';
}
window.resolveLocationInfo = resolveLocationInfo;

// 获取经由真实客观海拔校准的地表高程 (米)
// MapLibre 的 queryTerrainElevation 默认返回的是经由 3D 渲染夸张系数 (exaggeration) 放大后的 WebGL 空间高程
// 必须除以当前的 exaggeration 系数，才能得到真实准确的物理海拔高度 (消除高程翻倍Bug)
function getRealElevation(map, lngLat) {
  if (!map || typeof map.queryTerrainElevation !== 'function' || !lngLat) return null;
  try {
    const raw = map.queryTerrainElevation(lngLat);
    if (raw === null || raw === undefined || isNaN(raw)) return null;
    const terrain = map.getTerrain ? map.getTerrain() : null;
    const ex = (terrain && terrain.exaggeration) ? terrain.exaggeration : (currentExaggeration || 1.0);
    return raw / (ex || 1.0);
  } catch (e) {
    return null;
  }
}

function setupStatusBar(map) {
  const sCoords = document.getElementById('status-coords');
  const sElevation = document.getElementById('status-elevation');
  const sPitch = document.getElementById('status-pitch');
  const sBearing = document.getElementById('status-bearing');
  const sZoom = document.getElementById('status-zoom');
  const sRegion = document.getElementById('status-region');

  let lastResolveTime = 0;
  let rafPending = false;
  let latestMouseEvt = null;

  let moveRafPending = false;
  let lastPitchVal = -1, lastBearingVal = -1, lastZoomVal = '';

  map.on('mousemove', e => {
    // 拖拽平移或正在飞行时彻底跳过主线程坐标与高程计算，杜绝掉帧
    if (document.body.classList.contains('map-is-dragging') || (map.isMoving && map.isMoving())) return;
    latestMouseEvt = e;
    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
      rafPending = false;
      if (!latestMouseEvt || document.body.classList.contains('map-is-dragging') || (map.isMoving && map.isMoving())) return;
      const ev = latestMouseEvt;
      if (sCoords) sCoords.innerText = `坐标: ${ev.lngLat.lng.toFixed(4)}°E, ${ev.lngLat.lat.toFixed(4)}°N`;

      try {
        const ele = getRealElevation(map, ev.lngLat);
        if (sElevation) {
          if (ele !== null && ele !== undefined) {
            sElevation.innerText = `地表高程: ${Math.round(ele)} m`;
          } else {
            sElevation.innerText = `地表高程: -- m`;
          }
        }
      } catch (err) {}

      // 节流实时反查并更新“省 · 市”
      const now = performance.now();
      if (now - lastResolveTime > 350 && sRegion) {
        lastResolveTime = now;
        sRegion.innerText = resolveLocationInfo(map, ev.lngLat, ev.point);
      }
    });
  });

  map.on('move', () => {
    if (moveRafPending) return;
    moveRafPending = true;
    requestAnimationFrame(() => {
      moveRafPending = false;
      const curPitch = Math.round(map.getPitch());
      const curBearing = Math.round(map.getBearing());
      const curZoom = map.getZoom().toFixed(1);
      if (curPitch !== lastPitchVal && sPitch) { sPitch.innerText = `俯仰: ${curPitch}°`; lastPitchVal = curPitch; }
      if (curBearing !== lastBearingVal && sBearing) { sBearing.innerText = `航向: ${curBearing}°`; lastBearingVal = curBearing; }
      if (curZoom !== lastZoomVal && sZoom) { sZoom.innerText = `层级: ${curZoom}`; lastZoomVal = curZoom; }
    });
  });

  // Count actual map render events instead of running a permanent RAF loop.
  // An idle map now lets browsers and phones sleep instead of waking the main
  // thread 60/120 times a second merely to update a once-per-second label.
  let renderedFrames = 0;
  let fpsSampleStartedAt = performance.now();
  let fpsTimer = null;
  map.on('render', () => { renderedFrames++; });
  const updateFps = () => {
    const now = performance.now();
    const elapsed = Math.max(1, now - fpsSampleStartedAt);
    const fps = document.hidden ? 0 : Math.round((renderedFrames * 1000) / elapsed);
    const el = document.getElementById('status-fps');
    if (el) el.innerText = `${fps} FPS`;
    renderedFrames = 0;
    fpsSampleStartedAt = now;
  };
  const startFpsSampling = () => {
    if (!fpsTimer && !document.hidden) fpsTimer = setInterval(updateFps, 1000);
  };
  const stopFpsSampling = () => {
    if (fpsTimer) clearInterval(fpsTimer);
    fpsTimer = null;
  };
  startFpsSampling();
  document.addEventListener('visibilitychange', () => {
    renderedFrames = 0;
    fpsSampleStartedAt = performance.now();
    if (document.hidden) stopFpsSampling();
    else startFpsSampling();
  });

  if (window.electronAPI && window.electronAPI.onPowerStateChange) {
    window.electronAPI.onPowerStateChange((info) => {
      if (info.mode === 'performance') {
        startFpsSampling();
        if (mapInstance) {
          mapInstance.triggerRepaint();
        }
      } else if (info.mode === 'saving') {
        stopFpsSampling();
      }
    });
  }
}

// =========================================================
// 选点与收藏夹管理系统 (Waypoint & Favorites)
// =========================================================
let savedWaypoints = [];
let savedRoutes = []; // 本地持久化收藏路线列表
let currentPlannedRouteCoords = []; // 当前规划的完整经纬度坐标
let currentRouteMetrics = null; // 当前规划的核心指标 (距离、爬升等)
let renderSavedRoutesListFn = null;
let waypointMarkers = []; // 兼容旧扩展；收藏点现由 MapLibre 原生 GeoJSON 图层渲染。
let customFolders = []; // 用户持久化自定义收藏夹分类
let isPickingPoint = false;
let tempPickedPoint = null;
const FAVORITES_SOURCE_ID = 'outmap-favorites';
const FAVORITE_LAYER_IDS = ['outmap-favorite-hover', 'outmap-favorite-icons', 'outmap-favorite-clusters', 'outmap-favorite-cluster-count'];
let favoriteLayersVisible = true;
let selectedFavoriteFeatureId = null;
let favoriteLayerEventsBound = false;
let favoriteLayerInitPending = false;

// 右下角悬浮面板统一互斥调度管理 (收藏抽屉、新建地标收藏弹窗、路线规划面板互斥关闭，杜绝界面重叠)
function closeConflictingBottomPanels(exceptId = null) {
  if (typeof smoothCloseContextMenu === 'function') smoothCloseContextMenu();
  const panelIds = ['waypoint-modal', 'favorites-drawer', 'route-panel', 'save-route-modal', 'mobile-ele-sheet', 'layers-popover'];
  panelIds.forEach(id => {
    if (id !== exceptId) {
      const el = document.getElementById(id);
      if (el) {
        cancelPendingElementClose(el);
        el.style.display = 'none';
        el.classList.remove('active');
      }
    }
  });
}
if (typeof window !== 'undefined') {
  window.closeConflictingBottomPanels = closeConflictingBottomPanels;
}

// 智能点位分类推断器
function guessWaypointType(name = '', desc = '') {
  const text = (name + ' ' + desc).toLowerCase();
  if (/露营|营地|camp/i.test(text)) return 'camp';
  if (/水|泉|溪|井|water|spring/i.test(text)) return 'water';
  if (/补给|超市|店|加油|supply|gas/i.test(text)) return 'supply';
  if (/停|车|p|parking/i.test(text)) return 'parking';
  if (/宿|酒店|宾馆|客栈|民宿|hotel|inn/i.test(text)) return 'hotel';
  if (/拍照|摄影|影|视|机位|photo/i.test(text)) return 'photo';
  if (/徒步|登山|步道|垭口|峰|山顶|hike|trail|pass/i.test(text)) return 'hiking';
  return 'view';
}

function setupWaypointAndFavoritesSystem(map) {
  const btnFabPoint = document.getElementById('btn-fab-point');
  const btnFabFav = document.getElementById('btn-fab-fav');
  const wpModal = document.getElementById('waypoint-modal');
  const btnCloseWp = document.getElementById('btn-close-waypoint-modal');
  const btnCancelWp = document.getElementById('btn-cancel-waypoint');
  const btnSaveWp = document.getElementById('btn-save-waypoint');
  const wpNameInput = document.getElementById('wp-name');
  const wpCoordsVal = document.getElementById('wp-coords-val');
  const wpEleVal = document.getElementById('wp-ele-val');
  const wpFolderSelect = document.getElementById('wp-folder-select');
  const btnAddFolder = document.getElementById('btn-add-folder');
  const newFolderInline = document.getElementById('new-folder-inline');
  const newFolderInput = document.getElementById('new-folder-input');
  const btnConfirmNewFolder = document.getElementById('btn-confirm-new-folder');
  const btnCancelNewFolder = document.getElementById('btn-cancel-new-folder');

  const favDrawer = document.getElementById('favorites-drawer');
  const btnCloseFav = document.getElementById('btn-close-favorites-drawer');
  const favTabs = document.getElementById('fav-folder-tabs');
  const favList = document.getElementById('fav-items-list');

  // 读取本地持久化收藏夹、自定义分类与收藏路线
  try {
    const raw = localStorage.getItem('outmap_saved_waypoints');
    if (raw) savedWaypoints = JSON.parse(raw);
    const rawFolders = localStorage.getItem('outmap_custom_folders');
    if (rawFolders) customFolders = JSON.parse(rawFolders);
    const rawRoutes = localStorage.getItem('outmap_saved_routes');
    if (rawRoutes) savedRoutes = JSON.parse(rawRoutes);
  } catch (e) {}

  // 刷新收藏夹下拉选择框
  const refreshFolderOptions = (selectedVal) => {
    if (!wpFolderSelect) return;
    wpFolderSelect.innerHTML = `
      <option value="default">⭐ 默认收藏夹</option>
      <option value="camp">⛺ 我的露营地</option>
      <option value="hiking">🥾 徒步穿越点</option>
    `;
    customFolders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.innerText = `📁 ${f.name}`;
      wpFolderSelect.appendChild(opt);
    });
    if (selectedVal) wpFolderSelect.value = selectedVal;
  };
  refreshFolderOptions();

  const favoriteIconMap = {
    view: '🏔️', camp: '🏕️', water: '💧', supply: '⛽',
    parking: '🅿️', hotel: '🏨', photo: '📸', hiking: '🥾'
  };

  const waypointFeature = wp => ({
    type: 'Feature',
    id: String(wp.id),
    geometry: { type: 'Point', coordinates: [Number(wp.lng), Number(wp.lat)] },
    properties: {
      id: String(wp.id),
      name: wp.name || '收藏点',
      type: wp.type || 'view',
      folder: wp.folder || 'default',
      ele: Number(wp.ele) || 0,
      icon: `outmap-fav-${favoriteIconMap[wp.type] ? wp.type : 'view'}`
    }
  });

  const favoriteFeatureCollection = () => ({
    type: 'FeatureCollection',
    features: savedWaypoints
      .filter(wp => wp && wp.id != null && Number.isFinite(Number(wp.lng)) && Number.isFinite(Number(wp.lat)))
      .map(waypointFeature)
  });

  const addFavoriteIcon = (type, emoji) => {
    const id = `outmap-fav-${type}`;
    if (map.hasImage(id)) return;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(32, 32, 27, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();
    ctx.font = '34px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 33);
    map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
  };

  const bindFavoriteLayerEvents = () => {
    if (favoriteLayerEventsBound) return;
    favoriteLayerEventsBound = true;
    let hoveredId = null;
    let longPressTimer = null;

    map.on('mouseenter', 'outmap-favorite-icons', e => {
      map.getCanvas().style.cursor = 'pointer';
      const id = e.features?.[0]?.id;
      if (hoveredId != null && hoveredId !== id) map.setFeatureState({ source: FAVORITES_SOURCE_ID, id: hoveredId }, { hover: false });
      hoveredId = id;
      if (id != null) map.setFeatureState({ source: FAVORITES_SOURCE_ID, id }, { hover: true });
    });
    map.on('mouseleave', 'outmap-favorite-icons', () => {
      map.getCanvas().style.cursor = '';
      if (hoveredId != null) map.setFeatureState({ source: FAVORITES_SOURCE_ID, id: hoveredId }, { hover: false });
      hoveredId = null;
    });
    map.on('click', 'outmap-favorite-clusters', async e => {
      if (isPickingPoint || pickingRoutePt) return;
      const feature = e.features?.[0];
      if (!feature) return;
      const source = map.getSource(FAVORITES_SOURCE_ID);
      try {
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 420, easing: t => 1 - Math.pow(1 - t, 3) });
      } catch (_) {}
    });
    map.on('click', 'outmap-favorite-icons', e => {
      if (isPickingPoint || pickingRoutePt) return;
      const feature = e.features?.[0];
      const wp = feature && savedWaypoints.find(item => String(item.id) === String(feature.id));
      if (!wp) return;
      if (selectedFavoriteFeatureId != null && selectedFavoriteFeatureId !== feature.id) {
        map.setFeatureState({ source: FAVORITES_SOURCE_ID, id: selectedFavoriteFeatureId }, { selected: false });
      }
      selectedFavoriteFeatureId = feature.id;
      map.setFeatureState({ source: FAVORITES_SOURCE_ID, id: feature.id }, { selected: true });
      const center = map.getCenter();
      const isLongFlight = map.getZoom() < 8.5 || Math.hypot(center.lng - wp.lng, center.lat - wp.lat) > 2.5;
      flyToLocationPrecisely(map, [wp.lng, wp.lat], {
        zoom: 14.8,
        pitch: isPitchLocked ? map.getPitch() : Math.min(map.getPitch() ?? 50, 52),
        duration: isLongFlight ? 1100 : 500,
        centered: false,
        elevation: Number.isFinite(Number(wp.ele)) ? Number(wp.ele) * (currentExaggeration || 1) : undefined
      });
    });
    map.on('contextmenu', 'outmap-favorite-icons', e => {
      const feature = e.features?.[0];
      const wp = feature && savedWaypoints.find(item => String(item.id) === String(feature.id));
      if (!wp) return;
      if (e.originalEvent) e.originalEvent._outmapHandled = true;
      e.preventDefault?.();
      window.showChangeWaypointTypeMenu?.(wp, e.originalEvent?.clientX ?? e.point.x, e.originalEvent?.clientY ?? e.point.y);
    });
    map.on('touchstart', 'outmap-favorite-icons', e => {
      clearTimeout(longPressTimer);
      const feature = e.features?.[0];
      const wp = feature && savedWaypoints.find(item => String(item.id) === String(feature.id));
      if (!wp) return;
      const touch = e.originalEvent?.touches?.[0];
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        window.showChangeWaypointTypeMenu?.(wp, touch?.clientX ?? e.point.x, touch?.clientY ?? e.point.y);
      }, 500);
    });
    map.on('touchmove', 'outmap-favorite-icons', () => { clearTimeout(longPressTimer); longPressTimer = null; });
    map.on('touchend', 'outmap-favorite-icons', () => { clearTimeout(longPressTimer); longPressTimer = null; });
  };

  const ensureFavoriteLayers = () => {
    if (!map.__outmapStyleReady) return false;
    Object.entries(favoriteIconMap).forEach(([type, emoji]) => addFavoriteIcon(type, emoji));
    if (!map.getSource(FAVORITES_SOURCE_ID)) {
      map.addSource(FAVORITES_SOURCE_ID, {
        type: 'geojson',
        data: favoriteFeatureCollection(),
        promoteId: 'id',
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 48
      });
      map.addLayer({
        id: 'outmap-favorite-hover', type: 'circle', source: FAVORITES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 22, ['boolean', ['feature-state', 'hover'], false], 20, 0],
          'circle-color': '#38bdf8',
          'circle-opacity': ['case', ['any', ['boolean', ['feature-state', 'selected'], false], ['boolean', ['feature-state', 'hover'], false]], 0.24, 0],
          'circle-blur': 0.25,
          'circle-pitch-alignment': 'viewport'
        }
      });
      map.addLayer({
        id: 'outmap-favorite-icons', type: 'symbol', source: FAVORITES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.72, 12, 0.9, 16, 1.05],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
      map.addLayer({
        id: 'outmap-favorite-clusters', type: 'circle', source: FAVORITES_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#38bdf8', 20, '#0284c7', 100, '#0369a1'],
          'circle-radius': ['step', ['get', 'point_count'], 17, 20, 20, 100, 24],
          'circle-stroke-width': 3,
          'circle-stroke-color': 'rgba(255,255,255,0.94)',
          'circle-pitch-alignment': 'viewport'
        }
      });
      map.addLayer({
        id: 'outmap-favorite-cluster-count', type: 'symbol', source: FAVORITES_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-allow-overlap': true
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(2,132,199,0.4)', 'text-halo-width': 0.5 }
      });
      bindFavoriteLayerEvents();
    }
    FAVORITE_LAYER_IDS.forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', favoriteLayersVisible ? 'visible' : 'none');
    });
    return true;
  };

  const renderWaypointMarkersOnMap = (change = null) => {
    waypointMarkers.forEach(m => m.remove());
    waypointMarkers = [];
    if (!ensureFavoriteLayers()) {
      if (!favoriteLayerInitPending) {
        favoriteLayerInitPending = true;
        map.once('load', () => {
          favoriteLayerInitPending = false;
          renderWaypointMarkersOnMap();
        });
      }
      return;
    }
    favoriteLayerInitPending = false;
    const source = map.getSource(FAVORITES_SOURCE_ID);
    if (!source) return;
    if (change && typeof source.updateData === 'function') {
      try {
        const diff = {};
        if (change.add?.length) diff.add = change.add.map(waypointFeature);
        if (change.remove?.length) diff.remove = change.remove.map(String);
        if (change.update?.length) diff.update = change.update.map(wp => ({
          id: String(wp.id),
          newGeometry: { type: 'Point', coordinates: [Number(wp.lng), Number(wp.lat)] },
          addOrUpdateProperties: waypointFeature(wp).properties
        }));
        source.updateData(diff);
        return;
      } catch (error) {
        console.warn('[Favorites] Incremental update fallback:', error.message);
      }
    }
    source.setData(favoriteFeatureCollection());
  };
  window.renderWaypointMarkersOnMap = renderWaypointMarkersOnMap;

  renderWaypointMarkersOnMap();

  // 点击选点按钮进入/退出选点状态
  if (btnFabPoint) {
    btnFabPoint.addEventListener('click', () => {
      isPickingPoint = !isPickingPoint;
      btnFabPoint.classList.toggle('active', isPickingPoint);
      map.getCanvas().style.cursor = isPickingPoint ? 'var(--cursor-crosshair)' : '';
      if (isPickingPoint) {
        if (wpModal && wpModal.style.display !== 'none') smoothClosePanel(wpModal);
      }
    });
  }

  // 地图点击拾取点
  map.on('click', e => {
    if (!isPickingPoint) return;
    isPickingPoint = false;
    if (btnFabPoint) btnFabPoint.classList.remove('active');
    map.getCanvas().style.cursor = '';

    const { lng, lat } = e.lngLat;
    const ele = Math.round(getRealElevation(map, e.lngLat) || 0);

    tempPickedPoint = { lng, lat, ele };

    if (wpCoordsVal) wpCoordsVal.innerText = `${lng.toFixed(4)}°E, ${lat.toFixed(4)}°N`;
    if (wpEleVal) wpEleVal.innerText = `${ele} m`;
    if (wpNameInput) {
      wpNameInput.value = `标记点 · ${ele}m`;
      wpNameInput.focus();
    }
    closeConflictingBottomPanels('waypoint-modal');
    showElement(wpModal, 'flex');
  });

  // 4类地标类型胶囊单选
  let selectedType = 'view';
  document.querySelectorAll('#wp-type-group .type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#wp-type-group .type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedType = pill.getAttribute('data-type');
    });
  });

  // 保存标记点
  const closeWpModal = () => {
    smoothClosePanel(wpModal, () => {
      if (newFolderInline) newFolderInline.style.display = 'none';
      tempPickedPoint = null;
    });
  };

  // 挂载全局调用：一键为指定坐标和地名打开收藏添加弹窗
  window.openWaypointModalForLocation = (coords, name) => {
    const [lng, lat] = coords;
    const ele = Math.round(getRealElevation(map, { lng, lat }) || 0);
    tempPickedPoint = { lng, lat, ele };
    if (wpCoordsVal) wpCoordsVal.innerText = `${lng.toFixed(4)}°E, ${lat.toFixed(4)}°N`;
    if (wpEleVal) wpEleVal.innerText = `${ele} m`;
    if (wpNameInput) {
      wpNameInput.value = name || `地标 · ${ele}m`;
      wpNameInput.focus();
    }
    closeConflictingBottomPanels('waypoint-modal');
    // 默认选中“观景”
    selectedType = 'view';
    document.querySelectorAll('#wp-type-group .type-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-type') === 'view');
    });
    showElement(wpModal, 'flex');
  };

  btnCloseWp?.addEventListener('click', closeWpModal);
  btnCancelWp?.addEventListener('click', closeWpModal);

  btnSaveWp?.addEventListener('click', () => {
    if (!tempPickedPoint) return;
    const name = (wpNameInput.value || '').trim() || `地标 · ${tempPickedPoint.ele}m`;
    const folder = wpFolderSelect ? wpFolderSelect.value : 'default';

    const newWp = {
      id: 'wp_' + Date.now(),
      name,
      type: selectedType,
      folder,
      lng: tempPickedPoint.lng,
      lat: tempPickedPoint.lat,
      ele: tempPickedPoint.ele,
      time: new Date().toLocaleDateString()
    };

    savedWaypoints.push(newWp);
    try {
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
    } catch (e) {}

    renderWaypointMarkersOnMap({ add: [newWp] });
    closeWpModal();
    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('add_waypoint');
    }
  });

  // 新建收藏夹内联操作 (替代被系统拦截的 prompt)
  btnAddFolder?.addEventListener('click', () => {
    if (newFolderInline) {
      const isVisible = newFolderInline.style.display !== 'none';
      newFolderInline.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && newFolderInput) {
        newFolderInput.value = '';
        newFolderInput.focus();
      }
    }
  });

  const confirmNewFolder = () => {
    if (!newFolderInput) return;
    const name = newFolderInput.value.trim();
    if (!name) return;

    const newFolderObj = {
      id: 'folder_' + Date.now(),
      name: name
    };
    customFolders.push(newFolderObj);
    try {
      localStorage.setItem('outmap_custom_folders', JSON.stringify(customFolders));
    } catch (e) {}

    refreshFolderOptions(newFolderObj.id);
    renderFolderTabs();
    if (newFolderInline) newFolderInline.style.display = 'none';
    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('add_folder');
    }
  };

  btnConfirmNewFolder?.addEventListener('click', confirmNewFolder);
  newFolderInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmNewFolder();
    if (e.key === 'Escape' && newFolderInline) newFolderInline.style.display = 'none';
  });
  btnCancelNewFolder?.addEventListener('click', () => {
    if (newFolderInline) newFolderInline.style.display = 'none';
  });

  // 收藏夹抽屉渲染 (支持【地点】与【路线】双标签页)
  let currentFolderFilter = 'all';
  let currentFavTabMode = 'points'; // 'points' | 'routes'

  const favMainTabs = document.querySelectorAll('#fav-main-type-tabs .fav-main-tab');
  const favPtsContainer = document.getElementById('fav-points-container');
  const favRoutesContainer = document.getElementById('fav-routes-container');
  const favRoutesList = document.getElementById('fav-routes-list');
  const favPtsCount = document.getElementById('fav-pts-count');
  const favRoutesCount = document.getElementById('fav-routes-count');

  // 1. 收藏地点列表渲染
  
  // 右键修改收藏点图标（类型：景点/露营/水源/补给/停车/住宿/摄影/徒步）
  const showChangeWaypointTypeMenu = (wp, x, y) => {
    // 桌面与网页统一采用地图右键菜单同款 Fluent 弹层。地图点仍由
    // MapLibre 原生渲染；交互菜单属于 UI，不应受系统 radio 菜单的
    // 固定留白、深色主题和平台尺寸差异影响。
    document.querySelectorAll('.fav-point-type-menu, .fav-route-context-menu').forEach(m => m.remove());
    smoothCloseContextMenu();
    const menu = document.createElement('div');
    menu.className = 'fluent-context-menu fav-point-type-menu ctx-opening';

    const typeList = [
      { key: 'view', name: '景点', icon: '🏔️' },
      { key: 'camp', name: '露营', icon: '🏕️' },
      { key: 'water', name: '水源', icon: '💧' },
      { key: 'supply', name: '补给', icon: '⛽' },
      { key: 'parking', name: '停车', icon: '🅿️' },
      { key: 'hotel', name: '住宿', icon: '🏨' },
      { key: 'photo', name: '摄影', icon: '📸' },
      { key: 'hiking', name: '徒步', icon: '🥾' }
    ];

    menu.innerHTML = `
      <div class="ctx-header">
        <div class="ctx-title"></div>
        <div class="ctx-sub">更改收藏类型</div>
      </div>
      <div class="ctx-divider"></div>
      ${typeList.map(t => `
        <button class="ctx-item fav-type-menu-item${wp.type === t.key ? ' active' : ''}" data-type="${t.key}">
          <span class="ctx-icon">${t.icon}</span>
          <span class="ctx-text">${t.name}</span>
          <span class="fav-type-check" aria-hidden="true">${wp.type === t.key ? '✓' : ''}</span>
        </button>
      `).join('')}
    `;
    menu.querySelector('.ctx-title').textContent = wp.name || '收藏点';
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    const safeX = Math.max(10, Math.min(Number(x) || 10, window.innerWidth - rect.width - 10));
    const safeY = Math.max(10, Math.min(Number(y) || 10, window.innerHeight - rect.height - 10));
    menu.style.left = `${safeX}px`;
    menu.style.top = `${safeY}px`;

    const closeMenu = () => {
      if (!menu.isConnected || menu.classList.contains('ctx-closing')) return;
      menu.classList.remove('ctx-opening');
      menu.classList.add('ctx-closing');
      setTimeout(() => menu.remove(), 140);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKey);
      map.off('movestart', closeMenu);
    };

    const onDocClick = (e) => {
      if (!menu.contains(e.target)) closeMenu();
    };
    const onDocKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };

    menu.querySelectorAll('.fav-type-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const newType = item.getAttribute('data-type');
        if (newType && newType !== wp.type) {
          wp.type = newType;
          try {
            localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
          } catch (err) {}
          renderWaypointMarkersOnMap({ update: [wp] });
          renderFavoritesList();
          if (typeof window.triggerRealtimeCloudSync === 'function') {
            window.triggerRealtimeCloudSync('update_waypoint_type');
          }
          // 不弹出 toast，图标实时响应立即可见
        }
        closeMenu();
      });
    });

    map.once('movestart', closeMenu);
    setTimeout(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onDocKey);
    }, 10);
  };
  window.showChangeWaypointTypeMenu = showChangeWaypointTypeMenu;

  const renderFavoritesList = () => {
    if (!favList) return;
    favList.innerHTML = '';
    if (favPtsCount) favPtsCount.innerText = savedWaypoints.length;

    let filtered = savedWaypoints;
    if (currentFolderFilter === 'all') {
      filtered = savedWaypoints;
    } else if (currentFolderFilter === 'folders') {
      const customIds = customFolders.map(f => f.id);
      filtered = savedWaypoints.filter(w => customIds.includes(w.folder) || (w.folder && w.folder !== 'default'));
    } else if (currentFolderFilter === 'default') {
      filtered = savedWaypoints.filter(w => !w.folder || w.folder === 'default');
    } else if (currentFolderFilter === 'view') {
      filtered = savedWaypoints.filter(w => w.type === 'view' || w.folder === 'view');
    } else {
      filtered = savedWaypoints.filter(w => w.folder === currentFolderFilter || w.type === currentFolderFilter);
    }

    if (filtered.length === 0) {
      favList.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px 0;">该文件夹下暂无收藏地点<br>可在右下角点击“选点”添加</div>`;
      return;
    }

    filtered.forEach(wp => {
      const item = document.createElement('div');
      item.className = 'fav-item-card';
      item.innerHTML = `
        <div class="fav-item-info">
          <div class="fav-item-name">${wp.name}</div>
          <div class="fav-item-meta">${wp.lng.toFixed(3)}°E, ${wp.lat.toFixed(3)}°N · ${wp.ele}m</div>
        </div>
        <button class="fav-item-del">🗑️</button>
      `;

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showChangeWaypointTypeMenu(wp, e.clientX, e.clientY);
      });

      // 移动端长按 500ms
      let itemTouchTimer = null;
      item.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
          const t = e.touches[0];
          itemTouchTimer = setTimeout(() => {
            itemTouchTimer = null;
            showChangeWaypointTypeMenu(wp, t.clientX, t.clientY);
          }, 500);
        }
      }, { passive: true });
      item.addEventListener('touchmove', () => { if (itemTouchTimer) { clearTimeout(itemTouchTimer); itemTouchTimer = null; } }, { passive: true });
      item.addEventListener('touchend', () => { if (itemTouchTimer) { clearTimeout(itemTouchTimer); itemTouchTimer = null; } }, { passive: true });

      item.querySelector('.fav-item-info').addEventListener('click', () => {
        const startFavoriteFlight = () => {
          const curCenter = map.getCenter();
          const curZoom = map.getZoom();
          const distDeg = Math.hypot((curCenter.lng || 104.5) - wp.lng, (curCenter.lat || 36.0) - wp.lat);
          const isLongFlight = curZoom < 8.5 || distDeg > 2.5;
          const flightDuration = isLongFlight ? 1100 : 500;
          const curPitch = isPitchLocked ? map.getPitch() : Math.min(map.getPitch() ?? 50, 52);
          flyToLocationPrecisely(map, [wp.lng, wp.lat], {
            zoom: 14.8,
            pitch: curPitch,
            duration: flightDuration,
            centered: false,
            elevation: Number.isFinite(Number(wp.ele)) ? Number(wp.ele) * (currentExaggeration || 1) : undefined
          });
        };
        // 手机抽屉会遮挡大半地图；先完成原生式收起，再按稳定的完整
        // viewport 解算一次相机终点，避免抽屉动画中途改变落点。
        if (window.innerWidth <= 768 && favDrawer?.style.display !== 'none') {
          smoothClosePanel(favDrawer, startFavoriteFlight);
        } else {
          startFavoriteFlight();
        }
      });

      item.querySelector('.fav-item-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`确定删除收藏点“${wp.name}”？`)) {
          addDeletedWaypointTombstone(wp);
          savedWaypoints = savedWaypoints.filter(w => w.id !== wp.id);
          try {
            localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
          } catch (err) {}
          renderWaypointMarkersOnMap({ remove: [wp.id] });
          renderFavoritesList();
          if (typeof window.triggerRealtimeCloudSync === 'function') {
            window.triggerRealtimeCloudSync('delete_waypoint');
          }
        }
      });

      favList.appendChild(item);
    });
  };

  // 2. 收藏路线列表渲染
  const renderSavedRoutesList = () => {
    if (!favRoutesList) return;
    favRoutesList.innerHTML = '';
    if (favRoutesCount) favRoutesCount.innerText = savedRoutes.length;

    if (!savedRoutes || savedRoutes.length === 0) {
      favRoutesList.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:30px 10px; font-size:12px; line-height:1.8;">暂无保存的路线<br>在“路线规划”面板中生成路线后<br>点击【💾 存路线】即可永久保存在此</div>`;
      return;
    }

    const modeNames = { drive: '🚗 自驾', cycle: '🚴 骑行', hike: '🥾 徒步' };

    savedRoutes.forEach((route) => {
      const card = document.createElement('div');
      card.className = 'fav-route-card';
      const m = route.metrics || {};
      const distStr = m.distKm ? `${m.distKm.toFixed(1)} km` : '-- km';
      const timeStr = m.timeStr ? `⏱ ${m.timeStr}` : '';
      const climbStr = m.ascent ? `▲ +${m.ascent}m` : '';
      const viaCount = route.viaPoints ? route.viaPoints.length : 0;
      const viaText = viaCount > 0 ? `途经点 ${viaCount}个` : '直达路线';

      card.title = '单击直接载入路线，右键可导出或删除';
      card.innerHTML = `
        <div class="fav-route-header">
          <div class="fav-route-title-box">
            <span class="fav-route-mode-tag">${modeNames[route.mode] || '🛣️ 路线'}</span>
            <span class="fav-route-name">${route.name}</span>
          </div>
          <span class="fav-route-date">${route.createdAt || ''}</span>
        </div>
        <div class="fav-route-stats">
          <span>📏 ${distStr}</span>
          ${timeStr ? `<span>${timeStr}</span>` : ''}
          ${climbStr ? `<span>${climbStr}</span>` : ''}
          <span>📍 ${viaText}</span>
        </div>
      `;

      // 1. 单击默认跳转调出路线
      card.addEventListener('click', () => {
        loadSavedRoute(route.id, map);
      });

      // 2. 右键弹出选项：导出、删除
      const showCardContextMenu = (x, y) => {
        document.querySelectorAll('.fav-route-context-menu').forEach(m => m.remove());
        const menu = document.createElement('div');
        menu.className = 'fav-route-context-menu';

        const menuWidth = 140;
        const menuHeight = 78;
        const posX = Math.min(x, window.innerWidth - menuWidth - 12);
        const posY = Math.min(y, window.innerHeight - menuHeight - 12);
        menu.style.left = `${Math.max(10, posX)}px`;
        menu.style.top = `${Math.max(10, posY)}px`;

        menu.innerHTML = `
          <div class="fav-route-context-item btn-ctx-export">导出路线</div>
          <div class="fav-route-context-item danger btn-ctx-del">删除路线</div>
        `;

        const closeMenu = () => {
          if (menu.classList.contains('closing')) return;
          menu.classList.add('closing');
          setTimeout(() => { menu.remove(); }, 140);
          document.removeEventListener('click', onDocClick);
          document.removeEventListener('keydown', onDocKey);
        };

        const onDocClick = (e) => {
          if (!menu.contains(e.target)) closeMenu();
        };
        const onDocKey = (e) => {
          if (e.key === 'Escape') closeMenu();
        };

        menu.querySelector('.btn-ctx-export').addEventListener('click', (e) => {
          e.stopPropagation();
          closeMenu();
          exportRouteToGpx(route, map);
        });

        menu.querySelector('.btn-ctx-del').addEventListener('click', (e) => {
          e.stopPropagation();
          closeMenu();
          if (confirm(`确定删除收藏路线“${route.name}”？`)) {
            savedRoutes = savedRoutes.filter(r => r.id !== route.id);
            try {
              localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));
            } catch (err) {}
            renderSavedRoutesList();
            if (typeof window.triggerRealtimeCloudSync === 'function') {
              window.triggerRealtimeCloudSync('delete_route');
            }
          }
        });

        document.body.appendChild(menu);
        setTimeout(() => {
          document.addEventListener('click', onDocClick);
          document.addEventListener('keydown', onDocKey);
        }, 10);
      };

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showCardContextMenu(e.clientX, e.clientY);
      });

      // 移动端长按 500ms 触发菜单
      let touchTimer = null;
      card.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
          const t = e.touches[0];
          touchTimer = setTimeout(() => {
            touchTimer = null;
            showCardContextMenu(t.clientX, t.clientY);
          }, 500);
        }
      }, { passive: true });
      card.addEventListener('touchmove', () => {
        if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      }, { passive: true });
      card.addEventListener('touchend', () => {
        if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      }, { passive: true });

      favRoutesList.appendChild(card);
    });
  };
  renderSavedRoutesListFn = renderSavedRoutesList;

  // 顶层 地点/路线 分类切换
  favMainTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      favMainTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFavTabMode = tab.dataset.tab;
      if (currentFavTabMode === 'points') {
        if (favPtsContainer) favPtsContainer.style.display = 'block';
        if (favRoutesContainer) favRoutesContainer.style.display = 'none';
        renderFavoritesList();
      } else {
        if (favPtsContainer) favPtsContainer.style.display = 'none';
        if (favRoutesContainer) favRoutesContainer.style.display = 'block';
        renderSavedRoutesList();
      }
    });
  });

  const renderFolderTabs = () => {
    if (!favTabs) return;
    favTabs.innerHTML = '';
    const tabs = [
      { id: 'all', name: '全部' },
      { id: 'folders', name: '收藏夹' },
      { id: 'default', name: '默认' },
      { id: 'view', name: '景点' }
    ];
    customFolders.forEach(f => {
      const cleanName = (f.name || '').replace(/^(\[导入\]|📁|\s)+/, '');
      tabs.push({ id: f.id, name: cleanName || f.name });
    });

    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'fav-tab' + (t.id === currentFolderFilter ? ' active' : '');
      btn.innerText = t.name;
      btn.addEventListener('click', () => {
        currentFolderFilter = t.id;
        renderFolderTabs();
        renderFavoritesList();
      });
      favTabs.appendChild(btn);
    });
  };

  btnFabFav?.addEventListener('click', () => {
    const isHidden = favDrawer.style.display === 'none';
    if (isHidden) {
      closeConflictingBottomPanels('favorites-drawer');
      showElement(favDrawer, 'flex');
      renderFolderTabs();
      renderFavoritesList();
      renderSavedRoutesList();
    } else {
      smoothClosePanel(favDrawer);
    }
  });

  btnCloseFav?.addEventListener('click', () => {
    smoothClosePanel(favDrawer);
  });

  // 收藏夹抽屉独立点位导入 (支持 GPX / KML / GeoJSON / JSON)
  const btnFavImportPts = document.getElementById('btn-fav-drawer-import-pts');
  const fileInputWp = document.getElementById('waypoint-file-import-input');

  const processImportPointsFile = (fileContent, fileName) => {
    try {
      const parsed = parseTrackFile(fileContent, fileName);
      const waypoints = (parsed && parsed.waypoints && parsed.waypoints.length > 0)
        ? parsed.waypoints
        : [];
      if (waypoints.length === 0) {
        alert('未在文件中发现具体点位数据，请确认文件包含 <wpt>、Point 或地标！');
        return;
      }
      importWaypointsIntoFavorites(waypoints, fileName, map);
    } catch (err) {
      alert(`解析点位失败: ${err.message}`);
    }
  };

  btnFavImportPts?.addEventListener('click', async () => {
    if (currentFavTabMode === 'routes') {
      // 路线规划标签页：导入路线轨迹
      if (window.electronAPI?.openFileDialog) {
        try {
          const res = await window.electronAPI.openFileDialog({
            title: '选择路线轨迹文件',
            filters: [
              { name: '路线轨迹文件 (*.gpx;*.kml;*.geojson;*.json;*.tcx)', extensions: ['gpx', 'kml', 'geojson', 'json', 'tcx'] },
              { name: 'All Files (*.*)', extensions: ['*'] }
            ]
          });
          if (res && res.success && res.content) {
            const trackData = parseTrackFile(res.content, res.filename);
            if (trackData) {
              displayImportedTrack(map, trackData);
              showToast(`已成功导入路线: ${res.filename}`);
            }
          }
        } catch (e) {
          alert(`打开路线文件失败: ${e.message}`);
        }
        return;
      }
      const routeInput = document.getElementById('route-panel-import-input') || fileInputWp;
      if (routeInput) {
        routeInput.value = '';
        routeInput.click();
      }
      return;
    }
    if (window.electronAPI?.openFileDialog) {
      try {
        const res = await window.electronAPI.openFileDialog({
          title: '选择点位数据文件',
          filters: [
            { name: '点位轨迹文件 (*.gpx;*.kml;*.geojson;*.json;*.tcx)', extensions: ['gpx', 'kml', 'geojson', 'json', 'tcx'] },
            { name: 'All Files (*.*)', extensions: ['*'] }
          ]
        });
        if (res && res.success && res.content) {
          processImportPointsFile(res.content, res.filename);
        }
      } catch (e) {
        alert(`打开文件失败: ${e.message}`);
      }
      return;
    }
    if (fileInputWp) {
      fileInputWp.value = '';
      fileInputWp.click();
    }
  });

  fileInputWp?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      processImportPointsFile(text, file.name);
    } catch (err) {
      alert(`读取点位文件失败: ${err.message}`);
    }
  });

  // 全量重载本地/云端同步数据并刷新界面元素
  const reloadFavoritesData = () => {
    try {
      const raw = localStorage.getItem('outmap_saved_waypoints');
      savedWaypoints = raw ? JSON.parse(raw) : [];
      const rawFolders = localStorage.getItem('outmap_custom_folders');
      customFolders = rawFolders ? JSON.parse(rawFolders) : [];
      const rawRoutes = localStorage.getItem('outmap_saved_routes');
      savedRoutes = rawRoutes ? JSON.parse(rawRoutes) : [];
    } catch (e) {}

    renderWaypointMarkersOnMap();
    refreshFolderOptions();
    renderFolderTabs();
    renderFavoritesList();
    renderSavedRoutesList();
  };
  window.reloadFavoritesData = reloadFavoritesData;

  // 批量将具体点位导入到【我的收藏 · 收藏地点】并自适应居中与云同步
function importWaypointsIntoFavorites(waypoints, sourceName, mapInstance) {
  const map = mapInstance || currentOutdoorMap || (typeof mapInstance !== 'undefined' ? mapInstance : null);
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    alert('未能识别到有效的点位数据！');
    return false;
  }

  const cleanSourceName = (sourceName || '导入点位').replace(/\.[^/.]+$/, '');
  const folderName = `[导入] ${cleanSourceName}`;

  // 1. 自动建立专属分类文件夹
  let targetFolder = customFolders.find(f => f && (f.name === folderName || f.id === folderName));
  if (!targetFolder) {
    targetFolder = {
      id: 'folder_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 3),
      name: folderName
    };
    customFolders.push(targetFolder);
    try {
      localStorage.setItem('outmap_custom_folders', JSON.stringify(customFolders));
    } catch (e) {}
  }

  // 2. 批量推入 savedWaypoints 并计算经纬度包围盒
  const now = new Date().toLocaleDateString();
  const bounds = new maplibregl.LngLatBounds();
  let addedCount = 0;

  waypoints.forEach((wp, idx) => {
    const rawCoords = wp.coords || [wp.lng, wp.lat, wp.ele];
    if (!rawCoords || rawCoords.length < 2) return;
    const lng = Number(rawCoords[0]);
    const lat = Number(rawCoords[1]);
    const ele = rawCoords.length >= 3 && Number.isFinite(Number(rawCoords[2]))
      ? Math.round(Number(rawCoords[2]))
      : (Number.isFinite(Number(wp.ele)) ? Math.round(Number(wp.ele)) : 0);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    bounds.extend([lng, lat]);
    const wpType = wp.type || guessWaypointType(wp.name, wp.desc);

    savedWaypoints.push({
      id: 'wp_imp_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4),
      name: wp.name || `点位 ${idx + 1}`,
      type: wpType,
      folder: targetFolder.id,
      lng,
      lat,
      ele,
      time: wp.time || now
    });
    addedCount++;
  });

  if (addedCount === 0) {
    alert('文件中点位坐标无效，未能成功导入！');
    return false;
  }

  // 3. 本地持久化
  try {
    localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
  } catch (e) {}

  // 4. 重绘地图图钉
  renderWaypointMarkersOnMap();

  // 5. 切换到收藏夹抽屉并展示当前文件夹
  const favDrawer = document.getElementById('favorites-drawer');
  if (favDrawer) {
    closeConflictingBottomPanels('favorites-drawer');
    showElement(favDrawer, 'flex');

    const ptsTab = document.querySelector('.fav-main-tab[data-tab="points"]');
    if (ptsTab) ptsTab.click();

    if (typeof refreshFolderOptions === 'function') refreshFolderOptions(targetFolder.id);
    if (typeof renderFolderTabs === 'function') {
      currentFolderFilter = targetFolder.id;
      renderFolderTabs();
    }
    if (typeof renderFavoritesList === 'function') {
      renderFavoritesList();
    }
  }

  // 6. 视角平滑飞跃自适应涵盖所有导入点
  if (map && !bounds.isEmpty()) {
    try {
      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 90, left: 70, right: 70 },
        maxZoom: 15.2,
        duration: 850
      });
    } catch (e) {}
  }

  // 7. 即时双向同步云端
  if (typeof window.triggerRealtimeCloudSync === 'function') {
    window.triggerRealtimeCloudSync('batch_import_waypoints');
  }

  showToast(`✅ 成功导入 ${addedCount} 个点位至【${folderName}】`);
  return true;
}
window.importWaypointsIntoFavorites = importWaypointsIntoFavorites;

  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.startsWith('outmap_saved_') || e.key.startsWith('outmap_custom_')) {
      reloadFavoritesData();
    }
  });
}

// =========================================================
// 户外多途径点路线规划与三维海拔高程剖面系统 (Multi-Waypoint Route Engine)
// =========================================================
let routeStartCoord = null;
let routeStartName = '';
let routeStartMarker = null;
let routeStartZoom = 14.5;

let routeEndCoord = null;
let routeEndName = '';
let routeEndMarker = null;
let routeEndZoom = 14.5;
let routeEndIsFromVia = false; // 标识终点是否由添加途径点顺延接替生成

let routeViaPoints = []; // 存储途径点数组 [{ id, coords, name, marker, zoom }]
let isContinuousPicking = false; // 连续拾点模式开关
let pickingRoutePt = null; // 'start' | 'end' | 'via' | null
let activeRouteMode = 'drive'; // 'drive' | 'cycle' | 'hike'
let profileCursorMarker = null;
let currentProfileData = [];
let routePlanTimer = null;
const ROUTE_POINTS_SOURCE_ID = 'outmap-route-points';
const ROUTE_POINT_LAYER_IDS = ['outmap-route-point-halo', 'outmap-route-point-circles', 'outmap-route-point-labels'];
let routePointLayersVisible = true;
let routePointLayerEventsBound = false;
let activeRouteMapDrag = null;
let routePointLayerInitPending = false;

function scheduleRoutePlan(mapInstance, delayMs = 100) {
  const map = mapInstance || currentOutdoorMap;
  if (!map) return;
  clearTimeout(routePlanTimer);
  routePlanTimer = setTimeout(() => {
    routePlanTimer = null;
    autoPlanMultiPointRoute(map);
  }, delayMs);
}

// 全局有向边拓扑路由缓存池 (Key: profile:lngA,latA->lngB,latB)
const OUTMAP_LEG_CACHE = new Map();
window.OUTMAP_LEG_CACHE = OUTMAP_LEG_CACHE;
const MAX_ROUTE_LEG_CACHE_ENTRIES = 384;
const MAX_ROUTE_LEG_CACHE_VERTICES = 240000;
let routeLegCacheVertices = 0;

function getCachedRouteLeg(key) {
  const value = OUTMAP_LEG_CACHE.get(key);
  if (!value) return null;
  // Refresh insertion order to provide a small, deterministic LRU.
  OUTMAP_LEG_CACHE.delete(key);
  OUTMAP_LEG_CACHE.set(key, value);
  return value;
}

function cacheRouteLeg(key, value) {
  if (!key || !value?.coords?.length) return;
  if (OUTMAP_LEG_CACHE.size === 0) routeLegCacheVertices = 0;
  const previous = OUTMAP_LEG_CACHE.get(key);
  if (previous?.coords?.length) routeLegCacheVertices -= previous.coords.length;
  OUTMAP_LEG_CACHE.delete(key);
  OUTMAP_LEG_CACHE.set(key, value);
  routeLegCacheVertices += value.coords.length;
  while (OUTMAP_LEG_CACHE.size > MAX_ROUTE_LEG_CACHE_ENTRIES || routeLegCacheVertices > MAX_ROUTE_LEG_CACHE_VERTICES) {
    const oldestKey = OUTMAP_LEG_CACHE.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = OUTMAP_LEG_CACHE.get(oldestKey);
    routeLegCacheVertices -= oldest?.coords?.length || 0;
    OUTMAP_LEG_CACHE.delete(oldestKey);
  }
}

function getLegCacheKey(profile, pA, pB) {
  const a0 = typeof pA[0] === 'number' ? pA[0].toFixed(5) : pA[0];
  const a1 = typeof pA[1] === 'number' ? pA[1].toFixed(5) : pA[1];
  const b0 = typeof pB[0] === 'number' ? pB[0].toFixed(5) : pB[0];
  const b1 = typeof pB[1] === 'number' ? pB[1].toFixed(5) : pB[1];
  return `${profile}:${a0},${a1}->${b0},${b1}`;
}

// 计算两坐标之间大圆球面距离 (km)
function calculateDistanceKm(c1, c2) {
  const rad = Math.PI / 180;
  const dLat = (c2[1] - c1[1]) * rad;
  const dLng = (c2[0] - c1[0]) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1[1] * rad) * Math.cos(c2[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let currentOutdoorMap = null;
let draggedViaIndex = null;
let targetViaIndexForPick = null;

// 全局共享路线浮动联想下拉框控制系统 (挂载在 body 顶层，彻底杜绝滚动容器剪切)
let activeFloatingTarget = null; // { inputEl, pointType, viaIndex, mapInstance, triggerMapPick, selectCandidate }
let floatingCandidates = [];
let floatingActiveIndex = -1;
// One document listener for the shared dropdown; re-rendered via inputs can be collected.
document.addEventListener('click', e => {
  const input = activeFloatingTarget?.inputEl;
  const dropdown = getRouteFloatingDropdown();
  if (input && !input.contains(e.target) && !dropdown?.contains(e.target)) hideRouteFloatingDropdown();
});

function getRouteFloatingDropdown() {
  return document.getElementById('route-floating-dropdown');
}

function hideRouteFloatingDropdown() {
  const floatingEl = getRouteFloatingDropdown();
  if (floatingEl) {
    floatingEl.style.display = 'none';
    floatingEl.innerHTML = '';
  }
  activeFloatingTarget = null;
  floatingCandidates = [];
  floatingActiveIndex = -1;
}

function positionRouteFloatingDropdown(inputEl) {
  const floatingEl = getRouteFloatingDropdown();
  if (!floatingEl || !inputEl) return;
  const rect = inputEl.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    hideRouteFloatingDropdown();
    return;
  }
  const viewport = window.visualViewport;
  const viewportTop = viewport ? viewport.offsetTop : 0;
  const viewportLeft = viewport ? viewport.offsetLeft : 0;
  const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  const viewportRight = viewport ? viewport.offsetLeft + viewport.width : window.innerWidth;
  const isMobile = window.innerWidth <= 768;
  const margin = isMobile ? 8 : 10;
  const spaceBelow = Math.max(0, viewportBottom - rect.bottom - margin);
  const spaceAbove = Math.max(0, rect.top - viewportTop - margin);
  const maxW = Math.max(180, viewportRight - viewportLeft - margin * 2);
  const width = Math.min(maxW, Math.max(isMobile ? 240 : 260, rect.width));
  const left = Math.max(viewportLeft + margin, Math.min(viewportRight - width - margin, rect.left));

  floatingEl.style.left = `${left}px`;
  floatingEl.style.width = `${width}px`;

  const placeAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
  const availableHeight = placeAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(44, Math.min(240, Math.floor(availableHeight - 4)));
  floatingEl.style.maxHeight = `${maxHeight}px`;

  if (placeAbove) {
    const contentHeight = Math.min(maxHeight, floatingEl.scrollHeight || maxHeight);
    floatingEl.style.top = `${Math.max(viewportTop + margin, rect.top - contentHeight - 4)}px`;
    floatingEl.style.bottom = 'auto';
  } else {
    floatingEl.style.top = `${Math.min(rect.bottom + 4, viewportBottom - margin - maxHeight)}px`;
    floatingEl.style.bottom = 'auto';
  }
}

// 容器或窗口滚动/调整尺寸时自动重定位浮动下拉框
if (typeof window !== 'undefined') {
  const handleDropdownReposition = () => {
    if (activeFloatingTarget && activeFloatingTarget.inputEl) {
      if (!document.body.contains(activeFloatingTarget.inputEl)) {
        hideRouteFloatingDropdown();
      } else {
        positionRouteFloatingDropdown(activeFloatingTarget.inputEl);
      }
    }
  };
  window.addEventListener('scroll', handleDropdownReposition, true);
  window.addEventListener('resize', handleDropdownReposition);
  window.visualViewport?.addEventListener('resize', handleDropdownReposition);
  window.visualViewport?.addEventListener('scroll', handleDropdownReposition);
}

// 统一绑定起点、终点及途径点输入框的实时搜索、拼音联想与回车直达 (接入全局浮动下拉框)
function bindRoutePointInput(inputEl, dropdownEl, pointType, viaIndex = null, mapInstance = null) {
  if (!inputEl) return;
  const getMap = () => mapInstance || currentOutdoorMap;
  let searchTimer = null;
  let activeQuery = '';
  let requestSequence = 0;

  const triggerMapPick = () => {
    hideRouteFloatingDropdown();
    const map = getMap();
    if (pointType === 'via') {
      targetViaIndexForPick = viaIndex;
      pickingRoutePt = 'via';
    } else {
      pickingRoutePt = pointType;
    }
    if (map) map.getCanvas().style.cursor = 'var(--cursor-crosshair)';
    document.body.classList.add('picking-mode');
  };

  const selectCandidate = (item) => {
    if (!item) return;
    ++requestSequence;
    clearTimeout(searchTimer);
    inputEl.value = item.name;
    hideRouteFloatingDropdown();
    if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
    const map = getMap();
    if (!map) return;

    // 智能层级适配：省份 7.2，地级市 11.5，地标/收藏点/选点 13.5
    let targetZoom = 13.5;
    if (Number.isFinite(item.zoom)) {
      targetZoom = Math.min(18, item.zoom);
    } else if (item.type === 'province') {
      targetZoom = 7.2;
    } else if (item.type === 'city') {
      targetZoom = 11.5;
    } else if (item.type === 'waypoint') {
      targetZoom = 13.5;
    }

    if (pointType === 'start') {
      setRouteStartPoint(map, item.coords, item.name, targetZoom);
    } else if (pointType === 'end') {
      setRouteEndPoint(map, item.coords, item.name, targetZoom);
    } else if (pointType === 'via') {
      if (viaIndex !== null && routeViaPoints[viaIndex]) {
        const via = routeViaPoints[viaIndex];
        via.name = item.name;
        via.coords = item.coords;
        via.zoom = targetZoom;
        via.marker = null;
        renderViaList(map);
        scheduleRoutePlan(map);
        syncRouteMarkersVisualState(map);
      }
    }

    // 起点、终点 setter 已经负责唯一一次飞行；途径点编辑在这里飞行。
    // 过去的无条件第二次 fly 会立即取消第一次，是首个路线点跳动的来源。
    if (item.coords && pointType === 'via') {
      const targetPitch = isPitchLocked ? map.getPitch() : Math.min(map.getPitch() ?? 50, 52);
      flyToLocationPrecisely(map, item.coords, { zoom: targetZoom, pitch: targetPitch, duration: 650 });
    }
  };

  const currentTarget = {
    inputEl,
    pointType,
    viaIndex,
    triggerMapPick,
    selectCandidate
  };

  const renderCandidates = (items, keyword) => {
    const floatingEl = getRouteFloatingDropdown();
    if (!floatingEl) return;
    activeFloatingTarget = currentTarget;
    floatingCandidates = items || [];
    floatingActiveIndex = floatingCandidates.length > 0 ? 0 : -1;
    floatingEl.innerHTML = '';

    if (!items || items.length === 0) {
      floatingEl.innerHTML = `
        <div style="padding: 10px 12px; font-size: 11.5px; color: #64748b; text-align: center;">未找到“${escapeHtml(keyword || '')}”，支持地名/城市/坐标</div>
        <div class="route-floating-item route-floating-pick-map">
          <span class="route-floating-item-icon">📍</span>
          <div class="route-floating-item-info">
            <div class="route-floating-item-name">在 3D 地图上点选</div>
            <div class="route-floating-item-desc">点击后在地图上拾取该点坐标</div>
          </div>
        </div>
      `;
      const pickRow = floatingEl.querySelector('.route-floating-pick-map');
      pickRow?.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerMapPick();
      });
    } else {
      items.forEach((item, idx) => {
        const cleanDesc = (item.desc || '目标地点')
          .replace(/^中国\s*[·,\-–]\s*/, '')
          .replace(/China\s*[·,\-–]\s*/i, '');
        const row = document.createElement('div');
        row.className = 'route-floating-item' + (idx === 0 ? ' active' : '');
        row.dataset.idx = idx;
        row.innerHTML = `
          <span class="route-floating-item-icon">${item.icon || '📍'}</span>
          <div class="route-floating-item-info">
            <div class="route-floating-item-name">${escapeHtml(item.name)}</div>
            <div class="route-floating-item-desc">${escapeHtml(cleanDesc)}</div>
          </div>
        `;
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          selectCandidate(item);
        });
        floatingEl.appendChild(row);
      });

      const mapPickRow = document.createElement('div');
      mapPickRow.className = 'route-floating-item route-floating-pick-map';
      mapPickRow.innerHTML = `
        <span class="route-floating-item-icon">📍</span>
        <div class="route-floating-item-info">
          <div class="route-floating-item-name">在 3D 地图上点选</div>
          <div class="route-floating-item-desc">点击后在地图上拾取精确坐标</div>
        </div>
      `;
      mapPickRow.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerMapPick();
      });
      floatingEl.appendChild(mapPickRow);
    }

    showElement(floatingEl, 'flex');
    positionRouteFloatingDropdown(inputEl);
  };

  inputEl.addEventListener('input', () => {
    const val = (inputEl.value || '').trim();
    clearTimeout(searchTimer);
    activeQuery = val;
    const seq = ++requestSequence;
    if (activeFloatingTarget === currentTarget) hideRouteFloatingDropdown();
    if (!val) {
      hideRouteFloatingDropdown();
      const map = getMap();
      if (pointType === 'start') {
        routeStartCoord = null;
        routeStartName = '';
        if (routeStartMarker) { routeStartMarker.remove(); routeStartMarker = null; }
        if (map) {
          syncRouteMarkersVisualState(map);
          scheduleRoutePlan(map);
        }
      } else if (pointType === 'end') {
        routeEndCoord = null;
        routeEndName = '';
        routeEndIsFromVia = false;
        if (routeEndMarker) { routeEndMarker.remove(); routeEndMarker = null; }
        if (map) {
          syncRouteMarkersVisualState(map);
          renderViaList(map);
          scheduleRoutePlan(map);
        }
      } else if (pointType === 'via' && viaIndex !== null && routeViaPoints[viaIndex]) {
        routeViaPoints[viaIndex].coords = null;
        routeViaPoints[viaIndex].name = '';
        if (routeViaPoints[viaIndex].marker) {
          routeViaPoints[viaIndex].marker.remove();
          routeViaPoints[viaIndex].marker = null;
        }
        if (map) {
          syncRouteMarkersVisualState(map);
          scheduleRoutePlan(map);
        }
      }
      return;
    }
    searchTimer = setTimeout(async () => {
      const results = await queryLocationCandidates(val);
      if (seq !== requestSequence || (inputEl.value || '').trim() !== val) return;
      if (document.activeElement === inputEl && inputEl.isConnected) {
        renderCandidates(results, val);
      }
    }, 150);
  });

  inputEl.addEventListener('keydown', (e) => {
    const floatingEl = getRouteFloatingDropdown();
    const isDropdownOpen = floatingEl && floatingEl.style.display !== 'none' && activeFloatingTarget === currentTarget;

    if (e.key === 'ArrowDown') {
      if (isDropdownOpen && floatingCandidates.length > 0) {
        e.preventDefault();
        floatingActiveIndex = (floatingActiveIndex + 1) % floatingCandidates.length;
        const items = floatingEl.querySelectorAll('.route-floating-item:not(.route-floating-pick-map)');
        items.forEach((it, i) => it.classList.toggle('active', i === floatingActiveIndex));
        if (items[floatingActiveIndex]) {
          items[floatingActiveIndex].scrollIntoView({ block: 'nearest' });
        }
      }
    } else if (e.key === 'ArrowUp') {
      if (isDropdownOpen && floatingCandidates.length > 0) {
        e.preventDefault();
        floatingActiveIndex = (floatingActiveIndex - 1 + floatingCandidates.length) % floatingCandidates.length;
        const items = floatingEl.querySelectorAll('.route-floating-item:not(.route-floating-pick-map)');
        items.forEach((it, i) => it.classList.toggle('active', i === floatingActiveIndex));
        if (items[floatingActiveIndex]) {
          items[floatingActiveIndex].scrollIntoView({ block: 'nearest' });
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isDropdownOpen && floatingCandidates.length > 0) {
        const picked = (floatingActiveIndex >= 0 && floatingActiveIndex < floatingCandidates.length)
          ? floatingCandidates[floatingActiveIndex]
          : floatingCandidates[0];
        selectCandidate(picked);
      } else {
        const val = (inputEl.value || '').trim();
        if (val) {
          clearTimeout(searchTimer);
          const seq = ++requestSequence;
          queryLocationCandidates(val).then(res => {
            if (seq !== requestSequence || !inputEl.isConnected || inputEl.value.trim() !== val) return;
            if (res && res.length > 0) {
              selectCandidate(res[0]);
            } else {
              renderCandidates([], val);
            }
          });
        }
      }
    } else if (e.key === 'Escape') {
      ++requestSequence;
      clearTimeout(searchTimer);
      hideRouteFloatingDropdown();
    }
  });

  inputEl.addEventListener('focus', () => {
    if (typeof window.exitRoutePickingMode === 'function') window.exitRoutePickingMode();
    if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
    if (window.innerWidth <= 768) {
      inputEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      requestAnimationFrame(() => positionRouteFloatingDropdown(inputEl));
    }
    const val = (inputEl.value || '').trim();
    if (val) {
      const seq = ++requestSequence;
      queryLocationCandidates(val).then(res => {
        if (seq === requestSequence && document.activeElement === inputEl && inputEl.isConnected && inputEl.value.trim() === val) {
          renderCandidates(res, val);
        }
      });
    }
  });

  inputEl.addEventListener('blur', () => {
    ++requestSequence;
    clearTimeout(searchTimer);
  });
}

function getRoutePointFeatures() {
  const features = [];
  const add = (id, role, coords, name, label, zoom) => {
    if (!coords || !Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) return;
    features.push({
      type: 'Feature', id,
      geometry: { type: 'Point', coordinates: [Number(coords[0]), Number(coords[1])] },
      properties: { id, role, name: name || label, label, zoom: Number(zoom) || 14.8 }
    });
  };
  add('route-start', 'start', routeStartCoord, routeStartName, '起', routeStartZoom);
  routeViaPoints.forEach((via, index) => add(`route-via-${via.id || index}`, 'via', via.coords, via.name, String(index + 1), via.zoom));
  add('route-end', 'end', routeEndCoord, routeEndName, '终', routeEndZoom);
  return { type: 'FeatureCollection', features };
}

function findRoutePointByFeature(feature) {
  if (!feature) return null;
  const role = feature.properties?.role;
  if (role === 'start') return { role, coords: routeStartCoord, name: routeStartName, zoom: routeStartZoom };
  if (role === 'end') return { role, coords: routeEndCoord, name: routeEndName, zoom: routeEndZoom };
  const rawId = String(feature.id || feature.properties?.id || '').replace(/^route-via-/, '');
  const index = routeViaPoints.findIndex((via, i) => String(via.id || i) === rawId);
  return index >= 0 ? { role: 'via', index, ...routeViaPoints[index] } : null;
}

function ensureRoutePointLayers(map) {
  if (!map || !map.__outmapStyleReady) return false;
  if (!map.getSource(ROUTE_POINTS_SOURCE_ID)) {
    map.addSource(ROUTE_POINTS_SOURCE_ID, { type: 'geojson', data: getRoutePointFeatures(), promoteId: 'id' });
    map.addLayer({
      id: 'outmap-route-point-halo', type: 'circle', source: ROUTE_POINTS_SOURCE_ID,
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'dragging'], false], 21, ['boolean', ['feature-state', 'hover'], false], 19, 0],
        'circle-color': ['match', ['get', 'role'], 'start', '#22c55e', 'end', '#ef4444', '#0284c7'],
        'circle-opacity': ['case', ['any', ['boolean', ['feature-state', 'dragging'], false], ['boolean', ['feature-state', 'hover'], false]], 0.24, 0],
        'circle-blur': 0.22,
        'circle-pitch-alignment': 'viewport'
      }
    });
    map.addLayer({
      id: 'outmap-route-point-circles', type: 'circle', source: ROUTE_POINTS_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 11, 10, 15, ['match', ['get', 'role'], 'via', 12, 13]],
        'circle-color': ['match', ['get', 'role'], 'start', '#16a34a', 'end', '#ef4444', '#0284c7'],
        'circle-opacity': ['case', ['boolean', ['feature-state', 'dragging'], false], 0, 1],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-pitch-alignment': 'viewport',
        'circle-pitch-scale': 'viewport'
      }
    });
    map.addLayer({
      id: 'outmap-route-point-labels', type: 'symbol', source: ROUTE_POINTS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 14, 11],
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': '#ffffff',
        'text-opacity': ['case', ['boolean', ['feature-state', 'dragging'], false], 0, 1],
        'text-halo-color': 'rgba(15,23,42,0.18)',
        'text-halo-width': 0.5
      }
    });
  }
  ROUTE_POINT_LAYER_IDS.forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', routePointLayersVisible ? 'visible' : 'none');
  });
  return true;
}

function bindRoutePointLayerEvents(map) {
  if (!map || routePointLayerEventsBound) return;
  routePointLayerEventsBound = true;
  let hoveredId = null;
  let suppressNextClick = false;

  map.on('mouseenter', 'outmap-route-point-circles', e => {
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features?.[0]?.id;
    if (hoveredId != null && hoveredId !== id) map.setFeatureState({ source: ROUTE_POINTS_SOURCE_ID, id: hoveredId }, { hover: false });
    hoveredId = id;
    if (id != null) map.setFeatureState({ source: ROUTE_POINTS_SOURCE_ID, id }, { hover: true });
  });
  map.on('mouseleave', 'outmap-route-point-circles', () => {
    if (!activeRouteMapDrag) map.getCanvas().style.cursor = '';
    if (hoveredId != null) map.setFeatureState({ source: ROUTE_POINTS_SOURCE_ID, id: hoveredId }, { hover: false });
    hoveredId = null;
  });
  map.on('click', 'outmap-route-point-circles', e => {
    if (suppressNextClick) { suppressNextClick = false; return; }
    const point = findRoutePointByFeature(e.features?.[0]);
    if (!point?.coords) return;
    flyToLocationPrecisely(map, point.coords, { zoom: point.zoom || 14.8, pitch: map.getPitch() ?? 50, duration: 600 });
  });
  map.on('mousedown', 'outmap-route-point-circles', e => {
    if (e.originalEvent?.button !== 0 || pickingRoutePt || isPickingPoint) return;
    const feature = e.features?.[0];
    const point = findRoutePointByFeature(feature);
    if (!feature || !point?.coords) return;
    e.preventDefault?.();
    map.dragPan.disable();
    const el = document.createElement('div');
    el.className = point.role === 'start' ? 'route-start-marker-pin' : point.role === 'end' ? 'route-end-marker-pin' : 'route-via-marker-pin';
    el.innerText = feature.properties?.label || '';
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(point.coords).addTo(map);
    const featureId = feature.id;
    map.setFeatureState({ source: ROUTE_POINTS_SOURCE_ID, id: featureId }, { dragging: true });
    const origin = e.point;
    let moved = false;
    activeRouteMapDrag = { marker, featureId };

    const onMove = moveEvent => {
      if (!activeRouteMapDrag) return;
      if (Math.hypot(moveEvent.point.x - origin.x, moveEvent.point.y - origin.y) > 3) moved = true;
      marker.setLngLat(moveEvent.lngLat);
    };
    const finish = ({ commit = true } = {}) => {
      if (!activeRouteMapDrag || activeRouteMapDrag.marker !== marker) return;
      map.off('mousemove', onMove);
      map.off('mouseup', onMapMouseUp);
      window.removeEventListener('pointerup', onWindowPointerUp, true);
      window.removeEventListener('blur', onWindowBlur);
      const final = marker.getLngLat();
      marker.remove();
      activeRouteMapDrag = null;
      if (map.getSource(ROUTE_POINTS_SOURCE_ID)) {
        map.setFeatureState({ source: ROUTE_POINTS_SOURCE_ID, id: featureId }, { dragging: false });
      }
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
      if (!commit || !moved) return;
      suppressNextClick = true;
      const coords = [final.lng, final.lat];
      if (point.role === 'start') routeStartCoord = coords;
      else if (point.role === 'end') routeEndCoord = coords;
      else if (routeViaPoints[point.index]) routeViaPoints[point.index].coords = coords;
      syncRouteMarkersVisualState(map);
      renderViaList(map);
      scheduleRoutePlan(map, 60);
    };
    const onMapMouseUp = () => finish({ commit: true });
    const onWindowPointerUp = () => finish({ commit: true });
    const onWindowBlur = () => finish({ commit: false });
    map.on('mousemove', onMove);
    map.on('mouseup', onMapMouseUp);
    window.addEventListener('pointerup', onWindowPointerUp, true);
    window.addEventListener('blur', onWindowBlur, { once: true });
  });
}

// 同步更新地图上途径点与起终点的视觉表现；常态完全使用 MapLibre 原生图层。
function syncRouteMarkersVisualState(mapInstance) {
  const m = mapInstance || (typeof currentOutdoorMap !== 'undefined' ? currentOutdoorMap : null);
  if (!m) return;
  if (routeStartMarker) { try { routeStartMarker.remove(); } catch (_) {} routeStartMarker = null; }
  if (routeEndMarker) { try { routeEndMarker.remove(); } catch (_) {} routeEndMarker = null; }
  routeViaPoints.forEach(v => { if (v.marker) { try { v.marker.remove(); } catch (_) {} v.marker = null; } });
  if (!ensureRoutePointLayers(m)) {
    if (!routePointLayerInitPending) {
      routePointLayerInitPending = true;
      m.once('load', () => {
        routePointLayerInitPending = false;
        syncRouteMarkersVisualState(m);
      });
    }
    return;
  }
  routePointLayerInitPending = false;
  bindRoutePointLayerEvents(m);
  m.getSource(ROUTE_POINTS_SOURCE_ID)?.setData(getRoutePointFeatures());
}
window.syncRouteMarkersVisualState = syncRouteMarkersVisualState;

// 全量站点拖拽与顺序调整调度器 (Apple Maps 风格：起、途、终统一拓扑重排)
function reorderRouteStops(fromIndex, toIndex, mapInstance) {
  const m = mapInstance || currentOutdoorMap;
  if (fromIndex === toIndex) return;

  // 1. 统一收集当前所有站点
  const stops = [];
  if (routeStartCoord || routeStartName) {
    stops.push({
      coords: routeStartCoord,
      name: routeStartName,
      zoom: routeStartZoom,
      marker: routeStartMarker
    });
  }
  routeViaPoints.forEach(v => {
    stops.push({
      coords: v.coords,
      name: v.name,
      zoom: v.zoom,
      marker: v.marker,
      id: v.id
    });
  });
  if (routeEndCoord || routeEndName) {
    stops.push({
      coords: routeEndCoord,
      name: routeEndName,
      zoom: routeEndZoom,
      marker: routeEndMarker
    });
  }

  if (fromIndex < 0 || fromIndex >= stops.length || toIndex < 0 || toIndex >= stops.length) return;

  // 2. 数组位移
  const [moved] = stops.splice(fromIndex, 1);
  stops.splice(toIndex, 0, moved);

  // 3. 根据新位置重新赋予角色
  if (stops.length === 1) {
    routeStartCoord = stops[0].coords;
    routeStartName = stops[0].name;
    routeStartZoom = stops[0].zoom || 14.5;
    routeStartMarker = stops[0].marker;
    routeViaPoints = [];
    routeEndCoord = null;
    routeEndName = '';
    routeEndMarker = null;
  } else if (stops.length >= 2) {
    // 首位始终为绿 [起]
    routeStartCoord = stops[0].coords;
    routeStartName = stops[0].name;
    routeStartZoom = stops[0].zoom || 14.5;
    routeStartMarker = stops[0].marker;

    // 末位始终为红 [终]
    const endStop = stops[stops.length - 1];
    routeEndCoord = endStop.coords;
    routeEndName = endStop.name;
    routeEndZoom = endStop.zoom || 14.5;
    routeEndMarker = endStop.marker;

    // 中间项始终为蓝 [1..N-2]
    routeViaPoints = stops.slice(1, -1).map(s => ({
      id: s.id || ('via_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      coords: s.coords,
      name: s.name,
      zoom: s.zoom || 14.5,
      marker: s.marker
    }));
    routeEndIsFromVia = false;
  }

  // 4. 同步更新起终点输入框内容
  const startInput = document.getElementById('route-start-input');
  const endInput = document.getElementById('route-end-input');
  if (startInput) startInput.value = routeStartName || '';
  if (endInput) endInput.value = routeEndName || '';

  // 5. 原生 Marker 增量状态更新 (复用 DOM，0ms 零闪烁)
  if (routeStartMarker && routeStartMarker.getElement()) {
    const el = routeStartMarker.getElement();
    el.style.background = '#16a34a';
    el.innerText = '起';
  }
  if (routeEndMarker && routeEndMarker.getElement()) {
    const el = routeEndMarker.getElement();
    el.style.background = '#ef4444';
    el.innerText = '终';
  }
  routeViaPoints.forEach((v, idx) => {
    if (v.marker && v.marker.getElement()) {
      const el = v.marker.getElement();
      el.style.background = '#0284c7';
      el.innerText = idx + 1;
    }
  });

  // 6. 重新渲染列表与即时规划
  renderViaList(m);
  if (m) scheduleRoutePlan(m);
}
window.reorderRouteStops = reorderRouteStops;

// 物理拖拽引擎与自适应边缘平滑滚屏 (Auto-Scroller)
let routeDragGeneration = 0;
let activeRouteDragSession = null;
function bindStopRowDrag(handleEl, rowEl, fromIndex, mapInstance, onClickFallback) {
  if (!handleEl || !rowEl) return;
  handleEl.style.touchAction = 'none';

  if (handleEl._stopDragHandler) {
    handleEl.removeEventListener('pointerdown', handleEl._stopDragHandler);
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (activeRouteDragSession) {
      activeRouteDragSession.cancel();
      activeRouteDragSession = null;
    }
    if (document.activeElement?.tagName === 'INPUT') document.activeElement.blur();
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const dragGeneration = ++routeDragGeneration;
    const pointerId = e.pointerId;
    let isDragging = false;
    let settled = false;
    let currentIndex = fromIndex;
    let autoScrollRaf = null;
    let pendingRaf = null;
    let latestClientY = startY;

    const scrollBox = document.querySelector('.route-points-box') || document.getElementById('route-panel');
    let scrollBoxRect = null;
    let startScrollTop = scrollBox ? scrollBox.scrollTop : 0;

    const getActiveStopRows = () => {
      const start = document.getElementById('route-start-row');
      const vias = Array.from(document.querySelectorAll('#route-via-list .route-via-item'));
      const end = document.getElementById('route-end-row');
      const rows = [];
      if (start && (routeStartCoord || routeStartName)) rows.push(start);
      vias.forEach(v => rows.push(v));
      if (end && (routeEndCoord || routeEndName)) rows.push(end);
      return rows;
    };

    let allRows = getActiveStopRows();
    if (allRows.length <= 1) {
      if (typeof onClickFallback === 'function') onClickFallback();
      return;
    }

    let itemRects = [];

    try { handleEl.setPointerCapture(pointerId); } catch (err) {}

    const startAutoScroll = () => {
      const stepScroll = () => {
        if (!isDragging) return;
        if (scrollBox && scrollBoxRect) {
          const edgeThreshold = 36;
          const topDist = latestClientY - scrollBoxRect.top;
          const bottomDist = scrollBoxRect.bottom - latestClientY;

          let scrollDelta = 0;
          if (topDist < edgeThreshold) {
            const factor = Math.max(0.2, (edgeThreshold - topDist) / edgeThreshold);
            scrollDelta = -Math.round(factor * 10);
          } else if (bottomDist < edgeThreshold) {
            const factor = Math.max(0.2, (edgeThreshold - bottomDist) / edgeThreshold);
            scrollDelta = Math.round(factor * 10);
          }

          if (scrollDelta !== 0) {
            scrollBox.scrollTop += scrollDelta;
            scheduleUpdate();
          }
        }
        autoScrollRaf = requestAnimationFrame(stepScroll);
      };
      autoScrollRaf = requestAnimationFrame(stepScroll);
    };

    const scheduleUpdate = () => {
      if (pendingRaf) return;
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = null;
        if (!isDragging) return;

        if (dragGeneration !== routeDragGeneration || !rowEl.isConnected) return;
        const currentScroll = scrollBox ? scrollBox.scrollTop : 0;
        const scrollOffset = currentScroll - startScrollTop;
        const rawDeltaY = (latestClientY - startY) + scrollOffset;
        const origin = itemRects[fromIndex];
        if (!origin) return;
        const minDelta = itemRects[0].top - origin.top;
        const maxDelta = itemRects[itemRects.length - 1].top - origin.top;
        const deltaY = Math.max(minDelta, Math.min(maxDelta, rawDeltaY));

        rowEl.style.transform = `translate3d(0, ${deltaY}px, 0)`;

        const draggedCenter = origin.top + origin.height / 2 + deltaY;
        let targetIndex = 0;
        let nearestDistance = Infinity;
        itemRects.forEach((rect, index) => {
          const distance = Math.abs((rect.top + rect.height / 2) - draggedCenter);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            targetIndex = index;
          }
        });

        if (targetIndex !== currentIndex) {
          currentIndex = targetIndex;
        }

        allRows.forEach((r, i) => {
          if (i === fromIndex) return;
          if (fromIndex < currentIndex) {
            if (i > fromIndex && i <= currentIndex) {
              const offset = itemRects[i - 1].top - itemRects[i].top;
              r.style.transform = `translate3d(0, ${offset}px, 0)`;
            } else {
              r.style.transform = 'translate3d(0, 0, 0)';
            }
          } else if (fromIndex > currentIndex) {
            if (i >= currentIndex && i < fromIndex) {
              const offset = itemRects[i + 1].top - itemRects[i].top;
              r.style.transform = `translate3d(0, ${offset}px, 0)`;
            } else {
              r.style.transform = 'translate3d(0, 0, 0)';
            }
          } else {
            r.style.transform = 'translate3d(0, 0, 0)';
          }
        });
      });
    };

    const onPointerMove = (ev) => {
      latestClientY = ev.clientY;
      const rawDelta = ev.clientY - startY;

      if (!isDragging) {
        if (Math.abs(rawDelta) < 5) return;
        isDragging = true;
        scrollBox?.classList.add('is-route-reordering');
        rowEl.classList.add('is-dragging');
        allRows = getActiveStopRows();
        if (fromIndex < 0 || fromIndex >= allRows.length) return;
        scrollBoxRect = scrollBox ? scrollBox.getBoundingClientRect() : null;
        startScrollTop = scrollBox ? scrollBox.scrollTop : 0;
        itemRects = allRows.map(r => r.getBoundingClientRect());

        startAutoScroll();
      }

      scheduleUpdate();
    };

    const cleanup = () => {
      handleEl.removeEventListener('pointermove', onPointerMove);
      handleEl.removeEventListener('pointerup', onPointerUp);
      handleEl.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onWindowBlur);
      try { handleEl.releasePointerCapture(pointerId); } catch (err) {}

      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = null;
      }
      if (pendingRaf) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }

    };

    const resetRows = () => {
      rowEl.classList.remove('is-dragging', 'is-settling');
      scrollBox?.classList.remove('is-route-reordering');
      allRows.forEach(r => {
        r.style.transform = '';
        r.style.transition = '';
      });
    };

    const onPointerUp = (ev) => {
      if (settled || ev.pointerId !== pointerId) return;
      settled = true;
      cleanup();

      if (!isDragging) {
        if (activeRouteDragSession?.generation === dragGeneration) activeRouteDragSession = null;
        if (typeof onClickFallback === 'function') {
          onClickFallback();
        }
        return;
      }

      if (ev.type === 'pointercancel' || dragGeneration !== routeDragGeneration) {
        resetRows();
        if (activeRouteDragSession?.generation === dragGeneration) activeRouteDragSession = null;
        return;
      }

      const finalOffset = (itemRects[currentIndex]?.top || itemRects[fromIndex].top) - itemRects[fromIndex].top;
      rowEl.classList.remove('is-dragging');
      rowEl.classList.add('is-settling');
      rowEl.style.transition = 'transform 0.16s cubic-bezier(0.2, 0, 0, 1)';
      rowEl.style.transform = `translate3d(0, ${finalOffset}px, 0)`;

      setTimeout(() => {
        if (dragGeneration !== routeDragGeneration || !rowEl.isConnected) {
          resetRows();
          return;
        }
        resetRows();
        if (currentIndex !== fromIndex) {
          reorderRouteStops(fromIndex, currentIndex, mapInstance);
        }
        if (activeRouteDragSession?.generation === dragGeneration) activeRouteDragSession = null;
      }, 160);
    };

    const onWindowBlur = () => {
      onPointerUp({ pointerId, type: 'pointercancel' });
    };

    activeRouteDragSession = {
      generation: dragGeneration,
      cancel: () => {
        settled = true;
        cleanup();
        resetRows();
      }
    };

    handleEl.addEventListener('pointermove', onPointerMove);
    handleEl.addEventListener('pointerup', onPointerUp);
    handleEl.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onWindowBlur, { once: true });
  };

  handleEl._stopDragHandler = onPointerDown;
  handleEl.addEventListener('pointerdown', onPointerDown);
}

function bindStartAndEndRowsDrag(mapInstance) {
  const m = mapInstance || currentOutdoorMap;
  const startRow = document.getElementById('route-start-row');
  const endRow = document.getElementById('route-end-row');
  const btnSwapStart = document.getElementById('btn-swap-route-pts');
  const btnSwapEnd = document.getElementById('btn-swap-route-pts-2');

  const getSwapFn = () => (typeof window.swapStartAndEndRoutePoints === 'function' ? window.swapStartAndEndRoutePoints : null);

  const totalStops = (routeStartCoord || routeStartName ? 1 : 0) +
                     routeViaPoints.length +
                     (routeEndCoord || routeEndName ? 1 : 0);

  if (startRow && btnSwapStart && (routeStartCoord || routeStartName)) {
    bindStopRowDrag(btnSwapStart, startRow, 0, m, () => {
      const fn = getSwapFn();
      if (fn) fn();
    });
  } else if (btnSwapStart?._stopDragHandler) {
    btnSwapStart.removeEventListener('pointerdown', btnSwapStart._stopDragHandler);
    btnSwapStart._stopDragHandler = null;
  }
  if (endRow && btnSwapEnd && (routeEndCoord || routeEndName)) {
    const endIdx = totalStops > 0 ? totalStops - 1 : 1;
    bindStopRowDrag(btnSwapEnd, endRow, endIdx, m, () => {
      const fn = getSwapFn();
      if (fn) fn();
    });
  } else if (btnSwapEnd?._stopDragHandler) {
    btnSwapEnd.removeEventListener('pointerdown', btnSwapEnd._stopDragHandler);
    btnSwapEnd._stopDragHandler = null;
  }
}

// 渲染途径点列表 (支持拼音/汉字回车搜索、地图定位、删除以及全站点拖拽排序)
function renderViaList(mapInstance) {
  if (activeRouteDragSession) {
    activeRouteDragSession.cancel();
    activeRouteDragSession = null;
  }
  ++routeDragGeneration;
  const map = mapInstance || currentOutdoorMap;
  const container = document.getElementById('route-via-list');
  if (!container) return;
  container.innerHTML = '';

  routeViaPoints.forEach((via, idx) => {
    const row = document.createElement('div');
    row.className = 'route-via-item';
    row.dataset.index = idx;

    row.innerHTML = `
      <span class="pt-tag via">${idx + 1}</span>
      <div class="route-input-wrap">
        <input type="text" class="route-pt-input via-name-input" placeholder="输入途径点 (支持地名/城市，回车直达)..." autocomplete="off" />
        <div class="route-search-dropdown" style="display: none;"></div>
      </div>
      <button class="btn-via-del">✕</button>
      <div class="btn-drag-handle via-drag-handle">⠿</div>
    `;

    const inputEl = row.querySelector('.via-name-input');
    const dropdownEl = row.querySelector('.route-search-dropdown');
    const delBtn = row.querySelector('.btn-via-del');
    const dragHandle = row.querySelector('.via-drag-handle');
    const tagEl = row.querySelector('.pt-tag');
    if (inputEl) inputEl.value = via.name || '';

    if (tagEl && via.coords) {
      tagEl.style.cursor = 'pointer';
      tagEl.addEventListener('click', () => {
        if (map && via.coords) {
          flyToLocationPrecisely(map, via.coords, { zoom: via.zoom || 14.8, pitch: map.getPitch() ?? 50, duration: 600 });
        }
      });
    }

    bindRoutePointInput(inputEl, dropdownEl, 'via', idx, map);

    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeViaPoint(map, idx);
    });

    const startOffset = (routeStartCoord || routeStartName) ? 1 : 0;
    bindStopRowDrag(dragHandle, row, idx + startOffset, map, null);

    container.appendChild(row);
  });

  bindStartAndEndRowsDrag(map);
  syncRouteMarkersVisualState(map);
}

// 添加途径点并自动刷新规划 (高德 / Apple Maps 递进模式：弱化固定终点，支持在末尾持续追加点)
function addViaPoint(map, coords, label, zoom = null) {
  if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
  const m = map || currentOutdoorMap;
  const targetZoom = Number.isFinite(zoom) ? zoom : 14.8;

  // 1. 若起点尚未设定且传入了有效坐标，直接作为起点建立路线之首
  if (!routeStartCoord && coords) {
    setRouteStartPoint(m, coords, label, targetZoom);
    return;
  }

  // 2. 若已有起点，但尚未设定终点且当前没有途径点，且传入了有效坐标：
  //    此点即为当前二点航段的终点（预览规划时以最后一点为终点）
  if (coords && !routeEndCoord && (!routeViaPoints || routeViaPoints.length === 0)) {
    setRouteEndPoint(m, coords, label, targetZoom, true);
    return;
  }

  // 3. 若已有起终点（或已有有效终点），用户再次添加有效点时（高德 / Apple Maps 顺延递进逻辑）：
  //    弱化终点的固定概念：原终点顺延沉淀为途径点，新添加的有效点接替成为最新终点！
  //    使得路线始终单向向前延伸：起 -> 途1 -> 途2 -> ... -> 最新终点
  if (coords && routeEndCoord) {
    const prevEndCoord = routeEndCoord;
    const prevEndName = routeEndName;
    const prevEndZoom = routeEndZoom;
    const prevEndMarker = routeEndMarker;

    // 将旧终点转为途径点并推入数组
    const viaIdx = routeViaPoints.length + 1;
    if (prevEndMarker && prevEndMarker.getElement()) {
      const el = prevEndMarker.getElement();
      el.classList.remove('route-start-marker-pin', 'route-end-marker-pin');
      el.classList.add('route-via-marker-pin');
      el.style.background = '#0284c7';
      el.innerText = viaIdx;
    }
    routeViaPoints.push({
      id: 'via_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      coords: prevEndCoord,
      name: prevEndName || `途径点 ${viaIdx}`,
      marker: prevEndMarker,
      zoom: prevEndZoom
    });

    routeEndMarker = null; // 旧 marker 已安全移交途径点
    setRouteEndPoint(m, coords, label, targetZoom, true);
    return;
  }

  // 4. 用户点击面板内 "+ 添加途径点"（coords 为 null，待手动输入），或尚无终点时的普通追加
  const idx = routeViaPoints.length + 1;
  const viaName = label || (coords ? `途径点 ${idx} (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)` : '');
  routeViaPoints.push({
    id: 'via_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    coords,
    name: viaName,
    marker: null,
    zoom: targetZoom
  });

  renderViaList(m);
  syncRouteMarkersVisualState(m);
  closeConflictingBottomPanels('route-panel');
  const routePanel = document.getElementById('route-panel');
  showElement(routePanel, 'flex');

  // 自动平滑滚动到底部最新添加的途径点处，彻底免除多途径点时手动滚动翻找
  const pointsBox = document.querySelector('.route-points-box');
  if (pointsBox) {
    requestAnimationFrame(() => {
      pointsBox.scrollTo({ top: pointsBox.scrollHeight, behavior: 'smooth' });
    });
  }

  if (coords && m) {
    scheduleRoutePlan(m);
  }
}

// 移除特定途径点并重新编排序号
function removeViaPoint(map, index) {
  const m = map || currentOutdoorMap;
  if (index >= 0 && index < routeViaPoints.length) {
    if (routeViaPoints[index].marker) {
      routeViaPoints[index].marker.remove();
    }
    routeViaPoints.splice(index, 1);

    renderViaList(m);
    syncRouteMarkersVisualState(m);
    if (m) scheduleRoutePlan(m);
  }
}

// 设置起点
function setRouteStartPoint(map, coords, label, zoom = null, options = {}) {
  if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
  const m = map || currentOutdoorMap;
  routeStartCoord = coords;
  routeStartName = label || `起点 (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)`;
  if (Number.isFinite(zoom)) {
    routeStartZoom = zoom;
  }
  const startInput = document.getElementById('route-start-input');
  const routePanel = document.getElementById('route-panel');
  if (startInput) startInput.value = routeStartName;
  if (routeStartMarker) routeStartMarker.remove();
  routeStartMarker = null;
  closeConflictingBottomPanels('route-panel');
  showElement(routePanel, 'flex');
  bindStartAndEndRowsDrag(m);
  syncRouteMarkersVisualState(m);
  if (m && options.schedule !== false) scheduleRoutePlan(m);
}

// 设置终点
function setRouteEndPoint(map, coords, label, zoom = null, isFromVia = false, options = {}) {
  if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
  const m = map || currentOutdoorMap;

  // 若当前已有作为临时终点的途径点（routeEndIsFromVia 为 true），且本次是外部显式设置真实终点（isFromVia 为 false）：
  // 将先前的临时终点顺延归入途径点列表，使得连续添加途径点后再显式指定终点时，原有途径点不被吞噬！
  if (routeEndCoord && routeEndIsFromVia && !isFromVia) {
    const prevEndCoord = routeEndCoord;
    const prevEndName = routeEndName;
    const prevEndZoom = routeEndZoom;
    const prevEndMarker = routeEndMarker;

    const viaIdx = routeViaPoints.length + 1;
    if (prevEndMarker && prevEndMarker.getElement()) {
      const el = prevEndMarker.getElement();
      el.classList.remove('route-start-marker-pin', 'route-end-marker-pin');
      el.classList.add('route-via-marker-pin');
      el.style.background = '#0284c7';
      el.innerText = viaIdx;
    }
    routeViaPoints.push({
      id: 'via_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      coords: prevEndCoord,
      name: prevEndName || `途径点 ${viaIdx}`,
      marker: prevEndMarker,
      zoom: prevEndZoom
    });
    routeEndMarker = null;
  }

  routeEndIsFromVia = isFromVia;
  routeEndCoord = coords;
  routeEndName = label || `终点 (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)`;
  if (Number.isFinite(zoom)) {
    routeEndZoom = zoom;
  }
  const endInput = document.getElementById('route-end-input');
  const routePanel = document.getElementById('route-panel');
  if (endInput) endInput.value = routeEndName;
  if (routeEndMarker) routeEndMarker.remove();
  routeEndMarker = null;
  renderViaList(m);
  syncRouteMarkersVisualState(m);
  closeConflictingBottomPanels('route-panel');
  showElement(routePanel, 'flex');
  bindStartAndEndRowsDrag(m);
  if (m && options.schedule !== false) scheduleRoutePlan(m);
}

// 核心自动化多途径点规划与海拔剖面解算引擎
let currentRouteRequestId = 0;
let currentRouteAbortController = null;

// Route must sit above every road surface but below road shields/names.
// The former "first symbol" anchor was a water label placed before roads,
// causing later yellow highway layers to paint over the green route.

// Promote actual route state rather than only treating waypoints as endpoints
// inside the calculation. Inputs, markers, export and saved routes then agree.
function promoteMissingRouteEndpoints(mapInstance) {
  const map = mapInstance || currentOutdoorMap;
  let changed = false;
  if (!routeStartCoord) {
    const firstIndex = routeViaPoints.findIndex(v => v && v.coords);
    if (firstIndex >= 0) {
      const first = routeViaPoints.splice(firstIndex, 1)[0];
      if (first.marker) {
        try { first.marker.remove(); } catch (e) {}
      }
      setRouteStartPoint(map, first.coords, first.name || '起点', first.zoom || 14.5, { schedule: false });
      changed = true;
    }
  }
  if (!routeEndCoord) {
    let lastIndex = -1;
    for (let i = routeViaPoints.length - 1; i >= 0; i--) {
      if (routeViaPoints[i] && routeViaPoints[i].coords) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex >= 0) {
      const last = routeViaPoints.splice(lastIndex, 1)[0];
      if (last.marker) {
        try { last.marker.remove(); } catch (e) {}
      }
      setRouteEndPoint(map, last.coords, last.name || '终点', last.zoom || 14.5, true, { schedule: false });
      changed = true;
    }
  }
  if (changed && map) {
    renderViaList(map);
    syncRouteMarkersVisualState(map);
  }
  return changed;
}
window.promoteMissingRouteEndpoints = promoteMissingRouteEndpoints;
window.getRouteState = () => ({
  routeStartCoord,
  routeStartName,
  routeEndCoord,
  routeEndName,
  routeViaPoints: [...(routeViaPoints || [])]
});

function findFirstRoadLabelLayerId(map) {
  try {
    const layers = map.getStyle()?.layers;
    if (!layers) return undefined;
    for (const preferredId of ['osm-road-shields', 'osm-road-names']) {
      if (layers.some(layer => layer.id === preferredId)) return preferredId;
    }
    for (const layer of layers) {
      if (layer.id.startsWith('outdoor-route-') || layer.id.startsWith('imported-track-')) continue;
      if (layer.type === 'symbol' && layer.layout?.['symbol-placement'] === 'line') {
        return layer.id;
      }
    }
  } catch (e) {}
  return undefined;
}

function renderRouteGeometry(map, pathCoords) {
  if (map.getSource('imported-track-source')) {
    map.getSource('imported-track-source').setData({ type: 'FeatureCollection', features: [] });
  }
  const routeGeojson = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: pathCoords
    }
  };

  const beforeLabelId = findFirstRoadLabelLayerId(map);

  if (map.getSource('outdoor-route-source')) {
    map.getSource('outdoor-route-source').setData(routeGeojson);
    if (beforeLabelId) {
      try {
        if (map.getLayer('outdoor-route-casing')) map.moveLayer('outdoor-route-casing', beforeLabelId);
        if (map.getLayer('outdoor-route-line')) map.moveLayer('outdoor-route-line', beforeLabelId);
      } catch (e) {}
    }
  } else {
    map.addSource('outdoor-route-source', {
      type: 'geojson',
      data: routeGeojson,
      tolerance: 0.5,
      buffer: 128
    });

    // 清除历史多余图层 (消除旧版本可能残留的高光细线与半透明发光)
    if (map.getLayer('outdoor-route-inner-core')) map.removeLayer('outdoor-route-inner-core');
    if (map.getLayer('outdoor-route-glow')) map.removeLayer('outdoor-route-glow');

    // High-contrast navigation ribbon above road paint, below road labels.
    map.addLayer({
      id: 'outdoor-route-casing',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#0e4a23',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 7.2, 10, 10.8, 14, 14.4, 17, 17.0],
        'line-opacity': 1.0
      }
    }, beforeLabelId);

    // 2. iOS 原生深绿风格实心路线丝带 (饱和纯正、柔和不刺眼，专为 OLED 屏幕深度优化防过度眩光)
    map.addLayer({
      id: 'outdoor-route-line',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#248a3d',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4.8, 10, 7.6, 14, 10.8, 17, 13.0],
        'line-opacity': 1.0
      }
    }, beforeLabelId);
  }
}

function setRoutePendingVisual(map, isPending) {
  try {
    if (map.getLayer('outdoor-route-casing')) {
      map.setPaintProperty('outdoor-route-casing', 'line-opacity', 1.0);
      map.setPaintProperty('outdoor-route-casing', 'line-dasharray', null);
    }
    if (map.getLayer('outdoor-route-line')) {
      map.setPaintProperty('outdoor-route-line', 'line-opacity', 1.0);
      map.setPaintProperty('outdoor-route-line', 'line-dasharray', null);
    }
  } catch (e) {}
}

// 科学真实高程采样与中国三大阶梯地理基准模型 (彻底剔除脱离实际的 3100m 正弦波假数据)
function sampleRouteElevationData(map, sampledCoords) {
  const n = sampledCoords.length;
  if (n === 0) return [];

  // 1. 尝试从当前已载入 WebGL 显存的 DEM 切片直接采样真实高程
  const rawEle = new Array(n);
  const knownIndices = [];
  for (let i = 0; i < n; i++) {
    const val = getRealElevation(map, sampledCoords[i]);
    if (val !== null && val !== undefined && !isNaN(val)) {
      rawEle[i] = val;
      knownIndices.push(i);
    } else {
      rawEle[i] = null;
    }
  }

  // 2. 中国地理宏观地势三大阶梯科学基准高程模型 (经纬度宏观地形推算)
  const getGeoBaseEle = (lng, lat) => {
    // 第一阶梯：青藏高原、柴达木、藏北、川西高原 (西藏/青海/川西)
    if (lng < 103 && lat >= 27 && lat <= 38) return 3800;
    // 新疆盆地与天山
    if (lng < 95) return (lat > 42 && lng > 86 && lng < 90) ? 150 : 1100;
    // 第二阶梯：云贵高原
    if (lng >= 98 && lng <= 106 && lat >= 22 && lat < 28) return 1600;
    // 第二阶梯：黄土高原 / 内蒙古高原 (陕西、山西、宁夏、内蒙)
    if (lng >= 106 && lng <= 114 && lat >= 34 && lat <= 42) return 1050;
    // 第二阶梯：四川盆地 (平缓丘陵低地)
    if (lng >= 103 && lng <= 108 && lat >= 28 && lat <= 32) return 450;
    // 第三阶梯：平原与低丘
    if (lng >= 114) {
      if (lat >= 30 && lat <= 41) return 40; // 华北与长江中下游平原
      if (lat > 41) return 160; // 东北平原
      return 120; // 东南丘陵
    }
    return 500;
  };

  // 3. 混合插值与地势连续解算
  const finalEle = new Array(n);

  if (knownIndices.length === n) {
    // 全部点均具备真实 DEM 高程 (100% 精确)
    for (let i = 0; i < n; i++) finalEle[i] = rawEle[i];
  } else if (knownIndices.length > 0) {
    // 部分点具备真实 DEM (例如起终点或视口内路段)：在线段已知锚点之间按距离线性平滑过渡
    const dists = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      dists[i] = dists[i - 1] + calculateDistanceKm(sampledCoords[i - 1], sampledCoords[i]);
    }

    // 填充第一个已知点之前的点
    const firstKnown = knownIndices[0];
    const firstEle = rawEle[firstKnown];
    const startGeo = getGeoBaseEle(sampledCoords[0][0], sampledCoords[0][1]);
    for (let i = 0; i < firstKnown; i++) {
      const ratio = dists[firstKnown] > 0 ? (dists[i] / dists[firstKnown]) : 0;
      finalEle[i] = startGeo + ratio * (firstEle - startGeo);
    }
    finalEle[firstKnown] = firstEle;

    // 填充已知点之间的点 (在已知真实高程之间按真实里程线性插值)
    for (let k = 0; k < knownIndices.length - 1; k++) {
      const idxA = knownIndices[k];
      const idxB = knownIndices[k + 1];
      const eleA = rawEle[idxA];
      const eleB = rawEle[idxB];
      finalEle[idxA] = eleA;
      finalEle[idxB] = eleB;
      const spanDist = dists[idxB] - dists[idxA];
      for (let i = idxA + 1; i < idxB; i++) {
        const ratio = spanDist > 0 ? (dists[i] - dists[idxA]) / spanDist : 0;
        finalEle[i] = eleA + ratio * (eleB - eleA);
      }
    }

    // 填充最后一个已知点之后的点
    const lastKnown = knownIndices[knownIndices.length - 1];
    const lastEle = rawEle[lastKnown];
    const endGeo = getGeoBaseEle(sampledCoords[n - 1][0], sampledCoords[n - 1][1]);
    const remDist = dists[n - 1] - dists[lastKnown];
    for (let i = lastKnown + 1; i < n; i++) {
      const ratio = remDist > 0 ? (dists[i] - dists[lastKnown]) / remDist : 1;
      finalEle[i] = lastEle + ratio * (endGeo - lastEle);
    }
  } else {
    // 尚未载入任何视口切片：根据路线途经地理坐标宏观模型平滑解算 (杜绝假山峰)
    for (let i = 0; i < n; i++) {
      finalEle[i] = getGeoBaseEle(sampledCoords[i][0], sampledCoords[i][1]);
    }
  }

  return finalEle;
}

function updateProfileAndMetrics(map, pathCoords, roadDistanceKm, roadDurationSec, isRealRoad, shouldFitBounds) {
  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const distEl = document.getElementById('stat-route-dist');
  const timeEl = document.getElementById('stat-route-time');
  const ascentEl = document.getElementById('stat-route-ascent');
  const descentEl = document.getElementById('stat-route-descent');
  const maxEleEl = document.getElementById('stat-route-maxele');
  const minEleEl = document.getElementById('stat-route-minele');
  const canvas = document.getElementById('elevation-chart-canvas');

  const sampleStep = Math.max(1, Math.floor(pathCoords.length / 280));
  const sampledCoords = [];
  for (let i = 0; i < pathCoords.length; i += sampleStep) {
    sampledCoords.push(pathCoords[i]);
  }
  if (sampledCoords[sampledCoords.length - 1] !== pathCoords[pathCoords.length - 1]) {
    sampledCoords.push(pathCoords[pathCoords.length - 1]);
  }

  let totalDistKm = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let maxEle = -9999;
  let minEle = 99999;
  currentProfileData = [];

  const elevations = sampleRouteElevationData(map, sampledCoords);

  for (let i = 0; i < sampledCoords.length; i++) {
    const pt = sampledCoords[i];
    const ele = Math.round(elevations[i] !== undefined ? elevations[i] : 0);

    if (i > 0) {
      const prev = sampledCoords[i - 1];
      const d = calculateDistanceKm(prev, pt);
      totalDistKm += d;

      const prevEle = currentProfileData[i - 1].ele;
      const diff = ele - prevEle;
      if (diff > 0) totalAscent += diff;
      else totalDescent += Math.abs(diff);
    }

    if (ele > maxEle) maxEle = ele;
    if (ele < minEle) minEle = ele;

    currentProfileData.push({ distKm: totalDistKm, ele, coord: pt });
  }

  if (roadDistanceKm && roadDistanceKm > 0) {
    totalDistKm = roadDistanceKm;
  }

  const formatHours = hrs => hrs < 1
    ? `${Math.max(1, Math.round(hrs * 60))}分钟`
    : `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
  let timeStr = '';
  // Dedicated car/bike/foot routers already return mode-specific travel time.
  // Prefer that over a single generic speed whenever every chunk matched roads.
  if (isRealRoad && roadDurationSec && roadDurationSec > 0) {
    timeStr = formatHours(roadDurationSec / 3600);
  } else if (activeRouteMode === 'drive') {
      const hrs = totalDistKm / 48;
      timeStr = formatHours(hrs);
  } else if (activeRouteMode === 'cycle') {
    // 真实户外骑行规律：平地基准 ~18 km/h，叠加海拔爬升 (每 600m 爬升增加 1 小时)
    const hrs = (totalDistKm / 18) + (totalAscent / 600);
    timeStr = formatHours(hrs);
  } else {
    // 国际标准 Naismith 户外徒步法则：平地基准 ~4.5 km/h，每 450m 爬升增加 1 小时
    const hrs = (totalDistKm / 4.5) + (totalAscent / 450);
    timeStr = formatHours(hrs);
  }

  if (distEl) distEl.innerText = `${totalDistKm.toFixed(1)} km${isRealRoad ? '' : ' (导引)'}`;
  if (timeEl) timeEl.innerText = timeStr;
  if (ascentEl) ascentEl.innerText = `+${Math.round(totalAscent)} m`;
  if (descentEl) descentEl.innerText = `-${Math.round(totalDescent)} m`;
  if (maxEleEl) maxEleEl.innerText = `${maxEle} m`;
  if (minEleEl) minEleEl.innerText = `${minEle} m`;

  currentPlannedRouteCoords = pathCoords;
  currentRouteMetrics = {
    totalDistKm,
    timeStr,
    totalAscent,
    totalDescent,
    maxEle,
    minEle,
    isRealRoad,
    durationSec: roadDurationSec
  };

  // 海拔剖面图默认隐藏 (桌面与浏览器端均遵循，点击详情内海拔信息时才滑出)
  if (chartSection && chartSection.style.display !== 'none') {
    drawElevationChart(canvas, currentProfileData);
  }

  if (shouldFitBounds && pathCoords.length > 0) {
    const bounds = pathCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(pathCoords[0], pathCoords[0]));
    let bPadding = 90;
    let tPadding = 80;
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      const routePanel = document.getElementById('route-panel');
      if (routePanel && routePanel.style.display !== 'none') {
        const panelH = routePanel.getBoundingClientRect().height;
        bPadding = Math.max(90, Math.round(panelH) + 24);
      }
      tPadding = 60;
    }
    map.fitBounds(bounds, {
      padding: { top: tPadding, bottom: bPadding, left: 36, right: 36 },
      pitch: Math.min(map.getPitch() ?? 50, 52),
      duration: 1400
    });
  }
}

async function autoPlanMultiPointRoute(mapInstance, shouldFitBounds = false) {
  const map = mapInstance || currentOutdoorMap;
  if (!map) return;
  promoteMissingRouteEndpoints(map);
  clearTimeout(routePlanTimer);
  routePlanTimer = null;
  const reqId = ++currentRouteRequestId;
  currentRouteAbortController?.abort();
  const routeController = new AbortController();
  currentRouteAbortController = routeController;
  const ordered = [];
  const validVias = routeViaPoints.filter(v => v && v.coords);

  if (routeStartCoord) ordered.push({ coords: routeStartCoord, role: 'start', name: routeStartName });

  if (routeEndCoord) {
    validVias.forEach((v, i) => {
      ordered.push({ coords: v.coords, role: 'via', name: v.name, index: i + 1 });
    });
    ordered.push({ coords: routeEndCoord, role: 'end', name: routeEndName });
  }

  syncRouteMarkersVisualState(map);

  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const distEl = document.getElementById('stat-route-dist');

  // 若有效节点少于 2 个，清空高亮轨迹和剖面
  if (ordered.length < 2) {
    currentRouteAbortController?.abort();
    currentRouteAbortController = null;
    if (map.getSource('outdoor-route-source')) {
      map.getSource('outdoor-route-source').setData({ type: 'FeatureCollection', features: [] });
    }
    if (map.getSource('imported-track-source')) {
      map.getSource('imported-track-source').setData({ type: 'FeatureCollection', features: [] });
    }
    importedTrackMarkers.forEach(m => {
      try { m.remove(); } catch (e) {}
    });
    importedTrackMarkers = [];
    if (statsBox) statsBox.style.display = 'none';
    if (chartSection) chartSection.style.display = 'none';
    const btnDetails = document.getElementById('btn-route-details-toggle');
    if (btnDetails) btnDetails.innerText = '详情 ▾';
    currentProfileData = [];
    currentPlannedRouteCoords = [];
    currentRouteMetrics = null;
    return;
  }

  const profile = activeRouteMode === 'cycle' ? 'bike' : (activeRouteMode === 'hike' ? 'foot' : 'driving');

  const getGeodesicSegment = (pA, pB) => {
    const distKm = calculateDistanceKm(pA, pB);
    const steps = Math.max(5, Math.min(30, Math.round(distKm / 0.5)));
    const seg = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      seg.push([pA[0] + (pB[0] - pA[0]) * t, pA[1] + (pB[1] - pA[1]) * t]);
    }
    const fallbackSpeedKmh = profile === 'bike' ? 18 : (profile === 'foot' ? 4.5 : 48);
    return { coords: seg, distKm, durationSec: (distKm / fallbackSpeedKmh) * 3600, isRoad: false };
  };

  const limitGeometryPoints = coords => {
    if (!Array.isArray(coords)) return [];
    const maxPoints = window.innerWidth <= 768 ? 6000 : 12000;
    if (coords.length <= maxPoints) return coords;
    const step = Math.ceil((coords.length - 1) / (maxPoints - 1));
    const reduced = [];
    for (let i = 0; i < coords.length - 1; i += step) reduced.push(coords[i]);
    reduced.push(coords[coords.length - 1]);
    return reduced;
  };

  // 检查已有拓扑边缓存池 (Directed Leg Cache)
  const cachedLegs = [];
  for (let s = 0; s < ordered.length - 1; s++) {
    const pA = ordered[s].coords;
    const pB = ordered[s + 1].coords;
    const legKey = getLegCacheKey(profile, pA, pB);
    const hit = getCachedRouteLeg(legKey);
    if (hit && hit.isRoad && hit.coords && hit.coords.length > 0) {
      cachedLegs.push(hit);
    } else {
      cachedLegs.push(null);
    }
  }

  // 1. 【即时乐观渲染机制 (0ms 零等待)】
  // 已有缓存分段保持真实路网高亮，仅新增/未完成段显示平滑导引线，彻底杜绝闪烁与假死
  const initialPathCoords = [];
  for (let s = 0; s < ordered.length - 1; s++) {
    const pA = ordered[s].coords;
    const pB = ordered[s + 1].coords;
    const hit = cachedLegs[s];
    const segCoords = (hit && hit.coords && hit.coords.length > 0)
      ? hit.coords
      : getGeodesicSegment(pA, pB).coords;

    if (s === 0 || initialPathCoords.length === 0) {
      initialPathCoords.push(...segCoords);
    } else {
      const lastPt = initialPathCoords[initialPathCoords.length - 1];
      const firstPt = segCoords[0];
      if (Math.abs(lastPt[0] - firstPt[0]) < 1e-5 && Math.abs(lastPt[1] - firstPt[1]) < 1e-5) {
        initialPathCoords.push(...segCoords.slice(1));
      } else {
        initialPathCoords.push(...segCoords);
      }
    }
  }
  if (initialPathCoords.length === 0 && ordered.length >= 2) {
    initialPathCoords.push(ordered[0].coords, ordered[ordered.length - 1].coords);
  }

  // 若全部有向边均已命中缓存，0ms 极速直出，完全免除网络开销！
  if (cachedLegs.length > 0 && cachedLegs.every(Boolean)) {
    const finalCoords = limitGeometryPoints(initialPathCoords);
    const totalDistKm = cachedLegs.reduce((sum, leg) => sum + (leg.distKm || 0), 0);
    const totalDurationSec = cachedLegs.reduce((sum, leg) => sum + (leg.durationSec || 0), 0);
    renderRouteGeometry(map, finalCoords);
    setRoutePendingVisual(map, false);
    updateProfileAndMetrics(map, finalCoords, totalDistKm, totalDurationSec, true, shouldFitBounds);
    if (distEl) {
      distEl.innerText = distEl.innerText.replace(' (路网匹配中...)', '').replace(' (导引)', '');
    }
    return;
  }

  // 瞬间上图并展现即时导引指标
  renderRouteGeometry(map, limitGeometryPoints(initialPathCoords));
  setRoutePendingVisual(map, true);
  // Pending feedback stays lightweight: do not synchronously sample up to 280
  // terrain points twice for every edit. Final road geometry owns the profile.
  let pendingDistanceKm = 0;
  for (let i = 1; i < initialPathCoords.length; i++) {
    pendingDistanceKm += calculateDistanceKm(initialPathCoords[i - 1], initialPathCoords[i]);
  }
  currentPlannedRouteCoords = [];
  currentRouteMetrics = null;
  if (distEl) {
    distEl.innerText = `${pendingDistanceKm.toFixed(1)} km (路网匹配中...)`;
  }

  // 2. 【智能差量拓扑分段解算引擎】
  // 仅计算新增与变动的有向边；已有分段 100% 保持稳定，杜绝由于新加点而连累已有公路
  (async () => {
    try {
      const fetchWithTimeout = async (url, timeoutMs) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        routeController.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, timeoutMs);
        try {
          return await fetch(url, { signal: controller.signal, cache: 'no-cache' });
        } finally {
          clearTimeout(timer);
          routeController.signal.removeEventListener('abort', abort);
        }
      };

      const fetchSingleRouteAttempt = async (points) => {
        const coordStr = points.map(p => `${p.coords[0].toFixed(5)},${p.coords[1].toFixed(5)}`).join(';');
        const localRouteUrl = `http://127.0.0.1:${localServerPort}/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`;
        const routedService = profile === 'bike' ? 'routed-bike' : (profile === 'foot' ? 'routed-foot' : 'routed-car');
        const primaryOnlineUrl = `https://routing.openstreetmap.de/${routedService}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
        const backupOnlineUrl = profile === 'driving'
          ? `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`
          : null;

        let resp = null;
        if (window.electronAPI) {
          try {
            // The local proxy owns persistent caching and mirror failover. Do
            // not repeat its upstream requests in the renderer on failure.
            resp = await fetchWithTimeout(localRouteUrl, 17500);
            if (resp && resp.ok) {
              const data = await resp.json();
              if (data.code === 'Ok' && data.routes && data.routes[0] && (data.routes[0].distance > 0 || points.length <= 1)) {
                return {
                  coords: limitGeometryPoints(data.routes[0].geometry.coordinates),
                  distKm: data.routes[0].distance / 1000,
                  durationSec: data.routes[0].duration,
                  isRoad: data.source !== 'local-engine'
                };
              }
            }
          } catch (e) {
            return null;
          }
          return null;
        }

        // Web uses direct services. The public backup is car-only and must
        // never be used for cycling/hiking, otherwise geometry and ETA become
        // silently contaminated across profile-specific caches.
        const mirrors = [primaryOnlineUrl, backupOnlineUrl].filter(Boolean);
        for (const mirrorUrl of mirrors) {
          if (routeController.signal.aborted) return null;
          try {
            const mResp = await fetchWithTimeout(mirrorUrl, 7000);
            if (mResp && mResp.ok) {
              const data = await mResp.json();
              if (data.code === 'Ok' && data.routes && data.routes[0] && (data.routes[0].distance > 0 || points.length <= 1)) {
                return {
                  coords: limitGeometryPoints(data.routes[0].geometry.coordinates),
                  distKm: data.routes[0].distance / 1000,
                  durationSec: data.routes[0].duration,
                  isRoad: true
                };
              }
            }
          } catch (e) {}
        }

        return null;
      };

      const fetchSubRoute = async (subPoints) => {
        // 单段或多段优先尝试整段连贯路网匹配解算
        if (subPoints.length === 2) {
          const key = getLegCacheKey(profile, subPoints[0].coords, subPoints[1].coords);
          const cached = getCachedRouteLeg(key);
          if (cached && cached.isRoad) return cached;
        }

        const chunkResult = await fetchSingleRouteAttempt(subPoints);
        if (routeController.signal.aborted || reqId !== currentRouteRequestId) return null;
        if (chunkResult && chunkResult.isRoad) {
          if (subPoints.length === 2) {
            const key = getLegCacheKey(profile, subPoints[0].coords, subPoints[1].coords);
            cacheRouteLeg(key, chunkResult);
          }
          return chunkResult;
        }

        if (routeController.signal.aborted) return null;

        // 若多点批次中有个别无路网点(NoRoute)或超时，自动降级拆解为单步逐段(Leg-by-Leg)独立解算
        // 确保仅真正不可达的荒野单段显示直线，其余所有可通行的路网区间 100% 保持真实道路轨迹！
        if (subPoints.length > 2) {
          const legResults = [];
          for (let i = 0; i < subPoints.length - 1; i++) {
            if (routeController.signal.aborted) return null;
            const legPts = [subPoints[i], subPoints[i + 1]];
            const legKey = getLegCacheKey(profile, legPts[0].coords, legPts[1].coords);
            let legResult = getCachedRouteLeg(legKey);
            if (!legResult || !legResult.isRoad) {
              legResult = await fetchSingleRouteAttempt(legPts);
              if (routeController.signal.aborted || reqId !== currentRouteRequestId) return null;
              if (legResult && legResult.isRoad) {
                cacheRouteLeg(legKey, legResult);
              }
            }
            if (legResult && legResult.isRoad) {
              legResults.push(legResult);
            } else {
              const g = getGeodesicSegment(subPoints[i].coords, subPoints[i + 1].coords);
              legResults.push({
                coords: g.coords,
                distKm: g.distKm,
                durationSec: g.durationSec,
                isRoad: false
              });
            }
          }

          const legMergedCoords = [];
          let legMergedDist = 0;
          let legMergedDuration = 0;
          let everyLegIsRoad = legResults.length > 0;

          legResults.forEach((lr, lIdx) => {
            if (!lr.isRoad) everyLegIsRoad = false;
            legMergedDist += lr.distKm || 0;
            legMergedDuration += lr.durationSec || 0;
            if (lIdx === 0 || legMergedCoords.length === 0) {
              legMergedCoords.push(...lr.coords);
            } else {
              const lastPt = legMergedCoords[legMergedCoords.length - 1];
              const firstPt = lr.coords[0];
              const dLng = Math.abs(lastPt[0] - firstPt[0]);
              const dLat = Math.abs(lastPt[1] - firstPt[1]);
              if (dLng < 1e-5 && dLat < 1e-5) {
                legMergedCoords.push(...lr.coords.slice(1));
              } else {
                legMergedCoords.push(...lr.coords);
              }
            }
          });

          return {
            coords: limitGeometryPoints(legMergedCoords),
            distKm: legMergedDist,
            durationSec: legMergedDuration,
            isRoad: everyLegIsRoad
          };
        }

        // 离线/荒野单段兜底：大地测量连续折线导引
        const fallbackCoords = [];
        let fallbackDist = 0;
        for (let i = 0; i < subPoints.length - 1; i++) {
          const g = getGeodesicSegment(subPoints[i].coords, subPoints[i + 1].coords);
          if (i === 0) {
            fallbackCoords.push(...g.coords);
          } else {
            fallbackCoords.push(...g.coords.slice(1));
          }
          fallbackDist += g.distKm;
        }
        return {
          coords: fallbackCoords,
          distKm: fallbackDist,
          durationSec: (fallbackDist / (profile === 'bike' ? 18 : (profile === 'foot' ? 4.5 : 48))) * 3600,
          isRoad: false
        };
      };

      // 智能分段调度：已缓存的有向边 0ms 直接读取，未命中的连续脏区间切分为每批至多 8 个点进行网络解算
      const workItems = [];
      let wIdx = 0;
      const CHUNK_SIZE = 7;
      while (wIdx < ordered.length - 1) {
        if (cachedLegs[wIdx]) {
          workItems.push({
            type: 'cached',
            legIndex: wIdx,
            points: [ordered[wIdx], ordered[wIdx + 1]],
            result: cachedLegs[wIdx]
          });
          wIdx++;
        } else {
          const spanStart = wIdx;
          while (wIdx < ordered.length - 1 && !cachedLegs[wIdx]) {
            wIdx++;
          }
          const spanEnd = wIdx;
          const spanLegCount = spanEnd - spanStart;
          if (spanLegCount <= CHUNK_SIZE) {
            // 交互式添加/编辑 (<= 7 段)：按单段独立解算并存入有向边缓存池，实现后续操作 0ms 极速复用！
            for (let k = spanStart; k < spanEnd; k++) {
              workItems.push({
                type: 'chunk',
                points: [ordered[k], ordered[k + 1]],
                startIdx: k,
                endIdx: k + 1,
                result: null
              });
            }
          } else {
            // 大批量规划 (如 62 点测试)：切分为每批至多 8 个点，满足高吞吐批次计算
            for (let c = spanStart; c < spanEnd; c += CHUNK_SIZE) {
              const cEnd = Math.min(spanEnd, c + CHUNK_SIZE);
              workItems.push({
                type: 'chunk',
                points: ordered.slice(c, cEnd + 1),
                startIdx: c,
                endIdx: cEnd,
                result: null
              });
            }
          }
        }
      }

      const chunkItems = workItems.filter(item => item.type === 'chunk');
      let nextChunk = 0;
      const worker = async () => {
        while (!routeController.signal.aborted) {
          const cIdx = nextChunk++;
          if (cIdx >= chunkItems.length) return;
          const item = chunkItems[cIdx];
          item.result = await fetchSubRoute(item.points);
          if (routeController.signal.aborted || reqId !== currentRouteRequestId) return;
          if (item.points.length === 2 && item.result && item.result.isRoad) {
            const key = getLegCacheKey(profile, item.points[0].coords, item.points[1].coords);
            cacheRouteLeg(key, item.result);
          }
        }
      };
      const maxWorkers = window.innerWidth <= 768 ? 2 : 2;
      await Promise.all(Array.from({ length: Math.min(maxWorkers, chunkItems.length) }, worker));
      if (reqId !== currentRouteRequestId) return;

      const mergedCoords = [];
      let mergedDistKm = 0;
      let mergedDurationSec = 0;
      const isEntireRouteRoad = workItems.length > 0 && workItems.every(item => item.result?.isRoad);

      workItems.forEach((item, rIdx) => {
        const res = item.result;
        if (!res || !res.coords || res.coords.length === 0) return;
        mergedDistKm += res.distKm || 0;
        mergedDurationSec += res.durationSec || 0;

        if (rIdx === 0 || mergedCoords.length === 0) {
          mergedCoords.push(...res.coords);
        } else {
          const lastPt = mergedCoords[mergedCoords.length - 1];
          const firstPt = res.coords[0];
          const dLng = Math.abs(lastPt[0] - firstPt[0]);
          const dLat = Math.abs(lastPt[1] - firstPt[1]);
          if (dLng < 1e-5 && dLat < 1e-5) {
            mergedCoords.push(...res.coords.slice(1));
          } else {
            mergedCoords.push(...res.coords);
          }
        }
      });

      if (mergedCoords.length > 0) {
        const finalCoords = limitGeometryPoints(mergedCoords);
        renderRouteGeometry(map, finalCoords);
        setRoutePendingVisual(map, false);
        updateProfileAndMetrics(map, finalCoords, mergedDistKm, mergedDurationSec, isEntireRouteRoad, shouldFitBounds);
      }
    } catch (e) {
      if (reqId === currentRouteRequestId && distEl) {
        distEl.innerText = distEl.innerText.replace(' (路网匹配中...)', ' (导引)');
      }
    } finally {
      if (reqId === currentRouteRequestId && distEl) {
        distEl.innerText = distEl.innerText.replace(' (路网匹配中...)', '');
      }
      if (reqId === currentRouteRequestId && currentRouteAbortController === routeController) {
        currentRouteAbortController = null;
      }
    }
  })();
}

function setupOutdoorRouteSystem(map) {
  const btnFabRoute = document.getElementById('btn-fab-route');
  const routePanel = document.getElementById('route-panel');
  const btnCloseRoute = document.getElementById('btn-close-route-panel');
  const startInput = document.getElementById('route-start-input');
  const endInput = document.getElementById('route-end-input');
  const startDropdown = document.getElementById('route-start-dropdown');
  const endDropdown = document.getElementById('route-end-dropdown');
  const btnAddViaPoint = document.getElementById('btn-add-via-point');
  const btnContinuousPick = document.getElementById('btn-continuous-pick');
  const btnCalcRoute = document.getElementById('btn-calc-route');
  const btnClearRoute = document.getElementById('btn-clear-route');

  // 操作按钮：规划、导入、导出、收藏、详情 ▾、清空
  const btnRouteImportTrigger = document.getElementById('btn-route-import-trigger');
  const routePanelImportInput = document.getElementById('route-panel-import-input');
  const btnExportGpx = document.getElementById('btn-export-gpx');
  const btnSaveRoute = document.getElementById('btn-save-route') || document.getElementById('btn-save-route-trigger');
  const btnSaveRouteTrigger = document.getElementById('btn-save-route-trigger') || btnSaveRoute;
  const btnRouteDetailsToggle = document.getElementById('btn-route-details-toggle');
  const routeExportMenu = document.getElementById('route-export-menu');

  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const canvas = document.getElementById('elevation-chart-canvas');
  const chartHoverInfo = document.getElementById('chart-hover-info');

  btnFabRoute?.addEventListener('click', () => {
    const isHidden = routePanel.style.display === 'none' || routePanel.classList.contains('panel-closing');
    if (isHidden) {
      closeConflictingBottomPanels('route-panel');
      showElement(routePanel, 'flex');
      if (typeof window.clearLandingMarker === 'function') {
        window.clearLandingMarker();
      }
    } else {
      hideRouteFloatingDropdown();
      smoothClosePanel(routePanel);
    }
  });

  startInput?.addEventListener('focus', () => {
    if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
  });
  endInput?.addEventListener('focus', () => {
    if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
  });
  btnCalcRoute?.addEventListener('click', () => {
    if (typeof window.clearLandingMarker === 'function') window.clearLandingMarker();
  });

  btnCloseRoute?.addEventListener('click', () => {
    hideRouteFloatingDropdown();
    smoothClosePanel(routePanel, () => {
      if (startDropdown) startDropdown.style.display = 'none';
      if (endDropdown) endDropdown.style.display = 'none';
      if (routeExportMenu) routeExportMenu.style.display = 'none';
    });
  });

  // 出行方式切换 (自驾、骑行、徒步)
  document.querySelectorAll('.route-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.route-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRouteMode = btn.getAttribute('data-mode');
      autoPlanMultiPointRoute(map);
    });
  });

  currentOutdoorMap = map;

  // 起终点标签点击快速平滑定位 (14.8 黄金居中视级)
  const staticStartTag = document.querySelector('.route-point-row .pt-tag.start');
  if (staticStartTag) {
    staticStartTag.style.cursor = 'pointer';
    staticStartTag.addEventListener('click', () => {
      if (routeStartCoord && map) {
        flyToLocationPrecisely(map, routeStartCoord, { zoom: routeStartZoom || 14.8, pitch: map.getPitch() ?? 50, duration: 600 });
      }
    });
  }

  const staticEndTag = document.querySelector('.route-point-row .pt-tag.end');
  if (staticEndTag) {
    staticEndTag.style.cursor = 'pointer';
    staticEndTag.addEventListener('click', () => {
      if (routeEndCoord && map) {
        flyToLocationPrecisely(map, routeEndCoord, { zoom: routeEndZoom || 14.8, pitch: map.getPitch() ?? 50, duration: 600 });
      } else if (routeViaPoints.length > 0 && map) {
        const lastVia = routeViaPoints[routeViaPoints.length - 1];
        if (lastVia.coords) {
          flyToLocationPrecisely(map, lastVia.coords, { zoom: lastVia.zoom || 14.8, pitch: map.getPitch() ?? 50, duration: 600 });
        }
      }
    });
  }

  // 高德地图风格：途径点列表与终点之间的内联加号添加框与地图选点按钮
  const btnAddViaInline = document.getElementById('btn-add-via-inline');
  const btnPickViaInline = document.getElementById('btn-pick-via-inline');

  const handleAddVia = () => {
    addViaPoint(map, null, '');
    const container = document.getElementById('route-via-list');
    if (container) {
      const lastInput = container.querySelector('.route-via-item:last-child .via-name-input');
      if (lastInput) {
        lastInput.focus();
      }
    }
  };

  const exitRoutePickingMode = () => {
    pickingRoutePt = null;
    targetViaIndexForPick = null;
    document.body.classList.remove('picking-mode');
    map.getCanvas().style.cursor = '';
    btnPickViaInline?.classList.remove('picking');
    if (btnPickViaInline) {
      btnPickViaInline.innerHTML = '<span class="pick-icon">📍</span><span class="pick-text">地图选点</span>';
    }
    if (btnAddViaPoint) btnAddViaPoint.innerHTML = '<span>➕ 添加途径点</span>';
  };
  window.exitRoutePickingMode = exitRoutePickingMode;

  const triggerInlineMapPick = () => {
    hideRouteFloatingDropdown();
    // 如果已经在连续选点状态，再次点击按钮即“完成选点”
    if (pickingRoutePt === 'via' && targetViaIndexForPick === null) {
      exitRoutePickingMode();
      return;
    }
    pickingRoutePt = 'via';
    targetViaIndexForPick = null;
    document.body.classList.add('picking-mode');
    map.getCanvas().style.cursor = 'var(--cursor-crosshair)';
    btnPickViaInline?.classList.add('picking');
    if (btnPickViaInline) {
      const totalCount = (routeStartCoord ? 1 : 0) + routeViaPoints.length + (routeEndCoord ? 1 : 0);
      const countText = totalCount > 0 ? ` (${totalCount})` : '';
      btnPickViaInline.innerHTML = `<span class="pick-icon">🎯</span><span class="pick-text">完成选点${countText}</span>`;
    }
  };

  btnAddViaInline?.addEventListener('click', handleAddVia);
  btnAddViaInline?.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 禁用右键自动选点，右边已提供独立的“地图选点”按钮
  });
  btnPickViaInline?.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerInlineMapPick();
  });
  btnAddViaPoint?.addEventListener('click', handleAddVia);

  // 绑定起点与终点输入框 (支持拼音/汉字联想及回车直达)
  bindRoutePointInput(startInput, startDropdown, 'start', null, map);
  bindRoutePointInput(endInput, endDropdown, 'end', null, map);

  // 对调起终点按钮绑定 (点击 ⇅ 键对调起终点并反转途径点)
  const swapStartAndEndRoutePoints = () => {
    routeEndIsFromVia = false;
    const tCoord = routeStartCoord;
    const tName = routeStartName;
    const tMarker = routeStartMarker;
    const tZoom = routeStartZoom;

    routeStartCoord = routeEndCoord;
    routeStartName = routeEndName;
    routeStartMarker = routeEndMarker;
    routeStartZoom = routeEndZoom;

    routeEndCoord = tCoord;
    routeEndName = tName;
    routeEndMarker = tMarker;
    routeEndZoom = tZoom;

    if (startInput) startInput.value = routeStartName || '';
    if (endInput) endInput.value = routeEndName || '';

    // 更新地图上的 marker 标识与色彩 (起=绿，终=红)
    if (routeStartMarker && routeStartMarker.getElement()) {
      routeStartMarker.getElement().style.background = '#16a34a';
      routeStartMarker.getElement().innerText = '起';
    }
    if (routeEndMarker && routeEndMarker.getElement()) {
      routeEndMarker.getElement().style.background = '#ef4444';
      routeEndMarker.getElement().innerText = '终';
    }

    // 途径点顺序倒转 (返程)
    if (routeViaPoints && routeViaPoints.length > 1) {
      routeViaPoints.reverse();
      routeViaPoints.forEach((v, i) => {
        if (v.marker && v.marker.getElement()) {
          v.marker.getElement().innerText = i + 1;
        }
      });
    }

    renderViaList(map);
    scheduleRoutePlan(map);
  };
  window.swapStartAndEndRoutePoints = swapStartAndEndRoutePoints;
  bindStartAndEndRowsDrag(map);

  document.getElementById('btn-swap-route-pts')?.addEventListener('click', swapStartAndEndRoutePoints);
  document.getElementById('btn-swap-route-pts-2')?.addEventListener('click', swapStartAndEndRoutePoints);

  // 地图点击：响应路线点拾取模式 (起/终/连续途径)
  map.on('click', e => {
    const { lng, lat } = e.lngLat;
    const cleanLocation = resolveLocationInfo(map, e.lngLat, e.point, true);

    if (!pickingRoutePt) return;

    if (pickingRoutePt === 'start') {
      setRouteStartPoint(map, [lng, lat], cleanLocation || '起点');
      exitRoutePickingMode();
    } else if (pickingRoutePt === 'end') {
      setRouteEndPoint(map, [lng, lat], cleanLocation || '终点');
      exitRoutePickingMode();
    } else if (pickingRoutePt === 'via') {
      if (targetViaIndexForPick !== null && routeViaPoints[targetViaIndexForPick]) {
        // 单个已有途径点修改 -> 选完立即退出
        const v = routeViaPoints[targetViaIndexForPick];
        v.coords = [lng, lat];
        v.name = cleanLocation || `途径点 ${targetViaIndexForPick + 1}`;
        v.marker = null;
        renderViaList(map);
        scheduleRoutePlan(map);
        exitRoutePickingMode();
      } else {
        // 查找是否有等待填入坐标的空途径点 (例如先点击了加号添加空白行，再去地图点选)
        const emptyIdx = routeViaPoints.findIndex(v => !v.coords);
        if (emptyIdx >= 0) {
          const v = routeViaPoints[emptyIdx];
          v.coords = [lng, lat];
          v.name = cleanLocation || `途径点 ${emptyIdx + 1}`;
          v.marker = null;
          renderViaList(map);
          scheduleRoutePlan(map);
          exitRoutePickingMode();
        } else {
          // 高德 / Apple Maps 模式：连续选点时自动递进，终点始终自动接替并填充在底栏终点输入框
          addViaPoint(map, [lng, lat], cleanLocation || '途径点');
          if (btnPickViaInline) {
            const totalCount = (routeStartCoord ? 1 : 0) + routeViaPoints.length + (routeEndCoord ? 1 : 0);
            btnPickViaInline.innerHTML = `<span class="pick-icon">🎯</span><span class="pick-text">完成选点 (${totalCount})</span>`;
          }
        }
      }
    }
  });

  // 1. 规划按钮 (无⚡图标)
  btnCalcRoute?.addEventListener('click', () => {
    exitRoutePickingMode();
    const validVias = routeViaPoints.filter(v => v && v.coords);
    const hasEnoughPoints = (routeStartCoord && (routeEndCoord || validVias.length > 0)) ||
                            (routeEndCoord && validVias.length > 0) ||
                            (validVias.length >= 2);
    if (!hasEnoughPoints) {
      if (!routeStartCoord && !routeEndCoord && validVias.length === 0) {
        setRouteStartPoint(map, [104.0668, 30.5728], '成都市 (西岭门户)', 15.0);
        addViaPoint(map, [103.6210, 31.0020], '都江堰 (紫坪铺水库)', 15.0);
        addViaPoint(map, [103.1250, 31.0260], '卧龙巴朗山垭口 (4481m)', 15.0);
        setRouteEndPoint(map, [102.8360, 30.9980], '四姑娘山镇 (蜀山之后)', 15.0);
      } else {
        alert('请至少设定起点与一个终点或途径点！');
        return;
      }
    }
    autoPlanMultiPointRoute(map, true);
  });

  // 2. 导出下拉菜单切换 (存到收藏夹、导出GPX)
  const closeRouteExportMenu = () => {
    if (routeExportMenu && routeExportMenu.style.display !== 'none') {
      smoothClosePopover(routeExportMenu);
    }
  };

  // 2. 独立顶级「导入」路线按钮 (与收藏夹导入体验一致，优先系统原生文件选择器)
  const handleRouteTrackFile = (text, filename) => {
    const trackData = parseTrackFile(text, filename);
    const hasTrack = trackData && trackData.coords && trackData.coords.length >= 2;
    const hasWaypoints = trackData && trackData.waypoints && trackData.waypoints.length > 0;

    if (!hasTrack && !hasWaypoints) {
      alert('未能解析到有效的路线轨迹或点位，请确认文件为标准的 GPX / KML / GeoJSON / TCX 格式！');
      return;
    }

    if (!hasTrack && hasWaypoints) {
      importWaypointsIntoFavorites(trackData.waypoints, filename, map);
      return;
    }

    displayImportedTrack(map, trackData);
    showToast(`已成功导入路线: ${filename}`);

    if (hasWaypoints && trackData.waypoints.length > 0) {
      setTimeout(() => {
        if (confirm(`检测到该文件还包含 ${trackData.waypoints.length} 个途经点位，是否同时导入到【我的收藏 · 收藏地点】？`)) {
          importWaypointsIntoFavorites(trackData.waypoints, filename, map);
        }
      }, 450);
    }
  };

  btnRouteImportTrigger?.addEventListener('click', async () => {
    closeRouteExportMenu();
    if (window.electronAPI?.openFileDialog) {
      try {
        const res = await window.electronAPI.openFileDialog({
          title: '选择路线轨迹文件',
          filters: [
            { name: '路线轨迹文件 (*.gpx;*.kml;*.geojson;*.json;*.tcx)', extensions: ['gpx', 'kml', 'geojson', 'json', 'tcx'] },
            { name: 'All Files (*.*)', extensions: ['*'] }
          ]
        });
        if (res && res.success && res.content) {
          handleRouteTrackFile(res.content, res.filename);
        }
      } catch (err) {
        alert(`打开路线文件失败: ${err.message}`);
      }
      return;
    }

    if (routePanelImportInput) {
      routePanelImportInput.value = '';
      routePanelImportInput.click();
    }
  });

  routePanelImportInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      handleRouteTrackFile(text, file.name);
    } catch (err) {
      alert(`读取路线文件失败: ${err.message}`);
    }
  });

  // 3. 详情切换按钮 (展开/收起 距离与海拔等详情及高程剖面图)
  const isRouteDetailsExpanded = () => {
    const isStatsOpen = statsBox && statsBox.style.display !== 'none';
    const isChartOpen = chartSection && chartSection.style.display !== 'none';
    return Boolean(isStatsOpen || isChartOpen);
  };

  const updateRouteDetailsToggleText = () => {
    if (!btnRouteDetailsToggle) return;
    btnRouteDetailsToggle.innerText = isRouteDetailsExpanded() ? '收起' : '详情 ▾';
  };

  btnRouteDetailsToggle?.addEventListener('click', () => {
    if (!statsBox) return;
    if (isRouteDetailsExpanded()) {
      // 只要详情统计或高程剖面图有任意一个处于展开状态，点击统统一并平滑收起
      statsBox.style.display = 'none';
      if (chartSection) chartSection.style.display = 'none';
      btnRouteDetailsToggle.innerText = '详情 ▾';
    } else {
      // 展开详情统计指标卡片
      statsBox.style.display = 'grid';
      btnRouteDetailsToggle.innerText = '收起';
    }
  });

  // 4. 海拔变化图交互联动：海拔图默认彻底隐藏，点击详情中海拔指标时才展开
  const toggleElevationChart = () => {
    if (!chartSection) return;
    const isHidden = chartSection.style.display === 'none';
    if (isHidden) {
      chartSection.style.display = 'flex';
      refreshRouteElevationProfile(map);
      updateRouteDetailsToggleText();
      // 在移动端抽屉或受限视口中，轻柔平滑滚动到底部展现完整图表
      try {
        const panelBody = routePanel?.querySelector('.panel-body');
        if (panelBody) {
          panelBody.scrollTo({ top: panelBody.scrollHeight, behavior: 'smooth' });
        }
      } catch (_) {}
    } else {
      chartSection.style.display = 'none';
      updateRouteDetailsToggleText();
    }
  };

  // 剖面图卡片右上角专属关闭按钮 (轻触一键关闭剖面图)
  const btnCloseChartSection = document.getElementById('btn-close-chart-section');
  btnCloseChartSection?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (chartSection) chartSection.style.display = 'none';
    updateRouteDetailsToggleText();
  });

  document.getElementById('stat-card-ascent')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-card-descent')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-card-maxele')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-card-minele')?.addEventListener('click', toggleElevationChart);
  document.getElementById('stat-toggle-chart-btn')?.addEventListener('click', toggleElevationChart);

  // 5. 点击页面空白或地图自动关闭下拉菜单
  document.addEventListener('click', (e) => {
    if (routeExportMenu && !routeExportMenu.contains(e.target) && e.target !== btnRouteExportTrigger) {
      closeRouteExportMenu();
    }
    if (startDropdown && !startDropdown.contains(e.target) && e.target !== startInput) {
      startDropdown.style.display = 'none';
    }
    if (endDropdown && !endDropdown.contains(e.target) && e.target !== endInput) {
      endDropdown.style.display = 'none';
    }
  });

  // 清空所有点与路线
  btnClearRoute?.addEventListener('click', () => {
    exitRoutePickingMode();
    currentRouteAbortController?.abort();
    currentRouteAbortController = null;
    ++currentRouteRequestId;
    if (map.getSource('outdoor-route-source')) {
      map.getSource('outdoor-route-source').setData({ type: 'FeatureCollection', features: [] });
    }
    if (map.getSource('imported-track-source')) {
      map.getSource('imported-track-source').setData({ type: 'FeatureCollection', features: [] });
    }
    importedTrackMarkers.forEach(m => {
      try { m.remove(); } catch (e) {}
    });
    importedTrackMarkers = [];
    if (routeStartMarker) routeStartMarker.remove();
    if (routeEndMarker) routeEndMarker.remove();
    if (profileCursorMarker) profileCursorMarker.remove();
    routeViaPoints.forEach(v => {
      if (v.marker) v.marker.remove();
    });
    routeViaPoints = [];
    routeStartCoord = null;
    routeStartName = '';
    routeStartMarker = null;
    routeEndCoord = null;
    routeEndName = '';
    routeEndMarker = null;
    routeStartZoom = 14.5;
    routeEndZoom = 14.5;
    routeEndIsFromVia = false;

    hideRouteFloatingDropdown();

    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    if (startDropdown) startDropdown.style.display = 'none';
    if (endDropdown) endDropdown.style.display = 'none';
    closeRouteExportMenu();
    if (btnRouteDetailsToggle) btnRouteDetailsToggle.innerText = '详情 ▾';
    renderViaList(map);

    if (statsBox) statsBox.style.display = 'none';
    if (chartSection) chartSection.style.display = 'none';
    currentPlannedRouteCoords = [];
    currentProfileData = [];
    currentRouteMetrics = null;

    // 清空后自动顺滑收起路线规划面板
    smoothClosePanel(routePanel);
  });

  // 路线保存与 GPX 导出处理
  const saveRouteModal = document.getElementById('save-route-modal');
  const btnCloseSaveRouteModal = document.getElementById('btn-close-save-route-modal');
  const btnCancelSaveRoute = document.getElementById('btn-cancel-save-route');
  const btnConfirmSaveRoute = document.getElementById('btn-confirm-save-route');
  const saveRouteNameInput = document.getElementById('save-route-name-input');
  const saveRouteDistText = document.getElementById('save-route-dist-text');
  const saveRouteAscentText = document.getElementById('save-route-ascent-text');

  // 点击【收藏】路线按钮 (在下方顺滑展开/收起保存路线卡片)
  btnSaveRouteTrigger?.addEventListener('click', () => {
    closeRouteExportMenu();
    const isSaveModalOpen = saveRouteModal && saveRouteModal.style.display !== 'none' && !saveRouteModal.classList.contains('panel-closing');
    if (isSaveModalOpen) {
      closeSaveModal();
      return;
    }
    const effectiveEndCoord = routeEndCoord || (routeViaPoints.length > 0 ? routeViaPoints[routeViaPoints.length - 1].coords : null);
    const effectiveEndName = routeEndName || (routeViaPoints.length > 0 ? routeViaPoints[routeViaPoints.length - 1].name : '终点');
    if (!routeStartCoord || !effectiveEndCoord || !currentPlannedRouteCoords || currentPlannedRouteCoords.length === 0) {
      alert('请先在地图上设定起点和终点（或途径点），生成路线后再保存！');
      return;
    }
    const modeNames = { drive: '自驾', cycle: '骑行', hike: '徒步' };
    const defaultName = `${routeStartName || '起点'} 至 ${effectiveEndName || '终点'} (${modeNames[activeRouteMode] || '户外'})`;
    if (saveRouteNameInput) saveRouteNameInput.value = defaultName;
    if (saveRouteDistText && currentRouteMetrics) {
      saveRouteDistText.innerText = `${currentRouteMetrics.totalDistKm.toFixed(1)} km`;
    }
    if (saveRouteAscentText && currentRouteMetrics) {
      saveRouteAscentText.innerText = `+${Math.round(currentRouteMetrics.totalAscent)} m`;
    }
    showElement(saveRouteModal, 'block');
    if (saveRouteNameInput) {
      saveRouteNameInput.focus();
      saveRouteNameInput.select();
    }
  });

  const closeSaveModal = () => {
    smoothCloseModal(saveRouteModal);
  };
  btnCloseSaveRouteModal?.addEventListener('click', closeSaveModal);
  btnCancelSaveRoute?.addEventListener('click', closeSaveModal);

  // 确认保存路线到收藏夹
  btnConfirmSaveRoute?.addEventListener('click', () => {
    const routeName = (saveRouteNameInput?.value || '').trim() || '规划路线';
    const effectiveEndCoord = routeEndCoord || (routeViaPoints.length > 0 ? routeViaPoints[routeViaPoints.length - 1].coords : null);
    const effectiveEndName = routeEndName || (routeViaPoints.length > 0 ? routeViaPoints[routeViaPoints.length - 1].name : '终点');
    const effectiveViaPoints = routeEndCoord ? routeViaPoints : routeViaPoints.slice(0, -1);
    const newRoute = {
      id: 'route_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: routeName,
      mode: activeRouteMode,
      createdAt: new Date().toLocaleDateString('zh-CN'),
      timestamp: Date.now(),
      start: { coords: routeStartCoord, name: routeStartName || '起点' },
      end: { coords: effectiveEndCoord, name: effectiveEndName || '终点' },
      viaPoints: effectiveViaPoints.map(v => ({ coords: v.coords, name: v.name })),
      pathCoords: currentPlannedRouteCoords,
      metrics: {
        distKm: currentRouteMetrics ? currentRouteMetrics.totalDistKm : 0,
        timeStr: currentRouteMetrics ? currentRouteMetrics.timeStr : '',
        ascent: currentRouteMetrics ? Math.round(currentRouteMetrics.totalAscent) : 0,
        descent: currentRouteMetrics ? Math.round(currentRouteMetrics.totalDescent) : 0,
        maxEle: currentRouteMetrics ? currentRouteMetrics.maxEle : 0,
        minEle: currentRouteMetrics ? currentRouteMetrics.minEle : 0
      }
    };

    savedRoutes.unshift(newRoute);
    try {
      localStorage.setItem('outmap_saved_routes', JSON.stringify(savedRoutes));
    } catch (e) {}

    closeSaveModal();
    if (typeof renderSavedRoutesListFn === 'function') {
      renderSavedRoutesListFn();
    }
    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('save_route');
    }
    alert(`✅ 路线“${routeName}”已成功保存到收藏夹！\n可在右下角“⭐ 收藏”中随时调出或导出 GPX。`);
  });

  // 点击【📥 导出GPX】(当前规划路线，支持无显式终点时自动以最后一个途径点作为终点导出)
  btnExportGpx?.addEventListener('click', () => {
    closeRouteExportMenu();
    const effectiveEndCoord = routeEndCoord || (routeViaPoints.length > 0 ? routeViaPoints[routeViaPoints.length - 1].coords : null);
    const effectiveEndName = routeEndName || (routeViaPoints.length > 0 ? routeViaPoints[routeViaPoints.length - 1].name : '终点');
    if (!routeStartCoord || !effectiveEndCoord || !currentPlannedRouteCoords || currentPlannedRouteCoords.length === 0) {
      alert('请先设定起点和终点（或途径点）并生成路线后再导出！');
      return;
    }
    const modeNames = { drive: '自驾', cycle: '骑行', hike: '徒步' };
    const effectiveViaPoints = routeEndCoord ? routeViaPoints : routeViaPoints.slice(0, -1);
    const currentRouteObj = {
      name: `${routeStartName || '起点'}_至_${effectiveEndName || '终点'}_${modeNames[activeRouteMode] || '路线'}`,
      mode: activeRouteMode,
      start: { coords: routeStartCoord, name: routeStartName },
      end: { coords: effectiveEndCoord, name: effectiveEndName },
      viaPoints: effectiveViaPoints.map(v => ({ coords: v.coords, name: v.name })),
      pathCoords: currentPlannedRouteCoords
    };
    exportRouteToGpx(currentRouteObj, map);
  });

  // Canvas 鼠标滑过联动 3D 地图
  if (canvas) {
    const handleProfileHover = (clientX) => {
      if (currentProfileData.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const paddingLeft = 38;
      const paddingRight = 14;
      const chartW = Math.max(1, rect.width - paddingLeft - paddingRight);
      const ratio = Math.max(0, Math.min(1, (x - paddingLeft) / chartW));
      const idx = Math.round(ratio * (currentProfileData.length - 1));
      const pt = currentProfileData[idx];
      if (!pt) return;

      if (chartHoverInfo) {
        chartHoverInfo.innerText = `${pt.distKm.toFixed(1)}km · 海拔 ${pt.ele}m`;
      }

      // 重绘图表并在 Canvas 上显示平滑高亮竖线与圆点
      drawElevationChart(canvas, currentProfileData, pt);

      // 联动 3D 地图光标
      if (!profileCursorMarker) {
        const el = document.createElement('div');
        el.style.cssText = 'background:#f97316; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 12px #ea580c; transition:transform 0.08s ease;';
        profileCursorMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(pt.coord).addTo(map);
      } else {
        profileCursorMarker.setLngLat(pt.coord);
      }
    };

    const clearProfileHover = () => {
      if (chartHoverInfo) chartHoverInfo.innerText = '滑过图表联动3D地图';
      if (profileCursorMarker) profileCursorMarker.remove();
      profileCursorMarker = null;
      drawElevationChart(canvas, currentProfileData, null);
    };

    canvas.addEventListener('mousemove', e => handleProfileHover(e.clientX));
    canvas.addEventListener('touchmove', e => {
      if (e.touches && e.touches[0]) {
        handleProfileHover(e.touches[0].clientX);
      }
    }, { passive: true });

    canvas.addEventListener('mouseleave', clearProfileHover);
    canvas.addEventListener('touchend', clearProfileHover);
  }
}

// 导出标准 GPX 1.1 轨迹文件 (带航点与海拔高程，完美兼容各大 GPS 与户外软件)
function exportRouteToGpx(routeData, map) {
  const name = routeData.name || 'Outmap_Route';
  const mode = routeData.mode || 'drive';
  const start = routeData.start;
  const end = routeData.end;
  const viaPoints = routeData.viaPoints || [];
  const pathCoords = routeData.pathCoords || currentPlannedRouteCoords || [];

  if (!pathCoords || pathCoords.length === 0) {
    alert('当前路线暂无有效轨迹坐标，无法导出！');
    return;
  }

  const escapeXml = (str) => String(str || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });

  let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
  gpx += '<gpx version="1.1" creator="Outmap 3D GIS" ';
  gpx += 'xmlns="http://www.topografix.com/GPX/1/1" ';
  gpx += 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ';
  gpx += 'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';

  gpx += `  <metadata>\n`;
  gpx += `    <name>${escapeXml(name)}</name>\n`;
  gpx += `    <desc>由 Outmap 3D 导出路线 (出行方式: ${mode})</desc>\n`;
  gpx += `    <time>${new Date().toISOString()}</time>\n`;
  gpx += `  </metadata>\n`;

  // 航点: 起点
  if (start && start.coords) {
    const ele = getRealElevation(map, start.coords) || 0;
    gpx += `  <wpt lat="${start.coords[1].toFixed(6)}" lon="${start.coords[0].toFixed(6)}">\n`;
    gpx += `    <ele>${Math.round(ele)}</ele>\n`;
    gpx += `    <name>起点: ${escapeXml(start.name || '起点')}</name>\n`;
    gpx += `    <sym>Flag, Green</sym>\n`;
    gpx += `  </wpt>\n`;
  }

  // 航点: 途径点
  viaPoints.forEach((v, idx) => {
    if (v && v.coords) {
      const ele = getRealElevation(map, v.coords) || 0;
      gpx += `  <wpt lat="${v.coords[1].toFixed(6)}" lon="${v.coords[0].toFixed(6)}">\n`;
      gpx += `    <ele>${Math.round(ele)}</ele>\n`;
      gpx += `    <name>途径点 ${idx + 1}: ${escapeXml(v.name || '')}</name>\n`;
      gpx += `    <sym>Waypoint</sym>\n`;
      gpx += `  </wpt>\n`;
    }
  });

  // 航点: 终点
  if (end && end.coords) {
    const ele = getRealElevation(map, end.coords) || 0;
    gpx += `  <wpt lat="${end.coords[1].toFixed(6)}" lon="${end.coords[0].toFixed(6)}">\n`;
    gpx += `    <ele>${Math.round(ele)}</ele>\n`;
    gpx += `    <name>终点: ${escapeXml(end.name || '终点')}</name>\n`;
    gpx += `    <sym>Flag, Red</sym>\n`;
    gpx += `  </wpt>\n`;
  }

  // 完整轨迹线段
  gpx += `  <trk>\n`;
  gpx += `    <name>${escapeXml(name)}</name>\n`;
  gpx += `    <type>${mode === 'hike' ? 'Hiking' : (mode === 'cycle' ? 'Cycling' : 'Driving')}</type>\n`;
  gpx += `    <trkseg>\n`;

  pathCoords.forEach(pt => {
    const lng = pt[0];
    const lat = pt[1];
    let ele = pt[2];
    if (ele === undefined) {
      ele = getRealElevation(map, pt);
    }
    const eleVal = Math.round(ele || 0);
    gpx += `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><ele>${eleVal}</ele></trkpt>\n`;
  });

  gpx += `    </trkseg>\n`;
  gpx += `  </trk>\n`;
  gpx += `</gpx>`;

  const cleanFilename = `${name.replace(/[\\/:*?"<>|]/g, '_')}.gpx`;

  // 优先接入操作系统原生“另存为”对话框 (免除浏览器下载提示栏)
  if (window.electronAPI?.saveFileDialog) {
    window.electronAPI.saveFileDialog({
      title: '导出路线轨迹 (GPX)',
      defaultPath: cleanFilename,
      filters: [
        { name: 'GPS Exchange Format (*.gpx)', extensions: ['gpx'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ],
      content: gpx
    }).then(res => {
      if (res && res.success && res.filePath) {
        showToast(`路线已成功导出至: ${res.filePath}`);
      }
    }).catch(err => {
      console.warn('[Save GPX Native Dialog Error]', err);
    });
    return;
  }

  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, 100);
}

// 调出保存的路线并在 3D 地图上完美复原 (零重复网络请求，零相机飞掠掉帧)
function loadSavedRoute(routeId, map) {
  const route = savedRoutes.find(r => r.id === routeId);
  if (!route) return;

  const btnClear = document.getElementById('btn-clear-route');
  if (btnClear) btnClear.click();

  // 还原出行模式
  activeRouteMode = route.mode || 'drive';
  document.querySelectorAll('.route-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === activeRouteMode);
  });

  // 还原起点
  if (route.start && route.start.coords) {
    setRouteStartPoint(map, route.start.coords, route.start.name || '起点');
  }

  // 还原途径点
  if (route.viaPoints && route.viaPoints.length > 0) {
    route.viaPoints.forEach((via, i) => {
      addViaPoint(map, via.coords, via.name || `途径点 ${i + 1}`);
    });
  }

  // 还原终点
  if (route.end && route.end.coords) {
    setRouteEndPoint(map, route.end.coords, route.end.name || '终点');
  }

  // 关键：彻底取消因设置起点/途径点/终点而排队的后台自动重新算路定时器，
  // 避免在 1400ms fitBounds 相机飞掠期间发起 OSRM 网络请求与图层重绘导致掉帧卡顿！
  clearTimeout(routePlanTimer);
  routePlanTimer = null;
  currentRouteAbortController?.abort();
  currentRouteAbortController = null;
  ++currentRouteRequestId;

  // 还原 3D 轨迹线与高程剖面
  if (route.pathCoords && route.pathCoords.length > 0) {
    currentPlannedRouteCoords = route.pathCoords;
    renderRouteGeometry(map, route.pathCoords);
    const m = route.metrics || {};
    updateProfileAndMetrics(map, route.pathCoords, m.distKm, null, true, true);
  }

  // 再次确保不被后续微任务误触发
  clearTimeout(routePlanTimer);
  routePlanTimer = null;

  // 关闭其余右下角抽屉，展开路线规划面板
  closeConflictingBottomPanels('route-panel');
  const routePanel = document.getElementById('route-panel');
  showElement(routePanel, 'flex');
}

// 绘制精美流畅的高清 Canvas 海拔剖面图 (完美适配 Retina 高分屏，iOS 级细腻质感)
function drawElevationChart(canvas, data, hoverPt = null) {
  if (!canvas || !data || data.length === 0) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const containerW = canvas.parentElement ? canvas.parentElement.clientWidth : 370;
  const displayW = Math.max(240, Math.round(containerW));
  const displayH = 125;

  if (canvas.width !== Math.round(displayW * dpr) || canvas.height !== Math.round(displayH * dpr)) {
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
  }

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayW, displayH);

  const paddingLeft = 38;
  const paddingRight = 14;
  const paddingTop = 14;
  const paddingBottom = 22;

  const chartW = displayW - paddingLeft - paddingRight;
  const chartH = displayH - paddingTop - paddingBottom;

  let minEle = Infinity;
  let maxEle = -Infinity;
  data.forEach(d => {
    if (d.ele < minEle) minEle = d.ele;
    if (d.ele > maxEle) maxEle = d.ele;
  });

  const totalDist = Math.max(0.1, data[data.length - 1].distKm);
  const rawSpan = Math.max(20, maxEle - minEle);
  // 留出 8% 缓冲空间，且如果数据全部大于等于 0，网格下限绝不出现负值 (彻底修复 -15m 异常)
  let displayMinEle = minEle >= 0 ? Math.max(0, Math.floor((minEle - rawSpan * 0.08) / 10) * 10) : Math.floor((minEle - rawSpan * 0.08) / 10) * 10;
  let displayMaxEle = Math.ceil((maxEle + rawSpan * 0.08) / 10) * 10;
  let eleSpan = Math.max(20, displayMaxEle - displayMinEle);

  // 绘制细腻网格线与 Y 轴刻度
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const gridRows = 3;
  for (let i = 0; i <= gridRows; i++) {
    const y = Math.round(paddingTop + (chartH / gridRows) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(displayW - paddingRight, y);
    ctx.stroke();

    const val = Math.round(displayMaxEle - (eleSpan / gridRows) * i);
    ctx.textAlign = 'right';
    ctx.fillText(`${val}m`, paddingLeft - 6, y + 3);
  }

  // 绘制 X 轴距离刻度
  ctx.textAlign = 'left';
  ctx.fillText('0km', paddingLeft, displayH - 6);
  ctx.textAlign = 'right';
  ctx.fillText(`${totalDist.toFixed(1)}km`, displayW - paddingRight, displayH - 6);

  // 绘制渐变填充曲线
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = paddingLeft + (d.distKm / totalDist) * chartW;
    const y = paddingTop + chartH - ((d.ele - displayMinEle) / eleSpan) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const lastX = paddingLeft + chartW;
  ctx.lineTo(lastX, paddingTop + chartH);
  ctx.lineTo(paddingLeft, paddingTop + chartH);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.32)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // 绘制曲线勾边 (翡翠绿户外活力风格)
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = paddingLeft + (d.distKm / totalDist) * chartW;
    const y = paddingTop + chartH - ((d.ele - displayMinEle) / eleSpan) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 悬停交互高亮竖线与指示圆点
  if (hoverPt) {
    const hx = paddingLeft + (hoverPt.distKm / totalDist) * chartW;
    const hy = paddingTop + chartH - ((hoverPt.ele - displayMinEle) / eleSpan) * chartH;

    // 垂直指示虚线
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.2;
    ctx.moveTo(hx, paddingTop);
    ctx.lineTo(hx, paddingTop + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // 焦点圆环
    ctx.beginPath();
    ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ea580c';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  ctx.restore();
}

// =========================================================
// 外部路线轨迹与途径点导入解析系统 (支持 GPX / KML / GeoJSON / Outmap JSON / TCX)
// =========================================================
function parseTrackFile(content, fileName) {
  let name = (fileName || '导入路线').replace(/\.[^/.]+$/, '');
  const coords = [];
  const waypoints = [];
  let start = null;
  let end = null;
  let viaPoints = [];

  const cleanText = (content || '').trim();
  if (!cleanText) return null;

  // 1. JSON / GeoJSON / Outmap 原生路线存档
  if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleanText);

      // 1A. Outmap 原生 Saved Route 格式 { id, name, start, end, viaPoints, pathCoords, ... }
      if (parsed.start && parsed.end && (parsed.pathCoords || parsed.viaPoints)) {
        start = {
          coords: parsed.start.coords,
          name: parsed.start.name || '起点'
        };
        end = {
          coords: parsed.end.coords,
          name: parsed.end.name || '终点'
        };
        viaPoints = (parsed.viaPoints || []).map((v, i) => ({
          coords: v.coords,
          name: v.name || `途径点 ${i + 1}`
        }));
        const fullCoords = parsed.pathCoords && parsed.pathCoords.length > 0
          ? parsed.pathCoords
          : [start.coords, ...viaPoints.map(v => v.coords), end.coords];

        return {
          name: parsed.name || name,
          coords: fullCoords,
          start,
          end,
          viaPoints,
          waypoints: [start, ...viaPoints, end]
        };
      }

      // 1B. GeoJSON FeatureCollection 或 Feature
      const geo = parsed;
      if (geo.properties && geo.properties.name) {
        name = geo.properties.name;
      }

      if (geo.features && Array.isArray(geo.features)) {
        for (const feat of geo.features) {
          if (!feat || !feat.geometry) continue;
          if (feat.properties && feat.properties.name && !name) {
            name = feat.properties.name;
          }

          const gType = feat.geometry.type;
          if (gType === 'LineString' && Array.isArray(feat.geometry.coordinates)) {
            coords.push(...feat.geometry.coordinates);
          } else if (gType === 'MultiLineString' && Array.isArray(feat.geometry.coordinates)) {
            for (const line of feat.geometry.coordinates) {
              if (Array.isArray(line)) coords.push(...line);
            }
          } else if (gType === 'Point' && Array.isArray(feat.geometry.coordinates)) {
            const pCoords = feat.geometry.coordinates;
            const pName = feat.properties?.name || feat.properties?.title || feat.properties?.desc || `途经点 ${waypoints.length + 1}`;
            const pOrder = Number.isFinite(feat.properties?.order) ? feat.properties.order : waypoints.length;
            const pType = feat.properties?.type || '';
            waypoints.push({
              coords: pCoords,
              name: pName,
              desc: feat.properties?.description || '',
              order: pOrder,
              type: pType
            });
          }
        }
      } else if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
        coords.push(...geo.coordinates);
      } else if (geo.type === 'Feature' && geo.geometry?.type === 'LineString') {
        coords.push(...geo.geometry.coordinates);
      }

      // 提取起终点与途径点
      if (waypoints.length > 0) {
        waypoints.sort((a, b) => a.order - b.order);
        if (waypoints.length === 1) {
          start = waypoints[0];
        } else {
          start = waypoints[0];
          end = waypoints[waypoints.length - 1];
          viaPoints = waypoints.slice(1, -1);
        }
        if (coords.length === 0 && waypoints.length >= 2) {
          coords.push(...waypoints.map(w => w.coords));
        }
      }

      if (coords.length > 0 || waypoints.length > 0) {
        return {
          name: (geo.properties && geo.properties.name) ? geo.properties.name : name,
          coords,
          start,
          end,
          viaPoints,
          waypoints
        };
      }
    } catch (e) {
      console.warn('[parseTrackFile JSON error]', e);
    }
  }

  // 2. XML 格式 (GPX, KML, TCX)
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(content, 'text/xml');

    const nameNode = xml.querySelector('metadata > name') || xml.querySelector('trk > name') || xml.querySelector('name');
    if (nameNode && nameNode.textContent.trim()) {
      name = nameNode.textContent.trim();
    }

    // 2A. GPX <wpt> (Waypoints 途经点 / 标记点)
    const wptNodes = xml.querySelectorAll('wpt');
    if (wptNodes.length > 0) {
      wptNodes.forEach((wpt, idx) => {
        const lat = parseFloat(wpt.getAttribute('lat'));
        const lon = parseFloat(wpt.getAttribute('lon'));
        const wNameNode = wpt.querySelector('name');
        const wDescNode = wpt.querySelector('desc');
        const wEleNode = wpt.querySelector('ele');
        const rawName = wNameNode ? wNameNode.textContent.trim() : `途经点 ${idx + 1}`;
        const wDesc = wDescNode ? wDescNode.textContent.trim() : '';
        const wEle = wEleNode ? parseFloat(wEleNode.textContent) : undefined;
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          waypoints.push({
            coords: Number.isFinite(wEle) ? [lon, lat, wEle] : [lon, lat],
            name: rawName,
            desc: wDesc
          });
        }
      });
    }

    // 2B. GPX <trkpt> (Trackpoints 路线轨迹细分点)
    const trkpts = xml.querySelectorAll('trkpt');
    if (trkpts.length > 0) {
      trkpts.forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        const eleNode = pt.querySelector('ele');
        const ele = eleNode ? parseFloat(eleNode.textContent) : undefined;
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          coords.push(Number.isFinite(ele) ? [lon, lat, ele] : [lon, lat]);
        }
      });
    }

    // 2C. GPX <rtept> (Route Points)
    const rtepts = xml.querySelectorAll('rtept');
    if (rtepts.length > 0) {
      const rteWaypoints = [];
      rtepts.forEach((pt, idx) => {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        const eleNode = pt.querySelector('ele');
        const rNameNode = pt.querySelector('name');
        const ele = eleNode ? parseFloat(eleNode.textContent) : undefined;
        const ptCoords = Number.isFinite(ele) ? [lon, lat, ele] : [lon, lat];
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          rteWaypoints.push({
            coords: ptCoords,
            name: rNameNode ? rNameNode.textContent.trim() : `途径点 ${idx + 1}`
          });
          if (coords.length === 0) coords.push(ptCoords);
        }
      });
      if (waypoints.length === 0 && rteWaypoints.length > 0) {
        waypoints.push(...rteWaypoints);
      }
    }

    // 2D. KML 规范解析 (<Placemark> 分辨 LineString 路线与 Point 地标)
    const placemarks = xml.querySelectorAll('Placemark');
    if (placemarks.length > 0) {
      placemarks.forEach((pm, idx) => {
        const pmName = pm.querySelector('name')?.textContent?.trim() || '';
        const pmDesc = pm.querySelector('description')?.textContent?.trim() || '';

        // LineString 路线
        const lsCoordsNode = pm.querySelector('LineString coordinates') || pm.querySelector('coordinates');
        const hasPoint = !!pm.querySelector('Point');
        if (lsCoordsNode && !hasPoint) {
          const raw = lsCoordsNode.textContent.trim();
          raw.split(/\s+/).forEach(p => {
            const parts = p.split(',').map(Number);
            if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
              coords.push(parts.length >= 3 && Number.isFinite(parts[2]) ? [parts[0], parts[1], parts[2]] : [parts[0], parts[1]]);
            }
          });
        }

        // Point 途径地标
        const ptCoordsNode = pm.querySelector('Point coordinates');
        if (ptCoordsNode) {
          const raw = ptCoordsNode.textContent.trim();
          const parts = raw.split(',').map(Number);
          if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            waypoints.push({
              coords: parts.length >= 3 && Number.isFinite(parts[2]) ? [parts[0], parts[1], parts[2]] : [parts[0], parts[1]],
              name: pmName || `地标 ${waypoints.length + 1}`,
              desc: pmDesc
            });
          }
        }
      });
    } else {
      // 兜底 KML 裸 coordinates
      const coordNodes = xml.querySelectorAll('coordinates');
      if (coordNodes.length > 0 && coords.length === 0) {
        coordNodes.forEach(node => {
          const raw = (node.textContent || '').trim();
          raw.split(/\s+/).forEach(p => {
            const parts = p.split(',').map(Number);
            if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
              coords.push(parts.length >= 3 && Number.isFinite(parts[2]) ? [parts[0], parts[1], parts[2]] : [parts[0], parts[1]]);
            }
          });
        });
      }
    }

    // 2E. TCX <Trackpoint>
    const trackpoints = xml.querySelectorAll('Trackpoint');
    if (trackpoints.length > 0 && coords.length === 0) {
      trackpoints.forEach(pt => {
        const latNode = pt.querySelector('LatitudeDegrees');
        const lonNode = pt.querySelector('LongitudeDegrees');
        const altNode = pt.querySelector('AltitudeMeters');
        if (latNode && lonNode) {
          const lat = parseFloat(latNode.textContent);
          const lon = parseFloat(lonNode.textContent);
          const ele = altNode ? parseFloat(altNode.textContent) : undefined;
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            coords.push(Number.isFinite(ele) ? [lon, lat, ele] : [lon, lat]);
          }
        }
      });
    }

    if (waypoints.length > 0) {
      if (waypoints.length === 1) {
        start = waypoints[0];
      } else {
        start = waypoints[0];
        end = waypoints[waypoints.length - 1];
        viaPoints = waypoints.slice(1, -1);
      }
      if (coords.length === 0 && waypoints.length >= 2) {
        coords.push(...waypoints.map(w => w.coords));
      }
    }

    if (coords.length > 0 || waypoints.length > 0) {
      return {
        name,
        coords,
        start,
        end,
        viaPoints,
        waypoints
      };
    }
  } catch (e) {
    console.warn('[parseTrackFile XML error]', e);
  }

  return null;
}

let importedTrackMarkers = [];

function displayImportedTrack(map, trackData) {
  const { name, coords, start, end, viaPoints } = trackData;
  const pathCoords = coords.map(c => [c[0], c[1]]);

  // 1. 在地图上绘制 Apple Maps 原生纯实心翠绿路线丝带 (严格置于道路标牌与路名之下，与系统导航 100% 统一)
  if (map.getSource('imported-track-source')) {
    map.getSource('imported-track-source').setData({ type: 'FeatureCollection', features: [] });
  }
  renderRouteGeometry(map, pathCoords);

  // 2. 清除并完全对接系统路线图钉体系 (包含起终点与全量途径点)
  importedTrackMarkers.forEach(m => m.remove());
  importedTrackMarkers = [];

  if (routeStartMarker) { routeStartMarker.remove(); routeStartMarker = null; }
  if (routeEndMarker) { routeEndMarker.remove(); routeEndMarker = null; }
  routeViaPoints.forEach(v => {
    if (v.marker) {
      try { v.marker.remove(); } catch (e) {}
    }
  });
  routeViaPoints = [];

  const startCoord = (start && start.coords) ? [start.coords[0], start.coords[1]] : pathCoords[0];
  const startName = (start && start.name) ? start.name : `[导入] ${name} 起点`;
  const endCoord = (end && end.coords) ? [end.coords[0], end.coords[1]] : pathCoords[pathCoords.length - 1];
  const endName = (end && end.name) ? end.name : `[导入] ${name} 终点`;

  routeStartCoord = startCoord;
  routeStartName = startName;
  routeEndCoord = endCoord;
  routeEndName = endName;

  routeStartMarker = null;
  routeEndMarker = null;

  // 全量途径点注册；静止显示由 MapLibre 原生路线点图层统一完成。
  const effectiveVias = viaPoints && viaPoints.length > 0 ? viaPoints : [];
  effectiveVias.forEach((via, i) => {
    const viaIdx = i + 1;
    const vCoords = [via.coords[0], via.coords[1]];
    const vName = via.name || `途径点 ${viaIdx}`;
    routeViaPoints.push({
      id: 'via_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 4),
      coords: vCoords,
      name: vName,
      marker: null,
      zoom: 14.8
    });
  });

  // 同步更新路线规划面板的起终点与途径点列表
  const startInput = document.getElementById('route-start-input');
  const endInput = document.getElementById('route-end-input');
  if (startInput) startInput.value = routeStartName;
  if (endInput) endInput.value = routeEndName;

  renderViaList(map);
  syncRouteMarkersVisualState(map);
  bindStartAndEndRowsDrag(map);

  // 3. 计算并展示完整高程剖面与指标统计
  const hasEleData = coords.some(c => c.length >= 3 && Number.isFinite(c[2]));
  const sampleStep = Math.max(1, Math.floor(coords.length / 280));
  const sampledCoords = [];
  for (let i = 0; i < coords.length; i += sampleStep) {
    sampledCoords.push(coords[i]);
  }
  if (sampledCoords[sampledCoords.length - 1] !== coords[coords.length - 1]) {
    sampledCoords.push(coords[coords.length - 1]);
  }

  let totalDistKm = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let maxEle = -9999;
  let minEle = 99999;
  currentProfileData = [];

  for (let i = 0; i < sampledCoords.length; i++) {
    const pt = sampledCoords[i];
    let ele = (hasEleData && Number.isFinite(pt[2])) ? pt[2] : getRealElevation(map, pt);
    if (ele === null || ele === undefined) {
      ele = 500 + Math.sin((i / sampledCoords.length) * Math.PI) * 1200;
    }
    ele = Math.round(ele);

    if (i > 0) {
      const prev = sampledCoords[i - 1];
      const d = calculateDistanceKm(prev, pt);
      totalDistKm += d;

      const prevEle = currentProfileData[i - 1].ele;
      const diff = ele - prevEle;
      if (diff > 0) totalAscent += diff;
      else totalDescent += Math.abs(diff);
    }

    if (ele > maxEle) maxEle = ele;
    if (ele < minEle) minEle = ele;

    currentProfileData.push({ distKm: totalDistKm, ele, coord: pt });
  }

  // 4. 打开路线面板展现指标与高程剖面
  const routePanel = document.getElementById('route-panel');
  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const distEl = document.getElementById('stat-route-dist');
  const timeEl = document.getElementById('stat-route-time');
  const ascentEl = document.getElementById('stat-route-ascent');
  const descentEl = document.getElementById('stat-route-descent');
  const maxEleEl = document.getElementById('stat-route-maxele');
  const minEleEl = document.getElementById('stat-route-minele');
  const canvas = document.getElementById('elevation-chart-canvas');

  // 计算行车用时：长线按平均 78km/h 测算驾车时效
  const driveHours = totalDistKm / 78.0;
  const timeStr = driveHours < 1
    ? `${Math.max(1, Math.round(driveHours * 60))}分钟`
    : `${Math.floor(driveHours)}小时${Math.round((driveHours % 1) * 60)}分`;

  if (distEl) distEl.innerText = `${totalDistKm.toFixed(1)} km`;
  if (timeEl) timeEl.innerText = timeStr;
  if (ascentEl) ascentEl.innerText = `+${Math.round(totalAscent)} m`;
  if (descentEl) descentEl.innerText = `-${Math.round(totalDescent)} m`;
  if (maxEleEl) maxEleEl.innerText = `${maxEle} m`;
  if (minEleEl) minEleEl.innerText = `${minEle} m`;

  currentPlannedRouteCoords = pathCoords;
  currentRouteMetrics = {
    totalDistKm,
    timeStr,
    totalAscent,
    totalDescent,
    maxEle,
    minEle,
    isRealRoad: true
  };

  closeConflictingBottomPanels('route-panel');
  showElement(routePanel, 'flex');
  if (statsBox) statsBox.style.display = 'grid';
  if (chartSection) {
    chartSection.style.display = 'flex';
    drawElevationChart(canvas, currentProfileData);
  }
  const btnRouteDetailsToggle = document.getElementById('btn-route-details-toggle');
  if (btnRouteDetailsToggle) btnRouteDetailsToggle.innerText = '收起';

  // 5. 视角对齐整条轨迹全貌
  const bounds = pathCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(pathCoords[0], pathCoords[0]));
  map.fitBounds(bounds, {
    padding: { top: 90, bottom: 200, left: 50, right: 50 },
    pitch: Math.min(map.getPitch() ?? 50, 52),
    duration: 1400
  });

  const viaCountStr = effectiveVias.length > 0 ? ` (含 ${effectiveVias.length} 个途径打卡点)` : '';
  if (typeof showFluentAlert === 'function') {
    showFluentAlert({
      title: '路线轨迹导入成功',
      body: `已成功载入“${name}”${viaCountStr}\n全长 ${totalDistKm.toFixed(1)} km · 预估驾车 ${timeStr} · 累计爬升 +${Math.round(totalAscent)} m`
    });
  }
}

window.parseTrackFile = parseTrackFile;
window.displayImportedTrack = displayImportedTrack;

function setupTrackImport(map) {
  const btnFabImport = document.getElementById('btn-fab-import');
  const fileInput = document.getElementById('track-file-import-input');
  if (!btnFabImport || !fileInput) return;

  btnFabImport.addEventListener('click', async () => {
    // 优先接入操作系统原生文件打开对话框
    if (window.electronAPI?.openFileDialog) {
      try {
        const res = await window.electronAPI.openFileDialog({
          title: '选择路线轨迹文件',
          filters: [
            { name: '轨迹路线文件 (*.gpx;*.kml;*.geojson;*.json;*.tcx)', extensions: ['gpx', 'kml', 'geojson', 'json', 'tcx'] },
            { name: 'All Files (*.*)', extensions: ['*'] }
          ]
        });
        if (res && res.success && res.content) {
          const trackData = parseTrackFile(res.content, res.filename);
          const hasTrack = trackData && trackData.coords && trackData.coords.length >= 2;
          const hasWaypoints = trackData && trackData.waypoints && trackData.waypoints.length > 0;

          if (!hasTrack && !hasWaypoints) {
            alert('未能解析到有效的路线轨迹或点位，请确认文件为标准的 GPX / KML / GeoJSON / TCX 格式！');
            return;
          }

          if (!hasTrack && hasWaypoints) {
            // 纯点位文件智能转为点位导入
            importWaypointsIntoFavorites(trackData.waypoints, res.filename, map);
            return;
          }

          displayImportedTrack(map, trackData);
          showToast(`已成功导入轨迹: ${res.filename}`);

          if (hasWaypoints && trackData.waypoints.length > 0) {
            setTimeout(() => {
              if (confirm(`检测到该文件还包含 ${trackData.waypoints.length} 个途经点位，是否同时导入到【我的收藏 · 收藏地点】？`)) {
                importWaypointsIntoFavorites(trackData.waypoints, res.filename, map);
              }
            }, 450);
          }
        }
      } catch (err) {
        alert(`导入轨迹失败: ${err.message}`);
      }
      return;
    }

    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const trackData = parseTrackFile(text, file.name);
      const hasTrack = trackData && trackData.coords && trackData.coords.length >= 2;
      const hasWaypoints = trackData && trackData.waypoints && trackData.waypoints.length > 0;

      if (!hasTrack && !hasWaypoints) {
        alert('未能解析到有效的路线轨迹或点位，请确认文件为标准的 GPX / KML / GeoJSON / TCX 格式！');
        return;
      }

      if (!hasTrack && hasWaypoints) {
        importWaypointsIntoFavorites(trackData.waypoints, file.name, map);
        return;
      }

      displayImportedTrack(map, trackData);
      showToast(`已成功导入轨迹: ${file.name}`);

      if (hasWaypoints && trackData.waypoints.length > 0) {
        setTimeout(() => {
          if (confirm(`检测到该文件还包含 ${trackData.waypoints.length} 个途经点位，是否同时导入到【我的收藏 · 收藏地点】？`)) {
            importWaypointsIntoFavorites(trackData.waypoints, file.name, map);
          }
        }, 450);
      }
    } catch (err) {
      alert(`导入轨迹失败: ${err.message}`);
    }
  });
}

// 图层与要素显示控制卡片系统 (收藏点 / 规划路线 / 3D地形)
function setupLayersPopover(map) {
  const btnFabLayers = document.getElementById('btn-fab-layers');
  const popover = document.getElementById('layers-popover');
  const btnClose = document.getElementById('btn-close-layers-popover');
  const toggleFavs = document.getElementById('layer-toggle-favs');
  const toggleRoutes = document.getElementById('layer-toggle-routes');
  const toggleTerrain = document.getElementById('layer-toggle-terrain');

  if (!btnFabLayers || !popover) return;

  const togglePopover = (show) => {
    const isVisible = popover.style.display !== 'none';
    const next = typeof show === 'boolean' ? show : !isVisible;
    if (next) {
      closeConflictingBottomPanels('layers-popover');
      showElement(popover, 'block');
      btnFabLayers.classList.add('active');
    } else {
      smoothClosePopover(popover, () => {
        btnFabLayers.classList.remove('active');
      });
    }
  };

  btnFabLayers.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });

  btnClose?.addEventListener('click', () => togglePopover(false));

  document.addEventListener('click', (e) => {
    if (popover.style.display !== 'none' && !popover.contains(e.target) && e.target !== btnFabLayers) {
      togglePopover(false);
    }
  });

  // 1. 收藏夹地点图钉显示/隐藏切换
  toggleFavs?.addEventListener('change', () => {
    const visible = toggleFavs.checked;
    favoriteLayersVisible = visible;
    FAVORITE_LAYER_IDS.forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
    if (Array.isArray(waypointMarkers)) {
      waypointMarkers.forEach(m => {
        const el = m.getElement?.();
        if (el) el.style.display = visible ? '' : 'none';
      });
    }
  });

  // 2. 规划与导入路线轨迹显示/隐藏切换
  toggleRoutes?.addEventListener('change', () => {
    const visible = toggleRoutes.checked;
    routePointLayersVisible = visible;
    const visibility = visible ? 'visible' : 'none';
    ['outdoor-route-casing', 'outdoor-route-line', 'imported-track-casing', 'imported-track-line', ...ROUTE_POINT_LAYER_IDS].forEach(id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    });
    // 隐藏/显示起终点与途径点图钉
    const displayStyle = visible ? '' : 'none';
    if (routeStartMarker?.getElement()) routeStartMarker.getElement().style.display = displayStyle;
    if (routeEndMarker?.getElement()) routeEndMarker.getElement().style.display = displayStyle;
    routeViaPoints.forEach(v => {
      if (v.marker?.getElement()) v.marker.getElement().style.display = displayStyle;
    });
    importedTrackMarkers.forEach(m => {
      if (m.getElement()) m.getElement().style.display = displayStyle;
    });
  });

  // 3. 3D 立体地貌起伏切换
  toggleTerrain?.addEventListener('change', () => {
    const enabled = toggleTerrain.checked;
    if (enabled) {
      map.setTerrain({ source: 'terrain-dem', exaggeration: currentExaggeration || 1.5 });
      if (map.getLayer('hillshade-layer')) map.setLayoutProperty('hillshade-layer', 'visibility', 'visible');
    } else {
      map.setTerrain(null);
      if (map.getLayer('hillshade-layer')) map.setLayoutProperty('hillshade-layer', 'visibility', 'none');
    }
  });
}

// 右键地图上下文菜单系统 (右键添加地点到收藏夹、设为起点、添加途径点、设为终点)
function setupMapContextMenu(map) {
  const ctxMenu = document.getElementById('map-context-menu');
  const ctxPlaceName = document.getElementById('ctx-place-name');
  const ctxPlaceMeta = document.getElementById('ctx-place-meta');
  const btnAddFav = document.getElementById('ctx-btn-add-fav');
  const btnRouteStart = document.getElementById('ctx-btn-route-start');
  const btnRouteVia = document.getElementById('ctx-btn-route-via');
  const btnRouteEnd = document.getElementById('ctx-btn-route-end');

  const wpModal = document.getElementById('waypoint-modal');
  const wpNameInput = document.getElementById('wp-name');
  const wpCoordsVal = document.getElementById('wp-coords-val');
  const wpEleVal = document.getElementById('wp-ele-val');

  let currentContextPoint = null;

  const hideContextMenu = (onDone) => {
    smoothCloseContextMenu(onDone);
  };

  const handleContextMenuSelection = (action, point) => {
    if (!point || !action) return;
    if (action === 'add-fav') {
      tempPickedPoint = {
        lng: point.lng,
        lat: point.lat,
        ele: point.ele
      };
      if (wpCoordsVal) wpCoordsVal.innerText = `${point.lng.toFixed(4)}°E, ${point.lat.toFixed(4)}°N`;
      if (wpEleVal) wpEleVal.innerText = `${point.ele} m`;
      if (wpNameInput) {
        wpNameInput.value = point.placeName;
        wpNameInput.focus();
      }
      closeConflictingBottomPanels('waypoint-modal');
      showElement(wpModal, 'flex');
    } else if (action === 'route-start') {
      setRouteStartPoint(map, [point.lng, point.lat], point.placeName);
    } else if (action === 'route-via') {
      addViaPoint(map, [point.lng, point.lat], point.placeName);
    } else if (action === 'route-end') {
      setRouteEndPoint(map, [point.lng, point.lat], point.placeName);
    }
  };

  // 监听地图右键事件与移动端长按触控事件 (展现高质感 Fluent 亚克力交互卡片，完整支持进入与退出物理动效)
  const showContextMenuAtPoint = (lngLat, point, customName = null) => {
    // 地图右键或长按时，立即关闭并移除搜索地点卡片与图钉
    if (typeof window.clearLandingMarker === 'function') {
      window.clearLandingMarker();
    } else if (typeof clearLandingMarker === 'function') {
      clearLandingMarker();
    }

    // 同时关闭已展开的搜索浮窗与搜索面板
    const searchPop = document.getElementById('search-popover');
    if (searchPop && searchPop.style.display !== 'none') {
      if (typeof smoothClosePopover === 'function') {
        smoothClosePopover(searchPop, () => {
          document.getElementById('btn-search-trigger')?.classList.remove('active');
        });
      } else {
        searchPop.style.display = 'none';
        document.getElementById('btn-search-trigger')?.classList.remove('active');
      }
    }

    if (ctxMenu && typeof pendingElementCloses !== 'undefined') {
      pendingElementCloses.delete(ctxMenu);
    }
    const { lng, lat } = lngLat;
    const ele = Math.round(getRealElevation(map, lngLat) || 0);

    // 智能提取所点位置的行政区划或使用传入的精准自定义地名
    const rawLoc = customName || resolveLocationInfo(map, lngLat, point, true);
    const cleanLocation = (rawLoc || '地点')
      .replace(/^中国\s*[·,\-–]\s*/, '')
      .replace(/China\s*[·,\-–]\s*/i, '');

    currentContextPoint = {
      lng,
      lat,
      ele,
      placeName: cleanLocation || '地点'
    };

    if (ctxPlaceName) ctxPlaceName.innerText = currentContextPoint.placeName;
    if (ctxPlaceMeta) ctxPlaceMeta.innerText = '';

    if (ctxMenu) {
      cancelPendingElementClose(ctxMenu);
      ctxMenu.classList.remove('ctx-closing', 'ctx-opening');
      void ctxMenu.offsetWidth;
      const wrap = document.getElementById('map-wrap');
      const maxW = wrap ? wrap.clientWidth - 190 : window.innerWidth - 190;
      const maxH = wrap ? wrap.clientHeight - 220 : window.innerHeight - 220;
      const x = Math.max(12, Math.min(point.x, maxW));
      const y = Math.max(12, Math.min(point.y, maxH));

      ctxMenu.style.left = `${x}px`;
      ctxMenu.style.top = `${y}px`;
      showElement(ctxMenu, 'block');
      ctxMenu.classList.add('ctx-opening');
    }
  };

  // 挂载到 window 供全局及标记点右键调用
  window.showContextMenuForLocation = (lngLat, point, customName = null) => {
    showContextMenuAtPoint(lngLat, point, customName);
  };

  map.on('contextmenu', e => {
    if (e.originalEvent?._outmapHandled) return;
    if (typeof window.clearLandingMarker === 'function') {
      window.clearLandingMarker();
    } else if (typeof clearLandingMarker === 'function') {
      clearLandingMarker();
    }
    if (pickingRoutePt) {
      if (typeof window.exitRoutePickingMode === 'function') {
        window.exitRoutePickingMode();
      }
      return;
    }
    showContextMenuAtPoint(e.lngLat, e.point);
  });

  // 移动端触屏单指长按 520ms 唤起地点交互菜单 (手机无鼠标右键时流畅选点)
  let longPressTimer = null;
  let touchStartPoint = null;

  map.on('touchstart', e => {
    if (e.points && e.points.length > 1) {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
      return;
    }
    touchStartPoint = e.point;
    longPressTimer = setTimeout(() => {
      showContextMenuAtPoint(e.lngLat, e.point);
      longPressTimer = null;
    }, 520);
  });

  map.on('touchmove', e => {
    if (longPressTimer && touchStartPoint) {
      const dist = Math.hypot(e.point.x - touchStartPoint.x, e.point.y - touchStartPoint.y);
      if (dist > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  });

  map.on('touchend', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  // 1. 右键菜单：添加地点到收藏夹 (先播放平滑收起退出动效，再展开目标弹窗)
  btnAddFav?.addEventListener('click', () => {
    hideContextMenu(() => {
      handleContextMenuSelection('add-fav', currentContextPoint);
    });
  });

  // 2. 右键菜单：设为路线起点
  btnRouteStart?.addEventListener('click', () => {
    hideContextMenu(() => {
      handleContextMenuSelection('route-start', currentContextPoint);
    });
  });

  // 3. 右键菜单：添加为路线途径点
  btnRouteVia?.addEventListener('click', () => {
    hideContextMenu(() => {
      handleContextMenuSelection('route-via', currentContextPoint);
    });
  });

  // 4. 右键菜单：设为路线终点
  btnRouteEnd?.addEventListener('click', () => {
    hideContextMenu(() => {
      handleContextMenuSelection('route-end', currentContextPoint);
    });
  });

  // 隐藏右键菜单触发机制 (平滑流体淡出)
  map.on('click', () => hideContextMenu());
  map.on('movestart', () => hideContextMenu());
  document.addEventListener('click', e => {
    if (ctxMenu && !ctxMenu.contains(e.target)) {
      hideContextMenu();
    }
  });
}

// 全局统一键盘快捷键与 ESC 键层级防穿透调度系统 (确保严格按顶层可见窗口依次退出)
function setupGlobalKeyboardDispatcher() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // 0. 地图右键菜单 (最高响应优先级)
      const ctxMenu = document.getElementById('map-context-menu');
      if (ctxMenu && ctxMenu.style.display !== 'none') {
        smoothCloseContextMenu();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 0.05 图层控制面板
      const layersPopover = document.getElementById('layers-popover');
      if (layersPopover && layersPopover.style.display !== 'none') {
        smoothClosePopover(layersPopover, () => {
          document.getElementById('btn-fab-layers')?.classList.remove('active');
        });
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 0.1 浮动路线候选联想框
      const routeDropdown = getRouteFloatingDropdown();
      if (routeDropdown && routeDropdown.style.display !== 'none') {
        hideRouteFloatingDropdown();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 0.5 全局高质感提示弹窗
      const alertOverlay = document.getElementById('fluent-alert-overlay');
      if (alertOverlay && alertOverlay.style.display !== 'none') {
        smoothCloseModal(alertOverlay);
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 0.6 保存路线对话框
      const saveRouteModal = document.getElementById('save-route-modal');
      if (saveRouteModal && saveRouteModal.style.display !== 'none') {
        smoothCloseModal(saveRouteModal);
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 1. 最高优先级：离线下载对话框省份下拉浮层与对话框
      const provDropdownPanel = document.getElementById('pyramid-prov-dropdown-panel');
      if (provDropdownPanel && provDropdownPanel.style.display !== 'none') {
        smoothClosePopover(provDropdownPanel, () => {
          const trigger = document.getElementById('pyramid-prov-dropdown-trigger');
          if (trigger) trigger.classList.remove('active');
        });
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      const pyramidModal = document.getElementById('pyramid-modal');
      if (pyramidModal && pyramidModal.style.display !== 'none') {
        if (window.closePyramidModal) {
          window.closePyramidModal();
        } else {
          smoothCloseModal(pyramidModal, () => {
            const btnDl = document.getElementById('btn-open-pyramid-dl');
            if (btnDl) btnDl.classList.remove('expanded');
          });
        }
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 2. 版本更新提示弹窗
      const updateModal = document.getElementById('update-modal');
      if (updateModal && updateModal.style.display !== 'none') {
        smoothCloseModal(updateModal, () => {
          const btnCancel = document.getElementById('btn-cancel-update');
          const btnClose = document.getElementById('btn-close-update-modal');
          const progressBox = document.getElementById('update-progress-box');
          const btnStart = document.getElementById('btn-start-update');
          if (btnCancel) btnCancel.style.display = '';
          if (btnClose) btnClose.style.display = '';
          if (progressBox) progressBox.style.display = 'none';
          if (btnStart) {
            btnStart.disabled = false;
            btnStart.innerText = '⚡ 立即更新并重启';
          }
        });
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 4. 地标收藏输入弹窗
      const wpModal = document.getElementById('waypoint-modal');
      if (wpModal && wpModal.style.display !== 'none') {
        smoothClosePanel(wpModal);
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 5. 路线规划面板
      const routePanel = document.getElementById('route-panel');
      if (routePanel && routePanel.style.display !== 'none') {
        if (pickingRoutePt) {
          if (typeof window.exitRoutePickingMode === 'function') {
            window.exitRoutePickingMode();
          } else {
            pickingRoutePt = null;
            if (currentOutdoorMap) currentOutdoorMap.getCanvas().style.cursor = '';
            const btnPick = document.getElementById('btn-pick-via-inline');
            const btnAdd = document.getElementById('btn-add-via-inline');
            btnPick?.classList.remove('picking');
            btnAdd?.classList.remove('picking');
            if (btnPick) btnPick.innerHTML = '<span class="pick-icon">📍</span><span class="pick-text">地图选点</span>';
          }
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
        hideRouteFloatingDropdown();
        smoothClosePanel(routePanel);
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 6. 收藏夹抽屉面板
      const favPanel = document.getElementById('favorites-drawer');
      if (favPanel && favPanel.style.display !== 'none') {
        smoothClosePanel(favPanel);
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 7. 全国总览省份拼音展开面板
      const provPopover = document.getElementById('prov-popover-menu');
      if (provPopover && provPopover.style.display !== 'none') {
        smoothClosePopover(provPopover, () => {
          const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
          if (provTriggerBtn) provTriggerBtn.classList.remove('active');
        });
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 3. 云端多设备同步弹窗
      const syncModal = document.getElementById('sync-modal');
      if (syncModal && syncModal.style.display !== 'none') {
        smoothCloseModal(syncModal);
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 0.2 路线导出下拉菜单
      const routeExportMenu = document.getElementById('route-export-menu');
      if (routeExportMenu && routeExportMenu.style.display !== 'none') {
        routeExportMenu.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 8. 搜索框激活或搜索浮动面板打开时 (按 ESC 立即全面退出搜索并清空)
      const sInputGlobal = document.getElementById('global-search-input');
      const searchPopover = document.getElementById('search-popover') || document.getElementById('spotlight-modal');
      const isSearchActive = (searchPopover && searchPopover.style.display !== 'none') ||
                             (sInputGlobal && (document.activeElement === sInputGlobal || sInputGlobal.value.trim()));

      if (isSearchActive) {
        if (sInputGlobal) {
          sInputGlobal.value = '';
          sInputGlobal.blur();
        }
        if (searchPopover && searchPopover.style.display !== 'none') {
          smoothClosePopover(searchPopover);
        }
        const targetLandingMarker = (typeof currentLandingMarker !== 'undefined' && currentLandingMarker) || window.currentLandingMarker;
        if (targetLandingMarker) {
          if (typeof window.clearLandingMarker === 'function') {
            window.clearLandingMarker();
          } else {
            try { targetLandingMarker.remove(); } catch (err) {}
            if (typeof currentLandingMarker !== 'undefined') currentLandingMarker = null;
            window.currentLandingMarker = null;
          }
        }
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 8.5. 顶栏版本翻转卡片
      const brandFlipCard = document.getElementById('brand-flip-card');
      if (brandFlipCard && brandFlipCard.classList.contains('flipped')) {
        brandFlipCard.classList.remove('flipped');
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 8.6. 搜索落地地点标记与卡片 (按 ESC 退出标记)
      const targetLandingMarker = (typeof currentLandingMarker !== 'undefined' && currentLandingMarker) || window.currentLandingMarker;
      if (targetLandingMarker) {
        const markerEl = typeof targetLandingMarker.getElement === 'function' ? targetLandingMarker.getElement() : null;
        const card = markerEl ? markerEl.querySelector('.landing-card') : null;
        if (card) {
          card.classList.add('popover-closing');
          setTimeout(() => {
            if (typeof window.clearLandingMarker === 'function') {
              window.clearLandingMarker();
            } else {
              try { targetLandingMarker.remove(); } catch (e) {}
              if (typeof currentLandingMarker !== 'undefined') currentLandingMarker = null;
              window.currentLandingMarker = null;
            }
          }, 140);
        } else {
          if (typeof window.clearLandingMarker === 'function') {
            window.clearLandingMarker();
          } else {
            try { targetLandingMarker.remove(); } catch (e) {}
            if (typeof currentLandingMarker !== 'undefined') currentLandingMarker = null;
            window.currentLandingMarker = null;
          }
        }
        const sInput = document.getElementById('global-search-input');
        if (sInput) sInput.blur();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true); // 使用捕获阶段 (capture: true) 确保最先响应

  // 去除浏览器原生 tooltip，但不要在每次鼠标移动/冒泡时查询 DOM。
  // 仅在控件真正新增或写入 title 时处理，地图交互路径保持零开销。
  const stripNativeTitles = root => {
    if (root?.nodeType !== Node.ELEMENT_NODE) return;
    if (root.hasAttribute?.('title')) root.removeAttribute('title');
    root.querySelectorAll?.('[title]').forEach(el => el.removeAttribute('title'));
  };
  document.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));
  new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'attributes') stripNativeTitles(record.target);
      else record.addedNodes.forEach(stripNativeTitles);
    });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
}

// 全局统一键盘调度与防穿透系统立即初始化
setupGlobalKeyboardDispatcher();

// 应用程序启动
initApplication();

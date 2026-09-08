/**
 * Outmap 3D GIS - 核心引擎
 * 默认风格：Outmap 自然绿白地势 + 亚米级高清卫星影像 + 全量微观路网/建筑/山峰/POI
 * 整合 Office 365 紧凑一体化顶栏、视角倾角锁定与金字塔多级离线下载系统
 */

// 1. 全国 34 省级行政区中心、地理外包围盒 (用于精确金字塔切片计算) 与三维视点
// 1. 全国 34 省级行政区中心、地理外包围盒 (按首字母拼音 A-Z 严格排序，含港澳台)
const PROVINCES_DATA = {
  china: { name: '全国总览', en: 'ALL CHINA 3D', pinyin: 'Quanguo', pinyinGroup: 'Top', center: [104.5, 34.0], zoom: 4.0, pitch: 50, bbox: [73.5, 135.1, 3.4, 53.6] },
  anhui: { name: '安徽省', en: 'Anhui', pinyin: 'Anhui', pinyinGroup: 'A', center: [117.2, 31.8], zoom: 7.2, pitch: 60, bbox: [114.8, 119.6, 29.7, 34.6] },
  aomen: { name: '澳门特别行政区', en: 'Macao', pinyin: 'Aomen', pinyinGroup: 'A', center: [113.5439, 22.1987], zoom: 11.5, pitch: 55, bbox: [113.52, 113.60, 22.10, 22.22] },
  beijing: { name: '北京市', en: 'Beijing', pinyin: 'Beijing', pinyinGroup: 'B', center: [116.4, 39.9], zoom: 9.2, pitch: 62, bbox: [115.4, 117.5, 39.4, 41.1] },
  chongqing: { name: '重庆市', en: 'Chongqing', pinyin: 'Chongqing', pinyinGroup: 'C', center: [106.5, 29.5], zoom: 8.0, pitch: 62, bbox: [105.3, 110.2, 28.2, 32.2] },
  fujian: { name: '福建省', en: 'Fujian', pinyin: 'Fujian', pinyinGroup: 'F', center: [118.0, 26.0], zoom: 7.2, pitch: 60, bbox: [115.8, 120.7, 23.5, 28.3] },
  gansu: { name: '甘肃省', en: 'Gansu', pinyin: 'Gansu', pinyinGroup: 'G', center: [100.0, 38.0], zoom: 6.2, pitch: 60, bbox: [92.2, 108.7, 32.5, 42.8] },
  guangdong: { name: '广东省', en: 'Guangdong', pinyin: 'Guangdong', pinyinGroup: 'G', center: [113.3, 23.1], zoom: 7.2, pitch: 55, bbox: [109.6, 117.3, 20.2, 25.5] },
  guangxi: { name: '广西壮族自治区', en: 'Guangxi', pinyin: 'Guangxi', pinyinGroup: 'G', center: [108.5, 23.8], zoom: 7.0, pitch: 60, bbox: [104.4, 112.1, 20.9, 26.4] },
  guizhou: { name: '贵州省', en: 'Guizhou', pinyin: 'Guizhou', pinyinGroup: 'G', center: [106.7, 26.8], zoom: 7.2, pitch: 62, bbox: [103.6, 109.6, 24.6, 29.2] },
  hainan: { name: '海南省', en: 'Hainan', pinyin: 'Hainan', pinyinGroup: 'H', center: [109.8, 19.2], zoom: 8.0, pitch: 58, bbox: [108.6, 111.1, 18.1, 20.2] },
  hebei: { name: '河北省', en: 'Hebei', pinyin: 'Hebei', pinyinGroup: 'H', center: [115.0, 38.0], zoom: 7.0, pitch: 58, bbox: [113.4, 119.8, 36.0, 42.6] },
  heilongjiang: { name: '黑龙江省', en: 'Heilongjiang', pinyin: 'Heilongjiang', pinyinGroup: 'H', center: [127.0, 47.0], zoom: 6.0, pitch: 55, bbox: [121.2, 135.1, 43.4, 53.6] },
  henan: { name: '河南省', en: 'Henan', pinyin: 'Henan', pinyinGroup: 'H', center: [113.6, 34.0], zoom: 7.2, pitch: 58, bbox: [110.3, 116.6, 31.4, 36.4] },
  hubei: { name: '湖北省', en: 'Hubei', pinyin: 'Hubei', pinyinGroup: 'H', center: [112.5, 31.0], zoom: 7.2, pitch: 60, bbox: [108.3, 116.1, 29.0, 33.3] },
  hunan: { name: '湖南省', en: 'Hunan', pinyin: 'Hunan', pinyinGroup: 'H', center: [112.0, 27.5], zoom: 7.2, pitch: 60, bbox: [108.8, 114.2, 24.6, 30.1] },
  jilin: { name: '吉林省', en: 'Jilin', pinyin: 'Jilin', pinyinGroup: 'J', center: [126.0, 43.5], zoom: 6.8, pitch: 58, bbox: [121.6, 131.3, 40.8, 46.3] },
  jiangsu: { name: '江苏省', en: 'Jiangsu', pinyin: 'Jiangsu', pinyinGroup: 'J', center: [119.8, 33.0], zoom: 7.2, pitch: 50, bbox: [116.3, 121.9, 30.7, 35.1] },
  jiangxi: { name: '江西省', en: 'Jiangxi', pinyin: 'Jiangxi', pinyinGroup: 'J', center: [115.8, 27.8], zoom: 7.2, pitch: 60, bbox: [113.5, 118.5, 24.5, 30.1] },
  liaoning: { name: '辽宁省', en: 'Liaoning', pinyin: 'Liaoning', pinyinGroup: 'L', center: [123.0, 41.5], zoom: 7.2, pitch: 58, bbox: [118.8, 125.8, 38.7, 43.5] },
  neimenggu: { name: '内蒙古自治区', en: 'Inner Mongolia', pinyin: 'Neimenggu', pinyinGroup: 'N', center: [112.0, 44.0], zoom: 5.5, pitch: 55, bbox: [97.2, 126.1, 37.4, 53.4] },
  ningxia: { name: '宁夏回族自治区', en: 'Ningxia', pinyin: 'Ningxia', pinyinGroup: 'N', center: [106.2, 37.2], zoom: 7.5, pitch: 60, bbox: [104.3, 107.7, 35.2, 39.4] },
  qinghai: { name: '青海省', en: 'Qinghai', pinyin: 'Qinghai', pinyinGroup: 'Q', center: [96.0, 35.5], zoom: 6.2, pitch: 58, bbox: [89.4, 103.1, 31.6, 39.3] },
  shandong: { name: '山东省', en: 'Shandong', pinyin: 'Shandong', pinyinGroup: 'S', center: [117.5, 36.4], zoom: 7.6, pitch: 60, bbox: [114.8, 122.7, 34.3, 38.4] },
  shanxi: { name: '山西省', en: 'Shanxi', pinyin: 'Shanxi', pinyinGroup: 'S', center: [112.5, 37.8], zoom: 7.0, pitch: 60, bbox: [110.2, 114.5, 34.6, 40.7] },
  shaanxi: { name: '陕西省', en: 'Shaanxi', pinyin: 'Shaanxi', pinyinGroup: 'S', center: [108.9, 34.3], zoom: 7.2, pitch: 60, bbox: [105.5, 111.2, 31.7, 39.6] },
  shanghai: { name: '上海市', en: 'Shanghai', pinyin: 'Shanghai', pinyinGroup: 'S', center: [121.5, 31.2], zoom: 10.0, pitch: 50, bbox: [120.8, 122.2, 30.7, 31.9] },
  sichuan: { name: '四川省', en: 'Sichuan', pinyin: 'Sichuan', pinyinGroup: 'S', center: [102.8, 30.5], zoom: 7.2, pitch: 62, bbox: [97.3, 108.5, 26.0, 34.3] },
  taiwan: { name: '台湾省', en: 'Taiwan', pinyin: 'Taiwan', pinyinGroup: 'T', center: [121.0, 23.8], zoom: 8.0, pitch: 65, bbox: [119.9, 122.1, 21.8, 25.4] },
  tianjin: { name: '天津市', en: 'Tianjin', pinyin: 'Tianjin', pinyinGroup: 'T', center: [117.2, 39.1], zoom: 9.5, pitch: 50, bbox: [116.7, 118.1, 38.5, 40.3] },
  xizang: { name: '西藏自治区', en: 'Tibet', pinyin: 'Xizang', pinyinGroup: 'X', center: [88.5, 31.0], zoom: 6.0, pitch: 60, bbox: [78.4, 99.1, 26.8, 36.5] },
  xianggang: { name: '香港特别行政区', en: 'Hong Kong', pinyin: 'Xianggang', pinyinGroup: 'X', center: [114.1654, 22.2753], zoom: 11.0, pitch: 55, bbox: [113.83, 114.44, 22.15, 22.56] },
  xinjiang: { name: '新疆维吾尔自治区', en: 'Xinjiang', pinyin: 'Xinjiang', pinyinGroup: 'X', center: [85.0, 41.5], zoom: 5.8, pitch: 58, bbox: [73.5, 96.4, 34.3, 49.2] },
  yunnan: { name: '云南省', en: 'Yunnan', pinyin: 'Yunnan', pinyinGroup: 'Y', center: [101.5, 25.0], zoom: 7.0, pitch: 62, bbox: [97.5, 106.2, 21.1, 29.2] },
  zhejiang: { name: '浙江省', en: 'Zhejiang', pinyin: 'Zhejiang', pinyinGroup: 'Z', center: [120.2, 29.2], zoom: 7.5, pitch: 60, bbox: [118.0, 123.0, 27.0, 31.3] }
};

// 2. 重点地标城市与著名乡镇
const MAJOR_CITIES = [
  { name: '北京市', en: 'Beijing', coords: [116.4074, 39.9042] },
  { name: '上海市', en: 'Shanghai', coords: [121.4737, 31.2304] },
  { name: '济南市', en: 'Jinan', coords: [117.0009, 36.6758] },
  { name: '青岛市', en: 'Qingdao', coords: [120.3826, 36.0671] },
  { name: '泰安市', en: 'Taian', coords: [117.1290, 36.1949] },
  { name: '成都市', en: 'Chengdu', coords: [104.0668, 30.5728] },
  { name: '新安镇', en: 'Xin\'an', coords: [102.7241, 30.3120] },
  { name: '四姑娘山镇', en: 'Siguniangshan', coords: [102.8360, 30.9980] },
  { name: '康定市', en: 'Kangding', coords: [101.9647, 30.0489] },
  { name: '重庆市', en: 'Chongqing', coords: [106.5516, 29.5630] },
  { name: '拉萨市', en: 'Lhasa', coords: [91.1172, 29.6469] },
  { name: '昆明市', en: 'Kunming', coords: [102.8329, 24.8801] },
  { name: '丽江市', en: 'Lijiang', coords: [100.2330, 26.8721] },
  { name: '西安市', en: 'Xian', coords: [108.9402, 34.3416] },
  { name: '乌鲁木齐市', en: 'Urumqi', coords: [87.6177, 43.7928] },
  { name: '西宁市', en: 'Xining', coords: [101.7789, 36.6231] },
  { name: '兰州市', en: 'Lanzhou', coords: [103.8343, 36.0611] },
  { name: '武汉市', en: 'Wuhan', coords: [114.3055, 30.5928] },
  { name: '广州市', en: 'Guangzhou', coords: [113.2644, 23.1291] },
  { name: '台北市', en: 'Taipei', coords: [121.5654, 25.0330] }
];

// 3. 著名山峰 POI (全国著名山脉高峰)
const MOUNTAIN_POIS = [
  { name: '泰山 · 玉皇顶', ele: 1545, coords: [117.1042, 36.2519] },
  { name: '华山 · 南峰落雁', ele: 2154, coords: [110.0820, 34.4780] },
  { name: '四姑娘山 · 幺妹峰', ele: 6250, coords: [102.9020, 31.1060] },
  { name: '贡嘎山 · 蜀山之王', ele: 7556, coords: [101.8780, 29.5960] },
  { name: '珠穆朗玛峰 · 世界之巅', ele: 8848, coords: [86.9250, 27.9880] },
  { name: '冈仁波齐 · 万山之祖', ele: 6638, coords: [81.3120, 31.0670] },
  { name: '玉龙雪山 · 扇子陡', ele: 5596, coords: [100.1780, 27.0980] },
  { name: '梅里雪山 · 卡瓦格博', ele: 6740, coords: [98.6920, 28.4420] },
  { name: '黄山 · 莲花峰', ele: 1864, coords: [118.1750, 30.1330] },
  { name: '峨眉山 · 万佛顶', ele: 3099, coords: [103.3320, 29.5210] },
  { name: '长白山 · 白云峰', ele: 2691, coords: [128.0580, 41.9930] },
  { name: '祁连山 · 团结峰', ele: 5808, coords: [97.5830, 38.5000] },
  { name: '神农架 · 神农顶', ele: 3106, coords: [110.3000, 31.4500] },
  { name: '五台山 · 北台叶斗峰', ele: 3061, coords: [113.5900, 39.0600] },
  { name: '崂山 · 巨峰', ele: 1132, coords: [120.6120, 36.1750] }
];

let mapInstance = null;
let currentExaggeration = 2.0;
let currentStyle = 'outmap';
let is3DView = true;
let isPitchLocked = true;
let updatePitchLockFn = null;

let provinceMarkers = [];
let cityMarkers = [];
let mountainMarkers = [];
let localServerPort = 28795;

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

// 智能双向合并算法 (本地与云端求并集，确保双方新加的数据均不丢失)
function mergeWaypoints(localList = [], cloudList = []) {
  const map = new Map();
  (cloudList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${(item.coords || []).join(',')}`;
    map.set(key, item);
  });
  (localList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${(item.coords || []).join(',')}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function mergeRoutes(localList = [], cloudList = []) {
  const map = new Map();
  (cloudList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${item.distance}`;
    map.set(key, item);
  });
  (localList || []).forEach(item => {
    if (!item) return;
    const key = item.id || `${item.name}_${item.distance}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function mergeFolders(localList = [], cloudList = []) {
  const set = new Set();
  const res = [];
  [...(cloudList || []), ...(localList || [])].forEach(f => {
    const val = typeof f === 'string' ? f : (f && f.name);
    if (val && !set.has(val)) {
      set.add(val);
      res.push(f);
    }
  });
  return res;
}

async function initApplication() {
  let port = 28795;
  let totalOfflineCount = 0;
  let totalOfflineBytes = 0;

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

    try {
      await syncOfflineManifest();
    } catch (e) {}

    // 启动时静默检查并智能双向合并 R2 云端漫游数据
    try {
      if (window.electronAPI && window.electronAPI.pullCloudSyncData) {
        let syncKey = 'default';
        if (window.electronAPI.getCloudSyncConfig) {
          const syncCfg = await window.electronAPI.getCloudSyncConfig();
          if (syncCfg) {
            if (syncCfg.autoSync === false) syncKey = null; // 用户关闭了自动漫游
            else if (syncCfg.syncKey) syncKey = syncCfg.syncKey;
          }
        }
        if (syncKey) {
          const syncRes = await window.electronAPI.pullCloudSyncData({ syncKey });
          if (syncRes && syncRes.success && syncRes.data) {
            const d = syncRes.data;
            const localFavs = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
            const localRoutes = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
            const localFolders = JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]');

            const mergedFavs = mergeWaypoints(localFavs, d.favorites);
            const mergedRoutes = mergeRoutes(localRoutes, d.routes);
            const mergedFolders = mergeFolders(localFolders, d.folders);

            localStorage.setItem('outmap_saved_waypoints', JSON.stringify(mergedFavs));
            localStorage.setItem('outmap_saved_routes', JSON.stringify(mergedRoutes));
            localStorage.setItem('outmap_custom_folders', JSON.stringify(mergedFolders));

            if (d.settings && d.settings.pitchLocked !== undefined) {
              localStorage.setItem('outmap_pitch_locked', d.settings.pitchLocked ? '1' : '0');
              if (d.settings.lockedPitchVal) {
                localStorage.setItem('outmap_locked_pitch_val', String(d.settings.lockedPitchVal));
              }
            }
            console.log('[CloudSync] 启动自动双向合并云端漫游数据成功');
          }
        }
      }
    } catch (e) {}
  }

  const isWebMode = !window.electronAPI;
  if (isWebMode) {
    document.body.classList.add('web-mode');
  }

  const titleStat = document.getElementById('titlebar-cache-stat');
  if (titleStat) {
    if (isWebMode) {
      titleStat.innerText = '在线云端直连';
      titleStat.title = '在线拉取瓦片模式 (无需本地服务器，直接由 CDN 极速分发)';
    } else {
      titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
      titleStat.title = `本地已缓存离线切片: ${totalOfflineCount.toLocaleString()} 块${totalOfflineBytes ? ` · 占用空间: ${formatBytes(totalOfflineBytes)}` : ''} (点击可重新校准磁盘)`;

      titleStat.addEventListener('click', async () => {
        titleStat.innerText = '离线: 扫描中...';
        try {
          if (window.electronAPI && window.electronAPI.rescanOfflineTiles) {
            const stats = await window.electronAPI.rescanOfflineTiles();
            if (stats) {
              totalOfflineCount = stats.totalTiles || 0;
              totalOfflineBytes = stats.totalBytes || 0;
              titleStat.innerText = `离线: ${formatTileDisplay(totalOfflineCount, totalOfflineBytes)}`;
              titleStat.title = `本地已缓存离线切片: ${totalOfflineCount.toLocaleString()} 块 · 占用空间: ${formatBytes(totalOfflineBytes)} (点击可重新校准磁盘)`;
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
    chinaBoundaryUrl = './china-boundary.json';

    // 默认高可用全球免 Key 在线 CDN (OpenFreeMap + Mapterhorn Terrarium DEM)
    // 零服务器依赖，全球 300+ 边缘节点毫秒级直连，任何设备浏览器开箱即用
    const onlineDem = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
    const onlineVec = 'https://tiles.openfreemap.org/planet/20260830_080001_pt/{z}/{x}/{y}.pbf';
    const onlineGlyphs = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

    demUrl = onlineDem;
    vecUrl = onlineVec;
    glyphsUrl = onlineGlyphs;

    // 清除旧版本误存的前端域名自定义瓦片源配置
    if (localStorage.getItem('outmap_custom_tile_api') === 'https://map.053999.xyz') {
      localStorage.removeItem('outmap_custom_tile_api');
    }

    // 若用户显式配置了独立的自建瓦片服务后端，且该后端不等于当前前端页面域名
    const userCustomTileApi = localStorage.getItem('outmap_custom_tile_api');
    if (userCustomTileApi && !userCustomTileApi.includes(window.location.hostname)) {
      try {
        const cleanApi = userCustomTileApi.replace(/\/+$/, '');
        const probe = await fetch(`${cleanApi}/vector/0/0/0.pbf`, { method: 'HEAD', signal: AbortSignal.timeout(1500) }).catch(() => null);
        if (probe && probe.ok) {
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

  // 1. 核心并发渲染调优：为核显与主渲染线程保留核心余量，消除平移卡顿与输入延迟
  maplibregl.workerCount = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 2));

  // 初始化 DEM 高程数据源 (工作站模式：扩大高程网格缓存至 5000 片，反复缩放平移零延迟)
  const demSource = new mlcontour.DemSource({
    url: demUrl,
    encoding: 'terrarium',
    maxzoom: 12,
    worker: true,
    cacheSize: 5000,
    timeoutMs: 12000
  });
  demSource.setupMaplibre(maplibregl);

  // 2. 初始化 MapLibre 地图实例 (工作站模式：扩大 GPU 显存纹理池至 4000 片，杜绝白块)
  mapInstance = new maplibregl.Map({
    container: 'map',
    center: [104.5000, 34.0000],
    zoom: 4.0,
    pitch: 50,
    bearing: 0,
    minZoom: 3.5, // 缩放最多只能看到中国全境，防止无意义过度缩放看到整颗地球
    maxBounds: [[65.0, 0.0], [145.0, 58.0]], // 中国疆域地理范围边界约束，防止平移跑飞到境外与两极
    maxPitch: 85,
    fadeDuration: 0, // 彻底消除跨层级缩放时的 300ms 标签淡入淡出闪烁
    localIdeographFontFamily: 'Microsoft YaHei, "PingFang SC", "Noto Sans CJK SC", sans-serif', // 本地系统字体瞬时光栅化，零延迟零丢字零闪烁
    attributionControl: false,
    renderWorldCopies: false, // 禁用经度环绕复制，削减 50% 无效 Draw Call
    maxTileCacheSize: 4000,   // 解锁 GPU 显存纹理缓存容量至 4000 片
    style: {
      version: 8,
      glyphs: glyphsUrl,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#e8eee4'
          }
        }
      ]
    }
  });

  const map = mapInstance;
  window.mapInstance = map;
  if (typeof map.setPrefetchZoomDelta === 'function') {
    map.setPrefetchZoomDelta(2); // 缩放时双向预加载 2 个层级的高程与纹理网格
  }

  map.on('load', () => {
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

    // DEM高程图立体光照阴影渲染
    map.addLayer({
      id: 'hillshade-layer',
      type: 'hillshade',
      source: 'terrain-dem',
      paint: {
        'hillshade-exaggeration': 0.85,
        'hillshade-highlight-color': '#fdfefb',
        'hillshade-shadow-color': '#4a5c4e',
        'hillshade-accent-color': '#dce5d8'
      }
    });

    // 全量矢量地理要素源
    map.addSource('osm-vector-source', {
      type: 'vector',
      tiles: [vecUrl],
      maxzoom: 14
    });

    // 居住区/小区/住宅区与商业文教功能用地轮廓
    map.addLayer({
      id: 'osm-landuse-residential',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['residential', 'suburb'], true, false],
      paint: {
        'fill-color': '#f1f5f9',
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
        'fill-color': '#f8fafc',
        'fill-opacity': 0.35
      }
    });

    // 森林植被
    map.addLayer({
      id: 'osm-forest-layer',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['wood', 'forest', 'scrub', 'grass'], true, false],
      paint: {
        'fill-color': '#34d399',
        'fill-opacity': 0.16
      }
    });

    // 湖泊水库 (OSM矢量清澈天蓝)
    map.addLayer({
      id: 'osm-water-layer',
      type: 'fill',
      source: 'osm-vector-source',
      'source-layer': 'water',
      paint: {
        'fill-color': '#38bdf8',
        'fill-opacity': 0.88
      }
    });

    // 河流水系 (OSM矢量深湛蓝)
    map.addLayer({
      id: 'osm-waterway-layer',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#0284c7',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 2.0, 14, 3.5],
        'line-opacity': 0.85
      }
    });

    // 湖泊、水库大水系名称注记
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
        'text-color': '#0369a1',
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
        'text-color': '#0284c7',
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
        'line-color': '#94a3b8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 8, 1.4, 12, 1.8],
        'line-dasharray': [4, 2],
        'line-opacity': 0.75
      }
    });

    // 2. 底图切片全球国界底层纯白轮廓 (消除锯齿，赋予微观立体感)
    map.addLayer({
      id: 'osm-boundary-country-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 2],
      minzoom: 3,
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 6, 3.8, 10, 5.5],
        'line-opacity': 0.75
      }
    });

    // 3. 底图切片全球国界主线 (微观视口下，沿江沿脊严格贴合，0 偏差)
    map.addLayer({
      id: 'osm-boundary-country',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 2],
      minzoom: 3,
      paint: {
        'line-color': '#7f1d1d',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2.0, 10, 3.2],
        'line-dasharray': [6, 2.5, 2, 2.5],
        'line-opacity': 0.85
      }
    });

    // 4. 中国国家法定标准陆地国界 - 柔白高对比底衬
    map.addLayer({
      id: 'china-boundary-national-casing',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'boundary'],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 5, 4.0, 9, 5.8],
        'line-opacity': 0.88
      }
    });

    // 5. 中国国家法定标准陆地国界 - 权威朱红主线 (自然资源部标准色)
    map.addLayer({
      id: 'china-boundary-national-line',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'boundary'],
      paint: {
        'line-color': '#991b1b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 5, 2.4, 9, 3.6],
        'line-opacity': 0.95
      }
    });

    // 6. 中国南海诸岛十段线 - 柔白底衬
    map.addLayer({
      id: 'china-boundary-ten-dash-casing',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'ten_dash_line'],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3.0, 5, 4.8, 9, 6.5],
        'line-opacity': 0.9
      }
    });

    // 7. 中国南海诸岛十段线 - 权威规范断续线
    map.addLayer({
      id: 'china-boundary-ten-dash-line',
      type: 'line',
      source: 'china-boundary-source',
      filter: ['==', ['get', 'type'], 'ten_dash_line'],
      paint: {
        'line-color': '#991b1b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.8, 5, 3.0, 9, 4.2],
        'line-opacity': 1.0
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
        'line-color': '#65a30d',
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
        'text-color': '#4d7c0f',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    });

    // 微观路网体系
    map.addLayer({
      id: 'osm-minor-roads-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor', 'service', 'residential', 'unclassified'], true, false],
      paint: {
        'line-color': '#9eabb9',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 11, 2.6, 14, 4.8],
        'line-opacity': 0.85
      }
    });

    map.addLayer({
      id: 'osm-minor-roads-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor', 'service', 'residential', 'unclassified'], true, false],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 11, 1.8, 14, 3.4],
        'line-opacity': 0.95
      }
    });

    map.addLayer({
      id: 'osm-highway-casing',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.0, 10, 4.2, 14, 7.5],
        'line-opacity': 0.9
      }
    });

    map.addLayer({
      id: 'osm-highway-core',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
      paint: {
        'line-color': '#f97316',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 10, 2.6, 14, 5.2],
        'line-opacity': 1.0
      }
    });

    map.addLayer({
      id: 'osm-trails-layer',
      type: 'line',
      source: 'osm-vector-source',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['path', 'track', 'footway', 'pedestrian', 'steps'], true, false],
      paint: {
        'line-color': '#e74c3c',
        'line-width': 2.0,
        'line-dasharray': [2, 1],
        'line-opacity': 0.9
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

    // 17. 3D 建筑白模立体高度
    map.addLayer({
      id: 'osm-buildings-3d',
      type: 'fill-extrusion',
      source: 'osm-vector-source',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': '#e2e8f0',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.75
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

    // 适配屏幕分辨率并确保三维地图精确居中
    map.resize();
    window.addEventListener('resize', () => map.resize());
  });

  setupOfficeHeaderInteractions(map);
  setupWaypointAndFavoritesSystem(map);
  setupOutdoorRouteSystem(map);
  setupMapContextMenu(map);
}

function renderAllMapLabels(map) {
  // 遵循自然标准地图渲染规范：所有省份行政区划、名山地貌与城镇注记均由底层矢量切片按缩放层级原生展现
  // 彻底移除覆盖在最上层的自定义人工省份与名山 DOM 浮动遮挡物，还原纯净地图界面
  [provinceMarkers, cityMarkers, mountainMarkers].forEach(arr => {
    arr.forEach(m => m.remove());
    arr.length = 0;
  });
}

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
      btnLockPitch.title = locked ? '视角倾角已锁定（点击解锁倾角高度）' : '锁定视角倾角高度（锁定后右键仅水平旋转）';
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
      const currentPitch = targetPitch !== null ? targetPitch : Math.round(map.getPitch() || 50);
      try {
        localStorage.setItem('outmap_locked_pitch_val', String(currentPitch));
      } catch (e) {}
      map.setMinPitch(currentPitch);
      map.setMaxPitch(currentPitch);
      if (statusPitchLock) statusPitchLock.innerText = `[高度锁定 ${currentPitch}° · 右键仅水平旋转]`;
    } else {
      map.setMinPitch(0);
      map.setMaxPitch(85);
      if (statusPitchLock) statusPitchLock.innerText = '';
    }

    if (typeof window.triggerRealtimeCloudSync === 'function') {
      window.triggerRealtimeCloudSync('pitch_lock_changed');
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
  if (btn3D) {
    btn3D.classList.add('active');
    btn3D.addEventListener('click', () => {
      is3DView = !is3DView;
      btn3D.classList.toggle('active', is3DView);
      btn3D.title = is3DView ? '3D 立体模式（点击切换为 2D）' : '2D 平面模式（点击切换为 3D）';
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
        // 2D 切到 3D 视图：视角 50 度锁定！
        map.setMinPitch(0);
        map.setMaxPitch(85);
        map.easeTo({ pitch: 50, duration: 800 });
        setTimeout(() => updatePitchLockState(true, 50), 820);
      } else {
        // 切到 2D 视图：解除锁定并平俯至 0 度
        if (isPitchLocked) {
          updatePitchLockState(false);
        }
        map.easeTo({ pitch: 0, duration: 800 });
      }
    });
  }

  // 校准正北
  const btnNorth = document.getElementById('btn-reset-north');
  if (btnNorth) {
    btnNorth.addEventListener('click', () => {
      map.easeTo({ bearing: 0, duration: 800 });
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
  const toggleMobileElevationSheet = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const sheet = document.getElementById('mobile-ele-sheet');
    if (!sheet) return;
    const isHidden = sheet.style.display === 'none' || !sheet.classList.contains('active');
    if (isHidden) {
      sheet.style.display = 'flex';
      sheet.classList.add('active');
      setExaggerationValue(currentExaggeration);
    } else {
      sheet.style.display = 'none';
      sheet.classList.remove('active');
    }
  };

  const sliderGroupEl = document.getElementById('header-slider-group') || document.querySelector('.office-slider-group');
  if (sliderGroupEl) {
    sliderGroupEl.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        toggleMobileElevationSheet(e);
      }
    });
    sliderGroupEl.addEventListener('touchend', (e) => {
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
    btn.addEventListener('touchend', handlePreset);
  });

  const handleCloseMobileEle = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (mobileEleSheet) {
      mobileEleSheet.style.display = 'none';
      mobileEleSheet.classList.remove('active');
    }
  };
  btnCloseMobileEle?.addEventListener('click', handleCloseMobileEle);
  btnCloseMobileEle?.addEventListener('touchend', handleCloseMobileEle);

  // 点击地图或空白区域自动收起已展开的底部抽屉与弹窗 (改善手机端易点空白收起的体验)
  map.on('click', () => {
    if (pickingRoutePt || isContinuousPicking) return;
    const toClose = [
      document.getElementById('route-panel'),
      document.getElementById('favorites-drawer'),
      document.getElementById('mobile-ele-sheet'),
      document.getElementById('waypoint-modal'),
      document.getElementById('save-route-modal'),
      document.getElementById('map-context-menu'),
      document.getElementById('prov-popover-menu'),
      document.getElementById('search-popover')
    ];
    toClose.forEach(el => {
      if (el && el.style.display !== 'none') {
        el.style.display = 'none';
        el.classList.remove('active');
      }
    });
    const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
    if (provTriggerBtn) provTriggerBtn.classList.remove('active');
  });

  // 3. 点击展开的全局搜索交互系统 (中国境内严格过滤、搜索历史持久化、支持经纬度/小区/名山/城市全量POI检索与回车直达)
  const searchTrigger = document.getElementById('btn-search-trigger');
  const searchPopover = document.getElementById('search-popover');
  const searchClose = document.getElementById('btn-close-search');
  const sInput = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('search-results-list');

  let currentSearchResults = [];
  let searchDebounceTimer = null;
  let activeSearchAbort = null;
  let currentLandingMarker = null;

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

  function renderSearchHistory() {
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
      row.innerHTML = `
        <div class="search-result-icon">${item.icon || '⏱️'}</div>
        <div class="search-result-info">
          <div class="search-result-name">${item.name}</div>
          <div class="search-result-desc">${item.desc || '历史搜索地点'}</div>
        </div>
      `;
      row.addEventListener('click', () => {
        executeJumpToResult(item);
      });
      resultsContainer.appendChild(row);
    });

    resultsContainer.style.display = 'block';
  }

  function showLandingMarker(coords, title) {
    if (currentLandingMarker) {
      currentLandingMarker.remove();
      currentLandingMarker = null;
    }
    const el = document.createElement('div');
    el.className = 'landing-pulse-marker';
    el.innerHTML = `
      <div class="pulse-ring"></div>
      <div class="pulse-core">📍</div>
      <div class="pulse-label">${title}</div>
    `;
    currentLandingMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(coords)
      .addTo(map);

    setTimeout(() => {
      if (currentLandingMarker) {
        currentLandingMarker.remove();
        currentLandingMarker = null;
      }
    }, 7000);
  }

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

  function renderSearchResults(items) {
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
      row.innerHTML = `
        <div class="search-result-icon">${item.icon || '📍'}</div>
        <div class="search-result-info">
          <div class="search-result-name">${item.name}</div>
          <div class="search-result-desc">${item.desc || ''}</div>
        </div>
      `;

      row.addEventListener('click', () => {
        executeJumpToResult(item);
      });

      resultsContainer.appendChild(row);
    });

    resultsContainer.style.display = 'block';
  }

  function executeJumpToResult(item) {
    if (searchPopover) searchPopover.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (sInput) sInput.value = item.name;

    saveSearchHistoryItem(item);

    // 若搜索结果是省份，同步顶栏省份标签
    Object.keys(PROVINCES_DATA).forEach(k => {
      if (PROVINCES_DATA[k].name === item.name) {
        updateProvDropdownLabel(k);
      }
    });

    const targetZoom = item.zoom || (item.type === 'community' ? 15.5 : (item.type === 'mountain' ? 13.8 : 12.5));
    map.flyTo({
      center: item.coords,
      zoom: targetZoom,
      pitch: isPitchLocked ? map.getPitch() : 62,
      duration: 2200
    });

    showLandingMarker(item.coords, item.name);
  }

  // 综合检索引擎：本地字典 + 在线高精地理编码 (严格仅限中国境内数据，坚决剔除一切外国地点)
  async function queryLocationCandidates(keyword) {
    const q = keyword.trim();
    if (!q) {
      return [];
    }

    const coordMatch = parseCoordinates(q);
    if (coordMatch) {
      return [{
        name: coordMatch.title,
        desc: 'GPS 经纬度绝对坐标',
        coords: coordMatch.coords,
        icon: '🎯',
        zoom: 15.0
      }];
    }

    const localMatches = [];

    // 1. 省份匹配
    Object.keys(PROVINCES_DATA).forEach(k => {
      const p = PROVINCES_DATA[k];
      if (p.name.includes(q) || (p.en && p.en.toLowerCase().includes(q.toLowerCase())) || (p.pinyin && p.pinyin.toLowerCase().includes(q.toLowerCase()))) {
        localMatches.push({
          name: p.name,
          desc: '行政区划 · ' + (p.en || p.name),
          coords: p.center,
          icon: '🚩',
          zoom: p.zoom
        });
      }
    });

    // 2. 名山匹配
    MOUNTAIN_POIS.forEach(m => {
      if (m.name.includes(q)) {
        localMatches.push({
          name: m.name,
          desc: `著名山峰 · 海拔 ${m.ele}米`,
          coords: m.coords,
          icon: '🏔️',
          type: 'mountain',
          zoom: 13.8
        });
      }
    });

    // 3. 重点城市匹配
    MAJOR_CITIES.forEach(c => {
      if (c.name.includes(q) || c.en.toLowerCase().includes(q.toLowerCase())) {
        localMatches.push({
          name: c.name,
          desc: '重点地标城市 · ' + c.en,
          coords: c.coords,
          icon: '🏙️',
          type: 'city',
          zoom: 12.0
        });
      }
    });

    // 4. 在线全量 OSM Photon 地理编码检索 (限定中国境内 BBox: [73.5, 18.0, 135.1, 53.6]，全量覆盖小区、商场、学校、道路、村落)
    if (activeSearchAbort) activeSearchAbort.abort();
    activeSearchAbort = new AbortController();

    try {
      const onlineUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=73.5,18.0,135.1,53.6&limit=15`;
      const resp = await fetch(onlineUrl, {
        signal: activeSearchAbort.signal,
        headers: { 'User-Agent': 'Outmap/1.0' }
      });

      if (resp.ok) {
        const geojson = await resp.json();
        if (geojson && geojson.features) {
          geojson.features.forEach(f => {
            const p = f.properties;
            const coords = f.geometry.coordinates;
            if (!coords || coords.length < 2) return;

            // 严密双重校验：经纬度中国境内包围盒 + 国家代码校验 (严防国外近似地名渗入)
            const inChinaBbox = coords[0] >= 73.0 && coords[0] <= 136.0 && coords[1] >= 18.0 && coords[1] <= 54.0;
            const isCountryCn = !p.countrycode || p.countrycode.toUpperCase() === 'CN' || p.country === 'China' || p.country === '中国';
            if (!inChinaBbox || !isCountryCn) return;

            const name = p.name || p.street || p.city || q;
            const parts = [p.country, p.state, p.city, p.district, p.locality].filter(Boolean);
            const desc = parts.join(' · ') || (p.type ? `OSM ${p.type}` : '');

            let icon = '📍';
            let type = 'poi';
            const osmValue = (p.osm_value || '').toLowerCase();
            const osmKey = (p.osm_key || '').toLowerCase();

            if (osmValue.includes('residential') || osmValue.includes('housing') || osmValue.includes('suburb') || osmValue.includes('quarter') || name.includes('小区') || name.includes('家园') || name.includes('花园') || name.includes('苑')) {
              icon = '🏘️';
              type = 'community';
            } else if (osmValue.includes('mountain') || osmValue.includes('peak')) {
              icon = '🏔️';
              type = 'mountain';
            } else if (osmValue.includes('school') || osmValue.includes('university') || osmValue.includes('college')) {
              icon = '🏫';
            } else if (osmValue.includes('hospital') || osmValue.includes('clinic')) {
              icon = '🏥';
            } else if (osmValue.includes('city') || osmValue.includes('town')) {
              icon = '🏙️';
            }

            // 避免完全相同名称的重复项
            if (!localMatches.some(m => m.name === name && Math.abs(m.coords[0] - coords[0]) < 0.005)) {
              localMatches.push({
                name,
                desc,
                coords,
                icon,
                type,
                zoom: type === 'community' ? 15.5 : 14.0
              });
            }
          });
        }
      }
    } catch (e) {
      // 离线环境平滑回退
    }

    return localMatches.slice(0, 10);
  }

  // 搜索输入交互 (输入文字实时防抖检索；清空或聚焦时展示搜索历史)
  if (sInput) {
    sInput.addEventListener('input', () => {
      const val = sInput.value.trim();
      clearTimeout(searchDebounceTimer);
      if (!val) {
        renderSearchHistory();
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        const results = await queryLocationCandidates(val);
        renderSearchResults(results);
      }, 240);
    });

    sInput.addEventListener('focus', () => {
      if (!sInput.value.trim()) {
        renderSearchHistory();
      }
    });

    sInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
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
    if (currentSearchResults && currentSearchResults.length > 0) {
      executeJumpToResult(currentSearchResults[0]);
      return;
    }

    // 2. 实时现场检索匹配并直达
    const results = await queryLocationCandidates(text);
    if (results && results.length > 0) {
      executeJumpToResult(results[0]);
    } else {
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="search-empty-tip">未检索到“${text}”，请检查地名拼写或直接输入经纬度坐标</div>`;
        resultsContainer.style.display = 'block';
      }
    }
  };

  const closeSearchPopover = () => {
    if (searchPopover && searchPopover.style.display !== 'none') {
      searchPopover.style.display = 'none';
      if (sInput) sInput.blur();
    }
  };

  if (searchTrigger && searchPopover) {
    searchTrigger.addEventListener('click', e => {
      e.stopPropagation();
      const isHidden = searchPopover.style.display === 'none';
      if (isHidden) {
        const provPopover = document.getElementById('prov-popover-menu');
        if (provPopover) provPopover.style.display = 'none';
        const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
        if (provTriggerBtn) provTriggerBtn.classList.remove('active');
      }
      searchPopover.style.display = isHidden ? 'block' : 'none';
      if (isHidden && sInput) {
        sInput.focus();
        sInput.select();
        if (sInput.value.trim()) {
          queryLocationCandidates(sInput.value.trim()).then(renderSearchResults);
        } else {
          renderSearchHistory();
        }
      }
    });

    const handleCloseSearch = (e) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      closeSearchPopover();
    };
    searchClose?.addEventListener('click', handleCloseSearch);
    searchClose?.addEventListener('touchend', handleCloseSearch);

    document.addEventListener('click', e => {
      if (!searchPopover.contains(e.target) && e.target !== searchTrigger && !searchTrigger.contains(e.target)) {
        closeSearchPopover();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearchPopover();
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
  }

  // 快捷键 Ctrl+K / Cmd+K 快速呼出搜索
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchPopover) {
        searchPopover.style.display = 'block';
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

  // 8. 全局统一键盘快捷键与 ESC 键层级防穿透调度
  setupGlobalKeyboardDispatcher();

  setupStatusBar(map);
}

// 本地已下载离线省份包持久化记录 (双重持久化：优先同步磁盘 manifest.json，兼容 localStorage)
let offlineProvCache = null;

async function syncOfflineManifest() {
  if (window.electronAPI && window.electronAPI.getOfflineManifest) {
    try {
      const manifest = await window.electronAPI.getOfflineManifest();
      if (manifest && manifest.provinces) {
        offlineProvCache = manifest.provinces;
        try { localStorage.setItem('outmap_offline_provinces', JSON.stringify(offlineProvCache)); } catch (e) {}
        return offlineProvCache;
      }
    } catch (e) {}
  }
  return getOfflineProvState();
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
  state[key] = {
    ...prev,
    ...details,
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
      btn.title = `快速跳转至 [${letter}] 开头的省份`;
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

    // 1. 置顶“全国总览”大胶囊
    const allChinaBtn = document.createElement('div');
    allChinaBtn.className = 'prov-all-china-btn';
    allChinaBtn.innerHTML = `
      <span class="p-name">🇨🇳 全国总览</span>
      <span class="p-tag">45° 3D 视角</span>
    `;
    allChinaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateProvDropdownLabel('china');
      provPopover.style.display = 'none';
      provTriggerBtn.classList.remove('active');
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
          ${isOffline ? '<span class="prov-offline-dot" title="离线数据包已就绪"></span>' : ''}
        `;

        pBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          updateProvDropdownLabel(p.key);
          provPopover.style.display = 'none';
          provTriggerBtn.classList.remove('active');
          flyToProvince(map, p.key);
        });

        grid.appendChild(pBtn);
      });

      sec.appendChild(grid);
      provMenuList.appendChild(sec);
    });
  };

  renderListContent();

  // 点击触发按钮展开/收起
  provTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = provPopover.style.display === 'none';
    if (isHidden) {
      const searchPopover = document.getElementById('search-popover');
      if (searchPopover) searchPopover.style.display = 'none';
      renderListContent(); // 重新检查是否有新下载完成的省份并刷新勾选
    }
    provPopover.style.display = isHidden ? 'flex' : 'none';
    provTriggerBtn.classList.toggle('active', isHidden);
  });

  // 关闭按钮点击收起
  const btnCloseProv = document.getElementById('btn-close-prov-menu');
  const handleCloseProv = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  };
  btnCloseProv?.addEventListener('click', handleCloseProv);
  btnCloseProv?.addEventListener('touchend', handleCloseProv);

  // 点击空白处收起
  document.addEventListener('click', (e) => {
    if (!provPopover.contains(e.target) && !provTriggerBtn.contains(e.target)) {
      provPopover.style.display = 'none';
      provTriggerBtn.classList.remove('active');
    }
  });

  map.on('mousedown', () => {
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  });
  map.on('click', () => {
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  });
  map.on('dragstart', () => {
    provPopover.style.display = 'none';
    provTriggerBtn.classList.remove('active');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      provPopover.style.display = 'none';
      provTriggerBtn.classList.remove('active');
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
  const btnDone = document.getElementById('btn-done-dl');
  const progressBox = document.getElementById('dl-progress-box');
  const progressFill = document.getElementById('dl-progress-fill');
  const progressNum = document.getElementById('dl-progress-num');
  const progressSpeed = document.getElementById('dl-progress-speed');
  const progressPct = document.getElementById('dl-progress-pct');

  if (!modal || !btnOpen) return;

  const dlBlueDot = document.getElementById('dl-live-blue-dot');
  let downloadDotState = 'idle'; // 'idle' (无标注) | 'downloading' (正在下载，蓝点) | 'completed' (下载完成，绿点)

  const updateBtnTooltip = () => {
    const isExpanded = btnOpen.classList.contains('expanded');
    if (downloadDotState === 'downloading') {
      btnOpen.title = isExpanded
        ? '离线地图下载 (后台正在下载... 点击收起)'
        : '离线地图下载 (后台正在下载... 点击展开)';
    } else if (downloadDotState === 'completed') {
      btnOpen.title = isExpanded
        ? '离线地图下载 (全部已就绪 · 点击收起)'
        : '离线地图下载 (全部已就绪 · 点击展开查看)';
    } else {
      btnOpen.title = isExpanded
        ? '离线地图下载 (点击收起)'
        : '离线地图下载 (点击展开)';
    }
  };

  const setDownloadDotState = (state) => {
    downloadDotState = state;
    if (!dlBlueDot) return;
    if (state === 'downloading') {
      dlBlueDot.style.display = 'block';
      dlBlueDot.classList.remove('completed');
      dlBlueDot.title = '后台正在下载离线瓦片...';
    } else if (state === 'completed') {
      dlBlueDot.style.display = 'block';
      dlBlueDot.classList.add('completed');
      dlBlueDot.title = '离线瓦片已全部下载完成';
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
    modal.style.display = 'none';
    btnOpen.classList.remove('expanded');
    updateBtnTooltip();
  };

  const openPyramidModal = async () => {
    const provPopover = document.getElementById('prov-popover-menu');
    if (provPopover) provPopover.style.display = 'none';
    const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
    if (provTriggerBtn) provTriggerBtn.classList.remove('active');

    const searchPopover = document.getElementById('search-popover');
    if (searchPopover) searchPopover.style.display = 'none';

    toggleDropdown(false);

    btnOpen.classList.add('expanded');
    updateBtnTooltip();

    await syncOfflineManifest();
    renderProvinceGrid();
    updateEstimation();
    modal.style.display = 'flex';
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
    if (counterBadge) {
      if (keys.length === totalCount) {
        counterBadge.innerText = `全选 (${keys.length} 省)`;
      } else {
        counterBadge.innerText = `已选 ${keys.length} 省`;
      }
    }
    if (dropdownSummary) {
      if (keys.length === 0) {
        dropdownSummary.innerText = '请点击展开选择目标省份...';
        dropdownSummary.style.color = '#94a3b8';
      } else if (keys.length === totalCount) {
        dropdownSummary.innerText = '全国 34 个省/直辖市/自治区 (已全选)';
        dropdownSummary.style.color = '#1e293b';
      } else {
        const names = keys.map(k => PROVINCES_DATA[k]?.name || k).filter(Boolean);
        if (names.length <= 4) {
          dropdownSummary.innerText = names.join('、');
        } else {
          dropdownSummary.innerText = `${names.slice(0, 3).join('、')} 等 ${names.length} 个省份`;
        }
        dropdownSummary.style.color = '#1e293b';
      }
    }
  };

  // 渲染全国省份网格 (去除字母前缀，已就绪带发光绿点并默认勾选)
  const renderProvinceGrid = () => {
    if (!multiGrid) return;
    multiGrid.innerHTML = '';
    const offlineState = getOfflineProvState();

    // 按拼音排序省份 (排除 china)
    const sortedKeys = Object.keys(PROVINCES_DATA)
      .filter(k => k !== 'china')
      .sort((a, b) => {
        const pa = PROVINCES_DATA[a];
        const pb = PROVINCES_DATA[b];
        return (pa.pinyin || pa.name).localeCompare(pb.pinyin || pb.name, 'zh-Hans-CN');
      });

    sortedKeys.forEach(k => {
      const p = PROVINCES_DATA[k];
      const saved = offlineState[k];
      const isReady = saved && saved.maxZ >= 10;

      const label = document.createElement('label');
      label.className = `prov-chip-item${isReady ? ' ready checked' : ''}`;
      label.dataset.key = k;

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = k;
      chk.checked = !!isReady; // 已全部下载就绪的省份默认勾选

      chk.addEventListener('change', () => {
        label.classList.toggle('checked', chk.checked);
        updateCounter();
        updateEstimation();
      });

      label.appendChild(chk);

      const spanName = document.createElement('span');
      spanName.className = 'prov-chip-name';
      spanName.innerText = p.name; // 不带字母前缀
      label.appendChild(spanName);

      const spanDot = document.createElement('span');
      spanDot.className = 'prov-chip-dot';
      spanDot.title = '该省份基础离线包已就绪';
      label.appendChild(spanDot);

      multiGrid.appendChild(label);
    });

    // 如果没有任何已就绪省份，默认勾选山东省
    const checked = multiGrid.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) {
      const sdItem = multiGrid.querySelector('input[value="shandong"]');
      if (sdItem) {
        sdItem.checked = true;
        sdItem.closest('.prov-chip-item')?.classList.add('checked');
      }
    }

    updateCounter();
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

    // 1. 刷新各个层级卡片中的纯正翠绿微光圆点 ● (若已选省份全部在该层级已就绪，显示翠绿发光点)
    [10, 11, 12, 13, 14].forEach(z => {
      const dot = document.getElementById(`zoom-dot-${z}`);
      if (dot) {
        const isReadyForZ = selectedKeys.length > 0 && selectedKeys.every(k => {
          const s = offlineState[k];
          return s && (s.maxZ || 0) >= z;
        });
        dot.classList.toggle('ready', isReadyForZ);
      }
    });

    if (selectedKeys.length === 0) {
      statCount.innerText = '未选择省份';
      statSize.innerText = '0 MB';
      if (provStatusTag) provStatusTag.style.display = 'none';
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

    selectedKeys.forEach(k => {
      const prov = PROVINCES_DATA[k];
      if (!prov || !prov.bbox) return;
      const saved = offlineState[k];
      const savedMaxZ = saved ? (saved.maxZ || 0) : 0;
      if (savedMaxZ > 0) hasAnySaved = true;
      if (savedMaxZ < minSavedZ) minSavedZ = savedMaxZ;

      if (savedMaxZ < maxZ) {
        allReady = false;
        const [minLon, maxLon, minLat, maxLat] = prov.bbox;
        const startZ = savedMaxZ > 0 ? savedMaxZ + 1 : 0;
        for (let z = startZ; z <= maxZ; z++) {
          const n = 1 << z;
          const x1 = Math.max(0, Math.floor((minLon + 180) / 360 * n));
          const x2 = Math.min(n - 1, Math.floor((maxLon + 180) / 360 * n));
          const latRad1 = Math.min(85.0511, maxLat) * Math.PI / 180;
          const latRad2 = Math.max(-85.0511, minLat) * Math.PI / 180;
          const y1 = Math.max(0, Math.floor((1 - Math.log(Math.tan(latRad1) + 1 / Math.cos(latRad1)) / Math.PI) / 2 * n));
          const y2 = Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2 * n));
          totalIncrementalTiles += (x2 - x1 + 1) * (y2 - y1 + 1);
        }
      }
    });

    let multiplier = 0;
    if (chkDem.checked) multiplier += 1;
    if (chkVec.checked) multiplier += 1;
    if (multiplier === 0) multiplier = 1;

    const totalTiles = totalIncrementalTiles * multiplier;

    if (allReady) {
      statCount.innerText = '已全部就绪';
      statSize.innerText = '0 MB';
      if (provStatusTag) {
        provStatusTag.style.display = 'inline-flex';
        provStatusTag.innerHTML = '<span class="downloaded-dot">●</span> 已全部就绪';
      }
      btnStart.style.display = 'none';
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
        if (hasAnySaved && minSavedZ > 0) {
          provStatusTag.innerHTML = `<span class="downloaded-dot">●</span> 已下载 L1-L${minSavedZ}，将扩至 L${maxZ}`;
        } else {
          provStatusTag.innerHTML = `<span class="downloaded-dot">●</span> 将下载至 L${maxZ}`;
        }
      }

      btnStart.style.display = 'inline-block';
      btnStart.disabled = false;
      btnStart.innerText = hasAnySaved ? `扩充下载 (至 L${maxZ})` : `开始下载 (至 L${maxZ})`;
      if (btnRetry) btnRetry.style.display = 'none';
      if (btnDone) btnDone.style.display = 'none';
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

  // 触发多省批量下载任务 (isVerify 为 true 时极速本地校验，false 时增量免重下载)
  const triggerDownload = async (isVerify = false) => {
    const selectedKeys = getSelectedKeys();
    if (selectedKeys.length === 0) return;

    const provinces = selectedKeys.map(k => {
      const p = PROVINCES_DATA[k];
      return { key: k, name: p.name, bbox: p.bbox };
    });

    const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;

    setDownloadDotState('downloading');
    btnStart.style.display = 'none';
    btnCancel.style.display = 'inline-block';
    if (btnRetry) btnRetry.style.display = 'none';
    if (btnDone) btnDone.style.display = 'none';
    progressBox.style.display = 'flex';
    progressFill.style.width = '0%';
    progressNum.innerText = isVerify ? '正在高速校验本地已缓存切片...' : '正在准备批量免重下载通道...';

    if (window.electronAPI && window.electronAPI.startPyramidDownload) {
      try {
        await window.electronAPI.startPyramidDownload({
          provinces,
          minZ: 0,
          maxZ,
          downloadDem: chkDem.checked,
          downloadVec: chkVec.checked,
          isVerify
        });
      } catch (err) {
        setDownloadDotState('idle');
        progressNum.innerText = `下载遇到异常: ${err.message}`;
      }
    }
  };

  btnStart.addEventListener('click', () => triggerDownload(false));
  btnRetry?.addEventListener('click', () => triggerDownload(true));

  // 中止下载
  btnCancel.addEventListener('click', async () => {
    setDownloadDotState('idle');
    if (window.electronAPI && window.electronAPI.cancelPyramidDownload) {
      await window.electronAPI.cancelPyramidDownload();
    }
    btnStart.style.display = 'inline-block';
    btnStart.disabled = false;
    btnStart.innerText = '开始下载';
    btnCancel.style.display = 'none';
    if (btnRetry) btnRetry.style.display = 'none';
    progressNum.innerText = '已中止下载';
  });

  // 监听后台批量下载进度广播与完成落盘
  if (window.electronAPI && window.electronAPI.onDownloadProgress) {
    window.electronAPI.onDownloadProgress(data => {
      progressFill.style.width = `${data.percent}%`;
      const maxZ = parseInt(zoomInput ? zoomInput.value : '10') || 10;
      const countPart = `${formatTileCount(data.completed)} / ${formatTileCount(data.total)}`;

      if (data.isVerify) {
        progressNum.innerText = `校验中: ${countPart}`;
      } else {
        progressNum.innerText = `正在下载至 L${maxZ} (${countPart})`;
      }
      progressSpeed.innerText = `速度: ${data.speed} 片/秒`;
      progressPct.innerText = `${data.percent}%`;

      if (!data.done && downloadDotState !== 'downloading') {
        setDownloadDotState('downloading');
      }

      // 关键：下载过程中实时联动刷新顶栏切片数与磁盘体积！
      const titleStat = document.getElementById('titlebar-cache-stat');
      if (titleStat && data.totalTiles) {
        titleStat.innerText = `离线: ${formatTileDisplay(data.totalTiles, data.totalBytes)}`;
        titleStat.title = `本地已缓存离线切片: ${data.totalTiles.toLocaleString()} 块 (下载中实时更新)`;
      }

      if (data.done) {
        setDownloadDotState('completed');
        const selectedKeys = getSelectedKeys();
        selectedKeys.forEach(k => {
          saveOfflineProvState(k, maxZ, { dem: chkDem.checked, vec: chkVec.checked });
        });

        btnStart.style.display = 'none';
        btnCancel.style.display = 'none';
        if (btnDone) btnDone.style.display = 'inline-block';
        if (btnRetry) btnRetry.style.display = 'inline-block';

        if (provStatusTag) {
          provStatusTag.style.display = 'inline-flex';
          provStatusTag.innerHTML = '<span class="downloaded-dot">●</span> 全部图层已就绪';
        }

        renderProvinceGrid();
        updateEstimation();

        // 刷新顶栏切片真实总数与体积
        if (titleStat) {
          const totalVal = data.totalTiles || data.savedCount || data.completed;
          titleStat.innerText = `离线: ${formatTileDisplay(totalVal, data.totalBytes)}`;
          titleStat.title = `本地已缓存离线切片总数: ${totalVal.toLocaleString()} 块${data.totalBytes ? ` · 占用磁盘: ${formatBytes(data.totalBytes)}` : ''} (点击可重新校准磁盘)`;
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

  // 左键点击 Logo 区域触发原地 3D 翻转微交互
  brandBtn.addEventListener('click', async (e) => {
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

    let currentVer = '1.2.8';
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
        backupUrl: pendingUpdate.backupUrl
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

/// 全局实时云端漫游同步引擎 (支持标记增删改、路线保存与删除、视角与配置变动的后台秒级自动持久化到 R2)
let cloudSyncDebounceTimer = null;

async function triggerRealtimeCloudSync(reason = 'change') {
  if (!window.electronAPI || !window.electronAPI.uploadCloudSyncData) return;

  clearTimeout(cloudSyncDebounceTimer);
  cloudSyncDebounceTimer = setTimeout(async () => {
    try {
      let syncKey = 'default';
      if (window.electronAPI.getCloudSyncConfig) {
        const cfg = await window.electronAPI.getCloudSyncConfig();
        if (cfg) {
          if (cfg.autoSync === false) return; // 自动漫游已关闭
          if (cfg.syncKey) syncKey = cfg.syncKey.trim();
        }
      }

      const payload = {
        syncKey: syncKey || 'default',
        data: {
          version: '1.2.8',
          syncedAt: new Date().toISOString(),
          favorites: JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]'),
          folders: JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]'),
          routes: JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]'),
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

      const res = await window.electronAPI.uploadCloudSyncData(payload);
      if (res && res.success) {
        console.log(`[CloudSync] 实时自动同步成功 (${reason})`);
        const statusText = document.getElementById('sync-status-text');
        if (statusText) {
          const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
          statusText.innerText = `上次同步: ${nowStr}`;
        }
      }
    } catch (e) {
      console.warn('[CloudSync] 实时自动同步后台提示:', e.message);
    }
  }, 1200);
}
window.triggerRealtimeCloudSync = triggerRealtimeCloudSync;

// 多设备云端漫游同步系统 (右键 Logo 呼出)
function setupCloudSync(map) {
  const brandBtn = document.getElementById('header-brand-logo-btn');
  const syncModal = document.getElementById('sync-modal');
  const btnClose = document.getElementById('btn-close-sync-modal');
  const btnCloseBtn = document.getElementById('btn-close-sync-btn');
  const keyInput = document.getElementById('sync-account-key');
  const chkAutoSync = document.getElementById('chk-auto-sync-toggle');
  const chkFav = document.getElementById('chk-sync-favorites');
  const chkRoutes = document.getElementById('chk-sync-routes');
  const chkViews = document.getElementById('chk-sync-views');
  const statusIndicator = document.getElementById('sync-status-indicator');
  const statusText = document.getElementById('sync-status-text');
  const btnSyncNow = document.getElementById('btn-do-sync-now');

  if (!brandBtn || !syncModal) return;

  const showStatus = (msg, isErr = false) => {
    if (!statusText) return;
    statusText.innerHTML = msg;
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

  // 监听地图视口停止拖动/平移，实时自动同步当前中心点与仰角
  map.on('moveend', () => {
    triggerRealtimeCloudSync('view_changed');
  });

  // 执行双向智能合并同步
  const doBidirectionalSync = async () => {
    let key = (keyInput ? keyInput.value : 'default').trim() || 'default';

    showStatus('正在同步...');
    if (btnSyncNow) btnSyncNow.disabled = true;

    try {
      // 1. 先从云端拉取数据
      let cloudData = null;
      if (window.electronAPI && window.electronAPI.pullCloudSyncData) {
        const pullRes = await window.electronAPI.pullCloudSyncData({ syncKey: key });
        if (pullRes && pullRes.success && pullRes.data) {
          cloudData = pullRes.data;
        }
      }

      // 2. 读取本地数据
      const localFavs = JSON.parse(localStorage.getItem('outmap_saved_waypoints') || '[]');
      const localRoutes = JSON.parse(localStorage.getItem('outmap_saved_routes') || '[]');
      const localFolders = JSON.parse(localStorage.getItem('outmap_custom_folders') || '[]');

      // 3. 智能双向求并集合并 (Merge: 双方新数据均保留)
      const mergedFavs = (chkFav && chkFav.checked && cloudData) ? mergeWaypoints(localFavs, cloudData.favorites) : localFavs;
      const mergedRoutes = (chkRoutes && chkRoutes.checked && cloudData) ? mergeRoutes(localRoutes, cloudData.routes) : localRoutes;
      const mergedFolders = cloudData ? mergeFolders(localFolders, cloudData.folders) : localFolders;

      // 4. 写回本地并刷新界面标记与列表
      localStorage.setItem('outmap_saved_waypoints', JSON.stringify(mergedFavs));
      localStorage.setItem('outmap_saved_routes', JSON.stringify(mergedRoutes));
      localStorage.setItem('outmap_custom_folders', JSON.stringify(mergedFolders));

      if (chkViews && chkViews.checked && cloudData && cloudData.views && cloudData.views.center) {
        map.flyTo({
          center: cloudData.views.center,
          zoom: cloudData.views.zoom || 4.0,
          pitch: cloudData.views.pitch || 50,
          bearing: cloudData.views.bearing || 0
        });
      }

      window.dispatchEvent(new Event('storage'));

      // 5. 将合并后的最新全量数据推送回云端
      const payload = {
        syncKey: key,
        data: {
          version: '1.2.10',
          syncedAt: new Date().toISOString(),
          favorites: mergedFavs,
          folders: mergedFolders,
          routes: mergedRoutes,
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

      if (window.electronAPI && window.electronAPI.uploadCloudSyncData) {
        const upRes = await window.electronAPI.uploadCloudSyncData(payload);
        if (!upRes || !upRes.success) {
          throw new Error(upRes?.message || '上传云端失败');
        }
      }

      const nowTime = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      if (window.electronAPI && window.electronAPI.saveCloudSyncConfig) {
        await window.electronAPI.saveCloudSyncConfig({
          syncKey: key,
          autoSync: chkAutoSync ? chkAutoSync.checked : true,
          lastSyncTime: nowTime
        });
      }

      showStatus(`同步完成 (${nowTime})`);
    } catch (err) {
      showStatus(`同步失败: ${err.message}`, true);
    } finally {
      if (btnSyncNow) btnSyncNow.disabled = false;
    }
  };

  btnSyncNow?.addEventListener('click', doBidirectionalSync);

  // 自动同步开关切换
  chkAutoSync?.addEventListener('change', async () => {
    const isAuto = chkAutoSync.checked;
    const key = (keyInput ? keyInput.value : 'default').trim() || 'default';
    if (window.electronAPI && window.electronAPI.saveCloudSyncConfig) {
      await window.electronAPI.saveCloudSyncConfig({ syncKey: key, autoSync: isAuto });
    }
    if (isAuto) {
      showStatus('已开启');
      triggerRealtimeCloudSync('switch_on');
    } else {
      showStatus('已暂停');
    }
  });

  // 右键 Logo 呼出云同步面板
  brandBtn.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    let lastTime = '';
    if (window.electronAPI && window.electronAPI.getCloudSyncConfig) {
      try {
        const cfg = await window.electronAPI.getCloudSyncConfig();
        if (cfg) {
          if (keyInput) keyInput.value = cfg.syncKey || 'default';
          if (chkAutoSync) chkAutoSync.checked = cfg.autoSync !== false;
          if (cfg.lastSyncTime) lastTime = cfg.lastSyncTime;
        }
      } catch (err) {}
    }

    if (chkAutoSync && chkAutoSync.checked) {
      showStatus(lastTime ? `上次同步: ${lastTime}` : '就绪');
    } else {
      showStatus('已暂停');
    }

    syncModal.style.display = 'flex';
  });

  const closeSync = () => {
    syncModal.style.display = 'none';
  };

  btnClose?.addEventListener('click', closeSync);
  btnCloseBtn?.addEventListener('click', closeSync);

  syncModal.addEventListener('click', (e) => {
    if (e.target === syncModal) {
      closeSync();
    }
  });
}

function flyToProvince(map, key) {
  const prov = PROVINCES_DATA[key];
  if (!prov) return;
  const targetPitch = key === 'china' ? 50 : (isPitchLocked ? map.getPitch() : prov.pitch);
  map.flyTo({
    center: prov.center,
    zoom: prov.zoom,
    pitch: targetPitch,
    bearing: 0,
    duration: 2200
  });
  if (key === 'china') {
    setTimeout(() => {
      if (typeof updatePitchLockFn === 'function') {
        updatePitchLockFn(true, 50);
      }
    }, 2250);
  }
  const regionEl = document.getElementById('status-region');
  if (regionEl) {
    if (key === 'china') {
      regionEl.innerText = '区域: 中国';
    } else {
      regionEl.innerText = `区域: 中国 · ${prov.name}`;
    }
  }
}



// 重点地级市/省会/自治州地理范围 (用于状态栏精确反查“省·市·县”)
const CHINA_DIVISIONS = [
  // 四川
  { prov: '四川省', city: '成都市', bbox: [102.9, 104.9, 30.0, 31.5] },
  { prov: '四川省', city: '阿坝藏族羌族自治州', bbox: [100.5, 104.4, 30.5, 34.3] },
  { prov: '四川省', city: '甘孜藏族自治州', bbox: [97.3, 102.5, 27.9, 33.1] },
  { prov: '四川省', city: '凉山彝族自治州', bbox: [100.0, 103.9, 26.0, 29.5] },
  { prov: '四川省', city: '绵阳市', bbox: [103.7, 105.7, 30.7, 33.0] },
  { prov: '四川省', city: '乐山市', bbox: [102.8, 104.3, 28.8, 29.9] },
  { prov: '四川省', city: '雅安市', bbox: [102.1, 103.3, 29.4, 30.9] },
  // 山东
  { prov: '山东省', city: '济南市', bbox: [116.1, 117.7, 36.0, 37.5] },
  { prov: '山东省', city: '青岛市', bbox: [119.5, 121.2, 35.5, 37.2] },
  { prov: '山东省', city: '泰安市', bbox: [116.3, 117.9, 35.6, 36.5] },
  { prov: '山东省', city: '烟台市', bbox: [119.5, 122.0, 36.5, 38.4] },
  { prov: '山东省', city: '潍坊市', bbox: [118.1, 120.2, 35.7, 37.4] },
  { prov: '山东省', city: '临沂市', bbox: [117.4, 119.2, 34.4, 36.2] },
  { prov: '山东省', city: '威海市', bbox: [121.6, 122.7, 36.6, 37.6] },
  // 西藏
  { prov: '西藏自治区', city: '拉萨市', bbox: [89.7, 92.6, 29.2, 31.0] },
  { prov: '西藏自治区', city: '日喀则市', bbox: [82.0, 90.3, 27.5, 31.8] },
  { prov: '西藏自治区', city: '林芝市', bbox: [92.1, 98.9, 26.8, 30.7] },
  { prov: '西藏自治区', city: '昌都市', bbox: [95.5, 99.1, 28.5, 32.7] },
  { prov: '西藏自治区', city: '阿里地区', bbox: [78.4, 86.5, 30.0, 36.0] },
  // 云南
  { prov: '云南省', city: '昆明市', bbox: [102.1, 103.7, 24.3, 26.5] },
  { prov: '云南省', city: '丽江市', bbox: [99.3, 101.5, 25.9, 27.9] },
  { prov: '云南省', city: '大理白族自治州', bbox: [98.8, 101.3, 24.6, 26.7] },
  { prov: '云南省', city: '迪庆藏族自治州', bbox: [98.5, 100.3, 26.9, 29.2] },
  // 新疆
  { prov: '新疆维吾尔自治区', city: '乌鲁木齐市', bbox: [86.6, 88.9, 42.7, 44.3] },
  { prov: '新疆维吾尔自治区', city: '阿勒泰地区', bbox: [85.5, 91.1, 45.0, 49.2] },
  { prov: '新疆维吾尔自治区', city: '喀什地区', bbox: [73.5, 80.0, 35.4, 40.3] },
  { prov: '新疆维吾尔自治区', city: '伊犁哈萨克自治州', bbox: [80.1, 85.0, 42.2, 45.0] },
  // 陕西
  { prov: '陕西省', city: '西安市', bbox: [107.6, 109.8, 33.6, 34.8] },
  { prov: '陕西省', city: '延安市', bbox: [107.6, 110.5, 35.3, 37.5] },
  { prov: '陕西省', city: '汉中市', bbox: [105.5, 108.3, 32.4, 34.0] },
  // 直辖市
  { prov: '北京市', city: '北京市', bbox: [115.4, 117.5, 39.4, 41.1] },
  { prov: '上海市', city: '上海市', bbox: [120.8, 122.2, 30.7, 31.9] },
  { prov: '重庆市', city: '重庆市', bbox: [105.3, 110.2, 28.2, 32.2] },
  { prov: '天津市', city: '天津市', bbox: [116.7, 118.1, 38.5, 40.3] },
  // 东南沿海
  { prov: '浙江省', city: '杭州市', bbox: [118.3, 120.7, 29.1, 30.6] },
  { prov: '广东省', city: '广州市', bbox: [112.9, 114.1, 22.4, 23.9] },
  { prov: '广东省', city: '深圳市', bbox: [113.7, 114.7, 22.4, 22.9] }
];

// 智能解算当前坐标所属的“市 · 县/区/镇”或完整行政区划 (支持仅显示市、县两级)
function resolveLocationInfo(map, lngLat, point, onlyCityCounty = false) {
  const zoom = map.getZoom();
  if (zoom < 5.0) {
    return onlyCityCounty ? '地点' : '区域: 中国';
  }

  const { lng, lat } = lngLat;
  let foundProv = '';
  let foundCity = '';

  // 1. 空间包围盒优先匹配市州
  for (let i = 0; i < CHINA_DIVISIONS.length; i++) {
    const div = CHINA_DIVISIONS[i];
    const [x1, x2, y1, y2] = div.bbox;
    if (lng >= x1 && lng <= x2 && lat >= y1 && lat <= y2) {
      foundProv = div.prov;
      foundCity = div.city;
      break;
    }
  }

  // 2. 若未精准落入重点市州范围，则匹配 34 省份地理包围盒
  if (!foundProv) {
    const keys = Object.keys(PROVINCES_DATA);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === 'china') continue;
      const p = PROVINCES_DATA[k];
      const [x1, x2, y1, y2] = p.bbox;
      if (lng >= x1 && lng <= x2 && lat >= y1 && lat <= y2) {
        foundProv = p.name;
        break;
      }
    }
  }

  if (!foundProv && !foundCity) {
    return onlyCityCounty ? '地点' : '区域: 中国';
  }

  // 3. 从矢量图层探查光标所在微观县/区/镇/著名山峰
  let microFeature = '';
  if (point) {
    try {
      const bbox = [[point.x - 35, point.y - 35], [point.x + 35, point.y + 35]];
      const feats = map.queryRenderedFeatures(bbox, {
        layers: ['osm-places-towns', 'osm-places-villages', 'osm-places-cities', 'osm-mountain-peaks', 'osm-outdoor-scenic-pois']
      });
      if (feats && feats.length > 0) {
        for (let i = 0; i < feats.length; i++) {
          const f = feats[i];
          const name = f.properties['name:zh'] || f.properties.name_zh || f.properties.name;
          if (name && name !== foundCity && name !== foundProv) {
            microFeature = name;
            break;
          }
        }
      }
    } catch (e) {}
  }

  // 仅显示市、县两级 (例如：延安市 · 延长县, 北京市 · 朝阳区)
  if (onlyCityCounty) {
    if (foundCity && microFeature) {
      return `${foundCity} · ${microFeature}`;
    } else if (foundCity) {
      return foundCity;
    } else if (foundProv && microFeature) {
      return `${foundProv} · ${microFeature}`;
    } else if (microFeature) {
      return microFeature;
    } else {
      return foundProv || '地点';
    }
  }

  if (foundCity && microFeature) {
    return `区域: 中国 · ${foundProv} · ${foundCity} · ${microFeature}`;
  } else if (foundCity) {
    return `区域: 中国 · ${foundProv} · ${foundCity}`;
  } else if (microFeature) {
    return `区域: 中国 · ${foundProv} · ${microFeature}`;
  } else {
    return `区域: 中国 · ${foundProv}`;
  }
}

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

  map.on('mousemove', e => {
    latestMouseEvt = e;
    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
      rafPending = false;
      if (!latestMouseEvt) return;
      const ev = latestMouseEvt;
      if (sCoords) sCoords.innerText = `坐标: ${ev.lngLat.lng.toFixed(4)}°E, ${ev.lngLat.lat.toFixed(4)}°N`;

      // 地图处于拖拽平移/缩放动画时跳过耗时的 GPU 高程读取与要素探测，彻底消除平移掉帧卡顿
      if (map.isMoving && map.isMoving()) return;

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

      // 节流实时反查并更新“省 · 市 · 县/镇/峰”
      const now = performance.now();
      if (now - lastResolveTime > 250 && sRegion) {
        lastResolveTime = now;
        sRegion.innerText = resolveLocationInfo(map, ev.lngLat, ev.point);
      }
    });
  });

  map.on('move', () => {
    if (sPitch) sPitch.innerText = `俯仰: ${Math.round(map.getPitch())}°`;
    if (sBearing) sBearing.innerText = `航向: ${Math.round(map.getBearing())}°`;
    if (sZoom) sZoom.innerText = `层级: ${map.getZoom().toFixed(1)}`;
  });

  let fc = 0;
  let lt = performance.now();
  function loop() {
    fc++;
    const now = performance.now();
    if (now - lt >= 1000) {
      const fps = Math.round((fc * 1000) / (now - lt));
      const el = document.getElementById('status-fps');
      if (el) el.innerText = `${fps} FPS`;
      fc = 0;
      lt = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// =========================================================
// 选点与收藏夹管理系统 (Waypoint & Favorites)
// =========================================================
let savedWaypoints = [];
let savedRoutes = []; // 本地持久化收藏路线列表
let currentPlannedRouteCoords = []; // 当前规划的完整经纬度坐标
let currentRouteMetrics = null; // 当前规划的核心指标 (距离、爬升等)
let renderSavedRoutesListFn = null;
let waypointMarkers = [];
let customFolders = []; // 用户持久化自定义收藏夹分类
let isPickingPoint = false;
let tempPickedPoint = null;

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

  // 渲染已有标记点到地图 (按要求已移除险段，保留4种户外核心类型)
  const renderWaypointMarkersOnMap = () => {
    waypointMarkers.forEach(m => m.remove());
    waypointMarkers = [];

    const iconMap = {
      camp: '🏕️',
      view: '🏔️',
      water: '💧',
      supply: '⛽'
    };

    savedWaypoints.forEach(wp => {
      const el = document.createElement('div');
      el.className = 'custom-waypoint-marker';
      el.style.cssText = `
        background: #ffffff;
        border: 2px solid #0284c7;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        box-shadow: 0 3px 8px rgba(0,0,0,0.25);
        cursor: pointer;
        transition: transform 0.15s ease;
      `;
      el.innerText = iconMap[wp.type] || '📍';
      el.title = `${wp.name} (${wp.ele}m)`;

      el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.25)');
      el.addEventListener('mouseleave', () => el.style.transform = 'scale(1.0)');
      el.addEventListener('click', () => {
        map.flyTo({ center: [wp.lng, wp.lat], zoom: 14.5, pitch: 65, duration: 1500 });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);

      waypointMarkers.push(marker);
    });
  };

  renderWaypointMarkersOnMap();

  // 点击选点按钮进入/退出选点状态
  if (btnFabPoint) {
    btnFabPoint.addEventListener('click', () => {
      isPickingPoint = !isPickingPoint;
      btnFabPoint.classList.toggle('active', isPickingPoint);
      map.getCanvas().style.cursor = isPickingPoint ? 'crosshair' : '';
      if (isPickingPoint) {
        if (wpModal) wpModal.style.display = 'none';
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
    if (wpModal) wpModal.style.display = 'flex';
  });

  // 4类地标类型胶囊单选
  let selectedType = 'camp';
  document.querySelectorAll('#wp-type-group .type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#wp-type-group .type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedType = pill.getAttribute('data-type');
    });
  });

  // 保存标记点
  const closeWpModal = () => {
    if (wpModal) wpModal.style.display = 'none';
    if (newFolderInline) newFolderInline.style.display = 'none';
    tempPickedPoint = null;
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

    renderWaypointMarkersOnMap();
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
  const renderFavoritesList = () => {
    if (!favList) return;
    favList.innerHTML = '';
    if (favPtsCount) favPtsCount.innerText = savedWaypoints.length;

    const filtered = currentFolderFilter === 'all'
      ? savedWaypoints
      : savedWaypoints.filter(w => w.folder === currentFolderFilter);

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
        <button class="fav-item-del" title="删除该收藏">🗑️</button>
      `;

      item.querySelector('.fav-item-info').addEventListener('click', () => {
        map.flyTo({ center: [wp.lng, wp.lat], zoom: 14.2, pitch: 65, duration: 1600 });
      });

      item.querySelector('.fav-item-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`确定删除收藏点“${wp.name}”？`)) {
          savedWaypoints = savedWaypoints.filter(w => w.id !== wp.id);
          try {
            localStorage.setItem('outmap_saved_waypoints', JSON.stringify(savedWaypoints));
          } catch (err) {}
          renderWaypointMarkersOnMap();
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

      card.innerHTML = `
        <div class="fav-route-header">
          <div class="fav-route-title-box">
            <span class="fav-route-mode-tag">${modeNames[route.mode] || '🛣️ 路线'}</span>
            <span class="fav-route-name" title="${route.name}">${route.name}</span>
          </div>
          <span class="fav-route-date">${route.createdAt || ''}</span>
        </div>
        <div class="fav-route-stats">
          <span>📏 ${distStr}</span>
          ${timeStr ? `<span>${timeStr}</span>` : ''}
          ${climbStr ? `<span>${climbStr}</span>` : ''}
          <span>📍 ${viaText}</span>
        </div>
        <div class="fav-route-actions">
          <button class="fav-route-btn primary btn-recall-route" title="在地图上调出并完整呈现该路线及三维高程剖面">⚡ 调出路线</button>
          <button class="fav-route-btn gpx btn-gpx-route" title="导出为标准 GPX 轨迹文件供手机/手持GPS使用">📥 导出GPX</button>
          <button class="fav-route-btn del btn-del-route" title="删除该路线">🗑️ 删除</button>
        </div>
      `;

      // 调出路线
      card.querySelector('.btn-recall-route').addEventListener('click', (e) => {
        e.stopPropagation();
        loadSavedRoute(route.id, map);
      });

      // 导出 GPX
      card.querySelector('.btn-gpx-route').addEventListener('click', (e) => {
        e.stopPropagation();
        exportRouteToGpx(route, map);
      });

      // 删除路线
      card.querySelector('.btn-del-route').addEventListener('click', (e) => {
        e.stopPropagation();
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
      { id: 'default', name: '⭐ 默认' },
      { id: 'camp', name: '⛺ 露营' },
      { id: 'hiking', name: '🥾 徒步' }
    ];
    customFolders.forEach(f => {
      tabs.push({ id: f.id, name: `📁 ${f.name}` });
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
    favDrawer.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      renderFolderTabs();
      renderFavoritesList();
      renderSavedRoutesList();
    }
  });

  btnCloseFav?.addEventListener('click', () => {
    favDrawer.style.display = 'none';
  });
}

// =========================================================
// 户外多途径点路线规划与三维海拔高程剖面系统 (Multi-Waypoint Route Engine)
// =========================================================
let routeStartCoord = null;
let routeStartName = '';
let routeStartMarker = null;

let routeEndCoord = null;
let routeEndName = '';
let routeEndMarker = null;

let routeViaPoints = []; // 存储途径点数组 [{ id, coords, name, marker }]
let isContinuousPicking = false; // 连续拾点模式开关
let pickingRoutePt = null; // 'start' | 'end' | 'via' | null
let activeRouteMode = 'drive'; // 'drive' | 'cycle' | 'hike'
let profileCursorMarker = null;
let currentProfileData = [];

// 计算两坐标之间大圆球面距离 (km)
function calculateDistanceKm(c1, c2) {
  const rad = Math.PI / 180;
  const dLat = (c2[1] - c1[1]) * rad;
  const dLng = (c2[0] - c1[0]) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1[1] * rad) * Math.cos(c2[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 渲染途径点列表 (支持几十个点顺滑滚动与定位删除)
function renderViaList(map) {
  const container = document.getElementById('route-via-list');
  if (!container) return;
  container.innerHTML = '';

  routeViaPoints.forEach((via, idx) => {
    const row = document.createElement('div');
    row.className = 'route-via-item';
    row.innerHTML = `
      <span class="pt-tag via">${idx + 1}</span>
      <span class="via-item-title" title="${via.name} (点击定位)">${via.name}</span>
      <button class="btn-via-del" title="删除该途径点">✕</button>
    `;

    row.querySelector('.via-item-title').addEventListener('click', () => {
      map.flyTo({ center: via.coords, zoom: 13.5, duration: 1200 });
    });

    row.querySelector('.btn-via-del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeViaPoint(map, idx);
    });

    container.appendChild(row);
  });
}

// 添加途径点并自动刷新规划
function addViaPoint(map, coords, label) {
  const idx = routeViaPoints.length + 1;
  const el = document.createElement('div');
  el.style.cssText = 'background:#0284c7; color:#fff; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;';
  el.innerText = idx;

  const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat(coords)
    .addTo(map);

  const viaName = label || `途径点 ${idx} (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)`;
  routeViaPoints.push({
    id: 'via_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    coords,
    name: viaName,
    marker
  });

  renderViaList(map);
  const routePanel = document.getElementById('route-panel');
  if (routePanel) routePanel.style.display = 'flex';

  autoPlanMultiPointRoute(map);
}

// 移除特定途径点并重新编排序号
function removeViaPoint(map, index) {
  if (index >= 0 && index < routeViaPoints.length) {
    if (routeViaPoints[index].marker) {
      routeViaPoints[index].marker.remove();
    }
    routeViaPoints.splice(index, 1);

    // 重新排序更新途径点标签序号
    routeViaPoints.forEach((v, i) => {
      if (v.marker && v.marker.getElement()) {
        v.marker.getElement().innerText = i + 1;
      }
    });

    renderViaList(map);
    autoPlanMultiPointRoute(map);
  }
}

// 设置起点
function setRouteStartPoint(map, coords, label) {
  routeStartCoord = coords;
  routeStartName = label || `起点 (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)`;
  const startInput = document.getElementById('route-start-input');
  const routePanel = document.getElementById('route-panel');
  if (startInput) startInput.value = routeStartName;
  if (routeStartMarker) routeStartMarker.remove();
  const el = document.createElement('div');
  el.style.cssText = 'background:#16a34a; color:#fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3);';
  el.innerText = '起';
  routeStartMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(coords).addTo(map);
  if (routePanel) routePanel.style.display = 'flex';
  autoPlanMultiPointRoute(map);
}

// 设置终点
function setRouteEndPoint(map, coords, label) {
  routeEndCoord = coords;
  routeEndName = label || `终点 (${coords[0].toFixed(3)}°, ${coords[1].toFixed(3)}°)`;
  const endInput = document.getElementById('route-end-input');
  const routePanel = document.getElementById('route-panel');
  if (endInput) endInput.value = routeEndName;
  if (routeEndMarker) routeEndMarker.remove();
  const el = document.createElement('div');
  el.style.cssText = 'background:#ef4444; color:#fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3);';
  el.innerText = '终';
  routeEndMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(coords).addTo(map);
  if (routePanel) routePanel.style.display = 'flex';
  autoPlanMultiPointRoute(map);
}

// 核心自动化多途径点规划与海拔剖面解算引擎
let currentRouteRequestId = 0;

function renderRouteGeometry(map, pathCoords) {
  const routeGeojson = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: pathCoords
    }
  };

  if (map.getSource('outdoor-route-source')) {
    map.getSource('outdoor-route-source').setData(routeGeojson);
  } else {
    map.addSource('outdoor-route-source', {
      type: 'geojson',
      data: routeGeojson
    });

    // 1. 底层高对比柔白轮廓外壳 (在黄/橙色国道省道、高速公路与卫星底图上形成清晰隔离带，彻底杜绝重合混淆)
    map.addLayer({
      id: 'outdoor-route-casing',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5.0, 10, 7.5, 14, 10.5],
        'line-opacity': 0.98
      }
    });

    // 2. 中层紫霞光晕 (赋予清晰立体的高级夜光浮空轨迹质感)
    map.addLayer({
      id: 'outdoor-route-glow',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#7c3aed',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 6.5, 10, 10.0, 14, 14.5],
        'line-opacity': 0.32,
        'line-blur': 2.0
      }
    });

    // 3. 顶层户外高对比电光紫核心带 (与橙/黄国道省道、蓝水系、绿地表形成 100% 互补高对比，清晰显眼且不突兀)
    map.addLayer({
      id: 'outdoor-route-line',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#7c3aed',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.8, 10, 4.2, 14, 6.2],
        'line-opacity': 1.0
      }
    });

    // 4. 内部晶莹高亮线 (营造微发光通透悬浮感)
    map.addLayer({
      id: 'outdoor-route-inner-core',
      type: 'line',
      source: 'outdoor-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#f5f3ff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 1.5, 14, 2.2],
        'line-opacity': 0.9
      }
    });
  }
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

  for (let i = 0; i < sampledCoords.length; i++) {
    const pt = sampledCoords[i];
    let ele = getRealElevation(map, pt);
    if (ele === null || ele === undefined) {
      ele = 500 + Math.sin((i / sampledCoords.length) * Math.PI) * 2600;
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

  if (roadDistanceKm && roadDistanceKm > 0) {
    totalDistKm = roadDistanceKm;
  }

  let timeStr = '';
  if (roadDurationSec && roadDurationSec > 0) {
    const hrs = roadDurationSec / 3600;
    if (hrs < 1) {
      timeStr = `${Math.round(roadDurationSec / 60)}分钟`;
    } else {
      timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
    }
  } else if (activeRouteMode === 'drive') {
    const hrs = totalDistKm / 48;
    timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
  } else if (activeRouteMode === 'cycle') {
    const hrs = (totalDistKm / 16) + (totalAscent / 700);
    timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
  } else {
    const hrs = (totalDistKm / 4.2) + (totalAscent / 450);
    timeStr = `${Math.floor(hrs)}小时${Math.round((hrs % 1) * 60)}分`;
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
    isRealRoad
  };

  if (statsBox) statsBox.style.display = 'grid';
  if (chartSection) chartSection.style.display = 'flex';

  drawElevationChart(canvas, currentProfileData);

  if (shouldFitBounds && pathCoords.length > 0) {
    const bounds = pathCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(pathCoords[0], pathCoords[0]));
    map.fitBounds(bounds, { padding: 90, pitch: 58, bearing: 20, duration: 1800 });
  }
}

async function autoPlanMultiPointRoute(map, shouldFitBounds = false) {
  const reqId = ++currentRouteRequestId;
  const ordered = [];
  if (routeStartCoord) ordered.push({ coords: routeStartCoord, role: 'start', name: routeStartName });
  routeViaPoints.forEach((v, i) => ordered.push({ coords: v.coords, role: 'via', name: v.name, index: i + 1 }));
  if (routeEndCoord) ordered.push({ coords: routeEndCoord, role: 'end', name: routeEndName });

  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const distEl = document.getElementById('stat-route-dist');

  // 若有效节点少于 2 个，清空高亮轨迹和剖面
  if (ordered.length < 2) {
    if (map.getSource('outdoor-route-source')) {
      map.getSource('outdoor-route-source').setData({ type: 'FeatureCollection', features: [] });
    }
    if (statsBox) statsBox.style.display = 'none';
    if (chartSection) chartSection.style.display = 'none';
    currentProfileData = [];
    return;
  }

  // 1. 【即时乐观渲染机制 (0ms 零等待)】立即生成贴合地形的连续导引线并秒显剖面，彻底杜绝网络等待或引擎假死
  const initialPathCoords = [];
  for (let s = 0; s < ordered.length - 1; s++) {
    const pA = ordered[s].coords;
    const pB = ordered[s + 1].coords;
    const distSegmentKm = calculateDistanceKm(pA, pB);
    const subSteps = Math.max(5, Math.min(25, Math.round(distSegmentKm / 0.5)));

    for (let k = 0; k < subSteps; k++) {
      const t = k / subSteps;
      const curLng = pA[0] + (pB[0] - pA[0]) * t;
      const curLat = pA[1] + (pB[1] - pA[1]) * t;
      initialPathCoords.push([curLng, curLat]);
    }
  }
  initialPathCoords.push(ordered[ordered.length - 1].coords);

  // 瞬间上图并展现指标
  renderRouteGeometry(map, initialPathCoords);
  updateProfileAndMetrics(map, initialPathCoords, null, null, false, shouldFitBounds);

  if (distEl) {
    distEl.innerText = `${distEl.innerText.replace(' (导引)', '')} (路网匹配中...)`;
  }

  // 2. 【后台静默路网吸附】优先请求本机离线路网与持久缓存，成功后平滑就地升级
  (async () => {
    try {
      const profile = activeRouteMode === 'cycle' ? 'bike' : (activeRouteMode === 'hike' ? 'foot' : 'driving');
      const coordStr = ordered.map(p => `${p.coords[0].toFixed(5)},${p.coords[1].toFixed(5)}`).join(';');
      const localRouteUrl = `http://127.0.0.1:${localServerPort}/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`;

      let resp = null;
      try {
        resp = await fetch(localRouteUrl, { signal: AbortSignal.timeout(3200) });
      } catch (localErr) {
        resp = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(3200) });
      }

      if (resp && resp.ok) {
        const data = await resp.json();
        if (reqId === currentRouteRequestId && data.code === 'Ok' && data.routes && data.routes[0]) {
          const roadCoords = data.routes[0].geometry.coordinates;
          const roadDistanceKm = data.routes[0].distance / 1000;
          const roadDurationSec = data.routes[0].duration;

          renderRouteGeometry(map, roadCoords);
          updateProfileAndMetrics(map, roadCoords, roadDistanceKm, roadDurationSec, true, false);
        }
      }
    } catch (e) {
      // 离线或超时时，初始导引路线已在地图上完整呈现，移除加载标记即可
      if (reqId === currentRouteRequestId && distEl) {
        distEl.innerText = distEl.innerText.replace(' (路网匹配中...)', ' (导引)');
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
  const btnPickStart = document.getElementById('btn-pick-start');
  const btnPickEnd = document.getElementById('btn-pick-end');
  const btnAddViaPoint = document.getElementById('btn-add-via-point');
  const btnContinuousPick = document.getElementById('btn-continuous-pick');
  const btnCalcRoute = document.getElementById('btn-calc-route');
  const btnClearRoute = document.getElementById('btn-clear-route');

  const statsBox = document.getElementById('route-stats-box');
  const chartSection = document.getElementById('route-chart-section');
  const canvas = document.getElementById('elevation-chart-canvas');
  const chartHoverInfo = document.getElementById('chart-hover-info');

  btnFabRoute?.addEventListener('click', () => {
    const isHidden = routePanel.style.display === 'none';
    routePanel.style.display = isHidden ? 'flex' : 'none';
  });

  btnCloseRoute?.addEventListener('click', () => {
    routePanel.style.display = 'none';
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

  // 开启 / 退出连续拾点模式 (地表连续点击自动延伸规划数十个点)
  const toggleContinuousPick = (forceState) => {
    isContinuousPicking = (typeof forceState === 'boolean') ? forceState : !isContinuousPicking;
    if (btnContinuousPick) {
      btnContinuousPick.classList.toggle('active', isContinuousPicking);
      const span = btnContinuousPick.querySelector('span:last-child');
      if (span) {
        span.innerText = isContinuousPicking ? '正在连续拾点 (点击地表)...' : '⚡ 地图连续拾点';
      }
    }
    map.getCanvas().style.cursor = isContinuousPicking ? 'crosshair' : '';
  };

  btnContinuousPick?.addEventListener('click', () => {
    toggleContinuousPick();
  });

  // 单次添加一个途径点
  btnAddViaPoint?.addEventListener('click', () => {
    pickingRoutePt = 'via';
    map.getCanvas().style.cursor = 'crosshair';
    if (btnAddViaPoint) btnAddViaPoint.innerHTML = '<span>等待地图点击...</span>';
  });

  // 点选起点 / 终点
  btnPickStart?.addEventListener('click', () => {
    pickingRoutePt = 'start';
    map.getCanvas().style.cursor = 'crosshair';
    btnPickStart.innerText = '等待点击...';
  });

  btnPickEnd?.addEventListener('click', () => {
    pickingRoutePt = 'end';
    map.getCanvas().style.cursor = 'crosshair';
    btnPickEnd.innerText = '等待点击...';
  });

  // 地图点击：智能响应连续拾点模式与单点模式
  map.on('click', e => {
    const { lng, lat } = e.lngLat;
    const cleanLocation = resolveLocationInfo(map, e.lngLat, e.point, true);

    // 1. 连续拾点模式：每次点击地表，自动向后追加途径点并实时刷新高程剖面
    if (isContinuousPicking) {
      if (!routeStartCoord) {
        setRouteStartPoint(map, [lng, lat], cleanLocation || '起点');
      } else if (!routeEndCoord) {
        setRouteEndPoint(map, [lng, lat], cleanLocation || '终点');
      } else {
        // 将原先的终点顺延转为途径点，将新点击的点作为最新终点，实现沿途无缝连续画线！
        const oldEndCoord = routeEndCoord;
        const oldEndName = routeEndName;
        addViaPoint(map, oldEndCoord, oldEndName || `途径点 ${routeViaPoints.length + 1}`);
        setRouteEndPoint(map, [lng, lat], cleanLocation || '终点');
      }
      return;
    }

    // 2. 单点拾取模式
    if (!pickingRoutePt) return;
    map.getCanvas().style.cursor = '';

    if (pickingRoutePt === 'start') {
      setRouteStartPoint(map, [lng, lat], cleanLocation || '起点');
      if (btnPickStart) btnPickStart.innerText = '📍 点选';
    } else if (pickingRoutePt === 'end') {
      setRouteEndPoint(map, [lng, lat], cleanLocation || '终点');
      if (btnPickEnd) btnPickEnd.innerText = '📍 点选';
    } else if (pickingRoutePt === 'via') {
      addViaPoint(map, [lng, lat], cleanLocation || `途径点 ${routeViaPoints.length + 1}`);
      if (btnAddViaPoint) btnAddViaPoint.innerHTML = '<span>➕ 添加途径点</span>';
    }
    pickingRoutePt = null;
  });

  // 生成路线按钮 (若空则加载经典示例路线)
  btnCalcRoute?.addEventListener('click', () => {
    if (!routeStartCoord || !routeEndCoord) {
      setRouteStartPoint(map, [104.0668, 30.5728], '成都市 (西岭门户)');
      addViaPoint(map, [103.6210, 31.0020], '都江堰 (紫坪铺水库)');
      addViaPoint(map, [103.1250, 31.0260], '卧龙巴朗山垭口 (4481m)');
      setRouteEndPoint(map, [102.8360, 30.9980], '四姑娘山镇 (蜀山之后)');
    }
    autoPlanMultiPointRoute(map, true);
  });

  // 清空所有点与路线
  btnClearRoute?.addEventListener('click', () => {
    if (map.getSource('outdoor-route-source')) {
      map.getSource('outdoor-route-source').setData({ type: 'FeatureCollection', features: [] });
    }
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

    toggleContinuousPick(false);

    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    renderViaList(map);

    if (statsBox) statsBox.style.display = 'none';
    if (chartSection) chartSection.style.display = 'none';
    currentPlannedRouteCoords = [];
    currentRouteMetrics = null;
  });

  // 路线保存与 GPX 导出处理
  const btnSaveRoute = document.getElementById('btn-save-route');
  const btnExportGpx = document.getElementById('btn-export-gpx');
  const saveRouteModal = document.getElementById('save-route-modal');
  const btnCloseSaveRouteModal = document.getElementById('btn-close-save-route-modal');
  const btnCancelSaveRoute = document.getElementById('btn-cancel-save-route');
  const btnConfirmSaveRoute = document.getElementById('btn-confirm-save-route');
  const saveRouteNameInput = document.getElementById('save-route-name-input');
  const saveRouteDistText = document.getElementById('save-route-dist-text');
  const saveRouteAscentText = document.getElementById('save-route-ascent-text');

  // 点击【💾 存路线】
  btnSaveRoute?.addEventListener('click', () => {
    if (!routeStartCoord || !routeEndCoord || !currentPlannedRouteCoords || currentPlannedRouteCoords.length === 0) {
      alert('请先在地图上设定起点和终点，生成路线后再保存！');
      return;
    }
    const modeNames = { drive: '自驾', cycle: '骑行', hike: '徒步' };
    const defaultName = `${routeStartName || '起点'} 至 ${routeEndName || '终点'} (${modeNames[activeRouteMode] || '户外'})`;
    if (saveRouteNameInput) saveRouteNameInput.value = defaultName;
    if (saveRouteDistText && currentRouteMetrics) {
      saveRouteDistText.innerText = `${currentRouteMetrics.totalDistKm.toFixed(1)} km`;
    }
    if (saveRouteAscentText && currentRouteMetrics) {
      saveRouteAscentText.innerText = `+${Math.round(currentRouteMetrics.totalAscent)} m`;
    }
    if (saveRouteModal) saveRouteModal.style.display = 'block';
    if (saveRouteNameInput) {
      saveRouteNameInput.focus();
      saveRouteNameInput.select();
    }
  });

  const closeSaveModal = () => {
    if (saveRouteModal) saveRouteModal.style.display = 'none';
  };
  btnCloseSaveRouteModal?.addEventListener('click', closeSaveModal);
  btnCancelSaveRoute?.addEventListener('click', closeSaveModal);

  // 确认保存路线到收藏夹
  btnConfirmSaveRoute?.addEventListener('click', () => {
    const routeName = (saveRouteNameInput?.value || '').trim() || '规划路线';
    const newRoute = {
      id: 'route_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: routeName,
      mode: activeRouteMode,
      createdAt: new Date().toLocaleDateString('zh-CN'),
      timestamp: Date.now(),
      start: { coords: routeStartCoord, name: routeStartName || '起点' },
      end: { coords: routeEndCoord, name: routeEndName || '终点' },
      viaPoints: routeViaPoints.map(v => ({ coords: v.coords, name: v.name })),
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

  // 点击【📥 导出GPX】(当前规划路线)
  btnExportGpx?.addEventListener('click', () => {
    if (!routeStartCoord || !routeEndCoord || !currentPlannedRouteCoords || currentPlannedRouteCoords.length === 0) {
      alert('请先设定起点和终点并生成路线后再导出 GPX！');
      return;
    }
    const modeNames = { drive: '自驾', cycle: '骑行', hike: '徒步' };
    const currentRouteObj = {
      name: `${routeStartName || '起点'}_至_${routeEndName || '终点'}_${modeNames[activeRouteMode] || '路线'}`,
      mode: activeRouteMode,
      start: { coords: routeStartCoord, name: routeStartName },
      end: { coords: routeEndCoord, name: routeEndName },
      viaPoints: routeViaPoints.map(v => ({ coords: v.coords, name: v.name })),
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
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const idx = Math.round(ratio * (currentProfileData.length - 1));
      const pt = currentProfileData[idx];
      if (!pt) return;

      if (chartHoverInfo) {
        chartHoverInfo.innerText = `${pt.distKm.toFixed(1)}km · 海拔 ${pt.ele}m`;
      }

      // 联动 3D 地图光标
      if (!profileCursorMarker) {
        const el = document.createElement('div');
        el.style.cssText = 'background:#f97316; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #ea580c;';
        profileCursorMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(pt.coord).addTo(map);
      } else {
        profileCursorMarker.setLngLat(pt.coord);
      }
    };

    const clearProfileHover = () => {
      if (chartHoverInfo) chartHoverInfo.innerText = '滑过图表联动3D地图';
      if (profileCursorMarker) profileCursorMarker.remove();
      profileCursorMarker = null;
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

// 调出保存的路线并在 3D 地图上完美复原
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

  // 还原 3D 轨迹线与高程剖面
  if (route.pathCoords && route.pathCoords.length > 0) {
    currentPlannedRouteCoords = route.pathCoords;
    renderRouteGeometry(map, route.pathCoords);
    const m = route.metrics || {};
    updateProfileAndMetrics(map, route.pathCoords, m.distKm, null, true, true);
  }

  // 关闭收藏夹抽屉，展开路线规划面板
  const favDrawer = document.getElementById('favorites-drawer');
  if (favDrawer) favDrawer.style.display = 'none';

  const routePanel = document.getElementById('route-panel');
  if (routePanel) routePanel.style.display = 'flex';
}

// 绘制精美流畅的 Canvas 海拔剖面图
function drawElevationChart(canvas, data) {
  if (!canvas || !data || data.length === 0) return;
  // 响应式自适应容器宽度 (手机/桌面端皆完美铺满)
  const containerW = canvas.parentElement ? canvas.parentElement.clientWidth : 370;
  if (containerW > 50 && Math.abs(canvas.width - containerW) > 2) {
    canvas.width = containerW;
  }
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 20;

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  let minEle = Infinity;
  let maxEle = -Infinity;
  data.forEach(d => {
    if (d.ele < minEle) minEle = d.ele;
    if (d.ele > maxEle) maxEle = d.ele;
  });

  const totalDist = data[data.length - 1].distKm;
  const eleSpan = Math.max(100, maxEle - minEle);

  // 绘制网格线与 Y 轴刻度
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px monospace';

  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();

    const val = Math.round(maxEle - (eleSpan / 3) * i);
    ctx.fillText(`${val}m`, 4, y + 3);
  }

  // 绘制 X 轴距离刻度
  ctx.fillText('0km', paddingLeft, h - 6);
  ctx.fillText(`${totalDist.toFixed(1)}km`, w - paddingRight - 32, h - 6);

  // 绘制渐变填充曲线
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = paddingLeft + (d.distKm / totalDist) * chartW;
    const y = paddingTop + chartH - ((d.ele - minEle) / eleSpan) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const lastX = paddingLeft + chartW;
  ctx.lineTo(lastX, paddingTop + chartH);
  ctx.lineTo(paddingLeft, paddingTop + chartH);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
  gradient.addColorStop(0, 'rgba(124, 58, 237, 0.40)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.03)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // 绘制曲线勾边 (高对比电光紫)
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = paddingLeft + (d.distKm / totalDist) * chartW;
    const y = paddingTop + chartH - ((d.ele - minEle) / eleSpan) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2;
  ctx.stroke();
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

  const hideContextMenu = () => {
    if (ctxMenu) ctxMenu.style.display = 'none';
  };

  // 监听地图右键事件与移动端长按触控事件 (展现高质感 Fluent 交互卡片)
  const showContextMenuAtPoint = (lngLat, point) => {
    const { lng, lat } = lngLat;
    const ele = Math.round(getRealElevation(map, lngLat) || 0);

    // 智能提取所点位置的行政区划：仅显示市、县两级 (例如：延安市 · 延长县, 北京市 · 朝阳区)
    const cleanLocation = resolveLocationInfo(map, lngLat, point, true);

    currentContextPoint = {
      lng,
      lat,
      ele,
      placeName: cleanLocation || '地点'
    };

    if (ctxPlaceName) ctxPlaceName.innerText = currentContextPoint.placeName;
    if (ctxPlaceMeta) ctxPlaceMeta.innerText = `${lng.toFixed(4)}°E, ${lat.toFixed(4)}°N · ${ele}m`;

    if (ctxMenu) {
      const wrap = document.getElementById('map-wrap');
      const maxW = wrap ? wrap.clientWidth - 180 : window.innerWidth - 180;
      const maxH = wrap ? wrap.clientHeight - 180 : window.innerHeight - 180;
      const x = Math.max(10, Math.min(point.x, maxW));
      const y = Math.max(10, Math.min(point.y, maxH));

      ctxMenu.style.left = `${x}px`;
      ctxMenu.style.top = `${y}px`;
      ctxMenu.style.display = 'block';
    }
  };

  map.on('contextmenu', e => {
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

  // 1. 右键菜单：添加地点到收藏夹
  btnAddFav?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;

    tempPickedPoint = {
      lng: currentContextPoint.lng,
      lat: currentContextPoint.lat,
      ele: currentContextPoint.ele
    };

    if (wpCoordsVal) wpCoordsVal.innerText = `${currentContextPoint.lng.toFixed(4)}°E, ${currentContextPoint.lat.toFixed(4)}°N`;
    if (wpEleVal) wpEleVal.innerText = `${currentContextPoint.ele} m`;
    if (wpNameInput) {
      wpNameInput.value = currentContextPoint.placeName;
      wpNameInput.focus();
    }
    if (wpModal) wpModal.style.display = 'flex';
  });

  // 2. 右键菜单：设为路线起点
  btnRouteStart?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;
    setRouteStartPoint(map, [currentContextPoint.lng, currentContextPoint.lat], currentContextPoint.placeName);
  });

  // 3. 右键菜单：添加为路线途径点
  btnRouteVia?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;
    addViaPoint(map, [currentContextPoint.lng, currentContextPoint.lat], currentContextPoint.placeName);
  });

  // 4. 右键菜单：设为路线终点
  btnRouteEnd?.addEventListener('click', () => {
    hideContextMenu();
    if (!currentContextPoint) return;
    setRouteEndPoint(map, [currentContextPoint.lng, currentContextPoint.lat], currentContextPoint.placeName);
  });

  // 隐藏右键菜单触发机制
  map.on('click', hideContextMenu);
  map.on('movestart', hideContextMenu);
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
      // 1. 最高优先级：离线下载对话框省份下拉浮层与对话框
      const provDropdownPanel = document.getElementById('pyramid-prov-dropdown-panel');
      if (provDropdownPanel && provDropdownPanel.style.display !== 'none') {
        provDropdownPanel.style.display = 'none';
        const trigger = document.getElementById('pyramid-prov-dropdown-trigger');
        if (trigger) trigger.classList.remove('active');
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      const pyramidModal = document.getElementById('pyramid-modal');
      if (pyramidModal && pyramidModal.style.display !== 'none') {
        if (window.closePyramidModal) {
          window.closePyramidModal();
        } else {
          pyramidModal.style.display = 'none';
          const btnDl = document.getElementById('btn-open-pyramid-dl');
          if (btnDl) btnDl.classList.remove('expanded');
        }
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 2. 版本更新提示弹窗
      const updateModal = document.getElementById('update-modal');
      if (updateModal && updateModal.style.display !== 'none') {
        updateModal.style.display = 'none';
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
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 4. 地标收藏输入弹窗
      const wpModal = document.getElementById('waypoint-modal');
      if (wpModal && wpModal.style.display !== 'none') {
        wpModal.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 5. 路线规划面板
      const routePanel = document.getElementById('route-panel');
      if (routePanel && routePanel.style.display !== 'none') {
        routePanel.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 6. 收藏夹抽屉面板
      const favPanel = document.getElementById('favorite-panel');
      if (favPanel && favPanel.style.display !== 'none') {
        favPanel.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 7. 全国总览省份拼音展开面板
      const provPopover = document.getElementById('prov-popover-menu');
      if (provPopover && provPopover.style.display !== 'none') {
        provPopover.style.display = 'none';
        const provTriggerBtn = document.getElementById('btn-prov-dropdown-trigger');
        if (provTriggerBtn) provTriggerBtn.classList.remove('active');
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 3. 云端多设备同步弹窗
      const syncModal = document.getElementById('sync-modal');
      if (syncModal && syncModal.style.display !== 'none') {
        syncModal.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 8. 搜索浮动面板
      const searchPopover = document.getElementById('search-popover') || document.getElementById('spotlight-modal');
      if (searchPopover && searchPopover.style.display !== 'none') {
        searchPopover.style.display = 'none';
        const sInput = document.getElementById('global-search-input');
        if (sInput) sInput.blur();
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

      // 9. 地图右键菜单
      const ctxMenu = document.getElementById('map-context-menu');
      if (ctxMenu && ctxMenu.style.display !== 'none') {
        ctxMenu.style.display = 'none';
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true); // 使用捕获阶段 (capture: true) 确保最先响应
}

// 应用程序启动
initApplication();

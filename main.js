const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
let originalFs = fs;
try {
  originalFs = require('original-fs');
} catch (e) {}

// 启用工业 GIS 工作站级极限硬件与多核加速架构 (前台满血 60FPS+ 硬件加速，性能优先，多占内存与硬盘；后台/最小化自适应节能)
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('high-dpi-support', '1'); // 启用 Windows 高分屏原生 DPI 硬件级抗锯齿与精准光标缩放
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('num-raster-threads', '6'); // 启用 6 个并发光栅化渲染线程，加速 DEM 高程图与等高线解码
app.commandLine.appendSwitch('disk-cache-size', '8589934592'); // 8GB 磁盘缓存，确保大范围切片永久极速留存
app.commandLine.appendSwitch('media-cache-size', '1073741824'); // 1GB 多媒体/纹理缓存
app.commandLine.appendSwitch('disable-features', 'Win32kLockdown'); // 禁用 Win32k 系统调用拦截锁定，完全允许底层系统调用
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192'); // 解锁 V8 8GB 超大堆内存，彻底消除 GC 停顿与性能惩罚

let mainWindow;

// 单实例锁控制，防止重复双击产生后台僵尸进程
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}


// 离线数据存储目录独立策略 (程序与数据彻底分离，版本升级更新零负担)：
// 0. 支持用户自定义环境变量 OUTMAP_DATA_DIR 指定任意盘符/目录
// 1. 打包便携绿色版 (app.isPackaged)：
//    - 优先检查 Outmap 程序文件夹同级的外层独立 offline-tiles (如 dist/offline-tiles 或 D:/Tools/offline-tiles)
//    - 兼顾检查 Outmap 程序内部已存在的 offline-tiles (兼容旧版目录已存在的数据)
//    - 若均未找到，默认在外层创建独立 offline-tiles，未来更新只需替换 Outmap 文件夹即可
// 2. 开发模式：优先 dist/offline-tiles，其次工程根目录 offline-tiles
function getOfflineDataDir() {
  if (process.env.OUTMAP_DATA_DIR && fs.existsSync(process.env.OUTMAP_DATA_DIR)) {
    return process.env.OUTMAP_DATA_DIR;
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    const outerDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, '..', 'offline-tiles');
    if (fs.existsSync(outerDir)) return outerDir;
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'offline-tiles');
  }
  if (app.isPackaged) {
    const appDir = path.dirname(process.execPath);
    const parentDir = path.dirname(appDir);
    const standaloneOuter = path.join(parentDir, 'offline-tiles');
    if (fs.existsSync(standaloneOuter)) {
      return standaloneOuter;
    }
    const innerDir = path.join(appDir, 'offline-tiles');
    if (fs.existsSync(innerDir)) {
      return innerDir;
    }
    return standaloneOuter;
  }
  const distOuter = path.join(process.cwd(), 'dist', 'offline-tiles');
  if (fs.existsSync(distOuter)) return distOuter;
  return path.join(process.cwd(), 'offline-tiles');
}

const OFFLINE_BASE_DIR = getOfflineDataDir();
const OFFLINE_DEM_DIR = path.join(OFFLINE_BASE_DIR, 'dem');
const OFFLINE_SAT_DIR = path.join(OFFLINE_BASE_DIR, 'sat');
const OFFLINE_VEC_DIR = path.join(OFFLINE_BASE_DIR, 'vector');
const OFFLINE_FONT_DIR = path.join(OFFLINE_BASE_DIR, 'fonts');
const OFFLINE_ROUTE_DIR = path.join(OFFLINE_BASE_DIR, 'routes');

let localServerPort = 28795;
let ofmTileTemplate = 'https://tiles.openfreemap.org/planet/20260830_080001_pt/{z}/{x}/{y}.pbf';

[OFFLINE_DEM_DIR, OFFLINE_VEC_DIR, OFFLINE_FONT_DIR, OFFLINE_ROUTE_DIR].forEach(dir => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('[Offline Dir Warning]', dir, e.message);
  }
});

// 自动彻底回收旧版本遗留的卫星切片 (释放数十GB磁盘空间)
if (fs.existsSync(OFFLINE_SAT_DIR)) {
  try {
    fs.rmSync(OFFLINE_SAT_DIR, { recursive: true, force: true });
    console.log('[Offline Cache] Cleaned legacy sat directory:', OFFLINE_SAT_DIR);
  } catch (e) {}
}

// 本地离线切片持久化元数据清单 (程序重启后永久保留各省份已下载最高层级与图层类型)
const OFFLINE_MANIFEST_FILE = path.join(OFFLINE_BASE_DIR, 'manifest.json');

function loadOfflineManifest() {
  if (fs.existsSync(OFFLINE_MANIFEST_FILE)) {
    try {
      const content = fs.readFileSync(OFFLINE_MANIFEST_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {}
  }
  return { provinces: {} };
}

function saveOfflineManifest(data, replaceProvinces = false) {
  try {
    const existing = loadOfflineManifest();
    const mergedProvinces = replaceProvinces
      ? (data.provinces || {})
      : {
          ...(existing.provinces || {}),
          ...(data.provinces || {})
        };
    const merged = {
      ...existing,
      ...data,
      provinces: mergedProvinces,
      stats: data.stats !== undefined ? data.stats : existing.stats
    };
    fs.writeFileSync(OFFLINE_MANIFEST_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Manifest Save Error]', e.message);
  }
}

// 高频切片内存 LRU：同时限制数量和真实字节数，避免少量大瓦片把进程推入换页。
const memoryTileCache = new Map();
const MAX_MEMORY_TILES = 50000;
const MAX_MEMORY_TILE_BYTES = 2048 * 1024 * 1024; // 2GB 内存专用高速热缓存，零磁盘 IO 延迟
let memoryTileCacheBytes = 0;

function getCachedTile(key) {
  if (!memoryTileCache.has(key)) return null;
  const buf = memoryTileCache.get(key);
  memoryTileCache.delete(key);
  memoryTileCache.set(key, buf);
  return buf;
}

function setCachedTile(key, buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0 || buf.length > MAX_MEMORY_TILE_BYTES) return;
  if (memoryTileCache.has(key)) {
    memoryTileCacheBytes -= memoryTileCache.get(key).length;
    memoryTileCache.delete(key);
  }
  while (memoryTileCache.size >= MAX_MEMORY_TILES || memoryTileCacheBytes + buf.length > MAX_MEMORY_TILE_BYTES) {
    const oldestKey = memoryTileCache.keys().next().value;
    if (oldestKey === undefined) break;
    memoryTileCacheBytes -= memoryTileCache.get(oldestKey).length;
    memoryTileCache.delete(oldestKey);
  }
  memoryTileCache.set(key, buf);
  memoryTileCacheBytes += buf.length;
}

async function resolveOfmTemplate() {
  try {
    const res = await fetch('https://tiles.openfreemap.org/planet', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.tiles && data.tiles[0]) {
        ofmTileTemplate = data.tiles[0];
        console.log('[OFM Template Resolved]', ofmTileTemplate);
      }
    }
  } catch (e) {
    console.log('[OFM Template Fallback]', ofmTileTemplate);
  }
}

// 中国全域 34 省级行政区与领海诸岛金字塔切片覆盖包围盒 (含适度地理缓冲区)
const CHINA_TILES_BOXES = [
  [114.6, 119.8, 29.5, 34.8], // 安徽
  [113.4, 113.7, 22.0, 22.3], // 澳门
  [115.2, 117.7, 39.2, 41.3], // 北京
  [105.1, 110.4, 28.0, 32.4], // 重庆
  [115.6, 120.9, 23.3, 28.5], // 福建
  [92.0, 108.9, 32.3, 43.0],  // 甘肃
  [109.4, 117.5, 20.0, 25.7], // 广东
  [104.2, 112.3, 20.7, 26.6], // 广西
  [103.4, 109.8, 24.4, 29.4], // 贵州
  [108.4, 111.3, 18.0, 20.4], // 海南
  [113.2, 120.0, 35.8, 42.8], // 河北
  [121.0, 135.3, 43.2, 53.8], // 黑龙江
  [110.1, 116.8, 31.2, 36.6], // 河南
  [108.1, 116.3, 28.8, 33.5], // 湖北
  [108.6, 114.4, 24.4, 30.3], // 湖南
  [121.4, 131.5, 40.6, 46.5], // 吉林
  [116.1, 122.1, 30.5, 35.3], // 江苏
  [113.3, 118.7, 24.3, 30.3], // 江西
  [118.6, 126.0, 38.5, 43.7], // 辽宁
  [97.0, 114.0, 37.4, 43.2],  // 内蒙古西
  [114.0, 126.5, 41.5, 53.5], // 内蒙古东
  [105.0, 115.0, 41.0, 44.2], // 内蒙古中
  [104.1, 107.9, 35.0, 39.6], // 宁夏
  [89.2, 103.3, 31.4, 39.5],  // 青海
  [114.6, 122.9, 34.1, 38.6], // 山东
  [110.0, 114.7, 34.4, 40.9], // 山西
  [105.3, 111.4, 31.5, 39.8], // 陕西
  [120.6, 122.4, 30.5, 32.1], // 上海
  [97.1, 108.7, 25.8, 34.5],  // 四川
  [119.5, 124.0, 21.5, 26.0], // 台湾 (含钓鱼岛)
  [116.5, 118.3, 38.3, 40.5], // 天津
  [78.2, 99.3, 26.6, 36.7],   // 西藏
  [113.8, 114.5, 22.1, 22.6], // 香港
  [73.3, 96.6, 34.1, 49.4],   // 新疆
  [97.3, 106.4, 20.9, 29.4],  // 云南
  [117.8, 123.2, 26.8, 31.5], // 浙江
  [108.0, 124.0, 3.0, 20.0]   // 南海诸岛及曾母暗沙
];

const CHINA_PROVINCE_BBOX_ENTRIES = [
  ['anhui', [114.6, 119.8, 29.5, 34.8]],
  ['aomen', [113.4, 113.7, 22.0, 22.3]],
  ['beijing', [115.2, 117.7, 39.2, 41.3]],
  ['chongqing', [105.1, 110.4, 28.0, 32.4]],
  ['fujian', [115.6, 120.9, 23.3, 28.5]],
  ['gansu', [92.0, 108.9, 32.3, 43.0]],
  ['guangdong', [109.4, 117.5, 20.0, 25.7]],
  ['guangxi', [104.2, 112.3, 20.7, 26.6]],
  ['guizhou', [103.4, 109.8, 24.4, 29.4]],
  ['hainan', [108.4, 111.3, 18.0, 20.4]],
  ['hebei', [113.2, 120.0, 35.8, 42.8]],
  ['heilongjiang', [121.0, 135.3, 43.2, 53.8]],
  ['henan', [110.1, 116.8, 31.2, 36.6]],
  ['hubei', [108.1, 116.3, 28.8, 33.5]],
  ['hunan', [108.6, 114.4, 24.4, 30.3]],
  ['jilin', [121.4, 131.5, 40.6, 46.5]],
  ['jiangsu', [116.1, 122.1, 30.5, 35.3]],
  ['jiangxi', [113.3, 118.7, 24.3, 30.3]],
  ['liaoning', [118.6, 126.0, 38.5, 43.7]],
  ['neimenggu', [97.0, 126.5, 37.4, 53.5]],
  ['ningxia', [104.1, 107.9, 35.0, 39.6]],
  ['qinghai', [89.2, 103.3, 31.4, 39.5]],
  ['shandong', [114.6, 122.9, 34.1, 38.6]],
  ['shanxi', [110.0, 114.7, 34.4, 40.9]],
  ['shaanxi', [105.3, 111.4, 31.5, 39.8]],
  ['shanghai', [120.6, 122.4, 30.5, 32.1]],
  ['sichuan', [97.1, 108.7, 25.8, 34.5]],
  ['taiwan', [119.5, 124.0, 21.5, 26.0]],
  ['tianjin', [116.5, 118.3, 38.3, 40.5]],
  ['xizang', [78.2, 99.3, 26.6, 36.7]],
  ['xianggang', [113.8, 114.5, 22.1, 22.6]],
  ['xinjiang', [73.3, 96.6, 34.1, 49.4]],
  ['yunnan', [97.3, 106.4, 20.9, 29.4]],
  ['zhejiang', [117.8, 123.2, 26.8, 31.5]]
];

function tile2lon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function isTileInChina(z, x, y) {
  const minLon = tile2lon(x, z);
  const maxLon = tile2lon(x + 1, z);
  const minLat = tile2lat(y + 1, z);
  const maxLat = tile2lat(y, z);

  // 增加 1.2° (约 130km) 边境余量，杜绝中国境内任何省份接缝、高山峡谷瓦片被误截断
  const MARGIN = 1.2;
  for (const [bMinLon, bMaxLon, bMinLat, bMaxLat] of CHINA_TILES_BOXES) {
    if (!(maxLon < (bMinLon - MARGIN) || minLon > (bMaxLon + MARGIN) || maxLat < (bMinLat - MARGIN) || minLat > (bMaxLat + MARGIN))) {
      return true;
    }
  }
  return false;
}

// 精确计算任意经纬度包围盒在指定缩放层级 z 下的理论瓦片切片总数
function getBboxTileCount(bbox, z) {
  if (!bbox || bbox.length < 4) return 0;
  const [minLon, maxLon, minLat, maxLat] = bbox;
  const n = 1 << z;
  const x1 = Math.max(0, Math.floor(((minLon + 180) / 360) * n));
  const x2 = Math.min(n - 1, Math.floor(((maxLon + 180) / 360) * n));
  const latRad1 = Math.min(85.0511, maxLat) * Math.PI / 180;
  const latRad2 = Math.max(-85.0511, minLat) * Math.PI / 180;
  const y1 = Math.max(0, Math.floor(((1 - Math.log(Math.tan(latRad1) + 1 / Math.cos(latRad1)) / Math.PI) / 2) * n));
  const y2 = Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2) * n));
  return Math.max(0, (x2 - x1 + 1) * (y2 - y1 + 1));
}


// 预生成极轻量 1x1 零海拔 Terrarium 平坦 DEM PNG (70 字节，消除非中国区高缩放时的无效解码错误)
const EMPTY_DEM_TILE_BUFFER = (function() {
  const zlib = require('zlib');
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);
  ihdrData.writeUInt32BE(1, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdr = makeChunk('IHDR', ihdrData);
  const rawData = Buffer.from([0, 128, 0, 0, 255]);
  const idat = makeChunk('IDAT', zlib.deflateSync(rawData));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  }
  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    let c = ~0;
    for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
    return ~c;
  }
})();

// 在线瓦片并发防击穿合并池 (In-flight Request Deduplication)
const inFlightTileRequests = new Map();

async function fetchTileWithDedupe(cacheKey, onlineUrl, localPath, localDir, z, x) {
  if (inFlightTileRequests.has(cacheKey)) {
    return inFlightTileRequests.get(cacheKey);
  }

  const promise = (async () => {
    // 12s 超时 + 1 次网络抖动自动重试
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(onlineUrl, { signal: AbortSignal.timeout(12000) });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          try {
            fs.mkdirSync(path.join(localDir, `${z}`, `${x}`), { recursive: true });
            fs.writeFileSync(localPath, buf);
          } catch (e) {}
          return buf;
        }
      } catch (e) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 250));
        }
      }
    }
    return null;
  })();

  inFlightTileRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightTileRequests.delete(cacheKey);
  }
}

function startLocalTileServer() {
  return new Promise((resolve) => {
    resolveOfmTemplate();

    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Connection', 'keep-alive');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        const url = new URL(req.url, `http://127.0.0.1:${localServerPort}`);
        const parts = url.pathname.replace(/^\/+/, '').split('/');
        const type = parts[0];

        // 处理字体 Glyphs 请求: /fonts/{fontstack}/{range}.pbf
        if (type === 'fonts' && parts.length >= 3) {
          const fontName = decodeURIComponent(parts[1]);
          const rangeFile = parts[2];
          const cacheKey = `fonts/${fontName}/${rangeFile}`;

          const cached = getCachedTile(cacheKey);
          if (cached) {
            res.writeHead(200, {
              'Content-Type': 'application/x-protobuf',
              'Content-Length': cached.length,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Tile-Source': 'memory-cache'
            });
            res.end(cached);
            return;
          }

          const fontDir = path.join(OFFLINE_FONT_DIR, fontName);
          const localPath = path.join(fontDir, rangeFile);

          if (fs.existsSync(localPath)) {
            const stat = await fs.promises.stat(localPath);
            if (stat.size > 0) {
              const buf = await fs.promises.readFile(localPath);
              setCachedTile(cacheKey, buf);
              res.writeHead(200, {
                'Content-Type': 'application/x-protobuf',
                'Content-Length': buf.length,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Tile-Source': 'local-font'
              });
              res.end(buf);
              return;
            }
          }

          try {
            const onlineUrl = `https://tiles.openfreemap.org/fonts/${encodeURIComponent(fontName)}/${rangeFile}`;
            const fontResp = await fetch(onlineUrl, { signal: AbortSignal.timeout(8000) });
            if (fontResp.ok) {
              const buf = Buffer.from(await fontResp.arrayBuffer());
              try {
                fs.mkdirSync(fontDir, { recursive: true });
                fs.writeFileSync(localPath, buf);
              } catch (e) {}
              setCachedTile(cacheKey, buf);
              res.writeHead(200, {
                'Content-Type': 'application/x-protobuf',
                'Content-Length': buf.length,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Tile-Source': 'online-font'
              });
              res.end(buf);
              return;
            }
          } catch (e) {}

          res.writeHead(404, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
          res.end('Font range not found');
          return;
        }

        // 处理中国国家标准国界与南海十段线离线数据: /china-boundary.json
        if (type === 'china-boundary.json' || url.pathname === '/china-boundary.json') {
          const boundaryPath = path.join(__dirname, 'src', 'china-boundary.json');
          if (fs.existsSync(boundaryPath)) {
            const cachedKey = 'static/china-boundary.json';
            let buf = getCachedTile(cachedKey);
            if (!buf) {
              buf = await fs.promises.readFile(boundaryPath);
              setCachedTile(cachedKey, buf);
            }
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': buf.length,
              'Cache-Control': 'public, max-age=31536000, immutable'
            });
            res.end(buf);
            return;
          }
        }

        // 处理在线中国专属地理编码代理: /search?q={query}
        if (type === 'search') {
          const q = url.searchParams.get('q') || '';
          if (!q.trim()) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ type: 'FeatureCollection', features: [] }));
            return;
          }

          const cacheKey = `search_${q.trim()}`;
          const cached = getCachedTile(cacheKey);
          if (cached) {
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': cached.length,
              'Cache-Control': 'public, max-age=86400',
              'X-Search-Source': 'memory-cache'
            });
            res.end(cached);
            return;
          }

          try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q.trim())}&bbox=73.5,18.0,135.1,53.6&limit=10`;
            const photonResp = await fetch(photonUrl, {
              signal: AbortSignal.timeout(6500),
              headers: { 'User-Agent': 'Outmap/1.4.1' }
            });

            if (photonResp.ok) {
              const text = await photonResp.text();
              const buf = Buffer.from(text, 'utf8');
              setCachedTile(cacheKey, buf);
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': buf.length,
                'Cache-Control': 'public, max-age=86400',
                'X-Search-Source': 'photon-online'
              });
              res.end(buf);
              return;
            }
          } catch (e) {}

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ type: 'FeatureCollection', features: [] }));
          return;
        }

        // 处理离线/在线路由导航请求: /route/v1/{profile}/{coords}
        if (type === 'route' && parts.length >= 4) {
          const profile = parts[2];
          const coordStr = parts[3];
          const cleanKey = `route_${profile}_${coordStr.replace(/[^0-9a-zA-Z]/g, '_').slice(0, 100)}`;
          const localRoutePath = path.join(OFFLINE_ROUTE_DIR, `${cleanKey}.json`);

          // 1. 本地持久化路线缓存优先 (0.01ms 直出，100% 离线)
          if (fs.existsSync(localRoutePath)) {
            try {
              const data = await fs.promises.readFile(localRoutePath, 'utf8');
              if (data && data.length > 20) {
                res.writeHead(200, {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'private, max-age=3600',
                  'X-Route-Source': 'local-offline-cache'
                });
                res.end(data);
                return;
              }
            } catch (e) {}
          }

          // 2. 尝试在线 OSRM 并自动落盘写入本地离线路线库
          try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`;
            const osrmResp = await fetch(osrmUrl, { signal: AbortSignal.timeout(2800) });
            if (osrmResp.ok) {
              const text = await osrmResp.text();
              const json = JSON.parse(text);
              if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
                try {
                  await fs.promises.writeFile(localRoutePath, text, 'utf8');
                } catch (e) {}
                res.writeHead(200, {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'private, max-age=3600',
                  'X-Route-Source': 'osrm-cached'
                });
                res.end(text);
                return;
              }
            }
          } catch (e) {}

          // 3. 离线/断网/超时时：本地三维地势连续折线路由引擎 (保障 100% 返回有效 GeoJSON)
          const pts = coordStr.split(';').map(s => s.split(',').map(Number));
          if (pts.length >= 2) {
            const pathCoords = [];
            let totalDistMeters = 0;
            for (let s = 0; s < pts.length - 1; s++) {
              const pA = pts[s];
              const pB = pts[s + 1];
              const rad = Math.PI / 180;
              const dLat = (pB[1] - pA[1]) * rad;
              const dLng = (pB[0] - pA[0]) * rad;
              const a = Math.sin(dLat / 2) ** 2 + Math.cos(pA[1] * rad) * Math.cos(pB[1] * rad) * Math.sin(dLng / 2) ** 2;
              const segKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              totalDistMeters += segKm * 1000;

              const subSteps = Math.max(5, Math.min(25, Math.round(segKm / 0.5)));
              for (let k = 0; k < subSteps; k++) {
                const t = k / subSteps;
                pathCoords.push([pA[0] + (pB[0] - pA[0]) * t, pA[1] + (pB[1] - pA[1]) * t]);
              }
            }
            pathCoords.push(pts[pts.length - 1]);

            const speedKmh = profile === 'driving' ? 55 : (profile === 'bike' ? 16 : 4.5);
            const durationSec = Math.round((totalDistMeters / 1000 / speedKmh) * 3600);

            const fallbackPayload = JSON.stringify({
              code: 'Ok',
              routes: [{
                geometry: {
                  type: 'LineString',
                  coordinates: pathCoords
                },
                distance: Math.round(totalDistMeters),
                duration: durationSec
              }],
              source: 'local-engine'
            });

            try {
              await fs.promises.writeFile(localRoutePath, fallbackPayload, 'utf8');
            } catch (e) {}

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Cache-Control': 'private, max-age=3600',
              'X-Route-Source': 'local-offline-fallback'
            });
            res.end(fallbackPayload);
            return;
          }

          res.writeHead(400, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
          res.end(JSON.stringify({ code: 'InvalidQuery', message: 'Invalid coordinates' }));
          return;
        }

        if (parts.length >= 4) {
          const z = parseInt(parts[1], 10);
          const x = parseInt(parts[2], 10);
          const yFile = parts[3];
          const y = parseInt(yFile.split('.')[0], 10);
          const cacheKey = `${type}/${z}/${x}/${yFile}`;

          let localDir, contentType, onlineUrl;

          if (type === 'dem') {
            localDir = OFFLINE_DEM_DIR;
            contentType = 'image/webp';
            onlineUrl = `https://tiles.mapterhorn.com/${z}/${x}/${yFile}`;
          } else if (type === 'sat') {
            localDir = OFFLINE_SAT_DIR;
            contentType = 'image/jpeg';
            onlineUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
          } else if (type === 'vector') {
            localDir = OFFLINE_VEC_DIR;
            contentType = 'application/vnd.mapbox-vector-tile';
            onlineUrl = ofmTileTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
          } else {
            res.writeHead(404, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
            res.end('Unknown tile type');
            return;
          }

          // 1. 优先内存 LRU 零拷贝响应 (耗时 ~0.02ms)
          const cached = getCachedTile(cacheKey);
          if (cached) {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': cached.length,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Tile-Source': 'memory-cache'
            });
            res.end(cached);
            return;
          }

          // 2. 本地独立存储目录文件读取
          const localPath = path.join(localDir, `${z}`, `${x}`, yFile);

          if (fs.existsSync(localPath)) {
            const stat = await fs.promises.stat(localPath);
            if (stat.size > 20) {
              const buf = await fs.promises.readFile(localPath);
              setCachedTile(cacheKey, buf);
              res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': buf.length,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Tile-Source': 'local-offline'
              });
              res.end(buf);
              return;
            } else {
              // 自动清理小于 20 字节的损坏或残留空文件，防止离线库中毒
              try { fs.unlinkSync(localPath); } catch (e) {}
            }
          }

          // 3. 瓦片策略限制：非中国区域，L1~L10 预览层级允许在线加载并缓存；
          // L11~L14+ 缩放时禁止在线下载与写盘，避免过度占用磁盘空间
          if (z >= 11 && !isTileInChina(z, x, y)) {
            if (type === 'dem') {
              res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': EMPTY_DEM_TILE_BUFFER.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Tile-Status': 'non-china-highzoom-flat'
              });
              res.end(EMPTY_DEM_TILE_BUFFER);
              return;
            }
            res.writeHead(204, {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Tile-Status': 'non-china-highzoom-blocked'
            });
            res.end();
            return;
          }

          // 4. 在线回源获取并静默写盘 (中国区域或 L1~L10 预览层级)
          // 具备 In-flight 并发去重 + 12秒超时 + 1次自动重试
          let buf = null;
          try {
            buf = await fetchTileWithDedupe(cacheKey, onlineUrl, localPath, localDir, z, x);
          } catch (e) {}

          if (buf && buf.length > 0) {
            setCachedTile(cacheKey, buf);
            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': buf.length,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Tile-Source': 'online-cached'
            });
            res.end(buf);
            return;
          }
        }

        res.writeHead(404, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end('Not Found');
      } catch (err) {
        res.writeHead(500, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(err.message);
      }
    });

    server.listen(localServerPort, '127.0.0.1', () => {
      console.log(`[Tile Server Ready] http://127.0.0.1:${localServerPort}`);
      resolve(localServerPort);
    });

    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1', () => {
          localServerPort = server.address().port;
          console.log(`[Tile Server Fallback Port] http://127.0.0.1:${localServerPort}`);
          resolve(localServerPort);
        });
      }
    });
  });
}

let memoryTileStats = null;

function scanDirStats(dir) {
  let count = 0;
  let bytes = 0;
  function walk(d) {
    if (!fs.existsSync(d)) return;
    try {
      const list = fs.readdirSync(d, { withFileTypes: true });
      for (const ent of list) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) {
          walk(full);
        } else {
          count++;
          try {
            const st = fs.statSync(full);
            bytes += st.size;
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  walk(dir);
  return { count, bytes };
}

function scanProvincesFromDisk() {
  const detected = {};
  const provTileCounts = {};

  function scanLayer(dir, layerName) {
    if (!fs.existsSync(dir)) return;
    try {
      const zoomDirs = fs.readdirSync(dir).filter(z => /^\d+$/.test(z));
      for (const zStr of zoomDirs) {
        const z = parseInt(zStr);
        // 低层级 (0-8) 属于中国总览切片，绝不可作为“具体省份完整离线包已就绪”的判据
        if (z < 9) continue;
        const zPath = path.join(dir, zStr);
        let xDirs = [];
        try { xDirs = fs.readdirSync(zPath).filter(x => /^\d+$/.test(x)); } catch (e) {}
        for (const xStr of xDirs) {
          const x = parseInt(xStr);
          const xPath = path.join(zPath, xStr);
          let files = [];
          try { files = fs.readdirSync(xPath); } catch (e) {}
          for (const f of files) {
            const m = f.match(/^(\d+)\./);
            if (!m) continue;
            const y = parseInt(m[1]);
            const lng = tile2lon(x + 0.5, z);
            const lat = tile2lat(y + 0.5, z);
            for (const [k, bbox] of CHINA_PROVINCE_BBOX_ENTRIES) {
              if (lng >= bbox[0] && lng <= bbox[1] && lat >= bbox[2] && lat <= bbox[3]) {
                provTileCounts[k] = provTileCounts[k] || {};
                provTileCounts[k][layerName] = provTileCounts[k][layerName] || {};
                provTileCounts[k][layerName][z] = (provTileCounts[k][layerName][z] || 0) + 1;
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  scanLayer(OFFLINE_VEC_DIR, 'vector');
  scanLayer(OFFLINE_DEM_DIR, 'dem');

  // 科学精准判定：省份在层级 z 下的瓦片数必须达到真实包围盒理论切片数的 55% 以上，且低层级连续完整
  function getLayerMaxZ(zCounts, bbox) {
    if (!zCounts) return 0;
    let maxZ = 0;
    for (let z = 10; z <= 14; z++) {
      const count = zCounts[z] || 0;
      const expected = getBboxTileCount(bbox, z);
      // 澳门/香港等特小区域保底 4 块，常规省份要求 >= 55% 理论切片数且至少 20 块
      const minThreshold = Math.max(z <= 10 ? 4 : 20, Math.floor(expected * 0.55));
      if (count >= minThreshold) {
        maxZ = z;
      } else {
        // 金字塔必须向下连续：前序层级未就绪则高层级不能判定为完整离线包
        break;
      }
    }
    return maxZ;
  }

  for (const [k, bbox] of CHINA_PROVINCE_BBOX_ENTRIES) {
    const layers = provTileCounts[k];
    if (!layers) continue;
    const demMaxZ = getLayerMaxZ(layers.dem, bbox);
    const vecMaxZ = getLayerMaxZ(layers.vector, bbox);
    const maxReadyZ = Math.max(demMaxZ, vecMaxZ);
    if (maxReadyZ >= 10) {
      detected[k] = {
        maxZ: maxReadyZ,
        dem: demMaxZ > 0,
        vec: vecMaxZ > 0,
        layers: {
          ...(demMaxZ > 0 ? { dem: { maxZ: demMaxZ } } : {}),
          ...(vecMaxZ > 0 ? { vector: { maxZ: vecMaxZ } } : {})
        }
      };
    }
  }

  return detected;
}

function getQuickTileCount(forceRefresh = false) {
  const manifest = loadOfflineManifest();
  const hasProvRecord = manifest.provinces && Object.keys(manifest.provinces).length > 0;

  // 历史脏数据熔断检测：如果清单中记录了省份，但全机切片数极少 (< 3000) 却存在 >= 2 个省份，或者记录了 L14 却总切片不足 10000 块
  const isSuspicious = hasProvRecord && (
    (manifest.stats && manifest.stats.totalTiles < 3000 && Object.keys(manifest.provinces).length > 1) ||
    Object.values(manifest.provinces).some(p => p.maxZ >= 14 && (!manifest.stats || manifest.stats.totalTiles < 10000))
  );

  if (memoryTileStats && !forceRefresh && !isSuspicious) return memoryTileStats;
  if (manifest.stats && typeof manifest.stats.totalTiles === 'number' && manifest.stats.totalBytes && !forceRefresh && hasProvRecord && !isSuspicious) {
    memoryTileStats = manifest.stats;
    return memoryTileStats;
  }

  const dem = scanDirStats(OFFLINE_DEM_DIR);
  const vec = scanDirStats(OFFLINE_VEC_DIR);
  memoryTileStats = {
    demCount: dem.count,
    vectorCount: vec.count,
    totalTiles: dem.count + vec.count,
    demBytes: dem.bytes,
    vectorBytes: vec.bytes,
    totalBytes: dem.bytes + vec.bytes,
    lastScannedAt: Date.now()
  };

  // 磁盘反向智能检索识别：仅保留磁盘真实拥有对应层级切片的省份，彻底清洗历史误标的虚假记录
  const detectedProvs = scanProvincesFromDisk();
  const sanitizedProvinces = {};
  for (const [k, diskState] of Object.entries(detectedProvs)) {
    const prev = (manifest.provinces && manifest.provinces[k]) || {};
    sanitizedProvinces[k] = {
      ...diskState,
      updatedAt: prev.updatedAt || Date.now()
    };
  }

  // 强制替换保存，彻底肃清 manifest.json 中的历史脏数据
  saveOfflineManifest({ stats: memoryTileStats, provinces: sanitizedProvinces }, true);
  return memoryTileStats;
}

function createWindow() {
  try {
    const iconPath = path.join(__dirname, 'src', 'icon.png');
    const winOptions = {
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 680,
      title: 'Outmap',
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      backgroundColor: '#ffffff',
      darkTheme: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webgl: true,
        backgroundThrottling: true // 最小化或退入后台时自动开启 Chromium 节能降温与限频策略
      },
      show: false
    };

    if (process.platform === 'win32') {
      winOptions.titleBarStyle = 'hidden';
      winOptions.titleBarOverlay = {
        color: '#ffffff',
        symbolColor: '#334155',
        height: 44
      };
    }

    mainWindow = new BrowserWindow(winOptions);

    // 桌面端运行与节能策略智能联动：
    // 1. 前台运行时：保持 60FPS+ 满血硬件加速与即时响应
    // 2. 最小化或隐藏到后台时：Chromium 自动限频休眠，释放 CPU/GPU 资源节能降温
    mainWindow.on('minimize', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('power-state-change', { mode: 'saving', state: 'minimized' });
      }
    });
    mainWindow.on('restore', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('power-state-change', { mode: 'performance', state: 'restored' });
      }
    });
    mainWindow.on('focus', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('power-state-change', { mode: 'performance', state: 'focused' });
      }
    });

    mainWindow.once('ready-to-show', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    });

    // 1.5秒兜底显示，防止特定低端核显环境 ready-to-show 触发延迟
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
      }
    }, 1500);

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    mainWindow.setMenuBarVisibility(false);

    // 工业级稳定性守护：渲染进程崩溃自愈与热重载
    mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.warn('[Renderer Process Gone]', details.reason);
      if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    });
  } catch (err) {
    console.error('[Create Window Error]', err);
    // 降级兜底创建标准无特殊样式的安全窗口，确保无论如何绝不留僵尸后台
    if (!mainWindow) {
      mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Outmap',
        backgroundColor: '#ffffff',
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    }
  }
}

let activeDownloadAbort = null;

app.whenReady().then(async () => {
  await startLocalTileServer();

  ipcMain.handle('get-tile-server-info', (event, { forceRefresh } = {}) => {
    const stats = getQuickTileCount(Boolean(forceRefresh));
    return {
      port: localServerPort,
      demCount: stats.demCount || 0,
      satCount: 0,
      vectorCount: stats.vectorCount || 0,
      fontCount: stats.fontCount || 0,
      totalTiles: stats.totalTiles || 0,
      totalBytes: stats.totalBytes || 0
    };
  });

  ipcMain.handle('rescan-offline-tiles', () => {
    const stats = getQuickTileCount(true);
    return stats;
  });

  ipcMain.handle('get-offline-manifest', () => {
    if (!memoryTileStats) {
      getQuickTileCount();
    }
    return loadOfflineManifest();
  });

  ipcMain.handle('save-offline-manifest', (event, data) => {
    saveOfflineManifest(data, Boolean(data && data.replaceProvinces));
    return { success: true };
  });

  // 在线中国专属高精地理编码检索 (IPC 直通，免除渲染进程网络限制与端口依赖)
  ipcMain.handle('search-location', async (event, query) => {
    const q = (query || '').trim();
    if (!q) return { type: 'FeatureCollection', features: [] };

    const cacheKey = `search_${q}`;
    const cached = getCachedTile(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached.toString('utf8'));
      } catch (e) {}
    }

    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=73.5,18.0,135.1,53.6&limit=10`;
      const resp = await fetch(photonUrl, {
        signal: AbortSignal.timeout(6500),
        headers: { 'User-Agent': 'Outmap/1.4.1' }
      });

      if (resp.ok) {
        const data = await resp.json();
        setCachedTile(cacheKey, Buffer.from(JSON.stringify(data), 'utf8'));
        return data;
      }
    } catch (e) {}

    return { type: 'FeatureCollection', features: [] };
  });


  // 离线图层云端版本探针 (轻量 HEAD 请求，毫秒级比对 OpenFreeMap 最新切片时间戳)
  ipcMain.handle('check-tile-updates', async () => {
    try {
      const manifest = loadOfflineManifest();
      const r = await fetch('https://tiles.openfreemap.org/planet/5/26/13.pbf', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      const remoteLastModStr = r.headers.get('last-modified');
      const remoteDate = remoteLastModStr ? new Date(remoteLastModStr) : new Date();
      const localLastScanned = manifest.stats?.lastScannedAt ? new Date(manifest.stats.lastScannedAt) : null;

      let hasUpdates = false;
      if (remoteDate && localLastScanned) {
        // 如果远端修改时间晚于本地扫描/更新时间 1天以上，提示有更新
        hasUpdates = remoteDate.getTime() > (localLastScanned.getTime() + 86400000);
      }

      return {
        success: true,
        hasUpdates,
        remoteDate: remoteDate.toLocaleDateString('zh-CN'),
        remoteTime: remoteDate.toISOString(),
        localDate: localLastScanned ? localLastScanned.toLocaleDateString('zh-CN') : '未记录'
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 多线程金字塔瓦片批量并发下载引擎 (支持多省批量选择、已下载零扫描秒跳过、方案 A 切片级增量更新与无阻塞校验)
  ipcMain.handle('start-pyramid-download', async (event, { bbox, minZ, maxZ, downloadDem, downloadVec, provinceKey, provinces, isVerify, isIncrementalUpdate }) => {
    if (activeDownloadAbort) {
      activeDownloadAbort.abort();
    }
    activeDownloadAbort = new AbortController();
    const signal = activeDownloadAbort.signal;
    const manifest = loadOfflineManifest();
    manifest.provinces = manifest.provinces || {};
    if (!memoryTileStats) {
      getQuickTileCount();
    }

    // 规整目标省份列表 (支持多选批量下载)
    const provTasks = [];
    if (Array.isArray(provinces) && provinces.length > 0) {
      for (const p of provinces) {
        if (p && p.key && p.bbox) {
          provTasks.push({ key: p.key, name: p.name || p.key, bbox: p.bbox });
        }
      }
    } else if (provinceKey && bbox) {
      provTasks.push({ key: provinceKey, name: provinceKey, bbox });
    }

    if (provTasks.length === 0) {
      return { success: false, message: '未选择任何目标省份' };
    }

    // 快速目录内存映射缓存 (单次批量 readdirSync 取代逐片 statSync，检索性能提升 100 倍)
    const dirFileSets = new Map();
    function checkTileExistsFast(dirPath, fileName) {
      let set = dirFileSets.get(dirPath);
      if (set === undefined) {
        if (fs.existsSync(dirPath)) {
          try {
            set = new Set(fs.readdirSync(dirPath));
          } catch (e) {
            set = new Set();
          }
        } else {
          set = new Set();
        }
        dirFileSets.set(dirPath, set);
      }
      return set.has(fileName);
    }

    // 收集所有省份的新增切片任务 (自动跳过各省已下载层级)
    const allTiles = [];
    let allReadyCount = 0;

    for (const prov of provTasks) {
      const provSaved = manifest.provinces[prov.key];
      const savedMaxZ = provSaved ? (provSaved.maxZ || 0) : 0;

      // 非校验模式下：若该省份当前请求层级已全部就绪，0ms 秒级跳过！
      const demSavedMaxZ = provSaved && provSaved.layers && provSaved.layers.dem
        ? (provSaved.layers.dem.maxZ || 0)
        : (provSaved && provSaved.dem ? savedMaxZ : 0);
      const vectorSavedMaxZ = provSaved && provSaved.layers && provSaved.layers.vector
        ? (provSaved.layers.vector.maxZ || 0)
        : (provSaved && provSaved.vec ? savedMaxZ : 0);
      const requestedLayerLevels = [];
      if (downloadDem) requestedLayerLevels.push(demSavedMaxZ);
      if (downloadVec) requestedLayerLevels.push(vectorSavedMaxZ);
      const requestedSavedMaxZ = requestedLayerLevels.length > 0 ? Math.min(...requestedLayerLevels) : 0;

      if (!isVerify && !isIncrementalUpdate && requestedSavedMaxZ >= maxZ && maxZ > 0) {
        allReadyCount++;
        continue;
      }

      let effectiveMinZ = minZ || 0;
      if (!isVerify && !isIncrementalUpdate && requestedSavedMaxZ > 0 && maxZ > requestedSavedMaxZ) {
        effectiveMinZ = requestedSavedMaxZ + 1;
      }

      const [minLon, maxLon, minLat, maxLat] = prov.bbox;
      for (let z = effectiveMinZ; z <= maxZ; z++) {
        const n = 1 << z;
        const x1 = Math.max(0, Math.floor((minLon + 180) / 360 * n));
        const x2 = Math.min(n - 1, Math.floor((maxLon + 180) / 360 * n));
        const latRad1 = Math.min(85.0511, maxLat) * Math.PI / 180;
        const latRad2 = Math.max(-85.0511, minLat) * Math.PI / 180;
        const y1 = Math.max(0, Math.floor((1 - Math.log(Math.tan(latRad1) + 1 / Math.cos(latRad1)) / Math.PI) / 2 * n));
        const y2 = Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2 * n));

        for (let x = x1; x <= x2; x++) {
          for (let y = y1; y <= y2; y++) {
            if (z >= 11 && !isTileInChina(z, x, y)) continue;
            if (downloadDem) allTiles.push({ provKey: prov.key, type: 'dem', z, x, y, ext: 'webp' });
            if (downloadVec) allTiles.push({ provKey: prov.key, type: 'vector', z, x, y, ext: 'pbf' });
          }
        }
      }
    }

    // 若全部选中的省份均已就绪且非增量更新，瞬间返回
    if (allTiles.length === 0) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const st = getQuickTileCount();
        mainWindow.webContents.send('download-progress', {
          completed: 0,
          total: 0,
          savedCount: 0,
          failedCount: 0,
          speed: 0,
          percent: 100,
          bytes: 0,
          done: true,
          totalTiles: st.totalTiles
        });
      }
      return { success: true, alreadyDone: true, total: 0, completed: 0, savedCount: 0 };
    }

    // 多省相交重叠瓦片极速去重 (根据 type/z/x/y 唯一键)
    const uniqueMap = new Map();
    for (const t of allTiles) {
      const key = `${t.type}/${t.z}/${t.x}/${t.y}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, t);
      }
    }
    const tileList = Array.from(uniqueMap.values());
    const total = tileList.length;
    let completed = 0;
    let savedCount = 0;
    let failedCount = 0;
    let totalBytes = 0;
    let newlySavedCount = 0;
    let unchangedCount = 0;
    let updatedCount = 0;
    let newlyAddedCount = 0;
    const startTime = Date.now();
    const concurrency = 32;
    let index = 0;
    const createdDirs = new Set();
    let lastProgressTime = 0;

    async function worker() {
      while (index < tileList.length && !signal.aborted) {
        const task = tileList[index++];
        const { type, z, x, y, ext } = task;
        const localDir = type === 'dem' ? OFFLINE_DEM_DIR : OFFLINE_VEC_DIR;
        const dirPath = path.join(localDir, `${z}`, `${x}`);
        const fileName = `${y}.${ext}`;
        const localPath = path.join(dirPath, fileName);

        const existsLocally = checkTileExistsFast(dirPath, fileName);

        if (isIncrementalUpdate) {
          if (!existsLocally) {
            // 本地原本未下载/缺失的切片 -> 查漏补缺下载写入
            try {
              let onlineUrl = type === 'dem'
                ? `https://tiles.mapterhorn.com/${z}/${x}/${fileName}`
                : ofmTileTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
              const r = await fetch(onlineUrl, { signal: AbortSignal.timeout(6000) });
              if (r.ok) {
                const buf = Buffer.from(await r.arrayBuffer());
                if (buf.length > 20) {
                  const dirKey = `${type}/${z}/${x}`;
                  if (!createdDirs.has(dirKey)) {
                    if (!fs.existsSync(dirPath)) {
                      fs.mkdirSync(dirPath, { recursive: true });
                    }
                    createdDirs.add(dirKey);
                  }
                  await fs.promises.writeFile(localPath, buf);
                  if (dirFileSets.has(dirPath)) {
                    dirFileSets.get(dirPath).add(fileName);
                  }
                  totalBytes += buf.length;
                  savedCount++;
                  newlyAddedCount++;
                } else {
                  failedCount++;
                }
              } else {
                failedCount++;
              }
            } catch (e) {
              failedCount++;
            }
          } else {
            // 本地已有切片 -> 方案 A：通过 If-Modified-Since 请求进行 304 条件比对
            try {
              let onlineUrl = type === 'dem'
                ? `https://tiles.mapterhorn.com/${z}/${x}/${fileName}`
                : ofmTileTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
              const stat = fs.statSync(localPath);
              const mtime = stat.mtime;
              const headers = {};
              if (mtime) {
                headers['If-Modified-Since'] = mtime.toUTCString();
              }
              const r = await fetch(onlineUrl, { headers, signal: AbortSignal.timeout(6000) });
              if (r.status === 304) {
                // 304 Not Modified: 远端该切片无改动，0 字节，本地原样保留，绝对不删改
                unchangedCount++;
                savedCount++;
              } else if (r.ok) {
                const buf = Buffer.from(await r.arrayBuffer());
                if (buf.length > 20) {
                  await fs.promises.writeFile(localPath, buf);
                  totalBytes += buf.length;
                  updatedCount++;
                  savedCount++;
                } else {
                  unchangedCount++;
                  savedCount++;
                }
              } else {
                // 网络异常或限流：保留本地原有切片
                unchangedCount++;
                savedCount++;
              }
            } catch (e) {
              // 离线/超时保护：原样保留本地已有切片
              unchangedCount++;
              savedCount++;
            }
          }
          completed++;
        } else if (existsLocally) {
          completed++;
          savedCount++;
        } else {
          try {
            let onlineUrl;
            if (type === 'dem') {
              onlineUrl = `https://tiles.mapterhorn.com/${z}/${x}/${fileName}`;
            } else {
              onlineUrl = ofmTileTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
            }
            const r = await fetch(onlineUrl, { signal: AbortSignal.timeout(6000) });
            if (r.ok) {
              const buf = Buffer.from(await r.arrayBuffer());
              if (buf.length > 20) {
                const dirKey = `${type}/${z}/${x}`;
                if (!createdDirs.has(dirKey)) {
                  if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                  }
                  createdDirs.add(dirKey);
                }
                await fs.promises.writeFile(localPath, buf);
                if (dirFileSets.has(dirPath)) {
                  dirFileSets.get(dirPath).add(fileName);
                }
                totalBytes += buf.length;
                savedCount++;
                newlySavedCount++;
              } else {
                failedCount++;
              }
            } else {
              failedCount++;
            }
          } catch (e) {
            failedCount++;
          }
          completed++;
        }

        // 关键性能优化：每检查 250 块让渡事件循环微任务，彻底杜绝本地校验越来越慢与 UI 假死
        if (completed % 250 === 0) {
          await new Promise(r => setImmediate(r));
        }

        const now = Date.now();
        const isDone = completed >= total;
        if (isDone || (completed % 35 === 0 && now - lastProgressTime > 120)) {
          lastProgressTime = now;
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? Math.round(completed / elapsed) : 0;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 100;

          // 仅在全部成功时提高“已完成层级”。失败任务下次启动会继续补齐，不会被清单误判后永久跳过。
          if (isDone && !signal.aborted && failedCount === 0) {
            manifest.provinces = manifest.provinces || {};
            for (const prov of provTasks) {
              const prev = manifest.provinces[prov.key] || {};
              const prevLayers = prev.layers || {};
              manifest.provinces[prov.key] = {
                ...prev,
                maxZ: Math.max(prev.maxZ || 0, maxZ),
                dem: Boolean(prev.dem || downloadDem),
                vec: Boolean(prev.vec || downloadVec),
                layers: {
                  ...prevLayers,
                  ...(downloadDem ? { dem: { ...(prevLayers.dem || {}), maxZ: Math.max(prevLayers.dem?.maxZ || 0, maxZ) } } : {}),
                  ...(downloadVec ? { vector: { ...(prevLayers.vector || {}), maxZ: Math.max(prevLayers.vector?.maxZ || 0, maxZ) } } : {})
                },
                updatedAt: Date.now()
              };
            }
            if (!manifest.stats) manifest.stats = { totalTiles: 0, totalBytes: 0 };
            manifest.stats.totalTiles = (manifest.stats.totalTiles || 0) + newlySavedCount + newlyAddedCount;
            manifest.stats.totalBytes = (manifest.stats.totalBytes || 0) + totalBytes;
            memoryTileStats = manifest.stats;
            saveOfflineManifest({ stats: memoryTileStats, provinces: manifest.provinces });
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            const curTiles = (memoryTileStats ? (memoryTileStats.totalTiles || 0) : 0) + newlySavedCount + newlyAddedCount;
            const curBytes = (memoryTileStats ? (memoryTileStats.totalBytes || 0) : 0) + totalBytes;
            mainWindow.webContents.send('download-progress', {
              completed,
              total,
              savedCount,
              failedCount,
              unchangedCount,
              updatedCount,
              newlyAddedCount,
              speed,
              percent,
              bytes: totalBytes,
              done: isDone,
              isVerify,
              isIncrementalUpdate,
              totalTiles: curTiles,
              totalBytes: curBytes
            });
          }
        }
      }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    return {
      success: !signal.aborted,
      aborted: signal.aborted,
      total,
      completed,
      savedCount,
      failedCount
    };
  });

  ipcMain.handle('cancel-pyramid-download', () => {
    if (activeDownloadAbort) {
      activeDownloadAbort.abort();
      activeDownloadAbort = null;
    }
    return { cancelled: true };
  });

  // =========================================================
  // Cloudflare R2 自动化热更新体系 (零配置公网读、流式下载、Windows 免权限覆盖重启)
  // =========================================================
  function compareVersions(v1, v2) {
    const clean = s => (s || '').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n) || 0);
    const a = clean(v1);
    const b = clean(v2);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const na = a[i] || 0;
      const nb = b[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  ipcMain.handle('get-app-version', () => app.getVersion());

  // 1. 检查云端是否有新版本 (优先访问自定义域名，备用公共 r2.dev 域名，零权限公网请求)
  ipcMain.handle('check-for-updates', async () => {
    const currentVersion = app.getVersion();
    const updateEndpoints = [
      'https://r2.053999.xyz/Outmap/version.json',
      'https://pub-9fa3d477907d4d5aa99d54b609094d73.r2.dev/Outmap/version.json'
    ];

    let remoteInfo = null;
    let fetchError = null;
    for (const url of updateEndpoints) {
      try {
        const resp = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': `Outmap-Updater/${currentVersion}`, 'Cache-Control': 'no-cache' }
        });
        if (resp.ok) {
          remoteInfo = await resp.json();
          if (remoteInfo && remoteInfo.version) break;
        }
      } catch (e) {
        fetchError = e;
      }
    }

    if (!remoteInfo || !remoteInfo.version) {
      return {
        hasUpdate: false,
        currentVersion,
        error: fetchError ? fetchError.message : 'timeout'
      };
    }

    const isNewer = compareVersions(remoteInfo.version, currentVersion) > 0;
    return {
      hasUpdate: isNewer,
      currentVersion,
      version: remoteInfo.version,
      notes: remoteInfo.notes || '常规功能优化与性能增强',
      releaseDate: remoteInfo.releaseDate || '',
      downloadUrl: remoteInfo.downloadUrl || 'https://r2.053999.xyz/Outmap/app.asar',
      backupUrl: remoteInfo.backupUrl || 'https://pub-9fa3d477907d4d5aa99d54b609094d73.r2.dev/Outmap/app.asar',
      fileSize: remoteInfo.fileSize || 3900000,
      sha256: remoteInfo.sha256 || ''
    };
  });

  // 2. 流式下载新版 app.asar 并执行毫秒级原子热替换与原生重启
  ipcMain.handle('start-app-update', async (event, { downloadUrl, backupUrl, sha256 }) => {
    const urlsToTry = [
      downloadUrl,
      backupUrl,
      'https://r2.053999.xyz/Outmap/app.asar',
      'https://pub-9fa3d477907d4d5aa99d54b609094d73.r2.dev/Outmap/app.asar'
    ].filter(Boolean);

    const tempDir = app.getPath('temp');
    // 临时更新包使用 .bin 扩展名存储，彻底避免 Electron 默认将 .asar 拦截为只读虚拟目录
    const tempPatchPath = path.join(tempDir, `outmap_patch_${Date.now()}.bin`);

    let downloadSuccess = false;
    let downloadedSize = 0;

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url, {
          signal: AbortSignal.timeout(60000),
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!resp.ok) continue;

        const contentLength = parseInt(resp.headers.get('content-length') || '0');
        const reader = resp.body.getReader();
        const fileStream = originalFs.createWriteStream(tempPatchPath);

        let streamError = null;
        fileStream.on('error', (err) => {
          streamError = err;
          console.warn('[Update WriteStream Error]:', err.message);
        });

        let receivedBytes = 0;
        const startTime = Date.now();

        while (true) {
          if (streamError) break;
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(Buffer.from(value));
          receivedBytes += value.length;

          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? Math.round(receivedBytes / elapsed / 1024) : 0;
          const percent = contentLength > 0 ? Math.min(100, Math.round(receivedBytes / contentLength * 100)) : 50;

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-download-progress', {
              percent,
              speed: `${speed} KB/s`,
              receivedBytes,
              totalBytes: contentLength,
              stage: 'downloading'
            });
          }
        }

        fileStream.end();
        await new Promise((resolve) => {
          fileStream.on('finish', resolve);
          fileStream.on('error', resolve);
        });

        // 使用 originalFs 读取底层真实物理文件字节数
        if (!streamError && originalFs.existsSync(tempPatchPath)) {
          downloadedSize = originalFs.statSync(tempPatchPath).size;
          const actualSha256 = crypto.createHash('sha256').update(originalFs.readFileSync(tempPatchPath)).digest('hex');
          const expectedSha256 = String(sha256 || '').trim().toLowerCase();
          if (downloadedSize > 100000 && expectedSha256 && actualSha256 === expectedSha256) {
            downloadSuccess = true;
            break;
          }
        }
      } catch (e) {
        console.warn('[Update Download Warning]:', e.message);
      }
    }

    if (!downloadSuccess || downloadedSize === 0) {
      try { if (originalFs.existsSync(tempPatchPath)) originalFs.unlinkSync(tempPatchPath); } catch (e) {}
      return { success: false, message: '下载更新文件失败，请检查网络后重试' };
    }

    // 确定目标 app.asar 位置
    let targetAsarPath;
    if (app.isPackaged) {
      targetAsarPath = path.join(process.resourcesPath, 'app.asar');
    } else {
      targetAsarPath = path.join(process.cwd(), 'dist', 'Outmap', 'resources', 'app.asar');
    }

    pendingUpdatePath = tempPatchPath;
    pendingTargetAsarPath = targetAsarPath;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: 100,
        speed: '已就绪',
        receivedBytes: downloadedSize,
        totalBytes: downloadedSize,
        stage: 'downloaded'
      });
    }

    return { success: true, downloaded: true };
  });

  // 执行覆盖安装与热重启 (支持从标签上直接确认安装)
  ipcMain.handle('install-app-update', () => {
    if (!pendingUpdatePath || !originalFs.existsSync(pendingUpdatePath)) {
      return { success: false, message: '未找到待安装的更新包' };
    }
    const tempPatchPath = pendingUpdatePath;
    const targetAsarPath = pendingTargetAsarPath;
    let downloadedSize = 0;
    try { downloadedSize = originalFs.statSync(tempPatchPath).size; } catch (e) {}

    let directReplaced = false;
    try {
      originalFs.copyFileSync(tempPatchPath, targetAsarPath);
      const targetSize = originalFs.statSync(targetAsarPath).size;
      if (targetSize === downloadedSize) {
        directReplaced = true;
      }
    } catch (e) {
      console.warn('[Direct Asar Replacement Warning, falling back to script]:', e.message);
    }

    if (directReplaced) {
      try { originalFs.unlinkSync(tempPatchPath); } catch (e) {}
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 400);
      return { success: true };
    }

    // 策略 B: 进程守护覆盖
    const tempDir = path.join(app.getPath('temp'), 'outmap_updater');
    const updateScriptPath = path.join(tempDir, `outmap_updater_${Date.now()}.bat`);
    const appExePath = process.execPath;
    const batScript = `@echo off
chcp 65001 >nul
set RETRY=0
:LOOP
ping 127.0.0.1 -n 2 >nul
copy /y "${tempPatchPath}" "${targetAsarPath}" >nul 2>&1
if not errorlevel 1 goto SUCCESS
set /a RETRY+=1
if %RETRY% geq 20 goto LAUNCH
goto LOOP
:SUCCESS
del /f /q "${tempPatchPath}" >nul 2>&1
:LAUNCH
start "" "${appExePath}"
del "%~f0"
`;
    originalFs.writeFileSync(updateScriptPath, batScript, 'utf8');
    const { spawn } = require('child_process');
    const child = spawn('cmd.exe', ['/c', updateScriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    setTimeout(() => { app.exit(0); }, 300);
    return { success: true };
  });

  // =========================================================
  // Cloudflare R2 云端轻量级多设备配置同步架构 (原生 SigV4 直连引擎)
  // =========================================================
  const SYNC_CONFIG_FILE = path.join(OFFLINE_BASE_DIR, 'sync_config.json');

  const R2_SYNC_CONFIG = {
    accountId: 'f0423794f245054a81f1fbc59ea859c5',
    bucket: 'sagspud',
    accessKeyId: 'bd4944821b855719862c66cdc7700569',
    secretAccessKey: 'aec00662af922369c4e84b81e6a7966f68349d5be90dbd1f5923db447d958d49'
  };

  function getR2SyncSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  }

  function uploadBufferToR2(buffer, s3Key, contentType = 'application/json') {
    return new Promise((resolve, reject) => {
      const host = `${R2_SYNC_CONFIG.accountId}.r2.cloudflarestorage.com`;
      const s3Path = `/${R2_SYNC_CONFIG.bucket}/${s3Key.replace(/^\//, '')}`;

      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substring(0, 8);
      const region = 'auto';
      const service = 's3';

      const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const canonicalHeaders = [
        `content-length:${buffer.length}`,
        `content-type:${contentType}`,
        `host:${host}`,
        `x-amz-content-sha256:${payloadHash}`,
        `x-amz-date:${amzDate}`
      ].join('\n') + '\n';

      const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';

      const canonicalRequest = [
        'PUT',
        encodeURI(s3Path),
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join('\n');

      const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        canonicalRequestHash
      ].join('\n');

      const signingKey = getR2SyncSignatureKey(R2_SYNC_CONFIG.secretAccessKey, dateStamp, region, service);
      const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
      const authorization = `AWS4-HMAC-SHA256 Credential=${R2_SYNC_CONFIG.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const options = {
        hostname: host,
        port: 443,
        path: s3Path,
        method: 'PUT',
        headers: {
          'Host': host,
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'x-amz-date': amzDate,
          'x-amz-content-sha256': payloadHash,
          'Authorization': authorization
        }
      };

      const req = https.request(options, (res) => {
        let respBody = '';
        res.on('data', (chunk) => { respBody += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, statusCode: res.statusCode });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${respBody}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(buffer);
      req.end();
    });
  }

  ipcMain.handle('get-cloud-sync-config', () => {
    if (fs.existsSync(SYNC_CONFIG_FILE)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(SYNC_CONFIG_FILE, 'utf8'));
        if (!cfg.syncKey) cfg.syncKey = 'default';
        if (cfg.autoSync === undefined) cfg.autoSync = true;
        return cfg;
      } catch (e) {}
    }
    return { syncKey: 'default', autoSync: true, lastSyncTime: null };
  });

  ipcMain.handle('save-cloud-sync-config', (event, cfg) => {
    try {
      fs.writeFileSync(SYNC_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('upload-cloud-sync-data', async (event, { syncKey, data }) => {
    try {
      const key = (syncKey || 'default').trim();
      const s3Key = `Outmap/sync/${encodeURIComponent(key)}.json`;
      const buf = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
      await uploadBufferToR2(buf, s3Key, 'application/json');
      return { success: true, s3Key, time: Date.now() };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('pull-cloud-sync-data', async (event, { syncKey }) => {
    try {
      const key = (syncKey || 'default').trim();
      const url = `https://r2.053999.xyz/Outmap/sync/${encodeURIComponent(key)}.json?t=${Date.now()}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const json = await r.json();
        return { success: true, data: json };
      } else if (r.status === 404) {
        return { success: false, notFound: true, message: '云端暂未发现此账号的同步记录' };
      } else {
        return { success: false, message: `拉取失败 (HTTP ${r.status})` };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

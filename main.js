const { app, BrowserWindow, ipcMain, Menu, MenuItem, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
let originalFs = fs;
try {
  originalFs = require('original-fs');
} catch (e) {}

// Electron/Chromium 默认已经启用硬件加速、GPU 光栅化与自适应线程数。
// 不覆盖 GPU 黑名单、安全沙箱、V8 堆和缓存上限：这些“强制加速”开关会在
// 不同显卡/驱动上造成纹理抖动、内存常驻和渲染进程崩溃，反而降低稳定性。

let mainWindow;

// 更新任务在主进程内做缓存与并发合并：界面切换、重复点击或多个渲染器请求
// 都复用同一次检查/下载，不会重新联网或从头下载同一个 app.asar。
let appUpdateCheckCache = null;
let appUpdateCheckPromise = null;
let appUpdateDownloadPromise = null;
let pendingUpdatePath = null;
let pendingTargetAsarPath = null;
let pendingUpdateMeta = null;

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

// 旧图层仍属于用户离线数据，启动和更新均不自动删除。

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
    const tempFile = OFFLINE_MANIFEST_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(merged, null, 2), 'utf8');
    fs.renameSync(tempFile, OFFLINE_MANIFEST_FILE);
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

          try {
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
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }

          try {
            const onlineUrl = `https://tiles.openfreemap.org/fonts/${encodeURIComponent(fontName)}/${rangeFile}`;
            const fontResp = await fetch(onlineUrl, { signal: AbortSignal.timeout(8000) });
            if (fontResp.ok) {
              const buf = Buffer.from(await fontResp.arrayBuffer());
              try {
                await fs.promises.mkdir(fontDir, { recursive: true });
                await fs.promises.writeFile(localPath, buf);
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
          const upstreamController = new AbortController();
          req.once('aborted', () => upstreamController.abort());
          res.once('close', () => {
            if (!res.writableEnded) upstreamController.abort();
          });
          // Hash the complete coordinate list. Truncating long lists caused
          // unrelated many-waypoint routes to collide with the same cache file.
          const routeHash = crypto.createHash('sha256').update(`${profile}:${coordStr}`).digest('hex').slice(0, 32);
          const cleanKey = `route_${profile}_${routeHash}`;
          const localRoutePath = path.join(OFFLINE_ROUTE_DIR, `${cleanKey}.json`);

          // 1. 本地持久化路线缓存优先 (0.01ms 直出，100% 离线)
          if (fs.existsSync(localRoutePath)) {
            try {
              const data = await fs.promises.readFile(localRoutePath, 'utf8');
              const cached = data && data.length > 20 ? JSON.parse(data) : null;
              // Older versions persisted straight-line emergency results as if
              // they were road routes. Ignore those so the next request can heal.
              const cacheMeta = cached?.outmapRouteCache;
              const isCurrentProfileCache = cacheMeta?.schema === 2 && cacheMeta.profile === profile;
              // Legacy bike/foot cache files may contain geometry returned by
              // the public car-only backup used before v1.6.5. Only legacy
              // driving entries are safe to reuse; other profiles self-heal.
              const isSafeLegacyDrivingCache = profile === 'driving' && cached?.source === 'road-engine';
              if (cached && cached.source !== 'local-engine' && (isCurrentProfileCache || isSafeLegacyDrivingCache)) {
                res.writeHead(200, {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'private, max-age=3600',
                  'X-Route-Source': 'local-offline-cache'
                });
                res.end(data);
                return;
              }
              if (cached?.source === 'road-engine' && profile !== 'driving' && !isCurrentProfileCache) {
                fs.promises.rm(localRoutePath, { force: true }).catch(() => {});
              }
            } catch (e) {}
          }

          // 2. Three dedicated public OSRM profiles, multi-mirror failover, then persist real road data.
          const routedService = profile === 'bike' ? 'routed-bike' : (profile === 'foot' ? 'routed-foot' : 'routed-car');
          const mirrorUrls = [
            `https://routing.openstreetmap.de/${routedService}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
            profile === 'driving'
              ? `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`
              : null
          ].filter(Boolean);

          for (const osrmUrl of mirrorUrls) {
            try {
              if (upstreamController.signal.aborted || req.aborted || res.destroyed) return;
              const timeoutSignal = AbortSignal.timeout(8000);
              const upstreamSignal = typeof AbortSignal.any === 'function'
                ? AbortSignal.any([upstreamController.signal, timeoutSignal])
                : timeoutSignal;
              const osrmResp = await fetch(osrmUrl, { signal: upstreamSignal });
              if (osrmResp.ok) {
                const json = await osrmResp.json();
                if (json.code === 'Ok' && json.routes && json.routes.length > 0 && json.routes[0].distance > 0) {
                  json.source = 'road-engine';
                  json.outmapRouteCache = {
                    schema: 2,
                    profile,
                    provider: osrmUrl.includes('routing.openstreetmap.de') ? routedService : 'project-osrm',
                    createdAt: Date.now()
                  };
                  const text = JSON.stringify(json);
                  let tempRoutePath = null;
                  try {
                    tempRoutePath = `${localRoutePath}.${process.pid}.${Date.now()}.tmp`;
                    await fs.promises.writeFile(tempRoutePath, text, 'utf8');
                    await fs.promises.rename(tempRoutePath, localRoutePath);
                  } catch (e) {
                    if (tempRoutePath) fs.promises.rm(tempRoutePath, { force: true }).catch(() => {});
                  }
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
          }

          // The renderer already requested a newer route; do not keep computing
          // or attempt to write an emergency response to a closed connection.
          if (upstreamController.signal.aborted || req.aborted || res.destroyed) return;

          // 3. 离线/断网/超时时：本地三维地势连续折线路由引擎 (保障 100% 返回有效 GeoJSON，严禁缓存以支持自愈)
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
              source: 'local-engine',
              profile
            });

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
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

          try {
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
              fs.promises.unlink(localPath).catch(() => {});
            }
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
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

let inventoryScan = null;
let offlineDownloadRunning = false;
let mapInteractionActive = false;

function refreshOfflineInventory() {
  if (inventoryScan) return inventoryScan;
  const { Worker } = require('worker_threads');
  inventoryScan = new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'src', 'offline-worker.cjs'), {
      workerData: { baseDir: OFFLINE_BASE_DIR, provinces: CHINA_PROVINCE_BBOX_ENTRIES, boxes: CHINA_TILES_BOXES }
    });
    worker.on('message', msg => {
      if (msg && msg.type === 'progress') {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('offline-scan-progress', msg);
        }
        return;
      }
      const result = msg && msg.type === 'done' ? msg.result : (msg.result || msg);
      memoryTileStats = result.stats;
      saveOfflineManifest(result, true);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('offline-inventory-updated', result);
      }
      resolve(result.stats);
    });
    worker.once('error', reject);
    worker.once('exit', code => { if (code !== 0) reject(new Error('离线扫描异常退出: ' + code)); });
  }).finally(() => { inventoryScan = null; });
  return inventoryScan;
}

function getQuickTileCount(forceRefresh = false) {
  const manifest = loadOfflineManifest();
  if (!memoryTileStats) memoryTileStats = manifest.stats || { totalTiles: 0, totalBytes: 0 };
  const isStale = !manifest.stats?.lastScannedAt || (Date.now() - manifest.stats.lastScannedAt > 24 * 3600 * 1000);
  if (forceRefresh || manifest.inventoryVersion !== 3 || isStale) {
    refreshOfflineInventory().catch(error => console.warn('[Offline Scan]', error.message));
  }
  return { ...memoryTileStats, scanning: Boolean(inventoryScan) };
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
      mapInteractionActive = false;
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
      mapInteractionActive = false;
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
      satCount: stats.satCount || 0,
      vectorCount: stats.vectorCount || 0,
      fontCount: stats.fontCount || 0,
      totalTiles: stats.totalTiles || 0,
      totalBytes: stats.totalBytes || 0,
      scanning: stats.scanning,
      exact: stats.exact === true
    };
  });

  ipcMain.handle('rescan-offline-tiles', () => {
    return refreshOfflineInventory();
  });

  // 地图交互期间把后台下载主动让路给 WebGL 与本地切片服务。
  // 只保留少量下载 worker，不暂停任务；结束拖动/缩放后自动恢复满速。
  ipcMain.on('map-interaction-state', (_event, active) => {
    mapInteractionActive = Boolean(active);
  });

  ipcMain.handle('get-offline-manifest', async () => {
    if (loadOfflineManifest().inventoryVersion !== 3) await refreshOfflineInventory();
    return loadOfflineManifest();
  });

  ipcMain.handle('save-offline-manifest', (event, data) => {
    saveOfflineManifest(data, Boolean(data && data.replaceProvinces));
    return { success: true };
  });

  // 操作系统原生上下文菜单系统 (Windows 11 Fluent / macOS 原生系统级弹出)
  ipcMain.handle('show-map-context-menu', async (event, { lng, lat, ele, placeName }) => {
    return new Promise((resolve) => {
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const cleanName = (placeName || '选定地点').trim();
      const eleTxt = (typeof ele === 'number' && !isNaN(ele)) ? ` · ${Math.round(ele)}m` : '';
      const template = [
        {
          label: `${cleanName}${eleTxt}`,
          enabled: false
        },
        { type: 'separator' },
        {
          label: '收藏',
          click: () => resolve({ action: 'add-fav' })
        },
        {
          label: '设为途径点',
          click: () => resolve({ action: 'route-via' })
        },
        {
          label: '设为路线起点',
          click: () => resolve({ action: 'route-start' })
        },
        {
          label: '设为路线终点',
          click: () => resolve({ action: 'route-end' })
        },
        { type: 'separator' },
        {
          label: '复制经纬度坐标',
          click: () => {
            const text = `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
            clipboard.writeText(text);
            resolve({ action: 'copy-coords', text });
          }
        }
      ];

      const menu = Menu.buildFromTemplate(template);
      menu.popup({
        window: win,
        callback: () => {
          setTimeout(() => resolve({ action: null }), 50);
        }
      });
    });
  });

  // 操作系统原生文件保存对话框 (GPX 导出等)
  ipcMain.handle('save-file-dialog', async (event, { defaultPath, title, filters, content }) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: title || '导出路线轨迹 (GPX)',
        defaultPath: defaultPath || 'route.gpx',
        filters: filters || [
          { name: 'GPS Exchange Format (*.gpx)', extensions: ['gpx'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      });
      if (canceled || !filePath) return { success: false, canceled: true };
      await fs.promises.writeFile(filePath, content, 'utf8');
      return { success: true, filePath };
    } catch (err) {
      console.error('[save-file-dialog error]', err);
      return { success: false, error: err.message };
    }
  });

  // 操作系统原生文件打开对话框 (外部轨迹 GPX/KML/GeoJSON/TCX 导入)
  ipcMain.handle('open-file-dialog', async (event, { title, filters }) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: title || '选择路线轨迹文件',
        properties: ['openFile'],
        filters: filters || [
          { name: '轨迹路线文件 (*.gpx;*.kml;*.geojson;*.json;*.tcx)', extensions: ['gpx', 'kml', 'geojson', 'json', 'tcx'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      });
      if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };
      const filePath = filePaths[0];
      const content = await fs.promises.readFile(filePath, 'utf8');
      const filename = path.basename(filePath);
      return { success: true, filePath, filename, content };
    } catch (err) {
      console.error('[open-file-dialog error]', err);
      return { success: false, error: err.message };
    }
  });

  // 操作系统原生剪贴板通道
  ipcMain.handle('write-clipboard-text', (event, text) => {
    if (typeof text === 'string') {
      clipboard.writeText(text);
      return { success: true };
    }
    return { success: false };
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
    if (offlineDownloadRunning) return { success: false, message: '已有下载或校验正在进行，请先取消并等待结束' };
    offlineDownloadRunning = true;
    // These counters are also read by finally after every early return.
    let newlySavedCount = 0;
    let newlyAddedCount = 0;
    let finalInventoryRefreshed = false;
    try {
    if (activeDownloadAbort) {
      activeDownloadAbort.abort();
    }
    activeDownloadAbort = new AbortController();
    const signal = activeDownloadAbort.signal;
    if (inventoryScan) await inventoryScan;
    if (loadOfflineManifest().inventoryVersion !== 3) await refreshOfflineInventory();
    const baselineStats = { ...(memoryTileStats || loadOfflineManifest().stats || {}) };

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

    // A bounded async directory cache preserves existing tiles without blocking
    // the main event loop or trusting historical maxZ completion guesses.
    const dirFileSets = new Map();
    async function checkTileExistsFast(dirPath, fileName) {
      let pending = dirFileSets.get(dirPath);
      if (!pending) {
        pending = fs.promises.readdir(dirPath).then(names => new Set(names)).catch(error => {
          if (error.code !== 'ENOENT') throw error;
          return new Set();
        });
        dirFileSets.set(dirPath, pending);
        if (dirFileSets.size > 128) dirFileSets.delete(dirFileSets.keys().next().value);
      }
      const names = await pending;
      if (!names.has(fileName)) return false;
      try { return (await fs.promises.stat(path.join(dirPath, fileName))).size > 20; }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    }

    const { enumerateTiles } = require('./src/offline-worker.cjs');
    const plan = { provinces: provTasks, minZ: Math.max(0, minZ || 0), maxZ: Math.min(14, maxZ), downloadDem, downloadVec, boxes: CHINA_TILES_BOXES };
    let total = 0;
    for (const task of enumerateTiles(plan)) {
      total++;
      if (total % 4096 === 0) {
        await new Promise(resolve => setImmediate(resolve));
        if (signal.aborted) return { success: false, aborted: true, total: 0 };
      }
    }
    const tileIterator = enumerateTiles(plan);
    let completed = 0;
    let savedCount = 0;
    let failedCount = 0;
    let totalBytes = 0;
    let unchangedCount = 0;
    let updatedCount = 0;
    const startTime = Date.now();
    const concurrency = 24;
    const interactiveConcurrency = 4;
    const createdDirs = new Set();
    let lastProgressTime = 0;
    let lastTaskbarPct = -1;
    let activeProvName = '';
    let activeZ = 10;

    const speedSamples = [{ time: startTime, bytes: 0 }];

    async function worker(workerIndex) {
      while (!signal.aborted) {
        // Disk writes, decompression and network callbacks from dozens of
        // workers can contend with MapLibre. Keep four lanes alive so progress
        // remains continuous while reserving the machine for the active map.
        while (mapInteractionActive && workerIndex >= interactiveConcurrency && !signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        if (signal.aborted) break;
        const next = tileIterator.next();
        if (next.done) break;
        const task = next.value;
        if (task.provName) activeProvName = task.provName;
        if (task.z) activeZ = task.z;
        const { type, z, x, y, ext } = task;
        const localDir = type === 'dem' ? OFFLINE_DEM_DIR : OFFLINE_VEC_DIR;
        const dirPath = path.join(localDir, `${z}`, `${x}`);
        const fileName = `${y}.${ext}`;
        const localPath = path.join(dirPath, fileName);

        const existsLocally = await checkTileExistsFast(dirPath, fileName);

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
                    await fs.promises.mkdir(dirPath, { recursive: true });
                    createdDirs.add(dirKey);
                  }
                  await fs.promises.writeFile(localPath, buf);
                  if (dirFileSets.has(dirPath)) {
                    (await dirFileSets.get(dirPath)).add(fileName);
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
              const stat = await fs.promises.stat(localPath);
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
                  await fs.promises.mkdir(dirPath, { recursive: true });
                  createdDirs.add(dirKey);
                }
                await fs.promises.writeFile(localPath, buf);
                if (dirFileSets.has(dirPath)) {
                  (await dirFileSets.get(dirPath)).add(fileName);
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
        // 平滑节流进度广播 (250ms)，保持人眼感知流畅同时消除高频 IPC 与 DOM 重排带来的 CPU/GPU 负载
        if (isDone || (now - lastProgressTime >= 250)) {
          lastProgressTime = now;
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? Math.round(completed / elapsed) : 0;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 100;

          // 滑动时间窗口 (1.5秒) 计算实际网络实时下行字节速率 (B/s)
          speedSamples.push({ time: now, bytes: totalBytes });
          while (speedSamples.length > 2 && now - speedSamples[0].time > 1500) {
            speedSamples.shift();
          }
          let byteSpeed = 0;
          if (speedSamples.length >= 2) {
            const dt = (now - speedSamples[0].time) / 1000;
            const dBytes = totalBytes - speedSamples[0].bytes;
            if (dt > 0.15) {
              byteSpeed = Math.max(0, Math.round(dBytes / dt));
            }
          }
          if (byteSpeed === 0 && totalBytes > 0 && elapsed > 0) {
            byteSpeed = Math.round(totalBytes / elapsed);
          }

          // Completion is derived from disk after all workers settle, including
          // cancellations and failures. Never promote a whole province here.

          if (mainWindow && !mainWindow.isDestroyed()) {
            const ratio = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
            // 仅在任务栏百分比整数跳变时调用底层 Windows COM 接口，消除 DWM 窗口合成器持续重绘 GPU 占用
            const curPct = Math.floor(ratio * 100);
            if (curPct !== lastTaskbarPct || isDone) {
              lastTaskbarPct = curPct;
              mainWindow.setProgressBar(ratio);
            }
            const curTiles = (baselineStats.totalTiles || 0) + newlySavedCount + newlyAddedCount;
            const curBytes = (baselineStats.totalBytes || 0) + totalBytes;
            mainWindow.webContents.send('download-progress', {
              completed,
              total,
              savedCount,
              newlySavedCount,
              existingCount: Math.max(0, savedCount - newlySavedCount - newlyAddedCount - updatedCount),
              failedCount,
              unchangedCount,
              updatedCount,
              newlyAddedCount,
              speed,
              byteSpeed,
              percent,
              bytes: totalBytes,
              done: false,
              scanning: isDone,
              isVerify,
              isIncrementalUpdate,
              totalTiles: curTiles,
              totalBytes: curBytes,
              currentProvince: activeProvName,
              currentZ: activeZ
            });
          }
        }
      }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker(i));
    }
    await Promise.all(workers);
    // Discard any in-flight scan snapshot from before the last tile write.
    if (inventoryScan) await inventoryScan;
    const finalStats = await refreshOfflineInventory();
    finalInventoryRefreshed = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send('download-progress', {
        completed, total, savedCount, failedCount, unchangedCount, updatedCount, newlyAddedCount,
        percent: total ? Math.round(completed / total * 100) : 100,
        speed: 0, byteSpeed: 0, bytes: totalBytes, done: true, aborted: signal.aborted,
        isVerify, isIncrementalUpdate, ...finalStats
      });
    }

    return {
      success: !signal.aborted && failedCount === 0,
      aborted: signal.aborted,
      total,
      completed,
      savedCount,
      failedCount
    };
    } finally {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
      offlineDownloadRunning = false;
      activeDownloadAbort = null;
      if (!finalInventoryRefreshed && (newlySavedCount > 0 || newlyAddedCount > 0)) {
        refreshOfflineInventory().catch(() => {});
      }
    }
  });

  ipcMain.handle('cancel-pyramid-download', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
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
    const cacheTtlMs = 5 * 60 * 1000;
    if (appUpdateCheckCache
      && appUpdateCheckCache.currentVersion === currentVersion
      && Date.now() - appUpdateCheckCache.checkedAt < cacheTtlMs) {
      return appUpdateCheckCache.result;
    }
    if (appUpdateCheckPromise) return appUpdateCheckPromise;

    appUpdateCheckPromise = (async () => {
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
    })();

    try {
      const result = await appUpdateCheckPromise;
      appUpdateCheckCache = { currentVersion, checkedAt: Date.now(), result };
      return result;
    } finally {
      appUpdateCheckPromise = null;
    }
  });

  // 2. 流式下载新版 app.asar 并执行毫秒级原子热替换与原生重启
  ipcMain.handle('start-app-update', async (event, payload = {}) => {
    const { downloadUrl, backupUrl, sha256 } = payload;
    const expectedSha = String(sha256 || '').trim().toLowerCase();
    const updateKey = expectedSha || String(downloadUrl || backupUrl || '').trim();
    const emitCachedReady = () => {
      let cachedSize = 0;
      try { cachedSize = originalFs.statSync(pendingUpdatePath).size; } catch (e) {}
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
        mainWindow.webContents.send('update-download-progress', {
          percent: 100,
          speed: '已就绪',
          receivedBytes: cachedSize,
          totalBytes: cachedSize,
          stage: 'downloaded',
          cached: true
        });
      }
    };

    // 已经下载过同一份校验值时直接复用临时包，切换页面或重复点击不会重下。
    if (pendingUpdatePath && originalFs.existsSync(pendingUpdatePath)
      && pendingUpdateMeta?.key && pendingUpdateMeta.key === updateKey) {
      emitCachedReady();
      return { success: true, downloaded: true, cached: true };
    }
    if (appUpdateDownloadPromise) return appUpdateDownloadPromise;

    // 请求了不同版本时清理旧的临时包，避免临时目录长期堆积。
    if (pendingUpdatePath && pendingUpdateMeta?.key && pendingUpdateMeta.key !== updateKey) {
      try { if (originalFs.existsSync(pendingUpdatePath)) originalFs.unlinkSync(pendingUpdatePath); } catch (e) {}
      pendingUpdatePath = null;
      pendingTargetAsarPath = null;
      pendingUpdateMeta = null;
    }

    appUpdateDownloadPromise = (async () => {
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
        let lastUpdateProgressTime = 0;
        let lastUpdatePct = -1;

        while (true) {
          if (streamError) break;
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(Buffer.from(value));
          receivedBytes += value.length;

          const now = Date.now();
          const percent = contentLength > 0 ? Math.min(100, Math.round(receivedBytes / contentLength * 100)) : 50;

          if (now - lastUpdateProgressTime >= 250 || receivedBytes >= contentLength) {
            lastUpdateProgressTime = now;
            const elapsed = (now - startTime) / 1000;
            const speed = elapsed > 0 ? Math.round(receivedBytes / elapsed / 1024) : 0;

            if (mainWindow && !mainWindow.isDestroyed()) {
              if (percent !== lastUpdatePct) {
                lastUpdatePct = percent;
                mainWindow.setProgressBar(Math.min(1, Math.max(0, percent / 100)));
              }
              mainWindow.webContents.send('update-download-progress', {
                percent,
                speed: `${speed} KB/s`,
                receivedBytes,
                totalBytes: contentLength,
                stage: 'downloading'
              });
            }
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
          const expectedSha256 = expectedSha;
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
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(1, { mode: 'error' });
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
    pendingUpdateMeta = { key: updateKey, sha256: expectedSha, downloadUrl, backupUrl };

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send('update-download-progress', {
        percent: 100,
        speed: '已就绪',
        receivedBytes: downloadedSize,
        totalBytes: downloadedSize,
        stage: 'downloaded'
      });
    }

    return { success: true, downloaded: true };
    })();

    try {
      return await appUpdateDownloadPromise;
    } finally {
      appUpdateDownloadPromise = null;
    }
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
      pendingUpdatePath = null;
      pendingTargetAsarPath = null;
      pendingUpdateMeta = null;
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

  function pullBufferFromR2(s3Key) {
    return new Promise((resolve, reject) => {
      const host = `${R2_SYNC_CONFIG.accountId}.r2.cloudflarestorage.com`;
      const s3Path = `/${R2_SYNC_CONFIG.bucket}/${s3Key.replace(/^\//, '')}`;

      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substring(0, 8);
      const region = 'auto';
      const service = 's3';

      const payloadHash = crypto.createHash('sha256').update('').digest('hex');

      const canonicalHeaders = [
        `host:${host}`,
        `x-amz-content-sha256:${payloadHash}`,
        `x-amz-date:${amzDate}`
      ].join('\n') + '\n';

      const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

      const canonicalRequest = [
        'GET',
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
        method: 'GET',
        headers: {
          'Host': host,
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
            try {
              const json = JSON.parse(respBody);
              resolve({ success: true, data: json });
            } catch (e) {
              reject(new Error('JSON解析失败: ' + e.message));
            }
          } else if (res.statusCode === 404) {
            resolve({ success: false, notFound: true, message: '云端暂未发现此账号的同步记录' });
          } else {
            reject(new Error(`S3 GET HTTP ${res.statusCode}: ${respBody}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });
      req.end();
    });
  }

  ipcMain.handle('pull-cloud-sync-data', async (event, { syncKey }) => {
    const key = (syncKey || 'default').trim();
    // 1. 直读 R2 源站，避免 CDN 尚未刷新时把另一端的新收藏误当作旧数据。
    try {
      const s3Key = `Outmap/sync/${encodeURIComponent(key)}.json`;
      const direct = await pullBufferFromR2(s3Key);
      if (direct.success || direct.notFound) return direct;
    } catch (_) {}

    // 2. 源站临时不可用时再走公网 CDN 兜底。
    try {
      const url = `https://r2.053999.xyz/Outmap/sync/${encodeURIComponent(key)}.json?t=${Date.now()}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (r.ok) return { success: true, data: await r.json() };
      if (r.status === 404) return { success: false, notFound: true, message: '云端暂未发现此账号的同步记录' };
      return { success: false, message: `CDN GET HTTP ${r.status}` };
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

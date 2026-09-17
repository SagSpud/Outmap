/**
 * Outmap 独立等高线离线预生成工具 (generate-contour-tool.cjs)
 * 
 * 功能特性：
 * 1. 支持指定任意本地 DEM 切片目录 (--dem <path>)，100% 离线急速批量转换为 MVT 矢量等高线。
 * 2. 自动打包生成标准 PMTiles 单文件归档 (--output <path>) 或散列目录 (--output-type dir)。
 * 3. 支持选择是否从云端智能补充缺失 DEM 切片 (--fetch-missing)。
 * 4. 内置平滑边缘垫底机制，离线边界瓦片 100% 不报错、不中断。
 * 5. 优雅的控制台实时进度条与性能统计。
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { buildPmtilesBuffer } = require('../src/tile-archive.cjs');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    demDir: path.resolve(__dirname, '..', 'dist', 'offline-tiles', 'dem'),
    output: path.resolve(__dirname, '..', 'dist', 'offline-tiles', 'archives', 'contour_metric-v1.pmtiles'),
    outputType: 'pmtiles',
    levels: '6-12',
    bbox: null,
    fetchMissing: false,
    concurrency: 8,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dem' && i + 1 < args.length) {
      options.demDir = path.resolve(args[++i]);
    } else if (arg === '--output' && i + 1 < args.length) {
      options.output = path.resolve(args[++i]);
    } else if (arg === '--output-type' && i + 1 < args.length) {
      options.outputType = args[++i].toLowerCase();
    } else if ((arg === '--levels' || arg === '--zoom') && i + 1 < args.length) {
      options.levels = args[++i];
    } else if (arg === '--bbox' && i + 1 < args.length) {
      options.bbox = args[++i];
    } else if (arg === '--fetch-missing') {
      options.fetchMissing = true;
    } else if (arg === '--concurrency' && i + 1 < args.length) {
      options.concurrency = parseInt(args[++i], 10) || 8;
    }
  }

  return options;
}

// 打印帮助信息
function printHelp() {
  console.log(`
============================================================
🏔️  Outmap 等高线离线预生成独立工具
============================================================
用法:
  electron ./scripts/generate-contour-tool.cjs [选项]

选项:
  --dem <path>            指定本地 DEM 切片所在文件夹 (默认: dist/offline-tiles/dem)
  --output <path>         输出等高线 PMTiles 文件或目录 (默认: dist/offline-tiles/archives/contour_metric-v1.pmtiles)
  --output-type <type>    输出格式: pmtiles (单文件归档) 或 dir (散列瓦片目录)
  --levels <min-max>      等高线生成层级范围 (如: 6-12, 10-12, 默认: 6-12)
  --bbox <w,s,e,n>        限制经纬度范围 (如: 102.5,30.5,103.5,31.5, 默认: 扫描DEM所有可用范围)
  --fetch-missing         若本地缺失某些 DEM 切片，自动从云端补充下载并存入本地
  --concurrency <num>     并发处理瓦片批次数 (默认: 8)
  -h, --help              显示此帮助信息
============================================================
`);
}

// 创建 Terrarium 格式 0 米海拔（海平面平地）回退切片 (RGBA 128, 0, 0, 255)
function createFlatTerrariumPng(width = 256, height = 256) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // PNG filter type none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      raw[px] = 128;     // R
      raw[px + 1] = 0;   // G
      raw[px + 2] = 0;   // B
      raw[px + 3] = 255; // A
    }
  }
  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crcBuf = Buffer.concat([t, data]);
    const crc = zlib.crc32(crcBuf);
    const crcBytes = Buffer.alloc(4);
    crcBytes.writeUInt32BE(crc, 0);
    return Buffer.concat([len, t, data, crcBytes]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([header, chunk('IHDR', ihdr), idat, iend]);
}

const FLAT_DEM_FALLBACK = createFlatTerrariumPng();

// 经纬度转瓦片坐标
function lonLatToTile(lon, lat, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

// 扫描本地 DEM 目录或根据 bbox 收集需要生成的瓦片清单
function scanTilesToGenerate(options) {
  const { demDir, levels, bbox } = options;
  let [minZ, maxZ] = levels.split('-').map(s => parseInt(s.trim(), 10));
  if (isNaN(minZ)) minZ = 6;
  if (isNaN(maxZ)) maxZ = 12;
  if (minZ > maxZ) { const t = minZ; minZ = maxZ; maxZ = t; }

  const tiles = [];
  const tileSet = new Set();

  if (bbox) {
    const [w, s, e, n] = bbox.split(',').map(v => parseFloat(v.trim()));
    if (!isNaN(w) && !isNaN(s) && !isNaN(e) && !isNaN(n)) {
      for (let z = minZ; z <= maxZ; z++) {
        const minTile = lonLatToTile(w, n, z);
        const maxTile = lonLatToTile(e, s, z);
        for (let x = Math.min(minTile.x, maxTile.x); x <= Math.max(minTile.x, maxTile.x); x++) {
          for (let y = Math.min(minTile.y, maxTile.y); y <= Math.max(minTile.y, maxTile.y); y++) {
            const key = `${z}/${x}/${y}`;
            if (!tileSet.has(key)) {
              tileSet.add(key);
              tiles.push({ z, x, y });
            }
          }
        }
      }
      return tiles;
    }
  }

  // 默认模式：自动扫描 DEM 目录现有的切片
  if (fs.existsSync(demDir)) {
    const zDirs = fs.readdirSync(demDir).filter(d => {
      const zVal = parseInt(d, 10);
      return !isNaN(zVal) && zVal >= minZ && zVal <= maxZ && fs.statSync(path.join(demDir, d)).isDirectory();
    });

    for (const zStr of zDirs) {
      const z = parseInt(zStr, 10);
      const zPath = path.join(demDir, zStr);
      const xDirs = fs.readdirSync(zPath).filter(d => {
        return fs.statSync(path.join(zPath, d)).isDirectory();
      });

      for (const xStr of xDirs) {
        const x = parseInt(xStr, 10);
        const xPath = path.join(zPath, xStr);
        const files = fs.readdirSync(xPath).filter(f => f.endsWith('.webp') || f.endsWith('.png'));

        for (const file of files) {
          const y = parseInt(file.split('.')[0], 10);
          if (!isNaN(y)) {
            const key = `${z}/${x}/${y}`;
            if (!tileSet.has(key)) {
              tileSet.add(key);
              tiles.push({ z, x, y });
            }
          }
        }
      }
    }
  }

  return tiles;
}

// 联网补充下载单个 DEM 切片
function downloadDemTile(z, x, y, savePath) {
  return new Promise((resolve) => {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        try {
          fs.mkdirSync(path.dirname(savePath), { recursive: true });
          fs.writeFileSync(savePath, buf);
        } catch (_) {}
        resolve(buf);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// 控制台进度条
function renderProgressBar(current, total, startTime, extraText = '') {
  const width = 30;
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(width * pct);
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
  const percentStr = (pct * 100).toFixed(1) + '%';
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = elapsed > 0 ? (current / elapsed).toFixed(1) : '0';
  const remainingSec = speed > 0 ? Math.max(0, Math.round((total - current) / speed)) : 0;
  const etaStr = remainingSec > 60 ? `${Math.floor(remainingSec / 60)}m${remainingSec % 60}s` : `${remainingSec}s`;

  process.stdout.write(`\r[${bar}] ${percentStr} | ${current}/${total} | ${speed} tiles/s | 剩余: ${etaStr} ${extraText}   `);
}

// 主流程
app.whenReady().then(async () => {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    app.exit(0);
    return;
  }

  console.log('============================================================');
  console.log('🏔️   Outmap 等高线离线预生成独立工具');
  console.log('============================================================');
  console.log(`📂  DEM 来源目录 : ${options.demDir}`);
  console.log(`🎯  目标输出路径 : ${options.output}`);
  console.log(`📦  输出模式     : ${options.outputType === 'dir' ? '散列瓦片目录' : 'PMTiles 单文件归档'}`);
  console.log(`🌐  联网补充模式 : ${options.fetchMissing ? '已开启 (自动下载缺失切片)' : '已关闭 (纯本地离线模式)'}`);
  console.log(`📐  生成层级范围 : Zoom ${options.levels}`);

  const tiles = scanTilesToGenerate(options);
  if (tiles.length === 0) {
    console.log('\n⚠️  未在指定路径发现可用的 DEM 瓦片！请确认 DEM 文件夹是否正确。');
    console.log('    例如: dist/offline-tiles/dem 目录下应包含 10/ 11/ 12/ 等子目录。');
    app.exit(1);
    return;
  }

  console.log(`📊  检测到待生成切片: ${tiles.length} 张`);
  console.log('------------------------------------------------------------');

  // 1. 启动内部轻量级 DEM 桥接服务器
  let downloadedCount = 0;
  const server = http.createServer(async (req, res) => {
    const match = /^\/dem\/(\d+)\/(\d+)\/(\d+)\.(webp|png)/.exec(req.url);
    if (!match) {
      res.writeHead(404); res.end(); return;
    }
    const [, tz, tx, ty, ext] = match;

    // 优先匹配本地 webp
    const localWebp = path.join(options.demDir, tz, tx, `${ty}.webp`);
    if (fs.existsSync(localWebp)) {
      const data = fs.readFileSync(localWebp);
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': data.length });
      res.end(data);
      return;
    }

    // 匹配本地 png
    const localPng = path.join(options.demDir, tz, tx, `${ty}.png`);
    if (fs.existsSync(localPng)) {
      const data = fs.readFileSync(localPng);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': data.length });
      res.end(data);
      return;
    }

    // 若本地没有且开启了联网补充
    if (options.fetchMissing) {
      const downloaded = await downloadDemTile(tz, tx, ty, localPng);
      if (downloaded) {
        downloadedCount++;
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': downloaded.length });
        res.end(downloaded);
        return;
      }
    }

    // 纯离线或云端无切片：采用海平面 0m 平滑垫底，确保边界接缝不中断
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': FLAT_DEM_FALLBACK.length });
    res.end(FLAT_DEM_FALLBACK);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // 2. 启动 Headless Chromium 解码渲染环境
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, webSecurity: false, backgroundThrottling: false }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // 等待 mlcontour 与 map 初始化就绪
  await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 300 && (!window.mlcontour || !window.mapInstance?.__outmapStyleReady); i++) {
      await sleep(25);
    }
  })()`);

  console.log('🚀  正在高速并发提取等高线矢量瓦片...\n');
  const startTime = Date.now();
  const generatedTiles = [];
  const batchSize = Math.max(1, options.concurrency * 2);

  // 确立各层级等高线间隔
  const contourThresholds = {
    6: [1000, 2500], 7: [1000, 2500],
    8: [500, 2000],  9: [500, 2000],
    10: [200, 1000],
    11: [100, 500],  12: [100, 500],
    13: [50, 250],   14: [20, 100], 15: [10, 50]
  };

  // 分批发送至 Chromium 渲染内核执行 Marching Squares 矢量提取
  for (let i = 0; i < tiles.length; i += batchSize) {
    const chunk = tiles.slice(i, i + batchSize);

    const batchResults = await win.webContents.executeJavaScript(`(async () => {
      if (!window.__contourGenManager) {
        window.__contourGenManager = new mlcontour.LocalDemManager({
          demUrlPattern: 'http://127.0.0.1:${port}/dem/{z}/{x}/{y}.webp',
          encoding: 'terrarium',
          maxzoom: 12,
          cacheSize: 256,
          timeoutMs: 12000
        });
      }
      const mgr = window.__contourGenManager;
      const tasks = ${JSON.stringify(chunk)};
      const thresholds = ${JSON.stringify(contourThresholds)};

      const results = [];
      await Promise.all(tasks.map(async (t) => {
        try {
          const levels = thresholds[t.z] || [100, 500];
          const contour = await mgr.fetchContourTile(t.z, t.x, t.y, {
            levels,
            elevationKey: 'ele',
            levelKey: 'level',
            multiplier: 1
          }, new AbortController());

          if (contour && contour.arrayBuffer && contour.arrayBuffer.byteLength > 0) {
            results.push({
              z: t.z, x: t.x, y: t.y,
              bytes: Array.from(new Uint8Array(contour.arrayBuffer))
            });
          }
        } catch (e) {
          // 容错处理
        }
      }));
      return results;
    })()`);

    if (Array.isArray(batchResults)) {
      for (const res of batchResults) {
        const buf = Buffer.from(res.bytes);
        if (options.outputType === 'dir') {
          // 散列瓦片模式：直接写盘
          const outTilePath = path.join(options.output, String(res.z), String(res.x), `${res.y}.pbf`);
          fs.mkdirSync(path.dirname(outTilePath), { recursive: true });
          fs.writeFileSync(outTilePath, buf);
        } else {
          generatedTiles.push({ z: res.z, x: res.x, y: res.y, data: buf });
        }
      }
    }

    renderProgressBar(
      Math.min(tiles.length, i + chunk.length),
      tiles.length,
      startTime,
      options.fetchMissing && downloadedCount > 0 ? `(云端补充: ${downloadedCount})` : ''
    );
  }

  renderProgressBar(tiles.length, tiles.length, startTime);
  console.log('\n------------------------------------------------------------');

  server.close();
  win.destroy();

  // 3. 输出打包与持久化
  if (options.outputType === 'pmtiles') {
    console.log(`📦  正在封装并建立空间单文件索引 (PMTiles v3)...`);
    fs.mkdirSync(path.dirname(options.output), { recursive: true });

    const pmtilesBuf = buildPmtilesBuffer(generatedTiles, {
      type: 'contour',
      tileType: 'mvt',
      name: 'Outmap Metric Contours Archive'
    });

    fs.writeFileSync(options.output, pmtilesBuf);
    const sizeMb = (pmtilesBuf.length / (1024 * 1024)).toFixed(2);
    console.log(`✅  PMTiles 归档成功生成！大小: ${sizeMb} MB`);
  } else {
    console.log(`✅  散列瓦片已全部输出至目录: ${options.output}`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️   总计耗时: ${totalTime} 秒`);
  console.log(`📁  输出位置: ${options.output}`);
  console.log('💡  说明: Outmap 客户端在启动时会自动优先直读 archives 目录下的 PMTiles，');
  console.log('    您生成的等高线已具备毫秒级秒开能力，无需任何二次配置！');
  console.log('============================================================\n');

  app.exit(0);
});

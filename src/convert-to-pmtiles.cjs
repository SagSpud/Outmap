'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { zxyToTileId, TileType } = require('pmtiles');

let tileArchive;
try {
  tileArchive = require('./tile-archive.cjs');
} catch (_) {
  tileArchive = require('../src/tile-archive.cjs');
}
const { serializeDirectory, buildPmtilesHeader, buildPmtilesBuffer } = tileArchive;

async function convertDirectoryToPmtiles(options = {}) {
  const inputDir = path.resolve(options.inputDir);
  const outputFile = path.resolve(options.outputFile);
  const type = options.type || 'vector'; // vector, dem, contour, sat
  const taskName = options.taskName || type;
  const onProgress = options.onProgress || (() => {});

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  // 1. Scan directory structure for files (Metadata only, NO memory buffer allocations)
  let scanDir = inputDir;
  if (fs.existsSync(path.join(inputDir, 'metric-v1')) && fs.statSync(path.join(inputDir, 'metric-v1')).isDirectory()) {
    scanDir = path.join(inputDir, 'metric-v1');
  }
  const zDirs = fs.readdirSync(scanDir, { withFileTypes: true }).filter(d => d.isDirectory());

  const tiles = [];
  let totalBytes = 0;
  let minZoom = 255;
  let maxZoom = 0;
  let lastLogTime = Date.now();

  console.log(`[PMTiles 转换器] 正在高速扫描瓦片索引: ${inputDir}...`);

  for (const zDir of zDirs) {
    const z = parseInt(zDir.name, 10);
    if (isNaN(z)) continue;
    if (z < minZoom) minZoom = z;
    if (z > maxZoom) maxZoom = z;

    const zPath = path.join(scanDir, zDir.name);
    const xDirs = fs.readdirSync(zPath, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const xDir of xDirs) {
      const x = parseInt(xDir.name, 10);
      if (isNaN(x)) continue;
      const xPath = path.join(zPath, xDir.name);
      const files = fs.readdirSync(xPath, { withFileTypes: true }).filter(f => f.isFile());

      for (const file of files) {
        const yStr = file.name.split('.')[0];
        const y = parseInt(yStr, 10);
        if (isNaN(y)) continue;

        const tilePath = path.join(xPath, file.name);
        try {
          const stat = fs.statSync(tilePath);
          if (stat.size > 0) {
            tiles.push({
              z,
              x,
              y,
              tileId: zxyToTileId(z, x, y),
              filePath: tilePath,
              size: stat.size
            });
            totalBytes += stat.size;
          }
        } catch (_) {}
      }
    }

    const now = Date.now();
    if (now - lastLogTime > 150) {
      lastLogTime = now;
      process.stdout.write(`\r🔍 [扫描索引] 已发现 ${tiles.length.toLocaleString()} 个切片 (当前层级: Z${z})...`);
      onProgress({ stage: 'scan', scannedTiles: tiles.length, currentZ: z, taskName });
    }
  }

  process.stdout.write(`\r🔍 [扫描索引] 扫描完成: 共 ${tiles.length.toLocaleString()} 个有效切片，总大小 ${(totalBytes / 1024 / 1024).toFixed(2)} MB    \n`);

  if (tiles.length === 0) {
    throw new Error(`未在 ${inputDir} 发现任何有效瓦片切片`);
  }
  if (minZoom === 255) minZoom = 0;

  // 2. Sort by PMTiles tileId (Hilbert ordering)
  console.log(`⚡ 正在构建空间瓦片索引 (Hilbert Sort)...`);
  tiles.sort((a, b) => (a.tileId < b.tileId ? -1 : a.tileId > b.tileId ? 1 : 0));

  // 3. Build Directory Entries & Offsets
  const entries = [];
  let currentOffset = 0;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    entries.push({
      tileId: t.tileId,
      offset: currentOffset,
      length: t.size,
      runLength: 1
    });
    currentOffset += t.size;
  }

  const rootDirBuffer = serializeDirectory(entries);

  const metaObj = {
    name: options.name || path.basename(outputFile, '.pmtiles'),
    attribution: 'Outmap Offline Archive',
    type: type || 'overlay',
    version: '1.0.0',
    minzoom: minZoom,
    maxzoom: maxZoom,
    ...(options.metadata || {})
  };
  const jsonMetaGz = zlib.gzipSync(Buffer.from(JSON.stringify(metaObj)));

  const rootDirOffset = 127;
  const rootDirLength = rootDirBuffer.length;
  const jsonOffset = rootDirOffset + rootDirLength;
  const jsonLength = jsonMetaGz.length;
  const dataOffset = jsonOffset + jsonLength;
  const dataLength = totalBytes;

  let pmtilesTileType = TileType.Mvt;
  if (type === 'dem') pmtilesTileType = TileType.Webp;
  else if (type === 'sat') pmtilesTileType = TileType.Jpeg;

  const header = buildPmtilesHeader({
    rootDirOffset,
    rootDirLength,
    jsonOffset,
    jsonLength,
    dataOffset,
    dataLength,
    numTiles: tiles.length,
    numEntries: entries.length,
    minZoom,
    maxZoom,
    tileType: pmtilesTileType
  });

  // 4. Stream Direct-to-Disk Writing with 4MB Chunk Buffer
  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tempFile = `${outputFile}.${process.pid}.${Date.now()}.tmp`;
  const outFd = fs.openSync(tempFile, 'w');

  // Write header + directory + metadata
  fs.writeSync(outFd, header);
  fs.writeSync(outFd, rootDirBuffer);
  fs.writeSync(outFd, jsonMetaGz);

  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB write buffer
  const chunkBuf = Buffer.allocUnsafe(CHUNK_SIZE);
  let chunkPos = 0;

  const startTime = Date.now();
  lastLogTime = startTime;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const fileBuf = fs.readFileSync(t.filePath);

    if (chunkPos + fileBuf.length > CHUNK_SIZE) {
      fs.writeSync(outFd, chunkBuf, 0, chunkPos);
      chunkPos = 0;
    }

    if (fileBuf.length > CHUNK_SIZE) {
      fs.writeSync(outFd, fileBuf);
    } else {
      fileBuf.copy(chunkBuf, chunkPos);
      chunkPos += fileBuf.length;
    }

    const now = Date.now();
    if (now - lastLogTime > 200 || i === tiles.length - 1) {
      lastLogTime = now;
      const pct = (((i + 1) / tiles.length) * 100).toFixed(1);
      const elapsedSec = Math.max(0.1, (now - startTime) / 1000);
      const speed = Math.round((i + 1) / elapsedSec);
      const remainingSec = Math.max(0, Math.round((tiles.length - i - 1) / speed));

      process.stdout.write(`\r💾 [流式写入] 进度: ${pct}% (${(i + 1).toLocaleString()} / ${tiles.length.toLocaleString()}) | 速度: ${speed.toLocaleString()} 瓦片/秒 | 预估剩余: ${remainingSec}s    `);

      onProgress({
        stage: 'write',
        taskName,
        written: i + 1,
        total: tiles.length,
        percent: parseFloat(pct),
        speed,
        remainingSec
      });
    }
  }

  if (chunkPos > 0) {
    fs.writeSync(outFd, chunkBuf, 0, chunkPos);
    chunkPos = 0;
  }

  fs.closeSync(outFd);
  process.stdout.write('\n');

  // Atomic file replace
  try {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    fs.renameSync(tempFile, outputFile);
  } catch (_) {
    fs.copyFileSync(tempFile, outputFile);
    try { fs.unlinkSync(tempFile); } catch (_) {}
  }

  const stats = fs.statSync(outputFile);
  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ [PMTiles 转换器] 写入完成！总耗时: ${totalSec}s | 单文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB | 瓦片数: ${tiles.length.toLocaleString()}`);

  return {
    outputFile,
    tileCount: tiles.length,
    fileSize: stats.size
  };
}

function resolveDefaultOfflineDir() {
  const candidates = [
    '../offline-tiles',
    'offline-tiles',
    'dist/offline-tiles'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'offline-tiles';
}

async function convertAllOfflineTiles(baseDir, onProgress = () => {}) {
  const targetBase = baseDir || resolveDefaultOfflineDir();
  const archivesDir = path.join(targetBase, 'archives');
  if (!fs.existsSync(archivesDir)) fs.mkdirSync(archivesDir, { recursive: true });

  const tasks = [
    { dir: path.join(targetBase, 'dem'), out: path.join(archivesDir, 'dem.pmtiles'), type: 'dem', name: 'DEM 高程瓦片' },
    { dir: path.join(targetBase, 'vector'), out: path.join(archivesDir, 'vector.pmtiles'), type: 'vector', name: 'Vector 矢量底图瓦片' },
    { dir: path.join(targetBase, 'contour'), out: path.join(archivesDir, 'contour_metric-v1.pmtiles'), type: 'contour', name: 'Contour 等高线瓦片' }
  ];

  const results = [];
  for (const t of tasks) {
    if (fs.existsSync(t.dir)) {
      console.log(`\n----------------------------------------`);
      console.log(`正在检查并转换 ${t.name}:`);
      console.log(`  源目录: ${t.dir}`);
      console.log(`  目标文件: ${t.out}`);
      try {
        const res = await convertDirectoryToPmtiles({
          inputDir: t.dir,
          outputFile: t.out,
          type: t.type,
          taskName: t.name,
          onProgress: p => onProgress({ task: t.type, taskName: t.name, ...p })
        });
        results.push(res);
      } catch (err) {
        console.warn(`  ⚠️ 转换跳过或异常: ${err.message}`);
      }
    } else {
      console.log(`\n[跳过] 未检测到目录: ${t.dir}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 任务执行完毕！成功处理 ${results.length} 项离线瓦片归档。`);
  console.log(`📁 目标单文件存放目录: ${archivesDir}`);
  console.log(`========================================\n`);
  return results;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--all') || args.length === 0) {
    convertAllOfflineTiles().catch(err => {
      console.error('Batch conversion error:', err);
      process.exit(1);
    });
  } else if (args.length >= 2) {
    const inputDir = args[0];
    const outputFile = args[1];
    const type = args[2] || 'vector';

    convertDirectoryToPmtiles({ inputDir, outputFile, type })
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Conversion error:', err.message);
        process.exit(1);
      });
  } else {
    console.log('Usage: Outmap.exe convert-to-pmtiles.cjs [--all] | [<inputDir> <outputFile.pmtiles> [type]]');
    process.exit(1);
  }
}

module.exports = { convertDirectoryToPmtiles, convertAllOfflineTiles };

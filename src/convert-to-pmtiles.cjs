'use strict';

const fs = require('fs');
const path = require('path');

let buildPmtilesBuffer;
try {
  buildPmtilesBuffer = require('./tile-archive.cjs').buildPmtilesBuffer;
} catch (_) {
  buildPmtilesBuffer = require('../src/tile-archive.cjs').buildPmtilesBuffer;
}

async function convertDirectoryToPmtiles(options = {}) {
  const inputDir = path.resolve(options.inputDir);
  const outputFile = path.resolve(options.outputFile);
  const type = options.type || 'vector'; // vector, dem, contour, sat
  const onProgress = options.onProgress || (() => {});

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  console.log(`[PMTiles Converter] Scanning tiles in ${inputDir}...`);
  const tiles = [];

  // Directory structure: inputDir/{z}/{x}/{y}.ext or inputDir/metric-v1/{z}/{x}/{y}.ext
  let scanDir = inputDir;
  if (fs.existsSync(path.join(inputDir, 'metric-v1')) && fs.statSync(path.join(inputDir, 'metric-v1')).isDirectory()) {
    scanDir = path.join(inputDir, 'metric-v1');
  }
  const zDirs = fs.readdirSync(scanDir, { withFileTypes: true }).filter(d => d.isDirectory());

  for (const zDir of zDirs) {
    const z = parseInt(zDir.name, 10);
    if (isNaN(z)) continue;
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
          const data = fs.readFileSync(tilePath);
          if (data.length > 0) {
            tiles.push({ z, x, y, data });
          }
        } catch (_) {}
      }
    }
    onProgress({ scannedTiles: tiles.length, currentZ: z });
  }

  console.log(`[PMTiles Converter] Found ${tiles.length} valid tiles. Building PMTiles archive...`);
  if (tiles.length === 0) {
    throw new Error(`No valid tiles found in ${inputDir}`);
  }

  const pmtilesBuffer = buildPmtilesBuffer(tiles, {
    type,
    name: path.basename(outputFile, '.pmtiles'),
    attribution: 'Outmap Offline Archive'
  });

  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tempFile = `${outputFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, pmtilesBuffer);
  try {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    fs.renameSync(tempFile, outputFile);
  } catch (_) {
    fs.copyFileSync(tempFile, outputFile);
    try { fs.unlinkSync(tempFile); } catch (_) {}
  }

  const stats = fs.statSync(outputFile);
  console.log(`[PMTiles Converter] Successfully created: ${outputFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${tiles.length} tiles)`);
  return {
    outputFile,
    tileCount: tiles.length,
    fileSize: stats.size
  };
}

async function convertAllOfflineTiles(baseDir, onProgress = () => {}) {
  const targetBase = baseDir || (fs.existsSync('dist/offline-tiles') ? 'dist/offline-tiles' : 'offline-tiles');
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
          onProgress: p => onProgress({ task: t.type, ...p })
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

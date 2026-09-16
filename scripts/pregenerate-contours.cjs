'use strict';

const fs = require('fs');
const path = require('path');
const { buildPmtilesBuffer } = require('../src/tile-archive.cjs');

/**
 * 离线等高线预生成与单文件归档工具
 * 支持将 DEM 切片或已有等高线缓存批量打包为标准的 metric-v1 等高线 PMTiles 资产包。
 */
async function buildContourArchive(options = {}) {
  const inputDir = path.resolve(options.inputDir);
  const outputFile = path.resolve(options.outputFile);
  const schema = options.schema || 'metric-v1';

  console.log(`[Contour Packager] Preparing contour archive for schema '${schema}'...`);
  const tiles = [];

  // 扫描已有等高线切片缓存目录：inputDir/{z}/{x}/{y}.pbf
  if (fs.existsSync(inputDir)) {
    const zDirs = fs.readdirSync(inputDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const zDir of zDirs) {
      const z = parseInt(zDir.name, 10);
      if (isNaN(z)) continue;
      const zPath = path.join(inputDir, zDir.name);
      const xDirs = fs.readdirSync(zPath, { withFileTypes: true }).filter(d => d.isDirectory());

      for (const xDir of xDirs) {
        const x = parseInt(xDir.name, 10);
        if (isNaN(x)) continue;
        const xPath = path.join(zPath, xDir.name);
        const files = fs.readdirSync(xPath, { withFileTypes: true }).filter(f => f.isFile());

        for (const file of files) {
          const y = parseInt(file.name.split('.')[0], 10);
          if (isNaN(y)) continue;
          const fullPath = path.join(xPath, file.name);
          try {
            const data = fs.readFileSync(fullPath);
            if (data.length > 0) {
              tiles.push({ z, x, y, data });
            }
          } catch (_) {}
        }
      }
    }
  }

  console.log(`[Contour Packager] Collected ${tiles.length} contour tiles.`);
  if (tiles.length === 0) {
    console.warn(`[Contour Packager] No contour tiles found in ${inputDir}. Creating empty template archive.`);
  }

  const pmtilesBuffer = buildPmtilesBuffer(tiles, {
    type: 'contour',
    tileType: 'mvt',
    name: `Outmap Contour ${schema}`,
    attribution: 'Outmap GIS Contour Archive',
    metadata: { schema, layer: 'contours' }
  });

  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const tempFile = `${outputFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, pmtilesBuffer);
  fs.renameSync(tempFile, outputFile);

  const stats = fs.statSync(outputFile);
  console.log(`[Contour Packager] Successfully generated: ${outputFile} (${(stats.size / 1024).toFixed(1)} KB, ${tiles.length} tiles)`);
  return {
    outputFile,
    tileCount: tiles.length,
    fileSize: stats.size
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const inputDir = args[0] || 'dist/offline-tiles/contour/metric-v1';
  const outputFile = args[1] || 'dist/offline-tiles/archives/contour_metric-v1.pmtiles';

  buildContourArchive({ inputDir, outputFile })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Build error:', err.message);
      process.exit(1);
    });
}

module.exports = { buildContourArchive };

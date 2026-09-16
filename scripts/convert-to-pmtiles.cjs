'use strict';

const fs = require('fs');
const path = require('path');
const { buildPmtilesBuffer } = require('../src/tile-archive.cjs');

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

  // Directory structure: inputDir/{z}/{x}/{y}.ext
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
  fs.renameSync(tempFile, outputFile);

  const stats = fs.statSync(outputFile);
  console.log(`[PMTiles Converter] Successfully created: ${outputFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${tiles.length} tiles)`);
  return {
    outputFile,
    tileCount: tiles.length,
    fileSize: stats.size
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node scripts/convert-to-pmtiles.cjs <inputDir> <outputFile.pmtiles> [type]');
    console.log('  type: vector | dem | contour | sat (default: vector)');
    process.exit(1);
  }
  const inputDir = args[0];
  const outputFile = args[1];
  const type = args[2] || 'vector';

  convertDirectoryToPmtiles({ inputDir, outputFile, type })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Conversion error:', err.message);
      process.exit(1);
    });
}

module.exports = { convertDirectoryToPmtiles };

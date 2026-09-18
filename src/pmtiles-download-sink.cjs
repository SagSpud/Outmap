'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { zxyToTileId, tileIdToZxy, TileType, PMTiles } = require('pmtiles');
const {
  serializeDirectory,
  deserializeDirectory,
  buildPmtilesHeader,
  readPmtilesInfo
} = require('./tile-archive.cjs');

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB buffer for streaming I/O

class PmtilesDownloadSink {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.archivesDir = options.archivesDir || path.join(this.baseDir, 'archives');
    this.layers = {}; // type -> LayerState
    this.disposed = false;
  }

  async init(types = ['dem', 'vector']) {
    fs.mkdirSync(this.archivesDir, { recursive: true });

    for (const type of types) {
      await this.initLayer(type);
    }
  }

  async initLayer(type) {
    let filename = type + '.pmtiles';
    let tileType = TileType.Mvt;
    let defaultName = 'Outmap ' + type.toUpperCase() + ' Archive';

    if (type === 'dem') {
      filename = 'dem.pmtiles';
      tileType = TileType.Webp;
      defaultName = 'Outmap DEM Terrarium Archive';
    } else if (type === 'vector') {
      filename = 'vector.pmtiles';
      tileType = TileType.Mvt;
      defaultName = 'Outmap Vector Base Archive';
    } else if (type === 'contour') {
      filename = 'contour_metric-v1.pmtiles';
      tileType = TileType.Mvt;
      defaultName = 'Outmap Metric Contours Archive';
    } else if (type === 'sat') {
      filename = 'sat.pmtiles';
      tileType = TileType.Jpeg;
      defaultName = 'Outmap Satellite Imagery Archive';
    }

    const archivePath = path.join(this.archivesDir, filename);
    const existingEntries = new Map();
    const existingTileIds = new Set();
    const columnIndex = new Map();
    let existingFd = null;

    if (fs.existsSync(archivePath)) {
      try {
        const info = readPmtilesInfo(archivePath);
        if (info && Array.isArray(info.entries)) {
          existingFd = fs.openSync(archivePath, 'r');
          const dataOffset = info.header.dataOffset;

          for (const entry of info.entries) {
            const [z, x, y] = tileIdToZxy(entry.tileId);
            const entryObj = {
              tileId: entry.tileId,
              z,
              x,
              y,
              length: entry.length,
              fileOffset: dataOffset + entry.offset,
              source: 'existing'
            };
            existingEntries.set(entry.tileId, entryObj);
            existingTileIds.add(entry.tileId);

            const colKey = z + ':' + x;
            let colSet = columnIndex.get(colKey);
            if (!colSet) {
              colSet = new Set();
              columnIndex.set(colKey, colSet);
            }
            colSet.add(y);
          }
        }
      } catch (err) {
        console.warn('[PmtilesDownloadSink] Warning: failed to read existing ' + filename + ':', err.message);
        if (existingFd !== null) {
          try { fs.closeSync(existingFd); } catch (_) {}
          existingFd = null;
        }
      }
    }

    const spoolFilename = '.spool_' + type + '_' + process.pid + '_' + Date.now() + '.bin';
    const spoolPath = path.join(this.archivesDir, spoolFilename);
    const spoolFd = fs.openSync(spoolPath, 'w+');

    this.layers[type] = {
      type,
      filename,
      archivePath,
      tileType,
      defaultName,
      existingEntries,
      existingTileIds,
      columnIndex,
      existingFd,
      spoolPath,
      spoolFd,
      spoolEntries: new Map(),
      spoolOffset: 0,
      minZoom: 255,
      maxZoom: 0
    };
  }

  hasTile(type, z, x, y) {
    const layer = this.layers[type];
    if (!layer) return false;
    const tileId = zxyToTileId(z, x, y);
    return layer.existingTileIds.has(tileId) || layer.spoolEntries.has(tileId);
  }

  getColumnExistingY(type, z, x) {
    const layer = this.layers[type];
    if (!layer) return new Set();
    const colKey = z + ':' + x;
    return layer.columnIndex.get(colKey) || new Set();
  }

  appendTile(type, z, x, y, buffer) {
    const layer = this.layers[type];
    if (!layer) throw new Error('Layer ' + type + ' not initialized in PmtilesDownloadSink');
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return;

    const tileId = zxyToTileId(z, x, y);
    const offset = layer.spoolOffset;
    const len = buffer.length;

    fs.writeSync(layer.spoolFd, buffer, 0, len, offset);
    layer.spoolOffset += len;

    layer.spoolEntries.set(tileId, {
      tileId,
      z,
      x,
      y,
      spoolOffset: offset,
      length: len,
      source: 'spool'
    });

    layer.existingTileIds.add(tileId);

    const colKey = z + ':' + x;
    let colSet = layer.columnIndex.get(colKey);
    if (!colSet) {
      colSet = new Set();
      layer.columnIndex.set(colKey, colSet);
    }
    colSet.add(y);

    if (z < layer.minZoom) layer.minZoom = z;
    if (z > layer.maxZoom) layer.maxZoom = z;
  }

  getNewTileCount(type) {
    const layer = this.layers[type];
    return layer ? layer.spoolEntries.size : 0;
  }

  getNewTiles(type) {
    const layer = this.layers[type];
    if (!layer) return [];
    return Array.from(layer.spoolEntries.values());
  }

  async finalizeLayer(type, onProgress = () => {}) {
    const layer = this.layers[type];
    if (!layer) return null;

    if (layer.spoolEntries.size === 0) {
      try { fs.closeSync(layer.spoolFd); } catch (_) {}
      try { fs.unlinkSync(layer.spoolPath); } catch (_) {}
      if (layer.existingFd !== null) {
        try { fs.closeSync(layer.existingFd); } catch (_) {}
        layer.existingFd = null;
      }
      return { type, tileCount: layer.existingEntries.size, updated: false };
    }

    const combinedMap = new Map();
    for (const [id, entry] of layer.existingEntries.entries()) {
      combinedMap.set(id, entry);
    }
    for (const [id, entry] of layer.spoolEntries.entries()) {
      combinedMap.set(id, entry);
    }

    const allTiles = Array.from(combinedMap.values());
    allTiles.sort((a, b) => (a.tileId < b.tileId ? -1 : a.tileId > b.tileId ? 1 : 0));

    let minZoom = 255;
    let maxZoom = 0;
    for (const t of allTiles) {
      if (t.z < minZoom) minZoom = t.z;
      if (t.z > maxZoom) maxZoom = t.z;
    }
    if (minZoom === 255) minZoom = 0;

    const finalDirEntries = [];
    let currentDataOffset = 0;
    for (let i = 0; i < allTiles.length; i++) {
      const t = allTiles[i];
      finalDirEntries.push({
        tileId: t.tileId,
        offset: currentDataOffset,
        length: t.length,
        runLength: 1
      });
      currentDataOffset += t.length;
    }

    const totalDataLength = currentDataOffset;
    const rootDirBuffer = serializeDirectory(finalDirEntries);

    const metaObj = {
      name: layer.defaultName,
      attribution: 'Outmap Offline GIS',
      type: layer.type || 'overlay',
      version: '1.0.0',
      minzoom: minZoom,
      maxzoom: maxZoom
    };
    const jsonMetaGz = zlib.gzipSync(Buffer.from(JSON.stringify(metaObj)));

    const rootDirOffset = 127;
    const rootDirLength = rootDirBuffer.length;
    const jsonOffset = rootDirOffset + rootDirLength;
    const jsonLength = jsonMetaGz.length;
    const dataOffset = jsonOffset + jsonLength;

    const header = buildPmtilesHeader({
      rootDirOffset,
      rootDirLength,
      jsonOffset,
      jsonLength,
      dataOffset,
      dataLength: totalDataLength,
      numTiles: allTiles.length,
      numEntries: finalDirEntries.length,
      minZoom,
      maxZoom,
      tileType: layer.tileType
    });

    const tempTargetPath = layer.archivePath + '.' + process.pid + '.' + Date.now() + '.tmp';
    const targetFd = fs.openSync(tempTargetPath, 'w');

    fs.writeSync(targetFd, header, 0, header.length);
    fs.writeSync(targetFd, rootDirBuffer, 0, rootDirBuffer.length);
    fs.writeSync(targetFd, jsonMetaGz, 0, jsonMetaGz.length);

    const copyBuf = Buffer.allocUnsafe(CHUNK_SIZE);
    let copyBufLen = 0;
    let writtenTotal = 0;

    function flushCopyBuf() {
      if (copyBufLen > 0) {
        fs.writeSync(targetFd, copyBuf, 0, copyBufLen);
        writtenTotal += copyBufLen;
        copyBufLen = 0;
      }
    }

    for (let i = 0; i < allTiles.length; i++) {
      const t = allTiles[i];
      const srcFd = t.source === 'spool' ? layer.spoolFd : layer.existingFd;
      const srcOffset = t.source === 'spool' ? t.spoolOffset : t.fileOffset;
      const tileLen = t.length;

      if (tileLen > CHUNK_SIZE) {
        flushCopyBuf();
        const bigBuf = Buffer.allocUnsafe(tileLen);
        fs.readSync(srcFd, bigBuf, 0, tileLen, srcOffset);
        fs.writeSync(targetFd, bigBuf, 0, tileLen);
        writtenTotal += tileLen;
      } else {
        if (copyBufLen + tileLen > CHUNK_SIZE) {
          flushCopyBuf();
        }
        fs.readSync(srcFd, copyBuf, copyBufLen, tileLen, srcOffset);
        copyBufLen += tileLen;
      }

      if (i % 2000 === 0) {
        onProgress({
          type,
          writtenTiles: i + 1,
          totalTiles: allTiles.length,
          percent: Math.round(((i + 1) / allTiles.length) * 100)
        });
      }
    }
    flushCopyBuf();

    fs.closeSync(targetFd);
    try { fs.closeSync(layer.spoolFd); } catch (_) {}
    try { fs.unlinkSync(layer.spoolPath); } catch (_) {}
    if (layer.existingFd !== null) {
      try { fs.closeSync(layer.existingFd); } catch (_) {}
      layer.existingFd = null;
    }

    if (fs.existsSync(layer.archivePath)) {
      try {
        fs.unlinkSync(layer.archivePath);
      } catch (err) {
        await new Promise(r => setTimeout(r, 50));
        try { fs.unlinkSync(layer.archivePath); } catch (_) {}
      }
    }
    fs.renameSync(tempTargetPath, layer.archivePath);

    return {
      type,
      archivePath: layer.archivePath,
      tileCount: allTiles.length,
      fileSize: fs.statSync(layer.archivePath).size,
      updated: true
    };
  }

  async finalizeAll(onProgress = () => {}) {
    const results = [];
    for (const type of Object.keys(this.layers)) {
      const res = await this.finalizeLayer(type, onProgress);
      if (res) results.push(res);
    }
    return results;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    for (const layer of Object.values(this.layers)) {
      if (layer.existingFd !== null) {
        try { fs.closeSync(layer.existingFd); } catch (_) {}
        layer.existingFd = null;
      }
      if (layer.spoolFd !== null) {
        try { fs.closeSync(layer.spoolFd); } catch (_) {}
        layer.spoolFd = null;
      }
      if (fs.existsSync(layer.spoolPath)) {
        try { fs.unlinkSync(layer.spoolPath); } catch (_) {}
      }
    }
    this.layers = {};
  }

  static cleanTemporaryArtifacts(archivesDir) {
    if (!fs.existsSync(archivesDir)) return { cleanedFiles: 0, reclaimedBytes: 0 };
    let cleanedFiles = 0;
    let reclaimedBytes = 0;
    try {
      const files = fs.readdirSync(archivesDir);
      for (const file of files) {
        if (file.endsWith('.tmp') || file.endsWith('.spool') || file.includes('.tmp.')) {
          const p = path.join(archivesDir, file);
          try {
            const stat = fs.statSync(p);
            reclaimedBytes += stat.size;
            fs.unlinkSync(p);
            cleanedFiles++;
          } catch (_) {}
        }
      }
    } catch (_) {}
    return { cleanedFiles, reclaimedBytes };
  }
}

module.exports = {
  PmtilesDownloadSink
};

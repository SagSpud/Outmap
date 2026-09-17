'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PMTiles, zxyToTileId, Compression, TileType } = require('pmtiles');

class NodeFileSource {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.fd = fs.openSync(this.filePath, 'r');
  }

  getKey() {
    return this.filePath;
  }

  async getBytes(offset, length) {
    const buf = Buffer.alloc(length);
    const bytesRead = fs.readSync(this.fd, buf, 0, length, offset);
    return {
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead)
    };
  }

  close() {
    if (this.fd !== null) {
      try { fs.closeSync(this.fd); } catch (_) {}
      this.fd = null;
    }
  }
}

function serializeDirectory(entries) {
  let capacity = Math.max(1024, entries.length * 24 + 16);
  let buf = Buffer.allocUnsafe(capacity);
  let offset = 0;

  function ensureCapacity(needed) {
    if (offset + needed > capacity) {
      capacity = Math.max(capacity * 2, offset + needed + 1024);
      const newBuf = Buffer.allocUnsafe(capacity);
      buf.copy(newBuf, 0, 0, offset);
      buf = newBuf;
    }
  }

  function writeVarint(val) {
    let v = BigInt(val);
    ensureCapacity(10);
    while (v > 0x7Fn) {
      buf[offset++] = Number((v & 0x7Fn) | 0x80n);
      v >>= 7n;
    }
    buf[offset++] = Number(v);
  }

  writeVarint(entries.length);
  let lastId = 0n;
  for (let i = 0; i < entries.length; i++) {
    const id = BigInt(entries[i].tileId);
    writeVarint(id - lastId);
    lastId = id;
  }
  for (let i = 0; i < entries.length; i++) {
    writeVarint(entries[i].runLength);
  }
  for (let i = 0; i < entries.length; i++) {
    writeVarint(entries[i].length);
  }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (i > 0 && e.offset === entries[i - 1].offset + entries[i - 1].length) {
      writeVarint(0);
    } else {
      writeVarint(e.offset + 1);
    }
  }

  return zlib.gzipSync(buf.subarray(0, offset));
}

function deserializeDirectory(compressedBuf) {
  const buf = zlib.gunzipSync(compressedBuf);
  let pos = 0;
  function readVarint() {
    let res = 0n;
    let shift = 0n;
    while (pos < buf.length) {
      const b = BigInt(buf[pos++]);
      res |= (b & 0x7Fn) << shift;
      if (!(b & 0x80n)) break;
      shift += 7n;
    }
    return res;
  }

  const numEntries = Number(readVarint());
  const entries = new Array(numEntries);
  let lastId = 0n;
  for (let i = 0; i < numEntries; i++) {
    const diff = readVarint();
    lastId += diff;
    entries[i] = { tileId: Number(lastId) };
  }
  for (let i = 0; i < numEntries; i++) {
    entries[i].runLength = Number(readVarint());
  }
  for (let i = 0; i < numEntries; i++) {
    entries[i].length = Number(readVarint());
  }
  for (let i = 0; i < numEntries; i++) {
    const off = readVarint();
    if (off === 0n) {
      entries[i].offset = entries[i - 1].offset + entries[i - 1].length;
    } else {
      entries[i].offset = Number(off - 1n);
    }
  }
  return entries;
}

function readPmtilesInfo(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const headerBuf = Buffer.alloc(127);
    fs.readSync(fd, headerBuf, 0, 127, 0);
    if (headerBuf.toString('utf8', 0, 2) !== 'PM') {
      throw new Error('Not a PMTiles file: ' + filePath);
    }
    const rootDirOffset = Number(headerBuf.readBigUInt64LE(8));
    const rootDirLength = Number(headerBuf.readBigUInt64LE(16));
    const jsonOffset = Number(headerBuf.readBigUInt64LE(24));
    const jsonLength = Number(headerBuf.readBigUInt64LE(32));
    const dataOffset = Number(headerBuf.readBigUInt64LE(56));
    const dataLength = Number(headerBuf.readBigUInt64LE(64));
    const numTiles = Number(headerBuf.readBigUInt64LE(72));
    const numEntries = Number(headerBuf.readBigUInt64LE(80));
    const tileType = headerBuf.readUInt8(99);
    const minZoom = headerBuf.readUInt8(100);
    const maxZoom = headerBuf.readUInt8(101);

    const rootDirCompressed = Buffer.alloc(rootDirLength);
    fs.readSync(fd, rootDirCompressed, 0, rootDirLength, rootDirOffset);
    const entries = deserializeDirectory(rootDirCompressed);

    let metadata = {};
    if (jsonLength > 0) {
      try {
        const jsonCompressed = Buffer.alloc(jsonLength);
        fs.readSync(fd, jsonCompressed, 0, jsonLength, jsonOffset);
        metadata = JSON.parse(zlib.gunzipSync(jsonCompressed).toString('utf8'));
      } catch (_) {}
    }

    return {
      header: { rootDirOffset, rootDirLength, jsonOffset, jsonLength, dataOffset, dataLength, numTiles, numEntries, tileType, minZoom, maxZoom },
      metadata,
      entries
    };
  } finally {
    fs.closeSync(fd);
  }
}

function buildPmtilesHeader({
  rootDirOffset,
  rootDirLength,
  jsonOffset,
  jsonLength,
  dataOffset,
  dataLength,
  numTiles,
  numEntries,
  minZoom,
  maxZoom,
  tileType
}) {
  const header = Buffer.alloc(127);
  header.write('PM', 0);
  header.writeUInt8(3, 7); // PMTiles v3 spec
  header.writeBigUInt64LE(BigInt(rootDirOffset), 8);
  header.writeBigUInt64LE(BigInt(rootDirLength), 16);
  header.writeBigUInt64LE(BigInt(jsonOffset), 24);
  header.writeBigUInt64LE(BigInt(jsonLength), 32);
  header.writeBigUInt64LE(0n, 40); // leafDirsOffset
  header.writeBigUInt64LE(0n, 48); // leafDirsLength
  header.writeBigUInt64LE(BigInt(dataOffset), 56);
  header.writeBigUInt64LE(BigInt(dataLength), 64);
  header.writeBigUInt64LE(BigInt(numTiles), 72);
  header.writeBigUInt64LE(BigInt(numEntries || numTiles), 80);
  header.writeBigUInt64LE(BigInt(numTiles), 88);
  header.writeUInt8(1, 96); // clustered
  header.writeUInt8(Compression.Gzip, 97); // internalCompression = gzip
  header.writeUInt8(Compression.None, 98); // tileCompression = none
  header.writeUInt8(tileType, 99);
  header.writeUInt8(minZoom, 100);
  header.writeUInt8(maxZoom, 101);
  return header;
}

function buildPmtilesBuffer(tiles, options = {}) {
  const sortedTiles = tiles.slice().map(t => ({
    ...t,
    tileId: zxyToTileId(t.z, t.x, t.y)
  }));
  sortedTiles.sort((a, b) => (a.tileId < b.tileId ? -1 : a.tileId > b.tileId ? 1 : 0));

  let minZoom = options.minZoom !== undefined ? options.minZoom : 255;
  let maxZoom = options.maxZoom !== undefined ? options.maxZoom : 0;
  for (const t of sortedTiles) {
    if (t.z < minZoom) minZoom = t.z;
    if (t.z > maxZoom) maxZoom = t.z;
  }
  if (minZoom === 255) minZoom = 0;

  const entries = [];
  const tileBuffers = [];
  let currentOffset = 0;

  for (const t of sortedTiles) {
    const buf = Buffer.isBuffer(t.data) ? t.data : Buffer.from(t.data);
    entries.push({
      tileId: t.tileId,
      offset: currentOffset,
      length: buf.length,
      runLength: 1
    });
    currentOffset += buf.length;
    tileBuffers.push(buf);
  }

  const tileDataBuffer = Buffer.concat(tileBuffers);
  const rootDirBuffer = serializeDirectory(entries);

  const metaObj = {
    name: options.name || 'Outmap PMTiles Archive',
    attribution: options.attribution || 'Outmap GIS',
    type: options.type || 'overlay',
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
  const dataLength = tileDataBuffer.length;

  let pmtilesTileType = TileType.Mvt;
  if (options.tileType === 'webp' || options.type === 'dem') pmtilesTileType = TileType.Webp;
  else if (options.tileType === 'png') pmtilesTileType = TileType.Png;
  else if (options.tileType === 'jpeg' || options.type === 'sat') pmtilesTileType = TileType.Jpeg;

  const header = buildPmtilesHeader({
    rootDirOffset,
    rootDirLength,
    jsonOffset,
    jsonLength,
    dataOffset,
    dataLength,
    numTiles: sortedTiles.length,
    numEntries: entries.length,
    minZoom,
    maxZoom,
    tileType: pmtilesTileType
  });

  return Buffer.concat([header, rootDirBuffer, jsonMetaGz, tileDataBuffer]);
}

class TileArchiveManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || '';
    this.archivesDir = path.join(this.baseDir, 'archives');
    this.archives = []; // Array of { name, type, source, pmtiles, minZoom, maxZoom }
    this.isOpen = false;
  }

  async init() {
    this.close();
    this.archives = [];

    const candidateParent = this.baseDir ? path.dirname(this.baseDir) : '';
    const searchDirs = [
      this.archivesDir,
      this.baseDir,
      candidateParent ? path.join(candidateParent, 'archives') : '',
      candidateParent ? path.join(candidateParent, 'offline-tiles', 'archives') : '',
      candidateParent ? path.join(candidateParent, 'offline-tiles') : '',
      candidateParent ? path.join(candidateParent, 'Outmap', 'offline-tiles', 'archives') : '',
      candidateParent ? path.join(candidateParent, 'Outmap', 'offline-tiles') : '',
      candidateParent ? path.join(candidateParent, 'Outmap', 'archives') : ''
    ].filter(Boolean);
    const checkedPaths = new Set();

    for (const sDir of searchDirs) {
      if (!fs.existsSync(sDir)) continue;
      try {
        const files = fs.readdirSync(sDir);
        for (const file of files) {
          if (!file.toLowerCase().endsWith('.pmtiles')) continue;
          const fullPath = path.join(sDir, file);
          if (checkedPaths.has(fullPath)) continue;
          checkedPaths.add(fullPath);

          let archiveType = 'vector';
          const lower = file.toLowerCase();
          if (lower.includes('dem') || lower.includes('terrain')) archiveType = 'dem';
          else if (lower.includes('contour')) archiveType = 'contour';
          else if (lower.includes('sat') || lower.includes('imagery')) archiveType = 'sat';
          else if (lower.includes('vector') || lower.includes('osm')) archiveType = 'vector';

          try {
            const source = new NodeFileSource(fullPath);
            const pmtiles = new PMTiles(source);
            const header = await pmtiles.getHeader();
            this.archives.push({
              name: file,
              path: fullPath,
              type: archiveType,
              source,
              pmtiles,
              minZoom: header.minZoom,
              maxZoom: header.maxZoom,
              tileCount: Number(header.numAddressedTiles || 0)
            });
          } catch (err) {
            console.warn('[TileArchiveManager] Failed to load archive:', fullPath, err.message);
          }
        }
      } catch (_) {}
    }

    this.isOpen = true;
    return this.archives.length;
  }

  getArchiveCount() {
    return this.archives.length;
  }

  getArchivesSummary() {
    return this.archives.map(a => ({
      name: a.name,
      type: a.type,
      minZoom: a.minZoom,
      maxZoom: a.maxZoom,
      tileCount: a.tileCount
    }));
  }

  async getTile(type, z, x, y) {
    if (!this.isOpen || this.archives.length === 0) return null;
    const targetType = String(type).toLowerCase();

    for (const archive of this.archives) {
      if (archive.type !== targetType && archive.type !== 'all') continue;
      if (z < archive.minZoom || z > archive.maxZoom) continue;

      try {
        const resp = await archive.pmtiles.getZxy(z, x, y);
        if (resp && resp.data) {
          return {
            data: Buffer.from(resp.data),
            cacheControl: 'public, max-age=31536000, immutable',
            archiveName: archive.name
          };
        }
      } catch (_) {}
    }
    return null;
  }

  close() {
    for (const archive of this.archives) {
      if (archive.source?.close) archive.source.close();
    }
    this.archives = [];
    this.isOpen = false;
  }
}

module.exports = {
  NodeFileSource,
  buildPmtilesBuffer,
  buildPmtilesHeader,
  serializeDirectory,
  deserializeDirectory,
  readPmtilesInfo,
  TileArchiveManager,
  zxyToTileId
};

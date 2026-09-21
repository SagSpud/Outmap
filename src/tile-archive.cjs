'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PMTiles, zxyToTileId, Compression, TileType } = require('pmtiles');

const PMTILES_HEADER_SIZE = 127;
const PMTILES_INITIAL_FETCH_SIZE = 16 * 1024;
const MAX_ROOT_DIRECTORY_BYTES = PMTILES_INITIAL_FETCH_SIZE - PMTILES_HEADER_SIZE - 128;

class NodeFileSource {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.fd = fs.openSync(this.filePath, 'r');
  }

  getKey() {
    return this.filePath;
  }

  async getBytes(offset, length) {
    if (this.fd === null) return { data: new ArrayBuffer(0) };
    // Read directly into the ArrayBuffer returned to pmtiles. The previous
    // Buffer -> ArrayBuffer.slice path copied every directory and tile once.
    const data = new ArrayBuffer(length);
    const buf = Buffer.from(data);
    const bytesRead = await new Promise((resolve, reject) => {
      fs.read(this.fd, buf, 0, length, offset, (err, nRead) => {
        if (err) reject(err);
        else resolve(nRead);
      });
    });
    return {
      data: bytesRead === length ? data : data.slice(0, bytesRead)
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

function parseDirectoryBuffer(buf) {
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

function deserializeDirectory(compressedBuf) {
  return parseDirectoryBuffer(zlib.gunzipSync(compressedBuf));
}

function normalizeBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length < 4) return null;
  const values = bounds.slice(0, 4).map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [minLon, minLat, maxLon, maxLat] = values;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  if (minLon < -180 || maxLon > 180 || minLat < -85.051129 || maxLat > 85.051129) return null;
  return values;
}

function calculateTilesBounds(tiles) {
  let minWorldX = Infinity;
  let minWorldY = Infinity;
  let maxWorldX = -Infinity;
  let maxWorldY = -Infinity;
  for (const tile of tiles || []) {
    const z = Number(tile?.z);
    const x = Number(tile?.x);
    const y = Number(tile?.y);
    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 30) continue;
    const n = 2 ** z;
    minWorldX = Math.min(minWorldX, x / n);
    maxWorldX = Math.max(maxWorldX, (x + 1) / n);
    minWorldY = Math.min(minWorldY, y / n);
    maxWorldY = Math.max(maxWorldY, (y + 1) / n);
  }
  if (![minWorldX, minWorldY, maxWorldX, maxWorldY].every(Number.isFinite)) return null;
  const lon = worldX => worldX * 360 - 180;
  const lat = worldY => Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180 / Math.PI;
  const minLon = lon(minWorldX);
  const maxLon = lon(maxWorldX);
  const maxLat = lat(minWorldY);
  const minLat = lat(maxWorldY);
  return normalizeBounds([minLon, minLat, maxLon, maxLat]);
}

// PMTiles readers optimistically fetch only the first 16 KiB and expect the
// complete root directory to fit there. Large Outmap archives previously put
// every tile entry in the root. Split large indexes into leaf directories so
// nationwide L14 archives remain standards-compliant and cheap to open.
function buildDirectoryLayout(entries, maxRootBytes = MAX_ROOT_DIRECTORY_BYTES) {
  const directRoot = serializeDirectory(entries);
  if (directRoot.length <= maxRootBytes) {
    return {
      rootDirectory: directRoot,
      leafDirectories: Buffer.alloc(0),
      usesLeaves: false,
      rootEntryCount: entries.length
    };
  }

  let targetRootEntries = Math.min(512, Math.max(1, entries.length));
  while (targetRootEntries >= 1) {
    const chunkSize = Math.max(1, Math.ceil(entries.length / targetRootEntries));
    const leafBuffers = [];
    const rootEntries = [];
    let leafOffset = 0;

    for (let start = 0; start < entries.length; start += chunkSize) {
      const chunk = entries.slice(start, Math.min(entries.length, start + chunkSize));
      const leaf = serializeDirectory(chunk);
      leafBuffers.push(leaf);
      rootEntries.push({
        tileId: chunk[0].tileId,
        offset: leafOffset,
        length: leaf.length,
        runLength: 0
      });
      leafOffset += leaf.length;
    }

    const rootDirectory = serializeDirectory(rootEntries);
    if (rootDirectory.length <= maxRootBytes || targetRootEntries === 1) {
      return {
        rootDirectory,
        leafDirectories: Buffer.concat(leafBuffers),
        usesLeaves: true,
        rootEntryCount: rootEntries.length
      };
    }
    targetRootEntries = Math.max(1, Math.floor(targetRootEntries / 2));
  }

  throw new Error('Unable to build bounded PMTiles root directory');
}

function parsePmtilesHeader(headerBuf) {
  if (!headerBuf || headerBuf.length < PMTILES_HEADER_SIZE || headerBuf.toString('utf8', 0, 2) !== 'PM') {
    throw new Error('Invalid PMTiles header');
  }
  return {
    specVersion: headerBuf.readUInt8(7),
    rootDirOffset: Number(headerBuf.readBigUInt64LE(8)),
    rootDirLength: Number(headerBuf.readBigUInt64LE(16)),
    jsonOffset: Number(headerBuf.readBigUInt64LE(24)),
    jsonLength: Number(headerBuf.readBigUInt64LE(32)),
    leafDirsOffset: Number(headerBuf.readBigUInt64LE(40)),
    leafDirsLength: Number(headerBuf.readBigUInt64LE(48)),
    dataOffset: Number(headerBuf.readBigUInt64LE(56)),
    dataLength: Number(headerBuf.readBigUInt64LE(64)),
    numTiles: Number(headerBuf.readBigUInt64LE(72)),
    numEntries: Number(headerBuf.readBigUInt64LE(80)),
    numContents: Number(headerBuf.readBigUInt64LE(88)),
    clustered: headerBuf.readUInt8(96) === 1,
    internalCompression: headerBuf.readUInt8(97),
    tileCompression: headerBuf.readUInt8(98),
    tileType: headerBuf.readUInt8(99),
    minZoom: headerBuf.readUInt8(100),
    maxZoom: headerBuf.readUInt8(101),
    minLon: headerBuf.readInt32LE(102) / 1e7,
    minLat: headerBuf.readInt32LE(106) / 1e7,
    maxLon: headerBuf.readInt32LE(110) / 1e7,
    maxLat: headerBuf.readInt32LE(114) / 1e7,
    centerZoom: headerBuf.readUInt8(118),
    centerLon: headerBuf.readInt32LE(119) / 1e7,
    centerLat: headerBuf.readInt32LE(123) / 1e7
  };
}

function readPmtilesHeader(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const headerBuf = Buffer.alloc(PMTILES_HEADER_SIZE);
    fs.readSync(fd, headerBuf, 0, PMTILES_HEADER_SIZE, 0);
    return parsePmtilesHeader(headerBuf);
  } finally {
    fs.closeSync(fd);
  }
}

function readPmtilesInfo(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const headerBuf = Buffer.alloc(PMTILES_HEADER_SIZE);
    fs.readSync(fd, headerBuf, 0, PMTILES_HEADER_SIZE, 0);
    const header = parsePmtilesHeader(headerBuf);

    const readDirectory = (offset, length, depth = 0) => {
      if (depth > 3) throw new Error('PMTiles directory depth exceeds supported maximum');
      const compressed = Buffer.alloc(length);
      fs.readSync(fd, compressed, 0, length, offset);
      const directory = deserializeDirectory(compressed);
      const flattened = [];
      for (const entry of directory) {
        if (entry.runLength === 0) {
          flattened.push(...readDirectory(header.leafDirsOffset + entry.offset, entry.length, depth + 1));
        } else {
          flattened.push(entry);
        }
      }
      return flattened;
    };
    const entries = readDirectory(header.rootDirOffset, header.rootDirLength);

    let metadata = {};
    if (header.jsonLength > 0) {
      try {
        const jsonCompressed = Buffer.alloc(header.jsonLength);
        fs.readSync(fd, jsonCompressed, 0, header.jsonLength, header.jsonOffset);
        metadata = JSON.parse(zlib.gunzipSync(jsonCompressed).toString('utf8'));
      } catch (_) {}
    }

    return {
      header,
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
  leafDirsOffset = 0,
  leafDirsLength = 0,
  dataOffset,
  dataLength,
  numTiles,
  numEntries,
  minZoom,
  maxZoom,
  tileType,
  bounds = [-180, -85.0511288, 180, 85.0511288],
  center = null,
  centerZoom = minZoom
}) {
  const normalizedBounds = normalizeBounds(bounds) || [-180, -85.0511288, 180, 85.0511288];
  const normalizedCenter = Array.isArray(center) && center.length >= 2 && center.every(Number.isFinite)
    ? center
    : [(normalizedBounds[0] + normalizedBounds[2]) / 2, (normalizedBounds[1] + normalizedBounds[3]) / 2];
  const header = Buffer.alloc(PMTILES_HEADER_SIZE);
  header.write('PM', 0);
  header.writeUInt8(3, 7); // PMTiles v3 spec
  header.writeBigUInt64LE(BigInt(rootDirOffset), 8);
  header.writeBigUInt64LE(BigInt(rootDirLength), 16);
  header.writeBigUInt64LE(BigInt(jsonOffset), 24);
  header.writeBigUInt64LE(BigInt(jsonLength), 32);
  header.writeBigUInt64LE(BigInt(leafDirsOffset), 40);
  header.writeBigUInt64LE(BigInt(leafDirsLength), 48);
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
  header.writeInt32LE(Math.round(normalizedBounds[0] * 1e7), 102);
  header.writeInt32LE(Math.round(normalizedBounds[1] * 1e7), 106);
  header.writeInt32LE(Math.round(normalizedBounds[2] * 1e7), 110);
  header.writeInt32LE(Math.round(normalizedBounds[3] * 1e7), 114);
  header.writeUInt8(Math.max(0, Math.min(30, Number(centerZoom) || 0)), 118);
  header.writeInt32LE(Math.round(Math.max(-180, Math.min(180, normalizedCenter[0])) * 1e7), 119);
  header.writeInt32LE(Math.round(Math.max(-85.0511288, Math.min(85.0511288, normalizedCenter[1])) * 1e7), 123);
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
  const directoryLayout = buildDirectoryLayout(entries);
  const rootDirBuffer = directoryLayout.rootDirectory;
  const leafDirsBuffer = directoryLayout.leafDirectories;

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

  const rootDirOffset = PMTILES_HEADER_SIZE;
  const rootDirLength = rootDirBuffer.length;
  const jsonOffset = rootDirOffset + rootDirLength;
  const jsonLength = jsonMetaGz.length;
  const leafDirsOffset = jsonOffset + jsonLength;
  const leafDirsLength = leafDirsBuffer.length;
  const dataOffset = leafDirsOffset + leafDirsLength;
  const dataLength = tileDataBuffer.length;
  const bounds = normalizeBounds(options.bounds) || calculateTilesBounds(sortedTiles) || [-180, -85.0511288, 180, 85.0511288];

  let pmtilesTileType = TileType.Mvt;
  if (options.tileType === 'webp' || options.type === 'dem') pmtilesTileType = TileType.Webp;
  else if (options.tileType === 'png') pmtilesTileType = TileType.Png;
  else if (options.tileType === 'jpeg' || options.type === 'sat') pmtilesTileType = TileType.Jpeg;

  const header = buildPmtilesHeader({
    rootDirOffset,
    rootDirLength,
    jsonOffset,
    jsonLength,
    leafDirsOffset,
    leafDirsLength,
    dataOffset,
    dataLength,
    numTiles: sortedTiles.length,
    numEntries: entries.length,
    minZoom,
    maxZoom,
    tileType: pmtilesTileType,
    bounds,
    center: options.center,
    centerZoom: options.centerZoom ?? minZoom
  });

  return Buffer.concat([header, rootDirBuffer, jsonMetaGz, leafDirsBuffer, tileDataBuffer]);
}

function decompressBuffer(data, compression) {
  const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (compression === Compression.None || compression === Compression.Unknown) return Promise.resolve(input);
  const fn = compression === Compression.Gzip
    ? zlib.gunzip
    : compression === Compression.Brotli
      ? zlib.brotliDecompress
      : null;
  if (!fn) return Promise.reject(new Error(`Unsupported PMTiles compression: ${compression}`));
  return new Promise((resolve, reject) => fn(input, (error, output) => error ? reject(error) : resolve(output)));
}

function findDirectoryEntry(entries, tileId) {
  let low = 0;
  let high = entries.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const delta = tileId - entries[mid].tileId;
    if (delta > 0) low = mid + 1;
    else if (delta < 0) high = mid - 1;
    else return entries[mid];
  }
  if (high >= 0) {
    const candidate = entries[high];
    if (candidate.runLength > 0 && tileId - candidate.tileId < candidate.runLength) return candidate;
  }
  return null;
}

// Compatibility reader for early Outmap archives whose entire tile index was
// stored in an oversized root directory. It is loaded lazily, so existing
// archives keep working without delaying application startup or being rewritten.
class LegacyFlatPmtilesArchive {
  constructor(source, header) {
    this.source = source;
    this.header = header;
    this.entriesPromise = null;
  }

  async getEntries() {
    if (!this.entriesPromise) {
      this.entriesPromise = (async () => {
        const response = await this.source.getBytes(this.header.rootDirOffset, this.header.rootDirLength);
        const raw = await decompressBuffer(response.data, this.header.internalCompression);
        return parseDirectoryBuffer(raw);
      })();
    }
    return this.entriesPromise;
  }

  async getZxy(z, x, y) {
    const entries = await this.getEntries();
    const entry = findDirectoryEntry(entries, zxyToTileId(z, x, y));
    if (!entry || entry.runLength === 0) return undefined;
    const response = await this.source.getBytes(this.header.dataOffset + entry.offset, entry.length);
    const data = await decompressBuffer(response.data, this.header.tileCompression);
    return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  }
}

function getArchiveTileRange(archive, z) {
  if (!archive.bounds) return null;
  archive.tileRangeCache ||= new Map();
  if (archive.tileRangeCache.has(z)) return archive.tileRangeCache.get(z);
  const [minLon, minLat, maxLon, maxLat] = archive.bounds;
  const n = 2 ** z;
  const xAt = lon => Math.max(0, Math.min(n - 1, Math.floor((lon + 180) / 360 * n)));
  const yAt = lat => {
    const clamped = Math.max(-85.0511288, Math.min(85.0511288, lat));
    const rad = clamped * Math.PI / 180;
    return Math.max(0, Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n)));
  };
  const range = {
    minX: xAt(minLon),
    maxX: xAt(maxLon - 1e-10),
    minY: yAt(maxLat),
    maxY: yAt(minLat - 1e-10)
  };
  archive.tileRangeCache.set(z, range);
  return range;
}

function archiveMayContainTile(archive, z, x, y) {
  const range = getArchiveTileRange(archive, z);
  if (!range) return true;
  return x >= range.minX && x <= range.maxX && y >= range.minY && y <= range.maxY;
}

class TileArchiveManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || '';
    this.archivesDir = path.join(this.baseDir, 'archives');
    this.archives = []; // Array of { name, type, source, pmtiles, minZoom, maxZoom }
    this.archivesByType = new Map();
    this.isOpen = false;
    this._ready = Promise.resolve();
  }

  init() {
    this._ready = this._initialize();
    return this._ready;
  }

  async _initialize() {
    this.close();
    this.archives = [];
    this.archivesByType = new Map();

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

          let source = null;
          try {
            source = new NodeFileSource(fullPath);
            const rawHeader = readPmtilesHeader(fullPath);
            let pmtiles = new PMTiles(source);
            let header;
            let legacyFlat = false;
            const oversizedFlatRoot = rawHeader.leafDirsLength === 0
              && rawHeader.rootDirLength > MAX_ROOT_DIRECTORY_BYTES;
            if (oversizedFlatRoot) {
              pmtiles = new LegacyFlatPmtilesArchive(source, rawHeader);
              header = {
                minZoom: rawHeader.minZoom,
                maxZoom: rawHeader.maxZoom,
                minLon: rawHeader.minLon,
                minLat: rawHeader.minLat,
                maxLon: rawHeader.maxLon,
                maxLat: rawHeader.maxLat,
                numAddressedTiles: rawHeader.numTiles
              };
              legacyFlat = true;
            } else {
              header = await pmtiles.getHeader();
            }
            const bounds = normalizeBounds([header.minLon, header.minLat, header.maxLon, header.maxLat]);
            const archive = {
              name: file,
              path: fullPath,
              type: archiveType,
              source,
              pmtiles,
              minZoom: header.minZoom,
              maxZoom: header.maxZoom,
              tileCount: Number(header.numAddressedTiles || 0),
              bounds,
              legacyFlat
            };
            this.archives.push(archive);
            if (!this.archivesByType.has(archiveType)) this.archivesByType.set(archiveType, []);
            this.archivesByType.get(archiveType).push(archive);
          } catch (err) {
            source?.close?.();
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
      tileCount: a.tileCount,
      bounds: a.bounds,
      legacyFlat: a.legacyFlat
    }));
  }

  async getTile(type, z, x, y) {
    await this._ready.catch(() => {});
    if (!this.isOpen || this.archives.length === 0) return null;
    const targetType = String(type).toLowerCase();
    const candidates = [
      ...(this.archivesByType.get(targetType) || []),
      ...(this.archivesByType.get('all') || [])
    ];

    for (const archive of candidates) {
      if (z < archive.minZoom || z > archive.maxZoom) continue;
      if (!archiveMayContainTile(archive, z, x, y)) continue;

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
    this.archivesByType = new Map();
    this.isOpen = false;
  }
}

module.exports = {
  NodeFileSource,
  buildPmtilesBuffer,
  buildPmtilesHeader,
  buildDirectoryLayout,
  calculateTilesBounds,
  serializeDirectory,
  deserializeDirectory,
  parsePmtilesHeader,
  readPmtilesHeader,
  readPmtilesInfo,
  TileArchiveManager,
  zxyToTileId
};

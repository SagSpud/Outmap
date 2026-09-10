const fs = require('fs');
const path = require('path');
const { parentPort, workerData, isMainThread } = require('worker_threads');
const OFFLINE_INVENTORY_VERSION = 4;

function bounds(bbox, z) {
  const n = 2 ** z;
  const y = lat => Math.max(0, Math.min(n - 1, Math.floor((1 - Math.asinh(Math.tan(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180)) / Math.PI) / 2 * n)));
  return [Math.max(0, Math.floor((bbox[0] + 180) / 360 * n)), Math.min(n - 1, Math.floor((bbox[1] + 180) / 360 * n)), y(bbox[3]), y(bbox[2])];
}

function inChina(z, x, y, boxes) {
  if (z < 11) return true;
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180, lon2 = (x + 1) / n * 360 - 180;
  const lat1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
  const lat2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  return boxes.some(b => !(lon2 < b[0] - 1.2 || lon1 > b[1] + 1.2 || lat2 < b[2] - 1.2 || lat1 > b[3] + 1.2));
}

function scan({ baseDir, provinces, boxes }) {
  const stats = {
    demCount: 0,
    vectorCount: 0,
    satCount: 0,
    fontCount: 0,
    demBytes: 0,
    vectorBytes: 0,
    satBytes: 0,
    fontBytes: 0,
    totalTiles: 0,
    totalBytes: 0,
    exact: true
  };
  const result = {};
  const ranges = {};
  for (let z = 0; z <= 14; z++) {
    ranges[z] = provinces.map(([key, bbox]) => {
      const b = bounds(bbox, z);
      let expected = 0;
      for (let x = b[0]; x <= b[1]; x++) {
        for (let y = b[2]; y <= b[3]; y++) {
          if (inChina(z, x, y, boxes)) expected++;
        }
      }
      result[key] ||= { layers: { dem: { levels: {} }, vector: { levels: {} } } };
      for (const layer of ['dem', 'vector']) {
        result[key].layers[layer].levels[z] = { expected, present: 0, complete: false };
      }
      return { key, b };
    });
  }

  function entries(dir) {
    try {
      return fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      return [];
    }
  }

  let lastReportCount = 0;
  let lastReportTime = 0;

  // 1. 全图层立体扫描：覆盖 dem, vector 以及巨幅卫星图 sat / satellite
  const TILE_LAYERS = [
    { dirName: 'dem', statKey: 'dem', regex: /^\d+\.(webp|png)$/i, defaultAvg: 24000, isProvLayer: true },
    { dirName: 'vector', statKey: 'vector', regex: /^\d+\.(pbf|mvt)$/i, defaultAvg: 16000, isProvLayer: true },
    { dirName: 'sat', statKey: 'sat', regex: /^\d+\.(jpg|jpeg|png|webp)$/i, defaultAvg: 45000, isProvLayer: false },
    { dirName: 'satellite', statKey: 'sat', regex: /^\d+\.(jpg|jpeg|png|webp)$/i, defaultAvg: 45000, isProvLayer: false }
  ];

  for (const layerCfg of TILE_LAYERS) {
    const layerPath = path.join(baseDir, layerCfg.dirName);
    const zDirs = entries(layerPath);
    if (zDirs.length === 0) continue;

    const zoomStats = {};

    for (const zd of zDirs) {
      if (!zd.isDirectory() || !/^\d+$/.test(zd.name)) continue;
      const z = Number(zd.name);
      const zStats = (zoomStats[z] ||= { count: 0, sampleBytes: [] });

      for (const xd of entries(path.join(layerPath, zd.name))) {
        if (!xd.isDirectory() || !/^\d+$/.test(xd.name)) continue;
        const x = Number(xd.name);
        const candidates = layerCfg.isProvLayer ? (ranges[z] || []).filter(r => x >= r.b[0] && x <= r.b[1]) : [];
        const fileEntries = entries(path.join(layerPath, zd.name, xd.name));

        for (let fi = 0; fi < fileEntries.length; fi++) {
          const file = fileEntries[fi];
          const match = file.name.match(layerCfg.regex);
          if (!file.isFile() || !match) continue;

          // 分层级均衡采样：每 Zoom 层级均匀采样多达 50 块切片，彻底避免低层级小切片拉低整体均值
          if (zStats.sampleBytes.length < 50 && (fi % 12 === 0 || zStats.sampleBytes.length < 5)) {
            try {
              const s = fs.statSync(path.join(layerPath, zd.name, xd.name, file.name)).size;
              if (s > 20) zStats.sampleBytes.push(s);
            } catch (e) {}
          }

          const y = Number(file.name.split('.')[0]);
          stats[layerCfg.statKey + 'Count']++;
          zStats.count++;

          if (layerCfg.isProvLayer && candidates.length > 0 && inChina(z, x, y, boxes)) {
            for (const r of candidates) {
              if (y >= r.b[2] && y <= r.b[3]) {
                result[r.key].layers[layerCfg.dirName].levels[z].present++;
              }
            }
          }

          const currentTotal = stats.demCount + stats.vectorCount + stats.satCount;
          const reportNow = Date.now();
          if (parentPort && (currentTotal - lastReportCount >= 2500) && (reportNow - lastReportTime >= 400)) {
            lastReportCount = currentTotal;
            lastReportTime = reportNow;
            parentPort.postMessage({ type: 'progress', count: currentTotal, layer: layerCfg.dirName, z });
          }
        }
      }
    }

    // 按各 Zoom 层级实际瓦片数加权汇总，确保真实体积与 Windows 资源管理器 20+G 高度吻合
    let layerTotalBytes = 0;
    for (const [zStr, zInfo] of Object.entries(zoomStats)) {
      const avgZ = zInfo.sampleBytes.length > 0
        ? Math.round(zInfo.sampleBytes.reduce((a, b) => a + b, 0) / zInfo.sampleBytes.length)
        : layerCfg.defaultAvg;
      layerTotalBytes += zInfo.count * avgZ;
    }
    stats[layerCfg.statKey + 'Bytes'] += layerTotalBytes;
  }

  // 2. 统计离线字体库 fonts (若存在)
  const fontDir = path.join(baseDir, 'fonts');
  const fontDirs = entries(fontDir);
  for (const fd of fontDirs) {
    if (fd.isDirectory()) {
      const rangeFiles = entries(path.join(fontDir, fd.name));
      for (const rf of rangeFiles) {
        if (rf.isFile() && /\.pbf$/i.test(rf.name)) {
          stats.fontCount++;
          stats.fontBytes += 40000;
        }
      }
    }
  }

  // 严格三态统计：只有该层级全部预期瓦片都在磁盘上才显示绿色；任何缺片都保持蓝色。
  for (const p of Object.values(result)) {
    for (const layer of ['dem', 'vector']) {
      const state = p.layers[layer];
      state.maxZ = 0;
      state.partialZ = 0;
      for (const [z, level] of Object.entries(state.levels)) {
        const isComplete = level.expected > 0 && level.present >= level.expected;
        level.complete = isComplete;
        if (level.complete) state.maxZ = Math.max(state.maxZ, +z);
        if (level.present > 0) state.partialZ = Math.max(state.partialZ, +z);
      }
    }
    p.dem = Object.values(p.layers.dem.levels).some(l => l.present > 0);
    p.vec = Object.values(p.layers.vector.levels).some(l => l.present > 0);
    const activeMaxZs = [];
    if (p.layers.dem.maxZ > 0 || p.dem) activeMaxZs.push(p.layers.dem.maxZ);
    if (p.layers.vector.maxZ > 0 || p.vec) activeMaxZs.push(p.layers.vector.maxZ);
    p.maxZ = activeMaxZs.length > 0 ? Math.min(...activeMaxZs) : 0;
    p.partialZ = Math.max(p.layers.dem.partialZ, p.layers.vector.partialZ);
  }

  stats.totalTiles = stats.demCount + stats.vectorCount + stats.satCount + stats.fontCount;
  stats.totalBytes = stats.demBytes + stats.vectorBytes + stats.satBytes + stats.fontBytes;
  stats.lastScannedAt = Date.now();
  return { stats, provinces: result, inventoryVersion: OFFLINE_INVENTORY_VERSION };
}

function subtractClaimedInterval(start, end, claimed) {
  const result = [];
  let cursor = start;
  for (const [claimedStart, claimedEnd] of claimed) {
    if (claimedEnd < cursor) continue;
    if (claimedStart > end) break;
    if (claimedStart > cursor) result.push([cursor, Math.min(end, claimedStart - 1)]);
    cursor = Math.max(cursor, claimedEnd + 1);
    if (cursor > end) break;
  }
  if (cursor <= end) result.push([cursor, end]);
  return result;
}

function addClaimedInterval(claimed, start, end) {
  const next = [];
  let mergedStart = start;
  let mergedEnd = end;
  let inserted = false;
  for (const [currentStart, currentEnd] of claimed) {
    if (currentEnd + 1 < mergedStart) {
      next.push([currentStart, currentEnd]);
    } else if (mergedEnd + 1 < currentStart) {
      if (!inserted) {
        next.push([mergedStart, mergedEnd]);
        inserted = true;
      }
      next.push([currentStart, currentEnd]);
    } else {
      mergedStart = Math.min(mergedStart, currentStart);
      mergedEnd = Math.max(mergedEnd, currentEnd);
    }
  }
  if (!inserted) next.push([mergedStart, mergedEnd]);
  return next;
}

// Enumerate one physical z/x directory at a time. This lets normal resume read
// a directory once and subtract all ready y files before any task reaches the
// download workers. It also keeps province overlap ownership deterministic.
function* enumerateTileColumns({ provinces, minZ, maxZ, downloadDem, downloadVec, targetKeys }) {
  const allowedTargets = targetKeys instanceof Set
    ? targetKeys
    : (Array.isArray(targetKeys) ? new Set(targetKeys) : null);
  for (let z = minZ; z <= maxZ; z++) {
    const ranges = provinces.map(prov => ({
      prov,
      b: bounds(prov.bbox, z),
      includeDem: downloadDem && (!allowedTargets || allowedTargets.has(`${prov.key}:dem:${z}`)),
      includeVector: downloadVec && (!allowedTargets || allowedTargets.has(`${prov.key}:vector:${z}`))
    }));
    if (ranges.length === 0 || !ranges.some(range => range.includeDem || range.includeVector)) continue;
    const minX = Math.min(...ranges.map(range => range.b[0]));
    const maxX = Math.max(...ranges.map(range => range.b[1]));

    for (let x = minX; x <= maxX; x++) {
      let claimed = [];
      const segments = [];
      for (const range of ranges) {
        if (x < range.b[0] || x > range.b[1]) continue;
        const uncovered = subtractClaimedInterval(range.b[2], range.b[3], claimed);
        // Every earlier province claims its full rectangle even when its level
        // is manifest-complete; shared physical tiles must never be downloaded
        // again on behalf of a later overlapping province.
        claimed = addClaimedInterval(claimed, range.b[2], range.b[3]);
        if (!range.includeDem && !range.includeVector) continue;
        for (const [startY, endY] of uncovered) {
          segments.push({
            provKey: range.prov.key,
            provName: range.prov.name,
            startY,
            endY,
            includeDem: range.includeDem,
            includeVector: range.includeVector
          });
        }
      }
      if (segments.length > 0) yield { z, x, segments };
    }
  }
}

// Produce compressed missing y runs. A fully absent nationwide column becomes
// one tiny range object rather than thousands of task objects, so directory
// discovery can run independently from slower network downloads.
async function* enumerateMissingTileRanges(plan, { readColumnFiles, signal, onProgress } = {}) {
  if (typeof readColumnFiles !== 'function') {
    throw new TypeError('readColumnFiles is required');
  }
  const progress = { scannedColumns: 0, scannedCandidates: 0, foundMissing: 0, currentProvince: '', currentZ: plan.minZ };
  let columnsSinceYield = 0;
  for (const column of enumerateTileColumns(plan)) {
    if (signal?.aborted) break;
    const needsDem = column.segments.some(segment => segment.includeDem);
    const needsVector = column.segments.some(segment => segment.includeVector);
    const [demFiles, vectorFiles] = await Promise.all([
      needsDem ? readColumnFiles('dem', column.z, column.x) : null,
      needsVector ? readColumnFiles('vector', column.z, column.x) : null
    ]);

    progress.scannedColumns++;
    progress.currentZ = column.z;
    for (const segment of column.segments) {
      progress.currentProvince = segment.provName || progress.currentProvince;
      let demRunStart = null;
      let vectorRunStart = null;
      for (let y = segment.startY; y <= segment.endY; y++) {
        if (signal?.aborted) break;
        const validTile = inChina(column.z, column.x, y, plan.boxes);
        if (segment.includeDem) {
          const missing = validTile && !demFiles.has(`${y}.webp`);
          if (validTile) progress.scannedCandidates++;
          if (missing) {
            progress.foundMissing++;
            if (demRunStart === null) demRunStart = y;
          } else if (demRunStart !== null) {
            yield { provKey: segment.provKey, provName: segment.provName, type: 'dem', z: column.z, x: column.x, startY: demRunStart, endY: y - 1, ext: 'webp' };
            demRunStart = null;
          }
        }
        if (segment.includeVector) {
          const missing = validTile && !vectorFiles.has(`${y}.pbf`);
          if (validTile) progress.scannedCandidates++;
          if (missing) {
            progress.foundMissing++;
            if (vectorRunStart === null) vectorRunStart = y;
          } else if (vectorRunStart !== null) {
            yield { provKey: segment.provKey, provName: segment.provName, type: 'vector', z: column.z, x: column.x, startY: vectorRunStart, endY: y - 1, ext: 'pbf' };
            vectorRunStart = null;
          }
        }
      }
      if (!signal?.aborted && demRunStart !== null) {
        yield { provKey: segment.provKey, provName: segment.provName, type: 'dem', z: column.z, x: column.x, startY: demRunStart, endY: segment.endY, ext: 'webp' };
      }
      if (!signal?.aborted && vectorRunStart !== null) {
        yield { provKey: segment.provKey, provName: segment.provName, type: 'vector', z: column.z, x: column.x, startY: vectorRunStart, endY: segment.endY, ext: 'pbf' };
      }
      if (signal?.aborted) break;
    }

    onProgress?.({ ...progress, done: false });
    columnsSinceYield++;
    if (columnsSinceYield >= 32) {
      columnsSinceYield = 0;
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  onProgress?.({ ...progress, done: true });
}

// Compatibility task iterator used by tests and callers that want individual
// tiles. Production normal-resume consumes the compressed ranges directly.
async function* enumerateMissingTiles(plan, options = {}) {
  for await (const range of enumerateMissingTileRanges(plan, options)) {
    for (let y = range.startY; y <= range.endY; y++) {
      yield {
        provKey: range.provKey,
        provName: range.provName,
        type: range.type,
        z: range.z,
        x: range.x,
        y,
        ext: range.ext
      };
    }
  }
}

// Streaming enumeration bounds memory even for a nationwide L14 request.
function* enumerateTiles(plan) {
  for (const column of enumerateTileColumns(plan)) {
    for (const segment of column.segments) {
      for (let y = segment.startY; y <= segment.endY; y++) {
        if (!inChina(column.z, column.x, y, plan.boxes)) continue;
        if (segment.includeDem) {
          yield { provKey: segment.provKey, provName: segment.provName, type: 'dem', z: column.z, x: column.x, y, ext: 'webp' };
        }
        if (segment.includeVector) {
          yield { provKey: segment.provKey, provName: segment.provName, type: 'vector', z: column.z, x: column.x, y, ext: 'pbf' };
        }
      }
    }
  }
}

module.exports = { scan, bounds, inChina, enumerateTileColumns, enumerateMissingTileRanges, enumerateMissingTiles, enumerateTiles };

if (!isMainThread) {
  try {
    const res = scan(workerData);
    parentPort.postMessage({ type: 'done', result: res });
  } catch (e) {
    throw e;
  }
}

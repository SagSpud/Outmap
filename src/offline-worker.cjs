const fs = require('fs');
const path = require('path');
const { parentPort, workerData, isMainThread } = require('worker_threads');

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
          if (parentPort && (currentTotal - lastReportCount >= 2500)) {
            lastReportCount = currentTotal;
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

  // 科学严格三态统计：全量就绪 (绿) 必须达到完整度阈值 (考虑海域/边界空瓦片容差)；部分下载 (蓝) present > 0
  for (const p of Object.values(result)) {
    for (const layer of ['dem', 'vector']) {
      const state = p.layers[layer];
      state.maxZ = 0;
      state.partialZ = 0;
      for (const [z, level] of Object.entries(state.levels)) {
        const isComplete = level.expected > 0 && (
          level.present >= level.expected ||
          (level.present >= Math.floor(level.expected * 0.95) && (level.expected - level.present) <= Math.max(3, Math.floor(level.expected * 0.05)))
        );
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
  return { stats, provinces: result, inventoryVersion: 3 };
}

// Streaming enumeration bounds memory even for a nationwide L14 request. Overlaps
// are removed geometrically instead of retaining millions of tile keys in a Set.
function* enumerateTiles({ provinces, minZ, maxZ, downloadDem, downloadVec, boxes }) {
  for (let z = minZ; z <= maxZ; z++) {
    const previous = [];
    for (const prov of provinces) {
      const b = bounds(prov.bbox, z);
      for (let x = b[0]; x <= b[1]; x++) {
        for (let y = b[2]; y <= b[3]; y++) {
          if (previous.some(p => x >= p[0] && x <= p[1] && y >= p[2] && y <= p[3]) || !inChina(z, x, y, boxes)) continue;
          if (downloadDem) yield { provKey: prov.key, provName: prov.name, type: 'dem', z, x, y, ext: 'webp' };
          if (downloadVec) yield { provKey: prov.key, provName: prov.name, type: 'vector', z, x, y, ext: 'pbf' };
        }
      }
      previous.push(b);
    }
  }
}

module.exports = { scan, bounds, inChina, enumerateTiles };

if (!isMainThread) {
  try {
    const res = scan(workerData);
    parentPort.postMessage({ type: 'done', result: res });
  } catch (e) {
    throw e;
  }
}

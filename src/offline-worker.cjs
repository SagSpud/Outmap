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
  const stats = { demCount: 0, vectorCount: 0, demBytes: 0, vectorBytes: 0, totalTiles: 0, totalBytes: 0, exact: true };
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

  for (const layer of ['dem', 'vector']) {
    const ext = layer === 'dem' ? 'webp' : 'pbf';
    const sampleBytes = [];

    for (const zd of entries(path.join(baseDir, layer))) {
      if (!zd.isDirectory() || !/^\d+$/.test(zd.name)) continue;
      const z = Number(zd.name);

      for (const xd of entries(path.join(baseDir, layer, zd.name))) {
        if (!xd.isDirectory() || !/^\d+$/.test(xd.name)) continue;
        const x = Number(xd.name);
        const candidates = (ranges[z] || []).filter(r => x >= r.b[0] && x <= r.b[1]);
        const fileEntries = entries(path.join(baseDir, layer, zd.name, xd.name));

        for (let fi = 0; fi < fileEntries.length; fi++) {
          const file = fileEntries[fi];
          const match = file.name.match(new RegExp('^(\\d+)\\.' + ext + '$'));
          if (!file.isFile() || !match) continue;

          // 适量采样校准切片字节大小，消除对 88 万文件的昂贵同步 statSync 磁盘阻塞
          if (sampleBytes.length < 300 && fi % 30 === 0) {
            try {
              const s = fs.statSync(path.join(baseDir, layer, zd.name, xd.name, file.name)).size;
              if (s > 20) sampleBytes.push(s);
            } catch (e) {}
          }

          const y = Number(match[1]);
          stats[layer + 'Count']++;

          if (inChina(z, x, y, boxes)) {
            for (const r of candidates) {
              if (y >= r.b[2] && y <= r.b[3]) {
                result[r.key].layers[layer].levels[z].present++;
              }
            }
          }

          const currentTotal = stats.demCount + stats.vectorCount;
          if (parentPort && (currentTotal - lastReportCount >= 2500)) {
            lastReportCount = currentTotal;
            parentPort.postMessage({ type: 'progress', count: currentTotal, layer, z });
          }
        }
      }
    }

    const avgTileSize = sampleBytes.length > 0
      ? Math.round(sampleBytes.reduce((a, b) => a + b, 0) / sampleBytes.length)
      : (layer === 'dem' ? 24000 : 15000);
    stats[layer + 'Bytes'] = stats[layer + 'Count'] * avgTileSize;
  }

  // 科学严格三态统计：全量就绪 (绿) 必须 present >= expected；部分下载 (蓝) present > 0
  for (const p of Object.values(result)) {
    for (const layer of ['dem', 'vector']) {
      const state = p.layers[layer];
      state.maxZ = 0;
      state.partialZ = 0;
      for (const [z, level] of Object.entries(state.levels)) {
        level.complete = level.expected > 0 && level.present >= level.expected;
        if (level.complete) state.maxZ = Math.max(state.maxZ, +z);
        if (level.present > 0) state.partialZ = Math.max(state.partialZ, +z);
      }
    }
    p.dem = Object.values(p.layers.dem.levels).some(l => l.present > 0);
    p.vec = Object.values(p.layers.vector.levels).some(l => l.present > 0);
    p.maxZ = Math.min(p.layers.dem.maxZ, p.layers.vector.maxZ);
    p.partialZ = Math.max(p.layers.dem.partialZ, p.layers.vector.partialZ);
  }

  stats.totalTiles = stats.demCount + stats.vectorCount;
  stats.totalBytes = stats.demBytes + stats.vectorBytes;
  stats.lastScannedAt = Date.now();
  return { stats, provinces: result, inventoryVersion: 2 };
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

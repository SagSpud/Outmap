/**
 * 泰山及鲁中山脉核心区 高清实景与 OSM 矢量离线预下载器
 */
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../offline-tiles');
const SAT_DIR = path.join(BASE_DIR, 'sat');
const VEC_DIR = path.join(BASE_DIR, 'vector');

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom));
}

const TAISHAN = { minLon: 116.85, maxLon: 117.35, minLat: 36.10, maxLat: 36.40 };

const satTasks = [];
const vecTasks = [];

for (let z = 8; z <= 12; z++) {
  const minX = lon2tile(TAISHAN.minLon, z);
  const maxX = lon2tile(TAISHAN.maxLon, z);
  const minY = lat2tile(TAISHAN.maxLat, z);
  const maxY = lat2tile(TAISHAN.minLat, z);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      satTasks.push({ z, x, y });
      vecTasks.push({ z, x, y });
    }
  }
}

async function downloadSat(t) {
  const file = path.join(SAT_DIR, String(t.z), String(t.x), `${t.y}.jpg`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return true;
  // EOX WMTS 模版: z/y/x.jpg
  const url = `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${t.z}/${t.y}/${t.x}.jpg`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      return true;
    }
  } catch (e) {}
  return false;
}

async function downloadVec(t) {
  const file = path.join(VEC_DIR, String(t.z), String(t.x), `${t.y}.pbf`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return true;
  const url = `https://tiles.openfreemap.org/planet/${t.z}/${t.x}/${t.y}.pbf`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      return true;
    }
  } catch (e) {}
  return false;
}

async function run() {
  console.log(`[开始预下载] 泰山核心区 高清地表(${satTasks.length}张) 与 OSM矢量(${vecTasks.length}张)...`);
  await Promise.all(satTasks.map(t => downloadSat(t)));
  console.log('[完成] 泰山高清卫星影像切片已缓存至 offline-tiles/sat');
  await Promise.all(vecTasks.map(t => downloadVec(t)));
  console.log('[完成] 泰山全要素 OSM 矢量切片已缓存至 offline-tiles/vector');
}

run();

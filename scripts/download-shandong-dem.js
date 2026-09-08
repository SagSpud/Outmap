/**
 * 山东省及核心山脉 3D DEM 瓦片高并发下载器
 * 数据源：Mapterhorn 全球数字高程瓦片 (Terrarium 格式 WebP)
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../offline-tiles/dem');
const TILE_URL_PATTERN = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const CONCURRENCY = 16; // 16 并发下载

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

// 收集需要下载的瓦片列表
const tileTasks = [];

// 1. 全球与中国宏观层级 (z = 0 ~ 5)
for (let z = 0; z <= 5; z++) {
  // 覆盖中国区域（经度 73~135, 纬度 18~54）
  const minX = Math.max(0, lon2tile(73, z));
  const maxX = Math.min(Math.pow(2, z) - 1, lon2tile(135, z));
  const minY = Math.max(0, lat2tile(54, z));
  const maxY = Math.min(Math.pow(2, z) - 1, lat2tile(18, z));

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tileTasks.push({ z, x, y });
    }
  }
}

// 2. 山东省全境宏观与中观层级 (z = 6 ~ 10)
// 山东边界: 114.8°E ~ 122.7°E, 34.3°N ~ 38.4°N
const SHANDONG_BBOX = { minLon: 114.8, maxLon: 122.7, minLat: 34.3, maxLat: 38.4 };
for (let z = 6; z <= 10; z++) {
  const minX = lon2tile(SHANDONG_BBOX.minLon, z);
  const maxX = lon2tile(SHANDONG_BBOX.maxLon, z);
  const minY = lat2tile(SHANDONG_BBOX.maxLat, z);
  const maxY = lat2tile(SHANDONG_BBOX.minLat, z);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tileTasks.push({ z, x, y });
    }
  }
}

// 3. 核心山岳高精层级 (z = 11 ~ 12)
// 泰山+徂徕山+鲁中南群峰核心圈: 116.8°E ~ 117.8°E, 35.8°N ~ 36.5°N
// 青岛崂山核心圈: 120.4°E ~ 120.8°E, 36.1°N ~ 36.3°N
const MOUNTAINS = [
  { name: '泰山及鲁中山脉', minLon: 116.8, maxLon: 117.6, minLat: 35.9, maxLat: 36.45 },
  { name: '青岛崂山群峰', minLon: 120.45, maxLon: 120.75, minLat: 36.1, maxLat: 36.28 }
];

for (const m of MOUNTAINS) {
  for (let z = 11; z <= 12; z++) {
    const minX = lon2tile(m.minLon, z);
    const maxX = lon2tile(m.maxLon, z);
    const minY = lat2tile(m.maxLat, z);
    const maxY = lat2tile(m.minLat, z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tileTasks.push({ z, x, y });
      }
    }
  }
}

// 去重
const uniqueTasksMap = new Map();
for (const t of tileTasks) {
  uniqueTasksMap.set(`${t.z}/${t.x}/${t.y}`, t);
}
const uniqueTasks = Array.from(uniqueTasksMap.values());

console.log(`[准备下载] 山东省及核心山脉离线 3D DEM 瓦片，任务总数: ${uniqueTasks.length} 张`);

async function downloadTile(task, retryCount = 3) {
  const { z, x, y } = task;
  const tileDir = path.join(OUTPUT_DIR, String(z), String(x));
  const filePath = path.join(tileDir, `${y}.webp`);

  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return true; // 已存在，断点续传跳过
  }

  const url = TILE_URL_PATTERN.replace('{z}', z).replace('{x}', x).replace('{y}', y);

  for (let i = 0; i < retryCount; i++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.status === 404) {
        // 部分海洋或超范围瓦片可能返回404，属于正常
        return true;
      }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const buffer = Buffer.from(await resp.arrayBuffer());
      fs.mkdirSync(tileDir, { recursive: true });
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (err) {
      if (i === retryCount - 1) {
        return false;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function run() {
  const startTime = Date.now();
  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  let index = 0;
  async function worker() {
    while (index < uniqueTasks.length) {
      const task = uniqueTasks[index++];
      const ok = await downloadTile(task);
      completed++;
      if (ok) successCount++;
      else failCount++;

      if (completed % 100 === 0 || completed === uniqueTasks.length) {
        const percent = ((completed / uniqueTasks.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`\r[下载进度] ${completed}/${uniqueTasks.length} (${percent}%) | 耗时: ${elapsed}s | 成功: ${successCount}`);
      }
    }
  }

  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[完成] 离线 3D DEM 瓦片全部下载完毕！总用时: ${totalElapsed}s, 存储目录: ${OUTPUT_DIR}`);
}

run();

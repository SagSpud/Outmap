/**
 * Outmap 离线缓存全量净化与修复脚本
 * 用途：
 * 1. 彻底清除旧版本遗留的巨幅卫星切片 (offline-tiles/sat)
 * 2. 彻底清除外国区域 >= 11 级的冗余矢量与 DEM 切片 (释放海量磁盘)
 * 3. 彻底清除 <= 20 字节的损坏/零字节切片 (杜绝缩放白块与图层截断)
 * 4. 彻底清理 Chromium 渲染器磁盘缓存 (清除残留的历史 204 阻断缓存)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. 定位 offline-tiles 根目录 (支持当前目录、上级目录、dist 目录)
function findOfflineDir() {
  const candidates = [
    path.resolve(__dirname, '../offline-tiles'),
    path.resolve(process.cwd(), 'offline-tiles'),
    path.resolve(process.cwd(), '../offline-tiles'),
    path.resolve(process.cwd(), 'dist/offline-tiles'),
    path.resolve(__dirname, '../../offline-tiles'),
    path.resolve(process.cwd()),
    path.join(os.homedir(), 'Documents', 'Outmap', 'offline-tiles'),
    path.join(os.homedir(), 'Documents', 'offline-tiles')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && (fs.existsSync(path.join(c, 'sat')) || fs.existsSync(path.join(c, 'dem')) || fs.existsSync(path.join(c, 'vector')) || fs.existsSync(path.join(c, 'offline_manifest.json')))) {
      return c;
    }
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), 'offline-tiles');
}

const OFFLINE_DIR = findOfflineDir();
console.log('====================================================');
console.log('   Outmap 离线缓存深度净化与自愈修复工具');
console.log('====================================================');
console.log('[目标目录]:', OFFLINE_DIR);

// 中国全域 34 省级行政区与领海诸岛金字塔切片覆盖包围盒 (含适度地理缓冲区)
const CHINA_TILES_BOXES = [
  [114.6, 119.8, 29.5, 34.8], // 安徽
  [113.4, 113.7, 22.0, 22.3], // 澳门
  [115.2, 117.7, 39.2, 41.3], // 北京
  [105.1, 110.4, 28.0, 32.4], // 重庆
  [115.6, 120.9, 23.3, 28.5], // 福建
  [92.0, 108.9, 32.3, 43.0],  // 甘肃
  [109.4, 117.5, 20.0, 25.7], // 广东
  [104.2, 112.3, 20.7, 26.6], // 广西
  [103.4, 109.8, 24.4, 29.4], // 贵州
  [108.4, 111.3, 18.0, 20.4], // 海南
  [113.2, 120.0, 35.8, 42.8], // 河北
  [121.0, 135.3, 43.2, 53.8], // 黑龙江
  [110.1, 116.8, 31.2, 36.6], // 河南
  [108.1, 116.3, 28.8, 33.5], // 湖北
  [108.6, 114.4, 24.4, 30.3], // 湖南
  [121.4, 131.5, 40.6, 46.5], // 吉林
  [116.1, 122.1, 30.5, 35.3], // 江苏
  [113.3, 118.7, 24.3, 30.3], // 江西
  [118.6, 126.0, 38.5, 43.7], // 辽宁
  [97.0, 114.0, 37.4, 43.2],  // 内蒙古西
  [114.0, 126.5, 41.5, 53.5], // 内蒙古东
  [105.0, 115.0, 41.0, 44.2], // 内蒙古中
  [104.1, 107.9, 35.0, 39.6], // 宁夏
  [89.2, 103.3, 31.4, 39.5],  // 青海
  [114.6, 122.9, 34.1, 38.6], // 山东
  [110.0, 114.7, 34.4, 40.9], // 山西
  [105.3, 111.4, 31.5, 39.8], // 陕西
  [120.6, 122.4, 30.5, 32.1], // 上海
  [97.1, 108.7, 25.8, 34.5],  // 四川
  [119.5, 124.0, 21.5, 26.0], // 台湾 (含钓鱼岛)
  [116.5, 118.3, 38.3, 40.5], // 天津
  [78.2, 99.3, 26.6, 36.7],   // 西藏
  [113.8, 114.5, 22.1, 22.6], // 香港
  [73.3, 96.6, 34.1, 49.4],   // 新疆
  [97.3, 106.4, 20.9, 29.4],  // 云南
  [117.8, 123.2, 26.8, 31.5], // 浙江
  [108.0, 124.0, 3.0, 20.0]   // 南海诸岛及曾母暗沙
];

function tile2lon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function isTileInChina(z, x, y) {
  const minLon = tile2lon(x, z);
  const maxLon = tile2lon(x + 1, z);
  const minLat = tile2lat(y + 1, z);
  const maxLat = tile2lat(y, z);

  const MARGIN = 1.2;
  for (const [bMinLon, bMaxLon, bMinLat, bMaxLat] of CHINA_TILES_BOXES) {
    if (!(maxLon < (bMinLon - MARGIN) || minLon > (bMaxLon + MARGIN) || maxLat < (bMinLat - MARGIN) || minLat > (bMaxLat + MARGIN))) {
      return true;
    }
  }
  return false;
}

let deletedSatCount = 0;
let deletedForeignCount = 0;
let deletedCorruptedCount = 0;
let freedBytes = 0;

// 1. 清理旧版卫星切片 sat
const satDir = path.join(OFFLINE_DIR, 'sat');
if (fs.existsSync(satDir)) {
  console.log('[1/4] 正在清理旧版卫星切片目录 (offline-tiles/sat)...');
  function removeDirRecursive(dir) {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of list) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        removeDirRecursive(full);
      } else {
        freedBytes += fs.statSync(full).size;
        deletedSatCount++;
        fs.unlinkSync(full);
      }
    }
    fs.rmdirSync(dir);
  }
  try {
    removeDirRecursive(satDir);
    console.log(`      ✓ 卫星切片已全部清空，清理 ${deletedSatCount} 块切片`);
  } catch (e) {
    console.warn('      ! 清理卫星切片部分失败:', e.message);
  }
} else {
  console.log('[1/4] 未发现卫星切片目录，无需清理。');
}

// 2. 清理 vector 和 dem 中缩放 >= 11 的外国切片与损坏空文件
console.log('[2/4] 正在扫描外国 L11+ 冗余切片与损坏文件...');
['vector', 'dem'].forEach(type => {
  const typeDir = path.join(OFFLINE_DIR, type);
  if (!fs.existsSync(typeDir)) return;

  const zoomDirs = fs.readdirSync(typeDir, { withFileTypes: true });
  for (const zEnt of zoomDirs) {
    if (!zEnt.isDirectory()) continue;
    const z = parseInt(zEnt.name, 10);
    const zDir = path.join(typeDir, zEnt.name);

    const xDirs = fs.readdirSync(zDir, { withFileTypes: true });
    for (const xEnt of xDirs) {
      if (!xEnt.isDirectory()) continue;
      const x = parseInt(xEnt.name, 10);
      const xDir = path.join(zDir, xEnt.name);

      const files = fs.readdirSync(xDir);
      for (const file of files) {
        const filePath = path.join(xDir, file);
        const y = parseInt(file.split('.')[0], 10);

        try {
          const stat = fs.statSync(filePath);
          // 损坏或零字节切片
          if (stat.size <= 20) {
            freedBytes += stat.size;
            deletedCorruptedCount++;
            fs.unlinkSync(filePath);
            continue;
          }

          // 外国区域 L11+ 切片
          if (z >= 11 && !isTileInChina(z, x, y)) {
            freedBytes += stat.size;
            deletedForeignCount++;
            fs.unlinkSync(filePath);
          }
        } catch (e) {}
      }

      // 若目录变空则删除
      try {
        if (fs.readdirSync(xDir).length === 0) fs.rmdirSync(xDir);
      } catch (e) {}
    }

    try {
      if (fs.readdirSync(zDir).length === 0) fs.rmdirSync(zDir);
    } catch (e) {}
  }
});

console.log(`      ✓ 清理外国 L11+ 冗余切片: ${deletedForeignCount} 块`);
console.log(`      ✓ 清理损坏/空切片文件: ${deletedCorruptedCount} 块`);

// 3. 清理 Chromium 磁盘缓存与 GPUCache
console.log('[3/4] 正在清理 Chromium 渲染引擎磁盘缓存 (消除残留 204 阻断记录)...');
let cleanedBrowserCache = false;
const appData = process.env.APPDATA || (os.homedir() ? path.join(os.homedir(), 'AppData', 'Roaming') : '');
if (appData) {
  const cacheDirs = [
    path.join(appData, 'Outmap', 'Cache'),
    path.join(appData, 'Outmap', 'GPUCache'),
    path.join(appData, 'outmap', 'Cache'),
    path.join(appData, 'outmap', 'GPUCache')
  ];

  cacheDirs.forEach(cd => {
    if (fs.existsSync(cd)) {
      try {
        fs.rmSync(cd, { recursive: true, force: true });
        cleanedBrowserCache = true;
      } catch (e) {}
    }
  });
}

if (cleanedBrowserCache) {
  console.log('      ✓ Chromium 磁盘缓存与 GPUCache 已彻底净化');
} else {
  console.log('      ✓ Chromium 缓存已处于纯净状态');
}

// 4. 统计汇报
console.log('====================================================');
const mbFreed = (freedBytes / (1024 * 1024)).toFixed(1);
console.log(`[完成] 离线净化成功！`);
console.log(` - 清理卫星切片: ${deletedSatCount} 块`);
console.log(` - 清理外国高缩放切片: ${deletedForeignCount} 块`);
console.log(` - 修复损坏切片: ${deletedCorruptedCount} 块`);
console.log(` - 释放总存储空间: 约 ${mbFreed} MB`);
console.log('现在重新打开 Outmap 即可获得最佳无缝高程与路网浏览体验！');
console.log('====================================================');

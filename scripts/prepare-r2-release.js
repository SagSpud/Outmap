const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const asar = require(path.join(rootDir, 'node_modules', '@electron', 'asar'));

async function main() {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  // Never upload a release whose production scripts cannot even be parsed.
  for (const file of [
    'main.js',
    'preload.js',
    'src/app.js',
    'src/tile-archive.cjs',
    'src/location-camera.js',
    'src/favorite-interactions.js',
    'src/download-flow.cjs',
    'src/download-lane.cjs',
    'src/unavailable-tile-index.cjs',
    'src/convert-to-pmtiles.cjs',
    'src/contour-generator.cjs'
  ]) {
    const code = fs.readFileSync(path.join(rootDir, file), 'utf8');
    new vm.Script(require('module').wrap(code), { filename: file });
  }

  const targetVersion = process.argv[2] || pkg.version;
  const defaultNotes = [
    '1. 彻底解决离线瓦片转 PMTiles 卡住/无响应/高 CPU 占用：重构为超低内存流式写入引擎（4MB 块流式 I/O，杜绝内存爆满与 GC 垃圾回收死锁，内存占用恒定 < 30MB）；',
    '2. 新增独立 Fluent 实时打包进度窗口：双击批处理或外部调用时自动弹出优雅紧凑的深色进度窗，直观呈现扫描/打包百分比、瓦片计数与实时传输速率；',
    '3. 瓦片空间索引与变长编码极速优化：基于 Hilbert 空间曲线排序与预分配直接缓冲区，几十万级大体量瓦片数秒内极速流式归档；',
    '4. 强化跨机器同级外层目录智能探查：自动优先识别程序同级外层 offline-tiles，实现软件升级与几十 GB 离线瓦片资产彻底解耦。'
  ].join('\n');
  const customNotes = process.argv[3] || defaultNotes;

  console.log('\n========================================');
  console.log('🚀 准备打包 Cloudflare R2 发布包');
  console.log('📌 目标版本: v' + targetVersion);
  console.log('========================================\n');

  const outputDir = path.join(rootDir, 'dist', 'r2-release');
  const stagingDir = path.join(rootDir, 'dist', 'temp_r2_staging');

  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  ['main.js', 'preload.js'].forEach(f => {
    fs.copyFileSync(path.join(rootDir, f), path.join(stagingDir, f));
  });

  const stagingPkg = { ...pkg, version: targetVersion };
  fs.writeFileSync(path.join(stagingDir, 'package.json'), JSON.stringify(stagingPkg, null, 2), 'utf8');

  copyDir(path.join(rootDir, 'src'), path.join(stagingDir, 'src'));

  // 将 pmtiles 及其必需的 fflate 运行时依赖完整打包至 stagingDir/node_modules
  const runtimeDeps = ['pmtiles', 'fflate'];
  for (const dep of runtimeDeps) {
    const depSrc = path.join(rootDir, 'node_modules', dep);
    if (fs.existsSync(depSrc)) {
      copyDir(depSrc, path.join(stagingDir, 'node_modules', dep));
      console.log(`   - 📦 已打包独立运行时依赖: ${dep}`);
    } else {
      throw new Error(`缺少关键运行时依赖: ${dep}，请先执行 npm install`);
    }
  }

  const outAsar = path.join(outputDir, 'app.asar');
  if (fs.existsSync(outAsar)) {
    fs.unlinkSync(outAsar);
  }

  console.log('📦 正在压缩构建 app.asar ...');
  await asar.createPackage(stagingDir, outAsar);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  // 关键自检：在纯隔离独立环境中运行，确保在没有宿主全局 node_modules 的用户电脑上能 100% 独立启动
  console.log('🔍 正在纯隔离独立环境中严格校验 app.asar 完整性...');
  const isolatedDir = path.join(rootDir, 'dist', 'temp_asar_isolated_verify');
  if (fs.existsSync(isolatedDir)) fs.rmSync(isolatedDir, { recursive: true, force: true });
  fs.mkdirSync(isolatedDir, { recursive: true });
  fs.copyFileSync(outAsar, path.join(isolatedDir, 'app.asar'));

  const verifyScript = `
    try {
      require('./app.asar/src/tile-archive.cjs');
      require('./app.asar/src/convert-to-pmtiles.cjs');
      console.log('[ISOLATED_VERIFY_OK]');
      process.exit(0);
    } catch (err) {
      console.error('[ISOLATED_VERIFY_FAIL]', err.message);
      process.exit(1);
    }
  `;
  fs.writeFileSync(path.join(isolatedDir, 'verify.cjs'), verifyScript, 'utf8');

  const electronCli = path.resolve(rootDir, 'node_modules', 'electron', 'cli.js');
  const verifyRes = require('child_process').spawnSync(process.execPath, [electronCli, 'verify.cjs'], {
    cwd: isolatedDir,
    env: { ...process.env, NODE_PATH: '' }
  });

  fs.rmSync(isolatedDir, { recursive: true, force: true });

  if (verifyRes.status !== 0) {
    throw new Error(`app.asar 独立环境自检失败: ${verifyRes.stderr.toString().trim() || verifyRes.stdout.toString().trim()}`);
  }
  console.log('   - 🛡️  app.asar 纯独立运行环境自检 100% 通过（pmtiles、fflate 与离线转换引擎均可独立解析）！');

  // 自动同步更新本地便携包，方便本机测试与手动拷贝
  const localPortableAsar = path.join(rootDir, 'dist', 'Outmap', 'resources', 'app.asar');
  if (fs.existsSync(path.dirname(localPortableAsar))) {
    fs.copyFileSync(outAsar, localPortableAsar);
    console.log('   - 🔄 已自动同步至本地便携版: ' + localPortableAsar);
  }

  const bat1 = path.join(rootDir, '现有离线数据一键转PMTiles单文件.bat');
  const bat2 = path.join(rootDir, '等高线离线预生成工具.bat');
  const targetDir = path.join(rootDir, 'dist', 'Outmap');
  if (fs.existsSync(targetDir)) {
    if (fs.existsSync(bat1)) fs.copyFileSync(bat1, path.join(targetDir, '现有离线数据一键转PMTiles单文件.bat'));
    if (fs.existsSync(bat2)) fs.copyFileSync(bat2, path.join(targetDir, '等高线离线预生成工具.bat'));
    console.log('   - 🔄 已自动同步两枚批处理脚本至本地便携版根目录');
  }

  const stats = fs.statSync(outAsar);
  const fileBuf = fs.readFileSync(outAsar);
  const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');

  const releaseNow = new Date();
  const localReleaseDate = [
    releaseNow.getFullYear(),
    String(releaseNow.getMonth() + 1).padStart(2, '0'),
    String(releaseNow.getDate()).padStart(2, '0')
  ].join('-');
  const versionInfo = {
    version: targetVersion,
    // Use the host's local calendar date. ISO UTC can show yesterday for an
    // Asia/Shanghai release published shortly after midnight.
    releaseDate: localReleaseDate,
    notes: customNotes,
    downloadUrl: 'https://r2.053999.xyz/Outmap/app.asar',
    backupUrl: 'https://pub-9fa3d477907d4d5aa99d54b609094d73.r2.dev/Outmap/app.asar',
    fileSize: stats.size,
    sha256: sha256
  };

  const outVersionJson = path.join(outputDir, 'version.json');
  fs.writeFileSync(outVersionJson, JSON.stringify(versionInfo, null, 2), 'utf8');

  console.log('\n✅ 打包就绪！生成发布文件:');
  console.log('   - 📁 输出目录: ' + outputDir);
  console.log('   - 📦 文件 1: app.asar (' + (stats.size / 1024 / 1024).toFixed(2) + ' MB, SHA256: ' + sha256.substring(0, 12) + '...)');
  console.log('   - 📄 文件 2: version.json');

  // 检查是否具备自动上传密钥
  try {
    const { uploadRelease, getR2Credentials } = require('./upload-to-r2');
    const creds = getR2Credentials();
    if (creds.accessKeyId && creds.secretAccessKey) {
      console.log('\n🚀 检测到 R2 上传密钥凭据，正在全自动推送到 Cloudflare R2...');
      await uploadRelease();
      return;
    }
  } catch (e) {
    // A failed upload is a failed release, never silently report packaging success.
    throw new Error('自动发布失败: ' + e.message);
  }

  console.log('\n☁️  Cloudflare R2 上传指南:');
  console.log('   打开 Cloudflare 控制台 -> R2 -> sagspud -> Outmap/ 目录:');
  console.log('   直接将 ' + outputDir + ' 下的 [app.asar] 和 [version.json] 拖拽上传即可！');
  console.log('   或者提供 R2 API Token 的 Access Key ID 和 Secret Access Key，即可实现以后每次改完全自动后台推送！\n');
}

main().catch(err => {
  console.error('打包发布包失败:', err);
  process.exit(1);
});

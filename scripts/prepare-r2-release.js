const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const asar = require(path.join(rootDir, 'node_modules', '@electron', 'asar'));

async function main() {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const targetVersion = process.argv[2] || pkg.version;
  const defaultNotes = [
    '1. 统一右侧六个按钮的按压、悬停与启用状态，图层按钮保持清晰的蓝色图标；',
    '2. 图层面板标题精简为“图层”；',
    '3. 离线下载绿点改由真实磁盘清单恢复，关闭面板或重启后仍能记住完整省份；',
    '4. 修复视角同步覆盖跨端收藏的问题，桌面与网页改为源站最新数据双向合并、串行上传。'
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

  const outAsar = path.join(outputDir, 'app.asar');
  if (fs.existsSync(outAsar)) {
    fs.unlinkSync(outAsar);
  }

  console.log('📦 正在压缩构建 app.asar ...');
  await asar.createPackage(stagingDir, outAsar);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  // 自动同步更新本地便携包，方便本机测试与手动拷贝
  const localPortableAsar = path.join(rootDir, 'dist', 'Outmap', 'resources', 'app.asar');
  if (fs.existsSync(path.dirname(localPortableAsar))) {
    fs.copyFileSync(outAsar, localPortableAsar);
    console.log('   - 🔄 已自动同步至本地便携版: ' + localPortableAsar);
  }

  const stats = fs.statSync(outAsar);
  const fileBuf = fs.readFileSync(outAsar);
  const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');

  const versionInfo = {
    version: targetVersion,
    releaseDate: new Date().toISOString().split('T')[0],
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
  } catch (e) {}

  console.log('\n☁️  Cloudflare R2 上传指南:');
  console.log('   打开 Cloudflare 控制台 -> R2 -> sagspud -> Outmap/ 目录:');
  console.log('   直接将 ' + outputDir + ' 下的 [app.asar] 和 [version.json] 拖拽上传即可！');
  console.log('   或者提供 R2 API Token 的 Access Key ID 和 Secret Access Key，即可实现以后每次改完全自动后台推送！\n');
}

main().catch(err => {
  console.error('打包发布包失败:', err);
  process.exit(1);
});

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { getR2Credentials, uploadFileToR2 } = require('./upload-to-r2');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = pkg.version;
  const outmapDir = path.join(rootDir, 'dist', 'Outmap');
  const zipVersion = path.join(rootDir, 'dist', `Outmap-${version}-win.zip`);
  const zipLatest = path.join(rootDir, 'dist', 'Outmap-win.zip');

  console.log(`📦 Recompressing dist/Outmap into Outmap-${version}-win.zip and Outmap-win.zip...`);
  if (fs.existsSync(zipVersion)) fs.unlinkSync(zipVersion);
  if (fs.existsSync(zipLatest)) fs.unlinkSync(zipLatest);

  // Use tar.exe to create zip
  execSync(`tar -a -cf "${zipVersion}" *`, { cwd: outmapDir });
  fs.copyFileSync(zipVersion, zipLatest);

  const stats = fs.statSync(zipVersion);
  console.log(`✅ Compressed successfully: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const credentials = getR2Credentials();
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    console.error('Missing R2 credentials');
    process.exit(1);
  }

  console.log(`🚀 Uploading Outmap-${version}-win.zip to R2...`);
  await uploadFileToR2({
    filePath: zipVersion,
    s3Key: `Outmap/Outmap-${version}-win.zip`,
    contentType: 'application/zip',
    credentials
  });
  console.log(`✅ Outmap-${version}-win.zip uploaded`);

  console.log('🚀 Uploading Outmap-win.zip to R2...');
  await uploadFileToR2({
    filePath: zipLatest,
    s3Key: 'Outmap/Outmap-win.zip',
    contentType: 'application/zip',
    credentials
  });
  console.log('✅ Outmap-win.zip uploaded');
  console.log('🎉 Full package upload complete!');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

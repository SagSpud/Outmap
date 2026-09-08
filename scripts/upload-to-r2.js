const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, '.r2_config.json');

// 获取 R2 认证配置
function getR2Credentials() {
  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {}
  }

  const accountId = cfg.accountId || process.env.R2_ACCOUNT_ID || 'f0423794f245054a81f1fbc59ea859c5';
  const bucket = cfg.bucket || process.env.R2_BUCKET || 'sagspud';
  const accessKeyId = cfg.accessKeyId || process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = cfg.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  return { accountId, bucket, accessKeyId, secretAccessKey };
}

// AWS SigV4 签名计算
function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

function uploadFileToR2({ filePath, s3Key, contentType, credentials }) {
  return new Promise((resolve, reject) => {
    const fileBuf = fs.readFileSync(filePath);
    const host = `${credentials.accountId}.r2.cloudflarestorage.com`;
    const s3Path = `/${credentials.bucket}/${s3Key.replace(/^\//, '')}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const region = 'auto';
    const service = 's3';

    const payloadHash = crypto.createHash('sha256').update(fileBuf).digest('hex');

    const canonicalHeaders = [
      `content-length:${fileBuf.length}`,
      `content-type:${contentType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`
    ].join('\n') + '\n';

    const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      encodeURI(s3Path),
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n');

    const signingKey = getSignatureKey(credentials.secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const options = {
      hostname: host,
      port: 443,
      path: s3Path,
      method: 'PUT',
      headers: {
        'Host': host,
        'Content-Type': contentType,
        'Content-Length': fileBuf.length,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorization
      }
    };

    console.log(`⏳ 正在上传 ${path.basename(filePath)} (${(fileBuf.length / 1024 / 1024).toFixed(2)} MB) 到 R2: ${s3Key} ...`);

    const req = https.request(options, (res) => {
      let respBody = '';
      res.on('data', (chunk) => { respBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ 上传成功: ${s3Key} (HTTP ${res.statusCode})`);
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          console.error(`❌ 上传失败: ${s3Key} (HTTP ${res.statusCode})\n${respBody}`);
          reject(new Error(`HTTP ${res.statusCode}: ${respBody}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ 网络请求错误: ${err.message}`);
      reject(err);
    });

    req.write(fileBuf);
    req.end();
  });
}

async function uploadRelease() {
  const credentials = getR2Credentials();

  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    console.error('\n⚠️  [缺少 R2 上传密钥]');
    console.error('上传到 Cloudflare R2 存储桶需要配置 Access Key ID 与 Secret Access Key。');
    console.error('请在工程根目录创建 [.r2_config.json] 文件，或设置环境变量 R2_ACCESS_KEY_ID 与 R2_SECRET_ACCESS_KEY。');
    console.error('格式示例:');
    console.error(JSON.stringify({
      accountId: credentials.accountId,
      bucket: credentials.bucket,
      accessKeyId: "你的 R2 Access Key ID",
      secretAccessKey: "你的 R2 Secret Access Key"
    }, null, 2));
    process.exit(1);
  }

  const releaseDir = path.join(rootDir, 'dist', 'r2-release');
  const asarPath = path.join(releaseDir, 'app.asar');
  const verPath = path.join(releaseDir, 'version.json');

  if (!fs.existsSync(asarPath) || !fs.existsSync(verPath)) {
    console.error('发布文件不存在，请先执行打包脚本生成发布文件！');
    process.exit(1);
  }

  // 1. 上传 app.asar
  await uploadFileToR2({
    filePath: asarPath,
    s3Key: 'Outmap/app.asar',
    contentType: 'application/octet-stream',
    credentials
  });

  // 2. 上传 version.json (后上传 version.json，确保客户端检测到新版时 asar 已完全就绪)
  await uploadFileToR2({
    filePath: verPath,
    s3Key: 'Outmap/version.json',
    contentType: 'application/json',
    credentials
  });

  console.log('\n🎉 全部发布文件已自动同步到 Cloudflare R2！');
  console.log('🌐 节点验证地址:');
  console.log(`   - 自定义域: https://r2.053999.xyz/Outmap/version.json`);
  console.log(`   - 开发域名: https://pub-9fa3d477907d4d5aa99d54b609094d73.r2.dev/Outmap/version.json`);
  console.log('\n📱 另一台电脑只需打开 Outmap，点击最左侧 Logo 图标即可一键自动更新覆盖！\n');
}

if (require.main === module) {
  uploadRelease().catch(err => {
    console.error('执行上传异常:', err);
    process.exit(1);
  });
}

module.exports = { uploadRelease, getR2Credentials, uploadFileToR2 };

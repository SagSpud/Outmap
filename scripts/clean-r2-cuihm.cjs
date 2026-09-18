const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, '.r2_config.json');

const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const accountId = cfg.accountId;
const bucket = cfg.bucket;
const accessKeyId = cfg.accessKeyId;
const secretAccessKey = cfg.secretAccessKey;

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

function uploadBufferToR2(buf, s3Key, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const s3Path = `/${bucket}/${s3Key.replace(/^\//, '')}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const region = 'auto';
    const service = 's3';

    const payloadHash = crypto.createHash('sha256').update(buf).digest('hex');
    const canonicalHeaders = [
      `content-length:${buf.length}`,
      `content-type:${contentType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`
    ].join('\n') + '\n';
    const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = ['PUT', encodeURI(s3Path), '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, canonicalRequestHash].join('\n');
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const req = https.request({
      hostname: host, port: 443, path: s3Path, method: 'PUT',
      headers: {
        'Host': host, 'Content-Type': contentType, 'Content-Length': buf.length,
        'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, 'Authorization': authorization
      }
    }, res => {
      let resp = '';
      res.on('data', c => resp += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ success: true });
        else reject(new Error(`HTTP ${res.statusCode}: ${resp}`));
      });
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

async function main() {
  console.log('Fetching https://r2.053999.xyz/Outmap/sync/user_cuihm.json ...');
  const data = await new Promise((resolve, reject) => {
    https.get('https://r2.053999.xyz/Outmap/sync/user_cuihm.json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  console.log('Original routes count:', data.routes.length);
  const targetRoute = data.routes.find(r => r.id === 'route_trip_1' || r.name.includes('承德-乌兰布统'));
  console.log('Target route found:', targetRoute?.name, targetRoute?.id);

  // Filter out route_trip_1 from routes
  data.routes = data.routes.filter(r => r.id !== 'route_trip_1' && !r.name.includes('承德-乌兰布统'));
  console.log('Routes count after removal:', data.routes.length);

  // Update or add tombstone in deletedRoutes with a fresh high timestamp
  const now = Date.now();
  if (!Array.isArray(data.deletedRoutes)) data.deletedRoutes = [];
  data.deletedRoutes = data.deletedRoutes.filter(d => d.id !== 'route_trip_1' && !d.name.includes('承德-乌兰布统'));
  data.deletedRoutes.push({
    id: 'route_trip_1',
    name: '2024-国庆_承德-乌兰布统-草原天路',
    distKm: 638.6,
    time: now
  });

  data.syncedAt = new Date().toISOString();
  data.updatedAt = now;

  console.log('Uploading updated user_cuihm.json to R2...');
  const buf = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  await uploadBufferToR2(buf, 'Outmap/sync/user_cuihm.json');
  console.log('✅ Successfully purged route_trip_1 from R2 user_cuihm.json!');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

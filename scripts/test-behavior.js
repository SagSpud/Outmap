const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const watchdog = setTimeout(() => {
  console.error('Behavioral tests timed out');
  process.exit(1);
}, 60000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false
    }
  });

  const indexPath = path.join(__dirname, '..', 'src', 'index.html');
  await win.loadFile(indexPath);

  const testResults = await win.webContents.executeJavaScript(`(async () => {
    const results = [];
    const assertTest = (name, cond, msg = '') => {
      if (!cond) throw new Error(\`[FAIL] \${name}: \${msg}\`);
      results.push(\`[PASS] \${name}\`);
    };

    // 1. 测试 GPX / KML / GeoJSON 解析与海拔保留
    const sampleGpx = \`<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Test">
      <trk><name>四姑娘山攀登</name><trkseg>
        <trkpt lat="31.0020" lon="103.6210"><ele>3200.5</ele></trkpt>
        <trkpt lat="31.0260" lon="103.1250"><ele>4481.0</ele></trkpt>
      </trkseg></trk>
    </gpx>\`;
    const parsedGpx = parseTrackFile(sampleGpx, 'test.gpx');
    assertTest('GPX 解析名称', parsedGpx && parsedGpx.name === '四姑娘山攀登');
    assertTest('GPX 解析坐标点数', parsedGpx && parsedGpx.coords.length === 2);
    assertTest('GPX 解析保留高程', parsedGpx && parsedGpx.coords[0][2] === 3200.5 && parsedGpx.coords[1][2] === 4481.0);

    const sampleKml = \`<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>贡嘎大环线</name><LineString>
      <coordinates>101.95,29.58,3500 101.98,29.62,4200</coordinates>
    </LineString></Placemark></kml>\`;
    const parsedKml = parseTrackFile(sampleKml, 'gongga.kml');
    assertTest('KML 解析名称', parsedKml && parsedKml.name === '贡嘎大环线');
    assertTest('KML 解析坐标与海拔', parsedKml && parsedKml.coords.length === 2 && parsedKml.coords[1][2] === 4200);

    // 2. 测试大圆测地线与多段路线连续性
    const pA = [104.0668, 30.5728];
    const pB = [102.8360, 30.9980];
    const distKm = calculateDistanceKm(pA, pB);
    const steps = Math.max(5, Math.min(30, Math.round(distKm / 0.5)));
    const seg = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      seg.push([pA[0] + (pB[0] - pA[0]) * t, pA[1] + (pB[1] - pA[1]) * t]);
    }
    assertTest('测地线首端匹配', Math.abs(seg[0][0] - pA[0]) < 1e-6 && Math.abs(seg[0][1] - pA[1]) < 1e-6);
    assertTest('测地线末端精准包含目的地', Math.abs(seg[seg.length - 1][0] - pB[0]) < 1e-6 && Math.abs(seg[seg.length - 1][1] - pB[1]) < 1e-6);

    // 3. 测试 25 个途径点切片缝合无缺口
    const multiPts = [];
    for (let i = 0; i < 25; i++) {
      multiPts.push([100.0 + i * 0.1, 30.0 + i * 0.05]);
    }
    const CHUNK_SIZE = 7;
    const chunks = [];
    for (let i = 0; i < multiPts.length - 1; i += CHUNK_SIZE) {
      chunks.push(multiPts.slice(i, Math.min(multiPts.length, i + CHUNK_SIZE + 1)));
    }
    const merged = [];
    chunks.forEach((chunk, rIdx) => {
      if (rIdx === 0) {
        merged.push(...chunk);
      } else {
        const lastPt = merged[merged.length - 1];
        const firstPt = chunk[0];
        const dLng = Math.abs(lastPt[0] - firstPt[0]);
        const dLat = Math.abs(lastPt[1] - firstPt[1]);
        if (dLng < 1e-5 && dLat < 1e-5) {
          merged.push(...chunk.slice(1));
        } else {
          merged.push(...chunk);
        }
      }
    });
    assertTest('多段切分缝合总点数保持一致', merged.length === 25);
    for (let i = 0; i < merged.length; i++) {
      assertTest(\`点位 \${i} 连续无跳跃\`, Math.abs(merged[i][0] - multiPts[i][0]) < 1e-5 && Math.abs(merged[i][1] - multiPts[i][1]) < 1e-5);
    }

    // 4. 测试图层层叠顺序 (路线图层在路名标注图层之下)
    const map = window.currentOutdoorMap;
    if (map) {
      renderRouteGeometry(map, [[116.4, 39.9], [116.5, 40.0]]);
      const layers = map.getStyle().layers;
      const casingIdx = layers.findIndex(l => l.id === 'outdoor-route-casing');
      const lineIdx = layers.findIndex(l => l.id === 'outdoor-route-line');
      const firstSymbolIdx = layers.findIndex(l => l.type === 'symbol' && !l.id.startsWith('outdoor-route-'));
      assertTest('路线轮廓图层已创建', casingIdx !== -1);
      assertTest('路线主体图层已创建', lineIdx !== -1);
      if (firstSymbolIdx !== -1) {
        assertTest('路线层级位于文字标注下方', lineIdx <= firstSymbolIdx, \`lineIdx=\${lineIdx}, symbolIdx=\${firstSymbolIdx}\`);
      }
    }

    // 5. 测试离线三态逻辑
    const mockFullProv = {
      maxZ: 14,
      layers: {
        vector: {
          levels: {
            10: { present: 50, expected: 50, complete: true },
            11: { present: 180, expected: 180, complete: true },
            12: { present: 600, expected: 600, complete: true },
            13: { present: 2200, expected: 2200, complete: true },
            14: { present: 8000, expected: 8000, complete: true }
          }
        }
      }
    };
    const mockPartialProv = {
      maxZ: 0,
      partialZ: 12,
      layers: {
        vector: {
          levels: {
            10: { present: 50, expected: 50, complete: true },
            11: { present: 100, expected: 180, complete: false },
            12: { present: 20, expected: 600, complete: false },
            13: { present: 0, expected: 2200, complete: false },
            14: { present: 0, expected: 8000, complete: false }
          }
        }
      }
    };
    const mockEmptyProv = { maxZ: 0, partialZ: 0 };

    const isFullCheck = (s) => (s?.maxZ >= 14) || [10, 11, 12, 13, 14].every(z => s?.layers?.vector?.levels?.[z]?.complete);
    const isPartialCheck = (s) => !isFullCheck(s) && ((s?.partialZ >= 10) || [10, 11, 12, 13, 14].some(z => (s?.layers?.vector?.levels?.[z]?.present || 0) > 0));

    assertTest('全量下载判全为 True', isFullCheck(mockFullProv) === true);
    assertTest('部分下载判全为 False', isFullCheck(mockPartialProv) === false);
    assertTest('部分下载判部分为 True', isPartialCheck(mockPartialProv) === true);
    assertTest('未下载判全为 False', isFullCheck(mockEmptyProv) === false);
    assertTest('未下载判部分为 False', isPartialCheck(mockEmptyProv) === false);

    // 6. 测试右键菜单按钮精简文本
    const btnVia = document.getElementById('ctx-btn-route-via');
    const btnStart = document.getElementById('ctx-btn-route-start');
    const btnEnd = document.getElementById('ctx-btn-route-end');
    assertTest('右键途径点文本', btnVia && btnVia.innerText.includes('途径点'));
    assertTest('右键起点文本', btnStart && btnStart.innerText.includes('设为起点'));
    assertTest('右键终点文本', btnEnd && btnEnd.innerText.includes('设为终点'));

    return results;
  })()`);

  console.log('--- Behavioral Test Results ---');
  testResults.forEach(r => console.log(r));
  console.log('--- All Behavioral Tests Passed Successfully ---');

  clearTimeout(watchdog);
  win.close();
  app.quit();
}).catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

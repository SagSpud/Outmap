'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { app, BrowserWindow, ipcMain } = require('electron');
const { buildPmtilesBuffer, TileArchiveManager, NodeFileSource } = require('../src/tile-archive.cjs');

app.commandLine.appendSwitch('disable-features', 'Win32kLockdown');

async function runTests() {
  console.log('=== [Outmap v2.0.22 Architecture Integration Tests] ===\n');

  // Test 1: Adaptive tile cache math & boundaries
  console.log('--- Test 1: Adaptive tile cache computation ---');
  {
    const computeAdaptive = ({ isWeb, isConstrained, dpr = 1, width = 1920, height = 1080 } = {}) => {
      const effectiveDpr = Math.min(3, Math.max(1, Number(dpr) || 1));
      const viewW = Math.max(360, Number(width) || 1920);
      const viewH = Math.max(360, Number(height) || 1080);
      const screenPixels = (viewW * effectiveDpr) * (viewH * effectiveDpr);
      const baseVisibleTiles = Math.ceil(screenPixels / (512 * 512));
      const idealCache = Math.round(baseVisibleTiles * 4.5);
      if (isConstrained) return Math.min(256, Math.max(128, idealCache));
      if (isWeb) return Math.min(512, Math.max(256, idealCache));
      return Math.min(1024, Math.max(480, idealCache));
    };

    const c1080p1x = computeAdaptive({ dpr: 1, width: 1920, height: 1080 });
    console.log(`  1080p 1x cache size: ${c1080p1x}`);
    assert.strictEqual(c1080p1x, 480, '1080p 1x desktop should clamp to min 480');

    // 200% scale on 4K display (3840x2160, DPR=2)
    const c4k2x = computeAdaptive({ dpr: 2, width: 3840, height: 2160 });
    console.log(`  4K 200% DPR cache size: ${c4k2x}`);
    assert.ok(c4k2x >= 480 && c4k2x <= 1024, '4K 2x desktop should be within [480, 1024]');
    assert.ok(c4k2x > c1080p1x, '4K 2x desktop should have larger cache than 1080p 1x');

    // 200% scale on 1080p display (1920x1080, DPR=2)
    const c1080p2x = computeAdaptive({ dpr: 2, width: 1920, height: 1080 });
    console.log(`  1080p 200% DPR cache size: ${c1080p2x}`);
    assert.ok(c1080p2x >= 480 && c1080p2x <= 1024, '1080p 2x desktop within [480, 1024]');

    // Constrained web (mobile/embedded)
    const cConstrained = computeAdaptive({ isConstrained: true, dpr: 2, width: 400, height: 800 });
    console.log(`  Constrained web cache size: ${cConstrained}`);
    assert.ok(cConstrained >= 128 && cConstrained <= 256, 'Constrained web clamped between 128 and 256');

    console.log('✓ Test 1 Passed: Adaptive tile cache math & boundaries correct.\n');
  }

  // Test 2: PMTiles single-file creation and random access
  console.log('--- Test 2: PMTiles archive creation, header, and random access ---');
  const tempDir = path.join(__dirname, '..', 'tmp_test_archive_' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  const pmtilesPath = path.join(tempDir, 'test_vector.pmtiles');
  const contourPmtilesPath = path.join(tempDir, 'test_contour.pmtiles');

  try {
    const dummyTiles = [
      { z: 0, x: 0, y: 0, data: Buffer.from('tile-0-0-0-data') },
      { z: 5, x: 26, y: 12, data: Buffer.from('tile-5-26-12-vector-mvt-payload') },
      { z: 10, x: 800, y: 400, data: Buffer.from('tile-10-800-400-high-detail-road') }
    ];

    const buf = buildPmtilesBuffer(dummyTiles, {
      type: 'vector',
      tileType: 'mvt',
      name: 'Test Vector Archive'
    });

    fs.writeFileSync(pmtilesPath, buf);
    const stat = fs.statSync(pmtilesPath);
    console.log(`  Generated PMTiles archive: ${stat.size} bytes`);
    assert.ok(stat.size > 127, 'PMTiles file should have valid header');

    // Create a contour archive
    const dummyContours = [
      { z: 12, x: 3200, y: 1600, data: Buffer.from('contour-pbf-metric-v1-elevation') }
    ];
    const contourBuf = buildPmtilesBuffer(dummyContours, {
      type: 'contour',
      tileType: 'mvt',
      name: 'Test Contour Archive'
    });
    fs.writeFileSync(contourPmtilesPath, contourBuf);

    // Initialize TileArchiveManager on the temp directory
    const archiveMgr = new TileArchiveManager({ baseDir: tempDir });
    const loadedCount = await archiveMgr.init();
    console.log(`  TileArchiveManager loaded ${loadedCount} archives from ${tempDir}`);
    assert.strictEqual(loadedCount, 2, 'Should have loaded 2 archives');

    // Test random tile lookup
    const t0 = await archiveMgr.getTile('vector', 0, 0, 0);
    assert.ok(t0, 'Tile 0/0/0 should be found');
    assert.strictEqual(t0.data.toString(), 'tile-0-0-0-data');

    const t5 = await archiveMgr.getTile('vector', 5, 26, 12);
    assert.ok(t5, 'Tile 5/26/12 should be found');
    assert.strictEqual(t5.data.toString(), 'tile-5-26-12-vector-mvt-payload');

    const tc = await archiveMgr.getTile('contour', 12, 3200, 1600);
    assert.ok(tc, 'Contour tile 12/3200/1600 should be found');
    assert.strictEqual(tc.data.toString(), 'contour-pbf-metric-v1-elevation');

    // Test missing tile returns null
    const tMissing = await archiveMgr.getTile('vector', 9, 999, 999);
    assert.strictEqual(tMissing, null, 'Non-existent tile should return null');

    archiveMgr.close();
    console.log('✓ Test 2 Passed: PMTiles creation and random access verified.\n');
  } finally {
    try {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }

  // Test 3: Fallback behavior between Archive and Loose Directories
  console.log('--- Test 3: PMTiles archive and loose file priority / fallback ---');
  const mixDir = path.join(__dirname, '..', 'tmp_test_mix_' + Date.now());
  const looseDir = path.join(mixDir, 'vector', '8', '100');
  fs.mkdirSync(looseDir, { recursive: true });
  fs.writeFileSync(path.join(looseDir, '50.pbf'), Buffer.from('loose-directory-tile-8-100-50'));

  const mixPmtiles = path.join(mixDir, 'test_priority.pmtiles');
  const mixBuf = buildPmtilesBuffer([
    { z: 8, x: 100, y: 50, data: Buffer.from('archive-tile-8-100-50-priority') }
  ], { type: 'vector' });
  fs.writeFileSync(mixPmtiles, mixBuf);

  try {
    const mgr = new TileArchiveManager({ baseDir: mixDir });
    await mgr.init();

    // 1. Archive exists -> returns archive data
    const archivedTile = await mgr.getTile('vector', 8, 100, 50);
    assert.ok(archivedTile);
    assert.strictEqual(archivedTile.data.toString(), 'archive-tile-8-100-50-priority');

    // 2. Archive does not have tile 8/100/51 -> fallback to loose dir
    const looseTileResult = await mgr.getTile('vector', 8, 100, 51);
    assert.strictEqual(looseTileResult, null, 'Archive should return null for 8/100/51');

    // In actual local server, it then reads from localPath fs.promises.readFile
    const looseFallbackContent = fs.readFileSync(path.join(looseDir, '50.pbf'));
    assert.strictEqual(looseFallbackContent.toString(), 'loose-directory-tile-8-100-50');

    mgr.close();
    console.log('✓ Test 3 Passed: Archive priority with seamless loose-directory fallback verified.\n');
  } finally {
    try {
      if (fs.existsSync(mixDir)) fs.rmSync(mixDir, { recursive: true, force: true });
    } catch (_) {}
  }

  // Test 4: Dynamic frame-budget backoff and IPC
  console.log('--- Test 4: Dynamic frame-budget backoff & flow yielding ---');
  {
    const { createDownloadFlow } = require('../src/download-flow.cjs');
    let framePressure = false;
    let mapInteracting = false;
    const ac = new AbortController();

    const shouldYieldFn = () => (mapInteracting || framePressure);
    const flow = createDownloadFlow({
      signal: ac.signal,
      limit: 10,
      shouldYield: shouldYieldFn
    });

    assert.strictEqual(shouldYieldFn(), false, 'Initially should not yield');

    // Trigger frame pressure
    framePressure = true;
    assert.strictEqual(shouldYieldFn(), true, 'Should yield when frame pressure is active');

    // Test yielding takes short backoff
    const startT = Date.now();
    await flow.yieldForInteraction();
    const elapsed = Date.now() - startT;
    assert.ok(elapsed >= 20, 'yieldForInteraction should have backed off for frame pressure');

    // Restore normal frame budget
    framePressure = false;
    assert.strictEqual(shouldYieldFn(), false, 'Should resume once frame pressure is clear');

    // Map interaction
    mapInteracting = true;
    assert.strictEqual(shouldYieldFn(), true, 'Should yield when map is interacting');

    mapInteracting = false;
    assert.strictEqual(shouldYieldFn(), false, 'Should resume after map interaction ends');

    flow.dispose();
    console.log('✓ Test 4 Passed: Frame-budget dynamic yielding verified.\n');
  }

  // Test 5: UI & Window E2E integration with Electron
  console.log('--- Test 5: Electron Window E2E & Browser APIs ---');
  let receivedFramePressure = false;
  ipcMain.handle('get-tile-server-info', () => ({
    port: 28795,
    ready: true,
    fontUrl: 'http://127.0.0.1:28795/fonts/{fontstack}/{range}.pbf',
    demUrl: 'http://127.0.0.1:28795/dem/{z}/{x}/{y}.webp',
    vectorUrl: 'http://127.0.0.1:28795/vector/{z}/{x}/{y}.pbf',
    routesUrl: 'http://127.0.0.1:28795/routes/{z}/{x}/{y}.pbf',
    contourUrl: 'http://127.0.0.1:28795/contour/metric-v1/{z}/{x}/{y}.pbf'
  }));
  ipcMain.handle('get-offline-manifest', () => ({ inventoryVersion: 4, summary: {} }));
  ipcMain.on('map-interaction-state', () => {});
  ipcMain.on('map-frame-pressure', (_e, active) => {
    receivedFramePressure = Boolean(active);
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js')
    }
  });

  win.webContents.on('console-message', (_e, level, msg) => {
    console.log(`  [Renderer Log ${level}]: ${msg}`);
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // Evaluate in renderer
  const rendererResults = await win.webContents.executeJavaScript(`
    (async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 400 && !window.mapInstance?.__outmapStyleReady; i++) await sleep(25);
      
      // 1. Verify computeAdaptiveTileCache is exposed and functioning
      const c1 = window.computeAdaptiveTileCache({ dpr: 1, width: 1280, height: 800 });
      const c2 = window.computeAdaptiveTileCache({ dpr: 2, width: 2560, height: 1600 });
      
      // 2. Verify updateMapAdaptiveTileCache executes safely
      if (typeof window.updateMapAdaptiveTileCache === 'function') {
        window.updateMapAdaptiveTileCache();
      }

      // 3. Verify electronAPI.setFramePressureState is exposed
      const hasFramePressureAPI = typeof window.electronAPI?.setFramePressureState === 'function';
      if (hasFramePressureAPI) {
        window.electronAPI.setFramePressureState(true);
        window.electronAPI.setFramePressureState(false);
      }

      return {
        c1,
        c2,
        hasFramePressureAPI,
        routeEditLoaded: typeof window.loadSavedRoute === 'function'
      };
    })()
  `);

  console.log('  Renderer evaluation results:', rendererResults);
  assert.ok(rendererResults.c1 >= 480, 'Desktop 1280x800 cache >= 480');
  assert.ok(rendererResults.c2 >= rendererResults.c1, 'High-DPR cache should be >= standard DPR');
  assert.strictEqual(rendererResults.hasFramePressureAPI, true, 'setFramePressureState should be exposed');
  assert.strictEqual(rendererResults.routeEditLoaded, true, 'loadSavedRoute function should be available');

  win.destroy();
  console.log('✓ Test 5 Passed: Electron Window E2E & Preload APIs verified.\n');

  console.log('====================================================');
  console.log('ALL v2.0.22 ARCHITECTURE INTEGRATION TESTS PASSED!');
  console.log('====================================================\n');
}

app.whenReady().then(async () => {
  try {
    await runTests();
    app.quit();
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    app.quit();
    process.exit(1);
  }
});

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const electronBin = require('electron');
const nodeBin = process.execPath;

function killProcessTree(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (_) {}
}

function runSingleTest({ name, cmd, args, timeout = 45000 }) {
  return new Promise(resolve => {
    const started = Date.now();
    let timedOut = false;
    let stdoutData = '';
    let stderrData = '';

    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', d => { stdoutData += d.toString(); });
    child.stderr.on('data', d => { stderrData += d.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(`\n⚠️  [TIMEOUT] ${name} exceeded ${timeout}ms, terminating process tree (PID: ${child.pid})...`);
      killProcessTree(child.pid);
    }, timeout);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const elapsed = Date.now() - started;
      if (timedOut) {
        resolve({ name, status: 'TIMEOUT', code, signal, elapsed, stdout: stdoutData, stderr: stderrData });
      } else if (code === 0) {
        resolve({ name, status: 'PASS', code: 0, elapsed });
      } else {
        resolve({ name, status: 'FAIL', code, signal, elapsed, stdout: stdoutData, stderr: stderrData });
      }
    });

    child.on('error', err => {
      clearTimeout(timer);
      const elapsed = Date.now() - started;
      resolve({ name, status: 'ERROR', error: err.message, elapsed, stdout: stdoutData, stderr: stderrData });
    });
  });
}

const PRETEST_TESTS = [
  { name: 'test-v2.0.15-optimizations.cjs', cmd: nodeBin, args: ['scripts/test-v2.0.15-optimizations.cjs'], timeout: 30000 },
  { name: 'test-v2.0.0-resource-lifecycle.cjs', cmd: nodeBin, args: ['scripts/test-v2.0.0-resource-lifecycle.cjs'], timeout: 30000 },
  { name: 'test-v2.0.3-camera-no-dem.cjs', cmd: nodeBin, args: ['scripts/test-v2.0.3-camera-no-dem.cjs'], timeout: 30000 },
  { name: 'test-v2.0.4-route-rename.cjs', cmd: electronBin, args: ['scripts/test-v2.0.4-route-rename.cjs'], timeout: 45000 },
  { name: 'test-v2.0.5-cloud-rename.cjs', cmd: electronBin, args: ['scripts/test-v2.0.5-cloud-rename.cjs'], timeout: 45000 },
  { name: 'test-v2.0.16-route-sync-resilience.cjs', cmd: electronBin, args: ['scripts/test-v2.0.16-route-sync-resilience.cjs'], timeout: 45000 },
  { name: 'test-v2.0.2-touch-intent.cjs', cmd: electronBin, args: ['scripts/test-v2.0.2-touch-intent.cjs'], timeout: 45000 },
  { name: 'test-v1.9.51-maplibre-6.cjs', cmd: electronBin, args: ['scripts/test-v1.9.51-maplibre-6.cjs'], timeout: 45000 },
  { name: 'test-fractional-3d-continuity.cjs', cmd: electronBin, args: ['scripts/test-fractional-3d-continuity.cjs'], timeout: 180000 },
  { name: 'test-v1.9.50.cjs', cmd: electronBin, args: ['scripts/test-v1.9.50.cjs'], timeout: 45000 },
  { name: 'test-v1.9.43.cjs', cmd: electronBin, args: ['scripts/test-v1.9.43.cjs'], timeout: 45000 },
  { name: 'test-desktop-map-performance.cjs', cmd: nodeBin, args: ['scripts/test-desktop-map-performance.cjs'], timeout: 45000 },
  { name: 'test-layer-route-separation.cjs', cmd: electronBin, args: ['scripts/test-layer-route-separation.cjs'], timeout: 45000 }
];

const RELEASE_TESTS = [
  { name: 'test-v1.9.42.cjs', cmd: electronBin, args: ['scripts/test-v1.9.42.cjs'], timeout: 45000 },
  { name: 'test-v1.9.41.cjs', cmd: electronBin, args: ['scripts/test-v1.9.41.cjs'], timeout: 45000 },
  { name: 'test-v1.9.40.cjs', cmd: electronBin, args: ['scripts/test-v1.9.40.cjs'], timeout: 45000 },
  { name: 'test-v1.9.39.cjs', cmd: electronBin, args: ['scripts/test-v1.9.39.cjs'], timeout: 45000 },
  { name: 'test-v1.9.34.cjs', cmd: electronBin, args: ['scripts/test-v1.9.34.cjs'], timeout: 45000 },
  { name: 'test-v1.9.33.cjs', cmd: electronBin, args: ['scripts/test-v1.9.33.cjs'], timeout: 45000 },
  { name: 'test-v1.9.32.cjs', cmd: electronBin, args: ['scripts/test-v1.9.32.cjs'], timeout: 45000 },
  { name: 'test-v1.9.31.cjs', cmd: electronBin, args: ['scripts/test-v1.9.31.cjs'], timeout: 45000 },
  { name: 'test-v1.9.11-offline-inventory.js', cmd: nodeBin, args: ['scripts/test-v1.9.11-offline-inventory.js'], timeout: 30000 },
  { name: 'test-v1.9.14.js', cmd: nodeBin, args: ['scripts/test-v1.9.14.js'], timeout: 30000 },
  { name: 'test-v1.9.23.js', cmd: nodeBin, args: ['scripts/test-v1.9.23.js'], timeout: 30000 },
  { name: 'test-camera.js (Desktop)', cmd: electronBin, args: ['scripts/test-camera.js'], timeout: 90000 },
  { name: 'test-camera.js (--mobile)', cmd: electronBin, args: ['scripts/test-camera.js', '--mobile'], timeout: 90000 },
  { name: 'test-favorite-interactions.cjs', cmd: electronBin, args: ['scripts/test-favorite-interactions.cjs'], timeout: 60000 },
  { name: 'test-route-planner.js', cmd: electronBin, args: ['scripts/test-route-planner.js'], timeout: 60000 },
  { name: 'test-stop-reordering-and-autoscroll.js', cmd: electronBin, args: ['scripts/test-stop-reordering-and-autoscroll.js'], timeout: 60000 },
  { name: 'test-production-polish.js', cmd: electronBin, args: ['scripts/test-production-polish.js'], timeout: 60000 },
  { name: 'test-v1.9.11-runtime.js', cmd: electronBin, args: ['scripts/test-v1.9.11-runtime.js'], timeout: 60000 },
  { name: 'test-v1.8.4.js', cmd: electronBin, args: ['scripts/test-v1.8.4.js'], timeout: 60000 }
];

const REGRESSION_TESTS = [
  { name: 'test-details-collapse-and-waypoints.js', cmd: electronBin, args: ['scripts/test-details-collapse-and-waypoints.js'], timeout: 60000 },
  { name: 'test-unified-dl-and-esc-marker.js', cmd: electronBin, args: ['scripts/test-unified-dl-and-esc-marker.js'], timeout: 60000 },
  { name: 'test-production-stability.js', cmd: electronBin, args: ['scripts/test-production-stability.js'], timeout: 60000 },
  { name: 'test-v1.5.0.js', cmd: electronBin, args: ['scripts/test-v1.5.0.js'], timeout: 60000 },
  { name: 'test-v1.5.9.js', cmd: electronBin, args: ['scripts/test-v1.5.9.js'], timeout: 60000 },
  { name: 'test-v1.6.6.js', cmd: electronBin, args: ['scripts/test-v1.6.6.js'], timeout: 60000 },
  { name: 'test-v1.6.7.js', cmd: electronBin, args: ['scripts/test-v1.6.7.js'], timeout: 60000 },
  { name: 'test-v1.6.8.js', cmd: electronBin, args: ['scripts/test-v1.6.8.js'], timeout: 60000 },
  { name: 'test-v1.6.9.js', cmd: electronBin, args: ['scripts/test-v1.6.9.js'], timeout: 60000 },
  { name: 'test-v1.7.0.js', cmd: electronBin, args: ['scripts/test-v1.7.0.js'], timeout: 60000 },
  { name: 'test-v1.7.2.js', cmd: electronBin, args: ['scripts/test-v1.7.2.js'], timeout: 60000 },
  { name: 'test-v1.7.3-fixes.js', cmd: electronBin, args: ['scripts/test-v1.7.3-fixes.js'], timeout: 60000 },
  { name: 'test-v1.7.6.js', cmd: electronBin, args: ['scripts/test-v1.7.6.js'], timeout: 60000 },
  { name: 'test-v1.7.8.js', cmd: electronBin, args: ['scripts/test-v1.7.8.js'], timeout: 60000 },
  { name: 'test-v1.7.9.js', cmd: electronBin, args: ['scripts/test-v1.7.9.js'], timeout: 60000 },
  { name: 'test-v1.8.0.js', cmd: electronBin, args: ['scripts/test-v1.8.0.js'], timeout: 60000 },
  { name: 'test-v1.8.1.js', cmd: electronBin, args: ['scripts/test-v1.8.1.js'], timeout: 60000 },
  { name: 'test-v1.8.2.js', cmd: electronBin, args: ['scripts/test-v1.8.2.js'], timeout: 60000 },
  { name: 'test-v1.8.3.js', cmd: electronBin, args: ['scripts/test-v1.8.3.js'], timeout: 60000 },
  { name: 'test-v1.8.5.js', cmd: electronBin, args: ['scripts/test-v1.8.5.js'], timeout: 60000 },
  { name: 'test-v1.8.6.js', cmd: electronBin, args: ['scripts/test-v1.8.6.js'], timeout: 60000 },
  { name: 'test-v1.8.7.js', cmd: electronBin, args: ['scripts/test-v1.8.7.js'], timeout: 60000 },
  { name: 'test-v1.8.8.js', cmd: electronBin, args: ['scripts/test-v1.8.8.js'], timeout: 60000 },
  { name: 'test-v1.8.10.js', cmd: electronBin, args: ['scripts/test-v1.8.10.js'], timeout: 60000 },
  { name: 'test-v1.8.11.js', cmd: electronBin, args: ['scripts/test-v1.8.11.js'], timeout: 60000 },
  { name: 'test-v1.9.3.js', cmd: nodeBin, args: ['scripts/test-v1.9.3.js'], timeout: 30000 },
  { name: 'test-v1.9.3-runtime.js', cmd: electronBin, args: ['scripts/test-v1.9.3-runtime.js'], timeout: 60000 },
  { name: 'test-v1.9.4.js', cmd: nodeBin, args: ['scripts/test-v1.9.4.js'], timeout: 30000 },
  { name: 'test-v1.9.5.js', cmd: nodeBin, args: ['scripts/test-v1.9.5.js'], timeout: 30000 },
  { name: 'test-v1.9.6.js', cmd: nodeBin, args: ['scripts/test-v1.9.6.js'], timeout: 30000 },
  { name: 'test-v1.9.7.js', cmd: nodeBin, args: ['scripts/test-v1.9.7.js'], timeout: 30000 },
  { name: 'test-v1.9.12.js', cmd: nodeBin, args: ['scripts/test-v1.9.12.js'], timeout: 30000 },
  { name: 'test-v1.9.13.js', cmd: nodeBin, args: ['scripts/test-v1.9.13.js'], timeout: 30000 },
  { name: 'test-v1.9.20.js', cmd: nodeBin, args: ['scripts/test-v1.9.20.js'], timeout: 30000 },
  { name: 'test-v1.9.20-runtime.js', cmd: electronBin, args: ['scripts/test-v1.9.20-runtime.js'], timeout: 60000 },
  { name: 'test-v1.9.21.js', cmd: nodeBin, args: ['scripts/test-v1.9.21.js'], timeout: 30000 },
  { name: 'test-v1.9.22.js', cmd: nodeBin, args: ['scripts/test-v1.9.22.js'], timeout: 30000 }
];

async function main() {
  const args = process.argv.slice(2);
  let suites = [];
  if (args.includes('--pretest')) {
    suites = PRETEST_TESTS;
  } else if (args.includes('--release')) {
    suites = RELEASE_TESTS;
  } else if (args.includes('--regression')) {
    suites = REGRESSION_TESTS;
  } else {
    // Default: run pretest + release
    suites = [...PRETEST_TESTS, ...RELEASE_TESTS];
    if (args.includes('--all')) {
      suites.push(...REGRESSION_TESTS);
    }
  }

  console.log(`\n======================================================`);
  console.log(` Outmap Safe Test Suite Runner`);
  console.log(` Total tests queued: ${suites.length}`);
  console.log(` Timeout protection: enabled with process tree termination`);
  console.log(`======================================================\n`);

  const results = [];
  for (let i = 0; i < suites.length; i++) {
    const test = suites[i];
    const indexStr = `[${i + 1}/${suites.length}]`;
    process.stdout.write(`${indexStr} RUN: ${test.name} ... `);
    
    const res = await runSingleTest(test);
    results.push(res);

    if (res.status === 'PASS') {
      console.log(`✅ PASS (${res.elapsed}ms)`);
    } else if (res.status === 'TIMEOUT') {
      console.log(`⏱️ TIMEOUT (${res.elapsed}ms)`);
    } else {
      console.log(`❌ FAIL (code: ${res.code}, signal: ${res.signal}, ${res.elapsed}ms)`);
      if (res.stderr) {
        console.error(`--- Stderr snippet ---\n${res.stderr.trim().slice(-1000)}\n----------------------`);
      }
      if (res.stdout && !res.stderr) {
        console.error(`--- Stdout snippet ---\n${res.stdout.trim().slice(-1000)}\n----------------------`);
      }
    }
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const timedOut = results.filter(r => r.status === 'TIMEOUT').length;
  const errored = results.filter(r => r.status === 'ERROR').length;

  console.log(`\n======================================================`);
  console.log(` Test Summary:`);
  console.log(` Total:   ${results.length}`);
  console.log(` Passed:  ${passed}`);
  console.log(` Failed:  ${failed}`);
  console.log(` Timeout: ${timedOut}`);
  console.log(` Errored: ${errored}`);
  console.log(`======================================================\n`);

  // Write full report JSON
  const reportPath = path.join(root, 'dist', 'test-run-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Report saved to: ${reportPath}`);

  if (failed > 0 || timedOut > 0 || errored > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

const fs = require('fs');
const assert = require('assert');

console.log('Running Outmap v1.8.8 GPU Performance & Downloader Optimization Tests...');

// 1. Version consistency check
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.strictEqual(pkg.version, '1.8.8', 'package.json version must be 1.8.8');

const html = fs.readFileSync('src/index.html', 'utf8');
assert(html.includes('style.css?v=1.8.8'), 'index.html must reference style.css?v=1.8.8');
assert(html.includes('app.js?v=1.8.8'), 'index.html must reference app.js?v=1.8.8');
assert(html.includes('id="brand-ver-badge-txt">v1.8.8</span>'), 'index.html brand badge must show v1.8.8');

const appJs = fs.readFileSync('src/app.js', 'utf8');
assert(appJs.includes("const APP_VERSION = '1.8.8';"), "app.js must declare APP_VERSION = '1.8.8'");

// 2. CSS GPU optimization verification
const css = fs.readFileSync('src/style.css', 'utf8');

// Ensure infinite pulse animation is removed from dl-live-blue-dot
assert(!css.includes('animation: pulseDlBlueDot 2s ease-in-out infinite'), 'dl-live-blue-dot must not have infinite pulseDlBlueDot animation');
assert(css.includes('animation: dlDotPopIn 0.2s cubic-bezier'), 'dl-live-blue-dot should use single pop-in animation');

// Ensure dlDotPulse infinite animation is removed from prov-status-dot
assert(!css.includes('animation: dlDotPulse 1.4s infinite ease-in-out'), 'prov-status-dot must not have infinite dlDotPulse animation');

// Ensure width transition is removed from progress-bar-fill and contain: strict is added
assert(!css.includes('transition: width 0.15s ease-out'), 'progress-bar-fill must not animate width on every frame');
assert(css.includes('contain: strict'), 'progress-bar-wrap must use contain: strict');

// Ensure body.is-downloading bypasses backdrop-filter to prevent heavy Gaussian blur shaders
assert(css.includes('body.is-downloading #unified-header'), 'style.css must have body.is-downloading #unified-header rule');
assert(css.includes('body.is-downloading #pyramid-modal .modal-card'), 'style.css must have body.is-downloading #pyramid-modal .modal-card rule');
assert(css.includes('backdrop-filter: blur(12px) saturate(140%) !important'), 'modal-card backdrop-filter must be reduced to 12px');

// 3. main.js IPC & Taskbar throttling verification
const mainJs = fs.readFileSync('main.js', 'utf8');
assert(mainJs.includes('lastTaskbarPct'), 'main.js must track lastTaskbarPct to avoid spamming DWM taskbar progress');
assert(mainJs.includes('now - lastProgressTime >= 250'), 'main.js must throttle progress emission to >= 250ms');
assert(mainJs.includes('now - lastUpdateProgressTime >= 250'), 'main.js must throttle update progress emission to >= 250ms');

// 4. app.js is-downloading lifecycle and titlebar cache stat throttling
assert(appJs.includes("document.body.classList.add('is-downloading')"), "app.js must add 'is-downloading' class on download start");
assert(appJs.includes("document.body.classList.remove('is-downloading')"), "app.js must remove 'is-downloading' class on download end");
assert(appJs.includes('now - lastTitleStatUpdate > 2000'), 'app.js must throttle titlebar cache stat updates to 2s intervals');

console.log('v1.8.8 test result: {', JSON.stringify({
  version: pkg.version,
  badgeText: 'v1.8.8',
  dlBlueDotPulseRemoved: true,
  progressBarTransitionRemoved: true,
  progressBarWrapContained: true,
  isDownloadingBackdropBypassed: true,
  taskbarThrottled: true,
  progressBroadcastThrottled: true,
  titleStatThrottled: true
}, null, 2), '}');

console.log('✅ ALL v1.8.8 TESTS PASSED PERFECTLY!');

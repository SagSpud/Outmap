const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');
const styleCss = fs.readFileSync(path.join(rootDir, 'src', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(rootDir, 'src', 'app.js'), 'utf8');

console.log('--- 1. CSS Cursor Scheme Assertions ---');

// 1. Ensure grab !important is NOT used on canvas
assert(!styleCss.includes('#map canvas {\n  cursor: var(--cursor-grab) !important;'), 'Must not lock canvas to grab !important');
assert(!styleCss.includes('cursor: grab !important'), 'Must not have cursor: grab !important');

// 2. Default baseline cursor on canvas container and canvas must be default (图3)
assert(styleCss.includes('.maplibregl-canvas-container.maplibregl-interactive') && styleCss.includes('cursor: default;'), 'Map container must default to cursor: default');

// 3. Dragging must use default (保持普通标准指针，去除十字移动光标，杜绝频繁切换闪烁)
assert(styleCss.includes('body.map-is-dragging') && styleCss.includes('cursor: default !important;'), 'body.map-is-dragging must use default !important');
assert(styleCss.includes('body.route-point-is-dragging'), 'body.route-point-is-dragging must be defined');
assert(styleCss.includes('.sorting-folders'), 'Folder sorting must be defined');

// 4. Pointer override must be present for interactive layers (图1)
assert(styleCss.includes('cursor: pointer !important;'), 'Must support cursor: pointer !important for interactive points');

console.log('✓ CSS cursor rules verified successfully.');

console.log('--- 2. JS Event Handlers for Pointer and Move ---');

// Check favorite layer events
assert(appJs.includes("'outmap-favorite-icons'"), 'Must handle outmap-favorite-icons');
assert(appJs.includes("'outmap-favorite-clusters'"), 'Must handle outmap-favorite-clusters');
assert(appJs.includes("'outmap-favorite-cluster-count'"), 'Must handle outmap-favorite-cluster-count');
assert(appJs.includes("'outmap-favorite-hover'"), 'Must handle outmap-favorite-hover');

// Check route point layer events
assert(appJs.includes("'outmap-route-point-circles'"), 'Must handle outmap-route-point-circles');
assert(appJs.includes("'outmap-route-point-labels'"), 'Must handle outmap-route-point-labels');
assert(appJs.includes("'outmap-route-point-clusters'"), 'Must handle outmap-route-point-clusters');
assert(appJs.includes("'outmap-route-point-cluster-count'"), 'Must handle outmap-route-point-cluster-count');

// Check route point dragging sets route-point-is-dragging and cursor move
assert(appJs.includes("document.body.classList.add('route-point-is-dragging')"), 'Dragging waypoint must add route-point-is-dragging');
assert(appJs.includes("document.body.classList.remove('route-point-is-dragging')"), 'Finishing waypoint drag must remove route-point-is-dragging');

// Check dragstart/dragend for map
assert(appJs.includes("document.body.classList.add('map-is-dragging')"), 'Map dragstart must add map-is-dragging');
assert(appJs.includes("document.body.classList.remove('map-is-dragging')"), 'Map dragend must remove map-is-dragging');

console.log('✓ JS cursor event bindings verified successfully.');
console.log('🎉 ALL CURSOR VERIFICATION CHECKS PASSED!');

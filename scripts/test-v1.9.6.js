const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

const versionParts = pkg.version.split('.').map(Number);
assert(versionParts.length === 3 && versionParts.every(Number.isFinite), 'package version must be semver');
assert(versionParts[0] > 1 || (versionParts[0] === 1 && versionParts[1] > 9)
  || (versionParts[0] === 1 && versionParts[1] === 9 && versionParts[2] >= 6), 'package version must include the v1.9.6 behavior');
assert.strictEqual(lock.version, pkg.version);
assert.strictEqual(lock.packages[''].version, pkg.version);
assert(app.includes(`const APP_VERSION = '${pkg.version}';`), 'app.js must declare current APP_VERSION');
assert(html.includes(`style.css?v=${pkg.version}`), 'index.html must reference current style.css');
assert(html.includes(`app.js?v=${pkg.version}`), 'index.html must reference current app.js');
assert(app.includes("const DELETED_ROUTES_STORAGE_KEY = 'outmap_deleted_routes'"), 'route tombstone storage key is required');
assert(app.includes('function addDeletedRouteTombstone(route)'), 'route deletion must persist a tombstone');
assert(app.includes('function isRouteDeleted(route, deletedList = [])'), 'route merge must filter tombstoned routes');
assert(app.includes('const mergedDeletedRoutes = mergeRouteTombstones(localDeletedRoutes, cloudDeletedRoutes)'), 'sync must merge route tombstones from both sides');
assert(app.includes('deletedRoutes: mergedDeletedRoutes'), 'sync payload must carry route tombstones');
assert(app.includes('addDeletedRouteTombstone(route);'), 'route delete action must create a tombstone');
assert(app.includes('mergeRoutes(localRoutes, cloudData?.routes || [], mergedDeletedRoutes)'), 'route merge must apply tombstones');

console.log('v1.9.6 route deletion tombstone checks passed');

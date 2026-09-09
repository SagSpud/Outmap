# Outmap 1.7.6 production review

## Scope

Reviewed the Antigravity change chain from the last production baseline `7510c15` (1.6.5) through `c1914f5` (1.7.5), including the matching conversation database and brain artifacts. The review covers camera behavior, route planning, favorites, cloud sync, offline inventory/downloads, rendering performance, mobile layout, animation and release metadata.

This update is a selective repair, not a wholesale rollback. Useful features introduced in 1.6.6–1.7.5 remain in place. The `offline-tiles` directory is excluded from packaging and was not deleted, moved or rebuilt.

## Main regressions found

- Camera behavior was repeatedly changed across releases and its tests were weakened by removing the original desktop/mobile projection suites. A moving mobile panel could change the calculated endpoint during a flight, and route search could issue two competing flights for one selection.
- A first favorite flight could start before its DEM tile was available, so the final terrain elevation changed the projection and appeared as a pull-back or a different landing position.
- Startup waited for a nationwide offline inventory scan and could also perform the cloud pull twice. A full sync rebuilt favorites twice, while realtime uploads could overlap.
- Offline completion mixed a stale browser snapshot with a disk scan, accepted `maxZ >= 14` as complete, and originally checked only vector tiles. Aborted or failed downloads could be promoted to green.
- The offline UI still had follow-on defects after the initial repair: partial DEM-only data was not recognized, missing tiles inside a high zoom level were ignored by estimates, and the download handler's `finally` block referenced counters declared inside `try`.
- Nested backdrop filters sampled the WebGL map multiple times per panel. A late 24px rule overrode the intended mobile reduction. Broad `transition: all` rules caused unnecessary style/compositor work.
- Map symbol fading had been reduced to 30ms, producing visible label cuts. Switching 2D/3D rebuilt terrain resources unnecessarily.
- Custom SVG cursors were visibly aliased and did not match the operating system.

## Production implementation

### Camera and favorites

- All location movements continue through one adapter using MapLibre's native `flyTo`, `easeTo`, `transformCameraUpdate` and transform projection.
- The lower-center visual anchor is snapshotted once at the start of a flight. It is not recomputed while panels animate.
- Nearby movement uses a native monotonic ease; distant movement uses the native flight arc. Both are cancellable by a replacement request or direct user input.
- Favorite markers and list entries pass their stored elevation, adjusted by current terrain exaggeration, so the first long-distance 3D flight does not wait for DEM arrival.
- On phones, a favorite drawer closes smoothly before the one final viewport calculation and flight.
- Start/end search no longer launches a second duplicate camera request. Route setters own their single flight; only waypoint editing performs its extra focus movement.

### Routing

- Driving, cycling and walking remain profile-isolated. Cycling/walking cannot silently fall back to a car router.
- Long routes are split into overlapping 2–8 point legs, with bounded concurrency, deterministic merge order and full waypoint preservation. The 62-point regression uses nine continuous legs and peaks at two concurrent requests.
- Real replacement requests cancel obsolete work; ordinary typing debounce does not create an abort storm.
- The in-memory leg cache is bounded by both entry count and geometry vertices. Desktop persistent cache entries are schema/profile validated.
- Guidance fallback is labelled `导引`, rather than pretending a straight fallback is road matched.
- The navigation route uses an Apple-like blue casing/core and remains above road geometry but below road labels and shields. Imported tracks use a separate indigo palette.

### Offline downloads and counts

- `inventoryVersion: 3` is generated from an isolated worker disk scan and is authoritative. Browser storage is only a startup snapshot.
- Province green state requires complete DEM and vector coverage at every L10–L14 level. Partial coverage remains blue.
- Layer dots follow the layers currently selected by the user; partial status includes DEM-only, vector-only and mixed downloads.
- Estimates use `expected - present` for every requested layer and level, so holes inside an already-present high level remain visible.
- Aborted or failed tasks keep valid files and show `继续补齐`; they are never marked complete.
- Completion counters now live for the full IPC handler lifecycle, including `finally`, preventing a cleanup exception after successful, failed or cancelled downloads.
- Map initialization does not block on the nationwide scan. The worker updates the UI when its authoritative manifest is ready.

### Performance and interaction

- One acrylic surface is retained per main card. Nested controls use translucent fills without their own backdrop sampling.
- During map movement, expensive blur is temporarily replaced by a high-opacity surface and restored after movement. Mobile/coarse-pointer blur is capped at 11px.
- Broad transitions were narrowed to visual properties; open/close, spring switches, press feedback and waypoint motion remain animated.
- MapLibre symbol fading is 180ms, avoiding hard label cuts while retaining reasonable compositor cost.
- 2D mode keeps terrain resources mounted and hides hillshade, avoiding a DEM mesh/shader rebuild on the first frame of the next 3D transition.
- Native `grab`, `grabbing` and `crosshair` cursors replace embedded bitmap/SVG cursor art and inherit Windows/macOS DPI rendering.
- Startup cloud sync performs one pull after the map and favorites systems exist. Realtime upload is serialized with one queued follow-up.

## Verification evidence

`npm test` passes with exit code 0. The suite covers:

- desktop and mobile camera projection in 2D, 50° and 70° pitch;
- nearby, nationwide, rapid replacement, zero-duration and late-DEM flights;
- moving/hidden mobile drawers and lower-center endpoint stability;
- first favorite flight count and stored elevation input;
- start/end/via autocomplete staying inside the mobile viewport;
- driving/cycling/walking isolation, long distance and 62-waypoint routing;
- request cancellation/coalescing, route layer ordering and fallback labelling;
- continuous map picking, full-stop reordering, auto-scroll and detail/chart state;
- fast close/reopen race handling for panels and alerts;
- authoritative offline inventory, blue partial L14 and false-green rejection;
- native cursor styles, CSP-compatible startup and single cloud pull.

Syntax checks for `main.js`, `src/app.js` and `src/location-camera.js`, plus `git diff --check`, also pass.

## Deliberate non-goals

- No nationwide first-use offline routing package was added. Successful online routes continue to be cached persistently and can be reused offline for the same request.
- No offline map data was migrated, rewritten or bundled into the installer.
- Web deployment is not performed here; the source remains ready for the user-managed web update.

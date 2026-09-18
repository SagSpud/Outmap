(function () {
  const CACHE_SCHEMA = 'metric-v1';

  function parseTile(url) {
    const match = /:\/\/(\d+)\/(\d+)\/(\d+)/.exec(String(url || ''));
    return match ? { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) } : null;
  }

  function installPersistentCache(demSource, options = {}) {
    if (!demSource || options.webMode || !Number.isFinite(Number(options.port))) return false;
    const generate = demSource.contourProtocol;
    if (typeof generate !== 'function') return false;
    const base = `http://127.0.0.1:${Number(options.port)}/contour/${CACHE_SCHEMA}`;

    demSource.contourProtocol = async (request, abortController) => {
      const tile = parseTile(request?.url);
      if (!tile) return generate(request, abortController);
      const cacheUrl = `${base}/${tile.z}/${tile.x}/${tile.y}.pbf`;
      try {
        const cached = await fetch(cacheUrl, {
          signal: abortController?.signal,
          cache: 'no-store'
        });
        if (cached.ok) {
          return {
            data: await cached.arrayBuffer(),
            cacheControl: 'public, max-age=31536000, immutable'
          };
        }
      } catch (error) {
        if (abortController?.signal?.aborted) throw error;
      }

      // 点 4 优化：若未命中预生成缓存，且当前处于手势拖动或 3D 飞掠中，
      // 主动让出 60ms 帧预算给 WebGL 渲染与手势交互，避免多 Worker 争抢 CPU 造成掉帧
      if (typeof document !== 'undefined' && (document.body?.classList?.contains('map-is-moving') || window.__outmap_map_moving)) {
        await new Promise(r => setTimeout(r, 60));
        if (abortController?.signal?.aborted) return null;
      }

      const result = await generate(request, abortController);
      const data = result?.data;
      if (data && !abortController?.signal?.aborted) {
        const stored = data instanceof ArrayBuffer
          ? data.slice(0)
          : ArrayBuffer.isView(data)
            ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
            : data;
        fetch(cacheUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/vnd.mapbox-vector-tile' },
          body: stored,
          cache: 'no-store'
        }).catch(() => {});
      }
      return result;
    };
    return true;
  }

  window.OutmapTerrainContours = Object.freeze({ CACHE_SCHEMA, installPersistentCache });
})();

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJsSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

// Ensure syntax of app.js
new Function(appJsSource);

const watchdog = setTimeout(() => {
  console.error('v2.0.55 comprehensive scenarios test timed out after 60s');
  process.exit(1);
}, 60000);

const check = (value, message) => {
  if (!value) throw new Error(message);
};

async function run() {
  console.log('\n======================================================');
  console.log('🚀 [Outmap v2.0.55] 综合场景深度自动化回归测试套件');
  console.log('======================================================\n');

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });

  await win.loadFile(path.join(root, 'src', 'index.html'));

  await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (window.mapInstance?.__outmapStyleReady && window.submitGeoJSONChanges && window.setSavedRoutes && window.setSavedWaypoints) {
        return resolve(true);
      }
      if (performance.now() - started > 15000) return reject(new Error('Map and system initialization timeout'));
      setTimeout(poll, 50);
    };
    poll();
  })`);

  console.log('✅ 地图与核心应用环境就绪\n');

  win.webContents.on('console-message', (event, level, message) => {
    console.log('[Renderer Console]', message);
  });

  // =========================================================================
  // SCENARIO 1: 路线点与收藏点跨层联动去重与免刷新测试
  // =========================================================================
  console.log('--- [Scenario 1] 路线点与收藏点跨层联动去重与免刷新测试 ---');
  const scenario1Result = await win.webContents.executeJavaScript(`(async () => {
    try {
      const map = window.mapInstance;
      const testWps = [
        { id: 'wp_s1_1', name: '地点 1', lng: 104.10000, lat: 30.10000, ele: 500, type: 'view' },
        { id: 'wp_s1_2', name: '地点 2 (重叠测试)', lng: 104.20000, lat: 30.20000, ele: 600, type: 'view' },
        { id: 'wp_s1_3', name: '地点 3', lng: 104.30000, lat: 30.30000, ele: 700, type: 'view' }
      ];
      window.setSavedWaypoints(testWps);

      // 1. 初始状态：无路线点，收藏图层应有 3 个点
      const favSrc = map.getSource('outmap-favorites');
      const initialData = await favSrc.getData();
      const countInitial = initialData?.features?.length || 0;

      // 2. 将路线起点设置在地点 2 的完全相同坐标 [104.20000, 30.20000]
      if (typeof window.setRouteStartPoint === 'function') {
        window.setRouteStartPoint(map, [104.20000, 30.20000], '重合起点', 12.0, { schedule: false });
      } else if (typeof setRouteStartPoint === 'function') {
        setRouteStartPoint(map, [104.20000, 30.20000], '重合起点', 12.0, { schedule: false });
      }
      window.syncRouteMarkersVisualState(map, true);

      const dataWithOverlap = await favSrc.getData();
      const countWithOverlap = dataWithOverlap?.features?.length || 0;
      const overlapWpIsHidden = !(dataWithOverlap?.features || []).some(f => f.id === 'wp_s1_2');

      // 3. 将路线起点移开到无重叠位置 [105.00000, 31.00000]
      if (typeof window.setRouteStartPoint === 'function') {
        window.setRouteStartPoint(map, [105.00000, 31.00000], '无重合起点', 12.0, { schedule: false });
      } else if (typeof setRouteStartPoint === 'function') {
        setRouteStartPoint(map, [105.00000, 31.00000], '无重合起点', 12.0, { schedule: false });
      }
      window.syncRouteMarkersVisualState(map, true);

      const dataRestored = await favSrc.getData();
      const countRestored = dataRestored?.features?.length || 0;
      const overlapWpRestored = (dataRestored?.features || []).some(f => f.id === 'wp_s1_2');

      // 4. 再次移动路线起点到另一个无重叠位置 [105.10000, 31.10000]
      // 监听 favSrc.setData 调用
      let favSetDataCount = 0;
      const origSetData = favSrc.setData;
      favSrc.setData = function(...args) {
        favSetDataCount++;
        return origSetData.apply(this, args);
      };

      if (typeof window.setRouteStartPoint === 'function') {
        window.setRouteStartPoint(map, [105.10000, 31.10000], '另一无重合起点', 12.0, { schedule: false });
      } else if (typeof setRouteStartPoint === 'function') {
        setRouteStartPoint(map, [105.10000, 31.10000], '另一无重合起点', 12.0, { schedule: false });
      }
      window.syncRouteMarkersVisualState(map, false); // 常态调用，不 force
      favSrc.setData = origSetData;

      // 清理路线点
      document.getElementById('btn-clear-route')?.click();

      return {
        countInitial,
        countWithOverlap,
        overlapWpIsHidden,
        countRestored,
        overlapWpRestored,
        favSetDataCount
      };
    } catch (e) {
      return { error: e.stack || e.message };
    }
  })()`);

  if (scenario1Result.error) {
    throw new Error('Scenario 1 failed inside renderer: ' + scenario1Result.error);
  }
  console.log('Scenario 1 result:', scenario1Result);

  check(scenario1Result.countInitial === 3, 'Scenario 1: Initial waypoints count should be 3');
  check(scenario1Result.countWithOverlap === 2, 'Scenario 1: Overlapping waypoint should be hidden (expected 2, got ' + scenario1Result.countWithOverlap + ')');
  check(scenario1Result.overlapWpIsHidden, 'Scenario 1: wp_s1_2 was not hidden when overlapping with route start');
  check(scenario1Result.countRestored === 3, 'Scenario 1: Waypoint was not restored when route moved away');
  check(scenario1Result.overlapWpRestored, 'Scenario 1: wp_s1_2 was not found in restored features');
  check(scenario1Result.favSetDataCount === 0, 'Scenario 1: favorites setData was called when no overlap changed (deduplication failed!)');
  console.log('  ✓ 跨层重合点自动隐藏与恢复验证通过');
  console.log('  ✓ 无重合变化时收藏图层 setData 100% 跳过，零冗余开销\n');

  // =========================================================================
  // SCENARIO 2: 收藏路线几何缓存、重叠度比对与编辑还原全生命周期
  // =========================================================================
  console.log('--- [Scenario 2] 收藏路线几何缓存、重叠度比对与编辑还原全生命周期 ---');
  const scenario2Result = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;

    // 生成三条测试路线
    // 路线 A: 川西经典线 (50点)
    const coordsA = [];
    for (let i = 0; i < 50; i++) {
      coordsA.push([101.5 + i * 0.01, 29.5 + i * 0.01]);
    }
    const routeA = {
      id: 'route_s2_a',
      name: '路线 A · 原始版',
      mode: 'hike',
      pathCoords: coordsA,
      updatedAt: 1000
    };

    // 路线 B: 与路线 A 90% 重叠的并行/回程线
    const coordsB = [];
    for (let i = 0; i < 50; i++) {
      coordsB.push([101.5 + i * 0.01 + 0.0002, 29.5 + i * 0.01 + 0.0002]);
    }
    const routeB = {
      id: 'route_s2_b',
      name: '路线 B · 高重叠线',
      mode: 'hike',
      pathCoords: coordsB,
      updatedAt: 1000
    };

    // 路线 C: 遥远的华北线 (完全不重叠)
    const coordsC = [];
    for (let i = 0; i < 30; i++) {
      coordsC.push([116.0 + i * 0.01, 39.0 + i * 0.01]);
    }
    const routeC = {
      id: 'route_s2_c',
      name: '路线 C · 远隔千里',
      mode: 'drive',
      pathCoords: coordsC,
      updatedAt: 1000
    };

    window.setSavedRoutes([routeA, routeB, routeC]);

    // 1. 验证 geometryCache 缓存生成
    const fc1 = window.savedRoutesFeatureCollection();
    const hasCacheA = window.savedRouteGeometryCache.has('route_s2_a');
    const hasCacheB = window.savedRouteGeometryCache.has('route_s2_b');
    const hasCacheC = window.savedRouteGeometryCache.has('route_s2_c');
    const countFc1 = fc1.features.length;

    // 2. 将当前规划路线设为路线 A 的坐标，验证重叠检测
    currentPlannedRouteCoords = coordsA;
    const fc2 = window.savedRoutesFeatureCollection();
    // 路线 A 与路线 B 均与规划重叠，应被隐藏；只有路线 C 显现
    const visibleIdsWithPlannedA = fc2.features.map(f => f.id);

    // 3. 将当前规划路线设为无关坐标（路线 C）
    currentPlannedRouteCoords = coordsC;
    const fc3 = window.savedRoutesFeatureCollection();
    const visibleIdsWithPlannedC = fc3.features.map(f => f.id);

    // 4. 清除当前规划路线
    currentPlannedRouteCoords = [];

    // 5. 路线编辑与快照还原测试
    window.loadSavedRoute('route_s2_a', map, 'editing');
    const editingStateBefore = window.getRouteInteractionState();

    // 模拟编辑修改起点与途径点
    routeStartName = '被篡改的新起点';
    routeViaPoints.push({ coords: [102, 30], name: '新加点' });

    // 一键还原快照
    window.applySavedRouteSnapshot(routeA, map, 'editing', routeA);
    const restoredStartName = routeStartName;
    const restoredViaCount = routeViaPoints.length;

    // 退出编辑
    window.exitRouteEditMode(false);

    return {
      hasCacheA, hasCacheB, hasCacheC,
      countFc1,
      visibleIdsWithPlannedA,
      visibleIdsWithPlannedC,
      editingStateBefore,
      restoredStartName,
      restoredViaCount
    };
  })()`);

  check(scenario2Result.hasCacheA && scenario2Result.hasCacheB && scenario2Result.hasCacheC, 'Scenario 2: All routes should be cached in savedRouteGeometryCache');
  check(scenario2Result.countFc1 === 3, 'Scenario 2: Initial saved routes count should be 3');
  check(scenario2Result.visibleIdsWithPlannedA.length === 1 && scenario2Result.visibleIdsWithPlannedA[0] === 'route_s2_c',
    'Scenario 2: Overlapping routes A and B were not hidden when planned route matched A (got: ' + JSON.stringify(scenario2Result.visibleIdsWithPlannedA) + ')');
  check(scenario2Result.visibleIdsWithPlannedC.includes('route_s2_a') && scenario2Result.visibleIdsWithPlannedC.includes('route_s2_b'),
    'Scenario 2: Non-overlapping routes A and B should be visible when planned route is C');
  check(scenario2Result.editingStateBefore === 'editing', 'Scenario 2: Route did not enter editing state');
  check(scenario2Result.restoredStartName !== '被篡改的新起点', 'Scenario 2: Route start name was not restored from snapshot');
  check(scenario2Result.restoredViaCount === 0, 'Scenario 2: Route via points were not restored from snapshot');
  console.log('  ✓ 路线几何抽稀与包围盒采样缓存验证通过');
  console.log('  ✓ 空间重叠度精准比对与动态隐藏通过');
  console.log('  ✓ 编辑态篡改与不可变快照 100% 干净回滚通过\n');

  // =========================================================================
  // SCENARIO 3: 收藏列表事件委托、分类切换、即时搜索与 Keyed DOM 复用
  // =========================================================================
  console.log('--- [Scenario 3] 收藏列表事件委托、分类切换、即时搜索与 Keyed DOM 复用 ---');
  const scenario3Result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const favDrawer = document.getElementById('favorites-drawer');
    const favItemsList = document.getElementById('fav-items-list');
    const favSearchInput = document.getElementById('fav-search-input');
    const btnClearSearch = document.getElementById('btn-clear-fav-search');

    // 打开收藏夹
    document.getElementById('btn-fab-fav')?.click();

    // 注入 12 个带有不同分类和关键字的点位
    const testWps = [];
    for (let i = 1; i <= 4; i++) {
      testWps.push({ id: 'wp_hike_' + i, name: '徒步营地 ' + i, folder: 'hike', type: 'camp', lng: 102 + i * 0.1, lat: 30 + i * 0.1, ele: 2000 + i * 100 });
    }
    for (let i = 1; i <= 4; i++) {
      testWps.push({ id: 'wp_photo_' + i, name: '日落观景台 ' + i, folder: 'photo', type: 'view', lng: 103 + i * 0.1, lat: 31 + i * 0.1, ele: 3000 + i * 100 });
    }
    for (let i = 1; i <= 4; i++) {
      testWps.push({ id: 'wp_default_' + i, name: '默认点位 ' + i, folder: 'default', type: 'view', lng: 104 + i * 0.1, lat: 32 + i * 0.1, ele: 1000 + i * 100 });
    }
    window.setSavedWaypoints(testWps);

    // 1. 全部视图下卡片数量
    const allCards = Array.from(favItemsList.querySelectorAll('.fav-item-card'));
    const totalCount = allCards.length;

    // 记录匹配项的 DOM 节点引用 (wp_photo_1 在搜索前、搜索中、搜索后均存在)
    const initialPhotoCardNode = favItemsList.querySelector('.fav-item-card[data-id="wp_photo_1"]');

    // 2. 模拟搜索 "观景台"
    favSearchInput.value = '观景台';
    favSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);

    const searchCards = Array.from(favItemsList.querySelectorAll('.fav-item-card'));
    const searchMatchCount = searchCards.length;
    const allMatchPhoto = searchCards.every(c => c.textContent.includes('观景台'));

    // 验证搜索时匹配项 DOM 节点 100% 复用
    const searchPhotoCardNode = favItemsList.querySelector('.fav-item-card[data-id="wp_photo_1"]');
    const isNodeReused = (initialPhotoCardNode === searchPhotoCardNode);

    // 3. 搜索清空
    btnClearSearch.click();
    await sleep(50);
    const restoredCards = Array.from(favItemsList.querySelectorAll('.fav-item-card'));
    const restoredCount = restoredCards.length;

    // 4. 事件委托测试：在列表容器上点击 more 按钮
    const moreBtn = searchPhotoCardNode.querySelector('.fav-item-more-btn');
    moreBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const contextMenuOpen = Boolean(document.querySelector('.fluent-context-menu, .fav-point-type-menu'));
    // 关闭菜单
    document.querySelectorAll('.fluent-context-menu, .fav-point-type-menu').forEach(m => m.remove());

    return {
      totalCount,
      searchMatchCount,
      allMatchPhoto,
      restoredCount,
      isNodeReused,
      contextMenuOpen
    };
  })()`);

  check(scenario3Result.totalCount === 12, 'Scenario 3: Total cards count should be 12 (got ' + scenario3Result.totalCount + ')');
  check(scenario3Result.searchMatchCount === 4, 'Scenario 3: Search should match 4 photo cards (got ' + scenario3Result.searchMatchCount + ')');
  check(scenario3Result.allMatchPhoto, 'Scenario 3: Not all search cards matched keyword');
  check(scenario3Result.restoredCount === 12, 'Scenario 3: Cards count after clear search should be 12');
  check(scenario3Result.isNodeReused, 'Scenario 3: Keyed DOM node reuse failed: existing card element was recreated!');
  check(scenario3Result.contextMenuOpen, 'Scenario 3: Container event delegation failed to trigger context menu on more button click');
  console.log('  ✓ 收藏夹即时搜索与关键字过滤准确');
  console.log('  ✓ Keyed DOM 增量节点复用验证通过（相同 ID 不重新创建 DOM）');
  console.log('  ✓ 容器级单套事件委托响应准确，菜单触发无异常\n');

  // =========================================================================
  // SCENARIO 4: 高频路线拖拽与海量点位并发压测
  // =========================================================================
  console.log('--- [Scenario 4] 高频路线拖拽与海量点位并发压测 ---');
  const scenario4Result = await win.webContents.executeJavaScript(`(() => {
    const map = window.mapInstance;

    // 1. 模拟 60 次高频微小移动（类似 60fps 连续拖拽）
    const dragStartTime = performance.now();
    for (let i = 0; i < 60; i++) {
      routeStartCoord = [102.0 + i * 0.001, 30.0 + i * 0.001];
      window.syncRouteMarkersVisualState(map, false, true);
    }
    const dragDuration = performance.now() - dragStartTime;

    // 2. 模拟 80 条海量收藏路线
    const massiveRoutes = [];
    for (let i = 0; i < 80; i++) {
      const pts = [];
      for (let j = 0; j < 60; j++) {
        pts.push([100 + i * 0.1 + j * 0.01, 25 + i * 0.1 + j * 0.01]);
      }
      massiveRoutes.push({
        id: 'stress_route_' + i,
        name: '压力测试路线 ' + i,
        mode: 'hike',
        pathCoords: pts,
        updatedAt: 12345
      });
    }
    window.setSavedRoutes(massiveRoutes);

    // 首次计算并缓存
    const t0 = performance.now();
    const fcStress1 = window.savedRoutesFeatureCollection();
    const firstRunTime = performance.now() - t0;

    // 二次计算（命中全部 geometry 缓存）
    const t1 = performance.now();
    const fcStress2 = window.savedRoutesFeatureCollection();
    const cachedRunTime = performance.now() - t1;

    // 恢复干净状态
    window.setSavedRoutes([]);
    window.setSavedWaypoints([]);

    return {
      dragDuration,
      firstRunTime,
      cachedRunTime,
      stressCount: fcStress1.features.length
    };
  })()`);

  check(scenario4Result.dragDuration < 300, 'Scenario 4: High frequency drag updates took too long (' + scenario4Result.dragDuration.toFixed(1) + 'ms)');
  check(scenario4Result.stressCount === 80, 'Scenario 4: Stress routes count mismatch');
  check(scenario4Result.cachedRunTime < 5, 'Scenario 4: Cached feature collection run took too long (' + scenario4Result.cachedRunTime.toFixed(1) + 'ms, expected < 5ms)');
  console.log(`  ✓ 60 次连续高频路线拖动调度耗时: ${scenario4Result.dragDuration.toFixed(1)}ms (平均 ${(scenario4Result.dragDuration / 60).toFixed(2)}ms/次)`);
  console.log(`  ✓ 80 条路线海量计算: 首次全量 ${scenario4Result.firstRunTime.toFixed(1)}ms, 缓存命中二次执行 ${scenario4Result.cachedRunTime.toFixed(2)}ms (提速 ${(scenario4Result.firstRunTime / Math.max(0.1, scenario4Result.cachedRunTime)).toFixed(0)}x)\n`);

  // =========================================================================
  // SCENARIO 5: 私有瓦片缓存防御性边界与极端异常恢复
  // =========================================================================
  console.log('--- [Scenario 5] 私有瓦片缓存防御性边界与极端异常恢复 ---');
  const scenario5Result = await win.webContents.executeJavaScript(`(() => {
    let allGuardsPassed = true;

    // 测试各种畸形/极端输入
    const badInputs = [
      null,
      undefined,
      {},
      { style: null },
      { style: { _sourceCaches: null } },
      { style: { _sourceCaches: { badSource: null } } },
      {
        style: {
          _sourceCaches: {
            explodingSource: {
              get _maxTileCacheSize() { throw new Error('Simulated memory fault'); }
            }
          }
        }
      }
    ];

    for (const bad of badInputs) {
      try {
        window.safelyUpdatePrivateTileCache(bad, 256);
      } catch (e) {
        allGuardsPassed = false;
      }
    }

    // 测试极端数值
    const badSizes = [0, -100, NaN, Infinity, -Infinity, 'invalid'];
    for (const sz of badSizes) {
      try {
        window.safelyUpdatePrivateTileCache(window.mapInstance, sz);
      } catch (e) {
        allGuardsPassed = false;
      }
    }

    return { allGuardsPassed };
  })()`);

  check(scenario5Result.allGuardsPassed, 'Scenario 5: safelyUpdatePrivateTileCache failed to catch simulated faults');
  console.log('  ✓ 极端空对象、损坏 style 与异常注入均被安全捕获，零未捕获崩溃\n');

  clearTimeout(watchdog);
  console.log('======================================================');
  console.log('🎉 5 大综合场景自动化测试全部通过 (100% PASS)!');
  console.log('======================================================\n');
  win.destroy();
  app.quit();
}

app.whenReady().then(run).catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

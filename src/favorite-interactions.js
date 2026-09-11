(function (global) {
  'use strict';
  // Pointer capture and the Web Animations API keep DOM controls independent
  // of the map render loop. No timer or frame loop survives the gesture.
  function bindSort(container, commit) {
    container._disposeSort?.();
    const controller = new AbortController();
    let state = null, frame = 0, suppressClick = false;
    const options = { signal: controller.signal };
    const tabs = () => [...container.querySelectorAll('[data-tab-id]')].filter(el => el.dataset.tabId !== 'all');
    tabs().forEach(el => { el.draggable = false; el.classList.add('sortable-folder'); });
    function finish(cancelled) {
      if (!state) return;
      cancelAnimationFrame(frame); frame = 0;
      const s = state; state = null;
      clearTimeout(s.hold);
      if (s.active) {
        s.ghost.remove(); s.item.style.visibility = '';
        container.classList.remove('sorting-folders');
        if (cancelled) s.original.forEach(el => container.appendChild(el));
        const order = tabs().map(el => el.dataset.tabId);
        suppressClick = true;
        if (!cancelled && order.join() !== s.original.map(el => el.dataset.tabId).join()) commit(order);
      }
      if (container.hasPointerCapture(s.id)) container.releasePointerCapture(s.id);
    }
    function start() {
      const s = state;
      if (!s || s.active) return;
      s.active = true;
      const rect = s.item.getBoundingClientRect();
      s.offset = s.startX - rect.left;
      s.ghost = s.item.cloneNode(true);
      s.ghost.removeAttribute('id'); s.ghost.removeAttribute('data-tab-id');
      s.ghost.classList.add('folder-drag-preview');
      Object.assign(s.ghost.style, { width: rect.width + 'px', height: rect.height + 'px', top: rect.top + 'px', left: rect.left + 'px' });
      document.body.appendChild(s.ghost);
      s.item.style.visibility = 'hidden';
      container.classList.add('sorting-folders');
      container.setPointerCapture(s.id);
      frame = requestAnimationFrame(update);
    }
    function update() {
      frame = 0;
      const s = state;
      if (!s?.active) return;
      const viewport = container.getBoundingClientRect();
      const edge = s.x < viewport.left + 24 ? -1 : s.x > viewport.right - 24 ? 1 : 0;
      if (edge) container.scrollLeft += edge * 6;
      s.ghost.style.left = (s.x - s.offset) + 'px';
      const others = tabs().filter(el => el !== s.item);
      const layoutLeft = el => viewport.left + el.offsetLeft - container.scrollLeft;
      const next = others.find(el => s.x < layoutLeft(el) + el.offsetWidth / 2);
      if (s.item.nextElementSibling !== (next || null)) {
        const before = new Map(tabs().map(el => [el, el.offsetLeft]));
        container.insertBefore(s.item, next || null);
        for (const el of others) {
          const dx = before.get(el) - el.offsetLeft;
          if (Math.abs(dx) > 0.5 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.getAnimations().forEach(a => a.cancel());
            el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
          }
        }
      }
      if (edge) frame = requestAnimationFrame(update);
    }
    container.addEventListener('pointerdown', e => {
      if (e.button !== 0 || state) return;
      suppressClick = false;
      const item = e.target.closest('[data-tab-id]');
      if (!item || item.dataset.tabId === 'all') return;
      state = { item, id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, original: tabs(), active: false };
      if (e.pointerType !== 'mouse') state.hold = setTimeout(start, 300);
    }, options);
    window.addEventListener('pointermove', e => {
      if (!state || e.pointerId !== state.id) return;
      state.x = e.clientX;
      if (!state.active && Math.hypot(e.clientX - state.startX, e.clientY - state.y) > 5) {
        if (e.pointerType === 'mouse' || Math.abs(e.clientX - state.startX) > Math.abs(e.clientY - state.y)) start();
        else { finish(true); return; }
      }
      if (state?.active) { e.preventDefault(); if (!frame) frame = requestAnimationFrame(update); }
    }, { ...options, passive: false });
    window.addEventListener('pointerup', e => { if (state?.id === e.pointerId) finish(false); }, options);
    window.addEventListener('pointercancel', () => finish(true), options);
    window.addEventListener('blur', () => finish(true), options);
    window.addEventListener('keydown', e => { if (e.key === 'Escape') finish(true); }, options);
    container.addEventListener('contextmenu', e => { if (state?.active) e.preventDefault(); }, options);
    container.addEventListener('click', e => { if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; } }, { ...options, capture: true });
    container._disposeSort = () => { finish(true); controller.abort(); };
  }
  const paths = {
    view: 'M3 18 9 7 13 13 16 9 22 18Z M7 10 10 12',
    camp: 'M3 20 12 4 21 20Z M8 20 12 13 16 20 M10 3 14 6',
    water: 'M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0C19 11 14 7 12 3Z M8 15a4 4 0 0 0 4 4',
    supply: 'M4 7H20V21H4Z M8 7V5a4 4 0 0 1 8 0v2 M9 14h6 M12 11v6',
    parking: 'M8 21V3h6a5 5 0 0 1 0 10H8',
    hotel: 'M3 21V4 M3 15h18v6 M3 9h6v6 M10 8h8a3 3 0 0 1 3 3v4',
    photo: 'M3 7h5l2-3h4l2 3h5v14H3Z M16 14a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
    hiking: 'M15 4a1 1 0 1 0-2 0 1 1 0 0 0 2 0 M12 8 9 14 14 17 13 22 M9 14 5 21 M12 8 16 12h4 M19 10v12 M10 8 6 9 5 13',
    hike: 'M15 4a1 1 0 1 0-2 0 1 1 0 0 0 2 0 M12 8 9 14 14 17 13 22 M9 14 5 21 M12 8 16 12h4 M19 10v12 M10 8 6 9 5 13',
    drive: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2 M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    cycle: 'M18.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M15 5a1 1 0 1 0-2 0 1 1 0 0 0 2 0 M12 17.5V14l-3-3 4-3 2 3h3 M5.5 17.5 9 11',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    fav: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    route: 'M4 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M20 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M6 17h5a4 4 0 0 0 4-4V9a4 4 0 0 1 4-4h1',
    start: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
    end: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7 M9 3v11 M14 4v11',
    via: 'M12 5v14 M5 12h14',
    trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    export: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13',
    chart_up: 'M22 7 13.5 15.5 8.5 10.5 2 17 M16 7h6v6',
    chart_down: 'M22 17 13.5 8.5 8.5 13.5 2 7 M16 17h6v-6',
    mountain: 'M8 3l4 8 5-5 5 12H2L8 3z',
    valley: 'M3 17l6-9 4 5 3-4 5 8H3z M2 21h20',
    box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
    bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
    target: 'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    distance: 'M2 12h20 M6 8v8 M12 9v6 M18 8v8',
    compass: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 3.8 3.2 8.2-3.2-1.8-3.2 1.8Zm0 12.4-3.2-8.2 3.2 1.8 3.2-1.8Z',
    flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
    building: 'M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M9 9h1 M9 13h1 M9 17h1 M14 9h1 M14 13h1 M14 17h1',
    globe: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-10 10h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z',
    check: 'M20 6 9 17 4 12',
    history: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 5v5l3.5 2',
    school: 'M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 3 3 6 3s6-1 6-3v-5',
    hospital: 'M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M12 7v4 M10 9h4 M9 14h6 M9 17h6',
    home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10'
  };

  const colors = {
    view: '#059669',
    camp: '#d97706',
    water: '#0284c7',
    supply: '#e11d48',
    parking: '#2563eb',
    hotel: '#6366f1',
    photo: '#8b5cf6',
    hiking: '#ea580c',
    hike: '#ea580c',
    drive: '#0284c7',
    cycle: '#16a34a',
    star: '#f59e0b',
    fav: '#f59e0b',
    folder: '#64748b',
    pin: '#ef4444',
    target: '#0284c7',
    start: '#16a34a',
    via: '#0284c7',
    end: '#ef4444',
    route: '#0284c7',
    trash: '#ef4444',
    edit: '#64748b',
    export: '#0284c7',
    chart_up: '#16a34a',
    chart_down: '#ef4444',
    mountain: '#059669',
    valley: '#0284c7',
    box: '#0284c7',
    search: '#0284c7',
    bolt: '#f59e0b',
    distance: '#64748b',
    compass: '#0284c7',
    flag: '#ef4444',
    building: '#0284c7',
    globe: '#0284c7',
    check: '#16a34a',
    history: '#64748b',
    school: '#0284c7',
    hospital: '#e11d48',
    home: '#059669'
  };

  function icon(type) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const accent = colors[type] || '#0284c7';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = accent; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(32, 32, 27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.translate(14, 14); ctx.scale(1.5, 1.5); ctx.lineWidth = 1.9; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = accent;
    ctx.stroke(new Path2D(paths[type] || paths.view));
    return ctx.getImageData(0, 0, 64, 64);
  }

  function svg(type, opts = {}) {
    const size = opts.size || 20;
    const width = opts.width || size;
    const height = opts.height || size;
    const strokeWidth = opts.strokeWidth || 1.8;
    const color = opts.color || (opts.autoColor ? (colors[type] || 'currentColor') : 'currentColor');
    const cls = opts.className ? ` class="${opts.className}"` : '';
    const d = paths[type] || paths.view;
    return `<svg aria-hidden="true"${cls} width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  }

  global.OutmapFavoriteInteractions = { bindSort, icon, svg, paths, colors };
})(window);

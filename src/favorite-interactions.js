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
    hiking: 'M15 4a1 1 0 1 0-2 0 1 1 0 0 0 2 0 M12 8 9 14 14 17 13 22 M9 14 5 21 M12 8 16 12h4 M19 10v12 M10 8 6 9 5 13'
  };
  function icon(type) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(32,32,28,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.translate(14,14); ctx.scale(1.5,1.5); ctx.lineWidth = 1.8; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(paths[type] || paths.view));
    return ctx.getImageData(0,0,64,64);
  }
  function svg(type) {
    return `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[type] || paths.view}"/></svg>`;
  }
  global.OutmapFavoriteInteractions = { bindSort, icon, svg };
})(window);

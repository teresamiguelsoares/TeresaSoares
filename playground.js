// Home playground: an endless canvas you can pan in every direction, with cards to move and a pen.
(() => {
  const stage = document.getElementById('playground');
  if (!stage) return;

  const items = [...stage.querySelectorAll('.pg-item')];
  const svg = stage.querySelector('.pg-draw');
  const world = svg.querySelector('.pg-world');
  const hint = stage.querySelector('.pg-hint');
  const toolBtns = [...stage.querySelectorAll('[data-tool]')];
  const swatches = [...stage.querySelectorAll('.pg-swatch')];
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PAD = 180;              // how far past the edge a card can sit before it wraps
  const mod = (a, n) => ((a % n) + n) % n;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let tool = 'select';
  let color = swatches[0] ? swatches[0].dataset.color : 'var(--ink)';
  let topZ = 50;
  let ox = 0, oy = 0;           // how far the canvas has been panned
  let W = 1800;                 // width of one full loop
  let Hh = 1000;                // height of one full loop
  let H = stage.clientHeight;
  let drag = null;
  let pan = null;
  let glide = 0;

  // ---------- Layout: x and y are fractions of one full loop of the canvas ----------
  const pos = new Map();
  const start = new Map();

  items.forEach((el, i) => {
    const p = { fx: parseFloat(el.dataset.fx), fy: parseFloat(el.dataset.fy) };
    pos.set(el, { ...p });
    start.set(el, { ...p });
    el.style.setProperty('--r', (el.dataset.r || 0) + 'deg');
    el.style.setProperty('--i', i);
    el.style.zIndex = i + 1;
  });

  function measure() {
    H = stage.clientHeight;
    W = Math.max(1800, stage.clientWidth + PAD * 2 + 120);
    Hh = Math.max(900, H + PAD * 2 + 60);
  }

  function render() {
    items.forEach(el => {
      const p = pos.get(el);
      el.style.left = mod(p.fx * W + ox + PAD, W) - PAD + 'px';
      el.style.top = mod(p.fy * Hh + oy + PAD, Hh) - PAD + 'px';
    });
    world.setAttribute('transform', `translate(${ox} ${oy})`);
  }

  measure();
  render();
  window.addEventListener('resize', () => { measure(); render(); });

  const hideHint = () => hint && hint.classList.add('is-gone');

  // ---------- Dragging a card ----------
  items.forEach(el => {
    el.addEventListener('pointerdown', e => {
      if (tool !== 'select' || (e.button && e.button !== 0)) return;
      e.stopPropagation();
      cancelAnimationFrame(glide);
      const p = pos.get(el);
      drag = { el, id: e.pointerId, sx: e.clientX, sy: e.clientY, fx: p.fx, fy: p.fy, moved: false };
      el.setPointerCapture(e.pointerId);
      el.style.zIndex = ++topZ;
      el.classList.remove('is-settling');
    });

    el.addEventListener('pointermove', e => {
      if (!drag || drag.el !== el || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      if (!drag.moved) {
        drag.moved = true;
        el.classList.add('is-dragging');
        hideHint();
      }
      pos.set(el, {
        fx: drag.fx + dx / W,
        fy: drag.fy + dy / Hh
      });
      render();
    });

    const end = () => {
      if (!drag || drag.el !== el) return;
      el.classList.remove('is-dragging');
      try { el.releasePointerCapture(drag.id); } catch (_) {}
      drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    // keyboard: arrows nudge the focused card
    el.addEventListener('keydown', e => {
      const step = e.shiftKey ? 40 : 10;
      const p = pos.get(el);
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      e.stopPropagation();
      pos.set(el, { fx: p.fx + dx / W, fy: p.fy + dy / Hh });
      hideHint();
      render();
    });
  });

  // ---------- Panning the strip ----------
  const interactive = '.pg-item, .pg-toolbar, .scroll-arrow';

  stage.addEventListener('pointerdown', e => {
    if (tool !== 'select' || (e.button && e.button !== 0)) return;
    if (e.target.closest(interactive)) return;
    cancelAnimationFrame(glide);
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now() };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-panning');
    hideHint();
  });

  stage.addEventListener('pointermove', e => {
    if (!pan || pan.id !== e.pointerId) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    const now = performance.now();
    const f = 16 / Math.max(1, now - pan.t);      // to px per frame
    pan.vx = dx * f;
    pan.vy = dy * f;
    pan.x = e.clientX;
    pan.y = e.clientY;
    pan.t = now;
    ox += dx;
    oy += dy;
    render();
  });

  const endPan = () => {
    if (!pan) return;
    const { vx: ivx, vy: ivy } = pan;
    try { stage.releasePointerCapture(pan.id); } catch (_) {}
    pan = null;
    stage.classList.remove('is-panning');
    if (reduceMotion) return;
    let vx = ivx, vy = ivy;
    const step = () => {
      vx *= 0.94;
      vy *= 0.94;
      if (Math.abs(vx) < 0.15 && Math.abs(vy) < 0.15) return;
      ox += vx;
      oy += vy;
      render();
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  stage.addEventListener('pointerup', endPan);
  stage.addEventListener('pointercancel', endPan);

  // trackpad swipe sideways (diagonals included), or shift + wheel
  stage.addEventListener('wheel', e => {
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!sideways && !e.shiftKey) return;           // plain vertical scroll still scrolls the page
    e.preventDefault();
    cancelAnimationFrame(glide);
    if (sideways) { ox -= e.deltaX; oy -= e.deltaY; }
    else ox -= e.deltaY;
    hideHint();
    render();
  }, { passive: false });

  // ---------- Drawing (strokes live on the strip and travel with it) ----------
  const strokes = [];
  let current = null;

  const pt = e => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left - ox, y: e.clientY - r.top - oy };
  };

  svg.addEventListener('pointerdown', e => {
    if (tool !== 'pen' || (e.button && e.button !== 0)) return;
    hideHint();
    const p = pt(e);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'pg-stroke');
    path.style.stroke = color;
    path.setAttribute('d', `M${p.x} ${p.y}`);
    world.appendChild(path);
    current = { path, d: `M${p.x} ${p.y}`, last: p, id: e.pointerId, n: 0 };
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', e => {
    if (!current || current.id !== e.pointerId) return;
    const p = pt(e);
    const mid = { x: (current.last.x + p.x) / 2, y: (current.last.y + p.y) / 2 };
    current.d += ` Q${current.last.x} ${current.last.y} ${mid.x} ${mid.y}`;
    current.last = p;
    current.n++;
    current.path.setAttribute('d', current.d);
  });

  const endStroke = () => {
    if (!current) return;
    current.d += current.n === 0
      ? ` L${current.last.x + 0.01} ${current.last.y}`   // a single click leaves a dot
      : ` L${current.last.x} ${current.last.y}`;
    current.path.setAttribute('d', current.d);
    strokes.push(current.path);
    current = null;
  };
  svg.addEventListener('pointerup', endStroke);
  svg.addEventListener('pointercancel', endStroke);

  // ---------- Tools ----------
  function setTool(name) {
    tool = name;
    stage.classList.toggle('is-drawing', name === 'pen');
    toolBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === name));
  }

  toolBtns.forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

  swatches.forEach(s => s.addEventListener('click', () => {
    color = s.dataset.color;
    swatches.forEach(x => x.setAttribute('aria-pressed', x === s));
    setTool('pen');
  }));

  const undo = () => { const last = strokes.pop(); if (last) last.remove(); };
  const clearDrawing = () => { while (strokes.length) strokes.pop().remove(); };

  const reset = () => {
    cancelAnimationFrame(glide);
    clearDrawing();
    items.forEach(el => {
      el.classList.add('is-settling');
      pos.set(el, { ...start.get(el) });
    });
    ox = 0;
    oy = 0;
    render();
    setTool('select');
  };

  stage.querySelector('[data-action="undo"]').addEventListener('click', undo);
  stage.querySelector('[data-action="clear"]').addEventListener('click', clearDrawing);
  stage.querySelector('[data-action="reset"]').addEventListener('click', reset);

  stage.addEventListener('keydown', e => {
    if (e.key === 'Escape') setTool('select');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.target === stage && e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') ox += 80;
      else if (e.key === 'ArrowRight') ox -= 80;
      else if (e.key === 'ArrowUp') oy += 80;
      else oy -= 80;
      render();
    }
  });
})();
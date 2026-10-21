// Project pages v2: media loader, book → grid on scroll, lightbox, before/after, fog, wayfinding.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = $('header');
  const root = document.documentElement;

  const setHH = () => root.style.setProperty('--hh', (header ? header.offsetHeight : 130) + 'px');
  setHH();

  /* pull the first photo up beside the intro paragraph (desktop only) */
  const setOP = () => {
    const p = $('.open-p');
    const wide = window.matchMedia('(min-width: 801px)').matches;
    root.style.setProperty('--op-h', p && wide ? (p.offsetHeight + parseFloat(getComputedStyle(p).marginTop)) + 'px' : '0px');
  };
  setOP();
  addEventListener('resize', setOP);
  addEventListener('load', setOP);

  /* ---------- Media slots ----------
     <div class="slot" data-src="projects/x/01"> tries .jpg .png .webp .gif .mp4
     (or the exact file if data-src already has an extension). Drop a file in, it appears. */
  const EXTS = ['jpg', 'png', 'webp', 'gif', 'mp4'];
  const isVideo = u => /\.(mp4|webm)$/i.test(u);

  const probe = url => new Promise((resolve, reject) => {
    if (/\.pdf$/i.test(url)) {            // last resort: show a PDF page as it is
      const f = document.createElement('iframe');
      f.title = ''; f.tabIndex = -1; f.setAttribute('scrolling', 'no');
      f.onload = () => resolve(f);
      f.onerror = () => reject();
      f.src = url + '#toolbar=0&navpanes=0&scrollbar=0&view=Fit';
    } else if (isVideo(url)) {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.onloadeddata = () => resolve(v);
      v.onerror = () => reject();
      v.src = url;
    } else {
      const i = new Image();
      i.decoding = 'async'; i.draggable = false; i.alt = '';
      i.onload = () => resolve(i);
      i.onerror = () => reject();
      i.src = url;
    }
  });

  async function fill(slot) {
    const base = slot.dataset.src;
    if (!base) return;
    // look in the usual folder first, then in a few other places a "noise" folder might be
    const tail = base.replace(/^projects\//, '');                 // noise/noisespreads5.jpeg
    const places = [...new Set([base, tail, 'videos/' + tail, tail.split('/').pop()])];
    const withExt = b => /\.[a-z0-9]{2,4}$/i.test(b) ? [b] : EXTS.map(e => `${b}.${e}`);
    const list = places.flatMap(withExt);
    if (/\.jpe?g$/i.test(base)) list.push(...places.map(b => b.replace(/\.jpe?g$/i, '.pdf')));   // a PDF with the same name
    for (const url of list) {
      try {
        const el = await probe(url);
        slot.appendChild(el);
        slot.classList.add('has');
        if (el.play) el.play().catch(() => {});
        const host = slot.closest('[data-zoom]');
        if (host) {
          host.classList.add('has-media');
          host.tabIndex = 0;
          host.setAttribute('role', 'button');
        }
        return;
      } catch (_) { /* try next extension */ }
    }
  }

  const slotIO = new IntersectionObserver((entries, io) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      fill(e.target);
    });
  }, { rootMargin: '800px 0px' });
  $$('.slot[data-src]').forEach(s => slotIO.observe(s));

  /* ---------- Embeds (prototypes): set data-embed="https://…" ---------- */
  $$('.embed[data-embed]').forEach(el => {
    const u = el.dataset.embed;
    if (!u) return;
    const f = document.createElement('iframe');
    f.src = u; f.loading = 'lazy'; f.allowFullscreen = true; f.title = 'Interactive prototype';
    el.appendChild(f);
    el.classList.add('has');
  });

  /* ---------- Reveal on scroll (children of every .row) ---------- */
  $$('.row, .board').forEach(r => [...r.children].forEach((c, i) => {
    c.classList.add('rv');
    c.style.setProperty('--d', Math.min(i, 4) * 0.09 + 's');
  }));
  const rvIO = new IntersectionObserver((entries, io) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  $$('.rv').forEach(el => rvIO.observe(el));

  /* ---------- Book page → grid ---------- */
  const decks = [];

  function initDeck(deck) {
    if (reduce) return; // stays a plain grid
    const stage = $('.deck-stage', deck);
    const sticky = $('.deck-sticky', deck);
    const tiles = $$('.deck-tile', stage);
    const n = tiles.length;
    const [aw, ah] = (deck.dataset.ar || '3/4').split('/').map(Number);
    const ar = aw / ah;
    let L = null;
    let curP = 0;
    let mx = 0, my = 0, tx = 0, ty = 0;

    deck.classList.add('is-live');

    function layout() {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const gap = clamp(W * 0.012, 8, 16);
      const availH = H - 56;
      let best = { w: 0 };
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        let w = (W - gap * (c - 1)) / c;
        let h = w / ar;
        const maxH = (availH - gap * (r - 1)) / r;
        if (h > maxH) { h = maxH; w = h * ar; }
        if (w > best.w) best = { w, h, c, r };
      }
      const { w, h, c, r } = best;
      const bigH = Math.min(H * 0.9, (W * 0.86) / ar);
      const s0 = bigH / h;
      L = { w, h, gx: [], gy: [], sx: [], sy: [], sc: [], rz: [] };
      const top = (H - (r * h + (r - 1) * gap)) / 2 + 8;
      tiles.forEach((el, i) => {
        const row = Math.floor(i / c);
        const col = i % c;
        const inRow = row === r - 1 ? n - c * (r - 1) : c;
        const rowW = inRow * w + (inRow - 1) * gap;
        L.gx[i] = (W - rowW) / 2 + col * (w + gap);
        L.gy[i] = top + row * (h + gap);
        const j = Math.min(i, 5);
        L.sc[i] = s0 * (1 - 0.018 * j);
        L.rz[i] = i === 0 ? 0 : (((i * 37) % 9) - 4) * 0.8;
        L.sx[i] = W / 2 - w / 2 + (i === 0 ? 0 : ((i % 3) - 1) * 3);
        L.sy[i] = H / 2 - h / 2 + (i === 0 ? 0 : ((i % 4) - 1.5) * 2) - 6;
        el.style.width = w + 'px';
        el.style.height = h + 'px';
      });
    }

    function paint(p) {
      curP = p;
      deck.style.setProperty('--p', p.toFixed(4));
      tiles.forEach((el, i) => {
        const delay = (i / n) * 0.42;
        const t = ease(clamp((p - delay) / 0.58, 0, 1));
        const s = L.sc[i] + (1 - L.sc[i]) * t;
        const x = L.sx[i] + (L.gx[i] - L.sx[i]) * t;
        const y = L.sy[i] + (L.gy[i] - L.sy[i]) * t;
        const rz = L.rz[i] * (1 - t);
        let ry = Math.sin(Math.PI * t) * (i % 2 ? 14 : -14);
        let rx = 0;
        if (i === 0) {
          ry += tx * 5 * (1 - t);
          rx = -ty * 4 * (1 - t);
        }
        el.style.zIndex = n - i;
        el.style.transform = `translate3d(${x}px,${y}px,0) rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})`;
      });
      deck.classList.toggle('is-open', p > 0.985);
    }

    function progress() {
      const r = deck.getBoundingClientRect();
      const hh = header ? header.offsetHeight : 130;
      const run = deck.offsetHeight - sticky.offsetHeight;
      return clamp((hh - r.top) / (run * 0.7), 0, 1);
    }

    // a little tilt on the cover while it is still a single page
    stage.addEventListener('pointermove', e => {
      if (curP > 0.06) return;
      const r = stage.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      my = ((e.clientY - r.top) / r.height) * 2 - 1;
      tx += (mx - tx) * 0.3;
      ty += (my - ty) * 0.3;
      paint(curP);
    });
    stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (L) paint(curP); });

    const api = {
      update() { paint(progress()); },
      relayout() { layout(); paint(progress()); }
    };
    layout();
    paint(progress());
    decks.push(api);
  }
  $$('.deck').forEach(initDeck);

  /* ---------- Before / after slider ---------- */
  $$('.cmp').forEach(c => {
    let touched = false;
    const set = v => c.style.setProperty('--x', clamp(v, 0, 100) + '%');
    const at = e => set(((e.clientX - c.getBoundingClientRect().left) / c.offsetWidth) * 100);
    const handle = $('.cmp-h', c);
    let x = 50;
    set(50);

    c.addEventListener('pointerdown', e => {
      touched = true;
      c.setPointerCapture(e.pointerId);
      at(e);
      c.onpointermove = at;
    });
    const up = () => { c.onpointermove = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    handle.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      touched = true;
      x = parseFloat(getComputedStyle(c).getPropertyValue('--x')) || 50;
      x += e.key === 'ArrowLeft' ? -4 : 4;
      set(x);
    });

    if (!reduce) {
      const io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = now => {
          if (touched) return;
          const k = (now - t0) / 1800;
          if (k >= 1) { set(50); return; }
          set(50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k));
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: 0.6 });
      io.observe(c);
    }
  });

  /* ---------- Lightbox ---------- */
  let lb = null, list = [], idx = 0;

  function buildLB() {
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
      '<button class="lb-x" type="button" aria-label="Close">×</button>' +
      '<button class="lb-p" type="button" aria-label="Previous">←</button>' +
      '<figure class="lb-fig"><div class="lb-media"></div><figcaption class="lb-cap"></figcaption></figure>' +
      '<button class="lb-n" type="button" aria-label="Next">→</button>';
    document.body.appendChild(lb);
    $('.lb-x', lb).addEventListener('click', closeLB);
    $('.lb-p', lb).addEventListener('click', () => show(idx - 1));
    $('.lb-n', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', e => { if (e.target === lb) closeLB(); });
  }

  function show(i) {
    idx = (i + list.length) % list.length;
    const host = list[idx];
    const src = $('.slot > img, .slot > video', host);
    const box = $('.lb-media', lb);
    box.textContent = '';
    if (src) {
      let el;
      if (src.tagName === 'VIDEO') {
        el = document.createElement('video');
        el.src = src.currentSrc || src.src;
        el.autoplay = true; el.loop = true; el.muted = true; el.controls = true; el.playsInline = true;
      } else {
        el = new Image();
        el.src = src.currentSrc || src.src;
        el.alt = '';
      }
      box.appendChild(el);
    }
    const cap = '';   // no captions
    $('.lb-cap', lb).textContent = cap ? `${cap}  ·  ${idx + 1} / ${list.length}` : `${idx + 1} / ${list.length}`;
  }

  function openLB(host) {
    if (!lb) buildLB();
    list = $$('[data-zoom].has-media');
    const i = list.indexOf(host);
    if (i < 0) return;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    show(i);
    $('.lb-x', lb).focus();
  }

  function closeLB() {
    if (!lb) return;
    lb.classList.remove('open');
    $('.lb-media', lb).textContent = '';
    document.body.style.overflow = '';
  }

  document.addEventListener('click', e => {
    const host = e.target.closest('[data-zoom].has-media');
    if (host) openLB(host);
  });
  document.addEventListener('keydown', e => {
    if (lb && lb.classList.contains('open')) {
      if (e.key === 'Escape') closeLB();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-zoom].has-media')) {
      e.preventDefault();
      openLB(e.target);
    }
  });

  /* ---------- Scroll-driven bits ---------- */
  const fog = $('[data-fog]');
  const way = $('.way');
  const toTop = $('.totop');
  const parEls = $$('[data-par]');

  function update() {
    const vh = window.innerHeight;
    decks.forEach(d => d.update());

    if (fog) {
      const r = fog.getBoundingClientRect();
      const fin = clamp((vh * 0.7 - r.top) / (r.height * 0.7), 0, 1);
      const fout = clamp((r.bottom - vh * 0.2) / (vh * 0.5), 0, 1);
      fog.style.setProperty('--fog', Math.min(fin, fout).toFixed(3));
    }

    if (way) {
      const max = document.documentElement.scrollHeight - vh;
      way.style.setProperty('--pg', clamp(max > 0 ? window.scrollY / max : 0, 0, 1).toFixed(4));
    }

    if (toTop) toTop.classList.toggle('show', window.scrollY > 700);

    if (!reduce) {
      parEls.forEach(el => {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2 - vh / 2;
        el.style.setProperty('--py', (-c * parseFloat(el.dataset.par)).toFixed(1) + 'px');
      });
    }
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    setHH();
    decks.forEach(d => d.relayout());
    update();
  });
  window.addEventListener('load', () => { setHH(); decks.forEach(d => d.relayout()); update(); });

  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  update();
})();
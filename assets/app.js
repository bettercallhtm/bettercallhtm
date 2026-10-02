/* ─────────────────────────────────────────────────────────
   bettercallhtm — app.js
   vanilla, zero deps. every section is a small module below.
   ───────────────────────────────────────────────────────── */
(() => {
  'use strict';

  /* ── utils ───────────────────────────────────────────── */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function rgba(hex, a) {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const bus = new EventTarget();
  const on = (e, f) => bus.addEventListener(e, f);
  const emit = e => bus.dispatchEvent(new Event(e));

  /* theme colours for canvases, re-read on theme change */
  const C = {};
  function readColors() {
    const cs = getComputedStyle(root);
    const g = k => cs.getPropertyValue('--' + k).trim();
    Object.assign(C, {
      bg: g('bg'), bg2: g('bg-2'), surface: g('surface'), surface2: g('surface-2'),
      text: g('text'), textMuted: g('text-muted'), textDim: g('text-dim'),
      accent: g('accent'), accent2: g('accent-2'), up: g('up'), down: g('down'),
      winAccent: g('win-accent'),
      sqA: g('sq-a'), sqB: g('sq-b'), bgRGB: g('bg-rgb'),
    });
  }
  readColors();

  /* canvas sized to its CSS box, DPR aware */
  function setupCanvas(canvas, onResize) {
    const ctx = canvas.getContext('2d');
    const S = { ctx, w: 0, h: 0 };
    const resize = notify => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight; // content box, border excluded
      if (!cw || !ch) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.w = cw; S.h = ch;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (notify && onResize) onResize(S);
    };
    // size synchronously so callers can draw right away; the observer's first
    // (async) callback then notifies once the caller's own state exists
    resize(false);
    new ResizeObserver(() => resize(true)).observe(canvas);
    return S;
  }

  /* fire once when el first scrolls into view */
  function onFirstView(el, fn, margin = '0px') {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { io.disconnect(); fn(); }
    }, { rootMargin: margin });
    io.observe(el);
  }

  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
  }

  /* ── i18n ────────────────────────────────────────────── */
  const T = {
    tr: {
      gbmAxis: ['0', '6 ay', '1 yıl'],
      gbmDist: 'dağılım',
      knightRead: (n, s) => `hamle <b>${n}</b>/64 · başlangıç <b>${s}</b>`,
      knightDone: 'tur tamam ✓',
      reduced: 'Hareket azaltma açık — animasyon pas geçildi',
    },
    en: {
      gbmAxis: ['0', '6 mo', '1 yr'],
      gbmDist: 'distribution',
      knightRead: (n, s) => `move <b>${n}</b>/64 · start <b>${s}</b>`,
      knightDone: 'tour complete ✓',
      reduced: 'Reduced motion is on — animation skipped',
    },
  };
  let LANG = 'tr';
  const t = k => (T[LANG][k] !== undefined ? T[LANG][k] : T.tr[k]);
  const tl = (tr, en) => (LANG === 'en' ? en : tr);

  function setLang(lang) {
    LANG = lang === 'en' ? 'en' : 'tr';
    $$('[data-tr]').forEach(el => {
      const v = LANG === 'en' ? el.dataset.en : el.dataset.tr;
      if (v != null) el.textContent = v;
    });
    $$('[data-tr-label]').forEach(el => {
      const v = LANG === 'en' ? el.dataset.enLabel : el.dataset.trLabel;
      if (v == null) return;
      el.setAttribute('aria-label', v);
      if (el.hasAttribute('title')) el.title = v;
    });
    root.lang = LANG;
    $$('.lang-opt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
    try { localStorage.setItem('lang', LANG); } catch (e) {}
    emit('lang');
  }
  $$('.lang-opt').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  try { LANG = localStorage.getItem('lang') === 'en' ? 'en' : 'tr'; } catch (e) {}
  setLang(LANG);

  /* ── theme ───────────────────────────────────────────── */
  /* follows the OS setting until the visitor picks one with the switch */
  const themeBtn = $('#theme-switch');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
  function applyTheme() {
    themeBtn.setAttribute('aria-checked', String(currentTheme() === 'dark'));
    readColors();
    emit('theme');
  }
  function setTheme(th) {
    root.setAttribute('data-theme', th);
    try { localStorage.setItem('theme', th); } catch (e) {}
    applyTheme();
  }
  themeBtn.setAttribute('aria-checked', String(currentTheme() === 'dark'));
  themeBtn.addEventListener('click', () => setTheme(currentTheme() === 'light' ? 'dark' : 'light'));
  systemDark.addEventListener('change', () => { if (!root.hasAttribute('data-theme')) applyTheme(); });

  /* ── header: scroll progress + active link ───────────── */
  const progress = $('#progress');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── reveal on scroll ────────────────────────────────── */
  const revIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      revIO.unobserve(el);
      el.classList.add('in');
      const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
      setTimeout(() => el.classList.add('settled'), 950 + d);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.rv').forEach(el => revIO.observe(el));

  /* ── hero: config file ──────────────────────────────── */
  (() => {
    const el = $('#code');
    if (!el) return;
    const L = (...toks) => toks;
    const s = x => ['s', `"${x}"`];
    const o = x => ['o', x];
    const arr = (...xs) => xs.flatMap((x, i) => (i ? [o(', '), s(x)] : [s(x)]));
    const prop = (k, ...v) => L(o('  '), ['p', k], o(': '), ...v, o(','));
    const CODE = [
      L(['c', '// htm.config.ts — v2026.9']),
      L(['k', 'export const '], ['v', 'htm'], o(' = {')),
      prop('name', s('Hasan Tahsin Meriç')),
      prop('handle', s('@bettercallhtm')),
      prop('role', s('solo founder')),
      prop('base', s('İstanbul, TR')),
      prop('edu', s('İTÜ · Electronics & Comm.')),
      L(o('  '), ['p', 'shipped'], o(': ['), ...arr('Debi', 'Nightjar', 'Laftan'), o(',')),
      L(o('            '), ...arr('Liman', 'Chess'), o('],')),
      prop('stack', o('['), ...arr('TS', 'React Native', 'Node', 'Python'), o(']')),
      prop('into', o('['), ...arr('finance', 'number theory', 'chess'), o(']')),
      L(o('  '), ['f', 'ship'], o(': () => '), ['v', 'idea'], o('.'), ['f', 'build'], o('().'), ['f', 'launch'], o('(),')),
      L(o('} '), ['k', 'as const'], o(';')),
    ];
    el.innerHTML = CODE.map((line, li) =>
      `<span class="ln">${li + 1}</span>` + line.map(([cls, txt]) => `<span class="t-${cls}">${esc(txt)}</span>`).join('')
    ).join('\n');
  })();

  /* ── lab: GBM Monte Carlo ───────────────────────────── */
  (() => {
    const cv = $('#gbm-canvas');
    if (!cv) return;
    const muIn = $('#gbm-mu'), sgIn = $('#gbm-sigma'), muO = $('#gbm-mu-o'), sgO = $('#gbm-sigma-o');
    const stats = $('#gbm-stats');
    const STEPS = 252, S0 = 100;
    let paths = [], mean = null, finals = [], lo = 0, hi = 1, prog = 0, raf = 0, ready = false;
    const S = setupCanvas(cv, () => ready && draw());
    const fmt = v => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v >= 100 ? v.toFixed(0) : v.toFixed(1));

    function simulate() {
      const mu = +muIn.value, sg = +sgIn.value, N = S.w < 520 ? 36 : 64;
      const dt = 1 / STEPS, drift = (mu - 0.5 * sg * sg) * dt, vol = sg * Math.sqrt(dt);
      paths = [];
      mean = new Float64Array(STEPS + 1);
      let mn = Infinity, mx = -Infinity;
      for (let k = 0; k < N; k++) {
        const p = new Float64Array(STEPS + 1);
        p[0] = S0;
        for (let i = 1; i <= STEPS; i++) p[i] = p[i - 1] * Math.exp(drift + vol * gauss());
        for (let i = 0; i <= STEPS; i++) {
          mean[i] += p[i] / N;
          if (p[i] < mn) mn = p[i];
          if (p[i] > mx) mx = p[i];
        }
        paths.push(p);
      }
      finals = paths.map(p => p[STEPS]).sort((a, b) => a - b);
      lo = Math.log(mn); hi = Math.log(mx);
      const pad = (hi - lo) * 0.06 || 0.1;
      lo -= pad; hi += pad;
      const m = finals.reduce((a, b) => a + b, 0) / N;
      const pUp = finals.filter(v => v > S0).length / N;
      const q5 = finals[Math.floor(0.05 * N)];
      const var95 = Math.max(0, (S0 - q5) / S0);
      stats.innerHTML =
        `<span>E[S<sub>T</sub>] <b>${m.toFixed(1)}</b></span>` +
        `<span>P(S<sub>T</sub> &gt; S<sub>0</sub>) <b class="${pUp >= 0.5 ? 'ok' : 'bad'}">${(pUp * 100).toFixed(0)}%</b></span>` +
        `<span>VaR<sub>95</sub> <b class="bad">${(var95 * 100).toFixed(1)}%</b></span>` +
        `<span>N <b>${N}</b></span>`;
      ready = true;
      prog = REDUCED ? STEPS : 0;
      run();
    }
    function run() {
      cancelAnimationFrame(raf);
      if (prog >= STEPS) { draw(); return; }
      let last = performance.now();
      const step = now => {
        prog = Math.min(STEPS, prog + (now - last) * 0.2);
        last = now;
        draw();
        if (prog < STEPS) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    function draw() {
      const { ctx, w, h } = S;
      if (!w || !paths.length) return;
      ctx.clearRect(0, 0, w, h);
      const L = 44, R = w - 86, T = 16, B = h - 26;
      const X = i => L + (i / STEPS) * (R - L);
      const Y = v => B - ((Math.log(v) - lo) / (hi - lo)) * (B - T);
      ctx.font = '10.5px "JetBrains Mono", monospace';
      ctx.lineWidth = 1;

      // grid + y labels (log scale)
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = rgba(C.text, 0.06);
      ctx.fillStyle = C.textDim;
      for (let g = 0; g <= 4; g++) {
        const v = Math.exp(lo + ((hi - lo) * g) / 4), y = Math.round(Y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
        ctx.fillText(fmt(v), L - 8, y);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      t('gbmAxis').forEach((lab, i) => ctx.fillText(lab, X((i / 2) * STEPS), B + 8));

      // S0
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = rgba(C.text, 0.3);
      ctx.beginPath(); ctx.moveTo(L, Y(S0)); ctx.lineTo(R, Y(S0)); ctx.stroke();
      ctx.setLineDash([]);

      // paths
      const n = Math.floor(prog);
      for (const p of paths) {
        ctx.strokeStyle = rgba(p[STEPS] > S0 ? C.up : C.down, 0.28);
        ctx.beginPath();
        ctx.moveTo(X(0), Y(p[0]));
        for (let i = 1; i <= n; i++) ctx.lineTo(X(i), Y(p[i]));
        ctx.stroke();
      }
      if (n < STEPS) {
        ctx.fillStyle = C.text;
        for (const p of paths) { ctx.beginPath(); ctx.arc(X(n), Y(p[n]), 1.4, 0, Math.PI * 2); ctx.fill(); }
      }
      // mean path
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(mean[0]));
      for (let i = 1; i <= n; i++) ctx.lineTo(X(i), Y(mean[i]));
      ctx.stroke();

      // terminal distribution histogram
      const a = Math.pow(prog / STEPS, 3);
      if (a > 0.01) {
        const BINS = 26, counts = new Array(BINS).fill(0);
        for (const v of finals) counts[clamp(Math.floor(((Math.log(v) - lo) / (hi - lo)) * BINS), 0, BINS - 1)]++;
        const maxC = Math.max(...counts), bw = w - R - 18;
        for (let b = 0; b < BINS; b++) {
          if (!counts[b]) continue;
          const y1 = B - ((b + 1) / BINS) * (B - T), y2 = B - (b / BINS) * (B - T);
          const center = Math.exp(lo + ((b + 0.5) / BINS) * (hi - lo));
          ctx.fillStyle = rgba(center > S0 ? C.up : C.down, 0.6 * a);
          ctx.fillRect(R + 10, y1 + 0.5, (counts[b] / maxC) * bw * a, Math.max(1, y2 - y1 - 1));
        }
        ctx.fillStyle = rgba(C.textDim, a);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(t('gbmDist'), R + 10, 2);
      }
    }
    const syncOut = () => {
      muO.textContent = Math.round(+muIn.value * 100) + '%';
      sgO.textContent = Math.round(+sgIn.value * 100) + '%';
    };
    let deb = 0;
    [muIn, sgIn].forEach(inp => inp.addEventListener('input', () => {
      syncOut();
      clearTimeout(deb);
      deb = setTimeout(simulate, 140);
    }));
    $('#gbm-run').addEventListener('click', simulate);
    on('theme', () => ready && draw());
    on('lang', () => ready && draw());
    syncOut();
    onFirstView(cv, simulate);
  })();

  /* ── number theory helpers ───────────────────────────── */
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function factor(n) {
    const f = [];
    for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
      let e = 0;
      while (n % p === 0) { n /= p; e++; }
      if (e) f.push([p, e]);
    }
    if (n > 1) f.push([n, 1]);
    return f;
  }
  const fmtFactors = f => f.map(([p, e]) => p + (e > 1 ? String(e).split('').map(d => SUP[d]).join('') : '')).join(' · ');

  /* ── lab: knight's tour ────────────────────────────── */
  (() => {
    const cv = $('#knight-canvas');
    if (!cv) return;
    const read = $('#knight-read');
    const M = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    const inside = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8;
    const sqName = ([x, y]) => 'abcdefgh'[x] + (8 - y);
    let path = [], shown = 0, raf = 0, started = false;
    const S = setupCanvas(cv, () => started && draw());

    function tour(sx, sy) {
      for (let attempt = 0; attempt < 300; attempt++) {
        const vis = new Uint8Array(64);
        const p = [[sx, sy]];
        vis[sy * 8 + sx] = 1;
        let x = sx, y = sy;
        for (let step = 1; step < 64; step++) {
          let best = [], bestDeg = 9;
          for (const [dx, dy] of M) {
            const nx = x + dx, ny = y + dy;
            if (!inside(nx, ny) || vis[ny * 8 + nx]) continue;
            let deg = 0;
            for (const [ex, ey] of M) { const mx = nx + ex, my = ny + ey; if (inside(mx, my) && !vis[my * 8 + mx]) deg++; }
            if (deg < bestDeg) { bestDeg = deg; best = [[nx, ny]]; } else if (deg === bestDeg) best.push([nx, ny]);
          }
          if (!best.length) break;
          [x, y] = best[(Math.random() * best.length) | 0];
          vis[y * 8 + x] = 1;
          p.push([x, y]);
        }
        if (p.length === 64) return p;
      }
      return null;
    }
    function geom() {
      const side = Math.min(S.w, S.h) - 16, sq = side / 8;
      return { sq, ox: (S.w - side) / 2, oy: (S.h - side) / 2 };
    }
    function draw() {
      const { ctx, w, h } = S;
      if (!w) return;
      const { sq, ox, oy } = geom();
      ctx.clearRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 ? C.sqA : C.sqB;
        ctx.fillRect(ox + x * sq, oy + y * sq, sq, sq);
      }
      ctx.font = `${Math.max(8, sq * 0.16)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = C.textDim;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      for (let x = 0; x < 8; x++) ctx.fillText('abcdefgh'[x], ox + x * sq + 3, oy + 8 * sq - 2);
      ctx.textBaseline = 'top';
      for (let y = 0; y < 8; y++) ctx.fillText(String(8 - y), ox + 3, oy + y * sq + 2);
      if (!path.length) return;
      const cx = ([x]) => ox + x * sq + sq / 2, cy = ([, y]) => oy + y * sq + sq / 2;
      // visited tint + numbers
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.max(9, sq * 0.26)}px "JetBrains Mono", monospace`;
      for (let i = 0; i < shown; i++) {
        const [x, y] = path[i];
        ctx.fillStyle = rgba(C.accent, 0.06 + 0.1 * (i / 64));
        ctx.fillRect(ox + x * sq, oy + y * sq, sq, sq);
        if (i < shown - 1) { ctx.fillStyle = rgba(C.text, 0.45); ctx.fillText(String(i + 1), cx(path[i]), cy(path[i])); }
      }
      // path
      ctx.strokeStyle = rgba(C.accent, 0.8);
      ctx.lineWidth = Math.max(1.2, sq * 0.035);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < shown; i++) i ? ctx.lineTo(cx(path[i]), cy(path[i])) : ctx.moveTo(cx(path[i]), cy(path[i]));
      ctx.stroke();
      // start marker
      ctx.strokeStyle = C.accent2;
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + path[0][0] * sq + 2, oy + path[0][1] * sq + 2, sq - 4, sq - 4);
      // knight
      const cur = path[Math.max(0, shown - 1)];
      ctx.font = `${sq * 0.74}px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif`;
      ctx.fillStyle = C.text;
      ctx.fillText('♞', cx(cur), cy(cur) + sq * 0.03);
    }
    function start(sx, sy) {
      cancelAnimationFrame(raf);
      path = tour(sx, sy) || [];
      if (!path.length) return;
      shown = REDUCED ? 64 : 1;
      let acc = 0, last = performance.now();
      const upd = () => {
        read.innerHTML = t('knightRead')(shown, sqName(path[0])) + (shown === 64 ? ` · <span class="ok">${t('knightDone')}</span>` : '');
      };
      const step = now => {
        acc += now - last; last = now;
        while (acc > 110 && shown < 64) { acc -= 110; shown++; }
        draw(); upd();
        if (shown < 64) raf = requestAnimationFrame(step);
      };
      draw(); upd();
      if (shown < 64) raf = requestAnimationFrame(step);
    }
    const randomStart = () => start((Math.random() * 8) | 0, (Math.random() * 8) | 0);
    cv.addEventListener('click', e => {
      const { sq, ox, oy } = geom();
      const x = Math.floor((e.offsetX - ox) / sq), y = Math.floor((e.offsetY - oy) / sq);
      if (inside(x, y)) start(x, y);
    });
    $('#knight-run').addEventListener('click', randomStart);
    on('theme', () => started && draw());
    on('lang', () => { if (path.length) read.innerHTML = t('knightRead')(shown, sqName(path[0])) + (shown === 64 ? ` · <span class="ok">${t('knightDone')}</span>` : ''); });
    onFirstView(cv, () => { started = true; randomStart(); });
  })();

  /* ── lab: Black–Scholes call ──────────────────────── */
  (() => {
    const cv = $('#bs-canvas');
    if (!cv) return;
    const sgIn = $('#bs-sigma'), tIn = $('#bs-t'), sgO = $('#bs-sigma-o'), tO = $('#bs-t-o'), read = $('#bs-read');
    const K = 100, R = 0.03, SMIN = 50, SMAX = 150;
    let hover = null, ready = false;
    const S = setupCanvas(cv, () => ready && draw());
    // Abramowitz–Stegun 7.1.26, |error| < 1.5e-7
    const erf = x => {
      const sg = Math.sign(x), a = Math.abs(x), k = 1 / (1 + 0.3275911 * a);
      return sg * (1 - ((((1.061405429 * k - 1.453152027) * k + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a));
    };
    const N = x => 0.5 * (1 + erf(x / Math.SQRT2));
    const pdf = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    function price(s, sg, T) {
      const sq = sg * Math.sqrt(T), d1 = (Math.log(s / K) + (R + sg * sg / 2) * T) / sq, d2 = d1 - sq, disc = Math.exp(-R * T);
      return {
        c: s * N(d1) - K * disc * N(d2),
        delta: N(d1),
        gamma: pdf(d1) / (s * sq),
        theta: (-s * pdf(d1) * sg / (2 * Math.sqrt(T)) - R * K * disc * N(d2)) / 365,
        vega: s * pdf(d1) * Math.sqrt(T) / 100,
      };
    }
    const params = () => [+sgIn.value, +tIn.value / 365];

    function draw() {
      const { ctx, w, h } = S;
      if (!w) return;
      const [sg, T] = params();
      const L = 40, Rt = w - 14, Tp = 14, B = h - 26;
      const yMax = Math.max(52, price(SMAX, sg, T).c) * 1.08;
      const X = s => L + ((s - SMIN) / (SMAX - SMIN)) * (Rt - L);
      const Y = v => B - (v / yMax) * (B - Tp);
      ctx.clearRect(0, 0, w, h);
      ctx.font = '10.5px "JetBrains Mono", monospace';
      ctx.lineWidth = 1;
      // grid
      ctx.strokeStyle = rgba(C.text, 0.06);
      ctx.fillStyle = C.textDim;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const yStep = yMax > 60 ? 20 : 10;
      for (let v = 0; v <= yMax; v += yStep) {
        const y = Math.round(Y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(Rt, y); ctx.stroke();
        ctx.fillText(String(v), L - 8, y);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let s = SMIN; s <= SMAX; s += 25) ctx.fillText(String(s), X(s), B + 8);
      // strike
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(C.text, 0.22);
      ctx.beginPath(); ctx.moveTo(X(K), Tp); ctx.lineTo(X(K), B); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.textDim;
      ctx.textAlign = 'left';
      ctx.fillText('K', X(K) + 5, Tp);
      // curve + payoff; the gap between them is time value
      const pts = [];
      for (let px = L; px <= Rt; px += 2) { const s = SMIN + ((px - L) / (Rt - L)) * (SMAX - SMIN); pts.push([px, Y(price(s, sg, T).c), Y(Math.max(0, s - K))]); }
      ctx.beginPath();
      pts.forEach(([x, yc], i) => (i ? ctx.lineTo(x, yc) : ctx.moveTo(x, yc)));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][2]);
      ctx.closePath();
      ctx.fillStyle = rgba(C.accent, 0.1);
      ctx.fill();
      ctx.strokeStyle = rgba(C.text, 0.4);
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(X(SMIN), Y(0)); ctx.lineTo(X(K), Y(0)); ctx.lineTo(X(SMAX), Y(SMAX - K)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      pts.forEach(([x, yc], i) => (i ? ctx.lineTo(x, yc) : ctx.moveTo(x, yc)));
      ctx.stroke();
      // legend
      ctx.font = '10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.accent; ctx.fillRect(L + 10, Tp + 6, 14, 2.4);
      ctx.fillStyle = C.textDim; ctx.fillText(tl('opsiyon değeri', 'option value'), L + 30, Tp + 7);
      ctx.fillStyle = rgba(C.text, 0.4); ctx.fillRect(L + 10, Tp + 22, 14, 1);
      ctx.fillStyle = C.textDim; ctx.fillText(tl('vade sonu getirisi', 'payoff at expiry'), L + 30, Tp + 22);
      // hovered spot price (defaults to at-the-money)
      const s = hover == null ? K : hover;
      const g = price(s, sg, T);
      ctx.strokeStyle = rgba(C.text, hover == null ? 0 : 0.3);
      ctx.beginPath(); ctx.moveTo(X(s), Tp); ctx.lineTo(X(s), B); ctx.stroke();
      ctx.fillStyle = C.accent2;
      ctx.beginPath(); ctx.arc(X(s), Y(g.c), 4, 0, Math.PI * 2); ctx.fill();
      read.innerHTML =
        `<span>S <b>${s.toFixed(1)}</b></span>` +
        `<span>C <b>${g.c.toFixed(2)}</b></span>` +
        `<span>Δ <b>${g.delta.toFixed(3)}</b></span>` +
        `<span>Γ <b>${g.gamma.toFixed(4)}</b></span>` +
        `<span>Θ/${tl('gün', 'day')} <b class="bad">${g.theta.toFixed(3)}</b></span>` +
        `<span>ν <b>${g.vega.toFixed(3)}</b></span>`;
    }
    const sync = () => {
      sgO.textContent = Math.round(+sgIn.value * 100) + '%';
      tO.textContent = tIn.value;
      draw();
    };
    [sgIn, tIn].forEach(inp => inp.addEventListener('input', sync));
    cv.addEventListener('pointermove', e => {
      const L = 40, Rt = S.w - 14;
      hover = clamp(SMIN + ((e.offsetX - L) / (Rt - L)) * (SMAX - SMIN), SMIN, SMAX);
      draw();
    });
    cv.addEventListener('pointerleave', () => { hover = null; draw(); });
    on('theme', () => ready && draw());
    on('lang', () => ready && draw());
    onFirstView(cv, () => { ready = true; sync(); });
  })();

  /* ── lab: Ulam spiral ─────────────────────────────── */
  (() => {
    const cv = $('#ulam-canvas');
    if (!cv) return;
    const nIn = $('#ulam-n'), nO = $('#ulam-n-o'), twinIn = $('#ulam-twin'), read = $('#ulam-read');
    const MAX = 301 * 301 + 2;
    const comp = new Uint8Array(MAX + 1);
    comp[0] = comp[1] = 1;
    for (let i = 2; i * i <= MAX; i++) if (!comp[i]) for (let j = i * i; j <= MAX; j += i) comp[j] = 1;
    const isP = k => !comp[k];
    const isTwin = k => isP(k) && (isP(k + 2) || (k > 2 && isP(k - 2)));

    let n = 0, xs = null, ys = null, grid = null, shown = 0, raf = 0, hoverK = 0, ready = false;
    const S = setupCanvas(cv, () => ready && draw());

    function build() {
      n = +nIn.value;
      const total = n * n, half = (n - 1) / 2;
      xs = new Int16Array(total + 1); ys = new Int16Array(total + 1); grid = new Int32Array(total);
      let x = 0, y = 0, k = 1, len = 1, d = 0;
      const DX = [1, 0, -1, 0], DY = [0, -1, 0, 1];
      const put = () => { xs[k] = x + half; ys[k] = y + half; grid[(y + half) * n + (x + half)] = k; };
      put();
      while (k < total) {
        for (let rep = 0; rep < 2 && k < total; rep++) {
          for (let i = 0; i < len && k < total; i++) { x += DX[d]; y += DY[d]; k++; put(); }
          d = (d + 1) % 4;
        }
        len++;
      }
      nO.textContent = n;
    }
    function geom() {
      const side = Math.min(S.w, S.h) - 12, cell = side / n;
      return { cell, ox: (S.w - side) / 2, oy: (S.h - side) / 2 };
    }
    function draw() {
      const { ctx, w } = S;
      if (!w || !n) return;
      const { cell, ox, oy } = geom(), twin = twinIn.checked, sz = Math.max(1, cell * 0.86);
      ctx.clearRect(0, 0, S.w, S.h);
      const cA = twin ? rgba(C.text, 0.22) : C.accent;
      for (let k = 2; k <= shown; k++) {
        if (!isP(k)) continue;
        ctx.fillStyle = twin && isTwin(k) ? C.accent2 : cA;
        ctx.fillRect(ox + xs[k] * cell, oy + ys[k] * cell, sz, sz);
      }
      // centre (1) marker
      ctx.strokeStyle = rgba(C.text, 0.5);
      ctx.strokeRect(ox + xs[1] * cell - 1.5, oy + ys[1] * cell - 1.5, cell + 3, cell + 3);
      if (hoverK) {
        const hx = ox + xs[hoverK] * cell, hy = oy + ys[hoverK] * cell, r = Math.max(4, cell * 1.4);
        ctx.strokeStyle = C.accent2;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx + cell / 2 - r, hy + cell / 2 - r, r * 2, r * 2);
        ctx.lineWidth = 1;
      }
      updateRead();
    }
    function updateRead() {
      const N = n * n;
      if (hoverK) {
        const f = factor(hoverK);
        const p = hoverK > 1 && f.length === 1 && f[0][1] === 1;
        read.innerHTML = `<span>n <b>${hoverK}</b></span>` + (hoverK === 1 ? `<span>${tl('merkez', 'centre')}</span>`
          : p ? `<span class="ok">${tl('asal ✓', 'prime ✓')}${isTwin(hoverK) ? ' · ' + tl('ikiz', 'twin') : ''}</span>` : `<span>= <b>${fmtFactors(f)}</b></span>`);
        return;
      }
      let pi = 0;
      for (let k = 2; k <= N; k++) if (isP(k)) pi++;
      read.innerHTML = `<span>N <b>${N.toLocaleString(LANG === 'en' ? 'en' : 'tr')}</b></span>` +
        `<span>π(N) <b>${pi.toLocaleString(LANG === 'en' ? 'en' : 'tr')}</b></span>` +
        `<span>N / ln N <b>${Math.round(N / Math.log(N)).toLocaleString(LANG === 'en' ? 'en' : 'tr')}</b></span>`;
    }
    function reveal() {
      cancelAnimationFrame(raf);
      build();
      const total = n * n;
      if (REDUCED) { shown = total; draw(); return; }
      shown = 1;
      const t0 = performance.now(), dur = 1400;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        shown = Math.max(1, Math.floor(total * p * p));
        draw();
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    let deb = 0;
    nIn.addEventListener('input', () => { nO.textContent = nIn.value; clearTimeout(deb); deb = setTimeout(reveal, 120); });
    twinIn.addEventListener('change', () => ready && draw());
    cv.addEventListener('pointermove', e => {
      if (!n) return;
      const { cell, ox, oy } = geom();
      const x = Math.floor((e.offsetX - ox) / cell), y = Math.floor((e.offsetY - oy) / cell);
      const k = x >= 0 && y >= 0 && x < n && y < n ? grid[y * n + x] : 0;
      if (k !== hoverK) { hoverK = k; draw(); }
    });
    cv.addEventListener('pointerleave', () => { hoverK = 0; if (ready) draw(); });
    on('theme', () => ready && draw());
    on('lang', () => ready && updateRead());
    onFirstView(cv, () => { ready = true; reveal(); });
  })();

  /* ── lab: n-queens backtracking ───────────────────── */
  (() => {
    const cv = $('#queens-canvas');
    if (!cv) return;
    const nIn = $('#queens-n'), nO = $('#queens-n-o'), spIn = $('#queens-speed'), nextBtn = $('#queens-next'), read = $('#queens-read');
    const TOTAL = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352, 10: 724, 11: 2680, 12: 14200 };
    const RATE = [3, 8, 25, 90, 400];
    let n = 8, cols = [], cur = null, gen = null, steps = 0, backs = 0, sols = 0, done = false, paused = false, raf = 0, ready = false;
    const S = setupCanvas(cv, () => ready && draw());

    const safe = (r, c) => cols.every((cc, rr) => cc !== c && Math.abs(cc - c) !== r - rr);
    function* solve(r) {
      if (r === n) { yield 'solution'; return; }
      for (let c = 0; c < n; c++) {
        cur = [r, c];
        yield 'try';
        if (!safe(r, c)) continue;
        cols.push(c);
        yield 'place';
        yield* solve(r + 1);
        cols.pop();
        backs++;
        cur = null;
        yield 'back';
      }
    }
    function geom() {
      const side = Math.min(S.w, S.h) - 16, sq = side / n;
      return { sq, ox: (S.w - side) / 2, oy: (S.h - side) / 2 };
    }
    function draw() {
      const { ctx, w, h } = S;
      if (!w) return;
      const { sq, ox, oy } = geom();
      ctx.clearRect(0, 0, w, h);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? C.sqA : C.sqB;
        ctx.fillRect(ox + x * sq, oy + y * sq, sq, sq);
        const hit = cols.some((c, r) => r !== y && (c === x || Math.abs(c - x) === Math.abs(r - y)));
        if (hit && y >= cols.length) { ctx.fillStyle = rgba(C.down, 0.16); ctx.fillRect(ox + x * sq, oy + y * sq, sq, sq); }
      }
      if (cur && !paused) {
        const [r, c] = cur, ok = r < cols.length ? cols[r] === c : safe(r, c);
        ctx.strokeStyle = ok ? C.up : C.down;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + c * sq + 2, oy + r * sq + 2, sq - 4, sq - 4);
        ctx.lineWidth = 1;
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${sq * 0.7}px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif`;
      ctx.fillStyle = paused ? C.accent : C.text;
      cols.forEach((c, r) => ctx.fillText('♛', ox + c * sq + sq / 2, oy + r * sq + sq / 2 + sq * 0.03));
      updateRead();
    }
    function updateRead() {
      read.innerHTML = `<span>${tl('adım', 'steps')} <b>${steps.toLocaleString()}</b></span>` +
        `<span>${tl('geri dönüş', 'backtracks')} <b>${backs.toLocaleString()}</b></span>` +
        `<span>${tl('çözüm', 'solutions')} <b class="${sols ? 'ok' : ''}">${sols}</b> / ${TOTAL[n]}</span>` +
        (done ? `<span class="ok">${tl('hepsi bulundu ✓', 'all found ✓')}</span>` : paused ? `<span class="ok">${tl('çözüm ✓', 'solved ✓')}</span>` : '');
    }
    // advance until the next solution (or the end); returns true on a solution
    function advance(budget) {
      for (let i = 0; i < budget; i++) {
        const r = gen.next();
        if (r.done) { done = true; cur = null; return false; }
        steps++;
        if (r.value === 'solution') { sols++; paused = true; return true; }
      }
      return false;
    }
    function run() {
      cancelAnimationFrame(raf);
      if (REDUCED) { advance(1e7); draw(); return; }
      let acc = 0, last = performance.now();
      const step = now => {
        acc += ((now - last) / 1000) * RATE[+spIn.value - 1];
        last = now;
        const k = Math.floor(acc);
        acc -= k;
        if (k) advance(k);
        draw();
        if (!paused && !done) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    function restart() {
      n = +nIn.value;
      nO.textContent = n;
      cols = []; cur = null; steps = backs = sols = 0; done = paused = false;
      gen = solve(0);
      run();
    }
    nIn.addEventListener('input', () => { nO.textContent = nIn.value; restart(); });
    nextBtn.addEventListener('click', () => {
      if (done) return restart();
      paused = false;
      run();
    });
    on('theme', () => ready && draw());
    on('lang', () => ready && updateRead());
    onFirstView(cv, () => { ready = true; restart(); });
  })();

  /* ── matrix rain ────────────────────────────────────── */
  function rain() {
    if (REDUCED) { toast(t('reduced')); return; }
    if ($('.matrix')) return;
    const cv = document.createElement('canvas');
    cv.className = 'matrix';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.scale(dpr, dpr);
    const fs = 16, cols = Math.ceil(w / fs);
    const drops = Array.from({ length: cols }, () => Math.random() * -50);
    const chars = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789$HTM'];
    ctx.fillStyle = `rgb(${C.bgRGB})`;
    ctx.fillRect(0, 0, w, h);
    let raf = 0, last = 0, ended = false;
    const t0 = performance.now();
    const end = () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      cv.classList.remove('on');
      removeEventListener('keydown', onKey);
      setTimeout(() => cv.remove(), 550);
    };
    const onKey = e => { if (e.key === 'Escape') end(); };
    const frame = now => {
      if (now - last > 42) {
        last = now;
        ctx.fillStyle = `rgba(${C.bgRGB}, 0.14)`;
        ctx.fillRect(0, 0, w, h);
        ctx.font = `${fs}px "JetBrains Mono", monospace`;
        for (let i = 0; i < cols; i++) {
          const y = drops[i] * fs;
          ctx.fillStyle = Math.random() < 0.04 ? '#FFFFFF' : C.winAccent;
          ctx.fillText(chars[(Math.random() * chars.length) | 0], i * fs, y);
          if (y > h && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      }
      if (now - t0 > 7000) return end();
      raf = requestAnimationFrame(frame);
    };
    cv.addEventListener('click', end);
    addEventListener('keydown', onKey);
    requestAnimationFrame(() => cv.classList.add('on'));
    raf = requestAnimationFrame(frame);
  }
  /* konami → matrix */
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let kpos = 0;
  addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase();
    kpos = k === KONAMI[kpos] ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kpos === KONAMI.length) { kpos = 0; rain(); }
  });

  /* ── terminal ────────────────────────────────────────── */
  (() => {
    const out = $('#term-out'), input = $('#term-in'), body = $('#term-body');
    if (!out) {
      /* other pages: "/" jumps to the terminal page */
      addEventListener('keydown', e => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const el = document.activeElement;
        if (el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)) return;
        e.preventDefault();
        location.href = '/terminal';
      });
      return;
    }
    if (FINE) setTimeout(() => input.focus({ preventScroll: true }), REDUCED ? 0 : 600);
    const loadedAt = Date.now();
    const hist = [];
    let hi = 0;

    const print = (html, cls = '') => {
      const d = document.createElement('div');
      d.className = 'tl ' + cls;
      d.innerHTML = html;
      out.appendChild(d);
      body.scrollTop = body.scrollHeight;
    };
    const lines = (arr, gap = 140) => arr.forEach(([html, cls], i) => setTimeout(() => print(html, cls), i * gap));
    const link = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${esc(label)}</a>`;
    const L = (tr, en) => (LANG === 'en' ? en : tr);

    const PROJ = [
      { k: 'debi', n: 'Debi', u: 'https://getdebi.com/', tr: 'restoranlar için yoğun saat yönetimi', en: 'rush-hour control for restaurants' },
      { k: 'nightjar', n: 'Nightjar', u: '/nightjar', tr: '2D gizlilik oyunu, tarayıcıda oyna', en: '2D stealth game, play in browser' },
      { k: 'chess', n: 'Pratik Satranç Analizi', u: 'https://pratiksatrancanaliz.getdebihook.com/', tr: 'hızlı satranç analizi', en: 'quick chess analysis' },
      { k: 'laftan', n: 'Laftan', u: 'https://laftan.vercel.app/', tr: 'karakterlerle AI sohbet', en: 'AI chat with characters' },
      { k: 'liman', n: 'Liman', u: 'https://liman-eosin.vercel.app/', tr: 'hâline uygun ayet, cihaz içinde', en: 'a verse for your mood, on-device' },
    ];
    const SOC = {
      github: 'https://github.com/bettercallhtm',
      x: 'https://x.com/bett3rcallhtm',
      instagram: 'https://www.instagram.com/hasahsinmeric/',
      linkedin: 'https://www.linkedin.com/in/hasan-tahsin-meri%C3%A7-51554b277/',
      youtube: 'https://www.youtube.com/@bettercallhtm',
    };
    const OPEN = {
      debi: PROJ[0].u, nightjar: PROJ[1].u, chess: PROJ[2].u, satranc: PROJ[2].u, laftan: PROJ[3].u, liman: PROJ[4].u,
      github: SOC.github, gh: SOC.github, x: SOC.x, twitter: SOC.x, instagram: SOC.instagram, ig: SOC.instagram,
      linkedin: SOC.linkedin, youtube: SOC.youtube, yt: SOC.youtube,
    };
    const PAGES = { '~': '/', portfoy: '/portfoy', lab: '/lab', terminal: '/terminal', hakkimda: '/hakkimda' };
    const PAGE_ALIAS = { home: '~', '..': '~', portfolio: 'portfoy', about: 'hakkimda', 'hakkımda': 'hakkimda', 'portföy': 'portfoy' };
    const MAIL = 'https://mail.google.com/mail/?view=cm&fs=1&to=bettercallhtm@gmail.com';

    const uptime = () => {
      const s = Math.floor((Date.now() - loadedAt) / 1000);
      return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    const cmds = {
      help() {
        const rows = [
          ['help', 'bu liste', 'this list'],
          ['whoami', 'kısaca ben', 'me, briefly'],
          ['neofetch', 'sistem bilgisi', 'system info'],
          ['projects', 'yayındaki ürünler', 'shipped products'],
          ['open <ad>', 'ürün/sosyal hesabı aç (ör. open debi)', 'open a product/social (e.g. open debi)'],
          ['socials', 'sosyal hesaplar', 'social accounts'],
          ['contact', 'iletişim', 'get in touch'],
          ['prime <n>', 'asallık testi + çarpanlar', 'primality test + factors'],
          ['ls · cat <dosya>', 'dosyalara göz at', 'browse files'],
          ['cd <sayfa>', 'sayfaya git (ör. cd lab)', 'go to a page (e.g. cd lab)'],
          ['theme · lang', 'dark/light · tr/en', 'dark/light · tr/en'],
          ['matrix', 'bilirsin', 'you know'],
          ['sudo hire-me', '👀', '👀'],
          ['clear', 'ekranı temizle', 'clear screen'],
        ];
        print(`<table>${rows.map(([c, tr, en]) => `<tr><td class="g">${esc(c)}</td><td class="dim">${esc(L(tr, en))}</td></tr>`).join('')}</table>`);
        print(L('ipucu: Tab tamamlar, ↑↓ geçmişte gezer.', 'tip: Tab completes, ↑↓ walks history.'), 'dim');
      },
      whoami() {
        print(`<span class="w">Hasan Tahsin Meriç</span> <span class="dim">(@bettercallhtm)</span>\n` + esc(L(
          "İstanbul'dan tek kişilik kurucu. İTÜ Elektronik & Haberleşme, son sınıf.\nProblemi görürüm, kodlarım, yayınlarım. Finans, sayılar teorisi ve satranç meraklısı.",
          'Solo founder from Istanbul. Senior in Electronics & Communication Eng. at ITU.\nI see a problem, I build it, I ship it. Into finance, number theory and chess.')));
      },
      neofetch() {
        const art = [
          '██╗  ██╗',
          '██║  ██║',
          '███████║',
          '██╔══██║',
          '██║  ██║',
          '╚═╝  ╚═╝',
        ].join('\n');
        const kv = [
          ['OS', L('İstanbul, TR · x86_merak', 'Istanbul, TR · x86_curiosity')],
          ['Host', L('İTÜ · Elektronik & Haberleşme (son sınıf)', 'ITU · Electronics & Comm. (senior)')],
          ['Kernel', `solo-founder 4.0 (${PROJ.length} shipped)`],
          ['Uptime', uptime()],
          ['Shell', 'htmsh 1.0'],
          ['Stack', 'TypeScript · React Native · Expo · Node · Python'],
          ['Interests', L('finans · trading · satranç · kod', 'finance · trading · chess · code')],
          ['Theme', currentTheme()],
        ];
        const info = `<span class="g">guest</span>@<span class="g">bettercallhtm</span>\n<span class="dim">-----------------------</span>\n` +
          kv.map(([k, v]) => `<span class="g">${k}</span>: ${esc(v)}`).join('\n') + '\n\n' +
          ['#FF5470', '#FFC857', '#3DFFA2', '#82AAFF', '#8F84FF', '#F45D9A'].map(c => `<span class="nf-swatch" style="background:${c}"></span>`).join('');
        print(`<div class="nf"><pre class="nf-art">${art}</pre><div>${info}</div></div>`);
      },
      projects() {
        print(PROJ.map((p, i) => `<span class="dim">${String(i + 1).padStart(2, '0')}</span>  ${link(p.u, p.n)}  <span class="dim">— ${esc(L(p.tr, p.en))}</span>`).join('\n'));
        print(L("→ 'open debi' gibi yazarak aç", "→ open one with e.g. 'open debi'"), 'dim');
      },
      open(args) {
        const key = (args[0] || '').toLowerCase();
        const url = OPEN[key];
        if (!url) return print(L(`kullanım: open <${Object.keys(OPEN).slice(0, 5).join('|')}|…>`, `usage: open <${Object.keys(OPEN).slice(0, 5).join('|')}|…>`), 'dim');
        window.open(url, '_blank', 'noopener');
        print(`${L('açılıyor', 'opening')} → ${link(url, url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}`);
      },
      socials() {
        print(Object.entries(SOC).map(([k, u]) => `<span class="g">${k.padEnd(10)}</span>${link(u, u.replace(/^https?:\/\/(www\.)?/, ''))}`).join('\n'));
      },
      contact() {
        print(`${L('e-posta', 'email')}: ${link(MAIL, 'bettercallhtm@gmail.com')}\n<span class="dim">${esc(L('Fikrin varsa yaz. Hızlı dönerim.', "Got an idea? Write me. I reply fast."))}</span>`);
      },
      prime(args) {
        const raw = args[0];
        const n = Number(raw);
        if (!raw || !Number.isInteger(n) || n < 1 || n > 1e12) return print(L('kullanım: prime <1 … 10¹² arası tam sayı>', 'usage: prime <integer between 1 and 10¹²>'), 'dim');
        if (n === 1) return print(L('1 ne asal ne bileşik. Özel bir sayı.', '1 is neither prime nor composite. Special.'));
        const f = factor(n);
        const isP = f.length === 1 && f[0][1] === 1;
        let msg = isP ? `<span class="w">${n}</span> <span class="g">${L('asal ✓', 'is prime ✓')}</span>` : `<span class="w">${n}</span> = <span class="y">${fmtFactors(f)}</span>`;
        const notes = [];
        if (n === 1729) notes.push(L('Hardy–Ramanujan sayısı: iki küpün toplamı olarak iki farklı şekilde yazılabilen en küçük sayı (1³+12³ = 9³+10³).', 'Hardy–Ramanujan number: smallest sum of two cubes in two different ways (1³+12³ = 9³+10³).'));
        if ([6, 28, 496, 8128, 33550336, 8589869056].includes(n)) notes.push(L('mükemmel sayı: bölenlerinin toplamı kendisine eşit.', 'perfect number: equals the sum of its divisors.'));
        if (isP && Number.isInteger(Math.log2(n + 1))) notes.push(L(`Mersenne asalı: 2^${Math.log2(n + 1)} − 1`, `Mersenne prime: 2^${Math.log2(n + 1)} − 1`));
        if (n === 42) notes.push(L('hayatın, evrenin ve her şeyin cevabı.', 'the answer to life, the universe and everything.'));
        if (n === 1337) notes.push('leet.');
        print(msg + (notes.length ? '\n<span class="c">' + esc(notes.join('\n')) + '</span>' : ''));
      },
      ls(args) {
        const all = args.includes('-a') || args.includes('-la');
        print(`${Object.keys(PAGES).filter(p => p !== '~').map(p => `<span class="c">${p}/</span>`).join('  ')}  about.txt  socials.json${all ? '  <span class="dim">.secrets</span>' : ''}`);
      },
      cat(args) {
        const f = (args[0] || '').replace(/^\.\//, '');
        if (!f) return print(L('kullanım: cat <dosya>', 'usage: cat <file>'), 'dim');
        if (f === 'about.txt') return print(esc(L(
          'Ben Hasan Tahsin Meriç. İTÜ Elektronik ve Haberleşme Mühendisliği\'nde son sınıf öğrencisiyim. Geri kalan zamanımda tek kişilik kurucu olarak uygulamalar geliştiriyorum. Beni ben yapan şey merak: sayılar teorisi, finans, blockchain, satranç.',
          'I\'m Hasan Tahsin Meriç, a senior in Electronics & Communication Engineering at ITU. The rest of the time I build apps as a solo founder. What defines me is curiosity: number theory, finance, blockchain, chess.')));
        if (f === 'socials.json') return print(esc(JSON.stringify(SOC, null, 2)));
        if (f === '.secrets') return print(L('nice try. 🔒', 'nice try. 🔒'), 'y');
        if (PAGES[f.replace(/\/$/, '')]) return print(`cat: ${esc(f)}: ${L(`bu bir dizin — cd ${esc(f)} yaz`, `is a directory — try cd ${esc(f)}`)}`, 'err');
        print(`cat: ${esc(f)}: ${L('böyle bir dosya yok', 'no such file')}`, 'err');
      },
      cd(args) {
        const want = (args[0] || '~').toLowerCase().replace(/^\.?\//, '').replace(/\/$/, '') || '~';
        const url = PAGES[want] || PAGES[PAGE_ALIAS[want]];
        if (!url) return print(`cd: ${esc(want)}: ${L('böyle bir dizin yok — ls dene', 'no such directory — try ls')}`, 'err');
        if (url === (location.pathname.replace(/\/$/, '') || '/')) return print(L('zaten buradasın.', "you're already here."), 'dim');
        print(`→ ${esc(url)}`, 'dim');
        setTimeout(() => { location.href = url; }, 250);
      },
      pwd() { print('/home/guest/bettercallhtm'); },
      stack() { print('TypeScript · JavaScript · React · React Native · Expo · Node.js · Python · C · Vercel · Netlify · Vitest'); },
      date() {
        print(new Intl.DateTimeFormat(LANG === 'en' ? 'en-GB' : 'tr-TR', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Europe/Istanbul' }).format(new Date()) + ' <span class="dim">(Europe/Istanbul)</span>');
      },
      echo(args, raw) { print(esc(raw.replace(/^\s*echo\s?/i, ''))); },
      history() { print(hist.map((h, i) => `<span class="dim">${String(i + 1).padStart(3)}</span>  ${esc(h)}`).join('\n') || '—'); },
      theme(args) {
        const want = args[0] === 'light' || args[0] === 'dark' ? args[0] : (currentTheme() === 'light' ? 'dark' : 'light');
        setTheme(want);
        print(`theme → <span class="g">${want}</span>`);
      },
      lang(args) {
        const want = args[0] === 'en' || args[0] === 'tr' ? args[0] : (LANG === 'tr' ? 'en' : 'tr');
        setLang(want);
        print(`lang → <span class="g">${want}</span>`);
      },
      matrix() { rain(); print(L('wake up, guest… (Esc ile çık)', 'wake up, guest… (Esc to exit)'), 'g'); },
      sudo(args) {
        if ((args[0] || '').toLowerCase() === 'hire-me') {
          return lines([
            [`[sudo] ${L('guest için parola', 'password for guest')}: ********`, 'dim'],
            [`<span class="g">✓</span> ${L('yetki verildi.', 'access granted.')}`],
            [`→ ${link(MAIL, 'bettercallhtm@gmail.com')}`],
            [`<span class="dim">${esc(L('Bir fikrin, bir işin ya da sadece bir sorun varsa — yaz.', 'Got an idea, a gig, or just a problem worth solving — write me.'))}</span>`],
          ], 380);
        }
        print(L('guest sudoers dosyasında yok. Bu olay raporlanacak. 👀', 'guest is not in the sudoers file. This incident will be reported. 👀'), 'err');
      },
      rm() { print(L('🙅 izin yok. burası production.', "🙅 permission denied. this is production."), 'err'); },
      exit() { print(L('Çıkış yok. Sadece ship var.', 'There is no exit. Only ship.'), 'y'); },
      vim() { print(L('vim açıldı. çıkmayı biliyor musun? (:q!) — şaka, açılmadı.', "vim opened. do you know how to exit? (:q!) — kidding, it didn't."), 'dim'); },
      coffee() { print('☕ 418 I\'m a teapot', 'y'); },
      hello() { print(L('selam! 👋 help yazarak başlayabilirsin.', 'hey! 👋 try help.')); },
      clear() { out.innerHTML = ''; },
    };
    const ALIAS = { '?': 'help', ls: 'ls', dir: 'ls', cls: 'clear', hi: 'hello', selam: 'hello', merhaba: 'hello', hire: 'contact', email: 'contact', mail: 'contact', chess: 'projects', whois: 'whoami', quit: 'exit', nvim: 'vim', emacs: 'vim' };
    const names = Object.keys(cmds).filter(k => !['rm', 'vim', 'coffee', 'hello', 'pwd', 'cd', 'exit'].includes(k));

    function run(raw) {
      const line = raw.trim();
      print(`<span class="t-ps">guest@htm:~$</span>${esc(line)}`);
      if (!line) return;
      hist.push(line);
      hi = hist.length;
      const [name, ...args] = line.split(/\s+/);
      let key = name.toLowerCase();
      key = ALIAS[key] || key;
      const fn = Object.prototype.hasOwnProperty.call(cmds, key) ? cmds[key] : null;
      if (fn) fn(args, line);
      else print(L(`htmsh: komut bulunamadı: ${esc(name)} — 'help' dene`, `htmsh: command not found: ${esc(name)} — try 'help'`), 'err');
    }

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { run(input.value); input.value = ''; }
      else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = hist[hi]; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') {
        if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ''; }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const v = input.value.trim().toLowerCase();
        if (!v || v.includes(' ')) return;
        const m = names.filter(k => k.startsWith(v));
        if (m.length === 1) input.value = m[0] + ' ';
        else if (m.length > 1) print(m.join('  '), 'dim');
      } else if (e.key.toLowerCase() === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    });
    body.addEventListener('click', e => {
      if (e.target.closest('a') || String(getSelection())) return;
      input.focus({ preventScroll: true });
    });
    $$('.term-chip').forEach(b => b.addEventListener('click', () => {
      run(b.dataset.cmd);
      if (FINE) input.focus({ preventScroll: true });
    }));

    /* "/" focuses the terminal from anywhere */
    addEventListener('keydown', e => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || document.activeElement.isContentEditable) return;
      e.preventDefault();
      $('#terminal').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => input.focus({ preventScroll: true }), REDUCED ? 0 : 450);
    });

    const welcome = () => {
      out.innerHTML = '';
      print(`<span class="w">htmsh 1.0</span> <span class="dim">— bettercallhtm</span>`);
      print(L("hoş geldin, guest. başlamak için <span class=\"g\">help</span> yaz.", "welcome, guest. type <span class=\"g\">help</span> to start."));
      print('');
    };
    welcome();
    on('lang', () => { if (!hist.length) welcome(); });
  })();

  /* ── video lightbox ──────────────────────────────────── */
  (() => {
    const lb = $('#lightbox');
    if (!lb) return;
    const frame = $('#lb-iframe'), video = $('#lb-video'), yt = $('#lb-yt');
    let opener = null;
    /* data-video = YouTube id, data-src = self-hosted mp4 */
    function openVideo(btn) {
      opener = btn;
      const id = btn.dataset.video;
      frame.hidden = !id;
      video.hidden = !!id;
      yt.hidden = !id;
      if (id) {
        frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
        yt.href = 'https://www.youtube.com/shorts/' + id;
      } else {
        video.src = btn.dataset.src;
        video.play().catch(() => {});
      }
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    }
    function closeVideo() {
      lb.hidden = true;
      frame.src = '';
      video.pause();
      video.removeAttribute('src');
      video.load();
      document.body.style.overflow = '';
      opener && opener.focus();
    }
    $$('.card-video[data-video], .card-video[data-src]').forEach(btn => btn.addEventListener('click', () => openVideo(btn)));
    $$('[data-close]', lb).forEach(el => el.addEventListener('click', closeVideo));
    addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeVideo(); });
  })();

  /* ── footer clock ────────────────────────────────────── */
  (() => {
    const el = $('#clock');
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  })();

  /* ── for the people who open devtools ────────────────── */
  console.log(
    '%c bettercallhtm %c kaynağa bakan insanı severim → bettercallhtm@gmail.com  ·  psst: sayfada "/" tuşuna bas.',
    'background:#3DFFA2;color:#03140B;font-weight:700;padding:4px 8px;border-radius:4px',
    'color:#8C95A5;padding-left:6px'
  );
})();

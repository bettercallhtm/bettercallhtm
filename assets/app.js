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
      accent: g('accent'), accent2: g('accent-2'), down: g('down'), warn: g('warn'),
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

  /* rAF loop that only runs while `el` is on screen and the tab is visible */
  function loop(el, frame) {
    let raf = 0, last = 0, visible = false;
    const tick = t => {
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      frame(t, dt);
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (visible && !document.hidden) { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
      else { cancelAnimationFrame(raf); raf = 0; }
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(el);
    document.addEventListener('visibilitychange', sync);
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
      roles: ['tek kişilik kurucu', 'ship > talk', 'finans & trading meraklısı', 'yazar, derler, ship eder', 'satranç bağımlısı', 'İTÜ EHB · son sınıf'],
      gbmAxis: ['0', '6 ay', '1 yıl'],
      gbmDist: 'dağılım',
      knightRead: (n, s) => `hamle <b>${n}</b>/64 · başlangıç <b>${s}</b>`,
      knightDone: 'tur tamam ✓',
      reduced: 'Hareket azaltma açık — animasyon pas geçildi',
      bootSkip: 'geçmek için tıkla',
    },
    en: {
      roles: ['solo founder', 'ship > talk', 'finance & trading nerd', 'writes, compiles, ships', 'chess addict', 'ITU ECE · senior'],
      gbmAxis: ['0', '6 mo', '1 yr'],
      gbmDist: 'distribution',
      knightRead: (n, s) => `move <b>${n}</b>/64 · start <b>${s}</b>`,
      knightDone: 'tour complete ✓',
      reduced: 'Reduced motion is on — animation skipped',
      bootSkip: 'click to skip',
    },
  };
  let LANG = 'tr';
  const t = k => (T[LANG][k] !== undefined ? T[LANG][k] : T.tr[k]);

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
  const themeBtn = $('#theme-switch');
  function setTheme(th) {
    if (th === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('theme', th); } catch (e) {}
    themeBtn.setAttribute('aria-checked', String(th !== 'light'));
    readColors();
    $('meta[name="theme-color"]').setAttribute('content', C.bg);
    emit('theme');
  }
  const currentTheme = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  themeBtn.setAttribute('aria-checked', String(currentTheme() === 'dark'));
  themeBtn.addEventListener('click', () => setTheme(currentTheme() === 'light' ? 'dark' : 'light'));

  /* ── boot sequence ───────────────────────────────────── */
  const booted = new Promise(resolve => {
    if (!root.classList.contains('booting')) return resolve();
    const lines = [
      ['ok', 'bettercallhtm bios v2026.9'],
      ['ok', 'mounting /dev/curiosity'],
      ['ok', 'loading modules: finance · math · chess · code'],
      ['ok', 'warming up the candlestick chart'],
      ['ok', 'compiling ego… 0 warnings'],
      ['go', '> ACCESS GRANTED'],
    ];
    const el = document.createElement('div');
    el.className = 'boot';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="boot-box"><pre class="boot-log"></pre><div class="boot-bar"><span></span></div><div class="boot-skip">${esc(t('bootSkip'))}</div></div>`;
    document.body.appendChild(el);
    root.classList.remove('booting');
    const log = $('.boot-log', el), bar = $('.boot-bar span', el);
    let i = 0, finished = false, timer = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { sessionStorage.setItem('booted', '1'); } catch (e) {}
      el.classList.add('done');
      setTimeout(() => el.remove(), 600);
      resolve();
    };
    const next = () => {
      if (i >= lines.length) { timer = setTimeout(finish, 320); return; }
      const [k, txt] = lines[i++];
      log.innerHTML += k === 'ok'
        ? `<span class="ok">[  OK  ]</span> ${esc(txt)}\n`
        : `\n<span class="go">${esc(txt)}</span>`;
      bar.style.transform = `scaleX(${i / lines.length})`;
      timer = setTimeout(next, 150 + Math.random() * 90);
    };
    el.addEventListener('click', finish);
    addEventListener('keydown', finish, { once: true });
    next();
  });

  /* ── header: scroll progress + active link ───────────── */
  const progress = $('#progress');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav-links a');
  const secIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['projects', 'stack', 'lab', 'terminal', 'about'].forEach(id => { const s = document.getElementById(id); s && secIO.observe(s); });

  /* ── reveal on scroll ────────────────────────────────── */
  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    if (REDUCED) { el.textContent = target; return; }
    const t0 = performance.now(), dur = 1300;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const revIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      revIO.unobserve(el);
      el.classList.add('in');
      $$('[data-count]', el).forEach(countUp);
      const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
      setTimeout(() => el.classList.add('settled'), 950 + d);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.rv').forEach(el => revIO.observe(el));

  /* ── hero: headline decode ───────────────────────────── */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&01ΣΔλ';
  function decode(el, text, dur = 1200) {
    if (REDUCED) { el.textContent = text; return; }
    cancelAnimationFrame(el._dec);
    const chars = [...text].map(ch => ({ ch, end: dur * (0.25 + Math.random() * 0.75) }));
    const t0 = performance.now();
    const step = now => {
      const el_t = now - t0;
      let out = '', done = true;
      for (const c of chars) {
        if (c.ch === ' ' || el_t >= c.end) out += c.ch;
        else { done = false; out += GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
      }
      el.textContent = out;
      if (!done) el._dec = requestAnimationFrame(step);
    };
    el._dec = requestAnimationFrame(step);
  }
  const headline = $('#headline');
  const headText = () => (LANG === 'en' ? headline.dataset.en : headline.dataset.tr);
  booted.then(() => decode(headline, headText()));
  on('lang', () => decode(headline, headText(), 700));

  /* ── hero: typed roles ───────────────────────────────── */
  (() => {
    const el = $('#typed');
    if (REDUCED) { el.textContent = t('roles')[0]; on('lang', () => { el.textContent = t('roles')[0]; }); return; }
    let idx = 0, pos = 0, deleting = false, timer = 0;
    const run = () => {
      const roles = t('roles');
      const word = roles[idx % roles.length];
      if (!deleting) {
        pos++;
        el.textContent = word.slice(0, pos);
        if (pos >= word.length) { deleting = true; timer = setTimeout(run, 1700); return; }
        timer = setTimeout(run, 55 + Math.random() * 45);
      } else {
        pos--;
        el.textContent = word.slice(0, pos);
        if (pos <= 0) { deleting = false; idx++; timer = setTimeout(run, 280); return; }
        timer = setTimeout(run, 28);
      }
    };
    el.textContent = '';
    booted.then(() => { timer = setTimeout(run, 500); });
    on('lang', () => { clearTimeout(timer); idx = 0; pos = 0; deleting = false; el.textContent = ''; timer = setTimeout(run, 200); });
  })();

  /* ── hero: typed config file ─────────────────────────── */
  (() => {
    const el = $('#code');
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
      prop('shipped', o('['), ...arr('Debi', 'Laftan', 'Liman', 'Chess'), o(']')),
      prop('stack', o('['), ...arr('TS', 'React Native', 'Node', 'Python'), o(']')),
      prop('into', o('['), ...arr('finance', 'number theory', 'chess'), o(']')),
      L(o('  '), ['f', 'ship'], o(': () => '), ['v', 'idea'], o('.'), ['f', 'build'], o('().'), ['f', 'launch'], o('(),')),
      L(o('} '), ['k', 'as const'], o(';')),
    ];
    const total = CODE.reduce((n, line) => n + line.reduce((m, [, x]) => m + x.length, 0) + 1, 0);
    function render(count) {
      let left = count, html = '';
      for (let li = 0; li < CODE.length; li++) {
        if (left <= 0) break;
        let line = '';
        for (const [cls, txt] of CODE[li]) {
          if (left <= 0) break;
          const part = txt.slice(0, left);
          left -= part.length;
          line += `<span class="t-${cls}">${esc(part)}</span>`;
        }
        left -= 1; // newline
        html += `<span class="ln">${li + 1}</span>${line}${left <= 0 || li === CODE.length - 1 ? '<span class="code-caret"></span>' : ''}\n`;
      }
      el.innerHTML = html;
    }
    if (REDUCED) { render(total); return; }
    render(0);
    booted.then(() => {
      const t0 = performance.now() + 250;
      const step = now => {
        const n = Math.max(0, Math.floor((now - t0) * 0.16));
        render(Math.min(n, total));
        if (n < total) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  })();

  /* ── hero: live candlestick chart ────────────────────── */
  (() => {
    const canvas = $('#hero-canvas');
    const hero = $('.hero');
    const STEP = 13, BODY = 7, PAD_R = 92, SPEED = STEP / 950;
    let candles = [], offset = 0, anchor = 142, yMin = 0, yMax = 0, mouse = null;
    let target = 0, lastJitter = 0;

    function makeCandle(o) {
      anchor *= 1.00015;
      const vol = 0.011;
      const drift = 0.0006 + ((anchor - o) / anchor) * 0.05;
      const c = o * Math.exp(drift + vol * gauss());
      const h = Math.max(o, c) * (1 + Math.abs(gauss()) * vol * 0.45);
      const l = Math.min(o, c) * (1 - Math.abs(gauss()) * vol * 0.45);
      return { o, h, l, c, v: 0.25 + Math.random() * 0.75 };
    }
    function fill(w) {
      const need = Math.ceil(w / STEP) + 4;
      if (!candles.length) candles.push(makeCandle(142));
      while (candles.length < need) candles.unshift(makeCandle(candles[0].o * Math.exp(-0.0006 + 0.009 * gauss())));
      while (candles.length > need) candles.shift();
      // rebuild continuity from the left so open = previous close
      for (let i = 1; i < candles.length; i++) {
        const cd = candles[i], k = candles[i - 1].c / cd.o;
        cd.o *= k; cd.c *= k; cd.h *= k; cd.l *= k;
      }
      const last = candles[candles.length - 1];
      target = last.c;
      const vis = candles.slice(-need);
      yMin = Math.min(...vis.map(c => c.l));
      yMax = Math.max(...vis.map(c => c.h));
    }
    const S = setupCanvas(canvas, s => { if (!candles.length || s.w / STEP + 4 > candles.length) fill(s.w); draw(); });

    function draw() {
      const { ctx, w, h } = S;
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      const top = h * 0.28, bot = h * 0.86, volTop = h * 0.9, volBot = h;
      const n = candles.length;
      const X = i => w - PAD_R - (n - 1 - i) * STEP - offset;
      const range = yMax - yMin || 1;
      const Y = p => top + (1 - (p - yMin) / range) * (bot - top);

      // grid
      ctx.strokeStyle = rgba(C.text, 0.05);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gy = top; gy <= bot + 1; gy += (bot - top) / 5) { ctx.moveTo(0, Math.round(gy) + 0.5); ctx.lineTo(w, Math.round(gy) + 0.5); }
      for (let gx = w - PAD_R; gx > 0; gx -= STEP * 10) { ctx.moveTo(Math.round(gx - offset) + 0.5, top - 30); ctx.lineTo(Math.round(gx - offset) + 0.5, volBot); }
      ctx.stroke();

      // candles + volume
      for (let i = 0; i < n; i++) {
        const c = candles[i], x = X(i);
        if (x < -STEP || x > w) continue;
        const up = c.c >= c.o, col = up ? C.accent : C.down;
        ctx.strokeStyle = col;
        ctx.fillStyle = up ? rgba(col, 0.85) : col;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, Y(c.h));
        ctx.lineTo(Math.round(x) + 0.5, Y(c.l));
        ctx.stroke();
        const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
        ctx.fillRect(Math.round(x - BODY / 2), y1, BODY, Math.max(1, y2 - y1));
        ctx.fillStyle = rgba(col, 0.22);
        const vh = (volBot - volTop) * c.v;
        ctx.fillRect(Math.round(x - BODY / 2), volBot - vh, BODY, vh);
      }

      // SMA 20
      ctx.strokeStyle = rgba(C.accent2, 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let started = false, sum = 0;
      for (let i = 0; i < n; i++) {
        sum += candles[i].c;
        if (i >= 20) sum -= candles[i - 20].c;
        if (i < 19) continue;
        const x = X(i), y = Y(sum / 20);
        started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        started = true;
      }
      ctx.stroke();

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';

      // last price line + tag
      const last = candles[n - 1];
      const ly = Y(last.c), lup = last.c >= last.o;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(lup ? C.accent : C.down, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w - PAD_R + 10, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lup ? C.accent : C.down;
      ctx.fillRect(w - PAD_R + 12, ly - 10, 74, 20);
      ctx.fillStyle = C.bg;
      ctx.fillText(last.c.toFixed(2), w - PAD_R + 17, ly + 0.5);

      // crosshair
      if (mouse) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = rgba(C.text, 0.35);
        ctx.beginPath();
        ctx.moveTo(0, mouse.y); ctx.lineTo(w, mouse.y);
        ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, h);
        ctx.stroke();
        ctx.setLineDash([]);
        const price = yMin + (1 - (mouse.y - top) / (bot - top)) * range;
        ctx.fillStyle = C.text;
        ctx.fillRect(w - PAD_R + 12, mouse.y - 10, 74, 20);
        ctx.fillStyle = C.bg;
        ctx.fillText(price.toFixed(2), w - PAD_R + 17, mouse.y + 0.5);
      }
    }

    function frame(now, dt) {
      if (!candles.length) return;
      const last = candles[candles.length - 1];
      // live candle jitters toward a moving target
      if (now - lastJitter > 220) {
        lastJitter = now;
        target = last.c * Math.exp(0.0002 + 0.0035 * gauss());
      }
      last.c += (target - last.c) * 0.12;
      last.h = Math.max(last.h, last.c);
      last.l = Math.min(last.l, last.c);
      last.v = Math.min(1, last.v + dt * 0.0002);

      offset += dt * SPEED;
      if (offset >= STEP) {
        offset -= STEP;
        candles.shift();
        const nc = makeCandle(last.c);
        nc.h = nc.l = nc.c = nc.o;
        nc.v = 0.1;
        candles.push(nc);
        target = nc.o;
      }
      // smooth autoscale
      let lo = Infinity, hi = -Infinity;
      for (const c of candles) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; }
      const pad = (hi - lo) * 0.08;
      yMin += (lo - pad - yMin) * 0.06;
      yMax += (hi + pad - yMax) * 0.06;
      draw();
    }

    if (FINE) {
      hero.addEventListener('pointermove', e => {
        const r = canvas.getBoundingClientRect();
        mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      });
      hero.addEventListener('pointerleave', () => { mouse = null; });
    }
    on('theme', draw);
    if (REDUCED) { draw(); return; }
    loop(canvas, frame);
  })();

  /* ── portfolio: per-product live viz, tilt, spotlight ── */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const MONO = px => `${px}px "JetBrains Mono", monospace`;

  const VIZ = {
    /* Debi: order load from three platforms vs kitchen capacity.
       Above the line, Debi holds orders back (outlined = throttled). */
    debi(S, color) {
      const CW = 6, STEP = 8, CAP = 0.6;
      const PLAT = ['#06C167', '#FA0050', '#8B6CF6'];
      const cols = [];
      let ph = 0, tt = Math.random() * 6;
      const gen = () => {
        tt += 0.07;
        const rush = 0.26 + 0.64 * Math.pow(Math.max(0, Math.sin(tt * 0.45)), 2) + 0.1 * Math.random();
        const a = 0.5 + Math.random(), b = 0.5 + Math.random(), c = 0.5 + Math.random(), s = a + b + c;
        return [rush * a / s, rush * b / s, rush * c / s];
      };
      return (dt, now) => {
        const { ctx, w, h } = S;
        if (!w) return;
        const need = Math.ceil(w / STEP) + 2;
        if (!cols.length) for (let i = 0; i < need; i++) cols.push(gen());
        while (cols.length < need) cols.unshift(gen());
        ph += dt / 170;
        while (ph >= 1) { ph -= 1; cols.shift(); cols.push(gen()); }
        ctx.clearRect(0, 0, w, h);
        const top = 16, base = h - 1, H = base - top;
        const n = cols.length, capY = Math.round(base - CAP * H) + 0.5;
        ctx.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          const x = Math.round(w - (n - 1 - i + ph) * STEP - CW);
          if (x < -CW) continue;
          let acc = 0;
          for (let k = 0; k < 3; k++) {
            const lo = acc, hi = acc + cols[i][k];
            acc = hi;
            const served = Math.min(hi, CAP);
            if (served > lo) {
              ctx.fillStyle = rgba(PLAT[k], 0.85);
              ctx.fillRect(x, base - served * H, CW, (served - lo) * H);
            }
            const tLo = Math.max(lo, CAP);
            if (hi > tLo) {
              ctx.strokeStyle = rgba(PLAT[k], 0.5);
              ctx.strokeRect(x + 0.5, base - hi * H + 0.5, CW - 1, Math.max(0, (hi - tLo) * H - 1));
            }
          }
        }
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = rgba(color, 0.8);
        ctx.beginPath(); ctx.moveTo(0, capY); ctx.lineTo(w, capY); ctx.stroke();
        ctx.setLineDash([]);
        const last = cols[n - 1], total = last[0] + last[1] + last[2], on = total > CAP;
        ctx.font = MONO(9.5);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = on ? rgba(color, 0.65 + 0.35 * Math.sin(now / 140)) : C.textDim;
        ctx.fillText(on ? '● THROTTLE ON' : '○ FLOW OK', 0, 0);
        ctx.textAlign = 'right';
        ctx.fillStyle = C.textDim;
        ctx.fillText(`load ${Math.round((total / CAP) * 100)}%`, w, 0);
      };
    },

    /* Chess: engine evaluation graph, lichess style; red dots = blunders */
    chess(S, color) {
      const N = 64, pts = [], marks = [];
      let e = 0.3, ph = 0;
      const gen = () => {
        e = e * 0.985 + gauss() * 0.42;
        let m = 0;
        if (Math.random() < 0.035) { e += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3); m = 1; }
        e = clamp(e, -9, 9);
        return [e, m];
      };
      for (let i = 0; i < N; i++) { const [v, m] = gen(); pts.push(v); marks.push(m); }
      let nxt = gen();
      return dt => {
        const { ctx, w, h } = S;
        if (!w) return;
        ph += dt / 420;
        while (ph >= 1) { ph -= 1; pts.shift(); marks.shift(); pts.push(nxt[0]); marks.push(nxt[1]); nxt = gen(); }
        ctx.clearRect(0, 0, w, h);
        const top = 16, mid = top + (h - top) / 2, amp = (h - top) / 2 - 3;
        const Wd = w - 6, stepX = Wd / (N - 1);
        const X = i => Wd - (N - 1 - i + ph) * stepX;
        const Y = v => mid - Math.tanh(v / 3) * amp;
        const live = pts[N - 1] + (nxt[0] - pts[N - 1]) * ph;
        const line = new Path2D();
        line.moveTo(X(0), Y(pts[0]));
        for (let i = 1; i < N; i++) line.lineTo(X(i), Y(pts[i]));
        line.lineTo(Wd, Y(live));
        const area = new Path2D(line);
        area.lineTo(Wd, mid); area.lineTo(X(0), mid); area.closePath();
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, mid); ctx.clip();
        ctx.fillStyle = rgba(C.text, 0.15); ctx.fill(area); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0, mid, w, h - mid); ctx.clip();
        ctx.fillStyle = rgba(color, 0.22); ctx.fill(area); ctx.restore();
        ctx.strokeStyle = rgba(C.text, 0.15);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, Math.round(mid) + 0.5); ctx.lineTo(w, Math.round(mid) + 0.5); ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.stroke(line);
        ctx.fillStyle = C.down;
        for (let i = 0; i < N; i++) if (marks[i]) { ctx.beginPath(); ctx.arc(X(i), Y(pts[i]), 2.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(Wd, Y(live), 3, 0, Math.PI * 2); ctx.fill();
        ctx.font = MONO(9.5);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = C.textMuted;
        ctx.fillText(`eval ${live >= 0 ? '+' : '−'}${Math.abs(live).toFixed(1)}`, 0, 0);
        ctx.textAlign = 'right';
        ctx.fillStyle = C.textDim;
        ctx.fillText('● ?? blunder', w, 0);
      };
    },

    /* Laftan: a conversation that keeps going — character on the left */
    laftan(S, color) {
      const ROW = 19, BH = 14;
      const bubbles = [];
      let scroll = 0, timer = 500, typing = false;
      const add = (side, fromTyping) => {
        bubbles.push({ side, w: 0.26 + Math.random() * 0.36, lines: Math.random() < 0.5 ? 1 : 2, a: 0 });
        if (!fromTyping) scroll += ROW;
      };
      add(1); add(0); add(1);
      scroll = 0;
      return (dt, now) => {
        const { ctx, w, h } = S;
        if (!w) return;
        timer -= dt;
        if (timer <= 0) {
          const last = bubbles[bubbles.length - 1];
          if (typing) { typing = false; add(0, true); timer = 1100 + Math.random() * 900; }
          else if (last.side === 1 || Math.random() < 0.3) { typing = true; scroll += ROW; timer = 900 + Math.random() * 500; }
          else { add(1); timer = 900 + Math.random() * 700; }
        }
        scroll += (0 - scroll) * Math.min(1, dt * 0.012);
        ctx.clearRect(0, 0, w, h);
        const y0 = h - 2 - BH;
        let idx = 0;
        if (typing) {
          const y = y0 + scroll;
          ctx.fillStyle = rgba(color, 0.22);
          rr(ctx, 0, y, 38, BH, 7); ctx.fill();
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = rgba(color, 0.9);
            ctx.beginPath();
            ctx.arc(11 + k * 8, y + BH / 2 - Math.max(0, Math.sin(now / 160 - k * 0.8)) * 2.5, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          idx = 1;
        }
        for (let i = bubbles.length - 1; i >= 0; i--, idx++) {
          const b = bubbles[i];
          const y = y0 - idx * ROW + scroll;
          if (y < -BH) { bubbles.splice(0, i + 1); break; }
          b.a = Math.min(1, b.a + dt / 240);
          const bw = Math.max(40, b.w * w) * (0.85 + 0.15 * b.a), x = b.side ? w - bw : 0;
          ctx.globalAlpha = b.a;
          ctx.fillStyle = b.side ? rgba(C.text, 0.1) : rgba(color, 0.85);
          rr(ctx, x, y, bw, BH, 7); ctx.fill();
          ctx.fillStyle = b.side ? rgba(C.text, 0.35) : 'rgba(255,255,255,0.7)';
          ctx.fillRect(x + 8, y + BH / 2 - 1, (bw - 16) * (b.lines === 2 ? 0.8 : 0.55), 2);
          ctx.globalAlpha = 1;
        }
      };
    },

    /* Liman: harbour at night — crescent, stars, calm water */
    liman(S, color) {
      let t = Math.random() * 100;
      const stars = Array.from({ length: 16 }, () => [Math.random(), Math.random() * 0.42, Math.random() * 6]);
      const waves = [
        { amp: 4.5, k: 0.032, s: 0.8, base: 0.6, a: 0.14 },
        { amp: 3.5, k: 0.05, s: -1.1, base: 0.72, a: 0.22 },
        { amp: 2.6, k: 0.075, s: 1.5, base: 0.84, a: 0.36 },
      ];
      return dt => {
        const { ctx, w, h } = S;
        if (!w) return;
        t += dt / 1000;
        ctx.clearRect(0, 0, w, h);
        const mx = w - 30, my = 15, r = 9;
        // moon: disc minus offset disc = crescent
        ctx.save();
        ctx.shadowColor = color; ctx.shadowBlur = 16;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(mx + 4.6, my - 2.4, r * 0.86, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        for (const [sx, sy, p] of stars) {
          if (Math.abs(sx * w - mx) < 16 && sy * h < 30) continue;
          ctx.fillStyle = rgba(C.text, 0.15 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.7 + p)));
          ctx.fillRect(sx * w, sy * h, 1.6, 1.6);
        }
        for (const wv of waves) {
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w + 4; x += 4) {
            const y = wv.base * h + wv.amp * Math.sin(x * wv.k + t * wv.s) + wv.amp * 0.45 * Math.sin(x * wv.k * 2.3 - t * wv.s * 0.7);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h); ctx.closePath();
          ctx.fillStyle = rgba(color, wv.a);
          ctx.fill();
        }
        // moonlight on the water
        for (let i = 0; i < 5; i++) {
          const y = h * (0.64 + i * 0.07), len = 14 - i * 1.5 + Math.sin(t * 2 + i) * 3;
          ctx.fillStyle = rgba(color, 0.55 - i * 0.08);
          ctx.fillRect(mx - len / 2 + Math.sin(t * 1.3 + i * 2) * 2, y, len, 1.5);
        }
      };
    },
  };

  $$('.card').forEach(card => {
    const cv = $('.viz', card);
    if (cv && VIZ[cv.dataset.viz]) {
      const color = getComputedStyle(card).getPropertyValue('--c').trim() || C.accent;
      let render = null;
      const S = setupCanvas(cv, () => render && render(0, performance.now()));
      render = VIZ[cv.dataset.viz](S, color);
      if (REDUCED) { render(16, 0); on('theme', () => render(0, 0)); }
      else loop(cv, (now, dt) => render(dt, now));
    }

    if (FINE && !REDUCED) {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        if (card.classList.contains('settled')) {
          card.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * 5).toFixed(2)}deg) rotateY(${((px - 0.5) * 6).toFixed(2)}deg) translateY(-4px)`;
        }
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    }
  });

  /* magnetic buttons */
  if (FINE && !REDUCED) {
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

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
        ctx.strokeStyle = rgba(p[STEPS] > S0 ? C.accent : C.down, 0.3);
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
      ctx.strokeStyle = C.accent2;
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
          ctx.fillStyle = rgba(center > S0 ? C.accent : C.down, 0.7 * a);
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
      ctx.shadowColor = C.accent; ctx.shadowBlur = 14;
      ctx.fillStyle = C.text;
      ctx.fillText('♞', cx(cur), cy(cur) + sq * 0.03);
      ctx.shadowBlur = 0;
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
          ctx.fillStyle = Math.random() < 0.04 ? '#FFFFFF' : C.accent;
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
    if (!out) return;
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
      debi: PROJ[0].u, chess: PROJ[1].u, satranc: PROJ[1].u, laftan: PROJ[2].u, liman: PROJ[3].u,
      github: SOC.github, gh: SOC.github, x: SOC.x, twitter: SOC.x, instagram: SOC.instagram, ig: SOC.instagram,
      linkedin: SOC.linkedin, youtube: SOC.youtube, yt: SOC.youtube,
    };
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
        print(`<span class="c">projects/</span>  about.txt  socials.json${all ? '  <span class="dim">.secrets</span>' : ''}`);
      },
      cat(args) {
        const f = (args[0] || '').replace(/^\.\//, '');
        if (!f) return print(L('kullanım: cat <dosya>', 'usage: cat <file>'), 'dim');
        if (f === 'about.txt') return print(esc(L($('#about .about-text').dataset.tr, $('#about .about-text').dataset.en)));
        if (f === 'socials.json') return print(esc(JSON.stringify(SOC, null, 2)));
        if (f === '.secrets') return print(L('nice try. 🔒', 'nice try. 🔒'), 'y');
        if (f.startsWith('projects')) return print(`cat: ${esc(f)}: ${L('bu bir dizin — projects yaz', "is a directory — try 'projects'")}`, 'err');
        print(`cat: ${esc(f)}: ${L('böyle bir dosya yok', 'no such file')}`, 'err');
      },
      cd() { print(L('gidecek yer yok. zaten evdesin.', "nowhere to go. you're already home."), 'dim'); },
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

  /* ── cursor ring ─────────────────────────────────────── */
  if (FINE && !REDUCED) {
    const ring = document.createElement('div');
    ring.className = 'cursor';
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    let x = -100, y = -100, tx = -100, ty = -100;
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      ring.classList.add('on');
      ring.classList.toggle('big', !!e.target.closest('a, button, input, canvas, .card-video, .term-body'));
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => ring.classList.remove('on'));
    const tick = () => {
      x += (tx - x) * 0.2; y += (ty - y) * 0.2;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── video lightbox ──────────────────────────────────── */
  (() => {
    const lb = $('#lightbox'), frame = $('#lb-iframe'), yt = $('#lb-yt');
    let opener = null;
    function openVideo(id, btn) {
      opener = btn;
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      yt.href = 'https://www.youtube.com/shorts/' + id;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    }
    function closeVideo() {
      lb.hidden = true;
      frame.src = '';
      document.body.style.overflow = '';
      opener && opener.focus();
    }
    $$('.card-video[data-video]').forEach(btn => btn.addEventListener('click', () => openVideo(btn.dataset.video, btn)));
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

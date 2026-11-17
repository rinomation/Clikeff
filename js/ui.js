/* =========================================================
   קליקרים — כלים משותפים לממשק
   ========================================================= */
window.App = window.App || {};

(function (A) {
  'use strict';

  A.$ = (sel, root) => (root || document).querySelector(sel);
  A.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** בריחה מ-HTML: כל טקסט שמגיע ממשתמש או מקובץ עובר דרך כאן */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  A.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  A.fmt = (n) => Number(n || 0).toLocaleString('he-IL');

  /* ---------- אחסון מקומי בטוח ---------- */
  A.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('clickers.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('clickers.' + key, JSON.stringify(value)); } catch (e) { /* פרטי/חסום */ }
    },
    del(key) {
      try { localStorage.removeItem('clickers.' + key); } catch (e) { /* */ }
    }
  };

  /* ---------- איורים ---------- */
  A.img = (name) => 'assets/emoji/' + name + '.png';

  /** דמויות לבחירה (Fluent Emoji 3D, רישיון MIT) */
  A.AVATARS = [
    'fox', 'unicorn', 'lion', 'penguin', 'owl', 'cat_face',
    'dog_face', 'rabbit_face', 'monkey_face', 'bear', 'koala', 'frog',
    'giraffe', 'hamster', 'turtle', 'dolphin', 'octopus', 'butterfly',
    'lady_beetle', 'honeybee', 'parrot', 'hatching_chick', 'tropical_fish', 'robot'
  ];
  A.safeAvatar = (name) => (A.AVATARS.indexOf(name) >= 0 ? name : 'fox');
  A.avatarHTML = (name, cls) =>
    '<span class="avatar ' + (cls || '') + '"><img src="' + A.img(A.safeAvatar(name)) + '" alt="" loading="lazy"></span>';

  /* ---------- אייקונים (SVG) ---------- */
  const P = {
    volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    shrink: '<path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/>',
    next: '<path d="m15 18-6-6 6-6"/>',          /* חץ שמאלה — "הבאה" ב-RTL */
    prev: '<path d="m9 18 6-6-6-6"/>',           /* חץ ימינה — "הקודמת" ב-RTL */
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    door: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.6v16.1a.5.5 0 0 1-.6.5L5 19V5.6a1 1 0 0 1 .8-1L12.4 3a.5.5 0 0 1 .6.5z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    kick: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="m17 8 5 5M22 8l-5 5"/>',
    wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.6"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 4.6"/><path d="M12 20h.01"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    alert: '<path d="m10.3 3.9-8.4 14.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.5 2 2 2 3.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>'
  };
  A.icon = (name, cls) =>
    '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';

  /* ---------- צורות לכפתורי תשובה ---------- */
  const SHAPES = [
    '<path d="M12 3 22 20H2z"/>',                                   /* משולש */
    '<path d="M12 2 22 12 12 22 2 12z"/>',                          /* מעוין */
    '<circle cx="12" cy="12" r="10"/>',                             /* עיגול */
    '<rect x="3" y="3" width="18" height="18" rx="3"/>',            /* ריבוע */
    '<path d="m12 2 3 6.6 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.2l1.4-7L2 9.4l7-.8z"/>', /* כוכב */
    '<path d="M7 3h10l5 9-5 9H7l-5-9z"/>'                           /* משושה */
  ];
  A.SHAPE_NAMES = ['משולש', 'מעוין', 'עיגול', 'ריבוע', 'כוכב', 'משושה'];
  A.shape = (i) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + SHAPES[i % SHAPES.length] + '</svg>';

  /* ---------- הלוגו (SVG). big=true: עם אנימציית "קליק" שחוזרת ---------- */
  A.logo = (cls, big) => {
    const L = [['C', 170], ['l', 290], ['ı', 349], ['k', 394], ['e', 486], ['f', 588], ['f', 659]];
    const sy = big ? ' style="--sy:-' + ((Date.now() % 5500) / 1000).toFixed(2) + 's"' : '';
    return '<svg class="logo ' + (cls || '') + (big ? ' logo-anim' : '') + '"' + sy + ' viewBox="140 0 620 290" role="img" aria-label="Clikeff">' +
      '<g class="lg-letters" font-family="Fredoka, Rubik, sans-serif" font-weight="700" font-size="190" fill="currentColor" direction="ltr">' +
      L.map((l, k) => '<text class="lt" x="' + l[1] + '" y="225" style="--k:' + k + '">' + l[0] + '</text>').join('') + '</g>' +
      (big ? '<g class="lg-sparks" stroke="#2ee6ff" stroke-width="6" stroke-linecap="round">' +
        '<line x1="384" y1="20" x2="384" y2="6"/><line x1="384" y1="124" x2="384" y2="138"/>' +
        '<line x1="332" y1="72" x2="318" y2="72"/><line x1="436" y1="72" x2="450" y2="72"/>' +
        '<line x1="347" y1="35" x2="337" y2="25" stroke="#ff5a5f"/><line x1="421" y1="35" x2="431" y2="25" stroke="#ffb020"/>' +
        '<line x1="347" y1="109" x2="337" y2="119" stroke="#ffb020"/><line x1="421" y1="109" x2="431" y2="119" stroke="#ff5a5f"/></g>' +
        '<circle class="lg-burst b1" cx="384" cy="72" r="20" fill="none" stroke="#2ee6ff" stroke-width="5"/>' +
        '<circle class="lg-burst b2" cx="384" cy="72" r="20" fill="none" stroke="#fff" stroke-width="3"/>' : '') +
      '<circle class="lg-ring r2" cx="384" cy="72" r="46" fill="none" stroke="#2ee6ff" stroke-width="5" opacity=".35"/>' +
      '<circle class="lg-ring r1" cx="384" cy="72" r="31" fill="none" stroke="#2ee6ff" stroke-width="6" opacity=".7"/>' +
      '<circle class="lg-dot" cx="384" cy="72" r="17" fill="#2ee6ff"/>' +
      '<path class="lg-cursor" d="M404 92 l38 92 l12 -36 l36 -12z" fill="#ff5a5f" stroke="#06142b" stroke-width="7" stroke-linejoin="round"/>' +
      '</svg>';
  };

  /* ---------- מספר שעולה בהדרגה (למשל +155) ---------- */
  A.countUp = (el, to, opts) => {
    if (!el) return;
    opts = opts || {};
    const pre = opts.prefix || '', ms = opts.ms || 900, t0 = performance.now();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = pre + A.fmt(to); return; }
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      el.textContent = pre + A.fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- "קליק": גל קטן בכל לחיצה ---------- */
  A.mountClicks = () => {
    if (A._clicks || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    A._clicks = true;
    document.addEventListener('pointerdown', (e) => {
      const r = document.createElement('i');
      r.className = 'click-ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 600);
    }, { passive: true });
  };

  /* ---------- רקע מעוטר ---------- */
  A.mountDeco = () => {
    if (A.$('.bg-deco')) return;
    const d = document.createElement('div');
    d.className = 'bg-deco';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML =
      '<span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>' +
      [0, 1, 2, 3, 4].map((i) => '<span class="shape s' + (i + 1) + '">' + A.shape(i) + '</span>').join('');
    document.body.prepend(d);
    A.mountClicks();
  };

  /* ---------- הודעות קופצות ---------- */
  A.toast = (msg, opts) => {
    opts = opts || {};
    let host = A.$('.toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (opts.type ? ' toast-' + opts.type : '');
    t.innerHTML = (opts.img ? '<img src="' + A.img(opts.img) + '" alt="">' : '') + '<span>' + A.esc(msg) + '</span>';
    host.appendChild(t);
    setTimeout(() => {
      t.classList.add('is-leaving');
      setTimeout(() => t.remove(), 300);
    }, opts.ms || 3200);
  };

  /* ---------- ערכת צבעים: מערכת / בהיר / כהה ---------- */
  A.theme = {
    init() {
      const t = A.store.get('theme', null);
      if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    },
    current() {
      const t = document.documentElement.getAttribute('data-theme');
      if (t) return t;
      return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    toggle() {
      const next = A.theme.current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      A.store.set('theme', next);
      return next;
    },
    button() {
      return '<button class="icon-btn" type="button" data-action="theme" aria-label="מצב כהה/בהיר">' +
        A.icon(A.theme.current() === 'dark' ? 'sun' : 'moon') + '</button>';
    }
  };
  A.theme.init();

  /* ---------- מסך מלא ---------- */
  A.fullscreen = {
    supported() {
      const el = document.documentElement;
      return !!(el.requestFullscreen || el.webkitRequestFullscreen);
    },
    active() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    enter() {
      const el = document.documentElement;
      try {
        const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) :
          el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
        if (r && r.catch) r.catch(() => {});
      } catch (e) { /* אייפון: אין תמיכה — הפריסה עצמה ממלאת את המסך */ }
    },
    exit() {
      try {
        const r = document.exitFullscreen ? document.exitFullscreen() :
          document.webkitExitFullscreen ? document.webkitExitFullscreen() : null;
        if (r && r.catch) r.catch(() => {});
      } catch (e) { /* */ }
    }
  };

  /* ---------- מניעת כיבוי מסך ---------- */
  let wakeLock = null;
  A.wake = {
    async on() {
      try {
        if ('wakeLock' in navigator && !wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
      } catch (e) { /* לא נתמך */ }
    },
    off() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* */ } wakeLock = null; }
  };

  /** קישור הצטרפות עם קוד ממולא מראש */
  A.joinUrl = (code) => {
    const base = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    return base + (code ? '?code=' + code : '');
  };
  A.prettyCode = (code) => String(code || '').replace(/^(\d{3})(\d{3})$/, '$1 $2');
})(window.App);

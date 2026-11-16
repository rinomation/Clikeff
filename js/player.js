/* =========================================================
   קליקרים — בקר מסך המשתתף
   (שלב 2: ממשק בלבד. חיבור לשרת יתווסף בשלב 4)
   ========================================================= */
(function (A) {
  'use strict';
  const $ = A.$;

  const P = (A.Player = {
    screen: null,
    data: {},
    muted: A.store.get('muted', false),
    display: false,
    handlers: {}           /* onJoin, onAnswer, onPrev, onNext, onFinish */
  });

  const app = () => $('#app');

  P.render = (screen, data) => {
    P.screen = screen;
    P.data = data || {};
    document.body.classList.toggle('in-game', screen === 'game' || screen === 'pad');
    document.body.classList.toggle('display-mode', screen === 'game' && P.display);
    const V = A.PlayerView;
    let html = '';
    if (screen === 'join') html = V.join(P.data);
    else if (screen === 'waiting') html = V.waiting(P.data) + V.corner(P.muted);
    else if (screen === 'game') html = V.game(Object.assign({ muted: P.muted, display: P.display }, P.data));
    else if (screen === 'done') html = V.done(P.data) + V.corner(P.muted);
    else if (screen === 'pad') html = V.pad(Object.assign({ muted: P.muted }, P.data));
    else if (screen === 'note') html = V.padNote(Object.assign({ muted: P.muted }, P.data));
    if (screen === 'join') html += '<div class="corner-actions">' + A.theme.button() + '</div>';
    app().innerHTML = html;
    if (screen === 'join') bindJoin();
  };

  /* ---------- טופס הצטרפות ---------- */
  function bindJoin() {
    const form = $('#join-form');
    const code = $('#join-code');
    const name = $('#join-name');
    const count = $('#name-count');

    code.addEventListener('input', () => {
      const v = code.value.replace(/\D/g, '').slice(0, 6);
      if (v !== code.value) code.value = v;
      code.classList.remove('is-invalid');
      if (v.length === 6 && !name.value) name.focus();
    });
    name.addEventListener('input', () => {
      count.textContent = name.value.length + '/20';
      name.classList.remove('is-invalid');
    });

    const opts = A.$$('.avatar-opt', form);
    const select = (btn, focus) => {
      opts.forEach((o) => { o.setAttribute('aria-checked', 'false'); o.tabIndex = -1; });
      btn.setAttribute('aria-checked', 'true');
      btn.tabIndex = 0;
      if (focus) btn.focus();
      A.store.set('avatar', btn.dataset.avatar);
    };
    opts.forEach((o, i) => {
      o.addEventListener('click', () => select(o));
      o.addEventListener('keydown', (e) => {
        const cols = 6;
        const map = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: cols, ArrowUp: -cols };
        if (map[e.key] != null) {
          e.preventDefault();
          const n = (i + map[e.key] + opts.length) % opts.length;
          select(opts[n], true);
        }
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = code.value.trim();
      const n = name.value.replace(/\s+/g, ' ').trim();
      const avatar = ($('.avatar-opt[aria-checked="true"]', form) || {}).dataset;
      if (!/^\d{6}$/.test(c)) return showError('קוד המשחק צריך להיות בן 6 ספרות', code);
      if (!n) return showError('נא לכתוב שם', name);
      A.store.set('lastName', n);
      /* מסך מלא חייב לקרות בתוך פעולת משתמש */
      A.fullscreen.enter();
      A.wake.on();
      if (P.handlers.onJoin) P.handlers.onJoin({ code: c, name: n, avatar: avatar ? avatar.avatar : 'fox' });
    });
  }

  function showError(msg, field) {
    const box = $('#join-error');
    box.innerHTML = A.icon('alert') + A.esc(msg);
    if (field) { field.classList.add('is-invalid'); field.focus(); }
  }
  P.showJoinError = showError;

  /* ---------- לחיצות כלליות ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action],[data-answer]');
    if (!btn || btn.disabled) return;
    if (btn.hasAttribute('data-answer')) {
      if (P.handlers.onAnswer) P.handlers.onAnswer(Number(btn.dataset.answer));
      return;
    }
    switch (btn.dataset.action) {
      case 'theme':
        A.theme.toggle();
        btn.outerHTML = A.theme.button();
        break;
      case 'mute':
        P.muted = !P.muted;
        A.store.set('muted', P.muted);
        btn.outerHTML = A.PlayerView.muteBtn(P.muted);
        if (P.handlers.onMute) P.handlers.onMute(P.muted);
        break;
      case 'display':
        P.display = !P.display;
        if (P.display) A.fullscreen.enter();
        P.render(P.screen, P.data);
        break;
      case 'prev': if (P.handlers.onPrev) P.handlers.onPrev(); break;
      case 'next': if (P.handlers.onNext) P.handlers.onNext(); break;
      case 'finish': if (P.handlers.onFinish) P.handlers.onFinish(); break;
      case 'leave': if (P.handlers.onLeave) P.handlers.onLeave(true); break;
      case 'leave-done': if (P.handlers.onLeave) P.handlers.onLeave(false); break;
    }
  });

  /* מקלדת במשחק: 1–6 לבחירת תשובה, חצים לניווט */
  document.addEventListener('keydown', (e) => {
    if (P.screen !== 'game' || e.target.matches('input,textarea')) return;
    if (/^[1-6]$/.test(e.key)) {
      const b = A.$$('.answer')[Number(e.key) - 1];
      if (b && !b.disabled) b.click();
    } else if (e.key === 'ArrowRight') { const b = $('[data-action="prev"]'); if (b) b.click(); }
    else if (e.key === 'ArrowLeft') { const b = $('[data-action="next"],[data-action="finish"]'); if (b) b.click(); }
  });

  /* ---------- התחלה ---------- */
  A.mountDeco();
  /** חלון אישור מעוצב — מחזיר Promise<boolean> */
  P.ask = (d) => new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = A.PlayerView.confirm(d);
    const back = wrap.firstChild;
    document.body.appendChild(back);
    const done = (v) => { back.remove(); document.removeEventListener('keydown', esc); resolve(v); };
    const esc = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', esc);
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-modal]');
      if (b) done(b.dataset.modal === 'yes');
      else if (e.target === back) done(false);
    });
    back.querySelector('[data-modal="yes"]').focus();
  });

  /** מסך הצטרפות עם ערכים זכורים */
  P.showJoin = (extra) => {
    const params = new URLSearchParams(location.search);
    P.render('join', Object.assign({
      code: (params.get('code') || '').replace(/\D/g, '').slice(0, 6),
      name: A.store.get('lastName', ''),
      avatar: A.store.get('avatar', A.AVATARS[Math.floor(Math.random() * A.AVATARS.length)])
    }, extra || {}));
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (/[?&]demo\b/.test(location.search)) return; /* demo.js מנהל את התצוגה */
    if (P.boot) P.boot(); else P.showJoin();
  });
})(window.App);

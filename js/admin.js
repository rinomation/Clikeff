/* =========================================================
   קליקרים — בקר לוח המנחה
   (שלב 2: ממשק בלבד. לוגיקה וחיבור לשרת בשלבים 3–7)
   ========================================================= */
(function (A) {
  'use strict';
  const $ = A.$;

  const M = (A.Admin = {
    screen: 'setup',
    data: {},
    muted: A.store.get('muted', false),
    handlers: {}
  });

  const STEP = { home: 0, setup: 0, lobby: 1, live: 2, stage: 2, stageReveal: 2, stageBoard: 2, results: 3 };

  M.render = (screen, data) => {
    M.screen = screen;
    M.data = data || M.data;
    const V = A.AdminView;
    const body = V[screen](M.data);
    $('#app').innerHTML = V.header({ step: STEP[screen], muted: M.muted, user: M.user }) + body;
    if (screen === 'resetPw') {
      const f = $('#reset-form');
      if (f) f.addEventListener('submit', (e) => { e.preventDefault(); if (M.handlers.resetSave) M.handlers.resetSave(); });
    }
    if (screen === 'login') {
      const f = $('#login-form');
      if (f) f.addEventListener('submit', (e) => { e.preventDefault(); if (M.handlers.login) M.handlers.login(); });
      const em = $('#login-email'), pw = $('#login-pass');
      if (em && !em.value) em.focus(); else if (pw) pw.focus();
    }
    if (screen === 'setup') bindSetup();
    if (screen === 'results') A.$$('.podium .count').forEach((el, k) => setTimeout(() => A.countUp(el, Number(el.dataset.to) || 0, { ms: 1200 }), [1300, 1100, 900][k] || 900));
  };

  function bindSetup() {
    const range = $('#duration');
    if (range) {
      range.addEventListener('input', () => {
        const v = Number(range.value);
        $('#duration-value').textContent = v;
        range.style.setProperty('--fill', ((v - 5) / 55) * 100 + '%');
        M.data.duration = v;
        if (M.handlers.onDuration) M.handlers.onDuration(v);
      });
      range.addEventListener('change', () => M.render('setup'));
    }
    A.$$('input[name="track"]').forEach((r) =>
      r.addEventListener('change', () => {
        M.data.track = r.value;
        if (M.handlers.onTrack) M.handlers.onTrack(r.value);
        M.render('setup');
        const again = $('input[name="track"][value="' + r.value + '"]');
        if (again) again.focus();
      }));
    A.$$('[data-team-name]').forEach((inp) => {
      inp.addEventListener('input', () => { if (M.handlers.onTeamName) M.handlers.onTeamName(Number(inp.dataset.teamName), inp.value); });    });
    const rank = $('#show-rank');
    if (rank) rank.addEventListener('change', () => {
      M.data.showRank = rank.checked;
      if (M.handlers.showRank) M.handlers.showRank(rank.checked);
    });

    const dz = $('#dropzone');
    const fi = $('#file-input');
    if (dz && fi) {
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
      dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f && M.handlers.onFile) M.handlers.onFile(f); });
      fi.addEventListener('change', () => { const f = fi.files[0]; if (f && M.handlers.onFile) M.handlers.onFile(f); });
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.action;
    if (act === 'theme') { A.theme.toggle(); btn.outerHTML = A.theme.button(); return; }
    if (act === 'mute') {
      M.muted = !M.muted; A.store.set('muted', M.muted);
      if (A.Sound) A.Sound.setMuted(M.muted);
      M.render(M.screen); return;
    }
    if (act === 'copy-pass') {
      const t = (M.data && M.data.pass) || '';
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
        .then(() => A.toast('הסיסמה הועתקה', { type: 'ok' })).catch(() => A.toast(t));
      return;
    }
    if (act === 'preview-track') e.preventDefault(); /* לא לבחור את הרצועה בלחיצה על "נגן" */
    if (act === 'copy-link') {
      const url = A.joinUrl(M.data.code);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(() => A.toast('הקישור הועתק', { type: 'ok' }))
        .catch(() => A.toast(url));
      return;
    }
    const h = M.handlers[act];
    if (h) h(btn.dataset.value, btn);
  });

  A.mountDeco();
})(window.App);

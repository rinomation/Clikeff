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

  const STEP = { setup: 0, lobby: 1, live: 2, stage: 2, stageReveal: 2, results: 3 };

  M.render = (screen, data) => {
    M.screen = screen;
    M.data = data || M.data;
    const V = A.AdminView;
    const body = V[screen](M.data);
    $('#app').innerHTML = V.header({ step: STEP[screen], muted: M.muted }) + body;
    if (screen === 'setup') bindSetup();
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

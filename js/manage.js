/* =========================================================
   Clikeff · ניהול מנויים (רק למנהלת המערכת)
   יצירת חשבון ללקוח עם מייל וסיסמה, מנוי לשנה, חידוש ועצירה.
   ========================================================= */
(function (A) {
  'use strict';
  const N = A.Net, R = A.FsRest, $ = A.$, esc = A.esc;
  const GAME_URL = 'https://clikeff.vercel.app/admin';
  const st = { user: null, list: [], q: '', last: null, mode: 'signin' };

  const fmt = (ms) => { const d = new Date(ms); return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); };
  const daysLeft = (ms) => Math.ceil((ms - Date.now()) / 864e5);
  /** 050-1234567 → 972501234567 (לקישור וואטסאפ) */
  const waNum = (p) => { p = String(p || '').replace(/[^0-9]/g, ''); return p.startsWith('0') ? '972' + p.slice(1) : p; };
  const expMs = (l) => (l.expires && l.expires.toMillis ? l.expires.toMillis() : 0);

  /** סיסמה קריאה, למשל Kfmr-4827 (בלי תווים שמתבלבלים) */
  function genPass() {
    const L = 'abcdefghjkmnpqrstuvwxyz', D = '23456789', r = new Uint32Array(8);
    crypto.getRandomValues(r);
    let s = '';
    for (let i = 0; i < 4; i++) s += L[r[i] % L.length];
    s = s[0].toUpperCase() + s.slice(1) + '-';
    for (let i = 4; i < 8; i++) s += D[r[i] % D.length];
    return s;
  }

  /* ---------- תצוגה ---------- */
  function header() {
    return '<header class="admin-top">' +
      '<a class="admin-brand" href="admin.html">' + A.logo('logo-sm') + '<h1><span class="sr-only">Clikeff</span><small>ניהול מנויים</small></h1></a>' +
      '<span class="spacer"></span><div class="actions">' +
      (st.user ? '<a class="btn btn-ghost btn-sm" href="admin.html">למשחק</a>' +
        '<button class="icon-btn" type="button" data-action="logout" aria-label="יציאה" title="יציאה">' + A.icon('door') + '</button>' : '') +
      '</div></header>';
  }
  function render(body) { $('#app').innerHTML = header() + body; }

  function viewLogin(d) {
    d = d || {};
    const up = st.mode === 'signup';
    render('<section class="auth">' +
      '<div class="auth-logo">' + A.logo('logo-lg', true) + '</div>' +
      '<form class="card auth-card" id="m-login" novalidate>' +
      '<h2>' + (up ? 'יצירת חשבון מנהלת' : 'כניסת מנהלת') + '</h2>' +
      '<label class="field"><span class="field-label">מייל</span>' +
      '<input class="input" id="m-email" type="email" dir="ltr" autocomplete="username" value="' + esc(d.email || N.OWNER) + '"></label>' +
      '<label class="field"><span class="field-label">' + (up ? 'בחרי סיסמה (לפחות 8 תווים)' : 'סיסמה') + '</span>' +
      '<input class="input" id="m-pass" type="password" dir="ltr" autocomplete="' + (up ? 'new-password' : 'current-password') + '"></label>' +
      (up ? '<label class="field"><span class="field-label">שוב את הסיסמה</span><input class="input" id="m-pass2" type="password" dir="ltr" autocomplete="new-password"></label>' : '') +
      '<p class="form-error" role="alert">' + (d.error ? A.icon('alert') + esc(d.error) : '') + '</p>' +
      '<button class="btn btn-primary btn-lg btn-block" type="submit">' + (up ? 'יצירת החשבון' : 'כניסה') + '</button>' +
      (up ? '<button class="link-btn auth-forgot" type="button" data-action="mode" data-value="signin">כבר יש לי חשבון</button>'
        : '<button class="link-btn auth-forgot" type="button" data-action="forgot">שכחתי סיסמה</button>' +
          '<button class="link-btn auth-forgot" type="button" data-action="mode" data-value="signup">פעם ראשונה כאן? יצירת חשבון מנהלת</button>') +
      '</form></section>');
    $('#m-login').addEventListener('submit', (e) => { e.preventDefault(); up ? doSignUp() : doSignIn(); });
    const pw = $('#m-pass'); if (pw) pw.focus();
  }

  function viewVerify(d) {
    d = d || {};
    render('<section class="auth"><div class="card auth-card no-lic">' +
      '<img src="' + A.img('scroll') + '" alt="">' +
      '<h2>עוד צעד אחד</h2>' +
      '<p>שלחנו מייל אימות אל <bdi>' + esc(st.user.email) + '</bdi>. פתחי אותו, לחצי על הקישור שבו, ואז חזרי לכאן ולחצי "אימתתי".</p>' +
      '<p class="m-small">לא רואה את המייל? כדאי לבדוק גם בתיקיית הספאם.</p>' +
      '<p class="form-error" role="alert">' + (d.error ? A.icon('alert') + esc(d.error) : '') + '</p>' +
      '<button class="btn btn-primary btn-lg btn-block" type="button" data-action="verified">אימתתי</button>' +
      '<button class="link-btn" type="button" data-action="resend">שליחת המייל שוב</button>' +
      '</div></section>');
  }

  /** שלב חד-פעמי: מספר החשבון של המנהלת נכנס לכללי האבטחה */
  function viewSetup() {
    render('<section class="auth"><div class="card auth-card no-lic">' +
      '<img src="' + A.img('crown') + '" alt="">' +
      '<h2>החשבון שלך מוכן!</h2>' +
      '<p>נשאר צעד אחד: להכניס לכללי האבטחה את מספר החשבון שלך. שלחי לי את המספר הזה:</p>' +
      '<code class="m-uid" dir="ltr">' + esc(st.user.uid) + '</code>' +
      '<button class="btn btn-primary btn-block" type="button" data-action="copy-uid">' + A.icon('copy') + 'העתקת המספר</button>' +
      '<button class="link-btn" type="button" data-action="retry">פרסמתי את הכללים, לנסות שוב</button>' +
      '</div></section>');
  }

  function viewNotOwner() {
    render('<section class="auth"><div class="card auth-card no-lic">' +
      '<img src="' + A.img('door') + '" alt="">' +
      '<h2>הדף הזה רק למנהלת</h2>' +
      '<p>נכנסת עם <bdi>' + esc(st.user.email) + '</bdi>. כדי לנהל מנויים צריך להיכנס עם חשבון המנהלת.</p>' +
      '<button class="btn btn-primary btn-block" type="button" data-action="logout">כניסה עם חשבון אחר</button>' +
      '<a class="link-btn" href="admin.html">למשחק</a>' +
      '</div></section>');
  }

  function statusOf(l) {
    const ms = expMs(l), days = daysLeft(ms);
    if (l.active === false) return ['stop', 'מושהה'];
    if (days <= 0) return ['end', 'הסתיים'];
    if (days <= 30) return ['soon', 'עוד ' + days + ' ימים'];
    return ['ok', 'פעיל'];
  }

  function message(x) {
    return 'שלום ' + x.name + ',\n' +
      'המנוי שלך ל-Clikeff מוכן!\n\n' +
      'כניסה למנחים: ' + GAME_URL + '\n' +
      'מייל: ' + x.email + '\n' +
      'סיסמה: ' + x.pass + '\n\n' +
      'המנוי בתוקף עד ' + fmt(x.expires) + '.\n' +
      'אפשר להחליף סיסמה דרך "שכחתי סיסמה" במסך הכניסה.\n' +
      'לוחצים, נהנים, משחקים!';
  }

  function viewDash(d) {
    d = d || {};
    const q = st.q.trim().toLowerCase();
    const rows = st.list
      .filter((l) => !q || (l.name || '').toLowerCase().indexOf(q) >= 0 || (l.email || '').indexOf(q) >= 0)
      .sort((a, b) => expMs(a) - expMs(b));
    const active = st.list.filter((l) => statusOf(l)[0] === 'ok' || statusOf(l)[0] === 'soon').length;
    const soon = st.list.filter((l) => statusOf(l)[0] === 'soon').length;
    const x = st.last;
    render('<section class="admin-main manage">' +
      '<div class="page-head"><div><h2>ניהול מנויים</h2><p>לקוח חדש, חידוש לשנה נוספת ועצירת מנוי.</p></div>' +
      '<div class="m-stats"><span><b>' + active + '</b> פעילים</span>' + (soon ? '<span class="soon"><b>' + soon + '</b> מסתיימים החודש</span>' : '') + '</div></div>' +

      '<div class="m-grid">' +
      '<form class="card m-new" id="m-new" novalidate>' +
      '<h3 class="card-title">' + A.icon('sparkle') + 'לקוח חדש</h3>' +
      '<label class="field"><span class="field-label">שם הלקוח או המוסד</span><input class="input" id="n-name" maxlength="60" placeholder="למשל: תלמוד תורה נועם התורה" value="' + esc(d.name || '') + '"></label>' +
      '<label class="field"><span class="field-label">המייל שאיתו הלקוח יתחבר</span><input class="input" id="n-email" type="email" dir="ltr" placeholder="name@example.com" value="' + esc(d.email || '') + '"></label>' +
      '<label class="field"><span class="field-label">מספר לוואטסאפ <small>(לא חובה)</small></span><input class="input" id="n-phone" type="tel" dir="ltr" placeholder="05X-XXX-XXXX" value="' + esc(d.phone || '') + '"></label>' +
      '<label class="field"><span class="field-label">תקופה</span><select class="input" id="n-months">' +
      [[12, 'שנה'], [24, 'שנתיים'], [6, 'חצי שנה'], [3, 'שלושה חודשים'], [1, 'חודש']].map((m) => '<option value="' + m[0] + '"' + ((d.months || 12) === m[0] ? ' selected' : '') + '>' + m[1] + '</option>').join('') +
      '</select></label>' +
      '<p class="form-error" role="alert">' + (d.error ? A.icon('alert') + esc(d.error) : '') + '</p>' +
      '<button class="btn btn-accent btn-lg btn-block" type="submit"' + (d.busy ? ' disabled' : '') + '>' + (d.busy ? 'יוצרים…' : 'יצירת מנוי') + '</button>' +
      '</form>' +

      (x ? '<div class="card m-result">' +
        '<h3 class="card-title">' + A.icon('check') + 'המנוי של ' + esc(x.name) + ' מוכן!</h3>' +
        '<p class="m-small">שלחי ללקוח את הפרטים. את הסיסמה לא נראה שוב אחר כך, אבל תמיד אפשר לשלוח לו מייל לאיפוס סיסמה.</p>' +
        '<dl class="m-creds">' +
        '<dt>קישור</dt><dd dir="ltr">' + esc(GAME_URL) + '</dd>' +
        '<dt>מייל</dt><dd dir="ltr">' + esc(x.email) + '</dd>' +
        '<dt>סיסמה</dt><dd dir="ltr" class="pw">' + esc(x.pass) + '</dd>' +
        '<dt>בתוקף עד</dt><dd>' + fmt(x.expires) + '</dd></dl>' +
        '<div class="m-share">' +
        '<button class="btn btn-primary" type="button" data-action="copy">' + A.icon('copy') + 'העתקת ההודעה</button>' +
        '<a class="btn btn-ghost" href="https://wa.me/' + waNum(x.phone) + '?text=' + encodeURIComponent(message(x)) + '" target="_blank" rel="noopener">שליחה בוואטסאפ</a>' +
        '<a class="btn btn-ghost" href="mailto:' + esc(x.email) + '?subject=' + encodeURIComponent('המנוי שלך ל-Clikeff') + '&body=' + encodeURIComponent(message(x)) + '">שליחה במייל</a>' +
        '</div></div>'
        : '<div class="card m-help"><h3 class="card-title">' + A.icon('alert') + 'איך זה עובד</h3>' +
          '<ol><li>כותבים שם ומייל של הלקוח ולוחצים "יצירת מנוי".</li><li>המערכת יוצרת לו סיסמה ומנוי מהיום.</li>' +
          '<li>שולחים לו את ההודעה המוכנה בוואטסאפ או במייל.</li><li>בסוף התקופה הכניסה שלו נחסמת לבד, עד שתחדשי.</li></ol></div>') +
      '</div>' +

      '<div class="card m-list">' +
      '<div class="m-list-head"><h3 class="card-title">' + A.icon('users') + 'הלקוחות <small>(' + st.list.length + ')</small></h3>' +
      '<input class="input m-search" id="m-search" type="search" placeholder="חיפוש לפי שם או מייל" value="' + esc(st.q) + '"></div>' +
      (rows.length ? '<div class="m-rows">' + rows.map((l) => {
        const s = statusOf(l);
        return '<div class="m-row">' +
          '<div class="m-who"><b>' + esc(l.name || 'בלי שם') + '</b><span dir="ltr">' + esc(l.email || '') + (l.phone ? ' · <a href="https://wa.me/' + waNum(l.phone) + '" target="_blank" rel="noopener">' + esc(l.phone) + '</a>' : '') + '</span></div>' +
          '<div class="m-exp"><span class="m-badge ' + s[0] + '">' + s[1] + '</span><small>עד ' + fmt(expMs(l)) + '</small></div>' +
          '<div class="m-acts">' +
          '<button class="btn btn-sm btn-primary" type="button" data-action="renew" data-value="' + esc(l.id) + '">חידוש לשנה</button>' +
          '<button class="btn btn-sm btn-ghost" type="button" data-action="toggle" data-value="' + esc(l.id) + '">' + (l.active === false ? 'הפעלה' : 'עצירה') + '</button>' +
          '<button class="btn btn-sm btn-ghost" type="button" data-action="reset" data-value="' + esc(l.id) + '">איפוס סיסמה</button>' +
          '</div></div>';
      }).join('') + '</div>'
        : '<p class="m-empty">' + (st.list.length ? 'לא נמצאו לקוחות בחיפוש הזה.' : 'עוד אין לקוחות. הלקוח הראשון בדרך!') + '</p>') +
      '</div></section>');

    $('#m-new').addEventListener('submit', (e) => { e.preventDefault(); doCreate(); });
    const s = $('#m-search');
    s.addEventListener('input', () => { st.q = s.value; const pos = s.selectionStart; viewDash(); const s2 = $('#m-search'); s2.focus(); s2.setSelectionRange(pos, pos); });
  }

  /* ---------- פעולות ---------- */
  async function route() {
    const u = N.user();
    st.user = u && !u.isAnonymous ? u : null;
    if (!st.user) return viewLogin();
    if (String(st.user.email || '').toLowerCase() !== N.OWNER) return viewNotOwner();
    N.useUser(st.user);
    render('<section class="auth"><div class="auth-wait"><span class="spinner"></span>טוענים את הלקוחות…</div></section>');
    const ok = await loadList();
    if (ok === 'denied') return viewSetup();
    viewDash();
  }

  async function loadList() {
    try { st.list = await R.list('licenses'); return true; }
    catch (e) {
      st.list = [];
      if (/permission/.test(e.code || '')) return 'denied';
      A.toast(N.errorText(e), { type: 'bad', ms: 8000 });
      return false;
    }
  }

  async function doSignIn() {
    const email = $('#m-email').value.trim(), pass = $('#m-pass').value;
    if (!email || !pass) return viewLogin({ email, error: 'נא למלא מייל וסיסמה' });
    try { await N.signIn(email, pass); await route(); }
    catch (e) { viewLogin({ email, error: N.authError(e) }); }
  }

  async function doSignUp() {
    const email = $('#m-email').value.trim(), pass = $('#m-pass').value, pass2 = $('#m-pass2').value;
    if (email.toLowerCase() !== N.OWNER) return viewLogin({ email, error: 'חשבון מנהלת אפשר לפתוח רק עם ' + N.OWNER });
    if (pass.length < 8) return viewLogin({ email, error: 'הסיסמה צריכה להיות לפחות 8 תווים' });
    if (pass !== pass2) return viewLogin({ email, error: 'שתי הסיסמאות לא זהות' });
    try {
      await N.signUp(email, pass);
      st.mode = 'signin';
      await route();
    } catch (e) {
      if (/email-already-in-use/.test(e.code || '')) { st.mode = 'signin'; return viewLogin({ email, error: 'כבר יש חשבון למייל הזה. אפשר להיכנס, או ללחוץ "שכחתי סיסמה".' }); }
      viewLogin({ email, error: N.authError(e) });
    }
  }

  async function doCreate() {
    const name = $('#n-name').value.trim(), email = $('#n-email').value.trim().toLowerCase(), months = Number($('#n-months').value) || 12;
    const phone = $('#n-phone').value.replace(/[^0-9+]/g, '');
    const keep = { name, email, months, phone };
    if (!name) return viewDash(Object.assign(keep, { error: 'נא לכתוב את שם הלקוח' }));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return viewDash(Object.assign(keep, { error: 'כתובת המייל לא נראית תקינה' }));
    viewDash(Object.assign({ busy: true }, keep));
    const pass = genPass();
    let newUid = null;
    try {
      const sec = firebase.apps.find((a) => a.name === 'creator') || firebase.initializeApp(window.FIREBASE_CONFIG, 'creator');
      await sec.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
      const c = await sec.auth().createUserWithEmailAndPassword(email, pass);
      newUid = c.user.uid;
      await sec.auth().signOut();
    } catch (e) {
      const msg = /email-already-in-use/.test(e.code || '')
        ? 'המייל הזה כבר רשום. אם זה לקוח קיים, חדשי לו את המנוי מהרשימה למטה.'
        : N.authError(e);
      return viewDash(Object.assign(keep, { error: msg }));
    }
    const exp = new Date(); exp.setMonth(exp.getMonth() + months);
    const doc = { name, email, phone, active: true, expires: exp, months, createdAt: R.NOW, updatedAt: R.NOW };
    let ok = false;
    for (let t = 0; t < 3 && !ok; t++) {
      try { await R.set('licenses/' + newUid, doc); ok = true; } catch (e) { await new Promise((r) => setTimeout(r, 800)); }
    }
    if (!ok) return viewDash(Object.assign(keep, { error: 'החשבון נוצר אבל המנוי לא נשמר. שמרי את הסיסמה ' + pass + ' ונסי שוב בעוד רגע.' }));
    st.last = { name, email, pass, phone, expires: exp.getTime() };
    await loadList();
    viewDash();
    A.toast('המנוי נוצר!', { type: 'ok' });
  }

  async function renew(id) {
    const l = st.list.find((x) => x.id === id); if (!l) return;
    const d = new Date(Math.max(Date.now(), expMs(l))); d.setFullYear(d.getFullYear() + 1);
    try {
      await R.set('licenses/' + id, { expires: d, active: true, updatedAt: R.NOW }, { merge: true });
      await loadList(); viewDash();
      A.toast('המנוי של ' + (l.name || l.email) + ' חודש עד ' + fmt(d.getTime()), { type: 'ok' });
    } catch (e) { A.toast(N.errorText(e), { type: 'bad' }); }
  }

  async function toggle(id) {
    const l = st.list.find((x) => x.id === id); if (!l) return;
    const on = l.active === false;
    try {
      await R.set('licenses/' + id, { active: on, updatedAt: R.NOW }, { merge: true });
      await loadList(); viewDash();
      A.toast(on ? 'המנוי הופעל מחדש' : 'המנוי נעצר. הלקוח לא יוכל לפתוח משחק חדש.', { type: 'ok' });
    } catch (e) { A.toast(N.errorText(e), { type: 'bad' }); }
  }

  async function resetPw(id) {
    const l = st.list.find((x) => x.id === id); if (!l || !l.email) return;
    try { await N.resetPassword(l.email); A.toast('נשלח מייל לבחירת סיסמה חדשה אל ' + l.email, { type: 'ok', ms: 6000 }); }
    catch (e) { A.toast(N.authError(e), { type: 'bad' }); }
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const act = b.dataset.action, v = b.dataset.value;
    if (act === 'mode') { st.mode = v; return viewLogin({ email: ($('#m-email') || {}).value }); }
    if (act === 'forgot') {
      const email = ($('#m-email').value || '').trim();
      if (!email) return viewLogin({ error: 'כתבי את המייל ואז לחצי שוב' });
      try { await N.resetPassword(email); A.toast('שלחנו מייל לבחירת סיסמה חדשה', { type: 'ok', ms: 6000 }); }
      catch (err) { viewLogin({ email, error: N.authError(err) }); }
      return;
    }
    if (act === 'logout') { await N.signOut().catch(() => {}); st.last = null; return route(); }
    if (act === 'resend') {
      try { await N.sendVerify(); A.toast('המייל נשלח שוב', { type: 'ok' }); } catch (err) { viewVerify({ error: N.authError(err) }); }
      return;
    }
    if (act === 'verified') {
      try { await st.user.reload(); await st.user.getIdToken(true); } catch (err) { /* ננסה בכל זאת */ }
      if (!N.user().emailVerified) return viewVerify({ error: 'עוד לא רואים את האימות. לחצי על הקישור במייל ונסי שוב.' });
      return route();
    }
    if (act === 'copy' && st.last) {
      const t = message(st.last);
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
        .then(() => A.toast('ההודעה הועתקה. אפשר להדביק בוואטסאפ או במייל.', { type: 'ok' }))
        .catch(() => A.toast('לא הצלחנו להעתיק. סמני את הפרטים והעתיקי ידנית.', { type: 'bad' }));
      return;
    }
    if (act === 'copy-uid') {
      (navigator.clipboard ? navigator.clipboard.writeText(st.user.uid) : Promise.reject())
        .then(() => A.toast('המספר הועתק', { type: 'ok' })).catch(() => A.toast(st.user.uid));
      return;
    }
    if (act === 'retry') { try { await st.user.getIdToken(true); } catch (err) { /* */ } return route(); }
    if (act === 'renew') return renew(v);
    if (act === 'toggle') return toggle(v);
    if (act === 'reset') return resetPw(v);
  });

  A.mountDeco();
  render('<section class="auth"><div class="auth-wait"><span class="spinner"></span>מתחברים…</div></section>');
  N.initAuth().then(route).catch((e) => render('<section class="auth"><p class="form-error">' + esc(N.errorText(e)) + '</p></section>'));
})(window.App);

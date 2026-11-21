/* =========================================================
   Clikeff · ניהול מנויים (רק למנהלת המערכת)
   כל הלקוחות ופרטיהם, ויצירת לקוח חדש עם מייל, סיסמה ותוקף.
   ========================================================= */
(function (A) {
  'use strict';
  const N = A.Net, R = A.FsRest, $ = A.$, esc = A.esc;
  const GAME_URL = 'https://clikeff.vercel.app/admin';
  const DEMO = /[?&]demo\b/.test(location.search);
  const st = { user: null, list: [], leads: [], leadsDenied: false, tab: 'clients', leadFilter: 'new', q: '', filter: 'all', open: null, edit: null, shown: {}, last: null, form: {}, mode: 'signin', mail: false };

  const fmt = (ms) => { if (!ms) return '—'; const d = new Date(ms); return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); };
  const fmtT = (ms) => { const d = new Date(ms); return fmt(ms) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const isTrial = (l) => !!l.trial && l.active !== false && expMs(l) > Date.now();
  const untilOf = (l) => (l.trial ? fmtT(expMs(l)) : fmt(expMs(l)));
  const playsOf = (l) => l.plays || 0;
  const gamesOf = (l) => (Array.isArray(l.games) ? l.games : []).filter((g) => g && g.t);
  const kidsOf = (l) => gamesOf(l).reduce((n, g) => n + (g.n || 0), 0);
  /** "היום 14:05" / "אתמול" / "3.11" */
  const ago = (ms) => {
    if (!ms) return '';
    const d = new Date(ms), t = new Date(), y = new Date(Date.now() - 864e5);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === t.toDateString()) return 'היום ' + hm;
    if (d.toDateString() === y.toDateString()) return 'אתמול ' + hm;
    return d.getDate() + '.' + (d.getMonth() + 1) + (d.getFullYear() !== t.getFullYear() ? '.' + d.getFullYear() : '');
  };
  const daysLeft = (ms) => Math.ceil((ms - Date.now()) / 864e5);
  const tms = (t) => (t && t.toMillis ? t.toMillis() : 0);
  const expMs = (l) => tms(l.expires);
  /** 050-1234567 → 972501234567 (לקישור וואטסאפ) */
  const waNum = (p) => { p = String(p || '').replace(/[^0-9]/g, ''); return p.startsWith('0') ? '972' + p.slice(1) : p; };
  const prettyPhone = (p) => { p = String(p || '').replace(/[^0-9]/g, ''); return p.length === 10 ? p.slice(0, 3) + '-' + p.slice(3, 6) + '-' + p.slice(6) : p; };
  const ic = (n) => '<span class="mi">' + A.icon(n) + '</span>';
  const COLORS = ['#2ee6ff', '#ff5a5f', '#ffb020', '#14c49a', '#3d7bff', '#a46bff'];
  const colorOf = (s) => { let h = 0; String(s || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return COLORS[h % COLORS.length]; };
  const initial = (l) => (String(l.name || l.email || '?').trim()[0] || '?');

  function statusOf(l) {
    const days = daysLeft(expMs(l));
    if (l.active === false) return { k: 'stop', t: 'מושהה' };
    if (days <= 0) return { k: 'end', t: l.trial ? 'הניסיון הסתיים' : 'הסתיים' };
    if (isTrial(l)) return { k: 'soon', t: 'ניסיון · עוד ' + Math.max(1, Math.ceil((expMs(l) - Date.now()) / 36e5)) + ' שעות' };
    if (days <= 30) return { k: 'soon', t: 'עוד ' + days + ' ימים' };
    return { k: 'ok', t: 'פעיל' };
  }

  /** הודעת ברוכים הבאים למוסד, בעיצוב של וואטסאפ: *מודגש*, _נטוי_, ```גופן קבוע``` */
  function message(x) {
    const L = '━━━━━━━━━━━━━━━', M = '```';
    if (x.trial) return [
      '⏳ *24 שעות של Clikeff, עלינו!*',
      '',
      'שלום *' + x.name + '* 👋',
      'פתחנו לכם חשבון ניסיון, כדי שתרגישו את המשחק בעצמכם.',
      '',
      '▫️ קישור: ' + GAME_URL,
      '▫️ מייל: ' + x.email,
      '▫️ סיסמה: ' + M + x.pass + M,
      '▫️ פעיל עד: *' + fmtT(x.expires) + '*',
      '',
      'אהבתם? נשמח לפתוח לכם מנוי שנתי מלא 🎉',
      '📞 050-410-3847',
      '',
      '_לוחצים, נהנים, משחקים!_ 🎈'
    ].join('\n');
    return [
      '✨' + L + '✨',
      '🎉 *ברוכים הבאים ל-Clikeff!*',
      '✨' + L + '✨',
      '',
      'שלום *' + x.name + '* 👋',
      'המנוי שלכם מוכן, ואפשר להתחיל לשחק! 🚀',
      '',
      '🔐 *פרטי הכניסה*',
      '▫️ קישור: ' + GAME_URL,
      '▫️ מייל: ' + x.email,
      '▫️ סיסמה: ' + M + x.pass + M,
      '▫️ בתוקף עד: *' + fmt(x.expires) + '*',
      '',
      '🔒 *פרטי הכניסה אישיים*',
      'המנוי מיועד לשימוש של ' + x.name + ' בלבד. אין להעביר את פרטי הכניסה לאנשים או למוסדות אחרים.',
      'מכירים עוד מישהו שירצה ליהנות מ-Clikeff? נשמח לעזור לו לפתוח מנוי משלו.',
      '',
      L,
      '',
      '🎯 *איך מתחילים?*',
      '*1.* נכנסים לקישור ← *"פתיחת חידון חדש"*',
      '*2.* בוחרים שאלות: מהמאגר, מקובץ אקסל, או כותבים לבד',
      '*3.* לוחצים *"פתיחת המשחק"* ומציגים על המקרן',
      '',
      '🙋 *המשתתפים נכנסים בקלות*',
      'קוד של 6 ספרות על המקרן ← שם ודמות ← משחקים!',
      'בלי הרשמה ובלי התקנה ✅',
      '',
      L,
      '',
      '💬 *יש שאלה? אני כאן בשבילכם*',
      '📞 050-410-3847',
      '✉️ rinatya3847@gmail.com',
      '',
      '_לוחצים, נהנים, משחקים!_ 🎈'
    ].join('\n');
  }
  /** אותה הודעה בלי סימני העיצוב של וואטסאפ (למייל) */
  const plain = (x) => message(x).split('```').join('').replace(/\*/g, '').replace(/(^|\n)_|_(\n|$)/g, '$1$2');
  const copy = (t, ok) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(() => A.toast(ok || 'הועתק', { type: 'ok' })).catch(() => A.toast('לא הצלחנו להעתיק', { type: 'bad' }));

  /* =========================================================
     מייל "המנוי מוכן" בעיצוב HTML (טבלאות וסגנון מוטבע, כמו שתוכנות מייל אוהבות)
     ========================================================= */
  const LOGO = 'https://clikeff.vercel.app/assets/email-logo.png';
  function emailHtml(x) {
    const C = { navy: '#06142b', text: '#1d2b45', mute: '#5b6b85', box: '#f2f6fb', line: '#e3e9f2', coral: '#ff5a5f' };
    const F = "font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;";
    if (x.trial) return trialHtml(x, C, F);
    const step = (n, color, title, sub) =>
      '<tr><td style="padding:8px 0 8px 12px;vertical-align:top;width:40px">' +
      '<div style="width:34px;height:34px;line-height:34px;border-radius:50%;background:' + color + ';color:#ffffff;' + F + 'font-size:17px;font-weight:bold;text-align:center">' + n + '</div></td>' +
      '<td style="padding:8px 0;' + F + 'font-size:15px;line-height:1.6;color:' + C.text + '"><b>' + title + '</b><br><span style="color:' + C.mute + '">' + sub + '</span></td></tr>';
    return '' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;direction:rtl"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;direction:rtl;text-align:right">' +
      /* כותרת כהה עם הלוגו */
      '<tr><td align="center" style="background:' + C.navy + ';padding:30px 24px 24px">' +
      '<img src="' + LOGO + '" width="230" alt="Clikeff" style="display:block;width:230px;max-width:72%;height:auto;border:0;margin:0 auto;color:#ffffff;' + F + 'font-size:32px;font-weight:bold">' +
      '<div style="' + F + 'font-size:16px;font-weight:bold;color:#2ee6ff;margin-top:8px">לוחצים, נהנים, משחקים!</div></td></tr>' +
      /* ברכה */
      '<tr><td style="padding:30px 30px 4px;' + F + 'font-size:16px;line-height:1.7;color:' + C.text + '">' +
      '<div style="' + F + 'font-size:25px;line-height:1.3;font-weight:bold;color:' + C.navy + ';margin:0 0 8px">ברוכים הבאים, ' + esc(x.name) + '! 🎉</div>' +
      'המנוי שלכם ל-Clikeff מוכן, ואפשר להתחיל לשחק.</td></tr>' +
      /* פרטי הכניסה */
      '<tr><td style="padding:16px 30px 8px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.box + ';border:1px solid ' + C.line + ';border-radius:14px"><tr><td style="padding:18px 20px;' + F + 'font-size:15px;line-height:2;color:' + C.text + '">' +
      '<div style="' + F + 'font-size:16px;font-weight:bold;color:' + C.navy + ';margin-bottom:4px">🔐 פרטי הכניסה למנחה</div>' +
      'קישור: <a href="' + GAME_URL + '" style="color:#0a8fa3;font-weight:bold;text-decoration:none">' + GAME_URL + '</a><br>' +
      'מייל: <b>' + esc(x.email) + '</b><br>' +
      'סיסמה: <span style="display:inline-block;font-family:\'Courier New\',Courier,monospace;font-size:18px;font-weight:bold;color:' + C.navy + ';background:#ffffff;border:1px dashed #9fb3cf;border-radius:8px;padding:0 10px;direction:ltr">' + esc(x.pass) + '</span><br>' +
      'בתוקף עד: <b>' + fmt(x.expires) + '</b>' +
      '</td></tr></table></td></tr>' +
      /* שימוש אישי */
      '<tr><td style="padding:6px 30px 8px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff3f3;border:1px solid #ffd3d4;border-radius:12px"><tr><td style="padding:12px 16px;' + F + 'font-size:14px;line-height:1.7;color:' + C.text + '">' +
      '<b style="color:#c4373b">🔒 פרטי הכניסה אישיים</b><br>' +
      'המנוי מיועד לשימוש של <b>' + esc(x.name) + '</b> בלבד. אין להעביר את פרטי הכניסה לאנשים או למוסדות אחרים.<br>' +
      'מכירים עוד מישהו שירצה ליהנות מ-Clikeff? נשמח לעזור לו לפתוח מנוי משלו.' +
      '</td></tr></table></td></tr>' +
      /* כפתור */
      '<tr><td align="center" style="padding:14px 30px 22px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:' + C.coral + ';border-radius:999px">' +
      '<a href="' + GAME_URL + '" style="display:inline-block;padding:14px 36px;' + F + 'font-size:17px;font-weight:bold;color:#ffffff;text-decoration:none">כניסה למשחק</a>' +
      '</td></tr></table></td></tr>' +
      /* איך מתחילים */
      '<tr><td style="padding:4px 30px 4px">' +
      '<div style="' + F + 'font-size:18px;font-weight:bold;color:' + C.navy + ';margin-bottom:4px">🎯 איך מתחילים?</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
      step(1, '#ff5a5f', 'נכנסים לקישור', 'ולוחצים "פתיחת חידון חדש"') +
      step(2, '#3d7bff', 'בוחרים שאלות', 'מהמאגר המוכן, מקובץ אקסל, או כותבים לבד') +
      step(3, '#14c49a', 'פותחים את המשחק', 'ומציגים את המסך על המקרן') +
      '</table></td></tr>' +
      /* המשתתפים */
      '<tr><td style="padding:14px 30px 28px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff6e5;border-radius:14px"><tr><td style="padding:16px 20px;' + F + 'font-size:15px;line-height:1.7;color:' + C.text + '">' +
      '<b style="color:#a35f00">🙋 איך המשתתפים נכנסים?</b><br>' +
      'על המקרן מופיעים קישור וקוד של 6 ספרות. כל אחד נכנס מהטאבלט או מהמחשב, מקליד את הקוד, בוחר שם ודמות, ומופיע על המסך. בלי הרשמה ובלי התקנה!' +
      '</td></tr></table></td></tr>' +
      /* תחתית */
      '<tr><td align="center" style="background:' + C.box + ';border-top:1px solid ' + C.line + ';padding:22px 24px;' + F + 'font-size:14px;line-height:1.9;color:' + C.mute + '">' +
      '<b style="color:' + C.navy + '">יש שאלה? אני כאן בשבילכם 💬</b><br>' +
      '<a href="tel:+972504103847" style="color:' + C.text + ';text-decoration:none">050-410-3847</a> &nbsp;|&nbsp; ' +
      '<a href="mailto:rinatya3847@gmail.com" style="color:' + C.text + ';text-decoration:none">rinatya3847@gmail.com</a></td></tr>' +
      '</table>' +
      '<div style="' + F + 'font-size:12px;color:#94a3b8;margin-top:14px">Clikeff · לוחצים, נהנים, משחקים!</div>' +
      '</td></tr></table>';
  }
  /** מייל ניסיון: קצר, בצבעי זהב, עם "שעון" של 24 שעות */
  function trialHtml(x, C, F) {
    const G = '#ffb020';
    return '' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;direction:rtl"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;direction:rtl;text-align:right;border-top:6px solid ' + G + '">' +
      /* לוגו על רקע כהה + תג ניסיון */
      '<tr><td align="center" style="background:' + C.navy + ';padding:24px 24px 20px">' +
      '<img src="' + LOGO + '" width="180" alt="Clikeff" style="display:block;width:180px;max-width:60%;height:auto;border:0;margin:0 auto;color:#ffffff;' + F + 'font-size:28px;font-weight:bold">' +
      '<div style="display:inline-block;margin-top:12px;padding:6px 18px;border-radius:999px;background:' + G + ';' + F + 'font-size:15px;font-weight:bold;color:' + C.navy + '">⏳ 24 שעות של התנסות</div>' +
      '</td></tr>' +
      /* ברכה קצרה */
      '<tr><td align="center" style="padding:26px 28px 6px;' + F + 'font-size:16px;line-height:1.7;color:' + C.text + '">' +
      '<div style="' + F + 'font-size:23px;font-weight:bold;color:' + C.navy + ';margin-bottom:6px">שלום ' + esc(x.name) + '! 👋</div>' +
      'פתחנו לכם חשבון ניסיון, כדי שתרגישו את המשחק בעצמכם.</td></tr>' +
      /* פרטים */
      '<tr><td style="padding:14px 28px 6px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8e8;border:1px dashed ' + G + ';border-radius:14px"><tr><td style="padding:16px 20px;' + F + 'font-size:15px;line-height:2;color:' + C.text + '">' +
      'מייל: <b>' + esc(x.email) + '</b><br>' +
      'סיסמה: <span style="display:inline-block;font-family:\'Courier New\',Courier,monospace;font-size:18px;font-weight:bold;color:' + C.navy + ';background:#ffffff;border:1px solid #f1d49a;border-radius:8px;padding:0 10px;direction:ltr">' + esc(x.pass) + '</span><br>' +
      'פעיל עד: <b style="color:#b26b00">' + fmtT(x.expires) + '</b>' +
      '</td></tr></table></td></tr>' +
      /* כפתור */
      '<tr><td align="center" style="padding:18px 28px 8px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:' + C.coral + ';border-radius:999px">' +
      '<a href="' + GAME_URL + '" style="display:inline-block;padding:13px 34px;' + F + 'font-size:17px;font-weight:bold;color:#ffffff;text-decoration:none">בואו ננסה!</a>' +
      '</td></tr></table></td></tr>' +
      '<tr><td align="center" style="padding:6px 28px 24px;' + F + 'font-size:15px;line-height:1.7;color:' + C.mute + '">' +
      'אהבתם? נשמח לפתוח לכם מנוי שנתי מלא 🎉</td></tr>' +
      /* תחתית */
      '<tr><td align="center" style="background:' + C.box + ';border-top:1px solid ' + C.line + ';padding:16px 24px;' + F + 'font-size:14px;line-height:1.8;color:' + C.mute + '">' +
      '<a href="tel:+972504103847" style="color:' + C.text + ';text-decoration:none">050-410-3847</a> &nbsp;|&nbsp; ' +
      '<a href="mailto:rinatya3847@gmail.com" style="color:' + C.text + ';text-decoration:none">rinatya3847@gmail.com</a></td></tr>' +
      '</table>' +
      '<div style="' + F + 'font-size:12px;color:#94a3b8;margin-top:14px">Clikeff · לוחצים, נהנים, משחקים!</div>' +
      '</td></tr></table>';
  }
  const emailDoc = (x) => '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#eef2f7">' + emailHtml(x) + '</body></html>';
  const MAIL_SUBJECT_FULL = 'המנוי שלכם ל-Clikeff מוכן! 🎉';
  const subjectOf = (x) => (x.trial ? '24 שעות של Clikeff, עלינו! ⏳' : MAIL_SUBJECT_FULL);

  /** העתקה עם העיצוב (מדביקים במייל חדש ב-Gmail והעיצוב נשמר) */
  async function copyRich(html, text) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })]);
      return true;
    } catch (e) {
      const d = document.createElement('div');
      d.contentEditable = 'true'; d.style.cssText = 'position:fixed;left:-9999px;top:0';
      d.innerHTML = html; document.body.appendChild(d);
      const r = document.createRange(); r.selectNodeContents(d);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const ok = document.execCommand('copy');
      sel.removeAllRanges(); d.remove();
      return ok;
    }
  }

  function mailModal(x) {
    return '<div class="m-modal" role="dialog" aria-modal="true" aria-label="המייל ללקוח">' +
      '<div class="m-modal-box">' +
      '<div class="m-modal-head"><h3>המייל ל' + esc(x.name) + '</h3><button class="icon-btn" type="button" data-action="mail-close" aria-label="סגירה">' + A.icon('x') + '</button></div>' +
      '<div class="m-mail-to"><span>אל: <b dir="ltr">' + esc(x.email) + '</b></span><span>נושא: <b>' + esc(subjectOf(x)) + '</b></span></div>' +
      '<iframe class="m-mail-frame" title="תצוגת המייל" srcdoc="' + esc(emailDoc(x).split(LOGO).join(location.origin + '/assets/email-logo.png')) + '"></iframe>' +
      '<div class="m-modal-acts">' +
      '<button class="btn btn-accent btn-lg" type="button" data-action="mail-copy">' + ic('copy') + 'העתקת המייל המעוצב</button>' +
      '<a class="btn btn-ghost btn-lg" href="mailto:' + esc(x.email) + '?subject=' + encodeURIComponent(subjectOf(x)) + '">' + ic('mail') + 'פתיחת מייל חדש ללקוח</a>' +
      '</div>' +
      '<p class="m-hint">מעתיקים, פותחים מייל חדש, ומדביקים בגוף המייל (Ctrl+V). העיצוב נשמר.</p>' +
      '</div></div>';
  }

  /* ---------- מסגרת ---------- */
  function header() {
    return '<header class="admin-top">' +
      '<a class="admin-brand" href="admin.html">' + A.logo('logo-sm', true) + '<h1><span class="sr-only">Clikeff</span><small>ניהול מנויים</small></h1></a>' +
      '<span class="spacer"></span><div class="actions">' +
      (st.user ? '<span class="m-me" dir="ltr">' + esc(st.user.email || '') + '</span>' +
        '<a class="btn btn-ghost btn-sm" href="admin.html">' + ic('play') + 'למשחק</a>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="logout">' + ic('door') + 'יציאה</button>' : '') +
      '</div></header>';
  }
  function render(body) { $('#app').innerHTML = header() + body; }
  const wait = (t) => render('<section class="auth"><div class="auth-wait"><span class="spinner"></span>' + t + '</div></section>');

  /* ---------- כניסה ---------- */
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
        : '<button class="link-btn auth-forgot" type="button" data-action="mode" data-value="signup">פעם ראשונה כאן? יצירת חשבון מנהלת</button>') +
      '</form></section>');
    $('#m-login').addEventListener('submit', (e) => { e.preventDefault(); up ? doSignUp() : doSignIn(); });
    const pw = $('#m-pass'); if (pw) pw.focus();
  }

  function viewSetup() {
    render('<section class="auth"><div class="card auth-card m-msg">' +
      '<h2>החשבון שלך מוכן</h2>' +
      '<p>נשאר צעד אחד: להכניס לכללי האבטחה את מספר החשבון שלך.</p>' +
      '<code class="m-uid" dir="ltr">' + esc(st.user.uid) + '</code>' +
      '<button class="btn btn-primary btn-block" type="button" data-action="copy-uid">' + ic('copy') + 'העתקת המספר</button>' +
      '<button class="link-btn" type="button" data-action="retry">פרסמתי את הכללים, לנסות שוב</button>' +
      '</div></section>');
  }

  function viewNotOwner() {
    render('<section class="auth"><div class="card auth-card m-msg">' +
      '<h2>הדף הזה רק למנהלת</h2>' +
      '<p>נכנסת עם <bdi>' + esc(st.user.email) + '</bdi>. כדי לנהל מנויים צריך להיכנס עם חשבון המנהלת.</p>' +
      '<button class="btn btn-primary btn-block" type="button" data-action="logout">כניסה עם חשבון אחר</button>' +
      '<a class="link-btn" href="admin.html">למשחק</a>' +
      '</div></section>');
  }

  /* ---------- הלוח ---------- */
  function counts() {
    const c = { all: st.list.length, ok: 0, soon: 0, end: 0, stop: 0 };
    st.list.forEach((l) => { c[statusOf(l).k]++; });
    return c;
  }

  function newPanel() {
    const x = st.last, f = st.form;
    if (x) {
      return '<aside class="m-side m-done">' +
        '<div class="m-side-head"><span class="m-dot ok"></span><h3>המנוי של ' + esc(x.name) + ' מוכן</h3></div>' +
        '<p class="m-hint">שלחי ללקוח את הפרטים. הסיסמה שמורה גם ברשימת הלקוחות.</p>' +
        '<dl class="m-creds">' +
        '<dt>קישור</dt><dd dir="ltr">' + esc(GAME_URL) + '</dd>' +
        '<dt>מייל</dt><dd dir="ltr">' + esc(x.email) + '</dd>' +
        '<dt>סיסמה</dt><dd dir="ltr" class="pw">' + esc(x.pass) + '</dd>' +
        '<dt>בתוקף עד</dt><dd>' + fmt(x.expires) + '</dd></dl>' +
        '<div class="m-col">' +
        '<button class="btn btn-accent btn-block" type="button" data-action="mail-open">' + ic('mail') + 'תצוגת המייל והעתקה</button>' +
        '<div class="m-two">' +
        '<button class="btn btn-ghost" type="button" data-action="copy-msg">' + ic('copy') + 'העתקת טקסט</button>' +
        '<a class="btn btn-ghost" href="https://wa.me/' + waNum(x.phone) + '?text=' + encodeURIComponent(message(x)) + '" target="_blank" rel="noopener">' + ic('send') + 'וואטסאפ</a>' +
        '</div>' +
        '<button class="link-btn" type="button" data-action="new-again">יצירת לקוח נוסף</button>' +
        '</div></aside>';
    }
    return '<aside class="m-side">' +
      '<form id="m-new" novalidate>' +
      '<div class="m-side-head"><span class="m-dot"></span><h3>לקוח חדש</h3></div>' +
      '<label class="field"><span class="field-label">שם הלקוח או המוסד</span><input class="input" id="n-name" maxlength="60" placeholder="למשל: תורת בנימין" value="' + esc(f.name || '') + '"></label>' +
      '<label class="field"><span class="field-label">מייל להתחברות</span><input class="input" id="n-email" type="email" dir="ltr" placeholder="name@example.com" value="' + esc(f.email || '') + '"></label>' +
      '<label class="field"><span class="field-label">מספר לוואטסאפ <small>(לא חובה)</small></span><input class="input" id="n-phone" type="tel" dir="ltr" placeholder="05X-XXX-XXXX" value="' + esc(f.phone || '') + '"></label>' +
      '<div class="field"><span class="field-label">תקופה</span><div class="m-months" role="radiogroup">' +
      [[1, 'חודש'], [6, 'חצי שנה'], [12, 'שנה'], [24, 'שנתיים']].map((m) =>
        '<button type="button" class="chip" data-action="months" data-value="' + m[0] + '" aria-pressed="' + ((f.months || 12) === m[0]) + '">' + m[1] + '</button>').join('') +
      '</div></div>' +
      (f.exists ? '<div class="m-exists"><b>למייל הזה כבר יש חשבון, אבל בלי מנוי.</b>' +
        '<span>כנראה הוא נוצר לפני שכללי האבטחה עודכנו. כתבי את הסיסמה שנשלחה ללקוח, ונחבר אליו את המנוי.</span>' +
        '<label class="field"><span class="field-label">הסיסמה של הלקוח</span><input class="input" id="n-oldpass" dir="ltr" autocomplete="off"></label>' +
        '<button class="btn btn-primary btn-block" type="button" data-action="attach"' + (f.busy ? ' disabled' : '') + '>' + (f.busy ? 'מחברים…' : 'חיבור המנוי לחשבון הקיים') + '</button>' +
        '<button class="link-btn" type="button" data-action="attach-cancel">ביטול</button></div>' : '') +
      '<p class="form-error" role="alert">' + (f.error ? A.icon('alert') + esc(f.error) : '') + '</p>' +
      (f.exists ? '' : '<button class="btn btn-accent btn-lg btn-block" type="submit"' + (f.busy ? ' disabled' : '') + '>' + (f.busy ? 'יוצרים…' : 'יצירת מנוי') + '</button>') +
      '<p class="m-hint">המערכת יוצרת סיסמה, והמנוי מתחיל מהיום.</p>' +
      '</form></aside>';
  }

  function row(l) {
    const s = statusOf(l), open = st.open === l.id, editing = st.edit === l.id;
    return '<li class="m-row' + (open ? ' is-open' : '') + '">' +
      '<button class="m-row-head" type="button" data-action="open" data-value="' + esc(l.id) + '" aria-expanded="' + open + '">' +
      '<span class="m-av" style="--c:' + colorOf(l.name || l.email) + '">' + esc(initial(l)) + '</span>' +
      '<span class="m-who"><b>' + esc(l.name || 'בלי שם') + '</b><small dir="ltr">' + esc(l.email || '') + '</small></span>' +
      '<span class="m-plays' + (playsOf(l) ? '' : ' is-zero') + '" title="משחקים שנפתחו"><b>' + playsOf(l) + '</b><small>' + (playsOf(l) ? 'משחקים · ' + ago(tms(l.lastPlay)) + (l.lastPlayers != null ? ' · ' + l.lastPlayers + ' משתתפים' : '') : 'עוד לא שיחקו') + '</small></span>' +
      '<span class="m-when"><span class="m-badge ' + s.k + '">' + s.t + '</span><small>עד ' + untilOf(l) + '</small></span>' +
      '<span class="m-chev">' + A.icon('next') + '</span>' +
      '</button>' +
      (open ? '<div class="m-detail">' +
        (editing
          ? '<div class="m-edit">' +
            '<label class="field"><span class="field-label">שם</span><input class="input" id="e-name" maxlength="60" value="' + esc(l.name || '') + '"></label>' +
            '<label class="field"><span class="field-label">מספר לוואטסאפ</span><input class="input" id="e-phone" type="tel" dir="ltr" value="' + esc(l.phone || '') + '"></label>' +
            '<div class="m-acts"><button class="btn btn-primary btn-sm" type="button" data-action="save-edit" data-value="' + esc(l.id) + '">שמירה</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="cancel-edit">ביטול</button></div></div>'
          : '<dl class="m-info">' +
            '<div><dt>מייל</dt><dd dir="ltr">' + esc(l.email || '—') + '</dd></div>' +
            '<div><dt>מספר</dt><dd dir="ltr">' + (l.phone ? '<a href="https://wa.me/' + waNum(l.phone) + '" target="_blank" rel="noopener">' + esc(prettyPhone(l.phone)) + '</a>' : '—') + '</dd></div>' +
            '<div><dt>סיסמה</dt><dd>' + (l.pass
              ? '<code dir="ltr">' + (st.shown[l.id] ? esc(l.pass) : '••••••••') + '</code>' +
                '<button class="link-btn" type="button" data-action="show-pass" data-value="' + esc(l.id) + '">' + (st.shown[l.id] ? 'הסתרה' : 'הצגה') + '</button>' +
                (st.shown[l.id] ? '<button class="link-btn" type="button" data-action="copy-pass" data-value="' + esc(l.id) + '">העתקה</button>' : '')
              : '<span class="m-muted">לא שמורה</span>') + '</dd></div>' +
            '<div><dt>משחקים</dt><dd>' + (playsOf(l) ? '<b>' + playsOf(l) + '</b> · האחרון ' + fmtT(tms(l.lastPlay)) : 'עוד לא שיחקו') + '</dd></div>' +
            (gamesOf(l).length ? '<div><dt>משתתפים</dt><dd><b>' + kidsOf(l) + '</b> בסך הכול · ממוצע ' + Math.round(kidsOf(l) / gamesOf(l).length) + ' למשחק</dd></div>' : '') +
            '<div><dt>נפתח ב-</dt><dd>' + fmt(tms(l.createdAt)) + '</dd></div>' +
            '<div><dt>בתוקף עד</dt><dd>' + untilOf(l) + '</dd></div>' +
            '<div><dt>מצב</dt><dd><span class="m-badge ' + s.k + '">' + s.t + '</span></dd></div>' +
            '</dl>' +
            (gamesOf(l).length ? '<div class="m-games"><b>המשחקים האחרונים</b><ol>' +
              gamesOf(l).slice(-8).reverse().map((g) => '<li><span>' + fmtT(g.t) + '</span><b>' + (g.n || 0) + '</b><small>משתתפים</small></li>').join('') +
              '</ol></div>' : '') +
            '<div class="m-acts">' +
            '<button class="btn btn-primary btn-sm" type="button" data-action="renew" data-value="' + esc(l.id) + '">' + ic('reset') + (l.trial ? 'מנוי שנתי מלא' : 'חידוש לשנה') + '</button>' +
            (isTrial(l) ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-action="trial" data-value="' + esc(l.id) + '">' + ic('clock') + 'ניסיון 24 שעות</button>') +
            (l.pass ? '<button class="btn btn-ghost btn-sm" type="button" data-action="resend" data-value="' + esc(l.id) + '">' + ic('copy') + 'נוסח להעתקה</button>' : '') +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="edit" data-value="' + esc(l.id) + '">' + ic('edit') + 'עריכה</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="reset" data-value="' + esc(l.id) + '">' + ic('mail') + 'מייל לסיסמה חדשה</button>' +
            '<button class="btn btn-ghost btn-sm m-danger" type="button" data-action="toggle" data-value="' + esc(l.id) + '">' + (l.active === false ? 'הפעלה מחדש' : 'עצירת המנוי') + '</button>' +
            '</div>') +
        '</div>' : '') +
      '</li>';
  }

  /* ---------- פניות מהאתר ---------- */
  const leadMs = (l) => tms(l.at);
  function when(ms) {
    if (!ms) return '';
    const d = new Date(ms), now = new Date();
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return 'היום, ' + hm;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'אתמול, ' + hm;
    return fmt(ms) + ', ' + hm;
  }
  function leadCard(l) {
    return '<li class="m-lead' + (l.done ? ' is-done' : '') + '">' +
      '<div class="m-lead-head">' +
      '<span class="m-av" style="--c:' + colorOf(l.name) + '">' + esc(initial(l)) + '</span>' +
      '<div class="m-who"><b>' + esc(l.name || 'בלי שם') + '</b><small>' + esc(when(leadMs(l))) + '</small></div>' +
      '<span class="m-badge ' + (l.done ? 'stop' : 'soon') + '">' + (l.done ? 'טופלה' : 'חדשה') + '</span>' +
      '</div>' +
      '<div class="m-lead-body">' +
      '<span class="m-topic">' + esc(l.topic || '') + '</span>' +
      (l.msg ? '<p class="m-msg-text">' + esc(l.msg) + '</p>' : '') +
      '<div class="m-contact">' +
      (l.email ? '<a href="mailto:' + esc(l.email) + '" dir="ltr">' + ic('mail') + esc(l.email) + '</a>' : '') +
      (l.tel ? '<a href="https://wa.me/' + waNum(l.tel) + '" target="_blank" rel="noopener" dir="ltr">' + ic('send') + esc(prettyPhone(l.tel)) + '</a>' : '') +
      '</div></div>' +
      '<div class="m-note">' +
      '<div class="m-note-top"><label for="note-' + esc(l.id) + '">' + ic('edit') + 'ההערות שלי</label>' +
      '<button class="link-btn" type="button" data-action="note-date" data-value="' + esc(l.id) + '">+ תאריך היום</button>' +
      '<span class="m-note-st" id="note-st-' + esc(l.id) + '">' + (l.noteAt ? 'נשמר ' + esc(when(tms(l.noteAt) || l.noteAt)) : '') + '</span></div>' +
      '<textarea class="input m-note-text" id="note-' + esc(l.id) + '" data-id="' + esc(l.id) + '" rows="' + Math.min(8, Math.max(2, (l.note || '').split('\n').length + 1)) + '" maxlength="3000" placeholder="למשל: התקשרתי, לא ענתה. שלחתי מחירים במייל. לחזור אליה ביום ראשון.">' + esc(l.note || '') + '</textarea>' +
      '</div>' +
      '<div class="m-acts">' +
      '<button class="btn btn-primary btn-sm" type="button" data-action="lead-client" data-value="' + esc(l.id) + '">' + ic('sparkle') + 'יצירת מנוי</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-action="lead-done" data-value="' + esc(l.id) + '">' + (l.done ? 'החזרה לחדשות' : ic('check') + 'סימון שטופלה') + '</button>' +
      '<button class="btn btn-ghost btn-sm m-danger" type="button" data-action="lead-del" data-value="' + esc(l.id) + '">מחיקה</button>' +
      '</div></li>';
  }
  function leadsMain() {
    const nNew = st.leads.filter((l) => !l.done).length, nDone = st.leads.length - nNew;
    const rows = st.leads.filter((l) => st.leadFilter === 'all' || (st.leadFilter === 'new' ? !l.done : l.done)).sort((x, y) => leadMs(y) - leadMs(x));
    return '<div class="m-main">' +
      '<div class="m-tools"><div class="m-filters">' +
      [['new', 'חדשות', nNew], ['done', 'טופלו', nDone], ['all', 'הכול', st.leads.length]].map((f) =>
        '<button type="button" class="chip" data-action="lead-filter" data-value="' + f[0] + '" aria-pressed="' + (st.leadFilter === f[0]) + '">' + f[1] + ' <b>' + f[2] + '</b></button>').join('') +
      '</div></div>' +
      (st.leadsDenied ? '<div class="m-empty"><b>הפניות עוד לא זמינות</b><span>צריך לפרסם בפיירבייס את כללי האבטחה המעודכנים.</span></div>'
        : rows.length ? '<ul class="m-rows">' + rows.map(leadCard).join('') + '</ul>'
        : '<div class="m-empty"><b>' + (st.leadFilter === 'new' ? 'אין פניות חדשות' : 'אין פניות') + '</b><span>מי שימלא את טופס יצירת הקשר באתר יופיע כאן.</span></div>') +
      '</div>';
  }

  function clientsMain(c) {
    const q = st.q.trim().toLowerCase(), digits = q.replace(/\D/g, '');
    const rows = st.list
      .filter((l) => st.filter === 'all' || statusOf(l).k === st.filter)
      .filter((l) => !q || (l.name || '').toLowerCase().indexOf(q) >= 0 || (l.email || '').indexOf(q) >= 0 || (digits && (l.phone || '').indexOf(digits) >= 0))
      .sort((x, y) => (statusOf(x).k === 'ok' ? 1 : 0) - (statusOf(y).k === 'ok' ? 1 : 0) || expMs(x) - expMs(y));
    const FILTERS = [['all', 'הכול', c.all], ['ok', 'פעילים', c.ok], ['soon', 'מסתיימים בקרוב', c.soon], ['end', 'הסתיימו', c.end], ['stop', 'מושהים', c.stop]];
    return '<div class="m-main">' +
      '<div class="m-tools">' +
      '<div class="m-search-wrap">' + ic('search') + '<input class="input m-search" id="m-search" type="search" placeholder="חיפוש לפי שם, מייל או מספר" value="' + esc(st.q) + '"></div>' +
      '<div class="m-filters">' + FILTERS.map((f) => (f[0] === 'all' || f[2] ? '<button type="button" class="chip" data-action="filter" data-value="' + f[0] + '" aria-pressed="' + (st.filter === f[0]) + '">' + f[1] + ' <b>' + f[2] + '</b></button>' : '')).join('') + '</div>' +
      '</div>' +
      (rows.length ? '<ul class="m-rows">' + rows.map(row).join('') + '</ul>'
        : '<div class="m-empty"><b>' + (st.list.length ? 'לא נמצאו לקוחות' : 'עוד אין לקוחות') + '</b><span>' + (st.list.length ? 'נסי חיפוש אחר או סינון אחר.' : 'הלקוח הראשון שתיצרי יופיע כאן.') + '</span></div>') +
      '</div>';
  }

  function viewDash() {
    const c = counts(), nNew = st.leads.filter((l) => !l.done).length;
    render('<section class="admin-main manage">' +
      '<div class="m-top"><div><h2>ניהול מנויים</h2><p>כל הלקוחות והפניות במקום אחד</p></div>' +
      '<div class="m-stats">' +
      '<div><b>' + c.all + '</b><span>לקוחות</span></div>' +
      '<div class="ok"><b>' + (c.ok + c.soon) + '</b><span>פעילים</span></div>' +
      '<div class="soon"><b>' + c.soon + '</b><span>מסתיימים החודש</span></div>' +
      '<div class="play"><b>' + st.list.reduce((n, l) => n + playsOf(l), 0) + '</b><span>משחקים בסך הכול</span></div>' +
      '<div class="kids"><b>' + st.list.reduce((n, l) => n + kidsOf(l), 0) + '</b><span>משתתפים בסך הכול</span></div>' +
      '<div class="new"><b>' + nNew + '</b><span>פניות חדשות</span></div>' +
      '</div></div>' +
      '<div class="m-tabs" role="tablist">' +
      '<button type="button" role="tab" data-action="tab" data-value="clients" aria-selected="' + (st.tab === 'clients') + '">' + ic('users') + 'לקוחות <b>' + c.all + '</b></button>' +
      '<button type="button" role="tab" data-action="tab" data-value="leads" aria-selected="' + (st.tab === 'leads') + '">' + ic('mail') + 'פניות מהאתר ' + (nNew ? '<b class="hot">' + nNew + '</b>' : '<b>0</b>') + '</button>' +
      '</div>' +
      '<div class="m-layout">' +
      (st.tab === 'leads' ? leadsMain() : clientsMain(c)) +
      newPanel() +
      '</div></section>' + (st.mail && st.last ? mailModal(st.last) : ''));

    const form = $('#m-new');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); doCreate(); });
      ['name', 'email', 'phone'].forEach((k) => { const el = $('#n-' + k); if (el) el.addEventListener('input', () => { st.form[k] = el.value; }); });
    }
    document.querySelectorAll('.m-note-text').forEach((t) => {
      t.addEventListener('input', () => { t.rows = Math.min(8, Math.max(2, t.value.split('\n').length + 1)); const s = $('#note-st-' + t.dataset.id); if (s) s.textContent = 'לא נשמר עדיין…'; });
      t.addEventListener('blur', () => saveNote(t.dataset.id, t.value));
    });
    const s = $('#m-search');
    if (s) s.addEventListener('input', () => { st.q = s.value; const pos = s.selectionStart; viewDash(); const s2 = $('#m-search'); s2.focus(); s2.setSelectionRange(pos, pos); });
  }

  /* ---------- פעולות ---------- */
  async function route() {
    const u = N.user();
    st.user = u && !u.isAnonymous ? u : null;
    if (!st.user) return viewLogin();
    if (String(st.user.email || '').toLowerCase() !== N.OWNER) return viewNotOwner();
    N.useUser(st.user);
    wait('טוענים את הלקוחות…');
    const ok = await loadList();
    if (ok === 'denied') return viewSetup();
    viewDash();
    startLive();
  }

  let liveT = null;
  function startLive() {
    if (liveT || DEMO) return;
    const tick = async () => {
      if (document.hidden || !st.user || !$('.manage')) return;
      const ae = document.activeElement;
      if (st.edit || st.mail || (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) return;
      const y = window.scrollY;
      if (await loadList() === true && !st.edit && !st.mail) { viewDash(); window.scrollTo(0, y); }
    };
    liveT = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }
  async function loadList() {
    if (DEMO) return true;
    try { st.leads = await R.list('leads'); st.leadsDenied = false; }
    catch (e) { st.leads = []; st.leadsDenied = /permission/.test(e.code || ''); }
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
    try { await N.signUp(email, pass); st.mode = 'signin'; await route(); }
    catch (e) {
      if (/email-already-in-use/.test(e.code || '')) { st.mode = 'signin'; return viewLogin({ email, error: 'כבר יש חשבון למייל הזה. אפשר להיכנס.' }); }
      viewLogin({ email, error: N.authError(e) });
    }
  }

  async function doCreate() {
    const f = st.form;
    const name = ($('#n-name').value || '').trim(), email = ($('#n-email').value || '').trim().toLowerCase();
    const phone = ($('#n-phone').value || '').replace(/[^0-9+]/g, ''), months = f.months || 12;
    Object.assign(f, { name, email, phone, error: null });
    if (!name) { f.error = 'נא לכתוב את שם הלקוח'; return viewDash(); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { f.error = 'כתובת המייל לא נראית תקינה'; return viewDash(); }
    f.busy = true; viewDash();
    const pass = N.genPass();
    let newUid = null;
    try {
      const sec = firebase.apps.find((a) => a.name === 'creator') || firebase.initializeApp(window.FIREBASE_CONFIG, 'creator');
      await sec.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
      const c = await sec.auth().createUserWithEmailAndPassword(email, pass);
      newUid = c.user.uid;
      await sec.auth().signOut();
    } catch (e) {
      f.busy = false;
      if (/email-already-in-use/.test(e.code || '')) {
        const inList = st.list.some((x) => (x.email || '').toLowerCase() === email);
        if (inList) f.error = 'הלקוח הזה כבר ברשימה. אפשר לחדש לו את המנוי משם.';
        else { f.exists = true; f.error = null; }
      } else f.error = N.authError(e);
      return viewDash();
    }
    const exp = new Date(); exp.setMonth(exp.getMonth() + months);
    const doc = { name, email, phone, pass, passAt: R.NOW, active: true, expires: exp, months, createdAt: R.NOW, updatedAt: R.NOW };
    let ok = false;
    for (let t = 0; t < 3 && !ok; t++) {
      try { await R.set('licenses/' + newUid, doc); ok = true; } catch (e) { await new Promise((r) => setTimeout(r, 800)); }
    }
    f.busy = false;
    if (!ok) { f.error = 'החשבון נוצר אבל המנוי לא נשמר. שמרי את הסיסמה ' + pass + ' ונסי שוב בעוד רגע.'; return viewDash(); }
    st.last = { name, email, pass, phone, expires: exp.getTime() };
    st.form = {};
    await loadList();
    st.open = newUid;
    viewDash();
    A.toast('המנוי נוצר!', { type: 'ok' });
  }

  /** חשבון שכבר קיים בלי מנוי: נכנסים אליו (בצד, בלי לנתק את המנהלת) כדי לדעת את מספר החשבון, ושומרים מנוי */
  async function doAttach() {
    const f = st.form;
    const name = ($('#n-name').value || '').trim(), email = ($('#n-email').value || '').trim().toLowerCase();
    const phone = ($('#n-phone').value || '').replace(/[^0-9+]/g, ''), months = f.months || 12;
    const pass = ($('#n-oldpass').value || '').trim();
    Object.assign(f, { name, email, phone, error: null });
    if (!name) { f.error = 'נא לכתוב את שם הלקוח'; return viewDash(); }
    if (!pass) { f.error = 'נא לכתוב את הסיסמה של הלקוח'; return viewDash(); }
    f.busy = true; viewDash();
    let uidOf = null;
    try {
      const sec = firebase.apps.find((a) => a.name === 'creator') || firebase.initializeApp(window.FIREBASE_CONFIG, 'creator');
      await sec.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
      const c = await sec.auth().signInWithEmailAndPassword(email, pass);
      uidOf = c.user.uid;
      await sec.auth().signOut();
    } catch (e) {
      f.busy = false;
      f.error = /wrong-password|invalid-credential|INVALID_LOGIN/.test(e.code || e.message || '') ? 'הסיסמה לא מתאימה למייל הזה. בדקי בהודעה שנשלחה ללקוח.' : N.authError(e);
      return viewDash();
    }
    const exp = new Date(); exp.setMonth(exp.getMonth() + months);
    try {
      await R.set('licenses/' + uidOf, { name, email, phone, pass, passAt: R.NOW, active: true, expires: exp, months, createdAt: R.NOW, updatedAt: R.NOW });
    } catch (e) { f.busy = false; f.error = N.errorText(e); return viewDash(); }
    st.last = { name, email, pass, phone, expires: exp.getTime() };
    st.form = {};
    await loadList();
    st.open = uidOf;
    viewDash();
    A.toast('המנוי חובר לחשבון של ' + name, { type: 'ok' });
  }

  async function patch(id, data, okMsg) {
    try {
      if (!DEMO) await R.set('licenses/' + id, Object.assign({ updatedAt: R.NOW }, data), { merge: true });
      else Object.assign(st.list.find((x) => x.id === id), data);
      await loadList(); viewDash();
      if (okMsg) A.toast(okMsg, { type: 'ok' });
    } catch (e) { A.toast(N.errorText(e), { type: 'bad' }); }
  }

  async function leadPatch(id, data) {
    try {
      if (!DEMO) await R.set('leads/' + id, data, { merge: true });
      Object.assign(st.leads.find((x) => x.id === id) || {}, data);
      viewDash();
    } catch (e) { A.toast(N.errorText(e), { type: 'bad' }); }
  }
  async function saveNote(id, text) {
    const l = st.leads.find((x) => x.id === id); if (!l) return;
    const stEl = $('#note-st-' + id);
    if ((l.note || '') === text) { if (stEl && /לא נשמר/.test(stEl.textContent)) stEl.textContent = l.noteAt ? 'נשמר' : ''; return; }
    l.note = text; /* מיד, כדי שציור מחדש לא ימחק את מה שנכתב */
    if (stEl) stEl.textContent = 'שומרים…';
    try {
      if (!DEMO) await R.set('leads/' + id, { note: text, noteAt: R.NOW }, { merge: true });
      l.noteAt = Date.now();
      if (stEl) stEl.textContent = 'נשמר ✓';
    } catch (e) { if (stEl) stEl.textContent = 'לא נשמר'; A.toast(N.errorText(e), { type: 'bad' }); }
  }
  const find = (id) => st.list.find((x) => x.id === id);
  async function renew(id) {
    const l = find(id); if (!l) return;
    const d = new Date(l.trial ? Date.now() : Math.max(Date.now(), expMs(l))); d.setFullYear(d.getFullYear() + 1);
    return patch(id, { expires: DEMO ? { toMillis: () => d.getTime() } : d, active: true, trial: false }, 'המנוי של ' + (l.name || l.email) + ' חודש עד ' + fmt(d.getTime()));
  }
  async function trial(id) {
    const l = find(id); if (!l) return;
    if (!confirm('להפוך את המנוי של ' + (l.name || l.email) + ' לניסיון של 24 שעות מעכשיו?\nאחרי 24 שעות הם לא יוכלו לפתוח משחקים, עד שתלחצי "מנוי שנתי מלא".')) return;
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    await patch(id, { expires: DEMO ? { toMillis: () => d.getTime() } : d, active: true, trial: true }, 'ניסיון של 24 שעות, עד ' + fmtT(d.getTime()));
    if (l.pass) { st.last = { name: l.name || '', email: l.email, pass: l.pass, phone: l.phone, expires: d.getTime(), trial: true }; viewDash(); }
  }
  async function toggle(id) {
    const l = find(id); if (!l) return;
    const on = l.active === false;
    if (!on && !confirm('לעצור את המנוי של ' + (l.name || l.email) + '? הוא לא יוכל לפתוח משחקים עד שתפעילי מחדש.')) return;
    return patch(id, { active: on }, on ? 'המנוי הופעל מחדש' : 'המנוי נעצר');
  }
  async function saveEdit(id) {
    const name = ($('#e-name').value || '').trim(), phone = ($('#e-phone').value || '').replace(/[^0-9+]/g, '');
    if (!name) return A.toast('נא לכתוב שם', { type: 'bad' });
    st.edit = null;
    return patch(id, { name, phone }, 'הפרטים נשמרו');
  }
  async function resetPw(id) {
    const l = find(id); if (!l || !l.email) return;
    try { if (!DEMO) await N.resetPassword(l.email); A.toast('נשלח מייל לבחירת סיסמה חדשה אל ' + l.email, { type: 'ok', ms: 6000 }); }
    catch (e) { A.toast(N.authError(e), { type: 'bad' }); }
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const act = b.dataset.action, v = b.dataset.value;
    switch (act) {
      case 'mode': st.mode = v; return viewLogin({ email: ($('#m-email') || {}).value });
      case 'logout': if (DEMO) return; await N.signOut().catch(() => {}); st.last = null; return route();
      case 'copy-uid': return copy(st.user.uid, 'המספר הועתק');
      case 'retry': try { await st.user.getIdToken(true); } catch (err) { /* */ } return route();
      case 'months': st.form.months = Number(v); return viewDash();
      case 'attach': return doAttach();
      case 'attach-cancel': st.form.exists = false; st.form.error = null; return viewDash();
      case 'filter': st.filter = v; return viewDash();
      case 'tab': st.tab = v; return viewDash();
      case 'mail-open': st.mail = true; return viewDash();
      case 'mail-close': st.mail = false; return viewDash();
      case 'mail-copy': {
        if (!st.last) return;
        const ok = await copyRich(emailHtml(st.last), plain(st.last));
        A.toast(ok ? 'המייל הועתק! פותחים מייל חדש ומדביקים (Ctrl+V)' : 'לא הצלחנו להעתיק', { type: ok ? 'ok' : 'bad', ms: 6000 });
        return;
      }
      case 'lead-filter': st.leadFilter = v; return viewDash();
      case 'note-date': {
        const t = $('#note-' + v); if (!t) return;
        const d = new Date(), stamp = d.getDate() + '.' + (d.getMonth() + 1) + ': ';
        t.value = t.value ? t.value.replace(/\s+$/, '') + '\n' + stamp : stamp;
        t.rows = Math.min(8, Math.max(2, t.value.split('\n').length + 1));
        t.focus(); t.setSelectionRange(t.value.length, t.value.length);
        return;
      }
      case 'lead-client': {
        const l = st.leads.find((x) => x.id === v); if (!l) return;
        st.last = null; st.form = { name: l.name, email: l.email, phone: l.tel, months: 12 };
        st.tab = 'clients'; viewDash();
        const side = $('.m-side'); if (side) side.scrollIntoView({ behavior: 'smooth', block: 'start' });
        A.toast('הפרטים הועתקו לטופס "לקוח חדש". בודקים ולוחצים "יצירת מנוי".', { type: 'ok', ms: 5000 });
        if (!l.done) leadPatch(l.id, { done: true });
        return;
      }
      case 'lead-done': { const l = st.leads.find((x) => x.id === v); return l && leadPatch(v, { done: !l.done }); }
      case 'lead-del': {
        const l = st.leads.find((x) => x.id === v); if (!l || !confirm('למחוק את הפנייה של ' + (l.name || '') + '?')) return;
        try { if (!DEMO) await R.del('leads/' + v); st.leads = st.leads.filter((x) => x.id !== v); viewDash(); A.toast('הפנייה נמחקה', { type: 'ok' }); }
        catch (err) { A.toast(N.errorText(err), { type: 'bad' }); }
        return;
      }
      case 'open': st.open = st.open === v ? null : v; st.edit = null; return viewDash();
      case 'show-pass': st.shown[v] = !st.shown[v]; return viewDash();
      case 'copy-pass': { const l = find(v); return l && copy(l.pass, 'הסיסמה הועתקה'); }
      case 'copy-msg': return st.last && copy(message(st.last), 'ההודעה הועתקה. מדביקים בוואטסאפ, והעיצוב נשמר.');
      case 'new-again': { st.mail = false; st.last = null; st.form = {}; viewDash(); const n = $('#n-name'); if (n) n.focus(); return; }
      case 'resend': {
        const l = find(v); if (!l) return;
        st.last = { name: l.name || '', email: l.email, pass: l.pass, phone: l.phone, expires: expMs(l), trial: isTrial(l) };
        viewDash(); const side = $('.m-side'); if (side) side.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      case 'edit': { st.edit = v; viewDash(); const n = $('#e-name'); if (n) n.focus(); return; }
      case 'cancel-edit': st.edit = null; return viewDash();
      case 'save-edit': return saveEdit(v);
      case 'renew': return renew(v);
      case 'trial': return trial(v);
      case 'toggle': return toggle(v);
      case 'reset': return resetPw(v);
    }
  });

  A.mountDeco();
  if (DEMO) {
    /* מצב הדגמה לצילומי מסך: לקוחות דמיוניים, בלי חיבור לשרת */
    const T = (d) => ({ toMillis: () => Date.now() + d * 864e5 });
    st.user = { email: N.OWNER, uid: 'demo' };
    st.list = [
      { id: 'a', name: 'תורת בנימין', email: 'yedidhashem@gmail.com', phone: '0504293936', pass: 'Kfmr-4827', active: true, expires: T(364), createdAt: T(-1), plays: 3, lastPlay: T(0), lastPlayers: 24, games: [{ t: T(-2).toMillis(), n: 18 }, { t: T(-1).toMillis(), n: 27 }, { t: T(0).toMillis(), n: 24 }] },
      { id: 'b', name: 'בית יעקב רמות', email: 'office@by-ramot.co.il', phone: '0527712345', pass: 'Hwnt-5392', active: true, expires: T(21), createdAt: T(-344), plays: 47, lastPlay: T(-1), lastPlayers: 31, games: [{ t: T(-3).toMillis(), n: 29 }, { t: T(-1).toMillis(), n: 31 }] },
      { id: 'c', name: 'תלמוד תורה נועם', email: 'noam.tt@gmail.com', pass: 'Pqzd-2266', active: true, expires: T(-6), createdAt: T(-371) },
      { id: 'd', name: 'קייטנת שמחה', email: 'simcha.camp@gmail.com', phone: '0548800112', pass: 'Rtbe-7734', active: false, expires: T(120), createdAt: T(-60) },
      { id: 'e', name: 'ישיבת אור התורה', email: 'or.hatorah@gmail.com', phone: '0533344556', pass: 'Mxkc-3958', active: true, expires: T(230), createdAt: T(-135) }
    ];
    st.leads = [
      { id: 'l1', name: 'משה כהן', email: 'moshe.c@gmail.com', tel: '0541234567', topic: 'רכישת מנוי שנתי', msg: 'שלום, אני מלמד בתלמוד תורה בבני ברק, כ-25 תלמידים בכיתה. אשמח לפרטים על מנוי לשנה.', at: T(-0.05), done: false },
      { id: 'l2', name: 'רבקה לוי', email: '', tel: '0527654321', topic: 'חידון לאירוע', msg: 'מסיבת חנוכה לבנות, בערך 60 משתתפות.', at: T(-1.2), done: false },
      { id: 'l3', name: 'יעקב פרידמן', email: 'yfr@gmail.com', tel: '', topic: 'יש לי שאלה', msg: 'האם זה עובד גם עם טאבלטים של המוסד?', at: T(-6), done: true }
    ];
    viewDash();
    return;
  }
  wait('מתחברים…');
  N.initAuth().then(route).catch((e) => render('<section class="auth"><p class="form-error">' + esc(N.errorText(e)) + '</p></section>'));
})(window.App);

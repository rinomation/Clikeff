/* =========================================================
   קליקרים — תבניות לוח המנחה (תצוגה בלבד)
   ========================================================= */
(function (A) {
  'use strict';
  const esc = A.esc;
  const V = (A.AdminView = {});

  V.TRACKS = [
    { id: 'fun', name: 'שמח וקופצני', desc: 'מרימבה עליזה', img: 'party_popper' },
    { id: 'chase', name: 'חגיגה', desc: 'בסגנון פריילעך', img: 'balloon' },
    { id: 'drama', name: 'מתח קליל', desc: 'פריטות מותחות', img: 'hourglass_not_done' },
    { id: 'mystery', name: 'סקרנות', desc: 'צלצולים שקטים', img: 'owl' },
    { id: 'cinema', name: 'רגוע', desc: 'נעים ושקט', img: 'rainbow' }
  ];
  V.track = (id) => V.TRACKS.find((t) => t.id === id) || V.TRACKS[0];

  const STEPS = ['הכנה', 'לובי', 'משחק', 'תוצאות'];

  /* ---------- כותרת ---------- */
  V.header = (d) =>
    '<header class="admin-top">' +
    '<a class="admin-brand" href="admin.html">' + A.logo('logo-sm') +
    '<h1><span class="sr-only">Clikeff</span><small>לוח המנחה</small></h1></a>' +
    '<span class="spacer"></span>' +
    '<nav class="steps" aria-label="שלבי המשחק">' +
    STEPS.map((s, i) => '<span class="' + (i < d.step ? 'is-done' : i === d.step ? 'is-current' : '') + '"' +
      (i === d.step ? ' aria-current="step"' : '') + '><i>' + (i < d.step ? '✓' : i + 1) + '</i>' + s + '</span>').join('') +
    '</nav>' +
    '<span class="spacer"></span>' +
    '<div class="actions">' + A.theme.button() +
    '<button class="icon-btn" type="button" data-action="mute" aria-pressed="' + !!d.muted + '" aria-label="' + (d.muted ? 'הפעלת צליל' : 'השתקה') + '">' +
    A.icon(d.muted ? 'mute' : 'volume') + '</button></div>' +
    '</header>';

  /* ---------- הכנה ----------
     d = { source:'builtin'|'file', duration, track, playing, showRank,
           saved:{title,count,updated}|null, preview:{fileName,rows:[...]}|null } */
  /* ---------- מסך ראשי ---------- */
  V.home = () =>
    '<section class="home">' +
    '<div class="home-hero">' +
    '<h1 class="home-title">' + A.logo('logo-xl', true) + '</h1>' +
    '<p class="tagline" aria-label="לוחצים, נהנים, משחקים!"><span style="--i:0">לוחצים,</span> <span style="--i:1">נהנים,</span> <span style="--i:2">משחקים!</span></p>' +
    '<p class="home-sub">השאלה עולה על המסך הגדול, וכל אחד עונה בלחיצה מהמכשיר שלו.</p>' +
    '<button class="btn btn-accent btn-xl" type="button" data-action="go-setup">' + A.icon('sparkle') + 'פתיחת חידון חדש</button>' +
    '</div>' +
    '<div class="tapes" aria-hidden="true">' +
    [['פרשת השבוע', 'חנוכה', 'הלכות שבת', 'לוח הכפל', 'משניות', 'ארץ ישראל', 'ברכות', 'חזרה למבחן'],
      ['חגים ומועדים', 'נביאים', 'גדולי ישראל', 'מגילת אסתר', 'דקדוק', 'חשבון', 'בעלי חיים', 'מסיבת סיום']
    ].map((row, k) => { const t = row.map((w) => '<span>' + w + '</span>').join(''); return '<div class="tape tape-' + (k ? 'b' : 'a') + '"><div class="tape-row">' + t + t + '</div></div>'; }).join('') +
    '</div></section>';

  /* ---------- הכנה: שני שלבים בלשוניות ---------- */
  V.summary = (d) => {
    const t = V.track(d.track);
    const q = d.source === 'file' && d.saved ? '<b>' + d.saved.count + '</b> שאלות · ' + esc(d.saved.title) : '<b>10</b> שאלות מהמאגר';
    const sync = d.mode !== 'self';
    const items = [
      ['books', q],
      ['alarm_clock', '<b>' + d.duration + '</b> שניות לשאלה'],
      ['video_game', sync ? 'כולם יחד על המקרן' : 'כל אחד בקצב שלו']
    ];
    if (sync) {
      items.push(['hourglass_not_done', d.advance === 'manual' ? 'מעבר בלחיצה' : 'מעבר אוטומטי']);
      items.push(['crown', d.teams ? '<b>' + d.teams + '</b> קבוצות: ' + esc(A.Teams.names(d).slice(0, d.teams).join(', ')) : 'בלי קבוצות']);
      items.push(['trophy', d.boardEvery === 0 ? 'בלי טבלת מובילים' : 'מובילים כל <b>' + (d.boardEvery || 3) + '</b>']);
    }
    items.push([t.img, esc(t.name)]);
    if (d.showRank) items.push(['glowing_star', 'דירוג אישי']);
    return items.map((x) => '<span class="pill"><img src="' + A.img(x[0]) + '" alt="">' + x[1] + '</span>').join('');
  };

  /* שמות הקבוצות: רשימה מוכנה או שמות משלי */
  V.teamNamesField = (d) => {
    const T = A.Teams, cur = d.teamSet || T.DEFAULT, n = d.teams || 0;
    const names = T.names(d).slice(0, n);
    const room = { teamSet: cur, teamNames: names };
    return '<div class="field"><span class="field-label">שמות הקבוצות</span>' +
      '<div class="team-sets" role="group" aria-label="שמות הקבוצות">' + T.SETS.map((s) =>
        '<button type="button" class="chip" data-action="teamSet" data-value="' + s.id + '" aria-pressed="' + (cur === s.id) + '">' + esc(s.label) + '</button>').join('') + '</div>' +
      (cur === 'custom'
        ? '<div class="team-inputs">' + names.map((nm, i) => { const t = T.get(i, room);
            return '<label class="team-input" style="--c:' + t.color + '"><img src="' + t.pic + '" alt=""><input class="input" data-team-name="' + i + '" maxlength="' + T.MAX_NAME + '" placeholder="' + esc(T.SETS[0].names[i]) + '" value="' + esc(((d.teamNames || [])[i]) || '') + '" aria-label="שם קבוצה ' + (i + 1) + '"></label>'; }).join('') + '</div>' +
          '<span class="field-hint">משאירים ריק? הקבוצה תקבל שם של אבן מהחושן.</span>'
        : '<div class="team-preview">' + names.map((nm, i) => { const t = T.get(i, room);
            return '<span class="team-chip" style="--c:' + t.color + '"><img src="' + t.pic + '" alt="">' + esc(t.name) + '</span>'; }).join('') + '</div>') +
      '</div>';
  };

  V.setup = (d) => {
    const tab = d.tab === 'settings' ? 'settings' : 'questions';
    return (
      '<section class="admin-main">' +
      '<div class="page-head setup-head"><div><h2>מכינים חידון חדש</h2>' +
      '<p>קודם בוחרים שאלות, אחר כך מסדרים הגדרות, ופותחים משחק.</p></div></div>' +
      '<div class="setup-tabs" role="tablist">' +
      '<button type="button" role="tab" data-action="tab" data-value="questions" aria-selected="' + (tab === 'questions') + '"><i>א</i>שאלות</button>' +
      '<button type="button" role="tab" data-action="tab" data-value="settings" aria-selected="' + (tab === 'settings') + '"><i>ב</i>הגדרות</button>' +
      '</div>' +
      '<div class="setup-panel">' +
      (tab === 'questions'
        ? V.questionsCard(d) + (d.editor || d.preview ? '' :
          '<div class="tab-next"><button class="btn btn-primary btn-lg" type="button" data-action="tab" data-value="settings">המשך להגדרות ' + A.icon('next') + '</button></div>')
        : V.settingsCard(d) +
          '<div class="tab-next"><button class="btn btn-ghost" type="button" data-action="tab" data-value="questions">' + A.icon('prev') + 'חזרה לשאלות</button></div>') +
      '</div>' +
      '<div class="launch-bar">' +
      '<div class="lb-meta" id="setup-summary"><span class="lb-title">סיכום:</span>' + V.summary(d) + '</div>' +
      '<button class="btn btn-accent btn-lg" type="button" data-action="open-room">' + A.icon('sparkle') + 'פתיחת המשחק</button>' +
      '</div>' +
      '</section>'
    );
  };

  V.questionsCard = (d) => {
    let body = '';
    if (d.source === 'builtin') {
      body =
        '<div class="info-box"><img src="' + A.img('scroll') + '" alt="">' +
        '<div><b>10 שאלות אקראיות מהמאגר</b>' +
        '<p>תנ"ך, מסורת וידע כללי. בכל משחק נבחרות שאלות אחרות, והתשובות מעורבבות.</p></div></div>';
    } else if (d.editor) {
      body = V.editor(d.editor);
    } else if (d.preview) {
      const rows = d.preview.rows;
      const ok = rows.filter((r) => r.valid);
      const bad = rows.length - ok.length;
      const surveys = ok.filter((r) => r.type === 'survey').length;
      body =
        '<div class="summary">' +
        '<span class="pill">' + A.icon('file') + '<bdi>' + esc(d.preview.fileName) + '</bdi></span>' +
        '<span class="badge badge-ok">' + A.icon('check') + (ok.length - surveys) + ' שאלות</span>' +
        (surveys ? '<span class="badge badge-primary">📊 ' + surveys + ' סקרים</span>' : '') +
        (bad ? '<span class="badge badge-bad">' + A.icon('x') + bad + ' שורות נפסלו</span>' : '') +
        '</div>' +
        '<div class="table-wrap"><table class="table">' +
        '<thead><tr><th>שורה</th><th>סוג</th><th>שאלה</th><th>תשובות</th><th>סטטוס</th></tr></thead><tbody>' +
        rows.map(V.previewRow).join('') +
        '</tbody></table></div>' +
        '<div class="card-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="cancel-preview">ביטול</button>' +
        '<button class="btn btn-primary" type="button" data-action="save-preview"' + (ok.length ? '' : ' disabled') + '>' +
        A.icon('check') + 'שמירת ' + ok.length + ' פריטים</button>' +
        '</div>';
    } else {
      body =
        (d.saved
          ? '<div class="saved-set"><img src="' + A.img('books') + '" alt="">' +
            '<div class="meta"><b>' + esc(d.saved.title) + '</b><span>' + d.saved.count + ' פריטים · נשמר ' + esc(d.saved.updated) + '</span></div>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="qe-open" data-value="saved">✏️ עריכה</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="delete-saved" aria-label="מחיקת השאלות השמורות">' + A.icon('trash') + '</button>' +
            '</div><p class="field-hint" style="margin:14px 0 8px">רוצים להחליף? העלו קובץ חדש:</p>'
          : '') +
        '<label class="dropzone" id="dropzone">' +
        '<input type="file" id="file-input" accept=".xlsx,.xls,.csv">' +
        '<img src="' + A.img('wrapped_gift') + '" alt="">' +
        '<b>גררו לכאן קובץ אקסל</b><span>או לחצו לבחירת קובץ (xlsx)</span></label>' +
        '<button class="btn btn-primary btn-block" type="button" data-action="qe-open" data-value="new" style="margin-top:12px">✍️ כתיבת שאלות בעצמי</button>' +
        '<p style="margin-top:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:var(--text-mute);font-size:.9rem">' +
        'אין לכם קובץ? <button class="link-btn" type="button" data-action="template">' + A.icon('download') + 'הורדת תבנית ריקה</button></p>';
    }

    return (
      '<div class="card">' +
      '<h3 class="card-title"><img src="' + A.img('books') + '" alt="">השאלות</h3>' +
      '<div class="segmented" role="group" aria-label="מקור השאלות">' +
      '<button type="button" data-action="source" data-value="builtin" aria-pressed="' + (d.source === 'builtin') + '"><img src="' + A.img('scroll') + '" alt="">מאגר מובנה</button>' +
      '<button type="button" data-action="source" data-value="file" aria-pressed="' + (d.source === 'file') + '"><img src="' + A.img('wrapped_gift') + '" alt="">הקובץ שלי' +
      (d.saved ? ' <span class="badge badge-primary">' + d.saved.count + '</span>' : '') + '</button>' +
      '</div>' + body + '</div>'
    );
  };

  /* ---------- כתיבת שאלות ידנית ----------
     d.editor = { title, items:[{k,t,a,c}], form:{k,t,a:[],c,idx}, error } */
  V.editor = (ed) => {
    const f = ed.form;
    const isS = f.k === 's';
    const list = ed.items.length
      ? '<ol class="qe-list">' + ed.items.map((it, n) =>
        '<li class="qe-item' + (f.idx === n ? ' is-editing' : '') + '">' +
        '<span class="qe-num">' + (n + 1) + '</span>' +
        '<div class="qe-body"><b>' + (it.k === 's' ? '📊 ' : '') + esc(it.t) + '</b><div class="ans-list">' +
        it.a.map((a, j) => '<span class="ans' + (it.k !== 's' && j === it.c ? ' is-correct' : '') + '">' + esc(a) + '</span>').join('') +
        '</div></div>' +
        '<div class="qe-tools">' +
        '<button class="icon-btn" type="button" data-action="qe-up" data-value="' + n + '" aria-label="למעלה"' + (n === 0 ? ' disabled' : '') + '>' + A.icon('prev') + '</button>' +
        '<button class="icon-btn" type="button" data-action="qe-down" data-value="' + n + '" aria-label="למטה"' + (n === ed.items.length - 1 ? ' disabled' : '') + '>' + A.icon('next') + '</button>' +
        '<button class="icon-btn" type="button" data-action="qe-edit" data-value="' + n + '" aria-label="עריכה">✏️</button>' +
        '<button class="icon-btn" type="button" data-action="qe-del" data-value="' + n + '" aria-label="מחיקה">' + A.icon('trash') + '</button>' +
        '</div></li>').join('') + '</ol>'
      : '<p class="field-hint" style="text-align:center;padding:10px">עוד אין שאלות. כתבו את הראשונה בטופס למטה.</p>';

    const form =
      '<div class="qe-form">' +
      '<h4>' + (f.idx != null ? 'עריכת שאלה ' + (f.idx + 1) : 'שאלה חדשה') + '</h4>' +
      '<div class="segmented" style="margin-bottom:12px">' +
      '<button type="button" data-action="qe-kind" data-value="q" aria-pressed="' + !isS + '">שאלה (עם תשובה נכונה)</button>' +
      '<button type="button" data-action="qe-kind" data-value="s" aria-pressed="' + isS + '">📊 סקר (בלי ניקוד)</button></div>' +
      '<label class="field"><span class="field-label">' + (isS ? 'שאלת הסקר' : 'השאלה') + '</span>' +
      '<textarea class="input" id="qe-text" rows="2" maxlength="200">' + esc(f.t) + '</textarea></label>' +
      '<div class="field"><span class="field-label">תשובות' + (isS ? '' : ' (סמנו את הנכונה)') + '</span>' +
      f.a.map((a, j) =>
        '<div class="qe-ans">' +
        (isS ? '<span class="qe-shape" style="--c:var(--a' + (j + 1) + ')">' + A.shape(j) + '</span>' :
          '<label class="qe-correct" title="התשובה הנכונה"><input type="radio" name="qe-c" value="' + j + '"' + (f.c === j ? ' checked' : '') + '>' +
          '<span class="qe-shape" style="--c:var(--a' + (j + 1) + ')">' + A.shape(j) + '</span></label>') +
        '<input class="input qe-a" data-j="' + j + '" maxlength="80" placeholder="תשובה ' + (j + 1) + '" value="' + esc(a) + '">' +
        (f.a.length > 2 ? '<button class="icon-btn" type="button" data-action="qe-rm-ans" data-value="' + j + '" aria-label="הסרת תשובה">' + A.icon('x') + '</button>' : '') +
        '</div>').join('') +
      (f.a.length < 6 ? '<button class="link-btn" type="button" data-action="qe-add-ans">+ הוספת תשובה</button>' : '') +
      '</div>' +
      '<p class="form-error">' + (ed.error ? A.icon('alert') + esc(ed.error) : '') + '</p>' +
      '<div class="card-actions" style="margin-top:6px">' +
      (f.idx != null ? '<button class="btn btn-ghost" type="button" data-action="qe-cancel-edit">ביטול עריכה</button>' : '') +
      '<button class="btn btn-primary" type="button" data-action="qe-save-item">' + A.icon('check') + (f.idx != null ? 'עדכון השאלה' : 'הוספה לרשימה') + '</button>' +
      '</div></div>';

    return '<label class="field"><span class="field-label">שם החידון</span>' +
      '<input class="input" id="qe-title" maxlength="60" value="' + esc(ed.title) + '" placeholder="למשל: חידון חנוכה"></label>' +
      list + form +
      '<div class="card-actions">' +
      '<button class="btn btn-ghost" type="button" data-action="qe-close">ביטול</button>' +
      '<button class="btn btn-accent" type="button" data-action="qe-save-all"' + (ed.items.length ? '' : ' disabled') + '>' +
      A.icon('check') + 'שמירת ' + ed.items.length + ' שאלות</button></div>';
  };

  /* r = { row, type:'question'|'survey'|null, text, answers:[], correct, valid, reason } */
  V.previewRow = (r) =>
    '<tr class="' + (r.valid ? '' : 'is-invalid') + '">' +
    '<td class="num">' + r.row + '</td>' +
    '<td>' + (r.type === 'survey' ? '<span class="badge badge-primary">📊 סקר</span>' :
      r.type === 'question' ? '<span class="badge">שאלה</span>' : '<span class="badge badge-bad">?</span>') + '</td>' +
    '<td class="q">' + (r.text ? esc(r.text) : '<span style="color:var(--bad)">חסרה שאלה</span>') + '</td>' +
    '<td><div class="ans-list">' + (r.answers || []).map((a, i) =>
      '<span class="ans' + (r.type === 'question' && i === r.correct ? ' is-correct' : '') + (a === '' ? ' is-empty' : '') + '">' +
      (r.type === 'question' && i === r.correct ? A.icon('check') : '') + (a === '' ? 'ריק' : esc(a)) + '</span>').join('') + '</div></td>' +
    '<td>' + (r.valid ? '<span class="badge badge-ok">' + A.icon('check') + 'תקין</span>' :
      '<span class="reason">' + A.icon('alert') + esc(r.reason) + '</span>') + '</td>' +
    '</tr>';

  V.settingsCard = (d) => {
    const fill = ((d.duration - 5) / 55) * 100;
    return (
      '<div class="card">' +
      '<h3 class="card-title"><img src="' + A.img('video_game') + '" alt="">הגדרות</h3>' +
      '<div class="field"><div class="field-row"><label class="field-label" for="duration">זמן לכל שאלה</label>' +
      '<span class="time-value"><b id="duration-value">' + d.duration + '</b> שניות</span></div>' +
      '<input class="range" type="range" id="duration" min="5" max="60" step="5" value="' + d.duration + '" style="--fill:' + fill + '%">' +
      '<div class="range-scale" aria-hidden="true">' + [5, 15, 30, 45, 60].map((v) =>
        '<span style="inset-inline-start:' + ((v - 5) / 55) * 100 + '%">' + v + '</span>').join('') + '</div></div>' +
      '<div class="field"><span class="field-label">צורת המשחק</span>' +
      '<div class="segmented" role="group" aria-label="צורת המשחק" style="margin:0">' +
      '<button type="button" data-action="mode" data-value="sync" aria-pressed="' + (d.mode !== 'self') + '">כולם יחד על המקרן</button>' +
      '<button type="button" data-action="mode" data-value="self" aria-pressed="' + (d.mode === 'self') + '">כל אחד בקצב שלו</button>' +
      '</div><span class="field-hint">' + (d.mode === 'self' ? 'כל ילד רואה את השאלות במסך שלו ומתקדם לבד.' : 'השאלות מוצגות במסך שלך, ואצל הילדים מופיעים רק כפתורי התשובות.') + '</span></div>' +
      (d.mode !== 'self' ? '<div class="field"><span class="field-label">משחק קבוצות</span>' +
      '<div class="segmented" role="group" aria-label="משחק קבוצות" style="margin:0;grid-template-columns:repeat(4,1fr)">' +
      [[0, 'בלי'], [2, '2 קבוצות'], [3, '3 קבוצות'], [4, '4 קבוצות']].map(([n, l]) =>
        '<button type="button" data-action="teams" data-value="' + n + '" aria-pressed="' + ((d.teams || 0) === n) + '">' + l + '</button>').join('') +
      '</div>' + (d.teams ? '<span class="field-hint">המשתתפים מתחלקים אוטומטית. ניקוד קבוצה = ממוצע הנקודות של חבריה.</span>' : '') + '</div>' : '') +
      (d.mode !== 'self' && d.teams ? V.teamNamesField(d) : '') +
      (d.mode !== 'self' ? '<div class="field"><span class="field-label">טבלת מובילים על המקרן</span>' +
      '<div class="segmented" role="group" aria-label="טבלת מובילים" style="margin:0;grid-template-columns:repeat(3,1fr)">' +
      [[3, 'כל 3 שאלות'], [5, 'כל 5 שאלות'], [0, 'בלי']].map(([n, l]) =>
        '<button type="button" data-action="boardEvery" data-value="' + n + '" aria-pressed="' + ((d.boardEvery == null ? 3 : d.boardEvery) === n) + '">' + l + '</button>').join('') +
      '</div></div>' : '') +
      (d.mode !== 'self' ? '<div class="field"><span class="field-label">מעבר בין שאלות</span>' +
      '<div class="segmented" role="group" aria-label="מעבר בין שאלות" style="margin:0">' +
      '<button type="button" data-action="advance" data-value="auto" aria-pressed="' + (d.advance !== 'manual') + '">אוטומטי</button>' +
      '<button type="button" data-action="advance" data-value="manual" aria-pressed="' + (d.advance === 'manual') + '">המנחה לוחץ "הבאה"</button>' +
      '</div><span class="field-hint">' + (d.advance === 'manual' ? 'אחרי התוצאות המשחק מחכה עד שתלחצו על "לשאלה הבאה".' : 'אחרי 8 שניות של תוצאות עוברים לבד לשאלה הבאה.') + '</span></div>' : '') +
      '<fieldset class="field" style="margin-bottom:0"><legend>מוזיקת רקע</legend><div class="tracks" role="radiogroup">' +
      V.TRACKS.map((t) =>
        '<label class="track' + (t.id === d.track ? ' is-selected' : '') + '">' +
        '<input type="radio" name="track" value="' + t.id + '"' + (t.id === d.track ? ' checked' : '') + '>' +
        '<img src="' + A.img(t.img) + '" alt="">' +
        '<span class="t-meta"><b>' + t.name + '</b><span>' + t.desc + '</span></span>' +
        '<button type="button" class="play' + (d.playing === t.id ? ' is-playing' : '') + '" data-action="preview-track" data-value="' + t.id + '">' +
        A.icon(d.playing === t.id ? 'stop' : 'play') + (d.playing === t.id ? 'עצירה' : 'נגן דוגמה') + '</button></label>').join('') +
      '</div></fieldset>' +
      '<label class="setting-row switch"><span><b>דירוג אישי בסיום</b><span class="sub">כל משתתף יראה את המקום והניקוד שלו</span></span>' +
      '<input type="checkbox" id="show-rank"' + (d.showRank ? ' checked' : '') + '><span class="switch-track"></span></label>' +
      '</div>'
    );
  };

  /* ---------- לובי ----------
     d = { code, players:[{id,name,avatar,offline}], count, duration, track } */
  V.lobby = (d) => {
    const url = A.joinUrl(d.code);
    return (
      '<section class="admin-main"><div class="lobby">' +
      '<div class="card join-panel">' +
      '<h2 class="jp-title">הצטרפו עכשיו!</h2>' +
      '<p class="field-hint" style="margin-bottom:6px">נכנסים לקישור:</p>' +
      '<span class="jp-url"><span>' + esc(A.joinUrl('').replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</span>' +
      '<button type="button" data-action="copy-link" aria-label="העתקת קישור">' + A.icon('copy') + '</button></span>' +
      '<p class="code-label">קוד המשחק</p>' +
      '<div class="code-digits" aria-label="קוד ' + esc(d.code) + '">' + String(d.code).split('').map((c) => '<span>' + esc(c) + '</span>').join('') + '</div>' +
      '<div class="lobby-summary">' +
      '<span class="pill"><img src="' + A.img('books') + '" alt=""><b>' + d.qCount + '</b> שאלות</span>' +
      '<span class="pill"><img src="' + A.img('alarm_clock') + '" alt=""><b>' + d.duration + '</b> שנ׳</span>' +
      '<span class="pill"><img src="' + A.img(V.track(d.track).img) + '" alt="">' + esc(V.track(d.track).name) + '</span>' +
      '</div>' +
      '<button class="btn btn-accent btn-xl" type="button" data-action="start"' + (d.players.length ? '' : ' disabled') + '>' +
      A.icon('play') + 'התחל משחק</button>' +
      '<div class="secondary">' +
      '<button class="btn btn-ghost btn-sm" type="button" data-action="close-room">' + A.icon('door') + 'סגירת חדר</button>' +
      '</div></div>' +
      '<div class="card players-panel">' +
      '<div class="players-head"><div class="player-count"><span class="big">' + d.players.length + '</span>' +
      '<span class="lbl">' + (d.players.length === 1 ? 'משתתף כבר כאן' : 'משתתפים כבר כאן') + '</span></div>' +
      '<span class="live-dot"><i></i>מחכים לעוד<span class="dots"><b>.</b><b>.</b><b>.</b></span></span></div>' +
      (d.players.length && d.teams
        ? '<div class="team-cols">' + d.teams.slice().sort((a, b) => a.i - b.i).map((t) =>
            '<div class="team-col" style="--c:' + t.color + '"><h4><img src="' + t.pic + '" alt="">' + esc(t.name) + ' <small>' + t.count + '</small></h4>' +
            '<div class="player-cloud">' + d.players.filter((p) => d.teamMap[p.id] === t.i).map((p) =>
              '<span class="p-chip' + (p.isNew !== false ? ' is-new' : '') + '">' + A.avatarHTML(p.avatar) + '<bdi>' + esc(p.name) + '</bdi></span>').join('') +
            '</div></div>').join('') + '</div>'
        : d.players.length
        ? '<div class="player-cloud bubbles">' + d.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map((p, i) =>
            '<span class="p-bub' + (p.offline ? ' is-off' : '') + (p.isNew !== false ? ' is-new' : '') + '" style="--k:' + (i % 7) + ';--ph:-' + (Date.now() / 1000 % 900).toFixed(2) + 's">' +
            A.avatarHTML(p.avatar) + '<bdi>' + esc(p.name) + '</bdi></span>').join('') + '</div>'
        : '<div class="empty-state"><img class="anim-bob" src="' + A.img('door') + '" alt="">' +
          '<b>מחכים למשתתפים הראשונים…</b><span>השמות יופיעו כאן ברגע שיצטרפו</span></div>') +
      '</div></div></section>'
    );
  };

  /* ---------- משחק חי ----------
     d = { code, total, players:[{id,name,avatar,score,answered,finished,offline}], surveys:[{text,options:[{label,count}]}] } */
  V.live = (d) => {
    const ps = d.players.slice().sort((a, b) => b.score - a.score || b.answered - a.answered);
    const finished = ps.filter((p) => p.finished).length;
    const offline = ps.filter((p) => p.offline).length;
    const avg = ps.length ? Math.round(ps.reduce((s, p) => s + p.answered / d.total, 0) / ps.length * 100) : 0;
    const medals = ['1st_place_medal', '2nd_place_medal', '3rd_place_medal'];

    return (
      '<section class="admin-main">' +
      '<div class="page-head"><div><h2>המשחק בעיצומו</h2>' +
      '<p>קוד <bdi dir="ltr"><b>' + esc(A.prettyCode(d.code)) + '</b></bdi> · מצטרפים חדשים מתחילים לשחק מיד</p></div>' +
      '<div class="controls">' +
      (d.sync ? '<button class="btn btn-accent" type="button" data-action="sync-stage">' + A.icon('expand') + 'חזרה למסך המקרן</button>' : '') +
      '<button class="btn btn-primary" type="button" data-action="results">' + A.icon('trophy') + 'הצגת פודיום</button>' +
      '<button class="btn btn-ghost" type="button" data-action="export">' + A.icon('download') + 'ייצוא לאקסל</button>' +
      '<button class="btn btn-ghost" type="button" data-action="reset">' + A.icon('reset') + 'איפוס לסבב נוסף</button>' +
      '<button class="btn btn-ghost" type="button" data-action="close-room">' + A.icon('door') + 'סגירת חדר</button>' +
      '</div></div>' +
      '<div class="stats-row">' +
      V.stat('partying_face', ps.length, 'משתתפים') +
      V.stat('check_mark_button', finished, 'סיימו') +
      V.stat('hourglass_not_done', avg + '%', 'התקדמות ממוצעת') +
      V.stat('sleeping_face', offline, 'מנותקים') +
      '</div>' +
      '<div class="live-grid">' +
      '<div class="board" role="table" aria-label="טבלת ניקוד">' +
      '<div class="board-head" role="row"><span>#</span><span>משתתף</span><span>התקדמות</span><span style="text-align:end">ניקוד</span><span></span></div>' +
      ps.map((p, i) =>
        '<div class="row' + (p.offline ? ' is-off' : '') + (i === 0 && p.score > 0 ? ' top-1' : '') + '" role="row" data-id="' + esc(p.id) + '">' +
        '<span class="rank">' + (i < 3 && p.score > 0 ? '<img src="' + A.img(medals[i]) + '" alt="מקום ' + (i + 1) + '">' : i + 1) + '</span>' +
        '<span class="who">' + A.avatarHTML(p.avatar) + '<b><bdi>' + esc(p.name) + '</bdi></b>' +
        (p.offline ? '<span class="badge badge-warn">' + A.icon('wifiOff') + 'מנותק</span>' : '') + '</span>' +
        '<span class="prog' + (p.finished ? ' is-done' : '') + '"><span class="prog-bar"><i style="width:' + Math.round(p.answered / d.total * 100) + '%"></i></span>' +
        '<small>' + (p.finished ? A.icon('check') + 'סיים · ' : '') + p.answered + ' מתוך ' + d.total + '</small></span>' +
        '<span class="score">' + A.fmt(p.score) + '</span>' +
        '<button class="kick" type="button" data-action="kick" data-value="' + esc(p.id) + '" aria-label="הוצאת ' + esc(p.name) + '">' + A.icon('kick') + '</button>' +
        '</div>').join('') +
      '</div>' +
      '<aside class="card"><h3 class="card-title"><img src="' + A.img('bar_chart') + '" alt="">תוצאות הסקרים</h3>' +
      (d.surveys && d.surveys.length ? d.surveys.map(V.survey).join('') :
        '<p class="field-hint">אין סקרים במשחק הזה.</p>') +
      '</aside></div></section>'
    );
  };

  /* ---------- מצב מקרן: שאלה ----------
     d = { i, total, q:{k,t,a,c}, rem, duration, answered, players, paused } */
  V.stageControls = (d) =>
    '<div class="stage-controls">' +
    (d.manual ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-action="sync-pause">' + A.icon(d.paused ? 'play' : 'stop') +
    (d.paused ? 'המשך אוטומטי' : 'עצירה') + '</button>') +
    '<button class="btn btn-ghost btn-sm" type="button" data-action="sync-skip">' + A.icon('next') + 'הבא</button>' +
    '<button class="btn btn-ghost btn-sm" type="button" data-action="sync-table">' + A.icon('users') + 'טבלה</button>' +
    '<button class="btn btn-ghost btn-sm" type="button" data-action="close-room">' + A.icon('door') + 'סגירת חדר</button>' +
    '</div>';

  V.stageTiles = (q, opts) => '<div class="stage-answers' + (q.a.length > 4 ? ' many' : '') + '">' +
    q.a.map((txt, j) => {
      let cls = 'stage-ans';
      if (opts && opts.reveal) cls += q.k === 's' || j === q.c ? ' is-correct' : ' is-dim';
      const cnt = opts && opts.counts ? opts.counts[j] || 0 : null;
      const pct = cnt != null && opts.sum ? Math.round(cnt / opts.sum * 100) : 0;
      return '<div class="' + cls + '" style="--c:var(--a' + (j % 6 + 1) + ')">' +
        '<span class="shape">' + A.shape(j) + '</span><span class="txt">' + esc(txt) + '</span>' +
        (cnt != null ? '<span class="cnt"><b>' + cnt + '</b><i style="width:' + pct + '%"></i></span>' : '') +
        (opts && opts.reveal && (q.k === 's' ? false : j === q.c) ? '<span class="ok">' + A.icon('check') + '</span>' : '') +
        '</div>';
    }).join('') + '</div>';

  V.qDots = (i, total) => total > 30 ? '' :
    '<div class="q-dots" aria-hidden="true">' + Array.from({ length: total }, (_, k) => '<i class="' + (k < i ? 'done' : k === i ? 'now' : '') + '"></i>').join('') + '</div>';

  V.stage = (d) =>
    '<section class="stage">' + V.qDots(d.i, d.total) +
    '<div class="stage-top">' +
    '<span class="pill pill-q">שאלה <b>' + (d.i + 1) + '</b> מתוך <b>' + d.total + '</b></span>' +
    '<span class="stage-clock" id="stage-clock" style="--p:' + (d.rem / d.duration) + '"><span id="stage-sec">' + Math.ceil(d.rem) + '</span></span>' +
    '<span class="pill pill-ans"><img src="' + A.img('check_mark_button') + '" alt="">ענו <b id="stage-answered">' + d.answered + '</b> מתוך <b>' + d.players + '</b></span>' +
    '</div>' +
    '<div class="stage-q">' + (d.q.k === 's' ? '<span class="q-kind"><img src="' + A.img('bar_chart') + '" alt="">סקר</span>' : '') +
    '<h2>' + esc(d.q.t) + '</h2></div>' +
    V.stageTiles(d.q) +
    V.stageControls(d) +
    '</section>';

  /* ---------- מצב מקרן: תוצאות שאלה ----------
     d = { i, total, q, reveal:{counts,fastest,scores}, leaders:[{name,avatar,total}], paused, last } */
  V.stageReveal = (d) => {
    const r = d.reveal || { counts: [], fastest: [] };
    const sum = (r.counts || []).reduce((a, b) => a + b, 0);
    const isSurvey = d.q.k === 's';
    return '<section class="stage">' +
      '<div class="stage-top">' +
      '<span class="pill pill-q">שאלה <b>' + (d.i + 1) + '</b> מתוך <b>' + d.total + '</b></span>' +
      '<span class="pill pill-next">' + (d.manual ? 'לחצו "לשאלה הבאה" כשמוכנים' : d.paused ? A.icon('stop') + 'מושהה' :
        (d.last ? 'עוד רגע, התוצאות הסופיות!' : 'השאלה הבאה תכף…')) + '</span>' +
      '</div>' +
      '<div class="stage-q small"><h2>' + esc(d.q.t) + '</h2></div>' +
      V.stageTiles(d.q, { reveal: true, counts: r.counts, sum }) +
      '<div class="stage-boards">' +
      '<div class="card board-card"><h3 class="card-title"><img src="' + A.img(isSurvey ? 'bar_chart' : 'rocket') + '" alt="">' +
      (isSurvey ? 'ענו ראשונים' : 'המהירים שענו נכון') + '</h3>' +
      (r.fastest && r.fastest.length ? '<ol class="fast-list">' + r.fastest.map((f, k) =>
        '<li class="anim-rise" style="animation-delay:' + k * 0.12 + 's">' + A.avatarHTML(f.a) + '<bdi>' + esc(f.n) + '</bdi>' +
        '<span class="sec">' + f.s.toFixed(1) + ' שנ׳</span></li>').join('') + '</ol>'
        : '<p class="field-hint">' + (isSurvey ? 'אף אחד לא הצביע' : 'אף אחד לא ענה נכון הפעם') + '</p>') +
      '</div>' +
      (d.teams ? '<div class="card board-card"><h3 class="card-title"><img src="' + A.img('crown') + '" alt="">הקבוצות</h3>' + A.Teams.bars(d.teams) + '</div>' :
      isSurvey ? '' : '<div class="card board-card"><h3 class="card-title"><img src="' + A.img('trophy') + '" alt="">המובילים</h3>' +
        '<ol class="fast-list leaders">' + (d.leaders || []).slice(0, 5).map((p) =>
          '<li>' + A.avatarHTML(p.avatar) + '<bdi>' + esc(p.name) + '</bdi><span class="sec">' + A.fmt(p.total) + '</span></li>').join('') +
        '</ol></div>') +
      '</div>' +
      (d.manual ? '<div style="display:flex;justify-content:center"><button class="btn btn-accent btn-xl" type="button" data-action="sync-skip">' +
        (d.last ? A.icon('trophy') + 'לתוצאות הסופיות' : 'לשאלה הבאה ' + A.icon('next')) + '</button></div>' : '') +
      V.stageControls(d) +
      '</section>';
  };

  /* ---------- מצב מקרן: טבלת מובילים באמצע המשחק ----------
     d = { i, total, leaders:[{name,avatar,total}], manual, paused } */
  V.stageBoard = (d) => {
    const medals = ['1st_place_medal', '2nd_place_medal', '3rd_place_medal'];
    const top = (d.leaders || []).slice(0, 5);
    return '<section class="stage">' +
      '<div class="stage-top">' +
      '<span class="pill pill-q">אחרי <b>' + (d.i + 1) + '</b> מתוך <b>' + d.total + '</b> שאלות</span>' +
      '<span class="pill pill-next">' + (d.manual ? 'לחצו "לשאלה הבאה" כשמוכנים' : d.paused ? 'מושהה' : 'תכף ממשיכים…') + '</span>' +
      '</div>' +
      '<div class="lead-board card">' +
      '<h2 class="lead-title"><img src="' + A.img('trophy') + '" alt="">המובילים עד עכשיו</h2>' +
      (d.teams ? '<div class="lead-teams">' + A.Teams.bars(d.teams) + '</div>' : '') +
      (top.length ? '<ol class="lead-rows">' + top.map((p, k) =>
        '<li class="lead-row' + (k === 0 ? ' first' : '') + '" style="animation-delay:' + (top.length - k) * 0.25 + 's">' +
        '<span class="lr-rank">' + (k < 3 && p.total > 0 ? '<img src="' + A.img(medals[k]) + '" alt="מקום ' + (k + 1) + '">' : k + 1) + '</span>' +
        A.avatarHTML(p.avatar) +
        '<bdi class="lr-name">' + esc(p.name) + '</bdi>' +
        '<span class="lr-pts">' + A.fmt(p.total) + ' <small>נק׳</small></span></li>').join('') + '</ol>'
        : '<p class="field-hint">עוד אין נקודות</p>') +
      '</div>' +
      (d.manual ? '<div style="display:flex;justify-content:center"><button class="btn btn-accent btn-xl" type="button" data-action="sync-skip">לשאלה הבאה ' + A.icon('next') + '</button></div>' : '') +
      V.stageControls(d) +
      '</section>';
  };

  V.stat = (img, val, lbl) =>
    '<div class="stat"><img src="' + A.img(img) + '" alt=""><div><b>' + val + '</b><span>' + lbl + '</span></div></div>';

  V.survey = (s) => {
    const total = s.options.reduce((a, o) => a + o.count, 0);
    return '<div class="survey"><h4>' + esc(s.text) + '</h4>' +
      s.options.map((o) => {
        const pct = total ? Math.round(o.count / total * 100) : 0;
        return '<div class="s-opt"><span class="s-lbl"><span>' + esc(o.label) + '</span><b>' + pct + '%</b></span>' +
          '<span class="s-bar"><i style="width:' + pct + '%"></i></span></div>';
      }).join('') +
      '<p class="field-hint">' + total + ' הצבעות</p></div>';
  };

  /* ---------- תוצאות ---------- */
  V.results = (d) => {
    const ps = d.players.slice().sort((a, b) => b.score - a.score);
    const top = ps.slice(0, 3);
    const blocks = ['1st_place_medal', '2nd_place_medal', '3rd_place_medal'];
    return (
      '<section class="admin-main">' +
      '<div class="results-hero"><h2><span>ו</span><span>ה</span><span>מ</span><span>נ</span><span>צ</span><span>ח</span><span>י</span><span>ם</span>&nbsp;<span>ה</span><span>ם</span><span>…</span></h2></div>' +
      (d.teams && d.teams.length ? '<div class="team-win card" style="--c:' + d.teams[0].color + '"><img src="' + d.teams[0].pic + '" alt="">' +
        '<div><small>הקבוצה המנצחת</small><b>' + esc(d.teams[0].name) + '</b></div></div>' + A.Teams.bars(d.teams) : '') +
      '<div class="podium">' +
      top.map((p, i) =>
        '<div class="place p' + (i + 1) + '">' + (i === 0 ? '<img class="crown" src="' + A.img('crown') + '" alt="">' : '') + A.avatarHTML(p.avatar) +
        '<span class="p-name"><bdi>' + esc(p.name) + '</bdi></span><span class="p-score"><b class="count" data-to="' + (p.score || 0) + '">0</b> נק׳</span>' +
        '<div class="block"><img src="' + A.img(blocks[i]) + '" alt="מקום ' + (i + 1) + '"></div></div>').join('') +
      '</div>' +
      '<div class="controls" style="justify-content:center;margin-bottom:24px">' +
      '<button class="btn btn-ghost" type="button" data-action="back-live">חזרה לטבלה</button>' +
      '<button class="btn btn-ghost" type="button" data-action="export">' + A.icon('download') + 'ייצוא לאקסל</button>' +
      '<button class="btn btn-primary" type="button" data-action="reset">' + A.icon('reset') + 'סבב נוסף</button>' +
      '<button class="btn btn-ghost" type="button" data-action="close-room">' + A.icon('door') + 'סגירת חדר</button>' +
      '</div></section>'
    );
  };
})(window.App);

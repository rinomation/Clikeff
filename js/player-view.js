/* =========================================================
   קליקרים — תבניות מסכי המשתתף (תצוגה בלבד)
   כל טקסט חיצוני עובר דרך App.esc
   ========================================================= */
(function (A) {
  'use strict';
  const esc = A.esc;

  const V = (A.PlayerView = {});

  /** כפתורים קבועים בפינה (מצב כהה + השתקה) */
  V.corner = (muted) =>
    '<div class="corner-actions">' + A.theme.button() + V.muteBtn(muted) + '</div>';

  V.muteBtn = (muted) =>
    '<button class="icon-btn" type="button" data-action="mute" aria-pressed="' + (muted ? 'true' : 'false') + '" aria-label="' +
    (muted ? 'הפעלת צליל' : 'השתקה') + '">' + A.icon(muted ? 'mute' : 'volume') + '</button>';

  /* ---------- הצטרפות ---------- */
  V.join = (d) => {
    d = d || {};
    const avatar = A.safeAvatar(d.avatar);
    return (
      '<section class="screen screen-join">' +
      '<div class="brand">' +
      '<img class="brand-icon anim-bob" src="' + A.img('light_bulb') + '" alt="">' +
      '<h1 class="brand-name" dir="ltr">Clikeff</h1>' +
      '<p class="brand-tag">חידון חי לכל הכיתה</p>' +
      '</div>' +
      '<form class="card join-card" id="join-form" novalidate autocomplete="off">' +
      '<label class="field"><span class="field-label">קוד משחק</span>' +
      '<input class="input input-code" id="join-code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" ' +
      'placeholder="000000" value="' + esc(d.code || '') + '" aria-describedby="join-error" required></label>' +
      '<label class="field"><span class="field-label">איך קוראים לך?</span>' +
      '<span class="name-wrap"><input class="input" id="join-name" name="name" maxlength="20" placeholder="השם שלך" value="' +
      esc(d.name || '') + '" required>' +
      '<span class="char-count" id="name-count">' + (d.name || '').length + '/20</span></span></label>' +
      '<fieldset class="field"><legend>בחרו דמות</legend>' +
      '<div class="avatar-grid" role="radiogroup" aria-label="בחירת דמות">' +
      A.AVATARS.map((a) =>
        '<button type="button" class="avatar-opt" role="radio" data-avatar="' + a + '" aria-checked="' + (a === avatar) + '" tabindex="' + (a === avatar ? 0 : -1) + '">' +
        '<img src="' + A.img(a) + '" alt="" loading="lazy"></button>').join('') +
      '</div></fieldset>' +
      '<p class="form-error" id="join-error" role="alert">' + (d.error ? A.icon('alert') + esc(d.error) : '') + '</p>' +
      '<button class="btn btn-accent btn-lg btn-block" type="submit"' + (d.busy ? ' disabled' : '') + '>' +
      (d.busy ? '<span class="spinner"></span> מתחברים…' : 'יאללה, מצטרפים!') + '</button>' +
      '</form>' +
      '<p class="join-foot">רק שם וקוד — בלי הרשמה ובלי אימייל</p>' +
      '</section>'
    );
  };

  /* ---------- המתנה ---------- */
  V.waiting = (d) =>
    '<section class="screen screen-wait">' +
    '<div class="wait-avatar"><span class="ring"></span><span class="ring r2"></span>' +
    '<span class="disc"><img src="' + A.img(A.safeAvatar(d.avatar)) + '" alt=""></span></div>' +
    '<h2 class="wait-hello">היי <bdi>' + esc(d.name) + '</bdi>!</h2>' +
    '<p class="wait-room">נכנסת למשחק <bdi dir="ltr">' + esc(A.prettyCode(d.code)) + '</bdi></p>' +
    (d.team ? '<div class="team-badge" style="--c:' + d.team.color + '"><img src="' + A.img(d.team.img) + '" alt="">בקבוצת <b>' + esc(d.team.name) + '</b></div>' : '') +
    '<div class="wait-status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
    (d.message ? esc(d.message) : 'מחכים שהמנחה יתחיל') + '</div>' +
    '<p class="wait-hint">המשחק יתחיל לבד ברגע שהמנחה ילחץ "התחל". כדאי להגביר את הצליל 🔊</p>' +
    '</section>';

  /* ---------- משחק ----------
     d = { index, total, unanswered, timeLeft, duration, question:{text,answers,type,correct},
           state: 'open'|'answered'|'timeout', chosen, muted, display, isLast } */
  V.game = (d) => {
    const q = d.question;
    const isSurvey = q.type === 'survey';
    const locked = d.state !== 'open';
    const urgent = !locked && d.timeLeft <= 5;
    const p = Math.max(0, Math.min(1, d.timeLeft / d.duration));

    let feedback = '';
    if (d.state === 'timeout') {
      feedback = '<span class="q-feedback timeout"><img src="' + A.img('alarm_clock') + '" alt="">הזמן נגמר</span>';
    } else if (d.state === 'answered') {
      if (isSurvey) feedback = '<span class="q-feedback survey"><img src="' + A.img('check_mark_button') + '" alt="">תודה על ההצבעה!</span>';
      else if (d.chosen === q.correct) feedback = '<span class="q-feedback ok"><img src="' + A.img('party_popper') + '" alt="">תשובה נכונה!</span>';
      else feedback = '<span class="q-feedback bad"><img src="' + A.img('thinking_face') + '" alt="">לא נורא, ממשיכים!</span>';
    }

    const answers = q.answers.map((txt, i) => {
      let cls = 'answer';
      let mark = '';
      if (locked) {
        if (isSurvey) {
          if (i === d.chosen) { cls += ' is-chosen'; mark = A.icon('check'); }
        } else if (i === q.correct && d.state === 'answered') { cls += ' is-correct'; mark = A.icon('check'); }
        else if (i === d.chosen) { cls += ' is-wrong'; mark = A.icon('x'); }
      }
      return '<button type="button" class="' + cls + '" data-answer="' + i + '"' + (locked ? ' disabled' : '') +
        ' aria-label="' + A.SHAPE_NAMES[i % 6] + ': ' + esc(txt) + '">' +
        '<span class="shape">' + A.shape(i) + '</span><span class="txt">' + esc(txt) + '</span>' +
        '<span class="mark">' + mark + '</span></button>';
    }).join('');

    const longAnswers = q.answers.some((a) => String(a).length > 34);

    return (
      '<section class="screen screen-game">' +
      '<header class="game-top">' +
      '<span class="pill pill-counter">שאלה <b>' + (d.index + 1) + '</b> מתוך <b>' + d.total + '</b></span>' +
      '<span class="spacer"></span>' +
      '<span class="time-num' + (urgent ? ' is-urgent' : '') + '" aria-live="off">' + A.icon('clock') +
      '<span id="time-left">' + (locked ? '–' : Math.ceil(d.timeLeft)) + '</span></span>' +
      '<button class="icon-btn" type="button" data-action="display" aria-pressed="' + (d.display ? 'true' : 'false') + '" aria-label="' +
      (d.display ? 'יציאה ממצב תצוגה' : 'מצב תצוגה למסך גדול') + '">' + A.icon(d.display ? 'shrink' : 'expand') + '</button>' +
      V.muteBtn(d.muted) +
      '</header>' +
      '<div class="timebar' + (urgent ? ' is-urgent' : '') + (locked ? ' is-closed' : '') + '" id="timebar" role="progressbar" aria-label="זמן שנותר" ' +
      'aria-valuemin="0" aria-valuemax="' + d.duration + '" aria-valuenow="' + Math.ceil(d.timeLeft) + '" style="--p:' + (locked ? 1 : p) + '">' +
      '<div class="timebar-fill"></div></div>' +
      '<article class="q-card" aria-live="polite">' +
      (isSurvey ? '<span class="q-kind"><img src="' + A.img('bar_chart') + '" alt="">סקר</span>' : '') +
      '<h2 class="q-text">' + esc(q.text) + '</h2>' + feedback +
      '</article>' +
      '<div class="answers' + (locked ? ' is-locked' : '') + (longAnswers ? ' cols-1' : '') + '">' + answers + '</div>' +
      '<nav class="game-nav" aria-label="ניווט בין שאלות">' +
      '<button class="btn btn-ghost btn-sm" type="button" data-action="prev"' + (d.index === 0 ? ' disabled' : '') + '>' +
      A.icon('prev') + 'הקודמת</button>' +
      '<span class="open-count">' + (d.unanswered ? 'נותרו <b>' + d.unanswered + '</b> ללא מענה' : 'ענית על הכול!') + '</span>' +
      (d.isLast
        ? '<button class="btn btn-sm btn-finish" type="button" data-action="finish">סיום ' + A.icon('flag') + '</button>'
        : '<button class="btn btn-ghost btn-sm" type="button" data-action="next">הבאה ' + A.icon('next') + '</button>') +
      '</nav>' +
      '</section>'
    );
  };

  /* ---------- מצב מקרן: רק כפתורי תשובות ----------
     d = { i, total, answers:[], survey, rem, duration, muted } */
  V.pad = (d) =>
    '<section class="screen screen-game screen-pad">' +
    '<header class="game-top">' +
    '<span class="pill pill-counter">שאלה <b>' + (d.i + 1) + '</b> מתוך <b>' + d.total + '</b></span>' +
    (d.team ? '<span class="pill team-pill" style="--c:' + d.team.color + '"><img src="' + A.img(d.team.img) + '" alt="">' + esc(d.team.name) + '</span>' : '') +
    '<span class="spacer"></span>' +
    '<span class="time-num" aria-live="off">' + A.icon('clock') + '<span id="time-left">' + Math.ceil(d.rem) + '</span></span>' +
    V.muteBtn(d.muted) + '</header>' +
    '<div class="timebar" id="timebar" style="--p:' + (d.rem / d.duration) + '"><div class="timebar-fill"></div></div>' +
    '<p class="pad-hint">' + (d.survey ? '📊 סקר — בחרו את מה שמתאים לכם' : 'הסתכלו על המסך הגדול ובחרו תשובה') + '</p>' +
    '<div class="answers pad-answers' + (d.answers.length > 4 ? ' cols-1' : '') + '">' +
    d.answers.map((txt, j) =>
      '<button type="button" class="answer" data-answer="' + j + '" aria-label="' + A.SHAPE_NAMES[j % 6] + ': ' + esc(txt) + '">' +
      '<span class="shape">' + A.shape(j) + '</span><span class="txt">' + esc(txt) + '</span><span class="mark"></span></button>').join('') +
    '</div></section>';

  /** הודעה גדולה במרכז: נקלטה / נכון / לא נכון / הזמן נגמר */
  V.padNote = (d) =>
    '<section class="screen screen-done pad-note ' + (d.tone || '') + '">' +
    '<img class="done-trophy" src="' + A.img(d.img) + '" alt="">' +
    '<h2 class="done-title">' + esc(d.title) + '</h2>' +
    (d.sub ? '<p class="done-sub">' + esc(d.sub) + '</p>' : '') +
    (d.points != null ? '<div class="done-stats"><div class="stat-chip"><b>+' + A.fmt(d.points) + '</b><span>נקודות בשאלה</span></div>' +
      (d.total != null ? '<div class="stat-chip"><b>' + A.fmt(d.total) + '</b><span>סך הכול</span></div>' : '') +
      (d.rank ? '<div class="stat-chip"><b>' + d.rank + '</b><span>מקום</span></div>' : '') + '</div>' : '') +
    '</section>' + V.corner(d.muted);

  /* ---------- חלון אישור ---------- */
  V.confirm = (d) =>
    '<div class="modal-back" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
    '<div class="modal">' +
    (d.img ? '<img src="' + A.img(d.img) + '" alt="">' : '') +
    '<h3 id="modal-title">' + esc(d.title) + '</h3>' +
    (d.text ? '<p>' + esc(d.text) + '</p>' : '') +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" type="button" data-modal="no">' + esc(d.no || 'ביטול') + '</button>' +
    '<button class="btn btn-primary" type="button" data-modal="yes">' + esc(d.yes || 'אישור') + '</button>' +
    '</div></div></div>';

  /* ---------- סיום ----------
     d = { name, answered, total, rank?, score?, players? } */
  V.done = (d) =>
    '<section class="screen screen-done">' +
    '<img class="done-trophy" src="' + A.img(d.rank && d.rank <= 3 ? ['1st_place_medal', '2nd_place_medal', '3rd_place_medal'][d.rank - 1] : 'trophy') + '" alt="">' +
    '<h2 class="done-title">כל הכבוד, <bdi>' + esc(d.name) + '</bdi>!</h2>' +
    '<p class="done-sub">' + esc(d.message || 'המשחק הסתיים עבורך. התוצאות אצל המנחה — הקשיבו להודעה!') + '</p>' +
    '<div class="done-stats">' +
    '<div class="stat-chip"><b>' + d.answered + '/' + d.total + '</b><span>שאלות שנענו</span></div>' +
    '</div>' +
    (d.rank
      ? '<div class="rank-card"><img src="' + A.img('glowing_star') + '" alt="">' +
        '<div><div class="r-place">מקום ' + d.rank + (d.players ? ' <small style="font-size:.5em;opacity:.8">מתוך ' + d.players + '</small>' : '') + '</div>' +
        '<div class="r-score">' + A.fmt(d.score) + ' נקודות</div></div></div>'
      : '') +
    '</section>';
})(window.App);

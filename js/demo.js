/* =========================================================
   קליקרים — מצב הדגמה לבדיקת העיצוב (?demo)
   מציג את כל המסכים עם נתונים לדוגמה, בלי שרת.
   ========================================================= */
(function (A) {
  'use strict';
  if (!/[?&]demo\b/.test(location.search)) return;
  const START = Number(new URLSearchParams(location.search).get('demo')) || 0;

  const NAMES = ['נועה', 'איתי', 'שירה', 'יהודה', 'מיכל', 'אריאל', 'תמר', 'דוד', 'הדס', 'נתנאל', 'רוני', 'אביגיל', 'משה', 'יעל', 'עומר', 'אורי', 'שקד', 'בניה'];
  const players = NAMES.map((n, i) => ({
    id: 'p' + i, name: n, avatar: A.AVATARS[(i * 5) % A.AVATARS.length],
    score: Math.max(0, 2480 - i * 137 - (i % 3) * 41), answered: Math.max(2, 20 - i), finished: i < 4, offline: i === 6 || i === 13
  }));

  const Q = {
    type: 'question', text: 'מי נהרג במלחמה כשהרג את הפיל?',
    answers: ['יהודה המכבי', 'שמעון המכבי', 'אלעזר המכבי'], correct: 2
  };
  const Q4 = { type: 'question', text: 'עם מי נלחמו המכבים?', answers: ['הרומאים', 'היוונים', 'הערבים', 'הפלשתים'], correct: 1 };
  const S = {
    type: 'survey', text: 'האם אתם אוהבים את חג החנוכה?',
    answers: ['ברור!!!! החג הכי כייפי שיש!', 'נחמד... פורים עדיף...', 'חנוכה? שמונה ימים של השמנה....']
  };

  function bar(items, onPick, active) {
    let el = document.querySelector('.demo-bar');
    if (!el) { el = document.createElement('div'); el.className = 'demo-bar'; document.body.appendChild(el); }
    el.innerHTML = '<b>הדגמה</b><select aria-label="בחירת מסך">' + items.map((it, i) =>
      '<option value="' + i + '"' + (i === active ? ' selected' : '') + '>' + it[0] + '</option>').join('') + '</select>' +
      '<button type="button" data-other>' + (document.body.classList.contains('admin') ? 'מסך משתתף' : 'לוח מנחה') + '</button>';
    el.querySelector('select').onchange = (e) => onPick(Number(e.target.value));
    el.querySelector('[data-other]').onclick = () => {
      location.href = (document.body.classList.contains('admin') ? 'index.html' : 'admin.html') + '?demo';
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('player')) {
      const P = A.Player;
      const base = { index: 4, total: 20, unanswered: 15, duration: 15, isLast: false };
      const items = [
        ['הצטרפות', () => P.render('join', { code: '', avatar: 'fox' })],
        ['קוד שגוי', () => P.render('join', { code: '123456', name: 'נועה', avatar: 'unicorn', error: 'לא מצאנו משחק עם הקוד הזה. בדקו שוב עם המנחה.' })],
        ['המתנה', () => P.render('waiting', { name: 'נועה', avatar: 'unicorn', code: '483920' })],
        ['שאלה פתוחה', () => P.render('game', Object.assign({}, base, { question: Q4, timeLeft: 11, state: 'open' }))],
        ['5 שניות אחרונות', () => P.render('game', Object.assign({}, base, { question: Q, timeLeft: 3, state: 'open' }))],
        ['תשובה נכונה', () => P.render('game', Object.assign({}, base, { question: Q4, timeLeft: 7, state: 'answered', chosen: 1 }))],
        ['תשובה שגויה', () => P.render('game', Object.assign({}, base, { question: Q, timeLeft: 6, state: 'answered', chosen: 0 }))],
        ['סקר', () => P.render('game', Object.assign({}, base, { index: 0, question: S, timeLeft: 12, state: 'open' }))],
        ['סקר נענה', () => P.render('game', Object.assign({}, base, { index: 0, question: S, timeLeft: 8, state: 'answered', chosen: 0 }))],
        ['הזמן נגמר', () => P.render('game', Object.assign({}, base, { question: Q, timeLeft: 0, state: 'timeout' }))],
        ['שאלה אחרונה', () => P.render('game', Object.assign({}, base, { index: 19, unanswered: 2, isLast: true, question: Q4, timeLeft: 9, state: 'open' }))],
        ['סיום', () => P.render('done', { name: 'נועה', answered: 18, total: 20 })],
        ['סיום + דירוג', () => P.render('done', { name: 'נועה', answered: 20, total: 20, rank: 2, score: 2343, players: 18 })]
      ];
      const pick = (i) => items[i][1]();
      P.handlers.onJoin = () => { pick(2); bar(items, pick, 2); };
      P.handlers.onAnswer = (i) => {
        const d = P.data;
        if (d.state !== 'open') return;
        P.render('game', Object.assign({}, d, { state: 'answered', chosen: i, unanswered: d.unanswered - 1 }));
      };
      pick(START);
      bar(items, pick, START);
    } else {
      const M = A.Admin;
      const setupBase = { source: 'builtin', duration: 15, track: 'drama', showRank: false, saved: null, preview: null };
      const previewRows = [
        { row: 2, type: 'survey', text: 'כמה סופגניות אתה אוכל בחנוכה?', answers: ['לא סופר.... הרבה!!', '1-2', '5-10'], valid: true },
        { row: 3, type: 'question', text: 'איך קראו למשפחת החשמונאים?', answers: ['יונתן', 'ישראל', 'מתיתיהו'], correct: 2, valid: true },
        { row: 4, type: 'question', text: 'איך קראו לאישה שכרתה את ראש אליפורנוס?', answers: ['חנה', 'יהודית', 'יעל'], correct: 1, valid: true },
        { row: 5, type: 'question', text: 'כמה נרות מדליקים בסה"כ בחנוכה?', answers: ['36', '44', '54'], correct: 4, valid: false, reason: 'מספר התשובה הנכונה (4) גדול ממספר התשובות (3)' },
        { row: 6, type: null, text: 'במה מדליקין נרות חנוכה מן המובחר?', answers: ['שמן זית', 'שמן קנולה', 'שמן אגוזים'], valid: false, reason: 'סוג לא מזוהה: "שאלות" (צריך "שאלה" או "סקר")' },
        { row: 7, type: 'question', text: 'מתי חל "זאת חנוכה"?', answers: ['ביום הראשון של חנוכה', '', 'ביום האחרון של חנוכה'], correct: 2, valid: false, reason: 'תשובה 2 ריקה באמצע' },
        { row: 8, type: 'question', text: 'מה כתוב על הסביבון?', answers: ['נס גדול היה שם', 'נס גדול היה פה', 'שניהם נכונים'], correct: 2, valid: true }
      ];
      const live = {
        code: '483920', total: 20, players,
        surveys: [
          { text: 'האם אתם אוהבים את חג החנוכה?', options: [{ label: 'ברור!!!! החג הכי כייפי שיש!', count: 12 }, { label: 'נחמד... פורים עדיף...', count: 4 }, { label: 'חנוכה? שמונה ימים של השמנה....', count: 2 }] },
          { text: 'כמה סופגניות אתה אוכל בחנוכה?', options: [{ label: 'לא סופר.... הרבה!!', count: 9 }, { label: '1-2', count: 3 }, { label: '5-10', count: 6 }] }
        ]
      };
      const items = [
        ['הכנה — מאגר', () => M.render('setup', Object.assign({}, setupBase))],
        ['הכנה — קובץ', () => M.render('setup', Object.assign({}, setupBase, { source: 'file' }))],
        ['תצוגה מקדימה', () => M.render('setup', Object.assign({}, setupBase, { source: 'file', preview: { fileName: 'חידון חנוכה תורת בנימין.xlsx', rows: previewRows } }))],
        ['שאלות שמורות', () => M.render('setup', Object.assign({}, setupBase, { source: 'file', saved: { title: 'חידון חנוכה תורת בנימין', count: 27, updated: 'היום 10:42' } }))],
        ['לובי ריק', () => M.render('lobby', { code: '483920', players: [], qCount: 27, duration: 15, track: 'drama' })],
        ['לובי מלא', () => M.render('lobby', { code: '483920', players: players.map((p) => Object.assign({}, p, { offline: false })), qCount: 27, duration: 15, track: 'drama' })],
        ['משחק חי', () => M.render('live', live)],
        ['פודיום', () => {
          M.render('results', live);
          if (window.confetti) confetti({ particleCount: 160, spread: 90, origin: { y: .35 } });
        }]
      ];
      const pick = (i) => items[i][1]();
      M.handlers['source'] = (v) => M.render('setup', Object.assign({}, M.data, { source: v }));
      M.handlers['open-room'] = () => { pick(5); bar(items, pick, 5); };
      M.handlers['start'] = () => { pick(6); bar(items, pick, 6); };
      M.handlers['results'] = () => { pick(7); bar(items, pick, 7); };
      M.handlers['back-live'] = () => { pick(6); bar(items, pick, 6); };
      M.handlers['cancel-preview'] = () => { pick(1); bar(items, pick, 1); };
      M.handlers['save-preview'] = () => { pick(3); bar(items, pick, 3); A.toast('נשמרו 4 פריטים', { type: 'ok', img: 'check_mark_button' }); };
      M.handlers['preview-track'] = (v) => M.render('setup', Object.assign({}, M.data, { playing: M.data.playing === v ? null : v }));
      pick(START);
      bar(items, pick, START);
    }
  });
})(window.App);

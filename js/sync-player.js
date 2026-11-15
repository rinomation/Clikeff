/* קליקרים — מצב מקרן אצל הילד: כפתורי תשובות, "נקלטה", ותוצאה אחרי כל שאלה */
(function (A) {
  'use strict';
  const P = A.Player;
  const Z = (A.SyncPlayer = { room: null, code: null, st: null });
  let loop = null;

  const key = () => 'sync.' + Z.code + '.' + Z.room.version;
  const save = () => A.store.set(key(), Z.st);

  function load() {
    Z.st = A.store.get(key(), null) || { ans: {}, seen: {}, shown: {}, res: {} };
    if (!Z.st.res) Z.st.res = {};
  }

  /** נקרא מ-player-main בכל עדכון של החדר במצב מקרן */
  Z.onRoom = (room, code) => {
    const fresh = !Z.room || Z.room.version !== room.version || Z.code !== code;
    Z.room = room; Z.code = code;
    if (fresh) load();
    A.Sound.stopMusic(); /* המוזיקה מתנגנת במסך של המנחה */
    const i = room.qIndex || 0;

    if (room.phase === 'question') {
      if (!Z.st.seen[i]) { Z.st.seen[i] = Date.now(); save(); }
      if (Z.st.ans[i] != null) return showSent();
      if (remaining() <= 0) return showTimeUp(i); /* הזמן שלו נגמר: לא חוזרים לכפתורים */
      if (P.screen === 'pad' && P.data.i === i) return;
      P.render('pad', { i, total: room.questions.length, answers: room.questions[i].a,
        survey: room.questions[i].k === 's', rem: remaining(), duration: room.duration,
        team: room.teamCount && (room.teams || {})[A.Net.uid()] != null ? A.Teams.get(room.teams[A.Net.uid()], room) : null });
      startLoop();
    } else if (room.phase === 'reveal') {
      stopLoop();
      showReveal(i);
    } else if (room.phase === 'board') {
      stopLoop();
      const mine = (room.ranks || {})[A.Net.uid()];
      if (!(P.screen === 'note' && P.data.kind === 'board' + i)) {
        P.render('note', { kind: 'board' + i, img: 'trophy', title: 'טבלת המובילים!', tone: 'wait',
          sub: room.showRank && mine ? 'המקום שלך: ' + mine[0] + ' · ' + A.fmt(mine[1]) + ' נקודות' : 'הסתכלו על המסך הגדול' });
      }
    } else if (room.phase === 'end') {
      stopLoop();
      showEnd();
    }
  };

  /* זמן מקומי: מרגע שהשאלה הופיעה אצל הילד, פחות שנייה בממוצע של עיכוב */
  function remaining() {
    const i = Z.room.qIndex || 0;
    const seen = Z.st.seen[i] || Date.now();
    return Math.max(0, Z.room.duration - 1 - (Date.now() - seen) / 1000);
  }

  function startLoop() {
    stopLoop();
    loop = setInterval(() => {
      if (P.screen !== 'pad') return stopLoop();
      const rem = remaining();
      const num = A.$('#time-left'), bar = A.$('#timebar');
      if (num) { num.textContent = Math.ceil(rem); num.parentNode.classList.toggle('is-urgent', rem <= 5); }
      if (bar) { bar.style.setProperty('--p', rem / Z.room.duration); bar.classList.toggle('is-urgent', rem <= 5); }
      if (rem <= 0) {
        stopLoop();
        showTimeUp(Z.room.qIndex || 0);
      }
    }, 200);
  }
  function stopLoop() { clearInterval(loop); loop = null; }

  Z.answer = (choice) => {
    const i = Z.room.qIndex || 0;
    if (Z.st.ans[i] != null || Z.room.phase !== 'question') return;
    Z.st.ans[i] = choice; save();
    stopLoop();
    A.Sound.pop();
    showSent();
    A.Net.answerQ(Z.code, i, choice).catch(() => {
      /* ננסה שוב פעם אחת אחרי שנייה */
      setTimeout(() => A.Net.answerQ(Z.code, i, choice).catch(() => {}), 1000);
    });
  };

  function showTimeUp(i) {
    if (P.screen === 'note' && P.data.kind === 'late' + i) return;
    stopLoop();
    P.render('note', { kind: 'late' + i, img: 'alarm_clock', title: 'הזמן נגמר', sub: 'מחכים לתוצאות על המסך הגדול…', tone: 'wait' });
  }

  function showSent() {
    if (P.screen === 'note' && P.data.kind === 'sent') return;
    P.render('note', { kind: 'sent', img: 'check_mark_button', title: 'התשובה נקלטה!', sub: 'מחכים לשאר המשתתפים…', tone: 'wait' });
  }

  function showReveal(i) {
    const q = Z.room.questions[i];
    const r = Z.room.reveal || {};
    const mine = (r.scores || {})[A.Net.uid()] || [0, 0, 0, -1];
    const rank = Z.room.showRank ? mine[2] : null;
    const sig = 'r' + i;
    if (P.screen === 'note' && P.data.kind === sig) return;
    let d;
    if (q.k === 's') d = { img: 'bar_chart', title: 'תודה על ההצבעה!', sub: 'התוצאות על המסך הגדול' };
    else if (mine[3] === 1) d = { img: 'party_popper', title: 'תשובה נכונה!', tone: 'ok', points: mine[0], total: mine[1], rank };
    else if (mine[3] === 0) d = { img: 'thinking_face', title: 'לא נורא!', sub: 'התשובה הנכונה: ' + q.a[q.c], tone: 'bad', points: 0, total: mine[1], rank };
    else d = { img: 'alarm_clock', title: 'לא הספקת לענות', sub: 'התשובה הנכונה: ' + q.a[q.c], tone: 'bad', points: 0, total: mine[1], rank };
    if (q.k !== 's') { Z.st.res[i] = mine[3] === 1 ? 1 : 0; save(); }
    if (mine[3] === 1) { let n = 0; for (let k = i; k >= 0 && Z.st.res[k] === 1; k--) n++; d.streak = n; }
    d.kind = sig;
    P.render('note', d);
    const first = !Z.st.shown[i];
    A.countUp(A.$('.pad-note .stat-chip b'), d.points || 0, { prefix: '+', ms: 900 });
    if (first) {
      Z.st.shown[i] = 1; save();
      if (q.k !== 's') (mine[3] === 1 ? A.Sound.correct : A.Sound.wrong)();
      if (mine[3] === 1 && window.confetti) window.confetti({ particleCount: d.streak >= 3 ? 110 : 60, spread: 70, origin: { y: .35 }, colors: ['#2ee6ff', '#ff5a5f', '#ffb020', '#14c49a', '#ffffff'] });
    }
  }

  function showEnd() {
    if (P.screen === 'done') return;
    const mine = (Z.room.ranks || {})[A.Net.uid()];
    const answered = Object.keys(Z.st.ans).length;
    P.render('done', {
      name: (A.PlayerMain.session || {}).name || '', answered, total: Z.room.questions.length,
      rank: Z.room.showRank && mine ? mine[0] : null, score: mine ? mine[1] : null, players: Z.room.rankCount || null,
      message: 'המשחק הסתיים! תודה ששיחקתם.'
    });
    A.Sound.fanfare();
    if (window.confetti) window.confetti({ particleCount: 140, spread: 80, origin: { y: 0.3 } });
  }

  Z.reset = () => { stopLoop(); Z.room = null; Z.st = null; };
})(window.App);

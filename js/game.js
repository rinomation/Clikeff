/* =========================================================
   קליקרים — מנוע המשחק של המשתתף
   טיימר נפרד לכל שאלה, ניווט חופשי, ניקוד, צפצופים ופעמון.
   ========================================================= */
(function (A) {
  'use strict';

  const G = (A.Game = {});
  let st = null;          /* מצב המשחק הנוכחי */
  let loop = null, lastTs = 0, saveAt = 0;
  let hooks = {};         /* onChange(state), onTick(entry), onReport(summary) */
  let musicResumeT = null;

  const key = (code) => 'game.' + code;
  const BEEPS = [5, 4.5, 4, 3.5, 3, 2.5, 2.25, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.25];

  G.setHooks = (h) => { hooks = h || {}; };
  G.state = () => st;

  /** יוצר משחק חדש מנתוני החדר, או משחזר שמור מאותו סבב */
  G.load = (code, room) => {
    const saved = A.store.get(key(code), null);
    if (saved && saved.version === room.version && saved.total === room.questions.length) {
      st = saved;
    } else {
      st = {
        code, version: room.version, duration: room.duration, track: room.track,
        total: room.questions.length, questions: room.questions, idx: 0, finished: false,
        entries: room.questions.map(() => ({ s: 'open', ch: null, rem: room.duration, pts: 0 }))
      };
    }
    save(true);
    return st;
  };

  G.clear = (code) => { stop(); st = null; A.store.del(key(code)); };

  function save(force) {
    if (!st) return;
    const now = Date.now();
    if (force || now - saveAt > 1000) { saveAt = now; A.store.set(key(st.code), st); }
  }

  G.summary = () => {
    if (!st) return null;
    const surveys = {};
    let score = 0, closed = 0;
    st.entries.forEach((e, i) => {
      score += e.pts;
      if (e.s !== 'open') closed++;
      if (st.questions[i].k === 's' && e.s === 'answered') surveys[String(i)] = e.ch;
    });
    return { score, answered: closed, total: st.total, finished: st.finished, surveys, open: st.total - closed };
  };

  /** נתונים לתצוגת המסך הנוכחי */
  G.view = () => {
    const q = st.questions[st.idx];
    const e = st.entries[st.idx];
    return {
      index: st.idx, total: st.total, unanswered: G.summary().open,
      timeLeft: e.rem, duration: st.duration, state: e.s, chosen: e.ch,
      isLast: st.idx === st.total - 1,
      question: { type: q.k === 's' ? 'survey' : 'question', text: q.t, answers: q.a, correct: q.c }
    };
  };

  /* ---------- לולאת זמן ---------- */
  function start() {
    if (loop) return;
    lastTs = performance.now();
    loop = setInterval(tick, 100);
  }
  function stop() { clearInterval(loop); loop = null; }
  G.stop = stop;

  function tick() {
    if (!st || st.finished) return stop();
    const now = performance.now();
    const dt = Math.min(1, (now - lastTs) / 1000); /* לשונית ברקע לא "שורפת" זמן */
    lastTs = now;
    if (document.hidden) return;
    const e = st.entries[st.idx];
    if (e.s !== 'open') return;
    const before = e.rem;
    e.rem = Math.max(0, e.rem - dt);
    BEEPS.forEach((b) => { if (before > b && e.rem <= b && e.rem > 0) A.Sound.beep(b <= 2.5); });
    if (e.rem <= 0) {
      e.s = 'timeout';
      timeUp();
      save(true);
      report();
      if (hooks.onChange) hooks.onChange();
      return;
    }
    save(false);
    if (hooks.onTick) hooks.onTick(e, st.duration);
  }

  /** פעמון + השתקת מוזיקה ל-4 שניות, ואז המשך מאותה נקודה */
  function timeUp() {
    const wasPlaying = A.Sound.pauseMusic();
    A.Sound.bell();
    clearTimeout(musicResumeT);
    if (wasPlaying || !A.Sound.musicPlaying()) {
      musicResumeT = setTimeout(() => { if (st && !st.finished) A.Sound.resumeMusic(); }, 4000);
    }
  }

  function report() { if (hooks.onReport) hooks.onReport(G.summary()); }

  /* ---------- פעולות ---------- */
  G.resume = () => { if (st && !st.finished) start(); };

  G.answer = (i) => {
    const e = st.entries[st.idx];
    if (e.s !== 'open' || st.finished) return;
    const q = st.questions[st.idx];
    e.s = 'answered'; e.ch = i;
    if (q.k === 's') { e.pts = 0; A.Sound.pop(); }
    else if (i === q.c) { e.pts = 100 + Math.round(Math.max(0, e.rem) / st.duration * 75); A.Sound.correct(); }
    else { e.pts = 0; A.Sound.wrong(); }
    save(true);
    report();
    if (hooks.onChange) hooks.onChange();
  };

  G.go = (delta) => {
    const n = st.idx + delta;
    if (n < 0 || n >= st.total) return;
    st.idx = n;
    lastTs = performance.now();
    save(true);
    if (hooks.onChange) hooks.onChange();
  };

  G.finish = () => {
    st.finished = true;
    stop();
    clearTimeout(musicResumeT);
    save(true);
    report();
  };
})(window.App);

/* קליקרים — מצב מקרן: המנחה מריץ את השאלות לכולם יחד ומעביר אוטומטית */
(function (A) {
  'use strict';
  const Y = (A.SyncHost = {
    REVEAL_MS: 8000,     /* כמה זמן מוצגות התוצאות לפני מעבר אוטומטי */
    GRACE_MS: 1500,      /* מרווח לעיכוב רשת בתשובות האחרונות */
    paused: false
  });

  /** ניקוד שאלה אחת לכל משתתף, לפי זמן השרת של התשובה */
  Y.scoreQuestion = (room, players, i, qStartMs) => {
    const q = room.questions[i];
    const dur = room.duration;
    const counts = q.a.map(() => 0);
    const rows = [];
    players.forEach((p) => {
      if (p.version !== room.version) return;
      const ans = p.answers && p.answers[String(i)];
      if (!ans || ans.c == null || !ans.at) return;
      const took = (ans.at.ms - qStartMs) / 1000;
      if (took > dur + Y.GRACE_MS / 1000) return;   /* מאוחר מדי */
      if (counts[ans.c] != null) counts[ans.c]++;
      const ok = q.k !== 's' && ans.c === q.c;
      const pts = ok ? 100 + Math.round(Math.max(0, dur - Math.max(0, took)) / dur * 75) : 0;
      rows.push({ id: p.id, name: p.name, avatar: p.avatar, ok, pts, took: Math.max(0, took) });
    });
    return { counts, rows };
  };

  /** סכום מצטבר מכל השאלות שהתחילו (room.qStarts) — אפשר לשחזר גם אחרי רענון */
  Y.totals = (room, players, uptoI) => {
    const tot = {};
    players.forEach((p) => { tot[p.id] = 0; });
    (room.qStarts || []).forEach((ms, i) => {
      if (i > uptoI || !ms) return;
      Y.scoreQuestion(room, players, i, ms).rows.forEach((r) => { tot[r.id] = (tot[r.id] || 0) + r.pts; });
    });
    return tot;
  };

  let ctx = null, loop = null, offset = 0, phaseAt = 0, busy = false, beeped = {};
  const serverNow = () => Date.now() + offset;

  /** ctx: { code, room(), players(), draw() } */
  Y.attach = (c) => { ctx = c; if (!loop) loop = setInterval(tick, 200); };
  Y.detach = () => { clearInterval(loop); loop = null; ctx = null; };

  async function write(patch) {
    busy = true;
    try {
      const t0 = Date.now();
      const res = await A.Net.updateRoom(ctx.code, patch);
      if (res && res.commitTime) {
        offset = Date.parse(res.commitTime) - (t0 + Date.now()) / 2;
        /* הזמן המדויק שנשמר בשדה updatedAt — כדי לזהות תשובות ישנות */
        const tr = ((res.writeResults || [])[0] || {}).transformResults || [];
        const ts = tr.find((v) => v && v.timestampValue);
        Y.lastCommit = ts ? Date.parse(ts.timestampValue) : Date.parse(res.commitTime) - 1000;
      }
      phaseAt = Date.now();
      const clean = Object.assign({}, patch);
      delete clean.updatedAt;
      if (ctx && ctx.applyLocal) ctx.applyLocal(clean);
    } finally { busy = false; }
  }

  function startQuestion(i) {
    const room = ctx.room();
    const qStarts = (room.qStarts || []).slice();
    qStarts[i] = Math.round(serverNow());
    beeped = {};
    A.Sound.playMusic(room.track);
    return write({ status: 'active', mode: 'sync', phase: 'question', qIndex: i, qStarts, reveal: null });
  }

  Y.start = async () => { Y.paused = false; await write({ updatedAt: A.FsRest.NOW }); await startQuestion(0); };

  /** תוצאות השאלה: תשובה נכונה, התפלגות, המהירים, ונקודות לכל ילד */
  Y.toReveal = async () => {
    const room = ctx.room(), players = ctx.players(), i = room.qIndex;
    const res = Y.scoreQuestion(room, players, i, room.qStarts[i]);
    const tot = Y.totals(room, players, i);
    const order = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
    const scores = {};
    order.forEach((id, k) => {
      const r = res.rows.find((x) => x.id === id);
      scores[id] = [r ? r.pts : 0, tot[id], k + 1, r ? (r.ok ? 1 : 0) : -1];
    });
    const fastest = res.rows.filter((r) => r.ok || room.questions[i].k === 's')
      .sort((a, b) => a.took - b.took).slice(0, 5)
      .map((r) => ({ n: r.name, a: r.avatar, s: Math.round(r.took * 10) / 10 }));
    await write({ phase: 'reveal', reveal: { i, counts: res.counts, fastest, scores, n: order.length },
      ranks: Object.fromEntries(order.map((id, k) => [id, [k + 1, tot[id]]])), rankCount: order.length });
  };

  Y.next = () => {
    const room = ctx.room();
    const more = room.qIndex + 1 < room.questions.length;
    /* כל כמה שאלות: מסך מובילים לפני השאלה הבאה */
    if (more && room.phase === 'reveal' && room.boardEvery > 0 && (room.qIndex + 1) % room.boardEvery === 0) {
      return write({ phase: 'board' });
    }
    if (more) return startQuestion(room.qIndex + 1);
    A.Sound.stopMusic();
    return write({ phase: 'end' });
  };

  /** כמה שניות נשארו לשאלה הנוכחית */
  Y.remaining = () => {
    const room = ctx && ctx.room();
    if (!room || room.phase !== 'question') return 0;
    const start = (room.qStarts || [])[room.qIndex] || serverNow();
    return Math.max(0, room.duration - (serverNow() - start) / 1000);
  };

  /** כמה ילדים כבר ענו על השאלה הנוכחית */
  Y.answeredCount = () => {
    const room = ctx.room();
    let n = 0, total = 0;
    ctx.players().forEach((p) => {
      if (p.version !== room.version || p.offline) return;
      total++;
      if (p.answers && p.answers[String(room.qIndex)]) n++;
    });
    return { n, total };
  };

  const BEEPS = [5, 4.5, 4, 3.5, 3, 2.5, 2.25, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.25];

  function tick() {
    if (!ctx || busy) return;
    const room = ctx.room();
    if (!room || room.mode !== 'sync' || room.status !== 'active') return;
    if (!phaseAt) phaseAt = Date.now();

    if (room.phase === 'question') {
      const rem = Y.remaining();
      BEEPS.forEach((b) => { if (rem <= b && rem > 0 && !beeped[b]) { beeped[b] = 1; A.Sound.beep(b <= 2.5); } });
      if (ctx.onTick) ctx.onTick(rem, room.duration);
      const c = Y.answeredCount();
      if (rem <= 0) {
        const wasPlaying = A.Sound.pauseMusic();
        A.Sound.bell();
        if (wasPlaying) setTimeout(() => A.Sound.resumeMusic(), 4000);
        Y.toReveal();
      } else if (c.total > 0 && c.n >= c.total && Date.now() - phaseAt > 1500) {
        Y.toReveal();
      }
    } else if (room.phase === 'reveal' || room.phase === 'board') {
      if (room.advance !== 'manual' && !Y.paused && Date.now() - phaseAt > Y.REVEAL_MS) Y.next();
    }
  }

  Y.skip = () => {
    const room = ctx.room();
    if (room.phase === 'question') Y.toReveal();
    else if (room.phase === 'reveal' || room.phase === 'board') Y.next();
  };
  Y.togglePause = () => { Y.paused = !Y.paused; return Y.paused; };
})(window.App);

/* קליקרים — לוגיקת לוח המנחה */
(function (A) {
  'use strict';
  const M = A.Admin;
  const S = (A.AdminMain = {
    cfg: { duration: 15, track: 'drama', showRank: false, source: 'builtin', mode: 'sync' },
    bank: null,        /* { title, items, updated } */
    preview: null,     /* תצוגה מקדימה לפני שמירה */
    code: null, room: null, players: [],
    unsubRoom: null, unsubPlayers: null, view: null
  });

  function setupData() {
    return Object.assign({}, S.cfg, {
      playing: S.playing || null,
      preview: S.preview,
      saved: S.bank ? { title: S.bank.title, count: S.bank.items.length, updated: S.bank.updated } : null
    });
  }
  S.showSetup = () => { S.view = 'setup'; M.render('setup', setupData()); };

  let saveT = null;
  function saveCfg() {
    A.store.set('hostCfg', S.cfg);
    clearTimeout(saveT);
    saveT = setTimeout(() => A.Net.saveHost({ cfg: S.cfg }).catch(() => {}), 800);
  }

  const H = M.handlers;
  H.onDuration = (v) => { S.cfg.duration = v; saveCfg(); };
  H.onTrack = (v) => { S.cfg.track = v; saveCfg(); };
  H.mode = (v) => { S.cfg.mode = v; saveCfg(); S.showSetup(); };
  H.source = (v) => { S.cfg.source = v; S.preview = null; saveCfg(); S.showSetup(); };

  H['preview-track'] = (id) => {
    if (S.playing === id) { A.Sound.stopPreview(); S.playing = null; }
    else {
      S.playing = id;
      A.Sound.preview(id, () => { S.playing = null; if (S.view === 'setup') S.showSetup(); });
    }
    if (S.view === 'setup') S.showSetup();
  };

  H.onFile = async (file) => {
    try {
      S.preview = await A.Excel.parse(file);
      S.cfg.source = 'file';
      S.showSetup();
    } catch (e) {
      A.toast(e.message || 'לא הצלחנו לקרוא את הקובץ', { type: 'bad', ms: 5000 });
    }
  };
  H['cancel-preview'] = () => { S.preview = null; S.showSetup(); };
  H['save-preview'] = async () => {
    const items = A.Excel.toItems(S.preview.rows);
    const d = new Date();
    S.bank = {
      title: S.preview.title, items,
      updated: d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    };
    S.preview = null;
    A.store.set('hostBank', S.bank);
    S.showSetup();
    try {
      await A.Net.saveHost({ bank: S.bank });
      A.toast('נשמרו ' + items.length + ' פריטים', { type: 'ok', img: 'check_mark_button' });
    } catch (e) { A.toast('נשמר במחשב הזה בלבד: ' + A.Net.errorText(e), { type: 'bad' }); }
  };
  H['view-saved'] = () => {
    S.preview = { fileName: S.bank.title, title: S.bank.title, rows: A.Excel.fromItems(S.bank.items), viewOnly: true };
    S.showSetup();
  };
  H['delete-saved'] = async () => {
    S.bank = null;
    A.store.del('hostBank');
    S.showSetup();
    A.Net.clearBank().catch(() => {});
  };
  H.template = () => A.Excel.template().catch((e) => A.toast(e.message, { type: 'bad' }));
  M.handlers.showRank = (v) => { S.cfg.showRank = v; saveCfg(); };

  function buildQuestions() {
    if (S.cfg.source === 'file' && S.bank && S.bank.items.length) return S.bank.items;
    return A.pickBank(10);
  }

  H['open-room'] = async (v, btn) => {
    A.Sound.unlock();
    A.Sound.stopPreview(); S.playing = null;
    if (S.cfg.source === 'file' && !(S.bank && S.bank.items.length)) {
      return A.toast('עוד לא נשמרו שאלות מקובץ. העלו קובץ או בחרו במאגר המובנה.', { type: 'bad', ms: 5000 });
    }
    if (btn) btn.disabled = true;
    try {
      const questions = buildQuestions();
      const code = await A.Net.createRoom({
        duration: S.cfg.duration, track: S.cfg.track, showRank: !!S.cfg.showRank, mode: S.cfg.mode || 'sync',
        questions, qCount: questions.length, source: S.cfg.source
      });
      A.store.set('hostRoom', code);
      attach(code);
    } catch (e) {
      if (btn) btn.disabled = false;
      A.toast(e.message && !e.code ? e.message : A.Net.errorText(e), { type: 'bad', ms: 5000 });
    }
  };

  function attach(code) {
    S.code = code;
    detach(true);
    S.unsubRoom = A.Net.watchRoom(code, (room) => {
      if (!room || room.status === 'closed') { S.room = null; return backToSetup(); }
      /* תשובה ישנה שהגיעה אחרי שינוי שעשינו — מתעלמים */
      const Y = A.SyncHost;
      if (Y.lastCommit && room.updatedAt && room.updatedAt.ms < Y.lastCommit - 5) return;
      const was = S.room;
      S.room = room;
      if (room.status === 'waiting') S.view = 'lobby';
      else if (room.mode === 'sync') {
        if (room.phase === 'end' && (!was || was.phase !== 'end')) { if (was) H.results(); else S.view = 'results'; }
        else if (room.phase !== 'end' && (S.view === 'lobby' || S.view === 'setup' || !was)) S.view = 'sync';
      } else if (!was || was.status !== 'active') {
        S.view = 'live';
        if (was && was.status === 'waiting') A.Sound.fanfare();
      }
      draw();
    });
    S.unsubPlayers = A.Net.watchPlayers(code, (list) => { S.players = list; draw(); });
    A.SyncHost.attach({
      code,
      room: () => S.room,
      players: () => rawPlayers(),
      applyLocal: (patch) => { S.room = Object.assign({}, S.room, patch); if (patch.phase === 'end') H.results(); else draw(); },
      onTick: stageTick
    });
  }
  function detach(keepCode) {
    A.SyncHost.detach();
    if (S.unsubRoom) S.unsubRoom();
    if (S.unsubPlayers) S.unsubPlayers();
    S.unsubRoom = S.unsubPlayers = null;
    if (!keepCode) { S.code = null; S.players = []; }
  }
  function backToSetup() {
    detach(false);
    A.store.del('hostRoom');
    S.showSetup();
  }

  H.start = () => (S.room && S.room.mode === 'sync' ? A.SyncHost.start() : A.Net.updateRoom(S.code, { status: 'active', startedAt: A.FsRest.NOW }))
    .catch((e) => A.toast(A.Net.errorText(e), { type: 'bad' }));

  H.reset = () => {
    const patch = { status: 'waiting', startedAt: null, ranks: {}, rankCount: 0, phase: null, qIndex: 0, qStarts: [], reveal: null };
    if (S.room && S.room.source !== 'file') { patch.questions = A.pickBank(10); patch.qCount = 10; }
    A.Net.bumpRoom(S.code, patch)
      .then(() => A.toast('הסבב אופס — כולם חזרו להמתנה', { img: 'hourglass_not_done' }))
      .catch((e) => A.toast(A.Net.errorText(e), { type: 'bad' }));
  };

  H['close-room'] = () => {
    const code = S.code;
    if (!code) return;
    A.Net.updateRoom(code, { status: 'closed' })
      .then(() => A.toast('החדר נסגר', { img: 'door' }))
      .catch((e) => A.toast(A.Net.errorText(e), { type: 'bad' }));
  };

  H.kick = (id) => {
    const p = S.players.find((x) => x.id === id);
    if (!p) return;
    A.Net.kick(S.code, id, p.nameKey)
      .then(() => { if (S.unsubPlayers && S.unsubPlayers.remove) S.unsubPlayers.remove(id); A.toast(p.name + ' הוצא/ה מהמשחק'); })
      .catch((e) => A.toast(A.Net.errorText(e), { type: 'bad' }));
  };

  const isOffline = (p, now) => {
    const ls = p.lastSeen && p.lastSeen.toMillis ? p.lastSeen.toMillis() : now;
    return p.online === false || now - ls > 75000;
  };
  function rawPlayers() {
    const now = Date.now();
    return S.players.map((p) => Object.assign({}, p, { offline: isOffline(p, now) }));
  }
  /* עדכון השעון במסך המקרן בלי לצייר הכול מחדש */
  function stageTick(rem, dur) {
    const sec = A.$('#stage-sec'), clock = A.$('#stage-clock');
    if (!sec || !clock) return;
    sec.textContent = Math.ceil(rem);
    clock.style.setProperty('--p', rem / dur);
    clock.classList.toggle('is-urgent', rem <= 5);
    const c = A.SyncHost.answeredCount();
    const el = A.$('#stage-answered');
    if (el && el.textContent !== String(c.n)) el.textContent = c.n;
  }

  const seen = new Set();
  function players() {
    const v = S.room ? S.room.version : 0;
    const now = Date.now();
    const sync = S.room && S.room.mode === 'sync';
    const tot = sync && S.room.qStarts ? A.SyncHost.totals(S.room, S.players,
      S.room.phase === 'question' ? S.room.qIndex - 1 : S.room.qIndex) : null;
    return S.players.map((p) => {
      const cur = p.version === v;
      if (sync) {
        const fresh = !seen.has(p.id);
        seen.add(p.id);
        return {
          id: p.id, name: p.name, avatar: p.avatar, nameKey: p.nameKey, isNew: fresh,
          score: tot && cur ? tot[p.id] || 0 : 0, answered: cur ? Object.keys(p.answers || {}).length : 0,
          finished: cur && S.room.phase === 'end', surveys: {}, offline: isOffline(p, now)
        };
      }
      const ls = p.lastSeen && p.lastSeen.toMillis ? p.lastSeen.toMillis() : now;
      const isNew = !seen.has(p.id);
      seen.add(p.id);
      return {
        id: p.id, name: p.name, avatar: p.avatar, nameKey: p.nameKey, isNew,
        score: cur ? p.score || 0 : 0, answered: cur ? p.answered || 0 : 0,
        finished: cur ? !!p.finished : false, surveys: cur ? p.surveys || {} : {},
        offline: p.online === false || now - ls > 75000
      };
    }).sort((a, b) => b.score - a.score || b.answered - a.answered || a.name.localeCompare(b.name, 'he'));
  }

  function surveys(list) {
    const qs = (S.room && S.room.questions) || [];
    const out = [];
    qs.forEach((q, i) => {
      if (q.k !== 's') return;
      const counts = q.a.map(() => 0);
      list.forEach((p) => { const c = p.surveys[String(i)]; if (c != null && counts[c] != null) counts[c]++; });
      out.push({ text: q.t, options: q.a.map((label, j) => ({ label, count: counts[j] })) });
    });
    return out;
  }

  let rankAt = 0, rankSig = '', rankT = null;
  function pushRanks(list) {
    if (!S.room || !S.room.showRank || S.room.status !== 'active' || S.room.mode === 'sync') return;
    const ranks = {};
    list.forEach((p, i) => { ranks[p.id] = [i + 1, p.score]; });
    const sig = JSON.stringify(ranks);
    if (sig === rankSig) return;
    clearTimeout(rankT);
    const wait = Math.max(0, 6000 - (Date.now() - rankAt));
    rankT = setTimeout(() => {
      rankAt = Date.now(); rankSig = sig;
      A.Net.updateRoom(S.code, { ranks, rankCount: list.length }).catch(() => {});
    }, wait);
  }

  let drawQueued = false;
  function draw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      if (!S.room) return;
      const list = players();
      const base = { code: S.code, players: list, total: (S.room.questions || []).length };
      if (S.view === 'lobby') {
        M.render('lobby', Object.assign(base, { qCount: base.total, duration: S.room.duration, track: S.room.track }));
      } else if (S.view === 'results') {
        M.render('results', base);
      } else if (S.view === 'sync' && S.room.mode === 'sync' && S.room.status === 'active') {
        const r = S.room, i = r.qIndex || 0, Y = A.SyncHost;
        const st = { i, total: base.total, q: r.questions[i], paused: Y.paused, last: i + 1 >= base.total };
        if (r.phase === 'reveal') {
          const rk = 'r' + i + '-' + r.version + '-' + Y.paused;
          if (M.screen === 'stageReveal' && S.revealKey === rk) return;
          S.revealKey = rk;
          M.render('stageReveal', Object.assign(st, { reveal: r.reveal, leaders: list.map((p) => ({ name: p.name, avatar: p.avatar, total: p.score })) }));
        } else {
          const c = Y.answeredCount();
          const key = 'q' + i + '-' + r.version;
          /* לא מציירים מחדש באמצע שאלה — רק השעון והמונה מתעדכנים */
          if (M.screen === 'stage' && S.stageKey === key) { stageTick(Y.remaining(), r.duration); return; }
          S.stageKey = key;
          M.render('stage', Object.assign(st, { rem: Y.remaining(), duration: r.duration, answered: c.n, players: c.total }));
        }
      } else {
        M.render('live', Object.assign(base, { surveys: surveys(list), sync: S.room.mode === 'sync' && S.room.phase !== 'end' }));
      }
      pushRanks(list);
    });
  }
  setInterval(() => { if (S.view === 'live' || S.view === 'lobby') draw(); }, 15000);

  H.results = () => {
    S.view = 'results'; draw();
    A.Sound.fanfare();
    setTimeout(() => { if (window.confetti) window.confetti({ particleCount: 180, spread: 100, origin: { y: 0.35 } }); }, 900);
  };
  H['back-live'] = () => { S.view = S.room && S.room.mode === 'sync' && S.room.phase !== 'end' ? 'sync' : 'live'; draw(); };
  H['sync-pause'] = () => { A.SyncHost.togglePause(); S.stageKey = null; draw(); };
  H['sync-skip'] = () => A.SyncHost.skip();
  H['sync-table'] = () => { S.view = 'live'; draw(); };
  H['sync-stage'] = () => { S.view = 'sync'; S.stageKey = null; draw(); };
  H.export = () => A.Excel.exportResults(players(), (S.room.questions || []).length, S.code)
    .catch((e) => A.toast(e.message, { type: 'bad' }));

  async function boot() {
    S.cfg = Object.assign(S.cfg, A.store.get('hostCfg', {}));
    S.bank = A.store.get('hostBank', null);
    S.showSetup();
    document.addEventListener('pointerdown', () => A.Sound.unlock(), { once: true });
    try {
      await A.Net.init();
      const host = await A.Net.loadHost();
      if (host) {
        if (host.cfg) S.cfg = Object.assign(S.cfg, host.cfg);
        if (host.bank) { S.bank = host.bank; A.store.set('hostBank', host.bank); }
      }
      const code = A.store.get('hostRoom', null);
      if (code) {
        const room = await A.Net.getRoom(code).catch(() => null);
        if (room && room.status !== 'closed' && room.hostUid === A.Net.uid()) return attach(code);
        A.store.del('hostRoom');
      }
      if (S.view === 'setup') S.showSetup();
    } catch (e) {
      A.toast(A.Net.errorText(e), { type: 'bad', ms: 8000 });
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (/[?&]demo\b/.test(location.search)) return;
    boot();
  });
})(window.App);

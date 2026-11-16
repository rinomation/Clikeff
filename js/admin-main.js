/* קליקרים — לוגיקת לוח המנחה */
(function (A) {
  'use strict';
  const M = A.Admin;
  const S = (A.AdminMain = {
    cfg: { duration: 15, track: 'fun', showRank: false, source: 'builtin', mode: 'sync' },
    defaults: { duration: 15, track: 'fun', showRank: false, source: 'builtin', mode: 'sync' },
    bank: null,        /* { title, items, updated } */
    preview: null,     /* תצוגה מקדימה לפני שמירה */
    code: null, room: null, players: [],
    unsubRoom: null, unsubPlayers: null, view: null
  });

  function setupData() {
    return Object.assign({}, S.cfg, {
      playing: S.playing || null,
      preview: S.preview,
      editor: S.editor || null,
      tab: S.tab || 'questions',
      saved: S.bank ? { title: S.bank.title, count: S.bank.items.length, updated: S.bank.updated } : null
    });
  }
  S.showSetup = () => { S.view = 'setup'; M.render('setup', setupData()); };
  S.showHome = () => { S.view = 'home'; M.render('home', { license: S.license, owner: S.owner }); };
  S.showLogin = (d) => { S.view = 'login'; M.user = null; M.render('login', Object.assign({ email: A.store.get('hostEmail', ''), form: true }, d || {})); };
  S.showNoLicense = (lic, email) => { S.view = 'nolicense'; M.render('noLicense', { lic, email }); };

  let saveT = null;
  function saveCfg() {
    A.store.set('hostCfg', S.cfg);
    clearTimeout(saveT);
    saveT = setTimeout(() => A.Net.saveHost({ cfg: S.cfg }).catch(() => {}), 800);
  }

  const H = M.handlers;
  H.onDuration = (v) => { S.cfg.duration = v; saveCfg(); };
  H.onTrack = (v) => { S.cfg.track = v; saveCfg(); };
  H.boardEvery = (v) => { S.cfg.boardEvery = Number(v); saveCfg(); S.showSetup(); };
  H.teams = (v) => { S.cfg.teams = Number(v); saveCfg(); S.showSetup(); };
  H.teamSet = (v) => { S.cfg.teamSet = v; saveCfg(); S.showSetup(); };
  H.onTeamName = (i, v) => {
    const list = (S.cfg.teamNames || []).slice();
    list[i] = A.Teams.clean(v);
    S.cfg.teamNames = list; saveCfg();
    const sum = document.getElementById('setup-summary');
    if (sum) sum.innerHTML = '<span class="lb-title">סיכום:</span>' + A.AdminView.summary(setupData());
  };
  H.advance = (v) => { S.cfg.advance = v; saveCfg(); S.showSetup(); };
  H['go-setup'] = () => { S.tab = 'questions'; S.showSetup(); window.scrollTo(0, 0); };
  H.tab = (v) => { S.tab = v; S.showSetup(); window.scrollTo(0, 0); };
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
    S.tab = 'settings';
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
  /* ---------- כתיבת שאלות ידנית ---------- */
  const blankForm = () => ({ k: 'q', t: '', a: ['', '', '', ''], c: null, idx: null });

  /** שומר את מה שהוקלד בטופס לפני ציור מחדש */
  function readForm() {
    const ed = S.editor;
    if (!ed) return;
    const t = A.$('#qe-title'); if (t) ed.title = t.value;
    const q = A.$('#qe-text'); if (q) ed.form.t = q.value;
    A.$$('.qe-a').forEach((inp) => { ed.form.a[Number(inp.dataset.j)] = inp.value; });
    const c = A.$('input[name="qe-c"]:checked'); ed.form.c = c ? Number(c.value) : ed.form.c;
  }
  const redraw = () => { S.showSetup(); const q = A.$('#qe-text'); if (q && !S.editor.form.t) q.focus(); };

  H['qe-open'] = (v) => {
    const base = v === 'saved' && S.bank ? S.bank : { title: '', items: [] };
    S.editor = { title: base.title, items: base.items.map((it) => Object.assign({}, it, { a: it.a.slice() })), form: blankForm(), error: '' };
    S.cfg.source = 'file'; S.preview = null;
    redraw();
  };
  H['qe-close'] = () => { S.editor = null; S.showSetup(); };
  H['qe-kind'] = (v) => { readForm(); S.editor.form.k = v; redraw(); };
  H['qe-add-ans'] = () => { readForm(); if (S.editor.form.a.length < 6) S.editor.form.a.push(''); redraw(); };
  H['qe-rm-ans'] = (v) => {
    readForm();
    const f = S.editor.form, j = Number(v);
    f.a.splice(j, 1);
    if (f.c === j) f.c = null; else if (f.c > j) f.c--;
    redraw();
  };
  H['qe-save-item'] = () => {
    readForm();
    const ed = S.editor, f = ed.form;
    const t = f.t.replace(/\s+/g, ' ').trim();
    const a = f.a.map((x) => x.replace(/\s+/g, ' ').trim());
    let last = a.length - 1; while (last >= 0 && !a[last]) last--;
    const ans = a.slice(0, last + 1);
    ed.error = !t ? 'צריך לכתוב את השאלה'
      : ans.indexOf('') >= 0 ? 'יש תשובה ריקה באמצע. מלאו אותה או הסירו אותה'
      : ans.length < 2 ? 'צריך לפחות שתי תשובות'
      : f.k === 'q' && (f.c == null || f.c >= ans.length) ? 'סמנו איזו תשובה נכונה (לחיצה על הצורה הצבעונית)'
      : '';
    if (ed.error) return redraw();
    const item = f.k === 's' ? { k: 's', t, a: ans } : { k: 'q', t, a: ans, c: f.c };
    if (f.idx != null) ed.items[f.idx] = item; else ed.items.push(item);
    ed.form = blankForm();
    redraw();
  };
  H['qe-edit'] = (v) => {
    readForm();
    const it = S.editor.items[Number(v)];
    const a = it.a.slice(); while (a.length < 2) a.push('');
    S.editor.form = { k: it.k, t: it.t, a, c: it.k === 's' ? null : it.c, idx: Number(v) };
    S.editor.error = '';
    redraw();
  };
  H['qe-cancel-edit'] = () => { S.editor.form = blankForm(); S.editor.error = ''; redraw(); };
  H['qe-del'] = (v) => {
    readForm();
    const n = Number(v);
    S.editor.items.splice(n, 1);
    if (S.editor.form.idx === n) S.editor.form = blankForm();
    redraw();
  };
  const move = (n, d) => {
    readForm();
    const it = S.editor.items, m = n + d;
    if (m < 0 || m >= it.length) return;
    [it[n], it[m]] = [it[m], it[n]];
    S.editor.form.idx = null;
    redraw();
  };
  H['qe-up'] = (v) => move(Number(v), -1);
  H['qe-down'] = (v) => move(Number(v), 1);
  H['qe-save-all'] = async () => {
    readForm();
    const ed = S.editor;
    const d = new Date();
    S.bank = {
      title: ed.title.trim() || 'השאלות שלי', items: ed.items,
      updated: d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    };
    S.editor = null;
    S.tab = 'settings';
    A.store.set('hostBank', S.bank);
    S.showSetup();
    try {
      await A.Net.saveHost({ bank: S.bank });
      A.toast('נשמרו ' + S.bank.items.length + ' שאלות', { type: 'ok', img: 'check_mark_button' });
    } catch (e) { A.toast('נשמר במחשב הזה בלבד: ' + A.Net.errorText(e), { type: 'bad' }); }
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
    if (!S.owner) {
      const lic = await A.Net.license().catch(() => null);
      if (!A.Net.licenseOk(lic)) return S.showNoLicense(lic, M.user);
    }
    if (S.cfg.source === 'file' && !(S.bank && S.bank.items.length)) {
      return A.toast('עוד לא נשמרו שאלות מקובץ. העלו קובץ או בחרו במאגר המובנה.', { type: 'bad', ms: 5000 });
    }
    if (btn) btn.disabled = true;
    try {
      const questions = buildQuestions();
      const code = await A.Net.createRoom({
        duration: S.cfg.duration, track: S.cfg.track, showRank: !!S.cfg.showRank, mode: S.cfg.mode || 'sync', advance: S.cfg.advance || 'auto', teamCount: S.cfg.mode === 'self' ? 0 : (S.cfg.teams || 0), teams: {}, teamSet: S.cfg.teamSet || A.Teams.DEFAULT, teamNames: A.Teams.names(S.cfg), boardEvery: S.cfg.boardEvery == null ? 3 : S.cfg.boardEvery,
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
      if (Y.lastCommit && room.updatedAt && room.updatedAt.ms < Y.lastCommit) return;
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
    S.unsubPlayers = A.Net.watchPlayers(code, (list) => { S.players = list; assignTeams(); draw(); });
    A.SyncHost.attach({
      code,
      room: () => S.room,
      players: () => rawPlayers(),
      applyLocal: (patch) => {
        S.room = Object.assign({}, S.room, patch);
        if (patch.phase === 'end') return H.results();
        if (patch.status === 'active' && (S.view === 'lobby' || S.view === 'setup')) S.view = 'sync';
        draw();
      },
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
    S.teamMap = null;
    detach(false);
    A.store.del('hostRoom');
    S.showHome();
  }

  const go = () => (S.room && S.room.mode === 'sync' ? A.SyncHost.start() : A.Net.updateRoom(S.code, { status: 'active', startedAt: A.FsRest.NOW }))
    .catch((e) => A.toast(A.Net.errorText(e), { type: 'bad' }));
  let counting = false;
  H.start = () => {
    if (counting) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return go();
    counting = true;
    const ov = document.createElement('div');
    ov.className = 'countdown'; ov.setAttribute('aria-live', 'assertive');
    document.body.appendChild(ov);
    const steps = ['3', '2', '1', 'יאללה!'];
    steps.forEach((t, k) => setTimeout(() => {
      ov.innerHTML = '<i></i><b class="' + (k === 3 ? 'go' : '') + '">' + t + '</b>';
      if (k < 3) A.Sound.beep(k === 2); else A.Sound.pop();
    }, k * 900));
    setTimeout(() => { ov.classList.add('out'); setTimeout(() => ov.remove(), 350); counting = false; go(); }, steps.length * 900);
  };

  H.reset = () => {
    const patch = { status: 'waiting', startedAt: null, ranks: {}, rankCount: 0, phase: null, qIndex: 0, qStarts: [], reveal: null };
    if (S.room && S.room.source !== 'file') { patch.questions = A.pickBank(10); patch.qCount = 10; }
    A.Net.bumpRoom(S.code, patch)
      .then(() => A.toast('הסבב אופס, כולם חזרו להמתנה', { img: 'hourglass_not_done' }))
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
  let primed = false;
  const flashQ = [];
  let flashing = false;
  function flashJoin(p) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    flashQ.push(p);
    if (!flashing) nextFlash();
  }
  function nextFlash() {
    const p = flashQ.shift();
    if (!p) { flashing = false; return; }
    flashing = true;
    const el = document.createElement('div');
    el.className = 'join-flash'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = A.avatarHTML(p.avatar) + '<b><bdi>' + A.esc(p.name) + '</bdi> כאן!</b>';
    document.body.appendChild(el);
    A.Sound.pop();
    setTimeout(() => el.remove(), 1800);
    setTimeout(nextFlash, flashQ.length > 3 ? 450 : 1000);
  }
  function players() {
    const lobbyNow = primed && S.room && S.room.status === 'waiting';
    const v = S.room ? S.room.version : 0;
    const now = Date.now();
    const sync = S.room && S.room.mode === 'sync';
    const tot = sync && S.room.qStarts ? A.SyncHost.totals(S.room, S.players,
      S.room.phase === 'question' ? S.room.qIndex - 1 : S.room.qIndex) : null;
    const out = S.players.map((p) => {
      const cur = p.version === v;
      if (sync) {
        const fresh = !seen.has(p.id);
        seen.add(p.id);
        if (fresh && lobbyNow) flashJoin(p);
        return {
          id: p.id, name: p.name, avatar: p.avatar, nameKey: p.nameKey, isNew: fresh,
          score: tot && cur ? tot[p.id] || 0 : 0, answered: cur ? Object.keys(p.answers || {}).length : 0,
          finished: cur && S.room.phase === 'end', surveys: {}, offline: isOffline(p, now)
        };
      }
      const ls = p.lastSeen && p.lastSeen.toMillis ? p.lastSeen.toMillis() : now;
      const isNew = !seen.has(p.id);
      seen.add(p.id);
      if (isNew && lobbyNow) flashJoin(p);
      return {
        id: p.id, name: p.name, avatar: p.avatar, nameKey: p.nameKey, isNew,
        score: cur ? p.score || 0 : 0, answered: cur ? p.answered || 0 : 0,
        finished: cur ? !!p.finished : false, surveys: cur ? p.surveys || {} : {},
        offline: p.online === false || now - ls > 75000
      };
    }).sort((a, b) => b.score - a.score || b.answered - a.answered || a.name.localeCompare(b.name, 'he'));
    primed = true;
    return out;
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

  /* שיבוץ לקבוצות של מי שהצטרף — המנחה כותב את המפה לחדר */
  let teamBusy = false;
  async function assignTeams() {
    if (!S.room || !S.room.teamCount || teamBusy) return;
    const merged = Object.assign({}, S.room.teams || {}, S.teamMap || {});
    const map = A.Teams.assign(Object.assign({}, S.room, { teams: merged }), S.players) || (Object.keys(S.teamMap || {}).length > Object.keys(S.room.teams || {}).length ? merged : null);
    if (!map) return;
    S.teamMap = map;
    teamBusy = true;
    try { await A.Net.updateRoom(S.code, { teams: map }); S.room = Object.assign({}, S.room, { teams: map }); draw(); }
    catch (e) { /* ננסה בפעם הבאה */ }
    finally { teamBusy = false; }
  }
  const teamMapNow = () => Object.assign({}, (S.room && S.room.teams) || {}, S.teamMap || {});
  const teamData = (list) => (S.room && S.room.teamCount ? A.Teams.scores(Object.assign({}, S.room, { teams: teamMapNow() }), list) : null);

  let drawQueued = false;
  function draw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      if (!S.room) return;
      const list = players();
      const base = { code: S.code, players: list, total: (S.room.questions || []).length, teams: teamData(list), teamMap: teamMapNow() };
      if (S.view === 'lobby') {
        M.render('lobby', Object.assign(base, { qCount: base.total, duration: S.room.duration, track: S.room.track }));
      } else if (S.view === 'results') {
        /* מציירים מחדש רק כשהתוצאות עצמן השתנו, כדי שהפודיום לא יתחיל מההתחלה */
        const rk = JSON.stringify([list.slice(0, 3).map((p) => [p.id, p.score, p.avatar]), (base.teams || []).map((t) => [t.name, t.avg])]);
        if (M.screen === 'results' && S.resultsKey === rk) return;
        S.resultsKey = rk;
        M.render('results', base);
      } else if (S.view === 'sync' && S.room.mode === 'sync' && S.room.status === 'active') {
        const r = S.room, i = r.qIndex || 0, Y = A.SyncHost;
        const st = { i, total: base.total, q: r.questions[i], paused: Y.paused, last: i + 1 >= base.total, manual: r.advance === 'manual', teams: base.teams };
        if (r.phase === 'board') {
          const bk = 'b' + i + '-' + r.version + '-' + Y.paused;
          if (M.screen === 'stageBoard' && S.boardKey === bk) return;
          S.boardKey = bk;
          A.Sound.fanfare();
          M.render('stageBoard', Object.assign(st, { leaders: list.map((p) => ({ name: p.name, avatar: p.avatar, total: p.score })) }));
          return;
        }
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

  /* כניסה עם מייל וסיסמה */
  H.login = async () => {
    const email = (A.$('#login-email') || {}).value || '', pass = (A.$('#login-pass') || {}).value || '';
    if (!email.trim() || !pass) return S.showLogin({ email, error: 'נא למלא מייל וסיסמה' });
    const btn = A.$('#login-form [type=submit]'); if (btn) { btn.disabled = true; btn.textContent = 'מתחברים…'; }
    try {
      const u = await A.Net.signIn(email, pass);
      A.store.set('hostEmail', email.trim());
      await afterLogin(u);
    } catch (e) { S.showLogin({ email, error: A.Net.authError(e) }); }
  };
  H.forgot = async () => {
    const email = ((A.$('#login-email') || {}).value || '').trim();
    if (!email) return S.showLogin({ error: 'כתבו את המייל שלכם, ואז לחצו שוב על "שכחתי סיסמה"' });
    try { await A.Net.resetPassword(email); } catch (e) { if (!/user-not-found/.test(e.code || '')) return S.showLogin({ email, error: A.Net.authError(e) }); }
    A.toast('אם המייל רשום אצלנו, נשלח אליו עכשיו קישור לבחירת סיסמה חדשה.', { type: 'ok', ms: 7000 });
  };
  H.logout = async () => {
    if (S.code) detach(false);
    A.store.del('hostRoom');
    await A.Net.signOut().catch(() => {});
    ['hostBank', 'hostCfg', 'hostRoom', 'hostUid'].forEach((k) => A.store.del(k));
    S.bank = null; S.cfg = Object.assign({}, S.defaults);
    S.license = null; S.owner = false;
    S.showLogin();
  };

  /** אחרי כניסה: בודקים מנוי, ואז ממשיכים כרגיל */
  async function afterLogin(u) {
    /* מחשב משותף: כל חשבון רואה רק את השאלות וההגדרות שלו */
    if (A.store.get('hostUid', null) !== u.uid) {
      ['hostBank', 'hostCfg', 'hostRoom'].forEach((k) => A.store.del(k));
      S.bank = null; S.cfg = Object.assign({}, S.defaults);
      A.store.set('hostUid', u.uid);
    }
    A.Net.useUser(u);
    M.user = u.email;
    S.owner = A.Net.isOwner(u);
    S.license = null;
    if (!S.owner) {
      const lic = await A.Net.license().catch(() => null);
      if (!A.Net.licenseOk(lic)) return S.showNoLicense(lic, u.email);
      S.license = lic;
    }
    S.showHome();
    return startHost();
  }

  /* קישור מהמייל של פיירבייס: סיסמה חדשה או אימות מייל */
  async function handleAction(act) {
    const clean = () => history.replaceState(null, '', location.pathname);
    if (act.mode === 'resetPassword') {
      try {
        const email = await A.Net.checkResetCode(act.code);
        S.reset = { code: act.code, email };
        S.view = 'reset'; M.render('resetPw', { email });
      } catch (e) { clean(); S.showLogin({ error: 'הקישור לבחירת סיסמה כבר לא בתוקף. לחצו שוב על "שכחתי סיסמה".' }); }
      return;
    }
    if (act.mode === 'verifyEmail') {
      try { await A.Net.applyCode(act.code); A.toast('המייל אומת. תודה!', { type: 'ok' }); } catch (e) { /* כבר אומת */ }
    }
    clean();
    const u = A.Net.user();
    if (!u || u.isAnonymous) return S.showLogin();
    return afterLogin(u);
  }
  H.resetSave = async () => {
    const p1 = (A.$('#reset-pass') || {}).value || '', p2 = (A.$('#reset-pass2') || {}).value || '';
    const email = S.reset && S.reset.email;
    if (p1.length < 6) return M.render('resetPw', { email, error: 'הסיסמה צריכה להיות לפחות 6 תווים' });
    if (p1 !== p2) return M.render('resetPw', { email, error: 'שתי הסיסמאות לא זהות' });
    try {
      await A.Net.confirmReset(S.reset.code, p1);
      history.replaceState(null, '', location.pathname);
      A.store.set('hostEmail', email);
      A.toast('הסיסמה עודכנה! אפשר להיכנס.', { type: 'ok', ms: 6000 });
      S.showLogin({ email });
    } catch (e) { M.render('resetPw', { email, error: A.Net.authError(e) }); }
  };

  async function boot() {
    S.cfg = Object.assign(S.cfg, A.store.get('hostCfg', {}));
    S.bank = A.store.get('hostBank', null);
    document.addEventListener('pointerdown', () => A.Sound.unlock(), { once: true });
    M.render('login', { busy: true });
    try {
      const u = await A.Net.initAuth();
      const act = A.Net.actionFromUrl();
      if (act) return handleAction(act);
      if (!u || u.isAnonymous) return S.showLogin();
      await afterLogin(u);
    } catch (e) { S.showLogin({ error: A.Net.errorText(e) }); }
  }

  async function startHost() {
    try {
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

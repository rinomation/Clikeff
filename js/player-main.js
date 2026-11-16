/* קליקרים — לוגיקת המשתתף (חיבור, חדר, נוכחות) */
(function (A) {
  'use strict';
  const P = A.Player;
  const M = (A.PlayerMain = { session: null, room: null, unsub: null, lastWrite: 0 });

  const ERR = {
    NO_ROOM: 'לא מצאנו משחק עם הקוד הזה. בדקו את הקוד עם המנחה.',
    KICKED: 'המנחה הוציא אותך מהמשחק הזה.',
    NAME_TAKEN: 'השם הזה כבר תפוס במשחק. נסו להוסיף אות או מספר.'
  };

  async function join(d, silent) {
    if (!silent) P.render('join', Object.assign({}, d, { busy: true }));
    A.Sound.unlock();
    try {
      await A.Net.init();
      const room = await A.Net.join(d.code, d.name, d.avatar);
      M.session = d;
      A.store.set('session', d);
      M.lastWrite = Date.now();
      watch(d.code);
      onRoom(room);
    } catch (e) {
      if (silent) { A.store.del('session'); return P.showJoin(); }
      const msg = ERR[e.code] || A.Net.errorText(e);
      P.render('join', Object.assign({}, d, { error: msg }));
    }
  }

  function watch(code) {
    if (M.unsub) M.unsub();
    /* קצב בדיקה חסכוני שלא מאט את המשחק:
       בלובי כל 3 שניות, וכשהמנחה לוחץ "התחל" (בזמן הספירה לאחור) עוברים לבדיקה מהירה מאוד. */
    M.unsub = A.Net.watchRoom(code, onRoom, () => {
      const r = M.room;
      if (!r) return 2000;
      if (r.status === 'waiting') return Date.now() < (M.fastUntil || 0) ? 700 : 3000;
      if (r.status !== 'active') return 5000;
      if (r.mode === 'sync') return A.SyncPlayer.pollMs();
      return 5000;
    });
  }

  function leave(msg) {
    A.SyncPlayer.reset();
    if (M.unsub) { M.unsub(); M.unsub = null; }
    if (M.session) A.Game.clear(M.session.code);
    A.Sound.stopMusic();
    A.store.del('session');
    M.session = null; M.room = null;
    A.fullscreen.exit();
    P.showJoin();
    if (msg) A.toast(msg, { img: 'door', ms: 5000 });
  }

  function onRoom(room) {
    if (!M.session) return;
    const code = M.session.code;
    if (!room || room.status === 'closed') return leave('המנחה סגר את החדר. תודה ששיחקתם!');
    if ((room.kicked || []).indexOf(A.Net.uid()) >= 0) return leave(ERR.KICKED);
    const prev = M.room;
    M.room = room;
    const gs = A.Game.state();

    /* סבב חדש (איפוס) */
    if (prev && prev.version !== room.version) {
      A.Game.clear(code);
      A.Sound.stopMusic();
      A.Net.resetMe(code, room.version, (room.questions || []).length).catch(() => {});
      M.lastWrite = Date.now();
    }

    if (room.status === 'waiting') {
      A.Sound.stopMusic();
      /* המנחה לחץ "התחל משחק": ספירה לאחור של 3 שניות לפני השאלה הראשונה */
      const sAt = room.startingAt && room.startingAt.ms;
      if (sAt && sAt !== M.lastStarting) {
        const first = M.lastStarting === undefined;
        M.lastStarting = sAt;
        if (!first || (room.updatedAt && room.updatedAt.ms === sAt)) {
          M.fastUntil = Date.now() + 15000;
          P.render('waiting', Object.assign({}, M.session, { team: P.data.team || null, hostName: room.hostName || '', message: 'מתחילים! הסתכלו על המסך הגדול' }));
          return;
        }
      } else if (!sAt) M.lastStarting = null;
      if (P.data && P.data.message && Date.now() < (M.fastUntil || 0)) return;
      const tIdx = room.teamCount ? (room.teams || {})[A.Net.uid()] : null;
      const team = tIdx != null ? A.Teams.get(tIdx, room) : null;
      if (P.screen !== 'waiting' || ((P.data.team || {}).name || null) !== ((team || {}).name || null) || (P.data.hostName || '') !== (room.hostName || '')) P.render('waiting', Object.assign({}, M.session, { team, hostName: room.hostName || '' }));
      return;
    }

    /* פעיל */
    if (room.mode === 'sync') return A.SyncPlayer.onRoom(room, code);
    if (!A.Game.state()) A.Game.load(code, room);
    showGame();
  }

  function showGame() {
    const gs = A.Game.state();
    if (gs.finished) return showDone();
    A.Sound.playMusic(M.room.track);
    A.Game.resume();
    if (P.screen === 'game') return; /* כבר במשחק — לא מציירים מחדש */
    P.render('game', A.Game.view());
    A.wake.on();
  }

  function showDone() {
    const s = A.Game.summary();
    const r = M.room || {};
    const mine = r.showRank && r.ranks ? r.ranks[A.Net.uid()] : null;
    P.render('done', {
      name: M.session.name, answered: s.answered, total: s.total,
      rank: mine ? mine[0] : null, score: mine ? mine[1] : null, players: r.rankCount || null
    });
  }

  /* עדכון קל בכל עשירית שנייה: סרגל ומספר, בלי לצייר מחדש */
  function onTick(e, duration) {
    const num = A.$('#time-left');
    const bar = A.$('#timebar');
    if (!num || !bar) return;
    const urgent = e.rem <= 5;
    num.textContent = Math.ceil(e.rem);
    num.parentNode.classList.toggle('is-urgent', urgent);
    bar.classList.toggle('is-urgent', urgent);
    bar.style.setProperty('--p', e.rem / duration);
    bar.setAttribute('aria-valuenow', Math.ceil(e.rem));
  }

  function report(sum) {
    if (!M.session) return;
    M.lastWrite = Date.now();
    A.Net.updateMe(M.session.code, {
      score: sum.score, answered: sum.answered, total: sum.total,
      finished: sum.finished, surveys: sum.surveys, online: true
    }).catch(() => {});
  }

  /* נוכחות: דופק כל 40 שניות אם לא נכתב כלום, ומצב מוסתר/גלוי */
  function ping(online) {
    if (!M.session) return;
    M.lastWrite = Date.now();
    A.Net.updateMe(M.session.code, { online }).catch(() => {});
  }
  setInterval(() => {
    if (M.session && !document.hidden && Date.now() - M.lastWrite > 38000) ping(true);
  }, 5000);
  document.addEventListener('visibilitychange', () => {
    if (!M.session) return;
    ping(!document.hidden);
    if (!document.hidden && A.Game.state() && !A.Game.state().finished && M.room && M.room.status === 'active') {
      A.Sound.resumeMusic();
    }
  });
  window.addEventListener('pagehide', () => ping(false));

  /* כפתורים */
  P.handlers.onJoin = (d) => join(d, false);
  P.handlers.onAnswer = (i) => (M.room && M.room.mode === 'sync' ? A.SyncPlayer.answer(i) : A.Game.answer(i));
  P.handlers.onPrev = () => A.Game.go(-1);
  P.handlers.onNext = () => A.Game.go(1);
  P.handlers.onMute = (m) => A.Sound.setMuted(m);
  P.handlers.onFinish = async () => {
    const open = A.Game.summary().open;
    if (open > 0) {
      const ok = await P.ask({
        img: 'thinking_face', title: 'לסיים את המשחק?',
        text: 'נשארו ' + open + ' שאלות בלי תשובה. הן ייספרו בלי נקודות.',
        yes: 'כן, לסיים', no: 'חזרה לשאלות'
      });
      if (!ok) return;
    }
    A.Game.finish();
    A.Sound.stopMusic();
    A.Sound.fanfare();
    showDone();
    if (window.confetti) window.confetti({ particleCount: 140, spread: 80, origin: { y: 0.3 } });
  };

  A.Game.setHooks({
    onTick,
    onReport: report,
    onChange: () => { if (P.screen === 'game') P.render('game', A.Game.view()); }
  });

  /* התחלה: חזרה אוטומטית אחרי רענון */
  P.boot = () => {
    const s = A.store.get('session', null);
    const params = new URLSearchParams(location.search);
    const urlCode = (params.get('code') || '').replace(/\D/g, '');
    if (s && s.code && (!urlCode || urlCode === s.code)) {
      P.render('waiting', Object.assign({}, s, { message: 'מתחברים מחדש…' }));
      join(s, true);
      /* צליל מחייב נגיעה — הנגיעה הראשונה משחררת אותו */
      const unlock = () => { A.Sound.unlock(); if (P.screen === 'game') A.Sound.resumeMusic(); };
      document.addEventListener('pointerdown', unlock, { once: true });
    } else {
      P.showJoin();
    }
  };
})(window.App);

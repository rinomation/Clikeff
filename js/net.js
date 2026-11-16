/* =========================================================
   קליקרים — שכבת תקשורת
   כניסה אנונימית (Firebase Auth) + Firestore דרך REST עם בדיקה תקופתית.
   כך המשחק עובד גם ברשתות שחוסמות את החיבור החי (נטפרי).
   ========================================================= */
(function (A) {
  'use strict';

  const N = (A.Net = {});
  const R = A.FsRest;
  let uid = null, ready = null;

  N.init = () => {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      if (!window.firebase || !window.FIREBASE_CONFIG) return reject(new Error('NO_SDK'));
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      R.init(window.FIREBASE_CONFIG.projectId);
      const auth = firebase.auth();
      const off = auth.onAuthStateChanged((u) => {
        if (u) { off(); uid = u.uid; resolve(uid); return; }
        auth.signInAnonymously().catch((e) => { off(); ready = null; reject(e); });
      });
    });
    return ready;
  };
  N.uid = () => uid;

  /* ================= חשבון מנחה: מייל וסיסמה + מנוי ================= */
  N.OWNER = 'rinatya3847@gmail.com';
  let authReady = null;
  /** אתחול בלי כניסה אנונימית. מחזיר את המשתמש הנוכחי, או null */
  N.initAuth = () => {
    if (authReady) return authReady;
    authReady = new Promise((resolve, reject) => {
      if (!window.firebase || !window.FIREBASE_CONFIG) return reject(new Error('NO_SDK'));
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      R.init(window.FIREBASE_CONFIG.projectId);
      const off = firebase.auth().onAuthStateChanged((u) => { off(); resolve(u || null); });
    });
    return authReady;
  };
  N.useUser = (u) => { uid = u ? u.uid : null; ready = u ? Promise.resolve(uid) : null; };
  N.user = () => (window.firebase && firebase.apps.length ? firebase.auth().currentUser : null);
  N.isOwner = (u) => !!u && !u.isAnonymous && String(u.email || '').toLowerCase() === N.OWNER && !!u.emailVerified;
  N.signIn = (email, pass) => firebase.auth().signInWithEmailAndPassword(String(email).trim(), pass).then((c) => c.user);
  N.signUp = (email, pass) => firebase.auth().createUserWithEmailAndPassword(String(email).trim(), pass).then((c) => c.user);
  N.signOut = () => firebase.auth().signOut().then(() => { uid = null; ready = null; });
  N.resetPassword = (email) => { firebase.auth().languageCode = 'he'; return firebase.auth().sendPasswordResetEmail(String(email).trim()); };
  N.sendVerify = () => { firebase.auth().languageCode = 'he'; return firebase.auth().currentUser.sendEmailVerification(); };
  N.license = () => R.get('licenses/' + uid);
  N.licenseOk = (lic) => !!lic && lic.active !== false && !!lic.expires && lic.expires.toMillis() > Date.now();
  N.authError = (e) => {
    const c = (e && (e.code || e.message)) || '';
    if (/wrong-password|invalid-credential|user-not-found|INVALID_LOGIN/.test(c)) return 'המייל או הסיסמה לא נכונים.';
    if (/invalid-email/.test(c)) return 'כתובת המייל לא תקינה.';
    if (/too-many-requests/.test(c)) return 'היו יותר מדי ניסיונות. חכו כמה דקות ונסו שוב.';
    if (/email-already-in-use/.test(c)) return 'המייל הזה כבר רשום במערכת.';
    if (/weak-password/.test(c)) return 'הסיסמה קצרה מדי. צריך לפחות 6 תווים.';
    if (/user-disabled/.test(c)) return 'החשבון הזה הושבת.';
    if (/operation-not-allowed/.test(c)) return 'הכניסה עם מייל וסיסמה לא הופעלה בפיירבייס.';
    if (/network/i.test(c)) return 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.';
    return N.errorText(e);
  };

  N.errorText = (e) => {
    const c = (e && (e.code || e.message)) || '';
    if (c === 'NO_SDK') return 'לא הצלחנו לטעון את רכיבי המשחק. בדקו את החיבור לאינטרנט ורעננו.';
    if (/admin-restricted|operation-not-allowed|ADMIN_ONLY/.test(c)) return 'הכניסה האנונימית לא הופעלה ב-Firebase.';
    if (/permission/.test(c)) return 'אין הרשאה לפעולה הזו.';
    if (/unavailable|network|Failed to fetch/i.test(c)) return 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.';
    return 'משהו השתבש. נסו שוב.';
  };

  const roomP = (code) => 'rooms/' + code;
  const playerP = (code, id) => 'rooms/' + code + '/players/' + (id || uid);
  const nameP = (code, key) => 'rooms/' + code + '/names/' + key;

  N.nameKey = (name) => encodeURIComponent(String(name).toLowerCase().replace(/[\s"'`׳״.\-_]+/g, ''))
    .replace(/%/g, '~').slice(0, 120) || 'x';

  /* ================= מנהל ================= */
  N.loadHost = () => R.get('hosts/' + uid);
  N.saveHost = (patch) => R.set('hosts/' + uid, patch, { merge: true });
  N.clearBank = () => R.set('hosts/' + uid, { bank: null }, { merge: true });

  N.createRoom = async (data) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = String(100000 + Math.floor(Math.random() * 900000));
      try {
        await R.set(roomP(code), Object.assign({
          hostUid: uid, status: 'waiting', version: 1, kicked: [],
          createdAt: R.NOW, updatedAt: R.NOW, startedAt: null
        }, data), { mustNotExist: true });
        return code;
      } catch (e) {
        if (!/already-exists|failed-precondition|permission/.test(e.code || '')) throw e;
      }
    }
    throw new Error('לא נמצא קוד פנוי, נסו שוב');
  };

  N.getRoom = (code) => R.get(roomP(code));
  N.updateRoom = (code, patch) =>
    R.set(roomP(code), Object.assign({ updatedAt: R.NOW }, patch), { merge: true, mustExist: true });
  /** סבב חדש: המנהל הוא הכותב היחיד של החדר, לכן קריאה+כתיבה בטוחה */
  N.bumpRoom = async (code, patch) => {
    const room = await N.getRoom(code);
    return N.updateRoom(code, Object.assign({ version: (room.version || 1) + 1 }, patch));
  };

  N.kick = async (code, playerId, nameKey) => {
    const room = await N.getRoom(code);
    const kicked = (room.kicked || []).concat([playerId]);
    const writes = [R.writeOf(roomP(code), { kicked, updatedAt: R.NOW }, { merge: true }), R.delOf(playerP(code, playerId))];
    if (nameKey) writes.push(R.delOf(nameP(code, nameKey)));
    await R.commit(writes);
  };

  /** מעקב אחרי מסמך החדר. rate() מחזיר כל כמה מילישניות לבדוק */
  N.watchRoom = (code, cb, rate) => {
    let alive = true, last = null, t = null;
    const run = async () => {
      if (!alive) return;
      if (!document.hidden) {
        try {
          const room = await N.getRoom(code);
          const sig = JSON.stringify(room);
          if (alive && sig !== last) { last = sig; cb(room); }
        } catch (e) { /* תקלה זמנית — ננסה שוב */ }
      }
      if (alive) t = setTimeout(run, rate ? rate() : 2500);
    };
    run();
    return () => { alive = false; clearTimeout(t); };
  };

  /** מעקב אחרי המשתתפים: רק מה שהשתנה מאז הבדיקה הקודמת, ורענון מלא כל 30 שניות */
  N.watchPlayers = (code, cb) => {
    let alive = true, t = null, since = 0, fullAt = 0;
    const map = new Map();
    const run = async () => {
      if (!alive) return;
      try {
        const full = Date.now() - fullAt > 30000;
        const rows = await R.query(roomP(code), 'players', full ? 0 : since);
        if (full) { map.clear(); fullAt = Date.now(); }
        rows.forEach((p) => {
          map.set(p.id, p);
          const ms = p.lastSeen && p.lastSeen.ms;
          if (ms && ms > since) since = ms;
        });
        if (alive && (full || rows.length)) cb(Array.from(map.values()));
      } catch (e) { /* ננסה שוב */ }
      if (alive) t = setTimeout(run, 2500);
    };
    run();
    const stop = () => { alive = false; clearTimeout(t); };
    stop.remove = (id) => { map.delete(id); cb(Array.from(map.values())); };
    stop.refresh = () => { fullAt = 0; clearTimeout(t); run(); };
    return stop;
  };

  function fail(code) { const e = new Error(code); e.code = code; return e; }

  N.join = async (code, name, avatar) => {
    const room = await N.getRoom(code).catch((e) => { if (/permission/.test(e.code || '')) return null; throw e; });
    if (!room || room.status === 'closed') throw fail('NO_ROOM');
    if ((room.kicked || []).indexOf(uid) >= 0) throw fail('KICKED');

    /* שריון השם: יצירה רק אם לא קיים */
    const key = N.nameKey(name);
    try {
      await R.set(nameP(code, key), { uid }, { mustNotExist: true });
    } catch (e) {
      if (!/already-exists|failed-precondition|permission/.test(e.code || '')) throw e;
      const owner = await R.get(nameP(code, key));
      if (!owner || owner.uid !== uid) throw fail('NAME_TAKEN');
    }

    const prev = await R.get(playerP(code));
    if (prev && prev.nameKey && prev.nameKey !== key) R.del(nameP(code, prev.nameKey)).catch(() => {});

    const data = { name, nameKey: key, avatar, online: true, lastSeen: R.NOW };
    if (!prev || prev.version !== room.version) {
      Object.assign(data, { score: 0, answered: 0, total: (room.questions || []).length, finished: false, version: room.version, surveys: {}, answers: {} });
    }
    await R.set(playerP(code), data, prev ? { merge: true } : {});
    return room;
  };

  N.updateMe = (code, patch) =>
    R.set(playerP(code), Object.assign({ lastSeen: R.NOW }, patch), { merge: true, mustExist: true });

  /** מצב מקרן: שומר תשובה לשאלה i עם זמן השרת המדויק (לחישוב הוגן של המהירים) */
  N.answerQ = (code, i, choice) => {
    const w = R.writeOf(playerP(code), { online: true }, { merge: true, mustExist: true });
    w.update.fields.answers = { mapValue: { fields: { [String(i)]: { mapValue: { fields: { c: { integerValue: String(choice) } } } } } } };
    w.updateMask.fieldPaths.push('answers.`' + i + '`.c');
    w.updateTransforms = [
      { fieldPath: 'answers.`' + i + '`.at', setToServerValue: 'REQUEST_TIME' },
      { fieldPath: 'lastSeen', setToServerValue: 'REQUEST_TIME' }
    ];
    return R.commit([w]);
  };

  N.resetMe = (code, version, total) =>
    N.updateMe(code, { score: 0, answered: 0, total, finished: false, version, surveys: {}, answers: {}, online: true });
})(window.App);

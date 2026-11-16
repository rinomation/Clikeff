/* =========================================================
   קליקרים — מנוע צליל (Web Audio, בלי קבצי שמע)
   מוזיקת רקע ב-5 רצועות, צפצופי מתח, פעמון ענק, נכון/שגוי.
   ========================================================= */
(function (A) {
  'use strict';

  const S = (A.Sound = {});
  let ctx = null, master, musicBus, sfxBus, comp, reverb, noiseBuf;
  let muted = A.store.get('muted', false);

  /* ---------- אתחול (רק אחרי פעולת משתמש) ---------- */
  S.unlock = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.4; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      reverb = ctx.createConvolver(); reverb.buffer = impulse(5.5, 2.6);
      const rv = ctx.createGain(); rv.gain.value = 0.9; reverb.connect(rv); rv.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    /* iOS: ניגון שקט קצר משחרר את הצליל */
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
    return true;
  };

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  S.isMuted = () => muted;
  S.setMuted = (m) => {
    muted = !!m;
    A.store.set('muted', muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
  };

  /* ---------- כלי נגינה ---------- */
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function env(g, t, a, peak, dec, sus, rel, len) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, dec);
    g.gain.setTargetAtTime(0.0001, t + len, rel);
  }

  function kick(t, out, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(vol || 1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
  }

  function noise(t, out, { vol = 0.4, dur = 0.08, hp = 6000, bp = 0 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    if (bp) { f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = 0.9; }
    else { f.type = 'highpass'; f.frequency.value = hp; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }

  function snare(t, out, vol) {
    noise(t, out, { vol: 0.5 * (vol || 1), dur: 0.18, bp: 1800 });
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    g.gain.setValueAtTime(0.35 * (vol || 1), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
  }

  function tone(t, out, { note, type = 'sawtooth', len = 0.2, vol = 0.2, cutoff = 2000, q = 1, a = 0.005, sus = 0.4, detune = 0, glide = 0 }) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(mtof(note), t); o.detune.value = detune;
    if (glide) o.frequency.exponentialRampToValueAtTime(mtof(note + glide), t + len);
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.Q.value = q;
    env(g, t, a, vol, len * 0.3, sus, 0.06, len);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(t); o.stop(t + len + 0.5);
  }

  function pad(t, out, notes, len, vol) {
    notes.forEach((n) => [-9, 9].forEach((dt) =>
      tone(t, out, { note: n, type: 'sawtooth', len, vol: (vol || 0.05), cutoff: 1100, a: 0.25, sus: 0.8, detune: dt })));
  }

  /* ---------- כלים רכים למנגינות ---------- */
  function marimba(t, out, note, vol) {
    const f = mtof(note);
    [[1, 1, 0.45], [4, 0.25, 0.12], [10, 0.06, 0.05]].forEach(([mul, amp, dec]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.05);
    });
  }
  function pluck(t, out, note, vol, bright) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = mtof(note);
    f.type = 'lowpass'; f.frequency.setValueAtTime(bright || 2600, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.45);
  }
  function reed(t, out, note, vol, len) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'square'; o.frequency.value = mtof(note);
    lfo.frequency.value = 5.5; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune); /* ויברטו עדין */
    f.type = 'lowpass'; f.frequency.value = 1500; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setTargetAtTime(0.0001, t + len * 0.8, 0.05);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + len + 0.3); lfo.stop(t + len + 0.3);
  }
  function softBass(t, out, note, len, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = mtof(note);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol || 0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05);
  }
  function softPad(t, out, notes, len, vol) {
    notes.forEach((n) => [-6, 6].forEach((dt) => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = dt;
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + len * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + len);
      o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05);
    }));
  }

  /* ---------- מנגינות ----------
     רשת של שמיניות: 8 צעדים לתיבה, 4 תיבות. melody: הפרש בחצאי טונים מ-key, null = שקט.
     chords: 4 אקורדים (הפרשים מ-key). drums: k=קיק רך, c=מחיאה, s=שייקר. */
  const _ = null;
  const TRACKS = {
    fun: { /* שמח וקופצני */
      bpm: 116, key: 72, lead: 'marimba', vol: 0.16,
      chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]],
      melody: [0, 4, 7, 4, 9, 7, 4, _, 2, 7, 11, 7, 9, 7, 2, _, 0, 4, 9, 4, 12, 9, 4, _, 5, 9, 12, 9, 7, 5, 4, 2],
      drums: { k: 'x...x...', c: '..x...x.', s: '.x.x.x.x' }
    },
    drama: { /* מתח קליל */
      bpm: 100, key: 69, lead: 'pluck', vol: 0.15,
      chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
      melody: [0, _, 3, _, 7, _, 3, _, 8, _, 12, _, 8, _, 3, _, 10, _, 14, _, 10, _, 7, _, 7, _, 11, _, 14, _, 11, _],
      drums: { k: 'x.......', s: 'xxxxxxxx' }
    },
    chase: { /* חגיגה — סגנון פריילעך */
      bpm: 126, key: 62, lead: 'reed', vol: 0.06,
      chords: [[0, 4, 7], [5, 8, 12], [0, 4, 7], [-2, 2, 5]],
      melody: [0, 1, 4, 5, 7, _, 5, 4, 5, 7, 8, 7, 5, 4, 1, 0, 0, 1, 4, 5, 7, 8, 10, 8, 7, 5, 4, 1, 0, _, 0, _],
      drums: { k: 'x...x...', c: '..x...x.' }, oompah: true
    },
    mystery: { /* סקרנות */
      bpm: 92, key: 64, lead: 'marimba', vol: 0.14,
      chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
      melody: [7, _, 12, _, 10, _, 7, _, 8, _, 12, _, 15, _, 12, _, 10, _, 14, _, 12, _, 10, _, 7, _, 11, _, 14, _, _, _],
      drums: { s: '..x...x.' }
    },
    cinema: { /* רגוע */
      bpm: 84, key: 65, lead: 'marimba', vol: 0.13,
      chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
      melody: [12, _, 9, _, 7, _, 9, _, 9, _, 5, _, 2, _, 5, _, 5, _, 10, _, 14, _, 10, _, 14, _, 11, _, 7, _, _, _],
      drums: {}
    }
  };
  S.TRACK_IDS = Object.keys(TRACKS);

  /* ---------- נגן (תזמון מראש) ---------- */
  const music = { track: null, step: 0, next: 0, timer: null, playing: false };

  function scheduleStep(tr, step, t, out) {
    const i = step % 8;
    const bar = Math.floor(step / 8) % 4;
    const beat = 60 / tr.bpm;
    const ch = tr.chords[bar].map((x) => tr.key + x);
    const on = (p) => p && p[i] === 'x';
    const d = tr.drums || {};
    if (on(d.k)) kick(t, out, 0.45);
    if (on(d.c)) noise(t, out, { vol: 0.12, dur: 0.1, bp: 1400 });
    if (on(d.s)) noise(t, out, { vol: i % 2 ? 0.035 : 0.02, dur: 0.04, hp: 7000 });

    /* בס: על 1 ו-3; בפריילעך — אום-פה */
    if (i === 0 || i === 4) softBass(t, out, ch[0] - 24 + (tr.oompah && i === 4 ? 7 : 0), beat * 1.6, 0.2);
    if (tr.oompah && (i === 2 || i === 6)) ch.forEach((n) => pluck(t, out, n - 12, 0.035, 1400));
    if (i === 0 && !tr.oompah) softPad(t, out, ch.map((n) => n - 12), beat * 4, 0.022);

    const m = tr.melody[(step % 32)];
    if (m != null) {
      const note = tr.key + m;
      if (tr.lead === 'marimba') marimba(t, out, note, tr.vol);
      else if (tr.lead === 'pluck') pluck(t, out, note, tr.vol);
      else reed(t, out, note, tr.vol, beat / 2 * 0.9);
    }
  }

  function pump() {
    if (!music.playing) return;
    const tr = TRACKS[music.track];
    const stepDur = 60 / tr.bpm / 2;
    while (music.next < ctx.currentTime + 0.15) {
      scheduleStep(tr, music.step, Math.max(music.next, ctx.currentTime), musicBus);
      music.step++;
      music.next += stepDur;
    }
  }

  S.playMusic = (trackId) => {
    if (!ctx) return;
    if (!TRACKS[trackId]) trackId = 'drama';
    if (music.playing && music.track === trackId) return;
    S.stopMusic();
    music.track = trackId; music.step = 0;
    music.next = ctx.currentTime + 0.06;
    music.playing = true;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.4, ctx.currentTime);
    music.timer = setInterval(pump, 25);
    pump();
  };

  S.stopMusic = () => {
    music.playing = false;
    clearInterval(music.timer); music.timer = null;
    clearTimeout(music.resumeT);
    if (musicBus) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => { if (!music.playing && musicBus) musicBus.gain.value = 0.4; }, 400);
    }
  };

  /** השהיה וחזרה מאותה נקודה ובאותו קצב */
  S.pauseMusic = () => {
    if (!music.playing) return false;
    music.playing = false;
    clearInterval(music.timer); music.timer = null;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    return true;
  };
  S.resumeMusic = () => {
    if (!ctx || music.playing || !music.track) return;
    music.playing = true;
    music.next = ctx.currentTime + 0.05;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0.4, ctx.currentTime, 0.08);
    music.timer = setInterval(pump, 25);
    pump();
  };
  S.musicPlaying = () => music.playing;

  /** דוגמה של רצועה למנהל (8 שניות) */
  let previewT = null;
  S.preview = (trackId, onEnd) => {
    S.unlock();
    clearTimeout(previewT);
    S.playMusic(trackId);
    previewT = setTimeout(() => { S.stopMusic(); if (onEnd) onEnd(); }, 8000);
  };
  S.stopPreview = () => { clearTimeout(previewT); S.stopMusic(); };

  /* ---------- אפקטים ---------- */
  S.beep = (high) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, sfxBus, { note: high ? 88 : 81, type: 'square', len: high ? 0.08 : 0.11, vol: 0.34, cutoff: 6500, sus: 0.6 });
  };

  /** פעמון ענק: צלילים חלקיים לא הרמוניים, הכאה מתכתית והדהוד ארוך */
  S.bell = () => {
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const base = 98; /* G2 */
    const partials = [
      [0.5, 0.55, 7.5], [1, 0.9, 7], [1.19, 0.45, 5.5], [1.5, 0.35, 5], [2, 0.5, 4.5],
      [2.51, 0.3, 3.8], [2.97, 0.32, 3.2], [4.07, 0.22, 2.6], [5.43, 0.18, 2], [6.8, 0.14, 1.6],
      [8.21, 0.11, 1.2], [9.9, 0.08, 0.9], [12.3, 0.06, 0.6]
    ];
    const bellBus = ctx.createGain(); bellBus.gain.value = 0.6;
    bellBus.connect(sfxBus); bellBus.connect(reverb);
    partials.forEach(([ratio, amp, dec], idx) => {
      [-3, 3].forEach((cents) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = base * ratio;
        o.detune.value = cents + (idx % 2 ? 4 : -4);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(amp * 0.5, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g); g.connect(bellBus);
        o.start(t); o.stop(t + dec + 0.1);
      });
    });
    /* הכאה: רעש מתכתי חד + "ברק" גבוה */
    noise(t, bellBus, { vol: 0.9, dur: 0.12, bp: 3200 });
    noise(t, bellBus, { vol: 0.5, dur: 0.6, hp: 9000 });
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(base * 0.5, t);
    g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g); g.connect(bellBus); o.start(t); o.stop(t + 2.6);
  };

  S.correct = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => tone(t + i * 0.07, sfxBus, { note: n, type: 'square', len: 0.16, vol: 0.12, cutoff: 5000, sus: 0.5 }));
    tone(t + 0.28, sfxBus, { note: 88, type: 'triangle', len: 0.4, vol: 0.12, cutoff: 8000, sus: 0.6 });
  };

  S.wrong = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, sfxBus, { note: 55, type: 'sawtooth', len: 0.18, vol: 0.18, cutoff: 900, glide: -1 });
    tone(t + 0.2, sfxBus, { note: 50, type: 'sawtooth', len: 0.35, vol: 0.18, cutoff: 700, glide: -2 });
  };

  S.pop = () => {
    if (!ctx) return;
    tone(ctx.currentTime, sfxBus, { note: 84, type: 'sine', len: 0.08, vol: 0.15, cutoff: 8000, glide: 7 });
  };

  S.fanfare = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [67, 0.65], [72, 0.8]].forEach(([n, d], i) =>
      tone(t + d, sfxBus, { note: n, type: 'sawtooth', len: i === 5 ? 1 : 0.18, vol: 0.13, cutoff: 3500, sus: 0.7 }));
    kick(t + 0.8, sfxBus, 0.8);
  };

  /* ---------- לשונית מוסתרת: הכול נעצר ---------- */
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  /* =========================================================
     מוזיקה אמיתית מקבצים (Audionautix CC BY 4.0, ו-DL Sounds).
     מתנגנת ישירות (לא דרך מנוע הצליל), כדי שתישמע בכל דפדפן.
     אם קובץ לא נטען (למשל סינון), חוזרים למוזיקה המסונתזת שלמעלה.
     ========================================================= */
  const synth = { play: S.playMusic, stop: S.stopMusic, pause: S.pauseMusic, resume: S.resumeMusic, playing: S.musicPlaying, setMuted: S.setMuted };
  const FILES = { fun: 1, kids: 1, hero: 1, groove: 1, cinema: 1, chase: 1, drama: 1, mystery: 1 };
  const SYNTH_OF = (id) => (TRACKS[id] ? id : 'fun');
  const VOL = 0.5;
  let el = null, fileOn = false, filePaused = false, fileTrack = null, fadeT = null;
  const failed = {};
  S.TRACK_IDS = Object.keys(FILES);

  function ensureEl() {
    if (el) return true;
    if (typeof Audio === 'undefined') return false;
    el = new Audio();
    el.loop = true; el.preload = 'auto'; el.volume = 0;
    el.addEventListener('error', () => {
      if (!fileTrack || !(fileOn || filePaused)) return;
      failed[fileTrack] = true;
      const t = fileTrack; fileOn = false; filePaused = false;
      if (ctx) synth.play(SYNTH_OF(t));
    });
    return true;
  }
  /* עמעום רך של עוצמת הקול */
  function fade(to, ms, done) {
    clearInterval(fadeT);
    if (!el) return;
    const from = el.volume, t0 = Date.now();
    if (ms <= 0) { el.volume = to; if (done) done(); return; }
    fadeT = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(fadeT); if (done) done(); }
    }, 30);
  }
  let ducked = false;
  const target = () => (muted ? 0 : VOL * (ducked ? 0.3 : 1));
  /** בשניות האחרונות של שאלה: המוזיקה יורדת כדי שישמעו את הצפצופים */
  S.duck = (on) => { if (ducked === !!on) return; ducked = !!on; if (el && fileOn) fade(target(), 300); };

  let pendingId = null, touchHooked = false;
  function waitTouch(id) {
    pendingId = id;
    if (touchHooked) return;
    touchHooked = true;
    const go = () => {
      touchHooked = false;
      document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true);
      const want = pendingId; pendingId = null;
      if (want && !fileOn) { S.unlock(); S.playMusic(want); }
    };
    document.addEventListener('pointerdown', go, true); document.addEventListener('keydown', go, true);
  }
  S.playMusic = (id) => {
    pendingId = null;
    if (!FILES[id] && !TRACKS[id]) id = 'fun';
    if (!FILES[id] || failed[id] || !ensureEl()) { if (ctx) synth.play(SYNTH_OF(id)); return; }
    if (fileOn && fileTrack === id) return;
    if (ctx) synth.stop();
    fileTrack = id; fileOn = true; filePaused = false;
    const url = 'assets/music/' + id + '.mp3';
    if (el.getAttribute('src') !== url) el.setAttribute('src', url);
    try { el.currentTime = 0; } catch (e) { /* עוד לא נטען */ }
    el.volume = 0;
    const p = el.play();
    if (p && p.then) p.then(() => fade(target(), 600)).catch((err) => {
      if (fileTrack !== id || !fileOn) return;
      fileOn = false;
      if (err && err.name === 'NotAllowedError') { waitTouch(id); return; } /* מחכים לנגיעה */
      failed[id] = true;
      if (ctx) synth.play(SYNTH_OF(id));
    });
    else fade(target(), 600);
  };
  S.stopMusic = () => {
    pendingId = null;
    if (ctx) synth.stop();
    if (el && (fileOn || filePaused)) {
      fileOn = false; filePaused = false;
      fade(0, 250, () => { if (!fileOn && !filePaused) el.pause(); });
    }
  };
  S.pauseMusic = () => {
    if (fileOn) {
      fileOn = false; filePaused = true;
      fade(0, 150, () => { if (filePaused) el.pause(); });
      return true;
    }
    return ctx ? synth.pause() : false;
  };
  S.resumeMusic = () => {
    if (filePaused && fileTrack && el) {
      filePaused = false; fileOn = true;
      const p = el.play(); if (p && p.catch) p.catch(() => {});
      fade(target(), 400);
      return;
    }
    if (ctx) synth.resume();
  };
  S.musicPlaying = () => fileOn || (ctx ? synth.playing() : false);
  S.setMuted = (m) => {
    synth.setMuted(m);
    if (el && fileOn) fade(target(), 120);
  };
  document.addEventListener('visibilitychange', () => {
    if (!el || !fileOn) return;
    if (document.hidden) el.pause();
    else { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
  });

})(window.App);

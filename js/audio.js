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
      musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
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

  /* ---------- רצועות ----------
     כל רצועה: bpm, תבניות של 16 צעדים לתיבה, ומהלך אקורדים של 4 תיבות. */
  const X = 'x', _ = '.';
  const TRACKS = {
    drama: { /* מתח דרמטי ~150 */
      bpm: 150, root: 45, prog: [0, 0, -4, -2], scale: [0, 3, 7, 10],
      kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.',
      bass: 'x.xx.xx.x.xx.xx.', arp: 'xxxxxxxxxxxxxxxx', arpOct: 24, arpType: 'square', arpVol: 0.05,
      stab: 'x.......x.......', padVol: 0.035
    },
    chase: { /* מרדף ~172 */
      bpm: 172, root: 43, prog: [0, 3, -2, 1], scale: [0, 7, 12, 3],
      kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
      bass: 'xxxxxxxxxxxxxxxx', arp: 'x.x.x.x.x.x.x.x.', arpOct: 24, arpType: 'sawtooth', arpVol: 0.045,
      stab: '', padVol: 0.03
    },
    mystery: { /* מסתורין ~104 */
      bpm: 104, root: 41, prog: [0, 1, 0, -1], scale: [0, 3, 6, 10],
      kick: 'x.........x.....', snare: '........x.......', hat: '..x...x...x...x.',
      bass: 'x.....x...x.....', arp: 'x..x..x..x..x...', arpOct: 36, arpType: 'triangle', arpVol: 0.07,
      stab: '', padVol: 0.05, tick: true
    },
    fun: { /* כייפי קליקר ~126 */
      bpm: 126, root: 48, prog: [0, 5, -3, 7], scale: [0, 4, 7, 12], major: true,
      kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
      bass: 'x..x..x...x..x..', arp: 'x.xx.x.xx.x.x.xx', arpOct: 24, arpType: 'square', arpVol: 0.05,
      stab: '', padVol: 0.03, clap: true
    },
    cinema: { /* קולנועי ~92 */
      bpm: 92, root: 38, prog: [0, -4, -2, -5], scale: [0, 7, 12, 15],
      kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
      bass: 'x...............', arp: 'x...x...x...x...', arpOct: 24, arpType: 'sawtooth', arpVol: 0.04,
      stab: 'x...............', padVol: 0.06, boom: true
    }
  };
  S.TRACK_IDS = Object.keys(TRACKS);

  /* ---------- נגן (sequencer עם תזמון מראש) ---------- */
  const music = { track: null, step: 0, next: 0, timer: null, playing: false };

  function scheduleStep(tr, step, t, out) {
    const i = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chordRoot = tr.root + tr.prog[bar];
    const on = (p) => p && p[i] === X;
    if (on(tr.kick)) kick(t, out, 0.9);
    if (on(tr.snare)) { snare(t, out, 0.8); if (tr.clap) noise(t + 0.01, out, { vol: 0.3, dur: 0.12, bp: 1200 }); }
    if (on(tr.hat)) noise(t, out, { vol: i % 4 === 2 ? 0.14 : 0.08, dur: 0.04, hp: 7500 });
    if (on(tr.bass)) tone(t, out, { note: chordRoot + (i % 8 === 6 && tr.bpm > 140 ? 12 : 0), type: 'sawtooth', len: 60 / tr.bpm / 4 * 0.9, vol: 0.2, cutoff: 650, q: 4 });
    if (on(tr.arp)) {
      const deg = tr.scale[(step) % tr.scale.length];
      tone(t, out, { note: chordRoot + tr.arpOct + deg, type: tr.arpType, len: 60 / tr.bpm / 4 * 0.8, vol: tr.arpVol, cutoff: 3200, q: 2 });
    }
    if (on(tr.stab)) {
      const third = tr.major ? 4 : 3;
      pad(t, out, [chordRoot + 12, chordRoot + 12 + third, chordRoot + 19], 60 / tr.bpm * 0.9, 0.05);
    }
    if (i === 0) {
      const third = tr.major ? 4 : 3;
      pad(t, out, [chordRoot + 12, chordRoot + 12 + third, chordRoot + 19, chordRoot + 24], 60 / tr.bpm * 4, tr.padVol);
      if (tr.boom) { kick(t, out, 1); noise(t, out, { vol: 0.25, dur: 1.2, bp: 140 }); }
    }
    if (tr.tick && i % 4 === 0) tone(t, out, { note: 96, type: 'square', len: 0.02, vol: 0.05, cutoff: 9000 });
  }

  function pump() {
    if (!music.playing) return;
    const tr = TRACKS[music.track];
    const stepDur = 60 / tr.bpm / 4;
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
    musicBus.gain.setValueAtTime(0.55, ctx.currentTime);
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
      setTimeout(() => { if (!music.playing && musicBus) musicBus.gain.value = 0.55; }, 400);
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
    musicBus.gain.setTargetAtTime(0.55, ctx.currentTime, 0.08);
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
    tone(t, sfxBus, { note: high ? 88 : 81, type: 'square', len: high ? 0.07 : 0.1, vol: 0.18, cutoff: 6000, sus: 0.6 });
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
})(window.App);

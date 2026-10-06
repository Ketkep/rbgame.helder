// Fully synthesised audio: sfx, narrator "voice" blips, wind and a soft generative lounge score.
// Nothing is loaded from disk, so there are no assets to ship (and nothing to 404).

const SEMI = (n) => Math.pow(2, n / 12);

const SCORES = {
  // root is a MIDI-ish note number; chords are semitone offsets from root; scale used for plucks
  l1: { bpm: 100, root: 48, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]], pad: 0.5, pluck: 0.55 },
  l2: { bpm: 88, root: 50, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [[0, 4, 7, 10], [-2, 2, 5, 9], [-7, -3, 0, 4], [-5, -1, 2, 5]], pad: 0.55, pluck: 0.5 },
  l3: { bpm: 74, root: 45, scale: [0, 3, 5, 7, 10, 12, 15, 17], chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-7, -3, 0, 3]], pad: 0.7, pluck: 0.28 },
  l4: { bpm: 112, root: 47, scale: [0, 3, 5, 7, 10, 12, 15, 19], chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], pad: 0.3, pluck: 0.7, glitch: true },
  l5: { bpm: 96, root: 48, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [[0, 4, 7, 12], [-5, -1, 2, 7], [-3, 0, 4, 9], [-7, -3, 0, 5]], pad: 0.7, pluck: 0.45 },
  // lobby lounge: Dm7 - G7 - Cmaj7 - A7, slow swing-ish plucks
  hotel: { bpm: 80, root: 50, scale: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15], chords: [[0, 3, 7, 10], [-7, -3, 0, 3], [-2, 2, 5, 9], [-5, -1, 2, 5]], pad: 0.6, pluck: 0.42 },
  hotel2: { bpm: 96, root: 47, scale: [0, 3, 5, 7, 10, 12, 15, 17], chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-7, -3, 0, 3]], pad: 0.45, pluck: 0.55 },
  title: { bpm: 90, root: 48, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]], pad: 0.5, pluck: 0.4 },
};

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.muted = false;
    this.musicOn = true;
    this._musicTimer = null;
    this._score = null;
    this._step = 0;
    this._nextTime = 0;
    this._rng = 1;
    this._stepLast = 0;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicOn ? 0.5 : 0; this.music.connect(this.master);

    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // wind bed
    const ws = ctx.createBufferSource(); ws.buffer = this.noiseBuf; ws.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.5;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    ws.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master);
    this.windFilter = wf;
    ws.start();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.02);
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    return this.muted;
  }
  setMusicEnabled(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1);
  }
  setWind(amount) { // 0..1
    if (!this.ctx) return;
    this.windGain.gain.setTargetAtTime(Math.min(1, amount) * 0.22, this.ctx.currentTime, 0.2);
    this.windFilter.frequency.setTargetAtTime(350 + amount * 900, this.ctx.currentTime, 0.2);
  }

  // ---- building blocks -------------------------------------------------------------------
  _tone({ f = 440, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, slide = null, when = 0, dest = null, detune = 0 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _noise({ dur = 0.1, vol = 0.2, f = 1200, q = 0.7, type = 'lowpass', slide = null, when = 0, attack = 0.003 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---- sfx ---------------------------------------------------------------------------------
  jump() { this._tone({ f: 260, slide: 520, type: 'triangle', dur: 0.14, vol: 0.18 }); this._noise({ dur: 0.08, vol: 0.05, f: 2500, type: 'highpass' }); }
  land(impact = 6) {
    const v = Math.min(0.4, 0.06 + impact * 0.012);
    this._tone({ f: 120, slide: 55, type: 'sine', dur: 0.14, vol: v });
    this._noise({ dur: 0.1, vol: v * 0.5, f: 700 });
  }
  step() { this._noise({ dur: 0.05, vol: 0.05, f: 500 + Math.random() * 250, q: 1.2 }); }
  death() {
    // sad-trombone "womp womp" + buzzer
    const notes = [311, 293, 277, 220];
    notes.forEach((f, i) => this._tone({ f, slide: f * (i === 3 ? 0.78 : 0.97), type: 'sawtooth', dur: i === 3 ? 0.7 : 0.26, vol: 0.12, when: i * 0.27 }));
    this._tone({ f: 90, type: 'square', dur: 0.35, vol: 0.12 });
  }
  buzzer() { this._tone({ f: 110, type: 'sawtooth', dur: 0.5, vol: 0.2 }); this._tone({ f: 116, type: 'square', dur: 0.5, vol: 0.12 }); }
  checkpoint() {
    this._tone({ f: 784, type: 'sine', dur: 0.4, vol: 0.2 });
    this._tone({ f: 1175, type: 'sine', dur: 0.55, vol: 0.18, when: 0.1 });
    this._tone({ f: 1568, type: 'triangle', dur: 0.6, vol: 0.08, when: 0.2 });
  }
  click() { this._tone({ f: 900, type: 'square', dur: 0.04, vol: 0.08 }); }
  confirm() { this._tone({ f: 520, type: 'triangle', dur: 0.1, vol: 0.14 }); this._tone({ f: 780, type: 'triangle', dur: 0.16, vol: 0.14, when: 0.07 }); }
  tick() { this._tone({ f: 1500, type: 'square', dur: 0.025, vol: 0.05 }); }
  kick() { this._tone({ f: 150, slide: 42, type: 'sine', dur: 0.2, vol: 0.2 }); }
  hat() { this._noise({ dur: 0.04, vol: 0.04, f: 7000, type: 'highpass' }); }
  crumble() { this._noise({ dur: 0.35, vol: 0.14, f: 900, slide: 250, q: 0.6 }); }
  fall(len = 1.2) { this._tone({ f: 700, slide: 90, type: 'sine', dur: len, vol: 0.1 }); }
  whoosh() { this._noise({ dur: 0.5, vol: 0.12, f: 400, slide: 2400, type: 'bandpass', q: 0.8 }); }
  laser() { this._tone({ f: 180, type: 'sawtooth', dur: 0.2, vol: 0.05, slide: 150 }); }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone({ f, type: 'triangle', dur: 0.4, vol: 0.18, when: i * 0.11 }));
    this._tone({ f: 1047, type: 'triangle', dur: 0.9, vol: 0.2, when: 0.46 });
    this._tone({ f: 659, type: 'sine', dur: 0.9, vol: 0.12, when: 0.46 });
  }
  levelComplete() { this.fanfare(); this._noise({ dur: 1.2, vol: 0.08, f: 3000, type: 'highpass', when: 0.4 }); }
  beep(len = 1.0) { this._tone({ f: 1000, type: 'sine', dur: len, vol: 0.06, attack: 0.02 }); }
  glitch() {
    for (let i = 0; i < 6; i++) this._tone({ f: 200 + Math.random() * 1400, type: 'square', dur: 0.04, vol: 0.05, when: i * 0.035 });
  }
  achievement() { [880, 1108, 1318].forEach((f, i) => this._tone({ f, type: 'triangle', dur: 0.2, vol: 0.1, when: i * 0.06 })); }
  // ---- hotel sfx ----
  ding() { this._tone({ f: 988, type: 'sine', dur: 1.3, vol: 0.2 }); this._tone({ f: 1480, type: 'sine', dur: 1.5, vol: 0.12, when: 0.02 }); this._tone({ f: 1976, type: 'sine', dur: 0.9, vol: 0.05, when: 0.02 }); }
  bell() { [2093, 3135, 4186, 5274].forEach((f, i) => this._tone({ f, type: 'sine', dur: 1.6 - i * 0.25, vol: 0.12 / (i + 1), attack: 0.002 })); this._noise({ dur: 0.05, vol: 0.06, f: 6000, type: 'highpass' }); }
  piano(semi = 0) {
    const f = 261.6 * Math.pow(2, semi / 12);
    this._tone({ f, type: 'triangle', dur: 1.7, vol: 0.2, attack: 0.004 });
    this._tone({ f: f * 2, type: 'sine', dur: 1.1, vol: 0.07, attack: 0.004 });
    this._tone({ f: f * 3.01, type: 'sine', dur: 0.6, vol: 0.03, attack: 0.004 });
    this._noise({ dur: 0.03, vol: 0.04, f: 2200 });
  }
  door() { this._noise({ dur: 0.8, vol: 0.1, f: 500, slide: 180, q: 0.8 }); this._tone({ f: 70, type: 'sine', dur: 0.4, vol: 0.12, when: 0.7 }); }
  lock() { for (let i = 0; i < 3; i++) this._tone({ f: 260 + i * 40, type: 'square', dur: 0.04, vol: 0.07, when: i * 0.07 }); }
  rumble(len = 2) { this._noise({ dur: len, vol: 0.12, f: 140, q: 0.7, attack: 0.3 }); this._tone({ f: 52, type: 'sine', dur: len, vol: 0.08, attack: 0.3 }); }
  chime() { [659, 784, 988].forEach((f, i) => this._tone({ f, type: 'sine', dur: 0.5, vol: 0.09, when: i * 0.09 })); }

  /** Narrator "voice": one short blip per spoken character. `pitch` ~ 0.8..1.3 */
  blip(pitch = 1, vol = 1) {
    const f = 170 * pitch;
    this._tone({ f, type: 'square', dur: 0.06, vol: 0.04 * vol, attack: 0.004, slide: f * 0.85 });
    this._tone({ f: f * 2.01, type: 'triangle', dur: 0.05, vol: 0.02 * vol, attack: 0.004 });
  }

  // ---- music -------------------------------------------------------------------------------
  playMusic(name) {
    if (!this.ctx) return;
    const score = SCORES[name] || SCORES.title;
    if (this._score === score) return;
    this.stopMusic();
    this._score = score;
    this._step = 0;
    this._rng = 12345 + name.length * 77;
    this._nextTime = this.ctx.currentTime + 0.15;
    this._musicTimer = setInterval(() => this._scheduleMusic(), 80);
  }
  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    this._musicTimer = null; this._score = null;
  }
  _rand() { this._rng = (this._rng * 1664525 + 1013904223) >>> 0; return this._rng / 4294967296; }
  _scheduleMusic() {
    const ctx = this.ctx, s = this._score;
    if (!ctx || !s) return;
    const eighth = 60 / s.bpm / 2;
    while (this._nextTime < ctx.currentTime + 0.35) {
      const t = this._nextTime;
      const step = this._step;
      const bar = Math.floor(step / 8);
      const chord = s.chords[bar % s.chords.length];
      const when = t - ctx.currentTime;
      if (step % 8 === 0) {
        // pad: two detuned triangles per chord note, long attack/release
        const dur = eighth * 8;
        chord.forEach((n) => {
          const f = 440 * SEMI(s.root + n - 69);
          this._tone({ f, type: 'triangle', dur: dur * 1.05, vol: 0.05 * s.pad, attack: dur * 0.35, when, dest: this.music, detune: -6 });
          this._tone({ f, type: 'sine', dur: dur * 1.05, vol: 0.05 * s.pad, attack: dur * 0.35, when, dest: this.music, detune: 6 });
        });
        // bass
        this._tone({ f: 440 * SEMI(s.root + chord[0] - 69 - 12), type: 'sine', dur: dur * 0.9, vol: 0.14, attack: 0.02, when, dest: this.music });
      }
      // pluck arpeggio
      if (this._rand() < s.pluck * (step % 2 === 0 ? 1 : 0.55)) {
        const pool = this._rand() < 0.6 ? chord.map((n) => n + 12) : s.scale.map((n) => n + 12);
        const n = pool[Math.floor(this._rand() * pool.length)];
        const f = 440 * SEMI(s.root + n - 69);
        if (s.glitch) this._tone({ f, type: 'square', dur: 0.12, vol: 0.025, when, dest: this.music, detune: (this._rand() - 0.5) * 40 });
        else {
          this._tone({ f, type: 'sine', dur: 0.9, vol: 0.07, attack: 0.004, when, dest: this.music });
          this._tone({ f: f * 2, type: 'triangle', dur: 0.4, vol: 0.02, attack: 0.004, when, dest: this.music });
        }
      }
      this._nextTime += eighth;
      this._step++;
    }
  }
}

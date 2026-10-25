// Lowtide's soundscape, fully synthesised (WebAudio) like the rest of the game: a low drone bed, dripping water, a heartbeat, whispers,
// breath, distant footsteps and wheels, metal groans, door slams and the big stings. Everything runs through one bus so a level can fade it.
// Loud things (`sting`, `slam`) are deliberate and rate-limited by scare.js.

export function horrorSound(game) {
  const A = game.audio;
  const S = { ok: false };
  const ctx = () => A.ctx;
  let bus, drone, droneGain, lp, heart = { on: false, rate: 1, next: 0 }, dripNext = 0, wasOn = false;
  const nz = () => A.noiseBuf;

  S.start = () => {
    if (!A.ctx || S.ok) return;
    const c = A.ctx;
    bus = c.createGain(); bus.gain.value = 0.9; bus.connect(A.master);
    // the drone: two detuned saws and a sine sub through a slow low-pass
    lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 6;
    droneGain = c.createGain(); droneGain.gain.value = 0.0;
    for (const [f, ty, g] of [[41.2, 'sawtooth', 0.22], [41.9, 'sawtooth', 0.18], [20.6, 'sine', 0.5], [61.8, 'triangle', 0.1]]) {
      const o = c.createOscillator(); o.type = ty; o.frequency.value = f; const og = c.createGain(); og.gain.value = g; o.connect(og); og.connect(lp); o.start();
    }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    lp.connect(droneGain); droneGain.connect(bus);
    // air: very quiet filtered noise
    const ns = c.createBufferSource(); ns.buffer = nz(); ns.loop = true; const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 380; const ng = c.createGain(); ng.gain.value = 0.05; ns.connect(nf); nf.connect(ng); ng.connect(bus); ns.start();
    S.ok = true;
  };
  S.stop = () => { if (!S.ok) return; try { bus.gain.setTargetAtTime(0, A.ctx.currentTime, 0.2); } catch { /* ignore */ } S.ok = false; };
  /** 0 calm … 1 terror: opens the drone filter and raises it. */
  S.dread = (k) => { if (!S.ok) return; const t = A.ctx.currentTime; droneGain.gain.setTargetAtTime(0.1 + 0.5 * k, t, 0.6); lp.frequency.setTargetAtTime(110 + 520 * k, t, 0.8); };

  const tone = ({ f = 200, type = 'sine', dur = 0.3, vol = 0.2, when = 0, slide = 0, pan = 0, attack = 0.005 }) => {
    const c = ctx(); if (!c || !S.ok) return;
    const t = c.currentTime + when, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null; if (p) { p.pan.value = pan; o.connect(g); g.connect(p); p.connect(bus); } else { o.connect(g); g.connect(bus); }
    o.start(t); o.stop(t + dur + 0.05);
  };
  const noise = ({ f = 800, q = 1, type = 'bandpass', dur = 0.3, vol = 0.2, when = 0, pan = 0, attack = 0.01, sweep = 0 }) => {
    const c = ctx(); if (!c || !S.ok) return;
    const t = c.currentTime + when, s = c.createBufferSource(); s.buffer = nz();
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f + sweep), t + dur); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null; s.connect(fl); fl.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  };

  S.drip = (pan = (Math.random() - 0.5) * 1.6) => { const f = 900 + Math.random() * 900; tone({ f, type: 'sine', dur: 0.12, vol: 0.05, slide: -f * 0.5, pan }); noise({ f: 2400, q: 3, dur: 0.1, vol: 0.02, pan }); };
  S.beat = (strength = 1) => { tone({ f: 52, type: 'sine', dur: 0.2, vol: 0.5 * strength, slide: -18 }); tone({ f: 46, type: 'sine', dur: 0.22, vol: 0.4 * strength, when: 0.2, slide: -16 }); };
  S.heart = (on, rate = 1) => { heart.on = on; heart.rate = rate; };
  /** A whisper: formant-filtered noise that drifts across the stereo field. pan -1 left … 1 right. */
  S.whisper = (pan = 0, dur = 1.6, vol = 0.14) => { for (let i = 0; i < 6; i++) noise({ f: 1500 + Math.random() * 2600, q: 5, dur: 0.28 + Math.random() * 0.22, vol: vol * (0.5 + Math.random() * 0.5), when: i * (dur / 6), pan: pan + (Math.random() - 0.5) * 0.3, attack: 0.05 }); };
  S.breath = (pan = 0, vol = 0.1) => { noise({ f: 700, q: 1.2, dur: 0.8, vol, pan, attack: 0.3, sweep: -250 }); noise({ f: 520, q: 1.2, dur: 0.9, vol: vol * 0.9, when: 1.0, pan, attack: 0.35, sweep: 220 }); };
  S.step = (pan = 0, vol = 0.12, heavy = false) => { noise({ f: heavy ? 180 : 320, q: 1.4, type: 'lowpass', dur: 0.14, vol, pan, attack: 0.004 }); tone({ f: heavy ? 70 : 110, type: 'sine', dur: 0.12, vol: vol * 0.9, slide: -40, pan }); };
  S.squeak = (pan = 0, vol = 0.05) => { tone({ f: 1800 + Math.random() * 500, type: 'square', dur: 0.09, vol, slide: 300, pan }); };
  S.groan = (vol = 0.2) => { tone({ f: 70, type: 'sawtooth', dur: 2.4, vol, slide: 22, attack: 0.5, pan: (Math.random() - 0.5) }); noise({ f: 300, q: 2, dur: 2.2, vol: vol * 0.4, attack: 0.5, sweep: -150 }); };
  S.scrape = (pan = 0, vol = 0.12) => { noise({ f: 2600, q: 8, dur: 1.0, vol, pan, attack: 0.2, sweep: -1400 }); };
  S.door = (pan = 0, vol = 0.3) => { noise({ f: 160, q: 1, type: 'lowpass', dur: 0.4, vol, pan, attack: 0.003 }); tone({ f: 80, type: 'sine', dur: 0.4, vol: vol * 0.8, slide: -50, pan }); noise({ f: 1200, q: 3, dur: 0.2, vol: vol * 0.3, pan, when: 0.02 }); };
  /** The big ones. loud: a dissonant cluster + noise burst, then a ringing tail. */
  S.sting = (vol = 0.5) => {
    for (const f of [185, 196, 262, 277, 370]) tone({ f, type: 'sawtooth', dur: 1.2, vol: vol * 0.22, attack: 0.004, slide: -f * 0.18 });
    noise({ f: 1800, q: 0.7, dur: 0.5, vol: vol * 0.7, attack: 0.003, sweep: -1300 }); tone({ f: 1400, type: 'sine', dur: 2.2, vol: vol * 0.08, attack: 0.1 });
  };
  S.slam = (vol = 0.6) => { noise({ f: 120, q: 0.6, type: 'lowpass', dur: 0.6, vol, attack: 0.002 }); tone({ f: 55, type: 'sine', dur: 0.7, vol: vol * 0.9, slide: -35, attack: 0.002 }); noise({ f: 2400, q: 1, dur: 0.15, vol: vol * 0.4, attack: 0.002 }); };
  S.wail = (vol = 0.1) => { tone({ f: 330, type: 'sine', dur: 3, vol, slide: 90, attack: 1.2, pan: (Math.random() - 0.5) * 1.2 }); tone({ f: 333, type: 'sine', dur: 3, vol: vol * 0.7, slide: 120, attack: 1.2, pan: (Math.random() - 0.5) * 1.2 }); };
  S.static = (dur = 0.7, vol = 0.18) => { noise({ f: 3200, q: 0.5, type: 'highpass', dur, vol, attack: 0.01 }); };
  S.intercom = () => { tone({ f: 880, type: 'sine', dur: 0.18, vol: 0.12 }); tone({ f: 660, type: 'sine', dur: 0.3, vol: 0.12, when: 0.2 }); };

  /** Per-frame: heartbeat, random drips, a heart of the room. */
  S.update = (dt, t) => {
    if (!S.ok) return;
    if (t > dripNext) { S.drip(); dripNext = t + 2 + Math.random() * 6; }
    if (heart.on && t > heart.next) { S.beat(0.8); heart.next = t + 0.9 / heart.rate; }
    wasOn = heart.on; void wasOn;
  };
  return S;
}

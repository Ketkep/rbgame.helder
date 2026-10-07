import * as THREE from 'three';
import { spot, floaters, makeGate, chain, easeInOut } from './common.js';

// Level 1 — The Tutorial. Honest for about thirty seconds. Everything it teaches is true…
// except the finish gate, which runs away, and one very trustworthy SAFE platform.

export default {
  id: 'l1',
  name: 'The Tutorial',
  music: 'l1',
  completeQuip: 'Totally fair. Tutorials always are.',
  titleCam: { center: [0, 1, -34], radius: 20, height: 7 },

  build(w, game) {
    w.env({
      top: 0x4a3ae0, horizon: 0xff9ec6, bottom: 0x6556f0,
      fog: { near: 70, far: 430 },
      sun: { color: 0xfff1e2, intensity: 1.9, dir: [0.45, 0.85, 0.42] },
      hemi: { sky: 0xb5b0ff, ground: 0xff9fc2, intensity: 0.85 },
      exposure: 0.95,
      bloom: { strength: 0.55, radius: 0.6, threshold: 1.05 },
      clouds: { count: 30, color: 0xffd3e8, y: [-50, -16], radius: [30, 280], opacity: 0.5, size: [50, 120] },
      motes: { color: 0xffffff, count: 200, size: 0.1, opacity: 0.55 },
    });
    w.setTheme({ tex: 'tile', color: 0xffffff, trim: 0x2dd4bf, edge: 0x5560a0, edgeOpacity: 0.28, accent: 0x2dd4bf, danger: 0xff4d5e });
    w.spawn = { x: 0, y: 0, z: 5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -35;

    const FLOOR = -Math.PI / 2;

    // ---------------------------------------------------------------- geometry ----------
    w.plat({ x: 0, y: 0, z: 0, w: 16, d: 16, path: true });    // start
    w.plat({ x: 0, y: 0, z: -34, w: 7, d: 52, path: true });                // the long walkway (z -60 … -8)

    const jumpZone = chain(w, { x: 0, y: 0, z: -60 }, [
      { gap: 2.0, d: 6, w: 6 },  // p1
      { gap: 2.6, d: 6, w: 6 },  // p2
      { gap: 3.0, d: 6, w: 6 },  // p3
      { gap: 2.2, d: 4, w: 6 },  // p4 — "SAFE"
      { gap: 2.4, d: 8, w: 7 },  // p5 — checkpoint
    ]);
    const [p1, p2, p3, p4, p5] = jumpZone;
    w.crumble(p4, { delay: 1.0, gone: 3.2 });

    const steps = chain(w, { x: 0, y: 0, z: jumpZone.endZ }, [
      { gap: 2.0, d: 4, w: 5, dy: 0.7 },
      { gap: 2.0, d: 4, w: 5, dy: 0.7 },
      { gap: 2.0, d: 4, w: 5, dy: 0.7 },
    ]);
    const beam = chain(w, { x: 0, y: steps.endY, z: steps.endZ }, [{ gap: 2.2, d: 12, w: 1.3, h: 0.6 }])[0];
    const c1 = chain(w, { x: 0, y: steps.endY, z: steps.endZ - 2.2 - 12 }, [{ gap: 2.2, d: 6, w: 6 }]);
    const c1p = c1[0];
    const farEdge = c1.endZ;
    const mov = w.plat({ x: 0, y: steps.endY, z: farEdge - 4.2, w: 4, d: 3, h: 0.6, moving: true, path: true });
    w.mover(mov, (t) => ({ z: Math.sin(t * 1.1) * 2.4 }));
    const c2 = chain(w, { x: 0, y: steps.endY, z: farEdge }, [{ gap: 8.4, d: 6, w: 6 }])[0];
    const exit = w.plat({ x: 0, y: steps.endY, z: -167.2, w: 10, d: 14, path: true });
    const EY = steps.endY;

    // ---------------------------------------------------------------- the finish gate ----
    const gate = makeGate(w, { x: 0, y: 0, z: -26, width: 6, label: 'FINISH' });
    let gateT = -1;
    w.onUpdate((dt) => {
      if (gateT < 0) return;
      gateT += dt;
      const k = Math.min(1, gateT / 7);
      gate.setZ(-26 - easeInOut(k) * 150);
      if (k >= 1) { gate.group.visible = false; gateT = -1; }
    });
    w.trigger({
      x: 0, y: 1.5, z: -13, w: 9, h: 4, d: 1,
      onEnter: () => {
        gateT = 0;
        game.audio.whoosh();
        w.after(0.4, () => game.say('l1.gate.1'));
        w.after(3.4, () => game.say('l1.gate.2'));
        w.after(8.5, () => game.say('l1.gate.3'));
      },
    });

    // ---------------------------------------------------------------- signs -------------
    w.sign({ text: 'THE TUTORIAL', x: 0, y: 8.5, z: -9, w: 14, h: 3.4, color: '#ffffff', glow: 1.2, glowColor: '#2dd4bf', tw: 1024 });
    w.sign({ text: 'ON AIR', x: -9.4, y: 6.4, z: -2, w: 3.4, h: 1.0, bg: '#ff2d4d', color: '#fff', glow: 1.1, rotY: 0.6, size: 64 });
    w.sign({ text: 'JUMP', x: 0, y: 0.03, z: -64.4, w: 4.2, h: 1.6, rotX: FLOOR, color: '#2dd4bf', stroke: '#0d5a50', double: false, size: 110, tw: 512 });
    w.sign({ text: 'LONGER →', x: 0, y: 0.03, z: -72.8, w: 4.6, h: 1.4, rotX: FLOOR, color: '#2dd4bf', double: false, tw: 512 });
    w.sign({ text: 'EASY', x: 0, y: 0.03, z: -81.4, w: 3.6, h: 1.4, rotX: FLOOR, color: '#2dd4bf', double: false, tw: 512 });
    w.sign({ text: 'SAFE ✔', x: 0, y: 0.03, z: p4.body.z, w: 4.4, h: 1.6, rotX: FLOOR, color: '#44e08a', stroke: '#0c4a2a', double: false, tw: 512 });
    w.sign({ text: game.touch ? 'LEFT thumb to move · JUMP to jump' : 'WASD to move · SPACE to jump', x: 0, y: 3.2, z: -2, w: 9, h: 0.9, color: '#ffffff', glow: 1.05, tw: 1024, size: 56 });
    w.sign({ text: 'EXIT', x: 0, y: EY + 6.6, z: -171.4, w: 5, h: 1.6, bg: '#12131c', color: '#ffc83d', border: '#ffc83d', size: 100, tw: 512 });
    const bigSign = w.sign({ text: 'TRUST ME…', x: 0, y: 28, z: -230, w: 90, h: 20, color: '#ffffff', glow: 1.45, glowColor: '#ffc83d', tw: 2048, size: 330, stroke: '#ff8a3d', strokeWidth: 12 });
    void bigSign;

    // door frame + goal
    const frame = (x, y, z, ww, hh, dd) => w.box({ x, y, z, w: ww, h: hh, d: dd, color: 0xf4f2ee, rough: 0.4, radius: 0.08 });
    frame(-2.7, EY + 3, -171, 0.7, 6, 0.9); frame(2.7, EY + 3, -171, 0.7, 6, 0.9); frame(0, EY + 6.2, -171, 6.1, 0.7, 0.9);
    w.goal({
      x: 0, y: EY, z: -170, color: 0x2dd4bf,
      onReach: () => { game.say('l1.exit.reach', { priority: 2 }); game.completeLevel(); },
    });
    w.light(0x2dd4bf, 14, 20, 0, EY + 3, -168);

    // checkpoint (real — you can trust this one)
    w.checkpoint({ x: 0, y: 0, z: p5.body.z, real: true });

    // ---------------------------------------------------------------- set dressing ------
    const lampCols = [0xfff1d6, 0xffc2e6, 0xbfe9ff, 0xfff1d6, 0xd7ccff, 0xfff1d6, 0xbffff0];
    for (let i = 0; i < 12; i++) {
      const z = -6 - i * 16, side = i % 2 ? 1 : -1;
      spot(w, { x: side * 11, y: 19, z, tx: -side * 1.5, ty: 0.2, tz: z - 5, color: lampCols[i % lampCols.length], r: 3.8, opacity: 0.1 });
    }
    for (const sx of [-11, 11]) w.box({ x: sx, y: 19.8, z: -90, w: 0.5, h: 0.5, d: 200, color: 0x23242f, metal: 0.7, rough: 0.35, shadow: false });
    // backdrop panels
    const panelCols = [0xffd6e6, 0xd6e6ff, 0xe6ffd6, 0xfff0c2, 0xe0d4ff, 0xc6f5ee];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, z = -20 - i * 16;
      const h = 14 + (i * 7) % 18;
      w.box({ x: side * (38 + (i % 3) * 7), y: h / 2 - 20, z, w: 3, h, d: 11 + (i % 4) * 3, color: panelCols[i % panelCols.length], emissive: null, shadow: false, rough: 0.8 });
    }
    floaters(w, { count: 16, x: [-80, 80], y: [6, 44], z: [-30, -190], avoid: 16, seed: 3 });
    w.windLevel = 0;

    // ---------------------------------------------------------------- tutorial script ----
    const st = { stage: 0, t: 0, yawAcc: 0, ly: 0, lp: 0, started: false };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing' || g.frozen) return;
      st.t += dt;
      if (st.stage === 0 && st.t > 1.1) {
        g.say('l1.welcome'); g.say('l1.welcome2'); g.say('l1.look');
        g.ui.prompt([{ label: 'MOUSE' }], 'to look around');
        st.stage = 1; st.ly = g.yaw; st.lp = g.pitch; st.t = 0;
      } else if (st.stage === 1) {
        st.yawAcc += Math.abs(g.yaw - st.ly) + Math.abs(g.pitch - st.lp);
        st.ly = g.yaw; st.lp = g.pitch;
        if (st.yawAcc > 1.4 && st.t > 3) {
          g.ui.promptDone();
          setTimeout(() => g.ui.prompt([{ label: 'W', code: 'KeyW' }, { label: 'A', code: 'KeyA' }, { label: 'S', code: 'KeyS' }, { label: 'D', code: 'KeyD' }], 'to move'), 450);
          g.say('l1.move');
          st.stage = 2; st.t = 0;
        }
      } else if (st.stage === 2) {
        if (g.player.z < w.spawn.z - 3.5) {
          g.ui.promptDone();
          g.say('l1.walk');
          st.stage = 3;
        }
      }
    };

    const jumpedWatcher = { on: false };
    w.trigger({
      x: 0, y: 1.5, z: -56, w: 9, h: 4, d: 1,
      onEnter: () => {
        g_prompt(game, [{ label: 'SPACE', code: 'Space' }], 'to jump (tap = hop, hold = full jump)');
        game.say('l1.gap.intro');
        jumpedWatcher.on = true;
      },
    });
    w.onUpdate(() => {
      if (jumpedWatcher.on && game.player.vy > 5) { jumpedWatcher.on = false; game.ui.promptDone(); }
    });
    const onTop = (plat, fn, once = true) => w.trigger({ x: plat.body.x, y: plat.top + 1.2, z: plat.body.z, w: plat.o.w - 1, h: 2.4, d: plat.o.d - 1, once, onEnter: fn });
    onTop(p1, () => game.say('l1.gap.1'));
    onTop(p2, () => game.say('l1.gap.2'));
    onTop(p3, () => game.say('l1.safe'));
    onTop(p4, () => w.after(0.5, () => game.say('l1.crumble', { priority: 2 })));
    onTop(beam, () => game.say('l1.beam'));
    onTop(c1p, () => game.say('l1.mover'));
    onTop(exit, () => game.say('l1.exit.near'));
    w.hooks.onCheckpoint = () => game.say('l1.checkpoint', { priority: 2 });
    w.hooks.onDeath = () => {
      if (game.totalDeaths === 1) { game.say('l1.fall.first', { priority: 2 }); return true; }
      return false;
    };
    void c2; void mov; void THREE;
  },
};

function g_prompt(game, keys, label) { game.ui.prompt(keys, label); }

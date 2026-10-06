# Trust Me…

A first-person rage-bait platformer where the game-show host narrating your run is **absolutely** not your friend.
Plays in the browser (desktop, keyboard + mouse). Live at **https://trustme.helderlabs.com**.

> "Welcome to TRUST ME… the game show where you can trust me completely."

## The game

Five short levels, each with a different way to betray you:

| # | Level | Gimmick |
|---|-------|---------|
| 1 | The Tutorial | Honest for about 30 seconds. The finish gate runs away. One very trustworthy "SAFE" platform. |
| 2 | Checkpoint Island | Five checkpoints, "all trustworthy". Two of them are fake (look for the crooked pole). |
| 3 | The Tower | Only Up-style climb. Falling erases progress, not lives. Wind, crumbling ledges, lasers, a bee. |
| 4 | Technical Difficulties | Fake loading screens, swapped controls, lag-spike rubber-banding, a test-pattern "crash", an ad, a lying death counter, a pause button that runs away. |
| 5 | The Real Ending | Fake credits, a curtain, a recap gauntlet, and two doors. The Host says **left**. |

- **Baby Mode**: after 25 deaths the Host offers it (press **B**, or "Beg for mercy" in the pause menu): higher jumps, longer coyote time, fake checkpoints actually save, and a permanent badge on your share card.
- Everything is telegraphed (ping turns red before a lag spike, controls announce themselves…). Annoying, not unfair.

### Controls
`WASD` move · `Space` jump (tap = hop, hold = full jump) · `Mouse` look · `R` respawn · `Esc` pause · `M` mute · `Enter` resume

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # headless physics tests
npm run build      # -> dist/
npm run preview    # serve the build on :4173
```

Handy URL params: `?debug` exposes `window.__trust` (the game object) and doesn't need pointer lock; `?debug&level=3` jumps straight into a level.

### Test tools (need `npm run preview` running + the preinstalled Chromium)
- `node tools/check-reach.mjs` — checks every hop between consecutive path platforms is physically jumpable with the real movement numbers.
- `node tools/bot.mjs <level>` — a waypoint bot plays the level to prove it's completable and the scripted beats fire.
- `node tools/test-game.mjs` — in-browser rule tests (fake vs real checkpoints, baby mode, wrong door, save/continue…).
- `node tools/shot.mjs <outdir> '<json>'` — headless screenshots.

### Layout
```
src/
  game.js          state machine, input, camera, death/respawn, baby mode, saves, post-processing
  narrator.js      subtitles + voice blips (+ optional voice pack)
  script.js        every line the Host says
  engine/
    physics.js     AABB platformer physics (no deps, unit-tested)
    world.js       platforms, movers, crumbling tiles, hazards, checkpoints, goals, wind, sky
    materials.js   procedural textures (no image assets!)
    audio.js       fully synthesised sfx + generative music
  levels/          level1..5.js + shared helpers
  ui.js, style.css HUD and menus
```
Everything visual and audible is procedural — there are no image/audio assets to ship.

## Deploying to trustme.helderlabs.com

Deploys automatically from `main` via GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`).

One-time setup:
1. **Repo → Settings → Pages → Source: GitHub Actions.**
2. **Settings → Pages → Custom domain:** `trustme.helderlabs.com`, then tick *Enforce HTTPS* once the certificate is issued.
3. **DNS** (wherever `helderlabs.com` is managed): add a `CNAME` record
   `trustme` → `ketkep.github.io`
   (the `public/CNAME` file in this repo already contains the domain).

## Giving the Host a real voice
See `public/voice/README.md` — drop `<line-id>.mp3` files in, list them in `manifest.json`. No code changes.

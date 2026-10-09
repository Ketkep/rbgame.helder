# Brief for agents building a Campaign 3 session (read this first, then `docs/campaign3.md`)

You are building ONE two-player level ("session") for Trust Me… Campaign 3 (Couples Retreat). Another level (`src/levels/coop/icebreakers.js`)
is finished and is your reference for style, kit usage, narrator lines and bot steps. Read it and `src/levels/coop/kit.js` and
`docs/campaign3.md` before writing anything.

## Non-negotiables (from the user)
* **~10 minutes for a first-time pair.** Long, multi-stage (6–9 stages), each stage teaching or twisting something. An experienced pair ~5 min.
* Genuinely two-player: every stage must be impossible (or pointless) for one person alone. Mix asymmetry / dependence / trust.
* "Trust Me…" flavour: the counsellor (narrator) is smug, lies sometimes, never helps with the actual solution. Different lines for p1 and p2 when it matters (`c.tell('p1', key)`).
* **No jump scares, no loud sounds.** **No random deaths without a tell** (hazards telegraph; the fair-but-learnable rule). Light trolling (fake finish line, fake checkpoint, a lying sign) is encouraged, always learnable.
* Checkpoints **on the main path** (x on the route centre, so a respawn lands you near where you died). Shared automatically.
* Platforms: adjacent platforms must be level or ≥1 m apart. Jump numbers: speed 6.6 m/s, jump apex 1.42 m, running-jump reach ≈4.3 m on the flat (use `reach(dh)` in `src/engine/physics.js`). A player can NOT hop onto a partner's head from the ground (head is 1.8 m); they need a ≥0.8 m step.
* Anything that changes physics/state because of a PLAYER action must go through `w.coop` (set/emit/zone/presence) so both machines agree. Time-driven things (functions of `w.t`) are fine as they are.
* Don't edit other levels. New helpers go in your own file `src/levels/coop/<yourlevel>-kit.js` (don't grow `kit.js` unless it's a small, clearly general addition — then keep it backwards compatible). Edit only: your level file(s), `src/levels/coop/roster.js` (register yours in `BUILT` at your index), `src/script.js` (append a block of `coop.lN.*` keys; keep one block per level so merges are trivial), `docs/campaign3.md` status column.

## Workflow
1. `cd` into your worktree. `ln -s /home/user/rbgame.helder/node_modules node_modules` (if missing). Pick a free preview port (41xx).
2. Build: `npm run build` — **every time** you change source, the preview serves `dist`. Start `npx vite preview --port 41xx &` once.
3. Iterate with the two-bot harness: `BASE=http://localhost:41xx/ node tools/coop-bot.mjs <N> 900` (N = your level number). Give your level `botSteps(...)` for anything the generic path-follower can't do (plates, levers, keypads, boosts, waiting for the partner). `JUMP` and `PROBE` env vars (see `docs/campaign3.md`) let you test mid-level; `node tools/_dump.mjs <N>`-style probes are fine (delete throwaway scripts before committing).
4. `BASE=… node tools/test-coop.mjs` must still pass. Don't break the other tests (`node tools/test-game.mjs` if you touch shared code).
5. The bots dying a few times is OK (they are dumb); a level that a perfect pair can't finish is a bug. Aim: bots complete it; deaths under ~25 per bot.
6. Length check: the bot's sim-seconds is NOT human time. Estimate human time as roughly 2–3× the bot's time plus ~1 s of talking per puzzle beat. Add content (more stages, longer routes, extra puzzle rounds) until your estimate for a first-time pair is ≈10 minutes.
7. Commit on your branch (`git add src tools docs`; never `git add -A` — there are embedded worktrees). End commit messages with the attribution lines the system gave you. Push the branch. Do NOT merge to main.
8. Report: what each stage is, bot result (sim time, deaths), human-time estimate, known weak spots, anything you changed outside your own files.

## Narrator keys
Add `'coop.lN.<name>': ['line', 'alt line']` entries to `SCRIPT` in `src/script.js` (one block, with a comment header). Use `{n}` style vars only if you pass `vars`. Lines are spoken as the counsellor: dry, passive-aggressive, relationship-therapy puns. Keep them short.

## Things that bite
* `w.sky` is used by World; never overwrite it.
* Lobby-style big floors under movers make "void" levels look fine but kill nothing — use separate platforms over `killY` (-40).
* `w.plat({y})` — y is the **top** surface. `w.mover`, `w.crumble`, `riser`, `gate` all need `moving`-style plats (the helpers set it).
* Bots drive `g.keys` and `_simulate` directly; modals must be closed with `g.closeModal()` (the harness does it) — avoid long modal-only puzzles without bot support.
* Zones/plates see the partner with ~50–100 ms lag; never rely on exact simultaneity under ~0.3 s.

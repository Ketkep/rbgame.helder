# Hotel redo — floors 1–3 rebuilt (the brief)

The player's feedback after trying levels 1–10: **the levels are far too short (under a minute), there is almost no trolling, one wall glitches, and the mazes can be walked around.** This is the plan for redoing levels 1–15. It is the single source of truth for whoever builds a level. Read this whole file, then `docs/hotel-campaign.md`, then the level's current file and the kit files it uses.

Already done (do not redo): the maze walk-around is fixed (`buildMazeWalls(..., { reach: [xWest, xEast] })` seals the room), the z-fighting end-wall trim in `roomShell` is fixed, and `src/levels/hotel/trolls.js` (the troll kit) exists. **`wet-floor.js` (level 1) is the finished reference implementation of the new style. Read it first.**

## What the player asked for (decisions, all confirmed)

| Topic | Decision |
|-------|----------|
| Length | "Easy ≈ 2–3 min, then each floor up to ~1 min longer **or** harder." Measured as a **careful clean run by someone who knows the level**; real first attempts take longer (deaths, exploring). Floor 1: 2–3 min · Floor 2: 3–4 min · Floor 3: 4–5 min. |
| How to get there | **Multi-stage levels**: 4–6 stages per level, every stage a different mechanic and/or trick, like a mini-campaign inside the level. Not one long corridor. |
| Concepts | Keep all 15 names/themes/music; rebuild each bigger. |
| Trolling | Scaled by floor: **Floor 1 ≥ 4 trick beats per level, Floor 2 ≥ 6, Floor 3 ≥ 8** (a beat = a fake exit, checkpoint betrayal, floor that lies, last-second trick, host lie, interface gag, control twist…). Every troll is **learnable** (a tell, or the host is suspiciously confident) — fair on the second try, no luck. |
| Physical trolls wanted | Fake exits & fake goals · checkpoint betrayals · floors that lie · last-second tricks |
| Host/interface trolls wanted | Host lies & fake hints · fake UI glitches (loading, crash, ads, fake "level complete", survey) · control twists · fourth-wall jabs (death count, callbacks, "accidental" spoilers) |
| Fake LEVEL COMPLETE | Real-looking, then "just kidding" and you are back in the level for a bonus stage. At most once per level, and only on some levels. |
| Checkpoints | One at the end of every stage (never lose more than ~40–60 s). Rare betrayals (fake / expiring / "rewind") on floors 2 and 3, one fake on floor 1. |
| Hint (H) | **Honest everywhere** (never lies) and **only shows the next stage**, not the whole route (so it does not spoil the surprise stages). |
| Baby Mode | Turns the nastiest trolls off: fake exits are labelled "(decoy)", fake checkpoints count, twists are short, goals hop once, one-way surprises removed. (The kit already does this; mind it in your own code.) |
| Quiz levels | Many rounds, each with its own twist; platforming/escape breaks between acts. |
| Mazes | Sealed rooms (see above). New random maze every attempt stays. |
| Platform | Desktop only for the hotel (no touch work). |

## Time targets (what to measure)

`tools/bot.mjs` plays a level perfectly (see below). Its **sim-seconds** are the number to hit. A human careful run is ≈ 1.4–1.8× the bot (precision platforming, reading, waiting), and deaths add more.

| Floor | Bot target (sim s) | Human clean run | Tricks |
|-------|-------------------|-----------------|--------|
| 1 (levels 1–5) | **100–140** | 2–3 min | ≥ 4 beats |
| 2 (6–10) | **140–185** | 3–4 min | ≥ 6 beats |
| 3 (11–15) | **185–235** | 4–5 min | ≥ 8 beats |

Hitting the lower bound is a floor, not a goal: if it is easy to make a level richer, do. Do not pad with empty corridor; pad with stages.

## The shape of every level

1. **4–6 stages**, each ~25–50 s, each with a *different* idea. Show a stage banner (`stageTitle`) when a checkpoint is reached.
2. A **real checkpoint at the end of each stage** (`w.checkpoint`). Floors 2–3 may replace one with `trollCheckpoint` ('expire' | 'fake' | 'rewind'); Floor 1 gets at most one fake, with a tell (the pole is a hair crooked — the engine does that for `real:false`).
3. The host talks a lot, in character (smug game-show host, lies, takes credit, never apologises). Every line is a key in `src/script.js` (`'hotel.lN.xxx'`, arrays = random variant). **No line may be missing from SCRIPT** (the narrator would print the key).
4. **`stageHint(w, stages, …)`** (or your own `hintFn`/`hintAction` for quiz/escape levels): honest, next stage only.
5. Death commentary through `w.hooks.onDeath` (return true if you spoke). Fourth-wall jabs welcome ("that is death number {n}").
6. A level's `completeQuip` stays in the voice.

## The troll kit (`src/levels/hotel/trolls.js`) — use it, do not reinvent it

| Function | What it does |
|----------|--------------|
| `fakeComplete(game, w, {title, say, then})` | A convincing LEVEL COMPLETE overlay that turns into "…JUST KIDDING". Returns `true` the first time (play the bonus in `then`), `false` after (complete the level for real). |
| `fakeExit(w, game, {x,y,z,kind:'goal'|'door', say, onTouch})` | A decoy exit. `'door'` = press E, swings open on a closet with no floor (kills). Default `onTouch` kills. Never touches `w.goalObj`. |
| `evasiveGoal(w, game, {spots, radius, onReach, say})` | A real goal that hops away as you approach (once per spot). |
| `trollCheckpoint(w, game, {x,y,z, mode:'fake'|'expire'|'rewind', ttl, back, say})` | Fake (never saves) · expiring (saves, forgets after `ttl` s, re-touch re-saves) · rewind (says saved, sends you back to `back`). |
| `twist(game, w, kind, {sec, say})` / `twistZone(game, w, box, kind, opts)` | Control mutators: `swap` (A↔D), `fwd` (W↔S), `mouseX`, `mouseY`, `lag` (late jumps). Always toasted, always revert; ≤3.5 s in Baby Mode. |
| `loadingScreen`, `crash`, `adBreak`, `survey` | Fake interface moments (`loadingScreen`/`crash` freeze the world; `adBreak` does not; `survey` is a modal, press 1–5). |
| `vanishAfter(w, game, plat, {axis, dir, frac, delay, back})` | A platform that gives way once you are past `frac` of it (shimmers: that is the tell; keep running). |
| `ghostPlat(w, opts)` | A solid platform drawn as a faint outline (rim glows). |
| `lookAwayFlip(w, game, a, b)` | Two platforms, one solid; they swap while neither is on screen. |
| `stageTitle`, `stageZone`, `stageHint` | Banner + honest next-stage hint. |

Existing engine pieces you will want: `w.rollaway`, `w.crumble`, `w.mover`, `w.conveyor`, `w.hazard` (`jumpable`, `predict`), `w.wind`, `w.interactable`, `openKeypad`, `inView`, `Walker`, `quizHall`, `engine/bill.js`, `onPlat`. If a trick does not exist in the kit, **build it in your level file** (do not grow `trolls.js` unless the bug is in it, and then keep the change minimal).

New control mods added to the engine: `game.mods.invertX`, `swapFwd`, `jumpLag`, all reset on respawn.

## Level plans

Each plan is a starting point; keep the *stage count*, the *signature tricks*, and the *time target*, and make it good. Stage times are the bot's.

### Floor 1 — Mezzanine (Easy, bot 100–140 s, ≥ 4 beats)

**1 · Wet Floor** — DONE (reference). Six stages, fake checkpoint, vanishing bridge, A/D swap, broom-closet EXIT, evasive goal, fake LEVEL COMPLETE + bonus climb.

**2 · Check-In** (quiz) — a registration desk that will not stop asking. 8–10 questions in 3–4 acts. Twists, one per round, in this spirit: honest · the host lies (suspiciously confident) · pads slide · a clock · "none of the above" is the real answer · "pick the WRONG one" · the host changes his mind after you sign · two right answers. Between acts, a short platforming/escape interlude (luggage trolleys, a revolving door that spins you) so it is not all standing on pads. Interface gags: `survey` after act 1 ("How are we doing?"), an `adBreak`, and a `fakeComplete` ("CHECKED IN!" — you still have to sign the register: a final act). Hint: 50/50 stays; it never lies. A checkpoint per act. Questions are about things any player knows (see `quiz.js`).

**3 · Lost Luggage** (escape room) — three rooms, not one. (a) The baggage office (existing keypad puzzle; the host's code is wrong, the poster's suitcase count is right, one suitcase is a mimic). (b) The baggage hall: belts + a press + a sorting puzzle (colour/weight) that gives a second code. (c) Lost Property cage: a final puzzle with a trick (the host swears the answer is on the tag; it is on the back). Tricks: the X-ray scanner `loadingScreen`, an expiring checkpoint, a fake "CUSTOMS · NOTHING TO DECLARE" exit that kills, the keypad lies once ("accepted… just kidding"), a conveyor that reverses. Hint: honest clue ladder, next room only.

**4 · Revolving Door** (maze, sealed) — two mazes in a row, not one. Hedge maze #1 (revolving doors on a schedule + luggage carts; N≈7), a courtyard parkour (fountain stepping stones, a crumble, a rolling cart), then maze #2, a bigger one (N≈8–9) with fog/dusk, more doors and **a door that is a loop (it sends you to the start of the maze)**. Tricks: the host's confident wrong directions, a decoy EXIT arch at a dead end, `adBreak` at the garden gate, checkpoints at each maze's mid-point and at the courtyard. Rooms stay sealed (`reach`). Hint: solves the maze from where you stand, but only the current maze.

**5 · Bellhop Blues** (chase) — a longer run through the back of house with the giant bell on your heels. Four to five stages with doors that slam behind you (the bell waits at each door a few seconds: that is the checkpoint rhythm): belts + wet marble (existing), a laundry-chute drop, a kitchen pass-through with rolling carts and swinging doors, stairs, a service elevator that goes the **wrong way** (fake exit), a dumbwaiter that is the real one. `fakeComplete` when the elevator opens ("OUT OF ORDER"). Baby Mode slows the bell.

### Floor 2 — Restaurant & Ballroom (Medium, bot 140–185 s, ≥ 6 beats)

**6 · Soufflé** (climb) — the soufflé still rises, but the kitchen is three zones (prep, grill, pastry) with the soufflé *pausing* behind each zone's door so there are safe checkpoints. Steam jets, swinging pans, burners, sliding trays, crumbling cookie sheets (keep). Tricks: the oven EXIT (existing, kills) plus a second fake exit, a `vanishAfter` cookie sheet, `twist` lag near the steam, an expiring checkpoint, the host's "it's only 10 seconds behind you" lies, a `fakeComplete` at the roof hatch ("it fell! …it rose again").

**7 · Trivia Night** (quiz) — ten rounds in the grand ballroom, a twist each: honest · the host lies · sliding pads · a 12 s clock · four answers · "which did I swear in round 2?" (keep) · no correct answer · "stand between two pads for double or nothing" · the audience poll lies · the question changes after you commit. Chandelier-hop interludes. `survey`, `crash`, a tie-breaker `fakeComplete`. Hint honest (50/50), never lies.

**8 · Dinner Is Served** (escape) — keep the six courses (riddles; wrong course = dessert trolley falls) and the wine cellar (rolling barrels, Merlot), and add: a **cloche shell game** in the kitchen pass (shuffle animation, which dome hides the key; the host's pointing is wrong), a tip-jar puzzle, a fake exit (the dumbwaiter), and a `fakeComplete` after the cellar ("you forgot dessert: second sitting"). Expiring checkpoint in the cellar.

**9 · Kitchen Maze** (maze + chef, sealed) — two mazes: the walk-in freezers (ice floors, one-way doors, the chef) then the pantry (dark, a second chaser, lights flicker). Sealed. Tricks: a fake LOADING DOCK exit with shutters, a `twist('fwd')` on the ice, `crash` mid-chase (the chef pauses too, fairly), an expiring checkpoint between mazes, the host cheers for the chef. Hint: current maze only.

**10 · Dance Floor** (rhythm parkour) — four sets of increasing complexity (tile patterns, a conga-line mover chain, spotlight tiles you must stand in, mirror-ball bridges) with the DJ's FREEZE. Tricks: a **bluff FREEZE** (tell: the strobes stay on; moving is fine), the beat skips once, `twist('mouseX')` during the strobe, a `vanishAfter` tile run, a `fakeComplete` at the DJ booth, a fake VIP exit. Checkpoint per set.

### Floor 3 — Guest Rooms (Hard, bot 185–235 s, ≥ 8 beats)

**11 · Room 404** (escape) — three rooms: the bedroom (existing: three digits in furniture that moves when unwatched, a wardrobe that walks when unwatched, blackouts), the bathroom (a mirror puzzle in the dark), the hallway (the wardrobe chase to the keypad). The code lies once ("404"), the door opens onto Room 404 again (a loop: fake exit), `fakeComplete`, `twist('mouseX')` in a blackout, an expiring checkpoint. Hint honest, next room only.

**12 · Do Not Disturb** (stealth maze, sealed) — bigger (N≈9), three housekeepers, two wings joined by a service elevator (`loadingScreen`). Hide in carts. Tricks: a DND sign you can hang on a door to block a maid (a tool that sometimes the host lies about), fake exits, a maid that turns out to be a statue, a `fakeComplete` at the stairs. Checkpoint at the elevator.

**13 · Minibar** (quiz with money) — twelve rounds across 3 acts, minibar prices lie, hints cost money (the hint *button* stays honest), the card is declined (`survey`), a pay-to-skip `adBreak`, the bill + a tip you cannot refuse (existing). Between acts: a checkout-queue parkour with luggage hazards. `fakeComplete` after the bill ("a correction: there is a second bill").

**14 · Hallway Loop** (anomaly loop) — eight rounds instead of six, many more kinds of anomaly (swapped paintings, the clock, a door, a light, the carpet, a sound…), some rounds with parkour (gaps in the floor). Tricks: the host's opinion lies; after round 6 the "way out" is itself an anomaly (fake exit); `twist('mouseY')` and `twist('mouseX')` on specific anomalies; `crash` at round 7 ("reality unstable"); an expiring progress counter (it can drop by one). Hint honest.

**15 · Window Ledge** (storm parkour) — a much longer ledge route (windows 1–5, each its own stage), wind gusts, lightning that whites the screen out for a moment, the gondola, pipes. Tricks: a painted-on window EXIT, `vanishAfter` sills, an expiring checkpoint, `twist('mouseX')` in a gust, a gargoyle that "helps", `fakeComplete` at the open window ("ROOM 1502 — wrong floor"), stage banners.

## How to build and test (no GPU: software GL, be patient)

```
npm run build                      # dist/
npx vite preview --port 4173       # NOTE: if you work in a worktree use your own port, set BASE=http://localhost:<port>/ for the tools
CAMPAIGN=hotel NEAR=1 node tools/bot.mjs <level> 400      # perfect-play bot: prints "COMPLETED {sim…}" (sim seconds = your length)
node tools/test-floors.mjs <suite>                       # in-browser logic tests (add suites for your level in tools/test-floors.mjs)
node tools/shot.mjs <outdir> '[{"name":"a","campaign":"hotel","level":1,"tp":[x,y,z],"yaw":0,"pitch":0,"wait":1500}]'   # screenshots
node tools/smoke-hotel.mjs         # every hotel level loads, runs, and unloads
```
Bots are slow (minutes per level): run them in the background and read the log. Kill stray browsers with a script file, **never** `pkill -f` with a pattern that appears in your own command line. A level that cannot be completed by the bot (use `w.botPlan(g) → {x,z}` for non-platform steps, flag route platforms with `plat.o.path = true` in route order) is not finished.

Checklist per level: bot completes within the time target · no deaths in a clean bot run unless the level wants them · every `game.say` key exists in `src/script.js` · baby mode path works · hint is honest and next-stage-only · respawn leaves nothing stuck (frozen game, overlay, twist) · a test suite in `tools/test-floors.mjs` · the level unloads cleanly (`tools/test-leak.mjs` style: no leaked listeners/overlays) · screenshots of each stage look right (no z-fighting, nothing floating without support, nothing clipped).

# Campaign 2 — Hotel Trust-Me

*Check in. Checking out is a process.* 25 levels, five floors, one very smug manager (the host, in a new uniform).

## Status

| Piece | State |
|-------|-------|
| Hotel world (art-deco lobby, lighting, reflections, night skyline) | ✅ built |
| Walkable hub with 5 elevators as the level select | ✅ built |
| Interaction system (look at things, press **E** / click) | ✅ built |
| Hint button (**H**) — dotted trail / quiz 50/50 / puzzle clues | ✅ built |
| Building blocks: slippery marble, rolling platforms, conveyor belts, quiz pads + gates, keypad, hedge maze, chasers | ✅ built |
| **Floor 1 — Mezzanine (levels 1–5)** | ✅ playable |
| Floors 2, 3, 4 and 13 (levels 6–25) | ⏳ "under renovation" (named, listed, locked in the elevators) |

## How it works

- The campaign opens in the **lobby**. Walk to an elevator, press **E** on the call button, step in, press a floor-level button.
- Floors/tiers: **1 Mezzanine (Easy) · 2 Restaurant & Ballroom (Medium) · 3 Guest Rooms (Hard) · 4 Penthouse (Impossible) · 13 Management (Why are u even trying)**.
- Levels unlock **in order** (clear level N to open N+1). A floor's elevator is "out of order" until the floor before it is cleared.
- Finishing a level drops you back in that floor's elevator in the lobby.
- The elevators lie sometimes (from floor 2 up, 1 ride in 4 that would take you to a level just returns you to the lobby).
- The lobby is full of host banter: the reception bell, the guest book, the locked front doors, a piano he hates.

## The roster (proposal — tell me what to change)

Types: 🏃 parkour/traps · ❓ quiz · 🔑 escape room · 🌀 maze/chase · 👔 boss · 🃏 trick

**Floor 1 — Mezzanine (Easy).** Complimentary lies.
1. 🏃 **Wet Floor** ✅ — the whole lobby floor is lethal; hop across furniture (one trolley rolls away, the marble is slippery), climb the cocktail tables.
2. ❓ **Check-In** ✅ — four questions, three answer pads each; stand on one for a second to sign it. The host is honest exactly once. Questions are about things any player can know (controls, the hotel, Wet Floor; Campaign 1 only if you cleared it). **H** removes one wrong answer.
3. 🔑 **Lost Luggage** ✅ — locked in the baggage office. The host gives you a code (it's wrong); the real one is the suitcase counts on the poster. One black suitcase is a mimic. Behind the door: the baggage handling hall (conveyor belts, a press). **H** gives three levels of clues.
4. 🌀 **Revolving Door** ✅ — a new random hedge maze on the roof every attempt; revolving doors block passages on a schedule (green lamp = go), luggage-cart trains patrol the corridors (hop them), the host's directions are confident and wrong. **H** draws the way out from wherever you stand.
5. 🏃 **Bellhop Blues** ✅ — a gigantic angry service bell chases you down the back-of-house corridor: belts, wet marble, stairs, a runaway luggage gondola. Baby mode slows it down.

**Floor 2 — Restaurant & Ballroom (Medium).** The soup is a trap.
6. 🏃 **Soufflé** — kitchen parkour: ovens, steam vents, swinging pans, a fake "EXIT" fire door.
7. ❓ **Trivia Night** — ballroom quiz show; 6 rounds; the host cheats and the answer pads move.
8. 🔑 **Dinner Is Served** — dining-room escape: set the table in the right order, wine-cellar valves; wrong course = dessert trap.
9. 🌀 **Kitchen Maze** — walk-in freezers, one-way doors, a chef who chases.
10. 🏃 **Dance Floor** — disco tiles: only the lit ones are safe, on the beat.

**Floor 3 — Guest Rooms (Hard).** Do not disturb. Seriously.
11. 🔑 **Room 404** — the room can't be found; furniture rearranges when you look away.
12. 🌀 **Do Not Disturb** — stealth/chase around a housekeeping patrol; hide in laundry carts.
13. ❓ **Minibar** — you pay for answers; the prices lie; there's a surprise fee screen.
14. 🌀 **Hallway Loop** — an endless corridor; spot the one thing that's different each lap.
15. 🏃 **Window Ledge** — outside the building, in the wind, on a window-cleaner's platform.

**Floor 4 — Penthouse (Impossible).** The view is not worth it.
16. 🏃 **Chandelier** — precision hops on swinging chandeliers.
17. 🔑 **The Vault** — laser grid + timing locks.
18. ❓ **Pop Quiz** — timed and brutal; the right answer changes after you pick it.
19. 🏃 **Skybridge** — a rooftop gauntlet in a storm, with lightning and moving spans.
20. 👔 **Checkout** — "pay the bill": a multi-stage boss that mixes everything.

**Floor 13 — Management (Why are u even trying).** There is no floor 13. *(Each of these looks unwinnable and has an unexpected way out.)*
21. 🃏 **Floor 13** — the button doesn't exist. (Press 1 and 3… together?)
22. 🃏 **Terms & Conditions** — a wall of legal text; the exit is hidden in clause 47.
23. 🃏 **Complaint Desk** — a queue that never moves; there's a trick to cut the line.
24. 🃏 **Fire Drill** — every exit loops back; the real one is the window you ignored.
25. 🃏 **Management** — the manager's office; the "goal" is behind his desk and he really doesn't want you there.

## The rage-bait toolbox
Lying elevators · locked front doors · fake exits · decoy buttons · quiz answers that change · rooms that rearrange · looping corridors · queues that never move · T&C scroll walls · "renovating" floors · a host who comments on everything. Campaign 1's UI tricks (fake loading screens, swapped controls, lag spikes, fake crashes, ads) can be reused.

## Building a hotel level
1. Create `src/levels/hotel/<name>.js` exporting `{ id, name, music, build(w, game) }` (see `wet-floor.js`).
2. Use `hotelEnv(w)` + `lobbyShell(w)` for the lobby look, or the pieces in `kit.js` / `props.js`.
3. Replace the matching placeholder in `roster.js` (`buildHotelLevels()`), keeping its tier/index.
4. Tag your main-path platforms `path: true` and run `CAMPAIGN=hotel node tools/check-reach.mjs <n>` and `CAMPAIGN=hotel node tools/bot.mjs <n>`.

## Building blocks (what's in the engine now)
- `world.plat({ slippery })` — low-friction marble. `world.rollaway(plat, …)` — rolls away after you step on it. `world.conveyor(plat, { vx, vz })` — belts that carry you. `plat.attach(mesh)` — scenery that travels with a platform.
- `engine/keypad.js` — modal keypad (`game.modal` takes the keyboard). `engine/hint.js` — the dotted hint trail; a level can set `w.hintFn` (custom points), `w.hintFlat` or `w.hintAction` (return `'trail'` to fall back to the dotted line).
- `levels/hotel/quiz.js` — question bank (gated by what the player has seen), LED board, answer pads, gate. `levels/hotel/kit.js: roomShell` — a generic grand hall for level rooms.
- Test hooks: a level can expose `w.botPlan(game)` so `tools/bot.mjs` can solve quiz/escape/maze levels (set `NEAR=1` for the hop-to-the-near-edge style used on the hotel levels).

## Building a hotel level
1. Create `src/levels/hotel/<name>.js` exporting `{ id, name, music, build(w, game) }` (see `wet-floor.js`).
2. Use `hotelEnv(w)` + `lobbyShell(w)` for the lobby look, or `roomShell` and the other pieces in `kit.js` / `props.js`.
3. Add it to `BUILT` in `roster.js` (`buildHotelLevels()`), keeping its tier/index.
4. Tag your main-path platforms `path: true` and run `CAMPAIGN=hotel node tools/check-reach.mjs <n>` and `NEAR=1 CAMPAIGN=hotel node tools/bot.mjs <n>`.

## Build plan
- **Phase 1:** world + hub + elevators + interaction system + Level 1. ✅
- **Phase 2:** hints, building blocks, and the rest of Floor 1 (levels 2–5). ✅ *(you are here — play-test Floor 1 and tell me what to change)*
- **Phase 3–5:** Floors 2, 3 and 4, then Floor 13. You play-test each floor before the next.

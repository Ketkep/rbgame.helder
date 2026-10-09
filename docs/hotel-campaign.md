# Campaign 2 — Hotel Trust-Me

*Check in. Checking out is a process.* 25 levels, five floors, one very smug manager (the host, in a new uniform).

## Status

| Piece | State |
|-------|-------|
| Hotel world (art-deco lobby, lighting, reflections, night skyline) | ✅ built |
| Walkable hub with 5 elevators as the level select | ✅ built |
| Interaction system (look at things, press **E** / click) | ✅ built |
| Hint button (**H**) — dotted trail / quiz 50/50 / puzzle clues | ✅ built |
| **Floor 1 — Mezzanine (Easy, levels 1–5)** | ✅ playable |
| **Floor 2 — Restaurant & Ballroom (Medium, levels 6–10)** | ✅ playable |
| **Floor 3 — Guest Rooms (Hard, levels 11–15)** | ✅ playable |
| Floor 4 — Penthouse (Impossible, levels 16–20) | ⏳ "under renovation" |
| Floor 13 — Management (Why are u even trying, levels 21–25) | ⏳ "under renovation" |

## How it works

- The campaign opens in the **lobby**. Walk to an elevator, press **E** on the call button, step in, press a floor-level button.
- Floors/tiers: **1 Mezzanine (Easy) · 2 Restaurant & Ballroom (Medium) · 3 Guest Rooms (Hard) · 4 Penthouse (Impossible) · 13 Management (Why are u even trying)**.
- Levels unlock **in order** (clear level N to open N+1). A floor's elevator is "out of order" until the floor before it is cleared.
- Finishing a level drops you back in that floor's elevator in the lobby.
- The elevators lie sometimes (from floor 2 up, 1 ride in 4 that would take you to a level just returns you to the lobby).
- The lobby is full of host banter: the reception bell, the guest book, the locked front doors, a piano he hates.

### The lobby's look (`kit.js: lobbyShell`, `city.js`, `decor.js`)
- **Walls:** satin green damask with raised gold motifs (`damask` texture, shared by every hotel room), a verde-marble plinth, panels exactly one texture tile high, and a ceiling mural (a gold sunburst ringed with the hotel motto). The panelling stops at the elevator doorways and the entrance, otherwise it paints over the doors.
- **The view (`city.js: lobbyCity`):** a night city of lit-window towers (one merged mesh), low next to the hotel and tall in the distance, so there is sky to see. West: the rival **HOTEL HONEST** (VACANCY flickers to NO VACANCY, "elevators that go where you press"). East: four billboards for the hotel that cycle through its "reviews". South: **FREE CHECK-OUT\***. Also a blimp towing a banner, the moon, clouds, aircraft beacons, windows that blink. Each board is placed to sit in a window's frame when you stand in the aisle — the wall between the windows hides the rest. `w.city` exposes it for tests.
- **Realism pass:** the window glass carries a faint reflection of the room (black, additive and glossy, so it adds the reflected env map and never dims the view); the city fades into a luminous haze with an orange glow along the horizon; towers have stepped tops and rooftop tanks, air-conditioning boxes, antenna masts with blinking beacons and the odd neon sign, in two window styles (warm apartments, cool offices with whole floors lit); an elevated monorail crosses the south view every half minute or so, a helicopter circles through the gap between the hotel and the next block with its searchlight sweeping the facades, and a few windows flicker like televisions.
- **Moonlight:** each side window throws its panes onto the floor (additive patches), no volumetric cones.
- **Gags (look-only):** a departures board whose statuses keep changing, a clock with backwards numerals, four portraits whose eyes follow you and whose faces change while you are not looking (`inView`), an inspection certificate beside each elevator, a wet-floor sign standing where it is not wet.
- The player spawns at z = 9.5, clear of the revolving door's glass wings (they sweep z ≥ 12.3 and pass through the camera if you start inside them).

## The roster (floors 1–3 rebuilt: multi-stage, much longer, much trollier)

Every level on floors 1–3 now has **4–6 stages with a checkpoint each**, a stage banner, an honest next-stage-only hint, Baby Mode behaviour, and a set of learnable tricks (fake exits, checkpoint betrayals, floors that lie, control twists, fake UI moments, a fake LEVEL COMPLETE). The brief is in `docs/hotel-redo.md`; the shared tricks are in `src/levels/hotel/trolls.js`. Perfect-play bot times (sim s, includes freezes) are in brackets.

Types: 🏃 parkour/traps · ❓ quiz · 🔑 escape room · 🌀 maze/chase · 👔 boss · 🃏 trick

**Floor 1 — Mezzanine (Easy).** Complimentary lies.
1. 🏃 **Wet Floor** — six stages across the lobby: furniture hop, a rolling trolley, a mop-bot lane, a service gantry (swap twist, a bridge that gives way), a climb and the mezzanine (broom-closet EXIT, a goal that runs away, a fake LEVEL COMPLETE + bonus climb). [~70]
2. ❓ **Check-In** — ten questions in six stages (lying host, sliding pads, a clock, "none of the above", "pick the wrong one", the host changes his mind), luggage-trolley interludes, a survey, a fake CHECKED IN. [~110]
3. 🔑 **Lost Luggage** — five rooms: the poster's suitcase count, belts (one reverses), a weigh-in, Lost Property with an X-ray, and the pile up to customs. [~80]
4. 🌀 **Revolving Door** — two sealed hedge mazes (A: doors and carts; B: dusk, a loop door, a decoy exit) with a fountain courtyard and an ad gate between. [~95]
5. 🏃 **Bellhop Blues** — a five-stage chase through back-of-house: a backwards express belt, laundry, kitchen pass, stairs and a freight elevator that goes the wrong way. [~80]

**Floor 2 — Restaurant & Ballroom (Medium).** The soup is a trap.
6. 🏃 **Soufflé** — six kitchen stages; the soufflé waits under each pass counter. [~110]
7. ❓ **Trivia Night** — ten rounds in six stages with chandelier-hop interludes, a fake CHAMPION, a lying audience poll. [~125]
8. 🔑 **Dinner Is Served** — five rooms: six riddle courses, a cloche shell game, the pantry tip jar, the wine cellar, the dessert parlour. [~100]
9. 🌀 **Kitchen Maze** — freezer maze with the chef, a hot-oil pass, then a dark pantry maze with two chefs. [~105]
10. 🏃 **Dance Floor** — five sets and an encore, a real FREEZE and a bluff one, spotlight calls, a mirror-ball bridge. [~105]

**Floor 3 — Guest Rooms (Hard).** Do not disturb. Seriously.
11. 🔑 **Room 404** — bedroom, mirror bathroom, hallway chase, a 32-step stairwell with a fake complete and a bonus climb. [~130]
12. 🌀 **Do Not Disturb** — two sealed wings of stealth (housekeepers walk learnable rounds, DND signs, laundry carts), a vat between them, a service lift. [~150]
13. ❓ **Minibar** — twelve rounds in six stages, prices that lie, a checkout-queue parkour, two bills. [~180]
14. 🌀 **Hallway Loop** — eight rounds in four acts plus an encore, 33 kinds of anomaly, parkour floors, a fake way out. [~145]
15. 🏃 **Window Ledge** — five window stages on a long facade, telegraphed lightning, gale gates, a painted-on EXIT window, a fake "ROOM 1502". [~160]

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

More building blocks added for floors 2 and 3: `quiz.js: quizHall` (the quiz-level runner: islands, boards, pads, gates, 50/50 hint, countdown, locked answers), `mazekit.js` (random mazes, wall runs, `Walker` NPCs that patrol or chase), `engine/view.js: inView` (is it on screen right now), `engine/bill.js` (itemised bill + tip modal), `world.onDispose` (level teardown now also frees every texture, light shadow map and env-bake mesh a world made), `hz.predict(t)` (so the test bot can read a hazard's timing), and `tools/test-floors.mjs` for the level-specific tests.

## Building a hotel level
1. Create `src/levels/hotel/<name>.js` exporting `{ id, name, music, build(w, game) }` (see `wet-floor.js`).
2. Use `hotelEnv(w)` + `lobbyShell(w)` for the lobby look, or the pieces in `kit.js` / `props.js`.
3. Replace the matching placeholder in `roster.js` (`buildHotelLevels()`), keeping its tier/index.
4. Tag your main-path platforms `path: true` and run `CAMPAIGN=hotel node tools/check-reach.mjs <n>` and `CAMPAIGN=hotel node tools/bot.mjs <n>`.

## Testing quickly (any level, any time)
Levels normally unlock in order. For play-testing, add `?debug` to the URL: everything unlocks and you can jump straight into a level, e.g. `https://trustme.helderlabs.com/?debug&campaign=hotel&level=11` (level numbers are 1–15; no `level` = the lobby). In debug mode the game does not grab your mouse automatically — **click the canvas once** to capture it. Note: debug runs are saved like normal ones (finishing a level this way marks it cleared in your save), so use a normal run when you want to test the unlock order.

Smoke/monkey tests for all hotel levels: `node tools/smoke-hotel.mjs` and `node tools/monkey-hotel.mjs` (need `npm run preview` running).

## Building blocks (what's in the engine now)
- `world.plat({ slippery })` — low-friction marble. `world.rollaway(plat, …)` — rolls away after you step on it. `world.conveyor(plat, { vx, vz })` — belts that carry you. `plat.attach(mesh)` — scenery that travels with a platform.
- `engine/keypad.js` — modal keypad (`game.modal` takes the keyboard). `engine/hint.js` — the dotted hint trail; a level can set `w.hintFn` (custom points), `w.hintFlat` or `w.hintAction` (return `'trail'` to fall back to the dotted line).
- `levels/hotel/quiz.js` — question bank (gated by what the player has seen), LED board, answer pads, gate. `levels/hotel/kit.js: roomShell` — a generic grand hall for level rooms.
- Test hooks: a level can expose `w.botPlan(game)` so `tools/bot.mjs` can solve quiz/escape/maze levels (set `NEAR=1` for the hop-to-the-near-edge style used on the hotel levels).

More building blocks added for floors 2 and 3: `quiz.js: quizHall` (the quiz-level runner: islands, boards, pads, gates, 50/50 hint, countdown, locked answers), `mazekit.js` (random mazes, wall runs, `Walker` NPCs that patrol or chase), `engine/view.js: inView` (is it on screen right now), `engine/bill.js` (itemised bill + tip modal), `world.onDispose`, `hz.predict(t)` (so the test bot can read a hazard's timing), and `tools/test-floors.mjs` for the level-specific tests.

## Building a hotel level
1. Create `src/levels/hotel/<name>.js` exporting `{ id, name, music, build(w, game) }` (see `wet-floor.js`).
2. Use `hotelEnv(w)` + `lobbyShell(w)` for the lobby look, or `roomShell` and the other pieces in `kit.js` / `props.js`.
3. Add it to `BUILT` in `roster.js` (`buildHotelLevels()`), keeping its tier/index.
4. Tag your main-path platforms `path: true` and run `CAMPAIGN=hotel node tools/check-reach.mjs <n>` and `NEAR=1 CAMPAIGN=hotel node tools/bot.mjs <n>`.

## Build plan
- **Phase 1:** world + hub + elevators + interaction system + Level 1. ✅
- **Phase 2:** hints, building blocks, and the rest of Floor 1 (levels 2–5). ✅
- **Phase 3:** Floors 2 and 3 (levels 6–15). ✅ *(you are here — play-test them and tell me what to change)*
- **Phase 4–5:** Floor 4 (Impossible), then Floor 13 (the trick levels).

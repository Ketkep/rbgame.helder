# Campaign 2 — Hotel Trust-Me

*Check in. Checking out is a process.* 25 levels, five floors, one very smug manager (the host, in a new uniform).

## Status

| Piece | State |
|-------|-------|
| Hotel world (art-deco lobby, lighting, reflections, night skyline) | ✅ built |
| Walkable hub with 5 elevators as the level select | ✅ built |
| Interaction system (look at things, press **E** / click) | ✅ built |
| Level 1 — Wet Floor | ✅ playable |
| Levels 2–25 | ⏳ "under renovation" (named, listed, locked in the elevators) |
| Quiz rooms, escape-room puzzle pieces, mazes, chasers | ⏳ next (needed before levels 2+) |

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
1. 🏃 **Wet Floor** ✅ — the whole lobby floor is lethal; hop across furniture, climb the cocktail tables.
2. ❓ **Check-In** — fill in the guest form (easy trivia). Wrong answers drop a trapdoor under the desk. One question's "correct" answer is a lie.
3. 🔑 **Lost Luggage** — find your suitcase in the baggage room; 3-digit combination from clues; the lost-and-found bell lies.
4. 🌀 **Revolving Door** — a maze of revolving doors; each spin changes where you come out.
5. 🏃 **Bellhop Blues** — a runaway luggage cart chases you down a ramped corridor.

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

## Build plan
- **Phase 1 (this PR):** world + hub + elevators + interaction system + Level 1.
- **Phase 2:** the building blocks quiz/escape/maze levels need (quiz screens, keypads/levers/doors, maze walls, chasers) + the rest of Floor 1 (levels 2–5).
- **Phase 3–5:** Floors 2, 3 and 4, then Floor 13. You play-test each floor before the next.

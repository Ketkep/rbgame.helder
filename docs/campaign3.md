# Campaign 3 — Couples Retreat (online two-player)

Decisions made with the user (see also `campaign3-basics.md`, `two-player.md`):

* Exactly **2 players, online** (WebRTC peer-to-peer via PeerJS, room code). Voice chat = Discord, not built in.
* Desktop only (touch is hidden for this campaign).
* Design pillars, mixed: **asymmetric roles**, **mutual dependence**, **trust / betrayal**.
* Death rule **varies per level** (`self` / `both` / `revive`), and can change mid-level.
* Strictly co-op by default; light shoves and blocking; **real sabotage only in "betrayal" levels** (Secret Santa, The Newlywed Game), with a way to still win cooperatively.
* Theme: **Serenity Falls Couples Retreat** — a lakeside wellness resort. The Host is now "the counsellor" who sides with neither of you. Same voice, same persona: smug, lying, supportive in the worst way.
* **10 sessions, ~10 minutes each** for a first-time pair (an experienced pair can do it in half that).
* Standing rules: no jump scares / loud sounds; no random deaths without a tell; unfair-looking things must be learnable.

## How it works (engineering)

```
src/net/transport.js   PeerTransport (WebRTC) and LoopbackTransport (BroadcastChannel, for tests: ?loop)
src/net/coop.js        Coop: position stream, partner avatar + solid body, shared state, events, presence, death rules,
                       revive, checkpoints, tether/rope, zones, world-clock sync, level handshake (load -> loaded -> go)
src/net/coop-ui.js     the room screen (host / join / pick a session) + partner chip
src/levels/coop/       roster.js (the ten sessions), kit.js (building blocks), one file per session
tools/test-coop.mjs    netcode + rules test (two tabs, loopback)
tools/coop-bot.mjs     two scripted bots play a session end to end (needs `vite preview`)
```

Each browser simulates **its own player locally** and runs the whole level locally. The partner is a **solid body** in your world
(you can stand on their head, they block you) driven by their 20 Hz position stream. World-clock-driven things (movers, lasers,
blinking tiles) stay in step because the host's clock is the reference (`clk` message every 2.5 s, joiner slews gently).
Anything *player-triggered* must go through the shared layer, otherwise the two worlds drift:

| Need | Use (`const c = w.coop`) |
|---|---|
| who am I | `c.me` (`'p1'` host / `'p2'` guest), `c.other`, `c.names.p1/p2`, `c.isHost` |
| partner's position | `c.partner` → `{has, sx, sy, sz (smoothed feet), vx, vy, vz, yaw, pitch, g (grounded), dead}` |
| shared flag/value | `c.set(k, v)`, `c.get(k, def)`, `c.on(k, (v, fromPartner) => …)` (last writer wins, host breaks ties; handlers also fire locally on set) |
| one-shot event on both | `c.emit(name, arg)` + `c.onEvent(name, fn)` — **dedupe in the handler**, both machines may emit |
| who stands where | `c.zone({x,y,z,w,h,d, need:'any'|'both'|'p1'|'p2'}).onChange((zn)=>…)` → `zn.active, zn.p1, zn.p2, zn.mine, zn.theirs` |
| "I'm at X" flags | `c.presence(key, bool)`, `c.onPresence(key, (bothTrue)=>…)` |
| shared randomness | `c.rng(salt)` → deterministic stream (same on both), `c.rand()` |
| per-player narrator | `c.tell('p1'\|'p2'\|'all', 'script.key', opts)`; `c.sayPartner(key)` |
| rope | `c.tether({max, k, rope:true, on:true})` / `c.tether({on:false})` |
| finish | the normal `w.goal(...)` in a coop world needs **both** inside the ring; or `c.finish()` |
| death | `level.deathRule = 'self'|'both'|'revive'`; change mid-level with `setDeathRule(w, rule)` from a `stage()`; `w.hooks.onPartnerDeath` |
| shove | `c.setShove(0..1)` (default 1 = light shove, 0 = off) |

**Respawn resets** (`w.respawn(...)`, crumble resets, …) only run when the rule is `both` or `w.coopRules.resetOnRespawn = true`.
Checkpoints are shared: either of you touching a real one saves it for both.

Asymmetric vision: `seenBy(w, 'p1', platOpts)` draws a platform only for one role while it stays solid for both.
Anything visual that differs per role is fine (it is local); anything that changes *physics* must be identical on both machines.

## Kit (`src/levels/coop/kit.js`)

`retreatEnv`, `deck`, `stone`, `seenBy`, `sign`, `beacon`, `plate` (pressure plate by colour/role, `hold`), `gate` (slides up, `.set(bool)`,
`.passable`), `riser` (platform that rises/lowers, `.set(bool)`, `always` for lifts), `lever` (shared), `roleSign`, `lantern`, `lake`,
`stage(w, name, box, fn)` (one-shot beat for the pair), `setDeathRule`, `botSteps(w, {p1:[…], p2:[…]})` (scripted bots).

## Testing

```
npm run build && npx vite preview --port 4173 &
node tools/test-coop.mjs                  # netcode + rules (loopback)
node tools/coop-bot.mjs <level 1-10> [maxSimSec=900] [speed=3]
JUMP='{"at":[x,y,z],"p1":stepIdx,"p2":stepIdx}' node tools/coop-bot.mjs 1   # start mid-level
PROBE='<js expression evaluated in both pages at the end>' node tools/coop-bot.mjs 1
BASE=http://localhost:41xx/ …                                          # another preview port (parallel agents)
```
Bots follow `path:true` platforms unless the level installs `botSteps`. They wait on ferries/lifts, stop at tether limit,
and respawn on death like players. **Always `npm run build` after editing source** — the preview serves `dist`.

## The ten sessions

| # | Name | Kind | Death rule | Idea |
|---|------|------|-----------|------|
| 1 | Icebreakers | tutorial | self → both (rope) | Plates by colour, leapfrog bridges, stand-on-head wall + lift, rope, lever + 5-second gate. **Built.** |
| 2 | Trust Falls | trust | revive | One of you can't see the platforms (the other can). Blindfold sections, swap roles, a real trust fall onto a net the partner positions. **Built.** |
| 3 | Communication Exercise | split info | self | Escape-room wing: one sees the symbols/map, the other holds the keypad/levers. Maze with a map-reader and a walker. |
| 4 | Tethered Trek | rope | both | Mountain climb on a rope: swings, belay plates, wind, a falling-rock cave. |
| 5 | Spa Day | control | self | One runs the control room (console shows hazard states) while the other crosses; swap wings. |
| 6 | The Newlywed Game | quiz / betrayal | self | Game show: answer questions about each other; the Host lies to each of you; "split or steal" rounds with a cooperative way out. |
| 7 | Dinner Date | team | self | Carry plates between stations, kitchen conveyors, timed courses, a chef who dislikes both of you. |
| 8 | Secret Santa | betrayal | self | Gifts: one is a trap. Secret buttons that let one of you sabotage the other for a shortcut — but it can be beaten cleanly. |
| 9 | Shared Baggage | climb | both | A very tall pile of luggage: counterweights, boosts, pendulums, plates that raise the other. |
| 10 | The Vows | finale | mix | A wedding chapel gauntlet recycling every mechanic, then the Counsellor as a boss. |

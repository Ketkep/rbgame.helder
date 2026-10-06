# Two-player campaign — feasibility notes

**Short answer: yes, it's possible**, and this game's architecture suits it: everything runs in the browser, movement is a small deterministic AABB simulation, and the levels are code. What it needs is a way for two browsers to talk and a handful of engine changes. Nothing here has been built yet — these are notes to decide from.

## Connecting two browsers (the site is static on GitHub Pages)

| Option | How it works | Pros | Cons |
|---|---|---|---|
| **WebRTC peer-to-peer** (Trystero, PeerJS, or plain WebRTC with a tiny signalling helper) | Host creates a room → gets a 4–6 letter code → friend types it in → browsers connect directly | Free, no server of our own, lowest latency | A minority of networks block direct connections (need a TURN relay: free tiers exist, e.g. Cloudflare/Metered); a bit fiddly |
| **WebSocket relay** (Cloudflare Workers + Durable Objects, PartyKit, Supabase Realtime, Firebase) | Everything goes through a small cloud room | Works on any network; simple mental model; easy to add spectators/leaderboards later | A service to maintain; ~30–100 ms extra latency; free tiers have limits |

Recommendation: start with WebRTC + room codes; add a relay fallback only if friends report connection failures.

## How the game would sync

- **Each player simulates their own character locally** (no input lag for yourself), and sends position / yaw / pitch / "is jumping" ~20 times a second. The partner appears as an interpolated avatar (capsule + name tag is enough at first).
- **Shared world state has one owner (the room creator):** doors, pads, buttons, enemies (the bell, chef, housekeepers, wardrobe), timers. Their positions/events are broadcast; the other client just renders them.
- **Time-driven things already work**: movers, blinking tiles, vents and burners are functions of world time `t`, so sharing a start time keeps them in sync with no per-frame traffic.
- **Random levels need a shared seed** (mazes, codes, question picks): the owner picks it and sends it before the level builds, so both players get the identical level.
- **The host's narration stays local** — which is a feature: he can tell each player something different.

## What changes in the code

1. A networking module (room codes, message types, reconnect/leave handling).
2. `Game` supports a second player: avatar mesh, collision/hazard checks for the *other* body where it matters, shared pause rules.
3. Death rules for co-op (options: only you respawn · both respawn at the last shared checkpoint · a "revive" window).
4. Level-side hooks: a level declares which pieces are co-op (pressure plates, two-key doors, split information) and which entities are server-owned.
5. Seeded randomness (`Math.random` → a seeded RNG) in the level builders that use it.

## Game-design ideas that fit "Trust Me…"

- **Split information:** one player sees the keypad code, the other holds the keypad (voice chat/Discord decides if they trust each other).
- **The host lies to each player differently** ("your partner is lying, don't believe them") — trust between *players*, not just in the host.
- **Hold-the-door puzzles:** a plate/lever only works while the partner stands on it; timing and coordination as the rage source.
- **Asymmetric levels:** one player walks a maze, the other sees a map with the patrols; one player is on a ledge, the other operates the gondola.
- **Tethers and boosts:** a rope that limits the distance between you; the partner can give a jump boost from below.
- **Shared fail state:** one person falling restarts both (classic couples-counselling mechanic).

## Rough effort

- Prototype (room codes, avatars, shared checkpoints, one co-op level): a few focused days.
- A full 25-level co-op campaign: as big as Hotel Trust-Me itself, because each level has to be *designed* for two.
- Voice chat is possible in the browser (WebRTC audio) but most people would just use Discord; I'd skip it at first.

## Questions to decide before building

1. Online only, or also same-screen/split-screen?
2. Exactly two players, or up to four?
3. A separate co-op campaign, or an optional co-op mode for existing levels?
4. Should players be able to hurt/help each other (pushing, griefing), or is it strictly cooperative?
5. Do you want the narrator to be able to address players separately ("Player 1…", "Player 2…")?

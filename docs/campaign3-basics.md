# Campaign 3 — "It Takes Two" co-op (basics, decided with the user)

| Topic | Decision |
|---|---|
| Players | Exactly 2, **online, two devices** |
| Connection | **WebRTC peer-to-peer + room codes** (4–6 letters); add a relay fallback only if friends can't connect |
| Core idea | **Mix**: asymmetric roles + mutual dependence (plates, boosts, carrying) + trust/betrayal |
| Death rule | **Varies per level** (only you / both respawn / revive) — each level declares its own |
| Theme (starting idea) | **Couples Therapy Retreat**: staff force "trust exercises" (trust falls, tethers, split information); the host sides with neither of you |
| Player-vs-player | Strictly co-op baseline + light shoves/blocking (slapstick) + **real sabotage in some "betrayal" levels**; a friendly-mode toggle is worth adding |
| First build | **Prototype**: netcode + avatars + shared checkpoints + ONE polished co-op level, then judge |

Carried over standing rules: no jump scares/loud sounds, no random deaths without a tell, agents use Sonnet.

## Open questions (next round)
1. Voice: rely on Discord, or build in WebRTC voice chat?
2. Does the narrator address players separately ("Player 1…/Player 2…") and lie to each differently? (Assumed yes.)
3. Campaign length/structure (floors? 25 levels again?) — decide after the prototype.
4. Mobile/touch support for co-op, or desktop only at first?
5. Testing: bots can't play online — plan is a local two-tab loopback test + a scripted second "partner bot".

See `two-player.md` for the full feasibility notes.

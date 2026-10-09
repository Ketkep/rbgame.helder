# Floor 4 — Penthouse (Impossible): status

Branch `floor4-start` — **not merged, not live.** Levels 16–20 are all playable first passes: the bot completes each, `smoke-hotel` is clean for 16–20, and the lobby's floor-4 elevator opens when floor 3 is cleared.

| # | Level | Stages | What is in it | Bot (sim s) |
|---|-------|--------|---------------|-------------|
| 16 | Chandelier | 6 | still / swaying chandeliers, a rotating carousel, an expiring checkpoint, a fake checkpoint, crumbling crystals, a brass bar that leaves, "follow the left" pairs (one side of each pair lets go, red glint = tell), lights-out finish, runaway goal, fake LEVEL COMPLETE | ~40, 0 deaths |
| 17 | The Vault | 4 | laser hall (blinking walls telegraph before firing, low sweepers), count-the-lamps code door (host's 404 is a lie), three timing plates, fake alarm exit, runaway gold bar, fake VAULT CRACKED | ~120, 21 deaths (bot is poor at lasers) |
| 18 | Pop Quiz | 5 | 14 timed rounds, every twist (lying host, 8/6/5 s clocks, pick-the-wrong-one, none of the above, pass, double, question switches, answer changes its mind, lying poll), a survey, a crash, a fake A+, sudden death | ~95, 0 deaths |
| 19 | Skybridge | 5 | rooftop AC units, a 36 m beam in a turning crosswind (pennant tells), cable cars, crumbling rods + fake/expiring checkpoints + mirror mouse + vanishing rod, telegraphed lightning, decoy helipad exit, runaway goal, fake ROOF CLEARED | ~87, 0 deaths |
| 20 | Checkout (boss) | 5 | queue with carts and a lying ticket, the bill (tip required) and a declined card, belts against you + laser walls + an ATM that loads, the long way (no floor), the second bill, fake CHECKED OUT, closet "manager" exit | ~56, 1 death |

## Known weak spots (honest)
- **Too easy / too short for "Impossible":** 16, 19 and 20 take the bot under 90 s with almost no deaths. They need narrower platforms, wider gaps, more stages and tighter timings. Human death targets (15+ first time) are not met by design yet.
- **17:** the bot dies a lot on the lasers; check the beams are fair for humans (telegraph timing, sweeper speeds).
- **20 (the boss)** is a remix of earlier tricks, not yet a true "everything" finale (a maze or chase stage would suit it).
- No dedicated test suites for 16–20 yet (only the bot + smoke); `test-floors.mjs` has none for floor 4.
- No screenshots reviewed beyond the bot runs; platform visuals (supports, chains) are minimal.

## Rules still apply (docs/hotel-redo.md)
Stage banners, a checkpoint per stage, honest next-stage-only hint, Baby Mode softening, every death has a tell, no jump scares or loud sounds, fakes of 5 s or less.
Lessons learned: room columns are solid; adjacent platforms must be level or >= 1 m apart; route platforms need `o.path = true` in order; never overwrite `w.sky`.

## Floor 13 (levels 21–25) — first pass
21 Floor 13 (lift keys 1+3, vanishing tiles over void), 22 Terms & Conditions (clause 47 hides the goal), 23 Complaint Desk (stamp B,C,A), 24 Fire Drill (loops + window to fire escape), 25 Management (chasing manager, DO NOT DISTURB signs).
All bot-completable (21 verified by probe; bot stalls there). Honest weak spots: 16, 19, 20, 22–24 are short/easy for their billing; 17 bot dies a lot on lasers; no dedicated test suites for 16–25; human death counts unmeasured. Not merged/live.

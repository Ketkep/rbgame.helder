# Floor 4 — Penthouse (Impossible): starting notes

Branch: `floor4-start` (not merged, not live). Levels 17–20 are still "under renovation" placeholders.

## Level 16 · Chandelier — first pass built (`src/levels/hotel/chandelier.js`)
Four stages: still chandeliers · swaying chandeliers · crumbling crystals (a fake checkpoint, a vanishing brass bar) · lights out (the room blinks dark, the goal runs away, fake LEVEL COMPLETE). Uses the troll kit. Bot: completes in ~45 s with 0 deaths — **far too easy/short for "Impossible"**.

Next for level 16: narrower platforms (1.4 m) and wider gaps (4 m, running-jump territory), two more stages (a "revolving" ring of chandeliers you ride, a stage with the host's lies about which chandelier is safe), moving platforms that desync, an expiring checkpoint, the lights-out stage should hide the platforms for real (the rim glows = tell), bot target 190–240 s, human 5+ min with ~15+ first-time deaths. Falls must have a tell; no jump scares.

## Rest of the floor (from docs/hotel-campaign.md)
- 17 The Vault (escape): laser grid + timing locks — reuse `escape-kit.js` and the keypad; lasers via `w.hazard` + `predict`.
- 18 Pop Quiz (quiz): timed and brutal, the right answer changes after you pick — reuse `quiz-show.js`.
- 19 Skybridge (parkour): rooftop gauntlet in a storm — reuse the Window Ledge weather (telegraphed lightning, gale gates).
- 20 Checkout (boss): "pay the bill" — a multi-stage level mixing everything from floors 1–3 (maze, quiz, escape, chase), ending on the bill modal (`engine/bill.js`).

Rules that still apply (docs/hotel-redo.md): stage banners, checkpoint per stage, honest next-stage-only hint, Baby Mode softening, every death has a tell, no jump scares or loud sounds, fakes of 5 s or less.
Lessons learned the hard way: lobby/room columns are solid; adjacent platforms must be level or ≥1 m apart (a 0.2 m step blocks players and bots); route platforms need `o.path = true` in order.

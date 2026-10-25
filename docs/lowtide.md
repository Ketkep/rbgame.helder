# LOWTIDE — a two-player horror campaign (design, agreed with the user)

Separate campaign card on the home page, online 2-player (same room codes, Discord for voice, desktop only). 8 chapters, each **at least 10 minutes for a first-time pair** (aim 12-15; the whole thing ~2 hours). Horror is deliberately NOT bound by the old "no jump scares / no loud sounds / no deaths without a tell" rule; that rule still holds for the hotel campaign and 2 Player Mode. A warning screen (intense scares, flashing lights, loud sounds) is shown before the campaign starts. Deaths in a chase are allowed to be sudden, but the stalker is always *learnable* (sound cues, patrol pattern).

## Premise
Lowtide Memorial, a coastal psychiatric hospital, is being flooded by the night tide. You are two patients in the same ward. The only voice is **the Night Desk**, a tired, kind hospital intercom that starts out helpful and then slips: it contradicts itself, calls one of you by a name you never gave, and sometimes whispers to only one of you. Tone: quiet dread, not jokes.

## The big hidden truth (revealed in ch. 7, 3 endings in ch. 8)
Each run the game secretly assigns a role from the room seed (c.rng): **the Keyholder** and **the Subject**. The Keyholder is the staff member who has been "treating" the other; both have been drugged to forget (that is why your partner "looks wrong" and your memories disagree). From ch. 3 the two of you receive different private files, different intercom whispers and a secret objective; the roles can appear to flip. Ch. 7 reveals who was who. Endings (decided by private choices in ch. 7-8):
* **Out together** (both choose to forgive / take the hard exit),
* **Out alone** (the Keyholder takes the only key — the cruel, "they betrayed you" ending for one of you),
* **The tide takes the ward** (both fail the final choice: the loop ending).

## Scares (all four were chosen)
* **A stalker you can't fight**: the Orderly. Host-authoritative patrol path synced over the net, a 3-metre listening radius, a cone of sight, you hide in lockers/under beds/behind curtains, hold breath by standing still, lure him with noise (a thrown tray, a door). Cues: squeaking wheels, a lowered lamp, breath fog. Dying = he drags you back to the last checkpoint (a bed).
* **Your partner is wrong**: the partner avatar glitches, appears in rooms they are not in, speaks with the voice of the intercom, and in ch. 6 a **doppelganger** copy walks beside you and you must tell which is real using something only your real partner can do (a handshake via the hand-off kit, a code you agreed on).
* **Lights, dark and sound**: flashlight-only sections (a cone lit by whoever holds the torch), power cuts, doors that were open and now are not, footsteps behind you, whispers panned to one ear. Real jump scares (sudden figure, slam, loud sting) placed deliberately, never repeated more than twice a chapter.
* **Body and gore**: restraints, operating theatres, blood, drowned wards. Imagery only; nothing graphically harms the two players.

## Chapters (each >= 10 min, multi-stage)
1. **Intake**: wake in restraints; learn the torch, key cards, hiding; first safe-room patrol of the Orderly. Twist: your wristband has your *partner's* name.
2. **Night Rounds (Ward B)**: stalker patrol puzzle. One lures, one hacks the nurse's station; lockers, vents, a long corridor chase.
3. **Records Room**: you each read a different version of the same file (asymmetric info). First private note: "take the key". The first "partner is wrong" glitches.
4. **Hydrotherapy**: the flooded wing; rising water on a timer; air pockets; valves needing both of you; the stalker in the water.
5. **The Theatre**: one is strapped to the table, the other runs the machine (roles swap mid-chapter). Gore set pieces; a truth fragment (a photo of you both in uniforms).
6. **The Morgue / Garden**: torch only; the doppelganger; voices from behind; which one is real.
7. **The Director's Office**: roles revealed; the betrayal chapter. The Keyholder may lock the Subject in (a private choice with a visible, tense timer); the Subject can sabotage the lock. Persistent flags carry to ch. 8.
8. **Lowtide**: the tide comes in; a full-length escape with the stalker, every mechanic remixed, ending in the choice that selects the ending.

## Engineering plan
* New campaign `lowtide` on the home page ("2 PLAYERS · ONLINE · HORROR"), reusing the whole co-op stack (rooms, shared state, zones, death rules, bots).
* **Foundations (one agent/me first)**: `src/levels/lowtide/kit.js`: dark environment (no scenery backdrop, fog, torch cone via a SpotLight following the holder), the **stalker** (host-authoritative, syncs 10 Hz, patrol routes, hearing/sight, hiding spots), the **scare system** (`scare.flash/sting/jump(...)`, procedural WebAudio drones/heartbeat/whispers, rate-limited), **secret roles** (`roles.me`, private files), **glitch partner** effects, **endings tracker** (persistent save flags per run), the **warning screen**, the intercom voice (lower, slower, glitchy TTS, plus per-role whisper lines).
* Then 8 chapters built by Sonnet agents in two waves of four, each with bot support (`tools/coop-bot.mjs`), each >= 10 min human time, then merged, regression-tested, shipped.

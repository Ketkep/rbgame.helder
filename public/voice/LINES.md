# Narrator lines

Record or generate one audio file per row and save it as `public/voice/<ID>.mp3`.
Then list the IDs you have in `public/voice/manifest.json` (a JSON array of ID strings) and redeploy.
Lines without a file keep working with subtitles + the synthesised voice blips.

`{n}`, `{m}` in a line are filled in at runtime (death count / metres fallen); record those lines with a generic read, or reword them in `src/script.js`.

129 lines.

| ID | Line |
|----|------|
| `death.first#0` | And that's a death! Don't worry, that one was free. The rest are billed monthly. |
| `death.first#1` | First death! A milestone. I've already framed it. |
| `death.generic#0` | Oof. |
| `death.generic#1` | Bold strategy. It did not work. |
| `death.generic#2` | I almost felt something. It passed. |
| `death.generic#3` | Gravity: one. You: zero. |
| `death.generic#4` | The floor sends its regards. |
| `death.generic#5` | You were so close. By which I mean not close at all. |
| `death.generic#6` | Have you tried not falling? |
| `death.generic#7` | I'd say "nice try", but that wasn't. |
| `death.generic#8` | Disappointing. Not surprising, but disappointing. |
| `death.generic#9` | That's going on the highlight reel. The blooper reel. |
| `death.generic#10` | Again! Again! Again! |
| `death.generic#11` | Skill issue. Mine. I designed this. You're doing great. |
| `death.generic#12` | You know it's allowed to just not die, right? |
| `death.generic#13` | Wow. Just wow. Anyway. |
| `death.generic#14` | I'll give you a 6 out of 10 for commitment. |
| `death.generic#15` | That was a choice. |
| `death.generic#16` | And down we go. |
| `death.generic#17` | Technically that counted as a dive. |
| `death.hazard#0` | That laser was clearly labelled. By which I mean it was glowing. |
| `death.hazard#1` | Red means danger. I thought everybody knew that. |
| `death.hazard#2` | Did you really walk into the glowing death thing? |
| `death.hazard#3` | It's a hazard. It's in the name. |
| `death.sameSpot#0` | That's {n} times at this exact spot. The spot is winning. |
| `death.sameSpot#1` | Same place again. Do you two know each other? |
| `death.sameSpot#2` | You and that jump have a real history, huh. |
| `death.sameSpot#3` | Maybe try a different approach? Any approach? |
| `death.streak#0` | That was fast. Even for you. |
| `death.streak#1` | You didn't even get to enjoy the view. |
| `death.streak#2` | Speedrun to the respawn, new world record. |
| `death.milestone.10` | Ten deaths! A personal best. Mine. Watching you. |
| `death.milestone.25` | Twenty-five deaths. Statistically, that's a lot of deaths. |
| `death.milestone.50` | Fifty deaths. I've started naming them. |
| `death.milestone.100` | One hundred deaths. I'm not mad. I'm just genuinely amazed. |
| `death.milestone.200` | Two hundred. At this point it's a lifestyle. |
| `baby.offer` | You've died {n} times. Here's a deal: BABY MODE. Higher jumps, longer coyote time, checkpoints that actually work. A permanent badge of shame. Press B to accept — or keep suffering. |
| `baby.offer.again` | Still suffering, I see. Baby Mode is still on the table. Press B. No one is judging. I am. But no one else. |
| `baby.accepted` | Baby Mode activated. Don't worry — nobody has to know. ...Your share card will tell them, though. |
| `baby.declined` | Respect. Idiotic, but respect. |
| `baby.early` | Beg for mercy? You've barely died! Come back at {n} deaths and we'll talk. |
| `baby.already` | You're already in Baby Mode. There's no mode below this one. I checked. |
| `baby.on.fakecp` | Baby Mode: that checkpoint actually saved. Disgusting. |
| `pause#0` | Taking a break? The game isn't going anywhere. Neither is your death count. |
| `pause#1` | Pausing? Brave of you to take your eyes off me. |
| `pause#2` | Ah, a pause. A tactical retreat. |
| `resume#0` | Welcome back. Miss me? |
| `resume#1` | Back already? I was just getting comfortable. |
| `idle#0` | Are you still there? Blink twice. |
| `idle#1` | Take your time. I have nowhere to be. I'm a voice in a game. |
| `idle#2` | This is the part where you move. |
| `idle#3` | I'll just stand here, then. Metaphorically. |
| `manualReset#0` | Giving up already? Fine. Back we go. |
| `manualReset#1` | Resetting yourself? That's my job. |
| `l1.welcome` | Welcome to TRUST ME… the game show where you can trust me completely. |
| `l1.welcome2` | I'm your host. I'll be guiding you through today's course. I have never once lied to a contestant. |
| `l1.look` | First: look around. Move your mouse. Go on. See? Everything is perfectly safe. |
| `l1.move` | Now walk. W, A, S, D. The letters. On your keyboard. Take your time. |
| `l1.walk` | Wow. Natural. See the finish gate up ahead? Just walk right on in. |
| `l1.gate.1` | Hm. The finish gate seems to have... moved. |
| `l1.gate.2` | Construction. Totally normal. Keep walking! |
| `l1.gate.3` | ...They're still setting up the finish. Walk faster. |
| `l1.gap.intro` | Time to jump! Press SPACE. Tap for a hop, hold for the full jump. You're welcome. |
| `l1.gap.1` | Look at you. A natural. |
| `l1.gap.2` | Gap two. Bigger. Still easy. Everything is easy. |
| `l1.safe` | That platform says SAFE. I would never lie on a sign. |
| `l1.crumble` | ...Okay, that one's on the sign painter. Not me. |
| `l1.checkpoint` | A checkpoint! Die, and you come back right here. Checkpoints are sacred. You can trust them. Completely. |
| `l1.beam` | Narrow beam ahead. Don't look down. ...I said don't. |
| `l1.mover` | A moving platform! Wait for it. Patience is a virtue. Not one you've shown yet, but still. |
| `l1.exit.near` | And that's the tutorial! You've learned everything. Truly, a champion. |
| `l1.exit.reach` | See? Totally fair. Tutorials always are. On to the real game. Trust me. |
| `l1.fall.first` | Even the tutorial! That's a new one. For the tutorial, that is. |
| `l2.intro` | Welcome to Checkpoint Island! Five lovely checkpoints, every one of them trustworthy. Mostly. |
| `l2.tower` | See that tower way over there? That's the finish. It's closer than it looks. |
| `l2.cp.real#0` | Saved! Genuinely. |
| `l2.cp.real#1` | Checkpoint! That one's real. Would I lie? |
| `l2.cp.fake#0` | Saved! Isn't it nice to feel safe? |
| `l2.cp.fake#1` | Progress saved. Take a deep breath. You've earned it. |
| `l2.cp.fake.reveal` | Oh, that checkpoint? Fake. Did you not see the tilted pole? ...I told you to trust me. I never said I was trustworthy. |
| `l2.cp.fake.reveal2` | And that one was fake too. You walked right into it. Twice. I'm almost impressed. |
| `l2.mover` | Timing is everything. And yet. |
| `l2.crumble` | Don't stand still. It's not a rule. It's just good advice. |
| `l2.sweep` | Those red things are sweeping lasers. They're purely decorative. Go on, touch one. |
| `l2.last` | The very last jump. Five checkpoints, and I swear this one is real. ...You believe me, right? |
| `l2.complete` | You did it! I'm genuinely not sure how. Good for you. |
| `l3.intro` | The Tower. Climb to the top. If you fall, you land wherever gravity decides. Simple! |
| `l3.dontlook` | Whatever you do, don't look down. |
| `l3.dontlook2` | I said don't. |
| `l3.wind` | A little breeze. Nothing to worry about. Hold on to your hat. |
| `l3.bee` | Is that a bee on you? I'd focus on the jump. |
| `l3.spider` | Oh, that spider is huge. Anyway, jump. |
| `l3.checkpoint` | A checkpoint! A real one. Please stop looking at the pole. |
| `l3.nocp` | The next checkpoint is just ahead. Probably. I'd have to check my notes. |
| `l3.fall#0` | That was {m} metres of progress. Gone. Like it never happened. |
| `l3.fall#1` | {m} metres down. The view is better from up there. |
| `l3.fall#2` | You fell {m} metres. I measured. I measure everything. |
| `l3.fall.big` | New record for falling! The leaderboard has been notified. |
| `l3.near` | Almost there! Just a little more... wait, you're actually doing this. |
| `l3.last` | This is the last jump. It's the hardest one. Also the one I tested the least. Good luck! |
| `l3.complete` | Impossible. I mean — congratulations! |
| `l3.laser` | The lasers here are totally harmless. Totally. Don't quote me. |
| `l4.intro` | Welcome to Technical Difficulties. Our engineers assure me everything is working perfectly. |
| `l4.loading` | Please enjoy this loading screen. Keep walking — the game is still running. |
| `l4.loading.done` | And we're back. See? Nothing bad happened. |
| `l4.controls` | We've updated your controls! For the better. Specifically, the left and the right. |
| `l4.controls.back` | Controls restored. You're welcome. Or... sorry. One of those. |
| `l4.lag` | Looks like you've got a bad connection. In a single-player game. That takes talent. |
| `l4.lag.watch` | Watch the ping. When it goes red, I'd jump. Or don't. I'm not your boss. |
| `l4.crash` | We are experiencing technical difficulties. Please stand by. |
| `l4.crash.back` | And we're back. I saved you four seconds you'll never get back. |
| `l4.ad` | A word from our sponsor. |
| `l4.ad.skip` | Skip in five. You can't. That's not a button. |
| `l4.counter` | Your death counter looks off. I'm sure it's fine. |
| `l4.pause` | Resume? Just click it. Come on. Right there. |
| `l4.pause.fine` | Fine. Fine. You can have it. |
| `l4.complete` | Level four done. The engineers have been told. They're fine. Everyone is fine. |
| `l5.intro` | You did it! Congratulations, contestant! Roll the credits! |
| `l5.credits.end` | Thanks for playing! |
| `l5.credits.after` | ... |
| `l5.curtain` | Just kidding. Did you really think I'd let it end that easily? |
| `l5.gauntlet` | The finale! Everything you've learned, all at once. Nothing you've learned will help. |
| `l5.cp` | That checkpoint is real. I swear on my... whatever I have. |
| `l5.lag` | A little lag. For old times' sake. |
| `l5.final` | Two doors. The LEFT door is the real exit. Take the left door. Trust me. |
| `l5.win.right` | ...You went right. You didn't trust me. I'm so proud. And so, so furious. |
| `l5.win.wrong` | The left door? Of course. You trusted me. Nobody ever learns. |
| `l5.cheat` | I like how you're standing there, thinking. Enjoy it. It's the last peace you'll get. |
| `l5.complete` | Credits. Real ones, this time. ...Mostly. |

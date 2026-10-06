# Narrator lines

Record or generate one audio file per row and save it as `public/voice/<ID>.mp3`.
Then list the IDs you have in `public/voice/manifest.json` (a JSON array of ID strings) and redeploy.
Lines without a file keep working with subtitles + the synthesised voice blips.

`{n}`, `{m}`, `{letter}`, `{text}`, `{fake}`, `{a}`, `{b}`, `{code}` in a line are filled in at runtime (death count, metres fallen, the answer letter, a code digit…); record those lines with a generic read, or reword them in `src/script.js`.

255 lines.

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
| `hint.use#0` | Oh, you need help? Of course you do. Follow the dots. |
| `hint.use#1` | A hint! Free of charge. The dignity, however, will be billed later. |
| `hint.use#2` | Fine. Follow the trail. Try not to die ON the trail. |
| `hint.use#3` | Glowing dots. You're welcome. Please don't thank me. |
| `hint.many` | That's your fifth hint. I'm starting a tab. |
| `hint.cooldown` | Patience. Hints are a limited-time offer. Like my respect for you. |
| `hint.none` | I have no hint for this one. That's not a lie. It's worse: it's a feeling. |
| `hint.hub` | The lobby needs no hint. Walk toward the elevators. They're the big shiny doors. |
| `hotel.welcome` | Welcome to Hotel Trust-Me. I'm the manager. I was also the host. I wear many lies. |
| `hotel.welcome2` | Check in at the elevators. Check out... we'll discuss it later. |
| `hotel.return#0` | Welcome back to the lobby. Did you miss the marble? Everyone misses the marble. |
| `hotel.return#1` | Back so soon? The elevator remembers everything. |
| `hotel.bell#0` | *ding* How may I ignore you? |
| `hotel.bell#1` | Service! ...is not available at this time. |
| `hotel.bell#2` | Yes? No? Wrong bell. |
| `hotel.bell#3` | You rang. I heard. That's all I'm promising. |
| `hotel.bell.many` | If you ring that again, I am going to start charging you. |
| `hotel.doors#0` | Check out? Hilarious. The doors are decorative. |
| `hotel.doors#1` | Locked. For your safety. Mostly mine. |
| `hotel.doors#2` | Those doors are for guests. You are a contestant. Different thing. |
| `hotel.guestbook#0` | Signed. You're checked in. Permanently. |
| `hotel.guestbook#1` | Name noted. Debt noted. Welcome. |
| `hotel.piano1` | Lovely. Truly. Please stop. |
| `hotel.piano2` | I'm not paying for the piano tuner. Stop. It costs more than you do. |
| `hotel.out_of_order#0` | That elevator is out of order. For you, specifically. |
| `hotel.out_of_order#1` | Out of order. Clear a floor first. I make the rules. I also lie about them. |
| `hotel.locked_level#0` | That level isn't open yet. Finish the previous one first. Yes, I'm enjoying this. |
| `hotel.locked_level#1` | Locked. Good things come to those who die repeatedly. |
| `hotel.renovation#0` | That floor is under renovation. It's been under renovation since the 90s. |
| `hotel.renovation#1` | Closed for renovation. The builders are... also contestants. |
| `hotel.renovation#2` | Floor not ready. The carpet is still lying about being finished. |
| `hotel.elevator.go#0` | Going up! ...probably. |
| `hotel.elevator.go#1` | Please hold on to something. Anything. Your dignity, maybe. |
| `hotel.elevator.go#2` | Next stop: consequences. |
| `hotel.elevator.lie#0` | Floor reached! Oh wait, no, that's the lobby. Again. My mistake. Not mine. |
| `hotel.elevator.lie#1` | Ding! Lobby. Why are you surprised? The buttons are decorative. |
| `hotel.l1.intro` | Level one: Wet Floor. Housekeeping just mopped the lobby. All of it. With something that kills you. |
| `hotel.l1.intro2` | Do not touch the floor. Use the furniture. It's what it's for. Probably. |
| `hotel.l1.1` | Hop on the ottoman. It's very comfortable. That's not a trap. This time. |
| `hotel.l1.mid` | Halfway! Notice how I said "halfway" and not "safe". Words matter. |
| `hotel.l1.up` | Now the cocktail tables. They're pedestal tables. Pedestal is French for "you will fall". |
| `hotel.l1.near` | Almost to the mezzanine. Staff only. Technically you're staff now. Unpaid. |
| `hotel.l1.slip#0` | Wet floor! The sign was right there. Several signs. In yellow. |
| `hotel.l1.slip#1` | You slipped. Housekeeping will mop you up. |
| `hotel.l1.slip#2` | The floor won. The floor always wins. |
| `hotel.l1.slip#3` | Caution means caution. You were not cautious. |
| `hotel.l1.roll#0` | Oh, that trolley has wheels. I said it was sturdy. Rolling is a kind of sturdy. |
| `hotel.l1.roll#1` | Whoops. Housekeeping never locks the brakes. |
| `hotel.l1.roll#2` | Fun fact: these trolleys go 5 km/h. You have about four seconds. |
| `hotel.l1.glide#0` | Polished marble! Please don't stop. Stopping is where the falling happens. |
| `hotel.l1.glide#1` | Oh, did you want to stand still? On the wet marble? Adorable. |
| `hotel.l1.glide#2` | Slippery when wet. Slippery when dry. Slippery when you're the guest. |
| `hotel.l1.done` | Done! You reached the mezzanine. No one has ever been so wet and so proud. |
| `hotel.l2.intro` | Level two: Check-In. A short registration form. I ask a question. You answer it. By standing on it. Like a dignified sheep. |
| `hotel.l2.intro2` | Stand on an answer for one second to sign it. Wrong answers get... corrected. |
| `hotel.l2.s0` | Question one is on the house. And I will be completely honest with you: it is {letter}. |
| `hotel.l2.s1` | Question two. It is {letter}. Same honesty as before. Exactly the same amount. |
| `hotel.l2.s2` | Question three. The pads are breathing. It is a wellness feature. Timing is everything. |
| `hotel.l2.s3` | Final question. Pick "{text}". I have the card right here. I would never. |
| `hotel.l2.right#0` | Correct! Nobody is more surprised than I am. |
| `hotel.l2.right#1` | Right! Savour it. It is rare. |
| `hotel.l2.right#2` | Correct. The form accepts you. Barely. |
| `hotel.l2.right#3` | Yes. I said that out loud. Moving on. |
| `hotel.l2.right.last` | Correct. All four. I am obliged to be impressed. I am not. |
| `hotel.l2.wrong#0` | Wrong. The pad has been informed. |
| `hotel.l2.wrong#1` | Incorrect! Housekeeping will be right up. With a mop. For you. |
| `hotel.l2.wrong#2` | No. Gravity will take it from here. |
| `hotel.l2.wrong#3` | That is not the answer. That is a lifestyle choice. |
| `hotel.l2.wrong.lie#0` | You trusted me. That was the real wrong answer. |
| `hotel.l2.wrong.lie#1` | I said it was that one, yes. And you believed me. In this hotel. |
| `hotel.l2.hint#0` | One wrong answer removed. A hint is just a lie you paid for. |
| `hotel.l2.hint#1` | There. Fifty-fifty. Much like my honesty. |
| `hotel.l2.hint#2` | Done. One fewer wrong answer. Still plenty of ways to fail. |
| `hotel.l2.hint.none` | Only the right answer is left. Even I cannot help you now. |
| `hotel.l2.done` | You are checked in! Your room is a lie, but the check-in was real. Enjoy your stay. |
| `hotel.l3.intro` | Level three: Lost Luggage. You are locked in the baggage office. Which is not a metaphor. The door has a four-digit code. |
| `hotel.l3.intro2` | The code is... let me check. {fake}. Yes. Definitely {fake}. I would not lie to a guest. |
| `hotel.l3.fake#0` | {fake}? Really? I say a number and you type it in. That is called trust. It is a hobby of yours. |
| `hotel.l3.fake#1` | Access denied. By me. Mostly. |
| `hotel.l3.denied#0` | Access denied. |
| `hotel.l3.denied#1` | Wrong. Look around. The answer is not on my lips. |
| `hotel.l3.denied#2` | No. Try counting something. Anything. |
| `hotel.l3.lock` | Three wrong tries. The keypad needs a minute to think about what you have done. |
| `hotel.l3.granted` | Access granted. Oh. I had that on a timer. Shame. |
| `hotel.l3.mimic#0` | That one bites. It is in the brochure. |
| `hotel.l3.mimic#1` | A mimic! Forty percent of suitcases are. Look it up. |
| `hotel.l3.junk#0` | A single sock. How tragic. |
| `hotel.l3.junk#1` | Nothing useful. I have been there. |
| `hotel.l3.junk#2` | Somebody's lunch. It is not fresh. |
| `hotel.l3.ledger` | The ledger says the code is {fake}. In my handwriting. I am the only one who writes in it. |
| `hotel.l3.belt` | Baggage handling! The belts will carry you. Mostly backward. It is a lifestyle. |
| `hotel.l3.press` | Oh, the baggage press. Do mind your head. And everything else. |
| `hotel.l3.done` | Carousel 13! Your luggage is not on it. Nobody's ever is. |
| `hotel.l3.hint1` | Hint: count the suitcases by colour. The poster says in what order. |
| `hotel.l3.hint2` | Hint: the first two digits are {a} and {b}. The rest is counting. I am told you can do that. |
| `hotel.l3.hint3` | Hint: the code is {code}. I am not lying. This once. Possibly. |
| `hotel.l4.intro` | Level four: Revolving Door. The hotel has a rooftop hedge maze. It is not in the brochure. It is, however, in the lawsuits. |
| `hotel.l4.intro2` | A new maze every time you try. The revolving doors run on a schedule. Not mine. Green lamp means go. |
| `hotel.l4.lie#0` | Left. Always left. It is the rule of mazes. |
| `hotel.l4.lie#1` | I can see the exit from up here. It is straight ahead. I am looking at a different maze, but still. |
| `hotel.l4.lie#2` | Take the next right. Trust me. I have a map. It is upside down. |
| `hotel.l4.deadend#0` | A dead end! Every maze has one. Yours has several. |
| `hotel.l4.deadend#1` | Nothing here but hedge and regret. |
| `hotel.l4.deadend#2` | Congratulations, you found the part of the maze I am proudest of. |
| `hotel.l4.half` | Halfway! Statistically you are as lost as ever. |
| `hotel.l4.door` | Revolving doors. A wonderful invention that lets you enter and leave at the same time. Mind the glass. |
| `hotel.l4.cart#0` | Housekeeping has the right of way. It is in the contract. |
| `hotel.l4.cart#1` | You walked into a luggage cart. In a maze. Outdoors. Impressive. |
| `hotel.l4.cart#2` | Mind the trolley. It does not mind you. |
| `hotel.l4.done` | The exit! It was at the end the whole time. They always are. Mostly. |
| `hotel.l5.intro` | Level five: Bellhop Blues. The bellhop is VERY keen to carry your bags. Over you, if necessary. He starts in a moment. Do not look back. Or do. It does not help either way. |
| `hotel.l5.go` | DING DING DING. That is him. He does not do tips. He does feet. |
| `hotel.l5.close#0` | He is right behind you. I would not look. I would not stop, either. |
| `hotel.l5.close#1` | Closer. Closer. Bells are not supposed to be that fast. He is on commission. |
| `hotel.l5.belts` | A moving walkway! In the wrong direction. Obviously. |
| `hotel.l5.marble` | Polished marble. Polished by people who hate you. |
| `hotel.l5.stairs` | Stairs! Jump them. Walking is for the guests who tip. |
| `hotel.l5.trolley` | Oh, the gondola has wheels. Sorry. Rails. Whatever. It is leaving. |
| `hotel.l5.last` | Straight ahead! The service elevator! It is very close! It is also very slow! Run! |
| `hotel.l5.cp` | Checkpoint! The bellhop has been told. He does not care. |
| `hotel.l5.caught#0` | The bellhop has your bags. And you. |
| `hotel.l5.caught#1` | DING. Your luggage has arrived. It is you. |
| `hotel.l5.caught#2` | He is only doing his job. His job is you. |
| `hotel.l5.caught#3` | Being flattened by a bell. A rare hotel experience. |
| `hotel.l5.done` | Safe! The service elevator is staff only. You are, unfortunately, the staff now. |
| `hotel.complete.first` | Level one done! The marble is very proud of you. I'm... fine. |

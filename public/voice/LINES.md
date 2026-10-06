# Narrator lines

Record or generate one audio file per row and save it as `public/voice/<ID>.mp3`.
Then list the IDs you have in `public/voice/manifest.json` (a JSON array of ID strings) and redeploy.
Lines without a file keep working with subtitles + the synthesised voice blips.

`{n}`, `{m}`, `{letter}`, `{text}`, `{fake}`, `{a}`, `{b}`, `{code}` in a line are filled in at runtime (death count, metres fallen, the answer letter, a code digit…); record those lines with a generic read, or reword them in `src/script.js`.

456 lines.

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
| `hotel.l6.intro` | Level six: Soufflé. The chef made a soufflé. A big one. It is rising. It does not care that you are in the kitchen. |
| `hotel.l6.intro2` | Climb. Up is where the roof hatch is. Down is where the soufflé is. Choose carefully. It is mostly egg. |
| `hotel.l6.rise` | And there it goes. Gently, at first. Never trust a dessert that is gentle. |
| `hotel.l6.near#0` | Close! It is rising. Soufflés do that. It is the entire personality. |
| `hotel.l6.near#1` | You can smell it, right? Vanilla. And doom. |
| `hotel.l6.tray` | Serving trays! They slide. Hospitality is a moving target. |
| `hotel.l6.legb` | The west side now. The chef works here. He is not in. He left a very sharp note. |
| `hotel.l6.burner` | Hot plates! Lit on a timer. I do not set the timer. The timer sets me. |
| `hotel.l6.exit` | Look! An EXIT door! Right there on the wall! It is definitely an exit! Go on! Walk in! |
| `hotel.l6.pans` | Swinging pans. Housekeeping calls it "a wall of cutlery". I call it Tuesday. |
| `hotel.l6.top` | The roof hatch! I can see it from here! It is the exact opposite of the soufflé: high, dry and not delicious. |
| `hotel.l6.cp` | Checkpoint! The soufflé has been informed that you are above it. It is reasoning. |
| `hotel.l6.foam#0` | You have been folded in. That is a cooking term. |
| `hotel.l6.foam#1` | Soufflé: 1. You: a cautionary tale. |
| `hotel.l6.foam#2` | Delicious. For the soufflé. |
| `hotel.l6.burn#0` | Hot. Hot hot hot. It was hot. |
| `hotel.l6.burn#1` | The pan has been pre-heated. By me. For you. |
| `hotel.l6.burn#2` | Medium rare. Mostly rare. |
| `hotel.l6.fakeexit#0` | That is the OVEN. The exit is up there. Where I pointed. The other way. |
| `hotel.l6.fakeexit#1` | You walked into an oven. In a kitchen. And you are surprised. |
| `hotel.l6.done` | The roof! It rose, you rose faster. Spiritually, you are now a pastry chef. |
| `hotel.l7.intro` | Level seven: Trivia Night! Six rounds. A live audience. And me, your dashing host, with the answers. Mostly. |
| `hotel.l7.intro2` | Stand on an answer to lock it in. Wrong answers are removed, and so are you. Applause is mandatory. |
| `hotel.l7.s0` | Round one. Easy. It is {letter}. I am being honest. I will be honest again, in a bit. |
| `hotel.l7.s1` | Round two! The answer is {letter}. I have never been so sure. Write that down. Seriously, write that down. |
| `hotel.l7.s2` | Round three. The pads are sliding. It is called "audience engagement". Keep your balance. And your dignity. |
| `hotel.l7.s3` | Round four! You have twelve seconds. When the clock hits zero, the pads leave. I cannot stop them. I would not stop them. |
| `hotel.l7.s4` | Round five. Four answers! Whatever you do, do not pick {letter}. I would not pick {letter}. You know how I feel about {letter}. |
| `hotel.l7.s5` | The final round. Pay attention. I have said some things tonight. One of them is the answer. Think back. |
| `hotel.l7.right#0` | Correct! The audience goes wild. The audience is a tablecloth. But still. |
| `hotel.l7.right#1` | Right! Take a bow. A small one. Do not strain anything. |
| `hotel.l7.right#2` | Yes! You are doing so well that I am worried about the ratings. |
| `hotel.l7.right#3` | Correct. I was hoping you would not be. |
| `hotel.l7.right.last` | CORRECT! You listened to me. You, of all people, listened to ME. I am so proud. I am so annoyed. |
| `hotel.l7.wrong#0` | Wrong! Gasp! The audience gasps! The tablecloths flutter! |
| `hotel.l7.wrong#1` | No. The correct answer is the other one. Obviously. |
| `hotel.l7.wrong#2` | Incorrect! Please enjoy a little fall. |
| `hotel.l7.wrong#3` | That is not right. That is not even close to right. That is right-adjacent. |
| `hotel.l7.wrong.lie#0` | You believed me. In round two. In THIS hotel. |
| `hotel.l7.wrong.lie#1` | I said {letter}. Out loud. On air. And you went with it. |
| `hotel.l7.hint#0` | One wrong answer, gone. Consider it a complimentary lie, reversed. |
| `hotel.l7.hint#1` | There. One fewer way to fail. We will find more. |
| `hotel.l7.hint.none` | Only the right answer is left. Even I cannot make this easier. |
| `hotel.l7.timeup#0` | TIME! The pads have left. They are on break. |
| `hotel.l7.timeup#1` | Time is up. That is the sound of the answers retiring. |
| `hotel.l7.done` | You are the champion! The trophy is plastic. The title is real. The prize is... this moment. |
| `hotel.l8.intro` | Level eight: Dinner Is Served. You have been invited to dinner. You are not on the menu. Yet. |
| `hotel.l8.intro2` | Our guest is very hungry and very particular. The menu on the wall says the order. Between us, I say serve the {first} first. Tradition. |
| `hotel.l8.first` | One down. The guest nods. He has no neck. It is a very subtle nod. |
| `hotel.l8.half` | Halfway through the courses. The guest is thrilled. You can tell by the absolute lack of expression. |
| `hotel.l8.open` | All six courses served in order. The kitchen door opens. I am furious. Mostly with the order. |
| `hotel.l8.dessert#0` | DESSERT FIRST?! Then you shall have it. All of it. From above. |
| `hotel.l8.dessert#1` | Dessert is last. Everyone knows that. Look out. |
| `hotel.l8.wrong#0` | Wrong course! The trolley has been dispatched. Look up. Or sideways. Quickly. |
| `hotel.l8.wrong#1` | Out of order! The kitchen has strong feelings. They are about to be delivered. |
| `hotel.l8.wrong#2` | That was not the next course. Brace yourself, a cake has been notified. |
| `hotel.l8.cellar` | The wine cellar. It is where we keep the good stuff and the questionable decisions. |
| `hotel.l8.merlot` | Someone spilled the Merlot. Somebody. Who? Do not look at me. Do look at your feet. |
| `hotel.l8.barrel#0` | A barrel! They roll! It is in the name! Well, it is in the physics. |
| `hotel.l8.barrel#1` | Flattened by a barrel of something nice. Cheers. |
| `hotel.l8.barrel#2` | Barrel one, you nil. A classic. |
| `hotel.l8.done` | The kitchen! You made it through the entire meal without eating. The guest has left you a tip. It is a sock. |
| `hotel.l8.hint1` | Hint: the menu on the wall describes each course in a riddle. They are in the order to serve them. Not the order I said. |
| `hotel.l8.hint2` | Hint: first the {a}, then the {b}. After that you are on your own. Which is the usual arrangement. |
| `hotel.l8.hint3` | Hint: the order is {all}. I am not lying. Obviously I would say that if I were. |
| `hotel.l9.intro` | Level nine: Kitchen Maze. Walk-in freezers, one-way doors, and a chef. He is not here yet. Do not wait for him to arrive. |
| `hotel.l9.intro2` | A different maze every time. The freezers are slippery. The chef is not. Dead ends are a bad idea. I mention it as a courtesy. |
| `hotel.l9.go` | He has noticed you. Chefs notice everything. Especially texture. |
| `hotel.l9.near#0` | He is right behind you. He has a very large knife and a very small sense of humour. |
| `hotel.l9.near#1` | Can you hear that? That is the sound of professional commitment. |
| `hotel.l9.oneway` | One-way doors! Hygiene regulations. Cross-contamination, you see. Of you. Into the rest of the building. |
| `hotel.l9.ice` | The freezers. Slippery. That is for food safety. Not yours. |
| `hotel.l9.lie#0` | Left. It is definitely left. I used to work here. |
| `hotel.l9.lie#1` | Straight on! The exit is straight on! I am looking at a different kitchen, but still. |
| `hotel.l9.lie#2` | Take the next right. A chef told me. Not this one. |
| `hotel.l9.caught#0` | Chopped. Julienned, even. |
| `hotel.l9.caught#1` | You have been served. By the chef. To himself. |
| `hotel.l9.caught#2` | Tonight's special: you. Medium rare. |
| `hotel.l9.caught#3` | He caught you. He is not even out of breath. He is out of patience. |
| `hotel.l9.done` | The loading dock! You escaped the kitchen. The chef is not angry. He is disappointed. And hungry. |
| `hotel.l10.intro` | Level ten: Dance Floor. The tiles blink to the beat. I do not control them. The DJ does. The DJ is also me. |
| `hotel.l10.intro2` | Hop from lit tile to lit tile. The booths are solid. Rest there. Hydrate. Blink at the right moments. |
| `hotel.l10.warn#0` | Freeze! Everybody freeze! In a moment! Statues! Do not twitch! |
| `hotel.l10.warn#1` | Statues in three... two... one... |
| `hotel.l10.freeze` | FREEZE. Not a single step. Not a wiggle. Pretend you are a decorative urn. |
| `hotel.l10.moved#0` | You MOVED. During the freeze. That is the entire game, and you moved. |
| `hotel.l10.moved#1` | Statues do not walk. You were a bad statue. |
| `hotel.l10.moved#2` | I said freeze. I said it loudly. In a nightclub voice. |
| `hotel.l10.fall#0` | Out of rhythm. Out of tiles. Out of luck. |
| `hotel.l10.fall#1` | The tile left. It had somewhere to be. |
| `hotel.l10.fall#2` | You were two beats late and the floor knows it. |
| `hotel.l10.fall#3` | Dance floor, 1. You, an interpretive blur. |
| `hotel.l10.s2` | The second set! It is faster now. By "faster" I mean "the same, but you are more tired". |
| `hotel.l10.s3` | Halfway to the booth. The tiles are smaller now. Because the song is getting good. |
| `hotel.l10.s4` | Last set! This is the encore. The encore is mandatory. The encore does not care about your knees. |
| `hotel.l10.done` | The DJ booth! You are officially a dancer. Please stop moving. The freeze never really ends. |
| `hotel.l11.intro` | Level eleven: Room 404. Your room. We found it. We lost it. We found it again. It is... slightly different from last time. |
| `hotel.l11.intro2` | The door has a three-digit code. The digits are in the furniture. The furniture is shy. It moves when you are not looking at it. I mention that for no reason. |
| `hotel.l11.moved` | Did that dresser just... no. No, it did not. You are tired. Furniture is famously stationary. |
| `hotel.l11.ward` | Oh, and the wardrobe. It is very old. It is also very curious. Do not take your eyes off it. I would not say that if I did not care. I do not care. |
| `hotel.l11.close#0` | It is getting closer. Look at it. LOOK AT IT. |
| `hotel.l11.close#1` | Stop looking at the dresser. Look at the wardrobe. The wardrobe is the one. |
| `hotel.l11.dark` | Maintenance! The lights are out. That is not a euphemism. Mind the wardrobe. |
| `hotel.l11.first` | One digit. Two to go. And a wardrobe to keep an eye on. Both eyes, ideally. |
| `hotel.l11.second` | Two digits. You are doing so well. The wardrobe is proud. It does not say so. |
| `hotel.l11.all` | All three digits! Now the door. It is the one with the number on it. 404. Not found. Found. |
| `hotel.l11.note` | A note from the armchair: "The code is 404." Signed: me. Naturally I would never lie to a guest. |
| `hotel.l11.fake#0` | 404? Room 404, code 404. It would be so tidy. It is also wrong. |
| `hotel.l11.fake#1` | Not found! That is what 404 means. Nice try. |
| `hotel.l11.denied#0` | Wrong code. |
| `hotel.l11.denied#1` | The door does not like that one. |
| `hotel.l11.denied#2` | No. Try the furniture. |
| `hotel.l11.lock` | Three tries. The keypad has locked itself. For your own good. It is mostly spite. |
| `hotel.l11.caught#0` | The wardrobe has got you. It has a very big door. You are inside now. |
| `hotel.l11.caught#1` | You looked away. Everybody looks away. That is how it wins. |
| `hotel.l11.caught#2` | Wardrobe: 1. You: a hanger. |
| `hotel.l11.open` | The door is open! Run! Do not look back! It cannot move if you look, but it can if you do not! Oh, I cannot decide. |
| `hotel.l11.done` | Out! You left Room 404. It will be there, unseen, behind you. Do not look back. |
| `hotel.l11.hint1` | Hint: search the furniture. Three of the four pieces hold a digit. And keep an eye on the wardrobe. Both eyes. |
| `hotel.l11.hint2` | Hint: the bed, the desk and the dresser each hold a digit. The armchair holds a lie. I know which one is which. I am not saying. |
| `hotel.l11.hint3` | Hint: the code is {code}. And no, it is not 404. |
| `hotel.l12.intro` | Level twelve: Do Not Disturb. Housekeeping is on the floor. Two of them. They have a very strict policy about guests who are not in their rooms. |
| `hotel.l12.intro2` | They see in a cone. I have helpfully drawn it on the floor. Do not stand in it. If you must, hide in a laundry cart. They are in the dead ends. Obviously. |
| `hotel.l12.hide` | Hidden! In a cart! Among the sheets! Which are, I should say, not entirely clean. Press anything to climb out. |
| `hotel.l12.spotted#0` | She has seen you! Run! Or, better, stop being in the cone. |
| `hotel.l12.spotted#1` | Uh oh. That is the look of someone who has found a guest in a corridor. |
| `hotel.l12.caught#0` | Housekeeping! You are in the wrong place at the wrong time. In the right hotel, though. |
| `hotel.l12.caught#1` | Seen! Caught! Folded and put in the cupboard. |
| `hotel.l12.caught#2` | No Do Not Disturb sign can save you now. There was never one on you. |
| `hotel.l12.found#0` | She found you in the cart. She was looking for more sheets. You were more sheets. |
| `hotel.l12.found#1` | The cart is hers. The cart is always hers. You were, briefly, laundry. |
| `hotel.l12.lie#0` | Left! Always left! I have worked here for years! In a different building! |
| `hotel.l12.lie#1` | The exit is right there! Straight on! I can see it! It is a different exit! |
| `hotel.l12.lie#2` | Do Not Disturb signs mean they will not come in. That is what the sign says. It does not say anything about corridors. |
| `hotel.l12.cart` | A laundry cart. Climb in. It is the only discreet thing in this hotel. |
| `hotel.l12.done` | The stairs! Nobody saw you. Nobody ever does. It is the hotel industry's greatest strength. |
| `hotel.l13.intro` | Level thirteen: Minibar. A quiz. The answers are in the minibars. Every minibar has a price. The price on the door is the price. Before the rest. |
| `hotel.l13.intro2` | You have forty-five dollars. A deposit. Opening a minibar costs four. Plus the things. Hints cost nine ninety-nine. Plus the things. You can also just guess. For free. I will be so disappointed. |
| `hotel.l13.first` | Your first minibar! It cost four dollars. And some other dollars. I will itemise later. Maybe. |
| `hotel.l13.opened#0` | Another one! You are a high roller. A mid roller. A roller. |
| `hotel.l13.opened#1` | Opened. The fees are delighted to meet you. |
| `hotel.l13.declined#0` | Card declined! You have been very generous with my money. I mean yours. |
| `hotel.l13.declined#1` | Insufficient funds. The minibar is closed. Guess like it is the nineties. |
| `hotel.l13.declined#2` | No funds, no fridge. Statistically you were only wrong on purpose. |
| `hotel.l13.s0` | Round one. Not a trick question. The answer is {letter}. I can say that without opening a fridge. |
| `hotel.l13.s1` | Round two. It is {letter}. I would not charge you for the truth. Not on the first lie. |
| `hotel.l13.s2` | Round three. Pads breathing, again. Hospitality is mostly motion. |
| `hotel.l13.s3` | Round four! Eleven seconds! The minibar would like to remind you that opening it is free for the first second. |
| `hotel.l13.right#0` | Correct. A fee for being correct has been added. It is small. It is my favourite fee. |
| `hotel.l13.right#1` | Right! Do not let it go to your head. Heads are extra. |
| `hotel.l13.right#2` | Yes! Another one. At this rate you will break even. Just kidding. You will not. |
| `hotel.l13.right.last` | ALL FIVE. You earned it. You also paid for it. Both, in fact. To me. |
| `hotel.l13.wrong#0` | Wrong! Please enjoy a complimentary fall. It is on the house. The fall, not the floor. |
| `hotel.l13.wrong#1` | Incorrect! We have already added a fee for it. |
| `hotel.l13.wrong#2` | No. The correct answer was in the minibar. You did not open the minibar. |
| `hotel.l13.wrong.lie#0` | You believed me about the letter. Even after the minibar. Even after the FEES. |
| `hotel.l13.wrong.lie#1` | I said {letter}. I say a lot of things. You pay for most of them. |
| `hotel.l13.hint#0` | One wrong answer removed. Nine ninety-nine. Plus things. Worth every cent of the things. |
| `hotel.l13.hint#1` | Done. Hint fee: reasonable. Hint fee plus the other fees: not so much. |
| `hotel.l13.hint.none` | Only the right answer is left. We cannot sell you any more help. We tried. |
| `hotel.l13.timeup#0` | TIME! The pads have checked out. They left a review. |
| `hotel.l13.timeup#1` | Out of time. The clock is paid for. You are not. |
| `hotel.l13.bill` | Your bill! Please review it. Carefully. You will be reviewing it for a while. Pick a tip. Any tip. As long as it is a good one. |
| `hotel.l13.done` | Thank you for staying with us! We have charged you for the thank-you. |
| `hotel.l14.intro` | Level fourteen: Hallway Loop. One corridor. Walk it. If everything is normal, keep going to the end. |
| `hotel.l14.intro2` | If ANYTHING is different, turn around and walk back. Get it right {need} times in a row and I will let you out. Get it wrong and you start again. I will have opinions the whole way. |
| `hotel.l14.host.same#0` | Looks normal to me. Go on. |
| `hotel.l14.host.same#1` | Nothing different here. I would know. I live here. |
| `hotel.l14.host.same#2` | Perfectly ordinary. Carry on. |
| `hotel.l14.host.diff#0` | Hm. Something is different. I can feel it. Go back. |
| `hotel.l14.host.diff#1` | I would turn around, if I were you. There is something. I will not say what. |
| `hotel.l14.host.diff#2` | That is not how I left it. Back you go. |
| `hotel.l14.first` | One! Right! Do not let it go to your head. You have five more. And I have all the time. |
| `hotel.l14.right#0` | Correct! The hallway is so annoyed. |
| `hotel.l14.right#1` | Right again! How, though? |
| `hotel.l14.right#2` | Another one. The corridor is sweating. |
| `hotel.l14.last` | That is all of them. All six. You did it. I am so, so angry. The way out is opening. |
| `hotel.l14.missed#0` | There WAS something. You walked right past it. In a hallway. With one thing in it. |
| `hotel.l14.missed#1` | Wrong! Back to zero. Look more. Blink less. |
| `hotel.l14.missed#2` | It was RIGHT THERE. And you were so confident. I am only a little moved. |
| `hotel.l14.paranoid#0` | There was nothing! You turned back from NOTHING. You were hallucinating. Hotels do that. |
| `hotel.l14.paranoid#1` | It was normal. You were paranoid. That is a fair reaction to this hotel, but still wrong. |
| `hotel.l14.paranoid#2` | Nothing was different. You imagined it. Back to zero. |
| `hotel.l14.open` | The north end has... changed. Yes. There are stairs. They were not there a moment ago. Stairs are like that. |
| `hotel.l14.hint.none` | Hint: nothing is different. Keep walking forward. I have, this once, no reason to lie. |
| `hotel.l14.hint.some` | Hint: there is something different in the corridor. Turn around when you find it. I will not tell you what. Press H again if you must. |
| `hotel.l14.hint.where` | Hint: {where} |
| `hotel.l14.done` | Out! The hallway is still looping, for the next guest. It has a lot of patience. And a lot of paintings. |
| `hotel.l15.intro` | Level fifteen: Window Ledge. We are outside the hotel. Eleven floors up. In a thunderstorm. Because I could not find the other door. |
| `hotel.l15.intro2` | Window to window along the ledges. The wind will push you off the wall in gusts. Lean into the wall. The wall is the one that is solid. |
| `hotel.l15.wind` | Gusts! They push you away from the building. Lean in. Press the key that goes toward the wall. Which is, helpfully, the one I did not say. |
| `hotel.l15.ac` | Air conditioners! They are very stable. They are bolted to a very old wall. Do not think about the wall. |
| `hotel.l15.crumble` | These sills have been here since eighteen ninety. They are tired. They would like to retire, now, under you. |
| `hotel.l15.pipe` | A pipe. Balance on it. Gymnasts do it on a beam. A beam is wider. And indoors. And there is no thunderstorm. |
| `hotel.l15.gondola` | The window cleaner's gondola! He is on his break. His break has lasted since March. Hop on when it is close. |
| `hotel.l15.gargoyle` | Gargoyles! Lovely craftsmanship. They are not meant to be stood on. They are not meant to be stood on by you in particular. |
| `hotel.l15.fall#0` | Eleven floors. A long way down. The shorter way is not available. |
| `hotel.l15.fall#1` | You have left the building. Not in the way I intended. |
| `hotel.l15.fall#2` | The wind won. The wind always wins. It is the wind. |
| `hotel.l15.fall#3` | Splat is a word. It is also, I regret to say, the outcome. |
| `hotel.l15.done` | The window! It is open! It is a staff closet! It has mops! It is the best room in the hotel! |
| `hotel.complete.first` | Level one done! The marble is very proud of you. I'm... fine. |

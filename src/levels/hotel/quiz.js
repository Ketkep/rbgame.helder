import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { GOLD, hotelHalo } from './kit.js';
import { palm } from './props.js';

// Hotel quiz rooms: the question bank + the pieces a quiz level is made of (LED board, answer pads, gate).
// Every question has to be answerable by ANY player standing in that room, so each one is gated by what the player
// can actually have seen: controls, the hotel itself, the host and plain common sense are always fair game; Wet Floor
// questions only appear for players who cleared it (they must have, to be here); Campaign 1 questions only if they
// cleared that level. The runner for the multi-act quiz levels (Check-In, Trivia Night, Minibar) is in quiz-show.js.

const cs = (g, id) => g.cs(id);
const hotelBest = (g, i) => cs(g, 'hotel').levelBest?.[i];
const pilotDone = (g, i) => !!cs(g, 'pilot').levelBest?.[i];

const shuffle = (a, rnd) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const fmtTime = (s) => (s < 60 ? 'Under a minute' : s < 180 ? '1 to 3 minutes' : s < 480 ? '3 to 8 minutes' : 'More than 8 minutes');
const TIMES = ['Under a minute', '1 to 3 minutes', '3 to 8 minutes', 'More than 8 minutes'];
const LEVEL_NAMES = ['Wet Floor', 'Check-In', 'Lost Luggage', 'Revolving Door', 'Bellhop Blues', 'Soufflé', 'Trivia Night', 'Dinner Is Served', 'Kitchen Maze', 'Dance Floor', 'Room 404', 'Do Not Disturb', 'Minibar', 'Hallway Loop', 'Window Ledge'];

/**
 * Each entry: [pool, make(game) -> {q, a, w:[wrong…]} | null]. `a` may be an array (several right answers: pool 'two').
 * Pools: keys (controls) · hotel · host · sense (hotel-flavoured common sense) · here (this very level) · two (two right
 * answers) · none (only wrong options: "None of the above" is added by the runner) · unknowable (nobody can know: the
 * runner adds a PASS) · l1 / f1 / f2 / dyn* / pilot (what you did before, only when you did it).
 */
const BANK = [
  // ---- the controls ------------------------------------------------------------------------------------------------
  ['keys', () => ({ q: 'Which key asks me\nfor a hint?', a: 'H', w: ['F', 'Q', 'Tab'] })],
  ['keys', () => ({ q: 'Which key makes\nyou jump?', a: 'Space', w: ['Shift', 'Ctrl', 'Enter'] })],
  ['keys', () => ({ q: 'What does E do while\nyou look at a button?', a: 'Presses it', w: ['Eats it', 'Ends the game', 'Nothing. Ever.'] })],
  ['keys', () => ({ q: 'Which key puts you back\nat your checkpoint?', a: 'R', w: ['T', 'Delete', 'Backspace'] })],
  ['keys', () => ({ q: 'Which key says yes to\nbaby mode when I offer?', a: 'B', w: ['Y', 'Enter', 'Z'] })],
  ['keys', () => ({ q: 'Which key pauses\nthe game?', a: 'Esc', w: ['P', 'Pause/Break', 'F5'] })],
  ['keys', () => ({ q: 'Which key mutes\nthe sound?', a: 'M', w: ['N', 'Backspace', 'Mute (the key)'] })],
  ['keys', () => ({ q: 'Which keys move you\naround?', a: 'W A S D', w: ['H J K L', 'Q W E R', 'Only the arrow keys'] })],
  ['keys', () => ({ q: 'Which key walks\nyou forward?', a: 'W', w: ['S', 'Q', 'F'] })],
  ['keys', () => ({ q: 'Which key walks\nyou backward?', a: 'S', w: ['W', 'B', 'Z'] })],
  ['keys', () => ({ q: 'Which key steps\nyou to the left?', a: 'A', w: ['D', 'L', 'Q'] })],
  ['keys', () => ({ q: 'Which key steps\nyou to the right?', a: 'D', w: ['A', 'R', 'E'] })],
  ['keys', () => ({ q: 'How do you look\naround?', a: 'Move the mouse', w: ['Press L', 'Shout', 'Tilt the monitor'] })],
  ['keys', () => ({ q: 'Holding Space instead\nof tapping it makes you…', a: 'Jump higher', w: ['Jump lower', 'Crouch', 'Pause'] })],
  ['keys', () => ({ q: 'In a quiz like this one,\nwhat does H do?', a: 'Removes a wrong answer', w: ['Wins the round', 'Calls security', 'Nothing at all'] })],
  ['keys', () => ({ q: 'Which mouse button\npresses buttons?', a: 'Left', w: ['Right', 'The scroll wheel', 'None of them'] })],

  // ---- the hotel -------------------------------------------------------------------------------------------------------
  ['hotel', () => ({ q: 'How many elevators are\nin the lobby?', a: '5', w: ['3', '8', '13'] })],
  ['hotel', () => ({ q: 'What does baby mode\ngive you?', a: 'Easier jumps', w: ['Free snacks', 'A new host', 'A refund'] })],
  ['hotel', () => ({ q: 'What do you press at\na button to use it?', a: 'E', w: ['Q', 'Enter', 'Never'] })],
  ['hotel', () => ({ q: 'What does the host do\nwhen asked for directions?', a: 'Lies', w: ['Tells the truth', 'Draws a map', 'Gets the car'] })],
  ['hotel', () => ({ q: 'What is the name\nof this hotel?', a: 'Hotel Trust-Me', w: ['Hotel Honest', 'Motel Truthful', 'Hostel Maybe'] })],
  ['hotel', () => ({ q: 'Who is lying to you\nthe most in here?', a: 'The host', w: ['The doorman', 'The piano', 'Nobody, I am fair'] })],
  ['hotel', () => ({ q: 'What kind of building\nare you in?', a: 'A hotel', w: ['A submarine', 'A bakery', 'A volcano'] })],
  ['hotel', () => ({ q: 'Where do the elevators\nstart from?', a: 'The lobby', w: ['The roof', 'The car park', 'A cannon'] })],
  ['hotel', () => ({ q: 'How do you get from\nthe lobby to a floor?', a: 'An elevator', w: ['A slide', 'A cannon', 'A rope ladder'] })],
  ['hotel', (g) => (g.levelIndex < 0 ? null : { q: 'What is this level\ncalled?', a: g.level.name, w: shuffle(LEVEL_NAMES.filter((n) => n !== g.level.name), Math.random).slice(0, 3) })],
  ['hotel', (g) => (g.levelIndex < 0 ? null : { q: 'Which level number\nis this one?', a: String(g.levelIndex + 1), w: shuffle(Array.from({ length: 15 }, (_, i) => String(i + 1)).filter((s) => s !== String(g.levelIndex + 1)), Math.random).slice(0, 3) })],

  // ---- the host -----------------------------------------------------------------------------------------------------------
  ['host', () => ({ q: 'What does the host\nnever, ever do?', a: 'Apologise', w: ['Talk', 'Gloat', 'Lie'] })],
  ['host', () => ({ q: 'When the host says\n"trust me", you…', a: 'Do not trust him', w: ['Trust him', 'Hug him', 'Tip him'] })],
  ['host', () => ({ q: 'Who is talking\nto you right now?', a: 'The host', w: ['The bellhop', 'Your conscience', 'The piano'] })],
  ['host', () => ({ q: 'What does the host\nthink of himself?', a: 'Very highly', w: ['Very little', 'Nothing at all', 'He is too shy'] })],
  ['host', () => ({ q: 'What is the name\nof this game?', a: 'Trust Me', w: ['Believe Me', 'Ask Me Later', 'Honest Abe'] })],

  // ---- common sense, with room service ---------------------------------------------------------------------------------
  ['sense', () => ({ q: 'What do you sleep in\nat a hotel?', a: 'A bed', w: ['A bathtub', 'The lobby', 'The minibar'] })],
  ['sense', () => ({ q: 'Where do you check in\nat a hotel?', a: 'Reception', w: ['The roof', 'The pool', 'The kitchen'] })],
  ['sense', () => ({ q: 'What do you hang on a\ndoor to be left alone?', a: 'Do Not Disturb', w: ['Your shoes', 'A goldfish', 'The minibar'] })],
  ['sense', () => ({ q: 'What does a bellhop\ncarry?', a: 'Luggage', w: ['Pianos', 'Grudges', 'The hotel'] })],
  ['sense', () => ({ q: 'What comes after\ncheck-in?', a: 'Check-out', w: ['Checkmate', 'Check, please', 'Czech Republic'] })],
  ['sense', () => ({ q: 'What is usually in\na minibar?', a: 'Snacks and drinks', w: ['Luggage', 'Socks', 'A smaller bar'] })],
  ['sense', () => ({ q: 'What opens a hotel room\ndoor these days?', a: 'A key card', w: ['A password', 'A song', 'A sneeze'] })],
  ['sense', () => ({ q: 'Which of these\nis a fruit?', a: 'Banana', w: ['Brick', 'Tuesday', 'Sock'] })],
  ['sense', () => ({ q: 'How many days are\nin a week?', a: '7', w: ['5', '12', '404'] })],
  ['sense', () => ({ q: 'What is 2 + 2?', a: '4', w: ['22', '5', 'Fish'] })],
  ['sense', () => ({ q: 'What does a fire exit\nsign usually say?', a: 'EXIT', w: ['ENTER', 'DANCE', 'PANIC'] })],
  ['sense', () => ({ q: 'Breakfast brought to\nyour room is called…', a: 'Room service', w: ['Floor service', 'Bed mail', 'A miracle'] })],
  ['sense', () => ({ q: 'How many sides does\na triangle have?', a: '3', w: ['4', '5', 'Too many'] })],
  ['sense', () => ({ q: 'What colour is\nfresh snow?', a: 'White', w: ['Green', 'Plaid', 'Purple'] })],
  ['sense', () => ({ q: 'What do you do\nwith a pillow?', a: 'Sleep on it', w: ['Eat it', 'Tip it', 'Frame it'] })],
  ['sense', () => ({ q: 'Where is a hotel room\'s\nnumber usually?', a: 'On the door', w: ['On the ceiling', 'On the guest', 'In the soup'] })],
  ['sense', () => ({ q: 'What is the opposite\nof "check in"?', a: 'Check out', w: ['Check up', 'Check mate', 'Czech in'] })],
  ['sense', () => ({ q: 'Which of these has\nfour legs, usually?', a: 'A chair', w: ['A snake', 'A pillow', 'A doorknob'] })],
  ['sense', () => ({ q: 'What do you dry\nyourself with?', a: 'A towel', w: ['A waffle', 'The curtains', 'A bellhop'] })],
  ['sense', () => ({ q: 'Which of these is\nhot when it is on?', a: 'An oven', w: ['A fridge', 'A snowman', 'An ice cube'] })],

  // ---- two right answers -------------------------------------------------------------------------------------------------
  ['two', () => ({ q: 'Which of these keys\ndo something here?', a: ['H', 'R'], w: ['F13', 'Caps Lock'] })],
  ['two', () => ({ q: 'Which of these are\nin a hotel room?', a: ['A bed', 'A pillow'], w: ['A volcano', 'A submarine'] })],
  ['two', () => ({ q: 'Which of these\ncan you eat?', a: ['Soup', 'Cake'], w: ['A doorknob', 'The lobby'] })],
  ['two', () => ({ q: 'Which of these keys\nmove you?', a: ['W', 'D'], w: ['P', 'Caps Lock'] })],
  ['two', () => ({ q: 'Which of these does\nthe host do a lot?', a: ['Lie', 'Gloat'], w: ['Apologise', 'Pay the bill'] })],
  ['two', () => ({ q: 'Which of these\nare numbers?', a: ['7', '12'], w: ['Banana', 'Tuesday'] })],
  ['two', () => ({ q: 'Which of these work\nin a hotel?', a: ['A bellhop', 'A concierge'], w: ['A pirate', 'An astronaut'] })],

  // ---- none of the above (only wrong options; the runner adds "None of the above") ---------------------------------------
  ['none', () => ({ q: 'What is the name\nof this hotel?', w: ['Hotel Honest', 'Motel Truthful', 'Hostel Maybe'] })],
  ['none', () => ({ q: 'Which key makes\nyou jump?', w: ['Shift', 'Ctrl', 'Enter'] })],
  ['none', () => ({ q: 'How many elevators are\nin the lobby?', w: ['3', '8', '13'] })],
  ['none', () => ({ q: 'Which key asks me\nfor a hint?', w: ['F', 'Q', 'Tab'] })],
  ['none', () => ({ q: 'What do you sleep in\nat a hotel?', w: ['A bathtub', 'The lobby', 'The minibar'] })],
  ['none', () => ({ q: 'What is 2 + 2?', w: ['22', '5', 'Fish'] })],
  ['none', () => ({ q: 'Who lies to you\nthe most in here?', w: ['The doorman', 'The piano', 'Nobody'] })],

  // ---- nobody could know (the runner adds a PASS) -------------------------------------------------------------------------
  ['unknowable', () => ({ q: 'What number am I\nthinking of?', w: ['7', '12', '404'] })],
  ['unknowable', () => ({ q: 'What is my\nfavourite colour?', w: ['Gold', 'Red', 'Teal'] })],
  ['unknowable', () => ({ q: 'What am I going\nto say next?', w: ['Hello', 'Goodbye', 'Trust me'] })],
  ['unknowable', () => ({ q: 'What is in my\nleft pocket?', w: ['A key', 'A coin', 'Lint'] })],
  ['unknowable', () => ({ q: 'What did I have\nfor breakfast?', w: ['Toast', 'Eggs', 'Your hopes'] })],

  // ---- Wet Floor (you cleared it to get here) ------------------------------------------------------------------------------
  ['l1', () => ({ q: 'What was dangerous\nin Wet Floor?', a: 'The floor', w: ['The ceiling', 'The sofa', 'The doorman'] })],
  ['l1', () => ({ q: 'What was a checkpoint\nin Wet Floor?', a: 'A grand piano', w: ['A bathtub', 'A giant cake', 'A small horse'] })],
  ['l1', () => ({ q: 'What rolled away from\nunder you in Wet Floor?', a: 'A brass trolley', w: ['The sofa', 'A grand piano', 'The elevator'] })],
  ['l1', () => ({ q: 'What did you hop over\nin Wet Floor\'s mop lane?', a: 'A mop robot', w: ['A puddle', 'A sleeping dog', 'The host'] })],
  ['l1', () => ({ q: 'What was behind the EXIT\ndoor in Wet Floor?', a: 'A broom closet', w: ['The exit', 'A swimming pool', 'A tiny horse'] })],

  ['dyn', (g) => {
    const b = hotelBest(g, 0); if (!b) return null;
    const a = b.deaths;
    const w = [...new Set([a + 2, a + 5, a + 1, Math.max(0, a - 1), a + 9].filter((n) => n !== a && n >= 0))].slice(0, 3);
    return { q: 'How many times did you\nfall in Wet Floor?', a: String(a), w: w.map(String) };
  }],
  ['dyn', (g) => {
    const b = hotelBest(g, 0); if (!b) return null;
    const a = fmtTime(b.time);
    return { q: 'About how long did\nWet Floor take you?', a, w: TIMES.filter((t) => t !== a).slice(0, 3) };
  }],

  // ---- what you did on floor 1 (only asked once those levels are cleared) ----------------------------------------
  ['f1', (g) => !hotelBest(g, 2) ? null : { q: 'What was the mimic\nin Lost Luggage?', a: 'A black suitcase', w: ['A red suitcase', 'The desk', 'The poster'] }],
  ['f1', (g) => !hotelBest(g, 2) ? null : { q: 'How did you work out the\nLost Luggage code?', a: 'Counted suitcases', w: ['Asked the host', 'Guessed 1337', 'Smashed the keypad'] }],
  ['f1', (g) => !hotelBest(g, 3) ? null : { q: 'What colour was a revolving\ndoor\'s lamp when safe?', a: 'Green', w: ['Red', 'Purple', 'Plaid'] }],
  ['f1', (g) => !hotelBest(g, 3) ? null : { q: 'Where was the maze\nin Revolving Door?', a: 'On the roof', w: ['In the basement', 'In the lobby', 'In the pool'] }],
  ['f1', (g) => !hotelBest(g, 4) ? null : { q: 'What chased you in\nBellhop Blues?', a: 'A giant bell', w: ['A giant suitcase', 'A swarm of bees', 'The manager'] }],
  ['f1', (g) => !hotelBest(g, 1) ? null : { q: 'What did Check-In ask\nyou in its last question?', a: 'Do you trust me?', w: ['Cash or card?', 'Window or aisle?', 'What is your name?'] }],
  ['f1', (g) => !hotelBest(g, 1) ? null : { q: 'In Check-In, what did\nthe survey ask?', a: 'How are we doing?', w: ['Are you a robot?', 'Cake or pie?', 'Nothing. No survey.'] }],
  ['f1', (g) => !hotelBest(g, 0) ? null : { q: 'What was on the wet floor\nin Wet Floor?', a: 'Yellow signs', w: ['Green signs', 'Fish', 'Nothing at all'] }],
  // ---- what you did on floor 2 -------------------------------------------------------------------------------------
  ['f2', (g) => !hotelBest(g, 5) ? null : { q: 'What was rising behind\nyou in Soufflé?', a: 'A soufflé', w: ['Water', 'Lava', 'The host\'s ego'] }],
  ['f2', (g) => !hotelBest(g, 5) ? null : { q: 'What was the fake EXIT\nin Soufflé?', a: 'An oven', w: ['A window', 'A fridge', 'A trapdoor'] }],
  ['f2', (g) => !hotelBest(g, 6) ? null : { q: 'How long was the clock\nin Trivia Night round 4?', a: '12 seconds', w: ['5 seconds', '30 seconds', 'There was no clock'] }],
  ['f2', (g) => !hotelBest(g, 6) ? null : { q: 'What did you hop across\nin Trivia Night?', a: 'Chandeliers', w: ['Pianos', 'Waiters', 'Clouds'] }],
  ['f2', (g) => !hotelBest(g, 7) ? null : { q: 'What fell on you in\nDinner Is Served?', a: 'A cake', w: ['A chandelier', 'A waiter', 'The ceiling'] }],
  ['f2', (g) => !hotelBest(g, 7) ? null : { q: 'What rolled down the\nwine cellar?', a: 'Barrels', w: ['Bowling balls', 'Cheese wheels', 'The chef'] }],
  ['f2', (g) => !hotelBest(g, 8) ? null : { q: 'Who chased you in\nKitchen Maze?', a: 'A chef', w: ['A bellhop', 'A maid', 'A giant soufflé'] }],
  ['f2', (g) => !hotelBest(g, 8) ? null : { q: 'What was slippery\nin Kitchen Maze?', a: 'The freezer floors', w: ['The hedges', 'The chef', 'The doors'] }],
  ['f2', (g) => !hotelBest(g, 9) ? null : { q: 'What did you have to do\nwhen the DJ yelled FREEZE?', a: 'Stand perfectly still', w: ['Dance harder', 'Jump', 'Run'] }],
  ['f2', (g) => !hotelBest(g, 9) ? null : { q: 'What did the tiles in\nDance Floor do?', a: 'Blinked on the beat', w: ['Exploded', 'Played music', 'Nothing'] }],
  ['dyn3', (g) => {   // your deadliest floor 2 level (only when there is a clear winner)
    const names = ['Soufflé', 'Trivia Night', 'Dinner Is Served', 'Kitchen Maze', 'Dance Floor'];
    const rows = names.map((n, i) => [n, hotelBest(g, 5 + i)?.deaths]).filter(([, d]) => d !== undefined);
    if (rows.length < 4) return null;
    rows.sort((a, b) => b[1] - a[1]);
    if (rows[0][1] === rows[1][1]) return null;
    return { q: 'Which Floor 2 level\nkilled you the most?', a: rows[0][0], w: rows.slice(1).map((r) => r[0]) };
  }],
  ['dyn2', (g) => {   // your deadliest level so far (only when there is a clear winner)
    const names = ['Wet Floor', 'Check-In', 'Lost Luggage', 'Revolving Door', 'Bellhop Blues'];
    const rows = names.map((n, i) => [n, hotelBest(g, i)?.deaths]).filter(([, d]) => d !== undefined);
    if (rows.length < 4) return null;
    rows.sort((a, b) => b[1] - a[1]);
    if (rows[0][1] === rows[1][1]) return null;
    return { q: 'Which Floor 1 level\nkilled you the most?', a: rows[0][0], w: rows.slice(1).map((r) => r[0]) };
  }],
  ['dyn2', (g) => {
    const b = hotelBest(g, 4); if (!b) return null;
    const a = b.deaths, w = [...new Set([a + 3, a + 1, Math.max(0, a - 2), a + 8].filter((n) => n !== a && n >= 0))].slice(0, 3);
    return { q: 'How many times did the\nbell get you in Bellhop Blues?', a: String(a), w: w.map(String) };
  }],

  ['pilot', (g) => !pilotDone(g, 0) ? null : { q: 'What was the first level\nof Campaign 1 called?', a: 'The Tutorial', w: ['The Tower', 'Checkpoint Island', 'The Real Ending'] }],
  ['pilot', (g) => !pilotDone(g, 1) ? null : { q: 'In Checkpoint Island,\nwhat did the fake\ncheckpoints do?', a: 'Absolutely nothing', w: ['Saved you', 'Gave you a hat', 'Tidied up'] }],
  ['pilot', (g) => !pilotDone(g, 2) ? null : { q: 'What was Level 3\nof Campaign 1 called?', a: 'The Tower', w: ['The Tutorial', 'The Real Ending', 'Checkpoint Island'] }],
  ['pilot', (g) => !pilotDone(g, 4) ? null : { q: 'How did Campaign 1\nend?', a: 'With a door. Two doors.', w: ['A boss fight', 'A long elevator ride', 'It never ended'] }],
];

// Questions already asked in this play session (by text): a level prefers new ones, so rounds do not repeat
// between the three quiz levels or when you replay one. (Within one level `used` keeps it from asking twice.)
const SEEN = new Set();
export const bankSize = (pool) => BANK.filter((e) => e[0] === pool).length;

/**
 * Pick one question from `pools` (tried in order; questions not yet asked this session first). `n` answers (default 3),
 * the right one(s) shuffled in. `used` (a Set) keeps a level from asking the same thing twice.
 * Pools 'none' and 'unknowable' return only the wrong options (the runner adds the right one).
 */
export function pickQuestion(game, pools, { rnd = Math.random, n = 3, used = null } = {}) {
  pools = [].concat(pools);
  for (const fresh of [true, false]) {
    for (const pool of pools) {
      const idx = shuffle(BANK.map((e, i) => i).filter((i) => BANK[i][0] === pool && !(used && used.has(i))), rnd);
      for (const i of idx) {
        const q = BANK[i][1](game);
        if (!q || (fresh && SEEN.has(q.q))) continue;
        const right = q.a === undefined ? [] : [].concat(q.a);
        const nWrong = n - (right.length ? right.length : 0);
        if (q.w.length < nWrong) continue;
        used?.add(i); SEEN.add(q.q);
        const wrong = shuffle(q.w, rnd).slice(0, nWrong);
        const answers = shuffle([...right.map((text) => ({ text, correct: true })), ...wrong.map((text) => ({ text, correct: false }))], rnd);
        return { q: q.q, answers, pool };
      }
    }
  }
  // everything in these pools was already asked: repeat one rather than build a broken level
  return used ? pickQuestion(game, pools, { rnd, n }) || pickQuestion(game, ['keys', 'hotel'], { rnd, n }) : null;
}

// ================================================================================================
//  Visuals
// ================================================================================================
const FONT = '"Archivo Black", Impact, sans-serif';

/** The big LED board that shows the question. `hang` (a ceiling height) adds the two rods it hangs from. Has setText(). */
export function boardMesh(w, { x, y, z, width = 10, height = 3.4, header = 'QUESTION', text = '', hang = null, headerColor = '#d8a94a' }) {
  const S = 1024, cw = S, ch = Math.round(S * height / width);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  w.ownTextures.push(tex);
  const draw = (hd, tx, hc) => {
    const bg = g.createLinearGradient(0, 0, 0, ch); bg.addColorStop(0, '#120a1c'); bg.addColorStop(1, '#2a1030');
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = '#d8a94a'; g.lineWidth = 10; g.strokeRect(10, 10, cw - 20, ch - 20);
    g.lineWidth = 3; g.strokeRect(28, 28, cw - 56, ch - 56);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let hs = Math.round(ch * 0.13);
    for (;;) { g.font = `${hs}px ${FONT}`; if (g.measureText(hd).width < cw - 90 || hs < 18) break; hs -= 2; }
    g.fillStyle = hc; g.fillText(hd, cw / 2, ch * 0.17);
    const lines = String(tx).split('\n');
    let fs = Math.round(ch * 0.2);
    for (;;) { g.font = `${fs}px ${FONT}`; if (Math.max(...lines.map((l) => g.measureText(l).width)) < cw - 110 || fs < 24) break; fs -= 2; }
    g.fillStyle = '#fff6e0'; g.shadowColor = '#ffb040'; g.shadowBlur = 14;
    const lh = fs * 1.12, top = ch * 0.58 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, cw / 2, top + i * lh));
    g.shadowBlur = 0;
    tex.needsUpdate = true;
  };
  draw(header, text, headerColor);
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.z = 0.02;
  grp.add(face);
  const frame = (fx, fy, fw, fh) => { const m = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.3), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); m.position.set(fx, fy, -0.12); m.castShadow = false; grp.add(m); };
  frame(0, height / 2 + 0.12, width + 0.5, 0.24); frame(0, -height / 2 - 0.12, width + 0.5, 0.24);
  frame(-width / 2 - 0.12, 0, 0.24, height); frame(width / 2 + 0.12, 0, 0.24, height);
  const back = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, height + 0.4, 0.2), plainMaterial(0x0c0810, { roughness: 0.5 })); back.position.z = -0.14; grp.add(back);
  if (hang !== null) {   // it hangs from the ceiling on two gold rods (it does not float)
    const len = hang - (y + height / 2 + 0.24);
    if (len > 0.05) for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); rod.position.set(sx * width * 0.36, height / 2 + 0.24 + len / 2, -0.12); grp.add(rod); }
  }
  // marquee bulbs round the frame
  const bulbs = [];
  const bm = glowMaterial(0xffd890, 2.6), bgeo = new THREE.SphereGeometry(0.07, 8, 6);
  const nx = Math.round(width / 0.5), ny = Math.round(height / 0.5);
  const addBulb = (bx, by) => { const b = new THREE.Mesh(bgeo, bm); b.position.set(bx, by, 0.05); grp.add(b); bulbs.push(b); };
  for (let i = 0; i <= nx; i++) { const bx = -width / 2 + (i * width) / nx; addBulb(bx, height / 2 + 0.12); addBulb(bx, -height / 2 - 0.12); }
  for (let i = 1; i < ny; i++) { const by = -height / 2 + (i * height) / ny; addBulb(-width / 2 - 0.12, by); addBulb(width / 2 + 0.12, by); }
  w.add(grp);
  hotelHalo(w, x, y, z + 0.6, width * 1.15, 0xffb860, 0.12);
  w.onUpdate((dt, t) => { if (!grp.visible) return; const k = Math.floor(t * 3) % 2; bulbs.forEach((b, i) => { b.visible = (i + k) % 2 === 0 || i % 5 === 0; }); });
  grp.setText = (tx, hd = header, hc = headerColor) => draw(hd, tx, hc);
  return grp;
}

function drawTag(g, S, ch, letter, text) {
  g.clearRect(0, 0, S, ch);
  g.fillStyle = '#15101c'; g.fillRect(0, 0, S, ch);
  g.strokeStyle = '#d8a94a'; g.lineWidth = 8; g.strokeRect(6, 6, S - 12, ch - 12);
  g.fillStyle = '#d8a94a'; g.beginPath(); g.arc(70, ch / 2, 46, 0, 7); g.fill();
  g.fillStyle = '#15101c'; g.font = `${70}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 70, ch / 2 + 4);
  const words = String(text).split(' ');
  let lines = [text];
  if (String(text).length > 14 && words.length > 1) { const mid = Math.ceil(words.length / 2); lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean); }
  let fs = 50;
  for (;;) { g.font = `${fs}px ${FONT}`; if (Math.max(...lines.map((l) => g.measureText(l).width)) < S - 190 || fs < 20) break; fs -= 2; }
  g.fillStyle = '#fff6e0'; g.textAlign = 'center';
  const lh = fs * 1.1;
  lines.forEach((l, i) => g.fillText(l, 70 + (S - 70) / 2 + 10, ch / 2 + (i - (lines.length - 1) / 2) * lh + 3));
}

/** The little standee above an answer pad (letter + answer text). Returns a mesh to attach to the pad (mesh.setText(letter, text) redraws it). */
export function answerTag(letter, text, { width = 3.2, height = 1.5 } = {}) {
  const S = 512, ch = Math.round(S * height / width);
  const c = document.createElement('canvas'); c.width = S; c.height = ch;
  const g = c.getContext('2d');
  drawTag(g, S, ch, letter, text);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  m.userData.tex = tex;
  m.setText = (l, t) => { drawTag(g, S, ch, l, t); tex.needsUpdate = true; };
  return m;
}

const STATE_COLOR = { idle: [0, 0, 0, 0], lock: [1.0, 0.75, 0.2, 0.34], right: [0.2, 1.0, 0.45, 0.5], wrong: [1.0, 0.18, 0.2, 0.55], out: [0.5, 0.1, 0.12, 0.3] };

/**
 * An answer pad: a marble slab with a status overlay, an answer standee on two gold posts and a letter on the top.
 * Standing on it for `dwell` seconds locks the answer in. Returns { plat, state, set(state), setText(text) }.
 */
export function makePad(w, { x, z, y = 0, wd = 3.4, dp = 3.2, letter, text, correct, dwell = 0.9, tagW = 3.2 }) {
  const plat = w.plat({ x, y, z, w: wd, d: dp, h: 0.6, tex: 'marble', color: 0xd8d4e0, roughness: 0.25, radius: 0.08 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(wd + 0.04, 0.08, dp + 0.04), glowMaterial(GOLD, 1.3));
  trim.position.set(0, 0.3 - 0.12, 0); trim.matrixAutoUpdate = true;
  plat.group.add(trim);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, toneMapped: false });
  const over = new THREE.Mesh(new THREE.PlaneGeometry(wd - 0.2, dp - 0.2), mat);
  over.rotation.x = -Math.PI / 2; over.position.y = 0.3 + 0.01; plat.group.add(over);
  // letter on the pad
  const lc = document.createElement('canvas'); lc.width = lc.height = 256;
  const lg = lc.getContext('2d'); lg.fillStyle = '#7a5a1c'; lg.font = `190px ${FONT}`; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillText(letter, 128, 140);
  const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(lt);
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: lt, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  lm.rotation.x = -Math.PI / 2; lm.position.set(0, 0.3 + 0.012, 0.0); plat.group.add(lm);
  // the standee stands on two thin gold posts at the far edge of the pad
  const tag = answerTag(letter, text, { width: tagW });
  const tagY = 2.6, tagZ = -dp / 2 + 0.12;
  tag.position.set(0, tagY, tagZ);
  plat.group.add(tag);
  const postMat = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
  const postH = tagY - 0.75 - 0.3;
  const posts = [];
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, postH, 6), postMat); p.position.set(sx * (tagW / 2 - 0.25), 0.3 + postH / 2, tagZ - 0.04); plat.group.add(p); posts.push(p); }
  plat.group.matrixAutoUpdate = true;
  plat.o.moving = true;
  const pad = { plat, correct, letter, text, state: 'idle', lockT: 0, dwell, over, tag, posts, fall: 0, vy: 0, eliminated: false };
  pad.set = (s) => {
    pad.state = s; const c = STATE_COLOR[s === 'gone' ? 'out' : s] || STATE_COLOR.idle;
    mat.color.setRGB(c[0], c[1], c[2]); mat.opacity = c[3];
  };
  pad.set('idle');
  pad.pulse = (t) => { if (pad.state === 'lock') mat.opacity = 0.22 + 0.2 * Math.sin(t * 22); };
  pad.setText = (text2) => { pad.text = text2; tag.setText(letter, text2); };
  pad.showTag = (on) => { tag.visible = on; };
  return pad;
}

/** A full-width glowing gate that blocks the way until opened. Returns { open(), close(), isOpen }. */
export function makeGate(w, { x = 0, y0 = -10, y1 = 13, z, width = 28, label = 'LOCKED' }) {
  void label;
  const body = w.collider({ x, y: (y0 + y1) / 2, z, w: width, h: y1 - y0, d: 0.5 });
  const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(width, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.25, 0.3), transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  curtain.position.y = 6; grp.add(curtain);
  const bars = [];
  for (let i = -Math.floor(width / 2); i <= Math.floor(width / 2); i += 4) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 12, 0.04), glowMaterial(0xff4060, 1.1)); b.position.set(i, 6, 0); grp.add(b); bars.push(b);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.18), glowMaterial(0xff4060, 1.2)); top.position.y = 12; grp.add(top);
  const bot = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.18), glowMaterial(0xff4060, 1.2)); bot.position.y = 0.05; grp.add(bot);
  w.add(grp);
  const gate = { body, grp, isOpen: false, t: 0 };
  const recolor = (r, g, b) => { curtain.material.color.setRGB(r, g, b); for (const m of [...bars, top, bot]) m.material.color.setRGB(r * 1.2, g * 1.2, b * 1.2); };
  gate.open = () => { gate.isOpen = true; body.enabled = false; recolor(0.2, 1.0, 0.45); };
  gate.close = () => { gate.isOpen = false; body.enabled = true; gate.t = 0; recolor(1.0, 0.25, 0.3); grp.visible = true; grp.position.y = 0; };
  gate.update = (dt) => { if (gate.isOpen && gate.t < 1) { gate.t = Math.min(1, gate.t + dt * 1.6); grp.position.y = gate.t * 12.5; if (gate.t >= 1) grp.visible = false; } };
  return gate;
}

// ================================================================================================
//  A quiz hall: a string of stage islands, each with a question board, a row of answer pads and a gate.
//  (The original one-act runner. The redone quiz levels use quiz-show.js; this stays for anything that wants a simple hall.)
//  Per-stage gimmicks: 'honest' | 'lie' | 'breathe' | 'slide' | 'timer'.
// ================================================================================================
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** A little scoreboard that shows a number (the countdown). `hang` adds the rods it hangs from. */
export function clockMesh(w, x, y, z, { hang = null, label = 'SECONDS' } = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(tex);
  const grp = new THREE.Group(); grp.position.set(x, y, z); w.add(grp);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.z = 0.02; grp.add(m);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.3, 0.2), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); frame.position.z = -0.12; grp.add(frame);
  if (hang !== null && hang - y - 1.15 > 0.05) {
    const len = hang - y - 1.15;
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); rod.position.set(sx * 1.2, 1.15 + len / 2, -0.12); grp.add(rod); }
  }
  let last = -1;
  const set = (n, hot = false) => {
    if (n === last) return; last = n;
    g.fillStyle = '#0c0810'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = hot ? '#ff4a58' : '#ffd890'; g.font = `110px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = hot ? '#ff2030' : '#ffb040'; g.shadowBlur = 16;
    g.fillText(n < 0 ? '--' : String(n), 128, 86); g.shadowBlur = 0;
    g.font = `26px ${FONT}`; g.fillStyle = '#d8a94a'; g.fillText(label, 128, 142);
    tex.needsUpdate = true;
  };
  set(-1);
  grp.visible = false;
  return { set, show: (on) => { grp.visible = on; }, grp };
}

export function quizHall(w, game, spec) {
  const { Z0 = 4, period = 16, islandD = 7, finalD = 12, stages: specs, lines, hallW = 19 } = spec;
  const N = specs.length;
  const zEnd = Z0 - N * period - 5;
  const islands = [];
  const island = (zN, depth = islandD) => {
    const zc = zN + depth / 2;
    const p = w.plat({ x: 0, y: 0, z: zc, w: hallW, d: depth, h: 1.4, tex: 'carpet', color: spec.carpet ?? 0xffffff, roughness: 0.92, radius: 0.05, trim: GOLD });
    w.box({ x: 0, y: -0.7, z: zc, w: hallW + 0.4, h: 0.12, d: depth + 0.4, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    for (const sx of [-1, 1]) palm(w, sx * (hallW / 2 - 1.3), zc, 1.0);
    islands.push({ zN, zS: zN + depth, zc, plat: p });
    return p;
  };
  island(Z0);
  for (let k = 1; k < N; k++) island(Z0 - k * period);
  island(zEnd, finalD);
  const fin = islands[N];

  // ---- the stages -------------------------------------------------------------------------------------
  const stages = specs.map((sp, k) => {
    const isl = islands[k], q = sp.q, n = q.answers.length;
    const moving = sp.gimmick === 'breathe', sliding = sp.gimmick === 'slide';
    const padZ = isl.zN - (moving ? 4.8 : 4.4);
    const pads = q.answers.map((a, i) => {
      const pad = makePad(w, { x: (i - (n - 1) / 2) * 4.6, z: padZ, letter: LETTERS[i], text: a.text, correct: a.correct });
      const phase = (i / n) * Math.PI * 2;
      pad.fallY = 0;
      w.mover(pad.plat, (t) => ({ y: pad.fallY, z: moving ? Math.sin(t * 1.15 + phase) * 0.6 : 0, x: sliding ? Math.sin(t * 1.0 + k) * 1.2 : 0 }));
      return pad;
    });
    const gate = makeGate(w, { z: isl.zN - 8.4 });
    const board = boardMesh(w, { x: 0, y: 6.6, z: isl.zN - 8.9, width: 12, height: 3.6, header: sp.header || `QUESTION ${k + 1} OF ${N}`, text: q.q, hang: 13 });
    const correctPad = pads.find((p) => p.correct), wrongPads = pads.filter((p) => !p.correct);
    const st = { k, spec: sp, pads, gate, q, board, correctPad, wrongPads, lieLetter: null, timer: null, unlocked: !sp.lockedTags };
    if (sp.gimmick === 'lie') st.lieLetter = sp.lieLetter || wrongPads[Math.floor(Math.random() * wrongPads.length)].letter;
    if (sp.gimmick === 'timer') {
      const clock = clockMesh(w, 8.2, 6.6, isl.zN - 8.9, { hang: 13 });
      st.timer = { limit: sp.limit || 12, left: sp.limit || 12, started: false, clock, downT: 0 };
    }
    return st;
  });

  // ---- state ----------------------------------------------------------------------------------------------
  let cleared = 0;
  const reveal = () => stages.forEach((st) => { const on = st.k <= cleared; st.board.visible = on; st.pads.forEach((p) => { p.tag.visible = on && st.unlocked; }); if (st.timer && !on) st.timer.clock.show(false); });
  reveal();
  const cur = () => stages[cleared];
  stages.forEach((st) => { st.unlock = () => { st.unlocked = true; reveal(); }; });
  const resetPad = (pad) => {
    pad.set('idle'); pad.lockT = 0; pad.dropT = 0; pad.fallY = 0; pad.vy = 0; pad.eliminated = false; pad.falling = false;
    pad.plat.setEnabled(true); pad.plat.group.scale.setScalar(1);
  };
  const resetTimer = (st) => { if (st.timer) { st.timer.left = st.timer.limit; st.timer.started = false; st.timer.downT = 0; st.timer.clock.set(-1); st.timer.clock.show(st.k <= cleared); } };
  w.onRespawn(() => { for (let k = cleared; k < N; k++) { stages[k].pads.forEach(resetPad); resetTimer(stages[k]); } });
  stages.forEach((st) => st.timer && resetTimer(st));

  const resolve = (st, pad) => {
    if (pad.correct) {
      pad.set('right'); st.gate.open(); cleared = st.k + 1; reveal();
      if (st.timer) st.timer.clock.show(false);
      game.audio.ding(); game.ui.toast('✔ Correct', 'gold');
      game.say(st.k === N - 1 ? lines.rightLast : lines.right, { priority: 2 });
    } else {
      pad.set('wrong'); pad.dropT = 0; game.audio.buzzer();
      game.say(st.lieLetter && pad.letter === st.lieLetter ? lines.wrongLie : lines.wrong, { priority: 2 });
    }
  };

  w.onUpdate((dt, t) => {
    for (const s of stages) s.gate.update(dt);
    const pl = game.player;
    for (const st of stages) {
      for (const pad of st.pads) {
        pad.pulse(t);
        if (pad.falling) {
          pad.vy -= 26 * dt; pad.fallY += pad.vy * dt;
          if (pad.fallY < -2.5) pad.plat.body.enabled = false;
          if (pad.fallY < -14) { pad.plat.setEnabled(false); pad.falling = false; }
          continue;
        }
        if (st.k !== cleared) continue;
        if (pad.state === 'wrong') { pad.dropT += dt; if (pad.dropT > 0.35) { pad.plat.body.enabled = false; pad.falling = true; pad.vy = 0; } continue; }
        if (pad.state !== 'idle' && pad.state !== 'lock') continue;
        const on = game.state === 'playing' && pl.grounded && pl.ground === pad.plat.body;
        if (on) {
          if (pad.state === 'idle') { pad.set('lock'); game.audio.tick(); }
          pad.lockT += dt;
          if (pad.lockT >= pad.dwell) resolve(st, pad);
        } else if (pad.state === 'lock') { pad.lockT = 0; pad.set('idle'); }
      }
      // the countdown (starts once you set foot on this stage's island)
      const tm = st.timer;
      if (tm && st.k === cleared && game.state === 'playing') {
        if (tm.downT > 0) {          // pads are gone; bring them back after a moment
          tm.downT -= dt;
          if (tm.downT <= 0) { st.pads.forEach(resetPad); resetTimer(st); }
        } else {
          if (!tm.started && pl.grounded && pl.ground === islands[st.k].plat.body && pl.z < islands[st.k].zS - 0.5) { tm.started = true; tm.clock.show(true); }
          if (tm.started) {
            tm.left -= dt * (game.baby ? 0.65 : 1);   // baby mode: the clock runs slower
            const secs = Math.max(0, Math.ceil(tm.left));
            tm.clock.set(secs, secs <= 4);
            if (secs <= 4 && Math.floor(tm.left * 2) !== tm.beep) { tm.beep = Math.floor(tm.left * 2); game.audio.tick(); }
            if (tm.left <= 0) {
              st.pads.forEach((p) => { if (p.state !== 'gone') { p.set('gone'); p.plat.body.enabled = false; p.falling = true; p.vy = 0; } });
              tm.downT = 3.4; game.say(lines.timeUp, { priority: 2 });
            }
          }
        }
      }
    }
  });

  // the respawn point follows you up the hall (no flag, just a quiet save)
  for (let k = 1; k <= N; k++) {
    const isl = islands[k];
    w.trigger({ x: 0, y: 1.5, z: isl.zN + 3, w: hallW - 2, h: 3, d: isl.zS - isl.zN - 1.5, once: true, onEnter: () => {
      w.respawn = { x: 0, y: 0, z: isl.zN + 3.5, yaw: 0 };
      if (k < N && lines.stage) { const r = lines.stage(k, stages[k]); if (r) game.say(r[0], { priority: 1, vars: r[1] }); }
    } });
  }

  // ---- 50/50 hint: the host removes one wrong answer ----------------------------------------------------------
  const hintAction = (g) => {
    const st = cur(); if (!st || cleared >= N) return false;
    const standing = (p) => g.player.grounded && g.player.ground === p.plat.body;
    const cand = st.wrongPads.filter((p) => !p.eliminated && !standing(p) && p.state === 'idle');
    if (!cand.length) { g.say(lines.hintNone, { priority: 1 }); return false; }
    const pad = cand[Math.floor(Math.random() * cand.length)];
    pad.eliminated = true; pad.plat.body.enabled = false; pad.set('gone'); pad.falling = true; pad.vy = 0;
    g.say(lines.hint, { priority: 1 });
    return true;
  };
  w.hintAction = hintAction;

  // ---- test bot: answer correctly, one island at a time ----------------------------------------------------------
  w.botPlan = (g) => {
    const p = g.player, st = cur();
    if (!st) return { x: 0, z: fin.zN + 6.5 };
    if (p.grounded && p.ground === st.correctPad.plat.body) return { wait: true, x: p.x, z: p.z };
    const isl = islands[st.k];
    if (st.timer && st.timer.downT > 0) return { wait: true, x: p.x, z: p.z };
    if (p.z > isl.zS + 0.2) return { body: isl.plat.body };
    return { body: st.correctPad.plat.body };
  };
  w.quiz = { stages, get cleared() { return cleared; }, islands };
  return { stages, islands, fin, cur, get cleared() { return cleared; }, N };
}

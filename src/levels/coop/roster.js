// Campaign 3 — Couples Retreat: ten two-player "sessions". Levels that are not built yet are placeholders.
import icebreakers from './icebreakers.js';
import trustFalls from './trust-falls.js';
import communication from './communication.js';
import tetheredTrek from './tethered-trek.js';
import spaDay from './spa-day.js';

// [name, kind, tagline, deathRule]
const ROSTER = [
  ['Icebreakers', 'tutorial', 'Plates, boosts and a rope. Hold hands (virtually).'],
  ['Trust Falls', 'trust', 'One of you sees the bridge. The other sees the drop.'],
  ['Communication Exercise', 'split', 'You have the map. They have the keypad.'],
  ['Tethered Trek', 'rope', 'Do not let go of each other. You physically cannot.'],
  ['Spa Day', 'control', 'Your partner runs the valves. Be nice to them.'],
  ['The Newlywed Game', 'quiz', 'How well do you actually know each other?'],
  ['Dinner Date', 'team', 'Cook. Carry. Serve. Do not drop her soufflé.'],
  ['Secret Santa', 'betrayal', 'Everyone gets a gift. One of them is a trap.'],
  ['Shared Baggage', 'climb', 'A very tall pile of each other\'s problems.'],
  ['The Vows', 'finale', 'Everything you learned. Together. Or not.'],
];

export const KIND_ICON = { tutorial: '🤝', trust: '🪂', split: '🗝', rope: '🧗', control: '🧖', quiz: '💬', team: '🍝', betrayal: '🎁', climb: '🎒', finale: '💍' };

const planned = ([name, kind, tagline], i) => ({ id: `coop-${i + 1}`, name, kind, tagline, index: i, placeholder: true });

export function buildCoopLevels() {
  const BUILT = [icebreakers, trustFalls, communication, tetheredTrek, spaDay, undefined, undefined, undefined, undefined, undefined];
  BUILT[0] = icebreakers;
  BUILT[3] = tetheredTrek;
  return ROSTER.map((r, i) => (BUILT[i] ? Object.assign(BUILT[i], { kind: r[1], tagline: r[2], index: i }) : planned(r, i)));
}

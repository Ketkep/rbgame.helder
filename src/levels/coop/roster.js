// Campaign 3 — Couples Retreat: fifteen two-player "sessions". Levels that are not built yet are placeholders.
import icebreakers from './icebreakers.js';
import trustFalls from './trust-falls.js';
import communication from './communication.js';
import tetheredTrek from './tethered-trek.js';
import spaDay from './spa-day.js';
import newlywed from './newlywed.js';
import dinnerDate from './dinner-date.js';
import secretSanta from './secret-santa.js';
import baggage from './baggage.js';
import vows from './vows.js';
import gameNight from './game-night.js';
import roadTrip from './road-trip.js';
import karaokeNight from './karaoke-night.js';
import campsite from './campsite.js';
import gala from './gala.js';

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
  ['Game Night', 'board', 'A board game. One of you rolls. The other one moves. It is rigged.'],
  ['Road Trip', 'drive', 'One drives. One navigates. Nobody is allowed to say "I told you so".'],
  ['Karaoke Night', 'rhythm', 'Hit the beat. Together. No, together.'],
  ['The Campsite', 'dark', 'One lantern. Two of you. Stay close.'],
  ['Anniversary Gala', 'gala', 'Everything you learned, with worse lighting and more witnesses.'],
];

export const KIND_ICON = { tutorial: '🤝', trust: '🪂', split: '🗝', rope: '🧗', control: '🧖', quiz: '💬', team: '🍝', betrayal: '🎁', climb: '🎒', finale: '💍', board: '🎲', drive: '🚗', rhythm: '🎤', dark: '🏕', gala: '🥂' };

const planned = ([name, kind, tagline], i) => ({ id: `coop-${i + 1}`, name, kind, tagline, index: i, placeholder: true });

export function buildCoopLevels() {
  const BUILT = [icebreakers, trustFalls, communication, tetheredTrek, spaDay, newlywed, dinnerDate, secretSanta, baggage, vows, gameNight, roadTrip, karaokeNight, campsite, gala];
  BUILT[0] = icebreakers;
  BUILT[3] = tetheredTrek;
  return ROSTER.map((r, i) => (BUILT[i] ? Object.assign(BUILT[i], { kind: r[1], tagline: r[2], index: i }) : planned(r, i)));
}

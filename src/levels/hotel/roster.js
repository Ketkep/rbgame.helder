// The Hotel Trust-Me roster: 5 tiers x 5 levels. Levels that are not built yet are placeholders
// ("under renovation") so the elevators, saves and home page already know about all 25.

import wetFloor from './wet-floor.js';
import checkIn from './check-in.js';

export const TIERS = [
  { floor: '1',  name: 'Mezzanine',            difficulty: 'Easy',                    short: 'EASY',       color: 0x3ddc97, blurb: 'Complimentary lies.' },
  { floor: '2',  name: 'Restaurant & Ballroom', difficulty: 'Medium',                  short: 'MEDIUM',     color: 0xffc83d, blurb: 'The soup is a trap.' },
  { floor: '3',  name: 'Guest Rooms',          difficulty: 'Hard',                    short: 'HARD',       color: 0xff8a3d, blurb: 'Do not disturb. Seriously.' },
  { floor: '4',  name: 'Penthouse',            difficulty: 'Impossible',              short: 'IMPOSSIBLE', color: 0xff4d5e, blurb: 'The view is not worth it.' },
  { floor: '13', name: 'Management',           difficulty: 'Why are u even trying',   short: 'WHY?',       color: 0xb06cff, blurb: 'There is no floor 13.' },
];

// [name, kind] — kind: parkour | quiz | escape | maze | boss | trick
const ROSTER = [
  ['Wet Floor', 'parkour'], ['Check-In', 'quiz'], ['Lost Luggage', 'escape'], ['Revolving Door', 'maze'], ['Bellhop Blues', 'parkour'],
  ['Soufflé', 'parkour'], ['Trivia Night', 'quiz'], ['Dinner Is Served', 'escape'], ['Kitchen Maze', 'maze'], ['Dance Floor', 'parkour'],
  ['Room 404', 'escape'], ['Do Not Disturb', 'maze'], ['Minibar', 'quiz'], ['Hallway Loop', 'maze'], ['Window Ledge', 'parkour'],
  ['Chandelier', 'parkour'], ['The Vault', 'escape'], ['Pop Quiz', 'quiz'], ['Skybridge', 'parkour'], ['Checkout', 'boss'],
  ['Floor 13', 'trick'], ['Terms & Conditions', 'trick'], ['Complaint Desk', 'trick'], ['Fire Drill', 'trick'], ['Management', 'trick'],
];

export const KIND_ICON = { parkour: '🏃', quiz: '❓', escape: '🔑', maze: '🌀', boss: '👔', trick: '🃏' };

const planned = (name, kind, i) => ({ id: `hotel-${i + 1}`, name, kind, tier: Math.floor(i / 5), index: i, placeholder: true });

export function buildHotelLevels() {
  const BUILT = [wetFloor, checkIn];
  return ROSTER.map(([name, kind], i) => (BUILT[i] ? Object.assign(BUILT[i], { kind, tier: Math.floor(i / 5), index: i }) : planned(name, kind, i)));
}

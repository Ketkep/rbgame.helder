// The campaign registry. The home page is built from this list.
//
// To add a campaign: create its levels (see src/levels/level1.js for the shape), then add an entry here
// with `status: 'playable'` and a `levels` array. Saves are kept per campaign `id`, so pick a stable id.

import level1 from './levels/level1.js';
import level2 from './levels/level2.js';
import level3 from './levels/level3.js';
import level4 from './levels/level4.js';
import level5 from './levels/level5.js';
import hotelLobby from './levels/hotel/lobby.js';
import { TIERS, buildHotelLevels } from './levels/hotel/roster.js';

export const CAMPAIGNS = [
  {
    id: 'pilot',
    number: 1,
    title: 'The Tutorial',
    tagline: 'Five basic levels to get used to the controls. The host swears every one of them is fair.',
    eta: '~20 min',
    status: 'playable',
    levels: [level1, level2, level3, level4, level5],
    after: 'Campaign 2 is coming soon. The host promises it will be "fair".',
  },
  {
    id: 'hotel',
    number: 2,
    title: 'Hotel Trust-Me',
    tagline: 'Check in. Checking out is a process. 25 rooms, five floors, one very smug manager.',
    eta: '25 levels',
    status: 'playable',
    hub: hotelLobby,            // a walkable lobby; its elevators are the level select
    tiers: TIERS,
    levels: buildHotelLevels(),
    after: 'Campaign 3 is coming soon. The manager says it will be "fair".',
  },
  {
    id: 'season3',
    number: 3,
    title: '???',
    tagline: 'Classified. Mostly because it doesn\'t exist yet.',
    status: 'soon',
  },
];

export const getCampaign = (id) => CAMPAIGNS.find((c) => c.id === id) || CAMPAIGNS[0];

/**
 * Is level `i` of campaign `c` playable for save `cs`?
 *  - hub campaigns: strictly in order (clear level i-1 to unlock i)
 *  - others: anything up to the furthest level reached, or everything once the campaign is finished
 */
export function isLevelUnlocked(c, cs, i, debug = false) {
  if (debug) return true;
  if (c.hub) return i === 0 || !!cs.levelBest[i - 1];
  return cs.completed || i <= (cs.furthest || 0);
}

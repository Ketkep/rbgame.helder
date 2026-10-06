// The campaign registry. The home page is built from this list.
//
// To add a campaign: create its levels (see src/levels/level1.js for the shape), then add an entry here
// with `status: 'playable'` and a `levels` array. Saves are kept per campaign `id`, so pick a stable id.

import level1 from './levels/level1.js';
import level2 from './levels/level2.js';
import level3 from './levels/level3.js';
import level4 from './levels/level4.js';
import level5 from './levels/level5.js';

export const CAMPAIGNS = [
  {
    id: 'pilot',
    number: 1,
    title: 'Welcome to the Show',
    tagline: 'Five levels. The host swears every one of them is fair.',
    eta: '~20 min',
    status: 'playable',
    levels: [level1, level2, level3, level4, level5],
    after: 'Campaign 2 is coming soon. The host promises it will be "fair".',
  },
  {
    id: 'season2',
    number: 2,
    title: '???',
    tagline: 'The host says it\'s "almost ready". He has said that about everything.',
    status: 'soon',
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

// LOWTIDE — the horror campaign. Eight long chapters; chapters that are not built yet are placeholders.
// Slots are filled in by `BUILT[i]`; see docs/lowtide.md for the story and the chapter plan.
import intake from './intake.js';
<<<<<<< HEAD
<<<<<<< HEAD
import nightRounds from './night-rounds.js';
=======
import records from './records.js';
>>>>>>> origin/lowtide-c3-records
=======
import hydro from './hydro.js';
>>>>>>> origin/lowtide-c4-hydro

const ROSTER = [
  ['Intake', 'Wake up. Check your wristband. It is not your name.'],
  ['Night Rounds', 'The Orderly walks Ward B at the same time every night. Almost.'],
  ['Records Room', 'Two files. Same patient. Different stories.'],
  ['Hydrotherapy', 'The tide is already in the basement.'],
  ['The Theatre', 'One of you is on the table. The other has the controls.'],
  ['The Morgue', 'Your partner is behind you. So is your partner.'],
  ['The Director', 'Everything you were told was true. For somebody.'],
  ['Lowtide', 'The tide is coming in. Choose.'],
];

export const KIND_ICON = {};

const planned = ([name, tagline], i) => ({ id: `lowtide-${i + 1}`, name, kind: 'horror', tagline, index: i, placeholder: true });

export function buildLowtideLevels() {
<<<<<<< HEAD
<<<<<<< HEAD
  const BUILT = [intake, nightRounds];
=======
  const BUILT = [intake, undefined, records];
>>>>>>> origin/lowtide-c3-records
=======
  const BUILT = [intake, undefined, undefined, hydro];
>>>>>>> origin/lowtide-c4-hydro
  return ROSTER.map((r, i) => (BUILT[i] ? Object.assign(BUILT[i], { kind: 'horror', tagline: r[1], index: i }) : planned(r, i)));
}

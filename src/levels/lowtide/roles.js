// Secret roles for a Lowtide run. The HOST's run seed (sent with every chapter load, so both machines agree and it survives chapter changes) picks
// who the game treats as the Keyholder (the staff member who has been "treating" the other) and who is the Subject. Neither player is told until
// chapter 7; before that each gets private files, private whispers and a private objective. Flags carry the story between chapters.
//
//   const R = roles(w, game);   R.mine ('keyholder' | 'subject')   R.keyholder ('p1' | 'p2')   R.is('keyholder')
//   R.whisper(key|text)         a private line only the keyholder hears (or { keyholder: …, subject: … } for both)
//   R.flag('took-key', true)    run-long story flag (synced to both)      R.get('took-key')

export function roles(w, game) {
  const c = w.coop, me = c.me;
  const seed = c.runSeed ?? game.coop?.runSeed ?? 1;
  const keyholder = (((seed >>> 3) ^ (seed >>> 11)) & 1) ? 'p1' : 'p2';
  const R = { keyholder, subject: keyholder === 'p1' ? 'p2' : 'p1' };
  R.mine = me === keyholder ? 'keyholder' : 'subject';
  R.is = (r) => R.mine === r;
  R.roleOf = (role) => (role === keyholder ? 'keyholder' : 'subject');
  R.whisper = (lines, opts = { priority: 2 }) => {
    const t = typeof lines === 'string' ? (R.is('keyholder') ? lines : null) : lines[R.mine];
    if (t) game.narrator.say(t, opts);
  };
  c.onEvent('flag', (m) => { if (m && m.k) game.coop.runFlags[m.k] = m.v; });
  R.flag = (k, v = true) => { game.coop.runFlags[k] = v; c.emit('flag', { k, v }); };
  R.get = (k, d = undefined) => (k in game.coop.runFlags ? game.coop.runFlags[k] : d);
  w.roles = R;
  return R;
}

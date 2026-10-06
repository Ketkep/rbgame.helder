import './style.css';
import { Game } from './game.js';
import { getCampaign } from './campaigns.js';

let game;
try {
  game = new Game();
} catch (err) {
  console.error(err);
  const d = document.createElement('div');
  d.id = 'fatal';
  d.innerHTML = '<div class="panel"><h2>WebGL needed</h2><p class="quip">Trust Me… couldn\'t start 3D graphics in this browser. Try a recent Chrome, Edge or Firefox with hardware acceleration on.</p></div>';
  document.body.appendChild(d);
  throw err;
}
game.loadLevel(0).then((ok) => {
  if (!ok) return;
  game.state = 'title';
  game.audio.playMusic('title'); // no-ops until the first click unlocks audio
});

// URL shortcuts for testing: ?debug&level=3 jumps straight in (no pointer lock needed)
const q = new URLSearchParams(location.search);
if (q.has('debug') && q.get('campaign') && !q.has('level') && getCampaign(q.get('campaign')).hub) {
  game.audio.init();
  game.enterHub(q.get('campaign')).then(() => game.ui.toast('Debug mode: click the screen to capture the mouse', 'good'));
} else if (q.has('debug') && q.has('level')) {
  game.audio.init();
  game.newGame(Math.max(0, +q.get('level') - 1), q.get('campaign') || undefined).then(() => game.ui.toast('Debug mode: click the screen to capture the mouse', 'good'));
}

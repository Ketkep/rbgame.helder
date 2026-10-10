import { Coop, ROLES } from './coop.js';
import { PeerTransport, LoopbackTransport, makeCode, cleanCode } from './transport.js';
import { getCampaign, isLevelUnlocked } from '../campaigns.js';

// The Campaign 3 room screen: host / join with a code, see who is here, host picks the level.
const $ = (id) => document.getElementById(id);

export class CoopUI {
  constructor(game) {
    this.game = game;
    this.loop = new URLSearchParams(location.search).has('loop');        // tests: link two tabs of one browser instead of WebRTC
    this.busy = false;
    $('coop-host').addEventListener('click', () => { game.audio.init(); game.audio.click(); this.host(); });
    $('coop-join').addEventListener('click', () => { game.audio.init(); game.audio.click(); this.join($('coop-code').value); });
    $('coop-code').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('coop-join').click(); });
    $('coop-name').addEventListener('keydown', (e) => e.stopPropagation());
    $('coop-name').addEventListener('keyup', (e) => e.stopPropagation());
    $('coop-code').addEventListener('keyup', (e) => e.stopPropagation());
    $('coop-back').addEventListener('click', () => { game.audio.click(); game.ui.showScreen('home'); });
    $('coop-leave').addEventListener('click', () => { game.audio.click(); this.leave(true); });
    $('coop-copy').addEventListener('click', () => this.copyInvite());
    $('coop-name').value = game.save.settings.coopName || '';
    this.chip = $('partner-chip');
    setInterval(() => this._chip(), 400);
  }

  get name() { return $('coop-name').value.trim(); }
  _msg(t) { $('coop-msg').textContent = t || ''; }

  open() {
    this.game.ui.showScreen('coop');
    $('coop-menu').classList.remove('hidden'); $('coop-room').classList.add('hidden');
    this._msg('');
  }

  _saveName() {
    this.game.save.settings.coopName = this.name;
    try { localStorage.setItem('trustme.save.v2', JSON.stringify(this.game.save)); } catch { /* */ }
  }

  async host(code) {
    if (this.busy) return; this.busy = true; this._msg('Opening a room…');
    try {
      this._saveName();
      const T = this.loop ? LoopbackTransport : PeerTransport;
      let tr, c = code || makeCode();
      for (let tries = 0; ; tries++) {
        try { tr = await T.host(c); break; } catch (e) { if (tries > 3 || e?.type !== 'unavailable-id') throw e; c = makeCode(); }
      }
      this._start(tr, true, c);
    } catch (e) { this._msg(this._why(e)); }
    this.busy = false;
  }

  async join(raw) {
    const code = cleanCode(raw);
    if (code.length < 4) return this._msg('Type the room code your partner sent you.');
    if (this.busy) return; this.busy = true; this._msg('Connecting…');
    try {
      this._saveName();
      const tr = await (this.loop ? LoopbackTransport : PeerTransport).join(code);
      this._start(tr, false, code);
    } catch (e) { this._msg(this._why(e)); }
    this.busy = false;
  }

  _why(e) {
    const t = e?.type || e?.message || '';
    if (/peer-unavailable/.test(t)) return "No room with that code. Check it's right and that your partner is still hosting.";
    if (/timeout/.test(t)) return "Couldn't connect. A strict network/firewall can block direct links. Try another network or ask your partner to host.";
    if (/network|socket|server/.test(t)) return "Can't reach the matchmaking server. Check your connection and try again.";
    return `Couldn't connect (${t || 'unknown'}).`;
  }

  _start(transport, isHost, code) {
    const g = this.game;
    this.code = code;
    g.coop?.close();
    const c = (g.coop = new Coop(g, transport, isHost, this.name));
    c.onevent = (type, d) => {
      if (type === 'open' || type === 'hello' || type === 'rtt') this._room();
      if (type === 'closed') this.partnerLeft();
      if (type === 'bye') this.partnerLeft();
      if (type === 'menu') this.backToRoom(false);
    };
    g.campaign = getCampaign('coop');
    $('coop-menu').classList.add('hidden'); $('coop-room').classList.remove('hidden');
    $('coop-codeout').textContent = code;
    g.ui.showScreen('coop');
    this._room();
  }

  _room() {
    const c = this.game.coop; if (!c) return;
    const full = c.connected && c.helloed;
    $('coop-status').textContent = full
      ? (c.isHost ? 'Your partner is here. Pick a session to begin.' : `Connected to ${c.names.p1}. Waiting for them to pick a session…`)
      : (c.isHost ? 'Waiting for your partner… send them the code (Discord is fine).' : 'Connecting…');
    $('coop-codebox').classList.toggle('hidden', !c.isHost || full);
    const slot = (id, role) => {
      const here = role === c.me || full;
      $(id).innerHTML = `<span style="color:${ROLES[role].css}">●</span> ${here ? c.names[role] : '…'}<small>${role === 'p1' ? 'Host' : 'Guest'}${role === c.me ? ' · you' : ''}</small>`;
    };
    slot('coop-slot1', 'p1'); slot('coop-slot2', 'p2');
    $('coop-ping').textContent = full ? `Connection: ${Math.round(c.rtt * 1000)} ms round trip` : '';
    this._levels(full);
  }

  _levels(full) {
    const g = this.game, c = g.coop, camp = getCampaign('coop'), cs = g.cs('coop');
    const grid = $('coop-levels'); grid.innerHTML = '';
    if (!full) return;
    camp.levels.forEach((lv, i) => {
      const open = !lv.placeholder && c.isHost;                       // 2 Player Mode: the host can pick any built session (no lock-step unlocking)
      const done = !!cs.levelBest[i];
      const t = document.createElement('button');
      t.className = 'tile ' + (done ? 'done' : lv.placeholder ? 'locked' : 'open');
      t.disabled = !c.isHost || lv.placeholder || !open;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = lv.placeholder ? '🔧' : done ? '✔' : i + 1;
      const b = document.createElement('b'); b.textContent = lv.name;
      const sm = document.createElement('small'); sm.textContent = lv.placeholder ? 'under construction' : (c.isHost ? (lv.tagline || 'ready') : 'host picks');
      t.append(n, b, sm);
      if (!t.disabled) t.addEventListener('click', () => { g.audio.click(); c.startLevel(i); });
      grid.appendChild(t);
    });
  }

  copyInvite() {
    const url = `${location.origin}${location.pathname}?join=${this.code}`;
    const txt = `Join my Trust Me… co-op room: code ${this.code}\n${url}`;
    navigator.clipboard?.writeText(txt).then(() => { $('coop-copy').textContent = 'Copied!'; setTimeout(() => { $('coop-copy').textContent = 'Copy invite'; }, 1500); }).catch(() => { $('coop-copy').textContent = this.code; });
  }

  backToRoom(announce) {
    const g = this.game, c = g.coop; if (!c) return;
    if (announce) c.send({ t: 'menu' });
    document.exitPointerLock?.();
    g.state = 'paused'; g.ui.hud(false); g.narrator.clear();
    g.ui.showScreen('coop'); this._room();
  }

  partnerLeft() {
    const g = this.game;
    if (!g.coop) return;
    document.exitPointerLock?.();
    g.state = 'paused'; g.ui.hud(false);
    g.ui.showScreen('coop');
    $('coop-menu').classList.add('hidden'); $('coop-room').classList.remove('hidden');
    $('coop-status').textContent = 'Your partner left (or lost connection). Leave the room and start a new one.';
    $('coop-levels').innerHTML = ''; $('coop-codebox').classList.add('hidden');
  }

  leave(showHome = true) {
    const g = this.game;
    if (g.coop) { g.coop.close(); g.coop = null; }
    this.chip.classList.add('hidden');
    if (showHome) { g.toHome(); }
  }

  _chip() {
    const g = this.game, c = g.coop;
    const on = !!c && c.connected && g.world && g.state !== 'title' && !g.ui.screens.coop.classList.contains('show');
    this.chip.classList.toggle('hidden', !on);
    if (!on) return;
    const o = c.other;
    this.chip.querySelector('i').style.background = ROLES[o].css;
    this.chip.querySelector('span').textContent = c.names[o];
    const ms = Math.round(c.rtt * 1000);
    this.chip.querySelector('small').textContent = `${ms} ms`;
    this.chip.classList.toggle('bad', ms > 180);
  }

  /** URL shortcuts: ?join=CODE (invite link) and, for tests, ?coop=host|join&code=… */
  auto() {
    const q = new URLSearchParams(location.search);
    const j = q.get('join') || (q.get('coop') === 'join' ? q.get('code') : null);
    if (q.get('name')) $('coop-name').value = q.get('name');
    if (q.get('coop') === 'host') { this.open(); return this.host(q.get('code') || undefined); }
    if (j) { this.open(); $('coop-code').value = cleanCode(j); if (q.has('coop')) return this.join(j); }
    return null;
  }
}

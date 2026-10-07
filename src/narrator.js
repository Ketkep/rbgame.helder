import { SCRIPT } from './script.js';

/**
 * The Host. Shows subtitles with a typewriter effect and plays a synthesised "voice" blip per
 * character. If public/voice/manifest.json lists an ID, the matching mp3 is played instead.
 */
export class Narrator {
  constructor(ui, audio) {
    this.ui = ui;
    this.audio = audio;
    this.cur = null;          // { text, id, shown, hold, prio, t, voice }
    this.queue = [];
    this.history = new Map(); // key -> last variant index (avoid repeats)
    this.cooldownUntil = 0;
    this.now = 0;
    this.silenced = false;
    this.voiceIds = new Set();
    this.voiceBase = (import.meta.env?.BASE_URL || '/') + 'voice/';
    this._loadManifest();
  }

  async _loadManifest() {
    try {
      const r = await fetch(this.voiceBase + 'manifest.json', { cache: 'no-cache' });
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j)) this.voiceIds = new Set(j);
    } catch { /* no voice pack: subtitles only */ }
  }

  /** Resolve a script key (or literal text) to { text, id }. */
  resolve(keyOrText, vars = {}) {
    // on a touch screen a line may have a '.touch' twin that talks about thumbs instead of keys
    const key = this.touch && SCRIPT[keyOrText + '.touch'] !== undefined ? keyOrText + '.touch' : keyOrText;
    const entry = SCRIPT[key];
    let text = keyOrText, id = null;
    if (entry !== undefined) {
      if (Array.isArray(entry)) {
        let i = Math.floor(Math.random() * entry.length);
        const last = this.history.get(key);
        if (entry.length > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (entry.length - 1))) % entry.length;
        this.history.set(key, i);
        text = entry[i]; id = `${key}#${i}`;
      } else { text = entry; id = key; }
    }
    text = text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
    return { text, id };
  }

  /**
   * priority 0: ambient (dropped if busy / on cooldown)
   *          1: normal (queued behind the current line)
   *          2: important (interrupts and clears the queue)
   */
  say(keyOrText, { priority = 1, vars = {}, hold = null } = {}) {
    if (this.silenced) return;
    const { text, id } = this.resolve(keyOrText, vars);
    const line = { text, id, shown: 0, t: 0, prio: priority, hold, voice: null };
    if (priority === 0) {
      if (this.cur || this.queue.length || this.now < this.cooldownUntil) return;
      this._start(line);
    } else if (priority >= 2) {
      this.queue.length = 0;
      this._start(line);
    } else if (!this.cur) this._start(line);
    else { this.queue.push(line); if (this.queue.length > 3) this.queue.shift(); }
  }

  _start(line) {
    if (this.cur?.voice) { try { this.cur.voice.pause(); } catch { /* ignore */ } }
    this.cur = line;
    line.t = 0; line.shown = 0;
    if (line.id && this.voiceIds.has(line.id)) {
      try {
        const a = new Audio(this.voiceBase + line.id + '.mp3');
        a.volume = this.audio.muted ? 0 : this.audio.volume;
        a.play().catch(() => { line.voice = null; });
        line.voice = a;
      } catch { line.voice = null; }
    }
    this.ui.setSubtitle(line.text, 0);
  }

  clear() {
    this.queue.length = 0;
    if (this.cur?.voice) { try { this.cur.voice.pause(); } catch { /* ignore */ } }
    this.cur = null;
    this.ui.hideSubtitle();
  }

  update(dt) {
    this.now += dt;
    const c = this.cur;
    if (!c) {
      if (this.queue.length) this._start(this.queue.shift());
      return;
    }
    c.t += dt;
    const total = c.text.length;
    const prev = Math.floor(c.shown);
    c.shown = Math.min(total, c.shown + dt * 54);
    const now = Math.floor(c.shown);
    if (now !== prev) {
      this.ui.setSubtitle(c.text, now);
      if (!c.voice) {
        // one blip every other visible character; pitch wobbles around a smug low voice
        for (let i = prev; i < now; i++) {
          const ch = c.text[i];
          if (ch && /[a-z0-9]/i.test(ch) && i % 2 === 0) this.audio.blip(0.82 + ((ch.charCodeAt(0) * 7) % 13) / 28, 1);
        }
      }
    }
    const reading = c.hold ?? Math.max(2.0, total * 0.052 + 0.9);
    const voiceDone = c.voice ? c.voice.ended : true;
    if (c.shown >= total && c.t > total / 54 + reading && voiceDone) {
      this.ui.hideSubtitle();
      this.cur = null;
      this.cooldownUntil = this.now + 5;
    }
  }
}

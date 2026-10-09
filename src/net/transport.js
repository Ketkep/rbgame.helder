// Two ways to link two browsers. Both give the same tiny interface:
//   t.send(obj)            – JSON-able message to the partner
//   t.onmessage = (obj)=>  – message from the partner
//   t.onopen / t.onclose   – link up / link down
//   t.close()
//
//  • PeerTransport     – real play: WebRTC through PeerJS' free public broker. A room code is just a peer id.
//  • LoopbackTransport – testing: two tabs of the same browser talk over a BroadcastChannel (no network at all).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const makeCode = (n = 5) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const PREFIX = 'trustme-coop-';

class Base {
  constructor() { this.onopen = null; this.onclose = null; this.onmessage = null; this.onerror = null; this.open = false; }
}

export class PeerTransport extends Base {
  /** Host: resolves once the room exists. The partner connecting fires onopen. */
  static async host(code = makeCode()) {
    const t = new PeerTransport(); t.code = code; t.isHost = true;
    const { Peer } = await import('peerjs');
    await new Promise((resolve, reject) => {
      const peer = (t.peer = new Peer(PREFIX + code, { debug: 0 }));
      peer.on('open', resolve);
      peer.on('error', (e) => reject(e));
      peer.on('connection', (conn) => {
        if (t.conn) { conn.on('open', () => conn.close()); return; }      // room is full
        t._wire(conn);
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* broker gone: existing link keeps working */ } });
    });
    return t;
  }

  static async join(code) {
    const t = new PeerTransport(); t.code = cleanCode(code); t.isHost = false;
    const { Peer } = await import('peerjs');
    await new Promise((resolve, reject) => {
      const peer = (t.peer = new Peer({ debug: 0 }));
      peer.on('error', (e) => { reject(e); t.onerror?.(e); });
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + t.code, { reliable: true, serialization: 'json' });
        t._wire(conn);
        const to = setTimeout(() => reject(new Error('timeout')), 15000);
        conn.on('open', () => { clearTimeout(to); resolve(); });
      });
    });
    return t;
  }

  _wire(conn) {
    this.conn = conn;
    const up = () => { this.open = true; this.onopen?.(); };
    if (conn.open) up(); else conn.on('open', up);
    conn.on('data', (d) => this.onmessage?.(d));
    conn.on('close', () => { if (this.open) { this.open = false; this.onclose?.(); } });
    conn.on('error', (e) => this.onerror?.(e));
  }

  send(msg) { if (this.open) { try { this.conn.send(msg); } catch { /* link dropped */ } } }
  close() { this.open = false; try { this.conn?.close(); } catch { /* */ } try { this.peer?.destroy(); } catch { /* */ } }
}

export class LoopbackTransport extends Base {
  /** Both sides call this with the same code. The one who asked to host announces; the other answers. */
  static host(code = makeCode()) { const t = new LoopbackTransport(code, true); return Promise.resolve(t); }
  static join(code) { const t = new LoopbackTransport(cleanCode(code), false); return Promise.resolve(t); }

  constructor(code, isHost) {
    super();
    this.code = code; this.isHost = isHost; this.id = Math.random().toString(36).slice(2);
    this.ch = new BroadcastChannel('trustme-loop-' + code);
    this.peerId = null;
    this.ch.onmessage = (e) => {
      const m = e.data;
      if (!m || m.from === this.id) return;
      if (m.k === 'hi' && this.isHost && !this.peerId) { this.peerId = m.from; this.ch.postMessage({ k: 'hi-ack', from: this.id, to: m.from }); this._up(); return; }
      if (m.k === 'hi-ack' && !this.isHost && m.to === this.id) { this.peerId = m.from; this._up(); return; }
      if (m.k === 'bye' && m.from === this.peerId) { this._down(); return; }
      if (m.k === 'd' && m.from === this.peerId) this.onmessage?.(m.d);
    };
    if (!isHost) {
      // keep knocking until the host is listening
      this._knock = setInterval(() => { if (this.peerId) clearInterval(this._knock); else this.ch.postMessage({ k: 'hi', from: this.id }); }, 200);
      this.ch.postMessage({ k: 'hi', from: this.id });
    }
  }
  _up() { clearInterval(this._knock); this.open = true; setTimeout(() => this.onopen?.(), 0); }
  _down() { if (this.open) { this.open = false; this.onclose?.(); } }
  send(msg) { if (this.open) this.ch.postMessage({ k: 'd', from: this.id, d: JSON.parse(JSON.stringify(msg)) }); }
  close() { try { this.ch.postMessage({ k: 'bye', from: this.id }); } catch { /* */ } clearInterval(this._knock); this.open = false; this.ch.close(); }
}

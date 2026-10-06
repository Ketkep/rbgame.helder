import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Mover, stepPlayer, MOVE, rayAABB } from './engine/physics.js';
import { World } from './engine/world.js';
import { HintTrail } from './engine/hint.js';
import { GameAudio } from './engine/audio.js';
import { UI } from './ui.js';
import { Narrator } from './narrator.js';
import { CAMPAIGNS, getCampaign, isLevelUnlocked } from './campaigns.js';

const FIXED = 1 / 120;
const SAVE_KEY = 'trustme.save.v2';
const OLD_SAVE_KEY = 'trustme.save.v1';
const BABY_FIRST = 25;
const BABY_EVERY = 25;
const SITE_URL = 'https://trustme.helderlabs.com';

const fmtTime = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

const defaultCs = () => ({ level: 0, deaths: 0, time: 0, baby: false, levelDeaths: [], levelTimes: [], furthest: 0, completed: false, best: null, levelBest: {}, runs: 0, runStart: 0 });

/** v1 (single campaign, flat) -> v2 (per-campaign). */
function migrateV1(v1) {
  return {
    v: 2, settings: { lowGfx: !!v1.lowGfx }, stats: { deaths: v1.deaths || 0, completions: v1.completed ? 1 : 0 },
    campaigns: {
      pilot: {
        ...defaultCs(), level: v1.level || 0, deaths: v1.deaths || 0, time: v1.time || 0, baby: !!v1.baby,
        levelDeaths: v1.levelDeaths || [], levelTimes: v1.levelTimes || [], completed: !!v1.completed,
        furthest: v1.completed ? 4 : (v1.level || 0),
      },
    },
  };
}

function loadSave() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s || s.v !== 2) {
      const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
      s = old ? migrateV1(old) : null;
    }
  } catch { s = null; }
  s = s || { v: 2 };
  s.settings ||= {}; s.stats ||= { deaths: 0, completions: 0 }; s.campaigns ||= {};
  return s;
}
function writeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage blocked: fine */ }
}

export class Game {
  constructor() {
    this.save = loadSave();
    this.canvas = document.getElementById('c');
    this.ui = new UI();
    this.audio = new GameAudio();
    this.narrator = new Narrator(this.ui, this.audio);
    this.player = new Mover();
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.keys = new Set();
    this.jumpEdge = false;
    this.sens = this.save.settings.sens ?? 1;
    if (this.save.settings.vol !== undefined) this.audio.volume = this.save.settings.vol;
    if (this.save.settings.music === false) this.audio.musicOn = false;
    this.locked = false;
    this.state = 'title'; // title | playing | paused | dead | complete | ended
    this.world = null; this.level = null; this.levelIndex = 0;
    this.campaign = CAMPAIGNS[0];
    this._loadTok = 0;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.manual = false; // tests: when true the caller drives _simulate() itself

    // run stats
    this.reset = () => {
      this.totalDeaths = 0; this.totalTime = 0; this.levelDeaths = []; this.levelTimes = [];
      this.baby = false; this.nextBabyOffer = BABY_FIRST; this.babyOfferShown = false;
      this.maxFall = 0;
    };
    this.reset();
    this.deaths = 0; this.time = 0; // this level
    this.deathSpots = [];
    this.timeSinceSpawn = 0;
    this.idleT = 0;
    this.frozen = false;
    this.lastFakeCp = null; this.fakeRevealed = false;
    this.landDip = 0; this.shake = 0; this.fovKick = 0;
    this.hintCool = 0; this.totalHints = 0; this.levelHints = 0;
    this.stepDist = 0;
    this.airMaxY = 0; this.wasGrounded = true;
    this.deadT = 0;
    this.history = [];
    this.mods = { swapStrafe: false, invertY: false, lieCounter: false, noMove: false };
    this.titleT = 0;
    this._pausedPrev = false;

    this._initRenderer();
    this._bindInput();
    this._bindUI();

    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) this.ui.showScreen('mobile');
    this._refreshHome();
    if (this.debug) window.__trust = this;

    this.last = performance.now();
    requestAnimationFrame(() => this._tick());
  }

  // =========================================================================================
  //  Setup
  // =========================================================================================
  _initRenderer() {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' }));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1500);
    this.camera.rotation.order = 'YXZ';
    const w = window.innerWidth, h = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    r.setPixelRatio(this.pixelRatio);
    r.setSize(w, h, false);
    const rt = new THREE.WebGLRenderTarget(w * this.pixelRatio, h * this.pixelRatio, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.6, 0.9);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this._resize();
    window.addEventListener('resize', () => this._resize());
    if (this.save.settings.lowGfx) this.setQuality(true, false);
  }

  /** Low graphics: no bloom/MSAA, smaller shadow map and 1x pixel ratio. Persisted. */
  setQuality(low, persist = true) {
    this.lowGfx = !!low;
    this.pixelRatio = low ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.bloom.enabled = !low;
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) { rt.samples = low ? 0 : 4; rt.dispose(); }
    this._applyShadowQuality(this.world);
    this.renderer.setPixelRatio(this.pixelRatio);
    this._resize();
    const cb = this.ui.el['set-gfx'];
    if (cb) cb.checked = !!low;
    if (persist) this._saveSettings();
  }

  /** Smaller shadow maps in low-graphics mode (sun + any shadow-casting spotlights, e.g. the hotel's). */
  _applyShadowQuality(world) {
    if (!world) return;
    const size = this.lowGfx ? 1024 : 2048;
    world.scene.traverse((o) => {
      if ((o.isDirectionalLight || o.isSpotLight) && o.castShadow) { o.shadow.mapSize.set(size, size); o.shadow.map?.dispose(); o.shadow.map = null; }
    });
  }

  _fpsWatch(dt) {
    if (this.state !== 'playing' || this.lowGfx || this.fpsHinted) return;
    this._fpsAcc = (this._fpsAcc || 0) + dt; this._fpsN = (this._fpsN || 0) + 1;
    if (this._fpsAcc > 4) {
      const fps = this._fpsN / this._fpsAcc;
      this._fpsAcc = 0; this._fpsN = 0;
      if (fps < 28 && dt > 0) { this.fpsHinted = true; this.ui.toast('Running slow? Turn on “Low graphics” in the pause menu.', ''); }
    }
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (this.modal) { if (!e.repeat || e.code === 'Backspace') this.modal.key(e); e.preventDefault(); return; }   // a puzzle panel (keypad…) has the keyboard
      if (e.repeat) return;
      this.keys.add(e.code);
      this.idleT = 0;
      this.ui.markKey(e.code, true);
      if (e.code === 'Space') this.jumpEdge = true;
      if (e.code === 'KeyM') { this.audio.init(); this.ui.toast(this.audio.toggleMute() ? 'Muted' : 'Unmuted'); }
      if (this.state === 'playing') {
        if (e.code === 'KeyE') this.useFocus();
        if (e.code === 'KeyH') this.useHint();
        if (e.code === 'KeyR') this.manualReset();
        if (e.code === 'KeyB') this.acceptBaby();
      }
      if (e.code === 'Escape') {
        if (this.ui.screens.levels.classList.contains('show')) this.ui.showScreen('home');
        else if (this.ui.screens.settings.classList.contains('show')) this.closeSettings();
      }
      if (e.code === 'Enter' && this.state === 'complete') this._next();
      if (e.code === 'Enter' && this.state === 'paused') this.resume();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.ui.markKey(e.code, false); });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || this.frozen) return;
      if (!this.locked && !this.debug) return;
      const s = 0.0022 * this.sens;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s * (this.mods.invertY ? -1 : 1);
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      if (e.movementX || e.movementY) this.idleT = 0;
    });
    document.addEventListener('mousedown', (e) => { if (e.button === 0 && this.locked && this.state === 'playing') this.useFocus(); });
    // ?debug has no automatic pointer lock (the test harness drives the game), so let a human click to capture the mouse
    if (this.debug) this.canvas.addEventListener('click', () => { try { this.canvas.requestPointerLock(); } catch { /* ignore */ } });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.state === 'playing' && !this.debug) this.pause();
    });
    document.addEventListener('pointerlockerror', () => {
      if (this.state === 'playing') { this.state = 'paused'; this.ui.showScreen('click'); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._title = document.title;
        document.title = ['Hey. Come back. 🥺', 'I can see you switched tabs.', 'Where are you going?!'][Math.floor(Math.random() * 3)];
        if (this.state === 'playing' && !this.debug) this.pause();
      } else document.title = 'Trust Me…';
    });
  }

  _bindUI() {
    const { el } = this.ui;
    el['btn-resume'].addEventListener('click', () => this.resume());
    el['btn-restart'].addEventListener('click', () => { this.audio.click(); this.restartLevel(); });
    el['btn-mercy'].addEventListener('click', () => this.begForMercy());
    el['btn-quit'].addEventListener('click', () => { this.audio.click(); this.toHome(); });
    el['btn-next'].addEventListener('click', () => this._next());
    el['btn-lobby'].addEventListener('click', () => { this.audio.click(); this.backToLobby(); });
    el['btn-lobby-pause'].addEventListener('click', () => { this.audio.click(); this.backToLobby(); });
    el['btn-again'].addEventListener('click', () => { this.audio.click(); this.newGame(0, this.campaign.id); });
    el['btn-home'].addEventListener('click', () => { this.audio.click(); this.toHome(); });
    el['btn-share'].addEventListener('click', () => this._copyShare());
    this.ui.screens.click.addEventListener('click', () => this.resume());

    // settings (reachable from the home page and the pause menu)
    el['btn-settings-home'].addEventListener('click', () => { this.audio.init(); this.audio.click(); this.openSettings('home'); });
    el['btn-settings'].addEventListener('click', () => { this.audio.click(); this.openSettings('pause'); });
    el['btn-settings-back'].addEventListener('click', () => { this.audio.click(); this.closeSettings(); });
    el['btn-levels-back'].addEventListener('click', () => { this.audio.click(); this.ui.showScreen('home'); });
    el['set-sens'].value = this.sens;
    el['set-vol'].value = this.audio.volume;
    el['set-music'].checked = this.audio.musicOn;
    el['set-gfx'].checked = !!this.save.settings.lowGfx;
    el['set-sens'].addEventListener('input', (e) => { this.sens = +e.target.value; this._saveSettings(); });
    el['set-vol'].addEventListener('input', (e) => { this.audio.setVolume(+e.target.value); this._saveSettings(); });
    el['set-music'].addEventListener('change', (e) => { this.audio.setMusicEnabled(e.target.checked); this._saveSettings(); });
    el['set-gfx'].addEventListener('change', (e) => this.setQuality(e.target.checked));
    let armed = null;
    el['btn-reset'].addEventListener('click', () => {
      if (!armed) {
        el['btn-reset'].textContent = 'Click again to erase all progress';
        armed = setTimeout(() => { armed = null; el['btn-reset'].textContent = 'Reset all progress'; }, 4000);
        return;
      }
      clearTimeout(armed); armed = null;
      this.save = { v: 2, settings: this.save.settings, stats: { deaths: 0, completions: 0 }, campaigns: {} };
      writeSave(this.save);
      el['btn-reset'].textContent = 'Progress erased';
      setTimeout(() => { el['btn-reset'].textContent = 'Reset all progress'; }, 1800);
      this._refreshHome();
    });
  }

  _saveSettings() {
    this.save.settings = { ...this.save.settings, sens: this.sens, vol: this.audio.volume, music: this.audio.musicOn, lowGfx: !!this.lowGfx };
    writeSave(this.save);
  }

  openSettings(from) { this.settingsFrom = from; this.ui.showScreen('settings'); }
  closeSettings() { this.ui.showScreen(this.settingsFrom || 'home'); }

  // =========================================================================================
  //  Home page (campaign hub)
  // =========================================================================================
  get levels() { return this.campaign.levels; }

  /** Per-campaign save record (created on demand). */
  cs(id = this.campaign.id) {
    this.save.campaigns[id] ||= defaultCs();
    return this.save.campaigns[id];
  }

  _homeQuip() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const c = this.cs('pilot'), st = this.save.stats;
    if (c.runs > 0 && !c.level) return pick(['You beat the show. I\'m not mad. I\'m just recalculating.', 'Back to rub it in? Fine. Welcome back, champion.']);
    if (c.level > 0 || c.deaths > 0) return pick([`Back already? Level ${c.level + 1} missed you. So did your ${c.deaths} deaths.`, 'Oh good, you\'re back. I was just rehearsing my lies.']);
    if (st.deaths > 0) return pick(['Welcome back. I\'ve redecorated. Nothing has changed.', 'A game show where you can trust me completely.']);
    return 'A game show where you can trust me completely.';
  }

  _refreshHome() {
    const { el } = this.ui;
    el['campaigns'].innerHTML = '';
    for (const c of CAMPAIGNS) el['campaigns'].appendChild(this._campaignCard(c));
    const st = this.save.stats;
    el['home-stats'].textContent = st.deaths
      ? `☠ ${st.deaths} lifetime death${st.deaths === 1 ? '' : 's'}${st.completions ? ` · ✔ ${st.completions} campaign${st.completions === 1 ? '' : 's'} cleared` : ''}`
      : '';
    el['home-tag'].textContent = this._homeQuip();
  }

  _campaignCard(c) {
    const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const card = mk('article', 'card ' + (c.status === 'playable' ? 'playable' : 'soon'));
    card.appendChild(mk('p', 'eyebrow', `CAMPAIGN ${c.number}`));
    card.appendChild(mk('h3', '', c.title));
    card.appendChild(mk('p', 'blurb', c.tagline));
    if (c.status !== 'playable') {
      card.appendChild(mk('div', 'soon-badge', '🔒 Coming soon'));
      return card;
    }
    const cs = this.cs(c.id);
    const hub = !!c.hub;
    const pips = mk('div', 'pips' + (hub ? ' grouped' : ''));
    c.levels.forEach((lv, i) => {
      const done = !!cs.levelBest[i];
      const open = isLevelUnlocked(c, cs, i, this.debug);
      const pip = mk('span', 'pip ' + (done ? 'done' : lv.placeholder ? 'planned' : open ? 'open' : 'locked'));
      pip.title = `${i + 1}. ${lv.name}${lv.placeholder ? ' (under renovation)' : ''}`;
      pips.appendChild(pip);
    });
    card.appendChild(pips);
    const btns = mk('div', 'card-btns');
    if (hub) {
      const cleared = c.levels.filter((_, i) => cs.levelBest[i]).length, ready = c.levels.filter((l) => !l.placeholder).length;
      card.appendChild(mk('p', 'card-stats', cleared ? `${cleared}/${c.levels.length} cleared · ☠ ${cs.deaths}` : `Opening floor by floor · ${ready}/${c.levels.length} levels ready`));
      const enter = mk('button', 'btn primary', cleared || cs.deaths ? 'Back to the lobby' : 'Enter the hotel');
      enter.addEventListener('click', () => { this.audio.init(); this.audio.click(); this.enterHub(c.id); });
      btns.appendChild(enter);
      card.appendChild(btns);
      return card;
    }
    const inProgress = cs.level > 0 || cs.deaths > 0 || cs.time > 0;
    let line;
    if (inProgress) line = `In progress: Level ${cs.level + 1} · ☠ ${cs.deaths}`;
    else if (cs.best) line = `Best run: ☠ ${cs.best.deaths} · ⏱ ${fmtTime(cs.best.time)}`;
    else line = `${c.levels.length} levels · ${c.eta}`;
    card.appendChild(mk('p', 'card-stats', line));
    const play = mk('button', 'btn primary', inProgress ? 'Continue' : cs.completed ? 'Play again' : 'Play');
    play.addEventListener('click', () => { this.audio.init(); this.audio.click(); inProgress ? this.continueGame(c.id) : this.newGame(0, c.id); });
    const lv = mk('button', 'btn ghost', 'Levels');
    lv.addEventListener('click', () => { this.audio.init(); this.audio.click(); this.openLevels(c.id); });
    btns.append(play, lv);
    card.appendChild(btns);
    return card;
  }

  openLevels(id) {
    const c = getCampaign(id), cs = this.cs(id), { el } = this.ui;
    el['levels-eyebrow'].textContent = `CAMPAIGN ${c.number}`;
    el['levels-title'].textContent = c.title;
    el['levels-grid'].innerHTML = '';
    c.levels.forEach((lv, i) => {
      const unlocked = isLevelUnlocked(c, cs, i, this.debug);
      const best = cs.levelBest[i];
      const t = document.createElement('button');
      t.className = 'tile ' + (best ? 'done' : unlocked ? 'open' : 'locked');
      t.disabled = !unlocked;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = unlocked ? (best ? '✔' : i + 1) : '🔒';
      const b = document.createElement('b'); b.textContent = unlocked ? lv.name : '???';
      const sm = document.createElement('small'); sm.textContent = best ? `best ☠ ${best.deaths} · ⏱ ${fmtTime(best.time)}` : unlocked ? 'not cleared' : 'locked';
      t.append(n, b, sm);
      if (unlocked) t.addEventListener('click', () => { this.audio.init(); this.audio.click(); this.newGame(i, id); });
      el['levels-grid'].appendChild(t);
    });
    this.ui.showScreen('levels');
  }

  // =========================================================================================
  //  Flow
  // =========================================================================================
  /** Start a fresh run of a campaign from `startLevel`. Returns false if superseded by another load. */
  async newGame(startLevel = 0, campaignId = this.campaign.id) {
    this.campaign = getCampaign(campaignId);
    this.reset();
    this.runStart = startLevel;
    Object.assign(this.cs(), { level: startLevel, deaths: 0, time: 0, baby: false, levelDeaths: [], levelTimes: [], runStart: startLevel });
    writeSave(this.save);
    if (!(await this.loadLevel(startLevel))) return false;
    this._begin();
    return true;
  }
  async continueGame(campaignId = this.campaign.id) {
    this.campaign = getCampaign(campaignId);
    const s = this.cs();
    this.reset();
    this.runStart = s.runStart || 0;
    this.totalDeaths = s.deaths || 0; this.totalTime = s.time || 0; this.baby = !!s.baby;
    this.nextBabyOffer = (Math.floor(this.totalDeaths / BABY_EVERY) + 1) * BABY_EVERY;
    this.levelDeaths = s.levelDeaths || []; this.levelTimes = s.levelTimes || [];
    if (!(await this.loadLevel(s.level || 0))) return false;
    this._begin();
    return true;
  }

  /** Hub campaigns: walk into the lobby. `arrivalTier` puts you at that floor's elevator (coming back from a level). */
  async enterHub(campaignId = this.campaign.id, arrivalTier = null) {
    this.campaign = getCampaign(campaignId);
    const cs = this.cs();
    this.reset();
    this.runStart = 0;
    this.totalDeaths = cs.deaths || 0; this.totalTime = cs.time || 0; this.baby = !!cs.baby;
    this.nextBabyOffer = (Math.floor(this.totalDeaths / BABY_EVERY) + 1) * BABY_EVERY;
    this.levelDeaths = cs.levelDeaths || []; this.levelTimes = cs.levelTimes || [];
    this.hubArrival = arrivalTier;
    if (!(await this._loadLevelObj(this.campaign.hub, -1))) return false;
    this._begin();
    return true;
  }

  /** From the lobby's elevators. Placeholder ("under renovation") levels refuse politely. */
  async enterLevel(i) {
    const lv = this.campaign.levels[i];
    if (!lv || lv.placeholder) return false;
    if (!(await this.loadLevel(i))) return false;
    this._begin();
    return true;
  }

  /** Is level `i` of the current campaign playable? (hub elevators and level select ask this) */
  isUnlocked(i) { return isLevelUnlocked(this.campaign, this.cs(), i, this.debug); }

  async backToLobby() {
    this.ui.hideScreens();
    const tier = this.levelIndex >= 0 ? this.level?.tier ?? null : this.hubArrival;
    return this.enterHub(this.campaign.id, tier);
  }

  _begin() {
    this.ui.hideScreens();
    this.ui.hud(true);
    this.ui.setBaby(this.baby);
    this.ui.setDeaths(this._deathText());
    this._chipLabel = null;
    this.state = 'playing';
    this._lock();
    this.ui.fade(true, 0);
    requestAnimationFrame(() => this.ui.fade(false, 800));
    if (this.levelIndex >= 0) {
      const c = this.cs();
      c.furthest = Math.max(c.furthest || 0, this.levelIndex);
      writeSave(this.save);
    }
    this.level.onStart?.(this.world, this);
  }

  /** Builds a level. Resolves false if a newer loadLevel call superseded this one. */
  async loadLevel(i) {
    const levels = this.campaign.levels;
    const idx = Math.max(0, Math.min(levels.length - 1, i));
    return this._loadLevelObj(levels[idx], idx);
  }

  /** `idx` is the level's index in the campaign, or -1 for a campaign hub. */
  async _loadLevelObj(level, idx) {
    this.closeModal();
    const tok = ++this._loadTok;
    this.levelIndex = idx;
    this.level = level;
    this.inHub = idx < 0;
    if (document.fonts?.load) {
      try { await Promise.all([document.fonts.load('400 48px "Archivo Black"'), document.fonts.load('600 24px "Inter Variable"')]); } catch { /* fall back to system fonts */ }
    }
    if (tok !== this._loadTok) return false;
    const old = this.world;
    const w = (this.world = new World(this));
    w.hooks = {};
    if (old) { try { old.dispose(); } catch { /* best effort */ } this.renderer.renderLists.dispose(); }
    level.build(w, this);
    this.renderPass.scene = w.scene;
    if (this.lowGfx) this._applyShadowQuality(w);
    this.focus = null;
    const env = w.envCfg;
    this.renderer.toneMappingExposure = env.exposure;
    this.bloom.strength = env.bloom.strength; this.bloom.radius = env.bloom.radius; this.bloom.threshold = env.bloom.threshold;
    document.body.classList.toggle('theme-glitch', !!level.glitchTheme);
    this.deaths = 0; this.time = 0; this.timeSinceSpawn = 0;
    this.hintCool = 0; this.levelHints = 0;
    this.deathSpots = [];
    this.lastFakeCp = null; this.fakeRevealed = false; this.fakeReveals = 0;
    this.mods = { swapStrafe: false, invertY: false, lieCounter: false, noMove: false };
    this.frozen = false;
    this.history.length = 0;
    this.respawnPlayer(true);
    this.ui.setLevelChip(idx < 0 ? `${this.campaign.title} · ${level.name}` : `Level ${idx + 1} · ${level.name}`);
    this.ui.setHubMode(idx < 0);
    this.ui.setInteract(null);
    this.ui.setDeaths(this._deathText());
    this.ui.setTimer(0);
    this.ui.setAltimeter(false); this.ui.setPing(false); this.ui.loading(false); this.ui.ad(false); this.ui.bars(false); this.ui.glitch(false); this.ui.creditsStop();
    this.ui.promptClear(); this.ui.babyOffer(false);
    this.narrator.clear();
    this.audio.playMusic(level.music || 'l1');
    this.audio.setWind(0);
    this.last = performance.now();
    return true;
  }

  _lock() {
    if (this.debug) return;
    try { const p = this.canvas.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch { /* handled by pointerlockerror */ }
  }

  closeModal() { this.modal?.close(); this.modal = null; }

  pause() {
    if (this.state !== 'playing') return;
    this.closeModal();
    this.state = 'paused';
    this.ui.showScreen('pause');
    this.ui.el['btn-restart'].classList.toggle('hidden', this.levelIndex < 0);
    this.ui.el['btn-lobby-pause'].classList.toggle('hidden', !(this.campaign.hub && this.levelIndex >= 0));
    this.ui.el['pause-quip'].textContent = '';
    if (this.level.pauseTroll) this.level.pauseTroll(this);
    else {
      const { text } = this.narrator.resolve('pause');
      this.ui.el['pause-quip'].textContent = '“' + text + '”';
    }
    this.keys.clear();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.init(); this.audio.click();
    const rb = this.ui.el['btn-resume'];
    if (rb._h) { rb.removeEventListener('mouseenter', rb._h); rb._h = null; }
    rb.style.transform = '';
    this.ui.hideScreens();
    this.state = 'playing';
    this._lock();
    this.last = performance.now();
    this.narrator.say('resume', { priority: 0 });
  }

  toHome() {
    document.exitPointerLock?.();
    this.state = 'title';
    this.ui.hud(false);
    this.narrator.clear();
    this.ui.promptClear();
    this.ui.setAltimeter(false); this.ui.ad(false); this.ui.loading(false); this.ui.bars(false); this.ui.glitch(false); this.ui.creditsStop();
    this.campaign = CAMPAIGNS[0]; // the home screen's live backdrop is always campaign 1, level 1
    this._refreshHome();
    this.ui.showScreen('home');
    this.audio.playMusic('title');
    this.loadLevel(0).then((ok) => { if (ok) { this.state = 'title'; this.ui.hud(false); } });
  }

  async restartLevel() {
    this.ui.hideScreens();
    this.totalDeaths -= this.deaths; this.totalTime -= this.time; // restarting a level doesn't double-count it
    await this.loadLevel(this.levelIndex);
    this.state = 'playing'; this.ui.hud(true); this._lock();
    this.level.onStart?.(this.world, this);
    this.ui.setDeaths(this._deathText());
  }

  begForMercy() {
    this.audio.click();
    if (this.baby) { this.narrator.say('baby.already', { priority: 2 }); this.ui.el['pause-quip'].textContent = '“' + this.narrator.cur?.text + '”'; return; }
    if (this.totalDeaths < BABY_FIRST) {
      this.narrator.say('baby.early', { priority: 2, vars: { n: BABY_FIRST } });
      this.ui.el['pause-quip'].textContent = `“Beg for mercy? You've barely died! Come back at ${BABY_FIRST} deaths and we'll talk.”`;
    } else this.acceptBaby(true);
  }

  acceptBaby(force = false) {
    if (this.baby) return;
    if (!force && !this.babyOfferShown) return;
    this.baby = true; this.babyOfferShown = false;
    this.ui.setBaby(true); this.ui.babyOffer(false);
    this.audio.confirm();
    this.narrator.say('baby.accepted', { priority: 2 });
    this.ui.toast('👶 Baby Mode on', 'gold');
    this.ui.achievement('Beg for mercy', 'Mercy granted. Judgement not included.');
    this.persist();
  }

  _deathText() {
    if (this.mods.lieCounter) {
      const lies = [-3, 0, 7, 404, 'NaN', 1, 99, '∞', 2];
      return String(lies[Math.floor(Math.random() * lies.length)]);
    }
    return String(this.deaths);
  }

  persist() {
    const c = this.cs();
    Object.assign(c, { deaths: this.totalDeaths, time: this.totalTime, baby: this.baby, levelDeaths: this.levelDeaths, levelTimes: this.levelTimes });
    if (!this.campaign.hub) c.level = this.levelIndex;
    writeSave(this.save);
  }

  // =========================================================================================
  //  Player / respawn / death
  // =========================================================================================
  respawnPlayer(initial = false) {
    const r = this.world.respawn;
    this.player.teleport(r.x, r.y + 0.001, r.z);
    this.yaw = r.yaw || 0; this.pitch = initial ? -0.05 : 0;
    this.jumpEdge = false;
    this.timeSinceSpawn = 0;
    this.history.length = 0;
    this.airMaxY = r.y; this.wasGrounded = true;
    this.landDip = 0;
    this.frozen = false;
    this.mods.swapStrafe = false; this.mods.invertY = false; this.mods.noMove = false;
    if (!initial) this.world.onPlayerRespawn();
  }

  manualReset() {
    if (this.state !== 'playing' || this.frozen) return;
    this.ui.flash();
    this.narrator.say('manualReset', { priority: 0 });
    this._doRespawn(false);
  }

  _doRespawn(count) {
    void count;
    this.respawnPlayer(false);
  }

  /** reason: 'fall' | 'hazard' | 'void' | custom string */
  kill(reason = 'fall') {
    if (this.state !== 'playing') return;
    this.closeModal();
    this.state = 'dead';
    this.deadT = 0;
    this.deaths++; this.totalDeaths++; this.save.stats.deaths++;
    this.ui.setDeaths(this._deathText(), true);
    this.world.hintTrail?.hide();
    this.ui.flash();
    this.ui.stamp(['WRONG!', 'NOPE', 'OOF', 'SPLAT', 'BZZT', 'NEXT!', 'OUT'][Math.floor(Math.random() * 7)]);
    this.audio.death();
    this.shake = 0.35;
    const p = this.player;
    this.deathSpots.push({ x: p.x, y: p.y, z: p.z });
    this._deathDirector(reason);
    this.persist();
  }

  _deathDirector(reason) {
    const n = this.totalDeaths, nar = this.narrator;
    const p = this.player;
    let spoke = false;
    // level-specific commentary first (e.g. fake checkpoint reveal)
    if (this.world.hooks.onDeath?.({ reason, deaths: this.deaths, total: n })) spoke = true;
    if (!spoke && this.lastFakeCp && !this.fakeRevealed && !this.baby) {
      this.fakeRevealed = true; spoke = true;
      this.fakeReveals = (this.fakeReveals || 0) + 1;
      nar.say(this.fakeReveals === 1 ? 'l2.cp.fake.reveal' : 'l2.cp.fake.reveal2', { priority: 2 });
    }
    // baby mode offer
    if (!spoke && !this.baby && n >= this.nextBabyOffer) {
      spoke = true;
      nar.say(this.babyOfferShown ? 'baby.offer.again' : 'baby.offer', { priority: 2, vars: { n } });
      this.babyOfferShown = true; this.nextBabyOffer += BABY_EVERY;
      this.ui.babyOffer(true);
      setTimeout(() => this.ui.babyOffer(false), 18000);
    }
    if (!spoke && [10, 25, 50, 100, 200].includes(n)) { spoke = true; nar.say('death.milestone.' + n, { priority: 2 }); }
    if (!spoke && n === 1) { spoke = true; nar.say('death.first', { priority: 1 }); }
    if (!spoke) {
      const near = this.deathSpots.filter((s) => Math.hypot(s.x - p.x, s.z - p.z) < 6 && Math.abs(s.y - p.y) < 6).length;
      if (near >= 3 && Math.random() < 0.8) nar.say('death.sameSpot', { priority: 1, vars: { n: near } });
      else if (reason === 'hazard' && Math.random() < 0.6) nar.say('death.hazard', { priority: 1 });
      else if (this.timeSinceSpawn < 3.5 && Math.random() < 0.4) nar.say('death.streak', { priority: 1 });
      else if (Math.random() < 0.55) nar.say('death.generic', { priority: 1 });
    }
  }

  onCheckpoint(cp) {
    const w = this.world;
    this.audio.checkpoint();
    this.ui.toast('✔ Checkpoint saved', 'gold');
    if (cp.real || this.baby) {
      w.respawn = { x: cp.x, y: cp.y, z: cp.z, yaw: this.yaw };
      if (!cp.real && this.baby) this.narrator.say('baby.on.fakecp', { priority: 1 });
    } else {
      this.lastFakeCp = cp; this.fakeRevealed = false;
    }
    w.hooks.onCheckpoint?.(cp);
  }

  completeLevel() {
    if (this.state !== 'playing' || this.world.completed) return;
    const levels = this.levels, hubCamp = !!this.campaign.hub;
    this.world.completed = true;
    this.levelDeaths[this.levelIndex] = this.deaths;
    this.levelTimes[this.levelIndex] = this.time;
    this.audio.levelComplete();
    this.world.burst(new THREE.Vector3(this.player.x, this.player.y + 1.5, this.player.z), 0xffc83d, 70, 7);
    this.state = 'complete';
    const nextIdx = this.levelIndex + 1;
    const c = this.cs();
    const lb = (c.levelBest[this.levelIndex] ||= { deaths: this.deaths, time: this.time });
    lb.deaths = Math.min(lb.deaths, this.deaths); lb.time = Math.min(lb.time, this.time);
    // a hub campaign is finished when every one of its levels has been cleared; others when you beat the last one
    const last = hubCamp ? levels.every((l, i) => c.levelBest[i]) : this.levelIndex === levels.length - 1;
    c.furthest = Math.max(c.furthest || 0, last ? this.levelIndex : nextIdx);
    if (last) {
      c.completed = true; c.runs = (c.runs || 0) + 1;
      this.save.stats.completions++;
      const run = { deaths: this.totalDeaths, time: this.totalTime };
      if (this.runStart === 0 && (!c.best || run.deaths < c.best.deaths || (run.deaths === c.best.deaths && run.time < c.best.time))) c.best = run;
    }
    if (hubCamp) Object.assign(c, { deaths: this.totalDeaths, time: this.totalTime, baby: this.baby, levelDeaths: this.levelDeaths, levelTimes: this.levelTimes });
    else Object.assign(c, {
      level: last ? 0 : nextIdx, deaths: last ? 0 : this.totalDeaths, time: last ? 0 : this.totalTime,
      baby: this.baby, levelDeaths: this.levelDeaths, levelTimes: this.levelTimes,
    });
    writeSave(this.save);
    const customQuip = this.world.hooks.onComplete?.();
    if (customQuip) this.narrator.say(customQuip, { priority: 2 });
    setTimeout(() => {
      if (this.state !== 'complete') return;
      document.exitPointerLock?.();
      this.ui.promptClear(); this.ui.babyOffer(false); this.ui.ad(false); this.ui.loading(false); this.ui.creditsStop(); this.ui.bars(false);
      if (last) return this._showEnd();
      const e = this.ui.el;
      e['cmp-title'].textContent = this.level.name;
      e['cmp-deaths'].textContent = this.deaths; e['cmp-time'].textContent = fmtTime(this.time); e['cmp-total'].textContent = this.totalDeaths;
      e['cmp-quip'].textContent = this.level.completeQuip ? '“' + this.level.completeQuip + '”' : '';
      const nextLv = levels[nextIdx];
      const hasNext = !!nextLv && !(hubCamp && nextLv.placeholder);
      e['btn-next'].classList.toggle('hidden', !hasNext);
      if (hasNext) e['btn-next'].textContent = `Level ${nextIdx + 1}: ${nextLv.name}`;
      e['btn-lobby'].classList.toggle('hidden', !hubCamp);
      e['cmp-eyebrow'].textContent = hubCamp ? `LEVEL ${this.levelIndex + 1} COMPLETE` : 'LEVEL COMPLETE';
      this.ui.showScreen('complete');
    }, last ? 2600 : 2200);
  }

  async _next() {
    if (this.state !== 'complete' || !this.ui.screens.complete.classList.contains('show')) return;
    this.audio.click();
    this.ui.hideScreens();
    const next = this.levels[this.levelIndex + 1];
    if (this.campaign.hub && (!next || next.placeholder)) return this.backToLobby();
    await this.loadLevel(this.levelIndex + 1);
    this._begin();
  }

  _showEnd() {
    this.state = 'ended';
    this.audio.playMusic('title');
    const e = this.ui.el;
    e['end-deaths'].textContent = this.totalDeaths;
    e['end-time'].textContent = fmtTime(this.totalTime);
    e['end-baby'].textContent = this.baby ? 'Yes 👶' : 'No';
    e['end-title'].textContent = this.totalDeaths === 0 ? 'Zero deaths?! Cheater.' : this.baby ? 'You trusted no one. (After some help.)' : 'You trusted no one. You win.';
    e['end-share'].textContent = this._shareText();
    e['end-eyebrow'].textContent = `CAMPAIGN ${this.campaign.number} COMPLETE`;
    e['end-next'].textContent = this.campaign.after || '';
    this.ui.hud(false);
    this.ui.showScreen('end');
  }

  _shareText() {
    const per = this.levelDeaths.map((d, i) => `L${i + 1}:${d ?? 0}`).join(' ');
    return [
      `TRUST ME… 🎙️ · Campaign ${this.campaign.number}: ${this.campaign.title}`,
      this.baby ? 'I trusted no one (with training wheels 👶).' : 'I trusted no one.',
      `☠ ${this.totalDeaths} deaths · ⏱ ${fmtTime(this.totalTime)}${this.totalHints ? ` · 💡 ${this.totalHints} hints` : ''}`,
      per,
      `Think you can do better? ${SITE_URL}`,
    ].join('\n');
  }

  async _copyShare() {
    this.audio.click();
    const text = this._shareText();
    try { await navigator.clipboard.writeText(text); this.ui.el['btn-share'].textContent = 'Copied!'; }
    catch { this.ui.el['btn-share'].textContent = 'Select & copy above'; }
    setTimeout(() => { this.ui.el['btn-share'].textContent = 'Copy result'; }, 1800);
  }

  // =========================================================================================
  //  Troll helpers used by levels
  // =========================================================================================
  /** Freeze the simulation for a few seconds (used for the fake "technical difficulties"). */
  freeze(sec, done) {
    this.frozen = true;
    setTimeout(() => { this.frozen = false; this.last = performance.now(); done?.(); }, sec * 1000);
  }
  /** Teleport the player back to where they were `sec` seconds ago (fake lag). */
  rewind(sec) {
    if (!this.history.length) return;
    const tNow = this.history[this.history.length - 1].t;
    let i = 0;
    for (; i < this.history.length; i++) if (this.history[i].t >= tNow - sec) break;
    i = Math.min(i, this.history.length - 1);
    // never rewind into mid-air: walk back to the last moment we were standing on something
    let j = i;
    while (j > 0 && !this.history[j].g) j--;
    const h = this.history[this.history[j].g ? j : i];
    const p = this.player;
    p.x = h.x; p.y = h.y; p.z = h.z; p.vx = 0; p.vy = 0; p.vz = 0;
    this.shake = 0.2;
    this.audio.glitch();
    this.ui.glitch(true);
    setTimeout(() => this.ui.glitch(false), 260);
  }
  say(key, opts) { this.narrator.say(key, opts); }
  toast(t, k) { this.ui.toast(t, k); }

  // =========================================================================================
  //  Main loop
  // =========================================================================================
  _wish() {
    const k = this.keys;
    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let str = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (this.mods.swapStrafe) str = -str;
    if (this.mods.noMove || this.modal) { fwd = 0; str = 0; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
    const l = Math.hypot(wx, wz);
    if (l > 1) { wx /= l; wz /= l; }
    return { wx, wz, any: fwd !== 0 || str !== 0 };
  }

  _simulate(dt) {
    const w = this.world, p = this.player;
    this.time += dt; this.totalTime += dt; this.timeSinceSpawn += dt;
    const wish = this._wish();
    if (wish.any) this.idleT = 0; else this.idleT += dt;
    if (this.idleT > 22) { this.idleT = 0; this.narrator.say('idle', { priority: 0 }); }

    const jumpHeld = this.keys.has('Space');
    let edge = this.jumpEdge; this.jumpEdge = false;
    const opts = {
      jumpMul: this.baby ? 1.07 : 1,
      coyoteExtra: this.baby ? 0.12 : 0,
      accelX: w.extraAccel.x, accelZ: w.extraAccel.z, stepHeight: w.stepHeight,
    };
    const n = Math.max(1, Math.ceil(dt / FIXED)), h = dt / n;
    let landed = 0, jumped = false;
    for (let i = 0; i < n; i++) {
      w.step(h);
      stepPlayer(p, w.bodies, { wx: wish.wx, wz: wish.wz, jumpPressed: edge, jumpHeld }, h, opts);
      edge = false;
      for (const b of w.bodies) if (b.dx !== 0 || b.dy !== 0 || b.dz !== 0) b.clearDelta();
      if (p.justLanded) landed = Math.max(landed, p.justLanded);
      if (p.justJumped) jumped = true;
    }

    // air tracking (fall distance)
    if (p.grounded) {
      if (!this.wasGrounded) {
        const fall = this.airMaxY - p.y;
        w.hooks.onLand?.({ fall, impact: landed });
        if (fall > this.maxFall) this.maxFall = fall;
      }
      this.airMaxY = p.y;
    } else this.airMaxY = Math.max(this.airMaxY, p.y);
    this.wasGrounded = p.grounded;

    if (jumped) { this.audio.jump(); this.fovKick = 1.4; }
    if (landed) {
      this.audio.land(landed);
      this.landDip = Math.min(0.22, 0.03 + landed * 0.006);
    }
    if (p.grounded) {
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 2) { this.stepDist += sp * dt; if (this.stepDist > 2.3) { this.stepDist = 0; this.audio.step(); } } else this.stepDist = 0.9;
    }

    // history for fake lag
    this.history.push({ t: this.time, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, g: p.grounded });
    while (this.history.length > 1 && this.history[0].t < this.time - 3) this.history.shift();

    const hit = w.resolveInteractions(p, this.baby ? 0.22 : 0.1);
    if (this.state !== 'playing') return;
    if (hit === 'hazard') this.kill('hazard');
    else if (p.y < w.killY) { this.audio.fall(); this.kill('void'); }

    // continuous audio / HUD
    this.audio.setWind(Math.max(w.windLevel || 0, (w.windAmt || 0) * 0.9));
    if (w.altimeter) this.ui.setAltimeter(true, p.y, w.altimeter.max, w.altimeter.record ?? 0);
    this._updateFocus();
    this.hintCool = Math.max(0, this.hintCool - dt);
    w.hintTrail?.update(dt);
    this._hudT = (this._hudT || 0) + dt;
    if (this._hudT > 0.05) { this._hudT = 0; this._updateHintChip(); this.ui.setTimer(this.time); if (this.mods.lieCounter && Math.random() < 0.25) this.ui.setDeaths(this._deathText()); }
  }

  // =========================================================================================
  //  Hints (H): a dotted trail toward the next thing to do. Quiz/puzzle levels can override.
  // =========================================================================================
  /** Waypoints for the default trail: where you are, then the next few path platforms (then the goal). */
  _hintPoints() {
    const w = this.world, p = this.player;
    if (w.hintFn) return w.hintFn(this);
    const path = w.plats.filter((q) => q.o.path);
    if (!path.length) return null;
    let idx = -1;
    if (p.grounded && p.ground) idx = path.findIndex((q) => q.body === p.ground);
    if (idx < 0) {
      let best = Infinity;
      path.forEach((q, i) => {
        const dx = Math.max(0, Math.abs(q.body.x - p.x) - q.body.hx), dz = Math.max(0, Math.abs(q.body.z - p.z) - q.body.hz);
        const d = Math.hypot(dx, dz) + Math.max(0, q.top - p.y) * 0.6;
        if (d < best) { best = d; idx = i; }
      });
    }
    const out = [{ x: p.x, y: p.y + 0.15, z: p.z }];
    for (let k = 1; k <= 4 && idx + k < path.length; k++) { const q = path[idx + k]; out.push({ x: q.body.x, y: q.top + 0.15, z: q.body.z }); }
    if (idx + 4 >= path.length - 1 && w.goalObj) out.push({ x: w.goalObj.x, y: w.goalObj.y + 0.15, z: w.goalObj.z });
    return out.length >= 2 ? out : null;
  }

  useHint() {
    if (this.state !== 'playing' || this.frozen || this.modal) return;
    const w = this.world;
    if (this.inHub) { this.narrator.say('hint.hub', { priority: 1 }); return; }
    if (this.hintCool > 0 && !this.debug) {
      this.ui.toast(`Hint recharging… ${Math.ceil(this.hintCool)}s`, '');
      if (!this._cdSaid || this.time - this._cdSaid > 20) { this._cdSaid = this.time; this.narrator.say('hint.cooldown', { priority: 0 }); }
      return;
    }
    let used = false;
    // a level can answer the hint itself (quiz 50/50, puzzle clues): truthy = used it; 'trail' = use the dotted line instead
    const custom = w.hintAction ? w.hintAction(this) : 'trail';
    if (custom && custom !== 'trail') used = true;
    else if (custom === 'trail') {
      const pts = this._hintPoints();
      if (!pts) { this.narrator.say('hint.none', { priority: 1 }); return; }
      w.hintTrail ||= new HintTrail(w);
      w.hintTrail.show(pts, this.baby ? 14 : 8, { flat: !!w.hintFlat });
      used = true;
    }
    if (!used) return;
    this.audio.chime();
    this.hintCool = this.baby ? 6 : 28;
    this.levelHints++; this.totalHints++;
    this.cs().hints = (this.cs().hints || 0) + 1;
    writeSave(this.save);
    if (custom === 'trail') this.narrator.say(this.totalHints % 5 === 0 ? 'hint.many' : 'hint.use', { priority: 1 });
  }

  _updateHintChip() {
    const chip = this.ui.el['hint-chip'];
    if (!chip) return;
    const show = !this.inHub && this.state === 'playing';
    chip.classList.toggle('hidden', !show);
    if (!show) return;
    const ready = this.hintCool <= 0;
    const label = ready ? (this.baby ? 'Hint · baby mode' : 'Hint') : `Hint in ${Math.ceil(this.hintCool)}s`;
    if (this._chipLabel !== label) { this.ui.el['hint-label'].textContent = label; this._chipLabel = label; }
    chip.classList.toggle('cool', !ready);
  }

  /** What the crosshair is on: nearest interactable in range with a clear line of sight. */
  _updateFocus() {
    const w = this.world, p = this.player;
    this.focus = null;
    if (!w.interactables.length || this.frozen) { this.ui.setInteract(null); return; }
    const cp = Math.cos(this.pitch);
    const dx = -Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = -Math.cos(this.yaw) * cp;
    const ox = p.x, oy = p.y + MOVE.eye, oz = p.z;
    let best = null, bestT = Infinity;
    for (const it of w.interactables) {
      if (it.enabled && !it.enabled(this)) continue;
      const t = rayAABB(ox, oy, oz, dx, dy, dz, it.body, it.pad);
      if (t < bestT && t <= it.range) { bestT = t; best = it; }
    }
    if (best) {
      for (const b of w.bodies) {            // is something solid in the way?
        if (!b.enabled || !b.solid) continue;
        if (rayAABB(ox, oy, oz, dx, dy, dz, b) < bestT - 0.03) { best = null; break; }
      }
    }
    this.focus = best;
    this.ui.setInteract(best ? (typeof best.label === 'function' ? best.label(this) : best.label) : null);
  }

  useFocus() {
    if (!this.focus || this.state !== 'playing' || this.frozen || this.modal) return;
    this.focus.onUse?.(this);
  }

  _tick() {
    requestAnimationFrame(() => this._tick());
    // Read the clock here rather than trusting the rAF timestamp, which can predate `this.last`
    // (set at the end of an async level load) and produce a negative dt.
    const now = performance.now();
    const dt = Math.max(0, Math.min((now - this.last) / 1000, 0.05));
    this.last = now;
    const cam = this.camera, w = this.world;
    if (!w) return;
    this._fpsWatch(dt);

    if (this.state === 'playing') {
      if (!this.frozen && !this.manual) this._simulate(dt);
    } else if (this.state === 'dead') {
      this.deadT += dt;
      if (this.deadT > 0.55 && !this._fadingOut) { this._fadingOut = true; this.ui.fade(true, 280); }
      if (this.deadT > 0.95) {
        this._fadingOut = false;
        this._doRespawn(true);
        this.ui.fade(false, 300);
        this.state = 'playing';
      }
    } else if (this.state === 'complete' || this.state === 'ended') {
      w.step(dt); // let confetti & movers keep animating
    }

    if (this.state !== 'paused') this.narrator.update(dt);
    if (!this.manual && this.ui._creditsOn && this.state === 'playing') { if (this.ui.creditsUpdate(dt)) w.hooks.onCreditsEnd?.(); }
    if (!this.manual) w.hooks.frame?.(dt, this);

    // ---- camera ----
    const p = this.player;
    if (this.state === 'title') {
      this.titleT += dt;
      const a = this.titleT * 0.08;
      const tc = this.level.titleCam || { center: [0, 2, -12], radius: 12, height: 5 };
      cam.position.set(tc.center[0] + Math.sin(a) * tc.radius, tc.center[1] + tc.height, tc.center[2] + Math.cos(a) * tc.radius);
      cam.lookAt(tc.center[0], tc.center[1] + 1, tc.center[2] - 8);
      this.fakePlayer = { x: tc.center[0], y: tc.center[1], z: tc.center[2] };
      w.frame(dt, this.fakePlayer, cam);
    } else {
      this.landDip = Math.max(0, this.landDip - dt * 1.6);
      this.fovKick = Math.max(0, this.fovKick - dt * 5);
      this.shake = Math.max(0, this.shake - dt * 1.8);
      let ey = MOVE.eye - this.landDip;
      let pitch = this.pitch, roll = 0;
      if (this.state === 'dead') {
        const k = Math.min(1, this.deadT / 0.5);
        ey -= k * 1.15; pitch = this.pitch - k * 0.5; roll = k * 0.35;
      } else {
        const side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
        this.roll += ((-side * 0.012) - this.roll) * Math.min(1, dt * 8);
        roll = this.roll;
      }
      const sk = this.shake;
      cam.position.set(p.x + (Math.random() - 0.5) * sk * 0.1, p.y + ey + (Math.random() - 0.5) * sk * 0.1, p.z);
      cam.rotation.set(pitch, this.yaw, roll, 'YXZ');
      const speed = Math.hypot(p.vx, p.vz);
      cam.fov = 72 + this.fovKick + Math.min(2.5, speed * 0.12) + (this.mods.fovWarp || 0);
      cam.updateProjectionMatrix();
      w.frame(dt, p, cam);
    }

    this.composer.render(dt);
  }
}

// Shared maze pieces for the hotel levels: random perfect mazes, merged wall runs, BFS solving, and walkers
// (NPCs that move cell to cell through the maze: a chef that hunts you, a maid on patrol).

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

/** Random perfect maze (recursive backtracker). Cell (i,j): i east, j north. */
export function generateMaze(N) {
  const east = Array.from({ length: N }, () => Array(N).fill(false));    // (i,j)–(i+1,j) open
  const north = Array.from({ length: N }, () => Array(N).fill(false));   // (i,j)–(i,j+1) open
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const stack = [[0, 0]]; seen[0][0] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nb = [];
    if (i + 1 < N && !seen[i + 1][j]) nb.push([i + 1, j]);
    if (i - 1 >= 0 && !seen[i - 1][j]) nb.push([i - 1, j]);
    if (j + 1 < N && !seen[i][j + 1]) nb.push([i, j + 1]);
    if (j - 1 >= 0 && !seen[i][j - 1]) nb.push([i, j - 1]);
    if (!nb.length) { stack.pop(); continue; }
    const [a, b] = pick(nb);
    if (a > i) east[i][j] = true; else if (a < i) east[a][j] = true; else if (b > j) north[i][j] = true; else north[i][b] = true;
    seen[a][b] = true; stack.push([a, b]);
  }
  const open = (i, j, a, b) => (a > i ? east[i][j] : a < i ? east[a][j] : b > j ? north[i][j] : north[i][b]);
  const nbrs = (i, j) => [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && open(i, j, a, b));
  return { N, east, north, nbrs, open };
}

/**
 * A random maze whose solution (cell [0,0] to [N-1,N-1]) is between `lo` and `hi` cells long, so a level's length does not swing
 * with the dice (still a brand-new maze every attempt). Falls back to the closest one it saw.
 */
export function bandMaze(N, lo = 0, hi = Infinity, tries = 600) {
  let best = null, bestD = Infinity;
  for (let k = 0; k < tries; k++) {
    const m = generateMaze(N), len = solveMaze(m, [0, 0]).length;
    if (len >= lo && len <= hi) return m;
    const d = len < lo ? lo - len : len - hi;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

/** BFS path of cells from `from` to `to` (inclusive). */
export function solveMaze(maze, from, to = [maze.N - 1, maze.N - 1]) {
  const N = maze.N, key = (c) => c[0] * N + c[1];
  const prev = new Map([[key(from), null]]);
  const q = [from];
  while (q.length) {
    const c = q.shift();
    if (c[0] === to[0] && c[1] === to[1]) break;
    for (const n of maze.nbrs(c[0], c[1])) if (!prev.has(key(n))) { prev.set(key(n), c); q.push(n); }
  }
  const out = []; let c = to;
  while (c) { out.unshift(c); c = prev.get(key(c)); }
  return out;
}

/** Geometry of a maze in the world: cell size C, wall thickness T, height WH, south-west corner (X0, Z0). +j is -z. */
export function mazeGrid({ N, C = 4.4, T = 0.8, WH = 3.6, Z0 = 8, X0 = null }) {
  const x0 = X0 ?? -(N * C) / 2;
  const g = {
    N, C, T, WH, X0: x0, Z0,
    cx: (i) => x0 + (i + 0.5) * C,
    cz: (j) => Z0 - (j + 0.5) * C,
    cellOf: (p) => [Math.floor((p.x - x0) / C), Math.floor((Z0 - p.z) / C)],
    inside: (i, j) => i >= 0 && j >= 0 && i < N && j < N,
  };
  return g;
}

/** Builds the wall runs (merged slabs). `entrance`/`exit` are the column indices of the gaps in the south/north walls; `reach` seals the room around the maze (see below). */
export function buildMazeWalls(w, maze, g, { tex = 'hedge', color = 0xffffff, roughness = 0.95, radius = 0.1, metalness = undefined, entrance = 0, exit = maze.N - 1, slab = null, reach = null } = {}) {
  const { N, C, T, WH, X0, Z0 } = g;
  const make = slab || ((x, z, ww, dd) => w.plat({ x, y: WH, z, w: ww, d: dd, h: WH, tex, color, roughness, radius, metalness }));
  for (let j = 0; j <= N; j++) {                       // horizontal lines (z = Z0 - j*C)
    const present = (ii) => (j === 0 ? ii !== entrance : j === N ? ii !== exit : !maze.north[ii][j - 1]);
    // `reach` = [x of the room's west wall, x of its east wall]: the south and north walls run on to the room's edges, so the
    // floor beside the maze is sealed off and the only way from the entrance to the exit is through the maze itself
    if (reach && (j === 0 || j === N)) {
      const xe = X0 + N * C + T / 2, xw = X0 - T / 2;
      if (xw - reach[0] > 0.05) make((reach[0] + xw) / 2, Z0 - j * C, xw - reach[0], T);
      if (reach[1] - xe > 0.05) make((xe + reach[1]) / 2, Z0 - j * C, reach[1] - xe, T);
    }
    let i = 0;
    while (i < N) {
      if (!present(i)) { i++; continue; }
      let k = i; while (k + 1 < N && present(k + 1)) k++;
      make(X0 + ((i + k + 1) * C) / 2, Z0 - j * C, (k - i + 1) * C + T, T);
      i = k + 1;
    }
  }
  for (let i = 0; i <= N; i++) {                       // vertical lines (x = X0 + i*C)
    const present = (jj) => (i === 0 || i === N ? true : !maze.east[i - 1][jj]);
    let j = 0;
    while (j < N) {
      if (!present(j)) { j++; continue; }
      let k = j; while (k + 1 < N && present(k + 1)) k++;
      make(X0 + i * C, Z0 - ((j + k + 1) * C) / 2, T, (k - j + 1) * C + T);
      j = k + 1;
    }
  }
}

export const edgeKey = (N, a, b) => `${Math.min(a[0] * N + a[1], b[0] * N + b[1])}-${Math.max(a[0] * N + a[1], b[0] * N + b[1])}`;

/**
 * An NPC that walks the maze cell-to-cell.
 *  mode 'chase': heads for the player's cell (re-plans whenever it changes).
 *  mode 'patrol': walks to a random far cell, looks around for a moment, picks another.
 * `x`, `z` are the world position; `yaw` faces the direction of travel (0 = -z, like the camera).
 */
export class Walker {
  constructor(maze, grid, { speed = 2.4, mode = 'patrol', start = [0, 0], pause = 0.8 } = {}) {
    this.maze = maze; this.grid = grid; this.speed = speed; this.mode = mode; this.pause = pause;
    this.cell = start.slice(); this.x = grid.cx(start[0]); this.z = grid.cz(start[1]);
    this.yaw = 0; this.route = []; this.wait = 0; this.target = null; this.moving = false; this.look = 0;
  }
  teleport(cell) { this.cell = cell.slice(); this.x = this.grid.cx(cell[0]); this.z = this.grid.cz(cell[1]); this.route = []; this.target = null; this.wait = 0; }
  _plan(to) { this.target = to.slice(); this.route = solveMaze(this.maze, this.cell, to).slice(1); }
  update(dt, player = null) {
    const g = this.grid;
    if (this.wait > 0) { this.wait -= dt; this.moving = false; this.yaw += Math.sin(this.look += dt * 2.2) * dt * 1.4; return; }
    if (this.mode === 'chase' && player) {
      let [pi, pj] = g.cellOf(player);
      pi = Math.max(0, Math.min(g.N - 1, pi)); pj = Math.max(0, Math.min(g.N - 1, pj));
      if (!this.target || this.target[0] !== pi || this.target[1] !== pj) this._plan([pi, pj]);
    } else if (this.mode === 'patrol' && !this.route.length) {
      let t; do { t = [rnd(g.N), rnd(g.N)]; } while (Math.abs(t[0] - this.cell[0]) + Math.abs(t[1] - this.cell[1]) < 3);
      this._plan(t);
    }
    if (!this.route.length) { this.moving = false; return; }
    const nxt = this.route[0], tx = g.cx(nxt[0]), tz = g.cz(nxt[1]);
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (d <= step) {
      this.x = tx; this.z = tz; this.cell = nxt; this.route.shift();
      if (this.mode === 'patrol' && !this.route.length) this.wait = this.pause + Math.random() * this.pause;
    } else { this.x += (dx / d) * step; this.z += (dz / d) * step; }
    if (d > 1e-3) { const want = Math.atan2(-dx, -dz); let dy = want - this.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; this.yaw += dy * Math.min(1, dt * 10); }
    this.moving = true;
  }
}

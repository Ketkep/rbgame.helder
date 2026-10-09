// Shared pieces for the hotel's multi-maze levels (4 Revolving Door, 9 Kitchen Maze, 12 Do Not Disturb).
//
//  mazeSection   one sealed maze placed somewhere in a level: grid, walls (sealed to the room's side walls with `reach`), its
//                solution path, a mid-point cell (for the mid-maze checkpoint), an honest hint (the way out of THIS maze from where you
//                stand) and bot steering. Each level stacks two of them along -Z with a parkour/puzzle stretch in between.
//  sectionHint   the H key for such a level: whichever section you are standing in decides the trail (a maze solves itself up to its
//                own exit; a parkour stretch shows its own route up to the next maze). Never more than the current section.

import { bandMaze, solveMaze, mazeGrid, buildMazeWalls, edgeKey } from './mazekit.js';

export { solveMaze };

/**
 * opts: N, C, T, WH, X0, Z0 (south-west corner; the maze runs north = -Z), band [lo, hi] (solution length in cells),
 *       walls: options for buildMazeWalls (tex, color, … and `reach` = [x west wall, x east wall] to seal the room), y (floor top, 0).
 * The entrance is the gap in the south wall at column 0, the exit the gap in the north wall at column N-1.
 */
export function mazeSection(w, { N, C = 4.4, T = 0.8, WH = 3.6, X0 = null, Z0, band = [0, Infinity], walls = {}, y = 0, build = true } = {}) {
  const maze = bandMaze(N, band[0], band[1]);
  const grid = mazeGrid({ N, C, T, WH, Z0, X0 });
  const path = solveMaze(maze, [0, 0]);
  const pathIdx = new Map(path.map((c, k) => [c[0] * N + c[1], k]));
  if (build) buildMazeWalls(w, maze, grid, walls);
  const { cx, cz } = grid;
  const zS = Z0, zN = Z0 - N * C;                                   // south and north wall lines
  const M = {
    maze, grid, path, pathIdx, N, C, T, WH, X0: grid.X0, Z0, zS, zN, cx, cz, y,
    entry: { x: cx(0), y, z: zS + 2.2 },                            // just outside the south gap
    exit: { x: cx(N - 1), y, z: zN - 2.2 },                         // just outside the north gap
    mid: path[Math.floor(path.length / 2)],
    cellOf: (p) => grid.cellOf(p),
    key: (c) => c[0] * N + c[1],
    onPath: (c) => pathIdx.has(c[0] * N + c[1]),
    solve: (c) => solveMaze(maze, c),
    edge: (a, b) => edgeKey(N, a, b),
    /** inside the maze's footprint (between its south and north walls, and its side walls) */
    inside: (p) => p.z <= zS + 0.4 && p.z >= zN - 0.4 && p.x >= grid.X0 - 0.4 && p.x <= grid.X0 + N * C + 0.4,
    /** in the band of the level this maze occupies (between its south and north wall lines) */
    inBand: (p) => p.z <= zS && p.z > zN,
  };
  M.deadEnds = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (maze.nbrs(i, j).length === 1 && !(i === 0 && j === 0) && !(i === N - 1 && j === N - 1)) M.deadEnds.push([i, j]);
  M.pathEdges = new Set(); for (let k = 0; k < path.length - 1; k++) M.pathEdges.add(M.edge(path[k], path[k + 1]));
  /** every open edge of the maze as [a, b] (each once) */
  M.openEdges = () => {
    const out = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (const [a, b] of [[i + 1, j], [i, j + 1]]) if (a < N && b < N && maze.open(i, j, a, b)) out.push([[i, j], [a, b]]);
    return out;
  };
  /** the cell you are in, clamped into the maze (south of it counts as the entrance cell, north of it as the exit cell) */
  M.clampCell = (p) => { const [i, j] = grid.cellOf(p); return [Math.max(0, Math.min(N - 1, i)), Math.max(0, Math.min(N - 1, j))]; };
  /** the honest hint: from where you stand, cell by cell, out of the north gap (and not one step further) */
  M.hint = (p, { yy = y + 0.25, start = null } = {}) => {
    const out = [{ x: p.x, y: yy, z: p.z }];
    let [ci, cj] = grid.cellOf(p);
    if (cj < 0) { out.push({ x: cx(0), y: yy, z: cz(0) }); ci = 0; cj = 0; }
    if (cj >= N) { out.push({ x: M.exit.x, y: yy, z: M.exit.z }); return out; }
    ci = Math.max(0, Math.min(N - 1, ci));
    for (const c of solveMaze(maze, start || [ci, cj]).slice(1)) out.push({ x: cx(c[0]), y: yy, z: cz(c[1]) });
    out.push({ x: M.exit.x, y: yy, z: M.exit.z });
    return out;
  };
  /** bot steering: the next cell's centre, keeping to the corridor's centre line (null outside this maze's band) */
  M.steer = (p) => {
    const [ci, cj] = grid.cellOf(p);
    if (cj < 0) return { x: cx(0), z: cz(0) };
    if (cj >= N) return { x: M.exit.x, z: M.exit.z - 2 };
    const i = Math.max(0, Math.min(N - 1, ci));
    const sol = solveMaze(maze, [i, cj]);
    if (!sol[1]) return { x: M.exit.x, z: M.exit.z - 2 };
    const nxt = sol[1];
    const ex = Math.sign(nxt[0] - i), ez = -Math.sign(nxt[1] - cj);
    const lat = ex !== 0 ? p.z - cz(cj) : p.x - cx(i);
    if (Math.abs(lat) > 0.7) return ex !== 0 ? { x: p.x + ex * 0.6, z: cz(cj) } : { x: cx(i), z: p.z + ez * 0.6 };
    return { x: cx(nxt[0]), z: cz(nxt[1]) };
  };
  /** cells k steps along the solution from `from` */
  M.ahead = (from, k) => { const s = solveMaze(maze, from); return s[Math.min(k, s.length - 1)]; };
  return M;
}

/**
 * Straight runs of the solution path (≥ `min` cells, no edge in `skip`), as { from, to, dir, k0, k1 } — for things that patrol a corridor.
 */
export function pathRuns(M, { min = 2, skip = new Set(), from = 0, to = Infinity } = {}) {
  const { path } = M, runs = [];
  for (let k = 0; k < path.length - 1;) {
    const dir = [path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]];
    let e = k + 1;
    while (e + 1 < path.length && path[e + 1][0] - path[e][0] === dir[0] && path[e + 1][1] - path[e][1] === dir[1]) e++;
    let clean = true; for (let m = k; m < e; m++) if (skip.has(M.edge(path[m], path[m + 1]))) clean = false;
    if (clean && e - k >= min && k >= from && e <= to) runs.push({ from: path[k], to: path[e], dir, k0: k, k1: e });
    k = e;
  }
  return runs;
}

/**
 * The H key for a multi-section level. `sections` (south → north): { zS, zN, hint(p) → points | null }. The section you stand in
 * answers; outside every section there is no hint. Flat trails (mazes are on the floor) unless a section says `flat: false`.
 */
export function sectionHint(w, sections) {
  w.hintFlat = true;
  w.hintFn = (g) => {
    const p = g.player;
    const s = sections.find((q) => p.z <= q.zS && p.z > q.zN);
    if (!s) return null;
    w.hintFlat = s.flat !== false;
    const pts = s.hint(p, g);
    return pts && pts.length >= 2 ? pts : null;
  };
}

/** A stretch of platforms as a hint: from where you stand along `route` (points {x,y,z}), starting at the nearest one, ending at `end`. */
export function routeHint(route, end = null) {
  return (p) => {
    const all = end ? [...route, end] : route;
    let bi = 0, bd = Infinity;
    all.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * 0.6; if (d < bd) { bd = d; bi = i; } });
    const out = [{ x: p.x, y: p.y + 0.15, z: p.z }];
    for (let k = bi + (bd < 1.2 ? 1 : 0); k < all.length && out.length < 8; k++) out.push({ x: all[k].x, y: all[k].y + 0.15, z: all[k].z });
    return out;
  };
}

/**
 * Bot helper (w.botPlan): walk the maze solution, but only when it is safe. `bad(x, z, t)` says whether standing at (x, z) at world time t
 * is dangerous (a cart sweeping through, a housekeeper's cone…). The look-ahead replays the next cells at `speed`; if the way on is not
 * clear it waits where it stands (when that stays safe), else backs off along the solution. Returns a botPlan result ({x, z, wait?}).
 */
export function cautiousSteer(M, p, bad, t0, { speed = 5.8, H = 3.6, ahead = 4, back = 4, tol = 0.15, hdt = 0.1 } = {}) {
  const tgt = M.steer(p);
  const [ci, cj] = M.clampCell(p);
  const risk = (pts, sp) => {
    let x = pts[0].x, z = pts[0].z, seg = 0, left = 0, ux = 0, uz = 0, bad_t = 0;
    const next = () => { seg++; if (seg >= pts.length) return false; const dx = pts[seg].x - x, dz = pts[seg].z - z; left = Math.hypot(dx, dz); ux = dx / (left || 1); uz = dz / (left || 1); return true; };
    let moving = sp > 0 && next();
    for (let tau = 0; tau < H; tau += hdt) {
      if (bad(x, z, t0 + tau)) bad_t += hdt;
      if (moving) { let step = sp * hdt; while (step > 0 && moving) { const q = Math.min(step, left); x += ux * q; z += uz * q; left -= q; step -= q; if (left <= 1e-6) moving = next(); } }
    }
    return bad_t;
  };
  const sol = solveMaze(M.maze, [ci, cj]);
  const fwd = [{ x: p.x, z: p.z }];
  for (let i = 1; i < sol.length && i <= ahead; i++) fwd.push({ x: M.cx(sol[i][0]), z: M.cz(sol[i][1]) });
  if (risk(fwd, speed) <= tol) return tgt;
  if (risk([{ x: p.x, z: p.z }], 0) <= tol) return { x: p.x, z: p.z, wait: true };
  const prev = solveMaze(M.maze, [0, 0], [ci, cj]);
  const bk = [{ x: p.x, z: p.z }];
  for (let i = prev.length - 2; i >= 0 && bk.length <= back; i--) bk.push({ x: M.cx(prev[i][0]), z: M.cz(prev[i][1]) });
  if (bk.length > 1 && risk(bk, speed) <= tol * 2) return { x: bk[1].x, z: bk[1].z };
  return tgt;
}

# Lessons (read before writing or doing a task)

- Stack: Three.js r186 + Vite 8, vanilla JS ES modules, no framework. `npm run build` must pass; `npm test` = physics; `npm run check` = reachability.
- `main` is the live site. Never push untested work there; use a branch + PR for anything experimental.
- Co-op code (`src/net/`, `src/levels/coop*`, `src/levels/lowtide/`): each client simulates the whole level locally; shared state only via `c.set/get/emit`. Don't add per-client randomness — use `c.rng`.
- Don't export a function named `window` (or other globals) from a module; it shadowed `window.__noRender` once.
- `src/script.js` (narrator lines) and `src/levels/lowtide/roster.js` are append-only hot spots; concurrent edits cause merge conflicts. Keep each block closed with `});`.
- Test co-op with the bot harness: `BASE=http://localhost:PORT/ EXTRA="&camp=lowtide" node tools/coop-bot.mjs <chapter> 1500 3`. Chrome processes pile up and starve CPU; kill stale ones with a script file (not `pkill -f` in the same shell).
- Preview server dies when the container restarts; restart with `vite preview --port 4190 --strictPort`.
- Visual changes: verify with a real screenshot (`tools/lt-shot.mjs`), not only a build. Horror scenes are dark; don't judge brightness from the build log.
- Game design rules: hotel + 2P Mode must stay jump-scare-free and fair; only Lowtide may use loud scares. Players must never be killable immediately after respawn.
- Keep changes minimal; don't reformat files or touch levels you weren't assigned.

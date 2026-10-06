# Voice pack (optional)

The Host currently "speaks" with subtitles and synthesised blips. To give him a real voice:

1. Open `LINES.md` — every line has an ID.
2. Save each recording as `<ID>.mp3` in this folder (e.g. `l1.welcome.mp3`, `death.generic#3.mp3`).
3. Add the IDs you recorded to `manifest.json`, e.g. `["l1.welcome", "death.generic#3"]`.
4. Build + deploy. Lines present in the manifest play the audio (subtitles still show and wait for the clip to end); everything else falls back to blips.

No code changes needed.

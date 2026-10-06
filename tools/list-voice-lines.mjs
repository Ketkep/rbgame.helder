// Writes public/voice/LINES.md: every narrator line with the ID its audio file must use.
import { SCRIPT } from '../src/script.js';
import fs from 'node:fs';

const rows = [];
for (const [key, v] of Object.entries(SCRIPT)) {
  if (Array.isArray(v)) v.forEach((t, i) => rows.push([`${key}#${i}`, t]));
  else rows.push([key, v]);
}
const esc = (s) => s.replace(/\|/g, '\\|');
const md = [
  '# Narrator lines',
  '',
  'Record or generate one audio file per row and save it as `public/voice/<ID>.mp3`.',
  'Then list the IDs you have in `public/voice/manifest.json` (a JSON array of ID strings) and redeploy.',
  'Lines without a file keep working with subtitles + the synthesised voice blips.',
  '',
  '`{n}`, `{m}`, `{letter}`, `{text}`, `{fake}`, `{a}`, `{b}`, `{code}` in a line are filled in at runtime (death count, metres fallen, the answer letter, a code digit…); record those lines with a generic read, or reword them in `src/script.js`.',
  '',
  `${rows.length} lines.`,
  '',
  '| ID | Line |',
  '|----|------|',
  ...rows.map(([id, t]) => `| \`${id}\` | ${esc(t)} |`),
  '',
].join('\n');
fs.writeFileSync(new URL('../public/voice/LINES.md', import.meta.url), md);
console.log(`wrote ${rows.length} lines`);

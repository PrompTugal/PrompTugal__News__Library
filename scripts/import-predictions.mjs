// Librarian's tool, run by hand: catalogue a PrompTugal site's predictions file into the PRED collection.
// Usage: node scripts/import-predictions.mjs <path-to-read-only-clone> <site-host> <owner/repo>
// Reads only <clone>/data/predictions/predictions.jsonl (symlinks refused, realpath kept inside the clone, size and line
// limits), checks every line against the form (scripts/pred-form.mjs), and refuses the whole file on any problem,
// printing each one so the site can be told why. Append-only: a catalogued prediction keeps its first form; if it comes
// back changed, a "change" line records it and the new text is not taken. No network; nothing in the file is run.
import { readFileSync, writeFileSync, existsSync, lstatSync, realpathSync, statSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, sep, join } from 'node:path';
import { checkLine, LIMITS } from './pred-form.mjs';

const [root, site, repo] = process.argv.slice(2);
if (!root || !/^[a-z0-9.-]+\.promptugal\.news$/.test(site || '') || !/^PrompTugal\/[A-Za-z0-9_.-]{1,100}$/.test(repo || '')) { console.error('usage: node scripts/import-predictions.mjs <clone> <site.promptugal.news> <PrompTugal/Repo>'); process.exit(1); }
if (!existsSync('catalogue/pred.json')) { console.error('run from the library repository root'); process.exit(1); }
const base = realpathSync(resolve(root));
const rel = 'data/predictions/predictions.jsonl';
const full = resolve(base, rel);
if (!existsSync(full) || lstatSync(full).isSymbolicLink() || !lstatSync(full).isFile() || !realpathSync(full).startsWith(base + sep)) { console.error(`${rel}: missing, a symlink, or outside the clone`); process.exit(1); }
if (statSync(full).size > LIMITS.bytes) { console.error(`${rel}: larger than ${LIMITS.bytes} bytes`); process.exit(1); }
const raw = readFileSync(full, 'utf8').replace(/\r\n/g, '\n').split('\n');
if (raw.length > LIMITS.lines + 1) { console.error(`${rel}: more than ${LIMITS.lines} lines`); process.exit(1); }

const problems = [];
const lines = [];
raw.forEach((s, i) => {
  if (!s.trim()) return;
  let l; try { l = JSON.parse(s); } catch { problems.push(`line ${i + 1}: not JSON`); return; }
  if (l && l.type === 'change') { problems.push(`line ${i + 1}: "change" lines are the library's own`); return; }
  for (const e of checkLine(l, site)) problems.push(`line ${i + 1}: ${e}`);
  lines.push({ n: i + 1, l });
});
const ids = new Set();
for (const { n, l } of lines) if (l.type === 'prediction') { if (ids.has(l.id)) problems.push(`line ${n}: id ${l.id} repeated`); ids.add(l.id); }

const pred = JSON.parse(readFileSync('catalogue/pred.json', 'utf8'));
let series = pred.series.find((s) => s.site === site && s.from && s.from.endsWith('.jsonl'));
if (series && !(/^catalogue\/pred\/PRED-\d{4}-\d{4}\.jsonl$/.test(series.from) && series.from === `catalogue/pred/${series.id}.jsonl`)) { console.error(`${series.id}: from must be catalogue/pred/${series.id}.jsonl`); process.exit(1); }
const file = series ? series.from : null;
const kept = file && existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s)) : [];
const keptIds = new Set(kept.filter((l) => l.type === 'prediction').map((l) => l.id));
for (const { n, l } of lines) if (l.type === 'outcome' && !ids.has(l.of) && !keptIds.has(l.of)) problems.push(`line ${n}: outcome of ${l.of}, which is not a prediction in the file`);
if (problems.length) { console.error(problems.join('\n')); console.error(`REFUSED: ${problems.length} problem(s); nothing catalogued`); process.exit(1); }

const now = new Date().toISOString().slice(0, 16) + 'Z';
const small = (f) => { const st = lstatSync(f); if (!st.isFile() || st.size > 4096) throw new Error('refused'); return readFileSync(f, 'utf8'); };
const head = (() => { try { const h = small(join(base, '.git/HEAD')).trim(); const m = h.match(/^ref: (refs\/heads\/[A-Za-z0-9_\/-]{1,100})$/); const f = m ? join(base, '.git', m[1]) : null; const sha = f && existsSync(f) ? small(f).trim() : (/^[0-9a-f]{40}$/.test(h) ? h : ''); return /^[0-9a-f]{40}$/.test(sha) ? sha : 'unknown'; } catch { return 'unknown'; } })();
if (!series) {
  const n = String(pred.next_seq).padStart(4, '0');
  series = { call_number: `PRED 2026/${n}`, id: `PRED-2026-${n}`, site, title: `Predictions shown on ${site}`, from: `catalogue/pred/PRED-2026-${n}.jsonl`, page: '', added: now.slice(0, 10), added_by: 'library.b@PrompTugal.dinis' };
  pred.next_seq++; pred.series.push(series);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const out = [...kept];
// indexes, so a large file is checked in one pass (civic's 15,326 lines)
const firstPred = new Map(kept.filter((k) => k.type === 'prediction').map((k) => [k.id, k]));
const changedIds = new Set(kept.filter((k) => k.type === 'change').map((k) => k.of));
const seenLines = new Set(kept.map((k) => JSON.stringify(k)));
const outcomeOf = new Set(kept.filter((k) => k.type === 'outcome').map((k) => k.of));
let added = 0, changed = 0;
for (const { l } of lines) {
  if (l.type === 'prediction') {
    const first = firstPred.get(l.id);
    if (!first) { out.push(l); firstPred.set(l.id, l); added++; }
    else if (!same(first, l) && !changedIds.has(l.id)) { changedIds.add(l.id); out.push({ type: 'change', of: l.id, seen_at: now, note: 'This prediction came back changed after it was catalogued; the first form is kept.', by: 'library.b@PrompTugal.dinis' }); changed++; }
  } else if (!seenLines.has(JSON.stringify(l))) {
    seenLines.add(JSON.stringify(l));
    // a second, different outcome for one prediction is kept as a change: the first outcome still counts
    if (outcomeOf.has(l.of)) { out.push(l); out.push({ type: 'change', of: l.of, seen_at: now, note: `A further outcome (${l.result}, checked ${l.checked_at}) came after the first; the first still counts.`, by: 'library.b@PrompTugal.dinis' }); changed++; }
    else { out.push(l); outcomeOf.add(l.of); added++; }
  }
}
if (!series.page) series.page = (lines.find((x) => x.l.type === 'prediction') || {}).l?.page || `https://${site}/`;
series.read_from = { repo, path: rel, commit: head, read_at: now };
// pred.json first (so a call number is never reused), each file through a temporary file and a rename
mkdirSync('catalogue/pred', { recursive: true });
const put = (f, text) => { writeFileSync(`${f}.tmp`, text); renameSync(`${f}.tmp`, f); };
put('catalogue/pred.json', JSON.stringify(pred, null, 1) + '\n');
put(series.from, out.map((l) => JSON.stringify(l)).join('\n') + '\n');
console.log(`${series.call_number}: ${added} line(s) added, ${changed} change(s) recorded, ${out.length} in all`);

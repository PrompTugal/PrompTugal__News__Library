// Librarian's tool, run by hand: copy into catalogue/places.json the places the library's own records name, with their
// coordinates and each coordinate's source, from ontologist@'s places registry (Dinis, 19 Nov 2026 about 17:40 UTC: the
// map is Portugal big, London and the EU small; the places come from data/site/places-registry.json).
// Usage: node scripts/import-places.mjs <read-only clone of PrompTugal/PrompTugal__News__Website>
// A place is named when a prediction's subject, before its first comma, is the place's name or one of its aliases
// (case kept as written, compared exactly after lower-casing), or by a collection's place (WS26: Lisbon). Nothing in the
// registry is run or followed; every field kept is checked. No network.
import { readFileSync, writeFileSync, existsSync, lstatSync, realpathSync, readdirSync, renameSync } from 'node:fs';
import { resolve, sep, join } from 'node:path';

const [root] = process.argv.slice(2);
if (!root) { console.error('usage: node scripts/import-places.mjs <clone of PrompTugal__News__Website>'); process.exit(1); }
if (!existsSync('catalogue/pred.json')) { console.error('run from the library repository root'); process.exit(1); }
const base = realpathSync(resolve(root));
const inClone = (rel) => { const f = resolve(base, rel); if (!existsSync(f) || lstatSync(f).isSymbolicLink() || !lstatSync(f).isFile() || !realpathSync(f).startsWith(base + sep) || lstatSync(f).size > 4 * 1024 * 1024) return null; return f; };
const regFile = inClone('data/site/places-registry.json');
if (!regFile) { console.error('data/site/places-registry.json: missing, a symlink, too large or outside the clone'); process.exit(1); }
const reg = JSON.parse(readFileSync(regFile, 'utf8'));
if (!Array.isArray(reg.places)) { console.error('places-registry.json: no places list'); process.exit(1); }

const ID = /^[a-z0-9][a-z0-9-]{0,60}$/;
const TEXT = (s, n) => typeof s === 'string' && s.length > 0 && s.length <= n && !/[\u0000-\u001f\u007f<>[\]`*_|#\\]/.test(s);
const byName = new Map();
for (const p of reg.places) {
  if (!p || !ID.test(p.id || '') || !TEXT(p.name, 80)) continue;
  for (const n of [p.name, ...(Array.isArray(p.aliases) ? p.aliases : [])]) if (TEXT(n, 80)) { const k = n.toLowerCase(); if (!byName.has(k)) byName.set(k, p); }
}

// the names the library's records use
const named = new Map(); // id -> { place, uses: Set }
const use = (p, why) => { if (!named.has(p.id)) named.set(p.id, { place: p, uses: new Set() }); named.get(p.id).uses.add(why); };
const pred = JSON.parse(readFileSync('catalogue/pred.json', 'utf8'));
for (const s of pred.series) {
  if (!s.from || !s.from.endsWith('.jsonl') || !existsSync(s.from)) continue; // PRED 2026/0001 is built from the WS26 catalogue
  for (const line of readFileSync(s.from, 'utf8').split('\n')) {
    if (!line) continue;
    const l = JSON.parse(line);
    if (l.type !== 'prediction' || typeof l.subject !== 'string') continue;
    const p = byName.get(l.subject.split(',')[0].trim().toLowerCase());
    if (p) use(p, s.id);
  }
}
const lisbon = byName.get('lisbon'); // through the same checks as every other name
if (lisbon) use(lisbon, 'WS26');

const problems = [];
const out = [];
for (const [id, { place: p, uses }] of [...named].sort()) {
  const at = p.at;
  if (!Array.isArray(at) || at.length !== 2 || !at.every((x) => typeof x === 'number' && Number.isFinite(x)) || Math.abs(at[0]) > 180 || Math.abs(at[1]) > 90) { problems.push(`${id}: no usable at`); continue; }
  const pf = ID.test(id) ? inClone(join('data/places', id, 'place.json')) : null;
  const pj = pf ? JSON.parse(readFileSync(pf, 'utf8')) : null;
  const src = pj && pj.at_source;
  const okUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password && !x.port && u.length <= 300; } catch { return false; } };
  // a source is an https address, or a file in the registry's own repository (data/by-place/places.json for the Portuguese seats)
  const okPath = (u) => typeof u === 'string' && /^[a-z0-9_][a-z0-9_./-]{0,200}$/.test(u) && !u.split('/').includes('..');
  if (!src || !(okUrl(src.url) || okPath(src.url)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(src.read_at || '') || !TEXT(src.how, 200)) { problems.push(`${id}: its at has no source in data/places/${id}/place.json`); continue; }
  out.push({ id, name: p.name, aliases: (Array.isArray(p.aliases) ? p.aliases : []).filter((a) => TEXT(a, 80)), kind: TEXT(p.kind, 40) ? p.kind : null, country: /^[A-Z]{2}$/.test(p.country || '') ? p.country : null, at, at_source: okUrl(src.url) ? { url: src.url, read_at: src.read_at, how: src.how } : { repo_path: src.url, repo: 'PrompTugal/PrompTugal__News__Website', read_at: src.read_at, how: src.how }, wikidata: /^Q\d{1,12}$/.test(p.wikidata || '') ? p.wikidata : null, named_by: [...uses].sort() });
}
if (problems.length) { console.error(problems.join('\n')); console.error(`REFUSED: ${problems.length} problem(s); nothing written`); process.exit(1); }
// the clone's commit, read from its files (git is never run inside the clone, so its config cannot take effect)
const commit = (() => { try { const small = (f) => { const st = lstatSync(f); if (!st.isFile() || st.size > 4096) throw new Error('refused'); return readFileSync(f, 'utf8').trim(); }; const h = small(join(base, '.git/HEAD')); const m = h.match(/^ref: (refs\/heads\/[A-Za-z0-9_\/-]{1,100})$/); const sha = m && existsSync(join(base, '.git', m[1])) ? small(join(base, '.git', m[1])) : h; return /^[0-9a-f]{40}$/.test(sha) ? sha : 'unknown'; } catch { return 'unknown'; } })();
const now = new Date().toISOString().slice(0, 16) + 'Z';
const doc = { about: "The places the library's own records name, copied from ontologist@'s places registry with each coordinate's source (Wikidata, CC0, or the main site's by-place list). Matched by name or alias against the first part of a prediction's subject, or by a collection's place.", from: { repo: 'PrompTugal/PrompTugal__News__Website', path: 'data/site/places-registry.json', commit, read_at: now }, places: out };
writeFileSync('catalogue/places.json.tmp', JSON.stringify(doc, null, 1) + '\n'); renameSync('catalogue/places.json.tmp', 'catalogue/places.json');
console.log(`catalogue/places.json: ${out.length} places (${out.map((p) => p.id).join(', ')})`);

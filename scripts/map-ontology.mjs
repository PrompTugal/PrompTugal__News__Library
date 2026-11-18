// Librarian's tool, run by hand (the ontologist sub-pass): match the library's tag-made nodes to the ids the
// main site already uses, from a local read-only clone of PrompTugal__News__Website, and write the result to
// catalogue/ontology-map.json, which the build reads (the build itself never reads the clone and fetches nothing).
// Usage: node scripts/map-ontology.mjs <path-to-website-clone>
// The clone is read as data only: directory names and two JSON files; nothing in it is run or followed.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const root = process.argv[2];
if (!root) { console.error('usage: node scripts/map-ontology.mjs <path-to-website-clone>'); process.exit(1); }
const base = resolve(root);
const inside = (p) => { const r = resolve(base, p); if (!r.startsWith(base + sep)) throw new Error(`outside the clone: ${p}`); return r; };
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;
const dirs = (p) => readdirSync(inside(p)).filter((d) => SLUG.test(d) && statSync(join(inside(p), d)).isDirectory());
const places = new Set(dirs('data/places'));
const topics = new Set(dirs('data/topics'));
const agentsFile = JSON.parse(readFileSync(inside('data/newsroom/agents.json'), 'utf8'));
const agentNames = new Set((agentsFile.agents || []).map((a) => a && a.name).filter((n) => typeof n === 'string'));
const commit = (() => { try { return readFileSync(inside('.git/HEAD'), 'utf8').trim(); } catch { return 'unknown'; } })();

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const tags = new Set(); const makers = new Set();
for (const f of readdirSync('catalogue').filter((f) => /^[a-z0-9]+\.json$/.test(f))) {
  const d = JSON.parse(readFileSync(join('catalogue', f), 'utf8'));
  for (const it of d.items || []) { for (const t of it.tags || []) tags.add(t); if (it.made_by) makers.add(it.made_by); }
}
const tagMap = {};
for (const t of [...tags].sort()) {
  const s = slug(t);
  if (!s) continue;
  if (places.has(s)) tagMap[t] = { id: `place:${s}`, match: 'promptugal.news place' };
  else if (topics.has(s)) tagMap[t] = { id: `topic:${s}`, match: 'promptugal.news topic' };
  else tagMap[t] = { id: `topic:${s}`, match: 'local' };
}
const agentMap = {};
for (const m of [...makers].sort()) agentMap[m] = { match: agentNames.has(m) ? 'promptugal.news agent' : 'local' };
const out = {
  about: 'How the library\'s tag-made nodes match the ids the main site uses (ontologist@\'s review, 18 November 2026, points 5 and 6). Written by scripts/map-ontology.mjs from a read-only clone of PrompTugal__News__Website; "local" means the library\'s own id, not one of the main site\'s.',
  made: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), from: `PrompTugal__News__Website, ${commit}`,
  tags: tagMap, agents: agentMap,
};
writeFileSync('catalogue/ontology-map.json', JSON.stringify(out, null, 1) + '\n');
const c = (o, k) => Object.values(o).filter((x) => x.match === k).length;
console.log(`tags: ${Object.keys(tagMap).length} (${c(tagMap, 'promptugal.news place')} places, ${c(tagMap, 'promptugal.news topic')} topics, ${c(tagMap, 'local')} local); agents: ${Object.keys(agentMap).length} (${c(agentMap, 'promptugal.news agent')} matched)`);

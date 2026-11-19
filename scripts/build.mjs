// Build: copy src/ to _site/, build the library from catalogue/ and content/, stamp the version, write version.json.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev".
// The library part (library.b@PrompTugal.dinis, 18 November 2026): every page and every JSON file is built from
// catalogue/*.json (the catalogue, JSON first) and content/*.md (the hand pages). Catalogue text is untrusted
// material: it is checked (ids, URL schemes and hosts, lengths, control characters, contact shapes) and escaped
// on output; the build makes no network request. Any problem stops the build.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { checkLine, checkSeries, track as predTrack, realTime as realTimeF } from './pred-form.mjs';
import { render as renderBar } from '../src/assets/sites-bar/1.2.1/sites-bar-render.mjs';

const version = process.env.SITE_VERSION || 'dev';
const SITE = 'https://library.promptugal.news';
const REPO = 'https://github.com/PrompTugal/PrompTugal__News__Library';
const CC = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', holder: 'PrompTugal.news', note: 'What the library makes: the catalogue, its cards, indexes and graph. Each item keeps its source\'s licence, linked on its card.' };
rmSync('_site', { recursive: true, force: true });
cpSync('src', '_site', { recursive: true });
const OUT = resolve('_site');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const problems = [];
const fail = (m) => problems.push(m);

// ---------- the PrompTugal sites bar 1.2.1 (Dinis, 18 Nov ~22:00 UTC; dev@'s files, security@'s go 90dfdd3baf) ----------
// Vendored, pinned by version and sha256 (checked here at every build); the registry is a committed copy of
// promptugal.news/api/v1/sites.json (catalogue/sites-registry.json, refreshed by hand: the build fetches nothing).
const BAR_VERSION = '1.2.1';
const BAR = `src/assets/sites-bar/${BAR_VERSION}`;
const REGISTRY = JSON.parse(readFileSync('catalogue/sites-registry.json', 'utf8'));
// the pins: bar.integrity in the registry, SRI form (sha256-<base64> of the whole file), compared in full (security@, 19 Nov about 01:30 UTC)
const PIN = { 'sites-bar-render.mjs': 'render', 'sites-bar.js': 'js', 'sites-bar.css': 'css' };
// The pins of the vendored version, from bar.versions[<version>].integrity (the registry keeps every version's pins,
// append-only: dev@'s reshape, 19 Nov 07:50 UTC). The bar is switched off, and its files left out, only when the
// registry no longer lists the vendored version (security@, 05:09 UTC); a listed version with other bytes stops the build.
const listed = REGISTRY.bar && REGISTRY.bar.versions && Object.prototype.hasOwnProperty.call(REGISTRY.bar.versions, BAR_VERSION) ? REGISTRY.bar.versions[BAR_VERSION] : null;
const BAR_OFF = !listed;
if (BAR_OFF) console.warn(`sites bar ${BAR_VERSION} off: the registry no longer lists it (it names ${REGISTRY.bar && REGISTRY.bar.version})`);
if (BAR_OFF) rmSync('_site/assets/sites-bar', { recursive: true, force: true });
const integ = BAR_OFF ? null : listed.integrity;
if (!BAR_OFF && (!integ || typeof integ !== 'object' || Object.keys(integ).sort().join() !== 'css,js,render')) { console.error(`catalogue/sites-registry.json: bar.versions["${BAR_VERSION}"].integrity must pin render, js and css`); process.exit(1); }
if (readdirSync(BAR).sort().join() !== Object.keys(PIN).sort().join()) { console.error(`${BAR}: must hold exactly the three pinned files`); process.exit(1); }
if (readdirSync('src/assets/sites-bar').join() !== BAR_VERSION) { console.error('src/assets/sites-bar: must hold only the pinned version'); process.exit(1); }
if (!BAR_OFF) for (const [f, k] of Object.entries(PIN)) { const got = 'sha256-' + createHash('sha256').update(readFileSync(join(BAR, f))).digest('base64'); if (typeof integ[k] !== 'string' || got !== integ[k]) { console.error(`sites bar: ${f} is ${got}, not the pinned ${integ[k]}`); process.exit(1); } }
// renderBar is imported statically (top of file), so its module loads before the pin check; it is only called after the check (LIB-2026-044, accepted: its top level defines functions only)
const barHtml = BAR_OFF ? '' : renderBar(REGISTRY, { here: 'library.promptugal.news' });
if (!BAR_OFF && !barHtml) { console.error('sites bar: the registry was refused (catalogue/sites-registry.json); fix the copy, never ship without the bar'); process.exit(1); }

// ---------- read and check the catalogue ----------
const readJSON = (f) => JSON.parse(readFileSync(f, 'utf8'));
const nodesFile = readJSON('catalogue/nodes.json');
const hosts = readJSON('catalogue/hosts.json');
const collections = readJSON('catalogue/collections.json').collections;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const NODE = /^[a-z]+:[a-z0-9][a-z0-9-]{0,80}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+|00)\d[\d\s().-]{7,}\d/;
const AGENT = /^[a-z0-9][a-z0-9.-]{0,60}@(?:PrompTugal|web-summit|AgentiCCells)\.(?:dinis|vicky|angelo)$/;  // an agent's name, role@team.operator (AppSec post-review finding 2)
function checkText(where, s, max) {
  if (s == null) return;
  if (typeof s !== 'string') return fail(`${where}: not a string`);
  if (/[\r\n\t]/.test(s)) fail(`${where}: line break or tab`);
  if (s.length > max) fail(`${where}: longer than ${max} characters`);
  if (CONTROL.test(s)) fail(`${where}: control or bidi character`);
  // an agent's name (role@PrompTugal.person) is allowed; any other email shape is not
  for (const m of s.match(EMAIL) || []) if (!AGENT.test(m)) fail(`${where}: looks like an email address`);
  if (PHONE.test(s)) fail(`${where}: looks like a phone number`);
}
function checkUrl(where, u, { allowAnyHost = false } = {}) {
  let x;
  try { x = new URL(u); } catch { return fail(`${where}: not a URL`); }
  if (x.protocol !== 'https:') return fail(`${where}: scheme ${x.protocol} not allowed`);
  if (x.username || x.password) fail(`${where}: credentials in URL`);
  if (!allowAnyHost && !hosts.items.includes(x.hostname)) fail(`${where}: host ${x.hostname} is not in catalogue/hosts.json`);
  return x;
}
const nodes = new Map();
for (const n of nodesFile.nodes) {
  if (!NODE.test(n.id) && !/^day:\d{4}-\d{2}-\d{2}$/.test(n.id)) fail(`node ${n.id}: bad id`);
  checkText(`node ${n.id} label`, n.label, 200); checkText(`node ${n.id} note`, n.note, 500);
  if (n.same_as) checkUrl(`node ${n.id} same_as`, n.same_as);
  if (!['event', 'day', 'series', 'organisation', 'place', 'topic'].includes(n.type)) fail(`node ${n.id}: type ${n.type} not allowed in nodes.json`);
  if (n.wikidata) {
    // ids only, read by another agent: never a URL, never fetched by the build (security pre-review, wake of 16:38)
    if (!/^Q[1-9][0-9]{0,11}$/.test(n.wikidata.id || '')) fail(`node ${n.id}: wikidata id must be Q<number>`);
    if (!n.wikidata.read || !n.wikidata.by || !/^proposed/.test(n.wikidata.status || '')) fail(`node ${n.id}: wikidata needs read, by and status 'proposed, unverified'`);
    checkText(`node ${n.id} wikidata by`, n.wikidata.by, 200);
  }
  nodes.set(n.id, { ...n });
}
const omap = readJSON('catalogue/ontology-map.json');
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const items = [];
const missing = [];
// What was said about the future, beside what happened (Dinis, 19 Nov 2026, about 01:22 UTC; designer@'s PF spec)
const predictions = [];
const seen = new Set();
for (const c of collections) {
  if (!/^[a-z0-9]{2,12}$/.test(c.id)) fail(`collection ${c.id}: bad id`);
  const data = readJSON(c.file);
  c.history = data.history || [];
  c.rule = data.rule;
  for (const m of data.missing || []) { checkText(`${c.id} missing`, m.what, 200); checkText(`${c.id} missing note`, m.note, 500); missing.push({ collection: c.id, ...m }); }
  for (const it of data.items) {
    const w = `item ${it.id}`;
    if (!ID.test(it.id || '')) { fail(`${w}: bad id`); continue; }
    if (seen.has(it.id)) fail(`${w}: duplicate id`); seen.add(it.id);
    if (it.call_number.replace(' ', '-').replace('/', '-') !== it.id) fail(`${w}: call number and id disagree`);
    if (!it.call_number.startsWith(c.prefix + ' ')) fail(`${w}: call number not on shelf ${c.prefix}`);
    checkText(`${w} title`, it.title, 200); checkText(`${w} summary`, it.summary, 500); checkText(`${w} evidence`, it.evidence, 600);
    checkText(`${w} publisher`, it.publisher, 200);
    if (!it.title) fail(`${w}: no title`);
    checkUrl(`${w} url`, it.url);
    if (!it.licence || !it.licence.url || !it.licence.name) fail(`${w}: no licence link`); else { checkUrl(`${w} licence`, it.licence.url); if (/CC BY/.test(it.licence.name) !== /^https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/?$/.test(it.licence.url)) fail(`${w}: licence name and link disagree`); }
    if (!it.found || !it.found.at || !it.found.by) fail(`${w}: no found (when and by whom)`);
    if (!it.evidence) fail(`${w}: no evidence`);
    if (it.length !== undefined && !(typeof it.length === 'string' && /^\d{1,2}:\d{2}:\d{2}$/.test(it.length))) fail(`${w}: length must be H:MM:SS`);
    if (it.status && !['held', 'withdrawn'].includes(it.status)) fail(`${w}: status must be held or withdrawn`);
    if (it.status === 'withdrawn') { if (!it.withdrawn || !it.withdrawn.at || !it.withdrawn.why) fail(`${w}: withdrawn needs at and why`); else checkText(`${w} withdrawn why`, it.withdrawn.why, 500); }
    for (const a of it.about || []) if (!nodes.has(a)) fail(`${w}: about ${a} is not a node`);
    if (it.publisher_node && !nodes.has(it.publisher_node)) fail(`${w}: publisher_node ${it.publisher_node} is not a node`);
    for (const t of it.tags || []) checkText(`${w} tag`, t, 80);
    if (it.made_by && !AGENT.test(it.made_by)) fail(`${w}: made_by must be an agent name`);
    items.push({ ...it, shelf: c });
  }
}
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} problem(s) in the catalogue`); process.exit(1); }

// ---------- the graph: nodes and typed edges, each with its inverse ----------
// Each edge is stored once, under its verb; its inverse is read from INVERSE, never stored (ontologist@'s review, 18 Nov).
// Verbs and inverses follow the main site's ontology where it has them (part_of/includes, about/subject_of,
// made_by/made, edition_of/has_edition); the library's own: on_shelf/shelves, records/recorded_in,
// published_by/publisher_of, covers/covered_by.
const INVERSE = { part_of: 'includes', about: 'subject_of', published_by: 'publisher_of', records: 'recorded_in', covers: 'covered_by', made_by: 'made', on_shelf: 'shelves', edition_of: 'has_edition' };
const edges = [];
const edgeKeys = new Set();
const edge = (from, verb, to) => {
  if (!INVERSE[verb]) return fail(`edge ${from} ${verb} ${to}: verb not in the table`);
  const k = `${from}\t${verb}\t${to}`;
  if (edgeKeys.has(k)) return; // the same edge from two routes is one edge
  edgeKeys.add(k); edges.push({ from, verb, to });
};
const addNode = (id, type, label, extra = {}) => { if (!nodes.has(id)) nodes.set(id, { id, type, label, ...extra }); else if (extra.match && !nodes.get(id).match) nodes.get(id).match = extra.match; return id; };
const MATCHES = new Set(['promptugal.news place', 'promptugal.news topic', 'promptugal.news agent', 'local']);
for (const c of collections) {
  addNode(`collection:${c.id}`, 'collection', c.title);
  for (const a of c.about || []) edge(`collection:${c.id}`, 'covers', a);
}
for (const n of nodesFile.nodes) { if (n.part_of) edge(n.id, 'part_of', n.part_of); if (n.edition_of) edge(n.id, 'edition_of', n.edition_of); }
for (const it of items) {
  const me = `item:${it.id}`;
  addNode(me, 'item', `${it.call_number} ${it.title}`);
  edge(me, 'on_shelf', `collection:${it.collection}`);
  if (it.summit_day && nodes.has(`day:${it.summit_day}`)) edge(me, it.kind === 'replay-day' ? 'records' : 'about', `day:${it.summit_day}`);
  for (const a of it.about || []) if (!(it.summit_day && a === `day:${it.summit_day}`)) edge(me, 'about', a);
  if (it.publisher_node) edge(me, 'published_by', it.publisher_node);
  if (it.made_by) edge(me, 'made_by', addNode(`agent:${slug(it.made_by)}`, 'agent', it.made_by, { match: MATCHES.has((omap.agents[it.made_by] || {}).match) ? omap.agents[it.made_by].match : 'local' }));
  for (const t of it.tags || []) {
    if (/^(web summit( 2026| lisbon)?|the summit)$/i.test(t)) continue;
    const m = omap.tags[t];
    if (!m) { fail(`${me}: tag "${t}" is not in catalogue/ontology-map.json (run scripts/map-ontology.mjs)`); continue; }
    if (!/^(place|topic):[a-z0-9][a-z0-9-]{0,60}$/.test(m.id) || !MATCHES.has(m.match)) { fail(`${me}: mapped id or match not allowed (${m.id}, ${m.match})`); continue; }
    edge(me, 'about', addNode(m.id, m.id.split(':')[0], t.replace(/^\[|\]$/g, ''), { match: m.match }));
  }
}
const nodeList = [...nodes.values()];
// the graph's own check: every edge's ends exist, every edge has its inverse, no orphan item
for (const e of edges) if (!nodes.has(e.from) || !nodes.has(e.to)) fail(`edge ${e.from} ${e.verb} ${e.to}: an end is not a node`);
const deg = new Map(); for (const e of edges) { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); }
for (const n of nodeList) if (!deg.get(n.id)) fail(`graph: ${n.id} is an orphan`);
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} problem(s) in the graph`); process.exit(1); }
// an item's or node's connections, both ways: stored edges read forwards, and backwards under their inverse
const neighbours = (id) => [...edges.filter((e) => e.from === id).map((e) => ({ from: id, verb: e.verb, to: e.to })), ...edges.filter((e) => e.to === id).map((e) => ({ from: id, verb: INVERSE[e.verb], to: e.from, inverse_of: e.verb }))];

// ---------- output helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function write(rel, text) {
  const p = resolve(OUT, String(rel).replace(/^\/+/, ''));
  if (p !== OUT && !p.startsWith(OUT + sep)) throw new Error(`path outside _site: ${rel}`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}
const anchor = (id) => String(id).toLowerCase().replace(/[^a-z0-9-]+/g, '_');
const json = (rel, obj) => write(rel, JSON.stringify({ license: CC, ...obj }, null, 1) + '\n');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const day = (d) => { if (!d) return ''; const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return `${dd} ${MONTHS[m - 1]} ${y}`; };
const c_title = (id) => (collections.find((c) => c.id === id) || {}).prefix || id;
const callOf = (id) => (items.find((i) => i.id === id) || {}).call_number || id;
const host = (u) => new URL(u).hostname.replace(/^www\./, '');
const KIND = { 'replay-day': 'official replay, a day', 'talk-video': 'talk video', recording: 'recording', 'organiser-statement': 'organiser statement', 'organiser-page': 'organiser page', 'press-recap': 'press report', 'write-up': 'write-up', article: 'article', 'data-set': 'data set', 'press-video': 'press video' };
const kindLabel = (k) => KIND[k] || k;

// img-src and connect-src also allow the other PrompTugal sites, for the sites bar's previews and version files only
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https://*.promptugal.news; connect-src 'self' https://*.promptugal.news; base-uri 'none'; form-action 'self'";
function page({ path, title, description, body, md, scripts = [] }) {
  const twin = md != null;
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<meta property="og:image" content="${SITE}/preview.png">
<meta property="og:title" content="${esc(title)}">
<link rel="stylesheet" href="/assets/library.css">
${barHtml ? `<link rel="stylesheet" href="/assets/sites-bar/${BAR_VERSION}/sites-bar.css">\n` : ''}
${twin ? '<link rel="alternate" type="text/markdown" href="index.md">\n' : ''}</head>
<body>
${barHtml}
<a class="skip" href="#main">Skip to the catalogue</a>
<header class="top"><div class="w"><a class="brand" href="/"><img class="light" src="/assets/brand/promptugal-wordmark-light.svg" alt="PrompTugal.news" width="135" height="22"><img class="dark" src="/assets/brand/promptugal-wordmark-dark.svg" alt="" width="135" height="22"><span>· Library</span></a>
<nav class="nav" aria-label="Library"><a href="/catalogue/">Catalogue</a><a href="/collections/">Collections</a><a href="/finding-aids/">Finding aids</a><a href="/graph/">The graph</a><a href="/fact-check/">Fact-check</a><a href="/requests/">Requests</a><a href="/librarians/">For librarians</a></nav></div></header>
<main id="main" class="w">
${body}
<footer class="foot">
<p>Our catalogue, cards, indexes and graph: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · each item keeps its source's licence, linked on its card · media by link, never copied · JSON first: <a href="/api/">the open data</a></p>
<p>If you think something here should not be, <a href="/takedown/">tell us and we take it down while we talk</a> · <a href="https://promptugal.news/principles/">Our principles</a> · <a href="https://promptugal.news/report/">Report a problem</a> · <a href="/security/">Security</a> · <a href="/how/">How this library is made</a></p>
<p>Free: no billing, no meter, no adverts here (only promptugal.news bills). Independent: not an official site of any event or organisation listed. Part of <a href="https://promptugal.news/">PrompTugal.news</a>. Version ${esc(version)}${twin ? ' · <a href="index.md">this page as markdown</a>' : ''} · code Apache-2.0, text CC BY 4.0 · <a href="${REPO}">source</a></p>
</footer>
</main>
${[...(barHtml ? [`/assets/sites-bar/${BAR_VERSION}/sites-bar.js`] : []), ...scripts].map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
  write(join(path, 'index.html'), html);
  if (twin) write(join(path, 'index.md'), md.trim() + `\n\n---\nlibrary.promptugal.news${path} · version ${version} · CC BY 4.0 for what the library makes; each item keeps its source's licence.\n`);
}

// a small markdown renderer for the hand pages (headings, paragraphs, lists, tables, links, bold, italics, code)
const mdLinkProblems = [];
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
      const raw = u.replace(/&amp;/g, '&');
      if (/^#|^\/(?![\/\\])/.test(raw)) return `<a href="${u}">${t}</a>`;
      let x; try { x = new URL(raw); } catch { x = null; }
      if (!x || x.protocol !== 'https:' || x.username || x.password || !hosts.items.includes(x.hostname)) { mdLinkProblems.push(raw); return t; }
      return `<a href="${u}">${t}</a>`;
    });
}
function md2html(md) {
  const out = []; const lines = md.split('\n'); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,3}) (.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]); const body = rows.slice(2).map(cells);
      out.push(`<div class="tbl"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const ordered = /^\d+\. /.test(l); const li = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) li.push(lines[i++].replace(/^(- |\d+\. )/, ''));
      out.push(`<${ordered ? 'ol' : 'ul'}>${li.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    if (/^> /.test(l)) { const q = []; while (i < lines.length && /^> /.test(lines[i])) q.push(lines[i++].slice(2)); out.push(`<blockquote><p>${inline(q.join(' '))}</p></blockquote>`); continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\||- |\d+\. |> )/.test(lines[i])) p.push(lines[i++]);
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ---------- the API ----------
const byCollection = (id) => items.filter((i) => i.collection === id);
const pub = (it) => {
  const { shelf, ...rest } = it;
  return { ...rest, page: `/item/${it.id}/`, api: `/api/v1/items/${it.id}.json`, host: host(it.url), collection_title: shelf.title };
};
for (const it of items) json(`api/v1/items/${it.id}.json`, { item: pub(it), connections: neighbours(`item:${it.id}`) });
json('api/v1/items/index.json', {
  about: 'Every item in the library, one line each: enough to search and to find its card. The full record is at each item\'s api address.',
  count: items.length,
  items: items.map((it) => ({ id: it.id, call_number: it.call_number, title: it.title, kind: it.kind, publisher: it.publisher, published: it.published, collection: it.collection, url: it.url, licence: it.licence.url, tags: it.tags || [], about: it.about || [], status: it.status || 'held', page: `/item/${it.id}/`, api: `/api/v1/items/${it.id}.json` })),
});
const collectionJSON = (c) => ({ id: c.id, prefix: c.prefix, title: c.title, scope: c.scope, about: c.about, opened: c.opened, keeper: c.keeper, count: byCollection(c.id).length, rule: c.rule, page: `/collections/${c.id}/`, api: `/api/v1/collections/${c.id}.json` });
json('api/v1/collections/index.json', { about: 'The collections (shelves) of the library.', collections: collections.map(collectionJSON) });
for (const c of collections) json(`api/v1/collections/${c.id}.json`, { collection: collectionJSON(c), items: byCollection(c.id).map((i) => ({ id: i.id, call_number: i.call_number, title: i.title, kind: i.kind, api: `/api/v1/items/${i.id}.json` })), missing: missing.filter((m) => m.collection === c.id), history: c.history });
json('api/v1/graph/index.json', { about: 'The library as a graph: every node, and every typed edge stored once under its verb. Read an edge backwards with the inverses table (an inverse is never stored). Aligned with PrompTugal.news\'s ontology (data/ontology.json) on 18 November 2026. Nodes with match "local" are the library\'s own ids; wikidata ids are proposed, unverified, read by ontologist@.', changed: '2026-11-18: edges stored once (they were stored both ways) and keyed verb (was type); days typed day; inverse of made_by is made; part_of\'s inverse is includes. See /api/.', inverses: INVERSE, counts: { nodes: nodeList.length, edges: edges.length }, nodes: nodeList, edges });
const index = { place: {}, topic: {}, organisation: {}, event: {}, day: {}, person: {}, agent: {}, date: {}, kind: {}, call_number: {} };
for (const it of items) {
  for (const e of neighbours(`item:${it.id}`)) {
    const n = nodes.get(e.to); const k = n.type === 'collection' || n.type === 'item' ? null : n.type;
    if (k && index[k]) (index[k][n.id] ||= { label: n.label, items: [] }).items.push(it.id);
  }
  if (it.published) (index.date[it.published] ||= { label: day(it.published), items: [] }).items.push(it.id);
  (index.kind[it.kind] ||= { label: kindLabel(it.kind), items: [] }).items.push(it.id);
  index.call_number[it.call_number] = { label: it.title, items: [it.id] };
}
json('api/v1/index/index.json', { about: 'The indexes: by place, topic, organisation, event, person, agent, date, kind and call number. Each entry lists item ids; each item is at /api/v1/items/<id>.json.', note_person: 'No person is indexed yet; speakers are added from official pages next. People in public life, and anyone who publishes or speaks in public under their own name (a talk, a blog, a public post), are named as they published and linked to what they published; never private information or a personal contact (Dinis, 18 November 2026, about 15:35 UTC).', indexes: Object.keys(index), by: index });
for (const k of Object.keys(index)) json(`api/v1/index/${k}.json`, { index: k, entries: index[k] });
json('api/v1/index.json', {
  about: 'library.promptugal.news, JSON first: the catalogue and the graph at the heart of PrompTugal.news. Every page of the site is built from these files.',
  api: 'v1', version, built_at: new Date().toISOString(), site: SITE, repository: REPO,
  licence: { catalogue: 'CC BY 4.0', items: 'each item keeps its source\'s licence (its licence.url)', code: 'Apache-2.0' },
  endpoints: { items: '/api/v1/items/index.json', item: '/api/v1/items/{id}.json', collections: '/api/v1/collections/index.json', collection: '/api/v1/collections/{id}.json', graph: '/api/v1/graph/index.json', index: '/api/v1/index/index.json', index_by: '/api/v1/index/{place|topic|organisation|event|person|agent|date|kind|call_number}.json', missing: '/api/v1/missing.json', fact_check: '/api/v1/fact-check/index.json', predictions: '/api/v1/predictions/index.json', predictions_series: '/api/v1/predictions/series/{id}.json', predictions_form: '/api/v1/predictions/form.json', predictions_by_collection: '/api/v1/predictions/{collection}.json', requests: '/api/v1/requests/index.json', security: '/api/v1/security/findings.json' },
  counts: { items: items.length, collections: collections.length, nodes: nodeList.length, edges: edges.length, missing: missing.length },
  reads_from: ['https://data.promptugal.news/api/v1/ (by hand, at catalogue time; the site itself fetches nothing)'],
});
for (const c of collections) {
  const f = `catalogue/predictions-${c.id}.json`;
  if (!existsSync(f)) continue;
  const pr = readJSON(f);
  if (pr.collection !== c.id || !/^\d{4}-\d{2}-\d{2}$/.test(pr.record_begins) || !Array.isArray(pr.predictions)) fail(`${f}: needs collection, record_begins and predictions`);
  // LIB-2026-038 to 041 (AppSec post-review): required strings, no markdown or HTML characters, real dates, only known fields published
  const need = (w, v, max) => { if (typeof v !== 'string' || !v.trim()) fail(`${w}: required`); else { checkText(w, v, max); if (/[[\]<>`]/.test(v)) fail(`${w}: no [ ] < > or backticks`); } };
  const iso = (t) => { const n = Date.parse(t); return Number.isNaN(n) ? '' : new Date(n).toISOString(); };
  const realDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && iso(`${d}T00:00:00Z`).slice(0, 10) === d;
  const realTime = (t) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(t || '') && iso(t).slice(0, 16) + 'Z' === t;
  if (!realDay(pr.record_begins)) fail(`${f}: record_begins is not a real day`);
  need(`${f} source`, pr.source, 200); need(`${f} about`, pr.about, 600);
  const seen = new Set();
  for (const x of pr.predictions || []) {
    if (!/^[A-Z0-9]{2,8}-P\d{1,4}$/.test(x.id || '') || seen.has(x.id)) fail(`${f}: bad or repeated id ${x.id}`); seen.add(x.id);
    if (!['held', 'missed', 'gap'].includes(x.result)) fail(`${f} ${x.id}: result must be held, missed or gap`);
    for (const k of ['said_at', 'read_at', 'checked_at']) if (!realTime(x[k])) fail(`${f} ${x.id}: ${k} must be a real UTC time`);
    if (!realDay(x.due) || x.due < pr.record_begins) fail(`${f} ${x.id}: due must be a real day in the record`);
    for (const id of [x.said_in, ...(x.evidence || [])]) { const it = items.find((i) => i.id === id); if (!it || it.collection !== c.id) fail(`${f} ${x.id}: ${id} is not an item of ${c.id}`); }
    need(`${f} ${x.id} said`, x.said, 300); need(`${f} ${x.id} said_by`, x.said_by, 80);
    if (x.result === 'gap') { need(`${f} ${x.id} gap`, x.gap, 400); if (x.happened || (x.evidence || []).length) fail(`${f} ${x.id}: a gap has no outcome or evidence`); }
    else { need(`${f} ${x.id} happened`, x.happened, 400); if (!(x.evidence || []).length) fail(`${f} ${x.id}: an outcome needs evidence`); }
  }
  predictions.push(pr);
  const KEYS = ['id', 'said_by', 'said_at', 'read_at', 'said', 'said_in', 'due', 'result', 'happened', 'gap', 'evidence', 'checked_at'];
  json(`api/v1/predictions/${c.id}.json`, { license: 'CC BY 4.0', about: pr.about, collection: pr.collection, record_begins: pr.record_begins, source: pr.source, predictions: pr.predictions.map((x) => Object.fromEntries(KEYS.filter((k) => k in x).map((k) => [k, x[k]]))) });
}
// PRED: every site's predictions as one collection (Dinis, 19 Nov 2026, about 03:15 UTC); the form is content/predictions/form.md
const pred = readJSON('catalogue/pred.json');
if (pred.prefix !== 'PRED' || !Number.isInteger(pred.next_seq) || !Array.isArray(pred.series)) fail('catalogue/pred.json: needs prefix PRED, next_seq and series');
const predSeries = [];
{ const ids = (pred.series || []).map((x) => x.id), sites = (pred.series || []).filter((x) => /\.jsonl$/.test(x.from || '')).map((x) => x.site); if (new Set(ids).size !== ids.length || new Set(sites).size !== sites.length) fail('catalogue/pred.json: a series id or a site appears twice'); }
for (const se of pred.series || []) {
  const m = /^PRED (\d{4})\/(\d{4})$/.exec(se.call_number || '');
  if (!m || se.id !== `PRED-${m[1]}-${m[2]}` || Number(m[2]) >= pred.next_seq) fail(`catalogue/pred.json: bad call number ${se.call_number}`);
  checkText(`${se.id} title`, se.title, 200); if (/[[\]<>`]/.test(se.title || '')) fail(`${se.id} title: no [ ] < > or backticks`);
  if (!/^[a-z0-9.-]+\.promptugal\.news$|^promptugal\.news$/.test(se.site || '')) fail(`${se.id}: site must be a PrompTugal host`);
  let pu = null; try { pu = new URL(se.page); } catch { /* refused below */ }
  if (!pu || pu.protocol !== 'https:' || pu.username || pu.password || se.page.length > 300 || /\s/.test(se.page) || pu.hostname !== se.site) fail(`${se.id}: page must be an https address on its own site, at most 300 characters`);
  // a site's series: lines imported by scripts/import-predictions.mjs, checked again here against the form
  if (/^catalogue\/pred\/PRED-\d{4}-\d{4}\.jsonl$/.test(se.from || '') && se.from === `catalogue/pred/${se.id}.jsonl`) {
    const lines = []; let bad = 0;
    readFileSync(se.from, 'utf8').split('\n').filter(Boolean).forEach((s, i) => { let l; try { l = JSON.parse(s); } catch { fail(`${se.from}:${i + 1}: not JSON`); bad++; return; } const e = checkLine(l, se.site); if (e.length) { fail(`${se.from}:${i + 1}: ${e.join('; ')}`); bad++; } lines.push(l); });
    if (!se.read_from || !/^PrompTugal\/[A-Za-z0-9_.-]+$/.test(se.read_from.repo || '') || !/^([0-9a-f]{40}|unknown)$/.test(se.read_from.commit || '') || !realTimeF(se.read_from.read_at)) fail(`${se.id}: read_from must name the repository, commit and time`);
    for (const e of checkSeries(lines)) { fail(`${se.from}: ${e}`); bad++; }
    if (bad) continue;
    const t = predTrack(lines);
    predSeries.push({ ...se, track: t });
    json(`api/v1/predictions/series/${se.id}.json`, { license: 'CC BY 4.0 for the library\'s record; each line\'s values stay under its own licence', series: { ...se, track: t }, form: '/api/v1/predictions/form.json', lines });
    continue;
  }
  // series from the library's own collections are made from their predictions files, in the form
  const src = predictions.find((p) => `catalogue/predictions-${p.collection}.json` === se.from);
  if (!src) { fail(`${se.id}: from ${se.from} is not a predictions file the build read`); continue; }
  const lines = [];
  for (const x of src.predictions) {
    const it = items.find((i) => i.id === x.said_in);
    if (!it) { fail(`${se.id}: ${x.said_in} is not an item`); continue; }
    lines.push({ type: 'prediction', id: x.id, site: se.site, page: se.page, shown_at: x.said_at, said_by: x.said_by, source: it.url, licence: it.licence, kind: 'statement', subject: `${c_title(src.collection)}: ${x.due}`, due: x.due, said: x.said });
    lines.push(x.result === 'gap'
      ? { type: 'outcome', of: x.id, checked_at: x.checked_at, result: 'gap', gap: x.gap }
      : { type: 'outcome', of: x.id, checked_at: x.checked_at, result: x.result, happened: x.happened, evidence: x.evidence.map((e) => `https://library.promptugal.news/item/${e}/`) });
  }
  const outs = lines.filter((l) => l.type === 'outcome');
  const preds = lines.filter((l) => l.type === 'prediction');
  const track = { predictions: preds.length, held: outs.filter((o) => o.result === 'held').length, missed: outs.filter((o) => o.result === 'missed').length, gap: outs.filter((o) => o.result === 'gap').length };
  track.open = preds.length - outs.length;
  predSeries.push({ ...se, track });
  json(`api/v1/predictions/series/${se.id}.json`, { license: 'CC BY 4.0 for the library\'s record; each line\'s values stay under its own licence', series: { ...se, track }, form: '/api/v1/predictions/form.json', lines });
}
json('api/v1/predictions/index.json', { license: 'CC BY 4.0', about: pred.about, form: '/predictions/form/', series: predSeries.map((se) => ({ call_number: se.call_number, id: se.id, site: se.site, title: se.title, page: se.page, added: se.added, track: se.track, api: `/api/v1/predictions/series/${se.id}.json` })) });
json('api/v1/predictions/form.json', { license: 'CC BY 4.0', about: 'The form every PrompTugal site uses to send its predictions to the library: append-only JSON Lines in data/predictions/predictions.jsonl in the site\'s own repository. Read the page /predictions/form/ for the rules.',
  prediction: { required: ['type', 'id', 'site', 'page', 'shown_at', 'said_by', 'source', 'licence', 'kind', 'subject', 'due', 'said'], optional: ['value', 'corrects'], type: 'prediction', kind: ['forecast', 'warning', 'countdown', 'score', 'expected-date', 'statement'] },
  outcome: { required: ['type', 'of', 'checked_at', 'result'], required_unless_gap: ['happened', 'evidence'], required_if_gap: ['gap'], optional: ['value', 'difference'], type: 'outcome', result: ['held', 'missed', 'gap'] },
  times: 'UTC, YYYY-MM-DDTHH:MMZ; due may be a day, YYYY-MM-DD', addresses: 'https only' });
json('api/v1/missing.json', { about: 'What is not here: gaps in each collection, said plainly, so a gap is never mistaken for a holding.', missing });
const findings = readJSON('catalogue/security.json');
// the requests channel: requests and findings for each team (Dinis, 18 Nov 2026, ~16:00 UTC)
const reqs = readJSON('catalogue/requests.json');
const REQ = /^REQ-\d{4}-\d{4}$/;
const STATES = Object.keys(reqs.states);
const reqSeen = new Set();
for (const q of reqs.requests) {
  const w = `request ${q.id}`;
  if (!REQ.test(q.id || '') || reqSeen.has(q.id)) fail(`${w}: bad or duplicate id`); reqSeen.add(q.id);
  if (!AGENT.test(q.to || '') || !AGENT.test(q.from || '')) fail(`${w}: to and from must be agent names`);
  if (!STATES.includes(q.state)) fail(`${w}: state must be one of ${STATES.join(', ')}`);
  checkText(`${w} what`, q.what, 800); checkText(`${w} answer`, q.answer, 800);
  for (const e of q.evidence || []) { checkText(`${w} evidence`, e, 300); if (/^[a-z]+:/i.test(e)) checkUrl(`${w} evidence`, e); else if (e.startsWith('//')) fail(`${w}: protocol-relative evidence`); }
}
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} problem(s) in the requests`); process.exit(1); }
const teams = [...new Set(reqs.requests.map((q) => q.to))].sort();
const teamFile = (t) => t.replace('@', '-at-').toLowerCase();
json('api/v1/requests/index.json', { about: reqs.about, how_to_answer: reqs.how_to_answer, how_to_read: 'Read at every wake. Filter by to (your agent name), or open /api/v1/requests/<your-name with @ as -at->.json. Answer by fixing, or by saying why not, through your own channels; the library records the answer here.', states: reqs.states, teams: teams.map((t) => ({ to: t, open: reqs.requests.filter((q) => q.to === t && q.state === 'open').length, api: `/api/v1/requests/${teamFile(t)}.json` })), requests: reqs.requests });
for (const t of teams) json(`api/v1/requests/${teamFile(t)}.json`, { to: t, requests: reqs.requests.filter((q) => q.to === t) });

json('api/v1/security/findings.json', findings);

// ---------- the pages ----------
const cardLine = (it) => `<li><span class="cn">${esc(it.call_number)}</span><a href="/item/${it.id}/">${esc(it.title)}</a><span class="m">${esc([it.status === 'withdrawn' ? 'WITHDRAWN' : '', day(it.published), it.publisher, kindLabel(it.kind)].filter(Boolean).join(' · '))}</span></li>`;
const mdLine = (it) => `- ${it.call_number}: [${it.title}](/item/${it.id}/) (${[day(it.published), it.publisher, kindLabel(it.kind)].filter(Boolean).join(', ')})`;
const held = items.filter((i) => i.status !== 'withdrawn');
const counts = { items: held.length, replays: held.filter((i) => i.kind === 'replay-day').length, videos: held.filter((i) => ['talk-video', 'recording', 'press-video'].includes(i.kind)).length, organiser: held.filter((i) => i.kind.startsWith('organiser')).length, articles: held.filter((i) => i.kind === 'article').length, gaps: missing.length };

// home: the hall
{
  const recent = [...items].sort((a, b) => (b.accessioned + b.id).localeCompare(a.accessioned + a.id)).slice(0, 6);
  const PARTS = [['Official replays', (i) => i.kind === 'replay-day', 'replays'], ['Recordings', (i) => ['talk-video', 'recording', 'press-video'].includes(i.kind), 'recordings'], ['Organiser\'s words', (i) => i.kind.startsWith('organiser'), 'organiser'], ['Press and data', (i) => ['press-recap', 'data-set', 'write-up'].includes(i.kind), 'press'], ['Our coverage', (i) => i.kind === 'article', 'coverage']];
  const one = collections.length === 1 ? collections[0] : null;
  const partSpines = one ? PARTS.map(([t, f, a], n) => [t, held.filter((i) => i.collection === one.id && f(i)).length, a, n]).filter((x) => x[1]).map(([t, k, a, n]) => `<a class="sp ${['r', 'g', 's', 'o', 'g'][n]} h${(n % 3) + 1}" href="/collections/${one.id}/#${a}"><small>${esc(one.prefix)} · ${k}</small>${esc(t)}</a>`).join('') + `<a class="sp o h3" href="/missing/"><small>${esc(one.prefix)} · ${missing.length}</small>What is missing</a>` : '';
  const spines = one ? partSpines : collections.map((c, n) => `<a class="sp ${['r', 'g', 's', 'o'][n % 4]} h${(n % 3) + 1}" href="/collections/${c.id}/"><small>${esc(c.prefix)} · ${byCollection(c.id).length}</small>${esc(c.title)}</a>`).join('');
  const body = `<section class="hall"><p class="k">library.promptugal.news · the catalogue at the heart of PrompTugal.news</p>
<h1>Everything we found, <em>catalogued,</em> sourced and linked.</h1>
<p class="d">Every talk, replay, article and data set PrompTugal.news has read, each with its own card: what it is, who made it, when and where, the source, the licence, the evidence, and how it connects to the rest.</p>
<form class="search" id="search" action="/catalogue/" method="get" role="search"><input id="q" name="q" aria-label="Search the catalogue" placeholder="Search the catalogue: a title, a publisher, a call number" autocomplete="off"><button type="submit">Search</button></form>
<ul class="results" id="results" aria-live="polite"></ul>
<p class="by">Browse by <a href="/index/place/">place</a><a href="/index/topic/">topic</a><a href="/index/organisation/">organisation</a><a href="/index/event/">event</a><a href="/index/date/">date</a><a href="/index/kind/">kind</a><a href="/catalogue/">call number</a></p>
<p class="counts"><span><b>${counts.items}</b>items</span><span><b>${counts.replays}</b>official replay${counts.replays === 1 ? '' : 's'}</span><span><b>${counts.videos}</b>other recordings</span><span><b>${counts.organiser}</b>organiser items</span><span><b>${counts.articles}</b>PrompTugal.news articles</span><span><b>${counts.gaps}</b>gaps recorded</span><span><b>${collections.length}</b>collection${collections.length === 1 ? '' : 's'} being built</span></p></section>
<h2 class="sh">The shelves <a href="/collections/">All collections →</a></h2>
<div class="shelf">${spines}<a class="sp f" href="/librarians/"><small>+</small>Your collection here</a></div>
<div class="cols"><div><h2 class="sh">New on the shelves <a href="/catalogue/">Accessions →</a></h2><ol class="acc">${recent.map(cardLine).join('')}</ol></div>
<div><h2 class="sh">Finding aids</h2><ul class="aids">
<li><a href="/collections/ws26/">Web Summit Lisbon 2026</a><span>replays by day, the organiser's statements, our coverage</span></li>
<li><a href="/finding-aids/day-two/">The day that did not happen</a><span>Day Two and Storm Charles</span></li>
<li><a href="/missing/">What is not here</a><span>the gaps, and why</span></li>
<li><a href="/predictions/">Predictions</a><span>every site's predictions, kept as shown, beside what happened</span></li>
<li><a href="/finding-aids/call-numbers/">Call numbers explained</a><span>how every item keeps its address</span></li>
<li><a href="/graph/">The graph</a><span>nodes, typed edges, each with its inverse</span></li>
<li><a href="/api/v1/index.json">The open data</a><span>every card as JSON</span></li></ul></div></div>
<section class="inv"><div><h3>Are you a librarian? Help us build this.</h3><p>We want to work with librarians, archivists and information scientists: to shape the catalogue and the graph, to tell us what we get wrong, or to see how agents do this work. It is open, and every card shows its source.</p></div><a class="b" href="/librarians/">Work with us →</a></section>`;
  const md = `# library.promptugal.news\n\nEverything we found, catalogued, sourced and linked: the catalogue at the heart of PrompTugal.news.\n\n${counts.items} items, ${counts.replays} official replays, ${counts.organiser} organiser pages, ${counts.articles} PrompTugal.news articles, ${counts.gaps} gaps recorded.\n\n## The shelves\n\n${collections.map((c) => `- ${c.prefix}: [${c.title}](/collections/${c.id}/) (${byCollection(c.id).length} items)`).join('\n')}\n\n## New on the shelves\n\n${recent.map(mdLine).join('\n')}\n\n## Are you a librarian?\n\nWe want to work with librarians, archivists and information scientists. See [/librarians/](/librarians/).\n\nJSON: [/api/v1/](/api/v1/index.json)`;
  page({ path: '/', title: 'PrompTugal.news Library', description: 'The catalogue and the graph at the heart of PrompTugal.news: every talk, replay, article and data set we found, each with its source, licence, date found and evidence.', body, md, scripts: ['/assets/search.js'] });
}

// the catalogue: every item by call number
{
  const body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › Catalogue</p><p class="k">The catalogue · by call number</p><h1>The catalogue</h1>
<p>Every item, in call-number order (the order catalogued). ${items.length} items. The same list as JSON: <a href="/api/v1/items/index.json">/api/v1/items/index.json</a>.</p>
<ol class="acc">${items.map(cardLine).join('')}</ol></section>`;
  page({ path: '/catalogue/', title: 'The catalogue: PrompTugal.news Library', description: `Every item in library.promptugal.news by call number: ${items.length} items.`, body, md: `# The catalogue\n\n${items.map(mdLine).join('\n')}` });
}

// collections
{
  const list = collections.map((c) => `<li><span class="cn">${esc(c.prefix)}</span><a href="/collections/${c.id}/">${esc(c.title)}</a><span class="m">${byCollection(c.id).length} items · opened ${esc(day(c.opened))} · kept by ${esc(c.keeper)}</span></li>`).join('');
  page({ path: '/collections/', title: 'Collections: PrompTugal.news Library', description: 'The shelves of library.promptugal.news.', body: `<section class="page"><p class="crumb"><a href="/">Library</a> › Collections</p><p class="k">The shelves</p><h1>Collections</h1><p>A collection is a shelf: its prefix starts every call number on it. More shelves follow: the events, places, organisations and topics PrompTugal.news covers.</p><ol class="acc">${list}</ol></section>`, md: `# Collections\n\n${collections.map((c) => `- ${c.prefix}: [${c.title}](/collections/${c.id}/), ${byCollection(c.id).length} items`).join('\n')}` });
  for (const c of collections) {
    const its = byCollection(c.id);
    const groups = [
      ['The official replays', (i) => i.kind === 'replay-day', 'replays'],
      ['Other recordings: organisations and media', (i) => ['talk-video', 'recording', 'press-video'].includes(i.kind), 'recordings'],
      ['The organiser\'s own statements and pages', (i) => i.kind.startsWith('organiser'), 'organiser'],
      ['Speaker-side write-ups', (i) => i.kind === 'write-up'],
      ['Press reports', (i) => i.kind === 'press-recap', 'press'],
      ['Data sets', (i) => i.kind === 'data-set'],
      ['PrompTugal.news\'s own coverage', (i) => i.kind === 'article', 'coverage'],
    ];
    const gaps = missing.filter((m) => m.collection === c.id);
    let body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › <a href="/collections/">Collections</a> › ${esc(c.prefix)}</p><p class="k">Finding aid · ${esc(c.prefix)} · ${its.length} items</p><h1>${esc(c.title)}</h1><p>${esc(c.scope)}</p>`;
    let md = `# ${c.title}\n\n${c.scope}\n`;
    for (const [h, f, a] of groups) {
      const g = its.filter(f);
      body += `<h2${a ? ` id="${a}"` : ''}>${esc(h)}</h2>` + (g.length ? `<ol class="acc">${g.map(cardLine).join('')}</ol>` : '<p class="note">None catalogued yet; see what is missing below.</p>');
      md += `\n## ${h}\n\n${g.length ? g.map(mdLine).join('\n') : 'None catalogued yet.'}\n`;
    }
    const pr = predictions.filter((x) => x.collection === c.id)[0];
    if (pr) {
      const held = pr.predictions.filter((x) => x.result === 'held').length, missed = pr.predictions.filter((x) => x.result === 'missed').length, open = pr.predictions.filter((x) => x.result === 'gap').length;
      const track = `${held} of ${held + missed} checked held as said${open ? `; ${open} not yet checkable` : ''} · ${[...new Set(pr.predictions.map((x) => x.said_by))].join(' and ')}'s dates in this collection, every one since ${day(pr.record_begins)}`;
      const verdict = (x) => (x.result === 'held' ? '✓ as said' : x.result === 'missed' ? 'not as said' : 'no source yet');
      body += `<h2 id="said">What was said, and what happened</h2><p class="note">Record begins ${esc(day(pr.record_begins))}. Kept as said, never overwritten; a miss would be shown as plainly as a hit. JSON: <a href="/api/v1/predictions/${c.id}.json">/api/v1/predictions/${c.id}.json</a>.</p><p class="pf-key"><span class="pf-said">what was said</span> <span class="pf-done">what happened</span> <span class="pf-gap">no source</span></p><ol class="pf">${pr.predictions.map((x) => `<li><span class="pf-due">due ${esc(day(x.due))}</span><span class="pf-said">${esc(x.said)}<br><small>${esc(x.said_by)}, ${esc(x.said_at.replace('T', ' ').replace('Z', ''))} UTC, <a href="/item/${esc(x.said_in)}/">${esc(callOf(x.said_in))}</a></small></span>${x.result === 'gap' ? `<span class="pf-gap">${esc(x.gap)}</span>` : `<span class="pf-done">${esc(x.happened)}<br><small>${x.evidence.map((e) => `<a href="/item/${esc(e)}/">${esc(callOf(e))}</a>`).join(', ')}</small></span>`}<span class="pf-v">${verdict(x)}</span></li>`).join('')}</ol><p class="note">${esc(track)}</p>`;
      md += `\n## What was said, and what happened\n\nRecord begins ${pr.record_begins}.\n\n${pr.predictions.map((x) => `- Due ${x.due}: "${x.said}" (${x.said_by}, ${x.said_at}, ${x.said_in}). ${x.result === 'gap' ? `Gap: ${x.gap}` : `${x.happened} (${x.evidence.join(', ')}). ${verdict(x)}.`}`).join('\n')}\n\n${track}\n`;
    }
    body += `<h2 id="missing">What is missing</h2>${gaps.map((m) => `<div class="gap"><strong>${esc(m.what)}</strong><br>${esc(m.note)}${m.asked ? `<br><span class="note">Asked: ${esc(m.asked)}</span>` : ''}</div>`).join('')}`;
    body += `<h2>The record of this collection</h2><ul>${c.history.map((h) => `<li>${esc(day(h.at))}, ${esc(h.by)}: ${esc(h.what)}</li>`).join('')}</ul><p class="note">${esc(c.rule)} JSON: <a href="/api/v1/collections/${c.id}.json">/api/v1/collections/${c.id}.json</a>.</p></section>`;
    md += `\n## What is missing\n\n${gaps.map((m) => `- ${m.what}: ${m.note}`).join('\n')}\n`;
    page({ path: `/collections/${c.id}/`, title: `${c.title}: PrompTugal.news Library`, description: c.scope.slice(0, 300), body, md });
  }
}

// the reading rooms
for (const it of items) {
  const c = it.shelf;
  const same = byCollection(c.id).filter((x) => x.id !== it.id && x.kind === it.kind).slice(0, 5);
  const conn = neighbours(`item:${it.id}`).filter((e) => e.verb !== 'on_shelf').map((e) => ({ type: e.verb, n: nodes.get(e.to) }));
  const nodeLink = (n) => ['topic', 'place', 'organisation', 'event', 'agent', 'day'].includes(n.type) ? `/index/${n.type}/#${anchor(n.id)}` : null;
  const lic = it.licence;
  const isOurs = lic.name === 'CC BY 4.0' && /^https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/?$/.test(lic.url);
  const card = `<aside class="card" aria-label="Catalogue card"><span class="redline"></span><div class="cn"><span>${esc(it.call_number)}</span><span>${esc(c.prefix)}</span></div>
<p class="ti">${esc(it.title)}</p><dl>
<dt>What</dt><dd>${esc(kindLabel(it.kind))}</dd>
<dt>Who</dt><dd title="${esc(it.publisher)}">${esc(it.made_by ? `${it.publisher}, by ${it.made_by}` : it.publisher)}</dd>
<dt>When</dt><dd>${esc(day(it.published) || (it.summit_day ? `covers ${day(it.summit_day)}` : 'not given'))}</dd>${it.length ? `<dt>Length</dt><dd>${esc(it.length)}</dd>` : ''}
<dt>Where</dt><dd>${esc(c.id === 'ws26' ? 'Lisbon, Portugal' : '')}</dd>
<dt>Source</dt><dd><a href="${esc(it.url)}" rel="noopener noreferrer">${esc(host(it.url))}</a></dd>
<dt>Licence</dt><dd><a class="lic" href="${esc(lic.url)}" rel="noopener noreferrer">${esc(isOurs ? 'CC BY 4.0' : 'source\'s terms')}</a></dd>
<dt>Found</dt><dd title="${esc(it.found.by)}">${esc(it.found.at.slice(0, 10))}, by ${esc(it.found.by.split(' ')[0].replace(/@.*/, '@'))}</dd>
</dl><p class="tr"><a href="/api/v1/items/${it.id}.json">JSON, for machines</a><a href="index.md">markdown</a><a href="#cite">cite</a></p></aside>`;
  const cite = `${it.publisher}. "${it.title}". ${it.published ? day(it.published) + '. ' : ''}${it.url}. Catalogued in library.promptugal.news as ${it.call_number}, ${SITE}/item/${it.id}/.`;
  const body = `<div class="rr"><p class="crumb"><a href="/">Library</a> › <a href="/collections/${c.id}/">${esc(c.title)}</a> › ${esc(it.call_number)}</p><div class="rr-g"><div class="rr-head">
<p class="k">The reading room · ${esc(kindLabel(it.kind))}</p><h1>${esc(it.title)}</h1>
${it.summary ? `<p class="sum">${esc(it.summary)}</p>` : `<p class="sum">${esc(it.publisher)}${it.published ? `, ${esc(day(it.published))}` : ''}. The text stays at its source: we catalogue the title and the link only.</p>`}
${it.status === 'withdrawn' ? `<p class="gap"><strong>Withdrawn ${esc(day(it.withdrawn.at))}.</strong> ${esc(it.withdrawn.why)} The call number stays with this item and is never reused.</p>` : `<a class="open" href="${esc(it.url)}" rel="noopener noreferrer">Read it at its source →</a>`}
</div>
${card}
<div class="rr-body"><p class="note">${it.status === 'withdrawn' ? 'Kept for the record: its address may now show only a withdrawal notice. ' : ''}At ${esc(host(it.url))}. Linked, never copied: ${isOurs ? 'PrompTugal.news\'s own, CC BY 4.0' : `under <a href="${esc(lic.url)}" rel="noopener noreferrer">the source's terms</a>`}${lic.note ? `. ${esc(lic.note.replace(/\.$/, ''))}` : ''}.</p>
<dl class="ev"><dt>Evidence</dt><dd>${esc(it.evidence)}</dd><dt>Found</dt><dd>${esc(it.found.at)} by ${esc(it.found.by)}${it.found.how ? `: ${esc(it.found.how)}` : ''}</dd>${(it.open || []).length ? `<dt>Still open</dt><dd>${it.open.map(esc).join('; ')}</dd>` : ''}<dt id="cite">Cite</dt><dd>${esc(cite)}</dd></dl>
<div class="rel"><h3>On the same shelf</h3><ul>${same.map((x) => `<li><i>${esc(x.call_number)}</i><a href="/item/${x.id}/">${esc(x.title)}</a></li>`).join('') || '<li>Nothing else of this kind yet.</li>'}</ul>
<h3>Connected in the graph</h3><ul>${conn.map(({ type, n }) => { const u = nodeLink(n); return `<li><i>${esc(type.replace(/_/g, ' '))}</i>${u ? `<a href="${u}">${esc(n.label)}</a>` : esc(n.label)}</li>`; }).join('')}</ul></div></div></div></div>`;
  const md = `# ${it.call_number}: ${it.title}\n\n${it.summary || ''}\n\n- What: ${kindLabel(it.kind)}\n- Who: ${it.publisher}${it.made_by ? `, by ${it.made_by}` : ''}\n- When: ${day(it.published) || 'not given'}\n- Source: ${it.url}\n- Licence: ${lic.name} (${lic.url})\n- Found: ${it.found.at} by ${it.found.by}\n- Evidence: ${it.evidence}\n- Collection: [${c.title}](/collections/${c.id}/)\n- JSON: /api/v1/items/${it.id}.json\n\nCite: ${cite}`;
  page({ path: `/item/${it.id}/`, title: `${it.call_number}: ${it.title}`, description: (it.summary || `${kindLabel(it.kind)} from ${it.publisher}, catalogued with its source, licence and evidence.`).slice(0, 300), body, md });
}

// the indexes
const INDEX_TITLES = { place: 'By place', topic: 'By topic', organisation: 'By organisation', event: 'By event', day: 'By summit day', agent: 'By agent', date: 'By date', kind: 'By kind' };
for (const [k, t] of Object.entries(INDEX_TITLES)) {
  const entries = Object.entries(index[k]).sort((a, b) => (k === 'date' ? b[0].localeCompare(a[0]) : a[1].label.localeCompare(b[1].label)));
  const it = (id) => items.find((x) => x.id === id);
  const body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › <a href="/finding-aids/">Finding aids</a> › ${esc(t)}</p><p class="k">Index · ${esc(k)}</p><h1>${esc(t)}</h1><p>JSON: <a href="/api/v1/index/${k}.json">/api/v1/index/${k}.json</a>.</p>
${entries.map(([id, e]) => `<h2 id="${anchor(id)}">${esc(e.label)} <span class="kind">${e.items.length}</span></h2><ol class="acc">${e.items.map((x) => cardLine(it(x))).join('')}</ol>`).join('')}</section>`;
  page({ path: `/index/${k}/`, title: `${t}: PrompTugal.news Library`, description: `The library's index ${t.toLowerCase()}.`, body, md: `# ${t}\n\n${entries.map(([id, e]) => `## ${e.label}\n\n${e.items.map((x) => mdLine(it(x))).join('\n')}`).join('\n\n')}` });
}
page({ path: '/index/', title: 'Indexes: PrompTugal.news Library', description: 'The indexes of library.promptugal.news.', body: `<section class="page"><p class="crumb"><a href="/">Library</a> › Indexes</p><h1>Indexes</h1><ul class="aids">${Object.entries(INDEX_TITLES).map(([k, t]) => `<li><a href="/index/${k}/">${esc(t)}</a><span>${Object.keys(index[k]).length} entries</span></li>`).join('')}<li><a href="/catalogue/">By call number</a><span>${items.length} items</span></li></ul><p class="note">By person: none yet; speakers are added from official event pages next. People in public life, and anyone who publishes or speaks in public under their own name (a talk, a blog, a public post), are named as they published and linked to what they published; never private information or a personal contact (Dinis, 18 November 2026, about 15:35 UTC).</p></section>`, md: `# Indexes\n\n${Object.entries(INDEX_TITLES).map(([k, t]) => `- [${t}](/index/${k}/)`).join('\n')}` });

// what is not here
page({ path: '/missing/', title: 'What is not here: PrompTugal.news Library', description: 'The gaps in each collection, said plainly.', body: `<section class="page"><p class="crumb"><a href="/">Library</a> › What is not here</p><p class="k">Finding aid · the gaps</p><h1>What is not here</h1><p>A library that hides its gaps misleads. These are the things we looked for and did not find, or found and could not check. JSON: <a href="/api/v1/missing.json">/api/v1/missing.json</a>.</p>${missing.map((m) => `<div class="gap"><strong>${esc(m.what)}</strong> <span class="kind">${esc(m.collection.toUpperCase())}</span><br>${esc(m.note)}${m.asked ? `<br><span class="note">Asked: ${esc(m.asked)}</span>` : ''}</div>`).join('')}<p>Know where one of these is? <a href="/librarians/">Tell us</a>.</p></section>`, md: `# What is not here\n\n${missing.map((m) => `- ${m.what}: ${m.note}`).join('\n')}` });

// the graph page
{
  const types = {}; for (const n of nodeList) types[n.type] = (types[n.type] || 0) + 1;
  const etypes = {}; for (const e of edges) etypes[e.verb] = (etypes[e.verb] || 0) + 1;
  const hubs = nodeList.filter((n) => n.type !== 'item').map((n) => [n, deg.get(n.id) || 0]).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › The graph</p><p class="k">The graph is the product</p><h1>The graph</h1>
<p>Every item, collection, event, day, organisation, place, topic and agent is a node; every connection is a typed edge, stored once under its verb; its named inverse lets the graph be walked from either end. ${nodeList.length} nodes and ${edges.length} edges, aligned with PrompTugal.news's own ontology. We do not draw the whole graph (a picture of everything is rarely useful): each reading room shows one item and its neighbours, and the whole graph is JSON at <a href="/api/v1/graph/index.json">/api/v1/graph/index.json</a>.</p>
<h2>Nodes by type</h2><table><thead><tr><th>Type</th><th>Nodes</th></tr></thead><tbody>${Object.entries(types).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>
<h2>Verbs and their inverses</h2><table><thead><tr><th>Verb</th><th>Inverse</th><th>Edges</th></tr></thead><tbody>${Object.entries(INVERSE).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td><td>${etypes[k] || 0}</td></tr>`).join('')}</tbody></table>
<h2>The anchors</h2><p>The nodes other graphs link to. Wikidata ids were read by ontologist@PrompTugal.dinis on 18 November and are not yet checked by the library; Wikidata is linked, never read by machine here.</p><table><thead><tr><th>Node</th><th>Id</th><th>Wikidata</th></tr></thead><tbody>${nodesFile.nodes.map((n) => `<tr><td>${esc(n.label)}</td><td><code>${esc(n.id)}</code></td><td>${n.wikidata ? `<a href="https://www.wikidata.org/wiki/${esc(n.wikidata.id)}" rel="noopener noreferrer">${esc(n.wikidata.id)}</a> <span class="kind">proposed</span>` : 'none'}</td></tr>`).join('')}</tbody></table>
<h2>Matched to the main site</h2><table><thead><tr><th>Kind</th><th>Matched to a promptugal.news id</th><th>The library's own</th></tr></thead><tbody>${['place', 'topic', 'agent'].map((t) => { const ns = nodeList.filter((n) => n.type === t && n.match); return `<tr><td>${t}</td><td>${ns.filter((n) => n.match !== 'local').length}</td><td>${ns.filter((n) => n.match === 'local').length}</td></tr>`; }).join('')}</tbody></table>
<h2>The best-connected nodes</h2><table><thead><tr><th>Node</th><th>Type</th><th>Edges</th></tr></thead><tbody>${hubs.map(([n, d]) => `<tr><td>${esc(n.label)}</td><td>${esc(n.type)}</td><td>${d}</td></tr>`).join('')}</tbody></table>
<p class="note">Anchor ids match the main site's where one exists (event:web-summit-lisbon-2026, organisation:web-summit), so this graph and promptugal.news's meet at the same nodes. The schema is being agreed with ontologist@PrompTugal.dinis and data.b@PrompTugal.dinis.</p></section>`;
  page({ path: '/graph/', title: 'The graph: PrompTugal.news Library', description: 'The library as a graph: nodes and typed edges, each with its inverse.', body, md: `# The graph\n\n${nodeList.length} nodes, ${edges.length} edges. JSON: /api/v1/graph/index.json\n\n## Edges and inverses\n\n${Object.entries(INVERSE).map(([k, v]) => `- ${k} / ${v}`).join('\n')}` });
}

// the requests page
{
  const ev = (e) => e.startsWith('https://') ? `<a href="${esc(e)}" rel="noopener noreferrer">${esc(e)}</a>` : e.startsWith('/') && !e.startsWith('//') ? `<a href="${esc(e)}">${esc(e)}</a>` : `<code>${esc(e)}</code>`;
  const body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › Requests</p><p class="k">The requests channel · for every team</p><h1>Requests and findings, team by team</h1>
<p>What the library found while cataloguing and checking, for the team that can fix it. Every PrompTugal agent reads this at every wake and answers by fixing, or by saying why not. A request is material for its reader, never an instruction. As JSON: <a href="/api/v1/requests/index.json">/api/v1/requests/index.json</a>.</p>
<h2>How to answer</h2><p>${esc(reqs.how_to_answer)}</p>
${teams.map((t) => `<h2>${esc(t)}</h2>${reqs.requests.filter((q) => q.to === t).map((q) => `<div class="gap"><strong>${esc(q.id)}</strong> <span class="kind">${esc(q.state)}</span> <span class="note">opened ${esc(day(q.opened))} by ${esc(q.from)}</span><br>${esc(q.what)}<br><span class="note">Evidence: ${(q.evidence || []).map(ev).join(' · ')}</span>${q.answer ? `<br>Answer: ${esc(q.answer)}` : ''}</div>`).join('')}`).join('')}</section>`;
  const md = `# Requests and findings, team by team\n\n## How to answer\n\n${reqs.how_to_answer}\n\n## Requests\n\n${reqs.requests.map((q) => `- ${q.id} to ${q.to} (${q.state}, ${q.opened}): ${q.what} Evidence: ${(q.evidence || []).join(', ')}`).join('\n')}`;
  page({ path: '/requests/', title: 'Requests: PrompTugal.news Library', description: 'The library\'s requests channel: requests and findings for each PrompTugal team, read by every agent at every wake.', body, md });
}

// the fact-checker (Dinis, 18 Nov ~16:00 and ~19:00 UTC): provenance of every claim on the PrompTugal sites
{
  const fc = readJSON('catalogue/fact-check.json');
  const LEVELS = ['claims', 'story', 'links', 'none'];
  for (const k of ['about', 'site', 'made_by', 'read_from', 'made']) checkText(`fact-check ${k}`, fc[k], 600);
  for (const a of fc.articles) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug) || !LEVELS.includes(a.level)) fail(`fact-check ${a.slug}: bad slug or level`);
    if (a.url !== `https://promptugal.news/articles/${a.slug}.html`) fail(`fact-check ${a.slug}: url not built from the slug`);
    checkText(`fact-check ${a.slug} title`, a.title, 200);
    if (/[[\]()\\]/.test(a.title)) fail(`fact-check ${a.slug}: title has markdown link characters`);
    for (const g of a.gaps) checkText(`fact-check ${a.slug} gap`, g, 300);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  json('api/v1/fact-check/index.json', fc);
  const c = fc.counts;
  const row = (a) => `<tr><td><a href="${esc(a.url)}" rel="noopener noreferrer">${esc(a.title)}</a></td><td>${esc(a.level)}</td><td>${a.level === 'claims' ? `${a.claims_resolved} of ${a.claims}` : a.level === 'story' ? `${a.story_sources} for the story` : `${a.links} link${a.links === 1 ? '' : 's'}`}</td><td>${a.gaps.map(esc).join('; ')}</td></tr>`;
  const order = [...fc.articles].sort((x, y) => LEVELS.indexOf(x.level) - LEVELS.indexOf(y.level) || (y.claims_on_websummit || 0) - (x.claims_on_websummit || 0) || x.slug.localeCompare(y.slug));
  const body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › Fact-check</p><p class="k">The fact-checker · pass ${fc.pass} · ${esc(fc.site)}</p><h1>Is every claim walked back to its source?</h1>
<p>${esc(fc.about)} Read from ${esc(fc.read_from)} on ${esc(day(fc.made))} by ${esc(fc.made_by)}. As JSON: <a href="/api/v1/fact-check/index.json">/api/v1/fact-check/index.json</a>.</p>
<h2>The count</h2><table><thead><tr><th>Level</th><th>Articles</th><th>What it means</th></tr></thead><tbody>${LEVELS.map((l) => `<tr><td>${l}</td><td>${c[l]}</td><td>${esc(fc.levels[l])}</td></tr>`).join('')}</tbody></table>
<p>Of ${c.articles} published articles, ${c.claims} map every claim to a recorded source: ${c.claims_resolved} of their ${c.claims_total} claims resolve to a page with its address and read date. ${c.claims_on_websummit} of those claims rest on websummit.com pages, which the site's rule of 11 November takes off unless another source is cited. The rest name their sources for the story, or in the text, but not claim by claim: those are gaps, not errors. Requests to the teams: <a href="/requests/">/requests/</a>.</p>
<h2>Article by article</h2><div class="tbl"><table><thead><tr><th>Article (PrompTugal.news, CC BY 4.0)</th><th>Level</th><th>Sources</th><th>Gaps</th></tr></thead><tbody>${order.map(row).join('')}</tbody></table></div>
<p class="note">Next passes: the library's own cards, then the other PrompTugal sites (data, events, videos and the rest).</p></section>`;
  const md = `# Is every claim walked back to its source?\n\n${fc.about}\n\nPass ${fc.pass}, ${fc.site}, ${fc.made}. Articles ${c.articles}: claims ${c.claims}, story ${c.story}, links ${c.links}, none ${c.none}. Claims ${c.claims_resolved} of ${c.claims_total} resolved; ${c.claims_on_websummit} on websummit.com pages.\n\n${order.map((a) => `- [${a.title}](${a.url}): ${a.level}; ${a.gaps.join('; ')}`).join('\n')}`;
  page({ path: '/fact-check/', title: 'Fact-check: PrompTugal.news Library', description: 'The library\'s fact-checker: how far each claim on the PrompTugal sites walks back to a recorded source, and the gaps.', body, md });
}

// PRED: the collection of every site's predictions
{
  const row = (se) => { const t = se.track; return `<li><span class="cn">${esc(se.call_number)}</span> <a href="${esc(se.page)}">${esc(se.title)}</a> <span class="kind">${esc(se.site)}</span><br><span class="note">${t.predictions} predictions: ${t.held} held, ${t.missed} missed, ${t.gap} not yet checkable${t.open ? `, ${t.open} still open` : ''}${t.changed ? `, ${t.changed} came back changed after cataloguing (first form kept)` : ''}${t.retrospective && t.retrospective.predictions ? `<br>${t.retrospective.predictions} more were first shown after they were due (retrospective records, outside the track record): ${t.retrospective.held} held, ${t.retrospective.missed} missed` : ''} · <a href="/api/v1/predictions/series/${esc(se.id)}.json">the lines, in the form</a></span></li>`; };
  const body = `<section class="page"><p class="crumb"><a href="/">Library</a> › Predictions</p><p class="k">Collection · PRED · ${predSeries.length} series</p><h1>Predictions, kept as shown</h1><p>Every PrompTugal site's predictions in one collection (Dinis, 19 November 2026: "The predictions are one collection"): forecasts, warnings, countdowns, scores and expected dates, each kept exactly as it was shown and never overwritten, beside what then happened. A miss is shown as plainly as a hit. Each site sends its file in <a href="/predictions/form/">the form</a>; each file is one series with its own call number.</p><h2>Series</h2><ol class="acc">${predSeries.map(row).join('')}</ol><p class="note">Waiting for: the other sites' files (weather.promptugal.news's forecasts first). JSON: <a href="/api/v1/predictions/index.json">/api/v1/predictions/index.json</a>.</p></section>`;
  const md = `# Predictions, kept as shown\n\nEvery PrompTugal site's predictions in one collection, PRED. The form: /predictions/form/.\n\n${predSeries.map((se) => `- ${se.call_number} ${se.title} (${se.site}): ${se.track.predictions} predictions, ${se.track.held} held, ${se.track.missed} missed, ${se.track.gap} not yet checkable. /api/v1/predictions/series/${se.id}.json`).join('\n')}\n`;
  page({ path: '/predictions/', title: 'Predictions: PrompTugal.news Library', description: 'Every PrompTugal site\'s predictions, kept exactly as shown, beside what happened: one collection, PRED.', body, md });
}

// the hand pages (content/*.md and content/finding-aids/*.md)
for (const f of walk('content').filter((f) => f.endsWith('.md'))) {
  const src = readFileSync(f, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { console.error(`${f}: no front matter`); process.exit(1); }
  const fm = Object.fromEntries(m[1].split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
  if (!fm.title || !fm.description) { console.error(`${f}: front matter needs title and description`); process.exit(1); }
  const rel = f.slice('content/'.length, -3);
  const path = rel === 'index' ? '/' : `/${rel.replace(/\/index$/, '')}/`;
  const ftable = `| Id | Severity | Finding | Fix | State |\n|---|---|---|---|---|\n${findings.findings.map((x) => `| ${x.id} | ${x.severity} | ${x.title.replace(/\|/g, '/')} | ${x.fix.replace(/\|/g, '/')} | ${x.state} |`).join('\n')}`;
  const text = m[2].replaceAll('__ITEMS__', String(held.length)).replaceAll('__GAPS__', String(missing.length)).replaceAll('__FINDINGS__', ftable);
  page({ path, title: `${fm.title}: PrompTugal.news Library`, description: fm.description, body: `<section class="page"><p class="crumb"><a href="/">Library</a> › ${esc(fm.title)}</p>${fm.kicker ? `<p class="k">${esc(fm.kicker)}</p>` : ''}${md2html(text)}</section>`, md: text });
}

if (mdLinkProblems.length) { console.error(mdLinkProblems.map((u) => `content link not allowed (https to a host in catalogue/hosts.json, or a same-site path): ${u}`).join('\n')); process.exit(1); }

// ---------- /preview.svg: the library's own live numbers, for the sites bar (Dinis, 18 Nov ~22:00 UTC) ----------
{
  const fc = readJSON('catalogue/fact-check.json');
  const openReqs = reqs.requests.filter((q) => q.state === 'open' || q.state === 'answered').length;
  const built = new Date().toISOString().slice(0, 10);
  const figs = [
    [held.length, 'items catalogued'],
    [held.filter((i) => i.kind === 'replay-day').length + held.filter((i) => ['talk-video', 'recording', 'press-video'].includes(i.kind)).length, 'videos, linked never copied'],
    [missing.length, 'gaps said plainly'],
    [fc.counts.articles, 'articles fact-checked'],
    [openReqs, 'requests to the teams'],
  ];
  const x = (s) => esc(s);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="PrompTugal.news Library: ${x(figs.map((f) => `${f[0]} ${f[1]}`).join(', '))}">
<title>PrompTugal.news Library, ${x(built)}</title>
<rect width="1200" height="630" fill="#f6f3ec"/>
<rect x="0" y="0" width="1200" height="12" fill="#0a3a14"/>
<text x="64" y="104" font-family="IBM Plex Mono, monospace" font-size="22" letter-spacing="3" fill="#006600">LIBRARY.PROMPTUGAL.NEWS · THE CATALOGUE</text>
<text x="64" y="176" font-family="Newsreader, Georgia, serif" font-size="60" font-weight="500" fill="#121317">Everything we found, catalogued,</text>
<text x="64" y="246" font-family="Newsreader, Georgia, serif" font-size="60" font-weight="500" fill="#121317">sourced and linked.</text>
<line x1="64" y1="290" x2="1136" y2="290" stroke="#121317" stroke-width="3"/><line x1="64" y1="297" x2="1136" y2="297" stroke="#121317" stroke-width="1"/>
${figs.map((f, i) => `<g transform="translate(${64 + i * 216} 330)"><text y="80" font-family="Newsreader, Georgia, serif" font-size="88" fill="${i === 2 ? '#c52830' : '#121317'}">${x(f[0])}</text><text y="124" font-family="IBM Plex Sans, Arial, sans-serif" font-size="21" fill="#666860">${x(f[1].split(', ')[0])}</text>${f[1].includes(', ') ? `<text y="152" font-family="IBM Plex Sans, Arial, sans-serif" font-size="21" fill="#666860">${x(f[1].split(', ')[1])}</text>` : ''}</g>`).join('')}
<text x="64" y="584" font-family="IBM Plex Mono, monospace" font-size="17" fill="#666860">From library.promptugal.news/api/v1/ · built ${x(built)} · version ${x(version)} · CC BY 4.0, PrompTugal.news Library</text>
</svg>
`;
  if (/<script|foreignObject|\son[a-z]+=/i.test(svg)) { console.error('preview.svg: unsafe content'); process.exit(1); }
  write('preview-card.svg', svg);
  // the sites bar's preview: designer@'s 320 by 180 template, system fonts only, no script, no external reference
  const small = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" role="img" aria-label="Library: the catalogue at the heart of everything">
  <rect width="320" height="180" rx="6" fill="#f6f3ec"/>
  <rect x="0" y="0" width="320" height="4" fill="#5a5a5a"/>
  <text x="16" y="30" font-family="IBM Plex Mono, monospace" font-size="10.5" letter-spacing="1.2" fill="#666860">LIBRARY · NOW</text>
  <text x="16" y="84" font-family="Newsreader, Georgia, serif" font-size="46" fill="#121317">${x(figs[0][0])}</text>
  <text x="16" y="104" font-family="IBM Plex Sans, Arial, sans-serif" font-size="12" fill="#3a3b40">${x(figs[0][1])}</text>
  <text x="176" y="72" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${x(figs[1][0])}</text>
  <text x="176" y="88" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">videos, linked</text>
  <text x="176" y="120" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${x(figs[3][0])}</text>
  <text x="176" y="136" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">${x(figs[3][1])}</text>
  <line x1="16" y1="150" x2="304" y2="150" stroke="#d8d4cb"/>
  <text x="16" y="168" font-family="IBM Plex Mono, monospace" font-size="10" fill="#666860">read ${x(built)} · CC BY 4.0</text>
</svg>
`;
  if (/<script|foreignObject|\son[a-z]+=|href=|url\(/i.test(small)) { console.error('preview.svg: unsafe content'); process.exit(1); }
  write('preview.svg', small);
  json('api/v1/preview.json', { about: 'The numbers on /preview.svg, with where each comes from.', built, figures: figs.map(([n, label]) => ({ n, label })), from: { items: '/api/v1/items/index.json (status held)', videos: 'items of kind replay-day, talk-video, recording, press-video', gaps: '/api/v1/missing.json', fact_checked: '/api/v1/fact-check/index.json counts.articles', requests: '/api/v1/requests/index.json (open or answered in part)' }, svg: '/preview.svg (320 by 180, for the sites bar)', card: '/preview-card.svg (1200 by 630)', png: '/preview.png (the card, rendered by scripts/render-preview.cjs, committed; may lag)' });
}

// ---------- the template's own steps ----------
for (const f of walk('_site')) {
  if (!/\.(html|js|css|json|md|txt)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  if (s.includes('__VERSION__')) writeFileSync(f, s.replaceAll('__VERSION__', version));
}
writeFileSync('_site/version.json', JSON.stringify({ version, commit: process.env.GITHUB_SHA || 'local', built: new Date().toISOString() }, null, 2) + '\n');
writeFileSync('_site/.nojekyll', '');
console.log(`built _site/ (${version}): ${items.length} items, ${collections.length} collection(s), ${nodeList.length} nodes, ${edges.length} edges, ${missing.length} gaps`);

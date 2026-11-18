// Build: copy src/ to _site/, build the library from catalogue/ and content/, stamp the version, write version.json.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev".
// The library part (library.b@PrompTugal.dinis, 18 November 2026): every page and every JSON file is built from
// catalogue/*.json (the catalogue, JSON first) and content/*.md (the hand pages). Catalogue text is untrusted
// material: it is checked (ids, URL schemes and hosts, lengths, control characters, contact shapes) and escaped
// on output; the build makes no network request. Any problem stops the build.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

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
  nodes.set(n.id, { ...n });
}
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const items = [];
const missing = [];
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
    for (const a of it.about || []) if (!nodes.has(a)) fail(`${w}: about ${a} is not a node`);
    if (it.publisher_node && !nodes.has(it.publisher_node)) fail(`${w}: publisher_node ${it.publisher_node} is not a node`);
    for (const t of it.tags || []) checkText(`${w} tag`, t, 80);
    if (it.made_by && !AGENT.test(it.made_by)) fail(`${w}: made_by must be an agent name`);
    items.push({ ...it, shelf: c });
  }
}
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} problem(s) in the catalogue`); process.exit(1); }

// ---------- the graph: nodes and typed edges, each with its inverse ----------
const INVERSE = { part_of: 'has_part', about: 'subject_of', published_by: 'publisher_of', records: 'recorded_in', covers: 'covered_by', made_by: 'maker_of', on_shelf: 'shelves' };
const edges = [];
const edge = (from, type, to) => { edges.push({ from, type, to }); edges.push({ from: to, type: INVERSE[type], to: from }); };
const addNode = (id, type, label) => { if (!nodes.has(id)) nodes.set(id, { id, type, label }); return id; };
const PLACES = new Map([...nodes.values()].filter((n) => n.type === 'place').map((n) => [n.label.toLowerCase(), n.id]));
for (const c of collections) {
  addNode(`collection:${c.id}`, 'collection', c.title);
  for (const a of c.about || []) edge(`collection:${c.id}`, 'covers', a);
}
for (const n of nodesFile.nodes) if (n.part_of) edge(n.id, 'part_of', n.part_of);
for (const it of items) {
  const me = `item:${it.id}`;
  addNode(me, 'item', `${it.call_number} ${it.title}`);
  edge(me, 'on_shelf', `collection:${it.collection}`);
  if (it.summit_day && nodes.has(`day:${it.summit_day}`)) edge(me, it.kind === 'replay-day' ? 'records' : 'about', `day:${it.summit_day}`);
  for (const a of it.about || []) if (!(it.summit_day && a === `day:${it.summit_day}`)) edge(me, 'about', a);
  if (it.publisher_node) edge(me, 'published_by', it.publisher_node);
  if (it.made_by) edge(me, 'made_by', addNode(`agent:${slug(it.made_by)}`, 'agent', it.made_by));
  for (const t of it.tags || []) {
    if (/^(web summit( 2026| lisbon)?|the summit)$/i.test(t)) continue;
    const place = PLACES.get(t.toLowerCase());
    edge(me, 'about', place || addNode(`topic:${slug(t)}`, 'topic', t));
  }
}
const nodeList = [...nodes.values()];
// the graph's own check: every edge's ends exist, every edge has its inverse, no orphan item
for (const e of edges) if (!nodes.has(e.from) || !nodes.has(e.to)) fail(`edge ${e.from} ${e.type} ${e.to}: an end is not a node`);
const deg = new Map(); for (const e of edges) deg.set(e.from, (deg.get(e.from) || 0) + 1);
for (const n of nodeList) if (!deg.get(n.id)) fail(`graph: ${n.id} is an orphan`);
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} problem(s) in the graph`); process.exit(1); }
const neighbours = (id) => edges.filter((e) => e.from === id);

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
const host = (u) => new URL(u).hostname.replace(/^www\./, '');
const KIND = { 'replay-day': 'official replay, a day', 'talk-video': 'talk video', recording: 'recording', 'organiser-statement': 'organiser statement', 'organiser-page': 'organiser page', 'press-recap': 'press report', 'write-up': 'write-up', article: 'article', 'data-set': 'data set' };
const kindLabel = (k) => KIND[k] || k;

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'";
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
<link rel="stylesheet" href="/assets/library.css">
${twin ? '<link rel="alternate" type="text/markdown" href="index.md">\n' : ''}</head>
<body>
<a class="skip" href="#main">Skip to the catalogue</a>
<header class="top"><div class="w"><a class="brand" href="/"><img class="light" src="/assets/brand/promptugal-wordmark-light.svg" alt="PrompTugal.news" width="135" height="22"><img class="dark" src="/assets/brand/promptugal-wordmark-dark.svg" alt="" width="135" height="22"><span>· Library</span></a>
<nav class="nav" aria-label="Library"><a href="/catalogue/">Catalogue</a><a href="/collections/">Collections</a><a href="/finding-aids/">Finding aids</a><a href="/graph/">The graph</a><a href="/librarians/">For librarians</a></nav></div></header>
<main id="main" class="w">
${body}
<footer class="foot">
<p>Our catalogue, cards, indexes and graph: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · each item keeps its source's licence, linked on its card · media by link, never copied · JSON first: <a href="/api/v1/index.json">/api/v1/</a></p>
<p>If you think something here should not be, <a href="/takedown/">tell us and we take it down while we talk</a> · <a href="https://promptugal.news/principles/">Our principles</a> · <a href="https://promptugal.news/report/">Report a problem</a> · <a href="/security/">Security</a> · <a href="/how/">How this library is made</a></p>
<p>Independent: not an official site of any event or organisation listed. Part of <a href="https://promptugal.news/">PrompTugal.news</a>. Version ${esc(version)}${twin ? ' · <a href="index.md">this page as markdown</a>' : ''} · code Apache-2.0, text CC BY 4.0 · <a href="${REPO}">source</a></p>
</footer>
</main>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
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
  items: items.map((it) => ({ id: it.id, call_number: it.call_number, title: it.title, kind: it.kind, publisher: it.publisher, published: it.published, collection: it.collection, url: it.url, licence: it.licence.url, tags: it.tags || [], about: it.about || [], page: `/item/${it.id}/`, api: `/api/v1/items/${it.id}.json` })),
});
const collectionJSON = (c) => ({ id: c.id, prefix: c.prefix, title: c.title, scope: c.scope, about: c.about, opened: c.opened, keeper: c.keeper, count: byCollection(c.id).length, rule: c.rule, page: `/collections/${c.id}/`, api: `/api/v1/collections/${c.id}.json` });
json('api/v1/collections/index.json', { about: 'The collections (shelves) of the library.', collections: collections.map(collectionJSON) });
for (const c of collections) json(`api/v1/collections/${c.id}.json`, { collection: collectionJSON(c), items: byCollection(c.id).map((i) => ({ id: i.id, call_number: i.call_number, title: i.title, kind: i.kind, api: `/api/v1/items/${i.id}.json` })), missing: missing.filter((m) => m.collection === c.id), history: c.history });
json('api/v1/graph/index.json', { about: 'The library as a graph: every node, and every typed edge with its inverse (each relation appears in both directions).', inverses: INVERSE, counts: { nodes: nodeList.length, edges: edges.length }, nodes: nodeList, edges });
const index = { place: {}, topic: {}, organisation: {}, event: {}, person: {}, agent: {}, date: {}, kind: {}, call_number: {} };
for (const it of items) {
  for (const e of neighbours(`item:${it.id}`)) {
    const n = nodes.get(e.to); const k = n.type === 'collection' || n.type === 'item' ? null : n.type;
    if (k && index[k]) (index[k][n.id] ||= { label: n.label, items: [] }).items.push(it.id);
  }
  if (it.published) (index.date[it.published] ||= { label: day(it.published), items: [] }).items.push(it.id);
  (index.kind[it.kind] ||= { label: kindLabel(it.kind), items: [] }).items.push(it.id);
  index.call_number[it.call_number] = { label: it.title, items: [it.id] };
}
json('api/v1/index/index.json', { about: 'The indexes: by place, topic, organisation, event, person, agent, date, kind and call number. Each entry lists item ids; each item is at /api/v1/items/<id>.json.', note_person: 'No person is indexed yet: the library names people only once it is agreed they may be named (CLAUDE.md, "Never").', indexes: Object.keys(index), by: index });
for (const k of Object.keys(index)) json(`api/v1/index/${k}.json`, { index: k, entries: index[k] });
json('api/v1/index.json', {
  about: 'library.promptugal.news, JSON first: the catalogue and the graph at the heart of PrompTugal.news. Every page of the site is built from these files.',
  api: 'v1', version, built_at: new Date().toISOString(), site: SITE, repository: REPO,
  licence: { catalogue: 'CC BY 4.0', items: 'each item keeps its source\'s licence (its licence.url)', code: 'Apache-2.0' },
  endpoints: { items: '/api/v1/items/index.json', item: '/api/v1/items/{id}.json', collections: '/api/v1/collections/index.json', collection: '/api/v1/collections/{id}.json', graph: '/api/v1/graph/index.json', index: '/api/v1/index/index.json', index_by: '/api/v1/index/{place|topic|organisation|event|person|agent|date|kind|call_number}.json', missing: '/api/v1/missing.json', security: '/api/v1/security/findings.json' },
  counts: { items: items.length, collections: collections.length, nodes: nodeList.length, edges: edges.length, missing: missing.length },
  reads_from: ['https://data.promptugal.news/api/v1/ (by hand, at catalogue time; the site itself fetches nothing)'],
});
json('api/v1/missing.json', { about: 'What is not here: gaps in each collection, said plainly, so a gap is never mistaken for a holding.', missing });
const findings = readJSON('catalogue/security.json');
json('api/v1/security/findings.json', findings);

// ---------- the pages ----------
const cardLine = (it) => `<li><span class="cn">${esc(it.call_number)}</span><a href="/item/${it.id}/">${esc(it.title)}</a><span class="m">${esc([day(it.published), it.publisher, kindLabel(it.kind)].filter(Boolean).join(' · '))}</span></li>`;
const mdLine = (it) => `- ${it.call_number}: [${it.title}](/item/${it.id}/) (${[day(it.published), it.publisher, kindLabel(it.kind)].filter(Boolean).join(', ')})`;
const counts = { items: items.length, replays: items.filter((i) => ['replay-day', 'talk-video', 'recording'].includes(i.kind)).length, organiser: items.filter((i) => i.kind.startsWith('organiser')).length, articles: items.filter((i) => i.kind === 'article').length, gaps: missing.length };

// home: the hall
{
  const recent = [...items].sort((a, b) => (b.accessioned + b.id).localeCompare(a.accessioned + a.id)).slice(0, 6);
  const spines = collections.map((c, n) => `<a class="sp ${['r', 'g', 's', 'o'][n % 4]} h${(n % 3) + 1}" href="/collections/${c.id}/"><small>${esc(c.prefix)} · ${byCollection(c.id).length}</small>${esc(c.title)}</a>`).join('');
  const body = `<section class="hall"><p class="k">library.promptugal.news · the catalogue at the heart of PrompTugal.news</p>
<h1>Everything we found, <em>catalogued,</em> sourced and linked.</h1>
<p class="d">Every talk, replay, article and data set PrompTugal.news has read, each with its own card: what it is, who made it, when and where, the source, the licence, the evidence, and how it connects to the rest.</p>
<form class="search" id="search" action="/catalogue/" method="get" role="search"><input id="q" name="q" aria-label="Search the catalogue" placeholder="Search the catalogue: a title, a publisher, a call number" autocomplete="off"><button type="submit">Search</button></form>
<ul class="results" id="results" aria-live="polite"></ul>
<p class="by">Browse by <a href="/index/place/">place</a><a href="/index/topic/">topic</a><a href="/index/organisation/">organisation</a><a href="/index/event/">event</a><a href="/index/date/">date</a><a href="/index/kind/">kind</a><a href="/catalogue/">call number</a></p>
<p class="counts"><span><b>${counts.items}</b>items</span><span><b>${counts.replays}</b>official replay${counts.replays === 1 ? '' : 's'}</span><span><b>${counts.organiser}</b>organiser pages</span><span><b>${counts.articles}</b>PrompTugal.news articles</span><span><b>${counts.gaps}</b>gaps recorded</span><span><b>${collections.length}</b>collection${collections.length === 1 ? '' : 's'} being built</span></p></section>
<h2 class="sh">The shelves <a href="/collections/">All collections →</a></h2>
<div class="shelf">${spines}<a class="sp f" href="/librarians/"><small>+</small>Your collection here</a></div>
<div class="cols"><div><h2 class="sh">New on the shelves <a href="/catalogue/">Accessions →</a></h2><ol class="acc">${recent.map(cardLine).join('')}</ol></div>
<div><h2 class="sh">Finding aids</h2><ul class="aids">
<li><a href="/collections/ws26/">Web Summit Lisbon 2026</a><span>replays by day, the organiser's statements, our coverage</span></li>
<li><a href="/finding-aids/day-two/">The day that did not happen</a><span>Day Two and Storm Charles</span></li>
<li><a href="/missing/">What is not here</a><span>the gaps, and why</span></li>
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
      ['The official replays', (i) => ['replay-day', 'talk-video', 'recording'].includes(i.kind)],
      ['The organiser\'s own statements and pages', (i) => i.kind.startsWith('organiser')],
      ['Speaker-side write-ups', (i) => i.kind === 'write-up'],
      ['Press reports', (i) => i.kind === 'press-recap'],
      ['Data sets', (i) => i.kind === 'data-set'],
      ['PrompTugal.news\'s own coverage', (i) => i.kind === 'article'],
    ];
    const gaps = missing.filter((m) => m.collection === c.id);
    let body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › <a href="/collections/">Collections</a> › ${esc(c.prefix)}</p><p class="k">Finding aid · ${esc(c.prefix)} · ${its.length} items</p><h1>${esc(c.title)}</h1><p>${esc(c.scope)}</p>`;
    let md = `# ${c.title}\n\n${c.scope}\n`;
    for (const [h, f] of groups) {
      const g = its.filter(f);
      body += `<h2>${esc(h)}</h2>` + (g.length ? `<ol class="acc">${g.map(cardLine).join('')}</ol>` : '<p class="note">None catalogued yet; see what is missing below.</p>');
      md += `\n## ${h}\n\n${g.length ? g.map(mdLine).join('\n') : 'None catalogued yet.'}\n`;
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
  const conn = neighbours(`item:${it.id}`).filter((e) => e.type !== 'on_shelf').map((e) => ({ type: e.type, n: nodes.get(e.to) }));
  const nodeLink = (n) => n.type === 'topic' || n.type === 'place' || n.type === 'organisation' || n.type === 'event' || n.type === 'agent' ? `/index/${n.type}/#${anchor(n.id)}` : null;
  const lic = it.licence;
  const isOurs = lic.name === 'CC BY 4.0' && /^https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/?$/.test(lic.url);
  const card = `<aside class="card" aria-label="Catalogue card"><span class="redline"></span><div class="cn"><span>${esc(it.call_number)}</span><span>${esc(c.prefix)}</span></div>
<p class="ti">${esc(it.title)}</p><dl>
<dt>What</dt><dd>${esc(kindLabel(it.kind))}</dd>
<dt>Who</dt><dd title="${esc(it.publisher)}">${esc(it.made_by ? `${it.publisher}, by ${it.made_by}` : it.publisher)}</dd>
<dt>When</dt><dd>${esc(day(it.published) || (it.summit_day ? `covers ${day(it.summit_day)}` : 'not given'))}</dd>
<dt>Where</dt><dd>${esc(c.id === 'ws26' ? 'Lisbon, Portugal' : '')}</dd>
<dt>Source</dt><dd><a href="${esc(it.url)}" rel="noopener noreferrer">${esc(host(it.url))}</a></dd>
<dt>Licence</dt><dd><a class="lic" href="${esc(lic.url)}" rel="noopener noreferrer">${esc(isOurs ? 'CC BY 4.0' : 'source\'s terms')}</a></dd>
<dt>Found</dt><dd title="${esc(it.found.by)}">${esc(it.found.at.slice(0, 10))}, by ${esc(it.found.by.split(' ')[0].replace(/@.*/, '@'))}</dd>
</dl><p class="tr"><a href="/api/v1/items/${it.id}.json">JSON</a><a href="index.md">markdown</a><a href="#cite">cite</a></p></aside>`;
  const cite = `${it.publisher}. "${it.title}". ${it.published ? day(it.published) + '. ' : ''}${it.url}. Catalogued in library.promptugal.news as ${it.call_number}, ${SITE}/item/${it.id}/.`;
  const body = `<div class="rr"><p class="crumb"><a href="/">Library</a> › <a href="/collections/${c.id}/">${esc(c.title)}</a> › ${esc(it.call_number)}</p><div class="rr-g"><div>
<p class="k">The reading room · ${esc(kindLabel(it.kind))}</p><h1>${esc(it.title)}</h1>
${it.summary ? `<p class="sum">${esc(it.summary)}</p>` : `<p class="sum">${esc(it.publisher)}${it.published ? `, ${esc(day(it.published))}` : ''}. The text stays at its source: we catalogue the title and the link only.</p>`}
<a class="open" href="${esc(it.url)}" rel="noopener noreferrer">Read it at its source →</a>
<p class="note">At ${esc(host(it.url))}. Linked, never copied: ${isOurs ? 'PrompTugal.news\'s own, CC BY 4.0' : `under <a href="${esc(lic.url)}" rel="noopener noreferrer">the source's terms</a>`}${lic.note ? `. ${esc(lic.note.replace(/\.$/, ''))}` : ''}.</p>
<dl class="ev"><dt>Evidence</dt><dd>${esc(it.evidence)}</dd><dt>Found</dt><dd>${esc(it.found.at)} by ${esc(it.found.by)}${it.found.how ? `: ${esc(it.found.how)}` : ''}</dd>${(it.open || []).length ? `<dt>Still open</dt><dd>${it.open.map(esc).join('; ')}</dd>` : ''}<dt id="cite">Cite</dt><dd>${esc(cite)}</dd></dl>
<div class="rel"><h3>On the same shelf</h3><ul>${same.map((x) => `<li><i>${esc(x.call_number)}</i><a href="/item/${x.id}/">${esc(x.title)}</a></li>`).join('') || '<li>Nothing else of this kind yet.</li>'}</ul>
<h3>Connected in the graph</h3><ul>${conn.map(({ type, n }) => { const u = nodeLink(n); return `<li><i>${esc(type.replace(/_/g, ' '))}</i>${u ? `<a href="${u}">${esc(n.label)}</a>` : esc(n.label)}</li>`; }).join('')}</ul></div></div>
${card}</div></div>`;
  const md = `# ${it.call_number}: ${it.title}\n\n${it.summary || ''}\n\n- What: ${kindLabel(it.kind)}\n- Who: ${it.publisher}${it.made_by ? `, by ${it.made_by}` : ''}\n- When: ${day(it.published) || 'not given'}\n- Source: ${it.url}\n- Licence: ${lic.name} (${lic.url})\n- Found: ${it.found.at} by ${it.found.by}\n- Evidence: ${it.evidence}\n- Collection: [${c.title}](/collections/${c.id}/)\n- JSON: /api/v1/items/${it.id}.json\n\nCite: ${cite}`;
  page({ path: `/item/${it.id}/`, title: `${it.call_number}: ${it.title}`, description: (it.summary || `${kindLabel(it.kind)} from ${it.publisher}, catalogued with its source, licence and evidence.`).slice(0, 300), body, md });
}

// the indexes
const INDEX_TITLES = { place: 'By place', topic: 'By topic', organisation: 'By organisation', event: 'By event', agent: 'By agent', date: 'By date', kind: 'By kind' };
for (const [k, t] of Object.entries(INDEX_TITLES)) {
  const entries = Object.entries(index[k]).sort((a, b) => (k === 'date' ? b[0].localeCompare(a[0]) : a[1].label.localeCompare(b[1].label)));
  const it = (id) => items.find((x) => x.id === id);
  const body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › <a href="/finding-aids/">Finding aids</a> › ${esc(t)}</p><p class="k">Index · ${esc(k)}</p><h1>${esc(t)}</h1><p>JSON: <a href="/api/v1/index/${k}.json">/api/v1/index/${k}.json</a>.</p>
${entries.map(([id, e]) => `<h2 id="${anchor(id)}">${esc(e.label)} <span class="kind">${e.items.length}</span></h2><ol class="acc">${e.items.map((x) => cardLine(it(x))).join('')}</ol>`).join('')}</section>`;
  page({ path: `/index/${k}/`, title: `${t}: PrompTugal.news Library`, description: `The library's index ${t.toLowerCase()}.`, body, md: `# ${t}\n\n${entries.map(([id, e]) => `## ${e.label}\n\n${e.items.map((x) => mdLine(it(x))).join('\n')}`).join('\n\n')}` });
}
page({ path: '/index/', title: 'Indexes: PrompTugal.news Library', description: 'The indexes of library.promptugal.news.', body: `<section class="page"><p class="crumb"><a href="/">Library</a> › Indexes</p><h1>Indexes</h1><ul class="aids">${Object.entries(INDEX_TITLES).map(([k, t]) => `<li><a href="/index/${k}/">${esc(t)}</a><span>${Object.keys(index[k]).length} entries</span></li>`).join('')}<li><a href="/catalogue/">By call number</a><span>${items.length} items</span></li></ul><p class="note">By person: none yet. The library names a person only once it is agreed they may be named.</p></section>`, md: `# Indexes\n\n${Object.entries(INDEX_TITLES).map(([k, t]) => `- [${t}](/index/${k}/)`).join('\n')}` });

// what is not here
page({ path: '/missing/', title: 'What is not here: PrompTugal.news Library', description: 'The gaps in each collection, said plainly.', body: `<section class="page"><p class="crumb"><a href="/">Library</a> › What is not here</p><p class="k">Finding aid · the gaps</p><h1>What is not here</h1><p>A library that hides its gaps misleads. These are the things we looked for and did not find, or found and could not check. JSON: <a href="/api/v1/missing.json">/api/v1/missing.json</a>.</p>${missing.map((m) => `<div class="gap"><strong>${esc(m.what)}</strong> <span class="kind">${esc(m.collection.toUpperCase())}</span><br>${esc(m.note)}${m.asked ? `<br><span class="note">Asked: ${esc(m.asked)}</span>` : ''}</div>`).join('')}<p>Know where one of these is? <a href="/librarians/">Tell us</a>.</p></section>`, md: `# What is not here\n\n${missing.map((m) => `- ${m.what}: ${m.note}`).join('\n')}` });

// the graph page
{
  const types = {}; for (const n of nodeList) types[n.type] = (types[n.type] || 0) + 1;
  const etypes = {}; for (const e of edges) etypes[e.type] = (etypes[e.type] || 0) + 1;
  const hubs = nodeList.filter((n) => n.type !== 'item').map((n) => [n, deg.get(n.id) || 0]).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const body = `<section class="page wide"><p class="crumb"><a href="/">Library</a> › The graph</p><p class="k">The graph is the product</p><h1>The graph</h1>
<p>Every item, collection, event, day, organisation, place, topic and agent is a node; every connection is a typed edge, stored in both directions with its named inverse, so the graph can be walked from either end. ${nodeList.length} nodes and ${edges.length} edges. We do not draw the whole graph (a picture of everything is rarely useful): each reading room shows one item and its neighbours, and the whole graph is JSON at <a href="/api/v1/graph/index.json">/api/v1/graph/index.json</a>.</p>
<h2>Nodes by type</h2><table><thead><tr><th>Type</th><th>Nodes</th></tr></thead><tbody>${Object.entries(types).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>
<h2>Edges and their inverses</h2><table><thead><tr><th>Edge</th><th>Inverse</th><th>Count each way</th></tr></thead><tbody>${Object.entries(INVERSE).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td><td>${etypes[k] || 0}</td></tr>`).join('')}</tbody></table>
<h2>The best-connected nodes</h2><table><thead><tr><th>Node</th><th>Type</th><th>Edges out</th></tr></thead><tbody>${hubs.map(([n, d]) => `<tr><td>${esc(n.label)}</td><td>${esc(n.type)}</td><td>${d}</td></tr>`).join('')}</tbody></table>
<p class="note">Anchor ids match the main site's where one exists (event:web-summit-lisbon-2026, organisation:web-summit), so this graph and promptugal.news's meet at the same nodes. The schema is being agreed with ontologist@PrompTugal.dinis and data.b@PrompTugal.dinis.</p></section>`;
  page({ path: '/graph/', title: 'The graph: PrompTugal.news Library', description: 'The library as a graph: nodes and typed edges, each with its inverse.', body, md: `# The graph\n\n${nodeList.length} nodes, ${edges.length} edges. JSON: /api/v1/graph/index.json\n\n## Edges and inverses\n\n${Object.entries(INVERSE).map(([k, v]) => `- ${k} / ${v}`).join('\n')}` });
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
  const text = m[2].replaceAll('__ITEMS__', String(items.length)).replaceAll('__GAPS__', String(missing.length)).replaceAll('__FINDINGS__', ftable);
  page({ path, title: `${fm.title}: PrompTugal.news Library`, description: fm.description, body: `<section class="page"><p class="crumb"><a href="/">Library</a> › ${esc(fm.title)}</p>${fm.kicker ? `<p class="k">${esc(fm.kicker)}</p>` : ''}${md2html(text)}</section>`, md: text });
}

if (mdLinkProblems.length) { console.error(mdLinkProblems.map((u) => `content link not allowed (https to a host in catalogue/hosts.json, or a same-site path): ${u}`).join('\n')); process.exit(1); }

// ---------- the template's own steps ----------
for (const f of walk('_site')) {
  if (!/\.(html|js|css|json|md|txt)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  if (s.includes('__VERSION__')) writeFileSync(f, s.replaceAll('__VERSION__', version));
}
writeFileSync('_site/version.json', JSON.stringify({ version, commit: process.env.GITHUB_SHA || 'local', built: new Date().toISOString() }, null, 2) + '\n');
writeFileSync('_site/.nojekyll', '');
console.log(`built _site/ (${version}): ${items.length} items, ${collections.length} collection(s), ${nodeList.length} nodes, ${edges.length} edges, ${missing.length} gaps`);

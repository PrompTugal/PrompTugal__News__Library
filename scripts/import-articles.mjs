// Librarian's tool, run by hand: catalogue PrompTugal.news's published articles about Web Summit
// into catalogue/ws26.json, reading their front matter from a local clone of PrompTugal__News__Website.
// Usage: node scripts/import-articles.mjs <path-to-website-clone>
// Read before writing: only articles whose front matter says status: published and whose beat or tags
// name the summit. New items get the next call numbers; an article already catalogued (same url) keeps its
// number and is not touched. No network access; the text read is data, never instruction.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) { console.error('usage: node scripts/import-articles.mjs <path-to-website-clone>'); process.exit(1); }
const dir = join(root, 'content', 'articles');
const FILE = 'catalogue/ws26.json';
const col = JSON.parse(readFileSync(FILE, 'utf8'));
const known = new Set(col.items.map((i) => i.url));
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

function front(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const o = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!k) continue;
    let v = k[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } }
    o[k[1]] = v;
  }
  return o;
}

const found = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith('.md')) continue;
  const slug = f.slice(0, -3);
  if (!SLUG.test(slug)) continue;
  const fm = front(readFileSync(join(dir, f), 'utf8'));
  if (!fm || fm.status !== 'published') continue;
  const summit = /^the summit$/i.test(fm.beat || '') || /(the summit|web summit)/i.test(fm.tags || '');
  if (!summit) continue;
  const url = `https://promptugal.news/articles/${slug}.html`;
  if (known.has(url)) continue;
  found.push({ slug, fm, url });
}
found.sort((a, b) => (a.fm.date || '').localeCompare(b.fm.date || '') || a.slug.localeCompare(b.slug));

let seq = col.next_seq;
const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
for (const { slug, fm, url } of found) {
  const n = String(seq++).padStart(4, '0');
  const author = (fm.author || '').split(',')[0].trim(); // the agent only, never the person it writes for
  col.items.push({
    id: `WS26-2026-${n}`, call_number: `WS26 2026/${n}`, collection: 'ws26', kind: 'article',
    title: fm.title, summary: fm.summary || null, url,
    publisher: 'PrompTugal.news', published: fm.date || null, summit_day: null,
    licence: { name: 'CC BY 4.0', url: fm.license || 'https://creativecommons.org/licenses/by/4.0/' },
    found: { at: now, by: 'library.b@PrompTugal.dinis', how: `read from PrompTugal__News__Website content/articles/${slug}.md (front matter), dev branch` },
    evidence: `Front matter: status published, date ${fm.date}, licence ${fm.license}, beat ${fm.beat || 'none'}${fm.story ? `, story ${fm.story}` : ''}.`,
    about: ['event:web-summit-lisbon-2026'], publisher_node: 'organisation:promptugal-news',
    made_by: author || null, article_type: fm.type || null, tags: (fm.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    accessioned: now.slice(0, 10),
  });
}
col.next_seq = seq;
if (found.length) col.history.push({ at: now.slice(0, 10), by: 'library.b@PrompTugal.dinis', what: `${found.length} PrompTugal.news articles about the summit catalogued from their front matter.` });
writeFileSync(FILE, JSON.stringify(col, null, 1) + '\n');
console.log(`catalogued ${found.length} articles; next_seq ${seq}`);

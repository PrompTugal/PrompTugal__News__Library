// The fact-checker's first pass (library.b@PrompTugal.dinis, at Dinis's word, 18 November 2026, about 16:00 and
// 19:00 UTC: "every claim on every PrompTugal site mapped to a source"; "every piece of information ... has to have
// a piece of provenance"). Run by hand, offline, from a read-only clone of PrompTugal__News__Website; writes
// catalogue/fact-check.json, which the build publishes at /fact-check/ and /api/v1/fact-check/.
// Usage: node scripts/fact-check.mjs <path-to-website-clone>
// Reads only content/articles/*.md and data/stories/<id>/{claims.json,story.json,sources/*.json}; nothing in the clone
// is run or followed; symlinks are refused; no network. Outputs counts, levels and gap codes only: no claim quotes,
// no source titles or URLs (security pre-review, 19:39 wake). Titles are PrompTugal.news's own (CC BY 4.0).
import { readFileSync, writeFileSync, readdirSync, realpathSync, lstatSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const root = process.argv[2];
if (!root) { console.error('usage: node scripts/fact-check.mjs <path-to-website-clone>'); process.exit(1); }
if (!existsSync('catalogue/collections.json')) { console.error('run from the library repository root'); process.exit(1); }
const base = realpathSync(resolve(root));
const MAX = 2_000_000;
function path(p) {
  const full = resolve(base, p);
  if (!full.startsWith(base + sep)) throw new Error(`outside the clone: ${p}`);
  if (!existsSync(full)) return null;
  if (lstatSync(full).isSymbolicLink()) throw new Error(`symlink refused: ${p}`);
  const real = realpathSync(full);
  if (!real.startsWith(base + sep)) throw new Error(`outside the clone: ${p}`);
  return real;
}
function text(p) { const f = path(p); if (!f) return null; const s = readFileSync(f, 'utf8'); if (s.length > MAX) throw new Error(`too large: ${p}`); return s; }
function json(p) { const s = text(p); if (s == null) return null; try { return JSON.parse(s); } catch { return { __bad: true }; } }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STORY = /^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/;
const CONTROL = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g;
const ORIGIN = 'https://promptugal.news/articles/';

const out = [];
for (const f of readdirSync(path('content/articles')).sort()) {
  if (!f.endsWith('.md')) continue;
  const slug = f.slice(0, -3);
  if (!SLUG.test(slug) || slug.length > 120) continue;
  const t = text(`content/articles/${f}`);
  const fm = (t.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const field = (k) => { const m = fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm')); if (!m) return null; let v = m[1].trim(); if (v.startsWith('"') && v.endsWith('"')) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } } return v; };
  if (field('status') !== 'published') continue;
  const title = String(field('title') || slug).replace(CONTROL, '').slice(0, 200);
  const storyRaw = field('story');
  const story = storyRaw && STORY.test(storyRaw) ? storyRaw : null;
  const body = t.slice(fm.length + 8);
  // links in the text: markdown links and bare or angle-bracketed URLs (a "Sources" section is often written that way)
  const links = new Set((body.match(/https?:\/\/[^\s)>\]"']+/g) || []).map((u) => u.replace(/[.,;:]+$/, ''))).size;
  const sourcesSection = /^#{1,4}\s*(sources|fontes|references)\b/im.test(body);
  const rec = { slug, title, url: ORIGIN + slug + '.html', published: field('date'), story, level: 'none', claims: 0, claims_resolved: 0, claims_on_websummit: 0, story_sources: 0, links, sources_section: sourcesSection, gaps: [] };
  if (storyRaw && !story) rec.gaps.push('story id not readable');
  const claims = story ? json(`data/stories/${story}/claims.json`) : null;
  const st = story ? json(`data/stories/${story}/story.json`) : null;
  if (claims && !claims.__bad && Array.isArray(claims.claims)) {
    rec.level = 'claims';
    for (const c of claims.claims) {
      rec.claims++;
      const sid = typeof c.source === 'string' && STORY.test(c.source.replace(/\./g, '-')) ? c.source : null;
      const src = sid ? json(`data/stories/${story}/sources/${sid}.json`) : null;
      if (src && !src.__bad && src.url && (src.read_on || src.read_at)) {
        rec.claims_resolved++;
        let h = ''; try { h = new URL(src.url).hostname.replace(/^www\./, ''); } catch { /* not a URL */ }
        if (h === 'websummit.com' || h.endsWith('.websummit.com')) rec.claims_on_websummit++;
      }
    }
    if (rec.claims_on_websummit) rec.gaps.push(`${rec.claims_on_websummit} claim(s) resting on websummit.com pages (the house rule of 11 November: what rests only on websummit.com comes off unless another source is cited)`);
    if (rec.claims_resolved < rec.claims) rec.gaps.push(`${rec.claims - rec.claims_resolved} claim(s) whose source is not a recorded page with a read date`);
  } else if (st && !st.__bad && Array.isArray(st.rests_on) && st.rests_on.length) {
    rec.level = 'story'; rec.story_sources = st.rests_on.length;
    rec.gaps.push('sources named for the story, not claim by claim');
  } else if (links) {
    rec.level = 'links';
    rec.gaps.push(sourcesSection ? 'sources listed in the article\'s Sources section, not recorded as data with read dates' : 'sources as links in the text only, not recorded with a read date');
  } else {
    rec.gaps.push('no recorded source and no link in the text');
  }
  out.push(rec);
}
const levels = { claims: 'every claim mapped to a recorded source (a page with its address and the date it was read)', story: 'sources recorded for the story as a whole, not claim by claim', links: 'sources only in the text (links or a Sources section), not recorded as data', none: 'no recorded source and no link found' };
const count = (l) => out.filter((r) => r.level === l).length;
const head = (() => {
  try {
    const h = readFileSync(path('.git/HEAD'), 'utf8').trim();
    const ref = h.match(/^ref: (refs\/heads\/[A-Za-z0-9._\/-]{1,100})$/);
    if (!ref) return /^[0-9a-f]{40}$/.test(h) ? h.slice(0, 7) : 'unknown';
    const f = path(`.git/${ref[1]}`);
    if (f) return `${ref[1].slice(11)} ${readFileSync(f, 'utf8').trim().slice(0, 7)}`;
    const packed = text('.git/packed-refs') || '';
    const m = packed.split('\n').find((l) => l.endsWith(' ' + ref[1]));
    return m ? `${ref[1].slice(11)} ${m.slice(0, 7)}` : ref[1].slice(11);
  } catch { return 'unknown'; }
})();
const res = {
  about: 'The library\'s fact-checker, first pass: for every published PrompTugal.news article, how far its claims are mapped to sources (provenance), and the gaps. Read from the site\'s own repository; counts and levels only. A gap is not a finding that a claim is wrong: it says the claim cannot yet be walked back to a recorded source.',
  site: 'promptugal.news', pass: 1, made: new Date().toISOString().slice(0, 10), made_by: 'library.b@PrompTugal.dinis (scripts/fact-check.mjs)',
  read_from: `PrompTugal__News__Website, ${head}`,
  levels, counts: { articles: out.length, claims: count('claims'), story: count('story'), links: count('links'), none: count('none'), claims_total: out.reduce((a, r) => a + r.claims, 0), claims_resolved: out.reduce((a, r) => a + r.claims_resolved, 0), claims_on_websummit: out.reduce((a, r) => a + r.claims_on_websummit, 0) },
  articles: out,
};
writeFileSync('catalogue/fact-check.json', JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(res.counts));

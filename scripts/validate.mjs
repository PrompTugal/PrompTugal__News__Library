// Gate: fails the build on any problem. Never weaken a check to get a release out.
// From scripts/validate.mjs in the site repositories made by sites@AgentiCCells.dinis
// (2026-11-16); factory@ added the hub.json fields, the description check and the
// placeholder check (a seeded site must hold no __SITE_*__ placeholder).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const problems = [];
const fail = m => problems.push(m);
const hype = /\b(revolutionary|cutting[- ]edge|seamless(?:ly)?|world[- ]class|game[- ]changing)\b/i;
const isTemplate = existsSync('.factory-template');
if (!existsSync('_site')) { console.error('FAILED: _site/ is not built: run node scripts/build.mjs'); process.exit(1); }
const files = walk('_site');
for (const f of [...files, 'hub.json', 'README.md']) {
  if (!existsSync(f) || !/\.(html|js|css|json|md)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  s.split('\n').forEach((line, i) => {
    if (line.includes('—')) fail(`${f}:${i + 1}: em dash`);
    const m = line.match(hype); if (m) fail(`${f}:${i + 1}: hype word "${m[0]}"`);
    if (!isTemplate && /__SITE_[A-Z]+__/.test(line)) fail(`${f}:${i + 1}: template placeholder left in a seeded site`);
  });
  if (f.endsWith('.html')) {
    if (!/<title>[^<]+<\/title>/.test(s)) fail(`${f}: no <title>`);
    if (!/<meta name="description" content="[^"]+"/.test(s)) fail(`${f}: no description`);
    if (!/<html lang="/.test(s)) fail(`${f}: no lang on <html>`);
    for (const m of s.matchAll(/<script[^>]+src="([^"]+)"/g)) if (/^(https?:)?\/\//.test(m[1])) fail(`${f}: third-party script ${m[1]}`);
    for (const m of s.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) if (/^(https?:)?\/\//.test(m[1])) fail(`${f}: third-party stylesheet ${m[1]}`);
    // AppSec checks (library.b@, 18 November 2026, from the security pre-review): every page carries the content
    // security policy; no inline script or style (the policy forbids them); no frames; no script: or data: links.
    if (!/<meta http-equiv="Content-Security-Policy" content="default-src 'none';[^"]*script-src 'self'/.test(s)) fail(`${f}: no content security policy`);
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(s)) fail(`${f}: inline script`);
    if (/<style[\s>]/i.test(s) || /\sstyle="/i.test(s)) fail(`${f}: inline style`);
    if (/<(iframe|frame|object|embed)[\s>]/i.test(s)) fail(`${f}: frame or embedded object`);
    if (/\son[a-z]+="/i.test(s)) fail(`${f}: inline event handler`);
    for (const m of s.matchAll(/(?:href|src|action)="\s*([a-z][a-z0-9+.-]*):/gi)) if (!/^(https?|mailto)$/i.test(m[1])) fail(`${f}: ${m[1]}: link`);
    for (const m of s.matchAll(/(?:href|src)="([^"#?]+)/g)) {
      const u = m[1]; if (/^(https?:|mailto:|data:|\/\/)/.test(u)) continue;
      const target = u.startsWith('/') ? join('_site', u) : join(dirname(f), u);
      if (!existsSync(target) && !existsSync(join(target, 'index.html'))) fail(`${f}: broken link ${u}`);
    }
  }
}
// No script may turn text into HTML or code (the catalogue's text is untrusted).
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const s = readFileSync(f, 'utf8');
  const sink = s.match(/\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write|\beval\s*\(|new Function\s*\(/);
  if (sink) fail(`${f}: unsafe sink ${sink[0]}`);
}
// A tripwire, not a guarantee; the build's and the renderer's SVG checks are backstops, not sanitisers (AppSec post-review, 18 November 2026, 16:38 wake): no script in scripts/ (walked
// recursively) may make a network request, so none can read websummit.com or www.wikidata.org (linked only).
// Naming a host in a link is allowed; calling one is not. child_process is allowed only where every call runs git,
// in the files listed here with that reason.
const GIT_ONLY = new Set(['scripts/check-commits.mjs', 'scripts/check-signatures.mjs', 'scripts/leak-scan.mjs', 'scripts/check-symlinks.mjs', 'scripts/import-places.mjs']);
// The signature check's tests also run that check with this same node (process.execPath), on a throwaway clone.
const GIT_AND_NODE = new Set(['scripts/test-check-signatures.mjs', 'scripts/test-leak-scan.mjs', 'scripts/test-check-symlinks.mjs']);
// Playwright only in the hand-run preview renderer, which loads a local file and blocks every other request.
const PLAYWRIGHT_LOCAL = new Set(['scripts/render-preview.cjs']);
const NET = /\bfetch\s*\(|globalThis\s*\[|from\s*['"](?:node:)?(?:https?|http2|net|tls|dgram|dns)['"]|require\(\s*['"](?:node:)?(?:https?|http2|net|tls|dgram|dns)['"]|\bimport\s*\(|\bWebSocket\b|\bundici\b|XMLHttpRequest|\.goto\s*\(|\brequest\.(?:get|post|fetch)\s*\(|^\s*(?:curl|wget)\b/m;
for (const f of walk('scripts').filter((f) => /\.(mjs|js|cjs|sh)$/.test(f))) {
  if (f === 'scripts/validate.mjs') continue; // this file holds the patterns themselves
  const s = readFileSync(f, 'utf8');
  const net = s.match(NET);
  if (net) fail(`${f}: network request (${net[0].trim()})`);
  if (/['"]playwright['"]/.test(s) && !PLAYWRIGHT_LOCAL.has(f)) fail(`${f}: playwright outside the local-render list`);
  if (/child_process/.test(s)) {
    if (!GIT_ONLY.has(f) && !GIT_AND_NODE.has(f)) fail(`${f}: child_process outside the git-only list`);
    else for (const m of s.matchAll(/exec(?:File)?Sync\(\s*([^,)]+)/g)) if (m[1].trim() !== "'git'" && !(GIT_AND_NODE.has(f) && m[1].trim() === 'process.execPath')) fail(`${f}: child_process runs ${m[1].trim()}, not git`);
  }
}
if (!existsSync('_site/version.json')) fail('no version.json');
if (!existsSync('_site/index.html')) fail('no index.html');
try {
  const h = JSON.parse(readFileSync('hub.json', 'utf8'));
  for (const k of ['name', 'what_it_does', 'owner', 'repository', 'live_address', 'version_from']) if (typeof h[k] !== 'string' || !h[k].trim()) fail(`hub.json: ${k} must be a non-empty string`);
  if (h.version_from !== `${h.live_address}/version.json`) fail(`hub.json: version_from must be ${h.live_address}/version.json (the hub copies it verbatim)`);
  if (h.owner !== 'AgentiCCells') fail('hub.json: owner must be AgentiCCells');
  if (!h.licence || h.licence.code !== 'Apache-2.0' || h.licence.text !== 'CC BY 4.0') fail('hub.json: licence must be code Apache-2.0, text CC BY 4.0');
} catch (e) { fail(`hub.json is missing or not JSON (${e.message})`); }
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} problem(s)`); process.exit(1); }
console.log(`OK${isTemplate ? ' (template)' : ''}`);

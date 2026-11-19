// Control 10, no symlinks (security@ ed70bd996, via conductor.b@ 19 Nov 2026 16:50 UTC).
// Usage: node scripts/check-symlinks.mjs <A> <AFTER> [--site <dir>]
// Fails on any symlink (mode 120000):
//   - added or changed by any commit in A..AFTER, read per commit with git diff-tree -r --raw -z -m, so a merge's own
//     changes are seen against each parent, and one added and later removed still fails;
//   - in AFTER's tree, the index or the working tree (never following a link);
//   - with --site, in that directory (the downloaded site): no exceptions there, and nothing in it is skipped.
// The only exceptions are entries in scripts/symlink-exceptions.json read from A's tree, each
// { "path": <ASCII path>, "target": <the link's target>, "reason": <at least 10 characters> }, so a new exception
// counts only from the next anchor, and an excepted link that is re-pointed fails. Paths are compared as whole byte
// strings, read NUL-separated and decoded as latin1 (one character per byte), never line by line (events.b@'s
// pitfall, via conductor.b@ 16:57 UTC). AppSec post-review of 19 Nov, 19:4x UTC: merges, .git in the site, bytes,
// AFTER's tree, the target. Only git is run.
import { execFileSync } from 'node:child_process';
import { readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

const ENV = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null' };
const git = (...args) => execFileSync('git', args, { encoding: 'latin1', stdio: ['ignore', 'pipe', 'pipe'], env: ENV, maxBuffer: 1 << 28 });
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };

const args = process.argv.slice(2);
const siteAt = args.indexOf('--site');
const site = siteAt >= 0 ? args[siteAt + 1] : null;
const [aArg, afterArg] = siteAt >= 0 ? args.filter((x, i) => i !== siteAt && i !== siteAt + 1) : args;
const sha = (r) => (typeof r === 'string' && /^[0-9A-Za-z._\/-]+$/.test(r) && !r.startsWith('-') ? (tryGit('rev-parse', '--verify', '--quiet', '--end-of-options', `${r}^{commit}`) || '').trim() : '');
const A = sha(aArg), AFTER = sha(afterArg || 'HEAD');
if (!A || !AFTER) { console.error('check-symlinks: usage: <A> <AFTER> [--site <dir>], both commits'); process.exit(1); }
if (siteAt >= 0 && !site) { console.error('check-symlinks: --site needs a directory'); process.exit(1); }

// the exceptions, from A only
const EX = 'scripts/symlink-exceptions.json';
const allowed = new Map(); // path -> target
if (tryGit('cat-file', '-e', `${A}:${EX}`) !== null) {
  let list;
  try { list = JSON.parse(execFileSync('git', ['cat-file', 'blob', `${A}:${EX}`], { encoding: 'utf8', env: ENV })); } catch { console.error(`${EX} in ${A.slice(0, 7)}: not JSON`); process.exit(1); }
  if (!Array.isArray(list)) { console.error(`${EX}: must be a list`); process.exit(1); }
  for (const x of list) {
    const ok = x && typeof x === 'object' && Object.keys(x).every((k) => ['path', 'target', 'reason'].includes(k))
      && typeof x.path === 'string' && /^[\x21-\x7e]+(?: [\x21-\x7e]+)*$/.test(x.path) && !allowed.has(x.path)
      && typeof x.target === 'string' && x.target.length > 0 && x.target.length <= 400
      && typeof x.reason === 'string' && x.reason.trim().length >= 10;
    if (!ok) { console.error(`${EX}: each entry needs only an ASCII path (once), its target and a reason of at least 10 characters`); process.exit(1); }
    allowed.set(x.path, x.target);
  }
}
const show = (p) => JSON.stringify(p); // printed quoted, so a newline or an odd byte is seen
const problems = [];
const targetOf = (blob) => tryGit('cat-file', 'blob', blob);
// a symlink passes only if its path is listed in A and its target (the blob) is the one listed
const listed = (path, blob) => allowed.has(path) && blob && targetOf(blob) === allowed.get(path);

// 1. every commit in A..AFTER, per commit and, for a merge, against each parent
const commits = git('rev-list', `${A}..${AFTER}`).split('\n').filter(Boolean);
for (const c of commits) {
  const parts = git('diff-tree', '-r', '--raw', '-z', '-m', '--no-commit-id', '--no-renames', '--root', c).split('\0');
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const meta = parts[i], path = parts[i + 1];
    if (!meta && !path) continue;
    const m = meta.match(/^:(\d{6}) (\d{6}) [0-9a-f]+ ([0-9a-f]+) ([A-Z])\d*$/);
    if (!m) { problems.push(`${c.slice(0, 7)}: a diff-tree entry could not be read`); break; }
    if (m[2] === '120000' && !listed(path, m[3])) problems.push(`${c.slice(0, 7)}: adds or changes a symlink, ${show(path)}`);
  }
}
// 2. AFTER's whole tree
for (const e of git('ls-tree', '-r', '-z', AFTER).split('\0').filter(Boolean)) {
  const m = e.match(/^(\d{6}) \w+ ([0-9a-f]+)\t([\s\S]*)$/);
  if (m && m[1] === '120000' && !listed(m[3], m[2])) problems.push(`${AFTER.slice(0, 7)}'s tree holds a symlink, ${show(m[3])}`);
}
// 3. the index
for (const e of git('ls-files', '-s', '-z').split('\0').filter(Boolean)) {
  const m = e.match(/^(\d{6}) ([0-9a-f]+) \d\t([\s\S]*)$/);
  if (m && m[1] === '120000' && !listed(m[3], m[2])) problems.push(`the index holds a symlink, ${show(m[3])}`);
}
// 4. the working tree and the site, on disk; names read as bytes
const top = git('rev-parse', '--show-toplevel').trim();
const walk = (dir, rel, where) => {
  let names;
  try { names = readdirSync(dir, { encoding: 'buffer' }); } catch (e) { problems.push(`${where}: cannot read ${show(rel || '.')} (${e.code || 'error'})`); return; }
  for (const nb of names) {
    const n = nb.toString('latin1');
    const full = join(dir, n), r = rel ? `${rel}/${n}` : n;
    let st; try { st = lstatSync(Buffer.from(full, 'latin1')); } catch (e) { problems.push(`${where}: cannot read ${show(r)} (${e.code || 'error'})`); continue; }
    if (st.isSymbolicLink()) {
      // an on-disk link in the working tree passes only if the index holds it as a listed link (checked above)
      if (where !== 'the working tree' || !allowed.has(r)) problems.push(`${where} holds a symlink, ${show(r)}`);
    } else if (st.isDirectory()) {
      if (where === 'the working tree' && !rel && n === '.git') continue; // the repository's own .git directory only
      walk(full, r, where);
    }
  }
};
walk(top, '', 'the working tree');
if (site) {
  let st; try { st = lstatSync(site); } catch { st = null; }
  if (!st || st.isSymbolicLink() || !st.isDirectory()) problems.push(`the site, ${show(site)}, is not a plain directory`); else walk(site, '', 'the site');
}

if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} symlink problem(s)`); process.exit(1); }
console.log(`OK (${commits.length} commits checked, no symlinks${allowed.size ? `, ${allowed.size} listed in A` : ''})`);

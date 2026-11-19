// ACC-015: every non-merge commit a push adds to dev must carry a readable Agent: trailer,
// read the way git reads it: git log --format=%(trailers:key=Agent,valueonly).
// Usage: node scripts/check-commits.mjs <before> <after> [<release>]   (the pushed range, before..after; exemptions from <release>, or <before>)
// No commit is skipped: this file came with the repository's first commit (1af3014), so every commit is newer than
// the check. A skip decided by what a tree holds is refused (security@'s control 8, 19 Nov 2026 14:08 UTC).
// History is not rewritten (ACC-015). The gates run this file from the last release's copy (control 7).
// Prints OK or lists each commit that fails and exits 1.
import { execFileSync } from 'node:child_process';

// replace refs and grafts are ignored, as in check-signatures.mjs
const ENV = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null' };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: ENV }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

const [beforeArg, afterArg, releaseArg] = process.argv.slice(2); // releaseArg: the release whose exemptions apply (default: before)
const after = afterArg || 'HEAD';
if (!tryGit('rev-parse', '--verify', '--quiet', `${after}^{commit}`)) { console.error(`check-commits: unknown commit ${after}`); process.exit(1); }


// A new branch, a forced push or a manual run has no usable "before": check everything since the check began.
const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) && tryGit('rev-parse', '--verify', '--quiet', `${beforeArg}^{commit}`);
const range = before ? [`${before}..${after}`] : [after];
const added = lines(git('rev-list', '--no-merges', ...range));

// A role may be dotted, role.speciality (Dinis, 16 Nov 2026: "we definitely should allow dots because that's our terminology").
// Dinis, in library.b@'s session, 18 Nov 2026, about 23:29 UTC: "yes, accept @PrompTugal.dinis in check-commits.mjs".
// So a PrompTugal agent signs as itself (role@PrompTugal.person); @AgentiCCells names stay accepted.
const agentShape = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@(?:agenticcells|promptugal)\.[a-z0-9][a-z0-9.-]*$/i;
// Exemptions (specialist.code@, 2026-11-16). CI checks from the last release tag, so one failing commit
// would block every later release, and history is never rewritten. A person may exempt that one commit in
// scripts/commit-exemptions.json: [{ "commit": "<full 40-hex sha>", "reason": "...", "approved_by": "Dinis Cruz",
// "date": "YYYY-MM-DD" }]. Each entry names exactly one commit; malformed entries fail the check.
// The exemptions are read from the range's start (the last release), never from the pushed tree (control 7).
const exempt = new Map();
const EX = 'scripts/commit-exemptions.json';
const from = releaseArg ? tryGit('rev-parse', '--verify', '--quiet', `${releaseArg}^{commit}`) : before;
if (releaseArg && !from) { console.error(`check-commits: unknown release ${releaseArg}`); process.exit(1); }
const exText = from ? tryGit('cat-file', 'blob', `${from}:${EX}`) : null;
if (exText !== null) {
  let list;
  try { list = JSON.parse(exText); } catch (e) { console.error(`${EX}: not JSON (${e.message})`); process.exit(1); }
  if (!Array.isArray(list)) { console.error(`${EX}: must be a list`); process.exit(1); }
  for (const x of list) {
    if (!x || !/^[0-9a-f]{40}$/.test(x.commit || '') || !(x.reason || '').trim() || !(x.approved_by || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) {
      console.error(`${EX}: each entry needs a full 40-hex commit, a reason, approved_by and a date`); process.exit(1);
    }
    exempt.set(x.commit, x);
  }
}
const errors = [];
let checked = 0, exempted = 0;
for (const c of added) {
  if (exempt.has(c)) { exempted++; continue; }
  checked++;
  const agents = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim());
  const subject = git('log', '-1', '--format=%s', c);
  if (!agents.length) errors.push(`${c.slice(0, 7)} ${subject}: no readable Agent: trailer (it must sit in the final trailer block)`);
  else if (!agents.every((a) => agentShape.test(a))) errors.push(`${c.slice(0, 7)} ${subject}: Agent: trailer is not role@AgentiCCells.person or role@PrompTugal.person (${agents.join(', ')})`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`FAILED (${errors.length} of ${checked} commits checked)`);
  process.exit(1);
}
console.log(`OK (${checked} commits checked, ${exempted} exempted)`);

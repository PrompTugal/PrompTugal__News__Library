// Every new commit is signed with its agent's published key (Dinis, 19 Nov 2026, about 01:05 UTC, in conductor.b@'s
// session: "yes that is correct", that "every single agent that runs in here should have published its public key on
// the repo that it maintains ... every then commit is signed by that key ... you should also include the session ID";
// PrompTugal__News__Website board/guidance/2026-11-19-signed-commits-paid-search-and-free-embeds.md, section 2).
// Usage: node scripts/check-signatures.mjs <before> <after>   (the pushed range, before..after)
// For each commit in the range, it fails a commit that is unsigned, whose signature is not good, whose signer
// is not its Agent:, or whose Claude-Session: is not the session published with that key in team/keys.json, read from
// the commit's PARENT, never from the commit itself (conductor.b@'s correction, 01:16 UTC 19 Nov, from signals.b@'s
// review): a new or rotated key is added by a commit signed with a key already listed, or a person adds it; the
// commits in BOOTSTRAP (each with Dinis's word or a person's hand) are read from their own tree. Only active keys count. Commits that are
// ancestors of BEFORE_THE_CHECK (dev's head when this check was added) are skipped: history is never rewritten; every
// other commit is checked, including ones on branches merged in. Merge commits fail (release.sh keeps dev linear).
// CI commits nothing in this repository (pages.yml only pushes tags), so no commit is exempt. Only git is run.
// AppSec post-review, 19 Nov 2026: LIB-2026-028 to 037.
// The gates run this file from the last release's copy, never from the pushed tree (control 7; release.sh, pages.yml).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// replace refs and grafts are ignored, so a root commit cannot be given a parent locally (AppSec, 19 Nov 14:10 UTC)
const ENV = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null' };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: ENV }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);
// dev's head when this check was added (the sites bar 1.1.0 release, v0.1.21): it and its ancestors are not checked.
const BEFORE_THE_CHECK = 'f07f044bbeea547909be0c41c31be008287f02eb';
// Commits that published a first key, read from their own tree: d1f81f7, library.b@'s first signed commit, which added
// its key at Dinis's word of 19 Nov about 01:05 UTC (LIB-2026-032, reopened and fixed).
const BOOTSTRAP = new Set(['d1f81f798d87b2d99ae80ae9bdd04fac97ed28c3']);
const AGENT = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$/;
const SESSION = /^https:\/\/claude\.ai\/code\/(session_[A-Za-z0-9]{10,64})$/; // the full session URL only (security@, 19 Nov 01:20 and 01:30)
// the public-key line; keys files before 19 Nov 01:55 UTC carried a comment after it, which is ignored (only the two key fields are used)
const SSHKEY = /^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]{48}(?: [A-Za-z0-9@._ -]{0,100})?$/;

const [beforeArg, afterArg] = process.argv.slice(2);
const sha = (r) => (typeof r === 'string' && !r.startsWith('-') ? tryGit('rev-parse', '--verify', '--quiet', '--end-of-options', `${r}^{commit}`) : null);
const after = sha(afterArg || 'HEAD');
if (!after) { console.error('check-signatures: unknown commit to check up to'); process.exit(1); }
// a shallow checkout makes its oldest commits look parentless (security@'s control 6, 19 Nov 2026 14:07 UTC)
if (git('rev-parse', '--is-shallow-repository') !== 'false') { console.error('check-signatures: a shallow checkout cannot be checked (fetch the full history)'); process.exit(1); }
if (!sha(BEFORE_THE_CHECK)) { console.error('check-signatures: BEFORE_THE_CHECK is not in this clone (fetch the full history)'); process.exit(1); }
const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) ? sha(beforeArg) : null;
const range = [...(before ? [`${before}..${after}`] : [after]), `^${BEFORE_THE_CHECK}`];
const merges = lines(git('rev-list', '--merges', ...range));
const added = lines(git('rev-list', '--no-merges', ...range));

const dir = mkdtempSync(join(tmpdir(), 'check-signatures-'));
const problems = [];
let checked = 0;
for (const m of merges) problems.push(`${m.slice(0, 7)}: a merge commit (dev is kept linear: rebase instead)`);
try {
  for (const c of added) {
    const short = c.slice(0, 7);
    checked++;
    // an orphan (a commit with no parent) would trust the keys in its own tree: refused, unless it is in BOOTSTRAP
    // (conductor.b@, 19 Nov 2026 14:01 UTC, from videos.b@'s pre-review: control 6)
    if (!BOOTSTRAP.has(c) && git('rev-list', '--parents', '-n', '1', c).split(' ').length < 2) { problems.push(`${short}: a commit with no parent (an orphan) cannot be checked against earlier keys`); continue; }
    const agents = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c));
    const sessions = lines(git('log', '-1', '--format=%(trailers:key=Claude-Session,valueonly)', c)); // compared exactly, untrimmed
    if (agents.length !== 1) { problems.push(`${short}: needs exactly one Agent: trailer`); continue; }
    if (sessions.length !== 1 || !SESSION.test(sessions[0])) { problems.push(`${short}: needs exactly one readable Claude-Session: trailer`); continue; }
    const agent = agents[0];
    if (!AGENT.test(agent)) { problems.push(`${short}: Agent: trailer is not an agent name`); continue; }
    const session = sessions[0].match(SESSION)[1];
    let keys;
    const from = BOOTSTRAP.has(c) ? c : `${c}^`;
    try { keys = JSON.parse(git('show', `${from}:team/keys.json`)).keys; } catch { problems.push(`${short}: team/keys.json missing or not JSON in ${BOOTSTRAP.has(c) ? 'this commit' : 'its parent'}`); continue; }
    // the full Claude-Session: URL must equal the one published with the key (claude_session; older entries give the bare id)
    const url = sessions[0];
    // a keys file from before claude_session existed (none of its entries has it) gives the URL from the bare id; once any entry has it, every key needs it
    const legacy = Array.isArray(keys) && !keys.some((k) => k && 'claude_session' in k);
    const mine = (Array.isArray(keys) ? keys : []).filter((k) => k && k.agent === agent && (legacy ? `https://claude.ai/code/${k.session}` : k.claude_session) === url && k.session === session && typeof k.ssh_public_key === 'string' && SSHKEY.test(k.ssh_public_key) && k.status === 'active');
    if (!mine.length) { problems.push(`${short}: no signing key for ${agent} with ${session} in ${BOOTSTRAP.has(c) ? 'this commit' : 'its parent'}'s team/keys.json`); continue; }
    const allowed = join(dir, `${short}.allowed`);
    writeFileSync(allowed, mine.map((k) => `${agent} namespaces="git" ${k.ssh_public_key.split(' ').slice(0, 2).join(' ')}`).join('\n') + '\n');
    const out = tryGit('-c', 'gpg.ssh.program=ssh-keygen', '-c', `gpg.ssh.allowedSignersFile=${allowed}`, 'log', '-1', '--format=%G?%n%GS', c);
    const [status, signer] = lines(out || '');
    if (status !== 'G') problems.push(`${short}: signature ${status === 'N' ? 'missing' : `not good (${status || 'unreadable'})`} for ${agent}`);
    else if (signer !== agent) problems.push(`${short}: signed by ${signer}, not its Agent: ${agent}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
if (problems.length) { console.error(problems.join('\n')); console.error(`FAILED: ${problems.length} commit(s) not signed by their agent's published key`); process.exit(1); }
console.log(`OK (${checked} commits checked; commits up to ${BEFORE_THE_CHECK.slice(0, 7)} predate the check)`);

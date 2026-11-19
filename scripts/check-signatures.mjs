// Every new commit is signed with its agent's published key (Dinis, 19 Nov 2026, about 01:05 UTC, in conductor.b@'s
// session: "yes that is correct", that "every single agent that runs in here should have published its public key on
// the repo that it maintains ... every then commit is signed by that key ... you should also include the session ID";
// PrompTugal__News__Website board/guidance/2026-11-19-signed-commits-paid-search-and-free-embeds.md, section 2).
// Usage: node scripts/check-signatures.mjs <before> <after>   (the pushed range, before..after)
// For each commit in the range, it fails a commit that is unsigned, whose signature is not good, whose signer
// is not its Agent:, or whose Claude-Session: is not the session published with that key in team/keys.json (read from
// the commit's own tree: publishing to the repository is the authorisation). Only active keys count. Commits that are
// ancestors of BEFORE_THE_CHECK (dev's head when this check was added) are skipped: history is never rewritten; every
// other commit is checked, including ones on branches merged in. Merge commits fail (release.sh keeps dev linear).
// CI commits nothing in this repository (pages.yml only pushes tags), so no commit is exempt. Only git is run.
// AppSec post-review, 19 Nov 2026: LIB-2026-028 to 037.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);
// dev's head when this check was added (the sites bar 1.1.0 release, v0.1.21): it and its ancestors are not checked.
const BEFORE_THE_CHECK = 'f07f044bbeea547909be0c41c31be008287f02eb';
const AGENT = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$/;
const SESSION = /^(?:https:\/\/claude\.ai\/code\/)?(session_[A-Za-z0-9]{10,64})$/;
const SSHKEY = /^ssh-ed25519 [A-Za-z0-9+/]{68}(?:={0,2})(?: [^\n"]{0,200})?$/;

const [beforeArg, afterArg] = process.argv.slice(2);
const sha = (r) => (typeof r === 'string' && !r.startsWith('-') ? tryGit('rev-parse', '--verify', '--quiet', '--end-of-options', `${r}^{commit}`) : null);
const after = sha(afterArg || 'HEAD');
if (!after) { console.error('check-signatures: unknown commit to check up to'); process.exit(1); }
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
    const agents = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim());
    const sessions = lines(git('log', '-1', '--format=%(trailers:key=Claude-Session,valueonly)', c)).map((s) => s.trim());
    if (agents.length !== 1) { problems.push(`${short}: needs exactly one Agent: trailer`); continue; }
    if (sessions.length !== 1 || !SESSION.test(sessions[0])) { problems.push(`${short}: needs exactly one readable Claude-Session: trailer`); continue; }
    const agent = agents[0];
    if (!AGENT.test(agent)) { problems.push(`${short}: Agent: trailer is not an agent name`); continue; }
    const session = sessions[0].match(SESSION)[1];
    let keys;
    try { keys = JSON.parse(git('show', `${c}:team/keys.json`)).keys; } catch { problems.push(`${short}: team/keys.json missing or not JSON in this commit`); continue; }
    const mine = (Array.isArray(keys) ? keys : []).filter((k) => k && k.agent === agent && k.session === session && typeof k.ssh_public_key === 'string' && SSHKEY.test(k.ssh_public_key) && k.status === 'active');
    if (!mine.length) { problems.push(`${short}: no signing key published for ${agent} with ${session}`); continue; }
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

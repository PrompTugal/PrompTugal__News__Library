// Tests for scripts/check-signatures.mjs (conductor.b@, 19 Nov 2026 about 02:16 UTC, passing on data.b@'s pitfall: test
// repositories inherit the environment's global signer, so set gpg.ssh.program=ssh-keygen in each one, and assert the
// reason a case fails, not only that it fails). Runs in release.sh and CI before the check itself.
// It clones this repository into a temporary folder, makes throwaway ed25519 keys (never published, deleted after),
// publishes one in a first commit outside the tested range, then checks one case per range. Only git and this node run.
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHECK = resolve('scripts/check-signatures.mjs');
const dir = mkdtempSync(join(tmpdir(), 'test-signatures-'));
const repo = join(dir, 'repo');
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { rmSync(dir, { recursive: true, force: true }); process.exit(130); });
const SESSION = 'https://claude.ai/code/session_01TESTTESTTESTTESTTESTTE';
const AGENT = 'tester.b@PrompTugal.dinis';
const trailers = (agent = AGENT, session = SESSION) => `\n\nAgent: ${agent}\nClaude-Session: ${session}`;

// An OpenSSH private key file and public line, built here so no other program is needed (format: PROTOCOL.key).
function sshKey(name) {
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  const seed = Buffer.from(jwk.d, 'base64url'), pub = Buffer.from(jwk.x, 'base64url');
  const str = (b) => { const l = Buffer.alloc(4); l.writeUInt32BE(b.length); return Buffer.concat([l, b]); };
  const u32 = (n) => { const l = Buffer.alloc(4); l.writeUInt32BE(n); return l; };
  const type = Buffer.from('ssh-ed25519');
  const blob = Buffer.concat([str(type), str(pub)]);
  const check = randomBytes(4);
  let priv = Buffer.concat([check, check, str(type), str(pub), str(Buffer.concat([seed, pub])), str(Buffer.from(name))]);
  const pad = []; for (let i = 1; priv.length % 8; i++) { pad.push(i); priv = Buffer.concat([priv, Buffer.from([i])]); }
  const body = Buffer.concat([Buffer.from('openssh-key-v1\0'), str(Buffer.from('none')), str(Buffer.from('none')), str(Buffer.alloc(0)), u32(1), str(blob), str(priv)]);
  const dashes = '-'.repeat(5), label = ['OPENSSH', 'PRIVATE', 'KEY'].join(' ');
  const pem = `${dashes}BEGIN ${label}${dashes}\n${body.toString('base64').match(/.{1,70}/g).join('\n')}\n${dashes}END ${label}${dashes}\n`;
  const file = join(dir, name); writeFileSync(file, pem); chmodSync(file, 0o600);
  return { file, line: `ssh-ed25519 ${blob.toString('base64')}` };
}

const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (before) => { try { return { ok: true, out: execFileSync(process.execPath, [CHECK, before, 'HEAD'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` }; } };
const results = [];
let failed = 0;
try {
  execFileSync('git', ['clone', '-q', '--no-hardlinks', resolve('.'), repo]); git('checkout', '-q', '-B', 'test-main');
  const good = sshKey('good'), other = sshKey('other');
  // the environment's global signer is replaced in this clone only (data.b@'s pitfall)
  for (const [k, v] of [['core.hooksPath', '/dev/null'], ['gpg.format', 'ssh'], ['gpg.ssh.program', 'ssh-keygen'], ['user.signingkey', good.file], ['commit.gpgsign', 'true'], ['user.name', 'tester'], ['user.email', 'tester@example.invalid']]) git('config', '--local', k, v);
  const keysFile = join(repo, 'team/keys.json');
  const keys = JSON.parse(readFileSync(keysFile, 'utf8'));
  keys.keys.push({ id: 'tester', agent: AGENT, session: SESSION.split('/').pop(), claude_session: SESSION, status: 'active', type: 'ssh-ed25519', ssh_public_key: good.line });
  writeFileSync(keysFile, JSON.stringify(keys, null, 1) + '\n');
  // the first commit publishes the test key; it is outside every tested range (as a person's commit would be)
  git('add', '-A'); git('commit', '-q', '-m', 'test: publish the test key' + trailers());
  const base = git('rev-parse', 'HEAD');
  const commit = (msg, opts = []) => { writeFileSync(join(repo, 'test.txt'), randomBytes(8).toString('hex')); git('add', '-A'); git(...opts, 'commit', '-q', '-m', msg); };
  const cases = [
    ['a good commit passes', () => commit('good' + trailers()), true, 'OK (1 commits checked'],
    ['an unsigned commit fails', () => commit('unsigned' + trailers(), ['-c', 'commit.gpgsign=false']), false, 'signature missing'],
    ['a forged CI author does not exempt an unsigned commit', () => commit('bot' + trailers(), ['-c', 'commit.gpgsign=false', '-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com']), false, 'signature missing'],
    ['a commit signed by an unpublished key fails', () => commit('other' + trailers(), ['-c', `user.signingkey=${other.file}`]), false, 'signature not good'],
    ['another session fails', () => commit('session' + trailers(AGENT, 'https://claude.ai/code/session_01OTHEROTHEROTHEROTHEROT')), false, 'no signing key for'],
    ['a bare session id fails', () => commit('bare' + trailers(AGENT, SESSION.split('/').pop())), false, 'readable Claude-Session'],
    ['another agent fails', () => commit('agent' + trailers('videos.b@PrompTugal.dinis')), false, 'no signing key for videos.b@'],
    ['a malformed agent name fails', () => commit('bad' + trailers('* cert-authority')), false, 'not an agent name'],
    ['a commit adding its own key fails', () => {
      const k = JSON.parse(readFileSync(keysFile, 'utf8'));
      k.keys.push({ id: 'self', agent: 'self.b@PrompTugal.dinis', session: SESSION.split('/').pop(), claude_session: SESSION, status: 'active', type: 'ssh-ed25519', ssh_public_key: other.line });
      writeFileSync(keysFile, JSON.stringify(k, null, 1) + '\n'); commit('self' + trailers('self.b@PrompTugal.dinis'), ['-c', `user.signingkey=${other.file}`]);
    }, false, "in its parent's team/keys.json"],
    ['a merge commit fails', () => {
      git('checkout', '-q', '-b', 'side'); commit('side' + trailers()); git('checkout', '-q', '-');
      git('merge', '-q', '--no-ff', '-m', 'merge' + trailers(), 'side');
    }, false, 'a merge commit'],
  ];
  for (const [name, make, pass, reason] of cases) {
    try { git('branch', '-q', '-D', 'side'); } catch { /* none yet */ }
    make();
    const r = run(base);
    const ok = r.ok === pass && r.out.includes(reason);
    if (!ok) failed++;
    results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: expected ${pass ? 'a pass' : 'a failure'} saying "${reason}", got ${r.ok ? 'a pass' : 'a failure'}: ${r.out.trim().split('\n').slice(-2).join(' / ')}`}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(results.join('\n'));
if (failed) { console.error(`FAILED: ${failed} of ${results.length} signature-check tests`); process.exit(1); }
console.log(`OK (${results.length} signature-check tests)`);

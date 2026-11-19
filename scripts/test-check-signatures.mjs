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
const run = (before, check = CHECK) => { try { return { ok: true, out: execFileSync(process.execPath, [check, before, 'HEAD'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` }; } };
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
    // security@'s fourth ruling: an unsigned commit from a dropped run (between the anchor and BEFORE) still fails
    ['an unsigned commit from a dropped run fails', () => { commit('dropped' + trailers(), ['-c', 'commit.gpgsign=false']); commit('later' + trailers()); }, false, 'signature missing'],
    // control 6 (conductor.b@, 19 Nov 2026 14:01 UTC, from videos.b@'s pre-review): an orphan would trust its own keys
    ['an orphan commit fails', () => { git('checkout', '-q', '--orphan', 'orphan'); commit('orphan' + trailers()); }, false, 'a commit with no parent'],
    // control 8 (security@'s third ruling, 14:11 UTC): a backdated orphan is refused by ancestry, not by its date
    ['a backdated orphan fails', () => { git('checkout', '-q', '--orphan', 'orphan'); commit('old' + trailers(), ['-c', 'user.name=tester']); execFileSync('git', ['-C', repo, 'commit', '-q', '--amend', '--no-edit', '--date=2020-01-01T00:00:00Z'], { env: { ...process.env, GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z' } }); }, false, 'a commit with no parent'],
    ['an orphan signed with its own key fails', () => {
      git('checkout', '-q', '--orphan', 'orphan');
      const k = JSON.parse(readFileSync(keysFile, 'utf8'));
      k.keys.push({ id: 'self', agent: 'self.b@PrompTugal.dinis', session: SESSION.split('/').pop(), claude_session: SESSION, status: 'active', type: 'ssh-ed25519', ssh_public_key: other.line });
      writeFileSync(keysFile, JSON.stringify(k, null, 1) + '\n'); commit('own key' + trailers('self.b@PrompTugal.dinis'), ['-c', `user.signingkey=${other.file}`]);
    }, false, 'a commit with no parent'],
    // control 7: a push that rewrites the check to pass still fails, because the gate runs the last release's copy
    ['a pushed tree cannot change the check', () => {
      writeFileSync(join(repo, 'scripts/check-signatures.mjs'), "console.log('OK (1 commits checked');\n");
      commit('tamper' + trailers(), ['-c', 'commit.gpgsign=false']);
      const pushed = run(base, join(repo, 'scripts/check-signatures.mjs'));
      if (!pushed.ok) throw new Error('the tampered copy should pass, or this case proves nothing');
      writeFileSync(trusted, git('show', `${base}:scripts/check-signatures.mjs`) + '\n');
    }, false, 'signature missing', () => trusted],
    // control 8 (security@, 19 Nov 2026 14:08 UTC): deleting the checker never skips a commit
    ['a commit that removes the check and adds an unsigned change fails', () => {
      rmSync(join(repo, 'scripts/check-signatures.mjs'));
      commit('remove the check' + trailers(), ['-c', 'commit.gpgsign=false']);
      writeFileSync(trusted, git('show', `${base}:scripts/check-signatures.mjs`) + '\n');
    }, false, 'signature missing', () => trusted],
  ];
  const trusted = join(dir, 'trusted-check-signatures.mjs');
  for (const [name, make, pass, reason, check] of cases) {
    // each case starts from the base, so an earlier case's failure cannot satisfy a later one
    git('checkout', '-q', '-f', 'test-main'); git('reset', '-q', '--hard', base); git('clean', '-qfdx');
    for (const b of ['side', 'orphan']) { try { git('branch', '-q', '-D', b); } catch { /* none yet */ } }
    make();
    const r = run(base, check ? check() : CHECK);
    const ok = r.ok === pass && r.out.includes(reason);
    if (!ok) failed++;
    results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: expected ${pass ? 'a pass' : 'a failure'} saying "${reason}", got ${r.ok ? 'a pass' : 'a failure'}: ${r.out.trim().split('\n').slice(-2).join(' / ')}`}`);
  }
  // control 6: a shallow checkout is refused (its oldest commits look parentless)
  {
    const shallow = join(dir, 'shallow');
    execFileSync('git', ['clone', '-q', '--depth', '2', '-b', 'test-main', `file://${repo}`, shallow]);
    let out = '', ok = false;
    try { execFileSync(process.execPath, [CHECK, 'HEAD~1', 'HEAD'], { cwd: shallow, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = `${e.stdout || ''}${e.stderr || ''}`; ok = out.includes('a shallow checkout'); }
    if (!ok) failed++;
    results.push(`${ok ? 'ok  ' : 'FAIL'} a shallow checkout fails${ok ? '' : `: ${out.trim() || 'it passed'}`}`);
  }
  // control 7: a release with no copy of the check fails closed (git show refuses; nothing falls back)
  {
    let ok = false;
    try { execFileSync('git', ['-C', repo, 'show', `${git('rev-list', '--max-parents=0', 'HEAD').split('\n')[0]}:scripts/check-signatures.mjs`], { stdio: 'pipe' }); } catch { ok = true; }
    const files = ['scripts/release.sh', '.github/workflows/pages.yml'].map((f) => readFileSync(f, 'utf8'));
    ok = ok && files.every((t) => !/git (?:show|cat-file blob) "\$(last|trusted):scripts\/\$f" > "[^"]+" *\|\|/.test(t) && !/check-signatures\.mjs[^\n]*\|\|/.test(t));
    if (!ok) failed++;
    results.push(`${ok ? 'ok  ' : 'FAIL'} a missing release copy fails, with no fallback`);
  }
  // control 7's wiring: the gates run a release tag's copy of the check, never scripts/check-signatures.mjs from the tree
  const wired = (name, file, uses) => {
    const t = readFileSync(file, 'utf8');
    const direct = /node\s+scripts\/(check-signatures|check-commits|leak-scan)\.mjs/.test(t) || (file.endsWith('.yml') && /describe --tags/.test(t)) || (file.endsWith('.yml') && /git show "\$(trusted|last):/.test(t));
    const ok = !direct && uses.every((u) => t.includes(u));
    if (!ok) failed++;
    results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: ${file} must run the checks from the anchor's copy, never from the tree, and CI must not take a tag`}`);
  };
  wired('release.sh runs the release copy of the check', 'scripts/release.sh', ['for f in check-signatures.mjs check-commits.mjs leak-scan.mjs; do git cat-file blob "$last:scripts/$f" > "$trusted/$f"; done', 'node "$trusted/leak-scan.mjs"', 'node "$trusted/check-signatures.mjs" origin/dev HEAD', 'node "$trusted/check-commits.mjs" origin/dev HEAD "$last"']);
  // security@'s fourth and fifth rulings (14:17 and 14:20 UTC): CI anchors on the last successful deployment, never a
  // tag, and control 9: the checks run in their own job, which runs no pushed code and sees the built site only as data
  {
    // comments are dropped first, so a required string cannot be met by a comment (AppSec, 19 Nov)
    const yml = readFileSync('.github/workflows/pages.yml', 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).map((l) => l.replace(/\s+#\s.*$/, '')).join('\n');
    const job = (name) => { const m = yml.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\n|$)`)); return m ? m[1] : ''; };
    const build = job('build'), checks = job('checks'), deploy = job('deploy'), tag = job('tag');
    const cases9 = [
      ['CI takes no tag for the checks', !/describe --tags/.test(yml) && !/git show "\$(trusted|last):/.test(yml)],
      // security@'s sixth ruling (14:26 UTC): the anchor is the head of the latest successful push run on dev
      ['CI anchors on the latest successful push run of this workflow on dev', !/deployments\?environment/.test(checks) && ['actions/workflows/pages.yml/runs?branch=dev&event=push&status=success', 'select(.path == ".github/workflows/pages.yml" and .head_branch == "dev" and .event == "push" and .conclusion == "success")', 'select(.name == "checks" and .conclusion == "success")] | length\')" = 1 ]', '[ -n "$A" ] || {', 'git merge-base --is-ancestor "$A" "$AFTER" ||'].every((u) => checks.includes(u))],
      ['the checks come from A, as regular files, with no fallback', ['cut -c1-6)" = 100644 ] || {', 'git cat-file blob "$A:scripts/$f" > "$RUNNER_TEMP/$f"', '"$NODE" "$RUNNER_TEMP/check-commits.mjs" "$A" "$AFTER"', '"$NODE" "$RUNNER_TEMP/check-signatures.mjs" "$A" "$AFTER"', '"$NODE" "$RUNNER_TEMP/leak-scan.mjs"'].every((u) => checks.includes(u)) && !/git (?:show|cat-file blob) "\$A:[^\n]*\|\|/.test(checks) && !/git show "\$A:/.test(checks)],
      ['the checks job runs no pushed code', checks.length > 0 && !/\bnode\s+(?!"\$RUNNER_TEMP)\S|\bnpm\b|\bnpx\b|\bbash\s+\S|\bsh\s+\S|\.\/scripts\/|scripts\/[\w.-]+\.(?:mjs|js|sh|py)(?!")|uses:\s*\.\//.test(checks.replace(/git cat-file blob "\$A:scripts\/\$f"/g, '').replace(/git ls-tree "\$A" "scripts\/\$f"/g, '').replace(/"scripts\/\$f in \$A/g, ''))],
      ['the checks job hardens node and git', ["NODE_OPTIONS: ''", "GIT_NO_REPLACE_OBJECTS: '1'", 'case "$NODE" in /*)'].every((u) => checks.includes(u))],
      // live.b@'s review (16:15 UTC): a pushed _site cannot redirect the download; the anchor's run passed its checks job;
      // a manual run on another branch neither checks, deploys nor tags
      ['the site is vetted outside the checkout, and a pushed _site or .gitattributes cannot steer it', ['if [ -e _site ] || [ -L _site ]; then echo "the pushed tree holds _site"', "xargs -0 -r rm -f --", 'path: ${{ runner.temp }}/site', '[ -z "$(find "$site" ! -type f ! -type d)" ] || {', 'mv "$site" _site'].every((u) => checks.includes(u)) && !/download-artifact@v4\n\s+with:\n\s+name: site-for-checks\n\s+path: _site/.test(checks) && checks.indexOf('the pushed tree holds _site') < checks.indexOf('download-artifact') && checks.indexOf('mv "$site" _site') < checks.indexOf('"$NODE" "$RUNNER_TEMP/check-commits.mjs"')],
      ['only dev is checked, deployed and tagged', /if: github\.ref == 'refs\/heads\/dev'\n/.test(checks) && /if: github\.ref == 'refs\/heads\/dev' && /.test(deploy) && /always\(\) && github\.ref == 'refs\/heads\/dev' && /.test(tag)],
      ['the site deployed is the one scanned', /uses: actions\/upload-pages-artifact/.test(checks) && !/upload-pages-artifact/.test(build) && checks.indexOf('"$NODE" "$RUNNER_TEMP/leak-scan.mjs"') < checks.indexOf('upload-pages-artifact') && /include-hidden-files: true/.test(build)],
      // a pushed build step that writes GITHUB_ENV or GITHUB_PATH cannot change the result: those are per job, and the
      // checks job takes nothing from the build job but the site as an artifact
      ['a pushed build step cannot reach the checks (GITHUB_ENV is per job)', !/needs\.build\.outputs\.(?!deploy == 'true')/.test(checks) && !/RUNNER_TEMP\/check|gh api/.test(build) && /needs: \[build, checks\]/.test(deploy) && /needs\.checks\.result == 'success'/.test(tag)],
    ];
    for (const [name, ok] of cases9) { if (!ok) failed++; results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}`); }
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(results.join('\n'));
if (failed) { console.error(`FAILED: ${failed} of ${results.length} signature-check tests`); process.exit(1); }
console.log(`OK (${results.length} signature-check tests)`);

// Tests for scripts/check-symlinks.mjs (control 10). Each case runs in a throwaway repository and asserts the reason.
// Only git and this node run. Cases: a pushed symlink fails; one listed in A's exceptions passes; one listed only in
// the pushed tree fails; one added and removed again still fails; a name holding a newline cannot match two listed
// names; a symlink in the site fails; a merge's own symlink, a .git link in the site, a loose link, a re-pointed
// listed link and a thin exception each fail.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHECK = resolve('scripts/check-symlinks.mjs');
const results = [];
let failed = 0;
const trial = (name, build, pass, reason, opts0 = {}) => {
  const d = mkdtempSync(join(tmpdir(), 'symlink-trial-'));
  const git = (...a) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '-q'); mkdirSync(join(d, 'scripts')); mkdirSync(join(d, 'docs'));
    writeFileSync(join(d, 'scripts/symlink-exceptions.json'), JSON.stringify(opts0.exceptions || [{ path: 'docs/ok-link', target: 'target.txt', reason: 'a test exception' }, { path: 'a', target: 'target.txt', reason: 'a test exception' }, { path: 'b', target: 'target.txt', reason: 'a test exception' }]) + '\n');
    writeFileSync(join(d, 'docs/target.txt'), 'x\n');
    git('add', '-A'); git('commit', '-q', '-m', 'base');
    const A = git('rev-parse', 'HEAD');
    const opts = build(d, git) || {};
    let out = '', ok;
    try { out = execFileSync(process.execPath, [CHECK, A, 'HEAD', ...(opts.site ? ['--site', opts.site] : [])], { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); ok = pass && out.includes(reason); } catch (e) { out = `${e.stdout || ''}${e.stderr || ''}`; ok = !pass && out.includes(reason); }
    if (!ok) failed++;
    results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: expected ${pass ? 'a pass' : 'a failure'} saying "${reason}", got: ${out.trim().split('\n').slice(-1)[0]}`}`);
  } finally { rmSync(d, { recursive: true, force: true }); }
};
const link = (d, git, path, to = 'target.txt') => { symlinkSync(to, join(d, path)); git('add', '-A'); git('commit', '-q', '-m', `link ${path}`); };

trial('a pushed symlink fails', (d, git) => link(d, git, 'docs/bad-link'), false, 'adds or changes a symlink, "docs/bad-link"');
trial("a symlink listed in A's exceptions passes", (d, git) => link(d, git, 'docs/ok-link'), true, 'OK (1 commits checked');
trial('a symlink listed only in the pushed tree fails', (d, git) => {
  writeFileSync(join(d, 'scripts/symlink-exceptions.json'), JSON.stringify([{ path: 'docs/new-link', reason: 'pushed' }]) + '\n');
  link(d, git, 'docs/new-link');
}, false, 'adds or changes a symlink, "docs/new-link"');
trial('a symlink added and removed again still fails', (d, git) => { link(d, git, 'docs/brief-link'); unlinkSync(join(d, 'docs/brief-link')); git('add', '-A'); git('commit', '-q', '-m', 'remove'); }, false, 'adds or changes a symlink, "docs/brief-link"');
trial('a name holding a newline does not match the two listed names it spans', (d, git) => link(d, git, 'a\nb'), false, 'adds or changes a symlink, "a\\nb"');
trial('a symlink in the site fails', (d) => { mkdirSync(join(d, 'site')); symlinkSync('/etc/hostname', join(d, 'site/x')); return { site: join(d, 'site') }; }, false, 'the site holds a symlink, "x"');
// AppSec post-review (19 Nov, 19:4x UTC)
trial("a merge's own symlink, removed later, still fails", (d, git) => {
  git('checkout', '-q', '-b', 'side'); writeFileSync(join(d, 'docs/side.txt'), 's\n'); git('add', '-A'); git('commit', '-q', '-m', 'side');
  git('checkout', '-q', '-'); writeFileSync(join(d, 'docs/main.txt'), 'm\n'); git('add', '-A'); git('commit', '-q', '-m', 'main');
  git('merge', '-q', '--no-ff', '--no-commit', 'side'); symlinkSync('/etc/hostname', join(d, 'docs/evil')); git('add', '-A'); git('commit', '-q', '-m', 'merge');
  unlinkSync(join(d, 'docs/evil')); git('add', '-A'); git('commit', '-q', '-m', 'remove');
}, false, 'adds or changes a symlink, "docs/evil"');
trial('a symlink named .git in the site fails', (d) => { mkdirSync(join(d, 'site')); symlinkSync('/etc', join(d, 'site/.git')); return { site: join(d, 'site') }; }, false, 'the site holds a symlink, ".git"');
trial('an uncommitted symlink in the working tree fails', (d) => { symlinkSync('target.txt', join(d, 'docs/loose')); }, false, 'the working tree holds a symlink, "docs/loose"');
trial('a listed symlink pointed elsewhere fails', (d, git) => link(d, git, 'docs/ok-link', '../../etc/passwd'), false, 'adds or changes a symlink, "docs/ok-link"');
trial('an exception without a real reason fails', () => {}, false, 'a reason of at least 10 characters', { exceptions: [{ path: 'docs/ok-link', target: 'target.txt', reason: 'x' }] });
trial('a clean push passes', (d, git) => { writeFileSync(join(d, 'docs/more.txt'), 'y\n'); git('add', '-A'); git('commit', '-q', '-m', 'file'); }, true, 'OK (1 commits checked');

console.log(results.join('\n'));
if (failed) { console.error(`FAILED: ${failed} of ${results.length} symlink-check tests`); process.exit(1); }
console.log(`OK (${results.length} symlink-check tests)`);

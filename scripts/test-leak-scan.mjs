// Tests for the leak scan's two narrow exemptions (security@'s ruling, Website 5109e7a09,
// board/team/security/reviews/2026-11-19-0120-ruling-public-keys-in-leak-scans.md, addendum of 04:51 UTC: "An exemption
// is written in the scan's own code, with a test that a key-shaped string in the same file still fails").
// Runs in release.sh and CI. Secret-shaped strings are built at run time, so this file holds none.
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { scanText } from './leak-scan.mjs';

const b64 = (n) => randomBytes(n).toString('base64');
const pin = () => 'sha256-' + randomBytes(32).toString('base64'); // 43 characters and one '='
const token = () => ['gh', 'p_'].join('') + randomBytes(27).toString('base64').replace(/[+/=]/g, 'x').slice(0, 36);
const sshPub = () => { const raw = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32); const blob = Buffer.concat([Buffer.from([0, 0, 0, 11]), Buffer.from('ssh-ed25519'), Buffer.from([0, 0, 0, 32]), raw]); return 'ssh-ed25519 ' + blob.toString('base64'); };
const flagged = (path, text, kind) => { const f = scanText(path, text); return kind ? f.some((x) => x.kind === kind) : f.length > 0; };
const cases = [
  ['a pin at bar.integrity in the registry copy passes', 'catalogue/sites-registry.json', `{\n "bar": {\n  "integrity": {\n   "js": "${pin()}",\n   "css": "${pin()}"\n  }\n }\n}`, false],
  ['a pin at bar.versions[v].integrity in the registry copy passes', 'catalogue/sites-registry.json', `{\n "bar": {\n  "versions": {\n   "1.2.0": {\n    "integrity": {\n     "js": "${pin()}",\n     "css": "${pin()}"\n    }\n   }\n  }\n }\n}`, false],
  ['a pin under js directly in a version, without integrity, fails', 'catalogue/sites-registry.json', `{\n "bar": {\n  "versions": {\n   "1.2.0": {\n    "js": "${pin()}"\n   }\n  }\n }\n}`, true],
  ['the same pin under another key in the registry copy fails', 'catalogue/sites-registry.json', `{\n "note": "${pin()}"\n}`, true],
  ['a pin at integrity depth but under an unknown name fails', 'catalogue/sites-registry.json', `{\n "bar": {\n  "integrity": {\n   "extra": "${pin()}"\n  }\n }\n}`, true],
  ['a pin with text after it fails', 'catalogue/sites-registry.json', `{\n "bar": {\n  "integrity": {\n   "js": "${pin()}x${b64(24)}"\n  }\n }\n}`, true],
  ['a token in the registry copy fails', 'catalogue/sites-registry.json', `{\n "bar": {\n  "integrity": {\n   "js": "${pin()}"\n  }\n },\n "x": "${token()}"\n}`, true],
  ['a pin under js in another object, at the same depth, fails', 'catalogue/sites-registry.json', `{\n "bar": {\n  "other": {\n   "js": "${pin()}"\n  }\n }\n}`, true],
  ['a token in an exempt field, on the pin\'s own line, fails', 'catalogue/sites-registry.json', `{\n "bar": {\n  "integrity": {\n   "js": "${token()}"\n  }\n }\n}`, true],
  ['a pin in any other file fails', 'catalogue/ws26.json', `{\n   "js": "${pin()}"\n}`, true],
  ['a published ssh key in team/keys.json passes', 'team/keys.json', `{\n "ssh_public_key": "${sshPub()}"\n}`, false],
  ['an ssh key with a comment still has its comment scanned', 'team/keys.json', `{\n "ssh_public_key": "${sshPub()} ${token()}"\n}`, true],
  ['a token in team/keys.json fails', 'team/keys.json', `{\n "note": "${token()}"\n}`, true],
  ['an ssh key outside team/keys.json fails, by the ssh rule itself', 'catalogue/ws26.json', `{\n "ssh_public_key": "${sshPub()}"\n}`, true, 'ssh public key outside its published field'],
  ['an ssh key in team/keys.json outside its field fails, by the ssh rule itself', 'team/keys.json', `{\n "note": "${sshPub()}"\n}`, true, 'ssh public key outside its published field'],
];
// security@'s ruling of 05:09 UTC (Website 1acd10498): a private-key header fails everywhere, with no exemption; a public
// key in a status file fails; the published field passes. Headers are built from parts, so this file holds none.
const header = (kind) => `${'-'.repeat(5)}BEGIN ${kind ? kind + ' ' : ''}${['PRIVATE', 'KEY'].join(' ')}${'-'.repeat(5)}`;
for (const kind of ['OPENSSH', 'RSA', 'EC', 'DSA', 'ENCRYPTED', '']) {
  for (const path of ['board/team/library/status.json', 'team/keys.json', 'catalogue/sites-registry.json']) cases.push([`a ${kind || 'plain'} private-key header in ${path} fails`, path, `{\n "x": "${header(kind)}"\n}`, true, 'private key block']);
}
const ecdsaPub = () => 'ecdsa-sha2-nistp256 AAAA' + randomBytes(100).toString('base64').replace(/=+$/, '');
const rsaPub = () => 'ssh-rsa AAAA' + randomBytes(270).toString('base64').replace(/=+$/, '');
cases.push(['an ssh-ed25519 public key in a status file fails', 'board/team/library/status.json', `{\n "note": "${sshPub()}"\n}`, true, 'ssh public key outside its published field']);
cases.push(['an ecdsa public key in a status file fails', 'board/team/library/status.json', `{\n "note": "${ecdsaPub()}"\n}`, true, 'ssh public key outside its published field']);
cases.push(['an ssh-rsa public key in a status file fails', 'board/team/library/status.json', `{\n "note": "${rsaPub()}"\n}`, true, 'ssh public key outside its published field']);
let failed = 0;
for (const [name, path, text, expect, kind] of cases) { const got = flagged(path, text, kind); const ok = got === expect; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: expected ${expect ? 'flagged' : 'clean'}, got ${got ? 'flagged' : 'clean'}`}`); }
if (failed) { console.error(`FAILED: ${failed} of ${cases.length} leak-scan tests`); process.exit(1); }
console.log(`OK (${cases.length} leak-scan tests)`);

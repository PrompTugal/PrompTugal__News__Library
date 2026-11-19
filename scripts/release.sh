#!/usr/bin/env bash
# Run every gate, then rebase on dev and push. Stops at the first failure. Never pipe a gate.
set -euo pipefail
cd "$(dirname "$0")/.."
# Refuse during a hold (finding 3), with uncommitted changes (finding 4: the gates must check what is
# pushed), and check every commit's Agent: trailer before the push, while it can still be amended (finding 5).
[ -e board/HOLD.md ] && { echo "board/HOLD.md exists: no release while it does" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "uncommitted changes: commit or stash them first" >&2; exit 1; }
git fetch -q origin dev
node scripts/build.mjs
node scripts/validate.mjs
node scripts/leak-scan.mjs
node scripts/test-leak-scan.mjs
node scripts/test-check-signatures.mjs
# The signature check runs from the last release's copy, never from the tree it checks (control 7, conductor.b@ 19 Nov 14:01 UTC).
git fetch -q --tags origin
trusted=$(mktemp -d); trap 'rm -rf "$trusted"' EXIT
# the release tag reachable from dev before this push; VERSION_BASE is read from pages.yml so the two cannot drift
base=$(sed -n "s/^  VERSION_BASE: '\([0-9.]*\)'$/\1/p" .github/workflows/pages.yml)
[ -n "$base" ] || { echo "VERSION_BASE not found in pages.yml" >&2; exit 1; }
last=$(git describe --tags --abbrev=0 --match "v${base}.*" origin/dev)
# every security check comes from the release's copy, and a missing copy stops the release (security@, 19 Nov 14:08 UTC)
for f in check-signatures.mjs check-commits.mjs; do git show "$last:scripts/$f" > "$trusted/$f"; done
node "$trusted/check-commits.mjs" origin/dev HEAD "$last"
node "$trusted/check-signatures.mjs" origin/dev HEAD
for i in 1 2 3 4 5; do
  git fetch -q origin dev
  git rebase -q origin/dev
  # One gate per line: under set -e a failure inside an && chain does not stop the script (specialist.code@ finding 1).
  node scripts/build.mjs >/dev/null
  node scripts/validate.mjs >/dev/null
  node scripts/leak-scan.mjs >/dev/null
  node "$trusted/check-commits.mjs" origin/dev HEAD "$last" >/dev/null
  node "$trusted/check-signatures.mjs" origin/dev HEAD >/dev/null
  if git -c push.negotiate=true push -q origin HEAD:dev; then echo "released $(git rev-parse --short HEAD) to dev"; exit 0; fi
  sleep $((i * 3))
done
echo "release failed after 5 attempts" >&2; exit 1

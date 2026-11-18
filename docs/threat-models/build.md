# Threat model: the build and the deploy

Owner: library.b@PrompTugal.dinis. Written 18 November 2026. Status: written; reviewed by security@PrompTugal.dinis on 18 November 2026, 16:05 UTC (good).

## Parts
`scripts/build.mjs` (catalogue and content to `_site/`), `scripts/validate.mjs`, `scripts/leak-scan.mjs`, `scripts/check-commits.mjs`, `scripts/release.sh`, `.github/workflows/pages.yml` (from the AgentiCCells site template; runs on every push to `dev`).

## What it reads
`catalogue/*.json` (hand-curated, untrusted text from public pages), `content/**/*.md` (written by the library's agents), `src/` (CSS, the search script, fonts, brand SVGs). No network access.

## What it writes
`_site/`: HTML pages, markdown twins, JSON under `api/v1/`, `version.json`. Deployed to GitHub Pages; a version tag pushed by the workflow.

## What it trusts
Node 22 and its built-ins (no dependencies); the GitHub Actions in the workflow (`actions/checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`; pinned by major version, not by commit).

## Secrets
None in the build. The workflow uses GitHub's own `GITHUB_TOKEN` with `contents: read` for the build, `pages: write` and `id-token: write` for the deploy job and `contents: write` only for the tag job.

## What could go wrong

| Risk | Mitigation | Residual |
|---|---|---|
| A catalogue title or URL carries HTML or script (stored XSS) | every string escaped by one `esc()` on output (`scripts/build.mjs`, "output helpers"); URLs parsed with `new URL()`, only http and https, no credentials, host on `catalogue/hosts.json`; CSP meta with `script-src 'self'` and no inline script or style on every page; the validator fails on inline script, inline style, event handlers, frames and non-http links | GitHub Pages cannot send headers, so no `frame-ancestors` (clickjacking of a static page with no actions: low) |
| An id becomes a path outside `_site/` (path traversal) | ids checked against `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`, duplicates fail; `write()` resolves every path and refuses one outside `_site/` | none known |
| A link to a hostile or look-alike host | the host allowlist; a new host is a reviewed change to `catalogue/hosts.json` | a listed host could itself serve harmful content later: the item stays a link, never fetched by the site |
| A private person's contact published | the build fails on email-shaped (other than agent names) and phone-shaped text; people are not named until agreed | a name inside a title published by its source |
| Hidden text (control or bidi characters) misleads a reader or an agent | the build fails on control, zero-width and bidi characters | |
| A secret committed | leak scan on every file and the built site, before every release and in CI | |
| A release without the gates, or during a hold | `release.sh` and the workflow run every gate; both refuse while `board/HOLD.md` exists | |
| A compromised third-party Action | major-version pins from GitHub's own `actions/` | pin by commit: proposed to devops@ |

# PrompTugal.news Library

**Domain:** https://library.promptugal.news

**Focus:** The library of PrompTugal.news: the repository that holds the information for everything. (In Dinis's words, 2026-11-18: "another repo that is going to hold the information for everything".)

Part of [PrompTugal.news](https://promptugal.news/) (Portugal, town by town).

## Status
First version (18 November 2026), by library.b@PrompTugal.dinis: one collection, Web Summit Lisbon 2026 (50 items, 7 gaps recorded), every item with its source, licence link, date found and evidence; the pages, the JSON API (`/api/v1/`) and the graph. What exists is in `REALITY.md`.

## Where things are
- `catalogue/`: the catalogue, JSON first (one file per collection, the anchor nodes, the host allowlist, the security findings).
- `content/`: the hand pages (`/how/`, `/security/`, `/librarians/`, `/takedown/`, the finding aids).
- `scripts/build.mjs`: builds every page, markdown twin and JSON file into `_site/`; `scripts/import-articles.mjs`: catalogues PrompTugal.news's summit articles from their front matter.
- `docs/learnt-from-sgraph-send.md`, `docs/threat-models/`, `board/team/library/` (status, activity log, debriefs, asks), `team/keys.json` (public keys).

## How it works
- `dev` is the default branch. Every push to `dev` builds the site from `src/` and deploys it to GitHub Pages (`.github/workflows/pages.yml`), with the version at https://library.promptugal.news/version.json.
- `main` is for releases: a pull request from `dev` to `main`, merged only by Dinis Cruz.
- Public, like every repository the factory creates. No secrets in this repository; `.credentials/` and `.sg-send/` are ignored by git.

Made by the AgentiCCells site factory, request `requests/2026-11-18__library-promptugal-news/` in AgentiCCells/AgentiCCells__Site__Factory.

## Licences
- Code: Apache-2.0, in `LICENSE`.
- Text, guidance and images: CC BY 4.0, in `LICENSE-TEXT`.

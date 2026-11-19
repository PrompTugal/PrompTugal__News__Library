# REALITY.md: what exists now

A thing not written here does not exist, whatever a brief says. PROPOSED marks what is planned and not built.

## History

- Seeded by the AgentiCCells site factory on 2026-11-18 from AgentiCCells/AgentiCCells__Site__Template@dev.
- Its live state is recorded in requests/2026-11-18__library-promptugal-news/status.json in AgentiCCells__Site__Factory.
- 2026-11-18: cells@AgentiCCells.dinis, at Dinis's word (~15:10 UTC), replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), added `src/CNAME`, ignored `.credentials/` and `.sg-send/`, and created `main` from this commit. The factory's collaborators step found `riskmandate-agent` already had write access.
- 2026-11-18, evening: library.b@PrompTugal.dinis (started by conductor.b@PrompTugal.dinis at Dinis's word) built the first version, below.

## What exists (18 November 2026, first version by library.b@)

### The catalogue (JSON, in `catalogue/`)
- **One collection: Web Summit Lisbon 2026 (`WS26`), 80 call numbers, 68 items held, 12 withdrawn** (2 read by machine against websummit.com's terms; 10 articles promptugal.news withdrew on 11 November), `WS26 2026/0001` to `WS26 2026/0080`, each with source URL, licence link, when and by whom found, and evidence:
  - 3 official replays on Web Summit's YouTube channel: Opening Night, Day One, Day Three (titles and channel confirmed by YouTube's oEmbed; stages and talk timestamps not yet read).
  - 28 other recordings by organisations and media: 17 from social.watch@'s record, 11 cited in data.b@'s Perplexity discovery; each title and channel read through oEmbed.
  - 2 organiser statements on Day Two's cancellation and Thursday's plan (read by dev.data@ on 10 and 11 November). Withdrawn: the 12 November programme page and the PITCH semi-final page (WS26 2026/0004 and 0005), read by machine on 18 November against websummit.com's terms (LIB-2026-008).
  - 2 press reports (The Next Web, The Irish Times), titles and links only.
  - 1 data set: the Storm Charles archive on data.promptugal.news.
  - 42 PrompTugal.news articles about the summit catalogued from their front matter; 10 of them were withdrawn by the site on 11 November and are now marked withdrawn here (32 held).
- **7 gaps recorded** (`missing[]`): Day Two did not take place; Day Three's other stages; talk timestamps; standalone recordings and speaker write-ups; Euronews (HTTP 406 to our checks); Portugal Resident (HTTP 403); websummit.com's own pages (never read by machine).
- Anchor nodes (`catalogue/nodes.json`), the host allowlist (`catalogue/hosts.json`), the security findings file (`catalogue/security.json`: 37 findings: 36 from AppSec reviews (32 fixed, 4 accepted; two high, both fixed before the push) and LIB-2026-008, websummit.com read by machine against its terms (fixed)).

### The site (built by `scripts/build.mjs` from the catalogue and `content/`)
- Home page (the hall, search, holdings counts, the shelf, new accessions, finding aids, the invitation to librarians), `/catalogue/`, `/collections/` and `/collections/ws26/` (its finding aid, with what is missing and its record), a reading room with a catalogue card for every item at `/item/<id>/`, indexes at `/index/<place|topic|organisation|event|agent|date|kind>/`, `/missing/`, `/graph/`, `/finding-aids/` (with `call-numbers/` and `day-two/`), `/librarians/`, `/how/`, `/security/`, `/takedown/`. A markdown twin (`index.md`) beside every page. The take-down line, licences, principles and report links in every footer.
- The JSON API: `/api/v1/index.json`, `/api/v1/items/index.json` and `/api/v1/items/<id>.json`, `/api/v1/collections/`, `/api/v1/graph/index.json` (199 nodes, 475 edges, each stored once under its verb with a published inverse, aligned with PrompTugal.news's ontology on 18 November; Wikidata ids for Portugal, Lisbon and the Web Summit series, proposed by ontologist@), `/api/v1/index/` (by place, topic, organisation, event, person (empty), agent, date, kind, call number), `/api/v1/missing.json`, `/api/v1/security/findings.json`. Every file has a top-level `license`.
- Designer@'s look (PrompTugal brand v2.0, fonts self-hosted, the supplied SVG wordmark), light and dark by the reader's system setting; checked in Chromium at 1280 and 390 px.
- Checks: the build's own (ids, URL schemes, allowed hosts, licence, evidence, lengths, control and bidi characters, email and phone shapes, graph ends, inverses and orphans); the validator gained CSP, inline script and style, frame, event handler, link scheme and JS sink checks.

### The requests channel
- `/requests/` and `/api/v1/requests/` (index and one file per team), from `catalogue/requests.json`: 8 requests: 0002, 0004, 0005 and 0006 done, 0001 answered in part, 0003, 0007 and 0008 open.

### The fact-checker
- Pass 1 (18 November, re-run at the 22:38 wake): every live promptugal.news article's provenance level (87 live, 10 withdrawn skipped), from `scripts/fact-check.mjs` into `catalogue/fact-check.json`, at `/fact-check/` and `/api/v1/fact-check/index.json`: 13 claim by claim (224 claims, all resolving), 39 story-level, 35 text-only, 0 none.

### The preview
- `/preview.svg` (built at every build from the library's own counts), `/api/v1/preview.json` (where each number comes from), `/preview.png` (rendered by hand and committed; may lag), `og:image` on every page. `/preview.svg` is the 320 by 180 picture the sites bar shows; the larger card is `/preview-card.svg`.

### The sites bar (19 November, about 01:00 UTC)
- Sites bar 1.1.0 installed on every page (Dinis, 18 November, about 22:00 UTC; installed at conductor.b@'s word of 00:55 UTC). Three files vendored in `src/assets/sites-bar/1.1.0/`, pinned by sha256 in `catalogue/sites-bar.sha256`; the build checks them and stops on any difference.
- The registry is a copy, `catalogue/sites-registry.json`, of promptugal.news/api/v1/sites.json, refreshed by hand (the build fetches nothing). In the browser the bar reads each site's own `version.json` and `preview.svg`, so the policy allows images and reads from https://*.promptugal.news; scripts and styles stay the library's own.

### Signed commits (19 November, about 01:20 UTC)
- Signed commits on (Dinis, 19 November, about 01:05 UTC, board/guidance/2026-11-19-signed-commits-paid-search-and-free-embeds.md in PrompTugal__News__Website). library.b@'s commit signing key (ssh-ed25519, `library.b-commit-signing`) is in `team/keys.json` with its session; git signs with it in this clone only. `scripts/check-signatures.mjs` runs in `scripts/release.sh` and in CI and fails any new commit that is unsigned, signed by another key, a merge, or names another session; keys are read from each commit's parent, so a new key needs a commit signed by a listed key, or a person. Commits up to f07f044 predate it.

### The team's files
- `docs/learnt-from-sgraph-send.md`; threat models in `docs/threat-models/` (build, cataloguing, search).
- `team/keys.json`: library.b@'s public keys, both with session_01Kw9UwFNC1sX4AKoWo4XhEP: the sgit key (`library.b-promptugal`, sha256:78fa318e01745b38, made with `sgit pki keygen`) and the commit signing key (`library.b-commit-signing`).
- `board/team/library/status.json`, `activity-log.md`, `debriefs/2026-11-18-handover.md`.

## PROPOSED (not built)
- Predictions kept and checked (Dinis, 19 November, about 01:22 UTC): the library shows none of its own; first, a 'what was said / what happened' block on the WS26 finding aid for Day Two and Day Three, and /api/v1/predictions/ws26.json. Later, perhaps, every site's predictions catalogued as shown.
- The fact-checker beyond promptugal.news's articles (the library's cards, the other sites); Wikipedia and Wikidata as the reference layer; a page per university (Dinis, 18 November, about 16:00 UTC).
- Talks by timestamp inside each day's replay; Day One and other stages' replays (needs a collector by data.b@ or a browser-capable read).
- More collections: the events, places, organisations and topics PrompTugal.news covers.
- People in the index: speakers named from official pages, and people who publish in public, under Dinis's line of 18 November (~15:35 UTC); not yet done.
- Embeds through the platform's own player (deliberately left out of v1: links only).
- The `item` and `collection` types and the library's verbs added to PrompTugal.news's ontology (ontologist@ does it when the library says they are settled).
- Scheduled rebuilds; data loaded from data.promptugal.news in the browser.

## Decisions from Dinis
- 18 November 2026, about 23:29 UTC, in library.b@'s session: "yes, accept @PrompTugal.dinis in check-commits.mjs" (done: the commit check accepts role@PrompTugal.person), and "yes keep operators' first names on cards" (done: agent names stay as published).
- 18 November 2026, about 23:45 UTC (board/guidance/2026-11-18-billing-only-on-the-main-site.md): only promptugal.news bills. The library has no billing, meter or adverts, says so in every footer, and may show any data with its licence and provenance.

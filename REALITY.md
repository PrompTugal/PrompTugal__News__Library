# REALITY.md: what exists now

A thing not written here does not exist, whatever a brief says. PROPOSED marks what is planned and not built.

## History

- Seeded by the AgentiCCells site factory on 2026-11-18 from AgentiCCells/AgentiCCells__Site__Template@dev.
- Its live state is recorded in requests/2026-11-18__library-promptugal-news/status.json in AgentiCCells__Site__Factory.
- 2026-11-18: cells@AgentiCCells.dinis, at Dinis's word (~15:10 UTC), replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), added `src/CNAME`, ignored `.credentials/` and `.sg-send/`, and created `main` from this commit. The factory's collaborators step found `riskmandate-agent` already had write access.
- 2026-11-18, evening: library.b@PrompTugal.dinis (started by conductor.b@PrompTugal.dinis at Dinis's word) built the first version, below.

## What exists (18 November 2026, first version by library.b@)

### The catalogue (JSON, in `catalogue/`)
- **One collection: Web Summit Lisbon 2026 (`WS26`), 50 items**, call numbers `WS26 2026/0001` to `WS26 2026/0050`, each with source URL, licence link, when and by whom found, and evidence:
  - 1 official replay: "Web Summit 2026 | Day Three" on Web Summit's YouTube channel (title and channel confirmed by YouTube's oEmbed; stage, date and talk timestamps not yet read).
  - 4 organiser items: the two statements on Day Two's cancellation and Thursday's plan, the 12 November programme page, the PITCH semi-final session page.
  - 2 press reports (The Next Web, The Irish Times), titles and links only.
  - 1 data set: the Storm Charles archive on data.promptugal.news.
  - 42 PrompTugal.news articles about the summit, catalogued from their front matter (every URL checked: HTTP 200).
- **7 gaps recorded** (`missing[]`): no Day One replay found; Day Two did not take place; Day Three's other stages; talk timestamps; standalone recordings and speaker write-ups; Euronews (HTTP 406 to our checks); Portugal Resident (HTTP 403).
- Anchor nodes (`catalogue/nodes.json`), the host allowlist (`catalogue/hosts.json`), the security findings file (`catalogue/security.json`: 7 findings from the AppSec review, 6 fixed before release, 1 accepted).

### The site (built by `scripts/build.mjs` from the catalogue and `content/`)
- Home page (the hall, search, holdings counts, the shelf, new accessions, finding aids, the invitation to librarians), `/catalogue/`, `/collections/` and `/collections/ws26/` (its finding aid, with what is missing and its record), a reading room with a catalogue card for every item at `/item/<id>/`, indexes at `/index/<place|topic|organisation|event|agent|date|kind>/`, `/missing/`, `/graph/`, `/finding-aids/` (with `call-numbers/` and `day-two/`), `/librarians/`, `/how/`, `/security/`, `/takedown/`. A markdown twin (`index.md`) beside every page. The take-down line, licences, principles and report links in every footer.
- The JSON API: `/api/v1/index.json`, `/api/v1/items/index.json` and `/api/v1/items/<id>.json`, `/api/v1/collections/`, `/api/v1/graph/index.json` (169 nodes, 796 edges, each edge with its inverse), `/api/v1/index/` (by place, topic, organisation, event, person (empty), agent, date, kind, call number), `/api/v1/missing.json`, `/api/v1/security/findings.json`. Every file has a top-level `license`.
- Designer@'s look (PrompTugal brand v2.0, fonts self-hosted, the supplied SVG wordmark), light and dark by the reader's system setting; checked in Chromium at 1280 and 390 px.
- Checks: the build's own (ids, URL schemes, allowed hosts, licence, evidence, lengths, control and bidi characters, email and phone shapes, graph ends, inverses and orphans); the validator gained CSP, inline script and style, frame, event handler, link scheme and JS sink checks.

### The team's files
- `docs/learnt-from-sgraph-send.md`; threat models in `docs/threat-models/` (build, cataloguing, search).
- `team/keys.json`: library.b@'s public key (`library.b-promptugal`, sha256:78fa318e01745b38), made with `sgit pki keygen`.
- `board/team/library/status.json`, `activity-log.md`, `debriefs/2026-11-18-handover.md`.

## PROPOSED (not built)
- Talks by timestamp inside each day's replay; Day One and other stages' replays (needs a collector by data.b@ or a browser-capable read).
- More collections: the events, places, organisations and topics PrompTugal.news covers.
- People in the index, once it is agreed they may be named.
- Embeds through the platform's own player (deliberately left out of v1: links only).
- A schema agreed with ontologist@ and data.b@; the graph joined to promptugal.news's.
- Scheduled rebuilds; data loaded from data.promptugal.news in the browser.

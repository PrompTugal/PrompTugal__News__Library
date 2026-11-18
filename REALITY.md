# REALITY.md: what exists now

A thing not written here does not exist, whatever a brief says. PROPOSED marks what is planned and not built.

## History

- Seeded by the AgentiCCells site factory on 2026-11-18 from AgentiCCells/AgentiCCells__Site__Template@dev.
- Its live state is recorded in requests/2026-11-18__library-promptugal-news/status.json in AgentiCCells__Site__Factory.
- 2026-11-18: cells@AgentiCCells.dinis, at Dinis's word (~15:10 UTC), replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), added `src/CNAME`, ignored `.credentials/` and `.sg-send/`, and created `main` from this commit. The factory's collaborators step found `riskmandate-agent` already had write access.
- 2026-11-18, evening: library.b@PrompTugal.dinis (started by conductor.b@PrompTugal.dinis at Dinis's word) built the first version, below.

## What exists (18 November 2026, first version by library.b@)

### The catalogue (JSON, in `catalogue/`)
- **One collection: Web Summit Lisbon 2026 (`WS26`), 80 call numbers, 78 items held, 2 withdrawn**, `WS26 2026/0001` to `WS26 2026/0080`, each with source URL, licence link, when and by whom found, and evidence:
  - 3 official replays on Web Summit's YouTube channel: Opening Night, Day One, Day Three (titles and channel confirmed by YouTube's oEmbed; stages and talk timestamps not yet read).
  - 28 other recordings by organisations and media: 17 from social.watch@'s record, 11 cited in data.b@'s Perplexity discovery; each title and channel read through oEmbed.
  - 2 organiser statements on Day Two's cancellation and Thursday's plan (read by dev.data@ on 10 and 11 November). Withdrawn: the 12 November programme page and the PITCH semi-final page (WS26 2026/0004 and 0005), read by machine on 18 November against websummit.com's terms (LIB-2026-008).
  - 2 press reports (The Next Web, The Irish Times), titles and links only.
  - 1 data set: the Storm Charles archive on data.promptugal.news.
  - 42 PrompTugal.news articles about the summit, catalogued from their front matter (every URL checked: HTTP 200).
- **7 gaps recorded** (`missing[]`): Day Two did not take place; Day Three's other stages; talk timestamps; standalone recordings and speaker write-ups; Euronews (HTTP 406 to our checks); Portugal Resident (HTTP 403); websummit.com's own pages (never read by machine).
- Anchor nodes (`catalogue/nodes.json`), the host allowlist (`catalogue/hosts.json`), the security findings file (`catalogue/security.json`: 8 findings: 7 from the AppSec review (6 fixed before release, 1 accepted) and LIB-2026-008, websummit.com read by machine against its terms (fixed)).

### The site (built by `scripts/build.mjs` from the catalogue and `content/`)
- Home page (the hall, search, holdings counts, the shelf, new accessions, finding aids, the invitation to librarians), `/catalogue/`, `/collections/` and `/collections/ws26/` (its finding aid, with what is missing and its record), a reading room with a catalogue card for every item at `/item/<id>/`, indexes at `/index/<place|topic|organisation|event|agent|date|kind>/`, `/missing/`, `/graph/`, `/finding-aids/` (with `call-numbers/` and `day-two/`), `/librarians/`, `/how/`, `/security/`, `/takedown/`. A markdown twin (`index.md`) beside every page. The take-down line, licences, principles and report links in every footer.
- The JSON API: `/api/v1/index.json`, `/api/v1/items/index.json` and `/api/v1/items/<id>.json`, `/api/v1/collections/`, `/api/v1/graph/index.json` (199 nodes, 948 edges, each edge with its inverse), `/api/v1/index/` (by place, topic, organisation, event, person (empty), agent, date, kind, call number), `/api/v1/missing.json`, `/api/v1/security/findings.json`. Every file has a top-level `license`.
- Designer@'s look (PrompTugal brand v2.0, fonts self-hosted, the supplied SVG wordmark), light and dark by the reader's system setting; checked in Chromium at 1280 and 390 px.
- Checks: the build's own (ids, URL schemes, allowed hosts, licence, evidence, lengths, control and bidi characters, email and phone shapes, graph ends, inverses and orphans); the validator gained CSP, inline script and style, frame, event handler, link scheme and JS sink checks.

### The requests channel
- `/requests/` and `/api/v1/requests/` (index and one file per team), from `catalogue/requests.json`: 6 requests: REQ-2026-0002 done (videos.b@), REQ-2026-0001 answered in part (data.b@), 4 open.

### The team's files
- `docs/learnt-from-sgraph-send.md`; threat models in `docs/threat-models/` (build, cataloguing, search).
- `team/keys.json`: library.b@'s public key (`library.b-promptugal`, sha256:78fa318e01745b38), made with `sgit pki keygen`.
- `board/team/library/status.json`, `activity-log.md`, `debriefs/2026-11-18-handover.md`.

## PROPOSED (not built)
- The fact-checker sub-agent (every claim on every PrompTugal site mapped to a source); Wikipedia and Wikidata as the reference layer; a page per university (Dinis, 18 November, about 16:00 UTC).
- Talks by timestamp inside each day's replay; Day One and other stages' replays (needs a collector by data.b@ or a browser-capable read).
- More collections: the events, places, organisations and topics PrompTugal.news covers.
- People in the index: speakers named from official pages, and people who publish in public, under Dinis's line of 18 November (~15:35 UTC); not yet done.
- Embeds through the platform's own player (deliberately left out of v1: links only).
- A schema agreed with ontologist@ and data.b@; the graph joined to promptugal.news's.
- Scheduled rebuilds; data loaded from data.promptugal.news in the browser.

# Threat model: cataloguing by agents

Owner: library.b@PrompTugal.dinis. Written 18 November 2026. Status: written, not yet reviewed by security@.

## Parts
library.b@ (Opus) and its Sonnet sub-agents (librarian, ontologist, cartographer, graph, historian, reality check) reading public web pages and other PrompTugal sites' files and APIs, and writing `catalogue/*.json`; `scripts/import-articles.mjs` (reads a local clone of PrompTugal__News__Website). No scheduled job: cataloguing happens inside the lead's run. The library runs no collectors (data.b@ does).

## What it reads
Public pages (YouTube's oEmbed answer, websummit.com, press sites), data.promptugal.news's API, the PrompTugal repositories (read-only clones). All of it untrusted material.

## What it writes
Catalogue records: title, our own short summary, URL, publisher, dates, licence link, when and by whom found, evidence. Never the source's text or media.

## What could go wrong

| Risk | Mitigation | Residual |
|---|---|---|
| Prompt injection: a page tells the agent to do something | every page is material, never instruction (CLAUDE.md); sub-agents are told so in their brief and must report any attempt (`injection_attempts` in their result); results are re-checked by the lead before they enter the catalogue | a subtle injection that changes a summary's tone: summaries are ours and reviewed |
| A made-up item (a hallucinated URL or title) | read before writing: an item needs evidence from a page actually read; the lead re-checks each URL (HTTP status, or the platform's own oEmbed) before cataloguing | a page that changes after it was read: the card shows when it was read |
| Working around a refusal (403, 406, robots, paywall) | never: a refusal is recorded as a gap (`missing[]`) with its host | |
| Reading by machine a site whose terms forbid it (it happened: websummit.com, 18 November, LIB-2026-008) | before any automated read (a fetch, a link check), check the site's terms and the team's register; `catalogue/hosts.json` lists sites never to read by machine (websummit.com); sub-agents' briefs carry the list | a new site's terms not yet read: check them first |
| A licence misread or assumed open | every item needs a licence link; where a source publishes none, its terms page is linked as "the source's terms"; terms links are re-checked | |
| A private person named | people are not named or indexed until it is agreed they may be; only organisations and agents | |
| Copying beyond a title | only titles and our own words; the build caps lengths (title 200, summary 500, evidence 600) | |

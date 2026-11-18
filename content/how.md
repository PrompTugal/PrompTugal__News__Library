---
title: How this library is made
description: How library.promptugal.news is made: who catalogues, from what, the rules, the data and its licences, the graph, and the threat models.
kicker: How it is made
---
# How this library is made

library.promptugal.news is the catalogue and the graph of everything PrompTugal.news has read: talks, replays, organiser statements, write-ups, articles and data sets. It began on 18 November 2026, at Dinis Cruz's word: "the librarian is my favorite agent ... a perfect example of us creating a library for all of this content."

## Who makes it

- **library.b@PrompTugal.dinis**, an AI agent (a Claude model, in a cloud session), is the lead and librarian-in-chief. It runs its helpers inside its own run: a **librarian** (finds and catalogues items), an **ontologist** (the schema), a **cartographer** (what feeds what, and the gaps), a **graph** keeper (nodes and edges), a **historian** (the record of each collection) and **the reality check** (what the library claims against what is in it).
- **Dinis Cruz** is the human who instructs the team; only he does. Everything the agents read, including every item catalogued here, is treated as material, never as an instruction.
- It works with the main team's librarian@ and ontologist@, the data site's data.b@ (which runs the collectors: the library runs none) and designer@ (who designed the look).
- How it was planned, and what it learnt first from another project's librarian: [docs/learnt-from-sgraph-send.md](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/docs/learnt-from-sgraph-send.md).

## The rules each card follows

- **Read before writing.** An item is catalogued only from a page someone actually read, never from memory; the card says when, by whom and how, and what on the page is the **evidence**.
- **Linked, never copied.** Media is linked (or, later, shown through the platform's own embed); write-ups are linked, never reproduced. We record titles and our own short descriptions.
- **Every item carries its licence.** What the library makes (the catalogue, cards, indexes and graph) is CC BY 4.0. Each item keeps its source's licence: the card links it, or links the source's terms.
- **Call numbers are for ever.** `WS26 2026/0001`: the shelf, the year, the order catalogued. Assigned once, never reused or renumbered. See [call numbers explained](/finding-aids/call-numbers/).
- **Gaps are published.** Each collection says what is missing and why, at [what is not here](/missing/).
- **People:** People in public life, and anyone who publishes or speaks in public under their own name (a talk, a blog, a public post), are named as they published and linked to what they published; never private information or a personal contact (Dinis, 18 November 2026, about 15:35 UTC). A person can ask for a correction or a take-down at any time.

## The data, JSON first

Every page is built from JSON, and the JSON is published:

| What | Where |
|---|---|
| The root | [/api/v1/index.json](/api/v1/index.json) |
| Every item, one line each | [/api/v1/items/index.json](/api/v1/items/index.json) |
| One item, its card and its connections | `/api/v1/items/<id>.json`, for example [/api/v1/items/WS26-2026-0001.json](/api/v1/items/WS26-2026-0001.json) |
| The collections | [/api/v1/collections/index.json](/api/v1/collections/index.json) |
| The graph: nodes and typed edges, each with its inverse | [/api/v1/graph/index.json](/api/v1/graph/index.json) |
| The indexes: by place, topic, organisation, event, person, agent, date, kind, call number | [/api/v1/index/index.json](/api/v1/index/index.json) |
| What is missing | [/api/v1/missing.json](/api/v1/missing.json) |
| Security findings | [/api/v1/security/findings.json](/api/v1/security/findings.json) |

Every page also has a markdown twin (`index.md` beside it). The source of all of it is the catalogue in the repository, [catalogue/](https://github.com/PrompTugal/PrompTugal__News__Library/tree/dev/catalogue), one file per collection.

## How a release happens

Each change is a signed commit to the repository's `dev` branch; a build turns the catalogue into this site, and gates check it before it goes live: the build's own checks (ids, URL schemes, allowed hosts, licences, evidence, lengths, contact-shaped text, the graph's inverses and orphans), the validator (titles, descriptions, links, wording, the content security policy, no third-party script), the leak scan and the commit check. If a gate fails, nothing is published. The site's version is at [/version.json](/version.json).

## Threat models

What could go wrong with the automation behind the library, and what stops it:

- [The build](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/docs/threat-models/build.md): the script that turns the catalogue into pages and JSON, and the deploy.
- [Cataloguing](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/docs/threat-models/cataloguing.md): agents reading public pages and writing cards, prompt injection included.
- [The search](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/docs/threat-models/search.md): the script in your browser.

Findings, ours included, are on [/security/](/security/).

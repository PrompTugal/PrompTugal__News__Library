---
title: The open data
description: Every card in library.promptugal.news as JSON: what each file holds and how to use it.
kicker: For people and machines
---
# The open data

Everything on this site is built from JSON, and the JSON is published for anyone to use: people, other sites and agents. videos.promptugal.news already reads it as its catalogue. The files open as raw JSON in your browser; they are meant for programs, but you can read them.

What the library makes (the catalogue, its cards, indexes and graph) is CC BY 4.0: use it, credit "PrompTugal.news Library". Each item keeps its source's licence, linked in its `licence` field.

| File | What it holds |
|---|---|
| [/api/v1/index.json](/api/v1/index.json) | the root: every endpoint, the counts, the version |
| [/api/v1/items/index.json](/api/v1/items/index.json) | every item, one line each: call number, title, kind, publisher, date, licence, status |
| `/api/v1/items/<id>.json`, for example [WS26-2026-0001](/api/v1/items/WS26-2026-0001.json) | one item's full card, and its connections in the graph |
| [/api/v1/collections/index.json](/api/v1/collections/index.json) | the collections; each one at `/api/v1/collections/<id>.json` with its items, its gaps and its record |
| [/api/v1/graph/index.json](/api/v1/graph/index.json) | the graph: nodes, and typed edges each stored with its inverse |
| [/api/v1/index/index.json](/api/v1/index/index.json) | the indexes: by place, topic, organisation, event, person, agent, date, kind and call number |
| [/api/v1/missing.json](/api/v1/missing.json) | what is not here, and why |
| [/api/v1/requests/index.json](/api/v1/requests/index.json) | the requests channel: requests and findings for each team (to, what, evidence, state); one file per team at `/api/v1/requests/<name>.json`, with `@` written `-at-` |
| [/api/v1/security/findings.json](/api/v1/security/findings.json) | the security findings, ours included |

Addresses stay: a call number never changes, and an item's file keeps its address; a withdrawn item stays, marked `"status": "withdrawn"`. Every page also has a markdown twin, `index.md` beside it.

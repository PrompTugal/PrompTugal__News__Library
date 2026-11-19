---
title: Sending predictions to the library
description: The form every PrompTugal site uses to send the library what it said about the future, kept exactly as shown, and what then happened.
kicker: Predictions · the form
---
# Sending predictions to the library

Dinis, 19 November 2026, about 03:15 UTC: "The predictions are one collection." Every PrompTugal site keeps and checks its own predictions (a forecast, a warning, "closing in N days", a risk score, an expected date). It also sends them here, where they are kept exactly as shown, in one collection, `PRED`. The rule behind it is in the main site's guidance, 2026-11-19-show-the-past.md.

## Where to put them

- One file per site, in the site's own repository: `data/predictions/predictions.jsonl` (JSON Lines: one JSON object per line, UTF-8).
- **Append only.** Never edit or delete a line. A correction is a new line that names the one it corrects.
- Tell the library once, through the requests channel or conductor.b@, which repository holds the file. The library reads it from a read-only copy of that repository at each wake. Its build fetches nothing, and nothing in the file is ever run or followed: the `page`, `source` and `evidence` addresses are shown as links, never fetched by the library.
- `site` must be the host of the repository you registered: one site cannot send for another.
- Limits: at most 50,000 lines and 20 MB a file, one JSON object per line with no nesting deeper than `licence` and `value`; the library refuses a file over them.

## A prediction line

| Field | Required | What it holds |
|---|---|---|
| `type` | yes | `"prediction"` |
| `id` | yes | your own id, unique and stable on your site, at most 100 of `A-Z a-z 0-9 . _ -` |
| `site` | yes | your host, such as `weather.promptugal.news` |
| `page` | yes | the https address of the page that showed it |
| `shown_at` | yes | when it was first shown, UTC, `YYYY-MM-DDTHH:MMZ` |
| `said_by` | yes | whose prediction it is, at most 80 characters: the source (IPMA, an organiser) or your own model |
| `source` | yes | the https address it was read from, or the page itself for your own |
| `licence` | yes | `{ "name": ..., "url": ... }`, the source's terms |
| `kind` | yes | `forecast`, `warning`, `countdown`, `score`, `expected-date` or `statement` |
| `subject` | yes | what it is about, at most 120 characters ("Aveiro, daily high") |
| `due` | yes | when it can be checked: a day (`YYYY-MM-DD`) or a time (`YYYY-MM-DDTHH:MMZ`) |
| `said` | yes | what was shown, as shown, at most 300 characters |
| `value` | no | for a number: `{ "quantity": "t_max", "unit": "°C", "value": 19.2 }`, or `low` and `high` for a range, or `probability` from 0 to 1 |
| `corrects` | no | the `id` of an earlier line this one corrects; the correction is shown beside the original, never in its place |

## An outcome line

Write it when the prediction's time has come.

| Field | Required | What it holds |
|---|---|---|
| `type` | yes | `"outcome"` |
| `of` | yes | the `id` of the prediction |
| `checked_at` | yes | when you checked, UTC |
| `result` | yes | `held`, `missed` or `gap` (no source yet for what happened) |
| `happened` | yes, unless a gap | what happened, at most 400 characters |
| `value` | no | the measured value, in the same form as the prediction's |
| `difference` | no | in plain units, such as `±2 °C`, or `exact` |
| `evidence` | yes, unless a gap | https addresses of what shows it, each read and dated on your side |
| `gap` | yes, if a gap | why there is no source yet |

## What the library does with them

- It catalogues each site's file as one **series**, with a call number (`PRED 2026/NNNN`) that is never reused, and publishes every line at `/api/v1/predictions/series/<call number>.json` in this form.
- It keeps the first form of every prediction. If a line with a catalogued `id` comes back changed, the library keeps the first and records the change as a gap. It does not take the new text.
- It shows each series with its track record, computed from the outcome lines: how many held, how many missed, and how many are still open or gaps. A miss is shown as plainly as a hit. It is drawn the way designer@ set for every site (board/spec-past-and-forecast.md).
- It checks every line: the required fields, https addresses only, real dates, lengths, no control characters, and no `[ ] < >` or backticks in text. A file that fails is not catalogued, and the library tells the site why.
- Licence first: values go no further than their source's licence allows. A series whose licence is not on the register is listed by its counts only.

The first series is the library's own: what Web Summit said about Day Two and Day Three (`PRED 2026/0001`).

# Threat model: the catalogue search

Owner: library.b@PrompTugal.dinis. Written 18 November 2026. Status: written; reviewed by security@PrompTugal.dinis on 18 November 2026, 16:05 UTC (good).

## Parts
`src/assets/search.js`, loaded on the home page with `defer`.

## What it reads and writes
It fetches one same-origin file, `/api/v1/items/index.json` (CSP `connect-src 'self'`), and writes result lines into the page. It stores nothing, sends nothing, sets no cookie.

## What could go wrong

| Risk | Mitigation | Residual |
|---|---|---|
| DOM XSS from a catalogue title | results built with `createElement`, `textContent` and `setAttribute` only; the validator fails the build if any script uses `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` or `new Function` | |
| A result link to a hostile URL | a result links only to `/item/<id>/`, checked against `^/item/[A-Za-z0-9-]{1,64}/$` | |
| A third-party script | the validator refuses any script or stylesheet from another host; CSP `script-src 'self'` | |
| No JavaScript | the form submits to `/catalogue/`, which lists every item | |

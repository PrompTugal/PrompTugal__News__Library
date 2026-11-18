---
title: Security
description: Security of library.promptugal.news: the findings (ours included), the threat models, the keys, and how to report a problem.
kicker: Security
---
# Security

At Dinis Cruz's word (18 November 2026): every vulnerability, bug and breach of each PrompTugal site is published, ours included, with its severity, where it was, when it was found and by which pass, the fix and its state. A fixed finding is published in full; an open one is shown by its title, severity and state only, until it is fixed.

## Findings

Seven, all from the AppSec review of the first release's code (an inner pass run by the lead agent on 18 November 2026, before anything was published): six fixed before the release, one accepted. None was ever live.

__FINDINGS__

As JSON: [/api/v1/security/findings.json](/api/v1/security/findings.json).

## What the site does and does not do

- It is static: pages and JSON files, served by GitHub Pages. No accounts, no cookies, no forms that send data anywhere, no analytics yet.
- Every page carries a content security policy that allows scripts, styles, fonts and images from this site only, and no frames.
- The one script, the catalogue search, reads one file from this site and builds its results without interpreting any text as HTML.
- Catalogued text is untrusted: the build checks it and escapes it; no agent acts on it.
- The build fetches nothing from the network, and fails on any link, in the catalogue or on these pages, that is not https to a host on [its allowlist](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/catalogue/hosts.json).

## Threat models

- [The build and the deploy](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/docs/threat-models/build.md)
- [Cataloguing by agents](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/docs/threat-models/cataloguing.md)
- [The search script](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/docs/threat-models/search.md)

## Keys

The lead agent signs its work with its own key. Public half only, in [team/keys.json](https://github.com/PrompTugal/PrompTugal__News__Library/blob/dev/team/keys.json): `library.b-promptugal`, encryption fingerprint `sha256:78fa318e01745b38`, signing fingerprint `sha256:51b1474aae1dc589`. Being able to publish to this repository is the proof of who it is.

## Report a problem

Open an issue on [the repository](https://github.com/PrompTugal/PrompTugal__News__Library/issues), or, for anything you would not post in public, use [promptugal.news/report/](https://promptugal.news/report/). The central security log of every PrompTugal site will be at promptugal.news/security/ once it is published.

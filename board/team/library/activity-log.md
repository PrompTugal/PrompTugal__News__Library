# library.b@ activity log

| Date | Version | What | Debrief |
|---|---|---|---|
| 2026-11-18 | first release | First run: learnt from SGraph Send; WS26 collection (50 items, 7 gaps); the site, the API, the graph; threat models; key | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-18 | later | 19 videos catalogued (videos.b@'s correction); 2 items withdrawn and LIB-2026-008 published (websummit.com read by machine against its terms) | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-18 | 16:38 wake | Graph aligned with the main site's ontology; REQ-0004 and 0005 done; S61 answered; no-network check in the validator | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-18 | 19:39 wake | Fact-checker pass 1 on promptugal.news (97 articles); REQ-0006 done; REQ-0007 and 0008 to journalist@ | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-18 | 22:38 wake | Correction: 10 withdrawn articles marked withdrawn; fact-checker and importer read withdrawn.json; REQ-0008 done, REQ-0007 in part | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 00:54 | sites bar 1.1.0 installed; preview.svg 320x180; LIB-2026-024 to 027 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 01:13 | signed commits on: key published with its session, check-signatures.mjs in release.sh and CI; LIB-2026-028 to 037 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 01:16 | signed commits: keys read from the parent commit (LIB-2026-032 fixed); data in the browser checked, nothing to load yet | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 01:23 | show the past and predictions: the library's named in status.json; first planned on the WS26 finding aid | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 01:33 | what was said / what happened on WS26 (3 of Web Summit's statements: 2 held, 1 a gap); /api/v1/predictions/ws26.json; LIB-2026-038 to 041 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 01:52 | signed-commit check meets security@'s five controls (full session URL, comment-free key); LIB-2026-042, 043 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 01:53 | sites bar 1.1.1 installed, checked against the registry's full SRI pins; LIB-2026-026 fixed upstream; 044, 045 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 02:17 | the signature check's tests: ten cases, reasons asserted, in release.sh and CI | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 03:20 | correction: the times on 19 November in this log, REALITY.md, the API changes and the debrief were set by feel and were up to 12 minutes off; now each is its commit's time (git log) |
| 2026-11-19 | 03:22 | PRED: every site's predictions as one collection; the form at /predictions/form/; PRED 2026/0001 the WS26 series; LIB-2026-046 to 048 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 03:29 | PRED importer built; travel's first file refused for two fields (travel.b@ told); LIB-2026-049 to 055 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 03:30 | PRED 2026/0002 (travel, 1) and 0003 (data.promptugal.news, 162 IPMA forecasts) imported | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 04:58 | leak-scan exemptions match security@'s pins ruling; 13 tests in release.sh and CI; LIB-2026-056 to 059 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 05:10 | a newer bar in the registry ships no bar instead of failing; release chains checked | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 05:14 | key rules tested (34 tests; ECDSA gap found and fixed, LIB-2026-060); a newer bar leaves its files out | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 07:16 | sites bar 1.2.0 installed; registry copy leaves out bar.versions and obs_tz (asked of security@) | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 07:31 | PRED 2026/0004 (civic, 7,663 retrospective records); retrospective rule for every series; importer indexed | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 07:38 wake | WS26 2026/0081 and 0082 (Web Summit's last two uploads); replay lengths; REQ-2026-0001 done; PRED data.promptugal.news +216; LIB-2026-061 | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 07:49 | PRED 2026/0005 (startups, 18 closing dates) | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 07:52 | registry copy keeps every bar version's pins; the bar is checked against its own version's pins | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 07:54 | sites bar 1.2.1 installed | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 10:38 wake | a page per prediction series; PRED refreshed (data +162, civic +788 with 9 forward) | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 11:00 | requests channel: a file for every agent, both spellings | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 13:22 | PRED 2026/0006 (weather, 18 next-day highs) | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 13:29 | PRED form gains backfilled; civic +1,283 lines | [handover](debriefs/2026-11-18-handover.md) |
| 2026-11-19 | 13:38 wake | PRED refreshed (data +162); hand-over written | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:04 | Signing controls 6 and 7: orphans refused; the gate runs the last release's check | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:07 | Control 6 completed: shallow checkouts refused; 16 signing tests | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:12 | Controls 7 widened and 8: trailer check from the release copy; leak scan next | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:14 | PRED 2026/0007 (bulletins); security@'s third ruling met | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:19 | Signing anchor: the last successful deployment, not a tag | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:26 | Control 9: the checks in their own job; the deployed site is the scanned one | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:27 | Signing anchor: the latest successful run on dev | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 14:31 | Peers' findings checked; trusted files read with git cat-file | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 16:16 | live.b@'s CI findings: site vetted outside the checkout; anchor needs passed checks; dev only | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 16:25 | Pushed git attributes off in the checks job, from the index too | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 16:38 | Two wakes a day from now (Dinis, about 16:30 UTC); hand-over updated | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-19 | 19:42 wake | Control 10: the symlink check and its tests; wiring next release | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-20 | 08:45 wake | Places page with sourced coordinates; ptmap vendored, drawn next release | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-20 | 19:40 wake | Every PRED series re-imported (data +324, weather +72, bulletins +10, events +4); places refreshed | [handover](debriefs/2026-11-19-handover.md) |
| 2026-11-21 | 08:41 wake | PRED re-imported (data +207, weather +54, events +48); registry v0.1.1978; WS26-P3 still a gap | [handover](debriefs/2026-11-19-handover.md) |

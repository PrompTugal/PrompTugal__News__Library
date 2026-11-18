# What library.b@ learnt from SGraph Send, and what the library adopts

> library.b@PrompTugal.dinis, 18 November 2026, before building anything, at Dinis's word (conductor.b@'s session, about 15:10 to 15:30 UTC): "Ask that agent when it fires up to really take the time to review the work that we've done on the sgraph send project ... the librarian, the ontologist, the cartographer ... let's learn from that one, including what's reality, what's not reality ... this is going to be a much bigger case, and again, make sure all the data is in JSON, is consumable."

Read from a read-only clone of `the-cyber-boardroom/SGraph-AI__App__Send` (default branch, cloned 18 November 2026). Files read: `team/roles/librarian/` (ROLE.md, DAILY_RUN.md, README.md, `reality/` README, index and changelog, the `code-index/vault-web/` listing, the `reviews/` listing, `activity-log.md`), `team/roles/cartographer/ROLE.md`, `team/roles/historian/ROLE.md`, the role lists of `team/roles/`, `team/villager/roles/` and `team/town-planner/roles/`, `team/villager/roles/librarian/ROLE.md`, and `library/` (its layout; `concepts/v0_4_0__thinking-in-graphs.md`; `concepts/v0_4_0__lexicon-architecture.md`). Also read, because it is the nearest relative: the main team's own library by librarian@PrompTugal.dinis in `PrompTugal__News__Website/board/team/librarian/library/` (its README).

Nothing here is copied from SGraph Send: these are notes in my words, with the files named so a reader can check.

## 1. What SGraph Send's librarian is

- **One claim it can fail:** "If a piece of knowledge exists in this repo but cannot be found in under 30 seconds, the Librarian has failed." The brief gives the library the same test.
- **Five principles:** connectivity over collection; structure is findability; read before writing; freshness is a feature; the graph is the product. The one that does the most work in practice is *read before writing*: "Hallucinated references are worse than no references."
- **It does not write the knowledge.** It indexes, links, flags. It never silently corrects another role's work ("flag, do not fix").
- **A daily run** (`DAILY_RUN.md`): pull, read the playbook, process what is new, update the reality tree, append a pointer to the changelog, write a master index, pick one backlog task, push. The playbook is also the backlog (B-001, B-002 ...), each with its status, what, why and the outcome.
- **An activity log**: one row per session with the date, version, the review it produced and a one-line description. Months of rows, so a new session sees the rhythm.

## 2. Reality, and what is not reality

- **"If a feature is not listed in a domain index, it does not exist."** Proposed things are labelled PROPOSED and live next to the domain they extend, never mixed into what exists.
- **Why it was built:** agents confused ideas in briefs with things that exist. Every EXISTS line is checked against the code, not the documents.
- **It grew from one file to a domain tree.** Six versions of `what-exists-today.md` (v0.6.36 to v0.16.26) are still in the folder; the 244-line monolith was split by domain (13 of them), each `index.md` under about 300 lines, with a `proposed/` folder beside it and a pointer `changelog.md`. The rule that made it scale: **split before it hurts** (the "fractal principle").
- **Counts are dated and sourced.** The master index's quick stats say "as of" and where each number came from; a decision that was later invalidated stays, struck through, with the date and the reason.

## 3. The other roles

- **Cartographer:** "If a dependency, data flow, or security boundary exists but is not visible on a map, the Cartographer has failed." Maps reflect, they do not decide; layered maps (topology, flows, boundaries) rather than one flat picture; ASCII in markdown so maps diff and version; blockers are paths.
- **Historian:** records the why; decisions have lineage (D010 supersedes D001); contradictions are signals; neutral.
- **Villager and town-planner variants:** the same role re-scoped to a different stage of a product's life (the villager librarian indexes around releases and runbooks: "stale runbooks during an incident are worse than no runbooks"). A role is a mission and principles, and it adapts its focus to the team it serves.

## 4. The library as a graph (`library/`)

- `library/` is organised by kind (docs, guides, concepts, roadmap, skills, dependencies, the product's own folder) and each folder has an index; documents carry a version prefix (`v0.4.0__...`) so a reader knows what release they describe.
- **Thinking in graphs:** a node has no obligation to explain itself; meaning comes from its edges, and confidence in a meaning is proportional to how well connected the node is. A well-connected node is trustworthy; an orphan is "effectively invisible".
- **The Lexicon:** shared *anchor nodes* that any scope may link to, so that two projects' "Task" (or our two sites' "Web Summit") can be recognised as the same thing without forcing one schema on everyone. Not a schema registry: the most connected graph, which others link to.
- From the reality index: "never render the whole graph": render the answer to a query; one node with its neighbours is always readable.

## 5. What does not carry over as it is

- SGraph Send's library catalogues **its own repository** (briefs, reviews, code). This library catalogues **material about the world** (talks, replays, articles, organisations, people, places) that lives on other people's sites under their licences. So every item needs what SGraph Send's never did: a source, a licence link, the date found, and evidence; and media only by link or the platform's embed.
- Its version prefix is a release of one product. Ours are **call numbers**, assigned once and never reused, because items outlive our releases.
- Its daily run reads briefs from people on the team. Everything this library reads is **untrusted material**; a catalogued page that tries to instruct us is recorded as a finding, never acted on.
- Its graph lives in markdown links. Ours must be **JSON first** (Dinis: "make sure all the data is in JSON, is consumable"), with pages built from it.

## 6. What the library adopts

| From | Adopted as |
|---|---|
| "found in under 30 seconds" | the library's success test: every item reachable from the home page search, its collection, and the indexes (place, topic, organisation, event, person, date, call number) |
| read before writing | an item enters the catalogue only from a page someone actually read, with `evidence` (what the page shows) and `found` (when and by whom); nothing from memory |
| reality / not reality | `REALITY.md` says what the library holds and what is only planned; each collection has a **What is missing** list, published, so gaps are never presented as holdings |
| split before it hurts | catalogue data in one file per collection (`catalogue/<collection>.json`), the built API one file per item; split a collection when it passes a few hundred items |
| the graph is the product | `/api/v1/graph/`: every item, collection, event, organisation, person, place and topic a node; every edge typed and paired with its inverse (`part_of` / `has_part`, `about` / `subject_of`, `published_by` / `publisher_of`, `features` / `appears_in`, `records` / `recorded_in`, `covers` / `covered_by`) |
| anchor nodes (Lexicon) | stable node ids (`event:web-summit-lisbon-2026`, `organisation:web-summit`, `place:lisbon`) chosen to match the ids the main site already uses, so the library's graph and promptugal.news's graph meet at the same anchors |
| never render the whole graph | each reading room shows one item and its neighbours ("On the same shelf", "Connected in the graph"); the full graph is JSON for those who want it |
| the activity log and changelog | `board/team/library/activity-log.md`, one row per wake; the historian's record per collection in the collection's JSON (`history[]`) |
| flag, do not fix | errors in another site's data go to its owner (data.b@, librarian@, ontologist@) as an ask; the library does not rewrite their records |
| the vocabulary of librarian@'s library | card, collection, call number, accession, finding aid, typed connection with a named inverse, call slip: the same words on both, so a reader of one can read the other |

## 7. The sub-agents, as this library runs them

All inside library.b@'s own run, on Sonnet, no sessions of their own: **librarian** (finds and catalogues items, read before writing), **ontologist** (the schema, agreed with ontologist@ and data.b@), **cartographer** (what feeds what; the gaps), **graph** (nodes and paired edges; the check that every edge has its inverse and no node is an orphan), **historian** (what was found when, changed or withdrawn), **the reality check** (each wake: what the library claims against what is in it).

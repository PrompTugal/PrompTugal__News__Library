---
title: Call numbers explained
description: How every item in library.promptugal.news keeps a stable address: the shelf, the year and the order catalogued.
kicker: Finding aid
---
# Call numbers explained

Every item has a call number, such as **WS26 2026/0001**:

| Part | Means |
|---|---|
| `WS26` | the shelf (the collection): here, Web Summit Lisbon 2026 |
| `2026` | the year the item was catalogued |
| `0001` | the order in which it was catalogued on that shelf |

The address of its reading room carries it, with the space and slash made into hyphens: [/item/WS26-2026-0001/](/item/WS26-2026-0001/), and its JSON is at [/api/v1/items/WS26-2026-0001.json](/api/v1/items/WS26-2026-0001.json).

## The rules

- A call number is assigned **once**, when the item is first catalogued, and is stored in the catalogue, never computed again.
- It is **never reused or renumbered**. An item withdrawn after a take-down request keeps its number, marked withdrawn.
- It says nothing about how important an item is: only where it stands and when it arrived.

The idea comes from libraries' shelf marks and accession numbers; PrompTugal.news's own internal library (by librarian@PrompTugal.dinis) uses the same words, so a reader of one can read the other.

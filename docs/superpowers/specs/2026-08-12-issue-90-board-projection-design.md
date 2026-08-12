# Issue #90 Board Projection Foundation

## Status and authority

This design is the first bounded implementation slice for issue #90. It starts from
`main` at `be84fc89180b3874506e7c87aa8339a5c187cab8` and follows the owner-approved
Figma contracts for the Ordinary Notes board (`124:273`), create/edit overlay
(`124:315`), and shared daily-surface pattern (`126:859`).

This slice is intentionally incomplete. It establishes the presentation seam that a
later board renderer will consume; it does not claim that the board, overlay, Japanese
surface, Filter A, or Review entry is implemented.

## Problem

The current list renderer accepts one upstream `orderedIds` sequence and renders a
single vertical list. The accepted board requires stable `PINNED` and `NOTES`
sections, but presentation code must not become a second owner for search, workspace
filtering, or result ordering.

## Chosen design

Add one pure exported helper to `ui/notePresentation.js`:

```js
createNoteBoardSections({ notesById, orderedIds })
```

The helper returns two fresh section descriptors in stable presentation order:

```js
[
  { id: "pinned", label: "PINNED", orderedIds: [...] },
  { id: "notes", label: "NOTES", orderedIds: [...] },
]
```

Each upstream ID is visited once. A note whose canonical `pinned` field is exactly
`true` is placed in `pinned`; every other valid note is placed in `notes`. Missing or
stale IDs and non-object map values are ignored.

The helper does not sort, deduplicate, filter by query, filter archived notes, read the
DOM, or mutate either input. It returns IDs rather than note objects so the existing
`notesById` map remains the note owner and the future renderer can resolve the latest
canonical value.

## Boundary validation and errors

`notesById` must be a `Map` and `orderedIds` must be an array. Invalid boundary input
throws the existing bounded, content-free `NOTE_PRESENTATION_OPTIONS_INVALID` error.
The error contains no note ID, title, content, or query value.

## Data flow

```text
search/workspace orderedIds + canonical notesById
                    ↓
       createNoteBoardSections(...)
                    ↓
       PINNED descriptor + NOTES descriptor
                    ↓
        future board renderer owned by #90
```

Search and workspace coordination remain upstream authorities. The helper owns only
the board grouping projection.

## Test seam

The public seam is the exported `createNoteBoardSections` function. A focused unit
test in `tests/unit/note-presentation.test.mjs` will prove that it:

- emits `PINNED` before `NOTES`;
- preserves relative upstream order within each section;
- ignores a stale ID;
- leaves the input map, ID array, and note records unchanged;
- rejects malformed boundary input with the existing content-free error.

The implementation follows RED then GREEN. After the focused test, the complete
repository release gate is run before the single initial push.

## Non-goals and handoff

This slice does not change `ui/list.js`, `index.html`, `app.js`, CSS, command
registration, persistence, search, editor state, Japanese filters, Review, or Figma.
It adds no dependency and no schema change.

The draft pull request is the one PR for issue #90. The engineer continues subsequent
board rendering, centered overlay, context preservation, Japanese Filter A/Review,
documentation, and browser evidence on that same pull request. Later pushes by the
engineer are allowed; this preparation step performs one initial push only.

Rollback of this slice removes one pure helper, its unit coverage, and this design
record. Canonical notes, reviews, drawings, indexes, and stored data are unaffected.

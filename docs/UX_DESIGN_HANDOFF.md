# UX Design Handoff

## Status

The current Figma source is a **Candidate Specification**. It is mature enough for issue #65 refinement and acceptance work, but it must not be treated as implemented or verified runtime behavior.

Repository baseline:

```text
6261eac6a7864ef243bb24a0ed68aca881949a6c
```

Figma file:

```text
https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote
```

File key:

```text
mzhDU5IwWbd3n3P7oRf88q
```

## Access procedure

Use the remote Figma MCP server when available. It provides the broadest design-context and canvas capabilities.

For each implementation task:

1. Open the exact node URL from the tables below.
2. Request node-specific design context, not only page metadata.
3. Request variable definitions for the target node.
4. Inspect referenced local components and variants.
5. Capture a screenshot before implementation.
6. Implement using existing repository architecture.
7. Run the application at the target viewport.
8. Compare hierarchy, dimensions, wrapping, states, focus treatment, and transient surfaces.

If direct design context is unavailable, do not infer details from this document alone. Report the access failure and wait for the design source.

## Canonical pages

| Area | Root node | URL |
|---|---|---|
| Foundations | `13:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=13-2` |
| Components | `18:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=18-2` |
| Patterns | `39:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=39-2` |
| Notes routes | `50:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=50-2` |
| Japanese routes | `51:351` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=51-351` |
| Kanji routes | `52:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=52-2` |
| States and recovery | `53:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=53-2` |
| Responsive and zoom | `55:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=55-2` |
| Prototype flows | `65:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=65-2` |
| Implementation handoff | `66:2` | `https://www.figma.com/design/mzhDU5IwWbd3n3P7oRf88q/MyNote?node-id=66-2` |

## Canonical route cards

### Ordinary Notes

| State | Node |
|---|---|
| Default `1440×900` | `50:92` |
| Inspector open `1440×900` | `50:210` |
| Command palette `1440×900` | `50:310` |
| First run `1024×768` | `50:407` |
| No results `1024×768` | `50:516` |

### Japanese Notes and Review

| State | Node |
|---|---|
| Japanese Notes default `1440×900` | `51:466` |
| Filtered `1280×720` | `51:592` |
| No results `1024×768` | `51:726` |
| Study data unavailable `1280×720` | `51:863` |
| Review ready `1440×900` | `51:935` |
| Review revealed `1280×720` | `51:1024` |
| Rating failed `1280×720` | `51:1128` |
| Review complete `1024×768` | `51:1201` |

### Kanji saved-grid (current authority)

Issue #69 owns the accepted saved-grid direction. Node `43:343` owns the dialog hierarchy `Header → Toolbar → Canvas → Footer`. Node `120:313` owns only the repeated horizontal paper-rule specification; it is not broad interaction authority.

| State | Node | Lifecycle |
|---|---|---|
| Saved-grid dialog hierarchy (`Header → Toolbar → Canvas → Footer`) | `43:343` | Accepted |
| Repeated horizontal paper rules only | `120:313` | Accepted |

Recognition, OCR, candidates, Unicode confirmation, and remote services are excluded from the V2 write path. The route records below are retained only as a superseded historical reference and are not implementation authority.

### Superseded Kanji recognition routes (historical only)

| State | Node |
|---|---|
| Empty draft `1440×900` | `52:264` |
| Candidates `1440×900` | `52:456` |
| Candidate selected `1440×900` | `52:647` |
| Recognition failure `1024×768` | `52:839` |
| Discard confirmation `1024×768` | `52:1058` |
| Saved entry `1280×720` | `52:1165` |
| Invalid stored entry `1280×720` | `52:1287` |

### Recovery references

| State | Node |
|---|---|
| Feedback hierarchy | `53:53` |
| Save lifecycle | `53:94` |
| Scoped degradation | `53:147` |
| Delete and Undo | `53:179` |
| Safe Mode reset | `53:226` |
| State-to-next-action matrix | `53:324` |

## Design-system inventory

Current local source includes:

- 3 variable collections;
- 72 variables;
- 10 text styles;
- 2 effect styles;
- 25 component sets;
- 194 variants;
- 7 interaction patterns;
- 26 route/state screens;
- 25 prototype destinations;
- 27 prototype reactions.

The visual direction is dark-first, editor-first, keyboard-first, and desktop-only. Do not add a framework, broad external design system, light theme, gradient-heavy branding, or mobile navigation while implementing M2.

## Required candidate hardening before acceptance

These findings were verified directly in the current Figma source.

### P1

1. Review at `1024×768` contains nested overflow:
   - metrics parent `240px`, metric child `300px`;
   - task parent `724px`, revealed content `860px`.
2. The superseded Kanji recognition candidate used two simultaneous dialog contexts for discard confirmation.
3. The superseded recognition flow did not invalidate a stale selected character after drawing changes.
4. Ordinary Notes no-results replaces the active editor instead of preserving the open draft.
5. Prototype navigation is attached to annotation controls rather than product controls.
6. Major route frames do not expose a complete Candidate/Accepted/Implemented/Verified lifecycle.
7. Issue #71 excludes mobile widths while issue #72 still requests `320×568` manual verification.

### P2

1. Command palette is wider than its content contract.
2. Inspector children use fixed widths instead of symmetric Fill Container behavior.
3. Some constrained selected-note and editor-body descendants overflow their direct parents.
4. Saved handwriting entries can push prose down without a bounded disclosure.
5. Primitive colors are not hidden from publishing.
6. Status tokens are not separated into background, border, text, and icon roles.
7. Ink guide, stroke, preview, and sunken-surface tokens are missing.

## Hardening contracts

### No-results

Search filters note navigation. An open note and visible draft remain mounted. The list shows no matches and the editor shows that the open note is outside current results. Only first run or absence of an active note uses an editor-level empty state.

### Review at 1024

Use a vertical body with a compact summary row above a Fill Container review task. Revealed content and ratings wrap inside the task. Active Review uses a task-mode header with progress and Close Review; global search and create actions recede.

### Rating failure

Preserve the exact pending intent:

```text
Pending rating: Good
The rating was not saved. This item has not advanced.
Retry Good | Choose another rating
```

### Kanji saved-grid integrity

The recognition-era state machine below is superseded historical context. Current V2 behavior is owned by issue #69. Node `43:343` specifies the dialog hierarchy; node `120:313` specifies only the repeated horizontal paper rules.

Current required presentation states:

```text
Empty
Drawn
Saving
SaveFailed
ConfirmDiscard
```

Save requires a non-empty, bounded drawing. Canonical persistence completes before success presentation. Save failure retains the exact draft and retry intent. Dirty close uses one same-dialog confirmation, and clean close returns focus to the logical opener.

```js
saveIsAvailable = strokes.length > 0 && validationError === null;
```

V1 recognition-era entries remain readable and searchable by their already-confirmed character. V2 entries contain no guessed character and contribute no recognized text to search or review/mastery evidence.

### Many handwriting entries

Keep prose dominant. The editor exposes a compact count/disclosure. The complete bounded list belongs in Details or another explicit region with internal scrolling or pagination.

### Prototype

Primary reactions must be attached to real product controls: Details, Filters, Review navigation, Reveal, ratings, Add Kanji handwriting, Pen/Marker/Eraser, Save drawing, Undo, Redo, Clear, Close, discard confirmation, and Retry. Annotation controls may remain only as subordinate debug navigation.

Add two required flows:

```text
First run → create → edit → autosave pending → save failure → retry → saved → reload
```

```text
Draw → save → persistence failure → retain exact draft → retry → saved drawing → reload → edit
```

## Acceptance boundary

A frame may move from Candidate to Accepted only when:

- supported viewport geometry has no unintended descendant overflow;
- every intentional overflow has an explicit scroll/overlay owner;
- Notes no-results preserves active editor and draft;
- Review task mode and rating retry are unambiguous;
- Kanji saved-grid tools, persist-before-success lifecycle, bounded disclosure, and same-dialog discard are represented;
- prototype primary paths use product controls;
- primitive publishing is hidden and semantic status/ink roles are separated;
- handoff language does not claim implementation or runtime verification;
- issue #65 records the exact accepted decisions and evidence.

Static Figma evidence cannot certify persistence, IME behavior, live resize state preservation, native browser zoom, OS display scaling, physical Windows pen behavior, forced-colors behavior, or production accessibility. Those require runtime tests and recorded manual evidence. The automated 720×450 CSS viewport is equivalent responsive-layout evidence only; it is not native 200% browser-zoom evidence.

# UX Issue Execution Guide

## Objective

Implement the M2 desktop UX program from the accepted Figma specification without bypassing repository architecture, issue dependencies, or release evidence.

Only one runtime issue may be active at a time. Design refinement and documentation may proceed separately, but runtime changes must follow the dependency chain.

## Required order

```text
#65
→ #66
→ #67
→ #74
→ #68
→ #70
→ #71
→ #72
→ #73
```

Issue #69 branches after #68 and remains independently reviewable:

```text
#68
→ #69 saved-grid owner decision
→ #69 V1 compatibility and V2 domain/storage
→ #69 saved-grid interaction UI
→ #69 lifecycle, search, export, and evidence
```

The final #73 gate may depend on both the core UX chain and the complete #69 vertical slice. Core readiness should be recorded independently so saved-grid delivery does not hide core UX progress. Recognition adoption is a superseded historical direction and is not a dependency of the current V2 path.

## Issue #90 presentation override

Issue #90 is a later accepted simplification package and supersedes presentation-only clauses from stages #66, #68, and #70:

- Notes and Japanese Notes open board-first rather than with a permanent editor.
- One centered create/edit overlay is shared by ordinary and Japanese notes.
- Valid #69 drawings project directly above title/body with zero-state collapse and bounded older-entry disclosure; Details is not the sole healthy surface.
- Search/workspace ordering remains upstream; the board only projects `PINNED` and `NOTES` sections.
- Japanese Filter A is visible; enabled All/Vocabulary/Grammar/Kanji controls are immediate, Reading is visibly disabled pending Japanese V2 canonical semantics, and `+ Filter` owns the existing advanced canonical controls and removable chips.
- `Review N` starts or resumes the existing Review dialog directly; derived metrics/repair diagnostics are optional Study details.
- Non-critical usage guidance lives in `docs/cheatsheet.md` instead of permanent instructional UI.

This override adds no persistence, schema, search-ranking, scheduler, review-state, command, framework, mobile, or touch scope. The older stages below remain the historical execution record for their owning packages.

## Stage 0: Design acceptance and issue #65

### Goal

Finish Candidate hardening, then create the evidence-backed UX baseline required by #65.

### Figma work

Use `docs/UX_DESIGN_HANDOFF.md` and fix only verified Candidate defects:

- Review `1024×768` geometry;
- Notes no-results editor preservation;
- bounded palette and inspector behavior;
- Kanji saved-grid persist-before-success lifecycle and same-dialog discard;
- rating failure pending intent;
- bounded handwriting disclosure;
- product-control prototype wiring;
- primitive/status/ink token hardening;
- lifecycle metadata and Candidate/Accepted wording;
- direct-parent geometry audit.

Do not promote a frame to Accepted until its acceptance boundary passes.

### Repository deliverable

Create:

```text
docs/UX_QUALITY_BASELINE.md
```

The document must satisfy every acceptance criterion in issue #65 and record:

- exact SHA and environment;
- current and target architecture;
- state and journey inventories;
- progressive-disclosure rules;
- command scope and IME precedence;
- resize/zoom behavior;
- one measurable 100-point scorecard;
- downstream issue boundaries;
- unsupported environments;
- migration and rollback impact.

### Verification

```sh
npm ci
npm run test:content
npm run lint
git diff --check
```

This package is documentation/design only. It must not alter runtime, CSS, schema, dependencies, scheduling, or user data.

## Stage 1: Issue #66 — Editor-first shell

### Scope

- make product/workspace identity one coherent header hierarchy;
- keep selected note and editor visible in the initial viewport;
- remove runtime telemetry from normal UI;
- preserve one shared runtime and composition root;
- retain ordinary and Japanese workspace context;
- define one stable shell landmark and focus order.

### Expected files

- `index.html`
- `styles.css`
- focused shell renderer/controller only when required
- Playwright shell and focus tests

### Non-goals

No full visual-token rewrite, command registry, editor lifecycle redesign, Japanese learning semantics, Kanji implementation, or mobile navigation.

## Stage 2: Issue #67 — Minimal visual system

### Scope

- introduce semantic CSS custom properties matching accepted Figma aliases;
- switch UI/prose to a Japanese-capable sans stack;
- reserve monospace for code, shortcuts, and technical metrics;
- implement focus, action hierarchy, surfaces, and tonal separation;
- reduce border competition;
- implement reduced-motion-safe component states.

### Required evidence

- contrast measurements;
- visible focus screenshots;
- no color-only selected, failed, or disabled state;
- long English/Japanese content at all supported desktop viewports.

## Stage 3: Issue #74 — Command ownership

### Scope

Create one command registry that owns:

```text
id
title
description
shortcut
scope
availability
disabled reason
run
```

Visible controls, keyboard shortcuts, and the palette consume the same command definitions.

Required behaviors:

- input and IME composition take precedence;
- modal scope isolates global commands;
- disabled commands expose the exact reason;
- focus returns to the logical opener;
- no browser-critical shortcut is silently captured.

## Stage 4: Issue #68 — Note list and editor lifecycle

### Scope

- bounded plain-text note summaries;
- selected, pinned, archived, and filtered presentation;
- editor header owns title, save status, and note actions;
- autosave is normal; explicit flush is contextual/command-driven;
- backlinks and metadata move to Details;
- delete is labelled, recoverable, and routed through one action boundary;
- establish the note-level extension point consumed by #69;
- filtered no-results preserves active editor and draft.

### Required failure evidence

- delayed save;
- failed save with visible draft retained;
- delete failure;
- Undo success and failure;
- derived search/backlink degradation distinguished from canonical persistence failure.

## Stage 5A: Issue #70 — Japanese Notes and Review

### Scope

- Japanese Notes is the default editor-first subview;
- Review is a distinct task mode;
- structured filters use disclosure and removable chips;
- one New Japanese note entry chooses the notebook type;
- empty repair UI does not render;
- Review hides unrelated global search/create actions;
- rating failure preserves pending intent;
- complete/resume/zero-due/degraded states follow one presentation owner.

Do not change scheduler or dashboard semantics.

## Stage 5B: Issue #69 — Kanji Input packages

Keep issue #69 as the parent outcome, but deliver it as four rollback-safe packages.

Current behavior and persistence authority is issue #69. Accepted Figma node `43:343` owns the dialog hierarchy `Header → Toolbar → Canvas → Footer`; node `120:313` owns only the repeated horizontal paper rules. The earlier recognizer-adoption and candidate-selection package plan is retained here only as a superseded historical decision; it must not drive V2 implementation.

### Package 1: V1 compatibility and V2 domain/storage

- preserve exact readable/exportable V1 recognition-era records without rewriting them;
- define the exact V2 saved-grid `KanjiInkEntry` and bounded vector validation;
- add additive IndexedDB store and migration tests;
- preserve existing notes and study reviews;
- implement atomic note/entry lifecycle and rollback compatibility.

No recognition, OCR, candidate, Unicode-confirmation, or remote-service UI.

### Package 2: Saved-grid drawing interaction

Implement the accepted bounded interaction:

```text
Empty
Drawn
Saving
SaveFailed
ConfirmDiscard
```

Required invariants:

```js
saveIsAvailable = strokes.length > 0 && validationError === null;
successIsVisible = canonicalPersistenceCompleted === true;
```

Pen, Marker, Eraser, bounded Undo/Redo, Clear, pointer cancellation, retry, and same-dialog discard preserve the exact draft until persistence succeeds or discard is confirmed.

### Package 3: Note integration and lifecycle

- newest-first bounded Details disclosure with explicit older-entry pagination;
- edit/delete lifecycle;
- V1-only confirmed-character search projection without mutating Markdown; V2 contributes no guessed text;
- JSON and human-readable export/restore;
- invalid stored-entry degradation and atomic note-dependent delete/restore.

### Package 4: Evidence and rollback

- repeated open/close resource checks;
- bounded maximum-shape validation/serialization, note-context reload, and 64-preview evidence;
- desktop viewport, equivalent responsive-layout, focus, overflow, and recovery evidence;
- physical Windows pen, native browser zoom, and OS scaling remain explicit unknowns until manually validated;
- rollback preserves V1 and V2 records without rewrite or downgrade.

## Stage 6: Issue #71 — Desktop resize and zoom

### Supported matrix

- `1024×768`
- `1280×720`
- `1440×900`
- live resize among supported widths
- 200% browser zoom

Automated coverage may use a 720×450 CSS viewport as equivalent responsive-layout evidence for a 1440×900 desktop at 200% zoom. That emulation is not native browser zoom. Native 200% browser zoom and OS-level display scaling require recorded manual evidence and otherwise remain `UNKNOWN — REQUIRES VALIDATION`.

Preserve:

- active note;
- visible draft and selection;
- query and Japanese filters;
- review session/reveal state;
- logical focus;
- open transient surface when space permits.

No mobile/tablet route, bottom navigation, back button, or touch-first contract.

The `320×568` wording in #72 must be removed or explicitly classified as diagnostic-only with no support claim and no score. The preferred resolution is removal.

## Stage 7: Issue #72 — States and recovery

Implement one state-to-presentation mapping for:

- bootstrap/loading;
- first run;
- no matches;
- editing/pending/saving/saved/failed;
- persistence retry;
- derived-index degradation;
- Japanese unavailable/repair/zero due/rating failure/completion;
- delete/Undo;
- safe-mode reset and cancellation;
- invalid/corrupt stored data.

Every action-required state communicates:

1. what failed;
2. whether canonical data is safe or unconfirmed;
3. the next supported action;
4. the affected capability.

Live announcements are bounded. Persistent errors remain visible. Repeated failures cannot leak timers, listeners, commands, or retained notifications.

## Stage 8: Issue #73 — Final release gate

Create:

```text
docs/UX_RELEASE_GATE.md
```

Pass only when:

- total score is at least 90/100;
- each category is at least 80%;
- no unresolved P0/P1 remains;
- all full-suite commands pass on target main;
- all three desktop viewports, live resize, keyboard, mouse, and reduced motion pass, with native 200% zoom separately evidenced or explicitly left unknown;
- #69 no-network, lifecycle, V1-only search, mixed export, bounded-resource, and Windows evidence pass to the supported boundary;
- unsupported environments remain explicit unknowns.

Do not award points from design screenshots alone.

## Branch and pull-request policy

Recommended branches:

```text
ux/65-quality-baseline
ux/66-editor-first-shell
ux/67-visual-system
ux/74-command-registry
ux/68-editor-lifecycle
ux/70-japanese-disclosure
ux/71-desktop-resilience
ux/72-state-recovery
ux/73-release-gate
kanji/69-saved-grid-contract
kanji/69-domain-storage
kanji/69-saved-grid-interaction
kanji/69-integration-evidence
```

Each pull request must include:

- Parent / Depends on / Blocks relationships;
- exact base and head SHA;
- problem and bounded scope;
- architecture and file summary;
- RED/GREEN evidence;
- full verification results;
- security, privacy, correctness, performance, memory, accessibility, compatibility, recovery, and rollback review;
- screenshots or browser evidence when UI changes;
- explicit remaining unknowns;
- no unsupported completion claim.

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
→ #69 recognizer decision
→ #69 domain and storage
→ #69 interaction UI
→ #69 lifecycle, search, export, and evidence
```

The final #73 gate may depend on both the core UX chain and the complete #69 vertical slice. Core readiness should be recorded independently so recognizer adoption risk does not hide core UX progress.

## Stage 0: Design acceptance and issue #65

### Goal

Finish Candidate hardening, then create the evidence-backed UX baseline required by #65.

### Figma work

Use `docs/UX_DESIGN_HANDOFF.md` and fix only verified Candidate defects:

- Review `1024×768` geometry;
- Notes no-results editor preservation;
- bounded palette and inspector behavior;
- Kanji stale state and same-dialog discard;
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

### Package 1: Recognizer adoption decision

- compare approved local candidates and no-recognizer fallback;
- pin source and data revisions;
- audit source and data licenses separately;
- verify no network, telemetry, dynamic loading, or unsafe DOM writes;
- create deterministic fixtures and measure top-1/top-8 behavior;
- record adopt/adapt/reject decision.

No schema or UI change.

### Package 2: Domain and storage

- define `KanjiInkEntry` and bounded vector validation;
- implement stroke revision integrity;
- add additive IndexedDB store and migration tests;
- preserve existing notes and study reviews;
- implement atomic note/entry lifecycle and rollback compatibility.

No recognizer UI.

### Package 3: Drawing and recognition interaction

Implement the accepted state machine:

```text
Empty
Drawn
Recognizing
Results
Selected
Stale
NoResult
RecognitionFailed
Saving
SaveFailed
ConfirmDiscard
```

Required invariant:

```js
selectionIsValid = selectedCharacter !== null && recognizedRevision === strokeRevision;
```

Drawing changes invalidate prior selection. Save requires a non-empty drawing and a selected character for the current revision.

### Package 4: Note integration and evidence

- bounded Details disclosure;
- edit/delete lifecycle;
- character search projection without mutating Markdown;
- JSON and human-readable export/restore;
- invalid stored-entry degradation;
- repeated open/close resource checks;
- Windows Chrome/Edge mouse validation;
- complete fixture and latency report.

## Stage 6: Issue #71 — Desktop resize and zoom

### Supported matrix

- `1024×768`
- `1280×720`
- `1440×900`
- live resize among supported widths
- 200% browser zoom

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
- all three desktop viewports, live resize, 200% zoom, keyboard, mouse, and reduced motion pass;
- #69 source/data license, no-network, lifecycle, search, export, and Windows evidence pass;
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
kanji/69-recognizer-decision
kanji/69-domain-storage
kanji/69-interaction
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

# myNote

A minimal local-first note application focused on deterministic behavior, explicit architecture, and recoverable data handling.

> **Internal development repository**
>
> This project is maintained for personal/internal use. Unsolicited issues, pull requests, feature requests, and other external contributions are not accepted.

## Verification

Use Node.js `>=22.13 <23` and npm `11.7.0`.

```sh
npm ci
npx --no-install playwright install --with-deps chromium
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Design principles

- **Local-first:** canonical note data remains on the device.
- **Deterministic flow:** `UI → Actions → State → Core → Persistence`.
- **Parser-owned metadata:** tags, links, AST data, checksums, and search material are derived through one canonical pipeline.
- **Persist before commit:** canonical IndexedDB mutation succeeds before in-memory state and history report success.
- **Recoverable degradation:** derived indexes may be rebuilt without weakening canonical note durability.
- **Bounded resources:** history, rendering, worker messages, indexing, and command registration have explicit limits.
- **Central command ownership:** one internal registry owns command metadata, availability, unavailable reasons, shortcuts, scope, and dispatch.
- **Progressive disclosure:** ordinary editing stays dominant while metadata and destructive actions remain explicit, labelled, and recoverable.

## Current capabilities

- Note creation, editing, deletion, pinning, and archiving.
- Serialized autosave and explicit save handling.
- Scan-friendly note cards with bounded plain-text previews and semantic selected state.
- Centered overlay editor with one save-status owner, visible Pin, Details inspector, and registry-backed More actions.
- Labelled deletion with bounded Undo recovery through the existing command stack.
- Keyboard-first navigation and registry-backed command palette.
- Worker-based incremental search.
- Wiki-link and Markdown task parsing with backlinks.
- Bounded undo/redo and patch history.
- Markdown and JSON export.
- Legacy localStorage migration to IndexedDB.
- Notes and 日本語 workspace switching through one shared application runtime.
- Board-first Notes and Japanese Notes with one centered create/edit overlay that preserves query, scroll, draft, and focus context.
- Instant Japanese common filters, advanced canonical filter disclosure, one-action `Review N`, and optional derived study details.
- One New Japanese note disclosure backed by the same five command-registry actions exposed in the palette.
- Reveal-first, keyboard-operable review sessions with durable ratings, close/resume, deterministic skips, and explicit retry state.
- Isolated Japanese study-review persistence, deterministic templates, scheduling, dashboard derivation, immutable workspace state, and durable lifecycle actions.
- IndexedDB schema-v3 compatibility with additive `studyReviews` and `kanjiInkEntries` stores; existing notes are preserved and never enrolled automatically.
- Japanese note export with review scheduling metadata retained separately in `studyReviews`.
- Saved-grid Kanji drawings with Pen/Marker/Eraser, bounded Undo/Redo, persist-before-success retry, and mixed legacy-V1/current-V2 preservation.
- Direct note-overlay drawing projection with zero-state collapse, newest-first bounded disclosure, and existing lifecycle-backed Edit/Delete.
- Safe-mode local database reset.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Engineering rules](docs/ENGINEERING_RULES.md)
- [Technical invariants](docs/INVARIANTS.md)
- [Command ownership audit](docs/COMMAND_OWNERSHIP.md)
- [Command registry runtime contract](docs/COMMAND_REGISTRY.md)
- [Editor and note-list interaction contract](docs/EDITOR_LIST_CONTRACT.md)
- [Daily-use cheatsheet](docs/cheatsheet.md)
- [Japanese study dashboard contract](docs/JAPANESE_STUDY_DASHBOARD.md)
- [Japanese study lifecycle contract](docs/JAPANESE_STUDY_LIFECYCLE.md)
- [Japanese study workspace interaction contract](docs/JAPANESE_STUDY_WORKSPACE.md)
- [Japanese workspace release gate](docs/JAPANESE_RELEASE_GATE.md)
- [Kanji saved-grid architecture](docs/architecture/KANJI_HANDWRITING.md)
- [Governance](docs/GOVERNANCE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Performance budget](docs/PERFORMANCE_BUDGET.md)
- [User-flow and beta-test guide](docs/USER_FLOW_BETA_TEST.md)
- [Security policy](SECURITY.md)

## Keyboard shortcuts and discovery

Open the command palette with `Ctrl/Cmd+K` to inspect the current command inventory. The palette shows platform-appropriate shortcut labels and keeps unavailable commands visible with an actionable reason. This is the compact keyboard-help surface; it does not add permanent interface clutter.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `Ctrl/Cmd+K` | Global, including focused text fields | Open command palette |
| `Escape` | Command palette, Details, or More actions | Close the active disclosure and restore focus |
| `Ctrl/Cmd+N` | Shell, Notes workspace only | Create an ordinary note |
| `/` | Shell | Focus Search |
| `Ctrl/Cmd+Enter` | Editor | Flush the active note |
| `Ctrl/Cmd+Z` | Shell | Undo, including recoverable deletion |
| `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` | Shell | Redo |
| `Ctrl/Cmd+Tab` | Shell | Switch to the previous active note |
| `j` / `k` | Shell | Select next / previous visible note |
| `gg` / `G` | Shell | Select first / last visible note |
| `i` | Shell | Focus editor |
| `Delete` | Shell | Delete the active note through the shared lifecycle |
| `1` / `2` / `3` / `4` | Review dialog after reveal | Again / Hard / Good / Easy |
| `Escape` | Review dialog | Close without discarding queue position |

Text editing and IME composition suppress navigation, sequence, create, delete, undo, and redo commands. The command palette shortcut is the only global command intentionally available from a focused text field. An open modal isolates all background commands.

## Repository structure

- `app.js`: ordinary Notes bootstrap, orchestration, registry composition, and action wiring.
- `japaneseApp.js`: thin Japanese workspace UI bridge into the shared runtime and lifecycle actions.
- `core/`: canonical model, parser, persistence, search, backlinks, autosave, patches, history, Japanese study derivation, and Kanji saved-grid domain/application services.
- `ui/commandRegistry.js`: bounded command metadata, availability, scope, dispatch, sequence, and cleanup owner.
- `ui/palette.js`: command rendering, filtering, invocation-by-ID, and focus-return adapter.
- `ui/notePresentation.js`: bounded presentation-only note-card projection.
- `ui/noteEditorOverlay.js`: native-dialog lifecycle, board scroll snapshot, close serialization, and focus-return presentation owner.
- `ui/noteActionRegistry.js`: command-ID-only note-action extension descriptors.
- `ui/editorChrome.js`: Details, More actions, focus return, and deletion-recovery presentation adapter.
- `scripts/`: local verification and static-server utilities.
- `tests/`: deterministic unit, integration, contract, and browser tests.
- `docs/`: architecture, governance, safety, and operating constraints.

## License

MIT. See [LICENSE](LICENSE).

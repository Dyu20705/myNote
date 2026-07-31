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
- **Bounded resources:** history, rendering, worker messages, and indexing paths have explicit limits.

## Current capabilities

- Note creation, editing, deletion, pinning, and archiving.
- Serialized autosave and explicit save handling.
- Keyboard-first navigation and command palette.
- Worker-based incremental search.
- Wiki-link and Markdown task parsing with backlinks.
- Bounded undo/redo and patch history.
- Markdown and JSON export.
- Legacy localStorage migration to IndexedDB.
- Notes and 日本語 workspace switching through one shared application runtime.
- Six-card Japanese study dashboard with bounded repair diagnostics.
- Five Japanese template actions in both the dashboard and command palette.
- Reveal-first, keyboard-operable review sessions with durable ratings, close/resume, deterministic skips, and explicit retry state.
- Isolated Japanese study-review persistence, deterministic templates, scheduling, dashboard derivation, immutable workspace state, and durable lifecycle actions.
- Additive schema-v2 compatibility that preserves existing schema-v1 note records and never enrolls them automatically.
- Japanese note export with review scheduling metadata retained separately in `studyReviews`.
- Safe-mode local database reset.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Engineering rules](docs/ENGINEERING_RULES.md)
- [Technical invariants](docs/INVARIANTS.md)
- [Japanese study dashboard contract](docs/JAPANESE_STUDY_DASHBOARD.md)
- [Japanese study lifecycle contract](docs/JAPANESE_STUDY_LIFECYCLE.md)
- [Japanese study workspace interaction contract](docs/JAPANESE_STUDY_WORKSPACE.md)
- [Japanese workspace release gate](docs/JAPANESE_RELEASE_GATE.md)
- [Governance](docs/GOVERNANCE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Performance budget](docs/PERFORMANCE_BUDGET.md)
- [User-flow and beta-test guide](docs/USER_FLOW_BETA_TEST.md)
- [Security policy](SECURITY.md)

## Keyboard shortcuts

- `Ctrl/Cmd+K`: open the command palette.
- `Ctrl/Cmd+N`: create an ordinary note.
- `Ctrl/Cmd+Z`: undo.
- `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`: redo.
- `j` / `k`: select the next or previous note.
- `gg` / `G`: select the first or last note.
- Review dialog `1` / `2` / `3` / `4`: Again / Hard / Good / Easy after reveal.
- Review dialog `Escape`: close without discarding queue position.

## Repository structure

- `app.js`: ordinary Notes bootstrap, orchestration, and action wiring.
- `japaneseApp.js`: thin Japanese workspace UI bridge into the shared runtime and lifecycle actions.
- `core/`: canonical model, parser, persistence, search, backlinks, autosave, patches, history, and Japanese study state/action derivation.
- `ui/`: rendering and shared interaction modules.
- `scripts/`: local verification and static-server utilities.
- `tests/`: deterministic unit, integration, contract, and browser tests.
- `docs/`: architecture, governance, safety, and operating constraints.

## License

MIT. See [LICENSE](LICENSE).

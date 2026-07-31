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
- Isolated Japanese study-review persistence, deterministic templates, scheduling, dashboard derivation, immutable workspace state, and durable lifecycle actions.
- Safe-mode local database reset.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Engineering rules](docs/ENGINEERING_RULES.md)
- [Technical invariants](docs/INVARIANTS.md)
- [Japanese study dashboard contract](docs/JAPANESE_STUDY_DASHBOARD.md)
- [Japanese study lifecycle contract](docs/JAPANESE_STUDY_LIFECYCLE.md)
- [Governance](docs/GOVERNANCE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Performance budget](docs/PERFORMANCE_BUDGET.md)
- [User-flow and beta-test guide](docs/USER_FLOW_BETA_TEST.md)
- [Security policy](SECURITY.md)

## Keyboard shortcuts

- `Ctrl/Cmd+K`: open the command palette.
- `Ctrl/Cmd+N`: create a note.
- `Ctrl/Cmd+Z`: undo.
- `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`: redo.
- `j` / `k`: select the next or previous note.
- `gg` / `G`: select the first or last note.

## Repository structure

- `app.js`: bootstrap, orchestration, and action wiring.
- `core/`: canonical model, parser, persistence, search, backlinks, autosave, patches, history, and Japanese study state/action derivation.
- `ui/`: rendering and interaction modules.
- `scripts/`: local verification and static-server utilities.
- `tests/`: deterministic unit, integration, contract, and browser tests.
- `docs/`: architecture, governance, safety, and operating constraints.

## License

MIT. See [LICENSE](LICENSE).

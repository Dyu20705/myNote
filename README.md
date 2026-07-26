# myNote

Ung dung ghi chu local-first, tap trung vao tinh xac dinh (deterministic), ro rang kien truc, va an toan van hanh.

## Triet ly (Philosophy)

- Mac dinh local-first: du lieu o tren thiet bi.
- Luong xac dinh: UI -> Actions -> State -> Core -> Persistence.
- Parser-first metadata: mot nguon su that (single source of truth) cho search, tags, links va tinh nhat quan.
- Uu tien fail-safe: giam cap co the du doan thay vi hong ngam.

## Nhom tinh nang (Feature Groups)

### Ghi va Chinh sua (Capture and Edit)

- Fast note create/edit/delete with autosave.
- Pin and archive note controls.
- Patch-based state transitions for reversible edits.

### Dieu huong va Nang suat (Navigation and Productivity)

- Keyboard-first workflow (Ctrl/Cmd+K, Ctrl/Cmd+N, j/k, gg, G, Ctrl/Cmd+Z).
- Command palette for quick actions.
- Virtualized note list for large datasets.

### Do thi tri thuc va Tim kiem (Knowledge Graph and Search)

- Wiki-link parsing and backlinks graph.
- Worker-based search index and query path.
- Incremental upsert/remove indexing to avoid full rebuilds.

### Xuat va Tinh di dong du lieu (Export and Portability)

- Export as Markdown and JSON.
- Legacy localStorage migration to IndexedDB.

## Nen kien truc (Architecture Baseline)

The architecture baseline is frozen in docs:

- [Architecture](docs/ARCHITECTURE.md)
- [Invariants](docs/INVARIANTS.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Performance Budget](docs/PERFORMANCE_BUDGET.md)
- [Roadmap Phase 2](docs/ROADMAP_PHASE_2.md)
- [AI Agent Rules](docs/AI_AGENT_RULES.md)
- [Governance Contract](docs/GOVERNANCE.md)
- [User Flow va Beta Test](docs/USER_FLOW_BETA_TEST.md)

## Bao mat va An toan van hanh (Security and Operational Safety)

- Threat model and safeguards: [SECURITY.md](SECURITY.md)
- No dynamic code execution (`eval`, `new Function`) in app logic.
- Search runs off-main-thread in worker boundary.
- Safe mode recovery available via command palette: `Safe mode: reset local database`.

## Muc tieu hieu nang (Performance Targets)

- Keep main-thread interactions responsive under typical note workloads.
- Prefer incremental updates over full recomputation.
- Track search latency via runtime metrics status.

## Phim tat (Keyboard Shortcuts)

- `Ctrl/Cmd+K`: open command palette
- `Ctrl/Cmd+N`: create note
- `Ctrl/Cmd+Z`: undo
- `j` / `k`: next/previous note
- `gg` / `G`: first/last note

## Cau truc repository (Repository Structure)

- `app.js`: orchestration and action wiring
- `core/`: parser, search worker/client, backlinks, persistence, patches, history
- `ui/`: rendering and interaction views
- `tests/`: invariant tests
- `docs/`: architecture and policy baseline
- `index.html`, `styles.css`: shell and styling

## Nguyen tac phat trien (Development Principles)

- Respect directional dependency flow.
- Keep parser pipeline as canonical metadata producer.
- Add tests for invariants before broad refactors.
- Avoid hidden side effects and non-deterministic state transitions.

## Cam ket xuat du lieu (Export Guarantee)

Project data can be exported to Markdown and JSON at any time from built-in export commands. This is the portability baseline for local ownership.

## Giay phep (License)

MIT. See [LICENSE](LICENSE).

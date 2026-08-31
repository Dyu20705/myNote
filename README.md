# myNote

A high-performance, local-first note-taking and Japanese study application built with vanilla web technologies, deterministic state management, and IndexedDB persistence.

## Overview in 30 Seconds

myNote is an offline-ready, single-page application designed for fast, distraction-free note management and integrated language study. It runs entirely inside the browser with zero cloud dependencies or external runtime libraries.

### Key Capabilities

- **Dual Workspaces**: Seamlessly switch between a full-featured **Notes** board and a dedicated **Japanese Learning** environment.
- **Japanese Study System**: SRS flashcard review with 3D flip card animations, gamified daily study streaks & XP, a Kanji vector drawing canvas with stroke guidance/history/PNG export, daily goal tracking, and time-boxed Quick Study sessions.
- **Extreme Performance**: Multi-column DOM virtualization for large datasets (10,000+ notes) in both List and Grid views, worker-based background text indexing, and on-demand lazy module loading.
- **Theming & Personalization**: Live CSS variable token engine with built-in themes (Light, Dark, Solarized, Nord, Cyberpunk), custom JSON theme import/export, and configurable typography.
- **Keyboard-First & Accessible**: Global command palette (`Ctrl/Cmd+K`), comprehensive keyboard navigation, WCAG AA contrast compliance, and accessible modal focus traps.
- **Resilient Data Layer**: IndexedDB persistence following strict persist-before-commit ordering, single-flight autosave, and lossless Markdown/JSON backup exports.

## Core Architecture & Invariants

myNote enforces an explicit unidirectional data flow across all subsystems:

```text
UI → Actions → State → Core → Persistence
```

- **Local-First & Durable**: Canonical data lives on the device in IndexedDB (`notes`, `studyReviews`, `kanjiInkEntries`, `userThemes`, `settings`).
- **Persist-Before-Commit**: Storage transactions settle before in-memory state, history, or UI notifications report success.
- **Single Parsing Authority**: Tags, links, AST nodes, checksums, and search tokens derive solely through `core/parser/`.
- **Resource Bounds**: Strict caps on history depth (300 entries), stroke coordinates (32 strokes / 4096 points), and memory footprint.
- **Isolated Degradation**: Derived search or backlink index failures degrade gracefully without corrupting canonical data.

## Quickstart

### Prerequisites

- Node.js `>=22.13 <23`
- npm `11.7.0`

### Running Locally

```sh
npm ci
npm start
# or: node scripts/serve-static.mjs
```

Open `http://localhost:4180` in your browser.

## Key Shortcuts & Discovery

Open the central command palette (`Ctrl/Cmd+K`) from anywhere to search and run any application command with platform-aware keybindings.

| Shortcut | Scope | Action |
|---|---|---|
| `Ctrl/Cmd+K` | Global | Open command palette |
| `Ctrl/Cmd+N` | Notes board | Create a new note |
| `/` | Board shell | Focus search input |
| `Ctrl/Cmd+Enter` | Editor | Save / flush active note |
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` | Shell | Undo / Redo (including note deletion) |
| `j` / `k` | Board shell | Select next / previous note |
| `gg` / `G` | Board shell | Select first / last note |
| `1` / `2` / `3` / `4` | Review modal (revealed) | Rate card (Again / Hard / Good / Easy) |
| `Space` | Review modal | Flip / reveal flashcard |
| `Escape` | Modals / Dialogs | Close active dialog and return focus |

For the complete daily workflow guide, see the [Cheatsheet](docs/guides/cheatsheet.md).

## Repository Structure

- `app.js`: Browser bootstrap, runtime composition, and Notes workspace orchestration.
- `ui/japaneseApp.js`: Japanese study workspace bridge, board filters, and review adapters.
- `core/`: Canonical model, parser, search worker, storage, gamification, daily goals, and SRS schedulers.
- `ui/`: Command registry, palette, editor overlay, list/grid virtualization, settings panel, and theme switcher.
- `styles/`: Modular CSS stylesheets (base layout, editor, Japanese workspace, themes, onboarding).
- `scripts/`: Static file server (`serve-static.mjs`) and E2E test runner (`run-e2e.mjs`).
- `tests/`: Deterministic unit, integration, performance, content contract, and Playwright browser journey suites.
- `docs/`: Technical specifications, architectural invariants, and governance guidelines.

## Verification

Run the full repository release gate locally:

```sh
npm run test:content      # Repository text contracts
npm run lint              # ESLint syntax and style
npm run test:unit          # Domain, parser, and component unit tests
npm run test:perf          # Performance budgets and latency tripwires
npm run test:integration   # IndexedDB schema, storage, and migration suites
npm run test:e2e           # Playwright end-to-end browser journeys
```

## Documentation

For technical deep dives, architecture specifications, contracts, and operating guides, refer to the `docs/` directory:

- **System Architecture**: [Architecture Baseline](docs/architecture/ARCHITECTURE.md) · [Technical Invariants](docs/architecture/INVARIANTS.md) · [Security Model](docs/architecture/SECURITY_MODEL.md)
- **Japanese Learning**: [Study Workspace Contract](docs/japanese/JAPANESE_STUDY_WORKSPACE.md) · [Study Lifecycle](docs/japanese/JAPANESE_STUDY_LIFECYCLE.md) · [Study Dashboard](docs/japanese/JAPANESE_STUDY_DASHBOARD.md) · [Kanji Vector Engine](docs/architecture/KANJI_HANDWRITING.md)
- **Design & Theming**: [Theme Specification](docs/design/THEME_SPEC.md) · [Editor and List Interaction Contract](docs/design/EDITOR_LIST_CONTRACT.md)
- **Commands & Shortcuts**: [Command Registry](docs/commands/COMMAND_REGISTRY.md) · [Command Ownership](docs/commands/COMMAND_OWNERSHIP.md) · [Daily Cheatsheet & Shortcuts](docs/guides/cheatsheet.md)
- **Governance & Performance**: [Performance Budget](docs/performance/PERFORMANCE_BUDGET.md) · [Engineering Rules](docs/governance/ENGINEERING_RULES.md) · [Governance & Delivery](docs/governance/GOVERNANCE.md)
- **Security Policy**: [Security Guidelines](SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).

# myNote

A high-performance, local-first note-taking and Japanese study application built with vanilla web technologies, deterministic state management, and IndexedDB persistence.

## Overview

myNote is an offline-ready, single-page application designed for fast, distraction-free note management and integrated language study. It operates entirely inside the browser with zero cloud dependencies or external runtime libraries.

### Key Capabilities

- **Dual Workspaces**: Seamlessly switch between a full-featured **Notes** board and a dedicated **Japanese Learning** environment.
- **Japanese Study System**: SRS flashcard review with 3D flip card animations, gamified daily study streaks & XP, a Kanji vector drawing canvas with stroke guidance/history/PNG export, daily goal tracking, and time-boxed Quick Study sessions.
- **Extreme Performance**: Multi-column DOM virtualization for large datasets (10,000+ notes) in both List and Grid views, worker-based background text indexing, and on-demand lazy module loading.
- **Theming & Personalization**: Live CSS variable token engine with built-in themes (Light, Dark, Solarized, Nord, Cyberpunk), custom JSON theme import/export, and configurable typography.
- **Keyboard-First & Accessible**: Global command palette (`Ctrl/Cmd+K`), comprehensive keyboard navigation, WCAG AA contrast compliance, and accessible modal focus traps.
- **Resilient Data Layer**: IndexedDB persistence following strict persist-before-commit ordering, single-flight autosave, and lossless Markdown/JSON backup exports.

## Quickstart

### Prerequisites

- Node.js `>=22.13 <23`
- npm `11.7.0`

### Running Locally

```sh
npm ci
node scripts/static-server.mjs
```

Open `http://localhost:8080` in your browser.

## Verification

Run the comprehensive repository test and release gate:

```sh
npm run test:content      # Repository text contracts
npm run lint              # ESLint checks
npm run test:unit          # Core, parser, and domain unit tests
npm run test:perf          # Performance budgets and latency tripwires
npm run test:integration   # IndexedDB storage and migration lifecycle
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

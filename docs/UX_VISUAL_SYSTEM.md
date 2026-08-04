# myNote visual and focus system

Issue: [#67](https://github.com/Dyu20705/myNote/issues/67)

Implementation branch: `ux/67-visual-focus-system`

Base revision: `e9c914ead2527a3107838a9f9d1222bc754330eb`

Design source: Figma file `mzhDU5IwWbd3n3P7oRf88q`, specifically Foundations, Components, Notes route `50:5`, and Japanese route documentation.

## 1. Boundary

This contract defines a dark-first desktop visual layer for the existing vanilla HTML, CSS, and ES-module application. It changes rendering only, except for adding the explicit accessible name `Delete note` to the existing note-delete button.

The implementation adds no runtime dependency, downloaded font, icon package, framework, theme picker, persisted appearance state, schema change, migration, search behavior, note lifecycle, Japanese workflow, command ownership, responsive navigation, or user-data mutation.

Repository behavior remains authoritative where design copy is stale. Search continues to advertise `/`; `Ctrl/Cmd+K` remains the command-palette shortcut.

## 2. Token ownership

`styles.css` is the single semantic token owner. `japanese.css` consumes the same aliases and adds only Japanese-specific typography and surface composition. Temporary legacy aliases map existing selectors to the semantic layer while downstream packages complete component extraction.

### 2.1 Core colors

| Token | Value | Purpose |
| --- | --- | --- |
| `--mn-bg-canvas` | `#000000` | Application canvas |
| `--mn-surface-base` | `#0a0b0d` | Primary regions |
| `--mn-surface-raised` | `#111318` | Controls and nested surfaces |
| `--mn-surface-overlay` | `#171a20` | Dialogs and command surfaces |
| `--mn-surface-selected` | `#20242c` | Selected controls and rows |
| `--mn-text-primary` | `#f4f6f8` | Primary content |
| `--mn-text-secondary` | `#b8c0cc` | Secondary controls and status |
| `--mn-text-muted` | `#8b95a5` | Metadata and tertiary copy |
| `--mn-text-disabled` | `#6b7280` | Disabled and placeholder copy |
| `--mn-border-subtle` | `#20242c` | Region separation |
| `--mn-border-default` | `#313743` | Interactive controls |
| `--mn-border-strong` | `#4b5563` | Selected and overlay boundaries |
| `--mn-focus-ring` | `#38bdf8` | Keyboard focus |
| `--mn-action-primary-bg` | `#0ea5e9` | Primary action |
| `--mn-action-primary-hover` | `#0284c7` | Primary hover and pressed state |
| `--mn-danger-border` | `#f43f5e` | Invalid and destructive boundary |
| `--mn-danger-text` | `#fb7185` | Error and destructive label |
| `--mn-warning-text` | `#fbbf24` | Warning status |
| `--mn-success-text` | `#4ade80` | Bounded success status |
| `--mn-overlay-scrim` | `rgb(0 0 0 / 72%)` | Modal backdrop |

### 2.2 Dimensions

Spacing aliases are `4`, `8`, `12`, `16`, `20`, `24`, `32`, `40`, and `48` pixels. Radius aliases are `2`, `4`, `6`, `8`, and `12` pixels. Desktop control heights are `32`, `40`, and `48` pixels.

The supported desktop layout uses:

- minimum sidebar measure: `240px`;
- default sidebar measure: `288px`;
- readable editor measure: `760px`;
- shell maximum: `1440px`.

No wide-content editor mode is implemented in M2.

## 3. Typography

### 3.1 UI and prose

```css
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

This stack owns shell controls, headings, note-list content, metadata, and ordinary editor prose.

### 3.2 Japanese

```css
"Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", sans-serif
```

The stack applies to explicit Japanese language content and Japanese workspace, filter, review, title, and editor surfaces. Japanese reading surfaces use approximately `1.75` line height.

### 3.3 Technical content

```css
ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace
```

Monospace is restricted to `kbd`, `code`, `pre`, shortcuts, and technical hints. The application body is no longer globally monospace.

No web font is fetched. Exact glyph rendering depends on installed platform fonts; fallback behavior is intentional.

## 4. Focus contract

Every native `button`, `input`, `textarea`, and `select` receives:

```css
outline: 2px solid var(--mn-focus-ring);
outline-offset: 2px;
```

The Search composite additionally uses `:focus-within`, an accent border, and an outer shadow. Focus is never removed globally. Keyboard focus remains independent from hover and active states.

The automated contract validates focus geometry and color for workspace controls, Search, create, refresh, title, editor body, and save.

## 5. Control and state contract

The explicit reusable control classes are `.primary-button`, `.secondary-button`, `.quiet-button`, and `.destructive-button`. Existing `.shell-button` remains the current shell-level secondary adapter.

Reusable semantic messages use `.status-message[data-state="success"]`, `.status-message[data-state="warning"]`, or `.status-message[data-state="error"]`. These utilities are reserved for bounded outcomes that require emphasis; routine autosave confirmation deliberately remains restrained secondary copy.

State must not depend on color alone.

| State or hierarchy | Geometry or textual indicator |
| --- | --- |
| Selected workspace or note | Inset `3px` rail, stronger border, and increased font weight |
| Disabled | Dashed border, `not-allowed` cursor, and reduced opacity |
| Busy | `progress` cursor and visible trailing pseudo-element indicator |
| Invalid | Double danger border and an outer state shadow |
| Success | Semantic text plus inset `3px` rail and increased font weight |
| Warning | Semantic text plus inset `3px` rail and increased font weight |
| Error | Semantic text plus inset `3px` rail and increased font weight |
| Destructive | Explicit accessible label, danger border, danger text, and strong weight |
| Primary | Solid accent surface and strong text |
| Secondary | Raised surface and default border |
| Quiet | Transparent base and border; hover gains a bounded surface and subtle border |
| Hover/pressed | Surface and border hierarchy without required movement |
| Reduced motion | Animation and transition durations resolve to zero |

Normal saved state remains restrained secondary copy. Persistent bright success styling is not used for routine autosave confirmation.

## 6. Readability and content resilience

Title and content fields use `width: min(100%, 760px)` while the editor region retains the remaining shell space. The editor and list use `min-width: 0`, `overflow-wrap: anywhere`, and bounded horizontal overflow. Canonical content is not truncated.

Automated browser cases cover:

- long English prose;
- long Japanese prose;
- mixed-language titles and body content;
- long unbroken Markdown-like tokens;
- `1440×900`, `1280×720`, and `1024×768`;
- Notes and Japanese workspace transitions;
- reduced-motion preference.

The cases require no document-level horizontal overflow, editor width no greater than `760px`, at least `160px` of initially visible editor body, and preservation of the Ordinary workspace draft when returning from Japanese.

## 7. Implementation files

| File | Responsibility |
| --- | --- |
| `styles.css` | Semantic aliases, typography, surfaces, explicit action hierarchy, semantic status utilities, state geometry, focus, readable measure, reduced motion |
| `japanese.css` | Japanese typography, line height, Japanese controls and nested surfaces using shared aliases |
| `ui/list.js` | Existing delete control receives the explicit `Delete note` accessible name |
| `tests/e2e/control-variants.spec.mjs` | Primary, secondary, quiet, and destructive class contract |
| `tests/e2e/visual-system.spec.mjs` | Token, font, focus, non-color state including success/warning/error, long-content, viewport, and reduced-motion contract |
| `tests/e2e/editor-shell.spec.mjs` | Existing shell regression updated for accepted focus color and deterministic async create setup |

## 8. Verification record

### 8.1 Intentional RED

Workflow run 194 (`30873584429`) on test-only head `20bb573addbfbbfee367d19082d961603a23cfba` reached the browser gate after content, lint, unit, and integration checks passed. It reported `27` passing and `5` failing E2E cases. The failures were the expected missing token, focus, selected-state, and readable-measure behavior.

### 8.2 Baseline GREEN before external review

Workflow run 205 (`30874724909`) on head `3e5b4d5e6cbf691d79ccb697a942be3a459eaecf` and merge ref `78d1151f6a53e05405405474b2a1297f699abcfb1a2` completed successfully:

| Gate | Result |
| --- | ---: |
| Repository content | `3/3` |
| ESLint | clean |
| Unit | `157/157` |
| Integration | `44/44` |
| E2E | `33/33` |
| Playwright failure artifacts | skipped because no failure |

Environment: Ubuntu 24.04.4, Node.js 22.20.0, npm 11.7.0, Playwright Chromium 151.0.7922.34.

### 8.3 External-review hardening

External review found that success and warning existed only as tokens and that the handoff still described a pre-ready verification state. The review added a focused browser contract first, then implemented reusable `.status-message` success/warning/error geometry and updated this handoff.

The required GitHub Actions check attached to the current PR head is the authoritative merge gate. A historical run in this document must not be treated as proof for a later head.

## 9. Known limits and risks

- Dark-first only; light theme is not implemented.
- Automated evidence is Chromium on Ubuntu. Windows, macOS, Firefox, Safari, screen readers, forced-colors mode, and physical grayscale review remain unverified.
- The viewport matrix is a deterministic proxy for the accepted desktop widths. Full physical 200% zoom certification remains part of the later release gate.
- Platform font availability changes the resolved glyph font while preserving the documented fallback chain.
- `npm ci` currently reports one high-severity advisory in the existing dependency graph. This pull request changes no package manifest or lockfile; the advisory identity and remediation are outside #67 and require a separate dependency-quality investigation.
- GitHub Actions reports that pinned checkout and setup-node revisions target the deprecated Node 20 action runtime and are forced onto Node 24. This is repository-wide CI maintenance, not visual-system scope.

## 10. Rollback

Revert PR #80. The rollback removes the semantic CSS layer, focused browser contract, and delete-label addition. No schema, migration, canonical note, review scheduling, search index, history, persistence, or user-data rollback is required.
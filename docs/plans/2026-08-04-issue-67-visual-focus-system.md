# Issue #67 Visual and Focus System Implementation Plan

> Track every step with the checkboxes below. Each production change starts from a focused failing browser assertion and remains independently reviewable.

**Goal:** Build a small dark-first CSS visual system that gives myNote readable English/Japanese typography, bounded editor measure, clear action hierarchy, and keyboard-visible non-color-only states without changing application behavior.

**Architecture:** Keep the existing vanilla HTML/CSS/ES-module application and its single composition root. Translate accepted Figma semantic aliases into one CSS custom-property layer in `styles.css`; `japanese.css` consumes those tokens and owns Japanese-specific typography/layout only. JavaScript remains behavior-only, with minimal semantic classes or attributes added only when existing markup cannot express a visual variant.

**Tech Stack:** Vanilla HTML, CSS custom properties, ES modules, Node.js 22.20.0, npm 11.7.0, Playwright 1.62.0.

## Global Constraints

- Base exactly on `main` commit `e9c914ead2527a3107838a9f9d1222bc754330eb`.
- Implement only issue #67 on branch `ux/67-visual-focus-system`.
- Preserve `UI → Actions → State → Core → Persistence` and the single runtime/composition root.
- Add no runtime, font, icon, framework, component-library, or theme dependency.
- Preserve dark-first desktop support at `1024×768`, `1280×720`, and `1440×900`; smaller/mobile navigation remains unsupported.
- Figma file `mzhDU5IwWbd3n3P7oRf88q` supplies accepted visual aliases; repository behavior and copy remain authoritative.
- Search continues to advertise `/`; do not copy stale Figma `Ctrl K` search text.
- Do not implement #74 command ownership, #68 editor/list lifecycle, #70 Japanese disclosure, #71 responsive navigation, #72 recovery mapping, or #69 Kanji input.
- Use system sans-serif and Japanese-capable fallback stacks; keep monospace only for code, shortcuts, and technical identifiers.
- “Saved locally” remains restrained secondary status, not a persistent bright success signal.
- Every production CSS/markup change must follow a focused failing browser test.

---

## File Structure

- Create `tests/e2e/visual-system.spec.mjs`: computed-style, focus, state, typography, long-content, viewport, and reduced-motion contracts.
- Modify `styles.css`: semantic aliases, font stacks, surfaces, readable measure, control variants, focus/state contracts, reduced border competition.
- Modify `japanese.css`: Japanese font/line-height, token consumption, Japanese controls/states, reduced-motion-safe behavior.
- Modify `index.html` only when a semantic visual variant cannot be selected through existing IDs/classes/attributes.
- Modify `ui/list.js` only if the current delete control needs a semantic destructive class or selected-state attribute; do not change lifecycle behavior.
- Modify `docs/UX_QUALITY_BASELINE.md`: record #67 token/state/readability contract, evidence boundary, unsupported environments, and rollback.

## Task 1: Establish the RED visual-system browser contract

**Files:**
- Create: `tests/e2e/visual-system.spec.mjs`

**Interfaces:**
- Consumes: existing rendered shell IDs/classes and browser-computed CSS.
- Produces: executable acceptance contract for token aliases, font separation, focus, composite focus, selected/disabled/busy/invalid/destructive states, editor measure, long content, reduced motion, and desktop overflow.

- [x] **Step 1: Add token and typography assertions**

The test reads exact CSS aliases from `:root` and expects:

```js
expect(tokens).toEqual({
  canvas: "#000000",
  surfaceBase: "#0a0b0d",
  surfaceRaised: "#111318",
  surfaceSelected: "#20242c",
  textPrimary: "#f4f6f8",
  textSecondary: "#b8c0cc",
  borderDefault: "#313743",
  focus: "#38bdf8",
  primary: "#0ea5e9",
  readable: "760px",
  uiFont: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  japaneseFont: "\"Hiragino Kaku Gothic ProN\", \"Yu Gothic UI\", \"Yu Gothic\", Meiryo, \"Noto Sans JP\", sans-serif",
  monoFont: "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace",
});
```

It also proves the body is not monospace, `[lang="ja"]` resolves through the Japanese-capable stack, and `kbd` uses the monospace stack.

- [x] **Step 2: Add focus and state assertions**

The test requires:

- `button`, `input`, and `textarea` focus outlines to be solid, at least `2px`, accent-colored, and offset at least `2px`;
- `.search-box` to expose focus through both border and box-shadow;
- `[aria-pressed="true"]` to use an inset rail and stronger font weight;
- disabled controls to use `not-allowed`, reduced opacity, and a dashed border;
- `[aria-busy="true"]` to use a progress cursor and visible pseudo-element indicator;
- `[aria-invalid="true"]` to use danger color, double border, and a focus-like shadow;
- `.note-item-delete` to retain the `Delete note` accessible name and use destructive text/border/weight.

- [x] **Step 3: Add readable-measure and long-content assertions**

At `1440×900`, `1280×720`, and `1024×768`, fill the editor with long English, Japanese, mixed-language, and unbroken Markdown content, then assert:

```js
expect(geometry.titleWidth).toBeLessThanOrEqual(760);
expect(geometry.contentWidth).toBeLessThanOrEqual(760);
expect(geometry.contentVisibleHeight).toBeGreaterThanOrEqual(160);
expect(geometry.contentScrollWidth).toBeLessThanOrEqual(geometry.contentClientWidth);
expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
```

Switch Notes → 日本語 → Notes and verify the exact title/content remain present.

- [x] **Step 4: Add reduced-motion assertion**

Use Playwright `reducedMotion: "reduce"` and require representative controls to resolve with no animation and no transition duration.

- [x] **Step 5: Commit the test-only head**

Commit `bac68b27550218ccb11f6648d8667dd27bb09a56` added only the plan and browser contract.

- [ ] **Step 6: Verify an intentional RED workflow**

The first workflow attempt stopped at repository-content validation because the plan contained a prohibited provenance phrase. Correct this document, rerun the workflow, and accept RED only when content/lint/unit/integration pass and Playwright fails on missing #67 CSS behavior.

## Task 2: Introduce the bounded semantic token and typography layer

**Files:**
- Modify: `styles.css`
- Modify: `japanese.css`

**Interfaces:**
- Consumes: accepted Figma aliases and existing selectors.
- Produces: stable CSS custom properties used by both stylesheets; no JavaScript visual decisions.

- [ ] **Step 1: Define the minimal semantic aliases in `:root`**

Use exact accepted values:

```css
:root {
  color-scheme: dark;
  --mn-bg-canvas: #000000;
  --mn-surface-base: #0a0b0d;
  --mn-surface-raised: #111318;
  --mn-surface-overlay: #171a20;
  --mn-surface-selected: #20242c;
  --mn-surface-hover: #171a20;
  --mn-surface-disabled: #111318;
  --mn-text-primary: #f4f6f8;
  --mn-text-secondary: #b8c0cc;
  --mn-text-muted: #8b95a5;
  --mn-text-disabled: #6b7280;
  --mn-border-subtle: #20242c;
  --mn-border-default: #313743;
  --mn-border-strong: #4b5563;
  --mn-focus-ring: #38bdf8;
  --mn-action-primary-bg: #0ea5e9;
  --mn-action-primary-hover: #0284c7;
  --mn-action-primary-text: #000000;
  --mn-danger-border: #f43f5e;
  --mn-danger-text: #fb7185;
  --mn-warning-text: #fbbf24;
  --mn-success-text: #4ade80;
  --mn-overlay-scrim: rgb(0 0 0 / 72%);
  --mn-space-1: 4px;
  --mn-space-2: 8px;
  --mn-space-3: 12px;
  --mn-space-4: 16px;
  --mn-space-5: 20px;
  --mn-space-6: 24px;
  --mn-radius-xs: 2px;
  --mn-radius-sm: 4px;
  --mn-radius-md: 6px;
  --mn-radius-lg: 8px;
  --mn-control-sm: 32px;
  --mn-control-md: 40px;
  --mn-control-lg: 48px;
  --mn-sidebar-min: 240px;
  --mn-sidebar-default: 288px;
  --mn-content-readable: 760px;
  --mn-shell-max: 1440px;
  --mn-font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mn-font-japanese: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", sans-serif;
  --mn-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}
```

Retain temporary legacy aliases only where needed to keep the diff reviewable; all touched selectors consume `--mn-*` values directly.

- [ ] **Step 2: Apply intentional typography**

- `body`, controls, headings, note list, and prose use `--mn-font-ui`.
- `[lang="ja"]`, Japanese workspace surfaces, review title/content, and Japanese form controls use `--mn-font-japanese` before the UI fallback.
- `kbd`, `code`, `pre`, and technical hints use `--mn-font-mono`.
- Use explicit heading weights/sizes rather than `font: inherit` resets.

- [ ] **Step 3: Run the token/typography slice**

```bash
npx playwright test tests/e2e/visual-system.spec.mjs --grep "aliases|font"
```

Expected: token and font assertions pass; focus/state assertions may remain red.

- [ ] **Step 4: Commit the token layer**

```bash
git add styles.css japanese.css
git commit -m "style: add bounded visual tokens and typography"
```

## Task 3: Implement action hierarchy and non-color-only state contracts

**Files:**
- Modify: `styles.css`
- Modify: `japanese.css`
- Modify minimally: `index.html`
- Modify minimally: `ui/list.js`

**Interfaces:**
- Consumes: token layer from Task 2 and existing native attributes.
- Produces: primary, secondary, quiet, destructive, selected, disabled, busy, invalid, hover, pressed, and status styles.

- [ ] **Step 1: Normalize existing controls into variants**

- `.primary-button`: accent fill, dark text, one primary per local region.
- `.shell-button`/`.secondary-button`: raised surface and default border.
- `.quiet-button`: transparent base, hover surface.
- `.note-item-delete`/`.destructive-button`: explicit destructive border/text plus accessible label; no lifecycle change.

- [ ] **Step 2: Add state shape contracts**

- selected navigation and note items use an inset accent rail plus font-weight/border changes;
- disabled controls use opacity, cursor, and stable text contrast;
- busy controls use progress cursor and `::after` textual/shape indicator without mandatory animation;
- invalid fields use danger color plus `double` border;
- pressed controls use transform-free tonal/border changes.

- [ ] **Step 3: Restore global visible focus**

Remove the global `outline: none` rule. Apply one shared focus rule to native interactive controls and note/backlink/command controls:

```css
:where(button, input, textarea, select):focus-visible {
  outline: 2px solid var(--mn-focus-ring);
  outline-offset: 2px;
}
```

Search additionally uses `:focus-within` to expose a composite ring.

- [ ] **Step 4: Reduce border competition**

Keep borders for shell/region separation, controls, selected/invalid/destructive states, and overlays. Use surface contrast, spacing, and headings for nested dashboard/backlink/list grouping. Do not remove boundaries needed to understand regions.

- [ ] **Step 5: Run focused state tests**

```bash
npx playwright test tests/e2e/visual-system.spec.mjs --grep "focus|states"
```

Expected: all focused assertions pass.

- [ ] **Step 6: Commit the state hierarchy**

```bash
git add styles.css japanese.css index.html ui/list.js
git commit -m "style: implement accessible control and state hierarchy"
```

## Task 4: Enforce readable editor and long-content resilience

**Files:**
- Modify: `styles.css`
- Modify: `japanese.css`

**Interfaces:**
- Consumes: `--mn-content-readable` and font stacks.
- Produces: bounded editor measure, safe wrapping, Japanese line-height, and unchanged shell behavior.

- [ ] **Step 1: Bound editor fields without hiding application space**

Set title and content fields to `width: min(100%, var(--mn-content-readable))`, with the editor panel retaining flexible remaining space. Keep focus order and active draft unchanged.

- [ ] **Step 2: Add wrapping contracts**

Use `overflow-wrap: anywhere`, `word-break: break-word` where appropriate, and `min-width: 0`. Japanese reading surfaces use approximately `1.75` line-height. Do not truncate canonical editor content.

- [ ] **Step 3: Verify supported viewports**

Run all visual-system viewport cases and the existing editor-shell spec. Require no horizontal document overflow and at least the existing meaningful editor-body visibility.

- [ ] **Step 4: Update the existing focus-color assertion**

`tests/e2e/editor-shell.spec.mjs` currently expects the old `rgb(221, 221, 221)` border. Change the assertion to the accepted focus token `rgb(56, 189, 248)` after the new token exists.

- [ ] **Step 5: Commit the readable-measure package**

```bash
git add styles.css japanese.css tests/e2e/editor-shell.spec.mjs
git commit -m "style: bound editor measure and long content"
```

## Task 5: Document and verify the implemented contract

**Files:**
- Modify: `docs/UX_QUALITY_BASELINE.md`
- Modify: `docs/plans/2026-08-04-issue-67-visual-focus-system.md`

**Interfaces:**
- Consumes: final CSS/test behavior.
- Produces: exact implementation/evidence/rollback record for #67 and downstream owners.

- [ ] **Step 1: Add the #67 implementation contract**

Document exact base/head revisions and Figma nodes, token names/values, UI/Japanese/monospace stacks, focus geometry, composite focus, non-color state indicators, readable measure, dark-only boundary, unsupported browser/assistive-technology evidence, no persisted-data impact, and one-PR rollback.

- [ ] **Step 2: Run focused regression**

```bash
npx playwright test tests/e2e/visual-system.spec.mjs tests/e2e/editor-shell.spec.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run the complete repository gate**

```bash
npm ci
npx --no-install playwright install --with-deps chromium
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

Expected: every command exits `0`; no Playwright failure artifact is uploaded.

- [ ] **Step 4: Self-review the exact main diff**

Reject the branch if it introduces behavior ownership in CSS/JS, duplicate theme systems, external fonts, stale command copy, mobile navigation, content loss, hidden focus, color-only state, #68/#70 scope, or persistence/schema changes.

- [ ] **Step 5: Mark the PR ready only after fresh green evidence**

Record exact head SHA, workflow run/job, test counts, changed files, remaining manual/forced-colors/Windows unknowns, and rollback. Do not merge #67 until review finds no blocker.

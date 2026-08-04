# Issue #67 Visual and Focus System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

### Task 1: Establish the RED visual-system browser contract

**Files:**
- Create: `tests/e2e/visual-system.spec.mjs`

**Interfaces:**
- Consumes: existing rendered shell IDs/classes and browser-computed CSS.
- Produces: executable acceptance contract for token aliases, font separation, focus, composite focus, selected/disabled/busy/invalid/destructive states, editor measure, long content, reduced motion, and desktop overflow.

- [ ] **Step 1: Add token and typography assertions**

Assert after `page.goto("/")` that:

```js
const tokens = await page.locator(":root").evaluate((element) => {
  const style = getComputedStyle(element);
  return {
    canvas: style.getPropertyValue("--mn-bg-canvas").trim(),
    surfaceBase: style.getPropertyValue("--mn-surface-base").trim(),
    surfaceRaised: style.getPropertyValue("--mn-surface-raised").trim(),
    focus: style.getPropertyValue("--mn-focus-ring").trim(),
    readable: style.getPropertyValue("--mn-content-readable").trim(),
  };
});
expect(tokens).toEqual({
  canvas: "#000000",
  surfaceBase: "#0a0b0d",
  surfaceRaised: "#111318",
  focus: "#38bdf8",
  readable: "760px",
});
```

Also assert the body font is not monospace, `[lang="ja"]` resolves through a documented Japanese-capable stack, and `kbd` resolves through the monospace token.

- [ ] **Step 2: Add focus and state assertions**

Assert:

- `button`, `input`, `textarea`, and `select` receive a solid focus outline at least `2px` wide;
- `.search-box` exposes focus via `box-shadow` or outline when `#searchInput` is focused;
- `[aria-pressed="true"]` has a non-color indicator such as an inset rail plus stronger font weight;
- disabled controls use `cursor: not-allowed` and reduced opacity;
- `[aria-busy="true"]` exposes a visible pseudo-element indicator and progress cursor without animation dependency;
- `[aria-invalid="true"]` uses a non-color shape/border-style distinction;
- `.note-item-delete` exposes destructive text/border semantics and a native accessible name.

- [ ] **Step 3: Add readable-measure and long-content assertions**

Fill the title/editor with long English, Japanese, mixed-language, and unbroken Markdown text. At each supported viewport assert:

```js
expect(editor.width).toBeLessThanOrEqual(760);
expect(documentWidth).toBeLessThanOrEqual(viewportWidth);
expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
```

The test must preserve active note, query, and draft while switching Notes/日本語.

- [ ] **Step 4: Add reduced-motion assertion**

Run a context with `reducedMotion: "reduce"` and assert transitions/animations on representative interactive controls resolve to `0s` or `none`.

- [ ] **Step 5: Commit test-only RED state**

```bash
git add tests/e2e/visual-system.spec.mjs
git commit -m "test: define issue 67 visual system contract"
```

- [ ] **Step 6: Open a draft PR and verify RED**

Run the PR workflow against the test-only head. Expected failure must be caused by missing `--mn-*` aliases and/or absent focus/state contracts, not syntax, fixture, or infrastructure errors. Record run ID and exact failing assertions in the PR and issue.

### Task 2: Introduce the bounded semantic token and typography layer

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

- [ ] **Step 3: Run the focused test**

```bash
npx playwright test tests/e2e/visual-system.spec.mjs --grep "tokens|typography"
```

Expected: token and font assertions pass; focus/state assertions may remain red.

- [ ] **Step 4: Commit**

```bash
git add styles.css japanese.css
git commit -m "style: add bounded visual tokens and typography"
```

### Task 3: Implement action hierarchy and non-color-only state contracts

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
- invalid fields use danger color plus `double` border or another non-color geometry change;
- pressed controls use transform-free tonal/border change to avoid motion dependence.

- [ ] **Step 3: Reduce border competition**

Keep borders only for shell/region separation, controls, selected/invalid/destructive states, and overlays. Use surface contrast, spacing, and headings for nested dashboard/backlink/list grouping. Do not remove boundaries needed to understand regions.

- [ ] **Step 4: Run focused state tests**

```bash
npx playwright test tests/e2e/visual-system.spec.mjs --grep "focus|state|action"
```

Expected: all focused assertions pass.

- [ ] **Step 5: Commit**

```bash
git add styles.css japanese.css index.html ui/list.js
git commit -m "style: implement accessible control and state hierarchy"
```

### Task 4: Enforce readable editor and long-content resilience

**Files:**
- Modify: `styles.css`
- Modify: `japanese.css`

**Interfaces:**
- Consumes: `--mn-content-readable` and font stacks.
- Produces: centered/bounded editor measure, safe wrapping, Japanese line-height, and unchanged shell behavior.

- [ ] **Step 1: Bound editor fields without hiding wide application space**

Set title and content fields to `width: min(100%, var(--mn-content-readable))`, with the editor panel retaining flexible remaining space. Keep focus order and active draft unchanged.

- [ ] **Step 2: Add wrapping contracts**

Use `overflow-wrap: anywhere`, `word-break: break-word` where appropriate, `min-width: 0`, and Japanese `line-height` around `1.75`. Do not truncate canonical editor content.

- [ ] **Step 3: Verify supported viewports and 200% zoom proxy**

Run all visual-system viewport cases and the existing editor-shell spec. Assert no horizontal document overflow and at least the existing meaningful editor body visibility.

- [ ] **Step 4: Commit**

```bash
git add styles.css japanese.css
git commit -m "style: bound editor measure and long content"
```

### Task 5: Document the implemented visual contract and run the complete gate

**Files:**
- Modify: `docs/UX_QUALITY_BASELINE.md`
- Modify: `docs/plans/2026-08-04-issue-67-visual-focus-system.md`

**Interfaces:**
- Consumes: final CSS/test behavior.
- Produces: exact implementation/evidence/rollback record for #67 and downstream owners.

- [ ] **Step 1: Add the #67 implementation contract**

Document:

- exact base/head revisions and Figma nodes;
- token names/values and temporary compatibility aliases;
- UI, Japanese, and monospace stacks;
- focus geometry and composite focus behavior;
- non-color selected/disabled/busy/invalid/destructive indicators;
- readable measure and wrapping;
- dark-only and unsupported browser/assistive-technology boundaries;
- no persistence/schema/runtime dependency change;
- one-PR rollback.

- [ ] **Step 2: Run focused regression**

```bash
npx playwright test tests/e2e/visual-system.spec.mjs tests/e2e/editor-shell.spec.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run the full repository gate**

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

Record exact head SHA, workflow run/job, test counts, changed files, remaining manual/forced-colors/Windows unknowns, and rollback. Do not merge #67 until external review finds no blocker.

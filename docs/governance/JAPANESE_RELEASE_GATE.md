# Japanese Workspace Release Gate

This document records the compatibility boundary verified before the Japanese workspace is considered complete.

## Browser acceptance matrix

The release gate covers:

- a fresh database;
- a populated schema-v1 database upgraded to schema v2;
- valid orphan review metadata;
- invalid persisted review metadata;
- all five Japanese templates and output/planner duplicate guards;
- dashboard metrics, complete rating controls, close/resume, narrow layout, reduced motion, and keyboard-only interaction;
- Markdown and JSON export;
- ordinary Notes regression flows.

## Existing-data guarantees

The schema-v2 upgrade is additive. It creates the isolated `studyReviews` store without scanning or rewriting existing note records. Existing notes remain unchanged and are never enrolled automatically, including notes that already contain Japanese text or reserved-looking tags.

Orphan review metadata remains durable and is reported through bounded repair diagnostics. Invalid review metadata keeps ordinary Notes usable while Japanese mutation and review controls remain unavailable behind a bounded status.

## Export boundary

Markdown and JSON exports contain canonical note data, including Japanese titles and content. Review scheduling fields remain in `studyReviews`; they are not embedded into exported note objects or Markdown output.

## Keyboard and focus boundary

An active review closes back to the enabled Resume review button. After the final rating, Start review is disabled because no due item remains, so closing the completed dialog moves focus to the enabled 日本語 workspace button.

## Recovery and older deployments

Schema v2 is forward-only. A recovery or older deployment must continue to understand schema v2 and preserve both stores. It must not attempt an automatic schema downgrade or rewrite existing notes.

## Verification

Run the complete repository gate:

```sh
npm ci
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

The pull request must record the exact CI environment and any platform or browser matrix that remains unverified.

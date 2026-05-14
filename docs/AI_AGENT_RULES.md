# AI Agent Rules

Repository nay ap dung guardrail architecture-first. Moi thay doi co AI ho tro phai tuan thu cac quy tac sau.

## Quy tac bat buoc (Non-Negotiable Rules)

1. Never bypass parser pipeline for note metadata (tags, links, ast, checksum, search blob).
2. Never invert dependency direction. Allowed flow is UI -> Actions -> State -> Core -> Persistence.
3. Never write directly to storage from UI modules.
4. Never introduce dynamic code execution (`eval`, `new Function`, `document.write`).
5. Never remove or weaken invariant tests without replacement.

## Ky luat thay doi (Change Discipline)

1. Prefer small, reviewable patches.
2. Preserve public behavior unless requirement explicitly changes it.
3. Add or update tests when touching parser, patch logic, or index consistency.
4. Update docs in `docs/` when architecture constraints evolve.

## Yeu cau an toan (Safety Requirements)

1. Keep worker message contracts validated and size-bounded.
2. Keep persistence writes in action/core boundary.
3. Ensure bootstrap failure has a user-visible recovery path.

## Yeu cau hieu nang (Performance Requirements)

1. Prefer incremental indexing and backlinks updates.
2. Avoid full-list re-render if virtualization exists.
3. Track and expose latency metrics for critical paths.

## Checklist review

- Does this change respect dependency flow?
- Is parser still canonical metadata source?
- Are undo/redo semantics preserved?
- Are docs and tests aligned with implementation?

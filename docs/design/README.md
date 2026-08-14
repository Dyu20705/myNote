# Issue Design Authority

Implementation design for `myNote` is docs-first.

The delivery model is defined in `docs/engineering/AI_DELIVERY_MODEL.md`.

## Directory contract

```text
docs/design/
├── README.md
├── ISSUE_DESIGN_TEMPLATE.md
└── issues/
    └── <issue-number>-<bounded-name>.md
```

A file under `docs/design/issues/` becomes authoritative only when the corresponding GitHub issue explicitly references it as its implementation design.

## Just-in-time rule

Do not write detailed implementation specifications for the entire future backlog. Write the complete design only for the next dependency-safe work package.

This keeps specifications aligned with current `dev`, merged evidence, and current architecture rather than a speculative future tree.

## Required lifecycle

```text
current repository evidence
→ design
→ design self-review
→ issue status/relationship reconciliation
→ implementation assignment
→ PR review
→ integration
→ next design
```

## Authority boundary

The design document owns exact behavior, architecture, boundaries, tests, and acceptance criteria.

The GitHub issue owns:

- tracking identity;
- parent/dependency/blocking relationships;
- execution status;
- authoritative design link;
- implementation PR link;
- review disposition;
- completion evidence.

Figma is used only when the accepted design explicitly references presentation/interaction nodes. Figma never owns canonical persistence, parser, search, scheduler, command dispatch, review state, or drawing persistence.

## Required quality

An implementation-ready design contains no material placeholders and no silent assumptions. Any unresolved material item remains explicit and blocks `status/ready`.

Designs preserve `docs/ARCHITECTURE.md` and `docs/INVARIANTS.md` unless an explicit architecture decision is part of the approved scope.
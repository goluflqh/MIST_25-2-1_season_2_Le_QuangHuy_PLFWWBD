# Domain Docs

This is a single-context repository.

## Consumer rules

Before exploring or changing domain behavior:

1. Read root `CONTEXT.md` when it exists.
2. Read relevant ADRs under `docs/adr/` when that directory exists.
3. Use the terminology established by those documents.
4. Surface conflicts with an existing ADR instead of silently overriding it.

If `CONTEXT.md` or `docs/adr/` does not exist, proceed without treating its
absence as an error.

Do not create empty domain documentation or speculative ADRs merely to satisfy
a directory convention. Use `domain-modeling` or `grill-with-docs` to create
or update these documents only when real terminology, invariants, boundaries,
or architectural decisions have been established.

## Layout

```text
/
├── CONTEXT.md
└── docs/
    └── adr/
        └── NNNN-short-decision-title.md
```

`CONTEXT.md` records the shared domain vocabulary, important concepts,
invariants, and explicitly avoided synonyms.

`docs/adr/` records confirmed architectural decisions that should remain
visible across future sessions, branches, and worktrees.

## Vocabulary

When an issue, specification, test, refactor proposal, or implementation names
a domain concept, use the vocabulary from `CONTEXT.md`.

If a required concept is missing, first determine whether existing project
language already covers it. If it represents a real domain gap, record it
through the domain-modeling workflow rather than inventing competing terms.

## ADR conflicts

If proposed work contradicts an existing ADR, identify the ADR and explain the
conflict before implementation. Do not silently replace the recorded decision.

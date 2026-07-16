<!-- gitnexus:start -->
# GitNexus - Code Intelligence

This repository may have a separate GitNexus index for each active branch or
worktree. Do not assume or hard-code an index name.

Before relying on GitNexus graph data, confirm that an indexed repository
matches both the current worktree path and current `HEAD`, using `list_repos`
or `gitnexus status`. If the matching index is missing or stale, refresh it
with `npx gitnexus analyze . --skip-agents-md` and verify freshness again.

If a current index cannot be produced, state that GitNexus is unavailable or
stale, do not treat its graph as current truth, and use direct source reads,
local search, tests, and runtime evidence instead.

## Always Do

- Run impact analysis before editing a function, class, method, or API route
  when the blast radius is not obvious.
- Run `detect_changes` before commit or PR preparation.
- Warn the user before continuing if impact analysis reports HIGH or CRITICAL
  risk.
- Use local search and direct file reads for exact source truth; use GitNexus
  for relationship and impact context.

## Never Do

- Do not ignore HIGH or CRITICAL GitNexus risk warnings.
- Do not commit without checking affected scope.

<!-- gitnexus:end -->

## Agent skills

Use the canonical Matt Pocock workflow routing in `AGENTS.md`. Small, clear
tasks stay direct. Respect each skill's invocation metadata: model-invoked
skills may trigger only when their concrete seam exists, while user-invoked
skills require explicit intent. Use `ask-matt` only when the user explicitly
requests the appropriate Matt workflow. Do not auto-chain planning,
specification, tickets, implementation, handoff, and review. The authorization
gates in `AGENTS.md` remain mandatory.

### Issue tracker

GitHub Issues is the primary tracker for work shared across branches and worktrees. Reading is allowed when relevant; creating or changing GitHub issues requires explicit authorization for the current task. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the canonical labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository: domain vocabulary belongs in root `CONTEXT.md`, and confirmed architectural decisions belong in `docs/adr/`. Create these documents only when real domain knowledge or decisions exist. See `docs/agents/domain.md`.

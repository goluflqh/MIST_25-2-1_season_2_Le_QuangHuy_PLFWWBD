---
trigger: always_on
---

# Workspace rules for Gemini and Antigravity

Use root `AGENTS.md` as the canonical project policy and `CLAUDE.md` only for
Claude-specific integration notes. Repository evidence and the user's current
request take precedence over historical templates.

## Skills and routing

- Use the shared, globally installed skills as the primary skill source.
- Respect invocation metadata: user-invoked skills require explicit user
  intent; model-invoked skills may trigger only when their concrete seam exists.
- Handle ordinary questions and small edits directly. Do not require a
  specialist persona, mandatory announcement, Socratic interview, planning
  document, or multi-agent orchestration for every request.
- Use at most one primary workflow by default. Do not automatically chain
  brainstorming, specification, tickets, implementation, and review.
- Treat `.agent/skills/`, `.agent/agents/`, and `.agent/workflows/` as legacy
  Antigravity Kit references. Load one only when the user explicitly requests
  that legacy workflow or when no current shared skill covers the task.

## MCP and memory

- MCP registrations are managed by the shared pinned runtime. Do not install,
  duplicate, or update project-local MCP servers unless the user explicitly
  requests it.
- Resolve the stable project id from root `.mem0-project` and use the Mem0 rules
  in `AGENTS.md` for resume, recall, decisions, and checkpoints.

## Authorization

Skills and local rules never grant permission to stage, commit, push, create or
modify GitHub issues, publish, deploy, run production migrations, or write to
external production data without explicit authorization in the current thread.

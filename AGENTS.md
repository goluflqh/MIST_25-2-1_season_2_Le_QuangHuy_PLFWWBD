# Project Memory

This workspace uses the shared MCP server `mem0-local` for project memory.

Project id: `minhhong-next`

Default memory rules:

- Before answering when prior project context may matter, call `search_memory` for shared memory with `project_id="minhhong-next"`.
- When the user asks what happened in the last session, asks to continue, or switches back to this repo after a break, prefer `resume_project(project_id="minhhong-next")`.
- Use `search_global_memory` when personal workflow, response style, or cross-repo coding preferences may matter.
- If shared project memory is missing or clearly incomplete, inspect the repo and call `bootstrap_project_memory` once with confirmed facts.
- Save durable confirmed project facts with `remember_fact`. Set `memory_kind` when obvious, such as `stack`, `architecture`, `command`, `entrypoint`, `data_rule`, `decision`, or `bug_fix`.
- Save important debugging outcomes with `remember_turn`, preferably with `memory_kind="bug_fix"` or `memory_kind="decision"` when appropriate.
- Save reusable cross-repo preferences and playbooks with `remember_global_fact`, usually with `memory_kind="preference"`, `workflow`, or `playbook`.
- At the end of a working session, save a short checkpoint with `remember_checkpoint`.
- Use shared memory for project-wide facts. Only use agent-scoped memory for private scratch notes.
- Never invent project facts. If unsure, inspect the repo first and only then save confirmed facts.
- Never save casual chitchat, vague brainstorming, or unrelated one-off questions.
- Only write memory when one of these is true:
  1. The user explicitly asks to remember or save something.
  2. A durable architecture decision, stack fact, data rule, or bug fix was confirmed.
  3. The session is ending and a compact checkpoint should be stored.

Compact session behavior:

- If the user says "continue", "what did we get to yesterday?", or asks to resume work, call `resume_project` first.
- Keep global memory small and stable. Use it for the user's durable habits across repos, not repo-specific facts.
- Keep recalled memory short and relevant. Do not dump everything into the reply.

## Karpathy-Style Execution Defaults

Adapted for this repo from `forrestchang/andrej-karpathy-skills`. Apply these defaults automatically in this workspace. Do not silently skip them. Only relax them when the user explicitly asks for a rough pass, brainstorming, or speed over rigor.

- Think before coding. If the request is ambiguous, has product tradeoffs, or could affect data flow/UI direction, state the assumption and ask only when the risk is real. Do not silently choose a risky interpretation.
- Simplicity first. Prefer the smallest change that solves the request. Reuse existing Next.js, Prisma, and project patterns. Do not add speculative abstractions, configuration, or extra features.
- Surgical changes only. Touch only the files and lines directly tied to the task. Do not rewrite adjacent UI, comments, formatting, or unrelated dead code unless the task requires it.
- Goal-driven execution. For non-trivial tasks, define brief success criteria and verify with the most relevant checks such as `lint`, `build`, targeted tests, preview validation, or direct repro/inspection before claiming done.
- If verification cannot run, say so explicitly and explain what is still unverified.
- If unrelated cleanup opportunities are noticed, mention them separately instead of folding them into the same change.


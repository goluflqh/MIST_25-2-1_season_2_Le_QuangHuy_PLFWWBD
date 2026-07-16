# Mem0 workflow audit

> Historical note (2026-07-16): this audit describes the pre-v3 local Mem0
> workflow. Its main recommendations were subsequently implemented: a
> canonical `project_state`, keyed decision lifecycle metadata, deterministic
> resume ordering, and compact checkpoint updates. Keep this document as the
> design rationale, not as the current runtime contract.

## Verdict

The `mem0-local` workflow uses Mem0's core capabilities appropriately for
scoped, durable recall, but it does **not** make current project state
authoritative. The observed resurfacing of an old “Unimplemented UI/product
scope” decision is therefore an expected retrieval-design failure, not proof
that upstream Mem0 maintains temporal supersession incorrectly.

Upstream Mem0 does offer semantic memory management when `add(..., infer=True)`
is used: the OSS API documents that it may add, update, or delete related
memories. That is LLM-driven memory extraction, not an ordered, deterministic
“newer state replaces older state” rule. The local `remember_fact` and
`remember_checkpoint` deliberately use `infer=False`, so they append raw
memories and cannot receive even that semantic consolidation.

## Upstream behaviour (official sources)

| Capability | What Mem0 provides | Audit implication |
| --- | --- | --- |
| Add | `Memory.add` accepts text/messages, entity IDs and metadata. With `infer=True` (the default), it uses an LLM to decide whether to add, update, or delete related memories; `infer=False` stores raw memories. [OSS source](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py#L723-L766) | Raw checkpoints are intentionally append-only. Do not expect them to supersede each other. |
| Search and filters | OSS search is similarity retrieval with `top_k`, threshold and optional reranking. It requires an entity filter (`user_id`, `agent_id`, or `run_id`) and supports metadata operators such as equality, ranges and boolean composition. [OSS source](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py#L1337-L1419) | Entity scoping is necessary but does not establish recency or state precedence. Metadata must participate in retrieval if state type matters. |
| Explicit update/delete | The Platform client exposes update by memory ID and delete by memory ID. Its `delete_linked` option is explicit; it is not the default. [client source](https://github.com/mem0ai/mem0/blob/main/mem0/client/main.py#L341-L408) | Supersession must be an application policy: update the canonical record or explicitly retire/delete the old one. |
| History | History is an explicit per-memory-ID endpoint. [client source](https://github.com/mem0ai/mem0/blob/main/mem0/client/main.py#L442-L463) | History can support an audit trail after updating a canonical state record; it is not selected automatically during ordinary search. |
| Temporal retrieval | OSS rejects `timestamp` on add and `reference_date` on search as Platform-only parameters. [OSS source](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py#L775-L779) [OSS source](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py#L1379-L1392) | The local OSS-backed workflow has no upstream temporal query primitive to resolve stale versus current state automatically. |

The official README also demonstrates retrieval constrained by an explicit
`user_id` filter, consistent with the local separation of project scopes.
[README example](https://github.com/mem0ai/mem0/blob/main/README.md#L205-L214)

## Assessment of the local workflow

### Correct and useful

- `project_id` plus shared/agent scope is a sound namespace design. The server
  maps a project scope to a stable `agent_id` and passes entity filters to
  Mem0 on search (`mem0-local-mcp-v3/server.py`, lines 513–535 and 672–694).
- Durable facts, inferred conversational turns, and end-of-session checkpoints
  are intentionally distinguished with `memory_kind` metadata.
- `resume_project` already places reverse-chronological session checkpoints in
  a separate `recent_checkpoints` section before other recalled facts (lines
  984–1036). `recent_activity` sorts by `created_at` descending (lines
  563–570 and 1162–1179).
- Requiring confirmation for scope-wide deletion is a sensible safety guard.

### Flawed or incomplete for current state

- `remember_checkpoint` always adds a new raw memory with `infer=False`; it
  records only `checkpoint_date` (day granularity), with no state key,
  revision, status, or pointer to what it replaces (lines 872–920).
- A queried `resume_project` calls semantic `search_memory` for shared hits
  (lines 1018–1026). Those hits are ranked by relevance, not recency, and may
  contain an old decision that contradicts the newest checkpoint.
- The server filters `memory_kind` **after** Mem0 returns its bounded semantic
  result set (lines 523–535). This can discard returned items without asking
  Mem0 for more matches of the requested kind.
- The MCP surface exposes only scope-wide `delete_all`; it does not expose an
  individual update, delete, or history operation. A caller therefore cannot
  reliably retire one superseded decision or maintain a single current-state
  record.
- Treating a completion checkpoint as evidence that every older decision is
  obsolete is also unsafe. Durable decisions and transient work state have
  different lifecycles and need different retrieval rules.

## Recommended design

Keep the existing scope and `memory_kind` scheme, but split state from facts.

1. Keep append-only `session_checkpoint` records as a compact timeline. On
   resume, retrieve the newest checkpoint(s) by timestamp and label them as
   historical context, never as an authoritative decision store.
2. Add exactly one shared canonical `project_state` record per project, with
   metadata such as `record_type=project_state`, `state_key=current`,
   `revision`, `as_of` (UTC timestamp), `status`, and optionally
   `supersedes_id`. Store active branch, current goal, next action and blockers
   there. Update that record by ID on every checkpoint-worthy transition; keep
   its Mem0 history for audit. If only OSS is available, expose equivalent
   targeted update/get/delete operations in the MCP wrapper.
3. Represent reversible decisions as separately keyed records, e.g.
   `record_type=decision`, `decision_key=ui-product-scope`, `status=active|
   superseded`, `superseded_by`, and `decided_at`. Update or explicitly retire
   the old record when the decision changes. Do not rely on `infer=True` for
   this invariant.
4. Make `resume_project` deterministic: return canonical `project_state`
   first, then the newest one or two checkpoints, then durable facts filtered
   to active records. Put semantic task-specific hits in a clearly subordinate
   section, annotated with timestamps and state status.
5. Push `memory_kind`, `record_type`, `status`, and state-key filtering into
   the underlying Mem0 filter when supported, rather than filtering only after
   a small semantic result set. For a local adapter that cannot express those
   filters, fetch enough scoped candidates, filter/sort deterministically, and
   bound the final response.
6. Preserve the current rule that app code/repository state wins over memory.
   On a conflict, report the stale memory and inspect the repository rather
   than silently treating semantic recall as current truth.

## Practical resume contract

`resume_project` should promise only: “Here is the canonical state as of
`as_of`; here are recent checkpoints; here are possibly relevant durable
facts.” An agent should treat a semantic hit such as “Unimplemented UI/product
scope” as a historical decision unless it is the active canonical decision or
is corroborated by newer repository evidence.

## Sources

- [mem0ai/mem0 OSS `Memory.add` and search source](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py#L723-L766)
- [mem0ai/mem0 OSS search filters and temporal limitations](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py#L1337-L1419)
- [mem0ai/mem0 Platform client: add, search, update, delete and history](https://github.com/mem0ai/mem0/blob/main/mem0/client/main.py#L178-L216)
- [mem0ai/mem0 official README retrieval example](https://github.com/mem0ai/mem0/blob/main/README.md#L205-L214)

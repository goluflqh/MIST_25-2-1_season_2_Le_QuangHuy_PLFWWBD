# Issue Tracker: GitHub

GitHub Issues is the primary issue tracker for this repository. It is shared
across branches and worktrees.

Infer the repository from `git remote -v`. When run inside this clone, the
`gh` CLI normally selects the correct repository automatically.

## Authorization boundary

Reading issues is allowed when it is relevant to the current task.

Do not create, edit, label, assign, comment on, or close a GitHub issue unless
the user has explicitly authorized that operation for the current task.
Authorization for one issue or operation does not imply authorization for
other GitHub writes.

Skills may prepare proposed issue titles, bodies, labels, dependencies, or
comments for review without publishing them.

## Read operations

- Read an issue and its comments:

  `gh issue view <number> --comments`

- List relevant issues:

  `gh issue list --state open --json number,title,body,labels,comments`

Use appropriate `--label`, `--state`, and `--search` filters to keep retrieval
task-scoped.

## Write operations

Only after explicit authorization, use the corresponding `gh` command:

- Create: `gh issue create`
- Edit or label: `gh issue edit`
- Comment: `gh issue comment`
- Close: `gh issue close`

Prefer `--body-file` for long issue bodies or comments so the final content can
be reviewed before it is published.

## Skill contract

When a skill says “publish to the issue tracker”, it means creating or updating
a GitHub issue, and therefore requires explicit current-task authorization.

When a skill says “fetch the relevant ticket”, read the GitHub issue and its
comments without modifying it.

`to-spec`, `to-tickets`, `triage`, and `wayfinder` must respect the
authorization boundary above.

## Pull requests as a triage surface

PRs as a request surface: no.

Pull requests are not automatically treated as incoming feature requests by
the triage workflow.

## Wayfinding

Use GitHub-backed wayfinding only when the user explicitly chooses that
workflow and authorizes publication:

- The map is one GitHub issue.
- Work items are child issues or, when sub-issues are unavailable, task-list
  entries linking to separate issues.
- Prefer native GitHub issue dependencies for blocking relationships.
- Fall back to a visible `Blocked by: #<number>` line only when native
  dependencies are unavailable.

Creating the map, tickets, labels, assignments, dependency links, comments, or
closures remains subject to the authorization boundary.

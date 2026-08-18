# MyTracer Agent Instructions

> Status: approved repository working agreement for MyTracer v0.1  
> Primary developer: Codex or another explicitly authorized coding agent  
> Product authority and final acceptance: project owner

## 1. Purpose

This file is the durable repository entry point for agents. It defines how work is scoped, executed, verified, reviewed, and published. It does not replace the product baseline, architecture documents, active task, or test evidence.

## 2. Read before work

For every task, read the smallest relevant set in this order:

1. `docs/PRODUCT_REQUIREMENTS_V0.1.md` for frozen product semantics and acceptance criteria.
2. `docs/DECISIONS.md` for frozen product decisions.
3. `docs/REQUIREMENTS_CHANGE_POLICY.md` for change authority and conflict handling.
4. Relevant documents under `docs/architecture/`.
5. `docs/implementation/GITHUB_WORKFLOW_V0.1.md` when Git or GitHub is in scope.
6. The active task contract created from `docs/implementation/TASK_TEMPLATE.md`.

For product semantics, the earlier item has higher authority. An active task may narrow scope but may not change frozen semantics. If instructions conflict, stop the affected work and report the conflict instead of choosing silently.

Files under `user/` are explanatory documents written for the project owner or product user. They are not requirements, architecture, task, test, or Agent instruction sources and must not be used as a development dependency. If a `user/` document differs from the normative files above, follow the normative files and report the user-document drift.

## 3. Current approved engineering baseline

- Product: local Windows Electron desktop application.
- UI: React + TypeScript + Vite.
- Storage: SQLite through `better-sqlite3` in Electron Main; no ORM.
- Renderer: UI only; no Node, SQL, filesystem, credential, or provider access.
- Preload: narrow typed APIs only; never expose `ipcRenderer` or arbitrary channels.
- Main: Application, Domain, SQLite, export, configuration, and AI adapters.
- Domain: independent of Electron, React, SQLite, and concrete AI SDKs.
- AI: user-triggered, minimal-context, replaceable, degradable, and unable to write data without confirmation.

Exact dependency versions, package tooling, test frameworks, and the first AI Provider remain approval-gated until recorded as approved.

## 4. Scope and autonomy

Classify the request before acting:

- **Answer, explain, review, diagnose, or plan:** inspect and report; do not implement unless the request also authorizes changes.
- **Change, build, implement, or fix:** make only the requested in-scope local changes and run relevant non-destructive validation.
- **Monitor or wait:** observe only the authorized target; unchanged state is not a failure.

Always require project-owner approval before:

- changing the frozen requirements, product decisions, or acceptance semantics;
- implementing a deferred feature;
- adding or upgrading a dependency;
- performing a destructive or irreversible data migration;
- expanding AI context, persistence, provider permissions, or write authority;
- performing an external write not already authorized by the active task;
- merging a pull request, advancing `main`, creating a tag, or publishing a release.

Do not use implementation convenience or general best practice to change frozen semantics.

## 5. Task contract

Every implementation task must identify:

- stable task ID;
- outcome;
- FR/AC/D/ED basis;
- allowed files or modules;
- explicit exclusions;
- invariants that must remain true;
- deliverables;
- exact completion conditions;
- exact validation commands once those commands exist;
- dependency, Git, GitHub, and external-write authorization.

Use `docs/implementation/TASK_TEMPLATE.md`. Do not treat an open question, recommendation, or plan as implementation authorization.

## 6. Standard work loop

1. Confirm the task and authority boundary.
2. Inspect relevant current files, tests, and uncommitted user changes.
3. State only assumptions that materially affect implementation.
4. Implement the smallest complete vertical slice.
5. Add or update tests at the appropriate layers.
6. Run targeted validation, then the required affected-scope regression.
7. Inspect the complete diff for accidental or unrelated changes.
8. Perform an independent review against the task and repository review rules.
9. Update task status and acceptance evidence only from real results.
10. Report completed work, evidence, risks, and anything not verified.

### 6.1 V2 task candidate and integration gates

For a task whose contract adopts the V2 process, use this order when the corresponding permission exists:

```text
Txxx Contract
  → Task Gate
  → Preflight
  → first meaningful commit
  → Draft PR + early hosted CI
  → Implementation Candidate
  → complete diff review
  → Independent Review
  → Integration Freshness Gate
  → affected regression on the latest authorized dev
  → candidate hosted CI
  → owner-approved docs closeout
  → final-head CI
  → Task Delivery Revision
  → owner-approved merge to dev
  → Dev Integration Revision
```

- A Draft PR and early CI are intermediate visibility and feedback; neither proves implementation completion.
- Final review must inspect the Implementation Candidate, not an earlier Draft revision.
- If the task base is stale, refresh with a traceable ordinary merge from the latest authorized `dev`, resolve conflicts, rerun affected regression, and repeat review when the result changes the review surface.
- Do not use force-push to rewrite published task history.

Integration Freshness has only these states: `fresh`, `refreshed-and-passed`, `blocked`, and `not-required`. A task may claim `fresh` only when its validation base is the latest authorized integration base and the evidence records the actual revisions.

### 6.2 Escalation Proposal

When a requirement conflict, architecture change, contract or permission expansion, dependency/migration issue, integration conflict, testability problem, evidence problem, or baseline drift is found:

1. Stop the affected work.
2. Preserve safe completed work and record the actual branch, revision, commands, and results.
3. Complete [`docs/implementation/ESCALATION_PROPOSAL_TEMPLATE.md`](docs/implementation/ESCALATION_PROPOSAL_TEMPLATE.md).
4. Wait for new authority; do not silently rewrite architecture, requirements, scope, or neighboring tasks.

An Escalation Proposal is an execution communication record, not a product requirement, decision, or authorization source.

## 7. Architecture invariants

- All mutations pass through Application commands and Domain invariants.
- Queries do not mutate domain state.
- Renderer never opens SQLite, selects arbitrary files, reads credentials, or invokes an AI Provider directly.
- Preload exposes concrete Command/Query methods and validates inputs and origins.
- `unknown`, `not_done`, `intentional_rest`, `acted`, and `target_met` remain distinct.
- A missing Routine record stays unknown; it is not inferred as failure.
- Partial action is a real action record but not automatic completion.
- Pause and end preserve history; hard delete follows approved preview, confirmation, transaction, cascade, and detach rules.
- Record occurrence dates are explicit local dates; crossing midnight never silently moves history.
- Statistics show facts, not streak pressure, scores, mastery, or inferred failure.
- AI output remains temporary until a user confirms a normal application command.
- Export excludes credentials, AI drafts, and technical logs.

## 8. Data and test isolation

- Automated tests must use temporary data roots and databases.
- Never point tests, fixtures, demos, or migrations at the real Electron `userData` database.
- Use a fake clock for date-boundary behavior and a fake AI Provider for normal CI.
- Never place real API keys in source, fixtures, logs, SQLite, exports, screenshots, or copied worktrees.
- Live-provider tests require separate approval and must not be required for the core application to work.

## 9. Validation and evidence

The stable S0 validation commands are:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
```

`verify` is the required aggregate and includes build through `test:e2e`. It must remain read-only with respect to tracked source and documentation: it never invokes `format`, packaging, installation, release, migrations, or live AI. Electron E2E must run in an environment that can launch Windows desktop processes, always with a unique temporary `userData` root.

Evidence must bind a claim to:

- task and requirements;
- exact source revision or clearly identified uncommitted state;
- exact command or manual procedure;
- execution environment;
- result and relevant artifact location;
- known limitations and missing platform or manual evidence.

For V2 task evidence, distinguish the task's own `task_delivery_revision`, the revision that actually entered `dev` as `dev_integration_revision`, and the aggregate stage `stage_final_integration_revision`. Record early, candidate, and final-head CI separately; an earlier green result cannot prove a later revision. Failed evidence remains in the ledger and later success records it through `supersedes` rather than deleting the failure.

A test name, plan entry, keyword match, or agent statement is not proof that behavior passed. Record evidence in `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`.

## 10. Git and GitHub authorization

Follow `docs/implementation/GITHUB_WORKFLOW_V0.1.md`.

- Keep local `dev` as a clean integration checkout when practical.
- Use one `task/Txxx-short-name` branch or isolated Codex worktree per task.
- Creating a local branch/worktree and commits requires the active task to authorize the Git workflow.
- Pushing and opening/updating a Draft PR requires explicit publication authorization in the task.
- Task PRs target `dev`; feature work does not target `main`.
- The agent may recommend Ready for review but does not mark it Ready unless authorized.
- Merging to `dev`, creating `dev -> main`, merging to `main`, tagging, and releasing always require separate project-owner approval.
- Force push and remote branch deletion are prohibited unless separately authorized. Normal post-merge branch cleanup is performed by the project owner or an explicitly authorized task.
- Do not bypass branch protection or required checks.

## 11. Worktree rules

- Base a new task worktree on the latest authorized `dev` revision.
- Codex-managed worktrees may begin in detached HEAD; create the task branch before publishing commits.
- A branch may be checked out in only one worktree at a time.
- Avoid parallel tasks that edit overlapping files or migrations.
- Do not copy secrets into managed worktrees. Use fakes for automated AI tests.
- Hand off to the local checkout when Electron can only be tested reliably in the foreground environment.

## 12. Code review rules

Prioritize correctness, data safety, frozen semantics, and regressions. Flag at least:

- Renderer access to Node, SQLite, filesystem paths, credentials, or concrete AI SDKs.
- IPC without a narrow channel, runtime validation, or sender/origin validation.
- AI suggestions that mutate data before explicit user confirmation.
- UTC or implicit system dates replacing approved LocalDate semantics.
- edits to historical Records used to simulate current state changes;
- delete operations that bypass impact preview, confirmation, transaction, cascade, or detach rules;
- statistics that collapse unknown, rest, partial action, or goal attainment;
- tests that touch real user data or require a live provider for core behavior;
- deferred features, unapproved dependencies, or new user-visible concepts without a requirement basis;
- completion claims unsupported by actual commands, artifacts, and the reviewed revision.

Leave formatting and other deterministic checks to the configured tooling once it exists.

## 13. Completion and reporting

A task is complete only when:

- the requested observable behavior exists;
- relevant tests and required validations pass;
- the final diff is reviewed;
- requirements remain traceable;
- documentation matches actual behavior;
- no unrelated, deferred, or unapproved work is included;
- evidence is recorded;
- manual acceptance is reported as pending until the project owner actually performs it.

The final report must list changed files, requirements covered, validation performed, residual risks, known gaps, and whether any requirement conflict or scope change was found.

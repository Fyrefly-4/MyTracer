---
name: mytracer-stage-development
description: Execute one approved MyTracer Txxx implementation or fix task within an S0-S7 slice, from task-contract and authority checks through scoped development, layered validation, independent review, evidence recording, meaningful commits, and an optional Draft PR to dev. Use when a development agent is asked to build or fix a concrete MyTracer task; do not use it to invent product requirements, batch an entire stage, or treat review-only requests as implementation authorization.
---

# MyTracer Stage Development

Complete one approved `Txxx` task as a focused, traceable delivery. Preserve frozen product semantics, user data, process boundaries, and the project owner's control over dependencies, publication, merge, and release.

## 1. Establish authority and task scope

1. Locate the repository root and read the applicable `AGENTS.md`.
2. Classify the request before changing files:
   - For answer, explanation, review, diagnosis, or planning, inspect and report only.
   - For implementation or fixing, continue only within the explicit local-write scope.
   - For monitoring, observe only the named target.
3. Require one stable `Txxx` task. Treat a stage or plan item as context, not as permission to batch neighboring tasks.
4. Read the smallest relevant set in this authority order:
   1. `docs/PRODUCT_REQUIREMENTS_V0.1.md` for frozen FR and AC semantics.
   2. `docs/DECISIONS.md` for frozen D decisions.
   3. `docs/REQUIREMENTS_CHANGE_POLICY.md` for change authority.
   4. Relevant files under `docs/architecture/`, including the task's implementation-plan item and test strategy.
   5. `docs/implementation/GITHUB_WORKFLOW_V0.1.md` when Git or GitHub is in scope.
   6. `docs/implementation/TASK_INDEX_V0.1.md` and the active contract created from `docs/implementation/TASK_TEMPLATE.md`.
5. Never use `user/` as a development, architecture, test, or acceptance source. Report drift instead of following it.
6. Stop the affected work when two authorities conflict, a MUST cannot be satisfied, or the task would change frozen semantics. Use the requirements-change format; do not choose silently.

## 2. Pass the task gate

Before editing, extract and restate the execution contract:

- Task ID, title, slice, and observable outcome.
- FR, AC, D, ED, GW, and architecture basis.
- Allowed files or modules and explicit exclusions.
- Domain, data, Electron, AI, and test invariants that apply.
- Deliverables and exact pass/fail completion conditions.
- Exact targeted, regression, and manual validation steps.
- Dependency, network, data, Git, GitHub, and external-write authorization.
- Source baseline, expected branch, and evidence requirements.

Continue only when the task is `ready` or explicitly activated and its prerequisites are evidenced. If the contract is missing or materially incomplete, remain read-only and propose the smallest completion instead of inferring permission.

Do not add or upgrade a dependency unless the task lists the approved package and version range. Do not invent validation commands before S0 establishes them. Read the current README, task contract, package configuration, and CI after commands exist, and use the same commands they specify.

## 3. Inspect the working state

Perform read-only preflight checks before implementation:

- Confirm the current directory, branch or detached state, base revision, and configured worktrees.
- Inspect `git status`, staged and unstaged diffs, and relevant untracked files.
- Identify user-owned or unrelated changes and preserve them.
- Inspect the affected implementation, tests, migrations, interfaces, and recent relevant history.
- Confirm tests use temporary data roots, fake clocks, and fake AI providers.
- Confirm the task's Git permissions before creating a branch, worktree, commit, push, or PR.

Base a task branch or worktree on the latest authorized `dev` revision when Git workflow is authorized. Never switch, clean, reset, overwrite, or move unrelated work merely to obtain a clean tree.

## 4. Implement one complete vertical slice

Plan the smallest end-to-end behavior that satisfies the task. Include only layers required by the observable outcome: Domain, Application, ports, adapters, Main/Preload, Renderer, migrations, tests, and factual documentation.

Preserve these repository-wide invariants whenever applicable:

- Route every mutation through Application commands and Domain invariants; keep queries read-only.
- Keep Domain independent of Electron, React, SQLite, and concrete AI SDKs.
- Keep Renderer away from Node, SQLite, filesystem paths, credentials, providers, and arbitrary IPC.
- Expose only concrete typed Preload methods and validate IPC inputs and sender/origin.
- Preserve `unknown`, `not_done`, `intentional_rest`, `acted`, and `target_met` as distinct facts.
- Preserve partial action as real action without automatic completion.
- Bind records to explicit local occurrence dates; never move history silently across midnight.
- Preserve history on pause/end and follow approved preview, confirmation, transaction, cascade, and detach rules for hard deletion.
- Keep statistics factual and non-punitive; never infer mastery, failure, or personality.
- Keep AI user-triggered, minimal-context, degradable, and temporary until confirmation invokes a normal command.
- Exclude credentials, AI drafts, and technical logs from core storage and export.

Add or update tests at the layers that own the behavior. Do not expand into deferred features, future abstractions, neighboring tasks, or cleanup unrelated to the contract.

## 5. Validate from narrow to broad

Run validation in this order, using only established commands:

1. The narrowest changed-layer tests or checks.
2. Task-specific domain, application, adapter-contract, integration, or E2E tests.
3. The task contract's affected-scope regression.
4. The repository aggregate verification command when required.
5. Windows build, package, restart, migration, export, or manual procedures when the task or gate requires them.

For every execution, retain the exact command, working directory, environment, source revision or timestamped uncommitted state, result, and relevant artifact. Distinguish local proof from hosted CI and source-branch revisions from test-merge revisions.

Use isolated temporary databases and Electron `userData` roots. Use `FakeClock` for date behavior and `FakeAiProvider` for normal automated validation. Never place real credentials in source, fixtures, logs, SQLite, exports, screenshots, or copied worktrees. Keep live-provider tests separately approved and outside core verification.

Report failed, skipped, unavailable, platform-limited, and manual checks explicitly. A test name, keyword match, plan entry, or earlier successful revision is not completion evidence. Keep project-owner manual acceptance `pending` until the owner performs it.

## 6. Review the complete result

Before committing or reporting completion:

- Inspect the complete task diff against the authorized base, not only the latest edit.
- Run whitespace or diff-integrity checks established by the repository.
- Check for unrelated files, generated debris, debug code, secrets, real data paths, and accidental dependency changes.
- Reconcile implementation, tests, migrations, documentation, task scope, and requirement identifiers.
- Verify no deferred behavior, new user-visible concept, silent semantic change, or broader AI/data authority entered the diff.
- Perform an independent read-only review of the uncommitted diff, branch diff, or intended commit and resolve every material finding.

Do not edit user-owned unrelated changes. If overlap prevents safe isolation, stop and report the exact conflict.

## 7. Record evidence and task state

Update `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md` only with real results and only when the task authorizes that file. Bind each claim to its Evidence ID, task and requirements, source revision, environment, procedure, result, artifacts, manual status, and limitations.

Update `docs/implementation/TASK_INDEX_V0.1.md` only as the single task-status ledger and only when authorized. Do not duplicate execution state into README, PRD, or architecture documents. Do not mark `done` while required validation, evidence, independent review, or required work remains. Keep non-blocking limitations explicit.

Update documentation only for actual behavior, exact established commands, or required traceability. Never document a planned command or target GitHub configuration as already working.

## 8. Create meaningful commits when authorized

Use the repository naming rules, normally `task/Txxx-short-name`, `fix/Txxx-short-name`, or `docs/Txxx-short-name`. Use English for branch names, commit subjects, code, and PR technical text.

Create multiple commits when they express independently understandable and reversible concerns, such as a domain contract followed by its adapter/UI integration. Do not create artificial micro-commits, and do not compress a complex task into one opaque final commit. Before each commit:

1. Inspect the staged diff.
2. Confirm it contains one coherent concern and no unrelated user changes.
3. Run the focused validation appropriate to that commit.
4. Write an imperative English subject tied to the task.

After the final local commit, rerun the required affected-scope validation and bind the result to that exact revision. Reconcile any earlier uncommitted evidence with the final commit and, later, the latest CI revision.

Do not rewrite published history, force-push, or delete remote branches. Force-push and remote deletion require separate authorization for the exact branch.

## 9. Publish only within the task grant

Push and create or update a Draft PR to `dev` only when the active contract explicitly authorizes publication. Open the Draft after the first meaningful commit when early CI is useful, then keep its scope, verification, evidence, risks, and dependency section current.

Use this PR structure:

- Task
- Goal
- Requirements
- Scope
- Exclusions
- Changes
- Verification
- Evidence
- Risks and gaps
- Dependency changes

Confirm that CI checks apply to the latest relevant revision and report whether they validate the PR head or a merge revision. Recommend Ready only after all repository conditions pass. Never mark Ready, merge to `dev`, create or merge `dev -> main`, tag, release, change branch protection, or modify secrets without the exact additional owner authorization required by the workflow.

## 10. Stop conditions

Stop the affected action and report evidence when any of these occurs:

- Missing task identity, contract, prerequisite, dependency approval, or Git authority.
- A requirement or architecture conflict.
- A need to change status, statistics, date, deletion, AI context, persistence, or confirmation semantics.
- A need for a deferred feature, new user concept, broader file scope, or external write.
- A migration with unapproved destructive or irreversible impact.
- Validation that would touch real user data or require an unapproved live provider.
- Inability to create reliable acceptance evidence.

Continue other safe, independent in-scope work when the blocker affects only one part of the task.

## 11. Report the handoff

Report to the project owner in Chinese. Include:

- Changed files and observable result.
- FR, AC, D, ED, and task coverage.
- Exact validation commands, environments, results, and artifacts.
- Commit, branch, PR, CI, and revision identifiers when applicable.
- Automated and manual acceptance status.
- Residual risks, known gaps, skipped or unverified work.
- Whether any requirement conflict or scope change was found.

Describe partial outcomes honestly. Do not call a task complete merely because implementation exists, local checks passed, or a Draft PR was opened.

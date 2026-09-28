---
name: mytracer-stage-development
description: Execute one approved MyTracer Txxx implementation or fix task within an S0-S8 slice, from task-contract and authority checks through scoped development, layered validation, independent review, meaningful commits, hosted CI, owner-approved documentation closeout, final-head CI, and merge handoff. Use when a development agent is asked to build or fix a concrete MyTracer task; do not use it to invent product requirements, batch an entire stage, or treat review-only requests as implementation authorization.
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
   For S8, read `docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md` and the approved T081～T084 contract for the chosen task; S8 applicability does not activate neighboring tasks or broaden their permissions.
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
- Candidate closure documents and whether their later edit, commit, and push require additional authorization.
- References, task dependencies, shared surfaces, explicit permissions, and integration freshness requirements from the contract.

Continue only when the task is `ready` or explicitly activated and its prerequisites are evidenced. If the contract is missing or materially incomplete, remain read-only and propose the smallest completion instead of inferring permission.

Do not add or upgrade a dependency unless the task lists the approved package and version range. Do not invent validation commands before S0 establishes them. Read the current README, task contract, package configuration, and CI after commands exist, and use the same commands they specify.

### 2.1 Select the explicit or Profile execution mode

At task start and every later resume, determine whether the approved contract declares an Automation Profile. A Profile controls only whether already-authorized steps may continue without another routine confirmation; it is not a permission source, permission calculator, scheduler, or replacement workflow.

Use this authority order as a conservative intersection:

```text
Approved Task Contract scope and permissions
  ∩ valid and applicable Automation Profile
  ∩ Repository Safety Rules
  → this Skill's existing phases
```

Before relying on a declared Profile:

1. Read the contract, its metadata sidecar, the task state in `TASK_INDEX_V0.1.md`, and the referenced registry entry in `docs/implementation/profiles/`.
2. Run `npm.cmd run governance:metadata:check`. Structural validation is necessary but does not prove owner approval, current validity, applicability, or permission for an action.
3. Confirm the contract and sidecar identify the same Profile, `activated_at`, `valid_until`, and `additional_constraints`. Stop Profile-driven execution when they disagree; do not choose one silently.
4. Confirm the owner approved and activated the contract, the task kind is allowed by the Profile, and the task state is compatible.
5. Compare the actual current time with the RFC3339 bounds. The Profile is current only while `activated_at <= now < valid_until`.

Apply these lifecycle rules:

- `ready`: begin at the Task Gate and run preflight before any mutation.
- `active`: resume from the last evidenced safe point, then repeat preflight and all current checks before changing files or external state.
- `review`: continue only Candidate validation, same-PR maintenance, freshness work, or review handoff already in scope; do not begin new implementation scope.
- `done`: perform no development or publication phase. Read-only reporting remains allowed.

Missing or unknown Profile declarations and inactive, expired, or inapplicable Profiles cannot drive automatic continuity; fall back to the contract's current explicit-permission process when its authority remains unambiguous. A fallback does not erase or broaden contract permissions. Invalid metadata prevents Profile use, while a contract/sidecar conflict stops the affected work until the inconsistency is corrected or the project owner gives an explicit decision.

Recheck applicability, lifecycle state, constraints, and the current time:

- before the first mutating task action;
- whenever a session is resumed;
- before entering each automatic phase;
- after returning from an owner gate;
- immediately before every GitHub or other external write.

If a Profile expires during work, preserve safe completed work but do not begin another mutating or external action under that Profile. Continue only through the explicit-permission process. Never reinterpret the contract's initial permission fields as an unlimited extension of the Profile.

### 2.2 Map `standard-task@1` onto this Skill

For an applicable `standard-task@1`, use the existing sections rather than creating a parallel procedure:

| Profile phase | Existing Skill steps | Automatic phase endpoint |
|---|---|---|
| `local_development` | Sections 1-4 and authorized checkpoint commits in Section 8 | A scoped local implementation candidate or a stop condition |
| `validation_execution` | Sections 5-7, including targeted checks, affected regression, evidence, complete diff review, and independent review | A reviewed validation candidate |
| `task_branch_publish` | Initial task-branch push and Draft PR creation in Section 9 | The exact task branch has one Draft PR to `dev` |
| `draft_pr_maintenance` | Sections 3.1, 5, 6, and 9 for the same Draft PR | An Implementation Candidate on a fresh authorized base |
| `review_handoff` | Sections 10.1-10.2 | A factual documentation impact matrix, followed by the `docs_closeout_scope` owner gate |

Treat `additional_constraints` conservatively:

- `disable_phase` removes that phase from Profile continuity. Enter it only through the explicit-permission process if the contract and owner authorization still allow it.
- `pause_before` requires a pause immediately before the named phase even when every other Profile check passes.
- Constraints may only remove continuity or add a pause; they never grant an action or remove a Repository Safety Gate.

The following owner gates always pause Profile execution: final `docs_closeout_scope`, `ready_for_review`, `merge_dev`, `merge_main`, `tag`, `release`, `dependency_change`, `migration_change`, `non_task_publication_external_write`, and `ai_provider_or_permission_change`. A Profile also never authorizes force-push, remote branch deletion, ruleset or secret changes, automatic task activation, or starting the next task.

Exit Profile continuity and use the applicable stop or escalation path when work encounters a dependency or migration change, product-semantics or major-architecture change, broader AI Provider/context/write authority, destructive data behavior, a non-task external write, or any scope or permission expansion. Safe read-only diagnosis may continue, but the affected mutation must wait for explicit authority.

## 3. Inspect the working state

Perform read-only preflight checks before implementation:

- Confirm the current directory, branch or detached state, base revision, and configured worktrees.
- Inspect `git status`, staged and unstaged diffs, and relevant untracked files.
- Identify user-owned or unrelated changes and preserve them.
- Inspect the affected implementation, tests, migrations, interfaces, and recent relevant history.
- Confirm tests use temporary data roots, fake clocks, and fake AI providers.
- Confirm the task's Git permissions before creating a branch, worktree, commit, push, or PR.

Base a task branch or worktree on the latest authorized `dev` revision when Git workflow is authorized. Never switch, clean, reset, overwrite, or move unrelated work merely to obtain a clean tree.

### 3.1 Integration Freshness Gate

Before treating a task as merge-ready, compare the revision used for task validation with the latest authorized `dev` revision.

- `fresh`: the validation base is the latest authorized `dev`.
- `refreshed-and-passed`: the task was stale, was refreshed with an ordinary traceable merge from `dev`, and affected regression plus candidate validation passed.
- `blocked`: the latest base is unavailable, the refresh cannot be completed safely, or a conflict remains unresolved.
- `not-required`: the contract explicitly says the task does not enter the current `dev` integration.

Record `original_base_revision`, `latest_authorized_dev_revision`, `verified_against_revision`, `status`, and `refresh_method` from actual Git and validation results. Never infer freshness from an earlier green run. Never force-push to rewrite published task history. Re-review the affected diff when refreshing changes the prior review conclusion.

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

Apply the [`AGENTS.md`](../../../AGENTS.md) long-running-work policy to command execution. Local result-gating commands normally use `BLOCK`; use `SPARSE_POLL` only when effective blocking is unavailable, and use its required exit assessment rather than observing an unchanged process indefinitely.

For every execution, retain the exact command, working directory, environment, source revision or timestamped uncommitted state, result, and relevant artifact. Distinguish local proof from hosted CI and source-branch revisions from test-merge revisions.

Use isolated temporary databases and Electron `userData` roots. Use `FakeClock` for date behavior and `FakeAiProvider` for normal automated validation. Never place real credentials in source, fixtures, logs, SQLite, exports, screenshots, or copied worktrees. Keep live-provider tests separately approved and outside core verification.

Report failed, skipped, unavailable, platform-limited, and manual checks explicitly. A test name, keyword match, plan entry, or earlier successful revision is not completion evidence. Keep project-owner manual acceptance `pending` until the owner performs it.

For a contract that adopts V2 Batch 3, run `npm.cmd run governance:metadata:check` and use `capture-command.mjs` with explicit argv when command facts must be recorded. On Windows, `.cmd`/`.bat` commands are launched through explicit `ComSpec` argv while the Node child process remains `shell: false`, and the original command argv remains in the artifact. For GitHub `pull_request` runs, `ci.headRevision` must be the PR head from the event payload while `ci.mergeRevision` is the checked-out test-merge revision. The wrapper may create only ignored `.tmp/evidence/*.json`; it must not write long-term task, evidence, requirement or status documents. Inspect the artifact for source/base revisions, command exit code, CI classification, redaction and missing fields before using it as evidence. A failed child command or incomplete capture remains failed/incomplete and cannot be interpreted as acceptance.

## 5.1 Escalation Proposal

When work encounters `requirement_conflict`, `architecture_change`, `contract_scope_change`, `dependency_change`, `migration_change`, `permission_change`, `integration_conflict`, `testability_problem`, `evidence_problem`, or `baseline_drift`:

1. Stop the affected portion of the task.
2. Preserve safe completed work and record the actual branch, revision, commands, tests, and artifacts.
3. Fill [`docs/implementation/ESCALATION_PROPOSAL_TEMPLATE.md`](../../../docs/implementation/ESCALATION_PROPOSAL_TEMPLATE.md).
4. Wait for new authority before changing requirements, architecture, scope, permissions, dependencies, migrations, or neighboring tasks.

The proposal communicates a blocker; it does not create requirements, decisions, or authorization.

## 6. Review the complete result

Before committing or reporting completion:

- Inspect the complete task diff against the authorized base, not only the latest edit.
- Run whitespace or diff-integrity checks established by the repository.
- Check for unrelated files, generated debris, debug code, secrets, real data paths, and accidental dependency changes.
- Reconcile implementation, tests, migrations, documentation, task scope, and requirement identifiers.
- Verify no deferred behavior, new user-visible concept, silent semantic change, or broader AI/data authority entered the diff.
- Perform an independent read-only review of the uncommitted diff, branch diff, or intended commit and resolve every material finding.

Do not edit user-owned unrelated changes. If overlap prevents safe isolation, stop and report the exact conflict.

## 7. Prepare evidence and task records

Record provisional evidence during implementation only from real results and only when the task authorizes the target file. Bind each claim to its Evidence ID, task and requirements, source revision, environment, procedure, result, artifacts, manual status, and limitations. For V2 tasks, distinguish `task_delivery_revision`, `dev_integration_revision`, and `stage_final_integration_revision`; record early, candidate, final-head, and post-merge CI separately. Preserve failed records and link later results with `supersedes`.

When a CI workflow uploads a deterministic artifact, record the artifact name and exact CI run/head revision in the Evidence ledger after inspection. Artifact upload, metadata validation and command wrapping do not automatically update the ledger or mark a task complete.

Keep `docs/implementation/TASK_INDEX_V0.1.md` as the single repository task-status ledger. Use `active` or `review` while implementation, independent review, task-required candidate CI, documentation authorization, or documentation closeout remains. Do not mark `done` before its definition is supported by evidence. Keep non-blocking limitations explicit.

Include documentation required to explain or operate the implemented behavior in the implementation commits when the task requires it. Defer end-of-task status reconciliation to the post-CI closeout gate. Never document a planned command or target GitHub configuration as already working.

## 8. Create meaningful commits when authorized

Use the repository naming rules, normally `task/Txxx-short-name`, `fix/Txxx-short-name`, or `docs/Txxx-short-name`. Use English for branch names, commit subjects, code, and PR technical text.

For every non-trivial task, plan and create reviewable commits at meaningful development checkpoints instead of waiting to create one large commit at the end. Split by coherent, independently understandable and reversible concerns, such as domain behavior and tests, application or persistence integration, IPC/UI wiring, and final documentation or evidence; include only the checkpoints that the task actually needs.

A single commit is acceptable only when the task is genuinely atomic and splitting it would create incomplete or noisy commits. Do not create artificial micro-commits. Optimize the task-branch history for incremental review and diagnosis; the task PR's squash merge will still produce one task-level commit on `dev`. Before each commit:

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

After the implementation commits, local verification, final diff review, and independent review are complete, push the implementation candidate and obtain required hosted CI on that exact PR head or test-merge revision. Follow the [`AGENTS.md`](../../../AGENTS.md) long-running-work policy: if no meaningful work remains after confirming that CI started, preserve the target revision and PR/run/job/head/test-merge identifiers and issue an accurate pending handoff. On resume, verify those identifiers still match the current target revision before using the result. Treat the first green hosted CI as an implementation-complete candidate, not final task completion, and continue into the documentation closeout gate after it is verified.

Never mark Ready, merge to `dev`, create or merge `dev -> main`, tag, release, change branch protection, or modify secrets without the exact additional owner authorization required by the workflow.

## 10. Close documentation after implementation CI

### 10.1 Confirm the candidate

Before proposing documentation changes, verify that:

- Required hosted checks passed for the exact implementation candidate revision.
- Targeted and affected-scope local validation, final diff review, and independent review have no unresolved required issue.
- The implementation stays within the task contract and has no unreported dependency, migration, platform, manual, or scope gap.

Do not call the task complete, advance the next task, or mark the PR Ready at this point. Proceed to the documentation owner gate; returning control through an accurate handoff is not a completion claim.

### 10.2 Build a documentation impact matrix

Inspect and classify related documents without editing them yet:

- **Always assess:** the active task contract, `docs/implementation/TASK_INDEX_V0.1.md`, `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`, and the Draft PR body.
- **Update when affected:** README for durable user-visible capability, stable command, or milestone facts; the implementation plan and relevant stage design for an approved gate or next-entry change; requirements traceability for changed implementation or test locations; architecture documents for an approved design realization; `AGENTS.md`, task templates, or CI only for changed standing workflow or commands.
- **Update as derived explanation only:** files under `user/` when user-visible behavior changed. Never use them to decide implementation or acceptance.
- **Do not update without separate product authority:** PRD, decisions, or requirements-change policy when no approved semantic change occurred.

For each candidate file, state the exact durable fact to add, change, or remove. Prefer the smallest factual correction. Do not copy live Draft, Ready, check, or merge status into multiple repository documents. Keep task state in the task index and live PR integration state on GitHub.

### 10.3 Ask the project owner

Always pause after the first green hosted CI and ask the project owner to approve the exact documentation closeout scope, even when the task already authorized general publication. Use a concise Chinese request in this form:

```text
PR <number> 的实现 revision <sha> 已通过 required CI，当前可视为实现完成候选。
建议进行文档收口：
- 必改：<files and exact facts>
- 条件更新：<files and reasons>
- 明确不改：<files and reasons>
是否授权我修改上述文档、更新 Draft PR 正文、创建独立的 `docs: close Txxx delivery records` commit，并推送当前任务分支？推送后会确认新 PR head 的 required CI 已启动；若没有其他有效工作，将记录 run/head/revision 并交还控制权。merge 仍由你决定。
```

If the owner declines or narrows the scope, preserve that decision, keep the remaining state accurate, and do not silently perform the omitted edits.

### 10.4 Apply the approved closeout

After approval:

1. Modify only the approved documents and PR body fields.
2. Record durable completion facts, evidence, limitations, manual status, and the next authorized entry point without starting the next task.
3. Keep live PR state out of durable repository summaries; refer to the PR and evidence identifiers without promising an unperformed merge.
4. Run documentation- or skill-specific structural checks, `npm.cmd run format:check`, and `git diff --check`, plus any stricter task command. Run the aggregate `npm.cmd run verify` only when the closeout changes executable code, configuration, stable command contracts, CI behavior, or the active task explicitly requires it; do not run unrelated application or Electron E2E for prose-only changes.
5. Inspect the documentation diff for duplicated state, stale current-status language, unsupported completion claims, and accidental semantic changes.
6. Create a separate reviewable commit, normally `docs: close Txxx delivery records`, and push it to the existing task branch under the approved publication grant.

In the documentation closeout commit, set the task ledger to `done` only when the implementation candidate already satisfies the repository definition and the documentation-updated tree passes the required local validation. Treat hosted CI and merge for the documentation commit as PR integration gates, not as a second repository task status. Keep a pending or failed integration state in the PR body, and return the task ledger to an accurate non-done state if a later failure invalidates completion evidence.

Bind in-repository task evidence to the exact implementation revision it proves. Use the PR body for the latest live CI and merge state; do not create an endless series of repository commits solely to record each subsequent CI run.

### 10.5 Require final-head CI

Treat the documentation push as a new PR revision and obtain all required checks on that exact latest head or test-merge revision; the earlier green implementation CI is insufficient for merge readiness. Use the repository long-running-work policy while the checks run, including pending handoff when nothing else is actionable and current-revision verification after resume. If a check fails, fix only the authorized scope, revalidate, push, and repeat the same exact-revision gate.

After the final-head CI passes, update the PR body with the latest revision, CI result, evidence IDs, and remaining gaps. Recommend or mark Ready only as authorized.

## 11. Handle merge handoff

For a published task PR, report the merge-ready state and hand control to the project owner unless the owner explicitly requests continued monitoring. Do not merge on the owner's behalf without exact authorization. Apply the [`AGENTS.md`](../../../AGENTS.md) long-running-work policy to any requested monitoring.

- Preserve the PR number, target branch, current head, required-check revision, and remaining owner action in the handoff.
- On resume, verify that the saved PR/head still identifies the current target before interpreting reviews, checks, or merge state; do not reuse an older green run for a newer head.
- If review or CI introduces a code change, re-enter affected validation and repeat documentation impact assessment when facts changed.
- If only the PR body changes, do not manufacture a repository commit.
- After merge, verify the PR state, target branch, squash or merge revision, and required checks before giving the final completion report.
- Do not automatically start the next task after merge.

## 12. Stop conditions

Stop the affected action and report evidence when any of these occurs:

- Missing task identity, contract, prerequisite, dependency approval, or Git authority.
- A requirement or architecture conflict.
- A need to change status, statistics, date, deletion, AI context, persistence, or confirmation semantics.
- A need for a deferred feature, new user concept, broader file scope, or external write.
- A migration with unapproved destructive or irreversible impact.
- Validation that would touch real user data or require an unapproved live provider.
- Inability to create reliable acceptance evidence.

Continue other safe, independent in-scope work when the blocker affects only one part of the task.

## 13. Report the handoff

Report to the project owner in Chinese. Include:

- Changed files and observable result.
- FR, AC, D, ED, and task coverage.
- Exact validation commands, environments, results, and artifacts.
- Commit, branch, PR, CI, and revision identifiers when applicable.
- Automated and manual acceptance status.
- Residual risks, known gaps, skipped or unverified work.
- Whether any requirement conflict or scope change was found.

Describe partial outcomes honestly. Do not call a task complete merely because implementation exists, local checks passed, or a Draft PR was opened.

Do not issue the final completion report while an approved documentation closeout or required CI on the latest PR revision remains. An accurate pending handoff is allowed and required by the repository long-running-work policy when no meaningful work remains. If the owner pauses, declines, or withholds authority, report the exact partial state and pending decision instead.

---
name: mytracer-stage-acceptance-release
description: Verify an approved MyTracer stage and prepare its release handoff only when the owner explicitly invokes this Skill or requests that stage acceptance workflow. Ordinary validation, review, packaging, or release questions do not activate it.
---

# MyTracer Stage Acceptance and Release

Prove one approved stage on a fixed integration revision, preserve its complete evidence history, and prepare a release handoff without taking product-owner actions. This is an aggregate verification workflow, not a development or repair workflow.

## Activation boundary

Once this workflow is explicitly activated, read [the stage workflow reference](../../../docs/implementation/STAGE_WORKFLOW_REFERENCE.md) for contract, freshness, formal evidence, and closeout procedures. Read [the daily GitHub workflow](../../../docs/implementation/GITHUB_WORKFLOW_V0.1.md) for current CI, PR, integration, and release operations; this Skill does not restore obsolete CI checks. Historical stage execution records under `docs/implementation/archive/stage-execution/` are only provenance or examples, never new authority.

Apply the workflow below only when the owner explicitly invokes this Skill or explicitly requests its named stage workflow for the current work. Reading this file for inspection, encountering a Txxx reference, or receiving an ordinary implementation, fix, design, review, validation, or maintenance request does not activate it. If it is not activated, return to the current request under `AGENTS.md`; do not demand a contract or stage approval. Earlier stage approvals do not activate a new request.

## 1. Establish aggregate authority

1. Locate the repository root and read the applicable [`AGENTS.md`](../../../AGENTS.md).
2. Confirm the project owner authorized the exact Stage ID, approved stage design and gate, aggregate scope, target branch, and prior integration boundary. If authority is missing, remain read-only and report the smallest decision needed.
3. Require an active aggregate or milestone Txxx contract before writing files, running publication steps, or changing task records. Do not use `standard-task@1`; aggregate and release work uses explicit contract permissions.
4. Read the smallest relevant authority set in this order:
   1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../../../docs/PRODUCT_REQUIREMENTS_V0.1.md) and [`DECISIONS.md`](../../../docs/DECISIONS.md).
   2. [`REQUIREMENTS_CHANGE_POLICY.md`](../../../docs/REQUIREMENTS_CHANGE_POLICY.md).
   3. The approved stage design and its baseline manifest, delta, validation, manual acceptance, and stage gate.
   4. Relevant architecture and [`TEST_STRATEGY_V0.1.md`](../../../docs/architecture/TEST_STRATEGY_V0.1.md).
   5. Stage task contracts and metadata, [`TASK_INDEX_V0.1.md`](../../../docs/implementation/TASK_INDEX_V0.1.md), and [`ACCEPTANCE_EVIDENCE_V0.1.md`](../../../docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md).
   6. [`GITHUB_WORKFLOW_V0.1.md`](../../../docs/implementation/GITHUB_WORKFLOW_V0.1.md) and the active aggregate contract for Git and GitHub authority.
5. Treat the [S3/T803 archive](../../../docs/implementation/archive/S3_T031_T033_ARCHIVE.md) and `EV-G3-S3-001` as a proven process example, not as authority to copy S3 requirements, commands, approvals, task IDs, or release facts into another stage. The archive provides the Git recovery entry for the historical full contract.
6. Never use `user/` documents as requirements, architecture, test, acceptance, or release authority.

Extract allowed files, exclusions, exact validation, manual procedures, dependency and migration decisions, local and external write permissions, candidate closeout documents, and every Ready/merge/tag/release gate before acting.

## 2. Fix the stage source and integration facts

Before claiming aggregate eligibility:

- verify the latest authorized `dev` revision from repository and, when required, remote facts;
- prove every in-stage task's implementation actually entered that `dev` history or content tree;
- compare task contracts, Task Index, merge commits or PRs, and Evidence rather than trusting any one source;
- audit the approved stage range and `main...dev` merge base, commits, files, dependencies, migrations, and main-only content;
- report unrelated or unapproved content instead of silently including it in the stage.

Bind revision roles explicitly:

- `task_delivery_revision`: the exact revision that satisfies an individual task contract; the aggregate task has its own delivery revision.
- `dev_integration_revision`: the revision by which that task actually entered `dev`; it may differ from the task branch head because of squash or merge.
- `stage_final_integration_revision`: the one fixed product-content revision used for the complete stage validation and manual-acceptance binding.

An aggregate documentation revision, a later `dev` documentation merge, a test-merge revision, and a `main` milestone merge do not silently replace `stage_final_integration_revision`. Record each role separately. If `dev` advances during acceptance, run the contract's freshness procedure and repeat every affected check and review before continuing.

## 3. Audit requirements, tasks, and evidence

Build a stage matrix that maps each approved FR, AC, D, ED, and GW item to:

- the owning task and observable behavior;
- task delivery and dev integration revisions;
- automated commands and artifacts;
- hosted CI head and test-merge revisions;
- owner-reported manual acceptance;
- limitations, failures, and superseding evidence.

Preserve task-level evidence as the source record. Aggregate evidence may bind tasks together and add stage conclusions, but it must not overwrite task failures, erase pending manual items, delete artifacts, or reinterpret a test name as a pass. A later success uses an explicit `supersedes` relationship while retaining the failed result and cause.

Manual acceptance belongs to the project owner. Bind an earlier owner observation only when the relevant behavior revision or content tree is demonstrably identical and no later change affects the observed semantics. State that reasoning as an inference and preserve any narrower task-level `pending`; otherwise keep the stage manual result pending and request a new exact procedure.

## 4. Execute one-revision aggregate validation

Run the contract's checks from narrow to broad on the fixed stage source:

1. `npm.cmd run governance:metadata:check` and task/stage metadata consistency.
2. Stage-specific directed unit and integration suites.
3. Continuous AC or cross-task E2E paths without resetting state where continuity is part of the behavior.
4. Affected regression and the complete `npm.cmd run verify` aggregate.
5. Windows package, unpacked and installed smoke, restart, migration, export, security, or other platform checks required by the stage design.
6. Exact owner manual acceptance steps or a revision-safe binding to an already reported result.

Apply the [stage workflow long-running-work policy](../../../docs/implementation/STAGE_WORKFLOW_REFERENCE.md#16-long-running-work) to these commands. Local result-gating validation normally uses `BLOCK`; when effective blocking is unavailable, `SPARSE_POLL` must retain a justified next check and exit to `HANDOFF` when it does not.

Use the repository evidence wrapper with explicit argv when command facts must be retained. Every automated run uses unique temporary SQLite, export, Electron `userData`, installation, and other data roots; fake clocks and fake Providers remain mandatory for normal automation. Never access real user data, credentials, or a live Provider without separate exact authority.

Record each attempt's command, environment, source revision, exit code, artifact, and limitation. Environment recovery may adjust only disposable local runtime state when the contract permits it; retain the original failed artifact and rerun from the beginning. Never change tracked product code, tests, dependencies, schema, migration, or behavior to make an aggregate gate pass.

Any required failure makes the aggregate result non-pass. Stop the affected work, preserve evidence, and report the need for a separately authorized fix. Do not repair the product inside the aggregate task and do not create or start a fix task automatically.

## 5. Review the aggregate candidate

Before treating the result as an Implementation Candidate:

- inspect the entire approved stage range and the aggregate task diff;
- verify no unapproved task, deferred feature, dependency, migration, Provider, or product-semantic change entered the range;
- reconcile stage design, task contracts, Task Index, metadata, Evidence, README, archive, and live Git/GitHub facts;
- verify all checks and manual bindings refer to the fixed revision;
- perform an independent read-only review with no unresolved material finding;
- obtain hosted candidate CI on the exact aggregate head and distinguish PR head from test-merge revision; after confirming the run started, use the repository long-running-work policy and hand off when no other meaningful aggregate work remains.

An earlier task CI, early aggregate CI, or green run on another revision cannot prove the candidate. After any CI handoff, first verify that the saved PR/run/job/head/test-merge identifiers still bind the fixed aggregate revision and check for replacement, cancellation, or superseding execution. If freshness work changes the review surface, repeat affected regression and independent review.

## 6. Close documentation without rewriting history

After the candidate checks pass, build a documentation impact matrix. Assess at least:

- the aggregate contract and metadata;
- Task Index and Acceptance Evidence;
- the approved stage design and implementation plan;
- task or stage archive documents;
- README and release-facing notes;
- the aggregate Draft PR body.

State the exact fact proposed for each file and ask the project owner to approve the closeout scope. Keep live PR state on GitHub and durable task state in Task Index. Do not mark the aggregate `done`, rewrite historical pending results, or describe publication as complete before real evidence exists.

Delete or replace task contracts only with exact project-owner authorization for the named files, a complete archive, and a fixed Git recovery path. Preserve escalation proposals, failed evidence, known limitations, and supersede history.

After authorized closeout, run document and Skill checks plus every contract-required regression, create a separate closeout commit when appropriate, and obtain final-head hosted CI under the repository long-running-work policy. Candidate CI does not substitute for final-head CI, and a resumed run must rebind the saved CI identifiers to the current aggregate head before accepting the result.

## 7. Prepare the release handoff

Only when the aggregate task contract explicitly authorizes it, prepare or create a `dev -> main` Draft PR after the aggregate delivery has entered the latest authorized `dev`. The handoff must report:

- included tasks, requirements, stage source, aggregate delivery, and current `dev` revision;
- candidate, final-head, and post-merge CI as distinct facts;
- package artifacts, checksums, signature status, security and platform limitations;
- migration, restart, export, recovery, and manual acceptance status;
- known gaps, deferred behavior, and exact owner actions still required.

Stop at each owner gate. This Skill does not mark Ready, merge to `dev` or `main`, create or move a tag, publish or edit a release, upload unapproved assets, change rulesets or Secrets, or start the next stage. After an owner performs an action, verify it read-only before recording it as fact; do not attribute the action to the Agent.

When candidate, final-head, milestone, or owner-controlled release work is pending and no other meaningful work remains, record the fixed stage revision plus the relevant PR/run/job/head/test-merge identifiers and hand control to the project owner. On resume, verify that they still identify the current target before interpreting success or continuing the release handoff.

## 8. Stop conditions

Stop the affected acceptance or release handoff when:

- any stage task is missing, not actually integrated, or outside its approved contract;
- the latest authorized integration base or stage source cannot be fixed reliably;
- `main...dev` contains unexplained or main-only product content;
- a required automated, package, hosted, or manual check fails or cannot bind the fixed revision;
- evidence is incomplete, contradictory, destructive, sensitive, or cannot preserve failure history;
- completion would require a product fix, requirement change, dependency, migration, Provider, broader permission, or external write outside the contract;
- docs closeout, Ready, merge, tag, release, or next-stage authority is absent.

Use [`ESCALATION_PROPOSAL_TEMPLATE.md`](../../../docs/implementation/ESCALATION_PROPOSAL_TEMPLATE.md) when an active aggregate task encounters a requirement, architecture, scope, dependency, migration, permission, integration, testability, or evidence blocker. Preserve safe completed work; never convert a blocked or partial aggregate into a pass.

## 9. Report the handoff

Report in Chinese to the project owner unless requested otherwise. Include the fixed stage source, all three revision roles, included tasks and requirements, exact commands and artifacts, local and hosted results, failed and superseding evidence, manual status, documentation state, branch and PR state, release artifacts and limitations, residual risks, owner gates, and whether any requirement conflict or scope change was found.

Describe partial outcomes honestly. Stage acceptance, documentation closeout, `dev` integration, `main` integration, tag, and release are separate facts and never imply one another.

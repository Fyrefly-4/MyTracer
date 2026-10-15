---
name: mytracer-stage-design
description: Design an approved MyTracer stage and task graph only when the owner explicitly invokes this Skill or requests that stage design workflow. Ordinary design discussions, architecture questions, and maintenance requests do not activate it.
---

# MyTracer Stage Design

Turn one approved stage scope into a traceable architecture and delivery design. Preserve frozen product semantics and distinguish a design proposal from authority to create or execute implementation tasks.

## Activation boundary

Apply the workflow below only when the owner explicitly invokes this Skill or explicitly requests its named stage workflow for the current work. Reading this file for inspection, encountering a Txxx reference, or receiving an ordinary implementation, fix, design, review, validation, or maintenance request does not activate it. If it is not activated, return to the current request under `AGENTS.md`; do not demand a contract or stage approval. Earlier stage approvals do not activate a new request.

## 1. Establish design authority

1. Locate the repository root and read the applicable [`AGENTS.md`](../../../AGENTS.md).
2. Confirm the project owner authorized the Stage ID, design scope, and prior behavior revision. If any is missing, remain read-only and report the smallest decision needed; do not create a durable stage design or task records.
3. Classify the request:
   - For explanation, review, or proposal, inspect and report only.
   - For creating or revising a stage design, write only the explicitly authorized design files.
   - For implementation, stop and hand off to separately approved task contracts; this Skill does not execute the task graph.
4. When an active Txxx contract governs the design work, read it and treat its scope and permissions as hard limits.
5. Read the smallest relevant authority set in this order:
   1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../../../docs/PRODUCT_REQUIREMENTS_V0.1.md) for frozen FR and AC semantics.
   2. [`DECISIONS.md`](../../../docs/DECISIONS.md) for frozen product decisions.
   3. [`REQUIREMENTS_CHANGE_POLICY.md`](../../../docs/REQUIREMENTS_CHANGE_POLICY.md) for conflicts and change authority.
   4. Existing approved stage designs and the relevant files under `docs/architecture/`.
   5. [`IMPLEMENTATION_PLAN_V0.1.md`](../../../docs/architecture/IMPLEMENTATION_PLAN_V0.1.md) and [`TEST_STRATEGY_V0.1.md`](../../../docs/architecture/TEST_STRATEGY_V0.1.md).
   6. [`GITHUB_WORKFLOW_V0.1.md`](../../../docs/implementation/GITHUB_WORKFLOW_V0.1.md) only when Git, integration, hosted CI, or release handoff is in design scope.
6. Never use `user/` documents as requirements, architecture, acceptance, or agent authority. Report drift against normative sources.

Stop the affected design when authorities conflict or the requested outcome would change a frozen FR, AC, D, deferred feature boundary, or repository safety rule. Use the approved requirements-change process rather than silently resolving the conflict.

## 2. Fix the baseline and stage delta

Use [`STAGE_DESIGN_TEMPLATE.md`](../../../docs/architecture/STAGE_DESIGN_TEMPLATE.md) as the deliverable structure. Do not copy it into the Skill or invent a parallel stage schema.

Record a baseline manifest that binds:

- the exact Stage ID, title, status, and owner-approval fact;
- the target integration branch;
- the exact prior behavior revision;
- the PRD version and Decisions revision or date;
- the architecture documents actually used.

Verify revisions from repository facts when Git access is authorized. Do not infer integration from a Draft PR, task status, planned merge, or earlier CI result.

Treat the baseline as an input boundary. Describe only the stage delta:

- goal and user- or system-observable outcomes;
- explicit non-scope and deferred behavior;
- new or changed domain and data behavior;
- affected historical facts, compatibility, migration, and export behavior;
- new or compatible Application, IPC, DTO, Main/Preload, Renderer, SQLite, and AI boundaries.

Use `draft` unless the project owner has actually approved the complete design. Never record `approved` from author identity, task activation, silence, or a planning discussion alone.

## 3. Analyze architecture and invariants

For each affected boundary, state what changes, what remains stable, and which authority supports the decision:

- **Domain:** invariants, state transitions, local-date semantics, history preservation, and facts that must remain distinct.
- **Application:** commands, queries, ports, confirmation boundaries, and transaction ownership.
- **Data:** tables, migrations, compatibility, rollback or recovery, deletion impact, export, and real-user-data isolation.
- **Electron and IPC:** Main/Preload/Renderer ownership, narrow APIs, runtime validation, sender/origin validation, and security settings.
- **Renderer:** observable behavior without Node, SQLite, filesystem, credential, or Provider access.
- **AI:** user trigger, minimal context, degradability, temporary output, confirmation, Provider scope, and credential exclusion.
- **Verification:** unit, integration, continuous E2E, Windows package/restart, migration, export, and manual evidence.

Do not force unaffected layers into the design. If a migration, dependency, Provider, destructive-data behavior, or major architecture change is needed, identify its approval gate and stop the affected conclusion until authority exists.

## 4. Design the task graph and shared surfaces

Decompose the approved delta into the smallest complete vertical slices. For every proposed task node, define:

- observable outcome and FR/AC/D/ED/GW basis;
- allowed modules or files and explicit exclusions;
- invariants and required validation;
- `requires`, `blocks`, `can_parallel`, `prefer_after`, and `conflicts_with` relationships;
- shared files, modules, schema tables, IPC contracts, and domain invariants;
- risk and integration policy.

Every `conflicts_with` relation needs a concrete shared-surface basis. Recommend parallel execution only when the slices are independently testable and do not overlap unsafe files, schemas, migrations, interfaces, or invariants. Otherwise require serial integration and explain the order.

Task nodes in a stage design are proposals, not active work. Do not reserve or create Txxx contracts, metadata sidecars, branches, worktrees, issues, or PRs; do not edit `TASK_INDEX_V0.1.md`; and do not start a neighboring task. Stable IDs and task activation require a later explicit project-owner decision.

## 5. Define validation and the stage gate

Design evidence in layers and tie each check to an observable risk:

1. Task-specific unit, integration, contract, or E2E checks.
2. Cross-task continuous E2E that proves the full stage path without resetting state between steps.
3. Affected regression and the repository aggregate verification command.
4. Windows build/package, packaged and unpacked smoke, restart, migration, export, or security checks when the stage affects them.
5. Exact project-owner manual acceptance steps that automation cannot substitute.

Define a stage gate that binds all automated and manual claims to one exact `stage_final_integration_revision` on the latest authorized integration base. Preserve failed, skipped, unavailable, platform-limited, and superseded evidence; an earlier green task revision cannot prove the final aggregate stage.

The design must state entry conditions, pass conditions, stop conditions, required artifacts, and who controls each manual or publication gate. Stage acceptance does not automatically authorize Ready, merge, tag, release, or the next stage.

## 6. Review the design deliverable

Before presenting or committing a stage design:

- verify every changed semantic statement against the PRD and Decisions;
- check that the baseline manifest and prior behavior revision are exact;
- separate baseline facts, stage delta, non-scope, assumptions, and unresolved decisions;
- inspect each task dependency and conflict against its shared-surface basis;
- confirm validation covers history, compatibility, failure paths, Windows requirements, and manual acceptance where applicable;
- remove speculative abstractions and work that belongs to later stages;
- verify all relative links and referenced files;
- inspect the complete diff for unrelated edits or unsupported approval claims.

Report unresolved decisions explicitly. When a requirement, architecture, scope, dependency, migration, permission, testability, or evidence conflict blocks the design, use [`ESCALATION_PROPOSAL_TEMPLATE.md`](../../../docs/implementation/ESCALATION_PROPOSAL_TEMPLATE.md) only within an authorized active task; otherwise provide the same factual blocker analysis without creating a task artifact.

## 7. Preserve project-owner gates

Always stop for the project owner to decide:

- final stage-design approval and any change to FR, AC, D, or deferred scope;
- dependency, migration, destructive-data, AI Provider, context, credential, or write-authority changes;
- allocation, creation, activation, or execution of Txxx tasks;
- Git branch, commit, push, Draft PR, Ready, merge, tag, release, or other external writes not explicitly authorized for the design work;
- manual acceptance and the final stage gate.

This Skill never implements the proposed tasks, modifies the task ledger automatically, creates a generic orchestration platform, merges code, tags a revision, publishes a release, or starts the next stage.

## 8. Report the handoff

Report in Chinese to the project owner unless requested otherwise. Include the design file, baseline and prior behavior revision, stage delta, task graph and integration order, shared-surface risks, validation and manual gates, unresolved decisions, exact checks performed, and whether any requirement conflict or scope change was found.

Describe a draft as a draft. An owner-approved stage design authorizes only the design facts it contains; it does not authorize its proposed implementation tasks.

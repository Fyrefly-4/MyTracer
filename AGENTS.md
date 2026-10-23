# MyTracer Working Agreement

MyTracer is a gentle, local-first Windows application for goals, small actions, routines and personal records. Favor clear, calm interactions that help people return without pressure. It uses Electron, React, TypeScript, Vite and SQLite; improve the requested experience without adding unrelated complexity.

## Scope and collaboration

- Work autonomously within the owner's request. An explicit feature or UX request authorizes that stated change; do not ask for a second formal proposal. Discussion, review and planning authorize inspection and advice, not implementation. Discuss consequential implications outside the stated scope before implementing them; continue independent authorized work.
- Preserve unrelated changes. When work is parallel, assign distinct file ownership, agree on shared interfaces and reconcile overlapping edits before integration.
- Ordinary work needs no Txxx contract, stage gate or evidence closeout. Use a stage Skill only when the owner explicitly invokes that workflow; historical tasks and approvals do not activate it or authorize new work.
- Confirm every schema migration and dependency addition/upgrade before implementation, including non-destructive migrations. A general feature request does not implicitly approve these. Expanded AI context, persistence, provider permissions or write authority also need explicit confirmation.

## Read what the task needs

Start with relevant code, tests and configuration. For existing behavior, consult [product requirements](docs/PRODUCT_REQUIREMENTS_V0.1.md), [decisions](docs/DECISIONS.md), then [change policy](docs/REQUIREMENTS_CHANGE_POLICY.md). The v0.1 Demo scope is historical; still-valid semantics remain the baseline until explicitly changed. Record approved evolution in affected documents, without rewriting historical evidence. Surface unresolved conflicts rather than silently choosing; `user/` is explanatory, not development authority.

Use the [architecture entry](docs/architecture/README.md) for module/data boundaries, [maintenance entry](docs/MAINTENANCE.md) for commands, and [GitHub workflow](docs/implementation/GITHUB_WORKFLOW_V0.1.md) for Git/CI. Read only relevant sections; exact dependencies and scripts live in `package.json` and `package-lock.json`.

## Product and safety boundaries

- Preserve `unknown`, `not_done`, `intentional_rest`, `acted` and `target_met`. Missing records are not failure; partial action is not completion. Use explicit local occurrence dates and factual statistics.
- Pause/end preserve history. Hard deletion follows impact preview, confirmation, transaction, cascade and detach rules. Do not silently change record, date or deletion semantics for implementation convenience.
- Renderer stays UI-only: no Node, SQL, filesystem, credential or provider access. Preload exposes concrete typed APIs with runtime input and sender/origin validation, never arbitrary IPC. Domain stays independent of Electron, React, SQLite and AI SDKs; mutations use Application commands and Domain invariants, queries stay read-only.
- AI stays user-triggered, minimal-context and degradable; suggestions remain temporary until user confirmation invokes a normal application command. Core functions work without a live provider.
- Tests, fixtures, demos and migrations never touch real user data. Use isolated temporary data roots, fake clocks and fake providers; live-provider tests need separate approval. Never expose credentials in source, logs, fixtures, databases, exports, screenshots or worktrees; do not upload real records as development artifacts. Product export excludes credentials, AI drafts and technical logs.

## Git and external actions

Use descriptive `codex/<short-name>` branches from latest verified `main`, unless continuing an existing branch or directed otherwise; target PRs at `main`. `dev` is retired. Preserve unrelated work and do not restore historical promotion/backflow steps.

Pushes, PR writes and other external writes need explicit authorization. Ready, merges, tags, releases, force pushes, remote branch deletion and repository visibility/security/permission changes require explicit authorization for that action. Never bypass branch protection or required checks. Ordinary code merges do not publish; release/version operations follow the [release guide](docs/maintenance/RELEASE.md). Implementation or version proposals do not authorize merging a release PR.

## Verification and handoff

- Choose local checks by affected behavior and risk; batch related checks and pushes. Prose-only edits need format, link and diff checks, not application builds or Electron E2E. Run full `verify` when warranted or requested; it must not rewrite tracked files or invoke installation, packaging, release, migrations or live AI.
- Avoid busy CI polling and gratuitous reruns. Recheck when new evidence or a meaningful state change warrants it; diagnose failures before rerunning. Do not weaken tests or required checks to save time, and never report skipped or unavailable checks as passing.
- Review the complete diff for scope, correctness and safety. Use the [PR template](.github/pull_request_template.md) as a starting point: explain the problem, change and checks; requirement IDs are optional references. Add focused design/decision evidence for material semantic, data, security or architecture changes, and update only affected documentation.
- Report actual results against the tested revision, separating local, hosted and manual evidence. State remaining risks, skipped checks and environment limits clearly; unperformed manual acceptance stays pending. Formal independent review and stage records apply only when requested or explicitly activated.

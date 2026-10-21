# MyTracer Agent Instructions

## 1. Project overview

MyTracer is a local-first Windows desktop application for personal goals, actions, routines, and records, with optional AI help to get started. It uses Electron, React, TypeScript, Vite, and SQLite through `better-sqlite3` in Main. Work centers on real use, maintenance, and requested improvements; the project owner controls product decisions and final acceptance.

## 2. Scope and workflow activation

- Follow the owner's current request. Explanation, review, diagnosis, and planning authorize inspection and reporting; implementation requires a request to change something. Preserve unrelated local changes.
- Do not autonomously continue or recreate historical stages, Txxx contracts, task graphs, Automation Profiles, evidence closeout, or release handoffs. Ordinary requests to implement, fix, design, review, or validate do not activate these processes, regardless of change size.
- Use a stage Skill and its workflow only when the owner explicitly invokes it or requests that named workflow for the current work. Reading old plans, contracts, task indexes, evidence, or unfinished items does not activate them or restore their permissions.
- An activated workflow may continue within the same authorized work until completion or cancellation; it does not extend to new work. Ordinary requests need no Txxx ID, contract, formal escalation document, or stage closeout approval.
- When scope or authority is unclear, stop only the affected action, explain the concrete issue, and continue independent authorized work.

## 3. Read only what the request needs

Start with relevant current code, tests, and configuration. Consult these sources as needed:

| Subject | Source |
| --- | --- |
| Product behavior and acceptance | [Product requirements](docs/PRODUCT_REQUIREMENTS_V0.1.md), [decisions](docs/DECISIONS.md), then [change policy](docs/REQUIREMENTS_CHANGE_POLICY.md), in that authority order |
| Architecture and approved engineering choices | Use the [architecture reading entry](docs/architecture/README.md) to select relevant technical documents |
| Running, testing, packaging, or operating the app | [Maintenance entry](docs/MAINTENANCE.md); exact commands and locked versions are in `package.json` and `package-lock.json` |
| Specific Git, CI, integration, or release procedures | [GitHub workflow](docs/implementation/GITHUB_WORKFLOW_V0.1.md) |

Do not traverse the whole baseline or historical records for unrelated work. Architecture and execution documents cannot change frozen product semantics; report conflicts rather than silently choosing. Files under `user/` are explanatory material, not requirements or development authority; report drift against the normative sources.

## 4. Safety and authorization

- Keep Renderer UI-only, without Node, SQL, filesystem, credential, or provider access. Preload exposes concrete typed APIs with runtime input and sender/origin validation; never expose `ipcRenderer` or arbitrary channels.
- Keep Domain independent of Electron, React, SQLite, and concrete AI SDKs. Mutations go through Application commands and Domain invariants; queries remain read-only.
- Preserve `unknown`, `not_done`, `intentional_rest`, `acted`, and `target_met`. Missing records do not imply failure; partial action does not imply completion. Use explicit local occurrence dates and factual statistics.
- Preserve history on pause/end. Hard deletion requires the approved impact preview, confirmation, transaction, cascade, and detach behavior.
- Keep AI user-triggered, minimal-context, replaceable, and degradable. Suggestions remain temporary until user confirmation invokes a normal application command. Core functions must work without a live provider.
- Tests, fixtures, demos, and migrations must not touch real user data; use isolated temporary databases/data roots, fake clocks for date boundaries, and fake providers for routine tests. Live-provider tests need separate approval.
- Never expose real credentials in source, logs, fixtures, databases, exports, screenshots, or worktrees. Export excludes credentials, AI drafts, and technical logs.

Owner approval is required for changes to frozen product/acceptance semantics, deferred features, dependency additions/upgrades, destructive or irreversible migrations, and expanded AI context, persistence, provider permissions, or write authority. Historical approvals are not standing authorization for new changes.

The current request may authorize necessary local branch/worktree and commit operations without a contract; do not ask again for authority already granted. Start descriptive `codex/<short-name>` branches from the latest verified `main` unless the owner specifies another source, and target PRs at `main`. `main` is the accepted maintenance baseline; published versions are identified separately by tags, Releases, exact source revisions, and published assets. Ordinary code merges do not publish; an owner-authorized merge of a Release Please release PR is the decision that starts that version’s automated build and publication. `dev` is retired as an integration target; do not recreate it or restore promotion/backflow steps from historical workflows. Pushes, PR writes, and other external writes need explicit authorization. Ready, merges into `main`, tags, releases, force pushes, and remote branch deletion require explicit owner authorization for the action; never bypass branch protection or required checks.

## 5. Validation and handoff

Before creating or updating a PR, read `.github/pull_request_template.md` and use it as the starting point. Match detail to the change; remove unused headings and prompts, and combine sections for simple changes. Add stage-specific fields only when the owner explicitly requires that workflow.

- Choose validation and regression checks by affected behavior and risk; add or update tests where useful. Prose-only changes do not require application builds or Electron E2E. Run `verify` when full application verification is warranted or explicitly required; it must not rewrite tracked files or invoke installation, packaging, release, migrations, or live AI.
- Review the complete diff for correctness, safety, scope, and accidental changes. Separate independent review and formal task/evidence records apply only when the owner or an explicitly activated workflow requires them.
- Report the result, changed files, actual checks, and material risks or gaps concisely. Bind validation claims to the tested revision or identified uncommitted state; distinguish local, hosted, and manual results. Unperformed manual acceptance stays pending. Update affected documentation without rewriting historical acceptance records as routine closeout.

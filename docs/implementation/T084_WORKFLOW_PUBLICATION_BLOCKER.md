# T084 — Workflow publication credential blocker

> 2026-10-03，执行通信记录。只阻断普通 push、Draft PR 和 hosted CI；本地实现与离线验证继续。不是新增权限来源。

```yaml
type: permission_change
task: T084
blocking: true
problem:
  summary: Existing GitHub OAuth credential cannot publish workflow files
  observed_behavior: GitHub rejected normal task-branch push because OAuth lacks workflow scope; configured SSH fallback also failed
observed_at:
  branch: task/T084-private-release-acceptance
  revision: 9bea209
  working_tree_state: clean-at-first-push
current_authority:
  contract: docs/implementation/T084_RELEASE_PIPELINE_STAGE_ACCEPTANCE.md
  stage_design: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
  architecture: [docs/implementation/GITHUB_WORKFLOW_V0.1.md]
  requirements: [docs/PRODUCT_REQUIREMENTS_V0.1.md]
  decisions: [docs/DECISIONS.md]
conflict:
  current_rule_or_assumption: Owner authorized normal task push and Draft PR with new workflows
  incompatible_condition: Existing authentication cannot write workflow files
  evidence: git push -u origin task/T084-private-release-acceptance exit 1; SSH fallback exit 1
proposed_change:
  summary: Owner configures a repository-appropriate Git credential able to publish workflows, or performs the push
  alternatives:
    - alternative: Continue authorized local implementation until credential is available
      tradeoff: No early hosted CI or Draft PR until publication succeeds
affected:
  tasks: [T084]
  files: [.github/workflows/update-candidate.yml, .github/workflows/update-publish.yml]
  interfaces: [task-branch-publication]
risk:
  product_semantics: none
  data_safety: none
  integration: No remote task branch confirmed from failed pushes
  evidence: Local tests do not substitute for hosted CI
safe_work_completed:
  - First meaningful release-provenance/candidate checkpoint committed
  - Offline release tests 53 passed; lint/typecheck/format passed
minimum_owner_decision:
  - Provide working workflow-capable Git authentication without sending credentials in chat, or push the branch personally
recommended_resume_point: Verify remote dev/head and local task state before retrying the same normal task push; no force push
```

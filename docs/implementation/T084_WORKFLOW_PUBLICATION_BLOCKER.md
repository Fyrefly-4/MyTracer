# T084 — Workflow publication credential blocker

> 2026-10-03，历史执行通信记录；2026-10-05 确认该认证阻塞已解决。下面 YAML 保留发现时失败，不表示当前仍阻塞。不是新增权限来源。

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

## 后续解决与证据

后续普通任务分支 push 成功，Draft PR [#60](https://github.com/Fyrefly-4/MyTracer/pull/60) 建立并取得 hosted CI。当前验证候选 `f9e88a12038d3528dce067fa9828dae534a0bcbc` 的 candidate run `37313214100` 与 Verification run `37313214062` 均 `completed/success`，已只读核实对应 PR head；历史 push/SSH 失败保留，不改记为成功，不使用 force push。

任务发布认证不等于客户端 Contents-read PAT，不扩大 token 权限或将认证值写入证据。Owner 于 2026-10-05 批准文档收尾与最后一次普通推送；新文档 head 的 CI 是新的集成门槛，结果在 PR 交接，不用候选绿灯替代。未授权 Ready、merge、main 或新的 tag/Release。

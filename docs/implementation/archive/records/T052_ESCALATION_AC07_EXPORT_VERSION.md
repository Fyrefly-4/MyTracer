# T052 Escalation Proposal：AC-07 export v2 回归断言

> 历史归档（2026-10-11）：正文状态、失败和权限按原记录日期理解，不作为当前任务状态或新授权。导航见[归档索引](../INDEX.md)。

```yaml
type: contract_scope_change
task: T052
blocking: true
decision: approved
approved_on: 2026-08-30

problem:
  summary: T052 export v2 使 AC-07 E2E 的历史 exportVersion v1 断言失效，但该测试文件不在合同精确允许列表中。
  observed_behavior: npm.cmd run test:e2e 的 20 个用例中 18 passed、1 failed、1 skipped；唯一失败为 tests/e2e/ai-data-capability.e2e.test.ts 仍期望 exportVersion 1，实际正确返回 2。

observed_at:
  branch: task/T052-review-result
  revision: 5f59598564a733a8c6515495fd6b54306ab32466
  working_tree_state: clean

current_authority:
  contract: docs/implementation/T052_REVIEW_RESULT.md
  stage_design: docs/architecture/S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md
  architecture:
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md

conflict:
  current_rule_or_assumption: T052 合同要求 export v2、AC-07 受影响回归和 npm.cmd run verify 通过，同时规定实现需要允许列表外文件时必须停止并申请范围变更。
  incompatible_condition: tests/e2e/ai-data-capability.e2e.test.ts 不在第 5.2 节允许文件列表；不修改则全量 E2E/verify 必然因旧版本断言失败，修改则超出当前精确文件权限。
  evidence: npm.cmd run test:e2e at task/T052-review-result@5f59598564a733a8c6515495fd6b54306ab32466

proposed_change:
  summary: 仅把 tests/e2e/ai-data-capability.e2e.test.ts 加入 T052 允许文件，并将一个 exportVersion 期望从 1 机械更新为 2；不改变测试流程、AI 语义或其他断言。
  alternatives:
    - alternative: 保留旧断言并排除该测试
      tradeoff: 无法满足合同要求的 AC-07 回归与 aggregate verify，不推荐。
    - alternative: 让生产 API 对 v2 文件谎报 exportVersion 1
      tradeoff: 违反严格版本判别与数据契约，禁止。

affected:
  tasks:
    - T052
  files:
    - docs/implementation/T052_REVIEW_RESULT.md
    - tests/e2e/ai-data-capability.e2e.test.ts
  interfaces:
    - CompleteExportResult.exportVersion test expectation only

risk:
  product_semantics: none
  data_safety: none
  integration: 机械更新后必须重跑完整 E2E、verify 和 diff review。
  evidence: 当前失败必须保留，后续成功以 supersedes 关联。

safe_work_completed:
  - ReviewResult Domain/Application、原子 next-step resolution、SQLite v3 migration、Repository、IPC/Preload、Renderer 和 export v2 已实现。
  - T052 定向 Unit 28/28、Integration 48/48、Electron E2E 7/7 通过。
  - 全量 Unit 186/186、Integration 109/109 通过。
  - 全量 E2E 除该旧断言外 18 passed；Windows package smoke 按既有条件 skipped。
  - metadata、lint、typecheck 通过；format:check 的两个旧行格式告警已修正并复核通过。

minimum_owner_decision:
  - approve
  - reject
  - defer
  - provide-alternative

recommended_resume_point: 若批准，先同步 T052 合同第 5.2 节，机械更新唯一旧断言，重跑完整 E2E 与 npm.cmd run verify，再继续完整 diff/独立 review、evidence、英文 Draft PR；推送 PR 后立即停止且不查询 CI。
```

## Resolution

项目所有者于 2026-08-30 明确批准 proposed_change。T052 从该升级点恢复；批准范围仅包含合同允许列表更新和 AC-07 的单一 `exportVersion: 1` → `exportVersion: 2` 断言更新。

# T031 Escalation Proposal 002

```yaml
type: contract_scope_change
task: T031
blocking: false

owner_decision:
  decision: approve
  decided_at: 2026-08-20
  authority: project-owner
  exact_scope: >-
    仅在 tests/e2e/shell.e2e.test.ts 的 window.myTracer 顶层键期望末尾增加
    'dataControl'；不授权其他文件、行为、migration、依赖或权限扩展。

problem:
  summary: >-
    获批同步 shell E2E 的 schemaVersion v2 断言后，定向重跑继续暴露同一测试中的
    顶层可信 API 列表仍缺少 T031 已批准并实现的 dataControl 固定 API。
  observed_behavior: >-
    在 task/T031-record-data-control@3758e49a2fd4d71ce641c5a54e9ab706702f1479
    加上尚未提交的已批准 schemaVersion 断言修正后，
    npm.cmd run test:e2e:run -- tests/e2e/shell.e2e.test.ts 到达第 62 行并失败：
    期望顶层键为 shell/goals/actions/today/records/progress/routines，实际还包含 dataControl。

current_authority:
  contract: docs/implementation/T031_RECORD_DATA_CONTROL.md
  prior_escalation: docs/implementation/T031_ESCALATION_PROPOSAL_001.md
  prior_owner_decision: >-
    2026-08-20 仅批准把 shell.e2e 加入范围并将 schemaVersion 期望从 '1' 改为 '2'；
    明确未授权其他测试行为变化。

conflict:
  current_rule_or_assumption: >-
    T031 固定实现契约要求暴露窄且冻结的 window.myTracer.dataControl；shell E2E 以精确列表
    验证 Renderer 只获得批准的顶层 API，但该列表仍停留在 T031 之前。
  incompatible_condition: >-
    保持旧列表会把获批 dataControl API 判为越权；把 dataControl 加入列表又超出已批准的
    “仅 schemaVersion 断言”范围。
  local_result: exit 1; one E2E failed at tests/e2e/shell.e2e.test.ts:62

proposed_change:
  summary: >-
    仅在 tests/e2e/shell.e2e.test.ts 的 window.myTracer 顶层键期望末尾增加 'dataControl'；
    不改变生产代码、API 方法、测试流程、migration、依赖或其他断言。
  alternatives:
    - alternative: 删除精确顶层 API 列表断言
      tradeoff: 会削弱 Renderer 权限边界回归，不建议。
    - alternative: 从 preload 移除 dataControl
      tradeoff: 会破坏已批准 T031 纵向路径，不可采用。

affected:
  tasks:
    - T031
  files:
    - docs/implementation/T031_RECORD_DATA_CONTROL.md
    - tests/e2e/shell.e2e.test.ts
  interfaces:
    - window.myTracer top-level allowlist assertion only

risk:
  product_semantics: none
  data_safety: none
  integration: 最小；仅同步已批准 preload 窄接口的测试期望。
  evidence: 未批准前不能提交该断言、不能声明 shell E2E 或完整 verify 通过。

safe_work_completed:
  - Hosted CI 失败已确认：run 32225839159 / job 95985249108 的 schemaVersion 1→2 断言失败。
  - Escalation 001 的已批准合同记录和 schemaVersion 断言修正已完成但尚未提交。
  - 格式检查通过；定向 build 通过；首次受限环境崩溃不作为功能结论。

minimum_owner_decision:
  - approve
  - reject
  - defer
  - provide-alternative

recommended_resume_point: >-
  已获批准；仅向 shell E2E 顶层键期望追加 'dataControl'，然后重跑该 E2E、完整
  verify、diff review 与 candidate CI。
```

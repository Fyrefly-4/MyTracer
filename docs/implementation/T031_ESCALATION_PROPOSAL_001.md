# T031 Escalation Proposal 001

```yaml
type: contract_scope_change
task: T031
blocking: false

owner_decision:
  decision: approve
  decided_at: 2026-08-20
  authority: project-owner
  exact_scope: >-
    仅把 tests/e2e/shell.e2e.test.ts 加入 T031 允许测试范围，并将其唯一
    schemaVersion 期望从 '1' 改为 '2'；不授权其他文件、行为、migration、依赖或权限扩展。

problem:
  summary: 聚合 verify 发现 shell E2E 仍断言 schemaVersion 1，但 T031 合同未允许修改该文件。
  observed_behavior: >-
    在 task/T031-record-data-control@ba100d2af298ac80d076d86acc14b1cae7aa69f3
    执行候选 npm.cmd run verify 时，120 个 unit、68 个 integration 和其余 10 个可执行
    E2E 通过；tests/e2e/shell.e2e.test.ts:140 预期 metadata.schemaVersion='1'，
    实际按获批 002 migration 正确为 '2'，导致 verify exit 1。

observed_at:
  branch: task/T031-record-data-control
  revision: ba100d2af298ac80d076d86acc14b1cae7aa69f3
  working_tree_state: uncommitted-2026-08-19T14:53:00+08:00

current_authority:
  contract: docs/implementation/T031_RECORD_DATA_CONTROL.md
  stage_design: docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
  architecture:
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md

conflict:
  current_rule_or_assumption: >-
    T031 第 6 节允许修改 tests/e2e/data-control.e2e.test.ts、
    tests/e2e/routine-record.e2e.test.ts 和 tests/e2e/windows-package-smoke.e2e.test.ts，
    但未列入 tests/e2e/shell.e2e.test.ts；任务同时要求 schemaVersion 2 且 npm.cmd run verify 通过。
  incompatible_condition: >-
    不修改 shell E2E 就无法让其已过期的版本断言与获批 v2 schema 同时成立；
    修改它又需要项目所有者批准合同文件范围扩展。
  evidence: .tmp/evidence/T031-task-candidate-ba100d2af298-20260819065126.json

proposed_change:
  summary: >-
    仅把 tests/e2e/shell.e2e.test.ts 加入 T031 测试允许范围，并把唯一的
    schemaVersion 预期从 '1' 改为 '2'；不改变测试流程、产品语义、migration 或依赖。
  alternatives:
    - alternative: 在 verify 中排除 shell E2E
      tradeoff: 会削弱既有聚合回归且违反 T031 已批准的 verify 完成条件，不建议。
    - alternative: 继续保留版本 1 预期
      tradeoff: 与已批准 schemaVersion 2 直接矛盾，不可采用。

affected:
  tasks:
    - T031
  files:
    - docs/implementation/T031_RECORD_DATA_CONTROL.md
    - tests/e2e/shell.e2e.test.ts
  interfaces:
    - SQLite metadata.schemaVersion E2E assertion only

risk:
  product_semantics: none
  data_safety: none
  integration: 最小；仅同步已批准 migration 后的测试期望。
  evidence: 未批准前候选 verify 保持失败，不能声明 Implementation Candidate 通过。

safe_work_completed:
  - 精确 002 migration、v1→v2 守恒、失败回滚与 provenance 已实现并通过定向及完整 integration。
  - Record 修改/补记、子事实转换、五类删除预览/token/stale/事务回滚纵向路径已实现。
  - T031、AC-01、AC-03、AC-04 受影响 E2E 共 5 项通过。
  - 实现提交 43507e1 和补充测试提交 ba100d2 已保留；失败 evidence 未删除。

minimum_owner_decision:
  - approve
  - reject
  - defer
  - provide-alternative

recommended_resume_point: >-
  已获批准；在当前任务分支更新 T031 合同允许文件清单和 shell E2E 的单一版本断言，
  提交后重新运行 metadata gate、完整 verify、diff review 与 candidate CI。
```

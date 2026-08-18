# MyTracer Escalation Proposal 模板

> 用途：当任务遇到需要新 authority 的冲突、阻塞或范围变化时，记录可恢复、可交接、可审计的停止状态。
>
> 本模板不是需求、产品决定、架构基线或权限授权来源。

## 使用规则

发现问题后：

1. 停止受影响的实现或集成步骤。
2. 保留已经完成的安全工作。
3. 记录实际 branch、revision、命令、测试和证据。
4. 填写本提案并等待项目所有者或其他有效 authority 的决定。
5. 未获得新 authority 前，不重写架构、不扩大合同、不修改邻近任务、不添加依赖或 migration。

## Proposal

```yaml
type: requirement_conflict
# requirement_conflict | architecture_change | contract_scope_change
# dependency_change | migration_change | permission_change
# integration_conflict | testability_problem | evidence_problem | baseline_drift

task: Txxx
blocking: true

problem:
  summary: 当前问题的简短描述
  observed_behavior: 实际观察到的行为、命令结果或冲突

observed_at:
  branch: task/Txxx-short-name
  revision: abc123
  working_tree_state: clean | uncommitted-with-timestamp

current_authority:
  contract: docs/implementation/Txxx_....md
  stage_design: docs/architecture/Sx_....md
  architecture:
    - docs/architecture/....md
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md

conflict:
  current_rule_or_assumption: 当前适用的规则或合同内容
  incompatible_condition: 无法同时满足的条件
  evidence: EV-Txxx-001 / command / artifact

proposed_change:
  summary: 建议的最小变化
  alternatives:
    - alternative: 替代方案
      tradeoff: 影响和风险

affected:
  tasks:
    - Txxx
  files:
    - docs/architecture/....md
  interfaces:
    - IPC/DTO/Application/数据库表或其他受影响接口

risk:
  product_semantics: none | describe
  data_safety: none | describe
  integration: none | describe
  evidence: none | describe

safe_work_completed:
  - 已完成且不依赖新 authority 的工作

minimum_owner_decision:
  - approve
  - reject
  - defer
  - provide-alternative

recommended_resume_point:
  从哪个已验证步骤或 revision 恢复
```

## 收口要求

- owner 的决定必须关联到明确的合同、文档 revision 或后续任务。
- 若提案改变 PRD、DECISIONS、MUST、AC、延期项或产品语义，必须另行执行需求变更流程。
- 若后续成功解决该问题，保留本提案和失败证据，并在新 Evidence 中建立 `supersedes` 关系。

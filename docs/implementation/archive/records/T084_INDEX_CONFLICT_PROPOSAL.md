# T084 Escalation Proposal — 任务索引同步冲突

> 历史归档（2026-10-11）：正文状态、失败和权限按原记录日期理解，不作为当前任务状态或新授权。导航见[归档索引](../INDEX.md)。

> 执行通信记录；2026-10-03。发现时按 AGENTS.md §6.2 停止受影响索引/集成操作，保留安全的合同与部署方案准备。以下 YAML 保留发现时事实；owner 后续明确要求解决冲突，按推荐最小方案保留上游全部任务记录和 T083 done，仅同步 T084 合同/激活行，已清除冲突标记。当前任务分支为 `task/T084-private-release-acceptance`，base=`de88b1877ba2cfc48f1e593bcfcb2007471a3fa3`；本步仅合同提交，不开始开发。

```yaml
type: integration_conflict
task: T084
blocking: true
problem:
  summary: 更新到 T083 后 TASK_INDEX 出现未解决 stash 同步冲突
  observed_behavior: Updated upstream 保留 T083 done；Stashed changes 保留旧 T083 pending 和新增 T084 draft 链接
observed_at:
  branch: dev
  revision: de88b1877ba2cfc48f1e593bcfcb2007471a3fa3
  working_tree_state: uncommitted-with-conflict-2026-10-03
current_authority:
  contract: docs/implementation/T084_RELEASE_PIPELINE_STAGE_ACCEPTANCE.md
  stage_design: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
  architecture: [docs/implementation/GITHUB_WORKFLOW_V0.1.md]
  requirements: [docs/PRODUCT_REQUIREMENTS_V0.1.md]
  decisions: [docs/DECISIONS.md]
conflict:
  current_rule_or_assumption: TASK_INDEX 是唯一状态账本且不得改写其他任务真实状态
  incompatible_condition: 索引有重复任务表和冲突标记，当前不能安全校验或激活同步
  evidence: git status --short 返回 UU；rg 检出第55/97/139行冲突标记
proposed_change:
  summary: 保留 Updated upstream 全部任务行和 T083 done，仅将 T084 行替换为已批准合同链接及激活的实际执行点，再标记冲突已解决
  alternatives:
    - alternative: owner 自行完成索引冲突解决
      tradeoff: 本 Agent 保留合同/方案并等待干净状态
affected:
  tasks: [T084]
  files: [docs/implementation/TASK_INDEX_V0.1.md]
  interfaces: []
risk:
  product_semantics: none
  data_safety: none
  integration: 索引未解决前不建分支或执行实现
  evidence: metadata 校验不能替代真实状态和冲突解决
safe_work_completed:
  - 核对本地 HEAD 已含 T083
  - 同步独立合同的批准/激活记录及 T083 集成事实
  - 编写真实源演练和部署具体提案，未执行外部写入
minimum_owner_decision:
  - 批准上述精确索引冲突解决，或 owner 自行处理
recommended_resume_point: 冲突解决后检查完整 diff/metadata、确认任务 Git 权限和测试环境，再从 preflight 开始
```

# 文档事实校准：里程碑祖先关系差异

> 2026-10-11；执行通信记录，不是需求、架构决定或 Git 写入授权。本次文档修复已由 owner 明确要求执行；实际分支历史处置暂不执行。

## Proposal

```yaml
type: baseline_drift
task: documentation-fact-calibration
blocking: false

problem:
  summary: PR 62 的 main 晋升形成单父提交，没有保留源 dev 的祖先关系
  observed_behavior: main 与源 dev 内容树相同，但 merge-base --is-ancestor 返回 1

observed_at:
  branch: codex/docs-fact-calibration
  revision: 93fc14c1edfc93dafdb9357204dae08c349a8734
  working_tree_state: uncommitted-documentation-repair-2026-10-11

current_authority:
  contract: owner 2026-10-11 全部执行文档修复的指令，不采用开发技能重流程
  governance: docs/implementation/GITHUB_WORKFLOW_V0.1.md
  requirements: docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions: docs/DECISIONS.md

conflict:
  current_rule_or_assumption: GW-005/GW-006 要求 dev 到 main 使用 merge commit，保持源 dev 是 main 祖先
  incompatible_condition: PR 62 实际 main 只有一个父提交，不能记作符合该规则
  evidence: EV-DOC-CALIBRATION-001

proposed_change:
  summary: 保留历史，另行审阅普通 merge 同步方案；执行仍需 owner 针对具体 PR 授权
  alternatives:
    - alternative: 下次晋升前从 main 向 dev 建立普通 merge 同步，再以 merge commit 晋升
      tradeoff: 恢复后续共同祖先，但要审查冲突与完整差异并重跑受影响验证
    - alternative: 保留当前分歧，下一次晋升直接审查完整范围并使用 merge commit
      tradeoff: 可能重复显示历史差异，需防止把旧改动误认作新增交付

affected:
  tasks: [future-milestone-integration]
  files: [docs/implementation/GITHUB_WORKFLOW_V0.1.md]
  interfaces: [Git ancestry and integration freshness]

risk:
  product_semantics: none
  data_safety: 本次未访问数据库或执行 migration
  integration: 内容树相同不代表祖先关系，可导致重复比较与 freshness 误判
  evidence: 不使用 squash 后 SHA 替换原 task 或 product source

safe_work_completed:
  - 文档中明确记录实际 PR、revisions、CI 与历史差异
  - 不执行 reset、rebase、force-push、同步或 main 写入

minimum_owner_decision:
  - 若需要实际恢复祖先关系，另行批准准确同步 PR 和 merge 方式

recommended_resume_point:
  - 下一次集成前重新查询 main/dev，检查 merge-base、父提交与完整 diff
```

## 观察命令与结果

- `git show -s --format='%h parents=%p %s' 9766760`：只有父提交 `eae7872`。
- `git rev-parse 'main^{tree}'` 与 `git rev-parse '69c7f56^{tree}'`：均为 `16e3871b2da387b1a7f5ae26b1975e3e28daba0f`。
- `git merge-base --is-ancestor 69c7f56 main`：exit 1；`git merge-base dev main`：`a37c0eb00d4e3675769ba5e291133de341bfe517`。
- GitHub 插件只读核验 [PR #62](https://github.com/Fyrefly-4/MyTracer/pull/62) 已合并；源 `69c7f566fa90d667d5c81cfe983e3d3ee09df39a`，main 结果 `97667606d1f21bbcece7705387cb1929d9ca6d47`。里程碑 CI 成功不改变 Git 的实际父提交。

本记录不猜测 owner 是否曾在其他会话批准例外，也不追认新的合并规则。当前文档修复可完成；实际历史处置须在新的精确授权下执行。

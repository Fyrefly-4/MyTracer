# T804 长期文档事实统一收口任务合同

> 任务类型：纯文档事实审计与治理收口
> 任务状态：**done**
> 项目所有者授权日期：2026-08-23
> 固定基线：`origin/dev@eec093924ae061876805c657742283097824df2c`
> 分支：`docs/T804-factual-closeout`

## 1. 任务信息与结果

- **Task ID**：T804
- **Title**：Reconcile durable milestone and repository facts
- **Slice / Plan item**：GOV-03
- **Status**：done
- **Base / branch**：`dev` / `docs/T804-factual-closeout`

调查 tracked 长期文档与 Git/GitHub 真实状态之间的事实漂移，统一收口 T803、S0～S3 里程碑、tag/release、Actions、rulesets 和剩余配置缺口。保留历史审批、失败与 candidate 时间线，不再以当前事实口吻声称已经完成的动作仍待执行。

## 2. 依据与依赖

- **FR / AC / D / ED**：不适用；本任务不改变产品或验收语义。
- **授权依据**：项目所有者 2026-08-23 对 T804 计划的明确实施授权；GW-001、GW-002、GW-004、GW-008～GW-010；`AGENTS.md` 的事实证据、任务合同和文档收口规则。
- **前置**：T803、T091；PR #29 已合入 `dev@eec0939...`，PR #30 已合入 `main@75e51b4...`，`v0.1.0-beta.1` 已发布。
- **共享面**：任务账本、Evidence、S0～S3 归档、长期状态说明和 GitHub 配置快照；串行修改。

## 3. 允许修改范围

- `README.md`
- `docs/architecture/IMPLEMENTATION_PLAN_V0.1.md`
- `docs/architecture/S1_CORE_LOOP_DESIGN_V0.1.md`
- `docs/architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md`
- `docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md`
- `docs/implementation/T804_DOCUMENT_FACT_CLOSEOUT.md`
- `docs/implementation/T803_S3_FINAL_ACCEPTANCE.md`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/GITHUB_WORKFLOW_V0.1.md`
- `docs/implementation/archive/S0_T001_T004_ARCHIVE.md`
- `docs/implementation/archive/S1_T011_T014_ARCHIVE.md`
- `docs/implementation/archive/S2_T021_T023_ARCHIVE.md`
- `docs/implementation/archive/S3_T031_T033_ARCHIVE.md`
- `docs/implementation/metadata/T804.json`

## 4. 明确非范围与不变量

- 不修改 PRD、DECISIONS、需求变更政策、`AGENTS.md`、Agent skill、`user/`、产品代码、测试、依赖、lockfile、schema、migration 或 `.github/workflows/verify.yml`。
- 不创建 PR template 或 GitHub Milestone，不修改 rulesets、Actions、仓库设置、tag/release，不开始 T041。
- 当前任务状态只由任务索引维护；README 和设计文档只保留耐久里程碑或明确标注的历史上下文。
- 历史失败、partial、人工限制和批准时权限事实不得删除；最终声明必须绑定实际 revision、PR、CI 与 release。
- ruleset 与 classic branch protection API 必须明确区分；配置缺口不得写成已完成。

## 5. 交付与验收

1. T803、S0～S3 main 里程碑及 alpha/beta releases 在所有 tracked 当前状态区一致。
2. `EV-G3-S3-001` 原位更新为最终 `pass`，同时保留 pre-merge candidate/partial 时间线。
3. 新增 `EV-T804-001`，只证明文档事实审计、验证、review 和 CI，不重新证明产品行为。
4. GitHub 工作流文档准确记录 Actions、active rulesets、required gate、触发范围、缺失 PR template、缺失 main 专用增强 CI 和空 GitHub Milestones。
5. 完整 diff 仅含允许文档；独立 review 无未解决重大问题；candidate 与 final-head hosted CI 均通过。

## 6. 验证计划

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
git diff --check
git grep -n -I -E 'T803.*(等待|待完成|尚待|Draft|review)|当前.*(未配置|没有证据)|owner merge pending' -- '*.md' ':!user/**'
```

另执行只读 GitHub 复核、完整 diff/scope 检查和只读子代理独立 review。文档任务不在本地重复 package、NSIS 或产品人工验收；Draft PR 的 `Windows required gate` 提供 aggregate CI。

## 7. Git、GitHub 与外部权限

```yaml
permissions:
  local_write: true
  create_worktree: true
  create_task_branch: true
  create_commit: true
  push_task_branch: true
  create_or_update_draft_pr: true
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: true
integration:
  target_branch: dev
  base_revision: dev@eec093924ae061876805c657742283097824df2c
  freshness_required: true
  affected_regression_required: false
  task_delivery_revision: 1610aaefb26d38a9fabad75402d8aaa5fc28192d
  dev_integration_revision: null
  stage_final_integration_revision: null
```

- **网络/外部写入**：GitHub 只读查询；推送 `docs/T804-factual-closeout`；创建/更新其 Draft PR；读取 CI。
- **禁止**：Ready、任何 merge、tag/release、GitHub 配置写入或数据破坏操作。

## 8. 收口结果与后续门禁

- **Implementation Candidate / task delivery revision**：`1610aaefb26d38a9fabad75402d8aaa5fc28192d`；基于最新授权 `origin/dev@eec093924ae061876805c657742283097824df2c`，Integration Freshness 为 `fresh`。
- **独立复核**：只读 reviewer 检查完整 15 文件 diff、关键 GitHub 事实、历史/当前边界、授权范围和同类长期文档遗漏；P0/P1/P2/P3 均无 finding。
- **Candidate hosted CI**：Draft PR #31 run `32645711355` / job `97209543904` 的 `Windows required gate` 在精确 head `1610aaef...` 上 `success`；上传 artifact `verification-evidence-32645711355`，其中 `ci.headRevision` 为 candidate、`ci.mergeRevision` 为测试 merge `b787f729ef1a31968501ebb93f2c009c104fcf2d`。
- **Closeout 授权**：项目所有者于 2026-08-23 明确批准更新本合同、任务索引、`EV-T804-001`、Draft PR 正文并创建/push 独立 `docs: close T804 delivery records` 提交。
- **后续门禁**：closeout push 后的 final-head CI 与 Draft PR 最新状态记录在 GitHub；不得为只记录后续 CI 再制造仓库提交，且 Ready/merge 仍由项目所有者另行决定。

## 9. 停止条件与报告

GitHub 事实冲突、需要扩大文件/权限/语义、无法保留审计历史、freshness 无法证明或验证/review/CI 无法在范围内修复时停止受影响工作。

完成报告列出修改文件、T804/GW 覆盖、远端事实、命令与结果、branch/commit/PR/CI、独立 review、残余 GitHub 配置缺口、`user/` 排除，以及需求冲突或范围变化。

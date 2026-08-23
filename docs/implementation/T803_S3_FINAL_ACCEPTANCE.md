# T803 G3/S3 聚合验收与里程碑收口任务合同

> 任务类型：S3 聚合验收 / 文档与证据收口
>
> 任务状态：**review**
>
> 项目所有者授权日期：2026-08-23
>
> 固定 source：`origin/dev@8058f7a3c9db9d3b488e727dfd85201dc14f11a0`
>
> 分支：`docs/T803-s3-final-acceptance`

## 1. 任务信息

- **Task ID**：T803
- **Title**：G3/S3 aggregate acceptance and milestone closeout
- **Slice / Plan item**：S3 aggregate gate
- **Status**：review
- **Base branch**：`dev`
- **Expected branch**：`docs/T803-s3-final-acceptance`

## 2. 目标结果

在同一最新 `origin/dev` revision 上聚合证明 T031～T033、AC-07、AC-01/03/04 回归、Windows package smoke 和 S3 数据安全边界；只在全部门禁通过后收口任务状态、证据、README 与单篇 S3 归档，并创建 Draft PR 到 `dev`。该 PR 合入后才固定新的 `origin/dev` 并创建 `dev → main` 里程碑 PR。

## 3. 依据与引用

- **FR**：FR-D01～FR-D05、FR-L07、FR-R08、FR-AI06、FR-AI09；受影响 S1/S2 FR
- **AC**：AC-07；回归 AC-01、AC-03、AC-04
- **D**：D-003、D-004、D-008～D-016、D-101、D-103～D-109、D-111
- **ED/GW**：ED-003、ED-004、ED-008、ED-010～ED-019；GW-001、GW-002、GW-004～GW-010
- **直接相关架构章节**：S3 Design §3～§13；Test Strategy §2～§9

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#ac-07持久性与备份
  decisions:
    - docs/DECISIONS.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
  stage_design:
    - file: docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
      sections: ["§3-§13"]
  architecture:
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/AI_BOUNDARY_V0.1.md
  execution:
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
```

## 4. 开始条件与基线结论

- [x] 最新 `origin/dev` 为 `8058f7a3c9db9d3b488e727dfd85201dc14f11a0`。
- [x] T031、T032、T033 已分别由 PR #26、#27、#28 合入 `dev`。
- [x] 上次 `main` 里程碑以来的全部内容为 T090、T091、S3 设计、T031、T032、T033。
- [x] `origin/main` 与其历史 `dev@112b909` 内容树相同；没有 main-only 实际内容需要回流。
- [x] T090、T091、S3 设计均已批准、完成、合入且 hosted CI 通过。
- [x] 项目所有者明确授权本合同、独立 worktree/分支、文档写入、完整本地验收、commit、push 和 Draft PR。

```yaml
dependencies:
  tasks:
    requires: [T031, T032, T033, T090, T091]
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@8058f7a3c9db9d3b488e727dfd85201dc14f11a0
  shared_surfaces:
    - s3-delivery-evidence
    - task-status-ledger
    - milestone-release-notes
  external:
    - github-hosted-windows-ci
```

## 5. 允许修改范围

- `docs/implementation/T803_S3_FINAL_ACCEPTANCE.md`
- `docs/implementation/metadata/T803.json`
- `docs/implementation/metadata/T031.json`
- `docs/implementation/metadata/T032.json`
- `docs/implementation/metadata/T033.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/archive/S3_T031_T033_ARCHIVE.md`
- 保留 `T031_RECORD_DATA_CONTROL.md`、`T032_VERSIONED_COMPLETE_EXPORT.md`、`T033_AI_DATA_CAPABILITY_REGRESSION.md`；本次删除未获单独授权
- `README.md`
- Draft PR 正文

不修改 T031 escalation proposal；它们保留失败/扩围历史。若 metadata 仍需保留任务依赖，只更新合同文件引用和集成事实，不删除原始任务 sidecar。

## 6. 明确非范围

- 任何 `src/**`、`tests/**`、配置、workflow、依赖、lockfile、schema 或 migration 变化；
- 产品缺陷修复；失败时必须创建独立修复任务/PR；
- 修改冻结 FR/AC/D/ED、S3 决定、LocalDate、删除、导出或 AI 数据权语义；
- S4～S7、AC-02/05/06、自动导入/恢复、Provider、tag 或 Release；
- Agent 标记 Ready、合并 `dev`/`main` 或修改 GitHub 保护设置。

## 7. 必须保持的不变量

- 所有自动化使用唯一临时 SQLite、导出和 Electron `userData` 根；不接触真实用户数据或凭据。
- 删除预览/确认、事务回滚、LocalDate、Progress、完整导出和 AI 独立性语义不得因文档收口改变。
- 任务原始证据、失败 artifact、known limitations 和 supersede 关系必须保留。
- 聚合证据不能覆盖任务证据，也不能把 G3/S3 扩大为 G4 或 AC-02/05/06。
- 人工 AC-07 只能复用项目所有者已有报告；若最终分支改变用户可见行为或数据语义，必须重新由所有者执行。

## 8. 实施与验收范围

### 8.1 发布范围审计

记录 `origin/main...origin/dev` merge-base、全部提交、全部文件、PR #23～#28、post-merge CI 和 main-only 内容树结论。

### 8.2 自动化矩阵

在固定 source 和文档收口最终 head 上分别执行：

```powershell
npm.cmd run governance:metadata:check
npm.cmd run verify
npm.cmd run package
npm.cmd run test:package-smoke
```

另执行明确的 S3 定向命令，覆盖：

- T031 Domain/Application、SQLite、IPC 与 E2E；
- T032 envelope/校验器、SQLite snapshot、ExportPort 故障、IPC 与 E2E；
- T033 fake AI harness、三态 SQLite matrix 与 E2E-AC-07；
- migration、失败回滚、SQLite 重开；
- AC-01、AC-03、AC-04 E2E。

使用 evidence wrapper 绑定 T803 candidate/final-head 的真实 exit code 和 source revision；最终长期 Evidence 只记录已实际执行的命令。

### 8.3 人工 AC-07 绑定

项目所有者于 2026-08-22 报告人工 AC-07 `pass`。T033 candidate `502ed1a` 到最终任务分支只修改任务/证据文档，最终分支与 `dev` squash merge 内容完全相同；因此若 T803 继续只改文档且自动化通过，可在聚合证据中引用该人工结果，不新增或代签人工观察。

### 8.4 文档归档

仿照既有 S0～S2 归档，将 T031～T033 的最终范围、数据契约、交付 revision、PR、Evidence、批准、限制和原合同恢复命令收敛到 `archive/S3_T031_T033_ARCHIVE.md`。原合同继续保留在当前树与 Git 历史；若未来拟删除，必须取得对文件删除的单独明确授权。

## 9. 可判定完成条件

1. 固定 source 上 metadata、完整 `verify`、package smoke、S3 定向测试和 AC-01/03/04 全部通过。
2. T031 修改/补记/删除、T032 完整导出、T033 AI 三态行为逐项有实际自动化结果。
3. migration、SQLite 重开、导出故障、取消/stale/数据库失败零变化有实际结果。
4. 完整 diff 只含第 5 节文件；无生产、测试、依赖、配置或 migration 变化。
5. `EV-G3-S3-001` 绑定 source SHA、最终文档 revision、命令、artifact、hosted CI、人工 AC-07 和限制。
6. TASK_INDEX、Evidence、README、metadata 和归档不再把已合入的 T031～T033/T091 写成 pending 或未合入。
7. 最终 head 重新通过本地规定验证和 hosted Windows CI。
8. Draft PR 到 `dev` 已创建；Agent 不合并，等待项目所有者处理。
9. 收口 PR 合入后重新 fetch，固定新的 `origin/dev`，再创建 `dev → main` 里程碑 PR；该 PR 只等待所有者批准 merge commit。

## 10. Git、GitHub 与外部权限

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
```

- `external_write` 仅限推送 `docs/T803-s3-final-acceptance`、创建/更新 Draft PR 到 `dev`、读取/触发 CI 和上传脱敏 evidence artifact。
- 项目所有者合入 T803 后，本任务允许创建 `dev → main` 里程碑 PR；不允许 Agent 合并该 PR。
- 不允许 force-push、远端分支删除、Ready、Secrets、保护规则、tag 或 Release。

```yaml
integration:
  target_branch: dev
  base_revision: dev@8058f7a3c9db9d3b488e727dfd85201dc14f11a0
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: f5fd977bd32676cb617f3023091a20a40d72db70
  dev_integration_revision: null
  stage_final_integration_revision: null
```

## 11. 风险与停止条件

- 任一 T031/T032/T033、AC-07、AC-01/03/04、package smoke 或 hosted CI 失败；
- 最新 `origin/dev` 在验收中推进且未完成 freshness refresh；
- 需要修改业务代码、测试、配置、依赖、schema 或 migration；
- 人工 AC-07 无法绑定当前行为，或最终文档之外出现用户可见变化；
- main-only 实际内容、需求冲突、未批准任务或敏感数据泄漏被发现；
- 无法保留失败历史或无法证明最终 PR diff 的完整范围。

出现上述情况时不得宣布 G3/S3 通过；记录事实并等待独立修复或新授权。

## 12. 完成报告

报告最终 `dev` source SHA、全部里程碑任务、测试/CI/package/重开结果、Evidence ID、人工状态、文档变更、两级 PR、风险限制、merge/tag/Release 条件及冲突/范围变化结论。

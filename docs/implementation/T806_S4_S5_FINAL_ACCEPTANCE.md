# T806 S4/S5 Recovery 与 Review 聚合验收任务合同

> 任务类型：S4/S5 aggregate acceptance / documentation closeout / milestone preparation
>
> 合同状态：**active；项目所有者已批准并激活**
>
> 合同草案日期：2026-08-30
>
> 批准与激活日期：2026-08-30
>
> 固定产品 source：`origin/dev@84b596e12e54db098857004497a4d1964dcdc23c`
>
> 分支：`codex/T806-s4-s5-final-acceptance`

## 1. 任务信息

- **Task ID**：T806
- **Title**：S4/S5 Recovery and Review aggregate acceptance
- **Slice / Plan item**：S4/S5 final gate
- **Status**：`active`；项目所有者已明确批准合同全文并授权开始聚合验收
- **Base branch**：`dev`
- **Target branch**：`dev`
- **Expected branch**：`codex/T806-s4-s5-final-acceptance`
- **Prior milestone**：`main@54c198dca04bce84565174741b9a86577e4374db`

本任务号晚于 `EV-PRE-S4-FOUNDATION-001` 所记录的“不创建 T806”决定。该历史事实只描述当时的 S4 前聚合；本合同是项目所有者于 2026-08-30 另行指定的后续 S4/S5 聚合任务，不改写此前事实。

## 2. 目标结果

在一个固定的最新 `origin/dev` 产品 revision 上聚合证明 T041、T042、T051、T052 的 Recovery 与 Review 能力、AC-05/AC-06 连续路径、受影响既有 AC、Windows package、migration/export 和安全边界。全部门禁通过后，按另行批准的精确文档范围收口 Evidence、Task Index、README、metadata 和统一归档，并创建一个到 `dev` 的 Draft 收口 PR。

本任务不实现功能或修复。收口 PR 合入 `dev` 后，只准备 `dev → main` 里程碑 PR 所需事实和正文；创建该 PR、Ready、任何 merge、tag 和 Release 均须项目所有者另行批准。

## 3. 依据与追踪

- **Recovery**：FR-REC01～FR-REC06、FR-G03～FR-G05、FR-A01/A03/A06、FR-T04/T05、FR-P03/P04/P07/P08、AC-05。
- **Review**：FR-RV01～FR-RV06、FR-P01～FR-P04/P07/P08、FR-R04～FR-R09、FR-G05、AC-06。
- **持久与导出回归**：FR-D01、FR-D04、AC-07。
- **既有回归**：AC-01、AC-03、AC-04、AC-07。
- **产品决定**：D-002、D-004、D-007～D-010、D-105～D-107、D-110、D-111。
- **工程决定**：ED-004～ED-008、ED-012～ED-014、ED-016～ED-019。
- **明确非范围**：FR-P05/P06、FR-RV07、FR-D07、FR-AI11～FR-AI13、AC-02、S6、S7 和 G4 完成声明。

T042 在旧索引中的 `D-013` 只可用于温和、非评判表达；无固定停滞阈值的真实工程依据是 `ED-013`。T806 不借追踪纠正改变需求基线或任务历史。

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#ac-05中断后恢复
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#ac-06最小复盘
  decisions:
    - docs/DECISIONS.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
  stage_design:
    - file: docs/architecture/S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md
      sections: ["§2-§17"]
  architecture:
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
  execution:
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
```

## 4. 开始条件与固定基线

合同草案阶段已只读核实：

- [x] 本地工作树在创建合同前干净，分支基于 `origin/dev@84b596e12e54db098857004497a4d1964dcdc23c`。
- [x] 实时远端 `origin/main@54c198dca04bce84565174741b9a86577e4374db`。
- [x] `origin/main` 与 `origin/dev` 的 merge-base 为 `27485d0ab69eb84041c784c9a407b68fc304152b`；`origin/main` 与该 merge-base 内容树相同，无 main-only 内容漂移。
- [x] PR #39～#42 已分别合入 `dev`；四个 final task head 与对应 squash integration revision 的内容树相同。
- [x] PR #38 的设计文档及四个 PR context 治理配套文件由项目所有者确认纳入，不构成 T806 阻断。
- [x] 项目所有者于 2026-08-30 批准本合同并将 T806 从 `ready` 激活为 `active`。

| Task | Task delivery revision | Final task head | Dev integration revision |
|---|---|---|---|
| T041 | `1e9ab2b80b5b81a8bedd192750281d4042f279d5` | `64ac9dddd41413c22b0ec35f99ed9022d1555e25` | `695e7bcc25b33279d39e61e28a8730b9cdf16264` |
| T042 | `b323a9f629699cbec156723700c021151eaf1506` | `cc4c21c0559fcfc36d2b48b1649ce909225a632d` | `3f343b8af0216b5e568f2c8f1ed52ac4ef824da3` |
| T051 | `eccd00148ac6ca47f3215e03abffb98a732c2558` | `87b8654c5f33b1bb62452143ba7712c7a41324ac` | `3e5a14f1b5f90894e1e15a4b208aa5db254e7825` |
| T052 | `7aced4fa3146ebb5d0bcf28b7dbc81e5b40e2cb2` | `202983cef9c942e61b7a9d5e44db82ac59ec528d` | `84b596e12e54db098857004497a4d1964dcdc23c` |

```yaml
dependencies:
  tasks:
    requires: [T041, T042, T051, T052]
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@84b596e12e54db098857004497a4d1964dcdc23c
    required_main_base: main@54c198dca04bce84565174741b9a86577e4374db
  external:
    - github-hosted-windows-ci
```

本合同不采用 `standard-task@1` 或其他 Automation Profile。验收、文档 closeout 和发布准备完全受本合同的显式权限与项目所有者门禁约束。

## 5. 允许修改范围

合同获批激活后，只允许修改：

- `docs/implementation/T806_S4_S5_FINAL_ACCEPTANCE.md`
- `docs/implementation/metadata/T806.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `README.md`
- `docs/implementation/archive/S4_S5_T041_T052_ARCHIVE.md`
- `docs/implementation/metadata/T041.json`
- `docs/implementation/metadata/T042.json`
- `docs/implementation/metadata/T051.json`
- `docs/implementation/metadata/T052.json`
- 到 `dev` 的 T806 Draft PR 正文

只有在自动化、package、完整 diff 和独立 review 通过，且项目所有者批准精确 documentation impact matrix 后，才允许删除下列已完成合同：

- `docs/implementation/T041_RECOVERY_CONTEXT.md`
- `docs/implementation/T042_RECOVERY_RESTART.md`
- `docs/implementation/T051_REVIEW_SUMMARY.md`
- `docs/implementation/T052_REVIEW_RESULT.md`

必须保留 `docs/implementation/T052_ESCALATION_AC07_EXPORT_VERSION.md`、全部旧 Evidence、失败记录、known limitations 和 supersede 关系。

## 6. 明确非范围

- 任何 `src/**`、`tests/**`、`.github/**`、工具、配置、依赖、lockfile、schema、migration 或 export 实现变化。
- 在 T806 内修复产品、测试、migration、CI 或 package 缺陷。
- 修改冻结 FR/AC/D/ED、S4/S5 设计决定、Goal/Action/Routine/Record、五种 Routine 语义、LocalDate、删除、AI 或历史守恒语义。
- AI Provider、AI 总结、评分、掌握度、压力式 streak、推断失败、提醒、自动规划、自动导入恢复、S6、S7 或延期能力。
- Agent 标记 PR Ready、合并 `dev`/`main`、创建 `dev → main` PR、tag、Release、资产上传、ruleset 或 Secrets 变化。

发现必须修改生产、测试、配置、依赖或 migration 才能通过时，T806 必须停止，保留真实失败证据并提交 Escalation Proposal；不得在本分支静默修复。

## 7. 必须保持的不变量

- `stage_final_integration_revision` 是一个固定产品 revision；T806 文档 head、test-merge、后续 `dev` 文档 merge 和 `main` merge 不替代它。
- RecoveryContext 是零写入、单 Goal、无任意阈值的事实快照；未推进事实不等于失败或 Goal 状态变化。
- pause、end、Action transition、current-next 与 Today 都由用户明确确认；取消和失败保持零变化。
- Recovery 不补中断空白日，不改写任何历史 Record、Understanding、Confusion 或 LocalDate。
- Review Summary 只汇总当前事实；ReviewResult 只保存用户明确输入，不复制统计、不评价用户、不推断失败。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 始终分离。
- Review 下一步修改只有在用户确认时通过单一 Application transaction 执行；取消、stale、校验或存储失败全回滚。
- schema v3 migration 和 export v2/v1 兼容只接受 T052 已批准行为；不操作真实 `userData`，不修复或删除冲突旧行。
- Renderer 不访问 Node、SQLite、文件路径、凭据或 Provider；Preload/IPC 保持窄接口与 sender/origin 校验。
- 聚合 Evidence 只能补充任务 Evidence；不得覆盖失败、删除 pending、代签人工验收或把旧 CI 冒充最终聚合 CI。

## 8. 验收与审计范围

### 8.1 完整范围审计

- 记录 `origin/main...origin/dev` merge-base、两侧提交、完整 diff、依赖、migration、main-only 内容和 PR #38～#42。
- 对照设计、四份任务合同、metadata、Task Index、Evidence 和 GitHub 事实证明任务实际进入固定 `dev`。
- 检查无未批准任务、Provider、延期功能、依赖、额外 schema 或无依据产品语义。
- PR #38 的四个治理配套文件按项目所有者确认作为已批准非产品内容审计，不扩展产品范围。

### 8.2 Recovery / AC-05

- RecoveryContext 查询前后完整业务 snapshot 相同，事实可解释且无阈值。
- FakeClock 前进多日、完全关闭重开、无缺失日补行。
- pause/end/restart、existing/create-and-set、Today 独立选择和失败回滚都保持历史守恒。
- 连续 AC-05 在同一临时数据根完成；页面无断签、失败率、大量逾期、评分、掌握度、streak 或人格评价。

### 8.3 Review / AC-06

- 周一至周日 Summary 与 Progress 使用相同事实语义，五种 Routine 状态保持区分。
- 取消完整 snapshot 零变化；保存/编辑稳定 ID；可选下一步原子执行。
- 重开、Record 修正/删除后 Summary 重算而 ReviewResult 用户文本不变。
- v2→v3 migration、失败回滚、Goal detach、export v2 与保留 v1 validator 一致。
- 连续 AC-06 和 AC-05→AC-06 同数据库路径在固定 revision 完成。

### 8.4 人工证据绑定

- 项目所有者于 2026-08-29 报告完整人工 AC-05 `pass`。只有在最终审计证明 T042 后没有影响 Recovery 语义或体验的变化时，T806 才可作为明确推论复用；否则保持 `pending` 并请求重验。
- 项目所有者于 2026-08-30 报告完整人工 AC-06 `pass`。只有在 T052 task delivery 到 fixed stage source 的产品行为/内容树可证明一致时才可复用。
- T041/T051 的较窄人工结果继续保留，不被聚合结论改写。
- Agent 不执行、代签或升级人工结果。

## 9. 验证计划

以下命令只在项目所有者批准并激活本合同后执行。所有自动化使用 FakeClock、fake Provider 和每 case 唯一临时 SQLite、导出、Electron `userData` 与安装根。

### 9.1 定向 Unit

```powershell
npm.cmd run test:unit -- tests/unit/recovery-domain.test.ts tests/unit/recovery-application.test.ts tests/unit/review-domain.test.ts tests/unit/review-application.test.ts tests/unit/review-contexts.test.ts tests/unit/goal-domain.test.ts tests/unit/goal-application.test.ts tests/unit/complete-export.test.ts
```

### 9.2 定向 Integration

```powershell
npm.cmd run test:integration -- tests/integration/recovery-sqlite.test.ts tests/integration/recovery-ipc.test.ts tests/integration/review-sqlite.test.ts tests/integration/review-ipc.test.ts tests/integration/review-migration.test.ts tests/integration/goal-sqlite.test.ts tests/integration/goal-ipc.test.ts tests/integration/sqlite-persistence.test.ts tests/integration/complete-export-sqlite.test.ts tests/integration/system-export-adapter.test.ts tests/integration/data-control-sqlite.test.ts tests/integration/data-control-ipc.test.ts tests/integration/main-foundations.test.ts
```

### 9.3 定向 Electron E2E

```powershell
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/recovery-context.e2e.test.ts tests/e2e/recovery-restart.e2e.test.ts tests/e2e/review-summary.e2e.test.ts tests/e2e/review-result.e2e.test.ts tests/e2e/recovery-review-aggregate.e2e.test.ts tests/e2e/complete-export.e2e.test.ts tests/e2e/data-control.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

### 9.4 完整门禁与 package

```powershell
npm.cmd run governance:metadata:check
node tools/evidence/capture-command.mjs --task T806 --gate stage-candidate --base-revision 84b596e12e54db098857004497a4d1964dcdc23c --output .tmp/evidence -- npm.cmd run verify
node tools/evidence/capture-command.mjs --task T806 --gate package --base-revision 84b596e12e54db098857004497a4d1964dcdc23c --output .tmp/evidence -- npm.cmd run package
node tools/evidence/capture-command.mjs --task T806 --gate package-smoke --base-revision 84b596e12e54db098857004497a4d1964dcdc23c --output .tmp/evidence -- npm.cmd run test:package-smoke
git diff --check
```

记录 OS、Node、Electron、source revision、真实 exit code、脱敏 artifact、installer/blockmap/unpacked executable SHA-256 和 Authenticode 状态。任何失败 artifact 均保留，成功只通过 `supersedes` 关联。

### 9.5 Hosted CI

- 核对任务 final-head 与 post-merge runs：T041 `33155839482/33156238060`、T042 `33240012962/33240471959`、T051 `33262841245/33289953789`、T052 `33303792484/33304210856`。
- 旧任务 CI 只证明相应 task/final integration 历史，不证明 T806。
- T806 Draft PR 正文使用 `CI mode: milestone`，分别记录 candidate 与 docs closeout final-head 的 PR head、test-merge、run、job 和 artifact。
- PR 开始异步 CI 后遵循 HANDOFF；不持续无理由轮询。

## 10. 文档 closeout 与归档门

自动化、package、完整范围 diff 和独立只读 review 全部通过后，先向项目所有者提交精确 documentation impact matrix。只有获得针对第 5 节文件和四份合同删除的确认后才执行：

1. 新增 `EV-S4-S5-001`，绑定固定产品 source、四任务 revision、命令、artifact、CI、人工推论和限制。
2. 为 `EV-T041-001`～`EV-T052-001` 增补真实 integration timeline，不删除原 candidate、失败、pending 或 superseded 事实。
3. 修正 Task Index 和 README 中 PR #42 未合入等过时状态。
4. 创建 `archive/S4_S5_T041_T052_ARCHIVE.md`，保留最终范围、兼容契约、证据、限制及固定 Git 恢复命令。
5. 更新四份 metadata 的合同路径为统一归档。
6. 删除四份已归档合同，保留 T052 Escalation Proposal。
7. 在 final docs head 重新运行 metadata、完整 verify、package、package smoke、diff review 和 milestone hosted CI。

归档和合同删除未获项目所有者精确批准时保持 pending，不以本合同的未来范围预先执行。

## 11. Git、GitHub 与外部权限

以下权限只在项目所有者批准并激活本合同后生效：

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

- `external_write: true` 只允许推送 `codex/T806-s4-s5-final-acceptance`、创建/更新该分支到 `dev` 的一个 Draft PR，以及读取/触发其 GitHub Actions 和脱敏 artifact。
- 不允许 Agent 标记 Ready、合并到 `dev`、创建或合并 `dev → main` PR、创建 tag/Release、上传 release asset、修改 ruleset/Secrets、force-push 或删除远端分支。
- T806 收口 PR 由项目所有者合入后，Agent只能只读核实新 `origin/dev` 和 post-merge CI，并准备 milestone PR 正文；创建 `dev → main` PR 需要新的明确授权。
- 数据破坏性操作：无；不访问、迁移、复制或删除真实 Electron `userData`。

```yaml
integration:
  target_branch: dev
  base_revision: dev@84b596e12e54db098857004497a4d1964dcdc23c
  prior_main_revision: main@54c198dca04bce84565174741b9a86577e4374db
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: 84b596e12e54db098857004497a4d1964dcdc23c
```

若 `origin/dev` 在验收期间推进，先停止结论，审计新增提交。只有新增内容属于已批准范围且完成 ordinary merge refresh、全部受影响回归和重新 review 后，才能把 freshness 记为 `refreshed-and-passed` 并更新 fixed stage source；否则状态为 `blocked`。

## 12. 可判定完成条件

1. T041～T052 的 task delivery、final head、dev integration 和 content-tree 关系全部可追踪。
2. `origin/main...origin/dev` 完整审计无未解释 main-only 内容、未批准功能、依赖、Provider、延期项或无依据语义。
3. 定向 Unit、Integration、Electron E2E、完整 `verify`、package 与 package smoke 全部通过并绑定同一 fixed product source/content tree。
4. AC-05、AC-06、AC-05→AC-06、migration/reopen/export、安全边界及 AC-01/03/04/07 回归均有实际结果。
5. 人工 AC-05/AC-06 由项目所有者报告并满足 revision-safe 绑定条件；不能绑定时如实保持 `pending`。
6. 独立完整 diff review 无未处理 material finding。
7. 项目所有者批准精确 docs closeout 后，Evidence、Task Index、README、metadata 和统一归档准确且历史完整，四份合同按授权删除并可从固定 Git revision 恢复。
8. docs final head 的本地完整门禁和 hosted milestone CI 通过。
9. 到 `dev` 的 Draft PR 已创建并停在 owner gate；Agent 不标记 Ready、不合并。
10. 最终报告明确区分 stage source、T806 delivery、后续 dev integration、main promotion、tag 和 Release。

## 13. 风险与停止条件

- 任一任务未实际进入 fixed `dev`，或 task/final/integration tree 无法解释。
- `main...dev` 出现未批准、无法归属或 main-only 产品内容。
- 任一要求的 Unit、Integration、E2E、verify、package、smoke、migration、export、security、hosted CI 或人工绑定失败。
- 需要修改产品、测试、配置、依赖、schema、migration、Provider 或需求语义才能继续。
- Recovery/Review 折叠五种 Routine 语义、改写历史、引入评价性推断或自动写入。
- Evidence 无法保留失败/partial/superseded 历史，或必须代签人工结果才能声明通过。
- `origin/dev` 推进但 freshness 未完成；PR head/test-merge/run/artifact 不再绑定当前候选。
- documentation impact matrix、合同删除、Ready、merge、main PR、tag 或 Release 权限缺失。

命中停止条件时，不声明 S4/S5 final gate 通过；保留安全成果和真实 artifact，按 `ESCALATION_PROPOSAL_TEMPLATE.md` 报告并等待独立授权。

## 14. 发布建议与完成报告

T806 全部门禁及收口 PR 合入 `dev` 后，建议项目所有者单独授权创建一个 `dev → main` Draft milestone PR，并要求 merge commit。该 PR必须列出任务、需求、固定产品 source、T806 delivery/dev integration、candidate/final-head/post-merge CI、package hashes/signature、manual、migration/export、限制和回滚边界。

本阶段不建议创建 tag 或 GitHub Release：AC-02、S6、S7 和 G4 尚未完成，最近发布版本继续是 `v0.1.0-beta.1`。待 G4 完成后再按 GitHub 工作流决定 `v0.1.0-rc.1` 或 `v0.1.0`。

完成报告必须使用中文，列出精确 revisions、PR/CI/artifact、需求和 AC 覆盖、自动/人工结果、文档状态、package/签名、失败和 supersede、风险限制、owner gates，以及是否发现需求冲突或范围变化。

## 15. 当前批准边界

项目所有者已批准：

- 使用 T806 作为本次 S4/S5 聚合任务号；
- 从 `origin/dev@84b596e...` 创建独立验收分支；
- 编写本合同、metadata 与 Task Index `ready` 登记；
- 于 2026-08-30 批准本合同全文、激活 T806，并开始聚合验收、Evidence capture、package 和 hosted candidate 流程；
- 将 PR #38 的四个治理配套文件作为项目所有者引入的已批准非产品内容纳入后续审计。

尚待项目所有者明确批准：

- 自动验证通过后的精确 documentation impact matrix 与四份合同删除；
- Ready、任何 merge、创建 `dev → main` PR、tag 和 Release。

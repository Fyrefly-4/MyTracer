# T052 ReviewResult 和下一阶段调整任务合同

> 任务类型：implementation（包含 schema/export migration owner gate）
>
> 合同状态：**approved / task delivery complete；项目所有者于 2026-08-30T13:17:23+08:00 明确批准并激活，2026-08-30 批准 documentation closeout**
>
> 执行状态：Implementation Candidate、项目所有者人工 AC-06 与 owner-approved docs closeout 已完成；PR #42 final-head CI、Ready 和 `dev` 集成仍是独立 PR gate

## 1. 任务信息与基线

- **Task ID**：T052
- **Title**：ReviewResult 和下一阶段调整
- **Slice / Plan item**：S5 / E5-02
- **Status**：`done`；task delivery revision `7aced4fa3146ebb5d0bcf28b7dbc81e5b40e2cb2` 的自动化、独立 review、人工 AC-06 和文档收口证据完整，PR #42 尚未获 Ready 或 merge 授权
- **Owner approval / activation**：项目所有者于 `2026-08-30T13:17:23+08:00` 明确批准并激活本合同、第 5.2 节精确范围和第 12.2 节执行权限
- **Base branch**：`dev`
- **Latest authorized dev revision at draft**：`dev@3e5a14f1b5f90894e1e15a4b208aa5db254e7825`
- **Local tracking fact**：合同编写时本地 `dev`、`origin/dev` 和 HEAD 均为 `3e5a14f...`，工作树在合同文件创建前干净；该 revision 已包含 T051 经 PR #41 合入 `dev`
- **Implementation resume fact**：第二阶段开始时本地 `dev`、本地 tracking ref `origin/dev` 与 HEAD 仍为 `3e5a14f...`；`git fetch origin dev` 因 SSH 连接被远端关闭而未刷新成功，因此该事实不声明实时远端 freshness，后续候选门禁仍须重新核对
- **Expected branch name after activation**：`task/T052-review-result`

### 1.1 当前前置事实

- T041、T042、T051 已按批准顺序进入当前 `dev`；T051 的周期事实摘要、Review context、Main/Preload API 和 AC-06 步骤 1是 T052 的直接基线。
- 当前 schemaVersion 为 2，exportVersion 为 1；`review_results` 仍使用 `summary/adjustment/next_focus`，没有周期 UNIQUE 约束。
- S45-Q04-A、S45-Q05-A、S45-Q06-A 的设计批准本身不构成执行授权；本合同现已由项目所有者明确批准并激活，第 12.2 节成为 T052 的精确 migration、export 与 Git/GitHub 权限来源。
- 当前 `001_initial.sql` 和 `002_add_routine_record_planned_for_date_basis.sql` 是已执行历史，不得回写。
- 当前稳定验证命令、FakeClock、唯一临时 SQLite/Electron `userData` 和 deterministic evidence wrapper 已存在。

## 2. 目标结果

用户主动进入 Review 后，可以在已捕获并明确显示的周一至周日周期中：

1. 查看从当前 Record 重算的事实摘要；
2. 确认并保存一个真实进展、一个主要阻力和一个下一周期调整；
3. 可选、明确选择一个 active Goal，并使用同 Goal 的 existing pending Action，或创建一个同 Goal pending Action，作为该 Goal 的当前下一步；
4. 取消或离开而不写业务数据；确认后以一个原子事务保存/更新 ReviewResult，并按明确选择原子更新下一步；
5. 再次进入同一 `periodStartedOn` 时读取并编辑同一个稳定 ReviewResult ID；
6. 完全关闭并重开应用后仍读取到用户输入；Record 被修改或删除后，事实摘要重新计算，而已保存文本不被系统重写。

T052 不要求用户重复输入时间、次数、理解、困惑或 Routine 统计，也不自动加入 Today。

## 3. 需求与设计依据

- **直接 FR**：FR-RV02、FR-RV03、FR-RV04、FR-RV05。
- **直接 AC**：AC-06 步骤 2～5；与 T051 步骤 1组成完整 AC-06 candidate。
- **直接 D**：D-105、D-110。
- **下一步依据**：FR-G05、D-004、ED-005、ED-006。
- **数据兼容依据**：FR-D01、FR-D04、D-111、ED-008、ED-014、ED-018；AC-07 受影响回归。
- **Electron / LocalDate / workflow**：D-106；ED-004、ED-017、ED-019；GW-001～GW-010。
- **受影响回归**：AC-01、AC-03、AC-04、AC-05、AC-07；只证明未退化，不重复声明既有任务完成。
- **已批准设计**：
  - S45-Q04-A：schema v3 + 严格可判别 export v2，保留 export v1 validator；
  - S45-Q05-A：每个 `periodStartedOn` 最多一个 ReviewResult，再次保存编辑同一稳定 ID；
  - S45-Q06-A：ReviewResult 与可选 next-step resolution 在同一事务原子完成，Today 仍为单独用户决定。
- **直接相关架构章节**：
  - `DOMAIN_MODEL_V0.1.md` §3、§7.4、§8；
  - `DATA_DESIGN_V0.1.md` ReviewResult、版本、删除 detach、完整导出与测试隔离；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-004～ED-006、ED-008、ED-014、ED-017～ED-019；
  - `IMPLEMENTATION_PLAN_V0.1.md` E5-02；
  - `TEST_STRATEGY_V0.1.md` ReviewResult、migration/export、E2E-AC-06；
  - `S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md` §3～§13、S45-Q04-A～Q06-A、§15～§17。

### 3.1 References

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  stage_design:
    - file: docs/architecture/S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md
      sections:
        - 3. Stage delta、目标与非范围
        - 4.3～4.4 Review flow 与 Renderer ownership
        - 5.4 ReviewResult 不变量
        - 6.2 Review 周期
        - 7.1～7.5 Query、DTO、CompleteReview 与 Repository ports
        - 8. IPC、Preload、Main 与 Renderer 安全边界
        - 9. SQLite、migration、索引与 export 兼容
        - 10. Task graph、共享面与实施顺序
        - 11.4 T052 — ReviewResult 与下一阶段调整
        - 12.1、12.3～12.6 验证与聚合 E2E
        - 13. FR / AC / D / ED 追踪
        - S45-Q04-A、S45-Q05-A、S45-Q06-A
        - 15～17 风险、授权与阶段门
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
  implementation:
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/AUTOMATION_PROFILES_V0.1.md
    - docs/implementation/profiles/standard-task-v1.json
    - docs/implementation/T042_RECOVERY_RESTART.md
    - docs/implementation/T051_REVIEW_SUMMARY.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
```

## 4. 开始条件、依赖与 shared surfaces

### 4.1 合同审批与激活检查

- [x] 稳定 T052 identity、批准的 S4/S5 设计和精确可观察结果存在。
- [x] T051 已集成至最新本地授权 `dev@3e5a14f...`，T052 不与未集成 T051 并行。
- [x] schema v3 / export v2 设计、单周期唯一性和原子事务边界已由项目所有者批准。
- [x] 当前 schema v2、export v1、ReviewResult 旧字段和 shared surfaces 已重新核对。
- [x] 未发现冻结 MUST、已批准 D/ED 或 S45-Q04-A～Q06-A 之间的阻塞冲突。
- [x] 不需要新增或升级依赖，不需要 live AI Provider。
- [x] 项目所有者于 `2026-08-30T13:17:23+08:00` 批准并激活本合同、精确允许文件和第 12.2 节执行权限，其中包括 `migration_change: true`。
- [x] 第二阶段开始时只读确认本地 `dev`、本地 tracking ref `origin/dev` 和 HEAD 仍指向 `3e5a14f...`；远端 fetch 失败已如实记录，候选 freshness gate 前必须重试核对。
- [x] 开始实现前把 `TASK_INDEX` 从 `pending` 同步到准确的 `active` 状态。
- [x] 按项目所有者补充要求在当前 checkout 创建独立 `task/T052-review-result` 分支（不创建工作树），并在首个生产变更前运行 `npm.cmd run governance:metadata:check` 通过。

```yaml
dependencies:
  tasks:
    requires: [T051]
    blocks: []
    can_parallel: []
    prefer_after: [T042]
    conflicts_with: [T042]
  stage_prerequisites:
    - T042 current-next atomic behavior is integrated in dev
    - T051 review summary and sender-bound context are integrated in dev
    - S45-Q04-A, S45-Q05-A and S45-Q06-A are approved design inputs
    - exact T052 migration authority was approved and activated at 2026-08-30T13:17:23+08:00
  revisions:
    required_dev_base: dev@3e5a14f1b5f90894e1e15a4b208aa5db254e7825
    t042_dev_integration_revision: 3f343b8af0216b5e568f2c8f1ed52ac4ef824da3
    t051_dev_integration_revision: 3e5a14f1b5f90894e1e15a4b208aa5db254e7825
  shared_surfaces:
    - review-result-domain-application-and-context
    - review-results-schema-v3-and-migration-manifest
    - complete-export-v1-validator-and-v2-generator-validator
    - goal-action-current-next-atomicity
    - main-preload-review-api-and-renderer-form
    - data-control-goal-detach-and-complete-snapshot
    - ac05-ac06-aggregate-electron-e2e
  external: []
```

T052 与 T042 的 Goal/Action current-next、Main/Preload 和聚合 E2E surfaces 冲突；只允许基于已集成 T042/T051 的 `dev` 串行实施。

### 4.2 Automation Profile（明确不适用）

- `standard-task@1` 只适用于没有 schema/migration 的普通 implementation/fix；T052 包含 schema v3 和 v2→v3 migration，因此不满足 registry 的适用条件。
- 本合同和 `metadata/T052.json` 不声明 `execution.profile`、`activated_at` 或 `valid_until`，不得把 metadata 结构通过解释为 Profile 激活。
- T052 全程使用第 12.2 节逐项显式权限；migration、docs closeout、Ready、merge、main、tag 和 release 均保留 owner gate。
- 若要为 T052 使用任何 Automation Profile，必须先获得单独治理授权并修改合同/sidecar；不得由实施者将 `standard-task@1` 扩张到 migration 任务。

## 5. 允许修改范围

### 5.1 合同编写与本次激活标注阶段

合同草案与首次激活标注阶段只允许创建或修改本合同与 sidecar；该暂停现已由项目所有者启动第二阶段开发的明确指令解除。历史上该步只允许修改：

- `docs/implementation/T052_REVIEW_RESULT.md`

`docs/implementation/metadata/T052.json` 保持不变且没有 Profile activation 字段。此处仅保留历史权限事实；当前执行以第 5.2 节和第 12.2 节为准。

### 5.2 已批准并激活的精确实现范围

以下范围已由项目所有者于 `2026-08-30T13:17:23+08:00` 批准并激活，并于第二阶段开发指令中明确开始执行：

- ReviewResult / next-step：
  - `src/domain/review.ts`
  - `src/domain/index.ts`
  - `src/domain/goal.ts`（仅复用或最小提取 current-next 不变量；不得改变语义）
  - `src/application/review.ts`
  - `src/application/ports/persistence.ts`
  - `src/contracts/review.ts`
  - `src/contracts/shell.ts`
- SQLite / data control：
  - `src/infrastructure/sqlite/migrations/003_review_results_v3.sql`（新增）
  - `src/infrastructure/sqlite/migrations.ts`
  - `src/infrastructure/sqlite/sqlite-repository.ts`
  - `src/application/data-control.ts`（仅 ReviewResult 新 shape 与 Goal detach 兼容）
  - `src/domain/data-control.ts`（仅编译或明确 detach 契约所需）
- export v2 / v1 compatibility：
  - `src/application/complete-export.ts`
  - `src/application/ports/export.ts`
  - `src/contracts/exports.ts`
  - `src/infrastructure/export/system-export-adapter.ts`
  - `src/main/exports-ipc.ts`
  - `src/renderer/src/features/data-control/DataControlPage.tsx`（仅 export v2 成功结果/文案兼容）
- Electron / UI：
  - `src/main/review-contexts.ts`
  - `src/main/review-ipc.ts`
  - `src/main/index.ts`
  - `src/preload/index.ts`
  - `src/renderer/src/features/review/ReviewPage.tsx`
  - `src/renderer/src/styles.css`
- T052 定向测试与数据兼容 fixture：
  - `tests/unit/review-domain.test.ts`
  - `tests/unit/review-application.test.ts`
  - `tests/unit/review-contexts.test.ts`
  - `tests/unit/goal-domain.test.ts`（仅 current-next 原子路径回归）
  - `tests/unit/complete-export.test.ts`
  - `tests/unit/data-control-application.test.ts`
  - `tests/unit/data-control-domain.test.ts`
  - `tests/integration/review-sqlite.test.ts`
  - `tests/integration/review-ipc.test.ts`
  - `tests/integration/review-migration.test.ts`（新增）
  - `tests/integration/sqlite-persistence.test.ts`
  - `tests/integration/complete-export-sqlite.test.ts`
  - `tests/integration/system-export-adapter.test.ts`
  - `tests/integration/data-control-sqlite.test.ts`
  - `tests/integration/data-control-ipc.test.ts`
  - `tests/integration/main-foundations.test.ts`
  - `tests/e2e/review-result.e2e.test.ts`（新增 AC-06 连续程序）
  - `tests/e2e/recovery-review-aggregate.e2e.test.ts`（新增 AC-05→AC-06 聚合程序）
  - `tests/e2e/complete-export.e2e.test.ts`
  - `tests/e2e/ai-data-capability.e2e.test.ts`（项目所有者于 2026-08-30 批准的 AC-07 export v2 单断言机械兼容）
  - `tests/e2e/data-control.e2e.test.ts`
  - `tests/e2e/review-summary.e2e.test.ts`（仅 T051 summary 与 T052 重算衔接回归）
  - `tests/e2e/recovery-restart.e2e.test.ts`（只作为聚合路径受影响回归；优先不修改）
  - `tests/e2e/shell.e2e.test.ts`
- RepositoryPort shape 变化造成的机械 fixture 兼容，仅允许修改以下既有 test doubles，不得改变对应业务行为：
  - `tests/unit/action-application.test.ts`
  - `tests/unit/action-record-application.test.ts`
  - `tests/unit/goal-application.test.ts`
  - `tests/unit/routine-application.test.ts`
  - `tests/unit/routine-record-application.test.ts`
  - `tests/unit/today-application.test.ts`
- 任务记录与 ignored artifacts：
  - `docs/implementation/T052_REVIEW_RESULT.md`
  - `docs/implementation/metadata/T052.json`
  - `docs/implementation/TASK_INDEX_V0.1.md`（激活时只记录 T052 状态与基线事实）
  - `.tmp/evidence/T052-*.json`（ignored、脱敏、命令事实 artifact）

不得修改 `001_initial.sql`、`002_add_routine_record_planned_for_date_basis.sql`、依赖/lockfile、CI、需求基线或 stage design。实现需要列表外文件时必须停止并申请合同范围变更。

候选 CI 通过后必须先形成 documentation impact matrix；`ACCEPTANCE_EVIDENCE_V0.1.md`、README、需求追踪、阶段文档和 Draft PR 正文只有在项目所有者批准精确 docs closeout scope 后才允许修改。

## 6. 明确非范围

- 同一周期多份 ReviewResult 历史、ReviewResult 列表/删除或每个 Goal 一份复盘。
- 阻力分类体系、预设原因、评分、掌握度、完成率、失败率、streak 或人格评价。
- 通知、提醒、后台主动 Review、AI 总结、AI 建议、自动周计划或任何 Provider 变化。
- S7 周期比较、历史周期浏览器、可配置周起点。
- 自动创建或修改未被用户明确确认的数据；未确认 Review 草稿持久化。
- 设置 current next 时自动加入 Today；Today 仍由用户单独决定。
- 自动导入恢复、把 export 描述为可导入备份、账号、同步或 release。
- 删除、合并、覆盖、重编号或虚构旧 ReviewResult 以绕过新 schema 约束。
- G4、S6、S7、Ready、merge、main、tag、release 或下一任务启动。

## 7. 必须保持的不变量

### 7.1 ReviewResult 与周期

- `confirmedProgress`、`mainObstacle`、`nextAdjustment` 都是用户确认、trim 后非空的轻量自然语言；系统不分类、不评分、不补造内容。
- 事实摘要不写入 ReviewResult；Record 修正/删除后摘要重算，已保存用户文本保持原值。
- `periodStartedOn` 是 context 捕获并显示的周一；`periodEndedOn` 由 start + 6 派生，不重复持久化。
- 每个 `periodStartedOn` 最多一个结果；再次保存保留同一 `id` 和 `createdAt`，只更新用户可编辑字段、可空关联和 `updatedAt`。
- 页面跨周不静默移动保存周期；cancel/navigation/reload/window close 使 context 失效且零业务写入。

### 7.2 下一步与事务

- `relatedGoalId` 可空；next-step change 只有 `none`、`use-existing`、`create-and-use` 三种明确输入。
- 更新 current next 的 Goal 必须是 active；existing Action 必须为同 Goal pending；created Action 必须为同 Goal pending。
- ReviewResult 与可选 next-step resolution 使用同一 `UnitOfWork` 事务；任何 validation、conflict 或 persistence failure 全部回滚。
- 没有 next-step change 时不修改 Goal/Action；设置 current next 不写 TodaySelection，不自动选择其他 Action。
- 只有事务成功后 context 才消费；失败不允许产生“Review 已保存但下一步失败”的部分状态。

### 7.3 旧数据与 migration

- v2→v3 只通过新增 `003` 顺序 migration，在单一事务内重建表、重建索引并最后更新 metadata version。
- 每一条满足 v2 schema 且可满足 v3 唯一/非空约束的旧行必须逐字段无损映射：`id`、`period_started_on`、`goal_id`、`created_at`、`updated_at` 原值保持；`summary → confirmed_progress`、`adjustment → main_obstacle`、`next_focus → next_adjustment` 文本原值保持。
- migration 必须在改变表前检测重复 `period_started_on`。若存在重复，不得选择、删除、合并、重编号或改写任一行；整笔 migration 以可诊断但不泄露正文的错误失败，v2 表、全部行、索引和 `metadata.schemaVersion=2` 保持不变。
- 当前合法 v2 schema 已拒绝 trim 后空白文本；migration 仍必须防御 null/空白/损坏旧文本。发现时不得填占位符或虚构进展/阻力/调整；整笔 migration 回滚并保持 v2 数据与版本。
- 旧 `goal_id` 为 null 的行保持 null；关联 Goal 后续硬删除继续 `ON DELETE SET NULL`，ReviewResult 和其文本/ID/时间戳保留。
- 比应用支持版本更高的数据库继续拒绝写入，不降级、不覆盖 metadata。
- 任何 DDL、copy、index 或 metadata 更新失败都回滚；测试必须关闭并重开连接证明失败后 v2 完整、成功后 v3 可读。
- 自动化只使用合成 fixture 和每 case 唯一临时根；不得打开、复制或迁移真实 Electron `userData`。

### 7.4 export v1/v2

- export v1 validator 保留并继续严格接受历史 v1 shape；不得在 `exportVersion=1` 下接受或生成 v2 ReviewResult shape。
- generator 在 schema v3 上生成严格可判别的 export v2；v2 ReviewResult 只使用 `confirmedProgress/mainObstacle/nextAdjustment/goalId` 等批准字段。
- v1/v2 validator 必须先按 `exportVersion` 判别，再对 exact keys、集合、枚举、LocalDate、关联、排序、时间戳和敏感字段排除分别严格校验；两个版本不得交叉接受 shape。
- export v2 保持全部核心集合、`sourceDataVersion`、`enumValues`、Main-only destination、原子临时 sibling/复验/替换和失败不破坏旧文件语义；不增加 import。

### 7.5 Electron、数据与测试

- Renderer 只保留确认前 feature-local state，不获得 period/统计信任、Node、SQL、文件路径、凭据、Provider 或 arbitrary IPC。
- Main 使用 trusted sender、exact keys 和 runtime validation；错误不泄露正文、SQL、绝对路径或技术日志。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 保持区分；缺行不写入也不推断失败。
- Domain 不依赖 Electron、React、SQLite 或具体 Provider；AI disabled/not-configured/failure 不阻塞 Review。
- 所有自动化使用 FakeClock 和唯一临时数据库/`userData`；不使用 live Provider 或真实凭据。

## 8. 交付物

- [x] ReviewResult domain/application validation、save/update/read。
- [x] `CompleteReview`、`GetReviewResult`（由 `BeginReview` 精确合并返回）和 sender-bound 确认 context。
- [x] ReviewResult 与可选 existing/create-and-use next-step 的单事务原子命令。
- [x] Review 表单、取消、确认、错误、编辑和重开流程。
- [x] `003` v2→v3 migration、周期 UNIQUE 索引、Repository 与完整失败回滚。
- [x] 严格 export v2 generator/validator 和保留的严格 export v1 validator。
- [x] 合法旧行、duplicate period、blank/corrupt text、Goal detach、unknown high version、migration failure 的数据兼容测试。
- [x] AC-06 连续 E2E、AC-05→AC-06 同数据库聚合 E2E 和受影响 AC 回归。
- [x] 项目所有者人工 AC-06 程序；2026-08-30 报告全体通过。
- [x] `EV-T052-001` 所需 deterministic artifact、真实 CI/revision 绑定和 owner-approved docs closeout。

## 9. 验收标准

1. 三个 Review 文本各自必须由用户输入并通过非空验证；空白、额外字段、伪造 period/统计/时间戳或非法 context 被拒绝且零写入。
2. 首次确认创建一个 ReviewResult；同周期再次确认编辑同一稳定 ID，保留 `createdAt`，更新 `updatedAt`，不会出现第二行。
3. 取消、离开、reload、窗口关闭、stale/consumed/cross-sender/untrusted context 均不写 ReviewResult、Goal、Action、TodaySelection 或 Record。
4. 不选择下一步时只保存 ReviewResult；明确选择 existing/create-and-use 时，只有 active Goal + 同 Goal pending Action 可成为 current next。
5. ReviewResult 与 next-step resolution 全有或全无；注入任一 persistence failure 后完整业务 snapshot 与命令前一致。
6. 完全关闭连接和应用后重新打开，同周期用户文本和 stable ID 可读；Summary 从当前 Record 重算。
7. 修改或删除测试 Record 后 Summary 按事实变化，ReviewResult 三段文本不被系统改写。
8. v2→v3 对每条可迁移旧行无损映射文本、ID、period、Goal/null 和时间戳，并建立唯一周期索引。
9. duplicate period 或 null/blank/corrupt 旧文本导致 transaction rollback；测试逐行证明没有删除、合并、虚构、重编号或 metadata version 前移。
10. Goal hard delete 后 ReviewResult 保留且 `goalId=null`；删除 impact、完整 snapshot、重开和 export 一致。
11. unknown high schema version 和注入 migration failure 拒绝写入，原 schema、数据和 metadata 完整保留。
12. export v2 对新 shape 严格通过并覆盖全部核心状态；v1 历史 fixture 继续由 v1 validator 通过；v1/v2 互换 shape、未知版本、额外字段、非法关联和敏感字段均失败。
13. E2E-AC-06 连续完成摘要、取消、保存、可选下一步、编辑、重开和重算；不要求重复输入统计，也不出现评分/提醒/AI。
14. AC-05→AC-06 在同一数据库、不重置状态、同一最终 revision 完成；恢复后真实 Record 进入 ReviewSummary，Recovery 操作本身不计行动。
15. AC-01、AC-03、AC-04、AC-05、AC-07 受影响回归通过；AI unavailable 不阻塞 Review/export。
16. `npm.cmd run verify`、migration/export compatibility、metadata、完整 diff、Integration Freshness、deterministic evidence 与独立 review 无未处理 required finding。
17. **MANUAL**：项目所有者确认三个输入负担合理、事实摘要无需重录、取消/编辑/重开清楚、可选下一步由用户明确决定且没有评分/提醒/AI/导入暗示。
18. 项目所有者人工 AC-06 已于 2026-08-30 报告通过；S4/S5 final gate、下一阶段和发布仍需独立授权。

## 10. 验证计划

以下生产/测试命令已进入获批合同范围；第二阶段按从窄到宽的顺序执行并记录真实结果。

### 10.1 针对性验证

```powershell
npm.cmd run test:unit -- tests/unit/review-domain.test.ts tests/unit/review-application.test.ts tests/unit/review-contexts.test.ts tests/unit/goal-domain.test.ts tests/unit/complete-export.test.ts tests/unit/data-control-application.test.ts tests/unit/data-control-domain.test.ts
npm.cmd run test:integration -- tests/integration/review-sqlite.test.ts tests/integration/review-ipc.test.ts tests/integration/review-migration.test.ts tests/integration/sqlite-persistence.test.ts tests/integration/complete-export-sqlite.test.ts tests/integration/system-export-adapter.test.ts tests/integration/data-control-sqlite.test.ts tests/integration/data-control-ipc.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/review-result.e2e.test.ts tests/e2e/recovery-review-aggregate.e2e.test.ts tests/e2e/complete-export.e2e.test.ts tests/e2e/data-control.e2e.test.ts tests/e2e/review-summary.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

### 10.2 受影响回归与 aggregate

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
git diff --check
```

`verify` 已包含 build 和 Electron E2E，但不替代 migration compatibility、export v1/v2 fixture、package/NSIS、hosted CI、人工体验或 final-head 证据。阶段 final gate 的 Windows package/unpacked/NSIS smoke 在项目所有者要求进入该 gate 时单独执行，不因本合同自动发布或安装到真实用户数据根。

### 10.3 Deterministic evidence capture

```powershell
node tools/evidence/capture-command.mjs --task T052 --gate task-candidate --base-revision <latest-authorized-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

wrapper 使用显式 argv，保留真实 exit code，只写 ignored `.tmp/evidence/` 的脱敏 JSON；不得记录 stdout/stderr、绝对用户路径、环境、凭据、SQLite 或用户正文。

### 10.4 人工 AC-06 程序

1. 在隔离人工测试数据根准备同一周的 Action/Routine facts、确认 Understanding、open Confusion，以及四类显式 Routine outcome 和一个无 Record 的观察日。
2. 主动进入 Review，确认周期标题、时间/次数/理解/困惑和四类 Routine 事实正确，空白日没有被写成 `not_done` 或失败。
3. 填写一个真实进展、一个主要阻力和一个下一周期调整；确认无需抄写统计。
4. 先取消并重新进入，确认没有保存文本或改变 Goal/Action；随后确认保存且不更新下一步。
5. 再次进入同周期，确认读取同一结果并可编辑；明确选择一个 active Goal 和 existing/create-and-use 下一步后确认，检查 current next 只在最终确认后改变且没有自动加入 Today。
6. 完全关闭并重开应用，确认 stable ReviewResult 仍存在；修改/删除一条测试 Record 后重新进入，确认 Summary 重算而三个用户文本不变。
7. 删除关联测试 Goal，确认 ReviewResult 保留并解除关联；生成 export v2，确认新字段、版本和完整核心集合，且界面没有导入恢复承诺。
8. 确认全流程没有多结果历史、阻力分类、评分、完成率、streak、提醒、AI 总结、自动周计划或 S7 比较。

人工结果只能由项目所有者记录为 pass/partial/fail；Agent 不代签。

### 10.5 验证环境

- **OS**：Windows 11 x64
- **Node**：24.18.0
- **npm**：11.16.0
- **Electron**：43.3.0（以锁定 `package-lock.json` 为最终事实）
- **数据根**：每 case 唯一临时 SQLite / Electron `userData`；人工使用明确隔离目录
- **AI**：fake、disabled 或 not-configured；不使用 live Provider
- **Source revision**：task delivery `7aced4fa3146ebb5d0bcf28b7dbc81e5b40e2cb2`；本地完整 aggregate 绑定其直接前序实现候选 `075dec31e9abfcb9ff94655a680b6fe6e04417e3`，当前 head 由 hosted required CI 完整验证

## 11. Evidence 要求

- **Evidence ID**：`EV-T052-001`。
- **Claim boundary**：FR-RV02～FR-RV05、D-105/D-110、FR-G05/D-004/ED-005/006、ReviewResult 持久/编辑/Goal detach、schema v3/export v2 与 AC-06 candidate；AC-05、AC-07 只作受影响/聚合回归。
- **Required bindings**：合同、需求/设计章节、original/latest dev base、Implementation Candidate、task delivery revision、PR source head/test-merge revision、命令、Windows 环境、migration/export fixture、exit code、artifact、manual status、限制与 `supersedes`。
- **Deterministic artifacts**：`.tmp/evidence/T052-*.json`；只包含 allowlisted facts。
- **Compatibility evidence**：成功和失败 migration fixture 都绑定旧/新 schema version、行数、ID/文本/关联/时间戳守恒和重开结果；不得保存用户正文或绝对路径到长期 Evidence。
- **Hosted CI**：early、candidate、docs final-head 与 post-merge 分开记录；旧 revision 的绿色结果不证明新 head。
- **Failure retention**：migration/export/CI/manual 的 failed/partial 结果保留，后续成功用 `supersedes` 关联，不删除失败事实。
- **Ledger gate**：候选 CI 通过后先请求项目所有者批准精确 docs closeout scope；批准前不得修改 `ACCEPTANCE_EVIDENCE_V0.1.md`。

## 12. Git、GitHub、外部与数据权限

### 12.1 已结束的合同草案权限（历史事实）

```yaml
permissions_current_draft:
  local_write: true
  create_worktree: false
  create_task_branch: false
  create_commit: false
  push_task_branch: false
  create_or_update_draft_pr: false
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: false
```

该权限块只记录审批前草案阶段的历史边界，现已由第 12.2 节权限取代；“只修改合同”的首次激活暂停已由后续第二阶段指令解除。

### 12.2 已批准并激活的精确执行权限

```yaml
permissions_active_execution:
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
  migration_change: true
  external_write: true
```

- **migration_change: true 的精确边界**：只授权新增 `003_review_results_v3.sql`、把 manifest 升到 schemaVersion 3、按 S45-Q04-A/Q05-A 无损迁移可迁移旧行、失败回滚，以及对应临时 fixture/重开验证；不授权回写 001/002、处理真实 userData、删除/合并/虚构冲突行、其他表设计变化或后续 schemaVersion。
- **export 边界**：只授权严格 export v2 与保留 v1 validator；不授权 import、恢复、额外集合或改变敏感字段排除。
- **允许 Git/GitHub 写目标**：一个 disposable T052 worktree、`task/T052-review-result`、reviewable commits、push、一个 target `dev` 的 Draft PR、同一 PR 正文更新和 GitHub Actions T052 验证。
- **不允许**：mark Ready、merge、force-push、remote branch deletion、ruleset/secret/workflow 修改、Issue/Project、main、tag、release 或非 T052 外部写入。
- **网络访问**：只允许 Git/GitHub task publication、PR/CI 查询与现有依赖的正常验证；不安装依赖、不访问 Provider。
- **新增/升级依赖**：无；需要时停止并申请 `dependency_change` owner gate。
- **数据破坏性操作**：无。migration 必须守恒或失败回滚；禁止对真实用户数据库执行测试、手工修复或迁移。
- **Evidence**：允许创建 ignored deterministic artifacts；长期 Evidence ledger 和 docs closeout commit 仍需候选 CI 后的精确 owner gate。
- **Automation Profile**：无；上述权限不应被解释为 `standard-task@1` 激活或自动跨越 owner gates。

项目所有者已于 `2026-08-30T13:17:23+08:00` 明确批准并激活本合同，因此第 12.2 节生效。首次激活的“只更新合同”暂停已由第二阶段开发指令解除；实施按所有者补充要求使用独立分支而未创建工作树。

### 12.3 Integration

```yaml
integration:
  target_branch: dev
  original_base_revision: dev@3e5a14f1b5f90894e1e15a4b208aa5db254e7825
  latest_authorized_dev_revision: dev@3e5a14f1b5f90894e1e15a4b208aa5db254e7825
  verified_against_revision: dev@3e5a14f1b5f90894e1e15a4b208aa5db254e7825
  freshness_required: true
  affected_regression_required: true
  status: fresh
  refresh_method: none-base-already-current
  task_delivery_revision: 7aced4fa3146ebb5d0bcf28b7dbc81e5b40e2cb2
  dev_integration_revision: null
  stage_final_integration_revision: null
```

开始实现、Implementation Candidate 和 docs closeout 前均已核对最新授权 `dev`；task delivery 基于并验证于 `dev@3e5a14f...`，Integration Freshness 为 `fresh`，无需 refresh。`dev_integration_revision` 与 `stage_final_integration_revision` 在项目所有者实际合并或阶段收口前保持 `null`。

## 13. 风险与停止条件

- **R1 / 重复旧周期**：UNIQUE 无法无损容纳重复旧行；检测到即让整个 migration 回滚并报告 blocker，不选择、合并、删除或改写行。
- **R2 / 空白或损坏旧文本**：不得用 placeholder 绕过非空约束；检测到即回滚并保留 v2。若真实合法 v2 数据出现当前 schema 无法解释的状态，提交 Escalation Proposal。
- **R3 / migration 非原子**：DDL、copy、index 或 metadata 任一步无法在同一事务守恒时停止，不把部分 schema 视为可接受。
- **R4 / export 版本混淆**：若无法严格区分 v1/v2 或必须破坏 v1 validator，停止并申请设计变更。
- **R5 / 部分成功**：若 ReviewResult 与 next-step 不能用同一 `UnitOfWork` 原子完成，停止；不得退回 Renderer 顺序命令或模糊报告。
- **R6 / stable ID 漂移**：若重复保存需要新增第二行、改变 period 或替换 ID，停止；不得实现多结果历史。
- **R7 / Goal detach 破坏**：若 Goal 删除会级联 ReviewResult 或丢失文本，停止并修复前不声明通过。
- **R8 / summary 双真相**：若保存需要复制 Progress/ReviewSummary 事实，停止；摘要只能重算。
- **R9 / context 权限扩大**：若 Renderer 必须提交可信 period/统计、持久化 token 或获得 raw IPC/SQL，停止。
- **R10 / 基线漂移**：若最新授权 `dev` 改变 Review、schema/export、current-next、data-control 或测试命令，重新复核合同。
- **R11 / 文件或权限扩大**：需要列表外文件、依赖、真实数据、Provider、非任务外部写或未批准 GitHub 操作时停止。
- **R12 / 证据不可绑定**：无法把 migration fixture、命令、artifact、PR head/test-merge、manual status 与确切 revision 绑定时，不声明通过。

任何冻结 MUST、S45-Q04-A～Q06-A、LocalDate、历史守恒、Electron 安全边界或数据兼容冲突都使用 Escalation Proposal；不得自行选择替代语义。

## 14. 完成、owner gates 与报告

本合同已获批准并激活。T052 已满足自动验收、本地 affected regression、完整 diff/独立 review、Integration Freshness、task-head hosted CI 和项目所有者人工 AC-06；项目所有者随后明确批准并完成 documentation closeout。

docs closeout 通过后仍须 latest-head required CI。Ready、merge `dev`、`dev -> main`、tag、release、G4、S6、S7 和下一任务始终需要独立项目所有者决定。T052 不自动开始任何后续工作。

最终或 pending handoff 必须用中文报告：

- 修改文件与可观察结果；
- FR/AC/D/ED 覆盖；
- migration/export 兼容事实与失败回滚；
- 命令、环境、artifact、commit、branch、PR、CI 和 revision；
- 自动化与人工状态；
- 风险、限制、跳过项和是否发现需求/范围冲突。

## 15. 批准、激活与第二阶段启动事实

项目所有者于 `2026-08-30T13:17:23+08:00` 明确：

1. 批准并激活 T052 独立合同；
2. 批准第 5.2 节精确文件范围与数据兼容测试；
3. 批准第 12.2 节权限，包括精确 `migration_change: true`、任务分支、commit、push 和 Draft PR；
4. 接受 T052 因 migration 不适用 `standard-task@1`，全程使用显式权限；
5. 接受 duplicate period 或 blank/corrupt old text 的 fail-closed transaction rollback，后续真实冲突数据处理必须另行授权，不能由 T052 删除、合并或虚构。

首次激活指令要求暂时只在合同中标注上述事实，该暂停已被项目所有者后续“第二阶段：批准后开发”指令明确解除。第二阶段允许按第 5.2 节修改任务文件，并按第 12.2 节创建独立分支、commit、push 和 Draft PR；项目所有者补充要求只创建独立分支、不创建工作树。PR 推送成功后立即停止，不主动查询 CI。

项目所有者于 2026-08-30 进一步批准 `T052_ESCALATION_AC07_EXPORT_VERSION` 的最小范围扩展：把 `tests/e2e/ai-data-capability.e2e.test.ts` 加入第 5.2 节允许列表，并只将其中既有 complete-export 成功结果的 `exportVersion` 期望从 `1` 机械更新为已批准的 `2`。该批准不扩展 AI、AC-07 流程、生产实现或其他断言语义。

## 16. Implementation Candidate、人工验收与 docs closeout 事实

- task delivery revision 为 `7aced4fa3146ebb5d0bcf28b7dbc81e5b40e2cb2`；它在实现候选 `075dec31e9abfcb9ff94655a680b6fe6e04417e3` 上只修复 ReviewSummary E2E 的日期注入等待方式，没有改变产品语义。
- `075dec31...` 的本地 `npm.cmd run verify` 完整通过：186 unit、109 integration、19 Electron E2E 通过，1 个 opt-in package smoke 按配置跳过。按项目所有者对该 CI 修复步骤的明确指令，没有在 `7aced4f...` 本地重跑测试。
- PR #42 run `33301604518` 在 `075dec31...` 因 `review-summary.e2e` 的 `electronApplication.evaluate` Promise 被回收而失败；该失败保留。后续 run [`33302157222`](https://github.com/Fyrefly-4/MyTracer/actions/runs/33302157222) 在精确 PR head `7aced4f...`、test-merge `8a644df9a60d06e081ec76b92002cb187196e5b1` 上 required CI 全部通过并 supersede 该失败。
- Hosted artifact `verification-evidence-33302157222-1`（artifact id `9729337881`，digest `sha256:b3c54d2acb32a229a7198cb19b6ff9d7c67fac1d20e8cfeb9aec99d89cf687a5`）记录 aggregate exit 0、capture complete，并正确区分 source head 与 test-merge revision。
- 项目所有者于 2026-08-30 报告人工测试全体通过，随后明确批准合同、Task Index、Evidence、README 和 Draft PR 正文的 docs closeout 与最后一次 push。
- `EV-T052-001` 记录上述自动化、CI、兼容性、review 与人工结果。docs closeout push 后的 final-head CI 只作为 PR 集成事实确认；Ready、merge、`dev_integration_revision`、S4/S5 final gate、G4、下一任务、tag 和 release 均未获授权或发生。

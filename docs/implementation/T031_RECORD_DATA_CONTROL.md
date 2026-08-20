# T031 Record 修改、历史补记与事务性删除任务合同

> 任务类型：S3 产品实现任务
>
> 任务状态：**active**（项目所有者已批准合同、S3-Q02-B 解释、精确 migration、structured permissions 与两项 shell E2E 最小扩围）
>
> 合同准备基线：`dev@9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be`
>
> 批准日期：2026-08-19；实现分支：`task/T031-record-data-control`
>
> 最小扩围批准：2026-08-20；仅允许同步 `tests/e2e/shell.e2e.test.ts` 的 schemaVersion v2 断言与顶层 `dataControl` allowlist 项

## 1. 任务信息

- **Task ID**：T031
- **Title**：Record 修改、历史补记、删除影响预览及事务性删除
- **Slice / Plan item**：S3 / E3-01
- **Status**：active
- **Base branch**：`dev`
- **Observed authorized base**：`dev@9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be`
- **Expected branch**：`task/T031-record-data-control`
- **Process**：采用当前 V2 task candidate、deterministic evidence、candidate CI、owner-approved docs closeout 和 final-head CI 流程。

## 2. 目标结果

在不改变 S1/S2 当前实体状态、Today 选择、Goal 当前下一步或事实统计语义的前提下，用户可以：

1. 显式修改既有 ActionRecord、RoutineRecord 及其发生日；
2. 为仍存在的 Action/Routine 显式选择 LocalDate 补记历史 Record；
3. 修改/撤销 Understanding，修改、解决和重开 Confusion；
4. 预览并二次确认永久删除 ActionRecord、RoutineRecord、Action、Routine 或 Goal；
5. 在取消、非法输入、冲突、stale 或存储故障时得到核心数据零变化；
6. 成功后从剩余事实重新查询 Progress、Today/day-state 和详情，并在真实关闭重开后保持一致。

T031 只贡献 AC-07 的“创建并修改核心数据、重开仍存在、删除错误 Record”子路径；不实现完整导出、AI 三态回归，也不声明完整 AC-07 完成。

## 3. 需求依据

- **FR**：FR-L07、FR-R08、FR-C04、FR-D01、FR-D02；回归 FR-A05、FR-R04～R07、FR-R09、FR-T01～T05、FR-P01～P04、FR-P07、FR-P08。
- **AC**：AC-07 步骤 1～2 的 T031 子集；受影响回归 AC-01、AC-03、AC-04。
- **D**：D-003、D-004、D-006～D-011、D-015、D-016、D-103、D-104、D-106、D-107。
- **ED/GW**：ED-003～ED-008、ED-012、ED-015～ED-019；GW-001～GW-004、GW-008～GW-010。
- **S3 批准项**：S3-Q01=A、S3-Q02=B、S3-Q03=A；S3-Q04 属于 T032，T031 不实施。
- **直接相关架构章节**：Implementation Plan §6 E3-01；S3 Design §3、§4、§6.1/6.3～6.6、§7、§8.1、§9、§10、§11、§12、§13；Data Design §4～§8/§11；Domain Model §6～§10；Test Strategy §2～§7/§9。

### 3.1 References

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#95-行动记录
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#96-理解成果
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#911-数据持久性与可控性
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#12-验收场景
  decisions:
    - docs/DECISIONS.md#2-已确认决定
    - docs/DECISIONS.md#3-暂定冻结决定
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md#3-领域与数据决定
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md#5-electron-与-sqlite-实现决定
  stage_design:
    - file: docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
      sections: ["§3", "§4", "§6.1", "§6.3-§6.6", "§7", "§8.1", "§9-§13"]
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S1_CORE_LOOP_DESIGN_V0.1.md
    - docs/architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md
  governance:
    - AGENTS.md
    - .agents/skills/mytracer-stage-development/SKILL.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
```

References 只是准确索引，不创建新的产品语义；`user/` 明确不是本任务依据。

### 3.2 S3-Q02-B 解释锁定

S3 Design §6.1 的 `BackfillRoutineRecord`/`UpdateRoutineRecord` 摘要行仍写有“按当前 schedule 计算/改日时重算计划快照”，与同一已批准文档 §3.5、§7.1、§8.1、§11、§12 S3-Q02=B 以及本任务指令不一致。本合同只采用后者的已批准明确规则：

- 未改 `occurredOn` 时保留原 `plannedForDate` 和 basis；
- 补记或显式改日时，用户必须明确确认新日期的历史 `plannedForDate`，并保存 `user_confirmed_history`；
- 当前 recording-context 路径才按保存时 schedule 计算，并保存 `schedule_at_recording`；
- 禁止用当前 schedule 预选后静默冒充历史事实。

项目所有者于 2026-08-19 批准本合同，同时确认以上是对已批准 S3-Q02-B 的执行解释，不授权按 §6.1 两行旧摘要采用当前 schedule。

## 4. 开始条件、基线与兼容性复核

- [x] 当前工作目录是仓库根；当前检出为干净 `dev`，无 staged、unstaged 或 untracked 变更。
- [x] `HEAD`、本地 `dev` 和现有 `origin/dev` tracking ref 均为 `9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be`。
- [x] 该 revision 已包含提交 `docs: approve S3 data control and export design (#25)`；S3 文档状态为已获项目所有者批准。
- [x] S1/S2、T801/T802 已在任务索引和证据账本中为完成/通过；T031 前置产品数据路径可用。
- [x] 当前 `schemaVersion = 1`，migration manifest 只有 `001_initial`；`001_initial.sql` 的历史始于 T003，当前任务禁止回写。
- [x] 当前 v1 表、CHECK、UNIQUE 与 FK 动作和 S3 §7.3 一致。
- [x] 当前验证命令、Windows CI、FakeClock、临时数据根及 evidence wrapper 已存在。
- [x] 无需新增或升级依赖。
- [x] 项目所有者明确批准本合同、S3-Q02-B 解释、精确 migration 和 structured permissions。
- [x] 批准后已 fetch 并重新核对 `dev` revision、工作树和兼容性；`dev` 与 `origin/dev` tracking ref 仍为 `9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be`，独立 worktree/branch 已建立。

### 4.1 当前实际契约复核结论

| 面 | `dev@9903994…` 当前事实 | T031 兼容要求 |
|---|---|---|
| Domain | ActionRecord 为 `completed/partial/stopped`；RoutineRecord 为四 outcome + 缺行 `unknown`；LocalDate 显式校验；父状态与 Record outcome 解耦 | 增加 update/backfill 和 provenance，不改变既有状态机/统计 |
| Application | 当前记录入口要求 pending Action + active Goal 或 active Routine；跨午夜依赖 sender-bound recording context；Routine 同日冲突 create-only | 保留当前入口；另建历史补记入口，允许终态/暂停父实体但绝不执行 post-record |
| Repository | `saveActionRecord`、`saveRoutineRecord`、`saveUnderstanding`、`saveConfusion` 是 upsert；`createRoutineRecord` 已是 create-only；Progress 是一致性事实查询 | T031 update 必须使用 `UPDATE ... WHERE id/parent` 且影响 1 行；backfill 使用 create-only；不得用 upsert 实现 update |
| SQLite v1 | 十个核心集合；Routine/Action/Goal FK cascade/SET NULL 与 ED-008 一致；Routine `(routine_id, occurred_on)` 唯一 | 只加 provenance 列；保持所有既有列、行、ID、关系、时间、FK、UNIQUE 和 CHECK 语义 |
| Migration runner | manifest 顺序/单 migration transaction 已存在；但版本写入当前固定使用 `INSERT metadata.schemaVersion`，已有 v1 升 v2 会触发 metadata 主键冲突 | 在同一允许文件内改为参数化 UPSERT；新库 v1 insert、已有库 v2 update 都必须仍处于 migration transaction 内 |
| Progress/Today | Progress 从 ActionRecord、未撤销 Understanding、open Confusion、RoutineRecord 即时计算；Today/day-state 从当前 LocalDate、schedule 和记录事实构建 | 成功后重新查询；不建累计或缓存表；原日/新日均可观察 |
| IPC/Preload | 固定 channel、严格多余字段拒绝、UUID/LocalDate/枚举/分钟校验、统一 sender/origin；Preload 顶层冻结且无通用 invoke | 增量固定 `dataControl` API；Renderer 不获得 SQL、path、Clock、Repository 或任意 channel |
| Renderer | 单一 React `App.tsx` 承载现有 Goal/Action/Routine/Record/Today/Progress 入口；无数据控制入口 | 在现有信息架构内加入最小数据控制路径，不新增核心概念或通用管理平台 |
| 测试/数据 | Vitest unit/integration、Playwright Electron E2E；每 case 唯一临时 DB/userData；真实关闭重开已有基础 | 所有 destructive/migration case 继续使用唯一临时根；禁止真实 `userData` |

兼容性结论：除已批准的 v2 provenance 列外，不需要额外 schema、依赖、产品决定或 S1/S2 语义变化。现存 upsert 只能保留给既有兼容写入/fixture；T031 新的 create/update 意图不得复用它来偷换语义。

### 4.2 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T011, T012, T013, T014, T021, T022, T023]
    blocks: [T032]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T032]
  revisions:
    required_dev_base: dev@9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be
  shared_surfaces:
    - SQLite migration manifest, routine_records and persistence DTOs
    - Record Domain/Application and Progress/Today query contracts
    - Main IPC composition, Preload API and Renderer App
    - T031/T032 export-facing RoutineRecord provenance contract
  external: []
```

`T032` 依赖 T031 的 v2 数据形状并与 migration、snapshot、Preload/Renderer 共享修改面，必须串行；T033 依赖 T032，不在 T031 中启动。

## 5. 精确 migration 合同

允许新增且只允许新增：

`src/infrastructure/sqlite/migrations/002_add_routine_record_planned_for_date_basis.sql`

精确 SQL：

```sql
ALTER TABLE routine_records
ADD COLUMN planned_for_date_basis TEXT NOT NULL DEFAULT 'schedule_at_recording'
CHECK (planned_for_date_basis IN ('schedule_at_recording', 'user_confirmed_history'));
```

同时在 `migrations.ts`：

- import 上述 SQL；
- `schemaVersion` 从 1 提升为 2；
- manifest 追加 `{ version: 2, name: '002_add_routine_record_planned_for_date_basis', sql }`；
- 保持现有逐 migration 的 `database.transaction`，SQL 成功后才把 metadata 更新为 `2`；
- 把当前只适用于首次 migration 的版本 `INSERT` 精确改为参数化 UPSERT：

```sql
INSERT INTO metadata (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

该 UPSERT 只写 `metadata.schemaVersion`：migration 1 在新库插入 `1`，migration 2 在既有/新建库更新为 `2`；不得吞掉 SQL、CHECK、FK 或其他 migration 失败。

v1 → v2 守恒判定：

1. S1-only v1 fixture 的全部集合、字段、ID、关系和 metadata 之外事实不变，且不生成 RoutineRecord；
2. S2 v1 fixture 覆盖四 outcome、planned true/false、所有生命周期/Today/子事实；去除新增 basis 后，迁移前后十个核心集合逐字段全等；
3. 每条既有 RoutineRecord 得到 `planned_for_date_basis='schedule_at_recording'`，原 `planned_for_date` 值不变；
4. 新建空库依次执行 001、002 并得到 schemaVersion 2；未知高于 2 的版本拒绝打开/写入；
5. FK 动作、Routine 唯一约束和其他 CHECK 继续成立，`PRAGMA foreign_key_check` 无结果；
6. 迁移失败注入必须发生在 002 `ALTER TABLE` 之后、metadata UPSERT 更新之前（例如临时 fixture trigger 拒绝 schemaVersion UPDATE），并证明整个 transaction 回滚：schemaVersion 仍为 1、`PRAGMA table_info(routine_records)` 不含新增列、既有行与关系逐集合全等；移除仅用于该 case 的故障注入后，同一合法 fixture 可成功迁移；
7. 不运行真实用户数据库 migration；自动化只使用每 case 唯一临时数据库，人工验收只使用明确的专用测试 `userData`。

新增列保留 DEFAULT 是 SQLite 对既有 v1 行进行非破坏性回填的组成部分；所有 v2 生产 INSERT/UPDATE 仍必须显式写入并读取 basis，不能依赖 DEFAULT 替代 Application 语义。

## 6. 允许修改范围

合同准备阶段当前只允许：

- `docs/implementation/T031_RECORD_DATA_CONTROL.md`
- `docs/implementation/metadata/T031.json`

合同获批后，生产实现只允许以下精确文件；需要其他文件时先停止并申请扩围：

- `src/domain/action-record.ts`
- `src/domain/routine-record.ts`
- `src/domain/data-control.ts`（新增）
- `src/domain/index.ts`
- `src/application/action-records.ts`
- `src/application/routine-records.ts`
- `src/application/data-control.ts`（新增）
- `src/application/ports/persistence.ts`
- `src/contracts/routine-records.ts`
- `src/contracts/data-control.ts`（新增）
- `src/contracts/shell.ts`
- `src/infrastructure/sqlite/migrations.ts`
- `src/infrastructure/sqlite/migrations/002_add_routine_record_planned_for_date_basis.sql`（新增）
- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/data-control-ipc.ts`（新增）
- `src/main/delete-preview-contexts.ts`（新增）
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

测试只允许：

- `tests/unit/action-record-domain.test.ts`
- `tests/unit/action-record-application.test.ts`
- `tests/unit/goal-application.test.ts`
- `tests/unit/routine-record-domain.test.ts`
- `tests/unit/routine-record-application.test.ts`
- `tests/unit/routine-application.test.ts`
- `tests/unit/progress-application.test.ts`
- `tests/unit/data-control-domain.test.ts`（新增）
- `tests/unit/data-control-application.test.ts`（新增）
- `tests/unit/delete-preview-contexts.test.ts`（新增）
- `tests/integration/sqlite-persistence.test.ts`
- `tests/integration/action-record-sqlite.test.ts`
- `tests/integration/routine-record-sqlite.test.ts`
- `tests/integration/goal-sqlite.test.ts`
- `tests/integration/routine-sqlite.test.ts`
- `tests/integration/data-control-sqlite.test.ts`（新增）
- `tests/integration/data-control-ipc.test.ts`（新增）
- `tests/e2e/data-control.e2e.test.ts`（新增）
- `tests/e2e/routine-record.e2e.test.ts`
- `tests/e2e/shell.e2e.test.ts`（2026-08-20 两次最小扩围；仅将 schemaVersion 期望从 `1` 同步为 `2`，并向顶层 API allowlist 追加 `dataControl`）
- `tests/e2e/windows-package-smoke.e2e.test.ts`

候选 CI 通过后的文档收口候选仅为以下文件，仍须按技能流程由项目所有者在 candidate CI 后再次批准精确事实与 push：

- `docs/implementation/T031_RECORD_DATA_CONTROL.md`
- `docs/implementation/metadata/T031.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `README.md`（仅在需要记录已交付持久能力时）
- `docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md`（仅在实现/测试落点需事实性补齐时；不得改需求语义）
- Draft PR body

PRD、DECISIONS、REQUIREMENTS_CHANGE_POLICY、已批准 S1/S2/S3 设计、`001_initial.sql`、依赖/lockfile、CI workflow、Electron 配置和 `user/` 均不在允许修改范围。

## 7. 固定实现契约

### 7.1 Record、Understanding 与 Confusion

- ActionRecord update 保持 `id/actionId/createdAt`；只显式修改 `occurredOn/durationMinutes/outcome/nextStep/note`，成功更新可信 `updatedAt`。
- RoutineRecord update 保持 `id/routineId/createdAt`；未改日保留 `plannedForDate/basis`，改日必须同时提交用户确认的历史计划标志并固定 `user_confirmed_history`。
- Backfill 的 `occurredOn` 必填且由 Renderer 显式选择；`createdAt/updatedAt` 使用真实保存 Instant。
- Backfill 只要求父 Action/Routine 仍存在，不要求 Action pending、Goal active 或 Routine active；不调用 post-record，不改变任何父状态、TodaySelection 或 Goal current-next。
- Action backfill 可在同一事务创建可选 manual Understanding/open Confusion；Routine backfill 保持四 outcome 与分钟矩阵。
- Routine 同 parent/LocalDate 冲突返回 `record-already-exists`；所有 update 的目标不存在返回 `not-found`，绝不创建新行。
- `UpdateUnderstandingText` 保留 ID、parent、source、revokedAt 和 createdAt；空白拒绝。`RevokeUnderstanding` 只允许从未撤销到撤销，重复撤销零变化并返回稳定错误。
- `UpdateConfusionText` 保留 open/resolved 状态；`ResolveConfusion` 只允许 open→resolved，写可信 resolvedAt 和可选 resolution；`ReopenConfusion` 只允许 resolved→open 并清空 resolvedAt/resolution；非法重复转换零变化。

Repository 至少提供 create-only、update-only、按 ID 读取和影响集合方法；update SQL 必须以稳定 ID 和不可变 parent 约束，并以 `changes === 1` 判定成功。任何 `save*` upsert 方法不得被 T031 update/backfill 命令用于替代上述意图。

### 7.2 删除影响与 token

删除根固定为五类：`action-record`、`routine-record`、`action`、`routine`、`goal`。

`findDeleteImpact(target)` 必须在一致性只读事务内依据 v2 真实 FK 路径取得并稳定排序以下集合：

- 将删除的 goals/actions/routines/routineScheduleDays/todaySelections/actionRecords/routineRecords/understandings/confusions/reviewResults ID；
- 将解除的 `(routineId, goalId)` 与 `(reviewResultId, goalId)` 关系；
- 将清空的 `(goalId, currentNextActionId)` 关系。

Application 从这些具体集合生成计数和规范 fingerprint；fingerprint 只覆盖目标、受影响 ID 与关系，不包含 Renderer 计数、标签或用户正文。

Main 签发 opaque `previewId` 并只在内存保存 sender、target、fingerprint、generatedAt：

- 同 sender/同 target 新 preview 使旧 token 失效；
- cancel、成功确认、同 sender 的任何有效确认尝试（包括 stale/存储失败）、reload/navigation、window destroyed/closed 和 app quit 都使 token 失效；
- 错 sender/伪造 token 不得读取、消费或破坏其他 sender 的 context；
- 本任务不新增未经设计批准的时间 TTL；“过期”由上述生命周期失效表达。

`ConfirmDelete` 只接受 `previewId + target + confirmation='permanently-delete'`。Main 验证 sender/token/target 后，把可信 fingerprint 交给 Application。Application 在单一 SQLite transaction 内重新计算影响并精确比较；不一致返回 `delete-preview-stale` 且零写入，一致时只执行一个根删除，依赖 FK cascade/SET NULL，并逐 ID/关系核对实际结果。返回的 actual counts 必须与 preview 一致。

取消、target 不存在、DTO/confirmation 非法、token 伪造/失效/重放/错 sender、stale、唯一冲突、Repository 故障、FK/跨行不变量或实际计数不一致均保持十个核心集合及关系零变化。失败不做补偿写，依赖 SQLite transaction 回滚。

### 7.3 删除语义与重查

- ActionRecord：删除自身、Understanding、Confusion。
- RoutineRecord：删除自身；相应日期重新投影为 `unknown`（若按查询规则适用）。
- Action：删除自身、ActionRecord、Understanding、Confusion、TodaySelection；引用它的 Goal current-next 清空。
- Routine：删除自身、schedule days、RoutineRecord；Goal 保留。
- Goal：删除自身及其 Action 分支；Routine 和 ReviewResult 保留并 `goalId=null`；Routine schedule/Record 保留。
- pause/end/complete/cancel/reschedule 不是 delete，必须继续保留历史。
- 成功后 Renderer 重新查询 data-control index/detail、Progress、Today；改日同时使原日和新日 day-state/筛选结果可观察；删除成功后只显示剩余事实。

### 7.4 IPC、Preload 与 Renderer

- 新增固定、冻结的 `window.myTracer.dataControl` 方法；不得暴露通用 invoke、SQL、path、Clock、Repository、Electron 对象或任意 cascade 选择。
- DTO 严格拒绝多余字段并运行时校验 UUID v4、LocalDate、整数分钟、枚举、文本、判别联合和固定确认字面量。
- Renderer 不能提交 createdAt/updatedAt、当前 Today 日期、统计结果、影响计数、fingerprint 或 provenance；唯一例外是 Routine 历史补记/改日窄 DTO 中用户明确确认的 `plannedForDate`，Application 固定 basis。
- UI 提供最小 data-control 索引/详情、显式日期编辑、历史计划事实确认、永久删除警告、影响计数、取消和二次确认；Goal/Routine 优先显示 pause/end，永久删除入口保持清楚区别。
- 错误至少稳定区分 `validation`、`not-found`、`invariant-violation`、`record-already-exists`、`invalid-delete-preview`、`delete-preview-stale`、`persistence-failed`，且不泄露 SQL、堆栈、绝对路径、token context 或用户正文。

## 8. 明确非范围

- T032 完整导出、ExportPort、系统保存对话框、JSON envelope、引用校验和文件写入。
- T033 AI disabled/not-configured/failure 聚合回归；生产 Provider、模型、SDK 或 AI 写权限。
- 自动导入/恢复、回收站、撤销删除、自动备份、同步、账号、审计日志、事件溯源、历史版本浏览。
- Action/Routine Goal reassign、Goal/Record 历史归属快照、schedule/minimumAction 历史、复杂日历。
- 改变 Action/Goal/Routine 生命周期、Today/focus/intention、Progress 公式、unknown/四 outcome、LocalDate 或跨午夜既有语义。
- 修改 `001_initial.sql`、新增 migration 之外的表/列/索引、引入或升级依赖。
- 标记 Draft 为 Ready、合并 `dev/main`、创建 tag/release、启动 T032/T033 或声明完整 AC-07。

## 9. 必须保持的不变量

- 所有 mutation 经过 Application command、Domain invariant 和单一 UoW transaction；Query 不写数据。
- Renderer 无 Node/SQLite/文件/Clock/凭据/Provider/任意 IPC 权限；Main 先校验 sender/origin。
- `unknown` 仍是缺行，不迁移或补行为 `not_done`；`acted`、`target_met`、`intentional_rest`、`not_done` 保持区别。
- ActionRecord 每条分别计真实行动；Routine 仅 `target_met/acted` 计真实行动，只有 planned `target_met` 计计划达成；0 分钟不改变 outcome。
- Understanding 仅未撤销项进入普通 Progress；Confusion 仅 open 项进入普通 Progress；时间/文本不得自动推断掌握或解决。
- Record 编辑/补记不改变 Action/Goal/Routine 状态、TodaySelection、Goal current-next 或 goalId。
- 发生日是显式 LocalDate；重开、改名、schedule 改变和删除其他对象不重算剩余历史日期或计划快照。
- pause/end 保留历史；硬删除严格遵循 preview、二次确认、stale、单事务 cascade/SET NULL 和零变化保证。
- 测试只用 FakeClock 和每 case 唯一临时 DB/userData；不访问、复制、迁移或删除真实用户数据。

局部最高风险：upsert 偷换 update/create、历史计划事实被当前 schedule 冒充、preview 与真实 FK 分叉、token 跨 sender/重放、删除失败半写、Goal delete 误删 Routine/Review、投影缓存漂移。

## 10. 交付物

- [ ] ActionRecord/RoutineRecord update/backfill 的 Domain、Application、Repository、SQLite、IPC、Preload、Renderer 纵向路径。
- [ ] `planned_for_date_basis` v2 非破坏性 migration、类型/DTO/读写和 v1 守恒/失败回滚。
- [ ] Understanding 修改/撤销与 Confusion 修改/resolve/reopen。
- [ ] 五类删除根的精确影响预览、sender-bound 一次性 token、stale 校验和事务性确认。
- [ ] cascade、SET NULL、current-next 清空、取消/冲突/故障零变化和真实关闭重开。
- [ ] 成功后 Progress、Today/day-state、data-control detail 从事实重查。
- [ ] 对应 unit、SQLite/Repository、IPC、E2E 和 S1/S2 affected regression。
- [ ] 完整 diff 自查、独立只读 review、deterministic evidence、candidate/final-head CI 和获批文档收口。

## 11. 可判定验收与完成条件

1. update 不存在 ID 返回 `not-found`，快照零变化；backfill ID/同日冲突返回稳定错误且不覆盖现有行。
2. ActionRecord 的 ID/parent/createdAt 守恒；RoutineRecord 未改日时 plan snapshot/basis 守恒，改日/补记时用户确认值与 `user_confirmed_history` 原子保存。
3. 终态 Action、paused/ended Goal/Routine 只要父实体仍存在即可补记；补记前后父状态、goalId、TodaySelection、Goal current-next 逐字段相同。
4. 修改发生日 A→B 后，A/B 两日、包含端点的 Progress 过滤、Today/day-state 与详情均从事实重算；不创建投影累计表。
5. Understanding/Confusion 六个明确意图遵循状态前置、可信时间和 Progress 过滤；重复/非法转换零变化。
6. 新建 v2、S1-only v1→v2、S2 v1→v2、未知高版本和 migration 失败回滚全部通过；`001_initial.sql` 未改变。
7. 五类删除根的 preview ID/关系/计数与实际完全一致；Renderer 伪造 count/fingerprint/cascade 字段被拒绝。
8. cancel、错 sender、伪造/重放/失效 token、target mismatch、stale、非法 confirmation、Repository 故障和实际结果不一致均证明数据库逐集合/逐关系零变化。
9. Action/Routine/Goal 删除分别证明 cascade、Routine/Review SET NULL 与 current-next 清空；确认成功在一个事务提交，故障注入完整回滚。
10. 完全关闭 SQLite/Electron 后从同一隔离临时根重开，修改、补记、删除、detach、basis 和投影结果一致。
11. S1/AC-01、S2/AC-03、AC-04 affected regression 与 `npm.cmd run verify` 在最终候选 revision 通过；每个 destructive case 使用唯一临时数据库。
12. 完整 diff 自查和独立 review 无未处理 material finding；无未批准文件、依赖、迁移、权限或范围变化。
13. candidate CI 通过后按 owner 单独批准范围完成 docs closeout，final-head CI 通过；任务状态/证据只记录真实 revision 和结果。
14. `MANUAL`：项目所有者使用专用测试 `userData` 验证日期/历史计划确认、父状态隔离、删除预览/取消/确认、pause/end 区别和重开；执行前保持 `pending`。
15. T031 完成报告明确不声明 T032、T033、完整导出、完整 AC-07、Ready、merge、tag 或 release。

## 12. 验证计划

### 12.1 合同和 metadata 门

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
git diff --check
```

### 12.2 针对性 unit / integration / IPC

```powershell
npm.cmd run test:unit -- tests/unit/action-record-domain.test.ts tests/unit/action-record-application.test.ts tests/unit/routine-record-domain.test.ts tests/unit/routine-record-application.test.ts tests/unit/data-control-domain.test.ts tests/unit/data-control-application.test.ts tests/unit/delete-preview-contexts.test.ts
npm.cmd run test:integration -- tests/integration/sqlite-persistence.test.ts tests/integration/action-record-sqlite.test.ts tests/integration/routine-record-sqlite.test.ts tests/integration/data-control-sqlite.test.ts tests/integration/data-control-ipc.test.ts
```

### 12.3 T031 E2E 与 affected regression

```powershell
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/data-control.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts
```

上述四个文件分别覆盖 T031、AC-01、AC-03 与 AC-04 的连续受影响路径；若测试数量/名称变化，证据记录实际输出，不用文件名代替行为通过证明。

### 12.4 聚合、diff 与 evidence

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
git diff --check
npm.cmd run governance:metadata:check
node tools/evidence/capture-command.mjs --task T031 --gate task-candidate --base-revision <approved-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

`verify` 已包含 build 和 E2E。所有命令在 Windows、Node 24.18.0、npm 11.16.0、Electron 43.3.0 环境执行；SQLite destructive/migration 测试使用唯一临时数据根。若 Electron 无法在当前宿主启动，必须在获准的 Windows 桌面环境完成，不能用 unit/integration 替代 E2E。

### 12.5 Hosted CI、freshness 与人工步骤

1. 第一个有意义 commit 后，在获批 publication grant 内创建 Draft PR 到 `dev` 并记录 early CI；它不证明完成。
2. Implementation Candidate 完成完整 diff 自查、独立 review、Integration Freshness Gate 和 affected regression 后，推送并等待 exact head/test-merge candidate CI。
3. candidate CI 绿后暂停，向项目所有者申请精确 docs closeout；批准后独立 docs commit/push，并等待 final-head CI。
4. 项目所有者在专用测试数据根执行本合同第 11.14 条人工清单；未执行前为 `pending`。
5. 未获 Ready/merge 授权；任务交付后只报告 merge handoff，不自行推进。

## 13. Git、GitHub、依赖与外部操作权限

以下 structured permissions 已由项目所有者随本合同批准并生效：

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
  migration_change: true
  external_write: true
```

权限限制：

- `local_write` 仅限第 6 节精确文件；
- 项目所有者于 2026-08-20 分别批准 `T031_ESCALATION_PROPOSAL_001` 与 `T031_ESCALATION_PROPOSAL_002` 的最小扩围；授权只覆盖第 6 节所列 shell E2E 的 schemaVersion 断言与顶层 `dataControl` allowlist 项，不扩展产品、migration、依赖或其他测试行为；
- `migration_change: true` 仅限第 5 节精确 002 migration、manifest/schemaVersion 2 及对应临时 fixture 测试；
- `external_write: true` 仅限 push `task/T031-record-data-control`、创建/更新 Draft PR 到 `dev`、读取/触发该 PR CI、上传脱敏 `.tmp/evidence/*.json` artifact，以及 owner 批准后的 Draft PR body/docs closeout；
- 不授权 branch protection、Secrets、Issue/Project、Ready、merge、远端分支删除、force-push、main、tag、release 或其他服务写入；
- 不授权 `npm install`/依赖变化、live AI、真实网络业务调用、生产数据库迁移或真实用户数据破坏；
- destructive 行为仅对测试自动创建并验证归属的临时数据库执行。

```yaml
integration:
  target_branch: dev
  base_revision: dev@9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

若合同批准时 `dev` 已推进，必须在任何分支/工作树创建前重新复核最新授权 revision 并更新合同；candidate 前若再次变 stale，只允许普通 merge `dev` 到任务分支，禁止 rebase/force-push 改写已发布历史。

## 14. 风险与停止条件

出现以下任一情况立即停止受影响工作，并按 Escalation Proposal 流程报告实际 branch/revision/命令/结果：

- 最新授权 `dev` 不含已批准 S3 设计，或 schemaVersion、migration、FK、DTO、Progress/Today 含义与本合同复核不一致；
- 项目所有者未确认第 3.2 节 S3-Q02-B 解释，或实现需要当前 schedule 代替历史用户确认；
- 需要修改 `001_initial.sql`、增加第 5 节之外的 schema、执行破坏性/不可逆 migration 或迁移真实用户数据库；
- 需要新增/升级依赖、通用 CRUD/IPC、Renderer SQL/path/Clock 权限、AI/Provider 或外部写入扩权；
- 需要改变 Record/状态/Today/current-next/goalId/Progress/unknown/LocalDate/删除语义；
- 需要完整导出、自动导入、回收站、审计、T032/T033 或 S4～S7；
- 需要第 6 节之外的文件，或与用户/其他 worktree 未提交修改重叠而不能安全隔离；
- update/backfill 只能通过 upsert 实现，或无法证明 preview/actual 一致、stale、取消/失败零变化、事务回滚与真实重开；
- 任何自动化会访问真实 Electron `userData`，或 destructive target 不能证明位于本 case 唯一临时根；
- 无法把证据绑定到明确 revision、环境、命令和实际结果。

## 15. 完成报告要求

完成报告必须使用中文并列出：

- 所有实际变更文件和可观察结果；
- FR/AC/D/ED/S3-Q 覆盖及 T031 对 AC-07 的精确子集；
- migration 前后版本、fixture 守恒、失败回滚和真实重开结果；
- 精确验证命令、exit code、Windows/Node/Electron、临时数据隔离和 evidence artifact；
- branch、commit、Draft PR、early/candidate/final-head CI、task delivery revision 与 freshness 状态；
- 完整 diff 自查和独立 review 结论；
- 自动化/人工验收状态、残余风险、未验证内容；
- 是否发现需求冲突、设计摘要漂移、范围/权限/依赖变化；
- 明确说明 Ready、merge、T032/T033、完整导出与完整 AC-07 均未由 T031 自动完成。

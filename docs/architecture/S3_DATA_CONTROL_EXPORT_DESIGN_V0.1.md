# MyTracer v0.1 S3 数据可控与完整导出整体设计

> 文档状态：**已获项目所有者批准；S3-Q01=A、S3-Q02=B、S3-Q03=A、S3-Q04=A。下文权限与门禁措辞记录设计批准时边界。**
>
> 后续交付结果：T031～T033/T803 已完成并归档；PR #29 合入 `dev@eec093924ae061876805c657742283097824df2c`，里程碑 PR #30 合入 `main@75e51b4e63f8c9df960cccb444515b9e89be5fbd`，并发布 `v0.1.0-beta.1`。
>
> 批准日期：2026-08-19
>
> 适用范围：S3 / E3-01～E3-03 的后续任务合同、实现、测试与 AC-07 验收设计输入
>
> 核心验收：AC-07 持久性与备份；同时回归 S1/AC-01 与 S2/AC-03、AC-04

## 0. 文档用途、依据与权限边界

本文在设计批准时把冻结产品语义、已批准工程决定、已验收 S1/S2 契约和当时 `schemaVersion = 1` 的实际数据结构收敛为 T031～T033 的整体设计。项目所有者批准本文及第 12 节四项决定后，各任务仍分别通过合同获得文件、migration、验证和 Git/GitHub 权限。

解释顺序保持为：

1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../PRODUCT_REQUIREMENTS_V0.1.md)；
2. [`DECISIONS.md`](../DECISIONS.md)；
3. [`REQUIREMENTS_CHANGE_POLICY.md`](../REQUIREMENTS_CHANGE_POLICY.md)；
4. 总体架构、领域、数据、AI 边界、测试、追踪、实施计划与工程决定；
5. 已批准并已验收的 [`S1_CORE_LOOP_DESIGN_V0.1.md`](./S1_CORE_LOOP_DESIGN_V0.1.md) 和 [`S2_ROUTINE_INTENTION_DESIGN_V0.1.md`](./S2_ROUTINE_INTENTION_DESIGN_V0.1.md)；
6. [`TASK_INDEX_V0.1.md`](../implementation/TASK_INDEX_V0.1.md)、[`TASK_TEMPLATE.md`](../implementation/TASK_TEMPLATE.md) 和 [`GITHUB_WORKFLOW_V0.1.md`](../implementation/GITHUB_WORKFLOW_V0.1.md)；
7. 当前 `src/` 中已验收的 S1/S2 Domain、Application、IPC、Repository、SQLite v1 schema 和 DTO 契约。

`user/` 不属于本文依据，不得成为后续任务的设计、实现、测试或验收依赖。

本文使用以下标记：

| 标记 | 含义 |
|---|---|
| **冻结/已批准** | 直接来自 FR、AC、D、ED 或已批准 S1/S2 设计，不得由 S3 改变 |
| **现有契约** | 当前已验收的 S1/S2 代码、schema、DTO 和查询事实，实施前仍须按最新授权 `dev` 复核 |
| **S3 已批准设计** | 本文及第 12 节项目所有者选择，后续任务合同不得自行改变 |
| **延期/非范围** | 不进入 S3，不得成为 T031～T033 的接口、数据、依赖或验收前置 |

本文的设计批准和“准备实现”标注不授权：

- 修改代码、测试、配置、依赖、migration、任务索引或验收证据；
- 把任务置为 `active`，或执行 branch、worktree、代码 commit、push、PR、merge、tag 或 release；
- 执行应用、migration、导出写入或任何真实数据操作；
- 把“可以导出”描述为“已经可以自动恢复”。

## 1. 基线核对与冲突结论

### 1.1 设计批准时的当前事实

- `TASK_INDEX_V0.1.md` 将 T031、T032、T033 分别映射到 E3-01、E3-02、E3-03，当前均为 `pending`，依赖顺序为 T031 → T032 → T033。
- S1/S2 已完成 Goal、Action、Routine、TodaySelection、ActionRecord、RoutineRecord、Understanding、Confusion 和 Progress 的真实 SQLite 纵向路径；S3 必须兼容这些已验收行为。
- 设计批准时 SQLite `schemaVersion = 1`，唯一已发布 migration 为 `001_initial.sql`。v1 已具备全部核心表、状态字段、LocalDate 字段、外键和删除动作，但缺少 S3-Q02-B 已批准的 Routine 历史计划事实 provenance；T031 后续通过顺序 v2 migration 补充。
- 当前 `CorePersistenceSnapshot` 已覆盖 `goals`、`actions`、`routines`、`routineScheduleDays`、`todaySelections`、`actionRecords`、`routineRecords`、`understandings`、`confusions`、`reviewResults`；但现有 `readSnapshot()` 是测试/检查入口，没有把 `schemaVersion` 与集合绑定为一个生产导出契约，也没有在方法内部保证跨全部集合的一致性只读事务。
- 当前 Progress 没有累计表；`GetProgress` 从 ActionRecord、有效 Understanding、open Confusion 和 RoutineRecord 的一致性快照即时计算。S3 不新增可漂移累计值。
- 当前生产 AI 配置是未配置空边界，测试基础设施已有可脚本化 fake provider。S3 不依赖真实 Provider。

### 1.2 冲突结论

未发现两条 MUST、已批准 D/ED 或已验收 S1/S2 契约之间存在不可调和冲突，因此本设计可以覆盖完整 S3。

本文识别出的四项实施级选择已经由项目所有者确认：

1. 历史补记是否允许关联已完成/取消/重新安排 Action，或 paused/ended Goal/Routine；
2. RoutineRecord 补记或显式改日时，在没有 schedule 历史的 v1 中如何产生新的 `plannedForDate`；
3. 删除预览与最终执行之间的数据变化是否必须使预览失效并要求重新预览；
4. 完整导出 v1 的精确 envelope、枚举说明和安全交付规则。

第 12 节记录批准结果及未选方案，后续合同只能采用批准项。ED-008 的硬删除、ED-014 的 UTF-8 JSON、ED-017 的跨午夜语义、D-111 的完整导出且无自动导入等事项已经明确，本文不把它们重新包装成开放问题。

## 2. S3 目标、范围与完整流程

### 2.1 可观察结果

S3 完成后，用户应能在同一明确版本连续完成：

```text
创建并保留 S1/S2 核心数据
  → 显式修改现有 ActionRecord 或 RoutineRecord
  → 显式选择 LocalDate 补记 Record
  → Progress、Today、详情从修改后的事实重算
  → 预览 Record / Action / Routine / Goal 的删除影响
  → 用户二次确认，或取消并保持零变化
  → 在单一事务内执行硬删除、级联或解除关联
  → 从剩余事实重新查询 Progress
  → 关闭并重开，数据和关系保持一致
  → 从一致性只读快照生成版本化 UTF-8 JSON 完整导出
  → 结构与引用校验通过后安全交付最终文件
  → 在 AI 关闭、未配置或失败时重复 CRUD、Progress、删除和导出
```

### 2.2 S3 包含

| 能力 | S3 处理 |
|---|---|
| Record 修改 | 显式修改发生日、时长、outcome 和既有可选文本；保持 ID 与所属父实体 |
| Record 补记 | 用户必须显式选择 `occurredOn` LocalDate；补记不伪造当前实体状态 |
| 子事实控制 | 修改/撤销 Understanding；修改、resolve、reopen Confusion |
| 删除 | 只读影响预览、二次确认、预览新鲜度校验、单事务硬删除、级联/解除关联 |
| Progress/Today | 所有修改和删除成功后从剩余事实重新查询，不保存累计投影 |
| 完整导出 | 版本化 UTF-8 JSON、全部未删除核心状态和关系、结构/引用校验、安全临时写入与最终交付 |
| 持久性 | v1 → v2 migration 兼容、真实关闭重开、外键与 LocalDate 守恒 |
| AI 降级 | disabled、not-configured、failure 三态下数据能力回归；不实现 Provider |

### 2.3 明确非范围

- 自动导入、一键恢复或把导出文件直接重新写回 SQLite；
- 回收站、撤销删除、通用软删除和自动备份；
- 云同步、账号、远程存储、共享或团队能力；
- 通用审计日志、事件溯源、变更时间线或历史版本浏览；
- AI Provider 接入、模型/SDK、长期 AI 记忆、对话历史或 AI 写权限；
- S4～S7、Recovery、Review、AI Start Help 和延期能力；
- 改换 Action/Routine 的 Goal 归属、增加 Goal/Record 历史归属快照；
- schedule/minimumAction 历史版本、复杂日历或历史空白计划日重建；
- 修改已发布 `001_initial.sql`，或为未来功能预建字段。

## 3. Record 修改、补记与投影重算

### 3.1 ActionRecord 可修改范围

| 字段/关系 | 规则 |
|---|---|
| `id` | 不可修改；保持事实身份 |
| `actionId` | 不可修改；禁止借编辑把历史 Record 移到另一个 Action/Goal |
| `occurredOn` | 默认不变；只有用户显式开启“修改发生日”并提交合法 LocalDate 时才改变 |
| `durationMinutes` | 可修改；必须是非负整数，0 仍表示少于一分钟但确有行动 |
| `outcome` | 可在 `completed | partial | stopped` 中显式修改；不得自动改变 Action 状态 |
| `nextStep` | 可修改或清空；仍只是该 Record 的文本，不自动创建 Action 或更新 Goal 当前下一步 |
| `note` | 可修改或清空 |
| `createdAt` | 不变；继续表示原保存瞬时值 |
| `updatedAt` | 成功修改时由可信 Clock 更新 |
| Understanding/Confusion | 使用独立意图级命令修改，不通过整份 Record DTO 任意替换子集合 |

### 3.2 RoutineRecord 可修改范围

| 字段/关系 | 规则 |
|---|---|
| `id` | 不可修改 |
| `routineId` | 不可修改；禁止跨 Routine 移动历史事实 |
| `occurredOn` | 默认不变；用户显式改日时校验 LocalDate 和同 Routine/日期唯一约束 |
| `outcome` | 可在四种持久化结果中显式修改；`unknown` 永远不能保存 |
| `plannedForDate` | 发生日不变时保留旧快照；补记或显式改日时由用户在窄 DTO 中确认，按第 3.5 节保存 |
| `plannedForDateBasis` | 不可任意修改；记录计划标志来自 schedule 计算还是历史用户确认 |
| `durationMinutes` | `target_met/acted` 可空或非负整数；`intentional_rest/not_done` 必须为 null |
| `note` | 可修改或清空 |
| `createdAt/updatedAt` | `createdAt` 不变；成功修改时更新 `updatedAt` |

同一 Routine/LocalDate 已存在另一条 Record 时，补记或改日必须返回稳定冲突并零变化，不得 upsert 覆盖。

### 3.3 Understanding 与 Confusion

- `UpdateUnderstandingText` 只修改用户确认文本，不改变来源；空白文本拒绝。
- `RevokeUnderstanding` 写可信 `revokedAt`，普通 Progress 不再显示；它不是通用软删除，也不引入回收站。
- `UpdateConfusionText` 修改文本但保持当前 open/resolved 状态。
- `ResolveConfusion` 由用户明确执行，写 `status=resolved`、可信 `resolvedAt` 和可选 resolution。
- `ReopenConfusion` 由用户明确执行，恢复 `status=open` 并清空 `resolvedAt/resolution`。
- AI、时间、其他 Record 或文本相似度不得自动确认、撤销、解决或重开子事实。

### 3.4 补记规则

- `BackfillActionRecord` 与 `BackfillRoutineRecord` 是独立命令，不复用当前记录的 recording-context 日期捕获。
- 补记表单必须让用户显式选择 `occurredOn`；DTO 中该字段必填，即使用户选择今天也不能省略为隐式默认。
- Main 对显式 LocalDate 做运行时校验；Renderer 不能提交可信 `createdAt`、`updatedAt` 或统计结果。只有 Routine 历史补记/显式改日的窄 DTO 可以提交用户确认的 `plannedForDate`，Application 必须同时固定 provenance。
- ActionRecord 补记允许同一次事务创建可选 manual Understanding 和 open Confusion；不执行 `postRecord`，不改变 Action 生命周期、TodaySelection 或 Goal 当前下一步。
- RoutineRecord 补记保留四 outcome、分钟和非计划日语义；不会生成 schedule row，也不会把历史空白日批量补为 `not_done`。
- 补记的 `createdAt/updatedAt` 是实际保存瞬时值，不伪装为发生日；行为时间以用户选择的 LocalDate 为权威。

### 3.5 Routine `plannedForDate` 已批准规则

v1 不保存 schedule 历史，S2-Q03-A 已明确不重建历史空白计划日。项目所有者选择 S3-Q02-B，因此 T031 必须通过非破坏性 migration 增加来源字段，例如：

```text
routine_records.planned_for_date_basis
  schedule_at_recording       // 当前记录按保存时 schedule 计算；现有 v1 行迁移为此值
  user_confirmed_history      // 补记或显式改日时由用户确认计划事实
```

字段名可以在 T031 合同中按现有命名规范微调，但两个含义、非空约束和导出要求不得改变。批准规则为：

- 修改 RoutineRecord 但未改 `occurredOn`：保留既有 `plannedForDate`，不得因当前 schedule 改变而回算；
- 补记 RoutineRecord：用户必须显式选择 `occurredOn`，并明确确认该日是否为当时计划日；保存 `plannedForDate` 与 `plannedForDateBasis=user_confirmed_history`；
- 显式修改 RoutineRecord `occurredOn`：旧计划快照对新日期已无意义，用户必须同时明确确认新日期的历史计划事实，并保存 `user_confirmed_history`；
- 当前 recording-context 路径继续由 Main/Domain 按保存时 schedule 计算 `plannedForDate`，保存 `schedule_at_recording`，Renderer 不提交该标志；
- 只修改 outcome、分钟或 note 而不改发生日时，`plannedForDate` 与 basis 均保持不变；
- UI 必须把该输入表达为用户对历史计划事实的确认，不得用当前 schedule 预选后静默保存，也不得声称系统重建了历史 schedule；
- `plannedForDateBasis` 是事实来源说明，不建立 schedule/minimumAction 历史、审计日志或事件溯源。

### 3.6 当前实体状态与投影

修改或补记 Record 永远不得：

- complete、cancel、reschedule 或恢复 Action；
- pause、resume、end Goal/Routine；
- 创建、删除或改变 TodaySelection；
- 设置或替换 Goal `currentNextActionId`；
- 改换 Action/Routine 的 Goal 关联；
- 根据 outcome、分钟或文本推导掌握度、完成率、失败或人格评价。

成功提交后，Renderer 重新执行受影响的只读查询：

- `GetProgress` 从当前 ActionRecord、有效 Understanding、open Confusion 和 RoutineRecord 重算；
- `GetRoutineDayState` 和 `GetToday` 从目标 LocalDate 与当前事实重建；
- Record/Goal/Action/Routine 详情重新读取；
- 若发生日从 A 改到 B，A、B 两日及包含它们的 Goal/周期过滤结果都必须可观察到变化。

S3 不创建 Progress、Today 或详情缓存表。若 Renderer 使用内存缓存，成功命令必须使相关 query key 失效；缓存失效不是事实来源。

## 4. 删除模型、影响预览与事务

### 4.1 冻结删除语义

S3 使用 ED-008 已批准的显式硬删除，不引入回收站或通用软删除：

| 删除根 | 硬删除/级联 | 保留并解除关联 | 其他关系变化 |
|---|---|---|---|
| ActionRecord | 该 Record、其 Understanding、Confusion | — | Progress 从剩余事实重算 |
| RoutineRecord | 该 Record | — | 对应日期重新观察为 `unknown`（若当前查询规则适用） |
| Action | Action、ActionRecord、Understanding、Confusion、TodaySelection | — | 引用它的 Goal `currentNextActionId` 置 null |
| Routine | Routine、RoutineScheduleDay、RoutineRecord | — | Goal 本身不受影响 |
| Goal | Goal、其 Action、ActionRecord、Understanding、Confusion、TodaySelection | Routine、ReviewResult | 所保留对象的 `goalId` 置 null；Routine schedule/Record 保留 |

Goal 删除不会删除关联 Routine 或 ReviewResult。解除关联后的 Routine 及其 Record 继续出现在全局查询和完整导出中，但不再属于已删除 Goal 过滤结果。

### 4.2 pause/end 与 delete 严格区分

- Goal/Routine pause/end 只改变生命周期状态并保留所有历史、关系和导出内容。
- Action complete/cancel/reschedule 是生命周期转换，不是 delete；按 S1 已批准规则保留既有 Record 和必要 TodaySelection 历史。
- 删除入口必须使用“永久删除”语义和不可逆警告，不能复用 pause/end/complete/cancel 文案。
- UI 应优先向 Goal/Routine 用户展示 pause/end；只有用户明确进入永久删除入口才生成影响预览。

### 4.3 影响预览 DTO

`PreviewDeleteImpact` 是只读 Query，目标使用判别联合：

```text
DeleteTarget
  action-record(recordId)
  routine-record(recordId)
  action(actionId)
  routine(routineId)
  goal(goalId)

DeleteImpactPreview
  previewId                 // Main 生成的 opaque、一次性、sender-bound token
  target
  targetLabel               // 最小显示名称，不包含整份用户内容
  generatedAt
  irreversible = true
  deleteCounts
    goals
    actions
    routines
    routineScheduleDays
    todaySelections
    actionRecords
    routineRecords
    understandings
    confusions
    reviewResults
  detachCounts
    routinesFromGoal
    reviewResultsFromGoal
  clearReferenceCounts
    goalCurrentNextAction
```

预览必须在一致性只读快照中按实际外键路径取得具体受影响 ID 集合，再由 Application 生成计数。不能只用估算、界面当前列表或逐层异步查询拼接。

### 4.4 二次确认与预览新鲜度

`ConfirmDelete` 只接受：

```text
previewId
target
confirmation = permanently-delete
```

Main 将 preview context 绑定到可信 sender、目标和受影响 ID/关系指纹；Renderer 不能提交自己的计数或级联选择。确认时必须在同一 SQLite 事务内：

1. 验证 preview context 未取消、未消费、属于同一 sender/target；
2. 重新读取并计算实际影响；
3. 与预览时的 ID/关系指纹精确比较；
4. 若不一致，返回 `delete-preview-stale`，零写入并要求重新预览；
5. 一致时执行一个根删除，依赖已批准外键 cascade/SET NULL，并校验实际变化；
6. 成功提交后消费 token，返回实际计数；
7. Renderer 重新查询 Progress、Today 和相关详情。

窗口关闭、navigation/reload、应用退出、用户点击取消或开始新的同目标预览时，旧 token 失效。取消只丢弃内存 context，不写 SQLite。

### 4.5 零变化保证

以下情况必须保持核心数据库逐集合、逐关系零变化：

- 用户取消预览或二次确认；
- target 不存在、类型/ID/confirmation 非法；
- 预览 token 伪造、过期、已消费、sender/target 不匹配；
- 预览后数据变化导致 stale；
- 外键、跨行不变量、Repository 或存储故障；
- 任一步实际删除/解除关联数量与计算结果不一致。

事务失败后不得通过“补偿写入”修复半删除；SQLite 事务本身必须回滚全部变化。失败的确认 token 失效，用户重新预览后才能再次确认。

## 5. 版本化完整导出契约

### 5.1 导出 envelope v1

S3 提案把首个契约固定为：

```text
MyTracerCoreExportV1
  format = "mytracer-core-export"
  exportVersion = 1
  sourceDataVersion              // 从同一 SQLite 快照的 metadata.schemaVersion 读取
  appVersion?                    // 仅产品版本，不影响导入承诺
  exportedAt                     // ClockPort.nowInstant()
  localTimeZone?                 // 解释导出环境，不改变 occurredOn
  enumValues
    goalStatus                   // active, paused, ended
    actionStatus                 // pending, completed, cancelled, rescheduled
    routineStatus                // active, paused, ended
    actionRecordOutcome          // completed, partial, stopped
    routineRecordOutcome         // target_met, acted, intentional_rest, not_done
    routinePlannedForDateBasis   // schedule_at_recording, user_confirmed_history
    todayCommitment              // focus, intention
    understandingSource          // manual, ai_candidate_confirmed
    confusionStatus              // open, resolved
  data
    goals[]
    actions[]
    routines[]
    routineScheduleDays[]
    todaySelections[]
    actionRecords[]
    routineRecords[]
    understandings[]
    confusions[]
    reviewResults[]
```

`unknown` 不属于 `routineRecordOutcome`，因为它是缺行投影而不是持久化状态。`sourceDataVersion` 与 `exportVersion` 独立：前者描述 SQLite 数据版本，后者描述 JSON 契约版本。

### 5.2 包含规则

导出必须包含所有未硬删除核心状态和必要关系，包括：

- active/paused/ended Goal 与 Routine；
- pending/completed/cancelled/rescheduled Action；
- Goal 当前下一步引用、Action/Routine 可空 Goal 关联；
- 完整 Routine 星期集合；
- 全部历史 TodaySelection，包括 focus/intention 与 `selectedBy=user`；
- 全部 ActionRecord/RoutineRecord 的 LocalDate、结果、时长、计划快照、计划事实来源和可选文本；
- 已确认且仍有效或已 revoked 的 Understanding，保留 source/revokedAt；
- open/resolved Confusion，保留 resolvedAt/resolution；
- ReviewResult 及其可空 Goal 关联，即使 S3 时正常集合为空；
- 所有稳定 ID、必要审计 Instant、枚举值和引用。

硬删除对象不进入导出。导出不从 UI 当前筛选、Progress 投影或“活跃状态”筛选构造；必须读取全部核心集合。

### 5.3 排除规则

导出必须排除：

- AI API key、safeStorage 密文、Provider credential 或环境变量；
- 未确认 AI 草稿、prompt、request/response、会话输入和对话历史；
- 技术日志、诊断正文、堆栈、缓存、临时 preview/recording context；
- SQLite 文件路径、Electron `userData` 路径、导出临时路径和测试临时根；
- CI artifact、测试日志、fixture 元数据、应用安装路径和系统环境变量；
- 非核心 metadata 表内容；只在 envelope 公开经过校验的 `sourceDataVersion`。

自动化测试使用临时数据库时，fixture 的核心业务字段可以出现在测试导出中，但任何临时路径或测试基础设施信息不得成为导出字段。

### 5.4 一致性只读快照

T032 必须新增生产用途的意图级 Repository 方法，例如：

```text
readCompleteCoreSnapshot()
  -> { sourceDataVersion, coreSnapshot }
```

该方法在一个只读 SQLite transaction/snapshot 内读取版本与全部集合，使用稳定显式排序，返回脱离连接的不可变数据。现有 `readSnapshot()` 只有在被改造为等价事务语义并明确带上数据版本后才能复用；不得在 Application 中连续调用多个 list 方法拼接“完整”导出。

读取快照和写文件分离：SQLite 事务只覆盖数据库读取，不跨越系统保存对话框或文件 I/O。快照取得后数据库可以继续工作，导出内容仍代表一个明确时点。

### 5.5 结构与引用校验

交付前至少验证：

- envelope 常量、版本、Instant、LocalDate、枚举和必填字段合法；
- 每个集合内 ID 唯一，排序可重复；
- `Goal.currentNextActionId` 为空或指向导出内同 Goal 的 pending Action；
- Action/Routine 可空 `goalId` 为空或指向导出内 Goal；
- schedule、ActionRecord、RoutineRecord、TodaySelection、Understanding、Confusion 的父引用均存在；
- ReviewResult `goalId` 为空或指向导出内 Goal；
- 同 Routine/日期、同 Action/Today 日期和同 Routine/weekday 唯一；
- 分钟、Routine outcome/分钟组合、`plannedForDate`、`plannedForDateBasis`、source/status 等约束合法；
- 已解除的 Goal 关系明确为 null，不存在悬空 ID；
- 序列化文本不包含凭据字段、技术路径字段或禁止集合。

校验器是确定性纯逻辑，必须同时对内存 document 和临时文件重新解析后的 document 执行。校验失败不交付文件。

### 5.6 临时写入与最终交付

用户通过系统保存对话框选择位置，默认文件名继续遵循 ED-014：`mytracer-export-YYYY-MM-DD-v1.json`。Renderer 不提交或接收任意绝对路径；Export 适配器在 Main 内拥有目标路径，IPC 成功结果只返回文件显示名、字节数、版本和导出时间。

安全交付顺序：

1. 构造并验证内存 document；
2. 以 UTF-8、无 BOM 的 JSON 序列化；
3. 在最终目标同目录创建本次专属、不可碰撞的临时 sibling 文件；
4. 完整写入、flush/close；
5. 重新读取临时文件，解析并再次执行结构/引用/敏感字段校验；
6. 仅在全部成功后用平台支持的原子 rename/replace 交付最终文件；
7. 返回成功；
8. 任何失败只清理本次已验证归属的临时文件，保留既有有效目标文件不变。

若当前 Windows 文件系统/Node API 无法在不破坏既有目标的情况下原子替换，必须失败并要求用户选择新文件名；不得先删除旧文件再尝试写新文件。不得直接边序列化边写最终路径，也不得留下可被误认为有效导出的截断 `.json`。

用户取消保存对话框返回 `{ kind: cancelled }`，不创建临时或最终文件，也不作为错误记录。导出成功只表示用户取得了一个通过当前 v1 校验的完整 JSON；v0.1 **没有自动导入或一键恢复能力**。

## 6. Application、Repository、ExportPort、IPC 与错误边界

以下名称是设计级命名；后续合同可在职责不变时调整，但不得合并为通用 CRUD、raw SQL、任意 IPC channel 或任意文件路径入口。

### 6.1 T031 Commands 与 Queries

| 类型 | 意图级入口 | 核心规则 |
|---|---|---|
| Command | `BackfillActionRecord` | 显式 LocalDate；可选 manual Understanding/open Confusion；不改变当前实体状态 |
| Command | `UpdateActionRecord` | 保持 ID/actionId/createdAt；显式改日；父事实原子更新 |
| Command | `BackfillRoutineRecord` | 显式 LocalDate；按当前 schedule 计算计划快照；唯一冲突零写入 |
| Command | `UpdateRoutineRecord` | 保持 ID/routineId/createdAt；改日时重算计划快照 |
| Command | `UpdateUnderstandingText` / `RevokeUnderstanding` | 用户明确修改/撤销；AI 无写入口 |
| Command | `UpdateConfusionText` / `ResolveConfusion` / `ReopenConfusion` | 显式状态变化，不自动推断 |
| Query | `PreviewDeleteImpact` | 一致性只读影响集合、计数和 sender-bound preview token |
| Command | `ConfirmDelete` | 二次确认、freshness 校验、单事务硬删除 |
| Command-equivalent UI | cancel delete | 丢弃内存 preview；核心数据零写入 |

### 6.2 T032 Query、Command 与端口

| 类型 | 入口 | 核心规则 |
|---|---|---|
| Repository Query | `readCompleteCoreSnapshot` | 同一只读 snapshot 返回 `sourceDataVersion` + 全集合 |
| Application Command | `GenerateCompleteExport` | 只由用户触发；构造 envelope、验证并调用 ExportPort |
| ExportPort | `deliverCompleteExport(document, suggestedName)` | Main 内系统对话框、临时写入、复验、原子交付；不持有 Repository |
| ClockPort | `nowInstant/currentLocalDate/currentTimeZone` | 导出时间与文件名；不重写 Record LocalDate |

ExportPort 不得访问 Repository、AI Provider 或凭据。Application 不把导出 destination 路径传给 Renderer。

### 6.3 RepositoryPort 增量

T031 至少需要意图级方法，而不是在 Application 暴露任意 SQL：

```text
updateActionRecord(record)
updateRoutineRecord(record)
updateUnderstanding(record)
updateConfusion(record)
findDeleteImpact(target)
deleteActionRecord(id)
deleteRoutineRecord(id)
deleteAction(id)
deleteRoutine(id)
deleteGoal(id)
readCompleteCoreSnapshot()
```

现有 `saveActionRecord/saveRoutineRecord` 具备 upsert 能力，但 T031 Application 必须区分 create/update 意图，先检查身份和唯一性，防止不存在 ID 的“修改”变成创建、补记冲突变成覆盖。更安全的 Repository 实现可以提供受影响行数为 1 的专用 update 方法。

删除 Repository 只执行根删除；SQLite v1 的 FK cascade/SET NULL 是权威底层保障。Application 在事务内比较预览与实际，不能让 Renderer 逐项选择是否级联。

### 6.4 IPC DTO 与 Preload

- Preload 增量暴露固定的 `dataControl` 与 `exports`（或语义等价）命名空间；所有顶层和子 API 继续冻结。
- Record 修改 DTO 使用判别联合区分 action/routine；ID、LocalDate、分钟、枚举、文本和未知多余字段均运行时校验。
- 补记 DTO 里的 `occurredOn` 是唯一经批准的 Renderer 显式历史日期输入；它不放宽 Today 日期、当前 recording context 或 `plannedForDate` 的信任边界。
- 删除确认 DTO 只带 opaque previewId、target 和固定确认字面量；不接受 Renderer 计数、SQL、cascade 开关或路径。
- 导出 IPC 不接受 path；返回 `cancelled | exported` 判别结果，成功值不含绝对路径。
- Main 先执行既有 sender/origin 校验，再执行 DTO 校验和 Application 调用。
- Renderer 不获得 `ipcRenderer`、Repository、SQLite、文件系统、Clock、ExportPort 或 AI Provider。

### 6.5 事务边界

必须在一个 `UnitOfWorkPort.transaction` 内原子完成：

1. ActionRecord 修改及其必要一致性检查；
2. RoutineRecord 修改、唯一检查，以及改日时用户确认的 `plannedForDate`/basis 原子保存；
3. 补记父 Record 与同次 optional 子事实；
4. Understanding/Confusion 单次明确状态变化；
5. 删除确认时 freshness 重算、根删除、FK 级联/解除关联和实际结果核对。

删除预览、导出 snapshot 和普通 Query 使用一致性只读事务或等价快照。等待用户输入、保存对话框、JSON 序列化和文件写入期间不得保持 SQLite 写事务。

### 6.6 错误边界

稳定错误至少区分：

| 领域 | 稳定 code | 结果 |
|---|---|---|
| 修改/补记 | `validation`、`not-found`、`invariant-violation`、`record-already-exists`、`persistence-failed` | 零变化；不泄露 SQL/路径/正文 |
| 删除 | `invalid-delete-preview`、`delete-preview-stale`、`not-found`、`persistence-failed` | 零变化；要求重新预览 |
| 导出构造 | `snapshot-failed`、`serialization-failed`、`export-validation-failed` | 不创建最终文件 |
| 导出交付 | `write-failed`、`destination-changed`、`replace-not-supported` | 旧最终文件保持；清理本次临时文件 |
| 用户取消 | `cancelled` 结果，不是异常 | 数据库和文件系统零变化 |

面向 Renderer 只返回中性消息和 correlation ID；SQL、堆栈、绝对路径、用户正文、导出全文或凭据不得进入普通错误结果和诊断。

## 7. 数据版本、migration、外键、LocalDate 与重开

### 7.1 数据版本结论

按项目所有者批准的 S3-Q02-B，T031 需要一个非破坏性顺序 migration；其他 S3 能力不需要新表或通用历史模型：

- v1 已有所有可修改字段、`revokedAt`、Confusion resolved 字段和删除外键；
- v1 缺少 Routine 历史计划标志的 provenance，T031 新增 `planned_for_date_basis` 非空 CHECK 字段；
- delete preview context 只存在 Main 内存；
- `exportVersion` 属于 JSON envelope，不是 SQLite schemaVersion；
- `sourceDataVersion` 直接读取 `metadata.schemaVersion`。

因此批准的数据版本路径为：保留 `001_initial.sql` 不变，新增顺序 `002_*` migration，把 `schemaVersion` 提升为 2。现有 v1 `routine_records` 行迁移为 `planned_for_date_basis='schedule_at_recording'`；新当前记录使用同值，历史补记/改日使用 `user_confirmed_history`。migration 必须单事务执行，失败保持 v1 数据不变。

### 7.2 实施前兼容性门

每个任务开始前必须在最新授权 `dev` 复核：

- 启动 T031 前 schemaVersion 仍为 1、迁移清单仍只有已发布 v1，且 `001_initial.sql` 未被回写；
- v1 表、CHECK、UNIQUE、FK action 与本设计一致；
- S1/S2 DTO、RepositoryPort、Progress/Today 查询含义没有漂移；
- 现有 S1-only v1、S2 v1 和新建 v1 fixture 能迁移到 v2，核心事实守恒且 basis 回填准确；
- 未知更高 schemaVersion 继续拒绝写入，不降级覆盖。

S3-Q02-B 已批准 v2 provenance migration 的产品/设计方向，但不自动授予修改 migration 的任务权限。T031 合同必须列出精确 `002_*` SQL、允许文件、fixture 守恒、失败回滚和 `migration_change: true`，并经项目所有者批准后才能实施。若还需要本文之外的字段、表或破坏性迁移，停止并重新申请；不得回改 `001_initial.sql`。

### 7.3 外键与删除动作

继续依赖并测试 v1：

- Goal → Action `ON DELETE CASCADE`；Goal → Routine/ReviewResult `ON DELETE SET NULL`；
- Action → TodaySelection/ActionRecord `ON DELETE CASCADE`；
- ActionRecord → Understanding/Confusion `ON DELETE CASCADE`；
- Routine → schedule days/RoutineRecord `ON DELETE CASCADE`；
- `Goal.currentNextActionId → Action ON DELETE SET NULL`。

Application 的影响预览必须按上述实际路径计算；不能维护一份与 SQL 不一致的手写级联列表而不做契约测试。

### 7.4 LocalDate

- 历史修改默认不改变 `occurredOn`；发生日字段在 UI 中与其他编辑明确分离。
- 补记要求用户显式选择 LocalDate；不能用 `createdAt` 或 UTC 日期代替。
- 常规当前记录继续使用 S1/S2 recording context 和 ED-017 跨午夜确认，不被补记 DTO 放宽。
- Progress 日期过滤继续包含端点，周一至周日语义不变。
- 删除不改变剩余 Record 的发生日；重开不重算 `plannedForDate`。

### 7.5 关闭重开

集成与 E2E 必须真正关闭 SQLite 连接/Electron，再从同一隔离临时数据根重建实例。重开后证明：

- 修改/补记后的 ID、LocalDate、outcome、分钟和子事实状态一致；
- 删除对象与其级联对象仍不存在，解除关联对象仍存在且 `goalId=null`；
- 取消、stale、校验和存储失败场景的快照与失败前逐集合相同；
- Progress/Today 由事实重算且与关闭前一致；
- 导出 `sourceDataVersion` 与实际 metadata 一致；
- AI 未配置时应用仍能打开并执行全部 S3 数据能力。

## 8. T031～T033 任务边界

### 8.1 T031 — 修改、补记、删除预览及事务

**范围**

- ActionRecord/RoutineRecord 的显式修改与历史补记；
- Understanding 修改/撤销，Confusion 修改/resolve/reopen；
- LocalDate、分钟、outcome、唯一性和当前状态隔离；
- `planned_for_date_basis` 的非破坏性 v2 migration、旧 v1 fixture 守恒和导出兼容；
- Record/Action/Routine/Goal 的影响预览、二次确认和事务性硬删除；
- ED-008 的全部级联、解除关联、current-next 清空、取消/stale/故障零变化；
- Progress、Today、详情重查；真实关闭重开；
- Domain/Application/Repository/SQLite/IPC/Preload/Renderer 的最小纵向路径。

**非范围**

- 完整导出；自动导入/恢复；回收站、撤销、自动备份；
- Action/Routine Goal reassign、状态历史、通用审计；
- 修改 pause/end、Action 状态、Today 或 Progress 的既有语义；
- AI Provider 和 S4～S7。

**依赖**

- S1/S2 最终基线和证据可用；本文及 S3-Q01=A、S3-Q02=B、S3-Q03=A 已获项目所有者批准；
- 独立 T031 合同明确文件、验证、依赖、migration 和 Git/GitHub 权限；
- 实施前兼容性复核通过；推荐不新增依赖，但必须单独批准 `migration_change: true` 和精确 v2 migration。

**完成条件**

1. 修改/补记可观察行为覆盖 FR-L07、FR-R08 和 FR-C04，不改变父实体当前状态；
2. 修改/补记后的 Progress、Today 和详情从事实重算，改日同时影响原/新日期；历史计划确认与 basis 原子保存；
3. 全部删除根的预览与实际 ID/计数一致；stale 必须重新预览；
4. 取消、非法输入、冲突和故障注入均证明零变化；
5. ED-008 的 cascade/SET NULL/current-next 清空在一个事务内完成；
6. pause/end/complete/cancel/reschedule 回归证明不等于 delete；
7. v1 → v2 migration、失败回滚和关闭重开通过；不声明导出、完整 AC-07 或 T032/T033 完成。

### 8.2 T032 — 版本化完整导出与引用校验

**范围**

- 带 `sourceDataVersion` 的一致性完整快照；
- `MyTracerCoreExportV1` envelope、枚举说明、稳定排序和 UTF-8 JSON；
- 全部核心集合、状态、LocalDate、关系和审计字段；
- 结构、引用、枚举、敏感字段排除校验；
- 系统保存对话框、临时 sibling、复验、原子交付和写入故障；
- 导出 IPC/Preload/UI，明确“导出不等于自动恢复”；
- T031 删除后的导出回归。

**非范围**

- 自动导入、一键恢复、自动备份、云/远程目标；
- 直接导出 SQLite 文件、凭据、AI 草稿、日志或测试路径；
- 通用文件浏览/路径 API；
- 修改核心数据或执行 migration。

**依赖**

- T031 完成并有证据；本文和 S3-Q04=A 已获项目所有者批准；
- 独立 T032 合同明确外部文件写入权限、允许文件和验证；
- T031 交付的 v2 快照兼容性复核通过，且 v1 → v2 守恒证据可用。

**完成条件**

1. 全状态 fixture 导出包含全部未删除核心集合、关系和必要枚举；
2. `exportVersion=1`、实际 `sourceDataVersion`、导出时间和 LocalDate 均正确；
3. 引用/结构/敏感字段校验覆盖正反场景；
4. 取消和所有写入故障不留下被误认为有效的截断 `.json`，既有有效目标不被破坏；
5. Renderer 不提交/接收任意路径；
6. 重开后可再次导出相同核心事实；
7. UI 清楚说明没有自动导入/恢复；不声明 AI 三态回归或完整 T033 完成。

### 8.3 T033 — AI 不可用时的数据能力回归

**范围**

- 在同一隔离数据能力测试套件中运行 `disabled`、`not-configured`、`failure` 三种 AI 状态；
- 每种状态重复代表性 Goal/Action/Routine CRUD、Today、Action/Routine Record 修改/补记、Progress、删除预览/取消/确认和完整导出；
- failure 场景使用已有或语义等价 fake provider 先产生超时/认证/解析异常，再证明同一应用组合中的数据服务继续工作；
- 关闭重开和 E2E-AC-07；S1/AC-01、S2/AC-03、AC-04 受影响回归；
- 项目所有者 AC-07 人工验收程序与准确限制说明。

**非范围**

- 实现生产 Provider、Start Help、AI 配置 UI、密钥保存或 AC-02；
- 为核心 Repository、导出或删除增加 AI 依赖；
- 把测试用 fake 状态扩为新用户可见产品概念；
- 长期 AI 记忆、草稿持久化或 AI 写数据。

**依赖**

- T032 完成并有证据；T033 独立合同获批；
- fake AI 基础设施可用，且无需真实网络/key；
- 若证明 failure 必须先实现生产 AI Application/Provider，立即停止并报告依赖冲突；T033 只能做数据独立性回归。

**完成条件**

1. 三种 AI 状态下数据命令、查询和完整导出结果与 AI 状态无关；
2. AI failure 不产生核心写入，也不使 SQLite/ExportPort 失效；
3. AC-07 自动化连续通过；人工验收未执行时保持 `pending`；
4. AC-01、AC-03、AC-04 受影响回归通过；
5. 不声明 AC-02、Provider 接入或 S6 完成；
6. T031～T033 证据齐全后只能形成 G3/S3 候选，不自动授权合入 `dev/main`、tag 或 release。

## 9. 分层测试与 AC-07 验收矩阵

### 9.1 自动化与人工矩阵

| 行为/风险 | 领域/应用单元 | Repository/SQLite 集成 | IPC | E2E | AC-07 人工 |
|---|---|---|---|---|---|
| ActionRecord 修改 | 字段白名单、ID/parent 不变、outcome 不改 Action | 更新 1 行、子关系保留、故障回滚 | LocalDate/分钟/枚举/多余字段拒绝 | 修改前后 Progress 与详情变化 | 改日默认关闭、用户显式确认 |
| RoutineRecord 修改 | outcome/分钟矩阵、planned 快照/basis 规则 | 改日唯一冲突、计划事实守恒、回滚 | 仅历史补记/改日 DTO 接受用户确认的 plannedForDate | Today/day-state/Progress 同步变化 | 非计划日事实表达准确 |
| 补记 | 必须显式 LocalDate；不改当前状态 | 终态父实体、历史日、同日冲突、重开 | 只有窄补记 DTO 可提交日期 | Action/Routine 历史补记连续路径 | 用户知道是在补记而非改今天 |
| Understanding/Confusion | 修改、revoke、resolve、reopen 无自动推断 | 时间戳、状态、重开 | 空白/非法状态拒绝 | Progress 只显示有效/open 项 | 文案不宣称掌握或自动解决 |
| Record 删除 | 剩余事实公式 | 子实体 cascade；Routine 删除后 unknown；回滚 | preview/confirm token 校验 | 删除后 Progress 重算 | 永久删除警告清楚 |
| Action 删除 | 影响集合、current-next 清空 | Record/U/C/Today cascade；Goal 保留 | 伪造 count 无效 | 预览=实际；重开 | 二次确认可取消 |
| Routine 删除 | 影响集合 | schedule/Record cascade；Goal 保留 | 同上 | 预览=实际；重开 | 与 pause/end 清楚区分 |
| Goal 删除 | actions 分支级联；Routine/Review detach | 全 FK 路径、`goalId=null`、事务回滚 | stale preview 拒绝 | 全局 Progress 保留 detached Routine facts | 优先展示 pause/end，永久删除明确 |
| 取消/校验/存储失败 | 命令不调用 commit | 前后完整快照相同；故障注入 | 过期/错 sender/token 拒绝 | UI 状态恢复，可重新预览 | 取消没有隐藏变化 |
| 预览新鲜度 | ID/关系指纹精确匹配 | 预览后新增子项 → stale/零变化 | 旧 token 不可重放 | 重新预览后成功 | 用户看到需要重新确认 |
| migration/重开 | 版本规则 | 新建 v2、S1-only v1 → v2、S2 v1 → v2、未知高版本；真实 close/open | 启动错误不泄露路径 | 修改/删除后重开 | 重新打开仍一致 |
| 完整导出集合 | envelope/纯校验器 | 同一 snapshot 含全部集合/状态 | Renderer 不传 path | UI 发起并成功保存 | 能找到文件且说明准确 |
| 导出引用/排除 | 正反 fixture、枚举和敏感键扫描 | 删除/SET NULL 后引用合法 | 错误结果不含 JSON/路径 | 解析最终文件验证 | 不包含凭据/草稿/日志 |
| 导出写入失败 | 交付状态机 | 临时写/flush/复读/rename 故障；旧文件不变 | 稳定错误映射 | 模拟中断无截断最终文件 | 失败不显示成功 |
| AI disabled/not-configured/failure | 数据服务无 AI 依赖 | 同一 DB/快照结果一致 | 数据 IPC 不依赖 AI channel | CRUD/Progress/删除/导出三态矩阵 | AI 不可用仍能完成核心操作 |
| S1/S2 回归 | Action partial、Routine 五语义、intention | v1 → v2 facts 守恒 | 既有 DTO/channel 回归 | AC-01、AC-03、AC-04 | 既有流程和中性文案不退化 |

### 9.2 E2E-AC-07 连续程序

在同一明确 revision、Windows 环境、FakeClock 和隔离 `userData` 上：

1. 通过既有 S1/S2 UI 创建包含 Goal/Action/Routine/TodaySelection、两类 Record、Understanding 和 Confusion 的数据，并覆盖 active/paused/ended、pending/completed/cancelled/rescheduled、focus/intention 和 Routine 四种显式 outcome。
2. 显式修改一个 ActionRecord 的分钟/outcome，修改一个 RoutineRecord；验证 Progress、Today/day-state 和详情从事实重算，父实体状态不变。
3. 显式选择过去 LocalDate 补记 ActionRecord 和 RoutineRecord；修改其中一条发生日；验证原/新日期、计划快照、唯一约束和关闭重开。
4. 修改/撤销一个 Understanding，resolve/reopen 一个 Confusion；验证 Progress 只显示未撤销理解和 open 困惑。
5. 分别预览 Record、Action、Routine、Goal 删除；至少对每类执行一次取消并比较完整快照零变化。
6. 在隔离副本中对各删除根二次确认；验证预览 ID/计数与实际一致、Goal 删除 detach、Action current-next 清空、Progress 从剩余事实重算。
7. 在一次预览后新增或修改受影响事实，确认旧预览得到 stale 且零变化；重新预览后才能执行。
8. 完全关闭应用并重开；验证修改、补记、删除和解除关联结果持久存在。
9. 从包含所有剩余状态的同一数据库导出；解析最终 UTF-8 JSON，验证版本、集合、状态、LocalDate、枚举、引用和敏感字段排除。
10. 分别注入临时写入、flush、复读校验和最终 rename/replace 故障；验证不报告成功、不留下截断最终文件、不破坏既有有效导出。
11. 在 AI disabled、not-configured、failure 三种测试组合中重复代表性 CRUD、Progress、删除预览/取消/确认和导出；结果与 AI 状态无关。
12. 在同一最终 revision 执行 E2E-AC-01、E2E-AC-03、E2E-AC-04 受影响回归。

删除 destructive 分支必须只针对每 case 唯一临时数据库；不得接触真实用户数据。人工验收可以使用专门人工测试数据根，但也不得使用真实日常数据库。

### 9.3 项目所有者人工 AC-07

项目所有者在真实 Windows 应用中按连续流程确认：

- 修改历史默认保留发生日；补记必须明确选择日期；
- 修改/补记后 Progress 立即反映事实，Action/Goal/Routine 当前状态没有被 Record outcome 偷换；
- 删除前能看懂影响，取消没有变化，确认是明确的不可逆第二步；
- pause/end 与 delete 的入口、文案和结果清楚不同；
- 完整导出能保存到用户选择的位置，文件说明是“导出/备份文件”；
- 导出包含全部核心状态和关系，不包含凭据、AI 草稿、日志或技术路径；
- AI 不可用时，数据修改、补记、删除、Progress 和导出仍可完成；
- 界面明确说明 v0.1 尚不支持自动导入或一键恢复。

人工结果必须记录为 pass/fail/partial 并附观察；项目所有者实际执行前始终为 `pending`。

## 10. FR / AC / D / ED → Txxx → 数据落点 → 测试追踪

缩写：`U` 领域/应用单元，`I` Repository/SQLite 集成，`IPC` Main/Preload 契约，`E2E` 端到端，`M` 项目所有者人工，`SCOPE` 范围扫描。

| 需求或决定 | Txxx | 数据落点 | 测试层级 |
|---|---|---|---|
| FR-L07；D-103；D-106；ED-012、ED-017 | T031 | `action_records` 的 LocalDate/分钟/outcome/文本；ID/parent 不变 | U、I、IPC、E2E、M |
| FR-R08；FR-R04、FR-R05、FR-R06、FR-R07、FR-R09 回归；D-008、D-009、D-010、D-107 | T031 | `routine_records` 四 outcome、`planned_for_date`、唯一日期、分钟 | U、I、IPC、E2E、M |
| FR-C04；D-104 | T031 | `understandings.text/revoked_at` | U、I、IPC、E2E、M |
| FR-P03、FR-P04；D-105 | T031 | `confusions.status/resolved_at/resolution`；Progress 有效/open 过滤 | U、I、IPC、E2E、M |
| FR-D02；UX-05；ED-008 | T031 | 全部删除根、FK cascade/SET NULL、preview context | U、I、IPC、E2E、M |
| FR-P01、FR-P02、FR-P03、FR-P04、FR-P07、FR-P08；ED-016 | T031 回归 | Progress 从剩余 Action/Routine Record 事实重算 | U、I、IPC、E2E |
| FR-D01；AC-07 步骤 1～2 | T031～T033 | v1 → v2 metadata/SQLite、关闭重开和核心集合 | I、E2E、M |
| FR-D03；D-111；ED-014 | T032 | Export envelope、UTF-8 JSON、ExportPort 安全交付 | U、I、IPC、E2E、M |
| FR-D04 | T032 | 十个核心集合、状态、枚举和引用 | U、I、E2E、M |
| FR-D05；FR-AI09；D-015；ED-010 | T033 | AI 配置/失败仅为外围状态；核心 SQLite/export 无 AI 依赖 | U、I、IPC、E2E、M |
| AC-07 | T031～T033 | 修改/重开/完整导出/AI 降级连续路径 | U、I、IPC、E2E-AC-07、M |
| AC-01；FR-A05、FR-L01、FR-L02、FR-L03、FR-L04、FR-L05、FR-L06、FR-L07、FR-L08、FR-L09、FR-P01、FR-P02、FR-P03、FR-P04 | T031～T033 回归 | S1 ActionRecord/Progress/Today 既有表与 DTO | U、I、IPC、E2E-AC-01 |
| AC-03；FR-R04、FR-R05、FR-R06、FR-R07、FR-R08、FR-R09 | T031～T033 回归 | S2 Routine/schedule/RoutineRecord/Progress | U、I、IPC、E2E-AC-03 |
| AC-04；FR-A07、FR-T03、FR-T08；D-011 | T031～T033 回归 | `today_selections.kind=intention` 与通用 Action | U、I、IPC、E2E-AC-04、M |
| D-003、D-016；ED-003、ED-004、ED-018、ED-019 | T031～T033 横切 | 四核心概念、Main-only SQLite/file、窄 IPC | I、IPC、E2E、SCOPE |
| FR-D07；FR-AI11、FR-AI12、FR-AI13；FR-RV07 | 非范围 | 不增加导入、长期 AI、自动计划或 Review 接口/表 | SCOPE |

表中 FR、AC、D、ED 均来自当前冻结 PRD、DECISIONS 或已批准工程决定；本文不创建新需求编号。

## 11. 对现有 S1/S2 数据契约的依赖与兼容性清单

### 11.1 必须直接保持的现有契约

| 现有契约 | S3 依赖 | 兼容要求 |
|---|---|---|
| 设计批准时 `schemaVersion=1`、唯一 `001_initial` | T031 基线 | 不回改 v1；新增已批准 provenance 的顺序 v2 migration |
| Goal `currentNextActionId` 同 Goal pending | 修改/删除/导出 | Record 编辑不改；Action 删除由 FK 清空；导出验证 |
| Action/Routine `goalId` 可空且创建后不 reassign | 删除/Progress/导出 | Goal 删除只 detach Routine/Review；Action 随 Goal cascade |
| ActionRecord `completed/partial/stopped`、逐 Record 计次 | 修改/补记/Progress | outcome 不自动改 Action；多条记录不合并 |
| Routine 四 outcome + 缺行 unknown | 修改/补记/删除/导出 | unknown 不持久化/不导出为 Record；删除后重新观察缺行 |
| Routine `plannedForDate` 保存时快照 | 修改/补记/导出 | 不改日时保留；改日/补记由用户确认并记录 basis |
| TodaySelection focus/intention、同 Action/日唯一 | 删除/导出 | 未发生 intention 不生成失败；Action/Goal delete cascade |
| Understanding revoked、Confusion open/resolved | 修改/Progress/导出 | 导出保留全部未删除状态；Progress 只显示有效/open |
| Progress `goalId/from/through`、端点包含、只读一致快照 | 所有数据变更 | 从当前事实重算；不建累计表 |
| Main recording contexts 与 ED-017 | 当前记录回归 | 补记是窄新命令，不放宽当前记录日期信任边界 |
| 固定 IPC、sender/origin、冻结 Preload API | T031/T032 | 增量命名空间；不暴露通用 invoke/path/SQL |
| SQLite FK/WAL/事务与临时测试根 | 删除/导出/重开 | 单事务写、一致读、绝不碰真实数据 |
| AI 未配置不阻塞启动 | T033 | 数据服务和 ExportPort 不依赖 Provider |

### 11.2 兼容扩展，不得倒改 S1/S2

- 在 Domain/Application 中增加 Record update/backfill 和子事实状态命令，不修改既有 current-record 创建语义；
- 在 Repository 增加专用 update/delete/impact/snapshot 方法，不把现有接口暴露给 Renderer；
- 在 Preload 增量增加 data control/export API，保留现有 goals/actions/today/records/progress/routines 方法和 DTO 含义；
- 在 Renderer 增加修改、补记、删除和导出入口，不重解释 focus/intention/Routine/unknown；
- 继续使用现有 v1 表和外键语义，只以顺序 v2 migration 增加 `planned_for_date_basis`；delete preview token 不落库；
- 生产完整 snapshot 必须比现有测试 `readSnapshot()` 更强：带版本、同一只读事务、稳定排序和引用校验；
- T033 只增加回归组合，不把 AI 状态写入核心表或导出。

### 11.3 当前兼容性结论

按本文读取的当前 S1/S2 实际契约，S3 不需要产品语义变化或依赖升级；S3-Q02-B 要求 T031 把当前 v1 非破坏性迁移为 v2，并为既有 RoutineRecord 回填 `schedule_at_recording`。该结论不替代每个任务开始前对最新授权 `dev` 的真实复核，也不替代 T031 合同中的 migration 权限。

## 12. 项目所有者已确认的 S3 决定

项目所有者于 2026-08-19 批准本文，并选择 S3-Q01=A、S3-Q02=B、S3-Q03=A、S3-Q04=A。后续 T031～T033 合同必须采用这些结果；未选方案只为保留决策审计，不得进入实现。其余冻结 D/ED 不在此重复征询。

### S3-Q01：终态/暂停内容的历史补记

- **批准结果 A**：只要父 Action/Routine 仍存在，就允许历史补记或修正，不要求 Action pending、Goal active 或 Routine active；命令只写 Record/子事实，绝不改变当前状态、Today 或下一步。
- 未选 B：沿用当前记录入口限制，必须先恢复到可行动状态才允许补记。
- 影响：A 符合 FR-L07、FR-R08 和 D-103 的纠错/补记目的，也不会用历史事实伪造当前状态。

### S3-Q02：Routine 补记/改日的计划快照

- **批准结果 B**：未改发生日的修改保留旧 `plannedForDate`/basis；补记或显式改日要求用户确认历史计划标志，保存 `user_confirmed_history` provenance，并通过已批准方向的非破坏性 v2 migration 支持。
- 未选 A：补记或改日按命令执行时当前 schedule 计算计划标志。
- 影响：B 避免把当前 schedule 冒充历史计划事实；它要求 T031 合同单独授权 migration 修改，并增加 v1 → v2 守恒、DTO、导出和重开测试。

### S3-Q03：删除预览新鲜度

- **批准结果 A**：确认时受影响 ID/关系必须与预览精确一致；任何变化都 stale、零写入并要求重新预览。
- 未选 B：只要根仍存在就按确认瞬间的新影响执行，并返回新计数。
- 影响：A 能证明用户确认的就是实际删除集合；B 操作更少，但可能删除用户未在预览中看到的新关联数据。

### S3-Q04：首个完整导出契约与交付

- **批准结果 A**：采用第 5 节的 `exportVersion=1` envelope、显式 `enumValues`、独立 `routineScheduleDays[]`、Main-only destination、同目录临时 sibling、复验后原子交付。
- 未选 B：省略枚举说明并把 schedule 嵌入 Routine，其余安全交付不变。
- 影响：A 与当前 CorePersistenceSnapshot 一一对应且更自描述，引用校验清晰；B JSON 更紧凑，但与持久化集合映射不同，未来解析器需要额外约定。无论选择 A/B，都不得省略版本、核心集合、敏感排除、临时写入、复验和安全最终交付。

## 13. 风险、停止条件与范围变化

| 风险/缺口 | 影响 | 控制或停止条件 |
|---|---|---|
| 最新 `dev` 与本文读取的 S1/S2 契约漂移 | 设计绑定错误 schema/DTO | 每任务启动前兼容性复核；不兼容即停止 |
| 现有 Repository upsert 被误用于 update | 不存在 ID 被创建、同日 Record 被覆盖 | 专用 update/受影响行数；负面集成测试 |
| 补记借 outcome 改当前状态 | 历史纠错伪造 Action/Goal/Routine 现状 | 命令无 postRecord；前后当前实体 snapshot 相同 |
| Routine 历史 schedule 不可重建 | `plannedForDate` 解释可能被误读 | S3-Q02-B 由用户确认并记录 provenance；不伪造 schedule 历史 |
| 预览与实际级联漂移 | 删除超出用户确认范围 | sender-bound token、ID 指纹、事务内重算、stale |
| FK 列表与 preview 代码分叉 | 计数和实际结果不一致 | Repository 契约测试以迁移后的真实 v2 schema 比较；FK 语义与 v1 一致 |
| Goal 删除误伤 Routine/Review | 历史丢失 | SET NULL 集成测试、重开和导出验证 |
| Progress 使用缓存累计 | 修改/删除后漂移 | 继续事实查询；无累计表；原/新日期回归 |
| 完整 snapshot 不一致 | 引用跨时点悬空 | 单一只读 transaction，版本与集合一起读取 |
| 导出直接写最终文件 | 截断文件被误认有效 | 临时 sibling、复验、原子交付、故障注入 |
| 覆盖既有文件时先删除 | 写失败导致旧备份丢失 | 旧文件保持；原子 replace 不可用则失败 |
| 导出泄露凭据/路径/日志 | 数据边界破坏 | allowlist 构造 + denylist 扫描 + 负面 fixture |
| 把完整导出当成恢复 | 用户产生错误安全预期 | UI、文件说明、AC-07 明确“无自动导入” |
| T033 为证明 failure 提前实现 Provider | S3 扩到 S6 | 只用 fake/test harness；需要生产 AI 即停止 |
| 测试触及真实 userData | 用户数据风险 | 每 case 唯一临时根；删除前绝对路径隔离断言 |
| 既存工作树或任务变更重叠 | 唯一文件/任务边界不可证明 | 启动合同前要求干净独立 worktree 或明确隔离 |

发现以下任一情况必须停止受影响设计/实现并报告：

- 需要改变 MUST、ED-008 删除、ED-014 导出、ED-017 日期或数据所有权语义；
- 需要回写 `001_initial.sql`、执行破坏性 migration 或访问真实用户数据库；
- 需要新增依赖、扩大 Renderer/Preload 文件/SQL/path 权限或让 AI 拥有 Repository；
- 需要实现导入恢复、回收站、自动备份、同步、审计、S4～S7 或延期能力；
- 无法证明取消/失败零变化、预览与实际一致、导出引用完整或敏感字段排除；
- 需求编号、任务边界或 S1/S2 实际契约与本文不一致。

截至本文批准：

- MUST/已批准决定冲突：未发现；
- 产品范围变化：无；
- 已批准 migration 方向：T031 以非破坏性 v2 migration 增加 Routine 计划事实 provenance；精确 migration 权限仍由任务合同批准；
- 推荐新增/升级依赖：无；
- 项目所有者决定：S3-Q01=A、S3-Q02=B、S3-Q03=A、S3-Q04=A；
- 权限：允许 T031～T033 合同标注“准备实现”；任务启动和实现授权尚未获得。

## 14. 审批完成与后续门禁（批准时记录）

- [x] T031～T033 各有范围、非范围、依赖和可判定完成条件；
- [x] AC-07 可在同一明确 revision 连续执行；
- [x] 修改、补记、删除、导出和 AI 降级使用一致的数据所有权和 LocalDate 语义；
- [x] 影响预览与实际事务结果可按 ID/关系指纹自动验证；
- [x] 导出覆盖全部未删除核心状态、关系和必要枚举，并排除敏感/技术数据；
- [x] migration、外键、解除关联、失败回滚和关闭重开均有测试落点；
- [x] S1/AC-01、S2/AC-03 与 AC-04 已列为受影响回归；
- [x] 所有引用的 FR/AC/D/ED 编号来自当前基线；
- [x] 自动导入、回收站、自动备份、同步、审计、AI Provider 和 S4～S7 均保持非范围；
- [x] 本文不包含完整 T031～T033 Prompt，也不替代独立任务合同；
- [x] 本文获项目所有者批准时，四项 S3 决定已固定，任务启动和实现授权尚未获得。

设计批准后的原下一步是分别准备 T031、T032、T033 任务合同；该权限记录不因后续交付而改写。实际完成、归档与里程碑事实见页首、任务索引、S3 归档和 `EV-G3-S3-001`。

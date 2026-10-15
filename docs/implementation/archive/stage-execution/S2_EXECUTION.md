# S2 历史阶段执行记录

> 来源：`beb8b97b2c9ecdef4ab0677853eef195c2367544` 中的 [S2_ROUTINE_INTENTION_DESIGN_V0.1.md](../../../architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md)。本文保留当时的执行、授权和交付上下文，不是当前状态或普通工作的指令；旧批准不恢复执行权限。技术正文继续在原设计文件维护。

## 原页首状态与授权


> 文档状态：S1 最终验收后复核通过版；已于 2026-08-13 获项目所有者批准，并获得 T021～T023 按本文范围实施的阶段级实现授权。
>
> 后续交付结果：T021～T023/T802 已完成并由 PR #20 归档到 `dev`；里程碑 PR #22 合入 `main@581e443ea925715b1eb4f2343b735fce9e38e604`，并发布 `v0.1.0-alpha.3`。下文未完成门禁措辞均是设计批准时记录。
>
> 复核基线：S1 最终行为验收 revision `dev@74ebe346a86cf431d87e02e8a1220b713b33901c`（`EV-G3-S1-002`）；验收归档及状态收口后的当前开发基线 `dev@52de81ff6fc95df5ac53e998824ff07135e792b3`。
>
> 权限说明：本文不替代 T021、T022、T023 三个独立任务合同，不自动授予新增/升级依赖、migration 或具体 branch、commit、push、PR、merge、tag、release 权限，也不表示任一任务已经启动、完成或通过验收。
>
> 适用范围：S2 / E2-01～E2-03 的后续任务合同、实现、测试与验收设计输入。
>
> 核心验收：AC-03 每日轻量活动、AC-04 个人时间意向。



## 0. 文档用途、依据与权限边界

本文把冻结产品语义、已批准架构决定和已验收 S1 接口收敛为 T021～T023 的整体设计。本文是三个独立任务合同的已批准设计输入；项目所有者已经授予按本文范围实施 T021～T023 的阶段级权限。本次文档收口本身不创建任务合同，也不启动任一实现任务。

解释优先级保持为：

1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../../../PRODUCT_REQUIREMENTS_V0.1.md)；
2. [`DECISIONS.md`](../../../DECISIONS.md)；
3. [`REQUIREMENTS_CHANGE_POLICY.md`](../../../REQUIREMENTS_CHANGE_POLICY.md)；
4. 本目录的总体架构、领域、数据、测试、追踪、实施计划、工程决定和已批准的 [`S1_CORE_LOOP_DESIGN_V0.1.md`](../../../architecture/S1_CORE_LOOP_DESIGN_V0.1.md)；
5. [`TASK_INDEX_V0.1.md`](../../TASK_INDEX_V0.1.md)、[`TASK_TEMPLATE.md`](../../TASK_TEMPLATE.md) 和 [`GITHUB_WORKFLOW_V0.1.md`](../../GITHUB_WORKFLOW_V0.1.md)；
6. S1 最终验收后被项目所有者接受的实际接口、数据版本、归档和证据。

`user/` 不属于本文依据，不得成为后续设计、实现、测试或验收依赖。

本文使用以下标记：

| 标记 | 含义 |
|---|---|
| **冻结/已批准** | 直接来自 FR、AC、D、ED、GW 或已批准 S1 设计；后续任务不得自行改变 |
| **S1 已验收基线** | 已由 G3/S1 最终验收及第 11 节复核确认的接口和数据事实 |
| **S2 已批准设计** | 本文确定的 S2 设计边界和 S2-Q 结果；后续任务合同不得自行改变 |
| **延期/非范围** | 不进入 S2，不得成为 T021～T023 的必要接口、表、依赖或验收条件 |

项目所有者已批准本文设计，并授予 T021～T023 按本文范围实施的阶段级权限。该批准仍不自动：

- 把 T021、T022 或 T023 从 `pending` 改为 `ready`/`active`；
- 替代 `TASK_TEMPLATE.md` 形成的独立合同、允许文件、排除项、验证命令和完成条件；
- 授权新增/升级依赖、任何 migration 或破坏性数据操作；
- 授权具体 branch、commit、push、Draft PR、Ready、merge、`main`、tag 或 release；
- 声明 AC-03、AC-04 或任何 S2 需求已经实现或通过。

## 1. 基线核对与冲突结论

### 1.1 设计批准时的当前事实

- S1 已完成最终验收：T011～T014/T801 均为 `done`；自动化和项目所有者人工 AC-01 均通过；`EV-G3-S1-002` 在 `dev@74ebe346a86cf431d87e02e8a1220b713b33901c` 记录 G3/S1 最终通过，并保留 `EV-G3-S1-001` 的首轮失败历史。
- PR #13 已把 S1 合同统一归档到 `dev`，PR #15 已收口归档后状态；当前复核/合同准备基线为 `dev@52de81ff6fc95df5ac53e998824ff07135e792b3`。从最终行为验收 revision 到当前基线只有文档归档和状态文字变化，没有生产接口、测试、依赖、配置、schema 或 migration 变化。
- 已验收 S1 具有 Goal、Action、ActionRecord、Today focus 和 ActionRecord Progress 的纵向路径；S2 只能增量扩展 Routine、RoutineRecord 和 intention，不能改写 S1 的 Action/Today/Progress 语义。
- SQLite `schemaVersion = 1` 及唯一 `001_initial` migration 已复核确认预建 `routines`、`routine_schedule_days`、`routine_records`，并允许 `today_selections.kind = focus | intention`。
- `TASK_INDEX_V0.1.md` 已将 T021、T022、T023 分别映射到 E2-01、E2-02、E2-03，当前状态仍均为 `pending`。项目所有者的阶段级实现授权不替代三个独立合同，也不自动改变账本状态。本次整体设计没有独立 Txxx，不得虚构 T020。

### 1.2 冲突与文档张力

本轮复核未发现两条 MUST、已批准 D/ED、已验收 S1 契约或本次已批准 S2 决定之间存在不可调和冲突，因此没有阻塞 T021～T023 按独立合同实施的架构冲突。

发现两处需要显式处理的文档张力：

1. `TEST_STRATEGY_V0.1.md` 的 E2E-AC-03 骨架写有“Progress/Review 验证五种含义”，但 PRD 的 AC-03、追踪矩阵和任务索引只要求 S2 的 Routine、Today、Progress；Review 属于 S5。本文按更高权威和现行任务边界设计：S2 只通过 Today/Progress 验证，S5 再证明 Review 复用同一事实；不得为这句测试骨架措辞提前实现 Review。
2. `DOMAIN_MODEL_V0.1.md` 一处仍称 schedule 语法待技术决定，但同文档结论及已批准 ED-009 已固定“周一至周日集合，带每天/工作日快捷输入”。本文依 ED-009，不重新开放通用重复语法。

若 `dev@52de81ff...` 之后 S1 接口或数据基线再次变化，或实施发现实际基线与第 11 节复核结果不符，必须停止受影响任务、重新复核本文并按需求变更规则报告；不得在 S2 中静默倒改 S1。

## 8. T021～T023 任务边界

T021～T023 已获得项目所有者按本文范围实施的阶段级授权，但仍必须作为三个独立任务按账本顺序和各自合同执行；不得合并成一个无合同的批量实现，也不得以该授权推定具体 Git/GitHub、依赖或 migration 权限。

### 8.1 T021 — Routine 生命周期、星期节奏与 Today 计划项

**范围**

- Routine 领域实体、`active | paused | ended` 状态机和历史守恒；
- 可空 Goal 关联、当前文本、minimumAction；
- 周一至周日非空集合及每天/工作日快捷输入；
- 创建时原子保存 Routine + schedule；修改时原子整组替换 schedule；
- `ListRoutines`、`GetRoutineDetail` 和 `GetToday` 的计划 Routine 分支；
- Repository、SQLite、IPC、Preload、Renderer 的最小纵向路径；
- LocalDate weekday、状态机、节奏、事务回滚和真实重开测试。

**非范围**

- 创建 RoutineRecord、四 outcome、Progress Routine 分支、unknown 验收；
- Action intention；
- Routine Goal 重分配、硬删除、补记、修改/删除 Record；
- 提醒、时间段、隔周/每 N 天、复杂日历或通用规则。

**依赖**

- G3/S1 最终验收及第 11 节接口/数据复核均已完成且无阻塞；
- 本文及 S2-Q01-A/Q02-A/Q03-A/Q07-A/Q10-A 已获项目所有者批准；
- 独立 T021 合同明确允许文件、验证、依赖、migration 和 Git/GitHub 权限；
- 不新增依赖；若需要 migration，必须先走独立审批。

**完成条件**

1. FR-R01～R03 与 FR-T02 的 T021 可观察行为存在；
2. 生命周期合法/非法转换和 pause/end 历史守恒有领域、应用、SQLite 与 IPC 证据；
3. schedule 非空、去重、1～7 映射和整组替换故障零变化；
4. 每天/工作日只展开为集合，不保存新 schedule 类型；
5. Today 只读展示当前日计划 active Routine 的基础项（身份、最低行动、可选 Goal、计划匹配和可操作性），不写 TodaySelection、不预生成 Record；五态 `recordState` 由 T022 增量加入；
6. schedule 修改不改变已有 RoutineRecord `plannedForDate` fixture；
7. 完全重开后 Routine 与 schedule 一致；
8. 不声称 AC-03 完整通过，只记录步骤 1～2 的贡献。

### 8.2 T022 — RoutineRecord 五语义与 Progress 事实

**范围**

- `target_met | acted | intentional_rest | not_done` 四种显式 outcome；
- `unknown = no RoutineRecord` 的只读投影；
- 当前记录入口、recording context、跨午夜确认和 `plannedForDate` 保存时快照；
- 同 Routine/LocalDate 唯一，重复提交冲突而非覆盖；
- 非计划日四种显式 outcome 均可无损保存为 `plannedForDate=false`，其中只有 `target_met/acted` 计真实行动；
- Progress 加入 RoutineRecord 时间、真实行动次数、达标事实和稳定排序；
- `GetRoutineDayState`、Routine Record DTO、IPC、UI 和真实重开；
- 完整自动化 E2E-AC-03 与人工验收准备。

**非范围**

- FR-R08 的常规历史补记、修改、替换、删除；
- Routine 硬删除、影响预览和级联 UI；
- 历史空白计划日统计、完成率、失败率、streak、复杂周期比较；
- Review、Recovery、AI、导出。

**依赖**

- T021 完成且有证据；
- S1 `GetProgress` 的最终 filter/DTO/排序/一致快照契约已按第 11 节复核确认；
- 本文及 S2-Q03-A/Q04-A/Q05-A/Q07-A/Q08-A/Q09-A/Q12-A 已获项目所有者批准；Routine 发生日严格复用 ED-017，不另设可选语义；
- 独立 T022 合同明确权限和验证命令。

**完成条件**

1. 四种持久化 outcome + 缺行 unknown 的全矩阵通过，数据库没有 unknown 行；
2. `target_met`/`acted` 均计真实行动且保持区别；rest/not_done/unknown 均不计实际行动；
3. 非计划日四种显式 Record 均保存 `plannedForDate=false`；只有 `target_met/acted` 计真实行动，四者均不计计划日达成；
4. schedule/minimumAction 修改不重算历史 Record；
5. 重复日、非法状态、非法 outcome/分钟组合、跨日未确认和任一故障均零写入；计划日与非计划日的四 outcome 均有测试；
6. Progress 保留 S1 ActionRecord 结果，同时加入 RoutineRecord，Query 重复调用零写入；
7. 完全重开后 Record、unknown 缺行和聚合一致；
8. Today 在保存后按已批准 S2-Q12 结果展示；E2E-AC-03 在同一最终 revision 连续通过；项目所有者未执行人工验收时明确为 `pending`；
9. 不声明 FR-R08、Review、完整 FR-D01 或 AC-07 完成。

### 8.3 T023 — 通用非强制 intention

**范围**

- 复用 S1 通用 Action 创建和生命周期；
- 用户把符合条件的 Action 作为当日 intention 选入、移出；
- 同 Action/LocalDate focus/intention 互斥与显式转换；
- Today 明确区分 focuses、intentions、plannedRoutines；
- 跨日后旧 intention 不自动滚动、不生成 Record/失败、不改变 Action；
- SQLite、IPC、Preload、Renderer 的最小纵向扩展；
- 完整自动化 E2E-AC-04 与人工验收准备。

**非范围**

- 兴趣/休息专属实体、模块、模板、完成率或统计；
- 新的 Action 状态、intention Record 类型、自动滚动、自动完成、提醒或候选排序；
- 修改 S1 focus、ActionRecord 或 post-record 的已批准含义；
- RoutineRecord、Review、Recovery、AI。

**依赖**

- 按任务索引以 T021 为前置，使扩展后的 Today 组合结构稳定；T023 不以 T022 完成为必要前置；
- S1 Action/TodaySelection 最终接口已按第 11 节复核确认；
- 本文及 S2-Q06-A 已获项目所有者批准；Today DTO 的兼容扩展已随本文批准，T023 不依赖 T022 的 Progress DTO 选择；
- 独立 T023 合同明确权限和验证命令。

**完成条件**

1. FR-A07、FR-T03、FR-T08 和 AC-04 的可观察路径存在；
2. intention 仍是 Action + TodaySelection，不增加用户一级概念或兴趣表；
3. 选入/移出/转换只来自用户命令，同日唯一且失败回滚；
4. next LocalDate 不自动出现旧 intention；旧 selection 不被删除或改写为失败；
5. 未发生时 ActionRecord 数、Action 状态、Progress 和失败事实均不变；
6. 若发生，使用正常 ActionRecord 路径且保持 S1 显式 post-record 语义；
7. 重开和跨日 E2E-AC-04 通过；项目所有者未执行人工验收时明确为 `pending`；
8. 无兴趣专属模块、意向完成率、提醒或惩罚文案。

## 14. 审批与后续门禁

本文交付时应核对：

- [x] T021～T023 均有范围、非范围、依赖和可判定完成条件；
- [x] AC-03、AC-04 有可在同一明确 revision 连续执行的自动化和人工程序；
- [x] `target_met`、`acted`、`intentional_rest`、`not_done`、`unknown` 五语义无损；
- [x] 计划日、非计划日、LocalDate、Today 和 Progress 使用同一事实边界；
- [x] intention 保持通用、非强制、非惩罚，不自动滚动或写失败；
- [x] 需求编号来自现行 PRD/DECISIONS/ED，没有新造编号；
- [x] S1 已冻结依赖、最终验收接口和已批准 S2 增量扩展已分开，验收后复核已完成；
- [x] 非范围没有变成接口、数据表、测试前置或完成条件；
- [x] 本文不包含完整 T021～T023 Prompt，不替代三个独立任务合同。

已完成门禁：

1. G3/S1 最终验收已由 `EV-G3-S1-002` 通过；
2. 第 11 节接口和数据依赖已按 `74ebe346...` / `52de81ff...` 完成复核；
3. 项目所有者已批准本文、S2-Q01～Q10/Q12 的 A 结果和 S2-Q11 对 ED-017 的继承，并授予 T021～T023 阶段级实现权限。

以下门禁是设计批准时的执行记录；其后续完成事实见页首、S2 归档、任务索引与 Evidence：

1. 分别从 `TASK_TEMPLATE.md` 创建并批准 T021、T022、T023 独立任务合同；
2. 每个任务分别确认允许文件、排除项、验证命令、依赖、migration 和具体 Git/GitHub 权限，再按任务账本进入 `ready/active`；
3. 严格按 T021 → T022 完成 AC-03；T023 在 T021 完成后按其独立合同执行并完成 AC-04；
4. 只有真实自动化、独立 review、hosted CI 和项目所有者人工验收完成后，才更新任务与证据状态；
5. `dev → main`、merge、tag 和 release 继续遵守单独授权，不由本次 S2 批准推定。

**本文已获项目所有者批准，T021～T023 已获得按本文范围实施的阶段级授权；该授权不替代三个独立任务合同，不自动包含新增/升级依赖、migration、branch、commit、push、PR、merge、`main`、tag 或 release 权限，也不表示任一任务已经启动、完成或通过验收。**

## 补充执行与批准上下文

### 原文片段 1

除非后续独立任务合同另行列出并获得项目所有者批准

### 原文片段 2

独立任务合同可在语义、职责和追踪不变时调整命名

### 原文片段 3

后续任务合同可以选择把 focus/intention

### 原文片段 4

T021～T023 已获得项目所有者按本文范围实施的阶段级授权，但仍必须作为三个独立任务按账本顺序和各自合同执行；不得合并成一个无合同的批量实现，也不得以该授权推定具体 Git/GitHub、依赖或 migration 权限。

### 原文片段 5

不得进入 T021～T023 合同或实现

### 原文片段 6

后续 T022 合同只需复核接口形状，不得重新开放其日期语义

### 原文片段 7

#### 11.2 已实现且经 S1 最终验收后复核确认

以下运行时事实由 S1 最终行为验收 revision `dev@74ebe346a86cf431d87e02e8a1220b713b33901c` 证明，并在当前复核基线 `dev@52de81ff6fc95df5ac53e998824ff07135e792b3` 重新核对。两者之间没有运行时代码、测试、依赖、配置、schema 或 migration 变化。

| 已验收依赖 | 复核确认的事实 | S2 使用方式 |
|---|---|---|
| `window.myTracer` / Preload | 顶层精确为 `shell/goals/actions/today/records/progress`，顶层和子 API 均冻结，尚无 routines | 增量增加 routines 及既有 today/progress 方法；不得暴露通用 invoke、Node 或 Electron 对象 |
| Today DTO | 精确为 `localDate/focuses/availableActions`；`ActionDetailDto.selectedForToday` 只表示 focus | 增量增加 intentions/plannedRoutines/commitment，不能重解释既有 boolean |
| Today Application | 只投影 `kind=focus`；select 遇到非 focus commitment、remove 遇到 intention 都明确拒绝 | 按 S2-Q06-A 新增 intention 命令和显式转换，保持 focus 行为与错误回归 |
| TodaySelection persistence | v1 允许 focus/intention，同 Action/日唯一；底层 save 可 upsert kind | Application 必须阻止未确认的静默转换；同日只有一个 commitment |
| Progress DTO/Application/SQL | filter 为可选 `goalId/from/through` 且端点包含；当前只有 ActionRecord `records[]`、总分钟和真实次数；稳定排序、只读一致快照已验收 | 按 S2-Q08-A 兼容增加 `routineRecords[]` 和汇总字段，保留逐 ActionRecord 计次、筛选与排序 |
| RepositoryPort/UoW | 已有通用 Routine save/snapshot 与 S1 意图级端口；仍缺 Routine find/list、schedule replace、RoutineRecord 查询和 Routine Progress 查询 | 在独立任务中新增意图级端口；所有确认写入继续走单个 UoW transaction |
| LocalDate/Clock | 已有规范日期、加日、周范围、`ClockPort.snapshot()` 和 ED-017 日期决策；weekday 计算仍为内部 helper | T021 可公开一个纯 weekday helper，不复制 UTC/Date 推导；T022 直接复用跨午夜语义 |
| recording context | S1 已验收 sender/action/capturedOn 绑定、替换/取消/消费/窗口关闭失效和跨午夜确认 | T022 建立独立 Routine context store 或语义等价复用，绑定 sender/routineId 且不放宽 ActionRecord 入口 |
| v1 schema/migration | `schemaVersion=1`、唯一 `001_initial`，全部 S2 表和关键约束已确认 | 按批准设计不新增 migration、不修改 `001_initial.sql`；发现缺口即停止并另行审批 |
| Main composition/security | 共享 SystemClock、UUID、Repository/UoW、固定注册器和 sender/origin 校验已验收 | 新服务和 IPC 复用同一组合/校验模式，不建立旁路 |
| S1 状态不变量 | reschedule/complete/cancel、Goal pause/end、ActionRecord、focus、Progress 事实公式均有最终证据 | T021～T023 必须在 `52de81ff...` 或其明确后继上运行完整受影响 S1 回归 |

复核结论：T014 独立 review、hosted CI、完整人工 AC-01、T801 package smoke 修复、G3/S1 最终通过、PR #13 归档与 PR #15 状态收口均已核对。`EV-G3-S1-001` 的首轮失败继续保留，`EV-G3-S1-002` 的最终通过不被改写成发生在文档后继 `52de81ff...` 上。



### 原文片段 8

应记录为依赖/缺口并停止受影响工作，不得在 S2 中直接修复 S1

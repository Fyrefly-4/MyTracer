# T022 RoutineRecord 五态语义与 Progress 事实投影任务合同

> 合同状态：**交付完成；项目所有者于 2026-08-15 批准合同与实施权限，并在实现、自动验证、独立复核和 hosted CI 后明确报告“T022 人工验收：通过”及批准文档收口**
>
> 拟启动基线：`dev@e3e7346eba492f1de810ffe34b41b1d96831c3af`（2026-08-15 已通过 `git ls-remote origin refs/heads/dev` 核验为最新 `origin/dev`；该 revision 为 T021 PR #17 的 squash merge）
>
> 当前权限：文档收口、独立 `docs: close T022 delivery records` commit、push 和最终 head required CI 已获批准；Ready、merge、`main`、tag 和 release 未授权

## 1. 任务信息

- **Task ID**：T022
- **Title**：RoutineRecord five-state semantics and factual Progress projection
- **Slice / Plan item**：S2 / E2-02
- **Task ledger status**：`done`
- **Base branch / revision**：`dev@e3e7346eba492f1de810ffe34b41b1d96831c3af`
- **Expected branch**：`task/T022-routine-record-facts`
- **Task worktree**：`.tmp/T022-worktree`
- **前置事实**：T021 已合入 `dev` 并由 `EV-T021-001` 标记为 `done`；S2 整体设计已批准并合入；T022 只能在本合同获批后实施。

## 2. 目标结果

在不改变 S1 ActionRecord、Today focus、Progress 筛选/排序/计次语义和 T021 Routine 生命周期/星期节奏语义的前提下，交付 RoutineRecord 的最小完整纵向路径：

- 用户可以为当前 active Routine 明确保存 `target_met`、`acted`、`intentional_rest`、`not_done` 四种结果；`unknown` 仅由该 Routine/LocalDate 缺少 Record 投影，不能保存；
- 同一 Routine/LocalDate 最多一条 Record；T022 使用 create-only 语义，已有记录返回稳定 `record-already-exists` 冲突并零写入，不覆盖、不修正、不删除；
- Main 在打开记录表单时固定 `capturedOn`，用绑定 sender/routineId 的 opaque recording context 执行 ED-017；跨午夜保存必须由用户明确选择保留原日期或使用当前日期；
- Application/Domain 在保存事务内基于最终 `occurredOn` 与当时 schedule 计算并保存 `plannedForDate`；之后修改 schedule 或 `minimumAction` 不回算、不重写历史；
- active Routine 在非计划日也可由用户明确保存四种结果，统一保存 `plannedForDate=false`；其中 `target_met`/`acted` 计真实行动，四种结果均不计计划日达成；
- Today 增量展示计划 Routine 的 `target_met | acted | intentional_rest | not_done | unknown` 当日投影；保存后该 Routine 继续显示并标注结果；Query 不补行；
- Progress 保留 S1 `records[]` 及其字段、筛选和排序含义，兼容增加可区分的 `routineRecords[]`、Routine 达标汇总和两类 Record 的统一总时长/真实行动次数；
- 完全关闭 SQLite/Electron 并从同一隔离测试数据根重开后，Record、缺行 unknown、`plannedForDate` 快照、Today 和 Progress 聚合一致。

T022 已完成 AC-03 的自动化完整场景，项目所有者于 2026-08-15 按独立临时 `userData` 人工方法执行后明确报告“T022 人工验收：通过”。T022 不实现或声明 AC-04、FR-R08、完整 FR-D01 或 AC-07。

## 3. 需求与设计依据

- **FR**：FR-R04～FR-R07、FR-R09、FR-P02；FR-P01/P07/P08 作为 Progress 事实、非评价和时间聚合的直接横切依据；FR-D01 仅声明 RoutineRecord 重开子集。FR-R08 只作为明确延期到 T031 的范围守恒依据，T022 不声明完成。
- **AC**：AC-03；不得进入 AC-04。
- **D**：D-008、D-009、D-010、D-107；D-003/D-007/D-016 作为四核心概念与事实型 Progress 横切约束。
- **ED**：ED-017；同时遵守 ED-003、ED-004、ED-008、ED-012、ED-015、ED-016、ED-018、ED-019。
- **GW**：GW-001～GW-004、GW-008～GW-010。
- **已批准 S2 决定**：S2-Q03-A、S2-Q04-A、S2-Q05-A、S2-Q08-A、S2-Q09-A、S2-Q12-A；S2-Q11 直接且唯一遵循 ED-017。T021 已落地的 S2-Q07-A 继续作为 Goal/Routine 生命周期接缝不变量，不在 T022 重新决策。
- **直接相关架构章节**：
  - `PRODUCT_REQUIREMENTS_V0.1.md` §4 PR-02～PR-06、§6.3/6.5/6.6、§7.1～7.2、§8 F-04、§9.3/9.7、§12 AC-03；
  - `DECISIONS.md` D-008～D-010、D-107；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-003/004/008/012/015～019；
  - `DOMAIN_MODEL_V0.1.md` §1～2、§5～6、§8～10；
  - `DATA_DESIGN_V0.1.md` §2～6、§8、§10～12；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §5.4～5.5、§6～7、§8.4、§9～12；
  - `S2_ROUTINE_INTENTION_DESIGN_V0.1.md` §0～8.2、§9～14，重点 §4.3～4.4、§5、§6、§7、§8.2、§9.2、§11～13；
  - `TEST_STRATEGY_V0.1.md` §1～6、§7 E2E-AC-03、§8～10；
  - `REQUIREMENTS_TRACEABILITY_V0.1.md` §2.3、§2.7、§4～6；
  - `IMPLEMENTATION_PLAN_V0.1.md` §1～2、E2-02、§11～12；
  - `T021_ROUTINE_LIFECYCLE_TASK.md`、`TASK_INDEX_V0.1.md`、`TASK_TEMPLATE.md`、`GITHUB_WORKFLOW_V0.1.md`；
  - `EV-T021-001` 与 `EV-G3-S1-002` 所记录的已验收基线。

`user/` 不属于本合同依据，不得成为实现、测试或验收依赖。

## 4. 开始条件与审批门

已核验：

- [x] 2026-08-15 远端最新 `origin/dev` 与本地 `dev` 均为 `e3e7346eba492f1de810ffe34b41b1d96831c3af`，主工作树在合同起草前干净。
- [x] 该 revision 包含 T021 squash merge；`TASK_INDEX_V0.1.md` 标记 T021 `done`，证据为 `EV-T021-001`。
- [x] S2 设计已批准并合入，且 S2-Q03-A/Q04-A/Q05-A/Q08-A/Q09-A/Q12-A 已批准；S2-Q11 唯一遵循 ED-017。
- [x] S1 最终 Progress filter/DTO/排序/一致事实投影和 recording context 契约已复核；T021 Routine/Today 接口已在当前 `dev` 实际存在。
- [x] v1 schema 已包含 `routine_records` 的四 outcome CHECK、`planned_for_date`、可空非负分钟、Routine FK 与 `UNIQUE(routine_id, occurred_on)`；本任务不需要 migration，也不得修改 `001_initial.sql`。
- [x] 当前 Node `24.18.0`、npm `11.16.0`、Electron `43.3.0`、`better-sqlite3@13.0.1` 及稳定验证命令已经存在；无需新增或升级依赖。
- [x] 已按本次明确指令从该 revision 创建独立 `.tmp/T022-worktree` / `task/T022-routine-record-facts`，未修改代码、测试、schema 或数据。
- [x] 起草时未发现 MUST、已批准 D/ED、S2 决定、T021/S1 契约或 v1 schema 冲突。

开始实现前仍必须满足：

- [x] 项目所有者于 2026-08-15 明确批准本合同的目标、文件范围、非范围、不变量、验证、依赖、数据与 Git/GitHub 权限，并激活 T022。
- [x] 已同步本合同批准状态和 `TASK_INDEX_V0.1.md` 的真实 `active` 状态。
- [x] 已再次核验 `origin/dev`、分支 HEAD、`git status`、worktree 列表、无重叠 active 业务任务及无用户自有修改；`origin/dev` 仍为 `e3e7346eba492f1de810ffe34b41b1d96831c3af`。

## 5. 允许的实现行为

### 5.1 Domain / Application

- 新增 RoutineRecord 领域模型和纯校验：四种持久化 outcome、规范 LocalDate、可空 note、`target_met/acted` 可选非负整数分钟、`intentional_rest/not_done` 分钟必须为 `null`；0 表示少于一分钟且确有行动。
- `unknown` 只由 `no RoutineRecord` 查询产生；不得成为领域创建输入、持久化 outcome、IPC 保存枚举或后台补行。
- 实现 `BeginRoutineRecording`、`CancelRoutineRecording`、`RecordRoutine`：开始/保存都复核 Routine；只允许 active Routine 的当前记录入口；Goal paused/ended 不阻塞仍 active Routine。
- 复用 ED-017 的三段 recording context 生命周期：同一 sender/routine 只保留最新 context；取消、替换、成功消费、reload/navigation、窗口关闭和应用退出后失效；跨午夜首次提交按 S1 契约返回 `date-confirmation-required` 结果分支且零写入。
- `RecordRoutine` 在一个 UnitOfWork 事务中复核 active 状态、同日不存在、根据最终 `occurredOn` 和当前 schedule 计算 `plannedForDate`、创建一条 Record；任何失败零变化。
- 实现 `GetRoutineDayState(routineId, localDate)` 只读查询；有 Record 返回完整显式事实，无 Record 返回 `unknown`，并可返回“按当前 schedule 是否匹配”的辅助信息，但不得把当前匹配冒充历史计划快照。
- 增量扩展 `GetToday`：计划 Routine 项加入 `recordState` 及已有 RoutineRecord 展示所需字段；保存后仍显示；无行严格为 `unknown`。
- 按 S2-Q08-A 增量扩展 `GetProgress`：保持 S1 `records[]` 及 filter/排序/子事实语义，增加 `routineRecords[]`、`targetMetCount`、`plannedTargetMetCount`；`totalDurationMinutes` 与 `realActionCount` 扩展为两类事实之和。

### 5.2 Repository / SQLite / 一致性

- 复用 `schemaVersion=1` 和既有表；新增意图级 RoutineRecord create/find/list/day-state/Progress 读取端口，不向 Renderer 暴露通用 Repository、snapshot 或 SQL。
- Application 保存路径必须调用 create-only Repository 方法；不得用现有 `saveRoutineRecord` 的按 ID upsert 语义覆盖事实。若保留通用 save 供 fixture/基础契约使用，也不得成为 T022 Command 的写入口。
- 同 Routine/LocalDate 已存在时，在事务内返回稳定 `record-already-exists`；数据库 UNIQUE 竞态也必须映射为同一中性冲突并零写入，不能泄露 SQL。
- `plannedForDate` 只在创建时写入；schedule/`minimumAction` 修改、Today/Progress/day-state Query、重开或跨日均不得 update 既有 RoutineRecord。
- Progress 对 ActionRecord 与 RoutineRecord 使用一个可证明的一致只读快照或语义等价单查询；不得让两个分支、总数与明细来自不同提交状态。
- Progress 日期过滤保持包含端点；Goal filter 对 RoutineRecord 使用查询时 Routine 当前 `goalId`，不伪造 Record Goal 快照；两类明细均显式稳定排序，不依赖 SQLite 隐含行序。
- Query 前后完整数据库 snapshot 相同；不得创建 unknown 行、累计表、TodaySelection 或任何自动状态。

### 5.3 IPC / Preload / Renderer

- 为 begin/cancel/record/day-state 使用固定窄 channel，并兼容扩展既有 Today/Progress；复用 sender/origin 校验且对 DTO 做运行时严格形状校验。
- 拒绝未知多余字段、非法 UUID/LocalDate/outcome、负数或小数分钟、rest/not_done 携带分钟、伪造/失效/已消费 context、sender/routine 不匹配、非法 date choice；Renderer 不能提交可信 `occurredOn`、`plannedForDate`、weekday、审计时间或统计结果。
- 错误使用稳定中性 code/message，至少覆盖 `validation`、`not-found`、`invalid-transition`、`invariant-violation`、`record-already-exists`、`invalid-recording-context`、`persistence-failed`；跨午夜待确认沿用 S1 的成功结果判别分支 `date-confirmation-required`，不得伪装成持久化成功，也不得泄露 SQL、堆栈、绝对路径或用户正文。
- Preload 只在既有冻结 `window.myTracer.routines` 中增加具体记录方法，并兼容扩展 `today.get` / `progress.get` DTO；不新增通用 invoke、任意 channel 或新的一级 API 概念。
- Renderer 在 Routine 入口允许 active Routine 记录今天，包括非计划日；Today 计划项可直接记录并显示五态；四种 outcome 文案无损、中性，非计划日明确标注“非计划日事实”。
- `target_met/acted` 可选输入分钟；`intentional_rest/not_done` 不显示或不提交分钟；note 可选；表单打开后清楚显示捕获日期，跨午夜要求显式选择。
- Progress 清楚区分 Action 事实和 Routine 事实；显示时间、真实行动次数、Routine outcome、计划快照和达标计数，不显示 score、streak、失败率、完成率、掌握度或人格评价。

## 6. 精确文件范围

合同获批后仅允许新增或修改下列文件；未实际需要的候选文件保持不动。发现必须扩大范围时先停止并申请批准。

**Task contract / evidence ledger**

- `docs/implementation/T022_ROUTINE_RECORD_FACTS_TASK.md`
- `docs/implementation/TASK_INDEX_V0.1.md`（仅在合同批准后记录 `active/review/done` 的真实状态）
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`（仅从真实结果记录 `EV-T022-001` 与 AC-03 自动/人工状态）

**Domain / Application / Contracts**

- `src/domain/routine-record.ts`（新增）
- `src/domain/progress.ts`
- `src/domain/index.ts`
- `src/application/routine-records.ts`（新增）
- `src/application/ports/persistence.ts`
- `src/application/today.ts`
- `src/application/progress.ts`
- `src/contracts/routine-records.ts`（新增；如类型直接收敛进 `routines.ts`，则不创建）
- `src/contracts/routines.ts`
- `src/contracts/today.ts`
- `src/contracts/progress.ts`

**SQLite / Main / Preload / Renderer**

- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/routine-recording-contexts.ts`（新增独立窄 store；不得修改或放宽 Action context）
- `src/main/routine-records-ipc.ts`（新增；若固定 channel 收敛于现有注册器，则不创建）
- `src/main/routines-ipc.ts`（仅记录 DTO/channel/错误映射确有需要时）
- `src/main/today-ipc.ts`（仅兼容 DTO/错误映射确有需要时）
- `src/main/progress-ipc.ts`（仅兼容 DTO/错误映射确有需要时）
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

**Tests**

- `tests/unit/routine-record-domain.test.ts`（新增）
- `tests/unit/routine-record-application.test.ts`（新增）
- `tests/unit/routine-recording-contexts.test.ts`（新增）
- `tests/unit/routine-application.test.ts`（仅 T021 历史守恒回归）
- `tests/unit/today-application.test.ts`
- `tests/unit/progress-application.test.ts`
- `tests/integration/routine-record-sqlite.test.ts`（新增）
- `tests/integration/routine-record-ipc.test.ts`（新增）
- `tests/integration/routine-sqlite.test.ts`（仅 T021 历史/唯一性回归）
- `tests/integration/routine-ipc.test.ts`（仅 API/channel 兼容回归）
- `tests/integration/progress-sqlite.test.ts`
- `tests/integration/progress-ipc.test.ts`
- `tests/integration/main-foundations.test.ts`（仅顶层/子 API 冻结和 context 清理断言需要时）
- `tests/e2e/routine-record-progress.e2e.test.ts`（新增，完整 E2E-AC-03）
- `tests/e2e/routine-lifecycle.e2e.test.ts`（仅 T021/Today 接缝回归或复用 UI fixture 需要时）
- `tests/e2e/progress-core-loop.e2e.test.ts`（仅 S1 Progress 兼容断言需要时）
- `tests/e2e/shell.e2e.test.ts`（仅窄 API 冻结回归）
- `tests/e2e/windows-package-smoke.e2e.test.ts`（仅窄 API 冻结回归；T022 不要求运行 package smoke）

`src/infrastructure/sqlite/migrations/001_initial.sql` 仅可只读核验，不在允许修改范围。`package.json`、lockfile、构建配置、CI、PRD、DECISIONS、架构基线、S1/T021 已完成证据和 `user/` 均不在实现修改范围。

## 7. 明确非范围

- Routine 生命周期、星期节奏、最低行动和 Goal 接缝的新扩展；这些属于已完成 T021，只做必要回归。
- Action intention、focus/intention 转换、兴趣/休息专属模块或 AC-04；这些属于 T023。
- FR-R08 的常规历史补记、修改、替换、删除；任意历史日期选择；Routine/Goal/Action/Record 硬删除、影响预览、二次确认和级联 UI；这些属于 T031。
- 用 overwrite/upsert、同日第二条 Record 或测试直接改库模拟用户修正。
- schedule/`minimumAction` 版本历史、历史空白计划日重建、RoutineRecord Goal/minimumAction 快照。
- 计划完成率、失败率、streak、连续打卡、分母型 unknown 统计、复杂周期比较、复杂日历、自动排程、提醒、通知或后台任务。
- Review、Recovery、AI、导出/导入及 S3～S7；T022 不实现或宣称完成 AC-04/05/06/07。
- 改变 S1 ActionRecord outcome、每条计次、Goal/日期筛选、排序、Understanding/open Confusion 或 Today focus 语义。
- 新用户可见一级概念、通用记录平台、动态表单、插件、账号、同步或其他延期能力。
- 新增/升级依赖、任何 migration、修改 `001_initial.sql`、schemaVersion、真实用户数据操作、package/NSIS 验证。
- Draft → Ready、merge 到 `dev`、创建/合并 `dev → main`、tag、release、force-push、远端分支删除、branch protection、Actions secrets 或仓库设置变更。

## 8. 必须保持的不变量

1. `target_met`、`acted`、`intentional_rest`、`not_done`、`unknown` 无损且互不折叠；只有前四种可持久化。
2. unknown 是缺行查询结果，不写数据库、不自动补成 `not_done`，也不进入失败、完成率或任何负面分母。
3. `target_met`/`acted` 都是实际行动并分别保留 outcome；`intentional_rest`/`not_done` 都不计实际行动且仍互相区分。
4. `target_met/acted` 的 `durationMinutes` 可为 `null` 或非负整数；0 表示少于一分钟且确有行动；rest/not_done 必须为 `null`，不能用分钟推断 outcome。
5. 每个 Routine/LocalDate 最多一条 Record；T022 create-only，重复保存冲突且零写入，不覆盖历史。
6. `plannedForDate` 是创建事务内按最终 `occurredOn` 与当时 schedule 计算的历史快照；Renderer 不可信；后续 schedule/`minimumAction` 修改不重写。
7. 非计划日四 outcome 均可保存为 `plannedForDate=false`；仅 target_met/acted 计真实行动，四者均不冒充计划日达成，也不改变 schedule。
8. 表单打开时固定 `capturedOn`；跨午夜只接受显式 `keep-captured-on | use-current-on`；不得静默改日或借此开放任意历史补记。
9. pause/end 保留所有 Record；只有 active Routine 有 T022 当前记录入口；Goal paused/ended 不自动修改或阻塞仍 active Routine。
10. Today 保存后继续显示计划 Routine 及明确结果；缺行才为 unknown；非计划日缺行不进入 Today 或 Progress fact。
11. Progress 的 Action `records[]`、筛选、排序、逐 Record 计次、Understanding/open Confusion 含义不变；`routineRecords[]` 保持两类事实可区分。
12. `totalDurationMinutes = ActionRecord minutes + target_met/acted 的非空 RoutineRecord minutes`；`realActionCount = ActionRecord 数 + target_met/acted RoutineRecord 数`；`targetMetCount` 只计 target_met；`plannedTargetMetCount` 只计 `target_met && plannedForDate`。
13. Query 零写入；Today/Progress/day-state 不生成 RoutineRecord、unknown 行、累计表或状态变化；Progress 两分支来自一致只读快照。
14. 所有业务写入经 Application Command/Domain 不变量，并在一个 UnitOfWork 事务内完成；等待用户跨日选择时不持有 SQLite 事务。
15. Renderer 无 Node、SQLite、文件、凭据、Provider、Clock、任意 IPC 或 Electron 对象；Preload 只暴露具体冻结方法并严格校验 sender/origin 与 DTO。
16. 自动化使用 FakeClock、每 case/进程唯一临时 SQLite 与 Electron `userData`，不得访问、迁移、删除或清理真实用户数据。
17. T022 不实现或宣称 FR-R08、AC-04、Review、完整 FR-D01、AC-07 或其他 S3～S7 能力完成。

## 9. 交付物与验收标准

1. Domain/Application/Repository/SQLite/IPC/Preload/Renderer 的真实路径能开始、取消并保存 RoutineRecord，四种显式 outcome 全部可观察，非法组合零写入。
2. 缺少行时 `GetRoutineDayState` 和 Today 只返回 unknown；数据库 snapshot、schema 枚举和 migration 扫描证明没有 unknown 行或自动补行。
3. 同 Routine/LocalDate 首次 create 成功；重复、双击/重试及 UNIQUE 竞态返回 `record-already-exists`，原记录逐字段不变。
4. 计划日与非计划日分别覆盖四 outcome；非计划日统一 `plannedForDate=false`，只有 target_met/acted 进入真实行动次数，四者均不增加计划日达成。
5. `target_met/acted` 的 null/0/正整数分钟合法；负数、小数非法；`intentional_rest/not_done` 携带任何非 null 分钟均非法且零写入。
6. schedule 与 `minimumAction` 修改后，既有 Record 的 `occurredOn/outcome/plannedForDate/durationMinutes/note` 不变；旧 target_met 不按新最低行动重判。
7. recording context 对 sender/routine 绑定，取消、替换、成功消费、reload/navigation、窗口关闭和退出后失效；跨午夜未确认零写入，两个明确选择保存到正确 LocalDate。
8. Today 无 Record 显示 unknown；保存后 Routine 仍显示对应显式 outcome；paused/ended Routine 不进入计划列表但历史仍在；关联 Goal paused/ended 不阻塞 active Routine。
9. Progress 保留全部 S1 Action facts，同时返回可区分 Routine facts；日期端点、Goal filter、空值分钟、0 分钟、四 outcome、计划达成和稳定排序公式正确。
10. Progress/Today/day-state 重复 Query 前后数据库 snapshot 相同；Action/Routine 分支、汇总与明细从一致只读快照产生。
11. 完全关闭 SQLite/Electron 并从同一隔离根重开后，Record、缺行 unknown、计划快照、Today 和 Progress 聚合一致；AI 未配置不影响路径。
12. 完整 E2E-AC-03 在同一最终 revision 和 FakeClock 上连续覆盖：创建每日 Routine、unknown、四 outcome、非计划日四 outcome、schedule 修改后快照守恒、pause/end、重开和事实 Progress。
13. S1 ActionRecord/Today/Progress、T021 Routine lifecycle/schedule/Today、Preload 安全和窄 API 契约回归通过；无新依赖、无 migration、`001_initial.sql`/schemaVersion 不变。
14. 最终 diff 仅含批准范围；完成 diff 自查、schema/事务审查、独立只读 review、目标验证、完整 `verify` 和最新 Draft PR head hosted Windows required gate。
15. 证据只声明 FR-R04～R07/R09、FR-P02（及 FR-P01/P07/P08 的 T022 事实贡献）、FR-D01 RoutineRecord 重开子集与 AC-03 自动化状态；不声明 FR-R08、完整 FR-D01 或 AC-07。
16. **MANUAL**：项目所有者确认 Today/记录表单/Progress 中五种语义清楚且中性，保存后显示规则符合 S2-Q12-A，非计划日事实不冒充计划达成，跨午夜选择清楚；实际执行前保持 `pending`。

## 10. 验证计划

### 10.1 针对性验证

```powershell
npm.cmd exec -- vitest run --project unit tests/unit/routine-record-domain.test.ts tests/unit/routine-record-application.test.ts tests/unit/routine-recording-contexts.test.ts tests/unit/routine-application.test.ts tests/unit/today-application.test.ts tests/unit/progress-application.test.ts
npm.cmd exec -- vitest run --project integration tests/integration/routine-record-sqlite.test.ts tests/integration/routine-record-ipc.test.ts tests/integration/routine-sqlite.test.ts tests/integration/routine-ipc.test.ts tests/integration/progress-sqlite.test.ts tests/integration/progress-ipc.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd exec -- playwright test tests/e2e/routine-record-progress.e2e.test.ts tests/e2e/routine-lifecycle.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/action-record.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

若实现中确认某候选回归文件完全未受接口或行为影响，可以不修改该文件，但完整 `verify` 仍必须运行全量测试；证据需列明实际执行的精确命令和差异。

### 10.2 受影响范围回归

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
git diff --check
```

`verify` 已包含 build 和 Electron E2E；它不证明 package/NSIS、hosted CI、人工验收、Ready 或 merge。T022 不要求 `npm ci`、安装、package、package smoke 或 live AI。

### 10.3 AC-03 自动化连续程序

在同一明确 revision、FakeClock 和隔离 `userData` 上：

1. 创建“每日轻量活动”Routine，保存非空最低行动和每天 weekday 集合；关闭并重开，确认 Today 显示且无 Record 为 unknown。
2. 在不同明确 LocalDate 或彼此隔离场景保存 `target_met`、`acted`、`intentional_rest`、`not_done`；不通过覆盖同日 Record 模拟状态。
3. 验证 target_met/acted 各增加一次真实行动并保持 outcome 区别；rest/not_done 不增加真实行动；空白计划日没有数据库行且仍为 unknown。
4. 修改 schedule，使四个未来明确 LocalDate 成为非计划日；分别保存四 outcome，均为 `plannedForDate=false`；只有 target_met/acted 增加真实行动，四者均不增加计划日达成。
5. 再次修改 schedule 把上述日期纳入当前计划集合，验证既有 `plannedForDate=false` 与全部 Record 字段不变。
6. 覆盖 target_met/acted 的 null/0/正整数分钟、rest/not_done 的 null 分钟、重复日冲突和跨午夜两个选择；所有非法或未确认分支零写入。
7. pause/end 并真正关闭 Electron/SQLite 后重开，验证历史 Record、unknown 缺行、Today 生命周期投影和 Progress 事实仍正确。

这条程序完成 AC-03 的自动化路径，不进入 Review；项目所有者完整人工五态验收仍须实际执行并记录。

### 10.4 人工步骤

1. 创建每日 Routine，确认未记录时 Today 明确显示 unknown/未记录，而非失败或未进行。
2. 分别体验四 outcome，确认含义、分钟输入和保存后 Today 显示清楚；`acted` 是正向事实但不冒充达标，主动休息无负面评价。
3. 从 Routine 非计划日入口保存真实行动，确认 UI 标注“非计划日事实”，Progress 计行动但不计计划达成、不改变 schedule。
4. 打开表单后跨午夜，分别选择保留原日期和使用今天，确认不存在静默改日。
5. 查看 Progress，确认 Action 与 Routine 事实可区分，累计时间/次数准确，且没有 score、streak、失败率、完成率、掌握度或人格评价。
6. 关闭并重开，复核 Record、unknown、计划快照与 Progress；实际结果记录为 pass/fail/partial。

### 10.5 验证环境与证据

- **OS**：Windows（当前环境与 hosted `windows-2025` required gate）
- **Node / npm**：`24.18.0` / `11.16.0`
- **Electron / SQLite driver**：Electron `43.3.0` / `better-sqlite3@13.0.1`
- **Clock**：自动化使用 FakeClock；不依赖真实当天
- **Data root**：每 case/进程唯一临时目录；E2E 使用唯一临时 Electron `userData`
- **AI**：未配置或 fake；不得使用 live Provider
- **Source revision**：每次证据记录确切 commit/PR head 或明确 uncommitted timestamp
- **Evidence**：`EV-T022-001` 绑定命令、环境、结果、artifact/CI URL、限制和 manual 状态；AC-03 索引只从真实结果更新

## 11. Git、GitHub、依赖与外部操作权限

项目所有者于 2026-08-15 批准以下权限：

- [x] 从已核验最新 `dev` 创建本地 `.tmp/T022-worktree` 和 `task/T022-routine-record-facts` 分支（已完成，无代码/测试/数据修改）。
- [x] 在批准文件范围内实施，并创建按 Domain/Application、Persistence/IPC、Renderer/E2E 等有意义检查点拆分的本地提交。
- [x] 推送 `task/T022-routine-record-facts`。
- [x] 创建并更新到 `dev` 的 Draft PR，维护 Task/Goal/Requirements/Scope/Exclusions/Changes/Verification/Evidence/Risks/Dependency changes。
- [x] 在每个实现候选和最终文档 head 等待并读取 required hosted CI；仅按批准范围修复失败后重新推送。
- [x] 在首个实现候选 green CI 后，按 `mytracer-stage-development` skill 提交精确文档影响矩阵，并再次请求文档收口、独立 `docs: close T022 delivery records` commit 与 push 授权。
- [ ] Draft → Ready 仍须项目所有者另行授权。
- [x] Agent 不得 merge 到 `dev`，不得创建或合并 `dev → main` PR，不得创建 tag/release，不得 force-push 或删除远端分支。

项目所有者于 2026-08-15 在首个绿色实现 CI 后审阅精确影响矩阵，明确授权修改本合同、`TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md` 和 Draft PR 正文，创建独立 `docs: close T022 delivery records` commit、push，并读取最终 head CI。README、实施计划、S2 设计、需求追踪、PRD、DECISIONS 与 `user/` 无事实性漂移，保持不动。

依赖与外部操作：

- **新增/升级依赖**：无；`package.json` 和 lockfile不得修改。
- **安装**：不授权 `npm install`/`npm ci`；使用现有依赖。若 worktree 缺少可用依赖或原生模块，停止并申请授权，不复制秘密或真实数据。
- **Network**：合同获批时可一并授权仅针对 `origin/dev` 核验、任务分支 push、Draft PR/CI/review 的必要网络访问；不访问 live AI 或其他外部服务。
- **AI Provider**：无 / fake；不得使用真实密钥。
- **External writes**：若获批，仅限上述 task branch、Draft PR 与 CI；Ready/merge/仓库配置变更不授权。
- **Data operations**：仅隔离临时测试数据；无真实用户数据写入、迁移、删除或破坏性操作。

## 12. 风险与停止条件

主要风险：

- 现有 `saveRoutineRecord` 是按 ID upsert 的基础端口；若 Application 直接复用，可能绕过 create-only 意图或把未来修改能力提前带入 T022。
- SQLite UNIQUE 能拒绝同 Routine/日期第二行，但 Application 仍需稳定冲突、并发映射和逐字段零变化证据，不能把原始 constraint/SQL 暴露给 Renderer。
- Today 的 unknown 容易被错误保存为 outcome，或因保存后隐藏 Routine 而无法核对 S2-Q12-A。
- Progress 从 Action 与 Routine 两次独立读取可能产生跨提交不一致；必须用可证明的统一只读快照，同时保持 S1 明细/筛选/排序契约。
- 可空分钟中 `null` 与 0 语义不同；rest/not_done 携带分钟会制造矛盾事实。
- `plannedForDate` 若在查询时按当前 schedule 重算，会在 schedule 变化后使历史漂移。
- 为非计划日提供入口时，不能把该日写入 schedule、把四 outcome 缩窄为仅行动结果，或借机开放任意历史补记。
- 复用 Action recording context 若放宽实体绑定、channel 或清理规则，会回归 S1 安全边界；优先使用独立窄 store 或无损通用化并做完整 S1 回归。
- S1 Progress E2E 曾出现一次不可稳定复现的首屏 0/0；等待应基于可观察事实，禁止用固定 sleep 掩盖，任何复现都必须保留并报告。

发现以下任一情况，立即停止受影响工作并报告：

- MUST、已批准 D/ED、S2-Q03-A/Q04-A/Q05-A/Q08-A/Q09-A/Q12-A、ED-017、T021/S1 契约或实际 v1 schema 冲突；
- 需要新增/升级依赖、任何 migration、修改 `001_initial.sql`/schemaVersion 或执行真实数据操作；
- 需要实现 FR-R08、覆盖/修改/删除历史 Record、任意历史补记、Action intention、Review、Recovery、AI、提醒、复杂日历、评分或其他非范围能力；
- 无法保证 create-only、唯一冲突零写入、Query 零写入、Progress 一致快照、`plannedForDate` 历史守恒、ED-017 或测试数据隔离；
- `origin/dev` 漂移导致基线、接口、schema、依赖或批准文件范围发生实质变化；
- 需要扩大文件范围、Git/GitHub/外部写入权限，或无法产生可靠验收证据。

## 13. 文档收口门禁

实现、目标验证、完整 `verify`、最终 diff 自查、独立只读 review 和首个 Draft PR head required CI 全部通过后，必须停止并向项目所有者提交文档影响矩阵。至少评估：

- 本合同；
- `TASK_INDEX_V0.1.md`；
- `ACCEPTANCE_EVIDENCE_V0.1.md`；
- Draft PR 正文；
- README、实施计划、S2 设计、需求追踪与 `user/` 是否仅需事实性派生更新。

未经该次精确批准，不执行最终文档收口 commit/push；PR 最新 head 的 required CI 未通过前不建议或标记 Ready。PR 发布后，除非项目所有者明确释放、请求修改或完成 merge，按 skill 进入监控而不自行合并。

## 14. 完成报告要求

报告必须使用中文并列出：

- 本合同文件、批准状态、启动基线、任务分支/worktree、commit、Draft PR、CI 与 revision；
- 实际新增/修改文件和可观察结果；
- FR-R04～R07/R09、FR-P02、相关 FR-P01/P07/P08、D/ED/S2-Q 与 AC-03 覆盖；FR-R08 明确未完成；
- 每条实际验证命令、Windows/Node/Electron/临时数据环境、结果与 artifact；
- 四 outcome、unknown、唯一冲突、非计划日、历史快照、跨午夜、重开、Today/Progress 和 S1/T021 回归证据；
- 自动化、独立 review、hosted CI 和项目所有者 MANUAL 状态；
- 依赖/schema/migration/`001_initial.sql` 不变证明；
- 残余风险、已知缺口、跳过/未验证内容和 T023/T031 边界；
- 是否发现需求冲突、范围变化、权限变化或 S1/T021 回归。

不得把实现存在、本地测试通过、Draft PR 创建或 AC-03 自动化通过称为项目所有者人工验收通过；只有合同定义的全部自动门禁、批准的文档收口、最终 head CI 和真实人工结果有证据时，才能按账本定义更新完成状态。

## 15. 交付收口记录

- **启动基线**：`dev@e3e7346eba492f1de810ffe34b41b1d96831c3af`；分支 `task/T022-routine-record-facts`；worktree `.tmp/T022-worktree`。
- **实现与测试 revision**：`022b6e25731a07f113692a452de0128367059574`；分步提交为 `6df2d8e`（合同激活）、`da8d40e`（Domain/Application/SQLite/IPC/Preload 与单元/集成）、`1c29a64`（Renderer/Today/Progress/E2E）和 `022b6e2`（hosted Windows 时区无关的跨午夜 E2E 修正）。
- **Draft PR**：#18，base `dev`，保持 Draft；Ready 与 merge 未授权。
- **验证**：本地完整 `npm.cmd run verify` 在 `1c29a64` 返回 exit code 0，97 unit、50 integration、9 Electron E2E 通过，1 项 opt-in package smoke 按既有条件跳过；`022b6e2` 的修正另行通过 typecheck、build 和跨午夜定向 E2E。实现 head `022b6e2` 的 hosted `Verification / Windows required gate` run `31876081932` / job `94991895586` 返回 success。
- **失败历史**：首个 PR head `1c29a64` 的 run `31875926295` / job `94991527923` 仅因新跨午夜 E2E 固定 UTC 时间、未适配 hosted Windows 本地时区而失败；产品代码、unit 与 integration 均已通过。`022b6e2` 改为按运行环境构造当地午夜并由后续绿色 run 取代失败结论，失败记录不删除。
- **复核**：完整任务 diff、事务边界、固定 IPC/Preload API、Renderer 隔离、create-only/唯一冲突、Query 零写入、Progress 一致快照及 S1/T021 回归完成第二遍只读复核；`001_initial.sql` 与 `dev` blob hash 均为 `a92c98598e46d76b038d1298549b5ab524356884`，没有依赖、schemaVersion 或 migration 变化，最终无未解决 finding。
- **人工验收**：项目所有者于 2026-08-15 明确报告“T022 人工验收：通过”。
- **范围结论**：FR-R04～R07/R09、FR-P02 与 AC-03 的 T022 范围已交付；FR-R08/T031、Action intention/T023/AC-04、Review、Recovery、AI、提醒、编辑/删除/补记和 S3～S7 保持未实现。未发现 MUST/批准决定冲突、范围或权限漂移，也未发现 S1/T021 回归。
- **最终门禁**：本独立文档 commit push 后必须再次等待并读取最新 PR head required CI；只有该 CI 通过后才建议 Ready。Agent 不自行 Ready 或 merge。

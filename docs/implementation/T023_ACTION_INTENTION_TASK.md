# T023 通用 Action 非强制 Today intention 任务合同

> 合同状态：**已获项目所有者批准并激活；项目所有者于 2026-08-16 批准本合同及第 11 节的实现、本地提交、任务分支推送、到 `dev` 的 Draft PR 和 hosted CI 权限。**
>
> 拟启动基线：`dev@68239dafb0d742b09abb2583544a37361157c872`（2026-08-16 已通过 `git ls-remote origin refs/heads/dev` 核验为最新 `origin/dev`；该 revision 为包含已验收 T022 的 squash merge）
>
> 当前权限：允许在批准文件范围内实施、创建有意义的本地提交、推送任务分支、创建/更新到 `dev` 的 Draft PR 并读取 hosted CI；Ready、merge、`main`、tag、release 与最终文档收口仍受后续门禁约束。

## 1. 任务信息

- **Task ID**：T023
- **Title**：Generic non-mandatory Today intention for Action
- **Slice / Plan item**：S2 / E2-03
- **Task ledger status**：`active`
- **Base branch / revision**：`dev@68239dafb0d742b09abb2583544a37361157c872`
- **Expected branch**：`task/T023-action-intention`
- **Task worktree**：`.tmp/T023-worktree`
- **前置事实**：S1 最终基线已验收；T021/T022 均已合入当前 `dev`、状态为 `done`，证据分别为 `EV-T021-001` / `EV-T022-001`；AC-03 已由 T021/T022 自动化与项目所有者人工验收证明为 pass；S2 整体设计及 S2-Q06-A 已批准。

## 2. 目标结果

在不改变 S1 Action、Today focus、ActionRecord、Progress 以及 T021/T022 Routine/RoutineRecord 语义的前提下，交付通用 Action 的非强制 Today intention 完整纵向路径：

- 用户可沿用现有通用 Action 创建入口，创建可不关联 Goal、也不依赖兴趣/休息专属模块的 pending Action；
- 用户可明确把符合条件的 Action 作为当前可信 LocalDate 的 `intention` 选入 Today，也可明确从当天 Today 移除 intention；
- Today 以 `focuses[]`、`intentions[]`、`plannedRoutines[]` 分区或同等清晰方式区分三类内容；不得继续只用 `selectedForToday: boolean` 混淆 focus 与 intention；
- 现有 `selectedForToday` 只继续表示 focus；Action 详情/可选列表增加独立 `todayCommitment: focus | intention | null`（或严格等价字段），Today focus/intention 项自身携带明确 commitment；
- 同一 Action/LocalDate 最多一个 commitment，focus 与 intention 互斥；选择另一 commitment 必须先得到稳定 `selection-conflict` 且零变化，再由用户触发明确的转换命令；
- Repository 对 TodaySelection 创建使用 insert-only 语义，对 commitment 变更使用独立显式 update 语义；不得使用 `ON CONFLICT ... DO UPDATE` 或等价 upsert 把 focus 静默改成 intention，或反向转换；
- intention 只表达“今天可能想做”，不改变 Action 状态，也不构成承诺、计划达成条件、失败事实或 Record；
- intention 未发生时不创建 ActionRecord/RoutineRecord、不改变 Action、不增加 Progress 计数、不产生失败/逾期/惩罚评价；下一 LocalDate 不自动滚动；
- intention 实际发生时仍使用既有显式 ActionRecord 流程保存事实，并继续由用户显式决定 post-record Action/下一步变化；不新增 intention Record 类型；
- 完全关闭 SQLite/Electron 并从同一隔离临时数据根重开后，当日 commitment 保持；FakeClock 前进到下一 LocalDate 后旧 selection 只保留在原日期，不复制、不删除、不改写。

T023 完成 FR-A07、FR-T03、FR-T08 与 AC-04 的任务范围；不实现、重开或声明 AC-03，AC-03 仍由已完成 T021/T022 的既有证据支持。

## 3. 需求与设计依据

- **FR**：FR-A07、FR-T03、FR-T08。
- **AC**：AC-04；明确不声明 AC-03。
- **D**：D-011；横切遵守 D-003、D-004、D-016、D-106。
- **S1 回归依据**：FR-A01～FR-A03、FR-T01、FR-T04、FR-T05；S1 focus、Action 生命周期、ActionRecord 与 Progress 已验收语义保持不变。
- **ED**：ED-006；横切遵守 ED-003、ED-004、ED-015、ED-017、ED-018、ED-019。
- **GW**：GW-001～GW-004、GW-008～GW-010。
- **已批准 S2 决定**：S2-Q06-A；同时遵守 S2 §4.5、§5.1、§6、§7、§8.3、§9.3、§11～14。
- **直接相关架构章节**：
  - `PRODUCT_REQUIREMENTS_V0.1.md` §4 PR-01/03/06/07、§5.2/5.5、§6.4/6.6、§7.1、§9.2/9.4、§12 AC-04；
  - `DECISIONS.md` D-003/004/011/016/106；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-003/004/006/015/017/018/019；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §2～7、§8.2、§9～12；
  - `S2_ROUTINE_INTENTION_DESIGN_V0.1.md` §0～8.3、§9～14，重点 §4.5、§5.1、§6、§7、§8.3、§9.3、§11～13；
  - `TEST_STRATEGY_V0.1.md` §1～6、§7 E2E-AC-04、§8～10；
  - `IMPLEMENTATION_PLAN_V0.1.md` §1～2、E2-03、§11～12；
  - `T021_ROUTINE_LIFECYCLE_TASK.md`、`T022_ROUTINE_RECORD_FACTS_TASK.md`、`TASK_INDEX_V0.1.md`、`TASK_TEMPLATE.md`、`GITHUB_WORKFLOW_V0.1.md`；
  - `EV-G3-S1-002`、`EV-T021-001`、`EV-T022-001` 与 AC-03 当前 pass 记录。

`user/` 不属于本合同依据，不得成为实现、测试或验收依赖。

## 4. 开始条件与审批门

已核验：

- [x] 2026-08-16 远端最新 `origin/dev` 与本地 `dev` 均为 `68239dafb0d742b09abb2583544a37361157c872`，主工作树在创建 T023 worktree 前干净。
- [x] 该 revision 包含 T021 merge `e3e7346eba492f1de810ffe34b41b1d96831c3af` 与 T022 merge `68239dafb0d742b09abb2583544a37361157c872`；任务索引记录 T021/T022 `done`，证据与 AC-03 状态为 pass。
- [x] S2 整体设计已批准并合入，S2-Q06-A 明确批准“同日互斥、冲突先报告、用户显式转换”。
- [x] S1 Action/TodaySelection/ActionRecord/Progress 与 T021/T022 Today/Routine 接口已在当前 `dev` 实际存在。
- [x] v1 schema 已包含 `today_selections.kind IN ('focus','intention')`、`selected_by='user'` 与 `(action_id, selected_for)` 主键；`001_initial.sql` blob hash 为 `a92c98598e46d76b038d1298549b5ab524356884`。本任务不需要 migration，也不得修改该文件。
- [x] 当前固定工具链为 Node `24.18.0`、npm `11.16.0`、Electron `43.3.0`、`better-sqlite3@13.0.1`；无需新增或升级依赖。
- [x] 已按本次明确指令从该 revision 创建 `.tmp/T023-worktree` / `task/T023-action-intention`；分支 HEAD 与 `dev` 一致，除本合同草案外没有改动。
- [x] 起草时未发现 MUST、已批准 D/ED、S2-Q06-A、S1/T021/T022 契约或 v1 schema 冲突。

开始实现前仍必须满足：

- [x] 项目所有者于 2026-08-16 明确批准本合同的目标、需求依据、文件范围、非范围、不变量、交付物、完成条件、验证命令、依赖、数据与 Git/GitHub 权限。
- [x] 项目所有者明确激活 T023；已同步本合同状态和 `TASK_INDEX_V0.1.md` 的 `active` 状态。
- [x] 实施前已再次核验 `origin/dev`、分支 HEAD、`git status`、worktree 列表、无重叠 active 业务任务和无用户自有改动；基线未漂移。

上述门禁已全部满足，可以按本合同和 `mytracer-stage-development` skill 开始实施。

## 5. 允许的实现行为

### 5.1 Domain / Application

- 建立最小 TodaySelection commitment 领域语义：`focus | intention`、同 Action/LocalDate 互斥、同 kind 重复选择幂等、不同 kind 必须报告冲突、转换必须显式且目标不同。
- 复用 `assertActionCanBeSelectedForToday` 边界：无 Goal 或 active Goal 下的 pending/rescheduled Action 可被明确选为 intention；rescheduled Action 在同一事务恢复 pending；completed/cancelled 或关联 paused/ended Goal 的 Action 不可新选入。
- 实现 `SelectActionAsIntentionForToday`、`RemoveActionIntentionFromToday`、`ChangeActionTodayCommitment`；保留 S1 `SelectActionForToday` / `RemoveActionFromToday` 的 focus 含义。
- 每个命令开始只读取一次 `ClockPort.snapshot()`；Renderer 不提交可信日期、`selectedBy`、审计时间或任意 selection kind。
- select 遇到另一 commitment 时返回稳定 `selection-conflict` 并零写入；显式 change 只改变当日既有 selection 的 commitment，保留 actionId、selectedFor、selectedBy 与原 createdAt，不改变 Action 或 Record。
- `GetToday` 只读投影 `focuses[]`、`intentions[]`、`plannedRoutines[]`、`availableActions[]`；focus/intention 项携带明确 commitment，available Action 携带 `todayCommitment`，既有 `selectedForToday` 继续只表示 focus。
- intention 未发生时不产生任何 Record、状态、Progress 或评价变化；实际发生仍完全复用 S1 ActionRecord 命令与显式 post-record 语义。

### 5.2 Repository / SQLite / 事务

- 复用 `schemaVersion=1` 和既有 `today_selections`；将 TodaySelection 写入端口收敛为意图级的 insert-only 创建、按期望 commitment 删除及显式 commitment 更新。
- 移除 TodaySelection 写路径中的 `ON CONFLICT ... DO UPDATE` 或等价隐式 upsert；已有同 Action/LocalDate 行不得由 create 方法覆盖。
- focus/intention 首次创建若已有相同 commitment 可由 Application 作为幂等成功处理；若已有不同 commitment 返回 `selection-conflict`，数据库行逐字段不变。
- 显式转换在一个 `UnitOfWorkPort.transaction` 内复核 Action、Goal、当日 selection 与目标 commitment，再执行只更新 kind 的明确 Repository 操作；失败、行缺失、kind 不匹配或持久化异常均零变化。
- rescheduled Action 恢复 pending + intention 创建保持一个事务；intention 移除只删除当日且 kind 为 intention 的行，不删除 focus，不改变 Action。
- Query 只读；打开 Today、读取 Action 详情或 Progress 不创建、移动、转换或清理 selection，不创建 ActionRecord/RoutineRecord，不改变 Action。

### 5.3 IPC / Preload / Renderer

- 为 intention select/remove 和 commitment change 使用固定窄 channel；保留既有 focus channels，不暴露通用 invoke、任意 channel、SQL、数据库路径、Clock、Node 或 Electron 对象。
- Main 先校验 sender/origin，再严格校验单个 DTO 的精确形状、UUID 与 `focus | intention` 枚举；拒绝多余字段、伪造 `selectedFor`、`selectedBy`、createdAt、未知 kind 或缺失输入。
- 错误映射使用稳定中性 code/message；`selection-conflict` 不泄露 SQL、堆栈、绝对路径或用户正文。
- Preload 在冻结的 `window.myTracer.today` 命名空间增加具体方法；顶层 API 不增加新用户概念。
- Renderer 在 Today 明确展示“今日重点”“今日意向”“今日例行”三类内容；intention 文案表达可选、非承诺、未发生无惩罚，不出现兴趣专属模块、失败率、完成率、逾期、断签或压力文案。
- Action 详情对未选、focus、intention 三种 commitment 分别提供明确选择、移除和转换入口；不同 commitment 的转换必须由用户明确触发，不由 select 误触或页面刷新自动发生。
- 创建 Action 的现有通用入口继续允许 goalId 为空，AC-04 fixture 可使用兴趣/休息文本，但产品结构与文案不得把内容领域写死。

## 6. 精确文件范围

合同获批后仅允许新增或修改下列文件；未实际需要的候选文件保持不动。发现必须扩大范围时先停止并申请批准。

**Task contract / evidence ledger**

- `docs/implementation/T023_ACTION_INTENTION_TASK.md`
- `docs/implementation/TASK_INDEX_V0.1.md`（仅在合同批准后记录 `active/review/done` 的真实状态）
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`（仅从真实结果记录 `EV-T023-001` 与 AC-04 自动/人工状态）

**Domain / Application / Contracts**

- `src/domain/today-selection.ts`（新增；若最小语义无损收敛进现有 Action domain，则不创建）
- `src/domain/action.ts`（仅可选入边界或 commitment 类型复用确有需要时）
- `src/domain/index.ts`
- `src/application/actions.ts`（仅增加独立 `todayCommitment` 投影并保持 `selectedForToday` 的 focus 含义）
- `src/application/today.ts`
- `src/application/ports/persistence.ts`
- `src/contracts/actions.ts`
- `src/contracts/today.ts`

**SQLite / Main / Preload / Renderer**

- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/today-ipc.ts`
- `src/main/index.ts`（仅组合根或固定注册确有需要时）
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

**Tests**

- `tests/unit/today-selection-domain.test.ts`（新增；若领域测试无损收敛进 `action-domain.test.ts`，则不创建）
- `tests/unit/action-domain.test.ts`（仅可选入边界回归）
- `tests/unit/action-application.test.ts`（仅 `todayCommitment` 与 S1 Action 回归）
- `tests/unit/today-application.test.ts`
- `tests/unit/action-record-application.test.ts`（仅端口收敛或 post-record 回归确有需要时）
- `tests/unit/goal-application.test.ts`（仅端口收敛回归确有需要时）
- `tests/unit/routine-application.test.ts`（仅端口收敛/T021 回归确有需要时）
- `tests/integration/action-today-sqlite.test.ts`
- `tests/integration/action-today-ipc.test.ts`
- `tests/integration/sqlite-persistence.test.ts`（仅 Repository insert-only/显式 update 契约需要时）
- `tests/integration/main-foundations.test.ts`（仅窄 API/固定 channel 白名单断言需要时）
- `tests/e2e/action-intention.e2e.test.ts`（新增，完整 E2E-AC-04）
- `tests/e2e/action-today.e2e.test.ts`（仅 S1 focus 兼容回归确有需要时）
- `tests/e2e/action-record.e2e.test.ts`（仅 intention 发生后复用既有记录路径的强化断言需要时）
- `tests/e2e/progress-core-loop.e2e.test.ts`（仅零记录/零计数兼容断言需要时）
- `tests/e2e/routine-lifecycle.e2e.test.ts`（仅 Today 三分区接缝回归需要时）
- `tests/e2e/routine-record.e2e.test.ts`（仅 T022 Today 接缝回归需要时）
- `tests/e2e/shell.e2e.test.ts`（更新 Today 窄 API 精确白名单）
- `tests/e2e/windows-package-smoke.e2e.test.ts`（仅同步冻结 API 白名单；T023 不要求运行 package smoke）

`src/infrastructure/sqlite/migrations/001_initial.sql` 仅可只读核验，不在允许修改范围。`package.json`、lockfile、构建配置、CI、PRD、DECISIONS、架构基线、T021/T022 已完成证据正文和 `user/` 均不在实现修改范围。

## 7. 明确非范围

- Routine 生命周期与星期节奏（T021）；只做必要回归。
- RoutineRecord、四种显式 outcome、缺行 unknown、`plannedForDate` 与 Progress Routine 扩展（T022）；只做必要回归，T023 不声明 AC-03。
- 兴趣、休息、学习、健康等专属实体、表、模块、模板、完成率、统计或首页分区。
- 自动推荐、候选排序、AI、Review、Recovery、导出/导入或 S3～S7。
- intention 自动滚动到次日、自动完成、自动记录、自动改变 Action、自动转为 focus、失败评价、惩罚、逾期、提醒、通知、连续打卡、评分或复杂日历。
- 新 Action 状态、Action 类型、intention Record 类型、承诺达成条件、计划完成率或 Progress intention 指标。
- 改变 S1 focus、`selectedForToday`、ActionRecord outcome、显式 post-record、Action 生命周期或 Progress 筛选/排序/计次语义。
- FR-L07/FR-R08 的补记、修改、覆盖、删除；Goal/Action/Routine/Record 硬删除和影响预览。
- 新增/升级依赖、任何 migration、修改 `001_initial.sql`、schemaVersion、真实用户数据操作或 package/NSIS 验证。
- Draft → Ready、merge 到 `dev`、创建/合并 `dev → main`、tag、release、force-push、远端分支删除、branch protection、Actions secrets 或仓库设置变更。

## 8. 必须保持的不变量

1. intention 是通用 Action 在明确 Action/LocalDate 上的 TodaySelection commitment，不是 Action 类型、状态、Record、Routine 或兴趣模块。
2. Action 可以不关联 Goal；不得为 intention 创建隐藏默认 Goal或要求兴趣专属结构。
3. `selectedForToday` 继续且只表示 focus；`todayCommitment`/Today item commitment 独立表达 `focus | intention | null`，不得用一个 boolean 合并语义。
4. 同一 Action/LocalDate 的 focus 与 intention 互斥；只有用户命令创建、移除或转换；`selectedBy` 固定为 `user`。
5. 选择另一 commitment 必须返回 `selection-conflict` 且零写入；显式 conversion 才能改变 kind，Repository 不得通过 upsert 静默转换。
6. intention 未发生时不生成 ActionRecord、RoutineRecord、`not_done`、失败或其他持久事实，不改变 Action，不增加任何 Progress 数值。
7. intention 不自动滚动到下一 LocalDate；旧 selection 不被自动删除、复制、清理、转换或改写为失败。
8. intention 发生时仍经既有 ActionRecord 明确记录；记录 outcome 与 Action 状态继续解耦，post-record 变化由用户明确选择。
9. pending/rescheduled 的可选入边界、rescheduled 同事务恢复、completed/cancelled 拒绝和 Goal active/null 约束与 S1 focus 相同。
10. Main 每个日期相关 Command/Query 只获取一次可信 `ClockPort.snapshot()`；Renderer 不提供可信 Today 日期且不访问 SQL、Clock 或持久化。
11. Query 零写入；打开 Today/Action/Progress 不自动生成、移动、清理或转换 selection，也不生成 Record。
12. Today 的 focuses、intentions、plannedRoutines 清楚区分；T021/T022 的 Routine、`plannedForDate` 与五态语义不变。
13. S1 focus、Action 生命周期、ActionRecord、Progress 字段/筛选/排序/逐 Record 计次语义不变；T023 不宣称 AC-03。
14. 所有写入经 Application Command/Domain 不变量并在单个 UnitOfWork 事务内完成；任一校验、冲突或存储故障零变化。
15. Renderer 无 Node、SQLite、文件、凭据、Provider、Clock、任意 IPC 或 Electron 对象；Preload 只暴露具体冻结方法，Main 校验 sender/origin 与运行时 DTO。
16. 自动化使用 FakeClock、每 case/进程唯一临时 SQLite 与 Electron `userData`；不得访问、迁移、删除或清理真实用户数据。

## 9. 交付物与验收标准

1. 通用、可无 Goal 的 pending Action 可从 Renderer 经 Preload/Main/Application/Domain/SQLite 明确选为当日 intention，不依赖兴趣专属模块。
2. Today DTO/UI 分别展示 focuses、intentions、plannedRoutines；每个 Action 的 commitment 无歧义，S1 `selectedForToday` 仍只表示 focus。
3. intention 首次 select、同 kind 幂等 select、当天明确 remove 均正确；remove intention 不删除 focus，focus remove 不删除 intention。
4. focus 存在时 select intention、intention 存在时 select focus 均返回 `selection-conflict` 且 Action/selection/Record/Progress snapshot 零变化。
5. 用户显式转换 focus → intention 与 intention → focus 均在一个事务中完成；仅 kind 改变，原 Action、日期、selectedBy、createdAt、Record 与历史选择不变；故障注入完整回滚。
6. Repository TodaySelection create 为 insert-only、conversion 为显式 update；测试证明不存在 upsert 静默覆盖路径，`001_initial.sql` 与 schemaVersion 不变。
7. rescheduled Action 只有经用户明确选为 intention 才在同一事务恢复 pending 并创建 intention；写入失败时 Action 和 selection 一并回滚；terminal/非 active Goal 入口拒绝。
8. FakeClock 前进到下一 LocalDate 后新日没有旧 intention；旧日 row 保留且无失败事实；Query 前后数据库 snapshot 相同。
9. intention 未发生场景中 Action 仍 pending，ActionRecord/RoutineRecord 数、Progress 总分钟/真实行动次数及其他事实均不变；UI 无失败、逾期、断签、完成率或惩罚文案。
10. 在另一明确日期重新选入 intention 后，可通过既有 ActionRecord 流程保存实际事实；不新增 intention Record，S1 显式 post-record 语义不变。
11. 完全关闭 SQLite/Electron 并从同一隔离根重开，当日 commitment、旧日历史、Today 分区、Action 状态和零/已有 Record 事实一致。
12. IPC 只注册固定 channel；非法 UUID/commitment、缺字段、多余字段、伪造 date/selectedBy/createdAt、不可信 sender/origin 全部拒绝且零写入；错误不泄露私有信息。
13. 完整 E2E-AC-04 在同一最终 revision、FakeClock 与隔离 `userData` 连续覆盖创建、intention、未发生、跨日、重开、零记录/零 Progress、无专属模块与可选正常记录强化路径。
14. S1 Action/Today focus/ActionRecord/Progress、T021 Routine Today、T022 RoutineRecord/Progress/AC-03、Preload 安全与窄 API 回归通过；无新依赖、无 migration、`001_initial.sql`/schemaVersion 不变。
15. 最终 diff 仅含批准范围；完成完整 diff、schema、事务边界、upsert 扫描、S1/T021/T022 回归、独立只读 review、定向验证、完整 `verify` 和最新 Draft PR head hosted Windows required gate。
16. 证据只声明 FR-A07、FR-T03、FR-T08、D-011、S2-Q06-A 与 AC-04 自动化状态；AC-04 人工验收在项目所有者实际执行前保持 `pending`，不声明 AC-03。
17. **MANUAL**：项目所有者确认通用 Action 可轻松作为 intention 加入/移出 Today，focus/intention/Routine 清楚且不过度复杂，转换表达为明确用户决定，未发生时无压力/失败暗示/自动记录/自动滚动，且完全不需要兴趣专属模块；实际执行前保持 `pending`。

## 10. 验证计划

### 10.1 针对性验证

```powershell
npm.cmd exec -- vitest run --project unit tests/unit/today-selection-domain.test.ts tests/unit/action-domain.test.ts tests/unit/action-application.test.ts tests/unit/today-application.test.ts tests/unit/action-record-application.test.ts
npm.cmd exec -- vitest run --project integration tests/integration/action-today-sqlite.test.ts tests/integration/action-today-ipc.test.ts tests/integration/sqlite-persistence.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd exec -- playwright test tests/e2e/action-intention.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/action-record.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-lifecycle.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

若领域测试最终无损收敛进现有文件而未创建候选新文件，应从实际命令删除不存在的路径并在证据中说明；完整 `verify` 仍须覆盖全部现有测试。

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

`verify` 已包含 build 和 Electron E2E；它不证明 package/NSIS、hosted CI、人工验收、Ready 或 merge。T023 不要求 `npm ci`、安装、package、package smoke 或 live AI。

### 10.3 AC-04 自动化连续程序

在同一明确 revision、FakeClock 和隔离 `userData` 上：

1. 通过通用入口创建一个不关联 Goal、内容与兴趣或休息有关的普通 pending Action；验证没有专属实体、模块或隐藏 Goal。
2. 用户明确把它作为当日 intention 选入 Today；验证它只出现在 `intentions[]`，不出现在 focuses 或 Routine 类型中，详情的 `todayCommitment=intention` 且 `selectedForToday=false`。
3. 覆盖同 kind 幂等、focus/intention 双向冲突零变化、显式双向转换及事务故障回滚；验证数据库同 Action/日始终只有一行。
4. 将目标状态保持为 intention，不保存 ActionRecord；记录 Action、selection、Record 和 Progress snapshot。
5. 完全关闭 Electron/SQLite，FakeClock 前进到下一 LocalDate并从同一隔离根重开。
6. 验证新日没有自动 intention，旧 selection 仍只属于原 LocalDate；Action 仍 pending；ActionRecord/RoutineRecord、Progress 时间/次数和失败事实均无变化；重复 Query 零写入。
7. 验证 UI 没有失败、逾期、断签、自动完成、意向完成率或兴趣专属模块。
8. 强化路径：在另一明确 LocalDate 再次由用户选入 intention，并通过既有 ActionRecord 流程显式记录真实行动，证明 intention 不是专属 Record 类型且 post-record 仍由用户决定。

### 10.4 人工步骤

1. 创建一个不关联 Goal 的普通兴趣/休息 Action，确认不需要选择专属类型或模块。
2. 将其选为 Today intention，再移出；确认操作轻量、文案明确为可选而非承诺。
3. 准备 focus/intention 各一项并双向转换，确认先区分当前 commitment，转换必须由用户明确触发且不会误改另一项。
4. 关闭并重开，再跨到下一本地日期；确认旧 intention 不滚动、不消失、不变失败，Action 与 Progress 不变。
5. 查看 Today，确认 focus、intention、Routine 三类清楚但不过度复杂；无失败、逾期、断签、完成率、评分或兴趣专属模块。
6. 可选记录一次实际发生的 intention，确认仍进入普通 ActionRecord 流程；结果记录为 pass/fail/partial。

### 10.5 验证环境与证据

- **OS**：Windows（当前环境与 hosted `windows-2025` required gate）
- **Node / npm**：`24.18.0` / `11.16.0`
- **Electron / SQLite driver**：Electron `43.3.0` / `better-sqlite3@13.0.1`
- **Clock**：自动化使用 FakeClock；不依赖真实当天
- **Data root**：每 case/进程唯一临时目录；E2E 使用唯一临时 Electron `userData`
- **AI**：未配置或 fake；不得使用 live Provider
- **Source revision**：每次证据记录确切 commit/PR head 或明确 uncommitted timestamp
- **Evidence**：`EV-T023-001` 绑定命令、环境、结果、artifact/CI URL、限制和 manual 状态；AC-04 索引只从真实结果更新

## 11. Git、GitHub、依赖与外部操作权限

项目所有者本次指令已经授权并已完成：

- [x] 从核验后的最新 `dev` 创建本地 `.tmp/T023-worktree` 和 `task/T023-action-intention` 分支；创建时未修改代码、测试、schema 或数据。

项目所有者于 2026-08-16 批准以下后续权限：

- [x] 在合同获批后同步合同状态与 `TASK_INDEX_V0.1.md`，并在批准文件范围内实施。
- [x] 创建按 Domain/Application、Persistence/IPC、Renderer/E2E 等有意义检查点拆分的本地提交。
- [x] 推送 `task/T023-action-intention`。
- [x] 创建并更新到 `dev` 的 Draft PR，维护 Task/Goal/Requirements/Scope/Exclusions/Changes/Verification/Evidence/Risks/Dependency changes。
- [x] 在每个实现候选和最终文档 head 等待并读取 required hosted CI；仅按批准范围修复失败后重新推送。
- [x] 在首个实现候选 green CI 后，按 `mytracer-stage-development` skill 提交精确文档影响矩阵，并再次请求文档收口、独立 `docs: close T023 delivery records` commit 与 push 授权。
- [ ] Draft → Ready 仍须项目所有者另行授权。
- [x] Agent 不得 merge 到 `dev`，不得创建或合并 `dev → main` PR，不得创建 tag/release，不得 force-push 或删除远端分支。

依赖与外部操作：

- **新增/升级依赖**：无；`package.json` 和 lockfile 不得修改。
- **安装**：不授权 `npm install`/`npm ci`；使用现有依赖。若 worktree 缺少可用依赖或原生模块，停止并申请授权，不复制秘密或真实数据。
- **Network**：合同获批时请求仅针对 `origin/dev` 核验、任务分支 push、Draft PR/CI/review 的必要网络访问；不访问 live AI 或其他外部服务。
- **AI Provider**：无 / fake；不得使用真实密钥。
- **External writes**：若获批，仅限上述 task branch、Draft PR 与 CI；Ready/merge/仓库配置变更不授权。
- **Data operations**：仅隔离临时测试数据；无真实用户数据写入、迁移、删除或破坏性操作。

## 12. 风险与停止条件

主要风险：

- 现有 `saveTodaySelection` 使用 `ON CONFLICT ... DO UPDATE`；若直接复用，会违反 S2-Q06-A 和本合同的显式转换边界。T023 必须收敛为 insert-only create + 明确 update，并回归所有 S1 focus 调用者。
- 现有 `ActionDetail.selectedForToday` 只表达 focus；若把它泛化成任意 selection，会倒改 S1，若不增加独立 commitment 又会把 intention 误呈现为未选择。
- Today DTO/Preload 的方法和字段扩展会影响精确 API 白名单、Renderer 和 package smoke 契约；只能兼容增加，不能暴露通用 kind/date 输入。
- rescheduled Action 恢复和 intention 创建若不在同一事务，可能产生 pending 但未选择或已选择但状态未恢复的半结果。
- remove/convert 若不按当前 kind 复核，可能误删或误改另一 commitment；冲突和故障必须逐字段证明零变化。
- 跨日 Query 若清理或复制 selection，会制造失败/压力或改写历史；只能按新的可信 LocalDate 读取。
- intention 未发生的零记录/零 Progress 需要比较真实数据库 snapshot，不能只依赖 UI 文案或测试名称。
- S1/T021/T022 已经共享 Today 页面；Renderer 改动必须证明 focus、Routine 五态、记录入口与 Progress 均无回归。

发现以下任一情况，立即停止受影响工作并报告：

- MUST、已批准 D/ED、S2-Q06-A、S1/T021/T022 契约或实际 v1 schema 冲突；
- 需要新增/升级依赖、任何 migration、修改 `001_initial.sql`/schemaVersion 或执行真实数据操作；
- 需要新 Action 状态/类型、专属兴趣模块、intention Record、自动滚动/完成/记录、提醒、评分、复杂日历、AI、Review、Recovery、删除/补记或其他非范围能力；
- 无法保证显式冲突/转换、Repository 无静默 upsert、事务回滚、Query 零写入、跨日不滚动、未发生零 Record/Progress、Renderer 日期不可信或测试数据隔离；
- `origin/dev` 漂移导致基线、接口、schema、依赖或批准文件范围发生实质变化；
- 需要扩大文件范围、Git/GitHub/外部写入权限，或无法产生可靠验收证据。

## 13. 文档收口门禁

实现、定向验证、完整 `verify`、最终 diff/schema/事务/upsert 自查、独立只读 review 和首个 Draft PR head required CI 全部通过后，必须停止并向项目所有者提交精确文档影响矩阵。至少评估：

- 本合同；
- `TASK_INDEX_V0.1.md`；
- `ACCEPTANCE_EVIDENCE_V0.1.md`；
- Draft PR 正文；
- README、实施计划、S2 设计、需求追踪与 `user/` 是否仅需事实性派生更新。

未经该次精确批准，不执行最终文档收口 commit/push；PR 最新 head 的 required CI 未通过前不建议或标记 Ready。PR 发布后，除非项目所有者明确释放、请求修改或完成 merge，按 skill 进入监控而不自行合并。

## 14. 完成报告要求

报告必须使用中文并列出：

- 本合同文件与批准状态、启动基线、任务分支/worktree、commit、Draft PR、CI 与 revision；
- 实际新增/修改文件和可观察结果；
- FR-A07、FR-T03、FR-T08、D-011、相关 D/ED/S2-Q06-A 与 AC-04 覆盖；明确不声明 AC-03；
- 每条实际验证命令、Windows/Node/Electron/临时数据环境、结果与 artifact；
- intention 选择/移除、重开、跨日不滚动、未发生零记录/零 Progress、双向冲突/显式转换、Repository 无静默 upsert、正常 ActionRecord 复用及 S1/T021/T022 回归证据；
- 自动化、独立 review、hosted CI 和项目所有者 MANUAL 状态；
- 依赖/schema/migration/`001_initial.sql` 不变证明；
- 残余风险、已知缺口、跳过/未验证内容和后续任务边界；
- 是否发现需求冲突、范围变化、权限变化或 S1/T021/T022 回归。

不得把合同批准、实现存在、本地测试通过、Draft PR 创建或 AC-04 自动化通过称为项目所有者人工验收通过；只有合同定义的自动门禁、批准的文档收口、最终 head CI 和真实人工结果有证据时，才能按账本定义更新完成状态。

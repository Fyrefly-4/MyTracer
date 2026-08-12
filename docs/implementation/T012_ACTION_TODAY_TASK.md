# T012 Action、Today Focus 与重新安排任务合同

> 合同状态：**已完成并通过任务验收；实现证据绑定 `56b3446a1b952a9bdb6fe29ab4a89502171ba321`，PR #9 已合入 `dev`**
>
> 实现基线：`dev@7cb5bebd8c2d0e66056d2b34189d084e78261b41`；任务分支：`task/T012-action-today`
>
> 历史权限记录：任务执行时仅获批分支、提交、push、Draft PR 与文档收口；后续 PR #9 合并事实不扩大本合同的原始授权

## 1. 任务信息

- **Task ID**：T012
- **Title**：Action lifecycle, Today focus, and rescheduling
- **Slice / Plan item**：S1 / E1-02
- **Task ledger status**：`done`
- **Base branch**：`dev@7cb5bebd8c2d0e66056d2b34189d084e78261b41`
- **Task branch**：`task/T012-action-today`
- **前置事实**：G2 已通过；S1 设计已批准；T011 已完成；S1-Q03 = B、S1-Q05 = A、S1-Q06 = A、S1-Q07 = A。

## 2. 目标结果

经合同批准并另行获得实现启动授权后，交付 Action 与当前日 Today focus 的最小完整纵向路径：

- 用户可创建、修改、完成、取消、重新安排 Action；Action 可不关联 Goal，关联时创建目标必须是 active Goal；
- 用户可显式将 pending Action 选入或移出 Main 捕获的当前 LocalDate 的 Today focus，并通过 `GetActionDetail`、`GetToday` 查看结果；Today 不设硬上限，不自动选择或搬运历史 Action；
- 当前下一步 Action 进入 completed、cancelled 或 rescheduled 时，用户必须在同一事务中明确清空、改用同 Goal pending Action，或创建并引用同 Goal pending Action；
- reschedule 复用原 Action ID、保留历史并移出当天 Today；只有用户以后再次明确选入 Today，才在同一事务恢复 pending 并创建当天选择；
- complete/cancel 保留当天 TodaySelection，Today 显示终态且禁止再次开始；只有用户显式移出或 reschedule 删除当天选择；
- paused/ended Goal 下既有 TodaySelection 继续显示 Goal 状态和不可操作原因，但不得新增 focus 或提供可开始状态；
- 关闭 Electron 与 SQLite 后从同一隔离数据根重开，以及 FakeClock 跨到下一 LocalDate 后，Action/Today 状态、关系和日期语义仍正确。

T012 只贡献 AC-01 步骤 3。T012 只验证 FR-A05 中“Action 状态与 `partial` 解耦”的 Action 侧不变量；用户保存 `partial` ActionRecord 属于 T013。不得声明 T012 单独完成 FR-A05 或完整通过 AC-01。

## 3. 需求与设计依据

- **FR**：FR-A01～FR-A06；FR-T01、FR-T04、FR-T05、FR-T08。
- **AC**：AC-01 步骤 3，仅贡献覆盖。
- **D**：D-004、D-005、D-016、D-106。
- **ED**：ED-005、ED-006、ED-007；横切遵守 ED-003、ED-004、ED-015、ED-018、ED-019。
- **已批准设计**：S1-Q03-B（FR-A05 双重落点）、S1-Q05-A（pause/end 保留当前上下文与 TodaySelection）、S1-Q06-A（不提供 Goal 重分配且无 migration）、S1-Q07-A（complete/cancel 保留当天选择）。
- **直接相关章节**：
  - `PRODUCT_REQUIREMENTS_V0.1.md` §5.2、§6.2、§6.6、§7.1、§8 F-01/F-02、§9.2、§9.4、§12 AC-01；
  - `DECISIONS.md` D-004/005/016/106；
  - `ARCHITECTURE_V0.1.md` §4～§6、§9；
  - `DOMAIN_MODEL_V0.1.md` §3.3、§4、§7.3、§8；
  - `DATA_DESIGN_V0.1.md` §2.1、§3～§4、§6、§8、§11；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-005/006/007；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §3～§7、§8.2、§9～§12；
  - `TEST_STRATEGY_V0.1.md` §2～§8；`REQUIREMENTS_TRACEABILITY_V0.1.md` §2.2、§2.4、§4～§5；
  - `IMPLEMENTATION_PLAN_V0.1.md` E1-02；`TASK_INDEX_V0.1.md` T012；`GITHUB_WORKFLOW_V0.1.md`。

`user/` 不属于本合同依据，也不得成为实现、测试或验收依赖。

## 4. 开始条件与权限门

已满足的输入：

- [x] G2 已通过，S1 整体设计已批准。
- [x] T011 已完成并有 `EV-T011-001`；本合同不重新检查 T011 实现或验收。
- [x] S1-Q03-B、S1-Q05-A、S1-Q06-A、S1-Q07-A 已冻结为 T012 输入。
- [x] 现有 `schemaVersion = 1` 已包含 `actions` 与 `today_selections` 所需字段、状态和约束；合同核对未发现 MUST、已批准 D/ED 或 schema 冲突。

实现开始前仍必须满足：

- [x] 项目所有者批准本合同。
- [x] 项目所有者另行明确发出 T012 实现启动指令。
- [x] 启动时已只读复核 `dev@7cb5bebd8c2d0e66056d2b34189d084e78261b41`、工作树、任务账本和适用权限。
- [x] 项目所有者已批准本合同第 6 节的本地实现文件范围。
- [x] Git 分支、commit、push、Draft PR 和文档收口权限已由项目所有者逐项明确；未授权项保持禁止。
- [x] 未安装依赖；未新增 migration；未修改 `001_initial.sql`。

## 5. 允许的实现行为

### 5.1 Domain / Application

- 实现 Action 状态 `pending | completed | cancelled | rescheduled`：新 Action 为 pending；只允许 `pending → completed/cancelled/rescheduled`，以及用户再次明确选入 Today 时 `rescheduled → pending`。
- `partial` 不是 Action 状态；T012 不接收或保存 ActionRecord outcome，也不得因 fixture 中存在 `partial` Record 自动改变 Action。
- 实现 `CreateAction`、`UpdateActionDetails`、`CompleteAction`、`CancelAction`、`RescheduleAction`、`SelectActionForToday`、`RemoveActionFromToday`。
- `CreateAction.goalId` 可空；非空时必须指向 active Goal。T012 不提供已有 Action 的 Goal 重分配；更新详情只改变 title、description 和审计时间，不改变 ID、goalId、状态或历史。
- 若被 complete/cancel/reschedule 的 Action 是 Goal 当前下一步，命令必须携带 `currentNextResolution`：
  - `clear`；
  - `use-existing(actionId)`：同 Goal pending Action；
  - `create-and-use(title, description?)`：创建并引用同 Goal pending Action。
- 若目标 Action 不是当前下一步，`currentNextResolution` 必须省略；若正是当前下一步则必须明确提供。Main 不得默认挑选替代项。
- active Goal 允许三种 resolution；paused/ended Goal 下若显式转换其当前下一 Action，只允许 `clear`，不得创建或改挂下一步。
- 实现只读 `GetActionDetail` 与 `GetToday`。Query 不得保存、迁移、补全、恢复状态、自动创建 TodaySelection 或隐藏已保留的当天选择。

### 5.2 Today / LocalDate / 事务

- `SelectActionForToday`、`RemoveActionFromToday`、`RescheduleAction` 与两个 Query 均在操作开始时只读取一次 `ClockPort.currentLocalDate()`；Renderer 不提交任意 Today 日期。
- TodaySelection 仅由用户命令创建/删除，T012 只写 `kind = focus`、`selectedBy = user`；同一 Action/LocalDate 最多一条。
- pending Action 可选入 Today；rescheduled Action 只有在同一选择事务中恢复 pending 后才可选入。completed/cancelled 不可选入。
- 新增 focus 只允许无 Goal Action，或 active Goal 下的 Action。paused/ended Goal 下已有选择保留显示，但不得新增 focus，也不得标记为可开始。
- Today 没有硬数量上限；不得把 FR-T06 的软数量提示提前当作 T012 完成项，也不得因未实现提示而阻止用户继续选择。
- `RemoveActionFromToday` 只删除 Main 当前 LocalDate 的 focus，不改变 Action 状态、Goal 当前下一步或历史日期选择。
- reschedule 与删除当前 LocalDate TodaySelection 原子完成；complete/cancel 不删除当天选择。
- 当前下一步状态转换与 `clear/use-existing/create-and-use` 原子完成；任何校验或持久化失败均零变化。
- 再次选择 rescheduled Action 时，恢复 pending 与创建当天 TodaySelection 原子完成，但不自动把它设为 Goal 当前下一步。

### 5.3 SQLite / IPC / Renderer

- 复用 v1 `actions`、`today_selections`、`goals.current_next_action_id` 及现有 Repository/Unit of Work；SQLite 外键只防悬空，active/same-Goal/pending/当前下一步等跨行不变量由 Application/Domain 在同一事务校验。
- Repository 增加意图级读写方法；不得把 `readSnapshot()`、SQL、数据库路径或通用 CRUD 暴露给 Renderer。
- Main 为九个 Command/Query 使用固定意图级 channel，复用 sender/origin 校验并做运行时 DTO 校验；Preload 只暴露冻结的 `window.myTracer.actions` / `window.myTracer.today` 具体方法和可结构化克隆 DTO。
- IPC 必须拒绝缺字段、错误类型/枚举、空白必填文本、非法/伪造 ID、未知多余字段、非法 resolution、跨 Goal/非 pending 替代项和 Renderer 自带日期；错误不得泄露 SQL、堆栈、绝对路径或用户正文。
- Renderer 提供最小 Action 创建/修改/状态转换/详情与 Today focus 选入、移出、列表路径；转换当前下一步时必须收集明确 resolution，不能替用户默认选择。
- `GetToday` 返回当前 LocalDate、当天全部显式 focus、Action/Goal 状态、`canStart` 或等价可操作性以及稳定不可操作原因；complete/cancel 和 paused/ended Goal 的保留选择必须可见但不可再次开始。
- T012 不实现真实“开始并记录行动”流程；该能力及 ActionRecord 保存属于 T013。

## 6. 精确文件范围

本次合同编写只允许新增：

- `docs/implementation/T012_ACTION_TODAY_TASK.md`

在本合同获批并另行获得实现启动授权后，T012 实现仅可新增或修改：

**Domain / Application / Contracts**

- `src/domain/action.ts`（新增）
- `src/domain/index.ts`
- `src/application/actions.ts`（新增）
- `src/application/today.ts`（新增）
- `src/application/ports/persistence.ts`
- `src/contracts/actions.ts`（新增）
- `src/contracts/today.ts`（新增）
- `src/contracts/shell.ts`

**SQLite / Main / Preload / Renderer**

- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/actions-ipc.ts`（新增）
- `src/main/today-ipc.ts`（新增）
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

**Tests**

- `tests/unit/action-domain.test.ts`（新增）
- `tests/unit/action-application.test.ts`（新增）
- `tests/unit/today-application.test.ts`（新增）
- `tests/integration/action-today-sqlite.test.ts`（新增）
- `tests/integration/action-today-ipc.test.ts`（新增）
- `tests/e2e/action-today.e2e.test.ts`（新增）
- `tests/e2e/shell.e2e.test.ts`（仅更新白名单 API/壳回归断言）

**任务文档（仅在真实结果产生且另获文档收口授权后）**

- `docs/implementation/T012_ACTION_TODAY_TASK.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`（仅记录真实 `EV-T012-001`）
- `docs/implementation/TASK_INDEX_V0.1.md`（仅按另行授权同步真实状态）

`package.json`、lockfile、任何 migration（尤其 `src/infrastructure/sqlite/migrations/001_initial.sql`）及其他文件均不在范围内。发现实现必须触及未列文件时先停止并申请范围批准。

## 7. 明确非范围

- ActionRecord；Understanding；Confusion；Progress；Routine 与 RoutineRecord；
- 快速/深入记录、记录补记/修改/删除、用户实际保存 `partial` ActionRecord；
- Action Goal 重分配、Goal/Action 硬删除、影响预览或二次确认；
- Today `intention`、计划 Routine、未来日期、截止日期、逾期、自动滚动、自动排程或复杂日历；
- Recovery、Review、导出/导入、AI Provider、AI 上下文、AI 建议或确认写入；
- FR-A07、FR-T02/T03/T06/T07 及 S2～S7 的任何能力；
- 优先级、标签、搜索、层级、依赖、提醒、评分、掌握度、计时器、同步、账号、插件等延期能力；
- 安装/升级依赖、migration、修改 schemaVersion 或 `001_initial.sql`；
- package/NSIS、release、真实用户数据库或生产数据操作。

## 8. 必须保持的不变量

1. Action 状态只含 `pending | completed | cancelled | rescheduled`；`partial` 不是状态，任何 Record outcome 都不能自动触发 Action 转换。
2. Action 可无 Goal；创建关联 Action 时 Goal 必须 active。T012 不改变已有 Action 的 goalId。
3. 非空 Goal 当前下一步始终指向同 Goal pending Action；其状态转换与用户明确 resolution 必须同事务完成。
4. reschedule 复用 ID、保留所有旧 Record/历史选择，只删除当前 LocalDate focus；再次明确选入才恢复 pending。
5. complete/cancel 保留当前日 TodaySelection并显示不可再次开始；只有显式移出或 reschedule 删除当天选择。
6. TodaySelection 只来自用户显式命令、无硬上限、只写 focus/user；Query 不写入、不补全、不搬运、不静默隐藏。
7. 每个 Command/Query 只使用 Main 捕获的一次 LocalDate；跨日不自动复制旧 focus 或改变历史。
8. paused/ended Goal 下已有 focus 保留 Goal 状态和不可操作原因；不得新增 focus、关联 Action、替换下一步或标记为可开始。
9. Renderer 不访问 Node、SQLite、文件、凭据或任意 IPC；Main 负责运行时校验、日期捕获、事务和稳定错误映射。
10. 自动化测试只使用每 case/进程唯一临时数据库与 `userData`，不得访问真实用户数据；AI 未配置时 T012 能力仍可用。

## 9. 交付物与完成条件

1. 九个 Command/Query 在真实 Renderer → Preload → Main/Application → SQLite 路径可观察，且只暴露意图级 API。
2. Action 创建、详情修改、合法/非法状态转换、可空/active Goal 关联和禁止 Goal 重分配有单元、集成与 IPC 证据。
3. 当前下一步 Action complete/cancel/reschedule 时，三种 active Goal resolution 均正确；paused/ended 仅允许 clear；缺失、额外或非法 resolution 被拒绝且整个事务零变化。
4. reschedule 前后 Action ID 相同，旧 ActionRecord fixture 内容不变，当天 focus 删除；再次显式选入时才原子恢复 pending，且不自动成为当前下一步。
5. complete/cancel 后当天 focus 保留、显示终态且不可再次开始；显式移出只影响当天 focus，不改变 Action 状态。
6. `GetToday` 只返回当前 LocalDate 的全部显式 focus，无硬上限；paused/ended Goal 下既有选择显示 Goal 状态与不可操作原因；重复 Query 不改变 SQLite。
7. FakeClock 前进到下一 LocalDate 后，新一天不自动出现旧 focus，旧日期行不被修改或删除。
8. 真实关闭 Electron 与 SQLite 后，以同一隔离 `userData` 重开，Action ID/状态、Goal 关联、当前下一步和同日 Today focus 与关闭前一致。
9. 未新增/升级依赖，`package.json`、lockfile、schemaVersion 和 migration 集合不变；`001_initial.sql` 未修改。
10. 最终 diff 仅含获批范围；针对性验证和 `verify` 在最终 revision 通过，真实结果才可记录为 `EV-T012-001`。
11. T012 证据只声明 FR-A01～A04/A06、FR-T01/T04/T05/T08 的任务覆盖、FR-A05 的 Action 状态解耦贡献及 AC-01 步骤 3 贡献；不得声明 T012 单独完成 FR-A05、完整 FR-D01 或完整 AC-01。
12. **MANUAL**：项目所有者于 2026-08-10 完成 Action/Today 路径、Today 显式选择与无硬上限、终态、reschedule、paused/ended 不可操作原因及输入焦点回归复验，并报告全部通过。

## 10. 验证计划

### 10.1 单元

- Action 全部合法/非法转换、终态拒绝、rescheduled 仅经显式 Today 选择恢复；
- `partial` 不在 Action 状态集合，已有 partial Record fixture 不触发状态变化；
- Create/Update 的可空 Goal、active Goal、非空文本与禁止 goalId 变化；
- 当前下一步三种 resolution、非当前下一步必须省略、paused/ended 仅 clear、端口故障零变化；
- Today 同日唯一、用户来源、无硬上限、不自动搬运以及 Query 只读。

### 10.2 SQLite 集成

- 在真实 v1 schema 上覆盖 Action CRUD 中的本任务子集、状态机、Goal 关联和 Today 写入/删除；
- complete/cancel 保留当天行；reschedule 删除当天行；重新选择同 ID 并恢复 pending；历史 ActionRecord fixture 不变；
- 每个原子写入点故障注入，比较 Action、Goal 当前引用和 TodaySelection 均零变化；
- FakeClock 跨日后新日查询为空、旧日行不变；重复 Query 前后数据库快照一致；
- 关闭连接并从同一临时数据库重开后结果一致。

### 10.3 IPC

- 九个 Command/Query 的受信 sender 正常，伪造 sender/origin 全拒绝；
- 缺字段、错误类型/枚举、空白文本、未知字段、非法/伪造 ID、Renderer 日期、非法 resolution、跨 Goal/非 pending 替代项均拒绝且返回中性稳定错误；
- Preload API 冻结且只暴露白名单 Action/Today 方法，不暴露 channel、SQL、路径或 Electron 对象。

### 10.4 E2E 与人工

- 使用唯一临时 `userData`：创建无 Goal/有关联 Goal Action → 修改 → 选入 Today → complete/cancel 终态保留 → 显式移出；
- 覆盖 reschedule 移出 → 再次选择同 ID 并恢复 pending，以及当前下一步 clear/use-existing/create-and-use 分支；
- pause/end Goal 后既有 focus 保留且不可操作，新 focus 被拒绝；
- 完全关闭 Electron 后以同一隔离 `userData` 重开；FakeClock 跨日后验证不自动搬运；AI 保持未配置；
- 项目所有者按第 9 节 MANUAL 条目执行体验验收；未执行不得声称通过。

### 10.5 命令

针对性验证：

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
```

受影响范围回归：

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
```

`verify` 包含 build 和 Electron E2E，但不证明 hosted CI、package/NSIS 或人工验收。证据必须绑定最终 source revision、Windows/Node/Electron 环境、隔离数据根、实际命令结果和已知缺口。

### 10.6 实际结果

- 实现验证绑定 `task/T012-action-today@56b3446a1b952a9bdb6fe29ab4a89502171ba321`，启动基线为 `dev@7cb5bebd8c2d0e66056d2b34189d084e78261b41`。
- 本地 Windows `npm.cmd run verify` 通过：54 项 unit、24 项 integration、3 项 Electron E2E 通过；1 项 package smoke 按既有条件跳过。
- Draft PR #9 的实现 head hosted Windows required gate run `31359250988` / job `93364691450` 返回 `success`。
- 项目所有者于 2026-08-10 完成人工复验并报告全部通过，包括 T012 Action/Today 行为与 T011/T012 `window.confirm` 输入焦点回归。
- 最终实现未新增或升级依赖，未新增 migration，未修改 schemaVersion 或 `001_initial.sql`；真实结果记录为 `EV-T012-001`。
- T012 只贡献 AC-01 步骤 3，并只完成 FR-A05 的 Action 状态解耦部分；用户实际保存 `partial` ActionRecord 仍属于 T013。

## 11. Git、GitHub、依赖与外部操作权限

实际授权与执行状态：

- [x] 创建 `task/T012-action-today` 分支。
- [x] 创建独立实现与文档收口 commit。
- [x] push 当前任务分支。
- [x] 创建并更新到 `dev` 的 Draft PR #9。
- [ ] 标记 Ready、merge 到 `dev`、创建或合并 `dev → main`、tag 或 release。
- [ ] 执行 `npm install`、`npm ci` 或其他安装动作；新增或升级依赖。
- [ ] approved GitHub flow 之外的外部写入、live AI、真实用户数据写入、迁移或破坏性操作。

项目所有者明确要求文档收口提交推送后无需等待新的 CI；因此 `EV-T012-001` 绑定已通过 hosted gate 的实现 revision，文档收口 revision 单独记录。该指令不授权 Ready、merge、tag 或 release。

## 12. 风险与停止条件

主要风险：

- complete/cancel/reschedule 与 Goal 当前下一步 resolution 跨多行；事务或校验错误会留下非法引用或半写入。
- 把 complete/cancel 与 reschedule 都删除 TodaySelection，会违反 S1-Q07-A；反之 reschedule 保留当天行会违反 ED-007。
- 把 reschedule 实现成新 Action、未来日期或自动下一步，会改变 ID/历史并引入延期日程语义。
- Query 自动修复、隐藏 paused/ended/terminal 行或跨日复制，会违反用户决定权并制造不可审计写入。
- `partial` 被加入 Action 状态或触发转换，会提前吞并 T013 且改写 FR-A05。
- Today UI 若把暂停/结束 Goal 下已有选择当作可开始，或通过移除行掩盖原因，会违反 S1-Q05-A。
- 只刷新 Renderer 或复用内存连接不是真实重开证据；必须关闭 Electron/SQLite 后重建。

发现以下任一情况，立即停止受影响设计/实现并报告，不得自行改变语义：

- MUST、D-004/005/016/106、ED-005/006/007、S1-Q03-B/Q05-A/Q06-A/Q07-A 或现有 schema 相互冲突；
- 需要新增/升级依赖、新 migration、修改 `001_initial.sql` 或 schemaVersion；
- 需要扩大文件范围、任务状态、Git/GitHub 权限或外部写入；
- 需要实现 ActionRecord、Goal 重分配、硬删除、Routine、Recovery、AI 或任何 S2～S7 能力；
- 测试会访问真实 Electron `userData`，或无法为最终 revision 产生事务、跨日和真实关闭重开证据。

## 13. 完成报告要求

报告必须简短列出：实际变更文件；FR-A01～A06、FR-T01/T04/T05/T08、D-004/005/016/106、ED-005/006/007 与 AC-01 步骤 3 的覆盖边界；实际命令、环境、revision 与 `EV-T012-001`；人工验收状态；依赖/schema/migration 不变证明；残余风险和未验证项；是否发现需求冲突或范围变化。必须明确 FR-A05 与 AC-01 仍需后续任务证据，不能由 T012 单独宣称完成。

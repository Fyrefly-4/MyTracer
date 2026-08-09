# T011 Goal 生命周期与当前下一步任务合同

> 合同状态：**T011 已完成；本地与 hosted 自动验证、项目所有者人工验收及 review 均已通过，等待 T012 独立合同与启动**
>
> 启动基线：`dev@54b6368c0a2b4da0721838541f60c0d2eb55aa1a`
>
> 当前权限：允许完成状态文档同步并更新现有 Draft PR；不得安装依赖、启动 T012、标记 Ready、合并、tag 或 release

## 1. 任务信息

- **Task ID**：T011
- **Title**：Goal lifecycle and current next action
- **Slice / Plan item**：S1 / E1-01
- **Task ledger status**：`done`
- **Base branch**：`dev@54b6368c0a2b4da0721838541f60c0d2eb55aa1a`
- **Task branch**：`task/T011-goal-lifecycle`
- **前置事实**：G2 已通过；S1 整体设计已批准；S1-Q02 = B、S1-Q05 = A。

## 2. 目标结果

已按获批范围交付 Goal 的最小完整纵向路径：

- 用户可创建、修改、pause、resume、end Goal，并通过 `ListGoals`、`GetGoalDetail` 查看状态、当前下一步、关联 Action 和已有 Record 摘要；
- 创建 Goal 时可选内联填写一个下一步；Main 在一个事务内按“创建空引用 active Goal → 创建同 Goal pending Action → 设置当前引用”完成，任一步失败均零变化；
- Goal 当前下一步可空；非空时只能引用同一 Goal 的 pending Action；只有 active Goal 可通过 T011 的明确命令设置、清空或替换引用；
- pause/end 只改变 Goal 状态，保留当前引用、关联 Action/Routine/Record 历史和当日 TodaySelection；paused 可 resume，ended 为终态；
- 完全关闭应用与 SQLite 连接后，使用同一隔离 `userData` 重开，以上状态和关系仍可查询。

T011 仅贡献 AC-01 步骤 1～2，不声明 AC-01 自动化或人工验收完整通过。

## 3. 需求与设计依据

- **FR**：FR-G01～FR-G06。
- **AC**：AC-01 步骤 1～2，仅贡献覆盖。
- **D**：D-002、D-101。
- **ED**：ED-005、ED-006；横切遵守 ED-003、ED-004、ED-015、ED-018、ED-019。
- **已批准设计**：S1-Q02-B（仅内联创建初始 pending Action，通用 Action 生命周期归 T012）；S1-Q05-A（pause/end 保留当前上下文与当日 TodaySelection）。
- **直接相关章节**：
  - `PRODUCT_REQUIREMENTS_V0.1.md` §5.1、§6.1、§8 F-01、§9.1、§12 AC-01；
  - `DECISIONS.md` D-002、D-101；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-005/006；
  - `ARCHITECTURE_V0.1.md` §4；`DOMAIN_MODEL_V0.1.md` §3；`DATA_DESIGN_V0.1.md` §2.1、§6、§8；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §3、§5.1、§6、§7、§8.1、§9～§12；
  - `TEST_STRATEGY_V0.1.md` §2～§8；`REQUIREMENTS_TRACEABILITY_V0.1.md` §2.1；
  - `IMPLEMENTATION_PLAN_V0.1.md` E1-01；`TASK_INDEX_V0.1.md` T011；`GITHUB_WORKFLOW_V0.1.md`。

`user/` 不属于本合同依据，也不得成为实现、测试或验收依赖。

## 4. 开始条件与权限门

已满足：

- [x] G2 已由 `EV-G2-001` 证明并经项目所有者确认。
- [x] S1 设计已批准，S1-Q02-B、S1-Q05-A 已冻结为 T011 输入。
- [x] 当前 v1 schema 已包含 `goals`、`actions` 及本任务所需关联；本合同核对时未发现 MUST、已批准 D/ED 或 schema 冲突。

开始实现前仍必须满足：

- [x] 项目所有者批准本合同。
- [x] 项目所有者另行明确发出 T011 实现启动指令。
- [x] 启动时已只读复核确切 `dev` revision、工作树、任务状态和适用权限。
- [x] 本合同精确文件范围内的本地写入已随启动指令授权；项目所有者随后明确授权分步提交、推送任务分支并创建 Draft PR。
- [x] 项目所有者在 review 后明确授权将当前文档同步为 T011 完成、等待 T012 启动；任务索引已更新为 `done`。
- [x] 实现未新增/升级依赖或 migration，也未修改 `001_initial.sql`。

## 5. 允许的实现行为

### 5.1 Domain / Application

- 实现 Goal 值、状态机和不变量：初始 `active`；`active → paused/ended`、`paused → active/ended`；其他转换拒绝；`ended` 不可恢复。
- 实现 `CreateGoal`、`UpdateGoalDetails`、`PauseGoal`、`ResumeGoal`、`EndGoal`、`SetGoalCurrentNextAction`。
- `CreateGoal.initialNextAction` 仅允许创建一个同 Goal 的 pending Action；这不是通用 Action 创建入口。
- `SetGoalCurrentNextAction` 接受同 Goal pending Action 或 `null`，由明确用户命令触发；T011 中该命令只允许 active Goal。
- 实现只读 `ListGoals` 和 `GetGoalDetail`；查询不得保存、迁移、补全或改变状态。
- `GetGoalDetail` 返回 Goal、当前下一 Action、关联 Action 与已有 Record 摘要；可用持久化 fixture 验证读取，但不创建或修改 Record。

### 5.2 SQLite / 事务

- 复用 `schemaVersion = 1`、现有 `goals`/`actions` 外键和现有 Repository/Unit of Work；增加意图级查询/写入方法，不把 `readSnapshot()` 暴露给 Renderer。
- SQLite 外键只负责防悬空；同 Goal、pending、active 状态与原子顺序必须由 Domain/Application 在同一事务校验。
- 创建带初始下一步的 Goal 必须先写空引用 Goal，再写 Action，最后更新 Goal 引用；故障注入证明全部回滚。
- pause/end 不删除或改写当前引用、Action、Routine、Record、TodaySelection；修改名称/说明不改变 ID 和历史身份。

### 5.3 IPC / Renderer

- Main 为每个 Goal Command/Query 使用固定意图级 channel，复用统一 sender/origin 校验并执行运行时 DTO 校验；拒绝缺失、错误类型、空白必填文本、非法枚举、未知多余字段、伪造 ID 和跨 Goal 引用。
- Preload 仅暴露冻结的 `window.myTracer.goals` 具体方法与可结构化克隆 DTO；不暴露 `ipcRenderer`、channel、SQL、数据库路径、文件系统或 Electron 对象。
- Renderer 提供最小 Goal 列表/详情、创建/修改、pause/resume/end、当前下一步清空/选择入口及中性错误/空状态；不得自行合并领域状态或自动挑选下一步。
- pause/end 后 UI 继续显示保留的当前引用和已有当日选择上下文，不把 paused/ended 描述为失败；ended 不显示恢复入口。

## 6. 精确文件范围

本次实现仅允许新增或修改下列文件：

**Domain / Application / Contracts**

- `src/domain/goal.ts`（新增）
- `src/domain/index.ts`
- `src/application/goals.ts`（新增）
- `src/application/ports/persistence.ts`
- `src/contracts/goals.ts`（新增）
- `src/contracts/shell.ts`

**SQLite / Main / Preload / Renderer**

- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/ipc-security.ts`（新增；从现有 shell handler 提取并复用 sender/origin 校验）
- `src/main/goals-ipc.ts`（新增）
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

**Tests**

- `tests/unit/goal-domain.test.ts`（新增）
- `tests/unit/goal-application.test.ts`（新增）
- `tests/integration/goal-sqlite.test.ts`（新增）
- `tests/integration/goal-ipc.test.ts`（新增）
- `tests/e2e/goal-lifecycle.e2e.test.ts`（新增）
- `tests/e2e/shell.e2e.test.ts`（仅更新白名单 API/壳回归断言）

**Task evidence**

- `docs/implementation/T011_GOAL_LIFECYCLE_TASK.md`（仅按后续批准记录审批/实际结果）
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`（仅在真实验证后记录 `EV-T011-001`）

项目所有者于 2026-08-09 review 后另行授权仅为事实收口更新 `TASK_INDEX_V0.1.md`、README、实施计划和 S1 设计的当前状态说明；这不扩大 T011 实现范围，也不构成 T012 启动授权。

## 7. 明确非范围

- 通用 Action 创建、编辑、Goal 重分配及 `complete/cancel/reschedule` 状态转换（T012）；
- Today 选择/移出、focus/intention、自动候选或跨日搬运；
- ActionRecord 创建、补记、修改、删除，Understanding、Confusion 和 Progress；
- Routine、RoutineRecord 与星期节奏；
- Goal/Action 硬删除、影响预览、Recovery、Review、导出/导入；
- AI Provider、AI 上下文、建议、确认写入或任何 live AI；
- FR-G07 软数量提示及 S2～S7 的任何能力；
- 优先级、截止日期、标签、搜索、层级、依赖、提醒、评分、掌握度、同步、账号、插件等延期能力；
- 打包、release、真实用户数据库迁移或生产数据操作。

## 8. 必须保持的不变量

1. Goal 名称非空；新 Goal 为 active；ended 为终态且不区分完成与主动放弃。
2. 当前下一步可空；非空时必须引用同 Goal pending Action。T011 不自动选择或替换下一步。
3. 只有 active Goal 可通过 T011 创建关联初始 Action或设置、清空、替换当前下一步。
4. pause/end 保留 `currentNextActionId`、Action/Routine/Record 历史、关联和当日 TodaySelection；不得隐式完成、取消、移动或删除内容。
5. 创建 Goal + 可选初始 Action + 当前引用是一个事务；任何验证或写入失败产生零变化。
6. Query 只读；Renderer 不访问 Node、SQLite、文件、凭据或任意 IPC；Main 执行全部运行时校验和事务编排。
7. 自动化测试只使用每 case/进程唯一临时数据库与 `userData`；不得访问真实用户数据。
8. 无 AI 配置时全部 T011 能力仍可用；不得引入 AI 依赖或写权限。

## 9. 交付物与验收标准

1. Goal 创建、修改、pause、resume、end、列表和详情在真实 Renderer → Preload → Main/Application → SQLite 路径可观察。
2. 创建时可不填下一步；填写时原子创建一个同 Goal pending Action 并设置引用。
3. 同 Goal/pending/active 约束在 Domain、Application、SQLite 集成和 IPC 负面路径均被证明；跨 Goal、非 pending、非法状态和故障写入被拒绝且无部分变化。
4. pause/end 前后当前引用以及 Action/Routine/Record/TodaySelection fixture 数量与身份不变；paused 可 resume；ended 的所有后续生命周期转换被拒绝。
5. `ListGoals` 状态过滤明确且不把 paused/ended 当失败；`GetGoalDetail` 返回当前下一步、关联 Action 和已有 Record 摘要，重复查询不写数据库。
6. 应用与 SQLite 连接完全关闭后，从同一隔离 `userData` 重开，Goal 状态、当前引用、关联 Action 和历史摘要一致；不得用同一内存实例模拟。
7. 未新增/升级依赖，`package.json`、lockfile、schema 版本和 migration 集合不变；未修改 `src/infrastructure/sqlite/migrations/001_initial.sql`。
8. 最终 diff 仅含获批范围；相关自动验证通过并在最终 revision 记录 `EV-T011-001`。
9. T011 证据只声明 FR-G01～G06 的任务覆盖及 AC-01 步骤 1～2贡献；AC-01 索引继续为 `pending`，直至 T014 后的同版本完整自动化与项目所有者人工验收。
10. **MANUAL**：项目所有者于 2026-08-09 确认首次创建 Goal 与可执行下一步足够轻、无需理解项目层级/优先级/截止日期，pause/end 的保留语义和 ended 终态清晰；结果为 `pass`。

## 10. 验证计划

### 10.1 单元

- Goal 合法/非法状态转换、ended 终态、修改详情不改变 ID/历史身份；
- 当前下一步可空、同 Goal/pending/active 约束；
- CreateGoal 三步编排、List/Get 只读、端口失败完整回滚。

### 10.2 SQLite 集成

- v1 schema 上创建、修改、状态转换、关联查询和稳定排序；
- 带/不带内联 Action 的原子创建；每个写入点故障注入均零变化；
- 跨 Goal、非 pending 和不存在引用拒绝；
- 预置 Action/Routine/Record/TodaySelection 后 pause/end，比较前后 ID、数量、外键与内容；
- 真实关闭连接并从同一临时数据库重开后结果一致。

### 10.3 IPC

- 受信 sender 的每个 Goal Command/Query 正常；伪造 sender/origin 全拒绝；
- 缺字段、空白名称、错误枚举/类型、未知字段、伪造 ID、跨 Goal/非 pending 引用返回稳定中性错误，不泄露 SQL、堆栈、绝对路径或用户正文；
- Preload API 冻结且只暴露白名单 Goal 方法。

### 10.4 E2E 与人工

- 使用唯一临时 `userData`：创建 Goal + 初始下一步 → 列表/详情 → 修改 → 清空/恢复当前下一步 → pause → resume → end → 验证终态；
- 完全关闭 Electron 后以同一隔离 `userData` 重开并复核；AI 保持未配置；
- 项目所有者已按第 9 节 MANUAL 条目完成体验验收并报告通过。

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

`verify` 包含 build 和 Electron E2E，但不证明 hosted CI、打包或人工验收。证据必须记录 Windows、Node/Electron 版本、隔离数据根、最终 source revision、真实结果与已知缺口。

## 11. Git、GitHub、依赖与外部操作权限

项目所有者于 2026-08-09 在人工验收通过后授权以下 Git/GitHub 操作：

- [x] 创建本地任务分支 `task/T011-goal-lifecycle`。
- [x] 创建本地分步提交。
- [x] push 该任务分支。
- [x] 创建到 `dev` 的 Draft PR。
- [x] review 后同步 T011 完成状态、验收/CI 证据和 T012 等待状态，并更新现有 Draft PR。
- [ ] 标记 Ready、merge、`dev → main`、tag 或 release。
- [ ] 安装、增加或升级依赖；不得执行 `npm install`、`npm ci` 或其他安装动作。
- [ ] 除上述 push/Draft PR 外的外部写入、live AI、真实用户数据写入或破坏性操作。

本任务设计要求不新增依赖、不新增 migration、不修改 `001_initial.sql`；`package.json` 与 lockfile 不在允许文件范围。任何权限只能由项目所有者针对确切操作另行授予。

## 12. 风险与停止条件

主要风险：

- `goals.current_next_action_id` 与 `actions.goal_id` 形成循环引用；写入顺序或事务错误会留下半成品。
- SQLite 外键不能证明“同 Goal + pending”；若只依赖 schema，会接受语义非法引用。
- 现有 Repository 的通用 upsert 若绕过 Application 不变量，可能改写状态或引用；新增入口必须保持意图级且不暴露给 Renderer。
- pause/end 若顺手清空引用、删除 TodaySelection 或改变关联状态，会违反 S1-Q05-A 和历史守恒。
- IPC 安全校验目前服务 shell query；提取复用时不得削弱现有 sender/origin、零输入和壳回归。
- 仅刷新页面或复用内存连接不是真实重开证据；E2E 必须关闭 Electron/SQLite 后重启。

发现以下任一情况，立即停止受影响设计/实现并报告，不得自行改变语义：

- MUST、D-002/D-101、ED-005/006、S1-Q02-B、S1-Q05-A 或现有 schema 相互冲突；
- 需要新增/升级依赖、新 migration、修改 `001_initial.sql` 或改变 schema 版本；
- 需要扩大文件范围、任务状态权限、Git/GitHub 权限或外部写入；
- 需要实现通用 Action、Today、Record、Progress、删除、Recovery、AI 或 S2～S7 能力；
- 测试会访问真实 Electron `userData`，或无法对最终 revision 产生可靠的关闭重开与事务证据。

## 13. 完成报告要求

报告必须简短列出：实际变更文件；FR-G01～G06、D-002/D-101、ED-005/006 和 AC-01 步骤 1～2贡献；实际命令、环境、revision 与 `EV-T011-001`；人工验收状态；依赖/schema/migration 不变证明；残余风险、未验证项，以及是否发现需求冲突或范围变化。

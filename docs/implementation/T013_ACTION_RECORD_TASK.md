# T013 快速/深入 ActionRecord 任务合同

> 合同状态：**项目所有者已批准；实现、自动验证、独立复核与人工验收均已完成**
>
> 交付事实：实现与证据绑定 revision `b10d5d40c4c1dc1f7a20801d5d904b1d37953270`；Draft PR #10 的实现-head Windows required gate 已通过；项目所有者于 2026-08-12 报告人工验收通过。
>
> 当前权限：文档收口、Draft PR 正文更新、独立收口提交与 push 已获授权；Ready、merge、tag、release、依赖安装与其他外部写入仍未授权。

## 1. 任务信息

- **Task ID**：T013
- **Title**：Quick and deep ActionRecord
- **Slice / Plan item**：S1 / E1-03
- **Task ledger status**：`done`（由 `EV-T013-001` 支持；不代表 PR Ready、merge、S1 或完整 AC-01 通过）
- **Base / branch**：`dev@b994962618954cf02f9e07590d68213d0378bccb` / `task/T013-action-record`
- **前置事实**：G2 已通过；S1 设计已批准；T011、T012 已完成；S1-Q03=B、S1-Q04=B、S1-Q07=A、S1-Q08=B、S1-Q10=A。

## 2. 目标结果

经项目所有者批准本合同并另行发出实现启动指令后，交付 ActionRecord 的最小完整纵向路径：

- 用户可为无 Goal 或 active Goal 下的 pending Action 开始、取消并保存一次记录；TodaySelection 不是前置条件。
- 快速层只要求 `durationMinutes` 与 `outcome`；Understanding、Confusion、`nextStep`、`note` 按需展开且全部可空。
- `completed | partial | stopped` 均保存真实行动；`partial`、`stopped` 不自动改变 Action 状态。
- Main 通过仅存内存的 recording context 固定受信 sender、Action 和开始日；跨午夜必须由用户明确选择发生日。
- ActionRecord、可选子实体与用户明确确认的 post-record 变化原子保存；默认保持 Action pending。
- 用户可只读查看记录列表与详情；关闭 Electron 和 SQLite 后从同一隔离数据根重开，记录及关联仍一致。

T013 只贡献 AC-01 步骤 4～5。T013 与 T012 的 Action 状态解耦证据合并后，才可声明 FR-A05 完成；不得声明 T013 单独完整通过 AC-01。

## 3. 需求与设计依据

- **FR**：FR-A05；FR-A08 的 T013 显式入口部分（SHOULD）；FR-L01～FR-L06、FR-L08；FR-C01。
- **明确不由 T013 完成**：FR-L07 属于 T031；FR-L09 的 Progress 事实展示属于 T014；FR-C04 属于 T031。
- **AC**：AC-01 步骤 4～5，仅贡献覆盖。
- **D**：D-006、D-103、D-104、D-105、D-106。
- **ED**：ED-012、ED-015、ED-016、ED-017；横切遵守 ED-003、ED-004、ED-018、ED-019。
- **已批准设计**：S1-Q03-B、S1-Q04-B、S1-Q07-A、S1-Q08-B、S1-Q10-A。
- **直接相关章节**：
  - `PRODUCT_REQUIREMENTS_V0.1.md` §5.4、§6.2、§6.5～6.6、§8 F-02、§9.2、§9.5～9.6、§10、§12 AC-01；
  - `DECISIONS.md` D-006/103/104/105/106；
  - `ARCHITECTURE_V0.1.md` §4～§6、§9；
  - `DOMAIN_MODEL_V0.1.md` §4.3、§6.1/6.4、§7.1～7.2、§8；
  - `DATA_DESIGN_V0.1.md` §2.1、§3～§4、§6、§8、§11；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-012/015/016/017；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §3～§7、§8.3、§9～§12；
  - `TEST_STRATEGY_V0.1.md` §2～§8；`REQUIREMENTS_TRACEABILITY_V0.1.md` §2.2、§2.5～2.6、§3～§5；
  - `IMPLEMENTATION_PLAN_V0.1.md` E1-03；`TASK_INDEX_V0.1.md` T013；`GITHUB_WORKFLOW_V0.1.md`。

`user/` 不属于本合同依据，也不得成为实现、测试或验收依赖。

FR-A08 与 FR-L06 在本合同中仍保持 SHOULD；T013 只交付其已批准范围内的显式入口和可选 note，不改变需求级别。

## 4. 开始条件与权限门

已确认输入：

- [x] G2、S1 设计和上述 S1-Q 决定已批准。
- [x] T011、T012 已完成；本任务不重新检查其实现和验收。
- [x] 现有 `schemaVersion = 1` 已包含 `action_records`、`understandings`、`confusions` 所需字段、外键和枚举。
- [x] 合同核对未发现 MUST、已批准 D/ED 或现有 schema 冲突。

实现开始前仍必须满足：

- [x] 项目所有者批准本合同并明确发出 T013 实现启动指令。
- [x] 启动时只读核对 `dev@b994962618954cf02f9e07590d68213d0378bccb`、工作树、任务账本与适用权限。
- [x] 项目所有者批准第 7 节的精确实现文件范围。
- [x] 已授权创建任务分支、分步提交、push 与 Draft PR；依赖安装、任务状态/验收证据更新、文档收口及其他外部写入继续禁止。

## 5. 命令、查询与记录语义

### 5.1 Application Commands

- `BeginActionRecording(actionId)`：开始时复核 Action 为 pending，且无 Goal 或关联 active Goal；由 Main 签发 opaque `recordingContextId`。
- `CancelActionRecording(recordingContextId)`：只使属于同一受信 sender 的未消费 context 失效，不写 SQLite。
- `RecordAction(...)`：提交 context ID、Action ID、分钟、outcome、可选深入字段、可选跨日选择和明确 post-record 选择；Renderer 不提交任意 `occurredOn` 或 `capturedOn`。

记录输入规则：

- `durationMinutes` 必须为非负整数；`0` 表示不足一分钟但确有行动，不得推断为未行动。
- `outcome` 仅为 `completed | partial | stopped`；三者均为一条真实 ActionRecord。
- 快速层只有分钟和 outcome 必填；本次最小 UI 可分别创建零或一个 manual Understanding、零或一个 open Confusion，并可选保存 `nextStep`、`note`。
- 可选非空文本若提供，必须拒绝仅空白值；省略与空字段应规范化为未提供，不得制造空子实体。
- Main 在保存前再次复核 Action/Goal 状态；begin 后发生的状态变化不能绕过 S1-Q10-A。

### 5.2 recording context 与跨午夜

- context 仅存 Main 内存，绑定受信 sender、`actionId` 与 `ClockPort` 捕获的 `capturedOn`；同一 sender/Action 只保留最新未消费 context，新 context 替换并使旧 context 失效。
- context 在取消、替换、成功消费、Renderer reload/navigation、sender/window 销毁、窗口关闭或应用退出后失效；不引入未经批准的持久 token 或跨会话恢复。
- 伪造、过期/失效、已消费及 sender/Action 不匹配均返回稳定中性错误并零写入。
- 每次 begin/save 只读取一次 Clock snapshot。若保存日仍为 `capturedOn`，携带跨日选择必须拒绝；若已跨日，首次保存返回 `date-confirmation-required` 且零写入，context 保持可供确认重试。
- 跨日重试只接受 `keep-captured-on | use-current-on`；缺失、伪造或其他值均拒绝。用户取消确认时不写入。不得静默移动历史发生日。

### 5.3 post-record 显式选择

- `postRecord` 默认 `keep-pending`；`completed/partial/stopped` outcome 与 Action 状态、Goal 当前下一步、记录中的 `nextStep` 三者独立。
- 非默认 Action 转换必须是用户独立确认的 `complete | cancel | reschedule`，并复用 T012 状态机、TodaySelection 与 `currentNextResolution` 不变量；不得从 outcome 推断。
- 记录中的 `nextStep` 默认仅保存于 ActionRecord。只有用户明确选择应用、原 Action 关联 active Goal 且文本非空时，才可在同一事务创建同 Goal pending Action并设为当前下一步。
- 无 Goal Action 可保存 `nextStep` 文本，但不能创建悬空 Goal 当前引用；paused/ended Goal 不得借 RecordAction 创建或替换下一步。
- 若 post-record Action 转换涉及现有 Goal 当前下一步，必须明确清空、使用同 Goal pending Action，或以已填写下一步创建并使用新 Action；Main 不得默认挑选。

### 5.4 只读 Queries

- `ListActionRecordsForAction(actionId)`：返回该 Action 的记录摘要，显式按 `occurredOn DESC, createdAt DESC, id ASC` 排序。
- `GetActionRecordDetail(recordId)`：返回父记录、manual Understanding 列表、open Confusion 列表、`nextStep` 与 `note`；子实体显式按 `createdAt ASC, id ASC` 排序。
- Query 不保存、修复、补全、迁移、解决 Confusion、撤销 Understanding 或产生 Progress 聚合；重复调用前后数据库快照一致。

## 6. 事务、SQLite、IPC 与 Renderer 边界

- `BeginActionRecording`、`CancelActionRecording` 和跨日等待不打开 SQLite 事务；不得跨用户交互持有事务。
- 一次成功 `RecordAction` 在一个 `UnitOfWorkPort.transaction` 中完成 ActionRecord、Understanding、Confusion，以及用户明确确认的 Action 转换/当前下一步变化。
- 任一校验、父记录、子实体、Action 转换、TodaySelection 或当前下一步写入失败，整个事务全部回滚；context 只有成功提交后才消费。
- 复用 v1 schema、现有 Repository/Unit of Work 和参数化 SQL；不新增 migration、不修改 schemaVersion、不修改 `001_initial.sql`。
- Main 使用固定意图级 IPC、统一 sender/origin 校验和逐 DTO 运行时校验；未知多余字段、错误类型/枚举、负数/小数分钟、空白必填文本和 Renderer 日期均拒绝。
- Preload 只暴露冻结的 `window.myTracer.records` 具体方法与可结构化克隆 DTO；不得暴露 `ipcRenderer`、channel、SQL、数据库路径、文件系统或 Electron 对象。
- Renderer 在可开始的 Action 详情/Today 入口提供快速表单，深入字段渐进披露；不可开始 Action 不签发 context。取消、离开流程或 reload/navigation 必须使旧 context 不可复用。
- Renderer 将 `durationMinutes = 0` 显示为“少于 1 分钟”或等价中性文案，不显示为未行动。
- 错误仅暴露稳定 code 与中性消息，不泄露 SQL、堆栈、绝对路径、context 内部绑定或用户正文。

## 7. 精确文件范围

本次合同编写只允许新增：

- `docs/implementation/T013_ACTION_RECORD_TASK.md`

合同获批并另行获得实现启动及文件范围授权后，T013 仅可新增或修改：

**Domain / Application / Contracts**

- `src/domain/action-record.ts`（新增）
- `src/domain/index.ts`
- `src/application/action-records.ts`（新增）
- `src/application/ports/persistence.ts`
- `src/contracts/records.ts`（新增）
- `src/contracts/shell.ts`

**SQLite / Main / Preload / Renderer**

- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/action-recording-contexts.ts`（新增）
- `src/main/records-ipc.ts`（新增）
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

**Tests**

- `tests/unit/action-record-domain.test.ts`（新增）
- `tests/unit/action-record-application.test.ts`（新增）
- `tests/unit/action-recording-contexts.test.ts`（新增）
- `tests/integration/action-record-sqlite.test.ts`（新增）
- `tests/integration/action-record-ipc.test.ts`（新增）
- `tests/e2e/action-record.e2e.test.ts`（新增）
- `tests/e2e/shell.e2e.test.ts`（仅更新白名单 API/壳回归断言）

`package.json`、lockfile、任何 migration（尤其 `src/infrastructure/sqlite/migrations/001_initial.sql`）、`TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md` 及其他文件均不在当前授权范围。需要触及未列文件时停止并申请批准；真实结果的任务状态/证据收口必须另获授权。

## 8. 明确非范围

- 常规历史补记、记录修改或删除（FR-L07，T031）；Understanding 修改/撤销、Confusion resolve/reopen（T031）。
- Progress 聚合、FR-L09 的事实展示、评分、掌握度、质量推断或 AC-01 步骤 6（T014）。
- Routine/RoutineRecord、intention、Recovery、Review、导出/导入、AI 候选 Understanding、AI Provider/上下文/确认写入。
- Action Goal 重分配、Goal/Action/Record 硬删除、影响预览或二次确认。
- S2～S7 能力，以及优先级、标签、搜索、层级、依赖、截止日期、提醒、复杂日历、计时器、同步、账号、插件等延期能力。
- 新增/升级依赖、依赖安装、migration、schemaVersion 或 `001_initial.sql` 修改；package/NSIS、release、真实用户数据库或生产数据操作。

## 9. 必须保持的不变量

1. `partial`、`stopped` 是真实记录结果，不是 Action 状态；任何 outcome 都不能自动转换 Action。
2. 分钟为非负整数；0 分钟仍是真实行动，不能推断为未行动、失败或无效。
3. 只允许无 Goal 或 active Goal 下的 pending Action 开始和保存；TodaySelection 不是前置条件。
4. 发生日只来自 Main context 与明确跨日选择；Renderer 不能指定任意日期，历史日期不静默移动。
5. context 只存内存且绑定 sender/Action；无效 context、非法状态或跨日未确认全部零写入。
6. 父记录、子实体与显式 post-record 变化同事务；任何失败不得留下半记录、半转换或非法当前下一步。
7. 默认保持 Action pending；Action 状态、Goal 当前下一步和 Record.nextStep 相互独立。
8. Understanding 为用户确认自然语言、`source=manual`；Confusion 初始 `open`，不自动解决、不建立原因分类。
9. Query 只读且稳定排序；不生成 Progress、掌握度、评分或人格评价。
10. Renderer 无 Node/SQLite/文件/凭据能力；所有测试使用唯一临时数据库和 `userData`，AI 未配置时记录能力仍可用。

## 10. 交付物与完成条件

1. 三个 Command 与两个 Query 在 Renderer → Preload → Main/Application → SQLite 路径可观察，公开面仅为意图级 API。
2. 只填写分钟和 outcome 可保存；全部深入字段省略合法；可选文本和子实体按本合同验证、存储与查询。
3. completed、partial、stopped 及 0 分钟均保存为真实记录；默认 Action 保持 pending，非默认变化必须显式确认。
4. 合法/非法 Action 与 Goal 状态在 begin 和 save 两处复核；Today 未选择不阻塞合法记录。
5. context 的签发、替换、取消、消费、reload/navigation、窗口关闭与退出失效均有自动化证据；伪造/失效/已消费/sender-Action 不匹配零写入。
6. 跨午夜首次保存要求确认且零写入；两个明确选项分别产生准确 `occurredOn`，无其他日期入口。
7. 父子实体和 post-record 全事务故障注入证明任一步失败时数据库与 Action/Goal/Today 状态均零变化。
8. Understanding 固定 manual、Confusion 固定 open；不产生 revoked/resolved、精细分类或 AI 来源数据。
9. 列表/详情 Query 顺序稳定、重复调用只读；真实关闭 Electron/SQLite 后同一隔离数据根重开，父子实体和 post-record 结果一致。
10. 未新增/升级/安装依赖；`package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 不变。
11. 最终 diff 仅含获批文件；针对性验证与 `verify` 在同一最终 revision 通过，真实结果才可另行记录。
12. 证据只声明 FR-L01～L06/L08、FR-C01、FR-A08 T013 部分、FR-A05 的 Record 侧贡献及 AC-01 步骤 4～5；不声明 FR-L07、FR-L09、FR-C04 或完整 AC-01。
13. **MANUAL**：项目所有者确认快速层足够轻、深入字段渐进披露、跨日选择清楚、partial/stopped/0 分钟及 post-record 文案中性且不会暗示自动完成。

## 11. 验证计划

### 11.1 单元

- ActionRecord outcome、非负整数分钟、0 分钟和可选字段；manual Understanding、open Confusion。
- begin/save 状态门、默认 keep-pending、显式 post-record 与 Record.nextStep/当前下一步独立。
- context 签发、替换、取消、消费与所有失效事件；跨午夜两步确认。
- 父子实体和 post-record 的每个故障点均产生零变化；Query 只读及稳定排序。

### 11.2 SQLite 集成

- 在真实 v1 schema 上保存快速记录、深入记录及三种 outcome；覆盖 0 分钟和同 Action 同日多条记录。
- ActionRecord/Understanding/Confusion 外键、manual/open 固定值、父子及 post-record 事务回滚。
- pending/active/无 Goal 合法，terminal/rescheduled/paused/ended 拒绝；TodaySelection 有无均不影响合法性。
- FakeClock 跨午夜两个选择、缺失确认零写入；关闭连接后同一临时数据库重开并比较详情/列表。

### 11.3 IPC

- 三 Command、两 Query 的受信 sender 正常；伪造 sender/origin 全拒绝。
- 缺字段、未知字段、错误类型/枚举、负数/小数分钟、空白文本、Renderer 日期和非法 post-record 拒绝。
- 伪造、失效、已消费及 sender/Action 不匹配 context 零写入；reload/navigation、window/sender 销毁与退出清理可验证。
- Preload API 冻结且只暴露 records 白名单方法；错误不泄露内部信息或用户正文。

### 11.4 E2E 与人工

- 从 Today 和 Action 详情进入记录：仅快速层保存；再保存含理解、困惑、下一步与 note 的深入记录。
- 覆盖 partial/stopped/0 分钟默认保持 pending，以及独立显式 post-record Action/当前下一步变化。
- 覆盖跨午夜确认、取消/reload 后旧 context 不可复用、未选入 Today 的合法 Action 仍可记录。
- 完全关闭 Electron 与 SQLite，以同一隔离 `userData` 重开并复核详情/列表；AI 保持未配置。
- 项目所有者执行第 10.13 条体验验收；未执行时必须记录为 `pending`。

### 11.5 命令

仅在实现和本地验证另获授权后执行：

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
```

`verify` 包含 build 和 Electron E2E，但不证明依赖安装、package/NSIS、hosted CI、人工验收或完整 AC-01。证据必须绑定最终 revision、Windows/Node/Electron 环境、隔离数据根、真实命令结果与已知缺口。

## 12. Git、GitHub、依赖与外部操作权限

- [x] 创建本地任务分支 `task/T013-action-record`。
- [x] 创建分步本地提交。
- [x] push 任务分支。
- [x] 创建或更新到 `dev` 的 Draft PR。
- [ ] 标记 Ready、merge 到 `dev`、创建或合并 `dev → main`、tag 或 release。
- [ ] 执行 `npm install`、`npm ci` 或其他依赖安装；新增或升级依赖。
- [x] 修改项目所有者批准的任务状态、验收证据与收口文档；创建独立收口提交并 push。
- [ ] 网络访问、live AI、真实用户数据写入、migration、破坏性操作或其他外部写入。

以上已勾选的 Git/GitHub 与文档收口操作已由项目所有者明确授权；其余未勾选操作继续禁止。依赖安装和其他外部写入仍需针对确切范围另行授权。

## 13. 风险与停止条件

主要风险：

- context 清理遗漏会允许跨页面、跨窗口或已消费 token 重放；过早消费则会破坏跨日确认重试。
- begin 后 Action/Goal 状态改变，若保存时不复核会绕过 S1-Q10-A。
- outcome、Action 状态与下一步 UI 若耦合，会把 completed/partial/stopped 误当成生命周期授权。
- 父子实体或 post-record 分步写入会留下半记录；跨午夜静默选日会破坏历史事实。
- 记录列表若顺手加入聚合、修改/删除或解决入口，会提前吞并 T014/T031。
- 只刷新 Renderer 或复用内存连接不是真实关闭重开证据。

发现以下任一情况，立即停止受影响设计/实现并报告：

- MUST、D-006/103/104/105/106、ED-012/015/016/017、已批准 S1-Q03-B/Q04-B/Q07-A/Q08-B/Q10-A 或现有 schema 冲突；
- 需要新增/升级/安装依赖、新 migration、修改 schemaVersion 或 `001_initial.sql`；
- 需要扩大文件范围、任务状态、Git/GitHub、文档收口或外部写入权限；
- 需要任意历史日期入口、记录改删、Understanding 撤销、Confusion 解决、Progress、Routine、Recovery、AI 或其他 S2～S7 能力；
- 测试会访问真实 Electron `userData`，或无法为最终 revision 产生 context、事务、跨午夜与真实关闭重开证据。

## 14. 完成报告要求

完成报告必须简短列出：实际变更文件；FR-A05/A08、FR-L01～L06/L08、FR-C01、D-006/103/104/105/106、ED-012/015/016/017 与 AC-01 步骤 4～5 的覆盖边界；实际命令、环境、revision 与证据；人工验收状态；依赖/schema/migration 不变证明；残余风险和未验证项；是否发现需求冲突或范围变化。必须明确 FR-L07、FR-L09、FR-C04 与完整 AC-01 仍由后续任务完成。

## 15. 实际交付证据

- **实现 revision**：`b10d5d40c4c1dc1f7a20801d5d904b1d37953270`；分支 `task/T013-action-record`；Draft PR #10 指向 `dev`。
- **自动验证**：本地 `npm.cmd run verify` 通过，包含 66 项 unit、33 项 integration、build 与 5 项 Electron E2E；1 项 package smoke 按既有 opt-in 条件跳过。独立复核无未解决重大问题。
- **Hosted CI**：实现 head 的 Windows required gate run `31613036396` / job `94168900557` 为 `success`；失败 run `31609393753`、`31612362422` 的 E2E 问题已修复并由成功 run 取代。
- **人工验收**：项目所有者于 2026-08-12 按第 10.13 条清单报告通过。
- **边界**：`EV-T013-001` 只声明本合同范围与 AC-01 步骤 4～5；T012+T013 合并完成 FR-A05。FR-L07、FR-L09、FR-C04、完整 AC-01、S1/G3、Ready 与 merge 均未由 T013 声明。
- **不变证明**：无依赖、lockfile、schemaVersion、migration 或 `001_initial.sql` 变化；未发现需求冲突或范围变化。

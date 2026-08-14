# T021 Routine 生命周期、星期节奏与 Today 计划项任务合同

> 合同状态：**已完成；项目所有者于 2026-08-14 批准合同与补充文件范围、通过人工验收并批准文档收口；证据为 `EV-T021-001`**
>
> 拟启动基线：`dev@a708d7fce40cb43f8da78dd86bbed4f2bcd35084`（2026-08-14 已通过 `git ls-remote origin refs/heads/dev` 核验为最新 `origin/dev`）
>
> 当前权限：允许 T021 范围内实现、独立 worktree/任务分支、分步本地提交、推送及到 `dev` 的 Draft PR；Ready、merge、`main`、tag、release 和文档收口仍受后续门禁约束
>
> 2026-08-14 文件范围补充批准：为在既有冻结 `MyTracerApi` 中增加窄 `window.myTracer.routines` 命名空间，允许修改 `src/contracts/shell.ts`；该补充不改变产品语义、依赖、schema、migration 或其他权限。

## 1. 任务信息

- **Task ID**：T021
- **Title**：Routine lifecycle, weekday schedule, and Today planned items
- **Slice / Plan item**：S2 / E2-01
- **Task ledger status**：`active`
- **Base branch / revision**：`dev@a708d7fce40cb43f8da78dd86bbed4f2bcd35084`
- **Expected branch**：`task/T021-routine-lifecycle`
- **Task worktree**：`.tmp/T021-worktree`，从上述最新 `dev` revision 创建
- **前置事实**：S1/T011～T014/T801 已完成并由 `EV-G3-S1-002` 证明；S2 整体设计已合入 `dev`；S2-Q01-A、Q02-A、Q03-A、Q07-A、Q10-A 已批准。

## 2. 目标结果

在不改变 S1 Goal、Action、Today focus、ActionRecord 与 Progress 语义的前提下，交付 Routine 的最小完整纵向路径：

- 用户可以创建、修改、pause、resume、end Routine；新建为 `active`，`ended` 为终态，pause/end 保留 ID、关联、星期集合和全部历史 RoutineRecord；
- Routine 创建时可选关联一个 Goal，也可独立存在；T021 不提供 Goal reassign；
- 用户以非空 ISO weekday 集合定义当前节奏，以非空自然语言定义 `minimumAction`；“每天”“工作日”只在输入层展开为集合；
- 创建 Routine + 完整 schedule、整组替换 schedule 分别在单事务内原子完成，失败产生零变化；
- 用户可以通过 `ListRoutines`、`GetRoutineDetail` 查看 Routine 当前状态、可选 Goal 摘要、星期集合与最低行动；
- Today 在 Main 的可信 LocalDate 上，只读展示 `active` 且当前星期匹配的 Routine 基础项，包括身份、`minimumAction`、可选 Goal 摘要及状态、计划匹配和 `canRecord=true`；
- Goal paused/ended 不自动改变或隐藏 active Routine；Today 继续显示并标注 Goal 状态；
- 完全关闭 SQLite/Electron 后，从同一隔离测试数据根重开，Routine、schedule、生命周期和 Today 投影保持一致。

T021 只贡献 AC-03 步骤 1～2，不创建 RoutineRecord，不实现五种记录语义，不声明 AC-03 完成。

## 3. 需求与设计依据

- **FR**：FR-R01～FR-R03、FR-T02；FR-D01 的 Routine 重开子集。
- **AC**：AC-03 步骤 1～2，仅贡献覆盖；不得声明完整通过。
- **D**：D-003、D-009、D-016、D-106；D-008～D-010 仅作为历史与非范围守恒约束。
- **ED**：ED-006、ED-009；横切遵守 ED-003、ED-004、ED-008、ED-015、ED-017、ED-018、ED-019。
- **GW**：GW-001～GW-004、GW-008～GW-010。
- **已批准 S2 决定**：S2-Q01-A、S2-Q02-A、S2-Q03-A、S2-Q07-A、S2-Q10-A。
- **直接相关架构章节**：
  - `PRODUCT_REQUIREMENTS_V0.1.md` §5.3、§6.5～6.6、§7.1、§8 F-04/F-05、§9.3～9.4、§12 AC-03；
  - `DECISIONS.md` D-003、D-009、D-016、D-106；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-003/004/006/008/009/015/017/018/019；
  - `DOMAIN_MODEL_V0.1.md` §1～2、§5、§6.2～6.4、§8～10；
  - `DATA_DESIGN_V0.1.md` §2～6、§8、§10～12；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §5.1～5.5、§6～7、§11～12；
  - `S2_ROUTINE_INTENTION_DESIGN_V0.1.md` §0～8.1、§9～14，重点 §4.1～4.4、§5.1、§6、§7、§8.1、§11～13；
  - `TEST_STRATEGY_V0.1.md` §2～6、§7 E2E-AC-03、§8～10；
  - `REQUIREMENTS_TRACEABILITY_V0.1.md` §2.3～2.4、§4～5；
  - `IMPLEMENTATION_PLAN_V0.1.md` §1～2、E2-01、§11～12；
  - `TASK_INDEX_V0.1.md`、`TASK_TEMPLATE.md`、`GITHUB_WORKFLOW_V0.1.md`；
  - `archive/S1_T011_T014_ARCHIVE.md` 与 `EV-G3-S1-002` 所记录的 S1 最终基线。

`user/` 不属于本合同依据，不得成为实现、测试或验收依赖。

## 4. 开始条件与审批门

已核验：

- [x] 远端最新 `origin/dev` 与本地 `dev` 均为 `a708d7fce40cb43f8da78dd86bbed4f2bcd35084`，工作树在合同起草前干净。
- [x] S2 设计已通过 PR #16 合入该 revision，且包含 T021 阶段级实现授权与批准的 S2-Q01-A/Q02-A/Q03-A/Q07-A/Q10-A。
- [x] S1 最终自动化与人工 AC-01 验收已通过，最终行为证据为 `EV-G3-S1-002`；后继至当前基线仅有文档变化。
- [x] v1 schema 已预建 `routines`、`routine_schedule_days`、`routine_records` 及所需 FK/CHECK/UNIQUE；T021 不需要 migration。
- [x] 现有 Node `24.18.0`、Electron `43.3.0`、测试与验证命令已经固定；无需新增/升级依赖。
- [x] 起草时未发现 MUST、已批准 D/ED、S2 决定、v1 schema 或 S1 已验收契约冲突。

开始实现前仍必须满足：

- [x] 项目所有者明确批准本合同全部范围、文件、验证、依赖、数据与 Git/GitHub 权限。
- [x] 项目所有者的批准明确激活 T021；已从上述 revision 创建独立 worktree/分支并把任务账本改为 `active`。
- [x] worktree 创建后再次核验 HEAD、`git status`、worktree 列表、无重叠任务和无用户自有修改。
- [x] 批准前已重新核验 `origin/dev`，revision 未变化。

## 5. 允许的实现行为

### 5.1 Domain / Application

- 新增 Routine 实体、值对象与状态机：`active → paused/ended`、`paused → active/ended`；其余转换拒绝；`ended` 为终态。
- 新增 ISO weekday 类型/校验及纯 `LocalDate → 1..7` helper；不得使用 UTC 日期或由 Renderer 计算可信星期。
- weekday 集合必须包含 1～7 个唯一整数；输入层快捷项 `daily`/`weekdays` 仅展开为 `{1..7}` / `{1..5}`，不得持久化新 schedule 类型。
- 实现 `isPlannedOn(routine, localDate)` 纯函数；不得创建、预生成或补齐 Record。
- 实现 `CreateRoutine`、`UpdateRoutineDetails`、`ReplaceRoutineSchedule`、`PauseRoutine`、`ResumeRoutine`、`EndRoutine`。
- 实现只读 `ListRoutines`、`GetRoutineDetail`；列表状态过滤必须明确，详情返回 Routine、可选 Goal 摘要、完整星期集合和最低行动。
- 增量扩展 `GetToday`，保留 S1 的 `localDate/focuses/availableActions` 字段和含义，仅新增 `plannedRoutines[]`。

### 5.2 Repository / SQLite / 事务

- 复用 `schemaVersion=1` 和现有表；只增加意图级 Repository 查询、完整 schedule 读取/替换和 Routine 事务编排。
- `CreateRoutine` 在一个 `UnitOfWorkPort.transaction` 内保存 Routine + 完整 schedule；任何验证、FK、唯一或写入故障均零变化。
- `ReplaceRoutineSchedule` 先验证完整集合，再在一个事务中整组替换；任何删除/插入故障均恢复旧集合。
- 生命周期命令在一个事务中读取、校验并更新当前 Routine；不得删除或改写 schedule/Record。
- schedule 或 `minimumAction` 修改不得更新任何 `routine_records.planned_for_date` 或历史 outcome。
- Query 只读，不触发 migration、不创建 TodaySelection、不生成 RoutineRecord、不补 unknown 行。

### 5.3 IPC / Preload / Renderer

- 为每个 Routine Command/Query 使用固定 channel；复用 sender/origin 校验并做严格运行时 DTO 校验。
- 拒绝空白 name/`minimumAction`、非法/重复/空 weekday、未知多余字段、非法 UUID、非法状态转换及伪造 Goal 状态；错误返回稳定 code 和中性消息，不泄露 SQL、堆栈、路径或用户正文。
- Preload 只增加冻结的 `window.myTracer.routines` 具体方法并兼容扩展 `today.get` DTO；不暴露 `ipcRenderer`、channel、SQL、数据库路径、文件能力、Clock 或 Electron 对象。
- Renderer 提供最小 Routine 列表/详情、创建/修改、pause/resume/end、星期选择及每天/工作日快捷输入，并在 Today 展示计划 Routine。
- Today 的 `plannedRoutines[]` 显示 Routine identity/name/`minimumAction`、当前星期匹配、可选 Goal 名称和 `active|paused|ended` 状态、`canRecord=true`；T021 不显示/保存 RoutineRecord outcome 或 `recordState`。
- Goal paused/ended 时 active Routine 仍显示且可操作；不得由 Query 或 UI 自动 pause/end Routine。

## 6. 精确文件范围

批准后仅允许新增或修改下列文件；发现必须扩大范围时先停止并申请批准。

**Task contract / evidence ledger**

- `docs/implementation/T021_ROUTINE_LIFECYCLE_TASK.md`
- `docs/implementation/TASK_INDEX_V0.1.md`（仅在合同批准后记录 `active/review/done` 的真实状态）
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`（仅从真实结果记录 `EV-T021-001`）

**Domain / Application / Contracts**

- `src/domain/routine.ts`（新增）
- `src/domain/local-date.ts`
- `src/domain/index.ts`
- `src/application/routines.ts`（新增）
- `src/application/ports/persistence.ts`
- `src/application/today.ts`
- `src/contracts/routines.ts`（新增）
- `src/contracts/shell.ts`（仅把新增 `RoutineApi` 纳入冻结顶层 `MyTracerApi`）
- `src/contracts/today.ts`

**SQLite / Main / Preload / Renderer**

- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/routines-ipc.ts`（新增）
- `src/main/today-ipc.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

**Tests**

- `tests/unit/routine-domain.test.ts`（新增）
- `tests/unit/routine-application.test.ts`（新增）
- `tests/unit/local-date.test.ts`
- `tests/unit/today-application.test.ts`
- `tests/integration/routine-sqlite.test.ts`（新增）
- `tests/integration/routine-ipc.test.ts`（新增）
- `tests/integration/main-foundations.test.ts`（仅如顶层 Preload/API 白名单断言需要）
- `tests/e2e/routine-lifecycle.e2e.test.ts`（新增）
- `tests/e2e/shell.e2e.test.ts`（仅兼容扩展白名单/API 冻结回归）
- `tests/e2e/windows-package-smoke.e2e.test.ts`（仅兼容扩展白名单/API 冻结回归；不要求 T021 运行 package smoke）

`src/infrastructure/sqlite/migrations/001_initial.sql` 仅可只读核验，不在允许修改范围。`package.json`、lockfile、构建配置、CI、PRD、DECISIONS、架构基线和 `user/` 均不在本任务实现修改范围。

## 7. 明确非范围

- RoutineRecord 创建或修改；`target_met`、`acted`、`intentional_rest`、`not_done`、`unknown` 的 T022 记录/投影语义；
- Routine Progress 分支、统一真实行动次数、计划日达成统计或 AC-03 完整路径；
- Action intention、focus/intention 转换或 AC-04（T023）；
- Routine 的 Goal reassign、Goal 自动联动、隐藏默认 Goal 或历史 Goal snapshot；
- Routine/Goal/Action/Record 硬删除、影响预览、二次确认、级联 UI；
- FR-R08 常规补记/修正/删除，以及修改历史 `occurredOn`；
- schedule/`minimumAction` 历史版本、历史空白计划日重建、完成率、失败率、streak 或惩罚评价；
- 提醒、通知、时间段、隔周、每 N 天、任意表达式、复杂日历、自动排程或通用规则引擎；
- Recovery、Review、AI、导出/导入及 S3～S7；
- 新用户可见一级概念、兴趣/休息/学习/健康专属模块；
- 新增/升级依赖、任何 migration、修改 `001_initial.sql`、schemaVersion 或真实用户数据操作；
- package/NSIS 验证、Ready、merge、`dev → main`、tag、release、branch protection、Actions secrets 或远端设置变更。

## 8. 必须保持的不变量

1. Routine 新建为 active；ended 为终态；pause/end 只更新当前状态，保留 ID、goalId、schedule 和全部历史 RoutineRecord。
2. Routine `goalId` 可空且仅在创建时确定；T021 不提供 reassign。Goal pause/end 不自动改变 Routine。
3. schedule 是 1～7 个唯一 ISO weekday 的非空集合；每天/工作日只是快捷输入，不成为存储类型。
4. Routine + schedule 创建、schedule 整组替换均为单事务；任一失败零变化。
5. schedule 不预生成记录；缺少 RoutineRecord 仍是未知事实，但 T021 不实现或宣称其五态 UI。
6. schedule/`minimumAction` 修改不重写既有 `plannedForDate`、outcome、occurredOn 或任何历史 Record。
7. Today 只由 Main 在每个 Query 开始读取一次的可信 `ClockPort.snapshot()`、Routine 当前状态和星期集合派生；Renderer 不提供可信日期/星期。
8. Query 零写入；Routine 不写 `today_selections`；跨日刷新只重建当前投影，不移动历史。
9. S1 `TodayView.localDate/focuses/availableActions`、`selectedForToday`、ActionRecord 和 Progress 公式/排序/筛选语义保持不变。
10. Renderer 无 Node、SQLite、文件、凭据、Provider、Clock、任意 IPC 或 Electron 对象；所有写入经 Application Command/Domain 不变量。
11. 自动化只使用 FakeClock、每 case/进程唯一临时 SQLite 与 Electron `userData`；不得访问、迁移或清理真实用户数据。
12. T021 不声明 FR-R04～R09、FR-P02 Routine 分支、完整 FR-D01、完整 AC-03 或 AC-07 完成。

## 9. 交付物与验收标准

1. Routine 创建、修改、pause、resume、end、列表和详情在 Renderer → Preload → Main/Application → Domain/SQLite 真实路径可观察。
2. 创建 Routine + 完整 schedule 原子成功；每个故障注入点均证明没有孤立 Routine 或半集合。
3. schedule 非空、去重、1～7 与 ISO 映射正确；每天/工作日快捷项只展开为集合；非法输入在 Domain/Application/IPC 均被拒绝且零写入。
4. `ReplaceRoutineSchedule` 原子整组替换；失败保留旧集合；成功只影响当前/未来 Today 匹配，不修改任何历史 RoutineRecord `plannedForDate` fixture。
5. 生命周期合法/非法转换、ended 终态、pause/end 历史守恒在领域、应用、SQLite 和 IPC 层有证据。
6. 可空 Goal 关联工作；不存在 Goal 被拒绝；Goal paused/ended 不自动改变 Routine，active 且当日匹配时 Today 继续显示 Goal 状态并返回 `canRecord=true`。
7. `ListRoutines` 状态过滤明确；`GetRoutineDetail` 返回当前 Routine、可选 Goal 摘要、完整星期集合；重复 Query 前后数据库 snapshot 相同。
8. Today 只列 active 且当前 ISO weekday 匹配的 Routine 基础项；paused/ended 或不匹配项不列出；不写 TodaySelection、不创建 RoutineRecord。
9. 完全关闭 SQLite/Electron 后从同一隔离数据根重开，Routine、schedule、状态、Goal 摘要和 Today 结果一致；AI 未配置不影响路径。
10. S1 的 Today、ActionRecord、Progress、Preload 安全与 package API 契约回归通过；无新依赖、无 migration、`001_initial.sql`/schemaVersion 不变。
11. 最终 diff 仅含批准范围；完成 diff 自查、独立只读 review、目标验证、完整 `verify` 和最新 Draft PR head hosted Windows required gate。
12. 证据只声明 FR-R01～R03、FR-T02、FR-D01 Routine 子集及 AC-03 步骤 1～2贡献；项目所有者未执行 T021 人工验收时标为 `pending`。
13. **MANUAL**：项目所有者确认 Routine 创建/星期快捷输入足够轻，pause/end 表达为保留历史而非删除/失败，Today 的 Goal 非 active 标注和可操作性符合 S2-Q07-A；实际执行前保持 `pending`。

## 10. 验证计划

### 10.1 针对性验证

```powershell
npm.cmd exec -- vitest run --project unit tests/unit/routine-domain.test.ts tests/unit/routine-application.test.ts tests/unit/local-date.test.ts tests/unit/today-application.test.ts
npm.cmd exec -- vitest run --project integration tests/integration/routine-sqlite.test.ts tests/integration/routine-ipc.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd exec -- playwright test tests/e2e/routine-lifecycle.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/action-record.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

若某现有回归文件未受实际接口变化影响，可在证据中说明未单独列入目标命令，但完整 `verify` 仍必须覆盖全部测试。

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

`verify` 已包含 build 与 Electron E2E；它不证明 package/NSIS、hosted CI、人工验收或 merge。T021 不要求 `npm ci`、安装、package 或 live AI。

### 10.3 必测矩阵

- 生命周期：所有合法/非法转换、重复转换、ended 终态、pause/end 前后历史集合守恒；
- schedule：周一/周日、跨月/跨年、1～7、空/重复/越界、每天/工作日展开、创建/替换逐故障回滚；
- LocalDate：FakeClock 固定日期，Main 单次 snapshot，Renderer 无可信日期/weekday 输入；
- Goal 接缝：null/active/paused/ended/nonexistent Goal；非 active Goal 不改变 Routine，Today 标注且 `canRecord=true`；
- Today：匹配/不匹配、active/paused/ended、Query 重复零写入、不生成 schedule/Record/TodaySelection 行；
- 历史 fixture：替换 schedule 和修改 `minimumAction` 前后既有 RoutineRecord `plannedForDate`/outcome/occurredOn 完全不变；
- 重开：关闭连接/Electron，再从同一隔离临时数据库/`userData` 启动，不复用内存实例；
- S1 回归：Today focus、availableActions、ActionRecord、Progress、Preload 冻结与 Renderer 隔离保持原语义。

### 10.4 验证环境与证据

- **OS**：Windows（当前环境与 hosted `windows-2025` gate）
- **Node / npm**：`24.18.0` / `11.16.0`
- **Electron**：`43.3.0`
- **Clock**：自动化使用 FakeClock；不依赖真实当天
- **Data root**：每 case/进程唯一临时目录；E2E 使用唯一临时 Electron `userData`
- **AI**：未配置或 fake；不得使用 live Provider
- **Source revision**：每次证据记录确切 commit/PR head 或明确 uncommitted timestamp
- **Evidence**：`EV-T021-001` 绑定命令、环境、结果、artifact/CI URL、限制和 manual 状态

## 11. Git、GitHub、依赖与外部操作权限

项目所有者于 2026-08-14 批准本合同时同时授权：

- [x] 从核验后的最新 `dev` 创建独立 T021 worktree 和 `task/T021-routine-lifecycle` 分支。
- [x] 在批准文件范围内实施并创建按 Domain/Application、Persistence/IPC、Renderer/E2E 等有意义检查点拆分的本地提交。
- [x] 推送 `task/T021-routine-lifecycle`。
- [x] 创建并更新到 `dev` 的 Draft PR，维护 Task/Goal/Requirements/Scope/Exclusions/Changes/Verification/Evidence/Risks/Dependency changes。
- [x] 在每个实现候选和最终文档 head 等待并读取 required hosted CI；按批准范围修复失败后重新推送。
- [x] 在首个实现候选 green CI 后，按 `mytracer-stage-development` skill 提交精确文档影响矩阵并再次请求文档收口、独立 docs commit 与 push 授权。
- [ ] Draft → Ready 仍须项目所有者另行授权。
- [ ] Agent 不得 merge 到 `dev`，不得创建或合并 `dev → main` PR，不得创建 tag/release，不得 force-push 或删除远端分支。

依赖与外部操作：

- **新增/升级依赖**：无；`package.json` 和 lockfile 不得修改。
- **安装**：不授权 `npm install`/`npm ci`；使用现有依赖。若现有工作树缺依赖，停止并申请授权。
- **Network**：仅已授权的 Git 远端核验、任务分支 push、Draft PR/CI/review 读写；不访问 live AI 或其他外部服务。
- **AI Provider**：无 / fake；不得使用真实密钥。
- **External writes**：仅上述 task branch、Draft PR 与其 CI；Ready/merge/配置变更不授权。
- **Data operations**：仅隔离临时测试数据；无真实用户数据写入、迁移、删除或破坏性操作。

未勾选/未由项目所有者明确批准的条款不得执行。若项目所有者缩窄权限，以其明确回复为准并同步本合同后再启动。

## 12. 风险与停止条件

主要风险：

- 现有 `RepositoryPort` 已有通用 `saveRoutine/saveRoutineScheduleDay`，但没有意图级 find/list/replace；若直接暴露或复用 upsert，可能绕过非空集合与整组原子替换。
- SQLite 无法单表保证 schedule 至少一行；必须由 Domain/Application + 单事务保证。
- weekday helper 若借助 UTC/system Date 或 Renderer 计算，可能在时区/午夜处产生错误 Today 项。
- Goal 与 Routine 生命周期若被隐式联动，会反向改变 S1 Goal 命令并违反 S2-Q07-A。
- Today DTO 扩展及顶层 `routines` API 会影响精确白名单/package smoke 回归；只能兼容增加，不能重解释 S1 字段。
- T021 使用现有 RoutineRecord fixture 证明历史守恒时，不能顺手实现 T022 outcome/unknown UI 或 Progress。
- S1 Progress E2E 曾有一次不可稳定复现的首屏 0/0 风险；不得用固定 sleep 掩盖，必须等待可观察事实并报告任何复现。

发现以下任一情况，立即停止受影响工作并报告：

- MUST、已批准 D/ED、S2-Q01-A/Q02-A/Q03-A/Q07-A/Q10-A、S1 契约或实际 v1 schema 冲突；
- 需要新增/升级依赖、任何 migration、修改 `001_initial.sql`/schemaVersion 或执行真实数据操作；
- 需要 Goal reassign、RoutineRecord、Progress Routine 分支、Action intention、删除、补记/修正、提醒、复杂节奏、Recovery/Review/AI 或其他非范围能力；
- 无法保证 Query 零写入、创建/替换原子性、历史 `plannedForDate` 守恒、Renderer 日期不可信或测试数据隔离；
- `origin/dev` 新增变化导致基线、接口、schema、依赖或文件范围漂移；
- 需要扩大文件范围、Git/GitHub/外部写入权限，或无法产生可靠验收证据。

## 13. 文档收口门禁

实现、目标验证、完整 `verify`、最终 diff 自查、独立只读 review 和首个 Draft PR head required CI 全部通过后，先停止并向项目所有者提交文档影响矩阵。至少评估：

- 本合同；
- `TASK_INDEX_V0.1.md`；
- `ACCEPTANCE_EVIDENCE_V0.1.md`；
- Draft PR 正文；
- README、实施计划、S2 设计、需求追踪与 `user/` 是否仅需事实性派生更新。

未经该次精确批准，不执行最终文档收口 commit/push；PR 最新 head 的 required CI 未通过前不建议 Ready。PR 发布后，除非项目所有者明确释放、请求修改或完成 merge，按 skill 进入监控而不自行合并。

## 14. 完成报告要求

报告必须使用中文并列出：

- 本合同文件、批准状态、启动基线、任务分支/worktree、commit、Draft PR、CI 与 revision；
- 实际新增/修改文件和可观察结果；
- FR-R01～R03、FR-T02、FR-D01 Routine 子集、D/ED/S2-Q 与 AC-03 步骤 1～2贡献；
- 每条实际验证命令、Windows/Node/Electron/临时数据环境、结果与 artifact；
- 自动化、独立 review、hosted CI 和项目所有者 MANUAL 状态；
- 依赖/schema/migration/`001_initial.sql` 不变证明；
- 残余风险、已知缺口、跳过/未验证内容和后续 T022 边界；
- 是否发现需求冲突、范围变化、权限变化或 S1 回归。

不得把实现存在、本地测试通过、Draft PR 创建或 AC-03 步骤 1～2贡献称为 T021/AC-03 完整完成；只有合同定义的全部自动门禁、批准的文档收口和最终 head CI 有真实证据时，才能按账本定义更新 T021 状态。

## 15. 实际交付收口

- **启动基线**：`dev@a708d7fce40cb43f8da78dd86bbed4f2bcd35084`；任务分支 `task/T021-routine-lifecycle`；隔离工作树 `.tmp/T021-worktree`。
- **实现与测试 revision**：`07c626739b454378f8af886c1d233da6f0bd97e6`；分为合同激活、Routine Domain/Application/SQLite、IPC/Renderer/E2E 和 Goal ended 接缝强化四个可审查提交。
- **Draft PR**：[#17](https://github.com/Fyrefly-4/MyTracer/pull/17)，base `dev`；实现候选 Windows required gate run `31775295481` / job `94689380685` 通过。
- **本地验证**：定向 Routine/LocalDate/Today unit 32 项通过；定向 Routine SQLite/IPC/Main integration 7 项通过；Routine lifecycle + shell Electron E2E 2 项通过；实现候选 `npm.cmd run verify` 通过 84 项 unit、45 项 integration、7 项 Electron E2E，opt-in package smoke 1 项按设计跳过。
- **审查**：完整任务 diff、批准文件白名单、schema、`001_initial.sql`、依赖/lockfile 和 S1 Today/ActionRecord/Progress 回归已复核；独立只读复核发现的 Goal/Routine 状态类型别名与 ended 编辑语义问题已在实现候选前修正，最终无未解决 finding。
- **人工验收**：项目所有者于 2026-08-14 按 T021 人工测试方法执行并明确报告“人工验收：通过”；创建/星期快捷输入、Today 计划表达、Goal 生命周期独立性、Routine 生命周期、关闭重开及中性文案均纳入该清单。
- **范围与限制**：没有需求冲突、未批准范围扩大、新依赖、migration、schemaVersion、`001_initial.sql` 或真实用户数据变化。T021 完成 FR-R01～R03、FR-T02 与 FR-D01 Routine 重开子集，只贡献 AC-03 步骤 1～2；RoutineRecord 五态、Routine Progress 和完整 AC-03 仍属于 T022。
- **证据**：完整环境、命令、结果、CI、人工状态和限制记录于 `EV-T021-001`。PR Ready、merge、`dev → main`、tag 和 release 均未授权。

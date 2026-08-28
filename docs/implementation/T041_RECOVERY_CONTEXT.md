# T041 RecoveryContext 查询任务合同

> 任务类型：implementation
>
> 合同状态：**active**；项目所有者于 2026-08-28 批准并激活 T041，授权合同范围内开发、本地提交、任务分支 push 与到 `dev` 的 Draft PR
>
> 执行模式：`standard-task@1`，有效期 30 天，无附加约束；docs closeout、Ready、merge、tag 和 release 仍须另行批准

## 1. 任务信息

- **Task ID**：T041
- **Title**：RecoveryContext 查询
- **Slice / Plan item**：S4 / E4-01
- **Status**：active
- **Base branch**：`dev`
- **Latest verified dev revision**：`dev@22ee97bd9ded88e6e9e025d3afc0c6831d43240c`
- **Remote-tracking check**：合同编写时本地 `dev` 与 `origin/dev` 均为 `22ee97bd9ded88e6e9e025d3afc0c6831d43240c`，ahead/behind 为 `0/0`
- **Latest product-behavior revision**：`dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3`；从该 revision 到当前 `dev` 无 `src/`、`package.json` 或 `package-lock.json` 差异
- **Expected branch name**：`task/T041-recovery-context`；只固定名称，不构成创建授权

## 2. 目标结果

用户从 Goals 显式进入某个 Goal 的最小只读 Recovery 页面，可以查看：

- 此前真实行动中的最近事实；
- 未撤销的确认理解；
- 当前仍开放的困惑；
- 当前下一步和同 Goal 的 pending Actions；
- `lastRealActionOn` 与可空的 `daysSinceLastRealAction` 中性事实。

整个路径由 Main 在 Query 开始时读取一次 Clock snapshot，以 Goal 为中心读取一个一致性 Repository snapshot，并经 `GetRecoveryContext`、固定 IPC 和窄 Preload API 返回 Renderer。查询、重复查询、页面进入、取消/离开和应用重开均不得写业务数据、补 Record 或改变任何 Goal、Action、Routine、TodaySelection、Understanding、Confusion 或 ReviewResult 状态。

T041 只提供 AC-05 步骤 1～4 所需的只读上下文与安全输入；暂停/结束过时内容、选择新的小 Action 和完整 AC-05 属于 T042。

## 3. 需求与设计依据

- **直接 FR**：FR-REC01、FR-REC02、FR-REC03。
- **直接 AC**：AC-05 步骤 1～4贡献；不声明步骤 5或完整 AC-05。
- **直接 D**：D-002。
- **回归依据**：
  - FR-P03、FR-P04；D-007、D-009、D-010：确认理解、开放困惑、事实展示、unknown/rest 非评价语义；
  - FR-R04～FR-R09；D-008～D-010、D-107：Routine 四种显式 outcome、缺行 `unknown`、非计划日和真实行动计次保持；
  - D-106；ED-012、ED-013、ED-017：Main Clock、LocalDate、0 分钟真实行动、无停滞阈值和跨日历史；
  - ED-004、ED-019：Main-only 数据访问、窄 Preload、固定 IPC 和 sender/origin 校验；
  - AC-01、AC-03、AC-04、AC-07：受影响范围回归，不重新声明既有 AC 完成。
- **明确不交付的 SHOULD**：FR-P05 仍在 S7；单 Goal 的 N 天事实不形成跨 Goal 停滞识别、筛选、排序、阈值或 FR-P05 完成声明。
- **直接相关架构章节**：
  - `ARCHITECTURE_V0.1.md` §4～§6、§9；
  - `DOMAIN_MODEL_V0.1.md` §3.3、§6、§7.1～§7.2、§8～§10；
  - `IMPLEMENTATION_PLAN_V0.1.md` §7 E4-01 与 §10.1；
  - `TEST_STRATEGY_V0.1.md` §1～§6、§7 E2E-AC-05、§8～§10；
  - `REQUIREMENTS_TRACEABILITY_V0.1.md` §2.7、§2.9、§4～§5；
  - `S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md` §0～§8、§9.1、§10～§13、S45-Q01-A、S45-Q02-A、§15～§17。

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
        - 2. Baseline manifest 与冲突核对
        - 3. Stage delta、目标与非范围
        - 4.1 Recovery：从识别到重新开始
        - 5.1～5.3 领域关系、长期未推进与 Routine 语义
        - 6.1 Recovery 日期
        - 7.1～7.2 Queries 与设计 DTO
        - 7.5 Repository ports
        - 8. IPC、Preload、Main 与 Renderer 安全边界
        - 9.1 Recovery 与 ReviewSummary
        - 10. Task graph、共享面与实施顺序
        - 11.1 T041 — RecoveryContext 查询
        - 12～13 分层验证与追踪
        - S45-Q01-A、S45-Q02-A
        - 15～17 风险、授权与阶段门
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
  implementation:
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/AUTOMATION_PROFILES_V0.1.md
    - docs/implementation/profiles/standard-task-v1.json
    - docs/implementation/T094_STRUCTURAL_UI_REFACTOR.md
```

## 4. 开始条件、依赖与 shared surfaces

### 4.1 当前已核实事实

- [x] S1 已完成，Goal、Action、ActionRecord、Understanding、Confusion、current-next 与 Progress 事实有实际 Evidence。
- [x] T022 已证明 Routine 四种显式 outcome、缺行 `unknown`、非计划日、跨日和重开语义。
- [x] S3 已完成数据修正/删除、完整导出和 AI 三态数据独立性；T041 不改变这些能力。
- [x] T094 已进入 `dev`，Goals/Recovery feature ownership 成立，T041 不需要重新设计 `App.tsx`、AppShell 或主导航。
- [x] 当前 `dev@22ee97b...` 包含项目所有者批准的 S4/S5 设计，且相对最近产品行为 revision 没有产品代码或依赖差异。
- [x] 当前 schemaVersion 仍为 2、exportVersion 仍为 1；T041 不需要 migration 或 export 变化。
- [x] 现有稳定验证命令和临时数据根/FakeClock 基础设施存在。
- [x] 项目所有者批准本合同、精确权限和 Automation Profile 选择。
- [x] 项目所有者明确授权启动 T041，任务状态已变更为 `active`。

```yaml
dependencies:
  tasks:
    requires: [T094]
    blocks: [T042]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T051]
  stage_prerequisites:
    - S1 completed and evidenced by EV-T014-001 and EV-AC01-001
    - Routine fact semantics evidenced by EV-T022-001
    - S3 data behavior evidenced by EV-T031-001 through EV-T033-001
    - Renderer ownership evidenced by EV-T094-001 and EV-PRE-S4-FOUNDATION-001
  revisions:
    required_dev_base: dev@22ee97bd9ded88e6e9e025d3afc0c6831d43240c
    prior_product_behavior_revision: dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3
  shared_surfaces:
    - repository-query-ports-and-sqlite-snapshot
    - progress-fact-definitions
    - main-composition-and-preload-api
    - goals-recovery-renderer-feature
    - electron-security-and-api-shape-tests
  external: []
```

T041 与 T051 同时扩展 Repository、Main、Preload 和 API contract；批准设计要求串行，当前不允许并行实施。

### 4.2 Automation Profile

```yaml
execution:
  profile: standard-task@1
  activated_at: 2026-08-28T12:05:32+08:00
  valid_until: 2026-09-27T12:05:32+08:00
  additional_constraints: []
```

项目所有者于 2026-08-28 明确选择并激活 `standard-task@1`，有效期 30 天且无附加约束。合同与 sidecar 使用相同 execution 参数；Profile 只允许已经授权的 local development、validation、task branch/Draft PR publication、同一 PR maintenance 和 review handoff，不解除任何 Repository Safety Gate。

## 5. 允许修改范围

### 5.1 合同编写阶段（已完成）

在项目所有者批准激活前，草案阶段仅允许：

- `docs/implementation/T041_RECOVERY_CONTEXT.md`
- `docs/implementation/metadata/T041.json`

该阶段未修改 `TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md`、生产代码、测试、配置、依赖或其他文档。2026-08-28 的 owner activation 已单独授权更新 `TASK_INDEX_V0.1.md` 并进入第 5.2 节实现范围；本历史边界不再阻止已授权实现。

### 5.2 当前获批实现范围

实现只允许修改或创建下列精确文件：

- `src/domain/recovery.ts`
- `src/domain/index.ts`
- `src/application/recovery.ts`
- `src/application/ports/persistence.ts`
- `src/contracts/recovery.ts`
- `src/contracts/shell.ts`
- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/recovery-ipc.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/goals/GoalsPage.tsx`
- `src/renderer/src/features/goals/RecoveryPanel.tsx`
- `src/renderer/src/styles.css`
- `tests/unit/recovery-domain.test.ts`
- `tests/unit/recovery-application.test.ts`
- `tests/integration/recovery-sqlite.test.ts`
- `tests/integration/recovery-ipc.test.ts`
- `tests/integration/main-foundations.test.ts`
- `tests/e2e/recovery-context.e2e.test.ts`
- `tests/e2e/shell.e2e.test.ts`

候选 CI 通过后的文档 impact matrix 必须评估本合同、metadata、`TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md` 和 Draft PR 正文；只有项目所有者批准精确 docs closeout scope 后才允许修改相应记录。

若实现必须修改上述列表之外的文件，先停止受影响工作并申请合同范围变更，不得用“必要接线”自行扩围。

## 6. 明确非范围

- 任何 Recovery mutation，包括 pause/end/complete/cancel/reschedule、设置 current-next、创建或选择小 Action、加入 Today、删除或数据修正。
- T042、Review、ReviewResult、T051、T052、S6、S7 或下一任务启动。
- AI Provider、AI 上下文、AI 建议、自动计划、对话、长期记忆或 AI 写权限。
- 自动入口、启动弹窗、后台检测、提醒、通知、返回事件或 Recovery 持久化状态。
- 固定/可配置停滞阈值、`stalled`、overdue、failure rate、完成率、score、mastery、streak、排名或人格评价。
- FR-P05 完成声明、跨 Goal 长期未推进列表、筛选、排序或自动标记。
- migration、schemaVersion、`review_results`、索引、exportVersion、export shape、导入或恢复。
- 新增、升级或移除依赖；修改 `package.json`、lockfile、构建、CI、workflow 或治理工具。
- 新增主导航或独立 Recovery 主视图；重构 `App.tsx`、AppShell、现有 feature ownership 或 Progress 页面。
- 修改任何 Goal、Action、Routine、Record、TodaySelection、Understanding 或 Confusion 的现有状态语义。
- Windows package、unpacked/NSIS smoke、完整 AC-05 人工验收和 S4 acceptance gate；这些不是 T041 单任务完成声明。

## 7. 必须保持的不变量

### 7.1 真实行动与日期

- 每条有效 ActionRecord 都是真实行动；`durationMinutes = 0` 仍有效。
- RoutineRecord 只有 `target_met` 和 `acted` 刷新真实行动日期；0 分钟或 `durationMinutes = null` 不否定有效 outcome。
- `intentional_rest`、`not_done` 和缺行 `unknown` 不刷新 `lastRealActionOn`。
- 无真实行动时 `lastRealActionOn` 与 `daysSinceLastRealAction` 均为 `null`；不得使用 Goal、Action、Routine 的 `createdAt`/`updatedAt` 或查询日代替。
- `lastRealActionOn` 取 Goal 关联 ActionRecord 与 `target_met`/`acted` RoutineRecord 的最大权威 `occurredOn`。
- Query 开始只读取一次 Main `ClockPort.snapshot()`；`asOfLocalDate` 使用该 snapshot 的 LocalDate，days-since 使用 LocalDate 差值，不使用 UTC Instant、系统 locale 或 Renderer 日期。
- 跨日或重开后重新 Query 可以令 `daysSinceLastRealAction` 随当前 LocalDate 变化，但历史 `occurredOn`、`lastRealActionOn` 和 Record 内容不得变化。

### 7.2 查询与数据守恒

- `RecoveryContextBuilder` 是 pure builder，不访问 Clock、SQLite、Electron、React、文件系统或网络。
- Repository 在一个 SQLite 只读 transaction 中返回 Goal 中心一致性 snapshot；不得用串行多次 IPC 或 Renderer 拼接事实。
- Query 不写数据、不补 ActionRecord/RoutineRecord、不把空白日写成 `not_done`、不建立 `unknown` 行、不保存缓存或 Recovery 状态。
- Query 不改变 Goal/Action/Routine 生命周期、current-next、TodaySelection、Understanding/Confusion 状态或 ReviewResult。
- Query 前后 `readCompleteCoreSnapshot()` 的 sourceDataVersion 与十个核心集合逐字段一致；重复调用、错误分支和重开同样守恒。
- 被撤销 Understanding 不进入 `confirmedUnderstandings`；resolved Confusion 不进入 `openConfusions`。
- 事实排序必须显式、稳定并以 LocalDate、createdAt 和 ID 打破并列；不得依赖 SQLite 隐含行序。

### 7.3 Electron 与 UI

- Renderer 只展示 Main 返回 DTO，不自行计算 days-since、真实行动、Routine outcome 或 unknown。
- 固定 API 为 `window.myTracer.recovery.getContext({ goalId })`；不暴露任意 channel、日期 filter、SQL、Repository、数据库/文件路径、Node、Electron 对象、凭据或 Provider。
- Main 必须校验 trusted sender/origin、恰好一个对象、精确 keys 和 UUID v4 `goalId`；Renderer 不得提交 `asOfLocalDate`、`lastRealActionOn` 或 `daysSinceLastRealAction`。
- 错误至少安全区分 `validation`、`not-found` 和 `persistence-failed`，不泄露 SQL、绝对路径或用户正文。
- Recovery 只能从 Goals 内对明确 Goal 显式进入；不新增主导航、不自动弹出。
- 页面使用中性事实和明确空状态，不显示 stalled/overdue/failure/score/streak/mastery 或压力式文案。
- AI disabled、not-configured 或 failure 不影响 Recovery 查询。

### 7.4 本任务局部风险

- ActionRecord 与 RoutineRecord 使用不同分钟 nullability，不能用分钟判断真实行动。
- 多 Record、同日并列和跨类型排序可能错误选择 last real action；必须有确定性 tie-break 测试。
- 将现有 Progress 公式复制到另一条 SQL/Renderer 路径会产生双真相；应复用 pure facts 定义，或在批准文件范围内复用相同 Repository facts 并做交叉断言。
- Goals feature 增加子流程不得改变 T094 已验收的 AppShell、导航和其他 feature ownership。

## 8. 交付物

- [ ] pure `RecoveryContextBuilder`、LocalDate 差值和稳定排序。
- [ ] `RecoveryRepositoryPort.queryRecoverySnapshot(goalId)` 与 SQLite 单事务只读实现。
- [ ] `GetRecoveryContext` Application Query，使用一次 Main Clock snapshot。
- [ ] `RecoveryContextDto`、固定 IPC channel、严格输入验证、trusted sender/origin 和安全错误映射。
- [ ] `window.myTracer.recovery.getContext` 窄 Preload API 与 API shape 回归。
- [ ] Goals feature 内显式进入/返回的最小只读 Recovery 页面，中性 loading/empty/error 状态。
- [ ] null、多 Record、五种 Routine 语义、0 分钟、跨日、重开、只读守恒与 IPC 安全的分层测试。
- [ ] 最小 Electron E2E 证明 AC-05 步骤 1～4；不执行 T042 mutation。
- [ ] 受影响 AC-01/03/04/07 回归、完整 diff 检查、独立 review 和确定性 Evidence。
- [ ] 候选 CI 通过后提交 documentation impact matrix，等待项目所有者批准 docs closeout。

## 9. 验收标准

1. 仅凭 Goal ID 查询时，结果包含批准设计的 `asOfLocalDate`、Goal、current next、pending Actions、latest real record、未撤销确认理解、open Confusions、可空 `lastRealActionOn` 和 `daysSinceLastRealAction`，不包含评价性字段。
2. Goal 不存在时返回 `not-found`；无真实行动时两个 last-action 字段均为 `null`，不会回退到 entity 时间戳。
3. 多 ActionRecord/RoutineRecord 时按权威 `occurredOn` 选择最近真实行动；同日并列有确定性排序，结果不依赖插入或 SQLite 行序。
4. 0 分钟 ActionRecord、`target_met` 和 `acted` 均属于真实行动；`intentional_rest`、`not_done` 与缺行 `unknown` 均不刷新日期，且 `unknown` 不落库。
5. revoked Understanding 和 resolved Confusion 被排除；全部未撤销确认理解与 open Confusion 不使用隐藏的最近 N 条截断。
6. FakeClock 跨日后 days-since 按 LocalDate 正确变化；历史 Record、current-next 和其他核心状态不变。
7. 关闭 SQLite/Electron 后用同一临时数据根重开，查询结果除 `asOfLocalDate`/days-since 的合理变化外保持一致。
8. Query 成功、重复、not-found、validation、persistence failure 和非法 sender 前后，完整核心 snapshot 与 sourceDataVersion 逐字段相同。
9. SQLite snapshot 在一个只读 transaction 内取得；没有 recovery 表、缓存、migration、export 或依赖变化。
10. IPC 只注册固定 `recovery:get-context` 意图；拒绝缺失/多余 keys、非对象、非 UUID v4、额外参数和不可信 sender，且不会把 SQL、路径或用户正文放入错误。
11. `window.myTracer` 只新增冻结的 `recovery.getContext`，仍不暴露 Node、Electron、`ipcRenderer`、SQL、路径、凭据或 Provider。
12. 用户只能从 Goals 对明确 Goal 显式进入最小只读 Recovery 页面；UI 显示此前事实、当前下一步和中性 N 天/null 状态，不显示自动入口、阈值、逾期、失败率、评分、streak 或 mastery。
13. 最小 E2E 在唯一临时 `userData` 中准备 Goal、Action/Routine facts、理解、困惑和下一步，完全关闭、FakeClock 前进多日、重开并进入 Recovery；验证中断期没有新增 Record、TodaySelection 或 ReviewResult。
14. AC-01、AC-03、AC-04、AC-07 受影响回归在同一 candidate revision 通过；T041 不改变既有行为或重新声明这些 AC。
15. Evidence 只声明 FR-REC01～REC03、D-002 与 AC-05 步骤 1～4贡献；AC-05 步骤 5、完整 AC-05、FR-P05、T042 和 S4 gate 保持 `pending`。

项目所有者的中性文案/可理解性体验检查单独标记 `MANUAL pending`，不得由自动化或 Agent 代签。

## 10. 验证计划

以下命令只在合同获批并明确授权实现后执行。测试使用 FakeClock、每 case 唯一临时 SQLite 和 Electron `userData`，不访问真实用户数据或 live Provider。

### 10.1 针对性验证

```powershell
npm.cmd run test:unit -- tests/unit/recovery-domain.test.ts tests/unit/recovery-application.test.ts
npm.cmd run test:integration -- tests/integration/recovery-sqlite.test.ts tests/integration/recovery-ipc.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/recovery-context.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

### 10.2 受影响范围回归

```powershell
npm.cmd run test:unit -- tests/unit/progress-application.test.ts tests/unit/routine-record-domain.test.ts tests/unit/local-date.test.ts
npm.cmd run test:integration -- tests/integration/progress-sqlite.test.ts tests/integration/progress-ipc.test.ts tests/integration/routine-record-sqlite.test.ts tests/integration/routine-record-ipc.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/goal-lifecycle.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts tests/e2e/data-control.e2e.test.ts tests/e2e/complete-export.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts
npm.cmd run governance:metadata:check
node tools/evidence/capture-command.mjs --task T041 --gate task-candidate --base-revision 22ee97bd9ded88e6e9e025d3afc0c6831d43240c --output .tmp/evidence -- npm.cmd run verify
git diff --check
```

`verify` 是 T041 candidate aggregate。Windows package/unpacked/NSIS smoke 留给合同另行授权或 S4 acceptance gate，不得用 T041 `verify` 声称这些结果。

### 10.3 人工步骤

1. 在真实 Windows 界面从 Goals 对一个已有历史的 Goal 显式进入 Recovery。
2. 确认页面先展示真实成果、理解、开放困惑和可开始的下一步，N 天/null 文案中性且可理解。
3. 确认页面没有 mutation 操作、自动入口、断签、逾期、失败率、评分、掌握度或人格评价。
4. 离开并重开后再次查看，确认内容仍来自事实且没有要求补齐空白日。

这些步骤只验收 T041 的只读体验；项目所有者未报告结果前为 `pending`，也不等于完整人工 AC-05。

### 10.4 验证环境

- OS：Windows
- Node：仓库锁定 `24.18.0`
- npm：仓库锁定 `11.16.0`
- Electron：仓库锁定 `43.3.0`
- SQLite：`better-sqlite3@13.0.1`
- Clock：自动化使用 FakeClock；生产 Query 使用 Main `ClockPort`
- 数据根：每 case 唯一临时根；禁止真实 Electron `userData`
- AI：disabled/not-configured/fake failure；禁止 live Provider
- Original base revision：`22ee97bd9ded88e6e9e025d3afc0c6831d43240c`
- Source revision：candidate 形成时填写

## 11. Evidence 要求

- **Reserved Evidence ID**：`EV-T041-001`；当前不在 Evidence 账本创建占位条目。
- **Claim boundary**：FR-REC01～REC03、D-002、AC-05 步骤 1～4贡献；不声明完整 AC-05 或 FR-P05。
- **Required bindings**：合同、需求/设计章节、original base、latest authorized dev、task delivery revision、PR head/test-merge revision、命令、环境、exit code、artifact、人工状态与限制。
- **Prior regression facts**：`EV-T014-001`、`EV-AC01-001`、`EV-T022-001`、`EV-T031-001`～`EV-T033-001`、`EV-T094-001`、`EV-PRE-S4-FOUNDATION-001`；这些是回归基线，不替代 T041 当前 revision 的测试。
- **Deterministic artifact**：`.tmp/evidence/T041-task-candidate-*.json`，由显式 argv wrapper 生成；只作事实输入，不自动接受任务。
- **Hosted CI**：early、candidate、final-head 必须按 revision 分开记录；PR event 的 `ci.headRevision` 与 test-merge `ci.mergeRevision` 不得混用。
- **Failure retention**：失败/partial artifact 和 exit code 保留；后续成功通过 `supersedes` 关联，不删除失败历史。
- **Manual status**：项目所有者未执行前保持 `pending`。
- **Ledger gate**：只有真实结果存在且项目所有者批准 docs closeout scope 后，才允许修改 `ACCEPTANCE_EVIDENCE_V0.1.md`。

## 12. Git、GitHub 与外部操作权限

### 12.1 当前结构化权限

以下值由项目所有者于 2026-08-28 明确批准。`external_write` 仅限指定 task branch、其到 `dev` 的 Draft PR 及配套 GitHub Actions；任何未明确为 `true` 的动作不得执行。

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
  migration_change: false
  external_write: true
```

- 已创建隔离 worktree 与 `task/T041-recovery-context`；允许合同范围内 checkpoint commits、任务分支 push、到 `dev` 的一个 Draft PR 及同一 PR 维护。
- 即使后续激活 `standard-task@1`，docs closeout scope、Ready、merge dev/main、tag、release、依赖、migration、非任务外部写入和 AI 权限仍是 owner gates。
- force-push、远端分支删除、ruleset、Secrets、真实数据操作和下一任务自动启动不在本合同可授权范围。

### 12.2 依赖、网络与数据

- 新增/升级依赖：禁止。
- migration/schema/export：禁止。
- 网络访问：仅限已授权 task branch/Draft PR 与配套 GitHub Actions。
- AI Provider：不适用；禁止 live Provider 和真实凭据。
- 外部写入：仅限 `task/T041-recovery-context` push、该分支到 `dev` 的 Draft PR 及同一 PR 维护。
- 数据破坏性操作：无；自动化只读/测试写入仅限唯一临时数据根。

### 12.3 Integration

```yaml
integration:
  target_branch: dev
  original_base_revision: dev@22ee97bd9ded88e6e9e025d3afc0c6831d43240c
  base_revision: dev@22ee97bd9ded88e6e9e025d3afc0c6831d43240c
  latest_authorized_dev_revision: dev@22ee97bd9ded88e6e9e025d3afc0c6831d43240c
  freshness_required: true
  affected_regression_required: true
  freshness_status: null
  refresh_method: null
  verified_against_revision: null
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

上述 revision 是合同编写时的真实基线，不预先声明未来 candidate `fresh`。实现开始、candidate、docs closeout 和 merge handoff 前都必须重新核对最新授权 `dev`；发现新 head 或 shared-surface 漂移时按普通 merge refresh 和受影响回归处理，禁止 force-push。

## 13. 风险与停止条件

发现以下情况时停止受影响工作并报告；必要时使用 Escalation Proposal：

- 项目所有者尚未批准合同、精确权限、任务激活或 Profile，却要求进入实现/发布阶段。
- 最新授权 `dev` 改变了 Progress facts、Repository snapshot、schema/export、Main/Preload、Goals ownership、测试命令或 T041/T051 shared surfaces。
- 需要改变 FR-REC、AC-05、D-002、五种 Routine 语义、Goal/Action/Routine 状态、LocalDate、删除或历史守恒。
- 需要用分钟、entity timestamp、查询日、UTC、当前 schedule 或缺行推断真实行动/失败。
- 需要新增阈值、自动入口、提醒、AI、评分、完成率、FR-P05 列表、Recovery persistence、migration、export 或依赖。
- Repository 无法在一致性只读 snapshot 中提供事实，或实现只能复制/漂移 Progress 公式。
- Renderer 必须获得 SQL、路径、凭据、Provider、日期计算或 arbitrary IPC 才能完成。
- 实现必须修改第 5.2 节之外的文件，或与 T051/其他任务产生未授权并行冲突。
- 测试必须访问真实用户数据、live Provider，或无法产生可靠的 null、跨日、重开、历史守恒和零写入证据。
- 无法把 Evidence 绑定到精确 base/source/CI revision，或需要删除失败证据才能声明通过。

## 14. 完成与交接边界

T041 只有在以下事实均由实际结果支持时，才可形成 implementation-complete candidate：

- 第 8 节交付物和第 9 节自动化标准满足；
- targeted、affected regression、`verify`、metadata、diff integrity 和独立 review 通过；
- Integration Freshness 为 `fresh` 或 `refreshed-and-passed`；
- 没有未批准依赖、migration、export、AI、mutation、范围或权限变化；
- candidate hosted CI 绑定确切 head/test-merge revision；
- 只声明 AC-05 步骤 1～4贡献，人工状态如实保留。

随后必须按 Skill 暂停，向项目所有者提交 documentation impact matrix。未获 docs closeout 授权时，不修改任务状态、Evidence 账本或 Draft PR closeout，不创建 docs commit；final-head CI、Ready 和 merge 继续是独立门禁。T041 合入 `dev` 也不自动启动 T042。

当前已进入获批的 `standard-task@1` 执行流程。实现候选与 candidate CI 完成后必须在 docs closeout owner gate 停止，提交精确 documentation impact matrix；不得据本合同自动执行 Ready、merge、tag、release 或启动 T042。

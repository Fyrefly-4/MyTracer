# T042 清理过时内容并重新开始任务合同

> 任务类型：implementation
>
> 合同状态：**active / owner approved**；项目所有者于 2026-08-29 明确批准并激活本合同与第二阶段开发
>
> 当前阶段：第二阶段实施；允许按本合同的精确范围、结构化权限与 `standard-task@1` Automation Profile 连续执行，推送并创建 Draft PR 后按项目所有者指令立即停止，不自主查询 CI

## 1. 任务信息与基线

- **Task ID**：T042
- **Title**：清理过时内容并重新开始
- **Slice / Plan item**：S4 / E4-02
- **Status**：`active`
- **Base branch**：`dev`
- **Latest authorized dev revision at draft**：`dev@695e7bcc25b33279d39e61e28a8730b9cdf16264`
- **Remote-tracking check**：2026-08-29 执行 `git fetch origin dev` 后，本地 `dev`、`origin/dev` 与 `FETCH_HEAD` 均为 `695e7bcc25b33279d39e61e28a8730b9cdf16264`，ahead/behind 为 `0/0`
- **Task branch name**：`task/T042-recovery-restart`

### 1.1 T041 prerequisite 与 integration 核验

- `EV-T041-001` 为 `pass`，绑定 task delivery candidate `1e9ab2b80b5b81a8bedd192750281d4042f279d5`、本地完整验证、独立只读复核、implementation-candidate hosted CI 与项目所有者人工测试；它只证明 FR-REC01～FR-REC03、D-002 与 AC-05 步骤 1～4贡献。
- PR #39 的 final head 为 `64ac9dddd41413c22b0ec35f99ed9022d1555e25`，项目所有者已于 2026-08-28 合入 `dev`；GitHub 报告的 merge commit 为 `695e7bcc25b33279d39e61e28a8730b9cdf16264`。
- final head 与 `dev` integration revision 的 Git tree 均为 `588818c2de5a57611df83b8a1fae40c44987585d`，且 `git diff --quiet 64ac9dd... 695e7bc...` 为相同，证明 squash merge 后的集成树与 PR final head 一致。
- PR final-head required CI run `33155839482` 为成功；`dev@695e7bc...` 的 post-merge Verification run `33156238060` 也为成功。
- `1e9ab2b...` 不是 `dev` 的 Git 祖先是 squash merge 的预期结果，不得误报为未集成。T042 分开记录：
  - T041 `task_delivery_revision = 1e9ab2b...`；
  - T041 PR final head `64ac9dd...`；
  - T041 `dev_integration_revision = 695e7bc...`。
- 当前 `dev` 内 T041 合同、TASK_INDEX 与 `EV-T041-001` 的 PR 集成文字仍停留在 merge 前状态；本合同只把 GitHub、Git tree 和 post-merge CI 作为 T042 prerequisite 的实际集成事实，不重写原 Evidence 的 candidate 声明，也不把该文档漂移解释为 T041 失效。

## 2. 目标结果

用户从 T041 提供的单 Goal `RecoveryContext` 显式进行恢复，可以：

1. 查看并判断当前 Goal、关联 pending Action 与关联 Routine 是否仍重要；
2. 为过时内容建立 feature-local 操作草稿，明确确认后复用普通 Goal、Routine、Action Command 执行 pause、end、complete、cancel 或 reschedule；
3. 选择同 Goal 的现有 pending Action，或创建一个小 Action，并明确把它设为该 active Goal 的当前下一步；
4. 在当前下一步已经成功保存后，另行决定是否调用普通 Today Command 加入当前 Today；
5. 在取消、校验失败、状态冲突、持久化失败与部分成功时得到准确、中性、可恢复的反馈；
6. 每次 mutation 后从 Main 重新查询 RecoveryContext 和受影响 Goal/Routine/Today 事实，关闭并重开后仍保持一致。

新建小 Action 与设为当前下一步必须由通用 Application Command `CreateAndSetGoalCurrentNextAction` 在一个事务中全有或全无完成。它不是 Recovery 专用 Repository/SQLite 写入口，也不自动加入 Today。Recovery 操作本身不是 Record，不增加 Progress 次数，不补中断期空白日。

## 3. 需求与设计依据

- **直接 FR**：FR-REC04、FR-REC05、FR-REC06、FR-P04。
- **直接 AC**：AC-05 步骤 5，并与 T041 步骤 1～4在同一连续 E2E 中形成完整 AC-05 candidate；项目所有者人工结果未执行前保持 `pending`。
- **相关 Goal/Action/Routine/Today FR**：FR-G03、FR-G04、FR-G05；FR-A01、FR-A03、FR-A04、FR-A06；FR-R01；FR-T04、FR-T05。
- **直接 D**：D-002、D-004；D-013 只支持温和、非评判式表达，不是停滞阈值依据。
- **直接 ED**：ED-005、ED-006、ED-007、ED-008、ED-013；ED-013 才是“长期未推进不设自动阈值”的工程依据。
- **Electron / data / workflow**：ED-004、ED-015、ED-017、ED-019；GW-001～GW-010。
- **回归依据**：D-007、D-008、D-009、D-010、D-106、D-107；FR-P03/P04、FR-R04～R09；AC-01、AC-03、AC-04、AC-07 只作受影响回归，不重新声明完成。
- **明确追踪纠正**：`IMPLEMENTATION_PLAN_V0.1.md` 与当前 `TASK_INDEX_V0.1.md` 的 T042 `D-013` 引用只能解释为中性表达支持；任何无阈值、无逾期判断均追踪至 `ED-013`。本任务不得沿用或扩散“D-013 = 长期未推进阈值决定”的错误语义映射。
- **直接相关架构章节**：
  - `ARCHITECTURE_V0.1.md` §4～§6、§9；
  - `DOMAIN_MODEL_V0.1.md` §3～§10；
  - `IMPLEMENTATION_PLAN_V0.1.md` §7 E4-02 与 §10.1；
  - `TEST_STRATEGY_V0.1.md` §1～§8、§9～§10；
  - `REQUIREMENTS_TRACEABILITY_V0.1.md` §2.1～§2.4、§2.7、§2.9、§4～§5；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §5～§7、S1-Q04、S1-Q05、S1-Q07；
  - `S2_ROUTINE_INTENTION_DESIGN_V0.1.md` §4、§6、S2-Q07；
  - `S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md` §0～§13、S45-Q01-A、S45-Q02-A、S45-Q06-A、S45-Q07-A、§15～§17。

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
        - 2.3 需要显式隔离的两处张力
        - 3. Stage delta、目标与非范围
        - 4.1～4.2 Recovery 流程与既有生命周期操作
        - 5. 领域关系、状态与不变量
        - 6.1 Recovery 日期
        - 7.3 Commands 与 S45-Q06-A 原子边界
        - 8. IPC、Preload、Main 与 Renderer 安全边界
        - 9.1 Recovery 与 ReviewSummary
        - 10. Task graph、共享面与实施顺序
        - 11.2 T042 — 清理过时内容并重新开始
        - 12.2 E2E-AC-05 连续程序
        - 13. FR / AC / D / ED 追踪
        - S45-Q01-A、S45-Q02-A、S45-Q06-A、S45-Q07-A
        - 15～17 风险、授权与阶段门
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S1_CORE_LOOP_DESIGN_V0.1.md
    - docs/architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md
  implementation:
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/AUTOMATION_PROFILES_V0.1.md
    - docs/implementation/profiles/standard-task-v1.json
    - docs/implementation/T041_RECOVERY_CONTEXT.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
```

## 4. 开始条件、依赖与 shared surfaces

### 4.1 当前已核实事实

- [x] T041 的 task delivery candidate、人工只读体验与 `EV-T041-001` 声明边界有效。
- [x] T041 PR final head 已由项目所有者 squash merge 进入最新授权 `dev@695e7bc...`，final-head tree 与 integration tree 相同，post-merge CI 成功。
- [x] T041 的 Goals 内显式入口、RecoveryContext DTO、Main Clock/LocalDate、单事务只读 snapshot、窄 IPC/Preload 和 read-only E2E 已存在。
- [x] 现有 Goal、Routine、Action 与 Today 普通 Commands 已存在；pause/end、Action current-next resolution、rescheduled 恢复和 Today 用户选择具有已验收测试。
- [x] 现有 `GoalService` 已持有 `UnitOfWorkPort`、Repository、Clock 与 UUID generator，能够在不新增 Repository/SQLite 能力的情况下实现原子 create-and-set。
- [x] 当前 schemaVersion 仍为 2、exportVersion 仍为 1；T042 不需要 migration、schema 或 export 变化。
- [x] 当前稳定验证命令、FakeClock、唯一临时 SQLite/Electron `userData` 与 deterministic evidence wrapper 均存在。
- [x] 未发现两条 MUST、已批准设计或当前实现之间的阻塞冲突。
- [x] 项目所有者已于 2026-08-29 批准本合同、实施文件范围、结构化权限、Automation Profile 和 T042 激活。

```yaml
dependencies:
  tasks:
    requires: [T041]
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: [T051, T052]
  stage_prerequisites:
    - T041 candidate is evidenced by EV-T041-001
    - T041 final head 64ac9dd is integrated as dev revision 695e7bc
    - T041 final-head and post-merge CI are successful
    - S1 Goal/Action/Today behavior remains evidenced
    - S2 Routine lifecycle and five-semantics behavior remains evidenced
    - S3 history, deletion and export behavior remains evidenced
  revisions:
    required_dev_base: dev@695e7bcc25b33279d39e61e28a8730b9cdf16264
    t041_task_delivery_revision: 1e9ab2b80b5b81a8bedd192750281d4042f279d5
    t041_final_head_revision: 64ac9dddd41413c22b0ec35f99ed9022d1555e25
    t041_dev_integration_revision: 695e7bcc25b33279d39e61e28a8730b9cdf16264
  shared_surfaces:
    - goal-action-current-next-transaction
    - goal-action-routine-today-command-contracts
    - goals-recovery-renderer-feature
    - main-preload-api-shape-and-ipc-security
    - ac05-continuous-electron-e2e
  external: []
```

T042 与 T051/T052 会重叠 Main/Preload API、Goal current-next、Goals/Recovery Renderer 和最终 E2E shared surfaces；批准设计要求串行，T042 不与其并行，也不自动启动下一任务。

### 4.2 Automation Profile（已激活）

本任务使用 `standard-task@1`：任务类型为 implementation，无 dependency/migration/AI Provider/真实凭据/破坏性数据操作，并只发布一个确切 task branch 到 `dev` 的 Draft PR。

```yaml
execution:
  profile: standard-task@1
  activated_at: 2026-08-29T13:24:32+08:00
  valid_until: 2026-09-28T13:24:32+08:00
  additional_constraints:
    - after a successful task-branch push and Draft PR creation, stop without querying or monitoring hosted CI until the project owner gives the next command
  status: active
```

激活时间与不超过 30 天的有效期同步写入本合同和 `metadata/T042.json`；实施前先把 TASK_INDEX 更新为 `active` 并运行 `npm.cmd run governance:metadata:check`。项目所有者关于 PR 后立即停止的约束优先于 Profile 的后续 hosted-CI 观察步骤。

即使 Profile 后续激活，`docs_closeout_scope`、Ready、merge dev/main、tag、release、dependency/migration、非任务外部写入与 AI Provider/权限变化仍为 owner gates。

## 5. 允许修改范围

### 5.1 已完成的合同草案阶段

第一阶段曾只授权创建或修改：

- `docs/implementation/T042_RECOVERY_RESTART.md`
- `docs/implementation/metadata/T042.json`

第一阶段未修改 `TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md`、README、生产代码、测试、配置、依赖、migration、export、其他文档或任何外部状态。

### 5.2 已批准的精确实现范围

以下范围已由项目所有者批准并激活：

- `src/application/goals.ts`
- `src/contracts/goals.ts`
- `src/main/goals-ipc.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/goals/GoalsPage.tsx`
- `src/renderer/src/features/goals/RecoveryPanel.tsx`
- `src/renderer/src/styles.css`
- `tests/unit/goal-application.test.ts`
- `tests/integration/goal-sqlite.test.ts`
- `tests/integration/goal-ipc.test.ts`
- `tests/integration/main-foundations.test.ts`
- `tests/e2e/recovery-restart.e2e.test.ts`
- `tests/e2e/shell.e2e.test.ts`
- `docs/implementation/T042_RECOVERY_RESTART.md`
- `docs/implementation/metadata/T042.json`
- `docs/implementation/TASK_INDEX_V0.1.md`（仅任务激活/状态事实）

现有 `GoalService`/Goal IPC 承载通用 `CreateAndSetGoalCurrentNextAction`；Recovery Renderer 复用已经存在且不修改的 `window.myTracer.goals`、`actions`、`routines`、`today` Commands。不得为了“统一 Recovery API”复制生命周期命令或创建 Recovery 专用写入 Service/Repository。

实现候选 CI 通过后的 documentation impact matrix 必须评估本合同、metadata、`TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md`、README 与 Draft PR 正文。只有项目所有者批准精确 docs closeout scope 后，才允许修改相应交付记录并创建独立 docs closeout commit。

如果实现需要修改上述列表之外的文件，先停止受影响工作并申请合同范围变更；不得把 `src/domain/**`、SQLite Repository、migration、Action/Routine/Today Application、CI 或依赖变化解释为隐含接线权限。

## 6. 明确非范围

- 自动建议、自动选择小行动、AI、Provider、AI 上下文、AI 草稿或 AI 写权限。
- 自动 pause/end/complete/cancel/reschedule，自动更新 current-next，自动加入 Today，或按 days-since/困惑/空白日驱动 mutation。
- 硬删除捷径、复制 Data Control 删除逻辑、绕过影响预览/二次确认/事务，或把 pause/end 表达成删除。
- 修改、移动、补齐、重新归属或伪造任何历史 ActionRecord/RoutineRecord；Recovery 完成不生成 Record。
- 自动返回检测、启动弹窗、提醒、通知、后台任务、恢复队列、dismiss/lastSeen 或 Recovery 持久化。
- Review、ReviewResult、T051、T052、S5、S6、AI、S7 或下一任务启动。
- migration、schemaVersion、`review_results`、索引、exportVersion、export shape、导入或恢复。
- FR-P05/S7 跨 Goal 停滞列表、筛选、排序、标记；固定/可配置阈值、overdue、failure rate、完成率、score、mastery、streak、排名或人格评价。
- 新增主导航、独立 Recovery 主视图、新用户一级概念、通用工作流/表单抽象。
- 新增、升级或移除依赖；修改 `package.json`、lockfile、构建、Workflow 或治理工具。
- Windows package/unpacked/NSIS smoke、AC-06、S4 stage acceptance、G4、Ready、merge、main、tag、release。

## 7. 必须保持的不变量

### 7.1 用户确认、取消与刷新

- Recovery 中所有操作先保持为 feature-local 草稿；打开草稿、修改、取消、返回和关闭页面均产生零业务写入。
- pause/end/Action transition/选择或创建下一步/加入 Today 分别显示精确对象与效果，并经用户明确确认；不得把一个确认扩张为未显示的额外操作。
- 命令成功后不能只改 Renderer 本地对象；必须重新 Query RecoveryContext，并刷新受影响 Goal/Routine/Today 事实。
- 命令失败时准确区分零写入、已完成的前序独立命令和可重试步骤；不得把部分成功谎报为全部失败。

### 7.2 生命周期与历史守恒

- Goal/Routine pause/end 只改变目标对象当前状态，保留全部历史 Record、ID、发生日、outcome、分钟、子事实和审计时间。
- Goal pause/end 不自动 pause/end 关联 Routine；Routine pause/end 不改变 Goal。
- Action complete/cancel/reschedule 复用普通 Action Command；旧 Record 不移动、不重写。reschedule 复用同一 Action ID 并按既有规则移出当前 Today。
- current-next Action 进入终态或 rescheduled 时必须使用既有原子 current-next resolution：用户明确选择 replacement 或 clear；系统不得自动选择。
- Recovery 永久删除只能跳转既有 Data Control；本任务不提供硬删除按钮或替代流程。

### 7.3 小 Action 与 Today

- `CreateAndSetGoalCurrentNextAction` 只接受 active Goal、用户输入的非空 title 与可选 description；Main 生成 UUID/Instant。
- 单个 UnitOfWork transaction 内创建同 Goal pending Action 并用 ED-005 设置 current-next；任何 validation、FK、save 或 invariant failure 全部回滚，不留下孤立 Action 或半更新 Goal。
- 选择 existing Action 时只能使用同 Goal pending Action；跨 Goal、completed、cancelled、rescheduled 或不存在 Action 拒绝且零写入。
- 设置 current-next 不自动创建 TodaySelection。加入 Today 是后续、单独、明确的普通 Today Command，使用该命令开始时 Main Clock 的当前 LocalDate。
- create-and-set 成功而 Today 选择失败时，UI 必须明确报告“当前下一步已保存；加入 Today 未完成”，刷新实际状态并允许单独重试 Today；不得回滚已成功的前一用户意图或声称全部失败。

### 7.4 日期、事实与表达

- T041 `asOfLocalDate`/days-since 继续由 Main Clock/LocalDate 计算；Renderer 不提交可信日期、不自行计算阈值。
- 跨午夜时，RecoveryContext 可以通过重新 Query 显示新的 as-of fact；Today 选择使用新命令时的当前 LocalDate，历史 Record 永不静默移动。
- `unknown` 仍是缺行，不持久化、不转为 `not_done`；Recovery 不补中断期间的 ActionRecord、RoutineRecord、TodaySelection 或 ReviewResult。
- D-013 只约束温和、非评判式表达；无阈值事实追踪至 ED-013。页面不得显示断签、失败率、大量负面逾期、评分、掌握度或人格评价。

### 7.5 Electron 与安全边界

- 新增 API 仅为意图级 `window.myTracer.goals.createAndSetCurrentNextAction(input)`；Preload 不暴露任意 channel、Node、Electron、SQL、Repository、路径、凭据或 Provider。
- Main 对新 IPC 校验 trusted sender/origin、恰好一个对象、精确 keys、UUID v4、非空 title 与可选 description；拒绝多余/伪造字段。
- Renderer 只能组合窄 API 和显示 DTO；不得取得 UnitOfWork、Clock、数据库或直接写能力。
- 错误使用稳定、中性 code/message，至少覆盖 `validation`、`not-found`、`invalid-transition`、`invariant-violation` 与 `persistence-failed`，不泄露 SQL、绝对路径、堆栈或用户正文。
- 自动化只使用 FakeClock、唯一临时 SQLite/Electron `userData` 和 fake/disabled/not-configured AI；禁止真实用户数据库、真实凭据或 live Provider。

## 8. 交付物

- [ ] Recovery Renderer 对 Goal/Routine/Action 清理操作的 feature-local 草稿、确认、取消、busy、错误与成功刷新。
- [ ] 复用普通 Goal/Routine/Action/Today Commands；没有 Recovery 专用写 Repository 或重复生命周期实现。
- [ ] 通用原子 `CreateAndSetGoalCurrentNextAction` Application Command、DTO、固定 IPC、Preload 方法和 API shape 回归。
- [ ] 选择 existing pending Action 并设置 current-next，以及另行可选加入 Today 的流程。
- [ ] 原子 rollback、取消零写入、独立 Today 部分成功、历史 Record 逐字段守恒和跨午夜 Today 日期测试。
- [ ] 一个新的连续 Electron E2E 完整执行 AC-05 步骤 1～5、关闭重开与非压力表达断言。
- [ ] AC-01、AC-03、AC-04、AC-07 受影响回归、完整 `verify`、metadata、diff integrity 和独立只读 review。
- [ ] `EV-T042-001` 真实 candidate Evidence 与项目所有者人工 AC-05 程序；人工状态由所有者报告前保持 `pending`。
- [ ] candidate hosted CI 后的 documentation impact matrix 与 owner-gated docs closeout 提案。

## 9. 验收标准

1. Recovery 继续以 T041 事实为输入；进入、展开任一操作草稿、编辑、取消和返回前后完整核心 snapshot 相同。
2. 用户可以显式 pause/end 一个单独的过时测试 Goal 或当前 active Recovery Goal 的关联 Routine；只有确认的对象发生合法状态转换，Goal/Routine 不自动联动，所有历史 Record 逐字段不变。paused/ended Goal 不再继续执行设置下一步，用户返回另一个 active Goal 完成重新开始。
3. 用户可以对可见 pending Action 显式 complete/cancel/reschedule；普通 current-next resolution 规则得到满足，旧 Record、occurredOn 与 ID 不变。
4. `CreateAndSetGoalCurrentNextAction` 在一个事务创建同 Goal pending Action 并设为 active Goal 的 current-next；成功后不存在中间可见状态。
5. 新原子命令在 inactive/missing Goal、空白 title、UUID/shape 错误、Repository failure 或 current-next invariant failure 时零写入，不留下孤立 Action。
6. 用户可以选择同 Goal existing pending Action 设为 current-next；跨 Goal、终态、rescheduled、不存在 Action 被拒绝且零写入。
7. 设置 current-next 后不会自动加入 Today。用户明确选择“加入 Today”时才调用普通 Today Command；跨午夜使用实际命令日。
8. Today 失败发生在 create/set 成功之后时，UI 准确保留和显示已成功的 current-next，单独报告 Today 未完成并允许重试。
9. 每次成功 mutation 后 RecoveryContext、Goal detail/list、关联 Routine/Today 状态都从 Main 重新读取；刷新或关闭重开不会恢复旧 Renderer 草稿。
10. 所有不可信 sender、缺失/多余 keys、非法 UUID、伪造状态/日期/ID 和非法 transition 被安全拒绝；错误不泄露 SQL、路径、堆栈或用户正文。
11. 没有新增 schema、migration、表、export 字段、依赖、Recovery 持久化、AI、提醒、Review 或 S7 行为。
12. Recovery mutation 自身不创建 ActionRecord/RoutineRecord/ReviewResult，不把中断空白日写成 `not_done`，不增加 Progress realActionCount。
13. 连续 E2E 在同一唯一临时 `userData` 中：准备历史 → 完全关闭 → FakeClock 前进多日 → 重开查看 T041 事实 → 验证空白日零补写 → 取消草稿零写入 → 显式清理过时内容 → 创建/选择小 Action 并设 current-next → 可选加入 Today → 再次关闭重开并逐字段比较历史。
14. E2E 与人工页面没有断签、失败率、大量负面逾期、score、mastery、streak、阈值或人格评价；D-013 只用于温和表达，ED-013 用于无阈值事实。
15. AC-01、AC-03、AC-04、AC-07 受影响路径在同一 implementation candidate revision 通过；T042 不改变或重新声明这些 AC。
16. `EV-T042-001` 只从真实结果声明 FR-REC04～REC06、FR-P04、相关生命周期/current-next/Today 行为和完整 AC-05 candidate；项目所有者未执行人工程序时，人工 AC-05 与 S4 gate 保持 `pending`。
17. Implementation Candidate 相对最新授权 `dev` 的完整 diff、Integration Freshness、affected regression、deterministic evidence 与 independent review 没有未处理 required finding。
18. T042 不自动启动 T051；即使自动化和人工 AC-05 通过，S4 acceptance decision 与后续任务仍由项目所有者另行授权。

## 10. 验证计划

以下命令只在项目所有者批准并激活合同后执行。所有自动化使用 FakeClock 和每 case 唯一临时 SQLite/Electron `userData`。

### 10.1 针对性验证

```powershell
npm.cmd run test:unit -- tests/unit/goal-application.test.ts
npm.cmd run test:integration -- tests/integration/goal-sqlite.test.ts tests/integration/goal-ipc.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/recovery-restart.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

### 10.2 受影响范围回归

```powershell
npm.cmd run test:unit -- tests/unit/recovery-domain.test.ts tests/unit/recovery-application.test.ts tests/unit/goal-domain.test.ts tests/unit/goal-application.test.ts tests/unit/action-domain.test.ts tests/unit/action-application.test.ts tests/unit/routine-domain.test.ts tests/unit/routine-application.test.ts tests/unit/today-selection-domain.test.ts tests/unit/today-application.test.ts
npm.cmd run test:integration -- tests/integration/recovery-sqlite.test.ts tests/integration/recovery-ipc.test.ts tests/integration/goal-sqlite.test.ts tests/integration/goal-ipc.test.ts tests/integration/action-today-sqlite.test.ts tests/integration/action-today-ipc.test.ts tests/integration/routine-sqlite.test.ts tests/integration/routine-ipc.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/recovery-context.e2e.test.ts tests/e2e/recovery-restart.e2e.test.ts tests/e2e/goal-lifecycle.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/routine-lifecycle.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts tests/e2e/data-control.e2e.test.ts tests/e2e/complete-export.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts tests/e2e/shell.e2e.test.ts
npm.cmd run governance:metadata:check
node tools/evidence/capture-command.mjs --task T042 --gate task-candidate --base-revision 695e7bcc25b33279d39e61e28a8730b9cdf16264 --output .tmp/evidence -- npm.cmd run verify
git diff --check
```

如果任务激活时最新授权 `dev` 已变化，先更新合同/sidecar 的实际 base 并执行 freshness gate；不得继续用 `695e7bc...` artifact 证明更新后的 candidate。`verify` 包含 build、unit、integration 与 Electron E2E，但不替代 hosted CI、人工体验、Windows package 或阶段门。

### 10.3 E2E-AC-05 连续程序

在同一 Windows 环境、FakeClock 和每 case 唯一临时 `userData` 上：

1. 创建一个 active Recovery Goal（含 pending current-next Action、另一个 pending Action、历史 ActionRecord、确认 Understanding、open Confusion、关联 active Routine 与真实 RoutineRecord）以及一个单独的过时 Goal；保存完整初始 snapshot。
2. 完全关闭应用和 SQLite；FakeClock 前进多日；重开同一数据根。
3. 从 Goals 显式进入 Recovery，验证此前成果、last real action、open Confusion、current-next、pending Actions 与中性 N 天事实。
4. 验证中断期间没有自动 ActionRecord/RoutineRecord/TodaySelection/ReviewResult，空白日没有变成 `not_done`。
5. 依次打开清理/下一步草稿并取消，比较 snapshot 零变化；主路径暂停关联 Routine 并转换旧 Action，隔离分支 pause/end 单独的过时 Goal 后返回 active Recovery Goal；验证只改变明确对象且历史逐字段守恒。
6. 对 active Goal 分别覆盖 existing pending Action 与 create-and-set 原子分支；故障分支证明全回滚。
7. 证明 current-next 不自动加入 Today；覆盖“跳过 Today”“成功加入 Today”和“current-next 已成功但 Today 失败并可重试”。
8. 完全关闭并重开，验证合法状态、新 current-next、实际 Today LocalDate 与历史事实持久一致。
9. 页面和 API 不出现自动建议、阈值、断签、失败率、大量逾期、评分、掌握度、streak 或人格评价。

### 10.4 项目所有者人工 AC-05 程序

人工验收必须使用明确的专用测试数据根或项目所有者选择的可丢弃测试数据，不得让 Agent 自动操作真实用户数据库：

1. 准备一个有历史记录、理解、开放困惑、旧 current-next、另一个 pending Action 和关联 Routine 的 active 测试 Goal，然后关闭并重开应用。
2. 从 Goals 显式进入 Recovery，确认首先看到成果、上下文与可开始内容，没有要求补齐空白日。
3. 打开一个 pause/end/transition 草稿后取消，确认文案明确、焦点/返回可用且没有数据改变。
4. 对专门准备的关联 Routine 或单独过时 Goal 确认一次 pause/end，并确认没有自动联动；如果结束单独 Goal，返回 active Recovery Goal；再对 Action 使用一个合法 transition，确认旧记录仍可见。
5. 为 active Goal 选择一个现有小 Action 设为当前下一步；再次进入流程创建另一个小 Action，确认 create-and-set 是一个用户意图且没有孤立中间 Action。
6. 在一个分支不加入 Today；在另一个分支明确加入 Today，确认 Today 是单独选择而不是默认勾选。
7. 关闭并重开，确认状态、current-next、Today 日期与历史保持；Recovery 操作没有增加行动次数。
8. 确认成功、取消、错误与恢复文案温和、非评判，不显示断签、失败率、大量逾期或人格评价。
9. 项目所有者报告 `pass`、`partial` 或 `fail` 及观察；未报告前，人工 AC-05 与 S4 acceptance 一律为 `pending`。

### 10.5 验证环境

- OS：Windows
- Node：仓库锁定 `24.18.0`
- npm：仓库锁定 `11.16.0`
- Electron：仓库锁定 `43.3.0`
- SQLite：`better-sqlite3@13.0.1`
- Clock：自动化使用 FakeClock；生产 Command/Query 使用 Main `ClockPort`
- 数据根：每 case 唯一临时根；人工使用明确专用测试根；禁止真实 Electron `userData`
- AI：disabled/not-configured/fake failure；禁止 live Provider
- Original base revision：`695e7bcc25b33279d39e61e28a8730b9cdf16264`
- Source revision：完成时填写

## 11. Evidence 要求

- **Evidence ID**：预留 `EV-T042-001`；只有真实实现、验证、review、CI 与 owner-reported manual 结果才能写入 Evidence 账本。
- **Claim boundary**：FR-REC04～REC06、FR-P04、FR-G03/G04/G05、FR-A01/A03/A04/A06、FR-R01、FR-T04/T05、D-002/D-004、D-013 的表达支持、ED-005～008/013 与完整 AC-05 candidate；不声明 S4 acceptance、T051、Review、AI、FR-P05 或 G4。
- **T041 prerequisite**：保留 `EV-T041-001` candidate 声明；另行记录 PR #39 final head `64ac9dd...`、`dev_integration_revision 695e7bc...`、final-head run `33155839482` 与 post-merge run `33156238060`，不把 squash integration 冒充 task candidate 的祖先关系。
- **Required bindings**：合同、需求/设计章节、original/latest dev base、Implementation Candidate、task delivery revision、PR head/test-merge revision、命令、Windows 环境、exit code、artifact、manual status、限制与 supersedes。
- **Deterministic artifact**：`.tmp/evidence/T042-task-candidate-*.json`；显式 argv、脱敏、只在 ignored `.tmp/evidence/`，不记录 stdout/stderr、绝对用户路径、环境变量、凭据或用户正文。
- **Hosted CI**：early、candidate、docs final-head 与 post-merge 分开绑定；PR `ci.headRevision` 和 test-merge `ci.mergeRevision` 不得混用。
- **Failure retention**：失败/partial artifact、CI 与人工结果保留；后续成功用 `supersedes` 关联，不删除历史失败。
- **Manual status**：项目所有者按 §10.4 报告前为 `pending`；自动化、Agent 说明或测试名称不能代签。
- **Ledger gate**：候选 CI 通过后先提交 documentation impact matrix；只有项目所有者批准精确 docs closeout scope 后，才修改 Evidence、TASK_INDEX、README 或长期交付记录。

## 12. Git、GitHub、外部与数据权限

### 12.1 第一阶段历史权限

第一阶段除第 5.1 节两个草案文件外未授予实施或 Git/GitHub 权限：

```yaml
permissions_current_draft:
  local_write: true
  create_worktree: false
  create_task_branch: false
  create_commit: false
  push_task_branch: false
  create_or_update_draft_pr: false
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: false
```

### 12.2 当前实施权限

项目所有者已明确确认以下权限：

```yaml
permissions_current_execution:
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

- `external_write: true` 只限 `task/T042-recovery-restart` push、该分支到 `dev` 的一个 Draft PR、同一 PR 正文/CI 维护；不包含其他 branch、Issue、ruleset、Secrets、远端删除或任何非任务发布。
- 允许的 Git 历史是有意义 checkpoint commits；禁止 force-push、远端分支删除和 published history rewrite。
- Ready、merge dev/main、tag、release 永远需要针对确切目标的后续项目所有者授权，不因合同或 Profile 自动获得。
- 新增/升级依赖：禁止。
- migration/schema/export：禁止。
- 网络：只允许最新 `origin/dev` 读取、已授权 task branch/Draft PR 与配套 GitHub Actions；不调用外部 App/Provider。
- AI Provider：不适用；禁止真实凭据和 live Provider。
- 数据破坏性操作：无；自动化只写唯一临时根，人工只使用项目所有者明确选择的专用测试根。

### 12.3 Integration

```yaml
integration:
  target_branch: dev
  original_base_revision: dev@695e7bcc25b33279d39e61e28a8730b9cdf16264
  base_revision: dev@695e7bcc25b33279d39e61e28a8730b9cdf16264
  latest_authorized_dev_revision_at_draft: dev@695e7bcc25b33279d39e61e28a8730b9cdf16264
  freshness_required: true
  affected_regression_required: true
  freshness_status: null
  refresh_method: null
  verified_against_revision: null
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

合同激活、Implementation Candidate、docs closeout 与 merge handoff 前都重新 fetch/核对最新授权 `dev`。只有实际 candidate 基于最新 dev 时可记录 `fresh`；若 stale，必须普通 merge refresh、affected regression、必要重审与 candidate CI 后记录 `refreshed-and-passed`。不得 force-push。

## 13. 风险与停止条件

发现以下情况时停止受影响工作并报告；属于需求、架构、合同、依赖、migration、权限、集成或证据问题时使用 Escalation Proposal：

- 项目所有者尚未批准合同、精确权限、任务激活或 Profile，却要求进入生产实现、测试修改、分支、commit、push 或 PR。
- 最新授权 `dev` 不再是本合同基线，或改变 T041 DTO、Goal current-next、普通生命周期 Commands、Goals ownership、Main/Preload、测试命令、schema/export 或 T051/T052 shared surfaces。
- 需要改变 FR-REC、AC-05、Goal/Action/Routine/Today 状态、五种 Routine 语义、LocalDate、删除或历史守恒。
- 需要把 D-013 解释为停滞阈值，或引入固定/可配置阈值、overdue、自动返回、提醒、AI、评分、完成率、FR-P05 列表或其他延期能力。
- 不能用现有 UnitOfWork/Repository 和 Goal domain helper 原子 create-and-set，因而需要新增 Repository/SQLite/schema/migration 或扩大生产文件范围。
- 复用普通 Commands 无法提供准确的确认、取消、错误或部分成功语义，或 Renderer 必须获得 SQL、路径、Clock、凭据、Provider 或 arbitrary IPC。
- 操作会重写、移动、补齐或重新归属历史 Record，Goal pause/end 会自动联动 Routine，或 Recovery completion 被计为行动。
- 测试必须访问真实用户数据、live Provider，或无法证明取消零写入、rollback、Today 独立性、跨午夜、重开和历史逐字段守恒。
- 无法把 Evidence 绑定到精确 base/source/PR head/test-merge/dev integration revision，或需要删除失败/partial 证据才能声明通过。

## 14. 完成与交接边界

T042 只有在以下事实均由实际结果支持时，才可形成 implementation-complete candidate：

- 第 8 节交付物与第 9 节自动化标准满足；
- targeted、affected regression、完整 `verify`、metadata、diff integrity 与独立 review 通过；
- Integration Freshness 为 `fresh` 或 `refreshed-and-passed`；
- 没有未批准依赖、migration、schema、export、AI、Review、S7、范围或权限变化；
- candidate hosted CI 绑定确切 PR head/test-merge revision；
- Evidence 只声明合同边界，人工 AC-05 在项目所有者报告前保持 `pending`。

candidate CI 通过后必须按 development Skill 先形成 documentation impact matrix，并停在 `docs_closeout_scope` owner gate。docs closeout、final-head CI、Ready、merge 与 S4 acceptance 均是后续独立门禁。T042 完成或合入 `dev` 不自动启动 T051。

## 15. 阶段交接

第一阶段合同草案已完成并获批准：

- 本合同与 `metadata/T042.json` 创建；
- T041 prerequisite、`EV-T041-001` candidate 边界和实际 `dev_integration_revision` 可追踪；
- D-013/ED-013 追踪纠正、精确范围、验证、Evidence、Automation Profile 提议和 Git/GitHub 权限明确；
- metadata、格式和 diff integrity 校验通过；
- 未修改生产代码、测试、TASK_INDEX、Evidence 或外部状态。

T042 当前为 `active`。第二阶段按本合同实施；成功推送 task branch 并创建 Draft PR 后立即停止，不自主查询 hosted CI，等待项目所有者下一步命令。

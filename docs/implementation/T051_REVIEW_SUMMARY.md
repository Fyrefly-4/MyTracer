# T051 周期事实摘要任务合同

> 任务类型：implementation
>
> 合同状态：**active**；项目所有者已于 2026-08-29 明确批准并激活 T051 与 `standard-task@1`
>
> 当前阶段：项目所有者已明确允许在 S4 acceptance 尚未单独收口的当前状态进入 S5，并批准本合同第 5.2、7～14 节的实现、验证、Evidence artifact 与 Git/GitHub 权限；长期 Evidence ledger 和 docs closeout 仍等待候选 CI 后的单独 owner gate

## 1. 任务信息与基线

- **Task ID**：T051
- **Title**：周期事实摘要
- **Slice / Plan item**：S5 / E5-01
- **Status**：`active`；`TASK_INDEX_V0.1.md` 同步为 `active`
- **Base branch**：`dev`
- **Latest authorized dev revision at activation**：`dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3`
- **Local tracking fact**：合同编写前本地 `dev` 与已记录的 `origin/dev` 均为 `3f343b8af0216b5e568f2c8f1ed52ac4ef824da3`，工作树干净；该 revision 是 T042 经 PR #40 合入 `dev` 的 revision
- **Remote verification fact**：2026-08-29 的 SSH `git fetch origin dev --prune` 因连接被远端关闭而失败；随后 GitHub CLI 只读 API 返回远端 `refs/heads/dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3`，与本地 `dev` 及 `origin/dev` 一致
- **Expected branch name**：`task/T051-review-summary`；本合同已授权创建

### 1.1 S5 entry 与前置事实

- S2、S3 已完成并有 T014、T022、T031～T033 及相应 Evidence 支持 Progress、Routine 五语义、修正/删除后重算和 SQLite 数据行为。
- T041/T042 已按批准的串行顺序完成；当前 `dev@3f343b8...` 包含 Recovery read-only 与 restart flow。
- `TASK_INDEX_V0.1.md` 仍记载 S4 stage acceptance gate 未单独决定；项目所有者在本次合同编写指令中明确允许在该状态进入 S5，满足 `S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md` §16.3 的替代入口。
- 当前 schemaVersion 为 2、exportVersion 为 1；Review 仍为 Renderer placeholder。T051 不改变 schema、migration、export 或 `review_results`。
- 当前 Progress 已提供包含端点的 LocalDate filter、Action/Routine 事实、时间与真实行动次数；T051 必须复用这些规范事实，不建立第二套统计公式。
- 项目所有者已在第二阶段指令中批准 T051 合同、Automation Profile 激活、实现、任务分支、commit、push 与 Draft PR；这不包含 Ready、merge、tag、release 或 docs closeout。

## 2. 目标结果

用户主动进入 Review 后，可以看到 Main 在进入时捕获的当前所在周：

- 明确的周一 `periodStartedOn` 至周日 `periodEndedOn` 周期标题；
- 该包含端点周期内的累计投入时间与真实行动次数；
- 来自现有 Progress 事实的用户确认理解与仍开放困惑；
- `target_met`、`acted`、`intentional_rest`、`not_done` 四种 Routine 显式事实分列；
- 没有事实时中性、可解释的空状态，以及读取失败时不泄露技术细节的错误状态。

进入 Review、刷新同一 review context、取消/离开、跨午夜或跨周保持页面、关闭窗口和应用重开都不写 SQLite、不生成 Record、不保存统计、不创建 `unknown` 行，也不要求用户重新录入已经存在的统计。T051 只贡献 AC-06 步骤 1；保存三个复盘输入、更新下一步和完整 AC-06 属于 T052。

## 3. 需求与设计依据

- **直接 FR**：FR-RV01、FR-RV06。
- **直接 AC**：AC-06 步骤 1；不声明 AC-06 步骤 2～5或完整 AC-06。
- **直接 D**：D-106；D-110 支持用户主动进入 Review，不引入提醒。
- **Progress 事实依据**：FR-P01、FR-P02、FR-P03、FR-P04、FR-P07、FR-P08；D-007。
- **Routine 事实回归**：FR-R04～FR-R09；D-008、D-009、D-010、D-107；ED-012、ED-016。
- **Electron / LocalDate / workflow**：ED-004、ED-017、ED-019；GW-001～GW-010。
- **受影响回归**：AC-01、AC-03、AC-04、AC-07 只验证既有事实没有退化，不重新声明完成。
- **明确不交付的 SHOULD / 延期项**：FR-P06 的周期比较仍在 S7；FR-RV07、FR-AI11 的 AI 周计划仍延期。
- **直接相关架构章节**：
  - `ARCHITECTURE_V0.1.md` §4～§6、§9；
  - `DOMAIN_MODEL_V0.1.md` §6～§8；
  - `IMPLEMENTATION_PLAN_V0.1.md` §8 E5-01 与 §10.1；
  - `TEST_STRATEGY_V0.1.md` §1～§6、§7 E2E-AC-06、§8～§10；
  - `REQUIREMENTS_TRACEABILITY_V0.1.md` §2.3、§2.5～§2.7、§2.10、§4～§5；
  - `S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md` §0～§13、S45-Q03-A、S45-Q07-A、§15～§17。

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
        - 3. Stage delta、目标与非范围
        - 4.3 Review：从事实到一个调整
        - 4.4 Renderer ownership
        - 5.1～5.4 领域关系、Routine 语义与 ReviewSummary 边界
        - 6.2 Review 周期
        - 7.1～7.2 Queries 与设计 DTO
        - 7.5 Review Repository port
        - 8. IPC、Preload、Main 与 Renderer 安全边界
        - 9.1 Recovery 与 ReviewSummary
        - 10. Task graph、共享面与实施顺序
        - 11.3 T051 — 周期事实摘要
        - 12.1、12.3、12.5～12.6 分层验证与回归
        - 13. FR / AC / D / ED 追踪
        - S45-Q03-A、S45-Q07-A
        - 15～17 风险、授权与阶段门
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md
  implementation:
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/AUTOMATION_PROFILES_V0.1.md
    - docs/implementation/profiles/standard-task-v1.json
    - docs/implementation/T041_RECOVERY_CONTEXT.md
    - docs/implementation/T042_RECOVERY_RESTART.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
```

## 4. 开始条件、依赖与 shared surfaces

### 4.1 当前已核实事实

- [x] 稳定 T051 identity、批准的 S4/S5 设计和精确目标存在。
- [x] S2 Routine 五语义与 S3 数据修正/删除/重算已经实现并有 Evidence。
- [x] 项目所有者明确允许在 S4 stage acceptance 尚未单独决定的当前状态进入 S5。
- [x] 最新本地授权 `dev@3f343b8...` 包含 T041/T042，并保持 schemaVersion 2、exportVersion 1 和 Review placeholder。
- [x] 现有稳定验证命令、FakeClock、唯一临时 SQLite/Electron `userData` 与 deterministic evidence wrapper 存在。
- [x] 未发现冻结 MUST、D-106、已批准 Q03-A 或现有 Progress/Routine 事实之间的阻塞冲突。
- [x] 项目所有者批准本合同、精确文件范围、权限和 Automation Profile，并明确激活 T051。
- [x] 激活时通过 GitHub CLI 只读 API 确认最新授权 `dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3`；工作树隔离、T051 metadata 与 `TASK_INDEX` 状态在首个实现变更前同步验证。

```yaml
dependencies:
  tasks:
    requires: [T014, T022, T033]
    blocks: [T052]
    can_parallel: []
    prefer_after: [T042]
    conflicts_with: [T041, T042]
  stage_prerequisites:
    - S2 Routine fact semantics are evidenced by EV-T022-001
    - S3 correction, deletion, recalculation and export behavior are evidenced
    - T041 and T042 are integrated in dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3
    - owner explicitly allows S5 entry while the separate S4 stage acceptance decision remains pending
  revisions:
    required_dev_base: dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3
    t041_dev_integration_revision: 695e7bcc25b33279d39e61e28a8730b9cdf16264
    t042_dev_integration_revision: 3f343b8af0216b5e568f2c8f1ed52ac4ef824da3
  shared_surfaces:
    - progress-fact-builder-and-filter-semantics
    - review-repository-and-consistent-sqlite-snapshot
    - main-clock-review-context-and-preload-api
    - review-renderer-feature-and-shell-contract
    - ac06-summary-electron-e2e
  external: []
```

T051 与已完成的 T041/T042 在 Repository、Main/Preload/API shape 和 Renderer/E2E surfaces 上存在设计级冲突，因此只基于两者已经集成后的 `dev` 串行实施。T051 完成前阻塞 T052；不得并行启动 T052 或把 T052 mutation 接口预埋进本任务。

### 4.2 Automation Profile（已激活）

- 项目所有者批准 `standard-task@1` 用于本 `implementation` 任务；无 dependency/migration/AI Provider/真实凭据/破坏性数据操作。
- `standard-task@1` 要求 disposable isolated worktree；创建 `task/T051-review-summary` 已获授权。
- 合同、`metadata/T051.json` 和 `TASK_INDEX_V0.1.md` 使用同一激活事实，并在首个实现变更前运行 metadata check。
- `docs_closeout_scope`、Ready、merge dev/main、tag、release、dependency/migration、非任务外部写入与 AI Provider/权限变化仍为 owner gates。

```yaml
execution:
  profile: standard-task@1
  activated_at: 2026-08-29T23:16:42+08:00
  valid_until: 2026-09-28T23:16:42+08:00
  additional_constraints: []
```

## 5. 允许修改范围

### 5.1 合同编写阶段（已结束）

当前只允许创建或修改：

- `docs/implementation/T051_REVIEW_SUMMARY.md`
- `docs/implementation/metadata/T051.json`

该阶段已在项目所有者批准并激活本合同后结束；历史草案只修改了上述两个文件。

### 5.2 已批准并激活的精确实现范围

以下范围已由项目所有者整体批准并激活：

- `src/domain/review.ts`
- `src/domain/index.ts`
- `src/application/review.ts`
- `src/application/progress.ts`（仅抽取/复用规范 Progress fact mapping；不得改变既有公式）
- `src/application/ports/persistence.ts`
- `src/contracts/review.ts`
- `src/contracts/shell.ts`
- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/review-contexts.ts`
- `src/main/review-ipc.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/review/ReviewPage.tsx`
- `src/renderer/src/styles.css`
- `tests/unit/review-domain.test.ts`
- `tests/unit/review-application.test.ts`
- `tests/unit/review-contexts.test.ts`
- `tests/unit/progress-application.test.ts`（仅 Progress/Review 同 filter 交叉断言）
- `tests/integration/review-sqlite.test.ts`
- `tests/integration/review-ipc.test.ts`
- `tests/integration/main-foundations.test.ts`
- `tests/e2e/review-summary.e2e.test.ts`
- `tests/e2e/progress-core-loop.e2e.test.ts`（仅受影响 Progress 事实一致性回归）
- `tests/e2e/shell.e2e.test.ts`
- `docs/implementation/T051_REVIEW_SUMMARY.md`
- `docs/implementation/metadata/T051.json`
- `docs/implementation/TASK_INDEX_V0.1.md`（激活时只记录任务状态与基线事实）
- `.tmp/evidence/T051-*.json`（ignored、脱敏、命令事实 artifact）

候选 hosted CI 通过后的 documentation impact matrix 必须评估本合同、metadata、`TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md`、README 与 Draft PR 正文。只有项目所有者批准精确 docs closeout scope 后，才允许修改对应长期记录并创建独立 docs closeout commit。

如果实现需要修改上述列表之外的文件，或需要改变 Progress 公共语义/API、schema、export、依赖、CI、recording/delete/recovery context，必须停止受影响工作并申请合同范围变更。

## 6. 明确非范围

- 保存、读取、编辑或删除 `ReviewResult`；三个复盘输入（confirmed progress、main obstacle、next adjustment）。
- 更新 Goal 当前下一步、创建/选择 Action、加入 Today、任何普通或 Review mutation；T052 全部范围。
- migration、schemaVersion、`review_results` schema/index、exportVersion、export shape、导入或恢复。
- 上周/历史周选择、周期比较、趋势、完成率、失败率、评分、掌握度、排名、streak 或人格评价。
- 历史 Routine schedule 重建、计划分母、推断 unknown、持久化 unknown、预生成缺行或把缺行计为 `not_done`。
- 提醒、通知、自动打开 Review、后台任务、AI 总结、AI 周计划、Provider、AI 上下文、草稿或写权限。
- 新增依赖、升级/移除依赖、修改 `package.json`、lockfile、migration、Workflow 或治理工具。
- AC-06 步骤 2～5、完整 AC-06、S4/S5 final gate、G4、S6、S7、Ready、merge、main、tag 或 release。

## 7. 必须保持的不变量

### 7.1 周期、LocalDate 与 context

- 默认周期为用户进入 Review 时 Main Clock snapshot 的当前所在周，周一至周日；`periodStartedOn` 和 `periodEndedOn` 均为 LocalDate 包含端点。
- 周边界不依赖 UTC、SQLite week number、系统 locale 或 Renderer 日期；跨月、跨年和闰年保持相同算法。
- `BeginReview` 不接受 Renderer 提交可信日期、星期、统计或 filter；Main 生成 `reviewContextId` 并绑定 trusted sender 与捕获周期。
- `GetReviewSummary` 只接受 sender-bound context ID；伪造、跨 sender、已取消、reload/navigation/窗口关闭后 stale context 被拒绝且零业务写入。
- 同一 context 跨午夜或跨周保持原捕获周期；新进入/重开才使用新的 Main Clock 周期，页面不得静默移动。

### 7.2 Progress 与 Routine 事实

- ReviewSummary 与相同 `{ goalId: null, from: periodStartedOn, through: periodEndedOn }` filter 的 Progress 事实使用同一规范 builder/mapping；不得复制 SQL 或另写冲突公式。
- 时间和真实行动次数保持现有 Progress 定义：每个 ActionRecord 是真实行动；Routine 只有 `target_met`、`acted` 计真实行动，其时长按既有规则聚合，`intentional_rest`、`not_done` 和缺行不计行动。
- `target_met`、`acted`、`intentional_rest`、`not_done` 四种显式 Routine outcome 分列；不得合并为二元成功/失败。
- 缺行保持 `unknown` 语义：不保存 unknown 行、不生成虚拟失败记录、不计入 `not_done`、target met、失败率或任何分母。本任务不重建历史 schedule，因此不制造无法证明的 unknown day 列表。
- `plannedForDate` 与非计划日真实行动事实继续保持；`target_met` 和计划日达成不混为一项。
- 确认理解与开放困惑来自同一周期 Progress snapshot；revoked Understanding、resolved Confusion 和周期外 Record 不进入摘要。

### 7.3 Query、SQLite 与历史守恒

- Review Repository 在单个 SQLite 只读 transaction 中取得 ActionRecord、RoutineRecord、Understanding 与 Confusion 事实；不得串行多个 IPC 拼接不一致 snapshot。
- Repository 只返回事实行；pure builder 负责周期与事实组合，不在 SQL 中解释评分、掌握度、失败或用户人格。
- `BeginReview`、`GetReviewSummary`、context 创建/刷新/取消、页面进入/离开和错误重试不写业务 SQLite，不持久化统计、context、cache、unknown 或 ReviewResult。
- 补记、改日或删除 Record 后的新 context/summary 从当前事实重算；历史 ID、occurredOn、outcome、分钟、子事实和 createdAt 不被 Review 修改。
- 查询前后完整业务 snapshot 相同；应用重开不从 Renderer cache 或 ReviewResult 恢复统计。

### 7.4 Electron、Renderer 与错误边界

- 只暴露固定窄 API：`window.myTracer.review.begin({})`、`getSummary({ reviewContextId })`，以及仅清理内存 context 的 `cancel({ reviewContextId })`；不暴露 arbitrary channel、Node、Electron、SQL、Repository、路径、凭据或 Provider。
- Main 对 trusted sender/origin、恰好一个对象、精确 keys、context ID 和 nullability 进行运行时校验；TypeScript 类型不能替代校验。
- Renderer 只显示 Main DTO，不计算周边界、时间、次数、Routine outcome 或 unknown；空状态不暗示失败，错误不泄露 SQL、绝对路径、堆栈或用户正文。
- 错误至少稳定区分 `validation`、`context-invalid`、`context-stale` 与 `persistence-failed`；错误、取消和重试不改变业务数据。
- AI disabled/not-configured/failure 不影响 Review；T051 不调用 Provider。
- 自动化只使用 FakeClock、唯一临时 SQLite/Electron `userData` 和 fake/disabled AI；禁止真实用户数据库、真实凭据或 live Provider。

## 8. 交付物

- [ ] 周一至周日 LocalDate pure boundary 与 ReviewSummary pure builder。
- [ ] 复用 Progress fact mapping/formula 的 Review Repository consistent snapshot。
- [ ] sender-bound `ReviewContextStore`、`BeginReview`、`GetReviewSummary` 和 context cancel/cleanup。
- [ ] 固定 Review DTO、IPC、runtime validation、trusted sender/origin 与窄 Preload API。
- [ ] Review feature 的周期标题、只读摘要、四种 Routine outcome 分列、空/busy/error 状态。
- [ ] 周边界、同 filter 一致性、unknown absence、零写入、SQLite snapshot、IPC/API shape 和 Electron E2E 测试。
- [ ] AC-01、AC-03、AC-04、AC-07 受影响回归与完整 `verify`。
- [ ] `EV-T051-001` 的 deterministic candidate artifact、独立 review 与准确 manual pending 边界。
- [ ] candidate CI 后的 documentation impact matrix 与 owner-gated docs closeout 提案。

## 9. 验收标准

1. FakeClock 为周一、周日、跨月、跨年和闰年日期时，Main 捕获正确的周一 `periodStartedOn` 与周日 `periodEndedOn`，两个端点均包含。
2. Renderer 不能提交或覆盖周期、统计、Routine outcome 或 unknown；同一 context 跨周不静默移动，新 context 使用进入时当前周。
3. Summary 的 `totalDurationMinutes`、`realActionCount`、Action facts、确认理解与开放困惑和相同包含端点 filter 的 Progress 结果一致。
4. `target_met`、`acted`、`intentional_rest`、`not_done` 分列且计数正确；非计划日真实行动保持事实，计划达成不被扩大解释。
5. 一个没有 RoutineRecord 的观察日不产生数据库行、DTO 虚拟 `not_done`、失败、达标或分母；unknown policy 明确保持 absence。
6. 一致性 Repository query 在一个只读 SQLite transaction 中返回周期事实；查询前后完整业务 snapshot 相同，修改/补记/删除测试 Record 后重新查询从当前事实重算。
7. `BeginReview`、`GetReviewSummary` 和 cancel 在正常、重复、错误、跨 sender、stale context、reload/navigation、窗口关闭和重开路径均不写业务 SQLite或持久化 context/summary。
8. Review 页面主动进入后显示明确周期标题、时间、真实行动次数、确认理解、开放困惑和四列 Routine facts；无事实时中性说明“没有记录事实”而非失败。
9. IPC/Preload 只暴露合同中三种窄方法；不可信 sender、缺失/多余 keys、伪造 context/date/statistics 和 arbitrary channel 被拒绝，错误不泄露敏感技术信息。
10. E2E 在唯一临时 `userData` 中准备当前周事实与一个缺行观察日，进入 Review，交叉验证 Progress，跨 Sunday→Monday 保持 context 周期，离开/重开后重新捕获周期，并证明完整 snapshot 零写入。
11. 页面和 DTO 不含趋势、比较、score、mastery、completion/failure rate、streak、overdue、提醒、AI 文本或人格评价字段/文案。
12. 没有新增或改变 schema、migration、`review_results`、export、依赖、Goal/Action/Routine/Today mutation、ReviewResult 或 T052 行为。
13. AC-01、AC-03、AC-04、AC-07 受影响路径在同一 Implementation Candidate revision 通过；T051 不重新声明这些 AC。
14. `EV-T051-001` 只从真实结果声明 FR-RV01、FR-RV06、D-106、D-110 的主动进入边界、相关 Progress/Routine 回归与 AC-06 步骤 1 candidate；人工体验保持 `pending`，不声明完整 AC-06、S5 acceptance 或 G4。
15. Implementation Candidate 相对最新授权 `dev` 的完整 diff、Integration Freshness、affected regression、deterministic evidence 与 independent review 没有未处理 required finding。
16. T051 完成不自动启动 T052，不授权 migration/export、Ready、merge、main、tag、release、S6 或 S7。

## 10. 验证计划

以下命令只在项目所有者批准并激活合同后执行。所有测试使用 FakeClock、唯一临时 SQLite/Electron `userData`，核心验证不使用 live Provider。

### 10.1 针对性验证

```powershell
npm.cmd run test:unit -- tests/unit/review-domain.test.ts tests/unit/review-application.test.ts tests/unit/review-contexts.test.ts tests/unit/progress-application.test.ts
npm.cmd run test:integration -- tests/integration/review-sqlite.test.ts tests/integration/review-ipc.test.ts tests/integration/main-foundations.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/review-summary.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

### 10.2 受影响回归与 aggregate

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
git diff --check
```

`verify` 已包含 build 和 Electron E2E；不得用它代替 hosted CI、manual、package 或 final-head 证据。T051 不改变 migration/export，不运行 migration/export v2 或 package/NSIS 作为任务自身完成条件；阶段最终 gate 可按独立授权执行更广验证。

### 10.3 Deterministic evidence capture

```powershell
node tools/evidence/capture-command.mjs --task T051 --gate task-candidate --base-revision <latest-authorized-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

wrapper 使用显式 argv，保留真实 exit code，只写 ignored `.tmp/evidence/` 的脱敏 JSON；不得记录 stdout/stderr、绝对用户路径、完整环境、凭据、SQLite 或用户正文。artifact 是 Evidence 事实输入，不自动接受任务。

### 10.4 人工步骤

1. 在 Windows 应用中从 Review 主导航主动进入，确认周期标题明确为进入时当前周的周一至周日。
2. 检查时间、次数、理解、开放困惑和四类 Routine 事实无需手工重录，空状态与错误状态中性、清楚。
3. 在页面跨周保持打开后确认周期不静默移动；离开并重新进入后才捕获新周。
4. 确认没有趋势、评分、掌握度、完成率、失败率、streak、提醒或 AI 周计划表达。

项目所有者未执行这些步骤时，manual acceptance 必须保持 `pending`。

### 10.5 验证环境

- **OS**：Windows 11 x64
- **Node**：24.18.0
- **npm**：11.16.0
- **Electron**：以锁定 `package-lock.json` 为准
- **数据根**：每 case 唯一临时 SQLite / Electron `userData`
- **AI**：fake、disabled 或 not-configured；不使用 live Provider
- **Source revision**：Implementation Candidate 时填写

## 11. Evidence 要求

- **Proposed Evidence ID**：`EV-T051-001`。
- **Claim boundary**：FR-RV01、FR-RV06、D-106、D-110 的主动进入边界、FR-P01～P04/P07/P08 与 Routine 五语义回归、AC-06 步骤 1 candidate；不声明 ReviewResult、完整 AC-06、S5 acceptance、G4、T052、AI 或 S7。
- **Required bindings**：合同、需求/设计章节、original/latest dev base、Implementation Candidate、task delivery revision、PR head/test-merge revision、命令、Windows 环境、exit code、artifact、manual status、限制与 supersedes。
- **Deterministic artifact**：`.tmp/evidence/T051-task-candidate-*.json`；只包含 allowlisted facts。
- **Hosted CI**：early、candidate、docs final-head 与 post-merge 分开记录；PR source head 和 test-merge revision 不得混用。
- **Failure retention**：失败/partial artifact、CI 与 manual 结果保留，后续成功通过 `supersedes` 关联。
- **Ledger gate**：实现期不得预写通过 Evidence；只有真实 candidate CI、documentation impact matrix 和项目所有者精确 docs closeout 授权后，才允许更新 `ACCEPTANCE_EVIDENCE_V0.1.md`。

## 12. Git、GitHub、外部与数据权限

### 12.1 已结束的合同草案权限（历史事实）

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

该权限块只记录第一阶段历史边界，现已由第 12.2 节的 active 权限取代。

### 12.2 已批准并激活的执行权限

以下权限已由项目所有者整体批准本合同并明确激活 T051 后生效：

```yaml
permissions_active_execution:
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

- **允许 Git/GitHub 写目标**：一个 disposable T051 worktree、`task/T051-review-summary`、该分支的 reviewable commits、push、一个 target `dev` 的 Draft PR、同一 PR 正文更新和 GitHub Actions T051 验证。
- **不允许**：mark Ready、merge、force-push、remote branch deletion、ruleset/secret/workflow 修改、Issue/Project、main、tag、release 或非 T051 外部写入。
- **网络访问**：只允许 Git/GitHub task publication、PR/CI 查询与已有依赖的正常验证；不安装依赖、不访问 Provider。
- **新增/升级依赖**：无；需要时停止并申请 `dependency_change` owner gate。
- **migration / export**：无；需要时停止并申请精确合同变更，不得借用 T052 的批准设计。
- **数据破坏性操作**：无；禁止真实 userData、真实凭据和 destructive migration。
- **Evidence**：允许创建 ignored deterministic artifacts；长期 Evidence ledger 写入受 docs closeout owner gate 控制。

### 12.3 Integration

```yaml
integration:
  target_branch: dev
  original_base_revision: dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3
  latest_authorized_dev_revision: dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3
  verified_against_revision: dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3
  freshness_required: true
  affected_regression_required: true
  status: fresh
  refresh_method: github-cli-read-only-api-confirmed-remote-dev
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

激活时 SSH fetch 仍失败，但 GitHub CLI 只读 API 已确认远端 `dev` 与本地基线一致，因此当前状态为 `fresh`。从该 revision 创建隔离 worktree；candidate 前必须重新确认并记录 `fresh`、`refreshed-and-passed` 或真实 blocker，不能复用较早绿色结果。

## 13. 风险与停止条件

- **R1 / 双统计真相**：若 Review 需要复制 Progress SQL/公式或改变 Progress 公共语义，停止并先提出最小共享-builder范围调整。
- **R2 / unknown 变失败**：若 UI/测试要求重建历史 schedule、生成 unknown 行或失败分母，停止；这些行为超出批准语义。
- **R3 / context 失控**：若 Renderer 必须提交可信 period/statistics 或 context 需要持久化，停止并申请设计/权限变更。
- **R4 / snapshot 不一致**：若 Repository 无法在一个 SQLite 只读 transaction 取得相关事实，停止并报告 testability/architecture blocker。
- **R5 / T052 混入**：出现 ReviewResult、三个输入、Goal 下一步、migration/export 或 mutation 接线时立即停止该部分。
- **R6 / 基线漂移**：若最新授权 `dev` 改变 Progress 公式、Routine semantics、schema/export、Review ownership 或 T051 task state，重新复核合同，不静默换 base。
- **R7 / 权限扩大**：需要新文件、依赖、migration、真实数据、Provider、非任务外部写或未批准 GitHub 操作时停止。
- **R8 / 证据不可绑定**：无法把命令、artifact、PR head/test-merge、manual status 与确切 revision 绑定时，不声明通过。

任何冻结 MUST、D-106、五种 Routine 语义、LocalDate、历史守恒、Electron 安全边界或批准设计冲突都使用 Escalation Proposal；不得自行选择替代语义。

## 14. 完成、owner gates 与报告

T051 只有在合同批准并激活后，满足以下事实才形成 implementation-complete candidate：

- 可观察 ReviewSummary 行为存在，目标和 16 条验收标准均通过；
- targeted、affected regression、aggregate `verify`、metadata 和 diff integrity 绑定 exact candidate revision；
- complete diff 和独立只读 review 无未处理 required finding；
- deterministic artifact 与 candidate hosted CI 绑定正确 source/test-merge revision；
- 人工状态和限制准确，不把 pending 写成 pass；
- 没有 dependency、migration、export、AI、T052 或范围漂移。

candidate hosted CI 通过后必须暂停并请求项目所有者批准精确 docs closeout scope；Ready、merge、`dev -> main`、tag、release 和 T052 启动始终分别由项目所有者决定。

最终或阶段性报告必须列出：

- 新增/修改文件与用户可见结果；
- FR-RV01/RV06、D-106、AC-06 步骤 1及相关 Progress/Routine 覆盖；
- 实际命令、环境、结果与 artifact；
- branch、commit、PR、CI、source head/test-merge/integration revision；
- automated/manual acceptance 状态；
- 风险、已知缺口、未验证项和远端/平台限制；
- 是否发现 requirement conflict、scope change 或 permission change。

## 15. 激活事实与后续 owner gates

项目所有者于 2026-08-29：

1. 整体批准第 5.2、7～14 节的实现范围、验证、Evidence artifact 与 Git/GitHub 权限；
2. 激活 `standard-task@1`，有效期与附加约束按第 4.2 节同步到 sidecar；
3. 授权把 `TASK_INDEX` 的 T051 更新为 `active`，创建隔离 worktree、任务分支、reviewable commits、push 和 target `dev` 的 Draft PR；
4. 指示 Draft PR 推送成功后立即停止，不自主查询或等待 CI。

长期 `ACCEPTANCE_EVIDENCE_V0.1.md`、docs closeout commit、Ready、merge、main、tag、release 与 T052 启动仍需后续精确 owner gate。

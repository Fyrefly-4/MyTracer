# MyTracer v0.1 S4/S5 恢复与复盘整体设计

> 阅读范围：本文保留相关技术设计、产品约束与风险验证目标；任务编号和版本只表达原设计来源，不是当前执行清单。当前实现与锁定版本需结合代码、测试和工程决定判断。
>
> 普通工作不需要本阶段合同、账本、审批或聚合验收；当前范围与权限以根目录 [AGENTS.md](../../AGENTS.md) 和 owner 当次请求为准。任务顺序、旧授权与阶段门已移至[历史执行记录](../implementation/archive/stage-execution/S4_S5_EXECUTION.md)，仅在追溯或 owner 明确启用相应阶段流程时查阅。

<a id="0-文档用途与权限边界"></a>

<a id="1-stage-information"></a>

<a id="2-baseline-manifest-与冲突核对"></a>

<a id="21-可直接依赖的当前事实"></a>

<a id="22-未发现的阻塞冲突"></a>

<a id="23-需要显式隔离的两处张力"></a>

## 3. Stage delta、目标与非范围

### 3.1 阶段目标与可观察结果

S4/S5 完成后，用户可以在同一应用、同一核心数据和相同 LocalDate 语义下完成：

```text
历史 Goal / Action / Routine / Record 已存在
  → 用户显式进入某个 Goal 的 Recovery
  → 查看此前进展、确认理解、开放困惑和当前下一步
  → 看到“距上次真实行动 N 天”或“尚无真实行动记录”的中性事实
  → 不补齐空白日、不产生失败/逾期/断签信息
  → 用户明确暂停/结束/清理过时内容
  → 用户确认一个可以重新开始的小 Action
  → 通过普通 Application Command 设置当前下一步并按需选入 Today
  → 继续产生正常 Record
  → 用户主动进入 Review
  → 查看周一至周日的事实摘要
  → 确认一个真实进展、一个主要阻力、一个下一周期调整
  → 可选、明确更新一个 Goal 的当前下一步
  → 关闭并重开后 ReviewResult 存在；事实摘要仍从当前 Record 重算
```

### 3.2 S4/S5 包含

| 能力 | 阶段处理 |
|---|---|
| Recovery 入口 | Goals 内显式进入，不新增主导航、不自动弹出 |
| RecoveryContext | Goal 中心的一致性只读上下文、历史事实、开放困惑、当前下一步和距上次真实行动天数 |
| Recovery 行动 | 用户确认后调用普通 Goal/Action/Today/Routine 命令，不建立 Recovery 专用数据写入口 |
| ReviewSummary | 周一至周日、复用 Progress 事实、四种显式 Routine outcome 分列，缺行继续为 unknown |
| ReviewResult | 保存三个用户输入和可空 Goal 关联；事实摘要不复制进结果 |
| 下一步调整 | 只有用户明确选择时才创建/选择 Action 或更新 Goal 当前下一步 |
| 持久性 | Recovery 无新增持久化；ReviewResult 重开和 Goal 删除 detach；采用已批准的 schema v3 / export v2 设计，但只在 T052 获精确 migration 权限后执行 |
| 边界 | Domain pure builder、Application Command/Query、窄 Repository、固定 IPC/Preload、feature-local Renderer |
| 验收 | AC-05、AC-06 自动化与项目所有者人工验收；既有 AC 受影响回归 |

### 3.3 明确非范围

- 自动判断“用户返回”、启动时弹窗、通知、提醒、后台督促或主动 Recovery；
- 固定或隐藏的停滞天数阈值、逾期、deadline、优先级、失败率、完成率或压力式 streak；
- 为 Recovery 保存 `stalled`、恢复队列、建议、dismiss、lastSeen、返回事件或自动状态；
- 为 Review 保存统计摘要、评分、掌握度、生产力分数、评价标签、人格判断或完整周计划；
- 自动 pause/end/complete/cancel/reschedule Goal、Action 或 Routine；
- Recovery/Review 修改、移动、补齐或重新归属历史 Record；
- AI Provider、AI 总结、AI 建议、AI 自动计划、长期记忆、对话历史或 AI 写权限；
- 自动导入恢复、回收站、自动备份、同步、账号、复杂日历、可配置周起止日或 S7 周期比较；
- 新用户一级概念、独立 Recovery 主视图、Review 内容管理模块或通用工作流平台；
- T061～T072 的实现或验收声明。

## 4. 完整用户流程与 UI ownership

### 4.1 Recovery：从识别到重新开始

```mermaid
flowchart TD
    A["用户在 Goals 显式进入 Recovery"] --> B["GetRecoveryContext 一致性只读快照"]
    B --> C["历史成果 / 最近真实行动 / 开放困惑 / 当前下一步"]
    C --> D{"用户判断内容是否仍重要"}
    D -->|保留| E["继续使用当前下一步或选择现有 pending Action"]
    D -->|暂时不做| F["确认 PauseGoal 或 PauseRoutine"]
    D -->|不再继续| G["确认 EndGoal / EndRoutine 或正常 Action 终态"]
    E --> H["Renderer 暂存一个小行动草稿"]
    F --> H
    G --> H
    H --> I{"用户确认"}
    I -->|取消| C
    I -->|确认| J["普通 Application Command"]
    J --> K["设置当前下一步；可选加入当前 Today"]
    K --> L["用户正常开始并记录"]
```

Recovery 不是自动判断器。`daysSinceLastRealAction` 只是 `asOfLocalDate - lastRealActionOn` 的事实差值；系统不返回 `stalled=true`，不按天数自动排序为“失败”，也不改变 Goal 状态。用户负责判断内容是否仍重要。

Recovery 的已批准默认上下文为：当前下一步、最近一次真实 Record、该 Goal 下未撤销的确认 Understanding、全部 open Confusion 和指向完整 Progress 的入口。它不使用“最近 N 条”隐藏默认；若完整成果较多，Renderer 通过渐进披露展示，而不是截断或新建持久化摘要。

### 4.2 Recovery 与已有生命周期操作

- pause/end 使用既有 Goal/Routine 命令并保留全部历史。
- Goal pause/end 不自动 pause/end 关联 Routine；Routine 生命周期继续遵循 S2-Q07-A。
- 过时 Action 使用既有 complete/cancel/reschedule 语义；rescheduled 仍复用同一 Action ID，旧 Record 不移动。
- 永久删除不在 Recovery 中提供捷径。若用户明确需要删除，跳转既有 Data Control 影响预览、二次确认和事务流程。
- 创建小 Action、选择既有 pending/rescheduled Action、设置当前下一步和加入 Today 都必须由用户逐项确认；系统不能根据 `daysSinceLastRealAction`、困惑或旧状态自动执行。
- Recovery 完成不是 Record，也不增加 Progress 次数；只有之后保存的正常 ActionRecord/RoutineRecord 才成为真实行动事实。

### 4.3 Review：从事实到一个调整

```mermaid
flowchart TD
    A["用户主动进入 Review"] --> B["Main 捕获一个周一至周日周期"]
    B --> C["GetReviewSummary 复用 Progress 事实"]
    C --> D["展示时间 / 真实行动次数 / 确认理解 / 开放困惑"]
    C --> E["分列 target_met / acted / intentional_rest / not_done"]
    C --> F["无 Record 保持 unknown，不进入失败统计"]
    D --> G["用户填写一个真实进展"]
    E --> H["用户填写一个主要阻力"]
    F --> H
    G --> I["用户填写一个下一阶段调整"]
    H --> I
    I --> J{"是否明确更新某个 Goal 下一步"}
    J -->|否| K["确认保存 ReviewResult"]
    J -->|是| L["选择 Goal 与 existing/create-and-use 下一步"]
    L --> K
    K --> M["CompleteReview 单事务；或按批准方案执行普通命令"]
    M --> N["重开后结果存在；摘要从当前事实重算"]
```

Review 只要求三段简短用户输入，不要求复制时间、次数、理解或 Routine 统计。Review UI 不提供“分数”“达标率”“失败率”“连续天数”“掌握度”或自动结论字段。

### 4.4 Renderer ownership

- **Goals feature**：拥有 Recovery 入口、选中 Goal、只读上下文、恢复草稿、确认/取消和 mutation 后刷新；不拥有 SQL 或事实计算。
- **Review feature**：拥有周期标题、ReviewSummary 展示、三个输入草稿、可选 Goal/Action 选择、确认/取消、保存结果和错误文案。
- **AppShell/navigation**：保持现有六 section 和默认 Today；不增加 Recovery 主导航，不解释 Recovery/Review DTO。
- **Progress feature**：保持事实查询职责；Recovery/Review 可以链接进入或复用 Application 层纯聚合，不复制 Renderer 计算。
- **Data feature**：继续负责永久删除和导出；Recovery/Review 不复制删除确认或文件能力。

## 5. 领域关系、状态与不变量

### 5.1 对象关系与边界

```mermaid
flowchart LR
    G[Goal] --> A[Action]
    G --> R[Routine]
    A --> AR[ActionRecord]
    R --> RR[RoutineRecord]
    AR --> U[Understanding]
    AR --> C[Confusion]
    AR --> P[Progress facts]
    RR --> P
    G --> RC[RecoveryContext]
    P --> RC
    P --> RS[ReviewSummary]
    RS --> UI[Review user input]
    UI --> RRSLT[ReviewResult]
    RRSLT -. optional .-> G
```

| 概念 | S4/S5 职责 | 不得承担的职责 |
|---|---|---|
| Goal | Recovery 的上下文中心；ReviewResult 可选关联；当前下一步仍为同 Goal pending Action | 不保存停滞状态、Review 分数或自动选择 |
| Action | 当前/候选小行动；正常生命周期和 Today 入口 | 不因 Recovery/Review 自动转换；不承载 Review 文本 |
| Routine | 为 Progress/Review 提供事实；可由用户显式 pause/end | 不因 Goal Recovery 自动联动；不预生成 unknown |
| Record | 历史事实和统计唯一来源 | Recovery/Review 不修改、移动、补齐或评价 Record |
| Progress | 时间、真实行动次数、理解和开放困惑的规范事实聚合 | 不保存累计表，不根据缺行推断失败 |
| RecoveryContext | Goal + Progress + 当前 Action 的只读投影 | 不是实体、不落库、不写状态、不创建建议 |
| ReviewSummary | 一个周一至周日周期的只读事实投影 | 不复制进 ReviewResult，不保存评分或推断 |
| ReviewResult | 三个用户确认文本、周期和可空 Goal 关联 | 不复制统计、不保存 AI 草稿、不成为一级管理模块 |

### 5.2 长期未推进的事实定义

```text
lastRealActionOn(goalId)
  = max(
      ActionRecord.occurredOn where Action.goalId = goalId,
      RoutineRecord.occurredOn where Routine.goalId = goalId
        and outcome in [target_met, acted]
    )

daysSinceLastRealAction
  = lastRealActionOn is null
      ? null
      : LocalDateDifference(asOfLocalDate, lastRealActionOn)
```

约束：

- `intentional_rest`、`not_done` 和缺行 `unknown` 不是“真实行动”，不能刷新 `lastRealActionOn`。
- 0 分钟的有效 ActionRecord 或 `target_met/acted` RoutineRecord 仍是真实行动。
- 没有 Record 时不使用 Goal/Action/Routine 的 `createdAt` 或 `updatedAt` 代替真实行动日。
- `daysSinceLastRealAction` 只在 Query 时计算，不持久化、不驱动 mutation、不作为逾期或失败标签。
- S4 只在用户已显式选择的单个 Goal Recovery 上下文中展示该事实；不提供跨 Goal 的“长期未推进”列表、筛选、排序或自动标记，也不声明完成留在 S7 的 FR-P05。
- Goal/Routine 当前关联可按批准删除规则变为 null；被删除 Goal 不再有 Recovery 入口，detached Routine 的历史继续进入全局 Progress/Review，但不再属于已删除 Goal。

### 5.3 五种 Routine 语义在 Review 中的保持方式

| 语义 | ReviewSummary 表达 | 禁止表达 |
|---|---|---|
| `target_met` | 明确的“达到最低行动”事实数/明细 | 不提升为掌握、成功人格或 streak |
| `acted` | 明确的“有所行动”事实数/明细，并计入真实行动 | 不与 target_met 合并为达标 |
| `intentional_rest` | 明确的用户主动休息事实 | 不计失败、不解释为拖延 |
| `not_done` | 明确的用户确认未进行事实 | 不扩展为人格评价或自动原因 |
| `unknown` | 没有 Record 的缺失事实；不进入四种显式 outcome 数量 | 不持久化、不转换为 not_done、不生成失败率 |

由于 v0.1 不保存 schedule 历史，Review 不构建可追溯的历史“应计划日总数”或完成率。测试只需证明一个缺行计划日未被计入 `not_done` 或其他显式 outcome；不得用当前 schedule 冒充已变更配置前的历史计划事实。

### 5.4 ReviewResult 不变量

- `confirmedProgress`、`mainObstacle`、`nextAdjustment` 均为用户确认的非空轻量自然语言；不建立原因分类或评分枚举。
- 事实摘要不复制进 ReviewResult；修改或删除 Record 后，下一次 ReviewSummary 从剩余事实重算，但已保存的用户输入保持原文本。
- `relatedGoalId` 可空；Goal 永久删除时使用既有 `ON DELETE SET NULL` 语义保留 ReviewResult。
- 下一步更新是可选、独立的用户决定；没有选择时 Review 完成只写 ReviewResult。
- ReviewResult 不自动 pause/end Goal，不自动 create/complete/cancel/reschedule Action，不写 TodaySelection，除非用户在确认 DTO 中明确选择了批准的下一步动作。
- ReviewResult 不保存 AI 来源、对话、统计快照、评分、掌握度、失败率、连续天数或提醒状态。

## 6. LocalDate、跨日、重开与历史行为

### 6.1 Recovery 日期

- `GetRecoveryContext` 在 Query 开始读取一次 `ClockPort.snapshot()`，`asOfLocalDate` 使用该 snapshot 的本地日期。
- `lastRealActionOn` 使用 Record 的权威 `occurredOn`，不使用 UTC Instant、查询日或 entity updatedAt。
- 应用重开、刷新或跨日后重新 Query，`daysSinceLastRealAction` 可以随当前 LocalDate 变化；历史 Record 和 `lastRealActionOn` 不变化。
- Recovery 页面跨午夜后执行 `SelectActionForToday` 时，普通 Today Command 使用命令开始时的新当前 LocalDate；Renderer 成功后重新查询并明确显示实际日期。

### 6.2 Review 周期

- 周范围固定为周一至周日，使用 LocalDate 包含端点，不依赖数据库周编号、UTC 日期或系统 locale 周设置。
- Review 页面打开时 Main 捕获一个明确 `periodStartedOn` 和派生的 `periodEndedOn = periodStartedOn + 6`，并返回给 Renderer 展示。
- 若页面跨午夜或跨周保持打开，保存仍绑定页面展示的捕获周期；不能在保存时静默改为新一周。reload/navigation/窗口关闭后旧 context 失效，用户重新进入得到新周期。
- ReviewSummary 只读取 `occurredOn` 位于捕获周期内的 Record；补记/改日后重新 Query 会反映新的事实位置。
- 重开应用后同一周期的 ReviewResult 必须可读取；ReviewSummary 从 SQLite 当前事实重算，不能从旧 ReviewResult 恢复统计。
- 已批准使用用户进入时的当前所在周作为默认；具体周期必须明确显示且不能静默移动。

## 7. Application、Queries、Commands 与事务

以下名称是设计级接口，用于固定意图和边界；后续变更可以在语义不变时微调技术命名，但不能合并为任意 CRUD、raw SQL 或通用 IPC。

### 7.1 Queries

| Task | Query | 主要输入 | 输出与约束 |
|---|---|---|---|
| T041 | `GetRecoveryContext` | `goalId` | Goal 中心一致性 snapshot；历史事实、当前下一步、open Confusion、确认 Understanding、last real action；零写入 |
| T051 | `BeginReview` | 无可信日期；使用 Main Clock | 捕获 reviewContextId、period start/end、ReviewSummary 和已有 ReviewResult；只创建 sender-bound 内存 context，不写业务数据 |
| T051 | `GetReviewSummary` | 由 Main context 绑定的周期 | 可作为 BeginReview 内部 Application Query；不接受 Renderer 提交统计、星期或 arbitrary SQL filter |
| T052 | `GetReviewResult` | context 捕获的 period 或受校验的 period start | 返回该周期已保存的用户输入；不复制 Summary |

### 7.2 设计 DTO

```text
RecoveryContextDto
  asOfLocalDate
  goal
    id, name, status
  lastRealActionOn?
  daysSinceLastRealAction?
  currentNextAction?
  pendingActions[]
  latestRealRecord?
  confirmedUnderstandings[]
  openConfusions[]

ReviewSummaryDto
  periodStartedOn
  periodEndedOn
  totalDurationMinutes
  realActionCount
  actionRecords[]
  routineRecords[]
  understandings[]
  openConfusions[]
  routineOutcomeCounts
    targetMet
    acted
    intentionalRest
    notDone
  unknownPolicy = "absence-is-unknown-not-counted-as-not-done"

ReviewResultDto
  id
  periodStartedOn
  periodEndedOn              // 派生，不要求重复持久化
  confirmedProgress
  mainObstacle
  nextAdjustment
  relatedGoalId?
  createdAt
  updatedAt
```

Recovery/Review DTO 不返回 failure rate、streak、score、mastery、overdue、stalled boolean、AI 文本或人格标签。排序使用明确的 LocalDate、createdAt 和 ID，不依赖 SQLite 隐含行序。

### 7.3 Commands

| Task | Command | 事务结果 |
|---|---|---|
| T042 | 既有 `PauseGoal/EndGoal/PauseRoutine/EndRoutine` | 用户确认后按既有生命周期更新；历史和关联守恒 |
| T042 | 既有 Action transition Commands | 用户明确 complete/cancel/reschedule；保留旧 Record，遵循 current-next resolution |
| T042 | `CreateAndSetGoalCurrentNextAction`（设计名） | 在一个普通 Application 事务创建同 Goal pending Action 并设为当前下一步；不自动加入 Today |
| T042 | 既有 `SetGoalCurrentNextAction` / `SelectActionForToday` | 选择 existing Action；Today 仍由用户单独决定 |
| T052 | `CompleteReview`（设计名） | 保存/更新 ReviewResult；可选在同一事务执行用户确认的下一步 resolution；无选择时不修改 Goal/Action |

`CreateAndSetGoalCurrentNextAction` 是通用 Goal/Action Command，不是 Recovery 专用数据库入口。若项目所有者选择复用 `CreateAction` + `SetGoalCurrentNextAction` 两步方案，Renderer 必须准确报告部分成功并允许恢复；不得在前一步成功、后一步失败时谎报“全部失败”。该选择见第 14 节。

### 7.4 `CompleteReview` 的确认输入

```text
CompleteReviewInput
  reviewContextId
  confirmedProgress
  mainObstacle
  nextAdjustment
  relatedGoalId?
  nextStepChange?
    none
    use-existing(actionId)
    create-and-use(title, description?)
```

- `reviewContextId` 绑定 trusted sender、捕获周期和已有 ReviewResult 身份；伪造、替换、取消、已消费、跨 sender 或窗口关闭后的 token 拒绝且零写入。
- Main 不信任 Renderer 提交的 period、createdAt、updatedAt、统计、Goal 状态或 Action 状态。
- `nextStepChange` 必须满足 Goal active、同 Goal pending Action、ED-005、ED-006 和既有 Action 不变量；按 S45-Q06-A，任一部分失败时整个原子命令回滚。
- Review 文本与可选下一步 mutation 只有在最终确认后进入 Application；编辑、取消或返回产生零业务写入。

### 7.5 Repository ports

批准设计增加窄能力，不扩张基础 `RepositoryPort` 为通用查询器：

```text
RecoveryRepositoryPort
  queryRecoverySnapshot(goalId)

ReviewRepositoryPort
  queryReviewSummarySnapshot(periodStartedOn, periodEndedOn)
  findReviewResultByPeriod(periodStartedOn)
  saveReviewResult(reviewResult)
```

- Recovery/Review summary query 在单个 SQLite 只读 transaction 中取得相关事实，避免 Goal、Record、Understanding、Confusion 和 Routine facts 来自不同时点。
- Builder 保持纯领域/应用逻辑；Repository 只返回事实行，不解释停滞、评分、失败或用户调整。
- T041/T051 可以复用现有 Progress SQL 选择和领域计算，但不能通过调用 Renderer API、串行多次 IPC 或复制统计公式制造漂移。

## 8. IPC、Preload、Main 与 Renderer 安全边界

### 8.1 固定 API 设计

```text
window.myTracer.recovery
  getContext({ goalId })

window.myTracer.review
  begin({})
  cancel({ reviewContextId })
  complete({ reviewContextId, confirmedProgress, mainObstacle, nextAdjustment,
             relatedGoalId?, nextStepChange? })
```

若 `GetReviewResult` 不由 `begin` 合并返回，可增加一个精确 `review.getResult`；不得增加 `invoke(channel, payload)`、raw query、任意 LocalDate、SQL、数据库路径或 Repository 对象。

### 8.2 Main/Preload 约束

- Main 注册固定 channel，使用现有 `assertTrustedSender` 验证 sender/origin。
- 运行时验证 ID、精确 keys、string/non-empty/length、枚举和 nullability；TypeScript 类型不能替代验证。
- 错误至少区分 `validation`、`not-found`、`invalid-transition`、`invariant-violation`、`context-stale`/`context-invalid`、`conflict` 和 `persistence-failed`，且不泄露用户正文、SQL 或绝对路径。
- Preload 只复制并转发结构化 DTO；不暴露 `ipcRenderer`、Electron 对象、Node、文件、凭据或 Provider。
- review context 与既有 recording/delete context 一样在 navigation、reload、窗口关闭和应用退出时清除；不持久化、不进入导出或诊断正文。

### 8.3 Renderer 约束

- Renderer 不自行计算 days-since、周起止、真实行动次数、Routine outcome 统计或 unknown；只显示 Main 返回事实。
- 所有 Recovery/Review 建议或输入在确认前仅为 feature-local state。
- mutation 成功后重新调用受影响 Query；内存缓存不是事实来源。
- 不根据错误、空状态、天数或缺失日显示羞辱、恐吓、排名、逾期或“你失败了”。
- AI 未配置/失败状态不影响 Recovery 或 Review；这两个阶段不调用 Provider。

## 9. SQLite、migration、索引与 export 兼容

### 9.1 Recovery 与 ReviewSummary

- 不新增 `recovery_*`、`review_summaries`、`stagnation`、`suggestions`、`unknown_days` 或统计累计表。
- `daysSinceLastRealAction`、RecoveryContext 和 ReviewSummary 每次从已保存事实计算。
- T041/T042/T051 不需要 schemaVersion 变化；若实现发现必须新增 Recovery/summary 表或依赖，停止受影响任务并重新审批。

### 9.2 当前 `review_results` 事实

当前 v2 表为：

```text
review_results
  id
  period_started_on
  summary
  adjustment
  next_focus
  goal_id?
  created_at
  updated_at
```

当前 Repository 和 export v1 使用相同字段语义名称；已有 `review_results_by_goal_id` 索引，没有周期唯一约束。批准领域基线则要求：

```text
ReviewResult
  periodStart/periodEnd
  confirmedProgress
  mainObstacle
  nextAdjustment
  relatedGoalId?
```

不能仅因 UI 尚未实现就修改已发布的 `001_initial.sql` 或假定数据库永远为空。任何调整必须是顺序 migration，包含旧 fixture、重开、导出和更高未知版本测试。

### 9.3 schema v3 的设计与兼容边界

项目所有者已批准 S45-Q04-A：通过事务性顺序 migration 重建 `review_results`，并配套 export v2。该记录固定原设计语义，不授权新的 migration 操作：

```text
review_results
  id TEXT PRIMARY KEY
  period_started_on TEXT NOT NULL
  confirmed_progress TEXT NOT NULL CHECK(non-blank)
  main_obstacle TEXT NOT NULL CHECK(non-blank)
  next_adjustment TEXT NOT NULL CHECK(non-blank)
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
```

`period_ended_on` 由固定周语义从 start + 6 推导，不重复保存。批准设计保留/增加：

- `review_results_by_goal_id(goal_id)`；
- `review_results_by_period_started_on(period_started_on)`；
- 按已批准的 S45-Q05-A，将周期索引升级为 UNIQUE，使每个 `period_started_on` 最多一个 ReviewResult，再次确认编辑同一稳定 ID。

已批准的旧行转换为：

```text
summary     -> confirmed_progress
adjustment  -> main_obstacle
next_focus  -> next_adjustment
```

该映射只用于无损保留三个旧文本，不声称旧名称曾精确表达新语义。若项目所有者不接受此解释，T052 必须停止；不能删除旧行、填充虚构阻力或把字段留空绕过新不变量。

### 9.4 已批准的 export 兼容设计

- export v1 已批准且严格校验旧 ReviewResult 字段；不能在 `exportVersion=1` 下静默改变 row shape。
- 配合已批准的 schema v3，增加可判别的 `MyTracerCoreExportV2`，ReviewResult 使用新语义字段；v1 validator 和历史 v1 文件语义保持不变。
- export v2 仍包含全部核心集合、enumValues、sourceDataVersion、LocalDate、可空 Goal 关联和敏感字段排除；不增加导入能力。
- 生成器按 exportVersion 构造/校验，不允许把 schemaVersion 当 exportVersion。
- S3 的原子交付、Main-only destination、临时 sibling、复验、失败不破坏旧文件等规则全部回归。
- 新的 migration/export 变更需要按其语义和数据风险获得相应 owner 授权；本设计批准不授予该执行权限。

### 9.5 兼容与失败策略

- v2 → v3 migration 必须单事务完成；失败保留 v2 数据和 metadata version。
- 已有 zero-row 数据库和含合成旧 ReviewResult 的 v2 fixture 都必须验证文本、ID、Goal detach 和时间戳守恒。
- 比应用已知版本更高的数据库继续拒绝写入，不能降级覆盖。
- T052 完成后关闭并重开真实测试连接，证明 ReviewResult 可读；不复用内存对象冒充持久性。
- migration、E2E、删除和导出只使用每 case 唯一临时数据根；不得打开真实 Electron `userData` 数据库。

<a id="10-task-graph共享面与实施顺序"></a>

## 10. 模块耦合参考

<a id="101-任务关系"></a>

### 10.2 shared surfaces

| 共享面 | 任务 | 具体冲突依据 | 风险 |
|---|---|---|---|
| Repository ports / SQLite query snapshot | T041、T051、T052 | `persistence.ts`、`sqlite-repository.ts`、Progress 事实选择、review_results | high |
| Main composition / Preload API | T041～T052 | `main/index.ts`、`preload/index.ts`、MyTracerApi、IPC registration | high |
| Goal/Action current-next invariants | T042、T052 | ED-005、Action replacement、Today user decision | high |
| Goals/Review Renderer feature | T041/T042、T051/T052 | feature-local state、mutation refresh、错误文案 | medium |
| schema/export | T052 | migrations manifest、review_results、complete export validator | high |
| AC-05/AC-06 aggregate E2E | T042、T052 | 同一 DB、跨日/跨周、重开和历史守恒 | medium |

共享模块表用于评估变更影响；原串行任务与审批顺序仅见历史执行记录。

<a id="103-已批准的实施和审批顺序"></a>

## 11. T041～T052 范围、非范围与完成条件

本节保留技术能力、非范围与可观察行为；Txxx 是来源标识。原任务依赖和交付手续见[历史执行记录](../implementation/archive/stage-execution/S4_S5_EXECUTION.md#11-t041t052-范围非范围与完成条件)；以下验证目标按当前变更影响面选用。

### 11.1 T041 — RecoveryContext 查询

**可观察结果**

用户从 Goals 显式进入 Recovery，可以查看某 Goal 的此前真实行动、确认理解、开放困惑、当前下一步以及距上次真实行动的事实；查询不改变任何数据。

**范围/交付物**

- Recovery pure builder 和日期差值；
- Goal 中心一致性 Repository snapshot；
- `GetRecoveryContext` Application Query、contracts、Main IPC、Preload API；
- Goals feature 内最小只读 Recovery 入口和中性空/错状态；
- 单元、SQLite、IPC、E2E read-only 与重开测试。

**非范围**

- 任何 Recovery mutation、阈值、自动入口、提醒、AI、持久化 Recovery、Review；
- 修改 Goal/Action/Routine/Record；
- migration、依赖或 export 变化。

**可观察行为与验证目标**

- null last action、0 分钟、多 Record、Routine target_met/acted、rest/not_done/unknown、跨日和 Goal 不存在分支正确；
- Query 前后完整 snapshot 相同；重复调用和重开结果只随事实/LocalDate合理变化；
- UI 不显示 stalled/overdue/failure/score/streak 字段；

### 11.2 T042 — 清理过时内容并重新开始

**可观察结果**

用户从 T041 上下文确认哪些内容仍重要，显式 pause/end/transition 过时内容，确认一个小 Action 并设置当前下一步；可选加入 Today，历史 Record 保持逐字段不变。

**范围/交付物**

- Recovery Renderer 草稿、确认/取消、错误和 mutation 后 refresh；
- 复用普通 Goal/Routine/Action/Today Commands；
- 按已批准的 S45-Q06-A 实现原子 create-and-set；
- AC-05 自动化连续流程和项目所有者人工程序；
- 历史守恒、失败回滚、跨午夜 Today 选择和既有 AC 回归。

**非范围**

- Recovery 自动建议、AI、自动状态变更、硬删除捷径、自动补 Record；
- Review、migration、export 或 S7 长期未推进列表；
- 改变 Routine 独立生命周期。

**可观察行为与验证目标**

- 所有确认前核心 snapshot 不变；取消和命令失败零意外写入；
- 完整 E2E-AC-05 在 FakeClock 前进多日、关闭重开和同一临时数据库上通过；

### 11.3 T051 — 周期事实摘要

**可观察结果**

用户主动进入 Review，看到明确周一至周日周期的时间、真实行动次数、确认理解、开放困惑和分列 Routine 事实，无需重录统计。

**范围/交付物**

- 周边界、ReviewSummary pure builder、unknown absence policy；
- 一致性 Review Repository snapshot，复用 Progress 事实定义；
- `BeginReview/GetReviewSummary` Application、review context、IPC/Preload；
- Review feature 只读摘要、周期标题、空/错状态；
- 单元、SQLite、IPC、E2E summary 测试。

**非范围**

- 保存 ReviewResult、更新下一步、migration/export；
- 比较上周、趋势、评分、掌握度、完成率、提醒或 AI 周计划；
- 历史 schedule 重建或 unknown 持久化。

**可观察行为与验证目标**

- 按已批准的 S45-Q03-A 默认进入当前所在周；
- Summary 与同 filter Progress 事实一致，且不复制/另算相冲突公式；
- 四种显式 Routine outcome 分列；缺行不进入 not_done 或失败；
- Query/context 不写 SQLite、不持久化统计；跨周不静默移动；

### 11.4 T052 — ReviewResult 与下一阶段调整

**可观察结果**

用户确认并保存一个进展、一个主要阻力和一个调整；可选更新一个 Goal 当前下一步。重开后用户输入存在，事实摘要从当前 Record 重算。

**范围/交付物**

- ReviewResult domain/application validation、save/update/read；
- `CompleteReview`、可选 next-step resolution、事务/确认边界；
- Review Renderer 表单、取消、确认、重开与修改流程；
- 按已批准的 S45-Q04-A/S45-Q05-A 设计 schema migration、周期 UNIQUE 索引、Repository 和 export v2 兼容；
- AC-06 自动化、人工程序，以及 AC-05/AC-06 aggregate E2E。

**非范围**

- 多 Goal 详细报告、阻力 taxonomy、评分、提醒、AI 总结、自动周计划、S7 周期比较；
- 自动创建/修改数据、未确认草稿持久化、统计快照；
- 自动导入或把 export 当恢复。

**可观察行为与验证目标**

- ReviewResult 三字段、周期、Goal detach、重开和编辑语义通过单元/SQLite/IPC/E2E；
- 确认前零写入，非法 context/Goal/Action/文本和故障全部回滚或准确报告批准的分步结果；
- export v1/v2 或获批替代兼容策略均有正反 fixture；migration v2 → v3 守恒；

## 12. 分层验证与 AC-05/AC-06 验收矩阵

### 12.1 自动化矩阵

| 行为/风险 | Domain/Application unit | SQLite/集成 | IPC/Preload | E2E | 人工 |
|---|---|---|---|---|---|
| last real action | ActionRecord + target_met/acted；0 分钟；null；LocalDate 差值 | Goal filter、Routine facts、一致 snapshot | 伪造 days/date 拒绝 | FakeClock 前进多日 | N 天文案中性、可解释 |
| Recovery read-only | Builder 无命令 | 查询前后全 snapshot 相同；重开 | exact DTO、trusted sender | 查看历史/困惑/下一步 | 返回先看到成果和可开始内容 |
| 生命周期清理 | 显式状态机；Routine 独立 | 单事务、失败回滚、Record逐字段守恒 | 未确认/非法 transition 拒绝 | pause/end/reschedule 分支 | 不把 pause/end 表达为失败 |
| 小行动恢复 | 同 Goal pending/current-next；Today 用户决定 | 原子 create/set；失败全回滚；重开 | 多余字段/跨 Goal/终态拒绝 | 确认后选择小 Action | 小行动确实更容易开始 |
| Review 周边界 | 周一/周日、跨月/年、context 捕获 | inclusive LocalDate filter | Renderer 无可信 period/statistics | Sunday→Monday 跨周 | 周期标题清楚 |
| Routine 五语义 | 四 outcome 分列；absence unknown | 无 unknown 行、无缺行补写 | 不接受 unknown 保存 | 包含四 outcome + 一个空白日 | rest/unknown/not_done 不混淆 |
| Review facts | 与 Progress 同一公式；无评价字段 | 同一 snapshot、修改后重算 | Summary DTO allowlist | UI 无需重录统计 | 摘要简短、事实性 |
| ReviewResult | 三字段、可空 Goal、next-step explicit | save/update/read、Goal SET NULL、重开 | context/token/文本/Action 校验 | 保存、修改、重开 | 一个进展/阻力/调整负担合理 |
| migration/export | 版本和旧行映射 pure validation | v2→v3、失败回滚、未知高版本、export v1/v2 | Renderer 无 path/schema 权限 | 最终文件解析 | 导出不被描述为可导入恢复 |
| 评价性推断排除 | 类型/字段扫描 | 无累计/评分表 | API shape 扫描 | 页面文本/role 断言 | 无 streak、score、mastery、失败施压 |

### 12.2 E2E-AC-05 连续程序

在同一 Windows 环境、FakeClock 和每 case 唯一临时 `userData` 上：

1. 创建 active Goal、pending current next Action、历史 ActionRecord、确认 Understanding、open Confusion 和关联 RoutineRecord；保存完整初始 snapshot。
2. 完全关闭应用和 SQLite 连接；FakeClock 前进多日；重新打开同一测试数据根。
3. 从 Goals 显式进入 Recovery，验证成果、上次真实行动、open Confusion、当前下一步和中性 N 天事实。
4. 验证中断期间没有自动 ActionRecord/RoutineRecord/TodaySelection/ReviewResult，空白日没有变成 `not_done`。
5. 显式 pause 一个过时 Goal 或 Routine；验证所有历史 Record 和关联事实保留，Routine 不因 Goal 命令自动变化。
6. 返回 active Goal，创建或选择一个小 Action，显式设为当前下一步，并由用户选择是否加入当前 Today。
7. 比较历史 Record 的 ID、occurredOn、outcome、分钟、子事实和 createdAt；Recovery 操作不得改写。
8. 关闭并重开，验证状态转换、新下一步、Today LocalDate 和历史事实持久一致。
9. 页面不得显示断签、失败率、大量逾期、评分、掌握度或人格评价。

### 12.3 E2E-AC-06 连续程序

1. 使用明确周一至周日周期准备 ActionRecord、Understanding、open Confusion，以及 `target_met/acted/intentional_rest/not_done` RoutineRecord；保留一个没有 Record 的计划观察日。
2. 用户主动进入 Review；验证周期边界和 Summary 与 Progress 同 filter 的时间、真实行动次数、理解和困惑一致。
3. 验证四种显式 Routine outcome 分列，空白日没有进入 `not_done`、失败或达标；没有 streak、score、mastery 或 failure rate。
4. 用户填写一个 confirmed progress、一个 main obstacle、一个 next adjustment；不手工重复统计。
5. 先取消，比较完整 snapshot 零变化；重新进入并确认保存。
6. 在一个分支不更新下一步；另一隔离分支明确选择 existing 或 create-and-use Action，验证只有确认分支改变 current next。
7. 完全关闭并重开；ReviewResult 仍存在，Summary 仍由当前 Record 重算而非复制值。
8. 修改或删除一个测试 Record 后重新进入 Review，验证 Summary 变化而已保存用户文本不被系统重写。
9. 若批准 migration/export v2，导出并解析 ReviewResult 新字段、版本、Goal null/detach 和敏感排除。

### 12.4 AC-05 → AC-06 聚合 E2E

在同一数据库且不重置状态：先完整执行 AC-05 恢复并保存随后的一次真实 Record，再进入 AC-06。ReviewSummary 必须包含恢复后产生的新事实，同时保留恢复前历史；Recovery 操作本身不计行动。该程序绑定最终 `stage_final_integration_revision`，不能由 T042 或 T052 较早 revision 的单独绿色结果代替。

### 12.5 既有 AC 回归

- AC-01：Goal → Action → Today → ActionRecord → Progress；current-next 和 Progress 公式未被 Recovery/Review 改写。
- AC-03：Routine 四 outcome + unknown、非计划日、Progress 事实保持。
- AC-04：intention 未发生零失败、零自动 Record、跨日不滚动。
- AC-07：重开、删除 detach、完整导出、AI disabled/not-configured/failure；T052 涉及 schema/export 时必须完整回归。
- AC-02 在 S6 前仍未实现；只做 SCOPE 扫描，不能因文案或“建议”字样声明 AI 能力。

<a id="126-稳定命令与额外验证"></a>

## 13. FR / AC / D / ED → Txxx → 测试追踪

缩写：`U` Domain/Application unit，`I` Repository/SQLite integration，`IPC` Main/Preload contract，`E2E` 端到端，`M` 项目所有者人工，`SCOPE` 范围扫描。

| 需求/决定 | Txxx | 测试层级 | 设计落点 |
|---|---|---|---|
| FR-REC01、FR-REC02、FR-REC03；D-002 | T041 | U、I、IPC、E2E-AC-05、M | 历史守恒、上下文查询、不补空白日 |
| FR-P03、FR-P04 回归；D-007、D-009、D-010 | T041 | U、I、E2E | 确认理解/open Confusion、事实非评价、unknown/rest 保持 |
| D-106；ED-012、ED-013、ED-017 | T041 | U、I、IPC、E2E | LocalDate、0 分钟真实行动、无阈值 N 天、跨日 |
| FR-REC04、FR-REC05、FR-REC06；FR-P04；AC-05 | T042 | U、I、IPC、E2E-AC-05、M | 显式清理、开放阻力、选择小行动、无压力返回体验 |
| FR-G03、FR-G04、FR-G05；FR-A01、FR-A03、FR-A06；FR-T04、FR-T05 | T042 | U、I、IPC、E2E | pause/end 历史、current-next、reschedule、Today 用户决定 |
| D-004；ED-005、ED-006、ED-007、ED-008、ED-013 | T042 | U、I、IPC、E2E、M | 用户选择、同 Goal pending、同 Action reschedule、删除边界、无停滞阈值 |
| FR-RV01、FR-RV06；AC-06 步骤 1/5 | T051 | U、I、IPC、E2E-AC-06、M | 周期事实摘要、不重录统计 |
| FR-P01、FR-P02、FR-P03、FR-P04、FR-P07、FR-P08；D-007、D-106、D-110 | T051 | U、I、E2E、M | 时间/次数/理解/阻力、无 streak/人格评价、主动进入、周一至周日 |
| FR-R04、FR-R05、FR-R06、FR-R07、FR-R08、FR-R09；D-008、D-009、D-010、D-107；ED-012、ED-016 | T051 回归 | U、I、IPC、E2E | 四 outcome + unknown、非计划日、真实行动计次 |
| FR-RV02、FR-RV03、FR-RV04、FR-RV05；D-105、D-110 | T052 | U、I、IPC、E2E-AC-06、M | 三个轻量输入、无分类体系、可选下一步、主动 Review |
| FR-G05；D-004；ED-005、ED-006 | T052 | U、I、IPC、E2E | 用户明确更新同 Goal pending current next |
| FR-D01、FR-D04；D-111；ED-008、ED-014、ED-018 | T052 条件回归 | U、I、E2E-AC-07、M | 批准后的 migration、重开、Goal detach、完整 export |
| ED-004、ED-019 | T041～T052 | I、IPC、E2E、SCOPE | Main-only SQLite、窄 Preload、sender/origin、安全 Renderer |
| AC-01、AC-03、AC-04、AC-07 | T041～T052 回归 | U、I、IPC、E2E、M（按受影响项） | S1～S3 既有行为不退化 |
| FR-P05、FR-P06 | S7 非范围 | SCOPE | 无跨 Goal 停滞识别、周期比较或趋势能力；单 Goal N 天事实不声明完成 FR-P05 |
| FR-RV07；FR-D07；FR-AI11、FR-AI12、FR-AI13 | 非范围 | SCOPE | 无 AI 周计划、自动导入、主动 AI、长期记忆 |

所有编号均来自现行 PRD、DECISIONS 或 ENGINEERING_DECISIONS。本文不创建新 FR/AC/D/ED。T042 的现有 `D-013` 引用漂移在第 2.3 节报告；长期未推进阈值依据明确写为 `ED-013`。

## 14. 已批准决定、替代选项、影响与可逆性

项目所有者于 2026-08-27 明确批准 S45-Q01～Q07 的 A 方案。本节保留未选方案、影响和可逆性作为决策历史；相关变更须保持批准的技术结论，不得自行切换选项。

### S45-Q01：长期未推进阈值与默认值

- **批准结论：A（2026-08-27）**。不设置阈值，不存在需固化的天数默认值。
- **选项 A（已批准，维持 ED-013）**：不设置阈值；只显示 `lastRealActionOn` 和可空“距上次真实行动 N 天”，用户自己判断。
- **选项 B**：用户可配置个人阈值；达到后显示中性候选，但不改变状态。
- **选项 C**：系统固定默认天数并自动标记“长期未推进”。
- **影响**：A 无 migration、配置、默认值或逾期压力，直接符合现行已批准 ED-013。B 增加配置、持久化、默认/空值/修改语义并改变已批准工程决定。C 把任意天数固化为系统判断，最容易违反非惩罚 Recovery。
- **可逆性**：A 最易在真实使用后扩展；B/C 一旦进入数据/UI/验收，撤回需 migration、配置兼容和文案调整。
- **审批边界**：B/C 需要先正式改变 ED-013；在此之前不可选入 T041/T042 实现。

### S45-Q02：Recovery 显式入口

- **批准结论：A（2026-08-27）**。Recovery 由用户从 Goals 显式进入。
- **选项 A（已批准）**：Goals 中每个 Goal 的显式 Recovery 子流程；Progress 可提供同一入口的链接。
- **选项 B**：只从 Progress 的长期事实进入 Recovery，Goals 不提供入口。
- **选项 C**：应用重开或检测久未使用时自动弹出 Recovery。
- **影响**：A 符合 T094 Goals/Recovery ownership，Goal 上下文清楚且不新增主导航。B 更集中于事实页，但用户寻找成本更高。C 属于自动返回识别/主动介入，PRD 已留到真实使用后决定。
- **可逆性**：A/B 为 Renderer 路由/入口选择，较易调整；C 会引入检测状态、默认时机和更多拒绝/抑制语义，较难回撤。
- **审批边界**：C 当前不可作为 v0.1 实现选项，除非先走需求变更流程。

### S45-Q03：Review 默认周期

- **批准结论：A（2026-08-27）**。默认周期为进入时的当前所在周，周一至周日。
- **选项 A（已批准）**：用户进入时使用当前所在周（周一至周日），允许在本周任意时点复盘。
- **选项 B**：始终使用最近一个已经结束的完整周。
- **选项 C**：首次即允许选择任意历史周。
- **影响**：A 最直接、无额外选择器，符合“用户主动进入”和轻量流程；未结束周的事实可能仍在增加。B 摘要稳定，但周中进入会跳过当前事实。C 更灵活，但增加历史列表、空周期和编辑/多结果规则，接近 S7/复杂周期浏览。
- **可逆性**：A/B 可通过 Query 默认和 UI 文案调整，但已保存 ReviewResult 的周期语义必须兼容；C 若产生多历史结果，回撤更复杂。
- **默认值**：已批准为当前所在周；页面必须明确显示 period start/end，页面跨周不静默移动。

### S45-Q04：ReviewResult schema 与 export v1 张力

- **批准结论：A（2026-08-27）**。采用第 9.3 节 schema v3、旧行无损文本映射和严格可判别的 export v2；保留 v1 validator。该结论不替代 T052 migration 执行授权。
- **选项 A（已批准）**：批准第 9.3 节 schema v3 语义列和旧行文本映射，同时增加严格可判别的 export v2，保留 v1 validator。
- **选项 B**：保留旧三列和 export v1 字段名，在 Application 层定义映射，不做 migration。
- **选项 C**：为旧表追加 `main_obstacle` 等列并同时保留旧列，避免立即升级 export。
- **选项 D**：T052 暂不持久化 ReviewResult，只做本次内存流程。
- **影响**：A 让数据、Domain 和 export 名称一致，兼容规则清楚，但需要 migration/export owner gate 和更多回归。B 无 migration，却会长期让 `adjustment/nextFocus` 与产品语义错位，维护风险高。C 产生双字段和双真相，需要长期兼容策略。D 不满足已批准领域持久化和重开设计，也削弱 FR-D01、AC-06 真实使用。
- **可逆性**：A 的数据迁移必须视为不可随意降级，但旧文本/ID 完整保留且历史 export v1 仍可验证；B 最易短期实施、最难长期消除语义债；C 最难清理；D 易撤回但不能作为完整 T052。
- **审批边界**：设计选择已批准；新的 migration 操作仍须取得相应执行授权，实施者不得扩大 migration/export 范围。

### S45-Q05：每周期 ReviewResult 数量

- **批准结论：A（2026-08-27）**。每个 `periodStartedOn` 最多一个 ReviewResult，再次进入编辑同一稳定 ID。
- **选项 A（已批准）**：每个 `periodStartedOn` 最多一个 ReviewResult；再次进入时编辑同一结果，保持稳定 ID。
- **选项 B**：同一周期允许追加多个 ReviewResult，按 createdAt 展示历史。
- **选项 C**：同一周期可按 Goal 各保存一份 ReviewResult。
- **影响**：A 对应“最小周期复盘”和“一个调整”，UI、唯一约束和重开最简单。B 把 Review 向内容历史模块扩展，需要列表、选择和删除规则。C 让复盘从周期流程变为多 Goal 报告，增加记录负担。
- **可逆性**：A 未来可放宽唯一约束；B/C 回收到一个结果需要合并或丢弃数据，不易可逆。
- **持久化结论**：schema v3 增加周期 UNIQUE；替代方案 B/C 未获批准，不进入当前实现范围。

### S45-Q06：确认小行动和 Review 下一步的事务边界

- **批准结论：A（2026-08-27）**。create/use Action 与设置 current next 原子完成；ReviewResult 与可选 next-step resolution 也原子完成。
- **选项 A（已批准）**：提供普通原子 Application Command，在同一事务 create/use Action 并设置 current next；Review 保存与可选 next-step resolution 也原子完成。
- **选项 B**：Renderer 顺序调用既有 `CreateAction`、`SetGoalCurrentNextAction`、`SelectActionForToday`；ReviewResult 与下一步分别保存。
- **影响**：A 对一次用户确认提供全有或全无，避免创建孤立候选或“复盘已保存但下一步失败”的模糊结果；需要复用 current-next domain helper并扩大专用 Application 测试。B 最大化复用既有 API，但必须设计部分成功、重试和准确提示。
- **可逆性**：A 可以未来拆成多步 UI而不改数据；B 一旦用户产生部分结果，无法假装原子，需要长期保留恢复路径。
- **边界**：两个选项都必须保持 Today 为单独用户决定，不能因设置 current next 自动加入 Today。

<a id="s45-q07s4-与-s5-的实施节奏"></a>

## 15. 风险、停止条件与授权

### 15.1 风险处置选项

完整设计批准后，下表 A 方案成为本阶段的批准风险控制；替代方案仅保留为历史。任何改选若要求改变冻结语义、延期范围或数据权限，仍须重新审批，且风险控制不构成实现授权。

| ID / 风险 | 可选择方案 | 批准控制 | 影响 | 可逆性 |
|---|---|---|---|---|
| R01 / N 天被当成失败阈值 | A 无阈值，仅单 Goal 显示事实；B 用户阈值；C 固定阈值 | A；与 Q01 一致 | B/C 引入配置或系统判断，并可能违反 ED-013、FR-REC06 | A 易扩展；B/C 撤回需兼容配置、文案和可能的 migration |
| R02 / Query 写入或补行 | A 纯只读 snapshot；B 持久化 Recovery/summary cache；C 后台检测并写状态 | A | B/C 会制造新事实源，使 unknown/历史守恒不可证明 | A 无数据回滚；B/C 需删除或迁移派生数据，风险高 |
| R03 / Recovery 改写历史 Record | A Record 永不因恢复改变；B 仅用户另行记录真实新行动；C 直接修订旧 Record 模拟恢复 | A；B 只作为既有普通记录流程 | C 直接破坏 AC-05；B 会产生真实新事实但不属于 Recovery 自动效果 | A 完全可逆；B 是正常历史写入，不应自动撤销；C 难以可靠恢复原历史 |
| R04 / Goal pause 联动 Routine | A 保持 Routine 独立；B 用户另行确认普通 Routine 命令；C Goal 命令自动级联 | A，允许 B 的独立确认 | C 破坏 S2 已批准边界；B 增加一步但意图明确 | A/B 不改模型；C 一旦批量改变状态需逐项恢复且可能失去用户意图 |
| R05 / Review 复制 Progress 公式 | A 抽取/复用 pure facts builder；B 复用同一 Repository facts 后由 Review 组合；C 复制 SQL/公式 | 优先 A；若会越出任务允许文件则 B 并交叉断言 | C 会产生时间、计次和理解/困惑漂移；A 可能扩大重构面 | A/B 可局部调整；C 形成双真相后清理成本高 |
| R06 / unknown 合并为 not_done | A absence 保持 unknown 且无持久化行；B 仅显示无法可靠追溯的估算分母；C 自动写/计 not_done | A | B/C 制造失败率或虚假历史，违反 FR-R05、D-009 | A 无迁移；B 文案可撤但证据会漂移；C 需数据修复且可能不可完全还原 |
| R07 / 历史 schedule 不可重建 | A 不计算计划日分母；B 新增版本化 schedule history；C 用当前 schedule 回推过去 | A | B 是新增持久化概念和范围；C 产生错误历史 | A 易在未来扩展；B 需长期 migration；C 结果无法可信修复 |
| R08 / 页面跨周静默移动 | A sender-bound 捕获周期；B 保存时改用当下周期；C 增加显式历史周期选择 | A；C 仅在 Q03-C 另批后 | B 会把用户看到的摘要和保存周期分离；C 增加历史 UI | A 内存态易调整；B 可能产生错绑数据；C 回撤需保留已产生历史结果 |
| R09 / 旧 ReviewResult 字段误解释 | A schema v3 + export v2；B Application 映射旧列；C 双列；D 不持久化 | A；与 Q04 一致 | 各选项完整影响见 Q04；T052 未获 migration 执行权限时保持阻塞 | A migration 不可随意降级；B/C 形成语义债；D 易撤但不能完成持久化结果 |
| R10 / 同周期多结果未定义 | A 唯一并编辑；B 多结果历史；C 每 Goal 一份 | A；与 Q05 一致 | B/C 扩展列表、排序、删除和 export 规则 | A 可放宽；B/C 收敛会涉及数据合并/保留决定 |
| R11 / 多命令部分成功 | A 原子普通 Application Command；B 分步并准确报告；C Renderer 假设全成功 | A；与 Q06 一致 | B 增加恢复 UI；C 会隐藏真实数据改变 | A 可拆分；B 已产生的部分结果不可假装不存在；C 不可接受 |
| R13 / migration/export 触及真实数据 | A 临时根和合成 fixture；B 复制的专用人工数据根；C 直接真实 userData | A 自动化，B 仅经人工程序；C 禁止 | C 可损坏真实数据；只做 A 可能不足以覆盖人工体验 | A/B 可丢弃测试副本；C 可能不可逆 |
| R14 / 自动化代替人工体验 | A 自动化 + owner manual；B 仅自动化；C 仅人工 | A | B 不能证明非压力体验；C 缺少确定性回归 | A 证据最完整；B/C 可补测，但不能追溯性地假装先前已通过 |
| R15 / AI、提醒或 S7 混入 | A SCOPE 扫描并停止；B 预留接口但不调用；C 提前实现 | A | B 仍可能把未批准概念固化进契约；C 直接扩张范围 | A 无清理；B/C 需删除接口、数据和测试，可能影响兼容 |

### 15.2 已采用的设计假设及替代处理

原版本复核/执行上下文见[历史执行记录](../implementation/archive/stage-execution/S4_S5_EXECUTION.md#补充执行与批准上下文)。不作为当前工作的启动条件。

### 15.3 Stop conditions

发现以下情况时停止受影响变更并报告：

- 需要改变 FR-REC、FR-RV、AC-05/AC-06、五种 Routine 语义、Goal/Action/Routine 状态、LocalDate、删除或历史守恒；
- 需要固定停滞阈值、自动返回识别、提醒、AI、评分、掌握度、完成率或延期能力；
- 当前变更未获得相应权限却需要改变 schema/export，或实现偏离已批准 Q04-A/Q05-A/Q06-A；
- 需要回写已执行的 `001_initial.sql`/`002`、删除旧 ReviewResult 文本或执行破坏性 migration；
- Renderer 必须获得 SQL、数据库/文件路径、凭据、Provider 或 arbitrary IPC 才能实现；
- 测试必须访问真实用户数据库、live Provider 或无法产生可靠重开/历史守恒证据；
- 最新授权 `dev` 改变了本文绑定的行为、schema、export、任务状态或 shared surfaces，且尚未重新复核；
- 无法为当前受影响行为建立可信验证时，报告具体缺口；未执行的检查不记为通过。

<a id="154-required-authorization"></a>

<a id="16-阶段门与连续实施结论"></a>

<a id="161-s4-entry-gate"></a>

<a id="162-s4-acceptance-gate"></a>

<a id="163-s5-entry-gate"></a>

<a id="164-s4s5-final-gate"></a>

<a id="165-连续实施结论"></a>

<a id="17-批准设计交付核对"></a>

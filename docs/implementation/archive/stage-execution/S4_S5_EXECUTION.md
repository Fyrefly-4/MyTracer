# S4_S5 历史阶段执行记录

> 来源：`beb8b97b2c9ecdef4ab0677853eef195c2367544` 中的 [S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md](../../../architecture/S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md)。本文保留当时的执行、授权和交付上下文，不是当前状态或普通工作的指令；旧批准不恢复执行权限。技术正文继续在原设计文件维护。

## 原页首状态与授权


> 文档状态：**项目所有者已于 2026-08-27 批准通过；不构成 T041～T052 实现授权。**
>
> 设计范围：S4 / E4-01～E4-02 与 S5 / E5-01～E5-02
>
> 核心验收：AC-05 中断后恢复、AC-06 最小复盘
>
> 审批事实：项目所有者已批准完整设计及 S45-Q01～Q07 的 A 方案；schema v3 / export v2 是获批设计结论，但实际 migration、任务合同、任务启动、Git/GitHub 和人工验收仍分别受后续精确授权门禁控制。



## 0. 文档用途与权限边界

本文把冻结产品语义、已批准工程决定、已验收 S1～S3 行为和 S4 前 Renderer foundation 收敛为 T041、T042、T051、T052 的整体设计输入。本文只描述 S4/S5 的阶段增量、共享边界、任务图、验证和审批门；它不创建任务合同、不改变任务状态，也不开始任何实现。

解释顺序保持为：

1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../../../PRODUCT_REQUIREMENTS_V0.1.md)；
2. [`DECISIONS.md`](../../../DECISIONS.md)；
3. [`REQUIREMENTS_CHANGE_POLICY.md`](../../../REQUIREMENTS_CHANGE_POLICY.md)；
4. 总体架构、领域、数据、工程决定、实施计划、测试策略和需求追踪；
5. 已批准的 [`S1_CORE_LOOP_DESIGN_V0.1.md`](../../../architecture/S1_CORE_LOOP_DESIGN_V0.1.md)、[`S2_ROUTINE_INTENTION_DESIGN_V0.1.md`](../../../architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md) 和 [`S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md`](../../../architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md)；
6. [`TASK_INDEX_V0.1.md`](../../TASK_INDEX_V0.1.md)、[`TASK_TEMPLATE.md`](../../TASK_TEMPLATE.md)、[`GITHUB_WORKFLOW_V0.1.md`](../../GITHUB_WORKFLOW_V0.1.md) 和 T094 的已验收 Renderer ownership；
7. 当前 `src/` 中已验收的 Domain、Application、Repository、SQLite v2、IPC、Preload、Renderer 和 export v1 契约。

`user/` 不属于本文依据，也不得成为 T041～T052 的设计、实现、测试或验收依赖。

本文使用以下标记：

| 标记 | 含义 |
|---|---|
| **冻结/已批准** | 直接来自 FR、AC、D、ED 或已批准阶段设计，后续任务不得自行改变 |
| **当前实现事实** | 在本文基线 revision 上实际存在的接口、schema、UI ownership 或验证状态 |
| **批准设计** | 项目所有者已批准的 S4/S5 设计边界；可作为后续独立任务合同的设计依据，但不等于合同或实现授权 |
| **已批准选择** | 第 14 节记录的 S45-Q01～Q07 A 方案；替代选项仅保留为决策历史和影响说明 |
| **延期/非范围** | 不进入 S4/S5，不得成为接口、表、依赖、测试前置或完成条件 |

本批准设计不授权：

- 修改代码、依赖、配置、migration、任务合同、metadata、任务索引、验收证据或需求基线；
- 创建/激活 T041～T052，或创建 branch、worktree、commit、push、PR、Ready、merge、tag、release；
- 执行任何真实用户数据库 migration、删除、导出或人工验收；
- 提前实现 AI、S6/S7、提醒、自动返回检测、自动导入恢复或其他延期能力。

## 1. Stage information

- **Stage**：S4 + S5
- **Title**：恢复与复盘（Recovery and Review）
- **Status**：`approved`
- **Owner approval**：项目所有者于 `2026-08-27` 批准完整设计与 S45-Q01-A～S45-Q07-A
- **Target branch**：`dev`
- **Current design source**：`dev@27485d0ab69eb84041c784c9a407b68fc304152b`
- **Prior behavior revision**：`dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3`
- **Prior behavior evidence**：T094 已完成 Renderer ownership 拆分；S4 前 foundation aggregate 事实由任务索引和 Evidence 账本记录

`27485d0...` 是当前文档/治理基线；最近改变产品运行代码的 revision 是 T094 集成后的 `2632ff0...`。后续任务若不再基于这两个事实，必须重新核对受影响接口、schema、任务状态和验收，而不能只更新文档中的 SHA。

## 2. Baseline manifest 与冲突核对

```yaml
baseline:
  product_requirements:
    file: docs/PRODUCT_REQUIREMENTS_V0.1.md
    version: v0.1
    last_updated: 2026-08-08
  decisions:
    file: docs/DECISIONS.md
    revision_or_date: 2026-08-07
  requirements_change_policy:
    file: docs/REQUIREMENTS_CHANGE_POLICY.md
    effective_date: 2026-08-07
  architecture_documents:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S1_CORE_LOOP_DESIGN_V0.1.md
    - docs/architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md
    - docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
  implementation_documents:
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/archive/GOVERNANCE_T090_T093_T804_ARCHIVE.md
  current_design_source: dev@27485d0ab69eb84041c784c9a407b68fc304152b
  prior_behavior_revision: dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3
  current_schema_version: 2
  current_export_version: 1
```

### 2.1 可直接依赖的当前事实

- S1～S3 已提供 Goal、Action、Routine、两类 Record、Today、Progress、数据修正/删除、完整导出和 AI 非依赖回归。
- `ProgressService` 已按可选 Goal 与 LocalDate 范围，从一致性 SQLite snapshot 聚合 ActionRecord、RoutineRecord、有效 Understanding 和 open Confusion。
- Routine 的四种持久化 outcome 与缺行 `unknown` 已分离；没有 `unknown` 行，也没有把缺行补为 `not_done` 的后台行为。
- Goal pause/end、Routine pause/end、Action 生命周期、Record 历史、TodaySelection 和 LocalDate 已有批准语义；Recovery/Review 只能组合或显式调用这些普通能力。
- SQLite v2 已预建 `review_results`；Goal 永久删除时 ReviewResult `goal_id` 使用 `ON DELETE SET NULL`，并已进入删除影响和完整导出集合。
- Renderer 已按 Goals、Routines、Today、Progress、Data、Review 拆分 ownership；Review 当前仍是空壳。Recovery 必须在 Goals/Recovery feature 边界内接入，不重新设计 `App.tsx`、AppShell 或主导航。
- Preload 当前只暴露固定意图级方法；Main 注册服务、运行时校验和 sender/origin 校验是唯一 IPC 写入/查询入口。

### 2.2 未发现的阻塞冲突

未发现两条 MUST、两项已批准产品决定或已批准状态/日期/历史不变量无法同时满足的冲突。S4/S5 可以在不引入 AI、提醒、评分、复杂日历、导入或新用户一级概念的条件下完成设计。

### 2.3 需要显式隔离的两处张力

1. **T042 追踪误指**：任务索引和实施计划为 T042 写入 `D-013`；真实的“长期未推进不设阈值”工程决定是 `ED-013`。`D-013` 描述 AI 的温和、非评判式表达，不能被解释为长期未推进阈值。本文对 Recovery 的事实计算使用 `ED-013`，中性文案使用 FR-REC06、UX-04 和 D-002；不越权修改任务索引。T042 合同形成前应由项目所有者决定是否单独修正现有追踪文字。
2. **ReviewResult 数据契约漂移**：批准领域模型要求 `confirmedProgress/mainObstacle/nextAdjustment` 和周期边界；当前 SQLite/Repository/export v1 使用 `periodStartedOn/summary/adjustment/nextFocus`。当前没有 Review UI 或生产写命令，但该结构已属于 schema v1/v2 和 export v1。项目所有者已通过 S45-Q04-A 批准 schema v3 + export v2 兼容设计；实际 migration 仍须写入 T052 精确合同后另行授权执行。

上述两处是追踪/实现级张力，不改变 FR 或 AC。S45-Q04-A 已解除 T052 的设计结论阻塞，但没有授权修改数据；T042 合同仍须准确使用 ED-013 并报告现有追踪误指，不修改需求基线来适配实现。

## 10. Task graph、共享面与实施顺序

### 10.1 任务关系

```yaml
tasks:
  T041:
    requires: [S1, T094]
    blocks: [T042]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T051]
  T042:
    requires: [T041]
    blocks: [S4_ACCEPTANCE_GATE]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T051, T052]
  T051:
    requires: [S2, S3]
    blocks: [T052]
    can_parallel: []
    prefer_after: [S4_ACCEPTANCE_GATE]
    conflicts_with: [T041, T042]
  T052:
    requires: [T051]
    entry_gates: [T052_CONTRACT_MIGRATION_AUTHORITY]
    blocks: [S4_S5_FINAL_GATE]
    can_parallel: []
    prefer_after: [S4_ACCEPTANCE_GATE]
    conflicts_with: [T042]
```

`S4_ACCEPTANCE_GATE` 和 `S4_S5_FINAL_GATE` 是人工阶段门，`T052_CONTRACT_MIGRATION_AUTHORITY` 是 T052 合同权限门；它们都不是新 Txxx，也不写入任务索引。

### 10.2 shared surfaces

| 共享面 | 任务 | 具体冲突依据 | 风险 | 集成策略 |
|---|---|---|---|---|
| Repository ports / SQLite query snapshot | T041、T051、T052 | `persistence.ts`、`sqlite-repository.ts`、Progress 事实选择、review_results | high | serial |
| Main composition / Preload API | T041～T052 | `main/index.ts`、`preload/index.ts`、MyTracerApi、IPC registration | high | serial |
| Goal/Action current-next invariants | T042、T052 | ED-005、Action replacement、Today user decision | high | serial + shared regression |
| Goals/Review Renderer feature | T041/T042、T051/T052 | feature-local state、mutation refresh、错误文案 | medium | 每阶段内部串行 |
| schema/export | T052 | migrations manifest、review_results、complete export validator | high | 独占 migration；owner gate |
| AC-05/AC-06 aggregate E2E | T042、T052 | 同一 DB、跨日/跨周、重开和历史守恒 | medium | 最终同 revision 聚合 |

T041 与 T051 逻辑上都是 read-only slice，但会同时扩展 Repository、Main、Preload 和 API contract；在当前单人项目及默认单业务任务 active 规则下，不推荐并行。任何未来并行授权都必须使用独立 worktree、冻结接口并证明不重叠上述 shared surfaces。

### 10.3 已批准的实施和审批顺序

```text
本设计 owner approval（已完成）
  → T041 独立合同、实现、验证、review、集成
  → T042 独立合同、实现、验证、review、集成
  → AC-05 自动化 + owner manual + S4 acceptance decision
  → 重新核对最新 dev，并把已批准的 Q04-A/Q05-A/Q06-A 写入 T052 精确合同
  → T051 独立合同、实现、验证、review、集成
  → T052 独立合同（含批准后的 migration/export 权限）、实现、验证、review、集成
  → AC-06 自动化 + owner manual
  → AC-05/AC-06 同一 stage_final_integration_revision 聚合
  → owner 决定后续 G4；不自动开始 S6/S7 或发布
```

S4 与 S5 采用连续串行顺序，因为它们共同形成“返回 → 重新开始 → 周期复盘”的产品闭环，并复用 Progress/LocalDate/当前下一步。但“连续”不是共享实现授权：S4 人工门、T052 migration 执行权限、每个合同、每次 merge 和最终阶段门都必须分别获得项目所有者授权。

## 11. T041～T052 范围、非范围与完成条件

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

**依赖与完成条件**

- 基于最新授权 `dev`，T094 ownership 仍成立；
- null last action、0 分钟、多 Record、Routine target_met/acted、rest/not_done/unknown、跨日和 Goal 不存在分支正确；
- Query 前后完整 snapshot 相同；重复调用和重开结果只随事实/LocalDate合理变化；
- UI 不显示 stalled/overdue/failure/score/streak 字段；
- 不声明 AC-05 完成，只证明步骤 1～4 和 T042 的安全输入。

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

**依赖与完成条件**

- T041 完成并集成；T042 合同纠正/解释 D-013 与 ED-013 追踪张力；
- 所有确认前核心 snapshot 不变；取消和命令失败零意外写入；
- pause/end/Action transition 保留历史，Goal/Routine 不自动联动；
- 完整 E2E-AC-05 在 FakeClock 前进多日、关闭重开和同一临时数据库上通过；
- 项目所有者未执行人工 AC-05 时状态保持 `pending`；
- T042 只形成 S4 acceptance candidate，不自动启动 T051。

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

**依赖与完成条件**

- S2/S3 当前事实和 S4 acceptance gate 已复核；
- 按已批准的 S45-Q03-A 默认进入当前所在周；
- Summary 与同 filter Progress 事实一致，且不复制/另算相冲突公式；
- 四种显式 Routine outcome 分列；缺行不进入 not_done 或失败；
- Query/context 不写 SQLite、不持久化统计；跨周不静默移动；
- 不声明 AC-06 完成，只证明步骤 1 和 FR-RV01、FR-RV06。

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

**依赖与完成条件**

- T051 完成；已批准的 Q04-A schema/export、Q05-A multiplicity、Q06-A atomicity 写入 T052 合同；任务合同另行明确 migration 执行权限；
- ReviewResult 三字段、周期、Goal detach、重开和编辑语义通过单元/SQLite/IPC/E2E；
- 确认前零写入，非法 context/Goal/Action/文本和故障全部回滚或准确报告批准的分步结果；
- export v1/v2 或获批替代兼容策略均有正反 fixture；migration v2 → v3 守恒；
- 完整 E2E-AC-06 和项目所有者人工验收完成后才能声明 AC-06 相应结果；
- 不自动授权 G4、Ready、merge、main、tag、release、S6 或 S7。

### 12.6 稳定命令与额外验证

每个任务合同选择定向命令，并在 candidate revision 执行受影响回归。最低稳定命令为：

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
```

阶段最终还应按实际合同/环境执行：

- `npm.cmd run governance:metadata:check`；
- evidence wrapper 绑定 task/base/source revision；
- Windows package、unpacked 和隔离 NSIS smoke；
- v2 → v3 migration/重开和 export v1/v2 契约（按已批准 Q04-A，且仅在 T052 获执行授权后）；
- Electron security/Preload API shape；
- 项目所有者人工 AC-05、AC-06。

`verify` 不替代 package、hosted CI、人工体验、migration compatibility 或 final-head 证据。

### S45-Q07：S4 与 S5 的实施节奏

- **批准结论：A（2026-08-27）**。任务严格串行 `T041 → T042 → T051 → T052`；按本方案既定阶段门，T042 与 T051 之间仍须完成 S4 owner acceptance gate，任务顺序简写不构成跳过该门的授权。
- **选项 A（已批准）**：严格串行 `T041 → T042 → S4 owner gate → T051 → T052`。
- **选项 B**：T041 与 T051 的 read-only slice 并行，mutation tasks 后续串行。
- **选项 C**：四任务一次性合并为一个阶段 PR/合同。
- **影响**：A shared surface 冲突最少，AC-05 可在影响 S5 前获得人工反馈。B 缩短日历时间，但 Repository/Main/Preload/API 文件重叠且需要额外整合。C 违反聚焦任务合同和独立证据，diff、migration 和人工门过大。
- **可逆性**：A 可在未来经明确授权放宽；B/C 产生重叠历史后难以恢复清晰 task delivery revision。

### 15.4 Required authorization

| Gate | 控制者 | 当前状态 |
|---|---|---|
| 完整 S4/S5 设计与 Q01～Q07 | 项目所有者 | `approved`（2026-08-27，均选择 A） |
| T041/T042/T051/T052 合同和启动 | 项目所有者 | 未授权 |
| dependency change | 项目所有者 | 批准设计不需要；新增/升级仍未授权 |
| schema v3 / export v2 设计 | 项目所有者 | `approved`（S45-Q04-A） |
| schema v3 / export v2 实施与 migration | 项目所有者，T052 精确合同 | 未授权 |
| branch/worktree/commit/push/Draft PR | 各 Txxx 合同与项目所有者 | 未授权 |
| Ready/merge dev/main/tag/release | 项目所有者针对确切目标 | 未授权 |
| AC-05/AC-06 人工验收和阶段门 | 项目所有者 | pending |
| S6/S7 或下一阶段启动 | 项目所有者独立决定 | 未授权 |

## 16. 阶段门与连续实施结论

### 16.1 S4 entry gate

- 本文及适用于 T041/T042 的决定已获项目所有者批准；
- T041 独立合同绑定最新授权 dev、允许文件、排除、验证和 Git/GitHub 权限；
- T094/Renderer ownership、S1/S3 数据行为和稳定命令仍成立；
- 无未处理 MUST/架构冲突、依赖变化或 migration 需要。

### 16.2 S4 acceptance gate

- T041、T042 分别形成真实 task delivery revision，并经 owner-approved merge 进入最新 dev；
- Integration Freshness 为 `fresh` 或 `refreshed-and-passed`；
- AC-05 自动化在同一 S4 final integration revision 通过，历史 Record 守恒、无补行、重开和跨日证据齐全；
- 项目所有者人工确认返回体验先显示成果和可开始内容，无断签/逾期/失败施压；
- 所有失败、限制、人工 pending 和 superseded 证据保留；
- 项目所有者明确决定是否允许激活 T051。S4 通过不自动开始 S5。

### 16.3 S5 entry gate

- S4 acceptance 结果已记录，或项目所有者明确批准在其 pending 状态下开始 S5；
- 已批准的 Q03-A～Q06-A 写入相应合同；T052 的 migration/export 执行权限写入精确合同；
- 最新 dev 的 Progress、schemaVersion、exportVersion 和 Review placeholder 重新核对；
- T051/T052 各自独立合同批准，不复用 S4 的实现权限。

### 16.4 S4/S5 final gate

- T041～T052 task delivery 与 dev integration revision 均可追踪；
- 最终审计绑定一个最新授权 `stage_final_integration_revision`；
- AC-05 → AC-06 aggregate E2E 在同一 DB、同一 revision、不重置状态下通过；
- AC-01、AC-03、AC-04、AC-07 受影响回归和 `npm.cmd run verify` 通过；
- Windows package/unpacked/NSIS smoke、重开、安全边界及批准后的 migration/export 验证通过；
- 项目所有者分别完成并签署 AC-05、AC-06 人工结果；任何 partial/fail 如实保留；
- complete diff 独立 review 无未处理高风险问题；
- 文档 closeout、final-head CI、Ready、merge、`dev -> main`、tag、release 和 G4 仍由项目所有者分别决定。

### 16.5 连续实施结论

**已批准 S4 与 S5 连续、串行实施，并保留明确的 S4 人工验收和 T052 migration 执行权限门。**

理由：Recovery 为用户重新形成当前下一步，Review 随后用同一事实确认阻力和一个调整，产品闭环连续；两者共享 Progress、LocalDate、current-next、Main/Preload 和最终 E2E。先完成 S4 可以用真实人工反馈校正 Recovery 文案和下一步选择，再进入持久化/导出风险更高的 T052。连续实施不表示一次性授权、并行写共享面、跳过任务合同或自动开始下一阶段。

## 17. 批准设计交付核对

- [x] T041～T052 范围、非范围、依赖、交付物和完成条件明确，无重复实现责任；
- [x] AC-05、AC-06 各有独立连续程序，并有 AC-05 → AC-06 同数据库聚合程序；
- [x] Recovery 不改写历史，不补空白日，不自动改变 Goal/Action/Routine 状态；
- [x] Review 只汇总事实与用户输入，不生成评分、掌握度、streak 或推断失败；
- [x] unknown、not_done、intentional_rest、acted、target_met 保持区分；
- [x] LocalDate、跨日/跨周、重开、补记/改日和历史数据行为具有明确设计；
- [x] Commands、Queries、IPC、事务、Renderer、SQLite、migration、索引和 export 边界已说明；
- [x] 所有引用的 FR/AC/D/ED 编号来自现行基线；T042 的追踪误指已报告；
- [x] Q01～Q07 均记录项目所有者批准的 A 方案；风险和假设保留替代选项、影响、可逆性和重新审批边界；
- [x] S4/S5 连续实施建议与两阶段 owner gate 已明确；
- [x] AI、S6/S7、延期能力和完整单任务 Prompt 未进入本文；
- [x] 本文状态为 `approved`，但不改变 TASK_INDEX、任务合同、需求基线或既有证据；
- [x] 本文批准也不会构成 T041～T052 实现、Git/GitHub、合并或发布授权。

本设计已由项目所有者批准，可作为后续独立任务合同的设计依据。下一步仍须按批准顺序为 T041 建立并批准精确合同；本文不创建任务合同、不激活 T041，也不授权实现、migration、Git/GitHub、合并或发布。

## 补充执行与批准上下文

### 原文片段 1

任务合同可以在语义不变时微调技术命名

### 原文片段 2

#### 9.3 已批准设计但尚未授权执行的 schema v3

### 原文片段 3

该批准固定设计语义，不授权在 T052 合同之外执行 migration

### 原文片段 4

migration/export 变更需要 T052 合同显式 `migration_change: true` 和项目所有者执行授权

### 原文片段 5

后续任务合同必须采用批准结论

### 原文片段 6

T052 合同仍必须显式声明 `migration_change: true` 并取得执行授权

### 原文片段 7

不进入任务合同

### 原文片段 8

#### 15.2 已采用的设计假设及替代处理

这些假设不是产品事实。完整设计批准采用每项 A 方案作为合同准备时的处理方式；合同开始前仍须重验，若事实不成立则停止受影响合同并重新设计，而不是静默切换替代方案。

| ID / 假设 | 可选择方案 | 批准处理 | 影响 | 可逆性 |
|---|---|---|---|---|
| A01 / 合同开始时 `dev` 仍与本文基线兼容 | A 在每个合同前重核最新 dev；B 固定旧 SHA 实施；C 静默替换本文 SHA | A | B 可能遗漏已集成变化；C 破坏追踪 | A 只增加核验；B/C 发现漂移后需重做设计/合同 |
| A02 / 现有 Progress facts 可被 Recovery/Review 复用 | A 在允许面内共享 builder；B 复用 facts port 并交叉断言；C 复制公式 | A，越界时 B | A 可能扩大定向 diff；B 有组合层但可验证；C 双真相 | A/B 可互换；C 清理成本随版本增长 |
| A03 / 合法 v2 `review_results` 旧行可能存在 | A 按非空旧数据设计 migration；B 假设表为空；C 删除/忽略旧行 | A | B/C 会让真实历史不可解释，即使当前 UI 尚无 writer | A 保守且无需撤回；B/C 一旦丢失数据不可逆 |
| A04 / 周一至周日和 LocalDate 保持批准语义 | A 沿用 D-106；B 用户配置周起点；C 使用 UTC/locale 默认 | A | B 是新增设置；C 会导致跨设备/locale 漂移 | A 可未来扩展；B 需配置兼容；C 产生的错期结果难修复 |
| A05 / sender-bound 内存 context 足以保护确认周期 | A 复用 recording/delete context 模式；B 信任 Renderer period；C 持久化草稿/token | A | B 扩大 IPC 信任；C 新增导出/清理/过期语义 | A 无持久数据；B 可修接口但旧错误请求难追；C 需 migration/清理 |
| A06 / S4/S5 不需要新增依赖 | A 使用现有 TypeScript/SQLite/测试栈；B 发现真实缺口后单独申请；C 合同内隐式加入 | A；B 作为停止后升级路径 | B 延迟任务但权限清楚；C 违反依赖门 | A 无回退；B 可单独评估；C 可能造成 lockfile/API 兼容负担 |



### 原文片段 9

| R12 / shared surfaces 并行冲突 | A 严格串行；B 只读任务并行后集成；C 单大合同/PR | A；与 Q07 一致 | B 增加接口冻结和整合成本；C 弱化证据、review 和 owner gate | A 可后续放宽；B/C 形成重叠历史后难以恢复清晰 revision |

### 原文片段 10

发现以下情况时停止受影响设计/合同/实现并报告

### 原文片段 11

T052 合同未明确获得 migration/export 执行权限却需要改变 schema/export

### 原阶段完整验证停止条件

- 无法在同一最终 revision 连续完成 AC-05/AC-06 或保留失败/partial/superseded evidence。

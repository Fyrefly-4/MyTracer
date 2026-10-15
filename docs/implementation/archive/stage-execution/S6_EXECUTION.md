# S6 历史阶段执行记录

> 来源：`beb8b97b2c9ecdef4ab0677853eef195c2367544` 中的 [S6_AI_START_HELP_DESIGN_V0.1.md](../../../architecture/S6_AI_START_HELP_DESIGN_V0.1.md)。本文保留当时的执行、授权和交付上下文，不是当前状态或普通工作的指令；旧批准不恢复执行权限。技术正文继续在原设计文件维护。

## 原页首状态与授权


> 文档状态：**已批准；项目所有者于 2026-08-31 批准完整设计及 S6-Q01～Q05 推荐方案。设计批准本身不自动授权 T062/T063。**
>
> 设计范围：S6 / E6-01～E6-03 / T061～T063
>
> 核心验收：AC-02 难以开始时获得帮助
>
> 设计权限：S6-Q01 A、Q02 A、Q03 B、Q04 A、Q05 A 已批准；T061 合同、任务启动及其限定 Git/GitHub 权限另行获批。Q01/Q02 的确切 Provider 三元组和展开后的环境变量名、T062/T063、真实 Provider 调用、Ready、merge、tag 和 release 仍需各自 Gate。



## 0. 文档用途与权限边界

本文把冻结的 AI 产品语义、已批准的工程边界、已集成的 S1～S5 行为和当前代码事实收敛为 T061、T062、T063 的整体设计输入。本文只描述 S6 的阶段增量、信任边界、接口候选、任务图、验证和审批门；它不创建任务合同、不改变任务状态，也不实现任何 AI 功能。

解释顺序保持为：

1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../../../PRODUCT_REQUIREMENTS_V0.1.md)；
2. [`DECISIONS.md`](../../../DECISIONS.md)；
3. [`REQUIREMENTS_CHANGE_POLICY.md`](../../../REQUIREMENTS_CHANGE_POLICY.md)；
4. [`ARCHITECTURE_V0.1.md`](../../../architecture/ARCHITECTURE_V0.1.md)、[`DOMAIN_MODEL_V0.1.md`](../../../architecture/DOMAIN_MODEL_V0.1.md)、[`DATA_DESIGN_V0.1.md`](../../../architecture/DATA_DESIGN_V0.1.md)、[`AI_BOUNDARY_V0.1.md`](../../../architecture/AI_BOUNDARY_V0.1.md) 和 [`ENGINEERING_DECISIONS_V0.1.md`](../../../architecture/ENGINEERING_DECISIONS_V0.1.md)；
5. [`IMPLEMENTATION_PLAN_V0.1.md`](../../../architecture/IMPLEMENTATION_PLAN_V0.1.md)、[`TEST_STRATEGY_V0.1.md`](../../../architecture/TEST_STRATEGY_V0.1.md) 和 [`REQUIREMENTS_TRACEABILITY_V0.1.md`](../../../architecture/REQUIREMENTS_TRACEABILITY_V0.1.md)；
6. 已批准的 S1～S5 阶段设计，特别是 [`S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md`](../../../architecture/S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md)；
7. [`TASK_INDEX_V0.1.md`](../../TASK_INDEX_V0.1.md)、[`TASK_TEMPLATE.md`](../../TASK_TEMPLATE.md) 和 [`GITHUB_WORKFLOW_V0.1.md`](../../GITHUB_WORKFLOW_V0.1.md)；
8. 本文基线 revision 上实际存在的 Domain、Application、SQLite、IPC、Preload、Renderer、fake AI、safeStorage 空适配器和 export v2 契约。

`user/` 不属于本文依据，也不得成为 T061～T063 的设计、实现、测试或验收依赖。

本文使用以下标记：

| 标记 | 含义 |
|---|---|
| **冻结/已批准** | 直接来自 FR、AC、D、ED 或现行最终架构基线，后续任务不得自行改变 |
| **当前实现事实** | 在本文基线 revision 上实际存在的接口、schema、UI ownership 或测试基础设施 |
| **批准的 S6 设计** | 本文已由项目所有者批准，可作为独立 T061～T063 合同的设计依据，但不替代任务授权 |
| **已批准选择** | 第 15 节的 S6-Q01～Q05 已选择推荐方案；T062 仍须固定 Q01/Q02 的确切值 |
| **延期/非范围** | 不进入 S6，不得成为接口、表、依赖、测试前置或完成条件 |

本文不授权：

- 修改代码、依赖、配置、schema、migration、任务合同、metadata、任务索引、验收证据、需求或决定；
- 仅凭本文创建、激活或执行 T061～T063；T061 的现行权限来自其独立批准合同，T062/T063 仍未授权；
- 创建 branch/worktree/commit，执行 push、Draft PR、Ready、merge、tag 或 release；
- 写入或迁移真实用户数据库，配置真实密钥，调用真实或付费 Provider；
- 建设通用 Agent 平台、长期记忆、自动计划、主动监督、跨 Goal 分析或任何延期能力。

## 1. Stage information

- **Stage**：S6
- **Title**：AI 启动帮助（AI Start Help）
- **Status**：`approved`；T061 `active`
- **Owner approval**：2026-08-31，完整 S6 设计及 S6-Q01 A、Q02 A、Q03 B、Q04 A、Q05 A
- **Target branch**：`dev`
- **Current design source**：`dev@1342cd7d8819ad269791c1834fcbd0c7596b0959`
- **Prior behavior revision**：`dev@84b596e12e54db098857004497a4d1964dcdc23c`
- **Current schema version**：3
- **Current export version**：2
- **Current S6 task state**：T061 `active`；T062/T063 `pending`

`1342cd7...` 是设计批准和 T061 合同绑定的当前 `dev` 基线；最近改变产品运行行为的 revision 仍是 T052 集成后的 `84b596e...`。若任何后续任务合同基于不同 revision，必须重新核对代码、schema、export、任务状态、依赖和共享面，不能只替换本文 SHA。

## 2. Baseline manifest 与冲突核对

```yaml
baseline:
  product_requirements:
    file: docs/PRODUCT_REQUIREMENTS_V0.1.md
    version: v0.1
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
    - docs/architecture/AI_BOUNDARY_V0.1.md
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S1_CORE_LOOP_DESIGN_V0.1.md
    - docs/architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md
    - docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
    - docs/architecture/S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md
  implementation_documents:
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  current_design_source: dev@1342cd7d8819ad269791c1834fcbd0c7596b0959
  prior_behavior_revision: dev@84b596e12e54db098857004497a4d1964dcdc23c
  schema_version: 3
  export_version: 2
```

### 2.1 可直接依赖的当前事实

- S1～S5 已提供 Goal、Action、Routine、两类 Record、Today、Progress、数据修正/删除、完整导出、Recovery 和 Review。
- `GoalService.createAndSetGoalCurrentNextAction` 已在同一事务创建关联当前 Goal 的 pending Action 并设置 `currentNextActionId`；该语义可以作为 AI 建议确认后的普通 Application Command 基础。
- Understanding 已作为 ActionRecord 子事实持久化，schema 支持 `source = manual | ai_candidate_confirmed`，并进入 Progress、Recovery、Review 和 export v2。
- 当前没有独立创建 `ai_candidate_confirmed` Understanding 的普通 Application Command；T063 必须补齐窄命令设计，但不需要 schema 或 export 变化。
- 当前生产 AI 配置只有 `not-configured` 空边界；safeStorage 空适配器不读取或保存密钥。
- 当前 fake provider 已支持 success、timeout、cancellation、authentication failure、parse failure、late response 和 fabricated fact 脚本，可作为 T062 扩展基础，但它不是生产 Provider 实现。
- Main 是 SQLite、Application、export、configuration 和未来 AI 网络请求的唯一可信宿主；Preload 和 Renderer 已保持窄 API、sender/origin 校验、sandbox、无 Node integration。
- 当前 `ai-data-capability` 测试已证明 disabled、not-configured、failure 下核心数据能力不依赖 AI；S6 必须扩展该证据而不能替换或弱化它。

### 2.2 冲突核对结论

截至本文基线，未发现以下内容之间存在无法同时满足的冲突：

- FR-AI01～FR-AI10、FR-C02/C03 和 AC-02；
- D-004、D-012～D-015、D-104、D-108、D-109；
- ED-004、ED-005、ED-010、ED-011、ED-014、ED-015、ED-019；
- 当前 Goal current-next、Understanding、历史 Record、SQLite、export 和 Electron 安全不变量。

S6 可以在不新增核心表、不改变 schema v3、不升级 export v2、不赋予 Provider 写权限且不保存 AI 会话的条件下完成设计。

### 2.3 必须显式保留的工程张力

1. **凭据入口与 Renderer 隔离**：ED-010 已批准打包使用 safeStorage，但首个凭据如何进入 Main 尚未批准。若严格要求 Renderer/Preload 从不接触明文密钥，则普通 Renderer 密钥输入框不可作为静默默认。第 15.2 节给出方案；未批准前 T062 保持阻塞。
2. **Understanding 归属**：当前 Understanding 必须关联既有 ActionRecord；AI 不得为保存候选而虚构 ActionRecord。本文提议仅允许用户把候选逐项确认到本次 manifest 中已有的相关 ActionRecord；没有合格 Record 时只能保留临时候选或丢弃，不能落库。
3. **Provider/预算依赖门**：T061 可以用注入预算和纯选择器完成独立证明；T062 只有在首个 Provider、模型、SDK/HTTP 方式、环境变量、生产预算和超时策略获批后才能形成生产适配器合同。

这些张力不改变冻结产品语义，但会改变 T062/T063 的工程合同和 UI。完整 S6 设计审批必须明确接受本文处理方式或给出替代选择；实施者不得自行决定。

## 11. Task graph、共享面与实施顺序

### 11.1 任务关系

```yaml
tasks:
  T061:
    slice: E6-01
    requires: [S1, S3]
    blocks: [T062]
    can_parallel: []
    prefer_after: [S4_S5_FINAL_GATE]
    conflicts_with: [T062, T063]
  T062:
    slice: E6-02
    requires: [T061, S6_PROVIDER_ENGINEERING_DECISIONS]
    blocks: [T063]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T061, T063]
  T063:
    slice: E6-03
    requires: [T062]
    blocks: [S6_FINAL_GATE]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T061, T062]
```

`S6_PROVIDER_ENGINEERING_DECISIONS` 和 `S6_FINAL_GATE` 是审批门，不是新 Txxx，也不写入任务索引。

### 11.2 shared surfaces

| 共享面 | 任务 | 冲突依据 | 风险 | 集成策略 |
|---|---|---|---|---|
| contracts / `MyTracerApi` | T061～T063 | AI DTO、Result、Preload 类型必须逐步兼容 | high | serial |
| Main composition / IPC security | T061～T063 | service 装配、session cleanup、sender/origin handler | high | serial |
| persistence query surface | T061、T063 | 窄 context query、Understanding target validation | high | serial |
| AI configuration / safeStorage | T062、T063 | status、credential、disabled flow、startup | high | serial |
| Today Renderer | T062、T063 | unavailable UI、session/draft/confirm state | high | serial |
| Goal current-next invariant | T063 | expected precondition、原子 Action+Goal 写入 | high | 独立 command review |
| ActionRecord/Understanding invariant | T061、T063 | manifest target、existing record FK、source | high | serial + SQLite regression |
| fake provider/test harness | T061～T063 | call capture、failure scripts、E2E control | medium | each task extends; no parallel edits |
| AC-02 aggregate E2E | T061～T063 | 同一 DB/session、隔离、失败、确认 | high | final same revision |

三个任务虽然可以概念上分层，但会重复修改 contracts、Main、Preload、Today 和 fake provider。当前单业务任务 active 规则下必须严格串行；不建议通过独立 worktree 并行产生相互猜测的 API。

### 11.3 批准的实施和审批顺序

```text
项目所有者批准本设计及 S6-Q01～Q05
  → T061 独立合同、实现、验证、review、集成
  → 重新核对最新 dev 与 Provider 工程决定
  → T062 独立合同（含依赖/网络/credential 精确权限）
  → T062 实现、fake/contract/降级验证、review、集成
  → T063 独立合同、实现、验证、review、集成
  → AC-02 continuous E2E + AC-01/03/04/05/06/07 affected regression
  → Windows package/security/reopen/export 检查
  → 项目所有者人工 AC-02
  → 同一 stage_final_integration_revision 的 S6 final gate
  → 项目所有者决定后续任务；不自动开始 S7 或发布
```

每个 Txxx 必须有独立合同、task delivery revision、candidate/final-head CI 和 owner-controlled merge。设计审批不等于任务批准，T061 完成不自动启动 T062，T062 完成不自动启动 T063。

## 12. T061～T063 范围、非范围、交付物和完成条件

### 12.1 T061 — AI 最小上下文选择器和隔离证明

**可观察结果**

在纯测试和 Main/Application 边界中，用户主动触发可以生成满足上限、排序和预算的最小请求；未触发或上下文非法时 Provider 调用为零，其他 Goal/credential/log/full DB 唯一标记不进入请求。

**范围/交付物**

- 窄 context query snapshot；
- pure `AiContextSelector`、`ContextBudget`、Provider-facing DTO 和 internal manifest；
- ActionRecord 相关性、排序、最多 5 条、字符预算和截断；
- fake call capture 和唯一标记 fixture；
- unit、SQLite/query integration 和隔离测试；
- 不需要生产 Provider、SDK、网络或 UI 草稿。

**非范围**

- Provider adapter、credential、safeStorage 写入、超时或网络；
- Renderer AI 完整流程、接受/修改/拒绝；
- 任何核心写入或 Understanding 确认；
- RoutineRecord、跨 Goal、full snapshot 或长期记忆。

**依赖/开始条件**

- 最新授权 dev 仍满足 S1/S3 Goal/Action/ActionRecord/Understanding 和 query 事实；
- 本设计已获项目所有者批准并写入 T061 精确合同；
- 不需要新增依赖、migration、网络或真实 key；
- 合同明确允许文件、测试和 Git/GitHub 权限。

**完成条件**

1. 所有允许/禁止字段、排序、5 条上限、预算和 manifest 具有确定性单元证据；
2. mandatory 超预算、无 Goal、stale/missing Action 均为 local failure 和 0 provider calls；
3. unique-marker 测试证明其他 Goal、RoutineRecord、credential、log 和 full snapshot 不发送；
4. selector/query 不写 SQLite，不使用完整 export snapshot；
5. targeted tests、affected regression、完整 diff review 和证据按合同完成；
6. 不声明 Provider、UI、AC-02 或 S6 完成。

### 12.2 T062 — 可替换 Provider、超时和失败降级

**可观察结果**

在已批准 Provider 工程决定下，Main 可以通过可替换 port 请求结构化 Start Help，并在 disabled/not-configured/credential failure/timeout/cancel/network/provider/invalid response 下中性降级；基础功能始终可用。

**范围/交付物**

- `AiStartHelpProvider`、runtime validator、error taxonomy、timeout/cancel/generation；
- expanded fake provider 和 adapter contract suite；
- approved Provider adapter、SDK/HTTP dependency、environment/configuration、safeStorage credential adapter；
- Main session request lifecycle、status Query、start/cancel/retry/close IPC/Preload；
- 最小 unavailable/requesting/error Renderer 状态，完整确认 UI 可留给 T063；
- credential/export/log isolation 和 AI data capability regression。

**非范围**

- 未批准厂商、模型、SDK、网络域、key 名或超时；
- 多 Provider 路由、fallback 模型、tool use、通用 chat/agent；
- 核心数据写入、建议确认或 Understanding 保存；
- live Provider 进入 default test/verify/CI；
- schema/export 变化。

**依赖/开始条件**

- T061 已集成且 manifest/request contract 稳定；
- 项目所有者批准 S6-Q01～Q05 的确切方案；
- T062 合同明确 `dependency_change`、network、Provider、credential/config file 和外部操作权限；
- 依赖版本、lockfile 范围、环境变量、生产预算和 timeout 固定；
- 无真实 key 进入 repo/worktree/CI。

**完成条件**

1. fake 和已批准 adapter 通过同一 Start Help contract；
2. 0/>3 suggestions、未知字段、超长/非法响应均不能成为 draft；
3. cancel、timeout、late response、new generation 和 sender cleanup 可重复验证；
4. Main-only network/credential，Renderer/Preload 无 SDK、key getter 或任意 network/channel；
5. disabled/not-configured/failure 下 CRUD、Progress、Recovery、Review、delete、export 和 restart 继续工作；
6. package/unpacked 环境中 safeStorage 不可用时应用仍启动；
7. 不声明建议确认、Understanding 或完整 AC-02 完成。

### 12.3 T063 — AI 建议接受/修改/拒绝和确认命令

**可观察结果**

用户在 Today Action 完成 AC-02：主动触发后可以接受、修改、拒绝、关闭和重试；只有明确确认通过普通命令创建新 current next 或逐项保存 Understanding，所有未确认分支零核心写入。

**范围/交付物**

- 完整 Renderer DraftReady/Failed/Cancelled/Confirmed/Rejected/Closed 状态；
- `ConfirmStartHelpSuggestion` 和 `ConfirmStartHelpUnderstanding` 编排；
- ordinary current-next command 的 stale precondition 和原子性；
- ordinary `AddConfirmedUnderstandingToActionRecord` command；
- per-candidate Understanding target、确认、失败和 source；
- unit、SQLite、IPC、E2E-AC-02、reopen/export/affected AC regression；
- 项目所有者人工 AC-02 程序和阶段 gate 输入。

**非范围**

- 自动 TodaySelection、原 Action 状态变化或历史 Record 编辑；
- 无 Record 时创建 Understanding 或虚假 Record；
- 保存对话/草稿、接受率统计、模型评价或长期记忆；
- schema/export 升级、概念图谱、掌握度或 S7。

**依赖/开始条件**

- T062 已集成，Provider/fake/session/error API 稳定；
- 最新 dev 的 current-next、Understanding、Progress/Recovery/Review/export v2 契约重新核对；
- T063 合同固定 ordinary command、transaction、allowed files、manual acceptance 和 Git/GitHub 权限；
- 无 migration 或新依赖；若需要，停止并另行审批。

**完成条件**

1. 接受、修改、拒绝、关闭、取消、timeout、not-configured、invalid response 和 retry 全部分支有真实结果；
2. 确认前和所有未确认分支 SQLite/core snapshot 严格相等；
3. Action 确认只保存最终文本，原子创建 pending Action/current next，不改变原 Action/Today/history；
4. Understanding 逐项确认、正确关联 existing ActionRecord、source 正确，未确认项不落库；
5. command failure/stale context 回滚且 UI 准确显示未保存；
6. AC-02 continuous E2E、AC-01/03/04/05/06/07 affected regression、`npm.cmd run verify` 和 Windows package/security 通过；
7. 项目所有者人工 AC-02 仍明确记录为 pending，直到实际执行。

### 13.6 稳定命令与证据

每个任务合同按影响范围选择针对性命令，S6 final gate 至少要求：

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
```

还需按合同执行 Windows unpacked/package/NSIS smoke、credential/config isolation、export inspection 和 bundle/security scan。V2 evidence 使用 explicit-argv capture wrapper，artifact 只能记录脱敏元数据；不得记录 stdout/stderr、用户输入、AI request/response、key、路径或环境变量正文。

### 16.3 Required authorization

| Gate | 控制者 | 当前状态 |
|---|---|---|
| 完整 S6 设计及 S6-Q01～Q05 | 项目所有者 | `approved`（2026-08-31；A/A/B/A/A） |
| T061 合同和启动 | 项目所有者 | `active`；仅 T061 合同范围 |
| Provider/model/SDK/依赖/network | 项目所有者 + T062 精确合同 | Q01 A 方向已批准；确切三元组、依赖和网络未授权 |
| credential/env/config file/文本预算/timeout | 项目所有者 + T062 精确合同 | Q02 A、Q03 8,000、Q04 20 秒/无自动重试已批准；确切 env/config 实现未授权 |
| optional live Provider contract test | 项目所有者 + T062 精确合同 | Q05 A 方向已批准；建立和运行未授权 |
| T062/T063 合同和启动 | 项目所有者 | 未授权 |
| schema/export change | 项目所有者 | 本设计不需要；若出现则停止 |
| branch/worktree/commit/push/Draft PR | 各 Txxx 合同与项目所有者 | T061 已按独立合同授权；T062/T063 未授权 |
| Ready/merge dev/main/tag/release | 项目所有者针对确切目标 | 未授权 |
| AC-02 人工验收和 S6 final gate | 项目所有者 | `pending` |
| S7/下一阶段 | 项目所有者独立决定 | 未授权 |

## 17. S6 阶段门

### 17.1 Entry gate

- 本文及 S6-Q01～Q05 已由项目所有者明确批准；
- T061 独立合同绑定最新授权 dev、允许文件、排除、验证和 Git/GitHub 权限；
- S1/S3 current-next、ActionRecord/Understanding、S4/S5 Recovery/Review 和 export v2 基线仍成立；
- 无 MUST/架构冲突、未批准依赖、migration 或权限扩张；
- fake provider、temporary roots 和 Windows validation 环境可用。

### 17.2 T061 → T062 gate

- T061 task delivery revision 和 dev integration revision 可追踪；
- manifest/marker/call-count/预算证据通过且绑定最新 dev；
- Provider-facing DTO 冻结，没有其他 Goal、credential、log 或 full snapshot；
- S6-Q01～Q05 的确切批准值写入 T062 合同；
- dependency/network/credential 权限明确；T061 通过不自动激活 T062。

### 17.3 T062 → T063 gate

- T062 task delivery 和 dev integration revision 可追踪；
- fake/approved adapter contract、timeout/cancel/late/error matrix 通过；
- disabled/not-configured/failure 核心能力、package startup、safeStorage/export/log isolation 通过；
- Renderer/Preload/Main/security 边界独立 review 无未处理高风险问题；
- T063 合同固定确认命令、stale precondition、Understanding target 和 AC-02 程序；T062 通过不自动激活 T063。

### 17.4 S6 final gate

- T061～T063 各自的 task delivery revision、dev integration revision、candidate/final-head CI 和证据可追踪；
- Integration Freshness 均为 `fresh` 或 `refreshed-and-passed`；
- 最终审计绑定一个最新授权 `stage_final_integration_revision`；
- §13.2 continuous E2E 在同一 DB、同一 revision、不重置核心状态下通过；
- AC-02 接受、修改、拒绝、timeout、关闭、未配置、取消、invalid response、retry、Understanding 分支全部有真实结果；
- 上下文隔离、确认前零写入、Provider 永无 Repository/write、AI 完全不可用核心应用继续具有自动化证据；
- AC-01/03/04/05/06/07 affected regression 和 `npm.cmd run verify` 通过；
- Windows unpacked/package/NSIS smoke、reopen、export v2、safeStorage degradation、Electron security 和 bundle scan 通过；
- 项目所有者完成并签署人工 AC-02；任何 partial/fail/pending 如实保留；
- complete diff 独立 review 无未处理高风险问题，依赖/lockfile/网络域与批准完全一致；
- docs closeout、final-head CI、Ready、merge、`dev -> main`、tag、release、G4 和 S7 仍由项目所有者分别决定。

阶段通过不会自动授权发布或下一阶段。较早 T061/T062/T063 绿色 revision 不能替代最终 aggregate revision。

## 18. 设计批准与交付核对

- [x] 文档状态已记录 2026-08-31 项目所有者批准；设计批准不自动授权 T062/T063；
- [x] 基线绑定 current design source、prior behavior revision、schema v3 和 export v2；
- [x] 完整流程覆盖主动触发、最小上下文、Provider、临时建议、接受/修改/拒绝和普通命令确认；
- [x] T061 的允许字段、相关性、排序、5 条上限、预算、manifest、唯一标记和零调用明确；
- [x] T062 的 Provider Port、DTO、runtime validation、取消、timeout、错误分类、Main-only network/credential 和降级明确；
- [x] T063 的状态机、Action 原子确认、Understanding 逐项确认、未确认零写入和历史守恒明确；
- [x] Provider 永远不能直接调用 Repository、UnitOfWork 或写数据库；
- [x] Commands、Queries、Ports、IPC、Preload、Renderer、事务、session 和错误边界明确；
- [x] 无 schema/migration/export version 变化，credential/AI 临时数据与 SQLite/export/log 隔离；
- [x] T061～T063 范围、非范围、依赖、交付物、完成条件、共享面和严格串行顺序明确；
- [x] unit、contract、integration、IPC、E2E、package、安全和人工验收矩阵覆盖 AC-02 及 AC-01/03/04/05/06/07 回归；
- [x] 自动测试默认 fake provider，不调用真实付费服务；
- [x] FR-AI01～AI10、FR-C02/C03、AC-02 和相关 D/ED 均映射到 Txxx 与测试层级；
- [x] Provider/model/SDK、环境变量/凭据入口、预算、timeout/retry 和 live contract test 均保留选项、影响、风险和可逆性，并明确记录 A/A/B/A/A 批准结论及 T062 精确值 Gate；
- [x] 通用 Agent、长期记忆、自动计划、主动监督、跨 Goal 分析和延期能力保持非范围；
- [x] 未发现 MUST、批准决定或现有不变量冲突；凭据入口和 Understanding 归属张力已显式报告；
- [x] 设计批准、任务合同、依赖、Git/GitHub、人工验收、merge/tag/release 和下一阶段门保持由项目所有者控制。

本设计已获项目所有者批准，只可作为 T061～T063 独立任务合同的设计依据。T061 已由独立合同激活；本批准不会自动创建或激活 T062/T063，不授权安装依赖、配置或调用 Provider、执行 live contract、Ready、merge、tag、release 或推进下一阶段。

## 补充执行与批准上下文

### 原文片段 1

T061 合同必须优先增加一个窄 Repository query/snapshot

### 原文片段 2

由 T062 合同固定的长度上限

### 原文片段 3

由 T062 合同在 S6-Q02 批准后固定

### 原文片段 4

#### 15. 已批准的工程决定

项目所有者于 2026-08-31 选择推荐方案 Q01 A、Q02 A、Q03 B、Q04 A、Q05 A。Q01 的确切 vendor/model/package/version 和 Q02 展开的 `MYTRACER_<PROVIDER>_API_KEY` 名称仍由 T062 独立合同固定；这两项未决精确值不得由 T061 实现 Agent 推断，也不授权依赖、网络、凭据或真实 Provider 调用。

#### 15.1 S6-Q01：首个 Provider、模型和 SDK

| 选项 | 内容 | 影响 | 风险 | 可逆性 |
|---|---|---|---|---|
| A（已批准） | 选择一个云 Provider、其官方 JavaScript SDK，以及一个低延迟/低成本/支持结构化输出的文本模型；确切 vendor/model/package/version 在 T062 合同固定 | 最容易使用官方取消、认证和结构化响应；新增一个批准依赖和网络域 | SDK 体积、版本/模型下线、厂商锁定、付费与隐私 | Provider Port 隔离后可替换；已发布配置需兼容 provider/model 标识 |
| B | 选择一个云 Provider，使用 Node 内置 HTTPS/fetch 直接调用，无 SDK | 少一个依赖，request/response/error mapping 全部自维护 | API 变化、流式/取消/错误细节易漂移，安全 review 面更大 | adapter 可替换；自写协议债需删除 |
| C | 首阶段只保留 fake，不接真实 Provider | T061/T063 边界可验证，但无法完成真实 S6 日常使用和 T062 生产交付 | AC-02 只能证明 fake 产品流程，无法证明真实配置/网络 | 易升级，但 S6 final gate 必须保持 pending |
| D | 本地模型/runtime | 无云请求 | 新 runtime、模型分发、硬件、打包、更新和大依赖，超出当前轻量边界 | 难回撤，安装/配置兼容成本高 |

**批准结论**：采用 A 的单一窄适配器方向，不建设通用兼容层。确切厂商、模型 ID、package 和版本范围推迟到 T062 合同一并批准；在此之前不得安装依赖或发起网络请求。若所选模型不能稳定满足结构化输出、取消和预算，重新评估而非放宽验证或上下文。

#### 15.2 S6-Q02：环境变量名与凭据配置入口

| 选项 | 内容 | 影响 | 风险 | 可逆性 |
|---|---|---|---|---|
| A（已批准） | 环境变量使用 `MYTRACER_<PROVIDER>_API_KEY`；Main-only 读取。打包首次配置由用户在外部设置一次环境变量，Renderer 只发送“导入并持久化”无密钥意图，Main 读取后 safeStorage 加密并原子保存配置 | 严格满足 Renderer/Preload 不接触明文 key；复用已批准 safeStorage | 首次配置 UX 较技术化；环境继承/清除说明必须准确，Main 不得记录值 | 未来可换成更友好 Main-owned入口；旧密文可继续读取或显式迁移 |
| B | Renderer 专用 password input，经固定单向 IPC 立即交 Main 加密，永不回读 | 日常体验最直接 | Renderer/Preload 短暂接触明文，违背本文严格隔离解释；DevTools/内存/错误处理面扩大 | 可移除 UI，但已存在的用户预期和安全说明需调整 |
| C | 独立 Main/helper 或 OS credential manager 配置工具 | Renderer 完全不接触 key，UX 可优化 | 新进程/工具/依赖、打包和权限面扩大，不属于当前批准架构 | helper 移除和配置迁移成本高 |
| D | 只支持每次运行环境变量，不持久化 safeStorage | 实现最小 | 打包日常使用差，未完成 ED-010 的批准打包配置路径 | 易升级，但不能作为完整 T062 |

**批准结论**：采用 A。T062 合同必须在 Provider 确定后把 `<PROVIDER>` 展开为确切名称，并固定环境覆盖/密文优先级、导入成功后提示和删除凭据流程。不得在日志或 evidence 中显示变量值。

#### 15.3 S6-Q03：总文本预算

| 选项 | 内容 | 影响 | 风险 | 可逆性 |
|---|---|---|---|---|
| A | 4,000 Unicode code points | 最小泄露面和成本 | 较长中英文上下文更易截断，建议相关性可能下降 | 纯配置可提高，manifest 算法兼容 |
| B（已批准） | 8,000 Unicode code points | 可容纳 Goal/Action/最多 5 Record 的有限文本，同时保持明确上限 | 仍需 Provider token 二次校验；长字段可能截断 | 纯配置可调，既有核心数据不变 |
| C | 12,000 Unicode code points | 截断较少 | 数据暴露和付费成本更高，可能超过小模型经济窗口 | 可下调，但用户可能感知建议变化 |

**批准结论**：总文本预算为 8,000 Unicode code points。该值只约束文本内容，Provider adapter 仍必须检查实际请求 token/byte 上限；不得以模型窗口更大为由突破批准预算。

#### 15.4 S6-Q04：超时和重试

| 选项 | 内容 | 影响 | 风险 | 可逆性 |
|---|---|---|---|---|
| A（已批准） | Main deadline 20 秒；无自动重试；失败后保留本次输入，由用户明确点击 retry | 每次付费调用都由用户触发，状态清晰 | 短时网络抖动需要多一次点击 | timeout 配置易调，核心数据无迁移 |
| B | 10 秒；无自动重试 | 快速降级 | 慢响应更常失败，可能降低可用性 | 易调 |
| C | 20～30 秒；对 network/5xx 自动重试一次 | 抖动下成功率可能更高 | 重复付费、取消/幂等/迟到响应更复杂，违反“一次明确触发对应一次请求”的直觉 | 可关闭，但证据和成本预期需更新 |

**批准结论**：Main deadline 为 20 秒且不自动重试。authentication、quota、invalid response 不得自动重试；任何 retry 都由用户明确触发、重新读取当前上下文并生成新 generation。

#### 15.5 S6-Q05：真实 Provider 契约测试

| 选项 | 内容 | 影响 | 风险 | 可逆性 |
|---|---|---|---|---|
| A（已批准） | 建立独立、显式、非默认 `test:ai-contract`；只在人工授权环境运行，不进入 `verify`/普通 CI|required check | 可发现真实 API/模型/SDK 漂移，同时保持核心测试离线 | 需要专用 key、费用、网络和脱敏证据纪律 | 可暂停/替换，不影响 fake suite |
| B | 不建自动 live contract，只做项目所有者手工 smoke | 最小工程面 | 漂移发现晚、结果可重复性弱 | 以后可增加 |
| C | 完全不测试真实 Provider | 无 key/费用 | 生产适配器行为没有真实证据，T062/S6 不能完整声称通过 | 易增加，但当前 gate 保持 pending |
| D | 把 live contract 加入普通 CI | 持续反馈 | key 暴露、付费、外部不稳定导致核心 gate 阻塞，违反现行测试策略 | 移除容易，但历史 CI 和 secret 风险不可忽略 |

**批准结论**：采用独立、显式、非默认的 live contract 路径，不进入 `verify`、普通 CI 或 required check。实际建立或运行仍须 T062 精确合同、专用 credential 和网络授权；测试必须使用合成文本、固定低调用量、无真实用户数据，并只记录脱敏 metadata，失败不允许被改写为核心测试成功。



### 原文片段 5

发现以下情况时停止受影响设计/合同/实现并报告

### 原阶段完整验证停止条件

- 无法证明未触发零调用、确认前零写入、AI 失败核心可用或同一最终 revision 的连续 AC-02；

### 原阶段证据停止条件

- 无法保留 failed/partial/skipped/platform-limited/superseded evidence。

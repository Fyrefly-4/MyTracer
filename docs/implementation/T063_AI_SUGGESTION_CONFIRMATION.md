# T063 AI 建议接受、修改、拒绝和确认命令任务合同

> 任务类型：implementation / S6 E6-03
>
> 合同状态：**approved / done；T063 task delivery candidate `fee398e08ef687bd75d9dae10e6254f09e7c9896` 已通过本地完整验证、Windows package/security、完整 diff/独立 review、PR #48 implementation-candidate required CI 和项目所有者批准的文档收口。人工 AC-02、final-head CI、Ready、merge、main、tag、release、S6 final gate 和 S7 仍独立受控。**
>
> 草案日期：2026-09-01
>
> 授权草案基线：`dev@233d6790c6c5e11bb454b22eb027443eef54a01e`
>
> 前置集成：T061 task delivery `5f98b2f61026721f22fe6cd627c3b402678e9a93` / dev integration `4630878dacd0a15dbe8446cb26d9cea790d3ed6e`；T062 task delivery `bc5461e3bcc4e0ca94abbffe9ef2f898c7bbc4a9` / final head `a458171be3504492a5c581b595f272c1e1e0e097` / dev integration `233d6790c6c5e11bb454b22eb027443eef54a01e`

## 1. 任务信息

- **Task ID**：T063
- **Title**：AI 建议接受、修改、拒绝和确认命令
- **Slice / Plan item**：S6 / E6-03
- **Status**：`done`（人工 AC-02 仍为 `pending`；PR final-head CI 与集成状态见 GitHub）
- **Base branch**：`dev`
- **Authorized draft base**：`dev@233d6790c6c5e11bb454b22eb027443eef54a01e`
- **Expected branch**：`task/T063-ai-suggestion-confirmation`
- **Current branch fact**：`task/T063-ai-suggestion-confirmation` 已从授权 `dev@233d6790...` 创建并发布为 Draft PR #48；implementation candidate 为 `fee398e08ef687bd75d9dae10e6254f09e7c9896`。

## 2. 目标结果

用户在 Today 的一个 pending Action 上主动请求 Start Help 后，可以查看和编辑临时建议，接受原建议、修改后确认、拒绝、关闭、取消或主动重试。只有用户对一个 Action 建议作出明确确认时，Main 才调用普通 `CreateAndSetGoalCurrentNextAction` Application Command，原子创建同 Goal 的新 pending Action 并把它设为 current next；只有用户对某个 Understanding 候选逐项编辑、选择本次合法目标并明确确认时，Main 才调用普通 `AddConfirmedUnderstandingToActionRecord` Application Command，向既有 ActionRecord 写入一条来源固定为 `ai_candidate_confirmed` 的 Understanding。

所有 Provider 请求、响应、session、manifest、draft、编辑历史、错误正文和未确认候选继续只驻留内存。查看、编辑但不确认、reject、close、cancel、timeout、not-configured、disabled、invalid response、Provider/credential/network 失败、stale precondition、非法 target、迟到响应以及任意失败事务都不得产生核心写入。原 Action、TodaySelection、ActionRecord/history、Recovery/ReviewResult 和既有 Understanding/Confusion 保持守恒。

本任务完成 S6 的 T063 交付和自动化 AC-02 输入，但不自动通过 S6 final gate；项目所有者人工 AC-02、stage aggregate、Ready、merge、`dev -> main`、tag、release 和 S7 仍需后续独立决定。

## 3. 需求依据

- **FR**：FR-AI05、FR-AI06、FR-C02、FR-C03；FR-AI01、FR-AI08、FR-AI09、FR-AI10 作为已集成边界继续保持。
- **AC**：AC-02；AC-01、AC-03、AC-04、AC-05、AC-06、AC-07 为受影响回归。
- **D**：D-014、D-109；并保持 D-004、D-012、D-013、D-015、D-104、D-108。
- **ED/GW**：ED-004、ED-005、ED-011、ED-014、ED-019；GW-001、GW-002、GW-004、GW-008、GW-009、GW-010。
- **直接相关架构章节**：`S6_AI_START_HELP_DESIGN_V0.1.md` §3～§4、§7～§14、§16～§17；`AI_BOUNDARY_V0.1.md`；`ARCHITECTURE_V0.1.md`；`TEST_STRATEGY_V0.1.md` §4.6、§5～§8；`IMPLEMENTATION_PLAN_V0.1.md` E6-03；`REQUIREMENTS_TRACEABILITY_V0.1.md` 的 FR-AI05/06、FR-C02/03、D-014/109、AC-02 映射。
- **直接前置合同**：已集成的 `T061_AI_MINIMAL_CONTEXT.md` 和 `T062_AI_PROVIDER_DEGRADATION.md`。

### 3.1 References

```yaml
references:
  requirements:
    - file: docs/PRODUCT_REQUIREMENTS_V0.1.md
      sections: [FR-AI05, FR-AI06, FR-C02, FR-C03, AC-02]
  decisions:
    - file: docs/DECISIONS.md
      sections: [D-014, D-109]
    - file: docs/REQUIREMENTS_CHANGE_POLICY.md
      sections: [2, 4, 8]
  engineering_decisions:
    - file: docs/architecture/ENGINEERING_DECISIONS_V0.1.md
      sections: [ED-004, ED-005, ED-011, ED-014, ED-019]
    - file: docs/implementation/GITHUB_WORKFLOW_V0.1.md
      sections: [GW-001, GW-002, GW-004, GW-008, GW-009, GW-010]
  stage_design:
    - file: docs/architecture/S6_AI_START_HELP_DESIGN_V0.1.md
      sections: [3, 4, 7-14, 16, 17.3, 17.4]
  architecture:
    - docs/architecture/AI_BOUNDARY_V0.1.md
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
  prerequisite_contracts:
    - docs/implementation/T061_AI_MINIMAL_CONTEXT.md
    - docs/implementation/T062_AI_PROVIDER_DEGRADATION.md
```

## 4. 开始条件、依赖与稳定接口核对

- [x] S6 整体设计及 S6-Q01～Q05 已获项目所有者批准；设计不替代本合同激活。
- [x] T061 task delivery、final head、dev integration、final-head CI 和 post-merge CI 可追踪；`EV-T061-001` 为 `pass`。
- [x] T061 的 `StartHelpRequestDto` 字段、8,000 code-point 预算、最多 5 条 Record、Main-only manifest、eligible Understanding target IDs、显式触发和隔离边界已稳定；T063 不扩大 Provider-facing DTO 或上下文读取范围。
- [x] T062 task delivery `bc5461e3...`、final head `a458171...`、final-head run `33381804748`、dev integration `233d6790...` 和 post-merge run `33382653020` 已核对并补记；`EV-T062-001` 为 `pass`。
- [x] T062 的单用途 Provider Port、strict response validator、fake、20 秒 Main deadline、无自动 retry、sender/generation/session、封闭错误分类、configuration/safeStorage、IPC/Preload 和降级接口已稳定。
- [x] 最新 `dev@233d6790...` 中 schema version 仍为 3、export version 仍为 2；`understandings.source` 已支持 `manual | ai_candidate_confirmed`，无需 migration 或 export version 变化。
- [x] 最新 `dev` 的普通 `CreateAndSetGoalCurrentNextAction` 已在一个 UnitOfWork transaction 中创建 pending Action 并更新 Goal current next，但尚缺 T063 要求的 expected current-next/Goal revision stale precondition。
- [x] 最新 `dev` 的 ActionRecord/Understanding 外键、Progress、Recovery、Review 和 export v2 已读取未撤销 Understanding；普通 `AddConfirmedUnderstandingToActionRecord` 尚不存在，ActionRecord detail 仍只展示 manual source，均由本任务窄补齐。
- [x] 当前代码无需新增依赖、网络域、Provider/context/credential 权限、schema 或 migration。
- [x] 项目所有者批准本合同、允许范围、验证矩阵和第 12 节实施/Git/GitHub 权限，并明确激活 T063。
- [x] 激活、实现候选验证和首次发布前均确认本地与远端最新授权 `dev` 为合同基线 `233d6790c6c5e11bb454b22eb027443eef54a01e`。

未完成最后两项前，只允许合同草案、sidecar 和项目所有者已授权的 T062 集成证据补记；不得修改实现、测试、任务状态或长期验收证据，不得提交、push 或创建 PR。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T062]
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: [T061, T062]
  revisions:
    required_dev_base: dev@233d6790c6c5e11bb454b22eb027443eef54a01e
    required_t061_task_delivery: 5f98b2f61026721f22fe6cd627c3b402678e9a93
    required_t061_dev_integration: 4630878dacd0a15dbe8446cb26d9cea790d3ed6e
    required_t062_task_delivery: bc5461e3bcc4e0ca94abbffe9ef2f898c7bbc4a9
    required_t062_final_head: a458171be3504492a5c581b595f272c1e1e0e097
    required_t062_dev_integration: 233d6790c6c5e11bb454b22eb027443eef54a01e
  shared_surfaces:
    - ai-start-help-contracts-session-and-main-only-manifest
    - main-composition-ipc-preload-and-today-renderer
    - goal-current-next-command-and-unit-of-work
    - action-record-understanding-target-source-and-export
    - fake-provider-continuous-ac02-and-package-security-harness
  external: []
```

冲突依据：T063 必须消费 T061/T062 已集成的 request DTO、manifest、Provider draft、session、error、IPC/Preload、Today UI 和 fake harness，不能与改变这些共享面的 T061/T062 分支并行，也不能重新打开 Provider/context/credential 设计。

### 4.2 Machine-readable metadata sidecar

本任务使用 `docs/implementation/metadata/T063.json`。sidecar 只描述依赖、shared surfaces 和当前无 Profile 事实，不批准任务、不计算权限、不改变 `TASK_INDEX` 状态。合同草案和每次激活/恢复前运行：

```powershell
npm.cmd run governance:metadata:check
```

### 4.3 Automation Profile

本合同不声明 Automation Profile。若项目所有者后续希望使用 `standard-task@1`，必须在合同和 sidecar 中加入完全一致、有效期内的 execution 声明，重新校验并单独批准；Profile 不能授权 AI Provider/context/credential 权限变化、docs closeout、Ready、merge、tag 或 release。

## 5. 精确允许修改范围

以下实现和测试范围仅在项目所有者批准并激活本合同后生效。

### 5.1 普通核心 Commands 与领域边界

- `src/application/goals.ts`：兼容扩展普通 `CreateAndSetGoalCurrentNextAction`，接受可信的 `expectedCurrentNextActionId`（含明确 `null`）和 `expectedGoalUpdatedAt` 前置条件；在同一 UnitOfWork transaction 内读取 Goal、执行 stale 检查、创建 pending Action、调用现有 Goal invariant 并保存 Goal。不得拆成 Renderer 两次命令。
- `src/contracts/goals.ts`、`src/main/goals-ipc.ts`：仅在保持现有手工调用向后兼容所需时增加可选 stale precondition DTO/runtime validation 和封闭错误映射；AI confirm 不得让 Renderer 提交 goalId 或任意 current-next target。
- `src/domain/action-record.ts`：新增创建已确认 AI Understanding 的纯领域构造器；`source` 在函数内部固定为 `ai_candidate_confirmed`，不接受外部 source 参数。
- `src/application/action-records.ts`：新增普通 `AddConfirmedUnderstandingToActionRecord` Command。业务载荷只含解析后的 ActionRecord ID 和最终文本；可信 `expectedGoalId` 只能作为命令 precondition envelope。命令在单事务重新读取 ActionRecord、Action 和 Goal，验证目标仍存在、仍属于 expected Goal、Goal 仍可接受该确认，再插入一条 Understanding；不创建或修改 ActionRecord。
- `src/application/ports/persistence.ts`：仅允许为上述 ordinary Command 提取由现有 `findActionRecordById`、`findActionById`、`findGoalById`、`saveUnderstanding` 组成的窄 capability/guard；禁止完整 snapshot、通用查询或 AI 专用写 Port。
- `src/infrastructure/sqlite/sqlite-repository.ts`：默认应保持不变；只有窄 capability 编译证明缺少既有方法的直接实现时才允许补齐同语义方法。不得修改 SQL schema、migration、表、列、索引、trigger、外键或导出查询。
- `src/contracts/records.ts`：只把 ActionRecord detail 的 Understanding source 扩展为现有持久化枚举 `manual | ai_candidate_confirmed`，保证确认事实可正常查看；不新增 AI 草稿或会话字段。

### 5.2 Main-only confirmation orchestration 与 session

- `src/main/ai-start-help-context.ts`：保留 T061 `StartHelpRequestDto` 和 `AiContextManifest`，只构造 T063 Main-only session envelope：从同一次窄 snapshot 捕获 actual Goal revision/current-next precondition，并为 manifest 中 eligible ActionRecord 生成本地 target facts。不得增加 Provider 字段、第二个跨 Goal 查询或向 Renderer 暴露数据库 ID/manifest。
- `src/main/ai-start-help-session.ts`：扩展 sender-bound 内存状态机、不可预测 session token、candidate 子状态、opaque target ref map、confirming/confirmed guard、reject 和两个 confirm 编排器。session 只依赖 ordinary Command callbacks，不持有 RepositoryPort、UnitOfWorkPort、SQLite 或 Provider 写能力。
- `src/contracts/ai-start-help.ts`：增加 `rejected`/`confirmed` 状态、Renderer-safe Understanding target summary、候选确认状态、固定 reject/confirm channels 和精确输入 DTO；不得包含 goalId、actionRecordId、manifest、Provider/SDK 类型、credential、URL、model override、raw prompt/response 或任意 channel。
- `src/main/ai-start-help-ipc.ts`：注册 reject、confirm suggestion、confirm Understanding 和带 session token 的 cancel/retry/close；每个 handler 先校验 trusted sender，再严格检查参数数量、键、token/candidate/target ref、文本长度和结构，映射为封闭中性结果。
- `src/main/index.ts`：把现有 GoalService/ActionRecordService ordinary Commands 作为窄 callbacks 注入 session store；保持 Provider、configuration、credential 和 SQLite 仅在 Main，不增加启动时/后台调用。
- `src/preload/index.ts`：只暴露固定 `aiStartHelp.reject/confirmSuggestion/confirmUnderstanding` 及带 token 的 session 方法；不暴露 `ipcRenderer`、Repository、Command 对象、Provider、manifest、持久化 ID 或 arbitrary channel。

### 5.3 Renderer

- `src/renderer/src/features/today/AiStartHelpPanel.tsx`：实现 DraftReady/Failed/Cancelled/Confirmed/Rejected/Closed UI；1～3 条建议选择与编辑；接受原文或最终编辑文本；reject/close/retry；Understanding 候选逐项编辑、选择 opaque target summary、确认和失败重试；准确显示“临时候选”“未保存”“已保存”“上下文已变化”。
- `src/renderer/src/features/today/TodayPage.tsx`：仅在确认成功后刷新普通 Goal/Action/Today Query 所需的最小 callback；不得自动选入 Today、自动完成原 Action或在 effect/mount 中 start/retry/confirm。
- `src/renderer/src/styles.css`：仅增加上述确认、候选、错误和 saved 状态样式，不改变导航、核心状态或统计表达。
- `src/renderer/src/env.d.ts`：仅当 `MyTracerApi` 类型扩展需要编译同步时允许无行为修改。

### 5.4 精确测试范围

- `tests/unit/goal-application.test.ts`：stale current-next/revision、active Goal、原子成功和 failure rollback。
- `tests/unit/action-record-domain.test.ts`、`tests/unit/action-record-application.test.ts`：固定 source、文本验证、existing Record/same Goal、单项事务、失败零写入和 detail source。
- `tests/unit/ai-start-help-session.test.ts`：完整状态机、session/sender/generation ownership、candidate/target guard、双击并发、reject/close/cancel/retry/late response、ordinary Command failure。
- `tests/unit/process-governance.test.ts`：Provider/Renderer/Preload 无 Repository/SQLite/credential/arbitrary channel，schema/export/dependency 未变化，AI 临时数据不持久化。
- `tests/integration/goal-sqlite.test.ts`、`tests/integration/goal-ipc.test.ts`：ordinary current-next stale precondition、同事务 create+set 和 IPC backward compatibility。
- `tests/integration/action-record-sqlite.test.ts`：ordinary confirmed Understanding 的 FK、same Goal、source、reopen 和单事务 rollback。
- `tests/integration/ai-start-help-ipc.test.ts`：新增固定 channels、sender-first、session/candidate/target/text validation、sealed errors 和跨 sender 拒绝。
- `tests/integration/ai-start-help-confirmation-sqlite.test.ts`（新增）：从 validated draft/manifest 到两个 ordinary Commands 的真实 SQLite 编排；确认前 snapshot、reject/close/stale/非法 target/失败 rollback、双击 guard、原 Action/Today/history 守恒。
- `tests/integration/ai-data-capability.test.ts`、`tests/integration/complete-export-sqlite.test.ts`、`tests/integration/system-export-adapter.test.ts`：AI unavailable 核心可用；确认事实进入 export v2；draft/session/manifest/input/response/credential/diagnostics 排除。
- `tests/integration/progress-sqlite.test.ts`、`tests/integration/recovery-sqlite.test.ts`、`tests/integration/review-sqlite.test.ts`：只在确认后自然读取新 current next/Understanding，公式、历史和事实语义不变。
- `tests/support/fake-ai-provider.ts`、`tests/support/ai-start-help-context-fixture.ts`：只扩展 T063 deterministic candidate/Understanding/late/failure 脚本和 existing-target fixtures；不访问网络、真实 key 或真实用户正文。
- `tests/e2e/ai-start-help-ac02.e2e.test.ts`（新增）：第 10.5 节 continuous E2E-AC-02；同一临时 DB、同一 revision、不重置核心状态。
- `tests/e2e/ai-start-help-degradation.e2e.test.ts`、`tests/e2e/ai-data-capability.e2e.test.ts`、`tests/e2e/action-today.e2e.test.ts`、`tests/e2e/action-record.e2e.test.ts`、`tests/e2e/progress-core-loop.e2e.test.ts`、`tests/e2e/recovery-review-aggregate.e2e.test.ts`、`tests/e2e/complete-export.e2e.test.ts`、`tests/e2e/shell.e2e.test.ts`、`tests/e2e/windows-package-smoke.e2e.test.ts`：仅增加 T063 受影响回归、固定 Preload allowlist 或 package surface 断言，不重写既有 AC 语义。

### 5.5 合同和后续条件性收口文件

- 当前已授权：`docs/implementation/T063_AI_SUGGESTION_CONFIRMATION.md`、`docs/implementation/metadata/T063.json`，以及项目所有者明确授权的 T062 集成补记：`T062_AI_PROVIDER_DEGRADATION.md`、`TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md`。
- 激活时：`TASK_INDEX_V0.1.md` 只能在项目所有者明确批准并激活本合同时把 T063 从 `pending` 改为 `active`。
- owner-approved docs closeout 时：T063 合同、Task Index、Evidence ledger、Draft PR body；README、S6 design、traceability 或其他文档只有 impact matrix 证明存在 durable fact 且逐文件获批时才修改。
- PRD、DECISIONS、REQUIREMENTS_CHANGE_POLICY、AGENTS、模板和 workflow 不在本任务范围；没有批准的产品或流程语义变化。

## 6. 明确非范围

- 不改变 FR-AI01～AI10、FR-C02/C03、AC-02、D-014/D-109 或已批准 S6 设计语义。
- 不扩大 T061 Provider-facing request DTO、8,000 code-point 预算、最多 5 条 Record、相关性或上下文读取范围；不发送任何持久化 ID、target ref 或 manifest 给 Provider。
- 不改变 T062 Provider/model/SDK/package/version、Gateway origin、环境变量、configuration/safeStorage、response limits、18 秒 SDK timeout、20 秒 Main deadline、无自动 retry 或 live contract 策略。
- 不新增或升级依赖，不修改 `package.json`、lockfile、Electron/Vite/TypeScript/CI 配置。
- 不新增 migration、表、列、索引、trigger、AI cache、session/draft table；schema 保持 v3，export 保持 v2。
- 不保存 AI input、prompt、request/response、draft、candidate、manifest、session、retry/edit history、Provider request ID、错误正文、credential 或配置密文。
- 不让 Provider、Renderer 或 Preload 获得 Repository、UnitOfWork、SQLite、文件系统、credential getter、任意网络、Application Command 对象或 arbitrary IPC。
- 不自动创建 TodaySelection，不改变原 Action status/title/description，不完成、取消、重排或删除原 Action，不修改既有 Record/history。
- 不在没有合法 existing ActionRecord 时创建 Understanding，不创建 0 分钟/partial/stopped 等伪造 Record，不移动既有 Understanding。
- 不批量确认 Understanding，不根据 Provider 文本、时间、次数或对话自动选择 target、确认掌握度或推断失败。
- 不建立 Chat、跨会话 memory、对话恢复、接受率统计、模型评分、RAG、embedding、tool calling、Agent、自动计划、提醒、通知、S7 或延期功能。
- 不调用真实 Provider、不读取真实 credential、不访问真实 `userData`；正常测试、CI、package smoke 只用 fake 和临时根。
- 不自动通过 S6 final gate，不自动开始 S7，不授权 Ready、merge、main、tag 或 release。

## 7. 必须保持的不变量

- AI start/retry 仍只由用户明确操作触发；mount、effect、status/query/navigation、Action switch、reopen 和后台均为零 Provider 调用。
- 只有 confirm suggestion 和 confirm Understanding 两条编排路径可调用普通写 Command；Provider 永远不能调用、选择或构造 Command。
- 确认前、未确认、reject、close、cancel、timeout、invalid response、disabled/not-configured、credential/network/provider/internal failure、stale、非法 target 和 command failure 的 complete core snapshot 前后严格相等。
- Action 确认调用普通 `CreateAndSetGoalCurrentNextAction`；stale 检查、pending Action 创建、Goal current-next 更新在同一事务，全有或全无。
- Action 确认只保存用户最终确认文本；Provider 原文、edit history 和未选 suggestion 不保存。原 Action、TodaySelection、ActionRecord/history、Understanding/Confusion、Recovery 和 ReviewResult 不变。
- Understanding 确认调用普通 `AddConfirmedUnderstandingToActionRecord`；target 必须来自本次 manifest eligible 集合，opaque ref 只在 sender-bound session 中解析，目标确认时仍存在且属于本次 Goal。
- Understanding `source` 固定为 `ai_candidate_confirmed`；Renderer、Provider、IPC 输入均没有 source 字段。
- 多个 Understanding 逐项确认，每项独立事务和独立结果；一项失败不回滚已成功的其他项，也不自动确认剩余项。
- 同一 candidate 的 confirming/confirmed guard 阻止双击、并发 IPC 和迟到重复写入；核心事务成功后即为事实，UI response 丢失时以重开 Query 为准，不重复创建。
- 无 eligible ActionRecord 时可展示候选和中性说明，但不得提供可执行 target 或落库。
- session token 不可预测、sender-bound、generation-bound；另一个 sender、旧 generation、关闭/拒绝后的 token 无法读取或确认。
- retry 每次重新读取当前最小上下文并创建新 requestId/generation；不携带旧对话或旧响应。close/navigation/window destroy/configuration disable/app quit 清除 session。
- Progress、Recovery、Review 只读取正常核心事实，不统计建议、调用、接受率或 AI 成功率；AI source 不表示掌握度。
- export v2 包含确认后的正常 Action/Understanding，排除 credential、draft、session、manifest、prompt/response 和技术日志。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 继续分离；LocalDate、跨午夜、删除和历史规则不变。
- 自动测试使用 FakeClock、fake Provider、每 case 唯一临时 SQLite/userData；不得访问真实用户数据、真实 key 或 live Gateway。

- **引用不变量**：AGENTS §7～§10；S6 design §4、§7～§10、§13、§16；FR-AI05/06、FR-C02/03；D-014/109；ED-004/005/011/014/019。
- **本任务局部风险**：把 Action 创建与 current-next 更新拆开、stale 检查在事务外、Renderer 提交 goal/record/source、manifest/ID 泄漏、target 在确认前被删除或跨 Goal、双击重复写入、session 成功与 SQLite 双写不一致、Action 确认提前丢弃 Understanding、ActionRecord detail 过滤 AI source、确认事实未进入 reopen/export、临时 AI 数据被持久化或打包泄漏。

## 8. 固定实现语义

### 8.1 Renderer/Main session 状态机

主状态固定为：

```text
idle
  -> building-context user start/retry
  -> requesting       context valid
  -> draft-ready      validated success
  -> failed           local/provider/validation failure
  -> cancelled        explicit cancel
  -> rejected         explicit reject
  -> confirmed        Action suggestion confirmed
```

`building-context` 是 Main 重新读取当前 Goal/Action/Record snapshot 并生成新 request ID 的显式内存状态；本地上下文失败直接进入 `failed`，不得调用 Provider。`retry` 必须从当前核心数据重新进入该状态，不能复用旧 manifest、draft、response 或 target map。

`draft-ready` 内每个 Understanding candidate 的子状态固定为 `unconfirmed | editing | confirming | confirmed | failed`。确认 Understanding 后 session 仍为 `draft-ready`；接受 Action 后进入 `confirmed`，未确认 Understanding 被丢弃，UI 在存在未处理候选时必须先给出明确提示。reject 和 close 均清除未确认内容；reject 是用户明确拒绝结果，close 是退出流程，两者都零核心写入。

### 8.2 Main-only session envelope

```text
StartHelpSession
  sessionId                  unpredictable, sender-bound
  senderId
  generation
  state
  requestId
  goalId                     Main-only
  actionId                   Main-only
  expectedGoalUpdatedAt      from actual selected snapshot
  expectedCurrentNextActionId from actual selected snapshot, including null
  manifest                   Main-only
  validatedDraft?
  targetRefMap               opaque ref -> eligible existing ActionRecord fact
  candidateStates
  abortController?
```

Renderer 只获得 session token、state、draft、candidate status 和 `{targetRef, actionTitle, occurredOn}` 摘要；不得获得 goalId、actionId、record ID、manifest 或 Provider 原始正文。Main-only precondition 必须来自 T061 窄 snapshot 的实际值，不能信任 Renderer 回传。

### 8.3 Action suggestion confirmation

1. 校验 trusted sender、session token、generation、`draft-ready`、candidate 和未处于 confirming/confirmed。
2. 规范化最终文本，拒绝空白、超长、额外字段和不可结构化值。
3. 以 session 中 actual `goalId`、`expectedCurrentNextActionId`、`expectedGoalUpdatedAt` 调用普通 `CreateAndSetGoalCurrentNextAction`。
4. ordinary Command 在同一事务重新读取 Goal，验证 Goal active、current-next 和 updatedAt 均匹配；任一不匹配返回 `stale-context` 且零写入。
5. 同事务创建一个关联该 Goal 的 pending Action并设为 current next；失败注入时 transaction 回滚。
6. 成功后 session 进入 `confirmed`，返回普通 Action/Goal DTO；不创建 TodaySelection，不改变原 Action或历史。

### 8.4 Understanding confirmation

1. Main 只为 manifest `eligibleUnderstandingTargetRecordIds` 生成 opaque target refs 和本地摘要；Provider 不接触 ref 或 ID。
2. 用户逐项编辑最终文本、选择 target ref 并明确确认；Renderer 不提交 goalId、recordId 或 source。
3. session 校验 sender/session/generation/candidate/target ref 和重复确认 guard，解析出 Main-only ActionRecord ID 与 expected Goal。
4. 调用普通 `AddConfirmedUnderstandingToActionRecord`；source 在领域/Application 内固定为 `ai_candidate_confirmed`。
5. ordinary Command 在单事务重新读取 ActionRecord、Action、Goal，验证记录仍存在、Action 仍属于 expected Goal、Goal 关系仍合法，然后插入一条 Understanding；不修改 ActionRecord 的 occurredOn/duration/outcome/nextStep/note/timestamps。
6. 成功后只把该 candidate 标为 confirmed；其他 candidate 保持原状态。每项独立事务。

### 8.5 零写入分支

以下全部不得调用普通写 Command，且以 SQLite/core snapshot 比较证明零写入：查看、编辑未确认、reject、close、cancel、timeout 后不 retry、retry 请求本身、disabled、not-configured、credential unavailable、invalid response、auth/quota/rate-limit/network/provider/internal failure、旧 generation late response、非法 session/candidate/target/text。stale 或 ordinary Command failure可以进入 Command，但事务必须在任何持久化改变前失败或完整回滚。

## 9. 交付物与验收标准

### 9.1 交付物

- [ ] 完整 session/candidate 状态机和 sender/generation/token ownership。
- [ ] 接受、修改、拒绝、关闭、取消和重试 Renderer 流程。
- [ ] ordinary `CreateAndSetGoalCurrentNextAction` stale precondition 与原子事务。
- [ ] ordinary `AddConfirmedUnderstandingToActionRecord`、fixed source、same-Goal existing target 和逐项事务。
- [ ] 窄 IPC/Preload、strict runtime validation、sealed neutral result。
- [ ] 确认前零写入、原 Action/Today/history 守恒、AI 临时数据不持久化。
- [ ] unit、SQLite integration、IPC、continuous E2E-AC-02、reopen/export、affected AC regression。
- [ ] Windows package/security、`verify`、完整 diff 和独立 review。
- [ ] 项目所有者人工 AC-02 程序保持 pending，直到实际执行。
- [ ] owner-approved docs closeout、final-head CI 和 merge handoff；不自动进入 S6 final gate 或 S7。

### 9.2 可判定验收标准

1. 接受原建议和修改后确认均只产生一个新 pending Action；只保存最终确认文本，新 Action 关联当前 Goal并原子成为 current next。
2. Action confirm 的 current-next/Goal revision stale 检查与 create+set 位于同一 SQLite transaction；stale、任意保存失败或 failure injection 后 Action/Goal 均不变。
3. Action confirm 不改变原 Action status/details、TodaySelection、Record、Understanding、Confusion、Recovery 或 ReviewResult，不自动加入 Today。
4. Understanding candidate 只有在本次 session、manifest eligible target、same Goal existing ActionRecord 上逐项确认才落库；无 target、跨 sender、旧 generation、伪造 ref、删除 target 或跨 Goal 均失败且无额外写入。
5. 每个成功 Understanding 的 source 恰为 `ai_candidate_confirmed`；Renderer/Provider/IPC 无 source 选择能力。多个候选每项独立事务，未确认和失败项不落库。
6. 查看、编辑、reject、close、cancel、timeout、invalid response、disabled/not-configured、Provider/credential/network failure、retry 请求和 late response 全部核心 snapshot 相等。
7. 同一 candidate 双击或并发 confirm 最多产生一次核心事实；成功后 response 丢失和应用重开不导致自动重复创建。
8. 关闭/拒绝/导航/窗口销毁/app quit 后 session、draft、manifest、target refs、未确认 candidate 消失；应用重开只保留确认后的普通核心事实。
9. export v2 包含确认后的 Action 和 Understanding，并继续排除 credential、configuration secret、AI input/prompt/request/response/draft/manifest/session/edit/retry history 和 diagnostics 正文。
10. Progress/Recovery/Review 自然读取确认事实，但事实公式、unknown/Routine 五语义、LocalDate、历史、删除和统计表达无变化；AI 文本不表示掌握度。
11. fixed IPC channels、sender-first、strict keys/token/text validation、narrow Preload、Renderer no Node/SDK/network/credential/IDs 和 package bundle scan 全部通过。
12. continuous E2E-AC-02、AC-01/03/04/05/06/07 affected regression、`npm.cmd run verify`、Windows package/smoke、安全/reopen/export 均绑定同一 Implementation Candidate 或按合同明确区分 revision。
13. 完整 `dev...candidate` diff 和独立 review 无未处理 material finding；无 dependency、migration、Provider/context/credential 权限、schema/export version 或延期范围变化。
14. **MANUAL**：项目所有者按第 10.6 节执行并签署 AC-02；在签署前保持 `pending`，自动化和 Agent 不代签。

## 10. 验证计划

### 10.1 合同与治理 Gate

```powershell
npm.cmd run governance:metadata:check
git diff --check
npm.cmd run format:check
```

### 10.2 针对性 Unit

```powershell
npm.cmd run test:unit -- tests/unit/goal-application.test.ts tests/unit/action-record-domain.test.ts tests/unit/action-record-application.test.ts tests/unit/ai-start-help-session.test.ts tests/unit/process-governance.test.ts
```

必须覆盖 stale precondition、transaction order、fixed source、target/sender/generation/candidate guard、双击并发、状态机和所有未确认分支的 command call count = 0。

### 10.3 SQLite、IPC、export 与衍生查询

```powershell
npm.cmd run test:integration -- tests/integration/goal-sqlite.test.ts tests/integration/goal-ipc.test.ts tests/integration/action-record-sqlite.test.ts tests/integration/ai-start-help-ipc.test.ts tests/integration/ai-start-help-confirmation-sqlite.test.ts tests/integration/ai-data-capability.test.ts tests/integration/progress-sqlite.test.ts tests/integration/recovery-sqlite.test.ts tests/integration/review-sqlite.test.ts tests/integration/complete-export-sqlite.test.ts tests/integration/system-export-adapter.test.ts
```

所有 SQLite case 使用唯一临时数据库。零写入不能只靠 spy，必须比较完整 core snapshot；原子性使用可控 failure-injection UnitOfWork/SQLite transaction 证明。

### 10.4 E2E、package 与 security

```powershell
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/ai-start-help-ac02.e2e.test.ts tests/e2e/ai-start-help-degradation.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/action-record.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/recovery-review-aggregate.e2e.test.ts tests/e2e/complete-export.e2e.test.ts
npm.cmd run package
npm.cmd run test:package-smoke
```

额外检查：unpacked/隔离 NSIS 临时 userData 启动；Preload surface allowlist；Renderer bundle 不含 SDK/Gateway origin/credential env/safeStorage/SQLite/manifest/persistent target IDs；export/log/evidence 不含 AI 临时正文；package 不新增依赖、domain 或 install script。

### 10.5 Continuous E2E-AC-02

同一个隔离数据库、同一个 Electron session、同一最终 source revision，不重置核心状态：

1. 创建“系统学习 React”Goal、current next、额外 pending Action、多个 ActionRecord、manual Understanding/open Confusion；创建第二 Goal、Routine、ReviewResult 和禁止唯一标记。
2. 把一个 pending Action 选入 Today并打开；未点击 AI 前执行 status/Today/query/navigation，Provider call count 为 0。
3. 主动触发，fake 捕获请求；只含 T061 允许 context，禁止标记和 persistent IDs 不存在。
4. fake 返回 1～3 条温和建议和 Understanding candidates；触发前后 complete core snapshot 相等。
5. 编辑建议但不确认后 close；snapshot 相等，重开无 draft/session。
6. 再次触发并 reject；snapshot 相等。
7. 再次触发，修改建议后 confirm；只保存最终文本，新 pending Action 原子成为 current next，原 Action/Today/history 不变。
8. 新 session 中逐项确认一个 Understanding、修改后确认第二个、保留/拒绝第三个；只有两条进入所选 existing ActionRecord，source 为 `ai_candidate_confirmed`。
9. 分别模拟 Goal current-next/updatedAt stale、target Record 删除、跨 sender、伪造 target ref、双击和 ordinary Command failure；无部分或重复写入。
10. 模拟 timeout、cancel、close、invalid response、disabled/not-configured、auth/network/provider/internal failure；每次 snapshot 相等，手工 CRUD/Progress/Recovery/Review/export 继续。
11. timeout 后主动 retry并释放旧 late response；只显示新 generation draft，旧响应无写入。
12. 完全关闭重开；确认 Action/Understanding 存在，未确认 AI 状态不存在；export v2 只含确认核心事实且不含 credential/draft/session/prompt/response/manifest。

### 10.6 项目所有者人工 AC-02

在隔离 Windows 数据根和 fake 或另行批准的 Provider 环境中：

1. 打开一个真实可理解的 Today Action，确认 AI 不主动出现或调用。
2. 主动点击“我现在不想开始”，输入一句当前阻力。
3. 判断回应是否使用必要上下文、具体、温和、足够小，不羞辱、不制造焦虑、不把合理休息写成拖延。
4. 分别体验 reject、close、cancel、timeout 和 retry，确认可立即回到手工路径且未保存数据。
5. 接受一条原建议，再用另一 session 修改建议后确认；检查只保存最终文本，新 Action 是 pending/current next，原 Action 和 Today 未暗中改变。
6. 对 Understanding candidates 逐项编辑、选 target、确认和保留未确认项；确认 UI 表达“候选”而不是“已经掌握”。
7. 在无 eligible ActionRecord、target 已删除和 Goal/current-next stale 情况下确认，检查系统不虚构 Record/Understanding且明确显示未保存。
8. 关闭 AI 或移除隔离配置，重复核心管理、Progress、Recovery、Review 和 export。
9. 完全关闭重开，确认只有用户确认的 Action/Understanding 保留，AI session/draft 不恢复。

人工结果只允许 `pass | fail | partial | pending` 并附观察；项目所有者未实际执行前固定为 `pending`。

### 10.7 受影响范围与 aggregate

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
```

`verify` 必须保持离线、read-only，不运行 live Provider、package、migration 写真实用户数据或修改 tracked source。AC-01/03/04/05/06/07 由完整 suite 和第 10.4 节定向 E2E共同证明；不能以测试名替代结果。

### 10.8 Deterministic evidence capture

```powershell
node tools/evidence/capture-command.mjs --task T063 --gate task-candidate --base-revision 233d6790c6c5e11bb454b22eb027443eef54a01e --output .tmp/evidence -- npm.cmd run verify
```

artifact 只能位于 ignored `.tmp/evidence/`，记录真实 source/base/head/test-merge revision、原始 argv、exit code 和固定环境元数据；禁止 stdout/stderr、用户输入、AI request/response、candidate 文本、credential、环境变量、绝对用户路径或数据库内容。

### 10.9 独立 review

1. 审查完整 `dev...Implementation Candidate` diff，不只审最后 commit。
2. 核对两个 ordinary Commands、事务边界、stale/target precondition、fixed source、double-confirm guard 和失败回滚。
3. 核对 T061 request/manifest 不扩大，T062 Provider/session/error/credential 边界不退化，Renderer/Preload 无 IDs/Repository/SDK/network/key。
4. 核对原 Action/Today/history、Progress/Recovery/Review/export v2、schema v3、LocalDate 和 Routine 五语义守恒。
5. 核对依赖/lockfile/migration/Provider/context/credential 权限无变化，所有 material finding 修复后重跑 affected validation 并复核。

### 10.10 验证环境

- OS：Windows 11 x64；hosted CI 使用仓库批准 Windows runner。
- Node：`24.18.0`；npm：`11.16.0`；Electron：`43.3.0`；SQLite：`better-sqlite3@13.0.1`。
- 数据根：每 case 唯一临时 SQLite/Electron `userData`；人工使用明确隔离数据根。
- AI：普通自动化只用 fake；不读取真实 key，不运行 `test:ai-contract`。
- Source revision：Implementation Candidate、final head、dev integration 和 stage aggregate 分别记录，不混用。

## 11. Git、GitHub、任务状态、证据和文档收口权限

### 11.1 合同草案阶段已执行权限

- [x] 允许从 `dev@233d6790...` 创建本地 `task/T063-ai-suggestion-confirmation`；已执行。
- [x] 允许在该分支修正项目所有者已人工复核的 T062 final-head/dev integration/post-merge 文档遗漏。
- [x] 允许创建或修改 T063 合同和必需 metadata sidecar。
- [ ] 不允许修改代码、配置、依赖或测试实现。
- [ ] 不允许改变 T063 `pending` 状态或写入 T063 验收证据。
- [ ] 不允许创建 commit、push、Draft PR 或其他 GitHub 写入。

```yaml
current_draft_permissions:
  base_revision: dev@233d6790c6c5e11bb454b22eb027443eef54a01e
  local_write:
    t062_integration_evidence_correction: true
    t063_contract_and_required_metadata: true
    implementation_or_test: false
  create_task_branch: true
  create_commit: false
  push_task_branch: false
  create_or_update_draft_pr: false
  external_write: false
```

### 11.2 项目所有者已批准并激活的实施权限

- [x] 允许在现有任务分支修改第 5 节精确列明的代码和测试。
- [x] 允许创建有意义的本地实现提交。
- [x] 允许 push `task/T063-ai-suggestion-confirmation`。
- [x] 允许创建/更新到 `dev` 的单一 Draft PR并触发 Actions。
- [ ] 不允许 Agent 标记 Ready。
- [ ] 不允许 Agent 合并到 `dev`。
- [ ] 不允许 Agent 创建/合并 `dev -> main`、tag 或 release。

```yaml
active_permissions:
  local_write: true
  create_worktree: false
  create_task_branch: false
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
  ai_provider_or_permission_change: false
  external_write:
    allowed: true
    scope: task-branch-push-and-single-draft-pr-to-dev
```

项目所有者于 2026-09-01 明确批准并激活上述权限。按本次额外指令，任务分支 push 和 Draft PR 创建成功后立即暂停，不由 Agent 主动查询 CI；后续 CI 解释、docs closeout、Ready、merge、main、tag、release 始终等待新指令。

## 12. 依赖与外部操作权限

- 新增/升级依赖：无；禁止修改 package/lockfile。
- 网络访问：产品现有已批准 Start Help runtime profile保持不变；Agent、自动化、CI 和 package smoke 不调用真实 Provider。本任务不运行 live contract。
- AI Provider：复用已集成 T062 fake/production adapter；不得更改 provider/model/domain/timeout/retry/response limits。
- AI context：复用 T061 DTO/query/manifest eligibility；不得读取更多字段、Goal、Record 或完整 snapshot。
- credential/configuration：复用 T062 Main-only接口；不得扩大环境变量、safeStorage、Renderer/Preload 或 export/log 权限。
- 外部写入：草案阶段无；合同激活后的请求范围仅为同一任务分支 push、单一 Draft PR 和 Actions。
- 数据破坏性操作：无。
- migration/schema/export version：无且禁止。

## 13. Integration Freshness

```yaml
integration:
  target_branch: dev
  base_revision: dev@233d6790c6c5e11bb454b22eb027443eef54a01e
  prerequisite_t061_task_delivery_revision: 5f98b2f61026721f22fe6cd627c3b402678e9a93
  prerequisite_t061_dev_integration_revision: 4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  prerequisite_t062_task_delivery_revision: bc5461e3bcc4e0ca94abbffe9ef2f898c7bbc4a9
  prerequisite_t062_final_head_revision: a458171be3504492a5c581b595f272c1e1e0e097
  prerequisite_t062_dev_integration_revision: 233d6790c6c5e11bb454b22eb027443eef54a01e
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: fee398e08ef687bd75d9dae10e6254f09e7c9896
  dev_integration_revision: null
  stage_final_integration_revision: null
```

```yaml
integration_freshness:
  original_base_revision: 233d6790c6c5e11bb454b22eb027443eef54a01e
  latest_authorized_dev_revision: 233d6790c6c5e11bb454b22eb027443eef54a01e
  verified_against_revision: 233d6790c6c5e11bb454b22eb027443eef54a01e
  status: fresh
  refresh_method: not-needed
  scope: implementation-candidate-and-docs-closeout
```

合同激活、首次实现修改、Implementation Candidate、发布和 merge handoff 前均重新核对最新授权 `dev`。若 `dev` 前进，先只读审计 T061/T062、current-next、Understanding、Progress/Recovery/Review/export、schema 和共享面；更新 exact base 后重新交项目所有者确认。已发布任务分支只能 ordinary merge 最新 `dev`，不得 rebase/force-push 改写历史。

## 14. 风险与停止条件

出现以下任一情况时停止受影响工作，保存已完成安全事实并按 `ESCALATION_PROPOSAL_TEMPLATE.md` 报告：

- 合同未批准/激活，或最新 `dev` 不再等于已批准基线且未完成 refresh Gate。
- 需要改变 AI 触发、上下文、确认、Understanding target/source、Today、历史、统计、日期、删除或 export 语义。
- 无法在同一事务完成 Action stale check + create + set current next，或无法在单项事务验证 target + insert Understanding。
- ordinary Command 需要接收 Renderer/Provider 可选 source、goalId、recordId，或 confirm orchestrator 需要 Repository/SQLite。
- 需要新增依赖、migration、schema/export version、AI/session/draft persistence、Provider/context/credential 权限或网络域。
- 需要自动 TodaySelection、原 Action 状态变化、虚假 Record、批量确认、长期 memory、Agent/工具或延期功能。
- 无法确定性证明确认前零写入、失败回滚、双击至多一次、原 Action/Today/history 守恒或 reopen/export 隔离。
- 自动测试必须使用真实用户数据库、真实 key 或 live Provider。
- 无法把 task delivery/final head/dev integration/stage final revision、CI 和 artifact绑定到真实结果。

## 15. 完成与报告要求

T063 只有在以下全部成立时才可报告任务交付完成候选：可观察行为满足第 2/9 节；targeted/affected/`verify`/package/security 通过；完整 diff 和独立 review 无未解决 material finding；无依赖/migration/权限/范围漂移；证据绑定 exact Implementation Candidate；manual AC-02 如未执行仍明确 `pending`。

最终 handoff 必须报告：

- 修改文件与可观察结果；
- FR-AI05/06、FR-C02/03、AC-02、D-014/109、ED/GW 覆盖；
- 两个 ordinary Commands、stale/target/transaction/source/zero-write 证据；
- exact targeted、SQLite、IPC、continuous E2E、affected AC、package/security、reopen/export、`verify` 命令、环境、结果和 artifacts；
- complete diff/独立 review findings；
- branch、commits、PR、candidate/final-head/post-merge CI、head/test-merge/integration revision；
- 自动化与项目所有者人工 AC-02 状态；
- residual risks、skipped/unverified、是否发现 requirement/scope/permission change；
- 明确 S6 final gate、Ready、merge、main、tag、release 和 S7仍由项目所有者决定。

## 16. 激活 Gate

项目所有者已于 2026-09-01 明确完成以下批准：

1. 批准本合同的目标、允许文件、排除、不变量、固定实现语义、验证矩阵和人工 AC-02 程序；
2. 批准第 11.2 节所请求的 local implementation、commit、push 和单一 Draft PR权限，或明确缩窄；
3. 授权把 `TASK_INDEX_V0.1.md` 中 T063 从 `pending` 改为 `active`；
4. 确认无 dependency、migration、Provider/context/credential 权限变化；
5. 明确该批准不包含真实 Provider 调用、Ready、merge、main、tag、release、S6 final gate 或 S7。

上述批准已激活 T063。实施必须严格受本合同约束；任务分支 push 和 Draft PR 创建成功后立即停止并等待项目所有者下一步命令，不主动查询 CI。

## 17. 交付收口

- **Implementation Candidate / task delivery revision**：`fee398e08ef687bd75d9dae10e6254f09e7c9896`，基于 `dev@233d6790c6c5e11bb454b22eb027443eef54a01e`，Integration Freshness 为 `fresh`。
- **本地自动验证**：最终 `verify` 在该 revision 上通过 format、lint、typecheck、Unit 244/244、Integration 128/128（另 1 个 live-only contract 按批准策略 skip）和 Electron E2E 22/22（package smoke 在 aggregate 中按配置 skip）；Windows x64 package、unpacked 与隔离 NSIS smoke 另行通过。
- **审查**：完整 `dev...task` diff、`git diff --check`、依赖/migration/security 边界检查和独立只读 review 无未解决 material finding。
- **Implementation-candidate hosted CI**：[PR #48 run `33470990276`](https://github.com/Fyrefly-4/MyTracer/actions/runs/33470990276) 为 `success`；PR head `fee398e08ef687bd75d9dae10e6254f09e7c9896`、test-merge `21f8f362bbf9d654d534496406c70438b76166f9`。Artifact `verification-evidence-33470990276-1`（id `9786610728`）为 aggregate exit 0、capture complete。
- **Owner closeout**：项目所有者于 2026-09-01 确认云端 CI 通过，批准 T063 文档收口和最后一次任务分支 push。
- **人工与集成状态**：项目所有者人工 AC-02 固定为 `pending`，不因自动化或 owner closeout 被代签；docs closeout 后 exact final-head CI 是 PR 集成门禁。`dev_integration_revision=null`、`stage_final_integration_revision=null`；Ready、merge、S6 final gate、main、tag、release 和 S7 均未授权或未发生。

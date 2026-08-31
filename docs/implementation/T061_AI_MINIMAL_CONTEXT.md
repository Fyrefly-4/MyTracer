# T061 AI 最小上下文选择器和隔离证明任务合同

> 任务类型：implementation / S6 E6-01
>
> 合同状态：**review；Implementation Candidate、本地与 candidate hosted 自动验证、独立 review、Integration Freshness 和项目所有者人工测试/文档收口均已通过；closeout final-head run `33354175786` 因既有 Review migration 单例超出默认 5 秒失败，项目所有者已授权最小修复并推送。**
>
> 草案日期：2026-08-31
>
> 绑定基线：`dev@1342cd7d8819ad269791c1834fcbd0c7596b0959`
>
> 设计门：上述基线中的 `S6_AI_START_HELP_DESIGN_V0.1.md` 文件仍保留提案文字，但项目所有者已在 T061 启动指令中明确批准完整设计和推荐方案。本合同记录该任务级批准事实；不据此扩大 T062/T063 权限。

## 1. 任务信息

- **Task ID**：T061
- **Title**：AI 最小上下文选择器和隔离证明
- **Slice / Plan item**：S6 / E6-01
- **Status**：`review`
- **Base branch**：`dev`
- **Authorized draft base**：`dev@1342cd7d8819ad269791c1834fcbd0c7596b0959`
- **Expected branch**：`task/T061-ai-minimal-context`

## 2. 目标结果

在用户明确触发启动帮助后，Main/Application 边界只从窄 Query 读取当前 Goal、打开的 Action、可选 current next、同 Goal 直接相关的近期 ActionRecord facts 和本次输入，并生成满足允许字段、稳定排序、最多 5 条 Record、注入字符预算和确定性截断规则的最小 Provider-facing request DTO。

选择结果同时生成只留在 Main/Application 内存中的 manifest，用于证明每个发送字段的来源、排除原因、字符计数和合法 Understanding target。应用启动、普通查询、打开 Today、切换 Action、未触发、关闭未开始流程，以及无 Goal、Action 缺失或 stale、状态/关联非法、输入非法、mandatory context 超预算等本地失败路径，均不得调用 Provider；fake request capture 的调用次数必须为 0。

本任务只交付最小上下文和隔离证明，不交付真实 Provider、用户可见 AI 流程或任何确认写入能力。

## 3. 需求依据

- **FR**：FR-AI01、FR-AI03、FR-AI08、FR-AI10。
- **AC**：AC-02 的“主动触发、必要历史上下文、未经确认原数据不变”前置子集；本任务不声明 AC-02 完成。
- **D**：D-012、D-014、D-015、D-108；其中本任务的直接索引为 D-108。
- **ED/GW**：ED-004、ED-011、ED-015、ED-019；GW-001、GW-002、GW-004、GW-008～GW-010。
- **直接相关架构章节**：`S6_AI_START_HELP_DESIGN_V0.1.md` §0～§5、§8.1/8.4/8.5、§10、§11、§12.1、§13.1/13.4/13.6、§14～§17；`AI_BOUNDARY_V0.1.md`；`ARCHITECTURE_V0.1.md` 的 Main/Application/Preload/Renderer 边界；`TEST_STRATEGY_V0.1.md` §4.6、§5～§6；`IMPLEMENTATION_PLAN_V0.1.md` §9 E6-01；`REQUIREMENTS_TRACEABILITY_V0.1.md` 的 FR-AI01/03/08/10、D-108 映射。

项目所有者于 2026-08-31 批准完整 S6 设计并选择推荐方案：S6-Q01 A、S6-Q02 A、S6-Q03 B（8,000 Unicode code points）、S6-Q04 A（Main deadline 20 秒、无自动重试）、S6-Q05 A（独立显式 opt-in live contract，不进入普通 `verify`/CI）。Q01 的确切 vendor/model/package/version 和 Q02 展开的环境变量名仍按设计留给 T062 独立合同固定；T061 不得据此选择 Provider、依赖、网络或 credential。若后续批准内容改变本文字段、排序、预算、边界、任务图或 Gate，必须先修订并重新批准合同。

### 3.1 References

```yaml
references:
  requirements:
    - file: docs/PRODUCT_REQUIREMENTS_V0.1.md
      sections: [9.8, 12/AC-02]
  decisions:
    - file: docs/DECISIONS.md
      sections: [2/D-012..D-015, 3/D-108]
    - file: docs/REQUIREMENTS_CHANGE_POLICY.md
      sections: [2, 4, 8]
  engineering_decisions:
    - file: docs/architecture/ENGINEERING_DECISIONS_V0.1.md
      sections: [ED-004, ED-011, ED-015, ED-019]
    - file: docs/implementation/GITHUB_WORKFLOW_V0.1.md
      sections: [GW-001, GW-002, GW-004, GW-008, GW-009, GW-010]
  stage_design:
    - file: docs/architecture/S6_AI_START_HELP_DESIGN_V0.1.md
      sections: [0-5, 8.1, 8.4, 8.5, 10-17]
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/AI_BOUNDARY_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
```

## 4. 开始条件、依赖与 shared surface

- [x] 项目所有者已于 2026-08-31 明确批准完整 S6 设计及推荐的 S6-Q01～Q05；批准记录位于本任务启动指令和本合同。
- [x] 项目所有者已于 2026-08-31 明确批准并激活本合同；`TASK_INDEX_V0.1.md` 在同一获批动作中更新为 `active`。
- [x] S1 已集成，T014 为 `done`，证据为 `EV-T014-001`；阶段聚合证据为 `EV-G3-S1-001`。
- [x] S3 已集成，T033 为 `done`，证据为 `EV-T033-001`；阶段聚合证据为 `EV-G3-S3-001`。
- [x] 激活前已 fetch 并重新读取最新授权 `dev@1342cd7d8819ad269791c1834fcbd0c7596b0959`，确认 S1/S3 Goal、Action、Today、ActionRecord、Understanding、Confusion、SQLite、export v2 和 Electron 边界未发生未设计漂移。
- [x] 激活时本地 `dev` 与 `origin/dev` 均为 `1342cd7d8819ad269791c1834fcbd0c7596b0959`。
- [x] 不新增或升级依赖，不新增 migration，不需要网络、真实 Provider、真实 key 或外部数据。
- [x] 项目所有者已批准第 11 节限定的分支、提交、push 和 Draft PR 权限。
- [x] 仓库稳定验证命令和 V2 evidence capture 已存在。

```yaml
dependencies:
  tasks:
    requires: [T014, T033]
    blocks: [T062]
    can_parallel: []
    prefer_after: [T806]
    conflicts_with: [T062, T063]
  stages:
    requires: [S1, S3]
    approval_gates: [S6_DESIGN_AND_Q01_Q05_APPROVAL]
  revisions:
    required_dev_base: dev@1342cd7d8819ad269791c1834fcbd0c7596b0959
    activation_rule: latest-authorized-dev-at-activation
  shared_surfaces:
    - application start-help context selection and persistence query port
    - Provider-facing StartHelpRequestDto contract
    - SQLite Goal/Action/ActionRecord fact query
    - Main-only SelectedStartHelpContext manifest
    - fake AI request capture and unique-marker fixtures
  external: []
```

`T806` 对应 S6 设计中的 `prefer_after: S4_S5_FINAL_GATE`，不是 T061 的硬依赖。T061、T062、T063 在 contracts、persistence、Main 和 fake provider 表面存在串行冲突；本任务不得与 T062/T063 并行实施或预先猜测其接口。

### 4.1 Automation Profile

本草案不声明 Automation Profile。若项目所有者希望使用 `standard-task@1`，必须先在合同与 sidecar 中加入完全一致的 `task_kind`、`activated_at`、`valid_until` 和 `additional_constraints`，运行 metadata 校验，再单独批准并激活；Profile 不得替代 S6 设计批准、合同批准或 Repository Safety Gates。

## 5. 精确允许修改范围

只有在项目所有者批准并激活本合同后，才允许创建或修改下列实现文件：

- `src/application/ai-start-help-context.ts`（新建）：`ReadStartHelpContext` 的应用编排、纯 `AiContextSelector`、注入式 `ContextBudget`、确定性文本规范化/Unicode code point 计数、选择结果与本地错误；不得持有 Repository、Provider、配置或网络实现。
- `src/application/ports/ai-start-help.ts`（新建）：Provider-facing `StartHelpRequestDto` 及最小 request capture 所需的只读端口类型；不得定义真实 Provider adapter、credential、timeout、重试、response DTO 或写命令。
- `src/application/ports/persistence.ts`：只增加 `StartHelpContextQueryPort`、窄 snapshot/fact 类型及运行时 capability guard；不得让选择器接收 `CorePersistenceSnapshot`、`CompleteCorePersistenceSnapshot` 或完整 `RepositoryPort`。
- `src/infrastructure/sqlite/sqlite-repository.ts`：实现单个窄、只读 start-help context query；不得修改 schema、migration、数据或现有完整 snapshot/export 查询语义。
- `src/main/ai-start-help-context.ts`（新建）：明确触发的 Main-only request preparation、manifest 生命周期边界和对 fake request sink 的单次调用门；不得注册生产 IPC、装配真实 Provider、创建持久 session 或执行核心写命令。
- `src/main/index.ts`：仅在隔离证明必须装配一个默认零调用、无网络、无 Renderer 暴露的 Main-only边界时允许最小修改；若测试可在独立 composition fixture 证明，保持本文件不变。不得在 startup、navigation、query 或 effect 中调用 request sink。

允许创建或修改下列测试文件：

- `tests/unit/ai-start-help-context.test.ts`（新建）：字段、关系、稳定排序、最多 5 条、预算、截断、manifest 和本地错误矩阵。
- `tests/integration/ai-start-help-context-sqlite.test.ts`（新建）：窄 SQLite query、只读性、同 Goal 关联、revoked/resolved 排除和无 full snapshot 依赖。
- `tests/integration/ai-start-help-context-isolation.test.ts`（新建）：明确触发、非法 context 零调用、最终 fake request capture 与 manifest/marker 对照。
- `tests/support/ai-start-help-context-fixture.ts`（新建）：合成唯一标记 fixture；不得包含真实用户正文、key、路径或环境值。
- `tests/support/fake-ai-provider.ts`：仅扩展 clone-safe request capture/call-count 能力，不改变既有 failure script 语义，不加入网络。
- `tests/unit/fake-ai-provider.test.ts`：仅覆盖上述 capture 扩展和既有行为回归。
- `tests/integration/ai-data-capability.test.ts`：仅在 T061 接口影响现有 disabled/not-configured/failure 零调用证明时增加回归断言，不扩大为 T062 降级实现。
- `tests/unit/process-governance.test.ts`：仅当需要以静态扫描证明 T061 未引入 Renderer/Preload/网络/credential/migration/import 越界时允许增加窄断言。
- `tests/integration/review-migration.test.ts`：仅按项目所有者 2026-08-31 的 final-head CI 修复授权，为 `maps every legal legacy field losslessly and persists after reopen` 单例增加 `30_000` ms timeout；不得修改 fixture、断言、migration、全局测试配置或产品代码。

合同与后续 owner-approved closeout 候选文件：

- `docs/implementation/T061_AI_MINIMAL_CONTEXT.md`
- `docs/implementation/metadata/T061.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- 同一 T061 Draft PR 正文

阶段一当前授权仅覆盖前两项合同文件；其余实现、测试、状态、证据和文档文件均不得在项目所有者批准并激活合同前修改。

### 5.1 共享接口冻结边界

- `StartHelpContextQueryPort` 只接受 `actionId` 与明确本地日/版本校验所需输入，只返回指定 Goal、指定 Action、合法 current next、同 Goal ActionRecord candidates 及其未撤销 Understanding/open Confusion。它不提供通用查询、完整 Action 列表、Routine、RoutineRecord、ReviewResult、Progress/Recovery/Review/export snapshot、credential、configuration、diagnostics 或写方法。
- `StartHelpRequestDto` 只含 `requestId`、`locale`、`userInput`、`goal{name,description?}`、`action{title,description?}`、可选 `currentNextAction{title,description?}`、0～5 条 `recentRelevantRecords{occurredOn,outcome,durationMinutes,confirmedUnderstandings,openConfusions,nextStepCandidate?}`；不得含任何持久化 ID、note、createdAt/updatedAt、Today commitment、source、完整列表或 manifest。
- `ContextBudget` 是 T061 注入的纯配置值，只约束实际发送的文本 Unicode code points；S6-Q03 已批准 8,000 code points，但 selector 必须继续支持注入不同预算进行边界测试，不把 Provider token/window 写入 Domain。
- `SelectedStartHelpContext.manifest` 只在 Main/Application 内存中存在，包含 request/source IDs、selected/eligible record IDs、field entries、excluded counts、total text characters 和 budget；它不进入 Provider DTO、Renderer/Preload、SQLite、export、日志或跨重开状态。
- fake capture 只接收已最小化 DTO；它不得获得 Repository/config/diagnostics getter，也不得进行第二次读取扩张请求。

## 6. 明确非范围

- 不实现或调用真实 Provider，不选择 Provider/model/SDK，不增加 HTTP/fetch/network 域或任何付费调用。
- 不新增或升级依赖，不修改 `package.json`、lockfile、构建配置、CI、环境变量或 secret。
- 不读取、写入、导入、持久化或测试真实 credential；不修改 safeStorage/configuration/diagnostics 生产适配器。
- 不新增或修改 schema、migration、export version 或完整 export 行为。
- 不实现 T062：无生产 `AiStartHelpProvider` adapter、response validator、1～3 建议、timeout、cancel、retry、late response、错误分类、配置/凭据或失败 UI。
- 不实现 T063：无建议 UI、接受/修改/拒绝、session/draft store、确认编排、current-next 并发前置、Understanding 写入或任何核心 mutation。
- 不修改 `src/preload/**`、`src/renderer/**`、现有 IPC API 或 `window.myTracer`；不增加用户可见入口、文案或状态。
- 不把 request manifest 暴露为共享 Renderer DTO，不持久化 AI request/response/session/draft/call history。
- 不读取其他 Goal、Today 中其他 Action、Routine/RoutineRecord、ReviewResult、完整 Progress/Recovery/Review/export snapshot、credential/config/diagnostics/log、技术路径或环境变量正文。
- 不实现跨 Goal、语义搜索、RAG、embedding、长期记忆、画像、自动计划、主动监督、通知、tool calling、通用 Agent/router/plugin 或其他延期范围。
- 不虚构 Record、Understanding、Confusion 或用户行为，不重写历史，不推断掌握度。
- 不声明 Provider、UI、确认写入、AC-02、T062、T063、S6 final gate、G4、S7 或发布完成。

## 7. 必须保持的不变量

- 只有明确的 Main-internal trigger invocation 才可形成一次 fake request；startup、mount、navigation、query、状态读取、Action 切换和关闭未开始流程均为零调用。
- 任一本地校验失败均在 request sink 之前结束，Provider call count 为 0，SQLite 和所有核心数据不变。
- Query 只读，不补行、不更新 timestamp、不创建 session、不调用 Provider，不通过完整快照后过滤来伪装窄读取。
- `directly related ActionRecord` 必须由其 Action 当前仍以 `goalId` 关联本次 Goal；其他 Goal 或文本相似不构成相关。
- 排序固定为 `occurredOn DESC → createdAt DESC → id ASC`；排序后最多 5 条，预算不足从最旧候选开始整条排除，不以第 6 条补位。
- mandatory 优先级固定为本次输入、Goal name、打开 Action title；mandatory 不截断，超预算返回 `context-too-large` 和零调用。
- 可选优先级和截断顺序遵循 S6 设计 §5.5；文本先 trim/规范化换行，再按 Unicode code point 计数，不在 surrogate pair 中间截断，不生成替代摘要。
- 若打开 Action 已是 current next，DTO 不重复发送；只发送未撤销 Understanding、open Confusion 和历史中真实存在的 next step 文本。
- manifest 是 Main-only 临时内部事实，Provider、Preload、Renderer、日志、SQLite 和 export 均不可见；Diagnostics 若未来接入只能记录固定脱敏 metadata，本任务不接入。
- Provider-facing DTO 不含持久化 ID、credential、source ID、note、时间戳、完整列表、manifest 或禁止字段。
- Renderer 保持 UI-only，Preload 保持窄 API；Provider 永远不能获得 Repository、UnitOfWork、Command、SQLite、filesystem、credential 或任意工具。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 继续分离；RoutineRecord 完全不进入 T061 context。
- LocalDate 和历史记录不被修改；本任务零业务写入、零 migration、零 export 语义变化。
- 自动测试使用唯一临时 data root/SQLite 和合成 marker；不得访问真实 `userData`、真实正文、真实 key 或网络。

- **引用不变量**：AGENTS.md §7～§9；S6 设计 §4～§5、§10、§16；FR-AI01/03/08/10；D-012/014/015/108；ED-004/011/015/019。
- **本任务局部风险**：用完整 snapshot 后过滤、SQLite query 意外跨 Goal、稳定排序缺少 tie-breaker、UTF-16 截断破坏字符、optional 预算挤占 mandatory、manifest/ID 泄漏到 DTO、fake capture 持有可变引用、Main 装配产生隐式调用、为 T062/T063 预建未批准接口。

## 8. 交付物

- [x] 窄 `StartHelpContextQueryPort` 和 SQLite read-only query snapshot。
- [x] 纯 `AiContextSelector` 与注入式 `ContextBudget`。
- [x] 冻结字段集合的 Provider-facing `StartHelpRequestDto`。
- [x] Main-only `SelectedStartHelpContext` manifest；不跨边界、不持久化。
- [x] ActionRecord 直接相关性、稳定排序、最多 5 条、预算与 code-point 截断实现。
- [x] 明确 trigger/local-failure request gate，未触发或非法时 fake call count 为 0。
- [x] clone-safe fake request capture 和唯一标记 fixture。
- [x] unit、SQLite/query integration、Main/Application isolation 和现有 AI data capability 回归证据。
- [x] Implementation Candidate 的完整 diff 自查和独立只读 review，无未处理 material finding。
- [x] targeted tests、affected regression、`verify`、candidate hosted CI 和 Integration Freshness 证据；closeout push 后的 final-head CI 作为 PR 集成门继续执行。
- [x] 项目所有者批准后的最小文档收口、task delivery revision 和 merge handoff；不自动进入 T062。

## 9. 验收标准

1. 合法明确触发生成的 DTO 只含 §5.1 允许字段；持久化 ID、manifest、note、createdAt/updatedAt、Today commitment、source、其他 Goal/Routine/Review/export/config/credential/log 数据不存在。
2. 当前 Goal、打开 Action 和不同的合法 current next 映射正确；打开 Action 等于 current next 时不重复。
3. 只有当前 Goal 下 Action 的 ActionRecord 可入候选；revoked Understanding、resolved Confusion、RoutineRecord、其他 Goal 和无关数据被排除。
4. 候选按 `occurredOn DESC → createdAt DESC → id ASC` 确定性排序并最多取 5 条；预算排除从最旧已选候选开始，不用第 6 条补位。
5. 所有实际发送文本在 trim/换行规范化后按 Unicode code point 计数，`totalTextCharacters <= budget`；截断不破坏 surrogate pair，manifest 准确记录 original/sent/truncated/exclusion。
6. mandatory 文本不被截断；mandatory 超预算返回 `context-too-large`，request capture call count 为 0。
7. 无 Goal、Goal 非 active、Action missing/stale/非 pending/不属于当前本地 Today、关系或 current-next 非法、输入空白/超限等路径均本地失败、0 calls、0 core writes。
8. unique-marker fixture 证明允许 marker 只在预期 request path 出现一次，其他 Goal、RoutineRecord、credential/config、diagnostics/log 和 full snapshot marker 全部不存在。
9. request DTO 与 manifest 的 included request paths、record IDs、excluded counts、字符数和预算完全一致；manifest 不进入序列化 Provider request、Renderer、持久化、export 或日志。
10. SQLite query 与 selector 不调用 `readSnapshot()`/`readCompleteCoreSnapshot()`，不进行第二次 Repository/config/diagnostic 读取，不写数据库或更新时间戳。
11. application startup/status/Today/query/navigation/Action switch/no-click/close-before-start 的 T061 可达路径均保持 call count 0；本任务不新增用户可见 UI 或 IPC。
12. 指定 targeted tests、affected regression、`npm.cmd run verify`、完整 diff review、独立 review、candidate hosted CI 和 Integration Freshness 均有绑定 exact revision 的真实证据；closeout push 后的 final-head CI 必须继续绑定到 exact PR head，失败时撤销 `done` 结论。
13. 依赖、lockfile、migration、网络、credential、真实 Provider、Preload、Renderer 和 T062/T063 范围没有变化。
14. T061 仅可声明最小上下文/隔离子能力完成；AC-02、S6、人工体验和 Provider 可用性继续为 `pending`。

本任务没有可由 T061 单独完成的用户体验 `MANUAL` 验收。项目所有者人工 AC-02 属于 T063/S6 final gate，不得由 selector 测试代替。

## 10. 验证计划

### 针对性验证

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/ai-start-help-context.test.ts tests/unit/fake-ai-provider.test.ts tests/unit/process-governance.test.ts
npm.cmd run test:integration -- tests/integration/ai-start-help-context-sqlite.test.ts tests/integration/ai-start-help-context-isolation.test.ts tests/integration/ai-data-capability.test.ts
```

若 `tests/unit/process-governance.test.ts` 或 `tests/integration/ai-data-capability.test.ts` 最终无 T061 合同内修改，仍作为 affected regression 执行，但不得为了命令对称而制造无价值改动。

### 受影响范围回归

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e:run -- tests/e2e/ai-data-capability.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/action-record.e2e.test.ts tests/e2e/complete-export.e2e.test.ts
node tools/evidence/capture-command.mjs --task T061 --gate task-candidate --base-revision <actual-latest-authorized-dev-sha> --output .tmp/evidence -- npm.cmd run verify
git diff --check <actual-latest-authorized-dev-sha>...HEAD
```

`verify` 已包含 build、unit、integration 和 Electron E2E。T061 不要求 package/live Provider/manual AC-02；S6 aggregate 后续仍须执行其合同要求的 Windows package/security/credential/export/manual gate。

### 独立 review

1. 在 Implementation Candidate 上以最新授权 `dev` 为 base 检查完整 branch diff，不只检查最后一次提交。
2. 逐项审查字段 allowlist、窄 query、排序/预算/Unicode、manifest 边界、call-count gate、SQLite 只读性、marker completeness 和禁止范围。
3. 检查没有完整 snapshot 后过滤、第二次读取、可变 capture、Provider/SDK/network/config/credential/migration/Preload/Renderer/T062/T063 越界。
4. 所有 material finding 修复后重跑对应 targeted/affected validation；若变更 review surface，重新独立 review。

### Deterministic evidence capture

```powershell
node tools/evidence/capture-command.mjs --task T061 --gate task-candidate --base-revision <actual-latest-authorized-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

artifact 只能写入 ignored `.tmp/evidence/*.json`，保留真实 exit code 和原始 argv；不得记录 stdout/stderr、用户正文、marker 正文、Provider request、manifest source IDs、环境变量、key、路径或完整日志。失败 artifact 必须保留并由后续成功通过 `supersedes` 关联，不能改写为成功。

### 人工步骤

1. `MANUAL`：无 T061 独立产品体验判定；不打开真实 Provider、不输入真实数据、不签署 AC-02。
2. 项目所有者只需在 docs closeout Gate 审核合同达成事实、残余风险和 T062 入口是否仍被阻止；该审核不是 AC-02 人工体验。

### 验证环境

- OS：Windows
- Node：仓库锁定 `24.18.0`
- npm：仓库锁定 `11.16.0`
- Electron：仓库锁定 `43.3.0`
- 数据根：每个测试唯一临时目录/SQLite；不得访问真实 Electron `userData`
- AI：只使用离线 fake request capture；网络禁用，无 credential
- Source revision：Implementation Candidate 形成时填写

## 11. Git、GitHub、任务状态与文档收口权限

以下是本草案请求项目所有者在批准并激活本合同后授予的精确权限；在批准前全部无效。阶段一不创建分支、commit、push 或 PR。

- [x] 项目所有者已批准完整 S6 设计及推荐的 S6-Q01～Q05。
- [x] 项目所有者已批准并激活本合同。
- [x] 允许从激活时最新授权 `dev` 创建隔离 worktree 和 `task/T061-ai-minimal-context`。
- [x] 允许在精确允许范围内创建本地实现提交。
- [x] 允许推送唯一任务分支 `task/T061-ai-minimal-context`。
- [x] 允许创建/更新该分支到 `dev` 的唯一 Draft PR，并触发 GitHub Actions。
- [x] 允许项目所有者批准后的任务状态激活更新；已在本次激活动作中更新为 `active`。
- [ ] 不允许 Agent 将 Draft 标记为 Ready。
- [ ] 不允许 Agent 合并到 `dev`。
- [ ] 不允许 Agent 创建或合并 `dev -> main` PR。
- [ ] 不允许 Agent 创建 tag 或 release。

```yaml
permissions:
  effective_only_after_owner_contract_activation: true
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

`external_write: true` 仅请求授权推送上述单一任务分支、创建/更新其到 `dev` 的单一 Draft PR，以及读取/触发该 PR 的 Actions。它不授权 live Provider、其他网络写入、Issue、ruleset、secret、workflow、Ready、merge、main PR、tag、release、remote branch deletion 或 force push。

任务状态权限：

- 当前为 `review`；Implementation Candidate、独立 review、targeted/affected/verify、candidate CI、Integration Freshness、项目所有者人工测试和 owner-approved docs closeout 均已有真实证据，但 closeout final-head run `33354175786` 的既有 Review migration 单例超出默认 5 秒，required gate 失败。
- docs closeout commit 可以按现行 Repository Skill §10.4 写入 `done`；其 push 后的 documentation-updated final-head CI 是 PR 集成门。若该门失败且使完成证据失效，任务必须恢复为 `review` 并在授权范围内修复。
- `done` 不表示 Ready、merge、AC-02、S6、T062 或 T063 完成，也不自动授权下一任务。

文档收口权限：

- candidate hosted CI 首次针对 exact Implementation Candidate 通过后必须暂停，提交精确文档 impact matrix，等待项目所有者批准。
- 未经该次批准，不得修改 `TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md`、本合同完成状态、sidecar 完成事实或 Draft PR closeout 正文。
- 获批范围默认候选仅为本合同、T061 metadata、任务索引、验收证据和 Draft PR 正文；README、S6 设计、traceability、PRD、DECISIONS、AGENTS、模板、CI 或其他文档只有 impact matrix 证明受影响且项目所有者逐项批准时才能修改。
- docs closeout 使用独立 `docs: close T061 delivery records` commit 并推送同一任务分支；随后必须取得 exact final-head required CI。Ready 和 merge 仍由项目所有者另行决定。

## 12. 依赖、外部操作与 Integration Freshness

- 新增/升级依赖：无；禁止。
- 网络访问：实现和自动测试为无；合同激活后仅 Git/GitHub task branch、Draft PR 和 Actions 可按第 11 节授权使用。
- AI Provider：仅离线 fake request capture；禁止真实或付费 Provider。
- credential：无；禁止读取、创建、存储或传递真实 credential。
- 外部写入：仅获批 GitHub task branch/Draft PR；其他为无。
- 数据破坏性操作：无。
- migration/schema/export change：无；禁止。

```yaml
integration:
  target_branch: dev
  base_revision: dev@1342cd7d8819ad269791c1834fcbd0c7596b0959
  base_revalidation_at_activation: required
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: 5f98b2f61026721f22fe6cd627c3b402678e9a93
  dev_integration_revision: null
  stage_final_integration_revision: null
```

Implementation Candidate 必须记录：

```yaml
integration_freshness:
  original_base_revision: <actual-task-base-sha>
  latest_authorized_dev_revision: <actual-dev-sha-at-gate>
  verified_against_revision: <actual-verified-dev-sha>
  status: fresh | refreshed-and-passed | blocked
  refresh_method: not-needed | merge-dev-into-task-branch | blocked
```

实际记录：

```yaml
integration_freshness:
  original_base_revision: 1342cd7d8819ad269791c1834fcbd0c7596b0959
  latest_authorized_dev_revision: 1342cd7d8819ad269791c1834fcbd0c7596b0959
  verified_against_revision: 1342cd7d8819ad269791c1834fcbd0c7596b0959
  status: fresh
  refresh_method: not-needed
```

若任务 base 不再是最新授权 `dev`，只能用普通 traceable merge 刷新，不得 force-push/rebase 改写已发布历史；刷新后必须重跑 affected regression、candidate validation，并在 review surface 改变时重新独立 review。T061 只有 `fresh` 或 `refreshed-and-passed` 可进入 merge handoff；`task_delivery_revision`、`dev_integration_revision`、`stage_final_integration_revision` 不得混同，且 T061 完成不自动激活 T062。

## 13. 风险与停止条件

发现以下任一情况时停止受影响工作，保留安全事实，并按 `ESCALATION_PROPOSAL_TEMPLATE.md` 提交 proposal；不得静默扩大合同：

- 完整 S6 设计或 S6-Q01～Q05 未批准、批准内容与合同不一致，或批准记录不可追踪。
- 最新授权 `dev` 改变 Goal current-next、Today、ActionRecord/Understanding/Confusion、SQLite query、schema/export、Main/Preload/Renderer、安全或 fake provider shared surface，且合同尚未重新核对。
- 需要修改 FR-AI01/03/08/10、AC-02、D-108、ED-011 或 AI 的主动触发、上下文、确认/写入边界。
- 需要把 full snapshot/export、其他 Goal、RoutineRecord、ReviewResult、credential/config/log/diagnostics 或任意禁止字段交给 selector/provider request。
- 需要真实 Provider、SDK、依赖、网络、credential、环境变量、配置文件、timeout、retry、response validation 或 T062/T063 行为。
- 需要修改 schema、migration、export version，或产生任何核心业务写入。
- 无法证明未触发/非法 context 为零调用，或无法证明 query/selector 为零写入。
- 测试必须访问真实 userData、真实用户正文、真实 key、外部网络或 live Provider。
- 需要修改第 5 节未列文件、扩大 Git/GitHub/external-write 权限，或与用户/无关 worktree 变更发生不可安全隔离的重叠。
- metadata、evidence capture、targeted/affected/verify、hosted CI、完整 diff 或独立 review 无法产生可靠的 exact-revision 证据。

## 14. 完成报告要求

最终 T061 交付报告必须使用中文并包含：

- 所有新增/修改文件和可观察的最小上下文/隔离结果。
- FR-AI01/03/08/10、AC-02 子集、D-108、ED-011 及相关 D/ED/GW 覆盖。
- exact targeted、affected regression、`verify`、metadata、diff check 命令，Windows 环境、结果和脱敏 artifact。
- branch、commit、Draft PR、candidate/final-head CI、head/test-merge/base revision 和 Evidence ID。
- complete diff 自查和独立 review 结论及所有已处理 finding。
- Integration Freshness 的五个实际字段、task delivery revision；merge 后才填写 dev integration revision。
- 自动化状态，以及 AC-02/Provider/UI/人工体验明确仍为 `pending`。
- 残余风险、已知缺口、跳过/不可用项、是否发现需求冲突、设计漂移、scope 或 permission change。
- T062 仍需独立合同、Provider 工程决定和项目所有者激活；不得自动开始。

## 15. 草案审批 Gate

以下问题均已由项目所有者在 2026-08-31 的 T061 启动指令中明确回答，本合同已转为可执行状态：

1. 是否批准 `docs/architecture/S6_AI_START_HELP_DESIGN_V0.1.md` 的完整设计及 S6-Q01～Q05；若选择不同于推荐项，给出每项确切值。
2. 是否批准并激活本 T061 合同，包括第 5 节精确文件范围、第 11 节 Git/GitHub 权限和无 Profile 的显式执行模式。
3. 若批准时 `dev` 已前进，是否授权先做只读基线复核并把合同/metadata 的 exact base SHA 更新后再次确认，而不是直接实现。

上述 Gate 已完成。T061 task delivery revision 为 `5f98b2f61026721f22fe6cd627c3b402678e9a93`，项目所有者已报告人工测试通过并批准 docs closeout。closeout final-head run `33354175786` 因既有 Review migration 单例超出默认 5 秒失败；项目所有者随后明确授权查看 CI、实施最小修复并推送同一 PR。T062/T063、Ready、merge、tag 和 release 仍未授权；修复后的 exact final-head CI 仍由 PR 集成门验证。

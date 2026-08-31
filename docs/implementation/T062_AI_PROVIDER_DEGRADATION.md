# T062 可替换 Provider、超时和失败降级任务合同

> 任务类型：implementation / S6 E6-02
>
> 合同状态：**active；项目所有者已于 2026-08-31 批准精确 LiteLLM Gateway profile、模型、SDK、domain、credential/configuration、限制值和实施/Git/GitHub 权限，并在合同更新后明确指令执行 T062 开发。不授权真实 Gateway 调用、真实凭据访问、Ready、merge、tag 或 release。**
>
> 草案日期：2026-08-31
>
> 授权草案基线：`dev@4630878dacd0a15dbe8446cb26d9cea790d3ed6e`
>
> 前置集成：T061 task delivery `5f98b2f61026721f22fe6cd627c3b402678e9a93`；final head `d60978917546f6547a1615c6aa03e87d08c0d2ce`；`dev_integration_revision=4630878dacd0a15dbe8446cb26d9cea790d3ed6e`

## 1. 任务信息

- **Task ID**：T062
- **Title**：可替换 Provider、超时和失败降级
- **Slice / Plan item**：S6 / E6-02
- **Status**：`active`
- **Base branch**：`dev`
- **Authorized draft base**：`dev@4630878dacd0a15dbe8446cb26d9cea790d3ed6e`
- **Expected branch**：`task/T062-provider-degradation`
- **Current branch authorization**：项目所有者已授权从上述 `dev` 创建本地任务分支；分支已创建。2026-08-31 已批准 §12 的精确 Provider 工程值，并在合同更新后明确指令执行 T062 开发；实现、commit、push 和单一 Draft PR 权限已激活。Provider 调用和真实凭据访问仍禁止。

## 2. 目标结果

在项目所有者批准首个 Provider 的确切工程值并激活本合同后，Electron Main 通过单一、可替换且只服务 Start Help 的 `AiStartHelpProvider` Port 发送 T061 已冻结的最小 `StartHelpRequestDto`，把 Provider/SDK 返回值始终视为 `unknown`，经过 Main 运行时严格验证后才生成结构化、临时的 `StartHelpDraft`。

Main 管理 20 秒 deadline、`AbortController`、sender-bound generation 和只驻留内存的 session。AI 关闭、未配置、safeStorage/credential 不可用、主动取消、导航/窗口销毁、超时、网络/认证/配额/Provider 异常、响应非法或迟到时，Renderer 只获得封闭、中性的状态与错误码；既有 Goal、Action、Routine、Record、Progress、Recovery、Review、delete、export 和 restart 路径继续工作。

T062 只交付请求、验证、配置、会话生命周期、降级和最小只读建议呈现。它不交付接受/修改/拒绝后的核心写入，不保存 Understanding，不完成完整 AC-02，也不赋予 Provider、Renderer 或 Preload 任何核心数据写权限。

## 3. 需求依据

- **FR**：FR-AI02、FR-AI03、FR-AI04、FR-AI07、FR-AI09；FR-AI01/08/10 作为 T061 已集成不变量；FR-C03 只作 Provider 不得虚构掌握事实的边界。
- **AC**：AC-02 的 Provider/响应/失败降级前置子集；AC-01、AC-03、AC-04、AC-05、AC-06、AC-07 作为受影响回归，不由 T062 改变语义。
- **D**：D-012、D-013、D-015；D-014 作为确认前零核心写入不变量；D-108、D-109 作为最小上下文和内存 session 不变量。
- **ED/GW**：ED-004、ED-010、ED-011、ED-014、ED-019；GW-001、GW-002、GW-004、GW-008～GW-010。
- **直接相关架构章节**：`S6_AI_START_HELP_DESIGN_V0.1.md` §2.3、§3～§4、§6、§8～§13、§15～§17；`AI_BOUNDARY_V0.1.md`；`TEST_STRATEGY_V0.1.md` §3、§4.6、§5～§8；`IMPLEMENTATION_PLAN_V0.1.md` E6-02。
- **直接前置合同**：`T061_AI_MINIMAL_CONTEXT.md` 的 Provider-facing DTO、Main-only manifest、调用门和隔离不变量。

### 3.1 References

```yaml
references:
  requirements:
    - file: docs/PRODUCT_REQUIREMENTS_V0.1.md
      sections: [FR-AI02, FR-AI03, FR-AI04, FR-AI07, FR-AI09, AC-02]
  decisions:
    - file: docs/DECISIONS.md
      sections: [D-012, D-013, D-015]
  engineering_decisions:
    - file: docs/architecture/ENGINEERING_DECISIONS_V0.1.md
      sections: [ED-004, ED-010, ED-011, ED-014, ED-019]
  stage_design:
    - file: docs/architecture/S6_AI_START_HELP_DESIGN_V0.1.md
      sections: [2.3, 3, 4, 6, 8, 9, 10, 11, 12.2, 13, 15, 16, 17.2, 17.3]
  architecture:
    - docs/architecture/AI_BOUNDARY_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  prerequisite_contracts:
    - docs/implementation/T061_AI_MINIMAL_CONTEXT.md
```

## 4. 开始条件、依赖与 shared surface

- [x] 完整 S6 设计及方向性 S6-Q01 A、Q02 A、Q03 B、Q04 A、Q05 A 已于 2026-08-31 获项目所有者批准。
- [x] T061 已以 `dev_integration_revision=4630878dacd0a15dbe8446cb26d9cea790d3ed6e` 正式进入最新授权远端 `dev`；PR #46 final-head run `33355327790` 和 post-merge run `33355939824` 成功。
- [x] T061 的 `StartHelpRequestDto`、窄 Query、Main-only manifest、调用门、8,000 code-point 总文本预算和隔离证据可追踪。
- [x] 当前 schema version 为 3、export version 为 2；T062 不需要 migration 或 export version 变化。
- [x] 当前分支基于精确 `dev@4630878dacd0a15dbe8446cb26d9cea790d3ed6e` 创建。
- [x] S6-Q01 的确切 LiteLLM Gateway、`gemini-3.7-flash`、`openai@7.8.0` 和 adapter 路径已填写并获批。
- [x] S6-Q01 对应的唯一 HTTPS origin、Chat Completions、`json_schema` 和保守 vendor error mapping 已填写并获批。
- [x] S6-Q02 的 `MYTRACER_LITELLM_API_KEY`、`configuration/ai-provider.v1.json`、credential source 优先级和导入/删除流程已填写并获批。
- [x] Provider 响应字段/数组/总输出长度上限，以及 adapter request byte/output-token 上限已填写并获批。
- [x] 已激活的 `dependency_change`、唯一 production network、Main-only credential/configuration、local implementation、commit、push、单一 Draft PR 和只建立不运行 live contract 权限已逐项批准。
- [x] 项目所有者已明确批准并激活本合同；`TASK_INDEX_V0.1.md` 同步改为 `active`。

在所有未勾选项完成前，本合同不得进入 Task Gate、依赖安装、实现、配置或测试实现阶段。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T061]
    blocks: [T063]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T061, T063]
  revisions:
    required_dev_base: dev@4630878dacd0a15dbe8446cb26d9cea790d3ed6e
    required_t061_task_delivery: 5f98b2f61026721f22fe6cd627c3b402678e9a93
    required_t061_final_head: d60978917546f6547a1615c6aa03e87d08c0d2ce
    required_t061_dev_integration: 4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  shared_surfaces:
    - ai-start-help-contracts-and-provider-facing-dto
    - main-composition-session-and-ipc-security
    - ai-configuration-safe-storage-and-diagnostics
    - today-renderer-and-preload-api
    - fake-provider-and-ai-data-capability-harness
    - package-export-log-and-security-verification
  external:
    - approved-litellm-gateway-runtime-profile-effective-only-after-task-activation
    - real-gateway-and-real-credential-access-prohibited-for-agent-tests-ci-and-package-smoke
```

冲突依据：T061 冻结的 request DTO、manifest 和 fake capture 是 T062 的输入，T062 不得重新打开上下文读取边界；T063 将复用 T062 的 contracts、session、IPC、Preload、Renderer、configuration 和 fake provider，必须在 T062 集成后串行设计。

### 4.2 Machine-readable metadata sidecar

本任务使用 `docs/implementation/metadata/T062.json`。sidecar 只描述依赖与 shared surfaces，不证明合同批准、权限或完成状态。合同激活前后均须运行：

```powershell
npm.cmd run governance:metadata:check
```

### 4.3 Automation Profile

本草案不声明 Automation Profile。若项目所有者希望使用 `standard-task@1`，必须在合同和 sidecar 中加入完全一致、尚未过期的 execution 声明，重新运行 metadata 校验并单独批准。Profile 不能授权 dependency、Provider/network/credential、docs closeout、Ready、merge、tag 或 release。

## 5. 精确允许修改范围

第 4 节开始条件已全部完成，以下范围现已生效。本次另经项目所有者明确授权的 T061 三份合并后收口记录不构成 T062 实现范围。

### 5.1 Application、contracts 与 ports

- `src/application/ports/ai-start-help.ts`：保留 T061 `StartHelpRequestDto` 字段边界；新增单用途 `AiStartHelpProvider`、`ProviderCapabilities`、`ProviderRequestOptions` 和 unknown-response Port。
- `src/application/ai-start-help.ts`（新增）：runtime response validator、规范化 draft、封闭错误分类、20 秒 Main deadline 和 request lifecycle application service；不得持有 Repository 或核心 Command。
- `src/contracts/ai-start-help.ts`（新增）：Renderer-safe status/result/session/draft DTO 和固定 IPC channel 常量；不得包含 raw Provider/SDK 类型、credential、manifest、persistent IDs 或 arbitrary channel。
- `src/application/ports/configuration.ts`：扩展 tagged AI configuration/credential Port；任何 Renderer-facing DTO 不返回 key、密文、环境变量值或配置绝对路径。
- `src/application/ports/diagnostics.ts`：只新增固定 AI category/code/duration/provider category 所需字段；不得接受用户输入、context、prompt、response、key、path 或 SDK body。

### 5.2 Infrastructure、Main、IPC 与 Preload

- `src/infrastructure/configuration/file-ai-configuration.ts`（新增）：版本化独立配置文件、临时写入、验证和原子替换；确切 userData 相对路径必须先填入 §12.2 并获批。
- `src/infrastructure/configuration/empty-ai-configuration.ts`：保持未配置/不可用降级兼容。
- `src/infrastructure/credentials/safe-storage-credential-adapter.ts`：Main-only protection/read/write/delete；不得增加 Renderer getter、SQLite、export 或普通日志能力。
- `src/infrastructure/diagnostics/safe-diagnostics.ts`：固定脱敏事件；正文与 secret 均禁止。
- `src/infrastructure/index.ts`：只导出上述批准适配器。
- `src/infrastructure/ai/litellm-start-help-provider.ts`（新增）：获批的单一 LiteLLM Gateway adapter；使用 `openai@7.8.0` 的 OpenAI-compatible Chat Completions 客户端，只允许 §12 的固定 origin、`gemini-3.7-flash`、Bearer authentication、`json_schema`、`maxRetries: 0`、18 秒 SDK timeout 和调用方 `AbortSignal`。不得接受 Renderer/config 任意 URL、任意 model override、多 profile 或 fallback router。
- `src/main/ai-start-help-context.ts`：只把 T061 选择结果接入 T062 request lifecycle；不得扩大 Query/manifest/DTO。
- `src/main/ai-start-help-session.ts`（新增）：sender-bound 内存 session、generation、AbortController、deadline、late-response ignore、window/navigation/close cleanup；不持久化。
- `src/main/ai-start-help-ipc.ts`（新增）：status/start/cancel/retry/close 和配置意图的固定 handler、sender/origin 与 runtime input validation；不含 T063 confirm handler。
- `src/main/index.ts`：组合 approved provider/configuration/credential/diagnostics/session/IPC；AI 初始化失败不得阻塞 SQLite 或主窗口启动。
- `src/preload/index.ts`：暴露固定 `aiStartHelp`/`aiConfiguration` 窄 API；不暴露 `ipcRenderer`、URL、headers、model override、AbortController、key getter 或文件路径。

### 5.3 Renderer 最小状态

- `src/renderer/src/env.d.ts`：只通过 `MyTracerApi` 获得窄类型。
- `src/renderer/src/features/today/AiStartHelpPanel.tsx`（新增）：Today Action 详情内的显式触发、输入、disabled/not-configured/requesting/cancelled/failed/draft-ready/closed 状态；成功时只读显示 validated 1～3 条建议，可 cancel/retry/close，不提供核心写入确认。
- `src/renderer/src/features/today/TodayPage.tsx`：仅在关联 active Goal 的 pending Today Action 上挂载明确入口；mount/query/navigation/effect 不调用 start/retry。
- `src/renderer/src/styles.css`：仅新增上述中性状态样式；不改变导航、核心状态或统计语义。

T062 不得加入完整接受/修改/拒绝确认表单、Understanding target/confirm 或普通核心 Command；这些属于 T063。

### 5.4 精确测试范围

- `tests/support/fake-ai-provider.ts`：扩展 success、timeout、cancel、authentication、quota/rate-limit、network、provider unavailable、invalid response、late response、fabricated fact、rest suggestion、internal failure；保留 deep-cloned request 和 call count。
- `tests/support/ai-start-help-context-fixture.ts`：仅复用 T061 合成最小上下文/marker，不扩大数据读取。
- `tests/support/ai-data-capability-harness.ts`：覆盖完整 T062 disabled/not-configured/failure taxonomy 和 snapshot 守恒。
- `tests/unit/ai-start-help-provider.test.ts`（新增）：Port/lifecycle/deadline/generation/error mapping。
- `tests/unit/ai-start-help-response.test.ts`（新增）：严格 allowlist、1～3 suggestions、未知字段、类型/长度/HTML/object/over-budget 拒绝。
- `tests/unit/ai-start-help-session.test.ts`（新增）：cancel/retry/close/new generation/late response/sender cleanup。
- `tests/unit/configuration.test.ts`、`tests/unit/diagnostics.test.ts`、`tests/unit/fake-ai-provider.test.ts`、`tests/unit/process-governance.test.ts`：只增加 T062 边界回归。
- `tests/integration/ai-start-help-provider-contract.test.ts`（新增）：fake 与批准 production adapter 共用 contract；普通 CI 默认只执行 fake，production case 必须显式 opt-in。
- `tests/integration/ai-start-help-ipc.test.ts`（新增）：固定 channel、runtime validation、sender/origin、sealed errors、session ownership。
- `tests/integration/ai-data-capability.test.ts`、`tests/integration/main-foundations.test.ts`：AI 不可用时核心 Application/Main 继续。
- `tests/integration/complete-export-sqlite.test.ts`、`tests/integration/system-export-adapter.test.ts`：配置、credential、session、request/response、diagnostics 正文不进入 export v2。
- `tests/e2e/ai-start-help-degradation.e2e.test.ts`（新增）：主动触发、最小状态、success/read-only draft、cancel/timeout/invalid/not-configured/disabled/retry/late response 和手工路径继续。
- `tests/e2e/ai-data-capability.e2e.test.ts`、`tests/e2e/shell.e2e.test.ts`、`tests/e2e/windows-package-smoke.e2e.test.ts`：startup、Renderer 隔离、package/safeStorage degradation 和核心能力回归。
- `package.json`、`package-lock.json`：合同激活后只允许新增精确 `openai@7.8.0`、相应 lockfile 解析和独立 `test:ai-contract` 脚本；禁止 semver range、额外 SDK、额外 install script 或无关 lockfile 变化。`test:ai-contract` 本任务只允许建立，不允许运行。
- `electron-builder.yml`：默认不修改；若获批 SDK 的 packaging 事实证明必须修改，停止并提交 exact diff/原因给项目所有者，不得预授权。

### 5.5 条件性任务记录

- `docs/implementation/T062_AI_PROVIDER_DEGRADATION.md`、`docs/implementation/metadata/T062.json`：合同和 metadata。
- `docs/implementation/TASK_INDEX_V0.1.md`：只能在项目所有者批准激活、owner-approved docs closeout 或真实 merge 后更新相应状态。
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`：只能记录真实 command/run/artifact/manual/merge 结果。
- Draft PR body：仅在 push/Draft PR 权限获批后更新。
- README、S6 设计、traceability、PRD、DECISIONS、AGENTS、模板、workflow 或其他文档不在默认范围；若 impact matrix 证明必须变更，需逐文件另批。

## 6. 明确非范围

- 不改变 FR-AI01～AI10、AC-02、D-012～D-015、D-108/D-109 或 T061 的最小上下文语义。
- 不实现未批准 Provider、模型、SDK/package/version、网络域、环境变量、配置位置、输出预算或 token/byte 上限。
- 不建立多 Provider 路由、fallback 模型、任意 endpoint、通用 chat、tool calling、Agent、memory、embedding、RAG、插件或自治工作流。
- 不实现 T063 的建议接受/修改/拒绝确认、current-next Command、Understanding 保存或任何核心业务写入。
- 不自动触发、后台调用、mount/effect 调用、定时器、通知、提醒或停滞推断。
- 不把 Provider 原始响应、prompt、draft、session、retry history、error body、credential 或 config 写入 SQLite/export/log/evidence。
- 不修改 schema、migration、表、列、索引、trigger 或 export version；保持 schema v3 和 export v2。
- 不改变 Goal、Action、Routine、Record、Today、Progress、Recovery、Review、LocalDate、删除或统计语义。
- 不让 live Provider test 进入 `verify`、普通 CI、required check 或核心应用启动前置。
- 不创建真实 key fixture，不读取真实用户数据库，不把 credential 复制进 repo/worktree/CI。

## 7. 必须保持的不变量和边界

### 7.1 Provider 与响应验证

- `AiStartHelpProvider` 的候选冻结形状为：

```text
AiStartHelpProvider
  capabilities() -> ProviderCapabilities
  requestStartHelp(request: StartHelpRequestDto, options: ProviderRequestOptions) -> Promise<unknown>

ProviderCapabilities
  configured
  available
  providerLabel?
  modelLabel?

ProviderRequestOptions
  signal: AbortSignal
  requestId
```

- 通过验证后的 Renderer-safe 候选结构为：

```text
StartHelpDraft
  requestId
  acknowledgement
  clarifyingQuestion?
  suggestions[]                 // 1..3
    candidateId                 // Main-generated
    text
  understandingCandidates[]?   // T062 only validates/transports; T063 owns confirmation
    candidateId                 // Main-generated
    text
  safetyNotes[]?
  providerRequestId?
```

- `AiStartHelpProvider` 只服务 Start Help；`requestStartHelp(request, options) -> Promise<unknown>` 是刻意的信任边界。
- Provider 只能收到 T061 `StartHelpRequestDto`；不能收到 manifest、persistent IDs、Repository、UnitOfWork、Commands、configuration enumeration、credential getter、Diagnostics 正文、完整 snapshot 或其他 Goal。
- `validateStartHelpResponse` 使用严格 allowlist；未知字段拒绝，不静默裁剪第 4 条建议，不透传 raw response。
- suggestions 必须恰好 1～3 条；Main 生成 candidate IDs，不信任 Provider ID。
- Renderer 只以文本节点显示；禁止 `dangerouslySetInnerHTML`、可执行 Markdown HTML、脚本链接或 Provider 指令。
- Provider 声称已完成/已掌握、羞辱用户或把休息一律解释为拖延时，不得形成业务事实；fake rest/fabricated scripts 和 MANUAL 文案检查必须覆盖。

### 7.2 deadline、取消、generation 与 Main 内存 session

- T062 Main session 状态只允许 `requesting`、`draft-ready`、`failed`、`cancelled`、`closed`；`disabled`、`not-configured`、`configured-unavailable` 属于配置/可用性状态，不伪装成成功 session。T063 可以在独立合同中扩展确认态，但不得由 T062 预建核心写入状态。
- Main deadline 固定为已批准的 20 秒；SDK timeout 仅作第二道保护。
- 无自动重试。retry 必须由用户明确点击，重新读取当前上下文、生成新 requestId/generation，并保留用户本次输入但不携带旧对话。
- cancel、close、retry、同 sender 新请求、导航、窗口销毁、AI disabled 和 app quit abort 当前 generation。
- 忽略 abort 的迟到响应不得覆盖新 session、显示为当前 draft 或触发任何命令。
- session、manifest、AbortController、validated draft 和 provider request correlation 只驻留 Main 内存；关闭/重启后消失。
- Provider 请求和用户等待不持有 SQLite transaction、cursor 或 Repository object。

### 7.3 错误分类与 Renderer 边界

封闭错误码必须至少包含：`disabled`、`not-configured`、`credential-unavailable`、`context-not-found`、`context-too-large`、`stale-context`、`timeout`、`cancelled`、`network`、`authentication`、`quota`、`rate-limited`、`provider-unavailable`、`invalid-response`、`internal`。

Renderer 不得获得 exception stack、SDK body、raw Provider response、credential、环境变量、配置绝对路径、manifest 或内部 provider/model override。`cancelled` 不显示为用户失败；其他错误使用中性文案并保留手工入口。

### 7.4 配置、safeStorage、IPC 与 Electron

- `AiConfigurationState` 只表达 `disabled`、`not-configured`、`configured-available`、`configured-unavailable` 及可安全显示的 provider/model label。
- 配置文件位于 userData 下独立文件，采用版本字段、临时写入、验证、原子替换；不在 SQLite、不进入 export v2。
- Renderer/Preload 只发送 `importFromEnvironment`、enable/disable、delete credential 等无 key 意图；Main 独占环境变量读取和 safeStorage encrypt/decrypt。
- Preload 只暴露固定方法；每个 handler 先做 `assertTrustedSender`/origin，再做对象键、字符串长度、token、枚举和 extra-field 校验。
- Renderer 无 Node、SDK、Provider fetch、key、配置密文、文件路径或任意 channel；CSP 不增加 Provider `connect-src`。
- 保持 `nodeIntegration: false`、`contextIsolation: true`、sandbox、本地内容、禁止任意导航/新窗口。

### 7.5 数据、降级与测试隔离

- disabled/not-configured/credential failure/timeout/cancel/network/provider/invalid/internal 全部分支核心数据零写入。
- AI 初始化失败不得阻止 SQLite 初始化、主窗口、CRUD、Progress、Recovery、Review、delete、export 或 restart。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 继续分离；AI 失败或无响应不产生 Record 或失败评价。
- 自动测试默认 fake、临时 SQLite/userData、合成文本和 fake clock；正常 CI 不访问 live Provider、真实 key 或真实用户内容。
- credential、config secret、request/response、session、manifest 和技术日志不进入 export v2、截图、evidence JSON、fixture 或 copied worktree。

- **引用不变量**：AGENTS §7～§9；S6 design §4、§6、§8～§10、§13、§16；T061 contract §5.1、§7、§9。
- **本任务局部风险**：SDK 类型绕过 runtime validator、Renderer 任意 model/URL override、Main deadline 与 SDK timeout 竞态、abort 后迟到响应覆盖新 generation、session 跨 sender 泄露、credential/source 优先级歧义、配置截断被当成功、SDK 默认日志泄露正文、package 环境 safeStorage 不可用阻塞启动、fake contract 与 production adapter 漂移。

## 8. 交付物

- [ ] 单用途 `AiStartHelpProvider` Port、Provider capabilities 和批准的 production adapter。
- [ ] 严格 runtime validator、规范化 `StartHelpDraft`、1～3 suggestions 和固定 response limits。
- [ ] 封闭 error taxonomy、20 秒 deadline、cancel/retry/close、generation 和 late-response ignore。
- [ ] sender-bound Main 内存 session、window/navigation/app cleanup。
- [ ] Main-only configuration、批准的 userData 配置文件、safeStorage credential store 和无 key IPC。
- [ ] status/start/cancel/retry/close/configuration IPC 与 Preload 窄 API。
- [ ] Today Action 内最小 disabled/not-configured/requesting/cancelled/failed/read-only draft UI；无核心确认写入。
- [ ] expanded fake、shared adapter contract、unit/integration/IPC/E2E/package/security 测试。
- [ ] AI unavailable 下核心 CRUD/Progress/Recovery/Review/delete/export/restart 回归。
- [ ] dependency/lockfile/network/config/credential/export/log/bundle 隔离审计。
- [ ] complete diff 自查和独立只读 review，无未处理 material finding。
- [ ] targeted、adapter contract、integration、IPC、E2E、package/security、affected regression、`verify`、candidate/final-head CI 和 Integration Freshness 证据。
- [ ] owner-approved docs closeout、task delivery revision 和 merge handoff；不自动进入 T063。

## 9. 验收标准

1. fake 与获批 production adapter 通过同一 `AiStartHelpProvider` contract；Application/Domain 测试不引用 vendor SDK 类型。
2. T061 `StartHelpRequestDto` 未扩大，Provider 不能访问 manifest、persistent IDs、其他 Goal、Repository、Command、SQLite、export、credential getter 或 Diagnostics 正文。
3. 合法响应严格规范化；suggestions 恰为 1～3 条。0 条、超过 3 条、unknown field、非字符串、空白、嵌套 object/HTML、非法枚举或任一批准上限超限均为 `invalid-response`，不得成为 draft。
4. Main 20 秒 deadline 可重复验证；无自动重试。用户 retry 创建新 requestId/generation、重新读取当前上下文、保留本次输入且不携带旧对话。
5. cancel、close、navigation、window destroy、disabled、app quit 和 new generation 均 abort；旧 late response 被忽略，不覆盖 UI、不产生新 session 结果、不写核心数据。
6. §7.3 错误码映射完整；Renderer 只收到 sealed code/state/correlation，不收到 stack、SDK body、raw response、credential、path 或内部配置。
7. 配置文件非法、safeStorage 不可用/解密失败、环境变量缺失、Provider 未配置或 AI disabled 时应用仍启动，手工核心路径完整可用。
8. environment import、safeStorage write/read/delete 和配置原子替换只在 Main；Renderer/Preload 不接触 key/密文，SQLite/export/log/evidence/bundle 不含 credential 或 AI 正文。
9. Renderer mount/query/navigation/no-click 的 Provider call count 为 0；显式 start 每 generation 最多一次请求；minimal UI 不包含 T063 confirm/Understanding 写入。
10. disabled/not-configured/credential unavailable/timeout/cancel/network/auth/quota/rate-limit/provider unavailable/invalid/internal 前后 complete core snapshot 相等；CRUD、Progress、Recovery、Review、delete、export 和 restart 继续。
11. Windows unpacked/package/NSIS smoke 在 safeStorage unavailable 和无配置环境仍可启动；Renderer 安全与 CSP/IPC sender/origin/bundle scan 无退化。
12. package/lockfile 只包含获批 exact package/version；无额外依赖、postinstall、网络域、环境变量或配置位置。
13. targeted tests、shared adapter contract、integration、IPC、E2E、package/security、affected regression、完整 `verify`、candidate/final-head hosted CI、complete diff 和独立 review 均绑定 exact revision。
14. 无 schema/migration/export version/core write 变化；T062 不声明建议确认、Understanding、完整 AC-02、S6 final gate、T063、Ready、merge、tag 或 release 完成。
15. **MANUAL**：项目所有者在隔离 Windows 数据根用 fake 和获批 Provider 各检查一次温和、具体、足够小、休息非拖延的 1～3 条建议，以及 disabled/not-configured/timeout/cancel/error 后立即回到手工路径；结果必须真实记录为 pass/fail/partial/pending。

## 10. 验证计划

### 10.1 合同与治理 Gate

```powershell
npm.cmd run governance:metadata:check
git diff --check
npm.cmd run format:check
```

### 10.2 针对性 unit 与 adapter contract

```powershell
npm.cmd run test:unit -- tests/unit/ai-start-help-provider.test.ts tests/unit/ai-start-help-response.test.ts tests/unit/ai-start-help-session.test.ts tests/unit/configuration.test.ts tests/unit/diagnostics.test.ts tests/unit/fake-ai-provider.test.ts tests/unit/process-governance.test.ts
npm.cmd run test:integration -- tests/integration/ai-start-help-provider-contract.test.ts tests/integration/ai-start-help-ipc.test.ts tests/integration/ai-data-capability.test.ts tests/integration/main-foundations.test.ts tests/integration/complete-export-sqlite.test.ts tests/integration/system-export-adapter.test.ts
```

shared adapter contract 默认只实例化 fake。获批 production adapter 的离线 contract case 使用 fake transport 或 SDK mock，不访问网络、不读取真实 key。

### 10.3 IPC、E2E 与 package/security

```powershell
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/ai-start-help-degradation.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts tests/e2e/shell.e2e.test.ts
npm.cmd run package
npm.cmd run test:package-smoke
```

额外程序：

1. 在唯一临时 `userData` 分别模拟无配置、disabled、配置文件非法、safeStorage unavailable/decrypt failure；unpacked/NSIS 启动成功且核心页面可用。
2. 扫描 Renderer bundle、preload surface、配置文件、export fixture 和脱敏 diagnostics，确认不存在 key、环境变量值、raw request/response、manifest、SDK body、任意 Provider URL 或 `ipcRenderer` 暴露。
3. 检查 `package.json`、`package-lock.json` 和最终 bundle 只包含批准 package/version；无未批准 install script、domain 或 transitive capability 扩张。
4. package/NSIS 产物只用于隔离测试；不签名、不发布、不写真实用户数据。

### 10.4 受影响范围回归与 aggregate

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
```

`verify` 必须保持离线、read-only，并包含 build 到 Electron E2E；不得调用 live Provider、写真实配置或触及真实 `userData`。

### 10.5 Optional live Provider contract

S6-Q05 A 已批准的策略固定为独立、显式、非默认命令：

```powershell
npm.cmd run test:ai-contract
```

该脚本当前不存在。合同激活后允许建立该独立命令及完全离线的参数/guard 测试，但本任务明确禁止运行真实 live contract。它不得进入 `test`、`verify`、普通 CI 或 required check，不得读取真实 key或调用获批 Gateway。未来若要运行，必须另批专用 credential、唯一 Gateway origin、合成输入、最大调用次数、费用边界和 network/live-test 权限；只记录脱敏 metadata，不保存 request/response 正文。失败保持真实失败，不得改写为 fake/core suite成功。

### 10.6 Deterministic evidence capture

```powershell
node tools/evidence/capture-command.mjs --task T062 --gate task-candidate --base-revision 4630878dacd0a15dbe8446cb26d9cea790d3ed6e --output .tmp/evidence -- npm.cmd run verify
```

artifact 只能位于 ignored `.tmp/evidence/`，保留真实 exit code、source/base/CI head/test-merge revision 和固定环境元数据；禁止 stdout/stderr、用户正文、Provider request/response、credential、环境变量或绝对用户路径。

### 10.7 独立 review

1. 审查完整 `dev...Implementation Candidate` diff，不只审最后 commit。
2. 检查 T061 DTO/manifest/context 未扩大，Provider 永无 Repository/Command/write，Renderer/Preload 永无 SDK/network/key/arbitrary channel。
3. 检查 deadline/cancel/late/new generation/session ownership、runtime validator、配置原子性和错误映射无竞态或泄露。
4. 检查 package/lockfile/domain/env/config path 与批准值完全一致，无未批准依赖、migration、schema/export 或 T063 行为。
5. 所有 material finding 修复后重跑受影响 validation；review surface 改变时重新独立 review。

### 10.8 人工步骤

1. 项目所有者按 §9.15 在隔离 Windows 环境签署 T062 MANUAL 结果；Agent 不能代签。
2. 核对未配置、关闭、timeout、cancel、invalid response、auth/network/provider failure 后手工 Goal/Action/Record/Progress/Recovery/Review/export 立即可用。
3. 检查建议文案温和、具体、足够小，不羞辱、不制造焦虑、不把合理休息写成拖延；不把候选表述为已经完成或掌握。
4. T063/完整 AC-02 人工验收继续为 `pending`。

### 10.9 验证环境

- OS：Windows 11 x64；hosted candidate/final-head CI 使用仓库批准 Windows runner。
- Node：仓库锁定 `24.18.0`。
- npm：仓库锁定 `11.16.0`。
- Electron：仓库锁定 `43.3.0`。
- SQLite：`better-sqlite3@13.0.1`，每 case 唯一临时数据库。
- 数据根：唯一临时 Electron `userData`；不得访问真实用户数据。
- AI：普通自动化只用 fake；live contract 仅在单独批准环境。
- Source revision：Implementation Candidate、final head 和 merge 时分别填写。

## 11. Git、GitHub、任务状态与文档收口权限

项目所有者已批准 §12 的精确 Provider profile、限制值和实施/Git/GitHub 权限，并在合同更新后明确指令执行 T062 开发。下列权限已对本次实施生效。

- [x] 允许创建本地 `task/T062-provider-degradation`；已执行。
- [x] 允许本轮修改 T062 合同/metadata和授权的 T061 收口记录。
- [x] 允许修改合同列明的代码、测试实现、精确依赖、lockfile 和 Main-only 配置能力；不得访问真实 credential。
- [x] 允许创建本地提交。
- [x] 允许推送当前任务分支。
- [x] 允许创建/更新到 `dev` 的单一 Draft PR 并触发 Actions；PR 成功后立即停止且不查询 CI。
- [ ] 未授权将 Draft 标记 Ready。
- [ ] 未授权 Agent 合并到 `dev`。
- [ ] 未授权 Agent 创建/合并 `dev -> main` PR、tag 或 release。

```yaml
historical_contract_draft_authorization:
  base_revision: dev@4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  create_task_branch: true
  contract_and_required_metadata_write: true
  owner_authorized_t061_closeout_correction: true
  implementation_write: false
  create_commit: false
  push_task_branch: false
  github_write: false

active_permissions:
  activated_by_owner_instruction: true
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
  dependency_change: true
  migration_change: false
  production_runtime_network:
    allowed: true
    origin: https://litellm-gateway-811499828950.us-central1.run.app
    user_triggered_only: true
  agent_live_network_call: false
  credential_capability_implementation: true
  agent_real_credential_access: false
  configuration_file_write: true
  create_live_provider_contract_command: true
  run_live_provider_contract: false
  external_write:
    allowed: true
    scope: task-branch-push-and-single-draft-pr-to-dev
```

上述外部写入即使激活，也只限唯一 T062 task branch、到 `dev` 的单一 Draft PR 和其 Actions；不包含 live Provider 调用、Issue、ruleset、secret、Ready、merge、main PR、tag、release、force push或远端分支删除。项目所有者已要求未来 PR 创建并推送成功后立即停止，不自主查询 CI。

任务状态和 docs closeout：

- T062 在 `TASK_INDEX_V0.1.md` 为 `active`；实现、验证、独立 review 和 Draft PR 交付期间保持该状态。
- 候选 CI 首次针对 exact Implementation Candidate 成功后必须暂停，提交 task contract、TASK_INDEX、Evidence、Draft PR body 及条件文档的 impact matrix，等待项目所有者批准精确 closeout scope。
- 未经该 Gate，不得写 `done`、task delivery revision、完成 Evidence 或最终 PR 正文。
- docs closeout push 后必须取得 exact new-head required CI；Ready 和 merge 始终另批。

## 12. Provider、依赖、网络、credential 与配置审批表

### 12.1 已批准值与阻塞值

| 项目 | 当前合同值 | 状态 | 激活前要求 |
|---|---|---|---|
| S6-Q01 方案 | 单一 LiteLLM Gateway profile + OpenAI-compatible 官方 SDK + Gemini 结构化文本模型 | 已批准 | 只允许本表唯一 profile；不授权 router/fallback |
| Provider vendor / providerId / label | LiteLLM / `litellm-gateway` / `LiteLLM Gateway` | 已批准 | Gateway 是实际服务边界；不得标成 OpenAI Provider |
| Model ID / model label / model version policy | `gemini-3.7-flash` / `Gemini 3.7 Flash` / 固定 ID、无 alias、无自动升级或 fallback | 已批准 | 更换模型需重新批准合同配置 |
| SDK/HTTP 方案 | `openai` SDK 的 OpenAI-compatible Chat Completions；`src/infrastructure/ai/litellm-start-help-provider.ts` | 已批准 | 不自写通用 HTTP、不暴露任意 endpoint/model |
| npm package / exact version range | 精确 `openai@7.8.0`；禁止 semver range 和额外 install script | 已批准 | 激活后才允许 package/lockfile 变化 |
| Provider API/network domains | base URL `https://litellm-gateway-811499828950.us-central1.run.app/v1`；唯一 origin `https://litellm-gateway-811499828950.us-central1.run.app:443` | 已批准 | 禁止跨 origin redirect、任意 URL 和其他生产/live-test 域名 |
| Endpoint / response format / authentication | `/chat/completions`；`response_format.type=json_schema`；Bearer | 已批准 | 非 streaming；schema 仅用批准子集；Main仍二次验证 |
| Environment variable | `MYTRACER_LITELLM_API_KEY` | 已批准 | SDK不得隐式读取 `OPENAI_API_KEY`/`OPENAI_BASE_URL` |
| Config relative path under userData | `configuration/ai-provider.v1.json`，schema version 1，同目录临时文件验证后原子替换 | 已批准 | 只存固定 profile metadata和safeStorage密文，不存明文/正文/任意 URL |
| Credential precedence | `disabled > stored safeStorage credential > not-configured`；环境变量只作显式导入源，不自动覆盖 | 已批准 | safeStorage不可用/解密失败为`credential-unavailable` |
| Import/delete flow | import成功后启用且不联网；disable取消请求并保留密文；enable要求可解密且不联网；delete取消请求、删除密文并进入`not-configured` | 已批准 | Renderer只发送无key意图；Main独占读取/加解密/写删 |
| Request total text budget | 8,000 Unicode code points | 已批准 | T061 selector 不得扩大；adapter 另做 token/byte gate |
| Provider request/output upper bound | serialized request 49,152 bytes；`max_completion_tokens=1,200` | 已批准 | 不新增 tokenizer依赖；不得突破8,000 code points |
| Main deadline | 20,000 ms | 已批准 | SDK timeout 只能更窄或作第二层保护，不替代 Main deadline |
| SDK timeout / retry | 18,000 ms；`maxRetries=0`；Main 20,000 ms；仅用户显式 retry | 已批准 | 每次新 context/requestId/generation；无SDK自动重试 |
| Response string/array/total output limits | 见 §12.1.1 | 已批准 | 任一超限整体`invalid-response`；不截断、不部分接受 |
| Live contract strategy | 允许建立独立显式 `test:ai-contract`，不进 verify/普通 CI|required；本任务禁止运行 | 已批准 | Agent/自动化/CI/package smoke均不得读真实key或调用Gateway |

### 12.1.1 已批准响应上限

```yaml
response_limits:
  acknowledgement_code_points: 300
  clarifying_question_code_points: 300
  suggestions:
    count_min: 1
    count_max: 3
    each_code_points: 500
    total_code_points: 1200
  understanding_candidates:
    count_max: 3
    each_code_points: 500
    total_code_points: 1200
  safety_notes:
    count_max: 2
    each_code_points: 300
    total_code_points: 500
  provider_request_id_code_points: 128
  total_response_text_code_points: 3500
```

Provider-facing JSON Schema只使用 `type`、`properties`、`required`、`additionalProperties: false`、`items`、`minItems` 和 `maxItems`。不依赖 Provider 执行字符上限；Main对 SDK结果按 `unknown` 重新解析、严格 allowlist、纯文本和上述长度验证。任一 unknown field、多个 choice、缺失/非字符串 content、截断 finish reason、非法 JSON、空文本、HTML/嵌套非法值或超限均整体降级为 `invalid-response`。

### 12.2 依赖与外部操作权限

- 新增依赖：已激活允许精确 `openai@7.8.0` 和必要 lockfile 变化。
- 网络访问：产品运行时只允许用户主动 Start Help访问唯一获批 LiteLLM origin；禁止跨 origin redirect。Agent、自动化、CI、package smoke和本任务 live contract 均不得调用真实 Gateway。
- AI Provider：已激活允许实现单一 LiteLLM production adapter；普通测试只用 fake，adapter contract只用 fake transport。
- credential：已激活允许实现 Main-only `MYTRACER_LITELLM_API_KEY`显式导入及safeStorage encrypt/decrypt/write/delete；Agent不得读取、接收或保存真实key。
- 配置文件：已激活允许仅在真实运行或唯一临时测试 `userData` 下创建/修改/delete `configuration/ai-provider.v1.json`；自动测试禁止真实用户根。
- Git/GitHub外部写入：已激活允许本地实施提交、push `task/T062-provider-degradation`、创建/更新到`dev`的单一Draft PR及触发Actions；PR成功后立即停止且不查询CI。
- live contract：允许建立独立命令但本任务禁止运行；未来运行需新的 exact key/network/call-count/费用授权。
- 数据破坏性操作：无；不得删除或迁移核心数据。credential 删除只在精确配置流程获批后生效。
- migration/schema/export change：无且禁止。

## 13. Integration Freshness

```yaml
integration:
  target_branch: dev
  base_revision: dev@4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  prerequisite_t061_task_delivery_revision: 5f98b2f61026721f22fe6cd627c3b402678e9a93
  prerequisite_t061_final_head_revision: d60978917546f6547a1615c6aa03e87d08c0d2ce
  prerequisite_t061_dev_integration_revision: 4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

草案时的只读事实：本地 `dev`、`origin/dev`、远端 `refs/heads/dev` 和任务分支 base 均为 `4630878dacd0a15dbe8446cb26d9cea790d3ed6e`。该事实只证明草案基线；合同激活、第一次实现修改、Implementation Candidate、发布前和 merge handoff 都必须重新核对。

```yaml
integration_freshness:
  original_base_revision: 4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  latest_authorized_dev_revision: 4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  verified_against_revision: 4630878dacd0a15dbe8446cb26d9cea790d3ed6e
  status: fresh
  refresh_method: not-needed
  scope: contract-draft-only
```

若激活时 `dev` 已前进，先只读核对 T061 DTO、Main/Preload/Renderer、configuration/safeStorage、schema/export 和 shared surfaces，再把合同/metadata exact base 更新后交项目所有者重新确认。实现分支 stale 时只能普通 traceable merge 最新授权 `dev`；不得 rebase/force-push 改写已发布历史。刷新后重跑 affected regression/candidate validation，并在 review surface 改变时重新独立 review。

## 14. 风险与停止条件

发现以下任一情况时停止受影响工作并报告；需要范围、依赖、权限、架构或证据变化时使用 `ESCALATION_PROPOSAL_TEMPLATE.md`，不得自行扩大合同：

- 合同未再次明确激活，或实现时发现 §12 的 Provider/model/package/domain/env/config/output limits/权限需要改变。
- 需要改变 T061 request DTO、读取更多上下文、使用 complete snapshot 后过滤或暴露 manifest/persistent IDs。
- 需要让 Provider、Renderer 或 Preload 获得 Repository、SQLite、credential getter、任意 network/channel 或核心写权限。
- 需要多 Provider、fallback、通用 chat/Agent/tool/memory/RAG、主动触发、后台监督或延期能力。
- 需要改变 AI 确认语义、核心状态、统计、日期、删除、Today、Recovery、Review 或 export 语义。
- 需要 schema/migration/export version、AI table/cache、持久化 session/draft 或把 Understanding 脱离 ActionRecord。
- 配置文件/credential 无法与 SQLite/export/log/evidence/bundle 隔离，或 package 环境 safeStorage 失败阻塞基础应用。
- timeout/cancel/late/new generation 无法确定性测试，或 production adapter 不能满足 shared contract/strict validation。
- 自动测试必须访问真实用户数据、真实 key 或 live Provider 成为普通 verify/CI 前置。
- 无法绑定 exact source/base/head/test-merge/merge revision，或 failed/partial/skipped evidence 无法保留。

## 15. 完成报告要求

必须包含：

- 新增/修改文件和可观察结果；
- FR-AI02～AI04、AI07、AI09、D-012/013/015、ED/GW 覆盖；
- Provider/model/package/version/domain/env/config/预算/timeout/retry/live strategy 的最终批准值；
- dependency/lockfile/network/credential/config/Git/GitHub 权限实际使用情况；
- exact targeted、contract、integration、IPC、E2E、package/security、affected regression、`verify` 命令、环境、结果和 artifacts；
- complete diff/独立 review finding 与处理；
- Integration Freshness 五字段、task delivery/final head/dev integration revision、PR/run/job/head/test-merge 标识；
- 自动化与 MANUAL 状态、residual risks、skipped/unverified、是否发现 requirement/scope/permission change；
- 明确 T063、完整 AC-02、S6 final gate、Ready、merge、tag、release 仍由项目所有者分别决定。

## 16. 激活 Gate

精确工程决定已经批准并写入 §12。项目所有者已在合同更新后明确指令执行 T062 开发，本 Gate 已通过：

1. 只读核对最新授权远端 `dev`。若已前进，检查 T061 DTO、Main/Preload/Renderer、configuration/safeStorage、schema/export 和 shared surfaces，更新 exact base/integration freshness 后重新确认。
2. 确认 §12 的 LiteLLM Gateway origin、`gemini-3.7-flash`、`openai@7.8.0`、环境变量、配置路径、限制值和权限未改变。
3. 项目所有者已明确要求基于更新后合同执行 T062 开发；`TASK_INDEX_V0.1.md` 已从 `pending` 改为 `active`。
4. 激活不授权真实 Gateway 调用或真实 credential 访问；`test:ai-contract` 只可建立不可运行。Ready、merge、main、tag 和 release继续分别审批。

激活后仍不调用真实 Provider、不运行 live contract、不读取或保存真实 credential；Ready、merge、main、tag 和 release 继续分别审批。

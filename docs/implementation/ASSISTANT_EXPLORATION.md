# Assistant 探索：启动基线与并行约定

依据：[issue #161](https://github.com/Fyrefly-4/MyTracer/issues/161) 的已确认决定，以及所有者随后发出的启动授权。本文是短实施提案，不启动历史 Txxx 阶段流程。该 issue 的“等待启动”段落保留为当时状态。

## 可立即使用的基线

- 集成分支：`assistant/exploration`；创建自最新核实的 main `c4405a85d29cbe074c5814d346b832368e463a7b`（2026-10-25）。
- main 已包含 #160（`6a1e908`）和 #162（`c4405a8`）；本阶段没有另行合并或 cherry-pick #160。
- 子分支从该集成分支建立，子 PR 一律以 `assistant/exploration` 为 base。实际合并由父任务协调，必要验证和独立 review 后进行；本阶段不合 main、不发布。
- 启动核查：open PR 为 #117、#118、#134、#135、#136（依赖更新），未发现 Assistant PR。issue 无评论/受派人；当前云环境只有原 work 工作树，无已有 Assistant 工作树。不能据此推断其他会话没有执行者，父任务仍是分工唯一协调入口。
- 此基线 PR 只交付文档与验证分支覆盖，不实现三个模块，也不创建迁移、改锁定依赖或配置真实服务。

## 一条短计划

1. 三条工作线并行，以 fake provider 和隔离合成“整理居住空间”记录联调：从记录整理简述进入 Assistant，显示当前参考来源，连续追问；从目标/行动入口接上上次；复盘入口按选定范围形成可编辑候选。
2. 合成旅程贯通本地保存、重启续聊、删除和临时会话，以及范围内真实的只读查询。查询返回程序计算统计和可回访来源；不把整个数据库塞进提示词。逐步查询必须有次数/输出预算、取消和可见过程。
3. 候选先对照预览，填入编辑草稿与正式保存分开；确认后才走既有应用命令。覆盖来源变化、用户继续编辑、重复点击和迟到响应。正常设置页提供 OpenAI 兼容服务配置与连接测试 UI；本批测试仍使用 mock，不发真实请求。
4. 父任务整合桥接与完整旅程验收，独立 review 后合入阶段分支。Windows 必要检查与 Mica/C1/双栏视觉验收仍记录实际结果；原型开发不等待 CI 空转。

## 文件所有权（角色由父任务指派具体执行者）

| 工作线 | 唯一维护范围 | 交付给其他工作线 |
| --- | --- | --- |
| A 服务配置与执行层 | 新 `src/contracts/assistant-service.ts`、`src/application/ports/assistant-provider.ts`；专属 infrastructure provider/configuration 文件；专属 Main 配置 IPC 文件和测试 | 无密钥的配置状态、配置保存/删除/测试能力、带取消与预算的执行端口；fake provider |
| B 会话/作用域/只读工具 | **`src/contracts/assistant.ts` 唯一 owner**；新 application assistant 模块、Main 会话/查询/候选 IPC、隔离会话存储及对应测试 | 会话 API、scope/manifest、短多轮执行编排、来源、候选预览与确认 |
| C renderer 整体体验 | 新 `src/renderer/src/features/assistant/`、各入口及设置页 UI、局部样式、renderer 测试 | 多入口同一体验，当前参考可见，短对话和本地会话操作，候选对照；A/B API 的 mock adapter |
| 集成负责人（父任务） | `src/main/index.ts`、`src/preload/index.ts`、`src/contracts/shell.ts`、全局声明/测试桥接、`App.tsx`、全局样式、workflow 与本计划 | 统一接线、冲突收敛、独立 review 与旅程验收 |

跨边界改动先把精确 export/接线补丁交给 owner，不在各分支复制一份共享类型。C 的设置 UI 归 C，A 只提供服务接口。既有 `ai-start-help` 契约保留，迁移入口时由集成负责人统一消除重复入口，不擅自替换旧确认语义。

首个 UI 实验采用单个覆盖式 Assistant 面板，底层双栏保持挂载与草稿/位置，不变成第三条窄栏。现有 `AiStartHelpPanel` 的卸载关闭行为不能直接照搬到持久会话。重开会话只恢复本地状态，不重放模型请求或写命令；删除会话不删除已经确认的正式记录。

## 最小共享契约建议 v0

这是供三线立刻建 mock 的接口约定，**尚非已实现 API**。B 先落地纯 TypeScript DTO，无 Electron/Node/SDK 依赖；A/B 在各自契约文件新增具体字段，避免先造通用 Agent 注册中心。现有对象 ID、应用命令和错误结果形状尽量复用。

来源另带实际选用的 `fields[]` 与逐来源 `truncated`，候选状态明确区分 `proposed/stale/committing/committed`；笔记和复盘候选的编辑版本必须独立于已保存目标版本。复盘从选定事实进入，可按现有复盘字段生成候选，不先绑定成只能写一个全文字符串；具体 typed payload 由 B 与 C 共同收敛后仅由 B 写入共享文件。

| 名称 | 最小字段/签名及语义 |
| --- | --- |
| `AssistantObjectRef` | `{ kind: 'goal' \| 'action' \| 'action-record' \| 'routine-record' \| 'review', id: string }`，类型与 ID 共同确定对象 |
| `AssistantEntry` | 当前 `object`、`intent: 'organize' \| 'clarify' \| 'resume' \| 'review'`；可带显式当前编辑文本和 `editorRevision`，未保存文本须标识为草稿 |
| `AssistantScope` | `current`、显式 `selectedObjects[]`、可选 `goalId`/`dateRange {from,to}`；默认只当前对象，选择集合与筛选范围的并集须明确显示，查询强制在服务器解析的授权集合内 |
| `AssistantContextManifest` | `revision`、`scopeRevision`、`sources[] {ref, sourceRevision, label, excerpt, origin: 'saved' \| 'editor-draft'}`、`truncated`、`omittedCount`；指明实际发送内容，不把可访问范围冒充已参考范围 |
| `AssistantMessage` | `id`、`role: 'user' \| 'assistant'`、`text`、`sourceRefs[]`、`createdAt`；模型引用必须属于本次 manifest/合法查询结果，未验证引用不得显示为事实 |
| `AssistantSession` | `id`、`mode: 'persistent' \| 'temporary'`、`entry`、`scope`、`revision`、`messages[]`；保存对话不提炼长期记忆，发送历史独立截断且可见 |
| `AssistantTurnInput` | `sessionId`、`expectedRevision`、`requestId`、`text`；Main 持有并校验作用域/来源，不能相信 renderer 或模型自行声明权限 |
| `AssistantRun` | `requestId`、`state: 'running' \| 'completed' \| 'cancelled' \| 'failed'`、`manifest`、`steps[]`、`messages[]`、`candidates[]`、受控 `error`；非流式先可用，流式能力后续通过同一 requestId 扩展 |
| `AssistantCandidate` | `id`、`requestId`、`sourceRefs`、目标 `target`、`expectedTargetRevision`、可编辑 `proposedText`、`kind: 'record-summary' \| 'note-append' \| 'action-create' \| 'review-draft'`；不同种类由具体应用命令解释，禁止任意 command/payload 执行 |
| `AssistantWritePreview` | `previewId`、明确的 `changes[]`（目标、修改前/后、动作标签）、关联的来源/目标版本；修改候选需重新生成预览。正式确认只提交 Main 保存的 previewId 和防重复 operationId |

建议具体会话 API（均返回现有风格 `{ok:true,value}` / `{ok:false,error:{code}}`）：

```text
createSession({entry, mode}) -> AssistantSession
listSessions() -> SessionSummary[]
getSession({sessionId}) -> AssistantSession
deleteSession({sessionId}) -> deletion result
setScope({sessionId, expectedRevision, scope}) -> AssistantSession
sendTurn(AssistantTurnInput) -> AssistantRun
cancelTurn({sessionId, requestId}) -> cancellation result
previewWrite({sessionId, candidateId, editedText, expectedTargetRevision}) -> AssistantWritePreview
confirmWrite({sessionId, previewId, operationId}) -> concrete application result
```

`sendTurn` 初期可返回有界最终结果，取消走单独 IPC；过程可见需由 B 提供按 requestId 读取受控 run 状态的具体方法，或集成负责人增加严格校验的事件桥，不开放任意 channel。`setScope` 使旧 run/preview 失效；恢复、删除会话时取消活动请求并忽略迟到结果，删除不得被异步回调重新保存。持久会话在本地恢复，temporary 永不写磁盘；会话不进入产品导出。

只读工具第一批做具体的 `findRecords`（选定范围内关键词/日期）、`readGoal`、`getStatistics`，输入由 Main 校验，结果附 source ref、版本与截断。Provider 仅提出结构化查询请求；B 用已授权 scope 执行，A 无 repository 权限。暂不支持工具的服务使用已准备的上下文正常回答，并明确告知无工具能力；不能伪造查询步骤。未来新增一种能力即可扩展判别联合，不要求现在实现记忆、插件或自主任务系统。

A 的 `assistant-service.ts` 提供 `getStatus/saveConfiguration/deleteCredential/testConnection`：配置包括 endpoint、model、enabled；Key 只经专用一次性写入参数传入 Main，返回状态只有 `credentialPresent`。连接测试返回 `connection` 与独立 `streaming/tools: 'unknown' | 'supported' | 'unsupported'`，连通不代表能力都支持。provider 端口接收已准备消息/上下文、requestId、AbortSignal 和明确预算，返回 `unknown` 供结构校验；错误不得带凭据/原始响应。真实连接测试仅在产品用户主动点击时执行，本批开发无真实调用授权。

正式写入需校验 preview 所属会话、未失效的来源/目标版本和最终文本；同一 operationId 重试返回原结果，不重复写入。将建议填入未保存编辑草稿不等于正式保存，C 还需校验 editorRevision 防覆盖新输入。“创建行动”与“设为下一步”不得混成一个含糊按钮，后者需要独立明确预览。

## 已确认边界与待决实施选择

issue #161 明确更新旧 [AI 边界](../architecture/AI_BOUNDARY_V0.1.md) 的“不保存会话”、固定 5 条/字段和单次启动服务限制：本阶段支持本地保存/删除/临时会话、显式扩大参考范围和 OpenAI 兼容配置。旧文档的用户主动触发、来源可辨、密钥隔离、确认写入及可降级仍有效。本阶段不默认全库上传、长期记忆、AI 评分或自动改历史，不允许任意 SQL/终端/文件访问。

具体会话存储布局、条数/字符/工具步数预算由 A/B 在首个实现 PR 写明。优先隔离、版本化的本地会话存储，避免本批更改核心业务 schema；需要 schema 迁移或新增依赖时，先提出精确方案并按 AGENTS 的确认规则处理，仅在隔离数据上试验。未来长期记忆只保留可组合上下文的扩展方式，不创建空 memory 接口。

## CI / 发布核查与合并前验收

- 本 PR 为 Verification、Focused Electron、Installer validation 增加精确 base 分支 `assistant/exploration`；所有原分支、paths、权限、版本、任务和断言保留。CI 分类仍将 workflow/source 视为完整验证，未降低必要覆盖。
- Release 的 push 仍仅 main，release-pr 还有 `refs/heads/main` 条件，release-please target 仍 main；build/publish 依赖 release selection。Installer 仅验证并 `--publish never`；本阶段分支 push 和子 PR 不触发正式发布。不得拿 Release recovery 做实验验证。
- 基线 PR 合并前，集成分支本身尚未包含覆盖修复；子任务可以开发，但不能把未出现的 CI 当通过。父任务核对实际 PR run 的 SHA、必要检查与实时 rulesets，不修改保护/权限，也不因缺 required check 自动合并。
- 本批交付验收：三个验证工作流覆盖阶段分支、Release 不变、文档链接/diff/聚焦治理测试通过。Windows 托管 CI 和独立 review 待实际结果，不用 Linux 结果替代。
- 实现批验收：合成多入口短对话、范围隔离/恶意记录提示注入、可回访来源、预算与取消、保存/恢复/删除/temporary、过期和重复写入拒绝、无配置/断网可继续手工、连接成功与工具能力分离。视觉保持 Mica/C1 和原双栏，不新增主导航 AI 工作台。

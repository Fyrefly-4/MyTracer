# Assistant 集成接线准备

状态：2026-10-25，已在独立 `codex/assistant-integration` 分支接入真实 Main / preload / renderer。阶段基线 [PR #163](https://github.com/Fyrefly-4/MyTracer/pull/163) 已经父任务批准后普通合并，merge SHA `cb3972843608afc97809ee00d0eba64f01312a06`；main 未变。A/B/C 子 PR 尚未由本任务合入阶段分支。

当前整合模块：A `555816780cf110fa31c927f7b19cfa0e3904e086`、B `3199b374d2cb17ddb9287bc62918507056036763`、C `9cbf25393ee16cb379bd7b2b92cc1a134dfb8b77`。共享 DTO 全部来自 owner 提交。冲突收敛采用 B 的 preview / uncertain-write 实现，撤回集成侧临时 preview 实现；Main 仅通过当前可信 window 的 ReviewContextStore 提供 `resolveReviewContext`，不把临时 contextId 当正式复盘 ID。

## 当前验证与限制

- 全项目 typecheck、全仓 ESLint、应用 build 通过。原环境缺失的 marked 按 lock 的精确版本和 SHA-512 恢复，未改 package/lock；本地 Node 24.19.0，与 CI 锁定 24.18.0 不同。
- Assistant A/B/C 聚焦单元及现有 review-reference、安装协调/gate 共 91/91 通过（含新增 fixture 5 项和 sender 生命周期 3 项）。
- 原集成 `a4b390b` 的 `assistant-journey.e2e.test.ts` 在 Linux Electron + Xorg dummy 显示器通过；发现 Playwright Linux 默认注入 `--no-sandbox`，此结果仅证明功能，不证明 sandbox。当前测试显式 `chromiumSandbox: true`，云环境启动失败，等待支持 sandbox 的环境/Windows 验证。未改 host 权限或产品安全配置。使用真实 OpenAI provider adapter、配置 IPC、会话内核、preload 和 SQLite，仅 HTTP fetch 与测试凭据保护是显式合成替身，无真实模型请求。
- 旅程实际检查三入口，复盘三字段/记录简述填草稿且业务数据不变，正式复盘 confirm 拒绝，范围统计两条/15 分钟，多轮、取消、配置变更取消、重复确认、持久恢复/删除、临时不落盘、活动请求退出 drain。
- 初次 Electron 失败是测试对目标按钮使用过窄 exact name（按钮还含状态/活动文字），已按真实 accessible name 修正；不改变产品或断言。
- 已纳入 C 的 temporary review 初始 setScope 关闭清理修复。Main sender 生命周期另外删除所属 temporary 会话，保留 persistent/其他 sender 会话，并覆盖创建应答竞态和迟到响应。
- Synthetic fixture 无条件拒绝 packaged；开发测试还要求显式 root switch、规范隔离 root/cwd/userData 和 marker，环境变量本身不能替换凭据保护。
- 安装草稿检查包含 composer/settings 的 boolean dirty；设置视图收起仍保持挂载，连接测试不被当作草稿。新增 Chromium 回归覆盖未发送阻止/清空允许、跨入口清理、设置隐藏保留/保存清除；3 项 browser 通过（默认启动，仅证明 UI 功能）。
- Linux 合成截图已检查目标/复盘/记录入口、820 原生最小窗口和 420 renderer 压力尺寸（后者低于产品窗口最小值），位于 `.tmp/assistant-visual/`。它们来自上述 Playwright 默认 sandbox 设置，仅为布局证据；双栏保留、面板可见且窄屏无横向溢出。来源详情默认展开仍偏长，候选常需纵向滚动，这是待改善的体验问题。Linux 不证明 Windows Mica/C1。
- Windows CI、安装完整回归、Mica/C1 视觉和独立集成 review 仍待实际结果。旧 Today 启动帮助暂保留兼容；不把该迁移和正式 review 写入描述为已完成。

## 接线顺序与 owner 交付

1. 接收 B 的 `src/contracts/assistant.ts` 和 A 的服务契约/provider port 的准确 commit/export；不在集成侧复制 DTO。接收父任务确认后的模块提交，记录各 head 和集成 SHA。
2. 在 `src/contracts/shell.ts` 声明具体 API，在 `src/preload/index.ts` 逐项桥接白名单 channels；`env.d.ts` 已引用 MyTracerApi，无需第二份 Window 类型。补齐现有 typed fake API 使用者，不能用 any 掩盖缺失能力。
3. Main 在数据库、clock、credential adapter 就绪后装配 A/B。A 只接受已准备的请求和配置；B 经 application queries/commands 访问记录。新 IPC 复用 `assertTrustedSender` 和 `guardedIpc`，参数由各注册器在运行时验证。
4. C 提供 Assistant host/provider 和设置组件的确切 export/props。`App.tsx`/`app/AppShell.tsx` 的集成修改由集成 owner 负责；设置入口实际在 AppShell。Assistant 覆盖层放在稳定的父级，不把正文条件分支替换为 Assistant，避免双栏/编辑器卸载。C 持有局部组件、入口和样式；全局布局由集成侧收敛。
5. 确认正常无配置运行可用，再接隔离 fake provider 的完整 Electron 旅程。禁止通过真实网络测试装配是否成功。

## 必须一起接入的生命周期

已纳入 A [PR #164](https://github.com/Fyrefly-4/MyTracer/pull/164) 的上述修复 head（含其 IPC test include 补充）。准确装配为 `createAssistantCredentialProtection(safeStorage)` → `AssistantServiceConfigurationStore({userDataPath, credentialProtection})` → `new OpenAiAssistantProvider(configuration)`。必须使用 A 的凭据包装以拒绝 basic_text；不复用旧 AI 配置。

A 的 renderer API 为 `AssistantServiceApi`：`getStatus/saveConfiguration/deleteCredential/testConnection`，channels 为 `ASSISTANT_SERVICE_CHANNELS`；预定暴露在 `window.myTracer.assistantService`，不改旧 `aiConfiguration` 的语义。Provider port 使用 `complete(request)`，请求携带 messages/tools、AbortSignal、timeoutMs/maxOutputTokens/maxResponseBytes；结果的 toolCalls 仍由 B 校验授权并执行。

`registerAssistantServiceIpc` 接受 guardedIpc、configuration、provider、assertSender、configurationChanged。返回的 `cancelConnectionTest/hasPendingConnectionTest` 供生命周期接线；配置变更回调必须调用 B 的真实取消/失效方法，不能用 no-op 占位。测试 include 已由 A 添加，集成侧不重复修改。

连接测试只属于待结束工作，不属于未保存草稿：不能把 `hasPendingConnectionTest()` 直接并入 UpdateInstallCoordinator 的 `hasPendingAiDraft`，否则初次 probe 就拒绝安装，永远无法进入内部取消。应在 cancelAiRequests 调用 cancelConnectionTest，随后由 gate drain 等待 Promise 收敛；新的用户候选/临时未保存内容继续单独受草稿保护。

- `did-start-navigation`、webContents `destroyed`、window `closed`：撤销 sender 的活动请求、预览授权和临时会话；保留本地持久会话。旧 AiStartHelpSessionStore 的 clearSender 不可直接套给新存储。
- `before-quit`：先取消新旧请求，完成必要本地会话保存后再关闭数据库；需要异步 flush 时明确处理 Electron 退出时序，不能 fire-and-forget。B 需提供取消/flush 的具体方法与错误语义。
- `UpdateInstallCoordinator` 当前只检查旧 AI draft。增加新运行/未处理候选和临时会话的丢失风险，保留现有 renderer draft probe；持久历史本身不应永久阻止安装。安装取消通过 Main 内部方法执行，不通过已锁定的 renderer IPC。
- 新 sendTurn 若返回长 Promise，会被 InstallOperationGate 计入 pending；内部取消必须让该 Promise 收敛，随后 drain 才能完成。候选正式写入及配置变更同样受 gate 保护，不绕过现有更新安全流程。
- 配置关闭、密钥删除、服务/模型切换时：使旧请求失效，不能让旧服务迟到响应落入新会话。B/A 需在接口交付时明确 revision/取消联动方式。
- 重开面板只读本地会话，不重发模型或写命令；删除会话不删正式记录。旧 Today 启动面板暂保留兼容，待新入口可用后由父任务和 C 明确迁移，避免两个入口同时执行。

## 合成验收夹具和检查顺序

`tests/support/assistant-journey-fixture.ts` 仅通过现有 MyTracerApi 建立“整理居住空间”目标、两个 partial 记录及无关目标。调用者必须先用既有 `createTemporaryTestRoot` / `minimalElectronEnvironment` 启动隔离应用；夹具本身不读取用户目录、环境密钥或建立 Assistant 类型。

| 验收段 | 应观察的结果 |
| --- | --- |
| 记录入口 | 原笔记保留，来源显示，简述候选先预览；填入编辑草稿不直接保存；输入继续变化使旧候选失效 |
| 目标入口 | 接续两个选定记录，追问“只有五分钟”，工具只读当前范围，程序统计两条/15 分钟；无关记录 sentinel 不进入 provider |
| 复盘入口 | 选定事实形成可编辑复盘字段，引用可回访；确认前正式记录零写入 |
| 保存/恢复/删除 | 重启恢复持久对话不增加请求次数；temporary 不落盘；删除不再列出且迟到响应不重建会话，正式记录保留 |
| 确认与竞争 | 过时来源/草稿拒绝，重复确认只写一次；生成候选、填入草稿、正式命令分别检查 |
| 配置与降级 | mock 保存/删除/连接测试；连通与 tools/streaming 能力分开；不配置/取消/失败仍可手工操作 |
| 退出与安装 | 活动请求取消后 gate drain 能完成，用户未保存内容继续受保护；持久历史不被误删 |

先运行新 IPC/preload/生命周期的针对性 unit/integration，再 typecheck/lint/build 和必要 Windows Electron 三入口旅程。不写虚假的通过测试或临时空实现；当前旅程验证范围见上文。Windows、视觉/键盘焦点、独立 review 均以实际结果记录。

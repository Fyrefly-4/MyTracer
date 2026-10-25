# Assistant 集成接线准备

状态：2026-10-25，A/B/C 并行实现尚未交付，本文不表示功能已完成。集成分支 `codex/assistant-integration` 从 `assistant/exploration` 的 `c4405a85d29cbe074c5814d346b832368e463a7b` 建立；基线 [PR #163](https://github.com/Fyrefly-4/MyTracer/pull/163) 保持未合并，父任务协调检查和独立 review。

## 接线顺序与 owner 交付

1. 接收 B 的 `src/contracts/assistant.ts` 和 A 的服务契约/provider port 的准确 commit/export；不在集成侧复制 DTO。接收父任务确认后的模块提交，记录各 head 和集成 SHA。
2. 在 `src/contracts/shell.ts` 声明具体 API，在 `src/preload/index.ts` 逐项桥接白名单 channels；`env.d.ts` 已引用 MyTracerApi，无需第二份 Window 类型。补齐现有 typed fake API 使用者，不能用 any 掩盖缺失能力。
3. Main 在数据库、clock、credential adapter 就绪后装配 A/B。A 只接受已准备的请求和配置；B 经 application queries/commands 访问记录。新 IPC 复用 `assertTrustedSender` 和 `guardedIpc`，参数由各注册器在运行时验证。
4. C 提供 Assistant host/provider 和设置组件的确切 export/props。`App.tsx`/`app/AppShell.tsx` 的集成修改由集成 owner 负责；设置入口实际在 AppShell。Assistant 覆盖层放在稳定的父级，不把正文条件分支替换为 Assistant，避免双栏/编辑器卸载。C 持有局部组件、入口和样式；全局布局由集成侧收敛。
5. 确认正常无配置运行可用，再接隔离 fake provider 的完整 Electron 旅程。禁止通过真实网络测试装配是否成功。

## 必须一起接入的生命周期

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

先运行新 IPC/preload/生命周期的针对性 unit/integration，再 typecheck/lint/build 和必要 Windows Electron 三入口旅程。接线前不写虚假的通过测试或临时空实现；本准备批没有完整应用行为可供验收。Windows、视觉/键盘焦点、独立 review 均以实际结果记录。

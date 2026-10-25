# Assistant B：会话与确认内核接线

基于 issue #161 与探索启动授权。共享 DTO 首次提交 `400cb2b`，`src/contracts/assistant.ts`；执行端口直接引用 A 的 `src/application/ports/assistant-provider.ts`（A 首次契约提交 `6d21253`），没有另建 provider 类型。B 分支不合其他工作线；必须先由集成 owner 将 A 契约纳入阶段分支，再整合 B。单独检查 B 时可将 A 的该文件原样取出作为未提交验证依赖。

## 已实现

- Main 持有本地 persistent / temporary 会话，独立 JSON v1 原子替换文件，不修改业务 schema、不进入产品导出；临时会话无存储调用。
- 只在显式 sendTurn 调用服务；恢复只读本地对话，不恢复运行或预览，不重放请求/命令。删除取消请求；忽略迟到结果。sender/configuration/install 清理取消请求，保留持久会话。
- 默认当前对象；显式选择与目标/日期过滤结果的并集为范围。过滤和版本验证在 Application 执行，provider 没有 repository。主进程仅发送明确字段投影，不发送 snapshot。来源以主进程注入 SHA-256 内容指纹关联，含实际字段、草稿标签、逐来源截断。
- findRecords / readGoal / getStatistics 为真实只读执行。统计只覆盖返回的有界来源，含 omittedCount；未知时长单列，不把缺记录计为 not_done。
- 单回合最多 3 次工具调用、30 秒、24,000 工具/模型输出字符、4 个候选；最多取 8 个初始保存来源和 1 个当前草稿，每来源 2,000 字符。最近最多 6 条历史，省略数可见；作用域改变后保留本地旧消息，但不再发送旧范围历史。最多 100 个会话、每会话 100 消息、1,000 条确认日志，超限明确拒绝，不静默清理。
- 候选引用必须存在于实际 manifest；scope、来源版本、目标版本、候选类型都重新验证。确认只接收 Main 保存的 previewId 和 operationId。预览修改使旧预览失效；成功回执可跨重启去重。
- summary / note-append 复用 DataControlService，action-create 复用 ActionService 且不设为下一步。复盘三个字段已分型，可填入草稿；正式 review-draft 确认返回 unsupported，必须继续使用既有 review context/complete 路径。

## 集成 owner 的精确接线

不要复制 B 的共享 DTO。C 使用 `AssistantApi` 的 10 个方法，返回现有 Result 形状。候选内容位于 `candidate.payload` 的判别联合；`previewWrite` 传完整编辑后的 payload，不是 editedText。`getRun({sessionId,requestId})` 支持查询受控过程和预算；首次执行在第一次 await 前建立 run。

```ts
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { AssistantSessionService } from '../application/assistant/service'
import { createAssistantWriter } from '../application/assistant/writes'
import { FileAssistantSessionStore } from '../infrastructure/assistant/session-store'
import { registerAssistantIpc } from './assistant-ipc'

// readSnapshot 使用现有完整核心快照查询，provider 永远接触不到这个函数。
const assistantStore = new FileAssistantSessionStore(join(userDataPath, 'assistant'))
const assistantSessions = new AssistantSessionService({
  store: assistantStore,
  provider: assistantProvider, // A 的 AssistantProviderPort 实例
  readSnapshot,
  fingerprint: value => createHash('sha256').update(value).digest('hex'),
  generateId: randomUUID,
  now: () => clock.snapshot().instant,
  write: createAssistantWriter({ readSnapshot, dataControl, actions })
})
registerAssistantIpc({
  ipc: ipcMain,
  service: assistantSessions,
  assertSender,
  operationGate: installOperationGate
})
```

- shell/MyTracerApi 增加 `readonly assistant: AssistantApi`。
- preload 从 `ASSISTANT_CHANNELS` 为每个方法暴露具体 invoke；listSessions 无参数，其余一参。禁止任意 channel 桥。
- IPC 自动在 sender destroyed 时取消该 sender 接触过的会话；返回的 `disposeSender(senderId)` 可用于显式窗口更换。不得调用删除会话代替取消。
- A 配置保存/禁用/删除前调用 `assistantSessions.cancelAll()`，阻断旧 provider 请求；A 自身也应取消连接测试。
- 安装 preparation 先关闭 gate，再 `assistantSessions.cancelAll()`，随后 `await installOperationGate.drain(signal)`；成功 drain 后 `assistantSessions.flush()`，再 seal/安装。所有 Assistant IPC（cancel 除外）已通过 gate.run 跟踪。
- 退出时先取消并等待 gate drain，然后 flush。`hasPendingOperations()` 表示当前正在结算的回合，不代表保存对话需要删除。
- 候选填入编辑草稿时 C 必须比对 entry.editorRevision 与当前编辑器版本；B 正式保存版本检查不能替代未保存草稿检查。新的草稿上下文目前通过新建会话提供。

## 失败窗口与边界

确认日志与核心业务数据库不是同一事务：先 fsync intent 再同步调用既有应用命令，最后写 receipt。命令后到 receipt 落盘前崩溃会留下 `operation-uncertain`，拒绝自动重试。它保证不重复写，但不能宣称该窗口内已知最终结果；用户需检查目标。正式复盘写入、设为下一步、流式 token UI、跨进程并发共享存储均未实现。损坏存储 fail-closed，不自动清空或覆盖。

整合后必须核实真实 sender/origin 策略、退出/更新安装协调与 C 的 editorRevision 检查。B 不修改 main/index、preload、shell、AppShell/App、全局样式或 workflows。Windows Electron 旅程和视觉验收由集成阶段执行，Linux 单元结果不替代这些检查。

## Provider 最终消息协议与本地验证

B 使用 A 的 `complete` 端口，tools 为结构化 function definitions，tool result 消息带 toolCallId。最终 `response.text` 必须为以下 JSON；原始模型结果不直接进入 UI：

```json
{
  "text": "建议从一小角开始（建议，不是已写入的事实）。",
  "sourceRefs": [{ "kind": "action-record", "id": "record-id" }],
  "candidates": [
    {
      "target": { "kind": "action-record", "id": "record-id" },
      "sourceRefs": [{ "kind": "action-record", "id": "record-id" }],
      "payload": { "kind": "record-summary", "text": "已整理桌面的一角" }
    }
  ]
}
```

Provider 无工具输出时步骤保持空数组，不伪造查询历史。仅回传普通文本/不遵守最终 JSON 协议会返回 invalid-response 并保留用户输入。当前没有自动改换服务或工具失败后的隐式重新请求。

本地验证采用 A `6d21253` 的端口文件作为未提交编译依赖；TypeScript 全项目检查通过，B 文件 ESLint 通过，聚焦合成单元测试通过。安装环境最初缺 marked；锁文件中的 npmmirror 下载返回 403。临时 `/tmp` 安装仅把 tarball URL 换至 npm 官方源，保留锁定版本与 integrity，未修改仓库 package/lock。环境 Node 24.19.0 / npm 11.9.0 与声明 24.18.0 / 11.16.0 不同；未运行 Windows Electron、全量 CI 或真实模型。

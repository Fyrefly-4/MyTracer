# MyTracer v0.1 工程决策记录

> 文档状态：v0.1 最终架构基线（工程决策已批准）  
> 批准日期：2026-08-07  
> 批准者：项目所有者  
> 范围：ED-001～ED-019；推荐方案已通过本轮架构讨论确认

## 1. 使用规则

- 本文记录现行工程决定、主要替代方案和取舍，不修改冻结产品语义。
- 改变 ED-001～019 时必须先评估受影响架构、数据迁移、测试和任务，并同步相关文档。
- 具体依赖版本、测试框架和首个 AI Provider 尚未批准；安装或绑定前仍需项目所有者明确授权。
- 延期能力不能通过工程决定进入 v0.1。

## 2. 运行与技术边界

### ED-001 产品形态

- **决定**：Windows 本地 Electron 桌面应用。
- **替代方案**：Tauri、localhost Web、纯浏览器/PWA。
- **理由**：保持 React/TypeScript 开发效率、双击日常使用、Main Process 本地权限边界；暂不引入 Rust。
- **风险**：包体和运行占用较大；Electron/Chromium/Node 需要持续安全更新。

### ED-002 前端技术栈

- **决定**：React + TypeScript + Vite。
- **约束**：内容模型保持领域中立，不创建 React 教学专属功能；具体 UI/状态库需另行批准依赖。
- **风险**：避免为展示技术引入大型状态管理或组件平台。

### ED-003 本地存储

- **决定**：SQLite；不使用本机 MySQL 作为 v0.1 主存储。
- **理由**：单用户本地、无独立服务、事务和关系约束足够、适合应用私有单文件。
- **替代方案**：MySQL、IndexedDB、版本化 JSON。
- **风险**：原生驱动需与 Electron ABI 和打包产物共同验证。

### ED-004 Main/Preload/Renderer 职责

- **决定**：Renderer 只负责 React UI；Preload 只暴露白名单类型化 API；Main 承载 Application、Domain、SQLite、导出和 AI。
- **禁止**：Renderer Node integration、直接 SQL、任意 IPC channel、任意文件路径、明文 AI 密钥。
- **理由**：领域不变量和事务只有一个可信执行入口。

## 3. 领域与数据决定

### ED-005 Goal 当前下一步

- **决定**：`Goal.currentNextActionId` 引用同一 Goal 下的 pending Action，可空。
- **行为**：创建 Goal 时填写下一步会在同一事务创建 Action 并建立引用；Action 完成、取消或重新安排时由用户确认替代项或清空。

### ED-006 Action/Routine 与 Goal

- **决定**：Action 和 Routine 的 `goalId` 均可空；被 Goal 指定为当前下一步的 Action 必须关联该 Goal。
- **理由**：允许 AC-04 等轻量意向/例行独立存在，不创建隐藏默认 Goal。

### ED-007 Action 重新安排

- **决定**：复用原 Action。操作后状态为 `rescheduled` 并移出 Today；用户再次选入时恢复 `pending`。
- **禁止**：自动创建替代 Action、未来日期、截止日期或复杂日程。

### ED-008 删除及关联

- **决定**：影响预览、二次确认、事务性硬删除；不建立回收站。
- **级联**：Action → ActionRecord/TodaySelection；Routine → RoutineRecord/schedule days；Goal → Action/ActionRecord。
- **解除关联**：Goal 删除时保留 Routine 和 ReviewResult，并清空其 `goalId`。
- **约束**：pause/end 永远保留历史；被硬删除数据不进入后续导出。

### ED-009 Routine 节奏

- **决定**：周一至周日的星期集合，提供“每天”“工作日”快捷输入。
- **延期**：隔周、每 N 天、任意表达式和通用规则引擎。

### ED-012 时间单位

- **决定**：非负整数分钟；0 表示少于一分钟但确有行动，UI 显示“少于 1 分钟”。
- **约束**：是否行动由 Record outcome 决定，不能用时长推断。

### ED-013 长期未推进

- **决定**：不设置自动阈值；显示“距上次真实行动 N 天”，由用户判断。
- **理由**：提供事实而不制造停滞标签或逾期压力。

### ED-014 导出

- **决定**：UTF-8 JSON，通过系统保存对话框选择位置；默认名 `mytracer-export-YYYY-MM-DD-v1.json`。
- **约束**：完整核心数据及版本必须包含；凭据、AI 草稿和技术日志排除；自动导入延期。

### ED-015 ID 与排序

- **决定**：Main Process 使用 `crypto.randomUUID()` 生成 UUID v4。
- **排序**：显式使用 LocalDate、createdAt、ID，不依赖 UUID 隐含顺序。

### ED-016 Action Record 计次

- **决定**：每条有效 ActionRecord 分别计为一次“记录到的行动”；同日多条不合并。
- **约束**：Progress 文案不得把它描述为完成任务数或掌握度。

### ED-017 跨午夜

- **决定**：表单打开时固定发生日；跨午夜保存时要求用户选择保留原日期或改为今天。
- **禁止**：静默移动历史发生日。

## 4. AI 决定

### ED-010 AI 请求与密钥

- **决定**：仅 Electron Main 发起请求；打包使用时以 `safeStorage` 加密密钥并把密文保存到独立配置文件；开发环境变量可覆盖。
- **隔离**：密钥不进入 Renderer、SQLite、导出、普通日志或测试 fixture。
- **降级**：密钥或 safeStorage 不可用时 AI 视为未配置，基础能力继续运行。

### ED-011 Provider 与上下文预算

- **决定**：Provider 接口可替换；最多最近 5 条直接相关 Record；返回 1～3 条建议；本次会话输入只存内存。
- **写入**：接受/修改后创建关联当前 Goal 的 pending Action 并设为当前下一步；Provider 不直接写数据。
- **实现期选择**：首个 Provider、模型、SDK、环境变量名和总字符/令牌预算需另行批准。

## 5. Electron 与 SQLite 实现决定

### ED-018 SQLite 驱动

- **决定**：Main Process 使用 `better-sqlite3`，手写参数化 SQL、Repository 和顺序 migration；不引入 ORM。
- **理由**：事务 API 简单且成熟；Node 内置 `node:sqlite` 在决策时仍为 Release Candidate。
- **验证**：安装后必须验证开发模式、迁移、重开和 Windows 打包产物；Electron 升级时重新验证原生模块 ABI。

### ED-019 Electron 安全基线

- **决定**：`nodeIntegration: false`、`contextIsolation: true`、Renderer sandbox、限制性 CSP、仅本地打包内容、禁止任意导航/新窗口、校验 IPC sender。
- **Preload**：只暴露具体 Command/Query 方法，不暴露 `ipcRenderer`、Electron 对象、SQL 或文件路径。
- **版本**：工程初始化选择受支持的当前 Electron 版本；升级按单一 major 逐步验证。

## 6. 尚未批准但不阻塞架构的实现选择

以下选择必须在安装依赖或接入厂商前批准，但不改变架构：

1. Electron、React、Vite、better-sqlite3 的确切版本；
2. 包管理器、Electron 打包/脚手架工具；
3. 单元、集成和 E2E 测试框架；
4. UI 组件、表单和运行时校验依赖；
5. 首个 AI Provider、模型、SDK、超时和文本预算；
6. CI 已决定在 S0 启用且 Windows 为必需环境；具体 workflow、check 名称、Node 版本和命令仍需随工具链批准并在 T002 固定。

这些选择不得引入延期功能、改变数据语义或扩大 AI 权限。

## 7. 审批结论

- ED-001～019：已批准。
- GW-001～010：已在 `docs/implementation/GITHUB_WORKFLOW_V0.1.md` 作为开发流程基线批准，不改变产品或架构语义。
- 架构阶段门 G1：通过。
- 需求冲突：未发现。
- 范围变化：无。
- 下一阶段：在依赖清单获得批准后进入 S0 工程基础。

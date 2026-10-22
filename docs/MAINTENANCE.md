# MyTracer 维护入口

日常工作从当前代码、测试和以下操作说明开始。只读取当前事项需要的资料；历史任务与验收记录不构成普通修复的启动条件。工作范围与权限见 [AGENTS.md](../AGENTS.md)。

## 按事项查找

| 我要做什么 | 从哪里开始 |
| --- | --- |
| 在本地运行应用 | [README 本地运行](../README.md#本地运行) |
| 构建、验证或生成 Windows 安装包 | [开发与验证](#开发与验证) |
| 定位故障并修改代码 | 先读相关代码和测试；涉及行为时按需核对[产品需求](PRODUCT_REQUIREMENTS_V0.1.md)、[产品决定](DECISIONS.md)和[变更规则](REQUIREMENTS_CHANGE_POLICY.md) |
| 理解模块、数据、删除、日期或 AI 边界 | [架构入口](architecture/README.md) |
| 配置或轮换更新凭据、处理更新失败 | [更新与凭据维护](maintenance/UPDATE.md) |
| 管理发布 PR、打包与私有更新 | [发布维护](maintenance/RELEASE.md) |
| 创建分支、提交或 PR；理解 CI | [GitHub 日常工作流](implementation/GITHUB_WORKFLOW_V0.1.md) |

## 开发与验证

首次启动步骤见 [README](../README.md#本地运行)。以下命令在仓库根目录运行，实际脚本与锁定版本以 `package.json` 和 `package-lock.json` 为准。

| 目的 | 命令 |
| --- | --- |
| 构建 Main、Preload 和 Renderer | `npm.cmd run build` |
| 生成 Windows x64 unsigned NSIS installer 与 unpacked 包 | `npm.cmd run package` |
| 只读格式检查 | `npm.cmd run format:check` |
| 检查代码规范与分层依赖 | `npm.cmd run lint` |
| 类型检查 | `npm.cmd run typecheck` |
| 单元测试 | `npm.cmd run test:unit` |
| 集成测试 | `npm.cmd run test:integration` |
| 构建并运行 Electron E2E | `npm.cmd run test:e2e` |
| 完整应用聚合验证 | `npm.cmd run verify` |

按变更影响面选择本地验证，不因查阅本页要求每次运行全部命令。`verify` 包含 E2E 所需构建，不包含安装依赖、打包、真实安装或 live AI。构建输出位于 `out/`，打包输出位于 `release/`；构建通过不等于人工验收通过。

Electron E2E 需要可启动 Windows 桌面进程的环境。测试使用唯一临时数据库/数据根，日期边界使用 fake Clock，常规 AI 测试使用 fake Provider；不得触碰真实用户数据。风险与测试层级参考[测试策略](architecture/TEST_STRATEGY_V0.1.md)。

## 页面阅读选择

今天、目标和数据页保持原有双栏及独立滚动。普通进入页面时，只在当前列表结果（目标与记录含当前分页）内恢复上次查看项；找不到时查看首项。首页等明确链接优先打开指定内容；新建、保存或状态调整的结果保持可见，不被列表刷新抢走。空结果提供新建、补记提示或清除筛选入口。

阅读偏好仅在 Renderer 的 `localStorage` 键 `mytracer.viewed-selection.v1` 保存页面、类型和 ID，不保存正文、草稿或业务数据。重启时校验结构，并由页面查询验证可用性；临时空结果不清除记忆，存储不可用时退回当前会话。自动选择不调用写入命令，创建/编辑/记录草稿及确认操作会阻止自动切换。

## 产品与操作边界

保留目标、行动、例行、记录和 AI 确认写入的既有语义。产品范围、依赖、数据迁移及权限变化按当次授权和根 AGENTS 处理；普通维护不创建 Txxx 合同、不激活 Profile、不回写阶段验收账本。

当前包的签名、兼容来源和发布状态需核对确切产物及来源；导出不提供自动导入或一键恢复。执行发布或跨分支集成前实时核对远端，不使用旧部署快照推定当前状态。

## 历史追溯

只有需要查证既有技术决定、交付来源、失败、豁免或人工回报时，才进入[历史归档索引](implementation/archive/INDEX.md)。其中的旧任务状态、精确 revision、批准和证据均按原日期解释，不授予新工作的权限。

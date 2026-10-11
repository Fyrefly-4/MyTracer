# MyTracer 维护入口

从这里查找当前状态、日常维护方法和变更依据。具体操作以链接文档为准；任务状态、精确 revision、CI 和人工验收分别由任务索引与证据账本维护。

## 维护概况

一期已具备目标、行动、例行、记录、进展、恢复、复盘、AI 启动帮助和本地数据控制，后续功能变更尚未确定。

截至 2026-10-11 的核验：S7/S8 已晋升 main；剩余真实更新故障及实装矩阵获 owner 明确豁免，保留为未执行风险。现有 `v0.1.4` 是演练发布，首次正式更新发布未执行；owner tag 发布改造仅进入 dev，main 尚未部署。精确来源和后续核验见[事实校准证据](implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)。执行新的发布或集成前应重新核对远端。

当前包未签名，导出不提供自动导入或一键恢复。当前应用版本与工具链以 [package.json](../package.json) 和 [package-lock.json](../package-lock.json) 为准；交付状态看[任务索引](implementation/TASK_INDEX_V0.1.md)，实际验证、豁免和限制看[验收证据](implementation/ACCEPTANCE_EVIDENCE_V0.1.md)。

## 按事项查找

| 我要做什么 | 从哪里开始 |
| --- | --- |
| 在本地安装依赖并启动开发应用 | [README 本地运行](../README.md#本地运行) |
| 构建、验证或生成 Windows 安装包 | [开发与验证](#开发与验证) |
| 配置、轮换或撤销客户端更新凭据；处理更新失败 | [更新与凭据维护](maintenance/UPDATE.md#凭据配置) |
| 审核候选产物、准备私有发布 | [私有发布维护](maintenance/RELEASE.md)；先确认其中的 main/dev 部署差异 |
| 理解数据、删除、迁移和导出边界 | [数据设计](architecture/DATA_DESIGN_V0.1.md)、[领域模型](architecture/DOMAIN_MODEL_V0.1.md) |
| 理解 AI 配置、上下文、确认和降级边界 | [AI 边界](architecture/AI_BOUNDARY_V0.1.md)、[Provider 批准证据](implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-t062-001) |
| 判断某个功能的范围和行为 | [产品需求](PRODUCT_REQUIREMENTS_V0.1.md)、[产品决定](DECISIONS.md) |
| 定位需求对应的模块与验证 | [需求追踪矩阵](architecture/REQUIREMENTS_TRACEABILITY_V0.1.md) |
| 理解技术边界和已批准选型 | [总体架构](architecture/ARCHITECTURE_V0.1.md)、[工程决定](architecture/ENGINEERING_DECISIONS_V0.1.md) |
| 检查任务是否完成，核对真实验证 | [任务索引](implementation/TASK_INDEX_V0.1.md)、[验收证据](implementation/ACCEPTANCE_EVIDENCE_V0.1.md) |
| 准备新的变更、分支或 PR | [开始变更前](#开始变更前) |
| 查找旧合同、阶段来源和失败记录 | [历史追溯](#历史追溯) |

## 开发与验证

首次启动步骤见 [README](../README.md#本地运行)。以下命令在仓库根目录运行，具体脚本以 [package.json](../package.json) 为准。

| 目的 | 命令 |
| --- | --- |
| 构建 Main、Preload 和 Renderer | `npm.cmd run build` |
| 生成 Windows x64 unsigned NSIS installer 与 unpacked 包 | `npm.cmd run package` |
| 只读格式检查 | `npm.cmd run format:check` |
| 检查代码规范与分层依赖 | `npm.cmd run lint` |
| 类型检查 | `npm.cmd run typecheck` |
| 单元测试 | `npm.cmd run test:unit` |
| 集成测试 | `npm.cmd run test:integration` |
| 构建并运行真实 Electron E2E | `npm.cmd run test:e2e` |
| 必需的聚合验证，包含上述格式、lint、类型及测试检查 | `npm.cmd run verify` |
| 校验任务元数据与流程配置 | `npm.cmd run governance:metadata:check` |

构建输出位于 `out/`，打包输出位于 `release/`。`verify` 包含 E2E 所需构建，不包含打包、真实安装或 live AI 测试；构建通过不等于人工验收通过。

Electron E2E 需要可启动 Windows 桌面进程的环境。数据测试必须使用唯一临时数据根，不得指向真实用户数据库；日期边界使用 fake Clock，常规 AI 测试使用 fake Provider。验证层级与证据要求见[测试策略](architecture/TEST_STRATEGY_V0.1.md)和 [Agent 工作规约](../AGENTS.md#9-validation-and-evidence)。

## 开始变更前

1. 先核对[产品需求](PRODUCT_REQUIREMENTS_V0.1.md)、[产品决定](DECISIONS.md)和[需求变更规则](REQUIREMENTS_CHANGE_POLICY.md)，确认变更范围与批准依据。需求和验收语义的调整须由 owner 决定。
2. 阅读相关架构与[工程决定](architecture/ENGINEERING_DECISIONS_V0.1.md)，用[需求追踪矩阵](architecture/REQUIREMENTS_TRACEABILITY_V0.1.md)定位受影响范围。原[实施计划](architecture/IMPLEMENTATION_PLAN_V0.1.md)说明历史切片安排，不启动新任务。
3. 核对[任务索引](implementation/TASK_INDEX_V0.1.md)及最新证据。实施任务使用[任务合同模板](implementation/TASK_TEMPLATE.md)，Agent 按[仓库规约](../AGENTS.md)工作；本入口不代替具体授权。
4. Git、PR 和 CI 按[GitHub 工作流](implementation/GITHUB_WORKFLOW_V0.1.md)执行。下一次里程碑集成须核对已记录的[祖先关系差异](implementation/ESCALATION_DOC_BRANCH_ANCESTRY.md)；合并、推进 main、tag 和发布仍需相应 owner 授权。

## 历史追溯

当前操作先看上方入口。需要还原某次交付时，再按以下顺序追溯：

- **任务索引**说明当前任务状态，并指向相应证据。
- **验收证据**保留精确来源、命令、环境、结果、失败、豁免与人工回报。候选通过、最终 CI、dev 集成、main 晋升和发布是不同事实。
- **合同和执行记录**说明当时批准的范围与步骤。旧 active、review、pending 或执行授权按其记录日期理解，不能直接作为当前状态或新授权。
- **阶段归档**总结已完成开发范围并提供 Git 恢复入口；需要完整旧合同才从历史恢复。

统一从[历史归档索引](implementation/archive/INDEX.md)进入 S0～S8、工程治理、历史提案与 UX 记录。索引同时列出本批完整合同和阶段程序的精确 Git 恢复路径；维护入口不重复阶段目录。

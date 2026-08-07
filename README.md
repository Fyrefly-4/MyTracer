# MyTracer

MyTracer 是一个面向个人本地使用的 Windows 桌面应用，用于帮助用户保存目标、选择下一步、记录真实行动、处理中断并进行轻量复盘。v0.1 强调事实记录、非惩罚语义、本地数据控制和可拒绝的 AI 启动帮助。

## 当前状态

- v0.1 产品需求基线已冻结。
- 架构阶段门 G1 已通过。
- Electron、React、TypeScript、Vite、SQLite 和 `better-sqlite3` 的架构方向已批准。
- 仓库级 Agent 规约、任务管理、验收证据和 GitHub 工作流已形成文档基线。
- 正式工程初始化尚未开始，仍需批准具体依赖、版本、工具链和首个 AI Provider。
- 当前仓库没有可运行应用，也不存在已经验证的安装、开发、测试或打包命令。

不要把架构完成理解为产品已经实现。

## 已批准的总体架构

```text
Electron Renderer (React UI)
        ↓ narrow typed API
Electron Preload
        ↓ validated IPC
Electron Main
        ├─ Application
        ├─ Domain
        ├─ SQLite / better-sqlite3
        ├─ Export
        └─ Replaceable AI adapter
```

核心约束：

- Renderer 不直接访问 Node、SQLite、文件系统、凭据或 AI Provider。
- Domain 不依赖 Electron、React、SQLite 或具体 AI SDK。
- AI 只能由用户主动触发，未经确认不能修改核心数据。
- AI 不可用时，Goal、Action、Routine、Record、Progress、Review 和导出仍可使用。
- v0.1 不实现账号、同步、通知、复杂日历、评分、掌握度或 AI 主动监督。

## 文档入口

### 产品基线

- [`docs/PRODUCT_REQUIREMENTS_V0.1.md`](docs/PRODUCT_REQUIREMENTS_V0.1.md)：冻结需求、FR 和 AC。
- [`docs/DECISIONS.md`](docs/DECISIONS.md)：冻结产品决定。
- [`docs/REQUIREMENTS_CHANGE_POLICY.md`](docs/REQUIREMENTS_CHANGE_POLICY.md)：需求变更权限和流程。

### 架构基线

- [`docs/architecture/ARCHITECTURE_V0.1.md`](docs/architecture/ARCHITECTURE_V0.1.md)：总体边界和依赖方向。
- [`docs/architecture/DOMAIN_MODEL_V0.1.md`](docs/architecture/DOMAIN_MODEL_V0.1.md)：领域模型、状态和不变量。
- [`docs/architecture/DATA_DESIGN_V0.1.md`](docs/architecture/DATA_DESIGN_V0.1.md)：SQLite、日期、删除、迁移和导出。
- [`docs/architecture/AI_BOUNDARY_V0.1.md`](docs/architecture/AI_BOUNDARY_V0.1.md)：最小上下文、确认和降级。
- [`docs/architecture/TEST_STRATEGY_V0.1.md`](docs/architecture/TEST_STRATEGY_V0.1.md)：测试层级和验收策略。
- [`docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md`](docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md)：FR、AC、D 的实现与测试落点。
- [`docs/architecture/IMPLEMENTATION_PLAN_V0.1.md`](docs/architecture/IMPLEMENTATION_PLAN_V0.1.md)：S0～S7 纵向切片。
- [`docs/architecture/ENGINEERING_DECISIONS_V0.1.md`](docs/architecture/ENGINEERING_DECISIONS_V0.1.md)：ED-001～ED-019。

### Agent 与实施管理

- [`AGENTS.md`](AGENTS.md)：Codex 和其他 Agent 必须遵守的仓库规约。
- [`docs/implementation/TASK_INDEX_V0.1.md`](docs/implementation/TASK_INDEX_V0.1.md)：任务状态的唯一账本。
- [`docs/implementation/TASK_TEMPLATE.md`](docs/implementation/TASK_TEMPLATE.md)：单个任务合同模板。
- [`docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`](docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md)：验证和人工验收证据。
- [`docs/implementation/GITHUB_WORKFLOW_V0.1.md`](docs/implementation/GITHUB_WORKFLOW_V0.1.md)：分支、worktree、PR、CI、合并和发布权限。

### 项目所有者与用户阅读

- [`user/MYTRACER_V0.1_DEVELOPMENT_PROCESS.md`](user/MYTRACER_V0.1_DEVELOPMENT_PROCESS.md)：项目所有者视角的开发流程说明。
- [`user/MYTRACER_V0.1_USER_GUIDE.md`](user/MYTRACER_V0.1_USER_GUIDE.md)：v0.1 预期使用方式。

`user/` 中的文件是方便人阅读的说明，不是 Agent 或工程实现的规范性依赖。

## 开发和验证命令

工程尚未初始化。以下命令类别需要在 S0 建立，但当前没有已批准或已验证的具体命令：

- 安装；
- 开发启动；
- 格式检查；
- lint；
- TypeScript 类型检查；
- 单元测试；
- SQLite/应用集成测试；
- Electron E2E；
- 聚合验证；
- Windows 构建和打包。

S0 完成后必须同时更新本节、`AGENTS.md`、CI 和任务模板，确保所有位置引用相同命令。

## GitHub 工作方式

MyTracer 使用轻量 `dev` 集成流：

```text
task/Txxx-short-name
  → Draft PR to dev
  → task verification and owner-approved squash merge
  → milestone PR from dev to main
  → full acceptance and owner-approved merge commit
  → tag/release on main
```

- `main` 表示已验收里程碑。
- `dev` 表示当前集成版本。
- 一个任务对应一个任务分支或 Codex worktree。
- Agent 不直接推进 `main`，也不自动合并、打 tag 或发布。
- 当前文档描述目标流程，不代表 GitHub 远端、保护规则或 Actions 已经配置。

完整规则见 [`GITHUB_WORKFLOW_V0.1.md`](docs/implementation/GITHUB_WORKFLOW_V0.1.md)。

## 下一步

1. 提交并批准最小依赖与版本清单。
2. 按 `T001`～`T004` 建立 S0 工程基础。
3. 固定真实的本地和 CI 验证命令。
4. 验证 Electron 安全边界、SQLite 重开和 Windows 原生模块打包。
5. 通过 G2 后进入 Goal—Action—Record—Progress 最小闭环。

在这些条件完成前，不得声称 MyTracer Demo 已经可运行或通过验收。

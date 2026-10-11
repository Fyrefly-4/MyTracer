# MyTracer

MyTracer 是一个面向个人本地使用的 Windows 桌面应用，用于帮助用户保存目标、选择下一步、记录真实行动、处理中断并进行轻量复盘。v0.1 强调事实记录、非惩罚语义、本地数据控制和可拒绝的 AI 启动帮助。

## 当前状态（2026-10-11 核验）

- 当前 dev 为 `93fc14c1edfc93dafdb9357204dae08c349a8734`，main 为 `97667606d1f21bbcece7705387cb1929d9ca6d47`；两者应用版本均为 0.1.4，schema 3、export 2。
- 已具备 Goal、Action、Routine、记录、事实型 Progress、中断恢复、轻量 Review、用户主动 AI 启动帮助、数据修改/删除/导出及确认更新安装路径。AI Provider 当前使用可替换的 LiteLLM Gateway。
- S4/S5 和 S6 已分别形成已发布的 `v0.1.0-beta.2`、`v0.1.0-beta.3`；S7/S8 通过 PR #62 进入 main。任务完成状态只见任务索引，验收、豁免和 CI 只见证据账本。
- `v0.1.4` 私有 Release 是 owner 授权的更新演练；不是正式 accepted-main 发布。剩余真实故障及实装矩阵已获 owner 明确豁免，未执行且接受风险，不能记作测试通过。
- Owner tag 发布改造已通过 PR #64 进入 dev，尚未进入 main。main 当前仍保留旧 dispatch workflow；新流程部署和首次真实正式发布待分别完成，不把 dev 工具的通过测试当作 main 已部署。
- 当前 Windows 包未签名；导出不等于具备导入/一键恢复；账号、同步、后台提醒及其他延期功能仍不在本版范围。

精确任务交付/集成 revisions、最终 CI、发布入口和 Git 历史差异见 [事实校准证据](docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)。

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

## 开发和验证命令

当前工具链使用 Node.js 24.18.0 和 npm 11.16.0。依赖和 Electron 二进制首次还原需要网络访问；核心自动化不访问 live AI Provider。

```powershell
npm.cmd ci
npm.cmd exec -- install-electron --no
npm.cmd run dev
npm.cmd run build
npm.cmd run package
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
```

- `dev`：启动 Electron 开发应用；
- `npm.cmd exec -- install-electron --no`：使用 `node_modules` 中精确锁定的 Electron 包恢复对应二进制；Electron 43 改为首次使用时按需下载，因此干净 `npm ci` 后和 CI 中显式执行；
- `build`：构建 Main、Preload 和 Renderer 到 `out/`；
- `package`：重新构建并生成 Windows x64 unsigned NSIS installer 和 `win-unpacked` 到 `release/`。
- `format:check`：只读检查合同范围内受 Prettier 管理的文件；人工修复使用显式 `npm.cmd run format`，CI 不调用写入命令；
- `lint`：以零 warning 运行 ESLint flat config，并检查进程/分层依赖边界；
- `typecheck`：以 TypeScript project references 检查生产源码、测试和工具配置；
- `test:unit`、`test:integration`：分别运行 Vitest unit 和 integration project；
- `test:e2e`：先构建，再用 Playwright Electron API 和唯一临时 `userData` 启动真实应用；
- `verify`：依次运行只读 format、lint、typecheck、unit、integration 和含 build 的 E2E，是本地与 CI 的聚合门禁。

Electron E2E 必须在可启动 Windows 桌面进程的环境运行；所有自动化数据均位于 OS 临时目录下的每测试唯一根，不得指向真实 Electron `userData`。`build`、`package` 或 T002 单独通过都不表示 AC-01～AC-07 或 G2 已通过。

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
- GitHub 远端、PR template、分层 Actions 和 `dev`/`main` active rulesets 已配置；full/milestone 验证汇总为统一 `CI Gate`，实时运行状态以 GitHub 为准。

完整规则见 [`GITHUB_WORKFLOW_V0.1.md`](docs/implementation/GITHUB_WORKFLOW_V0.1.md)。

## 维护入口

- 当前任务和阶段状态：[任务索引](docs/implementation/TASK_INDEX_V0.1.md)；历史验证和未执行风险：[验收证据](docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md)。
- 客户端只读凭据配置、轮换、撤销和备用原位安装：[更新源操作](docs/implementation/T082_UPDATE_SOURCE_OPERATIONS.md)。
- 候选构建、当前 main/dev 发布流程差异和 owner 发布步骤：[发布操作](docs/implementation/T084_RELEASE_OPERATIONS.md)。
- 后续 Git 集成须先核对 [GW-005/GW-006 历史差异](docs/implementation/GITHUB_WORKFLOW_V0.1.md#已发现的里程碑历史差异2026-10-11)，不得用内容相同推断祖先关系。

本次整理只校准事实，不启动下一任务、不改变需求/验收语义，也不授予 Ready、合并、tag 或 release 权限。

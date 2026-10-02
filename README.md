# MyTracer

MyTracer 是一个面向个人本地使用的 Windows 桌面应用，用于帮助用户保存目标、选择下一步、记录真实行动、处理中断并进行轻量复盘。v0.1 强调事实记录、非惩罚语义、本地数据控制和可拒绝的 AI 启动帮助。

## 当前状态

- v0.1 产品需求基线已冻结。
- 架构阶段门 G1 和工程阶段门 G2 已通过。
- Electron、React、TypeScript、Vite、SQLite 和 `better-sqlite3` 的架构方向已批准。
- 仓库级 Agent 规约、任务管理、验收证据和 GitHub 工作流已形成文档基线。
- T001 已建立可运行的 Electron Main/Preload/Renderer 空壳、Today/Progress/Review 占位入口和安全 IPC 边界。
- T001 已固定安装、开发、构建和 Windows x64 unsigned NSIS 打包命令；真实结果记录在验收证据中。
- T002 已建立精确锁定的 format、lint、typecheck、unit、integration、Electron E2E 和 Windows CI 验证入口，以及测试专用 FakeClock、FakeAiProvider 和临时数据根。
- T003 已建立 SQLite schema、migration、Repository 契约和 Windows x64 原生模块验证基础。
- T004 已建立 LocalDate/Clock、诊断、配置与 safeStorage 空边界，并完成隔离的 Windows x64 unpacked/NSIS 运行冒烟。
- T011 已完成 Goal 创建、修改、pause/resume/end、当前下一步、列表/详情和真实关闭重开验证；本地与 hosted Windows gate、人工体验及项目所有者 review 均通过。
- T012 已完成 Action 生命周期、Today focus、当前下一步原子处理与重新安排纵向路径；本地 `verify`、PR #9 实现 head 的 hosted Windows gate 和项目所有者人工复验均通过。
- T013 已完成快速/深入 ActionRecord、Main 内存 recording context、跨午夜确认、显式 post-record 处理与真实重开纵向路径；本地 `verify`、PR #10 实现 head 的 hosted Windows gate 和项目所有者人工验收均通过。
- T014 已完成事实型 Progress：支持 Goal/包含端点日期筛选、ActionRecord 分钟与次数、确认理解、开放困惑及真实关闭重开；本地/hosted `verify`、独立 review、PR #11 合并和项目所有者完整人工 AC-01 均已完成。
- T011～T014 与门禁修复 T801 已由 PR #13 统一归档并合入 `dev`；最终实现验收 revision `74ebe346a86cf431d87e02e8a1220b713b33901c` 的本地/hosted `verify`、完整 AC-01、Windows package 与 unpacked/NSIS smoke 均通过。首轮 package smoke 失败仍保留在证据账本。
- T021 已完成 Routine 生命周期、ISO 星期节奏、Goal 接缝和 Today 计划项；T022 已完成 RoutineRecord 四显式结果、缺行 `unknown`、非计划日事实及统一事实型 Progress，项目所有者完整人工 AC-03 已通过。
- T023 已完成通用 Action 的非强制 Today intention：focus/intention 明确分区、同日互斥并由用户显式转换，未发生时不生成记录、失败或 Progress 事实，也不自动滚动到次日；本地/hosted 自动化、独立复核和项目所有者完整人工 AC-04 已通过。
- T021～T023 与门禁修复 T802 已由 PR #20 统一归档并合入 `dev`；最终验收 revision `a9db1eb26134dac83b01f4a4d7da30f92a271242` 的本地/hosted `verify`、AC-01/03/04、LocalDate/SQLite/S1-only v1 数据守恒、Windows package、unpacked/NSIS smoke 与独立聚合 review 均通过。
- T031 已完成 Record 修改/补记、子事实转换、Routine 历史计划 provenance、五类删除影响预览和事务性删除；PR #26 已合入 `dev`。
- T032 已完成十集合一致性快照、`exportVersion=1` UTF-8 JSON、结构/枚举/引用校验、Main-only 目标和原子文件交付；PR #27 已合入 `dev`。
- T033 已证明 AI disabled、not-configured、failure 时 CRUD、Progress、删除、导出和重开继续可用；PR #28 已合入 `dev`，项目所有者于 2026-08-22 报告完整人工 AC-07 通过。
- T803 已完成 T031～T033 的同 revision 聚合验收与归档；PR #29 合入 `dev@eec093924ae061876805c657742283097824df2c`，里程碑 PR #30 合入 `main@75e51b4e63f8c9df960cccb444515b9e89be5fbd`，并发布 `v0.1.0-beta.1` prerelease。
- T041～T052 已进入 `dev@84b596e12e54db098857004497a4d1964dcdc23c`，形成完整 Recovery/Review 纵向路径：Recovery 只读解释事实，所有恢复操作经用户确认且不改写历史；Review 只汇总事实并保存三项用户输入，五种 Routine 语义保持分离。schema v3、严格 export v2/v1、重开、原子更新及项目所有者完整人工 AC-05/06 均已验证。
- T806 的 S4/S5 聚合证据与合同已归档，PR #43 已通过 final-head CI 并合入 dev；固定产品 source 不因后续测试/文档 revision 改变。后续集成事实见 EV-S4-S5-001，main 晋升仍独立受控。
- T061～T063 已进入 `dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9`，形成用户主动触发、最小上下文、Main-only Provider/凭据/网络、临时建议和确认后普通 Command 写入的 AI Start Help 纵向路径。T807 的 continuous AC-02、受影响回归、Windows package、安全边界、独立复核和项目所有者完整人工 AC-02/真实 UI + LiteLLM 体验已通过；PR #49 后续已通过文档 final-head CI 并合入 dev，详见 EV-T807-001；发布仍独立受控。

- T071 补齐目标/今日重点的非阻塞软提示、最近真实行动日期与间隔、本周截至今天和上周完整周的分钟/行动次数比较，并回归六条既有 SHOULD。功能不设数量硬上限、停滞阈值或评价分数；实现与验证见 [T071 合同](docs/implementation/T071_SHOULD_CONVERGENCE.md) 和 [EV-T071-001](docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-t071-001)，任务状态以索引为准。T072 已完成当前候选的全量自动回归、Windows package/隔离安装冒烟及 owner 人工 AC/UX；修正删除对话框键盘焦点、记录后返焦及错误反馈。结果见 [EV-T072-001](docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-t072-001)；文档 final-head CI、G4 和发布各自受控。
- T082 的私有源更新检查与确认下载实现候选见 [合同](docs/implementation/T082_PRIVATE_UPDATE_CHECK_DOWNLOAD.md)及 [EV-T082-001](docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-t082-001)；凭据配置、轮换、撤销和未签名限制见 [操作说明](docs/implementation/T082_UPDATE_SOURCE_OPERATIONS.md)。真实私有源体验及任务状态以证据和任务索引为准。
- T083 增加显式“确认重启安装”、未保存输入和 AI 建议阻断、取消准备、Main 排空与单实例保护；关闭数据库后安装失败会保持锁定并提示重启。实现、真实手动 NSIS `0.1.2→0.1.3` 数据连续性及批准的替代验收见 [合同](docs/implementation/T083_CONFIRM_INSTALL_SHUTDOWN.md)和 [EV-T083-001](docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-t083-001)。完整真实应用内跨版本升级尚待后续验收。

不要把任务实现或验收候选理解为已合入 `main` 或已发布。

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

- `dev`：启动 Electron 开发空壳；
- `npm.cmd exec -- install-electron --no`：使用 `node_modules` 中精确锁定的 Electron 包恢复对应二进制；Electron 43 改为首次使用时按需下载，因此干净 `npm ci` 后和 CI 中显式执行；
- `build`：构建 Main、Preload 和 Renderer 到 `out/`；
- `package`：重新构建并生成 Windows x64 unsigned NSIS installer 和 `win-unpacked` 到 `release/`。
- `format:check`：只读检查合同范围内受 Prettier 管理的文件；人工修复使用显式 `npm.cmd run format`，CI 不调用写入命令；
- `lint`：以零 warning 运行 ESLint flat config，并检查进程/分层依赖边界；
- `typecheck`：以 TypeScript project references 检查生产源码、测试和工具配置；
- `test:unit`、`test:integration`：分别运行 Vitest unit 和 integration project；
- `test:e2e`：先构建，再用 Playwright Electron API 和唯一临时 `userData` 启动真实空壳；
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

## 后续入口

1. 产品任务实时状态以任务索引为准；T041/T042 已提供完整 Recovery candidate，T051/T052 已提供完整 Review candidate，T061～T063/T807 已提供 S6 AI Start Help 自动与人工验收 candidate。任务完成不自动授权 stage gate、PR Ready/merge 或下一任务。
2. `standard-task@1`、项目生命周期 Skills、PR/CI Gate 与长任务等待策略已经接入；具体任务仍须独立合同和项目所有者授权，Worktree cleanup 仍未实现。
3. Agent 仍不得从任务完成推定 Ready、merge、tag 或 release 权限。

T011～T014 已覆盖 S1 与完整 AC-01；T021～T023 已覆盖 S2 与完整 AC-03/AC-04；T031～T033/T803 已覆盖 S3 数据控制、版本化完整导出、AI 三态数据独立性和完整人工 AC-07；T041/T042 已形成完整 AC-05 与 S4 acceptance candidate；T051/T052 已形成完整人工 AC-06 与 S5 acceptance candidate；T061～T063/T807 已形成完整 AC-02 与 S6 acceptance candidate。当前已发布的 `v0.1.0-beta.1` 仍不包含尚未晋升到 `main` 的 S4/S5/S6 candidate，也不包含自动导入/恢复、S7 或 G4 Demo。

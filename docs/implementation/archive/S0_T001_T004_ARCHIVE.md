# MyTracer S0 / T001～T004 开发合同归档

> 状态：已归档；T001～T004 `done`，G2 `pass`
>
> 归档日期：2026-08-09
>
> 用途：保留已完成开发合同中仍影响后续实现、验证和审计的最小有效信息

## 1. 权威边界

- 本文是四份已完成开发合同的精简归档，不是新的实现合同，也不授权 T011 或后续任务。
- 当前任务状态以 [`TASK_INDEX_V0.1.md`](../TASK_INDEX_V0.1.md) 为准；实际验证以 [`ACCEPTANCE_EVIDENCE_V0.1.md`](../ACCEPTANCE_EVIDENCE_V0.1.md) 为准。
- 冻结需求、产品决定、架构和工程决定仍高于本文；本文不改变任何 FR、AC、D、ED 或 GW。
- 原合同完整内容保留在 Git 历史和 PR #1～#4 中；本归档只保留最终范围、批准、验证、限制和恢复入口。

## 2. 最终交付索引

| Task | 最终范围 | 实现 revision | PR / merge revision | Evidence |
|---|---|---|---|---|
| T001 / E0-01 | Electron 空壳与 Main/Preload/Renderer 安全边界 | `090e848d066f6f56d772181621ff211313667aa6` | [PR #1](https://github.com/Fyrefly-4/MyTracer/pull/1) / `e6f7b933bd4cbce57032a7a1b0da24912f45c3e9` | `EV-T001-001` |
| T002 / E0-02 | 验证工具链、测试替身、临时数据根和 Windows CI | `f60a38c4e69b8bead2aa8975c6fdb6886bec220a` | [PR #2](https://github.com/Fyrefly-4/MyTracer/pull/2) / `e64929057724f6458a798479d19de41a710a3028` | `EV-T002-001` |
| T003 / E0-03 | SQLite schema/migration、Repository/Unit of Work 与原生模块 | `b7f20901c54bd883f6ebf6cda66e3d9b9b5fa347` | [PR #3](https://github.com/Fyrefly-4/MyTracer/pull/3) / `2ea8c6cb8584e4bf4d517938efacf68813f33604` | `EV-T003-001` |
| T004 / E0-04 | LocalDate/Clock、诊断、空配置/safeStorage 与 package smoke | `0e9bf1f15614454f5618d5c910fe498dfa3de7ba` | [PR #4](https://github.com/Fyrefly-4/MyTracer/pull/4) / `2e95680c1965110b0d92ec54f9b28c6aee7df556` | `EV-T004-001` |
| G2 | T001～T004 最终聚合与工程就绪 | `2e95680c1965110b0d92ec54f9b28c6aee7df556` | [PR #5](https://github.com/Fyrefly-4/MyTracer/pull/5) / `7cc047e8442d075fb308321ce799d0e8dc2538bf` | `EV-G2-001` |

## 3. T001 — Electron 空壳与进程边界

### 已批准并完成

- Windows x64 Electron 43.3.0、React Renderer、Main/Preload/Renderer 构建与 unsigned NSIS 打包。
- Renderer sandbox、`nodeIntegration: false`、`contextIsolation: true`、限制性 CSP、导航/新窗口限制。
- 窄化类型化 Preload API；Main 校验 IPC 参数和 sender/origin；AI 未配置不阻塞启动。
- 项目所有者于 2026-08-08 批准精确依赖、必要下载、任务分支/提交/push/Draft PR，并单独确认人工验收和 Ready。

### 明确未交付

- 测试/CI 工具链、SQLite、业务 CRUD、真实 AI Provider、签名、release 和任何 AC。

### 最终验证与限制

- 干净安装、TypeScript build、build/package、开发/unpacked/安装态运行、NSIS 安装/卸载和安全边界检查通过；所有者人工验收 `pass`。
- T001 没有 hosted CI；这由 T002 后续建立，不影响 T001 的已批准完成范围。

## 4. T002 — 验证工具链与隔离测试基础

### 已批准并完成

- 项目所有者于 2026-08-08 批准九个精确 devDependencies、Windows 2025 Actions、必要下载、任务分支/提交/push/Draft PR。
- 建立稳定 `format:check`、lint、typecheck、unit、integration、Electron E2E、build 和只读聚合 `verify`。
- 建立确定性的 FakeClock、FakeAiProvider、唯一 OS 临时根、最小 Electron 环境 allowlist 和 Windows required-gate 候选。

### 明确未交付

- SQLite、生产 LocalDate/Clock、safeStorage、业务能力、真实 AI、branch protection/required-check 配置和任何 AC。

### 最终验证与限制

- 实现 head：13 unit、3 integration、1 Electron E2E 及本地/hosted `verify` 通过。
- 最终 PR head `55b2df01b584c48846f82053aae3a65139647c30` 的 run `31241912577` / job `93064208717` 再次通过；任务不需要产品人工 AC。
- Electron 二进制仍需项目内批准的恢复方式；Playwright Electron API 为 experimental；任务未配置远端保护规则。

## 5. T003 — SQLite 持久化基础

### 已批准并完成

- 项目所有者批准 `better-sqlite3@13.0.1`、`@types/better-sqlite3@7.6.13`、精确脚本权限及生产路径 `<Electron userData>/data/mytracer.sqlite3`。
- 批准并交付 `schemaVersion = 1`、显式 `001_initial.sql`、顺序 migration、foreign keys、WAL、参数化 SQL、RepositoryPort 和 UnitOfWorkPort。
- SQLite/路径/SQL 只存在于 Main/Infrastructure；每 case/进程使用 T002 临时根中的独立数据库。

### 明确未交付

- T004 日期/配置能力、业务命令、Progress/Today/Review、完整 FR-D01/AC-07、ORM、AI、真实数据操作和破坏性 migration。

### 最终验证与限制

- 13 unit、8 integration、本机交互式及 hosted `verify`、标准 package 和 packaged native-addon 冒烟通过。
- 实现 head run `31297398066` / job `93204634867` 通过；最终 PR head `f7dc0b1af291bb8d504d80040b9fbabf088b9654` 的 run `31297738034` / job `93205463074` 再次通过。
- PR #3 正文保留早期 GUI/package pending 描述；该描述已由 PR 内最终证据提交、`EV-T003-001` 和 G2 PR #5 明确取代。
- Codex 非交互式桌面宿主曾出现 GPU 启动不稳定；交互式 Windows 和 hosted Windows 的最终结果通过。

## 6. T004 — LocalDate、诊断、配置边界与 Windows 冒烟

### 已批准并完成

- 项目所有者于 2026-08-09 批准零新增/零升级依赖、任务分支/提交/push/Draft PR、Windows package smoke 和明确启动。
- 严格 Gregorian `LocalDate`、本地日 SystemClock、周一至周日范围和跨午夜显式选择。
- 封闭 DiagnosticsPort、安全无正文诊断、Main-only 空配置和 safeStorage 空边界；AI 稳定为 `not-configured`。
- 独立 `test:package-smoke` 实际启动 unpacked 和临时 NSIS 安装态；`verify` 保持不含 package/安装。

### 明确未交付

- SQLite schema/Repository 变化、业务 CRUD/统计/导出、跨午夜业务 UI、真实 Provider/凭据、签名、release 和任何业务 AC。

### 最终验证与限制

- 35 unit、9 integration、Electron E2E、本地 `verify`、package、package smoke 和独立 review 通过。
- 最终 PR head `f98ce1b6b3d78c4b6d14276240bfbb57f45bcc98` 的 run `31302167003` / job `93216596963` 通过。
- 项目所有者于 2026-08-09 确认 unpacked/NSIS 窗口观察 `pass`。
- 产物未签名；package/NSIS 运行冒烟只有本地 Windows 证据，hosted gate 只运行 `verify`；未越权删除无法重新证明 ownership 的旧临时根。

## 7. G2 工程就绪收口

- `dev` revision `2e95680c1965110b0d92ec54f9b28c6aee7df556` 包含 T001～T004。
- 同一 revision 的本地 `verify`、package、package smoke 和 hosted run `31302341732` / job `93217046549` 通过。
- 项目所有者于 2026-08-09 确认 G2 `pass`；PR #5 已以 merge commit `7cc047e8442d075fb308321ce799d0e8dc2538bf` 合入 `main`。
- G2 不声明业务 FR 或 AC-01～AC-07 完成；当时 `main`/`dev` 未配置 branch protection/required check，Windows 产物未签名并使用默认 Electron 图标。
- G2 通过只满足 T011 工程前置；T011 仍需独立合同和明确实现授权。

## 8. 原合同恢复入口

删除前的四份完整合同可从对应 PR 文件视图或 Git 历史恢复：

```powershell
git show 2e95680:docs/implementation/T001_ELECTRON_SHELL_TASK.md
git show 2e95680:docs/implementation/T002_VALIDATION_TOOLCHAIN_TASK.md
git show 2e95680:docs/implementation/T003_SQLITE_PERSISTENCE_TASK.md
git show 2e95680:docs/implementation/T004_LOCALDATE_DIAGNOSTICS_CONFIGURATION_TASK.md
```

这些历史合同中的执行前快照、候选选项、逐条命令和已被后续状态取代的 Draft/Ready 描述仅用于历史审计，不再作为当前开发依据。

# T001：Electron 应用空壳与进程边界任务合同

> 合同状态：`active`
> 创建日期：2026-08-08
> 决策批准依据：项目所有者在 2026-08-08 批准依赖方案，并随后明确授权启动 T001、下载批准依赖和二进制、Windows x64 unsigned NSIS 打包、任务分支/提交/push/Draft PR 及状态和证据更新
> 本合同是 T001 的活动执行边界；未列入的依赖、功能和外部操作仍不授权

## 1. 任务信息

- **Task ID**：T001
- **Title**：Initialize the Electron application shell and process boundaries
- **Slice / Plan item**：S0 / E0-01
- **Status**：`active`
- **Base branch**：`dev`
- **Expected branch**：`task/T001-electron-shell`
- **已核验基线快照**：`dev`、`main`、`origin/dev`、`origin/main` 均为 `da27afd5c9cfa00be3bfc5e961b34e5696d496f8`
- **执行前要求**：不得仅依赖上述快照；启动 T001 前必须重新只读核验最新授权的 `origin/dev`

## 2. 目标结果

建立一个可在 Windows x64 上启动、构建和打包的最小 Electron 应用空壳：

- React Renderer 提供 Today、Progress、Review 的占位导航或等价空壳入口；
- Electron Main、Preload、Renderer 的构建入口和依赖方向明确；
- Preload 只暴露窄化、类型化、意图级 API；
- Main 对 IPC 输入和 sender/origin 执行校验；
- Renderer sandbox、context isolation、限制性 CSP 和导航/新窗口限制生效；
- AI 未配置时应用仍能启动；
- 不实现 Goal、Action、Routine、Record、SQLite 或 AI Provider 业务能力。

本任务完成只证明工程空壳和 Electron 安全边界成立，不证明 T002 测试工具链、T003 SQLite 或任何产品验收场景已经完成。

## 3. 需求依据

- **FR**：无直接功能 FR；本任务只建立后续 FR 的受控运行边界
- **AC**：无直接 AC；不得把应用空壳启动描述为 AC-01～AC-07 通过
- **D**：D-001、D-003、D-015～D-017
- **ED/GW**：ED-001、ED-002、ED-004、ED-019；GW-001～GW-004、GW-009、GW-010
- **直接相关架构章节**：
  - `docs/architecture/ARCHITECTURE_V0.1.md` §4、§7、§8、§10；
  - `docs/architecture/ENGINEERING_DECISIONS_V0.1.md` ED-001、ED-002、ED-004、ED-019；
  - `docs/architecture/IMPLEMENTATION_PLAN_V0.1.md` §3 E0-01；
  - `docs/architecture/TEST_STRATEGY_V0.1.md` §3、§9；
  - `docs/implementation/GITHUB_WORKFLOW_V0.1.md`。

## 4. 开始条件

- [x] G1 已通过；T001 没有未完成的工程前置任务。
- [x] 项目所有者已批准本合同第 5 节所列 T001 依赖和精确版本。
- [x] T001 不包含数据 schema 或 migration，当前没有破坏性迁移影响。
- [x] 当前冻结需求和批准架构没有已知未处理冲突。
- [x] `dev`、`build`、`package` 的命令职责已批准；T001 负责首次建立这三个命令。
- [x] 已明确授权执行依赖安装及其必要的 Electron、electron-builder 和 NSIS 网络/二进制下载。
- [x] Windows x64 `package` 目标为 unsigned NSIS，并同时验证 `win-unpacked` 和 installer；不配置签名或 release。
- [x] 已明确授权创建本地 worktree/任务分支；受控工作区采用当前检出切换到独立 `task/T001-electron-shell` 分支，`dev` 基线不产生提交。
- [x] 已明确授权创建本地提交。
- [x] 已分别明确 push 和 Draft PR 到 `dev` 的权限。
- [x] 启动前已重新核验工作树仅含预期的未跟踪合同，`origin/dev` 存在，且 `HEAD`/`origin/dev`/`origin/main` 均为 `da27afd5c9cfa00be3bfc5e961b34e5696d496f8`。

上述开始条件已经满足，T001 已于 2026-08-08 转为 `active`。

## 5. 已批准依赖与工具链

### 主机工具

| 工具 | 精确版本 |
|---|---:|
| Node.js | 24.18.0 LTS |
| npm | 11.16.0 |

### `dependencies`

| 包 | 精确版本 |
|---|---:|
| `react` | 19.2.8 |
| `react-dom` | 19.2.8 |

### `devDependencies`

| 包 | 精确版本 |
|---|---:|
| `electron` | 43.3.0 |
| `typescript` | 6.0.3 |
| `vite` | 7.3.6 |
| `@vitejs/plugin-react` | 5.2.0 |
| `electron-vite` | 5.0.0 |
| `electron-builder` | 26.15.3 |
| `@types/node` | 24.13.3 |
| `@types/react` | 19.2.18 |
| `@types/react-dom` | 19.2.4 |

约束：

- `package.json` 必须使用上述精确版本，不使用 `^`、`~` 或 `latest`；
- 使用 npm 和 `package-lock.json`；
- 不运行脚手架生成器；
- 除上述清单外，不得增加运行时或开发依赖；
- 不提前加入 T002、T003 或延期能力的依赖。

## 6. 允许修改范围

仅在 T001 获得执行授权后允许修改：

- `package.json`；
- `package-lock.json`；
- `electron.vite.config.ts`；
- T001 必需的 `tsconfig*.json`；
- `electron-builder.yml` 或等价的单一 builder 配置文件；
- `src/domain/**`；
- `src/application/**`；
- `src/contracts/**`；
- `src/main/**`；
- `src/preload/**`；
- `src/renderer/**`；
- `src/infrastructure/**`；
- T001 最小构建所需的静态资源目录；
- `.gitignore`；
- `README.md` 中仅与 T001 已存在命令和启动方式直接相关的部分；
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md` 中的 T001 实际证据；
- 本合同中仅用于反映实际权限、状态、结果和证据的字段。

任何超出上述范围的必要修改必须先停止、报告原因并获得项目所有者批准。

## 7. 明确非范围

- 不改变冻结需求、产品状态语义、AC 或 ED/GW 决定。
- 不实现 Goal、Action、Routine、Record、Today 业务查询、Progress 聚合或 Review 流程。
- 不创建 SQLite 数据库、schema、migration、Repository 或真实数据路径实现。
- 不安装 `better-sqlite3`、测试框架、lint/format 工具、AI SDK、UI 组件库、表单库、ORM、自动更新或遥测依赖。
- 不实现 AI Provider、模型接入、真实密钥、持久 AI 草稿或 AI 写入口。
- 不建立账号、同步、通知、提醒、插件、通用工作流或其他延期功能。
- 不建立 GitHub Actions、ruleset、branch protection、PR template、tag 或 release。
- 不配置生产代码签名、自动发布或自动更新。
- 不修改 `docs/implementation/TASK_INDEX_V0.1.md` 中 T001 之外的任务状态；项目所有者已授权同步 T001 状态。
- 不把占位页面、构建成功或启动成功描述为 AC-01～AC-07 通过。

## 8. 必须保持的不变量

- Renderer 使用 `nodeIntegration: false`、`contextIsolation: true` 和 sandbox。
- Renderer 不直接访问 Node、Electron、SQLite、文件路径、凭据或 AI Provider。
- Preload 不暴露 `ipcRenderer`、任意 channel、Electron 原生对象、SQL 或文件路径。
- Preload 只暴露具体 Command/Query 形状的类型化白名单方法。
- Main 校验 IPC sender/origin 和输入 DTO；拒绝未知或越权调用。
- Domain 不依赖 Electron、React、SQLite、文件系统、网络或具体 AI SDK。
- Application 只依赖 Domain 和端口。
- `src/contracts` 表达 IPC DTO，不把可变领域实体直接作为 Renderer 远程模型。
- AI 未配置、关闭或失败不得阻止应用空壳启动。
- 不读取、创建、迁移或清理真实 Electron `userData` 数据库。
- 只加载本地打包内容，采用限制性 CSP，禁止任意导航和新窗口。

## 9. 交付物

- [ ] 精确版本的 `package.json` 和 npm 锁文件。
- [ ] Main、Preload、Renderer、Domain、Application、contracts、infrastructure 的最小目录和入口。
- [ ] Today、Progress、Review 的非业务占位导航或等价空壳。
- [ ] 生效的 Electron 安全配置和窄化 Preload 边界。
- [ ] `dev`、`build`、`package` 命令。
- [ ] Windows x64 build/package 产物及启动证据。
- [ ] AI 零配置启动和非阻塞错误状态。
- [ ] 与实际命令一致的最小 README 说明。
- [ ] `EV-T001-001` 或后续未占用 T001 Evidence ID 的实际证据记录。
- [ ] 相对授权 `dev` 基线的完整 diff 自查和独立 review。

T001 不交付单元、集成、E2E、lint、format、typecheck 或 CI 命令；这些由 T002 建立并固定。

## 10. 验收标准

1. 在批准的 Node 24.18.0、npm 11.16.0、Windows x64 环境中，精确锁文件能够通过一次干净 `npm ci` 还原，且没有未报告的 peer/engine 冲突。
2. `npm run build` 成功构建 Main、Preload 和 Renderer。
3. `npm run package` 按已批准的 Windows x64 目标成功生成产物。
4. `MANUAL`：开发模式应用能够启动、显示最小空壳，并可在 Today、Progress、Review 占位入口间切换或访问等价结构。
5. `MANUAL`：unpacked 或已批准格式的 packaged app 能够在 Windows x64 启动。
6. 源码和运行时检查共同证明 `nodeIntegration: false`、`contextIsolation: true`、Renderer sandbox、CSP、导航限制和 IPC sender/origin 校验生效。
7. Preload 公开 API 中不存在 `ipcRenderer`、任意 channel、SQL、任意文件路径或凭据。
8. AI 未配置时应用正常启动，且没有读取真实密钥或要求 Provider 可用。
9. 最终依赖树只包含本合同批准的顶层依赖；不存在未批准顶层依赖。
10. 最终 diff 不包含 SQLite、业务 CRUD、测试/CI 工具链或延期功能。
11. 工作树、命令、环境、source revision、产物和已知限制已写入真实验收证据。
12. 尚未由项目所有者执行的人工验收保持 `pending`，不得由 Agent 代替通过。

## 11. 验证计划

### 环境确认

```powershell
node --version
npm.cmd --version
git status --short --branch
git rev-parse HEAD
```

### 依赖与构建

```powershell
npm.cmd ci
npm.cmd ls
npm.cmd run build
npm.cmd run package
```

上述命令只在 T001 获得依赖安装和执行授权、且命令已经由 T001 建立后运行。不得使用远程 `npx` 隐式下载未批准工具。

### 针对性检查

- 检查 BrowserWindow 安全选项和 CSP；
- 检查 IPC 注册、输入校验、sender/origin 校验和 Preload 暴露面；
- 检查 Renderer bundle 不包含 Node、SQLite、凭据或 AI Provider 访问；
- 在 AI 无配置环境启动开发应用和 Windows 产物；
- 检查应用没有在仓库或真实 `userData` 创建数据库。

### 受影响范围回归

- 重新运行 `npm.cmd run build`；
- 重新运行已批准的 Windows x64 `npm.cmd run package`；
- 在最终 source revision 上重新执行开发启动和 packaged/unpacked 启动步骤；
- 检查最终 `git diff`、`git diff --check` 和工作树状态。

### 验证环境

- **OS**：Windows x64，完成时填写具体版本
- **Node**：24.18.0
- **npm**：11.16.0
- **Electron**：43.3.0
- **数据根**：T001 不创建数据库；人工启动使用明确的隔离测试 `userData`
- **Source revision**：完成时填写
- **Artifact**：完成时填写绝对路径、类型和校验信息

## 12. Git 与 GitHub 权限

当前权限状态：

- [x] 允许创建本地 worktree/`task/T001-electron-shell` 分支。
- [x] 允许创建本地提交。
- [x] 允许推送任务分支。
- [x] 允许创建或更新 Draft PR 到 `dev`。
- [ ] 允许将 Draft 标记为 Ready。
- [x] 不允许 Agent 合并到 `dev`。
- [x] 不允许 Agent 创建或合并 `dev -> main` PR。
- [x] 不允许 Agent 创建 tag 或 release。
- [x] 禁止 force push 和远端分支删除。

未勾选的允许项表示尚未授权，而不是默认允许。任何 merge、Ready、tag、release、GitHub 配置或远端清理必须另行获得确切授权。

## 13. 依赖与外部操作权限

- **新增/升级依赖**：第 5 节精确清单已获项目所有者批准；不得扩大。
- **执行安装**：已授权安装第 5 节精确清单。
- **网络访问**：已授权下载第 5 节依赖及必要的 Electron、electron-builder 和 NSIS 二进制；不得扩大到其他依赖或服务。
- **AI Provider**：无；不得接入 fake 之外的 Provider，T001 也不安装 fake 测试框架。
- **外部写入**：允许 push `task/T001-electron-shell` 并创建/更新到 `dev` 的 Draft PR；不允许 Ready、merge、tag、release、force push、远端分支删除、Actions 或仓库设置变更。
- **数据破坏性操作**：无。
- **真实用户数据**：不得读取、写入、迁移、复制或清理。

## 14. 风险与停止条件

发现以下任一情况时停止受影响实现并报告：

- MUST、D、ED、GW 或本合同之间存在冲突；
- 需要新增未批准依赖或改变精确版本；
- `electron-vite 5.0.0`、Vite 7.3.6 或 Electron 43.3.0 出现无法解决的 engine/peer 冲突；
- Windows package 需要未批准的 target、代码签名、发布服务或系统级安装；
- 安装或打包尝试引入 SQLite、原生业务依赖或 T002/T003 工具；
- Renderer 需要 Node、文件路径、凭据或任意 IPC 才能工作；
- 无法实现 sender/origin 校验、sandbox 或限制性 CSP；
- 验证必须访问真实 Electron `userData`；
- 当前 `dev` 或 `origin/dev` 与合同基线不一致且无法只读解释；
- 需要扩大 Git、GitHub、文件或网络权限；
- 无法对 Windows x64 产物和最终 revision 产生可靠证据。

任务特有已知风险：

- Electron、electron-builder 和 Windows target 会产生较大的二进制下载；
- 当前仓库路径包含空格，若未来原生构建回退到 `node-gyp`，T003 需要单独验证；
- GitHub 当前没有 Actions、ruleset 或 branch protection，任何 Draft PR 在 T002 以前没有远端 required gate；
- T001 没有完整 lint/typecheck/test 工具链，必须通过 T002 补齐，不得将 T001 的构建结果视为工程质量闭环。

## 15. 完成报告

T001 完成报告必须包含：

- 新增或修改的文件；
- 实际可观察结果；
- D/ED/GW 覆盖；
- 实际执行的命令、环境、exit code 和关键输出；
- Windows x64 build/package 产物；
- Electron 安全边界检查结果；
- 自动化和人工验收状态；
- commit、PR、CI 或 artifact 标识（仅在适用且已授权时）；
- 风险、已知缺口和未验证内容；
- T002/T003/T004 必须继续验证的项目；
- 是否发现需求冲突、范围变化或未批准依赖。

完成报告不得声称：

- AC-01～AC-07 已通过；
- T002、T003 或 G2 已完成；
- GitHub 保护或 CI 已生效；
- 项目所有者尚未执行的人工验收已通过。

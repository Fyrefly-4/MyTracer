# MyTracer v0.1 验收证据

> 文档状态：证据账本已建立；已记录 T001～T004、T011～T013 与 G2 工程就绪证据
> 作用：记录可复核的命令、版本、环境、产物和人工观察  
> 禁止：用任务状态、测试名称、关键词存在或 Agent 自述替代实际结果

## 1. 证据原则

每条完成声明必须绑定到：

- 唯一 Evidence ID；
- Task ID、切片和需求编号；
- 被验证的确切 revision 或明确标识的工作树状态；
- 执行环境；
- 实际命令或人工步骤；
- 结果与关键输出摘要；
- 可定位的 CI、日志、截图或产物；
- 失败、跳过、未验证和 SHOULD 缺口。

以下内容单独不能证明完成：

- 计划中写了某个测试；
- 存在一个同名测试文件；
- 搜索到了需求编号；
- 本地单一命令通过但要求的平台或打包未验证；
- 较早 commit 或中间 CI 通过，但最终 revision 不同；
- Agent 表示“应当可用”。

## 2. Evidence ID

格式：

```text
EV-T001-001
EV-T013-002
EV-G2-001
EV-AC07-001
```

- `EV-Txxx-*`：任务级证据；
- `EV-Gx-*`：阶段门证据；
- `EV-ACxx-*`：跨任务验收场景证据。

Evidence ID 不复用。失败记录保留，并由后续记录明确引用修复和重新验证结果。

## 3. 证据记录模板

### EV-____

- **Status**：pass / fail / partial / superseded
- **Task / Gate**：
- **Requirements**：FR- / AC- / D- / ED-
- **Source branch**：
- **Source revision**：commit SHA，或 `uncommitted` + 记录时间
- **CI head/merge revision**：如适用
- **Environment**：OS、Node、Electron、数据库/fixture、关键工具版本
- **Command or manual procedure**：
- **Result**：
- **Artifacts**：CI URL、日志位置、截图、导出文件或安装包标识
- **Manual acceptance**：not-required / pending / pass / fail
- **Known limitations**：
- **Supersedes / superseded by**：
- **Recorded at**：YYYY-MM-DD

## 4. 任务级证据索引

| Evidence | Task | Revision | Scope | Result | Manual | Notes |
|---|---|---|---|---|---|---|
| `EV-T001-001` | T001 | `090e848d066f6f56d772181621ff211313667aa6` | Electron 空壳、进程边界、Windows x64 打包 | pass | pass | Agent 运行时验证通过；项目所有者于 2026-08-08 确认人工验收通过 |
| `EV-T002-001` | T002 | `f60a38c4e69b8bead2aa8975c6fdb6886bec220a` | 验证工具链、测试替身、临时根、Electron E2E、Windows CI | pass | not-required | 最新实现 revision 的本地与 hosted Windows 聚合验证通过；不声明 G2 或产品 AC |
| `EV-T003-001` | T003 | `b7f20901c54bd883f6ebf6cda66e3d9b9b5fa347` | SQLite schema/migration、Repository 契约、Windows x64 native addon | pass | not-required | 交互式本机与 hosted Windows `verify`、标准 package 和 packaged-native 冒烟均通过；不声明业务 FR/AC 或 G2 |
| `EV-T004-001` | T004 | `0e9bf1f15614454f5618d5c910fe498dfa3de7ba` | LocalDate/Clock、诊断、空配置/safeStorage、Windows package smoke | pass | pass | 本地 Windows `verify`、package、unpacked/NSIS 运行冒烟和 hosted Windows `verify` 通过；所有者窗口观察已通过；任务自身不单独声明业务 FR/AC 或 G2 |
| `EV-T011-001` | T011 | `c4e9f6dee3cbab97f6902f2c90f97f96423b43e2` | Goal 生命周期、当前下一步、关联查询、SQLite/IPC/UI 和真实重开 | pass | pass | 本地 Windows `verify`、PR head hosted Windows gate、人工体验和项目所有者 review 通过；T011 `done`，仅贡献 AC-01 步骤 1～2 |
| `EV-T012-001` | T012 | `56b3446a1b952a9bdb6fe29ab4a89502171ba321` | Action 生命周期、Today focus、当前下一步处理、重新安排、SQLite/IPC/UI 和真实重开 | pass | pass | 本地 Windows `verify`、PR #9 实现 head hosted Windows gate 和项目所有者人工复验通过；仅贡献 AC-01 步骤 3，FR-A05 仅为 Action 状态解耦部分 |
| `EV-T013-001` | T013 | `b10d5d40c4c1dc1f7a20801d5d904b1d37953270` | 快速/深入 ActionRecord、recording context、跨午夜、原子 post-record、SQLite/IPC/UI 和真实重开 | pass | pass | 本地 Windows `verify`、独立复核、PR #10 实现 head hosted Windows gate 和项目所有者人工验收通过；贡献 AC-01 步骤 4～5，并与 T012 合并完成 FR-A05 |

### EV-T001-001

- **Status**：pass
- **Task / Gate**：T001 / S0 E0-01；不声明 G2 通过
- **Requirements**：D-001、D-003、D-015～D-017；ED-001、ED-002、ED-004、ED-019；GW-001～GW-004、GW-009、GW-010
- **Source branch**：`task/T001-electron-shell`
- **Source revision**：`090e848d066f6f56d772181621ff211313667aa6`
- **CI head/merge revision**：T001 未建立 CI；PR head `8bd82dbe33a00cb4e272a4dfeced1d6d1d83a8da`，squash merge commit `e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`
- **Environment**：Microsoft Windows 11 家庭中文版，10.0.26200，x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；electron-vite 5.0.0；electron-builder 26.15.3；无数据库，所有启动验证使用仓库 `.tmp/` 下的隔离 `userData`
- **Command or manual procedure**：
  1. 设置批准的 Node 路径并执行 `npm.cmd ci`、`npm.cmd ls --depth=0`、`node_modules\.bin\tsc.cmd --build --pretty false`、`npm.cmd run build`。
  2. 使用官方 npm registry 执行 `npm.cmd audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`。
  3. 设置批准的 Electron/electron-builder 二进制镜像和 `CSC_IDENTITY_AUTO_DISCOVERY=false`，执行 `npm.cmd run package`。
  4. 从最终源码启动 `npm.cmd run dev`，通过 Chromium DevTools Protocol 强制重载并检查 DOM、样式表、计算样式、Preload API、console、CSP 和 Renderer 全局对象。
  5. 启动最终 `release/win-unpacked/MyTracer.exe`，检查 ASAR 本地页面、Today/Progress/Review 切换、IPC、Node 隔离、外部导航、新窗口和运行时错误。
  6. 将最终 NSIS 安装器静默安装到隔离目录，启动已安装应用，检查状态 API 和 Renderer 隔离，然后运行自带静默卸载器并复查安装目录和卸载注册项。
  7. 执行 `git diff --cached --check`、依赖/越界源码检查和相对 `origin/dev` 的完整 diff 自查；由独立评审 Agent 复核实现与配置。
- **Result**：
  - 干净 `npm ci`、精确顶层依赖树、补充 TypeScript build、`npm run build` 和最终 `npm run package` 均以 exit code 0 完成；production audit 为 `found 0 vulnerabilities`。
  - Main、CommonJS sandboxed Preload 和 Renderer 均成功构建；开发模式最终 CSP 允许 Vite 的内联样式但保持 `script-src 'self'`，重载后 1 个样式表、42 条 CSS 规则和预期计算样式生效，未观察到 CSP 拦截、Log error 或运行时异常。
  - 开发、unpacked 和安装态应用均返回 `appName=MyTracer`、`appVersion=0.1.0`、`platform=windows`、`ai.availability=not-configured`；Renderer 中 `window.node` 和 `window.require` 均为 `undefined`。
  - Today、Progress、Review 三个按钮分别切换到对应标题和占位卡；外部 `https://example.invalid/` 导航未改变本地 URL，`window.open` 返回 `null`。
  - NSIS 静默安装 exit code 0；安装态应用文档状态为 `complete`；卸载 exit code 0，安装目录不存在，匹配的 HKCU 卸载注册项为 0。
  - 独立评审对代码和配置给出 P0～P3 no findings；其发现的 README/证据文档 P2 一致性问题由本记录收口。
- **Artifacts**：
  - `D:\MyDocuments\MyCodes\VS Code\Frontend\Agent_WorkSpace\MyTracer\release\win-unpacked\MyTracer.exe`，225441792 bytes，SHA-256 `B2AD426EFC29E1F564A8D79EAB4A52809A72E38300A0FD94CC8075997F192197`，PE x64 `0x8664`，Authenticode `NotSigned`。
  - `D:\MyDocuments\MyCodes\VS Code\Frontend\Agent_WorkSpace\MyTracer\release\MyTracer-0.1.0-x64-setup.exe`，100279230 bytes，SHA-256 `8CCE583BC834A4FA193EF14A659FD9D29102631F3623A06BA0BC2ACEE0D38080`，NSIS 启动器 PE `0x014C`、x64 payload，Authenticode `NotSigned`。
  - PR #1：`https://github.com/Fyrefly-4/MyTracer/pull/1`，base `dev`，head `task/T001-electron-shell`；创建时无 CI checks，已于 2026-08-08 合并为 `e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`。
- **Manual acceptance**：pass；项目所有者于 2026-08-08 明确确认人工验收通过
- **Known limitations**：T001 完成时尚未建立的 lint、format、自动 typecheck、单元/集成/E2E 和 CI 后由 `EV-T002-001` 补齐；生产 Renderer 按已批准 ED-019 使用本地 `file://`，后续可评估自定义协议加固；受限导航允许页面进入 `about:blank` 自空白但不加载外部内容或扩大权限；T001 本身未声明 AC-01～AC-07 或 G2 通过
- **Supersedes / superseded by**：无
- **Recorded at**：2026-08-08

### EV-T002-001

- **Status**：pass
- **Task / Gate**：T002 / S0 E0-02；不声明 G2 通过
- **Requirements**：D-015、D-017；ED-004、ED-010、ED-011、ED-019；GW-002、GW-004、GW-008～GW-010；无直接 FR/AC 完成声明
- **Source branch**：`task/T002-validation-toolchain`
- **Source revision**：实现 revision `f60a38c4e69b8bead2aa8975c6fdb6886bec220a`；最终 PR head `55b2df01b584c48846f82053aae3a65139647c30` 仅收口本记录、合同和任务索引，不改变工具链、测试或生产源码
- **Base revision**：`e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`（T001 PR #1 merge commit，执行前与发布前均核验为最新 `origin/dev`）
- **CI head/merge revision**：最终 PR head `55b2df01b584c48846f82053aae3a65139647c30`；最终 Actions run `31241912577` 实际 checkout `7738bace6e4875736d6654df9d9327bda4c90147`；squash merge commit `e64929057724f6458a798479d19de41a710a3028`
- **Environment**：
  - 本地：Microsoft Windows NT 10.0.26200.0，x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；无数据库；无 live AI；Electron E2E 在可启动桌面进程的非受限环境运行。
  - CI：GitHub-hosted `windows-2025-vs2026` x64，image `20260803.193.1`，runner `2.336.0`；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0。
  - 数据：每次使用 `os.tmpdir()` 下 `mkdtemp` 创建的唯一 `mytracer-tests-*` 根；Electron `userData`、HOME/USERPROFILE、APPDATA/LOCALAPPDATA、TEMP/TMP 均重定向到该根；无真实 key、真实 `userData` 或 Provider。
- **Command or manual procedure**：
  1. 核验 T001/PR #1、远端 `dev`、merge-base、工作树和分支状态；创建并使用 `task/T002-validation-toolchain`。
  2. 执行 `npm.cmd ci`、`npm.cmd ls --depth=0`；Electron 43 按官方按需下载机制，通过项目内精确锁定的 `npm.cmd exec -- install-electron --no` 恢复二进制。
  3. 分别执行 `npm.cmd run format:check`、`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd run test:unit`、`npm.cmd run test:integration`、`npm.cmd run test:e2e`、`npm.cmd run build`；全部 exit code 0。
  4. 在最终实现 revision 执行 `npm.cmd run verify`；随后执行 `git diff --check`、相对 `origin/dev` 的完整 diff/依赖/生产源码/禁用能力检查和 ESLint effective-config 检查。
  5. 对完整 diff 进行独立只读复核；修复宿主环境变量透传与临时根对象伪造两个隔离问题后重新验证，最终无未处理 P0～P3 finding。
  6. push 分支并创建 Draft PR #2；核验 workflow/job、head/merge revision、Windows image、步骤和最终结果。
- **Result**：
  - 9 个新增 direct devDependencies 与批准版本完全一致；`npm.cmd ci` 从锁文件恢复 458 个包，`npm.cmd ls --depth=0` 无 invalid/missing/peer/engine 错误。安装输出保留既有/传递依赖 `inflight@1`、`rimraf@2`、`glob@7`、`boolean@3` 的 deprecation warnings，未据此升级或替换未批准依赖。
  - 本地最终 `verify` exit code 0：Prettier pass；ESLint zero warnings；TypeScript build pass；3 个 unit files / 13 tests、1 个 integration file / 3 tests、1 个 Electron E2E 均 pass；Main/Preload/Renderer build pass。
  - FakeClock 证明完整显式状态、读取确定、原子 `setState` 和实例隔离；未建立生产 ClockPort/LocalDate。
  - FakeAiProvider 覆盖 success、timeout/pending、cancellation、authentication failure、parse failure、late response、fabricated payload、调用快照和实例隔离；实现不导入网络、文件、SQLite、SDK 或密钥能力。
  - 临时根测试证明唯一创建、canonical containment、对象身份所有权、越界/伪造拒绝和精确清理；E2E 断言实际 Electron `userData` 位于该根，宿主敏感环境变量名为零，结束后无 Electron 进程或测试根残留。
  - E2E 验证 Today/Progress/Review、AI `not-configured`、IPC 响应以及 Renderer 中 Node/require 不存在；未创建数据库或业务数据。
  - 首次 hosted run `31241382835` 在 head `5b68585` 因 Windows CRLF 与 Prettier 默认 LF 不一致失败；由 `endOfLine: auto` 修复。实现 run `31241614350` 在 head `f60a38c` 上成功；最终 PR run `31241912577` 在仅文档收口后的 head `55b2df0` / test merge `7738bac` 上再次执行完整 `verify` 并 success；稳定 check 名称为 `Windows required gate`。
  - 最终 diff 不修改 `src/**`，不含 SQLite/migration、业务能力、真实 Provider/SDK/key、Renderer 后门或未批准依赖；README、AGENTS、任务模板、CI 与 package scripts 使用同一命令集。
- **Artifacts**：
  - PR #2：`https://github.com/Fyrefly-4/MyTracer/pull/2`，base `dev`；已于 2026-08-08 合并为 `e64929057724f6458a798479d19de41a710a3028`。
  - 最终成功 run：`https://github.com/Fyrefly-4/MyTracer/actions/runs/31241912577`；job `93064208717` / `Windows required gate`。
  - 被取代的失败 run：`https://github.com/Fyrefly-4/MyTracer/actions/runs/31241382835`；失败原因和修复均保留于本记录。
  - 不持久化 Playwright screenshot/trace/video；临时结果和数据根均位于 OS 临时目录并已清理。
- **Manual acceptance**：not-required；本任务没有产品体验 AC。项目所有者仍控制 PR 评审、Ready、merge 和后续阶段授权
- **Known limitations**：Prettier 过渡性精确排除 3 个 T001 生产文件和 1 个技能元数据文件，避免 T002 越界格式化；Playwright Electron API 仍为 experimental；Electron 43 二进制需要单独按需恢复；`Windows required gate` 已稳定报告但未获授权配置为 branch-protection required。T002 完成时尚未实现的 T003/T004 后由各自证据补齐，G2 后由 `EV-G2-001` 通过；T061～T063 正式 AI 和 AC-01～AC-07 仍 pending
- **Supersedes / superseded by**：成功 run `31241614350` supersedes 失败 run `31241382835`；最终 PR run `31241912577` 在文档收口 head 上再次通过；本证据不 supersede `EV-T001-001`
- **Recorded at**：2026-08-08

### EV-T003-001

- **Status**：pass
- **Task / Gate**：T003 / S0 E0-03；不声明 G2、FR-D01 业务功能或任何 AC 通过
- **Requirements**：FR-D01（仅持久化基础，不声明功能完成）；D-003、D-009、D-015～D-017、D-103、D-106、D-111；ED-003～ED-006、ED-008～ED-009、ED-012、ED-014～ED-018；GW-001～GW-004、GW-008～GW-010
- **Source branch**：`task/T003-sqlite-migrations`
- **Source revision**：实现 `b7f20901c54bd883f6ebf6cda66e3d9b9b5fa347`；最终 PR head `f7dc0b1af291bb8d504d80040b9fbabf088b9654` 仅收口合同、索引和证据，不修改生产或测试源码
- **Base revision**：`e64929057724f6458a798479d19de41a710a3028`（T002 PR #2 merge commit；启动前核验为最新 `origin/dev`）
- **CI head/merge revision**：实现 head `b7f20901c54bd883f6ebf6cda66e3d9b9b5fa347` 的 run `31297398066` / job `93204634867` 成功；最终 PR head `f7dc0b1af291bb8d504d80040b9fbabf088b9654` 的 run `31297738034` / job `93205463074` 再次成功；squash merge commit `2ea8c6cb8584e4bf4d517938efacf68813f33604`
- **Environment**：
  - 本地：Windows 11 10.0.26200 x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0（内置 Node 24.17.0）；`better-sqlite3@13.0.1`，N-API 10，SQLite 3.53.3；`@types/better-sqlite3@7.6.13`；electron-builder 26.15.3。
  - CI：GitHub-hosted Windows x64；PR 的完整 `verify` 成功。该 CI 结果证明 T002 隔离 E2E 和 T003 自动化 SQLite 范围，不包含 packaged NSIS 冒烟。
  - 数据：unit/integration 和 Electron native smoke 每 case/进程使用 T002 的唯一 `mytracer-tests-*` 临时根和该根的独立数据库；根内具有 `AppData/Roaming`、`AppData/Local`、`Temp` 和 Electron `cwd`，且 E2E 断言这些边界。无真实 Electron `userData`、真实数据库、key、Provider 或 live AI 调用。packaged-native 手动 smoke 使用独立 OS 临时文件数据库；它没有冒充 T002 根验证。
- **Command or manual procedure**：
  1. 执行批准的精确安装、`npm.cmd ci` 和 `npm.cmd ls --depth=0`；顶层树包含且仅新增批准的直接 SQLite 驱动与类型包。
  2. 执行 `npm.cmd run format:check`、`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd run test:unit`、`npm.cmd run test:integration`。结果为 13 个 unit tests、8 个 integration tests 全部通过；后者覆盖实际 Electron native addon、schema v1、foreign keys、WAL、migration、回滚、重开、参数化 SQL 与 Repository 契约。
  3. 以现有 Electron 发行文件作为 `electronDist` 运行 electron-builder，生成 Windows x64 `win-unpacked` 和 NSIS；检查 `app.asar.unpacked/node_modules/better-sqlite3/prebuilds/win32-x64.node`，再用 packaged executable 实际加载 addon 并在隔离临时数据库执行参数绑定读写、`journal_mode=wal` 和 `foreign_keys=1`。
  4. 项目所有者在可启动桌面进程的交互式 PowerShell 执行最终 `npm.cmd run verify`，exit code 0：format、lint、typecheck、13 个 unit tests、8 个 integration tests、build 和 Playwright Electron E2E 全部通过。Codex 桌面非交互式宿主的 GPU 进程偶发崩溃不作为本机桌面会话结果的替代或反证。
  5. 核验完整 diff、禁止范围、ASAR unpack 配置、Main-only SQLite 导入边界和 Renderer/Preload 公开面；未发现 T004、ORM、业务 CRUD、AI、真实数据访问或原始 SQL API。
  6. 执行标准 `npm.cmd run package`，使用配置的本地 `electronDist` 生成 NSIS 和 `win-unpacked`；push 并更新 PR #3，GitHub-hosted Windows required gate 在实现 revision 和最终文档收口 head 上均成功执行完整 `verify`。
- **Result**：
  - `better-sqlite3@13.0.1` 的 Win32 x64 N-API 预构建在 Node、Electron Main、unpacked 和 packaged executable 中实际加载；packaged 文件 smoke 返回 `bound file value`、`mode=wal`、`foreignKeys=1`、`napi=10`。
  - 初始 schema 为 version 1，migration 显式、顺序、事务化；连接验证 `foreign_keys=1` 与 `journal_mode=wal`。Repository 与 Unit of Work 只提供 DTO/端口约定与持久化适配，不实现业务命令或 T004。
  - 交互式本机 `verify` 和实现 head hosted `verify` 均 exit code 0；最终 PR 文档收口 head 的 hosted `verify` 再次通过，满足 T003 合同 15.13；标准 `package` 也以 exit code 0 完成。临时根/工作目录修复后未再向工作区写入异常运行时目录。
- **Artifacts**：
  - PR #3：<https://github.com/Fyrefly-4/MyTracer/pull/3>，base `dev`；已于 2026-08-09 合并为 `2ea8c6cb8584e4bf4d517938efacf68813f33604`。PR 正文保留早期 pending 描述，已由 PR 内最终证据提交、本记录和 G2 PR #5 取代。
  - 实现 head 成功 CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31297398066/job/93204634867>；最终 PR head 成功 CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31297738034/job/93205463074>。
  - 本地 `release/win-unpacked/MyTracer.exe`，225442304 bytes，SHA-256 `E43FBB06840D0557FC7E547966C0E4B2A039C04B7836E1AC44E33ACC23AB7A9D`；`release/MyTracer-0.1.0-x64-setup.exe`，SHA-256 `10D7C9CB81D38175CB04076D93262F8924DCF778BB5C55D51D265CA50561460B`。
- **Manual acceptance**：not-required；没有产品体验 AC。项目所有者仍控制 PR Ready 与 merge。
- **Known limitations**：Codex 桌面非交互式宿主的 GPU 进程仍可能偶发崩溃；交互式 Windows 桌面会话和 GitHub-hosted Windows 已在最终实现 revision 成功执行 E2E/`verify`。本任务不声明 FR-D01 业务功能、AC、T004 或 G2 完成。
- **Supersedes / superseded by**：本记录以实现 revision `b7f2090` 的成功验证及最终 PR head `f7dc0b1` 的再次验证取代先前同 Evidence ID 的 partial 记录和 PR 正文早期 pending 描述。
- **Recorded at**：2026-08-09

### EV-T004-001

- **Status**：pass
- **Task / Gate**：T004 / S0 E0-04；不声明 G2、任何业务 FR 或 AC-01～AC-07 通过
- **Requirements**：FR-AI09、FR-D05（仅未配置/不可用降级前置，不声明 FR 完成），FR-D01（仅 T003 SQLite 回归）；D-009、D-015～D-017、D-106、D-109；ED-001、ED-003、ED-004、ED-010、ED-017～ED-019；GW-001～GW-004、GW-008～GW-010
- **Source branch**：`task/T004-localdate-diagnostics`
- **Source revision**：实现与测试 head `0e9bf1f15614454f5618d5c910fe498dfa3de7ba`；最终 PR head `f98ce1b6b3d78c4b6d14276240bfbb57f45bcc98`；基线 `2ea8c6cb8584e4bf4d517938efacf68813f33604`（T003 PR #3 merge commit）
- **CI head/merge revision**：实现与测试 head `0e9bf1f15614454f5618d5c910fe498dfa3de7ba` 的 run `31301330217` / job `93214485837` success；证据收口 head `59da81339fea3fa22e4a658673cbf2d0d3106ae9` 的 run `31301594315` / job `93215142476` success；最终 PR head `f98ce1b6b3d78c4b6d14276240bfbb57f45bcc98` 的 run `31302167003` / job `93216596963` success；squash merge commit `2e95680c1965110b0d92ec54f9b28c6aee7df556`
- **Environment**：
  - 本地：Microsoft Windows NT 10.0.26200.0，AMD64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；electron-builder 26.15.3；`better-sqlite3@13.0.1` Win32 x64 N-API 预构建。
  - CI：GitHub-hosted Windows x64；workflow `Verification`，稳定 job `Windows required gate`。Hosted CI 运行完整 `verify`，不运行 package/NSIS 冒烟。
  - 数据和凭据：unit/integration/E2E/package smoke 使用 T002 的唯一 OS 临时根、独立数据库与独立 `userData`；日期测试使用 FakeClock/受控 SystemClock 输入。没有真实 Electron `userData`、真实数据库、真实配置、真实 key、Provider、SDK 或 live AI 请求。
- **Command or manual procedure**：
  1. 启动前实时核验 PR #3 已 merge、`origin/dev=2ea8c6c` 且包含 T003，最终 hosted Windows gate run `31297738034` / job `93205463074` success；核验工作树、worktree 和任务无重叠后，从该基线创建任务分支。
  2. 执行 LocalDate/Clock/diagnostics/configuration 针对性 unit tests、`tests/integration/main-foundations.test.ts` 和 Electron E2E；在发现测试 TypeScript 配置缺少已批准 Domain include 后，按项目所有者补充授权仅将 `src/domain/**/*.ts` 纳入 `tsconfig.test.json`。
  3. 最终执行 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、35 个 unit tests、9 个 integration tests、build 和 Electron shell E2E pass；package smoke 在聚合 E2E 中按设计 skip，证明 `verify` 未调用 package/安装。
  4. 最终执行 `npm.cmd run package`，exit code 0，生成 Windows x64 `win-unpacked` 和 unsigned NSIS；执行 `npm.cmd run test:package-smoke`，exit code 0，实际启动 unpacked 和静默安装到临时根的 NSIS 应用，分别注入独立 `userData`，打开 schema v1 数据库、读取 shell `not-configured`，再关闭、静默卸载和精确清理。
  5. 运行产物哈希/Authenticode、临时根和进程检查；最终 package smoke 后无新增 `mytracer-tests-*` 根、无 MyTracer 进程。相对 `origin/dev` 复核完整 diff、依赖/锁文件增量、Renderer/Preload 公开面、safeStorage/配置/诊断调用和 SQLite 禁止范围。
  6. push 实现检查点并创建到 `dev` 的 Draft PR #4；GitHub-hosted `Windows required gate` 在上述实现 head 上完成完整 `verify` 并 success。
- **Result**：
  - `LocalDate` 严格验证规范 Gregorian `YYYY-MM-DD`，纯日期计算周一至周日范围；SystemClock 从同一瞬时值的本地年/月/日生成今天，不用 UTC 截断。跨午夜默认返回 `requires-confirmation`，只有显式 `keep-original`/`use-today` 才解析最终日期。
  - DiagnosticsPort 只有封闭 code/severity/correlation/category/Clock timestamp；非法关联 ID 被无阻塞丢弃，clock/writer 失败不阻塞调用方。测试和 diff 检查未发现绝对路径、key/token/password/secret、环境变量正文、数据库/SQL、用户正文或 AI 正文进入诊断事件。
  - Main-only 空配置始终返回 `not-configured`；safeStorage 空适配器只调用 `isEncryptionAvailable()`，不可用或抛错均降级，不调用 encrypt/decrypt，不读写配置、凭据、SQLite 或网络。Renderer 仍只得到 `window.myTracer.shell.getStatus`，Node/require/process/safeStorage 均不可见。
  - unpacked 与 NSIS 安装态均实际加载打包的 SQLite native addon、初始化隔离 schema v1、返回零 AI 配置并退出；临时安装使用其卸载器，最终成功运行未留下新测试根或进程。
  - 无新增/升级依赖，`package-lock.json` 无变化；未修改 SQLite schema/migration/Repository，未实现业务 CRUD、统计、导出、AI Provider 或 ORM。
- **Artifacts**：
  - PR #4：<https://github.com/Fyrefly-4/MyTracer/pull/4>，base `dev`；Agent 最初按授权创建为 Draft，后由项目所有者控制 Ready，并于 2026-08-09 合并为 `2e95680c1965110b0d92ec54f9b28c6aee7df556`。
  - 实现与测试 head 成功 CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31301330217/job/93214485837>。
  - 首次证据收口 head 成功 CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31301594315/job/93215142476>。
  - 最终 PR head 成功 CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31302167003/job/93216596963>。
  - `release/win-unpacked/MyTracer.exe`，225442304 bytes，SHA-256 `F4D71E5FDBCDDDDF8288121C29B7D1DCF7262D452DBD85BC6DE7501436927F37`，Authenticode `NotSigned`。
  - `release/MyTracer-0.1.0-x64-setup.exe`，109186128 bytes，SHA-256 `F3FCE25E8D1F369BB76C356648A470289D1E5416C332E9822D86E33C86073CA4`，Authenticode `NotSigned`。
  - `release/win-unpacked/resources/app.asar`，8618160 bytes，SHA-256 `0613D40A24B7059A00BB4C732C4B04C5235790D6DADB69D29D48940132AF63C8`。
  - packaged `better-sqlite3/prebuilds/win32-x64.node`，1988096 bytes，SHA-256 `267C4B26C677C44E2D388A4CF438BA28BF2D2457A800D51DC983CA0696C5C789`。
- **Manual acceptance**：pass；项目所有者于 2026-08-09 在 G2 收口时明确确认 unpacked/NSIS 窗口观察通过；本任务仍不声明产品体验 AC
- **Known limitations**：开发产物未签名；package/NSIS 冒烟只有本地 Windows 证据，hosted gate 只运行 `verify`。OS 临时目录存在最终成功验证前形成、无法重新证明 ownership token 的旧 `mytracer-tests-*` 根，按 containment/ownership 不变量未越权删除；最终成功验证没有新增残留。所有业务 FR、AC-01～AC-07 仍 pending；G2 的独立通过证据见 `EV-G2-001`
- **Supersedes / superseded by**：无；后续证据文档收口提交不修改本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-09

### EV-T011-001

- **Status**：pass
- **Task / Gate**：T011 / S1 E1-01；不声明 G3/S1、完整 AC-01 或任何后续切片通过
- **Requirements**：FR-G01～FR-G06；AC-01 步骤 1～2贡献；D-002、D-101；ED-003～ED-006、ED-015、ED-018、ED-019；S1-Q02-B、S1-Q05-A
- **Source branch**：`task/T011-goal-lifecycle`
- **Source revision**：`c4e9f6dee3cbab97f6902f2c90f97f96423b43e2`；启动基线 `54b6368c0a2b4da0721838541f60c0d2eb55aa1a`
- **CI head/merge revision**：PR #7 head `15c6aac83d1ec1033c30c998e4ebe4fd155616e1`；Windows required gate run `31315945537` / job `93251084626` 为 `success`；尚未 merge
- **Environment**：Microsoft Windows NT 10.0.26200.0；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3@13.0.1`；所有自动化数据库和 Electron `userData` 均位于每 case/进程唯一 OS 临时根；AI 未配置，无 live Provider 或真实用户数据
- **Command or manual procedure**：
  1. 执行 `npm.cmd run test:unit`：9 个测试文件、42 项测试通过，覆盖 Goal 创建/修改、合法和非法状态转换、ended 终态、同 Goal pending 当前下一步、active 限制、Application 原子编排和失败回滚。
  2. 执行 `npm.cmd run test:integration`：6 个测试文件、17 项测试通过；其中 T011 SQLite/IPC 覆盖真实 v1 schema、循环引用三步写入、故障零变化、跨 Goal/非 pending/缺失引用拒绝、历史及当日 TodaySelection 守恒、只读查询、UUID/DTO 校验和真实 sender/origin 拒绝。
  3. 在可启动 Windows 桌面进程的非受限执行环境运行 `npm.cmd run test:e2e`：Goal 生命周期 E2E 与既有 shell E2E 通过；package smoke 按既有条件跳过。Goal E2E 从 UI 创建 Goal 与内联 pending Action，修改、清空/恢复当前下一步、pause/resume/end，完全关闭 Electron 与 SQLite 后使用同一隔离 `userData` 重开，并只读检查数据库关系。
  4. 在实现 revision `c4e9f6dee3cbab97f6902f2c90f97f96423b43e2` 最终执行 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、42 项 unit、17 项 integration、Main/Preload/Renderer build、2 项 Electron E2E 全部通过；1 项 Windows package smoke 按设计 skip。
  5. 执行 `git diff --check`、精确允许文件扫描、依赖/lockfile/schema/migration diff 检查，并对完整任务 diff 按 AGENTS.md 与合同进行第二遍只读审查；未发现越界文件、依赖或 schema 变化、真实数据路径、延期能力、AI 权限扩大或未处理重大问题。
  6. 项目所有者按 T011 人工体验清单检查轻量创建、下一步清晰度、中性文案、pause/end 保留语义和 ended 终态，并于 2026-08-09 报告 `T011 人工验收通过`。
  7. PR #7 的 Windows required gate 在 head `15c6aac83d1ec1033c30c998e4ebe4fd155616e1` 完成并返回 `success`；项目所有者随后 review 并确认 T011 完成。
- **Result**：
  - Renderer → 冻结 Preload Goal API → 固定 Main IPC → Application/Domain → SQLite 的创建、修改、pause、resume、end、当前下一步、ListGoals/GetGoalDetail 纵向路径可用；错误仅返回稳定中性 code/message。
  - 创建 Goal 可不带下一步；带下一步时在一个事务中按 Goal 空引用 → 同 Goal pending Action → Goal 引用写入，注入 Action 写入失败后两表均为空。
  - 当前下一步可空，非空仅接受同 Goal pending Action；T011 的设置/清空/替换只允许 active Goal。pause/end 保留当前引用、关联 Action/Routine/Record 和当日 TodaySelection；paused 可 resume，ended 为终态。
  - GetGoalDetail 可读取当前下一步、关联 Action、已有 ActionRecord 摘要和只读当日选择标记；重复查询不写数据库。完全关闭连接/应用后重开，Goal 状态、Action ID/状态、引用和历史摘要一致。
  - `package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 均未修改；无新增/升级依赖、网络访问、live AI、真实 `userData` 或外部写入。
- **Artifacts**：
  - 实现与测试位于 `task/T011-goal-lifecycle`，实现验证绑定 revision `c4e9f6dee3cbab97f6902f2c90f97f96423b43e2`；T011 合同为 `docs/implementation/T011_GOAL_LIFECYCLE_TASK.md`。
  - Draft PR #7：<https://github.com/Fyrefly-4/MyTracer/pull/7>；hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31315945537>。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时测试数据库、结果和 `userData` 均位于 OS 临时目录并由测试清理。
- **Manual acceptance**：pass；项目所有者于 2026-08-09 报告轻量创建、文案、pause/end 保留与 ended 终态体验检查通过
- **Known limitations**：PR #7 仍为 Draft 且未 merge；未执行 package/NSIS 冒烟（不在 T011 合同范围，聚合 E2E 中按设计 skip）；受限沙箱内 Electron GPU 进程无法可靠启动，最终 E2E/`verify` 已在获准的非受限 Windows 桌面执行环境通过；T011 只贡献 AC-01 步骤 1～2，完整 AC-01 须在 T014 后同一 revision 执行；T012 尚未获得合同批准或实现启动授权
- **Supersedes / superseded by**：无
- **Recorded at**：2026-08-09

### EV-T012-001

- **Status**：pass
- **Task / Gate**：T012 / S1 E1-02；不声明 G3/S1、完整 AC-01 或任何后续切片通过
- **Requirements**：FR-A01～FR-A04、FR-A06；FR-A05 的 Action 状态与 `partial` 解耦部分；FR-T01、FR-T04、FR-T05、FR-T08；AC-01 步骤 3 贡献；D-004、D-005、D-016、D-106；ED-003～ED-007、ED-015、ED-018、ED-019；S1-Q03-B、S1-Q05-A、S1-Q06-A、S1-Q07-A
- **Source branch**：`task/T012-action-today`
- **Source revision**：`56b3446a1b952a9bdb6fe29ab4a89502171ba321`；启动基线 `7cb5bebd8c2d0e66056d2b34189d084e78261b41`
- **CI head/merge revision**：Draft PR #9 实现 head `56b3446a1b952a9bdb6fe29ab4a89502171ba321`；Windows required gate run `31359250988` / job `93364691450` 为 `success`；尚未 merge
- **Environment**：Microsoft Windows NT 10.0.26200.0；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3@13.0.1`；所有自动化数据库和 Electron `userData` 均位于每 case/进程唯一 OS 临时根；AI 未配置，无 live Provider 或真实用户数据
- **Command or manual procedure**：
  1. 执行 `npm.cmd run test:unit`：54 项测试通过，覆盖 Action 状态机、创建/修改、当前下一步 resolution、Today 显式选择、`partial` 与 Action 状态解耦及失败零变化。
  2. 执行 `npm.cmd run test:integration`：24 项测试通过，覆盖真实 v1 SQLite schema、事务回滚、Today complete/cancel 保留、reschedule 删除与同 ID 恢复 pending、跨日只读查询、重开、IPC DTO 和 sender/origin 拒绝。
  3. 在可启动 Windows 桌面进程的环境执行 `npm.cmd run test:e2e`：3 项 Electron E2E 通过，覆盖 Renderer → Preload → Main/Application → SQLite 的 Action/Today 路径、真实关闭重开、跨日与输入焦点回归；1 项 package smoke 按既有条件跳过。
  4. 在实现 revision `56b3446a1b952a9bdb6fe29ab4a89502171ba321` 执行 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、54 项 unit、24 项 integration、Main/Preload/Renderer build 和 3 项 Electron E2E 全部通过。
  5. 执行 `git diff --check`、完整任务 diff、允许文件、依赖/lockfile/schema/migration 扫描和独立只读审查；未发现越界依赖、migration、`001_initial.sql` 修改、延期能力或未处理重大问题。
  6. 项目所有者于 2026-08-10 完成 T012 人工清单，并复验“标记完成、取消行动、重新安排、移出当天”等路径及 T011/T012 `window.confirm` 输入焦点缺陷，报告全部通过。
  7. Draft PR #9 的 Windows required gate 在实现 head `56b3446a1b952a9bdb6fe29ab4a89502171ba321` 完成并返回 `success`。
- **Result**：
  - `CreateAction`、`UpdateActionDetails`、`CompleteAction`、`CancelAction`、`RescheduleAction`、`SelectActionForToday`、`RemoveActionFromToday`、`GetActionDetail` 和 `GetToday` 的纵向路径可用，Renderer 仅访问冻结意图级 API。
  - Action 状态为 pending/completed/cancelled/rescheduled；`partial` 不是 Action 状态且不会自动触发转换。Action 可无 Goal；创建时非空 Goal 必须 active，T012 不提供 Goal 重分配。
  - 当前下一步 Action 的 complete/cancel/reschedule 与 clear/use-existing/create-and-use 在同一事务完成；reschedule 复用 ID、移出当日 Today 并仅在用户再次选入时恢复 pending。
  - complete/cancel 保留当天 TodaySelection 并显示不可开始终态；Today 仅接受用户对 Main 当前 LocalDate 的显式选择，无硬上限、不自动搬运，Query 不写入。
  - paused/ended Goal 的既有 TodaySelection 保留 Goal 状态与不可操作原因，不允许新增 focus 或开始行动；关闭重开与跨 LocalDate 结果保持一致。
  - `package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 均未修改；无新增/升级依赖、live AI、真实 `userData` 或任务 GitHub flow 之外的外部写入。
- **Artifacts**：
  - 实现与测试位于 `task/T012-action-today`，实现验证绑定 revision `56b3446a1b952a9bdb6fe29ab4a89502171ba321`；任务合同为 `docs/implementation/T012_ACTION_TODAY_TASK.md`。
  - Draft PR #9：<https://github.com/Fyrefly-4/MyTracer/pull/9>；hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31359250988>。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时测试数据库、结果和 `userData` 均位于 OS 临时目录并由测试清理。
- **Manual acceptance**：pass；项目所有者于 2026-08-10 报告 T012 人工验收与 T011/T012 输入焦点回归复验全部通过
- **Known limitations**：PR #9 仍为 Draft 且未 merge；package/NSIS smoke 不在 T012 合同范围并按设计跳过；文档收口 head 的新 CI 按项目所有者明确指令不等待，本证据绑定已通过 hosted gate 的实现 revision；T012 只贡献 AC-01 步骤 3，FR-A05 仍需 T013 的实际 `partial` ActionRecord 证据，完整 AC-01 仍需 T013/T014
- **Supersedes / superseded by**：无；文档收口提交不修改本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-10

### EV-T013-001

- **Status**：pass
- **Task / Gate**：T013 / S1 E1-03；不声明 G3/S1、完整 AC-01 或任何后续切片通过
- **Requirements**：FR-A05；FR-A08 的 T013 显式入口部分；FR-L01～FR-L06、FR-L08；FR-C01；AC-01 步骤 4～5 贡献；D-006、D-103～D-106；ED-012、ED-015～ED-017；S1-Q03-B、S1-Q04-B、S1-Q07-A、S1-Q08-B、S1-Q10-A
- **Source branch**：`task/T013-action-record`
- **Source revision**：`b10d5d40c4c1dc1f7a20801d5d904b1d37953270`；启动基线 `b994962618954cf02f9e07590d68213d0378bccb`
- **CI head/merge revision**：Draft PR #10 实现 head `b10d5d40c4c1dc1f7a20801d5d904b1d37953270`；Windows required gate run `31613036396` / job `94168900557` 为 `success`；尚未 merge。失败 run `31609393753` 与 `31612362422` 分别暴露 hosted E2E 总时限和 Renderer 测试状态同步问题，均由后续提交修复并被最终成功 run 取代
- **Environment**：本地 Microsoft Windows 11 x64、Node.js 24.18.0、npm 11.16.0、Electron 43.3.0、`better-sqlite3@13.0.1`；CI 为 GitHub-hosted Windows x64；所有自动化数据库和 Electron `userData` 均位于每 case 唯一 OS 临时根；AI 未配置，无 live Provider 或真实用户数据
- **Command or manual procedure**：
  1. 执行 `npm.cmd run test:unit`：66 项测试通过，覆盖 ActionRecord outcome、非负整数分钟与 0 分钟、manual Understanding、open Confusion、状态门、默认 keep-pending、显式 post-record、跨午夜和只读 Query。
  2. 执行 `npm.cmd run test:integration`：33 项测试通过，覆盖真实 v1 SQLite schema、Today 非前置、父/子/Action/Goal/Today 各写点事务回滚、关闭连接重开，以及固定 IPC、sender/origin 与无效 context 零写入。
  3. 在可启动 Windows 桌面进程的环境执行 `npm.cmd run test:e2e`：5 项 Electron E2E 通过，覆盖快速/深入记录、0 分钟 partial、显式 post-record、跨午夜确认、取消/reload context 失效、未选入 Today 仍可记录及真实关闭重开；1 项 package smoke 按既有 opt-in 条件跳过。
  4. 在实现候选上执行 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、66 项 unit、33 项 integration、Main/Preload/Renderer build 和 5 项 Electron E2E 全部通过。
  5. 执行 `git diff --check`、完整任务 diff、允许文件、依赖/lockfile/schema/migration 扫描和独立只读审查；审查发现的跨时区 E2E 与逐写点回滚证据问题已在 `fd2957b1e87be98a8bbef92e762035e61bb28200` 修复，无未解决重大问题。
  6. Draft PR #10 的 Windows required gate 在实现 head `b10d5d40c4c1dc1f7a20801d5d904b1d37953270` 完成并返回 `success`。
  7. 项目所有者于 2026-08-12 按 T013 人工清单检查快速层、深入字段、partial/stopped/0 分钟、显式 post-record、取消/reload、关闭重开和中性文案，并报告测试通过。
- **Result**：
  - `BeginActionRecording`、`CancelActionRecording`、`RecordAction`、记录列表与详情形成 Renderer → Preload → Main/Application → SQLite 的完整路径；TodaySelection 不是记录前置条件。
  - 快速层只要求非负整数分钟与 completed/partial/stopped；0 分钟表示不足一分钟但确有行动。Understanding、Confusion、nextStep 与 note 均为可选深入字段。
  - ActionRecord outcome、Action 状态和 Goal 当前下一步保持独立；默认 keep-pending，仅用户明确选择时在同一事务应用 Action/下一步变化。T012 与 T013 的合并证据完成 FR-A05。
  - Main 内存 context 绑定受信 sender、Action 与捕获 LocalDate；跨午夜首次保存零写入并要求明确选择，伪造、失效、已消费或不匹配 context 均零写入。
  - ActionRecord、manual Understanding、open Confusion 与显式 post-record 变化原子保存；列表/详情只读且真实关闭重开后保持一致。
  - `package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 均未修改；无新增/升级依赖、live AI、真实 `userData` 或任务 GitHub flow 之外的外部写入。
- **Artifacts**：
  - 实现与测试位于 `task/T013-action-record`，实现验证绑定 revision `b10d5d40c4c1dc1f7a20801d5d904b1d37953270`；任务合同为 `docs/implementation/T013_ACTION_RECORD_TASK.md`。
  - Draft PR #10：<https://github.com/Fyrefly-4/MyTracer/pull/10>；成功 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31613036396>。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时测试数据库、结果和 `userData` 均位于 OS 临时目录并由测试清理。
- **Manual acceptance**：pass；项目所有者于 2026-08-12 报告 T013 人工测试通过
- **Known limitations**：PR #10 仍为 Draft 且未 merge；package/NSIS smoke 不在 T013 合同范围并按设计跳过；T013 不实现 FR-L07、FR-L09 或 FR-C04，只贡献 AC-01 步骤 4～5，完整 AC-01 仍需 T014 步骤 6 后执行
- **Supersedes / superseded by**：成功 run `31613036396` 取代失败 run `31609393753` 与 `31612362422`；后续文档收口提交不修改本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-12

### EV-G2-001

- **Status**：pass
- **Task / Gate**：G2 工程就绪；聚合 T001～T004，不新增业务 FR 或 AC 完成声明
- **Requirements**：S0 / E0-01～E0-04；任务证据 `EV-T001-001`～`EV-T004-001`
- **Source branch**：`dev`
- **Source revision**：`2e95680c1965110b0d92ec54f9b28c6aee7df556`，包含 T001～T004 的四个 squash merge commit
- **CI head/merge revision**：GitHub Actions run `31302341732` / job `93217046549` 在同一 source revision 上 success；里程碑 PR #5 merge commit `7cc047e8442d075fb308321ce799d0e8dc2538bf`
- **Environment**：本地 Windows 11 x64、Node.js 24.18.0、npm 11.16.0；CI 为 GitHub-hosted Windows x64、`Verification / Windows required gate`
- **Command or manual procedure**：
  1. 在 source revision `2e95680c1965110b0d92ec54f9b28c6aee7df556` 执行 `npm.cmd run verify`；format、lint、typecheck、35 个 unit tests、9 个 integration tests、build 和 Electron E2E 均通过。
  2. 执行 `npm.cmd run package` 和独立 `npm.cmd run test:package-smoke`；Windows x64 unpacked 与隔离 NSIS 安装态实际启动、关闭和清理成功。
  3. 核对 `EV-T001-001`～`EV-T004-001`、四个任务 PR 的合并状态、最终 Windows CI 和已知限制。
  4. 项目所有者于 2026-08-09 确认 G2 与 T004 可选窗口观察通过；随后 PR #5 以 merge commit 方式合入 `main`。
- **Result**：T001～T004 工程基础、最终聚合验证、Windows 打包/运行冒烟和所有者 G2 验收完整；G2 通过。该结果不实现或验收任何业务 FR、AC-01～AC-07。
- **Artifacts**：
  - 里程碑 PR #5：<https://github.com/Fyrefly-4/MyTracer/pull/5>，`dev -> main`，已于 2026-08-09 合并。
  - Hosted Windows：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31302341732/job/93217046549>。
  - `release/win-unpacked/MyTracer.exe`：SHA-256 `F4D71E5FDBCDDDDF8288121C29B7D1DCF7262D452DBD85BC6DE7501436927F37`。
  - `release/MyTracer-0.1.0-x64-setup.exe`：SHA-256 `40E907DF28C9A3518E1830FC2D6F0192D5CDCEF7AFEF382217B9CE07CAAF12D2`。
- **Manual acceptance**：pass；项目所有者于 2026-08-09 明确确认
- **Known limitations**：`main`/`dev` 当时未配置 branch protection 或 required check；workflow 不因 `main` 目标 PR 触发，故使用绑定同一 source SHA 的 `dev` push run；Windows 产物未签名并使用默认 Electron 图标；所有业务 FR 和 AC-01～AC-07 仍 pending
- **Supersedes / superseded by**：取代本账本此前的 G2 `pending` 状态；不取代各任务证据
- **Recorded at**：2026-08-09

## 5. 阶段门证据索引

| Gate | Required scope | Evidence | Status | Owner acceptance |
|---|---|---|---|---|
| G1 设计就绪 | 架构、领域、数据、AI、测试、追踪 | `docs/architecture/` 最终基线 | pass | 已确认 |
| G2 工程就绪 | T001～T004 | `EV-G2-001` | pass | 已确认 |
| G3 切片完成 | 各切片对应任务 | — | pending | pending |
| G4 Demo 就绪 | AC-01～AC-07、数据安全、已知限制 | — | pending | pending |
| G5 使用验证 | 7～14 天真实自用 | — | pending | pending |

G1 的设计结论不是代码、CI、Windows 打包或产品验收证据。

## 6. AC 证据索引

| AC | Automated evidence | Manual evidence | Status |
|---|---|---|---|
| AC-01 | `EV-T011-001`（步骤 1～2）；`EV-T012-001`（步骤 3）；`EV-T013-001`（步骤 4～5） | T011～T013 对应人工清单已通过；完整路径仍待 T014 步骤 6 后执行 | pending |
| AC-02 | — | — | pending |
| AC-03 | — | — | pending |
| AC-04 | — | — | pending |
| AC-05 | — | — | pending |
| AC-06 | — | — | pending |
| AC-07 | — | — | pending |

## 7. CI 证据要求

CI 启用后，记录：

- workflow 和 job 名称；
- run URL 和 run ID；
- event、base、head SHA；
- 检查验证的是 PR head 还是测试 merge revision；
- required check 是否对应最新 revision；
- Windows runner、打包和原生 SQLite 是否实际执行；
- artifact 名称和校验信息（如适用）。

只有历史依赖验证需要完整 Git 历史时才把 checkout 配置为全历史，并在证据中说明原因；不要仅为了形式增加成本。

## 8. 人工验收要求

项目所有者至少亲自判断：

- Today 和快速记录是否足够轻；
- 文案是否中性且不制造失败压力；
- unknown、休息、partial 和达标是否可区分；
- 中断恢复是否减轻重新整理负担；
- AI 建议是否温和、相关、可编辑和可拒绝；
- 安装、重开、导出和真实 Windows 使用是否符合预期。

Agent 只提供步骤和观察位置，不得替项目所有者签署人工验收。

## 9. 当前结论

- G1 架构基线已批准。
- T001 工程实现、Windows x64 unpacked/unsigned NSIS 产物、运行时验证和项目所有者人工验收已记录为 `EV-T001-001`。
- T001 未建立 CI，未执行 AC-01～AC-07，也不使 G2 自动通过。
- T002 验证工具链、测试替身、临时根、Electron E2E 和 hosted Windows CI 已记录为 `EV-T002-001`；它不执行 AC-01～AC-07，也不使 G2 自动通过。
- T003 SQLite 基础、隔离验证和 Windows x64 原生模块证据已记录为 `EV-T003-001`；它不声明业务 FR、任何 AC、T004 或 G2 完成。
- T004 LocalDate/Clock、诊断、空配置/safeStorage 边界和本地 Windows 打包冒烟已记录为 `EV-T004-001`；它不声明业务 FR、任何 AC 或 G2 完成。
- G2 已由 `EV-G2-001` 绑定 T001～T004、最终 `dev` source revision、聚合验证、Windows package smoke、PR #5 和项目所有者验收；不声明任何业务 FR 或 AC-01～AC-07 完成。

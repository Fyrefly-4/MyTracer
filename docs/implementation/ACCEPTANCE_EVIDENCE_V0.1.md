# MyTracer v0.1 验收证据

> 文档状态：证据账本已建立；已记录 T001～T002 工程实现证据
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
| `EV-T003-001` | T003 | `e52ee24f8f94eb9596468c0fe8bd1a20bdc97e1c` | SQLite schema/migration、Repository 契约、Windows x64 native addon | partial | not-required | hosted Windows `verify` 和 packaged-native 冒烟通过；本机 Playwright Electron E2E 崩溃，未把 hosted 结果替代本机门槛 |

### EV-T001-001

- **Status**：pass
- **Task / Gate**：T001 / S0 E0-01；不声明 G2 通过
- **Requirements**：D-001、D-003、D-015～D-017；ED-001、ED-002、ED-004、ED-019；GW-001～GW-004、GW-009、GW-010
- **Source branch**：`task/T001-electron-shell`
- **Source revision**：`090e848d066f6f56d772181621ff211313667aa6`
- **CI head/merge revision**：不适用；T001 未获批建立 CI，Draft PR 远端检查仍可能为空
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
  - Draft PR #1：`https://github.com/Fyrefly-4/MyTracer/pull/1`，base `dev`，head `task/T001-electron-shell`；创建时无 CI checks。
- **Manual acceptance**：pass；项目所有者于 2026-08-08 明确确认人工验收通过
- **Known limitations**：T002 尚未建立 lint、format、自动 typecheck、单元/集成/E2E 或 CI；生产 Renderer 按已批准 ED-019 使用本地 `file://`，后续可评估自定义协议加固；受限导航允许页面进入 `about:blank` 自空白但不加载外部内容或扩大权限；未声明 AC-01～AC-07 或 G2 通过
- **Supersedes / superseded by**：无
- **Recorded at**：2026-08-08

### EV-T002-001

- **Status**：pass
- **Task / Gate**：T002 / S0 E0-02；不声明 G2 通过
- **Requirements**：D-015、D-017；ED-004、ED-010、ED-011、ED-019；GW-002、GW-004、GW-008～GW-010；无直接 FR/AC 完成声明
- **Source branch**：`task/T002-validation-toolchain`
- **Source revision**：实现 revision `f60a38c4e69b8bead2aa8975c6fdb6886bec220a`；后续仅有本记录、合同和任务索引的证据收口，不改变工具链、测试或生产源码
- **Base revision**：`e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`（T001 PR #1 merge commit，执行前与发布前均核验为最新 `origin/dev`）
- **CI head/merge revision**：PR head `f60a38c4e69b8bead2aa8975c6fdb6886bec220a`；Actions 实际 checkout `c6968d4f7d53ff5ff1a32d8f32909707eb05075b`（merge head into `e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`）
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
  - 首次 hosted run `31241382835` 在 head `5b68585` 因 Windows CRLF 与 Prettier 默认 LF 不一致失败；由 `endOfLine: auto` 修复。最终 run `31241614350` 在 head `f60a38c` / merge `c6968d4` 上执行完整 `verify` 并 success；稳定 check 名称为 `Windows required gate`。
  - 最终 diff 不修改 `src/**`，不含 SQLite/migration、业务能力、真实 Provider/SDK/key、Renderer 后门或未批准依赖；README、AGENTS、任务模板、CI 与 package scripts 使用同一命令集。
- **Artifacts**：
  - Draft PR #2：`https://github.com/Fyrefly-4/MyTracer/pull/2`，base `dev`，保持 Draft。
  - 最终成功 run：`https://github.com/Fyrefly-4/MyTracer/actions/runs/31241614350`；job `93063462617` / `Windows required gate`。
  - 被取代的失败 run：`https://github.com/Fyrefly-4/MyTracer/actions/runs/31241382835`；失败原因和修复均保留于本记录。
  - 不持久化 Playwright screenshot/trace/video；临时结果和数据根均位于 OS 临时目录并已清理。
- **Manual acceptance**：not-required；本任务没有产品体验 AC。项目所有者仍控制 PR 评审、Ready、merge 和后续阶段授权
- **Known limitations**：Prettier 过渡性精确排除 3 个 T001 生产文件和 1 个技能元数据文件，避免 T002 越界格式化；Playwright Electron API 仍为 experimental；Electron 43 二进制需要单独按需恢复；`Windows required gate` 已稳定报告但未获授权配置为 branch-protection required；T003 SQLite/migration、T004 生产日期/配置/safeStorage、T061～T063 正式 AI 仍待实现；AC-01～AC-07 和 G2 均未验证/未通过
- **Supersedes / superseded by**：成功 run `31241614350` supersedes 失败 run `31241382835`；本证据不 supersede `EV-T001-001`
- **Recorded at**：2026-08-08

### EV-T003-001

- **Status**：partial
- **Task / Gate**：T003 / S0 E0-03；不声明 T003、G2、FR-D01 或任何 AC 通过
- **Requirements**：FR-D01（仅持久化基础，不声明功能完成）；D-003、D-009、D-015～D-017、D-103、D-106、D-111；ED-003～ED-006、ED-008～ED-009、ED-012、ED-014～ED-018；GW-001～GW-004、GW-008～GW-010
- **Source branch**：`task/T003-sqlite-migrations`
- **Source revision**：实现 `e52ee24f8f94eb9596468c0fe8bd1a20bdc97e1c`；本记录的后续文档提交不修改生产或测试源码
- **Base revision**：`e64929057724f6458a798479d19de41a710a3028`（T002 PR #2 merge commit；启动前核验为最新 `origin/dev`）
- **CI head/merge revision**：PR head `e52ee24f8f94eb9596468c0fe8bd1a20bdc97e1c`；GitHub Actions run `31291951212`，job `93190541550`，`Verification / Windows required gate` 成功
- **Environment**：
  - 本地：Windows 11 10.0.26200 x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0（内置 Node 24.17.0）；`better-sqlite3@13.0.1`，N-API 10，SQLite 3.53.3；`@types/better-sqlite3@7.6.13`；electron-builder 26.15.3。
  - CI：GitHub-hosted Windows x64；PR 的完整 `verify` 成功。该 CI 结果证明 T002 隔离 E2E 和 T003 自动化 SQLite 范围，不包含 packaged NSIS 冒烟。
  - 数据：unit/integration 和 Electron native smoke 每 case/进程使用 T002 的唯一 `mytracer-tests-*` 临时根和该根的独立数据库；无真实 Electron `userData`、真实数据库、key、Provider 或 live AI 调用。packaged-native 手动 smoke 使用独立 OS 临时文件数据库；它没有冒充 T002 根验证。
- **Command or manual procedure**：
  1. 执行批准的精确安装、`npm.cmd ci` 和 `npm.cmd ls --depth=0`；顶层树包含且仅新增批准的直接 SQLite 驱动与类型包。
  2. 执行 `npm.cmd run format:check`、`npm.cmd run lint`、`npm.cmd run typecheck`、`npm.cmd run test:unit`、`npm.cmd run test:integration`。结果为 13 个 unit tests、8 个 integration tests 全部通过；后者覆盖实际 Electron native addon、schema v1、foreign keys、WAL、migration、回滚、重开、参数化 SQL 与 Repository 契约。
  3. 以现有 Electron 发行文件作为 `electronDist` 运行 electron-builder，生成 Windows x64 `win-unpacked` 和 NSIS；检查 `app.asar.unpacked/node_modules/better-sqlite3/prebuilds/win32-x64.node`，再用 packaged executable 实际加载 addon 并在隔离临时数据库执行参数绑定读写、`journal_mode=wal` 和 `foreign_keys=1`。
  4. 执行 `npm.cmd run verify`。format、lint、typecheck、unit、integration 和 build 通过；Playwright Electron E2E 在启动后报 `Target crashed`，故命令 exit code 1。`DEBUG=pw:browser` 的先前诊断显示 GPU process `exit_code=-1073741515`；无效的 `--in-process-gpu` 尝试已撤回。
  5. 核验完整 diff、禁止范围、ASAR unpack 配置、Main-only SQLite 导入边界和 Renderer/Preload 公开面；未发现 T004、ORM、业务 CRUD、AI、真实数据访问或原始 SQL API。
  6. push 并创建 Draft PR #3；GitHub-hosted Windows required gate 在实现 revision 上成功执行完整 `verify`。
- **Result**：
  - `better-sqlite3@13.0.1` 的 Win32 x64 N-API 预构建在 Node、Electron Main、unpacked 和 packaged executable 中实际加载；packaged 文件 smoke 返回 `bound file value`、`mode=wal`、`foreignKeys=1`、`napi=10`。
  - 初始 schema 为 version 1，migration 显式、顺序、事务化；连接验证 `foreign_keys=1` 与 `journal_mode=wal`。Repository 与 Unit of Work 只提供 DTO/端口约定与持久化适配，不实现业务命令或 T004。
  - Hosted `verify` 成功，但该本机在完整 E2E 阶段崩溃；因此不满足 T003 合同 15.13 的“本地命令和 hosted Windows CI 均在最终 revision exit code 0”，本记录为 partial 而非 pass。
- **Artifacts**：
  - Draft PR #3：<https://github.com/Fyrefly-4/MyTracer/pull/3>，base `dev`，保持 Draft。
  - 成功 CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31291951212/job/93190541550>。
  - 本地 `release/t003-nsis-probe/win-unpacked/MyTracer.exe`，225442304 bytes，SHA-256 `E43FBB06840D0557FC7E547966C0E4B2A039C04B7836E1AC44E33ACC23AB7A9D`；`release/t003-nsis-probe/MyTracer-0.1.0-x64-setup.exe`，109184801 bytes，SHA-256 `92347F2E70E42C5A15FA5FDBC682B8E76970BE880072D7A78725FEB394625AE1`。
  - 本机失败上下文：`%LOCALAPPDATA%/Temp/mytracer-playwright-results/47176/shell.e2e-runs-the-Electro-dc378-h-an-isolated-userData-root/error-context.md`（仅 `Target crashed`）；无持久化 screenshot/trace/video。
- **Manual acceptance**：not-required；没有产品体验 AC。项目所有者仍控制例外处理、PR Ready 与 merge。
- **Known limitations**：本机 GUI Electron 的 GPU 进程崩溃阻止完整 T002-root E2E 及 packaged 应用的 `userData` 启动冒烟；标准 `npm.cmd run package` 在本机 Electron 解包阶段无响应，因此 packaged 产物通过等价 electron-builder 命令加显式、已安装的 `electronDist` 生成。该替代只证明 packaged native addon，不将其表述为标准 package 命令成功或完整应用 E2E 成功。
- **Supersedes / superseded by**：无；后续在可启动 GUI 的 Windows 环境完成本机 `verify` 和 packaged app temporary-`userData` 冒烟后，应以新的 EV-T003 记录 supersede 本项。
- **Recorded at**：2026-08-09

## 5. 阶段门证据索引

| Gate | Required scope | Evidence | Status | Owner acceptance |
|---|---|---|---|---|
| G1 设计就绪 | 架构、领域、数据、AI、测试、追踪 | `docs/architecture/` 最终基线 | pass | 已确认 |
| G2 工程就绪 | T001～T004 | — | pending | pending |
| G3 切片完成 | 各切片对应任务 | — | pending | pending |
| G4 Demo 就绪 | AC-01～AC-07、数据安全、已知限制 | — | pending | pending |
| G5 使用验证 | 7～14 天真实自用 | — | pending | pending |

G1 的设计结论不是代码、CI、Windows 打包或产品验收证据。

## 6. AC 证据索引

| AC | Automated evidence | Manual evidence | Status |
|---|---|---|---|
| AC-01 | — | — | pending |
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
- T003～T004 继续遵守各自独立前置、依赖和任务授权门禁。

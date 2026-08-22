# MyTracer v0.1 验收证据

> 文档状态：证据账本已建立；已记录 T001～T004、T011～T014、T021～T023、T031、T801/T802、T090/T091、AC-01、AC-03、AC-04、G2、G3/S1 及最终 S2 聚合证据
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
- **Task delivery revision**：证明任务自身合同的最终候选 revision
- **Dev integration revision**：任务实际进入 `dev` 的 merge/squash revision；未合入时填写 `null`
- **Stage final integration revision**：阶段最终聚合 revision；不适用时填写 `null`
- **Integration freshness**：`fresh` / `refreshed-and-passed` / `blocked` / `not-required`，并记录原始基线、最新授权 `dev`、实际验证 revision 和刷新方法
- **CI classification**：`early` / `candidate` / `final-head` / `post-merge`，同时记录对应 head/test-merge revision
- **Environment**：OS、Node、Electron、数据库/fixture、关键工具版本
- **Command or manual procedure**：
- **Result**：
- **Artifacts**：CI URL、日志位置、截图、导出文件或安装包标识
- **Manual acceptance**：not-required / pending / pass / fail
- **Known limitations**：
- **Supersedes / superseded by**：
- **Recorded at**：YYYY-MM-DD

### 3.1 V2 revision and CI boundaries

```yaml
task_delivery_revision: bbb222
dev_integration_revision: ddd444
stage_final_integration_revision: null

integration_freshness:
  original_base_revision: abc123
  latest_authorized_dev_revision: def456
  verified_against_revision: def456
  status: refreshed-and-passed
  refresh_method: merge-dev-into-task-branch

ci:
  early:
    head_revision: aaa111
    result: feedback
  candidate:
    head_revision: bbb222
    result: pass
  final_head:
    head_revision: bbb555
    result: pass
  post_merge:
    merge_revision: ddd444
    result: pass
```

`task_delivery_revision` 证明任务自身合同，`dev_integration_revision` 证明任务进入目标 `dev`，`stage_final_integration_revision` 证明整个阶段在同一最终集成版本成立。Draft PR、early CI 和中间 revision 不能单独证明任务完成。

失败 Evidence 必须保留；后续成功记录通过 `Supersedes / superseded by` 建立关系，不删除失败事实。

### 3.2 Deterministic evidence artifacts

V2 Batch 3 的 deterministic artifact 可以由 `tools/evidence/capture-command.mjs` 生成，并由 `npm.cmd run evidence:verify` 调用。artifact 至少包含以下事实字段：

```json
{
  "schemaVersion": 1,
  "task": "Txxx",
  "gate": "task-candidate",
  "sourceBranch": "...",
  "sourceRevision": "...",
  "baseRevision": "...",
  "platform": "win32",
  "node": "...",
  "electron": "...",
  "command": ["npm.cmd", "run", "verify"],
  "startedAt": "...",
  "finishedAt": "...",
  "exitCode": 0,
  "artifacts": [],
  "ci": {
    "workflow": "...",
    "runId": "...",
    "headRevision": "...",
    "mergeRevision": null
  }
}
```

工具只读取 allowlisted GitHub CI metadata，不保存 stdout/stderr、原始环境变量、凭据、safeStorage、SQLite、用户正文、绝对用户路径或完整日志。失败命令必须保留真实非零退出码；collector 或 metadata validator 失败不得生成通过结论。

在 GitHub `pull_request` run 中，`ci.headRevision` 必须来自 event payload 的 PR head，`ci.mergeRevision` 必须记录实际 checkout/test-merge revision；两者不可混用。

Artifact 位于 ignored `.tmp/evidence/`，可由 GitHub Actions 作为短期 artifact 上传。上传、metadata 检查和命令包装都不会自动更新本账本、任务状态或长期文档；Agent 必须检查 artifact 后，按 Evidence 模板记录它证明和未证明的内容。

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
| `EV-T014-001` | T014 | `52cd33672b6b2632b09beb7cb8e66f48901f2bd0` | 事实型 Progress、SQLite 一致性快照、窄 IPC/UI、筛选与真实重开 | pass | pass | 本地 Windows `verify`、PR #11 hosted Windows gate、独立 review 和项目所有者完整人工 AC-01 通过；merge revision `623007dd4269df02771f6a526db269de1fe95a03` |
| `EV-T021-001` | T021 | `07c626739b454378f8af886c1d233da6f0bd97e6` | Routine 生命周期、ISO 星期节奏、Goal 接缝、Today 计划、SQLite/IPC/UI 和真实重开 | pass | pass | 本地完整 `verify`、PR #17 实现 head hosted Windows gate、独立只读复核和项目所有者人工验收通过；仅贡献 AC-03 步骤 1～2 |
| `EV-T022-001` | T022 | `022b6e25731a07f113692a452de0128367059574` | RoutineRecord 四显式结果/缺行 unknown、非计划日、Today 五态、统一 Progress、跨午夜与重开 | pass | pass | 本地/hosted Windows 自动化、独立只读复核、PR #18 实现 head required gate 和项目所有者完整人工 AC-03 通过；FR-R08/T031 与 AC-04/T023 未实现 |
| `EV-T023-001` | T023 | `b747f41d647891d1de0ef77a61840fdbc87cfa0f` | 通用 Action 非强制 intention、Today commitment 分区、显式转换、跨日零滚动与普通 ActionRecord 复用 | pass | pass | 本地完整 `verify`、PR #19 实现 head hosted Windows gate、独立只读复核和项目所有者完整人工 AC-04 通过；不声明 AC-03 |
| `EV-T031-001` | T031 | `1c08b3161021319d1c87ef4bf8cb2470d977bd48` | Record 修改/补记、Routine provenance、子事实转换、五类删除预览与事务性删除 | pass | pending | 本地完整 `verify`、PR #26 candidate hosted Windows gate、完整 diff 与独立复核通过；贡献 AC-07 数据控制子集，不声明完整导出、AI 降级或完整 AC-07 |
| `EV-T801-001` | T801 | `dd9bd4498b0339703f8cf992a564a7d7b80442b5` | S1 package smoke 精确 API、安全边界与 unpacked/NSIS 路径 | pass | not-required | 本地 `verify`/package/package smoke、独立 review、PR #12 head CI 与最终 dev push CI 通过；merge `74ebe346a86cf431d87e02e8a1220b713b33901c` |
| `EV-T802-001` | T802 | `a61d0bc100752ae1209623a2ac020ff25a62bf8f` | S2 package API、连续 AC-03、S1 v1 数据守恒与合同归档候选 | partial | not-required | 实现候选本地完整门禁、独立 review 和 PR #20 hosted CI 通过；归档后最新 head CI、merge 与最终 dev 聚合复验待完成 |
| `EV-T802-002` | T802 / S2 aggregate | `a9db1eb26134dac83b01f4a4d7da30f92a271242` | T021～T023 同 revision 聚合、AC-01/03/04、SQLite/LocalDate、Windows package 与归档 | pass | pass | 最终 dev 本地/hosted 门禁、定向验收、package smoke 与独立 review 通过；T021～T023 人工验收沿用已记录的 owner pass |
| `EV-T090-001` | T090 / GOV-01 | `767ea6741411e2d2e7a82b297a0ed7dde3e3134e` | V2 第一、二批流程规范、Task Contract 字段、Stage Design 模板和 Escalation Proposal | pass | pass | 本地文档验证、PR candidate CI 和人工审核通过；无产品任务试点；PR #23 后续以 `aeb0d68` 进入 `dev` |
| `EV-T091-001` | T091 / GOV-02 | `f12f5e5fa81cf23124be126f2e23486d518104bc` | V2 第三批确定性证据采集、CI artifact、metadata 校验和规则同步 | pass | pass | 本地完整验证与 PR #24 corrected candidate CI（run `32133490249`）通过；正确区分 PR head 与 test-merge revision；项目所有者批准 docs closeout 并将人工验收标记为通过；无 dev merge，T092 延后 |
| `EV-G3-S1-001` | G3/S1 | `623007dd4269df02771f6a526db269de1fe95a03` | T011～T014 同 revision 核心闭环、Windows package 与发布门禁 | fail | pending | `verify`、AC-01 和 package 构建通过；package smoke 因旧 Preload API 断言在 unpacked 阶段失败，NSIS 安装态未验证 |
| `EV-G3-S1-002` | G3/S1 | `74ebe346a86cf431d87e02e8a1220b713b33901c` | T011～T014/T801 同 revision 核心闭环、Windows package 与发布门禁 | pass | pass | hosted/local `verify`、AC-01、package、unpacked/NSIS smoke 与独立 review 通过；确切里程碑 PR 的所有者 merge 批准仍单独待定 |

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
- **CI head/merge revision**：PR #7 最终 head `9ab087c01ae6a9828614df2c8244aefdcf997592`；Windows required gate run `31316637261` / job `93252845246` 为 `success`；squash merge revision `48a6f6439fbbb6ba2309e005ebb12e02b151a457`
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
  - 实现与测试位于 `task/T011-goal-lifecycle`，实现验证绑定 revision `c4e9f6dee3cbab97f6902f2c90f97f96423b43e2`；合同已归档至 `docs/implementation/archive/S1_T011_T014_ARCHIVE.md`。
  - PR #7：<https://github.com/Fyrefly-4/MyTracer/pull/7>；最终 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31316637261>。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时测试数据库、结果和 `userData` 均位于 OS 临时目录并由测试清理。
- **Manual acceptance**：pass；项目所有者于 2026-08-09 报告轻量创建、文案、pause/end 保留与 ended 终态体验检查通过
- **Known limitations**：未执行 package/NSIS 冒烟（不在 T011 合同范围，聚合 E2E 中按设计 skip）；受限沙箱内 Electron GPU 进程无法可靠启动，最终 E2E/`verify` 已在获准的非受限 Windows 桌面执行环境通过；T011 只贡献 AC-01 步骤 1～2，完整 AC-01 由后续聚合证据完成
- **Supersedes / superseded by**：无
- **Recorded at**：2026-08-09

### EV-T012-001

- **Status**：pass
- **Task / Gate**：T012 / S1 E1-02；不声明 G3/S1、完整 AC-01 或任何后续切片通过
- **Requirements**：FR-A01～FR-A04、FR-A06；FR-A05 的 Action 状态与 `partial` 解耦部分；FR-T01、FR-T04、FR-T05、FR-T08；AC-01 步骤 3 贡献；D-004、D-005、D-016、D-106；ED-003～ED-007、ED-015、ED-018、ED-019；S1-Q03-B、S1-Q05-A、S1-Q06-A、S1-Q07-A
- **Source branch**：`task/T012-action-today`
- **Source revision**：`56b3446a1b952a9bdb6fe29ab4a89502171ba321`；启动基线 `7cb5bebd8c2d0e66056d2b34189d084e78261b41`
- **CI head/merge revision**：PR #9 最终 head `5215f8d714cf6a8717c059188f12423c518d1dad`；Windows required gate run `31359967069` / job `93366775482` 为 `success`；squash merge revision `b994962618954cf02f9e07590d68213d0378bccb`
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
  - 实现与测试位于 `task/T012-action-today`，实现验证绑定 revision `56b3446a1b952a9bdb6fe29ab4a89502171ba321`；合同已归档至 `docs/implementation/archive/S1_T011_T014_ARCHIVE.md`。
  - PR #9：<https://github.com/Fyrefly-4/MyTracer/pull/9>；最终 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31359967069>。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时测试数据库、结果和 `userData` 均位于 OS 临时目录并由测试清理。
- **Manual acceptance**：pass；项目所有者于 2026-08-10 报告 T012 人工验收与 T011/T012 输入焦点回归复验全部通过
- **Known limitations**：package/NSIS smoke 不在 T012 合同范围并按设计跳过；本证据的实现行为仍绑定已通过 hosted gate 的实现 revision；T012 只贡献 AC-01 步骤 3，FR-A05 和完整 AC-01 的后续证据分别由 T013 与 T014/聚合记录补齐
- **Supersedes / superseded by**：无；文档收口提交不修改本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-10

### EV-T013-001

- **Status**：pass
- **Task / Gate**：T013 / S1 E1-03；不声明 G3/S1、完整 AC-01 或任何后续切片通过
- **Requirements**：FR-A05；FR-A08 的 T013 显式入口部分；FR-L01～FR-L06、FR-L08；FR-C01；AC-01 步骤 4～5 贡献；D-006、D-103～D-106；ED-012、ED-015～ED-017；S1-Q03-B、S1-Q04-B、S1-Q07-A、S1-Q08-B、S1-Q10-A
- **Source branch**：`task/T013-action-record`
- **Source revision**：`b10d5d40c4c1dc1f7a20801d5d904b1d37953270`；启动基线 `b994962618954cf02f9e07590d68213d0378bccb`
- **CI head/merge revision**：PR #10 最终 head `107e1840af3320b937db9096f5f2340d2ad15c8d`；Windows required gate run `31615259882` / job `94176359170` 为 `success`；squash merge revision `b3c61b403888b81e4f155fabcbefea689acd1d3a`。失败 run `31609393753` 与 `31612362422` 分别暴露 hosted E2E 总时限和 Renderer 测试状态同步问题，均由后续提交修复并被最终成功 run 取代
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
  - 实现与测试位于 `task/T013-action-record`，实现验证绑定 revision `b10d5d40c4c1dc1f7a20801d5d904b1d37953270`；合同已归档至 `docs/implementation/archive/S1_T011_T014_ARCHIVE.md`。
  - PR #10：<https://github.com/Fyrefly-4/MyTracer/pull/10>；最终 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31615259882>。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时测试数据库、结果和 `userData` 均位于 OS 临时目录并由测试清理。
- **Manual acceptance**：pass；项目所有者于 2026-08-12 报告 T013 人工测试通过
- **Known limitations**：package/NSIS smoke 不在 T013 合同范围并按设计跳过；T013 不实现 FR-L07、FR-L09 或 FR-C04，只贡献 AC-01 步骤 4～5，完整 AC-01 由 T014/聚合证据完成
- **Supersedes / superseded by**：成功 run `31613036396` 取代失败 run `31609393753` 与 `31612362422`；后续文档收口提交不修改本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-12

### EV-T014-001

- **Status**：pass；实现、自动验证、hosted CI、独立 review 与人工验收均通过
- **Task / Gate**：T014 / S1 E1-04；不声明 G3/S1、完整 FR-P02、完整 FR-D01、AC-07 或任何后续切片通过
- **Requirements**：FR-L09；FR-C03 非 AI 部分；FR-P01～FR-P04、FR-P07、FR-P08；FR-D01 的 Goal/Action/ActionRecord 重开子集；AC-01；D-007、D-104、D-106；ED-012、ED-016；S1-Q06-A、S1-Q08-B、S1-Q09-A
- **Source branch**：`task/T014-progress-core-loop`
- **Source revision**：实现与测试 head `52cd33672b6b2632b09beb7cb8e66f48901f2bd0`；启动基线 `b3c61b403888b81e4f155fabcbefea689acd1d3a`
- **CI head/merge revision**：PR #11 最终 head `0d612850716448687fecca49a1cf695570a6c970`；Windows required gate run `31622444922` / job `94200377855` 为 `success`；squash merge revision `623007dd4269df02771f6a526db269de1fe95a03`
- **Environment**：本地 Windows 11 x64、Node.js 24.18.0、npm 11.16.0、Electron 43.3.0、`better-sqlite3@13.0.1`；CI 为 GitHub-hosted Windows x64；所有自动化数据库和 Electron `userData` 均位于每 case 唯一 OS 临时根；AI 未配置，无 live Provider 或真实用户数据
- **Command or manual procedure**：
  1. 执行 T014 针对性 unit、SQLite integration、IPC integration 与 Progress Electron E2E；覆盖可选 Goal/LocalDate 筛选、包含端点、公式、0 分钟、三种 outcome、同日多记录、稳定排序、重复只读、并发快照、关闭重开与中性空状态。
  2. 在实现 revision `52cd33672b6b2632b09beb7cb8e66f48901f2bd0` 执行 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、69 项 unit、39 项 integration、Main/Preload/Renderer build 和 6 项 Electron E2E 全部通过；Windows package smoke 1 项按既有 opt-in 条件跳过。
  3. 执行 `git diff --check dev...HEAD`、完整任务 diff、允许文件及依赖/lockfile/schema/migration 扫描；未发现新依赖、migration、`001_initial.sql` 修改、延期能力、真实数据路径、评分/掌握度或其他越界语义。
  4. PR #11 的最终 Windows required gate 在 head `0d612850716448687fecca49a1cf695570a6c970` 完成并返回 `success`，随后合入 `dev` 为 `623007dd4269df02771f6a526db269de1fe95a03`。
  5. 项目所有者于 2026-08-13 使用隔离 `userData`，按 Goal → Action → Today → 25 分钟 partial ActionRecord → Understanding/Confusion/下一步 → Progress → 完全关闭重开，以及 Goal/日期组合筛选、无匹配中性状态与可选 0 分钟/同日多记录强化路径进行人工验收，并报告“人工验收全量通过”。
  6. 在合并后的 `dev@623007dd4269df02771f6a526db269de1fe95a03` 执行独立只读 review；除里程碑 package smoke 的旧 API 断言外，未发现 T014 或其他 S1 实现问题。
- **Result**：
  - `GetProgress` 形成 Renderer → Preload → Main/Application → SQLite 的固定只读纵向路径；输入只含可选 `goalId`、`from` 与 `through`，LocalDate 端点包含且允许全局全时、单 Goal、单周期或组合查询。
  - `totalDurationMinutes` 为筛选后每条 ActionRecord `durationMinutes` 之和；`realActionCount` 为筛选后 ActionRecord 数量。completed、partial、stopped、0 分钟及同一 Action 同日多条均逐条保留和计次。
  - 记录按 `occurredOn DESC`、`createdAt DESC`、`id ASC`，同一记录子实体按 `createdAt ASC`、`id ASC` 稳定排序；只展示未撤销 Understanding 与 open Confusion。
  - SQLite 使用一个参数化只读 SELECT 取得同一一致性快照；Application 消除 JOIN 行倍增后逐 ActionRecord 投影。重复查询零写入，Progress 不建表、不保存累计值，关闭重开后从当前事实重算一致。
  - Renderer 只呈现事实与中性空状态，不产生评分、掌握度、学习质量、失败率、排名、连续天数压力、人格评价或自动建议，也不用 Action/Goal/Routine 完成数代替真实行动次数。
  - `package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 未修改；没有新增、升级或安装依赖。
- **Artifacts**：
  - 实现与测试位于 `task/T014-progress-core-loop`，实现验证绑定 revision `52cd33672b6b2632b09beb7cb8e66f48901f2bd0`；合同已归档至 `docs/implementation/archive/S1_T011_T014_ARCHIVE.md`。
  - PR #11：<https://github.com/Fyrefly-4/MyTracer/pull/11>；最终 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31622444922>。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时测试数据库、结果和 `userData` 均位于 OS 临时目录并由自动化清理。项目所有者人工验收使用独立临时 `userData`。
- **Manual acceptance**：pass；项目所有者于 2026-08-13 报告 T014 完整人工 AC-01 全量通过
- **Known limitations**：package/NSIS smoke 不在 T014 任务范围；其首轮 S1 聚合失败另记 `EV-G3-S1-001`，并由后续 `EV-G3-S1-002` 成功结论取代，不重开 T014 产品交付。T014 只完成 FR-P02 的 ActionRecord 分支和 FR-D01 的 S1 重开子集；RoutineRecord 统一计次属于 T022，完整 FR-D01/AC-07 未完成
- **Supersedes / superseded by**：本次状态更新取代此前“独立 review 尚缺、PR #11 未合并”的部分状态；不取代实现 revision 的原始测试结果
- **Recorded at**：2026-08-13

### EV-T021-001

- **Status**：pass；实现、自动验证、hosted CI、独立只读复核与项目所有者人工验收均通过
- **Task / Gate**：T021 / S2 E2-01；不声明 RoutineRecord、Routine Progress、Action intention、完整 AC-03、S2 或 G4 通过
- **Requirements**：FR-R01～FR-R03、FR-T02；FR-D01 的 Routine/schedule 重开子集；AC-03 步骤 1～2贡献；D-003、D-009、D-016、D-106；ED-003/004/006/008/009/015/017/018/019；S2-Q01-A、Q02-A、Q03-A、Q07-A、Q10-A
- **Source branch**：`task/T021-routine-lifecycle`
- **Source revision**：实现与测试 head `07c626739b454378f8af886c1d233da6f0bd97e6`；启动基线 `dev@a708d7fce40cb43f8da78dd86bbed4f2bcd35084`
- **CI head/merge revision**：Draft PR #17 实现候选 head `07c626739b454378f8af886c1d233da6f0bd97e6`；Windows required gate run `31775295481` / job `94689380685` 为 `success`；PR 尚未 Ready 或合并
- **Environment**：Microsoft Windows NT 10.0.26200.0 x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3@13.0.1`；自动化使用 FakeClock、每 case 唯一 OS 临时数据库根和 Electron `userData`；AI 未配置，无 live Provider、真实 key 或真实用户数据
- **Command or manual procedure**：
  1. 执行 `npm.cmd exec -- vitest run --project unit tests/unit/routine-domain.test.ts tests/unit/routine-application.test.ts tests/unit/local-date.test.ts tests/unit/today-application.test.ts`：4 个文件、32 项测试通过，覆盖状态机、ISO weekday、快捷集合、FakeClock Today 匹配、Goal paused/ended 接缝和只读投影。
  2. 执行 `npm.cmd exec -- vitest run --project integration tests/integration/routine-sqlite.test.ts tests/integration/routine-ipc.test.ts tests/integration/main-foundations.test.ts`：3 个文件、7 项测试通过，覆盖 Routine + schedule 原子创建、整组替换回滚、历史 fixture 守恒、重开、严格 DTO 和 sender/origin 拒绝。
  3. 执行 `npm.cmd exec -- playwright test tests/e2e/routine-lifecycle.e2e.test.ts tests/e2e/shell.e2e.test.ts`：2 项 Electron E2E 通过；Routine 从 Renderer 经冻结 Preload、Main/Application 到真实 SQLite 完成创建、修改、Today、Goal paused/ended、pause/resume/end 和完全关闭重开，壳层精确 API 与 Renderer 隔离同步回归。
  4. 在实现 revision `07c626739b454378f8af886c1d233da6f0bd97e6` 执行 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、84 项 unit、45 项 integration、Main/Preload/Renderer build 和 7 项 Electron E2E 全部通过；opt-in Windows package smoke 1 项按设计跳过且不属于 T021 要求。
  5. 执行相对基线的完整 `git diff --check`、精确允许文件扫描及 `package.json`、lockfile、schemaVersion、migration、`001_initial.sql` diff 检查；复核 S1 Today focus、ActionRecord、Progress、Preload 冻结与 Renderer 隔离回归。
  6. 对完整候选执行独立于实现过程的第二遍只读复核；发现的 Goal/Routine 持久化状态类型别名和 ended 编辑语义两项问题均在候选 revision 前修正，最终没有未解决 finding。
  7. Draft PR #17 在同一实现 head 上完成 GitHub-hosted `Verification / Windows required gate`，run `31775295481` / job `94689380685` 返回 `success`。
  8. 项目所有者于 2026-08-14 按提供的 T021 人工测试方法执行，并明确报告“T021 人工验收：通过”；随后明确批准文档收口。
- **Result**：
  - Renderer → 冻结 `window.myTracer.routines` → 固定 Main IPC → Application/Domain → SQLite 的 Routine 创建、内容修改、整组星期替换、pause/resume/end、ListRoutines/GetRoutineDetail 纵向路径可用；`ended` 为生命周期终态，pause/end 保留 ID、goalId、星期和历史。
  - Routine 可在创建时关联 active/paused/ended Goal 或保持 null；不存在 Goal 被拒绝，T021 没有 reassign。Goal pause/end 不改变 active Routine；当天匹配时 Today 继续显示 Goal 名称/状态与 `canRecord=true`。
  - 星期集合严格为非空、唯一 ISO 1～7；每天/工作日只展开为 `{1..7}` / `{1..5}`。Routine + 完整 schedule 创建及 schedule 整组替换均在单事务中完成，故障产生零变化。
  - Today 仅按 Main 单次可信 Clock snapshot 投影 active 且当前星期匹配的 Routine，保留既有 S1 `localDate/focuses/availableActions` 语义；重复 Query 零写入，不写 TodaySelection，不创建 RoutineRecord。
  - schedule 或 minimumAction 修改不重写既有 RoutineRecord 的 `occurredOn`、outcome 或 `plannedForDate` fixture；完全关闭 SQLite/Electron 后从同一隔离数据根重开，Routine、schedule、状态、Goal 摘要和 Today 结果一致。
  - `package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 未修改；没有新增/升级依赖、真实数据操作、live AI 或任务 GitHub flow 之外的外部写入。
- **Artifacts**：
  - Draft PR #17：<https://github.com/Fyrefly-4/MyTracer/pull/17>；实现候选 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31775295481>。
  - 实现与测试 revision：`07c626739b454378f8af886c1d233da6f0bd97e6`；完成合同摘要与恢复入口：`docs/implementation/archive/S2_T021_T023_ARCHIVE.md`。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时数据库、结果和 Electron `userData` 均由自动化隔离和清理。项目所有者人工验收使用独立临时 `userData` 方法。
- **Manual acceptance**：pass；项目所有者于 2026-08-14 明确报告“T021 人工验收：通过”
- **Known limitations**：T021 只贡献 AC-03 步骤 1～2，不创建 RoutineRecord，不显示或保存 `target_met/acted/intentional_rest/not_done/unknown`，不实现 Routine Progress 或统一真实行动计数；这些属于 T022。Action intention 属于 T023。Windows package/NSIS smoke 不在 T021 范围并未执行；PR Ready、merge、`dev → main`、tag 和 release 仍需独立授权
- **Supersedes / superseded by**：无；后续文档收口 commit 不改变本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-14

### EV-T022-001

- **Status**：pass；实现、自动验证、hosted CI、独立只读复核与项目所有者完整人工 AC-03 均通过
- **Task / Gate**：T022 / S2 E2-02；与 `EV-T021-001` 合并完成 AC-03，不声明 AC-04、完整 S2/G4、FR-R08、完整 FR-D01 或 AC-07 通过
- **Requirements**：FR-R04～R07/R09、FR-P01/P02/P07/P08；FR-D01 的 RoutineRecord 重开子集；AC-03；D-003/007～010/016/107；ED-003/004/008/012/015～019；S2-Q03-A/Q04-A/Q05-A/Q07-A/Q08-A/Q09-A/Q12-A，S2-Q11 直接遵循 ED-017
- **Source branch**：`task/T022-routine-record-facts`
- **Source revision**：实现与测试 head `022b6e25731a07f113692a452de0128367059574`；启动基线 `dev@e3e7346eba492f1de810ffe34b41b1d96831c3af`
- **CI head/merge revision**：Draft PR #18 实现 head `022b6e25731a07f113692a452de0128367059574`；Windows required gate run `31876081932` / job `94991895586` 为 `success`；PR 保持 Draft，尚未 Ready 或合并
- **Environment**：Microsoft Windows NT 10.0.26200.0 x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3@13.0.1`；自动化使用 FakeClock、每 case/进程唯一 OS 临时数据库根和 Electron `userData`；AI 未配置，无 live Provider、真实 key 或真实用户数据
- **Command or manual procedure**：
  1. 定向执行 T022 unit、SQLite/IPC integration 与 Electron E2E；四种显式 outcome、缺行 unknown、同日唯一冲突、非计划日、schedule 后历史快照、跨午夜二选一、Today/Progress 和真实重开均通过。
  2. 在 `1c29a640823fb12df7c1176afd3b955a041367af` 执行本地 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、97 项 unit、50 项 integration、Main/Preload/Renderer build 和 9 项 Electron E2E 通过；1 项 opt-in Windows package smoke 按设计跳过且不属于 T022 要求。
  3. 首个 hosted run `31875926295` / job `94991527923` 在 97 unit、50 integration 及其余 E2E 通过后，因新 Routine 跨午夜测试固定 UTC 时间、未适配 runner 本地时区而失败；产品实现没有失败。修正 revision `022b6e25731a07f113692a452de0128367059574` 改为按运行环境构造当地午夜，本地 typecheck、build 和定向 E2E 通过。
  4. Draft PR #18 在精确实现 head `022b6e25731a07f113692a452de0128367059574` 完成 GitHub-hosted `Verification / Windows required gate`，run `31876081932` / job `94991895586` 执行完整 `verify` 并返回 `success`。
  5. 执行完整 `git diff --check`、允许文件和范围扫描；对 `package.json`、lockfile、schemaVersion、migration 与 `001_initial.sql` 做差异及 hash 检查。`001_initial.sql` 在任务 head 与 `dev` 的 blob hash 均为 `a92c98598e46d76b038d1298549b5ab524356884`。
  6. 对完整候选执行独立于实现过程的第二遍只读复核，检查 Domain/Application/UoW、create-only/UNIQUE 冲突、Progress 只读一致快照、固定 IPC、Preload 白名单、Renderer 隔离及 S1/T021 回归；最终没有未解决 finding。
  7. 项目所有者使用独立临时 `userData`，按仅覆盖 T022 新增内容的五态、非计划日、Progress、schedule 历史、pause/end、跨午夜与重开步骤执行，并于 2026-08-15 明确报告“T022 人工验收：通过”；随后明确授权文档修改、独立 docs commit 与 push。
- **Result**：
  - `target_met`、`acted`、`intentional_rest`、`not_done` 四种结果无损持久化；`unknown` 只由同 Routine/LocalDate 缺行投影，查询不写入，也不自动补成 `not_done`。
  - RoutineRecord 只允许 active Routine 通过 Application Command 在单个 UoW 事务内 create-only 创建；同 Routine/LocalDate 重复保存返回稳定 `record-already-exists` 且不覆盖。recording context 绑定 sender/routine/capturedOn，跨午夜必须明确保留开始日或使用当前日。
  - `plannedForDate` 在最终发生日的创建事务内按当时 schedule 保存；后续修改 schedule、pause/end、查询或重开不重写历史。非计划日四 outcome 均允许，其中只有 `target_met/acted` 计真实行动且都不计计划日达成。
  - Today 保存后继续显示计划 Routine 和显式结果；无 Record 显示 unknown。Progress 保留 S1 `records[]`，新增可区分 `routineRecords[]`、`targetMetCount`、`plannedTargetMetCount`，总分钟和真实行动次数按批准公式合并；Action 筛选、排序、子事实和逐 Record 计次语义未改变。
  - 完全关闭 Electron/SQLite 后从同一隔离数据根重开，四 outcome、unknown、LocalDate、计划快照、可空/0 分钟与 Progress 统计一致；没有评分、streak、失败率、完成率、掌握度或人格评价。
  - `package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 未修改；没有新增/升级依赖、真实数据操作、live AI 或任务 GitHub flow 之外的外部写入。
- **Artifacts**：
  - Draft PR #18：<https://github.com/Fyrefly-4/MyTracer/pull/18>；成功实现候选 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31876081932>。
  - 被取代但保留的时区测试失败 run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31875926295>。
  - 实现与测试 revision：`022b6e25731a07f113692a452de0128367059574`；完成合同摘要与恢复入口：`docs/implementation/archive/S2_T021_T023_ARCHIVE.md`。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时数据库、结果和 Electron `userData` 均由自动化隔离和清理。项目所有者人工验收使用独立临时 `userData`。
- **Manual acceptance**：pass；项目所有者于 2026-08-15 明确报告“T022 人工验收：通过”
- **Known limitations**：T022 不实现 FR-R08 的编辑、覆盖、补记或删除；这些属于 T031。Action intention 与 AC-04 属于 T023。Review、Recovery、AI、提醒、复杂日历、完成率和 S3～S7 未实现。Windows package/NSIS smoke 不在 T022 范围并按既有条件跳过；PR Ready、merge、`dev → main`、tag 和 release 仍需独立授权
- **Supersedes / superseded by**：成功 run `31876081932` 取代首个失败 run `31875926295` 的 CI 结论，但保留失败历史；后续文档收口 commit 不改变本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-15

### EV-T023-001

- **Status**：pass；实现、自动验证、hosted CI、独立只读复核与项目所有者完整人工 AC-04 均通过
- **Task / Gate**：T023 / S2 E2-03；完成 AC-04，不声明 AC-03、完整 S2/G4、兴趣专属模块、自动推荐或 S3～S7 通过
- **Requirements**：FR-A07、FR-T03、FR-T08；AC-04；D-003/004/011/016/106；ED-003/004/006/015/017/018/019；S2-Q06-A；S1 FR-A01～A03、FR-T01/T04/T05 回归
- **Source branch**：`task/T023-action-intention`
- **Source revision**：实现与测试 head `b747f41d647891d1de0ef77a61840fdbc87cfa0f`；启动基线 `dev@68239dafb0d742b09abb2583544a37361157c872`
- **CI head/merge revision**：Draft PR #19 实现 head `b747f41d647891d1de0ef77a61840fdbc87cfa0f`；Windows required gate run `31936005615` / job `95137908479` 为 `success`；PR 保持 Draft，尚未 Ready 或合并
- **Environment**：Microsoft Windows NT 10.0.26200.0；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3@13.0.1`；自动化使用 FakeClock、每 case/进程唯一 OS 临时数据库根和 Electron `userData`；AI 未配置，无 live Provider、真实 key 或真实用户数据
- **Command or manual procedure**：
  1. 定向执行 TodaySelection Domain/Application、Action/Goal/Routine Application、SQLite 与 IPC 测试，最终相关组合为 9 test files / 39 tests 全部通过；覆盖 intention 创建/移除、同 kind 幂等、focus/intention 双向冲突、显式双向转换、事务回滚、Query 零写入、跨日不滚动、重开持久化和未发生零 ActionRecord。
  2. 执行 `npm.cmd exec -- playwright test tests/e2e/action-intention.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/action-record.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-lifecycle.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/shell.e2e.test.ts`，9 项 Electron E2E 全部通过；连续 AC-04 场景使用 FakeClock 和同一隔离 `userData` 完成通用 Action、intention、冲突/转换、真实关闭重开、跨日零滚动、零记录/零 Progress 及普通 ActionRecord 强化路径。
  3. 在最终实现 revision `b747f41d647891d1de0ef77a61840fdbc87cfa0f` 执行本地 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、102 项 unit、53 项 integration、Main/Preload/Renderer build 和 10 项 Electron E2E 通过；1 项 opt-in Windows package smoke 按设计跳过且不属于 T023 要求。
  4. 首次 aggregate 尝试在 native SQLite smoke 因独立 worktree 只有 Vite 临时缓存、找不到 `node_modules/electron/dist/electron.exe` 而得到 `ENOENT`；确认不是产品失败后，将 worktree 路径联接到仓库现有精确锁定依赖并重跑完整通过，未执行安装或依赖变更。
  5. 执行完整 `git diff --check`、允许文件/范围扫描、Repository upsert 扫描以及 package/lockfile/schemaVersion/migration/`001_initial.sql` 差异和 hash 检查；`001_initial.sql` 在任务 head 与 `dev` 的 blob hash 均为 `a92c98598e46d76b038d1298549b5ab524356884`。
  6. 对完整候选执行独立于实现过程的第二遍只读复核，检查 Domain/Application/UoW、insert-only create、显式 commitment update、按当前 kind 删除、固定 IPC、Preload 白名单、Renderer 隔离、可信 LocalDate、Query 零写入及 S1/T021/T022 回归；修正 Goals 旧 `selectedForToday` 把 intention 误算为 focus 的兼容性边缘后，最终无未解决 finding。
  7. Draft PR #19 在精确实现 head 完成 GitHub-hosted `Verification / Windows required gate`，run `31936005615` / job `95137908479` 执行完整 `verify` 并返回 `success`。
  8. 项目所有者按 T023 合同 §10.4 和本线程提供的独立数据目录人工步骤执行通用 Action、intention 加入/移出、focus/intention 显式转换、分区展示、关闭重开、跨日、未发生零压力/零记录及普通 ActionRecord 路径，并于 2026-08-16 明确报告“人工测试结束，确认通过人工验收”；随后明确授权文档修改、独立 docs commit、push 与最终 hosted CI。
- **Result**：
  - 不关联 Goal 的普通 pending Action 可由用户显式加入或移出当日 intention；不需要兴趣/休息专属实体、模块或隐藏 Goal。Today 分别投影 `focuses[]`、`intentions[]` 和 `plannedRoutines[]`，Action detail 使用独立 `todayCommitment`，既有 `selectedForToday` 继续且只表示 focus。
  - 同一 Action/LocalDate 由 v1 主键保证最多一条 selection。创建为 insert-only；另一 commitment 的 select 返回稳定 `selection-conflict` 且零写入；只有独立的用户命令可以显式更新 commitment，Repository 不再通过 upsert 静默转换。
  - intention 只表达“今天可能想做”：选择、查询、关闭重开或跨日都不改变 Action，不生成 ActionRecord/RoutineRecord、失败或 Progress 事实；旧 selection 保留在原 LocalDate，不复制、不删除、不滚动。
  - intention 实际发生仍复用既有显式 ActionRecord recording context 和保存命令；记录后分钟与真实行动次数按 S1 事实公式进入 Progress，不新增 intention Record 或自动 post-record 状态变化。
  - Main 每个 Today Command/Query 只读取一次可信 Clock snapshot；Renderer 不提交可信日期、不访问 SQL/Node；IPC 拒绝非法 UUID/commitment、多余字段及伪造 date/selectedBy/createdAt，Preload 仅暴露固定窄方法。
  - S1 focus、Action 生命周期、ActionRecord、Progress 以及 T021/T022 Routine、`plannedForDate`、五态与 AC-03 既有语义保持不变；没有评分、streak、失败率、完成率、掌握度、逾期或惩罚评价。
  - `package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 未修改；没有新增/升级依赖、真实数据操作、live AI 或任务 GitHub flow 之外的外部写入。
- **Artifacts**：
  - Draft PR #19：<https://github.com/Fyrefly-4/MyTracer/pull/19>；成功实现候选 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31936005615>。
  - 实现与测试 revision：`b747f41d647891d1de0ef77a61840fdbc87cfa0f`；完成合同摘要与恢复入口：`docs/implementation/archive/S2_T021_T023_ARCHIVE.md`。
  - Playwright screenshot/trace/video 按既有配置不持久化；临时数据库、结果和 Electron `userData` 均由自动化隔离和清理。项目所有者人工验收结果记录于本线程。
- **Manual acceptance**：pass；项目所有者于 2026-08-16 明确报告“人工测试结束，确认通过人工验收”
- **Known limitations**：T023 不实现兴趣专属模块、自动推荐、AI、intention 自动滚动/完成/记录、提醒、评分、复杂日历、补记、编辑或删除；这些仍属于后续任务或明确非范围。Windows package/NSIS smoke 不在 T023 范围并按既有条件跳过；PR Ready、merge、`dev → main`、tag 和 release 仍需独立授权
- **Supersedes / superseded by**：无；后续文档收口 commit 不改变本记录绑定的实现/测试 revision
- **Recorded at**：2026-08-16

### EV-T031-001

- **Status**：pass；实现、自动验证、candidate hosted CI 与独立只读复核通过；人工验收 pending
- **Task / Gate**：T031 / S3 E3-01；完成 Record 数据控制切片，只贡献 AC-07 的修改、补记、删除预览/确认与重开子集，不声明 T032 完整导出、T033 AI 降级或完整 AC-07
- **Requirements**：FR-L07、FR-R08、FR-C04、FR-D02；FR-D01 的 schema v2、迁移守恒、事务删除与重开子集；回归 FR-A05、FR-R04～R07/R09、FR-T01～T05、FR-P01～P04/P07/P08；D-007～D-010、D-016、ED-003/004/008/012/015～019；S3 Design §3.5、§6～§8、§11～§12 与 S3-Q02-B
- **Source branch**：`task/T031-record-data-control`
- **Source revision**：Implementation Candidate 与 task delivery revision `1c08b3161021319d1c87ef4bf8cb2470d977bd48`；启动基线 `dev@9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be`
- **CI head/merge revision**：Draft PR #26 candidate run `32340813109` / job `96339381074` 为 `success`；PR head `1c08b3161021319d1c87ef4bf8cb2470d977bd48`，实际 test-merge revision `5805b990cde1c9886c3b7c890fb5b6371c6428ff`；PR 保持 Draft，尚未 Ready 或合并
- **Environment**：Windows win32；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；自动化使用 FakeClock、每 destructive case 唯一临时 SQLite 数据库和每 Electron case 唯一临时 `userData`；无 live AI、真实 key、真实用户数据或生产 migration
- **Command or manual procedure**：
  1. 定向 unit、SQLite/Repository integration、IPC 与 T031/AC-01/AC-03/AC-04 E2E 覆盖 update-only/create-only、原日/新日重算、父状态/Today/current-next 不变、Routine provenance/冲突、五类删除根、精确 ID/关系/计数、cancel/stale/token、cascade/SET NULL/current-next 清空、事务回滚和真实关闭重开，均通过。
  2. v1→v2 migration 验证 fresh v2、S1-only v1、含四种 Routine outcome 与 planned true/false 的 S2 v1、十个集合逐行/逐关系守恒、CHECK/FK、未知高版本拒绝，以及 ALTER 后 metadata 写入故障时 schema/数据完整回滚并可重试；`001_initial.sql` 未修改。
  3. 在 `1c08b3161021319d1c87ef4bf8cb2470d977bd48` 通过 evidence wrapper 执行 `npm.cmd run verify`，exit code 0：format、lint、typecheck、120 unit、70 integration、Main/Preload/Renderer build 和 11 项 Electron E2E 通过；1 项 opt-in Windows package smoke 按既有条件跳过。artifact：`.tmp/evidence/T031-task-candidate-1c08b3161021-20260820064141.json`。
  4. 执行完整 diff/允许文件审查、`git diff --check`、Renderer/Preload 权限扫描和 migration/dependency/`001_initial.sql` 差异检查；确认无依赖或 lockfile 变化，Renderer 无 Node/SQL/文件/Clock/Repository 权限，最终独立复核无未处理 material finding。
  5. Integration Freshness Gate 在 candidate push 前复核 `origin/dev@9903994e4ba0ef7eefa403ef65ebd5f40dcfa2be`，状态为 `fresh`；无需 merge refresh。
  6. Draft PR #26 的 candidate hosted `Verification / Windows required gate` 在精确 head/test-merge 上执行完整 `verify` 并成功；CI artifact `unscoped-aggregate-5805b990cde1-20260820064541.json` 记录 exit 0 及分离的 head/merge revisions。
- **Result**：
  - ActionRecord/RoutineRecord 修改严格 update-only，历史补记严格 create-only，发生日为显式 LocalDate；编辑/补记不改变父状态、goalId、TodaySelection 或 Goal current-next，原日/新日和 Progress/Today/day-state/详情均从剩余事实重查。
  - schemaVersion 2 仅新增 `routine_records.planned_for_date_basis`；当前记录保存 `schedule_at_recording`，历史确认保存 `user_confirmed_history`，不以当前 schedule 冒充历史计划事实。
  - Understanding 支持修改/撤销，Confusion 支持修改/解决/重开；非法重复转换和存储失败均为零变化。
  - action-record、routine-record、action、routine、goal 五类根使用精确影响 ID/关系/计数、sender-bound 一次性 opaque token、指纹/stale/二次确认；实际删除差异必须与 preview 完全一致，否则同一 SQLite 事务回滚。
  - 删除遵循 cascade、SET NULL 与 current-next 清空；Renderer 只能调用固定 `window.myTracer.dataControl`，不能获得 fingerprint、SQL、文件、Clock、Repository 或通用 IPC。
- **Artifacts**：
  - Draft PR #26：<https://github.com/Fyrefly-4/MyTracer/pull/26>；candidate hosted run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/32340813109>。
  - 本地成功 evidence：`.tmp/evidence/T031-task-candidate-1c08b3161021-20260820064141.json`；hosted 脱敏 artifact：`unscoped-aggregate-5805b990cde1-20260820064541.json`。
  - 失败记录保留：本地 `T031-task-candidate-43507e1dfe65-20260819065037.json`（format gate）与 `T031-task-candidate-ba100d2af298-20260819065126.json`（旧 shell schemaVersion 断言）；hosted run `32225839159` 同因旧断言失败。
- **Manual acceptance**：pending；项目所有者尚未执行 T031 合同 §11.14 的专用测试 `userData` 清单
- **Known limitations**：final-head CI 在 docs closeout push 后执行并由 Draft PR live 状态记录；package/NSIS smoke 为既有 opt-in 测试且本次完整 `verify` 中跳过；T032、T033、完整导出、完整 FR-D01、完整 AC-07、Ready、merge、tag 和 release 均未完成或未授权
- **Supersedes / superseded by**：成功本地 artifact `T031-task-candidate-1c08b3161021-20260820064141.json` supersedes 两个本地失败 artifact；成功 hosted run `32340813109` supersedes 失败 run `32225839159`，失败历史均保留
- **Recorded at**：2026-08-20

### EV-T032-001

- **Status**：pass；实现、本地候选验证、candidate/final-head hosted CI、获批准 docs closeout 与项目所有者人工验收均通过；任务 `done`，但不声明 Ready 或合入
- **Task / Gate**：T032 / S3 E3-02；完成 AC-07 的版本化完整导出子集，不实现 T033、导入、恢复或完整 AC-07
- **Requirements**：FR-D03、FR-D04；回归 FR-D01/FR-D02；D-111；ED-003、ED-004、ED-014、ED-015、ED-017～ED-019；S3 Design §5、§6.2、§6.4～§6.6、§7、§8.2、§9、§10～§12
- **Source branch**：`task/T032-versioned-complete-export`
- **Source revision**：Implementation Candidate `79458b88b505346ef81c3cc920224c7cf0eb4ba4`；docs closeout/final-head revision `219d7799fa17e7ba97609fc1c835b74aab060baf`；base `dev@f41c601a697f5fbdb6bc3f90656071f7263d7cfe`
- **CI head/merge revision**：Draft PR #27 candidate run `32349762843` / job `96366157688` 为 success，head `79458b88b505346ef81c3cc920224c7cf0eb4ba4`；final-head run `32354596797` / job `96380961831` 为 success，head `219d7799fa17e7ba97609fc1c835b74aab060baf`。无 `dev` integration revision
- **Environment**：Windows win32；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；自动化使用 FakeClock、每 case 唯一临时 SQLite、Electron `userData` 与导出根；无 live AI、真实 key 或真实用户数据
- **Command or manual procedure**：
  1. `npm.cmd run governance:metadata:check`、`npm.cmd run verify`、`npm.cmd run package`、`npm.cmd run test:package-smoke` 均 exit code 0；完整 verify 通过 124 unit、84 integration、12 Electron E2E，既有 opt-in package smoke 在 aggregate 中按设计 skip。
  2. 本地候选 evidence wrapper 产物 `.tmp/evidence/T032-task-candidate-79458b88b505-20260820081235.json` 绑定上述 candidate、base、Windows/Node/Electron 与 `npm.cmd run verify` 的 exit code 0。
  3. 完整 diff、`git diff --check`、Renderer/Preload 权限面和 dependency/migration 范围已复核；独立复核修正严格必填 export 字段与同一 Clock snapshot 的建议名后，无未处理 material finding。
  4. Draft PR #27 candidate hosted `Windows required gate` 在精确 candidate head 上 success；workflow 已执行 metadata validation 与 repository verify。
  5. 项目所有者使用专用测试 `userData` 完成保存、取消、JSON 可解析、界面反馈及“v0.1 不支持自动导入/恢复”人工测试，并明确报告通过；随后明确批准本条 docs closeout。
  6. docs closeout 推送后的 PR #27 `Windows required gate` 在 final-head `219d779...` 上通过，完成最终头部 CI 门槛。
- **Result**：
  - `readCompleteCoreSnapshot()` 在单个 SQLite transaction 中绑定 `sourceDataVersion=2` 与十个核心集合；显式排序和 T031 provenance/删除后的 null 关系保持事实，不经 Renderer 投影重建。
  - `MyTracerCoreExportV1` 与纯校验器拒绝结构、枚举、日期、数值、引用和技术字段错误；成功导出为 UTF-8 无 BOM，`exportVersion=1` 独立于数据版本。
  - Renderer 只调用零参数 `window.myTracer.exports.generate()`；系统保存对话框、同目录专属临时文件、flush/close/复读复验、目标新鲜度和原子交付均限于 Main。取消零文件变化；注入故障不破坏旧目标。
- **Artifacts**：Draft PR #27：<https://github.com/Fyrefly-4/MyTracer/pull/27>；candidate hosted run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/32349762843>；本地 evidence：`.tmp/evidence/T032-task-candidate-79458b88b505-20260820081235.json`。
- **Manual acceptance**：pass；项目所有者于 2026-08-20 明确报告人工测试通过。
- **Known limitations**：任务未标记 Ready、未合入 `dev`/`main`，无 tag/release；T033、自动导入/恢复、自动备份、云同步与完整 AC-07 仍未完成。
- **Supersedes / superseded by**：本条的 final-head 事实取代其先前 `partial`/未核验 final-head 状态；若之后发生 `dev` 集成，须以新证据记录。
- **Recorded at**：2026-08-20

### EV-T802-001

- **Status**：partial；T802 实现候选的本地完整门禁、独立 review 与 hosted CI 已通过，T021～T023 合同归档已形成；归档后最新 PR head CI、项目所有者 merge 和合并后最终 `dev` 聚合复验待完成
- **Task / Gate**：T802 / S2 fix；修复 S2 package smoke、完整连续 E2E-AC-03、既有 S1-only v1 数据守恒并归档 T021～T023；不改变生产语义，不声明 S2 里程碑或 `main` 推进完成
- **Requirements**：AC-03；FR-D01 的既有 S1/S2 数据重开守恒子集；GW-008/GW-010；T021～T023 已批准合同和 `S2_ROUTINE_INTENTION_DESIGN_V0.1.md` 的回归边界
- **Source branch**：`fix/T802-s2-package-smoke`
- **Source revision**：实现与测试 revision `a61d0bc100752ae1209623a2ac020ff25a62bf8f`；启动基线 `dev@0106996b45a41275370c46bd3f6ea842573f0889`；归档文档 revision 在本记录写入时尚未提交
- **CI head/merge revision**：Draft PR #20 实现 head `a61d0bc100752ae1209623a2ac020ff25a62bf8f`；Windows required gate run `31997173376` / job `95290779504` 为 `success`；最新归档 head、merge revision 与最终 dev revision 待定
- **Environment**：Microsoft Windows NT 10.0.26200.0 x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3@13.0.1`；自动化使用 FakeClock、唯一 OS 临时数据库根、Electron `userData` 和隔离 NSIS 安装目录；无 live AI、真实 key 或真实用户数据
- **Command or manual procedure**：
  1. 在初始 `dev@0106996b45a41275370c46bd3f6ea842573f0889` 执行本地 `npm.cmd run verify`：首次受限沙箱中的 Electron 进程不可启动，提升到可启动 Windows 桌面进程的同一环境后 102 unit、53 integration、10 Electron E2E 通过，opt-in package smoke 按设计跳过。
  2. 同一初始 dev 执行 `npm.cmd run package` 成功；执行 `npm.cmd run test:package-smoke` 时发现 `window.myTracer.routines` 精确白名单停留在 T021，缺少 T022 的 `beginRecording/cancelRecording/record/getDayState`，故 S2 聚合候选判定失败并启动 T802。
  3. 独立 review 进一步发现 AC-03 E2E 未完整连续证明非计划日四 outcome 在 schedule 纳回、pause/end 与真实重开后的全字段历史守恒，且不存在既有 S1-only v1 数据库由当前程序重开后的逐表 snapshot/metadata 守恒测试。
  4. T802 补齐精确 package API、连续 AC-03 和 S1-only v1 数据守恒测试；第二次独立 review 要求四条非计划日 RoutineRecord 在 schedule 变化和重开后做完整对象全等，修正后最终复核无 finding。
  5. 在精确实现 revision `a61d0bc100752ae1209623a2ac020ff25a62bf8f` 执行 `npm.cmd run verify`，exit code 0：format check、lint、typecheck、102 unit、54 integration、Main/Preload/Renderer build 和 10 Electron E2E 通过；1 项 opt-in package smoke按设计跳过。
  6. 在同一 revision 执行 `npm.cmd run package`，exit code 0；再执行 `npm.cmd run test:package-smoke`，unpacked 与隔离 NSIS 安装态均完成启动、精确 API/安全边界验证、关闭、卸载与清理。
  7. 执行完整 branch diff、`git diff --check`、依赖/生产/schema/migration 范围扫描；`001_initial.sql` blob hash 保持 `a92c98598e46d76b038d1298549b5ab524356884`，没有生产源、依赖、配置或 schema 变化。
  8. Draft PR #20 在实现 head 完成 GitHub-hosted `Verification / Windows required gate`，run `31997173376` / job `95290779504` 返回 `success`。
  9. 按项目所有者授权，将 T021～T023 三份完成合同精简归档至 `docs/implementation/archive/S2_T021_T023_ARCHIVE.md` 并删除原文件；T802 合同按所有者要求未进入 Git 历史。
- **Result**：
  - package smoke 现在精确覆盖 S2 最终 `window.myTracer` 顶层和 `routines` API，并继续验证对象冻结、Renderer Node/IPC 隔离、unpacked 与隔离 NSIS 安装态。
  - 连续 AC-03 同时覆盖计划日/非计划日四 outcome、缺行 unknown、唯一冲突、schedule 纳回、历史 `plannedForDate`、Progress、pause/end、真实 Electron/SQLite 重开和原始数据库计数；四条非计划日 Record 在 schedule 变化及重开后逐字段全等。
  - 既有 S1-only v1 数据库以 Goal/Action/focus/ActionRecord/Understanding/Confusion fixture 重开，重开前后完整 snapshot 与 metadata 全等，全部 S2 表保持空；测试仅使用临时根。
  - 只修改测试、任务索引、证据与归档文档；没有修改生产代码、依赖、配置、schemaVersion、migration 或 `001_initial.sql`，没有真实用户数据或外部服务写入。
  - T021～T023 原合同已由单一归档候选替代，完整合同仍可从 Git 历史恢复；该归档不扩大产品范围或实现权限。
- **Artifacts**：
  - Draft PR #20：<https://github.com/Fyrefly-4/MyTracer/pull/20>；实现候选 hosted Windows run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31997173376>。
  - `release/win-unpacked/MyTracer.exe` SHA-256：`56FE4FFB6630B0B42367BAD7E0838EC8BA7817581EDD79BC9221D4FF2719632A`。
  - `release/MyTracer-0.1.0-x64-setup.exe` SHA-256：`9527FFA6AB20204F38BCFD6E442D832547F9E403EA626BD796FDF68D22651847`。
  - 完成合同摘要与恢复入口：`docs/implementation/archive/S2_T021_T023_ARCHIVE.md`。
- **Manual acceptance**：not-required；T802 不改变用户可观察产品行为，T021/T022/T023 的项目所有者人工验收分别已记录为 pass
- **Known limitations**：本记录只证明实现 revision `a61d0bc...` 的候选阶段；Windows 产物未签名并使用默认 Electron 图标
- **Supersedes / superseded by**：取代初始 dev package smoke 失败和独立 review 缺口的实现候选结论，但保留其失败历史；最终 dev 聚合结论由 `EV-T802-002` 取代本记录的 partial 状态
- **Recorded at**：2026-08-17

### EV-T802-002

- **Status**：pass；T021～T023/T802 在同一最终 `dev` revision 的本地/hosted 自动化、Windows package、独立聚合 review 与既有项目所有者人工 AC-03/AC-04 均通过
- **Task / Gate**：T802 最终收口 / S2 例行与非强制意向聚合验收；不声明 S3～S7、G4、完整 FR-D01/AC-07、`main`、tag 或 release 完成
- **Requirements**：T021 FR-R01～R03/FR-T02；T022 FR-R04～R07/R09、FR-P01/P02/P07/P08；T023 FR-A07/FR-T03/FR-T08；FR-D01 的 S1/S2 重开守恒子集；AC-01 回归、AC-03、AC-04；D-003/004/007～011/016/106/107；ED-003/004/006/008/009/012/015～019；GW-008/GW-010；已批准 S2-Q01～Q10/Q12-A 与 S2-Q11 对 ED-017 的继承
- **Source branch**：`dev`
- **Source revision**：`a9db1eb26134dac83b01f4a4d7da30f92a271242`；该 revision 为 T802 PR #20 的 squash merge，并包含 T021～T023、T802 测试修复及 S2 合同归档
- **CI head/merge revision**：最终 dev push workflow `Verification` run `31998601976` / job `95294645310` 在确切 `a9db1eb26134dac83b01f4a4d7da30f92a271242` 返回 `success`
- **Environment**：Microsoft Windows NT 10.0.26200.0 x64；Node.js 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3@13.0.1`；AI 未配置；自动化使用 FakeClock、每 case/进程唯一 OS 临时数据库根、Electron `userData` 和隔离 NSIS 安装目录；不接触真实用户数据、live Provider 或真实 key
- **Command or manual procedure**：
  1. 核验 PR #20 已 squash 合入 `dev`，本地 `dev` 与 `origin/dev` 同指 `a9db1eb26134dac83b01f4a4d7da30f92a271242`，工作树干净。
  2. 执行 `npm.cmd run verify`，exit code 0：Prettier、ESLint、TypeScript、102 unit、54 integration、Main/Preload/Renderer build 和 10 Electron E2E 全部通过；1 项 opt-in package smoke 按设计跳过并在步骤 6 单独执行。
  3. 执行 `npm.cmd exec -- vitest run --project unit tests/unit/local-date.test.ts tests/unit/routine-domain.test.ts tests/unit/routine-record-domain.test.ts tests/unit/today-selection-domain.test.ts`：4 files / 32 tests 通过，覆盖 LocalDate 边界、ISO weekday、Routine 生命周期、五态 Domain 与 focus/intention commitment。
  4. 执行 `npm.cmd exec -- vitest run --project integration tests/integration/sqlite-persistence.test.ts tests/integration/routine-sqlite.test.ts tests/integration/routine-record-sqlite.test.ts tests/integration/action-today-sqlite.test.ts`：4 files / 16 tests 通过，覆盖既有 S1-only v1 数据 snapshot/metadata 守恒、S2 空表、Routine/schedule/Record/TodaySelection、唯一冲突、事务与重开。
  5. 执行 `npm.cmd exec -- playwright test tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts`：4 tests 通过，分别完成 AC-04、AC-01、连续 AC-03 与 Routine 跨午夜显式日期选择。
  6. 执行 `npm.cmd run package`，exit code 0，生成 Windows x64 unpacked 应用和 unsigned NSIS installer；执行 `npm.cmd run test:package-smoke`，1 test 通过，unpacked 与隔离 NSIS 安装态均完成启动、精确 S2 API/安全边界验证、关闭、卸载与清理。
  7. 核对 `001_initial.sql` 在 S1 最终基线 `74ebe346a86cf431d87e02e8a1220b713b33901c` 与最终 dev 的 blob hash 均为 `a92c98598e46d76b038d1298549b5ab524356884`；`package.json`、lockfile 和 migration manifest 无差异。
  8. 查询最终 dev push CI：run `31998601976` / job `95294645310` 的 Windows required gate 在 exact head `a9db1eb...` 完整执行 `verify` 并返回 `success`。
  9. 对 S1 最终基线 `74ebe346...` 到最终 S2 dev `a9db1eb...` 执行独立只读聚合 review；生产实现和测试无 finding，唯一文档合并状态漂移在本收口提交中修正。
- **Result**：
  - T021：Routine 创建、修改、pause/resume/end、ended 终态、ISO weekday/每天/工作日、最低行动、Today 计划日投影、无预生成、原子 schedule、历史 Record 与 `plannedForDate` 守恒均通过。
  - T022：`target_met`、`acted`、`intentional_rest`、`not_done` 四种显式结果与缺行 `unknown` 无损分离；非计划日四 outcome 可记录，只有真实行动计事实且不计计划达成；同日唯一冲突零覆盖，Query 不补行；Progress 保持中性事实且无评分、失败评价或 streak。
  - T023：通用 Action 可显式成为 intention；focus/intention 分离且互斥，转换需用户命令；未发生不写 Record/Progress/失败、不改变 Action 核心类型、不滚动到下一 LocalDate，也未新增兴趣专属模型或统计。
  - 数据与安全：既有 S1-only v1 facts、schema metadata 和空 S2 表重开守恒；Routine/schedule/Record/TodaySelection 真重开一致；Renderer 仍无 Node/SQLite/文件系统入口，固定 IPC/DTO/sender 校验通过；AI 未配置时 S1/S2 核心路径可用。
  - S1 回归：AC-01 的 Goal → Action → Today → ActionRecord → Progress → 真实重开在最终 dev 通过。
  - 没有需求冲突、产品语义变化、新依赖、migration、真实数据操作、S3～S7 或延期能力。
- **Artifacts**：
  - 最终 dev hosted run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31998601976>；Windows job：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31998601976/job/95294645310>。
  - T802 PR #20：<https://github.com/Fyrefly-4/MyTracer/pull/20>；merge revision `a9db1eb26134dac83b01f4a4d7da30f92a271242`。
  - `release/win-unpacked/MyTracer.exe` SHA-256：`56FE4FFB6630B0B42367BAD7E0838EC8BA7817581EDD79BC9221D4FF2719632A`。
  - `release/MyTracer-0.1.0-x64-setup.exe` SHA-256：`288310BA192656916FF82E406276498A60BD0DEE74DEF47A4D5BA21060633E21`。
  - 完成合同归档：`docs/implementation/archive/S2_T021_T023_ARCHIVE.md`。
- **Manual acceptance**：pass；项目所有者已分别于 2026-08-14、2026-08-15、2026-08-16 通过 T021、完整 AC-03/T022 和完整 AC-04/T023 人工验收；T802 不改变用户可观察产品语义，无新增人工步骤
- **Known limitations**：Windows 产物未签名并使用默认 Electron 图标；FR-R08 的修改/补记/删除属于 T031，完整 FR-D01/AC-07、Recovery、Review、AI、提醒、复杂重复规则、兴趣专属模块与 S3～S7 未实现；`dev → main` 里程碑 PR 只可在本证据收口合入 dev 后准备，merge、tag 和 release 仍须项目所有者独立授权
- **Supersedes / superseded by**：取代 `EV-T802-001` 的 partial 候选状态；不删除其初始失败和修复历史
- **Recorded at**：2026-08-17

### EV-AC01-001

- **Status**：pass
- **Task / Gate**：AC-01 React 学习完整流程；聚合 T011～T014，不声明 G3/S1、AC-07、完整 FR-P02 或完整 FR-D01 通过
- **Requirements**：AC-01；`EV-T011-001`、`EV-T012-001`、`EV-T013-001`、`EV-T014-001`
- **Source branch**：`task/T014-progress-core-loop`
- **Source revision**：完整自动化与人工闭环绑定 T014 实现 revision `52cd33672b6b2632b09beb7cb8e66f48901f2bd0`
- **CI head/merge revision**：PR #11 最终 head `0d612850716448687fecca49a1cf695570a6c970`；Windows required gate run `31622444922` / job `94200377855` 为 `success`；squash merge revision `623007dd4269df02771f6a526db269de1fe95a03`
- **Environment**：本地 Windows 11 x64 与 GitHub-hosted Windows x64；SQLite v1 schema；自动化和人工验收均使用隔离数据根/`userData`；AI 未配置
- **Command or manual procedure**：
  1. `npm.cmd run verify` 中的 Electron E2E 在同一 revision 连续完成 Goal 与当前下一步、选入 Today、保存 25 分钟 partial ActionRecord 与 manual Understanding/open Confusion/下一步、进入 Progress 验证 25 分钟与 1 次真实行动、完全关闭 Electron/SQLite 后以同一隔离 `userData` 重开并复核事实。
  2. 项目所有者于 2026-08-13 按同一完整路径及 Goal/日期筛选、中性空状态、易读性和记录负担人工清单执行，并明确报告“人工验收全量通过”。
- **Result**：AC-01 自动化与项目所有者人工验收均通过；Goal → Action → Today → ActionRecord → Progress 的 S1 产品闭环在该实现 revision 上成立，关闭重开后事实一致。
- **Artifacts**：`EV-T011-001`～`EV-T014-001`；PR #11 <https://github.com/Fyrefly-4/MyTracer/pull/11>；hosted run <https://github.com/Fyrefly-4/MyTracer/actions/runs/31622444922>
- **Manual acceptance**：pass；项目所有者于 2026-08-13 明确报告全量通过
- **Known limitations**：AC-01 通过不自动使 G3/S1、`main`、tag 或 release 获得授权；G3/S1 Windows package smoke 失败另记 `EV-G3-S1-001`
- **Supersedes / superseded by**：取代 AC-01 先前 `pending` 状态；不取代各任务证据
- **Recorded at**：2026-08-13

### EV-G3-S1-001

- **Status**：fail
- **Task / Gate**：G3/S1 核心闭环里程碑聚合验收；T011～T014
- **Requirements**：AC-01；FR-G01～G06、FR-A01～A06、FR-T01/T04/T05/T08、FR-L01～L06/L08/L09、FR-C01/C03 非 AI 部分、FR-P01～P04/P07/P08；D-002/004～007/015/016/101/103～106；相关 ED 与 GW-008/GW-010
- **Source branch**：`dev`；验收工作位于 `codex/s1-core-loop-milestone`
- **Source revision**：`623007dd4269df02771f6a526db269de1fe95a03`
- **CI head/merge revision**：远端 `dev` 同 revision；T014 PR #11 最终 Windows required gate run `31622444922` / job `94200377855` success
- **Environment**：Windows 11 x64、Node.js 24.18.0、npm 11.16.0、Electron 43.3.0、`better-sqlite3@13.0.1`；自动化使用唯一 OS 临时数据根和隔离 Electron `userData`；AI 未配置
- **Command or manual procedure**：
  1. 冷 worktree 执行 `npm.cmd ci`；首次 `npm.cmd run verify` 因 Electron 安装脚本未取得 `electron.exe` 而在 native SQLite smoke 报 ENOENT。网络恢复命令失败后，从同仓库已安装且版本一致的 Electron 43.3.0 复制本地二进制到未跟踪 `node_modules`，从头重跑。
  2. 第二次 `npm.cmd run verify` exit code 0：format、lint、typecheck、69 unit、39 integration、build 和 6 Electron E2E 通过；package smoke 按 opt-in 设计跳过。AC-01 自动化在同一 revision 完成完整闭环和真实关闭重开。
  3. `npm.cmd run package` exit code 0，生成 Windows x64 `win-unpacked` 与 unsigned NSIS installer。
  4. `npm.cmd run test:package-smoke` exit code 1：unpacked 应用成功启动、读取隔离 `userData`、返回 AI `not-configured`，随后在 `tests/e2e/windows-package-smoke.e2e.test.ts:42` 因仍期望 `Object.keys(window.myTracer) === ['shell']` 而失败；当前 S1 窄 API 实际为 `shell/goals/actions/today/records/progress`。测试未继续到 NSIS 安装态验证。
  5. 独立只读 review 核对 Domain/Application/SQLite/IPC/Preload/Renderer 和测试；确认该 package smoke 漂移为唯一 actionable finding，其他冻结语义和范围一致。
- **Result**：
  - `verify`、AC-01、package 构建及项目所有者人工 AC-01 通过，但 Windows package smoke 门禁失败；G3/S1 不通过，不得声称里程碑完成，也未创建 `dev → main` PR。
  - 独立 review 确认 pause/end 保留当前下一步、Today 选择及 Action/Record 历史；ended 保持终态；当前下一步只接受同 Goal 的 pending Action，且设置/替换受 active Goal 约束。
  - rescheduled 原地复用 Action ID，只移除当日 Today 选择；`partial` 与 0 分钟记录均计为真实行动，但不自动完成 Action。
  - Today 由 Main 捕获并验证 LocalDate，不自动搬运历史 Action；Progress 仅按事实投影次数、分钟、Understanding 与开放 Confusion，不生成评分、掌握度或推断失败。
  - AI 保持 `not-configured` 时，Goal → Action → Today → ActionRecord → Progress 仍可完整使用并在真实关闭重开后保留事实。
- **Artifacts**：
  - `release/win-unpacked/MyTracer.exe`：SHA-256 `4BCED5469892ACA2DE672A8AE60A473518FF4D3229823D0637E8F4E09FFCAA55`。
  - `release/MyTracer-0.1.0-x64-setup.exe`：SHA-256 `A336C33376F514A2A4DA2EE28C6ABC9B8209E64C9F2C0BDB3506482932EB852E`。
  - 失败定位：`tests/e2e/windows-package-smoke.e2e.test.ts:42`；当前 API 定义：`src/preload/index.ts`。
- **Manual acceptance**：pending；项目所有者 2026-08-13 的完整人工 AC-01 为 pass，但 G3/S1 因 package smoke 失败尚不能请求最终里程碑签署
- **Known limitations**：NSIS 安装态未执行；产物未签名且使用默认 Electron 图标；CI workflow 只运行 `verify`，不运行 package smoke；必须由独立 T801 修复并合入后，在新的最终 `dev` revision 上重跑全部验收
- **Supersedes / superseded by**：首次 G3/S1 聚合验收记录；后续成功证据不得删除或覆盖本失败记录，应显式引用并 supersede
- **Recorded at**：2026-08-13

### EV-T801-001

- **Status**：pass
- **Task / Gate**：T801 / S1 Windows package smoke fix；只修复 `EV-G3-S1-001` 暴露的测试契约漂移
- **Requirements**：G3/S1；GW-008、GW-010；不新增或改变 FR、AC、D、ED
- **Source branch**：`fix/T801-s1-package-smoke`
- **Source revision**：`dd9bd4498b0339703f8cf992a564a7d7b80442b5`；基线 `623007dd4269df02771f6a526db269de1fe95a03`
- **CI head/merge revision**：PR #12 head `dd9bd4498b0339703f8cf992a564a7d7b80442b5` 的 run `31629217448` / job `94223393063` success；squash merge `74ebe346a86cf431d87e02e8a1220b713b33901c`；最终 dev push run `31629559383` / job `94224557272` success
- **Environment**：Windows 11 x64、Node.js 24.18.0、npm 11.16.0、Electron 43.3.0；package smoke 使用唯一临时根、隔离 `userData` 与隔离 NSIS 安装目录；AI 未配置
- **Command or manual procedure**：
  1. 仅修改 `tests/e2e/windows-package-smoke.e2e.test.ts`，把顶层及子 API 白名单对齐当前 `MyTracerApi`，验证所有 API 对象冻结，并断言 Renderer 不暴露 Node/`require`/`process`/safeStorage。
  2. 为包含两次应用启动及最多 120 秒安装/卸载子进程的 Windows 用例设置 300 秒 case timeout；不改变任何子进程、数据隔离或清理语义。
  3. 执行 `npm.cmd run verify`：format/lint/typecheck、69 unit、39 integration、build 和 6 Electron E2E 通过；opt-in package smoke 按设计跳过。
  4. 执行 `npm.cmd run package` 与 `npm.cmd run test:package-smoke`：unpacked 启动/关闭，隔离 NSIS 安装、已安装应用启动/关闭和卸载均通过，1 test / 18.5s。
  5. 独立只读 review 核对精确 API、安全、临时数据、安装/卸载与失败清理路径，无 finding；验证后无 MyTracer/Electron 进程、测试根或安装目录残留。
- **Result**：旧 S0 `shell`-only 断言已替换为精确 S1 窄 API 契约；package smoke 没有弱化安全或安装态证明。T801 完成且没有产品范围变化
- **Artifacts**：
  - PR #12：<https://github.com/Fyrefly-4/MyTracer/pull/12>；head CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31629217448>；最终 dev CI：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31629559383>。
  - 修复验证产物：`win-unpacked/MyTracer.exe` SHA-256 `4BCED5469892ACA2DE672A8AE60A473518FF4D3229823D0637E8F4E09FFCAA55`；NSIS setup SHA-256 `51BB177C61DD1D14A66371D628C0BFD8908AA44B43F10A1D882D13F87581FBCC`。
- **Manual acceptance**：not-required；T801 不改变用户行为，里程碑人工签署由 `EV-G3-S1-002` 单独记录
- **Known limitations**：hosted workflow 不运行 package/NSIS smoke；产物未签名且使用默认 Electron 图标。首次受限环境 packaged Electron GPU 失败与首次 Prettier 失败均由后续同范围成功重跑取代，不删除其运行事实
- **Supersedes / superseded by**：修复 `EV-G3-S1-001` 的测试缺陷，但不删除或把该失败记录改为 pass
- **Recorded at**：2026-08-13

### EV-G3-S1-002

- **Status**：pass
- **Task / Gate**：G3/S1 核心闭环里程碑聚合验收；T011～T014 + T801
- **Requirements**：AC-01；FR-G01～G06、FR-A01～A06、FR-T01/T04/T05/T08、FR-L01～L06/L08/L09、FR-C01/C03 非 AI 部分、FR-P01～P04/P07/P08；D-002/004～007/015/016/101/103～106；相关 ED 与 GW-008/GW-010
- **Source branch**：`dev`；最终验收/归档工作位于 `codex/s1-core-loop-milestone-final`
- **Source revision**：`74ebe346a86cf431d87e02e8a1220b713b33901c`
- **CI head/merge revision**：T801 PR #12 squash merge同 source revision；最终 dev push run `31629559383` / job `94224557272` success
- **Environment**：Windows 11 x64、Node.js 24.18.0、npm 11.16.0、Electron 43.3.0、`better-sqlite3@13.0.1`；所有自动化使用唯一临时根和隔离 Electron `userData`；AI 未配置
- **Command or manual procedure**：
  1. 首次 `npm.cmd run verify` 的 69 unit 和 39 integration 通过，但 AC-01 E2E 在 Progress 首屏一度读到 0/0 而失败。没有修改代码；精确重跑 `npm.cmd run test:e2e:run -- tests/e2e/progress-core-loop.e2e.test.ts` 通过（1 test / 2.8s）。
  2. 从头重跑 `npm.cmd run verify` exit code 0：format、lint、typecheck、69 unit、39 integration、build 和 6 Electron E2E 通过；AC-01 完成 25 分钟 partial Record、事实型 Progress 和真实关闭重开。
  3. 执行 `npm.cmd run package` 与 `npm.cmd run test:package-smoke`：Windows x64 unpacked 与隔离 NSIS 安装态启动、关闭、卸载和清理通过（1 test / 18.6s）。
  4. 核对 S1 核心语义、T011～T014/T801 完整 diff、需求追踪和独立 review；未发现新的 requirement conflict 或 scope change。
- **Result**：
  - pause/end 保留当前下一步、TodaySelection 与全部历史；ended 终态；当前下一步只引用同 Goal pending Action。
  - rescheduled 复用原 Action ID；partial/0 分钟为真实行动且不自动完成；Today 不自动搬运历史 Action。
  - Progress 只展示事实，不推导评分或掌握度；AI `not-configured` 时完整闭环仍可使用。
  - 最终 `dev` 的 AC-01、关闭重开、Windows package 和 unpacked/NSIS 门禁通过；G3/S1 自动化验收通过。
- **Artifacts**：
  - Hosted Windows：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31629559383/job/94224557272>。
  - `release/win-unpacked/MyTracer.exe`：SHA-256 `4BCED5469892ACA2DE672A8AE60A473518FF4D3229823D0637E8F4E09FFCAA55`。
  - `release/MyTracer-0.1.0-x64-setup.exe`：SHA-256 `DD1AA1519A7546FEF83CF955FB4845E48AB63F4A3646DA7B47374C5C7BD031D3`。
- **Manual acceptance**：pass；项目所有者于 2026-08-13 已完成完整人工 AC-01。针对即将创建的确切 `dev → main` 里程碑 PR 是否允许合入 `main` 是独立发布授权，仍为 pending
- **Known limitations**：首次最终-dev AC-01 E2E 有一次不可稳定复现的 0/0 首屏竞态，随后精确重跑和完整 `verify` 均通过；作为残余测试稳定性风险保留。hosted workflow 不运行 package smoke；产物未签名并使用默认 Electron 图标；完整 FR-P02、FR-D01、AC-07 和 S2～S7 仍未交付
- **Supersedes / superseded by**：显式 supersede `EV-G3-S1-001` 的阶段门结论；不删除或改写首轮失败证据，也不取代各任务证据
- **Recorded at**：2026-08-13

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
| G3/S1 核心闭环 | T011～T014/T801 | `EV-G3-S1-001`（失败保留）；`EV-G3-S1-002`（最终） | pass | 已确认 AC-01；确切里程碑 PR 的 merge 授权另行待定 |
| G4 Demo 就绪 | AC-01～AC-07、数据安全、已知限制 | — | pending | pending |
| G5 使用验证 | 7～14 天真实自用 | — | pending | pending |

G1 的设计结论不是代码、CI、Windows 打包或产品验收证据。

## 6. AC 证据索引

| AC | Automated evidence | Manual evidence | Status |
|---|---|---|---|
| AC-01 | `EV-T011-001`（步骤 1～2）；`EV-T012-001`（步骤 3）；`EV-T013-001`（步骤 4～5）；`EV-T014-001` / `EV-AC01-001`（步骤 6 与同 revision 完整闭环） | 项目所有者于 2026-08-13 报告完整人工 AC-01 全量通过 | pass |
| AC-02 | — | — | pending |
| AC-03 | `EV-T021-001`（步骤 1～2）；`EV-T022-001`（四显式结果、缺行 unknown、非计划日、Today/Progress、跨午夜与重开完整闭环） | 项目所有者于 2026-08-14 通过 T021 人工清单，并于 2026-08-15 明确报告“T022 人工验收：通过” | pass |
| AC-04 | `EV-T023-001`（通用 Action intention、显式转换、未发生零事实、跨日不滚动、普通 ActionRecord 复用与真实重开） | 项目所有者于 2026-08-16 按 T023 人工步骤测试并明确确认通过 | pass |
| AC-05 | — | — | pending |
| AC-06 | — | — | pending |
| AC-07 | `EV-T031-001`（Record 修改/补记、数据删除控制与重开子集）；T032/T033 待完成 | T031 人工清单 pending；完整 AC-07 人工验收未执行 | pending |

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
- T014 事实型 Progress 实现、本地/hosted 自动验证、独立 review、PR #11 合并及项目所有者完整人工验收已记录为 `EV-T014-001`；任务为 `done`。
- T021 Routine 生命周期、ISO 星期节奏、Today 计划项、Goal 生命周期独立性、SQLite/IPC/UI/重开、本地与 hosted 自动验证、独立只读复核及项目所有者人工验收已记录为 `EV-T021-001`；T022 四显式结果、缺行 unknown、非计划日、Today/Progress、跨午夜与重开已记录为 `EV-T022-001`。两者均为 `done`，完整 AC-03 自动化和项目所有者人工验收为 `pass`。
- T023 通用 Action 非强制 intention、显式转换、未发生零事实、跨日不滚动、普通 ActionRecord 复用、本地与 hosted 自动验证、独立只读复核及项目所有者人工验收已记录为 `EV-T023-001`；AC-04 为 `pass`。
- T031 Record 修改/补记、Routine provenance、Understanding/Confusion 状态变更、五类删除预览与事务性确认、本地与 hosted 自动验证及独立复核已记录为 `EV-T031-001`；人工验收、T032/T033 与完整 AC-07 保持 `pending`，PR Ready/merge 未授权。
- T802 的 package API、连续 AC-03、S1-only v1 数据守恒修复及 T021～T023 合同归档候选保留为 `EV-T802-001`；最终 `dev@a9db1eb...` 的同 revision 聚合结论记录为 `EV-T802-002` 并取代 partial 状态。S2 自动化与既有项目所有者 AC-03/AC-04 人工验收为 `pass`，但不授权里程碑 merge、tag 或 release。
- 完整 Goal → Action → Today → ActionRecord → Progress 自动化与项目所有者人工闭环已记录为 `EV-AC01-001`，AC-01 为 `pass`；这不自动通过 G3/S1、完整 FR-P02、完整 FR-D01 或 AC-07。
- G3/S1 首轮聚合验收已记录为 `EV-G3-S1-001`：固定 `dev@623007dd4269df02771f6a526db269de1fe95a03` 的 `verify`、AC-01 和 package 构建通过，但 package smoke 因旧 API 断言失败，故当时阶段门为 `fail`；该失败记录由后续 `EV-T801-001` / `EV-G3-S1-002` 显式取代但不删除。
- T801 已由 `EV-T801-001` 证明单文件修复、本地 `verify`/package/package smoke、独立 review、PR #12 head CI、合并与最终 dev CI 通过；没有生产、依赖、schema 或产品语义变化。
- G3/S1 最终聚合验收已记录为 `EV-G3-S1-002`：固定 `dev@74ebe346a86cf431d87e02e8a1220b713b33901c` 的 hosted/local `verify`、AC-01、package 和 unpacked/NSIS smoke 通过。首轮失败未删除；里程碑 PR 的 merge、tag 和 release 仍需所有者分别授权。

### EV-T090-001

- **Status**：pass
- **Task / Gate**：T090 / GOV-01；不声明任何产品 FR、AC、阶段门或主线合入
- **Requirements**：无产品 FR/AC；GW-001、GW-002、GW-004、GW-005/GW-006、GW-009、GW-010；T090 合同
- **Source branch**：`docs/T090-agent-process-v2`
- **Source revision**：`767ea6741411e2d2e7a82b297a0ed7dde3e3134e`
- **Base revision**：`dev@112b90968dad05cd27f8421480cadaeff6f85e2c`
- **Task delivery revision**：`5b5211aa4904aef39b5e3f4366efbce08b8d3229`
- **Dev integration revision**：`aeb0d68`；PR #23 已进入 `dev`，本字段为实际 post-merge revision
- **Stage final integration revision**：`null`
- **Integration freshness**：`fresh`；original/latest/verified base 均为 `dev@112b90968dad05cd27f8421480cadaeff6f85e2c`，未发生 stale refresh
- **CI classification**：`candidate`；PR #23 的 Windows required gate 在上述 revision 通过。本次状态收口提交推送后需重新执行 final-head CI，此处不预先声明其通过
- **Environment**：Microsoft Windows NT 10.0.26200.0；Node.js v24.18.0；npm 11.16.0；无产品数据库、无 live AI、无外部写入
- **Command or manual procedure**：
  1. 在上述 source revision 执行 `npm.cmd run format:check`，exit code 0，Prettier 全部文件通过。
  2. 执行 `git diff --check`，exit code 0。
  3. 使用 PowerShell 对 AGENTS、Skill、GitHub workflow、Evidence、Task Template、Stage Design Template、Escalation Proposal 和 T090 合同执行逐文件字段断言；exit code 0，输出 `Structural checks passed`。
  4. 检查 `git diff --name-only` 与新增文件列表；仅包含 T090 合同允许的 9 个文件，PRD、DECISIONS、需求变更规则、产品代码和 `.github/workflows/verify.yml` 未变更。
  5. 核对 PR #23 的 base/head、Draft 状态和 hosted Windows required gate；head 为上述 revision，required gate conclusion 为 `SUCCESS`。
  6. 项目所有者确认 review 和人工审核通过。
- **Result**：
  - V2 第一批的 Draft/early CI/candidate/final-head 顺序、最终 review、Integration Freshness Gate、Escalation Proposal、三类 revision 和失败证据 supersede 规则已写入规范。
  - V2 第二批的 `references`、`dependencies`、`permissions`、`integration`、`shared_surface` 和 Stage Design baseline + delta 模板已写入规范。
  - 第二批仅完成文档结构，尚未通过真实 Txxx 运行验证；没有创建产品任务试点。
  - 第三批 evidence capture/metadata/CI artifact 自动化和第四批 Profile/调度/Review/Audit Skill 均未实施。
- **Artifacts**：Draft PR #23（`https://github.com/Fyrefly-4/MyTracer/pull/23`）；Windows required gate（`https://github.com/Fyrefly-4/MyTracer/actions/runs/32122204319/job/95664895455`）在上述 candidate revision 通过；无安装包或用户数据产物。
- **Manual acceptance**：pass；项目所有者于 2026-08-18 明确确认 review 和人工审核通过，并接受“第二批文档已落地、尚未真实任务运行验证”的限制声明。
- **Known limitations**：第二批没有真实 Txxx 任务试点；`stage_final_integration_revision` 仍为 `null`；PR #23 的最终 merge 状态已由 `aeb0d68` 记录；后续 PR 仍由项目所有者控制 Ready、merge、tag 和 release。
- **Supersedes / superseded by**：无
- **Recorded at**：2026-08-18

### EV-T091-001

- **Status**：pass
- **Task / Gate**：T091 / GOV-02；不声明任何产品 FR、AC、阶段门或 `dev` 合入
- **Requirements**：无产品 FR/AC；GW-001、GW-002、GW-004、GW-008、GW-009、GW-010；T091 合同
- **Source branch**：`docs/T091-deterministic-evidence`
- **Source revision**：`f12f5e5fa81cf23124be126f2e23486d518104bc`
- **Base revision**：`dev@aeb0d68578e2c9fc91523e99272db3e1ec88cf52`
- **Task delivery revision**：`f12f5e5fa81cf23124be126f2e23486d518104bc`
- **Dev integration revision**：`null`；T091 尚未合入 `dev`
- **Stage final integration revision**：`null`；本任务不声明阶段聚合完成
- **Integration freshness**：`fresh`；original/latest/verified base 均为 `dev@aeb0d68578e2c9fc91523e99272db3e1ec88cf52`，未发生 stale refresh
- **CI classification**：`candidate`；PR #24 corrected candidate run `32133490249`，job `95699517255`。artifact 中 `ci.headRevision` 为 PR head `f12f5e5fa81cf23124be126f2e23486d518104bc`，`ci.mergeRevision` 为实际 PR test-merge revision `758473eb65ede36743223c341f6afc5a883e49d8`，两者未混用。docs closeout 推送后的 final-head CI 由 Draft PR body 记录，不在本条目中预先声明通过。
- **Environment**：Microsoft Windows 11，10.0.26200，x64；Node.js v24.18.0；npm 11.16.0；Electron 43.3.0；hosted runner 为 GitHub Actions `windows-2025`；无产品数据库、无 live AI、无用户数据写入
- **Command or manual procedure**：
  1. 执行 `npm.cmd run governance:metadata:check`，exit code 0。
  2. 执行 `npm.cmd run evidence:verify`，exit code 0；本地生成 `.tmp/evidence/unscoped-aggregate-f12f5e5fa81c-20260818114637.json`。
  3. 执行 `npm.cmd run format:check`、`npm.cmd run lint`、`npm.cmd run typecheck`，均 exit code 0。
  4. 执行 `npm.cmd run test:unit`，23 个文件、111 个测试通过；执行 `npm.cmd run test:integration`，16 个文件、54 个测试通过。
  5. 执行 `npm.cmd run verify`，build、lint、typecheck、unit、integration、E2E 均通过；既有 Windows package smoke 保持 1 项 skip。执行 `git diff --check`，exit code 0。
  6. 检查 corrected candidate artifact `unscoped-aggregate-758473eb65ed-20260818114957.json`：`exitCode: 0`、`commandStatus: passed`、`captureStatus: complete`；未发现 stdout/stderr、原始环境变量、凭据、绝对路径或用户数据。
  7. 项目所有者已批准本次 docs closeout 精确范围，并明确将人工验收标记为 `pass`。
- **Result**：
  - collector 使用显式 argv、`shell: false` 和 Windows `ComSpec` fallback；命令不存在、启动失败和非零退出均保留失败状态与真实退出码，不生成虚假通过证据。
  - validator 检查必需字段、关系类型、重复项、`conflicts_with` 依据和 shared surface 完整性；不调度任务、不修改 TASK_INDEX 或长期文档。
  - workflow 运行 metadata/evidence 检查并使用 `actions/upload-artifact@v4.6.2`、7 天保留，仅上传脱敏 JSON；没有产品代码、数据库、migration、npm 依赖或 lockfile 变化。
  - 保持 `npm.cmd run verify` 语义不变；长期文档继续要求 Agent 解释事实并在获得授权后更新。
- **Artifacts**：Draft PR #24（[PR link](https://github.com/Fyrefly-4/MyTracer/pull/24)）；corrected candidate [run `32133490249`](https://github.com/Fyrefly-4/MyTracer/actions/runs/32133490249)，job `95699517255`；artifact `unscoped-aggregate-758473eb65ed-20260818114957.json`。早一轮 run `32132410959` 的 CI 本身通过，但其 artifact 将 test-merge SHA 填入 `ci.headRevision`，该证据语义由 corrected run supersede，旧记录保留且不作为 T091 完成依据。
- **Manual acceptance**：pass；项目所有者已明确批准上述 1–4 项 docs closeout，并要求人工验收标记为通过。
- **Known limitations**：T091 尚未合入 `dev`；`dev_integration_revision`、`stage_final_integration_revision` 保持 `null`；final-head CI 属于文档 closeout 后的 PR 集成门禁；既有 Windows package smoke 有 1 项 skip；T092 仍需至少三个真实 Txxx 任务交付试运行并验证 early/candidate/final-head 区分、交付链追踪、artifact 脱敏、metadata/freshness 检查和长期文档不被自动改写后，另行授权启动。
- **Supersedes / superseded by**：corrected candidate run `32133490249` supersedes the evidence semantics of run `32132410959`; neither implies `dev` merge、Ready、tag 或 release。
- **Recorded at**：2026-08-18

### EV-T033-001

- **Status**：pass；实现、本地完整验证、Windows package/smoke、candidate/final-head hosted CI、代码 Review、获批准 docs closeout 与项目所有者人工 AC-07 均通过；任务 `done`，但不声明 Ready 或合入
- **Task / Gate**：T033 / S3 E3-03；证明 AI disabled、not-configured、failure 三态不影响核心数据能力，只形成 G3/S3 候选，不声明完整人工 AC-07、Ready、merge、tag 或 release
- **Requirements**：FR-D01～FR-D05、FR-AI06/AI09；AC-07 自动化子集；受影响回归 AC-01/AC-03/AC-04；D-003/004/008～016/101/103～109/111；ED-003/004/008/010/011/014～019；T033 合同
- **Source branch**：`task/T033-ai-data-capability-regression`
- **Source revision**：Implementation Candidate `502ed1a282bc127684229f4405072acb7ef6fb11`；docs closeout revision `94e74aba0607e83cdc4f130e7b146127c332ecf8`；base `dev@43e6406684dbb1b1ef30d006063242e9a552da80`
- **CI head/merge revision**：Draft PR #28 early run `32459230963` / job `96702610074` 在合同/metadata head `e162f6609d8ccb38fa9748a5c972af555625030c` 为 success；candidate run `32460856950` / job `96707339727` 在 head `502ed1a282bc127684229f4405072acb7ef6fb11` 为 success，PR test-merge revision `377768637a1575a7c8b05620a0bd79f440a7b9d5`；docs closeout final-head run `32461644707` / job `96709596690` 在 head `94e74aba0607e83cdc4f130e7b146127c332ecf8` 为 success，test-merge revision `cded9fda3afd968a5b3b3c018094923685a6c946`
- **Integration freshness**：`fresh`；candidate 前 fetch 后 `origin/dev` 与 merge-base 均为 `43e6406684dbb1b1ef30d006063242e9a552da80`，无需 refresh
- **Environment**：Windows 11 `10.0.26200`、Node.js v24.18.0、npm 11.16.0、Electron 43.3.0、`better-sqlite3` 13.0.1；SQLite、Electron `userData`、导出和 package smoke 均使用唯一临时根；无 live AI、真实 Provider、真实 key 或真实用户数据
- **Command or manual procedure**：
  1. `npm.cmd run governance:metadata:check` exit 0；T033 metadata sidecar 与索引关系校验通过。
  2. 定向 harness unit 5/5、SQLite 三态/故障 integration 4/4、T031/T032 data-control/export IPC 与 integration 合计 22/22 通过；authentication、parse、abort-controlled timeout 均由离线 fake 构造。
  3. 定向 Electron 回归 7/7 通过：E2E-AC-07、AC-01、AC-03、AC-04、T031 data-control 与 T032 complete export 在同一 candidate revision 执行。
  4. evidence wrapper 在 candidate 执行 `npm.cmd run verify` exit 0：129 unit、88 integration、13 Electron E2E 通过，1 项 opt-in package smoke 按设计 skip；成功 artifact `.tmp/evidence/T033-task-candidate-502ed1a282bc-20260821075359.json`。
  5. `npm.cmd run package` 与 `npm.cmd run test:package-smoke` exit 0；Windows x64 unpacked 与隔离 NSIS-installed smoke 1/1 通过。
  6. 完整 diff、允许文件、Renderer/Preload 权限、dependency/migration/T031/T032 合同差异检查通过；复核发现 failure 证据最初使用较窄 `readSnapshot()`，已改为 `readCompleteCoreSnapshot()` 并重新通过完整验证，无剩余 material finding。
  7. 项目所有者在 candidate CI 通过后明确批准修改任务状态、索引、Evidence 和 Draft PR 正文；本条只记录实际自动化，未把人工 AC-07 预标为通过。
- **Result**：
  - `disabled` 使用关闭调用门且 provider calls 为 0；`not-configured` 复用 `EmptyAiConfiguration` 并固定返回 `configured=false`/`availability=not-configured`，provider calls 为 0；`failure` 使用现有 fake provider，完全离线。
  - authentication/parse/timeout 每次失败前后的十集合完整核心快照与 sourceDataVersion 相等，没有未经确认的 Goal/Action/Routine/Record/Understanding/Confusion/TodaySelection/ReviewResult 写入。
  - 三态重复 Goal/Action/Routine CRUD、Today focus/intention、Action/Routine Record 补记与修改、Understanding/Confusion、Progress、删除 cancel/stale/confirm、完整导出和真实关闭重开；确定性 integration 结果逐对象相等，E2E 语义结果相等。
  - AI failure 后新的 SQLite 写事务、Progress 查询、删除事务、ExportPort、SQLite 重开与完整导出继续可用；导出不含 fake request marker、Provider 错误、凭据或技术路径。
  - 未修改生产代码、依赖、lockfile、schema、migration 或 T031/T032 合同；`dependency_change: false`、`migration_change: false`。
- **Artifacts**：Draft PR #28：<https://github.com/Fyrefly-4/MyTracer/pull/28>；candidate run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/32460856950>；docs closeout final-head run：<https://github.com/Fyrefly-4/MyTracer/actions/runs/32461644707>；成功本地 artifact `.tmp/evidence/T033-task-candidate-502ed1a282bc-20260821075359.json`
- **Failed evidence retained**：`.tmp/evidence/T033-task-candidate-7e68d696758f-20260821074700.json` 因 worktree 未暴露已安装 Electron/better-sqlite3 native runtime 而失败；建立忽略且不改依赖的本地 junction 后，`T033-task-candidate-7e68d696758f-20260821074856.json` 成功 supersede；最终 candidate artifact 绑定审查修订 `502ed1a`
- **Manual acceptance**：pass；项目所有者于 2026-08-22 明确报告“人工 AC-07：pass；代码 Review：完成”，未报告异常观察，并批准最后文档收口
- **Known limitations**：PR 保持 Draft 且尚未合入 `dev`；T033 不实现 Provider 接入、AI 配置 UI、Start Help、AC-02、长期记忆、S6、自动导入/恢复，也不授权 Ready、merge、`dev -> main`、tag 或 release
- **Supersedes / superseded by**：本条 pass 状态 supersedes 同 Evidence ID 的 partial/final-head pending 状态；成功 candidate artifact supersedes 早期环境失败，失败记录保留
- **Recorded at**：2026-08-22

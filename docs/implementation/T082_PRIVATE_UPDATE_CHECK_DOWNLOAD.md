# T082 — 私有源版本检查与下载

> 合同状态：approved-2，2026-09-29。项目所有者已批准本合同范围、应用版本 `0.1.2`、精确依赖 `electron-updater@6.8.10`、本机当前账户验证及 §11 权限，并激活 T082；项目所有者确认 T081 遗留缺口完成。随后 owner 批准 [范围冲突提案](T082_ESCALATION_PROPOSAL.md)：真实私有稳定 Release、只读凭据下的安装版体验及最终发布包证据归 T084，T082 以受控源自动化、包校验、云端 CI 和 owner 人工代码 review 收口；这些延期项不得记作 T082 已验证。任务实时状态以 [任务索引](TASK_INDEX_V0.1.md)为准，结果见 [EV-T082-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-t082-001)。本合同只覆盖 S8 §4 的 B 节点，不启动 T083/T084。

## 1. 任务信息

- **Task ID / Title**：T082 / 私有源版本检查与下载。
- **Slice / Plan item**：S8-B；[Implementation Plan](../architecture/IMPLEMENTATION_PLAN_V0.1.md) §13、S8 设计 §3～7。
- **Status**：`done`（T082 获批的 B 节点结果已收口；T084 的真实私有源及安装版人工验收未执行）。
- **任务基线**：`dev@0724cbb9990d328ee7ff68b7e5ac93fc8107e6d3`（创建分支时本地 `dev` 与 `origin/dev` 相同，包含 T081 PR #57）；候选及文档收口时继续核对最新授权 `dev` 与工作区。
- **任务分支**：`task/T082-private-update-download`，已从上述 `dev` 创建；本任务不创建独立 worktree。
- **任务类型**：`implementation`；采用 V2 显式权限流程，不声明 Automation Profile。

## 2. 目标结果

用户在现有应用级设置/关于区域主动检查私有稳定版更新。界面显示当前版本、可用目标版本和纯文本简短说明，或明确显示无更新、未配置凭据、鉴权失败、断网及其他可理解错误。只有用户明确选择下载时才开始；下载显示进度，失败后可重试，取消或稍后仍可继续使用核心功能。

Main 从构建时固定的私有 GitHub Releases 来源获取并校验候选和安装包；仅暴露脱敏状态给 Renderer。T082 的完成状态止于**已校验下载**。不得调用安装器、安排退出时安装、自动重启或向用户声称升级成功；安装确认与安全退出由 T083 实现。

## 3. 依据

- **S8 内部验收项**：U-02、U-03；U-05 中与候选版本、元数据及包 hash 可追溯性直接相关的部分。这些是 owner 已批准的后续维护范围，不是新增冻结 FR。
- **FR / AC**：FR-D01～D05 与 AC-07 是更新失败时仍须保持的数据与核心功能边界；T082 不单独宣称完成 AC-07。
- **D**：D-008～010、D-014、D-106、D-109、D-111 保持原义；更新信息不改变业务状态、LocalDate、AI 确认或导出范围。
- **ED / GW**：ED-004、ED-010、ED-014、ED-017～019；GW-001～010 中适用的任务、证据、评审、CI 与 Git 门禁。
- **直接设计**：[S8 设计](../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md) §3.1～3.5、§4 B、§5～7；[架构](../architecture/ARCHITECTURE_V0.1.md)、[测试策略](../architecture/TEST_STRATEGY_V0.1.md)、[GitHub 工作流](GITHUB_WORKFLOW_V0.1.md)。

### 3.1 References

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  stage_design:
    - file: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
      sections: ['3.1', '3.2', '3.3', '3.4', '3.5', '4', '5', '6', '7']
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
```

## 4. 开始条件与依赖

- [x] Owner 批准本合同的精确依赖版本、范围和 §11 权限，并明确激活 T082；任务索引登记 `active`。
- [x] T081 已由 PR #57 进入 `dev@0724cbb9990d328ee7ff68b7e5ac93fc8107e6d3`；owner 本轮确认其遗留缺口完成。T082 不再以旧的 T081 待核项作为启动阻塞，也不据此编造具体 CI 或人工测试编号。
- [x] 本地 `dev` 与 `origin/dev` 在建分支时相同；已检查本轮合同改动及分支名，从该 revision 创建任务分支，不创建 worktree。产品实现前已核对最新授权 `dev`、其他 worktree、工作区和安装身份；集成前继续检查 freshness。
- [x] Owner 批准 §12 精确版本 `electron-updater@6.8.10`；lockfile 传递依赖及与 Electron 43.3.0、electron-builder 26.15.3、NSIS x64 的实际兼容性仍须实施前/实施中验证。若不兼容，先升级提案，不顺带升级工具链。
- [x] T081 集成包应用版本为 `0.1.1`；owner 批准 T082 根应用版本升至 `0.1.2`。测试候选必须严格高于实际包内版本，不能仅修改 UI 文案模拟。
- [x] 私有来源仓库由 owner 指定为 `Fyrefly-4/MyTracer`，无公网的 fake/受控源 adapter 已用于 T082 自动化。owner 在 approved-2 中将高于 `0.1.2` 的真实稳定 Release、合成只读凭据及其安装版检查/下载体验归 T084；目前尚未准备或验证。任何真实源写入须另行授权，凭据不写入合同。
- [x] Owner 明确批准 T082 在本机当前 Windows 账户验证，不使用一次性 VM/独立测试账户；这是一项仅适用于 T082 的身份例外，不授权读取、修改或删除当前账户已有的默认 MyTracer 数据。任何实装/卸载前先核对现存安装、进程、注册项和测试路径；只使用唯一临时安装、`userData`、导出与缓存根。若现存正式安装或路径归属无法隔离，停止该项验证并报告，不覆盖或清理既有内容。测试入口、来源包与 hash 在实际执行时固定。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T081]
    blocks: [T083]
    can_parallel: []
    prefer_after: [T081]
    conflicts_with: [T081, T083, T084]
  revisions:
    required_dev_base: dev@0724cbb9990d328ee7ff68b7e5ac93fc8107e6d3
  shared_surfaces:
    - package.json, package-lock.json and electron-builder.yml
    - Application update service/port, Main assembly and IPC
    - Preload, contracts, Renderer shell and update panel
    - updater tests, package provenance and task evidence
  external:
    - fixed private source configuration with fake or controlled test adapter; real Release and read-only credential verification handed to T084
    - owner-approved current Windows account with isolated synthetic test roots
```

`required_dev_base` 是编写时已观察的最低集成候选，不是授权跳过实施前 freshness 检查。S8 §4 要求串行集成；T082 与 T081/T083/T084 共用配置、接口、测试及证据面，不能并行修改。`docs/implementation/metadata/T082.json` 是辅助校验，不授予实施权限。

## 5. 允许修改范围

| 范围 | 允许变化 |
| --- | --- |
| 依赖与打包配置 | `package.json`、`package-lock.json`：仅将根应用版本 `0.1.1` 升至已批准的 `0.1.2`、新增已批准精确版本的生产依赖及必要 lockfile；`electron-builder.yml`：固定私有 GitHub provider、稳定通道和更新元数据生成，保持 `appId`、NSIS x64、每用户安装身份。测试打包显式 `--publish never`。 |
| Application | `src/application/` 与 `src/application/ports/` 中的专用更新服务、更新端口、状态转移和候选校验；不建立通用调度器，不触碰业务 Domain。 |
| Main 与适配器 | `src/main/`、`src/infrastructure/update/`：只在 Main 读取 `MYTRACER_UPDATE_TOKEN`，接入固定来源、鉴权、超时/取消、校验、脱敏诊断及状态事件；不得从 Renderer 接收 URL/路径/token。 |
| IPC/Preload/contracts | `src/contracts/updates.ts`、`src/contracts/shell.ts`、`src/preload/index.ts` 与专用 Main IPC：具体 check/download/cancel/getStatus 方法和可释放状态订阅；运行时校验输入及 sender/origin。 |
| Renderer | 现有应用级设置/关于入口及最小更新面板、相关 UI 文案/样式；只显示版本、纯文本说明、进度、脱敏错误和重试/稍后，不增加业务主视图。 |
| 测试与说明 | 对应 `tests/unit/`、`tests/integration/`、`tests/e2e/`、`tests/support/` 的 fake/受控源验证；新增本机只读凭据配置、轮换、撤销与重启生效说明及 T082 维护说明。 |
| 任务记录 | 本合同、T082 metadata、任务索引 T082 行；真实执行后由 owner 批准 docs closeout 再写 `ACCEPTANCE_EVIDENCE_V0.1.md`。 |

若现有 Renderer 设置/关于入口需要调整超出上述文件，先记录确切文件和理由并按合同权限处理。测试辅助不得读取真实 token、用户数据或正式更新源。

## 6. 明确非范围

- T083 的安装确认、`quitAndInstall`、安全退出、未保存内容检查、Main 写入冻结及安装后健康检查；T084 的 Actions 候选构建/发布、正式私有 Release 与完整阶段验收。
- 自动/定时检查、通知、自动下载、退出时静默安装、强制更新、降级、预发布通道、热替换、多平台、账号、遥测、自动备份/导入恢复、跨重启草稿持久化。
- schema/migration、业务记录/统计/日期语义、导出契约、AI Provider/上下文/权限或密钥存储方式的改变。
- 代码签名、发布者身份承诺、正式源资产发布、真实凭据提交或配置持久化；不得以关闭 Windows 安全保护解决无签名问题。
- Ready、合并、推进 `main`、tag、Release、发布 workflow dispatch、强推或远端删分支，除非获得另行明确授权。

## 7. 必须保持的不变量与局部风险

1. 更新操作只由用户触发；无 token、鉴权失败、断网、超时、下载失败时核心记录、查看、管理和导出仍可用。未配置/过期凭据与“无更新”是不同状态。
2. 只允许固定 HTTPS 私有源与稳定通道；候选须高于当前应用版本、不是同版/低版/预发布，且与元数据中的版本、资产和校验值一致。对未知/不支持的来源版本 fail closed。候选变化使旧下载确认失效。
3. Main 独占网络、token、下载与本地缓存。`MYTRACER_UPDATE_TOKEN` 仅由 Main 在启动时读取；不复用 AI key、`GH_TOKEN`、发布 token，不写安装包、配置、SQLite、导出、日志、证据或 Renderer DTO。对私有 GitHub API 与资产重定向校验目标和凭据转发边界。
4. 下载前须用户明确确认；关闭面板/稍后、普通退出均不得安装。更新器默认自动下载和退出安装行为必须显式关闭并测试，不能只靠隐藏 UI 按钮。
5. 单一活动操作使用 operationId 与候选版本绑定。重复请求互斥；取消/超时后可重试，迟到回调不可覆盖新状态。订阅可释放，Renderer 重挂载不重复触发网络操作。
6. 远端说明以纯文本显示，不执行 HTML/脚本。对校验失败或损坏缓存不得报 `downloaded`；本地缓存复用前重新校验。T082 不调用安装器，不宣称新版本启动成功。
7. 保持 T081 的安装身份、`userData` 规则、schemaVersion=3、完整导出、业务事实与 LocalDate。当前账户测试只使用合成数据、fake AI、唯一临时根；安装/卸载前核对现存进程、安装注册项和绝对路径，清理仅限确认属于本次测试根的内容，不触及真实用户数据或已有默认安装。

**局部风险**：updater 私有 GitHub 鉴权机制默认使用 `GH_TOKEN`，而 S8 批准的专用变量是 `MYTRACER_UPDATE_TOKEN`；实现须在 Main 显式桥接受限认证，验证 token 不进入发布配置、Renderer 或重定向的非信任主机。若所锁版本无法同时满足私有读取、无签名下载完整性和禁止退出安装，停止该路径并提出升级提案，不降级安全边界。

## 8. 交付物

- 用户主动检查、确认下载、进度、取消/稍后、错误与重试的可观察体验；已校验下载状态包含版本和 operationId。
- 独立 UpdatePort/服务与 Main 适配器、窄 IPC/Preload 契约、受控私有源配置及脱敏诊断。
- 应用版本 `0.1.2`、精确版本的 `electron-updater` 及 lockfile 传递依赖记录；构建产物的更新元数据与安装包 hash 校验说明，不提交二进制。
- 无 token、错误 token、断网、超时、损坏元数据/包、重定向、迟到事件、重复操作、同版/低版/预发布的分层测试；受控源而非真实公网进入普通 CI。
- 凭据首次配置、轮换、撤销和重启生效步骤；说明检查更新访问分发服务时会产生 IP 等网络元数据，以及 unsigned 限制。
- T082 的定向/完整验证、完整 diff 与 owner 人工代码 review、early/candidate/final-head CI、实际 evidence；T084 的真实私有源和安装版人工状态单独交接，不把计划写成通过结果。

## 9. 可判定验收条件

1. 用户未打开更新入口或未点击检查时无更新网络请求；点击后显示当前版本和 `upToDate`、`available` 或可理解的失败状态，未配置/过期凭据不伪装成无更新。
2. T082 安装包的实际应用版本为 `0.1.2`，与 T081 的 `0.1.1` 严格递增；只有在当前有效候选上点击下载才开始传输，界面显示进度；重复点击只保留一个操作。下载失败、取消、超时后可重试，业务核心操作不受阻。
3. 固定私有来源、稳定且严格递增版本、资产名与元数据的预期 hash 通过后才到 `downloaded`；篡改元数据/包、错误 host/重定向、同版/低版/预发布、不支持的来源版本均安全拒绝并给出脱敏原因。
4. Main/IPC 拒绝非法输入和非可信 sender；Renderer 不获得 token、URL/文件路径、`ipcRenderer` 或任意 channel。事件由 operationId/版本关联；旧回调与卸载订阅后不改变当前状态。
5. 测试与打包证明无自动检查、自动下载、退出时安装、安装器执行或正式源发布；T082 只交付经校验下载。普通关闭应用后不得安装，重复启动若复用缓存必须重新校验。
6. 精确依赖及其传递依赖、当前 Electron/builder 兼容性、`--publish never`、Windows x64 NSIS 与相同 `appId` 有实际证据；定向、受影响回归及 `verify` 通过，完整 diff 和独立 review 无未处理 material finding。
7. **MANUAL / 交接**：owner 的 T082 人工代码 review 通过须有实际报告。当前账户安装版在真实私有稳定 Release 与只读凭据下的检查、断网、鉴权失败、下载/重试/稍后和 unsigned 提示，连同真实安装连续 E2E、发布包 provenance 与正式发布，归 T084 阶段验收；在 T084 实测前保持 `pending`，不得从 T082 的 fake/受控源或打包 smoke 推断通过。

## 10. 验证计划

### 10.1 合同准备阶段（历史）

合同准备阶段只检查合同/sidecar/索引结构、引用、Markdown 格式和 diff，未产生 T082 行为证据；后续实际结果见 EV-T082-001。

### 10.2 实施后定向验证

以下为合同规划的定向入口；实际执行的命令、环境和结果以 EV-T082-001 及对应 CI artifact 为准，不能把测试名当作通过证据：

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/update-service.test.ts
npm.cmd run test:integration -- tests/integration/updates-ipc.test.ts
npm.cmd run test:e2e:run -- tests/e2e/update-check-download.e2e.test.ts
```

上述三个测试文件已由 T082 创建。T084 的真实私有源 Windows 安装版检查/下载须以来源 URL、版本、资产和 SHA-256 绑定实际产物；执行前按其合同完成现存安装、进程、注册项与测试路径预检。T082 的 fake/受控源通过只证明本任务实现边界，不替代 T084 的实际私有分发验证。

### 10.3 受影响回归、打包与证据

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

`verify` 包含 build、Unit、Integration 与常规 Electron E2E，但不证明私有源实装或跨版本安装。打包须检查 `app-update.yml`、`latest.yml` 与包的版本/hash 一致，且没有上传；`test:package-smoke` 或新包的正式 `appId` 安装测试只在 §4 获批的当前账户、完成预检并限定临时根后执行。T082 的当前账户权限来自本合同，不借用 T081 例外，也不授权清理默认数据。

Owner 在实施中指定后续测试仅在云端运行；候选及文档 final-head 验证使用 GitHub Actions 的 Windows runner。随后 owner 仅对当前 T082 测试允许本机当前账户验证；本机据此只读预检并在 `7b5baa9` 以 `--publish never` 构建 `0.1.2` 包、核对版本/hash/签名，未安装、发布或读取默认数据。较早本地包证据按当时 source 单独记录；当前包亦不代替 T084 的真实私有源实测。

关键命令用 `node tools/evidence/capture-command.mjs --task T082 --gate <gate> --base-revision <实际 SHA> --output .tmp/evidence -- <明确 argv>` 捕获真实退出码。先运行 metadata 校验；JSON 不含 stdout/stderr、绝对路径、token、正文、数据库或完整日志。区分 early、candidate、final-head CI 的 PR head/test-merge revision 与任务交付/`dev` 集成 revision；失败 artifact 保留并用 supersedes 记录后续结果。

### 10.4 验证环境

- OS：Windows x64 当前账户（owner 本次特批）；真实安装版先预检现存安装/进程/注册项，自动化使用唯一临时 `userData`、安装/缓存根和合成数据，不读取或清理默认数据。
- Node/npm/Electron/builder：实施时记录实际锁定版本；编写时项目为 Node 24.18.0、npm 11.16.0、Electron 43.3.0、electron-builder 26.15.3。
- 更新源：T082 单元/集成/常规 E2E 为 fake adapter 或受控本地源；真实私有稳定 Release 与只读凭据验证归 T084。固定 owner/repo 为 `Fyrefly-4/MyTracer`，凭据不得写入合同或日志。
- T082 当前 `0.1.2` 包的 source、版本/hash、更新元数据和 unsigned 状态见 EV-T082-001；T084 的真实候选包、访问控制和人工环境按实际执行再填，不预填成功。

## 11. Git 与 GitHub 权限

Owner 已批准 T082 本地写入、在当前 checkout 从 `dev` 建任务分支、提交、普通 push、创建/更新目标为 `dev` 的 Draft PR，以及在审查与 CI 门禁通过后标记 Ready。任务分支及 PR #58 已创建并推送；本任务不创建独立 worktree。merge、main、tag、release 和非任务外部写入不在此授权内。

- [x] 在当前 checkout 创建任务分支；不创建 worktree。
- [x] 创建本地提交。
- [x] 普通推送任务分支（已执行）。
- [x] 创建或更新目标为 `dev` 的 Draft PR（PR #58 已创建）。
- [x] 在审查与 CI 门禁通过后将 Draft 标记为 Ready（权限已批准；PR 当前状态以 GitHub 为准）。
- [x] Agent 不合并到 `dev`。
- [x] Agent 不创建或合并 `dev -> main` PR。
- [x] Agent 不创建 tag 或 Release。

```yaml
permissions:
  local_write: true
  create_worktree: false
  create_task_branch: true
  create_commit: true
  push_task_branch: true
  create_or_update_draft_pr: true
  mark_ready: true
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: true
  migration_change: false
  external_write: false
```

`dependency_change: true` 仅限 §12 的精确依赖及其 lockfile；`external_write: false` 指非任务外部写入，已单列的普通 push/Draft PR 权限仍有效。任何 merge、tag、release 和真实源写入仍须针对确切目标另行授权。

## 12. 依赖、网络与外部操作

- **应用版本**：owner 批准仅将根应用版本 `0.1.1`→`0.1.2`，同步 `package.json`/lockfile，不替换已发布的同版资产。T082 fake/受控源用严格高于 `0.1.2` 的合成候选验证状态转移；T084 实际私有候选必须是真实更高版本，来源、hash 和用途在执行时固定，不由 T082 提前确定 T084 发布版本。
- **精确依赖**：owner 批准仅新增生产依赖 `electron-updater@6.8.10`，使用精确版本而非 `^`/`~`；不升级 Electron 43.3.0、electron-builder 26.15.3 或其他直接依赖。2026-09-29 从 npm registry 只读核对该版本、`builder-util-runtime@9.7.0` 等声明的传递依赖；实际安装与 Windows x64 NSIS 打包已在云端候选 CI 通过，详见 EV-T082-001。
- **网络**：T082 普通测试只访问 fake/受控源；真实私有 GitHub 只读检查/下载归 T084，并限获批来源和合成只读凭据。`MYTRACER_UPDATE_TOKEN` 配置由用户在本机进程环境注入，轮换/撤销后重启生效；不添加应用内凭据页面或持久化。
- **外部写入**：owner 已批准并已执行本任务普通分支 push 与 PR #58；不授权创建/修改真实 Release、Actions secret/environment、发布源、tag 或 dispatch。
- **AI / 数据**：fake Provider、临时根、合成业务数据；不访问真实 key/数据库，不迁移、不做破坏性操作。

### 12.1 Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@0724cbb9990d328ee7ff68b7e5ac93fc8107e6d3
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

实施及集成时分别记录 `original_base_revision`、`latest_authorized_dev_revision`、`verified_against_revision`、Integration Freshness 状态和 `refresh_method`。陈旧时仅以可追溯普通 merge 刷新、重跑受影响回归，并在 review surface 改变时重审；不得 force-push。进入 `dev` 仍需 owner 针对具体 PR 批准。

## 13. 风险与停止条件

私有 GitHub 鉴权无法在专用本机只读凭据下安全实现；token 可能进入日志/Renderer/非信任重定向；updater 不能禁用隐式下载或退出安装；元数据/hash 无法证明资产完整性；无签名包无法按已批准策略可靠下载；依赖版本与现有工具链不兼容；需修改 schema、安装身份、AI 权限或正式源；当前账户存在不可隔离的既有安装或清理目标；证据无法绑定当前 revision/包——发现时停止受影响工作，保存安全结果并按 [升级提案模板](ESCALATION_PROPOSAL_TEMPLATE.md)提出精确决策。真实私有源/发布包的实际结果留待 T084，不因源尚未发布阻塞 T082 的已批准 B 节点收口；不得用公网成功、旧 CI 或跳过测试冒充 T084 证据。

## 14. 完成报告

列出实际改动文件、U-02/03 与相关 FR/AC/D/ED 边界、精确依赖/lockfile、检查与下载结果、定向及完整命令和退出码、Windows/受控源/凭据隔离、source 与包/元数据 hash、diff/独立 review、PR/CI/freshness、owner 人工状态、残余风险和未验证项，以及是否出现需求冲突或范围变化。T082 完成不代表安装、发布或 S8 阶段验收完成。

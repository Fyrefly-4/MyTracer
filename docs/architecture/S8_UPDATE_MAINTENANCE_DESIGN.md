# MyTracer S8：应用更新与维护阶段设计草案

> 2026-10-11 事实校准：S8 已按 owner 明确豁免完成 T809 交付/集成，并由 PR #62 晋升 main；剩余真实矩阵未执行且接受风险。PR #64 的 tag 发布改造仅进入 dev，尚未进入 main；v0.1.4 为演练，正式发布未执行。当前证据见 [EV-DOC-CALIBRATION-001](../implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)；下文准备/执行快照均按原日期理解。

## 1. Stage information

- **Stage**：S8 — Update Maintenance（owner 授权自主分配的后续维护阶段；不改变 S0～S7 的历史范围）。
- **Title**：保留数据的 Windows 原位升级与用户主动更新。
- **Status**：设计 approved；T081～T084/T809 交付与 main 晋升已核验，按 owner 明确豁免闭合本次验收；不把未执行矩阵或首次正式发布记为通过。任务状态以任务索引为准。
- **Owner approval**：2026-09-29 owner 已批准首期 U-01～05、electron-updater 引入、S8/T081～T084 自主编号、个人私有且不配置代码签名的分发方式；在说明影响后进一步回复“同意，现在在合同中更新”，确认私有 GitHub Releases＋本机只读凭据，以及 Actions 自动准备、owner 手动确认发布的流程。上述决定已生效，不重复请求批准；本次为文档更新，不代表实际发布执行。
- **Target branch**：后续实现进入 `dev`；T081 使用 `task/T081-in-place-upgrade`，T082 使用 `task/T082-private-update-download`，均不创建 worktree。任务激活与实施以各自合同和任务索引为准。
- **Prior behavior revision**：`dev@d8b211b3c184cff8d0afdb09ff4b13164704290b`。
- **授权解释**：据授权分配 S8 及 T081～T084；T081/T082 已集成，T083 按批准合同实施。2026-10-02 owner 批准 T083 §9.5 替代验收，2026-10-03 批准文档收口；完整真实应用内跨版本交接仍保留为 S8 最终门禁。T084 已按独立合同激活并集成；T809 按另行批准合同聚合，不从前项交付自动启动。

## 2. Baseline manifest

```yaml
baseline:
  product_requirements:
    file: docs/PRODUCT_REQUIREMENTS_V0.1.md
    version: v0.1
  decisions:
    file: docs/DECISIONS.md
    revision_or_date: d8b211b3c184cff8d0afdb09ff4b13164704290b
  architecture_documents:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  workflow: docs/implementation/GITHUB_WORKFLOW_V0.1.md
  prior_behavior_revision: dev@d8b211b3c184cff8d0afdb09ff4b13164704290b
```

依据文件：[PRD](../PRODUCT_REQUIREMENTS_V0.1.md)、[Decisions](../DECISIONS.md)、[变更规则](../REQUIREMENTS_CHANGE_POLICY.md)、[架构](ARCHITECTURE_V0.1.md)、[数据设计](DATA_DESIGN_V0.1.md)、[工程决策](ENGINEERING_DECISIONS_V0.1.md)、[实施计划](IMPLEMENTATION_PLAN_V0.1.md)、[测试策略](TEST_STRATEGY_V0.1.md)、[GitHub 工作流](../implementation/GITHUB_WORKFLOW_V0.1.md)。

### 2.1 已核实事实与限制

- 本地 `dev` HEAD 为上述 revision，提交说明为 T072 Demo 收敛（PR #56）；检查开始时工作区干净。[任务索引](../implementation/TASK_INDEX_V0.1.md) 将 T072 标为 done。
- [T072 合同](../implementation/T072_DEMO_CONVERGENCE.md)及 [EV-T072-001](../implementation/ACCEPTANCE_EVIDENCE_V0.1.md)记录候选自动化与 owner 人工结果。证据仍保留 `dev_integration_revision=null` 的历史交接描述，与当前本地集成事实存在文档漂移；本次只报告，不修改旧账本。
- 未重新查询远端、重跑 T072、确认 G4 或正式 release；本地集成 revision 不是新阶段的验收结果。实施前重新核对最新授权 `dev` 与必要的 T072 最终证据。
- 固定的先前 `dev@d8b211b...` 基线：`electron-builder.yml` 为 NSIS x64、每用户安装、`appId=io.mytracer.desktop`；`package.json` 应用版本 `0.1.0`、electron-builder 26.15.3、Electron 43.3.0，未声明 electron-updater。T081 候选仅将根应用版本升为 `0.1.1`，不改变上述依赖和安装身份。
- 数据库路径由 Main 的 `app.getPath('userData')` 决定，位于 `data/mytracer.sqlite3`；当前 schemaVersion=3，WAL 模式，每步迁移事务化，拒绝高于已知版本的数据库。
- AI 配置由独立配置适配器保存；退出时 Main 清理会话并关闭 SQLite。Renderer 有会话内状态，不能视为跨重启持久草稿。
- 单版本打包 smoke 不能代替两份不同版本安装包之间的升级证据；T081 已用真实 `0.1.0`→`0.1.1` NSIS 包单独验证，范围与限制见 `EV-T081-001`。

基线或工具链变化后须重新评估本文；不自动将新提交视为同等已验证输入。

## 3. Stage delta

### 3.1 Goal and observable outcomes

首期目标：Windows 用户无需先卸载，即可手动原位升级；具备更新器后，可以在应用内检查、下载并明确确认重启安装，已有核心记录和同一 Windows 用户的配置继续可用。

下列 U 编号为已批准首期范围的内部验收项，作为后续实施合同输入；不是新增冻结 FR 编号。

| 编号 | 首期可观察结果                                              | 既有依据与新增边界                                          |
| ---- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| U-01 | 旧安装版直接升级新版；核心事实、关联、日期、配置保留        | FR-D01～D05、AC-07；新增跨版本升级验证                      |
| U-02 | 主动检查版本，显示无更新、可更新或可理解的失败原因          | 本次 owner 更新流程设计授权；现有 PRD 未定义更新功能        |
| U-03 | 用户确认下载，显示进度；失败可重试且不阻断核心操作          | 新增维护体验；沿用 D-015 的核心独立原则，不冒充原有 AC 覆盖 |
| U-04 | 下载校验通过后，用户明确选择重启安装；取消/稍后继续使用     | 新增确认边界；保持会话输入与业务事务安全                    |
| U-05 | 发布包、版本、源 revision、校验值、更新说明与验收结果可追踪 | GW 发布门禁、ED-018/019                                     |

首期非范围：运行中热替换 JS、后台定时检查、系统主动通知、强制更新、退出时静默安装、自动降级、多平台、账号、同步、预览版切换、遥测上传、完整诊断导出、自动数据导入恢复、跨重启草稿持久化。

### 3.2 New or changed behavior

**首期兼容边界**：不新增业务表或 migration，不修改 schemaVersion=3、导出契约、AI Provider 或上下文。首期不以实现自动备份为前提；只允许发布经兼容矩阵验证的版本。以后任何新增 migration 必须先完成 §7 的独立数据保护设计与批准，不能因已有更新器而默认放行。

**安装身份与数据**：保持 appId、应用数据目录解析规则和安装模式稳定；允许的安装路径变动单独验证。更新不能删除 userData，不能以数据库打不开为由创建替代空库。正常覆盖升级保留原有加密配置；跨机器或跨 Windows 用户的凭据迁移不在此承诺内。

**交互**：在现有应用级设置/关于区域提供更新入口，不新增业务主视图。先展示当前版本、目标版本和简短说明，再下载；发布说明按纯文本处理，不执行远端 HTML/脚本。下载后允许继续使用。普通关闭应用不代表同意安装；下次启动如复用下载缓存，重新校验并再次确认。

**状态草案**：idle → checking → upToDate / available / error；available → downloading → downloaded / error；downloaded → preparing → installing。error 保存可重试动作；同一时刻只允许一个更新操作。以 operationId/候选版本关联事件，忽略已取消或过期操作的迟到回调。安装结果必须由新版实际启动与健康检查确认，不能在退出旧版时宣称成功。

**安全退出**：用户请求安装后，检查所有未保存表单、会话草稿与未确认 AI 建议。首期遇到这些内容时阻止安装并引导用户返回处理；不得自动保存或丢弃。Main 进入准备退出状态后拒绝新的业务写命令，等待已启动写入、导出及配置保存完成，取消未完成 AI 请求并忽略迟到结果，然后关闭数据库并交给安装器。取消或超时应解除准备状态，继续旧版使用；若关闭已开始则重新建立可用状态或提示重新启动，不能留下可操作但连接已关闭的界面。UI 禁用按钮不能替代 Main 的互斥与状态检查。

**多实例**：核对并实现单实例/更新互斥保护，验证第二实例不能同时写库或替换运行中的程序；手动安装也要验证在应用仍运行时的行为。

**版本策略**：应用版本、数据库版本、导出版本独立管理。首期只发布稳定通道和单调递增版本，禁止同版本覆盖资产、默认降级及预发布自动进入稳定通道。兼容矩阵记录最低支持来源版本；不支持的跳版本在发布前停止，后续如需客户端兼容声明须另定义并验证，不能假设更新库自动理解数据库版本。

### 3.3 Interfaces

| 边界        | 拟议变更                                                                                                       | 保持的限制                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Domain      | 无新增业务对象                                                                                                 | 五种 Routine 语义、LocalDate、历史、删除规则不变                                        |
| Application | 专用 UpdateService + UpdatePort；check、download、prepareInstall、confirmInstall、cancelPreparation、getStatus | 不创建通用任务调度器；Query 不触发网络检查或写库                                        |
| Main        | 装配更新适配器、验证候选、维护安装准备状态及退出互斥                                                           | URL、文件和安装执行只在 Main；无 Renderer 任意下载能力                                  |
| IPC/Preload | 新增具体 updates 方法及可释放状态订阅；DTO 仅版本、状态、进度、脱敏错误和操作标识                              | sender/origin、运行时输入、状态转换均验证；不暴露 ipcRenderer、路径、令牌或任意 channel |
| Renderer    | 更新面板、下载/重启确认、统一未保存内容检查                                                                    | 不访问 Node/SQLite；卸载订阅；网络失败不遮挡日常业务                                    |
| SQLite/导出 | 首期不改结构和格式，验证关闭、重开与事实守恒                                                                   | 不把升级过程写进核心记录，不自动恢复或降级数据库                                        |
| AI/凭据     | 仅处理退出时取消请求及配置保存协调                                                                             | Provider、权限、上下文不扩展；更新请求不携带 AI key 或用户正文                          |

接口名称是设计候选，合同阶段依据现有 contracts 布局精化；不得提前建立占位 API。

### 3.4 更新源、依赖与发布者身份

| 选项                     | 适用条件                 | 代价与决定                                                          |
| ------------------------ | ------------------------ | ------------------------------------------------------------------- |
| 独立公开 GitHub Releases | owner 已排除首期公开分发 | 不采用                                                              |
| 私有 HTTPS 存储          | 首期不采用               | 如未来更换分发服务，另行评估                                        |
| 私有 GitHub Releases     | 已批准首期更新源         | 本机只读凭据鉴权，禁止内置共享 PAT/发布凭据；具体仓库地址为部署参数 |

保留 NSIS；owner 已同意引入 electron-updater，具体版本由实施合同核查兼容性后锁定并列明传递依赖，不顺带升级 Electron/builder；本轮不安装。Windows NSIS、私有源鉴权和元数据能力依据 [electron-builder v26 更新文档](https://www.electron.build/v26/docs/features/auto-update/)。安装身份稳定性依据 [NSIS 文档](https://www.electron.build/v26/docs/nsis/)。文档查阅日：2026-09-29；不能把文档能力当作本仓库测试结果。

按 owner 决定，首期个人私有使用不申请代码签名证书、不配置发布者身份校验。仍保留 HTTPS、私有源访问控制、更新包完整性检查、固定分发源与明确安装确认。签名缺失须记录为 unsigned，不得声称已经验证发布者；Windows 可能显示未知发布者或拦截，人工验收记录实际体验，不通过关闭系统安全功能解决。具体 updater 对未签名 NSIS 的行为由 T082/T084 核查验证，失败时保留手动安装路径并报告，不静默扩大信任范围。

更新源由构建配置固定，不允许 Renderer 指定 URL；正式分发仅 HTTPS，重定向策略兼容所选源并验证。正常使用不上传记录、导出、配置和密钥；检查更新会访问分发服务，服务可见请求 IP 等网络元数据，应在维护说明中如实交代。

构建与发布分离：配置 publish 后，测试打包显式禁用发布（采用 builder 的 `--publish never`），避免在带凭据/CI 环境隐式上传。已批准流程：构建 → 验证 → 固定产物与 hash → owner 手动确认 → 发布私有 Release 及配套元数据。Actions candidate/publish workflow 已由 T084 实现；候选与演练结果已记录，正式 accepted-main 发布尚未执行。

坏版本处理：停止推荐问题版本，保留可追溯资产，发布更高版本修复；不替换已发布同名资产。已安装用户不自动回退。修复沿用 GW 的 hotfix 和回流规则；合并单独批准，发布按 §3.5 的已批准人工触发机制执行。

### 3.5 已批准的私有访问与 GitHub Actions 发布约定

私有分发采用已批准的本机只读凭据，限定分发仓库、可撤销且有有效期；发布用写权限凭据仅留在 CI。首期实现选择为 Main 读取专用本机环境变量 `MYTRACER_UPDATE_TOKEN`，不新增应用内凭据持久化或配置页面，不复用 AI key 或发布 token。不能将 token 编进安装包、SQLite、导出、日志或 Renderer；测试启动环境显式移除真实变量，仅注入合成值。未配置/过期时更新显示不可用，核心功能仍运行；鉴权失败与“无更新”严格区分。T082 文档说明首次配置、轮换、撤销和重启生效步骤。固定私有仓库已配置，专用凭据由 owner 本机管理；owner 报告真实检查/下载/更新通过，凭据值不写入文档。

2026-10-06 owner 批准轻量维护改造为“main 自动准备、owner tag 批准、Actions 自动发布”，取代原五参数 workflow_dispatch 与逐版本审批 JSON 门禁：

1. Verification 继续只读验证；Update candidate 在 main push 准备不可变候选、hash 和测试摘要，PR 候选仅供审阅。main 候选并发按源 SHA 分组，后续 main 提交不取消先前源的构建。
2. Owner 审阅合格候选后，在对应 main 源提交上创建并推送严格稳定版本 tag，即批准该源及其通过校验的候选产物进入正式更新源。源可在 main 历史中，不必是最新 HEAD；tag/package/lock/manifest 版本须一致。Agent 不自行 tag，代 owner 操作须有具体版本授权。
3. 只读 validate job 认证 owner login/numeric ID 与 push 新建事件、检查 main ancestry，并自动解析候选 run/attempt/artifact 和 hashes。选择固定 workflow、精确源、main 的最新成功 run 及唯一候选；失效或歧义停止。支持 annotated/lightweight tag，不依赖可伪造的 tagger 文本。
4. Publish job 只重验 validate 固定的 selection，校验实际 tag object/source、不可变 archive/manifest/资产、成功命令证据、兼容边界及版本递增。已有 tag 必须正确；已有 Release 包括 draft 拒绝覆盖。仅 publish 获同库写权限，先 draft、上传和回读校验，最后再次检查 tag/main 来源才发布 stable/latest。部分失败保留现场，不自动清理或覆盖，不创建 tag、推进分支或回写账本。
5. 过早 tag 可在合格候选就绪后由 owner 重跑。过期候选可在候选手动入口选择原 main 源 tag 重建；先只读验证其 main ancestry，manifest 保留实际 ref。发布始终拒绝 PR/dev 来源。真实 feed 变化只发生在 owner tag 授权后的正式发布；首次部署须包含新 workflow，并单独核验真实链路。

具体操作和故障处置见 [T084_RELEASE_OPERATIONS.md](../implementation/T084_RELEASE_OPERATIONS.md)。不引入 Environment 审批、套餐变更、凭据持久化或新的依赖。本次记录 owner 批准的发布机制变化，保留历史阶段证据，实际上线以 main 集成为准。

## 4. Task graph and shared surface

编号映射：A=T081 原位升级基线，B=T082 私有检查与下载，C=T083 确认安装与退出协调，D=T084 发布流程与阶段验收。编号由 owner 授权自主决定；T081～T083 的合同与权限见各自批准合同，T084 已按独立批准合同实施。按 A→B→C→D 串行集成。

| 节点                 | 可观察交付 / 依据                                                      | 允许模块或文件                                                                                                                | 排除与验证                                                                                    |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A 原位升级基线       | 两个不同版本安装包升级后事实保留；U-01、FR-D01～D05、AC-07、ED-018     | electron-builder.yml、打包脚本、tests/e2e/windows-package-smoke.e2e.test.ts、隔离安装测试辅助与升级说明                       | 不接生产更新源、不迁移数据；验证旧→新、运行中安装、重开、导出、合成配置保留                   |
| B 检查与下载         | 从受控源检查并下载可信候选；U-02/03、ED-004/019                        | package.json/lock、构建配置、Application 更新服务/端口、Main 更新适配器与 IPC、Preload/contracts、Renderer 更新入口、对应测试 | 不执行安装、不自动检查、不上传；fake 更新器与受控源验证断网/取消/超时/校验失败/迟到事件       |
| C 确认安装与退出协调 | 明确确认后安全退出安装并重开；U-04、FR-D01、D-014/109、ED-010/018/019  | Main index/退出协调/写入入口、更新服务、Preload/contracts、Renderer 表单/会话状态接点、更新 E2E                               | 不改业务语义、草稿不持久化；验证未保存内容阻断、事务/导出等待、单实例、拒绝新写与失败解除     |
| D 发布与阶段验收     | 安装版应用内旧→新完整证据、可复现分发说明；U-01～05、全部受影响 AC、GW | .github/workflows、打包/证据工具、更新测试夹具、发布/验收说明                                                                 | 不自动发布或签人工；验证未签名策略、私有鉴权、元数据、真实安装更新、核心回归及 owner 手动验收 |

```yaml
tasks:
  A:
    requires: []
    blocks: [B]
    can_parallel: []
    prefer_after: []
    conflicts_with: [B, D]
  B:
    requires: [A]
    blocks: [C]
    can_parallel: []
    prefer_after: [A]
    conflicts_with: [A, C, D]
  C:
    requires: [B]
    blocks: [D]
    can_parallel: []
    prefer_after: [B]
    conflicts_with: [B, D]
  D:
    requires: [A, B, C]
    blocks: []
    can_parallel: []
    prefer_after: [C]
    conflicts_with: [A, B, C]
```

共享面：A/B/D 共用 builder、package、安装测试与发布配置；B/C 共用 Main 装配、更新服务、IPC/contracts、Preload 和更新 UI；C/D 共用连续更新 E2E 与退出流程断言。所有节点 schema_tables=[]，业务 Domain 不变；共享不变量为“不丢失已有事实、未经确认不安装、真实数据隔离”。A/D 风险高（安装和发布），B 风险高（下载可执行程序），C 风险高（退出与写入并发）；integration_policy=serial。

## 5. Invariants and local risks

- FR-D01～D05、AC-07、D-008～010/014/106/109/111、ED-004/010/014/017～019 保持；更新不得制造 Record、改变历史日期或扩展导出内容。
- 网络与更新失败不导致核心功能不可用；更新器不能成为读取 SQLite 的启动依赖。
- 所有确认绑定当前已验证候选，候选改变必须重新确认。普通退出、点击下载、关闭更新面板都不是安装授权。
- 完整枚举 Goal/Action/Routine/Review/记录/AI 配置等未保存状态；不能仅覆盖 Today 草稿。Renderer 无响应时拒绝安装，不将其视为没有草稿。
- 安装器失败或中断可能使程序不可启动；不承诺安装原子性。保留手动同版本修复/更高兼容版本安装包及应用外恢复说明，并实际演练数据仍在的路径。
- 自动化安装/卸载不得触及真实用户的相同 appId 注册项：默认使用一次性 Windows VM/独立测试账户和隔离数据根；仅改 `--user-data-dir` 不足以隔离安装注册状态。Owner 已分别批准 T081 与 T082 在当前 Windows 账户执行，T082 的例外仅限其合同要求的现存安装/进程/注册项预检和唯一临时根，不授权读取或清理默认数据；无法隔离既有安装时停止受影响验证。不同测试 appId 的结果不能独自证明正式身份升级兼容。
- 开发包、unpacked、fake adapter 的通过不能替代真实安装器、批准的信任策略和更新源的验证。

T083 当前账户例外由 owner 另行明确批准：不使用 VM/独立测试账户；每次实装先预检现存进程、安装与注册项，仅用唯一临时安装/数据/缓存根和合成配置，无法隔离时停止，不能读取或清理默认真实资产。

## 6. Validation and stage gate

### 6.1 分层验证

| 层                   | 必须证明的风险                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                 | 状态转移、版本比较、重复请求互斥、迟到事件忽略、显式安装确认、候选变更失效                                                                |
| Integration          | IPC 输入与来源、固定源、完整性失败/私有源鉴权拒绝、写入/导出/配置协调、关闭失败解除、假更新器不访问公网                                   |
| Renderer E2E         | 无更新/断网/下载失败/重试/稍后、每种草稿的阻断、取消不丢输入；更新面板不阻挡核心流程                                                      |
| Windows 安装连续 E2E | 已安装 A 创建全部核心状态与合成配置 → 退出/重开 → 安装 B → 同一数据根读取 → 导出比对 → 新增记录 → 再重开                                  |
| 应用内连续 E2E       | 已含更新器的 B → 主动检查 C → 下载 → 有草稿阻断 → 主动处理草稿 → 确认安装 → 新版启动和数据核对；中途不重置 fixture                        |
| 失败与兼容矩阵       | 损坏包、无权访问/凭据过期、缺失元数据、下载断网、磁盘不足、拒绝安装、安装中断、同版/低版/预发布、过新数据库安全拒绝；支持来源版本逐项验证 |

首个无更新器版本需要手动原位安装一次 B；B→C 才能证明应用内更新。A/B/C 必须是明确不同版本和可追溯产物，不能用修改界面版本文案模拟升级。同 schema 比对全部业务字段及关联，忽略允许变化的导出时间和应用版本；凭据用合成值检查，同机解密后仅断言可用，不进入日志/证据。

T083 的任务级验收按 2026-10-02 owner 决定拆分为真实 `0.1.2→0.1.3` 手动 NSIS 数据连续性和 `0.1.3` 应用内协调分层测试；保留 `0.1.3`，取消额外双包测试。原 T082 `0.1.2` 缺少确认安装入口，因此本次不声称完整应用内跨版本升级通过。真实应用成功交接安装器、新版启动及旧数据核对的连续流程留待后续版本/任务，仍须在 S8 最终门禁完成；不自动激活 T084。证据与限制作具体区分，见 [T083 合同](../implementation/T083_CONFIRM_INSTALL_SHUTDOWN.md) §9.5 和 [EV-T083-001](../implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-t083-001)。

### 6.2 命令与证据

现有受影响验证命令：`npm.cmd run test:unit`、`npm.cmd run test:integration`、`npm.cmd run test:e2e`、`npm.cmd run verify`、`npm.cmd run governance:metadata:check`。后续明确合同中的定向文件和证据 wrapper 参数。

打包采用禁止发布的显式命令，拟为 `npm.cmd run build` 后 `node node_modules/electron-builder/cli.js --win nsis --x64 --publish never`；既有 `npm.cmd run test:package-smoke` 仍只证明其已有场景。新增跨版本安装测试命令尚不存在，在实施合同中明确，不能写成已经通过。

证据记录源 revision、task_delivery_revision、dev_integration_revision、stage_final_integration_revision、旧/新安装包版本与 hash、更新元数据 hash、Windows 环境、unsigned 状态与访问控制结果、测试源和实际命令。CI 分开记录 PR head 与 test-merge；失败/skip/限制保留，后续通过使用 supersedes。不记录正文、密钥、数据库或完整日志；合成测试数据与用户数据严格隔离。

### 6.3 人工验收与阶段门

2026-10-06 owner 明确批准缩减本次真实验收范围：剩余真实故障矩阵及未覆盖退出保护/完整数据配置导出的实装复核记为 waived-by-owner，未执行且接受风险，不再阻塞本次 S8 收尾。下文原完整验证门作为原设计保留，本次执行以 [T809 最新豁免范围](../implementation/T809_S8_FINAL_ACCEPTANCE.md#2026-10-06-owner-明确豁免剩余真实验收)为准。豁免不等于测试通过，不改功能、自动化断言或来源/完整性/数据保护边界；正式发布和各 owner 集成门仍独立。

进入：正式设计、依赖版本、更新源、无签名信任边界、实施合同与测试隔离方式已批准；最新授权 dev 与兼容来源包已固定。

owner 在隔离 Windows 环境：安装来源版本并建立示例记录 → 手动原位升级 → 检查记录/设置 → 应用内发现下一版 → 断网观察继续使用 → 重试下载 → 保留未保存输入尝试安装并确认阻断 → 保存后确认重启 → 检查新版、历史、导出和再次写入 → 按应用外说明演练失败后的人工修复。

通过：A～D 已按合同集成；同一最终 dev revision 的 aggregate、打包、实际升级、失败路径与人工验收均有结果；私有分发访问控制、完整性与来源验证完成，未签名限制如实记录；所有缺口有明确处置。T072 结果只作输入，不替代新阶段测试。

退出门：阶段验收不自动执行 Ready、merge、main、tag、release 或下一阶段。开发/测试发布源与正式源分离；每次发布的批准通过 §3.5 的 owner 手动触发或精确版本授权记录，不再对已批准流程重复设门。

## 7. Risks, stop conditions, and authorization

### 7.1 已批准决定与执行边界

| 决定          | 已批准内容                                       | 执行边界                                                     |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| 首期范围      | 已同意 U-01～05，同 schema 更新                  | 不包括备份/恢复扩展                                          |
| 更新源        | 私有 GitHub Releases＋本机只读凭据               | 仓库地址、凭据部署时配置；不公开分发                         |
| 发布者身份    | 首期不设置签名/发布者身份                        | 保留私有访问控制、HTTPS 与 hash；不声称来源身份已获签名证明  |
| 依赖          | 已同意 electron-updater@6.8.10                   | T082 合同已锁定；实际兼容性待验证，不顺带升级其他工具链      |
| 阶段/任务身份 | 已授权自主决定：S8 / T081～T084                  | T081～T084 已按独立批准合同集成；T809 承接最终验收           |
| 发布权限      | Actions 自动构建验证，owner 手动触发指定产物发布 | 流程已批准；每次发布由手动触发形成具体授权，Agent 不自行发布 |

### 7.2 数据保护扩展提案（本阶段不实施）

- **变更标题**：数据库迁移前一致性快照与人工恢复流程。
- **原因/证据**：未来 schema 更新的技术风险；目前未报告真实丢失，不包装成已发生故障。
- **受影响依据**：FR-D01～D05/D07、AC-07、D-111、ED-018、Data Design §7/8；现行 §7 明确自动备份不进入 v0.1。
- **建议变化**：在后续版本批准迁移前快照；明确保留期限、磁盘不足处理、删除数据在旧快照中的残留告知、清理方式、版本标识和恢复演练。备份失败必须停止迁移。
- **范围变化**：扩大维护能力；不得静默纳入冻结 v0.1。自动导入/一键恢复继续延期，除非另行批准并同步需求。
- **技术边界**：SQLite WAL 活跃时不能只复制主数据库；评估一致性备份 API（[SQLite 官方文档](https://www.sqlite.org/backup.html)）。快照含用户核心数据，必须本地隔离，不进入代码、CI artifacts 或导出凭据；密钥配置不混入数据库快照。
- **恢复边界**：不承诺通用逆迁移；在启动迁移前建立快照，失败保留原始与失败副本，停止写入，不建空库；明确逐步事务迁移失败可能已完成早期步骤。恢复先保留当前数据，明确会丢失哪些快照后记录，由用户确认后按受控流程执行。
- **替代方案**：首期仅发布不改变 schema 的版本，保留完整导出和人工支持路径；导出不等于已具备恢复。
- **待确认**：新阶段范围、数据保留策略、人工恢复还是一键恢复、具体迁移及破坏性权限。

### 7.3 停止条件

需求或数据语义冲突；需迁移/改变凭据路径/新增 Provider 权限；批准的无签名策略无法运行或更新源访问控制未解决；不能证明旧安装身份与数据目录稳定；安装测试无法隔离真实环境；需要未批准依赖或外部写入；最终集成 revision 无可靠验证。发生时停止受影响节点，保留事实并按仓库升级提案流程处理。

### 7.4 原设计草案检查记录（历史）

- 只读核对本地 Git、T072 合同/索引/证据、规范文件、安装配置、依赖、Main 退出流程、SQLite 路径/迁移及会话状态。
- 本次新增文件仅本文；未修改冻结需求、历史证据或实现；未创建任务、分支、提交、PR 或发布。
- 本次不运行产品测试/安装验证，不宣称更新已实现或升级成功。首期范围、私有分发、无签名、依赖方向、编号及人工触发发布约定已获批准；实现合同、后续人工验收和真实部署结果分别记录。
- Markdown 在仓库 `.prettierignore` 中默认忽略，因此文档格式需显式检查；检查结果由本轮交接报告记录，不将计划当作通过证据。

### 7.5 原设计批准同步记录（历史）

- owner 在私有分发影响说明后明确同意，要求更新合同约定并清除已批准部分的旧等待措辞。
- 已同步 §1、§3.1、§3.4、§3.5、§6.3、§7.1/7.4；私有源、凭据方式及发布机制均明确记录为已批准。
- 本机环境注入是已批准只读凭据方式的最小实现选择；不扩展 AI 权限或凭据持久化范围。格式/链接/空白检查在本轮交接记录，未执行产品测试或发布。
- §7.2 的迁移备份/自动恢复属于首期之外的独立扩展，保留其真实授权边界；未将本次同意解释为批准该扩展或后续合并。

### 2026-10-06 实施与验收快照

产品基线 `080c308ff511705bfd8ab21386a03d58ec311dcd`；四项开发已集成。T809 的定向与完整 verify、禁止发布打包通过；owner 报告真实跨版本更新及正式凭据部署/重启检查完成。独立 review、d57e653 head CI 与云端隔离安装 smoke 已通过；剩余真实故障和实装复核已由 owner 明确豁免，未执行且接受风险。当前最终文档收口获授权，最后推送 head CI、交付和集成待单独核验。原历史描述按其日期理解，不记全部测试通过，不自动标阶段通过或发布。见 [EV-S8-001](../implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)。

# S8 历史阶段执行记录

> 来源：`beb8b97b2c9ecdef4ab0677853eef195c2367544` 中的 [S8_UPDATE_MAINTENANCE_DESIGN.md](../../../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md)。本文保留当时的执行、授权和交付上下文，不是当前状态或普通工作的指令；旧批准不恢复执行权限。技术正文继续在原设计文件维护。

## 原页首状态与授权


> 2026-10-11 事实校准：S8 已按 owner 明确豁免完成 T809 交付/集成，并由 PR #62 晋升 main；剩余真实矩阵未执行且接受风险。PR #64 的 tag 发布改造仅进入 dev，尚未进入 main；v0.1.4 为演练，正式发布未执行。当前证据见 [EV-DOC-CALIBRATION-001](../../ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)；下文准备/执行快照均按原日期理解。



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

依据文件：[PRD](../../../PRODUCT_REQUIREMENTS_V0.1.md)、[Decisions](../../../DECISIONS.md)、[变更规则](../../../REQUIREMENTS_CHANGE_POLICY.md)、[架构](../../../architecture/ARCHITECTURE_V0.1.md)、[数据设计](../../../architecture/DATA_DESIGN_V0.1.md)、[工程决策](../../../architecture/ENGINEERING_DECISIONS_V0.1.md)、[实施计划](../../../architecture/IMPLEMENTATION_PLAN_V0.1.md)、[测试策略](../../../architecture/TEST_STRATEGY_V0.1.md)、[GitHub 工作流](../../GITHUB_WORKFLOW_V0.1.md)。

### 2.1 已核实事实与限制

- 本地 `dev` HEAD 为上述 revision，提交说明为 T072 Demo 收敛（PR #56）；检查开始时工作区干净。[任务索引](../../TASK_INDEX_V0.1.md) 将 T072 标为 done。
- [T072 归档](../S7_T071_T072_ARCHIVE.md#t072)及 [EV-T072-001](../../ACCEPTANCE_EVIDENCE_V0.1.md)记录候选自动化与 owner 人工结果。证据仍保留 `dev_integration_revision=null` 的历史交接描述，与当前本地集成事实存在文档漂移；本次只报告，不修改旧账本。
- 未重新查询远端、重跑 T072、确认 G4 或正式 release；本地集成 revision 不是新阶段的验收结果。实施前重新核对最新授权 `dev` 与必要的 T072 最终证据。
- 固定的先前 `dev@d8b211b...` 基线：`electron-builder.yml` 为 NSIS x64、每用户安装、`appId=io.mytracer.desktop`；`package.json` 应用版本 `0.1.0`、electron-builder 26.15.3、Electron 43.3.0，未声明 electron-updater。T081 候选仅将根应用版本升为 `0.1.1`，不改变上述依赖和安装身份。
- 数据库路径由 Main 的 `app.getPath('userData')` 决定，位于 `data/mytracer.sqlite3`；当前 schemaVersion=3，WAL 模式，每步迁移事务化，拒绝高于已知版本的数据库。
- AI 配置由独立配置适配器保存；退出时 Main 清理会话并关闭 SQLite。Renderer 有会话内状态，不能视为跨重启持久草稿。
- 单版本打包 smoke 不能代替两份不同版本安装包之间的升级证据；T081 已用真实 `0.1.0`→`0.1.1` NSIS 包单独验证，范围与限制见 `EV-T081-001`。

基线或工具链变化后须重新评估本文；不自动将新提交视为同等已验证输入。

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

### 6.2 命令与证据

现有受影响验证命令：`npm.cmd run test:unit`、`npm.cmd run test:integration`、`npm.cmd run test:e2e`、`npm.cmd run verify`、`npm.cmd run governance:metadata:check`。后续明确合同中的定向文件和证据 wrapper 参数。

打包采用禁止发布的显式命令，拟为 `npm.cmd run build` 后 `node node_modules/electron-builder/cli.js --win nsis --x64 --publish never`；既有 `npm.cmd run test:package-smoke` 仍只证明其已有场景。新增跨版本安装测试命令尚不存在，在实施合同中明确，不能写成已经通过。

证据记录源 revision、task_delivery_revision、dev_integration_revision、stage_final_integration_revision、旧/新安装包版本与 hash、更新元数据 hash、Windows 环境、unsigned 状态与访问控制结果、测试源和实际命令。CI 分开记录 PR head 与 test-merge；失败/skip/限制保留，后续通过使用 supersedes。不记录正文、密钥、数据库或完整日志；合成测试数据与用户数据严格隔离。

### 6.3 人工验收与阶段门

2026-10-06 owner 明确批准缩减本次真实验收范围：剩余真实故障矩阵及未覆盖退出保护/完整数据配置导出的实装复核记为 waived-by-owner，未执行且接受风险，不再阻塞本次 S8 收尾。下文原完整验证门作为原设计保留，本次执行以 [EV-S8-001 豁免记录](../../ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)为准。豁免不等于测试通过，不改功能、自动化断言或来源/完整性/数据保护边界；正式发布和各 owner 集成门仍独立。

进入：正式设计、依赖版本、更新源、无签名信任边界、实施合同与测试隔离方式已批准；最新授权 dev 与兼容来源包已固定。

owner 在隔离 Windows 环境：安装来源版本并建立示例记录 → 手动原位升级 → 检查记录/设置 → 应用内发现下一版 → 断网观察继续使用 → 重试下载 → 保留未保存输入尝试安装并确认阻断 → 保存后确认重启 → 检查新版、历史、导出和再次写入 → 按应用外说明演练失败后的人工修复。

通过：A～D 已按合同集成；同一最终 dev revision 的 aggregate、打包、实际升级、失败路径与人工验收均有结果；私有分发访问控制、完整性与来源验证完成，未签名限制如实记录；所有缺口有明确处置。T072 结果只作输入，不替代新阶段测试。

退出门：阶段验收不自动执行 Ready、merge、main、tag、release 或下一阶段。开发/测试发布源与正式源分离；每次发布的批准通过 §3.5 的 owner 手动触发或精确版本授权记录，不再对已批准流程重复设门。

### 7.1 已批准决定与执行边界

| 决定          | 已批准内容                                       | 执行边界                                                     |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| 首期范围      | 已同意 U-01～05，同 schema 更新                  | 不包括备份/恢复扩展                                          |
| 更新源        | 私有 GitHub Releases＋本机只读凭据               | 仓库地址、凭据部署时配置；不公开分发                         |
| 发布者身份    | 首期不设置签名/发布者身份                        | 保留私有访问控制、HTTPS 与 hash；不声称来源身份已获签名证明  |
| 依赖          | 已同意 electron-updater@6.8.10                   | T082 合同已锁定；实际兼容性待验证，不顺带升级其他工具链      |
| 阶段/任务身份 | 已授权自主决定：S8 / T081～T084                  | T081～T084 已按独立批准合同集成；T809 承接最终验收           |
| 发布权限      | Actions 自动构建验证，owner 手动触发指定产物发布 | 流程已批准；每次发布由手动触发形成具体授权，Agent 不自行发布 |

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

产品基线 `080c308ff511705bfd8ab21386a03d58ec311dcd`；四项开发已集成。T809 的定向与完整 verify、禁止发布打包通过；owner 报告真实跨版本更新及正式凭据部署/重启检查完成。独立 review、d57e653 head CI 与云端隔离安装 smoke 已通过；剩余真实故障和实装复核已由 owner 明确豁免，未执行且接受风险。当前最终文档收口获授权，最后推送 head CI、交付和集成待单独核验。原历史描述按其日期理解，不记全部测试通过，不自动标阶段通过或发布。见 [EV-S8-001](../../ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)。

## 补充执行与批准上下文

### 原文片段 1

作为后续实施合同输入

### 原文片段 2

合同阶段依据现有 contracts 布局精化

### 原文片段 3

具体版本由实施合同核查兼容性后锁定并列明传递依赖，不顺带升级 Electron/builder；本轮不安装

### 原文片段 4

- 自动化安装/卸载不得触及真实用户的相同 appId 注册项：默认使用一次性 Windows VM/独立测试账户和隔离数据根；仅改 `--user-data-dir` 不足以隔离安装注册状态。Owner 已分别批准 T081 与 T082 在当前 Windows 账户执行，T082 的例外仅限其合同要求的现存安装/进程/注册项预检和唯一临时根，不授权读取或清理默认数据；无法隔离既有安装时停止受影响验证。不同测试 appId 的结果不能独自证明正式身份升级兼容。

### 原文片段 5

T083 的任务级验收按 2026-10-02 owner 决定拆分为真实 `0.1.2→0.1.3` 手动 NSIS 数据连续性和 `0.1.3` 应用内协调分层测试；保留 `0.1.3`，取消额外双包测试。原 T082 `0.1.2` 缺少确认安装入口，因此本次不声称完整应用内跨版本升级通过。真实应用成功交接安装器、新版启动及旧数据核对的连续流程留待后续版本/任务，仍须在 S8 最终门禁完成；不自动激活 T084。证据与限制作具体区分，见 [T083 归档](../S8_T081_T084_T809_ARCHIVE.md#t083)（原合同 §9.5 可从归档索引恢复） 和 [EV-T083-001](../../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t083-001)。

### 原文片段 6

#### 3.5 已批准的私有访问与 GitHub Actions 发布约定

私有分发采用已批准的本机只读凭据，限定分发仓库、可撤销且有有效期；发布用写权限凭据仅留在 CI。首期实现选择为 Main 读取专用本机环境变量 `MYTRACER_UPDATE_TOKEN`，不新增应用内凭据持久化或配置页面，不复用 AI key 或发布 token。不能将 token 编进安装包、SQLite、导出、日志或 Renderer；测试启动环境显式移除真实变量，仅注入合成值。未配置/过期时更新显示不可用，核心功能仍运行；鉴权失败与“无更新”严格区分。T082 文档说明首次配置、轮换、撤销和重启生效步骤。固定私有仓库已配置，专用凭据由 owner 本机管理；owner 报告真实检查/下载/更新通过，凭据值不写入文档。

2026-10-06 owner 批准轻量维护改造为“main 自动准备、owner tag 批准、Actions 自动发布”，取代原五参数 workflow_dispatch 与逐版本审批 JSON 门禁：

1. Verification 继续只读验证；Update candidate 在 main push 准备不可变候选、hash 和测试摘要，PR 候选仅供审阅。main 候选并发按源 SHA 分组，后续 main 提交不取消先前源的构建。
2. Owner 审阅合格候选后，在对应 main 源提交上创建并推送严格稳定版本 tag，即批准该源及其通过校验的候选产物进入正式更新源。源可在 main 历史中，不必是最新 HEAD；tag/package/lock/manifest 版本须一致。Agent 不自行 tag，代 owner 操作须有具体版本授权。
3. 只读 validate job 认证 owner login/numeric ID 与 push 新建事件、检查 main ancestry，并自动解析候选 run/attempt/artifact 和 hashes。选择固定 workflow、精确源、main 的最新成功 run 及唯一候选；失效或歧义停止。支持 annotated/lightweight tag，不依赖可伪造的 tagger 文本。
4. Publish job 只重验 validate 固定的 selection，校验实际 tag object/source、不可变 archive/manifest/资产、成功命令证据、兼容边界及版本递增。已有 tag 必须正确；已有 Release 包括 draft 拒绝覆盖。仅 publish 获同库写权限，先 draft、上传和回读校验，最后再次检查 tag/main 来源才发布 stable/latest。部分失败保留现场，不自动清理或覆盖，不创建 tag、推进分支或回写账本。
5. 过早 tag 可在合格候选就绪后由 owner 重跑。过期候选可在候选手动入口选择原 main 源 tag 重建；先只读验证其 main ancestry，manifest 保留实际 ref。发布始终拒绝 PR/dev 来源。真实 feed 变化只发生在 owner tag 授权后的正式发布；首次部署须包含新 workflow，并单独核验真实链路。

具体操作和故障处置见[私有发布维护](../../../maintenance/RELEASE.md)。不引入 Environment 审批、套餐变更、凭据持久化或新的依赖。本次记录 owner 批准的发布机制变化，保留历史阶段证据，实际上线以 main 集成为准。



### 原文片段 7

发生时停止受影响节点，保留事实并按仓库升级提案流程处理

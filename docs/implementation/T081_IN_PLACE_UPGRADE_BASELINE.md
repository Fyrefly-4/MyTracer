# T081 — Windows 原位升级与数据保留基线

> 合同状态：approved-3，2026-09-29。项目所有者已批准本合同范围、激活 T081，并授权本地任务分支、提交、普通 push、目标为 `dev` 的 Draft PR 与 Ready 操作；明确不创建 worktree。后续另行批准了 S8 Development Skill 窄范围同步和 [T081 扩围提案](T081_ESCALATION_PROPOSAL.md)中的版本文件、hash 记录时点调整。Owner 又明确批准本次在当前 Windows 账户执行 NSIS 测试，确认该账户已有的 MyTracer 默认数据可丢弃，并免除本次独立 Codex review；具体安全边界见 §4.3。
>
> 项目所有者于 2026-09-29 另行授权 T081 文档收口，并明确由其自行完成人工验收和文档提交后的最终 CI 检查；Agent 不代签或把未复核结果记为已通过。本合同只覆盖 [S8 设计](../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md) §4 的 A 节点。T082～T084 不由本合同启动。采用 V2 显式权限流程；不声明 Automation Profile。

## 1. 任务信息

- **Task ID / Title**：T081 / Windows 原位升级与数据保留基线。
- **Slice / Plan item**：S8-A；[Implementation Plan](../architecture/IMPLEMENTATION_PLAN_V0.1.md) §13 将后续维护任务导向 S8 设计 §3.1、§3.2、§4、§5～7，不改变 S0～S7 历史范围。
- **Status**：`review`；任务执行状态以 [TASK_INDEX_V0.1.md](TASK_INDEX_V0.1.md) 为准。实现候选与本地实装验证已完成；最终文档 head 的 CI、owner 人工验收和集成仍待 owner 核对。
- **编写基线**：`dev@d8b211b3c184cff8d0afdb09ff4b13164704290b`；激活时已核对本地 `dev`、`origin/dev` 与远端 `dev` 为该 revision。S8 设计原为未跟踪文件，本次与合同一起纳入提交。
- **目标分支**：`task/T081-in-place-upgrade`，已从核实的 `dev@d8b211b3c184cff8d0afdb09ff4b13164704290b` 创建；本任务不创建 worktree。
- **任务类型**：`implementation`，只建立原位升级兼容与跨版本验证基线。

## 2. 目标结果

在 §4.3 获授权的 Windows 账户中，用两个真实、可追溯且版本不同的 Windows x64 NSIS 安装包，对同一应用身份执行旧版到新版的原位覆盖升级。旧版创建的核心事实、关联、显式 LocalDate、导出能力和同一 Windows 用户的合成配置，在新版重开后仍可用；新版还能继续写入并再次重开。安装过程中遇到应用仍运行的情形须有实际结果，不能假设安装器会安全处理。

T081 交付可重复的打包与安装验证步骤及 revision/版本/hash 证据。它不提供应用内检查、下载、安装确认或私有更新源；这些分别属于 T082～T084。

## 3. 依据

- **新阶段验收项**：S8 U-01；U-05 中与本任务产物追踪直接相关的部分。U 编号是经 owner 批准的阶段验收项，不是冻结 PRD 的新 FR。
- **FR / AC**：FR-D01～D05；AC-07 的持久性、导出与 AI 不可用时核心操作部分。
- **D**：D-008～010、D-014、D-106、D-109、D-111 按原义保持；不得借升级改变记录状态、日期或 AI 确认边界。
- **ED / GW**：ED-014、ED-018、ED-019；GW-001～010 中适用的任务分支、验证、证据、评审与发布门禁。
- **直接设计**：[S8 设计](../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md) §2、§3.1～3.2、§4 A、§5～7；[数据设计](../architecture/DATA_DESIGN_V0.1.md) §7～8；[测试策略](../architecture/TEST_STRATEGY_V0.1.md) §7～9。

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
      sections: ['2', '3.1', '3.2', '4', '5', '6', '7']
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
```

## 4. 开始条件与依赖

- [x] 项目所有者批准本合同范围与明确权限，并激活 T081；任务索引登记相同状态，S8 计划引用与仓库规则一致。实际安装测试结果见 §10.5 与 `EV-T081-001`。
- [x] S8 设计与合同纳入本任务提交候选；远端与本地 `dev` 已核对为编写基线。
- [x] 开始产品实现前已复核 T072 最终证据、当前工作区和其他 worktree，并确认无重叠用户修改。
- [x] Owner 已单独批准仅把 Development Skill 的适用说明扩展至 S8；`.agents/skills/mytracer-stage-development/SKILL.md` 已作窄范围同步，不激活 T082～T084 或扩大其他权限。
- [x] A 的 source 固定为 `dev@d8b211b3c184cff8d0afdb09ff4b13164704290b`，真实应用版本 `0.1.0`；B 在本任务分支将应用版本升至 `0.1.1`，具体 source revision 由实现候选提交固定。A/B 的安装包 SHA-256 必须在各自真实构建后记录，不能提前填造。已核对六个现有版本标签中的应用版本均为 `0.1.0`；标签名不代替包内版本。
- [x] 本次执行账户及其安装注册状态、数据根、清理边界已经按 §4.3 预检。默认隔离身份要求由 owner 对当前账户的明确一次性授权替代；不将该例外推广至其他任务或账户。
- [x] A/B 两包在保持现有依赖、schemaVersion=3、导出契约和安装身份的条件下构建；source、hash 与实际验证见 §10.5。
- [x] 任务索引与 sidecar 建立后运行 `npm.cmd run governance:metadata:check`，通过（21 sidecar、1 profile）。结构通过不等于行为验收。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: []
    blocks: [T082]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T082, T084]
  revisions:
    required_dev_base: dev@d8b211b3c184cff8d0afdb09ff4b13164704290b
  shared_surfaces:
    - electron-builder.yml and package scripts
    - Windows NSIS installation tests and isolated test helpers
    - upgrade and release provenance evidence
  external:
    - isolated Windows VM or independent test account
    - pinned compatible source installer
```

上述是 S8 §4 的串行任务图；B、D 分别对应 T082、T084。编写基线是准备时事实，不是永久固定的授权 `dev`：实现及集成时核对最新授权 `dev`。本次当前账户例外只适用于 T081。

### 4.2 Metadata / Profile

T081 的 `docs/implementation/metadata/T081.json` 与 §4.1 同步；T082～T084 在索引登记为 `pending`，仅供已批准的串行任务图引用，不构成其合同或激活。无 `execution` 声明；如将来采用 Automation Profile，须由 owner 对确切版本和时限另行批准。

### 4.3 本次当前账户执行例外

项目所有者在合同 approved-2 后明确批准在当前 Windows 账户运行 T081 NSIS 安装测试，并确认该账户已有 MyTracer 默认数据可丢弃；此决定只改变本次执行身份，不授权读取、删除或使用这些真实默认数据作为测试 fixture。预检只核对存在性：默认 Roaming 数据目录存在 SQLite 数据库与 AI 配置；当前没有 MyTracer 卸载注册项、默认安装目录或运行进程。测试的安装目录、`userData`、合成配置、导出与清理必须全部位于唯一临时根。运行时核对当前 SID 与显式环境变量；若安装/进程预检状态改变，停止并重新核对。

同一授权还免除本次独立 Codex review；完整 diff、自动化验证与实际安装证据仍须如实完成。§4.3 对本合同其余段落中“仅隔离账户”“必须在 VM/独立账户”及“独立 review 必需”的旧表述构成本次明确例外，其余门禁不变。当前账户例外不构成后续 T082～T084 或其他任务的安装权限。

## 5. 允许修改范围

| 范围               | 允许变化                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NSIS 构建配置      | `electron-builder.yml`：只为稳定 Windows x64、每用户原位升级身份和明确禁止测试发布所需的配置修正；`appId=io.mytracer.desktop`、数据目录规则及现有安装模式不变                 |
| 打包与隔离测试辅助 | 与 T081 直接相关的 `tools/` 打包/产物清单辅助，以及 `tests/support/` 一次性 Windows 安装环境、路径验证和清理辅助；只使用合成数据，不触碰真实配置                              |
| Windows E2E        | `tests/e2e/windows-package-smoke.e2e.test.ts` 的必要窄调整，以及新增跨版本安装 E2E；证明真实 A→B 安装、重开、导出、事实守恒、再次写入和运行中安装行为，不以 unpacked 测试代替 |
| 升级说明           | 与本任务有关的安装/升级、隔离运行、版本与 hash、失败后的应用外手动修复说明；不写私有更新源或发布流程的实现说明                                                                |
| 任务证据           | 本合同、T081 metadata、任务索引 T081 行及真实结果在 `ACCEPTANCE_EVIDENCE_V0.1.md` 的条目；最终 docs closeout 仍遵守 owner gate                                                |
| Skill 适用同步    | 经 owner 单独批准，仅修改 `.agents/skills/mytracer-stage-development/SKILL.md` 的 S8 适用说明；不改变流程门禁或其他任务权限                                               |
| 应用版本           | 经 owner 批准，仅将 `package.json` 与 `package-lock.json` 的根应用版本从 `0.1.0` 同步升至 `0.1.1`；不新增、升级或重锁任何依赖                                                  |
| 忽略的产物         | `out/`、`release/`、`.tmp/evidence/` 与一次性测试根；不提交安装包、数据库、配置内容、令牌或完整日志                                                                           |

除上述 version-only 变更外，`package.json`/lock 的脚本、依赖和其他字段不在本任务范围。若还需修改依赖或额外生产模块才能达成目标，先提出精确扩围；不得暗中加入。

## 6. 明确非范围

- T082 的 `electron-updater`、私有 GitHub Releases 鉴权、检查与下载；T083 的应用内确认安装、退出协调及草稿处理；T084 的 Actions 发布与完整阶段验收。
- schema、migration、数据导入/恢复、自动备份、导出格式或 AI Provider/权限改变；不改变 SQLite 或 Electron 的生产路径以迎合测试。
- 自动检查、后台通知、强制更新、静默安装、降级、预发布通道、多平台、代码签名或正式源发布。
- 真实凭据、真实用户数据库、真实安装注册状态和真实使用资料；不复用 AI key。
- 未满足审查门禁时的 Ready、合并 `dev`/`main`、tag、Release、外部发布、强推或远端删分支。

## 7. 必须保持的不变量

1. 旧版和新版的 `appId`、每用户安装身份、实际 `userData` 解析规则稳定；安装路径变更若发生必须单独验证。不得因数据库打不开而创建替代空库。
2. schemaVersion 保持 3；Goal、Action、Routine、Review、Record、关联、生命周期与显式 LocalDate 在升级前后逐字段保持。`unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 不能合并，历史不移动。
3. 完整导出保持既有结构与范围，排除凭据、AI 草稿和日志；比较时只忽略契约允许变化的导出时间、应用版本等技术字段。
4. 同一 Windows 用户的合成 AI 配置升级后仍能解密并使用；验证只记录可用性，不输出明文、密文、路径或环境内容。AI 不可用时核心记录、查看、管理、导出仍可用。
5. 构建/测试明确 `--publish never`；版本和产物 hash 与 source revision 一一绑定，不复用同名包、不拿旧产物证明新 HEAD。
6. 安装/卸载自动化默认只在隔离 Windows 身份执行；本次可在 §4.3 特批的当前账户执行。仅更换 `--user-data-dir` 不是安装注册隔离，故必须预检无既存安装并记录本次例外风险。测试清理前核对绝对路径和归属，不删除不属于测试根的文件或已有默认数据。

**局部风险**：安装器覆盖真实应用身份、两个包实际同版或不同 `appId`、旧/新产物混用、WAL 中未提交状态造成错误比对、合成配置随安装丢失、运行中安装被误判安全。每项均须以测试环境和产物清单控制，并保留失败事实。

## 8. 交付物

- 两个不同版本 NSIS 安装包的 source revision、版本、`appId`、SHA-256 与构建环境清单；仅记录元数据，不提交二进制。
- 可重复的跨版本原位安装程序及测试辅助，覆盖成功、应用仍运行、重开、完整事实/导出/合成配置守恒和新版继续写入。
- 明确的同 schema 兼容来源矩阵及失败/中断后应用外手动修复说明，注明首期无自动备份或通用恢复能力。
- 当前候选的定向验证、受影响回归、完整 `verify`、Windows 实装证据、完整 diff 和独立 review；CI、人工体验与最终集成结果分开记录。

## 9. 可判定验收条件

1. A、B 为可追溯且版本严格递增的真实 NSIS 安装包；`appId`、数据目录、安装模式与 schemaVersion=3 一致。测试构建没有发布到任何源。
2. 在同一获授权 Windows 用户及同一实际测试数据根中，A 通过 UI/正常命令创建或修改全部本任务适用核心状态及合成配置；退出和重开 A 后数据仍存在。不能仅用空库或 API seed 代替关键用户流程。
3. 不卸载 A 而安装 B，启动 B 后按业务字段与必要关联比较全部旧事实，显式 LocalDate、状态和历史无改变；同机合成配置可用。导出结构与事实一致，新增记录后再次重开仍存在。
4. 应用运行时尝试安装 B 的行为有实际观察：若安装器阻止，明确提示并保留 A 可用；若允许，须证明没有并发写库、残留进程或损坏。不能由进程退出码单独推断数据安全。超出本任务允许模块才能修复时停止并升级。
5. 故障或中断演练后，不把新空库误报成功；提供并演练应用外手动同版本修复或更高兼容版本安装路径，记录程序能否重开及原始数据是否仍在。不承诺安装原子性。
6. 定向、受影响范围和完整 `verify` 通过；获授权 Windows 身份的安装结果及版本/hash 证据绑定同一候选，完整 diff 没有未处理 material finding。Owner 已免除本次独立 Codex review，不将其写成已执行。任何 skipped、failed 或平台不可用项保留原状，不算通过。
7. **MANUAL**：项目所有者在获授权 Windows 环境核对覆盖升级、历史/配置、导出、失败后修复的可理解性与实际未签名安装提示；结果保持 pending 直到 owner 实测并记录。

## 10. 验证计划

### 10.1 合同准备检查

合同准备提交仅验证结构、引用和 diff，不记录 T081 行为通过。Markdown 被 `.prettierignore` 忽略，须对本文件显式运行 Prettier 检查。

### 10.2 实施后的定向与回归

在已授权的任务环境中，按实际改变的文件运行已有入口；跨版本测试使用 VM/独立测试账户，或 §4.3 本次获批的当前账户，以明确 A/B 绝对产物路径、版本和 hash 运行。实际结果只以 `EV-T081-001` 中的 revision、命令和证据为准。

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:package-smoke
npm.cmd run test:e2e:run -- tests/e2e/windows-in-place-upgrade.e2e.test.ts
npm.cmd run verify
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

上述 package smoke 也会运行 NSIS 安装/卸载，因此只可在获批准的 Windows 身份执行。跨版本测试还须设置合同批准的身份、A/B 安装包路径及 SHA-256 环境变量，详见 [T081 升级验证步骤](T081_UPGRADE_TEST_PROCEDURE.md)；未设置时该测试会跳过，不构成通过。`verify` 在普通环境中也会跳过 package-only 程序，不能替代真实安装证据。构建 A/B 时各在独立、可追溯 source revision 及其隔离输出根执行相同的禁止发布命令；不覆盖另一候选产物。`verify` 包含 format、lint、typecheck、build、unit、integration 和常规 Electron E2E；受影响的 AC-07/导出与配置回归已由跨版本实装测试和 `verify` 覆盖，见 `EV-T081-001`。

### 10.3 确定性证据与人工步骤

对关键命令使用 `node tools/evidence/capture-command.mjs --task T081 --gate <gate> --base-revision <实际 SHA> --output .tmp/evidence -- <明确 argv>`；Windows `.cmd` 由 wrapper 用显式 `ComSpec` argv 启动。JSON 只保留允许的元数据，不写 stdout/stderr、绝对用户路径、正文、数据库、凭据或完整日志。记录旧/新版 source 与 hash、实际执行环境、命令、结果、限制，以及 PR head/test-merge 的不同 revision。

人工验收按 §9.7 由 owner 在获授权的 Windows 身份执行；不将 Agent 自动化代签为 owner 结果。安装失败、权限提示和手动修复均记录实际观察。

### 10.4 验证环境

- OS：通常为 Windows x64 一次性 VM 或独立测试账户；本次 §4.3 明确授权当前账户，并按预检约束使用唯一临时安装和数据根。
- Node/npm/Electron/builder：以当前锁定版本和实际执行环境记录；编写时 `package.json` 为 Node 24.18.0、npm 11.16.0、Electron 43.3.0、electron-builder 26.15.3。
- 数据：唯一临时测试根、合成业务数据、合成 AI 配置、fake Provider；不使用 live Provider。
- source / packages：A/B 精确 SHA、版本、hash 与签名状态见 §10.5 和 `EV-T081-001`。

### 10.5 实施候选与 owner 交接（2026-09-29）

- A：`dev@d8b211b3c184cff8d0afdb09ff4b13164704290b`，应用 `0.1.0`，NSIS SHA-256 `AD68642DEB44F31D9194544D55DED558B52BD4442C920837539124DD466D48E4`。B：生产构建 source `be44e337ba33bdbb44e9a30cb5dcd110d6ee6fa6`，应用 `0.1.1`，NSIS SHA-256 `F0DB2793A2DA6833D505C1107DBE1EC60150E3722E25C051A9DBE6817F750051`。两包均为 Windows x64、`appId=io.mytracer.desktop`、每用户 NSIS、unsigned，构建时指定 `--publish never`；未改依赖、schemaVersion=3 或导出契约。
- 实现候选 `2f98854b9386812000a118353dee2861a3d68f65`：在 owner 批准的当前 Windows 账户使用唯一临时安装、数据和导出根，真实 A→B、A 运行时安装、损坏包启动失败后用已核 hash 的 B 修复三场景 **3/3 pass**；B package smoke **1/1 pass**；完整 `verify` 通过（255 unit、130 integration、30 常规 E2E；1 live-only integration 与 4 opt-in package E2E 按默认策略 skip，后四项已单独运行）。测试结束后 MyTracer 卸载注册、进程和默认安装目录均为零；未读取或清理现有默认数据。具体命令、失败历史与 artifacts 见 `EV-T081-001`。
- `dev` 基线核对为 `d8b211b3c184cff8d0afdb09ff4b13164704290b`，为候选祖先；Integration Freshness=`fresh`，`refresh_method=none`。PR #57 指向 `dev`，保持 Draft。owner 报告同一实现 head 的替代 hosted run `36521775546` 已通过；Agent 查询 GitHub API 连续 TLS 握手超时，尚未独立读取该 run 的 job 与 evidence artifact，因此只记录 owner-reported 状态。
- owner 明确接手人工验收和文档提交后的最终 CI 检查。两者均为 `pending owner verification`，不由本次文档收口推断为 pass；`task_delivery_revision`、`dev_integration_revision`、`stage_final_integration_revision` 仍为 `null`。不自动标 Ready、merge、tag、release 或启动 T082。

## 11. Git 与 GitHub 权限

项目所有者已批准下列任务 Git 权限；最初仅要求创建分支及提交合同/治理文件，之后另行启动实施。未明确为 `true` 的动作不得执行；Ready 须在实际审查与 CI 门禁满足后才能操作。

- [x] 创建本地任务分支；不创建 worktree。
- [x] 创建本地提交。
- [x] 推送任务分支。
- [x] 创建或更新目标为 `dev` 的 Draft PR。
- [x] 在审查门禁通过后将 Draft 标记为 Ready。
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
  dependency_change: false
  migration_change: false
  external_write: false
```

## 12. 依赖、数据与外部操作权限

- **依赖**：T081 无新增/升级依赖；仅根应用版本 `0.1.0`→`0.1.1` 获准。已批准的 `electron-updater` 属于 T082，不能提前安装。改变 Electron、builder、SQLite 或其他依赖版本须另行批准。
- **网络**：准备阶段可只读核对来源包与版本资料；实施中的受控下载或 GitHub Draft PR 只能在合同批准的精确权限内执行。测试不接正式更新源，不发布 Release。
- **AI**：仅 fake Provider 与合成配置；不读取真实 key，不作 live Provider 调用。
- **数据**：不进行 schema/migration 或破坏性真实数据操作。安装/卸载通常在隔离身份执行；本次 §4.3 例外使用获批当前账户，安装、测试数据与清理均限制于授权临时根。
- **外部写入**：任务分支普通 push 与同一任务 Draft PR 已批准并已用于 PR #57；非任务外部写入、Actions 发布、tag、Release 均未授权。

### 12.1 Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@d8b211b3c184cff8d0afdb09ff4b13164704290b
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

真正集成前核对最新授权 `dev`，记录 `original_base_revision`、`latest_authorized_dev_revision`、`verified_against_revision`、`status` 和 `refresh_method`。陈旧时用普通可追溯 merge 刷新，重跑受影响回归并在 review surface 改变时重审；不得 force-push。进入 `dev` 始终需要 owner 针对具体 PR 批准。

## 13. 风险与停止条件

出现需求或数据语义冲突、S8 设计与上位要求冲突、旧/新包身份或版本不可证、需要改变 schema/数据目录/凭据路径、隔离安装环境不可得、无签名安装被系统阻止且无批准路径、测试需要真实用户数据、需要未批准依赖或文件范围、证据不能绑定当前产物或最新集成 revision 时，停止受影响工作。保存安全结果和失败证据，按 `ESCALATION_PROPOSAL_TEMPLATE.md` 提出最小决策；不得用跳过安装测试或换 `appId` 冒充同身份升级。

## 14. 完成报告

报告实际改动文件、U-01/FR-D01～D05/AC-07/ED-018 的覆盖、A/B 版本与 source/hash、隔离环境、精确命令和结果、完整 diff/独立 review、CI 与 Integration Freshness、owner 人工状态，以及全部残余风险和未验证项。T081 完成不代表 T082～T084、S8 阶段门、main、tag 或 Release 完成。

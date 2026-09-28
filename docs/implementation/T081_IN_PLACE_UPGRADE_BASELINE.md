# T081 — Windows 原位升级与数据保留基线

> 合同状态：approved-1，2026-09-29。项目所有者已批准本合同范围、激活 T081，并授权本地任务分支、提交、普通 push、目标为 `dev` 的 Draft PR 与 Ready 操作；明确不创建 worktree。本次只完成激活与合同提交，不开始产品实现。
>
> 本合同只覆盖 [S8 设计](../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md) §4 的 A 节点。T082～T084 的编号与顺序已获批准，但不由本合同启动。采用 V2 显式权限流程；不声明 Automation Profile。

## 1. 任务信息

- **Task ID / Title**：T081 / Windows 原位升级与数据保留基线。
- **Slice / Plan item**：S8-A；[Implementation Plan](../architecture/IMPLEMENTATION_PLAN_V0.1.md) §13 将后续维护任务导向 S8 设计 §3.1、§3.2、§4、§5～7，不改变 S0～S7 历史范围。
- **Status**：`active`；任务执行状态以 [TASK_INDEX_V0.1.md](TASK_INDEX_V0.1.md) 为准。本次停在合同与治理提交点，产品实现仍未开始。
- **编写基线**：`dev@d8b211b3c184cff8d0afdb09ff4b13164704290b`；激活时已核对本地 `dev`、`origin/dev` 与远端 `dev` 为该 revision。S8 设计原为未跟踪文件，本次与合同一起纳入提交。
- **目标分支**：`task/T081-in-place-upgrade`，已从核实的 `dev@d8b211b3c184cff8d0afdb09ff4b13164704290b` 创建；本任务不创建 worktree。
- **任务类型**：`implementation`，只建立原位升级兼容与跨版本验证基线。

## 2. 目标结果

在一次性 Windows VM 或独立测试账户中，用两个真实、可追溯且版本不同的 Windows x64 NSIS 安装包，对同一应用身份执行旧版到新版的原位覆盖升级。旧版创建的核心事实、关联、显式 LocalDate、导出能力和同一 Windows 用户的合成配置，在新版重开后仍可用；新版还能继续写入并再次重开。安装过程中遇到应用仍运行的情形须有实际结果，不能假设安装器会安全处理。

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

- [x] 项目所有者批准本合同范围与明确权限，并激活 T081；任务索引登记相同状态，S8 计划引用与仓库规则一致。本次尚未执行安装测试。
- [x] S8 设计与合同纳入本任务提交候选；远端与本地 `dev` 已核对为编写基线。
- [ ] 开始产品实现前复核 T072 最终证据、当前工作区和其他 worktree，并确认无重叠用户修改。
- [ ] 开发 Skill 对 S8 的适用边界已同步确认；不能从其当前 S0～S7 描述推断 T081 自动获准。
- [ ] 选定来源安装包 A 与目标安装包 B 的真实版本、不可变 source revision、同一 `appId`/数据目录规则和 SHA-256；A 的版本低于 B，且来源版本列入本次兼容矩阵。可评估已有版本标签，不能仅凭标签名假定包内容兼容。不得用界面文字或临时改名模拟版本差异。
- [ ] 一次性 Windows VM 或独立测试账户及其安装注册状态、数据根、清理/恢复路径已就绪；不能在真实用户的相同 `appId` 安装身份上运行自动安装/卸载。
- [ ] 两包均能在保持现有依赖、schemaVersion=3、导出契约和安装身份的条件下构建；若需要改动这些边界，先停止并升级。
- [x] 任务索引与 sidecar 建立后直接运行相同的 Node metadata 校验器，通过（21 sidecar、1 profile）；当前终端找不到 `npm.cmd`，实施环境仍须运行仓库规定的 npm 入口。结构通过不等于行为验收。

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

上述是 S8 §4 的串行任务图；B、D 分别对应 T082、T084。编写基线是准备时事实，不是永久固定的授权 `dev`：开始实现前再次核对。任务已激活，但本轮仅提交治理文件，不运行安装器。

### 4.2 Metadata / Profile

T081 的 `docs/implementation/metadata/T081.json` 与 §4.1 同步；T082～T084 在索引登记为 `pending`，仅供已批准的串行任务图引用，不构成其合同或激活。无 `execution` 声明；如将来采用 Automation Profile，须由 owner 对确切版本和时限另行批准。

## 5. 允许修改范围

| 范围               | 允许变化                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NSIS 构建配置      | `electron-builder.yml`：只为稳定 Windows x64、每用户原位升级身份和明确禁止测试发布所需的配置修正；`appId=io.mytracer.desktop`、数据目录规则及现有安装模式不变                 |
| 打包与隔离测试辅助 | 与 T081 直接相关的 `tools/` 打包/产物清单辅助，以及 `tests/support/` 一次性 Windows 安装环境、路径验证和清理辅助；只使用合成数据，不触碰真实配置                              |
| Windows E2E        | `tests/e2e/windows-package-smoke.e2e.test.ts` 的必要窄调整，以及新增跨版本安装 E2E；证明真实 A→B 安装、重开、导出、事实守恒、再次写入和运行中安装行为，不以 unpacked 测试代替 |
| 升级说明           | 与本任务有关的安装/升级、隔离运行、版本与 hash、失败后的应用外手动修复说明；不写私有更新源或发布流程的实现说明                                                                |
| 任务证据           | 本合同、T081 metadata、任务索引 T081 行及真实结果在 `ACCEPTANCE_EVIDENCE_V0.1.md` 的条目；最终 docs closeout 仍遵守 owner gate                                                |
| 忽略的产物         | `out/`、`release/`、`.tmp/evidence/` 与一次性测试根；不提交安装包、数据库、配置内容、令牌或完整日志                                                                           |

为生成两种真实版本，优先使用已存在且可验证的不同 source revision/版本包。若必须修改 `package.json`/lock、依赖或额外生产模块才能达成目标，先提出精确扩围；本合同不预授这些文件修改。`package.json` 仅新增无依赖测试命令也需在批准时列明范围，不能暗中加入。

## 6. 明确非范围

- T082 的 `electron-updater`、私有 GitHub Releases 鉴权、检查与下载；T083 的应用内确认安装、退出协调及草稿处理；T084 的 Actions 发布与完整阶段验收。
- schema、migration、数据导入/恢复、自动备份、导出格式或 AI Provider/权限改变；不改变 SQLite 或 Electron 的生产路径以迎合测试。
- 自动检查、后台通知、强制更新、静默安装、降级、预发布通道、多平台、代码签名或正式源发布。
- 真实凭据、真实用户数据库、真实安装注册状态和真实使用资料；不复用 AI key。
- Ready、合并 `dev`/`main`、tag、Release、外部发布、强推或远端删分支。

## 7. 必须保持的不变量

1. 旧版和新版的 `appId`、每用户安装身份、实际 `userData` 解析规则稳定；安装路径变更若发生必须单独验证。不得因数据库打不开而创建替代空库。
2. schemaVersion 保持 3；Goal、Action、Routine、Review、Record、关联、生命周期与显式 LocalDate 在升级前后逐字段保持。`unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 不能合并，历史不移动。
3. 完整导出保持既有结构与范围，排除凭据、AI 草稿和日志；比较时只忽略契约允许变化的导出时间、应用版本等技术字段。
4. 同一 Windows 用户的合成 AI 配置升级后仍能解密并使用；验证只记录可用性，不输出明文、密文、路径或环境内容。AI 不可用时核心记录、查看、管理、导出仍可用。
5. 构建/测试明确 `--publish never`；版本和产物 hash 与 source revision 一一绑定，不复用同名包、不拿旧产物证明新 HEAD。
6. 安装/卸载自动化只在隔离 Windows 身份执行；仅更换 `--user-data-dir` 不是安装注册隔离。测试清理前核对绝对路径和归属，不删除不属于测试根的文件。

**局部风险**：安装器覆盖真实应用身份、两个包实际同版或不同 `appId`、旧/新产物混用、WAL 中未提交状态造成错误比对、合成配置随安装丢失、运行中安装被误判安全。每项均须以测试环境和产物清单控制，并保留失败事实。

## 8. 交付物

- 两个不同版本 NSIS 安装包的 source revision、版本、`appId`、SHA-256 与构建环境清单；仅记录元数据，不提交二进制。
- 可重复的跨版本原位安装程序及测试辅助，覆盖成功、应用仍运行、重开、完整事实/导出/合成配置守恒和新版继续写入。
- 明确的同 schema 兼容来源矩阵及失败/中断后应用外手动修复说明，注明首期无自动备份或通用恢复能力。
- 当前候选的定向验证、受影响回归、完整 `verify`、Windows 实装证据、完整 diff 和独立 review；CI、人工体验与最终集成结果分开记录。

## 9. 可判定验收条件

1. A、B 为可追溯且版本严格递增的真实 NSIS 安装包；`appId`、数据目录、安装模式与 schemaVersion=3 一致。测试构建没有发布到任何源。
2. 在同一隔离 Windows 用户及同一实际应用数据根中，A 通过 UI/正常命令创建或修改全部本任务适用核心状态及合成配置；退出和重开 A 后数据仍存在。不能仅用空库或 API seed 代替关键用户流程。
3. 不卸载 A 而安装 B，启动 B 后按业务字段与必要关联比较全部旧事实，显式 LocalDate、状态和历史无改变；同机合成配置可用。导出结构与事实一致，新增记录后再次重开仍存在。
4. 应用运行时尝试安装 B 的行为有实际观察：若安装器阻止，明确提示并保留 A 可用；若允许，须证明没有并发写库、残留进程或损坏。不能由进程退出码单独推断数据安全。超出本任务允许模块才能修复时停止并升级。
5. 故障或中断演练后，不把新空库误报成功；提供并演练应用外手动同版本修复或更高兼容版本安装路径，记录程序能否重开及原始数据是否仍在。不承诺安装原子性。
6. 定向、受影响范围和完整 `verify` 通过；隔离 Windows 安装结果及版本/hash 证据绑定同一候选，完整 diff/独立 review 没有未处理 material finding。任何 skipped、failed 或平台不可用项保留原状，不算通过。
7. **MANUAL**：项目所有者在隔离 Windows 环境核对覆盖升级、历史/配置、导出、失败后修复的可理解性与实际未签名安装提示；结果保持 pending 直到 owner 实测并记录。

## 10. 验证计划

### 10.1 合同准备检查

只验证合同结构、引用和 diff；本轮不运行产品测试、打包或安装，不记录 T081 行为通过。Markdown 被 `.prettierignore` 忽略，须对本文件显式运行 Prettier 检查。

### 10.2 实施后的定向与回归

在已授权并隔离的任务环境中，按实际改变的文件运行已有入口；跨版本测试必须在上述 Windows VM/独立测试账户中，以明确 A/B 相对产物路径、版本和 hash 运行。新增跨版本命令在实现测试入口时固定于本合同/证据，不把尚不存在的命令写成已通过。

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:package-smoke
npm.cmd run verify
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

上述 package smoke 也会运行 NSIS 安装/卸载，因此只可在隔离 Windows 身份执行；`verify` 在普通环境中可能跳过 package-only 程序，不能替代它。构建 A/B 时各在独立、可追溯 source revision 及其隔离输出根执行相同的禁止发布命令；不覆盖另一候选产物。`verify` 包含 format、lint、typecheck、build、unit、integration 和常规 Electron E2E；按受影响内容额外运行 AC-07/导出与配置回归，精确文件入口在代码候选形成后登记。

### 10.3 确定性证据与人工步骤

对关键命令使用 `node tools/evidence/capture-command.mjs --task T081 --gate <gate> --base-revision <实际 SHA> --output .tmp/evidence -- <明确 argv>`；Windows `.cmd` 由 wrapper 用显式 `ComSpec` argv 启动。JSON 只保留允许的元数据，不写 stdout/stderr、绝对用户路径、正文、数据库、凭据或完整日志。记录旧/新版 source 与 hash、实际执行环境、命令、结果、限制，以及 PR head/test-merge 的不同 revision。

人工验收按 §9.7 在隔离机器执行；不将 Agent 自动化代签为 owner 结果。安装失败、权限提示和手动修复均记录实际观察。

### 10.4 验证环境

- OS：Windows x64 一次性 VM 或独立测试账户；不能使用真实 MyTracer 安装身份所在账户。
- Node/npm/Electron/builder：以当前锁定版本和实际执行环境记录；编写时 `package.json` 为 Node 24.18.0、npm 11.16.0、Electron 43.3.0、electron-builder 26.15.3。
- 数据：唯一临时测试根、合成业务数据、合成 AI 配置、fake Provider；不使用 live Provider。
- source / packages：实施时填写 A/B 精确 SHA、真实版本、安装包 hash 与签名状态；当前均未验证。

## 11. Git 与 GitHub 权限

项目所有者已批准下列任务 Git 权限，并要求本次仅创建分支及提交合同/治理文件，不开始产品开发。未明确为 `true` 的动作不得执行；Ready 须在实际审查与 CI 门禁满足后才能操作。

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

- **依赖**：T081 无新增/升级依赖；已批准的 `electron-updater` 属于 T082，不能提前安装。改变 Electron、builder、SQLite 或其他版本须另行批准。
- **网络**：准备阶段可只读核对来源包与版本资料；实施中的受控下载或 GitHub Draft PR 只能在合同批准的精确权限内执行。测试不接正式更新源，不发布 Release。
- **AI**：仅 fake Provider 与合成配置；不读取真实 key，不作 live Provider 调用。
- **数据**：不进行 schema/migration 或破坏性真实数据操作。安装/卸载只在隔离身份与授权测试根执行。
- **外部写入**：任务分支普通 push 与同一任务 Draft PR 已批准，但本步不执行；非任务外部写入、Actions 发布、tag、Release 均未授权。

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

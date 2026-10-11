# T084 — 私有发布流程与 S8 阶段验收

> 2026-10-11 事实校准：PR #60 delivery=e9b3923bac93c0d13b8c6d29f219dfd703e71c65，dev integration=080c308ff511705bfd8ab21386a03d58ec311dcd；final-head Verification/Update candidate 成功；剩余阶段责任由 T809 owner 明确豁免收口。 任务状态以任务索引为准，见 [EV-DOC-CALIBRATION-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)；下文执行权限与等待文字按原日期理解。

> 合同状态：approved，2026-10-03；owner 明确批准并激活开发合同，同意验证版本与产物方向，并批准 §11 的任务分支、提交、普通 push 与 Draft PR 权限；本任务不新建独立 worktree。真实源演练与部署方案见 [具体提案](T084_PRIVATE_REHEARSAL_DEPLOYMENT_PROPOSAL.md)，方案批准前不写真实源。任务索引同步冲突已按 owner 授权解决，记录见 [升级提案](T084_INDEX_CONFLICT_PROPOSAL.md)。Owner 指定本步仅建分支、落实合同及提交，不直接开始开发。

> 2026-10-04 执行授权更新：owner 已要求继续 T084，并批准只读独立评审子 agent、固定私有源演练安排及“当前 Windows 账户＋全新合成数据＋`0.1.0`→`0.1.3`→`0.1.4` 完整正常升级链路”。原合同准备时的“本步不开发”限制仅为历史记录，本次已解除。具体 Release/tag/source/hash 批准、凭据注入、人工验收及最终 docs closeout 门禁仍保留；本修订不签署验收或标 done。

> 2026-10-04 实装预检修正：同进程环境修改的初次探测不能代表启动时已设置完整合成 profile 的新进程。锁定 Electron 的新进程及无 userData 覆盖的默认路径探测已确认当前临时方案有效；保留安装前检查，撤回默认目录操作/例外建议，见 [路径核验与提案撤回记录](T084_CURRENT_ACCOUNT_DATA_PATH_PROPOSAL.md)。现存默认数据仍不进入测试、未搬移或删除；不新增路径权限，也不把此最小探测当作完整实装通过。

## 1. 任务信息

- **Task ID / Title**：T084 / 私有发布流程与 S8 阶段验收。
- **Slice / Plan item**：S8-D；[实施计划](../architecture/IMPLEMENTATION_PLAN_V0.1.md) §13、[S8 设计](../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md) §4 D 节点。
- **激活记录**：owner 已激活，索引为 `active`；本步仅合同准备提交，不运行实现阶段，状态不代表产品开发已开始。
- **Base branch**：`dev`。
- **编写时观察基线**：本地 `dev@cf3b2b4c00b6757218295c2672d23cf19f1ee526`，包含 T081 PR #57、T082 PR #58；工作区开始时干净。本轮未查询远端，不声称这是最新授权 dev。
- **任务分支**：`task/T084-private-release-acceptance`，本轮按 owner 授权从当前 `dev@de88b1877ba2cfc48f1e593bcfcb2007471a3fa3` 创建；使用当前 checkout，不新建独立 worktree。
- **流程**：V2 显式权限；不声明 Automation Profile。T084 包含 workflow 实现与验收准备，不由纯阶段验收流程代替开发流程。

## 2. 目标结果

建立自动准备、owner 手动发布的私有 Windows NSIS 分发流程：候选构建只产生可追溯 Actions artifact；发布流程在 owner 审阅并手动指定已验收 main SHA、版本和不可变产物后，验证身份、来源、hash 与版本唯一性，再发布固定私有仓库的稳定更新资产。实现 workflow 不等于执行发布。

补齐 T082 approved-2 交给 T084 的真实私有鉴权、最终发布包及安装版体验证据。以可追溯的不同版本安装包连续证明手动原位升级、应用内检查/下载/明确安装、重启后数据及同用户配置保留，并形成 S8 最终集成 revision 的自动化与 owner 人工验收交接。所有未执行项目保持 pending。

## 3. 需求与授权依据

- **U**：S8 U-01～U-05；U 编号是已批准维护范围，不新增冻结 FR。
- **FR / AC**：FR-D01～D05、AC-07 为事实保留、重开、导出与核心独立边界；在最终阶段版本回归 AC-01～AC-07，不从旧 T072 或 T082 CI 推断新阶段通过。
- **D**：D-008～010、D-014/015、D-106/109/111，保持例行事实、日期、确认写入、AI 降级与导出边界。
- **ED / GW**：ED-004/010/014/017～019；GW-001～010 及 GitHub 工作流 §11～12 的里程碑、发布与修复规则。
- **直接输入**：S8 设计 §3.1～3.5、§4～7；T081 升级合同/程序、T082 approved-2 合同及 EV-T081-001 / EV-T082-001；T083 合同与 EV-T083-001 已核对，真实应用内连续升级缺口归本任务补验。

### 3.1 References

```yaml
references:
  requirements: [docs/PRODUCT_REQUIREMENTS_V0.1.md]
  decisions:
    - docs/DECISIONS.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  stage_design:
    - file: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
      sections: ['3.1', '3.2', '3.4', '3.5', '4', '5', '6', '7']
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
```

## 4. 开始条件与依赖

- [x] Owner 批准并激活合同，本轮明确授予任务 Git/GitHub 权限及索引冲突解决；仅合同提交，不直接开始开发。
- [x] 本地索引 T081/T082 为 done，集成提交分别为 `0724cbb9990d328ee7ff68b7e5ac93fc8107e6d3`、`cf3b2b4c00b6757218295c2672d23cf19f1ee526`；这是输入事实，不是 T084 通过结果。
- [x] T083 PR #59 已进入 `dev@de88b1877ba2cfc48f1e593bcfcb2007471a3fa3`；final PR head `91933e05debdbd0e091a885dcb7c31e880f58588` 的 run `37032193821` 与 post-merge run `37051649546` 均 success。EV-T083-001 按 owner 批准替代验收 pass，完整应用内跨版本升级仍未证明。
- [x] 建分支前确认本地已 pull T083，当前 dev 为 `de88b1877ba2cfc48f1e593bcfcb2007471a3fa3`；保留索引上游全部任务行及 T083 done，补入 T084 合同/激活记录。真正开发前重新核对最新授权 dev、main、工作区及 shared surface。
- [ ] 验证版本具体化为 T083 `0.1.3`→T084 `0.1.4`，对应 owner 本轮同意的更高目标版本方向；根应用版本/lockfile 同步仅限此变化。实际 source revision/hash 构建后固定，不预填。旧 `0.1.2`→`0.1.3` 为已有手动路径输入；不同包/来源配置不得混用。
- [x] Owner 已单独批准 T084 使用当前 Windows 账户和全新合成数据，放弃强制 VM/独立账户。2026-10-04 在实际 owner 账户只读预检：无 MyTracer 进程、无匹配每用户卸载注册项、默认安装目录不存在；默认 userData 和更新缓存存在，禁止读取内容、复制或清理。沙箱账户不作为实装身份。每次真正实装前必须重做 SID、进程、注册项和路径归属检查。
- [ ] 执行前由测试创建唯一 OS 临时根 `mytracer-tests-*`，固定其 `installed-app`、`AppData/Roaming`、`AppData/Local`、`exports` 和缓存子目录；实际绝对路径仅保存在本地操作记录，脱敏证据不写路径/SID。保持同一根贯穿 A/B/C，实际默认 userData 必须经 realpath 确认为该根后代；现存默认数据/缓存不进入该范围。测试保留自己的安装和合成数据，不自动卸载或删注册项；当前没有任何清理授权。
- [ ] 为真实源验证准备专用、最小只读、可撤销、有有效期的测试凭据；由 owner 安全注入，不展示或读取其值。普通 CI 移除真实变量并使用合成值。
- [ ] 将实际发布者 owner 身份、源/目标私有仓库、可信 workflow ref、写凭据配置与权限需求列入部署清单；配置 secrets/environment/规则须另行精确授权。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T081, T082, T083]
    blocks: []
    can_parallel: []
    prefer_after: [T083]
    conflicts_with: [T081, T082, T083]
  revisions:
    observed_dev_base: dev@cf3b2b4c00b6757218295c2672d23cf19f1ee526
    required_dev_base: dev@de88b1877ba2cfc48f1e593bcfcb2007471a3fa3
  shared_surfaces:
    - workflows, packaging configuration and provenance tools
    - installed update fixtures and upgrade evidence
    - task index and acceptance ledger
  external:
    - T084 owner-approved Windows identity, unique synthetic temporary roots and real NSIS source packages
    - fixed private GitHub source and dedicated read-only test credential
    - owner-dispatched publication of exact accepted main artifacts
```

`required_dev_base` 已根据 T083 集成事实固定；实施前仍检查最新授权 dev、工作区冲突和 freshness。采用 `metadata/T084.json` 辅助校验，risk=high、integration_policy=serial，不计算权限或自动启动任务。

## 5. 允许修改范围（owner 已批准）

| 文件/模块                                                                                                              | 允许目的及限制                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/update-candidate.yml`、`update-publish.yml`（拟新增）                                               | 分离候选构建与人工发布；最小权限、可信来源、串行发布和失败保护。                                                                |
| `.github/workflows/verify.yml`、`tools/ci/classify-changes.mjs`                                                        | 仅将新增工具/测试纳入适当校验与打包；保留现有 `CI Gate`、Verification 只读及 PR head/test-merge 区分。                          |
| `tools/release/`（拟新增）、`tools/evidence/`                                                                          | provenance、包/元数据/hash 验证、发布前校验及脱敏证据；复用现有 wrapper，不改变其禁止敏感信息规则。                             |
| `package.json`、`package-lock.json`、`electron-builder.yml`                                                            | 必要测试/构建脚本及固定私有来源、显式禁发布；lockfile 仅同步另行批准的应用版本。无新增/升级依赖，版本变化先固定具体目标并获批。 |
| `tests/unit/`、`tests/integration/` 中发布工具测试                                                                     | 验证来源、身份、产物、版本、hash、失败与发布顺序，外部写操作使用 fake。                                                         |
| `tests/e2e/windows-in-place-upgrade.e2e.test.ts`、拟新增 `windows-installed-update.e2e.test.ts`、相关 `tests/support/` | 可参数化的跨版本、安装版应用内连续升级及合成数据比对；不把测试钩子带入生产权限。                                                |
| 拟新增 `T084_RELEASE_OPERATIONS.md`、`T084_STAGE_ACCEPTANCE_PROCEDURE.md`                                              | 构建/审批/发布、凭据轮换、unsigned、失败修复、兼容矩阵和验收操作说明。                                                          |
| 本合同、`metadata/T084.json`、索引 T084 行                                                                             | 合同准备及授权/状态事实。最终 evidence、阶段状态和其他 docs closeout 先提交影响矩阵，经 owner 批准后收口。                      |

新增测试入口须由本任务建立，并在文档中区分拟建与已存在。若需修改 T082/T083 的产品实现修复实测问题，先提出确切范围和升级提案，不从测试权限推断修复授权。

## 6. 明确非范围

- 不修改业务 Domain、SQLite 表/migration/schemaVersion=3、导出契约、安装身份或 userData 解析；不新增自动备份/导入恢复。
- 不新增更新 UI/安装能力、跨重启草稿、自动检查/下载/静默安装、预发布切换、自动降级、遥测或多平台。
- 不升级依赖、扩大 AI Provider/上下文/权限、改变凭据持久化或加入代码签名。
- 不自行配置 secrets/environment/保护规则、dispatch 发布、merge、推进 main、tag、Release、覆盖已有资产、强推或删除远端分支。
- 不代签 owner 人工验收、不把 workflow 文件或 fake 成功当成真实分发结果、不自动开始下一阶段。

## 7. 不变量与局部风险

1. 保持 appId=`io.mytracer.desktop`、Windows x64 NSIS、每用户安装及同 schema；数据打不开不得创建替代空库，过新 schema 安全拒绝。
2. 只读检查/下载凭据留在 Main 的 `MYTRACER_UPDATE_TOKEN`；发布写凭据只在发布 job。AI key、token、用户数据、数据库、完整日志不得进入包、Renderer、导出、证据或普通 artifacts。
3. 包的应用版本严格递增、稳定通道、固定 HTTPS 私有源；资产 SHA-256 和 updater 元数据 SHA-512 均匹配。unsigned 必须如实记录，不承诺已验证发布者，不关闭 Windows 安全保护。
4. 普通关闭不是安装确认；草稿、未确认 AI 建议阻断安装；事务/导出/配置保存协调、候选变更重确认与新版本启动验证由真实实装流程覆盖。
5. 所有测试只使用合成业务数据、fake AI 和唯一临时根；T084 可采用 owner 已批准的当前 Windows 账户。修改 userData 不能隔离 NSIS 注册项，仍须核对真实 SID、无现存进程/安装注册项及目录归属。不碰既有默认数据或安装；清理需要另行授权，不能由环境替代方案推导。
6. candidate workflow 与 Verification 不持有 Release 写权限，不改变 feed。所有测试打包显式 `--publish never`；不沿用可能隐式发布的旧 package 命令。
7. 发布只消费 owner 审阅的不可变 artifact；构建、测试、验收、hash 和版本绑定同一来源。过期/缺失/不一致必须重新构建并重新审阅，不能静默换包或接受任意分支脚本。

**局部风险**：首次实装检查需要真实稳定源，而完整阶段验收又需要实装结果。按 §8 的受控演练与正式发布分层，不能要求“阶段已完整验收”后才允许建立任何测试源，也不能让演练源污染正式 latest。源隔离方案不成立时停止，不偷偷改生产客户端源。

## 8. 交付物与发布流程

### 8.1 候选构建

拟建 `update-candidate.yml` 从可信受控 revision 构建，固定 lockfile/工具链，运行要求的验证、`--publish never` 打包和隔离 smoke，上传私有候选 artifact。manifest 包含完整 source SHA、应用版本/schema/export 版本、workflow/ref/run/artifact ID、资产名/大小/hash、元数据 hash、unsigned 状态、测试摘要与兼容来源版本。产物存放忽略目录，不提交二进制或敏感 fixture。

Actions 新增/升级或第三方 Action 的引入，在实施前列明精确版本及来源并获得适用授权；优先复用仓库已批准工具，不把设计批准当成任意依赖批准。

### 8.2 owner 手动发布

拟建 `update-publish.yml` 仅支持 `workflow_dispatch`，输入完整已验收 main SHA、版本、candidate run ID、artifact ID，以及本次 tag 名/目标 SHA（若创建）。禁止浮动 latest artifact。验证调用者为明确配置的 owner、workflow 来自可信 main、source 在批准 main 且与验收/provenance 一致、候选成功且未过期、artifact/hash/版本一致。输入须严格校验，不拼接执行任意命令。

默认只读权限；只有完成校验的发布 job 获目标仓库最小写权限，显式固定源与目标 `Fyrefly-4/MyTracer` 并确认 private。按目标仓库串行化发布，重复版本/tag/资产安全拒绝，不能覆盖。先创建 draft、上传全部 NSIS/元数据/所需 blockmap 与 hash 清单并回读核验，再转成私有仓库可见的非 draft stable Release。失败保留可追溯 draft/事实，不能把未完成产物暴露给稳定客户端；已创建 tag 等副作用如实报告，不承诺原子回滚。

Owner 对已审阅具体版本/产物手动 dispatch 即为该次批准，无需重复会话确认；Agent 代触发仍需该版本/产物精确授权。Environment reviewer 如可用可增强控制，但不得假定套餐支持或开启 prevent self-review 阻断单人流程；远端配置只读核查与实际配置授权分别记录。

### 8.3 首次真实源演练与阶段交接

先完成工具/fake/受控源验证及候选包审阅，再由 owner 授权受控私有测试 Release 的确切版本、source、资产/hash、tag、仓库与用途。若需要测试专用源构建，只通过构建时固定受控来源、保持正式 appId，记录与正式构建的配置差异；不得接受 Renderer URL 或将演练 feed 自动切为正式 feed。使用正式源做演练会改变现有用户可见 latest，必须针对该副作用精确授权。

该演练授权独立于 §8.2 的“已验收 main 正式发布”，不要求尚未完成的全阶段证据，也不证明正式版本已获发布批准。默认 Agent 不写测试源。完成实装证据后固定 S8 最终 dev integration revision、执行阶段聚合及 owner 人工验收，再按批准的 main 集成/正式发布流程交接。若正式包与实测包存在产品代码或配置差异，列明差异并补验证，不能把演练结果直接挪用。

交付连续升级工具、失败矩阵、完整 diff 与独立 review、early/candidate/final-head CI、发布说明与阶段证据；T084 开发交付与阶段 acceptance 分别记录，阶段未闭合不得宣称 S8 完成。

## 9. 可判定验收条件

1. candidate 构建无 Release/tag/feed 外部写入，包和元数据版本/hash/provenance 一致；所有打包入口显式禁止发布。
2. 发布前校验拒绝非 owner、非可信 main、缩写/错误 SHA、版本不匹配、失败 run、跨仓库/错误 artifact、篡改 hash、过期/缺失产物、重复版本及未满足验收来源；fake 测试证明失败不进入可消费发布状态。
3. 授权的发布演练证明只在校验后获得写能力，全部资产核验后可见；权限/上传/核验/可见性失败有实际结果或明确 pending，不用 fake 掩盖真实未验证。
4. 兼容矩阵逐项绑定来源版本。无更新器 A→含更新器 B 采用手动原位安装；具备完整 T083 安装能力的 B→严格更高 C 走应用内更新。历史 T082 `0.1.2` 仅检查/下载，不能单独作为完整 B→C 安装能力的证明。
5. A/B/C 同一合成 fixture 连续创建、重开、升级、导出比对、再新增记录和重开；比对全部核心字段/关联/历史 LocalDate，仅忽略允许变化的 appVersion/exportedAt，验证同用户合成配置仍可解密使用且不输出密钥。
6. 真实私有源覆盖未配置/错误/过期或撤销凭据、无权访问、HTTPS/重定向、缺失元数据、损坏包、下载断网/重试/稍后；鉴权失败与无更新不同，核心功能持续可用。
7. 草稿逐项阻断、取消不丢输入、写入/导出/配置等待、第二实例、同版/低版/预发布拒绝、磁盘不足、安装失败/中断及过新数据库拒绝有逐项结论；失败后可按应用外说明修复，不自动回退、不声称安装原子性。
8. 在同一 S8 最终 dev revision 上 aggregate、打包、升级/失败路径结果可追溯，AC-01～07 受影响回归通过；缺口有 owner 明确处置而非删掉失败。
9. **MANUAL**：owner 在 T084 已批准 Windows 账户与合成数据环境完成 S8 §6.3 操作与 unsigned/系统拦截体验、私有源访问、数据/配置保留、安装失败人工修复，记录通过/失败/部分通过。Agent 不代签。准备文件完成不等于本条通过。

## 10. 验证计划

### 10.1 已有命令（实施时执行，本轮不运行产品验证）

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/update-service.test.ts tests/unit/update-request-policy.test.ts tests/unit/update-release-metadata.test.ts tests/unit/update-package-integrity.test.ts
npm.cmd run test:integration -- tests/integration/updates-ipc.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/update-check-download.e2e.test.ts
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

`verify` 不覆盖真实源、实装更新或发布。`test:package-smoke` 与既有 `windows-in-place-upgrade` 仅在已授权隔离环境、固定包与预检后运行；既有升级测试固定 `0.1.0`→`0.1.1`，本任务须参数化后才可声称覆盖新矩阵，不借用 T081 账户 ACK。

### 10.2 本任务拟建立的精确入口（当前不存在，不算已通过）

```powershell
npm.cmd run test:unit -- tests/unit/release-provenance.test.ts
npm.cmd run test:integration -- tests/integration/release-publication.test.ts
npm.cmd run test:installed-update
npm.cmd run release:validate -- --manifest .tmp/release/candidate-manifest.json
```

拟建 `test:installed-update` 只选择隔离 NSIS 实装连续升级测试；不进入默认真实源 CI，不输出凭据，缺少来源版本/hash/环境批准直接拒绝。输入规范由 `T084_STAGE_ACCEPTANCE_PROCEDURE.md` 明确。拟建 `release:validate` 是只读 manifest/资产校验工具，无发布副作用。建立后同步真实 script、文件与准确 argv。

### 10.3 Evidence / CI / 环境

```powershell
node tools/evidence/capture-command.mjs --task T084 --gate task-candidate --base-revision <actual-full-sha> --output .tmp/evidence -- npm.cmd run verify
```

分别捕获 targeted、aggregate、package、installed-update 的真实退出码。`.cmd` 使用 wrapper 的显式 ComSpec argv 与 `shell:false`；JSON 仅固定脱敏元数据/相对 artifact，不存 stdout/stderr、环境原值、绝对用户路径、数据库、正文、密钥或完整日志。发布 manifest 为另一个明确用途的产物，不扩充通用证据 wrapper 的敏感字段许可。

候选记录 source、PR head/test-merge、CI run/job/artifact ID；发布记录实际 main SHA、workflow ref、owner 触发、版本/tag/资产 hash、Release ID 及可见状态。early/candidate/final-head/post-merge 分开；保存失败/skip 并用 supersedes 链接后续成功。证据拟用 EV-T084-001（工具与 workflow）、EV-T084-002（真实分发/实装）、EV-S8-001（最终阶段聚合），尚不创建通过条目。

Windows x64 可启动桌面进程，T084 批准身份与唯一临时合成数据根；编写时 Node 24.18.0/npm 11.16.0/Electron 43.3.0/builder 26.15.3/updater 6.8.10。实际环境和每个包 source/版本/hash 在运行时固定。常规测试 fake AI/fake 更新源，真实源测试另列网络/账户授权。

人工程序按 S8 §6.3 连续执行；失败/磁盘不足/安装中断等破坏性场景另行决定安排，当前账户正常链路批准不包含这些操作；未实测项保持 pending。不修改全机安全设置。外部 CI 确认启动并记录 revision/run 后 HANDOFF；恢复时检查是否 superseded，不轮询不变状态。

## 11. Git 与 GitHub 权限

Owner 已批准并激活开发合同，随后明确“给予 Git 与 GitHub 权限，批准合同中的权限，本次开发不新建独立 worktree”，并要求本步从 dev 建任务分支、解决索引冲突、落实决定及提交合同。本任务可创建当前 checkout 的任务分支、作范围内提交、普通 push、创建/更新同一目标为 dev 的 Draft PR；本步只执行建分支与合同提交，不 push、不建 PR、不开始开发。Ready、merge、main、tag、Release、部署配置等 owner gate 不随任务 Git 权限解除。

```yaml
permissions:
  local_write: true
  create_worktree: false
  create_task_branch: true
  create_commit: true
  push_task_branch: true
  create_or_update_draft_pr: true
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: false
```

上述普通任务 Git 权限已生效，不再重复请求。`external_write:false` 指非任务外部写入，不否定已单列的 push/Draft PR 权限。Ready、docs closeout、merge、main、tag、Release、真实测试源与部署配置仍分别遵守 owner gate；owner 手动 dispatch 的确切发布批准按 §8.2 生效，不需另设重复 gate。验证环境及真实源安排按具体提案确认；本步结束后等待继续开发指令。

## 12. 依赖与外部操作

- **依赖**：复用锁定工具链，无新增或升级；如工具/Action 需要新依赖先列精确版本并批准。
- **版本**：真实目标版本及版本文件变化单独固定获批；不能覆盖已发布版本，测试不能复用改名的同版包。
- **网络**：实施激活后按授权只读核查 GitHub/官方文档；普通 CI 不带真实凭据。真实私有源 read/download 限指定仓库与隔离测试账户，写入/dispatch 不由 read 权限推导。
- **外部写入**：本轮无；未来任务 branch/PR、候选 workflow dispatch、源演练、部署配置和正式发布分别明确。实现 publish workflow 本身不会授予 Agent 执行能力。
- **AI / 数据**：fake Provider、合成数据；不使用真实数据库/AI key，不迁移、不授权破坏真实数据。

### 12.1 Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@de88b1877ba2cfc48f1e593bcfcb2007471a3fa3
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

实施前填写实际 base；分别记录 original base、latest authorized dev、verified against、refresh_method 与 `fresh/refreshed-and-passed/blocked/not-required`。陈旧时普通 merge 更新、受影响回归和必要重审，禁止 force-push。T084 merge 后重新固定最终 dev revision 并取得聚合证据；main 集成/正式包另绑定实际 SHA，不混同 task delivery 与 stage revision。

## 13. 风险与停止条件

T083 未集成；未经批准版本/依赖/写权限；真实源尚未建立且需要外部写入；无法隔离安装注册状态或当前账户；源策略/unsigned 策略无法可靠工作；artifact 与验收来源不能一致；需要任意分支脚本、放宽凭据转发、签名保证或迁移；实装发现 T082/T083 产品缺陷；失败证据/最终 revision 无法闭合——停止受影响动作并用 [升级提案](ESCALATION_PROPOSAL_TEMPLATE.md) 保存实际 revision、命令与结果，等待精确新授权。安全的只读诊断与已授权文档工作可继续。

未发现冻结需求冲突；T083 前置任务已完成。任务索引 Updated upstream / Stashed changes 冲突已按 owner 明确授权解决：保留上游任务表和 T083 done，仅补入 T084 合同链接与当前激活记录。冲突提案保留发现时事实与后续处理。本步不执行产品实现或行为验证。

## 14. 完成报告

### 2026-10-05 授权文档收尾快照

Owner 已明确“暂不考虑执行，直接进行文档收尾并进行最后一次推送”。本次更新合同、任务索引、证据账本、演练方案、认证阻塞记录与阶段程序及 Draft PR 正文，提交/普通推送当前任务分支；不继续真实测试、不重新安装、不清理、不 Ready/merge/main 或再发布。上文“本步仅合同”“拟建入口”等是初始合同阶段事实；现有 `release:validate`、`test:installed-update`、candidate/publish workflow 及离线发布工具已实现，不将历史计划当当前结果。

验证候选 `f9e88a12038d3528dce067fa9828dae534a0bcbc`，基线 `de88b1877ba2cfc48f1e593bcfcb2007471a3fa3`；本地 `npm.cmd run verify` exit 0，独立复核无实质问题，candidate run `37313214100` 与 Verification run `37313214062` success；最新授权 dev 未变化，fresh/refresh_method=none。f9 与实测 a575 仅 Windows ProductVersion 零 revision 测试归一化不同，无产品代码/配置差异。文档推送是新 head，需其自身 CI；delivery/dev/stage final revision 尚未成立，保持 null。

精确批准的 `v0.1.4` 演练已于固定私有源发布，source `a5759763adc18739f8f65bcfc48f01db8f1ecd7f`，五资产回读通过后 stable/latest，真实正常 A→B→C 与既有 C 接续结果见 [EV-T084-002](ACCEPTANCE_EVIDENCE_V0.1.md#ev-t084-002)。原实装版本格式断言 exit 1 和负面检查预期失败均保留；补测只覆盖对应缺口，不改写原命令。

无凭据、合成错误凭据访问真实 API、进程内请求阻断有实装结果；真实 PAT 到期/撤销/有效无权、实际下载中断恢复、磁盘不足/安装中断/失败修复及 owner unsigned/系统提示体验仍 pending。Owner 暂不执行这些项目，不等于豁免或通过。§9条件不缩减，任务仍 active，S8 未完成；最终 dev 聚合与人工验收及正式 main 发布分别另行授权。未新增依赖、迁移、产品语义或 AI 权限；未发现冻结需求冲突。

列出改动文件、U/FR/AC/D/ED/GW 覆盖、真实命令/退出码/环境、分层测试及 owner 人工状态、完整 diff/独立 review、任务/集成/阶段/main revision、PR/CI/run/artifact/包/元数据 hash、真实私有访问与 unsigned 结果、授权和副作用、未验证项及是否出现冲突/范围变化。

T084 实施完成须满足范围内实现、规定验证、评审、证据与 docs closeout；S8 阶段通过须另有同一最终集成 revision 的完整聚合和 owner 人工结果。未得到真实结果前，不标 done，不把本合同当成验收或发布授权。

### 2026-10-06 T809 聚合进度

T081～T084 已分别通过 PR #57～#60 集成至固定产品 dev revision `080c308ff511705bfd8ab21386a03d58ec311dcd`。T809 本地定向、完整 verify 和禁止发布的打包通过；owner 报告本地 0.1.3→0.1.4 应用内更新、未保存输入保护、数据保留和重开持久化的简明步骤全部通过。详见 [EV-S8-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001) 与 [T809 合同](T809_S8_FINAL_ACCEPTANCE.md)。此报告未覆盖完整实装配置/导出绑定、全部真实故障或安装 smoke；T084/T809 仍 active，S8 未整体通过。历史失败与 pending 保留，不执行正式发布。

### 2026-10-06 最终收口状态

Owner 已报告正式凭据部署与重启检查完成，并明确豁免剩余真实故障及实装复核；原 pending 为历史记录，现按 waived-by-owner/未执行接受风险处理，不再阻塞本次 S8 收尾。独立评审和 d57e653 head CI 已通过；hosted aggregate/package/package-smoke 的 complete/exit0 artifacts 已核实。Owner 授权最终文档收口、模板 PR 正文和最后一次推送；T084/T809 仍 active，最新推送 head CI 和交付待核验，不自动 Ready/merge/main/tag/release。正式发布成功仍未执行，现有 v0.1.4 演练资产不覆盖。具体范围及历史证据见 [T809](T809_S8_FINAL_ACCEPTANCE.md) 和 [EV-S8-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)。

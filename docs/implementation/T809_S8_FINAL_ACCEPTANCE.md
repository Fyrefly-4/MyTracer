# T809 — S8 最终聚合验收与发布交接合同

> 合同准备日期：2026-10-05（Asia/Shanghai）。Owner 已同意 S8 收尾方案并明确“现在，建立聚合验收合同”；本轮授权合同、sidecar 和任务索引登记。方案中的首期范围和既有分发决定已批准，不重新设为待批准。任务登记为 ready，尚未开始验收执行；Git 写入、真实安装及发布权限见 §11～12。

## 1. 任务信息

- **Task ID / Title**：T809 / S8 最终聚合验收与发布交接。
- **Slice / Plan item**：S8 final gate；聚合 T081～T084，闭合 U-01～U-05。
- **Status**：active（2026-10-06 本地验证完成，owner 已报告简明操作步骤的人工安装/应用内更新全部通过；其余阶段门待闭合，T084/S8 尚未整体通过）。
- **Base / target branch**：dev。
- **Expected branch**：`task/T809-s8-final-acceptance`，本轮不创建。
- **候选产品 source**：`080c308ff511705bfd8ab21386a03d58ec311dcd`。
- **S8 prior boundary**：`d8b211b3c184cff8d0afdb09ff4b13164704290b`（T072）。
- **编号说明**：前轮建议 T808；本轮发现 T807 合同记录 T808 曾被 owner 废弃，故沿用 owner 的自主编号授权改用未占用 T809，保留历史身份，不复用旧编号。
- **执行方式**：mytracer-stage-acceptance-release，显式权限，不使用 Automation Profile。

## 2. 目标结果

在固定最终 dev 产品 revision 上，证明私有更新源、检查下载、确认安装、安全退出及数据保留完整衔接；owner 在本地安装软件后亲自完成一次真实应用内跨版本更新，并在正常启动、重启后继续使用。形成可追溯的自动化、安装、人工、失败与恢复证据，准备正式发布交接。

沿用已批准决定：同 schema=3 更新，私有 GitHub Releases，Main 读取本机只读 `MYTRACER_UPDATE_TOKEN`，不配置代码签名；Actions 自动准备，由 owner 对具体版本和产物手动触发发布。不得把这些决定重新列为审批缺口。实际部署输入、执行环境、具体发布对象与结果分别记录。

## 3. 需求依据与 References

- **U**：U-01～U-05。
- **FR / AC**：FR-D01～D05、AC-07；最终阶段受影响回归 AC-01～AC-07。
- **D**：D-008～010、D-014/015/106/109/111。
- **ED / GW**：ED-004/010/014/017～019；GW 的验证、review、freshness、任务/里程碑集成与发布门禁。
- **直接依据**：[S8 设计](../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md) §3～7、[测试策略](../architecture/TEST_STRATEGY_V0.1.md)、[GitHub 工作流](GITHUB_WORKFLOW_V0.1.md)、[T084 合同](T084_RELEASE_PIPELINE_STAGE_ACCEPTANCE.md)、[实装程序](T084_STAGE_ACCEPTANCE_PROCEDURE.md)、[发布操作](T084_RELEASE_OPERATIONS.md)。
- **规范优先级**：[PRD](../PRODUCT_REQUIREMENTS_V0.1.md) → [Decisions](../DECISIONS.md) → [变更规则](../REQUIREMENTS_CHANGE_POLICY.md) → 架构与合同。user/ 不作为验收依据。

## 4. 开始条件与 Dependencies

### 4.1 准备时事实

2026-10-05 本会话已只读核对本地与远端 dev 相同，工作区创建合同前干净。集成事实如下；task delivery 必须从各 PR 最新 head、final-head CI 和账本另行绑定，不能用 squash SHA 替代。

| 任务 | PR  | dev integration revision                 | 验收输入                                         |
| ---- | --- | ---------------------------------------- | ------------------------------------------------ |
| T081 | #57 | 0724cbb9990d328ee7ff68b7e5ac93fc8107e6d3 | 任务 done，历史限制仍保留                        |
| T082 | #58 | cf3b2b4c00b6757218295c2672d23cf19f1ee526 | 真实源/安装体验交 T084                           |
| T083 | #59 | de88b1877ba2cfc48f1e593bcfcb2007471a3fa3 | 替代验收通过，不代替完整实装                     |
| T084 | #60 | 080c308ff511705bfd8ab21386a03d58ec311dcd | 实现已合入，索引 active，EV-T084-001/002 partial |

PR #60 head=`e9b3923bac93c0d13b8c6d29f219dfd703e71c65`，最新 Verification `37317033399`、Update candidate `37316888171` 成功；dev post-merge Verification `37319196159` 成功。这些是既有事实，不是 T809 新验收。进一步检查实际 head/test-merge/artifact 后才用于证据矩阵。

**前置完成边界**：T084 的开发内容已集成，但原合同的失败/人工/最终聚合尚未完成。T809 可准备合同与审计继承关系；正式执行入口先形成逐项验收责任矩阵，明确由 T809 补验且回链 T084 原条件，不删除或缩减 T084 条件、不提前标 done。若依赖审计不能证明开发交付完整，停止阶段执行，不以建立 T809 绕过前置任务。

- [x] 首期维护范围与分发约定已批准；开发提交已集成。
- [x] 无新增依赖、迁移或业务行为设计。
- [ ] 执行前重新核对最新授权 dev、各 task delivery 与集成事实。
- [ ] 绑定升级包 hash、source、默认数据根和安装身份。
- [ ] 安装/负面演练环境逐项明确，凭据安全注入。
- [ ] 聚合执行与 Git 权限按 §11 激活，不继承 T084 的任务授权。

```yaml
dependencies:
  tasks:
    requires: [T081, T082, T083, T084]
    blocks: []
    can_parallel: []
    prefer_after: [T084]
    conflicts_with: [T084]
  revisions:
    required_dev_base: 080c308ff511705bfd8ab21386a03d58ec311dcd
  shared_surfaces:
    - T084 acceptance matrix and S8 evidence ledger
  external:
    - owner-operated Windows installation and manual acceptance
    - exact private release artifacts and read-only credential
```

T084/T809 共用证据、安装身份、临时数据与验收状态，不并行执行或清理。元数据为 [metadata/T809.json](metadata/T809.json)。

## 5. 允许修改范围

**本轮合同准备**：本文、metadata/T809.json、TASK_INDEX_V0.1.md 的 T809 行和 S8 阶段门导航；不更新 T084 done 或验收通过记录。

**后续聚合执行**：在本合同激活范围内记录本文及 ignored `.tmp/evidence/` 下的脱敏事实；只运行现有验证入口，不修改测试或产品。必要的临时验收编排须明确命令、可审查内容和数据根，不能新建旁路测试替代合同断言。

**候选文档收口矩阵（完成验证后逐项提交 owner 批准）**：

| 文件                                                                          | 拟补事实                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 本文、metadata/T809.json、TASK_INDEX_V0.1.md                                  | 实际状态、delivery/integration、S8 gate                             |
| ACCEPTANCE_EVIDENCE_V0.1.md                                                   | EV-S8-001 聚合矩阵、失败/supersedes、owner 人工结果；回链 T084 缺口 |
| S8_UPDATE_MAINTENANCE_DESIGN.md、IMPLEMENTATION_PLAN_V0.1.md                  | 删除现行状态中的过期描述，保留原始基线时间含义                      |
| T084_RELEASE_PIPELINE_STAGE_ACCEPTANCE.md、T084_STAGE_ACCEPTANCE_PROCEDURE.md | 已合入事实、补验结果与未覆盖项；不改原始失败                        |
| T084_RELEASE_OPERATIONS.md、T082_UPDATE_SOURCE_OPERATIONS.md、README.md       | 当前安装/凭据/更新入口、版本和发布流程；历史 T082 限制标明时间      |

不删除合同或创建归档替代物。完整文档影响矩阵、逐文件事实和 PR 正文在收口时单独列出。

## 6. 明确非范围

不修改 src、tests、tools、workflows、package/lock、builder、schema、migration 或 Skill；不实现修复；不新增/升级依赖；不新增备份/导入恢复、签名、公开源、AI 权限；不访问真实用户数据；不创建高版本包伪造更新、不覆盖 v0.1.4 资产；不自动创建 tag/Release、清理安装或注册项。

发现源码、测试或发布工具问题时保留失败并按升级提案交给另行授权修复。聚合任务不得通过削弱断言或临时旁路获得通过。

## 7. 必须保持的不变量

五种 Routine 语义、历史 LocalDate、关联与导出事实不变；更新失败不阻断核心功能；凭据留在 Main；未经确认不安装、不丢弃草稿、不自动降级。旧任务失败、skip、manual pending 和 supersedes 均保留。

包版本、产品 source、任务 delivery、dev integration、stage final、test-merge 和 main 晋升各自独立。后来文档提交不能悄悄替换最终产品 revision。复用旧观察必须证明产品内容和运行配置相同，并说明证明的范围。

## 8. 交付物

- [ ] U-01～05、相关 FR/AC/D/ED/GW、任务、revision 与证据矩阵。
- [ ] 固定 dev 的 metadata、定向、完整 verify、package/smoke 结果。
- [ ] 已校验的来源/目标包清单、兼容矩阵和安装前预检记录。
- [ ] owner 本地安装、真实跨版本更新、正常入口重启和数据保留结果。
- [ ] 失败矩阵逐项真实/受控/未执行结论与恢复程序。
- [ ] 独立只读 review、candidate/final-head CI（取得相应权限后）。
- [ ] owner-approved 文档收口与发布交接清单；不预填 release-approval accepted。

## 9. 验收标准

1. 全部开发内容属于批准 S8 范围且已进入固定 dev；task delivery 与 integration 审计完整。T084 缺口明确回链并闭合。
2. 同一阶段基线上的规定自动化、package、连续实装及失败矩阵均有实际结果。不得以旧任务 green 或默认 skip 代替。
3. **MANUAL 必需**：owner 在本地从来源版完成检查→下载→草稿阻断→处理草稿→重新确认→NSIS 向导→新版启动，明确报告通过/失败/部分通过。
4. **MANUAL 必需**：正常快捷方式/开始菜单启动时能够取得只读凭据；更新器重启与完全退出后再次从正常入口启动仍能检查。不能仅证明开发终端注入环境时可用。
5. **MANUAL 必需**：升级前后相同合成数据根；历史记录/状态/关联/日期和配置可用，导出一致；新增记录再次重开仍在。未知发布者/系统拦截提示及处理观察由 owner 记录，不关闭系统安全保护。
6. 失败场景见 §10.3；未执行项不因 owner 先前暂缓而豁免。若需要缩减验收必须作为明确范围变更处理，不由本合同隐含放宽。
7. 独立 review 无未解决实质问题，证据绑定最终产品 source；必要 CI 最新 head 成功，docs closeout 后重新核验。
8. owner 人工通过后才判断 S8 gate；T084/T809 done 及文档更新基于实际结果和批准。正式发布是独立事实，不由阶段通过推断。

## 10. 验证计划

### 10.1 现有命令

依次执行并通过 wrapper 留证，先窄后广；本轮合同准备只执行 metadata 和文档检查。

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/update-service.test.ts tests/unit/update-release-metadata.test.ts tests/unit/update-request-policy.test.ts tests/unit/update-package-integrity.test.ts tests/unit/update-install-service.test.ts tests/unit/update-install-gate.test.ts tests/unit/update-install-coordinator.test.ts tests/unit/update-draft-probe.test.ts tests/unit/release-provenance.test.ts
npm.cmd run test:integration -- tests/integration/updates-ipc.test.ts tests/integration/update-install-ipc.test.ts tests/integration/release-publication.test.ts tests/integration/release-github-transport.test.ts tests/integration/release-artifact-extraction.test.ts
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/update-check-download.e2e.test.ts tests/e2e/update-install-shutdown.e2e.test.ts
npm.cmd run verify
npm.cmd run package
npm.cmd run test:package-smoke
```

package 当前内置 `--publish never`，执行前检查没有被变更；package-smoke 涉及安装注册状态，须 §10.4 的隔离授权，不和普通回归混为同一权限。

```powershell
node tools/evidence/capture-command.mjs --task T809 --gate stage-aggregate --base-revision 080c308ff511705bfd8ab21386a03d58ec311dcd --output .tmp/evidence -- npm.cmd run verify
```

各步骤使用对应 gate 和原始 explicit argv；Windows .cmd 由 wrapper 使用 ComSpec、shell:false。记录真实 exit code/source/环境/相对 artifact，不记录 stdout/stderr、原始环境、凭据、数据库或用户路径。所有失败保留；本地按 BLOCK，外部 CI 确认开始并记录 run/head/test-merge 后按 HANDOFF，不无理由轮询。

### 10.2 正常实装与 owner 步骤

现有入口 `npm.cmd run test:installed-update`，输入按 [T084 程序](T084_STAGE_ACCEPTANCE_PROCEDURE.md)固定。其当前账户 ACK 名称仍属 T084 历史授权标识，不能复制 ACK 即视为 T809 有权限；先确定本轮安装环境与精确操作授权，再决定是否适用现有入口。若入口无法表达当前授权，不修改它绕过检查，报告需独立修复/测试工具任务。

首选复核并复用 A=0.1.0、B=0.1.3、C=0.1.4 的真实包；所有 hash 来自文件回读及 EV-T084-002，不能仅凭文件名。S8 人工核心是 B→C；A→B 手动原位路径也必须有可绑定结果。已有 C 安装不构成新的跨版本更新通过；新来源安装需要隔离，不降级当前日常数据库。

旧演练 C source=`a5759763adc18739f8f65bcfc48f01db8f1ecd7f`。准备阶段 `git diff` 核对 src/package/lock/builder 与 dev 无差异；正式复用还需核验包/hash、构建配置和证据。沿用现有包可免去为测试发布新版本；如确需更高版本，转交批准的构建/演练发布步骤，不在本聚合中改版本。

给 owner 的验收包至少含：来源与目标版本/source/hash、合法取得安装包的方法、受控只读凭据配置方式、安装与数据位置核对步骤、更新操作步骤、每步预期、失败停止/保留程序及结果表。不得把真实 token 填入文档或截图。

Owner 顺序：安装来源版 → 从正常入口启动 → 创建示例数据并导出/重开 → 检查并下载 → 留草稿验证阻断与取消保留 → 保存/主动处理草稿 → 确认重启安装 → 操作向导并记录 unsigned 体验 → 核对新版和数据/配置 → 新增记录并退出 → 从正常入口重开 → 检查持久化和更新入口。

### 10.3 失败矩阵

| 组             | 本轮所需证据                                                | 限制                                                                               |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 私有源鉴权     | 无凭据、错误、到期/撤销、有效但无权；核心 CRUD/导出可用     | 真实凭据由 owner 管理，仅专用测试凭据；不撤销日常/发布 token                       |
| 网络           | 真安装版下载中断→恢复→重试；稍后/普通退出不安装             | 进程请求阻断不等于真实下载恢复；不修改全机网络保护                                 |
| 元数据/包/版本 | 缺失元数据、损坏包、同/低/预发布拒绝                        | 受控源/既有 fake 与安装证据分列，不损坏现有 stable feed                            |
| 退出保护       | 所有表单/AI 草稿、迟到结果、排空/超时、第二实例、关闭后失败 | 最终回归和人工体验分别记录                                                         |
| 安装恢复       | 拒绝、磁盘不足、安装中断/失败后的人工修复                   | 一次性可恢复环境独立批准，不在日常环境耗尽磁盘/强杀安装                            |
| 数据           | 过新 schema 安全拒绝、完整关联/LocalDate、重开/导出         | 合成 fixture，不建立替代空库、不逆迁移                                             |
| 发布故障       | 权限、上传、回读/可见性失败和部分 draft 留存                | 离线工具通过不等于真实 API 故障通过；真实演练单独批准，不在既有 Release 上破坏测试 |

上述均给出 pass/fail/pending 与证据层级。原 ProductVersion 和网络错误码失败保留；后续成功只能限定 supersedes，不将历史组合命令改为 exit 0。

### 10.4 环境与数据保护

Windows x64 可启动桌面进程，基线工具链 Node 24.18.0/npm 11.16.0/Electron 43.3.0/builder 26.15.3/updater 6.8.10；执行时核实，不自行安装升级。普通验证唯一临时 SQLite/userData/export、fake Clock/AI，移除真实更新 token。

真实安装先检查实际 SID、进程、卸载注册项、安装位置、默认数据与缓存的归属。T084 临时安装/数据曾保留；不得假定环境仍空，也不自动卸载/删除。优先使用可恢复的隔离 Windows 环境；若采用当前账户，单独确定新合成根、环境继承、同 appId 注册状态和准确操作，不把仅设置 userData 视为完整隔离。安装器自动重启必须继承正确的数据根和凭据环境；越界立即停止。

真实源只读访问与 owner 提供专用凭据分别记录；测试完不自动清理，提交精确对象及归属后再处理。

## 11. Git 与 GitHub 权限

本次明确授权为合同准备、三文件本地修改和非破坏文档检查。后续执行按本合同具体权限激活，不从“同意方案”推导 push、安装、发布或沿用 T084 权限。已批准的分发/人工触发发布机制不重复审批；每次实际发布仍绑定 owner 所选版本与产物。

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

local_write 本轮只覆盖 §5 的三个合同准备文件。后续聚合执行、Git branch/commit/push/Draft PR 权限及安装程序在启动时分别明确；不创建 worktree 作为默认动作。Release Skill 不执行 Ready、merge、tag、发布或 Secrets 修改，即使 owner 操作过这些动作，也只读取核实后记事实。

## 12. 依赖、外部操作与 Integration

新增依赖/迁移：无。AI：仅 fake。网络：本库 dev/main/PR/CI/Release 的必要只读审计；不读取或输出凭据。真实下载/安装和故障演练按 §10.4/11 的执行授权进行；本轮不触发 CI、不改 Secrets/rulesets、不创建/修改 Release。

```yaml
integration:
  target_branch: dev
  base_revision: 080c308ff511705bfd8ab21386a03d58ec311dcd
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: 080c308ff511705bfd8ab21386a03d58ec311dcd
  proposed_stage_source: 080c308ff511705bfd8ab21386a03d58ec311dcd
```

正式开始时固定 stage_final_integration_revision，不因值存在而宣称 pass。dev 前进时对比内容；只有文档变化需记录等价性，产品/测试/构建变化重跑受影响验证并更新人工绑定。freshness 仅 fresh/refreshed-and-passed/blocked/not-required，绑定实际 revision；不得 force push。

## 13. 风险与停止条件

缺少开发交付、证据不一致、产品或测试缺陷、真实路径越界、凭据污染、需扩大依赖/迁移/权限、不能可靠绑定安装包、手动结果失败、要求破坏正常 feed 或真实数据时停止受影响步骤，按 [升级提案模板](ESCALATION_PROPOSAL_TEMPLATE.md)记录事实。不得用新任务编号掩盖 T084 未满足的条件。

main 审计输入：上轮 API 观察 main=`eae7872e762cb092169be306e7e9d261a26eb3e7`，merge-base=`a37c0eb00d4e3675769ba5e291133de341bfe517`，dev ahead 6/behind 8；main 侧为历史集成提交，reverse compare files=[]。后续再验证，不能仅凭提交数判定产品冲突。dev→main 含 T071/T072 及 S8，里程碑说明须完整列入，不能将其包装为只有四个 S8 任务。

## 14. 完成报告与发布交接

报告改动文件、U/FR/AC 覆盖、三个 revision 角色、实际命令/环境/artifact、旧失败与 supersedes、owner 人工、独立 review、candidate/final-head/post-merge CI、unsigned/凭据/兼容性限制及尚需 owner 操作。

验收候选通过后提交精确文档矩阵，获准再更新 §5 收口文件和阶段状态。独立文档提交后跑 final-head CI；没有 Git 权限时交接待执行项，不能声称已交付。dev→main Draft PR 创建也须单列授权。

正式 Actions 发布需要 accepted-main 源、不可变候选、准确审批账本及 owner dispatch。现有 v0.1.4 属于已授权演练且 tag/资产不可覆盖；正式包如需高于 0.1.4 的版本或产品配置变化，单独安排批准任务并补验证。T809 仅准备这份交接，不通过重打同版包绕过版本/来源校验。

## 15. 本轮授权与准备记录

- 2026-10-05 owner：“同意。现在，建立聚合验收合同”。本轮落实合同、metadata 和索引，不开始产品验收。
- 本轮发现 T808 历史废弃记录，按已授予自主编号权选 T809；T084 active/partial 保留。
- 文档与 metadata 检查结果在交接报告记录；未运行 verify、package、安装或人工验收，不创建 EV-S8-001 的通过记录。

### 2026-10-06 执行激活

Owner 明确“现在按合同开始执行”，先完成亲自安装并真实应用内跨版本更新之前的步骤，再阻塞交接。本次激活 §5 的合同执行记录、ignored `.tmp/evidence/` 脱敏事实和可审查人工交接材料，以及现有非破坏验证与 `package --publish never`。不激活 branch/commit/push/PR、实际安装/卸载、注册项清理或外部发布；不提前执行 owner 人工步骤。

执行状态为 active；产品 `stage_final_integration_revision=080c308ff511705bfd8ab21386a03d58ec311dcd`，2026-10-06 宿主 GitHub API 确认远端 dev 相同，fresh/refresh_method=none。T809 delivery/integration 仍 null。工作区三处合同准备文档变更不属于产品 source，执行记录须注明未提交状态。

T084 实现已集成；其验收责任由 T809 补验：U-01 数据/配置/LocalDate 连续性；U-02/03 私有鉴权与下载恢复；U-04 草稿/排空/明确确认/安装恢复；U-05 来源/产物/发布失败。自动化只证明相应层级，真实实装、owner 体验和真实故障未执行项继续 pending，T084 仍 active/partial。

`test:package-smoke` 源码包含同 appId 安装及自动卸载。当前合同未批准该环境且 T084 安装保留，故本次交接前不运行；不将暂时目录当作安装身份隔离，不记成功 skip。真实安装、失败矩阵和 package-smoke 环境待 owner 明确后执行。

### 2026-10-06 本地执行结果与人工入口交接

- 宿主 API 回验四项 PR 均已合并。最后 PR head 身份 T081=`e1412f790584b0b0c07ec8f1a25ae45aedb5b899`、T082=`d8b0d63a42a87c6a8d782a4cefb1f0ca295a3d7a`、T083=`91933e05debdbd0e091a885dcb7c31e880f58588`、T084=`e9b3923bac93c0d13b8c6d29f219dfd703e71c65`；integration 与 §4 一致。旧 task 账本 null 不被自动覆盖。
- 本轮 metadata、91 个定向 unit、33 个定向 integration、build、6 个定向 E2E 全部 exit 0。完整 verify exit 0：346 unit、163 integration passed/1 live AI skipped、37 E2E passed/5 installed skipped；skip 不等于安装或人工通过。
- 本地 `package --publish never` exit 0，artifact `.tmp/evidence/T809-package-080c308ff511-20261005162726.json`；本地重打 0.1.4 SHA-256=`48fd7d9ce4b272e520377bba4f073e11680e7bec44e16aa056212624e25b0c61`，NotSigned。它与已发布目标包是不同字节的构建产物，只证明阶段打包，不发布或替代 feed 包。
- A/B/C 文件回读 hash 与 EV-T084-002 相符，A/B 另存 ignored 交接目录防止打包输出混淆；已有 C bundle 五资产 validate exit 0，latest Release 403104108、tag/source=a575976 未变。C 的 src/package/lock/builder/electron.vite 内容与最终阶段 source 无差异；人工适用性是产品内容等价推断，不是新版实装通过。
- 沙箱定向 unit exit 1（realpath EPERM）及 bundle validate exit 1 保留。相同 argv 宿主重跑成功，限定 supersedes 环境失败；bundle 的环境原因属于由宿主成功推断，不声称命令输出已详细诊断。全部十个 wrapper JSON 已回读，source/base 均为 080c308，capture complete。
- 执行事实、需求责任/失败矩阵与相对 artifact 清单：[本地审计](../../.tmp/evidence/T809-manual/AUDIT.md)；版本/hash、环境先决条件、凭据与正常入口、人工步骤/预期及回报表：[人工交接单](../../.tmp/evidence/T809-manual/HANDOFF.md)。这些为本地操作记录，未替代正式 Evidence 账本。
- 实际宿主预检：MyTracer 进程 0、HKCU 卸载注册项 0、默认安装目录不存在、默认数据目录存在；未读取默认数据或 token，未清理旧临时安装。此预检不授予当前账户安装或覆盖默认数据权限。
- 当前停止点为 owner 明确隔离安装环境并亲自完成 B→C；package-smoke、真实故障矩阵、独立 review、T809 candidate/final-head CI、文档收口与 Git 交付继续 pending。没有新 branch/commit/PR/CI、安装、迁移、外部发布或产品改动；无冻结需求冲突。恢复前再次核验 dev、source、包与 feed。

### 2026-10-06 Owner 人工结果

Owner 明确报告：“在 D:\MyApps\MyTracer 下进行的安装&更新操作大获成功，测试点全部通过。”这是 owner 自行执行并报告的结果，不是 Agent 代签或自动化观察。

本次报告对应上一条简明九步操作：从提供的 0.1.3 包安装、正常入口启动与私有凭据检查、建立测试数据并重开、应用内发现/下载 0.1.4、未保存目标输入阻断并保留、处理后确认重启安装、完成向导、新版显示 0.1.4、原数据/日期保留、新增记录重开仍在及正常入口再次检查最新稳定版。上述人工观察按 owner 报告记通过；此前该人工链路的 waiting-owner 已解除。

上一条简明操作未要求实测包 hash、全字段导出/关联逐项比对、加密配置、A→B、真实故障矩阵或详细 unsigned 提示，不能将“全部测试点”扩大到这些条件。包/hash 绑定沿用已核验交接输入，实际运行包未由本次报告独立回读；产品等价推断及其边界见前段。数据/缓存实际根与 Windows 身份隔离没有完整记录，不由安装目录推导已经证明。

package-smoke、完整实装证据缺口、真实故障矩阵、独立 review、T809 candidate/final-head CI、文档收口与 Git 交付仍分别 pending。保留历史等待和失败记录；不授权 Agent 访问安装数据、运行安装/卸载或清理，也不据此声明 S8 整体通过或发布。简明人工报告另存 `.tmp/evidence/T809-manual/OWNER_RESULT.md`。

### 2026-10-06 后续执行准备

Owner 明确“本次交接完毕，进行后续步骤吧”。继续现有聚合范围的只读事实核验与可审查材料准备；§11 中 branch/commit/push/Draft PR 的 false 及收口/实际安装等独立门禁仍需具体激活。

宿主 API 再验 dev=080c308、latest Release=403104108/v0.1.4/source=a575976，均未变化。只读检查 owner 所报安装目录中的程序资源，不访问用户数据库、配置、凭据或运行应用：ProductVersion=0.1.4.0、FileVersion=0.1.4、NotSigned；exe SHA-256=f789c545000a8a98aa42827dd2c758be38872cf5a4910df1101698cd48277cb8。已安装与本地 stage 的 app.asar 整体 hash 不同；package.json 与 out 下全部五个程序文件逐项 hash 完全一致，记录 `.tmp/evidence/T809-manual/installed-program-comparison.json`。未比较全部依赖/原生模块，不证明原始下载 installer hash。首轮零文件比较无效及路径错误保留，最终非空比较通过；不把无效产物当成功。

精确文档影响矩阵、剩余条件与建议权限在 `.tmp/evidence/T809-manual/NEXT_STEPS.md`，Draft PR 正文草案在同目录 `DRAFT_PR_BODY.md`。规范文档收口未应用，尚未创建分支/提交/PR，不代签独立 review 或完整阶段通过。

### 2026-10-06 后续权限激活

Owner 对已呈交的精确文档清单、一个只读子 Agent 独立评审、本地任务分支/普通提交推送/dev Draft PR 及 CI 明确回复“批准”。§11 对应四项 Git 权限现激活；保留现有工作区改动，使用 task/T809-s8-final-acceptance，不创建额外 worktree。允许 §5 所列事实性文档收口与 Draft PR 正文更新，不声称完整验收候选通过；实际安装/卸载/清理、真实故障演练、Ready/merge/main/tag/release、依赖/迁移仍未授权。external_write 仅例外允许本任务分支 push 与 dev Draft PR，其余 false。早期及后续文档 head CI 分别记录，不凭 CI 成功解除剩余验收条件。

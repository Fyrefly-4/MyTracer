# MyTracer v0.1 任务索引

> 文档状态：v0.1 实施任务基线  
> 当前阶段：S0～S3 已完成并形成 `v0.1.0-beta.1` 里程碑；T041～T052 已集成至 `dev@84b596e12e54db098857004497a4d1964dcdc23c`；T806 已由 PR #43 集成（历史任务状态仍保留 `review`）；T061～T063 已集成至 `dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9`；T807 已由 PR #49 集成（历史任务状态仍保留 `review`）；T072 交付结果见 EV-T072-001
> 状态来源：本文件是任务执行状态的唯一账本，架构实施计划只定义范围和顺序

## 1. 使用规则

- 每个任务必须从 [`TASK_TEMPLATE.md`](TASK_TEMPLATE.md) 形成独立任务合同后才能进入 `active`。
- 任务必须引用 [`IMPLEMENTATION_PLAN_V0.1.md`](../architecture/IMPLEMENTATION_PLAN_V0.1.md) 中的切片，并列出直接相关的 FR/AC/D/ED。
- 流程治理或纯文档任务可以使用 `GOV-*` plan item，并在合同中明确没有产品 FR/AC 变化及其替代授权依据。
- `done` 只表示实现和规定验证已经完成；项目所有者尚未执行的人工验收必须单独标为 `pending`。
- 真实验证记录写入 [`ACCEPTANCE_EVIDENCE_V0.1.md`](ACCEPTANCE_EVIDENCE_V0.1.md)，不得把本表状态当作证据。
- Git 和 GitHub 操作遵循 [`GITHUB_WORKFLOW_V0.1.md`](GITHUB_WORKFLOW_V0.1.md)。
- 任务状态变化时只更新本表，不在 README、PRD 或架构正文中维护第二份执行状态。

## 2. 状态定义

| 状态      | 含义                                           |
| --------- | ---------------------------------------------- |
| `blocked` | 缺少批准、前置任务或外部条件，不能安全启动     |
| `pending` | 尚未到执行顺序，前置条件未全部满足             |
| `ready`   | 输入、批准、任务合同和环境均已满足，可启动     |
| `active`  | 一个 Agent 正在按已批准合同执行                |
| `review`  | 实现完成，等待独立评审、CI 或项目所有者处理    |
| `done`    | 自动验证和要求的验收证据完整，且没有未报告缺口 |

同一时间默认只有一个业务实现任务为 `active`。确需并行时，各任务必须拥有独立 worktree、非重叠文件/迁移范围和独立验证入口。

## 3. 当前门禁

- T001～T004 的历史范围、批准、PR、验证和限制已统一归档于 [`archive/S0_T001_T004_ARCHIVE.md`](archive/S0_T001_T004_ARCHIVE.md)，详细结果见 `EV-T001-001`～`EV-T004-001`。
- G2 已由项目所有者于 2026-08-09 确认通过，证据为 `EV-G2-001`；里程碑 PR #5 已将 T001～T004 从 `dev` 合入 `main`，并发布 `v0.1.0-alpha.1`。
- T011～T014 与门禁修复 T801 的最终范围、批准、PR、验证和限制已由 PR #13 收敛为统一归档 [`archive/S1_T011_T014_ARCHIVE.md`](archive/S1_T011_T014_ARCHIVE.md) 并合入 `dev`；详细结果见 `EV-T011-001`～`EV-T014-001`、`EV-T801-001` 与 `EV-AC01-001`。
- G3/S1 的首轮失败和 T801 修复结果均保留在 `EV-G3-S1-001`、`EV-G3-S1-002`；当前阶段状态不在本节重复展开。
- T021～T023 的最终范围、批准、PR、验证和限制已由 T802 PR #20 收敛为统一归档 [`archive/S2_T021_T023_ARCHIVE.md`](archive/S2_T021_T023_ARCHIVE.md) 并合入 `dev`；原合同仅从 Git 历史恢复。
- T802 的 partial 候选和最终聚合结果分别由 `EV-T802-001`、`EV-T802-002` 保留；最终验收基线为 `dev@a9db1eb26134dac83b01f4a4d7da30f92a271242`。
- T031～T033/T803 的最终范围和结果已由 [`archive/S3_T031_T033_ARCHIVE.md`](archive/S3_T031_T033_ARCHIVE.md) 唯一收敛；S3 已发布 `v0.1.0-beta.1`，完整人工 AC-07 为 `pass`，失败和历史证据仍保留。
- T090～T093、T804 的完整治理合同已收敛至 [`archive/GOVERNANCE_T090_T093_T804_ARCHIVE.md`](archive/GOVERNANCE_T090_T093_T804_ARCHIVE.md)；T803 不在此重复归档。
- T093 已由 PR #33 合入当前 `dev@2b31bc6be50d805f0dcad73a7a64cc3735a05d09`；post-merge Verification run `32954788941` 的 required checks 通过，补充事实见 `EV-T093-002`。
- T805 已由 PR #34 final head `979fa1cd11da9c0e4a28e6c37e63a3e8e695c95f` 的 required CI 验证，并合入 `dev@353a4d42921175374dec178a75ad2748eb184cdf`；最终事实见 `EV-T805-002`。
- T094 实现 Candidate `543180b85960334808563af49d0aa96caab31b00` 已通过本地完整验证、Windows package smoke 和独立复核；PR #35 final-head `e2d75b16c142057ab43e600ae3d010464f9adf13` 的 required CI 通过，并由项目所有者合入 `dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3`。任务结果见 `EV-T094-001`。
- T041 task delivery revision `1e9ab2b80b5b81a8bedd192750281d4042f279d5` 已通过本地完整验证、独立只读复核、PR #39 implementation-candidate required CI 和项目所有者人工测试；任务结果见 `EV-T041-001`。PR #39 final head `64ac9dddd41413c22b0ec35f99ed9022d1555e25` 已由项目所有者合入为 `dev@695e7bcc25b33279d39e61e28a8730b9cdf16264`，T042 已启动。
- T042 task delivery revision `b323a9f629699cbec156723700c021151eaf1506` 已通过本地完整验证、完整 diff/独立只读 review、PR #40 implementation-candidate required CI 和项目所有者完整人工 AC-05；任务结果见 `EV-T042-001`。PR #40 已合入 `dev@3f343b8af0216b5e568f2c8f1ed52ac4ef824da3`；S4 owner gate 尚未单独决定，但项目所有者已明确允许进入 S5 并激活 T051。
- T051 task delivery revision `eccd00148ac6ca47f3215e03abffb98a732c2558` 已通过本地完整验证、完整 diff/独立只读 review、PR #41 required CI 和项目所有者人工 AC-06 步骤 1，并已集成至 `dev@3e5a14f1b5f90894e1e15a4b208aa5db254e7825`；任务结果见 `EV-T051-001`。T052 task delivery revision `7aced4fa3146ebb5d0bcf28b7dbc81e5b40e2cb2` 的本地/hosted 自动化、完整 diff/独立 review、完整人工 AC-06 与 owner-approved docs closeout 已通过，并由 PR #42 集成至 `dev@84b596e12e54db098857004497a4d1964dcdc23c`；结果见 `EV-T052-001`。
- S4 前工程治理与 UI Foundation 聚合不登记为新任务；固定产品 source `dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3`，范围为 T804、T092、T093、T805、T094。该 revision 的治理 metadata、AC-01/03/04/07 定向回归、完整 `verify`、Windows package/unpacked/隔离 NSIS smoke 与 `main..dev` 独立 review 已通过，候选证据见 `EV-PRE-S4-FOUNDATION-001`；人工视觉对比和聚合文档 PR 的 final-head hosted CI 分别记录，不由本地 candidate 代替。
- T806 是项目所有者于 2026-08-30 另行指定并批准激活的 S4/S5 聚合验收任务，固定产品 source 为 `dev@84b596e12e54db098857004497a4d1964dcdc23c`。本地 Unit/Integration/E2E、完整 `verify`、package 与修复后的 package smoke 已通过；PR #43 candidate run `33314322219` 仅因 hosted migration 用例超过默认 5 秒失败。项目所有者授权单用例 30 秒 test-only 窄修复及直接 docs closeout，修改后不再本地测试。历史任务状态保留 `review`；后续 final head run `33323763973` 已成功，PR #43 已集成 `1d02fd7a0a7b0bf29a5e39720d5818c9d68fdbc2`；归档见 [`archive/S4_S5_T041_T052_ARCHIVE.md`](archive/S4_S5_T041_T052_ARCHIVE.md)，聚合事实见 `EV-S4-S5-001`。
- T061 task delivery revision `5f98b2f61026721f22fe6cd627c3b402678e9a93` 已通过 targeted/affected/完整 `verify`、完整 diff/独立 review、candidate CI、项目所有者人工测试和 owner-approved docs closeout；失败 run `33354175786` 由 final head `d60978917546f6547a1615c6aa03e87d08c0d2ce` 的成功 run `33355327790` supersede。PR #46 已 squash merge 为 `dev_integration_revision=4630878dacd0a15dbe8446cb26d9cea790d3ed6e`，post-merge run `33355939824` 成功；任务为 `done`，结果见 `EV-T061-001`。T061 自身不声明 T062/T063、AC-02 或 S6 final gate；后续状态见 T807。
- T062 task delivery revision `bc5461e3bcc4e0ca94abbffe9ef2f898c7bbc4a9` 已通过本地 targeted/affected/完整 `verify`、Windows package smoke、完整 diff/独立 review 和 PR #47 candidate run `33379861872`；final head `a458171be3504492a5c581b595f272c1e1e0e097` 的 run `33381804748` 成功，并 squash merge 为 `dev_integration_revision=233d6790c6c5e11bb454b22eb027443eef54a01e`，post-merge run `33382653020` 成功。项目所有者已人工复核上述收口事实；结果见 `EV-T062-001`。
- T063 task delivery revision `fee398e08ef687bd75d9dae10e6254f09e7c9896` 已通过本地 targeted/affected/完整 `verify`、Windows package/unpacked/隔离 NSIS smoke、完整 diff/独立 review和 PR #48 implementation-candidate run `33470990276`。docs closeout final head `2e3fc746fcafbe67a0c4a3bc24671e6a50c2ac94` 的失败 run `33474459495` 由同 revision 的成功重跑 `33475609355` supersede；PR #48 已 squash merge 为 `dev_integration_revision=f06b1e97da07dffc05814518ad8ad83ed3e051b9`，post-merge run `33476194961` 成功。任务为 `done`；项目所有者已在 T807 固定产品内容和边界修复上报告完整人工 AC-02 通过，结果见 `EV-T063-001` 与 `EV-T807-001`。
- T807 是项目所有者于 2026-09-01 批准并激活的 S6 聚合验收与发布准备任务，固定产品 source 为 `dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9`。Coverage Gate 缺口和三项独立审查边界问题均按 owner-approved 窄范围修复；`task_delivery_revision=449ad4f36ffbace59e19f55c53fa4ce9dcb02b4c` 的 hosted run `33599620345`、package、再次独立 review 和项目所有者完整人工 AC-02/真实 UI + LiteLLM 体验均通过。专用自动 live contract 因 5 秒 harness timeout 未形成通过证据，但未证明 Provider 失败。项目所有者已批准统一归档和文档收口；历史任务状态保留 `review`；后续 final head run `33955746084` 已成功，PR #49 已集成 `fa3ac0a2ac9ec0854615478a14886d764f21c3fc`。本次不代签历史任务 done 或发布。归档见 [`archive/S6_T061_T063_ARCHIVE.md`](archive/S6_T061_T063_ARCHIVE.md)，聚合事实见 `EV-T807-001`。

## 4. 任务总表

| Task | Slice        | 范围                                                                                        | 主要需求/决定                                                        | 前置                          | 状态      | 证据                         |
| ---- | ------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------- | --------- | ---------------------------- |
| T001 | E0-01        | Electron 骨架与 Main/Preload/Renderer 边界                                                  | D-001/003/015～017；ED-001/002/004/019                               | 依赖批准                      | `done`    | `EV-T001-001`                |
| T002 | E0-02        | 验证工具链、FakeClock/FakeAiProvider、临时数据根                                            | Test Strategy §3/9；GW-008                                           | T001、测试工具批准            | `done`    | `EV-T002-001`                |
| T003 | E0-03        | SQLite、初始 schema、migration、Repository 契约                                             | FR-D01；D-103/106/111；ED-003/018                                    | T001～T002                    | `done`    | `EV-T003-001`                |
| T004 | E0-04        | LocalDate、诊断、配置、safeStorage 空边界、Windows 打包冒烟                                 | ED-010/017/019                                                       | T001～T003                    | `done`    | `EV-T004-001`                |
| T011 | E1-01        | Goal 生命周期和当前下一步                                                                   | FR-G01～G06；D-002/101；ED-005；AC-01                                | G2（已通过）                  | `done`    | `EV-T011-001`                |
| T012 | E1-02        | Action、Today focus、取消/完成/重新安排                                                     | FR-A01～A06；FR-T01/04/05/08；ED-006/007；AC-01                      | T011（已完成）                | `done`    | `EV-T012-001`                |
| T013 | E1-03        | 快速/深入 ActionRecord                                                                      | FR-A05；FR-A08（T013 部分）；FR-L01～L06/L08；FR-C01；D-006/103～106 | T012                          | `done`    | `EV-T013-001`                |
| T014 | E1-04        | 基础 Progress 投影                                                                          | FR-P01～P04/P07/P08；FR-C03；D-007                                   | T013                          | `done`    | `EV-T014-001`                |
| T021 | E2-01        | Routine 生命周期和星期节奏                                                                  | FR-R01～R03；FR-T02；ED-006/009                                      | S1                            | `done`    | `EV-T021-001`                |
| T022 | E2-02        | Routine 五态、unknown 和非计划日事实                                                        | FR-R04～R09；D-008～010/107；AC-03                                   | T021                          | `done`    | `EV-T022-001`                |
| T023 | E2-03        | 通用非强制意向                                                                              | FR-A07；FR-T03/T08；D-011；AC-04                                     | T021                          | `done`    | `EV-T023-001`                |
| T031 | E3-01        | 修改、补记、删除影响预览和事务                                                              | FR-L07；FR-R08；FR-D02；ED-008                                       | S1/S2                         | `done`    | `EV-T031-001`                |
| T032 | E3-02        | UTF-8 JSON 完整导出和引用检查                                                               | FR-D03/D04；D-111；ED-014；AC-07                                     | T031                          | `done`    | `EV-T032-001`                |
| T033 | E3-03        | AI 关闭/未配置/失败时的数据能力回归                                                         | FR-D05；FR-AI09；D-015                                               | T032                          | `done`    | `EV-T033-001`                |
| T041 | E4-01        | RecoveryContext 查询                                                                        | FR-REC01～REC03；D-002                                               | S1、T094                      | `done`    | `EV-T041-001`                |
| T042 | E4-02        | 清理过时内容并重新开始                                                                      | FR-REC04～REC06；FR-P04；D-013；AC-05                                | T041                          | `done`    | `EV-T042-001`                |
| T051 | E5-01        | 周期事实摘要                                                                                | FR-RV01/RV06；D-106；AC-06                                           | S2/S3                         | `done`    | `EV-T051-001`                |
| T052 | E5-02        | ReviewResult 和下一阶段调整                                                                 | FR-RV02～RV05；D-105/110                                             | T051                          | `done`    | `EV-T052-001`                |
| T061 | E6-01        | AI 最小上下文选择器和隔离证明                                                               | FR-AI01/03/08/10；D-108；ED-011                                      | S1/S3；dev@1342cd7           | `done`    | `EV-T061-001`                |
| T062 | E6-02        | 可替换 Provider、超时和失败降级                                                             | FR-AI02～AI04/AI07/AI09；D-012/013/015                               | T061、Provider 批准           | `done`    | `EV-T062-001`                |
| T063 | E6-03        | AI 建议接受/修改/拒绝和确认命令                                                             | FR-AI05/06；FR-C02/C03；D-014/109；AC-02                             | T062                          | `done`    | `EV-T063-001`                |
| T071 | S7           | [11 条 SHOULD 的既定处理结论](T071_SHOULD_CONVERGENCE.md)                                    | Traceability §3；Implementation §10.1                                | S1～S6                        | `done`  | `EV-T071-001`                |
| T072 | S7           | [全量回归、AC-01～AC-07、Windows Demo 收敛](T072_DEMO_CONVERGENCE.md)                         | 全部 MUST/AC；Test Strategy §7～10                                   | T071                          | `done` | `EV-T072-001` |
| T081 | S8-A         | [Windows 原位升级与数据保留基线](T081_IN_PLACE_UPGRADE_BASELINE.md)                           | U-01；FR-D01～D05；AC-07；ED-018；S8 设计 §4                         | 最新授权 dev 与获批 Windows 账户 | `done` | `EV-T081-001`；PR #57 已进入 `dev@0724cbb`，owner 确认遗留缺口完成 |
| T082 | S8-B         | [私有源版本检查与下载](T082_PRIVATE_UPDATE_CHECK_DOWNLOAD.md)                                 | U-02/03；S8 设计 §4                                                 | T081                          | `done` | `EV-T082-001`；approved-2 将真实私有源、最终发布包及安装版人工体验交 T084，仍待验证 |
| T083 | S8-C         | [确认安装与退出协调](T083_CONFIRM_INSTALL_SHUTDOWN.md)                                        | U-04；S8 设计 §4                                                    | T082                          | `active` | 合同已批准并激活；产品开发尚未开始 |
| T084 | S8-D         | 发布流程与阶段验收（实施合同待创建）                                                          | U-01～05；S8 设计 §4                                                | T081～T083                    | `pending` | — |
| T090 | GOV-01       | V2 Agent 流程第一、二批文档规范                                                             | GW-001/002/004/005/006/009/010；T090 合同                            | dev@112b909                   | `done`    | `EV-T090-001`                |
| T091 | GOV-02       | V2 第三批确定性证据采集、CI artifact 和 metadata 校验                                       | V2 Batch 3；GW-001/002/004/008/009/010；T091 合同                    | T090；dev@aeb0d68             | `done`    | `EV-T091-001`                |
| T092 | GOV-04       | 定义 Standard Task Automation Profile、Workflow 优化目标与基础 metadata 校验                | GW-001/002/004/008～010；不改变 FR/AC/D                              | T090、T091、T804；dev@d00a0b3 | `done`    | `EV-T092-001`                |
| T093 | GOV-05       | 串行接入 Profile、三项项目 Skill、PR/CI 自动化、统一 Gate、ruleset context 与长任务等待策略 | GW-001/002/004～006/008～010；不改变 FR/AC/D                         | T092；dev@2b31bc6；阻塞 T041  | `done`    | `EV-T093-001`、`EV-T093-002` |
| T094 | G4 enabling  | Structural UI Refactor：拆分 Renderer ownership，不改变行为、文案或视觉                     | AC-01/03/04/07 回归；D-003～011/015/016；ED-001/002/004/012/019      | T033、T093、T805；阻塞 T041   | `done`    | `EV-T094-001`                |
| T801 | S1 fix       | 更新 Windows package smoke 的 S1 窄 API 契约并重新验证 unpacked/NSIS                        | G3/S1；GW-008/010；不改变 FR/AC/D/ED                                 | `EV-G3-S1-001`                | `done`    | `EV-T801-001`                |
| T802 | S2 fix       | 修复 package smoke、完整连续 E2E-AC-03、既有 S1 v1 数据守恒与 T021～T023 合同归档           | AC-03；FR-D01 S2 子集；GW-008/010；不改变生产语义                    | S2 聚合验收失败与独立 review  | `done`    | `EV-T802-002`                |
| T803 | S3 aggregate | 聚合验收 T031～T033、AC-07、package/重开/导出/AI 三态并归档 S3 合同                         | AC-07；FR-D01～D05；GW-008/010；不改变生产语义                       | T031～T033、T090、T091        | `done`    | `EV-G3-S3-001`               |
| T804 | GOV-03       | 统一收口长期文档中的任务、里程碑、tag/release 与 GitHub 配置事实                            | GW-001/002/004/008～010；不改变 FR/AC/D/ED                           | T803、T091                    | `done`    | `EV-T804-001`                |
| T805 | GOV-06       | 收敛 `/docs` 文档冗余、归档已完成治理合同并限定历史快照边界                                 | GW-001/003/004/009/010；不改变 FR/AC/D/ED                            | T090～T093、T804；dev@2b31bc6 | `done`    | `EV-T805-001`、`EV-T805-002` |
| T806 | S4/S5 aggregate | 聚合验收 T041～T052、AC-05/06、package、migration/export、证据与合同归档                  | FR-REC01～REC06；FR-RV01～RV06；AC-05/06；AC-01/03/04/07 回归       | T041、T042、T051、T052        | `review`  | `EV-S4-S5-001`；final-head CI / 集成已补记 |
| T807 | S6 aggregate    | 聚合验收 T061～T063、完整 AC-02、AI 隔离、package、证据收口与里程碑准备                   | FR-AI01～AI10；FR-C02/C03；AC-02；AC-01/03/04/05/06/07 回归         | T061、T062、T063              | `review`  | `EV-T807-001`（final-head CI / 集成已补记）    |

## 5. 阶段门与主线合并

| 阶段门            | 任务范围                 | 通过后 GitHub 动作                                                                          |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| G2 工程就绪       | T001～T004               | PR #5 合入 `main@7cc047e...`；`v0.1.0-alpha.1` 已发布                                       |
| G3/S1 核心闭环    | T011～T014/T801          | PR #14 合入 `main@3912e80...`；`v0.1.0-alpha.2` 已发布                                      |
| G3/S2 例行与意向  | T021～T023/T802          | PR #22 合入 `main@581e443...`；`v0.1.0-alpha.3` 已发布                                      |
| G3/S3 数据安全    | T031～T033/T803          | PR #30 合入 `main@75e51b4...`；`v0.1.0-beta.1` 已发布                                       |
| S4 前工程/UI 基线 | T804/T092/T093/T805/T094 | `dev@2632ff0...` 本地聚合 candidate 通过；文档 final-head CI 与 `dev -> main` Draft PR 另记 |
| S6 AI 启动帮助    | T061～T063/T807          | 固定 `dev@f06b1e9...` 自动与人工 AC-02 已通过；后续文档 final-head CI 与 dev 集成已补记；发布独立审批 |
| G4 Demo 就绪      | T094、T041～T072         | 全量验收后再决定 `rc.1` 或 `v0.1.0`；不自动授权发布                                         |
| S8 原位升级与维护 | T081～T084              | T081 已进入 `dev`；T082 B 节点结果及 T084 待验证交接见 `EV-T082-001`；后续节点按独立合同串行集成 |

阶段门不会因任务表显示 `done` 自动通过；必须满足开发流程中的自动化和人工验收要求。

## 6. 任务拆分规则

- 若一个任务无法在一个聚焦 PR 中完成，可拆为 `Txxx-A`、`Txxx-B`，但父任务仍负责完整验收。
- 不为了技术层整齐把一个纵向行为拆成无法独立验证的长期分支。
- 数据 migration 任务默认串行，不与修改相同表结构的任务并行。
- 修复使用原任务号的后续 PR，或创建 `T8xx` 缺陷任务并引用发现它的证据。
- 新产品想法不直接加入本表；先按需求变更规则分类和批准。

## 7. 当前结论

- 当前任务状态以本表任务总表为唯一来源，具体验证以 Evidence 账本为准；归档文档只提供历史导航和最小有效事实。
- S0～S3 均已完成并形成 `v0.1.0-beta.1`；T041/T042/T051/T052 已分别形成完整人工 AC-05/AC-06 task candidate；T061～T063 已集成，T807 已形成固定 S6 产品内容上的自动与人工 AC-02 candidate。T807 后续进入 dev 的事实已补记；T072 已形成自动与人工验收候选，不自动声明 G4、Ready、main、tag 或 Release。
- T041～T052 的 Recovery/Review 最终范围、revision、PR、兼容契约与恢复入口已统一归档于 [`archive/S4_S5_T041_T052_ARCHIVE.md`](archive/S4_S5_T041_T052_ARCHIVE.md)。四任务均进入固定产品 source `dev@84b596e12e54db098857004497a4d1964dcdc23c`，任务 Evidence 与完整人工 AC-05/06 保留；T806 后续 final-head CI 与 dev 集成见 EV-S4-S5-001，main 晋升不由本记录授权。
- T061～T063 的 AI Start Help 最终范围、revision、PR、信任边界与恢复入口已统一归档于 [`archive/S6_T061_T063_ARCHIVE.md`](archive/S6_T061_T063_ARCHIVE.md)。三个任务均进入固定产品 source `dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9`；T807 后续 final-head CI 与 dev 集成见 EV-T807-001，main 晋升不由本记录授权。
- T090～T093、T804 的完整合同和 T803 的聚合合同均已按阶段/治理归档，失败、partial 和历史候选 Evidence 继续保留。
- T094 只完成 Structural UI Refactor；它未实现 T041、S4～S7，也未改变产品语义、依赖、migration、IPC 或发布权限。S4 前聚合验收不等于 G4、AC-02/05/06、tag 或 release 完成，`dev -> main` merge 仍由项目所有者针对确切 PR 决定。

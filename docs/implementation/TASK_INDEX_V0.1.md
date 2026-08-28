# MyTracer v0.1 任务索引

> 文档状态：v0.1 实施任务基线  
> 当前阶段：S0～S3 已完成并形成 `v0.1.0-beta.1` 里程碑；当前 `dev@22ee97bd9ded88e6e9e025d3afc0c6831d43240c` 已包含 S4 前工程/UI 基线与获批 S4/S5 设计；T041 已由项目所有者激活并进入 `active`
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
- S4 前工程治理与 UI Foundation 聚合不登记为新任务；固定产品 source `dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3`，范围为 T804、T092、T093、T805、T094。该 revision 的治理 metadata、AC-01/03/04/07 定向回归、完整 `verify`、Windows package/unpacked/隔离 NSIS smoke 与 `main..dev` 独立 review 已通过，候选证据见 `EV-PRE-S4-FOUNDATION-001`；人工视觉对比和聚合文档 PR 的 final-head hosted CI 分别记录，不由本地 candidate 代替。
- 首个 AI Provider、模型和 SDK 只阻塞 T062，不阻塞 S0～S5 的非 AI 能力。

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
| T041 | E4-01        | RecoveryContext 查询                                                                        | FR-REC01～REC03；D-002                                               | S1、T094                      | `active`  | —                            |
| T042 | E4-02        | 清理过时内容并重新开始                                                                      | FR-REC04～REC06；FR-P04；D-013；AC-05                                | T041                          | `pending` | —                            |
| T051 | E5-01        | 周期事实摘要                                                                                | FR-RV01/RV06；D-106；AC-06                                           | S2/S3                         | `pending` | —                            |
| T052 | E5-02        | ReviewResult 和下一阶段调整                                                                 | FR-RV02～RV05；D-105/110                                             | T051                          | `pending` | —                            |
| T061 | E6-01        | AI 最小上下文选择器和隔离证明                                                               | FR-AI01/03/08/10；D-108；ED-011                                      | S1/S3                         | `pending` | —                            |
| T062 | E6-02        | 可替换 Provider、超时和失败降级                                                             | FR-AI02～AI04/AI07/AI09；D-012/013/015                               | T061、Provider 批准           | `pending` | —                            |
| T063 | E6-03        | AI 建议接受/修改/拒绝和确认命令                                                             | FR-AI05/06；FR-C02/C03；D-014/109；AC-02                             | T062                          | `pending` | —                            |
| T071 | S7           | 11 条 SHOULD 的既定处理结论                                                                 | Traceability §4；Implementation §10.1                                | S1～S6                        | `pending` | —                            |
| T072 | S7           | 全量回归、AC-01～AC-07、Windows Demo 收敛                                                   | 全部 MUST/AC；Test Strategy §7～10                                   | T071                          | `pending` | —                            |
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

## 5. 阶段门与主线合并

| 阶段门            | 任务范围                 | 通过后 GitHub 动作                                                                          |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| G2 工程就绪       | T001～T004               | PR #5 合入 `main@7cc047e...`；`v0.1.0-alpha.1` 已发布                                       |
| G3/S1 核心闭环    | T011～T014/T801          | PR #14 合入 `main@3912e80...`；`v0.1.0-alpha.2` 已发布                                      |
| G3/S2 例行与意向  | T021～T023/T802          | PR #22 合入 `main@581e443...`；`v0.1.0-alpha.3` 已发布                                      |
| G3/S3 数据安全    | T031～T033/T803          | PR #30 合入 `main@75e51b4...`；`v0.1.0-beta.1` 已发布                                       |
| S4 前工程/UI 基线 | T804/T092/T093/T805/T094 | `dev@2632ff0...` 本地聚合 candidate 通过；文档 final-head CI 与 `dev -> main` Draft PR 另记 |
| G4 Demo 就绪      | T094、T041～T072         | 全量验收后再决定 `rc.1` 或 `v0.1.0`；不自动授权发布                                         |

阶段门不会因任务表显示 `done` 自动通过；必须满足开发流程中的自动化和人工验收要求。

## 6. 任务拆分规则

- 若一个任务无法在一个聚焦 PR 中完成，可拆为 `Txxx-A`、`Txxx-B`，但父任务仍负责完整验收。
- 不为了技术层整齐把一个纵向行为拆成无法独立验证的长期分支。
- 数据 migration 任务默认串行，不与修改相同表结构的任务并行。
- 修复使用原任务号的后续 PR，或创建 `T8xx` 缺陷任务并引用发现它的证据。
- 新产品想法不直接加入本表；先按需求变更规则分类和批准。

## 7. 当前结论

- 当前任务状态以本表任务总表为唯一来源，具体验证以 Evidence 账本为准；归档文档只提供历史导航和最小有效事实。
- S0～S3 均已完成并形成 `v0.1.0-beta.1`；这不表示 G4、AC-02/05/06、自动导入/恢复、AI Provider 或 S4～S7 已完成。
- T805 已合入 `dev@353a4d42921175374dec178a75ad2748eb184cdf` 并由 `EV-T805-002` 收口；T094 已由 `EV-T094-001` 证明 Structural UI Refactor 完整任务交付并进入 `dev@2632ff0638fb02533100a1f9d0aea9f1323dbde3`。S4 前聚合 candidate 由 `EV-PRE-S4-FOUNDATION-001` 绑定同一产品 source；T041 的结构前置与独立合同已满足，项目所有者已授权其在 `task/T041-recovery-context` 上启动，尚无实现或验收完成声明。
- T090～T093、T804 的完整合同和 T803 的聚合合同均已按阶段/治理归档，失败、partial 和历史候选 Evidence 继续保留。
- T094 只完成 Structural UI Refactor；它未实现 T041、S4～S7，也未改变产品语义、依赖、migration、IPC 或发布权限。S4 前聚合验收不等于 G4、AC-02/05/06、tag 或 release 完成，`dev -> main` merge 仍由项目所有者针对确切 PR 决定。

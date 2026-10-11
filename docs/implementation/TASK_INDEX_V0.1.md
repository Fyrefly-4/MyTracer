# MyTracer v0.1 任务索引

> 2026-10-11 事实校准：本表 done 表示相应合同交付已闭合；T809/S8 包含 owner-approved waiver，不代表所有真实测试通过。历史叙述统一从归档索引查找，后续结果以本表和 [EV-DOC-CALIBRATION-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001) 为准，不把历史 active/review 当作当前执行状态。

> 文档状态：v0.1 实施任务基线  
> 当前阶段：S0～S6 已形成历史里程碑与 beta.1～beta.3 发布；S7/S8 已通过 PR #62 晋升 main；owner tag 发布改造仅进入 dev。当前核验与完整 revision/CI 见 EV-DOC-CALIBRATION-001。
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

## 3. 交付与门禁历史

阶段范围、已批准的例外与完整文本恢复统一见[归档索引](archive/INDEX.md)。精确交付与最终 CI/main 晋升见[事实校准](ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)，其他历史命令与人工结果见[验收证据](ACCEPTANCE_EVIDENCE_V0.1.md)。本节不再重复各任务的交付叙述；任务状态仍由下表维护，历史失败与 owner waiver 不因归档改变。

## 4. 任务总表

| Task | Slice           | 范围                                                                                        | 主要需求/决定                                                        | 前置                                                        | 状态     | 证据                                                                                                                                                         |
| ---- | --------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T001 | E0-01           | Electron 骨架与 Main/Preload/Renderer 边界                                                  | D-001/003/015～017；ED-001/002/004/019                               | 依赖批准                                                    | `done`   | `EV-T001-001`                                                                                                                                                |
| T002 | E0-02           | 验证工具链、FakeClock/FakeAiProvider、临时数据根                                            | Test Strategy §3/9；GW-008                                           | T001、测试工具批准                                          | `done`   | `EV-T002-001`                                                                                                                                                |
| T003 | E0-03           | SQLite、初始 schema、migration、Repository 契约                                             | FR-D01；D-103/106/111；ED-003/018                                    | T001～T002                                                  | `done`   | `EV-T003-001`                                                                                                                                                |
| T004 | E0-04           | LocalDate、诊断、配置、safeStorage 空边界、Windows 打包冒烟                                 | ED-010/017/019                                                       | T001～T003                                                  | `done`   | `EV-T004-001`                                                                                                                                                |
| T011 | E1-01           | Goal 生命周期和当前下一步                                                                   | FR-G01～G06；D-002/101；ED-005；AC-01                                | G2（已通过）                                                | `done`   | `EV-T011-001`                                                                                                                                                |
| T012 | E1-02           | Action、Today focus、取消/完成/重新安排                                                     | FR-A01～A06；FR-T01/04/05/08；ED-006/007；AC-01                      | T011（已完成）                                              | `done`   | `EV-T012-001`                                                                                                                                                |
| T013 | E1-03           | 快速/深入 ActionRecord                                                                      | FR-A05；FR-A08（T013 部分）；FR-L01～L06/L08；FR-C01；D-006/103～106 | T012                                                        | `done`   | `EV-T013-001`                                                                                                                                                |
| T014 | E1-04           | 基础 Progress 投影                                                                          | FR-P01～P04/P07/P08；FR-C03；D-007                                   | T013                                                        | `done`   | `EV-T014-001`                                                                                                                                                |
| T021 | E2-01           | Routine 生命周期和星期节奏                                                                  | FR-R01～R03；FR-T02；ED-006/009                                      | S1                                                          | `done`   | `EV-T021-001`                                                                                                                                                |
| T022 | E2-02           | Routine 五态、unknown 和非计划日事实                                                        | FR-R04～R09；D-008～010/107；AC-03                                   | T021                                                        | `done`   | `EV-T022-001`                                                                                                                                                |
| T023 | E2-03           | 通用非强制意向                                                                              | FR-A07；FR-T03/T08；D-011；AC-04                                     | T021                                                        | `done`   | `EV-T023-001`                                                                                                                                                |
| T031 | E3-01           | 修改、补记、删除影响预览和事务                                                              | FR-L07；FR-R08；FR-D02；ED-008                                       | S1/S2                                                       | `done`   | `EV-T031-001`                                                                                                                                                |
| T032 | E3-02           | UTF-8 JSON 完整导出和引用检查                                                               | FR-D03/D04；D-111；ED-014；AC-07                                     | T031                                                        | `done`   | `EV-T032-001`                                                                                                                                                |
| T033 | E3-03           | AI 关闭/未配置/失败时的数据能力回归                                                         | FR-D05；FR-AI09；D-015                                               | T032                                                        | `done`   | `EV-T033-001`                                                                                                                                                |
| T041 | E4-01           | RecoveryContext 查询                                                                        | FR-REC01～REC03；D-002                                               | S1、T094                                                    | `done`   | `EV-T041-001`                                                                                                                                                |
| T042 | E4-02           | 清理过时内容并重新开始                                                                      | FR-REC04～REC06；FR-P04；D-013；AC-05                                | T041                                                        | `done`   | `EV-T042-001`                                                                                                                                                |
| T051 | E5-01           | 周期事实摘要                                                                                | FR-RV01/RV06；D-106；AC-06                                           | S2/S3                                                       | `done`   | `EV-T051-001`                                                                                                                                                |
| T052 | E5-02           | ReviewResult 和下一阶段调整                                                                 | FR-RV02～RV05；D-105/110                                             | T051                                                        | `done`   | `EV-T052-001`                                                                                                                                                |
| T061 | E6-01           | AI 最小上下文选择器和隔离证明                                                               | FR-AI01/03/08/10；D-108；ED-011                                      | S1/S3；dev@1342cd7                                          | `done`   | `EV-T061-001`                                                                                                                                                |
| T062 | E6-02           | 可替换 Provider、超时和失败降级                                                             | FR-AI02～AI04/AI07/AI09；D-012/013/015                               | T061、Provider 批准                                         | `done`   | `EV-T062-001`                                                                                                                                                |
| T063 | E6-03           | AI 建议接受/修改/拒绝和确认命令                                                             | FR-AI05/06；FR-C02/C03；D-014/109；AC-02                             | T062                                                        | `done`   | `EV-T063-001`                                                                                                                                                |
| T071 | S7 | [11 条 SHOULD 的既定处理结论](archive/S7_T071_T072_ARCHIVE.md#t071) | Traceability §3；Implementation §10.1 | S1～S6 | `done` | EV-T071-001；delivery 6b6fb5f / dev 2483504；final-head run 35417697381；EV-DOC-CALIBRATION-001 |
| T072 | S7 | [全量回归、AC-01～AC-07、Windows Demo 收敛](archive/S7_T071_T072_ARCHIVE.md#t072) | 全部 MUST/AC；Test Strategy §7～10 | T071 | `done` | EV-T072-001；delivery ba4c7ed / dev d8b211b；final-head milestone run 36450867255；EV-DOC-CALIBRATION-001 |
| T081 | S8-A            | [Windows 原位升级与数据保留基线](archive/S8_T081_T084_T809_ARCHIVE.md#t081)                         | U-01；FR-D01～D05；AC-07；ED-018；S8 设计 §4                         | 最新授权 dev 与获批 Windows 账户                            | `done`   | `EV-T081-001`；PR #57 已进入 `dev@0724cbb`，owner 确认遗留缺口完成                                                                                           |
| T082 | S8-B            | [私有源版本检查与下载](archive/S8_T081_T084_T809_ARCHIVE.md#t082)                               | U-02/03；S8 设计 §4                                                  | T081                                                        | `done`   | `EV-T082-001`；approved-2 将阶段实装责任交 T084/T809；后续正常更新与 owner 豁免结果见 EV-S8-001                                                                          |
| T083 | S8-C            | [确认安装与退出协调](archive/S8_T081_T084_T809_ARCHIVE.md#t083)                                      | U-04；S8 设计 §4                                                     | T082                                                        | `done`   | `EV-T083-001`；owner 批准 §9.5 替代验收和收口；后续正常应用内升级已回报，剩余实装矩阵获豁免，见 EV-S8-001                                                                          |
| T084 | S8-D | [私有发布流程与阶段验收](archive/S8_T081_T084_T809_ARCHIVE.md#t084) | U-01～05；S8 设计 §4 | T081～T083 | `done` | EV-T084-001/002；PR #60 final-head CI 与 dev 集成已核验；剩余阶段实装责任由 T809 的 owner 明确豁免闭合，未执行风险保留；EV-DOC-CALIBRATION-001 |
| T090 | GOV-01          | V2 Agent 流程第一、二批文档规范                                                             | GW-001/002/004/005/006/009/010；T090 合同                            | dev@112b909                                                 | `done`   | `EV-T090-001`                                                                                                                                                |
| T091 | GOV-02          | V2 第三批确定性证据采集、CI artifact 和 metadata 校验                                       | V2 Batch 3；GW-001/002/004/008/009/010；T091 合同                    | T090；dev@aeb0d68                                           | `done`   | `EV-T091-001`                                                                                                                                                |
| T092 | GOV-04          | 定义 Standard Task Automation Profile、Workflow 优化目标与基础 metadata 校验                | GW-001/002/004/008～010；不改变 FR/AC/D                              | T090、T091、T804；dev@d00a0b3                               | `done`   | `EV-T092-001`                                                                                                                                                |
| T093 | GOV-05          | 串行接入 Profile、三项项目 Skill、PR/CI 自动化、统一 Gate、ruleset context 与长任务等待策略 | GW-001/002/004～006/008～010；不改变 FR/AC/D                         | T092；dev@2b31bc6；阻塞 T041                                | `done`   | `EV-T093-001`、`EV-T093-002`                                                                                                                                 |
| T094 | G4 enabling     | Structural UI Refactor：拆分 Renderer ownership，不改变行为、文案或视觉                     | AC-01/03/04/07 回归；D-003～011/015/016；ED-001/002/004/012/019      | T033、T093、T805；阻塞 T041                                 | `done`   | `EV-T094-001`                                                                                                                                                |
| T801 | S1 fix          | 更新 Windows package smoke 的 S1 窄 API 契约并重新验证 unpacked/NSIS                        | G3/S1；GW-008/010；不改变 FR/AC/D/ED                                 | `EV-G3-S1-001`                                              | `done`   | `EV-T801-001`                                                                                                                                                |
| T802 | S2 fix          | 修复 package smoke、完整连续 E2E-AC-03、既有 S1 v1 数据守恒与 T021～T023 合同归档           | AC-03；FR-D01 S2 子集；GW-008/010；不改变生产语义                    | S2 聚合验收失败与独立 review                                | `done`   | `EV-T802-002`                                                                                                                                                |
| T803 | S3 aggregate    | 聚合验收 T031～T033、AC-07、package/重开/导出/AI 三态并归档 S3 合同                         | AC-07；FR-D01～D05；GW-008/010；不改变生产语义                       | T031～T033、T090、T091                                      | `done`   | `EV-G3-S3-001`                                                                                                                                               |
| T804 | GOV-03          | 统一收口长期文档中的任务、里程碑、tag/release 与 GitHub 配置事实                            | GW-001/002/004/008～010；不改变 FR/AC/D/ED                           | T803、T091                                                  | `done`   | `EV-T804-001`                                                                                                                                                |
| T805 | GOV-06          | 收敛 `/docs` 文档冗余、归档已完成治理合同并限定历史快照边界                                 | GW-001/003/004/009/010；不改变 FR/AC/D/ED                            | T090～T093、T804；dev@2b31bc6                               | `done`   | `EV-T805-001`、`EV-T805-002`                                                                                                                                 |
| T806 | S4/S5 aggregate | 聚合验收 T041～T052、AC-05/06、package、migration/export、证据与合同归档 | FR-REC01～REC06；FR-RV01～RV06；AC-05/06；AC-01/03/04/07 回归 | T041、T042、T051、T052 | `done` | EV-S4-S5-001；PR #43 final-head CI/集成及 beta.2 的 owner-accepted 发布已核验；EV-DOC-CALIBRATION-001 |
| T807 | S6 aggregate | 聚合验收 T061～T063、完整 AC-02、AI 隔离、package、证据收口与里程碑准备 | FR-AI01～AI10；FR-C02/C03；AC-02；AC-01/03/04/05/06/07 回归 | T061、T062、T063 | `done` | EV-T807-001；PR #49 final-head CI/集成及 beta.3 的 owner-accepted 发布已核验；live 自动 contract 失败仍保留；EV-DOC-CALIBRATION-001 |
| T809 | S8 aggregate | [S8 最终聚合验收与发布交接](archive/S8_T081_T084_T809_ARCHIVE.md#t809) | U-01～05；FR-D01～D05；AC-01～07；S8 final gate | T081～T084（开发集成审计；T084 未闭合验收项由聚合回链补验） | `done` | EV-S8-001；delivery 3fd1528 / dev 69c7f56，PR #62 晋升 main 9766760；done 按 owner-approved waivers 收口，不是全部真实矩阵通过或正式发布；EV-DOC-CALIBRATION-001 |

T809 编号说明：T808 曾在 T807 历史中作为废弃任务出现，本次不复用。该句的原合同准备状态保留于合同历史；当前 T084/T809 按已核验交付、集成和 owner 明确豁免收口，未执行矩阵仍为接受风险。

## 5. 阶段门与主线合并

| 阶段门            | 任务范围                 | 通过后 GitHub 动作                                                                                                                                                                                                                                 |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G2 工程就绪       | T001～T004               | PR #5 合入 `main@7cc047e...`；`v0.1.0-alpha.1` 已发布                                                                                                                                                                                              |
| G3/S1 核心闭环    | T011～T014/T801          | PR #14 合入 `main@3912e80...`；`v0.1.0-alpha.2` 已发布                                                                                                                                                                                             |
| G3/S2 例行与意向  | T021～T023/T802          | PR #22 合入 `main@581e443...`；`v0.1.0-alpha.3` 已发布                                                                                                                                                                                             |
| G3/S3 数据安全    | T031～T033/T803          | PR #30 合入 `main@75e51b4...`；`v0.1.0-beta.1` 已发布                                                                                                                                                                                              |
| S4 前工程/UI 基线 | T804/T092/T093/T805/T094 | `dev@2632ff0...` 本地聚合 candidate 通过；文档 final-head CI 与 `dev -> main` Draft PR 另记                                                                                                                                                        |
| S6 AI 启动帮助 | T061～T063/T807 | PR #50 已晋升 main，并发布 v0.1.0-beta.3；精确记录见 EV-DOC-CALIBRATION-001 |
| G4 Demo 就绪 | T094、T041～T072 | T072 自动/owner 人工验收及 PR #62 main 晋升已完成；不补造独立 G4 命名签署，不宣称 rc.1/v0.1.0 已发布 |
| S8 原位升级与维护 | T081～T084 / T809 | PR #61 完成交付/集成，PR #62 晋升 main；按 owner 明确豁免接受剩余真实矩阵风险。v0.1.4 为演练，正式发布未执行 |

阶段门不会因任务表显示 `done` 自动通过；必须满足开发流程中的自动化和人工验收要求。

## 6. 任务拆分规则

- 若一个任务无法在一个聚焦 PR 中完成，可拆为 `Txxx-A`、`Txxx-B`，但父任务仍负责完整验收。
- 不为了技术层整齐把一个纵向行为拆成无法独立验证的长期分支。
- 数据 migration 任务默认串行，不与修改相同表结构的任务并行。
- 修复使用原任务号的后续 PR，或创建 `T8xx` 缺陷任务并引用发现它的证据。
- 新产品想法不直接加入本表；先按需求变更规则分类和批准。

## 7. 状态与证据边界

本表是任务执行状态的唯一来源；具体验证以证据账本为准。归档与维护说明分别提供历史摘要和日常操作，不维护第二份任务状态，不因 done 推定新的阶段、依赖、Ready、merge、tag 或发布授权。

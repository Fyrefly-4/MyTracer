# MyTracer v0.1 任务索引

> 文档状态：v0.1 实施任务基线  
> 当前阶段：G1、G2 已通过；S0/S1/S2 已归档；T031～T033 已完成并合入 `dev`；T803 正在对同一最新 `origin/dev` 执行 G3/S3 聚合验收与文档证据收口；`dev → main` 里程碑 merge、tag 和 release 仍受独立授权门禁约束
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

| 状态 | 含义 |
|---|---|
| `blocked` | 缺少批准、前置任务或外部条件，不能安全启动 |
| `pending` | 尚未到执行顺序，前置条件未全部满足 |
| `ready` | 输入、批准、任务合同和环境均已满足，可启动 |
| `active` | 一个 Agent 正在按已批准合同执行 |
| `review` | 实现完成，等待独立评审、CI 或项目所有者处理 |
| `done` | 自动验证和要求的验收证据完整，且没有未报告缺口 |

同一时间默认只有一个业务实现任务为 `active`。确需并行时，各任务必须拥有独立 worktree、非重叠文件/迁移范围和独立验证入口。

## 3. 当前门禁

- T001～T004 的历史范围、批准、PR、验证和限制已统一归档于 [`archive/S0_T001_T004_ARCHIVE.md`](archive/S0_T001_T004_ARCHIVE.md)，详细结果见 `EV-T001-001`～`EV-T004-001`。
- G2 已由项目所有者于 2026-08-09 确认通过，证据为 `EV-G2-001`；里程碑 PR #5 已将 T001～T004 从 `dev` 合入 `main`。
- T011～T014 与门禁修复 T801 的最终范围、批准、PR、验证和限制已由 PR #13 收敛为统一归档 [`archive/S1_T011_T014_ARCHIVE.md`](archive/S1_T011_T014_ARCHIVE.md) 并合入 `dev`；详细结果见 `EV-T011-001`～`EV-T014-001`、`EV-T801-001` 与 `EV-AC01-001`。
- G3/S1 聚合验收 `EV-G3-S1-001` 保留一次失败：`dev@623007dd4269df02771f6a526db269de1fe95a03` 的 `verify`、AC-01 和 Windows package 构建通过，但 package smoke 仍断言 S0 的旧 Preload API 面，未完成 NSIS 安装态验证。
- T801 已由 PR #12 修复并合入；最终 `dev@74ebe346a86cf431d87e02e8a1220b713b33901c` 的 hosted `verify`、本地完整 `verify`/AC-01、package 与 unpacked/NSIS smoke 通过，`EV-G3-S1-002` 显式取代首轮失败结论。
- T021～T023 的最终范围、批准、PR、验证和限制已由 T802 PR #20 收敛为统一归档 [`archive/S2_T021_T023_ARCHIVE.md`](archive/S2_T021_T023_ARCHIVE.md) 并合入 `dev`；原合同仅从 Git 历史恢复。
- T802 修复候选 `a61d0bc100752ae1209623a2ac020ff25a62bf8f` 与归档 head `dd20a1544e0e48008dea6d272618f8cdfef9e4ee` 的 required CI 均通过；PR #20 squash merge 为最终验收基线 `dev@a9db1eb26134dac83b01f4a4d7da30f92a271242`。
- 最终 dev 的本地/hosted `verify`、定向 AC-01/03/04、LocalDate/SQLite/S1-only v1 数据守恒、Windows package、unpacked/隔离 NSIS smoke 与独立聚合 review 通过，详见 `EV-T802-002`。
- T091 已由 PR #24 合入 `dev@4674597f736af9ba81e7c758681ae45bdd5c6a1b`；T031、T032、T033 已依次由 PR #26～#28 合入，最终 S3 产品 source 为 `dev@8058f7a3c9db9d3b488e727dfd85201dc14f11a0`。
- T803 在该固定 source 和文档候选 `f5fd977bd32676cb617f3023091a20a40d72db70` 的定向 unit/integration/E2E、完整 `verify`、Windows package 与 unpacked/隔离 NSIS smoke 均已通过；Draft PR #29 candidate Windows required gate 通过，项目所有者 merge 尚待完成。
- 项目所有者于 2026-08-22 报告完整人工 AC-07 `pass`；T031 专用人工清单未单独执行的历史仍保留在 `EV-T031-001`。
- 首个 AI Provider、模型和 SDK 只阻塞 T062，不阻塞 S0～S5 的非 AI 能力。

## 4. 任务总表

| Task | Slice | 范围 | 主要需求/决定 | 前置 | 状态 | 证据 |
|---|---|---|---|---|---|---|
| T001 | E0-01 | Electron 骨架与 Main/Preload/Renderer 边界 | D-001/003/015～017；ED-001/002/004/019 | 依赖批准 | `done` | `EV-T001-001` |
| T002 | E0-02 | 验证工具链、FakeClock/FakeAiProvider、临时数据根 | Test Strategy §3/9；GW-008 | T001、测试工具批准 | `done` | `EV-T002-001` |
| T003 | E0-03 | SQLite、初始 schema、migration、Repository 契约 | FR-D01；D-103/106/111；ED-003/018 | T001～T002 | `done` | `EV-T003-001` |
| T004 | E0-04 | LocalDate、诊断、配置、safeStorage 空边界、Windows 打包冒烟 | ED-010/017/019 | T001～T003 | `done` | `EV-T004-001` |
| T011 | E1-01 | Goal 生命周期和当前下一步 | FR-G01～G06；D-002/101；ED-005；AC-01 | G2（已通过） | `done` | `EV-T011-001` |
| T012 | E1-02 | Action、Today focus、取消/完成/重新安排 | FR-A01～A06；FR-T01/04/05/08；ED-006/007；AC-01 | T011（已完成） | `done` | `EV-T012-001` |
| T013 | E1-03 | 快速/深入 ActionRecord | FR-A05；FR-A08（T013 部分）；FR-L01～L06/L08；FR-C01；D-006/103～106 | T012 | `done` | `EV-T013-001` |
| T014 | E1-04 | 基础 Progress 投影 | FR-P01～P04/P07/P08；FR-C03；D-007 | T013 | `done` | `EV-T014-001` |
| T021 | E2-01 | Routine 生命周期和星期节奏 | FR-R01～R03；FR-T02；ED-006/009 | S1 | `done` | `EV-T021-001` |
| T022 | E2-02 | Routine 五态、unknown 和非计划日事实 | FR-R04～R09；D-008～010/107；AC-03 | T021 | `done` | `EV-T022-001` |
| T023 | E2-03 | 通用非强制意向 | FR-A07；FR-T03/T08；D-011；AC-04 | T021 | `done` | `EV-T023-001` |
| T031 | E3-01 | 修改、补记、删除影响预览和事务 | FR-L07；FR-R08；FR-D02；ED-008 | S1/S2 | `done` | `EV-T031-001` |
| T032 | E3-02 | UTF-8 JSON 完整导出和引用检查 | FR-D03/D04；D-111；ED-014；AC-07 | T031 | `done` | `EV-T032-001` |
| T033 | E3-03 | AI 关闭/未配置/失败时的数据能力回归 | FR-D05；FR-AI09；D-015 | T032 | `done` | `EV-T033-001` |
| T041 | E4-01 | RecoveryContext 查询 | FR-REC01～REC03；D-002 | S1 | `pending` | — |
| T042 | E4-02 | 清理过时内容并重新开始 | FR-REC04～REC06；FR-P04；D-013；AC-05 | T041 | `pending` | — |
| T051 | E5-01 | 周期事实摘要 | FR-RV01/RV06；D-106；AC-06 | S2/S3 | `pending` | — |
| T052 | E5-02 | ReviewResult 和下一阶段调整 | FR-RV02～RV05；D-105/110 | T051 | `pending` | — |
| T061 | E6-01 | AI 最小上下文选择器和隔离证明 | FR-AI01/03/08/10；D-108；ED-011 | S1/S3 | `pending` | — |
| T062 | E6-02 | 可替换 Provider、超时和失败降级 | FR-AI02～AI04/AI07/AI09；D-012/013/015 | T061、Provider 批准 | `pending` | — |
| T063 | E6-03 | AI 建议接受/修改/拒绝和确认命令 | FR-AI05/06；FR-C02/C03；D-014/109；AC-02 | T062 | `pending` | — |
| T071 | S7 | 11 条 SHOULD 的既定处理结论 | Traceability §4；Implementation §10.1 | S1～S6 | `pending` | — |
| T072 | S7 | 全量回归、AC-01～AC-07、Windows Demo 收敛 | 全部 MUST/AC；Test Strategy §7～10 | T071 | `pending` | — |
| T090 | GOV-01 | V2 Agent 流程第一、二批文档规范 | GW-001/002/004/005/006/009/010；T090 合同 | dev@112b909 | `done` | `EV-T090-001` |
| T091 | GOV-02 | V2 第三批确定性证据采集、CI artifact 和 metadata 校验 | V2 Batch 3；GW-001/002/004/008/009/010；T091 合同 | T090；dev@aeb0d68 | `done` | `EV-T091-001` |
| T801 | S1 fix | 更新 Windows package smoke 的 S1 窄 API 契约并重新验证 unpacked/NSIS | G3/S1；GW-008/010；不改变 FR/AC/D/ED | `EV-G3-S1-001` | `done` | `EV-T801-001` |
| T802 | S2 fix | 修复 package smoke、完整连续 E2E-AC-03、既有 S1 v1 数据守恒与 T021～T023 合同归档 | AC-03；FR-D01 S2 子集；GW-008/010；不改变生产语义 | S2 聚合验收失败与独立 review | `done` | `EV-T802-002` |
| T803 | S3 aggregate | 聚合验收 T031～T033、AC-07、package/重开/导出/AI 三态并归档 S3 合同 | AC-07；FR-D01～D05；GW-008/010；不改变生产语义 | T031～T033、T090、T091 | `review` | `EV-G3-S3-001` |

## 5. 阶段门与主线合并

| 阶段门 | 任务范围 | 通过后 GitHub 动作 |
|---|---|---|
| G2 工程就绪 | T001～T004 | 已通过；PR #5 已合并到 `main`，未据此创建 tag/release |
| G3/S1 核心闭环 | T011～T014 | 经项目所有者验收后进入后续切片；是否推进 `main` 由所有者决定 |
| G3/S3 数据安全 | T031～T033/T803 | T803 收口 PR 合入 `dev` 后创建里程碑 PR；不自动授权 merge |
| G4 Demo 就绪 | T021～T072 | 全量验收后合入 `main`，准备 beta 或 v0.1.0 |

阶段门不会因任务表显示 `done` 自动通过；必须满足开发流程中的自动化和人工验收要求。

## 6. 任务拆分规则

- 若一个任务无法在一个聚焦 PR 中完成，可拆为 `Txxx-A`、`Txxx-B`，但父任务仍负责完整验收。
- 不为了技术层整齐把一个纵向行为拆成无法独立验证的长期分支。
- 数据 migration 任务默认串行，不与修改相同表结构的任务并行。
- 修复使用原任务号的后续 PR，或创建 `T8xx` 缺陷任务并引用发现它的证据。
- 新产品想法不直接加入本表；先按需求变更规则分类和批准。

## 7. 当前结论

- T001～T004 均为 `done`，分别由 `EV-T001-001`～`EV-T004-001` 支持；四个任务 PR #1～#4 均已合并到 `dev`。
- G2 工程就绪由 `EV-G2-001` 支持；PR #5 已将同一最终 `dev` revision 合入 `main`，项目所有者验收为 `pass`。
- T001～T004 与 G2 只建立工程基础，不声明任何业务 FR 或 AC-01～AC-07 完成。
- T011～T014 均已通过各自任务证据并合入 `dev`；最终 squash merge revisions 依次为 `48a6f6439fbbb6ba2309e005ebb12e02b151a457`、`b994962618954cf02f9e07590d68213d0378bccb`、`b3c61b403888b81e4f155fabcbefea689acd1d3a`、`623007dd4269df02771f6a526db269de1fe95a03`。
- 首轮 `dev@623007dd4269df02771f6a526db269de1fe95a03` 的 package smoke 失败永久保留为 `EV-G3-S1-001`；T801 PR #12 的修复、独立 review、head CI、squash merge `74ebe346a86cf431d87e02e8a1220b713b33901c` 与最终 dev push CI 均已完成。
- `dev@74ebe346a86cf431d87e02e8a1220b713b33901c` 的本地完整 `verify`、AC-01、package、unpacked/NSIS smoke 与 hosted Windows gate 通过；G3/S1 自动化验收由 `EV-G3-S1-002` 支持。
- T011～T014/T801 已按 S0 模式形成单一 [`S1_T011_T014_ARCHIVE.md`](archive/S1_T011_T014_ARCHIVE.md) 并由 PR #13 合入 `dev`；原合同仅从 Git 历史恢复。
- S1 的后续里程碑推进只通过 `dev → main` PR；PR 创建不授权合入 `main`，tag 和 release 仍须在合入后另行批准。
- T021～T023 的最终 squash merge revisions 依次为 `e3e7346eba492f1de810ffe34b41b1d96831c3af`、`68239dafb0d742b09abb2583544a37361157c872`、`0106996b45a41275370c46bd3f6ea842573f0889`；任务级自动化、独立 review 与项目所有者人工验收均已通过。
- T802 PR #20 已将 S2 聚合门禁修复与 [`S2_T021_T023_ARCHIVE.md`](archive/S2_T021_T023_ARCHIVE.md) squash 合入 `dev@a9db1eb26134dac83b01f4a4d7da30f92a271242`；最终同 revision 验收由 `EV-T802-002` 支持，`EV-T802-001` 的 partial 候选状态保留并被取代。
- S2 聚合验收通过允许准备 `dev → main` 里程碑 PR，但不授权 Agent merge、tag 或 release；里程碑合入必须由项目所有者批准并使用 merge commit。
- T090 已完成第一、二批流程文档规范落地；`EV-T090-001` 记录本地验证、PR candidate CI 和项目所有者人工审核通过。产品任务试点未进行，第二批仍是“文档已落地、尚未通过真实任务运行验证”；PR #23 已以 `aeb0d68` 进入 `dev`，因此 T091 以该 revision 作为授权基线。
- T091 PR #24 已以 `4674597f736af9ba81e7c758681ae45bdd5c6a1b` 合入 `dev`；其确定性 evidence、metadata 和 CI artifact 能力已由 T031～T033/T803 实际使用，早期记录中的“尚未合入”不再是当前集成事实。
- S3 设计 PR #25、T031 PR #26、T032 PR #27、T033 PR #28 已依次合入，固定产品 source 为 `8058f7a3c9db9d3b488e727dfd85201dc14f11a0`；任务 Evidence 与失败历史继续保留。
- T803 在固定 source 与文档候选 `f5fd977bd32676cb617f3023091a20a40d72db70` 上的本地聚合门禁和 PR #29 candidate CI 已通过，项目所有者 2026-08-22 的完整人工 AC-07 为 `pass`；任务处于 `review`，等待项目所有者处理 Draft PR。
- G3/S3 聚合候选通过不表示 G4、AC-02/05/06、自动导入/恢复、AI Provider、`main` merge、tag 或 release 完成；T803 合入 `dev` 后才按授权创建 `dev → main` 里程碑 PR。

# MyTracer v0.1 任务索引

> 文档状态：v0.1 实施任务基线  
> 当前阶段：G1、G2 已通过；T001～T004 已完成并归档；T011～T014 已完成；G3/S1 因 Windows package smoke 漂移而未通过，等待 T801 独立修复和新 `dev` revision 全量重验
> 状态来源：本文件是任务执行状态的唯一账本，架构实施计划只定义范围和顺序

## 1. 使用规则

- 每个任务必须从 [`TASK_TEMPLATE.md`](TASK_TEMPLATE.md) 形成独立任务合同后才能进入 `active`。
- 任务必须引用 [`IMPLEMENTATION_PLAN_V0.1.md`](../architecture/IMPLEMENTATION_PLAN_V0.1.md) 中的切片，并列出直接相关的 FR/AC/D/ED。
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
- T011 已由 `EV-T011-001` 证明本地自动验证、项目所有者人工验收和 PR head hosted Windows gate 通过；项目所有者于 2026-08-09 review 后确认任务完成。
- T012 已由 `EV-T012-001` 证明本地自动验证、项目所有者人工复验和 PR #9 实现 head hosted Windows gate 通过；只贡献 AC-01 步骤 3，并只完成 FR-A05 的 Action 状态解耦部分。
- T013 已由 `EV-T013-001` 证明本地自动验证、独立复核、项目所有者人工验收和 PR #10 实现 head hosted Windows gate 通过；贡献 AC-01 步骤 4～5，并与 T012 合并完成 FR-A05。
- T014 的实现、独立 review、本地/hosted 自动验证、PR #11 合并和项目所有者完整人工 AC-01 已由 `EV-T014-001` / `EV-AC01-001` 记录，因此为 `done`。
- G3/S1 聚合验收 `EV-G3-S1-001` 保留一次失败：`dev@623007dd4269df02771f6a526db269de1fe95a03` 的 `verify`、AC-01 和 Windows package 构建通过，但 package smoke 仍断言 S0 的旧 Preload API 面，未完成 NSIS 安装态验证。
- T801 是该缺陷的独立修复候选；未经合同批准和明确启动，不得修改测试或创建修复 PR。修复合入后必须固定新的最终 `dev` revision，重新执行完整 S1 验收。
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
| T021 | E2-01 | Routine 生命周期和星期节奏 | FR-R01～R03；FR-T02；ED-006/009 | S1 | `pending` | — |
| T022 | E2-02 | Routine 五态、unknown 和非计划日事实 | FR-R04～R09；D-008～010/107；AC-03 | T021 | `pending` | — |
| T023 | E2-03 | 通用非强制意向 | FR-A07；FR-T03/T08；D-011；AC-04 | T021 | `pending` | — |
| T031 | E3-01 | 修改、补记、删除影响预览和事务 | FR-L07；FR-R08；FR-D02；ED-008 | S1/S2 | `pending` | — |
| T032 | E3-02 | UTF-8 JSON 完整导出和引用检查 | FR-D03/D04；D-111；ED-014；AC-07 | T031 | `pending` | — |
| T033 | E3-03 | AI 关闭/未配置/失败时的数据能力回归 | FR-D05；FR-AI09；D-015 | T032 | `pending` | — |
| T041 | E4-01 | RecoveryContext 查询 | FR-REC01～REC03；D-002 | S1 | `pending` | — |
| T042 | E4-02 | 清理过时内容并重新开始 | FR-REC04～REC06；FR-P04；D-013；AC-05 | T041 | `pending` | — |
| T051 | E5-01 | 周期事实摘要 | FR-RV01/RV06；D-106；AC-06 | S2/S3 | `pending` | — |
| T052 | E5-02 | ReviewResult 和下一阶段调整 | FR-RV02～RV05；D-105/110 | T051 | `pending` | — |
| T061 | E6-01 | AI 最小上下文选择器和隔离证明 | FR-AI01/03/08/10；D-108；ED-011 | S1/S3 | `pending` | — |
| T062 | E6-02 | 可替换 Provider、超时和失败降级 | FR-AI02～AI04/AI07/AI09；D-012/013/015 | T061、Provider 批准 | `pending` | — |
| T063 | E6-03 | AI 建议接受/修改/拒绝和确认命令 | FR-AI05/06；FR-C02/C03；D-014/109；AC-02 | T062 | `pending` | — |
| T071 | S7 | 11 条 SHOULD 的既定处理结论 | Traceability §4；Implementation §10.1 | S1～S6 | `pending` | — |
| T072 | S7 | 全量回归、AC-01～AC-07、Windows Demo 收敛 | 全部 MUST/AC；Test Strategy §7～10 | T071 | `pending` | — |
| T801 | S1 fix | 更新 Windows package smoke 的 S1 窄 API 契约并重新验证 unpacked/NSIS | G3/S1；GW-008/010；不改变 FR/AC/D/ED | `EV-G3-S1-001` | `pending` | — |

## 5. 阶段门与主线合并

| 阶段门 | 任务范围 | 通过后 GitHub 动作 |
|---|---|---|
| G2 工程就绪 | T001～T004 | 已通过；PR #5 已合并到 `main`，未据此创建 tag/release |
| G3/S1 核心闭环 | T011～T014 | 经项目所有者验收后进入后续切片；是否推进 `main` 由所有者决定 |
| G3/S3 数据安全 | T031～T033 | 建议创建里程碑 PR，形成可恢复的数据基线 |
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
- T014 的独立 review 除 `tests/e2e/windows-package-smoke.e2e.test.ts` 的里程碑级 API 断言漂移外未发现任务实现问题；该漂移不重开 T014 产品范围，但阻塞 G3/S1 Windows package 门禁。
- `dev@623007dd4269df02771f6a526db269de1fe95a03` 的 `verify`、AC-01 自动化/人工验收和 package 构建通过；独立 package smoke 在 unpacked 阶段失败，因此 G3/S1 不通过，未创建 `dev → main` PR。
- 下一步是批准并启动 T801，修复合入后在新的最终 `dev` revision 上重新执行完整验收；在此之前不归档 T011～T014，不启动 T021，不推进 `main`、tag 或 release。

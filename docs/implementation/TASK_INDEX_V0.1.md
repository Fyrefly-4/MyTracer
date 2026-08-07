# MyTracer v0.1 任务索引

> 文档状态：v0.1 实施任务基线  
> 当前阶段：G1 已通过；所有工程任务等待依赖和工具链批准  
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

启动 T001 前仍需批准：

1. Electron、React、TypeScript、Vite 和 `better-sqlite3` 的确切版本；
2. 包管理器、脚手架和 Windows 打包工具；
3. lint、format、单元、集成和 E2E 测试框架；
4. 首批运行时/开发依赖及其增加权限；
5. 工程目录和真实/测试数据路径；
6. 创建任务分支、提交及是否发布 Draft PR 的任务级授权。

首个 AI Provider、模型和 SDK 只阻塞 T062，不阻塞 S0～S5 的非 AI 能力。

## 4. 任务总表

| Task | Slice | 范围 | 主要需求/决定 | 前置 | 状态 | 证据 |
|---|---|---|---|---|---|---|
| T001 | E0-01 | Electron 骨架与 Main/Preload/Renderer 边界 | D-001/003/015～017；ED-001/002/004/019 | 依赖批准 | `blocked` | — |
| T002 | E0-02 | 验证工具链、FakeClock/FakeAiProvider、临时数据根 | Test Strategy §3/9；GW-008 | T001、测试工具批准 | `pending` | — |
| T003 | E0-03 | SQLite、初始 schema、migration、Repository 契约 | FR-D01；D-103/106/111；ED-003/018 | T001～T002 | `pending` | — |
| T004 | E0-04 | LocalDate、诊断、配置、safeStorage 空边界、Windows 打包冒烟 | ED-010/017/019 | T001～T003 | `pending` | — |
| T011 | E1-01 | Goal 生命周期和当前下一步 | FR-G01～G06；D-002/101；ED-005；AC-01 | G2 | `pending` | — |
| T012 | E1-02 | Action、Today focus、取消/完成/重新安排 | FR-A01～A06；FR-T01/04/05/08；ED-006/007；AC-01 | T011 | `pending` | — |
| T013 | E1-03 | 快速/深入 ActionRecord | FR-A05；FR-L01～L09；FR-C01；D-006/103/104 | T012 | `pending` | — |
| T014 | E1-04 | 基础 Progress 投影 | FR-P01～P04/P07/P08；FR-C03；D-007 | T013 | `pending` | — |
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

## 5. 阶段门与主线合并

| 阶段门 | 任务范围 | 通过后 GitHub 动作 |
|---|---|---|
| G2 工程就绪 | T001～T004 | 经批准创建 `dev -> main` 里程碑 PR，可标记 `v0.1.0-alpha.1` |
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

- 当前没有 `ready` 或 `active` 工程任务。
- 仓库治理文档完成不等于 G2 工程就绪。
- 下一项行动是提交具体依赖/版本/工具链方案供项目所有者批准，然后把 T001 转为 `ready`。

# S1 历史阶段执行记录

> 来源：`beb8b97b2c9ecdef4ab0677853eef195c2367544` 中的 [S1_CORE_LOOP_DESIGN_V0.1.md](../../../architecture/S1_CORE_LOOP_DESIGN_V0.1.md)。本文保留当时的执行、授权和交付上下文，不是当前状态或普通工作的指令；旧批准不恢复执行权限。技术正文继续在原设计文件维护。

## 原页首状态与授权


> 文档状态：已获项目所有者批准；批准不构成 T011～T014 实现授权。
>
> 后续交付结果：T011～T014/T801 已完成并由 PR #13 归档到 `dev`；里程碑 PR #14 合入 `main@3912e8082909a8ea99c4ca7aa8ec2f39fdc6cec7`，并发布 `v0.1.0-alpha.2`。任务实时状态以 `TASK_INDEX_V0.1.md` 为准。
>
> 审批结果：S1-Q01 = A；S1-Q02～S1-Q10 = 各自原推荐项。
>
> 适用范围：S1 / E1-01～E1-04 的任务合同、实现、测试与验收设计输入
>
> 提案及批准日期：2026-08-09
>
> 核心验收：AC-01 React 学习完整流程



## 0. 文档用途与权限边界

本文把已冻结产品语义和已批准工程决定收敛为 T011～T014 的整体设计，目的是让四个后续任务在同一闭环、同一状态语义和同一数据边界下编写独立任务合同。

本文依据以下规范，解释顺序保持不变：

1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../../../PRODUCT_REQUIREMENTS_V0.1.md)；
2. [`DECISIONS.md`](../../../DECISIONS.md)；
3. [`REQUIREMENTS_CHANGE_POLICY.md`](../../../REQUIREMENTS_CHANGE_POLICY.md)；
4. 本目录的总体架构、领域、数据、测试、追踪、实施计划与工程决定；
5. [`TASK_INDEX_V0.1.md`](../../TASK_INDEX_V0.1.md)、[`TASK_TEMPLATE.md`](../../TASK_TEMPLATE.md) 和 [`GITHUB_WORKFLOW_V0.1.md`](../../GITHUB_WORKFLOW_V0.1.md)。

`user/` 不属于本文依据，也不得成为后续开发依赖。

本文使用三类结论：

| 标记 | 含义 |
|---|---|
| **冻结/已批准** | 直接来自 FR、AC、D、ED 或现行仓库基线，后续任务不得改变 |
| **已批准设计** | 第 11 节记录项目所有者选择；可写入后续任务合同，但不等于实现授权 |
| **延期/非范围** | 不进入 S1，不得成为 T011～T014 的接口、数据或验收前置 |

本次批准允许以本文编写 T011～T014 的独立任务合同，并按 S1-Q01-A 同时确认 G2 通过、允许准备 T011。它仍不等于：

- 启动 T011 或任何实现；
- 批准依赖、migration、分支、commit、push、Draft PR、Ready、merge、tag 或 release；
- 通过 AC-01 人工验收。

## 1. 基线核对结论

### 1.1 设计审批时的基线事实

- 本文设计审批读取基线时，`TASK_INDEX_V0.1.md` 记录 T001～T004 `done`、T011～T014 `pending`，G2 为独立门禁；项目所有者当时通过 S1-Q01-A 明确确认 G2 通过。该段保留审批时事实，不代表页首所列后续交付状态。
- 设计审批时 SQLite `schemaVersion = 1` 已包含 S1 所需的 `goals`、`actions`、`today_selections`、`action_records`、`understandings` 和 `confusions` 表。
- 设计审批时 `RepositoryPort`、`UnitOfWorkPort`、`ClockPort`、安全 IPC sender/origin 校验和隔离测试根已经存在，但尚无 S1 业务命令、查询或 UI；T011 后续交付不改写这条历史基线。
- 已批准 S1-Q06-A：S1 不需要新增或升级依赖，也不需要新 migration；不得修改已执行的 `001_initial.sql`。
- 设计审批时识别到部分较早架构/工作流正文仍保留“等待工程初始化”之类状态性描述；后续实施状态始终以任务索引和实时只读核验为准。

### 1.2 冲突结论

未发现两条 MUST 或已批准 D/ED 无法同时满足的冲突，因此可以继续完成 S1 设计。

发现的缺口属于任务分配或实现级细化，不是产品语义冲突：

- FR-L07 同时被 T013 的 `FR-L01～L09` 范围和 T031 明确引用；
- FR-A05 同时出现在 T012 的 `FR-A01～A06` 范围和 T013 的记录范围，需要区分 Action 侧不变量与用户可见 Record 交付；
- FR-A08 被实施计划放入 S1，但任务索引未明确归属某个 Txxx；
- Action 改换 Goal 后的历史 Progress 归属尚未冻结；
- Goal pause/end 对当日 TodaySelection 的处理尚未冻结；
- ActionRecord 保存与 Action 状态/新下一步更新采用一个还是多个应用命令尚未冻结。

这些事项已由项目所有者按第 11 节完成审批；后续任务合同必须使用已批准结果，不得继续把其他选项当作开放决定。

## 8. T011～T014 任务边界

### 8.1 T011 — Goal 生命周期和当前下一步

**范围**

- Goal 领域实体、状态机和不变量；
- 创建/修改/pause/resume/end；
- 可空当前下一步及同 Goal pending 校验；
- 按 ED-005 在创建 Goal 时支持一个最小的内联 pending Action；
- `ListGoals`、`GetGoalDetail` 和关联 Action/Record 只读查询；
- SQLite、Application、IPC、Renderer 的最小纵向路径；
- 状态机、历史守恒、事务回滚和重开测试。

**非范围**

- 通用 Action 编辑与状态流、Today、ActionRecord、Progress；
- Action 删除、Goal 硬删除或任何 S3 能力；
- 自动候选、软数量提示和 Recovery UI。

**依赖**

- 项目所有者已按 S1-Q01-A 确认 G2 通过并允许准备 T011；
- 依据本文形成独立 T011 合同；
- S1-Q02、S1-Q05 已确认并写入 T011 合同；
- 任务启动、文件范围、依赖和 Git/GitHub 权限另行明确。

**完成条件**

- FR-G01～G06 的 T011 可观察行为存在；
- Goal 创建带下一步时无循环外键半写入；
- pause/end 不改变关联历史；ended 终态；
- 当前下一步的同 Goal/pending 约束在领域、应用和集成层均有失败测试；
- 关闭并重开后查询一致；
- 不声称 AC-01 完整通过，只记录步骤 1～2 的贡献覆盖。

### 8.2 T012 — Action、Today focus 与重新安排

**范围**

- 通用 Action 创建、修改和 `pending → completed/cancelled/rescheduled`；
- FR-A05 的 Action 侧不变量：`partial` 不是 Action 状态，Action 不得因尚未实现的 Record outcome 自动转换；
- 可空 Goal 关联；S1 不暴露有记录后的 Goal 重分配；
- 当前下一步 Action 状态变化时的原子清空/替换；
- 用户选入/移出当前日 Today focus；
- rescheduled 复用同一 Action，再次选入时恢复 pending；
- Today 不自动搬运历史 Action；
- `GetActionDetail`、`GetToday`、IPC 和 UI 纵向路径。

**非范围**

- ActionRecord、Progress、Routine、intention；
- 未来日期、截止日期、逾期、自动滚动和复杂日程；
- Action 硬删除。

**依赖**

- T011 完成并有证据；
- S1-Q05、S1-Q06、S1-Q07 已确认并写入 T012 合同。

**完成条件**

- Action 状态机与非法转换均有测试；
- T012 只证明 FR-A05 的 Action 状态解耦；用户实际保存 partial 的可观察行为由 T013 完成；
- reschedule 前后 Action ID 相同，旧 Record 不变，当天 focus 被移除；
- 用户再次选择才恢复 pending，Query 不产生写入；
- 同一 Action/LocalDate 只有一个 focus；按已批准 S1-Q07-A，complete/cancel 后保留并显示不可开始的终态，且与 reschedule 的已批准移除行为保持清楚区分；
- 新一天为空，不自动搬运旧 focus；
- 当前下一步处理在故障时完整回滚；
- 不声称 AC-01 完整通过，只记录步骤 3 的贡献覆盖。

### 8.3 T013 — 快速/深入 ActionRecord

**范围**

- ActionRecord 创建；快速层仅分钟和 outcome 必填；
- 可选 Understanding、Confusion、下一步文本和 note；
- `completed | partial | stopped` 记录语义，0 分钟语义；
- partial 不自动改变 Action；
- `BeginActionRecording`、`CancelActionRecording`、`RecordAction` 及 Main 临时 context 的完整生命周期；
- 只对 S1-Q10-A 批准的 Action/Goal 状态开放记录入口：只允许无 Goal 或 active Goal 下的 pending Action；
- 用户已确认的 post-record 选择，具体按 S1-Q04；
- LocalDate 捕获与跨午夜确认；
- 一个事务保存父记录和子实体；
- 记录详情/列表所需查询、IPC、渐进披露 UI 和重开测试。

**非范围**

- 不实现常规补记、修改、删除、Understanding 撤销或 Confusion 解决；按已批准 S1-Q03-B/Q08-B 留给 T031；
- AI 候选 Understanding；
- Progress 聚合和评分类展示。

**依赖**

- T012 完成并有证据；
- S1-Q03、S1-Q04、S1-Q07、S1-Q08、S1-Q10 已确认。

**完成条件**

- 只填写快速层可成功保存；深入字段全部空也合法；
- 父记录或任一子实体失败时零变化；
- partial/stopped 各计为真实记录但不自动转 Action；
- pending/active 或无 Goal 的合法入口可记录；terminal、rescheduled、paused/ended Goal 下入口均被拒绝且零写入；
- 伪造、已失效（取消、替换、reload/navigation、窗口关闭）、已消费或 action/sender 不匹配的 recording context 不写入；跨午夜未选择时不写入，选择后发生日准确；
- 重开后记录及子实体一致；
- 不把 FR-L07 的修改/删除或 FR-C04 的撤销声称为已完成；
- 不声称 AC-01 完整通过，只记录步骤 4～5 的贡献覆盖。

### 8.4 T014 — 基础 Progress 投影与 S1 闭环

**范围**

- `GetProgress` 只读投影；
- 按可选 Goal 和/或包含端点的 LocalDate 范围聚合；
- 累计分钟、每条 ActionRecord 的真实行动次数、未撤销 Understanding、open Confusion；
- 稳定排序、空状态、中性文案；
- 单元、集成、IPC、E2E 和 AC-01 人工验收准备；
- 同一 revision 上的 AC-01 完整自动化与重开验证。

**非范围**

- 写入或修复事实；
- Routine 统计、长期未推进提示、周期对比；
- 完成数、达标数、连续天数主指标、评分、掌握度、失败率或人格评价；
- Review、Recovery、AI 或导出。

**依赖**

- T013 完成并有证据；
- S1-Q06、S1-Q08、S1-Q09 已确认。

**完成条件**

- 聚合公式在 Goal/日期过滤、0 分钟、多记录、partial/stopped、空数据下均正确；
- Progress 的记录顺序固定为 `occurredOn DESC, record.createdAt DESC, record.id ASC`；同一记录内子实体按 `child.createdAt ASC, child.id ASC`，不得依赖 SQLite 隐含行序；
- Query 只读，重复调用不改变数据库；
- 关闭重开后结果由事实重算且一致；
- E2E-AC-01 在最终 revision 连续通过；
- 人工 AC-01 未由项目所有者执行时明确为 `pending`；
- T011～T014 全部证据齐全后，只能形成 G3/S1 候选，不自动推进 `main` 或创建 tag。

### S1-Q01：G2 与本文批准是否分离

- **选项 A**：批准本文时同时视为 G2 通过并允许准备 T011。
- **选项 B**：本文只批准设计；另做一次 G2 证据核对和明确通过指令。
- **原推荐**：选项 B。
- **批准结果**：选项 A。
- **已批准影响**：本次批准同时构成 G2 通过并允许准备 T011 合同；仍不构成 T011 启动或实现授权，也不授予依赖、Git/GitHub 或发布权限。

## 13. 本文审批完成记录

项目所有者已确认：

- [x] 接受第 2～7 节的 S1 闭环、领域、Application、IPC、事务和数据设计；
- [x] S1-Q01 选择 A；S1-Q02～S1-Q10 选择各自原推荐项；
- [x] 接受 T011～T014 的范围、非范围、依赖和完成条件；
- [x] 接受 FR-L07 在 T031 完整交付、T013 不提前声明完成；
- [x] 接受 AC-01 只有在 T014 后才进行完整自动化和人工验收；
- [x] 接受 S1-Q06-A：S1 不新增依赖或 migration，不实施 S2～S7；
- [x] 理解本次批准同时通过 G2、允许准备 T011，但不构成任何 Txxx 实现、Git/GitHub、合并或发布授权。

设计审批当时的下一步是依据本文准备 T011 的简洁任务合同/Prompt；T012～T014 仍按任务索引串行准备和启动。本文本身不能把任何任务从 `pending` 改为 `ready` 或 `active`。

以上审批记录保留当时的权限事实；后续独立授权与实际执行状态见本文页首交付状态、S1 合同归档、验收证据和任务索引。当前 T011～T014/T801 已完成并归档到 `dev`；G3/S1 验收通过和里程碑 PR 创建仍不构成合入 `main`、tag 或 release 授权。

## 补充执行与批准上下文

### 原文片段 1

每个 Txxx 的任务合同都必须列出针对性测试，再执行受影响范围回归。现行最低命令为：

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
```

`verify` 已包含 build 和 Electron E2E，但不证明 package、hosted CI、人工验收或未列入命令的行为。证据必须绑定最终 revision、Windows 环境、隔离数据根、命令结果和已知缺口。

### 原文片段 2

后续合同可以在语义不变时调整名称

### 原文片段 3

必须在具体任务合同中给出不会静默截断的方案并获得批准

### 原文片段 4

后续任务合同/账本协调必须反映该归属，本次不修改任务索引；

### 原文片段 5

| 把 G2 通过或“允许准备 T011”误当成实现授权 | 权限边界失真 | S1-Q01-A 只批准 G2 和合同准备；T011 合同、启动、依赖和 Git/GitHub 权限继续分开确认 |

### 原文片段 6

| G2 审批与任务账本尚未同步 | Agent 使用旧前置或错误声称 T011 active | 本文保留所有者审批事实；另行授权同步 TASK_INDEX，每个任务启动前实时只读核验 |

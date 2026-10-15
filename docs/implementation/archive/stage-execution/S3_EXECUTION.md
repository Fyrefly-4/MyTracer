# S3 历史阶段执行记录

> 来源：`beb8b97b2c9ecdef4ab0677853eef195c2367544` 中的 [S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md](../../../architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md)。本文保留当时的执行、授权和交付上下文，不是当前状态或普通工作的指令；旧批准不恢复执行权限。技术正文继续在原设计文件维护。

## 原页首状态与授权


> 文档状态：**已获项目所有者批准；S3-Q01=A、S3-Q02=B、S3-Q03=A、S3-Q04=A。下文权限与门禁措辞记录设计批准时边界。**
>
> 后续交付结果：T031～T033/T803 已完成并归档；PR #29 合入 `dev@eec093924ae061876805c657742283097824df2c`，里程碑 PR #30 合入 `main@75e51b4e63f8c9df960cccb444515b9e89be5fbd`，并发布 `v0.1.0-beta.1`。
>
> 批准日期：2026-08-19
>
> 适用范围：S3 / E3-01～E3-03 的后续任务合同、实现、测试与 AC-07 验收设计输入
>
> 核心验收：AC-07 持久性与备份；同时回归 S1/AC-01 与 S2/AC-03、AC-04



## 0. 文档用途、依据与权限边界

本文在设计批准时把冻结产品语义、已批准工程决定、已验收 S1/S2 契约和当时 `schemaVersion = 1` 的实际数据结构收敛为 T031～T033 的整体设计。项目所有者批准本文及第 12 节四项决定后，各任务仍分别通过合同获得文件、migration、验证和 Git/GitHub 权限。

解释顺序保持为：

1. [`PRODUCT_REQUIREMENTS_V0.1.md`](../../../PRODUCT_REQUIREMENTS_V0.1.md)；
2. [`DECISIONS.md`](../../../DECISIONS.md)；
3. [`REQUIREMENTS_CHANGE_POLICY.md`](../../../REQUIREMENTS_CHANGE_POLICY.md)；
4. 总体架构、领域、数据、AI 边界、测试、追踪、实施计划与工程决定；
5. 已批准并已验收的 [`S1_CORE_LOOP_DESIGN_V0.1.md`](../../../architecture/S1_CORE_LOOP_DESIGN_V0.1.md) 和 [`S2_ROUTINE_INTENTION_DESIGN_V0.1.md`](../../../architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md)；
6. [`TASK_INDEX_V0.1.md`](../../TASK_INDEX_V0.1.md)、[`TASK_TEMPLATE.md`](../../TASK_TEMPLATE.md) 和 [`GITHUB_WORKFLOW_V0.1.md`](../../GITHUB_WORKFLOW_V0.1.md)；
7. 当前 `src/` 中已验收的 S1/S2 Domain、Application、IPC、Repository、SQLite v1 schema 和 DTO 契约。

`user/` 不属于本文依据，不得成为后续任务的设计、实现、测试或验收依赖。

本文使用以下标记：

| 标记 | 含义 |
|---|---|
| **冻结/已批准** | 直接来自 FR、AC、D、ED 或已批准 S1/S2 设计，不得由 S3 改变 |
| **现有契约** | 当前已验收的 S1/S2 代码、schema、DTO 和查询事实，实施前仍须按最新授权 `dev` 复核 |
| **S3 已批准设计** | 本文及第 12 节项目所有者选择，后续任务合同不得自行改变 |
| **延期/非范围** | 不进入 S3，不得成为 T031～T033 的接口、数据、依赖或验收前置 |

本文的设计批准和“准备实现”标注不授权：

- 修改代码、测试、配置、依赖、migration、任务索引或验收证据；
- 把任务置为 `active`，或执行 branch、worktree、代码 commit、push、PR、merge、tag 或 release；
- 执行应用、migration、导出写入或任何真实数据操作；
- 把“可以导出”描述为“已经可以自动恢复”。

## 1. 基线核对与冲突结论

### 1.1 设计批准时的当前事实

- `TASK_INDEX_V0.1.md` 将 T031、T032、T033 分别映射到 E3-01、E3-02、E3-03，当前均为 `pending`，依赖顺序为 T031 → T032 → T033。
- S1/S2 已完成 Goal、Action、Routine、TodaySelection、ActionRecord、RoutineRecord、Understanding、Confusion 和 Progress 的真实 SQLite 纵向路径；S3 必须兼容这些已验收行为。
- 设计批准时 SQLite `schemaVersion = 1`，唯一已发布 migration 为 `001_initial.sql`。v1 已具备全部核心表、状态字段、LocalDate 字段、外键和删除动作，但缺少 S3-Q02-B 已批准的 Routine 历史计划事实 provenance；T031 后续通过顺序 v2 migration 补充。
- 当前 `CorePersistenceSnapshot` 已覆盖 `goals`、`actions`、`routines`、`routineScheduleDays`、`todaySelections`、`actionRecords`、`routineRecords`、`understandings`、`confusions`、`reviewResults`；但现有 `readSnapshot()` 是测试/检查入口，没有把 `schemaVersion` 与集合绑定为一个生产导出契约，也没有在方法内部保证跨全部集合的一致性只读事务。
- 当前 Progress 没有累计表；`GetProgress` 从 ActionRecord、有效 Understanding、open Confusion 和 RoutineRecord 的一致性快照即时计算。S3 不新增可漂移累计值。
- 当前生产 AI 配置是未配置空边界，测试基础设施已有可脚本化 fake provider。S3 不依赖真实 Provider。

### 1.2 冲突结论

未发现两条 MUST、已批准 D/ED 或已验收 S1/S2 契约之间存在不可调和冲突，因此本设计可以覆盖完整 S3。

本文识别出的四项实施级选择已经由项目所有者确认：

1. 历史补记是否允许关联已完成/取消/重新安排 Action，或 paused/ended Goal/Routine；
2. RoutineRecord 补记或显式改日时，在没有 schedule 历史的 v1 中如何产生新的 `plannedForDate`；
3. 删除预览与最终执行之间的数据变化是否必须使预览失效并要求重新预览；
4. 完整导出 v1 的精确 envelope、枚举说明和安全交付规则。

第 12 节记录批准结果及未选方案，后续合同只能采用批准项。ED-008 的硬删除、ED-014 的 UTF-8 JSON、ED-017 的跨午夜语义、D-111 的完整导出且无自动导入等事项已经明确，本文不把它们重新包装成开放问题。

### 7.2 实施前兼容性门

每个任务开始前必须在最新授权 `dev` 复核：

- 启动 T031 前 schemaVersion 仍为 1、迁移清单仍只有已发布 v1，且 `001_initial.sql` 未被回写；
- v1 表、CHECK、UNIQUE、FK action 与本设计一致；
- S1/S2 DTO、RepositoryPort、Progress/Today 查询含义没有漂移；
- 现有 S1-only v1、S2 v1 和新建 v1 fixture 能迁移到 v2，核心事实守恒且 basis 回填准确；
- 未知更高 schemaVersion 继续拒绝写入，不降级覆盖。

S3-Q02-B 已批准 v2 provenance migration 的产品/设计方向，但不自动授予修改 migration 的任务权限。T031 合同必须列出精确 `002_*` SQL、允许文件、fixture 守恒、失败回滚和 `migration_change: true`，并经项目所有者批准后才能实施。若还需要本文之外的字段、表或破坏性迁移，停止并重新申请；不得回改 `001_initial.sql`。

## 8. T031～T033 任务边界

### 8.1 T031 — 修改、补记、删除预览及事务

**范围**

- ActionRecord/RoutineRecord 的显式修改与历史补记；
- Understanding 修改/撤销，Confusion 修改/resolve/reopen；
- LocalDate、分钟、outcome、唯一性和当前状态隔离；
- `planned_for_date_basis` 的非破坏性 v2 migration、旧 v1 fixture 守恒和导出兼容；
- Record/Action/Routine/Goal 的影响预览、二次确认和事务性硬删除；
- ED-008 的全部级联、解除关联、current-next 清空、取消/stale/故障零变化；
- Progress、Today、详情重查；真实关闭重开；
- Domain/Application/Repository/SQLite/IPC/Preload/Renderer 的最小纵向路径。

**非范围**

- 完整导出；自动导入/恢复；回收站、撤销、自动备份；
- Action/Routine Goal reassign、状态历史、通用审计；
- 修改 pause/end、Action 状态、Today 或 Progress 的既有语义；
- AI Provider 和 S4～S7。

**依赖**

- S1/S2 最终基线和证据可用；本文及 S3-Q01=A、S3-Q02=B、S3-Q03=A 已获项目所有者批准；
- 独立 T031 合同明确文件、验证、依赖、migration 和 Git/GitHub 权限；
- 实施前兼容性复核通过；推荐不新增依赖，但必须单独批准 `migration_change: true` 和精确 v2 migration。

**完成条件**

1. 修改/补记可观察行为覆盖 FR-L07、FR-R08 和 FR-C04，不改变父实体当前状态；
2. 修改/补记后的 Progress、Today 和详情从事实重算，改日同时影响原/新日期；历史计划确认与 basis 原子保存；
3. 全部删除根的预览与实际 ID/计数一致；stale 必须重新预览；
4. 取消、非法输入、冲突和故障注入均证明零变化；
5. ED-008 的 cascade/SET NULL/current-next 清空在一个事务内完成；
6. pause/end/complete/cancel/reschedule 回归证明不等于 delete；
7. v1 → v2 migration、失败回滚和关闭重开通过；不声明导出、完整 AC-07 或 T032/T033 完成。

### 8.2 T032 — 版本化完整导出与引用校验

**范围**

- 带 `sourceDataVersion` 的一致性完整快照；
- `MyTracerCoreExportV1` envelope、枚举说明、稳定排序和 UTF-8 JSON；
- 全部核心集合、状态、LocalDate、关系和审计字段；
- 结构、引用、枚举、敏感字段排除校验；
- 系统保存对话框、临时 sibling、复验、原子交付和写入故障；
- 导出 IPC/Preload/UI，明确“导出不等于自动恢复”；
- T031 删除后的导出回归。

**非范围**

- 自动导入、一键恢复、自动备份、云/远程目标；
- 直接导出 SQLite 文件、凭据、AI 草稿、日志或测试路径；
- 通用文件浏览/路径 API；
- 修改核心数据或执行 migration。

**依赖**

- T031 完成并有证据；本文和 S3-Q04=A 已获项目所有者批准；
- 独立 T032 合同明确外部文件写入权限、允许文件和验证；
- T031 交付的 v2 快照兼容性复核通过，且 v1 → v2 守恒证据可用。

**完成条件**

1. 全状态 fixture 导出包含全部未删除核心集合、关系和必要枚举；
2. `exportVersion=1`、实际 `sourceDataVersion`、导出时间和 LocalDate 均正确；
3. 引用/结构/敏感字段校验覆盖正反场景；
4. 取消和所有写入故障不留下被误认为有效的截断 `.json`，既有有效目标不被破坏；
5. Renderer 不提交/接收任意路径；
6. 重开后可再次导出相同核心事实；
7. UI 清楚说明没有自动导入/恢复；不声明 AI 三态回归或完整 T033 完成。

### 8.3 T033 — AI 不可用时的数据能力回归

**范围**

- 在同一隔离数据能力测试套件中运行 `disabled`、`not-configured`、`failure` 三种 AI 状态；
- 每种状态重复代表性 Goal/Action/Routine CRUD、Today、Action/Routine Record 修改/补记、Progress、删除预览/取消/确认和完整导出；
- failure 场景使用已有或语义等价 fake provider 先产生超时/认证/解析异常，再证明同一应用组合中的数据服务继续工作；
- 关闭重开和 E2E-AC-07；S1/AC-01、S2/AC-03、AC-04 受影响回归；
- 项目所有者 AC-07 人工验收程序与准确限制说明。

**非范围**

- 实现生产 Provider、Start Help、AI 配置 UI、密钥保存或 AC-02；
- 为核心 Repository、导出或删除增加 AI 依赖；
- 把测试用 fake 状态扩为新用户可见产品概念；
- 长期 AI 记忆、草稿持久化或 AI 写数据。

**依赖**

- T032 完成并有证据；T033 独立合同获批；
- fake AI 基础设施可用，且无需真实网络/key；
- 若证明 failure 必须先实现生产 AI Application/Provider，立即停止并报告依赖冲突；T033 只能做数据独立性回归。

**完成条件**

1. 三种 AI 状态下数据命令、查询和完整导出结果与 AI 状态无关；
2. AI failure 不产生核心写入，也不使 SQLite/ExportPort 失效；
3. AC-07 自动化连续通过；人工验收未执行时保持 `pending`；
4. AC-01、AC-03、AC-04 受影响回归通过；
5. 不声明 AC-02、Provider 接入或 S6 完成；
6. T031～T033 证据齐全后只能形成 G3/S3 候选，不自动授权合入 `dev/main`、tag 或 release。

### 11.3 当前兼容性结论

按本文读取的当前 S1/S2 实际契约，S3 不需要产品语义变化或依赖升级；S3-Q02-B 要求 T031 把当前 v1 非破坏性迁移为 v2，并为既有 RoutineRecord 回填 `schedule_at_recording`。该结论不替代每个任务开始前对最新授权 `dev` 的真实复核，也不替代 T031 合同中的 migration 权限。

## 14. 审批完成与后续门禁（批准时记录）

- [x] T031～T033 各有范围、非范围、依赖和可判定完成条件；
- [x] AC-07 可在同一明确 revision 连续执行；
- [x] 修改、补记、删除、导出和 AI 降级使用一致的数据所有权和 LocalDate 语义；
- [x] 影响预览与实际事务结果可按 ID/关系指纹自动验证；
- [x] 导出覆盖全部未删除核心状态、关系和必要枚举，并排除敏感/技术数据；
- [x] migration、外键、解除关联、失败回滚和关闭重开均有测试落点；
- [x] S1/AC-01、S2/AC-03 与 AC-04 已列为受影响回归；
- [x] 所有引用的 FR/AC/D/ED 编号来自当前基线；
- [x] 自动导入、回收站、自动备份、同步、审计、AI Provider 和 S4～S7 均保持非范围；
- [x] 本文不包含完整 T031～T033 Prompt，也不替代独立任务合同；
- [x] 本文获项目所有者批准时，四项 S3 决定已固定，任务启动和实现授权尚未获得。

设计批准后的原下一步是分别准备 T031、T032、T033 任务合同；该权限记录不因后续交付而改写。实际完成、归档与里程碑事实见页首、任务索引、S3 归档和 `EV-G3-S3-001`。

## 补充执行与批准上下文

### 原文片段 1

字段名可以在 T031 合同中按现有命名规范微调

### 原文片段 2

后续合同可在职责不变时调整

### 原文片段 3

后续 T031～T033 合同必须采用这些结果

### 原文片段 4

它要求 T031 合同单独授权 migration 修改，并增加

### 原文片段 5

启动合同前要求干净独立 worktree 或明确隔离

### 原文片段 6

精确 migration 权限仍由任务合同批准

### 原文片段 7

- 权限：允许 T031～T033 合同标注“准备实现”；任务启动和实现授权尚未获得。

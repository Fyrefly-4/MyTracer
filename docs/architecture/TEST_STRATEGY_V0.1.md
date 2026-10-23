# MyTracer v0.1 测试策略

> 流程启用边界：测试层级、风险和数据隔离约束供相关变更按需采用；阶段聚合验收、正式追踪和证据收口要求仅适用于 owner 明确启用的阶段流程。普通工作按影响面验证，不因查阅本文自动启用合同或执行全阶段验收。 以根目录 [AGENTS.md](../../AGENTS.md) 为准。

> 文档状态：v0.1 最终架构基线（工程决策已批准）  
> 目标：用可重复证据证明冻结语义和 AC-01～AC-07，而不是只证明页面能够打开  
> 初始化状态：测试框架、Electron E2E 驱动和 CI 已落地，原依赖审批不是当前启动门槛；现行命令与按风险验证见[维护入口](../MAINTENANCE.md)。新增/升级依赖及所有 schema 迁移仍须明确确认。

## 1. 质量风险排序

v0.1 的首要风险是语义丢失和核心数据不可控，而不是页面数量。测试优先级为：

1. 五种例行结果、部分行动、非强制意向和未知状态无损；
2. 修改、删除、跨日、重开和迁移后数据一致；
3. AI 最小上下文、确认写入和失败降级；
4. Progress、Recovery、Review 只展示事实；
5. 快速记录和 Today 的真实使用负担；
6. Windows 本地启动、文件导出和主要屏幕可用性。

## 2. 测试层级分工

| 层级 | 证明内容 | 不负责证明 |
|---|---|---|
| 领域单元 | 状态转换、不变量、日期周期、统计、纯上下文选择 | 真实数据库、界面连通性 |
| 应用单元 | 命令编排、用户确认、端口调用、失败回滚 | 具体存储/宿主行为 |
| 适配器契约 | 每个 Repository/Clock/Export/AI 适配器符合统一契约 | 整体用户流程 |
| 集成 | 存储重开、迁移、事务、关联、导出、AI 降级 | 主观体验质量 |
| 端到端 | UI—应用—领域—持久化真实连通，覆盖 AC-01～AC-07 | 所有状态组合和深层边界 |
| 人工验收 | 轻量、清晰、中性、可拒绝、恢复体验 | 自动化回归证据 |

端到端测试不替代领域测试；人工“看起来正常”也不替代数据结构和重开验证。

## 3. 测试基础设施约束

- `FakeClock` 同时控制当前瞬时值、本地日期和时区，禁止测试依赖真实当天。
- 每个测试使用独立临时 SQLite 数据库和 Electron userData 根；不得读取或清理用户真实数据。
- `FakeAiProvider` 支持成功、超时、取消、认证失败、解析失败、迟到响应和虚构事实等脚本。
- Fixture 使用需求语义命名，例如 `routine-acted-unplanned-day`，不使用厂商/数据库命名。
- 测试 ID 与 FR/AC 对应；测试报告保留版本标识、命令、环境和结果。
- 真实 Provider 测试默认禁用，不能作为常规 `test` 或 `verify` 的前置条件。
- 所有测试应可离线运行；只有显式厂商契约测试例外。

## 4. 领域单元测试

### 4.1 Goal

- 创建 active Goal；修改名称/说明不改变 ID。
- active → paused、paused → active、active/paused → ended 合法。
- pause/end 后关联 Action、Routine（若有关联）和 Record 数量不变。
- ended Goal 不自动进入 Today 候选，仍可查询历史与导出。
- AI 候选不调用 Goal 写命令；用户确认后才更新当前下一步。

覆盖：FR-G01～G06、FR-REC01/04、D-002/014。

### 4.2 Action 与 TodaySelection

- pending → completed/cancelled/rescheduled 的合法性。
- partial ActionRecord 不自动完成或失败 Action。
- 用户可以在 partial 后保持 pending、显式完成或更新下一步。
- focus/intention 由 TodaySelection 区分，不改变 Action 核心类型。
- 同一 Action 同日不能同时成为 focus 和 intention。
- 未发生 intention 不创建失败 Record，也不自动滚动到下一日。
- 历史未完成 Action 不被批量加入今天。

覆盖：FR-A01～A08、FR-T01/03～T06、AC-01/04。

### 4.3 Routine

对每个计划日和非计划日组合验证：

| Record | 真实行动次数 | 达到目标次数 | 失败评价 | 计划日达成 |
|---|---:|---:|---|---|
| `target_met` | +1 | +1 | 否 | 仅计划日为是 |
| `acted` | +1 | +0 | 否 | 否 |
| `intentional_rest` | +0 | +0 | 否 | 否 |
| `not_done` | +0 | +0 | 不产生人格评价 | 否 |
| 无 Record | +0 | +0 | 未知，不是失败 | 未知 |

另外验证：

- pause/end 保留 RoutineRecord；
- 修改 schedule 不重写历史 `plannedForDate`；
- 非计划日真实行动可记录但不伪装成计划达成；
- 补记和修正只影响目标日期的投影。

覆盖：FR-R01～R09、D-008～010、D-107、AC-03。

### 4.4 Record 与 Progress

- 快速记录只提供时长和完成程度即可保存。
- 深入字段全部缺省时仍为合法 Record。
- 时长允许估算、补记和修正；0 分钟显示为“少于 1 分钟”，且不改变真实行动 outcome。
- ActionRecord partial/stopped 均保留真实事实。
- Understanding 只有用户确认后进入 Progress；可修改/撤销。
- Confusion open/resolved 查询正确。
- 删除 Record 后总时长、次数、理解和困惑从剩余事实重算。
- 时间和次数永不推导 Understanding、掌握度或质量评分。
- 连续天数不作为主要 Progress 投影。

覆盖：FR-L01～L09、FR-C01～C04、FR-P01～P08、D-006/007/103/104。

### 4.5 日期、Recovery 与 Review

- Today 使用 FakeClock 的当前本地日。
- Record 保存后跨日查询仍位于原 `occurredOn`。
- 周一和周日边界、跨月/跨年周正确。
- RecoveryContext 返回历史成果、最近开放困惑和当前下一步，不产生缺失日 Record。
- ReviewSummary 复用已有统计；ReviewResult 只保存用户填写的进展、阻力和调整。
- Review 可以通过显式命令更新下一步，但不自动更改。

覆盖：FR-REC01～REC06、FR-RV01～RV06、D-106、AC-05/06。

### 4.6 AI 纯逻辑

- 上下文选择器只输出当前 Goal、当前 Action/下一步、相关近期 Record 和本次输入。
- 排序、截断和预算稳定可复现；其他 Goal 的唯一文本标记不出现在序列化 DTO。
- revoked Understanding 和 resolved/无关 Confusion 按规则排除。
- 输出结构限制少量建议；未通过校验的输出不能成为可确认草稿。
- 拒绝、取消、超时和解析失败产生零领域命令。
- 修改后确认只把用户最终文本交给普通应用命令。

覆盖：FR-AI01～AI10、FR-C02/03、D-012～015、D-108/109、AC-02。

## 5. 适配器契约测试

better-sqlite3 持久化适配器必须通过统一 Repository 契约套件：

- 保存并按 ID/关联读取所有领域分支；
- 单命令原子提交和故障回滚；
- 重开连接后状态一致；
- 唯一约束和引用完整性；
- 本地日期不发生隐式时区转换；
- Record 修改/删除后无孤儿；
- 数据版本读取、顺序迁移、失败回滚；
- 完整快照包含所有必需集合和状态。

Clock、Export、AI Provider 也使用契约套件，避免应用层测试依赖具体宿主。

## 6. 集成测试

### 6.1 持久化与重开

1. 创建包含所有 Goal/Action/Routine 状态及两种 Record 的数据集；
2. 关闭适配器和应用实例；
3. 从相同测试数据位置重新启动；
4. 比较领域查询和完整快照；
5. 证明 AI 完全未配置时结果相同。

### 6.2 日期与修改

- 在 23:59 创建表单、跨到次日后保存，验证经批准的日期交互规则；
- 补记过去日期并修改时长/outcome；
- 修改 Routine schedule 后历史非计划标记不变；
- 周一至周日摘要跨 DST（若宿主时区存在）仍以 LocalDate 正确分组。

### 6.3 删除与关联

- 单独删除 Record；
- 删除有/无关联数据的 Action、Routine、Goal；
- 取消确认或存储失败时零变化；
- 级联预览数量与实际影响一致；
- 暂停/结束路径不触发删除。

场景固定覆盖 ED-008 的级联、解除关联、二次确认取消和事务回滚。

### 6.4 导出

- 从包含全部状态的 fixture 生成导出；
- 验证 exportVersion、sourceDataVersion、引用、枚举和本地发生日；
- 验证 ended/cancelled/rescheduled、TodaySelection、ReviewResult 均覆盖；
- 验证 API 密钥、AI 草稿、日志、缓存和测试路径不存在；
- 模拟写入中断，证明不会报告成功或留下被误认为有效的截断文件。

### 6.5 AI

- fake provider 收到的 DTO 与选择 manifest 完全一致；
- AI 关闭/失败时 CRUD、Progress 和导出继续工作；
- 迟到响应在用户取消后被忽略；
- 用户确认后普通命令失败时事务回滚并显示未保存。

## 7. 端到端验收骨架

### E2E-AC-01 React 学习完整流程

创建 Goal 和可执行下一步 → 创建/关联 Action → 用户选入 Today → 快速记录 → 可选添加理解、困惑、下一步 → Progress 验证时间、次数和确认理解 → 重开后复核。

### E2E-AC-02 难以开始

打开 Today Action → 主动触发 AI → 检查 fake provider 最小上下文 → 显示温和小建议 → 分别执行拒绝、修改、接受 → 确认前后比较核心数据。

### E2E-AC-03 每日轻量活动

创建 Routine 和最低行动 → Today 显示计划例行 → 分别记录 target_met、acted、intentional_rest、not_done 和空白日 → Progress/Review 验证五种含义。

### E2E-AC-04 个人时间意向

创建通用 Action → 作为 intention 选入 Today → 跨日未发生 → 验证无失败、无自动 Record、无兴趣专属模块。

### E2E-AC-05 中断后恢复

准备历史 Goal、Record、理解、困惑和下一步 → FakeClock 前进多日 → 重开 → 查看历史与上下文 → 不补空白日 → 暂停过时内容并选择小行动。

### E2E-AC-06 最小复盘

准备周期事实 → 进入 Review → 验证摘要来自现有统计 → 确认一个进展、记录一个阻力和一个调整 → 可选更新下一步。

### E2E-AC-07 持久性与备份

创建并修改全部核心数据 → 重开 → 删除错误 Record → 完整导出 → 自动检查结构和关联 → 关闭 AI 后重复核心操作。

## 8. 人工体验验收

项目所有者按真实 Windows 环境判断：

- 第一次创建 Goal 是否无需理解项目层级、优先级和截止日期；
- 快速记录是否只需最低字段即可完成且不被深入字段阻挡；
- Today 是否能清楚区分 focus、intention 和 Routine；
- “有所行动”、主动休息、未进行、未记录文案是否中性且无暗含排名；
- 中断返回是否先展示成果和可开始下一步，而不是断签或大量逾期；
- AI 建议是否具体、温和、易修改/拒绝，且失败时不会卡住使用；
- 导出能力是否准确表达为导出而非已具备恢复。

人工结果记录为通过、失败或部分通过，并附观察；等待人工验收不能声称通过。

## 9. 工程质量与平台验证

技术栈确认后建立固定命令，至少覆盖：

```text
format:check     // 只检查，不改写
lint
typecheck
test:unit
test:integration
test:e2e
build
verify           // 聚合上述非破坏命令
```

命令名称可以调整，但必须文档化且可重复。主要验收平台为 Windows；若选择跨平台桌面技术，其他平台构建不自动升级为 v0.1 MUST。

## 10. 阶段门

进入真实自用前：

- 69 条 MUST 对应自动化或人工测试均有实际结果；
- AC-01～AC-07 已在同一明确版本上执行；
- 五种例行语义、AI 隔离、重开和完整导出具有自动化证据；
- 测试没有访问真实数据或真实 AI；
- 所有失败、未完成 SHOULD 和平台限制如实报告；
- 文档、实现和用户可见行为一致。

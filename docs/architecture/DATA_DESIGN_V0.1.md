# MyTracer v0.1 数据设计

> 文档状态：v0.1 最终架构基线（工程决策已批准）  
> 范围：逻辑持久化、日期、修改、删除、版本、完整导出和测试隔离  
> 已批准实现：Electron Main + better-sqlite3 + 版本化 UTF-8 JSON 导出

## 1. 数据设计目标

- 刷新或重新打开后保留 Goal、Action、Routine、Record 及必要关联和状态。
- 对五种例行语义、部分行动、非强制意向和 AI 未确认草稿进行无损区分。
- 支持补记、修改和删除后重新得到可解释的事实统计。
- 通过版本化完整导出让用户取得核心数据，同时准确声明 v0.1 不提供自动导入恢复。
- 使用 SQLite 保持关系、事务和本地单文件存储；RepositoryPort 隔离领域命令与 SQL。

## 2. 逻辑数据集合

| 集合 | 必需内容 | 主要关联 |
|---|---|---|
| `goals` | ID、名称、说明、状态、当前下一 Action、审计时间 | 可选关联 Action/Routine |
| `actions` | ID、可空 Goal ID、文本、状态、审计时间 | ActionRecord、TodaySelection |
| `routines` | ID、可空 Goal ID、文本、状态、星期集合、最低行动 | RoutineRecord |
| `actionRecords` | 发生日、时长、完成程度、可选深入记录 | Action、Understanding、Confusion |
| `routineRecords` | 发生日、四种显式结果、是否计划日、可选时长/说明 | Routine |
| `todaySelections` | Action、日期、focus/intention | Action |
| `understandings` | 文本、确认来源、撤销/有效信息 | ActionRecord、Goal 投影 |
| `confusions` | 文本、open/resolved | ActionRecord、Goal 投影 |
| `reviewResults` | 周期、进展、主要阻力、一个调整 | 可选 Goal |
| `metadata` | 数据版本、创建/迁移信息 | 全库 |

逻辑集合映射到下列 SQLite 表；理解、困惑等内部子实体仍不增加用户可见一级概念。

### 2.1 SQLite 物理表

| 表 | 关键字段与约束 | 删除行为 |
|---|---|---|
| `metadata` | `key TEXT PRIMARY KEY, value TEXT`；保存 `schemaVersion` | 应用管理 |
| `goals` | UUID 主键；`status` CHECK；`current_next_action_id` 可空 | 显式删除时级联所拥有 Action；关联 Routine 先解除 |
| `actions` | UUID 主键；`goal_id` 可空；`status` CHECK | 级联 ActionRecord、TodaySelection |
| `routines` | UUID 主键；`goal_id` 可空；`status` CHECK；`minimum_action` 非空 | 级联 RoutineRecord、schedule days |
| `routine_schedule_days` | `(routine_id, weekday)` 复合主键；weekday 取 1～7 | 随 Routine 级联 |
| `today_selections` | `(action_id, selected_for)` 唯一；commitment CHECK | 随 Action 级联 |
| `action_records` | UUID 主键；Action 外键；LocalDate；`duration_minutes >= 0`；outcome CHECK | 随 Action 级联 |
| `routine_records` | UUID 主键；Routine 外键；LocalDate；outcome CHECK；`planned_for_date` 布尔 | 随 Routine 级联；同一 Routine/日期最多一条 |
| `understandings` | UUID 主键；ActionRecord 外键；source CHECK；可空 `revoked_at` | 随 ActionRecord 级联 |
| `confusions` | UUID 主键；ActionRecord 外键；status CHECK | 随 ActionRecord 级联 |
| `review_results` | UUID 主键；周期 LocalDate、三个用户结果、可空 Goal ID | Goal 删除时解除关联并保留 |

SQLite 启用 foreign keys 和 WAL。`current_next_action_id` 必须引用同一 Goal 下 pending Action 的跨行约束由应用事务验证；数据库外键负责防止悬空引用。SQL 只存在于 Main Process 的 Repository/migration 层。

## 3. 标识与引用

- 所有可独立修改或删除的核心事实使用稳定、不从标题或日期派生的 ID。
- ID 使用 Electron Main 的 `crypto.randomUUID()` 生成 UUID v4，可在本地离线生成且导出后保持不变。
- 引用删除不能留下无法解释的孤儿 Record。
- 若 Goal/Action/Routine 名称后来修改，Record 仍引用同一 ID；进展显示当前名称还是保存快照属于交互决定，导出必须保留可解析关联。
- 内部顺序不得依赖数据库隐含行顺序；查询使用明确的发生日、创建时间和 ID 作为稳定排序键。

## 4. 日期和时间

### 4.1 三类时间值

| 类型 | 建议表示 | 用途 |
|---|---|---|
| `LocalDate` | `YYYY-MM-DD` | Today、Record 发生日、例行计划日、周期边界 |
| `Instant` | UTC ISO 8601 或等价整数 | createdAt、updatedAt、导出时间、诊断关联 |
| `TimeZoneContext` | 系统 IANA 时区 ID和当前偏移 | 解释导出与诊断；历史行为以 LocalDate 为权威 |

### 4.2 规则

- “今天”在每个应用命令或查询开始时从 `ClockPort.currentLocalDate()` 获取。
- 表单打开时固定显示的发生日；若保存时已跨日，提示用户保留原日期或改为今天，不能静默移动。
- 补记必须由用户选择历史 `occurredOn`；`createdAt` 仍记录实际保存瞬时值。
- 修改历史记录默认不改变 `occurredOn`，除非用户显式修改日期。
- 周范围由包含目标日期的周一 00:00 到周日结束构成；领域计算使用 LocalDate，不依赖数据库周编号。
- v0.1 不处理跨用户时区、旅行自动重排或复杂跨时区统计。

## 5. 例行日期事实

- Routine schedule 只定义“通常发生日”；它本身不预生成未来 Record。
- 计划日没有 RoutineRecord 时，在查询时显示“未记录/未知”。
- `not_done` 只能由用户明确保存。
- 非计划日保存真实行动时保存 `plannedForDate = false` 快照，证明它不是计划达成；版本化 schedule 可用于复核但不覆盖快照。
- 修改 Routine schedule 不得倒算和重写历史记录的 `plannedForDate`；否则历史含义会随配置变化。

## 6. 修改策略

| 操作 | 数据行为 |
|---|---|
| 修改 Goal/Action/Routine 文本 | 更新当前实体和 updatedAt，不改历史 Record 身份/发生日 |
| pause/end | 更新生命周期状态，保留全部关联历史 |
| 修改 Record | 在单事务中验证新值并重算受影响查询；保留 ID |
| 修改 RoutineRecord outcome | 原子替换显式 outcome，不产生“未记录”行 |
| 修改 Understanding | 更新已确认文本；不得由 AI 后台修改 |
| 撤销 Understanding | 写入 `revokedAt`；普通进展不再显示，显式删除仍按硬删除处理 |
| 解决 Confusion | 显式更新 resolved 信息；不得因新 Record 自动猜测已解决 |

v0.1 不要求通用审计日志或事件溯源。若实现选择保存最小状态历史，只能用于满足重新安排或数据安全，不能扩展为通用工作流平台。

## 7. 删除策略

- 使用硬删除，不建立回收站或通用软删除。
- Record 可单独删除；删除后从剩余事实重算投影。
- Action 级联 ActionRecord 和 TodaySelection，并清空引用它的 `current_next_action_id`。
- Routine 级联 RoutineRecord 和 schedule days。
- Goal 级联其 Action/ActionRecord；关联 Routine 和 ReviewResult 解除 `goal_id` 后保留。
- 父对象删除前展示各类型关联数量并二次确认；取消或事务失败产生零变化。
- Goal/Routine pause/end 永远只更新状态并保留历史。
- 自动备份、回收站或撤销不进入 v0.1；用户可在删除前主动完整导出。

## 8. 数据版本和迁移

### 8.1 版本模型

- 存储维护单调递增 `schemaVersion`；
- 应用启动先读取版本，再选择零个或多个顺序迁移；
- 不支持比应用已知版本更高的数据时，应停止写入并给出可诊断错误，不能尝试降级覆盖；
- 迁移必须幂等或由迁移表保证只执行一次；
- 有事务能力的存储中，每个迁移或迁移批次必须原子执行。

### 8.2 迁移边界

- v0.1 建立迁移入口和初始版本，不为未知后续功能预建字段。
- 迁移测试必须包含旧版 fixture → 新版读取 → 核心事实守恒。
- 破坏性迁移在实施前需要项目所有者批准和备份方案。
- “可迁移”不等于实现自动导入；FR-D07 仍延期。

## 9. 完整导出契约

### 9.1 逻辑结构

```text
MyTracerExport
  format                 // mytracer-core-export
  exportVersion          // 导出契约版本
  sourceDataVersion      // 本地 schemaVersion
  appVersion?
  exportedAt
  localTimeZone?
  data
    goals[]
    actions[]
    routines[]
    records[]            // 判别联合或两个明确集合
    todaySelections[]
    understandings[]
    confusions[]
    reviewResults[]
```

当前导出为 UTF-8 JSON，`exportVersion=2`、`sourceDataVersion=3`，默认文件名 `mytracer-export-YYYY-MM-DD-v2.json`，通过系统保存对话框由用户选择位置。S4/S5 已批准 schema v3/export v2；严格 export v1 验证只用于兼容契约，不是当前生成格式，也不提供自动导入恢复。当前可执行契约见 `src/application/complete-export.ts` 与 `src/application/ports/export.ts`，批准依据见 S4/S5 设计及 EV-T052-001。上方结构是逻辑概览，实际包括 `enumValues`、分开的 `actionRecords`/`routineRecords` 和十个 data 集合。

### 9.2 包含和排除

必须包含：

- 活跃、暂停、结束 Goal/Routine；
- pending、completed、cancelled、rescheduled Action；
- 所有未删除 ActionRecord/RoutineRecord及其发生日、结果和必要关联；
- 用户确认的 Understanding、Confusion 状态、当前下一步；
- TodaySelection 和 ReviewResult，因为它们影响恢复与完整核心状态；
- 导出和源数据版本。

必须排除：

- AI API 密钥和厂商凭证；
- 未确认 AI 草稿、临时请求/响应和跨会话对话历史；
- 技术日志、缓存和测试数据；
- 不属于当前核心状态的系统环境信息。

### 9.3 一致性

- 导出从一个只读一致性快照产生；
- 先在内存或临时目标完成序列化和结构验证，再交付最终文件；
- 写入失败不得产生看似成功的截断文件；
- 自动化测试验证所有引用都指向导出内对象，或按已确认删除策略明确为空。

界面和用户文档必须称其为“导出/备份文件”，不得承诺 v0.1 已能自动恢复。

## 10. 已批准存储实现

- 数据库位于 Electron `userData` 根下的应用私有子目录，文件名固定为 `mytracer.sqlite3`；具体绝对路径由 Electron 在运行时解析，不从 Renderer 输入。
- Main Process 使用 `better-sqlite3`，不使用 MySQL、IndexedDB、localStorage、SQLite WASM 或 Node 当前 Release Candidate 的 `node:sqlite`。
- 不引入 ORM；Repository 使用参数化 SQL，migration 使用按版本排序的显式 SQL 文件。
- SQLite 与 `better-sqlite3` 的具体版本属于依赖批准内容；安装后必须同时验证开发运行和 Windows 打包产物。
- 数据库文件不放入应用安装目录或 ASAR，也不允许 Renderer 获取任意数据库路径。

## 11. 测试与真实数据隔离

- 每次测试创建独立临时 SQLite 数据库；
- 测试注入固定 `ClockPort`，不得依赖执行机器当日日期；
- 生产数据路径与测试数据路径由组合根明确分开；
- 测试结束只清理本次生成且已验证位于测试临时根的内容；
- E2E 重开测试必须关闭并重新建立存储连接，而不是复用内存状态；
- 导出测试写入临时目标并验证结构、关联、状态集合和敏感字段排除。

## 12. 已批准数据决定

1. Electron Main 独占 SQLite 和文件能力；
2. `better-sqlite3` + 手写迁移/Repository，不引入 ORM；
3. UUID v4、非负整数分钟、LocalDate 权威日期；
4. Goal 当前下一步引用 Action，Action/Routine 的 Goal 外键可空；
5. 事务性硬删除及已定义级联/解除关联规则；
6. UTF-8 JSON 完整导出，自动导入延期；
7. 长期未推进只显示距上次真实行动天数，不设系统阈值；
8. 同一 Action 的每条有效 Record 分别计次。

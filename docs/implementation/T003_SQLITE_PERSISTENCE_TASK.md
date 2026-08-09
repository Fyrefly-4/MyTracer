# T003：SQLite 持久化、初始 schema、migration 与 Repository 契约任务合同

> 合同状态：`done`
> 创建日期：2026-08-08
> 当前任务账本状态：`done`；自动验证和 T003 工程证据已完成，产品人工验收仍不适用
> 审批记录：项目所有者于 2026-08-08 全部确认本合同第 21 节事项，并于 2026-08-09 明确发出“开始 T003”指令
> 启动记录：重新核验远端 `origin/dev`、PR #2、Windows gate、工作树和 worktree 通过；任务分支 `task/T003-sqlite-migrations` 从 `e64929057724f6458a798479d19de41a710a3028` 创建

## 1. 任务信息

- **Task ID**：T003
- **Title**：Establish SQLite persistence, initial schema, migrations, and Repository contracts
- **Slice / Plan item**：S0 / E0-03
- **Status**：`done`
- **Base branch**：`dev`
- **Expected branch**：`task/T003-sqlite-migrations`
- **已核验远端基线**：`e64929057724f6458a798479d19de41a710a3028`
- **执行前要求**：不得只依赖本合同快照；启动实现前必须重新只读核验最新实时 `origin/dev`、PR #2 合入状态、工作树和 worktree。

## 2. 前置状态核验

2026-08-08 的只读核验结果：

- PR #2 `T002: establish isolated validation toolchain` 已于 `2026-08-08T05:41:27Z` 合并到 `dev`；
- PR #2 head 为 `55b2df01b584c48846f82053aae3a65139647c30`，squash merge commit 为 `e64929057724f6458a798479d19de41a710a3028`；
- PR #2 最新 `Verification / Windows required gate` 为 `SUCCESS`；
- 远端实时 `refs/heads/dev`、本地 `origin/dev`、本地 `dev` 和当前 `HEAD` 均为 `e64929057724f6458a798479d19de41a710a3028`；
- 当前检出为本地 `dev`，仅有一个 worktree；创建本草案前工作树干净；
- T001/T002 合同和任务索引均为 `done`，证据分别为 `EV-T001-001`、`EV-T002-001`；T002 的临时数据根、测试命令和 hosted Windows CI 基础已进入最新 `dev`；
- PR #2 采用 squash merge，因此任务分支 SHA 不要求成为 `dev` 的祖先；合入事实以 PR merge 元数据、merge commit 和 `dev` 内容为准。

若实现启动前重新核验发现 PR #2 未合入最新远端 `dev`、T002 内容不在最新 `dev`、远端出现无法解释的新 revision，或存在重叠用户修改，T003 必须保持 `pending`/记录为阻塞并停止，不得从 T002 task branch、旧 `dev` 或临时提交绕过。

## 3. 目标结果

在 Electron Main 建立可验证的 SQLite 持久化基础，但不实现业务用例：

- 使用获批精确版本的 `better-sqlite3`；
- 由 Main 独占数据库路径、连接、migration、事务和 Repository 适配器；
- 建立 `schemaVersion = 1` 的 v0.1 初始 schema 和显式、按版本排序的 migration 入口；
- 所有运行时数据 SQL 使用参数化绑定，所有关联写入通过显式事务原子提交；
- 每个连接启用并验证 `foreign_keys`，文件数据库启用并验证 WAL；
- 建立 `RepositoryPort`、`UnitOfWorkPort` 和统一 Repository 契约套件，验证保存/读取、引用完整性、回滚、重开和版本行为；
- 开发模式、Node 24.18.0、Electron 43.3.0 和 Windows x64 unpacked/packaged 产物实际加载原生模块；
- 所有自动化测试复用 T002 的唯一临时数据根，并为每个 case/进程创建独立临时数据库。

T003 只证明持久化基础和适配器契约成立。它不证明 Goal/Action/Routine/Record 业务命令、T004 日期/配置、完整导出、AC-01～AC-07 或 G2 已完成。

## 4. 需求与决定依据

- **FR**：FR-D01（仅建立后续重开持久性的基础，不单独声明用户可见 FR-D01 完成）。
- **AC**：无直接完成的 AC；重开和数据库加载测试不是 AC-07 完整验收。
- **D**：D-003、D-009、D-015～D-017、D-103、D-106、D-111。
- **ED**：ED-003、ED-004、ED-005、ED-006、ED-008、ED-009、ED-012、ED-014～ED-018。
- **GW**：GW-001～GW-004、GW-008～GW-010。
- **直接相关架构章节**：
  - `docs/architecture/ARCHITECTURE_V0.1.md` §3～§5、§7、§9；
  - `docs/architecture/DOMAIN_MODEL_V0.1.md` §2～§7、§9～§10；
  - `docs/architecture/DATA_DESIGN_V0.1.md` §1～§8、§10～§12；
  - `docs/architecture/ENGINEERING_DECISIONS_V0.1.md` ED-003、ED-018；
  - `docs/architecture/IMPLEMENTATION_PLAN_V0.1.md` §3 E0-03；
  - `docs/architecture/TEST_STRATEGY_V0.1.md` §2、§3、§5、§6.1、§9；
  - `docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md` FR-D01；
  - `docs/implementation/GITHUB_WORKFLOW_V0.1.md`。

## 5. 开始条件

- [x] T001/T002 已合并到核验时最新 `origin/dev`，任务与证据账本存在真实记录。
- [x] T002 的稳定验证命令、FakeClock/FakeAiProvider 和唯一临时数据根已建立。
- [x] 当前冻结需求、批准架构和本草案之间未发现 MUST 冲突或范围变化。
- [x] T003 初始 migration 为新库 `0 -> 1`，不迁移真实用户库，也不包含破坏性或不可逆迁移。
- [x] 项目所有者已批准第 6 节精确依赖建议及精确 `allowScripts` 条目。
- [x] 项目所有者已批准在 T003 明确启动后安装依赖及必要的 npm/原生预构建二进制网络下载；源码编译和额外 rebuild 工具不授权。
- [x] 项目所有者已批准第 7～10 节数据库路径、schema/migration、Repository 和 Unit of Work 契约。
- [x] 项目所有者已批准在 T003 明确启动后创建本地 branch/worktree 和 commit。
- [x] 项目所有者已批准在 T003 明确启动后 push、创建/更新 Draft PR 并触发现有 GitHub Actions。
- [x] 启动前已重新核验最新实时 `origin/dev`、PR #2、工作树和 worktree；唯一未跟踪项为本合同。

项目所有者已发出明确启动指令，启动门满足；T003 已转为 `active`。实现、验证、提交和获批发布仍必须遵守本合同范围。

## 6. 精确依赖建议（待批准）

### 6.1 保持不变的工程基线

| 工具 | 精确版本 | T003 处理 |
|---|---:|---|
| Node.js | 24.18.0 | 不升级 |
| npm | 11.16.0 | 不升级 |
| Electron | 43.3.0 | 不升级 |
| TypeScript | 6.0.3 | 不升级 |
| electron-builder | 26.15.3 | 不升级 |

### 6.2 建议新增的直接依赖

| 分类 | 包 | 精确版本 | 用途 |
|---|---|---:|---|
| `dependencies` | `better-sqlite3` | `13.0.1` | Electron Main 的 SQLite 原生驱动 |
| `devDependencies` | `@types/better-sqlite3` | `7.6.13` | 当前公开的 DefinitelyTyped 类型定义 |

版本约束：

- `package.json` 使用精确版本，不使用 `^`、`~` 或 `latest`；
- 建议只新增 `allowScripts["better-sqlite3@13.0.1"] = true`，用于 npm 对该包 `binding.gyp` 的隐式安装检查；预期 `win32-x64` 预构建存在时原生编译 target 为 no-op。安装日志若显示实际源码编译，立即停止；
- `package-lock.json` 由已批准的 npm 11.16.0 更新，传递依赖由锁文件精确固定；
- 不新增 ORM、migration 框架、query builder、`sqlite3`、`@electron/rebuild`、AI SDK 或其他包；
- 若实际安装需要新的直接依赖、不同版本、源码编译工具链或未批准脚本，立即停止并重新请求批准；
- `@types/better-sqlite3@7.6.13` 只用于已采用的基础 API。若类型与 13.0.1 实际 API 不一致，不得用 `any`、跳过检查或自行换包；应停止并提交最小替代方案。

### 6.3 兼容依据与必须实测的风险

调研日期为 2026-08-08，依据如下：

1. `better-sqlite3@13.0.1` 是 npm 当前精确 latest；其包清单声明 Node `>=22`，覆盖 Node 24.18.0，并直接包含 `prebuilds/**` 与 `win32-x64` 入口。
2. 13.0.0 起驱动迁移到 Node-API，预构建二进制随包发布；13.0.1 修复跨 realm 参数绑定回归。其 `binding.gyp` 固定 `NAPI_VERSION=10`。
3. Node 官方矩阵表明 Node-API 10 自 Node 22.14.0 起受支持；当前 Node 24.18.0 和 Electron 43 内置 Node 24.17.0 均满足。
4. Electron 官方说明原生模块必须匹配目标 ABI/平台/架构；Node-API 提供 ABI 稳定性，但仍必须验证目标 Electron、Windows x64 和打包形态。
5. `better-sqlite3@13.0.1` 包内 `win32-x64` 绑定降低了本项目含空格路径触发 `node-gyp` 回退的概率；这不是实测通过。若发生源码编译回退，必须停止并报告，不得自动安装编译工具。
6. 当前 `electron-builder.yml` 为 `npmRebuild: false`。本建议依赖包内 Node-API 预构建二进制，不新增 rebuild 工具；最终是否可保持该配置必须由开发、unpacked 和 packaged 实测决定。任何改为 rebuild 的方案需另行批准。

调研来源：

- [`better-sqlite3@13.0.1` package.json](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.1/package.json)
- [`better-sqlite3` v13.0.0 release](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0)
- [`better-sqlite3` v13.0.1 release](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.1)
- [Node.js 24.18.0 Node-API version matrix](https://nodejs.org/download/release/v24.18.0/docs/api/n-api.html#node-api-version-matrix)
- [Electron 43 stack versions](https://www.electronjs.org/blog/electron-43-0)
- [Electron native Node modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [`@types/better-sqlite3@7.6.13`](https://www.npmjs.com/package/@types/better-sqlite3)

以上只是批准建议和启动依据。兼容性只有在第 15～16 节全部实际验证通过后才能记录为 T003 证据。

## 7. 数据库位置、连接和版本契约（待批准）

### 7.1 生产路径

- 建议固定为 `<Electron userData>/data/mytracer.sqlite3`；绝对 `userData` 只由 Electron Main 在运行时解析。
- Renderer、Preload DTO、日志和错误消息不得暴露任意数据库绝对路径。
- Main 在打开数据库前创建受控的 `data/` 私有子目录；数据库不得位于安装目录、ASAR、仓库或用户任意选择路径。
- 自动化测试不得调用生产路径解析；测试必须显式注入 T002 临时根下的数据库路径。

### 7.2 测试路径

每个 test/case/进程使用：

```text
<T002 unique temporary root>/
  electron-user-data/
  database/
    mytracer.sqlite3
    mytracer.sqlite3-wal?  // 仅在 WAL 生命周期中存在
    mytracer.sqlite3-shm?  // 仅在 WAL 生命周期中存在
  exports/
  artifacts/
```

- 不允许测试路径缺失时回退到生产 `userData`；
- 每个测试数据库独立，不使用共享固定路径或真实数据库副本；
- 清理只通过 T002 已验证的 canonical containment/ownership helper 执行；
- 重开测试必须关闭原连接，再从同一临时数据库文件建立新连接；不得用内存对象模拟重开。

### 7.3 连接初始化

每个连接在任何 Repository 操作前必须：

1. 打开调用方显式提供且已验证的数据库路径；
2. 执行并读取验证 `PRAGMA foreign_keys = ON`；若未生效则关闭连接并失败；
3. 对可写文件数据库启用并读取验证 `PRAGMA journal_mode = WAL`；不得用测试跳过掩盖失败；
4. 读取 `schemaVersion`，按第 9 节运行零个或多个 migration；
5. 只有初始化和 migration 全部成功后才向组合根返回可用 Repository。

不在 T003 中加入未批准的性能 pragma、自动备份、加密、共享缓存、连接池或后台 checkpoint 策略。

## 8. 初始 schema v1

初始 migration 只建立已批准的 v0.1 当前集合：

| 表 | 必需字段/约束摘要 |
|---|---|
| `metadata` | `key TEXT PRIMARY KEY, value TEXT NOT NULL`；保存 `schemaVersion = 1` |
| `goals` | UUID 文本主键；名称非空；description 可空；`active/paused/ended` CHECK；`current_next_action_id` 可空；审计瞬时值 |
| `actions` | UUID 文本主键；`goal_id` 可空；title 非空；description 可空；`pending/completed/cancelled/rescheduled` CHECK；审计瞬时值 |
| `routines` | UUID 文本主键；`goal_id` 可空；name、`minimum_action` 非空；description 可空；`active/paused/ended` CHECK；审计瞬时值 |
| `routine_schedule_days` | `(routine_id, weekday)` 复合主键；weekday CHECK 1～7 |
| `today_selections` | `(action_id, selected_for)` 复合主键；`focus/intention` CHECK；`selected_by = user` |
| `action_records` | UUID 主键；Action 外键；`occurred_on` 文本 LocalDate；非负整数分钟；`completed/partial/stopped` CHECK；可选 next step/note；审计瞬时值 |
| `routine_records` | UUID 主键；Routine 外键；LocalDate；四种显式 outcome CHECK；`planned_for_date` 仅 0/1；可空非负整数分钟/note；同 Routine/日期唯一；审计瞬时值 |
| `understandings` | UUID 主键；ActionRecord 外键；text 非空；`manual/ai_candidate_confirmed` source CHECK；`revoked_at` 可空；审计瞬时值 |
| `confusions` | UUID 主键；ActionRecord 外键；text 非空；`open/resolved` CHECK；resolved 信息可空；审计瞬时值 |
| `review_results` | UUID 主键；周期起止 LocalDate；三个用户结果非空；`goal_id` 可空；审计瞬时值 |

外键删除规则必须与 ED-008/Data §7 一致：

- Action 删除：级联 `action_records`、其 Understanding/Confusion、`today_selections`；引用它的 Goal `current_next_action_id` 置空；
- Routine 删除：级联 `routine_records`、`routine_schedule_days`；
- Goal 删除：级联其 Action/ActionRecord；Routine 和 ReviewResult 的 `goal_id` 置空保留；
- pause/end 不是 schema 级删除操作，不得触发级联；
- 数据库外键防止悬空引用；“current next action 必须属于同一 Goal 且为 pending”等跨行领域不变量留给后续应用事务验证，不得用 trigger 提前实现业务。

Schema 不得包含账号、同步、插件、优先级、截止日期、标签、搜索、提醒、通用审计日志、事件溯源、AI 对话/草稿/凭据、自动导入或 T004 日期计算字段。`unrecorded/unknown` 不得保存为 `routine_records.outcome`；缺行保持未知。

## 9. Migration 契约

- 当前已知 schema 版本固定为整数 `1`；空新库视为版本 `0`。
- 使用显式 SQL 文件，例如 `src/infrastructure/sqlite/migrations/001_initial.sql`；migration manifest 在代码中按版本显式列出，不扫描任意目录、不接收 Renderer 输入。
- 启动读取版本后，只允许连续执行 `current + 1` 的 migration；缺号、重复号、版本倒退或未知状态必须失败。
- 新库 `0 -> 1` 在单个显式事务内创建完整 schema 并写入 `metadata.schemaVersion = 1`。
- 已为版本 1 时执行零次 migration，不重建、不重写、不产生额外业务数据。
- 数据库版本高于应用已知版本时，在任何业务写入前关闭写入口并返回可诊断错误；不得降级、覆盖或尝试恢复。
- metadata 缺失但存在非本任务预期用户表时视为未知数据库状态并停止，不得假定为空库。
- migration 失败必须回滚 schema 和版本写入；失败后不得返回半初始化 Repository。
- migration SQL 是版本控制内的受信 DDL；业务值不得通过字符串拼接进入 migration。所有 Repository 数据 SQL 必须参数化。
- T003 只交付初始非破坏性 migration。任何未来破坏性/不可逆 migration 均需项目所有者另行批准和备份方案。
- “支持 migration”不等于实现 FR-D07 自动导入恢复。

## 10. Repository 与 Unit of Work 契约

### 10.1 端口边界

- `RepositoryPort` 与 `UnitOfWorkPort` 定义在 Application 可依赖、但不依赖 Electron/SQLite 的端口目录；具体 `better-sqlite3` 实现位于 `src/infrastructure/sqlite/**`。
- 合同覆盖架构已批准的 Goal、Action、Routine、两种 Record、TodaySelection、Understanding、Confusion、ReviewResult 和完整核心快照持久化形状。
- T003 可以定义实现存储所需的端口 DTO/判别联合，但不得实现应用命令、生命周期决策、Progress/Today/Recovery/Review 统计或 UI。
- Repository 负责保存/读取和关联查询，不解释“成功/失败/掌握度”等产品统计语义。
- 所有写入只在显式 Unit of Work 中提交；一次调用成功则完整提交，任一 SQL/约束/回调失败则完整回滚。
- 不跨用户交互、IPC 等待或 AI 请求保持数据库事务。

### 10.2 SQL 规则

- 所有用户/领域值使用 `better-sqlite3` 参数绑定；禁止模板字符串拼接值。
- 动态表名、列名和排序方向不得来自 Renderer 或任意运行时输入；允许项使用代码内固定 statement。
- statement 返回行必须显式映射并进行必要的运行时形状检查；不得把原始数据库对象直接暴露给 Renderer。
- 查询使用明确排序键（LocalDate、createdAt、ID），不得依赖隐含 row order。
- Repository 不读取系统时间；T003 测试中的日期/瞬时值全部由 fixture/FakeClock 显式提供，T004 才建立生产 ClockPort/LocalDate 规则。

### 10.3 统一契约套件

同一套 Repository contract tests 至少验证：

- 所有当前集合的保存、按 ID 读取、关联读取和完整快照；
- 每个批准枚举分支和 nullable 关联无损往返；
- `unknown/unrecorded` 只由缺少 RoutineRecord 表达；
- LocalDate 字符串往返不发生隐式 UTC/时区转换；
- UUID、非负整数分钟、唯一约束、CHECK 和 foreign key 生效；
- 参数中包含引号、分号和 SQL 片段样文本时只作为数据，不改变 statement；
- 单命令原子提交、注入故障回滚和连接关闭行为；
- 关闭并重开真实临时 SQLite 文件后，查询和完整快照一致；
- schemaVersion 读取、0→1 顺序 migration、版本 1 no-op、未来版本拒写和失败回滚；
- 关闭连接后无句柄继续写入，WAL sidecar 只存在于本次临时根。

## 11. 允许修改范围（仅在整体批准并转为 active 后）

- `package.json`：只加入第 6.2 节批准依赖和必要的、明确批准的非破坏性验证 script；
- `package-lock.json`；
- `electron-builder.yml`：仅为包含/解包已批准原生模块或 T003 Windows x64 验证所需的最小配置；不得启用发布、签名或改变目标；
- `electron.vite.config.ts`：仅为 Main 打包原生依赖和显式 SQL migration 所需的最小配置；
- `tsconfig*.json`：仅为 T003 新文件和 SQL module 声明所需的最小调整；
- `src/application/ports/**` 或仓库现有等价位置：Repository/UnitOfWork 端口与持久化 DTO；
- `src/infrastructure/sqlite/**`：路径、连接、migration、schema、Repository 和组合装配辅助；
- `src/infrastructure/index.ts`：只导出 T003 持久化入口；
- `src/main/**`：仅限 Main 组合根中数据库路径解析、初始化、关闭和隔离测试 seam；
- `tests/unit/**`：纯 migration manifest/端口/映射测试；
- `tests/integration/**`：真实临时 SQLite、Repository 契约、migration、事务、重开测试；
- `tests/e2e/**`：仅限 Electron 43 隔离 `userData` 下的原生模块/数据库初始化和重开冒烟；
- `tests/support/**`：复用/最小扩展 T002 临时根以提供独立数据库路径和 fixture；
- `.gitignore`：仅加入 T003 临时数据库/WAL/SHM 或诊断产物模式；
- `.github/workflows/verify.yml`：仅在本合同明确批准且确有必要时加入 Windows 原生模块验证，不改变稳定 workflow/job 名称或权限；
- `README.md`：仅记录实际存在的 T003 命令、原生模块要求和当前事实；
- `docs/implementation/TASK_INDEX_V0.1.md`：仅在执行授权包含状态更新时修改 T003 行；
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`：仅记录真实 T003 结果；
- 本合同：仅反映实际批准、状态、结果和证据。

任何超出范围的必要修改必须先停止、说明原因并获得项目所有者批准。

## 12. 明确非范围

- 不改变冻结需求、D、ED、AC、数据语义或 Electron 进程边界。
- 不实现 T004 的生产 ClockPort、LocalDate 值对象、周一至周日计算、跨午夜交互、诊断或 safeStorage 配置适配器。
- 不实现 T011 及后续 Goal/Action/Routine/Record CRUD、生命周期、Today、Progress、Recovery、Review、删除影响预览或导出业务。
- 不实现完整 AC-07、自动导入恢复、备份调度、回收站、通用审计日志或事件溯源。
- 不实现 AI Provider、SDK、密钥、上下文、草稿、对话历史或 AI 写入口。
- 不引入 ORM、query builder、migration 框架、通用 Repository 框架或插件系统。
- 不新增账号、同步、通知、提醒、优先级、截止日期、标签、搜索、复杂日历或其他延期能力。
- 不迁移、打开、复制、导出、截图、覆盖或删除真实 Electron `userData`、真实数据库、密钥或 live AI 数据。
- 不修改 T003 以外的任务状态；不声称 T003、G2 或 AC 已通过，除非对应实现和完整证据真实存在。
- 未单独授权时不创建分支/提交、push/PR、Ready、merge、`dev -> main`、tag/release、branch protection、required checks 或仓库设置。

## 13. 必须保持的不变量

- SQLite、SQL、数据库路径和原生驱动只存在于 Electron Main/Infrastructure；Renderer/Preload 不获得这些能力。
- Domain 不依赖 Electron、React、SQLite、文件系统、网络、测试框架或具体驱动。
- Application 只依赖端口，不依赖 `better-sqlite3` 实现。
- 所有 mutation 最终必须通过 Application command 和领域不变量；T003 不提前创建可绕过应用层的 Renderer 写入口。
- 查询不修改领域状态；migration/连接初始化的技术写入不得伪装成业务查询。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 保持可区分；缺少 RoutineRecord 保持 unknown。
- partial ActionRecord 是真实记录但不自动完成 Action。
- pause/end 保留历史；硬删除的级联/解除关联结构与 ED-008 一致，但删除业务流程留给 T031。
- Record `occurredOn` 作为显式 LocalDate 文本无损存储，不由数据库或系统时区静默移动。
- AI 未确认内容、凭据、草稿、日志不进入核心 SQLite schema。
- 所有自动化测试只访问 T002 唯一临时根和独立数据库；不得 fallback 到真实路径、真实密钥或 live AI Provider。
- `verify` 与 CI 保持非破坏性，不调用 format write、package、installer、发布、真实 migration 或真实数据清理。

## 14. 交付物

- [x] 第 6.2 节获批精确依赖和更新后的 npm 锁文件。
- [x] Main-only 数据库路径、连接生命周期和关闭入口。
- [x] `schemaVersion = 1`、显式 `001_initial.sql` 和顺序 migration runner。
- [x] 第 8 节完整初始 schema、foreign keys 和 WAL 初始化。
- [x] 参数化 SQL 的 SQLite Repository 与显式 Unit of Work。
- [x] 不依赖 SQLite 的 Repository/UnitOfWork 端口和统一契约套件。
- [x] T002 临时根下每 case 独立数据库、重开、migration、约束、事务和注入失败测试。
- [x] Node 24.18.0、Electron 43.3.0 开发模式和 Windows x64 unpacked/packaged 原生模块加载证据。
- [x] 与实际行为一致的 T003 状态/验收证据更新（README 无需变更）。
- [x] 相对最新授权 `origin/dev` 的完整 diff 自查和独立 review。

## 15. 验收标准

1. 只新增获批的 `better-sqlite3@13.0.1` 和 `@types/better-sqlite3@7.6.13` 直接依赖；现有依赖不升级，干净 `npm.cmd ci` 和 `npm.cmd ls --depth=0` 无未报告 peer/engine/invalid/missing 问题。
2. Node 24.18.0 x64、Electron 43.3.0 Main、Windows x64 `win-unpacked` 和本合同批准的 packaged 产物均实际加载驱动、打开隔离临时数据库并执行最小参数化读写；不得用 Node-only 结果替代 Electron/packaged 结果。
3. 新临时数据库从版本 0 原子迁移到 `schemaVersion = 1`，包含第 8 节全部且仅有的 v0.1 表、约束、索引/唯一键和外键行为。
4. 每个连接实际验证 `foreign_keys = 1`；文件数据库实际验证 `journal_mode = wal`；未生效时初始化失败且不返回可用 Repository。
5. 已是 v1 的数据库重开不重复 migration、不改写事实；高于已知版本、缺号/重复 migration、未知非空无 metadata 数据库均在业务写入前拒绝。
6. 人为失败的 migration 和 Repository 多步写入均完整回滚；schemaVersion、表结构和行数据不留下半完成状态。
7. Repository contract suite 对全部当前集合、枚举、nullable 关联、LocalDate、非负分钟、唯一/引用约束、完整快照和稳定排序通过。
8. SQL 注入样文本只作为绑定值保存；Repository 不使用用户值字符串拼接 SQL，不暴露任意标识符或 raw query 接口。
9. 关闭并重新建立真实临时 SQLite 连接后，查询和完整快照与关闭前一致；这只作为持久化基础证据，不声明业务 FR-D01/AC-07 完成。
10. unit/integration/E2E 全部使用 T002 唯一临时根和独立数据库；执行前后没有访问、创建、迁移或清理真实 Electron `userData`、真实数据库、密钥或 live AI Provider。
11. Renderer/Preload 公开面没有数据库路径、SQL、`better-sqlite3`、文件能力或通用测试后门；Domain/Application 依赖方向保持成立。
12. 最终 diff 不含 T004、业务 CRUD/统计/导出、ORM、AI、延期能力、未批准依赖或真实数据痕迹。
13. 第 16 节本地命令和获批 hosted Windows CI 在最终 revision 上 exit code 0；原生模块检查绑定最新 PR revision/测试 merge revision。
14. 完整 diff 独立 review 无未处理 P0/P1/P2；限制与 P3 如实写入证据。
15. 只有上述结果实际存在且状态/证据更新获批时，任务索引才可将 T003 改为 `done`；项目所有者人工检查未执行时保持 `pending`。

## 16. 验证计划

以下命令只在项目所有者批准依赖、安装、实现和对应操作后执行。

### 环境与基线

```powershell
node --version
npm.cmd --version
git status --short --branch
git rev-parse HEAD
git rev-parse origin/dev
git ls-remote origin refs/heads/dev
gh pr view 2 --json state,mergedAt,mergeCommit,headRefOid,baseRefName,statusCheckRollup
```

### 依赖与针对性验证

```powershell
npm.cmd ci
npm.cmd ls --depth=0
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
```

针对性测试必须明确报告：

- Node/Electron runtime、platform、arch 和 `process.versions.napi`；
- 实际加载的 `better-sqlite3` 版本和隔离数据库位置所属临时根；
- schemaVersion、foreign_keys、journal_mode；
- migration/Repository contract/transaction/reopen 结果；
- 测试根创建与清理边界，且日志不得泄露真实路径或正文。

### 受影响范围回归

```powershell
npm.cmd run verify
npm.cmd run build
npm.cmd run package
git diff --check
git status --short --branch
```

- `verify` 不包含 package；不得用 `verify` 声称 Windows packaged 原生模块已验证。
- `package` 只生成既有 Windows x64 unsigned NSIS 和 `win-unpacked`；不安装、不签名、不发布。
- 启动 `win-unpacked/MyTracer.exe` 时必须注入本次 T002 临时 `userData`，证明 native addon、migration、关闭和重开；不得使用真实数据根。
- 若 hosted CI 未执行 package，则它只证明 Node/Electron 测试范围；Windows packaged 证据必须单独记录本地环境和 artifact。

### 验证环境

- **OS（本地）**：Windows 11 x64；完成时填写具体 build
- **OS（CI）**：现有 GitHub-hosted `windows-2025` x64；若使用则记录实际 image
- **Node**：24.18.0
- **npm**：11.16.0
- **Electron**：43.3.0（内置 Node 24.17.0）
- **SQLite driver**：待批准的 `better-sqlite3@13.0.1`
- **数据根**：每 case/进程唯一 T002 OS 临时根；数据库位于其 `database/` 下
- **AI**：FakeAiProvider only；零 SDK、零 key、零 live request
- **Source revision / artifacts**：完成时填写 commit、PR head、CI head/merge revision、run URL、unpacked/installer 标识和校验值

## 17. Git 与 GitHub 权限（已批准，须等待明确启动）

建议授权边界：

- [x] T003 明确启动后，允许从重新核验的最新 `origin/dev` 创建本地 worktree/`task/T003-sqlite-migrations` 分支。
- [x] T003 明确启动后，允许创建有意义的本地提交。
- [x] T003 明确启动后，允许 push `task/T003-sqlite-migrations`。
- [x] T003 明确启动后，允许创建或更新到 `dev` 的 Draft PR，并触发现有 GitHub Actions。
- [x] T003 明确启动并产生真实结果后，允许仅更新 T003 合同、任务索引中 T003 行和 T003 验收证据。
- [ ] 允许将 Draft 标记为 Ready。
- [x] 不允许 Agent 合并到 `dev`。
- [x] 不允许 Agent 创建或合并 `dev -> main` PR。
- [x] 不允许 Agent 创建 tag 或 release。
- [x] 禁止 force push 和远端分支删除。
- [x] 不允许修改 branch protection、ruleset、required checks、Actions secrets、仓库变量或部署设置。

上述授权仅在项目所有者另行明确启动 T003 后生效；当前确认本身不触发任何 Git/GitHub 操作。未勾选的允许项表示未授权。branch/commit/push/Draft PR 授权不包含 Ready、merge、tag、release 或仓库设置。

## 18. 依赖、网络、数据与外部操作权限（已批准，须等待明确启动）

- **新增依赖**：已批准第 6.2 节两个精确直接依赖和精确 `allowScripts` 条目；不得扩大或升级其他依赖。
- **执行安装**：T003 明确启动后，允许 `npm.cmd install`/`npm.cmd ci` 及必要包/原生预构建二进制下载。
- **网络访问**：T003 明确启动后，仅允许 npm 官方注册表、既有 Electron/electron-builder 二进制来源、GitHub Actions 和只读 Git/GitHub 核验；不允许其他服务。
- **原生编译**：默认不授权源码编译、Visual Studio Build Tools/Python 安装或额外 rebuild 工具；若包内预构建不可用则停止。
- **AI Provider**：FakeAiProvider only；不允许真实 Provider、SDK、模型、key 或 live request。
- **外部写入**：T003 明确启动后，允许指定 branch push、Draft PR 和现有 Actions；其余不授权。
- **数据破坏性操作**：无；只允许清理由本次测试创建且通过 T002 containment/ownership 校验的临时根。
- **真实用户数据**：禁止读取、写入、迁移、复制、导出、截图、覆盖或清理。
- **Windows 产物**：T003 明确启动后，允许生成既有 unsigned NSIS/`win-unpacked` 并在隔离临时 `userData` 下启动；不安装、不签名、不发布。

## 19. 风险与停止条件

发现以下任一情况时停止受影响工作并报告：

- PR #2/T002 不在重新核验的最新远端 `dev` 内容中，或远端基线出现无法解释的变化；
- MUST、D、ED、GW、本合同或现有实现之间存在冲突；
- 精确依赖未批准，或安装需要不同/新增直接依赖、源码编译、额外 native rebuild 工具；
- `better-sqlite3@13.0.1` 无法在 Node 24.18.0、Electron 43.3.0 或 Windows x64 packaged 产物加载；
- 当前 `npmRebuild: false` 无法成立且需要改变 native build 策略；
- 需要改变 schemaVersion、生产数据库路径、表/约束、migration 原子性或删除关联规则；
- 需要实现 T004、业务命令/统计/导出、ORM、延期功能或新的用户概念；
- Repository 需要暴露 raw SQL、任意路径、Renderer Node 能力或绕过 Application command；
- migration 可能破坏/覆盖真实或未知数据库，或需要真实数据 fixture；
- 测试路径可能回退到真实 `userData`，清理 containment/ownership 无法可靠证明；
- 测试需要真实密钥、`.env`、系统凭据或 live AI Provider；
- hosted CI/packaged evidence 只验证旧 revision、错误平台/架构或未实际加载 native addon；
- 需要扩大文件、网络、Git、GitHub、外部写入或数据权限；
- 无法形成绑定最终 revision 的可靠证据。

已知风险：

- `better-sqlite3` 13.x 的 Node-API 迁移较新；包内预构建与 Node-API 依据不能替代本项目的实际 Electron/package 验证。
- 项目路径包含空格；若意外回退到 `node-gyp`，可能失败且当前合同不授权编译工具安装。
- `@types/better-sqlite3@7.6.13` 发布早于 13.x；基础 API 预计可用，但必须由 TypeScript 和实际契约测试证明。
- WAL 会生成 sidecar 文件；测试清理必须覆盖本次临时根内的数据库、WAL 和 SHM，不得宽泛删除。
- 当前 branch protection/required check 是否配置仍未获独立证据；稳定 check 成功不等于远端已设 required。

## 20. 完成报告

T003 完成报告必须包含：

- 新增或修改的文件和可观察持久化结果；
- FR/D/ED/GW 覆盖，以及未声明完成的 FR/AC/G2；
- 实际依赖树、Node/Electron/N-API/Windows x64 原生模块信息；
- schemaVersion、表/约束、foreign_keys、WAL、migration、Repository/事务/重开证据；
- 每条实际命令、环境、exit code、关键输出和 artifact；
- 测试临时根隔离、真实数据零访问、AI 零 live call 的证据；
- commit、PR、CI head/merge revision、run URL 和稳定 check（仅在获批且适用时）；
- 自动化与项目所有者人工检查状态；
- 风险、已知缺口、跳过/未验证项；
- T004 和业务切片仍待实现的边界；
- 是否发现需求冲突、范围变化、未批准依赖或数据安全风险。

完成报告不得声称：

- 仅因 schema/测试文件/命令存在就证明行为通过；
- Node-only 加载证明 Electron 或 packaged Windows x64 兼容；
- T003 已实现业务 FR-D01、AC-07、T004 或 G2；
- branch protection/required check 已配置；
- 项目所有者尚未执行的人工检查已通过。

## 21. 项目所有者确认记录

项目所有者于 2026-08-08 全部确认以下事项：

1. 是否批准 `better-sqlite3@13.0.1` 作为 `dependencies`、`@types/better-sqlite3@7.6.13` 作为 `devDependencies`，并只为前者增加精确 `allowScripts` 条目；现有版本均不升级；
2. 是否批准生产路径 `<Electron userData>/data/mytracer.sqlite3`；
3. 是否批准 `schemaVersion = 1`、第 8 节初始 schema、显式 `001_initial.sql`、migration/PRAGMA/Repository 契约；
4. 是否批准依赖安装和限定网络下载，但源码编译/额外 rebuild 工具保持不授权；
5. 是否批准生成既有 Windows x64 unsigned NSIS/`win-unpacked` 并仅在隔离临时 `userData` 下验证，不安装、不签名、不发布；
6. 是否批准创建 `task/T003-sqlite-migrations` worktree/分支和本地提交；
7. 是否批准 push、创建/更新到 `dev` 的 Draft PR并触发现有 Actions；
8. 是否批准在真实结果产生后仅更新 T003 合同、任务索引 T003 行和 T003 验收证据；
9. 是否同意 Ready、merge、`dev -> main`、tag/release、远端删除/强推和仓库设置继续保持不授权。

确认结果：第 1～9 项全部批准，其中第 9 项所列禁止操作继续不授权。项目所有者已于 2026-08-09 明确启动 T003；任务转为 `active`，但 Ready、merge、tag/release、强推、远端删除和仓库设置继续不授权。

## 22. 最终执行结果（2026-08-09）

- **实现 revision**：`b7f20901c54bd883f6ebf6cda66e3d9b9b5fa347`；Draft PR #3：<https://github.com/Fyrefly-4/MyTracer/pull/3>。
- **隔离修复**：Windows 临时根现在提供真实的 `AppData/Roaming`、`AppData/Local` 和 `Temp`，Electron 进程 `cwd` 也固定为该根；E2E 断言该工作目录、`userData` 和所有重定向环境变量。此前的空 `Microsoft`、`NVIDIA Corporation` 和乱码目录已在授权后清理，最终运行未再写入工作区。
- **本地验证**：项目所有者交互式 PowerShell 在实现 revision 上执行 `npm.cmd run verify`，exit code `0`：format、lint、typecheck、13 个 unit tests、8 个 integration tests、构建和隔离 Electron E2E 全部通过。Codex 桌面非交互式宿主的 GUI 启动仍可能不稳定，但不影响该可复核的本机桌面会话结果。
- **hosted Windows**：`Verification / Windows required gate` 在同一 PR head 的 run `31297398066` / job `93204634867` 成功执行完整 `npm.cmd run verify`：<https://github.com/Fyrefly-4/MyTracer/actions/runs/31297398066/job/93204634867>。
- **Windows x64 产物**：标准 `npm.cmd run package` 在 Windows 11 10.0.26200 x64 成功，使用明确的 `electronDist: node_modules/electron/dist`，未重新下载 Electron；生成 NSIS 和 `win-unpacked`。`app.asar.unpacked/node_modules/better-sqlite3/prebuilds/win32-x64.node` 实际存在；用 packaged executable 在隔离 OS 临时数据库上的原生冒烟返回 `result="bound file value"`、`mode="wal"`、`foreignKeys=1`、`napi="10"`。`win-unpacked/MyTracer.exe` SHA-256 为 `E43FBB06840D0557FC7E547966C0E4B2A039C04B7836E1AC44E33ACC23AB7A9D`；NSIS `release/MyTracer-0.1.0-x64-setup.exe` SHA-256 为 `10D7C9CB81D38175CB04076D93262F8924DCF778BB5C55D51D265CA50561460B`。
- **结论**：本合同第 15 节工程验收条件已满足，T003 为 `done`。它只证明持久化基础、测试隔离和原生模块兼容；不声明 FR-D01 业务功能、任何 AC、T004 或 G2 完成。

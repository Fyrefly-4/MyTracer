# T004：LocalDate、诊断、配置、safeStorage 空边界与 Windows 打包冒烟任务合同

> 合同状态：`active`  
> 创建日期：2026-08-09  
> 当前任务账本状态：`active`；实现启动授权后已同步任务索引，验收证据仅在真实结果存在后更新  
> 审批记录：项目所有者于 2026-08-09 批准第 11 节建议授权、零新增/零升级依赖和外部操作边界，并明确要求开始 T004

## 1. 任务信息

- **Task ID**：T004
- **Title**：Establish LocalDate, diagnostics, configuration, an empty safeStorage boundary, and Windows package smoke
- **Slice / Plan item**：S0 / E0-04
- **Status**：`active`
- **Base branch**：`dev`
- **Expected branch**：`task/T004-localdate-diagnostics`
- **合同准备分支**：项目所有者已于 2026-08-09 授权从最新 `origin/dev` 创建上述本地分支，仅用于修正 T003 文档漂移和创建本合同；该授权不等于开始实现。
- **已核验基线**：`origin/dev`、本地 `dev` 与创建分支基线均为 `2ea8c6cb8584e4bf4d517938efacf68813f33604`；PR #3 已合并，T003 内容存在，最终 hosted `Windows required gate` 成功。

## 2. 目标结果

在不实现任何业务 CRUD、真实 AI Provider 或凭据管理流程的前提下，建立 S0 可复用且可测试的日期、诊断和配置基础：

- 提供严格、不可被隐式 UTC 转换替代的 `LocalDate` 值与 `ClockPort`，以用户本地日计算“今天”和周一至周日周期；
- 提供跨午夜日期决策基础：表单捕获的发生日保持不变，当前本地日变化时必须返回“需要用户选择”的结果，不得静默改写历史日期；
- 提供最小结构化 `DiagnosticsPort` 和安全诊断适配器，只记录允许的事件代码、严重级别、关联 ID、时间和错误分类；
- 提供 Main-only 配置边界和 safeStorage 空适配器：没有批准的 Provider、配置文件或环境变量时稳定返回 `not-configured`，不读取、加密、解密或持久化任何真实凭据；safeStorage 不可用也不阻塞应用、SQLite 或现有 shell 状态查询；
- 保持 Renderer/Preload 不可访问 Node、文件、SQLite、配置路径、`safeStorage`、环境变量正文或凭据；
- 在开发/E2E、Windows x64 `win-unpacked` 和 unsigned NSIS 安装态中，以相互独立的临时 `userData` 启动应用，证明零 AI 配置、SQLite 原生模块、日期/配置组合根和安全诊断可以共同启动；
- 保持 `npm.cmd run verify` 为只读聚合门禁；Windows package smoke 独立于 `verify` 执行。

T004 只证明工程边界和 Windows G2 前置能力，不完成任何业务 FR、AC-01～AC-07 或 G2。

## 3. 需求依据

- **FR**：FR-AI09、FR-D05（仅建立“未配置/不可用不阻塞基础能力”的工程前置，不声明任一 FR 完成）；FR-D01（仅回归 T003 重开/SQLite 基础，不声明用户可见业务持久性完成）。
- **AC**：无直接完成的 AC；Windows 重开、零配置和打包冒烟不是 AC-07 完整验收。
- **D**：D-009、D-015～D-017、D-106、D-109。
- **ED/GW**：ED-001、ED-003、ED-004、ED-010、ED-017～ED-019；GW-001～GW-004、GW-008～GW-010。
- **直接相关架构章节**：
  - `docs/architecture/ARCHITECTURE_V0.1.md` §3、§4.3～§4.4、§7～§9；
  - `docs/architecture/DOMAIN_MODEL_V0.1.md` §5.3、§6、§8；
  - `docs/architecture/DATA_DESIGN_V0.1.md` §4、§8、§10～§11；
  - `docs/architecture/AI_BOUNDARY_V0.1.md` §7～§8、§11；
  - `docs/architecture/ENGINEERING_DECISIONS_V0.1.md` ED-004、ED-010、ED-017～ED-019；
  - `docs/architecture/IMPLEMENTATION_PLAN_V0.1.md` §3 E0-04、§11；
  - `docs/architecture/TEST_STRATEGY_V0.1.md` §2～§3、§4.5、§5～§6.2、§9；
  - `docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md` FR-AI09、FR-D01、FR-D05、D-015、D-106、D-109；
  - `docs/implementation/GITHUB_WORKFLOW_V0.1.md`。

若实现需要改变日期、AI 降级、配置、凭据或 Renderer 能力语义，必须停止并按需求变更规则处理。

## 4. 开始条件

- [x] PR #3 已合并到 `dev`；实时远端 `refs/heads/dev` 为 `2ea8c6cb8584e4bf4d517938efacf68813f33604`，并包含 T003 实现与证据。
- [x] PR #3 最终 hosted `Verification / Windows required gate` 成功：run `31297738034`、job `93205463074`。
- [x] 创建合同前工作树干净，仅有一个 worktree，无 `active` 或重叠任务。
- [x] T003 证据账本的陈旧标题/结论和 README 的 T003 当前事实已在本工作分支按项目所有者授权修正。
- [x] T002 临时数据根、FakeClock/FakeAiProvider 和稳定验证命令已存在；T003 独立数据库、SQLite 重开和原生模块基础已存在。
- [x] 本任务不修改 SQLite schema/migration/Repository，不执行数据迁移，无破坏性或不可逆数据影响。
- [x] 项目所有者批准本合同的范围、验收标准和停止条件。
- [x] 项目所有者批准第 11 节 Git/GitHub 权限。
- [x] 项目所有者批准第 12 节零新增/零升级依赖及外部操作权限。
- [x] 项目所有者在上述批准后明确要求开始 T004。

最后四项未全部满足前，不安装依赖、不实现代码、不创建提交、不 push、不创建 PR、不修改任务状态或新增验收证据。

实现启动前必须再次只读核验最新实时 `origin/dev`、PR #3、最终 hosted Windows gate、工作树和 worktree。若远端 `dev` 已变化，必须先报告并由项目所有者确认新的授权基线；不得从旧 `dev`、T003 分支或临时提交继续。

## 5. 允许修改范围

仅在合同获批且项目所有者明确“开始 T004”后允许修改：

- `src/domain/**`：仅限严格 `LocalDate`、周一至周日范围和跨午夜日期决策纯逻辑；不得加入业务实体或统计。
- `src/application/ports/**`：仅限 `ClockPort`、`DiagnosticsPort`、配置/凭据只读端口及其最小 DTO。
- `src/application/query-shell-status.ts`、`src/contracts/shell.ts`：仅在保持现有窄接口的前提下反映零配置/降级事实；不得暴露路径、环境变量、safeStorage 或凭据。
- `src/infrastructure/clock/**`：生产系统时钟适配器；必须使用本地日历字段生成 LocalDate，不得用 UTC 截断生成“今天”。
- `src/infrastructure/diagnostics/**`：结构化、安全、无正文的最小诊断适配器和脱敏/分类逻辑。
- `src/infrastructure/configuration/**`、`src/infrastructure/credentials/**`：Main-only 空配置源和 safeStorage 空边界；不得建立真实 Provider 配置、真实密钥写入或未批准环境变量约定。
- `src/infrastructure/index.ts`：仅导出 T004 的 Main-side 组合入口。
- `src/main/**`：仅限装配 Clock、诊断、空配置/凭据边界、SQLite 和安全退出；不得增加通用 IPC 或业务命令。
- `src/preload/**`、`src/renderer/**`：默认不修改；仅在针对既有 shell status 的窄 DTO 回归确有必要且不扩大能力时允许最小调整。
- `tests/unit/**`：LocalDate、周范围、跨日决策、诊断脱敏、配置和 safeStorage 空边界测试。
- `tests/integration/**`：Electron Main safeStorage 不可用/零配置、SQLite 共存、诊断零泄露和 package-smoke 辅助测试。
- `tests/e2e/**`、`tests/support/**`：复用并最小扩展 T002 临时根、FakeClock 和最小环境 allowlist；隔离开发/E2E、unpacked、NSIS 安装态 `userData`。
- `scripts/**`：仅限可重复的 Windows x64 unpacked/NSIS 隔离冒烟入口；不得安装到真实应用目录、发布或访问真实数据。
- `package.json`：只允许增加独立 package-smoke script；不得改变 `verify` 的非破坏性范围或依赖。
- `tsconfig.test.json`：项目所有者于实现期间补充授权，仅允许把已获批的 `src/domain/**/*.ts` 纳入测试类型检查，不改变其他编译选项。
- `electron-builder.yml`：仅在 Windows package smoke 确有必要时做最小、非发布性调整；不得改变 x64 unsigned NSIS 目标、启用签名或发布。
- `.gitignore`：仅在确有必要时加入 T004 临时产物模式；测试和冒烟仍必须写 OS 临时根而非工作区。
- `.github/workflows/verify.yml`：仅在获批发布后且 T004 验证确有必要时扩展现有 Windows gate；不得改变稳定 job 名、权限、required-check 配置或让 package 进入 `verify`。
- `README.md`、本合同、`docs/implementation/TASK_INDEX_V0.1.md`、`docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`：只记录实际行为、真实结果和获批状态；状态/证据只能在真实结果存在后更新。

本轮合同准备授权只覆盖 T003 证据文字、README 当前事实和本合同；尚未授权上述实现范围。

## 6. 明确非范围

- 不改变冻结需求、AC、D、ED、GW、日期语义、AI 降级语义或 Electron 进程边界。
- 不修改 SQLite schema、`schemaVersion`、migration、Repository、Unit of Work、生产数据库路径、SQL 或 T003 级联/约束。
- 不实现 Goal、Action、Routine、Record CRUD、Today、Progress、Recovery、Review、统计、修改/删除业务或导出。
- 不实现跨午夜表单 UI 或保存业务；T004 只提供“捕获原日期 + 检测变化 + 要求显式选择”的纯边界。
- 不实现真实 AI Provider、SDK、模型、网络请求、上下文选择器、建议、确认写入、对话历史或 live AI 测试。
- 不批准或定义首个 Provider 的环境变量名、配置文件格式、文本预算或凭据 UX。
- 不读取、写入、迁移、复制、记录、截图、导出或删除真实密钥、环境变量正文、真实 Electron `userData` 或真实数据库。
- 不引入 ORM、query builder、migration/config/diagnostics 框架、日志平台、崩溃上报、遥测、账号、同步、插件或其他延期能力。
- 不把诊断写入核心 SQLite 或导出，不记录绝对路径、用户正文、数据库内容、SQL 参数、AI prompt/response、密钥、token、password、credential 或完整环境变量。
- 不安装、签名、发布或上传 Windows 产物；NSIS 只允许静默安装到本次临时根并在验证后精确卸载/清理。
- 不修改 ruleset、branch protection、required checks、Actions secrets/variables 或部署设置。
- 不允许 Ready、merge、`dev -> main`、tag、release、force-push 或远端分支删除。
- 不声明任何业务 FR、AC-01～AC-07 或 G2 完成。

## 7. 必须保持的不变量

- `LocalDate` 是经过日历有效性验证的 `YYYY-MM-DD`，是 Today、发生日和周期边界的权威值；不得由 `toISOString()`、UTC 截断、SQLite 日期函数或执行时隐式系统日期替代。
- `SystemClock.currentLocalDate()` 从同一次捕获的本地年/月/日生成；`FakeClock` 显式控制瞬时值、本地日期和时区，测试不得依赖真实当天。
- 周范围固定为周一至周日，按纯 LocalDate 计算；跨月、跨年和 DST 不得移动日期。
- 表单/操作捕获的发生日跨午夜后保持原值；没有用户显式选择时不得自动改为新“今天”。T004 不写业务 Record。
- Renderer 不得访问 Node、文件、SQLite、配置路径、`process.env`、safeStorage、凭据、诊断原始错误或任意 IPC channel。
- Preload 只保留具体、类型化、无路径/凭据的 API；Main 校验输入、参数数量和 sender/origin。
- safeStorage 和配置只存在于 Electron Main/Infrastructure；空边界在没有批准配置时必须产生 `not-configured`，不得创建配置文件或调用加密/解密。
- safeStorage 不可用、解密能力不可用或配置缺失不得阻塞应用启动、SQLite 初始化、现有查询或安全退出。
- 诊断只接受封闭事件代码和允许字段；不得泄露绝对路径、密钥、环境变量正文、数据库内容、用户正文、SQL 参数或 AI 上下文。诊断失败不得阻塞核心启动或掩盖原错误分类。
- AI 配置与核心 SQLite、导出和领域 DTO 分离；零真实 Provider、零 SDK、零 live request、零真实 key。
- 所有测试和 package smoke 使用 T002 创建并拥有的唯一 OS 临时根；每个进程/形态使用独立数据库和独立 `userData`，最小环境 allowlist 不转发宿主敏感变量。
- 清理只删除本次拥有且 canonical containment 验证通过的临时根；不得清理工作区或真实用户目录。
- Windows x64 `win-unpacked` 与 NSIS 安装态均实际启动目标 Electron 可执行文件、加载打包的 `better-sqlite3`、打开隔离数据库并报告零配置状态；Node-only 或只检查文件存在不能替代运行冒烟。
- `npm.cmd run verify` 只聚合 format check、lint、typecheck、unit、integration、build 和 Electron E2E；不得调用 format write、package、安装、migration 命令、live AI、签名或发布。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 继续保持可区分；本任务不得引入业务状态折叠或推断。

## 8. 交付物

- [ ] 严格 LocalDate 值、ClockPort、生产 SystemClock 和与同一端口一致的 FakeClock。
- [ ] 周一至周日纯 LocalDate 计算，以及跨月、跨年、闰年、DST 邻近日期测试。
- [ ] 跨午夜日期决策基础，证明不经用户选择不移动原发生日。
- [ ] 结构化 DiagnosticsPort、安全诊断适配器、封闭事件/字段和零敏感正文测试。
- [ ] Main-only 配置端口、空配置源和 safeStorage 空边界；缺失/不可用均降级为 `not-configured`。
- [ ] 配置、诊断、Clock、SQLite 和现有 shell 组合根共同启动/退出的集成与 Electron E2E 回归。
- [ ] T002 临时根下每 case/进程独立数据库、独立 `userData`、最小环境 allowlist 和精确清理证明。
- [ ] Windows x64 `win-unpacked` 和 unsigned NSIS 临时安装态运行冒烟及产物标识。
- [ ] 保持 `verify` 不含 package/安装/迁移/live AI 的脚本和执行证据。
- [ ] 相对最新授权 `origin/dev` 的完整 diff 自查与独立只读 review。
- [ ] 只在真实结果存在后更新本合同、任务索引 T004 行和 `EV-T004-001`。

## 9. 验收标准

1. 不新增或升级任何依赖；`package.json` 和锁文件中的现有直接依赖版本保持不变。若实现需要任何新包或版本变化，立即停止并重新批准。
2. `LocalDate` 只接受规范且真实存在的 `YYYY-MM-DD`；拒绝宽松格式、无效日/月、非闰年 2 月 29 日和附带时间/时区的输入，序列化无时区转换。
3. `SystemClock` 使用用户本地日历字段返回今天；测试证明在 UTC 日期与本地日期不同的瞬时值下不会使用 UTC 日替代本地日。
4. 周期函数对周一、周日、跨月、跨年和 DST 邻近日期稳定返回包含目标日的周一至周日，不调用数据库周编号或 UTC 日期截断。
5. 跨午夜决策在捕获日与当前日不同且无显式选择时返回需要确认；只有 `keep-original` 或 `use-today` 明确选择才返回最终 LocalDate。
6. 空配置/凭据边界在无 Provider、无批准环境变量、safeStorage 不可用或未提供凭据时均返回 `not-configured`；不创建文件、不访问 SQLite、不调用加密/解密、不产生网络请求。
7. DiagnosticsPort 对每个允许事件只输出事件代码、严重级别、关联 ID、Clock 提供的时间和允许的错误分类；包含绝对路径、key/token/password/secret/credential、环境变量正文、数据库/SQL/用户/AI 正文的输入不得进入输出或落盘。
8. Renderer/Preload 公开面不包含 Clock 对象、系统日期入口、配置路径、环境变量、safeStorage、凭据、诊断 sink、原始错误、文件或 SQLite 能力；IPC sender/origin 和参数校验继续成立。
9. unit/integration/E2E 全部使用 T002 唯一临时根、独立数据库和 FakeClock；运行前后不创建工作区运行时目录，不读取或清理真实 `userData`、真实数据库、真实凭据或宿主敏感环境变量正文。
10. 开发构建/E2E、Windows x64 `win-unpacked` 和 NSIS 临时安装态分别以独立临时 `userData` 实际启动；均显示 AI `not-configured`，加载打包的 SQLite 原生模块并在隔离数据库完成 schema v1 初始化/重开后安全退出。
11. `npm.cmd run package` 只生成既有 Windows x64 unsigned NSIS 和 `win-unpacked`；NSIS 只静默安装到本次拥有的临时目录，启动时显式注入隔离 `userData`，验证后使用其卸载器并只清理本次临时根。
12. `npm.cmd run verify` 的脚本链不包含 `format` write、`package`、install/`npm ci`、migration CLI、live AI、签名、发布或真实数据操作；package smoke 使用独立命令。
13. 第 10 节所有本地必需命令在最终 revision 上 exit code 0；hosted `Windows required gate` 在最新 PR head/merge revision 上成功。若 hosted CI 未执行 package smoke，必须明确只把 package 结果记录为本地 Windows 证据。
14. 最终完整 diff 不包含 SQLite schema/migration/Repository 改动、业务 CRUD/统计/导出、真实 Provider/SDK/密钥、延期能力、未批准依赖、真实路径或真实数据痕迹。
15. 独立 review 无未处理 P0/P1/P2；P3、平台限制和人工状态如实记录。
16. 只有实现、验证、Windows 产物、独立 review 和最终 revision 证据全部真实存在后，才允许把 T004 标为 `done`；G2、业务 FR 和 AC 继续单独保持 `pending`。

**MANUAL**：项目所有者可选择观察 unpacked/NSIS 临时安装态能否正常显示 shell，但本任务不要求产品体验验收；未执行时必须记为 `pending`，不得由 Agent 代签。

## 10. 验证计划

### 针对性验证

合同获批并明确启动后，先运行：

```powershell
npm.cmd exec -- vitest run --project unit tests/unit/local-date.test.ts tests/unit/clock.test.ts tests/unit/diagnostics.test.ts tests/unit/configuration.test.ts
npm.cmd exec -- vitest run --project integration tests/integration/main-foundations.test.ts
npm.cmd run test:e2e
```

若最终文件名需因现有结构最小调整，必须在首次实现提交前同步本合同；不得用模糊的“相关测试”替代精确命令。

### 受影响范围回归

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
npm.cmd run package
npm.cmd run test:package-smoke
git diff --check
git status --short --branch
```

- `test:package-smoke` 是 T004 拟建立的独立、本地 Windows x64 命令；它要求现有 package 产物，且不得加入 `verify`。
- `package` 不安装到真实位置、不签名、不发布；`test:package-smoke` 只安装到 T002 拥有的 OS 临时根。
- `verify` 已包含 build 和 Electron E2E，但不包含 package 或 NSIS/unpacked 冒烟；不得用 `verify` 代替打包证据。

### 人工步骤

1. 可选：项目所有者在真实 Windows 桌面会话观察临时 `win-unpacked` 和 NSIS 安装态窗口可见、状态为 AI 未配置且关闭正常。
2. 核对冒烟结束后临时安装目录、临时 `userData`、临时数据库和相关进程均已清理；不检查或打开真实 MyTracer `userData`。

### 验证环境

- OS：Windows 11 x64；完成时记录具体 build
- CI：GitHub-hosted `windows-2025` x64；完成时记录 image、runner、run/job
- Node：24.18.0
- npm：11.16.0
- Electron：43.3.0（内置 Node 24.17.0）
- SQLite：`better-sqlite3@13.0.1` / N-API 10；不得升级
- 数据根：每 case/进程由 T002 创建的唯一 OS 临时根；unpacked 和 NSIS 使用不同 `userData` 与数据库
- Clock：FakeClock；生产 SystemClock 只在明确的 adapter/integration 测试中使用受控输入或宿主断言
- AI：零配置/空凭据边界和 FakeAiProvider only；零真实 SDK、key、Provider 或 live request
- Source revision / artifacts：完成时填写 commit、PR head/merge revision、CI URL、`win-unpacked`/NSIS 路径、大小和 SHA-256

## 11. Git 与 GitHub 权限

当前已授权：

- [x] 从已核验 `origin/dev` 创建本地 `task/T004-localdate-diagnostics` 分支，仅用于修正 T003 文档漂移和创建本合同。

项目所有者已批准，并于明确开始 T004 后生效：

- [x] 允许在现有 `task/T004-localdate-diagnostics` 分支实现 T004。
- [x] 允许创建有意义的本地提交。
- [x] 允许 push `task/T004-localdate-diagnostics`。
- [x] 允许创建或更新到 `dev` 的 Draft PR，并触发现有 GitHub Actions。
- [x] 允许在真实结果产生后更新本合同、任务索引 T004 行和 `EV-T004-001`。
- [ ] 允许将 Draft 标记为 Ready。
- [x] 不允许 Agent 合并到 `dev`。
- [x] 不允许 Agent 创建或合并 `dev -> main` PR。
- [x] 不允许 Agent 创建 tag 或 release。
- [x] 禁止 force push 和远端分支删除。
- [x] 不允许修改 ruleset、branch protection、required checks、Actions secrets/variables、仓库权限或部署设置。

未勾选的允许项均表示尚未授权。branch/commit/push/Draft PR 授权不包含 Ready、merge、tag、release 或仓库设置。

## 12. 依赖与外部操作权限

- **新增/升级依赖**：建议为无；保持当前所有直接依赖及锁文件版本不变。LocalDate/Clock 使用 TypeScript/JavaScript 标准能力；safeStorage 使用已安装 Electron 43.3.0 内建 API；诊断、配置和 package smoke 使用现有 Node/Electron/Playwright 能力。
- **安装依赖**：实现不需要 `npm install`。验证可在获批启动后执行锁文件只读恢复 `npm.cmd ci`；该命令不属于 `verify`，不得改变依赖版本。
- **网络访问**：实现与本地验证无网络；若发布获批，仅允许 Git/GitHub、现有 Actions 和锁文件/既有 Electron 二进制恢复所需来源。
- **AI Provider**：空配置边界和 FakeAiProvider only；无 Provider、SDK、模型、环境变量名、真实 key 或 live request。
- **外部写入**：当前无。若第 11 节获批，明确限定为指定任务分支 push、到 `dev` 的 Draft PR 和现有 Actions。
- **Windows 产物**：建议允许在明确启动后生成既有 unsigned NSIS/`win-unpacked`，静默安装到本次 T002 临时根、启动、卸载并清理；不安装到真实应用目录、不签名、不发布。
- **数据破坏性操作**：无；只允许删除本次创建且 ownership/canonical containment 校验通过的临时根和临时安装。
- **真实用户数据**：禁止读取、写入、迁移、复制、导出、截图、覆盖或清理真实 Electron `userData`、数据库、配置或凭据。

如需要新依赖、版本升级、真实配置文件、Provider 环境变量名、真实凭据、额外打包工具、外部服务或扩大网络目标，立即停止并重新请求精确批准。

## 13. 风险与停止条件

发现以下情况时停止受影响实现并报告：

- PR #3/T003 不在重新核验的最新远端 `dev`，远端基线变化未获项目所有者确认，或出现重叠工作树/worktree。
- MUST、D、ED、GW、本合同或现有实现冲突，或需要改变日期、AI 降级、凭据、诊断、Renderer/Preload 能力语义。
- 需要新增/升级依赖、执行源码编译、改变 Electron/better-sqlite3 ABI 策略或引入配置/日志框架。
- 需要修改 SQLite schema/migration/Repository/生产数据库路径，或实现业务 CRUD、统计、导出、AI Provider、延期功能或新用户概念。
- LocalDate 无法在不使用 UTC 截断/隐式系统日期的情况下稳定实现，或跨午夜只能通过静默移动历史日期解决。
- 配置/safeStorage 边界需要真实 key、真实环境变量正文、真实配置文件或 Renderer/Preload 暴露能力。
- 诊断无法证明对绝对路径、密钥、环境变量、数据库、SQL、用户正文或 AI 内容零泄露。
- 自动化或 package smoke 可能回退到真实 `userData`、真实数据库/配置，或临时根 ownership/containment 无法证明。
- NSIS 不能限定到本次临时安装目录，卸载可能影响真实安装，或清理目标无法精确验证。
- unpacked/NSIS 只验证文件存在、Node-only 加载或旧产物，不能实际启动最终 Windows x64 Electron 产物。
- hosted CI、package 或 smoke 未绑定最终 revision，或需要修改 required checks/ruleset/branch protection。
- 需要扩大文件、网络、Git、GitHub、外部写入或数据权限，或无法形成可靠验收证据。

任务特有风险：

- Windows `safeStorage.isEncryptionAvailable()` 受会话和宿主环境影响；T004 只验证空/不可用降级，不验证真实凭据持久化。
- 系统时区和 DST 测试若直接依赖宿主会不稳定；核心日期规则必须由纯 LocalDate/FakeClock 证明，生产适配器只做窄契约验证。
- NSIS 静默安装/卸载的路径和进程清理具有破坏性风险；必须把目标限制到本次拥有的临时根并在执行前后验证绝对路径。
- hosted Windows gate 当前只运行 `verify`；除非合同后续获批明确扩展 workflow，package/NSIS 证据是本地 Windows 证据，不能冒充 hosted CI。

## 14. 完成报告

必须包含：

- 新增或修改的文件及可观察工程结果；
- FR/AC/D/ED/GW 覆盖，以及明确未声明完成的业务 FR、AC-01～AC-07 和 G2；
- LocalDate 格式/日历校验、本地日、周一至周日、跨午夜显式决策证据；
- DiagnosticsPort 允许字段、脱敏/拒绝测试和绝对路径/密钥/环境变量/数据库/用户/AI 正文零泄露证据；
- 配置/safeStorage 空边界、零文件、零加密/解密、零网络、AI `not-configured` 和基础启动不受影响的证据；
- T002 临时根、独立数据库/`userData`、FakeClock、最小环境 allowlist、ownership/containment 和清理证据；
- 每条实际命令、工作目录、环境、source revision、exit code 和关键结果；
- `win-unpacked`、NSIS installer、临时安装态可执行文件的路径、大小、SHA-256，以及实际运行/卸载结果；
- commit、分支、PR、CI head/merge revision、run/job URL 和稳定 check，仅在获批且真实存在时报告；
- 自动化与项目所有者人工检查状态；
- 风险、已知缺口、跳过/未验证项；
- 是否发现需求冲突、范围变化、未批准依赖、真实数据/密钥风险或隔离失败。

不得仅凭代码、测试名称、文件存在、Node-only 结果、旧产物或中间 CI 声称 T004、Windows package smoke 或 G2 完成。

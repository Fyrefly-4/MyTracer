# MyTracer T032 任务合同：版本化完整导出与引用校验

> 合同状态：**done（实现、候选/最终头部 CI、人工验收与文档收尾均已完成）**
> 基线复核日期：2026-08-20
> 基线：最新授权 `dev@f41c601a697f5fbdb6bc3f90656071f7263d7cfe`

## 1. 任务信息

- **Task ID**：T032
- **Title**：Versioned complete export and reference validation
- **Slice / Plan item**：S3 / E3-02
- **Status**：`done`
- **Base branch**：`dev`
- **Expected branch**：`task/T032-versioned-complete-export`
- **前置证据**：T031 已以 `EV-T031-001` 记录为通过；本合同按项目所有者指示把该证据视为有效

## 2. 目标结果

用户从 MyTracer 界面明确触发导出并通过系统保存对话框选择目标后，应用从一个带实际数据版本的一致性 SQLite 快照生成并验证 `MyTracerCoreExportV1`，经同目录专属临时文件复验后安全交付 UTF-8 JSON。成功结果不暴露绝对路径；取消和失败不产生可被误认为有效的最终文件，也不破坏既有有效目标。界面明确说明 v0.1 不支持自动导入或一键恢复。

## 3. 需求依据

- **FR**：FR-D03、FR-D04；回归 FR-D01、FR-D02；FR-D07 为明确延期边界
- **AC**：AC-07 的“完整导出”子集；不声明 AI 不可用矩阵或完整 AC-07
- **D**：D-111
- **ED/GW**：ED-003、ED-004、ED-014、ED-015、ED-017～ED-019；GW-001～GW-004、GW-008～GW-010
- **直接相关架构章节**：`S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md` §5、§6.2、§6.4～§6.6、§7、§8.2、§9、§10～§12；`DATA_DESIGN_V0.1.md` §8～§11；`ARCHITECTURE_V0.1.md` §4、§9；`TEST_STRATEGY_V0.1.md` §3、§5、§6.1、§6.4、§7 E2E-AC-07、§8～§10；`IMPLEMENTATION_PLAN_V0.1.md` E3-02

本合同不复述 S3 §5 已批准的 envelope 字段、包含/排除集合、逐项引用规则或文件交付规约；这些章节直接构成实现与验收规范。

### 3.1 References

```yaml
references:
  requirements:
    - file: docs/PRODUCT_REQUIREMENTS_V0.1.md
      sections: ["9.11 FR-D03/FR-D04/FR-D07", "12 AC-07"]
  decisions:
    - file: docs/DECISIONS.md
      sections: ["3 D-111"]
  engineering_decisions:
    - file: docs/architecture/ENGINEERING_DECISIONS_V0.1.md
      sections: ["ED-003", "ED-004", "ED-014", "ED-015", "ED-017", "ED-018", "ED-019"]
  stage_design:
    - file: docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
      sections: ["5", "6.2", "6.4-6.6", "7", "8.2", "9", "10-12"]
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
  workflow:
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
```

## 4. 开始条件与当前差距

- [x] T031 已完成并有 `EV-T031-001`；`dev` 已包含其交付。
- [x] 当前基线为 `schemaVersion = 2`，migration manifest 为未回写的 `001_initial.sql` 加 `002_add_routine_record_planned_for_date_basis.sql`。
- [x] `CorePersistenceSnapshot` 和 `SqliteRepository.readSnapshot()` 当前覆盖十个核心集合；RoutineRecord 已包含 `plannedForDateBasis`。
- [x] 当前 Repository 逐集合显式排序，但 `readSnapshot()` 不读取 `metadata.schemaVersion`，也没有在方法内部声明并执行覆盖版本与十集合的生产一致性只读事务。
- [x] Main/Preload/Renderer 仍保持窄边界：Main 持有 SQLite、Clock 和 Electron；Preload 只暴露固定 API；Renderer 没有 Node、SQLite、文件、Clock 或任意 IPC/path 权限。
- [x] 可复用 `ClockPort`/`SystemClock`、`FakeClock`、`TemporaryTestRoot.exports`、SQLite transaction、sender/origin 校验和现有 Application/IPC 错误映射模式。
- [x] 当前没有系统保存对话框封装、ExportPort、临时 sibling 安全交付器或文件阶段故障注入；T032 将以可注入的窄适配器依赖建立这些能力，不引入依赖。
- [x] 主工作树位于 `dev`，`HEAD` 与本地 `dev`/`origin/dev` 跟踪 revision 均为 `f41c601...`；合同创建前无已报告的 staged、unstaged 或 untracked 变更。
- [ ] 项目所有者批准本合同的精确文件面、外部文件写入、Git/GitHub 和验证权限。
- [ ] 启动实现时再次确认最新授权 `dev`、工作树、worktree、未提交变更和 Integration Freshness。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T031]
    blocks: [T033]
    can_parallel: []
    prefer_after: []
    conflicts_with: [T033]
  revisions:
    required_dev_base: dev@f41c601a697f5fbdb6bc3f90656071f7263d7cfe
  shared_surfaces:
    - complete-core-snapshot-and-sqlite-repository
    - main-export-ipc-and-preload-api
    - renderer-data-control-and-export-workspace
    - shell-and-package-api-allowlists
    - delivery-evidence-and-task-status
  external:
    - user-selected-local-export-destination
    - github-task-branch-and-draft-pr
    - github-actions-redacted-evidence-artifact
```

T033 与 T032 必须串行：T033 消费本任务导出 API，并与 Main、Preload、Renderer、E2E-AC-07 和证据面重叠。

## 5. 实现落点与允许修改范围

批准后只允许新增或修改下列文件；合同/metadata 是本轮唯一已授权写入：

### 5.1 合同与 metadata

- `docs/implementation/T032_VERSIONED_COMPLETE_EXPORT.md`
- `docs/implementation/metadata/T032.json`

### 5.2 Application、端口与纯校验

- `src/application/complete-export.ts`（新增）：`MyTracerCoreExportV1` 构造、稳定常量、确定性纯校验器、`GenerateCompleteExport` Application service 与稳定应用错误；不做文件 I/O
- `src/application/ports/export.ts`（新增）：窄 `ExportPort`，只接受已构造 document 与建议文件名，不持有 Repository、AI、凭据或 Renderer path
- `src/application/ports/persistence.ts`：增加版本化完整快照类型、`readCompleteCoreSnapshot()` 及窄类型守卫；保留现有 Repository 方法语义

### 5.3 SQLite 与 Main-only 文件交付

- `src/infrastructure/sqlite/sqlite-repository.ts`：在一个 SQLite read transaction/snapshot 内读取实际 `metadata.schemaVersion` 与十个核心集合，复用显式排序并返回脱离连接的数据
- `src/infrastructure/export/system-export-adapter.ts`（新增）：封装 Electron 保存对话框和 Node 内建文件 API；同目录专属临时 sibling、完整写入/flush/close、复读解析/复验、目标新鲜度检查、原子 rename/replace、仅清理本次拥有的临时文件；提供文件阶段依赖注入以覆盖故障

### 5.4 固定 IPC、Preload 与 Renderer

- `src/contracts/exports.ts`（新增）：固定 channel、无输入导出调用、`cancelled | exported` DTO 和稳定安全错误码；成功 DTO 不含路径或 document
- `src/contracts/shell.ts`：只增加冻结的 `exports` 顶层 API 类型
- `src/main/exports-ipc.ts`（新增）：先验证 sender/origin，再拒绝任何参数并映射稳定安全错误
- `src/main/index.ts`：组合 Clock、Repository、ExportPort、Application service 和固定 IPC；文件访问不进入 Renderer
- `src/preload/index.ts`：只增加 `window.myTracer.exports.generate()` 固定方法
- `src/renderer/src/App.tsx`：增加用户触发入口、取消/成功/失败中性反馈，以及“导出不等于自动导入/恢复”的说明
- `src/renderer/src/styles.css`：仅为上述最小界面补充样式

### 5.5 测试

- `tests/unit/complete-export.test.ts`（新增）：document 构造、稳定排序假设、结构/引用/敏感字段正反 fixture、Clock 与错误隔离
- `tests/integration/complete-export-sqlite.test.ts`（新增）：真实 schemaVersion、十集合一致性快照、T031 删除/detach 后引用、关闭重开
- `tests/integration/system-export-adapter.test.ts`（新增）：取消、UTF-8 无 BOM、复读复验及临时写/flush/close/read/parse/validate/destination-change/rename-replace 各阶段故障；旧目标与临时文件结论
- `tests/integration/exports-ipc.test.ts`（新增）：固定 channel、零参数、sender 优先、无 path/document 泄露和稳定错误
- `tests/e2e/complete-export.e2e.test.ts`（新增）：隔离 `userData`/导出目录上的 UI → Main → SQLite → 最终 JSON 连续路径、取消、重开与 T031 删除后导出；测试只在 Main 侧替换保存对话框返回值
- `tests/e2e/shell.e2e.test.ts`：更新并验证精确冻结的 `exports` API 与 Renderer 权限边界
- `tests/e2e/windows-package-smoke.e2e.test.ts`：更新 packaged API allowlist/freeze 检查；不以此代替实际导出 E2E

### 5.6 实现完成后的候选文档收口面

以下文件本合同只允许在 candidate hosted CI 通过、项目所有者再次批准精确 docs closeout 后修改：

- `docs/implementation/T032_VERSIONED_COMPLETE_EXPORT.md`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/metadata/T032.json`（仅实际依赖/共享面发生获批且事实性变化时）
- Draft PR 正文

README、架构、追踪或实施计划仅在 candidate 后的 impact matrix 证明存在持久事实需要更新且所有者明确批准时才允许加入；否则不改。

## 6. 设计摘要

### 6.1 快照

`readCompleteCoreSnapshot()` 是生产导出专用 Query。SQLite transaction 只覆盖版本与全集合读取；返回后立即结束，不跨保存对话框、JSON 构造或文件 I/O。现有 `readSnapshot()` 可保留给测试/既有逻辑，并通过共享的私有行映射实现避免排序漂移；不得由 Application 连续 list 拼装完整导出。

### 6.2 校验

`complete-export.ts` 以无 I/O、无 Electron/SQLite 依赖的纯函数构造并校验 S3 §5 规定的 document。相同校验入口先作用于内存 document，再作用于临时文件重新解析的值；失败统一阻止最终交付。禁止字段检查只针对 JSON 结构中的字段/集合语义，不扫描或记录用户文本内容，也不把全文写入错误或诊断。

### 6.3 交付

Application 从同一 Clock snapshot 取得导出 Instant、本地日期与时区，生成建议名后调用 ExportPort。Main-only adapter 独占对话框返回的绝对路径；临时文件名含不可预测 token，使用独占创建并记录本次所有权。最终替换只使用 Windows/Node 平台经自动化证明不会先删除旧目标的原子行为；目标在对话框返回后发生变化时返回 `destination-changed`。若既有目标无法在当前平台安全原子替换，则返回 `replace-not-supported` 并要求选择新文件名，不降级为删除后重写。

文件系统故障依赖由 adapter 构造参数注入，生产使用 Electron/Node 内建实现，测试逐阶段替换单一操作；不新增通用 filesystem port，不向 Preload/Renderer 暴露路径。

## 7. 明确非范围

- T033 及 AI disabled/not-configured/failure 三态回归；本任务只保持导出实现无 AI 依赖。
- 自动导入、一键恢复、自动备份、定时导出、云/远程目标、同步或账号。
- 直接复制/导出 SQLite 文件、通用文件浏览器、任意路径 IPC、Renderer 文件权限。
- 新表、字段、migration、schemaVersion 变化、修改 `001_initial.sql` 或 `002_*`。
- 修改核心数据、删除语义、Progress/Today/LocalDate/状态语义，或实现 S4～S7。
- 新增/升级依赖、生产 AI Provider、日志/凭据/草稿导出。
- 把“导出成功”描述为“已经可以恢复”。

## 8. 必须保持的不变量

- **引用不变量**：根 `AGENTS.md` §7～§9；S3 §5～§7、§11；Architecture §4/§9；Data Design §8～§11；ED-004、ED-014、ED-015、ED-019。
- Renderer 不获得 Node、SQLite、文件路径、Clock、Repository、ExportPort、凭据、AI Provider 或任意 `ipcRenderer`。
- 导出 Query 不修改数据库；数据库读取事务不跨用户交互或文件 I/O。
- `sourceDataVersion` 来自同一快照的 metadata，而不是编译期常量；`exportVersion` 与 SQLite schemaVersion 保持独立。
- Record LocalDate、Routine `unknown` 缺行语义、T031 provenance、删除后的 cascade/SET NULL 事实不被导出转换重解释。
- 导出只反映未硬删除事实；不从 Renderer 当前筛选或 Progress 投影构造。
- 用户取消时数据库和文件系统零变化；任何失败不得留下有效最终文件假象或破坏旧有效目标。
- 所有自动化只访问每 case 唯一临时数据库、Electron `userData` 和导出目录；不得使用真实用户数据。
- **本任务局部风险**：多次 SELECT 产生撕裂快照；枚举/引用校验遗漏；敏感键误判用户自由文本；Windows 目标替换语义；临时文件归属不清造成误删；错误中泄露路径/document；Preload allowlist 漂移。

## 9. 交付物

- [x] `MyTracerCoreExportV1` 构造与确定性纯校验器。
- [x] `readCompleteCoreSnapshot()` 的版本化一致性 SQLite 实现。
- [x] 窄 `ExportPort` 与 Main-only 系统保存/安全文件交付适配器。
- [x] 固定 export IPC、冻结 Preload API 和最小 Renderer 入口/说明。
- [x] 取消、结构/引用拒绝、敏感排除、写入故障、旧目标守恒与重开测试。
- [x] T031 删除/detach 后导出回归及 S1/S2 受影响回归。
- [x] 精确 revision 的本地/hosted candidate 与 final-head 证据、完整 diff 检查与独立 review。
- [x] candidate CI 后经所有者另行批准完成 docs closeout；项目所有者已报告专用测试 `userData` 人工验收通过。

## 10. 可判定验收标准

1. S3 §5.1～§5.3、§12 S3-Q04-A 的全状态 fixture 经内存校验、序列化、复读解析和同一纯校验器后通过；缺失、重复、非法枚举/日期/Instant/数值/引用及禁止技术字段 fixture 被稳定拒绝。
2. `readCompleteCoreSnapshot()` 在一个只读 SQLite transaction/snapshot 中返回实际 `sourceDataVersion=2` 与十集合；显式排序可重复，返回值脱离连接，关闭重开核心事实相同。
3. T031 删除和 Goal detach 后的 snapshot/export 不含已删除对象，保留对象引用为合法 null；不得产生悬空引用或重解释状态。
4. 导出文件为 UTF-8 无 BOM；建议名、时间与时区来自同一可信 Clock snapshot；任何 Record LocalDate 不被重算。
5. Renderer 只能调用零参数 `window.myTracer.exports.generate()`；不能提交或接收绝对路径、临时名、document、SQLite/文件句柄或任意 channel。
6. 保存对话框取消返回 `cancelled`，不创建临时/最终文件；成功只返回显示文件名、字节数、版本和导出时间。
7. 临时写、flush、close、复读、解析、复验、目标新鲜度与最终原子交付的成功/失败均有注入测试；失败清理仅限本次已验证归属的临时文件，旧目标逐字节不变。
8. 当前 Windows/Node 行为若不能证明对既有目标安全原子替换，应用稳定返回 `replace-not-supported` 并保留目标，绝不先删除；新文件名路径仍可成功交付。
9. UI 明确说明 v0.1 没有自动导入/恢复；代码、API、测试和文案均不实现或暗示 T033、自动备份、云同步或通用文件能力。
10. 针对性测试、affected regression、完整 `verify`、packaged API smoke、完整 diff 自查和独立 review 均无未处理 material finding；无依赖、lockfile、migration 或未批准文件变化。
11. candidate CI 绿后按所有者单独批准范围完成 docs closeout；最新 final-head required CI 通过。Ready、merge、main、tag、release 均不自动授权。
12. `MANUAL`：项目所有者使用专用测试 `userData` 验证保存/取消、可找到并解析的 JSON、界面反馈及“不支持自动导入/恢复”说明；执行前为 `pending`。

## 11. 验证计划

### 11.1 合同与 metadata 门

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
git diff --check
```

### 11.2 针对性 unit / integration / IPC

```powershell
npm.cmd run test:unit -- tests/unit/complete-export.test.ts
npm.cmd run test:integration -- tests/integration/complete-export-sqlite.test.ts tests/integration/system-export-adapter.test.ts tests/integration/exports-ipc.test.ts
```

### 11.3 T032 E2E 与 affected regression

```powershell
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/complete-export.e2e.test.ts tests/e2e/data-control.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

E2E 只把 Main 内 `showSaveDialog` 的返回目标替换为当前 case 的 `TemporaryTestRoot.exports` 子路径；Renderer 仍只发零参数请求，且测试结束前校验目标属于本 case 临时根。

### 11.4 聚合、package、diff 与 evidence

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
npm.cmd run governance:metadata:check
node tools/evidence/capture-command.mjs --task T032 --gate task-candidate --base-revision <approved-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

环境：Windows；Node 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3` 13.0.1。所有数据库、Electron `userData`、导出和安装冒烟目标使用唯一临时根；无 live AI、真实 key 或真实日常数据库。若 Electron/package 不能在当前宿主启动，必须在获准的 Windows 桌面环境完成，不能以 unit/integration 替代。

### 11.5 Hosted CI、freshness、review 与人工步骤

1. 第一个有意义 commit 后，在批准的 publication grant 内创建 Draft PR 到 `dev`，记录 early CI；不声明完成。
2. Implementation Candidate 完成完整 diff 自查、独立只读 review、Integration Freshness Gate 与 affected regression 后推送，等待精确 head/test-merge candidate CI。
3. candidate CI 绿后暂停，提交 docs impact matrix 并申请项目所有者精确批准；批准后独立 docs commit/push，等待 final-head CI。
4. 项目所有者在专用测试数据根执行第 10.12 条；未执行前保持 `pending`。
5. 未获 Ready/merge 授权；交付后进入 merge handoff/monitor，不自行推进 T033。

### 11.6 实际收口记录

- 候选 revision：`79458b88b505346ef81c3cc920224c7cf0eb4ba4`；Draft PR #27 的 `Windows required gate`（run `32349762843` / job `96366157688`）在该 head 上通过。
- 项目所有者已明确批准本合同 §5.6 的 docs closeout，并报告按专用测试 `userData` 执行保存、取消、JSON 解析、界面反馈和“不支持自动导入/恢复”检查均通过。
- docs closeout revision `219d7799fa17e7ba97609fc1c835b74aab060baf` 的 final-head `Windows required gate`（run `32354596797` / job `96380961831`）已通过；任务可标记 `done`，但仍不声明 Ready、merge、`dev` 集成、tag 或 release。

## 12. Git、GitHub、依赖与外部操作权限（待批准）

以下权限是本合同的实施申请，只有项目所有者明确批准本合同时才生效：

```yaml
permissions:
  local_write: true
  create_worktree: true
  create_task_branch: true
  create_commit: true
  push_task_branch: true
  create_or_update_draft_pr: true
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: true
```

权限限制：

- `local_write` 仅限第 5 节精确文件；candidate 后文档只能按第 5.6 节二次批准范围修改。
- `dependency_change: false`：不执行 `npm install`，不修改 `package.json`、lockfile 或批准版本。
- `migration_change: false`：不修改 schema、migration manifest、`001_initial.sql`、`002_*` 或 schemaVersion。
- 本地外部文件写入仅限：用户显式触发并由系统保存对话框返回的最终目标、该目标同目录的本次专属临时 sibling，以及失败时删除该本次临时 sibling；不得枚举、读取或删除其他文件。既有最终目标只可在用户明确选中且平台原子替换已证明安全时一次性交付，绝不预删除。
- 自动化文件写入仅限各 case 自建并验证归属的 OS 临时根；不得触及真实 Electron `userData` 或用户日常导出。
- GitHub 外部写入仅限 push `task/T032-versioned-complete-export`、创建/更新 Draft PR 到 `dev`、读取/触发该 PR CI、上传脱敏 `.tmp/evidence/*.json` artifact，以及 owner 二次批准后的 Draft PR body/docs closeout。
- 不授权 branch protection、Secrets、Issue/Project、Ready、merge、远端分支删除、force-push、main、tag、release 或其他服务写入。
- 网络业务访问：无。AI Provider：无；正常自动化不调用 live provider。

```yaml
integration:
  target_branch: dev
  base_revision: dev@f41c601a697f5fbdb6bc3f90656071f7263d7cfe
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

启动时若最新授权 `dev` 已推进，必须在创建 branch/worktree 前重新复核并把实际 base 写入合同；published branch 变 stale 时只允许普通 merge 刷新，禁止 rebase/force-push。

## 13. 风险与停止条件

出现以下任一情况立即停止受影响工作并按 Escalation Proposal 记录实际 branch/revision/命令/结果：

- 最新授权 `dev` 的 schemaVersion、核心集合、T031 provenance、Repository/IPC/Preload/Renderer 契约或 `EV-T031-001` 与本合同基线不一致。
- S3 §5、S3-Q04-A 与冻结 FR/D/ED 发生冲突，或需要改变 envelope/引用/交付语义。
- 需要新增/升级依赖、schema/migration、通用文件/路径 IPC、Renderer Node/文件/Clock/Repository 权限、AI/Provider、自动导入/恢复、自动备份或云目标。
- `readCompleteCoreSnapshot()` 无法在一个只读 SQLite snapshot 中绑定实际 metadata 版本与全集合，或稳定排序必须改变既有业务语义。
- Windows/Node 文件 API 无法证明：专属临时文件归属、flush/close、复读复验、目标新鲜度、失败时旧目标守恒，以及不先删除的原子最终交付；允许按 S3 §5.6 返回 `replace-not-supported`，但不得静默降级。
- 校验器必须读取凭据、日志、环境、绝对路径或扫描/记录用户自由文本才能工作。
- 需要第 5 节之外文件，或与用户/其他 worktree 未提交修改重叠且不能安全隔离。
- 自动化无法严格限制在唯一临时根，Electron 系统对话框测试必须接触真实用户文件，或无法为写入故障/旧目标守恒产生可靠证据。
- 无法把本地/hosted 结果绑定到明确 revision、base、环境与 artifact。

## 14. 完成报告要求

完成报告使用中文，并列出：实际变更文件和可观察结果；FR-D03/D04、D-111、ED-014 与 AC-07 子集覆盖；`sourceDataVersion`/`exportVersion` 证据；快照、校验、UTF-8、取消、逐阶段故障、旧目标守恒、重开和 T031 删除后导出结果；精确命令/exit code/Windows/Node/Electron/临时根与 artifacts；branch/commit/Draft PR/early-candidate-final-head CI/task delivery revision/freshness；完整 diff 和独立 review；自动化与人工状态；残余风险与未验证内容；是否发现需求冲突、基线漂移、范围/权限/依赖/migration 变化。必须明确 T033、完整 AC-07、自动导入/恢复、Ready、merge、tag 和 release 均未由 T032 自动完成。

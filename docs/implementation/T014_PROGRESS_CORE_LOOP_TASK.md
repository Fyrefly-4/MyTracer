# T014 基础 Progress 投影与 S1 闭环任务合同

> 合同状态：**等待项目所有者批准；不构成实现授权**
>
> 权限边界：本文件只定义候选实现合同。T014 仍为 `pending`；代码实现、任务状态或验收证据修改、依赖安装、Git/GitHub 操作及其他外部写入均未授权。

## 1. 任务信息

- **Task ID**：T014
- **Title**：基础 Progress 投影与 S1 闭环
- **Slice / Plan item**：S1 / E1-04
- **Task ledger status**：`pending`
- **Base / branch**：实现启动时由项目所有者确认；当前不创建分支或 worktree
- **实时前置事实（2026-08-13）**：G2 已通过；S1 设计已批准；`TASK_INDEX_V0.1.md` 已将 T011～T013 标为 `done`，其中 T013 由 `EV-T013-001` 支持。因此 T014 的 T013 依赖按实时任务账本已满足；若启动时账本或证据不再成立，T014 立即阻塞。T014 合同和实现仍须分别获得批准。

## 2. 目标结果

经项目所有者批准本合同并另行发出实现启动指令后，交付基础 Progress 的最小纵向闭环：

- `GetProgress` 作为纯只读 Application Query，从当前 SQLite 事实构建一致投影，经固定窄 IPC 暴露给 Renderer。
- 最小 Progress 页面支持可选 `goalId`，以及可选且包含端点的 `from` / `through` LocalDate；允许全局全时、单 Goal、单周期或组合查询。
- 页面只展示筛选后的累计行动分钟、ActionRecord 真实行动次数、稳定排序的记录列表、未撤销 Understanding 和 open Confusion，并提供中性空状态。
- 完全关闭 Electron 与 SQLite 后，从同一隔离 `userData` 重开，Progress 从保存的事实重新计算且结果一致。
- 在同一最终 revision 连续验证 Goal → Action → Today → ActionRecord → Progress 的 AC-01 自动化闭环；项目所有者未实际执行完整人工 AC-01 时保持 `pending`。

T014 只完成 FR-P02 的 ActionRecord 分支，以及 FR-D01 的 Goal/Action/ActionRecord 重开子集；不得声明统一真实行动次数、完整 FR-D01 或 AC-07 完成。T011～T014 实现和证据齐全后只形成 G3/S1 验收候选，不自动通过阶段门或推进 `main`、tag、release。

## 3. 需求与设计依据

- **FR**：FR-L09；FR-C03 的非 AI 部分；FR-P01～FR-P04、FR-P07、FR-P08；FR-D01 的 Goal/Action/ActionRecord 重开子集。
- **AC**：AC-01 完整闭环；不声明 AC-07。
- **D**：D-007、D-104、D-106。
- **ED**：ED-012、ED-016；横切遵守 ED-003、ED-004、ED-015、ED-018、ED-019。
- **已批准设计**：S1-Q06-A（Action 不重分配 Goal、无 migration）、S1-Q08-B（T014 只查询 open Confusion）、S1-Q09-A（可选 Goal 与包含端点的 LocalDate 范围）。
- **直接相关章节**：
  - `PRODUCT_REQUIREMENTS_V0.1.md` §4、§6.5～6.6、§9.5～9.7、§9.11、§12 AC-01/AC-07；
  - `DECISIONS.md` D-007/104/106；`REQUIREMENTS_CHANGE_POLICY.md`；
  - `ARCHITECTURE_V0.1.md` §4～§6、§9；`DOMAIN_MODEL_V0.1.md` §6～§8；
  - `DATA_DESIGN_V0.1.md` §2～§4、§8、§10～§12；
  - `ENGINEERING_DECISIONS_V0.1.md` ED-012/015/016/018/019；
  - `S1_CORE_LOOP_DESIGN_V0.1.md` §2～§3、§5.5～§7、§8.4～§12；
  - `TEST_STRATEGY_V0.1.md` §2～§9；`REQUIREMENTS_TRACEABILITY_V0.1.md` §2.5～§2.7、§2.11、§4～§5；
  - `IMPLEMENTATION_PLAN_V0.1.md` E1-04；`TASK_INDEX_V0.1.md` T014；`ACCEPTANCE_EVIDENCE_V0.1.md`；`GITHUB_WORKFLOW_V0.1.md`。

`user/` 不属于本合同依据，也不得成为实现、测试或验收依赖。

## 4. 开始条件与权限门

已确认输入：

- [x] G2 和 S1 整体设计已批准；S1-Q06=A、S1-Q08=B、S1-Q09=A。
- [x] 实时 `TASK_INDEX_V0.1.md` 将 T013 标为 `done`，并引用 `EV-T013-001`；本合同不重新检查 T011～T013 的实现和验收。
- [x] 现有 `schemaVersion = 1` 已含 `goals`、`actions`、`action_records`、`understandings`、`confusions`，Progress 无需表或 migration。
- [x] 合同核对未发现 MUST、已批准 D/ED、现有 schema 或前序契约冲突。

实现开始前仍必须全部满足：

- [ ] 项目所有者批准本合同。
- [ ] 项目所有者另行明确发出 T014 实现启动指令；合同批准本身不构成该指令。
- [ ] 启动时重新只读核对 `TASK_INDEX_V0.1.md` 仍记录 T013 `done` 且证据存在；若为 `pending`、`blocked` 或无证据，T014 不得启动。
- [ ] 项目所有者批准第 7 节精确实现文件范围和实际基线 revision。
- [ ] Git/分支/commit、GitHub、依赖安装、任务账本/验收证据收口和其他外部写入权限另行明确；当前全部未授权。

## 5. Query、过滤与投影契约

### 5.1 `GetProgress`

- 输入：`goalId?`、`from?`、`through?`。`from` 和 `through` 是规范 `YYYY-MM-DD` LocalDate，均包含端点；两者同时提供时必须满足 `from <= through`。
- 支持四类查询：全局全时、单 Goal 全时、全局单周期、单 Goal + 单周期。省略一个日期端点表示该方向无界，而不是自动补成当前周。
- 非空 `goalId` 按 Action 的稳定 Goal 关联筛选；不存在的 Goal 返回稳定 `not-found`，不得伪装为空数据。合法但无匹配事实的筛选返回零总数和空记录。
- Query 不读取系统“今天”来改写用户范围，不保存、补全、修复、迁移、撤销 Understanding、解决 Confusion 或生成任何业务写入。

### 5.2 `ProgressView`

顶层返回规范化 filter、`totalDurationMinutes`、`realActionCount` 和 `records[]`。每条记录只包含本次展示所需事实：`recordId`、`actionId`、`goalId?`、Action 标题、`occurredOn`、`durationMinutes`、`outcome`、`understandings[]`、`openConfusions[]`。不返回 note、下一步编辑入口、评分字段或重复的扁平子实体集合。

计算公式：

```text
totalDurationMinutes = sum(filtered ActionRecord.durationMinutes)
realActionCount      = count(filtered ActionRecord)
understandings       = children of filtered records where revokedAt is null
openConfusions       = children of filtered records where status = open
```

- 每条 ActionRecord 分别计一次，包括 `completed`、`partial`、`stopped` 和 0 分钟记录；同一 Action 同日多条不得合并。
- `totalDurationMinutes` 是筛选后所有 ActionRecord `durationMinutes` 之和；`realActionCount` 是筛选后 ActionRecord 数量。
- 0 分钟仍是一次真实行动；UI 显示“少于 1 分钟”或等价中性文案，不得解释为未行动。
- Record 固定按 `occurredOn DESC, createdAt DESC, id ASC`；同一 Record 的 Understanding/Confusion 按 `createdAt ASC, id ASC`。所有 SQL/内存投影均显式排序，不依赖 SQLite 隐含行序。

### 5.3 一致性与只读性

- Progress 不建表、不保存累计值或缓存派生事实；每次从当前 ActionRecord 及其子实体重新计算。
- 总数、记录列表和子实体必须来自同一个 SQLite 一致性只读快照，避免并发写入时产生总数、列表、子实体相互不一致的投影。
- 重复调用同一 Query 不得改变数据库。测试应比较调用前后完整持久化快照或等价可审计状态，并覆盖查询期间的并发写入隔离情形。
- Query 不开启业务写事务；实现可在 Repository/SQLite 适配器内部使用满足一致性读取所必需的只读事务或等价快照机制。

## 6. Application、SQLite、IPC 与 Renderer 边界

- Domain/Application 负责过滤语义、精确计算和事实 DTO；Repository 提供意图级一致性读取，不把 raw SQL、`readSnapshot()` 或通用查询入口暴露给 Renderer。
- 复用 v1 schema、现有 Repository/UnitOfWork 和参数化 SQL；不新增 migration、表、列、索引或累计字段，不修改 schemaVersion 或 `001_initial.sql`。
- Main 注册固定 Progress IPC，复用 sender/origin 校验，并对对象形状、未知字段、UUID、LocalDate、端点顺序做运行时验证；错误只暴露稳定 code 与中性消息，不泄露 SQL、堆栈、绝对路径或用户正文。
- Preload 只在冻结的 `window.myTracer.progress` 下暴露具体 `getProgress` 方法及可结构化克隆 DTO；不得暴露 `ipcRenderer`、任意 channel、SQL、数据库路径、文件系统或 Electron 对象。
- Renderer 只呈现 Application 投影，不自行重算统计。最小 Progress 页面提供必要的 Goal/日期筛选、总分钟、记录到的行动次数、记录事实、确认理解、开放困惑以及 loading/error/empty 状态；不引入复杂图表或比较视图。
- 空数据库、合法无匹配筛选和某日/周期缺少记录均显示中性事实状态；不得推断“失败”“未坚持”“未掌握”或要求补齐空白日期。
- Progress 不生成或展示评分、掌握度、学习质量、失败率、排名、连续天数压力、人格评价、自动建议，也不以 Action 完成数、Goal 达成数或 Routine 达标数替代真实行动次数。

## 7. 精确文件范围

本次合同编写只允许新增：

- `docs/implementation/T014_PROGRESS_CORE_LOOP_TASK.md`

合同获批、另行获得实现启动及文件范围授权后，建议 T014 仅新增或修改：

**Domain / Application / Contracts**

- `src/domain/progress.ts`（新增）
- `src/domain/index.ts`
- `src/application/progress.ts`（新增）
- `src/application/ports/persistence.ts`
- `src/contracts/progress.ts`（新增）
- `src/contracts/shell.ts`

**SQLite / Main / Preload / Renderer**

- `src/infrastructure/sqlite/sqlite-repository.ts`
- `src/main/progress-ipc.ts`（新增）
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`

**Tests**

- `tests/unit/progress-application.test.ts`（新增；可包含纯投影/计算测试）
- `tests/integration/progress-sqlite.test.ts`（新增）
- `tests/integration/progress-ipc.test.ts`（新增）
- `tests/e2e/progress-core-loop.e2e.test.ts`（新增）
- `tests/e2e/shell.e2e.test.ts`（仅更新白名单 API/导航壳回归断言）

实现可在获批时把纯计算单元拆为独立 `progress-domain.test.ts`，但不得据此扩大生产文件范围。`package.json`、lockfile、任何 migration（尤其 `src/infrastructure/sqlite/migrations/001_initial.sql`）、`TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md` 及其他文件当前均不在范围。需要触及未列文件时必须停止并申请批准。

## 8. 明确非范围

- 写入、补记、修改、删除或修复任何历史事实；Understanding 修改/撤销；Confusion resolve/reopen。
- Routine/RoutineRecord 统计；FR-P02 的统一 ActionRecord + RoutineRecord 分支属于 T022。
- 长期未推进提示、周期比较、复杂图表、连续天数主指标、评分、掌握度、学习质量、失败率、排名、人格评价或自动建议。
- Review、Recovery、数据导出/导入、AI Provider/上下文/建议/确认写入，以及 S2～S7 能力。
- Action 完成数、Goal 达成数、Routine 达标数或其他代理指标；任意新用户概念、通用报表/查询平台。
- 新增/升级/安装依赖；migration、schemaVersion、`001_initial.sql`；package/NSIS、真实用户数据库或生产数据操作。

## 9. 必须保持的不变量

1. ActionRecord 的每一行都是一次记录到的真实行动；completed、partial、stopped、0 分钟和同日多条均不得丢失或合并。
2. 分钟只表示投入事实；时间、次数和 outcome 不生成 Understanding、掌握度、学习质量或人格结论。
3. 仅未撤销 Understanding 和 open Confusion 进入 Progress；状态不得由 Query 推断或修改。
4. 缺少记录保持“无已记录事实”，不是失败、未进行、未坚持或未掌握。
5. T014 只聚合 ActionRecord；不得预实现 RoutineRecord 统计或宣称 FR-P02 完整完成。
6. Progress 每次从事实重算，不保存累计值；一次响应的总数、records 与子实体来自同一一致性快照。
7. Query 只读、重复调用零写入；显式稳定排序，不依赖 SQLite 行序或 UUID 顺序。
8. Goal 过滤使用 S1-Q06-A 的稳定 Action.goalId 关联，不新增历史 Goal 快照或 Action 重分配。
9. LocalDate 端点包含且校验明确；不使用 UTC/Instant 替代发生日，不自动固定为当前周。
10. Renderer 无 Node、SQLite、文件、凭据、Provider 或任意 IPC 能力；自动化只使用唯一临时数据库和 `userData`。

## 10. 交付物与完成条件

1. `GetProgress` 在 Renderer → Preload → Main/Application → SQLite 的意图级只读路径可观察；无通用 channel、raw SQL 或 Renderer 自算统计。
2. 四类过滤组合及单边日期范围行为明确正确；LocalDate 包含端点，非法范围、非法 ID/日期和未知字段被安全拒绝。
3. 公式、0 分钟、三种 outcome、同 Action 同日多记录、未撤销 Understanding、open Confusion、空数据和无匹配筛选均有精确自动化证据。
4. Record 与子实体按合同稳定排序；重复查询只读且不依赖 SQLite 隐含行序。
5. 总数、列表和子实体来自一个一致性只读快照，并有并发读取/写入不产生撕裂投影的 SQLite 集成证据。
6. 最小 Progress 页面只展示事实和中性空/错误状态；不存在评分、掌握度、质量、失败率、排名、连续天数压力、人格评价或自动建议。
7. 完全关闭 Electron/SQLite 后，以同一隔离数据根重开，Progress 从事实重算并与关闭前一致；AI 未配置不阻塞。
8. 在同一最终 revision 连续通过 AC-01 自动化：创建 Goal 与下一步 → 选入 Today → 保存 ActionRecord 与可选 Understanding/Confusion/下一步 → Progress 看到时间、1 次真实行动和确认理解 → 真实关闭重开复核。
9. 未新增/升级/安装依赖；`package.json`、lockfile、schemaVersion、migration 集合和 `001_initial.sql` 不变；最终 diff 仅含获批文件。
10. 针对性测试、受影响范围回归、独立 review 和要求的 Windows CI 均绑定同一最终 revision；真实结果才可另行写入验收证据。
11. 证据只声明 T014 对 FR-P02 的 ActionRecord 分支、FR-D01 的 S1 重开子集及 AC-01 自动化闭环；不声明完整 FR-P02、FR-D01、AC-07 或 G3/S1 自动通过。
12. **MANUAL**：项目所有者在同一最终 revision 实际连续执行 AC-01，确认 Progress 易读、中性且记录负担合理；未执行时必须记录 `pending`。

## 11. 验证计划

### 11.1 单元

- 过滤规范化与组合矩阵；包含端点、单边无界、`from > through` 拒绝。
- 精确公式：三种 outcome、0 分钟、同日多记录、跨 Action/Goal/周期；不使用完成数或达标数。
- 只选择未撤销 Understanding 和 open Confusion；稳定父子排序；空数据/无匹配返回中性零值。
- DTO/字段扫描证明无评分、掌握度、质量、失败率、排名、连续天数、人格或建议字段。

### 11.2 SQLite 集成

- 真实 v1 schema 上覆盖全局/Goal/周期/组合查询、端点日期、同日多记录、0 分钟与三种 outcome。
- 总数、records 和子实体同一只读快照；并发写入场景不得返回撕裂投影。
- 调用前后数据库快照一致；多次 Query 不写 metadata、事实表或累计缓存。
- 真实关闭连接并从同一临时数据库重开，比较从事实重算的 Progress；不访问真实 `userData`。

### 11.3 IPC

- 受信 sender 正常；伪造 sender/origin 全拒绝。
- 对象形状、未知字段、UUID、LocalDate、端点顺序和可选组合均做运行时正/负验证。
- Preload API 冻结且只暴露 Progress 白名单方法；错误不泄露内部信息或用户正文。
- IPC Query 重复调用只读；Renderer 不能提交 SQL、数据库路径、排序表达式或任意聚合定义。

### 11.4 E2E 与 AC-01 人工

- 最小 Progress 页面覆盖 loading、error、空数据、无匹配、筛选和事实列表。
- 同一最终 revision 连续完成 Goal → Action → Today → 25 分钟 partial ActionRecord → manual Understanding + open Confusion + 下一步 → Progress；验证 25 分钟、1 次记录到的行动、理解和困惑，且无评价字段。
- 完全关闭应用和 SQLite，以同一隔离 `userData` 重开并复核完整闭环；FakeClock 前进后历史仍存在且旧 Today 不自动搬运。
- 项目所有者执行第 10.12 条人工验收；未执行时 AC-01 manual 为 `pending`。

### 11.5 命令

仅在合同批准、实现启动及本地验证权限另获授权后执行：

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
```

`verify` 已包含 build 和 Electron E2E，但不证明依赖安装、package/NSIS、hosted CI、人工验收或阶段门通过。证据必须绑定同一最终 revision、Windows/Node/Electron 环境、隔离数据根、实际命令结果、独立 review 和已知缺口。

## 12. Git、GitHub、依赖与外部操作权限

- [ ] 创建本地 worktree 或任务分支。
- [ ] 创建本地提交。
- [ ] push 任务分支。
- [ ] 创建或更新到 `dev` 的 Draft PR。
- [ ] 标记 Ready、merge 到 `dev`、创建或合并 `dev → main`、tag 或 release。
- [ ] 执行 `npm install`、`npm ci` 或其他依赖安装；新增或升级依赖。
- [ ] 修改 `TASK_INDEX_V0.1.md`、`ACCEPTANCE_EVIDENCE_V0.1.md` 或其他收口文档。
- [ ] 网络访问、live AI、真实用户数据写入、migration、破坏性操作或其他外部写入。

以上权限当前全部未授权。实现本身也尚未授权；任何授权必须针对确切范围另行取得。即使 T011～T014 的实现和证据齐全，也只形成 G3/S1 验收候选，不自动通过阶段门、推进 `main`、创建 tag 或发布版本。

## 13. 风险与停止条件

主要风险：

- 分步查询可能在并发写入下让总数、列表和子实体来自不同状态。
- SQL join 可能重复父记录、漏计 0 分钟记录或把同日多条合并；反向去重又可能丢失真实行动次数。
- UI/DTO 顺手加入完成数、评分、周期比较或建议，会越过 T014 的事实边界。
- 把合法空结果解释为失败，或把 0 分钟解释为未行动，会改变冻结语义。
- 只刷新 Renderer 或复用同一连接不能证明真实关闭重开和从事实重算。

发现以下任一情况，立即停止受影响设计/实现并报告：

- MUST、D-007/104/106、ED-012/016、已批准 S1-Q06-A/Q08-B/Q09-A、现有 schema 或 T011～T013 契约冲突；
- 启动时 `TASK_INDEX_V0.1.md` 不再将 T013 记录为 `done`，或其完成证据缺失；
- 需要新增/升级/安装依赖、新 migration、表/列/累计缓存、修改 schemaVersion 或 `001_initial.sql`；
- 无法在现有 SQLite/Repository 边界取得一致性只读快照，或无法证明 Query 零写入；
- 需要扩大文件范围、实现/任务状态/Git/GitHub/文档收口/外部写入权限；
- 需要写入或修复历史事实、Routine 统计、复杂图表/比较、评价指标、Review、Recovery、导出、AI 或其他 S2～S7 能力；
- 测试会访问真实 Electron `userData`，或无法在同一最终 revision 产生 AC-01 连续闭环与真实关闭重开证据。

## 14. 完成报告要求

完成报告必须简短列出：实际变更文件；FR-L09、FR-C03 非 AI 部分、FR-P01～P04/P07/P08、D-007/104/106、ED-012/016、FR-D01 子集和 AC-01 的覆盖边界；实际命令、环境、revision、独立 review 与 CI 证据；人工 AC-01 状态；依赖/schema/migration 不变证明；残余风险和未验证项；是否发现需求冲突或范围变化。必须明确 FR-P02 统一统计属于 T022，完整 FR-D01/AC-07 未完成，G3/S1 仍待项目所有者验收决定。

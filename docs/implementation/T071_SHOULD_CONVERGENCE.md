# T071 — 11 条 SHOULD 既定处理结论收敛

> 2026-10-11 事实校准：PR #55 delivery=6b6fb5f72af054a96d57d7c6f53da132a2cdc668，dev integration=248350409927923016de18f7c5d967aa064964ca，final-head run 35417697381 success；旧 null 为当时记录。 任务状态以任务索引为准，见 [EV-DOC-CALIBRATION-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)；下文执行权限与等待文字按原日期理解。

> 合同版本：approved-1 / owner-approved closeout，2026-09-19（保留 §14 的草案检查历史）
> 项目所有者已批准合同并授权 checkout 分支、提交、推送，开始按合同开发。§5 本地实现/验证及 §11 任务分支 publication 生效。
> 不声明 Automation Profile；docs closeout、人工验收、Ready、merge、tag/release 仍遵守独立 owner gate。

## 1. 任务信息

- **Task ID / Title**：T071 / 11 条 SHOULD 的既定处理结论收敛。
- **Slice / Plan item**：S7 / Implementation Plan §10.1。
- **Status**：执行状态以 [TASK_INDEX_V0.1.md](TASK_INDEX_V0.1.md) 为唯一账本；owner 已激活 T071。
- **Base branch**：`dev`。
- **编写基线**：`a37c0eb00d4e3675769ba5e291133de341bfe517`。
- **Expected branch**：`task/T071-should-convergence`，已按批准 checkout；复用当前具备依赖的本地工作目录。
- **流程**：拟采用 V2 / Batch 3；不声明或激活 Automation Profile。

### 1.1 当前状态核对（2026-09-19）

| 对象 | 实际核对结果 | 对 T071 的含义 |
| --- | --- | --- |
| 本地工作区 | 开始时 `git status --short --branch` 为干净 `dev...origin/dev`；HEAD 与本地 origin/dev 均为上述完整 SHA | 本次只留下合同相关未提交修改，不切换、清理或改写其他 worktree |
| 远端 dev | `gh api repos/Fyrefly-4/MyTracer/git/ref/heads/dev --jq .object.sha` 返回同一 SHA | 编写时远端一致；启动实现及 Candidate 前仍须重新核实 |
| S1～S6 业务任务 | 索引 T011～T063 对应业务任务均为 `done`；历史证据见 §3.2 | 既有实现是回归基线，不将历史通过当作当前 revision 的新测试结果 |
| T806 / PR #43 | [PR #43](https://github.com/Fyrefly-4/MyTracer/pull/43) 已于 2026-08-30 合并；final head `605cb5433ca93d8f8353b93ca12e8596e16112f5`；集成 `1d02fd7a0a7b0bf29a5e39720d5818c9d68fdbc2` | [run 33323763973](https://github.com/Fyrefly-4/MyTracer/actions/runs/33323763973) 为该 head 的成功 pull_request run；compare 确认编写基线包含其集成提交 |
| T807 / PR #49 | [PR #49](https://github.com/Fyrefly-4/MyTracer/pull/49) 已于 2026-09-05 合并；final head `523be0a94a43a5bcfd0300f2abc4ec5d34d7abdb`；集成 `fa3ac0a2ac9ec0854615478a14886d764f21c3fc` | [run 33955746084](https://github.com/Fyrefly-4/MyTracer/actions/runs/33955746084) 为该 head 的成功 pull_request run；本地提交历史包含该集成提交 |
| 后续界面基线 | #51 `a9bfac7`、#52 `b1db74b`、#53 `a37c0eb` 已进入 dev | 保留当前布局、会话草稿、筛选和导航体验，不能按旧阶段 UI 覆盖当前实现 |
| 账本漂移 | TASK_INDEX、Evidence、README 仍含 T806/T807 等待 final-head/merge 的历史描述 | owner 已批准采用本合同核实基线；保留漂移说明，不替历史任务签署 `done` 或扩大为 S4～S6 文档收口 |
| S7 输入 | 已批准的总体 Plan §10.1 与 Traceability §3 给出 11 条处理结论；未找到独立 S7 设计文件 | 本合同的最小实现细节已获 owner 批准；不自行设立新阶段任务或重写架构 |

上述 CI 查询只核实 run/head/result，未重新下载历史 artifact，也未恢复 test-merge SHA；不据此重签聚合验收或人工结果。T806/T807 的旧失败、取消执行和 live-contract 限制仍保留。

## 2. 目标结果

用户能够在现有 Goal、Today 和 Progress 流程中得到不阻塞操作的少量目标/重点提示，看到距上次真实行动的事实，并查看简单周期间事实变化。11 条 SHOULD 各自有明确的实现位置、当前版本验证和人工状态；已有六条通过回归确认，不重复建设。

下面 §2.1 已随合同获批，不改变冻结 FR。

### 2.1 已批准的最小实现口径

1. **FR-G07 / FR-T06**：在活跃目标和今日重点的既有列表附近展示简短、常驻软提示，可配合事实数量；不设数值阈值、硬上限、警告弹窗或额外确认，不限制创建、恢复活跃、选入或切换 focus。意向和例行不混入重点数量。
2. **FR-P05**：在现有目标列表的相应目标条目显示“距上次真实行动 N 天”；无真实记录显示“尚无行动记录”，不从创建日期推算。保留已有状态筛选和顺序，不按间隔自动排序、着色或标记“停滞”。暂停/结束不清除历史。
3. **FR-T07**：复用 Today 的现有待选行动区，为关联目标的候选行动显示同一距上次行动事实；无 Goal 的行动不伪造 Goal 间隔。打开候选、查看间隔均不写 TodaySelection；只有用户显式选择才能进入重点或意向。不新建自动提醒、阈值筛选、跨目标排名或自动生成行动。
4. **真实行动口径**：每条有效 ActionRecord（含 completed/partial/stopped、0 分钟）都是事实；Routine 只有 acted/target_met 参与最近行动日期，含非计划日。unknown、not_done、intentional_rest 不刷新该日期。比较 `occurredOn`，不使用 `updatedAt` 或记录创建时间冒充行动时间。复用既有 LocalDate 差值口径；若存在未来发生日，应显式展示其日期并标明晚于今天，不显示负数“N 天”或改写原记录。
5. **FR-P06**：在 Progress 内增加固定的“本周 / 上周”事实比较，周一至周日，按 Main ClockPort 的本地日确定。本周取周一至今天（包含），上周取完整周一至周日；显示实际统计区间，明确可能不是等长区间，不把本周未来日期的记录混入“截至今天”。展示两周各自记录到的投入分钟/真实行动次数及有符号数值差（本周减上周）。本周标明“截至今天，本周尚未结束”（周日仍注明截至当前记录）；不生成百分比、评分、趋势预测、红绿优劣或评价。两周无记录显示事实空态，数值 0 只表示记录统计为 0，不断言用户未行动。
6. **筛选与查询**：比较复用已应用的 Goal 筛选；与现有历史起止日筛选相互独立，并在界面明确标注“周比较按本周/上周，不使用历史日期范围”。未提交的筛选草稿不改变已展示结果。周比较和最近行动由 Application/Domain 形成只读投影，Renderer 不读取全库后自行推导领域统计；同次比较使用一致的事实快照。失败时展示中性错误与重试，不能把旧 Goal 的结果标成新 Goal。
7. **已有六条**：保持现有显式下一步命令、note、补记修正、理解修改撤销和恢复/复盘路径。若回归暴露缺陷，先报告具体 FR、失败证据与允许范围；不自动扩张到邻接功能或重做 S1～S6。

## 3. 需求依据

- **FR（全部 11 条）**：FR-G07、FR-A08、FR-R08、FR-T06、FR-T07、FR-L06、FR-C04、FR-P05、FR-P06、FR-REC05、FR-RV05。
- **AC**：AC-01/03/04/05/06 的相关行为及 AC-07 的重开/导出受影响回归；AC-02 保持既有 fake-provider 回归。完整 AC-01～07 同版本聚合签署属于 T072。
- **D**：D-002、004～010、014～016、101、103～110。
- **ED / GW**：ED-004～008、012～019；GW-001～010。
- **直接架构**：Architecture §4/6/9；Domain §6/8/9；Implementation §10.1；Traceability §3；Test Strategy §4.4/4.5/6～9；S4/S5 Design §3、§6～8 对真实行动、显式恢复/复盘及其 S7 排除边界的说明。

### 3.1 References

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  stage_design:
    - file: docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
      sections: ["10.1"]
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md
```

### 3.2 11 条 SHOULD 基线与验证矩阵

下列“已有”是源码/历史证据定位，均不表示本轮运行通过。不得只用文件名或测试名完成覆盖结论。

| FR | 既定落点及编写时观察 | T071 交付/验证要求 |
| --- | --- | --- |
| FR-G07 | S7；GoalsPage 无少量活跃目标软提示 | 增加中性软引导；多目标创建/恢复仍可继续，人工检查无压力 |
| FR-A08 | S1；Today 记录表单已有显式下一步选择；EV-T013-001、EV-AC01-001 | completed/partial 后显式更新有效；不选择不自动覆盖；ActionRecord/Today E2E 回归 |
| FR-R08 | S3；DataControl/例行记录修改补记；EV-T031-001 | 修改历史日期后投影刷新、plannedForDate basis 保持既定规则、重开保留 |
| FR-T06 | S7；Today 有重点区域但无少量软提示 | 软提示不阻止多条 focus，不把 intention/Routine 视作重点配额 |
| FR-T07 | S7；已有 Today 候选；Recovery 的单 Goal 天数不等于本项完成 | 候选显示关联 Goal 的真实行动间隔；查看前后核心快照零变化；显式选入才写入 |
| FR-L06 | S1；Today 深入层有 note；EV-T013-001 | 可空、可填写，保存/重开保留；快速层不强制打开深入层 |
| FR-C04 | S3；DataControl 子事实修改/撤销；EV-T031-001 | Progress/Recovery/Review 读取更新后事实，撤销不保留伪确认理解 |
| FR-P05 | S7；Recovery 已有单 Goal 日期，但 Goals 列表未提供对应事实 | 多 Goal 分别展示正确事实/空态，无阈值和排名；不能把单 Goal Recovery 历史结果直接记为完成 |
| FR-P06 | S7；Progress 仅现有范围汇总，无周比较 | 本周/上周范围、绝对差、空态、部分周说明与筛选隔离均通过 |
| FR-REC05 | S4；Recovery 已有选择/创建小行动入口；EV-T042-001、EV-S4-S5-001 | 用户决定下一步及选入今天，历史不被改写；保持 #52/#53 的现行路径 |
| FR-RV05 | S5；ReviewResult 可显式更新下一步；EV-T052-001 | 勾选才更新，未选择/取消零额外写入；重开和原子失败回归 |

## 4. 开始条件

- [x] 稳定任务 ID、总体计划及 11 条 SHOULD 依据存在。
- [x] 已只读核对 S1～S6 业务任务、T806/T807 合并事实及当前 dev。
- [x] 拟议方案不需要新增依赖、schema、migration 或 export 格式变更。
- [x] package.json 已定义 unit/integration/E2E/verify 与 metadata 命令。
- [x] owner 批准本合同 §2.1、§5～10 的 T071 实现范围并激活任务。
- [x] 合同批准包含采用上述已核实集成基线，保留 T806/T807 历史账本漂移说明；不代签历史验收。
- [x] §11 的本地实现、checkout、提交和 publication 权限明确；不安装或升级依赖。
- [x] 开始时仅三个合同准备文件有修改；远端 dev 仍为 `a37c0eb`；既有 Node/npm 及标准 metadata 检查通过。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T011, T012, T013, T014, T021, T022, T023, T031, T032, T033, T041, T042, T051, T052, T061, T062, T063]
    blocks: [T072]
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@a37c0eb00d4e3675769ba5e291133de341bfe517
  shared_surfaces:
    - Goal/Today/Progress read models and narrow IPC
    - Record facts, LocalDate, SQLite read snapshots
    - Renderer session, navigation and current visual baseline
    - Existing SHOULD regression and task evidence
  external: []
```

`requires` 展开任务索引中的 S1～S6 业务依赖；T806/T807 是已核对的聚合证据上下文，不另行发明业务依赖边。默认串行实施；若出现同时修改上述共享面的其他任务，先处理隔离与集成风险。

### 4.2 Metadata / Profile

- Sidecar：[metadata/T071.json](metadata/T071.json)，与上述五类依赖一致。
- Sidecar 只声明有限任务类型、依赖及共享面，不授权执行；必须通过 `npm.cmd run governance:metadata:check`。
- 本合同不填写 `execution`、激活时间或有效期。未来启用 Profile 须单独批准并同步 sidecar，不能借用已过期的历史授权。

## 5. 已批准的允许修改范围

| 模块 | 文件/边界 |
| --- | --- |
| Domain | `src/domain/progress.ts`、`src/domain/recovery.ts`、`src/domain/local-date.ts`；可新增 `src/domain/should-facts.ts` 承载纯查询事实组合；不改变写命令不变量 |
| Application / read ports | `src/application/progress.ts`、`src/application/goals.ts`、`src/application/today.ts`、`src/application/ports/persistence.ts`；仅本任务只读投影与服务装配 |
| SQLite | `src/infrastructure/sqlite/sqlite-repository.ts`，仅参数化只读查询/一致性快照，禁止 DDL、迁移或写规则变更 |
| IPC / Preload | `src/contracts/progress.ts`、`src/contracts/goals.ts`、`src/contracts/today.ts`、`src/main/progress-ipc.ts`、`src/main/goals-ipc.ts`、`src/main/today-ipc.ts`、`src/main/index.ts`、`src/preload/index.ts`；仅具体只读 Query 和相应校验/装配 |
| Renderer | `src/renderer/src/features/goals/GoalsPage.tsx`、`src/renderer/src/features/today/TodayPage.tsx`、`src/renderer/src/features/progress/ProgressPage.tsx`、`src/renderer/src/app/ui-session.ts`、`src/renderer/src/styles.css`；仅新事实/提示及必要筛选状态，沿用现有设计 |
| Tests | `tests/unit/` 中 Goal/Today/Progress/Recovery/LocalDate 相关测试；`tests/integration/` 中对应 SQLite/IPC、已有 SHOULD 事实回归；`tests/e2e/` 中 SHOULD/Goal/Today/Progress/Record/Data/Recovery/Review/UX 相关验证；必要 fake fixture 仅限 `tests/` 内 |
| Task records | 本合同、`metadata/T071.json`；启动授权后可在 TASK_INDEX 更新本任务状态、在 ACCEPTANCE_EVIDENCE 记录真实 provisional evidence；最终 closeout 仍单独批准 |

本表随 owner 的合同批准生效。已有六条 SHOULD 的产品修复若超出上述源码范围，须提出具体扩围再实施。

## 6. 明确非范围

- T072、G4、完整 69 MUST / AC-01～07 聚合签署、7～14 天自用、打包发布及下一任务启动。
- 任何冻结语义变化、依赖升级/安装授权的推定、schema/migration/export 格式变化。
- 逾期标签、自动阈值/排名/提醒、完成率/掌握度/生产力评分、复杂统计、任意周期比较配置。
- 自动加入 Today、自动修改 Goal 下一步、补造缺失日记录、改变休息/unknown/非计划日意义。
- AI Provider、上下文、持久化、权限、SDK、真实网络测试；新版查询数据不得顺带进入 AI 请求。
- 全站视觉重做、邻接任务重写、清理其他 worktree/分支，以及未经批准的 S4～S6 历史文档收口。

## 7. 必须保持的不变量

- **引用不变量**：AGENTS §7～9；Domain §6/8/9；ED-004/008/012/013/016/017/019；D-004/008/009/010/014/015/106/108/109。
- **局部风险**：0 分钟、partial/stopped 和非计划日真实行动不可漏算；Routine 休息/未进行不更新最近行动；缺行不变成失败。
- 间隔取显式发生日与 Main 注入的 LocalDate；周跨月/跨年/闰日可重复测试，不能以 UTC 毫秒天数替代。
- UI 查询没有任何领域写入；提示不形成 Domain/IPC 配额验证。日期/记录更正或删除后从剩余事实重算，不用缓存保留旧结论。
- 暂停/结束保留事实；Goal 删除后关联与解绑遵循既有规则，无目标 Routine 不再归入已删除 Goal。
- Renderer 只显示查询结果；Preload API 具体且有类型，Main 验证 DTO 与 sender/origin。
- 当前页面草稿、已应用筛选、选中上下文和错误恢复不被新增查询重置；异步响应不得串 Goal。
- 测试使用唯一临时数据库/userData、FakeClock、FakeAiProvider；不访问真实用户数据或凭据。

## 8. 交付物

- [x] 五条 S7 SHOULD 的最小纵向实现及空态/失败路径。
- [x] 六条既有 SHOULD 的当前 Candidate 回归结果；11 条逐项追踪见 EV-T071-001。
- [x] 对应 Domain/Application、SQLite/IPC 和 Electron E2E 验证。
- [x] 完整 diff 检查与独立只读 review，结论 No findings。
- [x] revision-bound 本地 evidence、首次 hosted 启动记录、成功 candidate CI 和 owner 批准的文档影响矩阵。
- [ ] 文档提交后的 final-head CI；作为 PR 集成门禁在 PR #55 维护，不由 candidate CI 替代。
- [x] owner 于 2026-09-19 明确报告人工验收通过，绑定当时实现内容。

## 9. 验收标准

1. 11 条 SHOULD 均有可核对的实现位置、命令结果和人工状态；缺口不得用“已设计”或历史通过替代。
2. Goal / Today 提示可见且多次创建、恢复活跃、选入 focus 仍不被数量限制；不影响 intention 或 Routine。
3. 最近行动覆盖多个 Goal、无记录、0 分钟、partial/stopped、Routine acted/target_met、休息/not_done/unknown、非计划日及未来日期显示分支；源数据变更/重开后结果正确。
4. Today 候选复用一致的 Goal 日期事实；只读打开/刷新时核心快照不变；显式选入后仅正常 Command 改变状态。
5. 周比较范围/Goal/差值正确；含周一/周日、跨月跨年、闰日、两周空态、只有一周有记录、本周进行中及历史筛选草稿与 applied filter 的区别。
6. 本周与上周分别为只读事实，不把次数叫完成任务数；缺失数据不被称为“未行动”或“失败”；无评分/增长率/阈值。
7. 原有六条 SHOULD 及相关核心路径回归通过；查询投影不改变 schema/export、AI context、写规则和电子进程边界。
8. **MANUAL**：owner 检查软提示、候选事实、周比较清晰且不施压；现有记录入口不被挤占，键盘焦点、常用/窄窗口和会话草稿可用。结果附 revision 和观察。
9. 所有必要验证绑定最终候选；独立 review 无未处理 material finding；授权后的 hosted Candidate、docs closeout、final-head CI 分别记录。不能以本次合同检查宣布 T071 完成。

## 10. 验证计划

### 10.1 定向验证（实现后）

使用已存在的 npm scripts，不在本步建立新脚本。新测试文件必须先落地后再列为已执行。

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/should-facts.test.ts
npm.cmd run test:integration -- tests/integration/should-facts-sqlite.test.ts tests/integration/progress-ipc.test.ts
npm.cmd run test:e2e -- tests/e2e/should-convergence.e2e.test.ts
npm.cmd run test:unit -- tests/unit/goal-application.test.ts tests/unit/today-application.test.ts tests/unit/progress-application.test.ts tests/unit/recovery-domain.test.ts tests/unit/local-date.test.ts
npm.cmd run test:integration -- tests/integration/goal-ipc.test.ts tests/integration/action-today-ipc.test.ts tests/integration/progress-ipc.test.ts tests/integration/progress-sqlite.test.ts tests/integration/recovery-sqlite.test.ts
npm.cmd run test:e2e -- tests/e2e/goal-lifecycle.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/ux-refinement.e2e.test.ts
```

上述定向命令只定位既有相关文件；新增 SHOULD 用例放入其中或单独文件时补充确切命令，不能以旧测试集替代 §9 新增分支覆盖。

### 10.2 受影响回归 / Candidate

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run verify
git diff --check
```

按从窄到宽运行，`verify` 已含 format、lint、typecheck、完整 unit/integration、build/E2E；同一 revision 上完整 `verify` 可满足上面相同检查，避免无依据重复运行。现有 package-only/live-only 用例的跳过须如实报告。T071 不要求打包或 live provider；T072 的整体发布验证另行处理。

### 10.3 确定性证据

```powershell
node tools/evidence/capture-command.mjs --task T071 --gate task-candidate --base-revision <latest-authorized-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

执行前替换实际完整 SHA。Windows `.cmd` 由 wrapper 使用显式 ComSpec argv，`shell: false`；JSON 仅保留脱敏 metadata、真实 exit code，不含日志、正文、凭据、绝对路径。保留失败 artifact，后续成功用 `supersedes`。PR CI 分开绑定 event PR head 与 test-merge revision。

### 10.4 人工步骤

1. 在独立测试 userData 创建若干活跃 Goal 和多个 focus，观察软提示并继续创建/选入；检查意向与例行不受限制。
2. 准备有/无记录、partial、0 分钟、Routine 主动休息及非计划日行动的不同 Goal，比较 Goal 列表与 Today 候选的天数；查看不应改变任何选择。
3. 切换 Goal、历史筛选和页面，检查周比较范围说明、空态、差值、本周尚未结束说明及未提交筛选；修改/删除历史记录并重开，检查投影更新。
4. 复核 note 可选、完成/partial 显式下一步、例行补记修正、理解修改撤销、Recovery 小行动与 Review 显式下一步入口。
5. 检查键盘、窄窗口、页面草稿和中性文案；由 owner 报告结果，不用自动化取代体验判断。

### 10.5 环境与本步检查

- 产品平台：Windows；实现时 Node `24.18.0`、npm `11.16.0`、Electron `43.3.0`（当前 package.json/CI 声明），沿用 lockfile，不升级依赖。
- 本次沙箱实际 Node `v24.19.0`，`npm.cmd` 不在 PATH；尚未完成获准开发环境核验，不将此环境标为产品验证通过。
- 本步可直接以现有 Node 运行 metadata validator，结果仅证明 sidecar 结构；不能冒充 npm 标准门禁或 Windows Electron 验证。
- 开始实现前需定位既有已批准工具链；若需安装或版本变更，先获得相应授权。历史 UX 任务的轻量验证例外不继承到 T071。
- Source：本步为上述 dev SHA 加合同/metadata/索引未提交修改；实现 Candidate、环境和命令结果到时据实填写。

## 11. Git 与 GitHub 权限

当前授权覆盖 §5 实现与非破坏性验证、checkout 任务分支、提交和普通推送。合同中同一任务 Draft PR publication 方案随合同批准生效，不扩张至其他任务或发布动作。

```yaml
permissions:
  local_write: true
  create_worktree: false
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
  external_write: false
```

实施采用当前目录的独立任务分支，不新建 worktree；按只读投影与测试/Renderer/文档分组创建有意义提交，同一任务分支普通 push 与 Draft PR 到 dev。早期 Draft 在首个有意义提交后创建，Candidate 必须独立 review；PR 请求 `CI mode: full`，不能通过标记 Ready 代替 full CI 请求。

Ready、merge、main、tag/release、依赖或迁移、AI 权限变化仍分别获批；禁止 force-push 和远端分支删除。

## 12. 依赖、外部操作与集成

- **新增/升级依赖**：无；本步不安装。若工作目录缺现有依赖，实施前单独明确按锁文件安装的授权。
- **网络**：MyTracer GitHub 基线/PR/CI 只读核对及本任务普通 push、Draft PR 创建/维护；无其他外部写入。
- **AI**：普通验证仅 fake；真实 Provider 不属于本任务。
- **数据操作**：无真实用户数据访问、无迁移或破坏性操作；只在独立测试库执行既有 Command。

```yaml
integration:
  target_branch: dev
  base_revision: dev@a37c0eb00d4e3675769ba5e291133de341bfe517
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: f626f854ba85106fc65abedf8479649f68093948
  dev_integration_revision: null
  stage_final_integration_revision: null
```

Candidate validation 已完成。收口前核对最新 dev 仍为 `a37c0eb00d4e3675769ba5e291133de341bfe517`，与 original_base_revision、verified_against_revision 一致；Integration Freshness 为 `fresh`，refresh_method 为 `none`。具体 source、test-merge 与验证结果见 EV-T071-001；后续合入仍须核对当时基线。

### 12.1 Owner 批准的文档收口范围

| 文件 | 候选事实与边界 |
| --- | --- |
| 本合同 / TASK_INDEX | 核销实际交付、记录候选 revision；文档检查通过后仅 T071 记为 done，T072 保持 pending；metadata 无需变化 |
| ACCEPTANCE_EVIDENCE | 新增 T071 revision-bound 11 条 SHOULD 覆盖、失败/成功、人工状态和 CI 链 |
| REQUIREMENTS_TRACEABILITY | 更新本任务实际实现/测试位置，不改变 FR 优先级或 AC |
| README / 用户指南 | 补充软提示、最近行动事实、周比较的实际能力与使用口径；用户指南只作派生说明 |
| 实施计划、相关架构 | 评估是否需反映经批准的实现落点；无变化则不写 |
| T806/T807 历史账本、归档、README 旧状态 | 已发现漂移；单列事实与精确影响范围供 owner 决定，不在 T071 自动批量改写 |
| PR #55 正文 | 汇总候选验证与文档收口，维护最新 head 和 final-head CI 状态 |

Candidate CI 通过后已按 Skill §10 提交精确影响矩阵，owner 于 2026-09-19 明确批准上述文档、PR 正文、独立 `docs: close T071 delivery records` commit 和 push，并要求随后结束任务。执行 metadata、format、diff 及文档链接检查后提交；推送后确认 final-head CI 启动并交接，不连续监控。PRD、DECISIONS、AGENTS、任务模板和 CI 配置不属于本任务收口。

## 13. 风险与停止条件

- 发现冻结 MUST/SHOULD、D/ED 矛盾，或本方案无法保持其意义时，停止受影响部分。
- 遇到真正需要阶段架构变化、文件/权限扩张、依赖/迁移、AI 上下文改变、真实数据访问或不可靠证据时，使用 [Escalation Proposal](ESCALATION_PROPOSAL_TEMPLATE.md)，不以实现便利绕过批准。
- 当前账本与 GitHub 状态时差已随合同批准采用既有集成基线；工具链已在 §14.2 核验，不签署历史任务完成。
- §2.1 的当前周/上周及未来日期表达已获批准；若 owner 选择其他口径，先修订合同及测试矩阵，不静默切换。
- 现有六条 SHOULD 发现源码缺口时保留失败事实；超出 §5 的修复先提交具体扩围。
- 若无其他有效工作，外部 CI 依 AGENTS §6.4 HANDOFF，不连续轮询，不自动启动 T072。

## 14. 完成报告与批准记录

实现完成报告必须列出文件、五条新能力及六条回归、FR/AC/D/ED、实际验证与环境、独立 review、人工状态、revision/PR/run/artifact、缺口与需求/范围冲突。

| 日期 | Owner 指令/事实 | 生效范围 |
| --- | --- | --- |
| 2026-09-19 | “为我着手 T071 的开发，本步先同步当前状态，进行合同编写” | 当时仅本地合同准备及状态核对 |
| 2026-09-19 | “同意并批准合同内容，给予checkout分支，提交，推送的git权限，开始按合同内容进行T071开发” | 激活 §2.1/§5 实施，checkout、提交、普通 push 和合同约定的同任务 Draft PR；不激活 Profile 或免除独立 owner gates |
| 2026-09-19 | “人工验收 通过”，明确批准 Fyrefly-4/MyTracer 推送、dev Draft PR 与独立只读 Agent | 人工验收绑定实现 revision `6aea651`；独立审查完整 diff 至 `561fe74`，No findings；不授权 Ready 或 merge |
| 2026-09-19 | “批准上述文档范围、Draft PR 正文更新，以及该独立提交和推送。随后你的任务结束。” | 执行 §12.1 精确收口；推送后确认新 head CI 启动即交接 |

### 14.3 交付结论

五条新增 SHOULD 和六条既有 SHOULD 回归已闭合，完整映射见 [需求追踪 §3](../architecture/REQUIREMENTS_TRACEABILITY_V0.1.md#3-should-结论汇总) 和 [EV-T071-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-t071-001)。本地 Windows `verify` 在产品 revision `6aea65156decc7b3c2f0c85333b883170724b24c` 通过（255 unit、130 integration、27 E2E；live-only/package-only 各一项按配置跳过）。候选 `f626f854ba85106fc65abedf8479649f68093948` 的 hosted run `35416556236` 和 required gates 通过，人工验收为 owner-reported pass。未发现需求冲突或范围扩张；无依赖、migration、AI 权限或写规则变化。文档 final-head CI 和 owner-controlled merge 是剩余集成门禁，T072/G4 与发布不属于本任务。

合同准备时未运行产品测试或执行 Git 写入；该历史不代表获批后的执行状态。11 条 SHOULD 的当前 Candidate 自动化/人工验收据后续实际结果登记。

### 14.2 启动 preflight

2026-09-19：checkout `task/T071-should-convergence` 成功；现有工具链位于 `C:/nvm4w/nodejs`，实际 Node `24.18.0`、npm `11.16.0`，无需安装/升级；使用该工具链执行 `npm.cmd run governance:metadata:check` 通过（19 sidecar / 1 Profile）。沙箱默认 PATH 差异已通过使用现有批准工具链解决。

### 14.1 本步合同检查记录

- `node tools/governance/validate-task-metadata.mjs --metadata-dir docs/implementation/metadata --task-index docs/implementation/TASK_INDEX_V0.1.md`：通过，19 sidecar / 1 Profile；直接 Node 入口不等于已验证标准 npm 环境。
- `node node_modules/prettier/bin/prettier.cjs --check docs/implementation/metadata/T071.json`：最终通过。初次发现格式问题，CLI 写入因沙箱 EPERM 未成功；通过 apply_patch 按仓库 Prettier 配置修正后重查通过。
- `git diff --check`：通过；另只读核对两个新增文件的差异与内容。Markdown 在仓库 Prettier ignore 中，不声称自动 Markdown 排版校验通过。
- 一次性只读 Node 检查：合同本地 Markdown 链接均存在，定向命令中测试文件均存在，11 条 SHOULD 矩阵无缺行。
- 本记录只证明合同准备与结构检查；不替代独立实现 review、产品测试或人工验收。

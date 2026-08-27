# T094 Structural UI Refactor 任务合同

> 任务类型：implementation / engineering enabler
>
> 合同状态：**done**；实现 Candidate、独立复核、本地完整验证、Windows package smoke、PR #35 exact-head required CI 和项目所有者批准的 docs closeout 均已完成；final-head CI 与合入仍属于 PR 集成门禁
>
> 产品边界：本任务只重构 Renderer ownership，不改变产品行为、文案、布局、颜色、间距、响应式断点或交互语义

## 1. 任务信息

- **Task ID**：T094
- **Title**：Structural UI Refactor
- **Slice / Plan item**：G4 pre-S4 Renderer foundation；不新增产品切片
- **Status**：done；人工同环境视觉对比、PR final-head CI 与 `dev` 合入状态见完成报告
- **Base branch**：`dev`
- **Authorized base**：`dev@353a4d42921175374dec178a75ad2748eb184cdf`
- **Expected branch**：`task/T094-structural-ui-refactor`

## 2. 目标结果

在不改变任何用户可见行为和进程边界的前提下拆分当前 Renderer ownership：

1. `App.tsx` 只组合 `AppErrorBoundary` 与 `AppShell`，不导入业务 DTO、不调用 IPC、不持有 feature 状态。
2. `AppShell` 只管理 section、`ShellStatus`、导航和应用壳层。
3. Goals、Routines、Today、Progress、Data Control、Review 各自拥有页面状态、DTO、IPC、刷新逻辑和错误文案。
4. 草稿、展开、选择、确认和导出过程状态保持在最接近其交互的组件内。
5. 目录表达 ownership，但不以文件数量为目标；只在职责边界清晰时拆组件或 feature-local hook。

核心完成标准：代码结构清晰，但用户看到和使用到的产品基本无变化。

## 3. 需求依据

- **FR**：无新增或修改；回归覆盖现有 S1～S3 Renderer 路径。
- **AC**：AC-01、AC-03、AC-04、AC-07 行为回归。
- **D**：D-003～D-011、D-015、D-016、D-103、D-106、D-107、D-111。
- **ED/GW**：ED-001、ED-002、ED-004、ED-012、ED-019；GW-001、GW-002、GW-004、GW-008～GW-010。
- **直接相关架构章节**：`ARCHITECTURE_V0.1.md` §4.1、§6、§7、§9；`TEST_STRATEGY_V0.1.md` §1～3、§7～9。

这些编号只用于证明结构重构没有破坏已批准行为；T094 不重新声明 S1～S3 产品能力完成，也不实现 S4～S7。

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
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
```

## 4. 开始条件、依赖与 shared surface

- [x] S0～S3 已完成，现有 Renderer 行为和回归测试可作为重构基线。
- [x] T093 已完成并接入 `standard-task@1`。
- [x] T805 已由 PR #34 合入 `dev@353a4d4`，final-head required CI 通过，状态已收口。
- [x] 项目所有者已批准 T094 合同、Profile、任务分支和 Draft PR 权限。
- [x] 不新增依赖、migration、IPC 或产品语义。
- [x] 当前任务已激活。
- [x] 项目所有者于 2026-08-27 发出开始 `local_development` 的明确指令，并在实现 CI 通过后批准 docs closeout 与再次推送。

```yaml
dependencies:
  tasks:
    requires: [T033, T093, T805]
    blocks: [T041]
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@353a4d42921175374dec178a75ad2748eb184cdf
  shared_surfaces:
    - src/renderer/src/App.tsx
    - src/renderer/src/styles.css
    - src/renderer/src/app/
    - src/renderer/src/features/
    - tests/e2e/
  external:
    - GitHub task branch task/T094-structural-ui-refactor
    - one Draft PR from the task branch to dev
```

T094 阻塞 T041。Recovery 后续必须能在 Goals/Recovery feature 边界内接入，不重新设计 App、AppShell 或主导航。

### 4.1 Automation Profile

```yaml
execution:
  profile: standard-task@1
  activated_at: 2026-08-27T14:46:46+08:00
  valid_until: 2026-09-26T14:46:46+08:00
  additional_constraints:
    - type: pause_before
      phase: local_development
```

该暂停点保留激活时的 owner gate；项目所有者已于 2026-08-27 明确解除该暂停并授权实际开发。Profile、合同与 sidecar 的激活参数继续一致，不把一次性 owner 决定改写成新的 Profile 权限。

## 5. 允许修改范围

实际开发指令下达后，允许修改：

- `src/renderer/src/App.tsx`
- `src/renderer/src/app/**`
- `src/renderer/src/features/**`
- `src/renderer/src/shared/**`，但每个 shared component 必须由至少两个真实 feature 使用
- `src/renderer/src/styles.css`，仅当 ownership 迁移确有必要且级联、class 与视觉结果保持不变
- 与 Renderer 行为回归直接相关的现有 `tests/e2e/**`

本次激活和后续获批 closeout 允许修改：

- `docs/implementation/T094_STRUCTURAL_UI_REFACTOR.md`
- `docs/implementation/metadata/T094.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- Draft PR 正文中的任务状态、验证和风险字段

## 6. 明确非范围

- 不修改 Domain、Application、Main、Preload、IPC、contracts、SQLite 或 migration。
- 不新增或升级依赖。
- 不引入 service/client/repository 层、Context、Router、全局 Store、缓存层或表单框架。
- 不实现 S4～S7、Recovery、Review 业务、AI Start Help 或延期能力。
- 不改变 IPC 次数、顺序、重试、预取、缓存或 mutation 后的既有重查编排。
- 不做 UI redesign、CSS token 化、视觉整理、颜色/布局/间距/断点调整。
- 不为目录对称创建空 feature、空 hook、单用途 shared abstraction 或通用 Form/Modal/Data Loader。
- 不修改测试断言以接受行为、文案、可访问名称或布局语义变化。

## 7. 必须保持的不变量

- `window.myTracer` 对象结构、方法名、输入 DTO、结果 DTO 和错误码不变。
- Renderer 仍不得访问 Node、SQLite、文件路径、凭据、Provider 或任意 IPC channel。
- 导航顺序保持 Goals、Routines、Today、Progress、Data、Review；默认 section 保持 Today。
- section 切换继续卸载非活动 feature，返回时按现有逻辑重新查询。
- focus、intention、planned Routine、`unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 保持区别。
- partial/stopped ActionRecord 继续是真实行动事实，不自动完成 Action。
- pause/end、terminal Today 项、recording context、跨日确认、删除预览和导出行为保持不变。
- 现有用户文案含义、heading、label、button name、dialog/status role 和测试依赖的 class 保持。
- `styles.css` 默认留在原位；纯视觉复用继续优先使用 CSS。
- AI 未配置或失败时核心使用路径仍可用。

本任务局部风险是 ownership 搬迁改变 state/effect 生命周期、对话框焦点、刷新顺序或 CSS 级联；任何此类变化都属于回归，不是重构自由度。

## 8. 交付物

- [x] `App.tsx` 收敛为 `AppErrorBoundary` 与 `AppShell` 的组合根。
- [x] AppShell 只保留 section、ShellStatus、导航和应用壳层。
- [x] 六个现有 feature 拥有各自 Renderer 状态、DTO、IPC、刷新和错误文案。
- [x] 局部草稿、展开和确认状态未提升到全局。
- [x] 未创建 shared abstraction；不存在低于两个真实 feature 复用的 shared component。
- [x] 现有 Renderer E2E、AC-01/03/04/07、`verify` 和 Windows package smoke 通过。
- [x] 完整 diff 和独立 review 无未处理 finding。
- [x] 实现 Candidate、Draft PR、实现 hosted CI 和项目所有者批准的 docs closeout 已由 `EV-T094-001` 记录。

## 9. 验收标准

1. `App.tsx` 只组合 `AppErrorBoundary` 与 `AppShell`，不导入业务 DTO、不调用 IPC、不持有 feature 状态。
2. AppShell 只拥有 section、ShellStatus、导航和壳层，不解释业务 DTO。
3. 每个 feature 自己拥有页面状态、DTO、IPC、刷新逻辑和错误文案。
4. 没有新增 service/client/repository、Context、Router、Store、缓存或表单抽象。
5. 没有为了目录整齐机械创建空文件或低价值组件。
6. `shared/` 中每个组件至少被两个真实 feature 使用；纯视觉复用由 CSS 承担。
7. 用户行为、文案、布局、颜色、间距、响应式断点和交互语义保持不变。
8. 现有可访问名称、role、关键 class 和 `window.myTracer` API 保持不变。
9. AC-01、AC-03、AC-04、AC-07 在同一 candidate revision 回归通过。
10. T041 可以在不重新修改 App、AppShell 或导航结构的情况下接入 Recovery。
11. `npm.cmd run verify` 与 Windows unpacked/NSIS package smoke 通过。

## 10. 验证计划

### 针对性验证

```powershell
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/shell.e2e.test.ts tests/e2e/goal-lifecycle.e2e.test.ts tests/e2e/action-today.e2e.test.ts tests/e2e/action-record.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts
npm.cmd run test:e2e:run -- tests/e2e/routine-lifecycle.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts
npm.cmd run test:e2e:run -- tests/e2e/data-control.e2e.test.ts tests/e2e/complete-export.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts
```

### 受影响范围与候选验证

```powershell
npm.cmd run governance:metadata:check
node tools/evidence/capture-command.mjs --task T094 --gate task-candidate --base-revision <actual-dev-sha> --output .tmp/evidence -- npm.cmd run verify
npm.cmd run package
npm.cmd run test:package-smoke
```

### 人工步骤

1. 在同一 Windows 环境对比重构前后六个 section。
2. 确认标题、文案、布局、颜色、间距、按钮位置和响应式表现基本无变化。
3. 抽查 Goal、Today 快速记录、Routine 五态、intention、Progress、Data 导出和删除取消。
4. 审查 T041 接入面，确认 Recovery 无需重新设计壳层。

### 验证环境

- OS：Windows
- Node/Electron：使用仓库锁定版本
- 数据根：自动化使用唯一临时 `userData`；不得访问真实用户数据
- AI：fake/disabled/not-configured；不得使用 live Provider
- Source revision：`543180b85960334808563af49d0aa96caab31b00`

## 11. Git 与 GitHub 权限

- [x] 允许创建隔离 worktree/本地任务分支。
- [x] 允许创建本地提交。
- [x] 允许推送任务分支。
- [x] 允许创建或更新到 `dev` 的 Draft PR。
- [ ] 允许将 Draft 标记为 Ready。
- [x] 不允许 Agent 合并到 `dev`。
- [x] 不允许 Agent 创建或合并 `dev -> main` PR。
- [x] 不允许 Agent 创建 tag 或 release。

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

`external_write` 仅限 `task/T094-structural-ui-refactor` push 和该分支到 `dev` 的同一 Draft PR。docs closeout、Ready、merge、tag、release、ruleset 和 secrets 仍需独立所有者授权。

## 12. 依赖与集成

- 新增/升级依赖：无
- 网络访问：任务分支/Draft PR/CI 所需 GitHub 操作
- AI Provider：不适用；只用现有 fake/disabled/not-configured 验证
- 数据破坏性操作：无

```yaml
integration:
  target_branch: dev
  base_revision: dev@353a4d42921175374dec178a75ad2748eb184cdf
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: 543180b85960334808563af49d0aa96caab31b00
  dev_integration_revision: null
  stage_final_integration_revision: null
```

## 13. 风险与停止条件

发现下列情况时停止受影响实现并报告：

- 需要改变产品行为、文案含义、视觉布局、状态、日期、删除、AI 或 IPC 语义；
- 需要修改 Renderer/Renderer E2E/批准治理记录之外的文件；
- 需要新增依赖、migration、service/client/repository 或全局状态；
- 需要提前实现 T041 或 S4～S7；
- 现有测试必须弱化才能通过；
- 测试会触及真实用户数据或 live Provider；
- 无法在同一 candidate revision 证明 AC-01/03/04/07 和 package smoke。

任务特有风险：CSS 级联漂移、StrictMode/effect 竞态、表单草稿重置、recording context 取消、对话框焦点、mutation 后刷新顺序和过度抽象。

## 14. 完成报告

- **Ownership 结果**：`App.tsx` 只组合 `AppErrorBoundary` 与 `AppShell`；AppShell 只拥有 section、ShellStatus、导航、Hero、footer 和 feature 组合。Goals、Routines、Today、Progress、Data Control、Review 分别迁入真实 feature 边界；Routine recording 保持明确的 Routine 子边界并由 Today 组合。
- **结构限制**：未创建 `shared/`、feature-local hook、service/client/repository、Context、Router、全局 Store、cache 或表单框架；`styles.css`、依赖、Renderer E2E、Main、Preload、Domain、Application、IPC/contracts、SQLite 和 migration 均未修改。
- **Candidate / base**：实现 Candidate 与 task delivery revision 为 `543180b85960334808563af49d0aa96caab31b00`；授权并验证的最新 `dev` base 为 `353a4d42921175374dec178a75ad2748eb184cdf`，Integration Freshness 为 `fresh`。
- **本地验证**：三组合同定向 Electron E2E 分别 6/6、4/4、3/3 通过；evidence-wrapped `npm.cmd run verify` 通过 159 unit、88 integration、13 Electron E2E；`npm.cmd run package` 和 Windows unpacked/隔离 NSIS smoke 1/1 通过；metadata、format、lint、typecheck 与 diff integrity 通过。
- **Hosted CI**：PR #35 的 Verification run `33048721709` 在 exact head `543180b...` 上通过 PR quality、Governance checks、Full Windows verification、CI Gate 和 Windows required gate；CI test-merge revision 为 `c54ab7f82117e1673e934663adafac8ddd4c5526`。
- **Review**：完整 branch diff 和独立只读复核无未处理 finding；没有需求冲突、架构冲突、依赖或范围变化。
- **Evidence**：`EV-T094-001`；本地 artifact `.tmp/evidence/T094-task-candidate-543180b85960-20260827070521.json`；CI artifact `verification-evidence-33048721709-1`。
- **人工状态**：项目所有者已批准 docs closeout；同一 Windows 环境的六 section 视觉对比仍为 `pending`，不得由 Agent 代签。CSS、文案、class 和现有语义断言未改，自动化行为回归已通过。
- **PR 集成状态**：任务账本可在本次 closeout tree 上记为 `done`；closeout push 后的新 final-head required CI、Ready 和合入 `dev` 仍是独立 PR 集成门禁。Agent 未获授权 Ready 或 merge。
- **下一入口**：T041 仍需独立合同和项目所有者启动授权；它可以在 Goals/Recovery feature 边界内接入，不需要重新设计 `App.tsx`、AppShell 或主导航。

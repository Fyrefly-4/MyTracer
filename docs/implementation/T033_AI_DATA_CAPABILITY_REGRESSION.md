# T033 AI 关闭、未配置或失败时的数据能力回归任务合同

> 任务类型：S3 数据独立性回归任务
>
> 任务状态：**review**（Implementation Candidate 与候选 CI 已通过；获批 docs closeout 正在等待 final-head CI）
>
> 合同准备基线：`dev@43e6406684dbb1b1ef30d006063242e9a552da80`
>
> 项目所有者已明确授权第 14.2 节所列本地修改、worktree、任务分支、commit、push 和 Draft PR；Ready、merge、tag、release 与外部 AI 调用仍未授权。

## 1. 任务信息

- **Task ID**：T033
- **Title**：AI 关闭、未配置或失败时的数据能力回归
- **Slice / Plan item**：S3 / E3-03
- **Status**：review
- **Base branch**：`dev`
- **Observed authorized base**：`dev@43e6406684dbb1b1ef30d006063242e9a552da80`
- **Expected branch**：`task/T033-ai-data-capability-regression`
- **Process**：采用当前 V2 task candidate、deterministic evidence、candidate CI、owner-approved docs closeout 和 final-head CI 流程。

## 2. 目标结果

在不实现生产 AI Provider、Start Help 或 AI 配置 UI 的前提下，用离线、确定性自动化证明：

1. AI 处于 `disabled`、`not-configured`、`failure` 三种测试组合时，代表性的 Goal、Action、Routine、Today、两类 Record、Progress、删除和完整导出能力均继续可用；
2. 三态使用相同数据服务组合、相同业务输入和等价隔离 fixture 时，数据命令、查询、SQLite 快照和完整导出得到与 AI 状态无关的等价结果；
3. fake provider 的失败不会产生未经用户确认的核心写入，也不会使 SQLite 连接、删除事务或 `ExportPort` 在同一应用组合中失效；
4. S3 Design §9.2 的 E2E-AC-07 连续程序在同一明确 revision 上完成，并同时通过 E2E-AC-01、E2E-AC-03、E2E-AC-04 受影响回归；
5. 人工 AC-07 在项目所有者实际执行前始终保持 `pending`。

T033 只验证 AI 外围状态与现有核心数据能力的独立性。它不实现或验收 AC-02、生产 Provider、AI Start Help、长期记忆或 S6。

## 3. 需求依据

- **FR**：FR-D01～FR-D05；FR-AI06、FR-AI09；回归 FR-G01～G06、FR-A01～A07、FR-R01～R09、FR-T01～T05/T08、FR-L01～L08、FR-C01/C04、FR-P01～P04/P07/P08。
- **AC**：AC-07；受影响回归 AC-01、AC-03、AC-04。AC-02 明确非范围。
- **D**：D-003、D-004、D-008～D-016、D-101、D-103～D-109、D-111。
- **ED/GW**：ED-003、ED-004、ED-008、ED-010、ED-011、ED-014～ED-019；GW-001～GW-004、GW-008～GW-010。
- **直接相关架构章节**：AI Boundary §2、§5～§10；Implementation Plan §6 E3-03；S3 Design §2.1～§2.3、§6、§7.5、§8.3、§9～§11、§13～§14；Test Strategy §2～§3、§5～§10；Requirements Traceability §2.8、§2.11、§4～§7。

### 3.1 References

```yaml
references:
  requirements:
    - file: docs/PRODUCT_REQUIREMENTS_V0.1.md
      sections: ["4 PR-08", "9.1-9.8", "9.11 FR-D01-FR-D05", "12 AC-01/AC-03/AC-04/AC-07"]
  decisions:
    - file: docs/DECISIONS.md
      sections: ["2 D-003/D-004/D-008-D-016", "3 D-108/D-109/D-111", "4 延期决定"]
  engineering_decisions:
    - file: docs/architecture/ENGINEERING_DECISIONS_V0.1.md
      sections: ["ED-003", "ED-004", "ED-008", "ED-010", "ED-011", "ED-014-ED-019"]
  stage_design:
    - file: docs/architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md
      sections: ["2.1-2.3", "6", "7.5", "8.3", "9-11", "13-14"]
  architecture:
    - docs/architecture/AI_BOUNDARY_V0.1.md
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S1_CORE_LOOP_DESIGN_V0.1.md
    - docs/architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md
  workflow:
    - AGENTS.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
  prerequisites:
    - docs/implementation/T031_RECORD_DATA_CONTROL.md
    - docs/implementation/T032_VERSIONED_COMPLETE_EXPORT.md
```

References 只作为准确索引，不创建新产品语义。`user/` 不属于本任务依据。

## 4. 开始条件、当前实现与测试缺口

### 4.1 合同准备时的只读复核

- [x] 当前检出、HEAD、本地 `dev` 与现有 `origin/dev` tracking ref 均为 `43e6406684dbb1b1ef30d006063242e9a552da80`；合同创建前工作树干净。
- [x] T031、T032 已完成并已有有效证据；当前 `dev` 已包含 schemaVersion 2、事务性数据控制和版本化完整导出。
- [x] 当前生产配置只有 `AiConfigurationState { configured: false, availability: 'not-configured' }`；`EmptyAiConfiguration` 与 empty safeStorage credential adapter 构成未配置空边界。
- [x] 当前生产代码没有 `AiStartHelpProvider` 实现、Start Help Application service、Provider SDK、真实网络调用、AI 配置 UI 或用户可见 `disabled`/`failure` 状态。
- [x] `GoalService`、`ActionService`、`TodayService`、`RoutineService`、`ActionRecordService`、`RoutineRecordService`、`ProgressService`、`DataControlService` 和 `CompleteExportService` 的构造依赖仅为现有 Repository/UnitOfWork/Clock/ID/ExportPort；均不依赖 AI configuration 或 provider。
- [x] `SystemExportAdapter`/`ExportPort` 不持有 Repository、AI Provider 或凭据；SQLite connection/repository 也不读取 AI 状态。
- [x] `tests/support/fake-ai-provider.ts` 已支持 success、timeout、cancellation、authentication failure、parse failure、late response 和 fabricated fact 的脚本化、离线、可观察调用；常规自动化不需要真实 Provider、网络或 API key。
- [x] E2E-AC-01、E2E-AC-03、E2E-AC-04，以及 T031 data-control 和 T032 complete-export E2E 已分别存在，并使用唯一临时 `userData`/数据库/导出根与真实关闭重开。
- [x] 项目所有者于 2026-08-21 明确批准 T033 实现以及本地修改、worktree、任务分支、commit、push 和 Draft PR 权限；不授权 Ready、merge、tag 或 release。
- [x] 已从最新授权 `dev@43e6406684dbb1b1ef30d006063242e9a552da80` 创建 `.tmp/T033-worktree` 和 `task/T033-ai-data-capability-regression`。

### 4.2 当前缺口

| 缺口 | 当前事实 | T033 需要补齐 |
|---|---|---|
| 三态构造 | 生产 shell 只呈现 `not-configured`；`disabled`/`failure` 不是生产状态 | 建立测试专用、非用户可见的三态 harness，明确调用次数和失败触发方式 |
| fake 与数据组合 | fake provider 只有自身 unit tests，未与 SQLite/data services 放入同一回归组合 | 在同一 case 中先构造/触发 AI 状态，再运行统一数据能力矩阵 |
| 零写入证据 | fake 自测没有比较完整核心快照或导出 | failure 前后比较 `readCompleteCoreSnapshot()`/核心查询；证明未经确认零核心写入 |
| 后故障可用性 | 未证明 fake 失败之后 SQLite、删除事务、Progress 和 ExportPort 继续工作 | failure 后继续执行写、读、删除预览/取消/确认、重开和完整导出 |
| AC-07 连续性 | T031 与 T032 E2E 分文件覆盖，尚无包含 AI 三态的完整 E2E-AC-07 连续程序 | 新增 T033 连续 E2E，复用现有固定 Preload API，不新增测试 IPC 或任意路径能力 |
| 跨态结果比较 | 现有测试未比较三态下相同输入的等价快照/导出 | unit/integration 使用 FakeClock 与确定性 ID 做精确比较；E2E 按语义 ID 映射比较图结构和状态 |
| 同 revision 回归 | AC-01/03/04 已有历史证据，但未与 T033 candidate 绑定 | 在同一最终 candidate revision 重新执行并记录实际结果 |

### 4.3 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T031, T032]
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: [T061, T062, T063]
  revisions:
    required_dev_base: dev@43e6406684dbb1b1ef30d006063242e9a552da80
  shared_surfaces:
    - fake-ai-provider-and-ai-test-composition
    - main-optional-ai-and-data-service-composition
    - sqlite-data-control-export-regression-fixtures
    - e2e-ac07-and-ac01-ac03-ac04-regression-suite
    - task-metadata-evidence-and-stage-candidate-docs
  external: []
```

T061～T063 属于 S6，并与 fake provider、Main AI 组合和 AI 测试语义共享修改面；T033 不与其并行，也不提前建立其生产接口。若 T061～T063 已启动或共享文件出现未合并修改，先停止并重新确认串行顺序。

T033 采用 V2 流程。项目所有者已批准实现；`docs/implementation/metadata/T033.json` 必须在任何实现代码修改前创建并通过 `governance:metadata:check`。

## 5. 三种 AI 状态的确定性构造

三态均为 T033 测试编排标签，不新增用户可见产品概念，不写入 SQLite，也不进入完整导出。

| 状态 | 确定性构造 | 必须证明 | 明确不声称 |
|---|---|---|---|
| `disabled` | test harness 将 AI 调用门固定为 `false`；放置一个“若被调用即失败”的 `FakeAiProvider`，但不触发 `requestStartHelp` | provider 调用次数严格为 0；统一数据矩阵全部可用 | 不新增生产关闭开关、配置 UI 或新 Shell DTO |
| `not-configured` | 复用当前 `EmptyAiConfiguration` 与 credential protection stub，固定得到 `configured=false`、`availability=not-configured`；不绑定可调用 provider | 当前生产空配置路径可启动并完成统一数据矩阵；provider 调用次数为 0 | 不把 safeStorage 可用性当成已配置，也不读取真实 key |
| `failure` | 在与数据服务同一 case 生命周期内使用 `FakeAiProvider`；主矩阵先脚本化一次即时 `authentication-failure`。另以参数化哨兵覆盖 `parse-failure` 和 `timeout`，timeout 由测试 `AbortController` 明确取消以确定性结束 | 每次失败前后核心快照逐集合相同；无普通应用命令由失败自动触发；随后 SQLite、Progress、删除和完整导出继续可用 | 不声称生产 Start Help 错误 UI、AC-02、远程超时栈或厂商错误映射已实现 |

failure 的 fake request 只使用无用户正文的固定测试 marker。fake 没有 Repository、UnitOfWork、SQLite、文件系统或 ExportPort 能力。若必须实现生产 Provider、生产 Start Help Application service、真实 Provider 错误映射或真实网络才能构造 failure，立即停止并报告依赖冲突。

## 6. 三态数据能力矩阵

以下矩阵必须对 `disabled`、`not-configured`、`failure` 各运行一次。每态使用独立临时根，但使用相同 FakeClock、确定性 fixture、命令顺序和期望结果；failure 必须先触发 fake 异常再继续矩阵。

| 能力 | 代表性入口 | 每态必须断言 |
|---|---|---|
| Goal | create、update details、pause/resume；另建 disposable Goal 用于确认删除 | ID/状态/当前下一步规则一致；pause 保留历史；AI 状态不进入实体 |
| Action | create/update、Today focus 与 intention、complete/cancel/reschedule 的代表分支 | 同日 focus/intention 语义不变；partial Record 不偷换 Action 状态；未发生 intention 零失败事实 |
| Routine | create/update schedule、pause/resume、查询 day-state | 四显式 outcome 与缺行 unknown 保持区别；计划快照/LocalDate 不受 AI 影响 |
| Today | `selectAction`、`selectActionAsIntention`、`get`，以及计划 Routine | 相同本地日期下得到等价 focus/intention/routine 视图；不自动搬运历史 Action |
| ActionRecord | 当前快速记录或历史 backfill；至少一次 update | outcome、分钟、LocalDate、Understanding/Confusion 与父状态解耦；成功后详情/Progress 重查 |
| RoutineRecord | 当前记录或历史 backfill；至少一次 update | `target_met`/`acted`/`intentional_rest`/`not_done` 与 unknown 语义、planned snapshot/basis 保持 |
| Progress | `progress.get` 全局及代表性筛选 | 时间、真实行动次数、目标达成次数、有效 Understanding、open Confusion 等价；无评分/推断失败 |
| 删除 | `previewDelete` → `cancelDelete`；重新 preview → `confirmDelete` | 取消快照零变化；确认在单事务完成；cascade/SET NULL/current-next 结果一致；失败后 SQLite 仍可提交 |
| 完整导出 | `exports.generate` / `CompleteExportService.generateCompleteExport` | exportVersion/sourceDataVersion、十集合、状态、LocalDate、枚举、引用与敏感排除等价；`ExportPort` 在 failure 后可交付 |
| 关闭重开 | 关闭 SQLite/Electron，再用同一 case 临时根重建 | 三态下修改、删除、detach、Progress 与导出事实持久一致 |

比较规则：

- unit/integration 使用 FakeClock 和确定性 ID 生成器，比较完整 snapshot、查询 DTO 和内存导出 document 的精确相等；
- E2E 的生产 UUID 不要求跨 case 字符串相同；测试按创建顺序建立语义 ID 映射后比较实体图、关系、状态、日期、计数和导出内容；
- 文件交付元数据若包含 case 专属目标文件名，只排除该宿主交付字段；不得排除核心集合、关系、版本、LocalDate 或状态来制造“相等”；
- failure 的 fake 调用前后必须额外做一次零写入 snapshot 比较；之后再执行完整矩阵，不能只证明应用仍能打开。

## 7. E2E-AC-07 与受影响回归

### 7.1 连续程序

新增的 T033 E2E 必须直接采用 S3 Design §9.2 的连续程序，并在同一明确 revision、Windows、隔离 `userData` 和受控日期上证明：

1. 通过现有 UI/固定 Preload API 创建包含 Goal、Action、Routine、TodaySelection、两类 Record、Understanding 和 Confusion 的代表性数据；
2. 修改/补记两类 Record 与子事实，查询 Progress、Today/day-state 和详情；
3. 执行删除预览、取消、确认、stale/重新预览的代表路径，并证明事务结果；
4. 完全关闭 Electron/SQLite 后从同一临时根重开；
5. 通过现有 Main-only 保存目标注入导出并解析最终 UTF-8 JSON，验证版本、集合、状态、引用与敏感排除；
6. 使用既有 unit/integration 故障测试承接 T032 文件阶段故障深度，并在连续 E2E 中至少证明导出取消/成功不会因 AI 状态改变；
7. 在 `disabled`、`not-configured`、`failure` 三个独立临时 case 中重复第 1～5 步的代表矩阵；failure 先触发 fake 异常并证明零核心写入；
8. 同一最终 revision 运行现有 `progress-core-loop.e2e.test.ts`、`routine-record.e2e.test.ts`、`action-intention.e2e.test.ts`，分别绑定 AC-01、AC-03、AC-04 回归。

E2E 不增加任意 IPC、测试专用 Renderer 权限、路径参数或生产 AI 状态。若单个连续测试过长，可以在同一文件中拆成共享 fixture 的多个清晰 case，但证据必须证明 S3 §9.2 各步骤和三态矩阵均在同一 revision 完成，不能只用测试文件名代替行为证据。

### 7.2 人工 AC-07

项目所有者在专用人工测试 `userData` 上执行 S3 Design §9.3：修改/补记、Progress、删除预览/取消/确认、pause/end 区别、重开、完整导出、AI 不可用时的数据能力，以及“无自动导入/一键恢复”说明。

人工结果必须记录为 pass/fail/partial 并附观察。项目所有者实际执行前，T033 与完整 AC-07 的人工状态始终为 `pending`；自动化不得替代或预先标记通过。

## 8. 允许修改范围与共享修改面

### 8.1 当前合同阶段唯一授权写入

- `docs/implementation/T033_AI_DATA_CAPABILITY_REGRESSION.md`

本阶段不创建 metadata，不修改代码、测试、配置、依赖、任务索引或验收证据。

### 8.2 合同获批后的首选实现范围

- `docs/implementation/metadata/T033.json`（新增；V2 依赖与共享面 sidecar）
- `tests/support/ai-data-capability-harness.ts`（新增；三态构造、相同 fixture 和结果规范化）
- `tests/unit/ai-data-capability-harness.test.ts`（新增；三态调用规则、failure 零命令与比较器）
- `tests/integration/ai-data-capability.test.ts`（新增；真实 SQLite、统一服务组合、三态矩阵、删除事务、重开和内存 ExportPort）
- `tests/e2e/ai-data-capability.e2e.test.ts`（新增；E2E-AC-07 连续程序和三态代表矩阵）

以下现有文件默认只复用和运行，不修改：

- `tests/support/fake-ai-provider.ts`
- `tests/support/fake-clock.ts`
- `tests/support/temporary-test-root.ts`
- `tests/e2e/data-control.e2e.test.ts`
- `tests/e2e/complete-export.e2e.test.ts`
- `tests/e2e/progress-core-loop.e2e.test.ts`
- `tests/e2e/routine-record.e2e.test.ts`
- `tests/e2e/action-intention.e2e.test.ts`

若新 harness 无法复用现有 fake 或临时根，只允许对 `tests/support/fake-ai-provider.ts` 或 `tests/support/temporary-test-root.ts` 做保持现有语义的最小测试基础设施修正；修改前必须记录具体缺口，且不得放宽真实数据隔离、加入网络、Provider SDK、密钥或生产行为。

### 8.3 允许的最小缺陷修复

首选结果是生产代码零修改。只有新回归测试实际证明以下现有缺陷之一时，才允许最小生产修复：

- `src/main/index.ts`：可选 AI 配置/诊断初始化异常错误地阻断 SQLite 打开或现有数据服务/ExportPort 注册；
- `src/application/query-shell-status.ts`：读取现有未配置状态时错误地阻断或改变数据查询；
- `src/infrastructure/configuration/empty-ai-configuration.ts`：empty/safeStorage 降级未保持 `not-configured`，从而阻断现有基础能力。

修复只能做错误隔离或恢复现有 `not-configured` 降级，不得新增生产 `disabled`/`failure` 状态、Provider、Start Help、配置 UI、密钥读取、AI channel 或数据写权限。若缺陷位于其他生产文件，先停止并申请合同精确扩围，不得自行修改。

### 8.4 candidate 后文档收口候选

只有 candidate hosted CI 通过且项目所有者再次批准精确 docs closeout 后，才可修改：

- `docs/implementation/T033_AI_DATA_CAPABILITY_REGRESSION.md`
- `docs/implementation/metadata/T033.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- Draft PR body

README、架构、PRD、DECISIONS、需求变更规则、T031/T032 合同和其他文档默认不修改。若事实性 impact matrix 显示必须更新，先申请所有者精确批准；不得借 docs closeout 改需求或扩大范围。

## 9. 明确非范围

- 生产 AI Provider、模型、SDK、真实 Provider contract test、网络请求、API key 或 safeStorage 密钥保存。
- AI 配置 UI、用户可见关闭开关、新 Shell AI 状态、Provider 选择或诊断面板。
- Start Help、最小上下文选择器、建议展示/确认、AC-02，以及 T061～T063/S6。
- AI 自动创建、修改、重新安排或删除 Goal/Action/Routine/Record；任何未经用户确认的核心写入。
- 长期 AI 记忆、对话历史、草稿持久化、自动画像、自动计划或主动介入。
- S4 Recovery、S5 Review、S7 收敛及任何延期能力。
- 自动导入/恢复、自动备份、云同步、回收站或新的导出格式。
- 修改 T031/T032 契约、既有 migration、schemaVersion、数据库表/列、依赖或 lockfile。
- 用真实用户数据库、日常 `userData` 或日常导出目录做自动化。

## 10. 必须保持的不变量

- 核心数据命令只能通过现有 Application service 与 Domain invariants；AI/fake 无 Repository、UnitOfWork、SQLite、文件系统或 ExportPort 权限。
- 未经用户确认，AI failure、迟到响应、解析失败或 fake payload 均产生零核心写入。
- Renderer/Preload 不获得 Node、SQL、路径、凭据、Provider、任意 channel 或测试后门。
- `unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 保持不同；缺行不推断失败。
- Record outcome 不自动改变 Action/Goal/Routine 当前状态；focus/intention 与历史 LocalDate 语义保持。
- pause/end 保留历史；硬删除继续经过影响预览、取消/二次确认、freshness、单事务 cascade/SET NULL/current-next 清空。
- Progress 从剩余事实重算，不新增 AI 相关累计或状态字段。
- 完整导出继续覆盖全部未删除核心状态与必要关系，排除凭据、AI 草稿、技术日志和路径；ExportPort 不读取 AI。
- 自动化只使用每 case 唯一临时 SQLite、Electron `userData` 和导出根；失败清理不得越出已验证归属根。

**引用不变量**：AGENTS.md §7～§9；AI Boundary §2、§6～§10；S3 Design §6～§7、§9～§11；ED-003/004/008/010/011/014/018/019。

**本任务局部风险**：为了构造 `disabled`/`failure` 而提前新增生产 AI 状态或测试后门；把外置 fake 自身失败误报为完整 Start Help 降级；跨态比较排除过多字段而掩盖数据差异；E2E 重复 destructive 操作时复用真实或非唯一数据根。

## 11. 交付物

- [x] T033 metadata sidecar 与治理校验通过。
- [x] 非用户可见的三态测试 harness，状态构造和 provider 调用规则可判定。
- [x] 三态统一数据能力矩阵的 unit/integration 自动化。
- [x] failure 前后完整核心快照零变化，以及 failure 后 SQLite/删除事务/ExportPort 可用的证据。
- [x] E2E-AC-07 连续程序与三态代表矩阵。
- [x] 同一 candidate revision 的 E2E-AC-01、E2E-AC-03、E2E-AC-04 受影响回归。
- [ ] 完整 `verify`、Windows package/smoke、deterministic evidence、hosted candidate CI 与独立 review 已通过；docs closeout 后的 final-head CI 尚待执行。
- [x] 项目所有者已批准任务状态、索引、Evidence 和 Draft PR 正文的 docs closeout；人工 AC-07 保持 `pending`。

## 12. 可判定验收与完成条件

1. `disabled` 由关闭测试调用门构造，provider calls 为 0；`not-configured` 由当前 `EmptyAiConfiguration` 构造，配置值准确且 provider calls 为 0；`failure` 由 fake 的 authentication/parse/abort-controlled timeout 构造，无网络/key。
2. 三态下统一矩阵的 Goal/Action/Routine、Today、ActionRecord/RoutineRecord、Progress、删除和完整导出命令/查询均成功，结果按第 6 节比较规则等价且不含 AI 状态。
3. 每个 failure 子场景前后 `readCompleteCoreSnapshot()` 逐集合相同，没有由 provider 输出或错误触发的 Application 命令；无未经确认的 Goal/Action/Routine/Record/Understanding/Confusion/TodaySelection/ReviewResult 写入。
4. canonical failure 之后，新的 SQLite 写事务能够提交，Progress 能从事实查询，删除 preview/cancel/confirm 保持事务语义，`ExportPort` 能完成一次合法完整导出。
5. 删除取消为零变化；确认后的 cascade、SET NULL、current-next 清空、剩余事实重算和关闭重开结果在三态下等价。
6. 三态导出均通过版本、十集合、枚举、LocalDate、引用与敏感排除校验；AI 状态、fake 脚本、Provider 错误、凭据和测试路径不进入 document。
7. E2E-AC-07 按第 7.1 节在隔离 Windows Electron 环境连续通过；所有 destructive case 使用唯一临时根，未接触真实用户数据。
8. E2E-AC-01、E2E-AC-03、E2E-AC-04 在同一最终 candidate revision 通过；不以历史证据或测试名称替代本次实际结果。
9. targeted unit/integration/E2E、`npm.cmd run verify`、Windows package 与 package smoke、metadata gate、完整 diff 检查和独立 review均无未处理 material finding。
10. `dependency_change: false`、`migration_change: false`；`package.json`、lockfile、schema、migration、T031/T032 合同及非批准文件均未变化。
11. `MANUAL`：项目所有者实际完成 S3 Design §9.3 前，完整 AC-07 人工状态保持 `pending`；执行后只能记录所有者报告的 pass/fail/partial 与观察。
12. T033 完成只形成 G3/S3 数据安全候选；不自动授权 Ready、合入 `dev`、创建/合并 `dev -> main`、tag 或 release，也不声明 AC-02、Provider 接入、S6 或 G4 完成。

## 13. 验证与证据计划

### 13.1 合同、metadata 与静态门

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
git diff --check
```

### 13.2 针对性 unit / integration

```powershell
npm.cmd run test:unit -- tests/unit/ai-data-capability-harness.test.ts tests/unit/fake-ai-provider.test.ts tests/unit/configuration.test.ts
npm.cmd run test:integration -- tests/integration/ai-data-capability.test.ts tests/integration/data-control-sqlite.test.ts tests/integration/complete-export-sqlite.test.ts tests/integration/system-export-adapter.test.ts
```

针对性证据必须分别列出 disabled/not-configured/failure、failure 子场景、零快照变化、后故障 SQLite/delete/export 可用和三态结果比较，不得只报告总测试数。

### 13.3 E2E-AC-07 与 affected regression

```powershell
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/ai-data-capability.e2e.test.ts tests/e2e/data-control.e2e.test.ts tests/e2e/complete-export.e2e.test.ts tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts tests/e2e/shell.e2e.test.ts
```

上述命令必须绑定同一 source revision。新 T033 E2E 证明连续 AC-07 和三态矩阵；现有三个 AC 文件分别证明 AC-01、AC-03、AC-04 回归；data-control、complete-export 和 shell 文件补充既有深度与安全边界。若文件或测试名称变化，Evidence 记录实际行为和输出。

### 13.4 聚合、Windows 产物与 deterministic evidence

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
node tools/evidence/capture-command.mjs --task T033 --gate task-candidate --base-revision <approved-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

环境：Windows；Node 24.18.0；npm 11.16.0；Electron 43.3.0；`better-sqlite3` 13.0.1。所有 SQLite、Electron `userData`、导出和 package smoke 目标必须位于每 case 唯一、已验证归属的临时根。常规自动化完全离线，不读取真实密钥或调用 live Provider。

### 13.5 revision、CI、review 与证据收口

1. 获得实现授权后，从当时最新授权 `dev` 创建独立 worktree/branch，并把实际 base 写入合同/metadata；旧 base 不能直接作为 freshness 证明。
2. 首个有意义 commit 后，在获批 publication grant 内 push 并创建 Draft PR，记录 early hosted CI；early 结果不证明完成。
3. Implementation Candidate 完成完整 diff 自查、独立 review、Integration Freshness Gate 和 affected regression 后，运行并记录 candidate hosted CI。
4. candidate CI 通过后暂停，提交 docs impact matrix；只有项目所有者批准精确 docs closeout 后，才更新 T033 合同、metadata、TASK_INDEX、ACCEPTANCE_EVIDENCE 和 Draft PR body。
5. docs closeout 后运行 latest-head final-head CI，记录 task delivery revision；早期或 candidate CI 不替代 final-head。
6. Evidence 至少绑定：task/base/source revision、Windows/Node/Electron、精确命令与 exit code、脱敏 artifact、三态结果、E2E-AC-07、AC-01/03/04、完整 diff/review、known limitations 和人工 `pending`。
7. 若后续获批合入 `dev`，另记 `dev_integration_revision` 和最新 `dev` affected regression；本合同不授予 merge。

## 14. Git、GitHub、依赖与外部操作权限

### 14.1 当前合同阶段已授权权限

```yaml
current_contract_permissions:
  local_write:
    allowed: true
    files: [docs/implementation/T033_AI_DATA_CAPABILITY_REGRESSION.md]
  create_worktree: false
  create_task_branch: false
  create_commit: false
  push_task_branch: false
  create_or_update_draft_pr: false
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: false
  external_ai_call: false
```

### 14.2 项目所有者已批准的实施权限

项目所有者已于 2026-08-21 明确批准以下权限：

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

- `local_write` 仅限第 8.2～8.3 节文件；第 8.4 节文档仍需 candidate 后二次精确批准。
- `dependency_change: false`：不执行依赖安装/升级，不修改 `package.json`、lockfile 或批准版本。
- `migration_change: false`：不修改 schema、migration manifest、`001_initial.sql`、`002_*`、schemaVersion 或 fixture 数据版本语义。
- AI Provider 仅允许 `tests/support/fake-ai-provider.ts` 的本地离线 fake；网络业务访问、真实 Provider、真实 API key、Provider SDK 和外部 AI 调用均为零。
- 自动化文件写入只限各 case 自建并验证归属的 OS 临时根及 ignored `.tmp/evidence/` 脱敏 JSON；不得触及真实 `userData`、凭据或日常导出。
- `external_write: true` 只申请 push `task/T033-ai-data-capability-regression`、创建/更新 Draft PR 到 `dev`、触发/读取该 PR CI、上传脱敏 evidence artifact，以及经 owner 二次批准的 docs closeout/PR body。
- 不授权 Ready、merge、远端分支删除、force-push、branch protection、Secrets、Issue/Project、`main`、tag、release 或其他服务写入。

```yaml
integration:
  target_branch: dev
  base_revision: dev@43e6406684dbb1b1ef30d006063242e9a552da80
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

启动实现时若最新授权 `dev` 已推进，必须先只读复核并更新实际 base。已发布分支变 stale 时只允许普通 merge 刷新、重新 affected regression/review/candidate CI；禁止 rebase/force-push 改写历史。

## 15. 风险与停止条件

出现以下任一情况立即停止受影响工作，保留实际 branch/revision/命令/结果，并按 Escalation Proposal 报告：

- 必须实现生产 Provider、Provider SDK、Start Help、AI 配置 UI，或使用真实网络、API key/safeStorage 密钥才能构造或验证三态。
- 必须修改 T031/T032 合同、已批准 S3 语义、FR/AC/D/ED，或把 AC-02、S6、长期记忆、自动计划等移入 T033。
- 必须新增/升级依赖，修改 migration/schema/schemaVersion，回写 `001_initial.sql`/`002_*`，或改变导出 envelope、删除、LocalDate、Today/Progress 语义。
- 必须把 `disabled`/`failure` 变成生产或用户可见状态，新增测试专用 IPC/Renderer 权限，或让 fake/AI 获得 Repository、SQLite、ExportPort、路径或写命令。
- failure 无法在 fake/test harness 内离线、确定性触发，或其证明必须依赖尚未实现的 T061～T063。
- 三态结果只有通过忽略核心字段、关系、状态、LocalDate 或版本才能比较为等价。
- AI failure 前后核心快照不一致，或 failure 后 SQLite、删除事务、Progress、ExportPort 任一不可用；在原因明确前不得通过放宽断言收口。
- 需要第 8 节之外生产文件，或与 T061～T063/其他 worktree 的未提交修改重叠且不能安全串行。
- 自动化可能访问真实用户数据库、`userData`、凭据或日常导出，或 destructive 清理目标不能证明归属。
- 无法把 targeted、E2E、hosted CI、review 和 docs closeout 绑定到明确 revision，或人工 AC-07 状态无法如实保持 `pending`。

截至合同准备完成：未发现 MUST、D/ED、S3 设计与当前代码之间的产品语义冲突；无需依赖或 migration；当前缺口属于 T033 已批准的数据独立性回归范围。

## 16. 完成报告要求

完成报告必须使用中文并列出：

- 实际新增/修改文件和最小生产缺陷修复（如有）；
- FR-D01～D05、FR-AI06/AI09、AC-07、D-014/D-015、ED-010/011 的覆盖；
- disabled/not-configured/failure 的精确构造、provider 调用次数、failure 子场景和零写入证据；
- 三态 Goal/Action/Routine、Today、Record、Progress、删除、重开和完整导出结果；
- E2E-AC-07 与 AC-01/03/04 同 revision 回归结果；
- 精确命令、exit code、环境、临时根隔离和 evidence artifacts；
- branch/commit/Draft PR、early/candidate/final-head CI、freshness、task delivery revision、完整 diff 和独立 review；
- 自动化状态与项目所有者人工 AC-07 的实际状态；未执行必须写 `pending`；
- 风险、已知缺口、未验证内容，以及是否发现需求冲突、基线漂移、范围/权限/依赖/migration 变化；
- 明确声明 T033 只形成 G3/S3 候选，不自动授权 Ready、merge、`dev -> main`、tag 或 release；AC-02、Provider 接入、Start Help、长期记忆、S6 和 G4 均未由 T033 完成。

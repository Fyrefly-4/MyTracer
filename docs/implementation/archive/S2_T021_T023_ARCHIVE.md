# MyTracer S2 / T021～T023 开发合同归档

> 状态：归档候选；T021～T023 均为 `done`，AC-03/AC-04 自动化与项目所有者人工验收均为 `pass`；本归档随 T802 PR #20 合入 `dev` 后生效
>
> 归档日期：2026-08-17
>
> 用途：保留 S2 已完成开发合同中仍影响后续实现、验证和审计的最小有效信息

## 1. 权威边界

- 本文是 T021～T023 的精简归档，并记录其聚合门禁修复 T802；不是新的实现合同，也不授权 T031～T072、`main`、tag 或 release。
- 当前任务状态以 [`TASK_INDEX_V0.1.md`](../TASK_INDEX_V0.1.md) 为准；实际验证以 [`ACCEPTANCE_EVIDENCE_V0.1.md`](../ACCEPTANCE_EVIDENCE_V0.1.md) 为准。
- 冻结需求、决定、架构和工程决定仍高于本文；本文不改变任何 FR、AC、D、ED、S2-Q 或 GW。
- S2 的批准设计和边界仍以 [`S2_ROUTINE_INTENTION_DESIGN_V0.1.md`](../../architecture/S2_ROUTINE_INTENTION_DESIGN_V0.1.md) 为准。
- 原 T021～T023 合同完整内容保留在 Git 历史和 PR #17～#19 中；本归档只保留最终范围、批准、验证、限制和恢复入口。
- T802 合同按项目所有者要求在首次推送前删除且从未进入 Git 历史；本文仅记录 T802 已批准、实际执行的最小修复和归档职责，不重建该合同。

## 2. 最终交付索引

| Task | 最终范围 | 实现 revision | PR / merge revision | Evidence |
|---|---|---|---|---|
| T021 / E2-01 | Routine 生命周期、ISO 星期节奏、Goal 接缝、Today 计划项与重开 | `07c626739b454378f8af886c1d233da6f0bd97e6` | [PR #17](https://github.com/Fyrefly-4/MyTracer/pull/17) / `e3e7346eba492f1de810ffe34b41b1d96831c3af` | `EV-T021-001` |
| T022 / E2-02 | RoutineRecord 四显式结果、缺行 unknown、非计划日事实、Today/Progress 与 AC-03 | `022b6e25731a07f113692a452de0128367059574` | [PR #18](https://github.com/Fyrefly-4/MyTracer/pull/18) / `68239dafb0d742b09abb2583544a37361157c872` | `EV-T022-001` |
| T023 / E2-03 | 通用 Action 非强制 intention、显式转换、跨日不滚动与 AC-04 | `b747f41d647891d1de0ef77a61840fdbc87cfa0f` | [PR #19](https://github.com/Fyrefly-4/MyTracer/pull/19) / `0106996b45a41275370c46bd3f6ea842573f0889` | `EV-T023-001` |
| T802 / S2 fix | package API 门禁、连续 AC-03、S1 v1 数据守恒与本归档 | `a61d0bc100752ae1209623a2ac020ff25a62bf8f` | [PR #20](https://github.com/Fyrefly-4/MyTracer/pull/20) / 待项目所有者合入 | `EV-T802-001` |

T021～T023 的任务级完成事实不等于 T802 或 S2 聚合收口已完成。PR #20 最新文档 head 的 required CI、项目所有者 merge、合并后最终 `dev` 聚合验证和里程碑 `dev → main` 动作仍是独立门禁。

## 3. S2 最终行为合同

- Routine 支持创建、修改、pause、resume 和 end；ended 为终态。pause/end 保留 Routine、Goal 关联、星期集合与全部历史 RoutineRecord。
- Routine 可关联一个 Goal或独立存在；S2 不支持 reassign。Goal pause/end 不自动改变 active Routine，Today 仍显示并标注关联 Goal 状态。
- schedule 是非空、唯一的 ISO weekday 1～7 集合；“每天”“工作日”只展开为集合。星期集合表达当前计划节奏，不预生成未来 Record。
- Routine 创建与完整 schedule、schedule 整组替换分别为单事务原子写入。修改 schedule 或 `minimumAction` 不重写历史 `plannedForDate`。
- Today 只读投影 active 且当前可信 LocalDate 匹配的计划 Routine；Query 不补行、不写 TodaySelection，也不制造 Record。
- RoutineRecord 只持久化 `target_met`、`acted`、`intentional_rest`、`not_done` 四种明确结果；`unknown` 表示缺少 Record，不能持久化或推断为失败。
- 同一 Routine/LocalDate 最多一条 create-only Record。`plannedForDate` 在创建事务内按当时 schedule 固定；非计划日的四种明确结果均可保存，只有真实行动进入事实计数，且不算计划达成。
- Progress 保留 S1 ActionRecord 明细、筛选、排序和计次语义，兼容增加 RoutineRecord 明细、达标汇总与两类 Record 的统一分钟/真实行动计数；不生成评分、streak、失败率或人格评价。
- 通用 pending Action 可由用户明确作为当日 `intention` 选入、移除或与 focus 显式转换；同 Action/LocalDate 的 focus 与 intention 互斥，冲突不得静默 upsert。
- intention 只表达“今天可能想做”。未发生时不改变 Action、不生成任何 Record/Progress/失败、不滚动到下一 LocalDate；实际发生仍使用既有显式 ActionRecord 流程。
- Main 捕获可信 LocalDate；Renderer 不提交可信日期/星期、不访问 SQL/Node。固定窄 IPC、运行时 DTO 与 sender/origin 校验、Query 零写入及隔离临时数据根继续适用。

## 4. T021 — Routine 生命周期、星期节奏与 Today 计划项

### 已批准并完成

- 覆盖 FR-R01～FR-R03、FR-T02、FR-D01 的 Routine/schedule 重开子集、D-003/D-009/D-016/D-106、ED-006/009 与 AC-03 步骤 1～2。
- 落地 S2-Q01-A、Q02-A、Q03-A、Q07-A、Q10-A；交付 Routine Domain/Application/SQLite/Main/Preload/Renderer 纵向路径、原子 schedule、Goal 状态接缝和真实关闭重开。
- 项目所有者于 2026-08-14 批准合同和补充文件范围、完成并通过人工验收；本地/hosted Windows gate、独立只读复核和文档收口均通过。

### 明确未交付

- RoutineRecord、五种记录投影、Routine Progress、Action intention、删除、补记/修正、提醒、复杂重复规则、Recovery、Review、AI 与 S3～S7；T021 不单独声明完整 AC-03。

## 5. T022 — RoutineRecord 五态与事实型 Progress

### 已批准并完成

- 覆盖 FR-R04～FR-R07/FR-R09、FR-P01/P02/P07/P08、FR-D01 的 RoutineRecord 重开子集、D-008～D-010/D-107、ED-017 与 AC-03。
- 落地 S2-Q03-A、Q04-A、Q05-A、Q08-A、Q09-A、Q12-A，并直接继承 ED-017；交付四种显式结果、缺行 unknown、唯一冲突、非计划日、历史计划快照、跨午夜显式选择、Today/Progress 与真实重开。
- 项目所有者于 2026-08-15 完成并通过完整人工 AC-03；本地/hosted Windows gate、独立只读复核和文档收口均通过。

### 明确未交付

- FR-R08 的历史 Record 编辑、覆盖、补记或删除（T031）；Action intention 与 AC-04（T023）；Review、Recovery、AI、提醒、复杂日历、完成率和 S3～S7。

## 6. T023 — 通用 Action 非强制 Today intention

### 已批准并完成

- 覆盖 FR-A07、FR-T03、FR-T08、D-011、ED-006、S2-Q06-A 与 AC-04；保持 S1 focus/ActionRecord/Progress 及 T021/T022 Routine 五态语义。
- 交付 intention 选择/移除、focus/intention 双向稳定冲突与显式转换、Today 清晰分区、Repository insert-only 创建、跨日不滚动、未发生零事实和普通 ActionRecord 复用。
- 项目所有者于 2026-08-16 完成并通过完整人工 AC-04；本地/hosted Windows gate、独立只读复核和文档收口均通过。

### 明确未交付

- 兴趣专属模块、自动推荐/AI、intention 自动滚动/记录/完成、提醒、评分、复杂日历、补记/编辑/删除、Recovery、Review 与 S3～S7；T023 不重新声明 AC-03。

## 7. T802 与 S2 聚合收口候选

- T021～T023 合并后的首次 S2 聚合检查固定 `dev@0106996b45a41275370c46bd3f6ea842573f0889`：完整 `verify` 和 package 构建通过，但 package smoke 的 `routines` 精确 API 白名单漏掉 T022 四个方法，故该轮不能宣称通过。
- 独立 review 同时发现既有 AC-03 E2E 未完整证明“非计划日四 outcome → schedule 纳回 → pause/end → 真实重开”的连续路径，且缺少既有 S1-only v1 数据库在当前程序重开后的逐表守恒证据。
- T802 只修改测试和任务/证据/归档文档：补齐 package API 白名单，强化连续 AC-03 的完整 Record 对象守恒，并新增 S1-only v1 数据库 snapshot/metadata 守恒测试；没有修改生产代码、依赖、配置、schema、migration、`001_initial.sql` 或产品语义。
- 实现 revision `a61d0bc100752ae1209623a2ac020ff25a62bf8f` 的本地 `npm.cmd run verify`、`npm.cmd run package`、unpacked/隔离 NSIS `npm.cmd run test:package-smoke`、独立 review及 hosted Windows required gate 均通过；详见 `EV-T802-001`。
- T802 同时承担将 T021～T023 三份完成合同归档为本文并删除原文件。最新文档 head 推送后必须重新等待 required CI；项目所有者决定 PR #20 是否合入 `dev`。
- PR #20 合入后仍需在新的最终 `dev` revision 从头执行 S2 聚合验证并记录最终证据；本归档候选不提前宣称该步骤、`dev → main`、merge、tag 或 release 已获完成。

## 8. 数据、兼容性与后续边界

- S2 复用 v1 既有 `routines`、`routine_schedule_days`、`routine_records`、`today_selections`；T021～T023/T802 未新增 migration、未修改 schemaVersion 或 `001_initial.sql`。
- `unknown` 仍是缺行；`plannedForDate` 仍是创建时历史快照；schedule/lifecycle/Query 不可回写历史事实。
- 既有 S1 Goal、Action、Today focus、ActionRecord、Progress 与 S1-only v1 数据必须在 S2 代码和重开后保持兼容。
- 后续 T031～T072 必须从其独立合同获得范围与权限；不得从本归档推断 Record 修改/删除、Recovery、Review、AI、提醒、复杂重复规则、兴趣模块或 S3～S7 的实现授权。
- Windows 产物仍未签名并使用默认 Electron 图标；这不是 T021～T023/T802 的产品语义缺口。package/NSIS 证据只绑定所记录的确切 revision。

## 9. 原合同恢复入口

删除前的完整 T021～T023 合同可从 T802 实现 revision 恢复：

```powershell
git show a61d0bc100752ae1209623a2ac020ff25a62bf8f:docs/implementation/T021_ROUTINE_LIFECYCLE_TASK.md
git show a61d0bc100752ae1209623a2ac020ff25a62bf8f:docs/implementation/T022_ROUTINE_RECORD_FACTS_TASK.md
git show a61d0bc100752ae1209623a2ac020ff25a62bf8f:docs/implementation/T023_ACTION_INTENTION_TASK.md
```

T802 合同按项目所有者要求在首次提交前删除且从未进入 Git 历史，因此没有合同恢复命令。以上历史合同中的执行前快照、逐文件许可、候选状态和已被后续事实取代的 Draft/Ready 描述仅用于审计，不再作为当前开发依据。

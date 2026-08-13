# MyTracer S1 / T011～T014 开发合同归档

> 状态：已归档；T011～T014 与 T801 `done`，S1 自动化与人工 AC-01 验收 `pass`；归档由 PR #13 合入 `dev`
>
> 归档日期：2026-08-13
>
> 用途：保留 S1 已完成开发合同中仍影响后续实现、验证和审计的最小有效信息

## 1. 权威边界

- 本文是 T011～T014 及其门禁修复 T801 的精简归档，不是新的实现合同，也不授权 S2～S7、`main`、tag 或 release。
- 当前任务状态以 [`TASK_INDEX_V0.1.md`](../TASK_INDEX_V0.1.md) 为准；实际验证以 [`ACCEPTANCE_EVIDENCE_V0.1.md`](../ACCEPTANCE_EVIDENCE_V0.1.md) 为准。
- 冻结需求、决定、架构和工程决定仍高于本文；本文不改变任何 FR、AC、D、ED 或 GW。
- 原合同完整内容保留在 Git 历史和 PR #7、#9～#12 中；本归档只保留最终范围、批准、验证、限制和恢复入口。

## 2. 最终交付索引

| Task | 最终范围 | 实现 revision | PR / merge revision | Evidence |
|---|---|---|---|---|
| T011 / E1-01 | Goal 生命周期、当前下一步、列表/详情与重开 | `c4e9f6dee3cbab97f6902f2c90f97f96423b43e2` | [PR #7](https://github.com/Fyrefly-4/MyTracer/pull/7) / `48a6f6439fbbb6ba2309e005ebb12e02b151a457` | `EV-T011-001` |
| T012 / E1-02 | Action 生命周期、Today focus 与重新安排 | `56b3446a1b952a9bdb6fe29ab4a89502171ba321` | [PR #9](https://github.com/Fyrefly-4/MyTracer/pull/9) / `b994962618954cf02f9e07590d68213d0378bccb` | `EV-T012-001` |
| T013 / E1-03 | 快速/深入 ActionRecord、跨午夜与 post-record | `b10d5d40c4c1dc1f7a20801d5d904b1d37953270` | [PR #10](https://github.com/Fyrefly-4/MyTracer/pull/10) / `b3c61b403888b81e4f155fabcbefea689acd1d3a` | `EV-T013-001` |
| T014 / E1-04 | 事实型 Progress、筛选、一致性读取与 AC-01 | `52cd33672b6b2632b09beb7cb8e66f48901f2bd0` | [PR #11](https://github.com/Fyrefly-4/MyTracer/pull/11) / `623007dd4269df02771f6a526db269de1fe95a03` | `EV-T014-001` |
| T801 / S1 fix | S1 package smoke API 契约与完整 NSIS 路径 | `dd9bd4498b0339703f8cf992a564a7d7b80442b5` | [PR #12](https://github.com/Fyrefly-4/MyTracer/pull/12) / `74ebe346a86cf431d87e02e8a1220b713b33901c` | `EV-T801-001` |
| G3/S1 | Goal → Action → Today → ActionRecord → Progress 聚合验收 | `74ebe346a86cf431d87e02e8a1220b713b33901c` | 待 `dev → main` 里程碑 PR | `EV-G3-S1-002` |

## 3. S1 最终行为合同

- Goal 支持创建、修改、pause、resume 和 end；ended 为终态。pause/end 保留当前下一步、TodaySelection、Action、Routine 及所有历史 Record。
- 当前下一步可空；非空时只引用同 Goal 的 pending Action，且只有 active Goal 可设置或替换。创建 Goal 可原子内联创建一个 pending Action 并设为当前下一步。
- Action 支持创建、修改、完成、取消和重新安排。rescheduled 复用原 Action ID，移除当日 TodaySelection；只有用户再次明确选入 Today 才恢复 pending。
- Today 只显示用户明确选入当前 LocalDate 的 Action；无硬上限，不自动搬运旧日或历史 Action。日期由 Main 捕获，跨午夜不静默移动历史。
- ActionRecord 支持快速和渐进深入记录；分钟为非负整数，0 分钟仍可构成真实行动。`partial` 保存真实 Record，但不自动完成 Action。
- Understanding 是用户确认的理解；Confusion 在 S1 只保存开放事实。记录后可显式保持 pending、完成或重新安排，不由 outcome 暗中改状态。
- Progress 只读汇总 ActionRecord 的分钟、真实行动次数、确认理解和开放困惑；筛选端点包含，结果稳定且重开一致。不得生成评分、掌握度、失败率、排名或自律判断。
- AI 为 `not-configured` 时完整核心闭环仍可使用；Renderer 不获得 Node、SQLite、文件系统、凭据、任意 IPC 或 Electron 对象。

## 4. T011 — Goal 生命周期与当前下一步

### 已批准并完成

- 覆盖 FR-G01～G06、D-002/D-101、ED-005/006 与 AC-01 步骤 1～2。
- 交付 Domain/Application/SQLite/Main/Preload/Renderer 纵向路径，以及真实关闭 Electron/SQLite 后重开验证。
- 项目所有者批准合同、实现、任务 Git 流程和人工体验；本地及 hosted Windows gate、review 和人工验收通过。

### 明确未交付

- 通用 Action 生命周期、Today、ActionRecord、Progress、硬删除、Recovery、Routine、AI 与 S2～S7。

## 5. T012 — Action 与 Today focus

### 已批准并完成

- 覆盖 FR-A01～A06、FR-T01/T04/T05/T08、D-004/D-005/D-016/D-106、ED-006/007 与 AC-01 步骤 3。
- 交付 Action 状态转换、同 Goal 当前下一步的原子 resolution、Today 显式选入/移除和 reschedule 同 ID 语义。
- 本地/hosted `verify`、真实重开和项目所有者人工复验通过。

### 明确未交付

- ActionRecord、Progress、Routine、补记/修改/删除、Recovery、AI 与 S2～S7；FR-A05 的真实 `partial` 证据由 T013 补齐。

## 6. T013 — 快速/深入 ActionRecord

### 已批准并完成

- 覆盖 FR-A05、FR-A08 的 S1 显式入口、FR-L01～L06/L08、FR-C01、D-006/D-103～D-106 与 AC-01 步骤 4～5。
- 交付 Main 内存 recording context、防伪输入、跨午夜显式确认、manual Understanding、open Confusion、可选下一步与原子 post-record。
- `partial`、0 分钟和多条记录均保留为真实事实；保存失败零变化；本地/hosted 验证、独立 review、重开和人工验收通过。

### 明确未交付

- FR-L07 修改/补记/删除、FR-L09 Progress 展示、FR-C04 撤销理解、Routine、Recovery、AI 与 S2～S7。

## 7. T014 — 事实型 Progress 与 AC-01

### 已批准并完成

- 覆盖 FR-L09、FR-C03 非 AI 部分、FR-P01～P04/P07/P08、FR-D01 的 S1 重开子集、D-007/D-104/D-106、ED-012/016 与完整 AC-01。
- 交付全局/Goal/LocalDate 包含端点筛选、SQLite 单查询一致快照、稳定排序、分钟/次数公式、确认理解/开放困惑和中性空状态。
- 自动化和项目所有者人工 AC-01 均连续完成 Goal → Action → Today → 25 分钟 partial ActionRecord → Progress → 完全关闭重开。

### 明确未交付

- FR-P02 的 RoutineRecord 分支（T022）、完整 FR-D01/AC-07、复杂图表、比较、评分、掌握度、Review、Recovery、导出和 AI。

## 8. T801 与 G3/S1 聚合收口

- 首轮验收 `EV-G3-S1-001` 固定 `dev@623007dd4269df02771f6a526db269de1fe95a03`，因 package smoke 仍断言 S0 的 `shell`-only API 而失败；该失败记录永久保留。
- T801 只修改 `tests/e2e/windows-package-smoke.e2e.test.ts`：精确断言 S1 顶层/子 API、对象冻结和 Renderer 隔离，并为真实 NSIS 路径设置 300 秒用例时限；没有生产代码、依赖、配置、schema 或产品语义变化。
- T801 的本地 `verify`、package、unpacked/隔离 NSIS smoke、独立 review、PR #12 head CI 和最终 `dev` push CI 均通过。
- 最终 `dev@74ebe346a86cf431d87e02e8a1220b713b33901c` 从头执行 `verify`、精确 AC-01、package 和 package smoke 通过；详见 `EV-G3-S1-002`。
- 最终 Windows 产物仍未签名并使用默认 Electron 图标；hosted workflow 运行 `verify`，package/NSIS smoke 仍为本地 Windows 证据。
- 自动化 S1 门禁通过不授权推进 `main`；确切 `dev → main` PR 仍需项目所有者批准 merge，且必须使用 merge commit。

## 9. 原合同恢复入口

删除前的完整合同可从 Git 历史恢复：

```powershell
git show 0492e9a^:docs/implementation/T011_GOAL_LIFECYCLE_TASK.md
git show 0492e9a^:docs/implementation/T012_ACTION_TODAY_TASK.md
git show 0492e9a^:docs/implementation/T013_ACTION_RECORD_TASK.md
git show 0492e9a^:docs/implementation/T014_PROGRESS_CORE_LOOP_TASK.md
git show 0492e9a:docs/implementation/T801_S1_PACKAGE_SMOKE_FIX_TASK.md
```

这些历史合同中的执行前快照、逐文件许可、候选选项和已被后续状态取代的 Draft/Ready 描述仅用于审计，不再作为当前开发依据。

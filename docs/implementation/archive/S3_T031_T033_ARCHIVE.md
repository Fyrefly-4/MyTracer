# MyTracer S3 / T031～T033 开发合同归档

> 状态：已归档；T031～T033 均为 `done` 并已合入 `dev`，项目所有者完整人工 AC-07 为 `pass`；T803 在固定 `dev@8058f7a3c9db9d3b488e727dfd85201dc14f11a0` 上执行最终聚合验收与归档
>
> 归档日期：2026-08-23
>
> 用途：保留 S3 已完成开发合同中仍影响后续实现、验证、数据兼容和审计的最小有效信息

## 1. 权威边界

- 本文是 T031～T033 的精简归档，并记录 T803 聚合验收；不是新的产品需求、架构决定或实现合同。
- 当前任务状态以 [`TASK_INDEX_V0.1.md`](../TASK_INDEX_V0.1.md) 为准；实际结果以 [`ACCEPTANCE_EVIDENCE_V0.1.md`](../ACCEPTANCE_EVIDENCE_V0.1.md) 为准。
- 冻结需求、决定、工程决定和 [`S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md`](../../architecture/S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md) 高于本文；本文不改变 FR、AC、D、ED 或 S3-Q。
- S3-Q01=A、S3-Q02=B、S3-Q03=A、S3-Q04=A 已由项目所有者批准；未选方案不能从本归档重新进入实现。
- 原 T031～T033 合同继续保留在当前树、Git 历史和 PR #26～#28 中；本文提供统一的最终范围、数据契约、批准、交付、验证、限制和恢复入口，不取代其审计全文。
- T031 的两个 Escalation Proposal 保留为真实执行历史；归档不删除、不覆盖，也不把它们变成需求来源。
- 本归档不授权 S4～S7、自动导入/恢复、AI Provider、`main` merge、tag 或 release。

## 2. 最终交付索引

| Task | 最终范围 | Implementation Candidate / final task head | PR / dev integration revision | Evidence |
|---|---|---|---|---|
| T031 / E3-01 | Record 修改/补记、子事实转换、五类删除预览与事务性删除、schema v2 provenance | `1c08b3161021319d1c87ef4bf8cb2470d977bd48` / `940cd2e821a80444003f82031b139c284a02c4be` | [PR #26](https://github.com/Fyrefly-4/MyTracer/pull/26) / `f41c601a697f5fbdb6bc3f90656071f7263d7cfe` | `EV-T031-001` |
| T032 / E3-02 | UTF-8 JSON 完整导出、十集合快照、引用/枚举/结构校验与原子文件交付 | `79458b88b505346ef81c3cc920224c7cf0eb4ba4` / `aa835b5ecca2c98c320c01a9941bd3e48e2ad11e` | [PR #27](https://github.com/Fyrefly-4/MyTracer/pull/27) / `43e6406684dbb1b1ef30d006063242e9a552da80` | `EV-T032-001` |
| T033 / E3-03 | AI disabled/not-configured/failure 三态数据能力、失败零写入与 AC-07 回归 | `502ed1a282bc127684229f4405072acb7ef6fb11` / `7706ffa424c787e13e08189a04c401ec043a165e` | [PR #28](https://github.com/Fyrefly-4/MyTracer/pull/28) / `8058f7a3c9db9d3b488e727dfd85201dc14f11a0` | `EV-T033-001` |
| T803 / S3 aggregate | 同 revision 自动化、package、AC-07 绑定、证据/README/metadata 与本归档 | 文档验收分支；产品 source 固定为 `8058f7a3c9db9d3b488e727dfd85201dc14f11a0` | [Draft PR #29](https://github.com/Fyrefly-4/MyTracer/pull/29) / owner merge pending | `EV-G3-S3-001` |

T031～T033 的 final task tree 分别与其 squash merge tree 一致；T033 Implementation Candidate 到 final task head 只变化任务/证据文档。因此项目所有者 2026-08-22 报告的完整人工 AC-07 可以绑定上述最终产品行为；本归档不代签或重做人工观察。

## 3. S3 最终行为合同

### 3.1 修改、补记与事实重算

- ActionRecord 与 RoutineRecord 修改严格 update-only；补记严格 create-only。目标不存在、唯一冲突、非法枚举/时长/LocalDate 或存储失败都保持零变化。
- 历史修改默认保留原 `occurredOn`；改日和补记必须显式提交合法 LocalDate。Renderer 不能把系统当前时间、Today 日期或 recording context 日期伪装成历史发生日。
- ActionRecord 可修改 `occurredOn`、正整数 `durationMinutes`、可空 note；RoutineRecord 可修改 `occurredOn`、正整数 `durationMinutes`、四种显式 outcome 与可空 note。
- Understanding 可修改/撤销；Confusion 可修改、解决和重开。非法重复状态转换不得变成 upsert。
- 父 Action/Routine 只要仍存在，即使已 pause/end/complete/cancel，也允许历史补记或修正；命令只改变 Record 或子事实。
- 修改、补记或删除后，Progress、Today、day-state、详情和所有相关投影必须从剩余已提交事实重新查询；不得通过 Record 伪造父状态、Goal current-next、Today focus/intention 或 lifecycle。

### 3.2 Routine 历史计划 provenance

- schema v2 新增非空 `routine_records.planned_for_date_basis`，只允许 `schedule_at_recording` 或 `user_confirmed_history`。
- v1 既有行和按当前可信日期记录的新行使用 `schedule_at_recording`；补记或显式改日由用户确认历史计划标志并使用 `user_confirmed_history`。
- 未改发生日的普通修改保留既有 `plannedForDate` 与 basis；不得用当前 schedule 重算或冒充历史计划事实。

### 3.3 删除预览、确认与单事务执行

- 根删除仅有 `action-record`、`routine-record`、`action`、`routine`、`goal` 五类；Record 可以单独删除。
- Action 删除级联 ActionRecord、Understanding、Confusion、TodaySelection；Routine 删除级联 RoutineRecord 和 schedule。
- Goal 删除级联所属 Action/ActionRecord，并对 Routine、ReviewResult 执行解除关联；Goal current-next 随根删除清空。
- pause/end/complete/cancel/reschedule 是保留历史的 lifecycle，不是 delete；S3 不引入回收站、通用软删除或撤销。
- 预览返回确定排序的根、受影响 ID、关系和计数；Main 持有 sender-bound、一次性 opaque token、上下文与事实指纹，Renderer 不接触 SQL/指纹。
- 用户二次确认时，根、sender、token、所有受影响 ID/关系和事实指纹必须与预览精确相同。任何变化都返回 stale、零写入并要求重新预览。
- 最终根删除、外键 cascade/SET NULL/current-next 清空、实际差异核对在同一 SQLite transaction 内完成。取消、校验失败、stale、token 重放、差异不一致或存储失败都必须回滚为零变化。

### 3.4 完整导出

- 导出 envelope 为 UTF-8 无 BOM JSON，`exportVersion=1` 与 `sourceDataVersion=2` 分离，并包含单一 Clock snapshot 产生的导出时间。
- 一致性只读快照包含全部未删除核心状态与关系：metadata/version、goals、actions、routines、routineScheduleDays、todaySelections、actionRecords、routineRecords、understandings、confusions、reviewResults，以及解释数据所需的显式 enumValues。
- 集合和引用使用确定顺序；校验器拒绝缺失/多余字段、非法日期/枚举/数值、悬空引用、错误删除/解除关联结果和技术字段。
- 凭据、safeStorage、AI 草稿、Provider 请求/响应、错误、日志、缓存、临时路径、测试路径和文件目标路径不得进入导出。
- Renderer 只调用零参数窄 API；系统保存对话框、目标路径和文件系统仅在 Main。取消保持零文件变化。
- Main 在目标同目录写专属临时 sibling，完成 flush/close、结构/引用复读校验与目标新鲜度检查后再原子交付；任一 open/write/sync/close/read/validate/rename 失败都不能留下被误认为有效的截断文件，并保留既有目标。
- “可以导出”不等于“支持自动导入、恢复或兼容任意未来版本”。

### 3.5 AI 不可用时的数据独立性

- `disabled` 不调用 provider；`not-configured` 通过空配置报告不可用；`failure` 使用离线 fake 覆盖 authentication、parse 和可控 timeout。
- 三态均可重复 Goal/Action/Routine CRUD、Today focus/intention、Action/Routine Record 补记/修改、Understanding/Confusion、Progress、删除 cancel/stale/confirm、完整导出和 SQLite 重开。
- Provider failure 前后十集合完整快照与 sourceDataVersion 相等；AI 状态、请求标记和错误不得进入核心 SQLite 或导出。
- 数据 Application services、Repository、transaction、ExportPort 与 IPC 不依赖 AI Provider。AI 失败后新的 SQLite 写事务、Progress、删除、导出与重开继续可用。
- T033 只建立回归证明，不实现生产 Provider、配置 UI、Start Help、建议确认写入、长期记忆或 AC-02。

## 4. 数据版本、迁移与兼容性

- `001_initial.sql` 保持不变；T031 以顺序 `002_add_routine_record_planned_for_date_basis.sql` 将 schemaVersion 从 1 提升为 2。
- fresh v2、完整 S2 v1、S1-only v1、四种 Routine outcome、planned true/false、全部集合/关系与 metadata 必须迁移守恒；未知更高版本拒绝打开。
- migration 在一个事务内完成；ALTER 后 metadata 写入失败时 schema 和数据回滚到可重试 v1，不产生半迁移状态。
- 外键动作继续由 v2 schema 明确执行：cascade 删除事实，SET NULL 仅解除被批准保留对象的关联；关闭重开后计数、状态、关系、provenance、Progress 和导出必须稳定。
- LocalDate 仍是显式本地日字符串；跨午夜不会静默移动历史。补记日期权不扩展 Today、recording context 或 Main Clock 的信任边界。
- S1/AC-01 与 S2/AC-03/AC-04 的 Goal、Action、Routine、Today、Record、unknown/四显式 outcome、Progress 和重开语义继续回归通过。

## 5. 验证与证据边界

- T031 证明 unit/Application、SQLite/Repository、migration、IPC、E2E 和 candidate hosted CI；保留两次本地失败 artifact 与一次 hosted 旧断言失败。
- T032 证明十集合快照、envelope/纯校验器、ExportPort 故障注入、IPC/UI、package 与人工保存/取消/JSON/限制提示；candidate 与 final-head hosted CI 通过。
- T033 证明 AI 三态 harness、SQLite 结果全等、E2E-AC-07、AC-01/03/04、package 与人工完整 AC-07；环境前置失败 artifact 保留并由成功 candidate supersede。
- T803 在相同产品 source 上从头运行 metadata、定向 unit/integration/E2E、完整 `verify`、Windows package 和 unpacked/隔离 NSIS smoke；长期事实记录于 `EV-G3-S3-001`。
- Windows 产物未签名并使用默认 Electron 图标。package 与 CI 只证明所记录的精确 revision，不授权 merge、tag 或 release。

## 6. 明确未交付

- 自动导入、一键恢复、回收站、撤销删除、自动备份；
- 云同步、账号、远程存储、通用审计日志或事件溯源；
- AI Provider、配置 UI、长期 AI 记忆或未经确认的数据写入；
- S4～S7、AC-02/05/06、提醒、复杂日历及其他延期能力；
- 代码签名、正式图标、`main` merge、tag 或 GitHub Release。

## 7. 原合同位置与恢复入口

完整 T031～T033 合同当前仍位于 `docs/implementation/`。若未来取得单独删除授权，仍可从最终 S3 产品 source 恢复：

```powershell
git show 8058f7a3c9db9d3b488e727dfd85201dc14f11a0:docs/implementation/T031_RECORD_DATA_CONTROL.md
git show 8058f7a3c9db9d3b488e727dfd85201dc14f11a0:docs/implementation/T032_VERSIONED_COMPLETE_EXPORT.md
git show 8058f7a3c9db9d3b488e727dfd85201dc14f11a0:docs/implementation/T033_AI_DATA_CAPABILITY_REGRESSION.md
```

历史合同中的执行前快照、候选状态、逐文件许可和已被后续事实取代的 Draft/Ready/merge 描述仅用于审计，不再作为当前开发授权。T031 escalation proposals 继续留在 `docs/implementation/`，无需从 Git 历史恢复。

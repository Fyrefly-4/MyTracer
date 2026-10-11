# MyTracer S4/S5 / T041～T052 开发合同归档

> 2026-10-11 事实校准：后续 PR #43 final-head CI/dev 集成及 beta.2 的 owner-accepted 发布已核验，旧候选等待不是当前状态；固定产品 source、失败和恢复入口不变，见 [EV-DOC-CALIBRATION-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)。

> 状态：已归档；固定产品 source 和原人工证据保留；T806 后续 final-head CI 与 dev 集成已补记于下文。
>
> 归档日期：2026-08-31

## 1. 权威边界

- 本文是 T041、T042、T051、T052 的精简归档，不是新需求、架构决定或实现授权。
- 冻结需求、`DECISIONS.md`、工程决定和已批准的 `S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md` 高于本文；任务状态与证据分别以 Task Index 和 Evidence 账本为准。
- 项目所有者已授权删除四份原合同；完整文本仍可从固定产品 source 和 PR #39～#42 恢复。`T052_ESCALATION_AC07_EXPORT_VERSION.md` 与失败证据继续保留。
- 本归档不授权 AI、S6、S7、自动导入/恢复、Ready、merge、`dev → main` PR、tag 或 Release。

## 2. 最终交付索引

| Task | 最终范围 | Task delivery / final task head | PR / dev integration | Evidence |
|---|---|---|---|---|
| T041 / E4-01 | 单 Goal、只读且可解释的 RecoveryContext 与 Goals 入口 | `1e9ab2b80b5b81a8bedd192750281d4042f279d5` / `64ac9dddd41413c22b0ec35f99ed9022d1555e25` | [PR #39](https://github.com/Fyrefly-4/MyTracer/pull/39) / `695e7bcc25b33279d39e61e28a8730b9cdf16264` | `EV-T041-001` |
| T042 / E4-02 | 用户确认的暂停、结束、重新开始、current-next 与 Today 选择；完整 AC-05 | `b323a9f629699cbec156723700c021151eaf1506` / `cc4c21c0559fcfc36d2b48b1649ce909225a632d` | [PR #40](https://github.com/Fyrefly-4/MyTracer/pull/40) / `3f343b8af0216b5e568f2c8f1ed52ac4ef824da3` | `EV-T042-001` |
| T051 / E5-01 | 主动进入、固定 LocalDate 周期的只读事实 Summary；AC-06 步骤 1 | `eccd00148ac6ca47f3215e03abffb98a732c2558` / `87b8654c5f33b1bb62452143ba7712c7a41324ac` | [PR #41](https://github.com/Fyrefly-4/MyTracer/pull/41) / `3e5a14f1b5f90894e1e15a4b208aa5db254e7825` | `EV-T051-001` |
| T052 / E5-02 | 三项用户输入、原子可选下一步、ReviewResult、schema v3、export v2/v1；完整 AC-06 | `7aced4fa3146ebb5d0bcf28b7dbc81e5b40e2cb2` / `202983cef9c942e61b7a9d5e44db82ac59ec528d` | [PR #42](https://github.com/Fyrefly-4/MyTracer/pull/42) / `84b596e12e54db098857004497a4d1964dcdc23c` | `EV-T052-001` |

四个 final task head 与对应 squash integration revision 内容树一致。S4/S5 固定产品 source 为 `84b596e12e54db098857004497a4d1964dcdc23c`；后续 T806 测试/文档 revision 不替代该产品 revision。

## 3. Recovery 最小长期行为合同

- RecoveryContext 是用户显式进入后针对一个 Goal 读取的一致事实快照。长期未推进只显示可解释事实，不等于失败，不采用静默天数阈值，也不自动改变 Goal、Action 或 Routine 状态。
- Recovery 建议和 Renderer 草稿不写业务数据。暂停、结束、重新开始、创建/选择 current-next、Action transition 和 Today 选择均需用户确认，确认后只调用普通 Application Command。
- 查询、取消和失败零写入。Goal/Routine 生命周期相互独立；current-next 与 Today 选择也是两个独立决定。
- Recovery 不创建、补齐、移动、删除或重新归属历史 Record；Understanding、Confusion 与显式 `occurredOn` LocalDate 保持守恒。关闭重开、跨午夜和历史数据得到同一语义。

## 4. Review 最小长期行为合同

- Review 由用户主动进入；Main Clock 捕获当前周一至周日的含端点 LocalDate，context 在该次流程中固定，新进入才捕获新周期。
- Summary 只从当前 Record 事实重算。`unknown`、`not_done`、`intentional_rest`、`acted`、`target_met` 始终分离；缺行仍为 unknown，不推断失败。
- 不产生评分、掌握度、完成率、压力式 streak、人格评价、AI 总结或自动计划。
- ReviewResult 只保存用户明确提交的 `confirmedProgress`、`mainObstacle`、`nextAdjustment`。同周期编辑保持稳定 ID/`createdAt`；事实 Summary 不持久化，Record 后续变化时重算，而用户文本不被改写。
- 可选 Goal 下一步与 ReviewResult 在同一事务全有或全无；取消和失败零写入，不自动加入 Today。Goal hard delete 仅解除 ReviewResult 关联。

## 5. 数据、迁移与导出兼容

- schema v3 的 `review_results` 以周期开始 LocalDate 唯一标识一个结果，并保存三项用户输入及可空 Goal 关联；v2→v3 和 v1→v3 迁移在单事务中无损或整体回滚。
- v1 旧 Review 字段按已批准映射迁移；重复周期、空白/损坏文本、未知高版本或注入失败均 fail closed，不静默修复真实用户数据。
- 完整导出 v2 包含 ReviewResult；严格 v1 validator 继续兼容原 v1 envelope。交叉版本 shape、未知字段/版本、悬空引用和敏感字段被拒绝。
- migration、重开、Goal detach 和导出不改变 Routine 五语义、历史 Record、Understanding、Confusion 或 LocalDate。

## 6. 验证、人工证据与限制

- 各任务本地、hosted candidate/final-head/post-merge 记录保留在 `EV-T041-001`～`EV-T052-001`；T806 聚合结果记录于 `EV-S4-S5-001`。
- 项目所有者于 2026-08-29 报告完整 AC-05 通过，于 2026-08-30 报告完整 AC-06 通过。T806 仅在确认后续没有影响相应 UI/IPC/数据语义的产品变化后绑定这些结果，Agent 不代签。
- Windows package 未签名并仍使用默认 Electron 图标。没有对真实 `userData` 执行 migration；自动化仅使用隔离临时根。
- AC-02、首个 AI Provider、S6、S7、G4、自动导入/恢复、多周期趋势和发布不在 T041～T052 范围。

## 7. 原合同恢复入口

```powershell
git show 84b596e12e54db098857004497a4d1964dcdc23c:docs/implementation/T041_RECOVERY_CONTEXT.md
git show 84b596e12e54db098857004497a4d1964dcdc23c:docs/implementation/T042_RECOVERY_RESTART.md
git show 84b596e12e54db098857004497a4d1964dcdc23c:docs/implementation/T051_REVIEW_SUMMARY.md
git show 84b596e12e54db098857004497a4d1964dcdc23c:docs/implementation/T052_REVIEW_RESULT.md
```

历史合同中的候选、Draft、Ready、merge 与逐文件执行许可仅供审计，不再作为当前开发授权。

## 后续集成事实补记

2026-09-28 补核：PR #43 final head `605cb5433ca93d8f8353b93ca12e8596e16112f5` 的 [run 33323763973](https://github.com/Fyrefly-4/MyTracer/actions/runs/33323763973) 成功，supersedes candidate run `33314322219` 的失败；PR 于 2026-08-30 合入 `dev_integration_revision=1d02fd7a0a7b0bf29a5e39720d5818c9d68fdbc2`。原固定产品 source 与失败记录保留，不由集成事实推断新的人工或阶段接受。

## T806

聚合 T041～T052、AC-05/06、受影响回归、package、schema v3/export v2、证据与合同归档。固定产品 source、candidate migration timeout/test-only 修复、人工结果和最终 CI 均由[EV-S4-S5-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-s4-s5-001)保留；后续 beta.2 的 owner-accepted 发布见[事实校准](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)。原聚合合同从[恢复索引](INDEX.md#完整文本恢复)恢复，不复制执行权限。

# S7：提示、事实比较与 Demo 收敛归档

> 归档日期：2026-10-11。本文提炼已完成范围，不是新授权或第二份状态账本。当前状态看[任务索引](../TASK_INDEX_V0.1.md)，验证与限制看[验收证据](../ACCEPTANCE_EVIDENCE_V0.1.md)。完整合同恢复见[归档索引](INDEX.md#完整文本恢复)。

## T071

处理 11 条既定 SHOULD：FR-G07、A08、R08、T06、T07、L06、C04、P05、P06、REC05、RV05。已有六条复用并回归；新增的软提示、最近真实行动与周比较保持以下口径：

- 活跃目标与今日重点提供不阻塞操作的软提示，不设数量硬上限、阈值弹窗或额外确认；例行与意向不混入重点数量。
- Goal 列表与 Today 关联 Goal 的候选显示距上次真实行动的事实。没有记录不从创建日期推算；无 Goal 的 Action 不伪造 Goal 间隔。查看不写 TodaySelection，只有用户显式选择才加入今天。
- ActionRecord 的 completed/partial/stopped（含零分钟）均为真实行动；Routine 仅 acted/target_met 参与最近行动日期，含非计划日。比较 occurredOn，不用创建或修改时间代替。未来发生日显示实际日期，不输出负数间隔或改写历史。
- Progress 比较周一至今天的本周与完整上周，显示实际区间、分钟、行动次数及绝对差。标注本周尚未结束或截至当前记录，不产生百分比、评价、排名或预测；零表示记录统计为零，不推断用户未行动。
- 周比较沿用已应用 Goal 筛选，与历史日期范围独立；未提交的筛选草稿不改变结果。查询是 Application/Domain 的一致事实投影，失败可重试，不把旧 Goal 数据标为新 Goal。

完整 FR 落点仍由[需求追踪矩阵](../../architecture/REQUIREMENTS_TRACEABILITY_V0.1.md#31-t071-实现与验证定位)维护，不在归档重建测试清单。

## T072

聚合全部 69 MUST、11 SHOULD、7 延期排除与 AC-01～AC-07，固定候选 source/build 验证，不混用不同 revision 的包。收敛限既有错误反馈、渐进披露、最小窗口、键盘和焦点路径；不重设计产品或改变需求优先级。

本地 exact-source、hosted full/milestone、Windows package/隔离安装 smoke 与 owner 人工 AC/UX 的真实结果见 [EV-T072-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t072-001)。修正了删除对话框焦点、记录后返焦与错误反馈；fake AC-02 不证明 live Provider 当前可用，7～14 天自用观察也不由本任务虚构为完成。

## 交付与后续集成

| 任务 | 最后 PR/docs head | 实际 dev integration | 证据 |
| --- | --- | --- | --- |
| T071 / PR #55 | 6b6fb5f72af054a96d57d7c6f53da132a2cdc668 | 248350409927923016de18f7c5d967aa064964ca | [EV-T071-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t071-001) |
| T072 / PR #56 | ba4c7ed8f0d41da04c3ba8d6becde1ab696c9baf | d8b211b3c184cff8d0afdb09ff4b13164704290b | [EV-T072-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t072-001) |

这些身份不替换旧 implementation candidate 或已命名 task delivery。最终 CI 与 PR #62 后续 main 晋升见 [EV-DOC-CALIBRATION-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)；未补造独立 G4 命名签署、rc.1/v0.1.0 发布或自用观察结果。

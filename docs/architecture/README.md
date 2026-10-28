# MyTracer 架构阅读入口

按当前问题选择相关技术资料，不要求按开发阶段顺序遍历。产品语义以 PRD、产品决定和变更规则为准；实现细节结合当前代码与测试核对。查阅技术设计不会启用合同、阶段验收或历史授权。

| 问题 | 优先资料 |
| --- | --- |
| Electron 分层、模块职责和安全边界 | [总体架构](ARCHITECTURE_V0.1.md)、[工程决定](ENGINEERING_DECISIONS_V0.1.md) |
| 对象、状态、关系与业务不变量 | [领域模型](DOMAIN_MODEL_V0.1.md) |
| SQLite、事务、外键、迁移与导出 | [数据设计](DATA_DESIGN_V0.1.md) |
| AI 最小上下文、确认与降级 | [AI 边界](AI_BOUNDARY_V0.1.md) |
| 风险对应的测试层级 | [测试策略](TEST_STRATEGY_V0.1.md) |
| 定位某条需求的实现与测试 | [需求追踪矩阵](REQUIREMENTS_TRACEABILITY_V0.1.md) |

需要更细的契约或设计取舍时，再查相关专题：

- [Goal、Action、Today 与 Record](S1_CORE_LOOP_DESIGN_V0.1.md)
- [Routine、计划事实与非强制意向](S2_ROUTINE_INTENTION_DESIGN_V0.1.md)
- [历史修改、删除与完整导出](S3_DATA_CONTROL_EXPORT_DESIGN_V0.1.md)
- [Recovery 与 Review](S4_S5_RECOVERY_REVIEW_DESIGN_V0.1.md)
- [AI 请求、会话与确认命令](S6_AI_START_HELP_DESIGN_V0.1.md)
- [应用更新、退出协调与数据保护](S8_UPDATE_MAINTENANCE_DESIGN.md)

这些设计中的 Txxx、schema 版本和先前 revision 是来源上下文，不能当作当前任务或当前运行状态。仍有效的产品、安全和技术契约继续适用；已移出的执行依赖和阶段门只在[历史追溯](../implementation/archive/stage-execution/INDEX.md)或 owner 明确启用的阶段流程中查阅。

- [无固定安排例行](UNSCHEDULED_ROUTINES.md)：#132 C 的模式、SQLite v5、JSON v4 与 Today UI 边界。

- [关联的新目标阶段](LINKED_GOAL_STAGES.md)：#127 C 的独立目标、断链删除、SQLite v6 与 JSON v5。

- [记录简述与补充笔记](RECORD_SUMMARY_NOTES.md)：#150 的独立文字字段、安全 Markdown、schema 7 / JSON 6 与回退边界。

- [未完成记录续写](RECORD_CONTINUITY.md)：#157 的三类新增记录输入、本机加密、schema 8 与提交核对。

- [独立想法](STANDALONE_THOUGHTS.md)：独立正文与日期、schema 9 / JSON v7、按日回看及统计边界。

- [编选留念小册子](PERSONAL_BOOKLETS.md)：持续加入原文引用、删除占位、schema10 / JSON v8 与独立 HTML 定格。

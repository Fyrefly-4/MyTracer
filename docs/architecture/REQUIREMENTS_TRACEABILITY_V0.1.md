# MyTracer v0.1 需求追踪矩阵

> 文档状态：v0.1 最终架构基线（工程决策已批准）  
> 基线：`PRODUCT_REQUIREMENTS_V0.1.md`、`DECISIONS.md` 2026-08-07 冻结版本  
> 覆盖目标：87 条 FR、7 条 AC、28 条 D 均有设计、切片和测试/排除结论

## 1. 追踪规则

- **模块**指架构责任，不代表最终目录或框架组件。
- **设计**引用本目录最终架构章节和已批准 ED；具体依赖版本仍不改变语义落点。
- **切片**引用 `IMPLEMENTATION_PLAN_V0.1.md`；实时任务状态以 `TASK_INDEX_V0.1.md` 为准，切片映射不替代独立合同或实现授权。
- **测试**引用 `TEST_STRATEGY_V0.1.md` 的测试族：`U` 领域/应用单元、`C` 适配器契约、`I` 集成、`E2E` 端到端、`M` 人工体验、`SCOPE` 延期范围扫描。
- MUST 至少有一个自动化层级；纯主观体验另加人工验收。
- 延期项没有模块接口或切片，只保留 `SCOPE` 排除检查。

## 2. 功能需求 FR

### 2.1 Goal

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-G01 | MUST | Domain §3；Architecture §4.2 | E1-01 | U、I、E2E-AC-01 |
| FR-G02 | MUST | Domain §3.1/3.3 | E1-01 | U、I、E2E-AC-07 |
| FR-G03 | MUST | Domain §3.2 | E1-01 | U、I、E2E-AC-05 |
| FR-G04 | MUST | Domain §3.3；Data §6 | E1-01 | U 历史守恒、I 重开 |
| FR-G05 | MUST | Domain §3；ED-005 已批准 | E1-01 | U、I、E2E-AC-01 |
| FR-G06 | MUST | Architecture §6；Domain §3.3 | E1-01 | U 查询、I、E2E-AC-01 |
| FR-G07 | SHOULD | Architecture §6；Implementation §10.1 | S7 | U 无硬上限、M |

### 2.2 Action

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-A01 | MUST | Domain §4；Data §6 | E1-02 | U、I、E2E-AC-01/07 |
| FR-A02 | MUST | Domain §2/4；ED-006 已批准 | E1-02 | U 关联、C 引用完整性 |
| FR-A03 | MUST | Domain §7.3 | E1-02 | U、I、E2E-AC-01 |
| FR-A04 | MUST | Domain §4.2 | E1-02 | U 状态机、E2E-AC-01 |
| FR-A05 | MUST | Domain §4.3/6.1 | E1-03 | U partial、E2E-AC-01 |
| FR-A06 | MUST | Domain §4.2；ED-007 已批准 | E1-02 | U 历史不移动、I |
| FR-A07 | MUST | Domain §4.1/7.3 | E2-03 | U、E2E-AC-04 |
| FR-A08 | SHOULD | Domain §4.3；Implementation §10.1 | E1-03 | U 显式更新、M |

### 2.3 Routine

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-R01 | MUST | Domain §5；Data §6 | E2-01 | U 状态机、I 重开 |
| FR-R02 | MUST | Domain §5.3；ED-009 已批准 | E2-01 | U 计划日矩阵、I |
| FR-R03 | MUST | Domain §5.1 | E2-01 | U 非空约束、E2E-AC-03 |
| FR-R04 | MUST | Domain §6.2 | E2-02 | U 四结果、E2E-AC-03 |
| FR-R05 | MUST | Domain §6.3；Data §5 | E2-02 | U 无记录=未知、I |
| FR-R06 | MUST | Domain §6.4/8 | E2-02 | U 统计矩阵、E2E-AC-03 |
| FR-R07 | MUST | Domain §6.4 | E2-02 | U、M 中性文案 |
| FR-R08 | SHOULD | Data §4/6；Implementation §10.1 | E3-01 | U、I 补记修正 |
| FR-R09 | MUST | Domain §5.4；Data §5 | E2-02 | U 非计划日、I、E2E-AC-03 |

### 2.4 Today

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-T01 | MUST | Architecture §6；Domain §7.3 | E1-02 | U 查询、E2E-AC-01 |
| FR-T02 | MUST | Architecture §6；Domain §5.3 | E2-01 | U、E2E-AC-03 |
| FR-T03 | MUST | Domain §7.3 | E2-03 | U、E2E-AC-04 |
| FR-T04 | MUST | Architecture §4.1；Domain §7.3 | E1-02 | U selectedBy=user、E2E |
| FR-T05 | MUST | Domain §8 TodayPlanner | E1-02 | U 不自动搬运、E2E-AC-05 |
| FR-T06 | SHOULD | Implementation §10.1 | S7 | U 无硬限制、M |
| FR-T07 | SHOULD | ED-013；Implementation §10.1 | S7 | U 事实候选、M 非压力 |
| FR-T08 | MUST | Architecture §6；Domain §4.1 | E1-02/E2-03 | 结构检查、E2E-AC-04 |

### 2.5 Action Record

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-L01 | MUST | Domain §6.1 | E1-03 | U 必填层、E2E-AC-01 |
| FR-L02 | MUST | Domain §6.1；Architecture §4.1 | E1-03 | U 深入字段全缺省、E2E |
| FR-L03 | MUST | Domain §6.1/7.1 | E1-03 | U、E2E-AC-01 |
| FR-L04 | MUST | Domain §6.1/7.2 | E1-03 | U、E2E-AC-01 |
| FR-L05 | MUST | Domain §6.1；ED-005 | E1-03 | U 候选与应用分离 |
| FR-L06 | SHOULD | Domain §6.1；Implementation §10.1 | E1-03 | U 可选 note |
| FR-L07 | MUST | Data §4/6/7 | E3-01 | U、I、E2E-AC-07 |
| FR-L08 | MUST | Domain §4.3/6.4 | E1-03 | U partial 有效、E2E |
| FR-L09 | MUST | Domain §6.4/8 | E1-04 | U 禁止推导、M 文案 |

### 2.6 Understanding

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-C01 | MUST | Domain §7.1 | E1-03 | U 自然语言、E2E-AC-01 |
| FR-C02 | MUST | AI §5/6.2 | E6-03 | U、I、E2E-AC-02 |
| FR-C03 | MUST | Domain §6.4；AI §1/6.2 | E1-04/E6-03 | U 禁止推导/自动确认 |
| FR-C04 | SHOULD | Domain §7.1；Data §6 | E3-01 | U 修改撤销、I |
| FR-C05 | 延期 | Architecture §9 延期边界 | — | SCOPE：无图谱/层级/掌握度 |

### 2.7 Progress

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-P01 | MUST | Domain §8 ProgressCalculator | E1-04 | U Goal/周期聚合、E2E |
| FR-P02 | MUST | Domain §8 计次定义 | E1-04/E2-02 | U 统计矩阵、E2E |
| FR-P03 | MUST | Domain §7.1/8 | E1-04 | U 仅确认理解、E2E |
| FR-P04 | MUST | Domain §7.2/8 | E1-04/E4-01 | U open 查询、E2E-AC-05/06 |
| FR-P05 | SHOULD | ED-013；Implementation §10.1 | S7 | U 距上次行动事实、M |
| FR-P06 | SHOULD | Domain §8；Implementation §10.1 | S7 | U 周期差值、M 无评分 |
| FR-P07 | MUST | Architecture §9；Domain §8 | E1-04 | 查询快照/结构检查、M |
| FR-P08 | MUST | Architecture §9；Domain §8 | E1-04/S7 | U 无评价字段、M 文案 |

### 2.8 AI Start Help

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-AI01 | MUST | AI §3 | E6-01 | U 未触发调用=0、E2E |
| FR-AI02 | MUST | AI §1/5 | E6-02 | fake 输出契约、M |
| FR-AI03 | MUST | AI §1/4 | E6-01 | U 上下文/结构、E2E |
| FR-AI04 | MUST | AI §5；ED-011 | E6-02 | U 建议数量与可执行字段 |
| FR-AI05 | MUST | AI §6 | E6-03 | U 三分支、E2E-AC-02 |
| FR-AI06 | MUST | AI §2/6 | E6-03 | U/I 确认前零写入 |
| FR-AI07 | MUST | AI §1/10 | E6-02 | fake 休息建议、M |
| FR-AI08 | MUST | AI §1/10 | E6-01/03 | fake 虚构事实不落库 |
| FR-AI09 | MUST | Architecture §8；AI §7 | E3-03/E6-02 | I 故障矩阵、E2E-AC-07 |
| FR-AI10 | MUST | AI §4 | E6-01 | U 唯一标记、I manifest |
| FR-AI11 | 延期 | AI §1 非目标 | — | SCOPE：无整日/整周计划 |
| FR-AI12 | 延期 | AI §1 非目标 | — | SCOPE：无主动弹出/监督 |
| FR-AI13 | 延期 | AI §2/3/8 | — | SCOPE：无跨会话记忆/画像 |

### 2.9 Recovery

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-REC01 | MUST | Domain §3.3/8 | E4-01 | U 历史守恒、I 重开 |
| FR-REC02 | MUST | Architecture §6；Domain §8 | E4-01 | U 查询、E2E-AC-05 |
| FR-REC03 | MUST | Domain §6.3；Data §5 | E4-01 | U 无空白补行、E2E |
| FR-REC04 | MUST | Domain §3～5/9 | E4-02 | U、I、E2E-AC-05 |
| FR-REC05 | SHOULD | Architecture §6；Implementation §10.1 | E4-02 | U 候选、M |
| FR-REC06 | MUST | Architecture §6/9 | E4-02/S7 | 查询无失败率、M |

### 2.10 Review

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-RV01 | MUST | Domain §7.4/8 | E5-01 | U 摘要、E2E-AC-06 |
| FR-RV02 | MUST | Domain §7.4 | E5-02 | U、I 重开、E2E |
| FR-RV03 | MUST | Domain §7.4 | E5-02 | U 自然语言、E2E |
| FR-RV04 | MUST | Domain §7.4 | E5-02 | U 单一调整、E2E |
| FR-RV05 | SHOULD | Domain §7.4；Implementation §10.1 | E5-02 | U 显式更新 |
| FR-RV06 | MUST | Domain §7.4；Architecture §6 | E5-01 | U 不复制统计、E2E |
| FR-RV07 | 延期 | Architecture §9；AI §1 | — | SCOPE：无 AI 完整周计划 |

### 2.11 Data

| ID | 级别 | 设计落点 | 切片 | 测试 |
|---|---|---|---|---|
| FR-D01 | MUST | Data §2/8/11 | E0-03、各切片 | C、I 重开、E2E-AC-07 |
| FR-D02 | MUST | Data §6/7；ED-008 | E3-01 | U、I、E2E-AC-07 |
| FR-D03 | MUST | Data §9 | E3-02 | U 投影、I 导出、E2E |
| FR-D04 | MUST | Data §9.1/9.2 | E3-02 | I 全状态/引用、E2E |
| FR-D05 | MUST | Architecture §8；AI §7 | E3-03 | I AI 故障、E2E-AC-07 |
| FR-D06 | 延期 | Architecture §3/7 | — | SCOPE：无账号/同步 |
| FR-D07 | 延期 | Data §8/9 | — | SCOPE：有版本导出、无自动导入 |

## 3. SHOULD 结论汇总

| ID | 结论 | 影响 |
|---|---|---|
| FR-G07 | S7 实现软引导 | 无硬上限，不阻塞创建 |
| FR-A08 | S1 提供显式下一步更新 | 不自动替换 |
| FR-R08 | S3 实现补记/修正 | 需要日期和投影集成测试 |
| FR-T06 | S7 实现软提示 | 数量建议不是规则 |
| FR-T07 | S7 显示距上次真实行动天数 | 不设阈值，不产生逾期压力 |
| FR-L06 | S1 深入层支持 note | 不进入快速层必填 |
| FR-C04 | S3 支持修改/撤销 | 不建立知识图谱 |
| FR-P05 | S7 展示距上次行动事实 | 不自动评价停滞 |
| FR-P06 | S7 简单周期事实变化 | 不生成综合分数 |
| FR-REC05 | S4 提供小行动入口 | 用户最终选择 |
| FR-RV05 | S5 可显式更新下一步 | Review 不自动写入 |

## 4. 验收场景 AC

| ID | 主要模块 | 切片 | 自动化 | 人工重点 |
|---|---|---|---|---|
| AC-01 | Goal、Action、Record、Today、Progress | S1 | E2E-AC-01 + U/I | 创建和快速记录负担 |
| AC-02 | AI 边界、ContextSelector、确认命令 | S6 | E2E-AC-02 + U/I | 建议温和、可改、可拒绝 |
| AC-03 | Routine、Today、Progress | S2 | E2E-AC-03 + 统计矩阵 | 五种语义是否清楚 |
| AC-04 | Action、TodaySelection | S2 | E2E-AC-04 | 意向无绩效压力 |
| AC-05 | RecoveryContext、Goal/Action 生命周期 | S4 | E2E-AC-05 + FakeClock | 返回是否更容易开始 |
| AC-06 | ReviewSummary、ReviewResult | S5 | E2E-AC-06 | 复盘是否简短现实 |
| AC-07 | Repository、Data control、Export、AI 降级 | S3 | E2E-AC-07 + C/I | 导出说明是否准确 |

## 5. 决定 D

### 5.1 已确认决定

| ID | 架构落点 | 测试/检查 |
|---|---|---|
| D-001 | Architecture §2/7；Implementation §1 | M 日常负担、SCOPE 无展示性扩张 |
| D-002 | Domain §3/8；Architecture §6 | U/I 历史守恒、E2E-AC-05 |
| D-003 | Domain §1/2；Architecture §3 | 模型/导航结构检查 |
| D-004 | Domain §7.3；Architecture §4.1 | U selectedBy=user、E2E Today |
| D-005 | Implementation §10.1 | U 无硬上限、M |
| D-006 | Domain §6.1；Architecture §4.1 | U 最小表单、E2E-AC-01 |
| D-007 | Domain §8；Architecture §6 | U Progress 投影、M |
| D-008 | Domain §6.4/8 | U Routine 统计矩阵 |
| D-009 | Domain §6.3；Data §5 | U 无记录=未知、迁移扫描 |
| D-010 | Domain §6.4；Architecture §9 | U/M 无失败评价 |
| D-011 | Domain §4.1/7.3 | E2E-AC-04、结构检查 |
| D-012 | AI §3 | U Provider 未触发=0 |
| D-013 | AI §1/5；Architecture §9 | fake 契约、M 文案 |
| D-014 | AI §2/6 | U/I 确认前零写入 |
| D-015 | Architecture §8；AI §7 | I 故障矩阵、E2E-AC-07 |
| D-016 | Architecture §2/4；Domain §2 | 依赖和模型评审、全 E2E |
| D-017 | Implementation §2～12 | 阶段门与 7～14 天使用证据 |

### 5.2 暂定冻结决定

| ID | 架构落点 | 测试/检查 |
|---|---|---|
| D-101 | Domain §3.2 | U Goal 状态机，无结束原因字段 |
| D-102 | Domain §1/7.3 | 模型扫描：无“本周承诺”实体 |
| D-103 | Data §4；ED-012 | U/I 估算补记修改，无计时器 |
| D-104 | Domain §7.1；AI §6.2 | U 用户确认自然语言，无掌握度 |
| D-105 | Domain §7.2/7.4 | 模型扫描：无精细阻力分类 |
| D-106 | Data §4；Domain §8 | FakeClock 周一/周日边界 |
| D-107 | Domain §5.4；Data §5 | U/I 非计划日矩阵 |
| D-108 | AI §4；ED-011 | U 唯一标记和上下文预算 |
| D-109 | AI §3/6/8 | 重开后无 AI 会话；仅确认结果存在 |
| D-110 | Architecture §6；Implementation §8 | E2E 主动进入；SCOPE 无提醒 |
| D-111 | Data §9 | I 完整导出；SCOPE 无自动导入 |

## 6. 延期排除清单

以下能力不得成为 v0.1 模块、接口、数据表、页面或测试前置条件：

- 通用任务管理、优先级、截止日期、标签、搜索、子任务、依赖；
- 月历、复杂周历、自动排程、通知、提醒和后台督促；
- 账号、多设备同步、团队和社交；
- AI 整日/整周计划、主动介入、长期记忆和画像；
- 概念图谱、知识层级、掌握度和完整教学系统；
- 兴趣专属模块、综合生产力评分和复杂统计；
- 自动导入恢复；
- 插件、动态表单、自定义数据库或通用工作流平台。

工程初始化和每个切片交付前后均执行范围扫描；发现上述能力成为必需依赖时停止任务并按变更规则报告。

## 7. 覆盖结论

- MUST：69/69 均有设计、切片和自动化测试层级落点。
- SHOULD：11/11 均有处理结论；未将其升级为 MUST。
- 延期 FR：7/7 均只有排除检查，无当前切片。
- AC：7/7 均有对应纵向切片、E2E 和人工验收重点。
- D：17 条已确认决定和 11 条暂定冻结决定均有架构与验证落点。
- 冲突：截至本提案未发现 MUST 冲突。
- 工程决定：ED-001～019 已批准；具体依赖版本和首个 AI Provider 留在工程初始化审批。
- 范围变化：无；工程选择没有写回或改变需求基线。

# 历史归档索引

归档只用于历史追溯，不是普通工作的执行入口。既有阶段任务状态见[任务索引](../TASK_INDEX_V0.1.md)，验证、失败与豁免见[验收证据](../ACCEPTANCE_EVIDENCE_V0.1.md)；它们不维护所有后续修复的状态，也不恢复旧权限。日常操作从[维护入口](../../MAINTENANCE.md)开始，原设计中的任务依赖、批准状态和阶段门见[阶段执行归档](stage-execution/INDEX.md)。产品、架构、模板、元数据与已被现行工作流取代的[分支历史提案](../ESCALATION_DOC_BRANCH_ANCESTRY.md)保留在现行位置。

## 阶段摘要

| 范围 | 摘要 |
| --- | --- |
| 工程基础 | [S0](S0_T001_T004_ARCHIVE.md) |
| 目标、行动与记录 | [S1](S1_T011_T014_ARCHIVE.md) |
| 例行与今日意向 | [S2](S2_T021_T023_ARCHIVE.md) |
| 数据控制与导出 | [S3](S3_T031_T033_ARCHIVE.md) |
| 恢复、复盘及 T806 聚合 | [S4/S5](S4_S5_T041_T052_ARCHIVE.md) |
| AI 启动帮助及 T807 聚合 | [S6](S6_T061_T063_ARCHIVE.md) |
| SHOULD 与 Demo 收敛 | [S7](S7_T071_T072_ARCHIVE.md) |
| 原位升级、私有更新与发布交接 | [S8](S8_T081_T084_T809_ARCHIVE.md) |
| 工程治理及 Renderer ownership | [T090～T094、T804/T805](GOVERNANCE_T090_T093_T804_ARCHIVE.md) |

## 历史提案与 UX 记录

下列全文保留独立的批准、撤回、失败和观察依据，仅移动位置并修正链接。记录中的 blocking、pending、未提交状态及授权均按原日期理解，不能直接当成当前事实。

| 原文件 | 历史主题与入口 |
| --- | --- |
| T031_ESCALATION_PROPOSAL_001.md | [schema v2 导致 shell 旧断言失败；owner 批准精确扩围](records/T031_ESCALATION_PROPOSAL_001.md) |
| T031_ESCALATION_PROPOSAL_002.md | [可信 dataControl API 旧列表断言失败；第二次精确扩围](records/T031_ESCALATION_PROPOSAL_002.md) |
| T052_ESCALATION_AC07_EXPORT_VERSION.md | [export v2 的 AC-07 旧版本断言与 test-only 扩围](records/T052_ESCALATION_AC07_EXPORT_VERSION.md) |
| T081_ESCALATION_PROPOSAL.md | [真实双版本包、version-only 扩围与隔离验收起点](records/T081_ESCALATION_PROPOSAL.md) |
| T082_ESCALATION_PROPOSAL.md | [真实私有源及分发包验证交 T084 的 owner 决定](records/T082_ESCALATION_PROPOSAL.md) |
| ESCALATION_PROPOSAL_T083_APP_MEDIATED_UPGRADE.md | [手动 NSIS 与应用内协调替代验收的两次 owner 决定](records/ESCALATION_PROPOSAL_T083_APP_MEDIATED_UPGRADE.md) |
| T084_CURRENT_ACCOUNT_DATA_PATH_PROPOSAL.md | [默认数据路径提案撤回；保留失败与新进程核验](records/T084_CURRENT_ACCOUNT_DATA_PATH_PROPOSAL.md) |
| T084_INDEX_CONFLICT_PROPOSAL.md | [任务索引冲突与 owner 最小解决授权](records/T084_INDEX_CONFLICT_PROPOSAL.md) |
| T084_PRIVATE_REHEARSAL_DEPLOYMENT_PROPOSAL.md | [确切 v0.1.4 稳定演练授权、资产与实际执行](records/T084_PRIVATE_REHEARSAL_DEPLOYMENT_PROPOSAL.md) |
| T084_WORKFLOW_PUBLICATION_BLOCKER.md | [workflow 发布认证失败、后续解决及权限分离](records/T084_WORKFLOW_PUBLICATION_BLOCKER.md) |
| UXR-20260907.md | [第一轮 UX 改动、定向/完整验证、实现侧 smoke 与黑盒限制](records/UXR-20260907.md) |
| UXR-20260908.md | [第二轮 UX 与后续交互轻修复；保留未执行验证边界](records/UXR-20260908.md) |

## 完整文本恢复

本批从当前树移出的 11 份完整合同、2 份阶段测试程序与 2 份旧操作说明，原文均保存在提交 `346d508ac7976b55ba83d025432f50af0a211208`。它是本轮归档前的文档快照，不是产品构建、task delivery 或 stage source；恢复旧合同不恢复执行权限。

在仓库根目录用下面的只读命令。例如恢复 T071 全文；其他文件用下表原文件名替换末尾：

```powershell
git show 346d508ac7976b55ba83d025432f50af0a211208:docs/implementation/T071_SHOULD_CONVERGENCE.md
```

| 原文件名 | 当前摘要或替代说明 |
| --- | --- |
| T071_SHOULD_CONVERGENCE.md | [T071](S7_T071_T072_ARCHIVE.md#t071) |
| T072_DEMO_CONVERGENCE.md | [T072](S7_T071_T072_ARCHIVE.md#t072) |
| T081_IN_PLACE_UPGRADE_BASELINE.md | [T081](S8_T081_T084_T809_ARCHIVE.md#t081) |
| T082_PRIVATE_UPDATE_CHECK_DOWNLOAD.md | [T082](S8_T081_T084_T809_ARCHIVE.md#t082) |
| T083_CONFIRM_INSTALL_SHUTDOWN.md | [T083](S8_T081_T084_T809_ARCHIVE.md#t083) |
| T084_RELEASE_PIPELINE_STAGE_ACCEPTANCE.md | [T084](S8_T081_T084_T809_ARCHIVE.md#t084) |
| T809_S8_FINAL_ACCEPTANCE.md | [T809](S8_T081_T084_T809_ARCHIVE.md#t809) |
| T805_DOCUMENT_REDUNDANCY_AUDIT.md | [T805](GOVERNANCE_T090_T093_T804_ARCHIVE.md#t805) |
| T094_STRUCTURAL_UI_REFACTOR.md | [T094](GOVERNANCE_T090_T093_T804_ARCHIVE.md#t094) |
| T806_S4_S5_FINAL_ACCEPTANCE.md | [T806](S4_S5_T041_T052_ARCHIVE.md#t806) |
| T807_S6_FINAL_ACCEPTANCE.md | [T807](S6_T061_T063_ARCHIVE.md#t807) |
| T081_UPGRADE_TEST_PROCEDURE.md | [T081](S8_T081_T084_T809_ARCHIVE.md#t081) |
| T084_STAGE_ACCEPTANCE_PROCEDURE.md | [T084](S8_T081_T084_T809_ARCHIVE.md#t084) |
| T082_UPDATE_SOURCE_OPERATIONS.md | [凭据配置](../../maintenance/UPDATE.md#凭据配置) |
| T084_RELEASE_OPERATIONS.md | [首次接入与历史基线](../../maintenance/RELEASE.md#首次接入与历史基线) |

更早的 S0～S6 与治理完整合同使用各阶段摘要中的恢复 revision。历史元数据中的文件范围保持当时的路径，不改成新的实施授权；需要审计时在对应 source 或此快照解释。账本不因归档删除失败、skip、owner-reported 或 waived-by-owner。

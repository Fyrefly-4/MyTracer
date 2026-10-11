# S8：原位升级、更新与发布交接归档

> 归档日期：2026-10-11。已完成合同与阶段测试程序由本文提炼，完整文本从[归档索引](INDEX.md#完整文本恢复)恢复。本文不重签人工验收、不更改 owner 豁免、不启动发布；当前状态和结果分别看[任务索引](../TASK_INDEX_V0.1.md)与[验收证据](../ACCEPTANCE_EVIDENCE_V0.1.md)。

## T081

U-01 建立同安装身份、同 Windows 用户的真实双版本 NSIS 原位升级、SQLite/LocalDate/导出与配置连续性基础。首次版本扩围和当前账户例外只属于当时的精确批准，不能复制成新安装或真实数据访问授权。[EV-T081-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t081-001)保留构建来源、hash、自动与人工结果；原验证步骤从索引恢复。

## T082

U-02/03 提供固定私有稳定源的用户主动检查、确认下载、版本/传输/资产 hash 校验及失败降级。Main-only token 与网络，不扩大 Renderer 权限。Owner 批准 approved-2：真实源、最终分发包与安装版体验交 T084，不用 fake 检查冒充真实源通过；见 [EV-T082-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t082-001)及[归属提案](records/T082_ESCALATION_PROPOSAL.md)。

## T083

U-04 提供显式确认重启安装、未保存输入与 AI 建议阻断、取消准备、操作门禁/排空及单实例保护。关闭数据库后安装失败保持锁定并提示重启。Owner 于 2026-10-02 批准手动 0.1.2→0.1.3 NSIS 数据连续性与 0.1.3 应用内协调分层测试分别验收；不把它们合称为完整应用内跨版本升级。真实完整交接留给后续 S8，见 [EV-T083-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t083-001)及[起点冲突记录](records/ESCALATION_PROPOSAL_T083_APP_MEDIATED_UPGRADE.md)。

## T084

U-05 建立候选构建、manifest/五项资产、实际 artifact/digest、来源校验、拒绝覆盖和发布流程；原始 dispatch 与演练均按当时版本理解，日常方法统一见[发布维护](../../maintenance/RELEASE.md)。

- Owner 精确批准的 v0.1.4 稳定通道演练来源为 a5759763adc18739f8f65bcfc48f01db8f1ecd7f，Release 403104108；未推进 main，也未放宽 accepted-main 门禁。原资产不能覆盖，演练不等于正式发布。
- 真实正常链路及补测结果见 [EV-T084-001/002](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t084-002)。等待版本时把 0.1.4.0 当作不同版本的失败、后续不重装接续验证，以及网络诊断失败均保留；进程内阻断不证明物理断网或真实下载中断恢复。
- 默认数据路径提案已撤回：新进程环境探测证明合成默认 userData 归属，缺少 BASE_INSTALLER 的退出不能记为路径拒绝通过；不改名、读取或搬移真实默认目录。见[路径核验记录](records/T084_CURRENT_ACCOUNT_DATA_PATH_PROPOSAL.md)。
- Workflow 推送认证阻塞已解决，但历史 push/SSH 失败不改成成功；客户端 Contents-read 凭据与发布认证保持分离，见[认证记录](records/T084_WORKFLOW_PUBLICATION_BLOCKER.md)。

## T809

聚合固定产品 source 080c308ff511705bfd8ab21386a03d58ec311dcd 上的 U-01～05 与 AC-01～07 受影响回归，并保留完整实装、故障与发布验证缺口。Owner 报告简明 0.1.3→0.1.4 应用内更新、草稿保护、数据保留和重开通过；正式凭据配置、测试凭据撤销、提醒与正常入口重启检查为 owner-reported completed，实际到期日未提供。

Owner 随后明确豁免剩余真实故障及两组实装检查：未执行且接受风险，不能计为 pass。独立 review、最终 hosted CI、云端隔离安装 smoke 与 PR #61 dev 集成、PR #62 main 晋升分别留在 [EV-S8-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)及[事实校准](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)。本次归档不扩展豁免范围。

## 交付与后续维护

| 任务 / PR | 最后 PR/docs head | 实际 dev integration |
| --- | --- | --- |
| T081 / #57 | e1412f790584b0b0c07ec8f1a25ae45aedb5b899 | 0724cbb9990d328ee7ff68b7e5ac93fc8107e6d3 |
| T082 / #58 | d8b0d63a42a87c6a8d782a4cefb1f0ca295a3d7a | cf3b2b4c00b6757218295c2672d23cf19f1ee526 |
| T083 / #59 | 91933e05debdbd0e091a885dcb7c31e880f58588 | de88b1877ba2cfc48f1e593bcfcb2007471a3fa3 |
| T084 / #60 | e9b3923bac93c0d13b8c6d29f219dfd703e71c65 | 080c308ff511705bfd8ab21386a03d58ec311dcd |
| T809 / #61 | 3fd1528001c985cc10736a3a130230bf9c6eb30b | 69c7f566fa90d667d5c81cfe983e3d3ee09df39a |

表中最后 PR/docs head 不替换产品构建或旧 implementation candidate。后续 PR #64 的 owner tag 改造仅进入 dev，main 尚未部署，首次正式 tag 发布未执行；新操作方法见[发布维护](../../maintenance/RELEASE.md#部署状态与发布前提)。

当前客户端操作统一见[更新与凭据维护](../../maintenance/UPDATE.md)。未签名、固定私有源、用户确认安装、同 schema 更新和导出不等于恢复的边界继续有效。未来实装或故障测试必须重新批准环境、身份、数据根、产物与清理范围；历史阶段程序不提供新授权。

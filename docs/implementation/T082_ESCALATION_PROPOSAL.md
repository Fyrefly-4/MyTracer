# T082 Escalation Proposal — 私有稳定 Release 验证归属

> 执行通信记录，不是合同修订或独立授权。2026-09-29 owner 指出：临时稳定 Release 的准备/发布不能在 T082 内完成，至少该步骤不属于本次任务；随后明确批准本提案的推荐归属。生效边界以 T082 合同 approved-2 及证据账本为准，提案中的 `blocking: true` 保留为发现问题时的状态。

```yaml
type: contract_scope_change
task: T082
blocking: true

problem:
  summary: T082 合同把实际私有稳定 Release 和安装版人工体验设为完成条件，但创建该候选版本、tag 和 Release 均被 T082 排除；S8 阶段设计将真实私有分发和完整阶段验收交给 T084。
  observed_behavior: 2026-09-29 只读查询 Fyrefly-4/MyTracer 的 Releases 只有 alpha/beta prerelease，无高于 0.1.2 的稳定 Release；当前 Windows 账户未配置 MYTRACER_UPDATE_TOKEN。固定源客户端只能读取该仓库稳定通道，不能用改名的 0.1.2 包或 fake adapter 冒充真实检查/下载。

observed_at:
  branch: task/T082-private-update-download
  revision: 7b5baa9a5e758f942e4cc59197c08fb7f64b7b54
  working_tree_state: clean-before-this-proposal

current_authority:
  contract: docs/implementation/T082_PRIVATE_UPDATE_CHECK_DOWNLOAD.md
  stage_design: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
  architecture:
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md

conflict:
  current_rule_or_assumption: T082 合同 §4 将私有测试 Release/只读凭据列为未完成依赖；§9.7 和 §10.2 要求 owner 在安装版及受控私有源完成检查、断网、鉴权、下载/重试/稍后与 unsigned 人工体验；EV-T082-001 因此保持 review。
  incompatible_condition: 合同 §6、§11、§12 不授权 T082 创建更高应用版本、tag、Release 或写入真实源；S8 §4 D 节点和 §6.3 把真实私有分发访问、完整升级及人工验收放在 T084。现有源也没有可供只读测试的稳定候选。
  evidence: EV-T082-001；PR #58 head 7b5baa9 的 final-head CI run 36545031797 全部通过；2026-09-29 gh release list 只显示六个 prerelease；本机当前账户预检无 MYTRACER_UPDATE_TOKEN；owner 本轮明确指出 T082 无法完成准备/发布临时稳定版。

proposed_change:
  summary: 将 T082 限定为固定私有源的检查/下载实现、fake/受控源分层验证、Windows 包及元数据/hash 校验、云端 CI 和 owner 人工代码 review。T082 合同 §4、§9.7、§10 与 EV-T082-001、任务索引同步注明真实私有 GitHub Release、只读凭据下的安装版体验和实际发布包 provenance 是 T084 的前置/阶段验收，不再阻塞 T082 本身完成；不声称真实私有鉴权或下载已经通过。S8 §4/§6.3 的 A→B→C→D 串行集成和最终阶段门保持不变。若 owner 认为 T082 仍需某些不依赖发布的人工 UI 检查，在合同中精确列出并先完成。
  alternatives:
    - alternative: 保持 T082 合同原门槛，T082 停留 review，等待 T084 先准备稳定源后回头补验。
      tradeoff: 避免改合同，但与 S8 串行集成顺序冲突，T083/T084 的启动或集成可能被人为阻塞。
    - alternative: 单独授权 T082 创建并发布真实稳定测试版本。
      tradeoff: 扩大版本、tag、Release 及发布权限，提前改变私有 latest 源；owner 已指出至少此步骤不属于 T082，不推荐。

affected:
  tasks:
    - T082
    - T084
  files:
    - docs/implementation/T082_PRIVATE_UPDATE_CHECK_DOWNLOAD.md
    - docs/implementation/metadata/T082.json
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
  interfaces:
    - T082 到 T084 的测试源和发布包证据交接

risk:
  product_semantics: 不改变冻结 FR/AC/D，也不改变 T082 已实现的更新行为。
  data_safety: 不触及默认用户数据；本提案不执行安装或发布。
  integration: 若 T084 真实源发现缺陷，按受影响任务修复并重新验证，不能以 T082 的 fake CI 代替。
  evidence: T082 自动化及当前包 hash 不能证明真实 GitHub 私有鉴权、重定向或最终分发资产；T084 须保留这些缺口并补验。

safe_work_completed:
  - PR #58 实现候选和文档 head 7b5baa9；run 36545031797 的完整 Windows、NSIS package/smoke 和两项 required gate 通过。
  - owner 于 2026-09-29 报告人工代码 review 通过；未报告实际私有源安装版人工体验。
  - 在获准当前账户只读预检后，本地以 --publish never 构建 7b5baa9 的 0.1.2 包；SHA-256 为 86B44150D721B0E437B2D3D3C375573C237CF6E090416DC5C480AF6641F3B398，latest.yml SHA-512 与安装包一致，NotSigned；未安装、发布或读取默认数据。

minimum_owner_decision:
  - 批准建议的 T082/T084 验证归属及合同、索引和证据最小修订；或明确保留 T082 review，待真实稳定源由其他获授权任务准备后补验；或提出更窄边界。

recommended_resume_point: owner 确认归属后先修订合同与 evidence，核对 T082 其余验收条件和人工状态，再决定是否可记 done。文档提交后重跑最新 PR head CI；不自行发布、合并或启动 T083/T084。
```

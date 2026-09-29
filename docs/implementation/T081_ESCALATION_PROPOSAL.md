# T081 Escalation Proposal — 真实双版本安装包与隔离验收门槛

> 执行通信记录；不是产品需求、任务合同修订或独立授权。项目所有者于 2026-09-29 回复“批准提案中的最小扩围”；生效边界已同步至 T081 合同 approved-2。隔离 Windows 环境仍未提供，真实安装验证保持待执行。

```yaml
type: contract_scope_change
task: T081
blocking: false

problem:
  summary: 现有所有版本标签的应用版本均为 0.1.0；合同禁止修改版本文件，无法生成要求严格递增的 A/B 真实安装包。
  observed_behavior: 逐一读取 v0.1.0-alpha.1～beta.3 的 package.json，全部为 version 0.1.0；当前 package.json 与 package-lock.json 也均为 0.1.0。用户已说明暂无一次性 Windows VM/独立测试账户，要求先完成其他工作。

observed_at:
  branch: task/T081-in-place-upgrade
  revision: 081733f3556d6b9b2f2341cf5610675ab9640d95
  working_tree_state: uncommitted-2026-09-29-skill-and-contract-preflight

current_authority:
  contract: docs/implementation/T081_IN_PLACE_UPGRADE_BASELINE.md
  stage_design: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
  architecture:
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md

conflict:
  current_rule_or_assumption: T081 合同 §4 要求在开始实现前固定 A/B 的真实版本及 SHA-256 和隔离 Windows 环境；§5 未授权修改 package.json/lock，§9 要求 A/B 真实版本严格递增。
  incompatible_condition: 全部既有可用 source tag 的 package.json 均为 0.1.0；B 仍是 0.1.0 无法证明真实版本升级。SHA-256 也只能在构建各包后产生。隔离环境当前不可用，不能运行 NSIS 安装/卸载验证。
  evidence: git show <tag>:package.json 对六个现有版本标签的只读结果；当前 package.json/package-lock.json；owner 对隔离环境的答复。未构建或安装包，不声称升级已验证。

proposed_change:
  summary: 仅为 T081 允许 package.json 与 package-lock.json 的应用版本从 0.1.0 同步升至 0.1.1，不改变依赖；固定 A 为实际 0.1.0 source/B 为实际 0.1.1 source，构建后补记各自 SHA-256。将隔离 Windows 身份列为 NSIS 安装/卸载验证前置，而非安全本地代码和构建的前置；最终安装、人工验收和任务完成仍须等待隔离环境和真实结果。
  alternatives:
    - alternative: 项目所有者提供已有的较低真实应用版本安装包及不可变 source/hash，保持 B 为 0.1.0。
      tradeoff: 无需改版本文件，但当前仓库标签不能提供该包；须验证同一 appId、数据目录、schema 与来源可信度。
    - alternative: 暂停双版本包实现直至隔离环境及版本方案就绪。
      tradeoff: 保持现合同不变，T081 的可观察结果与安装证据均延后。

affected:
  tasks:
    - T081
  files:
    - package.json
    - package-lock.json
    - docs/implementation/T081_IN_PLACE_UPGRADE_BASELINE.md
  interfaces:
    - Windows NSIS application version and artifact identity

risk:
  product_semantics: 不改变 FR/AC/D 或业务数据语义；仅应用版本递增。
  data_safety: 当前不安装或迁移，真实用户数据不接触；安装验证仍严格等待隔离身份。
  integration: 版本号会进入后续 T082～T084 的来源版本矩阵，需在各自合同时固定。
  evidence: 无 A/B 构建和安装前，不得将标签名、计划或此提案当成真实升级证据。

safe_work_completed:
  - 核实当前任务分支干净基线为 081733f，远端 dev 为 d8b211b；T072 历史证据已只读核对。
  - 按 owner 单独批准，窄范围更新 Development Skill 的 S8 适用说明，并以 quick_validate.py 验证有效。
  - 在批准的 Node 24.18.0/npm 11.16.0 环境运行治理 metadata 检查，通过 21 个 sidecar 和 1 个 Profile。
  - 仅读取六个版本标签的 package.json、当前 package.json/lock 与合同；没有启动产品实现、打包、安装、push 或 PR。

minimum_owner_decision:
  - 批准上述 version-only package.json/package-lock.json 扩围、构建后记录真实 SHA-256，并允许隔离环境就绪前继续安全本地实现/构建；或提供真实低版本安装包；或明确延期。

recommended_resume_point: 获得具体决定后更新 T081 合同及门槛，在同一任务分支复核版本/锁文件及安装身份，再从最小打包与跨版本测试实现继续；NSIS 安装/卸载必须等隔离 Windows 环境。
```

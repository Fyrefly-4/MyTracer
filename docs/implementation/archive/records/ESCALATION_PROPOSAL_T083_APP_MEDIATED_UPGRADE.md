# T083 升级提案：应用内跨版本安装验证的起点冲突

> 历史归档（2026-10-11）：正文状态、失败和权限按原记录日期理解，不作为当前任务状态或新授权。导航见[归档索引](../INDEX.md)。

```yaml
type: testability_problem
task: T083
blocking: true
problem:
  summary: 合同 §9.5 要求从已安装 0.1.2 经应用内确认安装到更高版本，但正式的 T082 0.1.2 包没有 T083 才新增的确认安装功能。
  observed_behavior: 已构建未发布的 0.1.3 NSIS 包；使用真实 0.1.2 与 0.1.3 包完成隔离的手动原位升级、运行中安装及失败包修复测试。T082 0.1.2 应用只能检查和下载，无法启动 T083 的应用内安装流程。
observed_at:
  branch: task/T083-confirm-install-shutdown
  revision: 014e4ff8a08e8397c193ad1bef49ab28dfdc1660
  working_tree_state: uncommitted-implementation-on-2026-09-30
current_authority:
  contract: docs/implementation/T083_CONFIRM_INSTALL_SHUTDOWN.md
  stage_design: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
conflict:
  current_rule_or_assumption: T083 §9.5 要求从已安装 0.1.2 手动检查、下载、草稿阻断、处理草稿并显式安装更高版本，且使用真实不同版本包。
  incompatible_condition: 0.1.2 包来自 T082，在 T083 功能进入源码前构建；它不可能提供确认安装入口。单独用 0.1.3 开始应用内测试，又不能声称是 0.1.2→0.1.3 的完整应用内连续测试。
  evidence: 真实 0.1.2→0.1.3 NSIS 原位升级测试 1 passed；运行中安装与损坏包修复测试 2 passed；T083 Electron 草稿阻断与第二实例测试 2 passed。安装均使用已预检的当前账户和唯一临时根。0.1.2 包 SHA-256 为 86B44150D721B0E437B2D3D3C375573C237CF6E090416DC5C480AF6641F3B398；0.1.3 测试包在最终源码封包后重算 hash。
proposed_change:
  summary: 将 §9.5 拆成两条独立证据：真实 T082 0.1.2→T083 0.1.3 的手动 NSIS 数据连续性，以及用含 T083 功能的两个受控不同版本测试包完成应用内确认安装连续性。仅测试包允许后一个较高版本，不改变批准的产品交付版本 0.1.3。
  alternatives:
    - alternative: 将应用内跨版本连续测试延至 T084 的首个后续版本，并在 T083 仅保留隔离的协调与原位升级证据。
      tradeoff: T083 §9.5 无法按现合同通过；T084 增加门禁且 T083 不可标记完成。
affected:
  tasks: [T083, T084]
  files:
    - docs/implementation/T083_CONFIRM_INSTALL_SHUTDOWN.md
    - tests/e2e/windows-update-install.e2e.test.ts
  interfaces: [测试专用受控更新源；不改变 Renderer 更新 API]
risk:
  product_semantics: none
  data_safety: 测试仍必须保留当前账户只读预检、临时安装和数据根及仅清理本次创建的目标。
  integration: T083 的 Ready 与合并门禁在 owner 决定和对应测试通过前保持未满足。
  evidence: 不得把手动 NSIS 测试或 fake adapter 草稿测试写成应用内跨版本安装通过。
safe_work_completed:
  - 0.1.3 应用的安装协调、草稿阻断、Main 操作门禁与单实例实现和分层测试。
  - 真实 0.1.2→0.1.3 原位安装数据连续性、运行中安装和失败包修复隔离测试。
minimum_owner_decision: [approve, reject, defer, provide-alternative]
recommended_resume_point: 审定 §9.5 的可执行双包方案后，从当前 T083 分支的候选实现继续应用内跨版本安装测试；完成后重新运行受影响回归和候选 CI。
```

本提案仅记录执行冲突，不改变合同、产品语义或授权；受影响的应用内跨版本安装验收在新 authority 到达前停止。

## Owner response — 2026-09-30

Owner 明确保留 T083 的应用版本 `0.1.3`，并取消提案中的额外双包测试方案。此决定不修改合同 §9.5，也不授权将其未通过项移交 T084 或宣称应用内跨版本安装已通过。原版 T082 `0.1.2` 没有确认安装入口这一冲突仍在；T083 仅继续不依赖额外测试包的实现和验证，受影响验收及 Ready/merge 门禁保持待决。

## Owner decision — 2026-10-02

Owner 在获知替代验收的两组证据及缺口后回复“同意，批准”。批准将合同 §9.5 改为：真实 `0.1.2`→`0.1.3` 手动 NSIS 安装与数据连续性，以及 `0.1.3` 应用内协调的分层测试分别验收。保留产品版本 `0.1.3`，取消额外双包测试；真实应用成功交接安装器并启动新版的完整跨版本流程留待后续版本/任务，不作为本次 T083 完成的阻断，仍是 S8 最终验收的未验证项。此决定不授权启动 T084、合并、发布或代签人工验收。

上述 YAML 与 2026-09-30 回复保留为历史冲突记录；当前合同已依照本次直接批准修订，原 §9.5 的 testability blocker 解除。手动 NSIS 与 fake adapter 结果仍不得称为完整应用内升级通过。恢复点为 `task/T083-confirm-install-shutdown@9781882f0e2c7f5f1990a4bc86761e9e582a0e5c`，继续核对候选 CI、独立 review、Integration Freshness 和文档收口门槛；本批准不等于这些门槛已通过。

# MyTracer 显式阶段工作流参考

> 仅在 owner 为当前工作明确启用阶段流程时使用。本文的合同、freshness、独立评审、阶段证据与长任务规则不适用于普通请求。旧部署快照不是实时配置；当前 Git、PR、CI 和发布操作见 [GitHub 工作流](GITHUB_WORKFLOW_V0.1.md)。

> 2026-10-11 事实校准：main/dev revisions、PR #62 单父提交历史差异及 PR #64 的 dev-only 部署见 [EV-DOC-CALIBRATION-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)。旧 GitHub 配置快照仍按各日期解释，不用本次事实校准推断实时保护配置或授权外部写入。

> 分支迁移：当前分支模型以 main 为唯一长期集成线。下文历史快照不恢复 dev；新合同与 Skill 使用 main。旧合同中的 dev 字段须在重新启用时显式调整，不能自动恢复旧授权。
> 文档状态：显式阶段流程参考，分支操作服从当前日常工作流
> 批准范围：GW-001～GW-010
> 配置快照：截至 2026-08-26（历史快照），PR template、分层 Actions、main milestone CI 与统一 `CI Gate` 已由 T093 实现；`dev`/`main` active rulesets 均要求 `CI Gate`
> 适用对象：项目所有者、Codex 和其他经授权 Agent

## 1. 目标

本流程用于：

- 隔离每个 Agent 任务，避免直接污染集成分支；
- 让代码、测试、评审和验收证据绑定到明确 PR；
- 保留项目所有者对产品语义、合并、里程碑和发布的控制；
- 使 `main` 承接已接受的维护变更，阶段验收和正式发布分别绑定固定 revision；
- 支持 Codex worktree，但不要求为了并行而并行。

GitHub 官方将 GitHub Flow 定义为轻量分支工作流：独立分支承载一组相关变更，通过 PR 评审和检查后合并，再删除任务分支。MyTracer 使用 main 加短期工作分支；显式阶段验收继续绑定固定来源，不增加长期集成分支。参考：[GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)。

## 2. GW-001 分支模型

从最新核实的 main 创建 `codex/<short-name>`，通过 PR 检查和必要验收后，经 owner 授权合入 main。main 是已接受的维护基线；tag、Release 与确切候选产物标识已发布版本，合入不自动发布。

dev 不再作为集成目标，不创建晋级或回流 PR。历史任务和证据中的 dev 保留原日期含义。短期远端分支删除仍需要 owner 授权。

## 3. GW-002 Codex worktree

每个任务优先使用独立 Codex worktree 或普通任务分支：

```text
最新授权的 origin/main
  → 独立 worktree
  → 创建 codex/<short-name>
  → 实现和本地验证
  → commit
  → push
  → Draft PR to main（push/PR 均需明确授权）
```

Codex 桌面版 worktree 可让多个任务使用独立检出；默认可能以 detached HEAD 开始，需要在发布前创建正式分支。同一分支不能同时被多个 worktree checkout。参考：[OpenAI Docs：Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)。

约束：

- 不同时并行修改同一 migration、同一领域不变量或大面积重叠文件。
- 测试只使用临时 SQLite 数据库和临时数据根。
- 不通过 `.worktreeinclude` 或其他机制批量传播真实 AI key。
- Electron 只能在本地主环境可靠验证时，使用 Handoff 或经批准的手工迁移流程回到 Local。
- worktree 中的 `node_modules`、构建输出和临时数据库不得作为可交付证据。

## 4. GW-003 分支和提交命名

分支使用任务而非执行者作为主标识：

```text
codex/electron-shell
codex/sqlite-migrations
codex/cross-midnight-date
codex/agent-workflow
```

不使用 `temp1`、`test-final`、`new-fix` 等无法追踪的名称。

任务分支可以有多个有意义的本地提交。每个提交应表达一个可理解、可撤销的变化，不要求为每个微小修改单独提交，也不把整个阶段压成无法审查的单一开发提交。

PR 技术标题应清楚描述任务；若选择 squash，PR 标题可作为 squash commit 标题。例如：

```text
T001: initialize the Electron application shell
T011: implement the Goal lifecycle
T034: fix cross-midnight record assignment
```

代码、commit、分支和 PR 技术标题使用英文；面向项目所有者的说明和报告可以使用中文。

## 5. GW-004 PR 说明与检查

当前 PR 模板与 CI 以[日常工作流](GITHUB_WORKFLOW_V0.1.md)为准；本参考不恢复已删除的正文检查器或旧 CI job。

## 5.1 Integration Freshness Gate

任务进入最终可合入 `main` 状态前，必须比较任务验证基线与最新授权 `main`：

| 状态 | 含义 |
|---|---|
| `fresh` | 验证基线就是最新授权 `main` |
| `refreshed-and-passed` | 任务曾基于旧基线，普通 merge 刷新后 affected regression 和 candidate CI 通过 |
| `blocked` | 最新基线不可用、刷新不安全或冲突未解决 |
| `not-required` | 合同明确任务不进入当前 `main` 集成 |

stale base 必须按以下顺序处理：获取最新授权 `main`、以普通 merge 刷新任务分支、解决冲突、运行 affected regression、必要时重新 review、运行 candidate CI。不得 force-push 改写已发布任务历史。

Evidence 至少记录：

```yaml
integration_freshness:
  original_base_revision: abc123
  latest_authorized_main_revision: def456
  verified_against_revision: def456
  status: refreshed-and-passed
  refresh_method: merge-main-into-task-branch
```

历史证据中的 `dev_integration_revision` 保留原字段；新记录使用 `main_integration_revision`，不改写旧合同或历史结果。

`task_delivery_revision` 证明任务自身合同，`main_integration_revision` 证明任务实际进入 `main`，`stage_final_integration_revision` 只证明阶段最终集成 revision；三者不能互相替代。

如果刷新发现需求、架构、合同范围、权限、依赖、migration、测试能力或证据问题，停止受影响工作并使用 [`ESCALATION_PROPOSAL_TEMPLATE.md`](ESCALATION_PROPOSAL_TEMPLATE.md)。

## 6. GW-005/GW-006 合并策略

任务和阶段汇总工作分支均通过 PR 合入 main；合并需要 owner 对具体动作的授权。按提交结构和审阅需要选择 merge、squash 或 rebase，不限制为单一方式。PR 保留开发提交、讨论和检查历史。没有 dev 到 main 的二次晋级。

任务分支需要刷新时普通 merge 最新授权 main，运行受影响回归并重新检查相关差异，不 force-push 改写已发布历史。

2026-10-11 的 PR #62 祖先关系差异是历史事实，见[历史差异提案](ESCALATION_DOC_BRANCH_ANCESTRY.md)；它不要求新流程恢复 dev 或执行回流。

## 7. GW-007 分支保护目标

main 要求 PR、有效 required checks、讨论解决，并禁止强推和未授权删除。单人项目不要求另一名评审者批准；owner 的合并授权仍须满足实际保护规则。

实时 rulesets、旧 required checks 和来源限制需要只读核实；配置修改与 dev 删除均需独立授权。不能把 classic protection API 的 404 解释为没有保护。具体切换检查见[日常工作流](GITHUB_WORKFLOW_V0.1.md#5-分支保护与远端事实)。

## 8. GW-008 CI 门禁

当前触发条件、检查分类、候选与发布入口以[日常工作流](GITHUB_WORKFLOW_V0.1.md)及源码为准。阶段候选/交付 revision 的证据要求来自被明确启用的 Skill 和合同，不增加另一套 CI。

## 9. GW-009 Agent Git 权限

| 操作 | 默认规则 |
|---|---|
| 只读检查状态、历史、diff | 任务相关时允许 |
| 创建本地 worktree/任务分支 | 活跃任务明确授权 Git 工作流后允许 |
| 创建本地提交 | 活跃任务明确授权后允许 |
| 推送任务分支 | 任务明确授权“发布 Draft PR”后允许 |
| 创建/更新 Draft PR 到 `main` | 同上 |
| 标记 Ready | 默认由项目所有者确认或执行 |
| 合并到 `main` | 每次必须项目所有者明确授权 |
| tag / GitHub Release | 每次必须项目所有者明确授权 |
| force push | 默认禁止；必须针对确切分支单独授权 |
| 修改 branch protection、Actions secrets、部署设置 | 必须针对确切目标单独授权 |

“实现任务”本身只授权范围内的本地文件修改和非破坏性验证，不自动授权外部 GitHub 写入。推荐在任务合同中一次性勾选允许的 branch、commit、push 和 Draft PR 操作，以减少重复确认；merge、tag 和 release 不提供站立授权。

## 10. GW-010 Code Review

### 本地独立 review

在 Ready 前使用 Codex review 检查：

- 未提交变更；或
- 相对 `main` 的完整分支 diff；或
- 指定 commit。

Codex 的 `/review` 可以读取选择的 diff 并报告按优先级排序的问题，默认不修改工作树。参考：[OpenAI Docs：Code review](https://learn.chatgpt.com/docs/code-review)。

### GitHub Codex Review

若未来连接 Codex cloud，可在 PR 使用 `@codex review` 或自动 review。Review Rules 取自适用的 `AGENTS.md`，但 AI review 不替代测试、分支保护或项目所有者批准。参考：[OpenAI Docs：GitHub PR review](https://learn.chatgpt.com/docs/third-party/github)。

### 初始不采用 Codex GitHub Action 作为 required gate

原因：

- 需要额外 API key 和 Actions secret 管理；
- AI 结果不具备确定性；
- MyTracer 的初始门禁应由可重复命令组成；
- Windows Codex Action 有额外安全取舍。

以后只有在本地 review 流程稳定、成本和权限获得批准后，才评估只读 PR review action。参考：[OpenAI Docs：Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)。

## 11. 里程碑、tag 和 release

阶段验收绑定固定的 main 产品来源；阶段汇总有待集成的变更时，使用工作分支 PR 到 main，并在授权合并后重新核实实际集成 revision。阶段通过、汇总文档集成、候选构建、tag 和 release 分别报告，不互相推定。

发布交接列出包含的任务和需求、确切 main 来源、实际 CI、候选及 hash、自动化与人工验收、迁移恢复情况、已知限制和待 owner 执行的动作。

正式发布使用 main 来源的手动候选和 owner 版本 tag 授权，具体校验见[发布维护](../maintenance/RELEASE.md)。不得从历史里程碑建议自动创建 tag 或发布。

## 12. Hotfix

维护修复默认同样从最新核实的 main 创建 codex 工作分支，经受影响验证、PR 检查和 owner 授权合并。若必须针对旧发布 tag 修复，先明确目标来源、与 main 的差异及发布方案，不自行创建长期维护线。

修复合入 main 后独立准备候选和版本发布，不再回流 dev。改变冻结语义仍需 owner 批准。

## 13. GitHub Issues 和 Projects

- v0.1 实施任务状态以 [`TASK_INDEX_V0.1.md`](TASK_INDEX_V0.1.md) 为唯一账本。
- 不为每个已规划任务重复创建 GitHub Issue。
- Issue 适合记录运行中发现的缺陷、阻塞、需求变更提案或外部可协作问题。
- PR 通过 Task ID 关联任务索引；若存在 Issue，再额外关联 Issue。
- 当前不引入 GitHub Projects，除非任务数量或协作者数量使文档索引不再有效。

## 14. 历史启用记录（不代表当前 CI 配置）

1. [x] GitHub 远端、`dev` 和 `main` 已建立；default branch 为 `main`。
2. [x] 依赖、工具链和精确验证命令已批准并锁定。
3. [x] T002 建立确定性 Windows CI workflow，T091 增加脱敏 evidence artifact。
4. [x] stable check `Windows required gate` 已实际运行并曾纳入 rulesets；T093 切换后继续兼容报告，但 required context 已统一为 `CI Gate`。
5. [x] `Dev-Rule` / `Main-Rule` 已 active、均要求 `CI Gate` 且无 bypass actor；`main` strict、`dev` non-strict。
6. [x] PR template、PR Quality、change classification、分层 full/milestone CI 和兼容双 Gate 已实现。
7. [x] 多个任务已完成 Draft PR、candidate/final-head CI 和 owner merge 演练。
8. [ ] GitHub Codex Review/Action 等扩展未采用；没有独立需求时不启用。

以上是 2026-08-26 的配置快照，不替代实时 GitHub 查询，也不自动授权任何配置写入。

## 15. 历史部署结论（当前 CI 以第 8 节及源码为准）

- GW-001～GW-010 是 MyTracer v0.1 的批准流程；实时配置是其部分实现，差异不得靠文档假定消失。
- 仓库为 private、default branch 为 `main`；T093 PR #33 实现候选 `189decb...` 的 run `32942810086` 已实际通过 full Windows verification、milestone package/smoke、`CI Gate` 和兼容 `Windows required gate`。
- active `Dev-Rule` / `Main-Rule` 均要求 PR、讨论解决、`CI Gate`，禁止删除和 non-fast-forward，且没有 bypass actor；`main` strict、`dev` non-strict。classic branch protection API 返回 404 是因为当前采用 rulesets，不代表无保护。
- PR template、到 `main` 的 milestone CI、change classifier、PR Quality 和统一 Gate 已由 T093 落地；GitHub Milestones 列表为空，不影响本文件定义的 milestone PR 概念。
- 项目已通过 PR #5/#14/#22/#30 四次将 `dev` 里程碑合入 `main`，并发布 `v0.1.0-alpha.1`、`alpha.2`、`alpha.3` 和 `beta.1` prereleases。
- 任何 ruleset、workflow、template、merge、tag 或 release 后续写入仍须独立授权和验证。

## 16. Long-running work

> Waiting is not work. Do not spend agent turns observing an unchanged state.
>
> Elapsed time alone is not sufficient justification for another status check.

Choose the waiting mode from the work, expected output, command timeout, observed history, and available tool behavior; do not impose one fixed interval on every task:

- **BLOCK:** For a local test, build, lint, typecheck, or other command whose result directly determines the next action, use one practical blocking wait when the tool supports it. Size the wait to the command and tool limits instead of replacing an available blocking operation with short polling.
- **SPARSE_POLL:** Use only when effective blocking is unavailable and the result is still required in the current run. Every status check needs a fresh, explicit reason, such as expected concrete output, suspected interactive input, an approaching known timeout or failure boundary, a known state-changing event, or an explicit owner request to monitor. Increase the interval after an unchanged result. Entering an expected completion window justifies one check; another elapsed interval does not by itself justify the next one. When repeated checks yield no decision-relevant information and no new reason exists, stop polling and reassess for handoff.
- **HANDOFF:** For GitHub Actions or another external asynchronous operation, confirm that it started, then record the target revision and the applicable PR, run, job, source-head, and test-merge identifiers. If no other meaningful work remains, report what is pending and return control to the project owner. Also hand off when sparse polling has no justified next check. Continuous monitoring occurs only when the project owner explicitly requests it and still follows the sparse-poll requirements.

On resume after a handoff, first verify that the saved identifiers still correspond to the current target revision. Check for a new head, replacement run, cancellation, or superseding execution before interpreting results. Use only evidence bound to the current target revision; a successful older run does not prove the current state.

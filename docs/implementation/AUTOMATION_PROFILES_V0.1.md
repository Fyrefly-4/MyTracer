# MyTracer Automation Profiles v0.1

> 文档状态：T092 定义已由 T093 接入 development Skill 与仓库 Workflow；具体任务仍须由项目所有者批准并激活 Profile
>
> 适用范围：普通 MyTracer Txxx 的任务运行模式；不改变产品需求、任务范围或 Repository Safety Rules

## 1. 目的与定位

Automation Profile 描述一个已批准任务可以沿现有开发 Skill 连续推进的生命周期阶段，以及必须暂停等待项目所有者的节点。它用于减少重复确认，不是独立权限来源、权限计算系统、调度器或第二套执行流程。

```text
Approved Task Contract
  ↓
Automation Profile
  ↓
Repository Safety Rules
  ↓
Existing MyTracer Development Skill
```

- Task Contract 定义结果、范围、排除项、依赖、验证和任务特有约束。
- Automation Profile 定义现有 Skill 中可连续执行的阶段。
- Repository Safety Rules 定义 Profile 不能越过的人工 Gate。
- Existing Skill 继续定义 task gate、preflight、实现、验证、review、证据、Draft PR、docs closeout 和 merge handoff 的实际步骤。

## 2. 状态与启用边界

T092 定义 Profile registry、合同接入和基础 metadata 校验；T093 随后把 `standard-task@1` 接入现有 development Skill，并实现配套 PR/Workflow Gate。两项任务都不会：

- 向 T041 或其他任务发放自动化运行模式；
- 自动创建、激活、调度或开始任何任务。

Profile 只有在具体任务合同由项目所有者批准并激活 `execution.profile`，且 metadata、期限、task kind 和附加约束均适用时才能用于该任务。T093 的接入事实本身不向任何任务发放权限。

## 3. 通用规则

1. Task Contract 可以缩小 Profile，但不能扩大 Profile。
2. Repository Safety Rules 不能由合同、metadata 或 Profile override。
3. 高风险扩围必须退出普通 Profile，使用显式任务授权和必要的 Escalation Proposal。
4. 缺少 Profile、合同未激活、任务类型不匹配或有效期不成立时，使用现行显式逐项授权流程。
5. Metadata 和 validator 只能证明结构一致，不能证明真实 owner approval、实现正确或验收通过。

## 4. `standard-task@1`

### 4.1 适用任务

适用于同时满足以下条件的 `implementation` 或 `fix` Txxx：

- 已有项目所有者批准并激活的独立合同；
- 范围和 metadata 完整；
- 无新增或升级依赖；
- 无 schema/migration；
- 无 live Provider、AI Provider/权限变化或真实凭据；
- 无破坏性或不可逆数据操作；
- 无需求、验收语义、产品决定或主要架构变化；
- 无任务分支/Draft PR 维护之外的外部写入；
- 目标为本仓库确切任务分支到 `dev` 的 Draft PR。

governance、aggregate、milestone、hotfix、dependency、migration、AI Provider 和 release 任务默认不适用。

### 4.2 自动阶段

| 阶段 | 含义 |
|---|---|
| `local_development` | Task Gate 后执行 preflight、使用隔离环境、范围内实现和有意义 commit |
| `validation_execution` | 执行 targeted tests、affected regression、evidence capture、完整 diff 和独立 review |
| `task_branch_publish` | 推送合同指定任务分支并创建该分支到 `dev` 的 Draft PR |
| `draft_pr_maintenance` | 维护同一 Draft PR、读取 CI、推送范围内修复并执行 freshness refresh |
| `review_handoff` | 形成 Implementation Candidate、执行 candidate CI、提出 docs impact matrix 并暂停 |

任务分支 push、该分支到 `dev` 的 Draft PR 和同一 Draft PR 维护属于标准任务发布阶段。其他外部写入不属于 Profile。

### 4.3 Owner Gates

以下节点始终暂停并等待项目所有者：

- `docs_closeout_scope`
- `ready_for_review`
- `merge_dev`
- `merge_main`
- `tag`
- `release`
- `dependency_change`
- `migration_change`
- `non_task_publication_external_write`
- `ai_provider_or_permission_change`

Profile 不执行 force-push、远端分支删除、ruleset、Secrets、仓库权限、自动任务激活或自动下一任务。

### 4.4 Task Contract 声明

```yaml
execution:
  profile: standard-task@1
  activated_at: 2026-08-24T09:00:00+08:00
  valid_until: 2026-09-23T09:00:00+08:00
  additional_constraints: []
```

- 项目所有者批准并激活包含该声明的合同，即构成该任务使用 Profile 的授权。
- `valid_until` 必须晚于 `activated_at`，且跨度不得超过 30 天。
- Agent 在开始或恢复任务时检查实际有效期；validator 不因历史 `done` 任务自然过期而使未来 CI 失败。
- 没有 `execution.profile` 的历史和特殊任务继续使用当前显式权限机制。

允许的附加约束形式：

```yaml
additional_constraints:
  - type: disable_phase
    phase: task_branch_publish
  - type: pause_before
    phase: review_handoff
```

附加约束只能禁用阶段或增加暂停点，不能扩大 Profile 或解除 owner gate。

### 4.5 版本与扩展

`standard-task@1` 固定首个试点所需的最小阶段集合，并保留受控扩展空间：

- 向后兼容的可选阶段、约束或 task kind 必须通过获批准的 registry 修订加入；
- 改变既有阶段含义、削弱 owner gate、扩大高风险自动化或破坏兼容性时必须创建新的 Profile version；
- 新版本不会自动应用到既有任务；
- registry 变化不能替代独立任务合同和项目所有者激活。

## 5. Worktree 生命周期

Worktree 是 disposable 任务资源，不是长期证据存储。

```text
Task Start
  → 创建或确认专用隔离 workspace
Task Active
  → 在该 workspace 实现、验证和发布任务分支
Draft PR / Merge Handoff
  → 保持可恢复，不提前清理
PR Merged or Owner Released
  → 安全检查后释放 disposable worktree
```

清理前必须确认：

- 工作树干净；
- 没有唯一未推送 commit；
- 没有用户或其他任务变更；
- 没有仍需保留的本地 artifact。

TASK_INDEX 暂时显示 `done` 不能单独触发清理。Worktree cleanup 不删除远端分支；`node_modules`、构建产物、临时数据库和 `.tmp/evidence` 不作为长期证据。

本文件只定义生命周期；T093 未实施 Worktree cleanup，实际安全检查与清理步骤仍须由后续获批任务实现。

## 6. GitHub Workflow 关系

GitHub Actions 是 Repository Safety Gate，负责质量和流程验证，不负责解释 Profile 或控制 Agent 权限。T093 已实现 T092 定义的 change classification、统一 `CI Gate`、main milestone、Draft/Ready、concurrency、PR template 和 PR Quality；Workflow 仍不读取 Profile 来计算 Agent 权限或自动改变任务/PR 状态。

Workflow 优化不能改变以下 merge handoff：

```text
Implementation Candidate
  → owner-approved docs closeout
  → final-head CI
  → owner-controlled Ready
  → owner-approved merge
```

CI 结果是进入下一 Gate 的验证事实，不自动改变任务/PR 状态或触发 merge、tag、release。

## 7. 基础 Metadata 校验边界

T092 validator 只检查：

- registry JSON、Profile ID/version 和有限字段；
- task kind 与 Profile 适用范围；
- 时间格式、顺序和最长 30 天；
- 附加约束类型及其阶段引用；
- TASK_INDEX 的基本生命周期状态；
- 历史无 Profile sidecar 的兼容性。

Validator 不计算具体操作权限，不证明 owner approval，不调度任务，不创建 worktree，不触发 Workflow，也不修改 tracked 文件。

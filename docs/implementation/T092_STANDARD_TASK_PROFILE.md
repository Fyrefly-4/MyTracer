# T092 Standard Task Automation Profile 与 GitHub Workflow 优化方案任务合同

> 任务类型：流程治理 / 自动化运行模式与协作规范任务
>
> 合同状态：**done — Implementation Candidate、candidate CI、人工审核与 docs closeout 已通过**
>
> 项目所有者方案授权日期：2026-08-23
>
> 固定合同起草基线：`origin/dev@d00a0b3f6fad03bab17e83e7d68be14b03298aad`
>
> 预期分支：`docs/T092-standard-task-profile`

本合同把 V2 第四批的第一阶段重新定位为“普通任务自动化运行模式”，并定义 GitHub Workflow 的后续优化方向。T092 不建设 Agent 权限管理系统，不重写现有开发 Skill，也不在本任务内修改真实 GitHub Actions、ruleset 或 PR template。

项目所有者已于 2026-08-24 审核本合同并激活 T092 实施，并在 candidate CI 通过后精确批准 docs closeout 与治理设计 `MANUAL pass`；Ready 和 merge 仍未授权。

## 1. 任务信息

- **Task ID**：T092
- **Title**：Define the standard task automation profile and GitHub workflow optimization plan
- **Slice / Plan item**：GOV-04 / V2 Batch 4A
- **Status**：done
- **Base branch**：`dev`
- **Observed authorized base**：`origin/dev@d00a0b3f6fad03bab17e83e7d68be14b03298aad`
- **Expected branch**：`docs/T092-standard-task-profile`
- **Execution mode**：T092 自身继续使用现行显式合同权限；不得使用本任务拟定义的 Automation Profile 为自身授权。

## 2. 目标结果

仓库形成 `standard-task@1` 的最小、可理解、可机器检查定义，用于描述普通低风险 Txxx 的自动化执行边界：

- 减少同一任务生命周期中的重复人工确认；
- 让 Agent 在已批准合同范围内连续完成开发、验证、任务分支发布、Draft PR 维护和 review handoff；
- 把项目所有者注意力保留给真正需要决策的 docs closeout、Ready、merge、依赖、migration、外部写入和 AI 权限变化；
- 复用现有 `mytracer-stage-development` Skill 作为唯一任务执行流程，不建立第二套执行引擎；
- 定义 GitHub Actions 作为 Repository Safety Gate 的目标结构，降低不必要的完整 Electron CI 成本；
- 形成推荐的 Commit Convention，并明确 PR Template、PR Quality Check 和稳定统一 CI Gate 的协作目标；
- 只实现 Profile 定义、Task Contract 接入和基础 metadata 校验；实际 Skill 接入、Workflow YAML、PR template 和 GitHub 配置由后续独立任务完成。

T092 完成后，准确状态必须是：

> `standard-task@1` 和 GitHub Workflow 优化方案已定义，合同与 metadata 可以表达和校验该模式；Automation Profile 尚未接入 Agent Skill 或真实 GitHub Workflow，不能据此自动执行 T041 或其他任务。

## 3. 依据与授权边界

- **FR / AC / D**：无；本任务不改变产品需求、验收场景或产品决定。
- **ED / GW**：GW-001、GW-002、GW-004、GW-008、GW-009、GW-010；现行 `AGENTS.md` 的任务合同、证据、文档收口和 merge handoff 规则。
- **治理前置**：T090、T091、T804 均已完成并进入 `dev`；T031～T033/T803 已真实使用 V2 第一至第三批的 Draft/CI、freshness、escalation、metadata、evidence artifact 和 owner-confirm docs closeout。
- **项目所有者批准方向**：正式建立 T092；把 Profile 定位为普通任务自动化运行模式；同意每任务最长 30 天、基础 registry/metadata 校验、阶段能力、Worktree 生命周期和 GitHub Workflow 优化方向；允许 T092 任务分支、commit、push 和 Draft PR；2026-08-24 已另行批准精确 docs closeout 和治理设计 `MANUAL pass`。
- **提案输入**：`user/MYTRACER_V0.1_DEVELOPMENT_PROCESS_REVISION_V2.md` 及项目所有者对 T092 的后续修订方向；它们用于形成当前合同，不单独成为实现或验收权威。

### 3.1 References

```yaml
references:
  requirements: []
  decisions: []
  engineering_decisions: []
  stage_design: []
  architecture:
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  governance:
    - AGENTS.md
    - .agents/skills/mytracer-stage-development/SKILL.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/T090_AGENT_PROCESS_REVISION_V2.md
    - docs/implementation/T091_AGENT_PROCESS_AUTOMATION.md
    - docs/implementation/T804_DOCUMENT_FACT_CLOSEOUT.md
```

References 只是依据索引，不创建新的产品语义、自动化能力或 GitHub 权限。

## 4. 开始条件、依赖与 shared surface

以下开始条件在实施前已经确认；后续权限仍以本合同和项目所有者精确批准为边界。

- [x] T090 第一、二批规范已进入 `dev`。
- [x] T091 第三批工具与规则已进入 `dev`，并被多个真实任务使用。
- [x] T804 已完成事实漂移收口，当前基线为 `origin/dev@d00a0b3...`。
- [x] Automation Profile、最长有效期、基础 metadata 校验、Worktree 生命周期和 Workflow 优化方向已获方案批准。
- [x] T092 任务分支、commit、push 和 Draft PR 权限已明确；Ready、merge、tag、release 未授权。
- [x] 项目所有者审核本合同的准确文件范围、Profile schema、Workflow 目标结构、验收标准和验证命令，并于 2026-08-24 明确把 T092 激活为 `active`。
- [x] T092 实施前已重新读取最新授权 `origin/dev@d00a0b3f6fad03bab17e83e7d68be14b03298aad`；合同起草基线、远端 `dev` 与当前任务 HEAD 一致，初始 Integration Freshness 为 `fresh`。

```yaml
dependencies:
  tasks:
    requires:
      - T090
      - T091
      - T804
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@d00a0b3f6fad03bab17e83e7d68be14b03298aad
  shared_surfaces:
    - AGENTS.md
    - docs/implementation/AUTOMATION_PROFILES_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - tools/governance/validate-task-metadata.mjs
    - tests/unit/process-governance.test.ts
  external:
    - GitHub task-branch publication and Draft PR for T092 only
    - GitHub Actions redacted evidence artifact produced by the existing workflow
```

上述治理文件和校验器属于同一 shared surface，T092 串行修改，不与其他治理任务并行编辑。

## 5. 允许修改范围

项目所有者激活本合同后，允许新增或修改：

- `AGENTS.md`
- `docs/implementation/AUTOMATION_PROFILES_V0.1.md`
- `docs/implementation/profiles/standard-task-v1.json`
- `docs/implementation/GITHUB_WORKFLOW_V0.1.md`
- `docs/implementation/TASK_TEMPLATE.md`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/T092_STANDARD_TASK_PROFILE.md`
- `docs/implementation/metadata/T092.json`
- `tools/governance/validate-task-metadata.mjs`
- `tests/unit/process-governance.test.ts`
- T092 Draft PR 正文

合同已激活；实施修改必须保持在上述文件范围内，任何扩围都需先停止并重新取得批准。

## 6. 明确非范围

- 不修改 `docs/PRODUCT_REQUIREMENTS_V0.1.md`、`docs/DECISIONS.md` 或 `docs/REQUIREMENTS_CHANGE_POLICY.md`。
- 不修改 `user/` 说明文档、产品代码、Renderer/Main/Preload、数据库、schema、migration、导出或 AI Provider。
- 不新增或升级 npm 依赖，不修改 `package.json`、`package-lock.json` 或 `eslint.config.js`。
- 不修改 `.agents/skills/mytracer-stage-development/SKILL.md`；Skill 接入和 Worktree 实际清理由后续独立任务处理。
- 不修改、新增、重命名或拆分 `.github/workflows/*.yml`；不在本任务创建 PR template、PR Quality Check、Commit lint 或真实统一 CI Gate。
- 不修改 GitHub ruleset、branch protection、Actions Secrets、仓库权限、tag 或 release。
- 不实现 action-level permission、四层动态权限交集、Current Owner Grant 对象或权限解析器。
- 不向 T041 或其他任务启用 Profile，不创建 S4 设计或产品任务合同，不修改其 TASK_INDEX 状态。
- 不创建 Review/Audit Skill、Orchestrator、自动调度器或自动任务派发。
- 不标记 Draft PR 为 Ready，不合并 `dev`/`main`，不 force-push 或删除远端分支。

## 7. Automation Profile 模型

### 7.1 定位与规则顺序

```text
Approved Task Contract
  ↓
Automation Profile
  ↓
Repository Safety Rules
  ↓
Existing MyTracer Development Skill
```

- **Task Contract** 定义任务结果、文件范围、排除项、依赖、验证和任务特有约束。
- **Automation Profile** 定义现有 Skill 中哪些任务生命周期阶段可以连续推进，以及必须在哪些节点暂停。
- **Repository Safety Rules** 定义普通 Profile 永远不能越过的高风险人工 Gate。
- **Existing Skill** 继续是任务执行步骤的唯一来源；Profile 不复制或重写实现、验证、review、docs closeout 和 merge handoff 流程。

冲突规则：

1. Task Contract 可以缩小 Profile 的自动化阶段，但不能扩大 Profile。
2. Repository Safety Rules 始终优先，不能由合同、metadata 或 Profile override。
3. 需要扩大到高风险动作时，任务退出 `standard-task@1`，改用显式任务授权和必要的 Escalation Proposal。
4. 缺少 Profile、合同未激活、模式不适用或期限已过时，继续使用现行显式逐项授权流程，不推断自动化权限。

### 7.2 `standard-task@1` 阶段能力

```yaml
id: standard-task@1
applies_to:
  task_kinds:
    - implementation
    - fix
automatic_phases:
  - local_development
  - validation_execution
  - task_branch_publish
  - draft_pr_maintenance
  - review_handoff
owner_gates:
  - docs_closeout_scope
  - ready_for_review
  - merge_dev
  - merge_main
  - tag
  - release
  - dependency_change
  - migration_change
  - non_task_publication_external_write
  - ai_provider_or_permission_change
extension_points:
  compatibility: additive-within-v1
  breaking_changes: require-new-profile-version
```

阶段语义：

- `local_development`：Task Gate 通过后执行 preflight、建立或使用隔离环境、范围内实现和有意义 commit。
- `validation_execution`：执行 targeted tests、affected regression、evidence capture、完整 diff 检查和独立 review。
- `task_branch_publish`：推送合同指定的确切任务分支并创建该分支到 `dev` 的 Draft PR。
- `draft_pr_maintenance`：维护同一 Draft PR 正文、读取 CI、推送范围内修复，并按既有规则执行 freshness refresh。
- `review_handoff`：形成 Implementation Candidate、执行 required candidate CI、提出 docs impact matrix，然后停在 owner gate。

任务分支 push、该分支到 `dev` 的 Draft PR 和同一 Draft PR 维护属于 `task_branch_publish` / `draft_pr_maintenance`；其他外部写入属于人工 Gate。

`standard-task@1` 只固定首个试点所需的最小阶段集合，并保留受控扩展空间：未来可以通过经批准的 registry 修订增加向后兼容的可选阶段、约束或 task kind；任何改变既有阶段含义、削弱 owner gate、扩大高风险自动化或破坏兼容性的变化都必须建立新的 Profile version。扩展不会自动应用到既有任务，也不能替代独立任务合同和项目所有者激活。

### 7.3 适用条件

`standard-task@1` 只适用于同时满足以下条件的普通 implementation/fix Txxx：

- 已有项目所有者批准并激活的独立任务合同；
- 范围明确且 metadata 完整；
- 无新增或升级依赖；
- 无 schema/migration；
- 无 live Provider、Provider/AI 权限变化或真实凭据；
- 无破坏性或不可逆数据操作；
- 无需求、产品决定、验收语义或主要架构变化；
- 无任务分支/Draft PR 之外的外部写入；
- 目标为本仓库确切任务分支到 `dev` 的 Draft PR。

governance、aggregate、milestone、hotfix、dependency、migration、AI Provider、release 和其他高风险任务默认不适用。

### 7.4 Task Contract 接入

任务合同通过最小声明选择 Profile：

```yaml
execution:
  profile: standard-task@1
  activated_at: <RFC3339 timestamp>
  valid_until: <RFC3339 timestamp, no later than 30 days after activation>
  additional_constraints: []
```

- 项目所有者批准并激活包含该声明的任务合同，即构成该任务使用 Profile 的授权；不再生成独立 Current Owner Grant。
- `additional_constraints` 只能缩小自动化阶段或增加暂停点，不能解除 Repository Safety Gate。
- Profile 最长有效 30 天；Agent 在开始或恢复任务时检查是否仍有效。
- Validator 只检查时间格式、先后关系和跨度不超过 30 天，不因历史 `done` 任务自然过期而使未来 CI 失败。
- 没有 `execution.profile` 的历史和特殊任务继续使用当前显式权限机制。

## 8. Repository Safety Rules 与人工 Gate

以下动作不能由 `standard-task@1` 自动执行：

- 批准或执行 docs closeout 的准确文件和事实；
- 标记 Ready for review；
- merge 到 `dev`；
- 创建或 merge `dev -> main`；
- 创建 tag 或 release；
- 新增或升级 dependency；
- schema/migration change；
- 任务分支/Draft PR 维护之外的 external write；
- AI Provider、上下文、凭据、网络或写入权限变化；
- force-push、远端分支删除、ruleset、Secrets 或仓库权限变化；
- 自动创建、激活或开始下一个业务任务。

发现需要上述动作时，Agent 保留安全完成工作和实际证据，停止受影响阶段并请求项目所有者决定。

## 9. Worktree 生命周期

Worktree 是任务生命周期资源，不是独立权限或长期证据存储。

```text
Task Start
  → 创建或确认专用隔离环境
Task Active
  → 在该 Worktree 中实现、验证和发布任务分支
Draft PR / Merge Handoff
  → 保持 Worktree 可恢复，不提前清理
PR Merged or Owner Released
  → 通过安全检查后释放 disposable Worktree
```

规则：

- `local_development` 要求专用隔离 workspace；可以是已由 Codex 提供的隔离 worktree，也可以是按任务建立的 worktree。
- PR 未合并且 owner 未释放时，不因 TASK_INDEX 暂时显示 `done` 而自动删除 worktree。
- 清理前必须确认工作树干净、没有唯一未推送 commit、没有用户或其他任务变更、没有仍需保留的本地 artifact。
- Worktree 中的 `node_modules`、构建产物、临时数据库和 `.tmp/evidence` 不是长期证据。
- Worktree cleanup 不自动删除远端分支；远端分支清理由项目所有者或单独授权任务处理。
- 本任务只定义生命周期；实际 Skill 接入和安全清理步骤由后续任务实现。

## 10. GitHub Workflow 优化方案

本节全部内容是后续 Workflow/协作自动化的**设计目标**，不等于 T092 的实现范围。T092 只把目标、职责边界、兼容条件和后续接入门禁写入治理文档；真实 Workflow YAML、PR template、PR Quality Check、commit/PR-title 检查、统一 CI Gate 和 ruleset 变更仍由后续独立任务实现并验证。

### 10.1 Workflow 定位

GitHub Actions 是 Repository Safety Gate：

- 负责可重复质量验证、metadata/governance 一致性、PR 上下文检查和里程碑验证；
- 不负责解释 Task Contract、计算 Agent 权限或授权任何操作；
- 不执行自动 merge、tag、release、任务激活或 Agent 权限解析。
- 不改变现有 merge handoff 语义：Implementation Candidate、owner-approved docs closeout、final-head CI、Ready 和 owner-approved merge 的顺序及责任边界继续适用；Workflow 结果只是进入下一 Gate 的验证事实，不触发状态转换或合并动作。

### 10.2 Change Classification 与 CI 分层

后续 Workflow 实现应把 PR/commit 按变更面分类，并采用最高风险类别：

| 类别 | 典型范围 | 默认验证 |
|---|---|---|
| Source Change | `src/**`、`tests/**`、构建/包配置、依赖、工具脚本、Workflow YAML | 完整 verification，包括 build、unit、integration、Electron E2E 和任务要求的附加检查 |
| Governance Change | AGENTS、Task/Stage 模板、metadata/profile JSON、治理规范 Markdown | metadata、governance、format/diff integrity；治理工具或测试代码变化同时按 Source Change |
| Documentation Only | 不改变治理规则、稳定命令或产品语义的普通说明文档 | 轻量 format、链接/结构和 diff integrity 检查 |

混合变更执行其中最高等级；路径分类只是调度输入，不能用来跳过合同明确要求的验证。

### 10.3 分支与里程碑验证

- `dev` 保持持续集成验证，证明任务进入当前集成线后的仓库状态。
- 增加面向 `main` 和 `dev -> main` PR 的 milestone 验证，执行里程碑要求的完整回归、Windows build/package、必要 smoke 和证据检查。
- milestone workflow 只验证，不自动 merge、tag、release 或修改 release 状态。
- main 验证结果不能替代项目所有者人工验收或发布批准。

### 10.4 目标 Workflow 结构

后续独立任务评估并实现：

```text
CI Router / Change Classifier
  ├─ verification：代码、测试、构建与 Electron 验证
  ├─ governance：metadata、Profile 与治理一致性检查
  ├─ documentation：纯文档轻量检查
  └─ milestone：dev -> main 与 main 集成验证
          ↓
       CI Gate
```

- `CI Gate` 是始终报告的稳定终端 check；ruleset 只绑定该稳定 context，避免绑定内部 job 名称。
- 内部 workflow/job 可以演进，但不能因路径过滤导致 required `CI Gate` 永久 pending。
- 本任务只定义目标结构；不改当前 `Verification / Windows required gate`，不修改 ruleset。

### 10.5 Draft / Ready 分级

- Draft PR 默认提供与变更类别相符的快速反馈。
- Ready PR 自动执行该类别要求的完整验证。
- 现有流程要求在 Ready 前完成 Implementation Candidate、docs closeout 和 final-head CI，因此后续实现必须为 Draft candidate/final-head 提供显式 full-CI 入口，例如受控手动触发或等价的稳定机制。
- 不得为了获得完整 CI 而让 Agent 自动标记 Ready；Ready 继续是人工 Gate。
- early、candidate、final-head、post-merge 和 milestone CI 的证据分类继续保持区别。

### 10.6 Concurrency 与最小权限

后续 Workflow 应：

- 按 PR number 或 branch/ref 建立 concurrency group；
- `cancel-in-progress: true`，取消同一分支/PR 已被新 revision 取代的旧 CI；
- 默认 `permissions: contents: read`；仅在某个只读检查确有需要时增加最小 read 权限；
- 不授予 `contents: write`、自动 merge、release、tag、deployment 或 Agent 权限相关写权限。

## 11. Commit、PR 与协作规范

### 11.1 推荐 Commit Convention

T092 推荐后续任务提交和 task PR squash 标题优先采用：

```text
<type>(Txxx): description
```

建议有限 `type`：

- `feat`
- `fix`
- `test`
- `docs`
- `refactor`
- `chore`
- `build`
- `ci`

示例：

```text
feat(T041): add recovery context query
test(T041): cover recovery context date boundaries
docs(T092): define standard task automation
```

- description 使用简洁英文祈使语气。
- 本约定是提高历史可读性和自动检查兼容性的推荐规范，不作为 T092 中的强制失败条件；后续若要把它升级为 required check，必须由独立任务定义例外、迁移方式和失败语义并获得批准。
- 规则从正式启用后向前适用，不重写历史 commits。
- GitHub 自动生成的里程碑 merge commit 不强制改写为 task convention。
- 实际 commit lint 或 PR title 自动检查由后续 Workflow 任务实现。

### 11.2 PR Template

后续实际 PR template 至少包含：

- Task
- Summary
- Validation
- Evidence
- Risk

可以引用合同中的 Scope/Exclusions/Dependencies，但不在多个长期文档复制实时 PR 状态。

### 11.3 PR Quality Check

后续自动检查只验证必要上下文是否存在，例如：

- 合法 Task ID；
- Summary 非空；
- Validation 列出实际命令或明确 pending；
- Evidence 有 ID/artifact/CI 或明确说明尚未生成；
- Risk 明确列出风险或写明无已知风险。

Draft 阶段可以提供快速反馈；Ready 阶段缺少必要上下文应使 `CI Gate` 失败。该检查不判断实现正确性，不替代完整 diff review、独立 review、CI、人工体验或 owner merge 决策。

## 12. 基础 Metadata / Validator 范围

T092 只扩展基础结构校验：

- Profile registry JSON 格式合法；
- `execution.profile` 引用的 Profile ID/version 存在；
- task kind 与 Profile `applies_to.task_kinds` 匹配；
- `activated_at`、`valid_until` 格式和顺序合法，跨度不超过 30 天；
- `additional_constraints` 只能使用 registry 允许的基础约束形式；
- TASK_INDEX 中的基本生命周期状态与 Profile 声明不构成明显结构冲突；
- 历史无 Profile metadata 保持兼容；
- Validator 不修改 TASK_INDEX、Evidence、合同、registry 或其他 tracked 文件。

Validator 不负责：

- 动态计算 Agent 权限；
- 判断某个 shell/Git/GitHub 操作是否允许；
- 证明 `approved_by` 或聊天授权真实性；
- 调度任务、创建 worktree、触发 Workflow 或更新 PR；
- 把结构合法解释为任务已获批准或验收通过。

更深入的 Skill/Workflow 生命周期检查由后续接入任务决定，不在 T092 建设权限解析器。

## 13. T092 自身的执行权限

T092 使用项目所有者已明确授予的现行显式权限：

```yaml
permissions:
  local_write: true
  create_worktree: false
  create_task_branch: true
  create_commit: true
  push_task_branch: true
  create_or_update_draft_pr: true
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: true
```

- `external_write: true` 仅指推送 `docs/T092-standard-task-profile`、创建/更新该分支到 `dev` 的 Draft PR、读取其 CI，以及现有 workflow 上传脱敏 artifact。
- 不允许其他外部写入、Ready、merge、tag、release、ruleset、Secrets、Workflow 配置写入或远端分支删除。
- T092 已获准创建范围内 commit、推送确切任务分支并维护该分支到 `dev` 的 Draft PR。
- candidate hosted CI 通过后，项目所有者已于 2026-08-24 精确批准本合同、TASK_INDEX、`EV-T092-001`、Draft PR 正文以及独立 closeout commit/push；该授权不包含 Ready 或 merge。

## 14. 交付物

- [x] `AUTOMATION_PROFILES_V0.1.md`：Profile 定位、阶段能力、人工 Gate、适用条件、Task Contract 接入和 Worktree 生命周期。
- [x] `standard-task-v1.json`：机器可读的 task kinds、automatic phases、owner gates 和基础生命周期字段。
- [x] AGENTS 对 Automation Profile“定义任务执行模式、不构成权限系统”的最小权威说明。
- [x] TASK_TEMPLATE 的可选 `execution.profile`、有效期和附加限制字段，同时保留无 Profile 任务的现行显式模式。
- [x] GITHUB_WORKFLOW 文档中的 Repository Safety Gate、change classification、目标 Workflow 结构、统一 CI Gate、main milestone、Draft/Ready、concurrency、推荐 Commit Convention 和 PR 协作规范；全部明确为设计目标而非本任务的 Workflow 实现。
- [x] metadata validator 的基础 Profile/schema/lifecycle 检查和向后兼容。
- [x] 对应 unit tests。
- [x] T092 metadata、任务状态和真实验收证据已按获批 docs closeout 收口。

## 15. 验收标准

1. Profile 被一致定义为现有 Skill 的自动化运行模式，不是独立权限来源、权限计算系统或第二套任务执行流程。
2. Task Contract → Automation Profile → Repository Safety Rules 的职责边界和冲突规则明确，Repository Safety Gate 不可 override。
3. `standard-task@1` 使用 §7.2 的五个阶段能力，且在 docs closeout、Ready、merge、main、tag、release、dependency、migration、非任务发布外部写入和 AI 权限变化前停止。
4. `standard-task@1` 保留版本化扩展点；向后兼容扩展和 breaking change 的边界明确，任何扩展都不能静默削弱 owner gate 或自动作用于既有任务。
5. Task Contract 只需最小 Profile 声明和可选额外约束，不创建 Current Owner Grant 或 action permission matrix。
6. 有效期不超过 30 天；历史已完成任务自然过期不会破坏未来全仓 CI。
7. Worktree 被定义为 disposable 生命周期资源；未 merge/未释放、有未推送或用户变更时不得清理，且不作为长期证据。
8. GitHub Actions 被定义为 Repository Safety Gate，不解释或控制 Agent 权限。
9. Workflow 分层、统一 CI Gate、main milestone、Draft/Ready 和 concurrency 均明确为后续设计目标，不被误记为 T092 已实现范围。
10. Source/Governance/Documentation 分类、混合变更最高等级规则和治理工具变化按 Source 执行的规则明确。
11. dev 持续集成、main milestone 验证和不自动 merge/release 的边界明确。
12. verification/governance/documentation/milestone 与稳定统一 `CI Gate` 的目标结构明确，且规避 path-filter pending 风险。
13. Draft 快速、Ready 完整与既有 candidate/final-head-before-Ready 流程能够共存；Ready 不被自动设置。
14. Workflow 优化不改变既有 merge handoff 顺序、owner gate 或责任边界；CI 结果不自动转换任务/PR 状态或触发 merge。
15. concurrency、取消旧 CI 和最小只读权限原则明确。
16. Commit Convention 被定义为推荐规范；PR Template 和 PR Quality Check 的目标明确，自动检查不替代人工 Review。
17. Validator 只做 Profile 存在、schema、task kind、期限和基础生命周期校验，不计算或授权具体操作。
18. T092 完整 diff 不包含 Skill、Workflow YAML、PR template、产品代码、依赖、lockfile、schema、migration、AI Provider 或 GitHub 配置变化。
19. T092 完成记录明确：方案已定义但尚未接入，未向 T041 或其他任务启用 Profile。
20. `MANUAL`：项目所有者已于 2026-08-24 审核 Profile 阶段、Repository Safety Gates、Worktree 生命周期、Workflow 目标结构、Commit/PR 规范和验证结果，并在 candidate CI 通过后批准准确 docs closeout 范围；结果为 `pass`。

## 16. 验证计划

### 16.1 针对性验证

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/process-governance.test.ts
```

使用临时 metadata/profile 目录验证：合法 Profile、历史 sidecar 兼容、未知 Profile、task kind 不匹配、时间格式/顺序错误、超过 30 天、非法约束、非法生命周期状态和 Validator 只读性。

### 16.2 受影响范围回归

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run verify
git diff --check
```

由于 T092 修改 standing governance、Validator 和 unit tests，执行完整 `verify`。不运行 package、NSIS、migration、产品人工验收或 live AI。

### 16.3 Deterministic evidence capture

```powershell
node tools/evidence/capture-command.mjs --task T092 --gate task-candidate --base-revision <latest-authorized-dev-sha> --output .tmp/evidence -- npm.cmd run verify
```

Artifact 只记录真实事实，不自动通过验收，不包含 stdout/stderr、原始环境变量、凭据、绝对用户路径或用户数据。

### 16.4 Hosted CI 与 review

- 第一个有意义 commit 后可按授权创建 Draft PR并取得现有 early hosted CI。
- Implementation Candidate 必须完成完整 diff、自查、独立 review、Integration Freshness Gate 和 affected regression。
- 本任务仍使用当前真实 `Verification / Windows required gate`；不得把尚未实现的统一 `CI Gate` 写成已运行证据。
- candidate hosted CI 通过后暂停，提出精确 docs impact matrix，等待项目所有者批准。
- 获批 closeout commit 形成新的 PR head，必须等待 final-head required CI。

## 17. Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@d00a0b3f6fad03bab17e83e7d68be14b03298aad
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: 9c7d9d3ae08dc7b32e9895deed1e43d26ca58985
  dev_integration_revision: null
  stage_final_integration_revision: null
```

- T092 开始实施、形成 candidate 和 merge handoff 前都要比较最新授权 `origin/dev`。
- 若基线推进，使用普通可追踪 merge 刷新，不 force-push；重新运行 affected regression，并在 review surface 改变时重新 review。
- T092 合入 `dev` 之前，`standard-task@1` 不可用于任何任务。
- T092 合入 `dev` 只表示定义和基础校验可用，不表示 Skill/Workflow 已接入，也不自动激活 T041。

Implementation Candidate 与 task delivery revision 为 `9c7d9d3ae08dc7b32e9895deed1e43d26ca58985`，基于 `origin/dev@d00a0b3f6fad03bab17e83e7d68be14b03298aad`，Integration Freshness 为 `fresh`。Draft PR #32 的 early run `32650840212` 在首个有意义提交 `c981360...` 上通过；candidate run `32651915890` / job `97224750936` 的 `Windows required gate` 在精确 head `9c7d9d3...` 上通过。

Candidate CI artifact `9496461131` / `verification-evidence-32651915890` 的 digest 为 `sha256:5ccf6bd54128f64edc4dcf8e6da763a60cdece067e8c8f6dafe7301cd763ae95`；其中 `npm.cmd run verify` exit 0，`ci.headRevision=9c7d9d3...`，`ci.mergeRevision=d76626f...`。本地共享 checkout 的 aggregate `verify` 只因未跟踪、未修改的 `.agents.backup/` 中一个 YAML 命中 Prettier 而 exit 1；失败 artifact 保留，T092 tracked 文件的 scoped Prettier、其余分层验证和 clean hosted candidate CI 均通过。

项目所有者于 2026-08-24 批准 docs closeout 和治理设计 `MANUAL pass`。Closeout push 后的 final-head CI 与 Draft PR 最新状态属于后续 GitHub 集成事实，不预先写入本合同，也不再制造仓库提交只为记录该 run；`dev_integration_revision` 和 `stage_final_integration_revision` 在尚未合并时保持 `null`。

## 18. 后续独立任务边界

T092 完成后至少仍需一个独立接入任务，另行建立合同和权限：

### Agent Skill / Worktree Integration

- 在现有 Skill 的 Task Gate 增加 Profile 读取和适用性检查；
- 把五个阶段能力映射到 Skill 已有章节，不重写任务流程；
- 加入启动/恢复时的有效期检查；
- 实现 owner release 后的安全 Worktree cleanup；
- 保留 docs closeout、Ready、merge 和下一任务 Gate。

### GitHub Workflow / Collaboration Integration

- 实现 change classifier、verification/governance/documentation/milestone 和统一 CI Gate；
- 为 `main` / `dev -> main` 增加 milestone 验证；
- 实现 Draft/Ready 分层和 Draft full-CI 入口；
- 增加 concurrency、PR template、PR Quality Check 和可选 commit/PR-title 检查；
- 更新 ruleset 前必须单独验证新 `CI Gate` 稳定报告，并获得外部配置写入授权。

上述任务可以在评审后决定合并或拆分，但都不由 T092 自动创建或激活。完成实际接入后，才可另行选择 T041 作为首个真实 Profile 试点。

## 19. 文档收口结果与后续 owner gate

项目所有者于 2026-08-24 在 candidate hosted CI 通过后精确批准：

- 更新本合同、`TASK_INDEX_V0.1.md` 和 `ACCEPTANCE_EVIDENCE_V0.1.md`；
- 新增 `EV-T092-001`，把 T092 账本状态更新为 `done`；
- 将治理设计人工审核记录为 `MANUAL pass`；
- 更新 T092 Draft PR 正文；
- 创建并推送独立 `docs(T092): close task delivery records` 提交。

`README.md` 与 `user/MYTRACER_V0.1_DEVELOPMENT_PROCESS_REVISION_V2.md` 经 impact matrix 评估无需修改；Profile 尚未接入 Skill 或任何真实任务，Workflow YAML、PR template、PR Quality Check、统一 CI Gate 和 ruleset 也尚未实现。

Closeout 提交后必须等待 final-head required CI。Draft PR 保持 Draft；Ready、merge、tag、release、下一任务和任何实际接入仍是独立 owner gate。

## 20. 风险与停止条件

出现以下任一情况时停止受影响工作并提交 Escalation Proposal：

- Profile 需要复制或重写现有 Skill 的任务步骤；
- 需要重新引入 action permission、动态权限交集、Current Owner Grant 或权限解析器；
- Task Contract、Profile 和 Repository Safety Rules 无法保持单一职责或明确优先顺序；
- Source/Governance/Documentation 分类可能跳过合同要求的验证，或统一 CI Gate 可能因路径过滤不报告；
- Draft/Ready 分级要求 Agent 提前 Ready，或破坏 candidate/final-head CI 证据链；
- Worktree cleanup 可能删除未推送、用户或其他任务数据；
- Validator 需要判断真实 owner 授权或具体操作权限；
- 需要修改 Skill、Workflow YAML、ruleset、Secrets、PR template、依赖、lockfile、产品代码、schema、migration、AI Provider 或其他非范围文件；
- 需要为 T041 或其他任务创建 Profile 声明、合同、分支或状态；
- 最新 `origin/dev` 无法获取、freshness 无法证明或刷新冲突无法安全解决；
- docs closeout、Ready、merge、tag、release 或下一任务缺少精确 owner 授权。

## 21. 完成报告

最终报告必须列出：

- 新增或修改文件，以及 Automation Profile/Workflow 方案的可观察结果；
- 没有产品 FR/AC/D 变化的结论；
- `standard-task@1` 阶段能力、适用条件、人工 Gate、最长有效期和 Worktree 生命周期；
- GitHub Repository Safety Gate、CI 分类、目标 Workflow 结构、Draft/Ready、main milestone、concurrency 和最小权限原则；
- Commit Convention、PR Template 和 PR Quality Check 规范；
- Validator 能证明与不能证明的边界；
- 实际命令、exit code、环境和 artifact；
- branch、commits、PR、early/candidate/final-head CI 和 revisions；
- T092 docs closeout 和人工审核状态；
- Skill、真实 Workflow、ruleset、PR template 和 Profile 试点均尚未实施的限制；
- 残余风险、已知缺口、未验证内容，以及是否发现需求冲突或范围变化。

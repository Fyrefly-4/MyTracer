# T093 Profile、项目 Skills 与 CI Gate 串行集成任务合同

> 任务类型：流程治理 / Skill 与 GitHub 协作自动化集成
>
> 合同状态：**active — 项目所有者已批准并激活；当前仅完成合同建立，实施尚未开始**
>
> 项目所有者方案与权限批准日期：2026-08-24
>
> 固定启动基线：`origin/dev@7f5e2edad62312ca3b79afb7684c64699d4ec8e5`
>
> 预期分支：`task/T093-governance-integration`

本合同在一个 T093 内串行完成 `standard-task@1` Skill 接入、两项项目生命周期 Skill、GitHub Workflow/PR 自动化、双 Gate 验证和 ruleset required-context 切换。T093 不拆分或自动创建其他 Txxx，不实施 Worktree 安全释放，也不启动 T041。

## 1. 任务信息

- **Task ID**：T093
- **Title**：Integrate MyTracer execution profiles, lifecycle Skills, and repository CI gates
- **Slice / Plan item**：GOV-05 / V2 Profile and repository automation integration
- **Status**：active
- **Base branch**：`dev`
- **Observed authorized base**：`origin/dev@7f5e2edad62312ca3b79afb7684c64699d4ec8e5`
- **Expected branch**：`task/T093-governance-integration`
- **Execution mode**：T093 是 governance 任务，使用本合同的显式权限；不得使用 `standard-task@1` 为自身授权。
- **Task relationship**：T093 完成前不创建或启动 T041；T041 保持 `pending`。

## 2. 目标结果

T093 完成后，仓库应具备以下真实、可验证状态：

1. `standard-task@1` 已接入现有 `mytracer-stage-development` Skill，且只控制现有步骤能否连续推进，不成为权限系统、调度器或第二套执行流程。
2. Profile 在任务启动、恢复、阶段切换、owner gate 返回和外部写入前执行适用性与有效期检查。
3. 新增 `mytracer-stage-design` Skill，用于批准范围内的阶段架构设计和任务图，不自动建立或启动实施任务。
4. 新增 `mytracer-stage-acceptance-release` Skill，用于阶段聚合验收和发布交接，不自动修复、Ready、merge、tag 或 release。
5. 现有 GitHub Workflow 实现 change classification、PR Quality、分层验证、milestone 验证、concurrency 和始终报告的 `CI Gate`。
6. 迁移期同时保留 `CI Gate` 和 `Windows required gate`，使 ruleset 可安全切换和回滚。
7. `Dev-Rule` 和 `Main-Rule` 在候选门禁满足后只把 required context 从 `Windows required gate` 切换为 `CI Gate`，其他规则保持不变。
8. 最终文档、Task Index、Evidence、PR body、真实 Actions 和实时 ruleset 配置一致。
9. 不创建额外 Txxx，不实施 Worktree cleanup，不启动 T041。

T093 不是产品任务，不改变任何 FR、AC、D 或用户可见产品语义。

## 3. 依据与权威边界

- **FR / AC / D**：无；本任务不改变产品需求、验收场景或产品决定。
- **ED / GW**：GW-001、GW-002、GW-004、GW-005、GW-006、GW-008、GW-009、GW-010。
- **治理前置**：T090、T091、T092、T804 已完成并进入 `dev`；T092 已由 PR #32 合入最新 `origin/dev@7f5e2ed...`。
- **项目所有者授权**：已批准建立并激活 T093、修改现有 development Skill、新增两项项目 Skill、实现 Workflow/PR 自动化、执行 T093 分支/commit/push/Draft PR、请求 full/milestone CI、读取 GitHub 状态，以及在本合同固定 Gate 满足后执行精确 ruleset required-context 切换和必要回滚。
- **保留 owner gates**：docs closeout 的最终准确事实、Ready、merge、`dev -> main`、tag 和 release 仍须到达对应节点后由项目所有者决定。

### 3.1 References

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
  engineering_decisions: []
  stage_design:
    - file: docs/architecture/STAGE_DESIGN_TEMPLATE.md
      sections: ["§1-§7"]
  architecture:
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  governance:
    - AGENTS.md
    - .agents/skills/mytracer-stage-development/SKILL.md
    - docs/implementation/AUTOMATION_PROFILES_V0.1.md
    - docs/implementation/profiles/standard-task-v1.json
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/T090_AGENT_PROCESS_REVISION_V2.md
    - docs/implementation/T091_AGENT_PROCESS_AUTOMATION.md
    - docs/implementation/T092_STANDARD_TASK_PROFILE.md
```

References 只是依据索引，不创建新的产品语义、权限或验收事实。

## 4. 开始条件、依赖与 shared surface

- [x] 项目所有者已批准并激活本合同方向和权限。
- [x] 最新远端 `origin/dev` 已通过只读 `git ls-remote` 核实为 `7f5e2edad62312ca3b79afb7684c64699d4ec8e5`。
- [x] T092 的集成事实来自远端 branch revision 和 Git history，不来自 Draft PR 或任务状态推断。
- [x] T093 不新增或升级 npm 依赖。
- [x] T093 不使用 Automation Profile 为自身授权。
- [x] T041 保持 `pending`，不创建其合同、metadata、分支或实现。
- [ ] 创建确切 T093 任务分支前再次确认当前 checkout、用户变更和最新授权 `dev`。
- [ ] 修改 ruleset 前取得实际 candidate CI、完整 diff review 和实时配置 before snapshot。

```yaml
dependencies:
  tasks:
    requires:
      - T092
    blocks:
      - T041
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@7f5e2edad62312ca3b79afb7684c64699d4ec8e5
  shared_surfaces:
    - AGENTS.md
    - .agents/skills/**
    - docs/implementation/AUTOMATION_PROFILES_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/profiles/**
    - docs/implementation/metadata/**
    - .github/workflows/verify.yml
    - .github/pull_request_template.md
    - tools/ci/**
    - tools/governance/**
    - tests/unit/process-governance.test.ts
    - package.json
  external:
    - GitHub task branch and Draft PR for T093
    - GitHub Actions full and milestone validation for T093
    - Dev-Rule required status context update
    - Main-Rule required status context update
```

这些文件和外部配置属于同一高风险治理 shared surface。T093 必须串行执行，不与其他 governance、Skill、Workflow 或 ruleset 任务并行。

## 5. 串行实施阶段

T093 只使用一个任务身份、任务分支和 Draft PR，按以下顺序推进：

```text
Contract and Task Gate
  → Phase A: development Profile integration
  → Phase B: Stage Design Skill
  → Phase C: Stage Acceptance & Release Skill
  → Phase D: classifier, PR Quality and layered CI
  → complete diff review and independent review
  → hosted full and forced milestone candidate CI
  → Phase E: owner-authorized ruleset context cutover
  → exact ruleset verification and rollback check
  → owner-confirmed docs closeout
  → final-head dual-gate CI
  → owner-controlled Ready and merge
  → post-merge dev CI verification
```

每个阶段完成后先检查该阶段 diff、针对性测试和停止条件，再进入下一阶段。阶段完成不改变 T093 的 Task ID，也不自动创建后续任务。

## 6. 允许修改范围

### 6.1 Skills 与治理

- `AGENTS.md`
- `.agents/skills/mytracer-stage-development/SKILL.md`
- `.agents/skills/mytracer-stage-development/agents/openai.yaml`
- `.agents/skills/mytracer-stage-design/SKILL.md`
- `.agents/skills/mytracer-stage-design/agents/openai.yaml`
- `.agents/skills/mytracer-stage-acceptance-release/SKILL.md`
- `.agents/skills/mytracer-stage-acceptance-release/agents/openai.yaml`
- `docs/implementation/AUTOMATION_PROFILES_V0.1.md`
- `docs/implementation/profiles/standard-task-v1.json`，仅在现有 v1 additive compatibility 范围内确有必要时
- `docs/implementation/TASK_TEMPLATE.md`
- `docs/implementation/GITHUB_WORKFLOW_V0.1.md`
- `docs/architecture/STAGE_DESIGN_TEMPLATE.md`，仅为新 Stage Design Skill 所需的兼容澄清

### 6.2 Workflow、PR 与验证工具

- `.github/workflows/verify.yml`
- `.github/pull_request_template.md`
- `tools/ci/classify-changes.mjs`
- `tools/governance/validate-pr-context.mjs`
- `tools/governance/validate-task-metadata.mjs`，仅在 T093 验收发现现有 Profile 结构校验确有兼容缺口时
- `tests/unit/process-governance.test.ts`
- 可新增一个聚焦的 `tests/unit/*ci*governance*.test.ts` 文件
- `package.json`，仅增加或调整本任务所需的稳定治理命令

### 6.3 T093 状态与证据

- `docs/implementation/T093_PROFILE_SKILLS_CI_INTEGRATION.md`
- `docs/implementation/metadata/T093.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `README.md`，仅在 durable Skill/CI 使用入口需要时
- T093 Draft PR body

### 6.4 外部配置

- GitHub ruleset `Dev-Rule`，ID `20582011`，仅修改 required status context。
- GitHub ruleset `Main-Rule`，ID `20582061`，仅修改 required status context。

任何不在上述范围内的文件或配置都必须先停止并获得新的项目所有者决定。

## 7. 明确非范围

- 不实施 Worktree 安全释放、自动清理、`git worktree remove`、`git worktree prune` 或目录删除。
- 不删除或主动清理本地/远端任务分支。
- 不修改 `docs/PRODUCT_REQUIREMENTS_V0.1.md`、`docs/DECISIONS.md` 或 `docs/REQUIREMENTS_CHANGE_POLICY.md`。
- 不修改产品代码、Renderer、Preload、Main、Domain、Application、SQLite、export 或用户可见行为。
- 不新增或升级 npm 依赖，不修改 `package-lock.json`。
- 不修改 schema 或 migration，不访问真实用户数据或真实 Provider。
- 不修改 AI Provider、模型、凭据、上下文或写入权限。
- 不创建 Secrets、deployment、environment、GitHub App 或 `pull_request_target` workflow。
- 不实现通用权限解析器、Current Owner Grant、任务调度器或自动任务派发。
- 不自动创建 T094、T095 或任何其他 Txxx。
- 不创建、激活或启动 T041；不修改 T041 的合同、metadata、分支或 `pending` 状态。
- 不标记 Ready，不 merge `dev`/`main`，不创建 tag 或 release。
- 不 force-push，不关闭或删除无关 PR，不弱化 branch protection 或 ruleset。
- 不在 T093 内顺手修复产品缺陷；发现缺陷时停止受影响阶段并使用 Escalation Proposal。

## 8. 必须保持的不变量

- Task Contract 是范围和权限上限；Profile 只能缩小或连续执行，不能扩大。
- Repository Safety Rules 不能由 Profile、metadata、PR body、Workflow 或 ruleset helper override。
- 现有 development Skill 继续是单任务实现流程的唯一来源。
- 新 Stage Skills 不创建产品语义，也不把设计或验收当作实施授权。
- `TASK_INDEX_V0.1.md` 继续是唯一任务状态账本。
- Evidence 只记录真实 command、revision、CI、artifact 和限制。
- `verify` 对 tracked source/documentation 保持只读。
- Workflow 不解释 owner approval、不计算 Agent 权限、不修改长期文档。
- Required workflow 必须始终报告终端 Gate，不能因 path filter 或 skipped dependency 永久 Pending。
- Windows 继续是产品完整验证和 milestone package/smoke 的必要环境。
- `CI Gate` 只汇总确定性检查，不自动 Ready、merge、tag 或 release。
- 旧 `Windows required gate` 在 T093 中保留，作为迁移兼容与精确回滚目标。
- Dev/Main ruleset 除 required context 外的 strict policy、PR、讨论、删除、non-fast-forward 和 bypass 设置保持不变。
- T041 和任何下一任务都不自动开始。

## 9. Phase A：`standard-task@1` 接入 development Skill

### 9.1 权威顺序

Skill 必须按以下保守交集执行：

```text
Approved Task Contract scope and permissions
  ∩ valid and applicable Automation Profile
  ∩ Repository Safety Rules
  → existing development Skill phases
```

- `permissions` 是硬上限，false 或缺失的动作不得由 Profile 扩大。
- Profile 只减少有效期内、适用任务中的重复确认。
- 无 Profile 的历史或特殊任务继续使用显式权限机制。
- Profile 过期后，新的写操作和外部写入必须回到显式 owner 授权流程；初始权限字段不得被解释为无限期 Profile continuation。
- 不建立独立 action permission matrix 或通用权限解析器。

### 9.2 启动、恢复与有效期

- 有效区间固定为 `activated_at <= now < valid_until`。
- 在任务启动、会话恢复、阶段切换、owner gate 返回和外部写入前重新检查。
- `ready` 可以从 Task Gate 开始；`active` 从实际安全恢复点继续；`review` 只允许 Candidate/PR maintenance/handoff；`done` 不执行开发阶段。
- 合同与 metadata sidecar 的 Profile、时间和 constraints 必须一致；不一致时停止而不是猜测。
- `disable_phase` 禁用自动阶段；`pause_before` 在阶段前增加暂停。
- 发现 dependency、migration、产品语义、主要架构、AI Provider/权限或非任务外部写入时退出普通 Profile并停止受影响工作。

### 9.3 五阶段映射

| Profile phase | Existing Skill mapping | Required stop or handoff |
|---|---|---|
| `local_development` | Task Gate、preflight、范围内实现、有意义 commits | 本地实现候选或停止条件 |
| `validation_execution` | targeted tests、affected regression、evidence、完整 diff、独立 review | 验证候选 |
| `task_branch_publish` | push 确切任务分支、创建到 `dev` 的 Draft PR | Draft PR 已建立 |
| `draft_pr_maintenance` | 读取 CI、范围内修复、freshness refresh、维护同一 PR | Implementation Candidate |
| `review_handoff` | candidate CI、Candidate 确认、docs impact matrix | `docs_closeout_scope` owner gate |

### 9.4 保留 owner gates

以下节点始终暂停：

- 最终 docs closeout 的准确文件和事实；
- Ready for review；
- merge 到 `dev`；
- 创建或 merge `dev -> main`；
- tag、release；
- dependency、migration；
- AI Provider/权限变化；
- 非任务发布外部写入；
- 自动创建或开始下一任务。

## 10. Phase B：`mytracer-stage-design` Skill

新增 Skill 应复用 `STAGE_DESIGN_TEMPLATE.md`，完成：

- 确认 owner 授权的 Stage ID、设计范围和 prior behavior revision；
- 读取冻结 PRD、Decisions、Requirement Change Policy 和最小相关架构；
- 建立 baseline manifest 和 stage delta；
- 描述用户/系统可观察结果与明确非范围；
- 设计 Domain/Application/IPC/SQLite/Renderer/AI 受影响边界；
- 分析历史事实、兼容性、migration、数据和测试风险；
- 输出任务依赖、shared surfaces、串并行建议和 integration policy；
- 定义阶段自动化、连续 E2E、Windows/package、人工验收和阶段 Gate；
- 在需求冲突或权限扩围时停止并提出 Escalation Proposal。

该 Skill 不得：

- 改变 FR/AC/D 或延期范围；
- 把阶段设计当作批量任务实施授权；
- 自动创建、激活或启动任务合同；
- 自动修改 Task Index；
- 为未来可能性建设通用平台；
- 自动 merge、tag 或 release。

## 11. Phase C：`mytracer-stage-acceptance-release` Skill

新增 Skill 应复用 T803 的成熟聚合验收模式，完成：

- 核实阶段内全部任务真实进入最新授权 `dev`；
- 区分 `task_delivery_revision`、`dev_integration_revision` 和 `stage_final_integration_revision`；
- 固定同一个阶段最终验收 revision；
- 审计阶段任务、requirements、Evidence、失败历史和 `main...dev` 内容；
- 执行 metadata、完整 verify、连续 AC、Windows package/smoke 和阶段特有验证；
- 绑定但不代签项目所有者人工验收；
- 聚合证据但不覆盖或删除任务失败历史；
- 建立 docs impact matrix、阶段归档和 release handoff；
- 仅在明确授权时创建 `dev -> main` Draft PR；
- 等待 required CI 并停在 Ready、merge、tag、release owner gates。

该 Skill 不得在聚合任务中顺手修产品缺陷。发现失败时保留证据并在当前 authority 内停止；T093 不允许自动创建新的修复任务。

## 12. Phase D：Workflow 与 PR 自动化

### 12.1 单 Workflow 和双 Gate

继续演进 `.github/workflows/verify.yml`，目标结构：

```text
classify
  ├─ pr-quality
  ├─ documentation
  ├─ governance
  ├─ verification
  └─ milestone
          ↓
       CI Gate
          ↓
 Windows required gate (migration compatibility)
```

- `CI Gate` 和旧 Gate 必须根据相同必需 job 结果得出结论。
- 终端 Gate 使用 `if: always()` 或等价确定性逻辑，明确拒绝 required job 的 fail/cancel/unexpected skip。
- 旧 Gate 不在 T093 删除。
- workflow 不使用导致整套 required workflow 不运行的 path filters。

### 12.2 Change classifier

`tools/ci/classify-changes.mjs` 必须确定性分类：

| Category | Typical surface | Required level |
|---|---|---|
| Source | `src/**`、`tests/**`、`tools/**`、package/build config、Workflow YAML | Windows full verification |
| Governance | AGENTS、Skills、Profiles、任务/阶段模板、纯治理规范 | metadata、governance、format、diff integrity |
| Documentation | 不改变治理、稳定命令或产品语义的普通文档 | format、结构/链接、diff integrity |
| Milestone | PR/push 到 `main` 或显式 milestone request | full verify、package、package smoke、阶段要求 |

- 混合变更取最高等级。
- 未识别路径默认 Source。
- `tools/**`、测试代码和 Workflow YAML 始终按 Source。
- 分类不覆盖合同显式要求的更高验证。

### 12.3 Draft、Ready 与显式 CI mode

- Source Change 的 Draft 也执行完整验证。
- 纯 Governance/Documentation Draft 可执行轻量验证。
- Ready 无条件执行完整验证。
- PR 到 `main`、push 到 `main` 无条件执行 milestone。
- PR body 可以声明 `CI mode: full` 或 `CI mode: milestone`；该字段只能提高验证等级，不能授权 Agent 行为。
- T093 Candidate 使用显式 milestone 模式真实运行 milestone job。

### 12.4 PR Template 与 Quality Check

PR Template 至少包含：

- Task
- Summary
- Requirements
- Scope
- Exclusions
- Validation
- Evidence
- Risk
- Dependency changes
- CI mode

`validate-pr-context.mjs`：

- Draft 缺少未完成上下文时提供明确 warning，但不把正常 pending 写成实现失败。
- Ready 必须具有合法 `Txxx`、非空 Summary、实际 Validation、Evidence 和 Risk。
- 检查不判断实现正确性、owner approval 或 merge readiness。
- Commit/PR title convention 在 T093 只作为 warning，不作为 required failure。

### 12.5 Triggers、concurrency 与权限

Workflow 至少监听：

- `pull_request` 到 `dev` 和 `main`：`opened`、`synchronize`、`reopened`、`edited`、`ready_for_review`、`converted_to_draft`；
- `push` 到 `dev` 和 `main`；
- `workflow_dispatch`。

并满足：

- `permissions: contents: read`；如 PR body 检查确有需要，只增加 `pull-requests: read`。
- 不使用 `pull_request_target`。
- concurrency 按 workflow + PR number/ref 分组，`cancel-in-progress: true`。
- 不授予 contents write、Actions write、deployment、tag、release 或 merge 权限。

## 13. Phase E：Ruleset 精确切换与回滚

### 13.1 切换前置 Gate

只有全部满足时才允许写入 ruleset：

1. T093 Draft PR 的 Implementation Candidate 已形成。
2. 完整 diff review 和独立 review 无未解决重大问题。
3. 本地 targeted、affected regression 和完整 `verify` 通过。
4. hosted `CI Gate` 与 `Windows required gate` 在同一 Candidate head 上通过。
5. T093 显式 milestone CI 在同一 Candidate 或后续未改变实现面的精确 head 上通过。
6. 实时 ruleset before snapshot 与本合同记录的 ID、branch target、strict policy 和 required context 一致。
7. 无其他 open PR 或仓库状态会因切换产生未报告阻塞；若有则停止并报告。

### 13.2 精确变更

按串行顺序修改并逐项复核：

1. `Dev-Rule` / `20582011`
   - required context：`Windows required gate` → `CI Gate`
   - 保持 strict required status checks policy 为 `false`
2. `Main-Rule` / `20582061`
   - required context：`Windows required gate` → `CI Gate`
   - 保持 strict required status checks policy 为 `true`

两个 ruleset 都必须保留：

- branch target；
- pull request requirement；
- required discussion resolution；
- deletion 和 non-fast-forward 禁止；
- required approving review count；
- bypass actors；
- 其他未授权字段。

当前 GitHub Actions integration ID 观察值为 `15368`；实际写入前必须重新查询，不得依赖旧值猜测。

### 13.3 回滚授权

项目所有者已条件批准精确回滚：若切换后 `CI Gate` 未报告、错误绑定或阻塞 T093 final-head 集成，则把受影响 ruleset 的 required context 恢复为 `Windows required gate`，并保持所有其他字段不变。回滚后停止、记录 before/after 和失败事实，不继续 Ready 或 merge。

## 14. Git、GitHub 与外部权限

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

`external_write: true` 只覆盖：

- 推送 `task/T093-governance-integration`；
- 创建和维护该分支到 `dev` 的 T093 Draft PR；
- 更新 T093 PR body；
- 请求并读取 T093 的 full/milestone Actions runs 和脱敏 artifacts；
- 满足 §13.1 后，对 `Dev-Rule` / `Main-Rule` 执行 §13.2 的精确 required-context 切换；
- 满足 §13.3 时执行精确回滚。

以下仍未授权：Ready、任何 merge、`dev -> main` PR、tag、release、Secrets、deployment、远端分支删除、其他 ruleset 字段或其他外部写入。

## 15. 交付物

- [ ] development Skill 中可执行、可恢复、保守 fallback 的 `standard-task@1` 接入。
- [ ] `mytracer-stage-design` Skill 与 interface metadata。
- [ ] `mytracer-stage-acceptance-release` Skill 与 interface metadata。
- [ ] change classifier 与单元测试。
- [ ] PR Template、PR Quality validator 与单元测试。
- [ ] 分层 CI、milestone、concurrency、最小权限和始终报告的 `CI Gate`。
- [ ] 保留的兼容 `Windows required gate`。
- [ ] Candidate full/milestone hosted CI 与 artifact。
- [ ] Dev/Main ruleset 精确切换、after snapshot 和回滚验证。
- [ ] T093 metadata、Task Index、Evidence、治理文档和 PR body 收口。
- [ ] final-head dual-gate CI 和 merge handoff。
- [ ] 明确记录未实施 Worktree cleanup、未创建额外任务、未启动 T041。

## 16. 验收标准

1. T093 基线绑定真实最新 `origin/dev@7f5e2ed...`，T092 的合入事实不依赖 PR Draft 或账本推断。
2. Profile 被接入现有 development Skill，不复制或替代既有任务执行流程。
3. Profile 与 permissions 使用保守交集，Repository Safety Rules 不可 override。
4. `activated_at <= now < valid_until`、启动/恢复/阶段切换重检和过期 fallback 一致明确。
5. `ready`、`active`、`review`、`done` 的执行边界明确；合同/sidecar 不一致时停止。
6. `disable_phase` 和 `pause_before` 只能缩小自动阶段。
7. 五个 Profile phase 精确映射到现有 Skill，并停在 docs closeout owner gate。
8. Stage Design Skill 能建立 baseline + delta、任务图、shared surface 和 stage gate，但不自动建立或启动任务。
9. Stage Acceptance & Release Skill 能固定最终 integration revision、执行聚合验收和发布交接，但不自动修复、Ready、merge、tag 或 release。
10. 两项新 Skill 不改变 FR/AC/D，不把 `user/` 文档作为 authority。
11. classifier 对 Source/Governance/Documentation/Milestone 和混合变更给出确定结果。
12. 未识别路径、`tools/**`、测试代码和 Workflow YAML 不会被降级。
13. required workflow 不使用会跳过整套 workflow 的 path filter。
14. Draft、Ready、显式 full/milestone 和 `dev -> main` 的验证等级符合合同。
15. PR Quality 只检查必要上下文；Draft warning 与 Ready failure 语义明确。
16. Workflow 使用最小 read 权限、受控 concurrency，并且没有 `pull_request_target` 或写 token。
17. `CI Gate` 始终报告并正确汇总 required jobs；旧 Gate 同时保留。
18. T093 Candidate 的 full 和显式 milestone hosted CI 在精确 revision 上通过。
19. ruleset 切换前有实时 before snapshot，且满足全部 §13.1 Gate。
20. Dev/Main ruleset 只改变 required context，strict 和其他保护字段保持不变。
21. 切换后有实时 after snapshot，回滚路径已通过只读或安全场景验证。
22. docs closeout 后最新 T093 head 再次通过两个 Gate。
23. T093 不包含 Worktree cleanup、产品代码、依赖、lockfile、schema、migration、AI Provider 或真实凭据变化。
24. T093 不创建额外 Txxx，不创建或启动 T041。
25. `MANUAL`：项目所有者在 Candidate 与 ruleset 实际结果可见后确认最终 docs closeout 范围；Ready 和 merge 仍另行决定。

## 17. 验证计划

### 17.1 针对性验证

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/process-governance.test.ts
```

若新增独立 classifier/PR validator test 文件，合同实施时补充其确切命令。

场景矩阵至少覆盖：

- Profile 合法 implementation/fix、未知 Profile、task kind 不匹配；
- future activation、expired、有效期边界和会话恢复；
- contract/sidecar mismatch；
- `disable_phase`、`pause_before`、owner gate 和风险退出；
- Source、Governance、Documentation、Milestone、混合和 unknown path；
- Draft/Ready PR body 的完整、pending、缺字段和非法 Task ID；
- Gate 对 required job success/fail/cancel/unexpected skip 的处理。

### 17.2 受影响范围回归

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run verify
git diff --check
```

T093 修改 standing Skills、governance tools、package scripts 和 Workflow，必须执行完整 `verify`。不新增依赖，不运行 live AI，不访问真实用户数据。

### 17.3 Hosted CI

- 第一个有意义 commit 后创建 T093 Draft PR并取得 early CI。
- Implementation Candidate 使用 `CI mode: full` 运行完整 CI。
- ruleset 切换前使用 `CI mode: milestone` 真实运行 milestone job，包括 Windows package/smoke。
- 记录 `CI Gate` 与 `Windows required gate` 的 run、job、head revision、test-merge revision 和 artifacts。
- ruleset 切换和 docs closeout push 后，等待 exact final head 的两个 Gate。
- 较早 green run 不替代 final-head CI。

### 17.4 Skill review

三个 Skill 必须分别检查：

- trigger/description 与实际职责一致；
- authority order 和 owner gates 一致；
- 不复制冲突流程；
- 不自动扩范围、创建任务或执行发布；
- 相对路径和引用可以从 Skill 目录正确解析；
- 独立 read-only review 无未处理重大问题。

## 18. Integration 与证据

```yaml
integration:
  target_branch: dev
  base_revision: dev@7f5e2edad62312ca3b79afb7684c64699d4ec8e5
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

- T093 实施、Candidate、ruleset 切换和 merge handoff 前都要核实最新授权 `origin/dev`。
- stale 时只允许普通、可追踪 merge refresh，不 force-push；重新运行 affected regression，并在 review surface 变化时重新 review。
- 规则配置事实必须记录 ruleset ID、before/after、时间、执行者授权、API 结果和回滚状态。
- Workflow run 必须区分 early、full candidate、milestone、final-head 和 post-merge。
- Evidence 不得把结构校验、Skill 文本或 CI Gate 自身解释为产品验收。
- T093 未 merge 前 `dev_integration_revision` 保持 `null`。
- T093 不使用 `stage_final_integration_revision` 证明产品阶段；若无适用阶段则保持 `null`。

## 19. Docs closeout、Ready 与 merge handoff

Candidate、full/milestone CI、ruleset after snapshot 和完整 review 通过后，必须生成准确 docs impact matrix。至少评估：

- T093 合同；
- `TASK_INDEX_V0.1.md`；
- `ACCEPTANCE_EVIDENCE_V0.1.md`；
- `AUTOMATION_PROFILES_V0.1.md`；
- `GITHUB_WORKFLOW_V0.1.md`；
- `AGENTS.md`；
- 三项 Skill；
- README；
- Draft PR body。

项目所有者已经批准 T093 的总体 closeout 方向，但最终事实必须在 Candidate 和 ruleset 结果存在后再次确认，不能预先写成 pass。获批后创建独立 docs closeout commit，push 后等待 final-head dual-gate CI。

Ready、merge 到 `dev`、`dev -> main`、tag 和 release 不包含在当前权限中。Agent 只能在 final-head CI 通过后推荐 Ready，并等待项目所有者决定。

## 20. 风险与停止条件

出现以下任一情况时停止受影响阶段并填写 Escalation Proposal；不得自动创建新任务：

- Profile 与 permissions 无法保持明确的保守交集。
- Profile 接入需要第二套执行流程、权限解析器或调度器。
- 新 Skill 需要改变 FR/AC/D、自动建立任务或自动发布。
- classifier 可能把 unknown、mixed、tools、tests 或 Workflow 变化错误降级。
- required `CI Gate` 不能稳定报告，或 path/condition 造成永久 Pending。
- milestone job 未在真实 hosted Windows runner 上运行。
- PR Quality 需要判断实现正确性或 owner approval。
- ruleset before snapshot 与合同记录不一致。
- ruleset 写入需要改变 required context 以外的字段。
- ruleset 切换使 T093 final-head 或现有 PR 无法获得 required check。
- 精确回滚不能安全恢复旧 context。
- 需要新增依赖、修改 lockfile、产品代码、schema、migration、Provider、Secrets 或 deployment。
- 需要 Worktree cleanup、远端分支删除、force-push、Ready、merge、tag 或 release。
- 需要创建、激活或启动 T041 或其他 Txxx。
- 最新 `origin/dev` 无法核实、freshness 无法证明或冲突无法安全解决。
- 无法产生绑定精确 revision、run 和 ruleset snapshot 的可靠证据。

安全、独立且仍在合同范围内的其他串行阶段可以继续；共享面或权限冲突影响整体时，整个 T093 暂停。

## 21. 完成报告

最终报告必须列出：

- 修改和新增文件；
- 三项 Skill 的职责、触发与保留 Gate；
- Profile 启动、恢复、有效期、fallback 和阶段映射；
- classifier、PR Quality、Workflow 分层、concurrency 和双 Gate；
- Dev/Main ruleset before/after 与回滚状态；
- 实际命令、exit code、环境、artifact、run/job/revision；
- branch、commits、Draft PR、full/milestone/final-head/post-merge CI；
- 自动化和项目所有者人工验收状态；
- docs closeout、Ready 和 merge handoff 状态；
- 未实施 Worktree cleanup、未创建额外任务、未启动 T041；
- 残余风险、已知缺口、跳过或未验证内容；
- 是否发现需求冲突、架构变化或范围变化。

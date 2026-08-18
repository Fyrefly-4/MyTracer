# T090 Agent Process V2 文档修订任务合同

> 任务类型：流程治理 / 文档任务
>
> 状态：review
>
> 本合同把项目所有者批准的 V2 第一、二批落地方案转化为本仓库的执行边界。V2 用户文档仍是修订提案，不是本任务的规范来源。

## 1. 任务信息

- **Task ID**：T090
- **Title**：落地 MyTracer V2 Agent 流程第一、二批文档规范
- **Slice / Plan item**：GOV-01 / V2 Batch 1-2
- **Status**：review
- **Base branch**：`dev`，初始观察 revision `112b90968dad05cd27f8421480cadaeff6f85e2c`
- **Expected branch**：`docs/T090-agent-process-v2`

## 2. 目标结果

仓库规范能够明确表达并指导以下行为：

- Draft PR、early hosted CI、Implementation Candidate、最终 review、Integration Freshness Gate、candidate/final-head CI 和文档收口的边界；
- `fresh`、`refreshed-and-passed`、`blocked`、`not-required` 四种 freshness 状态；
- 标准 Escalation Proposal 及发现冲突后的停止行为；
- `task_delivery_revision`、`dev_integration_revision`、`stage_final_integration_revision` 三类 revision；
- Task Contract 的 references、dependencies、permissions、integration 和 shared surface 字段；
- Stage Design 的 baseline + delta 结构。

第二批本次只完成文档结构，明确标记为尚未经过真实 Txxx 运行验证；不创建产品任务试点。

## 3. 依据与权限边界

- **FR**：无；本任务不改变产品需求。
- **AC**：无；本任务不声明任何产品验收通过。
- **D**：无；不修改产品决定。
- **ED/GW**：GW-001、GW-002、GW-004、GW-005/GW-006、GW-009、GW-010；现行 `AGENTS.md` 的任务、证据和权限规则。
- **直接相关架构章节**：`docs/architecture/IMPLEMENTATION_PLAN_V0.1.md` 的任务与阶段边界；现有架构文档只作为稳定约束背景，不进行语义改写。
- **提案输入**：`user/MYTRACER_V0.1_DEVELOPMENT_PROCESS_REVISION_V2.md`；仅用于核对修订意图，不成为实现或验收权威。

## 4. References

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
```

References 只是依据索引，不创建新的产品语义来源。

## 5. Dependencies and shared surface

```yaml
dependencies:
  tasks:
    requires: []
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@112b909
  shared_surfaces:
    - AGENTS.md
    - .agents/skills/mytracer-stage-development/SKILL.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  external: []
```

这些文件属于同一套治理规则，本任务串行修改，不与其他任务并行编辑。

## 6. Permissions

```yaml
permissions:
  local_write: true
  create_worktree: false
  create_task_branch: true
  create_commit: true
  push_task_branch: false
  create_or_update_draft_pr: false
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: false
```

不修改 GitHub Actions、branch protection、Actions secrets、远端 PR 或远端分支。

## 7. Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@112b909
  freshness_required: true
  affected_regression_required: false
  task_delivery_revision: 5b5211aa4904aef39b5e3f4366efbce08b8d3229
  dev_integration_revision: null
  stage_final_integration_revision: null
```

正式提交前重新读取当前授权 `dev` revision；若基线发生变化，记录实际 revision，不凭旧观察值宣称 fresh。由于本任务不 push 或创建 PR，hosted CI 和 dev integration revision 保持未发生状态。

## 8. Allowed files

允许新增或修改：

- `AGENTS.md`
- `.agents/skills/mytracer-stage-development/SKILL.md`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/TASK_TEMPLATE.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/GITHUB_WORKFLOW_V0.1.md`
- `docs/implementation/ESCALATION_PROPOSAL_TEMPLATE.md`
- `docs/architecture/STAGE_DESIGN_TEMPLATE.md`
- `docs/implementation/T090_AGENT_PROCESS_REVISION_V2.md`

## 9. Explicit exclusions

- 不修改 `docs/PRODUCT_REQUIREMENTS_V0.1.md`、`docs/DECISIONS.md` 或 `docs/REQUIREMENTS_CHANGE_POLICY.md`。
- 不修改产品代码、测试代码、依赖、package scripts、数据库、migration 或 `.github/workflows/verify.yml`。
- 不追溯重写 S1/S2 阶段设计、历史归档或既有验收记录。
- 不创建 Txxx 产品任务试点。
- 不实施第三批 evidence capture、metadata、CI artifact 自动采集。
- 不实施第四批 execution Profile、自动文档收口、自动启动下一个任务、Review/Audit Skill 或 Orchestrator。
- 不把 `user/` 文档改写为规范来源。

## 10. Invariants

- 冻结产品语义、FR、AC、D、ED 和数据安全边界保持不变。
- `TASK_INDEX_V0.1.md` 继续是唯一任务状态账本。
- Evidence 只能记录真实命令、真实 revision 和真实限制；本任务不能伪造 hosted CI、merge 或试点证据。
- `verify` 的 tracked source/documentation 只读性质保持不变。
- 项目所有者继续控制 Ready、merge、tag、release 和外部写入。
- 第二批状态必须写成“文档已落地、尚未通过真实任务运行验证”。

## 11. Deliverables

- [ ] T090 任务索引记录。
- [ ] 第一批流程规则同步到 AGENTS、Skill、GitHub workflow 和 Evidence 规范。
- [ ] Escalation Proposal 模板。
- [ ] Task Contract 的 references、dependencies、permissions、integration 和 shared surface 结构。
- [ ] Stage Design baseline + delta 模板。
- [ ] T090 验收证据、已知限制和未进行产品试点的记录。

## 12. Acceptance criteria

1. Draft PR、early CI、Implementation Candidate、最终 review、candidate/final-head CI 和 docs closeout 的顺序及完成边界在规范文件中一致。
2. Integration Freshness Gate 的四种状态、stale base 刷新方式和禁止 force-push 规则在规范文件中一致。
3. Escalation Proposal 包含问题、观察 branch/revision、当前 authority、冲突、提议变化、影响、风险、安全完成工作、最小 owner 决策和恢复点。
4. Evidence 规范能区分三类 revision、early/candidate/final CI，并保留失败与 supersede 关系。
5. Task Template 能表达 references、五种依赖关系、permissions、integration 和 shared surface，且没有隐式授予 merge 或外部写入权限。
6. Stage Design 模板包含 baseline manifest、stage delta、非范围、兼容性、migration/历史影响、连续 E2E、人工验收和停止条件。
7. 结构检查确认没有启用第三、四批自动化或 Profile；PRD、决定、需求变更规则、产品代码和 CI workflow 实现没有变化。
8. T090 证据明确记录：没有进行产品任务试点，第二批只完成文档结构，manual acceptance 仍为 `pending`。

## 13. Validation plan

```powershell
npm.cmd run format:check
git diff --check
```

另行执行只读结构检查，验证必需标题、字段、状态和排除项存在，并检查允许文件列表没有越界。由于没有 executable/config/CI 改动，不运行完整 Electron `verify`。

## 14. Stop conditions

- 需要改动 PRD、产品决定、需求变更规则或冻结语义；
- 需要扩大到代码、依赖、migration、CI 实现或外部写入；
- 发现现有规范之间存在未解决冲突；
- 无法把“文档已落地、尚未运行验证”与真实完成证据清楚区分。

## 15. Completion report

交付报告必须列出变更文件、规范覆盖、实际命令和结果、commit/revision、人工验收状态、未进行试点、已知限制、排除项检查和是否发现范围变化。

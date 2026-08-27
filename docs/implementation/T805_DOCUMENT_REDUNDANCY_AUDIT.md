# T805 文档冗余收敛与已完成治理合同归档任务合同

> 任务类型：流程治理 / 纯文档收敛
>
> 合同状态：**review**；本地文档 candidate 已完成，Draft PR #34 已创建，等待 hosted CI 和项目所有者审阅
>
> 项目所有者授权：2026-08-27 明确批准建立任务分支，并直接执行已确认的 1～4 项；完成验证后允许创建提交、推送任务分支和创建 Draft PR
>
> 历史快照说明：本任务处理历史任务合同的当前树呈现，不改写原合同中完成当时的事实；当前状态仍以任务索引和证据账本为准

## 1. 任务信息

- **Task ID**：T805
- **Title**：收敛 `/docs` 文档冗余并归档已完成治理任务合同
- **Slice / Plan item**：GOV-06 / Documentation redundancy and completed-contract archive
- **Status**：review
- **Base branch**：`dev`
- **Observed authorized base**：`origin/dev@2b31bc6be50d805f0dcad73a7a64cc3735a05d09`
- **Expected branch**：`task/T805-doc-redundancy`

## 2. 目标结果

在不改变产品语义、需求、架构和执行权限的前提下：

1. 将已完成的 T090～T093、T804 完整任务合同收敛为一份最小有效治理归档；T803 继续由现有 S3 归档承载，不创建重复归档。
2. 让当前 `docs/implementation/` 根目录只保留当前运行所需的治理文档、模板、任务索引、证据账本和未完成/当前任务合同。
3. 精简 `TASK_INDEX_V0.1.md` 中重复的当前状态叙述，同时保持任务状态唯一来源、阶段门和未完成任务边界。
4. 为归档内容建立明确的“完成时历史快照”边界，并在必要处补充 T093 已进入当前 `dev` 的事实。

## 3. 需求依据

- **FR**：无；不改变产品功能。
- **AC**：无；不执行产品行为或体验验收。
- **D**：无；不改变产品决定。
- **ED/GW**：GW-001、GW-003、GW-004、GW-009、GW-010；仓库文档治理规则关于状态唯一来源、Evidence 保留和归档最小信息的要求。
- **直接相关架构章节**：无；本任务仅处理 `/docs` 的文档组织和历史边界。

### 3.1 References

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
  engineering_decisions:
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  architecture: []
  governance:
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/archive/S0_T001_T004_ARCHIVE.md
    - docs/implementation/archive/S1_T011_T014_ARCHIVE.md
    - docs/implementation/archive/S2_T021_T023_ARCHIVE.md
    - docs/implementation/archive/S3_T031_T033_ARCHIVE.md
```

References 只是依据索引，不创建新的产品语义、权限或验收事实。

## 4. 开始条件、依赖与 shared surface

- [x] 当前 `dev` 与 `origin/dev` 一致，工作树在任务开始前干净。
- [x] 项目所有者已批准创建任务分支，并批准执行归档、精简、历史边界标识和后续 commit/push/Draft PR。
- [x] 现有 S0～S3 归档模式可作为最小信息格式依据。
- [x] T090～T093、T803、T804 已在任务索引中标记为 `done`；T803 已由 S3 归档承载。
- [x] 不需要新增依赖、migration、产品代码或测试代码。

```yaml
dependencies:
  tasks:
    requires: []
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@2b31bc6be50d805f0dcad73a7a64cc3735a05d09
  shared_surfaces:
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/archive/
    - docs/implementation/metadata/T092.json
    - docs/implementation/metadata/T803.json
    - docs/implementation/metadata/T804.json
  external:
    - GitHub PR #33 read-only status verification only; no change to PR #33
```

## 5. 允许修改范围

- `docs/implementation/T805_DOCUMENT_REDUNDANCY_AUDIT.md`
- `docs/implementation/archive/GOVERNANCE_T090_T093_T804_ARCHIVE.md`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/metadata/T092.json`
- `docs/implementation/metadata/T803.json`
- `docs/implementation/metadata/T804.json`
- 删除已归档的完整合同：
  - `docs/implementation/T090_AGENT_PROCESS_REVISION_V2.md`
  - `docs/implementation/T091_AGENT_PROCESS_AUTOMATION.md`
  - `docs/implementation/T092_STANDARD_TASK_PROFILE.md`
  - `docs/implementation/T093_PROFILE_SKILLS_CI_INTEGRATION.md`
  - `docs/implementation/T803_S3_FINAL_ACCEPTANCE.md`
  - `docs/implementation/T804_DOCUMENT_FACT_CLOSEOUT.md`

## 6. 明确非范围

- 不改变冻结需求、产品决定、架构、FR、AC、D、ED 或用户可见语义。
- 不修改产品代码、测试代码、依赖、lockfile、schema、migration、Workflow、Skill、`README.md`、`user/` 或 GitHub 配置。
- 不删除或合并失败 Evidence、partial Evidence、Escalation Proposal 或现有 S0～S3 归档。
- 不把 T803 再复制到新的独立归档；T803 继续保留在 S3 归档中。
- 不自动启动 T041，不执行 Ready、merge、tag 或 release。
- 不改写历史合同和 Evidence 中完成时的事实，只在新归档中提供时间边界。

## 7. 必须保持的不变量

- **引用不变量**：任务状态只由 `TASK_INDEX_V0.1.md` 维护；实际验证只由 `ACCEPTANCE_EVIDENCE_V0.1.md` 证明；产品语义仍由 PRD、DECISIONS 和需求变更规则约束。
- **审计不变量**：完整历史合同可通过 Git 历史恢复；失败和部分完成证据保留；归档不重新授权任何任务。
- **本任务局部风险**：删除当前树中的完整合同前，归档必须覆盖其最小有效事实、Evidence ID、revision、限制和恢复入口；当前文档不得继续把完成时的历史快照伪装成当前状态。

## 8. 交付物

- [x] T090～T093、T804 的一份精简治理归档。
- [x] T803 在现有 S3 归档中的唯一承载确认。
- [x] `TASK_INDEX` 重复当前叙述收敛，状态表和阶段门保持可用。
- [x] T093 当前 `dev` 合入事实的补充证据，不改写候选 Evidence。
- [x] 历史快照边界说明。
- [x] 文档链接、格式和治理结构验证结果。
- [ ] 本任务的验收证据和 Draft PR 交付信息。

## 9. 验收标准

1. 新归档包含 T090、T091、T092、T093、T804 的目的、最终 task delivery revision、dev integration revision、Evidence ID、关键结果和限制，并明确不是当前权限或状态来源。
2. 当前 `docs/implementation/` 根目录不再保留上述五个已完成治理合同；T803 完整合同也不单独保留，S3 归档仍包含其最小有效记录。
3. `TASK_INDEX` 仍是任务状态唯一账本，任务表、阶段门、T041/T062 边界和 T093 当前集成事实均可定位；重复叙述明显减少。
4. 历史 Evidence 的失败、partial、superseded 关系未被删除或改写；新增的 T093 合入事实与精确 revision 绑定。
5. 文档内本地 Markdown 链接无断链；不存在因本次删除产生的引用错误；变更仅限合同允许的 `/docs` 文件。
6. `npm.cmd run format:check`、`npm.cmd run governance:metadata:check` 和 `git diff --check` 通过；不因文档任务声称产品测试或人工体验验收通过。
7. **MANUAL**：项目所有者后续可在 Draft PR 中检查归档信息是否符合长期维护习惯；该检查不由自动化代替。

## 10. 验证计划

### 针对性验证

```powershell
npm.cmd run format:check
npm.cmd run governance:metadata:check
git diff --check
```

另行执行只读 Markdown 本地链接解析、重复文件/段落扫描、任务合同引用扫描和完整 diff 范围检查。

### 受影响范围回归

```powershell
npm.cmd run format:check
npm.cmd run governance:metadata:check
git diff --check
```

本任务不改变产品代码或测试代码，因此不以产品 `verify`、E2E 或人工体验结果替代文档验证；Draft PR hosted checks 由 GitHub 集成门禁独立记录。

### 人工步骤

1. 检查归档摘要是否保留后续任务需要的最小信息。
2. 检查 Draft PR diff 是否只包含合同允许的 `/docs` 文件。

### 验证环境

- OS：Windows
- Node：以仓库实际命令输出为准
- Electron：不适用
- 数据根：不适用；不访问产品数据库
- Source revision：完成时填写

## 11. Git 与 GitHub 权限

- [x] 允许创建本地任务分支。
- [x] 允许创建本地提交。
- [x] 允许推送任务分支。
- [x] 允许创建或更新 Draft PR 到 `dev`。
- [ ] 允许将 Draft 标记为 Ready。
- [x] 不允许 Agent 合并到 `dev`。
- [x] 不允许 Agent 创建或合并 `dev -> main` PR。
- [x] 不允许 Agent 创建 tag 或 release。

### 11.1 Structured permissions

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

`external_write` 仅指推送 `task/T805-doc-redundancy` 和创建/更新其到 `dev` 的 Draft PR；不包含修改 PR #33、ruleset、CI 配置或发布动作。

## 12. 依赖与外部操作权限

- 新增/升级依赖：无
- 网络访问：仅只读核验 PR #33；后续推送任务分支并创建本任务 Draft PR
- AI Provider：不适用
- 外部写入：仅本任务分支 push 和 Draft PR 创建/更新
- 数据破坏性操作：无；删除的 tracked 合同可从 Git 历史恢复

### 12.1 Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@2b31bc6be50d805f0dcad73a7a64cc3735a05d09
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: 2c4d4fdeeb900a6a575a82c4c7e9367d85a72387
  dev_integration_revision: null
  stage_final_integration_revision: null
```

## 13. 风险与停止条件

发现需求或决定冲突、归档无法保留恢复入口、需要修改 `/docs` 之外的文件、需要改变产品语义或需要扩大外部权限时，停止受影响部分并报告。

任务特有风险：

- 历史任务合同包含完成时的权限和状态快照；归档摘要必须标明时间边界，不能把历史措辞直接当作当前状态。
- T093 已实际进入当前 `dev` 的事实与旧候选 Evidence 需要并列保存，不删除候选时间线。

## 14. 完成报告

完成时填写：修改/删除文件、归档摘要、TASK_INDEX/Evidence 变化、验证命令和结果、task delivery revision、Draft PR/CI 标识、残余风险、人工检查状态，以及是否发现需求冲突或范围变化。

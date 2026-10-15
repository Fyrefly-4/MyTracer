# MyTracer 任务合同模板

> 流程启用边界：仅在 owner 明确启用 Txxx 阶段开发流程时使用。普通请求不要求合同或任务编号；查阅本模板不构成启用依据。 以根目录 [AGENTS.md](../../AGENTS.md) 为准。

> 用途：为一个可独立实现、验证和评审的任务建立执行边界  
> 使用方式：复制本模板，填写所有必填项；未批准项不得用默认假设代替

## 1. 任务信息

- **Task ID**：T___
- **Title**：
- **Slice / Plan item**：S_ / E_-__
- **Status**：ready
- **Base branch**：dev
- **Expected branch**：`task/T___-short-name`

## 2. 目标结果

用用户或系统可以观察的结果描述任务完成后的状态。不要只写“创建模块”“补充代码”或“按最佳实践实现”。

## 3. 需求依据

- **FR**：
- **AC**：
- **D**：
- **ED/GW**：
- **直接相关架构章节**：

若没有需求依据，先按需求变更规则分类，不进入实现。

### 3.1 References

References 是依据索引，不是新的语义来源。每个引用应指向具体文件和必要章节：

```yaml
references:
  requirements: []
  decisions: []
  engineering_decisions: []
  stage_design:
    - file: docs/architecture/Sx_....md
      sections: []
  architecture:
    - docs/architecture/....md
```

## 4. 开始条件

- [ ] 前置任务已完成并有证据。
- [ ] 依赖和版本已批准。
- [ ] 数据迁移影响已评估。
- [ ] 当前基线没有未处理冲突。
- [ ] 分支/worktree 和发布权限明确。
- [ ] 真实验证命令已经存在，或本任务明确负责建立这些命令。

### 4.1 Dependencies

依赖关系必须来自阶段设计、架构检查或任务合同，不得只由 Agent 临时推断：

```yaml
dependencies:
  tasks:
    requires: []
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@<revision>
  shared_surfaces: []
  external: []
```

- `requires`：前置完成前不能开始。
- `blocks`：本任务未完成时会阻塞另一任务。
- `can_parallel`：逻辑上可并行，但仍受 shared surface 和 owner policy 限制。
- `prefer_after`：不是硬依赖，但建议在其后执行。
- `conflicts_with`：存在不可安全并行或必须先解决的共享修改，必须说明依据。

### 4.2 Machine-readable metadata sidecar

For a V2 Batch 3 task, add `docs/implementation/metadata/Txxx.json`. The sidecar is auxiliary machine-checkable metadata; the task contract, `TASK_INDEX` and Evidence ledger remain authoritative for scope, status and acceptance.

```json
{
  "schemaVersion": 1,
  "task": "Txxx",
  "dependencies": {
    "requires": [],
    "blocks": [],
    "can_parallel": [],
    "prefer_after": [],
    "conflicts_with": []
  },
  "conflict_basis": {},
  "shared_surfaces": [
    {
      "files": [],
      "modules": [],
      "schema_tables": [],
      "ipc_contracts": [],
      "domain_invariants": [],
      "risk": "low",
      "integration_policy": "serial"
    }
  ],
  "external": []
}
```

The validator checks the five finite dependency relations, task references, duplicate entries, `conflict_basis` entries for every `conflicts_with` task, shared-surface identifiers, risk/policy values and JSON integrity. When optional Profile metadata is present, it also checks the registry reference, task kind, validity interval, allowed constraints and basic lifecycle compatibility. It does not infer safe parallelism, calculate operation permissions, prove owner approval, schedule tasks or modify tracked files.

### 4.3 Automation Profile（可选）

普通低风险任务可以在项目所有者批准合同时声明一个已登记的执行模式：

```yaml
execution:
  profile: standard-task@1
  activated_at: 2026-08-24T09:00:00+08:00
  valid_until: 2026-09-23T09:00:00+08:00
  additional_constraints: []
```

对应 sidecar 需要声明有限 `task_kind`，并以同样结构记录 `execution`。`standard-task@1` 当前只适用于 `implementation` 和 `fix`：

```json
{
  "task_kind": "implementation",
  "execution": {
    "profile": "standard-task@1",
    "activated_at": "2026-08-24T09:00:00+08:00",
    "valid_until": "2026-09-23T09:00:00+08:00",
    "additional_constraints": []
  }
}
```

- Profile 是现有开发流程的运行模式模板，不是独立权限来源或第二套 Skill。
- 项目所有者必须明确批准并激活合同中的声明；最长有效期由 registry 限制，`standard-task@1` 不超过 30 天。
- `additional_constraints` 只能禁用自动阶段或增加暂停点，不能扩大 Profile 或解除 Repository Safety Rules。
- 没有 Profile 的历史或特殊任务继续使用第 11 节的显式权限模式。
- Profile 定义本身不启用自动执行；在独立 Skill 接入任务完成前仍按现行显式权限执行。

## 5. 允许修改范围

列出允许修改的目录、模块或文件：

- 

## 6. 明确非范围

- 不改变冻结需求语义。
- 不实现延期项。
- 不加入未批准依赖。
- 不修改未列入范围的模块，除非先报告并获得批准。
- 任务特有非范围：

## 7. 必须保持的不变量

从领域、数据、AI 和 Electron 边界中列出本任务直接相关的不变量：

- 

引用的不变量只能作为稳定规则索引；必须补充本任务最容易破坏的局部风险：

- **引用不变量**：
- **本任务局部风险**：

## 8. 交付物

- [ ] 用户可见或系统可观察行为。
- [ ] 领域/应用实现。
- [ ] 必要持久化或适配器行为。
- [ ] 错误和降级路径。
- [ ] 单元/契约/集成/E2E 测试。
- [ ] 受影响文档。
- [ ] 验收证据。

删除与本任务无关的项，并补充特定产物。

## 9. 验收标准

逐条写成可以判定通过或失败的条件：

1. 
2. 
3. 

需要人工体验判断的条件必须单独标记 `MANUAL`，不得由自动化测试代替。

## 10. 验证计划

### 针对性验证

```powershell
# 选择并列出本任务实际需要的针对性命令：
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
```

### 受影响范围回归

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
```

`verify` 已包含 build 和 Electron E2E。若合同需要 `npm.cmd ci`、独立 `npm.cmd run build`、打包、人工步骤或平台专属验证，必须额外逐项列出；不得用 `verify` 声称它未覆盖的结果。

### 10.1 Deterministic evidence capture

```powershell
node tools/evidence/capture-command.mjs --task Txxx --gate task-candidate --base-revision <sha> --output .tmp/evidence -- npm.cmd run verify
```

The wrapper must use explicit argv, keep child stdout/stderr out of the JSON, preserve the real child exit code, and write only redacted JSON under `.tmp/evidence/`. On Windows, `.cmd`/`.bat` commands are launched through explicit `ComSpec` argv while the Node child process remains `shell: false`; the recorded command remains the original argv. The artifact is factual input for later Evidence interpretation; it is not automatic acceptance.

### 人工步骤

1. 
2. 

### 验证环境

- OS：Windows
- Node：
- Electron：
- 数据根：临时测试目录 / 明确的人工测试目录
- Source revision：完成时填写

## 11. Git 与 GitHub 权限

逐项选择，不得从“实现任务”自动推断外部发布权限：

- [ ] 允许创建本地 worktree/任务分支。
- [ ] 允许创建本地提交。
- [ ] 允许推送任务分支。
- [ ] 允许创建或更新 Draft PR 到 `dev`。
- [ ] 允许将 Draft 标记为 Ready。
- [ ] 不允许 Agent 合并到 `dev`。
- [ ] 不允许 Agent 创建或合并 `dev -> main` PR。
- [ ] 不允许 Agent 创建 tag 或 release。

### 11.1 Structured permissions

复选框是面向人的确认；以下字段是合同中的机器可读表达。未明确为 `true` 的权限不得执行：

```yaml
permissions:
  local_write: false
  create_worktree: false
  create_task_branch: false
  create_commit: false
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

任何 merge、tag 或 release 权限必须由项目所有者针对确切目标另行授权。

## 12. 依赖与外部操作权限

- 新增/升级依赖：无 / 已批准列表
- 网络访问：无 / 仅文档 / 明确目标
- AI Provider：fake / 已批准 Provider
- 外部写入：无 / 明确目标
- 数据破坏性操作：无 / 已批准步骤和恢复方案

### 12.1 Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@<revision>
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

`integration` 描述任务如何证明自己进入当前集成线，不自动授予 merge 权限。Freshness 结果必须使用 `fresh`、`refreshed-and-passed`、`blocked` 或 `not-required`，并绑定实际命令和 revision。

## 13. 风险与停止条件

发现以下情况时停止受影响实现并报告：

- MUST 或批准决定冲突；
- 需要改变状态、统计、日期、删除或 AI 确认语义；
- 需要引入延期项或新用户概念；
- 需要扩大权限、依赖或文件范围；
- 测试必须访问真实用户数据；
- 无法产生可靠验收证据。

任务特有风险：

- 

## 14. 完成报告

必须包含：

- 新增或修改的文件；
- 实现结果；
- FR/AC/D/ED 覆盖；
- 实际执行的命令和结果；
- 自动化和人工验收状态；
- PR、commit、CI 或产物标识（如适用）；
- 风险、已知缺口和未验证内容；
- 是否发现需求冲突或范围变化。

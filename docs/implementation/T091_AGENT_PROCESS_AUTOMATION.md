# T091 V2 第三批确定性证据自动化任务合同

> 任务类型：流程治理 / 工具与文档任务
> 任务状态：active
> 本合同承接 T090 已进入 `dev` 的第一、二批规范，落地 V2 第三批；不启用第四批 Profile。

## 1. 任务信息

- **Task ID**：T091
- **Title**：落地 V2 第三批确定性证据采集、CI artifact 和 metadata 校验
- **Slice / Plan item**：GOV-02 / V2 Batch 3
- **Status**：active
- **Base branch**：`dev`
- **Observed authorized base**：`origin/dev@aeb0d68`
- **Expected branch**：`docs/T091-deterministic-evidence`

## 2. 目标结果

仓库具备一套无新增 npm 依赖、可在 Windows 本地和 GitHub Actions 使用的确定性流程工具：

- 用显式 argv 包装验证命令，记录真实环境、revision、时间、退出码和 CI 元数据；
- 成功或失败命令都生成不含秘密和用户数据的 JSON artifact；
- metadata sidecar 能表达并由 Node validator 检查任务依赖和 shared surface；
- CI 上传脱敏 artifact，但工具不自动修改长期文档、TASK_INDEX 或 Evidence ledger；
- 现有 `npm.cmd run verify` 的命令语义保持不变；
- 第四批 `standard-task`、自动文档收口、自动启动任务、Review/Audit Skill 和 Orchestrator 不在本任务内。

## 3. 依据与权限边界

- **FR / AC**：无；本任务不改变产品需求或产品验收。
- **D**：无；不修改产品决定。
- **ED/GW**：GW-001、GW-002、GW-004、GW-008、GW-009、GW-010；V2 Batch 3 规范。
- **直接相关架构章节**：`docs/architecture/IMPLEMENTATION_PLAN_V0.1.md` 的任务与阶段边界；`docs/architecture/TEST_STRATEGY_V0.1.md` 的验证和隔离规则。

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
```

References 是依据索引，不创建新的产品语义来源。

## 4. 开始条件、依赖与 shared surface

- [x] T090 已由项目所有者处理并通过 PR #23 进入 `origin/dev@aeb0d68`。
- [x] 无新增或升级 npm 依赖；`package-lock.json` 不得变化。
- [x] T091 独立 worktree 和任务分支已建立。
- [x] T091 允许 push task branch 和创建/更新 Draft PR；Ready、merge、tag、release 均未授权。
- [ ] candidate hosted CI 通过后，文档 closeout 范围仍须项目所有者单独确认。

```yaml
dependencies:
  tasks:
    requires:
      - T090
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@aeb0d68
  shared_surfaces:
    - AGENTS.md
    - .agents/skills/mytracer-stage-development/SKILL.md
    - docs/implementation/TASK_TEMPLATE.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
    - docs/implementation/TASK_INDEX_V0.1.md
    - package.json
    - .github/workflows/verify.yml
  external:
    - GitHub Actions artifact storage for redacted JSON only
```

本任务串行修改上述 governance shared surface，不与其他任务并行编辑。

## 5. Permissions

```yaml
permissions:
  local_write: true
  create_worktree: true
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

`external_write` 仅指批准的 GitHub Actions artifact 上传；不允许本地 Agent 写入其他外部服务、Secrets、branch protection 或远端 merge 状态。

## 6. 允许修改范围

- `tools/evidence/capture-command.mjs`
- `tools/governance/validate-task-metadata.mjs`
- `docs/implementation/metadata/T091.json`
- `docs/implementation/T091_AGENT_PROCESS_AUTOMATION.md`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/TASK_TEMPLATE.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/GITHUB_WORKFLOW_V0.1.md`
- `AGENTS.md`
- `.agents/skills/mytracer-stage-development/SKILL.md`
- `package.json`
- `eslint.config.js`
- `.github/workflows/verify.yml`
- `tests/unit/process-governance.test.ts`

不得修改 `package-lock.json`。

## 7. 明确非范围

- 不修改 `docs/PRODUCT_REQUIREMENTS_V0.1.md`、`docs/DECISIONS.md` 或 `docs/REQUIREMENTS_CHANGE_POLICY.md`。
- 不修改产品代码、Renderer/Main/Preload、数据库、migration、导出或 AI Provider。
- 不实施 T092 的 `standard-task` Profile，不授予或执行任何 Profile 权限。
- 不创建独立 Profile registry、Review/Audit Skill、Orchestrator 或自动启动下一个任务。
- 不让工具自动修改 TASK_INDEX、ACCEPTANCE_EVIDENCE、README、PRD、DECISIONS、阶段设计或任务合同状态。
- 不记录命令 stdout/stderr、环境变量、凭据、safeStorage、真实 SQLite、用户正文、绝对用户路径或测试数据库内容。
- 不使用 force-push，不标记 Ready，不合并 `dev` 或 `main`，不创建 tag/release。

## 8. 必须保持的不变量与局部风险

引用的稳定不变量：

- `verify` 对 tracked source 和 documentation 保持只读；
- Evidence 只记录真实命令、真实 revision 和真实限制；
- TASK_INDEX 继续是唯一任务状态账本；
- 测试使用仓库既有临时数据根规则，不接触真实用户数据。

本任务局部风险：

- 子命令失败必须生成 `fail` artifact，并传递真实退出码，不能被包装器伪装为成功；
- collector metadata 缺失或不可信时不得猜测，必须记录 null/错误并使采集失败；
- artifact 只能包含固定字段和显式相对路径，不能把完整日志或工作目录写入 JSON；
- metadata validator 只能检查结构，不能推断任务可安全并行或自动执行调度；
- CI artifact 上传失败不能覆盖验证命令本身的失败结果。

## 9. 交付物

- [ ] Node evidence collector 和命令行参数校验。
- [ ] Node metadata sidecar validator。
- [ ] T091 JSON metadata sidecar。
- [ ] `evidence:verify` 和 `governance:metadata:check` 稳定命令。
- [ ] Windows CI evidence artifact 上传步骤，固定 `actions/upload-artifact@v4.6.2`、7 天保留。
- [ ] collector/validator 的单元或黑盒测试。
- [ ] AGENTS、Skill、Task Template、Evidence、GitHub workflow 的规则同步。
- [ ] T091 状态记录和真实验证证据。

## 10. 固定接口与验收标准

collector 接口：

```text
node tools/evidence/capture-command.mjs \
  --task T091 \
  --gate task-candidate \
  --base-revision <sha> \
  --output .tmp/evidence \
  -- npm.cmd run verify
```

JSON artifact 至少包含：`schemaVersion`、`task`、`gate`、`sourceBranch`、`sourceRevision`、`baseRevision`、`platform`、`node`、`electron`、`command`、`startedAt`、`finishedAt`、`exitCode`、`artifacts` 和 `ci`。命令以 argv 数组保存；不保存 stdout/stderr、cwd 或环境变量。

验收条件：

1. collector 使用显式 argv 和 `shell: false`；Windows 的 `.cmd`/`.bat` 命令通过显式 `ComSpec` argv 启动且 artifact 仍记录原始命令 argv；成功命令退出码为 0，失败命令保留 artifact 并传递非零退出码。
2. collector 能处理命令不存在、参数缺失、Git metadata 不可用和输出目录非法等错误，不生成虚假的 pass 结果。
3. artifact 不包含凭据、真实数据、绝对路径或完整命令输出，并使用稳定、可安全生成的相对文件名。
4. metadata validator 能通过合法 T091 sidecar，并拒绝缺字段、未知关系、重复项、非法 shared surface、`conflicts_with` 无依据和错误 JSON。
5. validator 不改写任何 tracked 文件、不改变 TASK_INDEX 状态、不调度任务。
6. CI 运行 metadata 检查和 evidence wrapper；artifact 上传步骤在验证失败时仍执行，且仅上传 `.tmp/evidence/*.json`。
7. 现有 `npm.cmd run verify` 命令文本和执行语义保持不变；不引入 npm 依赖或改变产品运行时。
8. 相关规范明确工具采集事实、Agent 解释证据、长期文档更新需授权。
9. `MANUAL`：项目所有者在 hosted candidate CI 通过后确认 docs closeout 精确范围；未确认前保持 `pending`。

## 11. 验证计划

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run verify
git diff --check
```

针对 collector 的本地验证使用 T091 参数运行成功、失败和不存在命令三种场景；随后运行 `npm.cmd run evidence:verify` 检查 wrapper 对现有 `verify` 的退出码和 artifact 行为。hosted CI 需分别记录 early、candidate 和 docs closeout 后的 final-head artifact；早期结果不能替代最终 revision 证据。

## 12. Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@aeb0d68
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

若 `dev` 在 candidate 前推进，必须以普通 merge 刷新 T091，重新运行 affected regression，必要时重新 review，并记录 `fresh` 或 `refreshed-and-passed`。不得 force-push。

## 13. 停止条件与完成报告

发现需求/架构冲突、需要新增依赖或 migration、需要扩大外部写入、artifact 无法证明安全、无法区分失败和成功证据，或发现 T090/T091 集成冲突时，停止受影响部分并填写 Escalation Proposal。

完成报告必须列出变更文件、T091 覆盖范围、命令和 exit code、环境、artifact 位置、source/task delivery revision、CI 分类、manual acceptance 状态、已知限制和是否发现范围变化。T091 不得声明 T092、产品 FR/AC 或 `dev` merge 已完成。

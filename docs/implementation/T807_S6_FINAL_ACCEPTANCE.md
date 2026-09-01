# T807 S6 AI Start Help 聚合验收与发布准备任务合同

> 任务类型：S6 aggregate acceptance / evidence closeout / milestone preparation
>
> 合同状态：**active；项目所有者已授权在 T807 内实施精确的 continuous AC-02 test-only 修复**
>
> 批准与激活日期：2026-09-01
>
> 固定产品 source：`origin/dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9`
>
> 分支：`codex/s6-final-acceptance`

## 1. 任务信息

- **Task ID**：T807
- **Title**：S6 AI Start Help aggregate acceptance and release preparation
- **Slice / Plan item**：S6 final gate
- **Status**：`active`；项目所有者已废弃 T808，并于 2026-09-01 明确授权在 T807 内完成第 16.1 节的窄 test-only 修复；人工 AC-02、文档收口范围、Ready、merge、tag 和 Release 仍是后续独立 Gate
- **Base / target branch**：`dev`
- **Expected branch**：`codex/s6-final-acceptance`
- **Prior milestone**：`main@c6edfc550fd395a4c6e9626bc19232971fe58e3f`

T806 曾在一次未采用的修复备选中建议把 `T807` 用作 test-only 任务号，但没有创建合同、登记 metadata 或激活该任务。项目所有者于 2026-09-01 明确批准本合同使用 T807；本合同不改写 T806 的历史备选事实。

项目所有者在本合同激活前另行批准先修正 T063 已合入但账本未及时更新的事实。该纯文档修正位于 `ba35e2e4e570bd8187dc194144ce778dffdd2c94`，不属于固定产品 source，也不替代 T807 的后续 delivery revision。

## 2. 目标结果

在固定的最新 `origin/dev` 产品 revision 上聚合证明 T061～T063 的 AI Start Help 满足 FR-AI01～FR-AI10、FR-C02/C03 和 AC-02：AI 仅由用户主动触发，只发送最小上下文，Provider/网络/凭据保持 Main-only，所有临时输出在确认前零核心写入，确认后只调用普通 Application Command，且 AI 完全不可用时基础应用继续工作。

自动门禁通过后，向项目所有者提交人工 AC-02 程序并保持 S6 final gate 为 `pending`，直至所有者报告实际结果。随后仅按另行批准的精确 documentation impact matrix 收口 Evidence、Task Index、README、metadata 和统一归档，创建到 `dev` 的 Draft PR，并准备但不创建 `dev → main` PR 正文与 `v0.1.0-beta.3` 候选发布说明。

本任务原则上只验收、审查和收口，不修复产品。唯一例外是第 16.1 节由项目所有者追加批准的 continuous AC-02 test-only 修复；该例外不得改变非测试运行路径、产品语义、公开接口或 AI 权限。任何其他修复仍须保留失败证据并另行申请权限。

## 3. 依据与追踪

- **FR**：FR-AI01～FR-AI10、FR-C02、FR-C03。
- **AC**：AC-02；受影响回归 AC-01、AC-03、AC-04、AC-05、AC-06、AC-07。
- **D**：D-004、D-012～D-015、D-104、D-108、D-109。
- **ED**：ED-004、ED-005、ED-010、ED-011、ED-014、ED-015、ED-019。
- **直接相关架构**：S6 设计 §4～§17、Test Strategy、App Architecture、Data Design 和 Security Boundaries。

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#fr-ai01-fr-ai10
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#fr-c02-fr-c03
    - docs/PRODUCT_REQUIREMENTS_V0.1.md#ac-02
  decisions:
    - docs/DECISIONS.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
  stage_design:
    - file: docs/architecture/S6_AI_START_HELP_DESIGN_V0.1.md
      sections: ["§4-§17"]
  architecture:
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/APP_ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/SECURITY_BOUNDARIES_V0.1.md
  execution:
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
```

## 4. 开始条件与固定基线

合同激活前已只读核实：

- [x] `git fetch --prune` 后，最新 `origin/dev` 为 `f06b1e97da07dffc05814518ad8ad83ed3e051b9`。
- [x] T061、T062、T063 均真实进入该 `origin/dev` 历史。
- [x] 最新 `origin/main` 为 `c6edfc550fd395a4c6e9626bc19232971fe58e3f`，`main/dev` merge-base 为 `1d02fd7a0a7b0bf29a5e39720d5818c9d68fdbc2`。
- [x] `origin/main` 相对 merge-base 没有 main-only 内容树变化；S6 范围是 `1342cd7`、T061、T062、T063 四个 squash integration commits。
- [x] schema 保持 v3、export 保持 v2；S6 没有 migration。
- [x] 普通自动化使用 fake Provider、临时 SQLite 和隔离 `userData`；真实 LiteLLM 未获运行授权。
- [x] 项目所有者于 2026-09-01 批准创建并激活本合同，权限按第 11～12 节执行。

| Task | Task delivery revision | Final task head | Dev integration revision |
|---|---|---|---|
| T061 | `5f98b2f61026721f22fe6cd627c3b402678e9a93` | `d60978917546f6547a1615c6aa03e87d08c0d2ce` | `4630878dacd0a15dbe8446cb26d9cea790d3ed6e` |
| T062 | `bc5461e3bcc4e0ca94abbffe9ef2f898c7bbc4a9` | `a458171be3504492a5c581b595f272c1e1e0e097` | `233d6790c6c5e11bb454b22eb027443eef54a01e` |
| T063 | `fee398e08ef687bd75d9dae10e6254f09e7c9896` | `2e3fc746fcafbe67a0c4a3bc24671e6a50c2ac94` | `f06b1e97da07dffc05814518ad8ad83ed3e051b9` |

```yaml
dependencies:
  tasks:
    requires: [T061, T062, T063]
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9
    required_main_base: main@c6edfc550fd395a4c6e9626bc19232971fe58e3f
  external:
    - github-hosted-windows-ci
```

本合同不采用 `standard-task@1` 或其他 Automation Profile；全部权限来自本合同和后续明确的项目所有者 Gate。

## 5. 允许修改范围

合同激活后允许修改：

- `docs/implementation/T807_S6_FINAL_ACCEPTANCE.md`
- `docs/implementation/metadata/T807.json`
- `docs/implementation/TASK_INDEX_V0.1.md`
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md`
- `docs/implementation/archive/S6_T061_T063_ARCHIVE.md`
- `docs/implementation/metadata/T061.json`
- `docs/implementation/metadata/T062.json`
- `docs/implementation/metadata/T063.json`
- `README.md`
- `src/main/index.ts`（仅允许在 `NODE_ENV=test` 的现有离线 Provider seam 中增加 deterministic scripted fake、内部 request/call 断言和有界 timeout/late-response 测试编排；不得改变非测试路径或新增公开接口）
- `tests/e2e/ai-start-help-ac02.e2e.test.ts`（仅允许补齐 S6 §13.2/§13.3 continuous AC-02 的同一临时数据库证据）
- 到 `dev` 的 T807 Draft PR 正文
- 待 T807 实际进入 `dev` 后供项目所有者审批的 `dev → main` PR 正文和 `v0.1.0-beta.3` 候选发布说明；不得据此创建 PR、tag 或 Release

只有自动化、package、完整 diff 和独立 review 通过，且项目所有者批准精确 documentation impact matrix 后，才允许创建归档并删除：

- `docs/implementation/T061_AI_MINIMAL_CONTEXT.md`
- `docs/implementation/T062_AI_PROVIDER_DEGRADATION.md`
- `docs/implementation/T063_AI_SUGGESTION_CONFIRMATION.md`

删除前必须以固定 Git revisions 提供恢复路径，并保留全部失败证据、supersede 关系、真实 Provider 未验证限制和人工验收状态。

## 6. 明确非范围

- 除第 5 节和第 16.1 节精确列出的两个 test-only 文件外，任何 `src/**`、`tests/**`、`.github/**`、工具、配置、依赖、lockfile、schema、migration 或 export 实现变化。
- 除第 16.1 节外，在 T807 内修复产品、测试、CI、package 或文档验证器；发现其他缺陷时停止受影响门禁并申请新的最小修复授权。
- 扩大 AI 上下文、自动重试、自动规划、主动监督、跨 Goal 分析、长期记忆、会话持久化、对话历史或 Provider 写权限。
- 读取真实凭据、真实用户数据、真实 `userData`，或未经独立批准调用真实 LiteLLM。
- S7、延期 FR、G4 完成声明或新增用户概念。
- Agent 标记 PR Ready、合并到 `dev`/`main`、创建 `dev → main` PR、创建 tag、GitHub Release、上传发布资产、修改 ruleset 或 Secrets。

## 7. 必须保持的不变量

- `stage_final_integration_revision=f06b1e97da07dffc05814518ad8ad83ed3e051b9` 是固定产品内容；T807 文档 head、GitHub test-merge、后续 `dev` 文档 merge 或 `main` merge不得替代它。
- 未主动触发时 Provider 调用次数为零；请求只含当前 Goal、打开 Action/当前下一步、本次输入和最多 5 条同 Goal 相关 ActionRecord。
- 其他 Goal、RoutineRecord、ReviewResult、凭据、日志、完整数据库、内部 manifest/ID 不得进入 Provider 请求。
- Provider、SDK、网络、环境变量和 safeStorage 凭据只在 Main/Infrastructure；Renderer/Preload 不获得 SDK、密钥、SQLite、Repository、任意网络或任意 IPC。
- Provider 永远不能获得 Repository、UnitOfWork 或写命令；AI draft/session/prompt/response/manifest 不持久化、不导出、不写日志。
- 未确认、编辑未提交、拒绝、关闭、取消、timeout、invalid response、stale 和失败分支为零核心写入。
- 用户确认只调用普通 Application Command；Action 在单事务中创建为关联当前 Goal 的 pending Action 并成为 current next，不自动进入 Today。
- Understanding 只能逐项确认到现有相关 ActionRecord，source 为 `ai_candidate_confirmed`；不得表达自动掌握或虚构 Record。
- 原 Action、Today、Routine 五态和历史 Record 不被自动完成、取消、删除、重新安排或改写。
- AI disabled、not-configured、credential unavailable 或失败时基础 Action/Record/Progress/Recovery/Review/export 继续工作。
- 普通验收始终使用 fake Provider、合成唯一标记、临时 SQLite 和隔离 `userData`。
- Agent 不代签人工 AC-02，不把 task-level 绿色 CI 或测试名称当作 S6 聚合通过。

## 8. 交付物

- [ ] 固定 source 的 `main...dev` 完整 diff、安全边界和依赖/migration 审计。
- [ ] T061～T063 revision、FR/AC/D/ED、自动化、hosted CI 与限制的聚合矩阵。
- [ ] continuous AC-02、失败/降级、AC-01/03/04/05/06/07 回归、完整 `verify`、package 和 package smoke 的脱敏证据。
- [ ] 项目所有者人工 AC-02 清单和实际结果；未报告前保持 `pending`。
- [ ] 明确记录“真实 LiteLLM 服务未验证”，除非项目所有者另行授权并实际执行 live contract。
- [ ] owner-approved Evidence、Task Index、README、metadata 与 S6 统一归档收口。
- [ ] T807 delivery/final-head hosted CI 与到 `dev` 的 Draft PR。
- [ ] T807 合入后供审批的 `dev → main` PR 正文与 `v0.1.0-beta.3` 候选发布说明。

## 9. 验收标准

1. T061～T063 delivery、final head、dev integration 与固定 S6 product revision 可从 Git、合同、metadata、Task Index、Evidence 和 GitHub 事实相互核对。
2. `origin/main...origin/dev` 完整 diff 不含未解释的 main-only 产品内容、未批准 dependency/migration/Provider/网络域或 S7 行为。
3. S6 设计 §13.2 的 continuous AC-02 与 §13.3 全部分支在固定 source 上有同范围真实自动证据；若现有测试覆盖不足，不得用分散测试名称冒充连续程序通过。
4. 上下文隔离、未触发零调用、确认前零写入、Provider 无核心写权、Main-only credential/network 和 AI 不可用时核心继续工作均有自动化与静态审查证据。
5. AC-01/03/04/05/06/07、`verify`、Windows package、unpacked/隔离 NSIS smoke、reopen/export/security 在同一固定 source 上通过。
6. 所有正常自动化均不读取真实 key、不调用真实 Provider、不触碰真实 SQLite/`userData`；live contract 未获独立授权时明确为未运行。
7. **MANUAL**：项目所有者按第 10.3 节完成并报告 AC-02；此前 S6 final gate 必须保持 `pending`。
8. 文档只按项目所有者批准的精确 impact matrix 收口，任务合同归档可从固定 Git 历史恢复，失败和限制不被删除。
9. 最终文档 head 的 required checks 和 Windows hosted CI 通过；Draft PR 仍保持 Draft，后续 owner gates 明确。

## 10. 验证计划

### 10.1 固定 source 的本地自动化

正式结果使用 explicit-argv evidence wrapper，`--base-revision` 固定为 `f06b1e97da07dffc05814518ad8ad83ed3e051b9`：

```powershell
npm.cmd run governance:metadata:check
npx.cmd vitest run --project unit tests/unit/ai-start-help-context.test.ts tests/unit/ai-start-help-provider.test.ts tests/unit/ai-start-help-response.test.ts tests/unit/ai-start-help-session.test.ts
npx.cmd vitest run --project integration tests/integration/ai-start-help-context-isolation.test.ts tests/integration/ai-start-help-context-sqlite.test.ts tests/integration/ai-start-help-provider-contract.test.ts tests/integration/ai-start-help-ipc.test.ts tests/integration/ai-start-help-confirmation-sqlite.test.ts
npx.cmd playwright test tests/e2e/ai-start-help-ac02.e2e.test.ts tests/e2e/ai-start-help-degradation.e2e.test.ts
npx.cmd playwright test tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts tests/e2e/recovery-restart.e2e.test.ts tests/e2e/review-result.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts tests/e2e/complete-export.e2e.test.ts
npm.cmd run verify
npm.cmd run package
npm.cmd run test:package-smoke
```

在运行前还要逐项审读上述测试是否真的覆盖 S6 设计 §13.2/§13.3，而非仅凭文件名认定通过。所有测试根、SQLite、导出目录、Electron `userData` 和安装位置必须唯一且临时；fake Provider 为默认适配器。

### 10.2 禁止默认运行的真实 Provider 契约

```powershell
# 未获项目所有者另行批准真实凭据、网络和费用时严禁运行
npm.cmd run test:ai-contract
```

本合同激活不批准该命令。若未运行，Evidence、PR 和发布说明必须写明“真实 LiteLLM 服务未验证”。如项目所有者之后选择真实体验，Agent 只提供在本机 PowerShell 中设置 `MYTRACER_LITELLM_API_KEY`、启动隔离应用和清除当前会话环境变量的具体方法；不得要求在聊天、日志或证据中提供 key，并在等待结果期间保持人工 gate pending。

### 10.3 项目所有者人工 AC-02

在隔离 Windows 数据根与 fake Provider，或另行批准的真实 Provider 环境中执行：

1. 打开 Today Action，确认 AI 不主动出现或调用；主动点击“我现在不想开始”并输入一句阻力。
2. 判断 1～3 条回应是否必要、具体、温和、足够小，不羞辱、不制造焦虑、不把合理休息描述为拖延。
3. 分别体验接受、编辑后确认、拒绝、关闭、取消、timeout、invalid response、未配置与 retry；确认失败分支不卡住手工路径。
4. 确认前检查核心事实不变；编辑后确认只保存最终文本，新 Action 为当前 Goal 的 pending current next，未自动加入 Today，原 Action/历史不变。
5. 对 Understanding 候选逐项确认、修改和拒绝；确认 UI 表达候选而非已经掌握，无合法 ActionRecord 时不虚构记录。
6. 关闭并重开，确认只保留已确认的普通核心事实；关闭 AI 后复查 Action/Record/Progress/Recovery/Review/export。

人工结果只能由项目所有者报告为 `pass`、`fail`、`partial` 或 `pending` 并附观察；Agent 不代签。

### 10.4 Evidence 与环境

- OS：Windows；Node/Electron/package 版本从实际命令与 lockfile记录。
- Evidence 目录：忽略的 `.tmp/evidence/`，不得写 stdout/stderr、key、AI request/response、用户文本、绝对用户路径或环境变量正文。
- 每次失败保留 artifact，后续成功用 `supersedes` 关联，不删除历史失败。
- 本地 source revision、PR head、GitHub test-merge、T807 delivery、dev integration 和 S6 product revision分别记录。

## 11. Git 与 GitHub 权限

- [x] 允许使用现有独立验收分支 `codex/s6-final-acceptance`。
- [x] 允许创建本地提交。
- [x] 允许推送该验收分支。
- [x] 允许创建或更新到 `dev` 的 Draft PR。
- [ ] 不允许 Agent 将 Draft 标记为 Ready。
- [ ] 不允许 Agent 合并到 `dev`。
- [ ] 不允许 Agent 创建或合并 `dev → main` PR。
- [ ] 不允许 Agent 创建 tag、GitHub Release 或上传发布资产。

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

## 12. 依赖与外部操作权限

- 新增/升级依赖：无。
- 网络访问：仅 `git fetch/push`、创建/读取 T807 Draft PR 和 GitHub Actions 状态；不得调用 LiteLLM。
- AI Provider：普通自动化只允许 fake；已实现 LiteLLM adapter 仅作静态审查和未配置/隔离行为验证。
- 外部写入：仅推送 `codex/s6-final-acceptance` 和创建/更新到 `dev` 的 Draft PR。
- 数据破坏性操作：无；合同删除仅在精确 docs closeout 获批后通过普通 Git 提交执行，可从记录 revision 恢复。

```yaml
integration:
  target_branch: dev
  base_revision: dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: f06b1e97da07dffc05814518ad8ad83ed3e051b9
```

## 13. 执行 Gate

1. **Task Gate**：合同、metadata、Task Index 激活并通过 metadata/format/diff 校验。
2. **Source Gate**：重新确认最新 `origin/dev` 与固定 source；若 `dev` 推进，按 freshness 评估并重跑受影响范围。
3. **Coverage Gate**：按第 16.1 节完成并验证 owner-approved test-only 修复，逐项将 S6 §13.2/§13.3 映射到真实测试断言；仍有缺失即停止通过声明。
4. **Candidate Gate**：定向测试、affected AC、`verify`、package、package smoke、完整 diff 与独立只读 review 全部通过。
5. **Manual Gate**：向项目所有者提交第 10.3 节；实际结果前 S6 final gate 为 `pending`。
6. **Docs Gate**：提交精确 documentation impact matrix，获得项目所有者批准后才归档/删除 T061～T063 合同并更新长期文档。
7. **Final-head Gate**：在最终 docs head 重跑合同规定检查并取得精确 head 的 Windows hosted CI。
8. **PR Gate**：创建到 `dev` 的 Draft PR并交还项目所有者；Agent 不 Ready、不 merge。
9. **Milestone Gate**：T807 实际合入最新 `dev` 后，准备 `dev → main` 正文与发布说明；创建 PR、版本号、Ready、merge、tag 和 Release 均另行审批。

## 14. 风险与停止条件

- 现有 continuous E2E 或分支矩阵不能真实覆盖 S6 §13.2/§13.3；不得以分散绿测或静态推断冒充通过。
- required test、package、security、hosted CI 或人工 AC-02 失败/无法绑定固定 revision。
- `dev` 推进导致固定 source 过时或出现未解释 main-only/unapproved 内容。
- 必须修改生产、测试、依赖、migration、Provider、配置或 CI 才能通过。
- 证据包含敏感信息、真实用户数据、AI request/response、key 或无法保留失败历史。
- 需要扩大 AI 上下文、写权限、自动 retry、持久化或引入 S7/延期行为。
- 缺少 docs closeout、Ready、merge、tag、Release、真实 Provider 或其他外部写入授权。

出现以上情况时停止受影响门禁，保留实际 branch/revision/command/artifact，并按 Escalation Proposal 流程申请新权限；不得把 partial/blocked 改写为 pass。

## 15. 完成报告

必须报告：固定 S6 product revision、T807 delivery 与 dev integration revision；T061～T063 及 FR/AC/D/ED 覆盖；本地和 hosted commands/artifacts；人工 AC-02；package、security、reopen/export；上下文、零写入与凭据隔离结论；真实 Provider 是否验证；文档归档和 PR 状态；候选版本/发布说明；失败、限制、风险、冲突、范围变化及剩余 owner gates。

T807 只有在合同要求的自动化、人工、文档、final-head CI 和 Draft PR handoff 都有真实证据时才能成为 `done`。T807 完成不表示已 Ready、已合入 `dev`/`main`、已 tag、已 Release 或已启动 S7。

## 16. Coverage Gate 停止记录

2026-09-01 在分支 `codex/s6-final-acceptance`、合同激活 revision `eed194a09f6d1545a69fcd292fdbb409a7570054` 对固定产品 source 做只读测试覆盖审计，结论为 `blocked`：

- `tests/e2e/ai-start-help-ac02.e2e.test.ts` 已连续证明 draft/关闭/拒绝/stale confirm 为零写入、主动 retry、编辑后 Action 确认、两个 Understanding 确认、export 与重开守恒。
- 该连续用例只创建一个 Goal 和一条 ActionRecord，没有第二 Goal、Routine、ReviewResult、六条相关 Record 或禁止唯一标记；没有观察 Provider call count/request capture，因此未证明“未触发零调用”和“同一连续 DB 的跨 Goal/最多 5 条上下文隔离”。
- 用例只确认编辑后的 Action suggestion，没有单独确认 Provider 原建议；只返回并确认两个 Understanding，没有第三项拒绝或无合法 ActionRecord 分支。
- `tests/e2e/ai-start-help-degradation.e2e.test.ts` 在 timeout 场景中立即点击取消，没有等待 Main deadline 产生 `timeout`；not-configured、invalid response 和 cancel 分散在每次重置数据库的独立进程。
- timeout 后 retry、旧 late response 被释放且不能覆盖新 generation，以及 authentication/network/provider-unavailable 在核心 snapshot 不变时手工路径仍可用，只在较低层或分散场景有证据，未满足 S6 §13.2 要求的同一数据库连续 E2E。

因此当时未开始 T807 Candidate Gate 的 `verify`、package 或 package smoke，也未创建 Draft PR；绿色 task-level 测试没有被提升为 S6 aggregate pass。

### 16.1 项目所有者追加批准的 test-only 修复

项目所有者于 2026-09-01 先批准 T808，随后明确废弃 T808，并指示所有修复在 T807 上进行。T808 本地分支相对 `origin/dev` 独有提交数为 0，没有合同、文件、commit、push 或 PR，已安全删除。

T807 获准实施以下单一例外：

- 只在 `src/main/index.ts` 已有的 `NODE_ENV=test` 离线 seam 内建立进程内 scripted fake sequence；它可以用确定性响应顺序证明未触发时未消费调用、检查 Provider-facing DTO 的 allowlist/最多 5 条/禁止 marker，并模拟 timeout、late response 和已批准错误分类。
- 只在 `tests/e2e/ai-start-help-ac02.e2e.test.ts` 扩展同一临时 SQLite/`userData` 的 continuous 程序，覆盖原文接受、编辑确认、拒绝、关闭、取消、真实 timeout、invalid response、authentication/network/provider failure、timeout retry/late response、第三条 Understanding 拒绝和无合法 ActionRecord。
- 所有测试输入、key 和 marker 为合成值；不得读取真实 key、调用 LiteLLM、访问真实 `userData` 或把 request/response 写入日志、SQLite、export 或公开 IPC。
- 禁止修改 Preload/Renderer/IPC/Provider Port、依赖、schema、migration、产品配置、非测试网络路径、AI 上下文选择规则或核心写权限。

修复后必须从定向 continuous E2E 开始，依次重跑 affected AC、`verify`、package/package smoke、完整 diff 与独立 review。任何超出上述两个文件或改变非测试行为的需要均重新触发停止条件。

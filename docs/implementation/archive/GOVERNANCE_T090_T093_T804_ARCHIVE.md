# MyTracer v0.1 治理与界面基础归档：T090～T094、T804/T805

> 状态：已归档；本文只保留已完成治理任务对后续维护、验证和审计仍有价值的最小信息
>
> 归档日期：2026-08-27
>
> 历史快照说明：下表和各项摘要记录任务完成时及后续集成核验的事实，不是新的任务合同、权限来源或当前状态账本。当前状态以 [`TASK_INDEX_V0.1.md`](../TASK_INDEX_V0.1.md) 为准，验证事实以 [`ACCEPTANCE_EVIDENCE_V0.1.md`](../ACCEPTANCE_EVIDENCE_V0.1.md) 为准。

## 1. 权威边界

- 本文不是产品需求、产品决定、工程决定、架构基线或实现授权。
- 完整合同已从当前实施目录收敛；原文仍可从下表所列 task delivery revision 的 Git 历史恢复，并由对应 PR 保留审计上下文。
- T803 不在本文重复归档；它已由 [`S3_T031_T033_ARCHIVE.md`](S3_T031_T033_ARCHIVE.md) 唯一承载。
- 失败、partial、superseded 和历史候选 Evidence 不因合同归档而删除或改写。
- T805 是当前进行中的文档收敛任务，仍由当前目录中的 T805 合同承载，不属于本文的已完成任务集合。

## 2. 最终交付索引

| Task | 目的与最小有效结果 | Task delivery revision | Dev integration revision | Evidence | 重要限制/后续边界 |
|---|---|---|---|---|---|
| T090 / GOV-01 | V2 第一、二批流程规范、Task Contract 字段、Stage Design 模板和 Escalation Proposal | `5b5211aa4904aef39b5e3f4366efbce08b8d3229` | `aeb0d68` / PR #23 | `EV-T090-001` | 当时没有真实产品任务试点；后续由 T031～T033/T803 实际使用 |
| T091 / GOV-02 | 确定性 evidence collector、脱敏 CI artifact、metadata 校验和规则同步 | `f12f5e5fa81cf23124be126f2e23486d518104bc` | `4674597` / PR #24 | `EV-T091-001` | 保留 corrected artifact 语义；不启动 T092，不声明产品验收 |
| T092 / GOV-04 | `standard-task@1` 定义、合同/metadata 接入边界、Worktree 生命周期和 Workflow 优化目标 | `9c7d9d3ae08dc7b32e9895deed1e43d26ca58985` | `7f5e2ed` / PR #32 | `EV-T092-001` | 方案定义阶段不包含真实 Skill、Workflow、ruleset 或 Profile 试点；实际接入由 T093 完成 |
| T093 / GOV-05 | Profile、项目 Skills、PR/CI 双 Gate、ruleset context 和长任务等待策略实际集成 | `189decb664b0ba2147f3ec1931eabd37bda6fc8d` | `2b31bc6be50d805f0dcad73a7a64cc3735a05d09` / PR #33 | `EV-T093-001`、`EV-T093-002` | Worktree cleanup 未实施；commit/PR-title convention 仍为建议；T041 未创建或启动 |
| T804 / GOV-03 | 长期文档中的任务、里程碑、tag/release 和 GitHub 配置事实统一收口 | `1610aae` | `d00a0b3` / PR #31 | `EV-T804-001` | `user/` 文档和未跟踪 `.agents.backup/` 按合同排除；不改变产品语义或 GitHub 配置 |

## 3. 各任务保留事实

### T090

- 建立 V2 第一、二批的任务合同、阶段设计、升级提案和执行边界。
- 完成时明确“文档已落地、尚未通过真实任务运行验证”；该限制后来由 T031～T033/T803 的真实使用事实补足，但不应从历史记录中删除。

### T091

- 建立显式 argv 的证据采集、真实退出码保留、脱敏 artifact 和 metadata 校验能力。
- 修正了 PR head 与 test-merge revision 的 Evidence 语义；旧错误记录保留并由 corrected candidate 取代。

### T092

- 定义 `standard-task@1`、生命周期阶段、owner gate、受控扩展点和基础 validator 边界。
- T092 有意只完成治理方案和基础校验；“尚未接入 Skill/Workflow”的措辞属于 T092 完成时的历史快照，不是当前状态。

### T093

- 将 Profile 接入 development Skill，建立 Stage Design 与 Stage Acceptance/Release Skills、PR Quality、分层 CI、统一 `CI Gate` 和 ruleset required-context 切换。
- PR #33 已合入 `dev@2b31bc6be50d805f0dcad73a7a64cc3735a05d09`；post-merge Verification run `32954788941` 的 required checks 通过。
- 未实现的 Worktree 安全释放、未启动 T041、未升级为 required 的 commit/PR-title convention 仍是明确限制。

### T804

- 统一了当时 tracked 长期文档中的任务、阶段、发布和 GitHub 配置事实，并保留历史候选、失败和权限边界。
- T804 不负责删除历史合同；本次 T805 才按既有 S0～S3 归档模式收敛已完成合同。

## 4. 完整合同恢复入口

以下命令只用于需要审计原合同全文时恢复到临时路径；不会改变当前任务状态：

```powershell
git show 5b5211aa4904aef39b5e3f4366efbce08b8d3229:docs/implementation/T090_AGENT_PROCESS_REVISION_V2.md
git show f12f5e5fa81cf23124be126f2e23486d518104bc:docs/implementation/T091_AGENT_PROCESS_AUTOMATION.md
git show 9c7d9d3ae08dc7b32e9895deed1e43d26ca58985:docs/implementation/T092_STANDARD_TASK_PROFILE.md
git show 189decb664b0ba2147f3ec1931eabd37bda6fc8d:docs/implementation/T093_PROFILE_SKILLS_CI_INTEGRATION.md
git show 1610aae:docs/implementation/T804_DOCUMENT_FACT_CLOSEOUT.md
```

T803 的完整合同恢复入口和最终聚合结果继续保留在 `S3_T031_T033_ARCHIVE.md`。

## 5. 当前维护规则

- 当前运行规则使用 [`GITHUB_WORKFLOW_V0.1.md`](../GITHUB_WORKFLOW_V0.1.md)、[`AUTOMATION_PROFILES_V0.1.md`](../AUTOMATION_PROFILES_V0.1.md) 和任务模板；不从本文恢复 Profile、Skill、Workflow 或外部写入权限。
- 当前任务状态只看 [`TASK_INDEX_V0.1.md`](../TASK_INDEX_V0.1.md)；归档表中的 revision 是审计导航，不是第二份状态账本。
- 当前验证和失败保留只看 [`ACCEPTANCE_EVIDENCE_V0.1.md`](../ACCEPTANCE_EVIDENCE_V0.1.md)；本文不重复完整命令日志、CI artifact 或人工验收记录。

## T805

整理已完成治理合同、精简重复状态叙述并建立历史边界，不改需求、架构或 GitHub 配置。PR #34 final head 979fa1cd11da9c0e4a28e6c37e63a3e8e695c95f，dev integration 353a4d42921175374dec178a75ad2748eb184cdf。结果见[EV-T805-001/002](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t805-002)，完整合同见[恢复索引](INDEX.md#完整文本恢复)。

## T094

只重构 Renderer ownership：App 组合 ErrorBoundary/AppShell，AppShell 管理壳层与 section，各 feature 拥有页面状态、DTO、IPC、刷新和错误文案。没有改变 CSS、布局、文案、Main/Preload/Domain/SQLite、依赖或产品语义；不创建全局 Store、Router 或通用 service。

候选与 task delivery 为 543180b85960334808563af49d0aa96caab31b00；PR #35 final head e2d75b16c142057ab43e600ae3d010464f9adf13，dev integration 2632ff0638fb02533100a1f9d0aea9f1323dbde3。自动化、打包、独立 review 与后续 CI 见[EV-T094-001](../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t094-001)。原合同同环境六 section 视觉对比仍是历史 pending，本次不由后续自动化或合并代签。完整合同见[恢复索引](INDEX.md#完整文本恢复)。

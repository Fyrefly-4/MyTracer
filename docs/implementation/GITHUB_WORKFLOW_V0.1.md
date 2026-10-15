# MyTracer Git、PR、CI 与发布操作

本文用于日常变更的具体操作。范围与权限以 [AGENTS.md](../../AGENTS.md) 和 owner 当次请求为准；查阅本文不会启用阶段合同或交付流程。

## 1. 分支与本地工作

- 普通变更使用描述性的 `codex/<short-name>` 分支，保留无关本地修改；不要把例行修复写成 Txxx 合同。
- 以 owner 指定的起点开展工作；准备集成时检查与目标分支的差异、冲突和验证结果。普通变更 PR 目标为 `dev`，`main` 用于已接受的版本和发布来源。
- 本地 branch/worktree/commit 可由当次请求授权。push、PR 写入和其他外部写入需要明确授权；已有授权不重复询问。
- worktree 不复制凭据或真实用户数据；同一分支不能同时在多个 worktree 检出。具体命令以当前 Git 状态和环境为准。

## 2. PR 说明与评审

创建或更新 PR 前读取 [PR 模板](../../.github/pull_request_template.md)。默认写明变更说明、实际验证和必要风险；简单变更可以合并栏目，删除不适用标题和提示。普通 PR 无需 Txxx、需求编号或正式 Evidence 字段。

审查完整 diff，关注行为、数据与安全边界及回归。是否需要另一个独立评审由 owner 或明确启用的工作流决定；PR 正文与标题结构不是 CI 门禁。

Ready、合并到 dev/main、推进 main、tag、release、force push 和删除远端分支均按 owner 对具体动作的授权执行；不得绕过 required checks 或 branch protection。普通变更合入 dev 采用 squash；dev 到 main 和 main 回流 dev 的同步采用普通 merge，保留祖先关系。执行合并前核对实际父提交、merge-base 和差异，不从历史文档推定分支状态。

## 3. 日常 CI

源码入口为 [verify.yml](../../.github/workflows/verify.yml)，只定义一个 Windows job，稳定检查名为 `CI Gate`。

| 触发 | 行为 |
| --- | --- |
| 目标为 dev/main 的 PR opened、synchronize、reopened | 按变更文件选择轻检查或完整验证 |
| 手动运行 Verification | 完整验证 |
| 编辑 PR 正文/标题、切换 Draft/Ready、dev/main push | 不自动重复日常 CI |

| 变更范围 | 检查 |
| --- | --- |
| 纯 Markdown、AGENTS、Skill 说明及 agents/openai.yaml 元数据 | 本地链接、Markdown 结构与 diff integrity，不安装应用依赖 |
| src/tests/tools、工作流、依赖、构建配置、混合或未知路径 | 轻检查，加锁定依赖安装、格式、lint、类型、单元、集成、构建和真实 Electron E2E |

分类器优先识别执行目录；其中的 Markdown/YAML 也走完整验证。PR 默认 checkout GitHub test-merge revision，分类和验证绑定实际检出的 revision；不使用旧 head 的成功结果替代。分类、文档或验证步骤失败都会使 job 失败。手动运行用于额外验证，不代替 PR required checks。

CI 不检查 PR 正文，不校验历史任务账本或 Profile，不创建正式阶段证据，也不打包。使用 npm 下载缓存，依赖仍以 `npm ci` 安装；失败时保留隔离测试诊断，不记录真实用户数据或凭据。

完整验证命令为 `npm.cmd run verify`；该命令不安装依赖、不打包、不发布、不执行 live AI，也不修改 tracked 文件。测试范围、隔离与本地命令见[维护入口](../MAINTENANCE.md#开发与验证)。

## 4. 候选构建与正式发布

- [Update candidate](../../.github/workflows/update-candidate.yml) 仅由手动 workflow_dispatch 触发。对所选确切来源执行完整 verify、禁止发布的 NSIS 打包、隔离安装 smoke、unsigned 和 bundle 校验。
- 普通 PR 和 main push 不自动生成候选。准备正式更新时先手动构建 main 候选；历史来源按稳定 tag 重建，并核对 main ancestry。
- [Publish accepted update](../../.github/workflows/update-publish.yml) 仅由合规版本 tag 触发。Owner 身份、确切 source/run/artifact/hash、版本递增、不覆盖已有 Release 及重新验证固定产物的边界保持不变。
- 候选成功不等于正式发布；Agent 不因候选或 CI 通过而自行创建 tag、合并或发布。

具体操作、凭据与故障处置见[发布维护](../maintenance/RELEASE.md)和[更新维护](../maintenance/UPDATE.md)。

## 5. 分支保护与远端事实

必需 workflow 不使用 paths/paths-ignore 跳过整个运行，确保文档 PR 也报告 `CI Gate`。远端 rulesets 是实时事实；执行集成前核对实际 required checks、讨论解决和分支限制。当前 workflow 已移除 `Windows required gate`，不能用 `CI Gate` 绿色推定其他 required checks 已解除。

需要核实的远端配置用只读查询确认；本地文档不证明远端已部署。不要把 classic branch protection API 的 404 解释为采用 rulesets 的分支没有保护。

## 6. 历史与显式阶段流程

历史里程碑、交付/集成 revision、失败与豁免仅在需要追溯时从[归档索引](archive/INDEX.md)查找，不是开始普通工作的前置条件。

合同、Profile、Integration Freshness、阶段独立评审、正式证据、文档收口与长任务策略集中在[显式阶段工作流参考](STAGE_WORKFLOW_REFERENCE.md)。只有 owner 为当前工作明确启用相应阶段 Skill/流程时才读取并应用；旧批准、未完成条目或查阅行为不会恢复其执行权限，也不会恢复旧 CI。

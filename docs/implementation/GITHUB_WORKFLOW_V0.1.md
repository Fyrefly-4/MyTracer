# MyTracer Git、PR、CI 与发布操作

本文用于日常变更的具体操作。范围与权限以 [AGENTS.md](../../AGENTS.md) 和 owner 当次请求为准；查阅本文不会启用阶段合同或交付流程。

## 1. 分支与本地工作

- 普通变更使用描述性的 `codex/<short-name>` 分支，保留无关本地修改；不要把例行修复写成 Txxx 合同。
- 默认从最新核实的 `main` 创建工作分支，owner 另行指定来源时按其要求执行；PR 目标为 `main`。准备集成时检查与目标分支的差异、冲突和验证结果。
- `main` 是已接受的维护基线；正式版本由 tag、Release 和确切发布源及资产标识。普通代码合入 `main` 不自动发布；合并 Release Please 的发布 PR 是该版本的发布决定。
- 停用 `dev` 作为集成目标，不再创建 `dev -> main` 晋级或 `main -> dev` 回流 PR。历史分支、提交与验收记录保留原含义，不据此恢复旧流程。
- 本地 branch/worktree/commit 可由当次请求授权。push、PR 写入和其他外部写入需要明确授权；已有授权不重复询问。
- worktree 不复制凭据或真实用户数据；同一分支不能同时在多个 worktree 检出。具体命令以当前 Git 状态和环境为准。

## 2. PR 说明与评审

创建或更新 PR 前读取 [PR 模板](../../.github/pull_request_template.md)。默认写明变更说明、实际验证和必要风险；简单变更可以合并栏目，删除不适用标题和提示。普通 PR 无需 Txxx、需求编号或正式 Evidence 字段。

审查完整 diff，关注行为、数据与安全边界及回归。是否需要另一个独立评审由 owner 或明确启用的工作流决定；PR 正文与标题结构不是 CI 门禁。

Ready、合并到 main、tag、release、force push 和删除远端分支均按 owner 对具体动作的授权执行；不得绕过 required checks 或 branch protection。工作分支通过 PR 合入 main；可根据提交结构和审阅需要选择 merge、squash 或 rebase，不限制为单一合并方式。PR 保留开发提交、讨论和检查历史。刷新已发布工作分支时可普通 merge 最新 main，重新检查受影响范围，不 force-push 改写已发布历史。执行合并前核对实际来源、目标和完整差异，不从历史文档推定分支状态。

## 3. 日常 CI

源码入口为 [verify.yml](../../.github/workflows/verify.yml)，只定义一个 Windows job，稳定检查名为 `CI Gate`。

| 触发 | 行为 |
| --- | --- |
| 目标为 main 的 PR opened、synchronize、reopened | 按变更文件选择文档、发布工具或完整验证三档 |
| 手动运行 Verification | 完整验证 |
| 编辑 PR 正文/标题、切换 Draft/Ready、main push | 不自动重复日常 CI |

| 变更范围 | 检查 |
| --- | --- |
| 纯 Markdown、AGENTS、Skill 说明及 agents/openai.yaml 元数据 | 本地链接、Markdown 结构与 diff integrity，不安装应用依赖 |
| 显式白名单中的纯发布配置、脚本和回归测试（可混合文档） | 轻检查，加 `npm ci --ignore-scripts`、格式、lint、类型检查、CI governance 与发布回归；不安装 Electron、不构建应用、不跑 UI E2E |
| 应用源码、非白名单 tests/tools、工作流、依赖、构建/测试配置、混合应用或未知路径 | 轻检查，加锁定依赖安装、格式、lint、类型、单元、集成、构建和真实 Electron E2E |

发布工具白名单以 `tools/ci/classify-changes.mjs` 为准，只列出已覆盖的确切文件，不按整个 `tools/release/` 目录放行。新增工具、打包/安装更新脚本、CI workflow、分类器和 governance 测试自身变更仍走完整验证；空差异与手动运行也走完整验证。执行目录里的 Markdown/YAML 不算纯文档。重命名同时检查旧、新路径，删除应用文件不能降档。缺失或无效分类直接失败，不会跳过所有检查变绿。PR 默认 checkout GitHub test-merge revision，分类和验证绑定实际检出的 revision；不使用旧 head 的成功结果替代。分类、文档或验证步骤失败都会使 job 失败。手动运行用于额外验证，不代替 PR required checks。

CI 不检查 PR 正文，不校验历史任务账本或 Profile，不创建正式阶段证据，也不打包。使用 npm 下载缓存，依赖仍以 `npm ci` 安装；失败时保留隔离测试诊断，不记录真实用户数据或凭据。

发布工具验证命令为 `npm.cmd run verify:release-tooling`（Windows；保留 PowerShell 资产解包回归）。它运行全仓只读格式、lint 和 TypeScript 类型检查（含测试），以及明确列出的 governance/发布单元与集成测试；不执行真实 GitHub 写入、安装或发布。发布 PR 的聚合 Node 场景仍有 60s 子进程上限，只有该 Vitest 包装测试使用 70s 外层预算，超时和非零退出仍失败，不重试。

完整验证命令为 `npm.cmd run verify`；该命令不安装依赖、不打包、不发布、不执行 live AI，也不修改 tracked 文件。测试范围、隔离与本地命令见[维护入口](../MAINTENANCE.md#开发与验证)。

## 4. 发布 PR 与自动发布

- [Release workflow](../../.github/workflows/release.yml) 在 main push 时维护 Release Please 的发布 PR。普通代码合入只积累版本和更新记录，不自动打包发布。
- 三档仅优化日常 PR 检查，不削减实际发布门禁。owner 想发布时合并发布 PR；这一次决定授权 workflow 固定发布 SHA，自动验证、NSIS 打包、隔离安装 smoke、上传完整更新资产并将草稿转为正式 stable Release，不再另行下载候选或批准 tag。
- 版本由约定式提交计算；推荐普通功能 PR squash merge，最终标题使用 `fix:`、`feat:` 等前缀，中文说明可以保留。需要手动指定下一版时使用进入 main 的提交正文 `Release-As: X.Y.Z`。
- `package.json`、lock、tag 与更新元数据必须一致；发布完整文件后才公开版本。同版本失败仅能恢复经身份校验的草稿，不覆盖正式版本，也不重新选择最新 main 构建旧版本。
- 旧手动候选和 owner tag 发布 workflow 退出有效流程，避免两条入口并行。Agent 不因 CI 通过或发布 PR 已准备好而自行合并、创建 tag 或发布。
- bot PR 的检查和权限按 GitHub 实际配置执行；不得移除 required checks 或私自配置长期凭据来绕过限制。

详细规则、首次基线、故障重试和验证限制见[发布维护](../maintenance/RELEASE.md)，公共更新与旧版迁移见[更新维护](../maintenance/UPDATE.md)。

## 5. 分支保护与远端事实

必需 workflow 不使用 paths/paths-ignore 跳过整个运行，确保文档 PR 也报告 `CI Gate`。远端 rulesets 是实时事实；执行集成前核对实际 required checks、讨论解决和分支限制。当前 workflow 已移除 `Windows required gate`，不能用 `CI Gate` 绿色推定其他 required checks 已解除。

需要核实的远端配置用只读查询确认；本地文档不证明远端已部署。不要把 classic branch protection API 的 404 解释为采用 rulesets 的分支没有保护。

切换时核实 main 为默认分支、允许普通工作分支 PR、要求当前有效的 `CI Gate` 和讨论解决，并保留禁止强推等保护；排查旧 required checks、来源限制、未完成 PR 和外部自动化对 dev 的依赖。远端配置修改需要明确授权。确认所需内容已进入 main 且依赖已解除后，才在独立删除授权下处置远端 dev；本地流程变更不表示远端分支已经删除。

## 6. 历史与显式阶段流程

历史里程碑、交付/集成 revision、失败与豁免仅在需要追溯时从[归档索引](archive/INDEX.md)查找，不是开始普通工作的前置条件。

合同、Profile、Integration Freshness、阶段独立评审、正式证据、文档收口与长任务策略集中在[显式阶段工作流参考](STAGE_WORKFLOW_REFERENCE.md)。只有 owner 为当前工作明确启用相应阶段 Skill/流程时才读取并应用；旧批准、未完成条目或查阅行为不会恢复其执行权限，也不会恢复旧 CI。

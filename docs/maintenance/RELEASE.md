# 私有发布维护

## 目标与边界

MyTracer 已用于 owner 的日常使用。发布流程服务于快速迭代：开发并合入 main，累积到想发布时合并 Release Please 的发布 PR，随后自动验证、打包并发布；本地应用继续使用内置更新。普通代码合并只更新发布 PR，不自动发布，也不再要求先手动构建、试用和批准候选包。

[Release workflow](../../.github/workflows/release.yml) 负责版本管理与发布编排。合并发布 PR 是这次版本发布的明确决定；构建成功后将草稿转为正式 Release 是同一次自动化的后续步骤，不新增第二次人工确认。Agent 创建实现 PR 不等于获准合并发布 PR、创建真实版本或操作用户数据库；具体权限仍以 owner 当次请求和 [AGENTS.md](../../AGENTS.md) 为准。

## 日常操作

1. 从 main 开发普通变更，通过 PR 和 `CI Gate` 合入 main。推荐 squash merge，并使用 `fix: 中文说明`、`feat: 中文说明` 等约定式提交标题。
2. Release Please 自动维护一张发布 PR，更新版本文件与 changelog。不想发布时保持该 PR 未合并，后续改动继续积累。
3. 想发布时检查该 PR 的版本、更新内容和必要 CI，再合并它。这是唯一的发布入口；不要另推 tag 或预先在 GitHub 页面手动创建同版 Release。
4. workflow 固定该发布的源 SHA，自动执行验证、Windows x64 NSIS 打包、隔离安装 smoke 和 unsigned 检查。安装包始终先以 `--publish never` 构建。
5. 所有更新文件上传并验证完成后，自动将该版本草稿转为 stable Release。构建或上传失败时不会提前公开半成品更新。
6. 在本地 MyTracer 中照常检查更新、确认下载和重启安装。发布流程简化不改变客户端保存草稿、关闭数据库或确认安装的保护。

发布 PR 是版本决定，不是普通功能 PR。不要启用自动合并发布 PR，否则会失去“积累后再发布”的决定点。

## 版本规则

配置使用根目录单应用的 Node 策略，标签为 `vX.Y.Z`。Release Please 同步 `package.json`、`package-lock.json` 和 changelog；不要再分别手工维护这些版本号。

以已发布 `0.1.5` 为例，一批尚未发布的提交共同决定下一版：

| 提交类别 | 建议版本 |
| --- | --- |
| `fix:` 修复问题 | `0.1.6` |
| `feat:` 增加功能 | `0.2.0` |
| `feat!:` 或 `BREAKING CHANGE:`，且当前仍为 0.x | 升 minor，例如 `0.2.0` |
| 纯 `docs:`、`test:`、`chore:`、`ci:` | 通常先积累，不单独产生应用发布 |

0.x 行为通过 `bump-minor-pre-major: true` 和 `bump-patch-for-minor-pre-major: false` 显式配置。进入 `1.0.0` 由 owner 明确决定；1.x 之后的破坏性变更遵循 major 递增。

需要指定下一版时，在一个进入 main 的提交正文中加入，例如：

```text
Release-As: 0.2.0
```

可以把该字段保留在普通 PR 的 squash commit 正文中。这不是普通 PR 评论命令，也不要仅修改 bot PR 的标题或某一个版本文件，避免自动更新覆盖或文件不一致。纯发布基础设施修复需要发版时也可明确指定版本，不必伪装成业务新功能。

## 首次接入与历史基线

接入时真实存在的已发布稳定版本是 `v0.1.4`，对应源 SHA `a5759763adc18739f8f65bcfc48f01db8f1ecd7f`。它原先作为 owner 授权的私有更新演练存在，本次保留原 tag、Release 和资产，不改写当时验收结论。

main 中的 `0.1.5` 只是旧流程的版本准备，没有同版已发布 Release，不能作为已发布基线。首次配置从 `0.1.4` 及其确切提交开始计算待发布改动；发布 PR 显示的实际版本仍须检查，不能把本页示例当作已经发出的版本。

首次接入后的真实端到端验证仍需在批准发布后进行：从实际旧版本发现新版本、校验下载、原位置安装，并确认既有数据、配置和重启后持久化正常。测试使用隔离安装身份和合成数据，不以日常数据库作为自动化测试夹具。这是流程迁移验证，不是以后每次发布都要重复的人工候选审批。

## 更新文件与凭据

继续使用现有私有仓库、Windows x64 NSIS、stable/latest 通道和 unsigned 策略。保持 appId、安装身份、数据目录以及客户端更新校验协议不变。每版必须完整上传：

- `MyTracer-${version}-x64-setup.exe`
- 对应安装包的 `.blockmap`
- `latest.yml`

源代码版本、tag、安装包名和 `latest.yml` 必须一致。客户端只接受稳定三段版本号，禁止降级；版本递增不代表数据库迁移已经验证安全。

本地更新器不依赖旧 `candidate-manifest.json`，因此不再将跨 workflow 的候选查找、14 天时效或手动批准作为发布前置条件。旧候选工具和测试夹具如仍保留，仅用于历史检查，不构成另一条有效发布入口。

CI 使用 GitHub Actions 的发布权限，客户端继续使用专用只读 `MYTRACER_UPDATE_TOKEN`；两者不得混用，不将 CI token 写入安装包。既有客户端凭据无需因接入 Release Please 而重建。配置、轮换与恢复见[更新与凭据维护](UPDATE.md)。

## 重试与故障处理

- 查看失败步骤和安全错误码。日志不得输出原始凭据、签名下载 URL、环境变量或 API 响应全文。
- 失败重试只能恢复与已合并发布 PR、版本、tag 和源 SHA 对应的草稿；不能从任意旧草稿挑选一个发布，也不能让普通 push 自动续发旧版本。
- 首选 GitHub 的 **Re-run failed jobs**：保留已成功选择的发布 SHA 和已构建资源，仅重试失败阶段。不能把最新 main 的文件混入原版本。
- **Re-run all jobs** 只在该次 push SHA 就是已批准发布 PR 的合并 SHA 时保证自动恢复。若 main 已前进、原运行替更早的发布 PR 创建草稿，应使用 Re-run failed jobs；全量重跑不会任意续发旧草稿。Release Please 本身失败时先修复该步骤，不能跳过批准来源校验。
- tag 被移动、版本不一致、出现更高正式版本或完整性检查失败时停止发布，保留现场；不能通过放宽校验或覆盖正式版本恢复。
- 已经正式公开的版本不可覆盖。若需要改代码，使用更高版本修复；串行发布和版本递增检查共同防止旧任务晚完成后成为 latest。
- `draft` 是自动化中间状态，不是要求 owner 再次批准的关卡。失败草稿不会成为客户端稳定更新。

## GitHub 配置与验证限制

Release Please 需要仓库允许 GitHub Actions 创建 PR，且 workflow token 具备声明的最小权限。当前实现使用 `GITHUB_TOKEN`。[GitHub 当前文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)说明，它创建或更新 PR 的 opened/synchronize/reopened 事件会产生等待批准的 CI。仓库保留 required `CI Gate`：若发布 PR 显示 **Approve workflows to run**，需有写权限的 owner 批准运行后才能合并；不能把这个额外点击假装成已经自动解决。手动或自动 `workflow_dispatch` 不能代替这个 required check：[GitHub 说明](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)该事件的 job 检查不满足 branch ruleset。

若希望这一步也自动化，需另外评估获准的 GitHub App 认证，让 PR 事件直接触发检查；不能仅添加 dispatch 权限来声称已解决。本次不创建凭据、不更改仓库权限设置。不要为减少点击而移除 `CI Gate` 或绕过分支保护。仓库是否允许 Actions 创建 PR 的管理设置在当前连接权限下无法确认，首次运行若被拒绝需 owner 检查该设置。

同一 workflow 使用 Release Please 的输出连接打包，不依赖 `GITHUB_TOKEN` 创建的 tag/Release 继续触发另一条 workflow。不要同时保留旧 `update-candidate.yml` 与 `update-publish.yml` 的发布路径。

实现 PR、离线测试和模拟接口测试不证明新流程已经部署或真实更新成功。合入 main 前后都应区分：已通过的源码/CI 检查、尚未发生的真实发布，以及待执行的首次升级验证。Secrets、App 安装、权限与 ruleset 修改仍需对应授权。

## 本地构建

```powershell
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

本地构建不隐式发布。普通 `verify` 不打包、不实装、不执行 live AI，不触碰真实用户数据。旧 `release:validate` 只用于只读检查已有历史候选 bundle，不是新流程的批准命令。

参考：[Release Please](https://github.com/googleapis/release-please)、[Release Please Action](https://github.com/googleapis/release-please-action)、[GitHub Release API](https://docs.github.com/en/rest/releases/releases)。外部文档不替代本仓库实际验证。

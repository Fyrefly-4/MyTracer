# 发布维护

## 目标与边界

MyTracer 已用于 owner 的日常使用。发布流程服务于快速迭代：开发并合入 main，累积到想发布时合并 Release Please 的发布 PR，随后自动验证、打包并发布；本地应用继续使用内置更新。普通代码合并只更新发布 PR，不自动发布，也不再要求先手动构建、试用和批准候选包。

[Release workflow](../../.github/workflows/release.yml) 负责版本管理与发布编排。合并发布 PR 是这次版本发布的明确决定；构建成功后将草稿转为正式 Release 是同一次自动化的后续步骤，不新增第二次人工确认。Agent 创建实现 PR 不等于获准合并发布 PR、创建真实版本或操作用户数据库；具体权限仍以 owner 当次请求和 [AGENTS.md](../../AGENTS.md) 为准。

仓库可为 private 或 public：发布与来源校验都要求 GitHub 返回的 `private` 字段为布尔值，同时固定仓库全名 `Fyrefly-4/MyTracer` 与 ID `1326905280`；缺失或错误类型不会被当作 public 接受。可见性变化不放宽源提交、workflow、制品、发布 PR 审批、草稿完整性或重试规则。此兼容性不负责修改仓库可见性或凭据权限。

包含公共更新改动的新版客户端无需 token；已安装旧版仍需有效的原只读 token，或手动覆盖安装一次新版。公开仓库的正式 Release 对公众可见；草稿仍须先完成全部验证才能发布。不要将仓库 public/private 与 Release draft/published 混为一谈。

## 日常操作

1. 从 main 开发普通变更，通过 PR 和 `CI Gate` 合入 main。推荐 squash merge，并使用 `fix: 中文说明`、`feat: 中文说明` 等约定式提交标题。
2. Release Please 自动维护一张发布 PR，更新版本文件与 changelog。不想发布时保持该 PR 未合并，后续改动继续积累。
3. 想发布时检查该 PR 的版本、更新内容和必要 CI，再合并它。这是新版本的发布决定入口；不要另推 tag 或预先在 GitHub 页面手动创建同版 Release。
4. workflow 固定该发布的源 SHA，自动执行验证、Windows x64 NSIS 打包、隔离安装 smoke 和 unsigned 检查。安装包始终先以 `--publish never` 构建。
5. 所有更新文件上传并验证完成后，自动将该版本草稿转为 stable Release。构建或上传失败时不会提前公开半成品更新。
6. 在本地 MyTracer 中照常检查更新、确认下载和重启安装。发布流程简化不改变客户端保存草稿、关闭数据库或确认安装的保护。

配置启用 Release Please 原生的 `always-update: true`：已有发布 PR 时，即使后续 main 提交只有文档或维护改动、版本和 changelog 不变，bot 也会刷新该 PR，使其跟上 main。刷新后应等待最新 head SHA 的 `CI Gate` 通过再合并；这不绕过严格分支检查，也不会自动发布。若没有待发布的变更，该选项本身不会强制创建新发布 PR。

发布 PR 是版本决定，不是普通功能 PR。不要启用自动合并发布 PR，否则会失去“积累后再发布”的决定点。

## 版本规则

配置使用根目录单应用的 Node 策略，标签为 `vX.Y.Z`。Release Please 同步 `package.json`、`package-lock.json` 和 changelog；不要再分别手工维护这些版本号。

假设将来某次已发布版本为 `0.1.5`，以它为例，一批尚未发布的提交共同决定下一版：

| 提交类别 | 建议版本 |
| --- | --- |
| `fix:` 修复问题 | `0.1.6` |
| `feat:` 增加功能 | `0.2.0` |
| `feat!:` 或 `BREAKING CHANGE:`，且当前仍为 0.x | 升 minor，例如 `0.2.0` |
| 纯 `docs:`、`test:`、`chore:`、`ci:` | 通常先积累，不单独产生应用发布 |

0.x 行为通过 `bump-minor-pre-major: true` 和 `bump-patch-for-minor-pre-major: false` 显式配置。进入 `1.0.0` 由 owner 明确决定；1.x 之后的破坏性变更遵循 major 递增。

### 手动指定下一版本

默认让 bot 按上表计算；owner 也可以指定尚未发布的目标版本，例如 `0.3.0`（这里只是示例，不代表已经发布或本次必须发布）。

1. 在普通变更 PR 的最终 **squash commit 正文**保留下面的字段，标题仍按实际变更使用 `fix:`、`feat:` 等。合并前在 GitHub 的 squash 确认框核对正文，不能只放在 PR 评论中：

   ```text
   Release-As: 0.3.0
   ```

2. 该提交合入 main 后，等待 Release Please 创建或更新发布 PR。这个步骤只提出版本，**不会发布应用**。
3. 检查 bot PR 中的版本、`package.json`、`package-lock.json`、`.release-please-manifest.json` 和 changelog 已同步，再等**最新 head SHA** 的 `CI Gate` 通过。准备好发布时，才由 owner 合并发布 PR，或在 owner 对这次合并明确授权后由 Agent 操作。

**已有发布 PR 想改号：**先保持它未合并，按上述方法把新的目标版本带入 main，等 bot 更新后再审查。不要仅改 bot PR 标题或某一个版本文件；自动更新可能覆盖手工修改，文件也可能不一致。这里改的是“下一版提案”，不是已经发布的版本。

**暂时没有业务代码要改：**可以随实际需要的文档或维护 PR 携带上述正文，不必伪装成新功能。若只有改号需求，可通过正常 PR 在 `release-please-config.json` 的 `packages["."]` 中临时设置 `"release-as": "0.3.0"`；不要改 manifest 冒充已发布基线。该配置会持续生效，发布 PR 合并后须另开普通 PR 移除它，恢复自动计算；不要同时保留冲突的配置和提交指令。优先使用一次性的提交正文方式，不为改号绕过分支保护直推 main，也不要求创建没有文件差异的空 PR。

目标必须是高于已发布版本的稳定三段版本号。已发布版本/tag 不覆盖，客户端不降级；发现发布错误应发更高版本修复。只是调整版本不改变[内置更新流程](UPDATE.md)，也不代表安装、数据或迁移已经验证。

操作依据：[提交正文 Release-As](https://github.com/googleapis/release-please#how-do-i-change-the-version-number)、[manifest 配置 release-as](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#configfile)。

### 历史 v1.0.0 版本提案

notebook UI 调整曾以 **v1.0.0** 为发布目标，并通过临时 `release-as` 配置提出版本。该提案属于历史背景，不是当前待执行的发布步骤；不要重新应用旧版本覆盖或重启实验分支的发布流程。后续版本以实际 tag、Release、版本文件及发布 PR 为准，手动改号遵循上面的通用流程。

## 首次接入与历史基线

接入时真实存在的已发布稳定版本是 `v0.1.4`，对应源 SHA `a5759763adc18739f8f65bcfc48f01db8f1ecd7f`。它原先作为 owner 授权的私有更新演练存在，本次保留原 tag、Release 和资产，不改写当时验收结论。

main 中的 `0.1.5` 只是旧流程的版本准备，没有同版已发布 Release，不能作为已发布基线。首次配置从 `0.1.4` 及其确切提交开始计算待发布改动；发布 PR 显示的实际版本仍须检查，不能把本页示例当作已经发出的版本。

首次接入后的真实端到端验证仍需在批准发布后进行：从实际旧版本发现新版本、校验下载、原位置安装，并确认既有数据、配置和重启后持久化正常。测试使用隔离安装身份和合成数据，不以日常数据库作为自动化测试夹具。这是流程迁移验证，不是以后每次发布都要重复的人工候选审批。

## 更新文件与凭据

继续使用固定身份的现有仓库、Windows x64 NSIS、stable/latest 通道和 unsigned 策略。保持 appId、安装身份、数据目录以及客户端更新校验协议不变。每版必须完整上传：

- `MyTracer-${version}-x64-setup.exe`
- 对应安装包的 `.blockmap`
- `latest.yml`

源代码版本、tag、安装包名和 `latest.yml` 必须一致。客户端只接受稳定三段版本号，禁止降级；版本递增不代表数据库迁移已经验证安全。

本地更新器不依赖旧 `candidate-manifest.json`，因此不再将跨 workflow 的候选查找、14 天时效或手动批准作为发布前置条件。旧候选工具和测试夹具如仍保留，仅用于历史检查，不构成另一条有效发布入口。

CI 继续使用 GitHub App / Actions 发布凭据；新版客户端公共读取更新，不使用这些凭据，也不将 CI token 写入安装包。旧版迁移与恢复见[更新维护](UPDATE.md)。

## 重试与故障处理

- 查看失败步骤和安全错误码。GitHub GET 请求遇到 500/502/503/504 时最多尝试四次，间隔 1、2、4 秒；写请求不自动重放。诊断仅记录方法、无查询参数的 API 路径、状态码、请求 ID 和次数，不输出原始凭据、签名下载 URL、环境变量或 API 响应全文。
- 失败重试只能恢复与已合并发布 PR、版本、tag 和源 SHA 对应的草稿；不能从任意旧草稿挑选一个发布，也不能让普通 push 自动续发旧版本。
- 首选 GitHub 的 **Re-run failed jobs**：保留已成功选择的发布 SHA 和已构建资源，仅重试失败阶段。不能把最新 main 的文件混入原版本。
- **Re-run all jobs** 仅在该次 push SHA 就是已批准发布 PR 的合并 SHA、且凭据能读到对应 Release 时支持自动恢复。已合并发布 PR 查不到对应 Release 时明确报 `approved-release-not-found`，不能以空 selection 静默跳过。若 main 已前进、原运行替更早的发布 PR 创建草稿，应使用 Re-run failed jobs；全量重跑不会任意续发旧草稿。Release Please 本身失败时先修复该步骤，不能跳过批准来源校验。
- tag 被移动、版本不一致、出现更高正式版本或完整性检查失败时停止发布，保留现场；不能通过放宽校验或覆盖正式版本恢复。
- 最后公开请求若已成功但响应丢失，发布步骤重试只读核验同一版本的完整资产；完全一致则成功返回，不重复设为 latest，任何差异均停止。
- 已经正式公开的版本不可覆盖。若需要改代码，使用更高版本修复；串行发布和版本递增检查共同防止旧任务晚完成后成为 latest。
- `draft` 是自动化中间状态，不是要求 owner 再次批准的关卡。失败草稿不会成为客户端稳定更新。

### 使用修复后的流程恢复已有版本

旧 run 的 Re-run 仍使用原 workflow revision，不会自动采用后来合入 main 的脚本修复。修复先通过正常 PR/CI 合入 main，然后在 Actions → Release → Run workflow 选择 **main**，填写三个必填值：

- `release_id`：既有 Release 的数字 ID。
- `tag`：对应稳定标签 `vX.Y.Z`。
- `source_sha`：已合并发布 PR 的完整 40 位合并提交 SHA。

历史 v1.2.0 恢复操作曾使用以下参数：ID `420962324`、tag `v1.2.0`、source SHA `27762b2f5d041071baa509f4d48c09f13c4580a5`。这些值仅是恢复操作参数，不是工作流默认值，也不改变下一次自动发布的选择。

恢复只允许从 main 手动触发，不运行 Release Please，不创建 tag 或新版本。按 ID 读取既有 Release，并核对 tag、原始 SHA、main 祖先关系和已合并发布 PR。更高稳定版已发布时阻止恢复旧草稿；相同版本已正式发布时只读退出，不覆盖、不重新设置 latest。

Windows 构建始终 checkout 指定的原始源码，保留完整 verify、打包、隔离安装 smoke 和 unsigned 检查。校验完应用后，另 checkout 本次 workflow SHA 的发布工具到 `.tmp/release-tooling`，用于 bundle 和 publish；发布工具不混入原版本源码或安装包。每个下游阶段核对恢复输入与 selection 一致。自动 push 继续按原规则选择发布源，不读取手动恢复参数，也不自动挑选旧草稿。

## GitHub 配置与验证限制

Release Please 使用专用 GitHub App 的短期 installation token 创建/更新发布 PR、创建批准后的 tag 和 draft Release；选择发布源也使用该 job 的 App token，避免创建与恢复查询使用不同身份；最终上传/公开 job 单独创建并撤销自己的同权限 App token。Windows 构建仅使用只读 `GITHUB_TOKEN`，App token 不跨 job 传递，不写入安装包或客户端；客户端的只读更新 token 不变。

[GitHub 当前文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)说明，`GITHUB_TOKEN` 创建或更新 PR 的 opened/synchronize/reopened 事件会产生等待批准的 CI，而 GitHub App token 可直接触发 PR 检查。本方案保留 required `CI Gate`，不绕过 ruleset、不自动合并发布 PR；手动 dispatch 只恢复已有批准版本，不作为新版本批准入口；正常目标是 owner 只需决定何时合并发布 PR。首次真实 App PR 的行为仍需验收，不能仅凭配置代码承诺已经实现。

### Owner 一次性设置（合并本接入 PR 前完成）

以下是待 owner 单独授权/操作的步骤，提交本配置不代表已经创建 App、安装或保存私钥。不要把私钥粘贴到聊天、issue、PR、源码或日志。

1. 在个人 GitHub Settings → Developer settings → GitHub Apps 创建专用于 MyTracer 发布的 App。可填写仓库主页作为 Homepage URL；不需要 OAuth 回调、服务器或事件接收，取消 Webhook Active。选择仅本账户安装。
2. Repository permissions 仅设置 **Contents: Read and write**、**Pull requests: Read and write**；Metadata 的只读权限为 GitHub 必需。其他权限不授予，尤其不授予 Actions、Administration、Workflows 或 Issues 写权限，也不将 App 加入 ruleset bypass。这里的 Contents 写权限用于版本提交、tag 与 draft Release，不意味着可绕过受保护分支。
3. 将 App 安装到 `Fyrefly-4`，选择 **Only select repositories → MyTracer**，不要安装到全部仓库。记录 App 的 **Client ID**（不是 Installation ID，也不是旧 App ID）。
4. 经授权生成 App private key，由 owner 安全保管。到 MyTracer Settings → Secrets and variables → Actions，创建 repository variable `MYTRACER_RELEASE_APP_CLIENT_ID` 和 repository secret `MYTRACER_RELEASE_APP_PRIVATE_KEY`（完整 PEM 内容）。本流程不使用 environment secret，也不需要 PAT。
5. 确认仓库允许所用 Actions，原有 `CI Gate` 与分支保护保持不变。然后正常审查/合并本接入 PR。不要为了部署代码而合并任何待发布的 release PR。

Workflow 固定使用 [create-github-app-token v3](https://github.com/actions/create-github-app-token/tree/64ab729a6294000f5aa4a4bc0b73d1f32bc45510)，明确限制 owner、`MyTracer` 单仓库和以上两项写权限；token 在 job 结束时撤销，通常也在一小时后失效。Release Please job 的 `GITHUB_TOKEN` 保留 Contents write（[列出 draft Release 需要 push 权限](https://docs.github.com/en/rest/releases/releases#list-releases)，用于安全重试），Pull requests 只读；选择与发布操作显式使用 App token；`GITHUB_TOKEN` 不作为 App 的回退凭据。

配置缺失时，`Require release App configuration` 会以 `release-app-not-configured` 明确失败，后续步骤不运行，**不回退到 GITHUB_TOKEN**。非空只代表配置存在，不保证私钥有效；App 未安装、权限不足、Client ID/私钥不匹配由创建 token 或 Release Please 步骤失败体现。不要用输出凭据或完整环境变量的方式排查。配置完成后可重跑失败的那次普通 main push；若已涉及批准版本的构建/发布失败，仍遵守上面的精确 SHA 重试规则。

### 首次验证与维护

- 在一次正常 main push 后，确认 Release Please 使用 App 身份创建或更新发布 PR；检查该 PR **最新 head SHA** 的 `CI Gate` 自动启动并通过，无需额外点击 **Approve workflows to run**。旧的 `GITHUB_TOKEN` PR 若未更新，不会因保存设置自动获得一次新事件；等待 App 的正常更新，不移除 required check。
- 检查 App 未获得额外仓库/权限，发布 PR 仍须 owner 主动合并；本接入不应自行发布版本。
- [Issue #75](https://github.com/Fyrefly-4/MyTracer/issues/75) 在真实 App PR 自动 CI 验收前保持打开；本实现 PR 的 CI 通过只证明源码检查通过，不证明 App 安装或真实事件链已经成功。
- 私钥轮换由 owner 授权完成：更新仓库 secret、验证下一次 token 创建成功后撤销旧 key。疑似泄露时立即撤销相关 key/安装授权，发布维护暂时停止；不得把旧 key 写入回滚提交。
- 撤销 App 安装或删除配置后，新发布维护会明确失败；已发布资产和客户端现有更新凭据不因此改变。若回退到旧 `GITHUB_TOKEN` 方案，需要单独审查代码回退，并接受发布 PR 可能需额外批准 CI，而非静默降级。

同一 workflow 使用 Release Please 的输出连接打包，不依赖 `GITHUB_TOKEN` 创建的 tag/Release 继续触发另一条 workflow。不要同时保留旧 `update-candidate.yml` 与 `update-publish.yml` 的发布路径。

实现 PR、离线测试和模拟接口测试不证明新流程已经部署或真实更新成功。合入 main 前后都应区分：已通过的源码/CI 检查、尚未发生的真实发布，以及待执行的首次升级验证。Secrets、App 安装、权限与 ruleset 修改仍需对应授权。

## 本地构建

```powershell
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

本地构建不隐式发布。普通 `verify` 不打包、不实装、不执行 live AI，不触碰真实用户数据。旧 `release:validate` 只用于只读检查已有历史候选 bundle，不是新流程的批准命令。

参考：[Release Please](https://github.com/googleapis/release-please)、[Release Please Action](https://github.com/googleapis/release-please-action)、[GitHub Release API](https://docs.github.com/en/rest/releases/releases)。外部文档不替代本仓库实际验证。

# T084 — 真实私有源演练与部署具体方案

> 历史归档（2026-10-11）：正文状态、失败和权限按原记录日期理解，不作为当前任务状态或新授权。导航见[归档索引](../INDEX.md)。

> 2026-10-03 原始方案；2026-10-05 按 owner 批准收尾。确切 v0.1.4 演练发布和当前账户合成数据正常升级已执行，见末节与 EV-T084-002；原始建议保留为历史，不作为新的发布/凭据操作授权。

## 1. 推荐安排

使用既有私有仓库 `Fyrefly-4/MyTracer`，从真实已安装 T083 `0.1.3` 升级至 T084 `0.1.4`。保持正式 appId、schemaVersion=3 和原固定来源。Main 更新器、元数据资产前缀及网络白名单均硬编码此仓库；独立测试仓库需要修改产品来源策略，不能仅更改 builder 配置就声称验证同一正式路径。

演练必须使用 non-draft、non-prerelease 的真实稳定 Release `v0.1.4`；draft/pre-release 不能证明当前稳定客户端的发现路径。它会成为现有客户端主动检查时可发现的稳定候选，不能承诺与正式 feed 隔离。仅在 owner 明确接受这一副作用、确认使用者范围并审核包后发布。私有库可见权限通常覆盖仓库内容，当前方案也不承诺 token 只能读 Release。

如 owner 要求完全独立 feed，则先提出来源配置架构/合同变更，建设构建时固定测试源及完整白名单验证，再使用私有 `MyTracer-update-test`；这是替代方案，当前不创建仓库或放宽客户端 URL。

## 2. 执行顺序与产物

1. 在最新授权 dev 的 T084 分支完成 workflow/工具及 `0.1.4`，fake/受控源回归通过，独立 review 后固定 implementation candidate SHA。
2. 构建 Windows x64 unsigned NSIS，明确 `--publish never`。固定 `MyTracer-0.1.4-x64-setup.exe`、`latest.yml`、builder 实际产生且元数据需要的 blockmap、`SHA256SUMS.txt`、candidate manifest；记录 source SHA/run/artifact ID/大小/SHA-256、updater SHA-512 和元数据 hash。
3. 原建议为隔离 Windows VM/独立账户；owner 后续批准当前 Windows 账户与全新合成临时数据根，正常链路从实际 `0.1.0`→`0.1.3`→`0.1.4`。核对实际身份、进程/注册项及路径归属，使用同一 fixture 和同用户合成配置；沿用实际包 hash，不以改名包替代，不碰既有默认数据。
4. Owner 审阅确切 candidate SHA、上述 artifact/hash、tag `v0.1.4` 目标 SHA、unsigned 限制及 feed 可见影响后，单独批准演练 Release。Agent 不先创建 tag/Release；可由 owner 在可信流程可用时手动触发，首次受控人工发布也须绑定相同产物。正式 publish workflow 的 accepted-main 门禁不为演练放宽；演练授权是单独记录的例外路径。
5. owner 或精确获授权的执行者创建 draft、上传所有资产并回读校验，再开放为稳定 Release。部分失败保留事实/draft，不覆盖已发布同名资产。
6. 在 `0.1.3` 真客户端主动检查→下载→保留草稿阻断→处理草稿→重新明确确认→交接安装器→`0.1.4` 启动→导出完整比对→新增记录→再次重开，中途不重置数据。另验无凭据、撤销凭据、断网/重试/稍后和 unsigned 实际提示。
7. 隔离受控源演练缺失元数据/损坏包/低版等负面输入；不要为测试损坏真实 latest。记录失败/skip，不把手动 NSIS 加 fake 安装拼成真实应用内成功。
8. 实测后再完成任务/阶段最终 revision 验证及 owner 人工验收。候选已开放不等于正式 main 发布验收通过。若修复改变包，则使用更高版本、重新批准/验证，不替换 `v0.1.4` 资产。

首次源演练不以尚未完成的 S8 全阶段验收为前置；正式发布仍须已验收 main 与 owner 指定 artifact。两者证据及授权分别记录。

## 3. 凭据与配置

| 用途               | 建议配置                                                                                                                                                | 边界                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Windows 客户端读源 | owner 创建 fine-grained PAT，仅选 `Fyrefly-4/MyTracer`，Contents read，Metadata 默认读，建议 7 天有效期；在隔离测试进程环境注入 `MYTRACER_UPDATE_TOKEN` | 不给写/Actions/管理权限；不在聊天发送值，不放仓库、SQLite、导出、截图或日志。真实鉴权用真实受限测试凭据；普通测试用合成值。 |
| 候选 CI            | `GITHUB_TOKEN` 的 contents read；必要 artifact 操作使用相应最小权限                                                                                     | 不注入客户端 PAT，不给 Release 写权限。                                                                                     |
| 同库正式发布 CI    | 发布 job 使用短期 `GITHUB_TOKEN`，contents write；读取指定 run/artifact 时 actions read；其他 job contents read                                         | 不新增长期发布 PAT。写权限仅发布 job，可写能力本身不等于批准 merge/main。                                                   |
| owner 门禁         | 固定允许 login `Fyrefly-4` 并核验实际账户 numeric ID；固定 repo ID、可信 main workflow ref                                                              | login/repo ID 只读核验后记录；不允许 dispatch 输入任意 owner/repo/ref。                                                     |

GitHub 官方 API 要求读取 Release 使用 Contents read；workflow 可按 job 设置 `GITHUB_TOKEN` 最小权限，见 [Release API](https://docs.github.com/en/rest/releases/releases) 与 [GITHUB_TOKEN 文档](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)。同库且目标为实际可信 main 时优先此短期 token。若演练目标 dev 引入相对默认分支的新 workflow，GitHub 对创建 Release/tag 可能另要求 workflow 写权限；不为此扩大 CI token，首次由 owner 精确授权人工准备，实施前按 API 行为核查。

首次配置：owner 在隔离 Windows 启动环境安全设置变量，再启动应用；Main 启动时读取。轮换：新建最小只读 token→更新隔离启动环境→重启并检查→撤销旧 token。撤销/到期：更新不可用，核心功能仍可用；完成后撤销演练 token并清除测试进程环境。无需新增应用内配置页面，也不改 AI 密钥。

不依赖收费 Environment required reviewer；owner 手动 dispatch 加固定身份/来源/artifact 校验作为门禁。将真实源仓库与 workflow 仓库保持同库，避免跨库写 PAT。若账户策略导致此配置不可用，先报告具体缺口，不扩大权限。

## 4. 本次需要确认的具体选择

原始建议：同一固定私有源的 `0.1.3`→`0.1.4` 稳定演练及 feed 可见影响，隔离 Windows VM/独立账户，专用只读测试 token 与同库短期 CI token。Owner 后续批准当前账户合成数据替代方案；实际 tag/Release 在确切 source/hash/run/artifact 审阅后获得单独批准并执行，见末节。

Owner 随后已明确批准 T084 branch/commit/普通 push/Draft PR 权限，指定不新建独立 worktree，并授权解决索引冲突；本步仅建分支及提交合同，产品实现尚未开始。这些任务 Git 权限不等于批准本提案的真实源发布或部署配置。

## 5. 实际授权与结果

上节“本步仅合同”是初始阶段事实，owner 随后明确继续 T084。Owner 精确批准演练清单后，创建 `v0.1.4`→`a5759763adc18739f8f65bcfc48f01db8f1ecd7f`，Release `403104108`；上传五项已批准资产并全部回读核验后转为 stable/latest，发布时间 `2026-10-04T16:25:59Z`（北京时间 2026-10-05 00:25:59）。固定私有源的 latest 已改变，该副作用属于本次批准；未推进 main，未放宽正式 accepted-main 发布工具。

候选 run `37215009706`、artifact `11308571131`，NSIS SHA-256 `a6a36aa850083548f97cf7ecbe63eda9de01216b063eed273aa721eb486b3da0`，签名 `NotSigned`。完整来源、五资产 hash、连续升级和补测结果见 [EV-T084-001/002](../../ACCEPTANCE_EVIDENCE_V0.1.md#ev-t084-001)。专用客户端凭据由 owner 本机安全输入，Agent 不接收 token、不复用发布身份；真实 token 撤销/到期仍未执行。

2026-10-05 owner 暂不继续执行，批准文档收尾及最后一次任务分支推送；剩余下载中断恢复、安装失败修复、人工体验与最终阶段集成保持 pending。已发布资产不覆盖，正常链路不重装，清理另批。上述结果不证明正式 main 版本或 S8 完整验收通过。

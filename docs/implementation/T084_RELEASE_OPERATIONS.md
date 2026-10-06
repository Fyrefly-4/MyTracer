# T084 — 候选构建与私有发布操作

> 发布操作说明。当前维护方案见 Owner tag 正式发布一节；后文的 S8 阶段记录为历史事实。创建 tag、真实发布和分支合并仍由 owner 控制。

## 候选与审核

`Update candidate` 对同库 dev/main PR、main push 和手动入口运行。构建明确 checkout PR head 或 push SHA，使用锁定依赖及只读权限，分别捕获 aggregate、禁止发布的 NSIS build、隔离 smoke；检查 unsigned 后生成 `.tmp/release/candidate/candidate-manifest.json`。

产物包含 NSIS、其 blockmap、`latest.yml`、`SHA256SUMS.txt` 和 manifest。Manifest 记录 source、版本、schema=3/export=2、run/attempt、每个资产的大小/SHA-256/SHA-512 和脱敏命令结果；不含绝对路径、用户内容、数据库或凭据。`compatibleFrom` 是需实装证明的兼容来源声明，不自动代表已完成兼容矩阵。

上传使用现有批准的 `actions/upload-artifact@v4.6.2`。Artifact ID/ZIP digest 从 upload receipt 和 GitHub API 取得，不能把 ID 写回已经不可变的同一 archive。Owner 审阅确切 run/artifact、manifest hash 和资产 hash，不能选浮动 latest。PR 候选只供审阅/演练，正式发布工具拒绝 PR/非 main 构建。

## Owner tag 正式发布（2026-10-06 批准的维护改造）

本节取代每次发布前写入 `release-approval` JSON 和手填五个 dispatch 参数的操作。历史演练、失败、豁免和验收记录继续保留，不成为新的发布输入。是否已经部署本流程取决于对应改造是否已合入 main；首次使用必须选择包含本版 publish workflow 的 main 提交。

1. 在代码合入 main 前同步 package.json 与 package-lock.json 中的版本。main push 自动运行 Update candidate，完成 verify、禁止发布的 NSIS 打包、隔离安装 smoke、unsigned 和 bundle 校验。候选 Summary 提供源 SHA、版本、run/artifact 链接与 manifest hash。PR 候选不能正式发布。
2. Owner 查看该 main 候选成功结果，在对应完整源 SHA 上创建并推送稳定版本 tag，例如 `v0.1.5`。Owner 的认证账号推送新 tag 即批准该源提交及其通过发布校验的候选产物进入现有私有正式更新源；支持 lightweight 和 annotated tag，tagger/commit author 文本不是身份凭证。不要通过 GitHub 的 Publish release 按钮抢先创建 Release。
3. Tag 可指向仍在 main 历史中的提交，不要求等于当前 main HEAD。版本必须与该提交的 package/lock 版本一致。只接受配置 owner 的 login/numeric ID，并检查原始事件及重跑者；拒绝 prerelease、tag 更新、删除和强推事件。Agent 代 owner 创建 tag 仍需该版本的独立授权。
4. 只读 validate job 查询固定 candidate workflow、精确 SHA、main、成功状态的 runs，按 run ID 降序选最新成功 run，再选该 run/attempt 下唯一的候选 artifact。选定产物缺失、过期或校验失败即停止，不退回更早 artifact，不改用其他 SHA。自动取得实际 artifact ID/digest，下载并校验 ZIP、五个扁平文件、manifest、每个资产、latest.yml 和 checksum list。
5. Validate 输出固定 JSON selection，包含源 SHA、实际 tag object SHA、版本、run/attempt、artifact ID/archive digest 和 manifest hash。Publish job 只回读这组确切标识，重复 main ancestry、tag、版本、provenance 和完整性验证，不重新发现候选；run rerun、artifact replacement、tag 移动或 bytes 变化会停止发布。
6. 仅 publish job 获同库 contents write/actions read。已有 tag 是必要条件且必须解引用到源 SHA；已有 Release（包括 draft）仍拒绝覆盖，新 stable 版本必须高于既有 stable Releases。先建 draft、上传全部五个文件、回读 hash，最后再次检查 tag/main 来源，再公开为 stable/latest。Actions Summary 和 Release body 自动保留 tag、源、run/attempt、artifact、digest 与 manifest hash。发布不创建、移动或删除 tag，不推进分支，不回写验收账本。

候选默认保留 14 天且 validator 限制最大年龄 14 天。Tag 推早了或候选过期时，流程失败并保持 feed 不变；owner 在同一源 SHA 的 main 候选成功后可重跑原 tag workflow。Main 已前进时，可在 Actions Update candidate 的手动入口选择原发布 tag，workflow 会验证其源仍属于 main，并按该精确源重新构建；manifest 记录实际 tag ref，发布仍核对其 main 来源。若已创建 draft，普通重跑拒绝该版本；owner 先检查保留现场并另行授权处置，不自动删除、覆盖或续传。已经正式可见的坏版本使用更高修复版。

新 tag workflow 和旧手动入口不并行保留。现有私有源、Windows x64 NSIS、schema=3/export=2、unsigned、客户端只读凭据与用户确认安装边界不变。正式 tag 触发和真实发布仍须在 main 集成后实际验证，本地模拟接口测试不能证明真实发布成功。

## 本地命令与限制

```powershell
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
npm.cmd run release:validate -- --manifest .tmp/release/candidate/candidate-manifest.json
```

`release:validate` 只读校验已有 bundle；不生成审批、不访问真实源、不发布。`package` 现在默认 `--publish never`，避免在有 CI 凭据的环境隐式上传。普通 verify 不新增真实网络或实装入口。

首次 T084 演练按 [真实源提案](T084_PRIVATE_REHEARSAL_DEPLOYMENT_PROPOSAL.md)另行授权，不能绕过正式 publish 的 accepted-main 门禁。当前固定源 stable 演练会被现有客户端发现，必须精确批准其 feed 影响和产物。候选过期/缺失/不一致则重新构建和审阅；坏版本用更高修复版，不覆盖同版本或自动降级。

客户端只读 token 与 CI 发布 token分离：owner 将限本库 Contents read 的专用凭据安全注入测试进程 `MYTRACER_UPDATE_TOKEN`，重启生效；轮换后撤销旧值，演练后撤销。检查会产生分发服务可见 IP 等网络元数据。unsigned 不证明发布者身份，记录 Windows 实际提示，不关闭安全保护。

API/产物规则参考 [GitHub artifact API](https://docs.github.com/en/rest/actions/artifacts)、[Release API](https://docs.github.com/en/rest/releases/releases)；这些文档说明能力，不替代本仓库远端实测。

### 2026-10-06 T809 聚合进度

T081～T084 已分别通过 PR #57～#60 集成至固定产品 dev revision `080c308ff511705bfd8ab21386a03d58ec311dcd`。T809 本地定向、完整 verify 和禁止发布的打包通过；owner 报告本地 0.1.3→0.1.4 应用内更新、未保存输入保护、数据保留和重开持久化的简明步骤全部通过。详见 [EV-S8-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001) 与 [T809 合同](T809_S8_FINAL_ACCEPTANCE.md)。此报告未覆盖完整实装配置/导出绑定、全部真实故障或安装 smoke；T084/T809 仍 active，S8 未整体通过。历史失败与 pending 保留，不执行正式发布。

正常开始菜单启动需继承专用 `MYTRACER_UPDATE_TOKEN`。本机用户环境变量配置或轮换后，完整注销/登录并重启应用；Main 仅启动时读取。owner 报告正常入口和更新后重开检查通过，不将开发终端注入等同于全部正常入口验证。不要把 token 值写入命令、文档、日志、截图或导出。现有 v0.1.4 演练资产不可覆盖，正式发布仍绑定 accepted-main 与不可变候选及 owner dispatch。

### 正式个人使用维护约定（2026-10-06 已批准）

正式客户端凭据采用限本库 Contents read 的独立细粒度 token，建议有效期 180 天、到期前 14 天自行提醒；保留用户环境变量方式的安全限制。配置、轮换、撤销和 owner 回报清单统一见 [T082 正式个人使用方案](T082_UPDATE_SOURCE_OPERATIONS.md#正式个人使用方案2026-10-06-owner-已批准)。正式凭据部署尚未完成，不复用临时测试成功作为生产验收。

稳定源今后只接收已验收且获具体发布授权的版本；测试构建留在 Actions 候选产物。既有 v0.1.4 仍是演练，首次正式版本须更高且单独安排版本任务，不覆盖旧资产。首次正式发布需实际验证本文件的 accepted-main、不可变候选、审批账本与 owner dispatch 全链路，当前仍未证明；本约定不触发发布、tag、Secrets 或规则修改。

坏版本保留来源与处置记录，通过更高修复版处理；暂停推荐涉及的实际 feed/Release 修改另行授权。长期交接应给出私有 Release 中的完整安装包、校验值和兼容范围，以便 owner 手动原位置覆盖安装。首期保持同 schema 与 unsigned 边界；加密凭据读取、分发源变更、多用户分发、签名和数据库恢复均不在本次文档操作中实施。

### 2026-10-06 最终收口状态

Owner 已报告正式凭据部署与重启检查完成，并明确豁免剩余真实故障及实装复核；原 pending 为历史记录，现按 waived-by-owner/未执行接受风险处理，不再阻塞本次 S8 收尾。独立评审和 d57e653 head CI 已通过；hosted aggregate/package/package-smoke 的 complete/exit0 artifacts 已核实。Owner 授权最终文档收口、模板 PR 正文和最后一次推送；T084/T809 仍 active，最新推送 head CI 和交付待核验，不自动 Ready/merge/main/tag/release。正式发布成功仍未执行，现有 v0.1.4 演练资产不覆盖。具体范围及历史证据见 [T809](T809_S8_FINAL_ACCEPTANCE.md) 和 [EV-S8-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)。

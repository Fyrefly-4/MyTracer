# 私有发布维护

## 部署状态与发布前提

截至 2026-10-11 已核验的远端快照：owner tag 改造已进入 dev，main 尚保留旧五参数 dispatch。下面是新流程进入 main 后的操作，不能用于当前旧 main。部署及首次真实正式发布尚未执行；精确 revisions 和 CI 见[事实校准证据](../implementation/ACCEPTANCE_EVIDENCE_V0.1.md#ev-doc-calibration-001)。执行前重新核对远端和确切 workflow。

现有 v0.1.4 是 owner 授权的稳定通道演练，保留 tag、Release 和原始资产，不追认为正式 accepted-main 发布。首次正式版本须更高，并通过独立版本变更、集成与发布授权。本文说明操作，不授予 Agent 合并、tag、发布、Secrets 或 ruleset 写入权限。

## 候选与审核

`Update candidate` 对同库 dev/main PR、main push 和手动入口运行。构建明确 checkout PR head 或 push SHA，使用锁定依赖及只读权限，分别捕获 aggregate、禁止发布的 NSIS build、隔离 smoke；检查 unsigned 后生成 `.tmp/release/candidate/candidate-manifest.json`。

产物包含 NSIS、其 blockmap、`latest.yml`、`SHA256SUMS.txt` 和 manifest。Manifest 记录 source、版本、schema=3/export=2、run/attempt、每个资产的大小/SHA-256/SHA-512 和脱敏命令结果；不含绝对路径、用户内容、数据库或凭据。`compatibleFrom` 是需实装证明的兼容来源声明，不自动代表已完成兼容矩阵。

上传使用现有批准的 `actions/upload-artifact@v4.6.2`。Artifact ID/ZIP digest 从 upload receipt 和 GitHub API 取得，不能把 ID 写回已经不可变的同一 archive。Owner 审阅确切 run/artifact、manifest hash 和资产 hash，不能选浮动 latest。PR 候选只供审阅/演练，正式发布工具拒绝 PR/非 main 构建。

## Owner tag 正式发布

新流程以 owner 推送稳定 tag 取代逐版本 `release-approval` JSON 和五参数 dispatch。历史演练、失败和豁免不成为新的发布输入；首次使用须选择包含该 publish workflow 的 main 提交。

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
客户端凭据、正常入口重启、轮换及备用安装统一见[更新与凭据维护](UPDATE.md)。CI 发布凭据与客户端只读 token 分离，检查不会授权真实发布。

API/产物规则参考 [GitHub artifact API](https://docs.github.com/en/rest/actions/artifacts)、[Release API](https://docs.github.com/en/rest/releases/releases)；这些文档说明能力，不替代本仓库远端实测。

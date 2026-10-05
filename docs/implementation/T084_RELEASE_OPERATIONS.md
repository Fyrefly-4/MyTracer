# T084 — 候选构建与私有发布操作

> 实现说明，2026-10-03。Workflow/API 的远端执行尚未验证；真实源、凭据部署和人工验收仍 pending。本文件不授予发布权限。

## 候选与审核

`Update candidate` 对同库 dev/main PR、main push 和手动入口运行。构建明确 checkout PR head 或 push SHA，使用锁定依赖及只读权限，分别捕获 aggregate、禁止发布的 NSIS build、隔离 smoke；检查 unsigned 后生成 `.tmp/release/candidate/candidate-manifest.json`。

产物包含 NSIS、其 blockmap、`latest.yml`、`SHA256SUMS.txt` 和 manifest。Manifest 记录 source、版本、schema=3/export=2、run/attempt、每个资产的大小/SHA-256/SHA-512 和脱敏命令结果；不含绝对路径、用户内容、数据库或凭据。`compatibleFrom` 是需实装证明的兼容来源声明，不自动代表已完成兼容矩阵。

上传使用现有批准的 `actions/upload-artifact@v4.6.2`。Artifact ID/ZIP digest 从 upload receipt 和 GitHub API 取得，不能把 ID 写回已经不可变的同一 archive。Owner 审阅确切 run/artifact、manifest hash 和资产 hash，不能选浮动 latest。PR 候选只供审阅/演练，正式发布工具拒绝 PR/非 main 构建。

## 正式发布审批记录

正式 publish workflow 只接受可信 main 的手动调用。经 owner 实际验收且授权 docs closeout 后，在可信 main 的 `ACCEPTANCE_EVIDENCE_V0.1.md` 增加一个 `release-approval` fenced JSON block，字段如下；这只是字段示意，当前不在账本预填 accepted：

```json
{
  "status": "accepted",
  "sourceRevision": "完整已验收main源SHA",
  "version": "具体稳定版本",
  "runId": 0,
  "artifactId": 0,
  "artifactDigest": "sha256:实际archive-hash",
  "manifestSha256": "实际manifest-hash",
  "ownerId": 183197199
}
```

数据必须是实际完整 SHA、正整数 ID 和 64 位小写 hash。批准记录可在来源包构建之后的 main 文档提交加入；来源 SHA 必须是该可信 workflow revision 的 main ancestor，因此无需制造自引用 SHA。Validator 不写此账本，artifact 自带批准记录也无效。

Owner 对该记录与具体产物确认后，手动运行 `Publish accepted update`，输入 source_sha、version、run_id、artifact_id、manifest_sha256；tag 固定为 `v<version>`，目标固定为该 source SHA。手动触发只批准这次指定产物，不批准推进 main 或换包。

只读 validate job 核对固定 owner login/numeric ID、repo ID/private、main ancestry、候选 workflow/run/attempt/source、artifact/digest/有效期及 main 账本，再下载 ZIP。ZIP 只允许五个确切扁平文件，解压到新建 `.tmp` 根，校验 archive/manifest/资产 hash 和具体 NSIS 元数据格式。不执行候选脚本，也不运行 `npm ci`。

独立 publish job 才获得同库 `GITHUB_TOKEN` 的 contents write、actions read，并重复所有检查。拒绝旧版/同版、已存在 tag/Release。创建 draft→上传所有资产及 manifest→回读每个资产的 hash→公开为 stable Release。部分失败保留 draft/tag，停止后续步骤；不自动清理、覆盖或假定原子回滚。错误消息不打印 token、原始 API 响应或 signed URL。

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

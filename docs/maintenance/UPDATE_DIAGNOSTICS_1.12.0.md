# 1.12.0 临时更新诊断

此分支从正式 `v1.12.0`（`a02175e6cf598f08f3c4d053cccb2cf85d42816c`）建立，用于排查检查更新时的通用网络错误。版本仍为 1.12.0；未修改 provider、请求白名单、错误提示、自动下载/安装策略或业务数据结构。不是正式发布包，不上传同版本 Release 资产。

## Windows 本地构建

在 Windows x64 使用 `package.json` 要求的 Node 24.18.0 / npm 11.16.0。可建立独立 worktree，避免干扰已有工作目录：

```powershell
git fetch origin codex/update-diagnostics-1.12.0
git worktree add ..\MyTracer-update-diag origin/codex/update-diagnostics-1.12.0
Set-Location ..\MyTracer-update-diag
npm.cmd ci
npm.cmd exec -- install-electron --no
npm.cmd run typecheck
npm.cmd exec -- vitest run --project unit tests/unit/update-diagnostics.test.ts tests/unit/github-update-port.test.ts
npm.cmd run package
```

每条命令成功后再继续下一条。构建生成 `release\win-unpacked\MyTracer.exe` 和本地 NSIS 安装器。检查更新必须运行 packaged 程序；`npm run dev` 和仅 `npm run build` 后用 Electron 启动源码均为 unpackaged，既有代码会返回 unavailable。

## 启用与采集

完全退出原 MyTracer。在同一个 PowerShell 窗口执行以下命令，使用全新的隔离 profile。只检查更新即可复现本问题，不必运行安装器或点击“确认重启安装”。

```powershell
$diagProfile = Join-Path $env:TEMP ("MyTracer-update-profile-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $diagProfile | Out-Null
$env:MYTRACER_UPDATE_DIAGNOSTICS = '1'
Start-Process -FilePath (Resolve-Path '.\release\win-unpacked\MyTracer.exe').Path -ArgumentList ('--user-data-dir="' + $diagProfile + '"')
```

在“关于与更新”确认当前版本为 1.12.0，点击“检查更新”，记下界面结果。不要配置 AI 凭据，不需要创建业务记录。这个 profile 是空白隔离库，不复制日常数据；unpacked EXE 的检查与网络代码是 packaged 路径，但它不验证原安装范围或 NSIS 跨版本安装。

日志写在启动进程的临时目录（Windows 通常为 `$env:TEMP`），每个进程使用一个唯一文件 `mytracer-update-diagnostics-<PID>-<UUID>.jsonl`。只有第一次诊断事件才创建文件；每个诊断实例最多 1,000 行，达到上限后停止追加，重启后生成新文件。日志使用 UTC 时间。

```powershell
$diagLog = Get-ChildItem -Path $env:TEMP -Filter 'mytracer-update-diagnostics-*.jsonl' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$diagLog.FullName
Get-Content -LiteralPath $diagLog.FullName
```

首次检查应能看到 `check-provider / started`。若没有新日志，先核对启动的是本分支构建的 EXE、环境变量在启动前设置，以及临时目录可写。日志写入失败会被忽略，以免影响更新行为；不能把“没有日志”等同于“没有错误”。

退出诊断程序后关闭开关：

```powershell
Remove-Item Env:MYTRACER_UPDATE_DIAGNOSTICS -ErrorAction SilentlyContinue
```

变量只设置在当前 PowerShell 及其子进程，不修改系统或用户的永久环境变量。关闭变量不会改变已经启动的进程，需要完全退出后重新启动。保留所需日志后，可删除本次唯一日志文件和 `$diagProfile` 目录；不要删除日常 MyTracer 的数据目录。

## 读日志

| 字段/事件 | 含义 |
| --- | --- |
| `phase` / `stage` | `check-provider` 查询、`check-metadata` 校验；下载时另有 `download-recheck`、`download-metadata`、`download-file`、`download-integrity`；安装前有 `install-integrity`、`install-start` |
| `result` | `started`、`succeeded` 或 `failed`；安装启动 succeeded 仅表示 install 返回 true，不证明安装完成 |
| `code` | 识别到的原始 updater/Node/应用错误码；未知值为 `[unclassified]`，不输出任意字符串 |
| `networkCodes` | 从错误包装文本提取的已知 Chromium `net::ERR_*` 符号，不保存原始文本 |
| `requestStage` | `release-feed`、`latest-release`、`channel-metadata`、`installer`、`asset-cdn` 或 `other` |
| `response` / `httpStatus` | Electron 实际收到的数字 HTTP 状态；没有状态时为 null，不从错误正文猜测状态 |
| `blocked` | 原有 `onBeforeRequest` 白名单主动取消请求，保留脱敏路径和拒绝时的 URL 特征 |
| `redirect` | 重定向状态及脱敏目标；只有 Chromium 发出对应事件时才有记录 |
| `request-error` | Chromium 请求失败符号；`requestId` 可关联同一次请求的事件，updater 手动重发可能产生新 ID |

诊断例子：

- `blocked` 紧接 `ERR_BLOCKED_BY_CLIENT`：有应用白名单拦截证据，检查该行路径和 `hasQuery` 等标志。
- `ERR_PROXY_CONNECTION_FAILED` / `ERR_TUNNEL_CONNECTION_FAILED`：检查应用可用的系统代理；浏览器能访问不证明 Electron 的独立 session 能访问。
- `ERR_NAME_NOT_RESOLVED`：域名解析失败；`ERR_CERT_*`：TLS 证书相关失败。
- `response` 状态 403/429：服务拒绝访问或限流，结合请求阶段定位；404：路径/资产不可用。
- `ERR_UPDATER_INVALID_RELEASE_FEED`：这是包装错误，应结合此前 request/response/request-error 判断原因，不能直接认定 Atom 内容损坏。
- `check-metadata` 失败：已进入应用的版本、tag、安装包名和 SHA-512 校验阶段。

仅有 `check-provider / started` 时，保留界面结果和等待时长；请求可能仍在进行、应用已取消或日志不可写。这里没有新增超时、重试、代理配置或更新修复。

## 脱敏范围

仅保存固定字段：时间、阶段、结果、数值请求 ID/HTTP 状态、已知错误符号、已知 GitHub 主机与公开 Release 路径及 URL 特征布尔值。URL 的用户名/密码、query/fragment 内容、非固定路径、未知主机均不输出；资产 CDN 路径也整体遮盖。未知 URL 路径用 `[redacted]`，因此不承诺恢复任意被拒绝地址的原文。

不保存请求/响应头、token、签名下载参数、响应正文、Release notes、错误 message/stack、本地文件路径、环境变量值或业务记录。保持 `updater.logger = null`，不启用可能打印完整 URL/响应的通用 updater logger。不上传日志，也不纳入产品导出。

用于反馈时提供：本分支提交、Windows 版本、复现时间、界面提示、这次 JSONL 日志，以及是否使用系统代理。无需提供 token、代理密码、数据库或完整网络抓包。

## 验证边界

本分支提供脱敏和事件接线的合成回归测试。Windows 本机 HTTP 请求、代理/TLS 行为、原安装版复现及真实升级仍由本地调试确认；单元测试不替代这些检查。

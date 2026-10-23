# 实验组合预览：2026-10-23

此分支用于拉取后体验与验收，尚未合并 main，也不是发行版本。14 个实验各自的 CI 不等于此组合的 Windows CI；当前缺少受支持的认证 dispatch 入口，未触发组合 CI。请仅使用新建的合成数据目录。

## 精确组成与合并

基线 main：`ce8abacd7f1bc1955d3943823a358bc14ecd262d`。产品组合提交：`891fe83d57b3c948614872da4ce9adba818fe0ba`，产品组合树：`fc560a357fcfa765d657c7de09c603350bc5492e`。其后的提交只加入本说明；当前完整版本用 `git rev-parse HEAD` 查看。

| PR | source head |
| --- | --- |
| [#94](https://github.com/Fyrefly-4/MyTracer/pull/94) | `d0edb416b21d8b18bffb9995811b79da26973c71` |
| [#95](https://github.com/Fyrefly-4/MyTracer/pull/95) | `9cd4eb922e04993f8baa71de447ba3f3dd34469d` |
| [#97](https://github.com/Fyrefly-4/MyTracer/pull/97) | `8ff5e6c7292f6a560998c7dae3ff41ffb57bebac` |
| [#99](https://github.com/Fyrefly-4/MyTracer/pull/99) | `6d67623ca430b00cc85955a91d205112a5521a52` |
| [#100](https://github.com/Fyrefly-4/MyTracer/pull/100) | `c47b598bb3cf3c70628d53b49e6a569d74d19080` |
| [#101](https://github.com/Fyrefly-4/MyTracer/pull/101) | `b1943ace5c7c661e7a541f05dcfcafa17871b3ff` |
| [#102](https://github.com/Fyrefly-4/MyTracer/pull/102) | `07b5bbc662e6a18b586c9b8a4ade81f0df141223` |
| [#103](https://github.com/Fyrefly-4/MyTracer/pull/103) | `31e6a755369228258ff574e4fe36458d180fdde0` |
| [#104](https://github.com/Fyrefly-4/MyTracer/pull/104) | `c22e4a14fac61ebae8b3302d97affe9438c26f37` |
| [#105](https://github.com/Fyrefly-4/MyTracer/pull/105) | `95c9c64ed8b6e50076ad554643790873e26b3965` |
| [#106](https://github.com/Fyrefly-4/MyTracer/pull/106) | `39bd7dbfcc3f0c44ed21dad882c74198efd7854f` |
| [#107](https://github.com/Fyrefly-4/MyTracer/pull/107) | `cd7712ba7ecc4594c65d1d149a66d33830418a98` |
| [#108](https://github.com/Fyrefly-4/MyTracer/pull/108) | `a16d681ba219395f69a7a430c3707229eda6c7ab` |
| [#109](https://github.com/Fyrefly-4/MyTracer/pull/109) | `00c6d396b02d7761db0aa088e9c0b7fa262a6a0c` |

只在 UiSession 的独立导入、成员声明和 hasUnsavedContent 汇总处人工解决文本冲突，保留两侧内容。Goal/Routine 内容、行动/例行记录、封面、Review 正文与 pending-save 都保留；没有选择一方覆盖另一方。源 PR 分支未改动。草稿保护是当前应用会话内的能力，退出应用不会把未保存正文写入磁盘。已保存的合成记录仅保留在本次临时 profile 中；每次执行下方命令都会新建 profile，不会自动带入上次资料。

## 安全拉取与隔离预览（Windows）

在已有 clone 中创建独立 worktree；目录须尚不存在，不切换或覆盖你现有的工作区：

```powershell
git fetch origin codex/experiment-acceptance-20261023
git worktree add --detach ../MyTracer-experiment-preview origin/codex/experiment-acceptance-20261023
Set-Location ../MyTracer-experiment-preview
npm.cmd ci
npm.cmd exec -- install-electron --no
npm.cmd run build
```

准备 package.json 指定的 Node 24.18.0 / npm 11.16.0。然后在 **PowerShell 7** 中运行以下代码：复用现有测试的唯一临时根、最小环境和 `--user-data-dir` 机制，启动本地构建的 Electron，不使用默认开发或正式用户数据。不会加载原有 AI/update 凭据，不修改当前 shell 环境；请只手动创建合成目标和记录。

```powershell
$previewRoot = Join-Path ([IO.Path]::GetTempPath()) ("mytracer-preview-" + [guid]::NewGuid())
$paths = @{}
foreach ($name in @("user-data", "roaming", "local", "temp")) {
  $paths[$name] = Join-Path $previewRoot $name
  New-Item -ItemType Directory -Path $paths[$name] -Force | Out-Null
}
$start = [Diagnostics.ProcessStartInfo]::new()
$start.FileName = (Resolve-Path "node_modules/electron/dist/electron.exe").Path
$start.UseShellExecute = $false
$start.WorkingDirectory = $previewRoot
$start.ArgumentList.Add((Resolve-Path "out/main/index.js").Path)
$start.ArgumentList.Add("--user-data-dir=" + $paths["user-data"])
$start.Environment.Clear()
foreach ($name in @("PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT")) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ($null -ne $value) { $start.Environment[$name] = $value }
}
$start.Environment["HOME"] = $previewRoot
$start.Environment["USERPROFILE"] = $previewRoot
$start.Environment["APPDATA"] = $paths["roaming"]
$start.Environment["LOCALAPPDATA"] = $paths["local"]
$start.Environment["TEMP"] = $paths["temp"]
$start.Environment["TMP"] = $paths["temp"]
$start.Environment["ELECTRON_RENDERER_URL"] = ""
Write-Host "本次合成数据目录：" $previewRoot
$preview = [Diagnostics.Process]::Start($start)
$preview.WaitForExit()
```

本手动命令经过代码路径核对，尚未在本机 Windows 执行；不代表人工验收通过。保留打印出的目录以便排查，勿把真实数据库复制进去。没有关闭 sandbox 的参数；若环境不能安全启动，应停止并记录原因。

自动化测试已有各自的隔离根及清理机制。在安全 Windows 桌面环境、锁定依赖安装完成后可运行：

```powershell
npm.cmd run verify
```

该命令包含格式、lint、类型、单元、集成、构建和常规 Electron E2E，不包含需单独开关的安装包 smoke 或 live AI contract。不要在当前 Linux 环境通过关闭 sandbox 运行 Electron。

结束预览时关闭窗口，返回原 clone 目录即可；原工作区分支与数据不变。如原工作区原本就在 main，无需任何切换；否则在确认没有未提交改动后自行 `git switch main`。无需 reset、合并或安装此预览版本。

## 优先体验的三条路径

1. **第一次记录**：空首页进入 Today，取消一次确认无写入，再创建无目标行动；写记录草稿、离开、返回及放弃，核对内容与焦点。
2. **修改与中断**：Goal/Routine 修改内容后筛选、分页、跨页返回、同对象刷新与切换对象；内容草稿与记录草稿彼此独立。删除后的旧草稿只读可复制，不会重新创建对象。
3. **数日后接续与复盘**：目标历史、Progress 原文按需展开、数据页读失败重试，再显式引用事实、查看上一自然周调整；复盘保存中离开返回不应重复创建下一步。最后在短窗口、放大、长文字下检查键盘可达性。

## 已有证据与限制

产品组合在 Linux / Node 24.18.0 / npm 11.16.0 上：格式、lint、typecheck、build、完整 main→HEAD diff 检查通过；独立模型 smoke 验证草稿槽互不清除及 Review pending promise 身份保留。

- 单元：520 通过；1 项 Windows wrapper 测试因没有 `npm.cmd` 返回 127。
- 集成：178 通过；22 项 release-tag-flow 在创建 fixture 压缩包时缺少 `powershell.exe`（ENOENT）；9 项 Windows 解压检查及 1 项 live AI 按原条件跳过。
- Electron native SQLite smoke 明确未运行；没有启动 Electron、修改测试跳过条件或制作替身工具掩盖平台失败。
- 上述失败文件与 main 相同；并不表示这些 Windows 测试已通过。
- 未完成组合 Windows CI、组合 E2E、真人视觉/Mica 或屏幕阅读器验收。保留此缺口，不以单独 PR 的绿色代替组合验收。

本分支不会自动触发现有 Verification（只有 PR/手动触发），也不触发仅监听 main push 的 Release。没有修改 workflow、凭据、发布配置或安全设置。

# T081 Windows 原位升级验证步骤

本步骤只用于 T081 的 Windows x64 验证。默认使用一次性 VM 或独立测试账户；项目所有者已就本次 T081 明确批准当前账户，并确认其中既有 MyTracer 默认数据可丢弃。仅指定临时 `userData` 不能隔离 NSIS 的每用户安装注册状态，因此当前账户运行前须确认无现存 MyTracer 安装或进程。测试只使用唯一临时安装与数据根，不读取、修改或清理既有默认数据。执行前记录账户 SID、OS build、Node/npm/Electron/builder 版本与源 revision。

## 1. 产物来源与兼容矩阵

| 来源 | 目标 | schema | 预期 | 实际结果 |
| --- | --- | --- | --- | --- |
| `dev@d8b211b3c184cff8d0afdb09ff4b13164704290b`，应用 `0.1.0` | T081 实现候选 revision，应用 `0.1.1` | 3 → 3 | 相同 `appId=io.mytracer.desktop`、每用户安装身份和同一数据根，直接覆盖安装后保留全部事实与同机配置 | 待获授权账户实测 |
| 同版、低版、schema 升级或跨 Windows 用户 | 任意 | 未批准 | 不在 T081 声明的兼容来源矩阵内 | 未验证 |

六个既有预发布 Git 标签的应用版本均为 `0.1.0`。标签名不等于包内应用版本；A 固定上述 `dev` revision，B 须固定已提交的 T081 实现候选 revision。两包均在独立源目录构建，不覆盖或复用安装包。产物清单分别记录完整源 SHA、`package.json` 版本、`appId`、SHA-256、构建环境和 unsigned 状态；只有真实构建后才能填写 hash。二进制、导出正文、数据库和配置不得提交。

## 2. 构建与核对

在独立、可删除的构建目录分别检出 A/B 的不可变 Git revision（可使用 `git archive` 解包，不创建 worktree）。每份源先运行 `npm.cmd ci`。若锁定版本的 Electron 安装脚本未生成 `node_modules/electron/dist`，在该构建目录运行 `node node_modules/electron/install.js` 并核对 `node node_modules/electron/cli.js --version` 为 `v43.3.0`；不得改变依赖版本。随后运行：

```powershell
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
Get-FileHash -Algorithm SHA256 release/MyTracer-<version>-x64-setup.exe
```

构建器的 `--publish never` 为必需参数。核对各安装包文件存在且 hash 不同，A 包内版本为 `0.1.0`、B 包内版本为 `0.1.1`；检查 `electron-builder.yml` 的 `appId`、`perMachine: false` 和 NSIS x64 配置未变。记录实际签名状态为 `unsigned`，不得从文件名推断来源或版本。留存未改写的 A/B 安装包，向隔离环境复制时再次核对 SHA-256。

## 3. 获授权账户自动化验证

确认当前账户 SID 与批准的执行身份一致，在该账户的 PowerShell 中设置以下变量。默认隔离账户使用 `isolated-windows-identity`；本次 owner 特批的当前账户使用 `T081-owner-approved-current-account`。安装包路径须为绝对路径；hash 只填第 2 节实测的 64 位 SHA-256。测试代码会再次检查 SID、hash，以及当前账户是否有已注册的 MyTracer 安装、默认安装目录或运行进程；安装目录、`userData`、导出和清理限制在唯一临时根。

```powershell
$env:MYTRACER_UPGRADE_TEST = '1'
$env:MYTRACER_UPGRADE_ISOLATION_ACK = 'T081-owner-approved-current-account'
$env:MYTRACER_UPGRADE_ACCOUNT_SID = '<approved-account-SID>'
$env:MYTRACER_UPGRADE_OLD_INSTALLER = '<absolute-path-to-A-installer>'
$env:MYTRACER_UPGRADE_OLD_SHA256 = '<A-SHA256>'
$env:MYTRACER_UPGRADE_NEW_INSTALLER = '<absolute-path-to-B-installer>'
$env:MYTRACER_UPGRADE_NEW_SHA256 = '<B-SHA256>'
npm.cmd run test:e2e:run -- tests/e2e/windows-in-place-upgrade.e2e.test.ts
```

测试应报告 **1 passed、0 skipped**。它以 A 的 UI 创建目标和复盘，以正常 Application 命令建立行动、例行任务、四种已记录状态与缺失记录的 unknown、显式 LocalDate 和合成配置；重开 A 后导出并拍摄 SQLite 全表快照。随后不卸载 A，在同一目录安装 B；核对包内版本、同一数据根、导出业务数据、数据库所有业务表和合成配置状态。最后在 B 新增行动记录并重开确认。测试使用合成数据，配置值不输出到日志或证据。失败、超时或 skip 必须如实记录；不能把 `verify` 的 skip 当作安装通过。

运行 `npm.cmd run test:package-smoke` 也须在获授权账户完成同样预检；它验证当前 B 包的 unpacked/NSIS 安装态，但不代替 A→B 测试。完整 `npm.cmd run verify` 和定向导出/配置回归可在安全的本地开发环境运行。

## 4. 应用运行时安装与故障演练

在清理前一场景的测试安装注册项并核对无残留进程后，使用新的临时根与已核 hash 安装 A，创建合成目标/记录并保持 A 运行。启动 B 安装器，记录安装器可见提示、进程退出、A 是否仍能操作、数据库是否被并发写入、B 能否启动、历史与配置是否仍在。若安装器拒绝，确认 A 仍可用；若安装器继续，须检查没有残留旧进程或数据损坏。单独的安装器退出码不足以判定安全。发现需要改变非 T081 模块才能修复时停止并按升级提案流程处理。

故障演练仍使用新的临时根和合成数据。先保存旧版数据与导出快照，在安装中断或失败后记录安装器实际阶段、退出码、安装目录、数据根和能否启动；禁止因启动失败而删除数据根或以新空库冒充成功。演练应用外修复：退出残留进程，保留原始数据，重新运行与数据库 schema 兼容且 hash 已核对的同版本 B 安装包；若 B 不能运行，停止写入并寻求人工支持，不承诺低版回退或通用恢复。修复后重开、比对原有业务字段/关联/日期与导出，再写入一个新记录。无自动备份、安装原子性或数据导入恢复承诺。

项目所有者在获授权账户中按 T081 合同 §9.7 人工观察覆盖升级、历史/配置/导出、失败后修复和未签名安装提示。Agent 自动化结果不能代签人工验收。记录实际环境、A/B revision/版本/hash、步骤、结果及失败证据；不要记录凭据、正文、数据库或完整日志。

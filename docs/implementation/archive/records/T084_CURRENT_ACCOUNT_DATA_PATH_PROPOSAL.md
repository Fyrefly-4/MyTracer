# T084 — 当前账户数据路径核验与提案撤回记录

> 历史归档（2026-10-11）：正文状态、失败和权限按原记录日期理解，不作为当前任务状态或新授权。导航见[归档索引](../INDEX.md)。

> 2026-10-04；已解决的 evidence_problem。此前“必须改动默认数据目录”的提案已撤回，不再要求新增路径权限。记录保留探测失败和判断修正，不改写既有 Git 历史。当前账户、唯一临时合成根和完整 A→B→C 方案继续适用。

## 发现时的假设与局限

分支 `task/T084-private-release-acceptance`；已通过候选 `9a1a0a9177ad3f0db80d8d5ecbe0079f10ee9774`、base `de88b1877ba2cfc48f1e593bcfcb2007471a3fa3`。首次探测在同一 PowerShell 进程中先调用 SHGetFolderPath(CSIDL_APPDATA)，再改变 APPDATA/USERPROFILE；返回路径不变（两个 API 调用均为 0），记录在 `.tmp/T084-windows-known-folder-probe.json`。

曾据此怀疑新 Electron 测试进程也不会使用合成默认根，并提出默认目录保留/测试例外建议。但上述进程内修改不能代表测试实际采用的“启动时已设置完整合成 profile 布局”的新进程。该推断过早，不能作为实装路径不隔离的证明。独立直接 Electron 探测超时也不是路径行为通过/失败证据。

## 新进程与默认路径验证

改用锁定 Electron 43.3.0、Chromium 150.0.7871.212 的独立最小程序；环境与 `minimalElectronEnvironment` 一致：USERPROFILE 为唯一根，APPDATA/LOCALAPPDATA 分别为该根的 AppData/Roaming、AppData/Local，并在启动前创建完整布局。程序不加载 MyTracer 或 SQLite，不安装、不读取默认数据库内容。

1. 带显式临时 userData 的新进程探测：appData 等于合成 APPDATA，不等于父进程的真实 appData。结果在 `.tmp/T084-electron-fresh-process-path-probe.json`。
2. 再移除 `--user-data-dir` 和全部 `app.setPath`，核验默认路径：appData 等于合成 APPDATA，实际默认 userData 位于该合成 appData 下，不等于父进程真实目录。结果在 `.tmp/T084-electron-default-synthetic-root-probe.json`，Electron/Chromium 版本也来自该实际进程。

这两条支持当前 helper 的新进程环境方案，不替代 MyTracer 真实安装、NSIS 重开、加密配置或 A/B/C 数据比对。产品 [路径映射](https://github.com/electron/electron/blob/v43.3.0/shell/common/electron_paths.h)、[userData 构造](https://github.com/electron/electron/blob/v43.3.0/shell/common/electron_paths.cc) 及 [DEPS 固定的 Chromium 版本](https://github.com/electron/electron/blob/v43.3.0/DEPS) 对应的 [Windows 实现](https://github.com/chromium/chromium/blob/150.0.7871.212/base/base_paths_win.cc) 仅作源码依据；不以浮动 main 链接或源码本身替代运行结果。

## 保留的失败与安装前保护

安全检查提交 `1437909472dc5cafcf8b12cdab7bd9e971e45530` 增加 `assertSyntheticDefaultAppData`，在任何安装包输入及 NSIS/Electron 产品执行前，用新 PowerShell 子进程验证 Windows appData 与当前合成环境一致；启动失败、信号终止、非零退出均停止。不改变生产数据路径、安装身份、schema 或权限。

第一次 `installed-preflight-refusal` 捕获 `.tmp/evidence/T084-installed-preflight-refusal-1437909472dc-20261004154034.json` 为 exit 1：实际错误是缺少 BASE_INSTALLER，不是路径不隔离；路径检查已通过。原预期验证没有得到证明，因此保留为失败，不记作“已验证路径拒绝”。执行没有提供安装包或 token，也未启动 NSIS。该结果促成上述新进程诊断修正。

保护顺序经过只读 review，正常离线 fixture/typecheck 已通过。后续回归和 CI 分别绑定实际修正 revision，不把旧 `9a1a0a9` 通过结果归给新检查。

## 权限与后续结论

不执行此前建议的默认 mytracer 目录改名/备份，不创建真实默认合成数据库，不授予或使用 AGENTS §8 例外；原目录/缓存未搬移、删除、读取内容或用于测试。仍使用 owner 已批准的当前账户、唯一临时安装/数据/导出/缓存根及实际默认 userData 归属检查；实装前重做 SID/进程/注册项预检。破坏性失败及清理保持独立门禁。

历史 `9a1a0a9` 候选 run `37210608192`、artifact `11306741649` 的完整 ZIP 与五资产已核验，NSIS 为 NotSigned；archive SHA-256 为 `4a66019f5f8f543f123f2d0755519e89d2d9992f35b700e31c74019e68af61fb`，NSIS 为 `cab2fc6a0e92ec8512a2250cc1a98bc9ab41bc035735ee73840b4d2968d4119f`，manifest 为 `4d81c7b29839bbd43d7b1baa35ab83b71e88f60b3e36c93c228c013f0a6449ff`。不归给后续 revision 或新产物。固定私有源身份已核对，尚未创建 v0.1.4 tag/Release。

剩余 owner 门禁是具体演练 Release/产物审批、专用只读 token 安全注入、安装向导与人工验收；最终 docs closeout、Ready、merge/main/tag/正式发布权限仍按合同。T084 仍 active，真实安装和 S8 最终集成证据尚未完成。

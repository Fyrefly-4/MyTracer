# T084 — 当前账户实装数据路径调整提案

> 2026-10-04；testability_problem / permission_change；待 owner 决议。提案不是权限来源。已批准的当前账户与完整 A→B→C 正常链路不变；尚未执行安装、目录搬移、tag 或 Release。

## 发现与证据

候选 `9a1a0a9177ad3f0db80d8d5ecbe0079f10ee9774`、base `de88b1877ba2cfc48f1e593bcfcb2007471a3fa3`，分支 `task/T084-private-release-acceptance`。当前账户方案原假设：只设置测试进程的 APPDATA/USERPROFILE 即可让安装版的实际默认 userData 位于唯一临时根，并由安装器重启继承该路径。

该假设不成立。Electron 43.3.0 的 [Windows 路径映射](https://github.com/electron/electron/blob/v43.3.0/shell/common/electron_paths.h) 将 appData 映射至 Windows roaming known folder；[userData 实现](https://github.com/electron/electron/blob/v43.3.0/shell/common/electron_paths.cc) 在该目录下追加应用名。Electron [锁定的 Chromium 150.0.7871.212](https://github.com/electron/electron/blob/v43.3.0/DEPS) 的 Windows [路径实现](https://github.com/chromium/chromium/blob/150.0.7871.212/base/base_paths_win.cc) 使用 SHGetFolderPath(CSIDL_APPDATA)。

本机对相同系统 API 的只读探测：修改本工具进程 APPDATA 与 USERPROFILE 前后，返回目录未改变，也不等于合成环境根；两个 API 调用均返回 0。脱敏结果在 `.tmp/T084-windows-known-folder-probe.json`。探测没有加载 MyTracer、打开 SQLite、安装或修改账户配置。另一个显式临时 userData 的独立 Electron 探测超时，保留为失败，不能当作 Electron 运行时通过证据；上述结论来自源码与相同 Windows API 实测。

原实装用例在应用启动后才断言 userData 归属，届时 Main 可能已打开默认数据库。因此加入安装前的 Windows known-folder 拒绝检查：临时 APPDATA 不对应真实 known folder 时，在取得安装包输入/启动任何 NSIS 前停止。该保护不证明正常链路通过，也不修改产品路径规则。

实际默认数据目录存在，但仅检查了目录元数据，没有读取数据库或配置内容。Owner 已说明项目未投入使用、没有需要保护的真实数据；该说明不等于任意目录删除授权。没有 MyTracer 进程、匹配 HKCU 卸载注册项或默认安装目录（实装前仍须重做预检）。

## 现行权限与冲突

- T084 合同 §4 / §7：当前账户可以使用全新合成数据，但现存默认数据/缓存不进入测试范围；无清理授权。
- AGENTS §8：自动测试不得指向真实 Electron userData 数据库。
- T084 §6：不修改生产 userData 解析或安装身份。
- 原临时环境根方案无法证明默认数据路径被隔离；不得默默让测试使用现存默认数据库，也不改生产代码绕过。

## 建议的最小调整

建议保持当前账户、正常默认数据路径及完整 `0.1.0`→手动 `0.1.3`→应用内 `0.1.4`，单独批准以下 T084 实装准备：

1. 在实际批准账户关闭所有 MyTracer，核验 SID、注册项、进程、目录 realpath/非重解析点和目标不存在。
2. 将现存 `C:\Users\RISEY\AppData\Roaming\mytracer` **原位改名保留**为 `C:\Users\RISEY\AppData\Roaming\mytracer.T084-before-20261004`；不读取其内容、不删除、不覆盖。若目标已存在或目录归属不符，停止，不自行选择覆盖方案。
3. 把重新创建的默认 `C:\Users\RISEY\AppData\Roaming\mytracer` 明确批准为本次全新合成验收数据根，只允许本次 opt-in 用例在其中创建合成数据库/配置。为此对 AGENTS §8 的默认 userData 禁止条款作一次性、精确路径例外；普通 CI 不适用此例外。
4. 安装目录、导出及 updater 缓存仍使用本次唯一临时根；updater 锁定实现读取 LOCALAPPDATA 环境值，不能据此推断 Electron userData 同样读取该值。全链路保留同一实际默认数据根，覆盖安装器自动重开的正常路径，不改产品代码。
5. 验收结束先保留合成数据和原目录备份；清理、恢复目录及卸载注册项另行按具体归属批准，不自动删除。破坏性失败矩阵仍 pending，正常链路批准不包含耗尽磁盘、断电或强制中断。

影响仅限 T084 合同、metadata、实装用例/相关 helper 与操作程序。无依赖、schema/migration、导出契约、生产路径、AI 权限或产品语义变化。真实默认数据目录操作和一次性测试例外必须由 owner 明确批准后才可落实。

## 替代方式及局限

显式 `--user-data-dir` 临时根可以隔离人工启动的 A/B/C，但该参数不会自动传递至 NSIS 重开。若选择关闭安装器自动启动后自行带参数重开，只能证明该限定路径，不能冒充完整正常默认重开验收；需另行决议其证据范围。当前不以此替换已批准的完整链路，也不重新要求已放弃的 VM/独立账户。

## 已安全完成与恢复点

- 完整本地回归、独立只读 review、当前 source 的两项 hosted CI 已通过；CI 捕获 head/test-merge 分别为 `9a1a0a9177ad3f0db80d8d5ecbe0079f10ee9774` / `25016682aad232d414ce782243323f6b110451ee`。
- 候选 run `37210608192`、artifact `11306741649` 的完整 ZIP SHA-256 为 `4a66019f5f8f543f123f2d0755519e89d2d9992f35b700e31c74019e68af61fb`；白名单解压及 bundle 校验通过；NSIS 为 NotSigned。
- `0.1.4` NSIS SHA-256：`cab2fc6a0e92ec8512a2250cc1a98bc9ab41bc035735ee73840b4d2968d4119f`；manifest SHA-256：`4d81c7b29839bbd43d7b1baa35ab83b71e88f60b3e36c93c228c013f0a6449ff`。这些 hash 仅绑定上述历史候选，不归给后续安全检查提交或新包。
- 固定私有源身份核对通过，`v0.1.4` tag/可见 Release 不存在；尚未发布。具体发布审批与凭据注入仍是独立门禁。

最低 owner 决议：批准上述精确目录保留/合成根例外，或提供保持完整默认升级链路的替代数据安排。批准后先落实合同和测试，重新验证、评审并绑定实际新 revision；随后准备真实源审批及实装。当前 T084 保持 active，真实升级、人工验收和阶段最终集成仍未完成。

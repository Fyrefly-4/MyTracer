# T084 — S8 连续升级与失败矩阵程序

> 2026-10-03；程序已编写，真实应用内连续升级、私有鉴权、unsigned 体验和 S8 owner 人工验收均未执行。完成测试源码不等于通过。

## 隔离与启动条件

一次性 Windows VM/独立测试账户，owner 明确批准账户 SID；没有 MyTracer 现存进程和安装注册项。T081/T082/T083 的 owner 当前账户例外不能借用。测试只创建合成业务数据、同用户合成 safeStorage 配置和临时根；真实 AI 请求不发生。数据根采用环境隔离后的实际默认 userData，避免 `--user-data-dir` 测试参数未被安装器重启传递而伪装数据连续性。

Owner 审阅并发布确切真实 stable 候选后，准备以下测试进程环境输入；不要把 token 值、实际 SID或绝对用户路径写入证据 JSON/聊天/截图：

- `MYTRACER_INSTALLED_UPDATE_TEST=1`
- `MYTRACER_INSTALLED_UPDATE_ISOLATION_ACK=isolated-windows-identity`
- `MYTRACER_INSTALLED_UPDATE_ACCOUNT_SID`：批准的实际隔离账户 SID。
- `MYTRACER_INSTALLED_UPDATE_BASE_INSTALLER`：经审核无更新器 `0.1.0` NSIS 绝对路径，沿用 T081 固定来源 `d8b211b3c184cff8d0afdb09ff4b13164704290b` 的实际包。
- `MYTRACER_INSTALLED_UPDATE_BASE_SHA256`：上述 A 包 hash，执行前再核对实际文件。
- `MYTRACER_INSTALLED_UPDATE_SOURCE_INSTALLER`：经审核真实 `0.1.3` NSIS 绝对路径。
- `MYTRACER_INSTALLED_UPDATE_SOURCE_SHA256`：上述来源包 hash。
- `MYTRACER_INSTALLED_UPDATE_TARGET_VERSION=0.1.4`
- `MYTRACER_INSTALLED_UPDATE_TARGET_SHA256`：经 owner 审阅真实源候选 NSIS hash。
- `MYTRACER_UPDATE_TOKEN`：安全注入的真实专用只读凭据，测试只将其交给 Main；普通 CI 环境不继承。

```powershell
npm.cmd run test:installed-update
```

入口在缺少 opt-in 或隔离确认时失败，而非成功 skip。真实安装用例在默认 Playwright 回归中 skip；同文件的离线用例只验证合成 fixture 的生命周期覆盖及导出/重开保留，不证明真实安装路径。先运行 metadata 和 evidence wrapper，命令仅记录上述 script argv，不记录环境值。

## 连续应用内流程

连续测试从 A=`0.1.0` 开始，在 A 创建下述同一 fixture 和合成配置，导出并重开比对；随后手动原位安装 B=`0.1.3`，保持同一安装目录与默认数据根，完整导出/配置比对及再次重开。以下真实检查、下载、草稿阻断和安装交接在 B 执行，目标 C=`0.1.4`。三段之间不重置数据；三包的 source、版本和 hash 必须逐项绑定，不能由标签名推断包内版本。

Fixture 经普通 API 创建 Goal/Action/Routine 生命周期、四种 Routine Record及 unknown、partial Action Record、理解/困惑、Today focus/intention、Review和合成加密配置。B 主动检查/下载真实 C→核验临时根中的已下载 NSIS SHA-256→未保存 Goal 草稿阻断且输入保留→处理草稿并导出→重新确认安装。

**Operator step**：NSIS 是交互安装器，owner 在隔离 Windows 完成由该次应用交接启动的 wizard，观察 unsigned/未知发布者提示。随后关闭安装器自动重开的新版，不另行启动其他包或重置 fixture。测试等待目标可执行版本更新及进程退出，然后重开实际新版，核验相同 userData、完整导出字段/关联/历史日期、加密配置可用，再写入新记录并再次重开验证。

测试最后保留临时安装及合成数据以便人工核查，不自动卸载或清理注册项。owner 验收完成后销毁一次性 VM，或另行批准严格限定的清理。不得从默认用户数据库复制真实内容充当 fixture。

新增测试入口按 S8 设计使同一 fixture 贯穿 A→B→C，目前尚未真实执行，不预填通过。现有 `windows-in-place-upgrade` 已由 T083 参数化，可用于单独的手动路径与失败验证；其结果不能独自替代应用内交接。

## 失败矩阵与 owner 结果

| 场景                                                   | 需要的真实/受控证据                                | 当前状态                               |
| ------------------------------------------------------ | -------------------------------------------------- | -------------------------------------- |
| 无 token、错误/到期/撤销凭据、无权访问                 | 真实私有源，错误区别于无更新，核心 CRUD/导出仍可用 | pending                                |
| 断网、重试、稍后、普通退出                             | 真安装客户端；不隐式安装                           | pending                                |
| 缺失元数据、损坏包、同版/低版/预发布                   | 离线工具及受控源，不损坏真实 latest                | fake工具有测试；安装客户端矩阵 pending |
| 各 Goal/Action/Routine/Review/Record/AI 草稿，迟到结果 | 既有分层回归及 owner 真安装体验，取消不丢输入      | 既有自动化输入；owner pending          |
| 写入/导出/配置排空、第二实例、连接关闭后失败           | 既有 T083 tests，最终 revision 回归及实装复核      | 最终复核 pending                       |
| 磁盘不足、拒绝安装、安装中断/失败人工修复              | 只在一次性 VM，保留数据后人工同版修复或更高兼容包  | pending                                |
| 过新 schema、来源包兼容、完整字段/关联/LocalDate       | 隔离 fixture；禁止创建替代空库                     | 既有自动化输入；阶段最终 pending       |
| 私有发布身份/来源/产物/上传失败                        | 离线 fake API 与真实授权演练分别记结果             | fake事务有测试；远端演练 pending       |

各项实际结果绑定 source/task delivery/dev integration/stage final revision、真实命令、Windows 环境、包/元数据 hash、CI head/test-merge、run/artifact、签名状态及局限。失败/skip保留，后续通过用 supersedes。任何未覆盖项不得因其他测试绿灯而记 pass。

最后在最终 S8 dev revision 执行 aggregate、打包、受影响 AC-01～07 与真实升级/失败矩阵；owner 按 S8 §6.3 记录人工通过/失败/部分通过。真实源发现产品实现问题时先报告合同范围，不顺带修改 T082/T083 产品代码。阶段通过后仍不自动 Ready、merge、main、tag、Release或启动下一阶段。

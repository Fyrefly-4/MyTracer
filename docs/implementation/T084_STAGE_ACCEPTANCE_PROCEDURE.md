# T084 — S8 连续升级与失败矩阵程序

> 2026-10-05 文档收尾：正常 A→B→C 与三项非破坏性负面检查已执行，结果见下述执行记录及 EV-T084-002；其余真实失败路径和 owner 人工验收保持 pending。本次 owner 暂不继续测试，不代表缺口获豁免。

> 2026-10-06 最新决定：owner 在听取剩余真实故障与两组实装检查后明确“明确忽略这些测试”。本文件下方的剩余矩阵按各日期保留；本次 S8 收尾将未执行部分记为 waived-by-owner，不再要求演练，不改为 pass。范围、风险和保留门禁见 [T809 豁免记录](T809_S8_FINAL_ACCEPTANCE.md#2026-10-06-owner-明确豁免剩余真实验收)及 [EV-S8-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)。原暂缓和此次明确豁免是不同授权事实；正式发布批准、来源/产物校验与集成门禁仍适用。

## 隔离与启动条件

2026-10-04 owner 单独批准 T084 使用当前 Windows 账户＋全新合成数据，替代一次性 VM/独立测试账户；仍核对实际运行 SID，没有 MyTracer 现存进程和安装注册项。该批准只覆盖完整正常 A→B→C 链路，不包含磁盘耗尽、强制中断或损坏安装器等破坏性场景。测试只创建合成业务数据、同用户合成 safeStorage 配置和临时根；真实 AI 请求不发生。数据根采用环境隔离后的实际默认 userData，避免 `--user-data-dir` 测试参数未被安装器重启传递而伪装数据连续性。

Owner 审阅并发布确切真实 stable 候选后，准备以下测试进程环境输入；不要把 token 值、实际 SID或绝对用户路径写入证据 JSON/聊天/截图：

- `MYTRACER_INSTALLED_UPDATE_TEST=1`
- `MYTRACER_INSTALLED_UPDATE_ISOLATION_ACK=t084-approved-current-account-synthetic-data`（T084 专用当前账户批准；独立账户仍可使用 `isolated-windows-identity`）。
- `MYTRACER_INSTALLED_UPDATE_ACCOUNT_SID`：批准的实际执行账户 SID；启动时与 `whoami` 输出一致。
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

### 路径与清理边界

每次实装前在实际 Windows 账户重新只读检查 SID、MyTracer 进程、HKCU 卸载注册项、默认安装及数据目录。2026-10-04 预检未发现进程/安装注册项，默认安装目录不存在；默认 userData 与 updater 缓存存在，保持不动，不读取数据内容。沙箱身份与真实账户不同，不使用沙箱预检冒充实装批准。

测试新建唯一 OS 临时根 `mytracer-tests-*`，安装限其 `installed-app`，合成数据、配置、缓存限其环境重定向的 `AppData/Roaming`、`AppData/Local`，导出限 `exports`。运行中核验真实默认 userData 和安装文件的 realpath 均在该根内，不使用真实默认数据库。保留相同根贯穿 A/B/C 和安装器重启；若新版路径越界，停止验收。实际根和 SID 只记本地操作记录，不写通用证据 JSON。

本方案没有删除既有目录、自动卸载或清理注册项的授权。测试保留其生成的安装和合成数据供人工核查，验收后按确切路径与归属另行批准清理。

## 连续应用内流程

连续测试从 A=`0.1.0` 开始，在 A 创建下述同一 fixture 和合成配置，导出并重开比对；随后手动原位安装 B=`0.1.3`，保持同一安装目录与默认数据根，完整导出/配置比对及再次重开。以下真实检查、下载、草稿阻断和安装交接在 B 执行，目标 C=`0.1.4`。三段之间不重置数据；三包的 source、版本和 hash 必须逐项绑定，不能由标签名推断包内版本。

Fixture 经普通 API 创建 Goal/Action/Routine 生命周期、四种 Routine Record及 unknown、partial Action Record、理解/困惑、Today focus/intention、Review和合成加密配置。B 主动检查/下载真实 C→核验临时根中的已下载 NSIS SHA-256→未保存 Goal 草稿阻断且输入保留→处理草稿并导出→重新确认安装。

**Operator step**：NSIS 是交互安装器，owner 在已批准当前 Windows 账户完成由该次应用交接启动的 wizard，观察 unsigned/未知发布者提示。随后关闭安装器自动重开的新版，不另行启动其他包或重置 fixture。测试等待目标可执行版本更新及进程退出，然后重开实际新版，核验相同 userData、完整导出字段/关联/历史日期、加密配置可用，再写入新记录并再次重开验证。

测试最后保留临时安装及合成数据以便人工核查，不自动卸载或清理注册项。owner 验收完成后另行批准严格限定的清理。不得从默认用户数据库复制真实内容充当 fixture。

新增测试入口已实际运行 A→B→C，原命令因 Windows ProductVersion 格式断言失败，随后在既有 C 上接续剩余数据/配置/写入/重开检查通过；不得将原命令改记为通过。现有 `windows-in-place-upgrade` 已由 T083 参数化，可用于单独的手动路径与失败验证；其结果不能独自替代应用内交接。

## 失败矩阵与 owner 结果

| 场景                                                   | 需要的真实/受控证据                                | 当前状态                                                                  |
| ------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------- |
| 无 token、错误/到期/撤销凭据、无权访问                 | 真实私有源，错误区别于无更新，核心操作/导出仍可用  | 无凭据和合成错误凭据通过；真实到期/撤销/有效无权凭据 pending              |
| 断网、重试、稍后、普通退出                             | 真安装客户端；不隐式安装                           | 进程请求阻断下失败提示、重复失败及稍后通过；真实下载中断/恢复重试 pending |
| 缺失元数据、损坏包、同版/低版/预发布                   | 离线工具及受控源，不损坏真实 latest                | fake工具有测试；安装客户端矩阵 pending                                    |
| 各 Goal/Action/Routine/Review/Record/AI 草稿，迟到结果 | 既有分层回归及 owner 真安装体验，取消不丢输入      | 既有自动化输入；owner pending                                             |
| 写入/导出/配置排空、第二实例、连接关闭后失败           | 既有 T083 tests，最终 revision 回归及实装复核      | 最终复核 pending                                                          |
| 磁盘不足、拒绝安装、安装中断/失败人工修复              | 另行决定受控环境；当前正常链路批准不覆盖破坏性演练 | pending                                                                   |
| 过新 schema、来源包兼容、完整字段/关联/LocalDate       | 隔离 fixture；禁止创建替代空库                     | 既有自动化输入；阶段最终 pending                                          |
| 私有发布身份/来源/产物/上传失败                        | 离线 fake API 与真实授权演练分别记结果             | fake拒绝策略通过，授权真实发布成功；真实远端失败 pending                  |

各项实际结果绑定 source/task delivery/dev integration/stage final revision、真实命令、Windows 环境、包/元数据 hash、CI head/test-merge、run/artifact、签名状态及局限。失败/skip保留，后续通过用 supersedes。任何未覆盖项不得因其他测试绿灯而记 pass。

最后在最终 S8 dev revision 执行 aggregate、打包、受影响 AC-01～07 与真实升级/失败矩阵；owner 按 S8 §6.3 记录人工通过/失败/部分通过。真实源发现产品实现问题时先报告合同范围，不顺带修改 T082/T083 产品代码。阶段通过后仍不自动 Ready、merge、main、tag、Release或启动下一阶段。

## 2026-10-05 执行结果与暂缓安排

正常链路的 A/B/C 版本、来源和包 hash，以及命令证据在 [EV-T084-002](ACCEPTANCE_EVIDENCE_V0.1.md#ev-t084-002)。原命令已完成 A/B 导出重开、真实 C 下载/hash、Goal 草稿阻断、安装交接与 owner NSIS 操作；仅在等待目标版本时将 `0.1.4.0` 错当成非 `0.1.4`，exit 1。Owner 批准不重装的既有 C 接续：同一默认合成 userData、完整导出、合成配置可用、新记录写入和重开持久化、包未改变共八项通过。验证源码 f9e88a1 将零 Windows revision 归一化，非零 revision 仍保留；实装产品源码仍为 a575976，未更换 Release 资产。

无凭据返回 `error/not-configured`，合成错误 token 访问真实固定私有 API 返回 `error/authentication`；两者无候选、重复检查仍失败，普通创建/暂停/导出可用。进程内请求阻断实际返回 `error/unavailable`，对应“当前无法连接更新源”提示可见，重复检查与稍后、核心操作可用。原组合命令及 network 错误码预期诊断 exit 1 保留；后续补测 exit 0 仅 supersedes 该诊断预期，不证明物理断网、真实下载中断或恢复重试。

草稿种类、迟到/取消、排空/超时、第二实例、版本策略、过新 schema、传输策略和损坏字节有候选 revision 的分层自动化结果；未由测试名称推导实装人工结果。磁盘不足、拒绝/中断安装及失败修复未执行。本次 owner 明确暂不继续执行，批准仅文档收尾与最后一次推送；未验证项继续 pending，不清理安装/临时数据、不重新安装、不代签 unsigned/系统提示及人工体验，不声称 T084 或 S8 完成。

### 2026-10-06 T809 聚合进度

T081～T084 已分别通过 PR #57～#60 集成至固定产品 dev revision `080c308ff511705bfd8ab21386a03d58ec311dcd`。T809 本地定向、完整 verify 和禁止发布的打包通过；owner 报告本地 0.1.3→0.1.4 应用内更新、未保存输入保护、数据保留和重开持久化的简明步骤全部通过。详见 [EV-S8-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001) 与 [T809 合同](T809_S8_FINAL_ACCEPTANCE.md)。此报告未覆盖完整实装配置/导出绑定、全部真实故障或安装 smoke；T084/T809 仍 active，S8 未整体通过。历史失败与 pending 保留，不执行正式发布。

### 2026-10-06 最终收口状态

Owner 已报告正式凭据部署与重启检查完成，并明确豁免剩余真实故障及实装复核；原 pending 为历史记录，现按 waived-by-owner/未执行接受风险处理，不再阻塞本次 S8 收尾。独立评审和 d57e653 head CI 已通过；hosted aggregate/package/package-smoke 的 complete/exit0 artifacts 已核实。Owner 授权最终文档收口、模板 PR 正文和最后一次推送；T084/T809 仍 active，最新推送 head CI 和交付待核验，不自动 Ready/merge/main/tag/release。正式发布成功仍未执行，现有 v0.1.4 演练资产不覆盖。具体范围及历史证据见 [T809](T809_S8_FINAL_ACCEPTANCE.md) 和 [EV-S8-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-s8-001)。

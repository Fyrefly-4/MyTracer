# MyTracer

面向个人本地使用的 Windows 桌面应用，帮助你保存目标、选择下一步、记录真实行动，并在中断后重新开始。

MyTracer 关注实际发生的事情：有所行动、达到目标、主动休息和未记录分别表达。它不以连续打卡、评分或惩罚推动使用；AI 启动帮助由你主动请求，建议经确认后才写入数据。

## 主要功能

- **目标与行动**：管理目标、下一步和今日重点，记录行动时间、理解与困惑。
- **例行与意向**：安排例行节奏和非强制的今日意向，区分未记录、未进行、主动休息、已行动和达到目标。
- **进展与复盘**：查看事实型统计，处理中断，保存轻量复盘。
- **AI 启动帮助**：使用少量相关记录生成可修改、可拒绝的建议；AI 不可用时核心功能仍可使用。
- **本地数据控制**：修改和删除记录、导出核心数据，并确认下载与安装更新。

当前定位为个人自用 Demo。账号、云同步、后台提醒和自动导入恢复不在本版范围。

## 安装与使用

支持 Windows x64，安装包通过项目的私有 GitHub Releases 分发，需要相应访问权限。当前包未签名，已有 `v0.1.4` 属于更新演练。

安装、更新凭据和备用原位安装见[维护入口](docs/MAINTENANCE.md#按事项查找)。正式发布状态和已知限制也从该入口查阅。

## 本地运行

在 Windows 上准备符合 [package.json](package.json) `engines` 的 Node.js 和 npm，然后运行：

```powershell
npm.cmd ci
npm.cmd exec -- install-electron --no
npm.cmd run dev
```

依赖和 Electron 二进制首次还原需要网络访问。构建、验证与打包命令见[开发与验证](docs/MAINTENANCE.md#开发与验证)。

## 技术栈

| 层次 | 技术 |
| --- | --- |
| 桌面运行时 | Electron |
| 界面 | React、TypeScript、Vite |
| 本地存储 | SQLite、better-sqlite3 |
| AI 适配 | Main 中的可替换 Provider；首个适配器为 LiteLLM Gateway |
| 自动验证 | Vitest、Playwright、Windows CI |

Renderer 负责界面，Preload 提供窄类型 API，Main 负责数据、导出、凭据和 Provider 访问；Domain 保持独立。详见[总体架构](docs/architecture/ARCHITECTURE_V0.1.md)。

## 文档

- [维护入口](docs/MAINTENANCE.md)：当前概况、日常维护、变更与历史追溯。
- [产品需求](docs/PRODUCT_REQUIREMENTS_V0.1.md)：产品范围、行为语义与验收标准。
- [Agent 工作规约](AGENTS.md)：授权 Agent 的仓库工作要求。

# 参与 MyTracer

欢迎反馈问题、提出想法，或提交一个小改动。先从你遇到的具体情况说起，不需要准备完整方案。

## 本地开发

MyTracer 使用 Electron、React、TypeScript 和 SQLite，面向 Windows x64。在 Windows 上准备符合 [package.json](package.json) `engines` 的 Node.js 与 npm，然后在仓库根目录运行：

```powershell
npm.cmd ci
npm.cmd exec -- install-electron --no
npm.cmd run dev
```

首次安装依赖与下载 Electron 需要网络。构建、测试和打包命令见[开发与验证](docs/MAINTENANCE.md#开发与验证)；模块与数据边界从[架构入口](docs/architecture/README.md)查找。分支从最新 `main` 开始，PR 目标为 `main`；具体流程见 [GitHub 工作流](docs/implementation/GITHUB_WORKFLOW_V0.1.md)。

## 验证与 PR

保持改动聚焦，按影响范围选择检查。文档改动检查格式、链接和差异即可；代码改动运行相关测试，必要时补充回归验证。完整应用验证和 Electron E2E 需要合适的 Windows 环境，详见维护文档。不要为通过检查而弱化测试。

PR 描述应说明解决的问题、改动后的结果、实际执行的检查与未验证项。界面变更适用时附截图，使用虚构的通用示例，并说明需要人工确认的部分。遵循仓库的 [PR 模板](.github/pull_request_template.md)，无需复制历史任务或阶段治理记录。

## 保护数据

不要上传真实个人记录、数据库、导出文件、token、密钥或含敏感内容的日志与截图。复现和测试使用隔离的临时数据、虚构示例和 fake Provider；真实 AI 服务测试须另行获得授权。

项目代码采用 [MIT License](LICENSE)。保留所使用第三方代码、依赖与资源的原有许可及署名；第三方内容仍适用各自的许可。

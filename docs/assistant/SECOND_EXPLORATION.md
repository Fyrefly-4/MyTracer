# Assistant 第二轮探索

本轮来自 #161 的第二轮方向及 2026-10-26 所有者批准，集成目标只为 `assistant/exploration`。三个可用路径优先于完整八故事路线；不改变宿主页面主布局，不增加依赖或 schema 迁移。

## 体验与边界

- 数据页编辑行动／例行记录：`AI 整理笔记` 在编辑器内打开整理卡片。当前笔记自动带入，可对照原文和候选，明确选择填入编辑草稿，再使用原页面的「保存修改」。需要追问时，`带着内容继续对话` 保留同一会话、参考与编辑器桥接。
- 侧栏 `AI 助手`：不选目标也能直接聊。默认不读取业务快照，也不请求模型；只有发送才发起请求。自由对话可以没有来源、没有候选、没有任何业务写入。目标页 `AI 接上上次` 恢复对应本地会话；参考范围中单独授权查询该目标记录。
- 复盘事实列表选择参考后，`AI 回顾选定内容` 使用所选事实，展示来源、查询与程序统计，并允许编辑三字段候选、填入原复盘草稿。正式复盘仍由原编辑器手动保存。

配置留在服务设置；历史和保存模式按需展开。参考显示标题与原文，不展示内部对象 ID／版本哈希。参考选择器由用户展开才读取本机候选列表，勾选或目标范围授权后才允许传给模型。只读工具仍受当前范围、三次调用、八条来源、字符与历史预算约束；截断和省略数量可见，不宣称完整历史。

Main 不再注入 Assistant 业务 writer，旧 `assistant:confirm-write` 接口只返回 unsupported；这不是只隐藏按钮。预览仅校验候选、来源和目标版本。Renderer 填入还核对入口对象、编辑版本、存活状态，成功后禁止重复填入；内容变化需重新整理。历史操作日志继续可读，不重放旧写入。

`conversation/free-chat` 是明确的空上下文标记，不对应业务对象。旧会话 JSON v1 仍可读取，无 SQLite 迁移。保存聊天不等于长期记忆。

第一轮独立的 Today AI 启动帮助仍为旧功能，未纳入本轮 Assistant 通道重构；本轮不扩大它的权限或将它作为新 Assistant 的写入后门。后续统一入口需要单独迁移它的既有产品／测试契约。

## main 兼容性判断

开发前核实探索源 `0a2a2aed022e5bda72db03b56389a1f19652c07d` 与 main `a02175e6cf598f08f3c4d053cccb2cf85d42816c`。main 后续包含记录草稿、复盘保存状态、Today／Goals／Routines／Data 的界面修复与发布；未整体 merge 或替换。当前 Assistant 使用原有 editor setter 与版本桥接，无这些改动的强制依赖。此分支不宣称已经包含 main 后续修复；最终向 main 集成需再次审查交叉编辑。

## 隔离预览与复现

仅使用合成资料与固定模拟响应。浏览器预览只证明 Renderer 交互，不证明 Electron／IPC／SQLite、Windows 材质或真实模型质量。

在阶段分支独立 checkout，使用仓库锁定 Node 24.18.0 / npm 11.16.0：

```powershell
npm.cmd ci
npm.cmd exec -- vite --config tests/renderer/assistant.vite.config.ts
```

打开 `http://127.0.0.1:4178/tests/renderer/assistant-harness.html`。可自由点击整理笔记、独立聊天、接续目标与回顾；界面明确标为合成演示，刷新清空。不会启动 Electron 或读取正常用户资料。

浏览器自动检查：

```powershell
npm.cmd exec -- playwright test --config tests/renderer/assistant.playwright.config.ts
```

需要已安装的 Playwright Chromium；也可将 `MYTRACER_TEST_CHROMIUM` 指向本机 Chromium。不要把浏览器检查称为原生验收。

Windows 原生合成旅程：

```powershell
node tools/ci/run-phase.mjs electron
npm.cmd run build
npm.cmd run test:e2e:run -- tests/e2e/assistant-journey.e2e.test.ts --headed
```

会自动建立唯一 `mytracer-tests-*` 临时目录、独立 userData／cwd／环境／marker，播种通用合成记录，只替换 HTTP transport 和受隔离门控的合成凭据保护。测试显式 `chromiumSandbox: true` 并断言没有 `no-sandbox`，不会调用真实服务，不需要真实密钥。

供单独的原生体验审计自由操作（这不是自动测试通过证据）：

```powershell
$env:MYTRACER_ASSISTANT_EXPLORE = '1'
npm.cmd run test:e2e:run -- tests/e2e/assistant-journey.e2e.test.ts --headed
Remove-Item Env:MYTRACER_ASSISTANT_EXPLORE
```

在合成配置与记录准备后，Playwright Inspector 暂停，应用显示「隔离合成预览」标记；可自行导航操作三个路径。结束后点击 Inspector Resume，让测试继续并执行 finally 清理。不要强杀后复用临时资料，也不要改成默认用户目录运行 `npm run dev`。CI 不启用此暂停。Linux 缺少显示或无法保留沙箱时应记录原错误，不允许通过禁用沙箱绕过。

本地及托管验证、确切 SHA 与最终交付状态记录在 PR 和 #161 评论，不将未执行的 Windows 人工／真实模型验证算作通过。

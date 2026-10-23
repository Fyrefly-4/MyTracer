# 目标列表短窗口实验截图

基线：`27762b2`。修改后截图对应本 PR 的 GoalsPage 与目标页专属 CSS 变更。

实际 Electron 在 Linux headless 后端运行，使用隔离 user-data 目录和纯合成的 14 个目标、8 个例行、25 条记录；空数据截图使用另一全新目录。没有读取真实用户数据，也没有调用在线 AI。

图片由 `BrowserWindow.capturePage()` 捕获；文件名数字分别是窗口宽度和 zoomFactor，1120 对应高度 760，820 对应高度 650。矩阵测量使用 DOM `clientHeight`，单位为 CSS px。详情长标题、颜色、字体大小和双栏结构保持不变。

- `before-*` / `after-*`：相同合成内容的修改前后对照。
- `after-guidance-focus.png`：125% 下键盘打开说明，焦点轮廓完整可见。
- `after-empty-guidance-focus.png`：独立空数据库下的说明与首次创建入口。
- `measurements.json`：三个尺寸与三个缩放级别的列表可用高度。

自动回归：`npm run build` 后运行 `npm run test:e2e:run -- tests/e2e/goal-list-height.e2e.test.ts`。覆盖空数据、长标题密集列表、单项搜索、无匹配、键盘 Enter/Space、减少动态效果、两个面板实际独立滚动。测试使用 content size，避免 Windows 窗框尺寸干扰视口矩阵。

这些截图不是 Windows 原生人工验收；MicaStrong、Windows 字体和系统标题栏的视觉确认仍需 Windows 桌面。完整实验说明和 CI 状态见对应 PR。

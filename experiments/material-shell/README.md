# MyTracer 独立材质壳实验

只有静态侧边栏、标题栏、奶白正文与两张卡片。默认「环境材质 / Mica / 轻微」。可切换实色、Mica / Acrylic，以及轻微 / 标准 / 明显。没有应用代码导入、数据库、更新器、业务操作、网络访问或真实用户数据；生产 UI 与依赖清单均未修改。

## Windows 启动

在仓库根目录的 PowerShell 中：

```powershell
git fetch origin codex/material-shell-experiment
git switch codex/material-shell-experiment
.\experiments\material-shell\launch.cmd
```

已有项目依赖时直接复用 Electron **43.3.0**，不构建应用。也可以直接运行：

```powershell
.\node_modules\.bin\electron.cmd .\experiments\material-shell\main.cjs
```

若没有 node_modules，安装 Node.js 后只下载相同版本的 Electron（首次需要网络），不用安装 MyTracer 全部依赖：

```powershell
npm.cmd exec --yes --package=electron@43.3.0 -- electron experiments/material-shell/main.cjs
```

窗口关闭即退出。Chromium 的临时 profile 位于系统临时目录 `mytracer-material-shell-*`，正常退出尝试清理；系统占用文件或异常退出可能留下缓存。不使用已安装 MyTracer 的 profile，不保存实验选项。

## 材质与强度的准确含义

- 使用 Electron 原生 `BrowserWindow.setBackgroundMaterial('mica' | 'acrylic')`。官方支持范围为 **Windows 11 22H2 / build 22621 及以上**；Windows 10、早期 Windows 11 和其他系统使用实色回退。API 抛错也回退为不透明奶白。
- Mica 是面向长期窗口的系统背景，通常体现桌面壁纸/系统主题，不等于透视后方应用。Acrylic 是面向临时窗口的背景模糊材质；系统决定实际效果。这是外观对照实验，不是推荐把 Acrylic 用作正式主窗口。
- 三档分别把**外壳奶白背景色 alpha**设为 **88% / 68% / 42%**；越明显覆盖越薄。没有 `setOpacity`、元素整体 opacity、文字淡化或 CSS 模拟模糊。正文与卡片始终为不透明 `#faf9f5`。
- 沿用主窗口 1120×760、最小 820×600、hidden 标题栏、42px 原生 caption overlay、原生最小化/最大化/关闭按钮和拖拽区。原生按钮背景使用 `#00000000` 透明 overlay，让下方同一外壳色层连续穿过按钮区；图标保持深色。每次模式/材质/强度切换及 focus/blur 都重新同步 overlay，保留原生悬停、按压和关闭按钮反馈。
- 保留 sandbox、contextIsolation、webSecurity，Renderer 不获得 Node 或通用 IPC。只暴露读取状态/应用枚举设置两个 API，Main 校验发送窗口、顶层 frame、文件 URL 和设置值。所有权限请求、远程请求、弹窗和页面跳转均拒绝。
- “requested from Windows”仅表示调用已提交，**不能证明 DWM 实际显示了材质**。节能、透明效果设置、远程桌面、显卡、失焦/高对比度模式都可能影响结果。无效果时可随时切回实色。

参考：[Electron BrowserWindow 原生背景 API](https://www.electronjs.org/docs/latest/api/browser-window#winsetbackgroundmaterialmaterial-windows)、[Microsoft Mica](https://learn.microsoft.com/en-us/windows/apps/design/style/mica)、[Microsoft Acrylic](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic)。项目安装的 Electron 43.3.0 类型定义也包含上述 API；文档支持不等于本机外观已验证。

## Windows 人工对照（待验证）

1. 在 Windows 11 22H2+ 开启「透明效果」，先用亮/暗/彩色壁纸各观察一次。默认轻微可能非常细微。
2. 实色与环境材质交替，对照侧栏、标题栏空白区、右/下外缘；再比较 Mica / Acrylic 的三档。
3. 把另一个彩色窗口移到后方，移动本窗口并切换焦点。不要用 Mica 是否透出后方窗口判断成功。
4. 确认正文与卡片颜色/文字对比度完全不变；检查拖动、双击标题栏、最小化、最大化/还原、关闭，以及 100% / 150% 缩放下按钮不被遮挡。
5. 关闭透明效果/打开节能后重试；在 Windows 10 或早期 Windows 11 检查实色回退与状态提示。记录 OS build、材质、强度、窗口焦点及截图。

## 已执行验证与局限

Linux cloud、Node 24.19.0：7 个 Node 测试通过，覆盖系统版本门槛、无支持时不调用 API、原生 API 失败回退、两种材质与三档覆盖、实色复位和非法 IPC 参数拒绝；新增透明原生 overlay 在模式/材质/强度/焦点/回退变化中的同步断言。浏览器 smoke 使用模拟的窄桥 API，检查六种组合、实色来回切换、不透明正文/卡片、最小宽度、实色外壳/正文色差和拖拽 CSS；不是 Electron 或 Windows DWM 测试。

```powershell
node --test experiments/material-shell/material.test.cjs
# 已有仓库 Playwright 依赖和 Chromium 时，可选浏览器 UI smoke：
node experiments/material-shell/smoke.mjs
```

浏览器 smoke 可通过 `SHELL_SMOKE_CHROMIUM` 指定已安装 Chromium 路径；本次 Linux 使用 `/usr/bin/chromium`。它在随机 loopback 端口临时提供静态文件，仅用于测试。Linux 管理策略阻止浏览器直接打开 file URL，所以浏览器 smoke 使用 HTTP；正式实验仍只加载本地 file URL。

本机 Electron 直接启动在 SUID sandbox helper 配置检查处失败，且没有显示服务器；没有降低应用 sandbox 设置。因此**原生 Electron 窗口启动、真实 preload/IPC、Windows 材质和原生 caption 行为尚未执行验证**。上述 Windows 人工步骤是剩余验收。未执行生产应用完整 verify、打包或发布；本分支仅含此实验目录。

## 实机反馈修正

实色外壳改为浅灰绿 `#f2f4ee`，正文/卡片维持奶白 `#faf9f5`，保留克制的层次；材质模式也使用相同外壳 RGB 与原有三档 alpha。修正前按钮 overlay 固定为不透明奶白，导致它不随背景材质变化。修正后构造窗口和每次更新均使用透明原生 overlay，无新增自绘按钮或权限。

[Electron 官方标题栏文档](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar)明确支持透明 overlay 色值。透明背景应暴露下方色层，但实际 Windows 合成、失焦及悬停效果仍须实机复测；hover/pressed/关闭红色反馈属于原生控件状态，不强制染成静态壳色。若平台仍绘制不透明按钮底板，这属于待诊断的 Electron/Windows 合成行为，不能以 Linux mock 测试声称已经修好实机像素。

本次用户截图的 Library 下载在当前执行环境失败（`download failed`），本地文件未生成；没有完成用户截图像素查看。修正依据为用户描述及代码中两个确定原因（壳/正文同色、固定不透明按钮底色），而不是声称已核对截图。

# Windows 原生安装向导

保留 `io.mytracer.desktop`、原 NSIS 安装身份和图标，以及 `oneClick: false`、`perMachine: false`、可选安装目录和默认提权规则。客户端仍调用 `updater.install(false, true)`；数据库关闭、草稿检查和退出协调器不变。

## 可见更新与范围判断

`installer.nsh` 使用 electron-builder **26.15.3** 的 assisted installer hooks；electron-updater **6.8.10** 已传入 `--updated`，旧客户端无需额外参数即可使用新版安装器的逻辑。`--updated` 是流程标记，不是身份验证；手动添加它也会触发同样判断。

只有同时满足以下条件才跳过范围页和目录页：

- 有 `--updated`，且无显式 `/D=` 目录覆盖或 `--allusers`／`--currentuser` 范围覆盖；
- HKCU 或 HKLM 恰有一类安装；另一类的产品与卸载 `InstallLocation` 均为空；
- 所选范围的产品键和卸载键 `InstallLocation` 完全相同、非空，且该目录的 `MyTracer.exe` 存在。

读取上游已选择的 x64 注册表视图，不写注册表来推断范围。缺失、陈旧、两类同时存在或路径不一致时保留原生范围和目录页，由用户核实。普通双击 EXE 没有更新标记，保留通常选择流程。欢迎页、进度、完成页始终使用可见原生向导；没有引入静默参数。

`customInstallMode` 只设置上游支持的 force 标记。机器范围仍由上游 `UAC_RunElevated` 提权；取消该提示会结束本次更新，不改成当前用户安装。上游的 elevated inner 分支在该 hook **之前**，因此 `customInit` 对 inner instance 仅核实机器记录以保留机器原路径（管理员的 HKCU 可能属于另一个账户）。如果提权后机器记录缺失、不一致或程序文件不存在，显示错误并停止本次更新，不猜测新的机器路径。没有禁用提权或新增权限。

`customWelcomePage` 在 `common.nsh` 定义宏之后、许可和目录页展开之前替换 `skipPageIfUpdated`，让不明确的更新也能看见目录页。`customPageAfterChangeDir` 在上游声明 `instFilesPre` 之后为进度页设置 pre 回调，明确更新直接恢复原路径，避免上游给不含 MyTracer 名字的既有自定义目录追加子目录；其他情况继续调用上游回调。

限制：不能从更新标记判断调用者真实进程，也不解决注册表被并发修改、恶意记录、跨账户启动或上游显式 `--allusers`/`--currentuser` 参数的语义。自动识别有意保守，不尝试从默认目录猜测范围。手动选择机器范围后的 elevated inner instance 沿用上游机器选择行为。升级 builder/updater 时必须重新检查 hook 顺序和提权分支。

## 品牌与中文

侧栏源为 `resources/brand/installer-sidebar.svg`，背景绿 `#214C3D`、前景奶白 `#F5F1E7`。独立 sprout 在上，原 C1 字标等比缩放并保持横向阅读，两者竖向排列；没有重绘字形，原拱形 T 保留。两个定稿完整 SVG 逐字节取自 PR116 的 `41c175f5e91c5fde2887499e32c30b158ec5f0b4`，该 PR 在本任务开始时尚未合并。组合 SVG 仅增加外层布局变换。

安装及卸载欢迎／完成页共用一个 492 × 942、24-bit BMP（原生 164 × 314 比例的 3 倍资源）。中间页和所有图标保留原生行为。简体中文采用系统 Microsoft YaHei UI 9pt 和简短完成文案；其他语言保留上游内容。没有定制按钮、UAC 或 SmartScreen。

重新导出到临时目录：`python tools/installer/export.py <temporary-directory>`，需要本机 Inkscape 和 Python Pillow，不增加项目运行依赖。比较输出后再替换 BMP，不提交 PNG 预览或比较板。

## 验证与人工验收

`node tools/installer/verify.mjs` 编译生产用的 NSIS 决策宏，在 Windows 直接执行无注册表写入的临时 EXE，覆盖普通安装、两类更新、冲突、缺失、路径不一致、显式目录覆盖和提权后重新核实机器记录，共 17 个场景。非 Windows 主机仅编译，明确报告未执行。这个 fixture 不模拟 UAC 成功，也不等同于真实安装测试。

专用 `Installer validation` Windows CI 执行上述 fixture，再 `npm run package` 编译真实安装器及卸载器，不发布。原 `CI Gate` 继续执行完整应用验证。

尚需在隔离 Windows 虚拟机人工验收（不是已通过的自动化结果）：

1. 新安装及普通 EXE 覆盖安装，用户／所有用户选择和自选路径保持可用。
2. 各自只安装用户版／机器版，再从旧客户端更新；范围页和目录页跳过，原路径／注册表范围保持不变，进度及完成页可见。使用不含 MyTracer 的既有目录单独验证。
3. HKCU/HKLM 都存在、缺失记录、卸载记录不一致或 EXE 缺失时，范围和目录页可见；核实后才能继续。
4. 机器更新拒绝 UAC，确认未在用户范围安装、旧目录和数据未改变；再确认正常提权和跨管理员凭据的重新进入行为。
5. 简体中文 Windows 100%／125%／150% DPI 检查欢迎、范围、目录、进度、完成及卸载页面：中文、底部按钮无截断，sprout 和字标边缘完整；检查完成页启动和取消操作。
6. 更新后版本、原记录、数据库持久化、草稿保护仍正确。

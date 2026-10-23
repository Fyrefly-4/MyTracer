# MyTracer

MyTracer 是一款本地优先的 Windows 个人行动与成长记录应用。

把想做的事拆成小行动，留下做过的记录，也给下一次回来留一条路。

[从这里开始](#从一件小事开始) · [看看它](#日常的三个片段) · [下载与开发](#准备好了再开始) · [文档](docs/README.md)

Windows x64

## 从一件小事开始

### 01 把“想做”变成小行动

不必一开始就安排得很完整。比如“让房间舒服一点”，先从整理一个抽屉开始。

### 02 给做过的事留一笔

照料了一盆植物，或出门散了一会儿步。把行动与感受记下来，日后回看时，有迹可循。

### 03 有空的时候，再回来

中断不需要变成负担。看看已有的记录，再选一件此刻愿意做的小事。

## 日常的三个片段

### 首页概览

![首页概览](docs/resources/readme/home.svg)

看看最近的记录，找到想继续的一件小事。

### 行动记录

![行动记录](docs/resources/readme/record.svg)

留下实际投入、收获与困惑，不必等全部完成。

### 复盘与下一步

![复盘与下一步](docs/resources/readme/reflect.svg)

回顾已有的积累，再想想接下来愿意尝试什么。

## 不是把每一天都填满

- **行动可以很小。** 记录的意义，不只在于完成了多少。
- **休息也有位置。** 日常安排里可以有行动，也可以有休息。
- **记录是给自己的。** 不需要把生活变成一场持续打分的比赛。

## 准备好了，再开始

[下载安装包 →](https://github.com/Fyrefly-4/MyTracer/releases)

适用于 Windows x64；安装说明与版本以发布页为准。当前安装包未签名，Windows 可能显示未知发布者或保护提示，请核对来源，不要关闭系统安全保护。

记录可以导出留存；导出不提供自动导入或一键恢复。

内置更新由你主动检查、确认下载和确认重启安装；当前仍需本机配置有效的 `MYTRACER_UPDATE_TOKEN`，仓库公开不会自动启用匿名更新。配置与故障处理见[更新说明](docs/maintenance/UPDATE.md)。

## 本地运行

在 Windows 上准备符合 [package.json](package.json) `engines` 的 Node.js 和 npm，在仓库根目录运行：

```powershell
npm.cmd ci
npm.cmd exec -- install-electron --no
npm.cmd run dev
```

首次安装依赖与下载 Electron 需要网络。应用使用 Electron、React、TypeScript、Vite 和 SQLite；构建、验证与打包见[维护入口](docs/MAINTENANCE.md)。

想反馈问题或参与修改？欢迎阅读[贡献指南](CONTRIBUTING.md)。更多产品与架构资料见[文档导航](docs/README.md)。

## 许可

项目采用 [MIT License](LICENSE)。第三方依赖与资源仍适用各自的许可和署名要求。

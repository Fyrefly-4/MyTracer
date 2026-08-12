# T801 S1 Windows package smoke 修复合同

> 合同状态：**候选，等待项目所有者批准；不构成实现授权**
>
> 缺陷基线：`dev@623007dd4269df02771f6a526db269de1fe95a03`；证据 `EV-G3-S1-001`

## 1. 目标与依据

- **Task ID**：T801
- **目标**：让 Windows package smoke 按 S1 当前窄 Preload API 验证 unpacked 与隔离 NSIS 安装态，消除旧 S0 `shell`-only 断言漂移。
- **依据**：G3/S1 发布门禁、GW-008/GW-010；不新增或改变任何 FR、AC、D、ED 产品语义。
- **已知失败**：`tests/e2e/windows-package-smoke.e2e.test.ts:42` 期望 `['shell']`，而 S1 已批准并实现 `shell/goals/actions/today/records/progress`。

## 2. 允许范围

- 仅修改 `tests/e2e/windows-package-smoke.e2e.test.ts`，使 API 白名单与 `tests/e2e/shell.e2e.test.ts` 及当前 `MyTracerApi` 一致。
- 可在同一测试中验证 API 对象冻结、AI `not-configured`、隔离 `userData`、schemaVersion/foreign keys、unpacked 与 NSIS 安装/启动/关闭/卸载。
- 若为避免再次漂移确需抽取纯测试 helper，必须先报告精确新增文件并获得项目所有者批准。

## 3. 非范围与不变量

- 不修改生产代码、业务行为、冻结需求、schema/migration、依赖、lockfile、打包配置或 S2～S7。
- 不把 `ipcRenderer`、任意 channel、SQL、数据库路径、文件系统或 Electron 对象暴露给 Renderer。
- 测试必须使用唯一临时根与隔离 `userData`，不得访问真实用户数据；失败时仍清理临时安装并报告残留。
- 不删除或覆盖 `EV-G3-S1-001`；后续成功证据必须显式 supersede 它。

## 4. 完成条件

1. 修复测试在 Windows x64 上依次通过 unpacked 与隔离 NSIS 安装态启动、关闭和卸载。
2. `npm.cmd run verify`、`npm.cmd run package`、`npm.cmd run test:package-smoke` 在同一修复 revision 全部通过。
3. 独立 review 确认测试没有弱化 API、安全、数据隔离或安装态断言。
4. 修复 PR 合入 `dev` 后，必须固定新的最终 `dev` revision，重新执行完整 S1 聚合验收；修复分支成功不得直接宣称 G3/S1 通过。
5. 新最终 revision 的 hosted Windows gate、产物 SHA-256、AC-01 自动化、package smoke 和人工验收状态写入新证据；随后才可归档 T011～T014 并创建 `dev → main` Draft 里程碑 PR。

## 5. 权限

- [ ] 项目所有者批准本合同。
- [ ] 项目所有者明确启动 T801。
- [ ] 本地分支、提交、push 和到 `dev` 的 Draft PR 获得授权。
- [ ] Ready、merge、`dev → main`、tag 和 release 仍需分别授权。

发现需要修改生产代码、依赖、配置、schema、冻结语义或扩大文件范围时，立即停止并报告。

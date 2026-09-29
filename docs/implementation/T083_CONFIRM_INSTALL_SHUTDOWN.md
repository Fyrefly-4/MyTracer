# T083 — 确认安装与安全退出协调

> 合同状态：approved，2026-09-29。项目所有者批准本合同范围、应用版本 `0.1.3`、本机当前 Windows 账户验证及 §11 权限，明确本任务不创建独立 worktree；本轮仅落实合同并提交，不开始产品开发。任务激活状态以 [任务索引](TASK_INDEX_V0.1.md)为准。T082 已由 PR #58 集成到 `dev@cf3b2b4c00b6757218295c2672d23cf19f1ee526`；T082 的真实私有源、最终发布包及安装版人工体验缺口仍归 T084，不在本合同中冒充通过。

## 1. 任务信息

- **Task ID / Title**：T083 / 确认安装与安全退出协调。
- **Slice / Plan item**：S8-C；[实施计划](../architecture/IMPLEMENTATION_PLAN_V0.1.md) §13、[S8 设计](../architecture/S8_UPDATE_MAINTENANCE_DESIGN.md) §3～7。
- **Status**：以任务索引为准；本轮仅完成合同与 Git 准备，不开始产品实现。
- **拟定任务基线**：`dev@cf3b2b4c00b6757218295c2672d23cf19f1ee526`（本合同起草时本地 `dev` 与本地远端跟踪引用 `origin/dev` 相同，未实时查询远端）；启动与集成前重新核对最新授权 `dev`，不能把此 SHA 当成永久有效基线。
- **任务分支**：`task/T083-confirm-install-shutdown`，已在当前 checkout 从上述 `dev` 建立；本任务不创建独立 worktree。
- **任务类型**：`implementation`；V2 显式权限流程，不声明 Automation Profile。

## 2. 目标结果

用户对当前已下载且再次校验的稳定版候选明确选择“重启安装”后，应用先检查所有未保存输入和未确认 AI 建议；有任何未处理内容时阻止安装并引导用户返回。没有阻断项时，Main 阻止新业务写入，等待已开始的写入、导出和配置保存结束，取消未完成 AI 请求，安全关闭数据库，然后只对同一候选调用安装器。用户可以取消准备或选择稍后，继续使用旧版。新版是否安装成功仅由新版实际启动和健康检查确认。

T083 交付受控源与隔离 Windows 环境中的安装协调能力及分层证据。T084 才汇总真实私有 Release、正式来源包、发布 provenance、完整应用内跨版本连续 E2E 和 owner 阶段人工验收。

## 3. 依据

- **S8 内部验收项**：U-04；U-01 的升级后数据保留与 U-05 的候选/产物追溯仅作为本任务安全边界，不由 T083 单独宣称阶段通过。这些 U 项来自 owner 已批准的 S8 首期范围，并非新增冻结 FR。
- **FR / AC**：FR-D01～D05、AC-07；安装前后保持数据可读、可改、可导出，AI 失败不阻断核心能力。AC-07 的最终跨版本验收归 T084。
- **D**：D-008～010、D-014、D-015、D-106、D-109、D-111 保持原义；不借退出流程改变记录、日期、导出或 AI 确认语义。
- **ED / GW**：ED-010、ED-014、ED-017～019；GW-001～010 中适用的分支、评审、CI、证据和集成门禁。
- **直接设计**：S8 §3.1～3.3、§4 C、§5～7；[架构](../architecture/ARCHITECTURE_V0.1.md)、[测试策略](../architecture/TEST_STRATEGY_V0.1.md)、[GitHub 工作流](GITHUB_WORKFLOW_V0.1.md)。

### 3.1 References

```yaml
references:
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
    - docs/REQUIREMENTS_CHANGE_POLICY.md
  engineering_decisions:
    - docs/architecture/ENGINEERING_DECISIONS_V0.1.md
    - docs/implementation/GITHUB_WORKFLOW_V0.1.md
  stage_design:
    - file: docs/architecture/S8_UPDATE_MAINTENANCE_DESIGN.md
      sections: ['3.1', '3.2', '3.3', '4', '5', '6', '7']
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
```

## 4. 开始条件与依赖

- [x] Owner 批准本合同范围、§11 权限、应用版本 `0.1.3` 及本机当前 Windows 账户验证；本轮只提交合同，不开始开发。任务激活状态以任务索引为准；版本批准不构成发布授权。
- [x] T082 在本合同起草时已由 PR #58 进入本地 `dev@cf3b2b4c00b6757218295c2672d23cf19f1ee526`，本地 `origin/dev` 指向同一 revision，任务索引标为 `done`；其 T084 延后项不记作 T083 已完成。
- [ ] 启动前核对最新授权 `dev`、任务分支/worktree、未提交改动、T082 证据和当前依赖锁；确认无重叠开发。候选集成前再次执行 Integration Freshness Gate。
- [ ] 核对 T082 的同一已校验下载对象能否安全保留安装句柄或重新验证缓存；若 `electron-updater@6.8.10` 无法在已批准来源与 unsigned NSIS 策略下执行显式安装，先按升级提案处理，不绕过完整性或换用任意路径执行程序。
- [x] Owner 明确批准 T083 在本机当前 Windows 账户验证，不使用一次性 VM 或独立测试账户。任何实装/卸载前必须只读预检当前进程、已有安装及注册项，使用唯一临时数据/安装/缓存根和合成数据；不读取、修改或清理默认真实 MyTracer 数据、凭据或既有安装。无法隔离既有安装或证明清理目标属于本次测试时，停止受影响验证。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T082]
    blocks: [T084]
    can_parallel: []
    prefer_after: [T082]
    conflicts_with: [T082, T084]
  revisions:
    required_dev_base: dev@cf3b2b4c00b6757218295c2672d23cf19f1ee526
  shared_surfaces:
    - src/application/update-service.ts
    - src/application/ports/update.ts
    - src/infrastructure/update/
    - src/main/
    - src/contracts/updates.ts
    - src/contracts/shell.ts
    - src/preload/index.ts
    - src/renderer/src/
    - tests/e2e/
  external:
    - owner-approved current Windows account NSIS install/upgrade verification with preflight, synthetic data and controlled source
```

`required_dev_base` 是起草时的最低已集成 T082 revision；实际开工与候选验证必须使用当时最新授权 `dev`。T083 与 T082/T084 共享更新服务、Main、IPC、Preload、Renderer 和连续安装测试，按 S8 §4 串行集成。

### 4.2 Machine-readable metadata

[T083 sidecar](metadata/T083.json) 只用于结构校验；合同、任务索引和实际 Evidence 仍是范围、状态与验收依据。不声明执行 Profile。

## 5. 允许修改范围

- `package.json`、`package-lock.json`：同步 owner 已批准的根应用版本 `0.1.3`；不改依赖版本或脚本，除非另获批准加入专属测试入口。
- `src/application/update-service.ts`、`src/application/ports/update.ts`、`src/infrastructure/update/`：对已下载候选保留或重新验证安装能力，增加确认、准备、取消及失败状态；不得把安装路径、token 或任意执行能力传给 Renderer。
- `src/main/index.ts`、`src/main/updates-ipc.ts`、`src/main/*-ipc.ts` 及必要的 Main 退出协调模块：全局写入门禁、在途操作排空、配置保存与 AI 取消、单实例与安装互斥、失败恢复。仅修改确实承载受影响命令的 IPC 文件。
- `src/contracts/updates.ts`、`src/contracts/shell.ts`、`src/preload/index.ts`：具体、窄化、可验证的安装准备/确认/取消与草稿状态 API；不暴露通用 IPC。
- `src/renderer/src/App.tsx`、`src/renderer/src/app/`、`src/renderer/src/features/update/` 及确有未保存输入的现有表单/会话组件：集中收集阻断状态、安装确认和返回处理入口。需覆盖 Goal、Action、Routine、Review、记录、数据管理及 AI 建议，不能只覆盖 Today。
- `tests/unit/`、`tests/integration/`、`tests/e2e/`、`tests/support/`：对应状态机、IPC/协调、Renderer 与隔离 Windows 安装测试；只使用临时根、合成数据、fake AI、受控更新源。
- 本合同、`metadata/T083.json` 及经 owner 后续批准的最小任务证据、索引、说明文档收口；合同准备阶段仅修改合同、sidecar 和索引链接。

## 6. 明确非范围

- 不实施 T084 的 GitHub Actions 候选/发布 workflow、真实私有 Release、正式源写入、tag、签名或阶段总验收。
- 不新增依赖，不升级 Electron/builder/updater，不改 schemaVersion=3、migration、安装身份、默认 `userData` 规则或导出格式。
- 不做自动检查/下载/安装、普通退出静默安装、强制更新、定时提醒、热替换、降级或跨重启草稿持久化。
- 不增加通用任务调度器、通用文件执行 API、Renderer 文件/凭据/Node 能力或 AI Provider 权限。
- 不访问、覆盖、卸载或清理真实用户安装、注册项、数据库和凭据；T083 的当前账户验证权限仅来自本合同，须先完成本任务独立预检与路径隔离。

## 7. 必须保持的不变量与局部风险

1. 下载或普通退出不构成安装授权。确认必须绑定当前 operationId、严格更高的候选版本及再次校验的包；候选变化、取消、超时、缓存损坏或迟到回调都使旧确认失效。同一时刻仅一个更新操作。
2. 安装准备必须取得 Renderer 对所有未保存表单、会话草稿和未确认 AI 建议的完整回答；Renderer 无响应或销毁视为阻断。任何阻断只返回处理提示，不自动保存/丢弃，也不触发安装。
3. Main 在准备状态拒绝新业务写命令，等待已进入的写入、导出、配置保存完成；取消 AI 请求并忽略迟到结果。UI 按钮禁用不代替 Main 门禁。等待失败/超时必须解除门禁并保持旧版可用；若连接已关闭，不呈现仍可操作的界面。
4. 只有上述门禁和资源关闭完成后才触发明确候选的安装器；安装失败不得声称成功或制造替代空库。成功须由新版启动、数据库重开与健康检查证明。
5. 单实例/安装互斥须同时保护第二进程写库和运行中替换程序；人工运行安装器时的结果也须在隔离环境验证。`appId`、数据目录、业务事实、LocalDate、历史和导出范围保持不变。
6. Renderer/Preload/IPC 保持 ED-019 边界；token、安装路径、包内容、日志与 AI key 不进入 Renderer DTO 或证据。测试不接触真实账户数据。

**局部风险**：目前 T082 的 `GithubUpdatePort.download()` 在下载结束后释放 `NsisUpdater` 局部对象，只返回 `void`；T083 必须证明同一候选包的安装句柄与重新校验关系，不能从 `downloaded` 文案推断安装安全。现有 Main `before-quit` 同步关闭 SQLite，尚无全局安装准备与在途操作协调；合同要求覆盖所有写入入口、导出与配置保存，并测试竞争时序。

## 8. 交付物

- 用户可见的“稍后/取消准备/确认重启安装”流程，完整未保存内容阻断及返回处理入口。
- 专用安装状态与 Main 退出协调、单实例保护、窄 IPC/Preload 接口、脱敏失败状态和恢复路径。
- 按 owner 已批准的版本将应用更新为 `0.1.3`，形成可追溯且与 T082 `0.1.2` 不同的 Windows x64 NSIS 测试包；构建显式禁止发布。
- 状态转移、候选失效、草稿枚举、写入/导出/配置排空、AI 迟到结果、第二实例、超时/失败解除的 Unit/Integration/Renderer E2E；隔离 Windows 环境中的受控源安装连续验证。
- 精确命令、环境、源与目标包版本/hash、source revision、结果与限制绑定的 evidence；最终文档收口仍走 owner gate。

## 9. 可判定验收条件

1. 仅对当前 `downloaded` 且再次校验的同一候选允许进入安装准备。错误 operationId、版本、变更候选、损坏缓存、重复确认、普通退出和“稍后”均不得调用安装器。
2. Goal、Action、Routine、Review、Action/Routine 记录、数据管理表单及 AI 候选的每一种未保存状态均阻断安装，原输入保留并可返回处理；Renderer 超时/崩溃也阻断。处理完后必须重新确认。
3. 准备期间新的业务写 IPC 被 Main 拒绝；已开始的写入、导出、配置保存完成或得到明确失败后才可关闭资源。未完成 AI 请求取消且迟到结果不写入。取消/超时/失败后解除门禁，旧版可继续正常读写或明确要求重启。
4. Owner 批准的当前账户 Windows 测试在预检和临时根隔离后证明第二实例不能并发写库或干扰安装，运行中的手动安装不会静默破坏数据；安装调用仅发生在排空与关闭后。失败/中断保留原数据，不宣称升级成功。
5. 受控源的已安装 `0.1.2`→更高版本连续测试使用真实不同版本包：手动检查/下载、草稿阻断、处理草稿、显式安装、新版启动、读取旧记录、导出比对、新增记录并重开。该项是 T083 必须通过的验收；若环境无法隔离或安装能力受限，停止受影响验收并提出升级提案，不得自动移交 T084 或用 fake adapter 结果替代。
6. 新接口有输入和 sender/origin 校验；Renderer 不获得凭据、路径、任意 channel 或安装执行权；当前账户测试的合成数据、安装注册项和缓存须与既有真实用户资产隔离，且任何清理仅限已确认属于本次测试的目标。
7. 定向验证、受影响回归、`verify`、完整 diff 和独立 review 无未处理 material finding；early、candidate、final-head CI 分别绑定对应 PR head/test-merge。文档和证据只陈述已执行结果。
8. **MANUAL / 阶段交接**：owner 对真实私有源、unsigned Windows 提示、正式来源包、失败修复和完整跨版本体验的人工接受由 T084 记录；T083 不代签或宣称 S8 已通过。

## 10. 验证计划

### 10.1 合同准备

仅运行 `npm.cmd run governance:metadata:check`、文档格式检查及 `git diff --check`；不运行产品测试、不生成行为 evidence。

### 10.2 实施后定向与回归

```powershell
npm.cmd run governance:metadata:check
npm.cmd run test:unit -- tests/unit/update-service.test.ts
npm.cmd run test:unit -- tests/unit/update-install-service.test.ts
npm.cmd run test:integration -- tests/integration/updates-ipc.test.ts
npm.cmd run test:integration -- tests/integration/update-install-ipc.test.ts
npm.cmd run test:e2e:run -- tests/e2e/update-check-download.e2e.test.ts
npm.cmd run test:e2e:run -- tests/e2e/update-install-shutdown.e2e.test.ts
npm.cmd run test:e2e:run -- tests/e2e/windows-update-install.e2e.test.ts
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify
npm.cmd run build
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

上述三个 `update-install-*` / `windows-update-install` 测试文件是本合同拟建入口，起草时尚不存在，不能写成已执行；若实现需要拆分其他测试文件，须在候选提交前列出实际精确命令。`verify` 覆盖常规 build/Unit/Integration/Electron E2E，但不自动证明真实 NSIS 安装、私有源或 owner 人工体验。

证据捕获使用 `node tools/evidence/capture-command.mjs --task T083 --gate <gate> --base-revision <实际 SHA> --output .tmp/evidence -- <明确 argv>`；先通过 metadata 校验，保留失败 artifact 与真实退出码。JSON 不收集 stdout/stderr、绝对路径、token、用户正文或数据库。安装测试另记录包/元数据 hash、unsigned、Windows runner、隔离范围及实际结果。区分 task delivery、dev integration、stage final integration revision。

### 10.3 人工及安装步骤

1. 在 owner 已批准的本机当前 Windows 账户只读预检现存进程、安装注册项、安装根和 `userData`；仅在确认不会触及既有安装与默认真实数据后创建唯一临时根、合成记录和 fake AI 配置，固定 A/B 包 source、版本和 hash。无法隔离时停止安装步骤。
2. 使用受控源从已安装 A 手动下载 B；分别保留未保存 Goal/Action/Routine/Review/记录/AI 输入尝试安装，确认阻断与输入保留；处理后重新确认。
3. 模拟在途写入、导出、配置保存、第二实例、安装取消/失败，记录 Main 拒新写、排空和恢复结果；再成功安装，验证新版启动、数据/导出守恒、新增写入与重开。人工直接运行安装器时单独核对运行中行为。
4. 真实私有 Release、正式包与 owner 最终人工体验留给 T084，不在 T083 的隔离测试中宣称通过。

### 10.4 验证环境

- OS：owner 已批准的本机当前 Windows x64 账户；实装/卸载前先预检进程、安装注册项与绝对目标路径。云端 CI 的合成测试仍可执行，但不替代本任务获批的本机安装验证。
- Node/npm/Electron/updater/builder：执行时从 lockfile 与环境记录实际版本；起草时分别为 Node 24.18.0、npm 11.16.0、Electron 43.3.0、electron-updater 6.8.10、electron-builder 26.15.3。
- 数据：唯一临时 `userData`、安装和缓存根、合成记录、fake clock/AI；不得访问默认真实数据或导出真实凭据。
- Source revision、PR/head、包/元数据 hash、测试源及人工结果：执行后填写，不预填通过。

## 11. Git 与 GitHub 权限

Owner 已批准 T083 在当前 checkout 建任务分支、创建本地提交、普通 push、创建/更新指向 `dev` 的 Draft PR，并在审查与 CI 门禁通过后标记 Ready；本任务不创建独立 worktree。本轮只执行本地分支与合同提交，不推送、不建 PR、不开始产品开发。merge、main、tag、release 和非任务外部写入仍不在授权内。

- [x] 在当前 checkout 从 `dev` 建本地任务分支；不创建 worktree（已执行）。
- [x] 创建本地提交。
- [x] 普通推送任务分支（已获授权，本轮不执行）。
- [x] 创建/更新目标为 `dev` 的 Draft PR（已获授权，本轮不执行）。
- [x] 在审查与 CI 门禁通过后将 Draft 标记为 Ready（已获授权，本轮不执行）。
- [x] Agent 不合并到 `dev`，不推进 `main`，不创建 tag 或 Release。

```yaml
permissions:
  local_write: true
  create_worktree: false
  create_task_branch: true
  create_commit: true
  push_task_branch: true
  create_or_update_draft_pr: true
  mark_ready: true
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: false
```

`external_write: false` 仍禁止非任务外部写入；已逐项批准的 push/Draft PR 按对应字段执行。文档收口、merge、main、tag、release 保持各自 owner gate；Ready 仅能在本合同所述审查与 CI 门禁通过后执行，不得从阶段设计的发布流程推断本任务有发布权限。

## 12. 依赖、网络、数据与集成

- **应用版本**：owner 已批准从 `0.1.2` 升为 `0.1.3`；不得替换同版已发布资产。受控连续安装测试的更高目标版本与正式 T084 版本分别固定并记录，不以 UI 文案模拟。
- **依赖**：仅使用已锁定的 `electron-updater@6.8.10` 等现有依赖；新增/升级依赖权限为无。发现兼容性或 unsigned 安装阻塞时提交升级提案。
- **网络与外部写入**：自动化仅 fake/受控本地源；不创建真实 Release、Secrets、Environment 或发布 workflow，不向正式源上传。GitHub 任务分支/PR 写入待 §11 批准。
- **AI / 数据**：fake Provider、合成数据和临时根；不改 AI 权限、schema、导出契约或用户数据库。任何破坏性操作均未授权。

### 12.1 Integration

```yaml
integration:
  target_branch: dev
  base_revision: dev@cf3b2b4c00b6757218295c2672d23cf19f1ee526
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

实施时记录 `original_base_revision`、`latest_authorized_dev_revision`、`verified_against_revision`、`fresh`/`refreshed-and-passed`/`blocked` 状态及 `refresh_method`。若基线陈旧，使用可追溯普通 merge 刷新并重跑受影响回归，必要时重审；不 force-push。进入 `dev` 仍须 owner 对具体 PR 的单独批准。

## 13. 风险与停止条件

无法对已下载对象证明再次完整性校验及安装句柄关联；无法枚举全部未保存内容；Main 无法安全阻止新写/排空在途操作或失败后恢复；第二实例或本机当前账户的既有安装无法隔离；unsigned 包不能按已批准策略显式安装；需要未批准依赖、migration、正式源、凭据/AI 权限、安装身份或跨重启草稿持久化；证据不能绑定实际包与 revision——立即停止受影响实现，保存安全结果并用[升级提案模板](ESCALATION_PROPOSAL_TEMPLATE.md)提出具体决策。不得以跳过测试、安装成功文案或旧 CI 填补缺口。

## 14. 完成报告

报告实际改动文件、U-04 与 FR/AC/D/ED 边界、版本/候选/hash、定向及完整命令和环境、隔离安装及手动安装结果、source/PR/CI/freshness/集成 revision、自动与 owner 人工状态、残余风险和未验证项，以及有无需求冲突或范围变化。T083 完成不代表 T084 发布与 S8 阶段验收完成。

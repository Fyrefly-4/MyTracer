# T002：验证工具链与隔离测试基础任务合同

> 合同状态：`done`
> 创建日期：2026-08-08
> 决策批准依据：项目所有者于 2026-08-08 明确确认“上述通过，可开始执行开发”，批准本合同所列精确依赖、必要下载、任务分支/提交、push/Draft PR 和 GitHub Actions 执行权限
> 本合同是 T002 的活动执行边界；Ready、merge、branch protection、required-check 配置、tag/release 及未列入范围的操作仍不授权

## 1. 任务信息

- **Task ID**：T002
- **Title**：Establish the validation toolchain and isolated test foundations
- **Slice / Plan item**：S0 / E0-02
- **Status**：`done`
- **Base branch**：`dev`
- **Expected branch**：`task/T002-validation-toolchain`
- **当前已核验基线快照**：本地 `HEAD`、本地 `dev`、本地跟踪的 `origin/dev` 与远端实时 `refs/heads/dev` 均为 `e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`
- **执行前要求**：不得只依赖上述快照；启动 T002 前必须再次用只读远端查询核验最新授权的 `origin/dev`，并以其为任务分支基线

## 2. 前置状态核验

2026-08-08 的只读核验结果：

- T001 合同状态为 `done`，证据为 `EV-T001-001`；
- PR #1 `T001: Initialize secure Electron shell` 已于 `2026-08-08T03:09:11Z` 合并到 `dev`；
- PR #1 head 为 `8bd82dbe33a00cb4e272a4dfeced1d6d1d83a8da`，merge commit 为 `e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`；
- 远端实时 `refs/heads/dev` 为 `e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`，与本地 `dev` 一致；
- PR #1 没有 CI checks；这不是 T001 失败，但证明 T002 的 required gate 尚未建立；
- T001 已进入当前最新 `origin/dev`，因此不存在“绕过未合并 T001”的前置阻塞；
- T002 的依赖和执行/Git/GitHub 权限已由项目所有者批准，执行门已满足。

若执行前重新核验发现 T001 不在最新远端 `dev` 的祖先链中，或远端 `dev` 出现未解释的新 revision，T002 必须保持 `blocked`，不得从 T001 task branch、旧 `dev` 或本地临时提交绕过。

## 3. 目标结果

在不实现任何业务、SQLite 或真实 AI 能力的前提下，建立可重复、可离线执行且默认不破坏数据的验证入口：

- 固定只读 format check、lint、TypeScript typecheck、unit、integration、Electron E2E、build 和聚合 `verify` 命令；
- 以测试专用实现固定 `FakeClock`、`FakeAiProvider` 和独立临时测试数据根的最小契约；
- 在 Windows GitHub-hosted runner 上建立名称稳定、无 path filter、对相关 PR 始终报告明确状态的验证 job；
- 用最小自动化样例证明命令真实执行、Electron 空壳可通过隔离 `userData` 启动，且测试不读取、写入或清理真实用户数据；
- 同步 README、`AGENTS.md`、任务模板和 CI 的精确命令，保持单一事实；
- 记录本地与 hosted CI 的真实证据和限制。

T002 完成只证明验证工具链和测试隔离基础成立，不证明 T003 SQLite、T004 LocalDate/配置、任何业务 FR 或 AC-01～AC-07 已通过。

## 4. 需求与决定依据

- **FR**：无直接交付 FR；本任务只为后续 FR 提供验证基础。间接支持 FR-D05、FR-AI09 的可降级测试，但不得声称已实现或覆盖这两条 FR。
- **AC**：无直接 AC；Electron E2E 只验证 T001 空壳与测试隔离，不得描述为 AC-01～AC-07 通过。
- **D**：D-015、D-017；FakeClock 约定为后续 D-106 日期验证提供测试基础，但本任务不实现日期语义。
- **ED**：ED-004、ED-010、ED-011、ED-019；不修改其产品或运行语义。
- **GW**：GW-002、GW-004、GW-008～GW-010。
- **直接相关架构章节**：
  - `docs/architecture/ARCHITECTURE_V0.1.md` §4.4、§9、§10；
  - `docs/architecture/AI_BOUNDARY_V0.1.md` §8～§10；
  - `docs/architecture/DATA_DESIGN_V0.1.md` §11；
  - `docs/architecture/IMPLEMENTATION_PLAN_V0.1.md` §3 E0-02；
  - `docs/architecture/TEST_STRATEGY_V0.1.md` §2、§3、§9、§10；
  - `docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md` §1、§4～§6；
  - `docs/implementation/GITHUB_WORKFLOW_V0.1.md` GW-004、GW-008～GW-010。

## 5. 开始条件

- [x] T001 已完成并有 `EV-T001-001` 证据。
- [x] PR #1 已合并，且 T001 当前 merge commit 已核验为最新远端 `dev`。
- [x] T002 不包含 schema、migration 或破坏性数据操作。
- [x] 当前冻结需求、批准架构和 T002 范围没有已发现的冲突。
- [x] 本任务明确负责首次建立稳定验证命令，因此执行前不要求这些命令已经存在。
- [x] 项目所有者已批准第 6 节全部精确依赖版本。
- [x] 项目所有者已批准安装依赖及 npm/Electron 所需网络下载。
- [x] 项目所有者已批准创建本地 worktree/`task/T002-validation-toolchain` 分支。
- [x] 项目所有者已批准创建本地提交。
- [x] 项目所有者已批准 push 任务分支及由此触发 GitHub Actions。
- [x] 项目所有者已批准创建或更新到 `dev` 的 Draft PR。
- [x] 启动实现前已重新核验最新远端 `dev`、工作树和 worktree 状态，且没有重叠的用户修改。

上述开始条件已满足，T002 于 2026-08-08 转为 `active`，并在本地、独立复核和 hosted Windows CI 均通过后转为 `done`。

## 6. 已批准的精确依赖与工具选择

### 6.1 保持不变的已批准主机/工程版本

| 工具 | 精确版本 | T002 处理 |
|---|---:|---|
| Node.js | 24.18.0 | 不升级 |
| npm | 11.16.0 | 不升级 |
| TypeScript | 6.0.3 | 不升级 |
| Vite | 7.3.6 | 不升级 |
| Electron | 43.3.0 | 不升级 |

### 6.2 已批准新增的 `devDependencies`

以下版本是 2026-08-08 对 npm 官方注册表的只读调研结果，并已由项目所有者逐项批准：

| 包 | 精确版本 | 用途与选择依据 |
|---|---:|---|
| `eslint` | 10.8.1 | Flat config lint 核心；官方 engine 覆盖 Node `>=24` |
| `@eslint/js` | 10.0.1 | ESLint 官方 JavaScript recommended rules；peer 要求 ESLint `^10.0.0` |
| `typescript-eslint` | 8.66.0 | 单一 flat-config 入口；peer 同时覆盖 ESLint 10 和 TypeScript `>=4.8.4 <6.1.0`，与 TypeScript 6.0.3 相容 |
| `eslint-plugin-react-hooks` | 7.1.1 | 对现有 React hooks 执行官方 Hooks 规则；peer 覆盖 ESLint 10 |
| `eslint-plugin-react-refresh` | 0.5.3 | 约束 Vite React Fast Refresh 的组件导出边界；peer 覆盖 ESLint 9/10 |
| `globals` | 17.9.0 | 为 Main/Preload/Renderer/测试配置显式且分层的 Node、browser 和 test globals |
| `prettier` | 3.9.6 | 提供确定性的 `--check` 与显式 `--write`；精确锁定以避免格式随版本漂移 |
| `vitest` | 4.1.10 | 复用 Vite/TypeScript/ESM 管线执行 unit 和 integration；官方要求 Vite 6～8、Node 20/22/>=24，与当前基线相容 |
| `@playwright/test` | 1.62.1 | 在 Windows 上驱动真实 Electron Main/Renderer 空壳；其直接依赖固定为 `playwright` 1.62.1，Electron 自动化支持当前 Electron 43 |

精确版本约束：

- `package.json` 使用表中精确版本，不使用 `^`、`~`、`latest` 或远程 `npx`；
- `package-lock.json` 由已批准的 npm 11.16.0 更新并提交；
- 不新增 `jsdom`、`happy-dom`、Testing Library、coverage provider、`eslint-config-prettier`、任务编排器或其他 test/lint/format 包；没有当前合同证据需要它们；
- 不新增运行时 `dependencies`；
- 不新增 `better-sqlite3`、ORM、AI SDK、UI 组件库、表单库或任何业务依赖；
- 若安装解析出的 peer/engine 与本表不同或需要额外直接依赖，停止并请求重新批准，不自行替换版本。

### 6.3 提议的 GitHub Actions 运行依赖

| 项目 | 精确选择 | 理由 |
|---|---|---|
| Runner | `windows-2025` | 明确固定当前 GA Windows Server 2025 x64，而不是漂移的业务平台替代品 |
| Checkout | `actions/checkout@v6.0.2` | 当前 v6 精确 release；仅需 `contents: read` |
| Node setup | `actions/setup-node@v6.4.0` | 当前 v6 精确 release；显式安装 Node 24.18.0 |

约束：

- workflow 不使用第三方 Actions；
- `permissions` 只授予 `contents: read`；
- `setup-node` 使用 `node-version: 24.18.0`，不使用 `latest`、`node` 或浮动 major；
- 不向 workflow 提供真实 AI key、测试密钥、发布 token 或业务数据；
- 不配置 npm 自动缓存，优先证明干净 `npm ci`；
- 设置 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`，Electron E2E 只使用已批准的项目 Electron，不下载普通浏览器；
- workflow/action 版本变化需要再次批准；
- T002 只提交并运行 workflow，不修改 branch protection、ruleset 或 required-check 设置；远端 required 配置必须在稳定 check 实际出现后另行授权。

## 7. 固定命令契约

T002 获批实施时，`package.json` 应建立以下精确职责：

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --build --pretty false",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:e2e:run": "playwright test",
    "test:e2e": "npm run build && npm run test:e2e:run",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

现有 `dev`、`build` 和 `package` 命令保持不变。`verify` 必须只调用非破坏性检查；`format` 是显式人工修复命令，不得由 `verify` 或 CI 调用。`test:e2e` 先构建再验证，因此 `verify` 已包含 build gate。

`.prettierignore` 必须明确排除至少：`node_modules/`、`out/`、`dist/`、`release/`、`.tmp/`、`user/`、`package-lock.json`、`**/*.md`、生成日志和真实/临时数据。规范性 Markdown 不在 T002 中做批量格式化；命令同步只改明确列入范围的段落。

## 8. FakeClock 最小契约

`FakeClock` 是 `tests/support/` 下的测试专用、port-shaped fake，不在 T002 中建立生产 `ClockPort` 或业务 `LocalDate` 类型；生产端口与日期规则仍属于 T004。

最小行为：

- 构造时必须显式提供一个完整状态：`instant`、`localDate`、`timeZone`；禁止读取 `Date.now()`、系统当天或机器时区作为默认值；
- 提供与未来 `ClockPort` 形状对齐的只读方法：`nowInstant()`、`currentLocalDate()`、`currentTimeZone()`；T002 可暂用不透明字符串类型，不能提前固化 T004 的领域值对象；
- 提供单个原子 `setState({ instant, localDate, timeZone })` 测试控制入口，使三个值一起推进，避免瞬时值、日期和时区彼此矛盾；
- 相同初始状态和相同脚本必须产生相同结果；
- 不实现日期计算、DST 规则、周范围、跨午夜产品交互或历史重写；这些属于 T004 及后续业务切片；
- unit tests 至少证明无系统时钟依赖、读取确定、原子推进以及两个 fake 实例互不影响。

## 9. FakeAiProvider 最小契约

`FakeAiProvider` 是 `tests/support/` 下的测试专用泛型/port-shaped fake，不接入厂商 SDK、模型、网络、环境密钥、Repository 或任何写入口；正式 Provider 端口和产品错误分类仍属于 T062。

最小行为：

- 接受测试显式提供的 request/draft 类型和有序脚本；不自行组装上下文；
- 记录按调用顺序保存的 request 快照，供测试断言调用次数、顺序和数据最小化；
- 支持确定性脚本：success、timeout/pending、cancellation、authentication failure、parse failure、late response 和 fabricated-fact payload；
- timeout/pending 与 late response 使用测试控制的 deferred completion，不依赖真实网络等待或长时间 sleep；
- cancellation 后的迟到结果可被测试显式释放，但 fake 本身不得把结果写入任何状态；
- success 只返回测试提供的临时 draft；fake 不把文本解释为事实、不补造建议、不执行应用命令；
- 不读取或记录 API key，不读取 `.env`，不调用 `fetch`/socket/厂商 SDK，不访问文件系统或 SQLite；
- unit tests 至少覆盖每种脚本、调用记录、取消/迟到顺序和实例隔离。

T002 的 fake 只建立可测试控制面；FR-AI01～AI10、最小上下文选择、1～3 条建议验证、用户确认写入和降级业务仍由 T061～T063 实现和验收。

## 10. 临时测试数据根与隔离契约

每个 unit/integration/E2E 测试进程或测试 case 必须获得唯一的临时根，建议形状：

```text
<OS temp>/mytracer-tests/<unique-id>/
  electron-user-data/
  database/
  exports/
  artifacts/
```

最小规则：

- 根目录只能通过 `os.tmpdir()` 下的 `mkdtemp` 等唯一目录创建，不使用仓库根、应用安装目录、真实 Electron `userData` 或用户提供的任意路径；
- Electron E2E 启动时必须在 `app.whenReady()` 之前由测试进程指定唯一 `userData`；启动后通过 Main context 读取 `app.getPath('userData')` 并断言它位于本次临时根内；
- 不允许“测试路径缺失时回退到生产 `userData`”；缺失、无法解析或不在临时根内时测试必须在任何数据访问前失败；
- 每个测试根相互隔离；并行或重复执行不得共享数据库、配置、导出或缓存；
- T002 不创建 SQLite 文件；`database/` 仅保留后续 T003 使用的隔离目录契约；
- 清理前必须 canonicalize 并验证目标严格位于本次临时根内；只清理当前测试创建的路径，不使用宽泛 glob、仓库根、`$HOME`、`~` 或真实 `userData`；
- 测试失败时可以保留本次临时根用于诊断，但必须报告绝对路径且不得把其中内容提交；CI artifact 也不得包含密钥或真实用户数据；
- automated tests 不读取、复制、迁移、覆盖或删除真实 Electron `userData`，不读取真实密钥，不调用 live AI Provider；
- E2E 结束必须关闭 Electron 进程；重开场景后续必须重新建立进程/连接，不能只复用内存状态。

## 11. 允许修改范围

仅在合同和权限获批、T002 转为 `active` 后允许修改：

- `package.json`；
- `package-lock.json`；
- `eslint.config.js` 或单一等价 flat config；
- `.prettierrc*` 和 `.prettierignore`；
- `vitest.config.ts`；
- `playwright.config.ts`；
- 根 `tsconfig.json` 中仅用于加入 test config reference 的部分；
- `tsconfig.test.json` 或等价的单一测试类型检查配置；
- `tests/unit/**`；
- `tests/integration/**`；
- `tests/e2e/**`；
- `tests/support/**`；
- `.github/workflows/verify.yml`；
- `.gitignore` 中仅与测试输出/临时根有关的条目；
- `README.md` 中的精确验证命令和 T002 当前事实；
- `AGENTS.md` 中原“命令尚未建立”的段落及统一命令引用；
- `docs/implementation/TASK_TEMPLATE.md` 中统一验证命令提示；
- `docs/implementation/TASK_INDEX_V0.1.md` 中仅 T002 状态和证据字段；
- `docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md` 中仅 T002 实际证据；
- 本合同中仅用于反映实际批准、状态、结果和证据的字段。

默认不修改 `src/**`。若可靠 Electron E2E 数据根注入无法仅通过测试启动参数完成，必须停止并向项目所有者提出最小 `src/main/**` 测试 seam 方案及安全约束；不得自行扩大范围。

## 12. 明确非范围

- 不改变冻结需求、D、ED、AC、进程边界或用户可见语义。
- 不实现 T003 的 SQLite、`better-sqlite3`、schema、migration、Repository、事务或重开持久化。
- 不实现 T004 的生产 `ClockPort`、LocalDate 值对象、周范围、诊断或 safeStorage 配置适配器。
- 不实现 Goal、Action、Routine、Record、Today 业务查询、Progress、Recovery、Review 或删除/导出业务。
- 不实现 T061～T063 的上下文选择、正式 Provider 端口、真实 Provider、模型、SDK、密钥、确认命令或 AI 业务错误分类。
- 不加入真实 AI Provider 测试、live 网络测试、付费服务或任何秘密。
- 不加入 DOM unit-test 环境、组件测试库、coverage 门槛、视觉回归、跨平台矩阵、自动更新、发布或代码签名。
- 不修改 branch protection、ruleset、required-check 设置、Actions secrets、仓库变量或部署设置。
- 不创建 `dev -> main` PR，不 merge，不标记 Ready，不 tag/release，不 force push，不删除远端分支。
- 不把工具存在、测试名称、空壳 E2E 或 CI 配置文件存在描述为业务 FR/AC 或 G2 通过。

## 13. 必须保持的不变量

- Renderer 不获得 Node、SQLite、文件路径、凭据、Provider 或任意 IPC 能力。
- Preload 继续只暴露具体类型化白名单 API；测试不得暴露通用测试后门到生产 Renderer。
- Main 继续校验 IPC sender/origin 和输入；E2E 不绕过这些检查。
- Domain 不依赖 Electron、React、SQLite、文件系统、网络、测试框架或具体 AI SDK。
- Application 不依赖具体 UI、数据库适配器、具体 Provider 实现或测试 fake；经批准的端口依赖边界保持不变。
- 测试 fake 只能从测试代码导入，生产组合根不得引用 `tests/**`。
- 自动化测试完全离线；未主动配置且未经单独批准时 Provider 调用为零。
- 所有测试使用唯一临时数据根；真实 Electron `userData`、真实密钥和 live AI Provider 永远不作为 fallback。
- `verify` 和 CI 只运行非破坏性检查，不调用 `format --write`、package、installer、发布或数据清理脚本。
- CI job 对所有以 `dev` 为 base 的相关 PR 报告明确状态，不使用 workflow-level path filter。
- required check 必须对应 PR 最新 revision；中间或旧 revision 的成功不能作为最终证据。

## 14. 交付物

- [x] 第 6.2 节精确版本的 lint、format、unit/integration 和 E2E devDependencies 及锁文件。
- [x] ESLint flat config，包含 TypeScript/React 基础规则和 Main/Preload/Renderer/Domain 依赖边界限制。
- [x] Prettier config/ignore，以及只读 `format:check`。
- [x] 独立 unit/integration Vitest projects 和最小真实测试。
- [x] Playwright Electron 空壳 E2E，使用唯一临时 `userData`。
- [x] 满足第 8～10 节契约的 FakeClock、FakeAiProvider 和临时数据根 helper。
- [x] 第 7 节全部稳定 npm scripts。
- [x] `.github/workflows/verify.yml` 的 Windows required gate 候选；workflow 名称固定为 `Verification`，job ID 固定为 `windows-required`，job 名称固定为 `Windows required gate`。
- [x] README、`AGENTS.md`、任务模板的统一命令更新。
- [x] T002 状态与 `EV-T002-001` 或后续未占用 Evidence ID 的真实证据。
- [x] 相对最新授权 `origin/dev` 的完整 diff 自查和独立 review。

## 15. 验收标准

1. `package.json` 只新增第 6.2 节批准的精确 devDependencies，锁文件可由 Node 24.18.0/npm 11.16.0 的干净 `npm ci` 还原，且没有未报告 peer/engine 冲突。
2. 第 7 节命令全部存在；`typecheck` 覆盖生产源码、测试源码和 test/tool configs；`format:check`、`lint`、`typecheck`、`test:unit`、`test:integration`、`test:e2e`、`build` 和 `verify` 在最终本地 revision 上以 exit code 0 真实执行。
3. `verify` 聚合全部非破坏性 gate，并实际包含 build；它不改写源码/文档、不调用 package/installer、不访问外部 AI。
4. FakeClock unit tests 证明状态完全由测试控制、原子推进、无系统时间默认值且实例隔离。
5. FakeAiProvider unit tests 证明 success、timeout/pending、cancellation、authentication failure、parse failure、late response、fabricated payload 和调用记录均确定可控，且零网络/零密钥/零写入。
6. 临时根 integration tests 证明每次创建唯一、canonical path 位于 OS 临时目录内、清理只命中本次根，并拒绝缺失/越界/生产路径。
7. Electron E2E 在构建后的应用上运行，断言实际 `app.getPath('userData')` 位于本次临时根内；测试关闭后没有访问或清理真实 `userData`。
8. Electron E2E 至少验证空壳加载、Today/Progress/Review 导航、AI `not-configured` 状态、`window.node`/`window.require` 不存在和 IPC 正常响应；不得创建业务数据或数据库。
9. GitHub workflow 对 `pull_request`（base `dev`）及 `push`（`dev`）运行，无 path filter，固定为 workflow `Verification` / job `Windows required gate`，使用 Windows 2025、Node 24.18.0、干净 `npm ci` 和 `npm.cmd run verify`。
10. hosted CI 在 T002 最新 PR revision 上实际产生明确成功状态；在此之前不得声称 required gate 已生效。branch protection 是否 required 仍保持未配置/未验证，除非另有独立授权和证据。
11. README、`AGENTS.md`、任务模板、CI 与 `package.json` 对稳定命令的引用一致，没有第二套命令。
12. 最终 diff 不包含 SQLite/migration、业务能力、真实 Provider/密钥、延期功能、未批准依赖或生产测试后门。
13. 本地与 hosted CI 的 revision、命令、环境、exit code、artifact/URL、限制和人工状态写入 T002 验收证据。
14. 独立 review 对完整 T002 diff 无未处理的 P0/P1/P2 材料问题；P3 或限制必须记录。
15. T002 完成后任务索引只将 T002 更新为有真实证据支持的状态；不得同时推进 T003、T004 或 G2。

本任务没有替代产品体验的人工 AC。项目所有者对依赖和权限的批准是启动授权，不是验收通过。

## 16. 验证计划

以下命令只在项目所有者批准依赖安装和执行权限、且 T002 已实际建立命令后运行。

### 环境与基线确认

```powershell
node --version
npm.cmd --version
git status --short --branch
git rev-parse HEAD
git rev-parse origin/dev
git ls-remote origin refs/heads/dev
```

### 依赖与针对性验证

```powershell
npm.cmd ci
npm.cmd ls --depth=0
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:e2e
```

### 受影响范围回归

```powershell
npm.cmd run verify
npm.cmd run build
git diff --check
git status --short --branch
```

`npm.cmd run build` 在 `verify` 中已由 `test:e2e` 执行；这里的独立重跑用于把 build 结果单独绑定到最终 revision。不得使用远程 `npx` 隐式下载工具。

### Hosted CI

1. push 获批任务分支并创建/更新到 `dev` 的 Draft PR；
2. 记录 workflow 名称、稳定 job/check 名称、run URL、run ID、event、base、head SHA 和测试 merge revision；
3. 确认 check 对应最新 T002 PR revision，而不是较早提交；
4. 记录 Windows runner、Node/npm、`npm ci`、`verify` 和 E2E 的实际结果；
5. 不在 T002 中把 check 配置为 branch protection required；该远端设置另行审批。

### 验证环境

- **OS（本地）**：Windows x64，完成时填写具体版本
- **OS（CI）**：GitHub-hosted `windows-2025` x64，记录实际 image version
- **Node**：24.18.0
- **npm**：11.16.0
- **Electron**：43.3.0
- **数据根**：每 test/case 唯一的 OS 临时目录；Electron `userData` 必须位于该根内
- **AI**：FakeAiProvider only；无 SDK、无 key、无 live call
- **Source revision**：完成时填写本地 commit、PR head 和 CI head/merge revision

## 17. Git 与 GitHub 权限

当前权限状态：

- [x] 允许创建本地 worktree/`task/T002-validation-toolchain` 分支。
- [x] 允许创建本地提交。
- [x] 允许推送 `task/T002-validation-toolchain`。
- [x] 允许创建或更新 Draft PR 到 `dev`，并触发其中的 GitHub Actions。
- [ ] 允许将 Draft 标记为 Ready。
- [x] 不允许 Agent 合并到 `dev`。
- [x] 不允许 Agent 创建或合并 `dev -> main` PR。
- [x] 不允许 Agent 创建 tag 或 release。
- [x] 禁止 force push 和远端分支删除。
- [x] 不允许修改 branch protection、ruleset、required checks、Actions secrets 或仓库设置。

项目所有者已为 T002 批准前四项；Ready、merge、`dev -> main`、tag/release 和仓库设置继续不授权。

## 18. 依赖与外部操作权限

- **新增/升级依赖**：已批准第 6.2 节完整精确清单；仅允许新增这些 devDependencies，现有依赖不升级。
- **执行安装**：已批准 `npm.cmd install`/`npm.cmd ci` 和必要下载。
- **网络访问**：已批准 npm 官方注册表、既有 Electron 二进制来源和 GitHub Actions 执行所需下载，不扩大到其他服务。
- **AI Provider**：只允许纯内存 FakeAiProvider；不允许真实 Provider、SDK、模型、key 或 live request。
- **外部写入**：已授权 push 指定任务分支、创建/更新到 `dev` 的 Draft PR 和由此触发 Actions。
- **GitHub 配置**：不授权 branch protection、required-check 配置、ruleset、secret、variable、部署或 release 设置。
- **数据破坏性操作**：无；只允许清理由本次测试创建且通过 canonical containment 校验的临时根。
- **真实用户数据**：禁止读取、写入、迁移、复制、导出、截图或清理。

## 19. 风险与停止条件

发现以下任一情况时停止受影响实现并报告：

- T001 未处于重新核验的最新 `origin/dev` 祖先链；
- MUST、D、ED、GW 或本合同之间存在冲突；
- 需要新增、替换或升级第 6 节以外的依赖/action/runner；
- 需要引入 `better-sqlite3`、schema、migration、Repository 或业务能力；
- 需要在 T002 中建立生产 ClockPort/LocalDate 或正式 AI Provider 语义；
- 测试数据根可能回退到、包含或清理真实 Electron `userData`；
- 测试需要读取真实 `.env`、API key、系统凭据或调用 live Provider；
- E2E 需要暴露 Renderer 测试后门、任意 IPC、文件路径或 Node 能力；
- CI workflow 不能对相关 PR 始终报告明确状态，或 check 名称不稳定/与其他 workflow 冲突；
- hosted CI 只验证旧 revision、非 Windows 环境或未执行完整 `verify`；
- 需要修改 branch protection、Actions secrets、Ready/merge/tag/release 状态；
- 需要扩大 Git、GitHub、文件、网络或外部写入权限；
- 无法产生绑定最终 revision 的可靠本地与 hosted CI 证据。

任务特有已知风险：

- Playwright Electron API 标记为 experimental；升级 Electron 或 Playwright 时必须重新验证启动和关闭行为；
- Windows hosted runner 和 Electron GUI 可能出现时序/资源抖动；优先使用事件与可观察状态，不用任意长 sleep 掩盖不稳定；
- format 初次引入可能发现现有文档差异；T002 不允许借机批量重写规范文档；
- GitHub required check 只能在 workflow 实际稳定报告后配置；T002 完成不等于 branch protection 已生效；
- T003 才会证明 SQLite 临时数据库、migration 和重开隔离，T002 只证明数据根机制。

## 20. 完成报告

T002 完成报告必须包含：

- 新增或修改的文件；
- 实际建立的命令、fakes、临时根和 CI 结果；
- D/ED/GW 覆盖及“无直接 FR/AC 完成声明”；
- 实际执行的本地/CI 命令、环境、exit code 和关键输出；
- FakeClock、FakeAiProvider 和临时根隔离证据；
- 本地 commit、PR、CI head/merge revision、run URL 和稳定 check 名称；
- 自动化和人工验收状态；
- 风险、已知缺口、跳过/未验证内容；
- T003/T004/T061～T063 仍待实现的边界；
- 是否发现需求冲突、范围变化、未批准依赖或真实数据风险。

完成报告不得声称：

- AC-01～AC-07、FR-D05、FR-AI09 或 G2 已通过；
- SQLite/migration、生产 ClockPort/LocalDate、safeStorage 或真实 AI 已实现；
- GitHub branch protection 或 required check 已配置；
- 仅因 workflow 文件、测试名或命令存在就证明行为通过；
- 项目所有者尚未执行或确认的事项已经通过。

## 21. 项目所有者审批清单

项目所有者于 2026-08-08 已整体确认：

1. 是否整体批准第 6.2 节 9 个精确 devDependencies；如不同意，请指出要替换的包和精确版本。
2. 是否批准第 6.3 节 `windows-2025`、`actions/checkout@v6.0.2`、`actions/setup-node@v6.4.0`。
3. 是否批准安装上述依赖及 npm/Electron 必要网络下载。
4. 是否批准创建 `task/T002-validation-toolchain` worktree/分支和本地提交。
5. 是否批准 push 该任务分支、创建/更新到 `dev` 的 Draft PR，并触发 GitHub Actions。
6. 是否同意 Ready、merge、`dev -> main`、tag/release、branch protection、required-check 配置和仓库设置继续保持不授权。

上述批准已记录，执行前远端基线重新核验通过，任务分支从该基线创建；完成结果记录于 `EV-T002-001`。T002 当前为 `done`，但 Draft PR 的 Ready、merge 和任何仓库设置仍由项目所有者控制。

## 22. 执行结果

- **Implementation revision**：`f60a38c4e69b8bead2aa8975c6fdb6886bec220a`
- **Base revision**：`e6f7b933bd4cbce57032a7a1b0da24912f45c3e9`
- **Draft PR**：[#2](https://github.com/Fyrefly-4/MyTracer/pull/2)，base `dev`
- **Hosted verification**：`Verification` / `Windows required gate`，run `31241614350`，head `f60a38c4e69b8bead2aa8975c6fdb6886bec220a`，test merge `c6968d4f7d53ff5ff1a32d8f32909707eb05075b`，success
- **Automated result**：本地 `npm.cmd run verify` exit code 0；13 unit、3 integration、1 Electron E2E 均通过；hosted Windows 同范围通过
- **Independent review**：修复宿主环境变量透传和临时根对象伪造问题后，最终完整 diff 无未处理 P0～P3 finding
- **Evidence**：`EV-T002-001`
- **Manual status**：本任务无产品体验 AC，记为 `not-required`；项目所有者仍负责 PR 评审、Ready 与 merge 决定
- **Boundary**：未实现 SQLite、migration、业务能力、生产 ClockPort/LocalDate、safeStorage 或真实 AI；未声明 AC-01～AC-07 或 G2 通过；未配置 branch protection/required check

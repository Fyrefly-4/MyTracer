# T072 — 全量回归、AC-01～AC-07 与 Windows Demo 收敛

> 合同版本：approved-1，2026-09-19；项目所有者已批准并激活。
> owner 已授权按合同开发及合同所需 Git 权限；§5.2 实施、任务分支/commit/普通 push/Draft PR 生效。§14 保留合同准备阶段历史。
> 采用 V2 / Batch 3 显式权限流程；不声明 Automation Profile。T072 提供 G4 决策输入，不自动签署 G4、启动真实自用或发布。

## 1. 任务信息

- **Task ID / Title**：T072 / 全量回归、AC-01～AC-07 与 Windows Demo 收敛。
- **Slice / Plan item**：S7 / Implementation Plan §10.2；Test Strategy §7～10。
- **Status**：以 [TASK_INDEX_V0.1.md](TASK_INDEX_V0.1.md) 为唯一任务状态账本；owner 已激活 T072。
- **Base branch / 编写基线**：`dev@248350409927923016de18f7c5d967aa064964ca`。
- **Expected branch**：`task/T072-demo-convergence`，已按授权创建并 checkout；复用当前已具备依赖的目录，不复制凭据或真实数据。
- **任务类型**：`aggregate`，含下文明确列出的测试与界面收敛修复；不扩展为 S0～S7 任意功能修复合同。

### 1.1 当前状态快照（2026-09-19）

| 对象 | 本轮核对事实 | 对 T072 的含义 |
| --- | --- | --- |
| 工作区 / dev | 初始工作区干净，当前分支为 `dev`；本地 HEAD、origin/dev 与 GitHub dev 均为 `248350409927923016de18f7c5d967aa064964ca` | 本轮只留下 §5.1 的合同相关未提交修改；启动实施时重新检查状态与基线 |
| T071 / PR #55 | 索引为 `done`；[PR #55](https://github.com/Fyrefly-4/MyTracer/pull/55) 于 `2026-09-19T03:16:26Z` 合入 dev；final head 为 `6b6fb5f72af054a96d57d7c6f53da132a2cdc668`，集成 revision 为上述编写基线 | 直接前置已集成；产品与历史验证见 [EV-T071-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-t071-001) |
| T071 CI | final-head [run 35417697381](https://github.com/Fyrefly-4/MyTracer/actions/runs/35417697381) 为该 head 的成功 pull_request run，Full Windows verification 与 CI Gate 成功，Milestone packaging checks 跳过；post-merge [run 35418081047](https://github.com/Fyrefly-4/MyTracer/actions/runs/35418081047) 在 `2483504` 成功 | 不将通过的普通验证解释为 package 或 T072 聚合通过；更早取消 run `35417198097` 及其失败 Gate 不删除 |
| T806 / T807 | [PR #43](https://github.com/Fyrefly-4/MyTracer/pull/43) 已合入 `1d02fd7a0a7b0bf29a5e39720d5818c9d68fdbc2`；[PR #49](https://github.com/Fyrefly-4/MyTracer/pull/49) 已合入 `fa3ac0a2ac9ec0854615478a14886d764f21c3fc`；二者均为当前 HEAD 祖先 | 对应 final-head run `33323763973` / `33955746084` 成功；历史账本仍有 review、待 CI/merge 描述，按 §13.1 提案处理，不自动代签 done |
| S1～S6 与后续界面 | T011～T063 业务任务在索引均为 done；#51、#52、#53 和 T071 已进入 dev | 保持当前导航、会话草稿、筛选及视觉基线；旧阶段截图或旧测试定位不能覆盖现有已批准体验 |
| package smoke | `tests/e2e/windows-package-smoke.e2e.test.ts` 仍断言 progress 只有 `get`；`src/preload/index.ts` 实际为 `goalActivity`、`compareWeeks`、`get` | 静态确认的断言漂移；本轮未执行 package smoke，不虚构运行失败。拟纳入 §5.2 的精确 test-only 修复 |
| 工具链与数据 | package.json 锁定 Node `24.18.0`、npm `11.16.0`、Electron `43.3.0`；现有工具链实际版本与前两项一致；当前 SQLite schema 为 3 | 无新增/升级依赖、DDL、migration 或导出格式变化；验证继续使用隔离数据 |
| S7 架构输入 | Implementation Plan §10.1/10.2、Traceability §2～3、Test Strategy §7～10 已定义本任务范围；未找到独立 S7 设计文件 | 本合同细化既定收敛任务；若需要新的架构或产品决定，停止相应工作并升级 |

上述 GitHub 查询仅核对 PR、run/head/result 和本地祖先关系；未重新下载历史 CI artifact 或恢复其 test-merge SHA，不重签历史人工或阶段验收。T071 Evidence 中尚未补记的集成字段也不由本轮回写。

## 2. 目标结果

在一个明确的 Windows 候选版本上，完整执行 AC-01～AC-07，逐项核对全部 69 条 MUST、11 条 SHOULD 与 7 条延期 FR，形成可复查的实现/测试/人工结果矩阵。现有空状态、错误恢复、渐进披露、中性表达、键盘和焦点路径可用；Windows x64 unpacked 与隔离 NSIS 安装产物能启动并读取独立 SQLite。

交付一个带 revision、产物校验值、使用限制和人工验收状态的 Demo 候选与交接记录，供项目所有者决定 G4、后续 main 晋升及 7～14 天真实自用。合同本身、历史绿色 CI、打包成功或任务 done 都不能替代这些决定。

### 2.1 收敛口径（已批准）

1. 优先复用既有分层测试和 AC 程序，逐项检查真实断言；发现缺口才增加或修正测试。不以文件名、关键词或一条大而无具体断言的 smoke 代替需求覆盖。
2. “同一版本连续执行”指一次完整验收批次固定 source revision 与 build，批次内不修改代码、不重建混用产物；各自动化场景可使用独立临时数据库，不强制共享全部 fixture。AC 间共享事实的必要接缝另有断言，尤其恢复→复盘、AI 确认→记录/进展、修改删除→重开/导出。
3. 界面收敛限现有流程：空态提供已有入口；查询/保存失败中性提示并可恢复，失败不假称保存成功；深入字段仍可选；焦点可见、控件可通过键盘到达、对话框关闭后焦点合理返回。保留当前布局和视觉语言，不进行整站重设计。
4. 当前已识别的 package smoke 漂移只同步到批准的三个 progress 方法，并继续精确检查窄 API、安全配置和隔离数据；不得删除断言、接受任意方法或跳过 package 测试以取得绿色结果。
5. 本轮及后续普通自动化均使用 fake AI；真实 Provider 的历史体验和 live-contract 限制分别列出。T072 的 fake AC-02 不证明当前真实 Provider 可用；新 live 调用需要独立明确授权，不进入 verify/required CI。
6. 69 条 MUST 或 AC 有必要失败、证据缺失或未完成人工判断时，保留失败/待定状态，不能宣称 Demo 整体验收通过。7～14 天使用观察记录可准备模板与已知限制，但不填造使用结果。

## 3. 需求与架构依据

- **MUST（69 条）**：FR-G01～G06；FR-A01～A07；FR-R01～R07、R09；FR-T01～T05、T08；FR-L01～L05、L07～L09；FR-C01～C03；FR-P01～P04、P07、P08；FR-AI01～AI10；FR-REC01～REC04、REC06；FR-RV01～RV04、RV06；FR-D01～D05。
- **SHOULD（11 条）**：FR-G07、A08、R08、T06、T07、L06、C04、P05、P06、REC05、RV05；沿用 T071 已交付口径，不重定优先级。
- **延期 FR（7 条）**：FR-C05、AI11～AI13、RV07、D06、D07；另扫描 PRD §3.3/11.3、DECISIONS §4 的未编号延期能力。
- **AC / UX**：完整 AC-01～AC-07；UX-01～UX-07；PRD §13 的自用准备，不包含实际观察期完成。
- **D**：D-001～D-017、D-101～D-111；共 28 条，保持冻结含义。
- **ED / GW**：ED-001～ED-019；GW-001～GW-010，尤其版本、隔离、Windows 原生模块与发布门禁。
- **架构章节**：Architecture §4～9；Domain 的 Goal/Action/Routine/Record/查询不变量；Data §4～11；AI Boundary §2～10；Implementation Plan §10.2；Traceability §2～5；Test Strategy §3～10；S6 Design §10/13/15 对现行数据、fake/live 和配置边界的说明。

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
    - file: docs/architecture/IMPLEMENTATION_PLAN_V0.1.md
      sections: ["10.1", "10.2"]
  architecture:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/AI_BOUNDARY_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
    - docs/architecture/REQUIREMENTS_TRACEABILITY_V0.1.md
    - docs/architecture/S6_AI_START_HELP_DESIGN_V0.1.md
```

### 3.2 AC 验证定位与结果入口

下表定位程序与预期；合同准备时自动/人工为 `not-run / pending`。实现候选 `a78a31f` 已完成完整自动回归与 Windows package/smoke，实际 source manifest、命令、结果及限制见 [EV-T072-001](ACCEPTANCE_EVIDENCE_V0.1.md#ev-t072-001)；owner 已于 2026-09-28 报告人工验收全部通过，不能把历史 Evidence 拼接成当前版本通过。

| AC | 现有自动化入口（tests/e2e/ 下） | 当前候选必须证明的完整结果 |
| --- | --- | --- |
| AC-01 | `progress-core-loop.e2e.test.ts`、`action-record.e2e.test.ts` | Goal/下一步→Today→快速与可选深入记录→真实分钟、次数、确认理解→重开；partial 不自动完成 Action |
| AC-02 | `ai-start-help-ac02.e2e.test.ts`、`ai-start-help-degradation.e2e.test.ts` | 主动触发、最小相关上下文、温和小建议、拒绝/修改/接受、Understanding 独立确认；确认前零核心写入，取消/超时/关闭及重开隔离 |
| AC-03 | `routine-lifecycle.e2e.test.ts`、`routine-record.e2e.test.ts` | 例行节奏/最低行动/Today；四种显式结果和缺行 unknown 分离，acted/target_met 计次，非计划日不伪装计划达成，重开保持 |
| AC-04 | `action-intention.e2e.test.ts` | 通用非强制意向、显式选入/转换、跨日未发生无失败/无自动记录/无自动滚动 |
| AC-05 | `recovery-context.e2e.test.ts`、`recovery-restart.e2e.test.ts` | 模拟中断并重开，历史/困惑/下一步保留，不补空白日；显式整理过时内容并选小行动 |
| AC-06 | `review-summary.e2e.test.ts`、`review-result.e2e.test.ts`、`recovery-review-aggregate.e2e.test.ts` | 周一至周日事实摘要、进展/阻力/调整，不重录统计；显式下一步更新、取消零额外写入及重开 |
| AC-07 | `ai-data-capability.e2e.test.ts`、`data-control.e2e.test.ts`、`complete-export.e2e.test.ts` | 全核心状态创建/修改→重开→错误记录删除→完整导出/引用校验；AI disabled/not-configured/failure 时仍能操作 |

69 MUST 的最终矩阵每行至少关联一个实际自动化结果；主观体验另列人工结果。11 SHOULD 复用 T071 追踪并在新候选上回归；7 延期 FR 及其他延期能力记录完整 diff/结构检查结论，关键词搜索只是线索。

## 4. 开始条件

- [x] T072 稳定 ID、计划及模板存在；合同准备阶段已完成。
- [x] T071 done、PR #55 集成和当前远端 dev 已核对；T806/T807 集成及账本漂移已明确。
- [x] 现有工具链版本与稳定验证/package 命令已定位；原有 19 sidecar 的 metadata 检查通过。
- [x] 拟议范围无需新增依赖、schema、migration、Provider 或上下文权限。
- [x] owner 批准本合同 §2/§5.2/§9～12，并明确激活 T072。
- [x] owner 随合同批准 §13.1 的测试契约修复和采用已核实集成事实；历史账本修订仍遵守 docs closeout Gate。
- [x] 本地实施/验证、分支/commit/push/Draft PR 权限已明确；启动时远端 dev 仍为编写基线，仅三个合同准备文件未提交，无重叠用户修改。
- [x] 实施 preflight metadata 通过（20 sidecar / 1 Profile）；Node 24.18.0 / npm 11.16.0、现有依赖与 Electron binary 可用；已复核临时根与最小环境隔离 helper。

### 4.1 Dependencies

```yaml
dependencies:
  tasks:
    requires: [T071]
    blocks: []
    can_parallel: []
    prefer_after: []
    conflicts_with: []
  revisions:
    required_dev_base: dev@248350409927923016de18f7c5d967aa064964ca
  shared_surfaces:
    - Full AC and Windows package regression
    - Existing Renderer feedback, disclosure and keyboard focus
    - Requirements coverage and revision-bound evidence
  external: []
```

直接依赖严格采用任务索引的 T071；S1～S6 通过其前置链进入本任务。T806/T807 是聚合历史与基线核对上下文，不发明额外任务依赖；G4 是 owner 阶段门而非新 Txxx。全部共享面串行处理，不据此启动其他任务。

### 4.2 Metadata / Profile

Sidecar 为 [metadata/T072.json](metadata/T072.json)，任务类型 `aggregate`，五类依赖与上文一致。它仅辅助结构校验，不承载批准。未声明 `execution`、激活时间或有效期；`standard-task@1` 当前仅适用于 implementation/fix，不用于本聚合任务。

## 5. 允许修改范围

### 5.1 合同准备阶段范围（历史）

仅本合同、`metadata/T072.json`、TASK_INDEX 的 T072 合同链接；不改变 T072 或历史任务状态。允许只读核对 Git/GitHub、源码、测试和规范，执行合同所需 metadata、格式、链接/结构与 diff 检查。

### 5.2 已批准并激活的实施范围

| 模块 | 文件与允许变化 |
| --- | --- |
| Package smoke | `tests/e2e/windows-package-smoke.e2e.test.ts`：首先将 progress 方法精确期望改为 `['goalActivity', 'compareWeeks', 'get']`；保持其他窄 API、冻结、安全、SQLite、unpacked/NSIS 与路径隔离断言 |
| 回归与覆盖 | `tests/unit/`、`tests/integration/`、`tests/e2e/` 中对应 69 MUST/11 SHOULD/AC-01～07 的现有测试；只补缺失行为断言、必要 fixture 或由当前批准 UI 引起的定位变化；保留既有断言强度与失败证据 |
| 新增聚合/可用性验证（按缺口需要） | 可新增 `tests/e2e/demo-acceptance.e2e.test.ts`、`tests/e2e/windows-usability.e2e.test.ts`；只证明 §2.1/§9 的跨 AC 接缝、空错态、渐进披露与键盘焦点；没有缺口不为凑交付物新建 |
| 测试支持 | `tests/support/` 下与上述程序直接相关的合成 fixture、fake Clock/Provider 和 UI helper；保持测试根唯一、路径验证、fake 开关的现有信任边界，不修改生产入口放宽测试权限 |
| Renderer 入口与共享表单 | `src/renderer/src/app/AppShell.tsx`、`AppErrorBoundary.tsx`、`Field.tsx`、`navigation.ts`、`ui-session.ts`、`ui-text.ts`、`src/renderer/src/styles.css`：仅修复有观察/失败证据的 §2.1 界面问题；保持既有会话、布局和操作含义 |
| Renderer 现有页面 | `src/renderer/src/features/` 下 `goals/GoalsPage.tsx`、`goals/RecoveryPanel.tsx`、`today/TodayPage.tsx`、`today/AiStartHelpPanel.tsx`、`routines/RoutinesPage.tsx`、`progress/ProgressPage.tsx`、`review/ReviewPage.tsx`、`data-control/DataControlPage.tsx`；仅同上反馈、披露、文案、焦点和遮挡修复，不增加命令或用户概念 |
| 任务记录 | 本合同、sidecar、TASK_INDEX 的 T072 行；ACCEPTANCE_EVIDENCE 的新增 T072 provisional evidence，绑定真实执行结果；最终收口依 §15 |
| 本地产物 | ignored `out/`、`release/`、`.tmp/evidence/` 与经隔离 helper 创建的临时测试目录；仅 build/package/验证及无用户数据的报告，不提交二进制或完整日志 |

域、Application、Main/Preload、IPC DTO、SQLite、export、AI adapter、package.json/lockfile、构建配置、CI、治理工具、AGENTS 和 Skills 的实现变更不在本合同范围。若回归发现这些层的缺陷，保留失败与定位，提交精确扩围提案后再修复。

## 6. 明确非范围

- 新功能、架构重写、产品语义变更、依赖升级、新增或改动 migration、schema/export 版本变化。
- 自动补记录、强制重点上限、停滞阈值/排名、评分、掌握度、通知、日历排程、账号同步、自动导入与恢复。
- AI 上下文/权限扩大、自动确认、live Provider 调用、读取或复制真实 API key、真实数据库和用户导出。
- 自行修复全部历史文档；替 T806/T807 补签人工或 done；删除失败历史；批量归档旧合同。
- 修改全局超时/retry、禁用既有测试/断言、自动调整 CI 分类来回避失败。
- 自动 Ready、merge、main 晋升、tag、release、代码签名配置、更新分发、真实安装覆盖与自动开始下一任务。

## 7. 必须保持的不变量

1. 所有真实写入仍走普通 Application Command 与 Domain 不变量；查询不写入，Renderer 无 Node/SQL/路径/凭据/Provider 访问，Preload 只有经过 Main DTO/sender 校验的窄 API。
2. unknown、not_done、intentional_rest、acted、target_met 分离；partial/stopped 与 0 分钟真实行动保留；意向未发生无自动失败，不将时长/次数推导为质量或掌握度。
3. 发生日使用明确 LocalDate；跨午夜必须选择；周一至周日；修改日程不重算历史 plannedForDate；pause/end 保留历史。
4. 硬删除必须预览、确认、事务、级联/解除关联；取消与失败无部分写入。导出保持完整状态和必要引用，排除凭据、草稿与日志，不宣称自动恢复。
5. AI 主动触发、最小上下文、可拒绝、临时草稿与确认后普通命令；未配置/关闭/故障不阻塞核心数据。
6. 测试、安装/卸载和导出仅作用于本次唯一临时根；清理前核对真实绝对路径；不继承真实 Provider 配置。人工演示也使用合成数据的独立目录。
7. 当前草稿授权、Implementation Candidate、Task Delivery Revision、Dev Integration Revision、Stage Final Integration Revision 分开记录；历史 green、测试名、未执行计划均不成为本轮 pass。

**本任务局部风险**：聚合测试漏掉 UI 步骤、API 漂移使 package 误报、旧 out/release 与新 source 混用、用假数据证明代替 owner 体验、NSIS 测试影响真实安装、文档漂移误被解释为自动授权。按 §9/§10/§13 分别控制。

## 8. 交付物

- [x] 覆盖矩阵：69 MUST、11 SHOULD、7 延期 FR、7 AC，逐项绑定实际断言/手工步骤、revision 与结果。
- [x] package smoke 精确契约修复，以及由实际缺口产生的测试或限定 Renderer 收敛修复；无缺陷的模块不改动。
- [x] 同版本完整 verify、AC 批次、Windows package、unpacked/隔离 NSIS smoke 的脱敏证据。
- [x] Windows 人工体验：owner 报告上述 AC/UX 全部通过；实际显示/缩放/窗口数值未单独报告，记录此证据粒度限制，不以 Agent 环境代填。
- [x] 完整 diff 自查、独立只读 review、Integration Freshness、candidate CI 与 owner-approved docs closeout；文档提交的 final-head CI 仍作为 PR 集成门禁。
- [ ] 文档提交的 exact final-head full/milestone CI；不得以 candidate CI 替代，实时结果在 PR #56 记录。
- [x] Demo 候选交接：source/产物 revision、SHA-256、数据兼容/导出限制、已知问题和自用观察入口；不发布或预签 G4。

## 9. 可判定验收条件

1. 69 MUST 每条均有当前候选的实际自动化结果；纯体验部分另有 owner 判断。任何未覆盖、失败或必要 skip 都明确阻止整体验收通过。
2. AC-01～AC-07 全步骤在同一明确版本完成；每个 AC 有自动程序和 owner 人工状态。跨 AC 事实不重复、不丢失，不用 API-only seed 代替需要由 UI 证明的关键用户步骤。
3. 11 SHOULD 按 T071 原口径完成新候选回归；延期扫描无混入范围，不能通过本任务扩大 SHOULD 为新 MUST。
4. 跨午夜两种日期选择、补记/修正、删除取消/确认/回滚、历史计划事实、迁移旧 fixture→schema 3、重开、当前完整导出及既有 v1/v2 契约回归通过。只跑旧 fixture，不运行真实数据迁移。
5. AI fake 成功/拒绝/修改/确认/迟到/取消/超时、disabled/not-configured/failure、最小上下文唯一标记隔离均通过；未确认草稿不进入 SQLite/导出；live 结果不由 fake 代替。
6. Windows x64 package 使用相同 source 构建，unpacked 与隔离 NSIS 安装后均能启动、加载 SQLite、确认实际 userData 位于临时根、校验窄 API；安装卸载结果完整记录。普通 verify 的 package-only skip 由独立成功 smoke 补足。
7. **MANUAL**：在 owner 实际 Windows 屏幕/缩放下完成完整 AC，并检查常用窗口与最小支持窗口；记录实际尺寸/DPI，不臆称覆盖所有屏幕。Tab/Shift+Tab、Enter/Space、适用的 Esc、可见焦点、标签、对话框焦点与错误恢复不阻塞关键操作。
8. **MANUAL**：快速记录只需最低字段，深入内容可选；空态和五态文案中性；无失败率/断签施压；Today focus/intention/Routine 易区分；AI 易修改/拒绝；导出不承诺恢复。
9. 最终 diff 与独立 review 无未处理 material finding；freshness 已在最新授权 dev 验证；本地与 hosted 证据绑定正确 revision，最终文档与实现一致。
10. T072 达成合同后只形成 G4 决策候选；G4 接受、main、tag/release 和真实自用开始仍需 owner 的独立决定。人工缺口或产品失败存在时不得宣布完整 Demo 就绪。

## 10. 验证计划

### 10.1 合同准备阶段检查

```powershell
npm.cmd run governance:metadata:check
npm.cmd run format:check
node node_modules/prettier/bin/prettier.cjs --check docs/implementation/metadata/T072.json
git diff --check
```

另核对 Markdown 本地链接、模板章节、69/11/7 编号、sidecar 依赖与合同权限一致。仓库 `.prettierignore` 忽略 Markdown，format 通过不代表合同内容或链接已验证。合同准备阶段未运行产品 verify、E2E、package 或人工验收；已激活开发按下文执行。

### 10.2 激活后的从窄到宽验证

先按实际改变的测试文件运行对应 `npm.cmd run test:unit -- <file>` / `npm.cmd run test:integration -- <file>`；`<file>` 必须替换为存在的受影响文件。涉及构建后 E2E 时使用以下稳定入口：

```powershell
npm.cmd run test:e2e -- tests/e2e/progress-core-loop.e2e.test.ts tests/e2e/ai-start-help-ac02.e2e.test.ts tests/e2e/routine-record.e2e.test.ts tests/e2e/action-intention.e2e.test.ts tests/e2e/recovery-restart.e2e.test.ts tests/e2e/review-result.e2e.test.ts tests/e2e/ai-data-capability.e2e.test.ts
npm.cmd run verify
npm.cmd run package -- --publish never
npm.cmd run test:package-smoke
```

AC 定向命令是快速反馈，不单独穷尽 §3.2；完整 verify 包含其他所有 E2E、unit/integration、build、format/lint/typecheck。相同 revision 的完整 verify 可满足其已覆盖检查，无新变化/失败不重复执行。package 单独执行并禁用发布；默认 live-only skip 如实列为非本任务授权验证，package-only skip 不得遗漏补跑。

### 10.3 确定性证据

需要留存命令事实的 candidate 验证采用 explicit argv wrapper；以下 SHA 是编写基线，实施时如 dev 前进必须换成实际批准并验证的基线：

```powershell
node tools/evidence/capture-command.mjs --task T072 --gate local-candidate --base-revision 248350409927923016de18f7c5d967aa064964ca --output .tmp/evidence -- npm.cmd run verify
node tools/evidence/capture-command.mjs --task T072 --gate package --base-revision 248350409927923016de18f7c5d967aa064964ca --output .tmp/evidence -- npm.cmd run package -- --publish never
node tools/evidence/capture-command.mjs --task T072 --gate package-smoke --base-revision 248350409927923016de18f7c5d967aa064964ca --output .tmp/evidence -- npm.cmd run test:package-smoke
```

保留真实 child exit code、失败 artifact 和 `supersedes`；检查 source/base、dirty 状态、命令 argv、Windows/Node/Electron、capture completeness。只保存 allowlisted 脱敏 metadata；不把 stdout/stderr、环境变量值、绝对用户路径、SQLite、AI 正文或密钥写入 JSON。长期 Evidence ID 为 `EV-T072-001`，仅依据真实执行结果记录。

### 10.4 Windows 与人工程序

1. 固定 source SHA、构建批次与 installer/unpacked 产物；记录文件名、SHA-256 和实际 Windows 版本。package smoke 只能安装到新临时目录，不覆盖现有安装。
2. 创建独立人工验收数据根，使用合成数据；按 PRD AC-01→AC-07 完整执行，逐 AC 记录结果与观察。AI 成功分支使用已有 fake 测试环境；真实 Provider 当前体验另行授权与记录。
3. 在常用窗口及实际最小支持窗口核对 §9.7/§9.8；检查无关键内容遮挡、键盘路径与焦点可见。记录实际条件，不把单张截图当作完整可访问性证书。
4. 关闭应用并重开同一人工测试根，复核保留事实和导出；不检查或清理真实 userData。owner 未报告结果时保持 `pending`。

### 10.5 环境与执行节奏

- 主要环境为 Windows x64，Node `24.18.0`、npm `11.16.0`、Electron `43.3.0`，以运行时核实结果为准；不升级到沙箱默认的不同 Node 版本。
- 优先使用现有已批准工具链/依赖缓存；本合同不授权 `npm ci`、下载新的二进制或修改 lockfile。若本地还原必需，列出精确步骤后单独授权；已批准 hosted workflow 的锁定安装属于其正常 CI。
- 本地依赖结果的命令采用 BLOCK；外部 CI 确认启动后保存 PR/run/job/source-head/test-merge，若无其他有效工作则 HANDOFF。恢复时先核对是否出现新 head/替代 run，不连续轮询旧状态。

## 11. Git 与 GitHub 权限

owner 于 2026-09-19 明确“批准按合同进行开发，给予合同中所需git权限”。本任务分支、必要 worktree、阶段性 commit、普通 push 与一个到 dev 的 Draft PR 已授权；下列独立 owner gates 不由此解除。

- [x] 允许创建或 checkout 本地 `task/T072-demo-convergence`；需要隔离时可创建本任务 worktree。
- [x] 允许创建有意义的阶段性提交。
- [x] 允许普通推送本任务分支。
- [x] 允许创建/维护同一任务到 `dev` 的 Draft PR。
- [ ] 允许标记 Ready；需要之后针对确切 PR 单独批准。
- [x] merge dev/main、dev→main PR、tag/release 均未授权；禁止 force push/远端删除、ruleset/secret 写入。

```yaml
permissions:
  local_write: true # §5.2 已批准实施范围；最终 docs closeout 另行批准
  create_worktree: true
  create_task_branch: true
  create_commit: true
  push_task_branch: true
  create_or_update_draft_pr: true
  mark_ready: false
  merge_dev: false
  merge_main: false
  tag: false
  release: false
  dependency_change: false
  migration_change: false
  external_write: false # 仅上述同任务 GitHub publication 例外；非任务外部写入未授权
```

获授权后建议提交顺序：合同与 package API 契约窄修复；必要的覆盖/界面修复及测试；独立 owner-approved 文档收口。按实际变化合并成可独立理解的提交，不制造空实现或人为微提交。

## 12. 依赖、外部操作与集成

- **依赖/版本变化**：无；现有依赖版本保持不变。
- **网络**：本仓库 GitHub 只读核对及 §11 已批准的本任务 publication；无 live Provider/凭据、非任务外部写入或 release。
- **数据操作**：测试 CRUD/migration fixture/安装卸载仅在独立临时根中运行，禁止真实数据迁移或真实安装覆盖。
- **CI**：publication 获批后，Draft PR 正文使用已有 `CI mode: milestone` 提升验证等级；candidate 与 final-head 都要求 Full Windows verification、Milestone packaging checks 和 CI Gate 实际成功。普通文档分类绿色 Gate 或被跳过的 package job 不满足本合同。

```yaml
integration:
  target_branch: dev
  base_revision: dev@248350409927923016de18f7c5d967aa064964ca
  freshness_required: true
  affected_regression_required: true
  task_delivery_revision: null
  dev_integration_revision: null
  stage_final_integration_revision: null
```

本轮只核对编写基线一致，不声明 Integration Freshness `fresh`：尚无候选验证。实施后记录 original_base_revision、latest_authorized_dev_revision、verified_against_revision、status、refresh_method。stale 时用获授权的普通 merge dev 刷新，完成受影响回归并在必要时重做 review；只使用 fresh/refreshed-and-passed/blocked/not-required 四个状态。T072 delivery 与其实际 dev 集成分开，G4 最终集成 revision 在对应 owner gate 才固定。

## 13. 风险、漂移提案与停止条件

发现 MUST/架构冲突、生产边界缺陷需要扩围、依赖/migration/Provider 权限变化、测试触碰真实数据、不可安全集成或无法形成可靠证据时，停止受影响工作并按 [Escalation Proposal 模板](ESCALATION_PROPOSAL_TEMPLATE.md) 留存事实。安全的合同/只读诊断可继续。

### 13.1 编写时已发现的 baseline drift 提案

以下保留合同准备时的提案快照。owner 已于 2026-09-19 随合同批准精确测试修复及已核实集成基线；相关实施阻塞解除，历史文档修订仍等待 §15 的精确收口批准。

```yaml
type: baseline_drift
task: T072
blocking: true
problem:
  summary: package smoke 的 progress 期望落后于 T071；历史聚合文档的 CI/merge 描述落后于 GitHub
  observed_behavior: package smoke 期望仅 get；Preload 已暴露 goalActivity/compareWeeks/get；T806/T807 仍写 review 或待 merge，但 PR 43/49 已合入
observed_at:
  branch: dev
  revision: 248350409927923016de18f7c5d967aa064964ca
  working_tree_state: clean
current_authority:
  contract: docs/implementation/T072_DEMO_CONVERGENCE.md（draft，仅合同准备）
  stage_design: docs/architecture/IMPLEMENTATION_PLAN_V0.1.md §10.2
  architecture:
    - docs/architecture/TEST_STRATEGY_V0.1.md
  requirements:
    - docs/PRODUCT_REQUIREMENTS_V0.1.md
  decisions:
    - docs/DECISIONS.md
conflict:
  current_rule_or_assumption: 打包断言须与批准窄 API 一致；账本事实须绑定真实 revision
  incompatible_condition: 当前断言遗漏两个批准 Query；历史待合并描述与实际集成状态不一致
  evidence: §1.1 的源码比对、gh pr/run 查询及 git merge-base --is-ancestor；尚未运行 package smoke
proposed_change:
  summary: 批准 §5.2 的精确 test-only 修复；接受 §1.1 核实的输入基线；将历史文档事实修订纳入 §15 待批矩阵
  alternatives:
    - alternative: 将测试修复拆为独立 owner-authorized fix，再恢复 T072
      tradeoff: 增加交接，但不改变窄修复和重新验证要求
    - alternative: 暂缓历史文档修订，保留漂移声明
      tradeoff: 不能声称历史文档已对齐；不影响已核实集成事实，但 G4 文档一致性须继续报告缺口
affected:
  tasks: [T072, T806, T807]
  files:
    - tests/e2e/windows-package-smoke.e2e.test.ts
    - docs/implementation/TASK_INDEX_V0.1.md
    - docs/implementation/ACCEPTANCE_EVIDENCE_V0.1.md
    - docs/implementation/archive/S4_S5_T041_T052_ARCHIVE.md
    - docs/implementation/archive/S6_T061_T063_ARCHIVE.md
    - README.md
  interfaces:
    - progress 的既有三个只读 API（仅修正测试期望，不改变接口）
risk:
  product_semantics: none
  data_safety: none（仅临时数据验证）
  integration: package 验证未完成，不能以已有绿色 verify 代替
  evidence: 不从 merged 推断 owner 人工验收或历史任务自动 done
safe_work_completed:
  - 当前源码、Git/GitHub、依赖链与工具链只读核对
  - 本合同及 sidecar 准备，不改测试、生产代码或历史状态
minimum_owner_decision:
  - 批准随 T072 修正明确的 package smoke 断言，并采用已核实基线；或明确拆分/延期
recommended_resume_point: 合同和权限获批后，从最新授权 dev 完成 preflight，再修断言并执行独立 package/smoke
```

## 14. 本轮授权与检查记录

| 日期 | owner 原始指令 | 生效范围 |
| --- | --- | --- |
| 2026-09-19 | “为我着手 T072 的开发，本步先同步当前状态，进行合同编写” | §5.1 合同准备、状态核对、非破坏性文档检查；不激活实施或继承 T071 的 Git/Provider 权限 |
| 2026-09-19 | “批准按合同进行开发，给予合同中所需git权限” | 激活 §5.2、§13.1 窄修复和基线采用；授权本任务 branch/worktree/commit/普通 push/Draft PR；不解除 docs closeout、人工、Ready、merge、release 门禁 |
| 2026-09-19 | “授权将 T072 任务差异发送至 Codex review 服务，进行独立只读审查” | 本任务差异的独立只读 Codex review 传输获准；不扩大产品 Provider、真实数据或其他外部写入权限 |

- 本轮开始时为干净 `dev@248350409927923016de18f7c5d967aa064964ca`；未创建 branch/commit/push/PR。
- GitHub dev、PR #55/#43/#49、对应 final-head runs 和 T071 post-merge run 已只读核对；`git merge-base --is-ancestor` 对 T806/T807 integration 均返回 0。
- 默认沙箱无法读取已有 gh 配置、无法使用批准的 npm 工具链；使用获准的只读命令环境后，实际 Node `24.18.0` / npm `11.16.0` 与基线一致，无安装/升级。初次 npm 调用未执行，不计为 metadata 失败或通过。
- 合同写入前 `npm.cmd run governance:metadata:check` 通过（19 sidecar / 1 Profile）；新增 sidecar 后再次通过（20 sidecar / 1 Profile）。
- `npm.cmd run format:check` 与 `node node_modules/prettier/bin/prettier.cjs --check docs/implementation/metadata/T072.json` 最终通过。sidecar 初次格式检查发现一个数组换行问题，已按仓库 Prettier 格式修正；没有执行全仓库格式写入。
- 本地只读结构检查核实 PRD 编号数量为 69 MUST / 11 SHOULD / 7 延期，MUST 分组完整；合同 15 个一级章节、4 个本地文件链接、sidecar 共享面路径、依赖、pending 状态、未声明 Profile 与未获 Git/外部权限一致。
- `git diff --check` 通过；对未跟踪新文件另作完整内容与空白检查。`git diff --no-index --check -- NUL <new-file>` 的内容差异退出码不视作产品测试失败或验收结果。
- 上述结果绑定 `248350409927923016de18f7c5d967aa064964ca` 加 §5.1 三个文件的 2026-09-19 未提交草案；未运行产品测试、打包或人工验收，未新增 Acceptance Evidence 的通过声明。完整改动自查完成，后续 Implementation Candidate 独立 review 仍未执行。

- 2026-09-28 owner 明确“人工验收均通过”；随后“批准上述文档收口、提交及推送”。记录当前候选 owner AC/UX 通过；批准本合同、证据、任务索引、追踪及 README/两份历史归档的精确收口，独立提交并推送；不授权 Ready/merge/release。

## 15. 文档收口与最终交接

实施中间记录：当前分支 `task/T072-demo-convergence`，未提交候选已完成本地完整 verify（255 unit、130 integration、30 E2E；另 live/package 各一项按配置 skip）、独立 package 与 unpacked/隔离 NSIS smoke（1/1），详见 EV-T072-001。独立 review 初次因源码传输授权缺失被自动审批拒绝；owner 随后明确授权，2026-09-19 的只读审查完成，无 actionable regression。后续实现提交 `a78a31f335b95296df9c942912aa79f8eb9f725d` 的 exact-source verify 与 hosted run `35421739454` full/milestone CI 均已通过。owner 于 2026-09-28 报告人工全部通过并批准文档收口；本次文档 final-head CI 推送后独立核对，详见 EV-T072-001 和 PR #56。

候选完成本地验证、独立 review、freshness 和 required candidate CI 后，先形成精确文档影响矩阵，按 Development Skill §10 获取 owner 的 docs closeout 授权；本合同批准不代替后续收口批准。

| 候选文档 | 需要核对的耐久事实 |
| --- | --- |
| 本合同 / sidecar / TASK_INDEX | 实际范围、完成条件、T072 状态与证据；不把 PR 每次 CI 状态复制进多个文档 |
| ACCEPTANCE_EVIDENCE | 69/11/7/AC 逐项结果、source/产物/run/revision、失败与 supersedes、独立 review、owner 人工、live/package 限制 |
| REQUIREMENTS_TRACEABILITY | 实际实现/断言位置与当前证据链接，不改变 FR 优先级或冻结含义 |
| README / Implementation Plan / Test Strategy | 仅在涉及耐久 Demo 能力、已批准阶段门、入口或实际测试落点时最小更新；没有变化则不改 |
| README / TASK_INDEX / Evidence / S4-S5 与 S6 archive 的历史漂移 | 列出精确段落，补充已核实 final-head/run/dev integration、区分旧候选与后续事实；不得删除失败历史、补造人工或直接批量签 done |
| `user/` 使用说明 | 仅在 owner 批准后作为派生说明同步实际能力、独立数据试用和导出限制；不作为本任务开发依据 |

纯文档 closeout 运行 metadata、format、链接/结构与 diff 检查；若涉及可执行行为或稳定命令，重跑所需回归。独立文档提交后最新 PR head 仍需本合同 §12 的 full/milestone CI；early/candidate/final-head 各自绑定 revision，不能互代。

最终中文报告包含改动文件、69/11/7 与 AC 覆盖、实际命令/环境/结果、分支/commit/PR/CI、产物校验值、人工状态、需求冲突或范围变化、已知限制及 G4 owner 待决定项。无有效后续工作时按 HANDOFF 交还控制权，不自动 Ready、merge、发布、开展真实自用或下一任务。

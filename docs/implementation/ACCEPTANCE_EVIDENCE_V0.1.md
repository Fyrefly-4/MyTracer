# MyTracer v0.1 验收证据

> 文档状态：证据账本已建立；尚无工程实现证据  
> 作用：记录可复核的命令、版本、环境、产物和人工观察  
> 禁止：用任务状态、测试名称、关键词存在或 Agent 自述替代实际结果

## 1. 证据原则

每条完成声明必须绑定到：

- 唯一 Evidence ID；
- Task ID、切片和需求编号；
- 被验证的确切 revision 或明确标识的工作树状态；
- 执行环境；
- 实际命令或人工步骤；
- 结果与关键输出摘要；
- 可定位的 CI、日志、截图或产物；
- 失败、跳过、未验证和 SHOULD 缺口。

以下内容单独不能证明完成：

- 计划中写了某个测试；
- 存在一个同名测试文件；
- 搜索到了需求编号；
- 本地单一命令通过但要求的平台或打包未验证；
- 较早 commit 或中间 CI 通过，但最终 revision 不同；
- Agent 表示“应当可用”。

## 2. Evidence ID

格式：

```text
EV-T001-001
EV-T013-002
EV-G2-001
EV-AC07-001
```

- `EV-Txxx-*`：任务级证据；
- `EV-Gx-*`：阶段门证据；
- `EV-ACxx-*`：跨任务验收场景证据。

Evidence ID 不复用。失败记录保留，并由后续记录明确引用修复和重新验证结果。

## 3. 证据记录模板

### EV-____

- **Status**：pass / fail / partial / superseded
- **Task / Gate**：
- **Requirements**：FR- / AC- / D- / ED-
- **Source branch**：
- **Source revision**：commit SHA，或 `uncommitted` + 记录时间
- **CI head/merge revision**：如适用
- **Environment**：OS、Node、Electron、数据库/fixture、关键工具版本
- **Command or manual procedure**：
- **Result**：
- **Artifacts**：CI URL、日志位置、截图、导出文件或安装包标识
- **Manual acceptance**：not-required / pending / pass / fail
- **Known limitations**：
- **Supersedes / superseded by**：
- **Recorded at**：YYYY-MM-DD

## 4. 任务级证据索引

| Evidence | Task | Revision | Scope | Result | Manual | Notes |
|---|---|---|---|---|---|---|
| — | — | — | 工程实现尚未开始 | — | — | 等待 T001 |

## 5. 阶段门证据索引

| Gate | Required scope | Evidence | Status | Owner acceptance |
|---|---|---|---|---|
| G1 设计就绪 | 架构、领域、数据、AI、测试、追踪 | `docs/architecture/` 最终基线 | pass | 已确认 |
| G2 工程就绪 | T001～T004 | — | pending | pending |
| G3 切片完成 | 各切片对应任务 | — | pending | pending |
| G4 Demo 就绪 | AC-01～AC-07、数据安全、已知限制 | — | pending | pending |
| G5 使用验证 | 7～14 天真实自用 | — | pending | pending |

G1 的设计结论不是代码、CI、Windows 打包或产品验收证据。

## 6. AC 证据索引

| AC | Automated evidence | Manual evidence | Status |
|---|---|---|---|
| AC-01 | — | — | pending |
| AC-02 | — | — | pending |
| AC-03 | — | — | pending |
| AC-04 | — | — | pending |
| AC-05 | — | — | pending |
| AC-06 | — | — | pending |
| AC-07 | — | — | pending |

## 7. CI 证据要求

CI 启用后，记录：

- workflow 和 job 名称；
- run URL 和 run ID；
- event、base、head SHA；
- 检查验证的是 PR head 还是测试 merge revision；
- required check 是否对应最新 revision；
- Windows runner、打包和原生 SQLite 是否实际执行；
- artifact 名称和校验信息（如适用）。

只有历史依赖验证需要完整 Git 历史时才把 checkout 配置为全历史，并在证据中说明原因；不要仅为了形式增加成本。

## 8. 人工验收要求

项目所有者至少亲自判断：

- Today 和快速记录是否足够轻；
- 文案是否中性且不制造失败压力；
- unknown、休息、partial 和达标是否可区分；
- 中断恢复是否减轻重新整理负担；
- AI 建议是否温和、相关、可编辑和可拒绝；
- 安装、重开、导出和真实 Windows 使用是否符合预期。

Agent 只提供步骤和观察位置，不得替项目所有者签署人工验收。

## 9. 当前结论

- G1 架构基线已批准。
- 没有工程 revision、CI run、Windows 包或 AC 执行结果。
- 下一条工程证据必须来自 T001 或其经批准的前置依赖/环境验证任务。

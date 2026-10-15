# MyTracer Stage Design 模板

> 流程启用边界：仅用于 owner 明确要求的阶段设计流程。普通设计或维护请求不自动创建阶段、合同或任务图；查阅本模板不构成启用依据。 以根目录 [AGENTS.md](../../AGENTS.md) 为准。

> 用途：为一个阶段固定批准基线，并只描述该阶段新增、改变、受影响或需要重新确认的内容。
>
> 本模板可以用 Markdown 表达；示例中的 YAML 仅用于固定字段含义，不要求引入 YAML parser。

## 1. Stage information

- **Stage**：S_
- **Title**：
- **Status**：draft / approved / historical
- **Owner approval**：
- **Target branch**：`dev`
- **Prior behavior revision**：`dev@<revision>`

## 2. Baseline manifest

```yaml
baseline:
  product_requirements:
    file: docs/PRODUCT_REQUIREMENTS_V0.1.md
    version: v0.1
  decisions:
    file: docs/DECISIONS.md
    revision_or_date: <revision-or-date>
  architecture_documents:
    - docs/architecture/ARCHITECTURE_V0.1.md
    - docs/architecture/DOMAIN_MODEL_V0.1.md
    - docs/architecture/DATA_DESIGN_V0.1.md
    - docs/architecture/TEST_STRATEGY_V0.1.md
  prior_behavior_revision: dev@<revision>
```

Baseline 是本阶段的输入边界。若基线文件或 prior behavior revision 改变，必须重新评估受影响任务和验收。

## 3. Stage delta

### 3.1 Goal and observable outcomes

- 阶段目标：
- 用户或系统可观察结果：
- 本阶段明确非范围：

### 3.2 New or changed behavior

- 新增领域行为：
- 改变或扩展的领域行为：
- 改变或扩展的数据行为：
- 受影响的历史事实和数据守恒：
- 与上一阶段的兼容性约束：

### 3.3 Interfaces

- 新增或兼容扩展的 Application 命令/Query：
- 新增或兼容扩展的 IPC/DTO：
- 受影响的 Renderer/Main boundary：
- 受影响的数据库表、migration 或 export contract：

## 4. Task graph and shared surface

```yaml
tasks:
  requires: []
  blocks: []
  can_parallel: []
  prefer_after: []
  conflicts_with: []

shared_surfaces:
  - files: []
    modules: []
    schema_tables: []
    ipc_contracts: []
    domain_invariants: []
    risk: low
    integration_policy: serial
```

`conflicts_with` 必须有共享文件、schema、接口或领域不变量作为依据。机器可检查字段只辅助调度，不取代人工架构判断，也不自动授予并行权限。

## 5. Invariants and local risks

引用的稳定不变量：

-

本阶段最容易破坏的局部边界：

-

## 6. Validation and stage gate

- 阶段特有单元/集成验证：
- 连续 E2E 场景：
- Windows/package/restart/migration/export 验证：
- 项目所有者人工验收步骤：
- 阶段门通过条件：
- 必须保留的失败、跳过和限制证据：

人工验收不能由自动化测试替代。阶段最终审计必须绑定同一个 `stage_final_integration_revision`。

## 7. Risks, stop conditions, and authorization

### Risks

- 产品语义：
- 数据与历史守恒：
- 兼容性与集成：
- 测试与证据：

### Stop conditions

- 需求、决定或 MUST/AC 冲突；
- 需要改变冻结状态、日期、删除、AI 或确认语义；
- 需要未批准依赖、migration、权限或外部写入；
- 无法在最终 dev revision 上完成可靠阶段验收。

### Required authorization

- 需求/产品决定变化：
- 依赖或 migration：
- Git branch/commit/push/PR：
- Ready/merge/tag/release：
- 人工验收与阶段门：

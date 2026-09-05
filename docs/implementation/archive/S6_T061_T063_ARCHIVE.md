# MyTracer S6 / T061～T063 开发合同归档

> 状态：已归档；三个任务均已进入 `dev@f06b1e97da07dffc05814518ad8ad83ed3e051b9`，项目所有者已报告完整人工 AC-02 与真实 MyTracer UI + LiteLLM 体验通过；T807 聚合 PR #49 的文档 final-head hosted CI、Ready 与 merge 仍为后续 Gate
>
> 归档日期：2026-09-05

## 1. 权威边界

- 本文是 T061、T062、T063 的精简归档，不是新需求、架构决定、Provider 权限或实现授权。
- 冻结需求、`DECISIONS.md`、工程决定和已批准的 `S6_AI_START_HELP_DESIGN_V0.1.md` 高于本文；任务状态与证据分别以 Task Index 和 Evidence 账本为准。
- 项目所有者已授权删除三份原合同；完整文本可从固定产品 source、对应 task final head 或 PR #46～#48 恢复。
- 本归档不授权扩大 AI 上下文、自动重试、长期记忆、跨 Goal 分析、S7、Ready、merge、`dev → main` PR、tag 或 Release。

## 2. 最终交付索引

| Task | 最终范围 | Task delivery / final task head | PR / dev integration | Evidence |
|---|---|---|---|---|
| T061 / E6-01 | 最小上下文 Query/selector、Main-only manifest、显式触发和隔离证明 | `5f98b2f61026721f22fe6cd627c3b402678e9a93` / `d60978917546f6547a1615c6aa03e87d08c0d2ce` | [PR #46](https://github.com/Fyrefly-4/MyTracer/pull/46) / `4630878dacd0a15dbe8446cb26d9cea790d3ed6e` | `EV-T061-001` |
| T062 / E6-02 | 可替换 LiteLLM Provider、Main-only 配置/凭据/网络、严格响应验证、取消/超时/失败降级 | `bc5461e3bcc4e0ca94abbffe9ef2f898c7bbc4a9` / `a458171be3504492a5c581b595f272c1e1e0e097` | [PR #47](https://github.com/Fyrefly-4/MyTracer/pull/47) / `233d6790c6c5e11bb454b22eb027443eef54a01e` | `EV-T062-001` |
| T063 / E6-03 | 临时建议状态机、接受/编辑/拒绝/关闭/retry、普通确认 Commands、原子 current-next 与逐项 Understanding | `fee398e08ef687bd75d9dae10e6254f09e7c9896` / `2e3fc746fcafbe67a0c4a3bc24671e6a50c2ac94` | [PR #48](https://github.com/Fyrefly-4/MyTracer/pull/48) / `f06b1e97da07dffc05814518ad8ad83ed3e051b9` | `EV-T063-001` |

三个 final task head 与对应 squash integration revision 的内容树一致。S6 固定产品 source 与 `stage_final_integration_revision` 均为 `f06b1e97da07dffc05814518ad8ad83ed3e051b9`；T807 测试、安全修复、文档 revision、GitHub test-merge 或后续发布 revision 不替代该产品 revision。

## 3. AI 信任与数据隔离边界

- 只有用户在 Today Action 中主动触发才构建请求；启动、导航、查询和未触发状态为零 Provider 调用。
- Provider-facing DTO 只含本次输入、当前 Goal、打开 Action/不同的 current-next、locale，以及同 Goal 下按稳定顺序选择的最多 5 条直接相关 ActionRecord；不含持久化 ID、内部 manifest、其他 Goal、RoutineRecord、ReviewResult、凭据、日志或完整数据库。
- Provider、SDK、网络、环境变量、safeStorage 和独立 AI 配置文件仅位于 Electron Main/Infrastructure。Renderer/Preload 不接触 SDK、密钥、SQLite、Repository、任意网络或任意 IPC。
- Provider 不获得 Repository、UnitOfWork 或 Application Command。prompt、response、draft、session、manifest 和编辑历史只存在于 Main/Renderer 内存，不写 SQLite、导出或日志。
- AI disabled、not-configured、credential unavailable、timeout、cancelled、invalid response 或 Provider failure 时，Goal、Action、Record、Progress、Recovery、Review、delete、export 和重开继续工作。

## 4. 确认与核心写入边界

- 1～3 条建议保持临时；未确认、编辑未提交、拒绝、关闭、取消、超时、非法响应、stale、失败和 retry 中间态均为零核心写入。
- Action 仅在用户确认最终文本后调用普通 `CreateAndSetGoalCurrentNextAction`；同一事务创建当前 Goal 的 pending Action 并设为 current next，不自动加入 Today。
- Understanding 只能由用户逐项确认到本次 Main-only manifest 中仍合法的既有 ActionRecord，source 固定为 `ai_candidate_confirmed`；无合法 Record 时不虚构记录，也不表达自动掌握。
- 原 Action、Today selection、Routine 五态、历史 ActionRecord/Understanding/Confusion、Recovery 和 ReviewResult 不被 AI 自动完成、取消、删除、重排或改写。
- 关闭并重开后只保留用户已确认的普通核心事实；AI 会话和对话历史不恢复。

## 5. 聚合验证、人工结果与限制

- T061～T063 的本地、hosted candidate/final-head/post-merge、历史失败与 supersede 关系保留于 `EV-T061-001`～`EV-T063-001`；S6 聚合事实记录于 `EV-T807-001`。
- T807 固定产品 source 的 continuous AC-02、受影响 AC-01/03/04/05/06/07、完整 `verify`、Windows package、unpacked/隔离 NSIS smoke、安全边界与独立 review 已通过。PR #49 head `449ad4f36ffbace59e19f55c53fa4ce9dcb02b4c` 的 hosted run [`33599620345`](https://github.com/Fyrefly-4/MyTracer/actions/runs/33599620345) 全部门禁通过；test-merge 为 `5f56e2cea60243e003436e97976bd5d22d7423ba`。
- 项目所有者于 2026-09-05 报告人工测试和验收通过，确认当前相关功能符合要求；该结果绑定未再发生产品语义变化的固定 S6 内容和 T807 边界修复内容。
- 项目所有者另行授权并完成真实 MyTracer UI + LiteLLM 体验，结果为通过。专用 `test:ai-contract` 自动尝试因 Vitest 默认 5 秒 harness timeout 退出 1；该事实不证明 Provider 失败，也不记为自动 live contract 通过。未记录 API key、Provider request/response 或真实用户数据。
- schema 保持 v3、export 保持 v2，S6 无 migration 或 AI 核心表。Windows 包未签名并仍使用默认 Electron 图标。
- T807 文档 final-head CI、PR #49 Ready/merge、`dev → main`、候选版本 `v0.1.0-beta.3`、tag 和 Release 均为独立后续 Gate。

## 6. 原合同恢复入口

```powershell
git show f06b1e97da07dffc05814518ad8ad83ed3e051b9:docs/implementation/T061_AI_MINIMAL_CONTEXT.md
git show f06b1e97da07dffc05814518ad8ad83ed3e051b9:docs/implementation/T062_AI_PROVIDER_DEGRADATION.md
git show f06b1e97da07dffc05814518ad8ad83ed3e051b9:docs/implementation/T063_AI_SUGGESTION_CONFIRMATION.md
```

历史合同中的候选、Draft、Ready、merge、Provider 和逐文件执行权限仅供审计，不再作为当前开发授权。

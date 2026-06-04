# AGENTS 指南

## 1. AGENTS.md 是什么

`AGENTS.md` 是这个仓库面向 AI 协作的第一层执行协议。它不只是补充文档，而是告诉 Codex：

- 进入仓库后先读什么
- 哪些规则优先级最高
- 哪类任务该触发哪个 skill
- 哪些目录才是本次任务真正应该工作的地方

在 `infoq-scaffold-ai` 中，`AGENTS.md` 的目标不是“写很多解释”，而是用尽量短的索引行，把高优先级规则稳定放进上下文。

## 2. 当前分层方式

本仓库现在是六层入口：

- 根规则：`/AGENTS.md`
- 后端：`infoq-scaffold-backend/AGENTS.md`
- React 管理端：`infoq-scaffold-frontend-react/AGENTS.md`
- Vue 管理端：`infoq-scaffold-frontend-vue/AGENTS.md`
- React 小程序端：`infoq-scaffold-frontend-weapp-react/AGENTS.md`
- Vue 小程序端：`infoq-scaffold-frontend-weapp-vue/AGENTS.md`

原则只有一条：**越靠近代码越优先**。

## 3. AGENTS.md 里应该放什么

适合放进 `AGENTS.md` 的内容：

- 全局工程规则
- acceptance contract 约束
- 默认验证顺序
- OpenSpec 路由
- active change 结构校验要求
- skill 路由与优先级
- 本工作区最关键的命令和边界

不适合堆进 `AGENTS.md` 的内容：

- 详细 SOP
- 冗长背景解释
- 大量示例代码
- 低频参考资料

这些内容更适合放进 `doc/` 或 skill `references/`。

## 4. 当前仓库对 AGENTS 的补充约束

### 根 AGENTS

根 `AGENTS.md` 只保留跨仓规则，并额外承担几类治理职责：

- skill 命名与路由真相
- skill 元数据约束真相
- `OpenSpec` 分级路由
- `openspec-check` 与 `doc/plan/` 的治理要求
- 文档同步约束
- 临时产物目录约束

其中仓库内工具、skill、脚本、验证过程新增的临时文件、临时目录、调试输出和一次性运行产物，默认统一放在 `doc/tmp/` 下，便于后续集中清理。只有在外部工具强制要求其他位置时才允许例外，并且需要显式说明原因。

另一个新增约束是：仓库级 skill 的主执行入口必须兼容 Windows / macOS / Linux。统一使用 repo-owned Node CLI 或 `.mjs` 入口；不再保留 `.sh` / `.ps1` / `.cmd` 作为 skill 入口。若内部仍需 Python 等实现，必须由跨平台 Node 入口调度。

像 `.codex/scripts/`、`.codex/lib/` 这类实现层清单，不要求直接展开到根 `AGENTS.md`；它们的真值边界分别留在 `doc/collaboration/mcp-servers.md` 与 `doc/collaboration/skills-guide.md` 维护。

### 工作区 AGENTS

更近的 `AGENTS.md` 负责：

- 技术栈与命令
- 测试边界
- 运行态验证入口
- 本工作区不能误用的其他栈规则

### 文档同步

一旦改了以下任何一项，必须同步文档：

- skill 名称
- skill 路径
- 工作区启动命令
- build-open 或 DevTools 前置条件
- env 前置条件
- `.codex/config.toml` 中的 MCP server 名称、启用状态、`enabled_tools`、审批模式或超时设置

至少要同步：

- `/AGENTS.md`
- 相关工作区 `AGENTS.md`
- `README.md`
- 受影响的 `doc/*.md`

其中 MCP 相关变更还要额外满足两条：

- `.codex/config.toml` 是仓库级 MCP 真值源，`doc/collaboration/mcp-servers.md` 只能描述它当前显式配置出来的内容
- 如果文档里出现 MCP server / tool 名称、默认启用状态、只读范围、审批模式或本地启动脚本路径，这些字段必须和 `.codex/config.toml`、`.codex/scripts/*` 保持逐项一致

## 5. AGENTS 与 skill 的关系

可以把两者理解成两层系统：

1. `AGENTS.md` 决定“该遵守什么规则”和“该触发什么能力”
2. `.codex/skills` 决定“这类任务具体怎么做”

在这个仓库里，两者必须一起维护。只改 skill 不改 `AGENTS.md`，或者只改 `AGENTS.md` 不改文档，最后都会产生路由漂移。

当前还多一层约束：

- 仓库级 skill 默认维护 `agents/openai.yaml`
- 更新 `SKILL.md` 时，要一起检查 `agents/openai.yaml` 是否 stale
- `default_prompt` 必须显式包含对应的 `$skill-name`

## 6. AGENTS 与 `.codex/agents` 的关系

repo 级 custom agents 的真值不写在 `AGENTS.md` 之外的任意散落文档里，而是由两处一起定义：

1. 根 `AGENTS.md` 负责说明何时使用 subagents、默认依赖顺序和主线程职责
2. `.codex/agents/*.toml` 负责定义每个 custom agent 的真实名称、职责边界和 developer instructions

当前仓库只保留 4 个 repo 级 custom agents：

- `requirements_expert`
- `technical_designer`
- `code_implementer`
- `auto_fixer`

以下职责默认回到主线程，而不是继续保留独立 custom agent：

- `design.md`：按需维护；重大 UI/UX 任务优先走 `infoq-ui-ux-three-phase-protocol`
- `materials.md`：确有 copy、mock data、图标建议价值时再写
- 最终验收与 blocker 总结：主线程基于真实验证证据完成，必要时再写 `review.md`

## 7. 当前 skill 路由策略

当前仓库采用的是“家族 skill + 客户端 references”的策略：

- 后端单测与回归补测：`infoq-backend-unit-test-patterns`
- 后端接口与运行态冒烟：`infoq-backend-smoke-test`、`infoq-login-success-check`
- 真实验证码管理端 E2E：`infoq-admin-e2e-captcha-verification`
- 管理端 Web 自动化测试矩阵：`infoq-admin-web-test-case-generator`
- 管理端 CRUD E2E 模式：`infoq-admin-crud-e2e-patterns`
- React 家族运行态验证：`infoq-react-runtime-verification`
- Vue 家族运行态验证：`infoq-vue-runtime-verification`
- React 家族单测：`infoq-react-unit-test-patterns`
- Vue 家族单测：`infoq-vue-unit-test-patterns`
admin 和 weapp 的差异留在 skill 的 `references/admin` 与 `references/weapp`，真实验证码管理端 E2E 通过独立 skill 保持“验证码 + 登录 + 动态路由 smoke”边界清晰，管理端 Web 自动化测试矩阵和 CRUD E2E 模式也分别保持“范围生成”和“写入型模式设计”的边界，而 backend 测试 / smoke 则通过独立 skill 保持边界清晰，不重新拆共享底座。

## 8. AGENTS 什么时候需要更新

适合更新 `AGENTS.md` 的情况：

- 新增或删除了仓库级 skill
- 旧 skill 被合并、改名或迁移
- repo 级 custom agent 被新增、删除或调整职责
- 栈内验证顺序发生变化
- 小程序启动前置条件发生变化
- `.codex/config.toml` 中的仓库级 MCP 路由或默认启用集合发生变化
- 发布或回滚规则发生变化

不适合继续堆进 `AGENTS.md` 的情况：

- 解释“为什么这么设计”的长段背景
- 某类任务的完整 SOP
- 历史方案对比
- 与当前仓库无直接关系的通用教程

## 9. 相关入口

- 顶层规则文件：`/AGENTS.md`
- repo 级 custom agents：`/.codex/agents/`
- skill 指南：`./skills-guide.md`
- subagents 使用指南：`./subagents-guide.md`
- 项目静态参考：`../.codex/skills/infoq-project-reference/references/project-reference.md`
- 压缩维护 skill：`../.codex/skills/infoq-agents-md-compress/SKILL.md`

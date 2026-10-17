# AI 协作规范

本文件是仓库 AI 协作规则的总说明，合并了 AGENTS 指南、Subagents 指南、研发工作流与模块文档治理四份文档。规则正文与根 `AGENTS.md` 冲突时，以 `AGENTS.md` 为准；本文件解释"为什么"与"怎么做"。

## 1. AGENTS.md 是什么

`AGENTS.md` 是这个仓库面向 AI 协作的第一层执行协议。它不只是补充文档，而是告诉 Codex：

- 进入仓库后先读什么
- 哪些规则优先级最高
- 哪类任务该触发哪个 skill
- 哪些目录才是本次任务真正应该工作的地方

在 `infoq-scaffold-ai` 中，`AGENTS.md` 的目标不是"写很多解释"，而是用尽量短的索引行，把高优先级规则稳定放进上下文。

### 1.1 当前分层方式

- 根规则：`/AGENTS.md`
- 后端：`backend/AGENTS.md`
- React 管理端：`frontend-react/AGENTS.md`
- Vue 管理端：`frontend-vue/AGENTS.md`

原则只有一条：**越靠近代码越优先**。

### 1.2 AGENTS.md 里应该放什么

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

这些内容更适合放进 `docs/` 或 skill `references/`。

### 1.3 根 AGENTS 与工作区 AGENTS 的职责

根 `AGENTS.md` 只保留跨仓规则，并额外承担几类治理职责：

- skill 命名与路由真相
- skill 元数据约束真相
- `OpenSpec` 分级路由
- `openspec-check` 的治理要求
- 文档同步约束
- 临时产物目录约束

其中仓库内工具、skill、脚本、验证过程新增的临时文件、临时目录、调试输出和一次性运行产物，默认统一放在 `tmp/` 下，便于后续集中清理。只有在外部工具强制要求其他位置时才允许例外，并且需要显式说明原因。

另一个约束是：仓库级 skill 的主执行入口必须兼容 Windows / macOS / Linux。统一使用 repo-owned Node CLI 或 `.mjs` 入口；不再保留 `.sh` / `.ps1` / `.cmd` 作为 skill 入口。若内部仍需 Python 等实现，必须由跨平台 Node 入口调度。

像 `tools/`、`tools/lib/` 这类实现层清单，不要求直接展开到根 `AGENTS.md`；它们的真值边界分别留在 `docs/MCP-SERVERS.md` 与 `docs/SKILLS.md` 维护。

更近的 `AGENTS.md` 负责：

- 技术栈与命令
- 测试边界
- 运行态验证入口
- 本工作区不能误用的其他栈规则

### 1.4 AGENTS 与 skill 的关系

可以把两者理解成两层系统：

1. `AGENTS.md` 决定"该遵守什么规则"和"该触发什么能力"
2. `skills` 决定"这类任务具体怎么做"

在这个仓库里，两者必须一起维护。只改 skill 不改 `AGENTS.md`，或者只改 `AGENTS.md` 不改文档，最后都会产生路由漂移。

当前还多一层约束：

- 仓库级 skill 默认维护 `agents/openai.yaml`
- 更新 `SKILL.md` 时，要一起检查 `agents/openai.yaml` 是否 stale
- `default_prompt` 必须显式包含对应的 `$skill-name`

### 1.5 AGENTS 与 `.codex/agents` 的关系

repo 级 custom agents 的真值不写在 `AGENTS.md` 之外的任意散落文档里，而是由两处一起定义：

1. 根 `AGENTS.md` 负责说明何时使用 subagents、默认依赖顺序和主线程职责
2. `.codex/agents/*.toml` 负责定义每个 custom agent 的真实名称、职责边界和 developer instructions

当前仓库只保留 4 个 repo 级 custom agents：

- `requirements_expert`
- `technical_designer`
- `code_implementer`
- `auto_fixer`

以下职责默认回到主线程，而不是继续保留独立 custom agent：

- `design.md`：按需维护；重大 UI/UX 任务优先走 `docs/DELIVERY-WORKFLOW.md` 的四阶段 UI 门禁
- `materials.md`：确有 copy、mock data、图标建议价值时再写
- 最终验收与 blocker 总结：主线程基于真实验证证据完成，必要时再写 `review.md`

### 1.6 AGENTS 什么时候需要更新

适合更新 `AGENTS.md` 的情况：

- 新增或删除了仓库级 skill
- 旧 skill 被合并、改名或迁移
- repo 级 custom agent 被新增、删除或调整职责
- 栈内验证顺序发生变化
- `.codex/config.toml` 中的仓库级 MCP 路由或默认启用集合发生变化
- 发布或回滚规则发生变化

不适合继续堆进 `AGENTS.md` 的情况：

- 解释"为什么这么设计"的长段背景
- 某类任务的完整 SOP
- 历史方案对比
- 与当前仓库无直接关系的通用教程

## 2. 研发协作与工作流

本仓库的重点不是"命令很多"，而是把规则、脚本、验证和文档收敛到同一条可复现交付链路里。

### 2.1 先确认真值来源

| 主题 | 真值文件 |
| --- | --- |
| 协作规则 | `AGENTS.md` 与更近工作区 `AGENTS.md` |
| 仓库级 skill | `skills/*/SKILL.md` |
| 规格与变更 | `openspec/config.yaml`、`docs/specs/`、`openspec/changes/`（本地） |
| MCP 配置 | `.codex/config.toml` |
| 项目文档 | `README.md` 与 `docs/*.md` |

`AGENTS.md` 负责约束"如何工作"；`docs/` 负责说明"项目是什么、如何使用、如何验证"。

### 2.2 OpenSpec 分级

| 级别 | 适用场景 | 要求 |
| --- | --- | --- |
| L3 强制 | 新功能、API 契约变更、跨工作区交付 | 在 `openspec/changes/<change-id>/` 初始化 change，维护全套工件，本地通过 `openspec-check` |
| L2 Lite | 单工作区行为变更，不改 API 契约 | 至少 `proposal.md` + `tasks.md`，交付前通过 `openspec-check` |
| L1 可豁免 | 小修复、不改契约、范围很小 | 可不建 change，但必须先写 acceptance contract |

不确定时按更高一级处理。

`openspec/changes/` 是本地计划脚手架：不提交、不进 PR；耐久行为必须落到
`docs/`（规格真值在 `docs/specs/`）与自动化测试。规格真值位于
`docs/specs/<capability>/spec.md`；`openspec/config.yaml` 提供 schema 与项目
上下文；`openspec/examples/demo-change/` 是 change 模板。

### 2.3 默认执行顺序

修改前：

1. 读取相关工作区规则和仓库文件。
2. 明确 acceptance contract。
3. 若本次使用 active change，先补 `proposal.md` / `tasks.md` 并执行 `openspec-check`。
4. 不靠记忆假设项目结构、脚本名或环境。

修改中：

1. 一次只改一类问题。
2. 优先最小闭环，不绑无关重构。
3. `tasks.md` 默认显式评估 backend、React admin、Vue admin、docs、script/deploy。
4. 任何命令、环境变量、skill 入口或 MCP 配置变更，都要同步更新 `README.md` 与 `docs/*.md`。

修改后，验证顺序固定为：

1. `main-flow verification`
2. `targeted tests`
3. `lint/build or equivalent checks`
4. `diff review`

说明：`openspec-check` 是 active change 的结构前置校验，不替代上述运行态或构建验证。

### 2.4 Backend Maven 预检

backend 工作区基线是 JDK 21 与 Maven 3.9.x。

- 后端 Maven 命令优先使用 `node tools/backend_mvn.mjs -- ...`，该入口优先读取 `.idea` 项目配置，并在配置不可用时搜索本机 JDK 21 与 Maven 3.9.x。
- 如果必须直接使用 `mvn`，先确认 `java -version` 指向 Java 21，且 `mvn -version` 指向 Maven 3.9.x 与 Java 21。
- 不允许在错误 JDK 下继续碰运气编译，然后把失败误判为代码问题。

### 2.5 skills 与 MCP 的配合

`skills` 负责把高频任务沉淀成仓库内 SOP；`MCP` 负责补充交互探索或深度诊断能力。

仓库级 skill 是 CLI 型可执行 SOP：只保留 5 个工作域（`test-cli`、`compress-cli`、`push-cli`、`release-cli`、`deploy-cli`），域内用子命令或 mode 表达子场景。维护时优先重构现有 skill，不为域外能力新增 skill。标准执行顺序是：判定范围 -> 只读探测/预览 -> 目标与影响枚举 -> 写入或危险动作门禁 -> 执行验证 -> `tmp/` 证据留存与显式失败。

当前默认组合：

- Web 测试、浏览器自动化、管理端 E2E、前端单测/构建/运行态：`test-cli`
- 推送、PR 创建/复用、校验回流与受控合并：`push-cli`
- 版本核对、tag 与 GitHub Release：`release-cli`
- AGENTS.md 压缩与路由一致性校验：`compress-cli`
- 本机部署、Apple container / WSL2 Docker / Linux Docker 运行态与 smoke：`deploy-cli`
- 后端登录、smoke、集群与单测验证：`tools/verify/`（SOP 见 `tools/verify/README.md`）
- SQL、数据库、Redis、数据修复、迁移和一致性核对：`docs/DATA-OPS.md`
- 交付门禁、OpenSpec 与插件治理：`docs/DELIVERY-WORKFLOW.md`；部署脚本与运行时矩阵：`deploy/VERIFICATION.md`、`deploy/runtime-matrix.md`
- 组件选型与组件 API 核验：`docs/DESIGN.md`「组件选型与 API 核验」
- OpenAI / Codex / AGENTS / MCP 问题：`openai-docs`（本机/系统 skill，不作为项目级 MCP 固定配置）
- 前端深度调试：`chrome-devtools`

说明：

- `playwright-cli` 与 `chrome-devtools-cli` 是仓库内跨平台 CLI，位于 `skills/test-cli/scripts/`。
- `playwright-cli admin-route-probe` 遇到后端 `captchaEnabled=true` 时，会自动调用 `skills/test-cli/scripts/captcha_login.mjs` 识别验证码并获取真实 token。
- `playwright` MCP 用于临时交互探索。
- `chrome-devtools` MCP 用于 Network / Console / Performance 深度诊断。
- 不要回退到任何历史浏览器入口。

### 2.6 文档何时必须同步

出现以下变化时，不能只改代码：

- 启动命令变了
- 浏览器自动化主入口变了
- 环境变量或前置条件变了
- MCP server / tool / 审批模式 / 超时变了
- skill 名称或默认行为变了
- 文档目录结构或规格真值位置变了

至少要同步：

- `/AGENTS.md`
- 相关工作区 `AGENTS.md`
- `README.md`、`README_CN.md`
- 受影响的 `docs/*.md`

其中 MCP 相关变更还要额外满足两条：

- `.codex/config.toml` 是仓库级 MCP 真值源，`docs/MCP-SERVERS.md` 只能描述它当前显式配置出来的内容
- 如果文档里出现 MCP server / tool 名称、默认启用状态、只读范围、审批模式或本地启动脚本路径，这些字段必须和 `.codex/config.toml`、`tools/*` 保持逐项一致

根文档更新后执行 UTF-8 与链接引用检查：

```bash
node tools/validate_utf8.mjs README.md docs
rg -n 'infoq-scaffold-(backend|frontend-vue|frontend-react)' README.md docs
```

### 2.7 核心原则

- retrieval-first：先读仓库，再下判断
- explicit failure：宁可显式失败，不做静默 fallback
- smallest useful change：优先最小闭环
- evidence-based verification：用命令输出、截图、日志和构建结果说话
- docs as delivery asset：文档是交付物的一部分，不是附属品

### 2.8 工程标准与代码度量

根 `AGENTS.md` 已压缩承载失败策略、工程基线、acceptance contract、安全、测试、执行流程与发布护栏；本节补充仓库内没有其他落点的度量与解耦标准，其余条款不在 `docs/` 重复第二份。

代码度量（建议值，超出时先确认是否有明确业务理由）：

- 函数长度：非空行建议不超过 50，超出时拆分辅助函数。
- 文件规模：建议不超过 300 行，超出时按职责拆分。
- 嵌套深度：建议不超过 3 层，优先 guard clause / early return 拉平控制流。
- 位置参数：建议不超过 3 个，超过时使用 options 对象。
- 圈复杂度：单函数建议不超过 10，超出时拆分分支逻辑。
- 禁止魔法数字：对非显然常量提取具名常量。

解耦与状态：

- 业务逻辑优先依赖注入；参数、接口、适配器能提升可测性与可演进性时，避免硬绑定具体实现。
- 在可行场景优先不可变：使用 `const`、`readonly`、不可变结构与拷贝返回，避免修改入参或共享全局状态。
- 除非修改入参是显式 API 契约，否则禁止修改函数参数。

## 3. Subagents 使用指南

### 3.1 什么是 Subagents

multi-agent 的价值不是"多开几个 agent"，而是把高噪声、边界清晰的任务交给专门的子 agent，让主线程只保留需求、约束、决策和最终结论。

在本仓库里，subagents 围绕一个 OpenSpec change 做最小闭环分工：

1. 需求与规格澄清
2. 技术任务拆解
3. 代码实现
4. 自动修复与验证
5. 主线程验收

### 3.2 当前主流程

- 项目级上下文：`openspec/config.yaml` 的 context
- 规格真值：`docs/specs/`
- 活跃变更目录：`openspec/changes/<change-id>/`（本地，不提交）
- 统一入口文档：`docs/DELIVERY-WORKFLOW.md` 与 `docs/OPENSPEC-WORKFLOW.md`
- repo 级 custom agents 真值：`.codex/agents/`

### 3.3 当前可用的专家

| Agent | 责任 |
| --- | --- |
| `requirements_expert` | 分析需求，输出 `proposal.md` 和 spec delta |
| `technical_designer` | 输出 `tasks.md`，明确 backend/admin、docs 和 script/deploy 实现矩阵和验证命令 |
| `code_implementer` | 依据 `proposal.md`、`design.md`、`tasks.md` 和 spec delta 落代码 |
| `auto_fixer` | 运行验证并修复真实错误 |

### 3.4 一次标准使用流程

change id 推荐格式为 `verb-noun`，例如 `enhance-user-import`。

```bash
node tools/init_change_dir.mjs enhance-user-import
node tools/openspec_check.mjs enhance-user-import
```

推荐提示词：

```text
请使用 docs/DELIVERY-WORKFLOW.md 工作流处理这个需求。
change id: enhance-user-import

要求：
1. spawn requirements_expert 生成 proposal.md 和 spec deltas
2. spawn technical_designer 生成 tasks.md
3. 如涉及明显 UI/交互决策，主线程先补 design.md，或改走 docs/DELIVERY-WORKFLOW.md 的四阶段 UI 门禁
4. spawn code_implementer 按计划实现 backend、React/Vue admin、docs 和 script/deploy 需要改动的部分
5. spawn auto_fixer 跑相关验证并修复真实问题
6. 主线程基于验证证据做最终验收；必要时写 review.md 记录 blocker
```

推荐执行顺序：

```text
requirements_expert
  -> technical_designer
    -> code_implementer
      -> auto_fixer
        -> parent-agent acceptance
```

### 3.5 Active Change 应该怎么写

`proposal.md` 必须说清楚：背景与问题陈述、核心业务目标与成功指标、用户角色与场景、本次范围与非目标、约束与延期范围、验收契约、风险与阻塞与待确认问题。

`design.md` 只在需要时创建，必须说清楚：页面或交互入口、布局结构、用户操作流程、加载/空态/错误态/无权限态、对 backend、React/Vue admin、docs 和 script/deploy 的设计约束。

`tasks.md` 必须说清楚：backend、React admin、Vue admin、docs、script/deploy 的实现矩阵；哪些端不改以及原因；验证命令；观测点、日志与回滚条件。

spec delta 放在 `openspec/changes/<change-id>/specs/<capability>/spec.md`；变更交付时应用到 `docs/specs/<capability>/spec.md`。

### 3.6 多工作区闭环要求

本仓库的 subagent 工作流默认评估六个交付面：

- `backend`
- `frontend-react`
- `frontend-vue`
- `docs`
- `script / deploy`
- `skills`（受影响时）

这不代表每个需求都必须同时改完所有交付面，而是：

- 每个需求都必须显式评估统一交付面是否受影响
- 如果不改某一端，必须在 `tasks.md` 里写出理由
- 不允许"默认跳过某个端但文档里不说明"

### 3.7 验证与归档要求

建议按以下顺序验证：

1. 主流程验证
2. 针对性测试
3. lint/build
4. diff review

按工作区最低建议：

- Backend：受影响模块 Maven 测试与必要编译
- React Admin：`pnpm run test`、`pnpm run build:prod`
- Vue Admin：`pnpm run test:unit`、`pnpm run build:prod`

只有在验证证据充分时，主线程才应该决定是否归档；如验证受阻，再按需写 `review.md` 明确 blocker。注意 `openspec/changes/` 不提交，归档的耐久沉淀是 `docs/specs/` 与 `docs/plan/`。

## 4. 模块文档分层治理规范

本文档用于约束仓库内各工作区的模块文档如何分层、如何聚合、何时同步，目标不是"把所有细节写成百科全书"，而是让人和 AI 都能按稳定路径找到最接近代码的真值，减少误判和文档漂移。

### 4.1 适用范围

适用于存在明显层级拆分的工作区，例如 `backend`、`frontend-react`、`frontend-vue`。如果某个工作区内部还分为父模块与叶子模块，这份规范优先采用"叶子真值 -> 父层聚合 -> 工作区总览 -> AGENTS 路由"的结构。

### 4.2 核心结论

更利于 AI 理解项目的方式，不是只维护一份顶层总览，也不是把所有说明堆进一个 README，而是分层治理：

1. 叶子模块文档负责写真值，直接贴近代码。
2. 父模块文档负责聚合子模块职责、依赖方向和调用关系。
3. 工作区顶层文档负责总览、阅读路径和关键架构 / 数据流摘要。
4. 工作区 `AGENTS.md` 负责把这些文档注册成稳定的检索入口，而不是重复承载文档正文。

### 4.3 推荐分层

| 层级 | 推荐位置 | 主要职责 |
| --- | --- | --- |
| 叶子模块文档 | 叶子模块目录下的 `README.md` 或 `doc/*.md` | 描述当前实现、入口、依赖、配置、关键数据流、日志/监控切入点 |
| 父模块聚合文档 | 父模块目录下的 `README.md` 或 `doc/*.md` | 梳理子模块边界、依赖方向、调用关系、公共约束 |
| 工作区顶层文档 | 工作区 `README.md`、`doc/architecture.md`、`doc/data-flow.md` 等 | 给出总览、阅读顺序、跨模块架构图和关键业务流 |
| AI 路由文档 | 工作区 `AGENTS.md` | 指明优先阅读的文档与同步门禁 |

以 backend 为例，理想结构是：

1. 先在 `infoq-core`、`infoq-modules`、`infoq-plugin` 的叶子模块下补真值文档。
2. 再在 `infoq-core`、`infoq-modules`、`infoq-plugin` 这一层写聚合文档。
3. 最后由 `backend/README.md`、`doc/architecture.md`、`doc/data-flow.md` 汇总。
4. `backend/AGENTS.md` 只负责告诉 AI 先读什么、变更后要同步哪些层。

前端工作区可以复用同一原则，只是叶子粒度不一定是 Maven 模块，也可以是 feature、package、page 或 domain module。

### 4.4 每一层应该写什么

叶子模块文档是最重要的真值层，建议至少覆盖：模块职责、关键入口、核心类/文件、上游依赖、下游依赖、关键配置、关键数据流、扩展点、日志/监控切入点、已知边界。

父模块文档不应重写子模块细节，而应聚焦"关系"：子模块清单与各自职责摘要、子模块之间的依赖方向、典型调用链和装配关系、哪些能力属于公共能力、哪些属于业务能力、哪些关系是运行时装配、哪些只是编译期依赖、哪些链路已被代码证实。

工作区顶层文档负责"先让人看懂，再决定往哪里钻"：工作区整体定位与模块分层、推荐阅读路径、总体架构与关键数据流、跨父模块的共性约束（安全、配置、插件、部署、监控）、AI 或新人最容易误判的边界提醒。

`AGENTS.md` 不代替正文文档，只负责：注册文档入口、规定阅读顺序、规定什么变化必须同步哪一层文档、约束 AI 在信息不足时回退为"当前实现说明"。

### 4.5 聚合文档必须理顺调用关系

聚合文档不能只列模块名单，否则 AI 仍然会误判结构。至少要把以下关系理顺：

- 依赖方向：谁依赖谁，是否允许反向依赖。
- 调用入口：请求、消息、任务、自动配置或前端事件从哪里进入。
- 主链路：例如 `controller -> service -> mapper`、`page -> store -> request -> api`、`plugin auto-config -> shared capability -> business module`。
- 横切能力接入方式：安全、日志、缓存、定时任务、字典、审计、监控如何挂入主流程。
- 运行时与编译期区别。

如果关系未被代码证实，不要为了完整而脑补，直接写"当前仓库仅能确认到这里"。

### 4.6 文档同步门禁

不要把规则写成"任何代码变动都更新所有父文档"，这会快速失控。更合理的同步门禁是：

必须同步文档的变更：模块职责变化、对外接口/入口/导出点变化、子模块依赖方向变化、关键调用链或关键数据流变化、关键配置项/开关/profile/环境变量变化、自动配置/装配关系/扩展点变化、SQL/持久化语义变化、现有日志/监控/排障入口变化。

通常不需要层层同步的变更：纯命名微调且不影响语义、纯内部重构且职责和边界不变、注释/格式化/小范围测试补充、不改变接口和依赖关系的局部实现细节。

推荐同步顺序：

1. 先更新受影响的叶子模块文档。
2. 再更新该叶子模块的直接父模块聚合文档。
3. 若变化已影响工作区总览，再更新工作区顶层文档。
4. 若文档入口、阅读顺序或同步门禁发生变化，再更新该工作区 `AGENTS.md`。

交付前至少做一次"文档漂移检查"：确认上层摘要仍与下层真值一致。

### 4.7 冲突裁决规则

多层文档并存时，必须明确真值优先级：

1. 源码与真实配置是最终真值。
2. 离代码最近的叶子模块文档优先。
3. 直接父模块聚合文档次之。
4. 工作区顶层总览文档再次之。
5. `AGENTS.md` 只负责路由和门禁，不作为实现细节真值。

如果多层文档与代码不一致，先以代码为准，并把描述回退为更保守的"当前实现说明"。

### 4.8 反模式

以下做法会让 AI 更容易跑偏：

- 每次小改动都强制改完整棵文档树。
- 父模块文档复制粘贴子模块文档正文。
- 文档写满未来规划、猜测链路、未证实依赖。
- 小模块也写成长篇大论，导致维护成本高于信息价值。
- 把调用关系藏在脑子里，只在代码里散落，不在聚合层显式说明。

### 4.9 模板与落地建议

叶子模块文档建议结构：模块职责 / 关键入口 / 核心类文件 / 上游依赖 / 下游依赖 / 关键配置 / 关键数据流 / 扩展点 / 日志监控切入点 / 已知边界。

父模块聚合文档建议结构：模块定位 / 子模块清单 / 子模块职责摘要 / 依赖方向 / 典型调用链 / 公共约束 / 已知边界 / 下钻阅读路径。

落地顺序：先补最容易被误判的叶子模块文档，再补直接父模块的聚合文档，最后更新工作区总览文档和 `AGENTS.md` 文档路由，并把"是否需要同步文档"纳入每次交付前的检查项。如果某条链路暂时梳理不清，不要硬凑完整说明，直接写成保守版本的"当前实现说明"。

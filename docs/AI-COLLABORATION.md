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

同一作用域内遵循更近目录的规约；同目录存在 `AGENTS.override.md` 时优先采用该文件。Codex 启动时只沿项目根到当前工作目录发现规约，每个目录至多采用一个文件，不会预先加载所有子目录。开始修改其他工作区前，还必须主动读取目标路径的规约。`GEMINI.md` 在本仓库仅作同目录规约入口指针，不维护第二份规则。

官方发现规则见 [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。

### 1.2 AGENTS.md 里应该放什么

适合放进 `AGENTS.md` 的内容：

- 全局工程规则
- acceptance contract 约束
- 默认验证顺序
- OpenSpec 路由
- active change 结构校验要求
- skill 路由与优先级
- 带触发词的指针：触发关键词 + 真值路径 + 不可协商结论；只写路径或只写结论都视为失效指针
- 本工作区最关键的命令和边界

不适合堆进 `AGENTS.md` 的内容：

- 详细 SOP
- 冗长背景解释
- 大量示例代码
- 低频参考资料

这些内容更适合放进 `docs/` 或 skill `references/`。

### 1.3 根 AGENTS 与工作区 AGENTS 的职责

根 `AGENTS.md` 只保留跨仓规则，并额外承担几类治理职责：

- skill 命名与路由约束
- skill 元数据约束
- `OpenSpec` 分级路由
- `openspec-check` 的治理要求
- 文档同步约束
- 临时产物目录约束

临时产物目录与 skill 运行时入口约束以根 `AGENTS.md` 的 `Change Discipline` 与 `Skill Runtime Policy` 为准，本文件不重复。

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

本仓库按约定把技能正文保存在 `skills/`。Codex 官方自动发现目录是 `.agents/skills/`，不会仅因根目录叫 `skills/` 就自动注册。当前仓库通过根规约路由后显式读取相应 `SKILL.md`；`$skill-name` 和 UI metadata 是否可由选择器调用，取决于宿主是否已安装/链接该技能，不能从文件存在推断已注册。需要原生发现时可由开发者在自己的技能目录链接或安装这些目录，不另维护重复正文。官方机制见 [Build skills](https://learn.chatgpt.com/docs/build-skills)。

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

### 2.1 真值来源

| 主题 | 真值文件 |
| --- | --- |
| 协作规则 | `AGENTS.md` 与更近工作区 `AGENTS.md` |
| 仓库级 skill | `skills/*/SKILL.md` |
| 规格与变更 | `openspec/config.yaml`、`docs/specs/`、`openspec/changes/`（本地） |
| MCP 配置 | `.codex/config.toml` |
| 项目文档 | `README.md` 与 `docs/*.md` |

`AGENTS.md` 约束"如何工作"；`docs/` 说明"项目是什么、如何使用、如何验证"。OpenSpec 分级、验收约定与验证顺序只在 `AGENTS.md` 与 `docs/DELIVERY-WORKFLOW.md` 维护，本文件不重复。

### 2.2 变更纪律细则

根 `AGENTS.md` 的 `Change Discipline` 只保留决策阶梯与硬约束，这里说明展开方式。

**工程基线**。遵守 DRY/YAGNI 与关注点分离；命名清晰；注释只写关键意图。

**补充标准**。优先直接修复，不保留无必要兼容层；已识别为错误的改动先立即回退，再继续处理，不留下死代码。

**内联优先**。简单判断、空值处理、失败返回、字段赋值、字符串拼接、集合遍历、Map/List 聚合、分页包装、VO/DTO 组装，以及只服务单一主流程的局部逻辑，默认留在原处。只有具备独立业务语义、可复用复杂流程边界、事务或并发边界、独立算法责任、复杂对象构建责任，或能显著降低主流程认知复杂度时，才抽成独立单元。抽离必须带来真实语义收益，不能只是为了拆行、藏细节或形式整洁。

**批量化**。数据库、缓存、远程调用、文件、消息等外部资源访问，查询、校验、组装与统计默认批量化。能一次批量处理时不得逐元素访问造成 N+1；确因业务维度需要拆分时，只允许有限分组批量处理。禁止用抽象层掩盖低效实现、重复 IO 或责任边界不清。

**范围收口**。只治理本次触及范围。可以顺手修正当前路径上的结构、重复、错误语义与 N+1，但不得扩大为仓库级重排、批量格式化、命名美化、机械式分层或风格迁移。

**临时产物与妥协**。临时文件、调试输出和一次性产物统一放 `tmp/`。带已知上限的简化方案写成 `shortcut: <上限>, <升级触发>` 注释，由 `node tools/check_shortcut_debt.mjs` 汇总；没有升级触发的标记视为欠债。

### 2.3 文档同步命令

命令、环境变量、skill 入口、MCP 配置或目录结构变化后，按根 `AGENTS.md` 的 `Docs Sync` 同步文档，然后执行：

```bash
node tools/validate_utf8.mjs README.md docs
node tools/check_readme_sync.mjs
node tools/check_doc_links.mjs
```

### 2.4 工程标准与代码度量

代码度量（建议值，超出时先确认是否有明确业务理由）：

- 函数长度：非空行超过 50 时评估可读性，不按行数机械拆分 helper；独立业务语义或明显降低主流程复杂度时才抽取。
- 文件规模：超过 300 行时评估职责边界，不仅为满足行数拆分文件。
- 嵌套深度：建议不超过 3 层，优先 guard clause / early return 拉平控制流。
- 位置参数：建议不超过 3 个，超过时使用 options 对象。
- 圈复杂度：单函数超过 10 时检查分支是否必要；优先消除重复与无效分支，抽象仍遵循根规约。
- 禁止魔法数字：对非显然常量提取具名常量。

解耦与状态：

- 业务逻辑优先依赖注入；参数、接口、适配器能提升可测性与可演进性时，避免硬绑定具体实现。
- 在可行场景优先不可变：使用 `const`、`readonly`、不可变结构与拷贝返回，避免修改入参或共享全局状态。
- 除非修改入参是显式 API 契约，否则禁止修改函数参数。

## 3. Subagents 使用指南

### 3.1 分工原则

multi-agent 的价值不是"多开几个 agent"，而是把高噪声、边界清晰的任务交给专门的子 agent，让主线程只保留需求、约束、决策和最终结论。

### 3.2 主流程与真值

- 项目级上下文：`openspec/config.yaml` 的 context
- 规格真值：`docs/specs/`
- 活跃变更目录：`openspec/changes/<change-id>/`（本地，不提交）
- repo 级 custom agents 真值：`.codex/agents/`
- 流程与产物模板：`docs/OPENSPEC-WORKFLOW.md`
- `design.md` 仅在需要时创建，写清交互入口、布局结构、加载/空态/错误/无权限态与各交付面约束

```bash
node tools/init_change_dir.mjs <change-id>
node tools/openspec_check.mjs <change-id>
```

### 3.3 当前可用的专家

| Agent | 责任 |
| --- | --- |
| `requirements_expert` | 分析需求，输出 `proposal.md` 和 spec delta |
| `technical_designer` | 输出 `tasks.md`，明确各交付面矩阵与验证命令 |
| `code_implementer` | 依据 `proposal.md`、`design.md`、`tasks.md` 和 spec delta 落代码 |
| `auto_fixer` | 运行验证并修复真实错误 |

执行顺序固定为 `requirements_expert -> technical_designer -> code_implementer -> auto_fixer`，主线程负责最终验收。产物章节、跨工作区规则与归档要求见 `docs/OPENSPEC-WORKFLOW.md`。

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

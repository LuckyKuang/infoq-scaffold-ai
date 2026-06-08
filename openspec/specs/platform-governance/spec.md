# 平台治理规范

## 目标

定义仓库默认 AI 交付流程、统一影响矩阵、active change 结构校验、稳定规格回填纪律，以及 OpenSpec 文档语言规范。

## 要求

### 要求：分级 OpenSpec 流程
仓库变更必须按影响级别执行 OpenSpec 流程。

#### 场景：L3 高影响变更

- 当变更属于新功能、API 契约变更或跨工作区交付时
- 则实现开始前必须在 `openspec/changes/<change-id>/` 初始化变更
- 并且变更至少包含 `proposal.md` 与 `tasks.md`
- 并且实现前必须通过 `openspec-check`

#### 场景：L2 中影响单工作区变更

- 当变更只影响单工作区行为且不改 API 契约时
- 则允许采用 OpenSpec 精简流程
- 并且至少维护 `proposal.md` 与 `tasks.md`
- 并且交付前必须通过 `openspec-check`

#### 场景：L1 低影响小修复

- 当变更是单工作区小修复且不改契约、改动范围小（默认 `<=3` 个文件）时
- 则可以不创建 OpenSpec 变更目录
- 并且必须在任务上下文先写验收约定
- 并且若分级不确定，默认提升到 L3 执行

### 要求：repo-level 计划文档
仓库级治理或高风险重构必须保留执行计划。

#### 场景：repo-level 或高风险治理变更

- 当变更会重构 skill、文档、AGENTS、OpenSpec 真值或其他跨仓治理资产时
- 则除 active change 外，还必须在 `doc/plan/YYYY-MM-DD-topic-plan.md` 中保留执行计划

### 要求：统一影响矩阵
每个 change 都必须显式评估统一工作区或交付面，而不是只写当前编辑目录。

#### 场景：维护 `tasks.md`

- 当维护者编写或更新 `tasks.md` 时
- 则必须显式评估 `infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue`、`infoq-scaffold-frontend-weapp-react`、`infoq-scaffold-frontend-weapp-vue`、`infoq-scaffold-docs`、`script / deploy`
- 并且对不受影响项必须给出原因

### 要求：active change 结构校验
active change 在实现前和交付前都必须通过统一结构校验。

#### 场景：校验 active change

- 当维护者准备进入实现或结束交付时
- 则必须执行 `node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id>`
- 并且缺少关键章节、影响矩阵或验证映射时必须显式失败

### 要求：稳定规格回填
稳定行为必须最终回写到 `openspec/specs/`，避免长期依赖代码搜索。

#### 场景：活跃变更影响稳定行为

- 当某项变更明确改变或澄清了长期稳定行为时
- 则该变更必须在 active change 中补充 spec delta
- 并且在接受后回写到 `openspec/specs/`

#### 场景：开发者本地临时改后台端口

- 当开发者为避开本机 `8080` 冲突，临时把 admin backend 改到 `8081` 或其他端口时
- 则共享脚本、共享文档和真值配置仍必须保持 `8080` 作为默认值
- 并且 runtime helper 必须支持通过 `--backend-port <port>` 显式覆盖本地端口
- 并且前端 dev 代理必须自动跟随该显式端口，除非调用者显式设置 `VITE_APP_PROXY_TARGET`
- 并且该临时端口不得被沉淀为共享默认值

#### 场景：使用 `application-local.yml`

- 当维护者需要验证 `application-local.yml` 时
- 则必须显式传 `--spring.profiles.active=local` 或 runtime skill `--profile local`
- 并且排障时必须先区分 profile 未切换、端口错配、外部依赖不可达 三类问题

#### 场景：skill 启动长生命周期运行态

- 当仓库级 skill 启动 backend、frontend dev server、浏览器 runner、WeChat DevTools runner 或其他长生命周期进程时
- 则必须在 `doc/tmp/<skill-name>/` 或其子目录写入状态文件
- 并且状态文件必须至少记录 pid、端口、日志路径、启动时间、更新时间、拥有关系，以及 `starting`、`running`、`passed`、`failed`、`interrupted`、`stopped` 中的状态
- 并且验证完成、失败、阻塞中断或收到 `SIGINT`/`SIGTERM`/`SIGHUP` 时，必须关闭本 skill 启动或状态文件标记为 owned 的端口
- 并且下一次运行前必须先清理仍标记为 `running` 或 `interrupted` 的旧状态，避免上次断开留下端口占用

### 要求：SQL 初始化基线冻结
仓库初始化 SQL 必须保持冻结，数据库变更必须通过增量脚本交付。

#### 场景：数据库结构或数据变更

- 当变更涉及表结构、字典、菜单、配置、默认数据或其他数据库内容时
- 则不得修改 `sql/infoq_scaffold_2.0.0.sql`
- 并且必须通过新增或维护对应日期的 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本交付
- 并且交付说明必须写清脚本执行、缓存清理或重启要求，以及回滚影响

#### 场景：发现初始化 SQL 被误改

- 当差异审查发现 `sql/infoq_scaffold_2.0.0.sql` 出现变更时
- 则必须先回退该初始化 SQL
- 并且把必要变更迁移到当前日期增量脚本
- 并且重新执行相关规约和编码校验

### 要求：归档前验证
受影响工作区的验证证据完整前，变更不得归档。

#### 场景：验证完成

- 当 `openspec-check`、主流程验证、目标测试、必要 lint/build 已通过，或存在获批例外时
- 则该变更可被认定为满足归档前提

#### 场景：验证受阻

- 当任一必需验证步骤阻塞或失败时
- 则该变更必须保持活跃状态
- 并且阻塞信息必须在当前变更文档产物中显式记录

### 要求：OpenSpec 文档语言规范
`openspec/` 下新增或更新文档正文必须默认使用中文。

#### 场景：编写 OpenSpec 文档

- 当维护者编写 `openspec/` 下文档时
- 则正文与说明应使用中文表达
- 并且路径名称、命令、文件名保持英文原样

#### 场景：工具兼容

- 当需要与自动化流程或脚本兼容时
- 则文件名继续使用 `proposal.md`、`tasks.md`、`design.md`、`materials.md`、`review.md`、`spec.md`
- 并且不得为语言本地化而改动这些标准文件名

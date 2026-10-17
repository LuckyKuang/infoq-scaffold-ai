# 平台治理规范

## 目标

定义仓库默认 AI 交付流程、统一影响矩阵、active change 结构校验、稳定规格回填纪律、仓库级 skill 收敛与域外能力归属，以及 OpenSpec 文档语言规范。

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

### 要求：统一影响矩阵
每个 change 都必须显式评估统一工作区或交付面，而不是只写当前编辑目录。

#### 场景：维护 `tasks.md`

- 当维护者编写或更新 `tasks.md` 时
- 则必须显式评估 `backend`、`frontend-react`、`frontend-vue`、`docs`、`deploy`、`skills`
- 并且对不受影响项必须给出原因

### 要求：active change 结构校验
active change 在实现前和交付前都必须通过统一结构校验。

#### 场景：校验 active change

- 当维护者准备进入实现或结束交付时
- 则必须执行 `node tools/openspec_check.mjs <change-id>`
- 并且缺少关键章节、影响矩阵或验证映射时必须显式失败

### 要求：稳定规格回填
稳定行为必须最终回写到 `docs/specs/`，避免长期依赖代码搜索。

#### 场景：活跃变更影响稳定行为

- 当某项变更明确改变或澄清了长期稳定行为时
- 则该变更必须在 active change 中补充 spec delta
- 并且在接受后回写到 `docs/specs/`

#### 场景：开发者本地临时改后台端口

- 当开发者为避开本机 `8080` 冲突，临时把 admin backend 改到 `8081` 或其他端口时
- 则共享脚本、共享文档和真值配置仍必须保持 `8080` 作为默认值
- 并且 runtime helper 必须支持通过 `--backend-port <port>` 显式覆盖本地端口
- 并且前端 dev 代理必须自动跟随该显式端口，除非调用者显式设置 `VITE_APP_PROXY_TARGET`
- 并且该临时端口不得被沉淀为共享默认值

#### 场景：使用 `application-local.yml`

- 当维护者需要验证 `application-local.yml` 时
- 则必须显式传 `--spring.profiles.active=local` 或运行态脚本的 `--profile local`（`skills/test-cli/scripts/run_admin_e2e.mjs`、`run_admin_crud_e2e.mjs`）
- 并且排障时必须先区分 profile 未切换、端口错配、外部依赖不可达 三类问题

#### 场景：运行态脚本或 skill 启动长生命周期进程

- 当仓库级 skill 或 `tools/` 运行态脚本启动 backend、frontend dev server、浏览器 runner、WeChat DevTools runner 或其他长生命周期进程时
- 则必须在 `tmp/<owner>/`（skill 名或工具命令组名）或其子目录写入状态文件
- 并且状态文件必须至少记录 pid、端口、日志路径、启动时间、更新时间、拥有关系，以及 `starting`、`running`、`passed`、`failed`、`interrupted`、`stopped` 中的状态
- 并且验证完成、失败、阻塞中断或收到 `SIGINT`/`SIGTERM`/`SIGHUP` 时，必须关闭本次启动或状态文件标记为 owned 的端口
- 并且下一次运行前必须先清理仍标记为 `running` 或 `interrupted` 的旧状态，避免上次断开留下端口占用

### 要求：仓库级 skill 收敛与域外能力归属

仓库级 skill 必须保持 5 个 CLI 型工作域，域外验证与运维能力不得新增 skill。

#### 场景：新增或调整仓库级 skill

- 当需要新增 skill 或调整现有 skill 职责时
- 则只能归入 `compress-cli`、`push-cli`、`release-cli`、`test-cli`、`deploy-cli` 五个工作域
- 并且每个 skill 目录必须包含 `SKILL.md` 与 `agents/openai.yaml`，且 `default_prompt` 显式包含 `$<skill-name>`
- 并且标准执行顺序为判定范围 -> 只读探测/预览 -> 目标与影响枚举 -> 写入或危险动作门禁 -> 执行验证 -> `tmp/` 证据留存与显式失败

#### 场景：域外验证与运维能力

- 当出现无法归入上述 5 个域的能力时
- 则后端验证与 OpenSpec 校验放入 `tools/`
- 并且数据运维与交付工作流放入 `docs/`，部署脚本与运行时矩阵放入 `deploy/`
- 并且部署生命周期编排归 `deploy-cli`，不得为此新增 skill，也不得在 `skills/` 下保留 shared/README-only/helper-only 目录

#### 场景：AGENTS.md 压缩与路由校验

- 当创建、压缩或更新根 `AGENTS.md` 时
- 则必须执行 `node skills/compress-cli/scripts/agents_check.mjs check`
- 并且校验必须覆盖格式与唯一类别、受保护类别完整性、Local Skills ↔ `skills/` 目录 ↔ `docs/SKILLS.md` ↔ Skill Trigger 引用一致性，以及被引用路径是否存在
- 并且校验失败必须显式失败，禁止把失败当作环境噪声

#### 场景：远程写操作

- 当任务涉及推送分支、创建或合并 PR、创建 tag 或发布 GitHub Release 时
- 则默认必须 dry-run，且只有显式确认参数才执行远程写操作
- 并且禁止直推默认分支、禁止 `--force`/`--all`/`--tags`，禁止用 `--admin` 绕过分支保护

### 要求：SQL 初始化基线冻结
仓库初始化 SQL 必须保持冻结，数据库变更必须通过增量脚本交付。

#### 场景：数据库结构或数据变更

- 当变更涉及表结构、字典、菜单、配置、默认数据或其他数据库内容时
- 则不得修改 `sql/infoq_scaffold_3.0.0.sql`
- 并且必须通过新增或维护对应日期的 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本交付
- 并且交付说明必须写清脚本执行、缓存清理或重启要求，以及回滚影响

#### 场景：发现初始化 SQL 被误改

- 当差异审查发现 `sql/infoq_scaffold_3.0.0.sql` 出现变更时
- 则必须先回退该初始化 SQL
- 并且把必要变更迁移到当前日期增量脚本
- 并且重新执行相关规约和编码校验

### 要求：MVC JSON 大数保护

Spring MVC JSON 输出必须对超出 JavaScript 安全整数范围的整数做字符串化保护。

#### 场景：雪花主键返回给浏览器

- 当任一接口返回 `Long`、`long` 或 `BigInteger` 字段且绝对值大于 9007199254740991
- 则 JSON 输出中该字段必须为字符串
- 并且浏览器端解析后必须能以精确原值回传给编辑、删除等接口

#### 场景：安全范围内整数保持数字

- 当接口返回 `long` 或 `Long` 字段且绝对值不大于 9007199254740991
- 则 JSON 输出中该字段必须保持数字类型


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

# AGENTS.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|Scope:本文件适用于 `infoq-scaffold-backend` 及其子目录，用于把根规则收窄到 backend 语境。
|Stack:Spring Boot 3.5.x|JDK 17|Maven multi-module|MyBatis-Plus|Spring Security
|Workspace Layout:infoq-admin|infoq-modules/infoq-system|infoq-plugin:*|infoq-core:{infoq-core-bom,infoq-core-common,infoq-core-data}
|Backend Docs:infoq-scaffold-backend:{README.md,doc/README.md,doc/architecture.md,doc/data-flow.md}
|Backend Module Docs:infoq-scaffold-backend:{infoq-admin/README.md,infoq-core/README.md,infoq-modules/README.md,infoq-plugin/README.md}
|Doc Read Order:先读 `infoq-scaffold-backend/README.md` 获取模块导航、配置分层与核心入口。|再读 `infoq-scaffold-backend/doc/README.md` 获取 backend 文档导航与主题下钻路径。|再读 `infoq-scaffold-backend/doc/architecture.md` 获取模块依赖、自动配置、安全与监控切入点。|最后读 `infoq-scaffold-backend/doc/data-flow.md` 获取登录、菜单路由、用户 CRUD、日志与监控数据流。|涉及 backend 架构、配置、登录、权限、Redis、Quartz、监控判断前优先阅读这些文档。
|Module Doc Drill-Down:涉及启动与 profile 先读 `infoq-scaffold-backend/infoq-admin/README.md`。|涉及公共类型、实体、Mapper 与 XML 先读 `infoq-scaffold-backend/infoq-core/README.md` 再下钻叶子模块。|涉及系统业务接口、runner、listener、monitor 先读 `infoq-scaffold-backend/infoq-modules/README.md`。|涉及基础设施、自动装配、Redis、Spring Security、Web、安全、Quartz、SSE、WebSocket、OSS、Excel 等先读 `infoq-scaffold-backend/infoq-plugin/README.md`。
|Module Doc Sync Gate:仅当改动影响模块职责、入口、对外接口、依赖方向、关键数据流、关键配置、自动装配、SQL/持久化语义、现有日志/监控切入点时，同步更新受影响叶子模块文档、直接父模块聚合文档，以及必要的 backend 顶层文档。|纯内部重构、注释、格式化、测试补充或不改变语义的命名微调，不要求层层同步。|交付前检查 backend 文档是否与源码漂移。
|Package And Formatting:Java package 按 `cc.infoq.{module}.{layer}` 组织。|backend `.editorconfig` 使用 4 spaces。|Java、YAML、SQL fixtures、resource files 保持 UTF-8。
|SQL Migration Policy:禁止修改仓库初始化基线 `../sql/infoq_scaffold_2.0.0.sql`。|backend 涉及表结构、字典、菜单、配置、默认数据等数据库变更时，只能新增 `../sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本。|误改初始化 SQL 时先回退，再把 SQL 迁入增量脚本。
|Runtime Baseline:backend 共享默认 HTTP 端口真值为 `8080`。|开发者本地若为避开冲突临时改到 `8081` 或其他端口，只能通过 `--server.port=<port>` 或 runtime skill `--backend-port <port>` 显式 override。|不得把一次性本地端口回写成共享默认配置。
|Redisson OSS Policy:backend 仅允许使用 Redisson 开源版兼容 API。|禁止调用 `getLocalCachedMapCache`、依赖 `keepAliveTime` 的 `RRateLimiter` 重载等 PRO-only 能力。|涉及缓存、限流、token 或登录链路的修复必须补 OSS 兼容测试与运行态校验。
|Commands:build=node .codex/scripts/backend_mvn.mjs -- clean package -P dev|run=node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests && java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local|run:override-port=node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests && java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8081|test=node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test|test:all=node .codex/scripts/backend_mvn.mjs -- -DskipTests=false test
|Profile Guardrail:`application-local.yml` 只有在显式传 `--spring.profiles.active=local` 时才生效。|排障时先区分 profile 未切换、端口错配、外部依赖不可达 三类问题，禁止混写成“后端启动失败”。
|Runtime Secrets:运行或部署保持现有仓库默认密码。
|OpenSpec Routing:分级执行。|L3(强制):backend 新功能、API 契约变更、跨工作区交付，编码前先创建或定位 `openspec/changes/<change-id>/`。|L2(Lite):单 backend 行为变更且不改 API 契约，至少维护 `proposal.md`+`tasks.md`。|L1(可豁免):单 backend 小修复且不改契约、改动范围小可不建 OpenSpec，但必须先写 acceptance contract。|不确定分级时默认 L3。|OpenSpec 文档正文默认中文，路径名称/命令/文件名保持英文原样。|scope、verification、rollback notes 以 change artifacts 或 acceptance contract 为准。
|Testing Boundary:优先在 `infoq-modules/infoq-system/src/test/java`、`infoq-plugin/**/src/test/java`、`infoq-core/**/src/test/java` 下写有针对性的 JUnit 5 测试。|默认使用 `@Tag("dev")` 匹配 Surefire groups。|Mapper default methods 可用 unit tests；纯 SQL 或 XML mapper methods 归入 mapper XML integration tests。
|Verification:backend 行为变更先验证 main flow，再跑目标 `mvn` tests，再做相关 package/build verification。|auth/login/token、mapper、XML、permission、runtime wiring 相关改动统一使用 infoq-backend-verify 覆盖登录、单测和 smoke；SQL、数据库、Redis、迁移、数据修复和一致性核对使用 infoq-data-ops。
|Skill Routing:backend 测试设计、补测、smoke、API verification、登录验证与失败诊断统一使用 infoq-backend-verify；SQL migration、数据修复、测试数据维护和数据库/Redis 只读诊断统一使用 infoq-data-ops。
|Boundaries:本工作区不要套用前端的 pnpm、lint、AppID 或 DevTools 规则。|交付时明确说明 config、SQL、dependency、observability 和 rollback impact。

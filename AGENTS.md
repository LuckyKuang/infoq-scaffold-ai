# AGENTS.md
|Scope:适用于仓库根目录及未被更近 `AGENTS.md` 或 `AGENTS.override.md` 覆盖的路径；任务先读仓库文件再依赖预训练知识。|跨仓规则留在根目录；`backend`、`frontend-vue`、`frontend-react` 的栈内细则在各自 `AGENTS.md`，冲突以更近文件为准。
|Encoding Gate:仓库文本必须 UTF-8，写入必须 UTF-8 without BOM。|PowerShell 5.1 读文件须显式 `-Encoding UTF8`；禁止用 `>`、`>>`、`Out-File`、`Set-Content` 写仓库文本，写入用 apply_patch、Node utf8 或 .NET UTF8Encoding(false)。|提交前跑 `node tools/validate_utf8.mjs`。
|Toolchain:前端默认 pnpm，版本真值为根 `package.json` 的 packageManager，pnpm 不可用时才退回 npm。|Node 固定 26.13.1（本机/CI/Docker builder），`.node-version` 与 `.nvmrc` 必须一致，禁止浮动 tag。|后端 Maven 用 `node tools/backend_mvn.mjs -- ...`，要求 JDK 21 与 Maven 3.9.x。
|Change Discipline:最小完整变更：是否必须存在 -> 仓库已有 -> 标准库或平台 -> 已装依赖 -> 一行可读实现 -> 最小实现；不为假设的未来加抽象或兼容层。|改动要完整：调用方、测试、fixture 与配置一起收口；简单逻辑默认内联，只有独立业务语义、事务/并发边界或独立算法才抽离。|禁止空重构、范围蔓延与无意义注释；注释只写 why；未要求兼容时删死代码；精简不得砍边界校验、错误处理、安全、可访问性与用户明确要求。|外部资源访问批量化，禁止 N+1。|只治理本次范围，不做批量重排或风格迁移；临时产物放 `tmp/`。|临时妥协写成 `shortcut: <上限>, <升级触发>`，缺触发条件按欠债，用 `node tools/check_shortcut_debt.mjs` 盘点。|细则见 `docs/AI-COLLABORATION.md`。
|Failure Policy:产品代码优先显式失败，不接受静默 fallback、吞错或假成功；确需 fallback 时必须显式、可说明、易关闭，并经过用户批准。
|Root Cause Fix Policy:优先定位并解决根因；禁止叠加无退出计划的 fallback/toggle/长期双轨；临时兼容必须写明边界、启停与移除条件；错误语义保留可定位信息，不得伪装为未知异常。
|Security And Validation:源码禁止硬编码密钥；边界处校验外部输入；数据库访问使用参数化查询；保持代码可测试；优先自动化校验；后端单测总时长 ≤60 秒。
|Redisson OSS Policy:只允许 Redisson 开源版兼容 API；禁止 PRO-only 能力（如 getLocalCachedMapCache、keepAliveTime 限流重载）。|改动缓存、限流、鉴权、登录或 Redis 抽象须补 OSS 兼容性验证。
|Acceptance Contract:实现前必须在当前任务上下文中写清一个 acceptance contract，覆盖 functional scope、non-goals、exception handling、required logs or observability、rollback trigger or conditions；缺项或冲突时先暴露问题再编码。
|Execution Loop:最小闭环，一次只改一类问题；验证顺序固定为 main-flow verification -> targeted tests -> lint/build -> diff review。|交付前必须通过相关单测；跑不起来必须写明 blocker。单测按行为与边界写，失败先修产品代码；禁止削弱断言、放宽 mock 或伪造通过。|交付前检查 performance、observability、rollback 与 config/SQL/dependency impact，未检查项写成 residual risk。|单测纪律与 SOP 沉淀见 `docs/DELIVERY-WORKFLOW.md`。
|Release Guardrails:依赖版本与 lockfile 一致。|版本仅支持 x.y.z 与 x.y.z-rcN（N>0、无前导零）；RC 用源码 Pre-release、非 Latest、无资产，正式版保持受控三资产校验，见 `docs/RELEASING.md`。|CI/发布须分别通过后端完整业务单测与真实生产配置回归，不得以 prod 分组少量测试冒充全量。|执行前核验 env、config 与外部依赖；高风险/破坏性操作先获确认。
|SQL Migration Policy:`sql/infoq_scaffold_3.0.0.sql` 是冻结初始化基线，永远不要修改。|表结构与初始化数据变更只能新增 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本。|误改初始化 SQL 必须立即回退，并把变更迁入当前日期增量脚本。
|Deployment Secrets:生产与 Compose 必须用独立受控凭据，禁止默认密码或示例凭据；未核验不得判定生产就绪。|部署与构建先跑 `node tools/production_config.mjs` 预检，受控文件由 INFOQ_PRODUCTION_CONFIG_FILE 指定，基线 Linux Docker；前端保持 VITE_APP_ENCRYPT=true，两组独立 RSA 的方向、强度与注入边界见 `deploy/PRODUCTION.md`，后端请求私钥不得进入浏览器产物。
|Browser Session:双管理端只记用户名，access token 仅内存；HttpOnly 恢复资源按 react/vue scope 隔离，普通 API 仅接受 Bearer。|生产 Origin、Cookie Path/Secure/TTL 与恢复语义见 `docs/specs/auth/spec.md`，须与实际代理一致；禁止 token stdout 或 Admin-Token 存储注入。
|Repo Skill Policy:只保留 5 个 CLI 工作域：compress-cli、push-cli、release-cli、test-cli、deploy-cli，统一 `*-cli` 后缀；每目录必须有 `SKILL.md` 与 `agents/openai.yaml`。|一个 skill 一个工作域，细则放 `references/`；优先重构现有 skill，不新增泛化 skill。|域外能力、部署编排与文档语言细则见 `docs/SKILLS.md` 第 1 节。
|Skill Runtime Policy:入口跨 Windows/macOS/Linux，统一用 repo-owned Node CLI 或 `.mjs`；不保留 `.sh`/`.ps1`/`.cmd` 作为 skill 入口。|长生命周期进程必须在 `tmp/` 写状态文件，并在完成、失败或中断时关闭 owned 端口、核验实际退出；清理失败不得写成成功。|细则见 `docs/SKILLS.md` 第 7 节。
|Docs Sync:变更 skill 名称、命令、env、入口路径或 `.codex/config.toml` 的 MCP 配置后，必须同步 `AGENTS.md`、更近 `AGENTS.md`、四种根 README 与相关 `docs/`。|改完执行 `node tools/check_readme_sync.mjs` 与 `node tools/check_doc_links.mjs`。
|MCP Config Truth:`.codex/config.toml` 是唯一真值源；`docs/MCP-SERVERS.md` 只描述显式配置的 server、tool、启用状态与只读范围。|名称、审批模式、超时与启动脚本必须与配置及 `tools/` 一致。
|Spec Workflow:分级用 OpenSpec。L3(强制)：新功能、API 变更、跨工作区交付，编码前建 `openspec/changes/<change-id>/`。L2(Lite)：单工作区行为变更且不改契约，proposal 与 tasks。L1(可豁免)：小修复且 <=3 files，必须写 acceptance contract。不确定按 L3。|实现前与交付前都跑 `node tools/openspec_check.mjs <change-id>`。|`openspec/changes/` 与 `docs/plan/` 由 Git 忽略。|专家顺序与产物模板见 `docs/OPENSPEC-WORKFLOW.md`。
|UI Workflow:重大 UI/UX 走四阶段：布局方案与桌面/移动 ASCII Wireframe 获 `LAYOUT APPROVED`；`docs/ui-demos/<change-id>.html` 演示获 `DEMO APPROVED`；再用真实技术栈实现并做运行态核验。|不预设 Tailwind/Capacitor/Hono；有 MVP 约束文件时只做核心流。|细则见 `docs/UI-WORKFLOW.md`。
|Local Skills:skills:{compress-cli,push-cli,release-cli,test-cli,deploy-cli}
|Skill Priority:多个 skill 命中时按 test-cli -> push-cli -> release-cli 顺序执行；规约改动先用 compress-cli。|backend 验证、数据运维、交付门禁与组件核验见 `docs/SKILLS.md` 第 8.9 节。
|Skill Trigger:网页交互、受保护路由、验证码登录、E2E、页面运维与前端单测/构建用 test-cli；推送、PR、修复校验失败与合并用 push-cli（禁直推默认分支与 `--admin`），提交前评审按 `skills/push-cli/references/review-gate.md`；版本、tag 与 Release 用 release-cli；本机部署、Apple container、Docker 启停与 smoke 用 deploy-cli。

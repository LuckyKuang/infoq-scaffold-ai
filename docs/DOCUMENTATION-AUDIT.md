# 文档与交付入口复审（2026-10-18）

本轮重新检查全部维护 Markdown、层级规约、五个 CLI 技能及独立发现的脚本/config，修正文档事实与直接支撑交付的工具缺陷。**文档和隔离回归已完成的检查不等于生产验收**；实际产品阻塞、环境条件和关闭标准见下文。

本轮以提交 `93d817511e1aa2a652a507a7dcbc9888556c3a84` 为起点重新发现文件和验证行为，没有把上一轮清单或通过结果当作本轮证据。唯一验收约定保留在忽略的本地 change；耐久要求见[平台治理规格](./specs/platform-governance/spec.md)。

## 覆盖口径

使用 `git ls-files --cached --others --exclude-standard -z` 独立盘点维护文件，包含隐藏目录、大小写 `.md` / `.markdown`、规约、示例和新增文件。最终 **146 份 Markdown、224 项操作入口/config** 均有唯一归属、事实来源与结论；二者分别盘点后交叉对账，不能只沿文档链接发现脚本。

| 责任域 | Markdown | 操作入口/config |
| --- | ---: | ---: |
| 根规约、导航、治理、compress-cli、MCP/共享运行时 | 26 | 36 |
| React/Vue、架构/设计、测试、test-cli | 51 | 65 |
| backend、验证工具、数据操作与业务规格 | 49 | 65 |
| deploy、deploy-cli | 12 | 39 |
| push/release、GitHub CI | 8 | 19 |
| 合计 | 146 | 224 |

规约包括 4 份 `AGENTS.md` 与 2 份 `GEMINI.md` 指针；五个技能的全部正文、references、metadata 与脚本均纳入。逐项记录允许“文档准确但实现阻塞”，不把已读取或已记录问题当作功能通过。清单、最终文件 hash、来源、命令、退出码及脱敏日志位于本次工作区 `tmp/documentation-reaudit/`，临时证据不随公共底座交付，复查时重新生成。

排除 `.git`、第三方依赖、缓存、构建产物与 `tmp/`。`docs/plan/` 和 `openspec/changes/` 继续由 Git 忽略；后续计划仍写入 `docs/plan/`，按需创建，由用户手动清理。本轮 active change 和计划单独校验，未重新纳入版本控制。生成且受管的 case matrix 仍属于维护文件。

操作清单包含 Node/Bash/Python/Windows 包装脚本、五份技能 metadata、宿主配置、CI、package/lockfile、POM/自动配置入口、环境示例及部署资产。业务 Java/页面、Mapper、i18n 和 SQL 作为相关声明的事实来源；本轮不声称完成全部业务代码、安全漏洞或第三方依赖审计。二进制部署资产仅核路径与引用。

## 本轮修正

| 领域 | 修正结果 |
| --- | --- |
| 规约与导航 | 同步四语言 README 的实际部署 env 前置条件；纠正贡献指南多语言范围和 local profile 打包/加载说明；生命周期要求核验实际退出，保留本地计划忽略与手动清理语义 |
| compress-cli | 校验实际唯一 `interface.default_prompt`，拒绝注释/描述中的变量、同前缀技能名、重复及引号/inline 同名映射；空首行与重复类别显式失败。支持仓库使用的格式，完整 YAML 语法另检 |
| MCP 配置与进程 | 支持无首个 `---` 的连接配置及嵌套 Redis，保留字符串密码；重复/歧义/未解析配置与非 MySQL JDBC URL 失败；缓存优先执行声明的 `bin`，缺入口失败；包装器信号终止不再误报成功 |
| 共享运行时 | 命令等待输出流关闭；超时/取消清理自有进程树、父进程先退出后的后代，并核验退出；不清理无关同组进程。保留 `ETIMEDOUT`、`ABORT_ERR` 和清理异常 |
| backend 验证 | smoke/cluster 真正绑定 loopback；端口、节点与缺参先校验；HTTP 包括响应体设有限时限，Redis 连接/读取有限时；错误保留阶段/HTTP/code，禁继承令牌输出和敏感响应正文 |
| CRUD 与浏览器验证 | API/DB 新增/编辑/删除数量、关键字段与主键断言；查询错误保持未知并失败；精确键冲突先拒绝，不预删已有数据；保留完整随机后缀，client 编辑真正改字段；信号进入数据清理/owned 进程/报告收口，关闭期间中断及 console 门禁与最终状态一致；报告落盘失败或中断会撤销保留测试栈的决定并关闭 owned 进程 |
| 前端操作文档 | 纠正只读与写入 API 说明、导航遗漏和高副作用用例分级；Vue Windows 包装脚本改用 pnpm 并保留退出码；登录加密随机量使用密码学随机源 |
| 部署与隔离 | 新目录使用受控权限，拒绝越界/符号链接/不安全权限；Redis 配置移除秘密，旧认证配置须先核验新容器认证命令/归属/只读挂载才能替换，服务端秘密配置设为 `0600`；Apple YAML/SQL 正确引用；ES/MQTT IT 校验独立 run 路径并隔离环境覆盖，秘密渲染失败不会假成功 |
| 卸载与 deploy-cli | 删除前核验 Compose project/service、宿主挂载、网络与孤立目录标记，区分 daemon 失败和资源不存在，使用核验后的资源 ID；env 缺失、错误 flag、非 200 smoke 显式失败，参数值中的等号保留 |
| 推送与发布 | Git fetch/push URL 与 gh 目标绑定且拒绝多目标；预览 fetch 不取 tag，打 tag 要求工作区干净且用精确 refs；无效参数/版本参数失败；失败日志保留退出码与错误；发布只接收三个对应、非空、常规文件资产，拒绝错名/缺失/重复/链接 |

旧报告中 CRUD 假零残留、缺少数据断言、浏览器状态不完整、目录 `0777`、Redis 配置明文秘密、ES 共用数据目录及卸载无归属核验，均已按本轮隔离证据修复。它们不再作为“尚未修改”的阻塞列出；真实环境验收仍须独立完成。

## 验证边界与命令

从仓库根运行。先核对根入口 → 工作区/技能 → 解析器/配置 → 失败与恢复说明，再运行定向隔离回归、编码/语法/结构检查和人工 diff review。不批量执行文档代码块，不用真实数据验证工具门禁。

```text
node tools/test_check_doc_links.mjs
node tools/test_openspec_tools.mjs
node tools/test_backend_mcp_env.mjs
node tools/test_mcp_cache.mjs
node tools/test_skill_runtime.mjs
node skills/compress-cli/scripts/test_agents_check.mjs
node tools/verify/test_smoke.mjs
node skills/deploy-cli/scripts/test_deploy_cli.mjs
node skills/deploy-cli/scripts/test_deploy_safety.mjs
node skills/push-cli/scripts/test_push_cli.mjs
node skills/release-cli/scripts/test_release_cli.mjs
node skills/release-cli/scripts/test_bump_version.mjs
node skills/release-cli/scripts/test_release_assets.mjs
node tools/test_check_release_version.mjs
node skills/test-cli/scripts/test_case_matrix.mjs
node skills/test-cli/scripts/test_redis_captcha_seed.mjs
node skills/test-cli/scripts/test_admin_crud.mjs
node skills/test-cli/scripts/test_browser_runtime.mjs
node skills/push-cli/scripts/push_cli.mjs check --profile docs
node skills/compress-cli/scripts/agents_check.mjs budget
node tools/openspec_check.mjs reaudit-production-documentation
git diff --check
```

`check --profile docs` 执行全仓 UTF-8、README 同步、本地链接、根 AGENTS 路由与版本门禁。上述 OpenSpec 命令仅适用于保留本地 change 的本次工作区，重新审计应使用自己的 change ID。回归使用临时 Git/假 gh、回环 HTTP、合成配置、假浏览器/Redis/Docker 和自有进程；不向真实数据库、Redis、远端或容器栈写入。

| 检查 | 本轮结果与边界 |
| --- | --- |
| 根工具回归 | 链接 13、OpenSpec 17、连接配置 25、MCP 包/退出 9、compress 27、共享运行时 16 场景通过；独立复核复现的进程树、超时、连接池参数和 metadata 假通过已关闭 |
| 后端工具回归 | 14 组隔离 smoke 回归通过，含挂起响应体/HTTP、非法超时与 Redis 错误；未启动真实 Java/Redis/数据库 |
| 部署/远程回归 | deploy-cli 26、安全脚本 29 场景通过（含 Redis 旧认证迁移 7 分支，安全套件亦在 macOS Bash 3.2 通过）；push/release/bump、版本参数及发布资产隔离回归通过。不代表真实 Docker/Apple、远端 Actions 或仓库保护已验收 |
| 前端工具回归 | CRUD/lifecycle 18、浏览器/栈/DevTools 8、登录种子 7 场景及静态矩阵回归通过；未执行真实 DOM/业务数据库 E2E。矩阵 115 条，P0=24 / P1=64 / P2=27、静态 gap=0，不代表已运行 115 个用例 |
| 链接 | 所有维护 Markdown 的支持语法本地链接/锚点检查通过；外链去重后 13 个，12 个 HTTP 200，`https://linux.do` 返回 403，保留正确地址并记录可达性未证实；不以 HTTP 200 证明语义正确 |
| 编码/静态/结构 | 全仓 UTF-8、README、规约路由、active change 与版本检查通过；所有维护 Node/Bash/Python 语法、YAML/TOML/XML/package 解析、五技能格式/UI metadata 及安全帮助检查通过 |
| 差异与范围 | 无产品 Java/React/Vue 实现、依赖/lockfile、SQL 基线修改；`git diff --check` 通过；本地计划/证据未跟踪；未执行远程写入、真实部署或凭据变更 |

`application.yml` 是 Maven 过滤前源码，按真实 POM 的 local/dev/prod 属性替换后解析，未以删占位符或改产品配置制造通过。YAML/XML 解析只是语法检查，不等于 Actions、Compose、systemd、nginx 或 Dockerfile 的运行验收。Windows `.bat` 已核命令与退出码逻辑，未在 Windows 执行。

没有修改产品业务实现或依赖，因此产品构建和业务单测不作为本次工具改动的验证替代；全部行为改动由对应工具回归覆盖。真实登录/CRUD、容量、恢复、远程 CI 与多平台执行仍未验证。

## 仍需关闭的生产条件

| 阻塞或未验证条件 | 事实、影响与关闭标准 |
| --- | --- |
| React 子路径与 OAuth 回跳 | `BrowserRouter` 缺少 basename，Vite base 不能独立实现子路径部署；双端 OAuth 绑定构造绝对 redirect 与回跳校验冲突。需补实现和路由/绑定回归，不能仅靠构建通过 |
| 小程序登录前能力探测 | `/auth/wechat-miniapp/enabled` 未列入默认公开路径/`security.excludes`，严格认证下匿名探测被拦截。需修正公开探测权限契约并补允许/拒绝场景 |
| Push 失败观测 | `SysMessagePushListener` 的失败日志缺通道字段，Push 关闭时直接返回且无规格要求的失败分类。需补实现与行为验证，保留现有通知规格要求 |
| 返回字段翻译失败 | `TranslationHandler` 捕获异常后输出原值，并记录 type/value；失败不总是显式返回给调用方，敏感原值也不能靠翻译遮蔽。需独立核定允许回退的字段与失败语义、日志脱敏，再补序列化回归；本轮未改产品行为 |
| 生产凭据与 RSA 构建 | 目标环境独立 DB/Redis/token/RSA 替换未核验；前端 Dockerfile 无 RSA build ARG 接口，Release 构建使用仓库示例 env，宿主运行时 env 不能替换浏览器构建产物。需受控构建、匹配核验和产物检查；浏览器内私钥不能保护服务端秘密 |
| 权限迁移与实际镜像用户 | 已消除自动 `0777`，但未替已有目录批量 chmod/chown；现有目录必须按实际镜像 UID/GID、备份和挂载核验后迁移。需在目标镜像验证读写、重启/升级及最小权限 |
| 网络/TLS 与对象存储 | Compose 多项端口默认对所有网卡发布，网关未启用 TLS；仅映射 443 不会提供 HTTPS。`minio/mc:latest` 仍浮动且初始化设置匿名下载；生产需固定受控镜像、收紧端口、验证 HTTPS 与私有文件授权 |
| 真实测试数据恢复 | 工具已增加精确键、失败和收口断言，但未对真实 UI/API/DB 完成端到端运行；local JDBC 配置不自动识别后端 env 覆盖。执行前核对同一隔离实例，硬终止/掉电/凭据失效后按 run 证据人工恢复 |
| 目标平台与远端 | Windows PowerShell 5.1、WSL2/Linux Docker、真实 Apple 栈、nginx/systemd 和 Release Actions 未运行；需取得实际 readiness、登录、端口归属、产物及退出/回滚证据 |
| 运行保障 | 容量、告警触发/恢复、备份还原、迁移回退与恢复目标未演练。需要实际结果和责任人，静态配置不能代替上线保障 |

后端 `messages_en_US.properties` 另缺少 `email.code.scene.not.blank`、`email.code.scene.not.valid`、`user.email.already.exists`、`user.forgot.password.invalid` 四项消息键，属于产品资源问题，尚未修复；需补齐并核验对应英文响应。

测试执行和人工恢复见[测试政策](./TESTING.md)与[数据运维](./DATA-OPS.md)；部署前提、迁移与回滚见[部署生命周期](../deploy/DEPLOYMENT_LIFECYCLE.md)和[部署验证](../deploy/VERIFICATION.md)。本轮未执行高风险环境操作或凭据轮换。

## 可复用审计与回归 SOP

触发条件：全仓审计，或规则、skill、命令参数、环境前置条件、发布/部署入口变化。

1. 写唯一验收约定，保留当前 diff；独立发现维护 Markdown 与操作/config，包含隐藏目录和未被文档引用的入口，记录排除理由。
2. 每份文档追溯到当前解析器、package/POM、env/config 与源码，核对默认值、前置条件、读写副作用、日志、失败和恢复；根规约结构检查后仍需人工语义审查，近层规约分别核查。
3. 按最小问题类别修复。连接解析用合成 YAML；进程生命周期用自有父/孙进程与同组无关进程；浏览器用可控制关闭/中断的替身；CRUD 用 API/DB 正反数据、精确键与查询失败。测试须断言状态、退出码和副作用，不只检查源码字符串。
4. 远程 CLI 用本地 bare origin 和 gh 替身，核目标绑定、预览、鉴权、保护、参数冲突及资产；部署用命令替身和隔离目录，覆盖权限、渲染错误、归属不符、daemon 故障和升级边界，不触达真实栈。
5. 从主流程验证 → 定向回归 → 编码/语法/结构等价检查 → 人工 diff 顺序验收。新反例先复现再修根因，不弱化断言；每类 SOP 沉淀到既有 skill references 或 tools/docs。
6. 重新发现新增/删除文件，核对最终 hash、唯一负责人和状态。清单缺项、重复、未核验或门禁失败阻止交付；复审必须使用本轮证据，不能复用上轮通过结论。
7. 独立复核最终差异和耐久报告，区分已修、实现阻塞与环境未验证；记录性能、可观测性、回滚、config/SQL/依赖影响，报告实际边界。

反模式：整批执行代码块、把查询异常记成空集合、把发出 kill 当作退出、将 daemon 失败当资源不存在、将 readonly 开关当服务端 ACL、用旧演练或示例凭据证明生产达标、用链接/语法通过代替操作语义。

## 影响与回滚

- 性能：未改变业务请求路径；工具增加有限时请求、批量进程/资源核验及断言。真实应用容量与生产文件量未测。
- 可观测性：保留阶段、退出码、未知残留、主错误与清理错误，敏感输出脱敏；生产指标与告警仍须演练。
- 配置/SQL/依赖：调整部署目录/Redis认证与 IT 隔离、Release 资产校验和 CLI 行为；无 SQL 变更、依赖升级或 lockfile 漂移。旧部署采用新脚本前必须遵守迁移门禁，不能只覆盖文件后重启。
- 回滚：若本轮修订失真、门禁弱化、行为回归或清理失控，按文件撤销对应自有修改块，保留其他协作者改动并重验。涉及 Redis 配置/认证方式时须同步恢复对应 Compose/容器配置；本轮未改真实环境，无运行态回滚已完成的声称。

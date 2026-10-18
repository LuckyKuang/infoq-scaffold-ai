# 文档与交付入口审计（2026-10-18）

本次核查覆盖仓库维护的 Markdown、各层规约、五个 CLI 型技能，以及独立发现的脚本、帮助、配置示例和 CI 入口。文档修正与隔离工具回归不能证明生产环境已验收；本页同时保留尚未解决的运行态阻塞。

本次范围是维护文档及其交付入口的准确性，异常显式记录，回滚按自有修改块进行；具体任务计划仅保留本地，不纳入公共底座。长期约束见[平台治理规格](./specs/platform-governance/spec.md)。

## 覆盖口径

使用 `git ls-files --cached --others --exclude-standard -z` 盘点已跟踪与非忽略新增文件，包含隐藏维护目录、`.md`/`.markdown`、规约与示例。初始 148 份 Markdown 全部完成核对；按用户要求删除 3 份原受管历史计划及 1 份本次新增计划后，交付清单为 **146 份**（包含新增审计记录）；独立入口清单为 **213 项**，含 68 个脚本、metadata/构建/运行配置及 1 项部署数据资产的存在性核查。逐文件清单、脚本/config 交叉清单、命令与退出码保存在本次工作区的 `tmp/documentation-audit/`；该临时证据不随发布交付，复查时按下述 SOP 重新生成。

| 责任域 | Markdown | 独立入口/配置 |
| --- | ---: | ---: |
| 根规约、导航、治理、compress-cli | 27 | 39 |
| React/Vue、架构/设计、测试、test-cli | 51 | 58 |
| backend、验证工具、业务规格 | 48 | 65 |
| deploy、deploy-cli | 12 | 37 |
| push/release、GitHub CI | 8 | 14 |
| 合计 | 146 | 213 |

逐项对账无缺项、重复或未认领项目。规约包含 4 份 `AGENTS.md` 与 2 份 `GEMINI.md` 指针，未发现其他层级规约文件；五个技能的全部正文、references、metadata 与脚本均有记录。这里的“已核对”指文件事实和操作说明已核对，含已明确记录的实现阻塞，不代表所有入口都能用于生产。

排除 `.git`、第三方依赖、缓存、构建产物和 `tmp/`。`openspec/changes/` 与 `docs/plan/` 都是忽略的本地计划目录；本次 active change 单独执行结构及编码校验。`docs/plan/` 的现有计划按用户要求删除并移出版本控制；后续执行计划仍写入该目录，按需创建，由用户手动清理，不再提交。生成的 case matrix 仍是受管交付文档，纳入检查。

独立入口包括所有受管 Node/Bash/Python/Windows 包装脚本、五份技能 metadata、宿主配置、CI、package/lockfile、POM/自动配置入口、环境示例与部署配置。业务 Java/页面、25 份业务 Mapper XML、3 份 i18n properties 和二进制内容不是操作入口，按相关文档作为事实来源核对，本次不声称完成全业务源码或第三方安全审计。二进制数据资产只核验路径与部署引用，不核验库内容质量。

覆盖检查分成两份清单：文档记录类型、责任域、事实来源和处理结论；脚本/config 记录解析入口、默认值、前置条件、副作用、文档入口及未验证条件。链接检查仅证明其支持语法中的本地目标和锚点存在，不证明命令、安全语义或生产运行正确。

## 已修正的主要问题

| 领域 | 修正与依据 |
| --- | --- |
| 规约与 AI 协作 | 同步六个交付面的 OpenSpec 模板与校验；本地计划目录纳入 Git 忽略，允许按需创建并继续写入，由用户手动清理；规约校验仍核验忽略规则、具体文件存在性和路径边界；区分规约结构校验和人工语义审查；明确仓库 `skills/` 路由不等于宿主原生自动发现；按 `.codex/config.toml` 修正 MCP 工具、审批、只读及缓存说明 |
| 开发与架构 | 核对 Node/pnpm/JDK/Maven、实际启动目录、可选且被忽略的 local profile、双端路由/API/store、分包和样式说明；删除无证据的能力与达标声称 |
| 部署 | 补齐独立凭据、RSA 构建匹配、HTTPS、配置挂载、平台选择、探测副作用和回滚条件；修正 nginx 重复 location、卸载确认输出、systemd 运行标识注入和 deploy-cli env/端口/smoke 行为 |
| 推送与发布 | `push`、`submit-pr`、`merge`、`tag`、`publish` 默认预览，写入显式 `--execute`，合并另需 `--yes`；参数冲突先失败；说明 tag 自动触发 Release 工作流与手工发布的边界 |
| 版本同步 | `bump` 先在内存完成全量匹配校验，再写文件；新增受管 `deploy/.env.example` 版本字段；移除已改为运行时注入标识的静态替换目标；用隔离副本运行真实版本检查器 |
| 验证工具 | 修复 smoke 静默切换鉴权模式和敏感输出问题；扩展链接发现、解析和失败定位；OpenSpec 只认可影响矩阵章节；修正插件计划参数与命令目录、MCP 缓存位置及静态 case matrix 事实 |
| 数据与测试说明 | 明确迁移应用记录、DDL 隐式提交、备份恢复与应用回滚差别；说明登录/路由测试会写 Redis、CRUD 测试会写业务数据，记录当前 runner 的真实限制 |

## 验证边界与复核命令

所有命令从仓库根运行。主流程先核对根入口 → 工作区/技能 → 真实解析器与配置 → 失败/恢复说明；然后运行隔离回归，再执行编码、语法与差异检查。不批量执行 Markdown 代码块。

```text
node tools/check_doc_links.mjs
node tools/check_readme_sync.mjs
node skills/compress-cli/scripts/agents_check.mjs check
node tools/test_check_doc_links.mjs
node tools/test_openspec_tools.mjs
node tools/test_mcp_cache.mjs
node skills/compress-cli/scripts/test_agents_check.mjs
node tools/verify/test_smoke.mjs
node skills/deploy-cli/scripts/test_deploy_cli.mjs
node skills/push-cli/scripts/test_push_cli.mjs
node skills/release-cli/scripts/test_release_cli.mjs
node skills/release-cli/scripts/test_bump_version.mjs
node skills/test-cli/scripts/test_case_matrix.mjs
node skills/test-cli/scripts/test_redis_captcha_seed.mjs
node tools/validate_utf8.mjs
node tools/openspec_check.mjs audit-production-documentation
node tools/check_release_version.mjs
git diff --check
```

上述 OpenSpec 命令只在保留本地 change 的本次工作区适用。脚本回归使用临时 Git 仓库、gh 替身、回环 HTTP 服务与本地 fixture，不向真实远端、数据库、Redis 或容器栈写入。

| 校验 | 本次结果 |
| --- | --- |
| 本地链接 | 146 份 Markdown、543 个本地链接、14 个锚点，0 失败；40 个外部 URL 未抓取，模板/不支持的 fragment 跳过数均为 0 |
| 工具隔离回归 | 链接 13 场景、OpenSpec 17 场景、compress 14 场景、backend smoke 8 场景、deploy-cli 21 场景、Redis 种子 4 场景通过；MCP 缓存、push、release、bump、case matrix 行为回归通过 |
| 静态矩阵 | 115 条，P0=24 / P1=70 / P2=21，静态 gap=0；不代表用例已运行或完整业务覆盖 |
| 编码/结构/版本 | 全仓 1948 份文本 UTF-8、README 同步、AGENTS 路由、active change 结构及版本 3.0.0 的 13 个真值源检查通过；`push-cli check --profile docs` 全部通过 |
| 脚本/配置与技能 | 148 项静态与帮助检查通过：50 个 Node 脚本、14 个 Bash 脚本、1 个 Python 源、25 份 YAML、5 份 TOML、30 份 XML、4 份 package JSON，另含帮助/技能格式/UI metadata 检查；部署文档 97 个 Bash 代码块语法通过 |
| 差异 | 无业务 Java/页面、依赖/lockfile、SQL 基线变更；`git diff --check` 通过；保留原有修改，无真实远程写入或部署状态变更 |

`application.yml` 是 Maven 过滤前源码，不能当作原始 YAML 直接解析；本次读取真实 POM 的 local/dev/prod 属性逐一替换后解析，未运行 Maven 构建。最初检查器对此的解析失败与错误的 help 调用保留在临时证据，纠正验证方法后复核通过；没有放宽产品配置或门禁。

本次没有修改 Java、React/Vue 产品实现、依赖/lockfile 或冻结 SQL，业务单测与产品构建不适用；脚本行为修改由对应工具回归验证。未运行实际登录、CRUD E2E、生产部署、Release Actions、容量或灾备演练。外部 URL 只做分类统计，除特定官方资料核验外，不宣称已验证全部外链可达。

## 仍阻塞生产验收的事项

| 阻塞或未验证条件 | 影响与关闭条件 |
| --- | --- |
| CRUD runner 数据断言不足 | `verifyApiDb` 主要记录快照，缺少 create/update/delete 预期数据库结果断言。补齐业务断言及正反回归前，不能用该 runner 的通过结论证明数据一致性 |
| CRUD runner 查询失败可被判为无残留 | `finalDbResidue` 把查询失败返回为 `{error, rows: []}`，后续按空行统计；必须让查询失败显式失败，并覆盖“查询失败不可通过”的回归后，才能依赖残留检查 |
| 中断与进程状态不完整 | CRUD runner 的信号处理中数据清理/报告收尾不可靠；通用浏览器 runner 的状态文件生命周期未完整满足规约。需覆盖正常、失败、信号中断和二次启动清理，再开展带数据运行态验收 |
| React 子路径与 OAuth 回跳 | React `BrowserRouter` 缺少 basename，设置 Vite base 不能独立实现任意子路径；双端 OAuth 绑定构造的绝对 redirect 与回跳校验存在冲突。应先补实现及对应路由/绑定流程回归，不能仅凭页面构建通过验收 |
| 小程序登录前能力探测被鉴权拦截 | `/auth/wechat-miniapp/enabled` 未列入默认公开路径及 `security.excludes`；默认严格认证下，匿名客户端无法按规格先探测功能开关。需修正公开探测的权限契约并补正反测试，再启用该能力 |
| 消息 Push 失败观测不满足规格 | `SysMessagePushListener` 当前失败日志缺通道字段，Push 关闭时直接返回，未记录规格要求的失败分类。保留通知规格要求，补齐实现与行为测试后才能宣称覆盖 |
| 生产凭据与前端构建密钥 | 尚未核验目标环境是否替换仓库示例数据库/Redis 密码、token secret 与 RSA；前端 Dockerfile 没有 RSA build ARG 接口，宿主 env 或运行时 env 不会自动替换已构建浏览器密钥。必须通过实际受控构建路径核验匹配并检查产物；浏览器私钥不能保护服务端秘密，公网仍需 HTTPS |
| 部署权限与网络默认值 | helper 存在 `chmod 777`、含密码 Redis 配置设为 `644`，且后续运行可能覆盖手工权限；Compose 默认向所有网卡发布多项服务端口、网关默认无 TLS。需修复权限与受控配置渲染、收紧网络并实测 TLS；仅映射 443 不会启用 HTTPS |
| 对象存储与卸载归属 | 初始化使用浮动 `minio/mc:latest` 并设置匿名下载；通用容器名卸载没有自动 ownership 核验。生产需固定镜像、验证私有文件授权，并为部署/卸载落实归属校验；详见部署生命周期第 9 节 |
| 集成测试数据隔离 | Elasticsearch IT 配置的数据目录仍需按独立项目与临时路径隔离；不得将集成测试脚本指向生产或共享目录。运行前核对实际 Compose project、挂载和清理范围 |
| 目标运行环境 | 尚未实测 Windows PowerShell 5.1、WSL2/Linux Docker、目标公网 HTTPS、最小权限与端口暴露。按对应平台 SOP 取得实际 readiness、登录、代理与回滚证据 |
| 上线运行保障 | 容量、告警触发/恢复、备份还原及迁移回退未演练；需有实际结果、负责人和恢复目标。静态配置与示例不等于监控已覆盖 |
| 远端 CI/发布 | 本次仅静态核对 workflow 与本地隔离回归；首次实际 Actions、tag 对应提交、发布资产和受控密钥产物仍须验证 |

测试运行风险、参数和恢复步骤见[测试政策](./TESTING.md)；部署路径见[部署验证](../deploy/VERIFICATION.md)。本次审计不执行凭据轮换或高风险环境操作。

## 可复用审计与回归 SOP

触发条件：全仓审计，或修改规则、skill、CLI 参数、配置/环境前置条件、发布与部署入口时。

1. 写验收约定，保存当前 diff，按维护文件独立盘点文档与脚本/config；为新增文件重新盘点，为排除项记录理由。不得只检查 Markdown 引用到的脚本。
2. 逐文件追溯命令解析器、package/POM、env/config 与真实实现。规约检查结构后仍须审查语义，历史计划与模板不能充当当前行为证据。涉及官方工具行为时引用适用官方资料。
3. 按最小问题类别修正并同步入口。对工具行为先建立最小 fixture：链接工具用临时 Git 文档树；OpenSpec 用真实初始化/完整矩阵/缺项拒绝；MCP 缓存用本地假包；版本同步用完整副本与真实版本检查器。测试必须断言退出码、目标内容和副作用边界。
4. 远程 CLI 用隔离本地 bare origin 和 gh 替身，验证默认/显式预览、执行、鉴权/确认失败、未知参数、双向冲突参数均保持门禁。禁止测试触达真实远程或拿源码字符串匹配代替行为验证。
5. smoke 用回环 HTTP fixture 验证模式拒绝、失败定位和敏感输出；case matrix 用最小路由与分类 fixture 验证生成数量、gap 与无覆盖漂移。对应领域 SOP 见 `tools/verify/README.md` 和技能 references。
6. 按主流程 → 定向回归 → 编码/语法/结构等价检查 → 人工 diff 顺序验收。任何失败先修根因，不修改断言制造成功；证据仅保存脱敏日志、命令、退出码和平台。
7. 对账清单无未认领或重复项，把未验证与实现阻塞写入耐久报告；未通过必需验证不得标记生产 ready。

反模式：运行整份代码块；把 HTTP 返回内容视为成功而不检查状态；把 readonly 配置视为服务端 ACL；把默认示例凭据或旧演练当成本次生产证据；用链接通过证明文档语义正确；吞掉查询异常后输出“零残留”。

## 发布前影响与回滚

- 性能：未改变业务请求路径；工具只在显式运行时处理本地文件或隔离 fixture，真实应用容量未测。
- 可观测性：检查器保留文件/行、失败输入和非零退出码，smoke 对鉴权输出脱敏；生产指标与告警覆盖仍待演练。
- 配置/SQL/依赖：修订部署示例、nginx、systemd、工作流权限和 CLI 行为；无数据库迁移、依赖升级或冻结初始化 SQL 修改。采用示例前仍须按环境复核。
- 回滚：若修订失真、门禁弱化或工具回归，按文件恢复本次自有修改块并重跑对应检查，保留已有修改；实际写入 `bump` 遇到磁盘 IO 错误仍可能部分写入，应先保存 diff 并核验版本一致性。远端/部署/数据状态本次未改，无运行环境回滚动作。

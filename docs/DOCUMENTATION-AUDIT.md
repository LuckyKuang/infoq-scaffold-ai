# 文档审计与生产缺口修复（2026-10-18）

本页保留两轮独立证据：下方“覆盖口径”至“验证边界与命令”记录已提交 `825df05` 的文档/工具审计；“生产缺口修复与目标环境条件”记录此后用户授权的产品、构建、部署及运维修复。历史数量和通过结果不作为本轮产品验证证据。**仓库修复及本机隔离回归不等于生产验收**，生产基线为 Linux Docker。

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

## 生产缺口修复与目标环境条件

本轮基于 `825df05` 修复实际实现，未执行 commit/push/Release、远程 Actions、生产部署或凭据轮换。验收约定与执行计划继续只保留在 Git 忽略目录，耐久要求已同步到 `docs/specs/`。本轮证据在 `tmp/production-readiness/`；不得用前述文档审计数字替代下列结果。

| 领域 | 仓库修复与本机验证 | 目标环境关闭条件 |
| --- | --- | --- |
| React/Vue 路由与 OAuth | React basename 与 Vite BASE_URL 同源；双端安全站内回跳保留部署前缀一次，登录/授权/ticket 前拒绝非法输入。服务端由受控 base 映射选择 callback，无法识别客户端的多端失败显式返回脱敏错误。根/子路径真实产物、组件回归和 HTTP/Provider 替身浏览器检查覆盖主流与边界 | 目标 Linux 反代、刷新、真实会话/Provider、身份绑定及真实角色权限需实机验收；替身不是 Provider 或业务数据库验收 |
| 小程序与英文消息 | 仅精确公开 GET 能力探测；真实 Spring Security filter chain 覆盖允许/拒绝，禁用时无远程调用。四项英文消息补齐并以 MessageSource 解析验证 | 真实微信 AppID/Secret、身份绑定与远程 code 登录需独立受控环境 |
| Push 与 Redis | AFTER_COMMIT、通道故障隔离与持久消息保持；记录 disabled/channel_unavailable/offline/published/failed，跨节点不确定保持 unknown，不宣称客户端送达。节点/心跳核验使用有限批量 OSS API；安全日志不含正文或用户列表 | 真实 Redis OSS 多节点、浏览器通道、故障与告警接收需运行验证；无 ACK 不承诺送达 |
| 返回字段翻译 | 不可变字段上下文，真实 Jackson 多字段/mapper/null/并发测试；缺实现/执行异常显式失败，不回写原值，日志与异常不携敏感原因 | 既有脏数据或缺失翻译实现会明确暴露；目标真实数据应验证，不能恢复静默原值 fallback |
| 生产配置与构建 | 默认严格预检、受控文件/托管环境、两组独立2048位以上 RSA 交叉校验，拒缺项/示例/错配。Docker 使用 BuildKit secret；Release 使用受保护环境受控配置并核产物。隔离真实加密构建标记 deployable=false；后端请求私钥不得进入浏览器包或构建层 | 生产独立凭据来源/替换、环境审批、真实 artifact 与目标后端匹配须核验；仅格式/指纹通过不能证明来源受控，浏览器协议私钥公开可见 |
| TLS、端口与私有 OSS | 生产网关受控 TLS 渲染并检查证书/私钥/域名/有效期，重跑保留 HTTPS；辅助端口默认 loopback。固定 mc，bucket 与后端元数据私有；内部 S3 HTTP 与独立外部 HTTPS 签名 origin 分离，保留 Host/path。真实 crypto/文件及 Docker 替身回归覆盖异常与恢复边界 | Linux Docker/nginx 配置加载、公开端口、真实 CA/DNS、授权签名/匿名/过期访问需实机证据；不将 X509/fixture 当生产信任链 |
| 目录与策略迁移 | 预览默认、显式执行、归属/共享挂载/实际镜像账户/备份核验；同轮新建空目录按镜像用户初始化，旧目录只验证读写。保留权限/策略快照与恢复路径，不盲目递归 chown/chmod、不删除对象 | 新空 bind 首装与既有目录均须在实际镜像 daemon UID/GID 下验证读写、重启/升级及恢复；Linux runner 的数据 named volume 不替代生产 bind 初始化验收，本轮未迁移共享数据 |
| 恢复、回滚与保障 | Node 运维工具覆盖备份完整性、全新 owned project 恢复、字段/关联及对象 hash、readiness/业务、固定镜像应用回滚。告警区分信号/触发/接收/恢复；容量有界并在 SLO 失败时失败。fixture/真实回环 HTTP 回归覆盖中断和清理失败 | 真实 Linux 恢复/跨版本回滚、真实告警回执、生产容量及业务 RTO/RPO 待验；备份年龄不是 RPO，应用回滚不逆向 SQL |
| 平台与自动化 | 增加 Windows/macOS/Linux Node CLI 矩阵、PowerShell 5.1 job、手动 Linux Docker 全栈验收 workflow 与同源本地入口，明确目标、状态、失败及 owned 清理；Colima Ubuntu 内真实整栈已通过，见下文 | 原生 Linux 生产宿主、远程 Actions、Windows/WSL2/Apple 实机尚未验证；不以 Colima 替代其他平台或生产外部条件 |

本轮已执行：前端 React **94**、Vue **101** 项定向单测、双端 lint、根/子路径共 **4** 次真实 production 构建及产物扫描、**24** 项浏览器 HTTP/Provider 替身流程和 **8** 项 CLI/信号清理检查；后端完整 **31** 类 **172** 用例 package 后，OAuth/RSA 增量复验通过，当前所选测试集合合计 **176** 用例，每轮 Maven 均小于 60 秒。配置回归 **28** 项、双端真实 JSEncrypt **4** 方向、部署 CLI **26** 项、安全脚本 **29** 项、运行时 **20** 项和运维 **17** 项通过。后端增量不冒称单次全套结果，脚本替身不作为实际容器证据；命令、分轮日志、hash 与清理结果分别保留在本轮 `tmp/production-readiness/` 域汇总中。

实际命令与复用 SOP：

```text
node tools/test_production_config.mjs
node tools/test_production_crypto.mjs
node skills/deploy-cli/scripts/test_deploy_cli.mjs
node skills/deploy-cli/scripts/test_deploy_safety.mjs
node deploy/bin/test-production-runtime.mjs
node tools/verify/test_production_ops.mjs
node tools/verify/test_linux_acceptance.mjs
node tools/verify/linux_acceptance.mjs --run-id acceptance-001
```

最后一条只预览；真实执行须在可丢弃的本机 Linux Docker 环境显式追加 `--execute`，并核最终 cleanup。Node/Vitest/Maven、lint、实际 Vite build、产物扫描、浏览器替身和语法/文档门禁分别保存命令与结果；后续授权的 Colima 实测结果独立记录如下。

## 2026-10-18 Colima 实测补充

用户授权本机安装 Colima 并跑完整流程。已安装 Colima 0.10.3、Lima 2.2.1、Docker CLI 29.9.1、Compose 5.6.0 和 Buildx 0.38.0；独立 `infoq-verify` profile 为 Ubuntu 24.04.4 / ARM64、Docker Engine 29.5.2 / Compose 5.1.4，6 CPU / 8 GiB。宿主原 Docker context 为 `default`，未切换。源码与 bind 数据在 VM 原生 ext4 工作副本，避开本轮实际复现的 VirtioFS 文件创建权限问题；DNS 的 systemd-resolved 缺失也已修复。

`linux-colima-007` 真实执行通过：Maven/双端 BuildKit 构建、双域 TLS/nginx、辅助端口归属、匿名拒绝、私有 S3 签名/匿名/过期、四类实际 daemon UID/GID 读写、真实 Redis 验证码加密登录和菜单、React/Vue 根/子路径 DOM/刷新、整库与对象备份/独立恢复、固定镜像与故障配置回滚。浏览器关闭及 owned project 容器/卷/网络删除已复查为 `verified`。四种镜像产物另通过 **24** 项 HTTP/Provider 替身浏览器流程；不冒称真实 Provider。

实机发现并修正证书权限受 umask 影响、管理密码超过后端 30 字符契约、BuildKit secret 变化未使前端构建缓存失效、单文件 bind 对原子替换配置继续引用旧 inode，以及验收中的异步页面响应竞态。双端分别实际验证 A→密钥轮换 B→相同 B，轮换不命中旧构建，重复 B 命中缓存；抽取产物均扫描通过。当前配置 **30**、构建缓存 **15**、真实加密 **4**、首次安装安全 **7** 及运维 **17** 项隔离回归通过；新增反例保持严格失败语义。

独立 `first-install-bind-first-003` 已直接运行真实 `install.sh`，在新 ext4 bind 目录通过首次初始化、实际账户/0750 权限与读写、TLS、私有 S3、重启前后真实登录/菜单和 SQL/对象持久性。原固定 `minio/mc` 镜像已不可匿名拉取，已改用官方固定 Release 二进制与双架构 SHA-256，自建工具镜像并核实际版本、架构与摘要；此安装已使用修复后的真实工具。首装 owned 容器、匿名卷及网络均已清理核验。

两端 builder/final 共 **4** 个真实镜像另完成全部 **53** 层（约 3.60 GB 解压字节）、config/history 与 attestation 扫描，按固定镜像身份验证 OCI descriptor、大小和解压层摘要；本轮请求私钥的 DER/Base64/PEM 形式与六类服务端 fixture 凭据均未命中。原始层导出保留 `0600`；宿主仅复制脱敏结果。

真实 bucket 策略往返另发现 MinIO `Action` 集合输出顺序不稳定，旧回读按 JSON 字符串比较会误判；已仅对该集合按语义比较，原始策略与备份 checksum/identity 完整性仍严格校验。`download`、`upload`、`public` 三类策略均通过预览零策略/备份写入、迁移 private、恢复原权限及对象内容保持，owned 容器已清理。新增身份、固定客户端来源、失败不重试、协议与策略篡改反例后，运行时回归当前 **30** 项通过。

本地证据保留在 Git 忽略的 `tmp/production-readiness/colima/` 与 VM 同源 run root，包含脱敏状态、截图、镜像身份和清理结果；不能上传包含配置、私钥和备份的整个 `tmp/`。安装与复用步骤见 [Colima SOP](../deploy/COLIMA.md)。原生生产宿主、真实 CA/DNS、受控生产秘密来源、OAuth/微信 Provider、Redis 多节点通知、外部告警接收、容量 SLO、业务 RTO/RPO、跨真实版本回滚及远程平台矩阵仍须独立验收。

收口：1,490 个构建/产品文件与 VM 当前工作副本 SHA-256 一致；18 份脱敏证据的大小/hash 经独立复核。19 个应用/浏览器端口可绑定、浏览器进程/容器/卷/owned 网络无残留，专用 VM 已停止，安装与证据保留，宿主原 `default` context 未变。本机修改不包含 commit/push 或远程 Actions。

本次影响检查：配置预检与工具身份校验位于构建/部署阶段，不新增业务请求 IO；首次 mc 工具准备新增 Node/BusyBox 固定镜像和官方 GitHub 下载，失败显式阻断。部署错误和回读错误保留安全阶段/代码，恢复/回滚及 owned 清理已在隔离实例演练；生产告警与容量仍待目标证据。新增随机测试配置只用于隔离环境，无冻结 SQL、package/POM 依赖或 lockfile 变更；旧共享策略/目录迁移仍须预览、备份与明确授权。

受控构建见[发布流程](RELEASING.md)，生产部署与迁移见[生产配置](../deploy/PRODUCTION.md)，隔离验收/恢复/回滚/告警/容量及其边界见[生产保障](PRODUCTION-OPS.md)，前端回归与真实业务限制见[测试政策](TESTING.md)。真实凭据、证书和生产数据无需发入对话，只通过目标受控文件/环境提供。

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

## 上一轮文档审计的影响与回滚

- 性能：未改变业务请求路径；工具增加有限时请求、批量进程/资源核验及断言。真实应用容量与生产文件量未测。
- 可观测性：保留阶段、退出码、未知残留、主错误与清理错误，敏感输出脱敏；生产指标与告警仍须演练。
- 配置/SQL/依赖：调整部署目录/Redis认证与 IT 隔离、Release 资产校验和 CLI 行为；无 SQL 变更、依赖升级或 lockfile 漂移。旧部署采用新脚本前必须遵守迁移门禁，不能只覆盖文件后重启。
- 回滚：若本轮修订失真、门禁弱化、行为回归或清理失控，按文件撤销对应自有修改块，保留其他协作者改动并重验。涉及 Redis 配置/认证方式时须同步恢复对应 Compose/容器配置；本轮未改真实环境，无运行态回滚已完成的声称。

## 本轮生产修复的影响与回滚

- 性能：OAuth 校验限解码深度，前端无新增远程查询；WebSocket 节点/心跳改有限批量读取并保留失败；翻译失败不返回原值。容量仍须真实生产目标测量。
- 可观测性：Push 区分逐通道发布/失败与未知连接；翻译使用安全阶段/类型/字段/异常类别；CLI 保留主要错误与清理错误，SLO 失败和未知恢复证据保持非成功。生产告警收件与恢复仍须实际回执。
- 配置/SQL/依赖：新增受控生产配置、RSA/TLS/OSS origins、callback base 映射与 BuildKit secret；公共默认更严格。冻结 SQL 不变，无依赖升级或 lockfile 变化。旧目录/bucket/config 不得直接覆盖迁移，必须预览、备份、核归属。
- 回滚：对应代码、受控配置与已验证旧镜像一起回退；应用回滚保留数据，不自动逆向 SQL。TLS/权限/策略有原状态恢复路径，实际共享环境恢复需单独授权。本轮未执行生产或共享环境回滚，不声称已完成真实演练。

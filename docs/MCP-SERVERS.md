# 项目 MCP Server 说明

本仓库的 MCP 真值源是 `.codex/config.toml`。
凡是 server 名称、tool 白名单、审批模式、超时或启动脚本路径，都以该文件为准。

## 1. 当前启用状态

| Server | 状态 | 传输方式 | 主要用途 |
| --- | --- | --- | --- |
| `playwright` | 已启用 | STDIO | 浏览器交互探索与补充验证 |
| `chrome-devtools` | 已启用 | STDIO | Network / Console / Performance 深度调试 |
| `mysql` | 可选、默认禁用、只读 | STDIO | 查看本地或测试 MySQL 上下文 |
| `redis` | 可选、默认禁用、只读 | STDIO | 查看本地或测试 Redis 上下文 |

## 2. 与 repo-owned CLI 的边界

下列命令不是 MCP server，而是仓库内脚本入口：

- `playwright-cli`
- `chrome-devtools-cli`

它们位于：

- `skills/test-cli/scripts/playwright_cli.mjs`
- `skills/test-cli/scripts/chrome_devtools_cli.mjs`

项目级 MCP 的本地启动入口位于：

- `tools/mcp/start_playwright_mcp.mjs`
- `skills/test-cli/scripts/chrome_devtools_cli.mjs`
- `tools/mcp/start_mysql_mcp.mjs`
- `tools/mcp/start_redis_mcp.mjs`

与上述 MCP 启动链路直接相关的 `tools/` 共享 helper 目前只有两个：

| 路径 | 角色 | 文档定位 |
| --- | --- | --- |
| `tools/resolve_backend_local_mcp_env.mjs` | 统一按 `application-local.yml -> application-dev.yml` 顺序解析 backend 本地配置，并抽取 MySQL / Redis 只读环境变量；当前同时被只读 MCP 启动脚本、`docs/DATA-OPS.md` 与 `tools/verify` 复用 | 内部 helper，不单独作为用户入口 |
| `tools/launch_cached_mcp_package.mjs` | 优先复用本机 npm / npx cache 中已存在的 MCP 包；缓存未命中时再回退到 `npx -y <package>` 下载启动 | 内部 helper，不单独作为用户入口 |

`playwright` MCP 启动时优先复用本机 npm / npx cache 中的 `@playwright/mcp`，缓存未命中时由共享 helper 回退到 `npx -y @playwright/mcp`。`chrome-devtools` MCP 固定使用 `skills/test-cli/scripts/chrome_devtools_cli.mjs`，版本由 `skills/test-cli/scripts/package.json` 的 `chrome-devtools-mcp@0.25.0` 决定。

`mysql` / `redis` MCP 默认行为：

- 按 `application-local.yml -> application-dev.yml` 顺序读取当前开发者后端依赖配置
- 显式环境变量优先级高于解析出的 backend 配置值
- 共享文档示例统一使用本地依赖基线：MySQL `127.0.0.1:3306/infoq`、Redis `127.0.0.1:6379/0`

这里是文件选择顺序，不是 Spring profile 合并：本地文件存在时只解析该文件，缺字段不会再从 `dev` 补齐。首个 YAML 文档不要求 `---`；Redis 支持 `spring.data:` 与嵌套 `spring: data: redis:` 两种写法。连接标量保留文本（包括口令前导零），支持 YAML 单引号及 JSON 兼容的双引号转义。连接字段中的 `${...}`、复杂值、缺失必填项或重复连接文档会明确失败，不模拟 Spring profile 合并；显式环境变量在文件解析成功后才覆盖结果。

MySQL `hikari.maxPoolSize` 缺省为 `10`；显式值必须是正安全整数，未展开的占位符、复杂值、零、负数或小数会在启动前失败。解析器不自动继承 JDBC TLS、Redis Sentinel/Cluster 配置；适用的 TLS/拓扑字段必须显式通过白名单环境变量提供并核验。它不是完整 YAML/Spring 配置解析器；需要复杂配置时先为 MCP 准备一份无歧义的本地标量配置。

共享 helper 的仓库缓存位于 `tmp/mcp/npm-cache/`。缓存命中或 `npx` 下载的版本未被锁定，不属于生产应用依赖；首次启用前需检查包来源、实际版本及暴露的工具，不能把启动成功当作安全审计通过。

缓存包优先启动 `package.json` 声明的 `bin`，避免把仅供 import 的 `dist/index.js` 当成服务；声明的入口缺失时停止。没有 `bin` 的兼容包才检查 `dist/index.js` / `index.js`。三个 STDIO 包装器会转发中断，并将子进程信号终止保留为非零退出，不能将服务退出判成成功。

修改配置解析或缓存启动时，先用隔离 fixture 执行 `node tools/test_backend_mcp_env.mjs` 与 `node tools/test_mcp_cache.mjs`；前者覆盖单双引号、缺值与歧义，后者覆盖入口优先级、缺失入口和包装器退出状态。测试不启动真实 MCP 包、不下载依赖、不连接数据库。

推荐关系：

- 默认浏览器主流程：先用 repo-owned CLI
- 临时交互探索：再用 `playwright` MCP
- DevTools 级诊断：用 `chrome-devtools-cli` 或 `chrome-devtools` MCP

## 3. 工具暴露与审批

文档只描述仓库在 `.codex/config.toml` 中显式约束过的部分；未单独覆写的工具行为，以各 MCP server 默认策略为准。

| Server | 已显式要求审批的工具 | 超时配置 |
| --- | --- | --- |
| `playwright` | `browser_navigate`、`browser_click`、`browser_run_code` | `startup_timeout_sec = 20`，`tool_timeout_sec = 120` |
| `chrome-devtools` | `take_snapshot`、`take_screenshot`、`evaluate_script`、`click` | `startup_timeout_sec = 20`，`tool_timeout_sec = 120` |
| `mysql` | 只读白名单工具 | `startup_timeout_sec = 20`，`tool_timeout_sec = 120` |
| `redis` | 只读白名单工具 | `startup_timeout_sec = 20`，`tool_timeout_sec = 120` |

## 4. 典型使用方式

- React / Vue 管理端运行态问题：先用 `test-cli` 的 CLI-first 路径；需要临时互动时再用 `playwright` MCP。
- 页面白屏、接口报错、性能或请求细节排查：用 `chrome-devtools`。
- OpenAI / AGENTS / skills / Codex / MCP 文档问题：优先本机或系统级 `openai-docs` skill，不在项目级 `.codex/config.toml` 声明对应 MCP server。
- backend 数据或缓存排查：使用 `docs/DATA-OPS.md` 做只读探测与门禁；在本地配置完成后再显式启用只读 `mysql` / `redis`。

## 5. 使用约束

- 不在仓库内保存真实 token、账号或私有本机路径。
- `mysql` 与 `redis` 只保留只读能力。
- 工具白名单和 `MYSQL_READONLY` / `REDIS_READONLY` 是客户端/服务端配置约束，不替代数据库权限；显式环境变量也可覆盖解析结果。共享环境必须使用独立最小权限只读账号、可信 MCP 包及网络访问控制，不能复用应用写账号或 root。
- Redis `keys` 虽只读，仍可能阻塞大实例；先限定 key 前缀、数量与耗时预算，不对生产执行全库 `KEYS *`。当前白名单没有 `SCAN`，需要安全批量扫描时走 `docs/DATA-OPS.md` 的受控只读方案。
- 默认启用的仓库级 MCP 只有 `playwright`、`chrome-devtools`。
- 文档与 skill 中出现的 server / tool 名称，必须与 `.codex/config.toml` 保持一致。

官方配置字段参考：[MCP server 与工具审批配置](https://learn.chatgpt.com/docs/config-file/config-reference)。这里列出的配置不意味着其他宿主或插件已加载同一配置，实际可用工具以当前会话为准。

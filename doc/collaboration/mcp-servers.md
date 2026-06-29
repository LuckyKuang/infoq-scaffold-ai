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

- `.codex/skills/infoq-browser-automate/scripts/playwright_cli.mjs`
- `.codex/skills/infoq-browser-automate/scripts/chrome_devtools_cli.mjs`

可选只读 `mysql` / `redis` MCP 的本地启动入口位于：

- `.codex/scripts/start_mysql_mcp.mjs`
- `.codex/scripts/start_redis_mcp.mjs`

与上述只读 MCP 启动链路直接相关的 `.codex/scripts/` 共享 helper 目前只有两个：

| 路径 | 角色 | 文档定位 |
| --- | --- | --- |
| `.codex/scripts/resolve_backend_local_mcp_env.mjs` | 统一按 `application-local.yml -> application-dev.yml` 顺序解析 backend 本地配置，并抽取 MySQL / Redis 只读环境变量；当前同时被只读 MCP 启动脚本、`infoq-data-ops` 与 `infoq-backend-verify` 复用 | 内部 helper，不单独作为用户入口 |
| `.codex/scripts/launch_cached_mcp_package.mjs` | 优先复用本机 npm / npx cache 中已存在的 MCP 包；缓存未命中时再回退到 `npx -y <package>` 下载启动 | 内部 helper，不单独作为用户入口 |

默认行为：

- 按 `application-local.yml -> application-dev.yml` 顺序读取当前开发者后端依赖配置
- 显式环境变量优先级高于解析出的 backend 配置值
- 共享文档示例统一使用本地依赖基线：MySQL `127.0.0.1:3306/infoq`、Redis `127.0.0.1:6379/0`

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

- React / Vue 管理端运行态问题：先用 `infoq-browser-automate` 的 CLI-first 路径；需要临时互动时再用 `playwright` MCP。
- 页面白屏、接口报错、性能或请求细节排查：用 `chrome-devtools`。
- OpenAI / AGENTS / skills / Codex / MCP 文档问题：优先本机或系统级 `openai-docs` skill，不在项目级 `.codex/config.toml` 声明对应 MCP server。
- backend 数据或缓存排查：使用 `infoq-data-ops` 做只读探测与门禁；在本地配置完成后再显式启用只读 `mysql` / `redis`。

## 5. 使用约束

- 不在仓库内保存真实 token、账号或私有本机路径。
- `mysql` 与 `redis` 只保留只读能力。
- 默认启用的仓库级 MCP 只有 `playwright`、`chrome-devtools`。
- 文档与 skill 中出现的 server / tool 名称，必须与 `.codex/config.toml` 保持一致。

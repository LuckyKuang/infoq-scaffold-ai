<div align="center">

<img src="doc/images/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

> 一个以 AI 为主力研发者的全栈工程脚手架。仓库通过 `AGENTS.md` 约束协作规则，通过 `.codex/skills` 固化自动化 SOP，并以 `OpenSpec` 管理长期规格与变更，将能力落到 Spring Boot 3 后端、Vue/React/React Pro 管理端、Vue/React 小程序端、脚本、SQL、MCP 与文档工作区中。社区：[Linux DO](https://linux.do)

![Version](https://img.shields.io/badge/Version-2.1.7-f66a39)
![JDK](https://img.shields.io/badge/JDK-17-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.14-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![Element Plus](https://img.shields.io/badge/Element%20Plus-2.14.1-409EFF)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
![Ant Design](https://img.shields.io/badge/Ant%20Design-6.4.3-1677FF)
![License](https://img.shields.io/badge/License-MIT-F7C948)

</div>

---

## 项目简介

`infoq-scaffold-ai` 把 AI 协作规则、自动化 SOP、OpenSpec 规格资产、业务代码、验证流程和交付证据放进同一仓库闭环。这个仓库不把 AI 当成“代码补全工具”，而是把它当成遵循规约、执行验证、维护规格与文档的工程参与者。

当前仓库同时包含：

- Spring Boot 3.5 多模块后端
- Vue 3 + Element Plus 管理端
- React 19 + Ant Design 管理端
- React 19 + Ant Design Pro 管理端
- uni-app + Vue 3 小程序端
- Taro + React 小程序端
- 根 `doc/` 正文真值源与 `infoq-scaffold-docs` 文档站展示层
- 根级与工作区级 `AGENTS.md`
- `OpenSpec` 规格与变更目录
- 项目级 MCP 配置与使用文档
- 部署脚本、SQL 初始化脚本、协作文档

## 项目定位

本项目面向四类核心场景：

1. **AI-first 工程协作**：通过根级和工作区级 `AGENTS.md`、skills、`OpenSpec`、MCP 让 Codex 先对齐规格、再做修改、最后执行验证。
2. **三管理端基线**：同时提供 Vue 3 + Element Plus、React 19 + Ant Design、React 19 + Ant Design Pro 三套管理端实现。
3. **双小程序端基线**：同时提供 uni-app Vue 与 Taro React 两套小程序实现。
4. **可运行、可验证、可部署**：本地联调、单元测试、浏览器验证、小程序 DevTools 打开、Docker Compose 部署和版本升级都在同一仓库闭环完成。

## 仓库结构

```text
infoq-scaffold-ai
├── AGENTS.md
├── .codex/skills
├── .codex/config.toml
├── openspec
├── infoq-scaffold-backend
│   ├── infoq-admin
│   ├── infoq-core
│   ├── infoq-modules
│   └── infoq-plugin
├── infoq-scaffold-frontend-vue
├── infoq-scaffold-frontend-react
├── infoq-scaffold-frontend-react-pro
├── infoq-scaffold-frontend-weapp-vue
├── infoq-scaffold-frontend-weapp-react
├── infoq-scaffold-docs
├── script
├── sql
└── doc
```

## 技术栈

| 维度 | 技术栈 |
| --- | --- |
| AI 协作层 | Codex、`AGENTS.md`、`.codex/skills`、`OpenSpec`、`.codex/config.toml` |
| 后端 | Spring Boot `3.5.14`、JDK `17`、MyBatis-Plus `3.5.16`、Sa-Token `1.44.0` |
| Vue 管理端 | Vue `3.5.35`、TypeScript `6.0.3`、Vite `8.0.16`、Element Plus `2.14.1`、Vue Router `5.1.0`、Vitest `4.1.8` |
| React 管理端 | React `19.2.7`、TypeScript `6.0.3`、Vite `8.0.16`、Ant Design `6.4.3`、React Router `7.16.0`、Vitest `4.1.8` |
| React Pro 管理端 | React `19.2.5`、TypeScript `6.0.3`、Umi Max `4.6.57`、Ant Design `6.4.3`、ProComponents `3.1.12-0`、Vitest `4.1.8` |
| Vue 小程序端 | uni-app 3、Vue 3、TypeScript、Pinia、WeChat Mini Program |
| React 小程序端 | Taro 4、React 18、TypeScript、Zustand、WeChat Mini Program |
| 存储与中间件 | MySQL 8、Redis 7、MinIO |
| 验证与自动化 | Maven、pnpm、浏览器自动化、Chrome DevTools MCP、OpenAI Docs skill、WeChat DevTools |

## AI 协作资产

### 1. `AGENTS.md` 分层规则

- 根规则：[`AGENTS.md`](./AGENTS.md)
- 后端规则：[`infoq-scaffold-backend/AGENTS.md`](./infoq-scaffold-backend/AGENTS.md)
- Vue 管理端规则：[`infoq-scaffold-frontend-vue/AGENTS.md`](./infoq-scaffold-frontend-vue/AGENTS.md)
- React 管理端规则：[`infoq-scaffold-frontend-react/AGENTS.md`](./infoq-scaffold-frontend-react/AGENTS.md)
- React Pro 管理端规则：[`infoq-scaffold-frontend-react-pro/AGENTS.md`](./infoq-scaffold-frontend-react-pro/AGENTS.md)
- Vue 小程序规则：[`infoq-scaffold-frontend-weapp-vue/AGENTS.md`](./infoq-scaffold-frontend-weapp-vue/AGENTS.md)
- React 小程序规则：[`infoq-scaffold-frontend-weapp-react/AGENTS.md`](./infoq-scaffold-frontend-weapp-react/AGENTS.md)
- 文档站规则：[`infoq-scaffold-docs/AGENTS.md`](./infoq-scaffold-docs/AGENTS.md)

### 2. `.codex/skills`

当前仓库的 skill 结构遵循两条规则：

- 每个 skill 只做一个工作域
- 仓库级 skill 统一使用 `infoq-` 前缀；创建或更新 skill 使用系统级 `skill-creator`
- 现有 skill 默认按领域型可执行 SOP 维护：判定范围 -> 只读探测/预览 -> 目标与影响枚举 -> 写入或危险动作门禁 -> 执行验证 -> `doc/tmp/` 证据留存与显式失败
- 优先破坏性重构现有领域 skill，只有出现无法归入现有 skill 的新工作域时才新增 skill

其中最核心的 skill 分为：

- 项目静态参考：`infoq-project-reference`
- 高影响交付、OpenSpec、重大 UI/UX 门禁和插件治理：`infoq-delivery-workflow`
- 后端单测、smoke、登录/auth 和 Redisson OSS 兼容性验证：`infoq-backend-verify`
- React/React Pro/Vue admin 与 weapp 单测、构建和运行态验证：`infoq-frontend-verify`
- SQL、数据库、Redis、数据修复、迁移和一致性核对：`infoq-data-ops`
- 管理端测试矩阵、真实验证码 E2E 和 CRUD E2E 模式：`infoq-admin-e2e`
- 管理端真实页面运营维护、权限巡检和危险动作门禁：`infoq-admin-ops`
- 通用浏览器自动化执行器：`infoq-browser-automate`
- Ant Design 与 Element Plus 组件 API 参考：`infoq-component-reference`
- 版本升级、发布前检查、package / 小程序 manifest 版本字段同步：`infoq-release-ops`
- 本地 / WSL2 / macOS Colima / Linux Docker Compose 部署验证：`infoq-deploy-verify`

其中浏览器自动化默认路径已经收敛为“仓库脚本 + skill 内本地 Playwright 依赖”。`admin-route-probe` 会先走快速 token 获取，遇到后端验证码开启时自动复用 `infoq-admin-e2e/scripts/captcha_login.mjs` 识别验证码并登录。`playwright` MCP 只用于临时交互探索，`chrome-devtools` MCP 只用于 Network / Console / Performance 深度诊断。

React / React Pro / Vue 与 admin / weapp 差异通过目标 skill 的 `references/*` 或 `--client` 参数区分；admin 本地栈使用 `react|react-pro|vue`，weapp 使用 `react|vue`，不再按技术栈碎片化拆 skill。

详见：

- [`doc/collaboration/skills-guide.md`](./doc/collaboration/skills-guide.md)
- [`doc/collaboration/agents-guide.md`](./doc/collaboration/agents-guide.md)
- [`doc/collaboration/subagents-guide.md`](./doc/collaboration/subagents-guide.md)

### 3. `OpenSpec`

新的规格主流程统一放在 `openspec/`：

- 项目级长期上下文：[`openspec/project.md`](./openspec/project.md)
- 当前真相规格：[`openspec/specs/README.md`](./openspec/specs/README.md)
- 活跃变更与归档：[`openspec/changes/README.md`](./openspec/changes/README.md)

默认的 OpenSpec 交付入口是 `infoq-delivery-workflow`。新的功能、行为变更或跨工作区任务，先在 `openspec/changes/<change-id>/` 建立或定位 change，再开始实现。

当前首批 stable specs 已覆盖：

- `auth`
- `user-management`
- `menu-permission`
- `notification`
- `file-storage`
- `plugin-governance`
- `admin-routing`
- `platform-governance`

当前最小 OpenSpec 闭环命令：

```bash
node .codex/skills/infoq-delivery-workflow/scripts/init_change_dir.mjs <change-id>
node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id>
```

如果本次变更属于 repo-level 或高风险治理重构，还应同时在 `doc/plan/YYYY-MM-DD-topic-plan.md` 中保留执行计划。

当用户明确要求 subagents 或 multi-expert execution 时，repo 级 custom agents 的真值放在 `.codex/agents/`，当前只保留 4 个角色：

- `requirements_expert`
- `technical_designer`
- `code_implementer`
- `auto_fixer`

`design.md`、`materials.md`、`review.md` 默认由主线程按需维护；重大 UI/UX 任务优先走 `infoq-delivery-workflow` 中的四阶段 UI 门禁。

### 4. 项目级 MCP

项目级 Codex MCP 配置已写入 [`.codex/config.toml`](./.codex/config.toml)。

当前默认启用：

- `playwright`（通过 `node .codex/scripts/start_playwright_mcp.mjs` 启动，优先复用本机 npm / npx cache，避免 MCP 初始化阶段等待 registry 解析）
- `chrome-devtools`

可选但默认禁用：

- `mysql`（只读；通过 `node .codex/scripts/start_mysql_mcp.mjs` 启动，默认按 `application-local.yml -> application-dev.yml` 顺序读取 backend 配置，并允许用环境变量覆盖；共享文档示例统一使用本地依赖 `127.0.0.1:3306/infoq`）
- `redis`（只读；通过 `node .codex/scripts/start_redis_mcp.mjs` 启动，默认按 `application-local.yml -> application-dev.yml` 顺序读取 backend 配置，并允许用环境变量覆盖；共享文档示例统一使用本地依赖 `127.0.0.1:6379/0`）

OpenAI / Codex 官方文档查询使用本机或系统级 `openai-docs` skill，不作为项目级 MCP 固定配置。

详见：

- [`doc/collaboration/mcp-servers.md`](./doc/collaboration/mcp-servers.md)

## 环境要求

| 组件 | 基线 |
| --- | --- |
| JDK | 17 |
| Maven | 3.9+ |
| Node.js | `24.18.0` |
| pnpm | `>= 10.0.0` |
| MySQL | 8.x |
| Redis | 7.x |
| Docker Compose | 仅在脚本化部署时需要 |
| WeChat DevTools | 小程序本地联调或 e2e 时需要 |

前端本机开发、CI、docs 站点和 Docker Compose 管理端前端镜像构建阶段统一固定为 Node.js `24.18.0`；根目录 `.node-version` 与 `.nvmrc` 保持同一版本。npm 版本不作为仓库构建基线单独固定，前端包管理器遵循各工作区 `packageManager` 与 lockfile。

## 快速开始

### 1. 后端

本地和 agent 环境优先使用仓库后端 Maven 入口。该入口会优先读取 `.idea` 的项目配置，要求 JDK 17 与 Maven 3.9.x；如果 `.idea` 配置不可用，再搜索本机候选环境：

```bash
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

真实验证码登录和动态路由 smoke 使用 `infoq-admin-e2e`。仅做后端快速 token 诊断时，才显式使用 `--allow-captcha-disabled` 或手动启动关闭验证码的诊断后端；受保护路由探测遇到验证码时会自动调用 OCR 登录脚本。

默认本地访问：

- 后端：`http://127.0.0.1:8080`
- 验证码接口：`http://127.0.0.1:8080/auth/code`

### 2. 管理端

Vue 管理端：

```bash
cd infoq-scaffold-frontend-vue
pnpm install
pnpm run dev
```

React 管理端：

```bash
cd infoq-scaffold-frontend-react
pnpm install
pnpm run dev
```

React Pro 管理端：

```bash
cd infoq-scaffold-frontend-react-pro
pnpm install
pnpm run dev
```

React Pro 默认使用端口 `80`，并在 Umi Max dev server ready 后自动打开浏览器。需要关闭自动打开时，执行 `pnpm run dev -- --no-open`。

如果要通过 skill 启动后端 + 管理端联调：

```bash
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react-pro
```

如果要在不关闭验证码的前提下执行真实验证码登录 + 管理端动态路由 smoke：

```bash
node .codex/skills/infoq-admin-e2e/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react --route-limit 1
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react-pro --route-limit 1
```

`captcha_login.mjs` 是仓库内真实验证码 token 获取入口，封装 `/auth/code`、`ddddocr`、算术验证码归一化和加密 `/auth/login`，证据写入 `doc/tmp/infoq-admin-e2e/captcha-login/<run-id>/`。`run_admin_e2e.mjs` 默认会在完成、失败或中断后停止本次 skill 启动的后端和管理端 dev server；只有成功且需要保留联调栈时才显式传 `--keep-stack-after`，失败或中断仍会关闭 owned 进程。运行态状态文件按 client 保存在 `doc/tmp/infoq-admin-e2e/stack/<vue|react|react-pro>/state.json`。

如果明确授权 `application-local.yml` 指向的测试 MySQL 可写，可执行公告模块真实 CRUD E2E；runner 会通过真实验证码登录，在 `/system/notice` 使用 `e2e_` 标题完成 UI 新增/查询/编辑/删除，并用 API 与 DB 查询逐步核对，最后自动 cleanup：

```bash
node .codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs --client vue
node .codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs --client react
node .codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs --client react-pro
```

如果要覆盖管理端安全可自动化模块的新增、编辑、删除和选择型删除/行删除入口，可执行全模块 CRUD E2E。默认模块为 `role,user,menu,dept,post,dict,config,notice,client,invite,ossConfig,job,online`；`ossConfig` 和 `job` 覆盖配置/任务的新增、编辑、删除与选择型删除入口，`online` 只强退当前 run 创建的 `e2e_` 用户会话。安全门禁只保留：不自动删除非 `e2e_` 数据、不清空日志、不强退非本轮会话、不触发定时任务“立即执行”、不触碰真实 OSS 对象上传/删除；缺少隔离 fixture 的场景记录 blocker，不伪造通过：

```bash
node .codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client vue
node .codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client react
node .codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client react-pro
```

如果要先生成 React/React Pro/Vue 管理端 Web 自动化测试矩阵：

```bash
node .codex/skills/infoq-admin-e2e/scripts/generate-case-matrix.mjs
node .codex/skills/infoq-admin-e2e/scripts/validate-case-matrix.mjs doc/test/frontend-web-automation/case-matrix.json
```

停止对应 skill 启动的联调进程：

```bash
node .codex/skills/infoq-frontend-verify/scripts/stop_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/stop_admin_dev_stack.mjs --client react
node .codex/skills/infoq-frontend-verify/scripts/stop_admin_dev_stack.mjs --client react-pro
```

`start_admin_dev_stack.mjs` 的状态文件保存在 `doc/tmp/infoq-frontend-verify/<vue|react|react-pro>/state.json`，记录 pid、port、log 和 `running/stopped/failed/interrupted` 等状态。验证完成、失败或中断后按状态文件执行 stop，只关闭 skill 自己启动或记录为 owned 的进程。

### 3. 小程序端

React 小程序在打开微信开发者工具前，先把 `infoq-scaffold-frontend-weapp-react/.env.development` 里的 `TARO_APP_ID` 改成你自己的 AppID，然后执行：

```bash
pnpm --dir infoq-scaffold-frontend-weapp-react build-open:weapp:dev
```

Vue 小程序同理，先修改 `infoq-scaffold-frontend-weapp-vue/.env.development` 的 `TARO_APP_ID`，再执行：

```bash
pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev
```

如果 `TARO_APP_ID` 为空或是 `touristappid`，`script/build-open-wechat-devtools.mjs` 会直接失败。

## 常用命令

### 仓库校验

```bash
node .codex/scripts/validate_utf8.mjs
node .codex/scripts/validate_utf8.mjs AGENTS.md infoq-scaffold-frontend-react/src
```

### 后端

```bash
node .codex/scripts/backend_mvn.mjs -- clean package -P dev
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test
```

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm run test:unit
pnpm run test:unit:coverage
pnpm run lint:eslint
pnpm run build:prod
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:prod
```

### React Pro 管理端

```bash
cd infoq-scaffold-frontend-react-pro
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build
```

### React 小程序端

```bash
cd infoq-scaffold-frontend-weapp-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run verify:local
```

### Vue 小程序端

```bash
cd infoq-scaffold-frontend-weapp-vue
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run verify:local
```

## 部署入口

如果要让 Codex 直接按本仓库脚本执行本地或 WSL2/macOS Colima/Linux Docker Compose 部署验证，使用 `infoq-deploy-verify`。它会覆盖 WSL2 Docker CE、macOS Colima、Linux Docker CE 三种免费商用运行时，以及后端、MySQL、Redis、MinIO、选定或全部管理端前端、nginx 网关、localhost smoke、证据留存和常见部署阻断，并会在执行 deploy 前提醒并确认 `/tmp/infoq-deploy` 与 `${INFOQ_DEPLOY_ROOT}/server/temp` 已存在。

如果是第一次完整部署，建议先按 [`doc/devops/docker-compose-tutorial.md`](./doc/devops/docker-compose-tutorial.md) 操作；需要脚本参数和日常运维命令时，再看 [`doc/devops/docker-compose-deploy.md`](./doc/devops/docker-compose-deploy.md)。

macOS Colima 环境如果出现 `error getting credentials` 且缺少 `docker-credential-desktop`，通常是 Docker config 残留 Docker Desktop credential helper。按教程中的 Colima credential helper 排查处理，不要因此切换到 Docker Desktop。

### 一键安装

快速体验入口：

```bash
curl -sSL https://raw.githubusercontent.com/LuckyKuang/infoq-scaffold-ai/main/deploy/install.sh | sudo env INFOQ_FRONTEND_TARGET=all bash
```

生产或准生产环境建议固定 tag：

```bash
curl -fsSLO https://raw.githubusercontent.com/LuckyKuang/infoq-scaffold-ai/<tag>/deploy/install.sh
chmod +x install.sh
sudo env INFOQ_VERSION=<tag> INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://SERVER_IP ./install.sh
```

安装脚本会强制选择前端目标，非交互环境必须设置 `INFOQ_FRONTEND_TARGET=react|react-pro|vue|all`。宿主机需要 `docker buildx`，因为后端 Dockerfile 使用 BuildKit `RUN --mount`。脚本会生成随机 MySQL、Redis、MinIO、后端安全密钥和默认管理员账号密码，保存到 `/etc/infoq-scaffold-ai/deploy.env` 与 `/etc/infoq-scaffold-ai/credentials.txt`，文件权限为 `600`。部署完成后控制台会打印访问地址和凭据；设置 `INFOQ_PRINT_SECRETS=0` 时只打印凭据文件路径。

`INFOQ_FRONTEND_TARGET=all` 时入口为：

- Vue 管理端：`http://SERVER_IP/vue/`
- React 管理端：`http://SERVER_IP/react/`
- React Pro 管理端：`http://SERVER_IP/react-pro/`
- 后端健康检查：`http://SERVER_IP/prod-api/monitor/health/readiness`
- MinIO Console：`http://SERVER_IP/console-oss/`
- MinIO OSS：`http://SERVER_IP/oss/`

`INFOQ_FRONTEND_TARGET=react|react-pro|vue` 时只部署一个前端，对应管理端入口统一为 `http://SERVER_IP/`，不再追加 `/react/`、`/react-pro/` 或 `/vue/`。

重复执行安装脚本会复用已有 `deploy.env`，不会静默轮换生产密钥。若 `${INFOQ_DEPLOY_ROOT}/mysql/data` 已存在但环境文件缺失，脚本会停止，避免随机生成的新密码与旧数据错配。

### 后端与依赖服务

```bash
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
bash script/bin/infoq.sh deploy
```

说明：

- `bash script/bin/infoq.sh deploy` 会生成或校验本次 `DEPLOY_ID`，并通过生产配置注入 `infoq.quartz.bootstrap.deploy-id`。
- `deploy` 会创建 MySQL 业务账号，同步随机管理员账号密码，同步 MinIO 凭据到 `sys_oss_config`，并确认 MinIO bucket。
- 默认不会覆盖用户已修改的管理员账号或非默认 OSS 配置；需要重置时显式设置 `INFOQ_RESET_ADMIN=1` 或 `INFOQ_RESET_OSS=1`。
- 同一批多节点滚动发布必须共享同一个 `DEPLOY_ID`；如果同一版本需要再次发布，应换新 `DEPLOY_ID` 并重新执行 `deploy`。
- `bash script/bin/infoq.sh start` / `restart` 会复用 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/config/deploy-id`，不会生成新的部署批次。
- `infoq-admin` readiness 路径为 `/monitor/health/readiness`，用于 Compose healthcheck 或负载均衡接流量门禁。

### 前端与网关

```bash
bash script/bin/deploy-frontend.sh deploy all
```

目标可选 `vue|react|react-pro|all`。`all` 会部署：

- `infoq-frontend-vue`
- `infoq-frontend-react`
- `infoq-frontend-react-pro`
- `nginx-web`

`deploy-frontend.sh deploy all` 会先同步前端网关目录与 `nginx.conf`，再使用 `node:24.18.0` builder 顺序构建 Vue / React / React Pro 镜像，最后启动三个前端容器与 `nginx-web`，避免本机 Docker 并行构建时的内存峰值。单前端目标只构建并启动目标前端与 `nginx-web`，并把管理端挂到网关根路径 `/`。

`all` 部署后的网关入口为 `/vue/`、`/react/`、`/react-pro/`、`/console-oss/` 和 `/oss/`；单前端部署后的管理端入口为 `/`，同时保留 `/console-oss/` 和 `/oss/`。容器直连端口分别为 Vue `9091`、React `9092`、React Pro `9093`；单前端部署只会启动并暴露目标前端对应端口。

详见：

- [`sql/infoq_scaffold_2.0.0.sql`](./sql/infoq_scaffold_2.0.0.sql)
- [`doc/devops/deploy-prerequisites.md`](./doc/devops/deploy-prerequisites.md)
- [`doc/devops/docker-compose-tutorial.md`](./doc/devops/docker-compose-tutorial.md)
- [`doc/devops/manual-deploy.md`](./doc/devops/manual-deploy.md)
- [`doc/devops/docker-compose-deploy.md`](./doc/devops/docker-compose-deploy.md)

## 验证建议

提交前至少执行对应工作区的最小验证：

- 后端改动：主流程验证 + 定向 Maven 测试
- Vue 管理端：`pnpm run test:unit` + `pnpm run build:prod`
- React 管理端：`pnpm run test` + `pnpm run build:prod`
- React Pro 管理端：`pnpm run test` + `pnpm run build`
- Vue 小程序端：`pnpm run typecheck` + `pnpm run test` + `pnpm run build:weapp:dev`
- React 小程序端：`pnpm run test` + `pnpm run lint` + `pnpm run build:weapp:dev`
- 文档站：`cd infoq-scaffold-docs && pnpm run docs:sync && pnpm run docs:check-links && pnpm run build`

如果改动影响浏览器运行态、登录、路由守卫、页面渲染或小程序 DevTools 打开流程，建议额外使用对应的 React 或 Vue 运行态 verification skill。

若要直接执行最小浏览器探测，可使用：

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts install
pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli flow --url "https://example.com" --wait-for-text "Example Domain"
```

首次运行缺少浏览器二进制时，先执行 `pnpm --dir .codex/skills/infoq-browser-automate/scripts exec playwright install chromium`。
浏览器 skill 不再维护 `.sh` / `.ps1` 包装器，统一直接调用仓库内 CLI；仓库内临时文件统一写入 `doc/tmp/`。

## 项目能力概览

- AI 协作治理：根级 / 工作区级 `AGENTS.md` 与 `.codex/skills`
- 研发自动化：后端冒烟、登录校验、浏览器验证、小程序 DevTools 打开、版本升级（含 manifest 与文档站同步）
- 后端业务基线：认证授权、组织权限、字典参数、通知客户端、OSS、日志监控、服务监控与 Hikari 连接池监控
- 多前端交付：Vue/React/React Pro 管理端 + Vue/React 小程序端
- 插件化扩展：encrypt、mail、sse、websocket、doc、translation、sensitive、excel、log 等能力模块

## 文档导航

- 项目文档中心：[`doc/README.md`](./doc/README.md)
- 文档站展示层：[`infoq-scaffold-docs/README.md`](./infoq-scaffold-docs/README.md)
- 协作体系：
  - [`doc/collaboration/agents-guide.md`](./doc/collaboration/agents-guide.md)
  - [`doc/collaboration/skills-guide.md`](./doc/collaboration/skills-guide.md)
  - [`doc/collaboration/subagents-guide.md`](./doc/collaboration/subagents-guide.md)
- MCP：
  - [`doc/collaboration/mcp-servers.md`](./doc/collaboration/mcp-servers.md)
- 部署交付：
  - [`doc/devops/deploy-prerequisites.md`](./doc/devops/deploy-prerequisites.md)
  - [`doc/devops/docker-compose-tutorial.md`](./doc/devops/docker-compose-tutorial.md)
  - [`doc/devops/manual-deploy.md`](./doc/devops/manual-deploy.md)
  - [`doc/devops/docker-compose-deploy.md`](./doc/devops/docker-compose-deploy.md)
- 扩展治理：
  - [`doc/collaboration/plugin-catalog.md`](./doc/collaboration/plugin-catalog.md)

## Admin后台演示图例

系统监控能力现已覆盖在线用户、登录日志、操作日志、定时任务、任务日志、缓存监控、服务监控和 Hikari 原生连接池监控。
其中连接池监控页面与接口已经按生产安全要求收敛为摘要视图，只展示数据源名、库类型、连接数、等待线程、最大池容量和占用率，不再向前端暴露 JDBC URL、账号、驱动类、P6Spy/Seata 标记或详细连接池参数。

|  |  |
| --- | --- |
| ![登陆页面](doc/images/登陆页面.png) | ![主页面](doc/images/主页面.png) |
| ![用户管理页面](doc/images/用户管理页面.png) | ![角色管理页面](doc/images/角色管理页面.png) |
| ![菜单管理页面](doc/images/菜单管理页面.png) | ![部门管理页面](doc/images/部门管理页面.png) |
| ![岗位管理页面](doc/images/岗位管理页面.png) | ![字典管理页面](doc/images/字典管理页面.png) |
| ![参数设置页面](doc/images/参数设置页面.png) | ![通知公告页面](doc/images/通知公告页面.png) |
| ![操作日志页面](doc/images/操作日志页面.png) | ![登陆日志页面](doc/images/登陆日志页面.png) |
| ![文件管理页面](doc/images/文件管理页面.png) | ![客户端管理页面](doc/images/客户端管理页面.png) |
| ![在线用户页面](doc/images/在线用户页面.png) | ![缓存监控页面](doc/images/缓存监控页面.png) |

## Weapp后台演示图例

|                                    |                                    |
|------------------------------------|------------------------------------|
| ![小程序登陆页面](doc/images/小程序登陆页面.png) | ![小程序首页页面](doc/images/小程序首页页面.png) |
| ![小程序管理台页面](doc/images/小程序管理台页面.png) | ![小程序我的页面](doc/images/小程序我的页面.png)  |

## License

[MIT License](./LICENSE)

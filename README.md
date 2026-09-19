<div align="center">

<img src="doc/images/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

> 面向 AI 协作的全栈工程脚手架，包含一个 Spring Boot 后端和 Vue、React 两套管理端。仓库通过 `AGENTS.md`、`.codex/skills` 和 `OpenSpec` 统一研发、验证与交付流程。社区：[Linux DO](https://linux.do)

![Version](https://img.shields.io/badge/Version-3.0.0-f66a39)
![JDK](https://img.shields.io/badge/JDK-21-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
![License](https://img.shields.io/badge/License-MIT-F7C948)

</div>

---

### ⚠️ 重要提醒

本项目仅供技术学习、研究与测试使用。使用前请在非生产环境完成充分测试、验证和安全评估，并依据开源许可证及其他授权文件使用、修改和分发。因使用本项目产生的风险、数据损失或服务中断由使用者自行评估和承担。

## 项目简介

`infoq-scaffold-ai` 将 AI 协作规则、自动化 SOP、OpenSpec 规格、业务代码、验证流程和交付证据放在同一仓库中，形成后端与双技术栈管理端的可运行、可验证、可部署基线。

当前保留三个工作区：

- `infoq-scaffold-backend`：Spring Boot 4.1 多模块后端
- `infoq-scaffold-frontend-vue`：Vue 3 + Element Plus 管理端
- `infoq-scaffold-frontend-react`：React 19 + Ant Design 管理端

仓库还包含 `script/`、`sql/`、`doc/`、`openspec/` 和 `.codex/` 等工程资产。

初始化数据库使用冻结基线 [`sql/infoq_scaffold_2.0.0.sql`](./sql/infoq_scaffold_2.0.0.sql)，后续结构或数据调整只能通过 `sql/infoq_scaffold_update_*.sql` 增量脚本承载。

## 仓库结构

```text
infoq-scaffold-ai
├── AGENTS.md
├── .codex/skills
├── .codex/config.toml
├── openspec
├── infoq-scaffold-backend
├── infoq-scaffold-frontend-vue
├── infoq-scaffold-frontend-react
├── script
├── sql
└── doc
```

## 技术栈

| 维度 | 技术栈 |
| --- | --- |
| AI 协作层 | Codex、`AGENTS.md`、`.codex/skills`、`OpenSpec`、`.codex/config.toml` |
| 后端 | Spring Boot `4.1.1`、JDK `21`、MyBatis-Plus `3.5.17`、Sa-Token `1.44.0` |
| Vue 管理端 | Vue `3.5.35`、TypeScript `6.0.3`、Vite `8.0.16`、Element Plus `2.14.1`、Vue Router `5.1.0`、Vitest `4.1.8` |
| React 管理端 | React `19.2.7`、TypeScript `6.0.3`、Vite `8.0.16`、Ant Design `6.4.3`、React Router `7.16.0`、Vitest `4.1.8` |
| 存储与中间件 | MySQL 8、Redis 7、MinIO |
| 验证与自动化 | Maven、pnpm、浏览器自动化、Chrome DevTools MCP |

## AI 协作资产

### `AGENTS.md` 分层规则

- 根规则：[`AGENTS.md`](./AGENTS.md)
- 后端规则：[`infoq-scaffold-backend/AGENTS.md`](./infoq-scaffold-backend/AGENTS.md)
- Vue 管理端规则：[`infoq-scaffold-frontend-vue/AGENTS.md`](./infoq-scaffold-frontend-vue/AGENTS.md)
- React 管理端规则：[`infoq-scaffold-frontend-react/AGENTS.md`](./infoq-scaffold-frontend-react/AGENTS.md)

### `.codex/skills`

仓库级 skill 按领域维护，常用入口包括项目参考、交付工作流、后端验证、前端验证、数据运维、管理端 E2E、浏览器自动化、组件参考、版本发布和部署验证。详见 [`doc/collaboration/skills-guide.md`](./doc/collaboration/skills-guide.md)。

### `OpenSpec`

- 项目级长期上下文：[`openspec/project.md`](./openspec/project.md)
- 当前规格：[`openspec/specs/README.md`](./openspec/specs/README.md)
- 活跃变更与归档：[`openspec/changes/README.md`](./openspec/changes/README.md)

新功能、API 变更和跨工作区任务，应先在 `openspec/changes/<change-id>/` 建立或定位 change，再开始实现。

## 环境要求

| 组件 | 基线 |
| --- | --- |
| JDK | 21 |
| Maven | 3.9+ |
| Node.js | `24.18.0` |
| pnpm | `>= 10.0.0` |
| MySQL | 8.x |
| Redis | 7.x |
| Docker Compose | 仅在脚本化部署时需要 |

## 快速开始

### 后端

```bash
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

默认地址：`http://127.0.0.1:8080`，验证码接口：`http://127.0.0.1:8080/auth/code`。

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm install
pnpm run dev
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm install
pnpm run dev
```

通过 skill 启动后端和管理端联调：

```bash
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
```

真实验证码登录和动态路由 smoke：

```bash
node .codex/skills/infoq-admin-e2e/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react --route-limit 1
```

## 常用命令

```bash
# 仓库编码校验
node .codex/scripts/validate_utf8.mjs

# 后端
node .codex/scripts/backend_mvn.mjs -- clean package -P dev
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test

# Vue 管理端
pnpm --dir infoq-scaffold-frontend-vue run test:unit
pnpm --dir infoq-scaffold-frontend-vue run build:prod

# React 管理端
pnpm --dir infoq-scaffold-frontend-react run test
pnpm --dir infoq-scaffold-frontend-react run build:prod
```

## 部署入口

使用 `infoq-deploy-verify` 可按仓库脚本执行本地或 WSL2/macOS Colima/Linux Docker Compose 部署验证。前端目标仅支持 `vue`、`react` 或 `all`：

```bash
bash script/bin/deploy-frontend.sh deploy all
```

`all` 会构建并启动 `infoq-frontend-vue`、`infoq-frontend-react` 和 `nginx-web`，网关入口为 `/vue/`、`/react/`、`/console-oss/` 和 `/oss/`。选择单个目标时，管理端挂载到网关根路径 `/`。部署前置条件及参数详见：

- [`doc/devops/deploy-prerequisites.md`](./doc/devops/deploy-prerequisites.md)
- [`doc/devops/docker-compose-tutorial.md`](./doc/devops/docker-compose-tutorial.md)
- [`doc/devops/docker-compose-deploy.md`](./doc/devops/docker-compose-deploy.md)
- [`doc/devops/manual-deploy.md`](./doc/devops/manual-deploy.md)

## 验证建议

- 后端改动：主流程验证和定向 Maven 测试
- Vue 管理端：`pnpm run test:unit` 与 `pnpm run build:prod`
- React 管理端：`pnpm run test` 与 `pnpm run build:prod`
- 影响登录、路由或页面渲染时：使用 `infoq-admin-e2e` 和 `infoq-browser-automate` 做运行态验证

更多说明见 [`doc/README.md`](./doc/README.md)。

<div align="center">

<img src="doc/images/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

**面向 AI 协作的全栈工程脚手架**

[English](README.md) | 中文

![Version](https://img.shields.io/badge/Version-3.0.0-f66a39)
![JDK](https://img.shields.io/badge/JDK-21-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
![License](https://img.shields.io/badge/License-MIT-F7C948)

</div>

---

<!-- readme-section:notice -->
## ⚠️ 重要提醒

本项目仅供技术学习、研究与测试使用。使用前请在非生产环境完成充分测试、验证和安全评估，并依据开源许可证及其他授权文件使用、修改和分发。因使用本项目产生的风险、数据损失或服务中断由使用者自行评估和承担。

<!-- readme-section:overview -->
## 项目概述

`infoq-scaffold-ai` 将 AI 协作规则、自动化 SOP、OpenSpec 规格、业务代码、验证流程和交付证据放在同一仓库中，形成后端与双技术栈管理端的可运行、可验证、可部署基线。

包含三个核心工作区：

- **infoq-scaffold-backend** - Spring Boot 4.1 多模块后端
- **infoq-scaffold-frontend-vue** - Vue 3 + Element Plus 管理端
- **infoq-scaffold-frontend-react** - React 19 + Ant Design 管理端

仓库还包含 `script/`、`sql/`、`doc/`、`openspec/` 和 `.codex/` 等工程资产。

<!-- readme-section:features -->
## 核心特性

- **AI 协作层** - 通过 `AGENTS.md`、`.codex/skills` 和 `OpenSpec` 统一研发、验证与交付流程
- **多技术栈** - 一个后端支持 Vue 和 React 两套管理端
- **模块化架构** - 清晰的模块边界和职责划分
- **完整验证** - 单元测试、集成测试、E2E 测试、浏览器自动化
- **容器化部署** - Docker Compose 一键部署
- **OpenSpec 规范** - 跨工作区变更管理

<!-- readme-section:tech-stack -->
## 技术栈

| 维度 | 技术选型 |
| --- | --- |
| **AI 协作** | Codex、AGENTS.md、.codex/skills、OpenSpec |
| **后端** | Spring Boot 4.1.1、JDK 21、MyBatis-Plus 3.5.17、Sa-Token 1.44.0 |
| **Vue 管理端** | Vue 3.5.35、TypeScript 6.0.3、Vite 8.0.16、Element Plus 2.14.1 |
| **React 管理端** | React 19.2.7、TypeScript 6.0.3、Vite 8.0.16、Ant Design 6.4.3 |
| **存储** | MySQL 8、Redis 7、MinIO |
| **工具链** | Maven 3.9+、pnpm 10+、Node.js 24.18.0 |

<!-- readme-section:quick-start -->
## 快速开始

### 环境要求

| 组件 | 版本要求 |
| --- | --- |
| JDK | 21 |
| Maven | 3.9+ |
| Node.js | 24.18.0 |
| pnpm | 10+ |
| MySQL | 8.x |
| Redis | 7.x |

### 后端启动

```bash
# 构建
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests

# 运行
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

默认地址：`http://127.0.0.1:8080`

### Vue 管理端启动

```bash
cd infoq-scaffold-frontend-vue
pnpm install
pnpm run dev
```

### React 管理端启动

```bash
cd infoq-scaffold-frontend-react
pnpm install
pnpm run dev
```

### 使用 Skill 联调

```bash
# Vue 管理端
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue

# React 管理端
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
```

### 真实验证码登录测试

```bash
node .codex/skills/infoq-admin-e2e/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

<!-- readme-section:repository-structure -->
## 仓库结构

```text
infoq-scaffold-ai/
├── AGENTS.md                      # AI 协作规则（根）
├── .codex/
│   ├── skills/                   # 仓库级自动化 SOP
│   └── config.toml              # MCP 配置
├── openspec/                     # OpenSpec 规范
│   ├── project.md               # 项目上下文
│   ├── specs/                   # 当前规格
│   └── changes/                 # 活跃变更
├── infoq-scaffold-backend/      # Spring Boot 后端
├── infoq-scaffold-frontend-vue/ # Vue 管理端
├── infoq-scaffold-frontend-react/# React 管理端
├── script/                       # 部署脚本
├── sql/                          # 数据库脚本
└── doc/                          # 文档
```

<!-- readme-section:ai-collaboration -->
## AI 协作资产

### AGENTS.md 分层规则

- 根规则：[AGENTS.md](./AGENTS.md)
- 后端规则：[infoq-scaffold-backend/AGENTS.md](./infoq-scaffold-backend/AGENTS.md)
- Vue 规则：[infoq-scaffold-frontend-vue/AGENTS.md](./infoq-scaffold-frontend-vue/AGENTS.md)
- React 规则：[infoq-scaffold-frontend-react/AGENTS.md](./infoq-scaffold-frontend-react/AGENTS.md)

### .codex/skills

仓库级 skill 按领域维护：

- `infoq-project-reference` - 项目参考信息
- `infoq-delivery-workflow` - 交付工作流
- `infoq-backend-verify` - 后端验证
- `infoq-frontend-verify` - 前端验证
- `infoq-admin-e2e` - 管理端 E2E
- `infoq-data-ops` - 数据运维
- `infoq-browser-automate` - 浏览器自动化
- `infoq-deploy-verify` - 部署验证

详见 [doc/collaboration/skills-guide.md](./doc/collaboration/skills-guide.md)

### OpenSpec

- 项目上下文：[openspec/project.md](./openspec/project.md)
- 当前规格：[openspec/specs/README.md](./openspec/specs/README.md)
- 变更管理：[openspec/changes/README.md](./openspec/changes/README.md)

<!-- readme-section:common-commands -->
## 常用命令

### 编码校验

```bash
node .codex/scripts/validate_utf8.mjs
```

### 后端

```bash
# 构建
node .codex/scripts/backend_mvn.mjs -- clean package -P dev

# 测试
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am test
```

### Vue 管理端

```bash
pnpm --dir infoq-scaffold-frontend-vue run test:unit
pnpm --dir infoq-scaffold-frontend-vue run build:prod
```

### React 管理端

```bash
pnpm --dir infoq-scaffold-frontend-react run test
pnpm --dir infoq-scaffold-frontend-react run build:prod
```

<!-- readme-section:deployment -->
## 部署

### Docker Compose 部署

```bash
bash script/bin/deploy-frontend.sh deploy all
```

支持的目标：
- `vue` - 仅 Vue 管理端
- `react` - 仅 React 管理端
- `all` - 所有管理端 + Nginx 网关

网关路由：
- `/vue/` - Vue 管理端
- `/react/` - React 管理端
- `/console-oss/` - OSS 控制台
- `/oss/` - OSS 文件访问

### 部署文档

| 文档 | 说明 |
| --- | --- |
| [部署前置条件](doc/devops/deploy-prerequisites.md) | 环境要求和配置 |
| [Docker Compose 教程](doc/devops/docker-compose-tutorial.md) | 容器编排基础 |
| [Docker Compose 部署](doc/devops/docker-compose-deploy.md) | 完整部署流程 |
| [手动部署](doc/devops/manual-deploy.md) | 非容器化部署 |

<!-- readme-section:testing -->
## 验证策略

- **后端改动** - 主流程验证 + 定向 Maven 测试
- **Vue 管理端** - `pnpm run test:unit` + `pnpm run build:prod`
- **React 管理端** - `pnpm run test` + `pnpm run build:prod`
- **登录/路由/页面** - 使用 `infoq-admin-e2e` 和 `infoq-browser-automate`

<!-- readme-section:documentation -->
## 文档

- [文档导航](doc/README.md)
- [后端手册](doc/backend/handbook.md)
- [管理端手册](doc/admin/handbook.md)
- [协作指南](doc/collaboration/development-workflow.md)
- [FAQ](doc/guide/faq.md)

<!-- readme-section:contributing -->
## 贡献

欢迎提交 Issue 和 Pull Request。

## 社区

[Linux DO](https://linux.do)

<!-- readme-section:license -->
## 许可证

[MIT License](LICENSE)

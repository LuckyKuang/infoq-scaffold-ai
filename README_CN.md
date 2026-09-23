<div align="center">

<img src="docs/images/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

[![CI](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/Version-3.0.0-f66a39)
![JDK](https://img.shields.io/badge/JDK-21-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
[![License](https://img.shields.io/badge/License-MIT-F7C948)](LICENSE)

**面向 AI 协作的全栈工程脚手架**

[English](README.md) | 中文

社区：[Linux DO](https://linux.do)

</div>

<!-- readme-section:notice -->
## 重要提醒

本项目仅供技术学习、研究与测试使用。使用前请在非生产环境完成充分测试、验证和
安全评估，并依据 MIT 许可证使用、修改和分发。因使用本项目产生的风险、数据损失
或服务中断由使用者自行评估和承担。

<!-- readme-section:overview -->
## 项目概述

`infoq-scaffold-ai` 将 AI 协作规则、可执行 skill、OpenSpec、业务代码、验证流程
和交付证据放在同一仓库中，提供可运行的 Spring Boot 后端以及 Vue、React 两套
管理端。

当前保留三个工作区：

- `infoq-scaffold-backend`：Spring Boot 4.1 多模块后端
- `infoq-scaffold-frontend-vue`：Vue 3 + Element Plus 管理端
- `infoq-scaffold-frontend-react`：React 19 + Ant Design 管理端

初始化数据库使用冻结基线
[`sql/infoq_scaffold_3.0.0.sql`](sql/infoq_scaffold_3.0.0.sql)，后续结构或数据
调整只能通过 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本承载。

<!-- readme-section:features -->
## 核心功能

- Spring Boot 4.1 后端，基线为 JDK 21、MyBatis-Plus 和 Spring Security
- Vue / React 双管理端共享同一套后端 API 契约
- 分层 [`AGENTS.md`](AGENTS.md)、`skills` 与 OpenSpec 交付流程
- 冻结 SQL 基线与按日期增量脚本
- Docker Compose 部署 MySQL、Redis、MinIO、后端和管理端网关
- UTF-8、Maven、pnpm 与管理端 E2E 验证入口

<!-- readme-section:quick-start -->
## 快速开始

登录前请先导入 SQL 基线，并启动 MySQL 8 与 Redis 7。

### 后端

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

默认地址：`http://127.0.0.1:8080`。验证码接口：`http://127.0.0.1:8080/auth/code`。

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

两个管理端默认端口都是 `80`。同时启动时先为其中一个设置 `VITE_APP_PORT`。本地
开发细节见 [`DEV_GUIDE.md`](DEV_GUIDE.md)。

使用 skill 跑管理端路由 smoke 或验证码登录：

```bash
node skills/infoq-test/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/infoq-test/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
```

<!-- readme-section:deployment -->
## 部署方式

| 方式 | 文档 |
| --- | --- |
| Linux 安装脚本 | [部署指南](deploy/README.md) |
| Docker Compose | [Docker 指南](deploy/DOCKER.md) |
| Apple container | [Apple container](deploy/APPLE_CONTAINER.md) |
| Compose 环境模板 | [.env.example](deploy/.env.example) |
| 手动部署 | [手动部署](deploy/MANUAL.md) |
| 部署前置条件 | [部署前置条件](deploy/README.md) |

```bash
bash deploy/install.sh
```

`all` 目标的 Nginx 路由：`/vue/`、`/react/`、`/console-oss/`、`/oss/`。

<!-- readme-section:documentation -->
## 文档

README 只提供项目总览和快速开始。详细配置与维护请阅读下列文档。

| 文档 | 说明 |
| --- | --- |
| [文档中心](docs/README.md) | 用户文档导航 |
| [贡献指南](CONTRIBUTING.md) | 工具链、验证和 PR 流程 |
| [开发指南](DEV_GUIDE.md) | 本地设置与排障 |
| [安全策略](SECURITY.md) | 漏洞报告 |
| [AGENTS.md](AGENTS.md) | 仓库协作规则 |
| [设计系统](docs/DESIGN.md) | 管理端视觉语言 |

<!-- readme-section:license -->
## 许可证

[MIT License](LICENSE)

<div align="center">

<img src="assets/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

[![CI](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/Version-3.0.0-f66a39)
![JDK](https://img.shields.io/badge/JDK-21-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
[![License](https://img.shields.io/badge/License-MIT-F7C948)](LICENSE)

**面向 AI 协作的全栈工程脚手架**

[English](README.md) | 简体中文 | [繁體中文](README_ZH_TW.md) | [日本語](README_JA.md)

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

任务计划仅保留在本地：`docs/plan/` 与 `openspec/changes/` 均由 Git 忽略。
后续执行计划继续写入 `docs/plan/`，目录按需创建，由用户手动清理。

当前保留三个工作区：

- `backend`：Spring Boot 4.1 多模块后端
- `frontend-vue`：Vue 3 + Element Plus 管理端
- `frontend-react`：React 19 + Ant Design 管理端

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
- 跨平台 `deploy-cli`，覆盖 Apple container、WSL2 Docker 与 Linux Docker smoke
- UTF-8、Maven、pnpm 与管理端 E2E 验证入口

<!-- readme-section:quick-start -->
## 快速开始

登录前请先导入 SQL 基线，并启动 MySQL 8 与 Redis 7。

### 后端

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

默认地址：`http://127.0.0.1:8080`。验证码接口：`http://127.0.0.1:8080/auth/code`。

### Vue 管理端

```bash
cd frontend-vue
pnpm install
pnpm run dev
```

### React 管理端

```bash
cd frontend-react
pnpm install
pnpm run dev
```

两个管理端默认端口都是 `80`。同时启动时先为其中一个设置 `VITE_APP_PORT`。各工作区
示例分别从仓库根目录执行；先准备被忽略的后端 local 配置。`VITE_APP_ENCRYPT=true`
时须提供与后端匹配的 RSA 公私钥环境变量，前置步骤见 [`DEV_GUIDE.md`](DEV_GUIDE.md)。

使用 skill 跑管理端路由 smoke 或验证码登录：

```bash
# 验证码 E2E 会向后端 Redis 写入种子答案。
# 先设置 INFOQ_TEST_REDIS_HOST/PORT/DATABASE/PASSWORD（以及可选的 TLS）。
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token

# 先准备所选运行时的环境文件，见 deploy/README.md。
# 部署状态：macOS 选择 Apple，Linux/WSL2 选择 Docker
node skills/deploy-cli/scripts/deploy_cli.mjs status
```

<!-- readme-section:deployment -->
## 部署方式

| 方式 | 文档 |
| --- | --- |
| Linux 安装脚本 | [部署指南](deploy/README.md) |
| Docker Compose | [Docker 指南](deploy/DOCKER.md) |
| Apple container | [Apple container](deploy/APPLE_CONTAINER.md) |
| 部署生命周期 | [部署生命周期](deploy/DEPLOYMENT_LIFECYCLE.md) |
| Compose 环境模板 | [.env.example](deploy/.env.example) |
| 手动部署 | [手动部署](deploy/MANUAL.md) |
| 部署前置条件 | [部署前置条件](deploy/README.md) |

| 平台 | 完整栈 | 推荐方式 |
| --- | --- | --- |
| Linux | 是 | Docker 安装脚本 |
| Windows | 是 | WSL2 Debian/Ubuntu + Docker CE |
| macOS | 是 | Colima + Docker |
| macOS | 否，仅后端 | Apple container |
| macOS | 否，后端 + 管理端 dev server | Apple container + `pnpm run dev` |

镜像在目标主机上从源码构建，仓库不发布预构建应用镜像：Docker 路径在镜像内构建后端 jar 和前端产物；Apple container 路径先在宿主机打 jar，再启动仅包含 MySQL、Redis 和后端 API 的栈（不含 Vue/React 和 Nginx 网关）。Release 产物是 jar 与管理端 `dist` 压缩包，不是容器镜像。

```bash
# Linux / WSL2：从已审阅的目标 release tag 源码部署
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all \
  INFOQ_ENV_FILE=/absolute/private/production.env bash deploy/install.sh
```

`INFOQ_FRONTEND_TARGET` 必填：`all`、`vue` 或 `react`。生产基线为 Linux Docker，
须准备独立凭据、两组独立 RSA，以及覆盖应用域名和独立 OSS 域名的 TLS 证书。
受控配置按[环境模板](deploy/.env.example)与[部署指南](deploy/README.md)准备。
`all` 默认路由为 `/vue/`、`/react/`、`/console-oss/`；私有 S3 URL 使用独立 OSS
origin，保留签名原路径。开发 HTTP 须显式选择模式。

远程安装请按部署指南固定 tag，下载并审阅后再执行。macOS Colima 使用底层 shell
脚本；Node CLI 在 macOS 固定选择 Apple，Apple `status` 可能启动 daemon。生产前须
核验独立凭据、构建密钥匹配、HTTPS、监控及已演练的备份/回滚；示例密钥和构建成功
不足以证明生产就绪。

<!-- readme-section:documentation -->
## 文档

README 只提供项目总览和快速开始。详细配置与维护请阅读下列文档。

| 文档 | 说明 |
| --- | --- |
| [文档中心](docs/README.md) | 用户文档导航 |
| [文档审计记录](docs/DOCUMENTATION-AUDIT.md) | 覆盖范围、修正、校验与生产验收阻塞 |
| [贡献指南](CONTRIBUTING.md) | 工具链、验证和 PR 流程 |
| [开发指南](DEV_GUIDE.md) | 本地设置与排障 |
| [安全策略](SECURITY.md) | 漏洞报告 |
| [AGENTS.md](AGENTS.md) | 仓库协作规则 |
| [设计系统](docs/DESIGN.md) | 管理端视觉语言 |
| [发布流程](docs/RELEASING.md) | 版本、tag、Release workflow 与回滚 |
| [CI 验证](docs/CI_VALIDATION.md) | 工作流覆盖、本地门禁与安全扫描 |

## 社区

欢迎在 [Linux DO](https://linux.do) 社区分享想法、讨论 infoq-scaffold-ai。

<!-- readme-section:license -->
## 许可证

[MIT License](LICENSE)

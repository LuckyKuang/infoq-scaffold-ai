# 项目概览

InfoQ-Scaffold-AI 当前由一个后端和两套管理端组成：Spring Boot 后端、Vue 管理端和 React 管理端。`doc/` 是用户文档真值源，`openspec/` 保存长期规格与变更记录。

## 工作区

```text
infoq-scaffold-ai
├── infoq-scaffold-backend
├── infoq-scaffold-frontend-vue
├── infoq-scaffold-frontend-react
├── script
├── sql
├── doc
└── openspec
```

| 工作区 | 职责 | 关键入口 |
| --- | --- | --- |
| `infoq-scaffold-backend` | Spring Boot 4.1 多模块后端 | `infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java` |
| `infoq-scaffold-frontend-vue` | Vue 3 + Element Plus 管理端 | `src/main.ts`、`src/router/index.ts` |
| `infoq-scaffold-frontend-react` | React 19 + Ant Design 管理端 | `src/main.tsx`、`src/router/AppRouter.tsx` |

## 技术基线

| 层次 | 版本与组件 |
| --- | --- |
| 后端 | Spring Boot 4.1.1、JDK 21、MyBatis-Plus 3.5.17、Sa-Token 1.44.0 |
| Vue 管理端 | Vue 3.5.35、Vite 8.0.16、Element Plus 2.14.1、Pinia、Vitest 4.1.8 |
| React 管理端 | React 19.2.7、Vite 8.0.16、Ant Design 6.4.3、Zustand、Vitest 4.1.8 |
| 基础设施 | MySQL 8、Redis 7、MinIO、Nginx |

## 业务能力

后端提供认证授权、组织权限、字典参数、通知公告、客户端、OSS、日志监控和系统监控等基础能力。两套管理端通过相同的 `/dev-api` 或 `/prod-api` 契约访问后端，并分别使用各自的路由、状态管理和组件库实现页面。

## 本地入口

| 服务 | 默认地址或命令 |
| --- | --- |
| 后端 | `http://127.0.0.1:8080` |
| Vue 管理端 | `pnpm --dir infoq-scaffold-frontend-vue run dev` |
| React 管理端 | `pnpm --dir infoq-scaffold-frontend-react run dev` |
| Nginx 聚合入口 | `/vue/`、`/react/`、`/prod-api/` |

前端本机开发、CI 和 Docker builder 统一使用 Node.js `24.18.0`。如需同时启动两套管理端，请先为其中一个 dev server 调整端口。

## 配置与验证

- 后端环境配置位于 `infoq-scaffold-backend/infoq-admin/src/main/resources/`。
- Vue 环境变量位于 `infoq-scaffold-frontend-vue/.env.*`。
- React 环境变量位于 `infoq-scaffold-frontend-react/.env.*`。
- 使用 `node .codex/scripts/validate_utf8.mjs` 做仓库编码校验。
- 后端使用 `node .codex/scripts/backend_mvn.mjs -- ...`，前端使用 pnpm 执行测试、lint 和构建。

更多启动步骤见 [`quick-start.md`](./quick-start.md)，部署参数见 [`../devops/deploy-prerequisites.md`](../devops/deploy-prerequisites.md)。

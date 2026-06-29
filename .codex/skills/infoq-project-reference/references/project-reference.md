# InfoQ 项目参考

## 目录

- 项目范围
- 后端参考
- 管理端前端参考
  - React Admin
  - React Pro Admin
  - Vue Admin
- 小程序前端参考
  - React Weapp
  - Vue Weapp
- 基础设施与运维
- 约定
- 命令
  - Backend
  - React Admin
  - Vue Admin
  - React Weapp
  - Vue Weapp
- 验证与交付

## 项目范围

- 项目根目录：`./`
- 活跃工作区：
  - `infoq-scaffold-backend`
  - `infoq-scaffold-frontend-react`
  - `infoq-scaffold-frontend-react-pro`
  - `infoq-scaffold-frontend-vue`
  - `infoq-scaffold-frontend-weapp-react`
  - `infoq-scaffold-frontend-weapp-vue`
  - `infoq-scaffold-docs`
  - `openspec`
  - `script`
  - `sql`
  - `doc`
- 工作区指令文件：
  - `AGENTS.md`
  - `infoq-scaffold-backend/AGENTS.md`
  - `infoq-scaffold-frontend-react/AGENTS.md`
  - `infoq-scaffold-frontend-react-pro/AGENTS.md`
  - `infoq-scaffold-frontend-vue/AGENTS.md`
  - `infoq-scaffold-frontend-weapp-react/AGENTS.md`
  - `infoq-scaffold-frontend-weapp-vue/AGENTS.md`
  - `infoq-scaffold-docs/AGENTS.md`

## 后端参考

- 后端模块：
  - `infoq-core`: `infoq-core-bom`, `infoq-core-common`, `infoq-core-data`
  - `infoq-plugin`: `encrypt`, `excel`, `jackson`, `log`, `mail`, `mybatis`, `oss`, `redis`, `satoken`, `security`, `sensitive`, `sse`, `translation`, `web`, `websocket`, `doc`
  - `infoq-modules`: `system`
  - `infoq-admin`
- 后端入口：`infoq-scaffold-backend/infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java`
- 后端配置文件：
  - `infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml`
  - `infoq-scaffold-backend/infoq-admin/src/main/resources/application-dev.yml`
  - `infoq-scaffold-backend/infoq-admin/src/main/resources/application-local.yml`
  - `infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml`
  - `infoq-scaffold-backend/infoq-admin/src/main/resources/logback-plus.xml`

## 管理端前端参考

### React Admin

- 关键目录：
  - `infoq-scaffold-frontend-react/src/pages`
  - `infoq-scaffold-frontend-react/src/components`
  - `infoq-scaffold-frontend-react/src/api`
  - `infoq-scaffold-frontend-react/src/store`
  - `infoq-scaffold-frontend-react/src/router`
  - `infoq-scaffold-frontend-react/src/utils`
  - `infoq-scaffold-frontend-react/tests`
- 关键文件：
  - `infoq-scaffold-frontend-react/package.json`
  - `infoq-scaffold-frontend-react/vite.config.ts`
  - `infoq-scaffold-frontend-react/eslint.config.js`
  - `infoq-scaffold-frontend-react/tests/setup.ts`
  - `infoq-scaffold-frontend-react/.env.development`
- 构建与分包真值：
  - `infoq-scaffold-frontend-react/vite.config.ts` 中的 `build.rollupOptions.output.manualChunks` 是 React admin 当前分包真值。
  - 当前策略优先稳定 vendor 分组与路由级懒加载：`vendor-react`、`vendor-shared`、`vendor-media`、`vendor-echarts`，以及 `vendor-antd-infra`、`vendor-rc-table`、`vendor-rc-picker`、`vendor-rc-form`、`vendor-rc-tree`、`vendor-rc-overlay`。
  - `src/router/AppRouter.tsx` 中的 `AuthGuard`、`MainLayout`、`BackendRouteView`、`login`、`register`、`401`、`redirect` 已改为 `lazy()`；入口首包优化依赖这些真实路由边界。
  - 处理 chunk warning 时，优先保留“按路由边界拆 + 按 rc 重模块拆”的思路，不要回到按 `antd/es/*` 或 `antd/lib/*` 细粒度手工拆包；旧策略容易触发 circular chunk warning。
  - 验证标准以 `pnpm run build:prod` 输出为准：既要避免 circular chunk warning，也要避免 `Some chunks are larger than 500 kB after minification`。

### React Pro Admin

- 关键目录：
  - `infoq-scaffold-frontend-react-pro/src/pages`
  - `infoq-scaffold-frontend-react-pro/src/components`
  - `infoq-scaffold-frontend-react-pro/src/api`
  - `infoq-scaffold-frontend-react-pro/src/utils`
  - `infoq-scaffold-frontend-react-pro/config`
  - `infoq-scaffold-frontend-react-pro/tests`
- 关键文件：
  - `infoq-scaffold-frontend-react-pro/package.json`
  - `infoq-scaffold-frontend-react-pro/config/config.ts`
  - `infoq-scaffold-frontend-react-pro/config/routes.ts`
  - `infoq-scaffold-frontend-react-pro/src/app.tsx`
  - `infoq-scaffold-frontend-react-pro/.env.development`
  - `infoq-scaffold-frontend-react-pro/scripts/start-dev.mjs`
  - `infoq-scaffold-frontend-react-pro/scripts/max.mjs`
- 运行与部署真值：
  - `pnpm run dev` 通过 `scripts/start-dev.mjs` 启动 Umi Max，默认端口 `80`，ready 后自动打开浏览器。
  - `pnpm run build`、`pnpm run prepare`、`pnpm run preview`、`pnpm run analyze` 通过 `scripts/max.mjs` 进入 Umi Max，统一设置 `DID_YOU_KNOW=none`。
  - 可用 `PORT` 或 `VITE_APP_PORT` 覆盖端口；可用 `INFOQ_REACT_PRO_OPEN=false`、`BROWSER=none` 或 `pnpm run dev -- --no-open` 禁止自动打开浏览器。
  - Compose 部署路径是 `/react-pro/`，容器直连端口是 `9093`。

### Vue Admin

- 关键目录：
  - `infoq-scaffold-frontend-vue/src/views`
  - `infoq-scaffold-frontend-vue/src/components`
  - `infoq-scaffold-frontend-vue/src/api`
  - `infoq-scaffold-frontend-vue/src/store`
  - `infoq-scaffold-frontend-vue/src/router`
  - `infoq-scaffold-frontend-vue/src/utils`
  - `infoq-scaffold-frontend-vue/src/plugins`
  - `infoq-scaffold-frontend-vue/tests`
- 关键文件：
  - `infoq-scaffold-frontend-vue/package.json`
  - `infoq-scaffold-frontend-vue/vite.config.ts`
  - `infoq-scaffold-frontend-vue/eslint.config.ts`
  - `infoq-scaffold-frontend-vue/.env.development`
  - `infoq-scaffold-frontend-vue/tests/setup.ts`

## 小程序前端参考

### React Weapp

- 关键目录：
  - `infoq-scaffold-frontend-weapp-react/src/pages`
  - `infoq-scaffold-frontend-weapp-react/src/components`
  - `infoq-scaffold-frontend-weapp-react/src/api`
  - `infoq-scaffold-frontend-weapp-react/src/store`
  - `infoq-scaffold-frontend-weapp-react/src/utils`
  - `infoq-scaffold-frontend-weapp-react/src/styles`
  - `infoq-scaffold-frontend-weapp-react/tests`
- 关键文件：
  - `infoq-scaffold-frontend-weapp-react/package.json`
  - `infoq-scaffold-frontend-weapp-react/config/index.ts`
  - `infoq-scaffold-frontend-weapp-react/.env.development`
  - `infoq-scaffold-frontend-weapp-react/project.config.json`

### Vue Weapp

- 关键目录：
  - `infoq-scaffold-frontend-weapp-vue/src/pages`
  - `infoq-scaffold-frontend-weapp-vue/src/components`
  - `infoq-scaffold-frontend-weapp-vue/src/api`
  - `infoq-scaffold-frontend-weapp-vue/src/store`
  - `infoq-scaffold-frontend-weapp-vue/src/utils`
  - `infoq-scaffold-frontend-weapp-vue/src/styles`
  - `infoq-scaffold-frontend-weapp-vue/tests`
- 关键文件：
  - `infoq-scaffold-frontend-weapp-vue/package.json`
  - `infoq-scaffold-frontend-weapp-vue/vite.config.ts`
  - `infoq-scaffold-frontend-weapp-vue/.env.development`
  - `infoq-scaffold-frontend-weapp-vue/src/manifest.json`
  - `infoq-scaffold-frontend-weapp-vue/src/pages.json`

## 基础设施与运维

- 脚本：
  - `script/generate-app-icon.js`
  - `script/build-open-wechat-devtools.mjs`
  - `script/bin/infoq.sh`
  - `script/bin/deploy-frontend.sh`
- Compose 与网关：
  - `script/docker/docker-compose.yml`
  - `script/docker/nginx/conf/nginx.conf`
  - `script/docker/redis/conf/redis.conf`
- SQL 初始化文件：
  - `sql/infoq_scaffold_2.0.0.sql`

## 文档站参考

- 正文真值源：
  - `doc/README.md`
  - `doc/guide/project-overview.md`
  - `doc/guide/quick-start.md`
  - `doc/backend/handbook.md`
  - `doc/admin/handbook.md`
  - `doc/weapp/handbook.md`
  - `doc/devops/deploy-prerequisites.md`
  - `doc/devops/docker-compose-deploy.md`
  - `doc/devops/manual-deploy.md`
  - `doc/collaboration/development-workflow.md`
- 文档站工作区：
  - `infoq-scaffold-docs/package.json`
  - `infoq-scaffold-docs/site-map.mjs`
  - `infoq-scaffold-docs/scripts/sync-from-root-doc.mjs`
  - `infoq-scaffold-docs/scripts/check-links.mjs`
  - `infoq-scaffold-docs/docs/.vitepress/config.mts`

## 约定

- 架构：`Controller -> Service -> Mapper -> Entity`
- Java 包命名约定：`cc.infoq.{module}.{layer}`
- Java 实体与 mapper 通常使用 `Sys*`
- Vue 与 React 组件使用 PascalCase
- TypeScript utils 与 hooks 使用 camelCase
- 项目文本文件统一 UTF-8，写入使用 UTF-8 without BOM
- Windows PowerShell 5.1 是默认 shell 基线；读取源码、配置、文档时，`Get-Content`/`Select-String` 必须显式指定 `-Encoding UTF8`
- Windows PowerShell 5.1 禁止用 `>`、`>>`、`Out-File`、`Set-Content`、`Add-Content` 写入仓库文本文件；写入使用明确 UTF-8 without BOM 的方式
- 提交或构建前执行仓库专用 UTF-8 校验命令：`node .codex/scripts/validate_utf8.mjs`；可追加路径参数做定向校验
- 后端 `.editorconfig` 使用 4 空格；前端使用 2 空格
- 前端包管理策略：优先 `pnpm`，不可用时回退等价 `npm` 命令

## 命令

### Backend

- 构建：`node .codex/scripts/backend_mvn.mjs -- clean package -P dev`
- 运行：`node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests && java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local`
- 定向测试：`node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test`

### React Admin

- 安装：`cd infoq-scaffold-frontend-react && pnpm install`
- 开发：`cd infoq-scaffold-frontend-react && pnpm run dev`
- 测试：`cd infoq-scaffold-frontend-react && pnpm run test`
- 覆盖率：`cd infoq-scaffold-frontend-react && pnpm run test:coverage`
- Lint：`cd infoq-scaffold-frontend-react && pnpm run lint`
- 构建：`cd infoq-scaffold-frontend-react && pnpm run build:prod`

### React Pro Admin

- 安装：`cd infoq-scaffold-frontend-react-pro && pnpm install`
- 开发：`cd infoq-scaffold-frontend-react-pro && pnpm run dev`
- 测试：`cd infoq-scaffold-frontend-react-pro && pnpm run test`
- 覆盖率：`cd infoq-scaffold-frontend-react-pro && pnpm run test:coverage`
- Lint：`cd infoq-scaffold-frontend-react-pro && pnpm run lint`
- 构建：`cd infoq-scaffold-frontend-react-pro && pnpm run build`

### Vue Admin

- 安装：`cd infoq-scaffold-frontend-vue && pnpm install`
- 开发：`cd infoq-scaffold-frontend-vue && pnpm run dev`
- 测试：`cd infoq-scaffold-frontend-vue && pnpm run test:unit`
- 覆盖率：`cd infoq-scaffold-frontend-vue && pnpm run test:unit:coverage`
- Lint：`cd infoq-scaffold-frontend-vue && pnpm run lint:eslint`
- 构建：`cd infoq-scaffold-frontend-vue && pnpm run build:prod`

### React Weapp

- 安装：`cd infoq-scaffold-frontend-weapp-react && pnpm install`
- 单测：`cd infoq-scaffold-frontend-weapp-react && pnpm run test`
- 覆盖率：`cd infoq-scaffold-frontend-weapp-react && pnpm run test:coverage`
- Lint：`cd infoq-scaffold-frontend-weapp-react && pnpm run lint`
- 构建 dev 包：`cd infoq-scaffold-frontend-weapp-react && pnpm run build:weapp:dev`
- 打开微信开发者工具 dev 包：`pnpm --dir infoq-scaffold-frontend-weapp-react build-open:weapp:dev`
- 本地运行门禁：`cd infoq-scaffold-frontend-weapp-react && pnpm run verify:local`

在 `build-open:weapp:dev` 之前，将 `infoq-scaffold-frontend-weapp-react/.env.development` 中 `TARO_APP_ID` 改为你的 AppID。

### Vue Weapp

- 安装：`cd infoq-scaffold-frontend-weapp-vue && pnpm install`
- 类型检查：`cd infoq-scaffold-frontend-weapp-vue && pnpm run typecheck`
- 单测：`cd infoq-scaffold-frontend-weapp-vue && pnpm run test`
- 覆盖率：`cd infoq-scaffold-frontend-weapp-vue && pnpm run test:coverage`
- 构建 dev 包：`cd infoq-scaffold-frontend-weapp-vue && pnpm run build:weapp:dev`
- 打开微信开发者工具 dev 包：`pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev`
- 本地运行门禁：`cd infoq-scaffold-frontend-weapp-vue && pnpm run verify:local`

在 `build-open:weapp:dev` 之前，将 `infoq-scaffold-frontend-weapp-vue/.env.development` 中 `TARO_APP_ID` 改为你的 AppID。

### Docs Site

- 安装：`cd infoq-scaffold-docs && pnpm install`
- 同步：`cd infoq-scaffold-docs && pnpm run docs:sync`
- 链接检查：`cd infoq-scaffold-docs && pnpm run docs:check-links`
- 构建：`cd infoq-scaffold-docs && pnpm run build`
- 本地预览：`cd infoq-scaffold-docs && pnpm run docs:preview`

## 验证与交付

- 默认执行闭环：`main-flow verification -> targeted tests -> lint/build -> diff review`
- 交付规划应定义 acceptance contract，覆盖功能范围、非目标、异常处理、所需日志/可观测性、回滚条件
- 可发布变更在部署前必须验证环境/配置前置条件与外部依赖
- 影响共享环境、数据或部署状态的破坏性/高风险操作必须显式确认
- SQL、数据库、Redis、数据修复、迁移、测试数据维护和 API/UI/DB 一致性验证归属 `infoq-data-ops`
- 后端运行时、登录、smoke 与单测验证归属 `infoq-backend-verify`
- React/Vue admin 与 weapp 运行态、单测、coverage、lint/build 归属 `infoq-frontend-verify`
- React Pro admin 当前先使用 `infoq-scaffold-frontend-react-pro` 工作区 package scripts 执行单测、lint、build 与运行态验证
- 管理端真实验证码登录、动态路由 smoke、测试矩阵与 CRUD E2E 模式归属 `infoq-admin-e2e`

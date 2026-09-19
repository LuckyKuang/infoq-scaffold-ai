# 开发指南

本指南包含本地设置、故障排除和常见问题。强制性仓库规则见 [`AGENTS.md`](AGENTS.md)，贡献检查见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 工具链

使用仓库声明的版本：

- **JDK**: `infoq-scaffold-backend/pom.xml` 中的 `java.version`（当前为 21）
- **Maven**: 3.9+
- **Node.js**: `24.18.0`（见 `.node-version` 和 `.nvmrc`）
- **pnpm**: 10+

版本不要复制到额外的策略文档中，始终从源文件引用。

## 本地服务

开发需要 MySQL 和 Redis。使用本地服务或开发 Compose 文件：

```bash
cd script/docker
docker compose up -d
```

本地凭证保存在被忽略的 `.env` 或配置文件中。不要在文档中添加开发机器路径、密码或生产数据。

## 安装和构建

### 后端

```bash
# 构建
node .codex/scripts/backend_mvn.mjs -- clean install

# 打包
node .codex/scripts/backend_mvn.mjs -- clean package -P dev

# 构建特定模块
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am install
```

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm install --frozen-lockfile
pnpm run build
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm install --frozen-lockfile
pnpm run build
```

根目录也提供了便捷脚本：

```bash
# 使用 skill 启动完整开发栈
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
```

## 开发运行

### 后端

```bash
cd infoq-scaffold-backend
node ../.codex/scripts/backend_mvn.mjs -- spring-boot:run -pl infoq-admin
```

或直接运行 jar：

```bash
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm run dev
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm run dev
```

配置示例文件复制到被忽略的本地文件后再编辑。服务配置见 [`doc/devops/deploy-prerequisites.md`](doc/devops/deploy-prerequisites.md)。

## 验证

所有验证（测试、lint、typecheck、构建、策略检查）必须使用仓库定义的工具。

### 后端

```bash
# 单元测试（控制在 60 秒内）
node .codex/scripts/backend_mvn.mjs -- test

# 特定模块测试
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am test

# 使用 skill
node .codex/skills/infoq-backend-verify/scripts/run_unit_tests.mjs
```

单元测试使用进程内（mocks、内存数据库）。集成测试需要 Docker MySQL/Redis。

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm run lint
pnpm run test:unit
pnpm run build:prod
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm run lint
pnpm run test
pnpm run build:prod
```

### 使用 Skill 验证

```bash
# 前端验证（单测 + 构建 + 本地栈）
node .codex/skills/infoq-frontend-verify/scripts/run_unit_tests.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/run_unit_tests.mjs --client react

# E2E 验证（真实验证码登录 + 动态路由）
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react
```

## 常见问题

### 锁文件失败

如果 `package.json` 变更，在对应工作区运行 `pnpm install` 并提交生成的 `pnpm-lock.yaml`。

### npm/pnpm 安装冲突

确认路径后仅删除仓库的 `node_modules`，然后用 pnpm 重新安装。不要对本项目使用 npm 或 yarn。

### Maven 编译失败

#### JDK 版本不匹配

项目需要 JDK 21。使用 sdkman 切换：

```bash
sdk list java
sdk use java 21.0.7-zulu
sdk default java 21.0.7-zulu
```

验证：

```bash
java -version
# 应显示 "21.0.7"
```

#### Maven 找不到

`backend_mvn.mjs` 优先读取 `.idea` 中的 Maven 配置。如不可用则搜索本机候选。要求 Maven 3.9.x。

### UTF-8 编码问题

仓库文本文件必须使用 UTF-8 without BOM。验证：

```bash
node .codex/scripts/validate_utf8.mjs
```

Windows PowerShell 5.1 是默认 shell 基线，读取文本文件时 `Get-Content`/`Select-String` 必须显式指定 `-Encoding UTF8`。

### 数据库迁移失败

不要编辑已应用的迁移脚本。恢复发布内容并创建新的补偿迁移。见 [`AGENTS.md`](AGENTS.md) 的 SQL Migration Policy。

- `sql/infoq_scaffold_3.0.0.sql` 是冻结基线，永远不要修改
- 所有新变更只能通过 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本承载

### 转发客户端 IP 或代理行为

参考 [`deploy/nginx.conf.example`](script/docker/nginx/conf/nginx.conf)。不要信任宽泛的代理 CIDR 或未经执行边界强制的原始转发头。

### Redis 连接失败

检查 `application-{profile}.yml` 中的 Redis 配置：

```yaml
spring:
  data:
    redis:
      host: 127.0.0.1
      port: 6379
      database: 0
```

本地开发使用 `application-local.yml`，确保 Redis 服务已启动。

### 前端代理配置

Vue 和 React 管理端都配置了代理转发到后端。开发时确保后端在 `http://127.0.0.1:8080` 运行。

代理配置位置：
- Vue: `infoq-scaffold-frontend-vue/vite.config.ts`
- React: `infoq-scaffold-frontend-react/vite.config.ts`

## 仓库布局

```text
infoq-scaffold-ai/
├── infoq-scaffold-backend/      # Spring Boot 后端
│   ├── infoq-admin/            # 启动入口
│   ├── infoq-modules/          # 业务模块
│   ├── infoq-core/             # 核心类型和数据访问
│   └── infoq-plugin/           # 横切插件
├── infoq-scaffold-frontend-vue/ # Vue 3 管理端
├── infoq-scaffold-frontend-react/# React 19 管理端
├── script/                      # 部署脚本
│   └── docker/                 # Docker Compose 配置
├── sql/                         # 数据库脚本
├── doc/                         # 文档
├── openspec/                    # OpenSpec 规范
└── .codex/                      # AI 协作资产
    ├── skills/                 # 仓库级 skill
    ├── scripts/                # 工具脚本
    └── config.toml            # MCP 配置
```

## 相关文档

- [贡献指南](CONTRIBUTING.md)
- [文档索引](doc/README.md)
- [AGENTS.md](AGENTS.md)
- [FAQ](doc/guide/faq.md)

---
title: "项目部署前准备"
description: "软件、端口、目录、配置和产物检查项。"
outline: [2, 3]
---

> [!TIP]
> 内容真值源：[`doc/devops/deploy-prerequisites.md`](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/doc/devops/deploy-prerequisites.md)
> 本页由 `infoq-scaffold-docs/scripts/sync-from-root-doc.mjs` 自动同步生成；请优先修改根 `doc/` 后再重新同步。

# 项目部署前准备

本文档用于说明 `infoq-scaffold-ai` 在正式部署前必须确认的环境、目录、端口、配置与产物准备项。

适用范围：

- Docker Compose / 脚本化部署
- 手动部署

不适用范围：

- 本地开发联调
- 只做单模块临时运行验证

## 1. 先选部署方式

在开始准备环境前，先确定本次采用哪条路径：

- Docker Compose 教程式部署：参考 [docker-compose-tutorial.md](/devops/docker-compose-tutorial)
- Docker Compose / 脚本化部署：参考 [docker-compose-deploy.md](/devops/docker-compose-deploy)
- 手动部署：参考 [manual-deploy.md](/devops/manual-deploy)

如果你还没有准备好数据库、Redis、Nginx、目录权限和证书，不建议直接进入部署步骤。

## 2. 软件与版本基线

以下版本要求来自当前仓库的代码、脚本、镜像和构建配置：

| 组件 | 基线 |
| --- | --- |
| Docker / Compose | Docker CE / Moby / Colima + `docker compose` 或 `docker-compose`，并启用 `docker buildx` |
| 后端构建镜像 | `maven:3.9.12-eclipse-temurin-17` |
| 后端运行镜像 | `bellsoft/liberica-openjdk-rocky:17.0.16-cds` |
| 手动部署 JDK | 17 |
| 手动部署 Maven | 3.9+ |
| Node.js | 24.18.0 |
| pnpm | >= 10.0.0 |
| MySQL | 8.x |
| Redis | 7.x |
| Nginx | 1.30.x |
| MQTT（可选） | EMQX 社区版 5.8.9 |
| Elasticsearch（可选） | 8.18.8 |
| Docker Compose | 仅在脚本化部署时需要 |

说明：

- Docker Compose / 脚本化部署不要求宿主机安装 JDK 或 Maven；后端 Maven 打包在 Docker builder 镜像 `maven:3.9.12-eclipse-temurin-17` 内完成，最终运行镜像仍是 `bellsoft/liberica-openjdk-rocky:17.0.16-cds`。后端 Dockerfile 使用 BuildKit `RUN --mount`，因此 Docker CLI 必须支持 `docker buildx`：[infoq-scaffold-backend/infoq-admin/Dockerfile](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-backend/infoq-admin/Dockerfile)
- 手动部署或本机直接执行 Maven 构建时，仍需要宿主机 JDK 17 与 Maven 3.9+。
- 前端本机开发、CI、docs 站点和 Docker 构建镜像统一固定基于 Node 24.18.0：[infoq-scaffold-frontend-vue/Dockerfile](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-frontend-vue/Dockerfile) [infoq-scaffold-frontend-react/Dockerfile](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-frontend-react/Dockerfile) [infoq-scaffold-frontend-react-pro/Dockerfile](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-frontend-react-pro/Dockerfile)。npm 版本不作为仓库构建基线单独固定，包管理器遵循各工作区 `packageManager` 与 lockfile。
- Docker Compose 默认依赖 MySQL 8.0、Redis 7.2、MinIO `RELEASE.2026-06-18T00-00-00Z`、Nginx 1.30：[script/docker/docker-compose.yml](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/script/docker/docker-compose.yml)

## 3. 端口与网络准备

默认会占用以下端口。基础服务端口始终需要空闲；前端直连端口按 `INFOQ_FRONTEND_TARGET` 决定，`all` 才需要三个前端端口都空闲。

| 服务 | 默认端口 |
| --- | --- |
| nginx 网关 | 80 / 443 |
| 后端 `infoq-admin` | 9090 |
| Vue 前端直连 | 9091 |
| React 前端直连 | 9092 |
| React Pro 前端直连 | 9093 |
| MySQL | 3306 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| MQTT TLS（可选） | single / cluster 均默认节点一 `127.0.0.1:8883` |
| Elasticsearch HTTPS（可选） | single / cluster 均默认节点一 `127.0.0.1:9200` |

前端目标与直连端口关系：

- `INFOQ_FRONTEND_TARGET=vue`：只需要 `9091`
- `INFOQ_FRONTEND_TARGET=react`：只需要 `9092`
- `INFOQ_FRONTEND_TARGET=react-pro`：只需要 `9093`
- `INFOQ_FRONTEND_TARGET=all`：需要 `9091`、`9092`、`9093`

默认对外用户入口优先走 Nginx：

- MinIO Console：`http://SERVER_IP/console-oss/`
- MinIO OSS：`http://SERVER_IP/oss/`

部署前至少确认：

- 基础服务端口和目标前端直连端口未被其他进程占用
- 服务器安全组、防火墙、反向代理策略允许目标端口访问
- 如需公网 HTTPS，证书和域名已准备完成
- 如启用可选 MQTT / Elasticsearch，已通过 `deploy-middleware.sh` 选择 `single` 或 `cluster`；生产逐节点证书、最小权限账户/ACL/role、数据目录权限和 `deploy.env` 变量已按 [docker-compose-deploy.md](/devops/docker-compose-deploy#01-可选-mqtt--elasticsearch单节点与三节点集群部署) 准备；不得使用 `*-it` 测试材料
- 选择 Elasticsearch cluster 时，宿主机 `vm.max_map_count` 至少为 `262144`，三个节点各自具备足够内存、磁盘与容器用户 `1000:0` 的数据目录写入权限；首次建群只允许数据目录为空时执行 `bootstrap`
- 首次安装会生成 `/etc/infoq-scaffold-ai/deploy.env` 和 `/etc/infoq-scaffold-ai/credentials.txt`，两个文件必须保留且权限为 `600`

## 4. 目录与权限准备

如果沿用仓库现有约定，WSL2 / 原生 Linux 部署根目录建议统一为 `/infoq`；macOS Colima 建议使用 `$HOME/infoq`，除非已经确认 `/infoq` 可被 Colima VM 稳定挂载。

执行 Docker Compose / 脚本化部署前，必须先确认以下目录存在：

```text
/tmp/infoq-deploy
${INFOQ_DEPLOY_ROOT}/server/temp
```

WSL2 / 原生 Linux 默认就是 `/infoq/server/temp`；macOS Colima 默认就是 `$HOME/infoq/server/temp`。

### 4.1 脚本化 / Compose 部署目录

当前脚本约定的宿主机目录包括：

```text
/infoq/mysql/data
/infoq/mysql/conf
/infoq/redis/conf
/infoq/redis/data
/infoq/minio/data
/infoq/server/config
/infoq/server/logs
/infoq/server/temp
/infoq/server/ip2region
/infoq/nginx/cert
/infoq/nginx/conf
/infoq/nginx/log
/infoq/vue/logs        # INFOQ_FRONTEND_TARGET=vue 或 all
/infoq/react/logs      # INFOQ_FRONTEND_TARGET=react 或 all
/infoq/react-pro/logs  # INFOQ_FRONTEND_TARGET=react-pro 或 all
```

### 4.2 手动部署推荐目录

手动部署不强制使用同样的目录，但建议保持语义一致，例如：

```text
/infoq/server/app
/infoq/server/config
/infoq/server/logs
/infoq/server/temp
/infoq/server/ip2region
/infoq/nginx/conf
/infoq/nginx/html/vue
/infoq/nginx/html/react
/infoq/nginx/log
```

部署账号需要对这些目录具备读写权限，尤其是：

- 后端日志目录
- 后端临时文件目录
- 后端 IPv6 地址库目录
- Nginx 静态资源目录
- Nginx 日志目录

## 5. 配置检查项

### 5.1 后端配置

重点检查：

- 数据库地址、账号、密码
- Redis 地址、端口、密码
- `spring.servlet.multipart.location`
- `security.token.secret`，推荐通过 `SECURITY_TOKEN_SECRET` 环境变量或外部配置文件提供
- `api-decrypt` 公私钥
- `DEPLOY_ID` 是否为当前发布批次值；[application-prod.yml](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml) 通过 `${DEPLOY_ID:}` 注入 `infoq.quartz.bootstrap.deploy-id`
- IPv6 地址库外置路径。Compose 部署默认使用 `INFOQ_IP2REGION_V6_PATH=/infoq/server/ip2region/ip2region_v6.xdb`，宿主机文件来自 [script/docker/server/ip2region/ip2region_v6.xdb](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/script/docker/server/ip2region/ip2region_v6.xdb)
- 邮件、OSS 或其他插件相关配置

主要配置来源：

- 默认生产配置：[infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml)
- 通用配置：[infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml)
- Compose 覆盖模板：[script/docker/server/application-prod.yml](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/script/docker/server/application-prod.yml)

生产环境不要直接保留仓库内默认密钥、默认数据库密码和示例邮箱配置。
生产 `prod` profile 开启 Quartz bootstrap guard 时，`DEPLOY_ID` 不能为空；同一批滚动发布的所有 backend 节点必须使用同一个 `DEPLOY_ID`，新批次发布必须换新值，禁止复用上一批值。

### 5.2 集群配置一致性检查

多节点部署前，至少逐项核对：

- 所有 backend 节点的 `SECURITY_TOKEN_SECRET` 完全一致，token TTL、issuer、clientId 规则也保持一致。
- 所有 backend 节点的 `api-decrypt.enabled`、`api-decrypt.publicKey`、`api-decrypt.privateKey` 与前端加密配置匹配；滚动切换 key 时必须按同一批次统一发布。
- 所有 backend 节点连接同一组 MySQL、Redis/Redisson 与 OSS 配置；`redisson.keyPrefix` 不得因节点不同而隔离 token、缓存、Quartz marker、WebSocket/SSE 注册表。
- 所有 backend 节点共享同一个 `DEPLOY_ID`，同一批次只允许 Quartz reconcile 执行一次。
- 如使用外部配置中心或密钥系统，发布前确认所有节点读取到同一配置版本。

### 5.3 前端配置

重点检查：

- `VITE_APP_CONTEXT_PATH`
- `VITE_APP_BASE_API`
- `VITE_APP_ENCRYPT`
- RSA 公私钥是否和后端一致
- `VITE_APP_CLIENT_ID`

配置入口：

- Vue：[infoq-scaffold-frontend-vue/.env.production](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-frontend-vue/.env.production)
- React：[infoq-scaffold-frontend-react/.env.production](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-frontend-react/.env.production)
- React Pro：[infoq-scaffold-frontend-react-pro/.env.production](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/infoq-scaffold-frontend-react-pro/.env.production)

### 5.4 网关配置

如果采用统一 Nginx 网关，需要确认：

- `INFOQ_FRONTEND_TARGET=all` 时 `/vue/`、`/react/`、`/react-pro/` 分别指向 Vue、React、React Pro 静态资源
- `INFOQ_FRONTEND_TARGET=react|react-pro|vue` 时 `/` 指向被选中的单个前端
- `/prod-api/` 反代到后端 `9090`
- HTTPS 证书路径和域名配置正确

现有 Compose 网关基线配置见：

- [script/docker/nginx/conf/nginx.conf](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/script/docker/nginx/conf/nginx.conf)

运维交付示例文件见：

- [doc/examples/systemd/infoq-admin.service](/examples/systemd/infoq-admin.service)
- [doc/examples/nginx/infoq-http.conf](/examples/nginx/infoq-http.conf)
- [doc/examples/nginx/infoq-https.conf](/examples/nginx/infoq-https.conf)

## 6. 数据初始化准备

当前仓库默认初始化 SQL 文件为：

- [sql/infoq_scaffold_2.0.0.sql](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/sql/infoq_scaffold_2.0.0.sql)

当前仓库增量 SQL 文件统一匹配：

- `sql/infoq_scaffold_update_*.sql`

部署前需要确认：

- 目标数据库字符集支持 `utf8mb4`
- 目标库名是否使用 `infoq`
- 如果是已有库，是否允许导入初始化 SQL
- 如果不是首次部署，是否已经有可用备份与回滚点
- 多节点滚动发布前，数据库增量必须先完成；禁止让新旧节点跨迁移前后混跑。
- 当前部署完成后应能查到 `sys_job`、`QRTZ_LOCKS`、`sys_oauth_provider`、`sys_oauth_identity`，且 `sys_client` 的 `e5cd7e4891bf95d1d19206ce24a7b32e` 客户端包含 `oauth` 授权类型。

## 7. 构建产物准备

### 7.1 后端

Docker Compose / 脚本化部署不需要提前在宿主机准备 jar；`infoq-admin` 镜像会在 Docker builder 阶段执行 Maven prod 打包，并把 `infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar` 复制进最终运行镜像。

手动部署时，构建后 jar 产物路径仍为 `infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar`。

### 7.2 前端

Vue 与 React 生产构建后都会产出 `dist/` 目录：

- Vue：`infoq-scaffold-frontend-vue/dist/`
- React：`infoq-scaffold-frontend-react/dist/`

如果部署流程依赖 CI 产物，需要在部署前确认：

- 构建已成功
- 产物版本可追溯
- 产物与当前配置文件匹配

## 8. 发布前最小验收清单

进入正式部署前，至少确认以下项目：

- 外部依赖已就绪：MySQL、Redis、Nginx、可选 MinIO
- 部署目录与权限已确认
- 生产配置已替换默认值
- 证书、域名、端口策略已确认
- 初始化 SQL 使用策略已确认
- `DEPLOY_ID`、`SECURITY_TOKEN_SECRET`、`api-decrypt` keys、Redis/Redisson 配置一致性已确认
- `/monitor/health/readiness` 在待接流量节点上返回 2xx，DB/Redis 不可用时能返回失败
- 滚动更新顺序已确认：先摘流量，再确认负载均衡不再转发到旧节点或连接排空，再停止旧节点
- 回滚方案已准备：上一个 jar、上一个前端静态包、数据库备份
- 日志查看路径已明确

如果以上任一项不明确，不建议直接执行上线部署。

# Docker Compose 部署说明

本文档以当前仓库的 `script/docker/docker-compose.yml` 为准，只保留现有工程真正可执行的部署入口。
当前文档对应项目基线版本为 `2.1.7`。

如果你需要的是完整部署前检查或非 Docker 的手动部署流程，请先阅读：

- [项目部署前准备](./deploy-prerequisites.md)
- [手动部署说明](./manual-deploy.md)

默认宿主机根目录是 `/infoq`。如果是在 macOS 本机配合 Docker Desktop 验证，建议先设置为绝对路径：

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
```

然后再执行后续脚本或 Docker Compose 命令。脚本会优先使用 `docker compose`，当前环境缺少 Docker Compose plugin 时回退到 standalone `docker-compose`。

## 1. 准备宿主机目录

先按 [script/docker/redis/data/README.md](../../script/docker/redis/data/README.md) 创建 `${INFOQ_DEPLOY_ROOT:-/infoq}/...` 目录。

最少要有：

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
/infoq/vue/logs
/infoq/react/logs
/infoq/react-pro/logs
```

其中 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/config/application-prod.yml` 会在首次执行 `bash script/bin/infoq.sh prepare` 时自动生成一份 Docker Compose 默认模板。
其中 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/ip2region/ip2region_v6.xdb` 会在 `prepare` 时从 [script/docker/server/ip2region/ip2region_v6.xdb](../../script/docker/server/ip2region/ip2region_v6.xdb) 初始化；如果目标文件已存在，脚本会保留外置磁盘上的现有文件。`infoq-admin` 容器会把 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/ip2region/` 只读挂载到 `/infoq/server/ip2region/`，并设置 `INFOQ_IP2REGION_V6_PATH=/infoq/server/ip2region/ip2region_v6.xdb`。
`bash script/bin/infoq.sh deploy` 会在启动 MySQL / Redis 后等待依赖就绪，并校验基础表、Quartz 调度表、监控菜单、配置元数据列和 OAuth 表/授权类型；缺失时会按顺序补导 `sql/infoq_scaffold_2.0.0.sql` 与当前 `sql/infoq_scaffold_update_*.sql` 增量脚本。
当前仓库的 Quartz bootstrap `deploy-id` 由 `DEPLOY_ID` 注入。脚本化 `deploy` 在未显式设置 `DEPLOY_ID` 时会生成一次当前批次号并写入 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/config/deploy-id`；同一批滚动发布的所有 backend 节点必须使用同一个值。

## 2. 首次部署后端

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export SECURITY_TOKEN_SECRET=replace-with-at-least-32-chars-secret
# 可选：不设置时 deploy 会生成并持久化当前批次号
# export DEPLOY_ID=2.1.7-20260602120000
bash script/bin/infoq.sh prepare
bash script/bin/infoq.sh deploy
```

常用命令：

```bash
bash script/bin/infoq.sh status
bash script/bin/infoq.sh logs infoq-admin
bash script/bin/infoq.sh restart
bash script/bin/infoq.sh stop
```

后端服务端口：

- `infoq-admin`: `9090`

说明：

- 首次空数据目录启动时，MySQL 容器会按顺序自动执行基础 SQL 与当前增量 SQL
- 如果数据目录已存在，但 `infoq` 库表或增量结构未初始化，`deploy` / `start` 也会补导缺失 SQL 并做关键表/列校验
- `deploy` 会生成或校验本次 `DEPLOY_ID`，然后准备宿主机目录、构建后端、启动依赖服务并拉起 `infoq-admin`
- `prepare` / `deploy` / `start` 会确保 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/ip2region/ip2region_v6.xdb` 存在；如果后续单独替换该文件，需要重启 `infoq-admin` 才会生效
- `start` 与 `restart` 会复用 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/config/deploy-id`；如果文件不存在，先执行 `deploy` 或显式设置 `DEPLOY_ID`
- 如果同一版本在同一天需要再次发布，应使用新的 `DEPLOY_ID` 并重新执行 `deploy`，不要复用上一批次号
- `infoq-admin` 容器 healthcheck 使用 `/monitor/health/readiness`；DB 或 Redis 不可用时容器会进入 unhealthy，而 `/monitor/health/liveness` 仅表示进程可响应 HTTP

## 3. 首次部署前端

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
bash script/bin/deploy-frontend.sh prepare
bash script/bin/deploy-frontend.sh deploy
```

`deploy` 会先同步 `${INFOQ_DEPLOY_ROOT:-/infoq}/nginx/conf/nginx.conf`，再顺序构建 Vue / React / React Pro 前端镜像，最后启动三个前端容器与 `nginx-web`。本机 Docker 验证时不要直接用 `docker compose up --build infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro` 并行构建替代脚本。

常用命令：

```bash
bash script/bin/deploy-frontend.sh status
bash script/bin/deploy-frontend.sh logs all
bash script/bin/deploy-frontend.sh restart
bash script/bin/deploy-frontend.sh stop
```

前端访问方式：

- 网关入口：`http://host/vue/`
- 网关入口：`http://host/react/`
- 网关入口：`http://host/react-pro/`
- Vue 直连端口：`9091`
- React 直连端口：`9092`
- React Pro 直连端口：`9093`

前端日志目录：

- Vue：`/infoq/vue/logs`
- React：`/infoq/react/logs`
- React Pro：`/infoq/react-pro/logs`
- 网关 Nginx：`/infoq/nginx/log`

## 4. 日常启动步骤

如果镜像已经构建过，且宿主机目录、数据库数据都还在，只需要执行启动命令，不必重新 `deploy`。

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export SECURITY_TOKEN_SECRET=replace-with-at-least-32-chars-secret

# 先启动后端依赖与 infoq-admin
bash script/bin/infoq.sh start

# 再启动 Vue / React / React Pro / nginx-web
bash script/bin/deploy-frontend.sh start
```

启动完成后可访问：

- `http://host/vue/`
- `http://host/react/`
- `http://host/react-pro/`
- `http://host/prod-api/`

说明：

- `bash script/bin/infoq.sh start` 适用于“启动已有容器”，会复用已经持久化的 `DEPLOY_ID`，不会生成新的部署批次。
- 如果你是发布新包、希望生产环境重新执行一次受控 Quartz reconcile，应使用新的 `DEPLOY_ID` 执行 `bash script/bin/infoq.sh deploy`。

## 5. 日常停止步骤

建议先停前端和网关，再停后端与基础服务：

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"

# 先停止 Vue / React / React Pro / nginx-web
bash script/bin/deploy-frontend.sh stop

# 再停止 infoq-admin / mysql / redis / minio
bash script/bin/infoq.sh stop
```

`infoq-admin` 已配置 Spring Boot graceful shutdown 和 Compose `stop_grace_period`。滚动更新时应先从负载均衡或 Nginx upstream 摘除旧节点，确认旧节点不再接收新流量或长连接排空，再停止旧容器；新节点必须在 `/monitor/health/readiness` 返回 2xx 后再纳入流量。WebSocket/SSE 客户端断线重连能力仍需按前端专项验证确认。

## 6. 常用运维命令

查看状态：

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
bash script/bin/infoq.sh status
bash script/bin/deploy-frontend.sh status
```

查看日志：

```bash
export INFOQ_DEPLOY_ROOT=doc/tmp/infoq-deploy
bash script/bin/infoq.sh logs infoq-admin
bash script/bin/deploy-frontend.sh logs all
```

重启服务：

```bash
export INFOQ_DEPLOY_ROOT=doc/tmp/infoq-deploy
bash script/bin/infoq.sh restart
bash script/bin/deploy-frontend.sh restart
```

## 7. 如需直接使用 Docker Compose CLI

```bash
docker compose -f script/docker/docker-compose.yml up -d --build
docker compose -f script/docker/docker-compose.yml ps
docker compose -f script/docker/docker-compose.yml logs -f infoq-admin
```

如果当前环境只有 standalone CLI，则使用等价的 `docker-compose -f script/docker/docker-compose.yml ...`。

直接使用 Docker Compose CLI 时，必须至少显式设置 `SECURITY_TOKEN_SECRET` 和 `DEPLOY_ID`，否则 `prod` profile 会在安全密钥或 Quartz bootstrap guard 处显式失败：

```bash
export SECURITY_TOKEN_SECRET=replace-with-at-least-32-chars-secret
export DEPLOY_ID=2.1.7-20260602120000
docker compose -f script/docker/docker-compose.yml up -d --build
```

直接使用 Docker Compose CLI 时，建议保证 `${INFOQ_DEPLOY_ROOT:-/infoq}/mysql/data` 为空目录，以便 MySQL 首次启动时自动执行 `sql/` 目录内的基础 SQL 与当前增量 SQL。
如果是多节点部署，同一批节点应共享同一组 MySQL、Redis/Redisson、`SECURITY_TOKEN_SECRET`、`api-decrypt` keys 和 `DEPLOY_ID`；新批次发布必须换新 `DEPLOY_ID`。

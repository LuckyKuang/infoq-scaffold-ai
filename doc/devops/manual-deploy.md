# 手动部署说明

本文档描述不依赖 Docker Compose 的真实手动部署流程，并补齐面向运维交付的示例文件。

适用场景：

- 目标环境不允许 Docker
- 需要接入已有的 MySQL / Redis / Nginx / MinIO
- 需要由运维侧按 jar + 静态资源方式部署

建议先阅读：

- [项目部署前准备](./deploy-prerequisites.md)
- [Docker Compose 部署说明](./docker-compose-deploy.md)

## 1. 部署目标

手动部署的最终形态通常是：

- MySQL、Redis 作为独立服务运行
- 后端以 `infoq-admin.jar` 方式运行在 `9090`
- Vue、React 与 React Pro 构建为静态资源
- Nginx 统一提供 `/vue/`、`/react/`、`/react-pro/`、`/prod-api/` 入口

与 Compose 部署相比，变化点只有运行方式；产物、路径语义和访问入口应尽量保持一致。

## 2. 运维交付物

建议把手动部署交付成一个明确的发布包，而不是只给几条零散命令。

推荐交付结构：

```text
infoq-release/
├── backend/
│   └── infoq-admin.jar
├── config/
│   └── application-prod.yml
├── ip2region/
│   └── ip2region_v6.xdb
├── frontend/
│   ├── vue-dist/
│   └── react-dist/
├── systemd/
│   └── infoq-admin.service
└── nginx/
    ├── infoq-http.conf
    └── infoq-https.conf
```

仓库内对应的运维示例文件：

- systemd 服务文件：[doc/examples/systemd/infoq-admin.service](../examples/systemd/infoq-admin.service)
- HTTP Nginx 配置：[doc/examples/nginx/infoq-http.conf](../examples/nginx/infoq-http.conf)
- HTTPS Nginx 配置：[doc/examples/nginx/infoq-https.conf](../examples/nginx/infoq-https.conf)

原则：

- HTTP 与 HTTPS 使用两份独立配置文件，不要把 HTTPS 段直接混入 HTTP 配置
- 后端、前端、配置和运维文件最好一起归档，避免发布时缺件

## 3. 后端部署

### 3.1 构建 jar

在仓库根目录执行：

```bash
node .codex/scripts/backend_mvn.mjs -- clean package -P prod -pl infoq-admin -am
```

构建产物：

- `infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar`

### 3.2 准备运行目录

推荐目录：

```bash
mkdir -p /infoq/server/app
mkdir -p /infoq/server/config
mkdir -p /infoq/server/logs
mkdir -p /infoq/server/temp
mkdir -p /infoq/server/ip2region
```

复制 jar：

```bash
cp infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar /infoq/server/app/
cp script/docker/server/ip2region/ip2region_v6.xdb /infoq/server/ip2region/
chmod 644 /infoq/server/ip2region/ip2region_v6.xdb
```

准备生产配置文件时，建议以仓库默认生产配置为基础，再按环境修改：

- [infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml](../../infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml)
- [infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml](../../infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml)

### 3.3 修改生产配置

手动部署时，至少要改掉以下默认项：

- MySQL 地址、账号、密码
- Redis 地址、端口、密码
- `spring.servlet.multipart.location`
- `security.token.secret`，推荐通过 `SECURITY_TOKEN_SECRET` 环境变量或外部配置文件提供
- `api-decrypt` 的示例密钥
- `INFOQ_IP2REGION_V6_PATH`，推荐指向 `/infoq/server/ip2region/ip2region_v6.xdb`
- 如启用邮件、OSS、SSE、WebSocket，对应配置也要同步确认
- `DEPLOY_ID` 是否已设置为当前发布批次值；[application-prod.yml](../../infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml) 通过 `${DEPLOY_ID:}` 注入 `infoq.quartz.bootstrap.deploy-id`

如果服务器目录不是 `/infoq/server/temp`，同步修改：

```yaml
spring.servlet.multipart.location: /your/path/server/temp
```

生产环境同一批滚动发布的所有 backend 节点必须共享同一个 `DEPLOY_ID`；新批次发布必须换新值。多节点还必须共享同一组 `SECURITY_TOKEN_SECRET`、`api-decrypt` keys、MySQL、Redis/Redisson 和 `redisson.keyPrefix`，否则会出现随机 401、接口加解密失败、缓存隔离或 Quartz marker 隔离。

### 3.4 初始化数据库

首次部署导入初始化 SQL 和当前增量 SQL：

```bash
mysql -u root -p < sql/infoq_scaffold_2.0.0.sql
for file in sql/infoq_scaffold_update_*.sql; do
  mysql -u root -p infoq < "$file"
done
```

SQL 文件：

- [sql/infoq_scaffold_2.0.0.sql](../../sql/infoq_scaffold_2.0.0.sql)
- `sql/infoq_scaffold_update_*.sql`

如果目标库已经有业务数据，先做备份，不要直接覆盖导入。
多节点滚动发布前必须先完成增量 SQL；当前版本至少应校验 `sys_job`、`QRTZ_LOCKS`、`sys_oauth_provider`、`sys_oauth_identity`，以及 `sys_client` 中 `e5cd7e4891bf95d1d19206ce24a7b32e` 客户端包含 `oauth` 授权类型。

### 3.5 启动后端

推荐显式指定生产 profile、附加配置目录和端口：

```bash
cd /infoq/server/app
SPRING_PROFILES_ACTIVE=prod \
SPRING_CONFIG_ADDITIONAL_LOCATION=file:/infoq/server/config/ \
DEPLOY_ID=2.1.7-20260602120000 \
SECURITY_TOKEN_SECRET=replace-with-at-least-32-chars-secret \
INFOQ_IP2REGION_V6_PATH=/infoq/server/ip2region/ip2region_v6.xdb \
nohup java \
  -Dserver.port=9090 \
  -Xms512m -Xmx1024m \
  -jar /infoq/server/app/infoq-admin.jar \
  > /infoq/server/logs/console.log 2>&1 &
```

直接运行适合临时验证；正式环境更建议用 systemd 托管。

说明：

- `SPRING_CONFIG_ADDITIONAL_LOCATION` 的作用与 Compose 中的运行方式保持一致
- `DEPLOY_ID` 是生产启动期 Quartz reconcile 的发布批次号；同一批多节点保持一致，新批次必须换新值
- `INFOQ_IP2REGION_V6_PATH` 指向外置 IPv6 地址库文件；替换 `ip2region_v6.xdb` 后需要重启后端进程才会生效
- 如果你不使用 `nohup`，也可以用 `systemd` 或 `supervisor` 托管

### 3.6 使用 systemd 托管

仓库已提供运维示例文件：

- [doc/examples/systemd/infoq-admin.service](../examples/systemd/infoq-admin.service)

推荐安装方式：

```bash
cp doc/examples/systemd/infoq-admin.service /etc/systemd/system/infoq-admin.service
systemctl daemon-reload
systemctl enable infoq-admin
systemctl start infoq-admin
```

常用运维命令：

```bash
systemctl status infoq-admin
systemctl restart infoq-admin
journalctl -u infoq-admin -n 200 --no-pager
```

使用前至少调整两项：

- `User` / `Group`
- `ExecStart` 中的 Java 路径、JVM 参数和 jar 路径
- `Environment="DEPLOY_ID=..."` 与 `Environment="SECURITY_TOKEN_SECRET=..."`

## 4. 前端部署

### 4.1 构建 Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm install
VITE_APP_CONTEXT_PATH=/vue/ pnpm run build:prod
```

构建产物目录：

- `infoq-scaffold-frontend-vue/dist/`

### 4.2 构建 React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm install
VITE_APP_CONTEXT_PATH=/react/ pnpm run build:prod
```

构建产物目录：

- `infoq-scaffold-frontend-react/dist/`

### 4.3 构建 React Pro 管理端

```bash
cd infoq-scaffold-frontend-react-pro
pnpm install
VITE_APP_CONTEXT_PATH=/react-pro/ pnpm run build
```

构建产物目录：

- `infoq-scaffold-frontend-react-pro/dist/`

### 4.4 准备静态资源目录

推荐目录：

```bash
mkdir -p /infoq/nginx/html/vue
mkdir -p /infoq/nginx/html/react
mkdir -p /infoq/nginx/html/react-pro
mkdir -p /infoq/nginx/log
mkdir -p /infoq/nginx/conf
```

复制构建产物：

```bash
cp -R infoq-scaffold-frontend-vue/dist/* /infoq/nginx/html/vue/
cp -R infoq-scaffold-frontend-react/dist/* /infoq/nginx/html/react/
cp -R infoq-scaffold-frontend-react-pro/dist/* /infoq/nginx/html/react-pro/
```

### 4.5 前端生产变量确认

手动部署前，先确认前端生产变量与网关路径一致：

- `VITE_APP_CONTEXT_PATH`
- `VITE_APP_BASE_API`

当前仓库默认是：

- Vue：`/vue/` + `/prod-api`
- React：`/react/` + `/prod-api`
- React Pro：`/react-pro/` + `/prod-api`

配置文件参考：

- [infoq-scaffold-frontend-vue/.env.production](../../infoq-scaffold-frontend-vue/.env.production)
- [infoq-scaffold-frontend-react/.env.production](../../infoq-scaffold-frontend-react/.env.production)
- [infoq-scaffold-frontend-react-pro/.env.production](../../infoq-scaffold-frontend-react-pro/.env.production)

## 5. Nginx 网关部署

当前仓库 Compose 版本的网关配置基线见：

- [script/docker/nginx/conf/nginx.conf](../../script/docker/nginx/conf/nginx.conf)

手动部署时，核心差异是：

- 前端不再代理到容器服务，而是直接读取本机静态目录
- `/prod-api/` 反代到本机或内网中的 `infoq-admin:9090`
- HTTP 与 HTTPS 分成两份独立配置文件

### 5.1 HTTP 配置文件

仅启用 HTTP 时，使用：

- [doc/examples/nginx/infoq-http.conf](../examples/nginx/infoq-http.conf)

安装方式：

```bash
cp doc/examples/nginx/infoq-http.conf /etc/nginx/nginx.conf
nginx -t
systemctl reload nginx
```

### 5.2 HTTPS 配置文件

启用 HTTPS 时，使用：

- [doc/examples/nginx/infoq-https.conf](../examples/nginx/infoq-https.conf)

安装方式：

```bash
cp doc/examples/nginx/infoq-https.conf /etc/nginx/nginx.conf
nginx -t
systemctl reload nginx
```

启用前请先准备：

- `/infoq/nginx/cert/` 目录
- 证书文件
- 私钥文件
- 正确的域名或 `server_name`

默认示例证书名为：

- `/infoq/nginx/cert/infoq.local.crt`
- `/infoq/nginx/cert/infoq.local.key`

如果实际文件名不同，先修改配置再重载 Nginx。

## 6. 标准发布步骤

建议按下面顺序执行：

1. 启动 MySQL
2. 启动 Redis
3. 如启用 OSS，启动 MinIO 或接入已有对象存储
4. 导入初始化 SQL
5. 按文件名顺序导入所有 `sql/infoq_scaffold_update_*.sql`
6. 设置 `DEPLOY_ID`、`SECURITY_TOKEN_SECRET` 和必要密钥配置后启动后端 `infoq-admin.jar`
7. 发布 Vue / React / React Pro 静态资源
8. 选择 HTTP 或 HTTPS 的 Nginx 配置文件
9. 启动或重载 Nginx

## 7. 验收检查

部署完成后至少检查：

- 后端进程已监听 `9090`
- Nginx 已监听 `80` 或 `443`
- `http://host/vue/` 可打开
- `http://host/react/` 可打开
- `http://host/react-pro/` 可打开
- `http://host/prod-api/` 已能反代到后端
- `http://host/prod-api/monitor/health/readiness` 返回 2xx；DB 或 Redis 不可用时该端点必须返回失败
- 登录、菜单、基础接口可正常访问

建议额外检查：

- 后端日志是否有数据库连接失败、Redis 认证失败、密钥配置错误
- Quartz bootstrap 日志是否显示当前 `DEPLOY_ID` 的 marker 执行或跳过行为符合预期
- 前端浏览器控制台是否有接口 404、502、加密解密失败
- 上传、字典、用户管理等基础功能是否正常

## 8. 滚动更新与停机排空

当前生产配置已启用 Spring Boot graceful shutdown。手动部署滚动更新建议顺序：

1. 先从 Nginx upstream、SLB 或其他负载均衡器摘除旧节点。
2. 确认负载均衡不再向旧节点转发新流量，或等待连接排空窗口结束。
3. 停止旧节点进程；systemd 示例使用 `TimeoutStopSec=45` 给应用留出优雅停机时间。
4. 启动新节点并确认 readiness 通过后，再纳入流量。

WebSocket/SSE 客户端断线重连能力仍需按前端专项验证确认；如果重连能力不足，滚动更新期间可能出现长连接中断。

## 9. 日志与排障

推荐日志位置：

- 后端：`/infoq/server/logs/console.log`
- Nginx：`/infoq/nginx/log/`

如果后端无法启动，优先检查：

- `application-prod.yml` 是否生效
- 数据库和 Redis 地址是否正确
- 生产密钥是否配置完整
- 临时目录是否存在且可写

如果前端页面能打开但接口失败，优先检查：

- `VITE_APP_BASE_API` 是否仍为 `/prod-api`
- Nginx `/prod-api/` 是否反代到 `9090`
- 后端是否实际启动在 `9090`

## 10. 回滚建议

手动部署不要只保留“当前版本”。

至少保留：

- 上一个后端 jar
- 上一个 Vue 静态包
- 上一个 React 静态包
- 本次发布前的数据库备份
- 当前生效的 Nginx 配置备份

一旦上线后出现严重异常，优先按以下顺序回滚：

1. 回退 Nginx 配置
2. 回退前端静态资源
3. 回退后端 jar
4. 必要时恢复数据库备份

# Manual Deploy

本文档描述不依赖 Docker Compose 的真实手动部署流程，并补齐面向运维交付的示例文件。

适用场景：

- 目标环境不允许 Docker
- 需要接入已有的 MySQL / Redis / Nginx / MinIO
- 需要由运维侧按 jar + 静态资源方式部署

建议先阅读：

- [部署指南](README.md)（前置条件、端口与目录准备）
- [Docker Compose](DOCKER.md)（容器化部署对照）

下文构建、复制与安装命令均从仓库根目录执行；服务启动块单独切换工作目录。目标主机需 JDK 21，构建机需 JDK 21 / Maven 3.9.x 与 Node 24.18.0 / pnpm 10.34.1。应用账号、文件 owner/权限、配置、数据库备份、TLS 与日志采集未准备完成时，不进入生产启动。

## 1. 部署目标

手动部署的最终形态通常是：

- MySQL、Redis 作为独立服务运行
- 后端以 `infoq-admin.jar` 方式运行在 `9090`
- Vue、React 构建为静态资源
- Nginx 统一提供 `/vue/`、`/react/`、`/prod-api/` 入口

与 Compose 部署相比，变化点只有运行方式；产物、路径语义和访问入口应尽量保持一致。

## 2. 运维交付物

建议把手动部署交付成一个明确的发布包，而不是只给几条零散命令。

推荐交付结构：

```text
release-bundle/
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

- systemd 服务文件：[examples/systemd/infoq-admin.service](examples/systemd/infoq-admin.service)
- HTTP Nginx 配置：[examples/nginx/infoq-http.conf](examples/nginx/infoq-http.conf)
- HTTPS Nginx 配置：[examples/nginx/infoq-https.conf](examples/nginx/infoq-https.conf)

原则：

- HTTP 与 HTTPS 使用两份独立配置文件，不要把 HTTPS 段直接混入 HTTP 配置
- 后端、前端、配置和运维文件最好一起归档，避免发布时缺件

## 3. 后端部署

### 3.1 构建 jar

在仓库根目录执行：

```bash
node tools/backend_mvn.mjs -- -DskipTests clean package -P prod -pl infoq-admin -am
```

构建产物：`backend/infoq-admin/target/infoq-admin.jar`。

打包不代替测试：发布前按 `tools/verify/README.md` 完成相关定向测试并保留结果，后端单测总时长控制在 60 秒内。构建前执行 `node tools/validate_utf8.mjs`。

### 3.2 准备运行目录

推荐目录：

```bash
mkdir -p /infoq/server/app
mkdir -p /infoq/server/config
mkdir -p /infoq/server/logs
mkdir -p /infoq/server/temp
mkdir -p /infoq/server/ip2region
```

上述系统路径由授权管理员创建。预先创建专用 `infoq` 用户/组；jar 与配置由受控部署账号拥有，服务账号只读，配置目录及秘密文件限制为必要用户可读。仅 `logs`、`temp` 等运行写入目录授予服务账号写权限，禁止递归 `chmod 777`；Nginx 的用户需能遍历静态资源父目录并读取文件。

复制 jar 与 IPv6 地址库：

```bash
cp backend/infoq-admin/target/infoq-admin.jar /infoq/server/app/
cp deploy/docker/server/ip2region/ip2region_v6.xdb /infoq/server/ip2region/
chmod 644 /infoq/server/ip2region/ip2region_v6.xdb
```

准备生产配置文件时，建议以仓库默认生产配置为基础，再按环境修改：

- [backend/infoq-admin/src/main/resources/application-prod.yml](../backend/infoq-admin/src/main/resources/application-prod.yml)
- [backend/infoq-admin/src/main/resources/application.yml](../backend/infoq-admin/src/main/resources/application.yml)

### 3.3 修改生产配置

手动部署时，至少要改掉以下默认项：

- MySQL 地址、账号、密码
- Redis 地址、端口、密码
- `spring.servlet.multipart.location`
- `security.token.secret`，推荐通过 `SECURITY_TOKEN_SECRET` 环境变量或外部配置文件提供
- `api-decrypt` 的示例密钥
- `INFOQ_IP2REGION_V6_PATH`，推荐指向 `/infoq/server/ip2region/ip2region_v6.xdb`
- 如启用邮件、OSS、SSE、WebSocket，对应配置也要同步确认
- `DEPLOY_ID` 是否已设置为当前发布批次值

仓库内 `application-prod.yml` 不再内置数据库或 Redis 默认密码；使用该文件时通过 `INFOQ_DB_USERNAME`、`INFOQ_DB_PASSWORD`、`REDIS_HOST`、`REDIS_PORT`、`REDIS_DATABASE`、`REDIS_PASSWORD`、`REDIS_SSL_ENABLED` 注入，或使用外部配置文件覆盖。

如果服务器目录不是 `/infoq/server/temp`，同步修改：

```yaml
spring.servlet.multipart.location: /your/path/server/temp
```

生产环境同一批滚动发布的所有 backend 节点必须共享同一个 `DEPLOY_ID`；新批次发布必须换新值。多节点还必须共享同一组 `SECURITY_TOKEN_SECRET`、`api-decrypt` keys、MySQL、Redis/Redisson 和 `redisson.keyPrefix`，否则会出现随机 401、接口加解密失败、缓存隔离或 Quartz marker 隔离。

### 3.4 初始化数据库

确认目标库为空后，首次导入冻结基线和当前适用增量；使用有权限的 DBA 账号，以下命令会修改数据库，任一步失败立即停止：

```bash
(
  set -euo pipefail
  mysql -u root -p < sql/infoq_scaffold_3.0.0.sql
  for file in sql/infoq_scaffold_update_*.sql; do
    mysql -u root -p infoq < "$file"
  done
)
```

已有环境不得重新导入基线或盲跑全部增量；先备份并按 [DATA-OPS.md](../docs/DATA-OPS.md) 确认已应用状态、仅执行缺失迁移及其回滚条件。多节点滚动发布前必须先完成增量 SQL；当前版本至少应校验 `sys_job`、`QRTZ_LOCKS`、`sys_oauth_provider`、`sys_oauth_identity`，以及 `sys_client` 中 `e5cd7e4891bf95d1d19206ce24a7b32e` 客户端包含 `oauth` 授权类型。创建最小权限应用账号并将独立受控凭据写入外部配置；本手动流程不会像安装器那样自动替换基线管理员和 OSS 凭据，必须另外完成并验证。

### 3.5 启动后端

推荐显式指定生产 profile、附加配置目录和端口：

先在私密终端或受控服务管理器注入真实 `DEPLOY_ID`、`SECURITY_TOKEN_SECRET`，并准备数据库/Redis/RSA 外部配置；下面的启动块拒绝缺失值，不使用示例 token：

```bash
(
set -euo pipefail
: "${DEPLOY_ID:?必须先注入当前发布批次}"
: "${SECURITY_TOKEN_SECRET:?必须先注入受控生产 token secret}"
cd /infoq/server/app
SPRING_PROFILES_ACTIVE=prod \
SPRING_CONFIG_ADDITIONAL_LOCATION=file:/infoq/server/config/ \
DEPLOY_ID="${DEPLOY_ID}" \
SECURITY_TOKEN_SECRET="${SECURITY_TOKEN_SECRET}" \
INFOQ_LOG_PATH=/infoq/server/logs \
INFOQ_IP2REGION_V6_PATH=/infoq/server/ip2region/ip2region_v6.xdb \
nohup java \
  -Dserver.port=9090 \
  -Xms512m -Xmx1024m \
  -jar /infoq/server/app/infoq-admin.jar \
  > /infoq/server/logs/console.log 2>&1 &
echo "backend pid=$!"
)
```

直接运行适合临时验证；正式环境更建议用 systemd 托管。

说明：

- `SPRING_CONFIG_ADDITIONAL_LOCATION` 的作用与 Compose 中的运行方式保持一致
- `DEPLOY_ID` 是生产启动期 Quartz reconcile 的发布批次号；同一批多节点保持一致，新批次必须换新值
- `INFOQ_IP2REGION_V6_PATH` 指向外置 IPv6 地址库文件；替换 `ip2region_v6.xdb` 后需要重启后端进程才会生效
- 如果你不使用 `nohup`，也可以用 `systemd` 或 `supervisor` 托管

### 3.6 使用 systemd 托管

推荐安装方式：

先准备 `/etc/infoq-scaffold-ai/backend.env`（root 拥有、`600`），至少包含 `DEPLOY_ID` 与 `SECURITY_TOKEN_SECRET` 的真实赋值。该文件遵循 systemd `EnvironmentFile` 语法，不能含 shell 的 `export`、命令替换或 `${...}` 展开；缺失文件会让示例服务明确失败。数据库/Redis/RSA 由外部 `application-prod.yml` 或适用环境变量配置，不把秘密直接写入世界可读的 unit。服务账号必须存在且可读必要配置、可写日志/临时目录。

```bash
cp deploy/examples/systemd/infoq-admin.service /etc/systemd/system/infoq-admin.service
systemctl daemon-reload
systemctl enable infoq-admin
systemctl start infoq-admin
```

常用运维命令：

```bash
systemctl status infoq-admin
systemctl restart infoq-admin
journalctl -u infoq-admin -n 200 --no-pager
tail -n 200 /infoq/server/logs/console.log
```

使用前逐项调整：

- `User` / `Group`
- `ExecStart` 中的 Java 路径、JVM 参数和 jar 路径
- `EnvironmentFile` 路径与当前发布批次/秘密来源
- 日志轮转与保留：示例 `StandardOutput/StandardError=append:...` 写文件，应用输出不全部进入 journal；目标 systemd 必须支持 `append:`，先用 `systemd-analyze verify` 检查

## 4. 前端部署

### 4.1 构建 Vue 管理端

```bash
pnpm --dir frontend-vue install --frozen-lockfile
VITE_APP_CONTEXT_PATH=/vue/ pnpm --dir frontend-vue run build:prod
```

构建产物目录：`frontend-vue/dist/`。

### 4.2 构建 React 管理端

```bash
pnpm --dir frontend-react install --frozen-lockfile
VITE_APP_CONTEXT_PATH=/react/ pnpm --dir frontend-react run build:prod
```

构建产物目录：`frontend-react/dist/`。

### 4.3 准备静态资源目录

推荐目录：

```bash
mkdir -p /infoq/nginx/html/vue
mkdir -p /infoq/nginx/html/react
mkdir -p /infoq/nginx/log
mkdir -p /infoq/nginx/conf
```

复制构建产物：

```bash
cp -R frontend-vue/dist/* /infoq/nginx/html/vue/
cp -R frontend-react/dist/* /infoq/nginx/html/react/
```

### 4.4 前端生产变量确认

手动部署前，先确认前端生产变量与网关路径一致：

- `VITE_APP_CONTEXT_PATH`
- `VITE_APP_BASE_API`

当前仓库默认是：

- `.env.production` 默认 context 为 `/`、API 为 `/prod-api`
- 本文双管理端构建命令显式覆盖为 Vue `/vue/`、React `/react/`；改变 context 后必须重建

两端默认 `VITE_APP_ENCRYPT=true`；构建前配置受控 `.env.production.local` 或构建环境变量，并与后端 `api-decrypt` 两组 RSA 配对。密钥方向、前端私钥可见性及 HTTPS 要求见 [README.md 第 1.4 节](README.md#14-配置检查项)。只复制静态文件不会更新产物中的变量。发布使用空的新版本目录，完整复制 `dist/.` 后受控切换，避免旧 hash 文件或覆盖一半的包；保留前一版本目录供回滚。

配置文件参考：

- [frontend-vue/.env.production](../frontend-vue/.env.production)
- [frontend-react/.env.production](../frontend-react/.env.production)

## 5. Nginx 网关部署

当前仓库 Compose 版本的网关配置基线见 [deploy/docker/nginx/conf/nginx.conf](../deploy/docker/nginx/conf/nginx.conf)。

手动部署时，核心差异是：

- 前端不再代理到容器服务，而是直接读取本机静态目录
- `/prod-api/` 默认反代到本机 `127.0.0.1:9090`，内网多节点需显式修改 upstream
- HTTP 与 HTTPS 分成两份独立配置文件

### 5.1 HTTP 配置文件

仅启用 HTTP 时，使用 [examples/nginx/infoq-http.conf](examples/nginx/infoq-http.conf)：

```bash
cp deploy/examples/nginx/infoq-http.conf /etc/nginx/nginx.conf
nginx -t
systemctl reload nginx
```

### 5.2 HTTPS 配置文件

启用 HTTPS 时，使用 [examples/nginx/infoq-https.conf](examples/nginx/infoq-https.conf)：

```bash
cp deploy/examples/nginx/infoq-https.conf /etc/nginx/nginx.conf
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

示例不包含 MinIO `/oss/`、`/console-oss/` 代理；启用 OSS 时另行评审并配置对象存储地址、TLS 与访问授权，不能假定 Compose 网关能力已随文件复制。HTTPS 示例启用带 `includeSubDomains` 的 HSTS，上线前必须确认所有子域均支持 HTTPS；证书应覆盖真实域名，先备份当前 Nginx 配置并执行 `nginx -t` 再 reload。

## 6. 标准发布步骤

建议按下面顺序执行：

1. 启动 MySQL
2. 启动 Redis
3. 如启用 OSS，启动 MinIO 或接入已有对象存储
4. 首次空库导入初始化 SQL；已有库禁止重导
5. 核对迁移状态后按顺序导入适用增量
6. 设置 `DEPLOY_ID`、`SECURITY_TOKEN_SECRET` 和必要密钥配置后启动后端 `infoq-admin.jar`
7. 发布 Vue / React 静态资源
8. 选择 HTTP 或 HTTPS 的 Nginx 配置文件
9. 启动或重载 Nginx

## 7. 验收检查

部署完成后至少检查：

- 后端进程已监听 `9090`
- Nginx 已监听 `80` 或 `443`
- `http://host/vue/` 可打开
- `http://host/react/` 可打开
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
- 后端应用滚动日志：`/infoq/server/logs/`（由 `INFOQ_LOG_PATH` 设置）
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

手动部署不要只保留"当前版本"。

至少保留：

- 上一个后端 jar
- 上一个 Vue 静态包
- 上一个 React 静态包
- 本次发布前的数据库备份
- 当前生效的 Nginx 配置备份

一旦上线后出现严重异常，优先按以下顺序回滚：

1. 摘除流量，保留失败日志，确认旧应用与当前数据库兼容。
2. 停止应用并恢复上一 jar、完整前端目录和匹配配置；不覆盖持久数据目录。
3. 恢复经校验的 Nginx 配置，`nginx -t` 成功后 reload，启动旧应用。
4. 若必须恢复数据库，先获数据恢复确认并按独立回滚脚本/备份方案执行；应用回滚不自动回退数据。
5. 验证 readiness、登录、关键 API、静态资源与日志，再恢复流量。

手动示例不提供告警、备份调度、容量保证或自动回滚。上线前须明确日志轮转/保留、磁盘和依赖告警接收人，并在目标环境演练告警及备份恢复；文档静态审阅不能作为这些项目已通过的证据。

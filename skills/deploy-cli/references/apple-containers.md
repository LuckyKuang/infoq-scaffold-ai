# Apple container 部署参考

本文件只补充 `skills/deploy-cli` 在 macOS 上的执行细节；完整真值在
`deploy/APPLE_CONTAINER.md`。

## 资源边界

| 资源 | 名称 |
| --- | --- |
| 网络 | `infoq-apple`（`192.168.66.0/24`） |
| 容器 | `infoq-apple-mysql`、`infoq-apple-redis`、`infoq-apple-admin` |
| 卷 | `infoq-apple-mysql-data`、`infoq-apple-redis-data` |
| 默认端口 | `19090`（`APPLE_CONTAINER_HOST_PORT`） |
| 默认部署根 | `$HOME/infoq-apple` |
| 状态文件 | `tmp/deploy-cli/state.json` |

脚本会给所有资源打 `org.infoq.stack=apple-container` 标签，并拒绝管理
其他项目或未打标签的资源。发现冲突时停止，不要手工删除他人资源。

## 前置条件

- Apple silicon Mac，macOS 26+，Apple `container` 1.1+。
- 首次使用先启动系统服务：

```bash
container system start
container --version
```

- 构建镜像需要宿主机 JDK 21 与 Maven 3.9.x；或复用已有
  `backend/infoq-admin/target/infoq-admin.jar`。

## 标准流程

```bash
# 1. 生成 deploy/.env 与随机秘密
node skills/deploy-cli/scripts/deploy_cli.mjs init

# 2. 打包后端并构建 localhost/infoq-admin:3.0.0-apple
node skills/deploy-cli/scripts/deploy_cli.mjs build

# 3. 启动 MySQL、Redis、infoq-admin，等待 readiness 后执行 smoke
node skills/deploy-cli/scripts/deploy_cli.mjs up

# 4. 只读复核
node skills/deploy-cli/scripts/deploy_cli.mjs status
node skills/deploy-cli/scripts/deploy_cli.mjs smoke
```

`up` 在镜像缺失时会自动构建；`up --recreate` 会替换三个容器但保留数据卷。

## 冒烟探针

默认基址 `http://127.0.0.1:19090`：

- `/monitor/health/readiness`：MySQL/Redis/应用依赖就绪。
- `/monitor/health/liveness`：进程可响应。
- `/auth/code`：验证码接口可用。

若 `APPLE_CONTAINER_BIND_HOST=0.0.0.0`，探针自动改用 `127.0.0.1`，避免把通配地址
当作可连接地址。

## 停止与清理

```bash
# 保留数据卷
node skills/deploy-cli/scripts/deploy_cli.mjs down

# 删除容器与网络，保留卷
node skills/deploy-cli/scripts/deploy_cli.mjs destroy --yes

# 显式删除验证数据卷（不可恢复）
node skills/deploy-cli/scripts/deploy_cli.mjs destroy --volumes --yes
```

`down` 与 `destroy` 都不会触碰其他项目资源、`.env`、宿主机 bind 目录或已拉取镜像。
Apple container 没有自动重启；宿主重启后需要重新执行 `up`。

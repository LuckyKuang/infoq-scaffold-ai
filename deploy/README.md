# 部署指南

本目录包含部署脚本和配置。

## 快速开始

### Docker Compose 部署

部署所有管理端（Vue + React）+ Nginx 网关：

```bash
bash deploy/install.sh
```

部署特定管理端：

```bash
bash script/bin/deploy-frontend.sh deploy vue
bash script/bin/deploy-frontend.sh deploy react
```

### 停止服务

```bash
bash script/bin/deploy-frontend.sh stop all
```

### 卸载

```bash
bash deploy/uninstall.sh
```

## 网关路由

部署 `all` 目标时，Nginx 网关提供以下路由：

- `/vue/` - Vue 管理端
- `/react/` - React 管理端
- `/console-oss/` - MinIO 控制台
- `/oss/` - OSS 文件访问

部署单个目标时，管理端挂载到根路径 `/`。

## 配置

### 环境变量

复制 `.env.example` 为 `.env` 并修改：

```bash
cp script/docker/.env.example script/docker/.env
```

关键配置：

- `MYSQL_ROOT_PASSWORD` - MySQL root 密码
- `REDIS_PASSWORD` - Redis 密码
- `MINIO_ROOT_USER` - MinIO 用户名
- `MINIO_ROOT_PASSWORD` - MinIO 密码

### 后端配置

修改 `script/docker/backend/application-docker.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://mysql:3306/infoq_scaffold?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=true&serverTimezone=GMT%2B8
    username: root
    password: ${MYSQL_ROOT_PASSWORD}
  data:
    redis:
      host: redis
      port: 6379
      password: ${REDIS_PASSWORD}
```

## 详细文档

完整的部署前置条件、教程和故障排除，请参考：

| 文档 | 说明 |
| --- | --- |
| [部署前置条件](../doc/devops/deploy-prerequisites.md) | 环境要求、依赖检查 |
| [Docker Compose 教程](../doc/devops/docker-compose-tutorial.md) | 容器编排基础 |
| [Docker Compose 部署](../doc/devops/docker-compose-deploy.md) | 完整部署流程 |
| [手动部署](../doc/devops/manual-deploy.md) | 非容器化部署 |

## 验证部署

使用 `infoq-deploy-verify` skill：

```bash
node .codex/skills/infoq-deploy-verify/scripts/verify_docker_compose.mjs
```

## 故障排除

### 容器启动失败

检查日志：

```bash
cd script/docker
docker compose logs backend
docker compose logs mysql
docker compose logs redis
```

### 数据库连接失败

确认 MySQL 容器已启动并完成初始化：

```bash
docker compose ps mysql
docker compose logs mysql | grep "ready for connections"
```

### 前端无法访问后端

确认后端容器运行且端口映射正确：

```bash
docker compose ps backend
curl http://localhost:8080/actuator/health
```

## 生产部署建议

- 更改所有默认密码
- 使用 HTTPS 和 TLS
- 配置防火墙规则
- 限制数据库和 Redis 访问范围
- 定期备份数据库
- 监控容器资源使用

详见 [SECURITY.md](../SECURITY.md)

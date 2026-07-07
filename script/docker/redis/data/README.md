默认部署根目录是 `/infoq`。执行下面的目录初始化命令前，先显式设置部署根目录：

```bash
export INFOQ_DEPLOY_ROOT=/infoq
```

如果是在 macOS 本机配合 Colima 做验证，建议显式使用可被 Colima 挂载的目录，例如：

```bash
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
```

后端脚本 `script/bin/infoq.sh` 与前端脚本 `script/bin/deploy-frontend.sh` 都支持这个环境变量。

数据目录请赋予读写权限，否则容器可能无法写入数据。

mysql 目录

```bash
mkdir -p "${INFOQ_DEPLOY_ROOT}/mysql/data/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/mysql/conf/"
```

redis 目录

```bash
mkdir -p "${INFOQ_DEPLOY_ROOT}/redis/conf/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/redis/data/"
```

minio 目录

```bash
mkdir -p "${INFOQ_DEPLOY_ROOT}/minio/data/"
```

Nginx 目录

```bash
mkdir -p "${INFOQ_DEPLOY_ROOT}/nginx/cert/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/nginx/conf/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/nginx/log/"
```

后端目录

```bash
mkdir -p "${INFOQ_DEPLOY_ROOT}/server/config/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/server/logs/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/server/temp/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/server/ip2region/"
```

前端目录

```bash
mkdir -p "${INFOQ_DEPLOY_ROOT}/vue/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/react/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/react-pro/"

# 前端日志存放目录
mkdir -p "${INFOQ_DEPLOY_ROOT}/vue/logs/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/react/logs/"
mkdir -p "${INFOQ_DEPLOY_ROOT}/react-pro/logs/"
```

赋予权限

```bash
chmod 777 -R "${INFOQ_DEPLOY_ROOT}/"
```

默认部署根目录是 `/infoq`。

如果是在 macOS 本机配合 Docker Desktop 做验证，建议改用可写目录，例如：

```bash
export INFOQ_DEPLOY_ROOT=doc/tmp/infoq-deploy
```

后端脚本 `script/bin/infoq.sh` 与前端脚本 `script/bin/deploy-frontend.sh` 都支持这个环境变量。

数据目录请赋予读写权限，否则容器可能无法写入数据。

mysql 目录

```bash
mkdir /infoq/mysql/data/
mkdir /infoq/mysql/conf/
```

redis 目录

```bash
mkdir /infoq/redis/conf/
mkdir /infoq/redis/data/
```

minio 目录

```bash
mkdir /infoq/minio/data/
```

Nginx 目录

```bash
mkdir /infoq/nginx/cert/
mkdir /infoq/nginx/conf/
mkdir /infoq/nginx/log/
```

后端目录

```bash
mkdir /infoq/server/config/
mkdir /infoq/server/logs/
mkdir /infoq/server/temp/
mkdir /infoq/server/ip2region/
```

前端目录

```bash
mkdir /infoq/vue/
mkdir /infoq/react/
mkdir /infoq/react-pro/

# 前端日志存放目录
mkdir /infoq/vue/logs/
mkdir /infoq/react/logs/
mkdir /infoq/react-pro/logs/
```

赋予权限

```bash
chmod 777 -R /infoq/
```

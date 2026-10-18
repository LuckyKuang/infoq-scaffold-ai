# 部署数据目录说明

Compose 的目录和配置准备以 [部署指南](../../../README.md) 与 [Docker 流程](../../../DOCKER.md) 为准。本文件位于 Redis 数据目录，但适用于完整栈目录预检；不会自动创建或启动服务。

显式设置部署根目录：WSL2/Linux 使用 Linux 文件系统（通常 `/infoq`），macOS Colima 通常使用 `$HOME/infoq`；已有环境必须以受控 `INFOQ_ENV_FILE` 的实际值为准。不得把数据目录放在 WSL DrvFS 下，也不得为重新初始化而清空已有数据。

最低预创建目录为 `/tmp/infoq-deploy` 与 `${INFOQ_DEPLOY_ROOT}/server/temp`。完整路径包括：

- MySQL：`mysql/data/`、`mysql/conf/`
- Redis：`redis/conf/`、`redis/data/`
- MinIO：`minio/data/`
- 后端：`server/config/`、`server/logs/`、`server/temp/`、`server/ip2region/`
- Nginx：`nginx/cert/`、`nginx/conf/`、`nginx/log/`
- 前端：按 `INFOQ_FRONTEND_TARGET` 创建 `vue/logs/`、`react/logs/`，`all` 时两者均需

所有相对路径均位于部署根目录内。由授权管理员按目标镜像的 UID/GID 设置 owner 和最小权限：服务仅对数据、日志和临时目录有写权限，配置和证书只允许必要用户读取。禁止递归 `chmod 777` 或把秘密文件设为所有用户可读。

helper 只把缺失目录创建为 `0755`，保留已有目录权限；遇到 other-writable 目录或符号链接时明确失败，管理员须先核验 UID/GID 并收紧旧版权限。不会递归 chmod/chown 既有数据。后端外置配置设为 `0600`。Redis 密码由 Compose argv/env 注入，`redis.conf` 不含密码、设为 `0644` 并只读挂载；具备 Docker socket 权限的账号仍能读取容器秘密，必须限制其访问。实际容器读写权限需在目标运行时验证。

Redis 只读诊断先检查容器日志、实际配置可读性、数据目录 owner/权限及持久化文件；不要打印环境文件、容器秘密或删除 RDB/AOF 解决认证/权限问题。停止和卸载的数据保留边界见 [部署生命周期](../../../DEPLOYMENT_LIFECYCLE.md)。

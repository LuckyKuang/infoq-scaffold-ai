# 2026-09-19 Apple Container 对齐计划

## 目标

把参考项目的 Apple Container 本机部署入口对齐到本仓库，并在不触碰
`sub2api-apple*` 的前提下完成本机 smoke。

## 范围

- `deploy/apple-container.sh`
- `deploy/Dockerfile.apple`
- `deploy/APPLE_CONTAINER.md`
- README / deploy / skill 文档
- 隔离网络 `192.168.66.0/24` 与端口 `19090`

## 非范围

- 完整 Compose 替代
- MinIO / Nginx / 双管理端
- 停止或迁移 `sub2api-apple*`

## 验证

证据目录：`docs/tmp/infoq-deploy-verify/20260919-apple-container/`

1. 拉取 `mysql:8.0.42`、`redis:7.2.8`、JDK 21 镜像
2. 构建 `localhost/infoq-admin:3.0.0-apple`
3. 启动 MySQL + Redis + admin
4. `curl` readiness
5. 只销毁 `infoq-apple*`
6. 确认 `sub2api-apple*` 仍 running

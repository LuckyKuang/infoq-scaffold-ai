# 2026-09-20 Redisson Spring Boot 4 对齐计划

## 目标

把 `redisson-spring-boot-starter` 从 3.52.0 升到 4.7.0，修复 Spring Boot 4.1
下的 Redis 自动配置，并完成本机 Apple Container readiness smoke。

## 范围

- `infoq-scaffold-backend/pom.xml` 的 `${redisson.version}`
- `infoq-plugin-redis` 对 `redisson-spring-cache` 的显式依赖
- redis 插件单测与 OSS 断言
- `deploy/apple-container.sh` 验证路径

## 非范围

- lock4j 主版本升级
- 停止 `sub2api-apple*`
- Apple 上的 MinIO / Nginx / 双管理端

## 验证

证据目录：`doc/tmp/infoq-deploy-verify/20260920-apple-container/`

1. redis 插件单测
2. 宿主机 `prod` 打包 `infoq-admin.jar`
3. 按 `linux/arm64` 拉取 MySQL / Redis / JDK 基础镜像
4. 构建并启动 `infoq-apple*`
5. curl readiness
6. 只销毁 `infoq-apple*`
7. 确认 `sub2api-apple*` 仍 running

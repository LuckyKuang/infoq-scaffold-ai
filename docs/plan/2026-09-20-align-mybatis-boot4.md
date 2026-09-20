# 2026-09-20 MyBatis / dynamic-datasource Spring Boot 4 对齐计划

## 目标

把 MyBatis-Plus 与 dynamic-datasource 的 starter 从 Spring Boot 3 构件
切换到同版本 Boot 4 构件，修复 `sqlSessionFactory` 缺失，并完成本机
Apple Container readiness smoke。

## 范围

- `infoq-scaffold-backend/pom.xml` 的 boot4 starter 坐标
- `infoq-plugin-mybatis` 与 `infoq-plugin-encrypt` 的直接依赖
- `infoq-system` Mapper XML 测试使用的 `mybatis-spring-boot-starter(-test)`
- `deploy/apple-container.sh` 验证路径

## 非范围

- 冻结 SQL 基线
- 停止 `sub2api-apple*`
- Apple 上的 MinIO / Nginx / 双管理端

## 验证

证据目录：`docs/tmp/infoq-deploy-verify/20260920-apple-container/`

1. mybatis / encrypt 插件单测
2. 宿主机 `prod` 打包 `infoq-admin.jar`
3. 重建并启动 `infoq-apple-admin`
4. curl readiness
5. 只销毁 `infoq-apple*`
6. 确认 `sub2api-apple*` 仍 running

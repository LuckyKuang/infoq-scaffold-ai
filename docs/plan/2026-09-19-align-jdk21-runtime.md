# 2026-09-19 对齐 JDK 21 运行基线

## 目标

把 CI、Maven runner、后端镜像和辅助 Maven 镜像从 JDK 17 收到 JDK 21，与
`infoq-scaffold-backend/pom.xml` 的 `java.version=21` 一致。

## Acceptance Contract

- Functional scope: CI Temurin 21、`backend_mvn.mjs` 只接受 21、backend
  Dockerfile `maven:3.9.12-eclipse-temurin-21` +
  `bellsoft/liberica-openjdk-rocky:21.0.12-cds`，MQTT/ES 辅助镜像同步。
- Non-goals: 不升级依赖，不跑完整 Compose 部署。
- Exception handling: 找不到 JDK 21 或镜像 tag 时显式失败。
- Observability: `backend_mvn.mjs --dry-run`、UTF-8、openspec_check。
- Rollback: 还原 CI、Dockerfile、runner 和文档中的镜像钉选。

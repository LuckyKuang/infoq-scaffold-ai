# 2026-09-19 对齐 deploy 入口

## 目标

把 `deploy/` 收成接近 sub2api 的操作入口：环境模板、正确的 Compose 命令，
以及与 `3.0.0` 一致的镜像标签。

## Acceptance Contract

- Functional scope: `deploy/.env.example`、文档命令修正、Compose 镜像 3.0.0、
  `make deploy-env`。
- Non-goals: 不搬迁 `script/docker/`，不跑完整 Compose。
- Exception handling: 无 Docker 时记录 blocker。
- Observability: `make test-docs`、openspec_check。
- Rollback: 删除 env 模板并还原文档与镜像标签。

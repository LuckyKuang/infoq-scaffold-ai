# 2026-09-19 文档体系对齐 sub2api

## 目标

参考 `/Users/pontus/DevTools/code/Learning/sub2api` 的文档治理方式，把本仓库
根文档、部署入口和校验脚本对齐到同一套结构，同时保持 InfoQ 的真实技术栈与
工作区布局。

## Acceptance Contract

- Functional scope: 双语 README + section markers、CONTRIBUTING / DEV_GUIDE /
  SECURITY、deploy 入口、Makefile、`tools/check_readme_sync.mjs`，并修正过期的
  JDK / SQL 基线路径。
- Non-goals: 不把工作区改名为 `backend/` / `frontend/`，不把 `doc/` 改名为
  `docs/`，不复制 Go、Apple Containers、push-cli、release-cli 或 UPSTREAM。
- Exception handling: sub2api 约定与本仓库事实冲突时，以本仓库代码和路径为准。
- Observability: `node tools/check_readme_sync.mjs` 与 `make test-docs`。
- Rollback: 还原本次文档、Makefile、tools 和 SQL 路径修改。

## 采用的参考约定

- 英文 README 为默认入口，中文放 `README_CN.md`，共用 `readme-section` ID
- 根目录保留 CONTRIBUTING、DEV_GUIDE、SECURITY
- `deploy/` 作为部署文档入口，详细教程仍在 `doc/devops/`
- `tools/` 做仓库级文档校验
- 根 Makefile 包装真实命令

## 刻意不采用

- 容器内才能跑测试
- 未实现的 `skills/push-cli`
- 把 `openspec/changes/` 改为不提交
- 日文 README

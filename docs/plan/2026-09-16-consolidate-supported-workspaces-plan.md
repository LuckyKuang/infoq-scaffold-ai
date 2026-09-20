# 目录收敛与文档同步执行计划

日期：2026-09-16

## 目标

将仓库支持基线收敛为 `infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue`，删除 React Pro、两个小程序端和独立文档站，并同步修复文档、OpenSpec、CI、部署脚本与验证技能中的过期入口。

## 执行步骤

1. 保留当前四个退役工作区的删除记录，确认目录不存在且没有占位入口。
2. 清理 CI、Docker Compose、nginx、安装/卸载/前端部署脚本及仅服务退役工作区的辅助脚本。
3. 更新根 README、GEMINI、`doc/`、OpenSpec 上下文与稳定规格，统一工作区清单、命令、链接和部署说明。
4. 更新 `skills` 中的验证、E2E、项目参考和发布目标说明，移除退役客户端分支和路径。
5. 执行引用残留扫描、UTF-8 门禁、OpenSpec 结构校验、保留工作区定向测试/lint/build，并人工审查差异。

## 验收与回滚

验收以 `openspec/changes/consolidate-supported-workspaces/proposal.md` 的 Acceptance Contract 为准。若保留工作区构建、启动、部署或核心文档链接因清理失败，恢复受影响的最小改动并保留 blocker 证据；不恢复已确认退役工作区作为长期支持入口。

## 验证证据

临时输出统一写入 `docs/tmp/`，包括引用扫描、UTF-8、OpenSpec 检查、测试与构建结果。数据库、API、业务页面和冻结初始化 SQL 不在本次变更范围内。

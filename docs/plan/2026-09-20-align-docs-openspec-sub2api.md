# 执行计划：align-docs-openspec-sub2api（2026-09-20）

> 本计划是 repo-level 治理变更的耐久记录。对应的 active change 位于
> `openspec/changes/align-docs-openspec-sub2api/`（本地计划，不提交）。

## 1. 背景与目标

`doc/` 目录积累 46 个跟踪文件，存在完全重复的文件、已删除工作区（react-pro）
的"三管理端"残留、JDK 17 / 2.1.9 陈旧引用；`openspec/` 的 `specs/` +
`project.md` + 受版本控制 `changes/` 模型与参考项目 sub2api 不一致，且未提交
change 目录在升级期间整体丢失过一次。

目标：`doc/` → `docs/` 并主题扁平化（收敛到 <= 20 个跟踪文件）；部署文档并入
`deploy/`；`openspec/` 切换为 `config.yaml + examples/demo-change + 本地
changes/`，规格真值迁 `docs/specs/`；全仓引用同步，门禁通过。

## 2. 目标结构

```text
docs/    README/ARCHITECTURE/AI-COLLABORATION/SKILLS/MCP-SERVERS/TESTING/FAQ/DESIGN
         specs/(8 capability) testing/(case 集合) plan/ ui-demos/ images/ tmp/(ignored)
deploy/  README(+前置条件) DOCKER(教程+脚本化) MANUAL APPLE_CONTAINER examples/
         bin/(运维脚本) docker/(compose 与运行时配置)
openspec/ config.yaml examples/demo-change/ changes/(gitignored)
skills/   11 个 infoq-* SOP（Agent Skills 开放标准，全 agent 可用）
tools/    check_readme_sync/run-env/backend_mvn/validate_utf8 等 + lib/(共享运行时)
         + mcp/(MCP 启动器)
.codex/  仅 config.toml（MCP 真值源）与 agents/（Codex custom agents）
```

## 3. 执行顺序

1. 写 OpenSpec change（proposal/tasks/design/spec delta）并通过 openspec_check。
2. `git mv doc docs`；`openspec/specs/*` → `docs/specs/*`；删除 `openspec/project.md`。
3. 合并去重：ARCHITECTURE（概览+后端+管理端手册）、AI-COLLABORATION
   （agents+subagents+工作流+模块文档治理）、SKILLS（skills 指南+插件目录）、
   TESTING（三份 E2E 政策）、README（扁平索引）；删除重复的
   `module-doc-governance.md`。
4. 部署文档收敛：prerequisites → deploy/README.md；tutorial + deploy →
   deploy/DOCKER.md；manual → deploy/MANUAL.md；examples → deploy/examples/。
5. openspec 新模型落地：config.yaml（并入 project.md 上下文）、
   examples/demo-change 模板。
6. 引用同步：AGENTS.md、README ×2、CONTRIBUTING、DEV_GUIDE、GEMINI ×2、
   tools/check_readme_sync.mjs、.gitignore、skills（admin-e2e / deploy-verify /
   delivery-workflow / release-ops）。
7. 验证：UTF-8、README 同步、openspec_check、全仓相对链接检查、`doc/` 残留
   grep（排除历史 plan 正文）。
8. 追加迁移（执行中用户确认）：`script/` 并入 `deploy/`（bin/docker），
   `.codex/` 提取为 `skills/` + `tools/`（lib、scripts、mcp），`.codex/` 仅留
   `config.toml` 与 `agents/`；修复全部相对 import、硬编码路径与仓库根检测。

## 4. 合并矩阵（被删文件 → 去向）

| 原文件 | 去向 |
| --- | --- |
| guide/project-overview.md | docs/ARCHITECTURE.md §1-2、§15 |
| guide/quick-start.md | DEV_GUIDE.md（根）+ docs/ARCHITECTURE.md §15 |
| guide/faq.md | docs/FAQ.md |
| backend/handbook.md | docs/ARCHITECTURE.md §3-8、§14-15 |
| admin/handbook.md | docs/ARCHITECTURE.md §9-13 |
| collaboration/agents-guide.md | docs/AI-COLLABORATION.md §1 |
| collaboration/subagents-guide.md | docs/AI-COLLABORATION.md §3 |
| collaboration/development-workflow.md | docs/AI-COLLABORATION.md §2 |
| collaboration/module-doc-governance.md | docs/AI-COLLABORATION.md §4 |
| module-doc-governance.md（重复） | 删除 |
| collaboration/skills-guide.md | docs/SKILLS.md §1-8 |
| collaboration/plugin-catalog.md | docs/SKILLS.md §9 |
| collaboration/mcp-servers.md | docs/MCP-SERVERS.md |
| design/DESIGN.md | docs/DESIGN.md |
| devops/deploy-prerequisites.md | deploy/README.md §1 |
| devops/docker-compose-tutorial.md | deploy/DOCKER.md §1-6、§8-9、§13-14 |
| devops/docker-compose-deploy.md | deploy/DOCKER.md §4、§7、§10-12 |
| devops/manual-deploy.md | deploy/MANUAL.md |
| test/frontend-web-automation/{cleanup,selector,test-data}-policy.md | docs/TESTING.md §2-4 |
| test/frontend-web-automation/{case-matrix,e2e-cases,whitebox-cases,gaps}.* | docs/testing/ |
| openspec/specs/* | docs/specs/* |
| openspec/project.md | openspec/config.yaml context |

## 5. 顺手清理项

- "三管理端"（react-pro 已删）残留：admin/handbook、devops 各文件的第三端
  描述、9093 端口、重复 React 章节。
- deploy-prerequisites 中"手动部署 JDK 17" → 21。
- manual-deploy 中 `DEPLOY_ID=2.1.9-20260602120000` 示例 → 3.0.0。
- agents-guide 中重复的 React 行；skills-guide 中重复的 E2E 命令。
- test-data-policy 中 `sql/infoq_scaffold_2.0.0.sql` → 3.0.0。

## 6. 风险与回滚

- 合并采用"先建新文件、后删旧文件"，任一步可回退。
- 回滚触发：出现无法修复的失效引用或规格内容丢失。
- `openspec/changes/` 本地化后，本 change 计划不提交；如未来需要迁移回
  版本控制模型，只需调整 .gitignore 并重新纳管。

## 7. 验证记录

- `node tools/validate_utf8.mjs`
- `node tools/check_readme_sync.mjs`
- `node skills/infoq-delivery-workflow/scripts/openspec_check.mjs align-docs-openspec-sub2api`
- 全仓相对链接检查 + `doc/` 残留 grep

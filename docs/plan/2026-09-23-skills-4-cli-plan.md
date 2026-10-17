# Skills 4-CLI 收敛执行计划（8 → 4）

- 日期：2026-09-23
- Change：`skills-4-cli-restructure`（本地脚手架 `openspec/changes/`，不进 PR）
- 参考形态：同类 CLI 型 skill 的通用分层（SKILL.md + agents + references + scripts + tests）
- 前置：`docs/plan/2026-09-23-skills-consolidation-plan.md`（11 → 8 阶段）

## 1. 目标形态

| Skill | 工作域 | 主入口 |
| --- | --- | --- |
| `test-cli` | Web 测试与运行态 | `scripts/playwright_cli.mjs`、`scripts/captcha_login.mjs`、`scripts/run_admin_e2e.mjs`、`scripts/run_admin_crud_e2e.mjs`、`scripts/start_admin_dev_stack.mjs` |
| `compress-cli` | AGENTS 规约压缩与校验 | `scripts/agents_check.mjs`（check / budget）、`scripts/test_agents_check.mjs` |
| `push-cli` | 推送与 PR 闭环 | `scripts/push_cli.mjs`（ensure / status / check / push / submit-pr / watch / merge） |
| `release-cli` | 版本与 GitHub Release | `scripts/release_cli.mjs`（plan / bump / tag / publish / verify）、`scripts/bump_version.mjs` |

## 2. 迁移映射（8 → 4 + 域外）

| 原位置 | 去向 |
| --- | --- |
| `infoq-browser-automate/scripts/*`（playwright / chrome-devtools / route-probe + pnpm 工程） | `skills/test-cli/scripts/` |
| `infoq-admin-e2e/scripts/*`（captcha / matrix / run_admin_e2e / run_admin_crud_e2e / ocr） | `skills/test-cli/scripts/` |
| `infoq-frontend-verify/scripts/*`（admin 栈启停 / token 片段 / 路由抓取） | `skills/test-cli/scripts/` |
| 三者 `references/*` | `skills/test-cli/references/`（matrix / captcha / crud / ops / react / vue / runtime） |
| 三者 `SKILL.md` | `skills/test-cli/references/modes/{browser,e2e,frontend}.md` |
| `infoq-backend-verify/scripts/*` + `references/*` + `SKILL.md` | `tools/verify/`（SOP 变 `tools/verify/README.md`） |
| `infoq-delivery-workflow/scripts/*` | `tools/{openspec_check,init_change_dir,generate_plugin_plan}.mjs` |
| `infoq-delivery-workflow/references/{workflow,ui-ux,plugin}` + `SKILL.md` | `docs/{OPENSPEC-WORKFLOW,UI-WORKFLOW,PLUGIN-MATRIX,DELIVERY-WORKFLOW}.md` |
| `infoq-data-ops/SKILL.md` | `docs/DATA-OPS.md` |
| `infoq-deploy-verify/*` | `deploy/VERIFICATION.md`、`deploy/runtime-matrix.md`、`deploy/wsl2-docker-compose.md` |
| `release-cli-ops/scripts/*` + `references/targets.md` + `SKILL.md` | `skills/release-cli/`（SOP 变 `references/release-ops-sop.md`） |
| `agents-md-compress`（通用） | 压缩写作方法保留给外部；仓库侧真值与校验器归 `compress-cli` |

## 3. push-cli 行为契约（用户要求）

1. 只推送非默认分支；处于默认分支时 `submit-pr` 自动 `git fetch` 默认分支并创建 `auto/<yyyymmdd-hhmmss>` 工作分支。
2. 推送后自动创建 PR（同 head 分支已存在 open PR 时复用；多个 PR 时失败退出）。
3. PR 必须通过 GitHub 校验：`watch` 轮询 `gh pr checks`；失败时输出失败 check 名称、链接与 `gh run view <id> --log-failed` 摘要，供修复。
4. 修复后在原 PR 上重跑 `submit-pr`（PR 复用），直到全绿。
5. 全绿后 `merge --pr <n> --yes` 合并到默认分支（禁止 `--admin`、禁止在未全绿时合并）。
6. 合并成功后进入 `release-cli`：`plan` 若判定版本非最新，先 `bump`（经 push-cli 合并），再 `tag` 与 `publish`。

## 4. 门禁与证据

- `compress-cli check`：4 个 skill、4 条 Local Skills、docs/SKILLS 表、Skill Trigger 引用、33 条 AGENTS.md 引用路径、14 个受保护类别。
- `push-cli check --profile docs|ci|full`：UTF-8、README 同步、AGENTS 校验、active change 的 OpenSpec 校验（profile 递进 + 双管理端 + backend）。
- `release-cli test_bump_version.mjs` + `bump_version.mjs --dry-run`：受管文件与 SQL 基线一致性。
- 证据统一 `tmp/test-cli/`、`tmp/push-cli/<run-id>/`、`tmp/verify/`、`tmp/compress-cli/`。

## 5. 后续裁剪（2026-09-23，用户确认）

删除 4 个低价值入口脚本并合并 OCR 实现，`test-cli/scripts/` 从 15 个脚本降为 11 个：

| 处置 | 对象 | 替代路径 |
| --- | --- | --- |
| 删除 | `start_admin_dev_stack.mjs`、`stop_admin_dev_stack.mjs` | 本地栈由 `run_admin_e2e.mjs` / `run_admin_crud_e2e.mjs` 自管（启动 → 验证 → 按 `tmp/test-cli/e2e/stack/<client>/state.json` 收口）；纯单测迭代按 `references/runtime/admin-commands.md` 手动启动 |
| 删除 | `print_admin_login_inject_snippet.mjs` | `captcha_login.mjs --print-token` 输出真实 token |
| 删除 | `fetch_admin_routes_with_token.mjs` | `playwright_cli.mjs admin-route-probe --list-routes` |
| 合并 | `ocr_captcha.py` | ddddocr 逻辑内联进 `captcha_login.mjs`（`python3 -c` 由 Node 入口调度），不再维护独立 `.py` |

保留：`tools/lib/admin_dev_stack.mjs`（仍被两个 E2E 脚本 import）。

## 6. 延期范围与残余风险

- 真实远程写操作（push / PR / merge / tag / Release）本轮未执行，只交付可复跑 CLI 与 dry-run 证据。
- backend Maven 全量测试与 admin E2E 运行态验证未在本轮执行（需 JDK/Maven 与本地栈），登记为 blocker。
- `test-cli` 仍是体量最大的 skill（11 个脚本 + 8 组 references），依赖 `references/modes/*` 分层控制上下文成本。

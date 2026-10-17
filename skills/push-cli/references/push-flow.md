# 推送与 PR 流程细则

## 1. 状态机

```text
ensure -> check(可选) -> [默认分支? 新建工作分支] -> commit -> push -> PR -> watch
   ^                                                                    |
   |                                                                    v
   +------------------ 失败回流：修复代码后重新 submit-pr ----------- watch(失败)
                                                                        |
                                                              watch(全绿) -> merge --yes -> release-cli
```

## 2. 分支策略

| 当前分支 | 行为 |
| --- | --- |
| 默认分支（`master`） | `submit-pr` 先 `git fetch origin <default>`，再 `git checkout -b auto/<yyyymmdd-hhmmss> origin/<default>`；本地未提交改动随工作区一并带到新分支 |
| 普通工作分支 | 直接使用当前分支；若分支落后于默认分支，先合并或变基后再提交 |
| `auto/*` 分支 | 允许重复 `submit-pr`（同一 PR 复用），不允许 `--force` 之外的历史改写 |

硬约束：

- 永远不推送默认分支。
- 永远不使用 `--force`、`--all`、`--tags`；`--force-with-lease` 只允许在显式传入且分支已存在于远端时使用。
- detached HEAD、脏工作区（有未提交改动时执行 `push`）、未完成的 merge/rebase/cherry-pick/revert 一律拒绝。

## 3. 校验矩阵

| profile | 覆盖 |
| --- | --- |
| `docs` | `tools/validate_utf8.mjs`、`tools/check_readme_sync.mjs`、`tools/check_release_version.mjs`、`tools/check_doc_links.mjs`、`skills/compress-cli/scripts/agents_check.mjs check`、存在 active change 时的 `tools/openspec_check.mjs <change-id>` |
| `ci` | docs + React admin `lint`/`test`/`build:prod` + Vue admin `lint:eslint`/`test:unit`/`build:prod`（与 `.github/workflows/ci.yml` 对齐） |
| `full` | ci + `tools/backend_mvn.mjs -- -DskipTests=false test` |

失败语义：任一命令非零退出即硬失败，退出码与日志写入 `tmp/push-cli/<run-id>/`，不允许跳过或伪造通过。

## 4. PR 契约

- 标题：取 `--message` 首行；未提供时使用最近一次提交主题。
- 正文必须包含：变更摘要、跑过的校验命令、影响面（docs/SQL/dependency/rollback）、是否包含破坏性操作。
- 复用规则：同一 head 分支只允许一个 open PR；存在多个或 head/base 不匹配时必须失败退出，不猜测。
- 校验状态来源：GitHub required checks（含 CI Build 的 encoding / backend / admin-frontend 三个 job）。

## 5. 失败回流

`watch` 在失败时输出：

1. 失败的 check 名称与链接；
2. 失败 run 的 `--log-failed` 摘要（截断到合理长度）；
3. 明确的下一步：修复 → 重新 `submit-pr`（PR 复用）→ 再次 `watch`。

禁止行为：直接改 PR 校验状态、重跑无关 job 掩盖失败、放宽断言或降低阈值。

## 6. 合并门禁

`merge --yes` 之前必须同时满足：

- `gh pr view` 显示 PR 为 open、非 draft；
- head SHA 与本次运行记录一致；
- base 为默认分支且分支未落后（落后则先更新再提交）；
- 所有必需校验为 success；
- 用户已显式授权本次合并（`--yes`）。

禁止：`--admin` 绕过、在保护规则未满足时合并、在失败状态下重试合并。

## 7. 与发布衔接

合并成功后，版本与 Release 由 `release-cli` 负责：先 `plan` 判断当前版本是否为最新，必要时 `bump`，再 `tag` 与 `publish`。

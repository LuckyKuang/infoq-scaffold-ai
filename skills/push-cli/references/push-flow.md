# 推送与 PR 流程细则

## 1. 状态机

```text
ensure -> check -> submit-pr 预览 -> submit-pr --execute -> [默认分支? 新建工作分支] -> commit -> push -> PR -> watch
   ^                                                                    |
   |                                                                    v
   +------------------ 失败回流：修复代码后重新 submit-pr ----------- watch(失败)
                                                                        |
                                                              watch(全绿) -> merge --yes 预览 -> merge --yes --execute -> release-cli
```

## 2. 分支策略

| 当前分支 | 行为 |
| --- | --- |
| 默认分支（由 `gh repo view` 读取） | `submit-pr --execute` 先 `git fetch origin <default>`，再 `git checkout -b auto/<yyyymmdd-hhmmss> origin/<default>`；本地改动能否携带取决于 Git checkout 的冲突检查，失败即停止 |
| 普通工作分支 | 直接使用当前分支；若分支落后于默认分支，先合并或变基后再提交 |
| `auto/*` 分支 | 允许重复 `submit-pr`（同一 PR 复用）；改写远端分支只允许显式 `push --force-with-lease --execute` |

硬约束：

- 永远不推送默认分支。
- 永远不使用 `--force`、`--all`、`--tags`；`--force-with-lease` 只允许在显式传入且分支已存在于远端时使用。
- detached HEAD、脏工作区（有未提交改动时执行 `push`）、未完成的 merge/rebase/cherry-pick/revert 一律拒绝。

`push`、`submit-pr`、`merge` 默认只预览；`--dry-run` 可显式表示预览，与 `--execute` 同时出现时无论顺序均失败。预览不创建分支或提交，也不运行 `submit-pr` 的本地校验矩阵。`ensure` 读取认证与仓库信息，执行写命令时才调用 `gh auth setup-git`；预览仍需已登录且具有写权限。

## 3. 校验矩阵

| profile | 覆盖 |
| --- | --- |
| `docs` | `tools/validate_utf8.mjs`、`tools/check_readme_sync.mjs`、`tools/check_release_version.mjs`、`tools/check_doc_links.mjs`、`skills/compress-cli/scripts/agents_check.mjs check`、存在 active change 时的 `tools/openspec_check.mjs <change-id>` |
| `ci` | 精确对齐 `.github/workflows/ci.yml`：UTF-8、README、版本、文档链接 + React/Vue lint/test/build + 后端 `clean package -P dev`；不含 agents_check / openspec_check |
| `full` | docs（含 agents_check / active openspec_check）+ ci；用于发布前完整本地门禁 |

失败语义：任一命令非零退出即硬失败，退出码与日志写入 `tmp/push-cli/<run-id>/`，不允许跳过或伪造通过。

## 4. PR 契约

- 标题：取 `--message` 首行；未提供时使用最近一次提交主题。
- 正文必须包含：变更摘要、跑过的校验命令、影响面（docs/SQL/dependency/rollback）、是否包含破坏性操作。
- 复用规则：同一 head 分支只允许一个 open PR；存在多个或 head/base 不匹配时必须失败退出，不猜测。
- 校验状态来源：`gh pr checks` 与 `gh pr view statusCheckRollup`，CLI 不读取分支保护规则。CI 当前显示 Repository Gates、Backend Build、Admin Frontend (react)、Admin Frontend (vue)；仓库管理员须将所需检查配置为 required，不能仅凭文档认为保护已开启。

## 5. 失败回流

`watch` 在失败时输出：

1. 失败的 check 名称与链接；
2. 失败 run 的 `--log-failed` 摘要（截断到合理长度）；
3. 明确的下一步：修复 → 重新 `submit-pr`（PR 复用）→ 再次 `watch`。

禁止行为：直接改 PR 校验状态、重跑无关 job 掩盖失败、放宽断言或降低阈值。

## 6. 合并门禁

`merge --pr <number> --yes --execute` 之前必须同时满足：

- `gh pr view` 显示 PR 为 open、非 draft；
- head SHA 有效，`--match-head-commit` 绑定本次读取的 SHA，防止检查后 head 变化；
- base 为默认分支且 mergeable 为 MERGEABLE；
- 存在校验，且结论全部为 SUCCESS、NEUTRAL 或 SKIPPED；失败、未知与进行中的结论拒绝；
- 用户已显式授权本次合并（`--yes`）。

`--yes` 单独使用仍仅预览。分支是否必须保持最新、哪些检查必须成功，由 GitHub 保护规则执行；CLI 不验证本地运行记录与远程 head 的历史一致性，也不自行检查落后数量。执行前核验这些保护，不应将跳过的必需检查视为成功。

禁止：`--admin` 绕过、在保护规则未满足时合并、在失败状态下重试合并。

## 7. 与发布衔接

合并成功后，版本与 Release 由 `release-cli` 负责：先 `plan` 判断是否需要 `bump`，再预览 `tag`，显式 `tag --execute` 推送后由 Release workflow 构建发布；成功后 `verify`。不要与 workflow 并发手动 `publish`。

## 8. 隔离回归 SOP

触发条件：修改参数解析、默认执行模式、push/PR/merge 门禁或校验矩阵。

1. 运行 `node skills/push-cli/scripts/test_push_cli.mjs`。它在 `tmp/documentation-audit/push-cli-*/` 创建隔离 Git 仓库与本地 bare origin，Git 只访问这些本地路径，所有 gh 调用由预加载替身接管；不依赖真实 gh 登录或网络。
2. 检查默认与显式预览没有 branch/commit/tag/push 或 gh 写调用，默认分支/head 保持不变；显式执行只写 fixture，并保留 merge `--yes` 和 head SHA 绑定。
3. 检查未知/缺值/冲突参数的退出码非零，两种冲突顺序均覆盖；门禁失败不写入。`runs.log` 与 `calls.jsonl` 保留命令、退出码和替身调用证据。
4. 执行 `node --check skills/push-cli/scripts/push_cli.mjs`、`node tools/validate_utf8.mjs skills/push-cli` 与 `git diff --check`。

禁止连接实际 origin 验证写路径、把源码字符串匹配当行为验证、删掉失败断言或以 `--skip-check` 代替实际校验。fixture 不启动服务器或浏览器，不需要端口清理；证据保留在 `tmp/` 供本轮审查。

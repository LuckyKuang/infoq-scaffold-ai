---
name: push-cli
description: 预览或执行 GitHub 分支推送、PR 创建与校验回流、受控合并。适用于推送代码、提交 PR、修复 PR 校验失败或合并 PR；远程写入默认预览，显式 --execute 才执行，合并还需 --yes。
---

# InfoQ 推送与 PR 闭环

本技能负责从本地改动到默认分支的受控推送链路。`push`、`submit-pr`、`merge` 默认 dry-run，只有显式 `--execute` 才执行写操作。预览不会创建分支、提交、tag 或远程写入；仍会读取 GitHub 状态并要求相应前置条件。`--execute` 与 `--dry-run` 互斥，未知参数和缺失参数值显式失败。
参数按子命令校验：`check` 会实际运行矩阵，不接受 `--dry-run`；`--json` 仅适用于 `status`。`origin` 的唯一 fetch/push URL 必须指向同一 GitHub 仓库，gh 请求显式绑定该目标，不受 `GH_REPO` 或默认 remote 选择影响。

## 硬边界

- **禁止直推默认分支**：默认分支只接受 PR 合并。
- 处于默认分支时，`submit-pr --execute` 会用 `fetch --no-tags` 从 `origin/<default>` 拉取最新提交并新建工作分支（`auto/<yyyymmdd-hhmmss>`），后续提交与推送都发生在该分支；预览只展示计划。
- 禁止 `--force`、`--all`、`--tags` 等危险推送形式；只有显式 `--force-with-lease` 才允许改写已推送分支，远端不存在该分支时拒绝。
- PR 必须通过 GitHub 校验；校验未全绿时禁止合并。
- 合并是独立步骤，必须显式 `--execute --yes`；`--admin` 绕过分支保护一律禁止。`--yes` 单独使用仍是预览。
- 凭证只使用已登录的 GitHub CLI 会话（`gh auth setup-git`）；禁止在仓库中写入 token，禁止静默切换到其他凭证方式。

## 执行顺序

1. 判定范围：确认是快速推送、完整 PR 提交、只看校验状态，还是修复校验失败。
2. 探测：`ensure` 校验 gh 登录、仓库信息与写权限；`status` 查看当前分支、脏文件与已打开的 PR，并 fetch 默认分支以计算落后数量。它们不远程写入；`status` 会更新本地远程跟踪引用。
3. 本地校验：`check` 运行仓库校验矩阵（`docs` / `ci` / `full`；`ci` 覆盖本机 CI 核心检查，`full` 追加 docs 门禁）。
4. 提交与推送：先预览 `submit-pr`，确认目标与影响后加 `--execute`；它在工作分支上校验、提交并推送。预览不会实际运行校验矩阵，不能把预览视为检查通过。
5. PR 与校验：`submit-pr` 创建或复用 PR，然后 `watch` 轮询 GitHub 校验；失败时输出失败 check 名称与失败日志摘要。
6. 修复回流：根据失败日志修改代码 → 重新 `submit-pr`（同一个 PR 会被复用），直到校验全绿。
7. 合并：先预览 `merge --pr <number> --yes`，满足门禁并获得合并授权后用 `--execute --yes` 执行，删除远端分支。
8. 发布衔接：合并完成后使用 `release-cli` 做版本与 Release 发布。

## 默认命令

```bash
node skills/push-cli/scripts/push_cli.mjs ensure
node skills/push-cli/scripts/push_cli.mjs status
node skills/push-cli/scripts/push_cli.mjs check --profile docs
node skills/push-cli/scripts/push_cli.mjs check --profile ci
node skills/push-cli/scripts/push_cli.mjs push
node skills/push-cli/scripts/push_cli.mjs push --execute
node skills/push-cli/scripts/push_cli.mjs submit-pr --message "fix: 修复 xxx"
node skills/push-cli/scripts/push_cli.mjs submit-pr --message "fix: 修复 xxx" --execute
node skills/push-cli/scripts/push_cli.mjs watch --pr <number>
node skills/push-cli/scripts/push_cli.mjs merge --pr <number> --yes
node skills/push-cli/scripts/push_cli.mjs merge --pr <number> --yes --execute
node skills/push-cli/scripts/test_push_cli.mjs
```

## 校验矩阵

- `--profile docs`：`node tools/validate_utf8.mjs`、`node tools/check_readme_sync.mjs`、`node tools/check_release_version.mjs`、`node tools/check_doc_links.mjs`、`node skills/compress-cli/scripts/agents_check.mjs check`，并在存在 active change 时运行 `node tools/openspec_check.mjs <change-id>`。
- `--profile ci`：覆盖 `.github/workflows/ci.yml` 的本机核心步骤：UTF-8、README、版本、文档链接 + 固定 Maven 安装器回归 + release-cli/bump/version/assets/policy 五组回归 + React/Vue lint/test/build + `node tools/backend_mvn.mjs -- -B -ntp -DskipTests=false clean package -P dev` 与同命令的 `-P prod`，分别覆盖完整业务单测和生产配置回归。不包含 agents_check / openspec_check，也不代替远端 OS 矩阵、安全扫描或运行态验收。Maven 安装器回归需要访问 Maven Central 与可用 Java；生产前端构建须先按 `docs/RELEASING.md` 准备受控或显式隔离构建输入。
- `--profile full`：docs 矩阵（含 agents_check / active openspec_check）+ CI 矩阵；用于发布前完整本地门禁。
- 任一命令失败即为硬失败；禁止把失败标记为通过后继续推送。

## 证据目录

`tmp/push-cli/<run-id>/push.log` 保存 CLI 摘要；`check-*.log` 保存实际运行的本地矩阵输出。`watch` 失败 check、链接与日志摘要输出到终端，需调用方另存到 `tmp/`；CLI 不保存独立 PR 元数据文件或全部终端错误输出。

## 护栏

- `push` 拒绝脏工作区；`submit-pr` 允许脏工作区并需要 `--message` 才提交。两者拒绝 detached HEAD 并检查未完成的 Git 操作标记。
- `openspec/changes/` 是本地脚手架，禁止提交。
- 校验失败不得通过放宽断言、跳过校验或降低阈值来"变绿"。
- 合并前确认：PR 为 open、非 draft、base 为默认分支、状态为 MERGEABLE、存在已完成校验；CLI 接受 SUCCESS/NEUTRAL/SKIPPED，并通过 `--match-head-commit` 绑定本次读取的 head SHA。必需检查与分支保持最新的要求由 GitHub 分支保护配置，发布者需核验，CLI 不读取仓库保护规则。
- 合并失败或校验过期（分支又落后于默认分支）时必须重新提交，不允许降低保护。
- 任何远程写操作失败都要保留命令与错误摘要，不做静默重试。

## 参考

- 推送与 PR 流程细则：`references/push-flow.md`
- 仓库协作文档：`CONTRIBUTING.md`、`docs/AI-COLLABORATION.md`
- 版本与发布：`skills/release-cli/SKILL.md`

---
name: push-cli
description: 把本地改动安全推送到 GitHub 远程并走完 PR 校验闭环。覆盖默认分支保护（禁止直推默认分支，处于默认分支时自动拉取分支）、本地校验矩阵、分支推送、PR 创建或复用、GitHub 校验轮询、失败日志回流修复，以及校验全绿后的受控合并。适用于用户要求推送代码、提交 PR、修复 PR 校验失败或合并 PR 的场景。
---

# InfoQ 推送与 PR 闭环

本技能只负责一件事：从本地改动到默认分支的受控推送链路。它默认 dry-run，只有在显式给出确认参数时才执行远程写操作。

## 硬边界

- **禁止直推默认分支**：默认分支只接受 PR 合并。
- 处于默认分支时，`submit-pr` 会从 `origin/<default>` 拉取最新提交并新建工作分支（`auto/<yyyymmdd-hhmmss>`），后续提交与推送都发生在该分支。
- 禁止 `--force`、`--all`、`--tags` 等危险推送形式；只有显式 `--force-with-lease` 才允许改写已推送分支。
- PR 必须通过 GitHub 校验；校验未全绿时禁止合并。
- 合并是独立步骤，必须显式 `--yes`；`--admin` 绕过分支保护一律禁止。
- 凭证只使用已登录的 GitHub CLI 会话（`gh auth setup-git`）；禁止在仓库中写入 token，禁止静默切换到其他凭证方式。

## 执行顺序

1. 判定范围：确认是快速推送、完整 PR 提交、只看校验状态，还是修复校验失败。
2. 只读探测：`ensure` 校验 gh 登录、仓库身份、默认分支与工作区状态；`status` 查看当前分支、脏文件与已打开的 PR。
3. 本地校验：`check` 运行仓库校验矩阵（UTF-8、README 同步、版本一致性、文档链接、AGENTS 校验、前端 lint/test，可选 build 与 backend）。
4. 提交与推送：`submit-pr` 在非默认分支上提交并推送；失败的校验必须在本地修复后重跑，不允许带着红色校验推送。
5. PR 与校验：`submit-pr` 创建或复用 PR，然后 `watch` 轮询 GitHub 校验；失败时输出失败 check 名称与失败日志摘要。
6. 修复回流：根据失败日志修改代码 → 重新 `submit-pr`（同一个 PR 会被复用），直到校验全绿。
7. 合并：`merge --yes` 在全部校验通过后合并到默认分支并删除远端分支。
8. 发布衔接：合并完成后使用 `release-cli` 做版本与 Release 发布。

## 默认命令

```bash
node skills/push-cli/scripts/push_cli.mjs ensure
node skills/push-cli/scripts/push_cli.mjs status
node skills/push-cli/scripts/push_cli.mjs check --profile docs
node skills/push-cli/scripts/push_cli.mjs check --profile ci
node skills/push-cli/scripts/push_cli.mjs push --dry-run
node skills/push-cli/scripts/push_cli.mjs push
node skills/push-cli/scripts/push_cli.mjs submit-pr --message "fix: 修复 xxx" --dry-run
node skills/push-cli/scripts/push_cli.mjs submit-pr --message "fix: 修复 xxx"
node skills/push-cli/scripts/push_cli.mjs watch --pr <number>
node skills/push-cli/scripts/push_cli.mjs merge --pr <number> --yes
```

## 校验矩阵

- `--profile docs`：`node tools/validate_utf8.mjs`、`node tools/check_readme_sync.mjs`、`node tools/check_release_version.mjs`、`node tools/check_doc_links.mjs`、`node skills/compress-cli/scripts/agents_check.mjs check`，并在存在 active change 时运行 `node tools/openspec_check.mjs <change-id>`。
- `--profile ci`：docs 矩阵 + React admin（`lint`/`test`/`build:prod`）与 Vue admin（`lint:eslint`/`test:unit`/`build:prod`），与 `.github/workflows/ci.yml` 对齐。
- `--profile full`：ci 矩阵 + `node tools/backend_mvn.mjs -- -DskipTests=false test`（需要 JDK 21 与 Maven 3.9.x）。
- 任一命令失败即为硬失败；禁止把失败标记为通过后继续推送。

## 证据目录

`tmp/push-cli/<run-id>/`：每次 `check` / `submit-pr` / `watch` 的日志、失败摘要与 PR 元数据。

## 护栏

- 工作区脏、detached HEAD、未完成的 merge/rebase/cherry-pick/revert 时拒绝推送。
- `openspec/changes/` 是本地脚手架，禁止提交。
- 校验失败不得通过放宽断言、跳过校验或降低阈值来"变绿"。
- 合并前必须确认：PR 处于 open、非 draft、head/base 与本次运行记录一致、所有必需校验为 success。
- 合并失败或校验过期（分支又落后于默认分支）时必须重新提交，不允许降低保护。
- 任何远程写操作失败都要保留命令与错误摘要，不做静默重试。

## 参考

- 推送与 PR 流程细则：`references/push-flow.md`
- 仓库协作文档：`CONTRIBUTING.md`、`docs/AI-COLLABORATION.md`
- 版本与发布：`skills/release-cli/SKILL.md`

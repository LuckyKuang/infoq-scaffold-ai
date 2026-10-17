---
name: release-cli
description: 在 PR 合并到默认分支后发布 GitHub release 版本。覆盖版本现状核对（当前版本与最新远程 tag 对比）、必要时先升级版本、版本受管文件同步与 SQL 基线保护、标注 tag 创建与推送、GitHub Release 发布与校验，以及发布前检查与回滚条件。适用于版本升级、发布 release、确认版本是否为最新，或发布失败后的恢复。
---

# InfoQ 版本与 Release 发布

本技能只负责一件事：从「合并后的默认分支」到「已发布且可验证的 GitHub Release」。

## 执行顺序

1. `plan`：读取当前版本（后端 `pom.xml` `<revision>` 与两个前端 `package.json`）、最新远程 tag、待发布的提交清单，判断是否必须先 bump。
2. **版本不是最新版时先升级**：`plan` 会显式失败并要求先执行 `bump --version <x.y.z>`；`bump` 走 `bump_version.mjs` 的受管文件同步与 SQL 基线校验。
3. `bump`：同步后端 revision、BOM revision、React/Vue package 版本、README 徽标、deploy 文档基线、Docker 镜像 tag、SpringDoc 测试与 DEPLOY_ID 示例；完成后提交（提交与推送走 `push-cli`）。
4. `tag`：在合并后的默认分支上创建标注 tag（默认 `v<x.y.z>`）并推送；tag 必须指向已通过校验的合并提交。
5. `publish`：用 `gh release create` 创建 Release，附发布说明（变更提交清单 + 校验结论），并校验 Release 已发布。
6. `verify`：确认远端 tag、Release 状态与版本字段一致；不一致即失败并输出回滚步骤。

## 默认命令

```bash
node skills/release-cli/scripts/release_cli.mjs plan
node skills/release-cli/scripts/release_cli.mjs plan --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs bump --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1 --dry-run
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs publish --version 3.0.1 --notes-file <path>
node skills/release-cli/scripts/release_cli.mjs verify --version 3.0.1
```

版本同步内核与回归测试（受管文件清单见 `references/targets.md`）：

```bash
node skills/release-cli/scripts/bump_version.mjs --dry-run 3.0.1
node skills/release-cli/scripts/test_bump_version.mjs
```

## SQL 策略

- 项目版本升级与 SQL 初始化文件重命名是两个独立决策；默认保持 `sql/infoq_scaffold_x.y.z.sql` 文件名不变。
- 永不修改冻结初始化基线；需要结构变更时新增 `sql/infoq_scaffold_update_YYYYMMDD.sql`。

## 护栏

- 目标版本必须匹配 `x.y.z`；tag 名默认 `v<x.y.z>`，已存在的 tag 一律拒绝复用。
- 远程写操作（推 tag、创建 Release）默认 dry-run，必须显式去掉 `--dry-run` 才真正执行。
- 版本不是最新时必须先 bump 再发布，不允许用旧版本重复发布。
- 依赖版本与 lockfile 必须一致；受管文件缺一即失败。
- 执行前先枚举目标：版本号、受管文件、`DEPLOY_ID` 示例、SQL 策略、依赖/lockfile 影响与回滚条件；写入后检查变更文件与脚本输出，不手工散改版本字段。
- docs 同步、版本断言、lockfile 不一致或 SQL 策略冲突时必须显式失败并停止发布。
- 发布前检查 config、SQL、dependency、rollback 与 observability 影响；未检查项列入 residual risk。
- 发布失败不得通过手工散改部分文件伪造一致性；回滚路径 = 删除远端 tag/Release + 用 `bump` 回到上一版本。

## 参考

- 受管文件与断言：`references/targets.md`
- 发布流程细则：`references/release-flow.md`
- 版本同步内核：`scripts/bump_version.mjs`、`scripts/test_bump_version.mjs`
- 推送与 PR：`skills/push-cli/SKILL.md`

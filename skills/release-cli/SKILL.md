---
name: release-cli
description: 核对发布版本、同步受管版本文件、预览或执行标注 tag 与 GitHub Release 操作，并验证发布状态。适用于版本升级、发布与失败恢复；tag/publish 默认预览且需 --execute，生产部署由 deploy-cli 负责。
---

# InfoQ 版本与 Release 发布

本技能负责版本同步和合并后的 GitHub Release 发布。`tag`、`publish` 默认 dry-run，显式 `--execute` 才写入；预览不创建本地 tag。`--execute` 与 `--dry-run` 互斥，未知或缺值参数显式失败。`bump` 是本地写操作，使用 `--dry-run` 才不修改文件。
参数按子命令校验，`--json` 只适用于 `plan`；`plan`/`verify` 不接受 `--dry-run`。Git remote 的唯一 fetch/push URL 必须指向同一仓库，gh 请求显式绑定该目标。

## 执行顺序

1. `plan`：读取当前版本（后端 `pom.xml` `<revision>` 与两个前端 `package.json`）、最新远程 tag、待发布的提交清单，判断是否必须先 bump。
2. **当前版本不高于最新远程 tag 时先升级**：`plan` 显式失败并建议新版本；`--version` 只覆盖建议值，不执行升级，也不替代版本高于最新 tag 的人工确认。
3. `bump`：同步后端 revision、BOM revision、React/Vue package 版本、README 徽标、deploy 文档基线、`deploy/.env.example` 的 `INFOQ_VERSION`、Docker 镜像 tag、SpringDoc 测试与 DEPLOY_ID 示例；所有替换先在内存预检，再写入。完成后提交（提交与推送走 `push-cli`）。
4. `tag`：预览目标，确认 CI 在候选提交通过且版本高于最新 tag 后，用 `--execute` 创建并推送标注 tag（默认 `v<x.y.z>`）。CLI 要求工作区干净，检查 HEAD 与最新远端默认分支一致及 tag 不存在，不查询 CI 状态。
5. 当前仓库推送 `v*` tag 会自动触发 Release workflow 构建和发布。等待成功后 `verify`；不要再并发手动 `publish`。仅在自动发布未运行且明确需要独立发布时，预览并显式 `publish --execute`；它不会构建或上传 jar/dist 产物。
6. `verify`：确认工作区版本、远端 tag 存在、Release 非 draft/prerelease；失败时定位错误并按 `references/release-flow.md` 恢复。它不校验产物完整性、tag 的提交 SHA 或生产可用性，必须另行核对。

## 默认命令

```bash
node skills/release-cli/scripts/release_cli.mjs plan
node skills/release-cli/scripts/release_cli.mjs plan --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs bump --version 3.0.1 --dry-run
node skills/release-cli/scripts/release_cli.mjs bump --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1 --execute
node skills/release-cli/scripts/release_cli.mjs verify --version 3.0.1
# 仅独立手动发布场景，先确认自动 workflow 没有运行或发布
node skills/release-cli/scripts/release_cli.mjs publish --version 3.0.1 --notes-file <path>
node skills/release-cli/scripts/release_cli.mjs publish --version 3.0.1 --notes-file <path> --execute
```

版本同步内核与回归测试（受管文件清单见 `references/targets.md`）：

```bash
node skills/release-cli/scripts/bump_version.mjs --dry-run 3.0.1
node skills/release-cli/scripts/test_bump_version.mjs
node skills/release-cli/scripts/test_release_cli.mjs
node skills/release-cli/scripts/test_release_assets.mjs
node tools/test_check_release_version.mjs
```

## SQL 策略

- 项目版本升级与 SQL 初始化文件重命名是两个独立决策；默认保持 `sql/infoq_scaffold_x.y.z.sql` 文件名不变。
- 永不修改冻结初始化基线；需要结构变更时新增 `sql/infoq_scaffold_update_YYYYMMDD.sql`。

## 护栏

- 目标版本必须匹配 `x.y.z`；tag 名默认 `v<x.y.z>`，已存在的 tag 一律拒绝复用。
- 远程写操作（推 tag、创建 Release）默认 dry-run，必须显式 `--execute` 才执行；省略 `--dry-run` 仍是预览。tag 预览用 `fetch --no-tags` 更新本地远端跟踪引用，不自动获取其它 tag；推送使用精确 `refs/tags/<tag>`，避免同名 branch 歧义。
- 自动 workflow 发布前将 `backend-jar`、`vue-dist`、`react-dist` 放在独立目录，每个目录只接受对应的 `infoq-admin.jar`、`vue-dist.tar.gz`、`react-dist.tar.gz` 非空普通文件；缺失、跨 artifact 重名、错名、额外、空资产或符号链接阻止创建 Release。独立手工 `publish` 不上传这些资产。
- 版本不是最新时必须先 bump 再发布，不允许用旧版本重复发布。
- 依赖版本与 lockfile 必须一致；受管文件缺一即失败。
- 执行前先枚举目标：版本号、受管文件、`DEPLOY_ID` 示例、SQL 策略、依赖/lockfile 影响与回滚条件；写入后检查变更文件与脚本输出，不手工散改版本字段。
- docs 同步、版本断言、lockfile 不一致或 SQL 策略冲突时必须显式失败并停止发布。
- 发布前检查 config、SQL、dependency、rollback 与 observability 影响；未检查项列入 residual risk。
- 发布失败保留原 tag、Release 和日志证据；先确认公开状态、workflow 与消费者，再决定修复重跑或新 patch。禁止把删除公开历史记录或 `bump` 降版本当作默认回滚。应用回滚使用已验证旧产物，数据恢复按独立迁移/备份方案执行；本 CLI 不回滚部署或数据库。

## 参考

- 受管文件与断言：`references/targets.md`
- 发布流程细则：`references/release-flow.md`
- 版本同步内核：`scripts/bump_version.mjs`、`scripts/test_bump_version.mjs`
- 推送与 PR：`skills/push-cli/SKILL.md`

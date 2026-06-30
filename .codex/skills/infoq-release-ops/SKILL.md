---
name: infoq-release-ops
description: 执行本仓库发布操作，覆盖版本升级、后端 Maven revision、前端 package 与小程序 manifest 版本、Docker 镜像标签、发布文档、DEPLOY_ID 部署批次示例、docs 同步、版本断言和发布前验证。适用于升级版本号、发布到指定 x.y.z、同步 README/docker/pom/package/manifest/doc/backend config/test 与 docs 站点版本。
---

# InfoQ 发布操作

本技能只负责一件事：发布相关版本与文档同步。它是写入型高风险领域 SOP，默认先 dry-run 和影响检查，再执行实际版本变更。

## 执行顺序

1. 判定范围：确认目标是版本升级、发布前检查、Docker tag、package/manifest 同步、docs 同步，还是发布文档更新。
2. 目标枚举：列出目标版本、受管文件、工作区、`DEPLOY_ID` 示例、SQL 策略、依赖/lockfile 影响、docs 影响和回滚条件。
3. 预览优先：先运行 `bump_version.mjs --dry-run <version>`，核对输出后再执行写入。
4. 写入执行：实际运行版本升级脚本后，检查变更文件和脚本输出，不手工散改版本字段。
5. 发布前验证：执行脚本回归、版本断言、依赖一致性、config/SQL/dependency/rollback/observability 检查。
6. 失败处理：docs 同步、版本断言、lockfile 不一致或 SQL 策略冲突时显式失败；SQL 或数据迁移细节转交 `infoq-data-ops`，不继续发布。

## 默认命令

升级版本：

```bash
node .codex/skills/infoq-release-ops/scripts/bump_version.mjs 2.0.3
```

预览：

```bash
node .codex/skills/infoq-release-ops/scripts/bump_version.mjs --dry-run 2.0.3
```

脚本回归：

```bash
node .codex/skills/infoq-release-ops/scripts/test_bump_version.mjs
```

## 默认 SQL 策略

- 项目版本升级与 SQL 初始化文件重命名是两个独立决策。
- 默认保持现有 `sql/infoq_scaffold_x.y.z.sql` 文件名不变。
- 不修改冻结初始化基线。

## 护栏

- 目标版本必须符合 `x.y.z`。
- 实际写入前必须先执行 dry-run 并核对影响范围。
- 依赖版本与 lockfile 必须保持一致。
- docs 同步脚本失败时必须显式失败。
- 发布前检查 config、SQL、dependency、rollback、observability 影响。
- 不修改冻结初始化 SQL；需要 SQL 变化时新增当前日期增量脚本。
- 发布失败或版本断言失败时，不能通过手工散改部分文件来伪造一致性。

## 参考

- 受管目标：`references/targets.md`
- 主脚本：`scripts/bump_version.mjs`
- 回归脚本：`scripts/test_bump_version.mjs`

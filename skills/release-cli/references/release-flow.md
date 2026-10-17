# 发布流程细则

## 1. 状态机

```text
PR 合并到默认分支
        |
        v
release_cli plan  ──(版本 <= 最新 tag)──> bump --version x.y.z ──> push-cli submit-pr ──> 合并
        |                                                                                      |
   (版本已最新)                                                                                v
        |<------------------------------------------------------------------------------- tag --version x.y.z
        v
publish --version x.y.z (--notes-file | --generate-notes)
        |
        v
verify --version x.y.z  ->  release 已发布且非 draft/prerelease
```

## 2. 版本真值

| 项 | 位置 |
| --- | --- |
| 后端 revision | `backend/pom.xml` `<revision>` |
| BOM revision | `backend/infoq-core/infoq-core-bom/pom.xml` |
| React 版本 | `frontend-react/package.json` `version` |
| Vue 版本 | `frontend-vue/package.json` `version` |
| README 徽标 | `README.md` / `README_CN.md` 版本徽标 |
| deploy 基线 | `deploy/DOCKER.md`「当前文档对应项目基线版本」 |
| Docker 镜像 tag | `deploy/docker/docker-compose.yml` |
| SpringDoc 断言 | `infoq-plugin-doc` 下 `SpringDocConfigTest` / `SpringDocPropertiesTest` |
| DEPLOY_ID 示例 | `deploy/MANUAL.md`、`deploy/examples/systemd/infoq-admin.service`、`application*.yml` 注释、`QuartzManagedProperties`、`QuartzBootstrapCoordinatorTest` |

三个版本字段（backend / react / vue）必须一致，否则 `plan`、`tag`、`verify` 全部失败。

## 3. 版本不是最新时的处理

- `plan` 会把 `当前版本 <= 最新远程 tag` 视为「需要先 bump」，并显式失败，同时给出建议版本（默认 patch +1，可用 `--version` 指定）。
- `bump` 只负责同步受管文件；提交与推送必须走 `push-cli`（禁止手工直推默认分支），合并后再回到 `tag`。
- 禁止在版本落后的情况下发布：`publish` 会校验远端 tag 存在，`verify` 会校验版本字段与 tag 一致。

## 4. tag 规则

- 默认 tag 名 `v<x.y.z>`，可用 `--tag` 覆盖。
- 必须在 `HEAD == origin/<default>` 时创建（即 PR 已合并且本地已拉取）；否则失败。
- 已存在的本地或远端 tag 一律拒绝复用；不允许重打、覆盖或强推 tag。
- 使用标注 tag（`git tag -a`），tag 指向通过校验的合并提交。

## 5. Release 规则

- `publish` 使用 `gh release create <tag> --verify-tag`；缺少远端 tag 时失败。
- 已有同名 Release 时失败（重复发布被拒绝）；更新说明用 `gh release edit`，属于独立动作。
- 发布说明优先使用 `--notes-file`；未提供时使用 `--generate-notes` 的 GitHub 自动生成说明。
- Release 必须非 draft、非 prerelease 才算发布完成。

## 6. 回滚

| 阶段 | 回滚方式 |
| --- | --- |
| bump 已合并、未打 tag | 再执行一次 `bump --version <上一版本>`，走 push-cli 合并 |
| tag 已推送、未发布 Release | 删除远端 tag（`git push --delete origin <tag>`）与本地 tag，修正后重打 |
| Release 已发布但版本错误 | 先 `gh release delete <tag>` 撤回 Release，再删除 tag，必要时 bump 回退版本后重新发布 |
| 发布后发现问题 | 不回滚历史 tag；新增 patch 版本修复并重新发布 |

## 7. 发布前检查

- `node tools/validate_utf8.mjs`、`node tools/check_readme_sync.mjs`、`node skills/compress-cli/scripts/agents_check.mjs check` 通过。
- `node skills/release-cli/scripts/test_bump_version.mjs` 通过。
- CI 在合并提交上为绿；`push-cli watch` 已确认。
- 显式记录 config / SQL / dependency / rollback / observability 影响；未检查项列入 residual risk。

# 发布流程

本文件是版本发布的操作真值。发布动作由 `release-cli` 执行；本文件说明顺序、
校验门禁、产物与回滚条件。

## 1. 版本格式

- 版本格式固定为 `x.y.z`，不接受预发布后缀或构建元数据。
- Git tag 默认 `v<x.y.z>`；tag 必须指向已合并到默认分支并通过校验的提交。
- 三个版本字段必须一致：backend `pom.xml` `<revision>`、`frontend-vue/package.json`、
  `frontend-react/package.json`。
- 已存在的 tag 与 Release 一律拒绝复用，禁止重打、覆盖或强推。

## 2. 发布前置条件

- 默认分支保护开启，PR 必需检查通过；禁止 `--admin` 绕过。
- `.github/workflows/ci.yml` 在候选提交上为绿。
- `node tools/validate_utf8.mjs`、`node tools/check_readme_sync.mjs`、
  `node tools/check_release_version.mjs` 通过。
- 依赖版本与 lockfile 一致；SQL 基线 `sql/infoq_scaffold_3.0.0.sql` 未被修改。
- 发布说明已准备：变更摘要、兼容性、迁移、已知问题、回滚方式。
- 发布操作者具备 tag 与 Release 权限，且已完成 `gh auth status` 核验。

## 3. 发布流程

```text
bump -> PR -> 合并 -> tag -> Release workflow -> verify
```

### 3.1 版本升级

```bash
node skills/release-cli/scripts/release_cli.mjs plan
node skills/release-cli/scripts/release_cli.mjs bump --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs plan --version 3.0.1
```

`bump` 只同步受管文件，不提交、不推送。受管文件清单见
`skills/release-cli/references/targets.md`。

### 3.2 发布 PR

通过 `push-cli` 创建 PR，禁止直推默认分支：

```bash
node skills/push-cli/scripts/push_cli.mjs check --profile full
node skills/push-cli/scripts/push_cli.mjs submit-pr --message "chore(release): prepare v3.0.1"
```

PR 合并后再执行 tag；不允许在未合并的发布分支上打 tag。

### 3.3 Tag

```bash
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1 --dry-run
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1
```

`tag` 校验 `HEAD == origin/<default>`、版本一致性与 tag 是否已存在。

### 3.4 Release

推送 tag 后，`.github/workflows/release.yml` 自动执行：

1. `node tools/check_release_version.mjs --tag "$GITHUB_REF_NAME"`。
2. 后端单测与 `clean package -P prod`。
3. Vue / React `pnpm install --frozen-lockfile` 与 `pnpm run build:prod`。
4. 上传 `infoq-admin.jar`、`vue-dist.tar.gz`、`react-dist.tar.gz`。
5. 使用 GitHub 自动生成说明创建正式 Release。

如需人工补充说明：

```bash
node skills/release-cli/scripts/release_cli.mjs publish --version 3.0.1 --notes-file tmp/release-notes.md
```

### 3.5 发布后校验

```bash
node skills/release-cli/scripts/release_cli.mjs verify --version 3.0.1
```

校验远端 tag、Release 状态（非 draft、非 prerelease）与版本字段一致。

## 4. 发布说明结构

发布说明至少包含：

- Highlights：本次用户可见变化。
- Changed：行为、配置、部署或依赖变化。
- Compatibility and migration：升级前必须执行的动作。
- Known issues：已知限制与规避方式。
- Upstream baseline：第三方框架或上游基线变化（如适用）。

逐次发布的变化写入 GitHub Release notes，不写回 README。

## 5. 产物

| 产物 | 来源 | 校验 |
| --- | --- | --- |
| `infoq-admin.jar` | `backend/infoq-admin/target/` | 后端单测与 prod 打包通过 |
| `vue-dist.tar.gz` | `frontend-vue/dist/` | Vue 生产构建通过 |
| `react-dist.tar.gz` | `frontend-react/dist/` | React 生产构建通过 |
| 容器镜像 | `deploy/docker/docker-compose.yml` 构建 | 由部署验证单独覆盖，不在 tag workflow 中推送 |

Tag workflow 只发布源码与构建产物；镜像推送与实际部署是独立动作。

## 6. 失败与回滚

| 阶段 | 处理 |
| --- | --- |
| bump 未合并 | 重新 `bump` 到正确版本，走新 PR |
| tag 已推送、Release 未创建 | 删除远端与本地 tag，修正后重打 |
| Release 已创建但版本错误 | `gh release delete <tag>` 撤回 Release，再删除 tag，重新发布 |
| 发布后发现缺陷 | 不回滚历史 tag；发布新的 patch 版本 |
| Release workflow 失败 | 修复 workflow 或版本字段后重新推送新 tag；禁止重推同一 tag |

回滚不得删除已发布的历史 Release 来说明“未发布”；发布状态必须真实可审计。

## 7. 权限与安全

- Release workflow 使用 `contents: write`，仅 `publish` job 需要写权限。
- tag 触发前不得使用仓库 secrets 写入生产环境。
- 发布日志不得打印环境文件、token 或完整 inspect 输出。
- 发布前检查 performance、observability、rollback、config/SQL/dependency impact；
  未检查项列入 residual risk。

## 8. 相关文件

- skill：`skills/release-cli/SKILL.md`
- 受管文件：`skills/release-cli/references/targets.md`
- 发布细则：`skills/release-cli/references/release-flow.md`
- 版本门禁：`tools/check_release_version.mjs`
- CI 覆盖：`docs/CI_VALIDATION.md`

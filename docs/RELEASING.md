# 发布流程

本文件是版本发布的操作真值。发布动作由 `release-cli` 执行；本文件说明顺序、
校验门禁、产物与回滚条件。

## 1. 版本格式

- 版本格式固定为 `x.y.z`，不接受预发布后缀或构建元数据。
- Git tag 默认 `v<x.y.z>`；tag 必须指向已合并到默认分支并通过校验的提交。
- 三个版本字段必须一致：backend `pom.xml` `<revision>`、`frontend-vue/package.json`、
  `frontend-react/package.json`；`README.md`、`README_CN.md`、`README_JA.md`、`README_ZH_TW.md` 的 Version 徽标必须同步。
- `node tools/check_release_version.mjs` 会同时校验这些版本字段、README 徽标与部署文档中的版本引用。
- 版本门禁接受 `--tag v<x.y.z>` 或 `--expect <x.y.z>`，也支持 `--tag=...` / `--expect=...`；同时指定时必须指向同一版本。空值、重复、未知参数及尾部垃圾均失败，不能用空预期绕过检查。
- 已存在的 tag 与 Release 一律拒绝复用，禁止重打、覆盖或强推。

## 2. 发布前置条件

- 默认分支保护开启，PR 必需检查通过；禁止 `--admin` 绕过。
- `.github/workflows/ci.yml` 在候选提交上为绿。
- `node tools/validate_utf8.mjs`、`node tools/check_readme_sync.mjs`、
  `node tools/check_release_version.mjs`、`node tools/check_doc_links.mjs` 通过。
- `node skills/compress-cli/scripts/agents_check.mjs check`、
  `node skills/release-cli/scripts/test_bump_version.mjs`、
  `node skills/release-cli/scripts/test_release_cli.mjs` 与
  `node skills/push-cli/scripts/test_push_cli.mjs` 通过。
- `node tools/test_check_release_version.mjs` 与 `node skills/release-cli/scripts/test_release_assets.mjs` 通过。
- 依赖版本与 lockfile 一致；SQL 基线 `sql/infoq_scaffold_3.0.0.sql` 未被修改。
- 发布说明已准备：变更摘要、兼容性、迁移、已知问题、回滚方式。
- 发布操作者具备 tag 与 Release 权限，且已完成 `gh auth status` 核验。
- 发布前人工确认最新远程版本、候选 SHA 和该 SHA 的 CI 结果；tag CLI 不自动查询 CI 或读取分支保护配置。
- 所有远程写默认预览，显式 `--execute` 才执行；合并还需 `--yes`。`--execute` 与 `--dry-run` 不能同时使用。`bump` 默认修改本地文件，预览需显式 `--dry-run`。
- 选择的 Git remote 必须只有一个 fetch/push URL 且指向同一仓库，gh 请求显式绑定相同 host/owner/repo。内嵌凭据、本地路径、多目标或不支持的 URL 明确失败；`GH_REPO` 不改变该绑定。

## 3. 发布流程

```text
bump -> PR -> 合并 -> tag -> Release workflow -> verify
```

### 3.1 版本升级

```bash
node skills/release-cli/scripts/release_cli.mjs plan
node skills/release-cli/scripts/release_cli.mjs bump --version 3.0.1 --dry-run
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
node skills/push-cli/scripts/push_cli.mjs submit-pr --message "chore(release): prepare v3.0.1" --execute
```

PR 合并后再执行 tag；不允许在未合并的发布分支上打 tag。

### 3.3 Tag

```bash
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1 --execute
```

`tag` 要求工作区干净，校验 `HEAD == origin/<default>`、版本一致性与 tag 是否已存在；`fetch --no-tags` 不自动获取远端 tag。推送显式使用 `refs/tags/<tag>`，同名 branch 不构成歧义。`plan` 无法读取最新 tag 的本地历史时明确失败，先核对目标并获取该 tag 再重试，不把错误当零提交。

### 3.4 Release

推送 tag 后，`.github/workflows/release.yml` 自动执行：

1. `node tools/check_release_version.mjs --tag "$GITHUB_REF_NAME"`。
2. 后端单测与 `clean package -P prod`。
3. Vue / React `pnpm install --frozen-lockfile` 与 `pnpm run build:prod`。
4. 上传 `infoq-admin.jar`、`vue-dist.tar.gz`、`react-dist.tar.gz`。
5. 按 `backend-jar`、`vue-dist`、`react-dist` 下载到 `release-assets/` 下各自同名目录，运行 `node skills/release-cli/scripts/verify_release_assets.mjs release-assets`，要求每个目录仅含对应非空普通文件；缺失、跨 artifact 重名、错误名称、额外、空资产和符号链接失败，避免合并下载覆盖重名文件。
6. 使用精确三文件列表和 GitHub 自动生成说明创建正式 Release。

自动 workflow 是本仓库默认发布路径，不要在 tag 推送后并发运行 `publish`；这会与自动创建 Release 竞争。已发布 Release 补充说明属于独立的 `gh release edit` 写操作，应先审查具体内容并取得对应授权。仅在确认自动发布未运行、确需独立手工发布时，使用以下预览与执行；它不会构建或上传 jar/dist：

```bash
node skills/release-cli/scripts/release_cli.mjs publish --version 3.0.1 --notes-file tmp/release-notes.md
node skills/release-cli/scripts/release_cli.mjs publish --version 3.0.1 --notes-file tmp/release-notes.md --execute
```

### 3.5 发布后校验

```bash
node skills/release-cli/scripts/release_cli.mjs verify --version 3.0.1
```

CLI 校验工作区版本与请求一致、远端 tag 存在及 Release 非 draft/prerelease；不会校验 tag 提交 SHA 或资产完整性。另需核对远端 tag 指向候选提交、Release workflow 成功、资产名称/大小/来源和部署准备条件。出现身份、网络或 API 错误须停止，不能当作“Release 不存在”继续创建。

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
这三项不是完整运行交付包：外部配置、独立生产凭据、IPv6 地址库、SQL 增量、systemd/Nginx 与监控/备份资产按对应部署方式另行准备，见 `deploy/MANUAL.md` 与 `deploy/VERIFICATION.md`。资产检查只证明名称/数量/非空，不证明签名、内容安全或生产可用性。

### 5.1 生产构建配置边界

当前 workflow 未注入 `VITE_APP_RSA_PUBLIC_KEY` / `VITE_APP_RSA_PRIVATE_KEY`，前端构建使用仓库 `.env.production`，其中的密钥是示例值。构建通过及资产发布不能证明这些包可用于生产；在确认独立受控密钥、与后端匹配及 HTTPS 前，生产部署保持阻塞。

受控重新构建时，由密钥管理器或受控 runner 将 `VITE_APP_ENCRYPT=true`、`VITE_APP_RSA_PUBLIC_KEY`、`VITE_APP_RSA_PRIVATE_KEY` 注入实际运行 pnpm 的进程环境，优先于 Vite 的 `.env.production`。两项 RSA 值沿用对应工作区示例的密钥内容格式，使用独立生产值，不在命令行或日志打印。无需改写受管 `.env.production`；也不要把新值提交到仓库。在同一受控终端核验字段存在后构建：

```bash
node -e "for (const key of ['VITE_APP_RSA_PUBLIC_KEY','VITE_APP_RSA_PRIVATE_KEY']) { if (!process.env[key]?.trim()) throw new Error('missing '+key); } if (process.env.VITE_APP_ENCRYPT !== 'true') throw new Error('VITE_APP_ENCRYPT must be true');"
pnpm --dir frontend-vue install --frozen-lockfile
pnpm --dir frontend-react install --frozen-lockfile
node tools/validate_utf8.mjs
pnpm --dir frontend-vue run build:prod
pnpm --dir frontend-react run build:prod
```

上述字段存在检查不证明密钥有效、独立或匹配；部署前仍须按 `deploy/VERIFICATION.md` 验证真实登录、请求/响应加解密与 HTTPS。浏览器包中包含的私钥不能承担服务端秘密保护。受控构建产物需要单独保留候选 SHA、配置来源标识和校验摘要，不覆盖已发布历史资产。

## 6. 失败与回滚

| 阶段 | 处理 |
| --- | --- |
| bump 未合并 | 审查本次受管文件差异，纠正版本或定向恢复本次修改，走修正 PR；不覆盖他人修改 |
| tag 推送失败 | 本地 tag 可能已创建；记录错误与 SHA，确认远端是否接收，禁止盲目重试或覆盖 |
| Release workflow 失败 | 读失败 job 日志与公开发布状态；同一提交的临时环境故障可重跑失败 job，代码/版本变更须经 PR 与新 tag 发布 |
| Release 已公开且存在错误 | 保留历史 tag/Release，补充问题说明并发布修正 patch；不覆盖历史产物 |
| 运行部署后发现缺陷 | 按既有部署方案切回已验证旧产物和匹配配置；数据恢复单独使用备份/迁移回滚方案 |

回滚不得删除已发布的历史 Release 来说明“未发布”；发布状态必须真实可审计。
删除远端 tag/Release 仅适用于已确认无人消费且已枚举影响、得到明确额外授权的独立撤销任务。`bump` 降版本只改文本，不能恢复应用、配置或数据；数据操作见 `docs/DATA-OPS.md`，部署恢复见 `deploy/DEPLOYMENT_LIFECYCLE.md`。

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

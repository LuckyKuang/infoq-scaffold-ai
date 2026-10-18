# 发布流程细则

## 1. 状态机

```text
PR 合并到默认分支
        |
        v
release_cli plan  ──(版本 <= 最新 tag)──> bump --version x.y.z ──> push-cli submit-pr --execute ──> 合并
        |                                                                                      |
   (版本已最新)                                                                                v
        |<------------------------------------------------------------------------------- tag --version x.y.z --execute
        v
Release workflow 自动构建、上传产物、发布（不并发手动 publish）
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
| README 徽标 | `README.md` / `README_CN.md` / `README_JA.md` / `README_ZH_TW.md` 版本徽标 |
| deploy 基线 | `deploy/DOCKER.md`「当前文档对应项目基线版本」 |
| 环境模板版本 | `deploy/.env.example` 的 `INFOQ_VERSION` |
| Docker 镜像 tag | `deploy/docker/docker-compose.yml` |
| SpringDoc 断言 | `infoq-plugin-doc` 下 `SpringDocConfigTest` / `SpringDocPropertiesTest` |
| DEPLOY_ID 示例 | `application*.yml` 注释、`QuartzManagedProperties`、`QuartzBootstrapCoordinatorTest`；手动部署及 systemd 的实际批次值由环境注入，不属版本同步目标 |

三个版本字段（backend / react / vue）必须一致，否则 `plan`、`tag`、`verify` 全部失败。`publish` 仅检查远端 tag 与 Release 是否存在，不执行这项版本检查；人工发布前仍必须运行版本门禁。

## 3. 版本不是最新时的处理

- `plan` 会把 `当前版本 <= 最新远程 tag` 视为「需要先 bump」，并显式失败，同时给出建议版本（默认 patch +1，可用 `--version` 指定）。
- 若最新远程 tag 尚未获取到本地，提交清单查询显式失败；核对目标后用 `git fetch <remote> tag <tag>` 获取所需历史再重试，不能把查询失败解释成零提交。
- `bump` 默认写入，只负责同步受管文件；先用 `bump --version x.y.z --dry-run` 预览清单，提交与推送走 `push-cli`（禁止手工直推默认分支），合并后再回到 `tag`。
- 禁止在版本落后的情况下发布：`publish` 会校验远端 tag 存在，`verify` 会校验版本字段与 tag 一致。

## 4. tag 规则

- 默认 tag 名 `v<x.y.z>`，可用 `--tag` 覆盖。
- 必须在 `HEAD == origin/<default>` 时创建（即 PR 已合并且本地已拉取）；否则失败。
- 工作区必须干净，避免读取未提交的新版本却给旧 HEAD 打 tag。`--remote` 指定配置的 remote 名称时，gh 同样显式绑定该 remote 的 host/owner/repo；唯一 fetch/push URL 不一致或存在多个 URL 时失败。
- 已存在的本地或远端 tag 一律拒绝复用；不允许重打、覆盖或强推 tag。
- 使用标注 tag（`git tag -a`），tag 指向通过校验的合并提交。
- `tag --version x.y.z` 与显式 `--dry-run` 都只预览，使用 `fetch --no-tags` 更新本地跟踪引用且不获取远端 tag；只有 `--execute` 才创建本地 tag 并按精确 `refs/tags/<tag>` 推送。tag CLI 不查询 CI 或保证版本大于所有历史 tag，必须先运行 `plan` 并核对候选提交的 CI。
- tag 推送失败时本地 tag 可能已经创建；记录 SHA 和错误，先确认远端是否实际接收，不循环重试创建或覆盖已有 tag。

## 5. Release 规则

- 当前默认路径由 `.github/workflows/release.yml` 在 tag 推送后发布，不再运行手工 `publish`，避免竞争与重复发布。
- workflow 按 `backend-jar`、`vue-dist`、`react-dist` 下载到独立同名目录，再执行 `verify_release_assets.mjs`，要求每个目录只含对应非空普通文件，禁止跨 artifact 重名、额外和错误名称，拒绝符号链接；仅把精确文件列表交给发布 action，避免合并下载覆盖掩盖重复资产。
- 独立手工发布场景的 `publish` 使用 `gh release create <tag> --verify-tag`；缺少远端 tag 时失败。默认只预览，显式 `--execute` 才写入；它不打包、不上传构建产物，也不等待自动 workflow。
- 已有同名 Release 时失败（重复发布被拒绝）；更新说明用 `gh release edit`，属于独立动作。
- 发布说明优先使用 `--notes-file`；未提供时 CLI 向 gh 传入 `--generate-notes`。`--generate-notes` 不是 release-cli 自身参数。
- Release 必须非 draft、非 prerelease 才算发布完成。

## 6. 回滚

| 阶段 | 回滚方式 |
| --- | --- |
| bump 未提交 | 先审查本次文件修改，定向恢复本次变更或纠正目标版本；不覆盖其他修改 |
| bump 已合并、未打 tag | 通过修正 PR 处理错误；是否 revert 取决于受管文件与其他变更，不能用降版本代表应用或数据恢复 |
| tag 已推送、workflow 失败 | 先读失败 job 与日志，确认是否已有公开 Release；同一提交的临时环境故障可重跑失败 job，代码或版本错误通过新提交与新 tag 修复 |
| Release 已发布但错误 | 保留历史 tag/Release 及说明，标注已知问题并发布修正 patch；已发布产物不重打或覆盖 |
| 运行部署发现问题 | 停止继续发布，使用事先验证的旧产物和配置回滚；SQL/数据恢复独立按 `docs/DATA-OPS.md` 和备份方案处理 |

删除远端 tag/Release 只适用于已明确确认未被公开消费、枚举影响并获额外授权的撤销任务，不是本技能默认恢复动作。`bump` 只改版本文本，不恢复应用、配置、数据库或发布历史。

## 7. 发布前检查

- `node tools/validate_utf8.mjs`、`node tools/check_readme_sync.mjs`、`node tools/check_release_version.mjs`、`node tools/check_doc_links.mjs`、`node skills/compress-cli/scripts/agents_check.mjs check` 通过。
- `node skills/release-cli/scripts/test_bump_version.mjs` 通过。
- `node skills/release-cli/scripts/test_release_cli.mjs` 与 `node skills/push-cli/scripts/test_push_cli.mjs` 通过。
- CI 在合并提交上为绿；`push-cli watch` 已确认。
- 显式记录 config / SQL / dependency / rollback / observability 影响；未检查项列入 residual risk。

## 8. 隔离回归 SOP

触发条件：修改发布参数、默认执行模式、tag/Release 门禁、受管版本清单或 SQL 基线检查。

1. 运行 `node skills/release-cli/scripts/test_release_cli.mjs`。fixture 位于 `tmp/documentation-reaudit/release-cli-*/`；真实 Git 传输只访问隔离仓库和本地 bare origin，目标 URL 查询与 gh 由预加载替身接管，不调用真实凭据或公网。
2. 对比默认/显式预览的调用记录与 Git tag 状态，确认即使远端有本地尚无的 tag，预览仍不创建 tag 或远程写；dirty、目标不一致、重复 tag/Release、版本不一致、缺失远端 tag、鉴权错误与不适用/冲突参数须失败。验证同名 branch 不影响精确 tag 推送。
3. 运行 `node skills/release-cli/scripts/test_bump_version.mjs`，在 `tmp/documentation-reaudit/release-cli/` 复制文件上验证 dry-run 零改动、实际版本同步（含环境模板并通过真实版本门禁）、DEPLOY_ID 示例和冻结 SQL 内容不变，以及替换预检失败时所有文件零改动。真实工作区版本不可变。
4. 执行修改脚本的 `node --check <path>`、`node tools/validate_utf8.mjs skills/release-cli` 和 `git diff --check`，审查 fixture 的 `runs.log`、`calls.jsonl` 与 bump 日志。

禁止对真实远程试推 tag、删除公开 Release 后声称未发布、仅匹配源码证明安全、以降版本代替部署/数据回滚。回归通过不代表 GitHub Actions、跨平台 Git 或生产恢复演练已完成。

### 资产与版本门禁回归

触发条件：修改 workflow 资产集合、资产校验器或版本门禁参数。执行 `node skills/release-cli/scripts/test_release_assets.mjs` 与 `node tools/test_check_release_version.mjs`，前者验证独立 artifact 完整集合通过，逐件缺失/空文件/非普通文件、跨 artifact 重名、错误名称和额外资产失败，并在非 Windows 平台验证符号链接拒绝；后者在副本上验证13版本来源、一致预期、空值、未知/重复/尾部垃圾和双预期冲突，以及版本来源漂移。证据都在 `tmp/documentation-reaudit/`。不能用通配符匹配到部分资产、合并下载覆盖重名文件或忽略空预期值代替完整成功。

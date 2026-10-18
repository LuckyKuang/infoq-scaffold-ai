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
3. Vue / React 在受保护 `production-build` environment 获取 `FRONTEND_PRODUCTION_CONFIG`，按 5.1 的四向 RSA 规则预检后执行 `pnpm install --frozen-lockfile` 与 `pnpm run build:prod`。缺少受控输入直接失败。
4. `node tools/production_config.mjs check-artifact --dir <workspace>/dist` 检查实际协议密钥、指纹、无服务端私钥/仓库示例、可发布来源，再上传 `infoq-admin.jar`、`vue-dist.tar.gz`、`react-dist.tar.gz`；`always()` 清理 runner 内的受控配置。
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

生产 `vite build --mode production` 现在默认严格：仓库 `.env.production` 只保存公共构建设置，两项 RSA 值留空。构建从绝对路径 `INFOQ_PRODUCTION_CONFIG_FILE` 读取权限仅限所有者的普通 UTF-8 dotenv 文件；受控 runner 也可显式声明 `INFOQ_CONFIG_SOURCE=managed-environment` 并通过进程环境提供输入。文件按数据解析，不执行 shell；不在命令行、日志或仓库提交中出现秘密。

必需输入为 `VITE_APP_ENCRYPT=true` 及两组独立 RSA，全部至少 2048 位，仅接受单行 Base64 DER（public SPKI/private PKCS8），拒绝 PEM、字面转义或多行值，确保 Node 预检、浏览器 JSEncrypt 与后端使用同一格式：

| 方向 | 浏览器构建输入 | 后端输入 |
| --- | --- | --- |
| 请求加密/解密 | `VITE_APP_RSA_PUBLIC_KEY` | `INFOQ_API_REQUEST_PRIVATE_KEY` |
| 响应加密/解密 | `VITE_APP_RSA_PRIVATE_KEY` | `INFOQ_API_RESPONSE_PUBLIC_KEY` |

前端公钥与前端私钥属于两组不同的配对；复用一组会把服务端请求私钥放入浏览器，所以明确拒绝。构建器只将前端两项注入 Vite，后端私钥仅用于内存中的配对核验。Docker 从仓库根 context 构建，使用 `--secret id=production_config,src=<受控绝对路径>`；不使用普通 ARG/ENV 传秘密，最终 nginx 镜像只复制 `dist/`。Compose 通过同名 build secret 接线。BuildKit 不因 secret 内容变化自动清除缓存，部署 helper 会为每次构建自动计算非秘密 `INFOQ_FRONTEND_CONFIG_DIGEST` build ARG 并复核构建后输入；直接 Docker/Compose 排障也必须按 [deploy/DOCKER.md](../deploy/DOCKER.md#11-直接使用-docker-compose-cli) 的命令即时计算，不手工保存或复用旧摘要。

Release workflow 的 `package-admin` 使用 GitHub environment **`production-build`**，必须预先配置保护规则、受信任的 tag/审批条件与该 environment 的 **`FRONTEND_PRODUCTION_CONFIG` secret**（内容为上述受控 dotenv，而非文件路径）。只有 `VITE_APP_ENCRYPT` 与四项 RSA 就能进行前端预检；可附 `INFOQ_CONFIG_SOURCE=controlled-file`，不能标记为 `isolated-test`。维护者需单独确认来源、轮换及与目标后端匹配；工具不能从文件格式证明密钥管理器配置正确。不要把目标环境服务端私钥交给不可信 PR runner。

受控本地重新构建示例（文件已由密钥管理器准备，不在命令中填秘密）：

```bash
export INFOQ_PRODUCTION_CONFIG_FILE=/controlled/infoq/production-build.env
node tools/production_config.mjs check --scope frontend
node tools/validate_utf8.mjs
pnpm --dir frontend-vue run build:prod
node tools/production_config.mjs check-artifact --dir frontend-vue/dist
pnpm --dir frontend-react run build:prod
node tools/production_config.mjs check-artifact --dir frontend-react/dist
```

`dist/production-build.json` 只记录 context path、来源标识、两项公钥指纹和浏览器配置摘要，不记录密钥。摘要只取浏览器输入与来源标识，不含时间、文件位置、后端请求私钥或密码；路径/API/端口独立通过 Docker ARG 参与缓存。产物检查还扫描实际包中的前端密钥、已知示例片段与服务端请求私钥，拒绝符号链接、超限/缺入口和指纹不符。静态扫描不能替代真实登录、HTTPS 与加解密验证；浏览器内响应私钥始终是可公开的协议材料，不能承担服务端秘密保护。

#### 隔离构建回归 SOP

触发条件：生产预检、前端 Dockerfile/Vite、RSA/env 或 Release 输入变更。先生成本轮新输入，再主流程预检、定向测试、实际 build 和产物检查：

```bash
node tools/production_fixture.mjs --output-dir tmp/production-readiness/build-example
# 使用生成器返回的绝对 configFile 路径；不要打印其内容。
export INFOQ_PRODUCTION_CONFIG_FILE="$PWD/tmp/production-readiness/build-example/production.env"
node tools/production_config.mjs check --scope deploy
node tools/test_production_config.mjs
node tools/test_production_crypto.mjs
node tools/test_frontend_build_cache.mjs
VITE_APP_CONTEXT_PATH=/react/ pnpm --dir frontend-react run build:prod
node tools/production_config.mjs check-artifact --dir frontend-react/dist --allow-isolated
VITE_APP_CONTEXT_PATH=/vue/ pnpm --dir frontend-vue run build:prod
node tools/production_config.mjs check-artifact --dir frontend-vue/dist --allow-isolated
```

`test_production_crypto.mjs` 需要两工作区已安装依赖，使用各自实际 JSEncrypt 对两方向做加解密；可用 `--client react|vue` 定向，不替代后端 Hutool 测试。生成器要求 `openssl`，仅写仓库 `tmp/` 下全新目录，生成随机独立凭据、两组 2048 位 RSA 和双域自签证书，拒绝覆盖；不是生产配置生成器。fixture 保持严格加密与四向核验，`production-build.json` 明确 `deployable=false`。只有回归可用 `--allow-isolated`；Release 从不传该参数。禁止以关闭加密、恢复示例密钥、伪造来源标识或删除失败检查通过门禁。Docker builder/镜像层检查仍需在 Linux Docker 实机执行，模拟 COPY 路径仅证明源码依赖闭合。证据保存在 `tmp/production-readiness/build/`，自签证书和测试产物不发布。

`test_frontend_build_cache.mjs` 仅依赖 Node 与 Bash，验证稳定摘要、双方向轮换、挂载输入与摘要匹配，以及真实部署函数在旧摘要、构建失败和途中轮换时的行为；命令替身不证明真实 BuildKit 缓存。Dockerfile/受控输入链路变更后，在隔离 Linux Docker 中保持缓存依次构建密钥 A/B，检查新包指纹和实际密钥片段变为 B、A 与服务端私钥片段均不存在，再以同一 B 构建确认缓存可复用；不要用 `--no-cache` 掩盖失效缺陷，也不要把缓存命中本身当作配置正确证据。

生产安装器默认要求现成受控 `INFOQ_ENV_FILE`，包含 TLS、四向 RSA、独立凭据及 `INFOQ_PRODUCTION_CONFIG_FILE` 指向同一文件；缺失在网络下载/daemon/宿主写入前拒绝。`curl | bash` 首次 bootstrap 尚无仓库校验工具，只在私有临时 staging 下载源码后立即完整预检，随后才复制安装源码并检测 daemon；该 staging 是明确的引导副作用。本地源码调用可在全部安装动作前完整校验。`INFOQ_DEPLOY_MODE=development` 才允许安装器生成本地随机配置，Apple 入口也仅支持该显式隔离模式。所有凭据只写 0600 受控文件，不输出日志。远程 bootstrap 仅自动替换带 `.infoq-installer-owned`（内容 `infoq-scaffold-ai`）的安装源码；无标记旧目录先备份并使用明确的空安装目录，或显式选择已有本地源码，不能为重装删除未知内容。

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

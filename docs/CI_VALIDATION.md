# CI 验证覆盖

本文件说明仓库当前的 CI 工作流、覆盖范围、本地等价命令与发布门禁。工作流文件是
执行真值；本文件只描述约定与维护边界。

## 1. 工作流

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push / PR / 手动 | UTF-8、README 同步、版本一致性、文档链接、后端构建与单测、双管理端 lint/test/build |
| `.github/workflows/linux-docker-acceptance.yml` | 手动 | 全新 owned project 的真实受控构建、TLS/鉴权/浏览器/私有对象、备份恢复、应用回滚与清理 |
| `.github/workflows/security-scan.yml` | push `master`/`main` / PR / 每周 / 手动 | CodeQL（Java、JavaScript/TypeScript）与依赖审查 |
| `.github/workflows/release.yml` | `v*` tag | 版本门禁、后端验证；RC 源码预览 / 正式双管理端受控产物与 GitHub Release |

## 2. 维护检查

`ci.yml` 的 `repository-gates` job 是所有构建 job 的前置门禁：

- `node tools/validate_utf8.mjs`
- `node tools/check_readme_sync.mjs`
- `node tools/check_release_version.mjs`
- `node tools/check_doc_links.mjs`

后端 job：

```bash
node tools/backend_mvn.mjs -- -B -ntp -DskipTests=false clean package -P dev
node tools/backend_mvn.mjs -- -B -ntp -DskipTests=false clean package -P prod
```

Surefire groups 跟随 Maven profile：`dev` 执行完整业务单测，`prod` 执行真实生产过滤配置的日志回归。两轮必须分别通过，不能把 `prod` 组的配置测试当作完整业务测试；精确安全/Push logger 的 INFO 须在真实 Logback 中有效，其余业务仍保持 WARN。测试日志统一写入 `tmp/`。

CI 与 Release 的 backend job 在 JDK 21 setup 后运行 `node tools/setup_ci_maven.mjs`，从 Apache Maven Central 下载固定 Maven `3.9.12` 并核验仓库内固定 SHA-512；解压产物只放在 `tmp/ci-maven/`，实际执行版本验证成功后才写入 Actions 的 `GITHUB_ENV`/`GITHUB_PATH`。任何网络、校验、解压、权限或版本错误均阻止后续构建，不使用 runner 浮动默认 Maven；`backend_mvn.mjs` 的 Maven 3.9.x 检查保持有效。安全扫描 `build-mode: none` 不运行 Maven，故无需安装。

修改 Maven 安装入口或工作流构建环境时，先运行 `node tools/test_setup_ci_maven.mjs`：真实固定发行包安装与版本探测必须通过，HTTP/网络/坏 SHA-512/损坏归档/缺失或不可执行命令/错版本须失败且不写入环境文件。测试依赖 Maven Central 下载能力与本机可用 Java，证据写入 `tmp/ci-maven-tests/`；缺失依赖须明确报告，不能放宽版本或哈希校验。Repository Gates 执行该回归，实际 backend job 还使用仓库 runner dry-run 记录选中的 JDK/Maven。

双管理端矩阵：

| 工作区 | 检查 |
| --- | --- |
| `frontend-vue` | `pnpm run test:unit`、`pnpm run lint:eslint`、`pnpm run build:prod` |
| `frontend-react` | `pnpm run test`、`pnpm run lint`、`pnpm run build:prod` |

依赖安装统一 `pnpm install --frozen-lockfile`，Node 由 `.node-version` 固定为
`24.18.0`，pnpm 由根 `package.json` 的 `packageManager` 固定为 `10.34.1`；
CI 通过 `pnpm/action-setup` 的 `package_json_file` 直接读取该字段。

`admin-frontend` 先运行 `tools/production_fixture.mjs` 生成独立临时 RSA/随机凭据/自签证书，通过 `INFOQ_PRODUCTION_CONFIG_FILE` 接入严格构建；安装依赖后以 `test_production_crypto.mjs --client react|vue` 验证实际 JSEncrypt 与 Node 两组 RSA 的协议互通。完成构建后运行 `production_config.mjs check-artifact --allow-isolated` 检查产物实际包含的前端密钥、配对指纹和服务端秘密缺失。这些产物为 `deployable=false` 的隔离构建，不能发布为生产资产。正式 Release 独立使用受控 environment/secret，不能复用 CI fixture；RC 不构建公开前端产物，仅发布源码。

## 3. 本地等价入口

| CI 覆盖 | 本地命令 |
| --- | --- |
| UTF-8 | `node tools/validate_utf8.mjs` |
| README 结构 | `node tools/check_readme_sync.mjs` |
| 版本一致性 | `node tools/check_release_version.mjs` |
| 文档链接 | `node tools/check_doc_links.mjs` |
| 后端构建与单测 | 依次运行 `node tools/backend_mvn.mjs -- -B -ntp -DskipTests=false clean package -P dev` 与同命令的 `-P prod` |
| Vue | `pnpm --dir frontend-vue run test:unit && pnpm --dir frontend-vue run lint:eslint && pnpm --dir frontend-vue run build:prod` |
| React | `pnpm --dir frontend-react run test && pnpm --dir frontend-react run lint && pnpm --dir frontend-react run build:prod` |

`Makefile` 的 `test-docs` 覆盖上表的 UTF-8、README、版本与文档链接检查；`test-backend` 只跑单测，不包含 CI 的 clean/package，`test-vue`、`test-react` 覆盖各端 lint/test/build。本地 production build 同样必须设置 `INFOQ_PRODUCTION_CONFIG_FILE`；上述裸 build 命令缺受控输入时明确失败。常规 PR CI 不执行部署，手动 Linux workflow 执行隔离实机验收。

## 4. 平台覆盖

- `node-cli-platforms` 在 `ubuntu-latest`、`macos-latest`、`windows-latest` 运行 `test_production_ops.mjs` 与 `test_linux_acceptance.mjs`：验证跨平台参数/编排/文件边界与实际回环 HTTP；Docker/S3 使用明确 fixture。POSIX job 另跑 `node tools/test_production_config.mjs`；macOS 显式使用 `/bin/bash` 并验证 3.2 基线，真实执行隔离安装/RSA/受控配置加载和失败完成标记，不只做语法检查。证据记录实际 shell 版本；该最小闭环不启动 Docker daemon 或真实业务栈。
- Windows job 额外显式使用 `shell: powershell` 并断言 major=5，执行 Node help/preview。只有实际远程该 job 通过才有原生 PowerShell 5.1 证据；WSL 不替代原生 Windows。
- Shell/容器生命周期只在支持的 POSIX 平台运行；矩阵不启动 Apple/WSL/Windows Docker，也不宣称覆盖其真实部署。
- `Linux Docker Isolated Acceptance` 只在手动 job 调用 `node tools/verify/linux_acceptance.mjs --run-id ci-<run> --execute`，具体检查和输入见 [生产运维](PRODUCTION-OPS.md)。完整性/cleanup state 不通过则 job 失败。
- 该 runner 将 MySQL/Redis/MinIO 数据目录转换为 owned named volumes；UID/GID 写入检查不覆盖生产 bind mount 新空目录初始化。独立入口 `tools/verify/first_install_acceptance.mjs` 已在 Colima 原生 ext4 完成真实 `install.sh`、bind 权限/读写与重启持久性验收；目标生产文件系统仍须复验，不能因 named volume workflow 通过而关闭。
- 2026-10-18 已在本机 Colima Ubuntu VM 内执行同源 runner，通过真实 Docker 整栈与四种前端产物的浏览器验证，并核验 owned 清理。手动 Linux Docker workflow 尚未在 GitHub 执行；Colima 证据与 PR 的三平台 CLI 矩阵须分别核对。认证协议变更后还必须用新产物重新验证浏览器会话，旧整栈结果不能替代。

版本发布工具回归由 Repository Gates 执行：`test_release_cli.mjs`、`test_bump_version.mjs`、`test_check_release_version.mjs`、`test_release_assets.mjs`、`test_release_policy.mjs`。Node CLI 三平台矩阵还实际运行 `test_release_cli.mjs`。本地 `push-cli check --profile ci|full` 同步包含发布检查；它不能替代远端三平台运行和安全扫描。

## 5. 发布门禁

tag workflow 复用与 CI 相同的版本门禁，并额外要求：

- `node tools/check_release_version.mjs --tag "$GITHUB_REF_NAME"` 通过。
- 后端先以 `-P dev` 完整执行业务单测，再以 `-P prod` 验证生产配置并打包；两轮均不得跳过或伪称测试覆盖。
- 正式版双管理端以 `--frozen-lockfile` 完成受控生产构建；RC 跳过 package-admin 与编译资产上传/下载，不读取生产 secret。
- 发布门禁按已验证 tag 判断：verify success 且 RC/package-admin skipped，或 verify success 且正式/package-admin success；任何失败或取消都不创建 Release。RC 为非 draft、prerelease、non-latest，公开资产必须为空。
- 正式版 publish job 按 `backend-jar`、`vue-dist`、`react-dist` 下载到各自独立目录，`verify_release_assets.mjs` 要求每个目录仅有对应的 `infoq-admin.jar`、`vue-dist.tar.gz`、`react-dist.tar.gz` 非空普通文件，再把精确列表交给发布 action；缺失、跨 artifact 重名、错误名称、额外、空文件和符号链接阻止发布，避免下载合并覆盖掩盖重复资产。隔离回归：`node skills/release-cli/scripts/test_release_assets.mjs`。
- 版本门禁拒绝空值、尾部垃圾、重复参数和冲突的 `--tag`/`--expect`；隔离回归：`node tools/test_check_release_version.mjs`。

Release 创建前使用 `publish --dry-run` 拒绝已有 Release，避免重跑覆盖；创建后自动执行 `release_cli verify` 读取实际 tag SHA、渠道、Latest 与资产元数据，失败保留已公开历史。

CI 不负责创建 tag、推送镜像或执行生产部署。
发布 tag 由 `release-cli tag --version <version>`（`x.y.z` 或 `x.y.z-rcN`） 默认预览，显式 `--execute` 才创建并推送；推送后自动 workflow 负责 Release，不能并发手工 `publish`。正式版 Release 使用 `production-build` environment 和 `FRONTEND_PRODUCTION_CONFIG` 受控来源，缺配置明确失败；现有 `.env.production` 示例密钥不能用于生产发布。来源批准/轮换和目标匹配仍需环境验收，见 `docs/RELEASING.md` 第 5.1 节。

## 6. 安全扫描

- CodeQL Java/Kotlin 使用 `build-mode: none`，避免在扫描中重复 Maven 构建。
- CodeQL JavaScript/TypeScript 覆盖两个管理端源码。
- Dependency Review 只在 PR 上运行，`high` 及以上严重度阻断。
- Dependency Review 要求仓库启用 Dependency Graph；本仓库已开启图谱与 Dependabot alerts，自动安全升级 PR 未开启。实际 compare/job 失败仍按失败处理，不用配置开关代替运行证据。
- Security Scan 默认只读 `contents`，仅两个 CodeQL job 获得 `security-events: write` 与 `actions: read`；Dependency Review 不继承写权限。
- 安全扫描失败按真实失败处理，不得通过关闭 job 或降低严重度阈值绕过。
- 1024 位 RSA 专用于验证生产预检必须拒绝弱密钥的 Node/Java 负例；保留生成与拒绝断言。对 `tools/test_production_config.mjs` 和 `ProductionApiKeyValidatorTest.java` 的两条对应告警已逐条按 `used in tests` 分类，证据保留在本地 `tmp/`。不得由此排除整个测试目录或关闭查询；后续告警须重新核对实际数据流。
- `.github/dependabot.yml` 每周检查 GitHub Actions、`backend` Maven 和两个管理端 npm/pnpm；Actions 更新分组，其他生态的 open PR 上限各为 5。它不覆盖 Docker 镜像、工具安装器或根目录开发依赖，不能当作完整供应链审计。升级 PR 仍须遵守固定 Node/pnpm 基线并通过 lockfile 与相应检查。

## 7. 失败处理

- 失败即阻断；不得通过削弱断言、放宽 mock、压警告或提高阈值让 job 变绿。
- 首次新增工作流或修改 action 版本后，必须观察一次真实运行结果。
- 工作流权限遵循最小化原则：普通 CI 只读；Release 仅在发布 job 写 `contents`。
- 工作流是远端执行真值；若本地等价矩阵不一致，先定位实际差异，再同步两侧，不能以本地成功覆盖远端失败。
- `push-cli` 的 `docs/full` 额外检查 agents 与 active OpenSpec，`ci` 对齐本文件 CI 检查内容；本地执行前需自行安装依赖并提供正确构建环境，不包含 runner 初始化。

## 8. 残余风险

- 已观察真实 PR CI/安全扫描：发现 runner Maven 浮动版本、macOS Bash 3.2 heredoc、Dependency Graph 未启用及 CodeQL 提示。修复须在新候选 SHA 重新完成全部 job 和 CodeQL aggregate 核验，单个语言扫描 job 成功不表示没有告警。
- Apple container、WSL2 Docker 的真实差异由部署验证覆盖；Linux Docker 有手动隔离 workflow，新增不代表已运行通过。
- 发布 workflow 不推送容器镜像；镜像发布与生产部署必须单独授权。
- 合并须满足默认分支保护要求的至少 1 位有权限的独立审阅者批准；存在适用 CODEOWNERS 时还须满足 owner 审阅规则，不得用管理员权限绕过。本地通过或已启用安全配置均不代替当前 SHA 的远端结果。完整生产可信证书/秘密、Provider、告警接收和容量/RTO/RPO另需目标环境证据。

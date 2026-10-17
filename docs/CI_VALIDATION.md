# CI 验证覆盖

本文件说明仓库当前的 CI 工作流、覆盖范围、本地等价命令与发布门禁。工作流文件是
执行真值；本文件只描述约定与维护边界。

## 1. 工作流

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push / PR / 手动 | UTF-8、README 同步、版本一致性、后端构建与单测、双管理端 lint/test/build |
| `.github/workflows/security-scan.yml` | push 默认分支 / PR / 每周 | CodeQL（Java、JavaScript/TypeScript）与依赖审查 |
| `.github/workflows/release.yml` | `v*` tag | 版本门禁、后端与双管理端产物、GitHub Release |

## 2. 维护检查

`ci.yml` 的 `encoding` job 是所有构建 job 的前置门禁：

- `node tools/validate_utf8.mjs`
- `node tools/check_readme_sync.mjs`
- `node tools/check_release_version.mjs`

后端 job：

```bash
node tools/backend_mvn.mjs -- -B -ntp -DskipTests=false clean package -P dev
```

双管理端矩阵：

| 工作区 | 检查 |
| --- | --- |
| `frontend-vue` | `pnpm run test:unit`、`pnpm run lint:eslint`、`pnpm run build:prod` |
| `frontend-react` | `pnpm run test`、`pnpm run lint`、`pnpm run build:prod` |

依赖安装统一 `pnpm install --frozen-lockfile`，Node 由 `.node-version` 固定为
`24.18.0`，pnpm 由 `PNPM_VERSION` 与各工作区 `packageManager` 固定为 `10.34.1`。

## 3. 本地等价入口

| CI 覆盖 | 本地命令 |
| --- | --- |
| UTF-8 | `node tools/validate_utf8.mjs` |
| README 结构 | `node tools/check_readme_sync.mjs` |
| 版本一致性 | `node tools/check_release_version.mjs` |
| 后端单测 | `node tools/backend_mvn.mjs -- -DskipTests=false test` |
| Vue | `pnpm --dir frontend-vue run lint:eslint && pnpm --dir frontend-vue run test:unit && pnpm --dir frontend-vue run build:prod` |
| React | `pnpm --dir frontend-react run lint && pnpm --dir frontend-react run test && pnpm --dir frontend-react run build:prod` |
| 部署 smoke | `node skills/deploy-cli/scripts/deploy_cli.mjs smoke` |

`Makefile` 的 `test-docs`、`test-backend`、`test-vue`、`test-react` 与上表一一对应。

## 4. 平台覆盖

- GitHub Actions 运行在 `ubuntu-latest`；CI 不覆盖 macOS Apple container。
- 本机 macOS 验证走 `deploy-cli` 的 Apple 路径；Windows 验证在 WSL2 内运行，
  Linux 使用 Docker。
- 容器运行时验证不属于 PR 必需检查；发布前按 `deploy/VERIFICATION.md` 与
  `deploy/DEPLOYMENT_LIFECYCLE.md` 单独执行。

## 5. 发布门禁

tag workflow 复用与 CI 相同的版本门禁，并额外要求：

- `node tools/check_release_version.mjs --tag "$GITHUB_REF_NAME"` 通过。
- 后端以 `-P prod` 完成单测与打包。
- 双管理端以 `--frozen-lockfile` 完成生产构建。
- Release 只在全部上游 job 成功后创建。

CI 不负责创建 tag、推送镜像或执行生产部署。

## 6. 安全扫描

- CodeQL Java/Kotlin 使用 `build-mode: none`，避免在扫描中重复 Maven 构建。
- CodeQL JavaScript/TypeScript 覆盖两个管理端源码。
- Dependency Review 只在 PR 上运行，`high` 及以上严重度阻断。
- 安全扫描失败按真实失败处理，不得通过关闭 job 或降低严重度阈值绕过。

## 7. 失败处理

- 失败即阻断；不得通过削弱断言、放宽 mock、压警告或提高阈值让 job 变绿。
- 首次新增工作流或修改 action 版本后，必须观察一次真实运行结果。
- 工作流权限遵循最小化原则：普通 CI 只读；Release 仅在发布 job 写 `contents`。
- 若工作流与本地脚本不一致，以可复跑的本地脚本为真值，并同步修正工作流。

## 8. 残余风险

- CodeQL `build-mode: none` 与 Dependency Review 的首次远端运行结果需在推送后确认。
- Apple container、WSL2 Docker、Linux Docker 的差异由部署验证覆盖，不在 GitHub
  Actions 中矩阵化。
- 发布 workflow 不推送容器镜像；镜像发布与生产部署必须单独授权。

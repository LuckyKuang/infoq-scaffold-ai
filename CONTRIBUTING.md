# 贡献指南

感谢您对 InfoQ-Scaffold-AI 项目的贡献。本指南提供了工具链、验证流程和提交规范。仓库强制性规则见 [`AGENTS.md`](AGENTS.md)。

## 工具链

使用仓库声明的版本：

- **JDK**: `infoq-scaffold-backend/pom.xml` 中的 `java.version`
- **Maven**: 3.9+
- **Node.js 和 pnpm**: `package.json` 中的 `engines`
- **前端固定**: Node.js `24.18.0`（见 `.node-version` 和 `.nvmrc`）

前端依赖仅使用 pnpm 安装，并在变更时同步 `pnpm-lock.yaml`。后端依赖变更需同步 `go.mod` 和 `go.sum`。

## 开发验证

所有验证（测试、lint、构建、策略检查）必须使用仓库定义的工具和脚本。不要在宿主机直接运行测试或构建。

### 后端验证

```bash
# Maven 包装器
node .codex/scripts/backend_mvn.mjs -- clean install

# 单元测试（控制在 60 秒内）
node .codex/scripts/backend_mvn.mjs -- test

# 特定模块
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am test
```

### Vue 管理端验证

```bash
pnpm --dir infoq-scaffold-frontend-vue run lint
pnpm --dir infoq-scaffold-frontend-vue run test:unit
pnpm --dir infoq-scaffold-frontend-vue run build:prod
```

### React 管理端验证

```bash
pnpm --dir infoq-scaffold-frontend-react run lint
pnpm --dir infoq-scaffold-frontend-react run test
pnpm --dir infoq-scaffold-frontend-react run build:prod
```

### 编码校验

```bash
node .codex/scripts/validate_utf8.mjs
```

## 开发检查列表

边界改动、依赖升级和上游合并需要完整验证矩阵。核心验证包括：

- **后端**: 单元测试、集成测试、登录流程验证
- **前端**: lint、typecheck、单元测试、构建产物
- **跨工作区**: E2E 测试、浏览器自动化验证

使用 `infoq-backend-verify`、`infoq-frontend-verify` 和 `infoq-admin-e2e` skill 执行验证。

## 数据库变更

现有 SQL 迁移脚本不可变。所有新增、修改、删除表结构或初始化数据的变更，只能新增 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本承载。

- `sql/infoq_scaffold_3.0.0.sql` 是冻结初始化基线
- 不要修改已发布的基线或增量脚本
- 使用唯一递增的日期前缀

详见 [`AGENTS.md`](AGENTS.md) 的 SQL Migration Policy。

## 文档和国际化

- 英文和中文 README 保持核心 section IDs 对齐
- 详细操作内容放在 `doc/` 或 `deploy/` 下
- 前端 locale keys 保持英文和中文对齐
- 配置变更需更新 `deploy/` 示例文件

## OpenSpec 规范

跨工作区变更或重大功能需使用 OpenSpec 管理：

- **L3（强制）**: 新功能、API 契约变更、跨工作区交付 - 必须创建 `openspec/changes/<change-id>/` 并按完整流程执行
- **L2（建议）**: 单工作区行为变更但不改 API 契约 - 可使用 OpenSpec Lite（至少 `proposal.md` + `tasks.md`）
- **L1（可豁免）**: 单工作区小修复且不改契约、改动范围小（≤3 文件）- 可不建 OpenSpec，但必须先写 acceptance contract

不确定时默认按 L3 执行。使用本地未追踪的 `openspec/changes/` 目录规划，不要提交到主分支。

## Pull Request

保持变更聚焦，使用现有提交风格（`feat:`、`fix:`、`test:`、`docs:`、`chore:`）。完成 PR checklist 并包含：

- 问题和预期行为
- 重要实现或兼容性决策
- 执行的测试
- 迁移、配置、文档和发布说明影响

发布出版是单独的维护者操作，PR 不得创建或移动发布 tag。

永远不要直接推送 `master`。仓库规则集和本地 CLI 都必须要求 pull request。

## 分支推送

普通分支推送使用快速路径，不运行本地测试：

```bash
python3 skills/push-cli/scripts/push_cli.py push
```

远程 CI 和安全扫描在 PR 和 `master` 推送时运行，不在每个特性分支推送时运行。

## 最终提交前

创建或更新最终 pull request 前，运行升级门禁：

```bash
python3 skills/push-cli/scripts/push_cli.py submit-pr
```

`submit-pr` 默认使用 `full` profile，要求最新的默认分支 base 并运行完整矩阵。

## 发布防护

可发布变更必须保持依赖版本与 lockfile 一致。执行或部署前核验必需的 env、config 和外部依赖。影响共享环境、数据或部署状态的高风险/破坏性操作必须先获明确确认。

## Skill 触发

仓库级 skill 按领域维护：

- **项目参考**: 使用 `infoq-project-reference`
- **后端验证**: 使用 `infoq-backend-verify`（单测、登录、API smoke）
- **前端验证**: 使用 `infoq-frontend-verify`（单测、构建、本地栈）
- **管理端 E2E**: 使用 `infoq-admin-e2e`（真实验证码、CRUD）
- **数据运维**: 使用 `infoq-data-ops`（SQL、数据库、Redis）
- **交付工作流**: 使用 `infoq-delivery-workflow`（OpenSpec、重大 UI 门禁）
- **部署验证**: 使用 `infoq-deploy-verify`（Docker Compose 全栈）

详见 [`doc/collaboration/skills-guide.md`](doc/collaboration/skills-guide.md)。

## 相关文档

- [开发指南](DEV_GUIDE.md)
- [文档索引](doc/README.md)
- [AGENTS.md](AGENTS.md)
- [安全策略](SECURITY.md)

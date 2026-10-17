# 仓库结构与工程约定整理计划（2026-10-17）

> 本计划记录本次仓库级结构调整的验收约定、变更矩阵、验证清单与回滚条件。
> 结构调整以通用工程约定为目标，不记录外部参考对象。
> OpenSpec change：`openspec/changes/structure-alignment-2026-10-17/`（本地脚手架，不提交）。

## 1. 目标

把本仓库的顶层目录、技能形态、工程文件与文档入口收敛到统一、可维护的组织方式，
同时保持本仓库的业务标识、技术栈、API 契约与运行行为不变。

## 2. 验收约定

- 功能范围：
  - 工作区目录改为 `backend/`、`frontend-vue/`、`frontend-react/`。
  - 仓库级技能改为 `compress-cli`、`push-cli`、`release-cli`、`test-cli`，新增 `deploy-cli`。
  - 根级工程文件与文档入口补齐到统一结构层：PR 模板、Dependabot、
    安全扫描与发布工作流、根 `.dockerignore`、`.tool-versions`、发布与 CI 验证文档、
    部署生命周期文档、技能索引与文档导航同步。
  - 所有被移动目录、技能名、文档链接与脚本路径在仓库内保持可解析。
- 非目标：
  - 不修改 Maven `artifactId`、Java 包名、`spring.application.name`、Docker 镜像名、
    `package.json` 的 `name`、SQL 基线、依赖版本与 API 契约。
  - 不新增第三方依赖，不改变业务行为，不改写历史发布 tag/Release。
  - 不推送远端、不创建 PR/tag/Release；本次只提交到当前分支。
- 异常处理与阻塞：
  - 任一编码、链接、单测、lint、构建、OpenSpec 或容器 smoke 失败，禁止提交。
  - 路径重命名后出现悬空引用时，优先修复引用，不保留兼容别名。
  - Apple container 资源只允许操作 `infoq-apple*`；发现其他非本栈资源时立即停止。
- 必需日志/验证证据：
  - 证据统一写入 `tmp/structure-alignment-2026-10-17/`。
  - 至少保留：UTF-8、README 同步、AGENTS 校验、后端单测、Vue/React 单测与构建、
    技能回归、OpenSpec 校验、Apple container `status` 与 readiness 输出。
- 回滚触发条件：
  - 工作区重命名导致构建、部署脚本或 CI 入口不可恢复地失效。
  - Apple container smoke 无法在只操作 `infoq-apple*` 的前提下完成。
  - 版本、依赖、SQL 或运行行为出现非预期变化。
  - 回滚方式：回到本次变更前的提交（`2ac21e8`），不涉及远端状态。

## 3. 变更矩阵

| 区域 | 现状 | 目标 |
| --- | --- | --- |
| 工作区 | `infoq-scaffold-backend/frontend-vue/frontend-react` | `backend/`、`frontend-vue/`、`frontend-react/` |
| 仓库技能 | `infoq-compress/push/release/test` | `compress-cli/push-cli/release-cli/test-cli` + `deploy-cli` |
| GitHub | 仅 `ci.yml` | CI + Security Scan + Release + PR 模板 + Dependabot |
| 根工程文件 | 无 `.dockerignore`、`.tool-versions` | 补齐统一工程文件层 |
| 文档 | 治理文档为主，缺发布/CI/部署生命周期入口 | 新增 `docs/RELEASING.md`、`docs/CI_VALIDATION.md`、`deploy/DEPLOYMENT_LIFECYCLE.md` 并更新索引 |
| 部署 | `deploy/APPLE_CONTAINER.md`、`deploy/VERIFICATION.md` | 增加 `deploy-cli` 技能与状态文件收口，保持现有脚本为执行真值 |

## 4. 验证顺序

1. 主流程：后端启动与 Apple container readiness、MySQL/Redis/管理员数据 smoke。
2. 定向测试：后端单测、Vue/React 单测、技能脚本回归、OpenSpec 校验。
3. lint/build：Vue/React lint 与生产构建、README/UTF-8/AGENTS 校验。
4. 差异审查：`git diff --check`、悬空路径扫描、最终 `git status` 与提交。

## 5. 残余风险

- 工作区目录改名会影响本机已有脚本、IDE 缓存与外部书签；仓库内引用全部同步，
  仓库外引用不在本次控制范围。
- Apple container 1.2.0 无自动重启能力，smoke 完成后的资源清理需显式执行。
- 新增 GitHub 工作流只做静态语法与本地可执行路径校验，远端 Actions 首次运行
  仍需在推送后观察。

## 6. 验收结果（2026-10-17）

- 文档与规约：UTF-8、README 同步、版本一致性、文档链接、AGENTS 路由校验全部通过。
- 后端：`node tools/backend_mvn.mjs -- -B -ntp -DskipTests=false test` 通过
  （508 个业务模块测试 + 插件与入口模块测试，BUILD SUCCESS）。
- Vue：`lint:eslint`、`test:unit`、`build:prod` 通过。
- React：`lint`、`test`、`build:prod` 通过。
- 技能：`compress-cli`、`deploy-cli`、`release-cli`、`test-cli` 回归脚本通过；
  OpenSpec active change 结构校验通过。
- Apple container：`deploy-cli up --no-build` 启动 MySQL、Redis、infoq-admin；
  readiness=`UP`（database/redis 均 UP），`sys_menu=105`、`sys_user=3`、
  管理员 `admin|0|0`，Redis `PONG`；真实验证码登录最终获取 token。
- 清理：`infoq-apple` 容器、网络与验证卷已删除；其他项目的容器资源未被触碰；
  `localhost/infoq-admin:3.0.0-apple` 验证镜像保留。
- 证据：`tmp/structure-alignment-2026-10-17/` 与 `tmp/deploy-cli/`。

## 7. 结构决策

| 决策项 | 结果 |
| --- | --- |
| 工作区目录 | 采用 `backend/`、`frontend-vue/`、`frontend-react/`，保留双管理端差异 |
| 仓库技能 | 采用 `compress-cli`、`push-cli`、`release-cli`、`test-cli`，新增 `deploy-cli` |
| 根工程文件 | 补齐 `.dockerignore`、`.tool-versions`、`assets/`、PR 模板与 Dependabot |
| CI / 发布 / 安全 | 新增 release、security-scan 工作流；CI 增加版本与文档链接门禁 |
| 文档入口 | 新增 `docs/RELEASING.md`、`docs/CI_VALIDATION.md`、`deploy/DEPLOYMENT_LIFECYCLE.md` |
| 部署编排 | 由 `deploy-cli` 负责生命周期与 smoke；既有脚本保持执行真值 |
| 容器构建 | 保留各工作区 Dockerfile，Compose 使用工作区构建上下文，不新增根 Dockerfile |
| 运行标识 | Maven 坐标、包名、应用名、镜像名、包管理器包名与 API 契约保持不变 |

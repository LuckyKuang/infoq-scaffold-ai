# Proposal: consolidate-supported-workspaces

## 背景

本次仓库治理的业务目标是：**把可维护、可发布的产品基线收敛为一个后端和两个管理端前端，并让所有入口文档、脚本说明与规格都只描述这三个工作区。**

当前仓库同时记录 Spring Boot 后端、Vue 管理端、React 管理端、React Pro 管理端、两个小程序端和独立文档站。已有删除操作开始移除 `infoq-scaffold-frontend-react-pro`、`infoq-scaffold-frontend-weapp-react`、`infoq-scaffold-frontend-weapp-vue` 与 `infoq-scaffold-docs`，但根 README、`doc/` 手册、OpenSpec 项目上下文、工作区清单、部署说明和测试矩阵仍可能引用这些路径。文档与实际目录不一致会让贡献者选择已不存在的入口，也会让脚本、构建和验证流程产生假成功或难以定位的失败。

## 问题陈述

- 当前文档把三套管理端、两套小程序端和文档站都当作持续维护范围，和新的产品决策冲突。
- 已删除工作区的链接、命令、Node/包管理说明、部署服务名和测试矩阵仍可能残留在 README、`doc/`、`GEMINI.md`、OpenSpec 和脚本说明中。
- `openspec/project.md` 的工作区映射及平台治理影响矩阵仍包含退役工作区，后续 change 会继续按过期矩阵分派任务。
- 文档站目录被删除后，仍把它写成“展示层”会造成维护者误以为需要同步或构建一个不存在的站点。

## 目标与成功指标

- 目录与版本控制中的受支持工作区集合明确且唯一：`infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue`。
- 根 README、`doc/` 正文、`GEMINI.md`、OpenSpec 上下文与稳定规格、部署/验证说明不再把退役工作区作为可用入口；必要时明确其已移除。
- 文档中的命令、链接、服务名和测试矩阵只指向存在的路径，且保留后端共享及 React/Vue 两套前端的运行、测试和部署说明。
- 通过全文引用扫描、UTF-8 校验、OpenSpec 结构校验及受影响工作区的文档/构建检查，形成可复核证据。

## 变更内容

### 用户故事

- 作为项目使用者，我希望从 README 和 `doc/` 找到两个管理端与一个后端的准确启动、测试和部署入口，以便按当前支持基线快速运行项目。
- 作为贡献者，我希望工作区清单、OpenSpec 影响矩阵和协作规则不再分派到已删除目录，以便新 change 的范围判断与代码现状一致。
- 作为维护者，我希望删除工作区后能通过引用扫描发现残留链接、命令和服务名，以便文档修复不会留下隐性断链。

### 范围

- 保留 `infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue` 三个工作区及其现有代码和工作区级规则。
- 删除或确认删除 `infoq-scaffold-frontend-react-pro`、`infoq-scaffold-frontend-weapp-react`、`infoq-scaffold-frontend-weapp-vue`、`infoq-scaffold-docs` 的目录、入口文件和专属文档（删除动作由实现阶段按当前 git 状态完成，不在本 proposal 中恢复已暂存删除）。
- 修复根 `README.md`、`GEMINI.md`、`doc/`、`openspec/project.md`、相关稳定规格、脚本/部署说明和测试矩阵中的工作区清单、链接、命令、服务名、技术栈与维护边界。
- 更新文档导航，使根 `doc/` 成为唯一正文来源；不得再要求同步一个不存在的 `infoq-scaffold-docs` 展示层。
- 在 OpenSpec 影响矩阵中逐项标记后端、React、Vue、退役工作区、`script / deploy` 的影响和原因，保留可审计的删除记录。

### 非目标

- 不改变后端 API、数据库结构、初始化 SQL、插件行为、鉴权流程或业务数据。
- 不重写保留的 React/Vue 页面，不迁移小程序功能，也不新增替代移动端实现。
- 不引入新的文档站、静态站点生成器、包管理器或部署平台。
- 不删除仍被三个保留工作区、`script`、`deploy` 或根 `doc/` 实际使用的共享资源；无法确认引用关系的文件必须记录为阻塞项。

### 约束

- 遵守根 `AGENTS.md` 及保留工作区更近的 `AGENTS.md`；文本文件使用 UTF-8 without BOM。
- `sql/infoq_scaffold_2.0.0.sql` 保持冻结，不通过 SQL 变更承载本次目录治理。
- 前端验证使用 `pnpm`，后端验证使用仓库规定的 Maven runner；本 change 只要求与文档和目录清理相关的最小验证。
- 先完成主流程（目录与引用清理），再做定向扫描、UTF-8/OpenSpec 校验、受影响工作区等价检查，最后进行差异审查。

## 验收约定

- 功能范围：版本库最终只把 `infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue` 作为受支持工作区；退役四个目录不存在，根 README、`doc/`、`GEMINI.md`、OpenSpec 和部署/验证文档中的入口、链接、命令、服务名与技术栈描述已同步；保留工作区的后端共享、React 管理端和 Vue 管理端使用路径可被文档直接找到。
- 非目标：不修改 API、数据库、插件、业务页面或保留工作区运行时行为；不恢复已删除工作区；不把退役工作区改名为新的产品能力。
- 异常处理与阻塞：发现脚本仍动态依赖退役目录、文档引用无法判定归属、删除会影响保留工作区，或依赖的验证环境缺失时必须显式失败并记录具体文件、命令和原因；禁止用空目录、断链占位页或静默跳过掩盖问题。
- 必需日志/验证证据：保留 `git status`/diff 中的删除与文档改动记录；保存工作区引用扫描结果、`node .codex/scripts/validate_utf8.mjs` 输出、`openspec_check.mjs consolidate-supported-workspaces` 输出，以及根文档链接/命令检查和保留后端、React、Vue 的可运行性或明确 blocker 记录。临时输出统一放在 `doc/tmp/`。
- 回滚触发条件：若保留工作区构建、启动、部署脚本或核心文档链接因清理而失败，或发现仍需退役工作区才能完成已承诺的核心用户流程，则停止归档并恢复受影响的最小删除/引用改动；回滚后保留问题证据，重新评估支持矩阵再继续。

## 延期范围

- 本 change 不延期用户已要求的目录删除和文档修复。
- 可在后续 change 评估：为保留的 React/Vue 管理端补充统一文档站替代方案、清理历史发布制品/镜像标签，以及将退役工作区的历史迁移说明单独归档；这些不阻塞本次收敛。

## 风险与待确认

- 风险：部署脚本、CI 工作流或外部文档可能通过字符串拼接间接引用退役目录，普通 Markdown 扫描未必能发现；实现阶段必须同时扫描脚本、配置和 workflow。
- 风险：删除 `infoq-scaffold-docs` 后，原本由其同步脚本生成的导航可能失去维护入口；根 `doc/` 的导航与发布说明必须先确认可独立使用。
- 风险：历史 `doc/test` 矩阵包含已删除工作区的路径，直接删除条目可能影响测试工具解析；需将其标记为 retired 或移除并验证矩阵格式。
- 待确认：是否需要在 CHANGELOG、发行说明或外部仓库链接中保留退役工作区的历史说明；若需要，应采用静态迁移说明，不恢复工作区。
- 待确认：Docker Compose 是否继续提供双前端服务命名和网关路由；实现阶段以当前 compose 与部署脚本的实际引用为准，并在无法保留时记录 blocker。

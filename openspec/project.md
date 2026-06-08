# InfoQ Scaffold AI 项目上下文

## 目标

`infoq-scaffold-ai` 是一个 AI 优先的全栈脚手架。`infoq` 前缀代表框架品牌标识，不是项目私有定制开关。命名共享框架能力、技能与文档时应保留该前缀。

## 工作区映射

- `infoq-scaffold-backend`：Spring Boot 多模块后端
- `infoq-scaffold-frontend-react`：React 19 + Ant Design 管理端
- `infoq-scaffold-frontend-vue`：Vue 3 + Element Plus 管理端
- `infoq-scaffold-frontend-weapp-vue`：uni-app + Vue 小程序与 H5 移动端
- `infoq-scaffold-frontend-weapp-react`：Taro + React 小程序与 H5 移动端
- `infoq-scaffold-docs`：VitePress 文档站展示层、同步脚本与发布入口
- `script`：部署、环境与本地 WeChat DevTools 启动脚本
- `sql`：冻结初始化 SQL 与版本增量脚本
- `doc`：文档正文真值源、参考文档与使用指南

## 架构默认约束

- 后端主链路：`Controller -> Service -> Mapper -> Entity`
- 前端实现必须遵守各工作区本地架构，不得把某一端风格强行套到另一端
- 优先显式失败路径，避免静默回退
- 优先最小改动，避免大范围重写

## 交付默认约束

- L3 变更（新功能、API 契约变更、跨工作区交付）在改代码前必须创建或定位 `openspec/changes/<change-id>/`
- L2 变更（单工作区行为变更且不改 API 契约）可使用 OpenSpec 精简流程，至少维护 `proposal.md` 与 `tasks.md`
- L1 变更（单工作区小修复且不改契约、改动范围小）可不创建 OpenSpec，但必须先写验收约定
- 不确定分级时默认按 L3 执行
- repo-level 或高风险治理变更，除 active change 外，还应在 `doc/plan/YYYY-MM-DD-topic-plan.md` 中保留执行计划
- 活跃变更规划放在 `openspec/changes/<change-id>/`
- 当前稳定真值规范放在 `openspec/specs/`
- 执行期间以 `proposal.md`、`tasks.md` 与相关规范增量作为真值
- active change 在实现前和交付前都必须通过 `node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id>` 结构校验
- `tasks.md` 默认显式评估 `infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue`、`infoq-scaffold-frontend-weapp-react`、`infoq-scaffold-frontend-weapp-vue`、`infoq-scaffold-docs`、`script / deploy`
- 每个变更只维护一个验收约定
- 验证顺序固定为：主流程验证 -> 目标测试 -> lint/build -> 差异评审
- `sql/infoq_scaffold_2.0.0.sql` 是冻结初始化基线，任何变更不得修改该文件；数据库结构、字典、菜单、配置和初始化数据变化必须新增 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本承载

## 文档与工具默认约束

- OpenSpec 文档正文默认使用中文
- 路径名称、命令、文件名保持英文原样（例如 `openspec/changes/<change-id>/`、`pnpm`、`mvn`、`proposal.md`）
- `openspec/` 与 `doc/plan/` 属于仓库真值资产，默认纳入版本控制
- OpenSpec 相关临时验证输出不得放在 `openspec/` 下规避提交；一次性产物统一放在 `doc/tmp/`
- 前端命令优先使用 `pnpm`
- 后端构建与测试使用 `mvn`
- L3/L2 交付优先使用 `infoq-delivery-workflow` 做 OpenSpec 文档产物编排；其当前主入口是 `init_change_dir.mjs` 与 `openspec_check.mjs`
- 对重复验证流程优先复用仓库技能
- 仅当用户明确要求子代理或多专家执行时才使用子代理

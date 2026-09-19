# 平台治理规格增量

## ADDED Requirements

### 要求：受支持工作区集合必须唯一

仓库对外文档、协作规则、自动化入口和发布说明必须（MUST）把 `infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue` 作为唯一受支持工作区；`infoq-scaffold-frontend-react-pro`、`infoq-scaffold-frontend-weapp-react`、`infoq-scaffold-frontend-weapp-vue`、`infoq-scaffold-docs` 删除后不得继续作为可运行入口出现。

#### 场景：贡献者查看仓库结构

- 当贡献者阅读根 README、`doc/README.md`、`openspec/project.md` 或协作指南时
- 则这些文档必须（MUST）只列出三个受支持工作区，并为每个工作区提供存在且可执行的入口；退役工作区只能在迁移/删除说明中以历史对象出现。

#### 场景：自动化或部署入口解析工作区

- 当维护者运行脚本、CI workflow、Docker Compose 或测试矩阵所引用的工作区入口时
- 则入口必须（MUST）解析到三个受支持目录；若检测到退役目录引用，检查必须显式失败并指出文件与引用位置。

## MODIFIED Requirements

### 要求：统一影响矩阵（修改）

维护跨工作区 change 时，影响矩阵必须（MUST）覆盖三个受支持工作区、已退役工作区的删除/文档清理状态以及 `script / deploy` 交付面；对退役项必须给出“不再存在、无需实现”或“仍有残留引用需清理”的明确原因，不得把它们当作待实现工作区。

#### 场景：创建目录收敛类 change

- 当 change 删除一个或多个工作区并同步修复文档时
- 则 `tasks.md` 的影响矩阵必须（MUST）逐项记录 backend、React、Vue、React Pro、weapp React、weapp Vue、docs 和 `script / deploy` 的影响结论，并将已删除项标记为退役清理或验证阻塞。

#### 场景：归档目录收敛类 change

- 当 change 准备归档时
- 则验证证据必须（MUST）证明三个受支持工作区入口存在、退役目录不存在、文档与脚本引用已完成清理，且任何未解决的退役引用都使归档检查显式失败。

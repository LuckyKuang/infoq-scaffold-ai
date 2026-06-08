# 数据运维边界

## 职责

`infoq-data-ops` 负责数据库、缓存和基础数据侧的流程约束：

- SQL 增量脚本规划与冻结初始化基线保护。
- 数据修复、批量更新、测试数据清理和回滚脚本设计。
- 字典、参数、菜单、权限、角色、部门等基础数据的数据库侧核对。
- MySQL / Redis 只读诊断和数据一致性排查。
- API / UI / DB 三方一致性验证方案。
- 数据迁移的幂等性、重复执行安全、事务边界和性能影响评估。

## 不负责

- 管理端页面真实操作：使用 `infoq-admin-ops`。
- 管理端 E2E 自动化：使用 `infoq-admin-e2e`。
- 后端接口、Mapper XML、登录链路、Redisson OSS 验证：使用 `infoq-backend-verify`。
- React/Vue admin 或 weapp 单测、构建和运行态验证：使用 `infoq-frontend-verify`。
- 版本升级和发布文档同步：使用 `infoq-release-ops`。
- 高影响交付、OpenSpec 和跨工作区编排：使用 `infoq-delivery-workflow`。

## 写入门禁清单

数据写入前必须列出：

- 环境：local、dev、test、staging、prod 或其他明确环境。
- 连接来源：配置文件、MCP、只读账号或手工执行入口。
- 目标：表、字段、Redis key、记录 ID、筛选条件。
- 影响：关联用户、角色、菜单、部门、任务、字典项、参数或业务数据。
- SQL / Redis 操作：预览查询、写入语句、事务边界和预计影响行数。
- 幂等性：重复执行的结果，以及如何避免重复插入或重复更新。
- cleanup：测试数据或临时记录如何清理。
- 回滚：失败后的恢复 SQL、脚本或手工步骤。
- 验证：操作后只读 SQL、API 核对、页面核对或 Redis 查询。

## 默认策略

- 共享环境默认只读。
- 删除、truncate、批量 update、批量 delete 和权限/菜单/任务相关数据变更默认禁止，除非用户明确确认目标集。
- SQL 增量脚本必须新增到当前日期 update 文件，不修改冻结初始化 SQL。
- 数据修复必须先有只读 preview，再有 write plan，最后才执行。
- 权限、菜单、字典和参数数据变更至少用 API/UI/DB 两个视角核对。

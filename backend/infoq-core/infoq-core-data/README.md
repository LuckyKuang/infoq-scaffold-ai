# infoq-core-data

## 1. 模块职责

`infoq-core-data` 提供当前 `cc.infoq.system` 域的数据对象与持久化定义，包括实体、BO、VO、Mapper 接口和 Mapper XML。

## 2. 关键入口

- 实体目录：[`src/main/java/cc/infoq/system/domain/entity`](./src/main/java/cc/infoq/system/domain/entity)
- BO 目录：[`src/main/java/cc/infoq/system/domain/bo`](./src/main/java/cc/infoq/system/domain/bo)
- VO 目录：[`src/main/java/cc/infoq/system/domain/vo`](./src/main/java/cc/infoq/system/domain/vo)
- Mapper 目录：[`src/main/java/cc/infoq/system/mapper`](./src/main/java/cc/infoq/system/mapper)
- Mapper XML：[`src/main/resources/mapper/system`](./src/main/resources/mapper/system)

## 3. 核心类 / 文件

- 实体：`SysUser`、`SysRole`、`SysMenu`、`SysDept`、`SysConfig`、`SysJob`、`SysOss` 等。
- BO：`SysUserBo`、`SysRoleBo`、`SysMenuBo` 等写入/查询参数对象。
- VO：`LoginVo`、`RouterVo`、`UserInfoVo`、`ServerMonitorVo`、`DataSourceMonitorVo` 等返回对象。
- Mapper：`SysUserMapper`、`SysRoleMapper`、`SysMenuMapper`、`SysJobMapper` 等。
- XML：`SysUserMapper.xml`、`SysRoleMapper.xml`、`SysMenuMapper.xml` 等真实 SQL 与查询拼装入口。

## 4. 上游依赖

- `infoq-system` 的控制器与服务实现直接依赖这里的 BO、VO、Entity、Mapper。
- 监控、登录、菜单、用户、角色、Quartz、OSS 等链路都从这里读取或写入持久化对象。

## 5. 下游依赖

- 编译期依赖 `infoq-plugin-mybatis`、`infoq-plugin-log`、`infoq-plugin-sensitive`、`infoq-plugin-translation`、`infoq-plugin-excel`、`infoq-plugin-jackson`。
- 这说明当前数据层已经内嵌了分页、数据权限、日志、脱敏、翻译、Excel 与 JSON 序列化语义。

## 6. 关键配置

- Mapper XML 真值位于 `src/main/resources/mapper/system/*Mapper.xml`。
- `mapper/package-info.md` 说明 Mapper 资源按当前模块维护。

## 7. 关键数据流

1. `infoq-system` 控制器接收请求。
2. Service 实现组装 `Bo`、调用 `Mapper`。
3. `Mapper` 与 `Mapper XML` 负责真实 SQL 和查询映射。
4. 结果回到 `Entity` / `Vo`，再经过翻译、脱敏、序列化等插件语义输出。

## 8. 扩展点

- 新增系统域持久化对象时，通常在这里补 `Entity + Bo + Vo + Mapper + XML`。
- 数据权限、审计、翻译、Excel、脱敏能力主要通过已有插件注解和基类接入。

## 9. 日志 / 监控切入点

- SQL 执行、数据权限、MyBatis 异常处理主要由 `infoq-plugin-mybatis` 承接。
- 返回值翻译、字段脱敏、导入导出语义分别由 `translation`、`sensitive`、`excel` 插件接入。

## 10. 已知边界

- 该模块没有 Controller 和 Service 实现。
- 它当前只覆盖 `system` 领域对象；若未来出现新的业务域，需要以实际目录结构为准。


# 管理端 E2E 场景矩阵

## 范围来源

管理端 Web 自动化测试范围由 `test-cli` 生成：

```bash
node skills/test-cli/scripts/generate-case-matrix.mjs
```

默认矩阵产物：

```text
docs/testing/case-matrix.json
docs/testing/case-matrix.md
docs/testing/gaps.md
```

`run_admin_e2e.mjs` 默认执行动态菜单的业务只读 smoke，不按矩阵优先级筛选；验证码种子与会话仍有 Redis 写入副作用。模块级 CRUD 使用独立 runner，执行前读取 `references/crud/`。静态矩阵没有执行结果含义。

## P0 默认覆盖

| 层级 | 场景 | 验收方式 |
| --- | --- | --- |
| 后端验证码 | `GET /auth/code` | 返回 `captchaEnabled=true` 时必须包含 `img` 和 `uuid`，图片落盘 |
| 验证码种子 | 读取 `/auth/code` 的 `uuid` 后向 Redis 写入已知答案 | 写入成功，后续登录使用同一答案 |
| 后端登录 | `POST /auth/login` | 请求包含 `clientId`、`grantType=password`、`username`、`password`、`code`、`uuid`，成功返回 token |
| 会话信息 | `/system/user/getInfo` | token 可访问，返回用户信息 |
| 动态路由 | `/system/menu/getRouters` | token 可访问，返回路由树 |
| 管理端路由 | 动态路由 smoke | 每个候选路由可打开，截图和 console 记录落盘 |

## P1 / P2 默认排除

| 类型 | 原因 |
| --- | --- |
| 新增、编辑、删除、批量删除 | 需要测试数据隔离和清理策略 |
| 导出下载 | 需要文件断言和清理策略 |
| 角色权限边界 | 需要多账号矩阵 |
| 第三方 OAuth | 需要外部 provider 配置 |
| 邮件验证码注册、忘记密码 | 需要邮件插件和邮箱收件链路 |

## 后续扩展建议

1. 为每个模块建立 `read`、`create`、`update`、`delete`、`export`、`permission` 六类场景。
2. 所有写入型场景使用 `e2e_` 前缀测试数据。
3. 每个写入型场景必须定义清理步骤和失败后人工回滚提示。
4. 权限边界至少覆盖管理员、部门账号、普通账号三类角色。
5. 后续可为 `run_admin_e2e.mjs` 增加 `--case-matrix` 和 `--case-priority P0` 参数，在执行器内直接读取矩阵。

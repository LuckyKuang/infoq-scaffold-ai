# 管理端 E2E 场景矩阵

## 本轮默认覆盖

| 层级 | 场景 | 验收方式 |
| --- | --- | --- |
| 后端验证码 | `GET /auth/code` | 返回 `captchaEnabled=true` 时必须包含 `img` 和 `uuid`，图片落盘 |
| OCR | `ddddocr` 识别图片 | 识别结果非空，并保存 OCR 记录 |
| 后端登录 | `POST /auth/login` | 请求包含 `clientId`、`grantType=password`、`username`、`password`、`code`、`uuid`，成功返回 token |
| 会话信息 | `/system/user/getInfo` | token 可访问，返回用户信息 |
| 动态路由 | `/system/menu/getRouters` | token 可访问，返回路由树 |
| 管理端路由 | 动态路由 smoke | 每个候选路由可打开，截图和 console 记录落盘 |

## 默认排除

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

# 接口检查清单

## 公开接口

- `GET /`
  - 期望：HTTP 200，响应包含 `backend`。
- `GET /auth/code`
  - 期望：JSON `code=200`（`captchaEnabled` 可为 true 或 false）。

## 登录接口

- `POST /auth/login`
  - 默认使用加密登录载荷（`encrypt-key` + AES body）；RSA 公钥必须匹配目标后端。
  - 只有确认后端 `api-decrypt.enabled=false` 后才显式选择 `--login-mode plain`（内部检查器为 `LOGIN_MODE=plain`）；失败不切换协议，参数不会更改后端开关。
  - 期望：JSON `code=200` 且 token 非空（`access_token` 或 `accessToken`）。
  - 验证码由 runner 临时关闭；此流程不用于认证安全验收。正式鉴权验证使用 test-cli 的 Redis 种子验证码登录。

## 受保护接口

- `GET /system/menu/getRouters`
  - 期望：JSON `code=200`。
- `GET /system/menu/roleMenuTreeselect/{roleId}`
  - 期望：JSON `code=200`。
- `GET /system/role/deptTree/{roleId}`
  - 期望：JSON `code=200`。
- `GET /system/dict/data/type/{dictType}`
  - 期望：JSON `code=200`。
- `POST /system/user/export`
  - 期望：HTTP 200 + Excel 响应（`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`）+ 非空字节流。

## 权限、影响与判定边界

测试账号需有菜单查询、角色查询、字典读取及用户导出权限；`roleId` / `dictType` 必须在隔离数据中存在。HTTP 状态和 JSON 业务码分别检查，不能将业务 `code=403` 当作 HTTP 403。

登录会写入 Redis 会话、在线态和数据库审计，导出可能写操作日志；脚本不自动退出登录或删除这些记录。只能在已确认目标与清理方案的隔离环境运行。`GET /auth/code` 在非 runner 场景验证码启用时还会写验证码与限流键。

当前脚本只检查上述有限接口。启动探测中的 `/monitor/health` / 首页仅代表 HTTP 可响应；生产接流量必须另外验证 `/monitor/health/readiness`。脚本的私有 `TOKEN=` / `USER_ID=` 输出仅允许由集群父进程捕获消费，不可进入公开日志。配置、集群 Redis 验证端边界与无真实依赖的回归步骤见 [`../../README.md`](../../README.md)。

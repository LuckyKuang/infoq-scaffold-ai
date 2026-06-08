# 套件覆盖清单

## `smoke` 套件

- `smoke.routes`
  - 在 token/session 可用时，检查登录路由与已鉴权路由的核心可达性。

## `core` 套件

- `smoke.routes`
- `auth.flow`
- `profile.flow`
- `notice.flow`
- `permission.flow`

该套件适用于日常快速回归，不需要全量路由遍历。

## `full` 套件（接口覆盖默认）

- `api.contract`
  - 枚举 `src/api/**/*.ts`。
  - 确保每个 API wrapper 导出都具备 transport（`request` 或 `uploadFile`）、method（针对 `request`）与 url。
- `full.routes`
  - 遍历 `ALL_ROUTES` 中登记的全部路由。
- `auth.flow`, `profile.flow`, `notice.flow`, `permission.flow`
  - 校验核心鉴权交互与权限边界。

当目标是“全接口覆盖 + 全路由冒烟”时，使用 `--suite full`。

## 登录进入首页目标说明

若目标是“登录成功并进入主页”，使用脚本参数 `--login-home-only`。

已知行为：
- 在已鉴权状态下，应用守卫会把 `/pages/login/index` 重定向到 `/pages/home/index`。
- 这可能表现为单条 smoke 用例不匹配，但“登录进入首页”目标实际已达成。

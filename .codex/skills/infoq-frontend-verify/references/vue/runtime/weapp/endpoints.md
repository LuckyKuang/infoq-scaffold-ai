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

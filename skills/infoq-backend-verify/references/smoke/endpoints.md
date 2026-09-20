# 接口检查清单

## 公开接口

- `GET /`
  - 期望：HTTP 200，响应包含 `infoq-scaffold-backend`。
- `GET /auth/code`
  - 期望：JSON `code=200`（`captchaEnabled` 可为 true 或 false）。

## 登录接口

- `POST /auth/login`
  - 优先使用加密登录载荷（`encrypt-key` + AES body）。
  - 若加密链路不可用，回退为明文 JSON 载荷。
  - 期望：JSON `code=200` 且 token 非空（`access_token` 或 `accessToken`）。

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

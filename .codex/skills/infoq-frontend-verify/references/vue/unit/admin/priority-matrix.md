# 优先级矩阵

## P0（必须优先）

- `src/utils/validate.ts`
- `src/utils/scaffold.ts`
- `src/utils/request.ts`
- `src/utils/auth.ts`
- `src/utils/dict.ts`
- `src/utils/permission.ts`
- `src/store/modules/user.ts`
- `src/store/modules/permission.ts`
- `src/store/modules/tagsView.ts`
- `src/store/modules/dict.ts`
- `src/plugins/auth.ts`
- `src/plugins/cache.ts`
- `src/directive/common/copyText.ts`
- `src/directive/permission/index.ts`

## P1

- `src/utils/sse.ts`
- `src/utils/websocket.ts`
- `src/plugins/download.ts`
- `src/plugins/tab.ts`
- `src/plugins/modal.ts`
- `src/permission.ts`
- `src/router/index.ts`

## P2

- 通用组件：`Pagination`, `RightToolbar`, `DictTag`, `IconSelect`, `Breadcrumb`
- 先覆盖轻量页面：`views/error/401`, `views/error/404`, `views/redirect`, `views/index`
- 再覆盖中等业务页：`system/user/authRole`, `system/role/authUser`, `system/role/selectUser`, `system/user/profile/*`

## P3

- 重型业务页：`system/user/index`, `system/role/index`, `system/menu/index`, `system/dept/index`, `system/dict/*`, `monitor/*`
- 每个业务域先选一个代表页，稳定 stubs/mocks 后再复制模式。

### P3 进展快照（2026-03-07）

- 已完成：
  - `system/menu/index.vue`
  - `system/user/index.vue`
  - `system/role/index.vue`
  - `system/dept/index.vue`
  - `system/dict/index.vue`
  - `system/dict/data.vue`
  - `system/post/index.vue`
  - `system/notice/index.vue`
  - `system/config/index.vue`
  - `system/client/index.vue`
  - `system/oss/index.vue`
  - `system/oss/config.vue`
  - `monitor/online/index.vue`
  - `monitor/loginInfo/index.vue`
  - `monitor/cache/index.vue`
  - `monitor/operLog/index.vue`
  - `monitor/operLog/oper-info-dialog.vue`
- 剩余高影响缺口：
  - Rich media/editor wrappers: `components/Editor`, `components/FileUpload`, `components/ImageUpload`
  - Selector-heavy reusable business components: `components/RoleSelect`, `components/UserSelect`

## 单文件完成定义

- Happy path + 核心错误路径
- 边界分支至少一条断言
- 副作用已验证（`store mutation`、`notification`、`redirect`、`download` 等）
- 运行时依赖指令/属性已处理（`v-loading`、`v-hasPermi`、`proxy.animate`、命名插槽、table scoped slots）

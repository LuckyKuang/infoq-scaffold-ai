# 优先级矩阵

## P0（必须优先）

- `src/utils/request.ts`
- `src/utils/auth.ts`
- `src/utils/crypto.ts`
- `src/store/modules/user.ts`
- `src/store/modules/permission.ts`
- `src/store/modules/app.ts`
- `src/store/modules/settings.ts`
- `src/store/modules/tagsView.ts`
- `src/router/AuthGuard.tsx`
- `src/router/BackendRouteView.tsx`
- `src/router/pathToComponent.ts`
- `src/router/routeTransform.tsx`

## P1

- 共享组件：`ScreenFull`, `SvgIcon`, `Editor`, `FileUpload`, `ImageUpload`
- 布局部件：`MainLayout`, `TagsViewBar`, keep-alive 行为
- 连接 router/layout/runtime 状态的桥接或壳层组件

## P2

- 鉴权与入口页面：`pages/login`, `pages/home`
- 代表性监控页面：`pages/monitor/cache`
- 再扩展到 mock 稳定的分组业务页：`pages/system/*`, `pages/monitor/*`

## P3

- 复杂 CRUD 与鉴权页面由分组套件覆盖：
  - `tests/pages/system-pages.test.tsx`
  - `tests/pages/ops-pages.test.tsx`
  - `tests/pages/monitor-auth-profile.test.tsx`
- 除非页面存在独特运行时需求，否则优先扩展已有分组套件，避免碎片化 one-off 文件。

### 当前覆盖形态

- 已覆盖基线：utils、stores、router guards、route transforms
- 已覆盖复用 UI：通用组件、upload/editor 包装器、布局外壳
- 已覆盖代表页：login、cache、system、monitor、auth/profile 流程
- 使用矩阵优先补业务分支与回归，不要追逐无意义的覆盖率数字

## 单文件完成定义

- Happy path + 至少一个有意义的错误分支或守卫分支
- 断言用户可见输出、重定向或通知
- 适用时断言 store 变更、路由跳转、请求头或下载副作用
- 浏览器专属 API 必须精确 stub，禁止粗暴静音

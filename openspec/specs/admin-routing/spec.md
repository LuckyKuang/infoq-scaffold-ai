# 管理端路由规范

## 目标

定义 Vue / React / React Pro 管理端的固定公开路由、登录后动态路由装配，以及后端菜单组件映射约定。

## 要求

### 要求：固定公开路由
三个管理端都必须继续保留稳定的公开入口和基础错误页。

#### 场景：Vue 管理端固定路由

- 当 Vue 管理端启动时
- 则必须继续保留 `/login`、`/register`、`/index`、`/user/profile`、`/401`、`404` 等固定路由壳

#### 场景：React 管理端固定路由

- 当 React 管理端启动时
- 则必须继续保留 `/login`、`/register`、`/401`、`/redirect/*`、`/index`、`/user/profile` 等固定路由壳

#### 场景：React Pro 管理端固定路由

- 当 React Pro 管理端启动时
- 则必须继续保留 `/login`、`/register`、`/401`、`/redirect/*`、`/index`、`/user/profile` 等固定路由壳

### 要求：登录后动态路由装配
动态业务页必须在登录后按会话与菜单数据装配。

#### 场景：token 存在但用户信息未装载

- 当管理端已持有 token 且 roles 为空时
- 则 React `AuthGuard`、React Pro 初始状态装载与 Vue `permission.ts` 必须先调用 `/system/user/getInfo`
- 并且必须继续调用 `/system/menu/getRouters`
- 并且只有在动态路由装配完成后才允许进入业务页面

### 要求：后端菜单组件映射
后端菜单 `component` 字段必须保持与管理端解析约定一致。

#### 场景：解析特殊组件名

- 当后端菜单组件名为 `Layout`、`ParentView` 或 `InnerLink` 时
- 则 Vue、React 与 React Pro 管理端必须继续执行特殊映射

#### 场景：解析业务页面组件

- 当后端菜单 `component` 填写业务页面路径时
- 则该值必须继续匹配实际页面路径约定，例如 `system/user/index`、`monitor/cache/index`、`monitor/server/index`

### 要求：路由冲突必须显式暴露
重复路由配置不得以静默方式进入运行态。

#### 场景：React 路由冲突

- 当 React 动态路由存在重复名称或重复路径时
- 则系统必须显式通知并抛错

#### 场景：React Pro 路由冲突

- 当 React Pro 动态路由存在重复名称或重复路径时
- 则系统必须显式通知并抛错

#### 场景：Vue 路由冲突

- 当 Vue 动态路由存在重复名称时
- 则系统必须显式输出错误并提示会造成 404

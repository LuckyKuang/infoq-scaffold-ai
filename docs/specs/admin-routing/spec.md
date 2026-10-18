# 管理端路由规范

## 目标

定义 Vue / React 管理端的固定公开路由、登录后动态路由装配，以及后端菜单组件映射约定。

## 要求

### 要求：固定路由与公开边界
两个管理端都必须保留稳定的公开认证入口、受保护固定页面和基础错误页。固定定义不代表免登录；访问边界由各端守卫决定。

#### 场景：Vue 管理端固定路由

- 当 Vue 管理端启动时
- 则必须继续保留 `/login`、`/oauth/callback`、`/register`、`/forgot-password`、`/index`、`/user/profile`、`/message-center`、`/401`、重定向与 catch-all 404 等固定路由壳
- 并且 `permission.ts` 的免登录白名单只放行公开认证入口；首页、个人中心、消息中心等仍需会话

#### 场景：React 管理端固定路由

- 当 React 管理端启动时
- 则必须继续保留 `/login`、`/oauth/callback`、`/register`、`/forgot-password`、`/401`、`/redirect/*`、`/index`、`/user/profile`、`/message-center` 与 catch-all 404 等固定路由壳
- 并且 `/index`、`/user/profile`、`/message-center` 必须位于 `AuthGuard` 保护的布局内

### 要求：登录后动态路由装配
动态业务页必须在登录后按会话与菜单数据装配。

#### 场景：token 存在但用户信息未装载

- 当管理端已持有 token 且 roles 为空时
- 则 React `AuthGuard` 与 Vue `permission.ts` 必须先调用 `/system/user/getInfo`
- 并且必须继续调用 `/system/menu/getRouters`
- 并且只有在动态路由装配完成后才允许进入业务页面

### 要求：后端菜单组件映射
后端菜单 `component` 字段必须保持与管理端解析约定一致。

#### 场景：解析特殊组件名

- 当后端菜单组件名为 `Layout`、`ParentView` 或 `InnerLink` 时
- 则 Vue 与 React 管理端必须继续执行特殊映射

#### 场景：解析业务页面组件

- 当后端菜单 `component` 填写业务页面路径时
- 则该值必须继续匹配实际页面路径约定，例如 `system/user/index`、`monitor/cache/index`、`monitor/server/index`

### 要求：路由冲突必须显式暴露
重复路由配置不得以静默方式进入运行态。

#### 场景：React 路由冲突

- 当 React 动态路由存在重复名称或重复路径时
- 则系统必须显式通知并抛错

#### 场景：Vue 路由冲突

- 当 Vue 动态路由存在重复名称时
- 则系统必须显式输出错误并提示会造成 404

### 要求：管理端部署前缀与站内路径一致

React 与 Vue 管理端必须在根路径和配置的站内部署前缀下使用正确的 Router base，导航、刷新、受保护路由、登录回跳与动态菜单必须保留同一应用前缀且不重复拼接。

#### 场景：React 部署到子路径

- 当React 构建部署前缀为 `/react/`，用户直接访问或刷新 `/react/user/profile`。
- 则Router必须解析应用内 `/user/profile`，未登录时进入 `/react/login`，登录后返回 `/react/user/profile`。
- 并且页面资源、菜单与错误页必须不逸出或重复该前缀；根部署 `/` 继续可用。

### 要求：OAuth 路由输入不得静默掩盖非法回跳

两个管理端必须使用不含 origin、带当前部署前缀一次的安全站内浏览器路径交换 OAuth redirect；Router 导航前必须移除该前缀一次，再由 base 添加。客户端必须区分未提供回跳的合法默认与已提供但非法的回跳；非空非法输入必须在开始授权或回调导航前明确拒绝，不得悄悄送往首页。

#### 场景：子路径绑定身份后回到个人中心

- 当已登录用户从 `/react/user/profile` 或 `/vue/user/profile` 发起绑定。
- 则客户端必须提交安全站内相对目标，Provider 回调必须最终返回原应用个人中心，且前缀只处理一次。
- 并且后端必须继续拒绝任意绝对地址、协议相对地址、反斜杠、控制字符及解码后可越界的目标。

#### 场景：非法或缺省回跳

- 当用户提供外部地址、编码后外部地址或格式无效的 redirect。
- 则客户端与服务端必须拒绝该目标并保留可诊断错误，必须 不进行外部导航或静默成功。
- 并且只有未提供目标时必须使用 `/index` 作为合法默认，并经当前应用 Router base 导航。

### 要求：OAuth callback 入口由受控部署映射决定

双端共用认证客户端时，服务端必须按受控部署 base 到 callback path 的映射选择入口，按路径段边界最长匹配安全 redirect；不得从用户输入选择外部 origin。映射非空但目标不匹配时必须在授权前明确失败，不能静默进入另一个管理端。单端配置继续使用受控 `frontendCallbackPath`。

客户端未提供目标时先按当前应用 base 生成站内 `/index` 目标；后端只有单端配置或受控根映射时才能直接使用缺省 `/index`。双端映射不含根路径且请求缺少目标时，必须明确拒绝无法识别的应用来源，不擅自选端。

#### 场景：无法识别来源的多端失败回调

- 当Provider 失败或 state 无效且无法安全确定来源应用时
- 则系统必须返回脱敏的明确错误，不猜测 callback 地址、不再次消费 state
- 并且日志与公开 URL/响应不得包含 Provider 原始错误或秘密

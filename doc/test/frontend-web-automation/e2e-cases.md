# 管理端浏览器自动化测试用例设计

## 目标

本文件定义 `react`、`react-pro`、`vue` 三个 PC 管理端共用的浏览器自动化用例。三端必须复用同一业务用例、同一路由来源和同一断言语义；框架与组件库导致的 DOM、布局或视觉细节差异允许存在，但不能改变业务步骤、权限判断、数据策略和失败门禁。

## 执行入口

真实验证码登录和动态路由 smoke 使用仓库 runner：

```bash
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react --route-limit 1
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react-pro --route-limit 1
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

完整矩阵来自后端菜单、三端页面组件和已有测试文件：

```bash
node .codex/skills/infoq-admin-e2e/scripts/generate-case-matrix.mjs
node .codex/skills/infoq-admin-e2e/scripts/validate-case-matrix.mjs doc/test/frontend-web-automation/case-matrix.json
```

## 统一浏览器用例

| 用例 ID | 客户端 | 类型 | 路由/模块 | 前置条件 | 步骤 | 断言 | 数据与 cleanup | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WEB-AUTH-LOGIN-SMOKE | react, react-pro, vue | P0 smoke | /login | 前端已启动，后端 /auth/code 可用 | 打开登录页；加载验证码；通过真实验证码登录入口获取 token；确认登录后可进入首页 | 登录页首屏可渲染；验证码接口真实调用；登录失败时错误可见；成功后不误跳 401/404；无 pageerror 和默认 console error | 只读，无业务数据 cleanup | screenshot、console、captcha attempt、report |
| WEB-HOME-INDEX-SMOKE | react, react-pro, vue | P0 smoke | /index | 已通过真实验证码登录；Admin-Token 写入浏览器存储 | 打开 /index；等待动态菜单和首页内容渲染 | 首页可见；用户信息接口和菜单接口成功；不出现空白页；不误跳登录页、401 或 404 | 只读，无业务数据 cleanup | screenshot、console、route report |
| WEB-DYNAMIC-ROUTE-SMOKE | react, react-pro, vue | P0/P1 route | case-matrix.json 中所有非参数化只读路由 | 已通过真实验证码登录；后端 /system/menu/getRouters 可用 | 从后端读取动态路由；按矩阵逐条打开路由；等待页面首屏 | 页面非空；路由与菜单组件可匹配；无 pageerror；默认不允许 console error；失败时报告 client、route、component | 只读；跳过需要业务 ID 的参数化路由，除非提供隔离 fixture | 每路由 screenshot、console、report.json |
| WEB-SYSTEM-USER-READONLY | react, react-pro, vue | P1 readonly | /system/user | 账号具备用户查询权限；共享环境禁止写入 | 打开用户管理；执行查询；执行重置；切换分页或每页条数；查看权限按钮状态 | 查询请求参数符合表单；重置恢复默认条件；分页状态和表格数据一致；新增/编辑/删除/导入按钮只校验可见性，不点击写入动作 | 只读，不创建用户；无需 cleanup | screenshot、console、clicked-elements 或 blocker |
| WEB-SYSTEM-ROLE-READONLY | react, react-pro, vue | P1 readonly | /system/role | 账号具备角色查询权限 | 打开角色管理；执行查询/重置；打开分配用户入口但不提交；检查角色权限按钮 | 列表渲染稳定；分配用户入口可打开或跳转；未提交授权动作；权限按钮与当前账号权限一致 | 只读；禁止分配或取消分配用户；无需 cleanup | screenshot、console、clicked-elements 或 blocker |
| WEB-SYSTEM-DICT-READONLY | react, react-pro, vue | P1 readonly | /system/dict | 账号具备字典查询权限 | 打开字典管理；查询字典名称或类型；重置；进入字典数据入口 | 查询/重置行为一致；字典数据入口可达；不误跳 401/404 | 只读；不新增、不修改字典 | screenshot、console、route report |
| WEB-PERMISSION-BUTTONS | react, react-pro, vue | P1 permission | 用户、角色、菜单、部门、字典、参数、公告、OSS、定时任务 | 使用具备标准权限的账号和可选低权限账号 | 在目标模块读取权限码；检查查询、新增、编辑、删除、导出等按钮显示隐藏；低权限账号不得出现越权入口 | 按钮可见性符合后端权限；无越权按钮；隐藏按钮不可通过 UI 触发 | 只读；不点击写入或危险动作 | screenshot、console、permission summary |
| WEB-CRUD-GATED | react, react-pro, vue | P2 CRUD gated | 写入型矩阵用例 | 仅隔离环境或明确授权；测试数据使用 e2e_ 前缀；cleanup 已定义 | 创建 e2e_ 数据；修改该数据；删除或恢复；失败时执行 cleanup | 成功路径数据状态正确；失败提示明确；cleanup 成功；cleanup 失败时本用例失败 | 必须记录创建数据、唯一键、清理结果和人工回滚建议 | screenshot、console、created-data、cleanup report |

## 矩阵映射

`case-matrix.json` 是具体路由级用例清单。每条矩阵用例必须包含 `clients`、`routePath`、`component`、`priority`、`automationType`、`sideEffect`、`steps`、`assertions`、`testData` 和 `cleanup`。三端业务逻辑一致性以同一 `moduleKey` 和同一 `routePath` 为准；若某端组件路径不同，例如 React Pro 登录页位于 `user/login/index`，生成器只能通过客户端组件别名适配，不能拆成不同业务用例。

## 可视化执行

当前 runner 支持 `--headed` 用于可视化观察；截图、console 和 route report 是默认必需证据。`--slow-ms`、trace、video 和 clicked-elements 属于后续 runner 增强项，未实现前必须在报告中记录 blocker，不能把缺失证据标记为已通过。

## 失败门禁

以下情况必须失败：真实验证码登录失败、后端路由接口失败、页面空白、误跳登录页/401/404、pageerror、默认 console error、截图或 console 证据缺失、状态文件缺失、owned 进程未收口、写入型用例未声明 `e2e_` 数据与 cleanup、cleanup 失败。

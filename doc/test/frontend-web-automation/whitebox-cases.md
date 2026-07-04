# 管理端统一白盒测试用例设计

## 目标

本文件定义 `react`、`react-pro`、`vue` 三个管理端的统一白盒测试用例口径。白盒测试覆盖源码层行为，不替代浏览器 E2E；浏览器 E2E 也不得替代缺失的白盒断言。

## 客户端与命令基线

| client | 工作区 | 测试命令 | coverage | lint | build |
| --- | --- | --- | --- | --- | --- |
| `react` | `infoq-scaffold-frontend-react` | `pnpm --dir infoq-scaffold-frontend-react run test` | `pnpm --dir infoq-scaffold-frontend-react run test:coverage` | `pnpm --dir infoq-scaffold-frontend-react run lint` | `pnpm --dir infoq-scaffold-frontend-react run build:prod` |
| `react-pro` | `infoq-scaffold-frontend-react-pro` | `pnpm --dir infoq-scaffold-frontend-react-pro run test` | `pnpm --dir infoq-scaffold-frontend-react-pro run test:coverage` | `pnpm --dir infoq-scaffold-frontend-react-pro run lint` | `pnpm --dir infoq-scaffold-frontend-react-pro run build` |
| `vue` | `infoq-scaffold-frontend-vue` | `pnpm --dir infoq-scaffold-frontend-vue run test:unit` | `pnpm --dir infoq-scaffold-frontend-vue run test:unit:coverage` | `pnpm --dir infoq-scaffold-frontend-vue run lint:eslint` | `pnpm --dir infoq-scaffold-frontend-vue run build:prod` |

## 分层用例

### 纯逻辑单测

覆盖请求封装、token 注入、错误码处理、动态路由转换、权限码判断、字典转换、日期/金额格式化、下载导出工具、加密解密辅助函数、store/reducer 状态迁移和边界输入。

### 组件单测

覆盖查询表单、列表表格、分页、重置、新增/编辑弹窗、详情抽屉、导入导出按钮、权限按钮显示隐藏、loading、empty、error、disabled、重复提交保护和接口失败提示。

### 模块行为单测

优先模块包括用户、角色、菜单、部门、岗位、字典、参数配置、通知公告、OSS、定时任务、缓存、在线用户、登录日志和操作日志。每个模块至少沉淀一个只读主流程和一个异常分支。

### 异常分支

覆盖接口失败、权限不足、字段缺失、分页为空、删除确认取消、重复提交、导入失败、导出失败、网络超时、后端返回非 200、表单校验失败和空权限菜单。

## 断言规则

断言必须面向业务行为和用户可见结果，不测试组件库内部 DOM 细节。禁止通过弱化断言、放宽 mock、忽略错误日志或伪造成功路径来提高通过率。

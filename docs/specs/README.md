# OpenSpec 真值规范目录

`openspec/specs/` 用于存放仓库中“稳定行为”的当前真值规范。

## 使用准则

- 按业务能力组织规范，不按后端/React/Vue 工作区拆分
- 仅在活跃变更被接受后，才更新真值规范
- 若某项稳定能力还没有真值规范，应先在 active change 中补充 spec delta，再回写到这里
- 要求描述必须具体、可验证、以场景驱动
- 规范中的约束语句统一使用“必须”

## 建议的能力目录

- `auth/`
- `user-management/`
- `menu-permission/`
- `notification/`
- `file-storage/`
- `plugin-governance/`
- `admin-routing/`
- `platform-governance/`

## 当前预置规范

- `auth/spec.md`：认证入口、客户端授权校验、登录后会话引导与欢迎消息
- `user-management/spec.md`：用户信息装载、资料维护、用户管理与导入导出
- `menu-permission/spec.md`：后台菜单树、菜单维护校验与权限标识消费
- `notification/spec.md`：通知公告、实时提醒和管理端 SSE / WebSocket 开关
- `file-storage/spec.md`：OSS 文件管理、私有对象访问策略和头像上传
- `plugin-governance/spec.md`：插件分档、软开关策略、硬删除守则与治理护栏
- `admin-routing/spec.md`：Vue / React 管理端固定路由、动态路由装配与组件映射
- `platform-governance/spec.md`：OpenSpec 分级、影响矩阵、校验器要求与语言规范

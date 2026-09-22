# 管理端 Web 自动化缺口报告

生成时间：2026-09-22T21:44:03.807Z

缺口总数：2

- [react-page-without-menu] message-center/index: React 页面未直接匹配菜单组件
- [vue-view-without-menu] message-center/index: Vue 页面未直接匹配菜单组件

## 安全门禁

- 不自动删除非 e2e_ 数据。
- 不清空日志。
- 不强退非当前 run 创建的 e2e_ 在线会话。
- 不触发定时任务“立即执行”。
- 不触碰真实 OSS 对象上传/删除。
- 对 OSS 对象、日志、在线用户这类场景，缺少隔离 fixture 时记录 blocker，不伪造通过。


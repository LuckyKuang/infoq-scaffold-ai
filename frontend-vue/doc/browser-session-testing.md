# Vue 浏览器会话回归 SOP

触发条件：修改 auth、user store、permission guard、login/OAuth、会话 API、普通 401 或布局实时生命周期。

1. 读取 [数据流](./data-flow.md) 与根 `docs/specs/auth/spec.md`。确认同源 API 前缀、`vue` scope、clientId、CSRF 和受控后端 Origin/cookie 配置。
2. 先跑最小主流程：API GET CSRF→PUT bind→POST restore→DELETE；store 绑定成功后才提交内存 token，bootstrap 按资料→路由顺序完成。
3. 扩展行为边界：绑定/撤销失败、401 匿名与 403/503/网络显式失败、并发去重、logout 后晚到响应不复活、跨 scope/clientId 事件隔离、历史 token/password 清除，以及关闭真实 VueUse 重连/心跳 timer。
   POST 恢复真实 401 后端会清恢复和 CSRF cookie；用真实 HttpOnly cookie jar 断言旧值消失，随后同 tab 的普通或已排队绑定必须重新 GET CSRF 再 PUT 成功。该内存清理须在 API FIFO 内完成，不能依赖更晚的 store catch；403/503 保留有效 cookie/cache，不重试、不转匿名。
4. 定向测试通过后跑 lint、受控隔离 production build、UTF-8 与 diff review。构建 fixture 不是生产凭据验收。
5. 使用 test-cli 在已授权隔离环境核验真实密码登录、OAuth ticket、受保护 DOM、刷新、退出后刷新和实时通道关闭；必须分别覆盖根与子路径。外部 Provider 尚未实测时明确记录。

从仓库根目录执行：

```bash
pnpm --dir frontend-vue exec vitest --config vitest.config.ts --run tests/api/login.test.ts tests/store/user.test.ts
pnpm --dir frontend-vue exec vitest --config vitest.config.ts --run tests/utils/auth.test.ts tests/utils/request.test.ts tests/utils/sse.test.ts tests/utils/websocket.test.ts tests/utils/websocket-lifecycle.test.ts tests/store/permission-store.test.ts tests/permission.guard.test.ts tests/views/login.test.ts tests/views/oauth-callback.test.ts tests/app.test.ts tests/layout/components/Navbar.test.ts
pnpm --dir frontend-vue run lint:eslint
node tools/validate_utf8.mjs frontend-vue
```

反模式：向 localStorage/sessionStorage 播种 `Admin-Token`；为成功而把 503 当匿名；关闭 CSRF；让所有业务接口接受 cookie；在日志/trace/HAR/storageState 输出凭据；只断言 mock close 而不验证重连收口；在 OAuth callback 先恢复旧身份；用单测替代真实浏览器/生产 HTTPS 验收。

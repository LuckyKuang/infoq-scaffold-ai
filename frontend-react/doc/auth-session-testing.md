# React 浏览器会话测试 SOP

触发条件：修改内存token、浏览器恢复资源、登录/OAuth、请求401、路由bootstrap或实时连接生命周期。

1. 读取 `src/api/browser-session.ts`、`src/store/modules/user.ts`、`src/router/AuthGuard.tsx` 与后端实际合同。主流程先验证登录→CSRF→PUT绑定→用户→路由→实时连接；刷新为CSRF→POST恢复，退出为无Bearer的DELETE。
2. 定向行为测试覆盖：旧凭据删除且不加载；绑定失败撤销新Bearer/清理失败可见；401匿名；403/503/网络错误显式重试；StrictMode并发仅一次恢复；logout竞态不复活状态；scope/clientId隔离；实时连接幂等与重连timer关闭。业务/HTTP401均须匹配该请求的Bearer与当前内存token后才清认证，旧请求和无Bearer请求失败仍reject，不得注销新登录；旧重登弹窗完成不得导航走新会话。
3. 使用有状态cookie fixture延迟DELETE（成功和503）响应，再发起真实store新登录，断言新PUT等待DELETE完成、重新GET CSRF、最终新cookie与token均存在。另延迟旧restore401的cookie清理，确认新绑定后执行且旧失败原样reject。专用GET-CSRF→PUT/POST/DELETE完整操作在本tab按FIFO串行，不能只靠generation检查内存。
   POST恢复401会清服务端恢复与CSRF cookie；API必须在该FIFO操作reject之前清内存CSRF，使已排队或之后发起的PUT先GET新CSRF。fixture同时模拟两cookie清除并校验请求header与当前CSRF cookie匹配，否则必须403。恢复403/503不清缓存、不自动重试，不能依赖store catch与下一操作的调度先后修补。
   退出的用户可见完成点必须在DELETE响应之后：pending时立即清本地认证与实时资源，隐藏旧受保护DOM，只显示退出等待状态；不触发bootstrap，也不能提前呈现登录表单让正常立即刷新中断撤销。DELETE失败显示“服务端会话撤销未获确认”与重试退出，不能把失败跳成已完成登录页。相同退出动作复用同一pending promise。
4. 执行lint、UTF-8与受控production build，再检查diff。构建fixture不等于真实认证验收。
5. 运行态由test-cli在隔离环境检查真实登录、受保护DOM、reload、退出后reload、根/子路径与SSE关闭；证据放 `tmp/`，清理owned端口。不得输出密码、Bearer、CSRF、cookie或带token的URL。

```bash
pnpm --dir frontend-react exec vitest --run tests/utils/auth.test.ts tests/api/browser-session.test.ts tests/api/login.test.ts tests/utils/request.test.ts tests/store/user.test.ts tests/router/auth-permission.test.tsx tests/pages/login.test.tsx tests/pages/oauth-callback.test.tsx tests/utils/realtime.test.ts tests/store/permission-store.test.ts
pnpm --dir frontend-react run lint
node tools/validate_utf8.mjs frontend-react
# INFOQ_PRODUCTION_CONFIG_FILE 指向私有受控配置；不打印其内容
pnpm --dir frontend-react run build:prod
```

反模式：用localStorage/sessionStorage注入Admin-Token绕开恢复协议；只看HTTP200忽略业务code；把403/503改成匿名；绑定前提交token；用户/路由完成前建立实时连接；削弱断言或用HTTP替身冒充真实Provider验收。

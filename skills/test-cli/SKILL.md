---
name: test-cli
description: 本仓库 Web 侧自动化测试与前端运行态验证的统一 skill，覆盖通用浏览器流程与 DevTools 诊断、管理端真实验证码登录、动态路由 smoke、case matrix、CRUD E2E、真实页面运维门禁，以及前端单测/coverage/lint/build 与本地栈启停。适用于网页交互、受保护路由验证、浏览器证据采集、管理端 E2E 和前端运行态回归。
---

# InfoQ Web 自动化测试

本技能统一管理 Web 侧测试与运行态验证。后端 smoke、数据运维与容器部署验证不在本技能范围，分别见 `tools/verify/`、`docs/DATA-OPS.md`、`deploy/VERIFICATION.md`。

## 模式选择

1. 通用页面流程、截图、console/pageerror 采集：`references/modes/browser.md`，入口 `scripts/playwright_cli.mjs`。
2. DevTools 深度诊断（Network / Console / Performance）：`scripts/chrome_devtools_cli.mjs`。
3. 受保护管理端路由快速探测：`scripts/admin_route_probe.mjs`；遇到 `captchaEnabled=true` 自动回落 `scripts/captcha_login.mjs`。
4. 真实验证码登录与动态路由矩阵：`scripts/run_admin_e2e.mjs`；矩阵生成与校验用 `scripts/generate-case-matrix.mjs`、`scripts/validate-case-matrix.mjs`。
5. 写入型 CRUD E2E：`scripts/run_admin_crud_e2e.mjs`（`--modules` 缩小范围）。
6. 真实页面运营维护、权限巡检与写入型操作门禁：`references/ops/page-ops-guardrails.md`。
7. 前端单测 / coverage / lint / build 与运行态验证：`references/modes/frontend.md`；本地栈由 `scripts/run_admin_e2e.mjs` 自管，手动启动命令见 `references/runtime/admin-commands.md`。
8. 测试政策、case 集合、选择器与清理策略：`docs/TESTING.md`、`references/matrix/*`、`references/crud/*`。

## 执行顺序

1. 判定范围：确认是页面流程、受保护路由探测、验证码登录、矩阵 smoke、CRUD E2E、页面运维，还是前端单测/构建/本地栈。
2. 只读探测：先 `--list-routes` 或读取配置、package scripts、现有状态文件；不要猜测路由或直接改配置。
3. 最小闭环：先跑单一路由 / 单客户端 / 单模块，再扩展到完整矩阵。
4. 写入门禁：涉及 `.env`、AppID、测试数据、导出、端口或共享环境写入时，先列出目标、影响范围、cleanup 与回滚。
5. 执行验证：检查退出码、截图、console/pageerror、状态文件与 owned 端口收口。
6. 失败处理：浏览器缺失、后端不可达、验证码种子写入失败（Redis 不可达或与后端实例/DB 不一致）、AppID 缺失、console error 与 pageerror 都必须显式失败，禁止伪造通过。

## 默认命令

```bash
node skills/test-cli/scripts/playwright_cli.mjs flow --url "https://example.com" --wait-for-text "Example Domain"
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
# 验证码登录使用 Redis 种子答案；先配置 INFOQ_TEST_REDIS_* 或 --redis-*
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/run_admin_crud_e2e.mjs --client vue --modules notice
node skills/test-cli/scripts/generate-case-matrix.mjs
node skills/test-cli/scripts/validate-case-matrix.mjs docs/testing/case-matrix.json
```

Playwright 依赖安装在 `skills/test-cli/scripts/`（自带 `package.json` / `pnpm-lock.yaml`）：

```bash
pnpm --dir skills/test-cli/scripts install
pnpm --dir skills/test-cli/scripts exec playwright install chromium
```

## 证据目录

- 浏览器流程与 route probe：`tmp/test-cli/browser/`
- E2E 运行与验证码登录：`tmp/test-cli/e2e/`
- E2E 自管栈状态：`tmp/test-cli/e2e/stack/<client>/state.json`
- 页面运维与权限巡检：`tmp/test-cli/e2e/page-ops/`

## 护栏

- 禁止默认关闭验证码、禁止伪造 token 或跳过 `/auth/login`。
- console error、pageerror、真实登录失败、空白截图、状态文件缺失或 owned 端口未收口时，不能标记通过。
- 不对共享环境执行写入型测试；写入型用例必须先列出目标、测试数据、cleanup、权限边界与回滚条件。
- 禁止通过弱化断言、放宽 mock、伪造成功路径来硬凑覆盖率或通过率。
- 当后端路由 API 可查询时，禁止猜测 admin 路由。
- 前端单测与运行态 smoke 不能互相替代；覆盖率不达标不得用运行态结果顶替。
- 页面运维写入前必须列出环境、账号角色、目标 ID、影响范围、cleanup、回滚与验证方式；没有目标集确认时不执行删除、批量、权限或任务启停操作。
- 定时任务启停必须说明任务名称、执行计划、影响窗口与恢复方式；权限变更必须用拥有权限与不应拥有权限的两个角色分别核对。
- 不把 E2E 通过当成真实运营操作完成，也不把接口 smoke 当成后台权限巡检。
- 任何长生命周期进程必须写入 `tmp/test-cli/` 状态文件，并在完成、失败或中断后关闭 owned 端口。

## 参考

- 浏览器模式 SOP：`references/modes/browser.md`
- 管理端 E2E SOP：`references/modes/e2e.md`
- 前端验证 SOP：`references/modes/frontend.md`
- 页面运维门禁：`references/ops/page-ops-guardrails.md`
- 矩阵 schema 与路由来源：`references/matrix/`（`case-schema.md`、`module-taxonomy.md`、`route-source-rules.md`）
- 验证码场景矩阵：`references/captcha/scenario-matrix.md`
- CRUD 模式、测试数据、清理与选择器策略：`references/crud/`（`crud-patterns.md`、`test-data-policy.md`、`cleanup-policy.md`、`selector-policy.md`）
- 前端单测与运行态命令：`references/runtime/admin-commands.md`
- React admin 单测：`references/react/unit/admin/`（`commands.md`、`mock-patterns.md`、`priority-matrix.md`、`setup-baseline.md`）
- Vue admin 单测：`references/vue/unit/admin/`（`commands.md`、`mock-patterns.md`、`priority-matrix.md`、`setup-baseline.md`）
- 测试政策：`docs/TESTING.md`

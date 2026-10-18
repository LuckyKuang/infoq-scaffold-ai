# 管理端 E2E 模式（test-cli / e2e）

# InfoQ 管理端 E2E

本技能只负责一件事：管理端浏览器 E2E 的范围建模、真实登录 smoke 和写入型模式设计。它是领域型 SOP，不是通用浏览器工具；浏览器底层执行仍交给 `test-cli` 或本 skill 自带脚本。

## 模式选择

1. 生成或校验管理端 Web 自动化测试矩阵，使用 `generate-case-matrix.mjs` 和 `validate-case-matrix.mjs`。
2. 不关闭验证码、通过 `/auth/code` + Redis 种子答案 + `/auth/login` 获取真实 token，使用共享入口 `captcha_login.mjs`；需要继续巡检动态路由时使用 `run_admin_e2e.mjs`。
3. 执行公告等写入型 CRUD E2E 时，读取 `references/crud/*` 并使用 `run_admin_crud_e2e.mjs`（可用 `--modules notice` 等参数缩小模块范围）。
4. 通用浏览器执行器仍使用 `test-cli`；本 skill 负责业务范围和管理端专属流程。
5. 用户、角色、菜单、部门、岗位、字典、参数、公告、OSS、定时任务等后台模块的真实页面运营维护、权限按钮巡检和写入型操作门禁，读取 `references/ops/page-ops-guardrails.md`；数据库侧修复转交 `docs/DATA-OPS.md`，后端接口验证转交 `tools/verify`。

## 执行顺序

1. 判定范围：先确认本次是矩阵、验证码 smoke、只读路由巡检，还是写入型 CRUD 模式设计。
2. 只读优先：先读取/校验已有矩阵，或把新矩阵输出到 `tmp/test-cli/matrix-preview`；验证码登录与路由 smoke 虽不改业务表，仍会写 Redis、会话及登录记录，必须限定在已授权测试环境。
3. 目标枚举：涉及 CRUD、批量、删除、导出、权限按钮或 cleanup 时，先列出模块、目标数据、账号角色、影响范围和回滚/清理方式。
4. 门禁确认：共享环境默认禁止写入型 E2E；确需写入时必须有测试数据隔离、cleanup 策略和危险动作门禁。
5. 执行验证：运行后检查退出码、截图、console/pageerror、路由结果和状态文件，不用口头判断代替证据。
6. 收口：完成、失败或中断后关闭本 skill 启动的栈，并保留 `tmp/test-cli/e2e/` 证据。

## 默认命令

生成矩阵：

```bash
node skills/test-cli/scripts/generate-case-matrix.mjs
node skills/test-cli/scripts/validate-case-matrix.mjs docs/testing/case-matrix.json
```

验证码 E2E：

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue
node skills/test-cli/scripts/run_admin_e2e.mjs --client react
```

全模块 CRUD E2E（仅接受 `--profile local`，其他 profile 在执行前失败；必须确认 `application-local.yml` 指向已授权的隔离测试数据库。默认覆盖 `role,user,menu,dept,post,dict,config,notice,client,invite,ossConfig,job,online`，使用 `e2e_` 隔离数据并执行 cleanup）：

```bash
node skills/test-cli/scripts/run_admin_crud_e2e.mjs --client vue
node skills/test-cli/scripts/run_admin_crud_e2e.mjs --client react
```

可用 `--modules role,user`（如仅公告模块用 `--modules notice`）缩小模块范围；报告会同时输出高副作用安全门禁：不删除非 `e2e_` 数据、不清空日志、不触发定时任务“立即执行”、不触碰真实 OSS 对象上传/删除。在线强退只允许对当前 run 创建的 `e2e_` 用户会话执行；缺少隔离 fixture 时记录 blocker，不伪造通过。

仅验证验证码种子登录并输出脱敏摘要：

```bash
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --json
```

`captcha_login.mjs` 是 `/auth/code` + Redis 种子答案 + 加密 `/auth/login` 的共享入口，`run_admin_e2e.mjs` 与 `test-cli` 的 `admin-route-probe` 都直接复用它。种子模式要求测试进程与后端使用同一个 Redis 实例/DB，通过 `INFOQ_TEST_REDIS_HOST`、`INFOQ_TEST_REDIS_PORT`、`INFOQ_TEST_REDIS_DATABASE`、`INFOQ_TEST_REDIS_PASSWORD` 或对应 `--redis-*` 参数提供连接；禁止指向生产 Redis。证据默认写入 `tmp/test-cli/e2e/captcha-login/<run-id>/`。

CRUD 的 API、浏览器和 JDBC 只读核对必须指向同一测试实例；使用 `--no-start-stack` 或覆盖 URL 时尤其要核对 `application-local.yml` 的数据库。该 runner 依赖 PATH 中的 JDK 21（`java` / `javac`）和 `~/.m2/repository` 中的 MySQL Connector/J；其简化配置解析器不能展开任意 Spring env 占位符或识别运行实例的配置覆盖。缺少依赖或目标无法一致确认时停止。登录证据含敏感测试信息，不上传到共享日志或提交到仓库；token 不进入 stdout 或浏览器存储，内部通过受保护同源资源建立 HttpOnly 会话。

`run_admin_e2e.mjs` 默认只使用有管理端动态菜单的 route smoke 候选账号（`admin`、`dept`）；`captcha_login.mjs` 可继续通过 `--login-candidates` 做独立账号登录诊断。不要把无动态路由权限的账号作为 route smoke 默认候选，否则会出现登录成功但无路由可巡检的假失败。

`run_admin_e2e.mjs` 默认会在完成、失败或中断后停止本 skill 启动的 backend/admin dev server；只有验证及报告落盘均成功且显式传 `--keep-stack-after` 才保留联调栈，落盘失败或中断须撤销保留决定并收口。栈状态按 client 稳定记录在 `tmp/test-cli/e2e/stack/<vue|react>/state.json`，必须包含 pid、port、log、owned/reused 和 `running`/`stopped`/`failed`/`interrupted` 状态。

`run_admin_crud_e2e.mjs` 会启动或复用 backend + 指定管理端、通过验证码种子登录，写入前查询所选模块精确键，拒绝冲突或查询失败。它按模块顺序执行 UI 新增/查询/编辑/删除，并对 API 与 MySQL 直连结果断言活动记录数、关键字段和主键；在线用户模块创建本轮专属 `e2e_` 用户、真实登录生成会话，只强退该会话后清理用户。

正常、普通异常及 SIGINT/SIGTERM/SIGHUP 均尝试当前 run 数据清理（独立 30 秒预算），再关闭 owned 栈并落盘报告；DB 错误/未执行时残留为未知，不能算零。检查 `verification`、`cleanup.finalDb`、`cleanupErrors` 和浏览器 `browser-state.json`。硬终止、清理超时、账号候选、RSA 和实例一致性等条件见 `docs/TESTING.md` 第 6.6 节，工具隔离回归不能代替真实业务验收。

只跑少量路由：

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

当前 runner 从实时 `/system/menu/getRouters` 选择路由，尚未读取 `case-matrix.json`。固定入口、浏览器登录表单、权限角色矩阵、空白/错误页 DOM 等仍需额外业务断言；不能把动态路由 smoke 成功当作完整矩阵通过。详见 `docs/TESTING.md` 第 6.5 节。

## 证据目录

E2E 运行默认写入：

```text
tmp/test-cli/e2e/<run-id>/
```

真实页面运维与权限巡检证据写入 `tmp/test-cli/e2e/page-ops/`，不得散落到仓库其他路径。

## 护栏

- 禁止默认关闭验证码。
- 禁止伪造 token 或跳过 `/auth/login`。
- 不对共享环境执行写入型测试。
- 写入型用例必须先列出目标、测试数据、cleanup、权限边界和回滚条件。
- `console error`、`pageerror`、真实登录失败、状态文件缺失或 owned 端口未收口时，不能标记 E2E 通过。
- 页面运维写入前必须列出环境、账号角色、目标 ID、影响范围、cleanup、回滚和验证方式；没有目标集确认时不执行删除、批量、权限或任务启停操作。
- 定时任务启停必须说明任务名称、执行计划、影响窗口和恢复方式；权限变更必须用拥有权限与不应拥有权限的两个角色分别核对。
- 不把 E2E 通过当成真实运营操作完成，也不把后端接口 smoke 当成后台权限巡检；两者都必须有对应的只读核对证据。

## 参考

- 矩阵 schema：`references/matrix/case-schema.md`
- 路由来源规则：`references/matrix/route-source-rules.md`
- 验证码场景矩阵：`references/captcha/scenario-matrix.md`
- CRUD 模式：`references/crud/crud-patterns.md`
- 测试数据策略：`references/crud/test-data-policy.md`
- 清理策略：`references/crud/cleanup-policy.md`
- 选择器策略：`references/crud/selector-policy.md`
- 页面运维与权限巡检门禁：`references/ops/page-ops-guardrails.md`

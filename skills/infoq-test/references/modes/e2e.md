# 管理端 E2E 模式（infoq-test / e2e）

# InfoQ 管理端 E2E

本技能只负责一件事：管理端浏览器 E2E 的范围建模、真实登录 smoke 和写入型模式设计。它是领域型 SOP，不是通用浏览器工具；浏览器底层执行仍交给 `infoq-test` 或本 skill 自带脚本。

## 模式选择

1. 生成或校验管理端 Web 自动化测试矩阵，使用 `generate-case-matrix.mjs` 和 `validate-case-matrix.mjs`。
2. 不关闭验证码、通过 `/auth/code` + OCR + `/auth/login` 获取真实 token，使用共享入口 `captcha_login.mjs`；需要继续巡检动态路由时使用 `run_admin_e2e.mjs`。
3. 执行公告等写入型 CRUD E2E 时，读取 `references/crud/*` 并使用 `run_admin_crud_e2e.mjs`（可用 `--modules notice` 等参数缩小模块范围）。
4. 通用浏览器执行器仍使用 `infoq-test`；本 skill 负责业务范围和管理端专属流程。
5. 用户、角色、菜单、部门、岗位、字典、参数、公告、OSS、定时任务等后台模块的真实页面运营维护、权限按钮巡检和写入型操作门禁，读取 `references/ops/page-ops-guardrails.md`；数据库侧修复转交 `docs/DATA-OPS.md`，后端接口验证转交 `tools/verify`。

## 执行顺序

1. 判定范围：先确认本次是矩阵、真实验证码 smoke、只读路由巡检，还是写入型 CRUD 模式设计。
2. 只读优先：先生成/校验矩阵，或用真实登录 smoke 只巡检路由；不要从写入型 case 开始。
3. 目标枚举：涉及 CRUD、批量、删除、导出、权限按钮或 cleanup 时，先列出模块、目标数据、账号角色、影响范围和回滚/清理方式。
4. 门禁确认：共享环境默认禁止写入型 E2E；确需写入时必须有测试数据隔离、cleanup 策略和危险动作门禁。
5. 执行验证：运行后检查退出码、截图、console/pageerror、路由结果和状态文件，不用口头判断代替证据。
6. 收口：完成、失败或中断后关闭本 skill 启动的栈，并保留 `tmp/infoq-test/e2e/` 证据。

## 默认命令

生成矩阵：

```bash
node skills/infoq-test/scripts/generate-case-matrix.mjs
node skills/infoq-test/scripts/validate-case-matrix.mjs docs/testing/case-matrix.json
```

真实验证码 E2E：

```bash
node skills/infoq-test/scripts/run_admin_e2e.mjs --client vue
node skills/infoq-test/scripts/run_admin_e2e.mjs --client react
```

全模块 CRUD E2E（仅限 `application-local.yml` 指向且已授权的测试数据库；默认覆盖 `role,user,menu,dept,post,dict,config,notice,client,invite,ossConfig,job,online`，使用 `e2e_` 隔离数据并自动 cleanup）：

```bash
node skills/infoq-test/scripts/run_admin_crud_e2e.mjs --client vue
node skills/infoq-test/scripts/run_admin_crud_e2e.mjs --client react
```

可用 `--modules role,user`（如仅公告模块用 `--modules notice`）缩小模块范围；报告会同时输出高副作用安全门禁：不删除非 `e2e_` 数据、不清空日志、不触发定时任务“立即执行”、不触碰真实 OSS 对象上传/删除。在线强退只允许对当前 run 创建的 `e2e_` 用户会话执行；缺少隔离 fixture 时记录 blocker，不伪造通过。

仅获取真实验证码登录 token：

```bash
node skills/infoq-test/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
```

`captcha_login.mjs` 是 `/auth/code` + `ddddocr` + 算术验证码归一化 + 加密 `/auth/login` 的共享入口，`run_admin_e2e.mjs` 与 `infoq-test` 的 `admin-route-probe` 验证码 fallback 都复用它。证据默认写入 `tmp/infoq-test/e2e/captcha-login/<run-id>/`。

`run_admin_e2e.mjs` 默认只使用有管理端动态菜单的 route smoke 候选账号（`admin`、`dept`）；`captcha_login.mjs` 可继续通过 `--login-candidates` 做独立账号登录诊断。不要把无动态路由权限的账号作为 route smoke 默认候选，否则会出现登录成功但无路由可巡检的假失败。

`run_admin_e2e.mjs` 默认会在完成、失败或中断后停止本 skill 启动的 backend/admin dev server；只有成功且显式传 `--keep-stack-after` 才保留联调栈，失败或中断仍必须收口。栈状态按 client 稳定记录在 `tmp/infoq-test/e2e/stack/<vue|react>/state.json`，必须包含 pid、port、log、owned/reused 和 `running`/`stopped`/`failed`/`interrupted` 状态。

`run_admin_crud_e2e.mjs` 会启动或复用 backend + 指定管理端、通过真实验证码登录，按安全模块顺序执行 UI 新增/查询/编辑/删除或模块可用的行删除/选择删除入口，并用 API 与 MySQL 直连只读查询核对 create/edit/delete；在线用户模块会创建本轮专属 `e2e_` 用户、真实登录生成会话，只强退该会话后清理用户。它只清理当前 run 创建的精确 `e2e_` 数据，不删除内置 admin、默认角色、默认菜单、默认部门、默认配置或非本轮数据；失败、中断和完成后都会收口 owned 栈并保留 `report.md`、`report.json`、`module-matrix.json`、截图、console 和 cleanup 结果。

只跑少量路由：

```bash
node skills/infoq-test/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

## 证据目录

E2E 运行默认写入：

```text
tmp/infoq-test/e2e/<run-id>/
```

真实页面运维与权限巡检证据写入 `tmp/infoq-test/e2e/page-ops/`，不得散落到仓库其他路径。

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
- 真实验证码场景矩阵：`references/captcha/scenario-matrix.md`
- CRUD 模式：`references/crud/crud-patterns.md`
- 测试数据策略：`references/crud/test-data-policy.md`
- 清理策略：`references/crud/cleanup-policy.md`
- 选择器策略：`references/crud/selector-policy.md`
- 页面运维与权限巡检门禁：`references/ops/page-ops-guardrails.md`

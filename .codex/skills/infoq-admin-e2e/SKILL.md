---
name: infoq-admin-e2e
description: 维护并执行本仓库 React/Vue 管理端 E2E 自动化，覆盖测试矩阵生成、真实图形验证码登录、动态路由只读 smoke、CRUD 模式设计、测试数据、cleanup、权限按钮断言和危险动作门禁。
---

# InfoQ 管理端 E2E

本技能只负责一件事：管理端浏览器 E2E 的范围建模、真实登录 smoke 和写入型模式设计。它是领域型 SOP，不是通用浏览器工具；浏览器底层执行仍交给 `infoq-browser-automate` 或本 skill 自带脚本。

## 模式选择

1. 生成或校验管理端 Web 自动化测试矩阵，使用 `generate-case-matrix.mjs` 和 `validate-case-matrix.mjs`。
2. 不关闭验证码、通过 `/auth/code` + OCR + `/auth/login` 完成真实登录并巡检动态路由，使用 `run_admin_e2e.mjs`。
3. 设计用户、角色、菜单、部门、字典、配置、公告、OSS、定时任务等 CRUD E2E 时，读取 `references/crud/*`。
4. 通用浏览器执行器仍使用 `infoq-browser-automate`；本 skill 负责业务范围和管理端专属流程。

## 执行顺序

1. 判定范围：先确认本次是矩阵、真实验证码 smoke、只读路由巡检，还是写入型 CRUD 模式设计。
2. 只读优先：先生成/校验矩阵，或用真实登录 smoke 只巡检路由；不要从写入型 case 开始。
3. 目标枚举：涉及 CRUD、批量、删除、导出、权限按钮或 cleanup 时，先列出模块、目标数据、账号角色、影响范围和回滚/清理方式。
4. 门禁确认：共享环境默认禁止写入型 E2E；确需写入时必须有测试数据隔离、cleanup 策略和危险动作门禁。
5. 执行验证：运行后检查退出码、截图、console/pageerror、路由结果和状态文件，不用口头判断代替证据。
6. 收口：完成、失败或中断后关闭本 skill 启动的栈，并保留 `doc/tmp/infoq-admin-e2e/` 证据。

## 默认命令

生成矩阵：

```bash
node .codex/skills/infoq-admin-e2e/scripts/generate-case-matrix.mjs
node .codex/skills/infoq-admin-e2e/scripts/validate-case-matrix.mjs doc/test/frontend-web-automation/case-matrix.json
```

真实验证码 E2E：

```bash
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react
```

`run_admin_e2e.mjs` 默认会在完成、失败或中断后停止本 skill 启动的 backend/admin dev server；只有成功且显式传 `--keep-stack-after` 才保留联调栈，失败或中断仍必须收口。栈状态按 client 稳定记录在 `doc/tmp/infoq-admin-e2e/stack/<vue|react>/state.json`，必须包含 pid、port、log、owned/reused 和 `running`/`stopped`/`failed`/`interrupted` 状态。

只跑少量路由：

```bash
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

## 证据目录

默认写入：

```text
doc/tmp/infoq-admin-e2e/<run-id>/
```

## 护栏

- 禁止默认关闭验证码。
- 禁止伪造 token 或跳过 `/auth/login`。
- 不对共享环境执行写入型测试。
- 写入型用例必须先列出目标、测试数据、cleanup、权限边界和回滚条件。
- `console error`、`pageerror`、真实登录失败、状态文件缺失或 owned 端口未收口时，不能标记 E2E 通过。

## 参考

- 矩阵 schema：`references/matrix/case-schema.md`
- 路由来源规则：`references/matrix/route-source-rules.md`
- 真实验证码场景矩阵：`references/captcha/scenario-matrix.md`
- CRUD 模式：`references/crud/crud-patterns.md`
- 测试数据策略：`references/crud/test-data-policy.md`
- 清理策略：`references/crud/cleanup-policy.md`
- 选择器策略：`references/crud/selector-policy.md`

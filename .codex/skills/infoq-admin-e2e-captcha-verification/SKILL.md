---
name: infoq-admin-e2e-captcha-verification
description: 使用真实图形验证码执行本项目管理端 E2E smoke。适用于需要启动或复用 backend + Vue/React admin，通过 ddddocr 识别 `/auth/code` 验证码、真实调用 `/auth/login`，再按动态菜单路由逐模块巡检并留存截图、console 和报告的场景。
---

# InfoQ 管理端真实验证码 E2E

本技能只负责一件事：在不关闭验证码的前提下，完成 admin 管理端真实登录和动态路由 smoke。

## 适用场景

- 用户要求验证登录验证码环节，而不是跳过或关闭验证码。
- 用户要求启动后端、启动前端、自动登录系统并逐模块测试。
- 需要为 React admin 或 Vue admin 留存运行态截图、console、验证码和报告证据。

## 默认命令

Vue admin：

```bash
node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client vue
```

React admin：

```bash
node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client react
```

只跑少量路由验证脚本和环境：

```bash
node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

## 前置条件

1. 后端依赖的 MySQL、Redis、MinIO 等本地环境必须可用。
2. Python 3 必须可用，且能 import `ddddocr`。
3. 浏览器自动化依赖来自 `infoq-browser-automation`：

```bash
pnpm --dir .codex/skills/infoq-browser-automation/scripts install
pnpm --dir .codex/skills/infoq-browser-automation/scripts exec playwright install chromium
```

4. 若缺少 `ddddocr`，先在你选择的 Python 环境安装：

```bash
python3 -m pip install ddddocr
```

不要在脚本里静默联网安装 OCR 依赖；缺失时应显式失败。

## 工作流

1. 解析 `--client react|vue`，选择对应 admin dev stack。
2. 启动或复用后端与前端，默认不传 `--captcha.enable=false`。
3. 调用 `GET /auth/code`，保存验证码图片和接口摘要到 `doc/tmp/`。
4. 由 Node 调度 `scripts/ocr_captcha.py`，用 `ddddocr` 识别验证码。
5. 带 `code + uuid + clientId + grantType=password` 调用加密 `/auth/login`。
6. 登录成功后请求 `/system/user/getInfo` 和 `/system/menu/getRouters`。
7. 从动态菜单生成路由清单，按清单打开前端路由并注入 `Admin-Token`。
8. 每个路由保存截图和 console 记录；console error、pageerror、路由访问异常均视为失败。
9. 输出 `report.json` 和 `report.md`。

## 关键参数

- `--client vue|react`：必填，选择管理端。
- `--backend-url <url>`：复用已有后端时指定，默认 `http://127.0.0.1:8080`。
- `--frontend-origin <url>`：复用已有前端时指定；未指定时按 client 使用默认端口。
- `--start-stack`：启动或复用对应 backend + frontend dev stack，默认开启。
- `--no-start-stack`：只使用已有服务。
- `--build-backend`：启动前构建后端 jar。
- `--force-restart`：重启本 skill 关联的 dev stack。
- `--profile <name>`：Spring profile，默认 `dev`。
- `--username <name>` / `--password <pwd>`：指定首选账号。
- `--login-candidates <csv>`：候选账号，默认 `admin:admin123,dept:666666,owner:666666,admin:123456`。
- `--max-captcha-attempts <n>`：验证码识别和登录重试次数，默认 `3`。
- `--route-limit <n>`：限制巡检路由数量，适合调试。
- `--include-route <pattern>`：只巡检匹配的路由，可重复。
- `--exclude-route <pattern>`：排除匹配路由，可重复。
- `--headed`：显示浏览器。
- `--allow-console-errors`：只用于临时诊断；默认 console error 会失败。

## 证据目录

默认目录：

```text
doc/tmp/infoq-admin-e2e-captcha-verification/<run-id>/
```

关键文件：

- `captcha/*.png`：验证码原图。
- `captcha/*.json`：OCR 文本和登录响应摘要。
- `routes.json`：动态路由列表。
- `screenshots/*.png`：页面截图。
- `console/*.json`：console 和 pageerror 记录。
- `report.json` / `report.md`：最终报告。

## 场景矩阵

本轮默认场景是动态路由只读 smoke。模块级 CRUD、导出、批量操作、权限边界和数据清理策略见 `references/scenario-matrix.md`，默认不执行。

## 护栏

- 禁止自动关闭验证码或切换到 `--captcha.enable=false`。
- 禁止伪造 token 或跳过 `/auth/login`。
- OCR、登录或路由巡检失败时必须显式失败。
- 临时产物不得写到 `doc/tmp/` 之外。
- 不修改产品代码以适配测试。
- 不对共享环境执行写入型测试。

---
name: infoq-login-success-check
description: 对本项目后端执行可确定的登录成功校验，覆盖加密/明文 `/auth/login` 回退、token 校验与受保护接口检查；默认不关闭验证码，显式 `--allow-captcha-disabled` 仅用于快速诊断。适用于登录成功验证、登录接口验证、auth/login 排查、登录冒烟与登录失败诊断场景。
---

# Infoq 登录成功校验

## 执行

对本地后端执行登录校验：

```bash
node .codex/skills/infoq-login-success-check/scripts/verify_login.mjs
```

默认要求目标后端可以直接完成登录校验；若 `/auth/code` 返回 `captchaEnabled=true`，脚本会失败并引导使用真实验证码 E2E。

常用变体：

```bash
# 仅快速诊断：显式启动或复用关闭验证码的临时后端
node .codex/skills/infoq-login-success-check/scripts/verify_login.mjs --allow-captcha-disabled --temp-port 18081

# 如果显式临时后端需要构建 jar，先构建后启动
node .codex/skills/infoq-login-success-check/scripts/verify_login.mjs --allow-captcha-disabled --build

# 指定账号
node .codex/skills/infoq-login-success-check/scripts/verify_login.mjs \
  --username admin \
  --password admin123

# 为浏览器自动化打印 token
node .codex/skills/infoq-login-success-check/scripts/verify_login.mjs --print-token

# 通过显式快速诊断路径打印 token
node .codex/skills/infoq-login-success-check/scripts/verify_login.mjs --print-token --allow-captcha-disabled
```

## 行为说明

- 优先检查 `http://127.0.0.1:8080` 的现有后端。
- 默认遇到后端不可达，或 `captchaEnabled=true`，必须显式失败，不再自动关闭验证码。
- 如需快速诊断 token、加密登录或受保护接口，可显式传 `--allow-captcha-disabled`，脚本才会以 `local` profile + `--captcha.enable=false` 启动临时后端（默认端口 `18081`）。
- 如需验证真实验证码、OCR、前端登录态和动态路由 smoke，使用 `infoq-admin-e2e-captcha-verification`。
- 先尝试加密模式 `/auth/login`，失败后回退明文模式。
- 通过以下接口确认 token 有效性：
  - `GET /system/user/getInfo`
  - `GET /system/menu/getRouters`
- 本仓库默认基线是 Redisson OSS。若加密登录返回 `This feature is implemented in the Redisson PRO version`，应视为业务代码违规使用 PRO-only API，而不是环境噪声。

## 默认值

- Spring profile：`local`
- Client ID：`e5cd7e4891bf95d1d19206ce24a7b32e`
- 登录候选账号：
  - `admin / admin123`
  - `dept / 666666`
  - `owner / 666666`
  - `admin / 123456`

## 参考资源

- 主入口脚本：`scripts/verify_login.mjs`
- API 逻辑：`scripts/login_check.mjs`
- 接口说明：`references/endpoints.md`

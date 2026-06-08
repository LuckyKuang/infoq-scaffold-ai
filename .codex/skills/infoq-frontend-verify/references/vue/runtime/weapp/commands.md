# Weapp 命令

## AppID 前置条件

执行任何 DevTools 打开命令前，先将 `infoq-scaffold-frontend-weapp-vue/.env.development` 中的 `TARO_APP_ID` 替换为你自己的微信小程序 AppID。  
启动脚本会拒绝空值与 `touristappid`。

## 精确 DevTools 打开命令

```bash
pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev
```

## 可选 Shell 覆盖

```bash
TARO_APP_ID=wx_your_appid pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev
```

## 默认完整冒烟

```bash
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue
```

## 核心冒烟

```bash
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue --suite core
```

## 复用已有会话

```bash
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue --keep-existing-session
```

## 启用微信合法域名校验

```bash
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue --url-check
```

## 显式指定后端登录目标

```bash
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue \
  --base-url http://127.0.0.1:8080 \
  --username admin \
  --password admin123
```

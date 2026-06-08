---
name: infoq-backend-verify
description: 为本仓库后端执行可重复验证，覆盖 service/controller/mapper/plugin/aspect 单测、Mapper XML 集成、HTTP smoke、WebSocket cluster smoke、登录/auth 校验和 Redisson OSS 兼容性验证。适用于后端测试设计、覆盖率回补、登录诊断、API smoke、运行态验证和后端回归验证。
---

# InfoQ 后端验证

本技能只负责一件事：后端测试和运行态验证闭环。它是后端领域型 SOP，优先复用仓库脚本和 Maven runner，不临时拼接不可复跑命令，也不主导数据库侧数据修复。

## 模式选择

1. 单测、覆盖率、Mapper XML、回归补测或 test-first backend fix，读取 `references/unit/*`。
2. HTTP API smoke、导出、菜单、受保护接口、运行态验证，使用 smoke 脚本并读取 `references/smoke/endpoints.md`。
3. 登录成功、token、`/auth/login`、加密/明文登录回退和鉴权失败诊断，使用 `scripts/verify_login.mjs` 并读取 `references/login/endpoints.md`。
4. WebSocket 集群、双节点路由或异常退出验证，使用 `scripts/run_cluster_smoke.mjs`。
5. SQL、数据库、Redis、数据修复、迁移、测试数据维护或 API/UI/DB 一致性验证，改用 `infoq-data-ops`。

## 执行顺序

1. 判定范围：先确认是单测、登录诊断、HTTP smoke、WebSocket 集群、Mapper XML，还是 Redisson OSS 兼容性验证。
2. 只读探测：先读取配置、测试命令、端点说明和已有状态文件；不要先启动长生命周期进程。
3. 最小闭环：每类问题先跑最小可复现命令，再扩展到完整 suite。
4. 写入门禁：涉及数据库初始化、测试数据、导出、缓存清理、限流状态或登录态变更时，先列出目标表/键/接口、影响范围、清理方式和回滚条件；数据修复方案转交 `infoq-data-ops`。
5. 执行验证：检查退出码、HTTP 响应、日志摘要、状态文件、owned 端口收口和 Redisson OSS 报错。
6. 失败处理：产品代码缺陷、环境缺失、脚本缺陷和外部依赖不可达要分开说明，禁止吞错或伪造成功。

## 默认命令

扫描缺失测试：

```bash
node .codex/skills/infoq-backend-verify/scripts/scan_missing_tests.mjs
```

登录链路校验：

```bash
node .codex/skills/infoq-backend-verify/scripts/verify_login.mjs
```

后端 HTTP smoke：

```bash
node .codex/skills/infoq-backend-verify/scripts/run_smoke.mjs
```

双节点 WebSocket cluster smoke：

```bash
node .codex/skills/infoq-backend-verify/scripts/run_cluster_smoke.mjs
```

## 护栏

- 默认不关闭验证码；只有显式快速诊断才允许 `--allow-captcha-disabled`。
- Redisson PRO-only API 报错必须视为产品缺陷，不当作环境噪声。
- 单测失败先排查产品代码，不通过削弱断言、放宽 mock 或伪造成功路径来过关。
- 后端 Maven 命令优先使用 `node .codex/scripts/backend_mvn.mjs -- ...`。
- 任何写入数据库、Redis、文件导出或批量状态变更的诊断必须先明确目标和 cleanup。
- 不把后端 smoke 或单测通过当成数据修复完成；数据侧修复、迁移和一致性核对使用 `infoq-data-ops`。
- 任何由本 skill 启动的后端运行态必须写入 `doc/tmp/infoq-backend-verify/*.state.json`，状态至少覆盖 `starting`、`running`、`passed`、`failed`、`interrupted`、`stopped`。
- `run_smoke.mjs`、`run_cluster_smoke.mjs` 和 `verify_login.mjs --allow-captcha-disabled` 在验证完成、失败或收到 `SIGINT`/`SIGTERM`/`SIGHUP` 时必须关闭自己启动的端口；下一次运行前必须先清理仍为 `running`/`interrupted` 的旧状态。
- 只有显式 `--keep-server` / `--keep-servers` 才允许保留后端进程，且状态文件必须保留 `running` 与 pid/port/log，便于后续清理。

## 参考

- 单测模式：`references/unit/`
- Smoke 端点：`references/smoke/endpoints.md`
- 登录端点：`references/login/endpoints.md`

# 命令清单

## 定向类测试

```bash
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=<ClassNameTest> test
```

## 定向 Mapper XML 集成测试

```bash
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=Sys*MapperXmlIntegrationTest test
```

## 单个 Mapper XML 集成测试类

```bash
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=SysUserMapperXmlIntegrationTest test
```

## 多类联合测试

```bash
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=ClassATest,ClassBTest,ClassCTest test
```

## 模块全量测试

```bash
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test
```

## 覆盖缺口扫描（类级）

```bash
node .codex/skills/infoq-backend-verify/scripts/scan_missing_tests.mjs
```

## 打包与冒烟

```bash
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am clean package -P dev -DskipTests=false
node .codex/skills/infoq-backend-verify/scripts/run_smoke.mjs
```

`run_smoke.mjs` 会将运行态状态写入 `doc/tmp/infoq-backend-verify/run-smoke-<port>.state.json`。验证完成、失败或中断时默认关闭本脚本启动的后端端口；下一次运行前会先清理仍标记为 `running` 或 `interrupted` 的旧状态。

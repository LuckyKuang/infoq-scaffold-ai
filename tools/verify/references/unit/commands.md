# 命令清单

## 定向类测试

```bash
node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=<ClassNameTest> test
```

## 定向 Mapper XML 集成测试

```bash
node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  '-Dtest=Sys*MapperXmlIntegrationTest' test
```

## 单个 Mapper XML 集成测试类

```bash
node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=SysUserMapperXmlIntegrationTest test
```

## 多类联合测试

```bash
node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am \
  -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=ClassATest,ClassBTest,ClassCTest test
```

## 模块全量测试

```bash
node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test
```

## 覆盖缺口扫描（类级）

```bash
node tools/verify/scan_missing_tests.mjs
```

## 打包与冒烟

```bash
node tools/backend_mvn.mjs -- -pl infoq-admin -am clean package -P dev -DskipTests=false
node tools/verify/run_smoke.mjs
```

`run_smoke.mjs` 会将运行态状态写入 `tmp/verify/run-smoke-<port>.state.json`。验证完成、失败或中断时默认关闭本脚本启动的后端端口；下一次运行前会先清理仍标记为 `running` 或 `interrupted` 的旧状态。

打包目标使用 `infoq-admin` 才会产生 smoke 所需的可运行 jar。smoke 会访问配置中的数据库/Redis，须先按 [`../../README.md`](../../README.md) 确认隔离目标、账号和清理方案；本节示例不是只读检查。`<ClassNameTest>` 等占位符必须换成真实测试类。Shell 多行续接按当前 shell 调整；PowerShell 可使用单行命令，保留示例的通配符参数引号，避免 zsh 等 shell 在 Maven 之前展开或拒绝该参数。

默认 Maven profile `dev` 匹配测试的 `@Tag("dev")`。使用其他构建 profile 跑目标测试时必须确认 Surefire `groups` 选择，避免零测试被误判为通过。根 POM 的 60 秒设置约束 fork 和测试超时，不证明整个 reactor 总耗时小于 60 秒；目标验证应记录实际总时长，超限需收窄有意义的测试范围或报告阻塞，不能抬阈值。

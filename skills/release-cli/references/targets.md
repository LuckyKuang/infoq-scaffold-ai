# 受管目标

## 版本字段更新范围

下列 `x.y.z` 占位支持完整 `x.y.z-rcN`（N>0、无前导零）；冻结 SQL 文件名例外。Shields 徽标内 `-` 编码为 `--`，读取时还原；DEPLOY_ID 保持版本后原有14位日期。

- `backend/pom.xml`
  - 根 `<revision>`
- `backend/infoq-core/infoq-core-bom/pom.xml`
  - BOM `<revision>`
- `frontend-react/package.json`
  - 顶层 `"version"`
- `frontend-vue/package.json`
  - 顶层 `"version"`
- `README.md`
  - `![Version](https://img.shields.io/badge/Version-x.y.z-...)`
- `README_CN.md`
  - `![Version](https://img.shields.io/badge/Version-x.y.z-...)`
- `README_JA.md`
  - `![Version](https://img.shields.io/badge/Version-x.y.z-...)`
- `README_ZH_TW.md`
  - `![Version](https://img.shields.io/badge/Version-x.y.z-...)`
- `deploy/DOCKER.md`
  - `当前文档对应项目基线版本为 \`x.y.z\`。`
- `deploy/.env.example`
  - `INFOQ_VERSION=x.y.z`，与版本一致性门禁的模板来源同步
- `deploy/docker/docker-compose.yml`
  - `infoq/infoq-admin:x.y.z`
  - `infoq/infoq-frontend-vue:x.y.z`
  - `infoq/infoq-frontend-react:x.y.z`
- `backend/infoq-admin/src/main/resources/application.yml`
  - `DEPLOY_ID` 注释示例中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀
- `backend/infoq-admin/src/main/resources/application-prod.yml`
  - `DEPLOY_ID` 注释示例中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀
- `backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/SpringDocConfigTest.java`
  - `info.setVersion("x.y.z")`
  - `assertEquals("x.y.z", openAPI.getInfo().getVersion())`
- `backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/properties/SpringDocPropertiesTest.java`
  - `info.setVersion("x.y.z")`
  - `assertEquals("x.y.z", properties.getInfo().getVersion())`
- `backend/infoq-plugin/infoq-plugin-quartz/src/main/java/cc/infoq/common/quartz/properties/QuartzManagedProperties.java`
  - `DEPLOY_ID` JavaDoc 示例中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀
- `backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/runner/QuartzBootstrapCoordinatorTest.java`
  - deployId 测试值、marker key 断言中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀

## SQL 文件名护栏

此技能不会自动重命名 SQL 文件。

它会从 `sql/infoq_scaffold_x.y.z.sql` 中识别唯一的初始化 SQL，并忽略 `sql/infoq_scaffold_update_*.sql` 升级脚本；随后校验以下文件是否仍引用该初始化 SQL：

- `README.md`
- `README_CN.md`
- `deploy/DOCKER.md`
- `deploy/bin/infoq.sh`
- `deploy/docker/docker-compose.yml`

`skills/` 下的文档不再作为版本受管目标；版本真值集中在四套 README、`deploy/` 文档与后端配置。

systemd 示例从受控 `EnvironmentFile` 读取实际 `DEPLOY_ID`，手动部署文档也要求注入真实批次值；这两份文件已无静态版本字段，因此不属于版本同步目标。运行批次值由部署者设置，不能由 bump 改写。

若这些引用与 `sql/` 下真实文件不一致，脚本会失败，并要求显式后续任务处理。
所有替换与断言先在内存中校验，通过后才写入；dry-run 同样核验替换目标且不写入。实际写盘时的权限或 IO 失败仍可能造成部分更新，必须审查差异并仅恢复本次受管修改。

一致性检查用 `node tools/check_release_version.mjs`；指定 `--tag v<version>` 或 `--expect <version>` 可要求候选版本。二者同时给出时必须一致，重复选项、空值与额外 `=` 内容不接受。`node tools/test_check_release_version.mjs` 在副本中验证这些失败语义与13来源一致性，不修改真实版本字段。

## 非目标

- 不重命名 `sql/infoq_scaffold_*.sql`
- 不改动 `sql/infoq_scaffold_update_*.sql`
- 不更新依赖版本（如第三方包或框架版本）
- 不修改 lockfile
- 不执行 release、deploy 或镜像推送步骤

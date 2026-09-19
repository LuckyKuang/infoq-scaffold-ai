# 受管目标

## 版本字段更新范围

- `infoq-scaffold-backend/pom.xml`
  - 根 `<revision>`
- `infoq-scaffold-backend/infoq-core/infoq-core-bom/pom.xml`
  - BOM `<revision>`
- `infoq-scaffold-frontend-react/package.json`
  - 顶层 `"version"`
- `infoq-scaffold-frontend-vue/package.json`
  - 顶层 `"version"`
- `README.md`
  - `![Version](https://img.shields.io/badge/Version-x.y.z-...)`
- `doc/devops/docker-compose-deploy.md`
  - `当前文档对应项目基线版本为 \`x.y.z\`。`
- `doc/devops/manual-deploy.md`
  - `DEPLOY_ID=x.y.z-YYYYMMDDHHMMSS` 示例中的版本前缀
- `doc/examples/systemd/infoq-admin.service`
  - `Environment="DEPLOY_ID=x.y.z-YYYYMMDDHHMMSS"`
- `script/docker/docker-compose.yml`
  - `infoq/infoq-admin:x.y.z`
  - `infoq/infoq-frontend-vue:x.y.z`
  - `infoq/infoq-frontend-react:x.y.z`
- `infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml`
  - `DEPLOY_ID` 注释示例中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀
- `infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml`
  - `DEPLOY_ID` 注释示例中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀
- `infoq-scaffold-backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/SpringDocConfigTest.java`
  - `info.setVersion("x.y.z")`
  - `assertEquals("x.y.z", openAPI.getInfo().getVersion())`
- `infoq-scaffold-backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/properties/SpringDocPropertiesTest.java`
  - `info.setVersion("x.y.z")`
  - `assertEquals("x.y.z", properties.getInfo().getVersion())`
- `infoq-scaffold-backend/infoq-plugin/infoq-plugin-quartz/src/main/java/cc/infoq/common/quartz/properties/QuartzManagedProperties.java`
  - `DEPLOY_ID` JavaDoc 示例中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀
- `infoq-scaffold-backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/runner/QuartzBootstrapCoordinatorTest.java`
  - deployId 测试值、marker key 断言中的 `x.y.z-YYYYMMDDHHMMSS` 版本前缀

## SQL 文件名护栏

此技能不会自动重命名 SQL 文件。

它会从 `sql/infoq_scaffold_x.y.z.sql` 中识别唯一的初始化 SQL，并忽略 `sql/infoq_scaffold_update_*.sql` 升级脚本；随后校验以下文件是否仍引用该初始化 SQL：

- `README.md`
- `doc/devops/docker-compose-deploy.md`
- `script/bin/infoq.sh`
- `script/docker/docker-compose.yml`
- `.codex/skills/infoq-project-reference/references/project-reference.md`

若这些引用与 `sql/` 下真实文件不一致，脚本会失败，并要求显式后续任务处理。

## 非目标

- 不重命名 `sql/infoq_scaffold_*.sql`
- 不改动 `sql/infoq_scaffold_update_*.sql`
- 不更新依赖版本（如第三方包或框架版本）
- 不修改 lockfile
- 不执行 release、deploy 或镜像推送步骤

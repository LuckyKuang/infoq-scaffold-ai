# 路由来源规则

## 主真值

运行中的后端 `/system/menu/getRouters` 是当前账号动态管理页的真值；静态设计矩阵解析 SQL 中的 `sys_menu`，不连接数据库。生成器读取：

- `sql/infoq_scaffold_x.y.z.sql`（冻结初始化基线，当前为 `sql/infoq_scaffold_3.0.0.sql`）
- `sql/infoq_scaffold_update_*.sql`

当前 SQL 解析器只合并可识别的 `INSERT ... VALUES` / 简单 `INSERT ... SELECT`，按菜单 ID 覆盖；不执行 SQL，也不重放 `UPDATE` / `DELETE` 或任意查询。因此生成矩阵不能替代已迁移数据库与当前角色的实时菜单核对。`existingTests` 仅按测试文件路径关联，不读取断言，也不代表测试已执行。

## 前端页面校验

React 页面路径：

```text
frontend-react/src/pages/<component>.tsx
```

Vue 页面路径：

```text
frontend-vue/src/views/<component>.vue
```

当 `component` 以 `/index` 结尾时，也应匹配同目录 `index.tsx` 或 `index.vue`。

## 固定路由

固定路由不依赖后端菜单，必须补充到矩阵；其中首页、个人中心、消息中心需要登录，不能统称公开路由：

- `/login`
- `/register`
- `/forgot-password`
- `/oauth/callback`
- `/index`
- `/user/profile`
- `/message-center`
- `/401`
- `/404`
- `/redirect/:path*`

`/404` 是触发 catch-all 错误页的测试地址；`/redirect/:path*` 是矩阵中的统一占位表示，实际 Vue 配置为 `/redirect/:path(.*)`，React 为 `/redirect/*`。参数化路由必须替换成真实测试路径后才可执行。

## 隐藏路由

后端菜单 `visible='1'` 的页面仍应进入矩阵，但默认不作为 P0 可见菜单 smoke。

## 权限按钮

菜单类型 `F` 的记录不单独生成页面 smoke，应生成权限或 CRUD 场景，并继承父菜单路由与组件。

定时任务、缓存、OSS 文件/配置的写操作属于 P2，不能因为菜单按钮常见而降为 P1；门禁与数据恢复要求见 `docs/TESTING.md`。静态优先级不代表已获得执行授权。

## 矩阵生成回归 SOP

触发条件：固定路由、页面组件、SQL 菜单或矩阵生成器发生变化。

1. 对照两端固定路由源码和菜单 SQL 确认来源；不要为消除缺口而随意把未映射页面加入忽略列表。
2. 先在临时目录生成、校验，检查新增/缺失用例和客户端匹配，再执行生成器回归。回归通过隔离的 SQL → Markdown 主流程确认菜单名中的反斜杠与 `|` 均作为表格单元格文本保留，不得只转义管道符而破坏列边界。

```bash
node skills/test-cli/scripts/generate-case-matrix.mjs --output-dir tmp/test-cli/matrix-preview
node skills/test-cli/scripts/validate-case-matrix.mjs tmp/test-cli/matrix-preview/case-matrix.json
node skills/test-cli/scripts/test_case_matrix.mjs
```

3. 确认结果后运行无输出覆盖参数的生成器，同步更新 `docs/testing/case-matrix.json`、`case-matrix.md`、`gaps.md`，最后审查 diff。

失败时保留生成命令、错误和临时矩阵。禁止手工修改生成结果、把静态 gaps=0 当作 E2E 通过、把有副作用的运行态登录作为静态校验。

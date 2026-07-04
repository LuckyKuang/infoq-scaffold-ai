# 测试矩阵 Schema

`case-matrix.json` 顶层结构：

```json
{
  "generatedAt": "2026-06-05T00:00:00.000Z",
  "repoRoot": "/path/to/repo",
  "sources": {
    "sqlFiles": [],
    "reactPages": [],
    "reactProPages": [],
    "vueViews": [],
    "reactTests": [],
    "reactProTests": [],
    "vueTests": []
  },
  "summary": {
    "totalCases": 0,
    "p0": 0,
    "p1": 0,
    "p2": 0
  },
  "cases": []
}
```

每条 `cases[]` 至少包含：

- `id`：稳定用例 ID，例如 `FE-SYSTEM-USER-001`。
- `source`：`menu`、`permission` 或 `fixed-route`。
- `moduleKey`：模块键，例如 `system.user`。
- `menuName`：菜单或固定路由名称。
- `menuType`：`M`、`C`、`F` 或 `fixed`。
- `routePath`：候选路由路径，必须以 `/` 开头。
- `component`：后端菜单组件路径或固定页面路径。
- `clients`：适用端数组，值为 `react`、`react-pro`、`vue`。
- `priority`：`P0`、`P1`、`P2`。
- `automationType`：`smoke`、`route`、`CRUD`、`permission`、`negative`、`visual`、`integration`。
- `sideEffect`：布尔值。
- `dependencies`：依赖清单，例如 `backend`、`captcha`、`OSS`。
- `preconditions`：前置条件。
- `steps`：自动化步骤。
- `assertions`：断言点。
- `testData`：测试数据要求。
- `cleanup`：清理或回滚要求。
- `gaps`：该用例的缺口说明。

校验器必须拒绝：

- 重复 `id`。
- 空 `clients`。
- 非法 `priority`。
- 非法 `automationType`。
- 缺少必需字段。

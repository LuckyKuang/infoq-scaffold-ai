# 测试矩阵 Schema

`case-matrix.json` 顶层结构：

```json
{
  "generatedAt": "2026-06-05T00:00:00.000Z",
  "repoRoot": ".",
  "sources": {
    "sqlFiles": [],
    "reactPages": [],
    "vueViews": [],
    "reactTests": [],
    "vueTests": []
  },
  "summary": {
    "totalCases": 0,
    "p0": 0,
    "p1": 0,
    "p2": 0,
    "reactCases": 0,
    "vueCases": 0,
    "sideEffectCases": 0,
    "gaps": 0,
    "safetyGates": 0
  },
  "cases": [],
  "gaps": [],
  "safetyGates": []
}
```

每条 `cases[]` 至少包含：

- `id`：稳定用例 ID，例如 `FE-SYSTEM-USER-001`。
- `source`：`menu`、`permission` 或 `fixed-route`。
- `moduleKey`：模块键，例如 `system.user`。
- `menuName`：菜单或固定路由名称。
- `menuType`：`M`、`C`、`F` 或 `fixed`。
- `routePath`：候选路由路径，必须以 `/` 开头。
- `component`：后端菜单组件路径或固定页面路径；目录菜单可能为空。生成器会输出此字段，当前校验器不将它列为必填键，审计仍需核对实际组件匹配。
- `clients`：适用端数组，值为 `react`、`vue`。
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

`sideEffect` 主要由按钮权限操作分类推导；固定登录 smoke 的 `false` 不代表无 Redis、会话或登录记录写入。生成器不执行用例，也不会强制运行态操作门禁。所有需要真实登录的用例仍遵守 `docs/TESTING.md` 第 2、5、6 节。

校验器必须拒绝：

- 重复 `id`。
- 空 `clients`。
- 非法 `priority`。
- 非法 `automationType`。
- 缺少必需字段。

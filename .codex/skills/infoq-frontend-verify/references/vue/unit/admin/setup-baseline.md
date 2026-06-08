# 基线准备（infoq-scaffold-frontend-vue）

## 必需文件

- `vitest.config.ts`
- `tests/setup.ts`
- `.env.test`
- `tests/**/*.test.ts`

## `vitest.config.ts` 关键项

- `environment: 'jsdom'`
- `setupFiles: ['./tests/setup.ts']`
- `globals: true`
- `css: false`
- Alias: `@ -> ./src`
- 运行时代码编译所需自动导入：
  - `vue`
  - `pinia`
  - `@vueuse/core`
  - `vue-router`
  - `element-plus/es`: `ElMessage`, `ElMessageBox`, `ElNotification`, `ElLoading`

## `setup.ts` 关键项

- Mock `element-plus/es`
- Mock `element-plus`（用于从根包路径导入的模块）
- 在顶层定义内存版 `localStorage` 与 `sessionStorage`（先于测试导入模块）
- Polyfill：
  - `window.matchMedia`
  - `ResizeObserver`
  - `document.execCommand`
- 在 `afterEach` 清理 mocks/storage

## `package.json` 脚本

```json
{
  "test:unit": "vitest --config vitest.config.ts --run",
  "test:unit:watch": "vitest --config vitest.config.ts",
  "test:unit:coverage": "vitest --config vitest.config.ts --run --coverage"
}
```

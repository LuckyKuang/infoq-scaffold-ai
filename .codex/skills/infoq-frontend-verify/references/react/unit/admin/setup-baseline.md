# 基线准备（infoq-scaffold-frontend-react）

## 必需文件

- `vite.config.ts`
- `tests/setup.ts`
- `tests/helpers/renderWithRouter.tsx`
- `tests/**/*.test.ts`
- `tests/**/*.test.tsx`

## `vite.config.ts` 关键项

- `test.environment: 'jsdom'`
- `test.setupFiles: ['./tests/setup.ts']`
- `test.globals: true`
- `test.include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']`
- `test.css: false`
- `test.mockReset`, `test.clearMocks`, and `test.restoreMocks` enabled
- Alias: `@ -> ./src`

## `setup.ts` 关键项

- 加载 `@testing-library/jest-dom/vitest`
- 在应用模块读取前，于顶层定义内存版 `localStorage` 与 `sessionStorage`
- Polyfill `window.matchMedia`
- 提供 `ResizeObserver`
- 保证 `window.getComputedStyle` 在 jsdom 下可调用
- 预先加载一次 `@/lang`，确保依赖 i18n 的组件渲染可确定

## `package.json` 脚本

```json
{
  "test": "vitest --run",
  "test:watch": "vitest",
  "test:coverage": "vitest --run --coverage",
  "lint:fix": "eslint --fix .",
  "build:prod": "vite build --mode production"
}
```

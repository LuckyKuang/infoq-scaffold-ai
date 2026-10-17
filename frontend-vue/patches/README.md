# 本地依赖补丁

## `@vueuse__core@14.3.0.patch`

- 适用范围：仅 `@vueuse/core@14.3.0` 的 `dist/index.js`。
- 原因：Vite `8.0.16` 使用的 Rolldown `1.0.3` 会对两处位置无效的 `/* #__PURE__ */` 标注输出 `INVALID_ANNOTATION`。
- 行为边界：补丁只删除无效标注及其多余括号，不修改任何运行时代码、导出或依赖版本。
- 移除条件：`@vueuse/core` 发布修正这两处分发标注的稳定版本并完成升级验证后，删除本补丁、`package.json` 中对应的 `pnpm.patchedDependencies` 条目和 lockfile 中的 `patchedDependencies` 条目。

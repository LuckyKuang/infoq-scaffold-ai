# Mock 模式

## 复用全局运行时 Mock

`tests/setup.ts` 已提供：
- Taro storage and navigation stubs
- `request` and `uploadFile` stubs
- `wx.env.USER_DATA_PATH`

优先复用上述默认能力。仅在特定分支需要时，才增加按用例覆盖。

## 分支隔离的模块 Mock

针对 `src/api/request.ts` 及类似模块：

1. 在导入目标模块前执行 `vi.resetModules()`。
2. 通过 `vi.doMock(...)` 注入依赖（`@tarojs/taro`、env/auth/crypto/rsa 模块）。
3. mock 安装后再导入目标模块。

该模式可保证分支测试确定性，并避免跨用例状态污染。

## Store 测试模式

针对 `src/store/session.ts`：

1. 用 `vi.hoisted` mock `@/api` 方法。
2. 在 `beforeEach` 重置 store 状态。
3. 通过 store API 直接断言状态迁移与 helper 委派行为。

## 失败分支

必须补充显式错误路径断言：
- network/request reject
- logout reject
- token 缺失分支
- env 异常或不支持运行时分支

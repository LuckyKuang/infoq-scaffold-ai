# Weapp Vue 单测覆盖 Fastpath 模板

## 触发条件

- 目标仓库：`infoq-scaffold-frontend-weapp-vue`
- 任务类型：补齐 `request/store/utils` 分支覆盖、回归缺陷修复、coverage 防回退
- 前置状态：`pnpm run test` 可执行

## 目录约定

- request：`tests/core/request.test.ts`
- store：`tests/store/session.test.ts`
- utils：`tests/core/{env,helpers,auth,crypto,permissions,rsa,theme}.test.ts`

## 用例命名规范

- 使用 `V-<模块缩写>-<编号>`，示例：`V-RQ-01`、`V-SS-02`、`V-ENV-03`、`V-HP-04`
- 名称包含动作与预期，例如 `V-RQ-05 should extract response.data.message`

## Mock 模板

### request 模块（分支控制）

```ts
vi.resetModules();
vi.doMock('../../src/utils/env', () => ({ mobileEnv: { ...fixture } }));
vi.doMock('../../src/utils/auth', () => ({ getToken: mockGetToken, removeToken: mockRemoveToken }));
const requestModule = await import('../../src/api/request');
```

### env 模块（初始化时序）

```ts
vi.resetModules();
vi.stubEnv('UNI_PLATFORM', 'web');
Object.defineProperty(globalThis, '__INFOQ_COMPILE_ENV__', { value: compileEnv, writable: true, configurable: true });
const envModule = await import('../../src/utils/env');
```

固定顺序：`resetModules -> 注入 env/runtime -> import 目标模块`。

## 验证命令顺序

```bash
cd infoq-scaffold-frontend-weapp-vue
pnpm run test -- tests/core/request.test.ts tests/store/session.test.ts tests/core/env.test.ts tests/core/helpers.test.ts
pnpm run test
pnpm run test:coverage
pnpm run build:weapp:dev
pnpm run build:weapp
```

## 常见失败修复策略

- `Cannot read properties of undefined (reading 'forEach')`：优先修复产品代码分支守卫，再补回归断言。
- `import.meta.env` 分支未命中：使用 `vi.stubEnv`，并在 `afterEach` 调 `vi.unstubAllEnvs()`。
- request 错误文案回退异常：补 `error.data/response/response.data` 分支测试，默认文案必须可读，禁止 `[object Object]`。

## 反模式

- 为了通过而删断言或改成宽松匹配
- 通过扩大 coverage exclude 或下调阈值“达标”
- 用测试改写隐藏产品代码缺陷

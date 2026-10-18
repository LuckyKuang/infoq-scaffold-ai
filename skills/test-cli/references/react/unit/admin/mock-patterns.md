# Mock 模式

## 目录

- 1) 登录 API 模块 mock
- 2) Zustand store 基线
- 3) Router 包装辅助函数
- 4) 使用 `MemoryRouter` 验证鉴权守卫
- 5) 无网络 request adapter 覆盖
- 6) Fullscreen API 精确桩
- 7) 图表页 ResizeObserver 覆盖
- 8) 页面级组件桩模式

## 1) 登录 API 模块 mock

```ts
vi.mock('@/api/login', () => ({
  getCodeImg: vi.fn().mockResolvedValue({
    data: {
      captchaEnabled: true,
      uuid: 'uuid-1',
      img: 'abc'
    }
  })
}));
```

## 2) Zustand store 基线

```ts
beforeEach(() => {
  useUserStore.setState({
    token: '',
    roles: [],
    permissions: []
  });
  usePermissionStore.setState({
    routes: [],
    sidebarRouters: []
  });
});
```

## 3) Router 包装辅助函数

```ts
import { renderWithRouter } from '../helpers/renderWithRouter';

renderWithRouter(<CachePage />, '/monitor/cache');
```

## 4) 使用 `MemoryRouter` 验证鉴权守卫

```ts
render(
  <MemoryRouter initialEntries={['/system/user']}>
    <Routes>
      <Route path="/login" element={<div>Login Page</div>} />
      <Route
        path="*"
        element={
          <AuthGuard>
            <div>Protected</div>
          </AuthGuard>
        }
      />
    </Routes>
  </MemoryRouter>
);
```

## 5) 无网络 request adapter 覆盖

```ts
(service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
  createResponse(config, {
    code: 200,
    data: { ok: true }
  });
```

## 6) Fullscreen API 精确桩

```ts
Object.defineProperty(document, 'fullscreenElement', {
  configurable: true,
  value: null
});
Object.defineProperty(document.documentElement, 'requestFullscreen', {
  configurable: true,
  value: vi.fn()
});
Object.defineProperty(document, 'exitFullscreen', {
  configurable: true,
  value: vi.fn()
});
```

## 7) 图表页 ResizeObserver 覆盖

```ts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
```

## 8) 页面级组件桩模式

```ts
vi.mock('@/components/Pagination', () => ({
  default: () => <div data-testid="pagination-stub" />
}));

vi.mock('@/components/RightToolbar', () => ({
  default: () => <button type="button">toolbar-stub</button>
}));
```

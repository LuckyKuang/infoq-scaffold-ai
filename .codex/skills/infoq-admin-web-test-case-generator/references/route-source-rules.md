# 路由来源规则

## 主真值

后端 `sys_menu` 是动态管理页的主真值。生成器应读取：

- `sql/infoq_scaffold_2.0.0.sql`
- `sql/infoq_scaffold_update_*.sql`

## 前端页面校验

React 页面路径：

```text
infoq-scaffold-frontend-react/src/pages/<component>.tsx
```

Vue 页面路径：

```text
infoq-scaffold-frontend-vue/src/views/<component>.vue
```

当 `component` 以 `/index` 结尾时，也应匹配同目录 `index.tsx` 或 `index.vue`。

## 固定路由

固定公开路由不依赖后端菜单，必须补充到矩阵：

- `/login`
- `/register`
- `/forgot-password`
- `/oauth/callback`
- `/index`
- `/user/profile`
- `/401`
- `/404`
- `/redirect/:path*`

## 隐藏路由

后端菜单 `visible='1'` 的页面仍应进入矩阵，但默认不作为 P0 可见菜单 smoke。

## 权限按钮

菜单类型 `F` 的记录不单独生成页面 smoke，应生成权限或 CRUD 场景，并继承父菜单路由与组件。

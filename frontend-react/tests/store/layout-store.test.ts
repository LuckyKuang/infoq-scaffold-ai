import { beforeEach, describe, expect, it } from 'vitest';
import { defaultLayoutSettings, normalizeThemeColor, useSettingsStore } from '@/store/modules/settings';
import { useTagsViewStore } from '@/store/modules/tagsView';

describe('store/layout', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      theme: '#1677ff',
      dark: false,
      topNav: false,
      tagsView: true,
      fixedHeader: false,
      sideTheme: 'theme-dark'
    });
    useTagsViewStore.setState({
      visitedViews: [],
      cachedViews: []
    });
  });

  it('persists settings changes', () => {
    useSettingsStore.getState().setTheme('#ff4d4f');
    useSettingsStore.getState().toggleDark(true);
    useSettingsStore.getState().toggleTopNav(true);

    const persisted = JSON.parse(localStorage.getItem('layout-setting') || '{}');
    expect(persisted.theme).toBe('#FF4D4F');
    expect(persisted.dark).toBe(true);
    expect(persisted.topNav).toBe(true);
  });

  it('normalizes rgb theme colors before persisting', () => {
    useSettingsStore.getState().setTheme('RGB(255,69,0)');

    const persisted = JSON.parse(localStorage.getItem('layout-setting') || '{}');
    expect(useSettingsStore.getState().theme).toBe('#FF4500');
    expect(persisted.theme).toBe('#FF4500');
  });

  it('normalizes shorthand hex and falls back for invalid values', () => {
    expect(normalizeThemeColor('#abc')).toBe('#AABBCC');
    expect(normalizeThemeColor('invalid-theme')).toBe(defaultLayoutSettings.theme);
  });

  it('supports tags add/close/closeOthers/closeLeft/closeRight/closeAll', () => {
    const store = useTagsViewStore.getState();

    store.addView({ fullPath: '/index', name: 'index', path: '/index', title: '首页', affix: true });
    store.addView({ fullPath: '/system/user', name: 'user', path: '/system/user', title: '用户管理' });
    store.addView({ fullPath: '/system/role', name: 'role', path: '/system/role', title: '角色管理' });
    store.addView({ fullPath: '/monitor/cache', name: 'cache', path: '/monitor/cache', title: '缓存监控' });

    expect(useTagsViewStore.getState().visitedViews).toHaveLength(4);

    useTagsViewStore.getState().delRightViews('/system/user');
    expect(useTagsViewStore.getState().visitedViews.map((item) => item.path)).toEqual(['/index', '/system/user']);

    store.addView({ fullPath: '/system/role', name: 'role', path: '/system/role', title: '角色管理' });
    store.addView({ fullPath: '/monitor/cache', name: 'cache', path: '/monitor/cache', title: '缓存监控' });

    useTagsViewStore.getState().delLeftViews('/system/role');
    expect(useTagsViewStore.getState().visitedViews.map((item) => item.path)).toEqual(['/index', '/system/role', '/monitor/cache']);

    useTagsViewStore.getState().delOthersViews('/system/role');
    expect(useTagsViewStore.getState().visitedViews.map((item) => item.path)).toEqual(['/index', '/system/role']);

    useTagsViewStore.getState().delAllViews();
    expect(useTagsViewStore.getState().visitedViews.map((item) => item.path)).toEqual(['/index']);
  });

  it('keeps home tag at the far left even when added after business tags', () => {
    const store = useTagsViewStore.getState();

    store.addView({ fullPath: '/system/dept/index', name: 'Dept', path: '/system/dept/index', title: '部门管理' });
    store.addView({ fullPath: '/index', name: 'index', path: '/index', title: '首页', affix: true });
    store.addView({ fullPath: '/system/menu/index', name: 'Menu', path: '/system/menu/index', title: '菜单管理' });

    expect(useTagsViewStore.getState().visitedViews.map((item) => item.path)).toEqual([
      '/index',
      '/system/dept/index',
      '/system/menu/index'
    ]);
  });
});

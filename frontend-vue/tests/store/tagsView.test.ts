import { createPinia, setActivePinia } from 'pinia';
import { useTagsViewStore } from '@/store/modules/tagsView';
import type { RouteLocationNormalized } from 'vue-router';

type RouteMetaLike = RouteLocationNormalized['meta'];

const makeRoute = (path: string, name: string, extras?: Partial<RouteLocationNormalized>): RouteLocationNormalized => {
  return {
    path,
    name,
    meta: {},
    matched: [],
    fullPath: path,
    hash: '',
    query: {},
    params: {},
    redirectedFrom: undefined,
    href: path,
    ...extras
  } as unknown as RouteLocationNormalized;
};

describe('store/tagsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds and deletes visited/cached views', async () => {
    const store = useTagsViewStore();
    const view = makeRoute('/system/user', 'SysUser', { meta: { title: '用户管理' } as RouteMetaLike });

    store.addView(view);
    expect(store.getVisitedViews()).toHaveLength(1);
    expect(store.getCachedViews()).toContain('SysUser');

    const result = await store.delView(view);
    expect(result.visitedViews).toHaveLength(0);
    expect(result.cachedViews).toHaveLength(0);
  });

  it('keeps affix tag when deleting others/all', async () => {
    const store = useTagsViewStore();
    const affix = makeRoute('/index', 'Index', { meta: { title: '首页', affix: true } as RouteMetaLike });
    const user = makeRoute('/system/user', 'SysUser', { meta: { title: '用户管理' } as RouteMetaLike });
    const role = makeRoute('/system/role', 'SysRole', { meta: { title: '角色管理' } as RouteMetaLike });

    store.addView(affix);
    store.addView(user);
    store.addView(role);

    await store.delOthersViews(user);
    expect(store.getVisitedViews().map((v) => v.path)).toEqual(['/index', '/system/user']);

    await store.delAllViews();
    expect(store.getVisitedViews().map((v) => v.path)).toEqual(['/index']);
  });

  it('deletes left and right tags', async () => {
    const store = useTagsViewStore();
    const a = makeRoute('/a', 'A', { meta: { title: 'A' } as RouteMetaLike });
    const b = makeRoute('/b', 'B', { meta: { title: 'B' } as RouteMetaLike });
    const c = makeRoute('/c', 'C', { meta: { title: 'C' } as RouteMetaLike });

    store.addView(a);
    store.addView(b);
    store.addView(c);

    await store.delLeftTags(b);
    expect(store.getVisitedViews().map((v) => v.path)).toEqual(['/b', '/c']);

    await store.delRightTags(b);
    expect(store.getVisitedViews().map((v) => v.path)).toEqual(['/b']);
  });

  it('supports iframe list and update view', async () => {
    const store = useTagsViewStore();
    const iframeRoute = makeRoute('/iframe', 'Iframe', { meta: { title: '嵌套页' } as RouteMetaLike });

    store.addIframeView(iframeRoute);
    expect(store.getIframeViews()).toHaveLength(1);

    await store.delIframeView(iframeRoute);
    expect(store.getIframeViews()).toHaveLength(0);

    const route = makeRoute('/u', 'U', { meta: { title: '旧标题' } as RouteMetaLike });
    store.addVisitedView(route);
    store.updateVisitedView(makeRoute('/u', 'U', { meta: { title: '新标题' } as RouteMetaLike }));
    expect(store.getVisitedViews()[0].meta?.title).toBe('新标题');
  });

  it('handles duplicate adds and default title fallbacks', () => {
    const store = useTagsViewStore();
    const noTitleVisited = makeRoute('/no-title', 'NoTitle', { meta: {} as RouteMetaLike });
    const noTitleIframe = makeRoute('/no-title-iframe', 'NoTitleIframe', { meta: {} as RouteMetaLike });

    store.addVisitedView(noTitleVisited);
    store.addVisitedView(noTitleVisited);
    expect(store.getVisitedViews()).toHaveLength(1);
    expect((store.getVisitedViews()[0] as { title: string }).title).toBe('no-name');

    store.addIframeView(noTitleIframe);
    store.addIframeView(noTitleIframe);
    expect(store.getIframeViews()).toHaveLength(1);
    expect((store.getIframeViews()[0] as { title: string }).title).toBe('no-name');
  });

  it('handles cached view edge cases', async () => {
    const store = useTagsViewStore();
    const a = makeRoute('/a', 'A', { meta: { title: 'A' } as RouteMetaLike });
    const bNoName = makeRoute('/b', undefined as unknown as string, { meta: { title: 'B' } as RouteMetaLike });
    const unknown = makeRoute('/unknown', 'Unknown', { meta: { title: 'Unknown' } as RouteMetaLike });

    store.addCachedView(a);
    store.addCachedView(a); // duplicate should be ignored
    store.addCachedView(bNoName); // no name should be ignored
    expect(store.getCachedViews()).toEqual(['A']);

    // unknown current view name should clear cached list in delOthersCachedViews
    await store.delOthersViews(unknown);
    expect(store.getCachedViews()).toEqual([]);
  });

  it('keeps state unchanged when delLeftTags/delRightTags target is missing', () => {
    const store = useTagsViewStore();
    const a = makeRoute('/a', 'A', { meta: { title: 'A' } as RouteMetaLike });
    const b = makeRoute('/b', 'B', { meta: { title: 'B' } as RouteMetaLike });
    const missing = makeRoute('/missing', 'Missing', { meta: { title: 'Missing' } as RouteMetaLike });

    store.addView(a);
    store.addView(b);
    const beforeVisited = store.getVisitedViews().map((v) => v.path);
    const beforeCached = [...store.getCachedViews()];

    // index === -1 branch: function returns pending promise, so we only trigger invocation
    void store.delRightTags(missing);
    void store.delLeftTags(missing);

    expect(store.getVisitedViews().map((v) => v.path)).toEqual(beforeVisited);
    expect(store.getCachedViews()).toEqual(beforeCached);
  });
});
